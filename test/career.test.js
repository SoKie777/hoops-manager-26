// Test du mode carrière : prospect, draft, saisons NBA (moments clés en direct), free agency, retraite, reconversion en coach.
// Lancement : node test/career.test.js
var path = require('path');
var assert = require('assert');
['rng', 'data', 'nba-data', 'model', 'portrait', 'tactics', 'development', 'scouting', 'ecosystem', 'engine', 'analysis', 'career-data', 'career-match', 'career', 'career-events', 'league', 'legacy'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
var BM = globalThis.BM;

var g = BM.newCareer({ seed: 2026, first: 'Kofi', last: 'Mensah', pos: 'AIL', arch: 'twoway', trait: 'travail', path: 'ncaa', num: 7, home: 'Accra' });
var C = g.career, p = BM.cPlayer(g);
assert.strictEqual(g.mode, 'career');
assert.strictEqual(C.phase, 'prospect');
assert(BM.ovr(p) >= 55 && BM.ovr(p) <= 66, 'note de départ : ' + BM.ovr(p));
// Prologue : showcase classé et choix du programme.
assert(C.recruit && C.recruit.offers.length === 3 && C.recruit.rank >= 1, 'offres du showcase');
BM.careerChooseProgram(g, 1);
assert(C.prog && p.college === C.recruit.offers[1].name, 'programme choisi');
console.log('Prospect :', BM.fullName(p), p.pos, 'note', BM.ovr(p), 'pot.', BM.potDisplay(p), '·', p.college, '· showcase #' + C.recruit.rank);

var acts = ['repos', 'shootnight', 'video', 'famille', 'mates', 'media', 'culte', 'perso', 'date', 'charite', 'soiree', 'coachtalk'];
var stats = { days: 0, events: 0, prospectGames: 0, nbaGames: 0, moments: 0, seasons: 0, interviews: 0 };
var draftRes = null, seasonsPlayed = 0, retired = false;

function liveMatch(fx) {
  var m = new BM.Match(g, fx);
  BM.careerSetupMatch(m, g, true);
  var guard = 0;
  while (!m.finished && guard++ < 6000) {
    if (m.halftimePending) m.resumeAfterHalftime();
    if (m.pendingMoment) { m.resolveMoment(g.rng.int(0, m.pendingMoment.choices.length - 1)); stats.moments++; continue; }
    m.step();
  }
  assert(m.finished, 'match terminé');
  BM.applyResult(g, fx, m);
  return m;
}

for (var day = 0; day < 6000 && !retired; day++) {
  stats.days++;
  if (C.today && !C.today.act && !BM.careerIsGameDay(g)) BM.careerDoActivity(g, g.rng.pick(acts));
  if (C.today && C.today.event) { BM.careerResolveEvent(g, 0); stats.events++; }
  if (C.pp >= 30) BM.careerSpendPP(g, g.rng.pick(['tir3', 'defE', 'fin', 'qi']));
  if (C.spOffers.length) BM.careerAcceptSp(g, C.spOffers[0].id);
  var r = BM.careerNext(g);
  if (r.state === 'prospectGame') { BM.careerPlayProspect(g, g.rng.pick(['take', 'team', 'normal'])); stats.prospectGames++; if (C.prospect.games.length === 22) BM.careerCombine(g); continue; }
  if (r.state === 'match') {
    var live = g.rng.chance(0.5);
    if (live) liveMatch(r.fx); else BM.playMatch(g, r.fx);
    stats.nbaGames++;
    if (stats.nbaGames === 1) {
      // Fil social : publication d'après-match avec une cible et un ton.
      assert(g.reply, 'publication proposée après le match');
      assert(BM.socialTargets(g).some(function (t) { return t[0] === 'coach'; }), 'le coach fait partie des cibles');
      var coach0 = C.confCoach, res = BM.socialReply(g, 'coach', 'praise');
      assert(/Publié/.test(res) && C.confCoach >= coach0, 'publication appliquée : ' + res);
    }
    while (C.interview) { BM.careerAnswer(g, 0); stats.interviews++; }
    continue;
  }
  if (r.state === 'draft') {
    draftRes = BM.careerRunDraft(g);
    var team = g.teams[p.teamId];
    console.log('Draft :', draftRes.pick ? 'choix n°' + draftRes.pick : 'non drafté', '→', team.name, '| saison prospect', C.prospect.w + '-' + C.prospect.l, '| moyenne GS', (C.prospect.avg || 0).toFixed(1));
    assert.strictEqual(g.userTeam, p.teamId);
    assert.strictEqual(C.phase, 'nba');
    continue;
  }
  if (r.state === 'seasonEnd') {
    BM.careerSnapshotSeason(g);
    var sum = BM.endSeason(g);
    var out = BM.careerSeasonEnd(g, sum);
    if (C.snap && C.phase === 'nba' && C.seasons.length) {
      var S = C.seasons[C.seasons.length - 1];
      console.log('Saison', S.season, S.teamName, '·', S.status, '·', S.gp, 'm ·', S.pts, 'pts', S.reb, 'reb', S.ast, 'pd · note', S.ovr, '·', S.res, out.awards.length ? '· ' + out.awards.join(', ') : '');
      seasonsPlayed++;
    }
    if (out.fa) { assert(C.offers.length >= 1, 'offres de free agency'); BM.careerSign(g, 0); }
    if (seasonsPlayed >= 4 || out.mustRetire) {
      var leg = BM.careerRetire(g);
      console.log('Retraite à', p.age, 'ans :', leg.tier, '(score ' + leg.sc + ')', '| bagues', C.rings, '| All-Star', C.allStars);
      var offers = BM.careerCoachOffers(g);
      assert(offers.length === 3, 'offres de coach');
      var t = BM.careerBecomeCoach(g, offers[0]);
      console.log('Devient coach des', t.name, '· objectif', BM.OBJECTIVES[g.objective]);
      retired = true;
      break;
    }
    BM.careerSummer(g, g.rng.pick(['shoot', 'body', 'handle', 'def', 'film']));
    continue;
  }
  if (r.state === 'event') { BM.careerResolveEvent(g, 1); continue; }
  assert(r.state === 'ok', 'état inattendu : ' + r.state);
}

assert(draftRes, 'draft atteinte');
assert(retired, 'retraite atteinte');
assert(stats.prospectGames === 25, 'matchs de prospect : ' + stats.prospectGames);
assert(stats.nbaGames > 150, 'matchs NBA joués : ' + stats.nbaGames);
assert(stats.moments > 100, 'moments clés : ' + stats.moments);
console.log('Jours', stats.days, '| événements', stats.events, '| matchs NBA', stats.nbaGames, '| moments', stats.moments, '| interviews', stats.interviews, '| argent', BM.money(C.money), '| followers', BM.fmtN(C.followers));

// Le mode Manager reprend la main : une saison avance sans erreur.
assert.strictEqual(g.mode, 'manager');
var mgr = 0;
for (var d = 0; d < 400; d++) {
  var rr = BM.advance(g);
  if (rr.state === 'match') { BM.playMatch(g, rr.fx); mgr++; continue; }
  if (rr.state !== 'ok') break;
}
assert(mgr >= 10, 'matchs en tant que coach : ' + mgr);
console.log('Coach : ' + mgr + ' matchs dirigés.');
// Héritage : accomplissements, rang, catégories, mémoire de la ligue.
assert(C.legacyPts > 0 && Object.keys(C.ach || {}).length > 0, 'accomplissements débloqués');
assert(C.catLv && Object.keys(C.catLv).length === 4, 'niveaux par catégorie');
var lr = BM.legacyRank(g);
assert(lr.l && lr.score >= 0, 'rang Legacy');
console.log('Héritage : ' + C.legacyPts + ' points, rang ' + lr.l + ' | catégories ' + JSON.stringify(C.catLv) + ' | actualités ' + (g.news || []).length + ' | Hall of Fame ' + (g.hof || []).length);

// Sauvegarde / chargement.
var json = BM.serialize(g);
var g2 = BM.deserialize(json);
assert.strictEqual(g2.career.phase, 'coach');
console.log('Taille de la sauvegarde :', (json.length / 1024).toFixed(0) + ' Ko');
console.log('OK');
