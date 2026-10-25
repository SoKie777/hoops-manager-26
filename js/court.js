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
    // Le moteur donne { depth, y } (profondeur depuis le panier) ; anciens formats : { x, y } en demi-terrain.
    var depth = spot.depth !== undefined ? Math.max(1.5, spot.depth) : Math.max(1.5, (W - 5.25) - spot.x);
    if (!isFinite(depth) || !isFinite(spot.y)) return null;
    var right = (side === 0) === (q <= 2);
    var y = right ? spot.y : H - spot.y;
    return this.at(side, q, depth, y);
  };

  // Placements offensifs [profondeur depuis le panier, y] par système, du meneur au pivot.
  var SETS = {
    pnr: [[27, 25], [22, 7], [4.5, 3.4], [18, 41], [9, 31]],
    motion: [[27, 25], [22, 6], [22, 44], [5, 3.4], [5, 46.6]],
    run: [[27, 25], [22, 6], [22, 44], [5, 3.4], [5, 46.6]],
    iso: [[26, 25], [5, 3.4], [22, 6], [5, 46.6], [22, 44]],
    post: [[25, 21], [21, 6], [5, 46.6], [17, 41], [7, 31.5]],
    princeton: [[24, 13], [24, 37], [5, 3.4], [17, 25], [16, 33]]
  };
  var PHASE = { up: 'Remontée de balle', set: 'Mise en place', act: 'Action', shot: 'Tir', reb: 'Rebond', fast: 'Contre-attaque', back: 'Repli' };

  // ---------------------------------------------------------------- chorégraphie d'une possession
  // Phases : remontée (le porteur traverse la médiane, la défense se replie), mise en place du système,
  // circulation, action (écran, poste bas, isolation, coupe), aides défensives, tir, rebond, relance.
  Court.prototype.animate = function (play, ms, skip) {
    if (!play) return;
    var self = this, m = this.m, q = play.q, o = play.o, d = 1 - o;
    var jit = function (a) { return (Math.random() - 0.5) * 2 * (a === undefined ? 1.2 : a); };
    var tracks = {}, add = function (id, t, p) { if (id && p && isFinite(p.x) && isFinite(p.y)) (tracks[id] = tracks[id] || []).push({ t: BM.clamp(t, 0, 1), x: p.x, y: p.y }); };
    var A = function (depth, y) { return self.at(o, q, depth, y); };       // demi-terrain offensif
    var B = function (depth, y) { return self.at(d, q, depth, y); };       // demi-terrain défensif (panier de l'attaque)
    var onIds = play.on[0].concat(play.on[1]);
    Object.keys(this.pos).forEach(function (id) {
      id = +id;
      if (onIds.indexOf(id) < 0) { add(id, 0, self.pos[id]); add(id, 0.3, BENCH); }
    });
    onIds.forEach(function (id) { add(id, 0, self.pos[id] || BENCH); });

    var offIds = this.sorted(play.on[o]), defIds = this.sorted(play.on[d]);
    var bx = this.basketX(o, q), dirIn = bx > W / 2 ? 1 : -1, rim = { x: bx, y: 25 };
    var sys = play.system || 'pnr', sch = play.scheme || 'drop';
    var zone = sch === 'zone', press = sch === 'press';
    var half = !play.fast && !play.putback;
    var holder = play.handler || offIds[0];
    var shooter = play.shooter || null;

    // Calendrier de la possession (fraction de la durée affichée).
    var tCross = 0.13, tSet = 0.27, tAct = 0.43, tShot = 0.64, tRim = 0.8;
    if (play.fast) { tCross = 0.1; tSet = 0.2; tAct = 0.26; tShot = 0.42; tRim = 0.56; }
    if (play.putback) { tCross = 0; tSet = 0; tAct = 0.06; tShot = 0.2; tRim = 0.36; }
    if (play.hack) { tAct = 0.3; }
    this.phases = play.fast ? [[0, PHASE.fast], [tShot, PHASE.shot], [tRim, PHASE.reb]]
      : play.putback ? [[0, PHASE.reb]]
      : [[0, PHASE.up], [tCross + 0.04, PHASE.set], [tAct - 0.04, actionLabel(play)], [tShot, PHASE.shot], [tRim, PHASE.reb]];

    // 1. Placements du système.
    var base = SETS[sys] || SETS.pnr, setup = {};
    offIds.forEach(function (id, i) {
      var s = base[i] || base[0];
      var p = A(s[0] + jit(0.8), s[1] + jit(0.8));
      if (sys === 'iso' && shooter && id === shooter && i !== 0) p = A(23, 9 + jit());
      setup[id] = p;
    });
    if (sys === 'iso' && shooter && shooter !== offIds[0]) { var tmp = setup[offIds[0]]; setup[offIds[0]] = A(22, 44); setup[shooter] = tmp; }

    // 2. Remontée de balle : le porteur part de son camp, franchit la médiane, entre dans le système.
    if (half) {
      var hStart = this.pos[holder] || B(14, 25);
      if (Math.abs(hStart.x - bx) < W / 2 - 4) hStart = B(16, 25 + jit(6)); // il repart de son camp
      add(holder, 0.02, hStart);
      add(holder, tCross, { x: W / 2 - dirIn * 1.5, y: BM.clamp(hStart.y + (setup[holder].y - hStart.y) * 0.5, 6, 44) });
      add(holder, tSet, setup[holder]);
      offIds.forEach(function (id, i) {
        if (id === holder) return;
        var s = setup[id], stag = 0.03 * i;
        add(id, tCross + stag, { x: lerp(self.pos[id] ? self.pos[id].x : W / 2, s.x, 0.55), y: lerp(self.pos[id] ? self.pos[id].y : 25, s.y, 0.7) });
        add(id, tSet + stag * 0.5, s);
      });
    } else if (play.fast) {
      // Contre-attaque : tout le monde sprinte, couloirs remplis.
      offIds.forEach(function (id, i) {
        var lane = [25, 6, 44, 14, 36][i] || 25;
        add(id, tSet, A(id === holder ? 14 : 9 + i * 2, lane + jit()));
      });
    } else {
      offIds.forEach(function (id) { add(id, 0.04, self.pos[id] || setup[id]); });
    }

    // 3. Défense : homme à homme (chacun entre son joueur et le panier, aides côté faible) ou zone 2-3.
    var ballAt = setup[holder] || rim;
    var guard = {};
    defIds.forEach(function (id, i) { guard[id] = offIds[Math.min(i, offIds.length - 1)]; });
    var defSpot = function (did, i, ball, ballHolder, tight) {
      if (zone) {
        var z = ZONE[i] || ZONE[0], shift = (ball.y - 25) * 0.3, up = i < 2 && Math.abs(ball.y - (i === 0 ? 17 : 33)) < 12 ? -2.5 : 0;
        return A(z[0] - up, BM.clamp(z[1] + shift, 3, 47));
      }
      var man = guard[did], mp = tracksAt(man) || setup[man] || rim;
      if (man === ballHolder) return { x: lerp(mp.x, rim.x, tight ? 0.08 : 0.13), y: lerp(mp.y, rim.y, 0.1) };
      var far = Math.abs(mp.y - ball.y) > 15;
      var k = far ? 0.45 : 0.25;
      return { x: lerp(mp.x, rim.x, k), y: lerp(mp.y, far ? (mp.y + ball.y) / 2 : rim.y, far ? 0.35 : 0.15) };
    };
    var tracksAt = function (id) { var tr = tracks[id]; return tr && tr.length ? tr[tr.length - 1] : null; };
    var defendAll = function (t, ball, ballHolder, tight, except) {
      defIds.forEach(function (did, i) { if (!except || except.indexOf(did) < 0) add(did, t, defSpot(did, i, ball, ballHolder, tight)); });
    };
    if (half) {
      // Repli défensif pendant la remontée (ou pressing tout-terrain).
      defIds.forEach(function (did, i) {
        var start = self.pos[did] || B(20, 25);
        if (press) {
          var man = guard[did], mp = self.pos[man] || B(18, 25);
          add(did, tCross * 0.6, { x: lerp(mp.x, rim.x, 0.08), y: mp.y });
          if (man === holder || i === 1) add(did, tCross, { x: (tracksAt(holder) || mp).x + dirIn * 1.2, y: (tracksAt(holder) || mp).y + (i === 1 ? 2.2 : -1.2) });
        } else {
          add(did, tCross * 0.8, { x: lerp(start.x, rim.x, 0.7), y: lerp(start.y, 25, 0.4) });
        }
      });
      defendAll(tSet + 0.02, ballAt, holder, false);
    } else if (play.fast) {
      defIds.forEach(function (did, i) { add(did, tSet + 0.04, A(4 + i * 3.2, 25 + (i - 2) * 4)); });
    } else {
      defendAll(0.05, rim, null, true);
    }

    // 4. Circulation du ballon puis action du système.
    var segs = [], fx = [];
    var hold = function (pid, t0, t1) { if (t1 > t0) segs.push({ t0: t0, t1: t1, holder: pid }); };
    var fly = function (t0, t1, from, to, peak, kind) { segs.push({ t0: t0, t1: t1, from: from, to: to, peak: peak, kind: kind }); };
    this.screenSpot = null;
    this.zoneOn = zone && !play.fast ? { side: o, q: q, t0: tSet, shift: 0 } : null;

    var others = offIds.filter(function (id) { return id !== holder && id !== shooter && id !== play.screener; });
    var swings = !half ? [] : sys === 'motion' ? others.slice(0, 2) : sys === 'princeton' ? offIds.filter(function (id, i) { return i === 3 && id !== holder; }) : sys === 'post' && play.action === 'post' ? [] : others.slice(0, sys === 'pnr' ? 0 : 1);
    var chain = [holder].concat(swings);
    if (play.passer && chain.indexOf(play.passer) < 0 && play.passer !== shooter) chain.push(play.passer);
    var actT = tAct;

    if (half && play.kind !== 'none') {
      if (sys === 'pnr' && play.screener && play.screener !== holder) {
        var hs = setup[holder], side = hs.y > 25 ? -1 : 1;
        var scr = { x: hs.x + dirIn * 2.2, y: hs.y + side * 2.6 };
        add(play.screener, tAct - 0.07, scr); add(play.screener, tAct + 0.03, scr);
        add(play.screener, tAct + 0.16, A(4.5, 25 - side * 3));
        add(holder, tAct + 0.08, { x: scr.x + dirIn * 4, y: scr.y + side * 4 });
        this.screenSpot = { x: scr.x, y: scr.y, t0: tAct - 0.07, t1: tAct + 0.05 };
        var hd = defIds[offIds.indexOf(holder)], sd = defIds[offIds.indexOf(play.screener)];
        if (sch === 'blitz' && hd && sd) {
          add(sd, tAct + 0.02, { x: scr.x + dirIn * 2.5, y: scr.y + side * 2 });
          fx.push({ t: tAct + 0.02, kind: 'tag', text: 'PRISE À DEUX', at: scr, color: this.teamColor(d) });
        } else if (sch === 'switch' && hd && sd) {
          var g2 = guard[hd]; guard[hd] = guard[sd]; guard[sd] = g2;
          fx.push({ t: tAct + 0.03, kind: 'tag', text: 'CHANGE', at: scr, color: this.teamColor(d) });
        } else if (sd && !zone) {
          add(sd, tAct + 0.04, A(9, 25));
        }
        defendAll(tAct + 0.1, { x: scr.x + dirIn * 4, y: scr.y }, holder, true, sch === 'blitz' ? [sd] : null);
      } else if (play.action === 'post' || sys === 'post') {
        var poster = shooter && offIds.indexOf(shooter) >= 3 ? shooter : offIds[4] || offIds[offIds.length - 1];
        var block = A(7, setup[poster] && setup[poster].y < 25 ? 18 : 32);
        add(poster, tAct - 0.05, block);
        if (chain.indexOf(poster) < 0 && poster !== shooter) chain.push(poster);
        var pd = defIds[offIds.indexOf(poster)];
        if (pd && !zone) add(pd, tAct, { x: lerp(block.x, rim.x, 0.25), y: block.y });
        defendAll(tAct + 0.08, block, poster, true, pd ? [pd] : null);
        fx.push({ t: tAct, kind: 'tag', text: 'POSTE BAS', at: block, color: this.teamColor(o) });
      } else if (sys === 'iso') {
        var star = shooter || holder, sp0 = setup[star];
        add(star, tAct + 0.08, { x: lerp(sp0.x, rim.x, 0.45), y: lerp(sp0.y, 25, 0.4) });
        defendAll(tAct + 0.1, { x: lerp(sp0.x, rim.x, 0.45), y: sp0.y }, star, true);
        fx.push({ t: tAct, kind: 'tag', text: 'ISOLATION', at: sp0, color: this.teamColor(o) });
      } else if (sys === 'princeton' && shooter && shooter !== holder) {
        var w = setup[shooter];
        add(shooter, tAct, { x: w.x + dirIn * 2.5, y: w.y });
        add(shooter, tAct + 0.12, A(3.5, 25 + (w.y < 25 ? -2.5 : 2.5)));
        fx.push({ t: tAct + 0.04, kind: 'tag', text: 'COUPE ARRIÈRE', at: w, color: this.teamColor(o) });
        defendAll(tAct + 0.12, A(5, 25), shooter, false);
      } else {
        defendAll(tAct + 0.08, setup[chain[chain.length - 1]] || ballAt, chain[chain.length - 1], false);
      }
    }

    // 5. Dénouement : tir, perte de balle ou faute.
    if (play.kind === 'shot' && shooter) {
      var type = play.type, shotSpot = this.spotToCourt(o, q, play.spot);
      if (!shotSpot) shotSpot = type === 'rim' ? A(2.5 + Math.random() * 2, 25 + jit()) : type === 'mid' ? A(13 + Math.random() * 3, 25 + jit(4)) : (setup[shooter] || A(24, 12));
      if (play.heave) shotSpot = { x: W / 2 - dirIn * 2, y: 25 + jit(6) };
      if (chain[chain.length - 1] !== shooter) chain.push(shooter);
      // Passes successives, la dernière arrive juste avant le tir.
      var tFirst = half ? tSet + 0.02 : play.fast ? 0.12 : 0.04, tLast = tShot - 0.05;
      var n = chain.length - 1, step = n > 0 ? (tLast - tFirst) / n : 0, tp = tFirst;
      hold(chain[0], 0, n ? tFirst : tShot);
      for (var c = 1; c <= n; c++) {
        var lob = play.alleyOop && c === n, t1 = Math.min(tLast, tp + (lob ? 0.08 : 0.05));
        fly(tp, t1, { holder: chain[c - 1] }, { holder: chain[c] }, lob ? 9 : 2.2, lob ? 'lob' : 'pass');
        var nt = c === n ? tShot : Math.min(tLast, tFirst + step * c + 0.01);
        hold(chain[c], t1, nt);
        if (c < n && !play.fast) defendAll(t1 + 0.02, setup[chain[c]] || ballAt, chain[c], false);
        tp = nt;
      }
      add(shooter, tShot - 0.06, shotSpot); add(shooter, tShot, shotSpot);
      // Le défenseur direct revient contester ; un défenseur côté faible aide si le tir est près du cercle.
      var di = defIds[offIds.indexOf(shooter)] || defIds[0];
      if (zone) { var near = defIds.slice().sort(function (a, b) { var pa = tracksAt(a) || rim, pb = tracksAt(b) || rim; return Math.hypot(pa.x - shotSpot.x, pa.y - shotSpot.y) - Math.hypot(pb.x - shotSpot.x, pb.y - shotSpot.y); }); di = near[0]; }
      add(di, tShot, { x: lerp(shotSpot.x, rim.x, 0.14), y: shotSpot.y + (shotSpot.y < 25 ? 1.3 : -1.3) });
      if (type === 'rim' && !play.fast) {
        var helper = defIds.filter(function (x) { return x !== di; }).sort(function (a, b) { return Math.abs((tracksAt(a) || rim).y - 25) - Math.abs((tracksAt(b) || rim).y - 25); })[0];
        if (helper) add(helper, tShot - 0.02, { x: lerp(rim.x, shotSpot.x, 0.5), y: lerp(25, shotSpot.y, 0.4) + jit(0.6) });
      }
      if (play.blocker) {
        add(play.blocker, tShot, { x: lerp(shotSpot.x, rim.x, 0.15), y: shotSpot.y - 1 });
        fly(tShot, tShot + 0.06, { holder: shooter }, { x: shotSpot.x - dirIn * 4, y: shotSpot.y + jit(2) }, 3, 'block');
        fx.push({ t: tShot + 0.04, kind: 'text', text: 'CONTRE', at: shotSpot, color: this.teamColor(d), sound: 'block' });
        tRim = tShot + 0.06;
      } else {
        fly(tShot, tRim, { holder: shooter }, rim, type === 'three' ? 14.5 : type === 'mid' ? 10 : 5.5, play.made ? 'make' : 'miss');
        if (play.made) {
          var pts = type === 'three' ? 3 : 2;
          var label = play.alleyOop ? 'ALLEY-OOP +' + pts : play.dunk ? 'DUNK +' + pts : play.move === 'stepback' ? 'STEP-BACK +' + pts : '+' + pts;
          fx.push({ t: tRim, kind: 'swish', at: rim, color: this.teamColor(o), big: type === 'three' || play.dunk, sound: play.dunk ? 'dunk' : type === 'three' ? 'three' : 'swish', basketRight: bx > W / 2 });
          fx.push({ t: tRim, kind: 'text', text: label, at: rim, color: this.teamColor(o) });
          if (play.dunk) fx.push({ t: tRim, kind: 'shake' });
        } else {
          fx.push({ t: tRim, kind: 'miss', at: rim, basketRight: bx > W / 2 });
        }
      }
      if (play.fouled) fx.push({ t: tShot, kind: 'text', text: play.made ? 'AND-ONE' : 'FAUTE', at: shotSpot, color: '#f2c94c' });

      // Rebond : les défenseurs ferment l'accès (box-out), les intérieurs offensifs vont au rebond.
      var tBox = Math.min(tShot + 0.06, tRim - 0.02);
      defIds.forEach(function (did) {
        if (did === play.blocker) return;
        var man = guard[did], mp = tracksAt(man) || rim;
        add(did, tBox, { x: lerp(mp.x, rim.x, 0.55), y: lerp(mp.y, 25, 0.45) });
      });
      offIds.forEach(function (id, i) {
        if (id === shooter) return;
        if (i >= 3) add(id, tBox, A(6 + jit(), 25 + (i === 3 ? -6 : 6)));
        else if (!play.made) add(id, tBox + 0.04, A(26, 25 + (i - 1) * 10));
      });
      if (play.made && !play.ft) {
        // Panier : remise en jeu derrière la ligne de fond, l'attaque se replie.
        var inb = defIds[4] || defIds[defIds.length - 1], ibSpot = { x: bx + dirIn * 1.2, y: 25 + jit(4) };
        segs.push({ t0: tRim, t1: tRim + 0.08, from: rim, to: { x: rim.x, y: 25 }, peak: 0, kind: 'drop' });
        add(inb, tRim + 0.08, { x: rim.x, y: 25 }); add(inb, 0.94, ibSpot);
        hold(inb, tRim + 0.08, 1);
        this.phases.push([tRim + 0.06, PHASE.back]);
        offIds.forEach(function (id, i) { add(id, 1, { x: lerp((tracksAt(id) || rim).x, W / 2, 0.45), y: (tracksAt(id) || rim).y }); });
        defIds.forEach(function (did, i) { if (did !== inb) add(did, 1, { x: lerp((tracksAt(did) || rim).x, W / 2, 0.25), y: (tracksAt(did) || rim).y }); });
      }
      if (play.reb) {
        var rb = play.reb.id, rspot = { x: rim.x - dirIn * (3.5 + Math.random() * 4), y: 25 + jit(3) };
        add(rb, tRim + 0.04, rspot);
        fly(tRim, tRim + 0.09, rim, { holder: rb }, 3.2, 'reb');
        if (!play.reb.off) {
          // Rebond défensif puis relance vers le meneur, toute l'équipe repart.
          var outlet = defIds[0] !== rb ? defIds[0] : defIds[1], olSpot = { x: rspot.x - dirIn * 12, y: rspot.y < 25 ? 8 : 42 };
          hold(rb, tRim + 0.09, 0.9);
          add(outlet, 0.88, olSpot);
          fly(0.9, 0.96, { holder: rb }, { holder: outlet }, 2.2, 'pass');
          hold(outlet, 0.96, 1);
          defIds.forEach(function (did) { if (did !== outlet) add(did, 1, { x: lerp((tracksAt(did) || rim).x, W / 2, 0.35), y: (tracksAt(did) || rim).y }); });
          offIds.forEach(function (id) { add(id, 1, { x: lerp((tracksAt(id) || rim).x, W / 2, 0.3), y: (tracksAt(id) || rim).y }); });
        } else {
          hold(rb, tRim + 0.09, 1);
          fx.push({ t: tRim + 0.08, kind: 'text', text: 'REBOND OFFENSIF', at: rspot, color: this.teamColor(o) });
        }
      }
      if (play.ft) fx.push({ t: 0.94, kind: 'text', text: 'LF ' + play.ft.made + '/' + play.ft.n, at: A(15, 25), color: '#ffffff' });
    } else if (play.kind === 'tov') {
      var tT = half ? Math.max(tSet + 0.08, actT) : 0.3, last = chain[Math.min(chain.length - 1, 1)] || holder;
      hold(holder, 0, chain.length > 1 ? tT - 0.1 : tT);
      if (chain.length > 1) { fly(tT - 0.1, tT - 0.05, { holder: holder }, { holder: last }, 2, 'pass'); hold(last, tT - 0.05, tT); }
      else last = holder;
      var spot = tracksAt(last) || setup[last] || rim;
      if (play.stealer) {
        add(play.stealer, tT, spot);
        fly(tT, tT + 0.05, { holder: last }, { holder: play.stealer }, 1, 'steal');
        hold(play.stealer, tT + 0.05, 1);
        add(play.stealer, 1, { x: spot.x - dirIn * 24, y: 25 + jit(4) });
        defIds.forEach(function (did) { if (did !== play.stealer) add(did, 1, { x: lerp((tracksAt(did) || rim).x, W / 2, 0.6), y: (tracksAt(did) || rim).y }); });
        offIds.forEach(function (id) { add(id, 1, { x: lerp((tracksAt(id) || rim).x, W / 2, 0.5), y: (tracksAt(id) || rim).y }); });
        fx.push({ t: tT, kind: 'text', text: 'INTERCEPTION', at: spot, color: this.teamColor(d) });
        this.phases.push([tT, PHASE.fast]);
      } else {
        fly(tT, tT + 0.1, { holder: last }, { x: spot.x, y: 51 }, 2, 'out');
        fx.push({ t: tT + 0.04, kind: 'text', text: 'PERTE DE BALLE', at: spot, color: '#ffffff' });
      }
    } else if (play.kind === 'foul') {
      var tF = half ? Math.max(tSet + 0.06, actT) : 0.3;
      hold(holder, 0, 1);
      fx.push({ t: tF, kind: 'text', text: 'FAUTE', at: tracksAt(holder) || setup[holder] || rim, color: '#f2c94c' });
      if (play.ft) fx.push({ t: 0.85, kind: 'text', text: 'LF ' + play.ft.made + '/' + play.ft.n, at: A(15, 25), color: '#ffffff' });
    } else {
      hold(holder, 0, 1);
    }

    // Petits ajustements sans ballon pour que personne ne reste figé.
    offIds.forEach(function (id) {
      var tr = tracks[id], lastT = tr ? tr[tr.length - 1].t : 0;
      if (lastT < 0.7) { var s = tracksAt(id) || setup[id]; add(id, Math.max(lastT + 0.15, 0.75), { x: BM.clamp(s.x + jit(), 2, W - 2), y: BM.clamp(s.y + jit(), 2.5, H - 2.5) }); }
    });

    Object.keys(tracks).forEach(function (id) { tracks[id].sort(function (a, b) { return a.t - b.t; }); });
    this.tracks = tracks;
    this.ballSegs = segs.sort(function (a, b) { return a.t0 - b.t0; });
    this.pendingFx = skip ? fx.filter(function (f) { return f.kind !== 'tag'; }) : fx;
    this.guard = zone ? null : guard;
    this.t0 = performance.now();
    this.T = ms;
    this.skip = !!skip;
    this.attackDir = dirIn;
    this.offSide = o;
    this.label = (BM.SYSTEMS[sys] ? BM.SYSTEMS[sys].l : '') + ' contre ' + (BM.SCHEMES[sch] ? BM.SCHEMES[sch].l : '');
  };

  function actionLabel(play) {
    return { pnr: 'Pick & roll', post: 'Jeu au poste bas', iso: 'Isolation', cut: 'Coupe', motion: 'Circulation' }[play.action] || PHASE.act;
  }

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
    Object.keys(this.tracks).forEach(function (id) {
      var p = self.trackPos(+id, u);
      if (isFinite(p.x) && isFinite(p.y)) self.pos[id] = { x: p.x, y: p.y };
    });
    if (this.pendingFx) {
      this.pendingFx = this.pendingFx.filter(function (f) {
        if (u < f.t) return true;
        self.spawn(f, now);
        return false;
      });
    }
    try { this.draw(now, u); } catch (e) { /* une image ratée ne doit jamais figer la vue */ }
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
    if (f.kind === 'tag') this.fx.push({ kind: 'tag', x: f.at.x, y: f.at.y, text: f.text, color: f.color, born: now, life: Math.min(1400, this.T * 0.3) });
  };

  // Phase de jeu en cours (remontée, mise en place, action, tir, rebond).
  Court.prototype.phaseAt = function (u) {
    var ph = this.phases || [], cur = '';
    ph.forEach(function (p) { if (u >= p[0]) cur = p[1]; });
    return cur;
  };

  function star(x, cx, cy, r) {
    x.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  }

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
    x.font = '700 ' + Math.max(7, Math.round(1.35 * s)) + 'px Roboto, system-ui, sans-serif';
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
    x.font = '800 ' + Math.round(4.1 * s) + 'px Roboto, system-ui, sans-serif';
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

    // Défense : forme de la zone 2-3, ou fil de marquage entre chaque défenseur et son joueur.
    var setT = this.phases && this.phases[1] ? this.phases[1][0] : 0.2;
    if (!this.skip && u > setT && u < 0.82) {
      var dSide = 1 - (this.offSide || 0), dCol = this.teamColor(dSide);
      x.save();
      if (this.zoneOn) {
        var zd = m.on[dSide].map(function (id) { return self.pos[id]; }).filter(Boolean);
        if (zd.length >= 4) {
          zd.sort(function (a, b) { return Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2); });
          var top = zd.slice(0, 2).sort(function (a, b) { return a.y - b.y; }), bot = zd.slice(2).sort(function (a, b) { return a.y - b.y; });
          x.globalAlpha = 0.16; x.fillStyle = dCol;
          x.beginPath(); x.moveTo(P(top[0].x), P(top[0].y)); x.lineTo(P(top[1].x), P(top[1].y));
          bot.slice().reverse().forEach(function (pt) { x.lineTo(P(pt.x), P(pt.y)); });
          x.closePath(); x.fill();
          x.globalAlpha = 0.55; x.strokeStyle = dCol; x.lineWidth = Math.max(1, s * 0.14); x.setLineDash([s * 0.8, s * 0.6]); x.stroke();
        }
      } else if (this.guard) {
        x.globalAlpha = 0.42; x.strokeStyle = '#ffffff'; x.lineWidth = Math.max(0.8, s * 0.1); x.setLineDash([s * 0.35, s * 0.45]);
        var gd = this.guard;
        Object.keys(gd).forEach(function (did) {
          var a = self.pos[did], b = self.pos[gd[did]];
          if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) > 16) return;
          x.beginPath(); x.moveTo(P(a.x), P(a.y)); x.lineTo(P(b.x), P(b.y)); x.stroke();
        });
      }
      x.restore();
    }

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
      var stam = BM.clamp((m.en && m.en[id] !== undefined ? m.en[id] : 100) / 100, 0.08, 1);
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
      x.font = '800 ' + Math.round(2.05 * s) + 'px Roboto, system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(pl.last.charAt(0) + pl.first.charAt(0), cx, cy + s * 0.08);

      // 1re option choisie par le coach : étoile dorée.
      if (m.firstOpt[side] === id) {
        star(x, cx + r * 0.95, cy - r * 0.9, s * 1.1);
        x.fillStyle = '#f2c94c'; x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = Math.max(0.8, s * 0.12); x.stroke();
      }
      // Étiquette nom sous/sur le porteur de balle ou le joueur incarné.
      if (id === holder || mine) {
        x.font = '700 ' + Math.round(1.95 * s) + 'px Roboto, system-ui, sans-serif';
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
        x.font = '800 ' + Math.round(3.3 * s * pop) + 'px Roboto, system-ui, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = s * 0.65; x.strokeStyle = 'rgba(0,0,0,0.75)';
        var ty = P(f.y) - (4 + a * 5.2) * s, tx = BM.clamp(P(f.x), 8 * s, P(W) - 6 * s);
        x.strokeText(f.text, tx, ty); x.fillStyle = f.color; x.fillText(f.text, tx, ty);
      } else if (f.kind === 'tag') {
        x.globalAlpha = a < 0.85 ? 1 : (1 - a) / 0.15;
        x.font = '700 ' + Math.round(1.7 * s) + 'px Roboto, system-ui, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        var tw = x.measureText(f.text).width + s * 1.6, gx = BM.clamp(P(f.x), tw / 2 + s, P(W) - tw / 2), gy = P(f.y) - 4.2 * s;
        x.fillStyle = f.color; x.fillRect(gx - tw / 2, gy - 1.3 * s, tw, 2.6 * s);
        x.fillStyle = '#ffffff'; x.fillText(f.text, gx, gy + s * 0.08);
      }
      x.globalAlpha = 1;
      return true;
    });

    // Bandeau de lecture : phase en cours à gauche, système contre défense à droite.
    var phase = this.skip ? 'Accéléré' : this.phaseAt(u);
    if (phase || this.label) {
      var fs = Math.max(10, Math.round(1.55 * s)), padX = fs * 0.6, hh = fs * 1.7, yTop = P(0.6);
      x.font = '700 ' + fs + 'px Roboto, system-ui, sans-serif';
      x.textBaseline = 'middle';
      if (phase) {
        var pw = x.measureText(phase.toUpperCase()).width + padX * 2;
        x.fillStyle = 'rgba(6,16,28,0.82)'; x.fillRect(P(0.6), yTop, pw, hh);
        x.fillStyle = '#ffffff'; x.textAlign = 'left'; x.fillText(phase.toUpperCase(), P(0.6) + padX, yTop + hh / 2);
      }
      if (this.label && !this.skip) {
        x.font = '500 ' + fs + 'px Roboto, system-ui, sans-serif';
        var lw = x.measureText(this.label).width + padX * 2;
        x.fillStyle = 'rgba(6,16,28,0.7)'; x.fillRect(P(W - 0.6) - lw, yTop, lw, hh);
        x.fillStyle = '#d6dbe4'; x.textAlign = 'right'; x.fillText(this.label, P(W - 0.6) - padX, yTop + hh / 2);
      }
    }
    x.restore();
  };

  BM.Court = Court;
})();
