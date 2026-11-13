var BM = globalThis.BM = globalThis.BM || {};

// ==================================================================== v2.1 — Système Social enrichi
// Étend le fil social de js/legacy.js avec :
//  - Trash-talk adversaire (joueur star adverse, coach adverse) en cas de rivalité
//  - Louanges sur exploits (comeback, série de victoires, 50 pts, buzzer beater…)
//  - Headlines média quotidiennes (4 publications distinctes)
//  - Toasts d'exploit animés (réussis par js/ui.js + css/social.css)
// Wrappe BM.afterUserMatch et BM.endDay pour brancher ces hooks sans toucher league.js.
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var fill = function (s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] !== undefined ? o[k] : ''; }); };
  var pick = function (g, arr) { return arr[g.rng.int(0, arr.length - 1)]; };

  // ------------------------------------------------------------------ pools de templates (FR)
  // Trash-talk de fans adverses en cas de rivalité.
  var RIVAL_FAN_TAUNTS = [
    '{S} peut bien mettre {PTS} points, on vous a eu. Bisous.',
    'Le "grand" {S} s\'est fait项链er par notre défense. Reviens quand tu veux.',
    'On vous a sortis de votre arène. {US}-{THEM}, final.不带分.',
    'Cette année c\'est NOTRE tour. {S} a disparu dans le 4e QT.',
    'Toute cette hype pour {PTS} points et une défaite. Triste.',
    'Coach {C}, on espère que tu as un plan B. Le A ne marche pas contre nous.'
  ];
  // Louanges des coéquipiers après un exploit.
  var MATE_EXPLOIT = [
    '{S} est un monstre ce soir. Personne ne l\'arrête.',
    'J\'ai juste à lui passer le ballon. Le goat fait le reste.',
    'On a un leader. {S} porte cette équipe sur ses épaules.',
    '{S} en mode MVP. Honnêtement, j\'assiste au show comme vous.',
    'C\'est ça la culture qu\'on bâtit. {S} montre l\'exemple.',
    'Vous voulez un vrai clutch ? Regardez {S}.',
    'Big up {S}. Cette nuit restera dans les mémoires.',
    'Quand {S} prend feu, on est intouchables. Point.'
  ];
  // Louanges des médias après un exploit.
  var MEDIA_PRAISE = [
    'Les {T} de {C} signent un coup de maître. {S} est intenable ({PTS} pts).',
    'Ce soir, les {T} ont écrit une page d\'histoire. {S} en est le héros.',
    'Performance historique de {S} : {PTS} points, {REB} rebonds, {AST} passes. Les {T} s\'envolent.',
    'Les {T} frappent fort : victoire {US}-{THEM} portée par un {S} magistral.',
    'Le coach {C} a trouvé la formule. {S} l\'exécute à la perfection.'
  ];
  // Réaction adversaire en cas de rivalité gagnée/perdue.
  var OPP_PLAYER_TROLL = [
    'On vous a eu. La prochaine fois, ce sera pire.',
    'Respect pour {S}, mais la victoire est pour nous.',
    'Les {T} parlent trop. Le parquet a parlé.',
    'C\'était juste un match. On se retrouve chez nous.',
    'Pas de panique, on reviendra. Vous n\'avez rien prouvé.'
  ];
  var OPP_PLAYER_SALUTE = [
    'Chapeau {S}. Tu as porté ton équipe.',
    'On a perdu contre le meilleur ce soir. Respect.',
    'Les {T} méritent. On se reverra en playoffs.',
    'Grosse perf de {S}. On prend note.'
  ];
  // 4 outlets médiatiques, chacune avec un style et une teinte distincts.
  BM.MEDIA_OUTLETS = {
    'hoops-daily':   { l: 'Hoops Daily',     color: '#2f7d95', tag: 'hoops-daily' },
    'courtside':     { l: 'Courtside TV',    color: '#7c3aed', tag: 'courtside' },
    'bleacher':      { l: 'Bleacher Africa', color: '#f76707', tag: 'bleacher' },
    'rep-league':    { l: 'Rep League',       color: '#b63a3f', tag: 'rep' }
  };
  var HEADLINE_TEMPLATES = [
    { tpl: '{S} explose les compteurs : {PTS} points ce soir', big: true,Outlet: 'bleacher', cond: function (o) { return o.PTS >= 38; } },
    { tpl: 'Le match de la nuit : {S} plante {PTS} points, les {T} s\'imposent', big: true, Outlet: 'hoops-daily', cond: function (o) { return o.PTS >= 32; } },
    { tpl: 'Triple-double pour {S} ! Les {T} déroulent', big: true, Outlet: 'courtside', cond: function (o) { return o.TD; } },
    { tpl: 'UPSET : les {O} renversent les {T2} ! Personne ne l\'attendait', big: true, Outlet: 'bleacher', cond: function (o) { return o.UPSET; } },
    { tpl: '{HOME} {HS}-{AS} {AWAY} : {MVP} fait la différence', big: false, Outlet: 'hoops-daily', cond: function (o) { return o.MVP; } },
    { tpl: 'OT thriller : {HOME} {HS}-{AS} {AWAY} après prolongation', big: false, Outlet: 'courtside', cond: function (o) { return o.OT; } },
    { tpl: 'Rivalité enflammée : les {T} battent les {O} dans un match électrique', big: false, Outlet: 'rep-league', cond: function (o) { return o.RIVAL; } },
    { tpl: 'Série en cours : {STREAK} victoires d\'affilée pour les {T}', big: false, Outlet: 'hoops-daily', cond: function (o) { return o.STREAK >= 5; } },
    { tpl: 'Les {T} coulent : {LSTREAK} défaites de suite, la direction s\'agite', big: false, Outlet: 'rep-league', cond: function (o) { return o.LSTREAK >= 4; } },
    { tpl: 'Analyse : pourquoi les {T} sont (enfin) dangereux cette saison', big: false, Outlet: 'courtside', cond: function (o) { return o.WP >= 0.65 && o.PLAYED >= 15; } },
    { tpl: 'Le banc des {T} fait la différence : +{BENCH} points ce soir', big: false, Outlet: 'bleacher', cond: function (o) { return o.BENCH >= 45; } },
    { tpl: 'Défense de fer : les {T} tiennent leur adversaire sous {PA} points', big: false, Outlet: 'hoops-daily', cond: function (o) { return o.PA <= 95 && o.WON; } },
    { tpl: 'Quart-temps décisif : les {T} retournent la situation au 4e', big: false, Outlet: 'courtside', cond: function (o) { return o.COMEBACK; } },
    { tpl: '{S} étouffe son vis-à-vis : défense de l\'année ?', big: false, Outlet: 'rep-league', cond: function (o) { return o.STL + o.BLK >= 5; } },
    { tpl: 'Coach {C} sous pression : la direction attend des résultats', big: false, Outlet: 'rep-league', cond: function (o) { return o.LSTREAK >= 3; } }
  ];

  // ------------------------------------------------------------------ headlines
  BM.dailyHeadlines = function (g) {
    if (!g.fixtures) return;
    g.headlines = g.headlines || [];
    var todays = g.fixtures.filter(function (f) { return f.played && f.day === g.day - 1; });
    if (!todays.length) return;
    var added = 0, max = 3;
    todays.forEach(function (f) {
      if (added >= max) return;
      var home = g.teams[f.home], away = g.teams[f.away];
      var mvp = f.mvp ? g.players[f.mvp] : null;
      var mvpBox = mvp && f.mvpBox ? f.mvpBox : null;
      var homeWP = (home.record.w + home.record.l) ? home.record.w / (home.record.w + home.record.l) : 0;
      var awayWP = (away.record.w + away.record.l) ? away.record.w / (away.record.w + away.record.l) : 0;
      var homeWon = f.hs > f.as;
      var upset = (homeWon && awayWP - homeWP > 0.15) || (!homeWon && homeWP - awayWP > 0.15);
      var o = {
        S: mvp ? BM.fullName(mvp) : homeWon ? home.nick : away.nick,
        PTS: mvpBox ? mvpBox.pts : 0, REB: mvpBox ? mvpBox.reb : 0, AST: mvpBox ? mvpBox.ast : 0,
        T: homeWon ? home.nick : away.nick, O: homeWon ? away.nick : home.nick, T2: homeWon ? home.nick : away.nick,
        HOME: home.short, AWAY: away.short, HS: f.hs, AS: f.as, MVP: mvp ? BM.fullName(mvp) : '',
        OT: !!f.overtime, UPSET: upset, RIVAL: BM.isRivalry ? BM.isRivalry(g, f.home, f.away) : false,
        STREAK: parseInt((homeWon ? home.record.streak : away.record.streak).slice(1), 10) || 0,
        LSTREAK: parseInt((homeWon ? away.record.streak : home.record.streak).slice(1), 10) || 0,
        WP: homeWon ? homeWP : awayWP, PLAYED: home.record.w + home.record.l,
        BENCH: 0, PA: homeWon ? f.as : f.hs, WON: true, COMEBACK: !!f.comeback,
        STL: mvpBox ? mvpBox.stl : 0, BLK: mvpBox ? mvpBox.blk : 0,
        C: g.managerName
      };
      // TD : triple-double ?
      if (mvpBox) {
        var cats = [mvpBox.pts, mvpBox.reb, mvpBox.ast, mvpBox.stl, mvpBox.blk].filter(function (v) { return v >= 10; }).length;
        o.TD = cats >= 3;
      } else o.TD = false;
      // Parcourt les templates et prend le premier qui matche pour ce match.
      for (var i = 0; i < HEADLINE_TEMPLATES.length; i++) {
        var t = HEADLINE_TEMPLATES[i];
        if (!t.cond(o)) continue;
        var outlet = BM.MEDIA_OUTLETS[t.Outlet];
        g.headlines.unshift({
          day: g.day - 1, season: g.season, outlet: t.Outlet, source: outlet.l, color: outlet.color,
          title: fill(t.tpl, o), subtitle: mvp ? 'Homme du match : ' + BM.fullName(mvp) + ' (' + (mvpBox ? mvpBox.pts : 0) + ' pts)' : '',
          big: t.big
        });
        if (g.headlines.length > 60) g.headlines.length = 60;
        added++;
        break;
      }
    });
  };

  // ------------------------------------------------------------------ louanges / exploits
  // Déclencheurs d'exploit (avec fan boost et nombre de posts).
  // `sub` est une fonction (o) => string pour pouvoir inclure des valeurs dynamiques.
  var EXPLOIT_TRIGGERS = [
    { id: 'upset',   test: function (g, fx, m, o) { var opp = g.teams[o.oppId]; return o.won && opp.rep > g.teams[g.userTeam].rep + 8; },
      title: 'EXPLOIT DU SOIR', sub: function (o) { return 'Victoire contre un favori'; }, fanBoost: 8000, posts: 3, type: 'win', oncePerDay: true },
    { id: 'streak5', test: function (g, fx, m, o) { return o.won && o.streak >= 5 && o.streak < 10; },
      title: 'EN FORME', sub: function (o) { return 'Série de ' + o.streak + ' victoires'; }, fanBoost: 5000, posts: 2, type: 'win', oncePerSeason: true },
    { id: 'streak10', test: function (g, fx, m, o) { return o.won && o.streak >= 10; },
      title: 'INTOUCHABLES', sub: function (o) { return 'Série de ' + o.streak + ' victoires'; }, fanBoost: 15000, posts: 4, type: 'win', oncePerSeason: true },
    { id: 'comeback', test: function (g, fx, m, o) { return o.won && o.comeback; },
      title: 'REMANIEMENT', sub: function (o) { return 'Remontada signée'; }, fanBoost: 7000, posts: 3, type: 'win', oncePerDay: true },
    { id: 'pts50',   test: function (g, fx, m, o) { return o.star && o.starBox && o.starBox.pts >= 50 && o.starBox.pts < 60; },
      title: 'PERFORMANCE HISTORIQUE', sub: function (o) { return o.starName + ' : ' + o.starBox.pts + ' points'; }, fanBoost: 9000, posts: 4, type: 'record', oncePerDay: true },
    { id: 'pts60',   test: function (g, fx, m, o) { return o.star && o.starBox && o.starBox.pts >= 60; },
      title: 'NUIT HISTORIQUE', sub: function (o) { return o.starName + ' : ' + o.starBox.pts + ' points !'; }, fanBoost: 18000, posts: 5, type: 'record', oncePerDay: true },
    { id: 'td',      test: function (g, fx, m, o) { var b = o.starBox; return b && [b.pts, b.reb, b.ast, b.stl, b.blk].filter(function (v) { return v >= 10; }).length >= 3; },
      title: 'TRIPLE-DOUBLE', sub: function (o) { return o.starName + ' dans l\'histoire'; }, fanBoost: 8000, posts: 3, type: 'record', oncePerDay: true },
    { id: 'rivalwin', test: function (g, fx, m, o) { return o.won && o.rivalHeat >= 75; },
      title: 'RIVALITÉ REMPORTÉE', sub: function (o) { return 'Les ' + o.meNick + ' dominent'; }, fanBoost: 6000, posts: 3, type: 'rivalry', oncePerDay: true }
  ];

  // Anti-re-déclenchement par saison.
  var exploitKey = function (g, id) { return g.season + ':' + id; };

  BM.checkPraises = function (g, fx, m) {
    var userSide = fx.home === g.userTeam ? 0 : 1;
    var us = m.score[userSide], them = m.score[1 - userSide];
    var won = us > them;
    var me = g.teams[g.userTeam];
    var streak = parseInt((me.record.streak || 'V0').slice(1), 10) || 0;
    var opp = g.teams[userSide === 0 ? fx.away : fx.home];
    var star = m.roster[userSide].slice().sort(function (a, b) { return m.box[b.id].pts - m.box[a.id].pts; })[0];
    var o = {
      won: won, oppId: opp.id, streak: streak, comeback: !!m.comeback,
      star: star, starBox: star ? m.box[star.id] : null, starName: star ? BM.fullName(star) : '',
      rivalHeat: BM.rivalryHeat ? BM.rivalryHeat(g, g.userTeam, opp.id) : 0,
      meNick: me.nick
    };
    var triggered = [];
    g.exploitsFired = g.exploitsFired || {};
    EXPLOIT_TRIGGERS.forEach(function (t) {
      var ok = false;
      try { ok = t.test(g, fx, m, o); } catch (e) { ok = false; }
      if (!ok) return;
      // Anti re-déclenchement : par saison pour streak5/streak10 (une fois par saison, pas par match qui étend la série)
      // et par jour pour les autres.
      var key = exploitKey(g, t.id);
      if (t.oncePerSeason) {
        if (g.exploitsFired[key]) return;
        g.exploitsFired[key] = 1;
      } else if (t.oncePerDay) {
        if (g.exploitsFired[key] === g.day) return;
        g.exploitsFired[key] = g.day;
      }
      triggered.push(t);
    });
    if (!triggered.length) return;
    // Boost de fans + posts + toast (cf js/ui.js + css/social.css)
    var totalFanBoost = 0, totalPosts = 0, biggest = null;
    triggered.forEach(function (t) {
      totalFanBoost += t.fanBoost;
      totalPosts += t.posts;
      if (!biggest || t.fanBoost > biggest.fanBoost) biggest = t;
    });
    if (fx.type === 'playoff') totalFanBoost = Math.round(totalFanBoost * 1.5);
    me.fans = (me.fans || BM.fansOf(me)) + totalFanBoost;
    // Toast exploit (le plus gros déclencheur l'emporte visuellement).
    if (BM.fireExploitToast && biggest) {
      BM.fireExploitToast(biggest.type, biggest.title, biggest.sub(o), totalFanBoost);
    }
    // Posts de louanges : moitié médias, moitié fans + coéquipiers.
    var ctx = { S: o.starName, PTS: o.starBox ? o.starBox.pts : 0, REB: o.starBox ? o.starBox.reb : 0, AST: o.starBox ? o.starBox.ast : 0,
                T: me.nick, C: g.managerName, US: us, THEM: them, O: opp.nick };
    var outlets = ['hoops-daily', 'courtside', 'bleacher', 'rep-league'];
    for (var i = 0; i < totalPosts; i++) {
      if (i % 2 === 0) {
        var oKey = pick(g, outlets);
        var outlet = BM.MEDIA_OUTLETS[oKey];
        BM.post(g, outlet.l, '@' + oKey, fill(pick(g, MEDIA_PRAISE), ctx), false, Math.round(BM.fansOf(me) * 0.012 + 600));
      } else if (i % 3 === 1 && star) {
        var mate = m.roster[userSide].filter(function (p) { return p.id !== (star ? star.id : -1); }).sort(function (a, b) { return m.box[b.id].pts - m.box[a.id].pts; })[0];
        if (mate) {
          var h = '@' + (mate.first + mate.last).toLowerCase().replace(/[^a-z]/g, '');
          BM.post(g, BM.fullName(mate), h, fill(pick(g, MATE_EXPLOIT), ctx), false, Math.round(BM.fansOf(me) * 0.008 + 300));
        }
      } else {
        var fanHandle = '@' + pick(g, ['ballislife225', 'dakar_hoops', 'kinshasa_courtside', 'mamba_mentale', 'parquet_fr', 'triple_double_tv']);
        BM.post(g, 'Fan', fanHandle, fill(pick(g, MATE_EXPLOIT), ctx), false, Math.round(BM.fansOf(me) * 0.006 + 200));
      }
    }
    // Message inbox du board si exploit notable.
    if (totalFanBoost >= 8000) {
      BM.addMessage(g, 'La direction s\'enflamme',
        'Le board des ' + me.name + ' te félicite pour cette performance. Les fans affluent (' + BM.fmtN(totalFanBoost) + ' nouveaux).',
        'board', null);
      if (g.inbox[0]) g.inbox[0].kind = 'praise';
      g.board.confidence = clamp(g.board.confidence + 3, 0, 100);
    }
    // En cas de rivalité gagnée, le joueur star adverse peut saluer (louanges inversées).
    if (won && o.rivalHeat >= 75 && g.rng.chance(0.4)) {
      var oppRoster = BM.roster(g, opp);
      var oppStar = oppRoster.slice().sort(function (a, b) { return BM.ovr(b) - BM.ovr(a); })[0];
      if (oppStar) {
        var h2 = '@' + (oppStar.first + oppStar.last).toLowerCase().replace(/[^a-z]/g, '');
        BM.post(g, BM.fullName(oppStar), h2, fill(pick(g, OPP_PLAYER_SALUTE), ctx), false, Math.round(BM.fansOf(opp) * 0.004 + 150));
      }
    }
  };

  // ------------------------------------------------------------------ override BM.socialAfterMatch
  // On wrappe la version legacy pour amplifier en cas de rivalité et appeler checkPraises.
  var legacySocialAfterMatch = BM.socialAfterMatch;
  BM.socialAfterMatch = function (g, fx, m, focusId) {
    // Appelle d'abord la version legacy (posts de base, fan/opp-fan/media).
    if (legacySocialAfterMatch) legacySocialAfterMatch(g, fx, m, focusId);
    // Hook rivalité : ajuste la heat + génère du trash-talk.
    if (BM.rivalryAfterMatch) BM.rivalryAfterMatch(g, fx, m);
    var userSide = fx.home === g.userTeam ? 0 : 1;
    var opp = g.teams[userSide === 0 ? fx.away : fx.home];
    var heat = BM.rivalryHeat ? BM.rivalryHeat(g, g.userTeam, opp.id) : 0;
    var won = m.score[userSide] > m.score[1 - userSide];
    if (heat >= 50) {
      // Trash-talk d'un joueur adverse star (surtout si l'utilisateur a perdu).
      if (!won && g.rng.chance(0.55)) {
        var oppRoster = BM.roster(g, opp);
        var oppStar = oppRoster.slice().sort(function (a, b) { return BM.ovr(b) - BM.ovr(a); })[0];
        if (oppStar) {
          var h = '@' + (oppStar.first + oppStar.last).toLowerCase().replace(/[^a-z]/g, '');
          var star = g.players[focusId];
          var ctx = { S: star ? BM.shortName(star) : g.teams[g.userTeam].nick, T: g.teams[g.userTeam].nick, US: m.score[userSide], THEM: m.score[1 - userSide] };
          BM.post(g, BM.fullName(oppStar), h, fill(pick(g, heat >= 75 ? OPP_PLAYER_TROLL : OPP_PLAYER_SALUTE), ctx),
                  false, Math.round(BM.fansOf(opp) * 0.006 + 200));
        }
      }
      // Fan adverse taunt en cas de rivalité forte et défaite.
      if (!won && g.rng.chance(0.5)) {
        var me = g.teams[g.userTeam];
        var star2 = g.players[focusId];
        var b = star2 ? m.box[star2.id] : null;
        var ctx2 = { S: star2 ? BM.fullName(star2) : me.nick, PTS: b ? b.pts : 0, US: m.score[userSide], THEM: m.score[1 - userSide], C: g.managerName };
        BM.post(g, 'Fan adverse ' + opp.nick, '@' + opp.short.toLowerCase() + '_fan', fill(pick(g, RIVAL_FAN_TAUNTS), ctx2), false,
                Math.round(BM.fansOf(opp) * 0.004 + 100));
      }
    }
    // Louanges sur exploits.
    if (BM.checkPraises) BM.checkPraises(g, fx, m);
  };

  // ------------------------------------------------------------------ hook pre-match (sera wrappé côté main.js car UI n'est pas encore défini ici)
  // BM.rivalryPreMatchTaunt est défini dans js/rivalries.js ; le wrap de UI.preMatch se fait dans js/main.js après le boot.

  // ------------------------------------------------------------------ wrap BM.endDay
  // On injecte BM.dailyHeadlines + BM.rivalryDecay après le endDay original.
  var legacyEndDay = BM.endDay;
  if (legacyEndDay) {
    BM.endDay = function (g) {
      legacyEndDay(g);
      if (BM.dailyHeadlines) BM.dailyHeadlines(g);
      if (BM.rivalryDecay) BM.rivalryDecay(g);
    };
  }

  // ------------------------------------------------------------------ wrap BM.startNewSeason
  var legacyStartNewSeason = BM.startNewSeason;
  if (legacyStartNewSeason) {
    BM.startNewSeason = function (g) {
      legacyStartNewSeason(g);
      if (BM.rivalryNewSeason) BM.rivalryNewSeason(g);
    };
  }

  // ------------------------------------------------------------------ formatage de nombres (helper manquant)
  // Format compact à la française : 800 -> "800", 8400 -> "8,4k", 125000 -> "125k", 1.2M -> "1,2M".
  // Corrige un bug latent du codebase original (BM.fmtN était utilisé mais jamais défini).
  BM.fmtN = function (n) {
    n = +n || 0;
    var sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n < 1000) return sign + String(Math.round(n));
    if (n < 10000) return sign + (n / 1000).toFixed(1).replace('.', ',') + 'k';
    if (n < 1000000) return sign + Math.round(n / 1000) + 'k';
    return sign + (n / 1000000).toFixed(1).replace('.', ',') + 'M';
  };

  // ------------------------------------------------------------------ wrap BM.handleMessageAction
  // Intercepte les actions 'rivalryReply' (réponses aux taunts de coach adverse).
  var legacyHandleMsg = BM.handleMessageAction;
  if (legacyHandleMsg) {
    BM.handleMessageAction = function (g, msgId, idx) {
      var m = g.inbox.find(function (x) { return x.id === msgId; });
      if (m && m.actions && m.actions[idx] && m.actions[idx].act === 'rivalryReply') {
        var a = m.actions[idx];
        m.actions = null;
        var res = BM.rivalryReply(g, a);
        m.resolved = 'Votre réponse : « ' + a.label + ' » — ' + res;
        return m.resolved;
      }
      return legacyHandleMsg(g, msgId, idx);
    };
  }

  // ------------------------------------------------------------------ toast d'exploit (helper UI)
  // Crée un élément dans #exploit-toast-root avec la classe CSS qui va bien.
  // Garde : si on est en Node (tests), document n'existe pas — on skippe juste la partie visuelle.
  BM.fireExploitToast = function (type, title, subtitle, fanBoost) {
    if (typeof document === 'undefined') return;
    var root = document.getElementById('exploit-toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'exploit-toast ' + (type || 'win');
    el.innerHTML = '<div class="et-icon"></div>' +
      '<div class="et-body"><b>' + UI.esc(title) + '</b><span>' + UI.esc(subtitle) + '</span></div>' +
      '<div class="et-boost">+' + BM.fmtN(fanBoost) + ' fans</div>';
    root.appendChild(el);
    if (BM.Juice) {
      BM.Juice.sound('win');
      BM.Juice.haptic('heavy');
      if (type === 'rivalry' || type === 'record') setTimeout(function () { BM.Juice.confetti(['#f2c94c', '#ffffff']); }, 200);
    }
    setTimeout(function () { el.classList.add('dismiss'); }, 3600);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 4000);
  };

  // ------------------------------------------------------------------ wrap BM.newGame pour init rivalités
  var legacyNewGame = BM.newGame;
  if (legacyNewGame) {
    BM.newGame = function (opts) {
      var g = legacyNewGame(opts);
      if (BM.rivalryInit) BM.rivalryInit(g);
      return g;
    };
  }

  // ------------------------------------------------------------------ wrap BM.applyResult
  // On veut que les matchs entre deux équipes IA de rivalité amplifient aussi la heat.
  var legacyApplyResult = BM.applyResult;
  if (legacyApplyResult) {
    BM.applyResult = function (g, fx, m) {
      legacyApplyResult(g, fx, m);
      if (BM.rivalryAfterAnyMatch && (fx.home !== g.userTeam && fx.away !== g.userTeam)) {
        BM.rivalryAfterAnyMatch(g, fx, m);
      }
    };
  }

  // ------------------------------------------------------------------ wrapper de BM.serialize/deserialize pour migrer les vieilles saves
  var legacyDeserialize = BM.deserialize;
  if (legacyDeserialize) {
    BM.deserialize = function (s) {
      var g = legacyDeserialize(s);
      if (g && !g.rivalries && BM.rivalryInit) {
        BM.rivalryInit(g);
      }
      if (g && g.mode === 'career') {
        // Mode carrière supprimé en v2.1 : on bascule la sauvegarde en mode manager en gardant l'équipe.
        g.mode = undefined;
        if (g.userTeam < 0) g.userTeam = 0;
      }
      return g;
    };
  }
})();
