var BM = globalThis.BM = globalThis.BM || {};

// Vue 2D broadcast du match : parquet NBA 94 x 50 pieds, éclairage d'arène, chorégraphies tactiques
// (Pick & Roll, Isolation, Post-Up, Coupes, Motion) et trajectoires physiques du ballon.
(function () {
  var W = 94, H = 50, MARGIN = 3.2;
  var POS_ORDER = { MEN: 0, ARR: 1, AIL: 2, AF: 3, PIV: 4 };
  // Placements offensifs de base [profondeur depuis le panier, y] par poste.
  var SPOTS = [[27.5, 25], [22, 8], [4.5, 3.2], [17, 40], [6.5, 31]];
  var FIVE_OUT = [[28, 25], [23, 7], [23, 43], [5, 3.2], [5, 46.8]];
  var ZONE = [[18, 17], [18, 33], [6.5, 9], [6.5, 41], [4.5, 25]];
  var BENCH = { x: 47, y: 53.2 };

  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function lerp(a, b, u) { return a + (b - a) * u; }

  function Court(canvas, match) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.m = match;
    this.pos = {};          // position courante de chaque joueur (pieds)
    this.tracks = {};       // images-clés de la possession en cours
    this.ballSegs = [];
    this.fx = [];           // effets : anneaux, particules, textes, écrans
    this.netRipple = [0, 0]; // ondulation du filet [panier gauche, panier droit]
    this.t0 = 0; this.T = 1;
    this.shake = 0;
    this.running = true;
    this.resize();
    var self = this;
    this.onResize = function () { self.resize(); };
    window.addEventListener('resize', this.onResize);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.placeInitial();
  }

  Court.prototype.destroy = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
  };

  Court.prototype.resize = function () {
    var par = this.canvas.parentNode;
    if (!par) return;
    var cs = getComputedStyle(par);
    var w = (par.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 360;
    var dpr = window.devicePixelRatio || 1;
    var ratio = (H + MARGIN * 2) / (W + MARGIN * 2);
    // En paysage ou bureau, le terrain doit aussi tenir en hauteur (variable CSS --fit-h posée par la mise en page).
    if (cs.getPropertyValue('--fit-h').trim() === '1') {
      var availH = par.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (availH > 80 && w * ratio > availH) w = availH / ratio;
    }
    var h = w * ratio;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = (w / (W + MARGIN * 2)) * dpr;
    this.courtCache = null;
  };

  Court.prototype.side = function (pid) { return this.m.roster[0].some(function (p) { return p.id === pid; }) ? 0 : 1; };

  // Panier attaqué : l'équipe à domicile attaque à droite en première mi-temps.
  Court.prototype.basketX = function (side, q) {
    var right = (side === 0) === (q <= 2);
    return right ? W - 5.25 : 5.25;
  };

  Court.prototype.at = function (side, q, depth, y) {
    var bx = this.basketX(side, q), dir = bx > W / 2 ? -1 : 1;
    return { x: BM.clamp(bx + dir * depth, 1.8, W - 1.8), y: BM.clamp(y, 2.2, H - 2.2) };
  };

  Court.prototype.placeInitial = function () {
    var m = this.m, self = this;
    [0, 1].forEach(function (s) {
      m.on[s].forEach(function (id, i) {
        var p = self.at(s, 1, 26 + (i % 2) * 6, 8 + i * 8.5);
        self.pos[id] = { x: W / 2 + (s === 0 ? -1 : 1) * (4 + i * 2), y: p.y };
      });
    });
    this.ballHolderIdle = null;
  };

  Court.prototype.sorted = function (ids) {
    var g = this.m.g;
    return ids.slice().sort(function (a, b) { return POS_ORDER[g.players[a].pos] - POS_ORDER[g.players[b].pos]; });
  };

  // Convertit les coordonnées demi-terrain du moteur (play.spot) en coordonnées sur le terrain complet.
  Court.prototype.spotToCourt = function (side, q, spot) {
    if (!spot) return null;
    var depth = Math.max(1.5, (W - 5.25) - spot.x);
    var right = (side === 0) === (q <= 2);
    var y = right ? spot.y : H - spot.y;
    return this.at(side, q, depth, y);
  };

  // ---------------------------------------------------------------- chorégraphie d'une possession
  Court.prototype.animate = function (play, ms) {
    if (!play) return;
    var self = this, m = this.m, q = play.q, o = play.o, d = 1 - o;
    var jit = function () { return (Math.random() - 0.5) * 2.4; };
    var tracks = {}, add = function (id, t, p) { (tracks[id] = tracks[id] || []).push({ t: t, x: p.x, y: p.y }); };
    var onIds = play.on[0].concat(play.on[1]);
    // Joueurs qui sortent : retour au banc.
    Object.keys(this.pos).forEach(function (id) {
      id = +id;
      if (onIds.indexOf(id) < 0) { add(id, 0, self.pos[id]); add(id, 0.38, BENCH); }
    });
    onIds.forEach(function (id) { add(id, 0, self.pos[id] || BENCH); });

    var offIds = this.sorted(play.on[o]), defIds = this.sorted(play.on[d]);
    var bx = this.basketX(o, q), dirIn = bx > W / 2 ? 1 : -1;
    var rim = { x: bx, y: 25 };
    var baseSpots = m.tac[o].play === 'three' ? FIVE_OUT : SPOTS;
    var setup = {};
    offIds.forEach(function (id, i) {
      var s = baseSpots[i] || SPOTS[0], depth = s[0] + jit(), y = s[1] + jit();
      if (play.fast) { depth = 7 + i * 4.8; y = 10 + i * 7; }
      else if (play.action === 'iso' && id !== play.shooter) {
        // Isolation : les 4 coéquipiers écartent le jeu sur le côté faible.
        depth = i % 2 === 0 ? 22 : 5;
        y = i < 2 ? 4 : 46;
      }
      setup[id] = self.at(o, q, depth, y);
    });
    var defSpot = function (oid, i, k) {
      if (m.tac[d].defense === 'zone' && !play.fast) { var z = ZONE[i] || ZONE[0]; return self.at(o, q, z[0], z[1]); }
      var op = setup[oid] || rim;
      return { x: lerp(op.x, rim.x, k), y: lerp(op.y, rim.y, k) };
    };
    var tSet = play.fast ? 0.22 : 0.32;
    offIds.forEach(function (id) { add(id, tSet, setup[id]); });
    defIds.forEach(function (id, i) { add(id, tSet + 0.03, defSpot(offIds[i], i, play.fast ? 0.15 : 0.26)); });

    // Ballon : porteur, passes, tir.
    var segs = [], holder = play.handler || offIds[0];
    var hold = function (pid, t0, t1) { segs.push({ t0: t0, t1: t1, holder: pid }); };
    var fly = function (t0, t1, from, to, peak, kind) { segs.push({ t0: t0, t1: t1, from: from, to: to, peak: peak, kind: kind }); };
    var fx = [];
    this.activeAction = play.action || null;
    this.screenSpot = null;

    if (play.kind === 'shot') {
      var sh = play.shooter, type = play.type;
      var shotSpot = this.spotToCourt(o, q, play.spot);
      if (!shotSpot) {
        if (type === 'rim') shotSpot = this.at(o, q, 2.5 + Math.random() * 2, 25 + jit());
        else if (type === 'mid') shotSpot = this.at(o, q, 13 + Math.random() * 3, 25 + jit() * 3);
        else {
          var sp = setup[sh] || this.at(o, q, 24, 25), depth = Math.abs(sp.x - bx);
          var dist = Math.sqrt(depth * depth + (sp.y - 25) * (sp.y - 25));
          shotSpot = dist >= 23.9 ? sp : this.at(o, q, 25, sp.y < 25 ? 12 : 38);
        }
      }

      // Chorégraphies spécifiques selon l'action tactique (Pick & Roll, Post-up, Cut).
      if (play.action === 'pnr' && play.screener && play.screener !== holder) {
        var hSpot = setup[holder] || this.at(o, q, 26, 25);
        var scrPos = { x: hSpot.x + dirIn * 2.2, y: hSpot.y + (hSpot.y > 25 ? -2.6 : 2.6) };
        add(play.screener, 0.39, scrPos);
        add(play.screener, 0.49, scrPos);
        add(play.screener, 0.62, this.at(o, q, 4.5, 25 + (hSpot.y > 25 ? -3 : 3)));
        this.screenSpot = { x: scrPos.x, y: scrPos.y, t0: 0.36, t1: 0.54 };
        if (holder !== sh) {
          add(holder, 0.47, { x: scrPos.x + dirIn * 3.5, y: scrPos.y + (hSpot.y > 25 ? -3.5 : 3.5) });
        }
      } else if (play.action === 'post') {
        var postBlock = this.at(o, q, 7.5, shotSpot.y < 25 ? 18 : 32);
        add(sh, 0.42, postBlock);
      } else if (play.action === 'cut' && sh !== holder) {
        var startWing = setup[sh] || this.at(o, q, 22, 10);
        add(sh, 0.43, { x: startWing.x - dirIn * 2, y: startWing.y });
      }

      var passer = play.passer && play.passer !== sh ? play.passer : null;
      var tPass1 = 0.44, tPass2 = 0.54, tShot = 0.62, tRim = 0.80;
      hold(holder, 0, tPass1);
      var chain = [holder];
      if (passer && passer !== holder) chain.push(passer);
      if (chain[chain.length - 1] !== sh) chain.push(sh);
      var tp = tPass1;
      for (var c = 1; c < chain.length; c++) {
        var isLob = play.alleyOop && c === chain.length - 1;
        var t1 = Math.min(tShot - 0.03, tp + (isLob ? 0.11 : 0.07));
        fly(tp, t1, { holder: chain[c - 1] }, { holder: chain[c] }, isLob ? 9 : 2.2, isLob ? 'lob' : 'pass');
        var nextT = c === chain.length - 1 ? tShot : Math.min(tShot - 0.05, t1 + 0.04);
        hold(chain[c], t1, nextT);
        tp = nextT;
      }
      if (chain.length === 1) hold(sh, tPass1, tShot);
      add(sh, tPass2 + 0.02, shotSpot);
      add(sh, tShot, shotSpot);
      // Le défenseur direct monte contester le tireur.
      var di = offIds.indexOf(sh), dfId = defIds[Math.max(0, Math.min(di, defIds.length - 1))];
      if (dfId) add(dfId, tShot, { x: lerp(shotSpot.x, rim.x, 0.13), y: shotSpot.y + (shotSpot.y < 25 ? 1.4 : -1.4) });
      if (play.blocker) {
        add(play.blocker, tShot, { x: lerp(shotSpot.x, rim.x, 0.15), y: shotSpot.y - 1 });
        fly(tShot, tShot + 0.06, { holder: sh }, { x: shotSpot.x - dirIn * 4, y: shotSpot.y + jit() * 2 }, 3, 'block');
        fx.push({ t: tShot + 0.04, kind: 'text', text: 'CONTRE !', at: shotSpot, color: this.teamColor(d), sound: 'block' });
        tRim = tShot + 0.06;
      } else {
        fly(tShot, tRim, { holder: sh }, rim, type === 'three' ? 14.5 : type === 'mid' ? 10 : 5.5, play.made ? 'make' : 'miss');
        if (play.made) {
          var pts = type === 'three' ? 3 : 2;
          var label = play.alleyOop ? 'ALLEY-OOP ! +' + pts : play.dunk ? 'DUNK ! +' + pts : play.move === 'stepback' ? 'STEP-BACK ! +' + pts : (type === 'three' ? '3 PTS ! +3' : '+' + pts);
          var snd = play.dunk ? 'dunk' : type === 'three' ? 'three' : 'swish';
          fx.push({ t: tRim, kind: 'swish', at: rim, color: this.teamColor(o), big: type === 'three' || play.dunk, sound: snd, basketRight: bx > W / 2 });
          fx.push({ t: tRim, kind: 'text', text: label, at: rim, color: this.teamColor(o) });
          if (play.dunk || (type === 'three' && play.move === 'stepback')) fx.push({ t: tRim, kind: 'shake' });
        } else {
          fx.push({ t: tRim, kind: 'miss', at: rim, basketRight: bx > W / 2 });
        }
      }
      if (play.fouled) fx.push({ t: tShot, kind: 'text', text: play.made ? 'AND-ONE !' : 'FAUTE', at: shotSpot, color: '#ffd43b' });
      if (play.made && !play.ft) {
        // Repli : l'attaque redescend, la défense récupère le ballon sous le panier.
        segs.push({ t0: tRim, t1: 1, from: rim, to: { x: rim.x - dirIn * 1.5, y: 25 }, peak: 0, kind: 'drop' });
      }
      if (play.reb) {
        var rb = play.reb.id, rspot = { x: rim.x - dirIn * (3.5 + Math.random() * 4), y: 25 + jit() * 3 };
        add(rb, tRim + 0.04, rspot);
        fly(tRim, tRim + 0.1, rim, { holder: rb }, 3.2, 'reb');
        hold(rb, tRim + 0.1, 1);
        if (!play.reb.off) {
          var other = this.basketX(d, q), dirOut = other > W / 2 ? 1 : -1;
          add(rb, 1, { x: rspot.x + dirOut * 8, y: rspot.y });
        } else {
          fx.push({ t: tRim + 0.08, kind: 'text', text: 'REBOND OFF.', at: rspot, color: this.teamColor(o) });
        }
      }
      if (play.ft) fx.push({ t: 0.94, kind: 'text', text: 'LF ' + play.ft.made + '/' + play.ft.n, at: this.at(o, q, 15, 25), color: '#fff' });
    } else if (play.kind === 'tov') {
      hold(holder, 0, 0.5);
      if (play.stealer) {
        add(play.stealer, 0.5, this.pos[holder] ? setup[holder] : rim);
        fly(0.5, 0.56, { holder: holder }, { holder: play.stealer }, 1, 'steal');
        hold(play.stealer, 0.56, 1);
        var gx = this.basketX(d, q), dOut = gx > W / 2 ? 1 : -1;
        add(play.stealer, 1, { x: (setup[holder] || rim).x + dOut * 22, y: 25 + jit() * 4 });
        fx.push({ t: 0.52, kind: 'text', text: 'INTERCEPTION !', at: setup[holder] || rim, color: this.teamColor(d) });
      } else {
        fly(0.5, 0.6, { holder: holder }, { x: (setup[holder] || rim).x, y: 51 }, 2, 'out');
        fx.push({ t: 0.55, kind: 'text', text: 'PERTE DE BALLE', at: setup[holder] || rim, color: '#fff' });
      }
    } else if (play.kind === 'foul') {
      hold(holder, 0, 1);
      fx.push({ t: 0.5, kind: 'text', text: 'FAUTE', at: setup[holder] || rim, color: '#ffd43b' });
      if (play.ft) fx.push({ t: 0.85, kind: 'text', text: 'LF ' + play.ft.made + '/' + play.ft.n, at: this.at(o, q, 15, 25), color: '#fff' });
    } else {
      hold(holder, 0, 1);
    }

    // Mouvements secondaires sans ballon pendant la possession.
    offIds.forEach(function (id) {
      if (id === play.shooter || id === play.screener || (play.reb && play.reb.id === id)) return;
      var s = setup[id];
      add(id, 0.6, { x: BM.clamp(s.x + jit(), 2, W - 2), y: BM.clamp(s.y + jit(), 2.5, H - 2.5) });
      add(id, 1, { x: BM.clamp(s.x + jit(), 2, W - 2), y: BM.clamp(s.y + jit(), 2.5, H - 2.5) });
    });
    defIds.forEach(function (id, i) {
      if (id === play.blocker || (play.reb && play.reb.id === id)) return;
      var s = defSpot(offIds[i], i, 0.3);
      add(id, 0.65, { x: s.x + jit() * 0.6, y: s.y + jit() * 0.6 });
    });

    Object.keys(tracks).forEach(function (id) { tracks[id].sort(function (a, b) { return a.t - b.t; }); });
    this.tracks = tracks;
    this.ballSegs = segs.sort(function (a, b) { return a.t0 - b.t0; });
    this.pendingFx = fx;
    this.t0 = performance.now();
    this.T = ms;
    this.attackDir = dirIn;
    this.offSide = o;
  };

  Court.prototype.teamColor = function (s) { return this.m.side[s].color; };

  Court.prototype.trackPos = function (id, u) {
    var tr = this.tracks[id];
    if (!tr || !tr.length) return this.pos[id] || BENCH;
    if (u <= tr[0].t) return tr[0];
    for (var i = 1; i < tr.length; i++) {
      if (u <= tr[i].t) {
        var a = tr[i - 1], b = tr[i], k = ease((u - a.t) / Math.max(0.0001, b.t - a.t));
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
      }
    }
    return tr[tr.length - 1];
  };

  Court.prototype.resolve = function (ref, u) {
    if (ref.holder !== undefined) {
      var p = this.trackPos(ref.holder, u);
      return { x: p.x + (this.attackDir || 1) * 0.9, y: p.y + 0.6 };
    }
    return ref;
  };

  Court.prototype.ballAt = function (u) {
    var segs = this.ballSegs, seg = null;
    for (var i = 0; i < segs.length; i++) if (u >= segs[i].t0 && u <= segs[i].t1) seg = segs[i];
    if (!seg) seg = segs[segs.length - 1];
    if (!seg) return null;
    if (seg.holder !== undefined) {
      var p = this.resolve({ holder: seg.holder }, u);
      var bounce = Math.abs(Math.sin(u * this.T / 88)) * 0.95; // dribble
      return { x: p.x, y: p.y, z: bounce, seg: seg };
    }
    var k = BM.clamp((u - seg.t0) / Math.max(0.0001, seg.t1 - seg.t0), 0, 1);
    var a = this.resolve(seg.from, seg.t0), b = this.resolve(seg.to, seg.t1);
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: Math.sin(Math.PI * k) * seg.peak, from: a, to: b, seg: seg };
  };

  // ---------------------------------------------------------------- rendu
  Court.prototype.loop = function (now) {
    if (!this.running) return;
    var u = BM.clamp((now - this.t0) / this.T, 0, 1), self = this;
    Object.keys(this.tracks).forEach(function (id) { self.pos[id] = self.trackPos(+id, u); });
    if (this.pendingFx) {
      this.pendingFx = this.pendingFx.filter(function (f) {
        if (u < f.t) return true;
        self.spawn(f, now);
        return false;
      });
    }
    this.draw(now, u);
    this.raf = requestAnimationFrame(this.loop);
  };

  Court.prototype.spawn = function (f, now) {
    if (f.kind === 'shake') { this.shake = now + 280; return; }
    if (f.kind === 'miss') {
      this.netRipple[f.basketRight ? 1 : 0] = now + 350;
      if (BM.Juice) BM.Juice.sound('rim');
      return;
    }
    if (f.kind === 'swish') {
      this.netRipple[f.basketRight ? 1 : 0] = now + 520;
      this.fx.push({ kind: 'ring', x: f.at.x, y: f.at.y, color: f.color, born: now, life: 680 });
      var n = f.big ? 28 : 14;
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * (f.big ? 17 : 9);
        this.fx.push({ kind: 'spark', x: f.at.x, y: f.at.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color: i % 3 ? f.color : '#ffd43b', born: now, life: 720 });
      }
      if (BM.Juice) BM.Juice.sound(f.sound || (f.big ? 'cheer' : 'swish'));
      return;
    }
    if (f.kind === 'text') {
      this.fx.push({ kind: 'text', x: f.at.x, y: f.at.y, text: f.text, color: f.color, born: now, life: 1050 });
      if (BM.Juice) {
        if (f.sound) BM.Juice.sound(f.sound);
        else if (/FAUTE|AND-ONE/.test(f.text)) BM.Juice.sound('whistle');
      }
    }
  };

  Court.prototype.px = function (v) { return (v + MARGIN) * this.scale; };

  Court.prototype.drawCourt = function () {
    if (this.courtCache) return this.courtCache;
    var c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    var x = c.getContext('2d'), s = this.scale, P = this.px.bind(this);
    var home = this.m.side[0].color, away = this.m.side[1].color;

    // 1. Bordures extérieures (tablier de l'arène + table de marque).
    x.fillStyle = '#0e131f';
    x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 0.25;
    x.fillStyle = home;
    x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 1;

    // Ombre interne autour du parquet.
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.fillRect(P(-0.4), P(-0.4), (W + 0.8) * s, (H + 0.8) * s);

    // 2. Parquet en érable : teinte chaude + lattes décalées réalistes.
    var grd = x.createLinearGradient(P(0), P(0), P(W), P(H));
    grd.addColorStop(0, '#dda66b');
    grd.addColorStop(0.5, '#d19457');
    grd.addColorStop(1, '#ba7c42');
    x.fillStyle = grd;
    x.fillRect(P(0), P(0), W * s, H * s);

    // Lattes de bois alternées.
    var plankH = 1.25;
    for (var row = 0, yy = 0; yy < H; row++, yy += plankH) {
      var hClip = Math.min(plankH, H - yy);
      x.fillStyle = (row % 3 === 0) ? 'rgba(255,235,205,0.07)' : (row % 3 === 1) ? 'rgba(90,45,10,0.06)' : 'rgba(160,95,40,0.04)';
      x.fillRect(P(0), P(yy), W * s, hClip * s);
      // Joints de lattes.
      x.strokeStyle = 'rgba(70,38,14,0.12)';
      x.lineWidth = Math.max(0.6, s * 0.05);
      x.beginPath(); x.moveTo(P(0), P(yy)); x.lineTo(P(W), P(yy)); x.stroke();
      var offset = (row * 7.3) % 14;
      for (var xx = offset; xx < W; xx += 14) {
        x.beginPath(); x.moveTo(P(xx), P(yy)); x.lineTo(P(xx), P(yy + hClip)); x.stroke();
      }
    }

    // Reflet des projecteurs d'arène au centre et sur les raquettes.
    var spot = x.createRadialGradient(P(W / 2), P(25), 2 * s, P(W / 2), P(25), 42 * s);
    spot.addColorStop(0, 'rgba(255,250,235,0.22)');
    spot.addColorStop(0.55, 'rgba(255,245,220,0.07)');
    spot.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.fillStyle = spot;
    x.fillRect(P(0), P(0), W * s, H * s);

    // 3. Raquettes peintes aux couleurs des clubs + tablier avec nom de l'équipe.
    x.save();
    x.globalAlpha = 0.62;
    x.fillStyle = home; x.fillRect(P(0), P(17), 19 * s, 16 * s);
    x.fillStyle = away; x.fillRect(P(W - 19), P(17), 19 * s, 16 * s);
    // Double teinte interne dans la raquette.
    x.globalAlpha = 0.18;
    x.fillStyle = '#000';
    x.fillRect(P(0), P(19), 19 * s, 12 * s);
    x.fillRect(P(W - 19), P(19), 19 * s, 12 * s);
    x.restore();

    // Cercle central.
    x.save();
    x.globalAlpha = 0.28;
    x.beginPath(); x.arc(P(W / 2), P(25), 6 * s, 0, Math.PI * 2); x.fillStyle = home; x.fill();
    x.globalAlpha = 0.22;
    x.beginPath(); x.arc(P(W / 2), P(25), 2.2 * s, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
    x.restore();

    // 4. Marquages officiels NBA.
    x.strokeStyle = 'rgba(255,255,255,0.92)';
    x.lineWidth = Math.max(1.3, s * 0.17);
    x.strokeRect(P(0), P(0), W * s, H * s);
    x.beginPath(); x.moveTo(P(W / 2), P(0)); x.lineTo(P(W / 2), P(H)); x.stroke();
    x.beginPath(); x.arc(P(W / 2), P(25), 6 * s, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(P(W / 2), P(25), 2 * s, 0, Math.PI * 2); x.stroke();

    // Marques de la zone de coaching et table de marque sur le tablier.
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.fillRect(P(W / 2 - 9), P(H + 0.5), 18 * s, 1.8 * s);
    x.font = '700 ' + Math.max(7, Math.round(1.35 * s)) + 'px "Barlow Condensed", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText((this.m.side[0].city || this.m.side[0].name || '').toUpperCase() + ' ARENA', P(W / 2), P(-1.55));
    x.fillText('TABLE DE MARQUE', P(W / 2), P(H + 1.45));

    var self = this;
    [5.25, W - 5.25].forEach(function (bx) {
      var dir = bx < W / 2 ? 1 : -1, base = bx < W / 2 ? 0 : W;
      var xKey = Math.min(base, base + dir * 19);
      x.strokeRect(P(xKey), P(17), 19 * s, 16 * s);

      // Demi-cercle des lancers francs (plein côté terrain, pointillé côté panier).
      x.beginPath(); x.arc(P(base + dir * 19), P(25), 6 * s, -Math.PI / 2, Math.PI / 2, dir < 0); x.stroke();
      x.save();
      x.setLineDash([s * 0.7, s * 0.7]);
      x.beginPath(); x.arc(P(base + dir * 19), P(25), 6 * s, -Math.PI / 2, Math.PI / 2, dir > 0); x.stroke();
      x.restore();

      // Encoches de rebond le long de la raquette.
      [7, 11, 14].forEach(function (d) {
        var hx = P(base + dir * d);
        x.beginPath();
        x.moveTo(hx, P(17)); x.lineTo(hx, P(16.1));
        x.moveTo(hx, P(33)); x.lineTo(hx, P(33.9));
        x.stroke();
      });

      // Ligne à 3 points : corners à 22 pieds, arc de 23,75 pieds.
      var ang = Math.asin(22 / 23.75), cx = bx + dir * 23.75 * Math.cos(ang);
      x.beginPath(); x.moveTo(P(base), P(3)); x.lineTo(P(cx), P(3)); x.stroke();
      x.beginPath(); x.moveTo(P(base), P(47)); x.lineTo(P(cx), P(47)); x.stroke();
      x.beginPath();
      if (dir > 0) x.arc(P(bx), P(25), 23.75 * s, -ang, ang, false);
      else x.arc(P(bx), P(25), 23.75 * s, Math.PI - ang, Math.PI + ang, false);
      x.stroke();

      // Demi-cercle de non-charge sous le cercle.
      x.beginPath(); x.arc(P(bx), P(25), 4 * s, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5); x.stroke();
    });

    // Logo central : initiales du club à domicile.
    x.font = '800 ' + Math.round(4.1 * s) + 'px "Barlow Condensed", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.42)';
    x.fillText(self.m.side[0].short, P(W / 2), P(25));

    this.courtCache = c;
    return c;
  };

  // Dessine les paniers (planche, arceau, filet animé lors d'un panier ou rebond).
  Court.prototype.drawHoops = function (x, now) {
    var s = this.scale, P = this.px.bind(this), self = this;
    [5.25, W - 5.25].forEach(function (bx, idx) {
      var dir = bx < W / 2 ? 1 : -1, base = bx < W / 2 ? 0 : W;
      var boardX = P(base + dir * 4);
      var rimX = P(bx), rimY = P(25), rimR = 0.95 * s;
      var ripple = self.netRipple[idx] > now ? Math.sin((self.netRipple[idx] - now) / 32) * s * 0.35 : 0;

      // Bras de support métallique derrière la planche.
      x.strokeStyle = 'rgba(180,190,210,0.65)';
      x.lineWidth = Math.max(1.5, s * 0.25);
      x.beginPath(); x.moveTo(P(base), rimY); x.lineTo(boardX, rimY); x.stroke();

      // Filet tressé blanc (sous l'arceau).
      x.strokeStyle = 'rgba(255,255,255,0.72)';
      x.lineWidth = Math.max(0.8, s * 0.08);
      for (var k = -3; k <= 3; k++) {
        x.beginPath();
        x.moveTo(rimX + k * rimR * 0.28, rimY - rimR * 0.4);
        x.lineTo(rimX + k * rimR * 0.16 + ripple, rimY + rimR * 0.85 + Math.abs(ripple) * 0.5);
        x.stroke();
      }

      // Planche vitrée + carré de visée.
      x.strokeStyle = '#ffffff';
      x.lineWidth = Math.max(2.2, s * 0.38);
      x.beginPath(); x.moveTo(boardX, P(22)); x.lineTo(boardX, P(28)); x.stroke();

      // Arceau orange métallisé.
      x.lineWidth = Math.max(1.6, s * 0.24);
      x.strokeStyle = '#ff6b1a';
      x.beginPath(); x.arc(rimX, rimY, rimR, 0, Math.PI * 2); x.stroke();
    });
  };

  Court.prototype.draw = function (now, u) {
    var x = this.ctx, s = this.scale, P = this.px.bind(this), m = this.m, self = this, g = m.g;
    x.save();
    if (now < this.shake) {
      var k = (this.shake - now) / 280;
      x.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k);
    }
    x.drawImage(this.drawCourt(), 0, 0);
    var ball = this.ballSegs.length ? this.ballAt(u) : null;
    var holder = null;
    this.ballSegs.forEach(function (sg) { if (sg.holder !== undefined && u >= sg.t0 && u <= sg.t1) holder = sg.holder; });

    // Indicateur tactique : ligne de passe en cours ou écran Pick & Roll.
    if (this.screenSpot && u >= this.screenSpot.t0 && u <= this.screenSpot.t1) {
      x.save();
      x.strokeStyle = 'rgba(255, 212, 59, 0.75)';
      x.lineWidth = Math.max(2, s * 0.32);
      var sx = P(this.screenSpot.x), sy = P(this.screenSpot.y);
      x.beginPath(); x.moveTo(sx, sy - 1.5 * s); x.lineTo(sx, sy + 1.5 * s); x.stroke();
      x.beginPath(); x.moveTo(sx - 0.8 * s, sy - 1.5 * s); x.lineTo(sx + 0.8 * s, sy - 1.5 * s); x.stroke();
      x.beginPath(); x.moveTo(sx - 0.8 * s, sy + 1.5 * s); x.lineTo(sx + 0.8 * s, sy + 1.5 * s); x.stroke();
      x.restore();
    }
    if (ball && ball.from && ball.to && (ball.seg.kind === 'pass' || ball.seg.kind === 'lob')) {
      x.save();
      x.setLineDash([s * 0.6, s * 0.5]);
      x.strokeStyle = ball.seg.kind === 'lob' ? 'rgba(255, 212, 59, 0.55)' : 'rgba(255, 255, 255, 0.38)';
      x.lineWidth = Math.max(1.2, s * 0.16);
      x.beginPath(); x.moveTo(P(ball.from.x), P(ball.from.y)); x.lineTo(P(ball.to.x), P(ball.to.y)); x.stroke();
      x.restore();
    }

    // Joueurs.
    var r = 2.35 * s;
    var onIds = m.on[0].concat(m.on[1]);
    Object.keys(this.pos).forEach(function (key) {
      var id = +key, p = self.pos[id], pl = g.players[id];
      if (!pl) return;
      var side = self.side(id), col = self.teamColor(side), offCourt = p.y > H + 1;
      if (offCourt && onIds.indexOf(id) < 0) return;
      var cx = P(p.x), cy = P(p.y);
      x.globalAlpha = 1;

      // Ombre portée au sol.
      x.fillStyle = 'rgba(0,0,0,0.32)';
      x.beginPath(); x.ellipse(cx + r * 0.12, cy + r * 0.38, r * 1.02, r * 0.58, 0, 0, Math.PI * 2); x.fill();

      // Anneau d'endurance discret autour du joueur.
      var stam = BM.clamp((m.stam[id] !== undefined ? m.stam[id] : 100) / 100, 0.08, 1);
      x.beginPath();
      x.arc(cx, cy, r + s * 0.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stam);
      x.strokeStyle = stam > 0.65 ? 'rgba(46,204,113,0.55)' : stam > 0.38 ? 'rgba(243,156,18,0.65)' : 'rgba(231,76,60,0.75)';
      x.lineWidth = Math.max(1.2, s * 0.22);
      x.stroke();

      // Porteur du ballon : anneau doré lumineux.
      if (id === holder) {
        x.strokeStyle = '#ffd43b'; x.lineWidth = Math.max(2, s * 0.38);
        x.beginPath(); x.arc(cx, cy, r + s * 0.72, 0, Math.PI * 2); x.stroke();
      }
      // Joueur en feu : halo orange pulsé.
      if (m.isHot(id)) {
        var pulse = 0.6 + 0.4 * Math.sin(now / 140);
        x.save(); x.shadowColor = '#ff6a00'; x.shadowBlur = s * 3.2 * pulse;
        x.fillStyle = 'rgba(255,106,0,' + (0.36 * pulse) + ')';
        x.beginPath(); x.arc(cx, cy, r + s * 1.25, 0, Math.PI * 2); x.fill(); x.restore();
      }
      // Mode carrière : ton joueur porte un anneau cyan et son nom en permanence.
      var mine = m.career && m.career.pid === id;
      if (mine) {
        x.strokeStyle = '#3bc9db'; x.lineWidth = Math.max(2, s * 0.45);
        x.beginPath(); x.arc(cx, cy, r + s * 1.15, 0, Math.PI * 2); x.stroke();
      }

      // Pastille maillot avec léger relief.
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      if (side === 0) { x.fillStyle = col; x.fill(); x.strokeStyle = '#ffffff'; }
      else { x.fillStyle = '#f8f9fa'; x.fill(); x.strokeStyle = col; }
      x.lineWidth = Math.max(1.5, s * 0.32); x.stroke();

      // Initiales + poste.
      x.fillStyle = side === 0 ? '#ffffff' : col;
      x.font = '800 ' + Math.round(2.05 * s) + 'px "Barlow Condensed", system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(pl.last.charAt(0) + pl.first.charAt(0), cx, cy + s * 0.08);

      // 1re option choisie par le coach : étoile dorée.
      if (m.firstOpt[side] === id) {
        x.font = '800 ' + Math.round(2.3 * s) + 'px system-ui, sans-serif';
        x.fillStyle = '#ffd43b'; x.textAlign = 'center';
        x.fillText('★', cx + r * 0.95, cy - r * 0.9);
      }
      // Étiquette nom sous/sur le porteur de balle ou le joueur incarné.
      if (id === holder || mine) {
        x.font = '700 ' + Math.round(1.95 * s) + 'px "Barlow Condensed", system-ui, sans-serif';
        x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,0.72)'; x.lineWidth = s * 0.45;
        x.strokeText(pl.last, cx, cy - r - s * 1.35);
        x.fillText(pl.last, cx, cy - r - s * 1.35);
      }
    });

    // Paniers (dessinés par-dessus les joueurs au sol mais sous le ballon en l'air).
    this.drawHoops(x, now);

    // Ballon (ombre au sol + élévation 3D + coutures).
    if (ball) {
      var br = 1.15 * s * (1 + ball.z / 15);
      x.fillStyle = 'rgba(0,0,0,' + BM.clamp(0.34 - ball.z * 0.012, 0.12, 0.34) + ')';
      x.beginPath(); x.ellipse(P(ball.x), P(ball.y), 0.85 * s, 0.48 * s, 0, 0, Math.PI * 2); x.fill();
      var bxPx = P(ball.x), byPx = P(ball.y) - ball.z * s * 0.56;
      var bg = x.createRadialGradient(bxPx - br * 0.3, byPx - br * 0.3, br * 0.1, bxPx, byPx, br);
      bg.addColorStop(0, '#ffb870'); bg.addColorStop(0.7, '#f76707'); bg.addColorStop(1, '#c94805');
      x.fillStyle = bg; x.beginPath(); x.arc(bxPx, byPx, br, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(50,15,0,0.75)'; x.lineWidth = Math.max(0.9, s * 0.1);
      x.beginPath(); x.moveTo(bxPx - br, byPx); x.lineTo(bxPx + br, byPx); x.stroke();
      x.beginPath(); x.arc(bxPx, byPx, br * 0.72, -0.9, 0.9); x.stroke();
    }

    // Effets visuels (swish, étincelles, banderoles de texte).
    this.fx = this.fx.filter(function (f) {
      var a = (now - f.born) / f.life;
      if (a >= 1) return false;
      if (f.kind === 'ring') {
        x.globalAlpha = 1 - a; x.strokeStyle = f.color; x.lineWidth = s * 0.55 * (1 - a) + 1;
        x.beginPath(); x.arc(P(f.x), P(f.y), (1 + a * 7.5) * s, 0, Math.PI * 2); x.stroke();
      } else if (f.kind === 'spark') {
        var t = (now - f.born) / 1000;
        x.globalAlpha = 1 - a; x.fillStyle = f.color;
        x.beginPath(); x.arc(P(f.x + f.vx * t), P(f.y + f.vy * t + 9 * t * t), s * 0.36 * (1 - a) + 0.5, 0, Math.PI * 2); x.fill();
      } else if (f.kind === 'text') {
        x.globalAlpha = a < 0.8 ? 1 : (1 - a) / 0.2;
        var pop = a < 0.15 ? 0.6 + a / 0.15 * 0.52 : 1.12 - Math.min(0.12, (a - 0.15));
        x.font = '800 ' + Math.round(3.3 * s * pop) + 'px "Barlow Condensed", system-ui, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = s * 0.65; x.strokeStyle = 'rgba(0,0,0,0.75)';
        var ty = P(f.y) - (4 + a * 5.2) * s, tx = BM.clamp(P(f.x), 8 * s, P(W) - 6 * s);
        x.strokeText(f.text, tx, ty); x.fillStyle = f.color; x.fillText(f.text, tx, ty);
      }
      x.globalAlpha = 1;
      return true;
    });
    x.restore();
  };

  BM.Court = Court;
})();
