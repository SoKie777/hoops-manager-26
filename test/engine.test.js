// Banc d'essai statistique du moteur : des milliers de matchs, avec des cibles chiffrées proches de la NBA.
// Lancement : node test/engine.test.js [nombre de matchs]
var path = require('path');
var assert = require('assert');
['rng', 'data', 'nba-data', 'model', 'tactics', 'development', 'scouting', 'ecosystem', 'engine', 'analysis', 'league'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
var BM = globalThis.BM;
var N = +process.argv[2] || 3000;

var g = BM.newGame({ seed: 4242, teamId: 0, managerName: 'Banc' });
g.userTeam = -1; // aucune équipe pilotée : pas de conférence de presse ni de messages
var fx = { home: 0, away: 1, type: 'test' };

function play(h, a) {
  fx.home = h; fx.away = a;
  g.teams.forEach(function (t) { BM.roster(g, t).forEach(function (p) { p.condition = 100; p.injury = 0; }); });
  return new BM.Match(g, fx).simulateAll();
}

var t = { games: 0, pts: 0, poss: 0, ot: 0, margin: 0, close: 0, blow: 0, homeW: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, tov: 0, oreb: 0, dreb: 0 };
var strengths = g.teams.map(function (tm) { return BM.teamStrength(g, tm); });
var favWins = 0, favGames = 0, ptsBy = {}, gpBy = {}, big40 = 0, big50 = 0;
for (var i = 0; i < N; i++) {
  var h = g.rng.int(0, 29), a = (h + g.rng.int(1, 29)) % 30;
  var m = play(h, a);
  t.games++;
  t.pts += m.score[0] + m.score[1];
  t.poss += m.possCount;
  if (m.q > 4) t.ot++;
  var mg = Math.abs(m.score[0] - m.score[1]);
  t.margin += mg; if (mg <= 5) t.close++; if (mg >= 20) t.blow++;
  if (m.score[0] > m.score[1]) t.homeW++;
  Object.keys(m.box).forEach(function (id) {
    var b = m.box[id];
    if (b.sec > 0) { ptsBy[id] = (ptsBy[id] || 0) + b.pts; gpBy[id] = (gpBy[id] || 0) + 1; }
    if (b.pts >= 40) big40++;
    if (b.pts >= 50) big50++;
    t.fga += b.fga; t.fgm += b.fgm; t.tpa += b.tpa; t.tpm += b.tpm; t.fta += b.fta; t.tov += b.tov; t.oreb += b.oreb; t.dreb += b.dreb;
  });
  if (Math.abs(strengths[h] - strengths[a]) > 0.4) {
    favGames++;
    if ((strengths[h] > strengths[a]) === (m.score[0] > m.score[1])) favWins++;
  }
}
var r = {
  pts: t.pts / t.games / 2,
  poss: t.poss / t.games / 2,
  ortg: t.pts / t.poss * 100,
  margin: t.margin / t.games,
  ot: t.ot / t.games * 100,
  close: t.close / t.games * 100,
  blow: t.blow / t.games * 100,
  home: t.homeW / t.games * 100,
  fg: t.fgm / t.fga * 100, tp: t.tpm / t.tpa * 100, rate3: t.tpa / t.fga * 100,
  ftr: t.fta / t.fga, tov: t.tov / t.games / 2, orb: t.oreb / (t.oreb + t.dreb) * 100,
  fav: favWins / Math.max(1, favGames) * 100,
  // Meilleure moyenne de points (joueurs avec au moins 20 matchs) et fréquence des gros cartons.
  topPpg: Object.keys(ptsBy).filter(function (id) { return gpBy[id] >= 20; }).reduce(function (mx, id) { return Math.max(mx, ptsBy[id] / gpBy[id]); }, 0),
  g40: big40 / N, g50: big50 / N
};
console.log('Matchs :', N);
Object.keys(r).forEach(function (k) { console.log('  ' + k + ' : ' + r[k].toFixed(2)); });

// Cibles NBA (2024-26) avec tolérance de jeu.
var targets = {
  pts: [108, 122], poss: [94, 104], ortg: [108, 120], margin: [10, 14.5], ot: [3, 9], close: [18, 35], blow: [7, 20],
  home: [53, 62], topPpg: [27, 37], g40: [0.04, 0.3], g50: [0, 0.05], fg: [44, 50], tp: [34, 39], rate3: [36, 46], tov: [11, 16], orb: [20, 30], fav: [58, 80]
};
var fails = [];
Object.keys(targets).forEach(function (k) {
  if (r[k] < targets[k][0] || r[k] > targets[k][1]) fails.push(k + ' = ' + r[k].toFixed(2) + ' (cible ' + targets[k].join('-') + ')');
});

function report(note) {
  if (fails.length) { console.error('ÉCHEC :'); fails.forEach(function (f) { console.error('  ' + f); }); process.exit(1); }
  console.log('OK' + (note || ''));
}
if (process.argv[3] === 'fast') { report(' (sans exploits)'); process.exit(0); }

// Exploits : aucune combinaison système/schéma ne doit gagner plus de 60 % des matchs à effectifs égaux.
// On fait jouer la même équipe contre elle-même, avec des tactiques différentes.
var M = Math.max(60, Math.round(N / 25));
var sys = Object.keys(BM.SYSTEMS), sch = Object.keys(BM.SCHEMES), paces = ['lent', 'normal', 'rapide'];
var base = JSON.parse(JSON.stringify(g.teams[0].tactics));
var fam0 = JSON.parse(JSON.stringify(g.teams[0].fam || { off: {}, def: {} }));
var clone = JSON.parse(JSON.stringify(g.teams[0]));
clone.id = 30; g.teams.push(clone);
// Le clone joue avec les mêmes joueurs : on duplique leurs objets pour que les deux camps aient leur propre état.
clone.roster = clone.roster.map(function (id) {
  var c = JSON.parse(JSON.stringify(g.players[id])); c.id = 100000 + id; g.players[c.id] = c; c.teamId = 30; return c.id;
});
Object.keys(base.roles || {}).forEach(function (id) { clone.tactics.roles[100000 + +id] = base.roles[id]; });
clone.tactics.starters = (base.starters || []).map(function (id) { return 100000 + id; });
clone.tactics.minutes = {};
Object.keys(base.minutes || {}).forEach(function (id) { clone.tactics.minutes[100000 + +id] = base.minutes[id]; });
var exploits = [];
function trial(tacA) {
  var w = 0;
  for (var k = 0; k < M; k++) {
    var home = k % 2 === 0;
    Object.assign(g.teams[0].tactics, tacA);
    g.teams[0].fam = { off: {}, def: {} }; g.teams[0].fam.off[tacA.system] = 75; g.teams[0].fam.def[tacA.defense] = 75;
    clone.fam = JSON.parse(JSON.stringify(fam0));
    var mm = home ? play(0, 30) : play(30, 0);
    if ((mm.score[0] > mm.score[1]) === home) w++;
  }
  return w / M * 100;
}
sys.forEach(function (s) {
  sch.forEach(function (d) {
    paces.forEach(function (pc) {
      var pct = trial({ system: s, defense: d, pace: pc });
      if (pct > 60) exploits.push(s + '/' + d + '/' + pc + ' : ' + pct.toFixed(0) + ' %');
    });
  });
});
Object.assign(g.teams[0].tactics, base);
console.log('Exploits tactiques (> 60 % contre son propre effectif sur ' + M + ' matchs) :', exploits.length ? exploits.join(', ') : 'aucun');
if (exploits.length > 3) fails.push('trop de combinaisons dominantes : ' + exploits.length);

report();
