var BM = globalThis.BM = globalThis.BM || {};

// ==================================================================== création de partie
BM.START_DATE = Date.UTC(2026, 8, 1); // 1er septembre 2026
BM.LEAGUE_START = 50;   // début de saison régulière : 21 octobre
BM.ROUND_GAP = 2;       // jours entre deux journées (58 journées)

BM.newGame = function (opts) {
  var g = {
    version: BM.VERSION,
    rng: new BM.RNG(opts.seed || Date.now()),
    nextId: 1, day: 0, season: 1, seasonStart: 0,
    managerName: opts.managerName || 'Coach',
    userTeam: opts.teamId, phase: 'regular',
    players: {}, teams: [], freeAgents: [], fixtures: [], playoffs: null,
    inbox: [], history: [], nextMsgId: 1, gameOver: false, fxId: 1,
    training: { focus: 'equilibre', intensity: 'normale' }
  };
  var byCode = {};
  BM.NBA.teams.forEach(function (t, i) {
    var team = {
      id: i, code: t.code, name: t.city + ' ' + t.nick, city: t.city, nick: t.nick, short: t.short, conf: t.conf, color: t.color, rep: 50,
      roster: [], record: BM.emptyRecord(), cohesion: 55,
      tactics: { pace: 'normal', system: 'pnr', defense: 'drop', starters: [], minutes: {}, roles: {} },
      titles: 0
    };
    byCode[t.code] = team;
    g.teams.push(team);
  });
  BM.NBA.players.forEach(function (d) {
    var team = d.t ? byCode[d.t] : null;
    var p = BM.playerFromData(g, d, team ? team.id : null);
    if (team) team.roster.push(p.id); else g.freeAgents.push(p.id);
  });
  // Effectifs ramenés à 15 joueurs (les surplus deviennent agents libres), complétés à 13 minimum.
  g.teams.forEach(function (t) {
    var r = BM.roster(g, t).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
    r.slice(15).forEach(function (p) { BM.removeFromTeam(g, p); g.freeAgents.push(p.id); });
  });
  BM.updateReputations(g);
  g.teams.forEach(function (t) {
    t.wageBudget = Math.max(BM.SALARY_CAP, Math.round((BM.payroll(g, t) + 2000) / 100) * 100);
    t.balance = Math.round(15000 + t.rep * 200);
    BM.fillRoster(g, t);
    BM.autoTactics(g, t);
    // Chaque club (y compris le vôtre au départ) démarre avec le système qui lui correspond le mieux.
    BM.aiTacticStyle(g, t);
  });
  BM.setObjective(g);
  g.board = { confidence: 60 };
  Object.keys(g.players).forEach(function (id) { g.players[id].seasonStartOvr = BM.ovrRaw(g.players[id]); });
  BM.scheduleSeason(g);
  BM.initScouting(g);
  BM.initEcosystem(g);
  var team = g.teams[g.userTeam];
  BM.addMessage(g, 'Bienvenue à ' + team.name, 'La direction vous souhaite la bienvenue, ' + g.managerName + '.\n\nObjectif fixé : ' +
    BM.OBJECTIVES[g.objective] + '.\n\nMasse salariale : ' + BM.money(BM.payroll(g, team)) + ' (plafond ' + BM.money(team.wageBudget) +
    ', contrats minimum toujours autorisés). Trésorerie : ' + BM.money(team.balance) + '.\n\nLa saison régulière débute le ' + BM.dateLabel(g, BM.LEAGUE_START) + '.', 'board');
  return g;
};

// Réputation déduite de la force de l'effectif (top 8).
BM.teamStrength = function (g, t) {
  var r = BM.roster(g, t).map(function (p) { return BM.ovrRaw(p); }).sort(function (a, b) { return b - a; }).slice(0, 8);
  return r.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, r.length);
};

BM.updateReputations = function (g) {
  var sorted = g.teams.slice().sort(function (a, b) { return BM.teamStrength(g, b) - BM.teamStrength(g, a); });
  sorted.forEach(function (t, i) { t.rep = Math.round(95 - i * 2); });
};

BM.emptyRecord = function () { return { w: 0, l: 0, pf: 0, pa: 0, streak: '' }; };

// Style de jeu de l'IA : système et schéma les mieux adaptés à l'effectif (familiarité comprise).
BM.aiTacticStyle = function (g, team) {
  BM.migrateTactics(g, team);
  team.tactics.roles = {};
  BM.ensureRoles(g, team);
  var t = BM.bestTactic(g, team);
  team.tactics.system = t.system;
  team.tactics.defense = t.defense;
  team.tactics.pace = t.system === 'run' ? 'rapide' : t.system === 'post' || t.system === 'princeton' ? 'lent' : 'normal';
  team.fam = team.fam || { off: {}, def: {} };
  team.fam.off[t.system] = Math.max(team.fam.off[t.system] || 0, 75);
  team.fam.def[t.defense] = Math.max(team.fam.def[t.defense] || 0, 75);
};

// ==================================================================== dates & messages
BM.dateOf = function (g, day) { return new Date(BM.START_DATE + day * 86400000); };
BM.dateLabel = function (g, day) {
  return BM.dateOf(g, day === undefined ? g.day : day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
BM.money = function (k) {
  if (Math.abs(k) >= 1000) return (k / 1000).toFixed(1).replace('.', ',') + ' M$';
  return Math.round(k) + ' k$';
};

BM.addMessage = function (g, title, body, type, actions) {
  g.inbox.unshift({ id: g.nextMsgId++, day: g.day, title: title, body: body, type: type || 'info', actions: actions || null, read: false });
  if (g.inbox.length > 80) g.inbox.length = 80;
};

// ==================================================================== calendrier
BM.scheduleSeason = function (g) {
  var ids = g.rng.shuffle(g.teams.map(function (t) { return t.id; }));
  var n = ids.length, rounds = [];
  for (var r = 0; r < n - 1; r++) {
    var games = [];
    for (var i = 0; i < n / 2; i++) {
      var a = ids[i], b = ids[n - 1 - i];
      games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    ids.splice(1, 0, ids.pop());
  }
  var second = rounds.map(function (gs) { return gs.map(function (m) { return [m[1], m[0]]; }); });
  g.fixtures = [];
  rounds.concat(second).forEach(function (games, r) {
    var day = g.seasonStart + BM.LEAGUE_START + r * BM.ROUND_GAP;
    games.forEach(function (m) {
      g.fixtures.push({ id: g.fxId++, day: day, home: m[0], away: m[1], type: 'league', round: r + 1, played: false });
    });
  });
  g.phase = 'regular';
  g.playoffs = null;
};

BM.fixturesOn = function (g, day) { return g.fixtures.filter(function (f) { return f.day === day; }); };

BM.userFixtureToday = function (g) {
  return g.fixtures.find(function (f) { return f.day === g.day && !f.played && (f.home === g.userTeam || f.away === g.userTeam); }) || null;
};

BM.nextUserFixture = function (g) {
  return g.fixtures.filter(function (f) { return !f.played && (f.home === g.userTeam || f.away === g.userTeam); })
    .sort(function (a, b) { return a.day - b.day; })[0] || null;
};

BM.standings = function (g, conf) {
  return g.teams.filter(function (t) { return !conf || t.conf === conf; }).sort(function (a, b) {
    var ra = a.record, rb = b.record;
    var pa = ra.w / Math.max(1, ra.w + ra.l), pb = rb.w / Math.max(1, rb.w + rb.l);
    if (rb.w !== ra.w) return rb.w - ra.w;
    if (pb !== pa) return pb - pa;
    return (rb.pf - rb.pa) - (ra.pf - ra.pa);
  });
};

// ==================================================================== résultats
BM.playMatch = function (g, fx) {
  var m = new BM.Match(g, fx);
  m.simulateAll();
  BM.applyResult(g, fx, m);
  return m;
};

BM.applyResult = function (g, fx, m) {
  if (fx.played) return;
  fx.played = true;
  fx.hs = m.score[0]; fx.as = m.score[1];
  fx.mvp = m.mvp;
  var home = g.teams[fx.home], away = g.teams[fx.away];
  var winner = fx.hs > fx.as ? home : away, loser = winner === home ? away : home;
  // Feuille de match conservée uniquement pour les rencontres de l'utilisateur : la sauvegarde reste légère.
  var keepBox = fx.home === g.userTeam || fx.away === g.userTeam;
  var box = {};

  // Statistiques individuelles et état physique.
  [0, 1].forEach(function (side) {
    var won = side === (fx.hs > fx.as ? 0 : 1);
    m.roster[side].forEach(function (p) {
      var b = m.box[p.id], r = m.ratings[p.id];
      box[p.id] = { side: side, min: Math.round(b.sec / 60), pts: b.pts, reb: b.oreb + b.dreb, ast: b.ast, stl: b.stl, blk: b.blk, tov: b.tov, pf: b.pf,
        fgm: b.fgm, fga: b.fga, tpm: b.tpm, tpa: b.tpa, ftm: b.ftm, fta: b.fta, pm: b.pm, rtg: r || null };
      if (b.sec > 0 && fx.type === 'league') {
        var s = p.stats;
        s.gp++; s.min += b.sec / 60; s.pts += b.pts; s.reb += b.oreb + b.dreb; s.ast += b.ast; s.stl += b.stl; s.blk += b.blk; s.tov += b.tov;
        s.fgm += b.fgm; s.fga += b.fga; s.tpm += b.tpm; s.tpa += b.tpa; s.ftm += b.ftm; s.fta += b.fta; s.rtg += r || 6;
      }
      if (r) { p.form.push(r); if (p.form.length > 5) p.form.shift(); }
      var min = b.sec / 60;
      // Forme récente (5 derniers matchs) : alimente la gravité.
      if (min > 0) {
        p.recent = p.recent || [];
        p.recent.push({ min: min, pts: b.pts, tpm: b.tpm, tpa: b.tpa, stk: b.stl + b.blk });
        if (p.recent.length > 5) p.recent.shift();
      }
      p.condition = BM.clamp(Math.round(p.condition - 2 - min * 0.4), 30, 100);
      p.morale = BM.clamp(p.morale + (won ? 3 : -3) + (r ? Math.round((r - 6.5) * 1.5) : 0), 0, 100);
      // Un titulaire habituel qui ne joue pas perd du moral.
      if (min < 8 && BM.rankInTeam(g, p) < 7) p.morale = BM.clamp(p.morale - 3, 0, 100);
    });
  });

  if (keepBox) { fx.box = box; fx.why = BM.explainMatch(m, fx.home === g.userTeam ? 0 : 1); }

  if (fx.type === 'league') {
    home.record.pf += fx.hs; home.record.pa += fx.as;
    away.record.pf += fx.as; away.record.pa += fx.hs;
    winner.record.w++; loser.record.l++;
    BM.updateStreak(winner, 'V'); BM.updateStreak(loser, 'D');
  } else if (fx.type === 'playoff') {
    var s = g.playoffs.series.find(function (x) { return x.id === fx.series; });
    if (winner.id === s.a) s.wa++; else s.wb++;
    if (s.wa === s.need) s.winner = s.a;
    if (s.wb === s.need) s.winner = s.b;
  }

  // Recettes de billetterie.
  home.balance += Math.round(home.rep * 20 + 500);

  if (fx.home === g.userTeam || fx.away === g.userTeam) BM.afterUserMatch(g, fx, m);
};

BM.updateStreak = function (team, c) {
  var s = team.record.streak;
  team.record.streak = s.charAt(0) === c ? c + (parseInt(s.slice(1), 10) + 1) : c + '1';
};

BM.rankInTeam = function (g, p) {
  if (p.teamId === null) return 99;
  var r = BM.roster(g, g.teams[p.teamId]).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
  return r.indexOf(p);
};

BM.afterUserMatch = function (g, fx, m) {
  var userSide = fx.home === g.userTeam ? 0 : 1;
  var us = m.score[userSide], them = m.score[1 - userSide];
  var opp = g.teams[userSide === 0 ? fx.away : fx.home];
  var me = g.teams[g.userTeam];
  var won = us > them;
  var delta = won ? 2 : -2;
  if (won && opp.rep > me.rep + 10) delta += 2;
  if (!won && opp.rep < me.rep - 15) delta -= 2;
  if (fx.type === 'playoff') delta *= 2;
  g.board.confidence = BM.clamp(g.board.confidence + delta, 0, 100);
  var mvp = fx.mvp ? g.players[fx.mvp] : null;
  BM.addMessage(g, (won ? 'Victoire' : 'Défaite') + ' contre ' + opp.name + ' (' + us + '-' + them + ')',
    (fx.type === 'playoff' ? 'Playoffs. ' : 'Championnat, journée ' + fx.round + '. ') +
    (mvp ? 'Homme du match : ' + BM.fullName(mvp) + ' (' + g.teams[mvp.teamId].short + ').' : '') +
    (fx.why && fx.why.keys.length ? '\n\n' + (won ? 'Les clés de la victoire' : 'Pourquoi cette défaite') + ' :\n' + fx.why.keys.map(function (k) { return '• ' + k.t; }).join('\n') : ''), 'match');
  // Déclaration fanfaronne d'avant-match : récompensée ou punie selon le résultat.
  if (g.press && g.press.bold) {
    BM.roster(g, me).forEach(function (p) { p.morale = BM.clamp(p.morale + (won ? 2 : -2), 0, 100); });
    if (!won) g.board.confidence = BM.clamp(g.board.confidence - 2, 0, 100);
    g.press = null;
  }
  BM.playingTimeMood(g, me, fx);
  BM.pressConference(g, fx, 'post');
};

// ==================================================================== avancer d'un jour
// Renvoie { state: 'match', fx } si le match de l'utilisateur doit être joué, sinon { state: 'ok' | 'seasonEnd' | 'gameover' }.
BM.advance = function (g) {
  if (g.gameOver) return { state: 'gameover' };
  if (g.phase === 'done') return g.draft && g.draft.done ? { state: 'seasonEnd' } : { state: 'draft' };
  if (g.phase === 'offseason') return { state: 'seasonSummary', summary: g.lastSummary };
  var me = g.teams[g.userTeam];
  if (me.roster.length > BM.ROSTER_MAX) return { state: 'blocked', msg: 'Votre effectif dépasse ' + BM.ROSTER_MAX + ' joueurs. Libérez ou vendez des joueurs.' };
  var ufx = BM.userFixtureToday(g);
  if (ufx) {
    if (BM.availablePlayers(g, me).length < 5) {
      return { state: 'blocked', msg: 'Moins de 5 joueurs disponibles : recrutez un agent libre avant le match.' };
    }
    if (!ufx.pressDone) { ufx.pressDone = true; BM.pressConference(g, ufx, 'pre'); }
    return { state: 'match', fx: ufx };
  }
  BM.fixturesOn(g, g.day).forEach(function (fx) { if (!fx.played) BM.playMatch(g, fx); });
  BM.endDay(g);
  if (g.gameOver) return { state: 'gameover' };
  if (g.phase === 'done') return { state: 'seasonEnd' };
  return { state: 'ok' };
};

BM.endDay = function (g) {
  var hadMatch = {};
  BM.fixturesOn(g, g.day).forEach(function (f) { hadMatch[f.home] = hadMatch[f.away] = true; });
  g.teams.forEach(function (t) {
    var plan = t.id === g.userTeam ? g.training : { focus: 'equilibre', intensity: hadMatch[t.id] ? 'faible' : 'normale' };
    BM.train(g, t, plan, hadMatch[t.id]);
  });
  // Agents libres : maintien de la forme.
  g.freeAgents.forEach(function (id) { var p = g.players[id]; p.condition = Math.min(100, p.condition + 5); if (p.injury > 0) p.injury--; });

  BM.progressPhase(g);
  BM.aiTransfers(g);
  BM.transferOffers(g);
  BM.scoutDaily(g);
  BM.ecoDaily(g);

  // Fin de mois : sponsors et salaires.
  var date = BM.dateOf(g, g.day + 1);
  if (date.getUTCDate() === 1) {
    g.teams.forEach(function (t) {
      t.balance += Math.round(t.wageBudget / 12 - BM.payroll(g, t) / 12);
    });
    g.teams[g.userTeam].balance -= Math.round(BM.staffPayroll(g) / 12);
    var me = g.teams[g.userTeam];
    BM.addMessage(g, 'Point financier mensuel', 'Solde : ' + BM.money(me.balance) + '. Masse salariale : ' + BM.money(BM.payroll(g, me)) + ' / ' + BM.money(me.wageBudget) + ' par saison.', 'finance');
  }

  if (g.board.confidence < 12 && !g.gameOver) {
    g.gameOver = true;
    BM.addMessage(g, 'Licenciement', 'La direction a perdu confiance et met fin à votre contrat.', 'board');
  } else if (g.board.confidence < 25 && g.rng.chance(0.05)) {
    BM.addMessage(g, 'Avertissement de la direction', 'Les résultats actuels inquiètent la direction. Votre poste est menacé.', 'board');
  }
  g.day++;
};

// ==================================================================== entraînement
// Inspiré des bandes de progression de FM26 : plus l'écart au potentiel est grand, plus la chance de progresser est élevée.
BM.train = function (g, team, plan, matchDay) {
  var rng = g.rng;
  var focus = BM.TRAINING.focus.find(function (f) { return f.v === plan.focus; }) || BM.TRAINING.focus[0];
  var inten = BM.TRAINING.intensity.find(function (i) { return i.v === plan.intensity; }) || BM.TRAINING.intensity[1];
  var rest = focus.v === 'repos';
  BM.roster(g, team).forEach(function (p) {
    if (p.injury > 0) {
      p.injury--;
      if (p.injury === 0 && team.id === g.userTeam) BM.addMessage(g, BM.fullName(p) + ' est rétabli', 'Il est de nouveau disponible pour la sélection.', 'medical');
      p.condition = Math.min(100, p.condition + 4);
      return;
    }
    var rec = matchDay ? 6 : rest ? 16 : inten.rec;
    p.condition = Math.min(100, Math.round(p.condition + rec + p.attrs.end / 20 * 3));
    if (rest) { p.morale = Math.min(100, p.morale + 1); }
    // Moral : retour lent vers 65.
    p.morale += p.morale > 65 ? -0.5 : 0.5;
    p.morale = Math.round(BM.clamp(p.morale, 0, 100) * 2) / 2;
    if (rest || matchDay) return;

    BM.devProgress(g, team, p, focus.attrs, inten);
    if (p.age >= 31 && rng.chance(0.004 * (p.age - 30))) {
      var k = rng.pick(['vit', 'det', 'end', 'for']);
      p.attrs[k] = Math.max(1, p.attrs[k] - 1);
    }
    var injP = 0.0009 * inten.inj * (p.condition < 60 ? 2 : 1) * BM.staffBonus(g, team, 'med');
    if (rng.chance(injP)) {
      p.injury = rng.int(3, 21);
      if (team.id === g.userTeam) BM.addMessage(g, 'Blessure : ' + BM.fullName(p), 'Blessé à l\'entraînement, indisponible environ ' + p.injury + ' jours.', 'medical');
    }
  });
  BM.devDaily(g, team, matchDay);
  BM.growFamiliarity(team, (matchDay ? 0.8 : rest ? 0 : focus.v === 'tactique' ? 1.6 : 0.5) * BM.staffBonus(g, team, 'tac'));
  if (!rest && !matchDay && focus.v === 'tactique') team.cohesion = Math.min(100, team.cohesion + 1.5);
  else if (!matchDay) team.cohesion = Math.min(100, team.cohesion + 0.3);
};

BM.improve = function (g, p, keys) {
  var w = BM.POS_WEIGHTS[p.pos];
  var pool = (keys || BM.ATTRS.map(function (a) { return a.k; })).filter(function (k) { return p.attrs[k] < 20; });
  if (!pool.length) return;
  var k = g.rng.weighted(pool, function (k) { return ((w[k] || 0.3) + 0.2) * (21 - p.attrs[k]); });
  p.attrs[k]++;
  p.lastProgress = { k: k, day: g.day };
};

// ==================================================================== phases de la saison
BM.progressPhase = function (g) {
  if (g.phase === 'regular') {
    var left = g.fixtures.some(function (f) { return f.type === 'league' && !f.played; });
    if (!left) BM.startPlayoffs(g);
  } else if (g.phase === 'playoffs') {
    var po = g.playoffs, cur = po.series.filter(function (s) { return s.round === po.round; });
    cur.forEach(function (s) {
      if (s.winner !== undefined) return;
      var pending = g.fixtures.some(function (f) { return f.series === s.id && !f.played; });
      if (!pending) BM.scheduleSeriesGame(g, s, g.day + 2);
    });
    if (cur.every(function (s) { return s.winner !== undefined; })) {
      if (po.round === 4) {
        var cid = cur[0].winner, champ = g.teams[cid];
        po.champion = cid;
        champ.titles++;
        g.phase = 'done';
        BM.addMessage(g, champ.name + ' champion !', champ.id === g.userTeam ? 'Félicitations, vous remportez le titre !' : champ.name + ' remporte le titre.', 'board');
      } else if (po.round === 3) {
        po.round = 4;
        var st = BM.standings(g);
        var e = cur.find(function (x) { return x.conf === 'E'; }).winner, w = cur.find(function (x) { return x.conf === 'W'; }).winner;
        var better = st.findIndex(function (t) { return t.id === e; }) < st.findIndex(function (t) { return t.id === w; });
        BM.createSeries(g, better ? e : w, better ? w : e, 4, g.day + 3, null);
      } else {
        po.round++;
        ['E', 'W'].forEach(function (c) {
          var ws = cur.filter(function (x) { return x.conf === c; }).map(function (x) { return x.winner; });
          for (var i = 0; i < ws.length; i += 2) BM.createSeries(g, ws[i], ws[i + 1], po.round, g.day + 3, c);
        });
      }
    }
  }
};

// Playoffs : 8 qualifiés par conférence. Séries au meilleur des 5 matchs, finale au meilleur des 7.
BM.startPlayoffs = function (g) {
  g.finalStandings = BM.standings(g).map(function (t) { return t.id; });
  g.phase = 'playoffs';
  g.playoffs = { round: 1, series: [], seeds: {} };
  var pairs = [[0, 7], [3, 4], [1, 6], [2, 5]], me = g.userTeam, myConf = g.teams[me].conf, mySeed = -1;
  ['E', 'W'].forEach(function (c) {
    var s = BM.standings(g, c).slice(0, 8).map(function (t) { return t.id; });
    g.playoffs.seeds[c] = s;
    if (c === myConf) mySeed = s.indexOf(me);
    pairs.forEach(function (pr) { BM.createSeries(g, s[pr[0]], s[pr[1]], 1, g.day + 3, c); });
  });
  var confPos = BM.standings(g, myConf).findIndex(function (t) { return t.id === me; }) + 1;
  BM.addMessage(g, 'Fin de la saison régulière', mySeed >= 0 ? 'Votre équipe termine ' + confPos + 'e de la ' + BM.CONFERENCES[myConf] + ' et dispute les playoffs.' :
    'Votre équipe termine ' + confPos + 'e de la ' + BM.CONFERENCES[myConf] + ' et ne dispute pas les playoffs.', 'board');
};

BM.createSeries = function (g, a, b, round, day, conf) {
  var s = { id: g.playoffs.series.length + 1, a: a, b: b, wa: 0, wb: 0, round: round, conf: conf, need: round === 4 ? 4 : 3 };
  g.playoffs.series.push(s);
  BM.scheduleSeriesGame(g, s, day);
};

// Format 2-2-1 (2-2-1-1-1 en finale) : la meilleure tête de série (a) reçoit les matchs 1, 2, 5 et 7.
BM.scheduleSeriesGame = function (g, s, day) {
  var n = s.wa + s.wb + 1;
  var home = [1, 2, 5, 7].indexOf(n) >= 0 ? s.a : s.b, away = home === s.a ? s.b : s.a;
  g.fixtures.push({ id: g.fxId++, day: day, home: home, away: away, type: 'playoff', series: s.id, round: s.round, game: n, played: false });
};

BM.ROUND_NAMES = { 1: 'Premier tour', 2: 'Demi-finales de conférence', 3: 'Finales de conférence', 4: 'Finales' };

// ==================================================================== fin de saison
BM.endSeason = function (g) {
  var me = g.teams[g.userTeam], summary = { season: g.season };
  g.phase = 'offseason';
  g.lastSummary = summary;
  var finalPos = g.finalStandings.indexOf(g.userTeam) + 1;
  var po = g.playoffs, reached = 0;
  po.series.forEach(function (s) { if (s.a === g.userTeam || s.b === g.userTeam) reached = Math.max(reached, s.round); });
  var champion = po.champion === g.userTeam;
  var met = { titre: champion, demi: reached >= 3, playoffs: reached >= 1, maintien: finalPos <= g.teams.length - 5 }[g.objective];
  summary.finalPos = finalPos; summary.champion = g.teams[po.champion].name; summary.objective = BM.OBJECTIVES[g.objective]; summary.met = met;
  g.board.confidence = BM.clamp(g.board.confidence + (met ? 20 : -25) + (champion ? 15 : 0), 0, 100);

  // Trophées NBA (avant la remise à zéro des statistiques).
  summary.awards = BM.seasonAwards(g);
  summary.mvp = summary.awards.MVP || '-';
  g.history.push({ season: g.season, champion: po.champion, pos: finalPos, reached: reached, mvp: summary.mvp });

  if (g.board.confidence < 15) {
    g.gameOver = true;
    summary.fired = true;
    return summary;
  }

  // Vieillissement, carrière, contrats.
  var leaving = [];
  Object.keys(g.players).forEach(function (id) {
    var p = g.players[id];
    if (p.stats.gp) p.career.push({ season: g.season, team: p.teamId === null ? '-' : g.teams[p.teamId].short, gp: p.stats.gp, pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast });
    p.stats = BM.emptyStats(); p.form = [];
    p.age++;
    if (p.age >= 30) {
      ['vit', 'det', 'end'].forEach(function (k) { if (g.rng.chance(0.25 + (p.age - 30) * 0.08)) p.attrs[k] = Math.max(1, p.attrs[k] - 1); });
    }
    if (p.age <= 24 && p.pot > BM.ovrRaw(p)) BM.improve(g, p, null);
    if (p.teamId !== null) {
      p.contract.years--;
      if (p.contract.years <= 0) leaving.push(p);
    }
    p.condition = 100; p.injury = Math.max(0, p.injury - 30); p.listed = false;
  });

  var departures = [];
  leaving.forEach(function (p) {
    var team = g.teams[p.teamId];
    var keep = p.teamId !== g.userTeam && p.age < 34 && g.rng.chance(0.65);
    if (keep) { p.contract = { salary: BM.askingSalary(p), years: g.rng.int(1, 3) }; return; }
    if (p.age >= 35 || (p.age >= 33 && g.rng.chance(0.5))) {
      BM.removeFromTeam(g, p); p.retired = true;
      if (team.id === g.userTeam) departures.push(BM.fullName(p) + ' (retraite)');
      return;
    }
    BM.removeFromTeam(g, p);
    p.contract = { salary: BM.askingSalary(p), years: g.rng.int(1, 3) };
    g.freeAgents.push(p.id);
    if (team.id === g.userTeam) departures.push(BM.fullName(p) + ' (fin de contrat)');
  });
  summary.departures = departures;

  // Retraite des agents libres âgés.
  g.freeAgents = g.freeAgents.filter(function (id) { var p = g.players[id]; if (p.age >= 35) { p.retired = true; return false; } return true; });

  // Draft : les choix de l'utilisateur ; sans draft jouée (anciennes sauvegardes), deux espoirs générés par club.
  var prospects = (g.draft && g.draft.picks || []).filter(function (x) { return x.team === g.userTeam; }).map(function (x) {
    var p = g.players[x.pid];
    return 'Choix n°' + x.pick + ' : ' + BM.fullName(p) + ' (' + p.pos + ', pot. ' + BM.potDisplay(p) + ')';
  });
  if (!g.draft || !g.draft.done) g.teams.forEach(function (t) {
    for (var k = 0; k < 2; k++) {
      var p = BM.genPlayer(g, { quality: (k === 0 ? 9 : 7.5) + (100 - t.rep) / 100 * 2 + g.rng.range(-1.5, 1.5), age: g.rng.int(19, 21), teamId: t.id, years: k === 0 ? 4 : 2 });
      p.contract.salary = k === 0 ? Math.round(g.rng.range(2500, 9000) / 50) * 50 : 1300;
      p.rookie = true;
      t.roster.push(p.id);
      if (t.id === g.userTeam) prospects.push(BM.fullName(p) + ' (' + p.pos + ', pot. ' + BM.potDisplay(p) + ')');
    }
  });
  summary.prospects = prospects;

  // Nouveaux agents libres pour garder un marché vivant.
  for (var f = 0; f < 10; f++) {
    var fa = BM.genPlayer(g, { quality: g.rng.range(7, 11), teamId: null, years: g.rng.int(1, 3) });
    g.freeAgents.push(fa.id);
  }

  // Réputation : moitié force de l'effectif, moitié classement.
  var st = g.finalStandings;
  BM.updateReputations(g);
  g.teams.forEach(function (t) {
    var pos = st.indexOf(t.id);
    t.rep = BM.clamp(Math.round((t.rep + (95 - pos * 2)) / 2 + (po.champion === t.id ? 3 : 0)), 30, 99);
    t.record = BM.emptyRecord();
    t.cohesion = Math.max(35, t.cohesion - 15);
    t.wageBudget = Math.max(BM.SALARY_CAP, Math.round((BM.payroll(g, t) + 2000) / 100) * 100);
    if (t.id !== g.userTeam) {
      while (t.roster.length > 15) {
        var worst = BM.roster(g, t).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
        BM.removeFromTeam(g, worst); g.freeAgents.push(worst.id);
      }
    }
  });
  return summary;
};

BM.startNewSeason = function (g) {
  g.season++;
  // Chaque saison commence le 1er septembre ; l'intersaison est sautée.
  var sept = Math.round((Date.UTC(2026 + g.season - 1, 8, 1) - BM.START_DATE) / 86400000);
  g.seasonStart = Math.max(g.day + 4, sept);
  g.day = g.seasonStart;
  g.fixtures = [];
  BM.setObjective(g);
  BM.scheduleSeason(g);
  g.teams.forEach(function (t) {
    BM.fillRoster(g, t);
    if (t.id !== g.userTeam) { BM.autoTactics(g, t); BM.aiTacticStyle(g, t); }
    else BM.cleanTactics(g, t);
  });
  Object.keys(g.players).forEach(function (id) { g.players[id].seasonStartOvr = BM.ovrRaw(g.players[id]); });
  g.draft = null;
  BM.genDraftClass(g);
  BM.initEcosystem(g);
  g.teams.forEach(function (t) { BM.assignStatuses(g, t); });
  BM.refreshStaffPool(g);
  BM.addMessage(g, 'Saison ' + g.season + ' : nouvel objectif', 'La direction attend de vous : ' + BM.OBJECTIVES[g.objective] + '.', 'board');
};

BM.setObjective = function (g) {
  var byRep = g.teams.slice().sort(function (a, b) { return b.rep - a.rep; });
  var rank = byRep.findIndex(function (t) { return t.id === g.userTeam; }) + 1;
  g.objective = rank <= 3 ? 'titre' : rank <= 8 ? 'demi' : rank <= 16 ? 'playoffs' : 'maintien';
};

// Retire des tactiques de l'utilisateur les joueurs qui ne sont plus dans l'effectif.
BM.cleanTactics = function (g, team) {
  var ids = {};
  team.roster.forEach(function (id) { ids[id] = 1; });
  team.tactics.starters = (team.tactics.starters || []).filter(function (id) { return ids[id]; });
  var m = {};
  Object.keys(team.tactics.minutes || {}).forEach(function (id) { if (ids[id]) m[id] = team.tactics.minutes[id]; });
  team.tactics.minutes = m;
};

// ==================================================================== mercato
BM.removeFromTeam = function (g, p) {
  if (p.teamId === null) return;
  var t = g.teams[p.teamId];
  t.roster = t.roster.filter(function (id) { return id !== p.id; });
  if (t.tactics.minutes) delete t.tactics.minutes[p.id];
  t.tactics.starters = (t.tactics.starters || []).filter(function (id) { return id !== p.id; });
  p.teamId = null;
  p.listed = false;
};

BM.addToTeam = function (g, p, team) {
  g.freeAgents = g.freeAgents.filter(function (id) { return id !== p.id; });
  if (p.teamId !== null) BM.removeFromTeam(g, p);
  p.teamId = team.id;
  team.roster.push(p.id);
  team.tactics.roles = team.tactics.roles || {};
  team.tactics.roles[p.id] = BM.bestRole(p);
  if (team.id === g.userTeam) team.tactics.minutes[p.id] = team.tactics.minutes[p.id] || 0;
  else BM.autoTactics(g, team);
};

BM.fillRoster = function (g, team) {
  if (team.id === g.userTeam) return;
  while (team.roster.length < BM.ROSTER_MIN && g.freeAgents.length) {
    var room = Math.max(team.wageBudget - BM.payroll(g, team), BM.MIN_EXCEPTION);
    var cands = g.freeAgents.map(function (id) { return g.players[id]; })
      .filter(function (p) { return p.injury <= 0; })
      .sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
    var p = cands[0] || g.players[g.freeAgents[0]];
    p.contract.salary = Math.min(BM.askingSalary(p), room);
    p.contract.years = Math.max(1, p.contract.years);
    BM.addToTeam(g, p, team);
  }
};

BM.aiTransfers = function (g) {
  g.teams.forEach(function (t) {
    if (t.id !== g.userTeam && t.roster.length < BM.ROSTER_MIN) BM.fillRoster(g, t);
    if (t.id !== g.userTeam && t.roster.length < 15 && BM.availablePlayers(g, t).length < 10 && g.freeAgents.length) {
      var p = g.players[g.freeAgents[0]];
      BM.addToTeam(g, p, t);
    }
  });
};

// Probabilité qu'un joueur accepte de rejoindre l'équipe de l'utilisateur.
BM.interest = function (g, p, team) {
  var o = BM.ovrRaw(p);
  return BM.clamp(0.55 + (team.rep - 50) / 90 - (o - 12) * 0.04 + (p.teamId === null ? 0.1 : 0), 0.05, 0.98);
};

BM.offerContract = function (g, pid, salary, years, fee) {
  var p = g.players[pid], me = g.teams[g.userTeam];
  fee = fee || 0;
  if (p.teamId === g.userTeam) return { ok: false, msg: 'Ce joueur est déjà dans votre effectif.' };
  if (me.roster.length >= BM.ROSTER_MAX) return { ok: false, msg: 'Effectif complet (' + BM.ROSTER_MAX + ' joueurs max).' };
  if (salary > BM.MIN_EXCEPTION && BM.payroll(g, me) + salary > me.wageBudget) return { ok: false, msg: 'Dépassement du plafond salarial (' + BM.money(me.wageBudget) + '). Seuls les contrats ≤ ' + BM.money(BM.MIN_EXCEPTION) + ' restent possibles.' };
  if (fee > me.balance) return { ok: false, msg: 'Budget transferts insuffisant (' + BM.money(me.balance) + ').' };
  if (p.teamId !== null) {
    var seller = g.teams[p.teamId], value = BM.playerValue(p);
    var keyPlayer = BM.rankInTeam(g, p) < 3 ? 1.35 : 1;
    if (seller.roster.length <= BM.ROSTER_MIN - 1) return { ok: false, msg: seller.name + ' refuse : effectif trop court.' };
    if (fee < value * keyPlayer * (p.listed ? 0.8 : 1)) return { ok: false, msg: seller.name + ' refuse l\'offre. Ils attendent environ ' + BM.money(Math.round(value * keyPlayer * (p.listed ? 0.8 : 1) / 50) * 50) + '.' };
  }
  var asking = BM.askingSalary(p), interest = BM.interest(g, p, me);
  var needed = asking * (1.15 - interest * 0.3) * (years >= 3 && p.age >= 30 ? 0.92 : 1);
  if (salary < needed) {
    // Le refus reste déterministe pour éviter de "relancer les dés" avec la même offre.
    return { ok: false, msg: BM.fullName(p) + ' refuse. Son agent réclame au moins ' + BM.money(Math.ceil(needed / 50) * 50) + ' par saison.' };
  }
  var sellerId = p.teamId;
  if (sellerId !== null) {
    g.teams[sellerId].balance += fee;
    me.balance -= fee;
  }
  p.contract = { salary: salary, years: years };
  p.morale = Math.min(100, p.morale + 10);
  BM.addToTeam(g, p, me);
  BM.assignPersona(g, p);
  BM.assignStatuses(g, me);
  if (sellerId !== null) BM.fillRoster(g, g.teams[sellerId]);
  BM.addMessage(g, 'Signature : ' + BM.fullName(p), BM.fullName(p) + ' s\'engage pour ' + years + ' saison(s) à ' + BM.money(salary) + ' par an' + (fee ? ', indemnité ' + BM.money(fee) : '') + '.', 'transfer');
  return { ok: true, msg: BM.fullName(p) + ' a signé !' };
};

BM.releasePlayer = function (g, pid) {
  var p = g.players[pid], me = g.teams[g.userTeam];
  var cost = Math.round(p.contract.salary * p.contract.years * 0.5);
  me.balance -= cost;
  BM.removeFromTeam(g, p);
  p.contract = { salary: BM.askingSalary(p), years: g.rng.int(1, 2) };
  g.freeAgents.push(p.id);
  BM.addMessage(g, 'Départ : ' + BM.fullName(p), 'Contrat résilié. Indemnité versée : ' + BM.money(cost) + '.', 'transfer');
  return cost;
};

BM.extendContract = function (g, pid, salary, years) {
  var p = g.players[pid], me = g.teams[g.userTeam];
  var asking = BM.askingSalary(p);
  var needed = asking * (1.05 - (p.morale - 50) / 250);
  if (salary > p.contract.salary && BM.payroll(g, me) - p.contract.salary + salary > me.wageBudget) return { ok: false, msg: 'Dépassement de la masse salariale autorisée.' };
  if (salary < needed) return { ok: false, msg: BM.fullName(p) + ' refuse et réclame au moins ' + BM.money(Math.ceil(needed / 50) * 50) + ' par saison.' };
  p.contract = { salary: salary, years: years };
  p.morale = Math.min(100, p.morale + 5);
  return { ok: true, msg: BM.fullName(p) + ' prolonge de ' + years + ' saison(s).' };
};

// Offres de l'IA pour les joueurs placés sur la liste des transferts.
BM.transferOffers = function (g) {
  var me = g.teams[g.userTeam];
  BM.roster(g, me).forEach(function (p) {
    if (!p.listed || !g.rng.chance(0.06)) return;
    var buyers = g.teams.filter(function (t) { return t.id !== g.userTeam && t.roster.length < BM.ROSTER_MAX && t.balance > 1000; });
    if (!buyers.length) return;
    var b = g.rng.pick(buyers), fee = Math.round(BM.playerValue(p) * g.rng.range(0.7, 1.15) / 50) * 50;
    if (fee > b.balance) fee = Math.round(b.balance * 0.9 / 50) * 50;
    if (fee <= 0) return;
    BM.addMessage(g, 'Offre de ' + b.name + ' pour ' + BM.fullName(p), b.name + ' propose ' + BM.money(fee) + ' pour racheter le contrat de ' + BM.fullName(p) + '.', 'transfer',
      [{ label: 'Accepter', act: 'sell', pid: p.id, team: b.id, fee: fee }, { label: 'Refuser', act: 'decline' }]);
  });
};

BM.handleMessageAction = function (g, msgId, idx) {
  var m = g.inbox.find(function (x) { return x.id === msgId; });
  if (!m || !m.actions) return 'Action expirée.';
  var a = m.actions[idx];
  m.actions = null;
  if (a.act === 'decline') { m.resolved = 'Offre refusée.'; return m.resolved; }
  if (a.act === 'press') { m.resolved = 'Votre réponse : « ' + a.label + ' » — ' + BM.pressAnswer(g, a); return m.resolved; }
  if (a.act === 'talk') { m.resolved = BM.interact(g, a.pid, a.kind); return m.resolved; }
  if (a.act === 'sell') {
    var p = g.players[a.pid], buyer = g.teams[a.team];
    if (p.teamId !== g.userTeam) { m.resolved = 'Le joueur n\'est plus dans votre effectif.'; return m.resolved; }
    if (buyer.balance < a.fee || buyer.roster.length >= BM.ROSTER_MAX) { m.resolved = buyer.name + ' a retiré son offre.'; return m.resolved; }
    buyer.balance -= a.fee;
    g.teams[g.userTeam].balance += a.fee;
    BM.addToTeam(g, p, buyer);
    p.contract.years = Math.max(p.contract.years, 2);
    m.resolved = BM.fullName(p) + ' rejoint ' + buyer.name + ' pour ' + BM.money(a.fee) + '.';
    return m.resolved;
  }
  return '';
};

// ==================================================================== statistiques
BM.leaders = function (g, key, n) {
  return Object.keys(g.players).map(function (id) { return g.players[id]; })
    .filter(function (p) { return p.teamId !== null && p.stats.gp >= 3; })
    .sort(function (a, b) { return b.stats[key] / b.stats.gp - a.stats[key] / a.stats.gp; })
    .slice(0, n || 10);
};

// ==================================================================== sauvegarde
BM.serialize = function (g) { return JSON.stringify(g); };

BM.deserialize = function (json) {
  var g = JSON.parse(json);
  if (!g || !g.teams || !g.players) throw new Error('Sauvegarde invalide');
  g.rng = new BM.RNG(g.rng.s);
  g.teams.forEach(function (t) { BM.migrateTactics(g, t); });
  Object.keys(g.players).forEach(function (id) { var p = g.players[id]; if (p.seasonStartOvr === undefined) p.seasonStartOvr = BM.ovrRaw(p); });
  BM.initScouting(g);
  BM.initEcosystem(g);
  // Migration : feuilles de match des rencontres IA supprimées (v1.7).
  g.fixtures.forEach(function (f) { if (f.box && f.home !== g.userTeam && f.away !== g.userTeam) delete f.box; });
  // Migration : abréviations par surnom d'équipe (WAR, THU...).
  if (BM.NBA) g.teams.forEach(function (t) {
    var d = BM.NBA.teams.find(function (x) { return x.code === t.code; });
    if (d) t.short = d.short;
  });
  return g;
};
