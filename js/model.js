var BM = globalThis.BM = globalThis.BM || {};

BM.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

BM.emptyStats = function () {
  return { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, rtg: 0 };
};

BM.player = function (g, id) { return g.players[id]; };
BM.team = function (g, id) { return g.teams[id]; };
BM.roster = function (g, team) { return team.roster.map(function (id) { return g.players[id]; }); };

// Note globale brute (échelle 1-20) pondérée par le poste.
BM.ovrRaw = function (p, pos) {
  var w = BM.POS_WEIGHTS[pos || p.pos], s = 0, t = 0;
  for (var k in w) { s += p.attrs[k] * w[k]; t += w[k]; }
  return s / t;
};

// Note affichée sur 100.
BM.ovr = function (p) { return Math.round(BM.ovrRaw(p) * 5); };
BM.potDisplay = function (p) { return Math.round(Math.max(p.pot, BM.ovrRaw(p)) * 5); };

// Salaire demandé (k$), calé sur l'échelle NBA : minimum ≈ 1,3 M$, max ≈ 60 M$.
BM.askingSalary = function (p) {
  var o = BM.ovrRaw(p), ageF = p.age <= 22 ? 1.1 : p.age >= 34 ? 0.6 : p.age >= 32 ? 0.8 : 1;
  var s = BM.SAL_BASE * Math.pow(BM.SAL_GROWTH, o - 9) * ageF;
  return BM.clamp(Math.round(s / 50) * 50, 1300, 60000);
};
BM.SAL_BASE = 2500;
BM.SAL_GROWTH = 1.45;

// Valeur de rachat de contrat (k$).
BM.playerValue = function (p) {
  var ageF = p.age <= 21 ? 1.8 : p.age <= 24 ? 1.4 : p.age <= 28 ? 1.1 : p.age <= 31 ? 0.8 : 0.4;
  var upside = Math.max(0, p.pot - BM.ovrRaw(p)) * 0.12 + 1;
  return Math.round(BM.askingSalary(p) * (0.5 + p.contract.years * 0.3) * ageF * upside / 50) * 50;
};

BM.newPlayer = function (g, fields) {
  var p = {
    id: g.nextId++, morale: g.rng.int(60, 80), condition: 100, injury: 0,
    listed: false, form: [], recent: [], stats: BM.emptyStats(), career: []
  };
  for (var k in fields) p[k] = fields[k];
  if (!p.height) p.height = Math.round(BM.POS_HEIGHT[p.pos] + 2 + g.rng.gauss(0, 4)); // gabarits NBA (meneur ~1,88 m, pivot ~2,13 m)
  g.players[p.id] = p;
  return p;
};

BM.growthFor = function (g, age) {
  var rng = g.rng;
  return age <= 20 ? rng.range(2, 6) : age <= 23 ? rng.range(1, 4) : age <= 26 ? rng.range(0, 1.5) : 0;
};

BM.genPlayer = function (g, opt) {
  var rng = g.rng, pos = opt.pos || rng.pick(BM.POSITIONS);
  var age = opt.age || rng.int(19, 34), q = opt.quality, attrs = {};
  BM.ATTRS.forEach(function (a) {
    var bias = BM.POS_BIAS[pos][a.k] || 0;
    var v = q + bias + rng.gauss(0, 1.8);
    if (a.g === 'phys' && age >= 31) v -= (age - 30) * 0.4;
    if (a.g === 'ment' && age <= 21) v -= 1;
    attrs[a.k] = BM.clamp(Math.round(v), 1, 20);
  });
  var p = BM.newPlayer(g, {
    first: opt.first || rng.pick(BM.FIRST_NAMES),
    last: opt.last || rng.pick(BM.LAST_NAMES),
    age: age, pos: pos, attrs: attrs,
    teamId: opt.teamId === undefined ? null : opt.teamId
  });
  p.pot = Math.min(19.5, BM.ovrRaw(p) + BM.growthFor(g, age));
  p.contract = { salary: opt.salary || BM.askingSalary(p), years: opt.years || rng.int(1, 4) };
  return p;
};

// Joueur issu des données NBA réelles (attributs dérivés de ses statistiques).
BM.playerFromData = function (g, d, teamId) {
  var parts = d.n.split(' '), first = parts.shift(), last = parts.join(' ') || first;
  if (!d.a) {
    // Sous contrat mais sans statistiques (rookie, longue blessure) : profil estimé d'après le salaire.
    var rookie = d.sal >= 2500 && d.sal <= 16000 && d.yrs >= 2;
    var q = BM.clamp(7.5 + Math.log(d.sal / 1300) / Math.LN2 * 1.1, 6, 15);
    var age = d.age || (rookie ? g.rng.int(19, 21) : g.rng.int(23, 31));
    var p0 = BM.genPlayer(g, { first: first, last: last, quality: q, age: age, pos: d.pos || undefined, teamId: teamId, salary: d.sal, years: d.yrs });
    p0.rookie = rookie || !!d.pot;
    BM.calibrate(p0, d);
    // Potentiel fourni (rookies de 2026) sinon recalculé à partir de la note calibrée.
    p0.pot = d.pot ? d.pot / 5 : Math.min(19.5, BM.ovrRaw(p0) + BM.growthFor(g, age));
    return p0;
  }
  var attrs = {};
  BM.NBA.attrKeys.forEach(function (k, i) { attrs[k] = d.a[i]; });
  var p = BM.newPlayer(g, {
    first: first, last: last, age: d.age, pos: d.pos, attrs: attrs, teamId: teamId,
    gravBase: { off: d.g[0], on: d.g[1], def: d.g[2] },
    real: { pts: d.s[0], reb: d.s[1], ast: d.s[2], stl: d.s[3], blk: d.s[4], gp: d.s[5] }
  });
  BM.calibrate(p, d);
  p.pot = Math.min(19.5, BM.ovrRaw(p) + BM.growthFor(g, p.age));
  p.contract = d.t ? { salary: d.sal, years: d.yrs } : { salary: BM.askingSalary(p), years: g.rng.int(1, 2) };
  return p;
};

// Note cible NBA 2K27 (top 100) ou plancher des légendes ; les autres sont plafonnés pour garder la hiérarchie.
BM.calibrate = function (p, d) {
  if (d.leg) p.legend = true;
  if (d.ov) BM.fitOverall(p, d.ov);
  else if (BM.ovr(p) > BM.NBA.ovrCap) BM.fitOverall(p, BM.NBA.ovrCap);
};

// Ajuste les attributs pondérés du poste, un point à la fois, jusqu'à la note affichée visée.
// On renforce d'abord les points forts (Giannis reste un shooteur moyen) et on rabote d'abord les points faibles.
BM.fitOverall = function (p, target) {
  var w = BM.POS_WEIGHTS[p.pos], keys = Object.keys(w), orig = Object.assign({}, p.attrs);
  // Première passe : un attribut ne s'écarte pas de plus de 4 points de son profil réel ; ensuite sans limite.
  var limit = 4;
  for (var n = 0; n < 500 && BM.ovr(p) !== target; n++) {
    var up = BM.ovr(p) < target, best = null, bestScore = -1;
    keys.forEach(function (k) {
      var v = p.attrs[k];
      if (up ? v >= 20 : v <= 1) return;
      if (Math.abs(v + (up ? 1 : -1) - orig[k]) > limit) return;
      var score = w[k] * (up ? v : 21 - v);
      if (score > bestScore) { bestScore = score; best = k; }
    });
    if (!best) {
      if (limit < 20) { limit = 20; continue; }
      return;
    }
    p.attrs[best] += up ? 1 : -1;
  }
};

BM.shortName = function (p) { return p.first.charAt(0) + '. ' + p.last; };
BM.fullName = function (p) { return p.first + ' ' + p.last; };

BM.payroll = function (g, team) {
  return team.roster.reduce(function (s, id) { return s + g.players[id].contract.salary; }, 0);
};

BM.availablePlayers = function (g, team) {
  return BM.roster(g, team).filter(function (p) { return p.injury <= 0 && !p.gleague; });
};

// ==================================================================== gravité
// Base : profil du joueur (données réelles ou attributs). Valeur affichée : base + forme récente.
BM.gravityBase = function (p) {
  if (p.gravBase) return p.gravBase;
  var a = p.attrs;
  return {
    off: Math.round(a.tir3 * 0.55 + a.tirMi * 0.15 + a.act * 0.15 + a.vit * 0.15),
    on: Math.round(a.drb * 0.3 + a.fin * 0.25 + a.pas * 0.25 + a.tirMi * 0.2),
    def: Math.round(Math.max(a.ctr, a.int) * 0.5 + a.defI * 0.25 + a.defE * 0.25)
  };
};

BM.gravity = function (p) {
  var base = BM.gravityBase(p), r = p.recent || [], s = p.stats;
  var form = p.form.length ? p.form.reduce(function (x, y) { return x + y; }, 0) / p.form.length : 6.5;
  var fd = BM.clamp(form - 6.5, -3, 3);
  var sum = function (k) { return r.reduce(function (x, e) { return x + e[k]; }, 0); };
  var min = sum('min'), dOff = 0, dOn = 0, dDef = 0;
  if (min >= 30) {
    var tpa = sum('tpa'), r3 = (sum('tpm') + 1.8) / (tpa + 5);
    var s3 = s.tpa >= 25 ? s.tpm / s.tpa : 0.36;
    dOff = BM.clamp((r3 - s3) * 30, -3, 3) * Math.min(1, tpa / 12);
    var rp = sum('pts') / min * 36, sp = s.min >= 100 ? s.pts / s.min * 36 : rp;
    dOn = BM.clamp((rp - sp) / 3, -3, 3);
    var rs = sum('stk') / min * 36, ss = s.min >= 100 ? (s.stl + s.blk) / s.min * 36 : rs;
    dDef = BM.clamp((rs - ss) * 1.2, -3, 3);
  }
  var val = function (b, d, w) { return BM.clamp(Math.round(b + fd * w + d), 1, 20); };
  var g = { off: val(base.off, dOff, 0.6), on: val(base.on, dOn, 1), def: val(base.def, dDef, 0.6) };
  g.trend = { off: g.off - base.off, on: g.on - base.on, def: g.def - base.def };
  return g;
};

// ==================================================================== rotation
// Choix automatique du cinq + temps de jeu (utilisé par l'IA et le bouton "Auto").
BM.autoTactics = function (g, team) {
  var auto = BM.computeAutoTactics(g, team);
  team.tactics.starters = auto.starters;
  team.tactics.minutes = auto.minutes;
};

BM.computeAutoTactics = function (g, team) {
  var avail = BM.availablePlayers(g, team).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
  var starters = [], used = {};
  var slots = [['MEN', 'ARR'], ['ARR', 'AIL', 'MEN'], ['AIL', 'ARR', 'AF'], ['AF', 'PIV', 'AIL'], ['PIV', 'AF']];
  slots.forEach(function (prefs) {
    for (var i = 0; i < prefs.length; i++) {
      var c = avail.find(function (p) { return !used[p.id] && p.pos === prefs[i]; });
      if (c) { used[c.id] = 1; starters.push(c.id); return; }
    }
    var any = avail.find(function (p) { return !used[p.id]; });
    if (any) { used[any.id] = 1; starters.push(any.id); }
  });
  var bench = avail.filter(function (p) { return !used[p.id]; });
  var mins = {}, startMin = [36, 34, 34, 32, 30], benchMin = [22, 18, 14, 12, 8];
  starters.forEach(function (id, i) { mins[id] = startMin[i]; });
  bench.forEach(function (p, i) { mins[p.id] = benchMin[i] || 0; });
  return { starters: starters, minutes: mins };
};

// Plan de minutes normalisé à 240 (5 x 48) sur les joueurs disponibles.
BM.minutesPlan = function (g, team, avail) {
  var total = BM.GAME_MINUTES * 5, mins = team.tactics.minutes || {}, plan = {}, sum = 0;
  avail.forEach(function (p) { plan[p.id] = Math.max(0, mins[p.id] || 0); sum += plan[p.id]; });
  if (sum < total / 2) {
    // Trop de joueurs prévus sont indisponibles : plan automatique pour ce match seulement.
    var auto = BM.computeAutoTactics(g, team).minutes;
    sum = 0;
    avail.forEach(function (p) { plan[p.id] = auto[p.id] || 0; sum += plan[p.id]; });
  }
  avail.forEach(function (p) { plan[p.id] = Math.min(44, plan[p.id] * total / Math.max(1, sum)); });
  return plan;
};
