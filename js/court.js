var BM = globalThis.BM = globalThis.BM || {};

// Vue 2D du match : terrain NBA (94 x 50 pieds), joueurs en pastilles, ballon animé.
// Chaque possession décrite par le moteur (match.play) est rejouée sous forme de chorégraphie.
(function () {
  var W = 94, H = 50, MARGIN = 2;
  var POS_ORDER = { MEN: 0, ARR: 1, AIL: 2, AF: 3, PIV: 4 };
  // Placements offensifs [profondeur depuis le panier, y] par poste, pour une attaque vers le panier de droite.
  var SPOTS = [[27, 25], [21, 9], [3, 3], [16, 37], [5, 31]];
  var ZONE = [[18, 17], [18, 33], [6, 8], [6, 42], [4, 25]];
  var BENCH = { x: 47, y: 53.5 };

  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function lerp(a, b, u) { return a + (b - a) * u; }

  function Court(canvas, match) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.m = match;
    this.pos = {};          // position courante de chaque joueur (pieds)
    this.tracks = {};       // images-clés de la possession en cours
    this.ballSegs = [];
    this.fx = [];           // effets : anneaux, particules, textes
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
    var par = this.canvas.parentNode, cs = getComputedStyle(par);
    var w = (par.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 360;
    var dpr = window.devicePixelRatio || 1;
    var ratio = (H + MARGIN * 2) / (W + MARGIN * 2);
    // En paysage, le terrain doit aussi tenir en hauteur (variable CSS --fit-h posée par la mise en page).
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
    return { x: bx + dir * depth, y: y };
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

  // ---------------------------------------------------------------- chorégraphie d'une possession
  Court.prototype.animate = function (play, ms) {
    if (!play) return;
    var self = this, m = this.m, q = play.q, o = play.o, d = 1 - o;
    var jit = function () { return (Math.random() - 0.5) * 3; };
    var tracks = {}, add = function (id, t, p) { (tracks[id] = tracks[id] || []).push({ t: t, x: p.x, y: p.y }); };
    var onIds = play.on[0].concat(play.on[1]);
    // Joueurs qui sortent : retour au banc.
    Object.keys(this.pos).forEach(function (id) {
      id = +id;
      if (onIds.indexOf(id) < 0) { add(id, 0, self.pos[id]); add(id, 0.4, BENCH); }
    });
    onIds.forEach(function (id) { add(id, 0, self.pos[id] || BENCH); });

    var offIds = this.sorted(play.on[o]), defIds = this.sorted(play.on[d]);
    var bx = this.basketX(o, q), dirIn = bx > W / 2 ? 1 : -1;
    var rim = { x: bx, y: 25 };
    var setup = {};
    offIds.forEach(function (id, i) {
      var s = SPOTS[i] || SPOTS[0], depth = s[0] + jit(), y = s[1] + jit();
      if (play.fast) { depth = 8 + i * 5; y = 12 + i * 6; }
      setup[id] = self.at(o, q, depth, y);
    });
    var defSpot = function (oid, i, k) {
      if (m.tac[d].defense === 'zone' && !play.fast) { var z = ZONE[i] || ZONE[0]; return self.at(o, q, z[0], z[1]); }
      var op = setup[oid] || rim;
      return { x: lerp(op.x, rim.x, k), y: lerp(op.y, rim.y, k) };
    };
    var tSet = play.fast ? 0.25 : 0.35;
    offIds.forEach(function (id) { add(id, tSet, setup[id]); });
    defIds.forEach(function (id, i) { add(id, tSet + 0.03, defSpot(offIds[i], i, play.fast ? 0.15 : 0.28)); });

    // Ballon : porteur, passes, tir.
    var segs = [], holder = play.handler || offIds[0];
    var hold = function (pid, t0, t1) { segs.push({ t0: t0, t1: t1, holder: pid }); };
    var fly = function (t0, t1, from, to, peak, kind) { segs.push({ t0: t0, t1: t1, from: from, to: to, peak: peak, kind: kind }); };
    var fx = [];

    if (play.kind === 'shot') {
      var sh = play.shooter, type = play.type;
      var shotSpot;
      if (type === 'rim') shotSpot = this.at(o, q, 2.5 + Math.random() * 2, 25 + jit());
      else if (type === 'mid') shotSpot = this.at(o, q, 13 + Math.random() * 3, 25 + jit() * 3);
      else {
        var sp = setup[sh] || this.at(o, q, 24, 25), depth = Math.abs(sp.x - bx);
        var dist = Math.sqrt(depth * depth + (sp.y - 25) * (sp.y - 25));
        shotSpot = dist >= 23.9 ? sp : this.at(o, q, 25, sp.y < 25 ? 12 : 38);
      }
      var passer = play.passer && play.passer !== sh ? play.passer : null;
      var tPass1 = 0.45, tPass2 = 0.55, tShot = 0.62, tRim = 0.8;
      hold(holder, 0, tPass1);
      var chain = [holder];
      if (passer && passer !== holder) chain.push(passer);
      if (chain[chain.length - 1] !== sh) chain.push(sh);
      var tp = tPass1;
      for (var c = 1; c < chain.length; c++) {
        var t1 = Math.min(tShot - 0.04, tp + 0.07);
        fly(tp, t1, { holder: chain[c - 1] }, { holder: chain[c] }, 2, 'pass');
        var nextT = c === chain.length - 1 ? tShot : Math.min(tShot - 0.05, t1 + 0.04);
        hold(chain[c], t1, nextT);
        tp = nextT;
      }
      if (chain.length === 1) hold(sh, tPass1, tShot);
      add(sh, tPass2 + 0.02, shotSpot);
      add(sh, tShot, shotSpot);
      // Le défenseur direct monte sur le tireur.
      var di = offIds.indexOf(sh), dfId = defIds[Math.max(0, Math.min(di, defIds.length - 1))];
      if (dfId) add(dfId, tShot, { x: lerp(shotSpot.x, rim.x, 0.12), y: shotSpot.y + 1.5 });
      if (play.blocker) {
        add(play.blocker, tShot, { x: lerp(shotSpot.x, rim.x, 0.15), y: shotSpot.y - 1 });
        fly(tShot, tShot + 0.06, { holder: sh }, { x: shotSpot.x - dirIn * 4, y: shotSpot.y + jit() * 2 }, 3, 'block');
        fx.push({ t: tShot + 0.04, kind: 'text', text: 'CONTRE !', at: shotSpot, color: this.teamColor(d) });
        tRim = tShot + 0.06;
      } else {
        fly(tShot, tRim, { holder: sh }, rim, type === 'three' ? 14 : type === 'mid' ? 10 : 5, play.made ? 'make' : 'miss');
        if (play.made) {
          var pts = type === 'three' ? 3 : 2;
          fx.push({ t: tRim, kind: 'swish', at: rim, color: this.teamColor(o), big: type === 'three' || play.dunk });
          fx.push({ t: tRim, kind: 'text', text: (play.dunk ? 'DUNK ! ' : '') + '+' + pts, at: rim, color: this.teamColor(o) });
          if (play.dunk) fx.push({ t: tRim, kind: 'shake' });
        }
      }
      if (play.fouled) fx.push({ t: tShot, kind: 'text', text: 'FAUTE', at: shotSpot, color: '#ffd43b' });
      if (play.made && !play.ft) {
        // Repli : l'attaque redescend, la défense récupère le ballon sous le panier.
        segs.push({ t0: tRim, t1: 1, from: rim, to: { x: rim.x - dirIn * 1.5, y: 25 }, peak: 0, kind: 'drop' });
      }
      if (play.reb) {
        var rb = play.reb.id, rspot = { x: rim.x - dirIn * (4 + Math.random() * 4), y: 25 + jit() * 3 };
        add(rb, tRim + 0.04, rspot);
        fly(tRim, tRim + 0.1, rim, { holder: rb }, 3, 'reb');
        hold(rb, tRim + 0.1, 1);
        if (!play.reb.off) {
          // Relance : la défense remonte le terrain.
          var other = this.basketX(d, q), dirOut = other > W / 2 ? 1 : -1;
          add(rb, 1, { x: rspot.x + dirOut * 8, y: rspot.y });
        }
      }
      if (play.ft) fx.push({ t: 0.95, kind: 'text', text: 'LF ' + play.ft.made + '/' + play.ft.n, at: this.at(o, q, 15, 25), color: '#fff' });
    } else if (play.kind === 'tov') {
      hold(holder, 0, 0.5);
      if (play.stealer) {
        add(play.stealer, 0.5, this.pos[holder] ? setup[holder] : rim);
        fly(0.5, 0.56, { holder: holder }, { holder: play.stealer }, 1, 'steal');
        hold(play.stealer, 0.56, 1);
        var gx = this.basketX(d, q), dOut = gx > W / 2 ? 1 : -1;
        add(play.stealer, 1, { x: (setup[holder] || rim).x + dOut * 22, y: 25 + jit() * 4 });
        fx.push({ t: 0.52, kind: 'text', text: 'INTERCEPTION', at: setup[holder] || rim, color: this.teamColor(d) });
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

    // Petits déplacements pendant la phase de jeu placé.
    offIds.forEach(function (id) {
      if (id === play.shooter || (play.reb && play.reb.id === id)) return;
      var s = setup[id];
      add(id, 0.6, { x: s.x + jit(), y: s.y + jit() });
      add(id, 1, { x: s.x + jit(), y: s.y + jit() });
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
      var bounce = Math.abs(Math.sin(u * this.T / 90)) * 0.9; // dribble
      return { x: p.x, y: p.y, z: bounce };
    }
    var k = BM.clamp((u - seg.t0) / Math.max(0.0001, seg.t1 - seg.t0), 0, 1);
    var a = this.resolve(seg.from, seg.t0), b = this.resolve(seg.to, seg.t1);
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: Math.sin(Math.PI * k) * seg.peak };
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
    if (f.kind === 'swish') {
      this.fx.push({ kind: 'ring', x: f.at.x, y: f.at.y, color: f.color, born: now, life: 650 });
      var n = f.big ? 26 : 12;
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * (f.big ? 16 : 8);
        this.fx.push({ kind: 'spark', x: f.at.x, y: f.at.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color: i % 3 ? f.color : '#ffd43b', born: now, life: 700 });
      }
      if (BM.Juice) BM.Juice.sound(f.big ? 'cheer' : 'swish');
      return;
    }
    if (f.kind === 'text') {
      this.fx.push({ kind: 'text', x: f.at.x, y: f.at.y, text: f.text, color: f.color, born: now, life: 1000 });
      if (BM.Juice && /FAUTE/.test(f.text)) BM.Juice.sound('whistle');
    }
  };

  Court.prototype.px = function (v) { return (v + MARGIN) * this.scale; };

  Court.prototype.drawCourt = function () {
    if (this.courtCache) return this.courtCache;
    var c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    var x = c.getContext('2d'), s = this.scale, P = this.px.bind(this);
    // Parquet.
    var grd = x.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0, '#d9a066'); grd.addColorStop(1, '#b97a44');
    x.fillStyle = '#20150d'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = grd; x.fillRect(P(0), P(0), W * s, H * s);
    x.globalAlpha = 0.08; x.strokeStyle = '#3b2412'; x.lineWidth = Math.max(1, s * 0.08);
    for (var yy = 0; yy <= H; yy += 1.6) { x.beginPath(); x.moveTo(P(0), P(yy)); x.lineTo(P(W), P(yy)); x.stroke(); }
    x.globalAlpha = 1;
    // Raquettes aux couleurs des équipes (côté défendu en 1re mi-temps).
    var home = this.m.side[0].color, away = this.m.side[1].color;
    x.globalAlpha = 0.55;
    x.fillStyle = away; x.fillRect(P(W - 19), P(17), 19 * s, 16 * s);
    x.fillStyle = home; x.fillRect(P(0), P(17), 19 * s, 16 * s);
    x.globalAlpha = 0.25;
    x.beginPath(); x.arc(P(W / 2), P(25), 6 * s, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = Math.max(1.2, s * 0.17);
    x.strokeRect(P(0), P(0), W * s, H * s);
    x.beginPath(); x.moveTo(P(W / 2), P(0)); x.lineTo(P(W / 2), P(H)); x.stroke();
    x.beginPath(); x.arc(P(W / 2), P(25), 6 * s, 0, Math.PI * 2); x.stroke();
    var self = this;
    [5.25, W - 5.25].forEach(function (bx) {
      var dir = bx < W / 2 ? 1 : -1, base = bx < W / 2 ? 0 : W;
      x.strokeRect(P(Math.min(base, base + dir * 19)), P(17), 19 * s, 16 * s);
      x.beginPath(); x.arc(P(base + dir * 19), P(25), 6 * s, -Math.PI / 2, Math.PI / 2, dir < 0); x.stroke();
      // Ligne à 3 points : corners à 22 pieds, arc de 23,75 pieds.
      var ang = Math.asin(22 / 23.75), cx = bx + dir * 23.75 * Math.cos(ang);
      x.beginPath(); x.moveTo(P(base), P(3)); x.lineTo(P(cx), P(3)); x.stroke();
      x.beginPath(); x.moveTo(P(base), P(47)); x.lineTo(P(cx), P(47)); x.stroke();
      x.beginPath();
      if (dir > 0) x.arc(P(bx), P(25), 23.75 * s, -ang, ang, false);
      else x.arc(P(bx), P(25), 23.75 * s, Math.PI - ang, Math.PI + ang, false);
      x.stroke();
      x.beginPath(); x.arc(P(bx), P(25), 4 * s, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5); x.stroke();
      // Planche et cercle.
      x.lineWidth = Math.max(2, s * 0.35); x.strokeStyle = '#fff';
      x.beginPath(); x.moveTo(P(base + dir * 4), P(22)); x.lineTo(P(base + dir * 4), P(28)); x.stroke();
      x.lineWidth = Math.max(1.5, s * 0.22); x.strokeStyle = '#ff6b1a';
      x.beginPath(); x.arc(P(bx), P(25), 0.9 * s, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = Math.max(1.2, s * 0.17);
    });
    // Logo central : initiales du club à domicile.
    x.font = '800 ' + Math.round(3.2 * s) + 'px "Barlow Condensed", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillText(self.m.side[0].short, P(W / 2), P(25));
    this.courtCache = c;
    return c;
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

    // Joueurs.
    var r = 2.3 * s;
    var onIds = m.on[0].concat(m.on[1]);
    Object.keys(this.pos).forEach(function (key) {
      var id = +key, p = self.pos[id], pl = g.players[id];
      if (!pl) return;
      var side = self.side(id), col = self.teamColor(side), offCourt = p.y > H + 1;
      if (offCourt && onIds.indexOf(id) < 0) return;
      x.globalAlpha = 1;
      // Ombre.
      x.fillStyle = 'rgba(0,0,0,0.28)';
      x.beginPath(); x.ellipse(P(p.x) + r * 0.15, P(p.y) + r * 0.35, r, r * 0.6, 0, 0, Math.PI * 2); x.fill();
      if (id === holder) {
        x.strokeStyle = '#ffd43b'; x.lineWidth = Math.max(2, s * 0.35);
        x.beginPath(); x.arc(P(p.x), P(p.y), r + s * 0.6, 0, Math.PI * 2); x.stroke();
      }
      // Joueur en feu : halo orange pulsé.
      if (m.isHot(id)) {
        var pulse = 0.6 + 0.4 * Math.sin(now / 140);
        x.save(); x.shadowColor = '#ff6a00'; x.shadowBlur = s * 3 * pulse;
        x.fillStyle = 'rgba(255,106,0,' + (0.35 * pulse) + ')';
        x.beginPath(); x.arc(P(p.x), P(p.y), r + s * 1.2, 0, Math.PI * 2); x.fill(); x.restore();
      }
      // Mode carrière : ton joueur porte un anneau cyan et son nom en permanence.
      var mine = m.career && m.career.pid === id;
      if (mine) {
        x.strokeStyle = '#3bc9db'; x.lineWidth = Math.max(2, s * 0.45);
        x.beginPath(); x.arc(P(p.x), P(p.y), r + s * 1.1, 0, Math.PI * 2); x.stroke();
      }
      x.beginPath(); x.arc(P(p.x), P(p.y), r, 0, Math.PI * 2);
      if (side === 0) { x.fillStyle = col; x.fill(); x.strokeStyle = '#fff'; }
      else { x.fillStyle = '#fff'; x.fill(); x.strokeStyle = col; }
      x.lineWidth = Math.max(1.5, s * 0.3); x.stroke();
      x.fillStyle = side === 0 ? '#fff' : col;
      x.font = '800 ' + Math.round(2.1 * s) + 'px "Barlow Condensed", system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(pl.last.charAt(0) + pl.first.charAt(0), P(p.x), P(p.y) + s * 0.1);
      // 1re option choisie par le coach : étoile dorée.
      if (m.firstOpt[side] === id) {
        x.font = '800 ' + Math.round(2.4 * s) + 'px system-ui, sans-serif';
        x.fillStyle = '#ffd43b'; x.textAlign = 'center';
        x.fillText('★', P(p.x) + r, P(p.y) - r);
      }
      if (id === holder || mine) {
        x.font = '700 ' + Math.round(1.9 * s) + 'px system-ui, sans-serif';
        x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = s * 0.4;
        x.strokeText(pl.last, P(p.x), P(p.y) - r - s * 1.3); x.fillText(pl.last, P(p.x), P(p.y) - r - s * 1.3);
      }
    });

    // Ballon (ombre au sol + hauteur).
    if (ball) {
      var br = 1.1 * s * (1 + ball.z / 14);
      x.fillStyle = 'rgba(0,0,0,0.3)';
      x.beginPath(); x.ellipse(P(ball.x), P(ball.y), 0.8 * s, 0.45 * s, 0, 0, Math.PI * 2); x.fill();
      var by = P(ball.y) - ball.z * s * 0.55;
      var bg = x.createRadialGradient(P(ball.x) - br * 0.3, by - br * 0.3, br * 0.1, P(ball.x), by, br);
      bg.addColorStop(0, '#ffb066'); bg.addColorStop(1, '#e8590c');
      x.fillStyle = bg; x.beginPath(); x.arc(P(ball.x), by, br, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(60,20,0,0.7)'; x.lineWidth = Math.max(1, s * 0.1);
      x.beginPath(); x.moveTo(P(ball.x) - br, by); x.lineTo(P(ball.x) + br, by); x.stroke();
    }

    // Effets.
    this.fx = this.fx.filter(function (f) {
      var a = (now - f.born) / f.life;
      if (a >= 1) return false;
      if (f.kind === 'ring') {
        x.globalAlpha = 1 - a; x.strokeStyle = f.color; x.lineWidth = s * 0.5 * (1 - a) + 1;
        x.beginPath(); x.arc(P(f.x), P(f.y), (1 + a * 7) * s, 0, Math.PI * 2); x.stroke();
      } else if (f.kind === 'spark') {
        var t = (now - f.born) / 1000;
        x.globalAlpha = 1 - a; x.fillStyle = f.color;
        x.beginPath(); x.arc(P(f.x + f.vx * t), P(f.y + f.vy * t + 9 * t * t), s * 0.35 * (1 - a) + 0.5, 0, Math.PI * 2); x.fill();
      } else if (f.kind === 'text') {
        x.globalAlpha = a < 0.8 ? 1 : (1 - a) / 0.2;
        var pop = a < 0.15 ? 0.6 + a / 0.15 * 0.5 : 1.1 - Math.min(0.1, (a - 0.15));
        x.font = '800 ' + Math.round(3.2 * s * pop) + 'px "Barlow Condensed", system-ui, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = s * 0.6; x.strokeStyle = 'rgba(0,0,0,0.65)';
        var ty = P(f.y) - (4 + a * 5) * s, tx = BM.clamp(P(f.x), 8 * s, P(W) - 6 * s);
        x.strokeText(f.text, tx, ty); x.fillStyle = f.color; x.fillText(f.text, tx, ty);
      }
      x.globalAlpha = 1;
      return true;
    });
    x.restore();
  };

  BM.Court = Court;
})();
