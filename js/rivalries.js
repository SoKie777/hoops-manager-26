var BM = globalThis.BM = globalThis.BM || {};

// ==================================================================== v2.1 — Système de Rivalités
// Établit des dynamiques durables entre franchises : derbies historiques, rivalités récentes
// (playoffs l'an dernier, trade piquant), émergentes (deux matchs serrés cette saison).
// La "heat" (0-100) mesure l'intensité ; elle monte sur les incidents et décline lentement
// hors playoffs. Au-dessus de 60, le feed s'enflamme ; 80, le coach adverse te taunt ;
// 90, un badge "RIVALRY GAME" apparaît dans le scorebug.
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var KEY = function (a, b) { return a < b ? a + '-' + b : b + '-' + a; };

  // 10 paires historiques (index 0-29 dans BM.NBA.teams).
  // base = heat de départ (35-55), label = nom commercial optionnel.
  BM.RIVALRIES_SEED = [
    { a: 1,  b: 20, base: 55, kind: 'historique', label: 'Brazzaville vs Lagos' },     // BOS-LAL
    { a: 10, b: 12, base: 48, kind: 'historique', label: 'Atlantic feud' },              // NYK-PHI
    { a: 4,  b: 8,  base: 45, kind: 'historique', label: 'Le Caire vs Marrakech' },      // CHI-MIA
    { a: 17, b: 5,  base: 50, kind: 'historique', label: 'Yamoussoukro vs Conakry' },   // GSW-CLE
    { a: 28, b: 3,  base: 47, kind: 'historique', label: 'Dakar vs Casablanca' },        // SAS-CHO
    { a: 19, b: 20, base: 52, kind: 'historique', label: 'Battle of Lagos' },           // LAC-LAL
    { a: 24, b: 17, base: 46, kind: 'historique', label: 'Ouagadougou vs Yamoussoukro' }, // OKC-GSW
    { a: 0,  b: 10, base: 40, kind: 'historique', label: 'Abidjan vs Nairobi' },        // ATL-NYK
    { a: 18, b: 28, base: 44, kind: 'historique', label: 'Harare vs Dakar' },           // HOU-SAS
    { a: 7,  b: 6,  base: 38, kind: 'historique', label: 'Addis-Abeba vs Djibouti' }    // IND-DET
  ];

  // Initialise g.rivalries à partir du seed (appelé par BM.newGame).
  BM.rivalryInit = function (g) {
    g.rivalries = {};
    BM.RIVALRIES_SEED.forEach(function (r) {
      g.rivalries[KEY(r.a, r.b)] = {
        a: r.a, b: r.b, heat: r.base, kind: r.kind, label: r.label,
        recent: [], // {day, kind, fxId} événements récents (max 6)
        playedThisSeason: 0
      };
    });
  };

  // Récupère la rivalité entre deux équipes (ou null si aucune).
  BM.rivalry = function (g, a, b) {
    return g.rivalries && g.rivalries[KEY(a, b)];
  };

  // Heat normalisée 0-100, ou 0 si pas de rivalité déclarée.
  BM.rivalryHeat = function (g, a, b) {
    var r = BM.rivalry(g, a, b);
    return r ? r.heat : 0;
  };

  // Ajuste la heat d'une rivalité existante ou en crée une nouvelle (rivalité émergente).
  BM.rivalryAdjust = function (g, a, b, delta, reason, kind) {
    if (a === b) return;
    var k = KEY(a, b), r = g.rivalries && g.rivalries[k];
    if (!r) {
      // Rivalité émergente : ne se crée que si delta significatif (>= 6, ex: 2 matchs serrés).
      if (delta < 6) return;
      g.rivalries = g.rivalries || {};
      r = g.rivalries[k] = {
        a: Math.min(a, b), b: Math.max(a, b), heat: 30, kind: 'emergente', label: '',
        recent: [], playedThisSeason: 0
      };
    }
    r.heat = clamp(r.heat + delta, 0, 100);
    if (kind) r.kind = kind;
    r.recent.unshift({ day: g.day, kind: reason || 'event', delta: delta });
    if (r.recent.length > 6) r.recent.length = 6;
  };

  // Libellé lisible pour un niveau de heat.
  BM.rivalryLabel = function (heat) {
    if (heat >= 90) return 'Explosive';
    if (heat >= 75) return 'Tendue';
    if (heat >= 55) return 'Animée';
    if (heat >= 35) return 'Belle';
    return 'Latente';
  };

  // Sélectionne la rivalité la plus chaude d'une équipe donnée (ou null si heat < 30).
  BM.rivalryOf = function (g, teamId) {
    if (!g.rivalries) return null;
    var best = null;
    Object.keys(g.rivalries).forEach(function (k) {
      var r = g.rivalries[k];
      if (r.a !== teamId && r.b !== teamId) return;
      if (!best || r.heat > best.heat) best = r;
    });
    return best && best.heat >= 30 ? best : null;
  };

  // Toutes les rivalités d'une équipe, triées par heat décroissante.
  BM.rivalriesOf = function (g, teamId) {
    if (!g.rivalries) return [];
    return Object.keys(g.rivalries).map(function (k) { return g.rivalries[k]; })
      .filter(function (r) { return r.a === teamId || r.b === teamId; })
      .sort(function (a, b) { return b.heat - a.heat; });
  };

  // Booléen : heat >= 50 ⇒ on considère qu'il y a rivalité "active".
  BM.isRivalry = function (g, a, b) {
    return BM.rivalryHeat(g, a, b) >= 50;
  };

  // L'équipe adverse de la rivalité (vu d'une des deux équipes).
  BM.rivalryOpponent = function (r, teamId) {
    if (!r) return null;
    return r.a === teamId ? r.b : r.b === teamId ? r.a : null;
  };

  // À appeler après chaque match de l'utilisateur :
  // - incrémente playedThisSeason
  // - ajuste la heat (+5 si gagné, +3 si perdu = rancœur)
  // - détecte un comeback / OT pour amplifier
  BM.rivalryAfterMatch = function (g, fx, m) {
    if (!g.rivalries) return;
    var userSide = fx.home === g.userTeam ? 0 : 1;
    var opp = userSide === 0 ? fx.away : fx.home;
    var r = BM.rivalry(g, g.userTeam, opp);
    if (!r) {
      // Rivalité émergente : si le match est serré (écart ≤ 5) ou OT, on crée/amplifie.
      var diff = Math.abs(m.score[0] - m.score[1]);
      if (diff <= 5 || m.overtime) {
        BM.rivalryAdjust(g, g.userTeam, opp, 6, 'close', 'emergente');
      }
      return;
    }
    r.playedThisSeason++;
    var won = m.score[userSide] > m.score[1 - userSide];
    var delta = won ? 5 : 3;
    if (fx.type === 'playoff') delta += 4;
    if (m.overtime) delta += 2;
    // Incident simulé (bagarre, flagrant) : 6% de chance, +12 heat.
    if (g.rng.chance(0.06)) {
      delta += 12;
      BM.addMessage(g, 'Incident : ' + g.teams[g.userTeam].nick + ' vs ' + g.teams[opp].nick,
        'Tensions montées entre les deux équipes pendant le match. La ligue enquête.', 'media');
    }
    BM.rivalryAdjust(g, g.userTeam, opp, delta, won ? 'win' : 'loss', r.kind);
  };

  // À appeler après chaque match (aussi bien l'IA que l'utilisateur) pour les rivalités
  // impliquant deux équipes IA : on ajuste légèrement la heat.
  BM.rivalryAfterAnyMatch = function (g, fx, m) {
    if (!g.rivalries) return;
    var r = BM.rivalry(g, fx.home, fx.away);
    if (!r) return;
    var homeWin = m.score[0] > m.score[1];
    var delta = homeWin ? 2 : 2; // dans tous les cas, un match entre rivaux entretient la heat
    if (fx.type === 'playoff') delta += 3;
    r.playedThisSeason = r.playedThisSeason || 0;
    BM.rivalryAdjust(g, fx.home, fx.away, delta, homeWin ? 'homeWin' : 'awayWin', r.kind);
  };

  // Déclin quotidien (appelé par BM.endDay). En playoffs, le heat est figé.
  // On préserve le seed tant que la rivalité n'a pas été jouée cette saison (sinon le premier match
  // arrive toujours "froid" après 50 jours de pré-saison, ce qui casse l'effet de hype).
  BM.rivalryDecay = function (g) {
    if (!g.rivalries || g.phase === 'playoffs') return;
    Object.keys(g.rivalries).forEach(function (k) {
      var r = g.rivalries[k];
      if (r.playedThisSeason > 0 && r.heat > 30) r.heat = clamp(r.heat - 0.4, 30, 100);
    });
  };

  // À appeler au début de chaque saison : réinitialise playedThisSeason, et
  // garde une trace des confrontations de playoffs de la saison précédente pour
  // amplifier les rivalités récentes.
  BM.rivalryNewSeason = function (g) {
    if (!g.rivalries) return;
    Object.keys(g.rivalries).forEach(function (k) {
      var r = g.rivalries[k];
      // Les rivalités qui se sont jouées en playoffs l'an dernier restent vives.
      if (r.playedThisSeason > 0 && r.kind === 'emergente') r.kind = 'recente';
      r.playedThisSeason = 0;
    });
  };

  // Hook inbox : si heat >= 80 et qu'un match de rivalité approche, le coach adverse
  // peut t'envoyer un taunt (1 chance sur 3, une fois par cycle de match).
  BM.rivalryPreMatchTaunt = function (g, fx) {
    if (!g.rivalries) return;
    var opp = fx.home === g.userTeam ? fx.away : fx.home;
    var r = BM.rivalry(g, g.userTeam, opp);
    if (!r || r.heat < 80) return;
    if (r.tauntSent === g.season + ':' + fx.round) return;
    r.tauntSent = g.season + ':' + fx.round;
    var oppTeam = g.teams[opp], me = g.teams[g.userTeam];
    var tone = r.heat >= 90 ? 'provoc' : g.rng.pick(['arrogant', 'respectful']);
    var templates = {
      arrogant: [
        { q: 'Coach ' + oppTeam.nick + ' vous envoie un mot : "On vous attend. Préparez vos excuses."',
          a: [['"Vous allez les ravaler."', 'Heat +6. Le vestiaire est gonflé.'], ['"On verra sur le parquet."', 'Réponse mesurée. Heat +2.'], ['Ne pas répondre.', 'L\'adversaire prend ça pour de la peur. Heat +4.']] },
        { q: 'Le GM adverse taunt : "Vous avez peur de ' + oppTeam.city + ' ? Logique."',
          a: [['"On vient gagner, point."', 'Heat +5. Vestiaire gonflé.'], ['"La peur, c\'est pour ceux qui n\'ont pas de plan."', 'Heat +3.'], ['Bloquer le contact.', 'Heat +2.']] }
      ],
      respectful: [
        { q: 'Coach ' + oppTeam.nick + ' : "Belle série entre nous. Que le meilleur gagne."',
          a: [['"Toujours un plaisir de vous affronter."', 'Heat -3. Apaisement.'], ['"On verra sur le terrain."', 'Heat +1.'], ['Ne pas répondre.', 'Neutre.']] }
      ],
      provoc: [
        { q: 'BREAKING : Coach ' + oppTeam.nick + ' déclarait en conférence : "On les balaye cette saison."',
          a: [['"Qu\'il le prouve sur le parquet."', 'Heat +8. Vestiaire en feu.'], ['"Les paroles s\'envolent, les écrits restent."', 'Heat +6.'], ['"On répondra par le jeu."', 'Heat +4.']] }
      ]
    };
    var pool = templates[tone];
    var q = pool[g.rng.int(0, pool.length - 1)];
    BM.addMessage(g, 'Taunt de ' + oppTeam.nick, q.q, 'media', q.a.map(function (a, i) {
      return { label: a[0], hint: a[1], act: 'rivalryReply', tone: tone, i: i, oppId: opp };
    }));
    if (g.inbox[0]) g.inbox[0].kind = 'taunt';
  };

  // Applique la réponse au taunt.
  BM.rivalryReply = function (g, a) {
    var r = BM.rivalry(g, g.userTeam, a.oppId);
    if (!r) return '';
    var deltas = {
      arrogant: [6, 2, 4],
      respectful: [-3, 1, 0],
      provoc: [8, 6, 4]
    };
    var d = (deltas[a.tone] || [0])[a.i] || 0;
    BM.rivalryAdjust(g, g.userTeam, a.oppId, d, 'tauntReply');
    var msg = d > 0 ? 'La rivalité s\'enflamme (+' + d + ').' : d < 0 ? 'Vous apaisez la rivalité (' + d + ').' : 'Réponse neutre.';
    if (d > 4) {
      var roster = BM.roster(g, g.teams[g.userTeam]);
      roster.forEach(function (p) { p.morale = BM.clamp(p.morale + 2, 0, 100); });
      msg += ' Le vestiaire est gonflé à bloc.';
    }
    return msg;
  };
})();
