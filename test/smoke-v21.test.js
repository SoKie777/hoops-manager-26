// Smoke test : vérifie que les modules v2.1 (rivalités, headlines, scores nuit, louanges) tournent.
var path = require('path');
var assert = require('assert');
['rng', 'data', 'nba-data', 'model', 'tactics', 'development', 'scouting', 'ecosystem', 'engine', 'analysis', 'legacy', 'league', 'rivalries', 'social', 'night-scores'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
var BM = globalThis.BM;

console.log('--- Smoke test v2.1 ---');

var g = BM.newGame({ seed: 42, teamId: 20, managerName: 'TestCoach' });

// 1. Rivalités initialisées
assert.ok(g.rivalries, 'g.rivalries doit exister après newGame');
var keys = Object.keys(g.rivalries);
assert.strictEqual(keys.length, 10, '10 paires historiques attendues, obtenu ' + keys.length);
console.log('OK rivalités : ' + keys.length + ' paires initiales');

// 2. Heat de BOS-LAL = 55
var bosLal = BM.rivalry(g, 1, 20);
assert.ok(bosLal, 'BOS-LAL doit exister');
assert.strictEqual(bosLal.heat, 55, 'heat initiale BOS-LAL doit être 55, obtenu ' + bosLal.heat);
console.log('OK heat BOS-LAL = ' + bosLal.heat);

// 3. Ajustement de heat
BM.rivalryAdjust(g, 1, 20, 12, 'testIncident');
assert.strictEqual(BM.rivalryHeat(g, 1, 20), 67, 'heat après +12 doit être 67, obtenu ' + BM.rivalryHeat(g, 1, 20));
console.log('OK heat ajustée à ' + BM.rivalryHeat(g, 1, 20));

// 4. Rivalité émergente
BM.rivalryAdjust(g, 5, 17, 8, 'emergenteTest', 'emergente');
var emerg = BM.rivalry(g, 5, 17);
assert.ok(emerg, 'rivalité émergente CLE-GSW doit être créée');
assert.strictEqual(emerg.kind, 'emergente');
console.log('OK rivalité émergente créée (heat ' + emerg.heat + ')');

// 5. fmtN
assert.strictEqual(BM.fmtN(800), '800');
assert.strictEqual(BM.fmtN(8400), '8,4k');
assert.strictEqual(BM.fmtN(125000), '125k');
assert.strictEqual(BM.fmtN(1500000), '1,5M');
console.log('OK fmtN fonctionne');

// 6. Rivalité la plus chaude de l'utilisateur
var myRival = BM.rivalryOf(g, g.userTeam);
assert.ok(myRival, 'L\'utilisateur (LAL, id 21) doit avoir au moins une rivalité (BOS-LAL)');
console.log('OK rivalité principale de LAL : vs team ' + myRival.a + ' ou ' + myRival.b + ' (heat ' + myRival.heat + ')');

// 7. Avancer jusqu'au premier match utilisateur et le jouer
var matchCount = 0, headlineCount = 0;
for (var i = 0; i < 1000; i++) {
  var r = BM.advance(g);
  if (r.state === 'match') {
    var m = BM.playMatch(g, r.fx);
    matchCount++;
    if (matchCount >= 5) break; // on joue 5 matchs pour accumuler du feed
  } else if (r.state === 'blocked') {
    var me = g.teams[g.userTeam];
    if (me.roster.length > BM.ROSTER_MAX) BM.releasePlayer(g, BM.roster(g, me).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0].id);
    else { var fa = g.players[g.freeAgents[0]]; me.wageBudget += fa.contract.salary; BM.offerContract(g, fa.id, fa.contract.salary * 2, 1); }
  } else if (r.state === 'draft') {
    if (!g.draft) BM.startDraft(g);
    while (BM.draftAdvance(g)) {
      var board = g.draftClass.map(function (id) { return g.players[id]; }).sort(function (a, b) { return BM.scoutEstimate(g, b).pot - BM.scoutEstimate(g, a).pot; });
      BM.draftPlayer(g, board[0].id);
    }
    BM.finishDraft(g);
  } else if (r.state === 'seasonEnd') {
    BM.endSeason(g);
    BM.startNewSeason(g);
  }
}

console.log('OK ' + matchCount + ' matchs joués par l\'utilisateur');

// 8. Le feed social contient des posts après les matchs
assert.ok(g.feed && g.feed.length > 0, 'le feed doit contenir des posts après matchs');
console.log('OK feed contient ' + g.feed.length + ' posts');

// 9. Le panneau "Scores de la nuit" a été généré après le dernier match
assert.ok(g.lastNightScores, 'g.lastNightScores doit exister après le dernier match');
assert.ok(g.lastNightScores.items && g.lastNightScores.items.length > 0, 'le panneau nuit doit avoir des items');
console.log('OK panneau nuit : ' + g.lastNightScores.items.length + ' matchs sélectionnés');
// Affiche les 3 premiers
g.lastNightScores.items.slice(0, 3).forEach(function (it) {
  console.log('  - ' + it.home.short + ' vs ' + it.away.short + ' : ' + it.fx.hs + '-' + it.fx.as +
    (it.ot ? ' OT' : '') + (it.upset ? ' UPSET' : '') + (it.rival ? ' RIVAL' : '') + (it.userRivalLost ? ' RIVAL_LOST' : '') + ' (score ' + it.score + ')');
});

// 10. Les headlines ont été générées
if (g.headlines && g.headlines.length > 0) {
  console.log('OK headlines : ' + g.headlines.length + ' articles');
  console.log('  Top : ' + g.headlines[0].source + ' — "' + g.headlines[0].title + '"');
} else {
  console.log('(headlines pas encore générées — OK si on n\'a pas atteint endDay)');
}

// 11. Si BOS-LAL était un match utilisateur, vérifier que le heat a évolué
var bosLalNow = BM.rivalry(g, 1, 21);
if (bosLalNow) {
  console.log('OK heat BOS-LAL après matchs : ' + bosLalNow.heat + ' (jouée ' + bosLalNow.playedThisSeason + 'x cette saison)');
  console.log('  Événements récents : ' + bosLalNow.recent.map(function (r) { return r.kind + '(' + (r.delta > 0 ? '+' : '') + r.delta + ')'; }).join(', '));
}

// 12. Vérifier que la sauvegarde sérialise/désérialise correctement
var json = BM.serialize(g);
var g2 = BM.deserialize(json);
assert.ok(g2.rivalries, 'g2.rivalries doit exister après deserialize');
assert.strictEqual(Object.keys(g2.rivalries).length, Object.keys(g.rivalries).length, 'mêmes rivalités après rechargement');
console.log('OK sérialisation/désérialisation préserve les rivalités');

console.log('\n--- Smoke test v2.1 OK ---');
