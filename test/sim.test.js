// Test de bout en bout : simule plusieurs saisons complètes et vérifie que les statistiques restent réalistes.
// Lancement : node test/sim.test.js
var path = require('path');
var assert = require('assert');
['rng', 'data', 'nba-data', 'model', 'tactics', 'development', 'scouting', 'ecosystem', 'engine', 'analysis', 'legacy', 'league', 'rivalries', 'social', 'night-scores'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
var BM = globalThis.BM;

var g = BM.newGame({ seed: 12345, teamId: 5, managerName: 'Test' });
assert.strictEqual(g.teams.length, 30);
assert.strictEqual(g.fixtures.length, 870, '58 journées x 15 matchs');

var totals = { pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, tov: 0, games: 0, ot: 0 };
var seasons = 3, days = 0;
for (var s = 0; s < seasons; s++) {
  for (;;) {
    var r = BM.advance(g);
    days++;
    assert(days < 3000, 'boucle infinie');
    if (r.state === 'match') {
      var m = BM.playMatch(g, r.fx);
      assert(m.finished);
      assert.notStrictEqual(m.score[0], m.score[1]);
      Object.keys(m.box).forEach(function (id) {
        var b = m.box[id];
        totals.pts += b.pts; totals.fga += b.fga; totals.fgm += b.fgm; totals.tpa += b.tpa; totals.tpm += b.tpm;
        totals.fta += b.fta; totals.ftm += b.ftm; totals.tov += b.tov;
      });
      var secs = Object.keys(m.box).reduce(function (t, id) { return t + m.box[id].sec; }, 0);
      if (m.q > 4) totals.ot++;
      else assert(Math.abs(secs - 2 * 5 * 2880) < 1, 'minutes jouées incohérentes : ' + secs);
      totals.games++;
      continue;
    }
    if (r.state === 'blocked') {
      // L'utilisateur automatique recrute un agent libre ou libère le moins bon joueur.
      var me = g.teams[g.userTeam];
      if (me.roster.length > BM.ROSTER_MAX) BM.releasePlayer(g, BM.roster(g, me).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0].id);
      else { var fa = g.players[g.freeAgents[0]]; me.wageBudget += fa.contract.salary; BM.offerContract(g, fa.id, fa.contract.salary * 2, 1); }
      continue;
    }
    if (r.state === 'draft') {
      // Draft automatique : le joueur choisit le meilleur potentiel estimé.
      if (!g.draft) BM.startDraft(g);
      while (BM.draftAdvance(g)) {
        var board = g.draftClass.map(function (id) { return g.players[id]; }).sort(function (a, b) { return BM.scoutEstimate(g, b).pot - BM.scoutEstimate(g, a).pot; });
        BM.draftPlayer(g, board[0].id);
      }
      BM.finishDraft(g);
      assert(g.draft.picks.length === 60, 'draft complète : ' + g.draft.picks.length);
      continue;
    }
    if (r.state === 'seasonEnd') {
      assert(g.playoffs.champion !== undefined);
      var sum = BM.endSeason(g);
      if (g.gameOver) { console.log('Licencié en fin de saison', s + 1); break; }
      BM.startNewSeason(g);
      var ovs = Object.values(g.players).filter(function (p) { return p.teamId !== null; }).map(function (p) { return BM.ovrRaw(p); });
      console.log('  note moyenne des joueurs sous contrat :', (ovs.reduce(function (a, b) { return a + b; }, 0) / ovs.length).toFixed(2));
      console.log('Saison', sum.season, ': champion', sum.champion, '| utilisateur', sum.finalPos + 'e', '| objectif atteint :', sum.met, '| MVP', sum.mvp);
      break;
    }
    if (r.state === 'gameover') { console.log('Licencié pendant la saison', s + 1); break; }
  }
  if (g.gameOver) break;
}

// Toutes les rencontres des équipes IA : statistiques globales.
var all = g.fixtures.concat([]);
var ppg = totals.pts / totals.games / 2;
var fg = totals.fgm / totals.fga, tp = totals.tpm / totals.tpa, ft = totals.ftm / totals.fta;
console.log('Matchs utilisateur :', totals.games, '| prolongations :', totals.ot);
console.log('Pts/équipe :', ppg.toFixed(1), '| FG%', (fg * 100).toFixed(1), '| 3P%', (tp * 100).toFixed(1), '| 3PA/FGA', (totals.tpa / totals.fga * 100).toFixed(1),
  '| LF%', (ft * 100).toFixed(1), '| BP/équipe', (totals.tov / totals.games / 2).toFixed(1));
assert(ppg > 100 && ppg < 125, 'points par équipe hors plage : ' + ppg);
assert(fg > 0.4 && fg < 0.54, 'FG% hors plage');
assert(tp > 0.3 && tp < 0.42, '3P% hors plage');
assert(ft > 0.65 && ft < 0.85, 'LF% hors plage');

// Écosystème : trophées, échange, discussion, conférence de presse.
assert(g.awardsHistory && Object.keys(g.awardsHistory).length >= 1, 'trophées remis');
var g3 = BM.newGame({ seed: 77, teamId: 17, managerName: 'T' });
var me3 = g3.teams[17], partner = g3.teams[3];
var giveP = BM.roster(g3, me3).sort(function (a, b) { return b.contract.salary - a.contract.salary; })[3];
var getP = BM.roster(g3, partner).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
var ev = BM.evalTrade(g3, 3, [giveP.id], [getP.id]);
assert(typeof ev.ok === 'boolean' && ev.msg, 'évaluation de l\'échange');
if (ev.ok) { BM.executeTrade(g3, 3, [giveP.id], [getP.id]); assert(getP.teamId === 17 && giveP.teamId === 3, 'échange exécuté'); }
var talk = BM.interact(g3, BM.roster(g3, me3)[0].id, 'praise');
assert(talk.length > 5, 'discussion');
BM.interact(g3, BM.roster(g3, me3)[5].id, 'promise');
assert(g3.promises.length === 1, 'promesse enregistrée');
assert(['franchise', 'titulaire', 'rotation', 'banc', 'espoir'].indexOf(BM.roster(g3, me3)[0].status) >= 0, 'statut');
var dyn = BM.dynamics(g3, me3);
assert(dyn.leaders.length === 3 && dyn.atmosphere > 0, 'dynamique du vestiaire');
console.log('Écosystème OK : échange', ev.mood, '| ambiance', dyn.label);

// Sauvegarde / chargement.
var json = BM.serialize(g);
console.log('Taille de la sauvegarde :', (json.length / 1024).toFixed(0) + ' Ko');
console.log('Hall of Fame : ' + (g.hof || []).map(function (h) { return h.name + ' (' + h.score + ')'; }).join(', '));
console.log('Héritage : actualités ' + (g.news || []).length + ' | Hall of Fame ' + (g.hof || []).length + ' | fil ' + (g.feed || []).length + ' | accomplissements coach ' + Object.keys((g.coach || {}).ach || {}).length + ' | points ' + ((g.coach || {}).legacyPts || 0));
assert(json.length < 3.5 * 1024 * 1024, 'sauvegarde trop lourde pour le stockage local');
var g2 = BM.deserialize(json);
assert.strictEqual(g2.rng.next(), g.rng.next(), 'état RNG restauré');
Object.keys(g.teams).forEach(function (i) {
  g.teams[i].roster.forEach(function (id) { assert.strictEqual(g.players[id].teamId, +i, 'cohérence effectif/joueur'); });
});
console.log('OK');
