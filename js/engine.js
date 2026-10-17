var BM = globalThis.BM = globalThis.BM || {};

// Moteur de match possession par possession (format FIBA 4 x 10 min, prolongations de 5 min).
(function () {
  var QUARTER = BM.QUARTER_MIN * 60, OVERTIME = 300, REGULATION = 4 * QUARTER;
  var PACE_SEC = { lent: 15.2, normal: 13.4, rapide: 11.6 };
  var USAGE_EXP = 0.7;
  var SCORE_FX = 0.0027, SCORE_FX_CAP = 22;
  var POS_ORDER = { MEN: 0, ARR: 1, AIL: 2, AF: 3, PIV: 4 };

  function emptyBox() {
    return { sec: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 };
  }

  function Match(g, fx) {
    var self = this;
    this.g = g; this.fx = fx; this.rng = g.rng;
    this.side = [g.teams[fx.home], g.teams[fx.away]];
    this.user = fx.home === g.userTeam ? 0 : fx.away === g.userTeam ? 1 : -1;
    this.score = [0, 0]; this.q = 1; this.clock = QUARTER; this.elapsed = 0;
    this.teamFouls = [0, 0]; this.timeouts = [3, 3];
    this.events = []; this.finished = false; this.halftimePending = false;
    this.auto = [true, true];
    this.tac = [Object.assign({}, this.side[0].tactics), Object.assign({}, this.side[1].tactics)];
    this.roster = [0, 1].map(function (i) { return BM.availablePlayers(g, self.side[i]); });
    this.plan = [0, 1].map(function (i) { return BM.minutesPlan(g, self.side[i], self.roster[i]); });
    this.en = {}; this.box = {}; this.out = {}; this.lastSub = {}; this.grav = {};
    this.roster.forEach(function (r) {
      r.forEach(function (p) { self.en[p.id] = p.condition; self.box[p.id] = emptyBox(); self.lastSub[p.id] = 0; self.grav[p.id] = BM.gravity(p); });
    });
    this.on = [this.startingFive(0), this.startingFive(1)];
    this.edge = [0, 1].map(function (i) { return BM.tacticEdge(g, self.side[i]); });
    this.role = {};
    [0, 1].forEach(function (i) { self.roster[i].forEach(function (p) { self.role[p.id] = BM.ROLES[BM.roleOf(self.side[i], p)]; }); });
    this.mom = [50, 50];          // jauge de momentum (0-100) par équipe
    this.heat = {};               // série en cours de chaque joueur (≥ 3 : en feu)
    this.firstOpt = [null, null]; // 1re option offensive choisie en direct par le coach
    // Suivi pour l'analyse d'après-match : scores par quart-temps, énergie au 4e, séries de points.
    this.qs = []; this.q4en = [0, 0]; this.q4n = 0;
    this.run = { side: -1, pts: 0, q: 1 }; this.bestRun = [{ pts: 0 }, { pts: 0 }];
    this.starters0 = [this.on[0].slice(), this.on[1].slice()];
    this.firstPoss = this.rng.chance(0.5) ? 0 : 1;
    this.poss = this.firstPoss;
    this.oreb = false; this.fast = false; this.possCount = 0;
    this.log('info', -1, 'Entre-deux remporté par ' + this.side[this.poss].name + '.');
  }

  Match.prototype.p = function (id) { return this.g.players[id]; };
  Match.prototype.name = function (p) { return BM.shortName(p); };

  // Attribut effectif : fatigue et moral modulent la valeur brute.
  Match.prototype.a = function (p, k) {
    return p.attrs[k] * (0.78 + 0.22 * this.en[p.id] / 100) * (0.95 + 0.1 * p.morale / 100);
  };

  Match.prototype.log = function (type, side, text) {
    this.events.push({ type: type, side: side, text: text, q: this.q, clock: Math.max(0, Math.round(this.clock)), score: this.score.slice() });
  };

  Match.prototype.startingFive = function (i) {
    var self = this, avail = this.roster[i], ids = {};
    avail.forEach(function (p) { ids[p.id] = 1; });
    var five = (this.tac[i].starters || []).filter(function (id) { return ids[id]; });
    var rest = avail.filter(function (p) { return five.indexOf(p.id) < 0; })
      .sort(function (a, b) { return (self.plan[i][b.id] || 0) - (self.plan[i][a.id] || 0); });
    while (five.length < 5 && rest.length) five.push(rest.shift().id);
    return five;
  };

  Match.prototype.lineup = function (i) {
    var self = this;
    return this.on[i].map(function (id) { return self.p(id); });
  };

  // ---------------------------------------------------------------- rotations
  Match.prototype.subScore = function (i, p) {
    if (this.out[p.id]) return -99;
    var remainingGame = Math.max(60, REGULATION - Math.min(this.elapsed, REGULATION - 60));
    var need = (this.plan[i][p.id] || 0) * 60 - this.box[p.id].sec;
    var s = need / remainingGame + (this.en[p.id] - 80) / 100;
    if (this.en[p.id] < 60) s -= 0.3;
    if (this.box[p.id].pf >= BM.FOUL_OUT - 1 && this.q <= 3) s -= 0.4;
    if (this.box[p.id].pf >= BM.FOUL_OUT - 2 && this.q <= 2) s -= 0.2;
    if (this.q >= 4 && this.clock < 180 && !this.garbage()) s += BM.ovrRaw(p) / 40; // fin de match serrée : les meilleurs
    // Match plié : les titulaires sortent, le banc finit la rencontre.
    if (this.garbage()) s -= ((this.plan[i][p.id] || 0) - 20) / 20;
    return s;
  };

  Match.prototype.substitute = function (i, outId, inId, silent) {
    var idx = this.on[i].indexOf(outId);
    if (idx < 0 || this.on[i].indexOf(inId) >= 0) return false;
    this.on[i][idx] = inId;
    this.lastSub[inId] = this.lastSub[outId] = this.elapsed;
    if (!silent) this.log('sub', i, this.side[i].short + ' : ' + this.name(this.p(inId)) + ' remplace ' + this.name(this.p(outId)) + '.');
    return true;
  };

  Match.prototype.bench = function (i) {
    var self = this;
    return this.roster[i].filter(function (p) { return self.on[i].indexOf(p.id) < 0 && !self.out[p.id]; });
  };

  Match.prototype.rotate = function (i) {
    var self = this, bench = this.bench(i);
    // Remplacements forcés (5 fautes, blessure).
    this.on[i].slice().forEach(function (id) {
      if (!self.out[id]) return;
      var b = bench.sort(function (x, y) { return self.subScore(i, y) - self.subScore(i, x); })[0];
      if (b) { self.substitute(i, id, b.id); bench = self.bench(i); }
      else self.on[i].splice(self.on[i].indexOf(id), 1);
    });
    if (!this.auto[i]) return;
    for (var n = 0; n < 2; n++) {
      var onP = this.lineup(i).filter(function (p) { return self.elapsed - self.lastSub[p.id] >= 120 || self.en[p.id] < 55; });
      if (!onP.length || !bench.length) return;
      onP.sort(function (x, y) { return self.subScore(i, x) - self.subScore(i, y); });
      bench.sort(function (x, y) { return self.subScore(i, y) - self.subScore(i, x); });
      var worst = onP[0], best = bench[0];
      if (this.subScore(i, best) > this.subScore(i, worst) + 0.15) {
        this.substitute(i, worst.id, best.id);
        bench = this.bench(i);
      } else return;
    }
  };

  // ---------------------------------------------------------------- horloge et fatigue
  Match.prototype.tick = function (dur) {
    var self = this, mins = dur / 60;
    this.clock -= dur; this.elapsed += dur;
    [0, 1].forEach(function (i) {
      var press = self.tac[i].defense === 'press' || self.tac[1 - i].defense === 'press' ? 1.3 : 1;
      var paceF = self.tac[i].pace === 'rapide' ? 1.15 : self.tac[i].pace === 'lent' ? 0.9 : 1;
      self.roster[i].forEach(function (p) {
        if (self.on[i].indexOf(p.id) >= 0) {
          self.box[p.id].sec += dur;
          var drain = 1.25 * (1.3 - p.attrs.end / 20 * 0.6) * press * paceF;
          if (self.career && p.id === self.career.pid) drain *= (BM.CAREER_MENT[self.career.ment] || { drain: 1 }).drain * (1 - 0.05 * ((p.badges || {}).moteur || 0));
          self.en[p.id] = Math.max(5, self.en[p.id] - drain * mins);
          var injP = mins * 0.0002 * (self.en[p.id] < 50 ? 2 : 1);
          if (!self.out[p.id] && self.rng.chance(injP)) {
            p.injury = self.rng.int(2, 25);
            self.out[p.id] = true;
            self.log('injury', i, self.name(p) + ' se blesse et quitte le terrain (' + p.injury + ' j).');
          }
        } else {
          self.en[p.id] = Math.min(100, Math.max(p.condition, 60) + 5, self.en[p.id] + 2.5 * mins);
        }
      });
    });
  };

  // ---------------------------------------------------------------- statistiques
  Match.prototype.stat = function (p, k, n) { this.box[p.id][k] += n === undefined ? 1 : n; };

  Match.prototype.addPoints = function (side, p, pts) {
    var self = this;
    this.score[side] += pts;
    this.stat(p, 'pts', pts);
    if (this.run.side === side) this.run.pts += pts; else this.run = { side: side, pts: pts, q: this.q, from: this.score.slice() };
    if (this.run.pts > this.bestRun[side].pts) this.bestRun[side] = { pts: this.run.pts, q: this.run.q, from: this.run.from };
    this.on[side].forEach(function (id) { self.box[id].pm += pts; });
    this.on[1 - side].forEach(function (id) { self.box[id].pm -= pts; });
  };

  Match.prototype.clutch = function () {
    return this.q >= 4 && this.clock < 120 && Math.abs(this.score[0] - this.score[1]) <= 5;
  };

  // Écart au score vu par l'attaque (positif si elle mène).
  Match.prototype.lead = function (o) { return this.score[o] - this.score[1 - o]; };

  // Effet du score : l'équipe qui mène se relâche, celle qui est menée force et prend des risques.
  Match.prototype.scoreEffect = function (o) {
    var l = BM.clamp(this.lead(o), -SCORE_FX_CAP, SCORE_FX_CAP);
    return -l * SCORE_FX;
  };

  // Fin de match pliée (garbage time) : 4e quart-temps, écart de 18 pts ou plus à moins de 5 minutes.
  Match.prototype.garbage = function () {
    var gap = Math.abs(this.score[0] - this.score[1]);
    return this.q === 4 && ((this.clock < 300 && gap >= 18) || (this.clock < 480 && gap >= 26));
  };

  Match.prototype.avgGrav = function (side, k) {
    var self = this;
    return this.avg(this.lineup(side), function (p) { return self.grav[p.id][k]; });
  };

  Match.prototype.avg = function (arr, fn) {
    return arr.reduce(function (s, p) { return s + fn(p); }, 0) / arr.length;
  };

  Match.prototype.foul = function (side, p) {
    this.stat(p, 'pf');
    this.teamFouls[side]++;
    if (this.box[p.id].pf >= BM.FOUL_OUT) {
      this.out[p.id] = true;
      this.log('info', side, this.name(p) + ' est exclu pour ' + BM.FOUL_OUT + ' fautes.');
    }
  };

  // Lancers francs ; renvoie true si le dernier est réussi.
  Match.prototype.freeThrows = function (side, p, n) {
    var made = 0, last = false;
    var prob = 0.5 + 0.02 * this.a(p, 'lf');
    if (this.clutch()) prob += (p.attrs.sf - 10) * 0.006;
    prob = BM.clamp(prob, 0.4, 0.93);
    for (var k = 0; k < n; k++) {
      last = this.rng.chance(prob);
      this.stat(p, 'fta');
      if (last) { made++; this.stat(p, 'ftm'); this.addPoints(side, p, 1); }
    }
    this.log(made ? 'score' : 'miss', side, this.name(p) + ' : ' + made + '/' + n + ' aux lancers francs.');
    if (this.play) this.play.ft = { id: p.id, n: n, made: made };
    return last;
  };

  Match.prototype.switchPoss = function () { this.poss = 1 - this.poss; this.possCount++; };

  Match.prototype.rebound = function (o) {
    var self = this, d = 1 - o, O = this.lineup(o), D = this.lineup(d), rng = this.rng;
    var rv = function (p) { return self.a(p, 'reb') * 0.7 + self.a(p, 'det') * 0.2 + self.a(p, 'for') * 0.1; };
    var pO = 0.25 + 0.015 * (this.avg(O, rv) - this.avg(D, rv));
    if (this.tac[d].defense === 'zone') pO += 0.03;
    pO = BM.clamp(pO, 0.12, 0.42);
    if (rng.chance(pO)) {
      var r = rng.weighted(O, function (p) { return Math.pow(rv(p), 2.2) * (0.7 + p.attrs.act / 40); });
      this.stat(r, 'oreb');
      if (this.play) this.play.reb = { id: r.id, off: true };
      this.log('play', o, 'Rebond offensif de ' + this.name(r) + '.');
      this.oreb = true;
    } else {
      var dr = rng.weighted(D, function (p) { return Math.pow(rv(p), 2.2); });
      this.stat(dr, 'dreb');
      if (this.play) this.play.reb = { id: dr.id, off: false };
      var tr = { lent: 0.05, normal: 0.1, rapide: 0.2 }[this.tac[d].pace] + (BM.SYSTEMS[this.tac[d].system].transition || 0);
      this.fast = rng.chance(tr);
      this.switchPoss();
    }
  };

  Match.prototype.shotType = function (sh, o, d) {
    var self = this, e = function (k) { return self.a(sh, k); };
    var rim = Math.pow(Math.max(1, e('fin') * 0.7 + e('det') * 0.3 - 4), 1.3);
    var mid = Math.pow(Math.max(1, e('tirMi') - 3), 1.1) * 0.45;
    var three = Math.pow(Math.max(0.3, e('tir3') - 6), 1.6) * 0.95;
    var f = BM.SYSTEMS[this.tac[o].system].shot, rs = (this.role[sh.id] && this.role[sh.id].shot) || {};
    rim *= f.rim * (rs.rim || 1); mid *= f.mid * (rs.mid || 1); three *= f.three * (rs.three || 1);
    var sch = this.tac[d].defense;
    if (sch === 'zone') { rim *= 0.85; three *= 1.2; }
    if (sch === 'drop') { rim *= 0.9; mid *= 1.2; }
    if (sch === 'switch') { three *= 0.9; }
    if (sch === 'blitz') { three *= 1.1; }
    // Gravité défensive adverse : dissuade d'attaquer le cercle.
    rim *= BM.clamp(1 - (this.avgGrav(d, 'def') - 11) * 0.025, 0.75, 1.2);
    var r = this.rng.next() * (rim + mid + three);
    return r < rim ? 'rim' : r < rim + mid ? 'mid' : 'three';
  };

  Match.prototype.matchup = function (sh, o, D) {
    var O = this.lineup(o).slice().sort(function (a, b) { return POS_ORDER[a.pos] - POS_ORDER[b.pos]; });
    var Ds = D.slice().sort(function (a, b) { return POS_ORDER[a.pos] - POS_ORDER[b.pos]; });
    return Ds[Math.min(O.indexOf(sh), Ds.length - 1)] || Ds[0];
  };

  // ---------------------------------------------------------------- momentum, séries, mismatchs
  Match.prototype.isHot = function (pid) { return (this.heat[pid] || 0) >= 3; };

  // Avantage d'un attaquant sur son défenseur direct : au poste (taille, puissance) ou à l'extérieur (tir, vitesse).
  Match.prototype.mismatch = function (side, pid) {
    var self = this, p = this.p(pid), D = this.lineup(1 - side);
    if (!D.length) return { val: 0, kind: 'ext', vs: null };
    var d = this.matchup(p, side, D), a = function (x, k) { return self.a(x, k); };
    var inside = (a(p, 'fin') * 0.6 + a(p, 'for') * 0.25 + a(p, 'det') * 0.15) - (a(d, 'defI') * 0.5 + a(d, 'ctr') * 0.3 + a(d, 'for') * 0.2) + (p.height - d.height) / 4;
    var outside = (Math.max(a(p, 'tir3'), a(p, 'tirMi')) * 0.7 + a(p, 'drb') * 0.3) - (a(d, 'defE') * 0.6 + a(d, 'vit') * 0.4) + (d.height - p.height) / 8;
    var inn = inside >= outside;
    // Recentré (-3) : on garde le meilleur des deux angles, ce qui biaise vers le positif.
    return { val: Math.round(Math.max(inside, outside) - 3), kind: inn ? 'int' : 'ext', vs: d.id };
  };

  Match.prototype.addMomentum = function (side, n) {
    var before = this.mom[side];
    this.mom[side] = BM.clamp(this.mom[side] + n, 0, 100);
    this.momSaid = this.momSaid || [-999, -999];
    if (before < 80 && this.mom[side] >= 80 && this.elapsed - this.momSaid[side] > 90) {
      this.momSaid[side] = this.elapsed;
      this.log('momentum', side, 'Momentum ' + this.side[side].name + ' ! La salle s\'enflamme.');
    }
  };

  Match.prototype.afterShot = function (o, shooter, made, pts) {
    var d = 1 - o, h = this.heat[shooter.id] || 0;
    if (made) {
      this.heat[shooter.id] = h + (pts === 3 ? 1.5 : 1);
      if (h < 3 && this.heat[shooter.id] >= 3) this.log('hot', o, BM.shortName(shooter) + ' est en feu !');
      this.addMomentum(o, pts === 3 ? 8 : 6);
      this.addMomentum(d, -4);
    } else {
      this.heat[shooter.id] = Math.max(0, h - 1.5);
      this.addMomentum(d, 3);
    }
  };

  Match.prototype.setFirstOption = function (side, pid) {
    this.firstOpt[side] = pid || null;
    if (pid) this.log('info', side, 'Consigne : jouer pour ' + BM.shortName(this.p(pid)) + ' en 1re option.');
    else this.log('info', side, 'Consigne : retour au jeu collectif.');
  };

  // ---------------------------------------------------------------- une possession
  Match.prototype.possession = function () {
    var self = this, rng = this.rng, o = this.poss, d = 1 - o;
    this.rotate(0); this.rotate(1);
    var O = this.lineup(o), D = this.lineup(d);
    var pace = PACE_SEC[this.tac[o].pace] || PACE_SEC.normal;
    var sysO = BM.SYSTEMS[this.tac[o].system], sch = this.tac[d].defense;
    if (sysO.pace) pace = Math.min(pace, sysO.pace);
    var dur = this.oreb ? rng.range(4, 11) : this.fast ? rng.range(3, 7) : BM.clamp(rng.gauss(pace, 3.5), 5, 24);
    // Fin de match : l'équipe qui mène écoule l'horloge, celle qui est menée fait faute exprès.
    var late = this.q >= 4 && this.clock <= 60, ld = this.lead(o);
    if (late && ld > 0 && !this.oreb) dur = Math.max(dur, Math.min(22, this.clock - 1));
    var hackFoul = late && ld >= 4 && ld <= 9 && this.clock <= 45 && this.clock > 2 && !this.oreb;
    if (hackFoul) dur = rng.range(2, 5);
    // Égalité ou menés de 1-2 avec moins de 24 s : on garde le ballon pour le dernier tir.
    if (late && ld <= 0 && ld >= -2 && this.clock <= 24 && !this.oreb) dur = Math.max(1, this.clock - rng.range(0.5, 3));
    if (dur >= this.clock) dur = this.clock;
    var fast = this.fast, putback = this.oreb;
    // Moins de 3 s au chrono : tir désespéré depuis le milieu du terrain.
    var heave = this.clock <= 3 && !putback;
    this.fast = false; this.oreb = false;
    [0, 1].forEach(function (i) { self.mom[i] += (50 - self.mom[i]) * 0.04; });
    var fo = this.firstOpt[o] && this.on[o].indexOf(this.firstOpt[o]) >= 0 && !this.out[this.firstOpt[o]] ? this.firstOpt[o] : null;
    // Mode carrière : mentalité du joueur et action décidée lors d'un moment clé (possession suivante).
    var cr = this.career, me = cr ? this.p(cr.pid) : null, meOn = !!(cr && this.on[cr.side].indexOf(cr.pid) >= 0 && !this.out[cr.pid]);
    var ment = cr ? (BM.CAREER_MENT[cr.ment] || BM.CAREER_MENT.equil) : null, cf = null, cd = null;
    if (cr && cr.side === o && cr.next) { cf = meOn ? cr.next : null; cr.next = null; }
    if (cr && cr.side === d && cr.nextDef) { cd = meOn ? cr.nextDef : null; cr.nextDef = null; }
    this.play = { o: o, q: this.q, dur: dur, fast: fast, putback: putback, on: [this.on[0].slice(), this.on[1].slice()], kind: 'none' };
    this.tick(dur);
    if (this.q >= 4) {
      this.q4n++;
      [0, 1].forEach(function (i) { self.q4en[i] += self.avg(self.lineup(i), function (p) { return self.en[p.id]; }) || 0; });
    }
    if (O.length === 0 || D.length === 0) { this.switchPoss(); return; }
    var a = function (p, k) { return self.a(p, k); };

    if (hackFoul) {
      var hd = rng.weighted(O, function (p) { return Math.pow(a(p, 'drb') + a(p, 'pas'), 2); });
      var hf = rng.weighted(D, function (p) { return 22 - p.attrs.qi; });
      this.foul(d, hf);
      this.play.kind = 'foul'; this.play.fouler = hf.id; this.play.handler = hd.id;
      this.log('foul', d, 'Faute volontaire de ' + this.name(hf) + ' pour arrêter le chrono.');
      if (this.freeThrows(o, hd, 2)) this.switchPoss(); else this.rebound(o);
      return;
    }

    // Défense décidée par le joueur : tentative d'interception (réussie, faute ou décalage).
    if (cd && cd.steal) {
      var victim = rng.weighted(O, function (p) { return Math.pow(a(p, 'drb') + a(p, 'pas'), 2); });
      if (rng.chance(cd.steal)) {
        this.stat(victim, 'tov'); this.stat(me, 'stl');
        this.play.kind = 'tov'; this.play.handler = victim.id; this.play.stealer = me.id;
        this.addMomentum(d, 8);
        this.log('play', d, 'Interception de ' + this.name(me) + ' sur ' + this.name(victim) + ' ! Il lit la passe.');
        this.fast = rng.chance(0.75); this.switchPoss(); cr.result = 'ok';
        return;
      }
      cr.result = 'ko';
      if (rng.chance(cd.foul || 0)) {
        this.foul(d, me);
        this.play.kind = 'foul'; this.play.fouler = me.id;
        this.log('foul', d, 'Faute de ' + this.name(me) + ' en voulant intercepter.');
        if (this.teamFouls[d] > 4) { if (this.freeThrows(o, victim, 2)) this.switchPoss(); else this.rebound(o); } else this.oreb = true;
        return;
      }
    }

    // Perte de balle.
    var handler = rng.weighted(O, function (p) { return Math.pow(a(p, 'drb') + a(p, 'pas'), 2); });
    if (cf && rng.chance(0.6)) handler = me;
    if (fo && rng.chance(0.5)) handler = this.p(fo);
    var defSteal = this.avg(D, function (p) { return a(p, 'int') * 0.6 + a(p, 'defE') * 0.4; });
    var tov = 0.142 + 0.006 * (defSteal - (a(handler, 'drb') * 0.5 + a(handler, 'pas') * 0.3 + a(handler, 'qi') * 0.2));
    if (this.tac[d].defense === 'press') tov += 0.028;
    if (this.tac[d].defense === 'blitz') tov += 0.025;
    tov += (sysO.tov || 0) - this.edge[o].off * 0.3 + this.edge[d].def * 0.3;
    tov += (this.avgGrav(d, 'def') - 11) * 0.002;
    if (this.tac[o].pace === 'rapide') tov += 0.01;
    tov -= this.scoreEffect(o) * 0.5;
    if (putback) tov *= 0.4;
    if (cf) tov = tov * 0.6 + (cf.tov || 0); // action dessinée : moins de pertes, sauf prise de risque
    this.play.handler = handler.id;
    if (rng.chance(BM.clamp(tov, 0.05, 0.26))) {
      this.stat(handler, 'tov');
      this.play.kind = 'tov';
      if (rng.chance(0.55)) {
        var st = rng.weighted(D, function (p) { return Math.pow(a(p, 'int'), 2); });
        this.stat(st, 'stl');
        this.play.stealer = st.id;
        this.addMomentum(d, 6); this.addMomentum(o, -3);
        this.log('play', d, 'Interception de ' + this.name(st) + ' sur ' + this.name(handler) + ' !');
        this.fast = rng.chance(0.6);
      } else {
        this.log('play', o, 'Perte de balle de ' + this.name(handler) + '.');
      }
      this.switchPoss();
      return;
    }

    // Faute défensive hors tir.
    if (!putback && !cf && rng.chance(0.09)) {
      var fouler = rng.weighted(D, function (p) { return 22 - p.attrs.qi; });
      this.foul(d, fouler);
      this.play.kind = 'foul';
      this.play.fouler = fouler.id;
      if (this.teamFouls[d] > 4) {
        this.log('foul', d, 'Faute de ' + this.name(fouler) + ' (bonus) sur ' + this.name(handler) + '.');
        if (this.freeThrows(o, handler, 2)) this.switchPoss(); else this.rebound(o);
      } else {
        this.log('foul', d, 'Faute de ' + this.name(fouler) + '.');
        this.oreb = true; // remise en jeu, l'attaque conserve le ballon
      }
      return;
    }

    // Tir.
    var starO = O.slice().sort(function (x, y) { return BM.ovrRaw(y) - BM.ovrRaw(x); })[0];
    var shooter = rng.weighted(O, function (p) {
      var u = a(p, 'fin') * 0.35 + a(p, 'tirMi') * 0.2 + a(p, 'tir3') * 0.3 + a(p, 'drb') * 0.15;
      var rl = self.role[p.id], use = rl ? rl.usage : 1;
      if (sysO.star && p === starO) use *= sysO.star;
      if (sysO.bigs && (p.pos === 'AF' || p.pos === 'PIV')) use *= sysO.bigs;
      // Usage réaliste : la star prend environ un tiers des tirs quand elle est sur le terrain, pas la moitié.
      return Math.pow(u, USAGE_EXP) * Math.pow(use, 0.5) * (0.9 + self.grav[p.id].on / 80) * (p.id === fo ? 2.2 : 1) *
        (p === me ? Math.max(0.2, 1 + ment.u + (cr.usage || 0)) : 1);
    });
    if (cf) shooter = this.careerShooter(cf, O, me);
    if (cd && cd.forceShooter && this.on[o].indexOf(cd.forceShooter) >= 0) shooter = this.p(cd.forceShooter);
    if (cf && cf.fast) fast = true;
    var mm = shooter.id === fo ? this.mismatch(o, fo) : null;
    var type = fast ? (rng.chance(0.8) ? 'rim' : 'three') : putback && rng.chance(0.6) ? 'rim' : this.shotType(shooter, o, d);
    // Menés de 3 dans les dernières secondes : il faut un tir à 3 points.
    if (this.q >= 4 && this.clock <= 24 && this.lead(o) === -3) type = 'three';
    // La 1re option attaque son mismatch : poste bas s'il est intérieur.
    if (mm && mm.val >= 2 && mm.kind === 'int' && !fast && rng.chance(0.6)) type = 'rim';
    if (cf && cf.type) type = cf.type;
    var df = this.matchup(shooter, o, D);
    this.play.kind = 'shot'; this.play.shooter = shooter.id; this.play.type = type; this.play.made = false;
    var e = function (k) { return a(shooter, k); }, f = function (k) { return a(df, k); };
    var prob, pts = type === 'three' ? 3 : 2;
    if (type === 'rim') {
      var help = this.avg(D, function (p) { return a(p, 'defI') * 0.5 + a(p, 'ctr') * 0.5; });
      var offR = e('fin') * 0.65 + e('det') * 0.15 + e('for') * 0.2;
      var defR = (f('defI') * 0.5 + f('ctr') * 0.3 + f('for') * 0.2) * 0.6 + help * 0.4;
      prob = 0.51 + 0.016 * (offR - defR);
      if (fast) prob += 0.12;
      if (putback) prob += 0.04;
      if (this.tac[d].defense === 'zone') prob -= 0.03;
    } else if (type === 'mid') {
      prob = 0.38 + 0.012 * (e('tirMi') * 0.85 + e('sf') * 0.15 - (f('defE') * 0.7 + f('vit') * 0.3));
    } else {
      prob = 0.305 + 0.011 * (e('tir3') * 0.85 + e('sf') * 0.15 - (f('defE') * 0.6 + f('vit') * 0.25 + f('det') * 0.15));
      if (this.tac[d].defense === 'zone') prob += 0.015;
    }
    if (this.tac[d].defense === 'press') prob += 0.015;
    if (sch === 'drop') prob += type === 'rim' ? -0.025 : type === 'mid' ? 0.025 : 0;
    if (sch === 'switch' && type === 'three') prob -= 0.015;
    if (sch === 'blitz' && type === 'three') prob += 0.02;
    prob += this.edge[o].off - this.edge[d].def;
    var dr = this.role[df.id];
    if (dr && dr.perimeter && type !== 'rim') prob -= dr.perimeter;
    if (type === 'rim' && D.some(function (p) { return self.role[p.id] && self.role[p.id].rim; })) prob -= 0.015;
    // Gravité : l'espace créé par les coéquipiers sans ballon, le porteur qui aspire les aides, le défenseur qui dissuade.
    var spacing = this.avg(O.filter(function (p) { return p !== shooter; }), function (p) { return self.grav[p.id].off; }) || 11;
    prob += (spacing - 11) * (type === 'three' ? 0.002 : 0.004);
    if (handler !== shooter) prob += (this.grav[handler.id].on - 12) * 0.003;
    prob -= (this.grav[df.id].def - 11) * 0.004;
    if (o === 0) prob += 0.017; // avantage du terrain
    prob += ((this.side[o].cohesion || 50) - (this.side[d].cohesion || 50)) / 800; // cohésion relative : pas d'inflation globale
    if (this.clutch()) prob += (shooter.attrs.sf - 10) * 0.004;
    // Momentum d'équipe (relatif), main chaude, et récompense du coach qui choisit la bonne 1re option.
    prob += (this.mom[o] - this.mom[d]) / 2500;
    prob += this.scoreEffect(o);
    var hot = this.isHot(shooter.id);
    if (hot) prob += 0.015;
    if (mm) {
      var fav = mm.val >= 2;
      prob += hot && fav ? Math.min(0.07, 0.035 + 0.008 * mm.val) : hot ? 0.02 : fav ? 0.01 : -0.01;
      this.play.firstOption = true;
    }
    this.play.hot = hot;
    // Mode carrière : mentalité, badges, décision prise lors d'un moment clé.
    if (cr) {
      if (shooter === me) prob += ment.b + this.badgeBonus(me, type);
      if (meOn && cr.side === o) prob += ment.team;
      if (meOn && cr.side === d) prob -= ment.def;
      if (cf) prob += cf.bonus || 0;
      if (cd) prob += cd.bonus || 0;
    }
    prob = BM.clamp(prob, 0.12, 0.88);
    // Dernière possession décisive : défense resserrée, tir très disputé.
    if (this.q >= 4 && this.clock <= 24 && this.lead(o) === 0) prob -= 0.12;
    if (heave) { type = 'three'; pts = 3; prob = 0.08; this.play.type = type; }

    // Défense du joueur : passage en force ou tentative de contre décidés lors d'un moment clé.
    if (cd && (cd.charge || cd.block) && type === 'rim' && !heave) {
      if (cd.charge && rng.chance(cd.charge)) {
        this.stat(shooter, 'tov'); this.foul(o, shooter);
        this.play.kind = 'tov'; this.play.stealer = me.id;
        this.addMomentum(d, 8);
        this.log('play', d, 'Passage en force provoqué par ' + this.name(me) + ' !');
        cr.result = 'ok'; this.switchPoss();
        return;
      }
      if (cd.block && rng.chance(cd.block)) {
        this.stat(me, 'blk'); this.stat(shooter, 'fga');
        this.play.blocker = me.id;
        this.afterShot(o, shooter, false, pts); this.addMomentum(d, 7);
        this.log('play', d, 'Contre rageur de ' + this.name(me) + ' sur ' + this.name(shooter) + ' !');
        cr.result = 'ok'; this.rebound(o);
        return;
      }
      cr.result = 'ko';
      if (rng.chance(0.55)) { var fdm = me; this.foul(d, fdm); prob = Math.min(prob, 0.6); var forcedFoul = true; }
    }

    // Contre.
    if (type === 'rim') {
      var avgCtr = this.avg(D, function (p) { return a(p, 'ctr'); });
      var pBlk = BM.clamp(0.045 + 0.006 * (f('ctr') - 10) + 0.003 * (avgCtr - 10), 0.01, 0.16);
      if (rng.chance(pBlk)) {
        var blocker = rng.chance(0.65) ? df : rng.weighted(D, function (p) { return Math.pow(a(p, 'ctr'), 2); });
        this.stat(blocker, 'blk'); this.stat(shooter, 'fga');
        this.play.blocker = blocker.id;
        this.afterShot(o, shooter, false, pts);
        this.addMomentum(d, 4);
        this.log('play', d, 'Contre de ' + this.name(blocker) + ' sur ' + this.name(shooter) + ' !');
        this.rebound(o);
        return;
      }
    }

    var foulP = type === 'rim' ? 0.2 : type === 'mid' ? 0.07 : 0.03;
    if (cf && cf.foulUp) foulP += cf.foulUp;
    var fouled = forcedFoul || rng.chance(foulP), made = rng.chance(prob * (fouled ? 0.7 : 1));
    if (fouled && !forcedFoul) {
      var fd = rng.chance(0.6) ? df : rng.pick(D);
      this.foul(d, fd);
      this.play.fouled = true;
    }
    this.afterShot(o, shooter, made, pts);
    if (cf) cr.result = made ? 'ok' : 'ko';
    if (cr && shooter === me && made && this.clutch()) cr.clutchMade = (cr.clutchMade || 0) + 1;
    if (made) {
      this.play.made = true;
      this.stat(shooter, 'fga'); this.stat(shooter, 'fgm');
      if (pts === 3) { this.stat(shooter, 'tpa'); this.stat(shooter, 'tpm'); }
      this.addPoints(o, shooter, pts);
      var astP = (type === 'rim' ? 0.5 : type === 'mid' ? 0.55 : 0.85) + (sysO.ast || 0);
      if (putback) astP = 0.1;
      var passer = null, mates = O.filter(function (p) { return p !== shooter; });
      if (meOn && cr.side === o) astP += ment.ast;
      if (cf && cf.passer && shooter !== me) { passer = me; this.stat(me, 'ast'); this.play.passer = me.id; }
      else if (mates.length && rng.chance(astP)) {
        passer = rng.weighted(mates, function (p) { return Math.pow(a(p, 'pas'), 2.2) * (p === me && ment.ast ? 1.6 : 1); });
        this.stat(passer, 'ast');
        this.play.passer = passer.id;
      }
      this.log('score', o, this.madeText(shooter, type, fast) + (passer ? ' (passe de ' + this.name(passer) + ')' : ''));
      if (fouled) {
        this.log('foul', d, 'Panier + faute !');
        if (this.freeThrows(o, shooter, 1)) this.switchPoss(); else this.rebound(o);
      } else {
        this.switchPoss();
      }
      return;
    }
    if (fouled) {
      this.log('foul', d, 'Faute sur le tir de ' + this.name(shooter) + '.');
      if (this.freeThrows(o, shooter, pts)) this.switchPoss(); else this.rebound(o);
      return;
    }
    this.stat(shooter, 'fga');
    if (pts === 3) this.stat(shooter, 'tpa');
    this.log('miss', o, this.missText(shooter, type));
    this.rebound(o);
  };

  Match.prototype.madeText = function (p, type, fast) {
    var n = this.name(p), r = this.rng;
    if (type === 'three') return r.pick([n + ' plante le tir à 3 points !', n + ' sanctionne de loin !', 'Banderille de ' + n + ' derrière l\'arc !']);
    if (type === 'mid') return r.pick([n + ' réussit son tir à mi-distance.', 'Pull-up de ' + n + ', dedans.', n + ' trouve la cible en tête de raquette.']);
    if (fast) return r.pick(['Contre-attaque conclue par ' + n + ' !', n + ' s\'envole en transition !']);
    if (p.attrs.det >= 14 && r.chance(0.45)) {
      if (this.play) this.play.dunk = true;
      return r.pick(['Dunk de ' + n + ' !', 'Smash rageur de ' + n + ' !']);
    }
    return r.pick(['Lay-up de ' + n + '.', n + ' conclut près du cercle.', n + ' marque en force sous le panier.']);
  };

  Match.prototype.missText = function (p, type) {
    var n = this.name(p);
    if (type === 'three') return n + ' manque son tir à 3 points.';
    if (type === 'mid') return n + ' rate à mi-distance.';
    return n + ' échoue près du cercle.';
  };

  // ---------------------------------------------------------------- déroulement
  Match.prototype.endQuarter = function () {
    var t = this.side;
    this.qs.push(this.score.slice());
    var label = this.q <= 4 ? 'Fin du ' + (this.q === 1 ? '1er' : this.q + 'e') + ' quart-temps' : 'Fin de la prolongation';
    this.log('quarter', -1, label + ' : ' + t[0].short + ' ' + this.score[0] + ' - ' + this.score[1] + ' ' + t[1].short);
    if (this.q >= 4 && this.score[0] !== this.score[1]) { this.finish(); return; }
    if (this.q === 2) { this.halftimePending = true; this.timeouts = [4, 4]; }
    this.q++;
    this.clock = this.q > 4 ? OVERTIME : QUARTER;
    this.teamFouls = [0, 0];
    this.poss = (this.firstPoss + this.q - 1) % 2;
    this.oreb = this.fast = false;
    if (this.q > 4) this.log('info', -1, 'Prolongation !');
  };

  Match.prototype.step = function () {
    if (this.finished || this.halftimePending || this.pendingMoment) return [];
    if (this.career && this.career.live && this.checkMoment()) return [];
    var start = this.events.length;
    this.possession();
    if (this.play) this.play.score = this.score.slice();
    if (this.clock <= 0 && !this.finished) this.endQuarter();
    return this.events.slice(start);
  };

  Match.prototype.resumeAfterHalftime = function () { this.halftimePending = false; };

  Match.prototype.simulateAll = function () {
    var guard = 0;
    while (!this.finished && guard++ < 5000) {
      if (this.halftimePending) this.resumeAfterHalftime();
      this.step();
    }
    return this;
  };

  Match.prototype.timeout = function (i) {
    var self = this;
    if (this.timeouts[i] <= 0 || this.finished) return false;
    this.timeouts[i]--;
    this.on[i].forEach(function (id) { self.en[id] = Math.min(100, self.en[id] + 5); });
    this.mom[1 - i] = Math.min(this.mom[1 - i], Math.max(35, this.mom[1 - i] - 25));
    this.addMomentum(i, 5);
    this.log('info', i, 'Temps mort ' + this.side[i].name + '.');
    return true;
  };

  Match.prototype.teamTalk = function (i, talkId) {
    var talk = BM.TEAM_TALKS.find(function (t) { return t.v === talkId; });
    if (!talk) return '';
    var diff = this.score[i] - this.score[1 - i];
    var key = diff >= 8 ? 'mene' : diff <= -8 ? 'derriere' : 'serre';
    var base = talk.fx[key], rng = this.rng, self = this, sum = 0;
    this.roster[i].forEach(function (p) {
      var spread = talk.spread || 3;
      var leaderBonus = (p.attrs.lead - 10) * 0.15;
      var delta = Math.round(base + rng.gauss(0, spread / 2) + leaderBonus);
      p.morale = BM.clamp(p.morale + delta, 0, 100);
      sum += delta;
    });
    var avg = sum / this.roster[i].length;
    var reaction = avg >= 3 ? 'Les joueurs repartent galvanisés.' : avg >= 0 ? 'Le message passe correctement.' : 'Le vestiaire semble agacé par votre discours.';
    this.log('info', i, 'Causerie (' + talk.l + ') : ' + reaction);
    return reaction;
  };

  Match.prototype.rating = function (b) {
    if (b.sec < 180) return null;
    var min = b.sec / 60;
    var gs = b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * b.dreb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov;
    return Math.round(BM.clamp(6 + (gs - min * 0.28) / 4, 3, 10) * 10) / 10;
  };

  Match.prototype.finish = function () {
    var self = this;
    this.finished = true;
    var w = this.score[0] > this.score[1] ? 0 : 1;
    this.ratings = {};
    var best = null;
    Object.keys(this.box).forEach(function (id) {
      var r = self.rating(self.box[id]);
      if (r === null) return;
      var side = self.roster[0].some(function (p) { return p.id === +id; }) ? 0 : 1;
      if (side === w) r = Math.min(10, Math.round((r + 0.3) * 10) / 10);
      self.ratings[id] = r;
      if (!best || r > best.r) best = { id: +id, r: r };
    });
    this.mvp = best ? best.id : null;
    this.log('final', -1, 'Fin du match : ' + this.side[0].name + ' ' + this.score[0] + ' - ' + this.score[1] + ' ' + this.side[1].name);
  };

  BM.Match = Match;
})();
