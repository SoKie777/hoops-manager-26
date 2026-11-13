var BM = globalThis.BM = globalThis.BM || {};

// Mémoire de la ligue, héritage, relations, fil social et envies des joueurs.
// Inspiré de la boucle de Hoop Land (voir docs/HOOPLAND.md) : chaque match nourrit une histoire qui dure.
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var fill = function (s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] !== undefined ? o[k] : ''; }); };

  // ==================================================================== actualités de la ligue
  BM.NEWS_KINDS = { trade: 'Transfert', injury: 'Blessure', retire: 'Retraite', hof: 'Hall of Fame', death: 'Disparition', record: 'Performance', jersey: 'Maillot retiré', award: 'Trophée', roundup: 'Résultats' };
  BM.news = function (g, kind, t, big) {
    g.news = g.news || [];
    g.news.unshift({ day: g.day, s: g.season, k: kind, t: t, big: !!big });
    if (g.news.length > 120) g.news.length = 120;
  };

  // ==================================================================== Hall of Fame
  BM.HOF_MIN = 26;
  var awardPts = function (t) {
    if (t === 'MVP') return 12;
    if (t.indexOf('Défenseur') === 0) return 5;
    if (t.indexOf('All-NBA 1re') === 0) return 5;
    if (t.indexOf('All-NBA') === 0) return 3;
    if (t === 'All-Star') return 2.5;
    if (t.indexOf('Rookie') === 0) return 1;
    if (t.indexOf('6e homme') === 0) return 1.5;
    return 0.5;
  };
  // Score de carrière : distinctions obtenues dans la partie, statistiques cumulées, pic de niveau,
  // et pour les vétérans réels déjà installés au début de la partie, les saisons jouées avant elle.
  BM.hofScore = function (g, p) {
    var aw = (p.awards || []).reduce(function (s, a) { return s + awardPts(a.t); }, 0);
    var pts = (p.career || []).reduce(function (s, c) { return s + c.pts; }, 0);
    var seasons = (p.career || []).length;
    var peak = Math.max(p.peak || 0, BM.ovr(p));
    var prior = p.real ? Math.max(0, (p.age - seasons) - 20) : 0;
    var priorF = peak >= 90 ? 2.6 : peak >= 86 ? 1.8 : peak >= 82 ? 1 : peak >= 78 ? 0.45 : 0.15;
    return Math.round((aw + pts / 1500 + seasons * 0.5 + Math.max(0, peak - 78) * 1.4 + prior * priorF) * 10) / 10;
  };
  var mainTeam = function (g, p) {
    var count = {};
    (p.career || []).forEach(function (c) { if (c.team !== '-') count[c.team] = (count[c.team] || 0) + 1; });
    var best = null;
    Object.keys(count).forEach(function (k) { if (!best || count[k] > count[best]) best = k; });
    return best ? { short: best, seasons: count[best], team: g.teams.find(function (t) { return t.short === best; }) } : null;
  };
  BM.induct = function (g, p) {
    g.hof = g.hof || [];
    if (g.hof.some(function (h) { return h.id === p.id; })) return;
    var mt = mainTeam(g, p), score = BM.hofScore(g, p);
    g.hof.push({ id: p.id, name: BM.fullName(p), pos: p.pos, season: g.season, score: score, peak: Math.max(p.peak || 0, BM.ovr(p)), team: mt ? mt.short : '-', num: p.number, first: score >= BM.HOF_MIN * 1.6 });
    BM.news(g, 'hof', 'BREAKING : ' + BM.fullName(p) + ' entre au Hall of Fame' + (score >= BM.HOF_MIN * 1.6 ? ', dès le premier vote.' : '.'), true);
    if (mt && mt.team && mt.seasons >= 4) {
      mt.team.retired = mt.team.retired || [];
      if (!mt.team.retired.some(function (r) { return r.id === p.id; })) {
        mt.team.retired.push({ id: p.id, name: BM.fullName(p), num: p.number, season: g.season });
        BM.news(g, 'jersey', 'Les ' + mt.team.name + ' retirent le maillot' + (p.number !== undefined ? ' n°' + p.number : '') + ' de ' + BM.fullName(p) + '.', true);
      }
    }
  };
  // Les légendes vieillissent : passé 74 ans, chaque saison peut être la dernière.
  BM.legendsAge = function (g) {
    (g.hof || []).forEach(function (h) {
      var p = g.players[h.id];
      if (!p || h.died || p.age < 74) return;
      if (g.rng.chance((p.age - 72) * 0.025)) {
        h.died = { season: g.season, age: p.age };
        BM.news(g, 'death', 'BREAKING : le Hall of Famer ' + h.name + ' est décédé à l\'âge de ' + p.age + ' ans. La ligue est en deuil.', true);
      }
    });
  };

  // ==================================================================== crochets de la saison
  // Après chaque match de la ligue : blessures des vedettes et performances historiques.
  BM.legacyAfterMatch = function (g, fx, m) {
    [0, 1].forEach(function (side) {
      var team = g.teams[side === 0 ? fx.home : fx.away];
      m.roster[side].forEach(function (p) {
        var b = m.box[p.id];
        if (p.injury >= 12 && BM.ovr(p) >= 78 && p.injNews !== g.day) {
          p.injNews = g.day;
          BM.news(g, 'injury', 'BREAKING : ' + BM.fullName(p) + ' (' + team.short + ') blessé, absent environ ' + p.injury + ' jours.');
        }
        if (b && b.pts >= 48) BM.news(g, 'record', BM.fullName(p) + ' (' + team.short + ') explose les compteurs : ' + b.pts + ' points.', b.pts >= 60);
      });
    });
  };
  // Fin de saison : pics de niveau, retraites notables, intronisations, légendes.
  BM.legacyEndSeason = function (g) {
    Object.keys(g.players).forEach(function (id) {
      var p = g.players[id];
      if (!p.retired) { p.peak = Math.max(p.peak || 0, BM.ovr(p)); return; }
      if (p.retireSeason) return;
      p.retireSeason = g.season;
      var sc = BM.hofScore(g, p);
      if (Math.max(p.peak || 0, BM.ovr(p)) >= 77 || sc >= 15) BM.news(g, 'retire', BM.fullName(p) + ' annonce sa retraite après ' + Math.max(1, (p.career || []).length) + ' saison(s) dans la ligue.');
      if (sc >= BM.HOF_MIN) BM.induct(g, p);
    });
    BM.legendsAge(g);
  };

  // ==================================================================== accomplissements à paliers
  BM.TIER_PTS = [2, 4, 7, 11, 16, 22, 30];
  // Joueur (Ma Carrière). ctx = { L: ligne du match, S: saison en cours, T: totaux de carrière, C }
  BM.ACH_PLAYER = [
    { id: 'g_pts', s: 'match', l: 'Marquer {n} points dans un match', t: [20, 30, 40, 50, 60], v: function (x) { return x.L ? x.L.pts : 0; } },
    { id: 'g_reb', s: 'match', l: 'Prendre {n} rebonds dans un match', t: [10, 15, 20], v: function (x) { return x.L ? x.L.reb : 0; } },
    { id: 'g_ast', s: 'match', l: 'Délivrer {n} passes dans un match', t: [8, 12, 16], v: function (x) { return x.L ? x.L.ast : 0; } },
    { id: 'g_tpm', s: 'match', l: 'Réussir {n} tirs à 3 points dans un match', t: [4, 7, 10], v: function (x) { return x.L ? x.L.tpm : 0; } },
    { id: 'g_def', s: 'match', l: 'Cumuler {n} interceptions + contres dans un match', t: [4, 6, 8], v: function (x) { return x.L ? x.L.stl + x.L.blk : 0; } },
    { id: 'g_td', s: 'match', l: 'Réussir un triple-double', t: [1], v: function (x) { var L = x.L; return L && [L.pts, L.reb, L.ast, L.stl, L.blk].filter(function (v) { return v >= 10; }).length >= 3 ? 1 : 0; } },
    { id: 's_pts', s: 'saison', l: 'Marquer {n} points sur une saison', t: [500, 1000, 1500, 2000, 2500], v: function (x) { return x.S.pts; } },
    { id: 's_ast', s: 'saison', l: 'Délivrer {n} passes sur une saison', t: [250, 450, 650], v: function (x) { return x.S.ast; } },
    { id: 's_reb', s: 'saison', l: 'Prendre {n} rebonds sur une saison', t: [400, 700, 1000], v: function (x) { return x.S.reb; } },
    { id: 's_tpm', s: 'saison', l: 'Réussir {n} tirs à 3 points sur une saison', t: [100, 200, 300], v: function (x) { return x.S.tpm; } },
    { id: 'c_pts', s: 'carrière', l: 'Marquer {n} points en carrière', t: [1000, 5000, 10000, 20000, 30000, 40000], v: function (x) { return x.T.pts; } },
    { id: 'c_reb', s: 'carrière', l: 'Prendre {n} rebonds en carrière', t: [1000, 4000, 8000, 12000], v: function (x) { return x.T.reb; } },
    { id: 'c_ast', s: 'carrière', l: 'Délivrer {n} passes en carrière', t: [1000, 3000, 6000, 10000], v: function (x) { return x.T.ast; } },
    { id: 'c_gp', s: 'carrière', l: 'Jouer {n} matchs en carrière', t: [82, 250, 500, 800, 1200], v: function (x) { return x.T.gp; } },
    { id: 'c_as', s: 'carrière', l: 'Être sélectionné {n} fois au All-Star Game', t: [1, 3, 5, 10, 15], v: function (x) { return x.C.allStars || 0; } },
    { id: 'c_ring', s: 'carrière', l: 'Remporter {n} titre(s)', t: [1, 2, 3, 4, 5, 6], v: function (x) { return x.C.rings || 0; } },
    { id: 'c_mvp', s: 'carrière', l: 'Être élu {n} fois MVP', t: [1, 2, 3, 4], v: function (x) { return x.mvp; } }
  ];
  // Coach (mode Manager). ctx = g.coach
  BM.ACH_COACH = [
    { id: 'k_w', s: 'carrière', l: 'Gagner {n} matchs comme coach', t: [10, 50, 100, 250, 500, 1000], v: function (k) { return k.wins; } },
    { id: 'k_sw', s: 'saison', l: 'Gagner {n} matchs de saison régulière sur une saison', t: [41, 50, 60, 70], v: function (k) { return k.seasonWins; } },
    { id: 'k_po', s: 'carrière', l: 'Se qualifier {n} fois pour les playoffs', t: [1, 3, 5, 10], v: function (k) { return k.apps; } },
    { id: 'k_se', s: 'carrière', l: 'Gagner {n} série(s) de playoffs', t: [1, 5, 10, 20], v: function (k) { return k.series; } },
    { id: 'k_ti', s: 'carrière', l: 'Remporter {n} titre(s)', t: [1, 2, 3, 5], v: function (k) { return k.titles; } },
    { id: 'k_st', s: 'match', l: 'Aligner une série de {n} victoires', t: [5, 10, 15], v: function (k) { return k.streak; } }
  ];
  // Bilan du coach reconstitué depuis le calendrier (sauvegardes antérieures à l'héritage).
  BM.coachInit = function (g) {
    if (g.coach) return g.coach;
    var k = g.coach = { wins: 0, games: 0, streak: 0, seasonWins: 0, apps: 0, series: 0, titles: 0 };
    g.fixtures.filter(function (f) { return f.played && (f.home === g.userTeam || f.away === g.userTeam); }).sort(function (a, b) { return a.day - b.day; }).forEach(function (f) {
      var us = f.home === g.userTeam ? f.hs : f.as, them = f.home === g.userTeam ? f.as : f.hs;
      k.games++; if (us > them) { k.wins++; k.streak++; } else k.streak = 0;
    });
    var me = g.teams[g.userTeam];
    if (me) k.seasonWins = me.record.w;
    BM.checkAch(BM.ACH_COACH, k, k);
    return k;
  };
  // Compare les valeurs aux paliers et renvoie les paliers franchis (une seule fois chacun).
  BM.checkAch = function (defs, store, ctx) {
    var ups = [];
    store.ach = store.ach || {};
    defs.forEach(function (d) {
      var v = d.v(ctx), lvl = store.ach[d.id] || 0;
      while (lvl < d.t.length && v >= d.t[lvl]) {
        var pts = BM.TIER_PTS[Math.min(lvl, BM.TIER_PTS.length - 1)];
        ups.push({ l: fill(d.l, { n: BM.fmtN ? BM.fmtN(d.t[lvl]) : d.t[lvl] }), pts: pts });
        store.legacyPts = (store.legacyPts || 0) + pts;
        lvl++;
      }
      store.ach[d.id] = lvl;
    });
    return ups;
  };
  BM.achRows = function (defs, store, ctx) {
    return defs.map(function (d) {
      var lvl = (store.ach || {})[d.id] || 0, v = d.v(ctx);
      return { l: fill(d.l, { n: BM.fmtN ? BM.fmtN(d.t[Math.min(lvl, d.t.length - 1)]) : d.t[Math.min(lvl, d.t.length - 1)] }), s: d.s, lvl: lvl, max: d.t.length, v: v, next: lvl < d.t.length ? d.t[lvl] : null };
    });
  };

  // Totaux de carrière d'un joueur (saisons archivées + saison en cours).
  BM.careerTotals = function (p) {
    var T = { pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast, gp: p.stats.gp };
    (p.career || []).forEach(function (c) { T.pts += c.pts; T.reb += c.reb; T.ast += c.ast; T.gp += c.gp; });
    return T;
  };
  BM.careerAchCtx = function (g, L) {
    var C = g.career, p = BM.cPlayer(g);
    return { L: L || null, S: p.stats, T: BM.careerTotals(p), C: C, mvp: (p.awards || []).filter(function (a) { return a.t === 'MVP'; }).length };
  };

  // ==================================================================== rang Legacy (Ma Carrière)
  // Le score mêle l'héritage acquis (points d'accomplissements, permanents) et la réputation actuelle :
  // une mauvaise saison fait redescendre le rang, comme dans Hoop Land.
  BM.LEGACY_RANKS = [['Rookie', 0], ['Rotation', 20], ['Titulaire', 40], ['All-Star', 62], ['Superstar', 88], ['Icône', 118], ['Légende', 155]];
  BM.legacyRank = function (g) {
    var C = g.career, score = (C.legacyPts || 0) * 0.35 + (C.rep || 0) * 0.9, i = 0;
    BM.LEGACY_RANKS.forEach(function (r, k) { if (score >= r[1]) i = k; });
    var next = BM.LEGACY_RANKS[i + 1];
    return { i: i, l: BM.LEGACY_RANKS[i][0], score: Math.round(score), next: next ? next[1] : null, nextL: next ? next[0] : null, from: BM.LEGACY_RANKS[i][1] };
  };
  // Pouvoirs débloqués par le rang (et par la relation avec le coach pour le système).
  BM.CAREER_POWERS = [
    { id: 'trade', l: 'Demander un transfert', d: 'Une fois par saison. Le club cherchera preneur à la date limite.', rank: 3 },
    { id: 'recruit', l: 'Suggérer une recrue', d: 'Propose un agent libre au coach. Une suggestion par mois.', rank: 3 },
    { id: 'system', l: 'Choisir le système de jeu', d: 'Le coach adopte ton système. Relation avec le coach : 60 minimum.', rank: 4, coach: 60 }
  ];
  BM.careerPowerOk = function (g, id) {
    var C = g.career, pw = BM.CAREER_POWERS.find(function (x) { return x.id === id; }), r = BM.legacyRank(g);
    if (C.phase !== 'nba' || !BM.cTeam(g)) return { ok: false, why: 'Disponible une fois en NBA.' };
    if (r.i < pw.rank) return { ok: false, why: 'Rang ' + BM.LEGACY_RANKS[pw.rank][0] + ' requis.' };
    if (pw.coach && C.confCoach < pw.coach) return { ok: false, why: 'Relation avec le coach : ' + pw.coach + ' requis (' + Math.round(C.confCoach) + ').' };
    if (id === 'trade' && (C.tradeAsked === g.season || C.tradeReq)) return { ok: false, why: 'Déjà demandé cette saison.' };
    if (id === 'recruit' && C.recruitDay && g.day - C.recruitDay < 30) return { ok: false, why: 'Prochaine suggestion dans ' + (30 - (g.day - C.recruitDay)) + ' j.' };
    return { ok: true };
  };
  BM.careerUsePower = function (g, id, arg) {
    var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g), chk = BM.careerPowerOk(g, id);
    if (!chk.ok) return chk.why;
    if (id === 'trade') {
      C.tradeReq = true; C.tradeAsked = g.season; C.confCoach -= 4; C.confMates -= 2;
      BM.news(g, 'trade', 'BREAKING : ' + BM.fullName(p) + ' a demandé à être transféré par les ' + t.name + '.', true);
      BM.cpress(g, 'Hoops Daily', BM.fullName(p) + ' veut partir', 'Le joueur a officiellement demandé son transfert.', '-');
      BM.careerNormalize(g);
      return 'Demande transmise. Le front office écoutera les offres jusqu\'à la date limite.';
    }
    if (id === 'recruit') {
      var fa = g.players[arg];
      if (!fa || fa.teamId !== null) return 'Ce joueur n\'est plus disponible.';
      C.recruitDay = g.day;
      var chance = clamp(0.3 + BM.legacyRank(g).i * 0.08 + (C.confCoach - 50) / 200 - (t.roster.length >= 15 ? 0.25 : 0), 0.05, 0.9);
      if (g.rng.chance(chance)) {
        g.freeAgents = g.freeAgents.filter(function (id) { return id !== fa.id; });
        fa.contract = { salary: BM.askingSalary(fa), years: g.rng.int(1, 3) };
        BM.addToTeam(g, fa, t);
        if (t.roster.length > 15) {
          var worst = BM.roster(g, t).filter(function (x) { return x !== p && x !== fa; }).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
          BM.removeFromTeam(g, worst); g.freeAgents.push(worst.id);
        }
        BM.autoTactics(g, t);
        C.confMates += 2; BM.cMateAdd(g, fa.id, 12);
        BM.news(g, 'trade', 'Les ' + t.name + ' signent ' + BM.fullName(fa) + ', une recrue soufflée par ' + BM.fullName(p) + '.');
        BM.careerNormalize(g);
        return 'Le coach t\'a écouté : ' + BM.fullName(fa) + ' signe chez les ' + t.name + '.';
      }
      C.confCoach -= 1; BM.careerNormalize(g);
      return 'Le coach préfère garder son effectif. Il retient l\'idée.';
    }
    if (id === 'system') {
      if (!BM.SYSTEMS[arg]) return 'Système inconnu.';
      t.tactics.system = arg; C.confCoach -= 2;
      BM.clog(g, 'Le coach adopte le ' + BM.SYSTEMS[arg].l + ' à ta demande.');
      BM.careerNormalize(g);
      return 'Le coach adopte le ' + BM.SYSTEMS[arg].l + '. Il attend des résultats.';
    }
    return '';
  };

  // ==================================================================== relations avec chaque coéquipier (Ma Carrière)
  BM.cMate = function (g, pid) { var C = g.career; C.mates = C.mates || {}; return C.mates[pid] !== undefined ? C.mates[pid] : 50; };
  BM.cMateAdd = function (g, pid, x) { var C = g.career; C.mates = C.mates || {}; C.mates[pid] = clamp(BM.cMate(g, pid) + x, 0, 100); };

  // ==================================================================== expérience par catégorie (Ma Carrière)
  BM.CAREER_CATS = {
    tir: { l: 'Tir', xp: function (c) { return c.tpm * 3 + c.midm * 2; } },
    fin: { l: 'Finition', xp: function (c) { return c.rimm * 2; } },
    crea: { l: 'Création', xp: function (c) { return c.ast * 2; } },
    def: { l: 'Défense', xp: function (c) { return c.stl * 3 + c.blk * 3 + c.reb * 0.6; } }
  };
  BM.catLevel = function (xp) { return Math.floor(Math.sqrt(xp / 12)); };
  BM.catNext = function (lvl) { return 12 * (lvl + 1) * (lvl + 1); };
  BM.careerCatCheck = function (g) {
    var C = g.career, ups = [];
    C.catLv = C.catLv || {};
    Object.keys(BM.CAREER_CATS).forEach(function (k) {
      var lv = BM.catLevel(BM.CAREER_CATS[k].xp(C.cnt)), old = C.catLv[k] === undefined ? lv : C.catLv[k];
      if (lv > old) { ups.push(BM.CAREER_CATS[k].l + ' niveau ' + lv); C.pp += (lv - old) * 3; BM.clog(g, BM.CAREER_CATS[k].l + ' : niveau ' + lv + ' (+' + (lv - old) * 3 + ' PP).'); }
      C.catLv[k] = lv;
    });
    return ups;
  };

  // ==================================================================== fil social (les deux modes)
  BM.feedOf = function (g) { if (g.mode === 'career' && g.career) return g.career.feed; g.feed = g.feed || []; return g.feed; };
  BM.post = function (g, who, h, t, mine, likes) {
    if (g.mode === 'career' && g.career) { BM.cfeed(g, who, h, t, mine, likes); return; }
    g.feed = g.feed || [];
    var me = BM.myTeam(g);
    g.feed.unshift({ day: g.day, who: who, h: h, t: t, mine: !!mine, likes: likes || Math.round(BM.fansOf(me) * (0.002 + g.rng.next() * 0.006) + 80) });
    if (g.feed.length > 60) g.feed.length = 60;
  };
  BM.fansOf = function (team) { if (!team) return 0; if (team.fans === undefined) team.fans = Math.round(team.rep * 9000 + 120000); return team.fans; };

  var FAN_HANDLES = ['ballislife225', 'dakar_hoops', 'kinshasa_courtside', 'mamba_mentale', 'tapis_rouge', 'parquet_fr', 'triple_double_tv', 'abidjan_dunk', 'lagos_buckets', 'coach_canape'];
  var POSTS = {
    fanWin: ['{S} a mis {PTS} points ce soir. On n\'a pas assez de mots. #{TS}', 'Victoire contre les {O} ! {S} en mode patron. Cette équipe a quelque chose.', 'Je l\'avais dit : avec {S} on peut viser haut. {US}-{THEM}, merci.'],
    fanLoss: ['{S} a mis {PTS} points et on perd quand même. Il faut des renforts.', 'Encore une défaite. Le banc a disparu ce soir. #{TS}', '{US}-{THEM} contre les {O}... Je ne dirai rien. Enfin si : réveillez-vous.'],
    troll: ['Les {T} sans {S}, c\'est une équipe de G League. Point.', 'Très surcoté ce {S}. Changez-moi d\'avis.', 'J\'ai pas regardé le match mais je sais que {S} a forcé ses tirs.'],
    oppFan: ['Merci les {T} pour la victoire facile. Revenez quand vous voulez.', 'Respect à {S}, il a tenu sa baraque. Mais la victoire est pour nous.'],
    mate: ['Grosse soirée de la famille ! Fier de jouer avec {S}.', 'On se remet au travail dès demain. Ensemble.', 'Le vestiaire est soudé, ça se voit sur le terrain.'],
    mateLoss: ['On doit être meilleurs. Moi le premier.', 'Pas notre soirée. On répond au prochain match.'],
    media: ['FINAL : {HOME} {HS} – {AS} {AWAY}. Joueur du match : {MVP}.'],
    big: ['ÉNORME : {S} plante {PTS} points contre les {O}. La ligue est prévenue.'],
    rival: ['La rivalité avec les {O} vient de prendre un degré. {US}-{THEM}. La prochaine confrontation sera électrique.', 'Les {O} parlent beaucoup. On attend de voir ça au prochain match.', 'Ce n’est plus un simple match contre les {O}. C’est devenu personnel.']
  };
  // ==================================================================== rivalités et résultats de la ligue
  BM.updateRivalry = function (g, fx, m, userSide) {
    g.rivalries = g.rivalries || [];
    var own = m.side[userSide], opp = m.side[1 - userSide], a = Math.min(own.id, opp.id), b = Math.max(own.id, opp.id);
    var r = g.rivalries.find(function (x) { return x.a === a && x.b === b; });
    if (!r) {
      r = { a: a, b: b, heat: 0, meetings: 0, userWins: 0, oppWins: 0, lastDay: -1, lastWinner: null };
      g.rivalries.push(r);
    }
    var won = m.score[userSide] > m.score[1 - userSide];
    r.meetings++;
    if (won) r.userWins++; else r.oppWins++;
    r.lastDay = g.day;
    r.lastWinner = won ? own.id : opp.id;
    var margin = Math.abs(m.score[0] - m.score[1]);
    r.heat = clamp(r.heat + (fx.type === 'playoff' ? 16 : margin <= 5 ? 10 : margin <= 12 ? 7 : 4), 0, 100);
    return r;
  };

  BM.leagueRoundup = function (g, fixtures) {
    var games = (fixtures || []).filter(function (f) { return f.played && f.type === 'league'; });
    if (!games.length) return;
    var results = games.map(function (f) {
      var h = g.teams[f.home], a = g.teams[f.away];
      return h.short + ' ' + f.hs + '-' + f.as + ' ' + a.short;
    });
    BM.post(g, 'Hoops Daily', '@hoopsdaily', 'Résultats de la soirée : ' + results.join(' · '), false, 1);
    var close = games.slice().sort(function (a, b) { return Math.abs(a.hs - a.as) - Math.abs(b.hs - b.as); })[0];
    var blowout = games.slice().sort(function (a, b) { return Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as); })[0];
    if (close) {
      var ch = g.teams[close.home], ca = g.teams[close.away];
      BM.news(g, 'roundup', 'Thriller : ' + ch.short + ' ' + close.hs + '-' + close.as + ' ' + ca.short + ' — écart de ' + Math.abs(close.hs - close.as) + ' point(s).', false);
    }
    if (blowout && Math.abs(blowout.hs - blowout.as) >= 20) {
      var bh = g.teams[blowout.home], ba = g.teams[blowout.away];
      BM.news(g, 'roundup', 'Carton : ' + bh.short + ' ' + blowout.hs + '-' + blowout.as + ' ' + ba.short + '.', false);
    }
  };

  // Publications générées après un match de l'utilisateur. focus = meilleur marqueur de la franchise.
  BM.socialAfterMatch = function (g, fx, m, focusId) {
    var r = g.rng, userSide = fx.home === g.userTeam ? 0 : 1;
    var team = m.side[userSide], opp = m.side[1 - userSide], won = m.score[userSide] > m.score[1 - userSide];
    var star = g.players[focusId], b = star ? m.box[star.id] : null, mvp = fx.mvp ? g.players[fx.mvp] : null;
    var rivalry = BM.updateRivalry(g, fx, m, userSide);
    var o = { S: star ? BM.fullName(star) : team.name, PTS: b ? b.pts : 0, T: team.nick || team.name, TS: (team.short || '').toLowerCase(), O: opp.nick || opp.name, US: m.score[userSide], THEM: m.score[1 - userSide],
      HOME: m.side[0].short, AWAY: m.side[1].short, HS: m.score[0], AS: m.score[1], MVP: mvp ? BM.fullName(mvp) : '-' };
    BM.post(g, 'Hoops Daily', '@hoopsdaily', fill(POSTS.media[0], o));
    BM.post(g, 'Fan', '@' + r.pick(FAN_HANDLES), fill(r.pick(won ? POSTS.fanWin : POSTS.fanLoss), o));
    if (r.chance(0.55)) BM.post(g, 'Fan adverse', '@' + r.pick(FAN_HANDLES), fill(r.pick(won ? POSTS.troll : POSTS.oppFan), o));
    var mates = m.roster[userSide].filter(function (p) { return !star || p.id !== star.id; }).sort(function (a, c) { return (m.box[c.id].pts || 0) - (m.box[a.id].pts || 0); });
    if (mates[0] && r.chance(0.6)) BM.post(g, BM.fullName(mates[0]), '@' + (mates[0].first + mates[0].last).toLowerCase().replace(/[^a-z]/g, ''), fill(r.pick(won ? POSTS.mate : POSTS.mateLoss), o));
    if (b && b.pts >= 38) BM.post(g, 'Courtside TV', '@courtsidetv', fill(POSTS.big[0], o));
    if (b) {
      var rebounds = (b.oreb || 0) + (b.dreb || 0);
      if (b.pts >= 40 || (b.pts >= 30 && rebounds >= 10 && b.ast >= 10)) {
        var feat = b.pts >= 40 ? b.pts + ' points' : 'triple-double';
        BM.news(g, 'record', BM.fullName(star) + ' signe ' + feat + ' contre ' + opp.name + '.', true);
        BM.post(g, 'Courtside TV', '@courtsidetv', BM.fullName(star) + ' vient de livrer une performance de référence : ' + feat + '.');
      }
    }
    if (rivalry.meetings >= 2 || fx.type === 'playoff') {
      if (rivalry.heat >= 30) {
        BM.post(g, 'Rival Watch', '@rivalwatch', fill(r.pick(POSTS.rival), o));
        BM.news(g, 'record', 'Rivalité en hausse : ' + team.name + ' – ' + opp.name + ' (' + rivalry.meetings + ' confrontations).', rivalry.heat >= 65);
      }
    }
    g.reply = { fx: fx.id, won: won, star: star ? star.id : null, mate: mates[0] ? mates[0].id : null, rival: opp.id, day: g.day };
  };

  BM.SOCIAL_TONES = [['praise', 'Féliciter'], ['shout', 'Saluer'], ['callout', 'Recadrer'], ['blame', 'Accuser']];
  // Cibles possibles de ta publication, selon le mode.
  BM.socialTargets = function (g) {
    var R = g.reply || {}, out = [];
    if (BM.isCareer(g)) {
      var t = BM.cTeam(g);
      out.push(['self', 'Toi-même']);
      if (t) out.push(['coach', 'Coach ' + BM.coachName(g, t)]);
      if (R.mate && g.players[R.mate]) out.push(['mate', BM.shortName(g.players[R.mate])]);
      out.push(['team', 'L\'équipe'], ['fans', 'Les fans'], ['refs', 'Les arbitres']);
    } else {
      out.push(['team', 'L\'équipe']);
      if (R.star && g.players[R.star]) out.push(['star', BM.shortName(g.players[R.star])]);
      if (R.rival !== undefined && g.teams[R.rival]) out.push(['rival', 'Les rivaux']);
      out.push(['fans', 'Les fans'], ['self', 'Toi (le coach)'], ['refs', 'Les arbitres']);
    }
    return out;
  };
  var MY_POST = {
    praise: { self: 'Bon travail ce soir. J\'ai fait ma part.', coach: 'Merci coach {C}, plan de jeu parfait.', mate: '{M}, quelle soirée. Content de jouer à tes côtés.', star: '{M}, patron ce soir. Fier de toi.', team: 'Fier de cette équipe. Tout le monde a répondu présent.', fans: 'Les fans, vous êtes notre sixième homme. Merci !', refs: 'Arbitrage juste ce soir, c\'est assez rare pour le dire.', rival: 'Respect aux {M} pour le combat. On se retrouve au prochain match.' },
    shout: { self: 'On continue de bosser.', coach: 'Respect au staff pour la préparation.', mate: 'Big up {M} !', star: 'Big up {M} !', team: 'La famille. Toujours.', fans: 'Merci pour l\'énergie dans la salle.', refs: 'Bien sifflé.', rival: 'Bon match aux {M}. La prochaine fois, ce sera différent.' },
    callout: { self: 'Pas au niveau ce soir. Je dois être meilleur.', coach: 'On doit parler du plan de jeu. Ce soir, ça n\'a pas marché.', mate: '{M}, on attend plus de toi.', star: '{M}, on attend plus de toi.', team: 'Ce n\'est pas acceptable. Tout le monde doit se regarder dans le miroir.', fans: 'Si vous n\'êtes pas derrière nous dans les moments durs, restez chez vous.', refs: 'On aimerait le même arbitrage des deux côtés.', rival: 'Les {M} ont célébré trop tôt. On garde ça en mémoire.' },
    blame: { self: 'Celle-là est pour moi. Je l\'assume.', coach: 'Difficile de gagner avec ce plan de jeu.', mate: 'Certains n\'étaient pas là ce soir. Suivez mon regard, {M}.', star: 'Certains n\'étaient pas là ce soir. Suivez mon regard, {M}.', team: 'On a été mauvais collectivement. Inacceptable.', fans: 'Une salle silencieuse, ça ne nous a pas aidés.', refs: 'On nous a volé ce match. Regardez les images.', rival: 'Les {M} ont eu de la réussite. Qu’ils profitent, ça ne durera pas.' }
  };
  // Applique les effets de ta publication et l'ajoute au fil. Renvoie le compte rendu des conséquences.
  BM.socialReply = function (g, target, tone) {
    var R = g.reply;
    if (!R) return '';
    g.reply = null;
    var won = R.won, sign = { praise: 1, shout: 0.6, callout: -1, blame: -1.6 }[tone], out = [];
    var who, handle, likesMul = 1;
    if (BM.isCareer(g)) {
      var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
      who = BM.fullName(p); handle = '@' + (p.first + p.last).toLowerCase().replace(/[^a-z]/g, '');
      if (target === 'coach') { C.confCoach += sign * 3; out.push('relation coach ' + (sign > 0 ? '+' : '') + Math.round(sign * 3)); }
      else if (target === 'mate' && R.mate) { BM.cMateAdd(g, R.mate, sign * 8); C.confMates += sign * 1.5; out.push('relation avec ' + BM.shortName(g.players[R.mate]) + ' ' + (sign > 0 ? '+' : '') + Math.round(sign * 8)); }
      else if (target === 'team') { C.confMates += sign * (won ? 2 : 1.5) + (tone === 'callout' && !won ? 1.5 : 0); out.push('vestiaire ' + (sign > 0 || (tone === 'callout' && !won) ? 'apprécie' : 'grince')); }
      else if (target === 'fans') { C.followers += sign > 0 ? 3000 : -4000; C.rep += sign * 0.3; out.push(sign > 0 ? 'les fans adorent' : 'les fans se vexent'); likesMul = sign > 0 ? 1.6 : 0.6; }
      else if (target === 'refs') { if (sign < 0) { C.money -= 25; C.followers += 2500; out.push('amende de 25 k$, mais le buzz est là'); } else out.push('la ligue apprécie'); }
      else { if (tone === 'praise') { C.followers += 2000; C.confMates -= 1; out.push('ego remarqué dans le vestiaire'); } else if (sign < 0) { C.confMates += 1.5; C.confCoach += 1; p.morale -= 2; out.push('le vestiaire respecte'); } else out.push('message neutre'); }
      BM.careerNormalize(g);
      BM.post(g, who, handle, fill(MY_POST[tone][target] || MY_POST[tone].team, { C: t ? BM.coachName(g, t) : '', M: R.mate ? BM.shortName(g.players[R.mate]) : '' }), true, Math.round(C.followers * 0.02 * likesMul + 500));
    } else {
      var me = BM.myTeam(g), roster = BM.roster(g, me);
      who = 'Coach ' + g.managerName; handle = '@coach' + (g.managerName || '').toLowerCase().replace(/[^a-z]/g, '');
      if (target === 'team') {
        var d = tone === 'callout' && !won ? 2 : sign * 2;
        roster.forEach(function (x) { x.morale = clamp(x.morale + d, 0, 100); BM.relAdd(g, x, d); });
        if (tone === 'blame') me.cohesion = Math.max(30, me.cohesion - 2);
        out.push('moral de l\'équipe ' + (d >= 0 ? '+' : '') + d);
      } else if (target === 'star' && R.star) {
        var s = g.players[R.star], dd = Math.round(sign * 7);
        s.morale = clamp(s.morale + Math.round(sign * 5), 0, 100); BM.relAdd(g, s, dd);
        if (sign < -1) roster.forEach(function (x) { if (x !== s) x.morale = clamp(x.morale - 1, 0, 100); });
        out.push('relation avec ' + BM.shortName(s) + ' ' + (dd >= 0 ? '+' : '') + dd);
      } else if (target === 'fans') {
        var f = Math.round(BM.fansOf(me) * (sign > 0 ? 0.01 : -0.015));
        me.fans += f; likesMul = sign > 0 ? 1.6 : 0.6;
        out.push((f >= 0 ? '+' : '') + BM.fmtN(f) + ' fans');
      } else if (target === 'rival' && R.rival !== undefined && g.teams[R.rival]) {
        var rivalTeam = g.teams[R.rival];
        if (tone === 'praise') { rivalTeam.rep = clamp(rivalTeam.rep + 0.2, 20, 99); out.push('respect affiché, rivalité apaisée'); }
        else if (tone === 'shout') { out.push('message reçu dans le camp adverse'); }
        else if (tone === 'callout') { BM.roster(g, rivalTeam).forEach(function (x) { x.morale = clamp(x.morale - 1, 0, 100); }); me.fans += Math.round(BM.fansOf(me) * 0.002); out.push('petit coup de pression, les fans réagissent'); }
        else { me.balance -= 25; g.board.confidence = clamp(g.board.confidence - 1, 0, 100); out.push('la ligue ouvre un dossier disciplinaire et inflige une amende de vingt-cinq mille dollars'); }
      } else {
        if (sign < 0) { g.board.confidence = clamp(g.board.confidence + 1, 0, 100); roster.forEach(function (x) { BM.relAdd(g, x, 1); }); out.push('la direction et le vestiaire apprécient que tu assumes'); }
        else { roster.forEach(function (x) { BM.relAdd(g, x, -1); }); out.push('le vestiaire trouve ça un peu facile'); }
      }
      BM.post(g, who, handle, fill(MY_POST[tone][target] || MY_POST[tone].team, { M: R.star ? BM.shortName(g.players[R.star]) : '' }), true, Math.round(BM.fansOf(me) * 0.01 * likesMul + 200));
    }
    return 'Publié. ' + out.join(', ') + '.';
  };

  // ==================================================================== relation coach-joueur (mode Manager)
  BM.relOf = function (p) { return p.rel === undefined ? 50 : p.rel; };
  BM.relAdd = function (g, p, x) { p.rel = clamp(BM.relOf(p) + x, 0, 100); };
  BM.relLabel = function (v) { return v >= 75 ? 'Excellente' : v >= 60 ? 'Bonne' : v >= 40 ? 'Correcte' : v >= 25 ? 'Tendue' : 'Rompue'; };

  // ==================================================================== envies des joueurs (mercato)
  BM.WANTS = {
    titre: { l: 'Veut jouer le titre' }, argent: { l: 'Veut le plus gros contrat' }, temps: { l: 'Veut du temps de jeu' },
    star: { l: 'Veut être la 1re option' }, dev: { l: 'Veut progresser avec un bon formateur' }, mentor: { l: 'Veut encadrer des jeunes' }
  };
  BM.wantOf = function (p) {
    if (p.want) return p.want;
    var h = (p.id * 2654435761) >>> 0, pick = function (list) { return list[h % list.length]; };
    p.want = p.age >= 31 ? pick(['titre', 'argent', 'mentor', 'titre']) : p.age <= 23 ? pick(['dev', 'temps', 'argent', 'temps']) : BM.ovr(p) >= 82 ? pick(['star', 'titre', 'argent']) : pick(['temps', 'argent', 'titre', 'star']);
    return p.want;
  };
  BM.wantFit = function (g, p, team) {
    var w = BM.wantOf(p), better = BM.roster(g, team).filter(function (x) { return x !== p && BM.ovrRaw(x) > BM.ovrRaw(p); }).length;
    var games = team.record.w + team.record.l, wp = games ? team.record.w / games : 0.5, v = 0, ok;
    if (w === 'titre') v = (team.rep - 60) / 120 + (wp - 0.5) * 0.3;
    else if (w === 'argent') v = -0.04;
    else if (w === 'temps') v = better <= 4 ? 0.15 : better >= 8 ? -0.25 : -0.05;
    else if (w === 'star') v = better === 0 ? 0.25 : better === 1 ? 0 : -0.2;
    else if (w === 'dev') { var a = BM.staffOf ? BM.staffOf(g, 'assistant')[0] : null; v = a ? (a.skills.dev - 11) / 40 : -0.1; }
    else if (w === 'mentor') { var r = BM.roster(g, team), avg = r.reduce(function (s, x) { return s + x.age; }, 0) / Math.max(1, r.length); v = avg < 25.5 ? 0.2 : -0.05; }
    v = clamp(v, -0.3, 0.3);
    ok = v >= 0.05 ? 'good' : v <= -0.1 ? 'bad' : '';
    return { w: w, l: BM.WANTS[w].l, v: v, cls: ok };
  };
})();
