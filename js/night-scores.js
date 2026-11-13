var BM = globalThis.BM = globalThis.BM || {};

// ==================================================================== v2.1 — Panneau "Scores de la nuit"
// Simule les autres matchs de la journée juste après celui de l'utilisateur,
// puis expose une sélection triée par "intérêt" (upset, OT, perf individuelle, rivalité, division).
// L'affichage se fait côté ui.js (UI.nightScoresHtml).
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // Simule toutes les fixtures de la journée courante qui ne sont pas encore jouées,
  // sauf celle de l'utilisateur (qui vient d'être jouée). Idempotent.
  BM.simulateOtherFixturesOfDay = function (g) {
    var todays = BM.fixturesOn(g, g.day);
    var simed = 0;
    todays.forEach(function (fx) {
      if (fx.played) return;
      if (fx.home === g.userTeam || fx.away === g.userTeam) return;
      BM.playMatch(g, fx);
      simed++;
    });
    return simed;
  };

  // Score d'intérêt d'un match (pour le tri et la sélection).
  // Critères : upset, OT, écart serré, perf individuelle, rivalité, implication du rival direct.
  var interestScore = function (g, f) {
    var home = g.teams[f.home], away = g.teams[f.away];
    var diff = Math.abs(f.hs - f.as);
    var homeWP = (home.record.w + home.record.l) ? home.record.w / (home.record.w + home.record.l) : 0.5;
    var awayWP = (away.record.w + away.record.l) ? away.record.w / (away.record.w + away.record.l) : 0.5;
    var homeWon = f.hs > f.as;
    var upset = (homeWon && awayWP - homeWP > 0.15) || (!homeWon && homeWP - awayWP > 0.15);
    var rival = BM.isRivalry ? BM.isRivalry(g, f.home, f.away) : false;
    var heat = BM.rivalryHeat ? BM.rivalryHeat(g, f.home, f.away) : 0;
    var s = 0;
    if (f.overtime) s += 25;       // match en OT = excitant
    if (diff <= 3) s += 18;         // buzzer beater potentiel
    else if (diff <= 6) s += 8;
    if (upset) s += 30;             // upset = gros
    if (rival) s += 15 + heat * 0.2; // rivalité = follow
    // Perf individuelle (MVP du match)
    var mvp = f.mvp ? g.players[f.mvp] : null;
    if (mvp && f.mvpBox) {
      if (f.mvpBox.pts >= 50) s += 35;
      else if (f.mvpBox.pts >= 40) s += 22;
      else if (f.mvpBox.pts >= 30) s += 8;
    }
    // Implication division/conférence de l'utilisateur
    if (home.conf === g.teams[g.userTeam].conf || away.conf === g.teams[g.userTeam].conf) s += 6;
    // Rival direct de l'utilisateur qui joue → important pour le classement
    var userRival = BM.rivalryOf ? BM.rivalryOf(g, g.userTeam) : null;
    if (userRival && (f.home === userRival.a || f.away === userRival.a || f.home === userRival.b || f.away === userRival.b)) s += 12;
    return Math.round(s);
  };

  // Renvoie une sélection de matchs marquants (entre 5 et 7), triés par intérêt décroissant.
  // Inclut toujours : (a) les upsets, (b) les OT, (c) les matchs impliquant un rival de l'utilisateur,
  // (d) les matchs de la division/conférence de l'utilisateur.
  // Le paramètre userFx permet d'exclure le match de l'utilisateur.
  BM.nightScores = function (g, userFx) {
    // S'assurer que les autres matchs sont simulés avant de les présenter.
    if (BM.simulateOtherFixturesOfDay) BM.simulateOtherFixturesOfDay(g);
    var todays = BM.fixturesOn(g, g.day).filter(function (f) {
      return f.played && (!userFx || f.id !== userFx.id);
    });
    var userRival = BM.rivalryOf ? BM.rivalryOf(g, g.userTeam) : null;
    var enriched = todays.map(function (f) {
      var home = g.teams[f.home], away = g.teams[f.away];
      var homeWon = f.hs > f.as;
      var homeWP = (home.record.w + home.record.l) ? home.record.w / (home.record.w + home.record.l) : 0;
      var awayWP = (away.record.w + away.record.l) ? away.record.w / (away.record.w + away.record.l) : 0;
      var upset = (homeWon && awayWP - homeWP > 0.15) || (!homeWon && homeWP - awayWP > 0.15);
      var rival = BM.isRivalry ? BM.isRivalry(g, f.home, f.away) : false;
      var heat = BM.rivalryHeat ? BM.rivalryHeat(g, f.home, f.away) : 0;
      var mvp = f.mvp ? g.players[f.mvp] : null;
      var isUserRival = userRival && (f.home === userRival.a || f.away === userRival.a || f.home === userRival.b || f.away === userRival.b);
      var userRivalLost = false;
      if (isUserRival) {
        var rivalTeamId = (f.home === userRival.a || f.home === userRival.b) ? f.home : f.away;
        var rivalWon = (rivalTeamId === f.home && homeWon) || (rivalTeamId === f.away && !homeWon);
        userRivalLost = !rivalWon;
      }
      return {
        fx: f,
        home: home, away: away, homeWon: homeWon,
        score: interestScore(g, f),
        upset: upset, ot: !!f.overtime, rival: rival, heat: heat,
        mvp: mvp, mvpBox: f.mvpBox,
        isUserRival: !!isUserRival, userRivalLost: userRivalLost,
        inUserConf: home.conf === g.teams[g.userTeam].conf || away.conf === g.teams[g.userTeam].conf
      };
    });
    enriched.sort(function (a, b) { return b.score - a.score; });
    // Toujours inclure les upsets, OT et matchs de rivalité de l'utilisateur, puis compléter.
    var mustInclude = enriched.filter(function (x) { return x.upset || x.ot || x.isUserRival; });
    var rest = enriched.filter(function (x) { return !(x.upset || x.ot || x.isUserRival); });
    var picked = mustInclude.concat(rest).slice(0, 7);
    // Tri final par score décroissant
    picked.sort(function (a, b) { return b.score - a.score; });
    return picked;
  };

  // Wrap BM.afterUserMatch pour pré-simuler les autres matchs juste après le match de l'utilisateur.
  // (Le panneau est rendu côté UI quand le modal de résultat se ferme.)
  var legacyAfterUserMatch = BM.afterUserMatch;
  if (legacyAfterUserMatch) {
    BM.afterUserMatch = function (g, fx, m) {
      legacyAfterUserMatch(g, fx, m);
      // Pré-simule les autres matchs de la journée pour pouvoir afficher le panneau "Scores de la nuit".
      if (BM.simulateOtherFixturesOfDay) BM.simulateOtherFixturesOfDay(g);
      // Stocke la sélection prête à l'emploi pour l'UI.
      g.lastNightScores = { day: g.day, fxId: fx.id, items: BM.nightScores(g, fx) };
    };
  }
})();
