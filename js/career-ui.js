var BM = globalThis.BM = globalThis.BM || {};
var UI = BM.UI;

// ==================================================================== interface du mode « Ma Carrière »
(function () {
  var esc = function (s) { return UI.esc(s); };
  var pct = function (v) { return Math.round(v); };
  UI.cTab = 'day';

  var CICONS = {
    day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    player: '<circle cx="12" cy="7" r="4"/><path d="M4 21c.8-4.4 4-7 8-7s7.2 2.6 8 7"/>',
    life: '<path d="M12 21s-7-4.4-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z"/>',
    media: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    league: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    career: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>'
  };
  var cIcon = function (k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + CICONS[k] + '</svg>'; };

  // ---------------------------------------------------------------- rendu principal
  UI.cRender = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g), app = document.getElementById('app');
    var tabs = [['day', 'Journée'], ['player', 'Joueur'], ['life', 'Vie'], ['media', 'Médias'], ['league', 'Ligue'], ['career', 'Carrière']];
    var screenKey = 'c/' + UI.cTab, enter = screenKey !== UI.lastScreen;
    UI.lastScreen = screenKey;
    var game = BM.careerIsGameDay(g) && !(C.today && C.today.played);
    var where = t ? t.name : p.college + ' · ' + BM.CAREER_PATHS[C.path].l;
    app.innerHTML = '<div class="app career" style="--team:' + (t ? t.color : '#3bc9db') + '">' +
      '<header class="topbar">' + BM.portrait(p, t, 30) +
      '<div class="who"><b>' + esc(BM.fullName(p)) + ' <span class="cnum">#' + p.number + '</span></b><span>' + esc(where) + ' · ' + esc(BM.dateLabel(g)) + '</span></div>' +
      '<span class="cstat">' + UI.ovrBadge(BM.ovr(p)) + '</span>' +
      '<button class="btn sm" data-act="cFast" title="Avancer jusqu\'au prochain match">▶▶</button>' +
      '<button class="btn primary' + (game ? ' pulse' : '') + '" data-act="cNext">' + (game ? 'Match !' : 'Jour suivant') + '</button></header>' +
      '<main class="page' + (enter ? ' enter' : '') + '">' + UI['c_' + UI.cTab]() + '</main>' +
      '<nav class="nav"><div class="nav-inner">' + tabs.map(function (x) {
        return '<button data-act="cTab" data-tab="' + x[0] + '" class="' + (UI.cTab === x[0] ? 'on' : '') + '"><span>' + cIcon(x[0]) + '</span>' + x[1] + '</button>';
      }).join('') + '</div></nav></div>';
    UI.afterRender();
    UI.cCine();
  };

  UI.actions.cTab = function (el) { UI.cTab = el.dataset.tab; if (BM.Juice) { BM.Juice.sound('nav'); BM.Juice.haptic('light'); } UI.render(); window.scrollTo(0, 0); };

  var meter = function (label, v, cls) { return '<div class="cm"><span>' + label + '</span>' + UI.bar(v) + '<b>' + pct(v) + '</b></div>'; };

  // ---------------------------------------------------------------- Journée
  UI.c_day = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g), T = C.today || { morning: [] };
    var st = C.phase === 'nba' ? BM.CAREER_STATUS[C.status] : null;
    var head = '<div class="card chead"><div class="chead-in">' + BM.portrait(p, t, 64) +
      '<div class="chead-id"><h2>' + esc(BM.fullName(p)) + '</h2><p class="small muted">' + BM.POS_LABEL[p.pos] + ' · ' + p.age + ' ans · ' + p.height + ' cm · ' +
      esc((BM.CAREER_ARCH[p.pos].find(function (a) { return a.id === C.arch; }) || {}).l || '') + '</p>' +
      '<div class="chips">' + UI.ovrBadge(BM.ovr(p)) + '<span class="tag">pot. ' + BM.potDisplay(p) + '</span>' +
      (st ? '<span class="tag good">' + st.l + ' · ~' + Math.round(BM.careerMinutes(g)) + ' min</span>' : '<span class="tag warn">Prospect · ' + (BM.careerMockRank(g)) + 'e au mock draft</span>') +
      '<span class="tag">' + C.pp + ' PP</span>' + (p.injury > 0 ? '<span class="tag bad">Blessé ' + p.injury + ' j</span>' : '') + '</div></div></div>' +
      '<div class="cmeters">' + meter('Énergie', p.condition) + meter('Moral', p.morale) + meter('Santé', C.health) + meter('Réputation', C.rep) +
      meter('Coach', C.confCoach) + meter('Vestiaire', C.confMates) + '</div></div>';
    return head + UI.cTodayCard() + UI.cTrainingCard() + (C.phase === 'prospect' ? UI.cProspectCard() : '') + UI.cLogCard(8);
  };

  UI.cTodayCard = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), T = C.today || { morning: [] };
    var html = '<div class="card wide today"><div class="card-h"><h2>' + esc(BM.dateLabel(g)) + '</h2><span class="small muted">' + (BM.careerIsGameDay(g) && !T.played ? 'Jour de match' : 'Journée') + '</span></div>' +
      '<div class="msgs">' + (T.morning || []).map(function (m) { return '<div>' + esc(m) + '</div>'; }).join('') + '</div>';
    // Match du jour.
    var fx = BM.careerTeamGameToday(g);
    if (fx) {
      var opp = g.teams[fx.home === p.teamId ? fx.away : fx.home];
      html += '<div class="gamebox"><div><b>' + (fx.home === p.teamId ? 'vs ' : '@ ') + esc(opp.name) + '</b><span class="small muted"> · ' + opp.record.w + 'V-' + opp.record.l + 'D' + (fx.type === 'playoff' ? ' · playoffs' : '') + '</span></div>' +
        UI.cMentSeg() + '<button class="btn primary block" data-act="cNext">Aller au match</button></div>';
    } else if (BM.careerProspectGameToday(g)) {
      var info = BM.careerProspectOpp(g);
      html += '<div class="gamebox"><div><b>' + esc(p.college) + ' vs ' + esc(info.opp) + '</b><span class="small muted"> · ' + esc(info.label) + '</span></div>' + UI.cMentSeg() +
        '<div class="ch3"><button class="btn" data-act="cProspect" data-v="take">Prendre le match en main<br><small>Plus de tirs, plus de risques</small></button>' +
        '<button class="btn" data-act="cProspect" data-v="normal">Jouer ton jeu<br><small>Équilibré</small></button>' +
        '<button class="btn" data-act="cProspect" data-v="team">Faire jouer les autres<br><small>Les scouts aiment le QI basket</small></button></div></div>';
    }
    // Événement en attente.
    if (T.event) {
      html += '<div class="evt"><h3>' + esc(T.event.t) + '</h3><p>' + esc(T.event.txt) + '</p><div class="evt-c">' + T.event.labels.map(function (l, i) {
        return '<button class="btn" data-act="cEvent" data-i="' + i + '">' + esc(l) + '</button>';
      }).join('') + '</div></div>';
    }
    if (T.eventDone) html += '<div class="evt done"><b>' + esc(T.eventDone.t) + '</b> — ' + esc(T.eventDone.choice) + '<p>' + esc(T.eventDone.res) + '</p></div>';
    // Soirée.
    if (T.evening) html += '<div class="msgs evening">' + T.evening.map(function (m) { return '<div>' + esc(m) + '</div>'; }).join('') + '</div>';
    else if (!fx || T.played) html += UI.cActivities();
    return html + '</div>';
  };

  UI.cMentSeg = function () {
    var C = UI.g.career;
    return '<div class="seg cment">' + Object.keys(BM.CAREER_MENT).map(function (k) {
      return '<button data-act="cMent" data-v="' + k + '" class="' + (C.ment === k ? 'on' : '') + '" title="' + esc(BM.CAREER_MENT[k].d) + '">' + BM.CAREER_MENT[k].l + '</button>';
    }).join('') + '</div><p class="hint" style="margin:0">' + esc(BM.CAREER_MENT[C.ment].d) + '</p>';
  };
  UI.actions.cMent = function (el) { UI.g.career.ment = el.dataset.v; UI.save(); UI.render(); };

  UI.cActivities = function () {
    var g = UI.g, C = g.career;
    return '<h3 style="margin:10px 0 6px">Ta soirée</h3><div class="acts">' + BM.CAREER_ACT_CATS.map(function (cat) {
      return '<div class="actcat"><span class="lbl">' + cat + '</span>' + BM.CAREER_ACTS.filter(function (a) { return a.cat === cat; }).map(function (a) {
        var dis = (a.c && C.money < a.c);
        return '<button class="act" data-act="cAct" data-v="' + a.id + '" title="' + esc(a.d) + '"' + (dis ? ' disabled' : '') + '><b>' + esc(a.l) + (a.c ? ' <em>' + BM.money(a.c) + '</em>' : '') + '</b><span>' + esc(a.d) + '</span></button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  };

  UI.actions.cAct = function (el) {
    var res = BM.careerDoActivity(UI.g, el.dataset.v);
    if (res && res.fail) { UI.toast(res.msgs[0]); return; }
    if (BM.Juice) BM.Juice.haptic('light');
    UI.save(); UI.render();
  };
  UI.actions.cEvent = function (el) {
    var res = BM.careerResolveEvent(UI.g, +el.dataset.i);
    UI.toast(res);
    UI.save(); UI.render();
  };

  UI.cTrainingCard = function () {
    var C = UI.g.career;
    var d = C.demand;
    return '<div class="card"><div class="card-h"><h2>Entraînement</h2>' + (d ? '<span class="small muted">Objectif du coach : <b>' + BM.CAREER_FOCUS[d.f].l + '</b> (' + d.done + '/3, ' + d.left + ' sem.)</span>' : '') + '</div>' +
      '<div class="seg wrap">' + Object.keys(BM.CAREER_FOCUS).map(function (k) {
        return '<button data-act="cFocus" data-v="' + k + '" class="' + (C.training.focus === k ? 'on' : '') + '">' + BM.CAREER_FOCUS[k].l + (d && d.f === k ? ' ★' : '') + '</button>';
      }).join('') + '</div><div class="seg" style="margin-top:6px">' + Object.keys(BM.CAREER_INTENS).map(function (k) {
        return '<button data-act="cInten" data-v="' + k + '" class="' + (C.training.inten === k ? 'on' : '') + '">' + BM.CAREER_INTENS[k].l + '</button>';
      }).join('') + '</div><p class="hint" style="margin:6px 0 0">Travaille : ' + BM.CAREER_FOCUS[C.training.focus].a.map(function (k) { return BM.ATTRS.find(function (a) { return a.k === k; }).l; }).join(', ') +
      '. Suivre l\'objectif du coach fait monter sa confiance. L\'intensité élevée accélère la progression mais fatigue et expose aux blessures.</p></div>';
  };
  UI.actions.cFocus = function (el) { UI.g.career.training.focus = el.dataset.v; UI.save(); UI.render(); };
  UI.actions.cInten = function (el) { UI.g.career.training.inten = el.dataset.v; UI.save(); UI.render(); };

  UI.cProspectCard = function () {
    var g = UI.g, C = g.career, P = C.prospect, path = BM.CAREER_PATHS[C.path];
    var played = P.games.filter(function (x) { return x.min > 0; });
    var av = function (k) { return played.length ? (played.reduce(function (s, x) { return s + x[k]; }, 0) / played.length).toFixed(1) : '-'; };
    var over = P.games.length >= P.sched.length;
    return '<div class="card"><div class="card-h"><h2>Saison de prospect</h2><span class="small muted">' + esc(path.l) + ' · ' + P.w + 'V-' + P.l + 'D</span></div>' +
      '<div class="grid2"><div class="kpi"><b>' + BM.careerMockRank(g) + '<sup>e</sup></b><span>Mock draft</span></div>' +
      '<div class="kpi"><b>' + av('pts') + '</b><span>pts · ' + av('reb') + ' reb · ' + av('ast') + ' pd</span></div></div>' +
      '<p class="hint" style="margin:6px 0">' + esc(path.d) + '</p>' +
      (over ? '<div class="btn-row"><button class="btn" data-act="cCombine"' + (P.combine !== null ? ' disabled' : '') + '>Draft combine</button><button class="btn" data-act="cWorkout"' + (P.workouts >= 4 ? ' disabled' : '') + '>Workout avec une franchise (' + Math.floor(P.workouts) + '/4)</button></div>' : '') +
      (P.games.length ? '<div class="table-wrap"><table><thead><tr><th>Adversaire</th><th class="num">Min</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Pd</th><th class="num">Tirs</th><th class="num">Rés.</th></tr></thead><tbody>' +
        P.games.slice(-6).reverse().map(function (x) {
          return '<tr><td>' + esc(x.opp) + (x.cup ? ' <span class="tag legend">' + esc(path.cup) + '</span>' : '') + '</td><td class="num">' + x.min + '</td><td class="num"><b>' + x.pts + '</b></td><td class="num">' + x.reb + '</td><td class="num">' + x.ast + '</td><td class="num">' + x.fgm + '/' + x.fga + '</td><td class="num" style="color:' + (x.win ? 'var(--good)' : 'var(--bad)') + '">' + (x.win ? 'V' : 'D') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '') + '</div>';
  };
  UI.actions.cCombine = function () { UI.toast(BM.careerCombine(UI.g)); UI.save(); UI.render(); };
  UI.actions.cWorkout = function () { UI.toast(BM.careerWorkout(UI.g)); UI.save(); UI.render(); };

  UI.cLogCard = function (n) {
    var g = UI.g, C = g.career;
    return '<div class="card"><h2 style="margin-bottom:6px">Journal</h2>' + (C.log.length ? '<div class="clog">' + C.log.slice(0, n).map(function (l) {
      return '<div><span>' + esc(BM.dateOf(g, l.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })) + '</span>' + esc(l.t) + '</div>';
    }).join('') + '</div>' : '<p class="muted small">Rien pour l\'instant.</p>') + '</div>';
  };

  // ---------------------------------------------------------------- avancer
  UI.actions.cNext = function () { UI.cAdvance(false); };
  UI.actions.cFast = function () { UI.cAdvance(true); };

  UI.cAdvance = function (fast) {
    var g = UI.g, C = g.career;
    for (var n = 0; n < 40; n++) {
      if (fast && C.today && !C.today.act && !BM.careerIsGameDay(g)) BM.careerDoActivity(g, 'repos');
      var r = BM.careerNext(g);
      if (r.state === 'ok') { if (fast && !BM.careerIsGameDay(g) && !(C.today && C.today.event)) continue; break; }
      if (r.state === 'event') { UI.toast('Un événement attend ta réponse.'); break; }
      if (r.state === 'prospectGame') { UI.toast('Jour de match : choisis ton approche.'); break; }
      if (r.state === 'match') { UI.save(); UI.cPreMatch(r.fx); return; }
      if (r.state === 'draft') { UI.save(); UI.cDraft(); return; }
      if (r.state === 'seasonEnd') {
        BM.careerSnapshotSeason(g);
        var sum = BM.endSeason(g);
        BM.careerSeasonEnd(g, sum);
        UI.save(); UI.cOffseason(); return;
      }
      if (r.state === 'offseason') { UI.cOffseason(); return; }
      break;
    }
    UI.cTab = 'day';
    UI.save(); UI.render();
  };

  // ---------------------------------------------------------------- match du prospect
  UI.actions.cProspect = function (el) {
    var g = UI.g, L = BM.careerPlayProspect(g, el.dataset.v), C = g.career;
    UI.save();
    if (BM.Juice) { BM.Juice.sound(L.win ? 'win' : 'lose'); BM.Juice.haptic('medium'); }
    UI.modal('<div class="result-banner"><h2 class="' + (L.win ? 'win' : 'loss') + '">' + (L.win ? 'Victoire' : 'Défaite') + '</h2></div>' +
      '<div class="card wide"><p style="margin:0"><b>' + esc(BM.cPlayer(g).college) + ' ' + L.score + ' ' + esc(L.opp) + '</b> · ' + esc(L.label) + '</p>' + UI.cLine(L) + '</div>' +
      (C.postGame.news.length ? '<p class="small" style="margin:0">' + esc(C.postGame.news.join(' ')) + '</p>' : '') +
      '<p class="small muted" style="margin:0">Mock draft : ' + BM.careerMockRank(g) + 'e · réputation ' + Math.round(C.rep) + '</p>' +
      '<button class="btn primary block" data-act="cCloseRender">Continuer</button>');
  };
  UI.actions.cCloseRender = function () { UI.modalLocked = false; UI.closeModal(); UI.render(); };

  UI.cLine = function (L) {
    if (L.dnp) return '<p class="muted" style="margin:6px 0 0">' + (L.susp ? 'Suspendu.' : 'Tu n\'as pas joué.') + '</p>';
    return '<div class="cline"><div><b>' + L.pts + '</b><span>pts</span></div><div><b>' + L.reb + '</b><span>reb</span></div><div><b>' + L.ast + '</b><span>pd</span></div>' +
      '<div><b>' + L.fgm + '/' + L.fga + '</b><span>tirs</span></div><div><b>' + L.tpm + '/' + L.tpa + '</b><span>3 pts</span></div><div><b>' + (L.stl + L.blk) + '</b><span>int+ctr</span></div><div><b>' + L.min + '</b><span>min</span></div></div>';
  };

  // ---------------------------------------------------------------- match NBA
  UI.cPreMatch = function (fx) {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g), opp = g.teams[fx.home === t.id ? fx.away : fx.home];
    var star = BM.roster(g, opp).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); })[0];
    UI.modalLocked = true;
    UI.pendingFx = fx;
    var out = p.injury > 0 || C.suspended;
    UI.modal('<div class="modal-h"><h2>' + (fx.type === 'playoff' ? BM.ROUND_NAMES[fx.round] + ' · match ' + fx.game : 'Journée ' + fx.round) + '</h2></div>' +
      '<div class="card wide"><div class="vs"><div class="t">' + UI.teamBadge(t) + esc(t.name) + '<span class="small muted">' + t.record.w + 'V-' + t.record.l + 'D</span></div>' +
      '<div class="mid">VS</div><div class="t">' + UI.teamBadge(opp) + esc(opp.name) + '<span class="small muted">' + opp.record.w + 'V-' + opp.record.l + 'D</span></div></div></div>' +
      '<div class="card"><h3>Ton rôle ce soir</h3><p class="small" style="margin:4px 0 0">' + (out ? (p.injury > 0 ? 'Blessé : tu regardes depuis le banc.' : 'Suspendu ce soir.') :
        BM.CAREER_STATUS[C.status].l + ' · environ ' + Math.round(BM.careerMinutes(g)) + ' minutes prévues par le coach.') + '</p>' +
      '<p class="small muted" style="margin:4px 0 0">Leur star : ' + esc(BM.fullName(star)) + ' (' + BM.ovr(star) + ').</p></div>' +
      '<div class="card"><h3 style="margin-bottom:6px">Mentalité</h3>' + UI.cMentSeg() + '</div>' +
      '<p class="hint" style="margin:0">En direct, le jeu s\'arrête sur les moments clés de ton match (pick and roll, mismatch, dernière possession…) et c\'est toi qui décides. En simulation, pas de moments clés.</p>' +
      '<button class="btn primary block" data-act="cLive"' + (out ? ' disabled' : '') + '>Jouer le match en direct</button>' +
      '<button class="btn block" data-act="cSim">Simuler le match</button>');
  };

  UI.actions.cLive = function () {
    UI.modalLocked = false;
    var m = new BM.Match(UI.g, UI.pendingFx);
    BM.careerSetupMatch(m, UI.g, true);
    UI.live = { m: m, fx: UI.pendingFx, speed: 1, playing: true, timer: null, sel: null, panel: null };
    UI.renderMatch();
    UI.schedule();
  };
  UI.actions.cSim = function () {
    var m = new BM.Match(UI.g, UI.pendingFx);
    BM.careerSetupMatch(m, UI.g, false);
    m.simulateAll();
    UI.live = { m: m, fx: UI.pendingFx };
    UI.finishMatch();
  };

  // Résultat du match pour le joueur, puis interview.
  UI.cFinishMatch = function () {
    var L = UI.live, g = UI.g, m = L.m, fx = L.fx, C = g.career, p = BM.cPlayer(g);
    var side = fx.home === p.teamId ? 0 : 1, won = m.score[side] > m.score[1 - side];
    var pg = C.postGame || {}, line = pg.line || { dnp: true }, d = pg.deltas || {};
    var dl = function (label, v) { if (!v) return ''; var r = Math.round(v * 10) / 10; return '<div><b class="' + (r >= 0 ? 'good' : 'bad') + '">' + (r > 0 ? '+' : '') + String(r).replace('.', ',') + '</b><span>' + label + '</span></div>'; };
    UI.modalLocked = true;
    if (BM.Juice) { BM.Juice.sound(won ? 'win' : 'lose'); BM.Juice.haptic(won ? 'heavy' : 'medium'); }
    if (won && BM.Juice) setTimeout(function () { BM.Juice.confetti([BM.cTeam(g).color, '#ffd43b', '#ffffff', '#3bc9db']); }, 250);
    UI.modal('<div class="result-banner"><h2 class="' + (won ? 'win' : 'loss') + '">' + (won ? 'Victoire' : 'Défaite') + '</h2></div>' +
      '<div class="card wide"><div class="sb"><div class="t">' + UI.teamBadge(m.side[0], true) + esc(m.side[0].short) + '</div><div class="score">' + m.score[0] + ' – ' + m.score[1] + '</div><div class="t away">' + esc(m.side[1].short) + UI.teamBadge(m.side[1], true) + '</div></div>' +
      '<div class="mvp-line">' + BM.portrait(p, BM.cTeam(g), 44) + '<div><b>Ta soirée</b>' + (line.gw ? ' <span class="tag legend">Panier de la gagne</span>' : '') + (line.decisions ? ' <span class="tag">' + line.decisions + ' décision(s)</span>' : '') + '</div></div>' + UI.cLine(line) + '</div>' +
      '<div class="card"><div class="cdeltas">' + dl('réputation', d.rep) + dl('confiance coach', d.confCoach) + dl('coéquipiers', d.confMates) + dl('moral', d.morale) + (pg.pp ? '<div><b class="good">+' + pg.pp + '</b><span>PP</span></div>' : '') + '</div>' +
      (pg.badges && pg.badges.length ? '<p class="small" style="margin:6px 0 0">Badge débloqué : <b>' + esc(pg.badges.join(', ')) + '</b></p>' : '') +
      (pg.status ? '<p class="small" style="margin:6px 0 0">Nouveau statut : <b>' + BM.CAREER_STATUS[pg.status.now].l + '</b></p>' : '') +
      (line.injured ? '<p class="small" style="margin:6px 0 0;color:var(--bad)">Blessé : ' + line.injured + ' jours d\'absence.</p>' : '') + '</div>' +
      UI.whyCard(fx.why) +
      '<button class="btn primary block" data-act="cAfterMatch">' + (C.interview ? 'Zone mixte : interview' : 'Continuer') + '</button>');
  };

  UI.actions.cAfterMatch = function () {
    UI.live = null;
    if (UI.g.career.interview) { UI.cInterview(); return; }
    UI.modalLocked = false; UI.closeModal(); UI.save(); UI.render();
  };

  UI.cInterview = function (last) {
    var C = UI.g.career, iv = C.interview;
    if (!iv) { UI.modalLocked = false; UI.closeModal(); UI.save(); UI.render(); if (last) UI.toast(last); return; }
    var q = iv.qs[iv.i];
    UI.modalLocked = true;
    UI.modal('<div class="modal-h"><h2>Zone mixte</h2><span class="small muted">' + esc(iv.j) + '</span></div>' +
      (last ? '<p class="small muted" style="margin:0">' + esc(last) + '</p>' : '') +
      '<div class="mic"><p class="qtext">« ' + esc(q.q) + ' »</p></div>' +
      '<div class="evt-c">' + q.a.map(function (a, i) { return '<button class="btn" data-act="cAnswer" data-i="' + i + '">' + esc(a[0]) + '<br><small>' + esc(BM.TONES[a[1]]) + '</small></button>'; }).join('') + '</div>' +
      '<button class="btn sm" data-act="cSkipIv">Quitter la salle sans répondre (amende)</button>');
  };
  UI.actions.cAnswer = function (el) { var r = BM.careerAnswer(UI.g, +el.dataset.i); UI.cInterview(r); };
  UI.actions.cSkipIv = function () { var r = BM.careerSkipInterview(UI.g); UI.cInterview(r); };

  // Moments clés en direct (appelé par la vue du match).
  UI.cMomentPanel = function (m) {
    var M = m.pendingMoment;
    return '<div class="modal-h"><h2>' + esc(M.title) + '</h2><span class="tag ' + (M.kind === 'def' || M.kind === 'cDef' ? 'good' : 'fire') + '">' + (M.kind === 'def' || M.kind === 'cDef' ? 'Défense' : 'Attaque') + '</span></div>' +
      '<p style="margin:0">' + esc(M.text) + '</p><div class="evt-c">' + M.choices.map(function (c, i) {
        return '<button class="btn" data-act="mMoment" data-i="' + i + '">' + esc(c.t) + (c.h ? '<br><small>' + esc(c.h) + '</small>' : '') + '</button>';
      }).join('') + '</div>';
  };
  UI.actions.mMoment = function (el) {
    var L = UI.live, m = L.m, res = m.resolveMoment(+el.dataset.i);
    UI.pushEvents(m.events.slice(-1));
    L.panel = null;
    document.getElementById('m-panel').innerHTML = '';
    if (BM.Juice) BM.Juice.haptic('medium');
    UI.toast(res);
    L.playing = true;
    UI.renderControls();
    UI.schedule(250);
  };
  UI.actions.mCMent = function (el) {
    var m = UI.live.m;
    m.career.ment = el.dataset.v; UI.g.career.ment = el.dataset.v;
    m.log('info', m.career.side, 'Mentalité : ' + BM.CAREER_MENT[el.dataset.v].l + '.');
    UI.pushEvents(m.events.slice(-1));
    UI.renderControls();
  };

  // ---------------------------------------------------------------- draft
  UI.cDraft = function () {
    var g = UI.g, C = g.career, rank = BM.careerMockRank(g);
    UI.modalLocked = true;
    UI.modal('<div class="modal-h"><h2>Soirée de draft ' + (2026 + g.season) + '</h2></div>' +
      '<div class="card wide"><p style="margin:0">Costume taillé sur mesure, ta mère à ta gauche, ' + esc(BM.cRel(C, 'agent').l.split(',')[0]) + ' à ta droite. Les projections te placent autour du <b>' + rank + 'e choix</b>.</p></div>' +
      '<div class="grid2"><div class="kpi"><b>' + (C.prospect.avg || 0).toFixed(1) + '</b><span>Évaluation moyenne de ta saison</span></div><div class="kpi"><b>' + Math.round(C.rep) + '</b><span>Réputation</span></div></div>' +
      '<button class="btn primary block" data-act="cRunDraft">Le commissaire s\'avance…</button>');
  };
  UI.actions.cRunDraft = function () {
    var g = UI.g, res = BM.careerRunDraft(g), t = g.teams[res.team];
    UI.save();
    UI.modalLocked = true;
    UI.modal('<div class="modal-h"><h2>' + (res.pick ? 'Drafté !' : 'Non drafté') + '</h2></div>' +
      '<div class="card wide"><div class="vs"><div class="t">' + UI.teamBadge(t) + esc(t.name) + '<span class="small muted">' + (res.pick ? res.pick + (res.pick === 1 ? 'er' : 'e') + ' choix · ' + (res.round === 1 ? '1er tour' : '2e tour') : 'Contrat two-way') + '</span></div></div>' +
      '<p class="small" style="margin:8px 0 0">Contrat : ' + BM.money(BM.cPlayer(g).contract.salary) + ' par an, ' + BM.cPlayer(g).contract.years + ' saisons. Coach : ' + esc(BM.coachName(g, t)) + '.</p></div>' +
      '<button class="btn primary block" data-act="cAfterDraft">Rejoindre la franchise</button>');
    UI.cCine();
  };
  UI.actions.cAfterDraft = function () { UI.cAdvance(false); };

  // ---------------------------------------------------------------- intersaison
  UI.cOffseason = function () {
    var g = UI.g, C = g.career, out = C.offseason || {}, S = C.seasons[C.seasons.length - 1], p = BM.cPlayer(g);
    UI.modalLocked = true;
    var body = '<div class="modal-h"><h2>Intersaison ' + (2026 + g.season - 1) + '-' + String(2026 + g.season).slice(2) + '</h2></div>';
    if (S && S.season === g.season) {
      body += '<div class="card wide"><h3>Ta saison</h3><p class="small" style="margin:4px 0 0">' + esc(S.teamName) + ' · ' + esc(S.status) + ' · ' + S.gp + ' matchs · <b>' + S.pts + ' pts, ' + S.reb + ' reb, ' + S.ast + ' pd</b> · ' + S.fg + ' % aux tirs · ' + esc(S.res) + '</p>' +
        (out.awards && out.awards.length ? '<p class="small" style="margin:6px 0 0">Distinctions : ' + out.awards.map(function (a) { return '<span class="tag legend">' + esc(a) + '</span>'; }).join(' ') + '</p>' : '') +
        (out.potD ? '<p class="small" style="margin:6px 0 0">Potentiel revu ' + (out.potD > 0 ? 'à la hausse' : 'à la baisse') + ' (éthique de travail ' + Math.round(C.work) + ').</p>' : '') + '</div>';
    }
    if (out.fa && C.offers) {
      body += '<div class="card wide"><h3>Free agency</h3><p class="small muted" style="margin:4px 0 8px">Ton contrat est terminé. ' + esc(BM.cRel(C, 'agent').l.split(',')[0]) + ' a reçu ces offres :</p>' +
        C.offers.map(function (o, i) {
          var t = g.teams[o.team];
          return '<div class="rec"><div><b>' + UI.teamBadge(t, true) + ' ' + esc(t.name) + '</b><p>' + BM.money(o.sal) + ' par an · ' + o.years + ' an(s) · rôle prévu : ' + esc(o.role) + (o.team === p.teamId ? ' · ton club actuel' : '') + '</p></div>' +
            '<button class="btn sm primary" data-act="cSign" data-i="' + i + '">Signer</button></div>';
        }).join('') + '</div>';
    } else {
      body += '<div class="card wide"><h3>Programme d\'été</h3><div class="evt-c">' + BM.CAREER_SUMMER.map(function (s) {
        return '<button class="btn" data-act="cSummer" data-v="' + s.id + '">' + esc(s.l) + '<br><small>' + esc(s.d) + '</small></button>';
      }).join('') + '</div></div>';
    }
    if (out.canRetire || out.mustRetire) body += '<div class="card"><p class="small" style="margin:0">' + (out.mustRetire ? 'Ton corps te dit stop. Il est temps de raccrocher.' : p.age + ' ans. Tu peux annoncer ta retraite… ou continuer.') + '</p>' +
      '<button class="btn block' + (out.mustRetire ? ' primary' : '') + '" data-act="cRetire" style="margin-top:8px">Annoncer ma retraite</button></div>';
    UI.modal(body);
    UI.cCine();
  };
  UI.actions.cSign = function (el) { BM.careerSign(UI.g, +el.dataset.i); UI.save(); UI.cOffseason(); };
  UI.actions.cSummer = function (el) {
    var g = UI.g;
    if (g.career.offseason && g.career.offseason.mustRetire) { UI.toast('Il est temps de raccrocher.'); return; }
    var gains = BM.careerSummer(g, el.dataset.v);
    UI.modalLocked = false; UI.closeModal();
    UI.cTab = 'day'; UI.save(); UI.render();
    UI.toast('Nouvelle saison ! ' + BM.careerGainTxt(gains));
  };

  // ---------------------------------------------------------------- retraite et reconversion
  UI.actions.cRetire = function () {
    var g = UI.g, leg = BM.careerRetire(g), C = g.career, p = BM.cPlayer(g);
    C.cine.push({ k: 'Retraite', l: ['Dernière conférence de presse.', C.seasons.length + ' saisons. ' + C.rings + ' bague' + (C.rings > 1 ? 's' : '') + '. ' + C.allStars + ' All-Star.', leg.tier + '.'] });
    UI.save();
    UI.cCoachOffers();
  };
  UI.cCoachOffers = function () {
    var g = UI.g, C = g.career, offers = BM.careerCoachOffers(g), p = BM.cPlayer(g);
    UI.modalLocked = true;
    UI.modal('<div class="modal-h"><h2>Et maintenant, coach ?</h2></div>' +
      '<div class="card wide"><p style="margin:0"><b>' + esc(BM.fullName(p)) + '</b> · ' + esc(C.legacy.tier) + ' (score ' + C.legacy.sc + ')</p><p class="small muted" style="margin:4px 0 0">' + C.seasons.length + ' saisons NBA · ' + C.rings + ' titre(s) · ' + C.allStars + ' All-Star · ' + C.gw + ' panier(s) de la gagne</p></div>' +
      '<p class="small" style="margin:0">Trois franchises te proposent le banc. La même ligue continue : tes anciens coéquipiers, tes rivaux, ton histoire.</p>' +
      offers.map(function (id) {
        var t = g.teams[id];
        return '<div class="rec"><div><b>' + UI.teamBadge(t, true) + ' ' + esc(t.name) + '</b><p>Réputation ' + t.rep + (id === C.lastTeam ? ' · ton dernier club' : '') + '</p></div><button class="btn sm primary" data-act="cCoach" data-id="' + id + '">Accepter</button></div>';
      }).join(''));
    UI.cCine();
  };
  UI.actions.cCoach = function (el) {
    var g = UI.g, t = BM.careerBecomeCoach(g, +el.dataset.id);
    UI.modalLocked = false; UI.closeModal();
    UI.tab = 'home';
    UI.save(); UI.render();
    UI.toast('Bienvenue sur le banc des ' + t.name + ', coach !');
  };

  // ---------------------------------------------------------------- cinématiques
  UI.cCine = function () {
    var C = UI.g && UI.g.career;
    if (!C || !C.cine || !C.cine.length || document.getElementById('cine')) return;
    var c = C.cine.shift();
    UI.save();
    var el = document.createElement('div');
    el.id = 'cine';
    el.innerHTML = '<div class="in"><div class="k">' + esc(c.k) + '</div>' + c.l.map(function (l) { return '<div class="ln">' + esc(l) + '</div>'; }).join('') + '<button class="btn primary" data-act="cCineClose">Continuer</button></div>';
    document.body.appendChild(el);
    var lines = el.querySelectorAll('.ln');
    lines.forEach(function (ln, i) { setTimeout(function () { ln.classList.add('on'); if (BM.Juice && i === lines.length - 1) BM.Juice.sound('cheer'); }, 400 + i * 900); });
    setTimeout(function () { var b = el.querySelector('.btn'); if (b) b.classList.add('on'); }, 400 + lines.length * 900);
  };
  UI.actions.cCineClose = function () { var el = document.getElementById('cine'); if (el) el.remove(); UI.cCine(); };

  // ---------------------------------------------------------------- Joueur
  UI.c_player = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), groups = {};
    BM.ATTRS.forEach(function (a) { (groups[a.g] = groups[a.g] || []).push(a); });
    var w = BM.POS_WEIGHTS[p.pos];
    var attrs = '<div class="card wide"><div class="card-h"><h2>Attributs</h2><span class="small muted">' + C.pp + ' points de progression · gras = compte dans ta note de poste</span></div><div class="attrs">' +
      Object.keys(groups).map(function (gk) {
        return '<div><h3>' + BM.ATTR_GROUPS[gk] + '</h3>' + groups[gk].map(function (a) {
          var v = p.attrs[a.k], xp = Math.max(0, C.xp[a.k] || 0), cost = BM.careerPPCost(g, a.k);
          return '<div class="attr cattr"><span' + (w[a.k] ? ' style="font-weight:700"' : '') + '>' + a.l + '</span><i class="xp"><u style="width:' + Math.round(xp * 100) + '%"></u></i><b class="' + UI.attrClass(v) + '">' + v + '</b>' +
            '<button class="plus" data-act="cPP" data-k="' + a.k + '"' + (C.pp < cost || v >= 20 ? ' disabled' : '') + ' title="' + cost + ' PP">+' + cost + '</button></div>';
        }).join('') + '</div>';
      }).join('') + '</div><p class="hint" style="margin:6px 0 0">La barre fine montre l\'entraînement accumulé vers le point suivant. Au-delà du potentiel, chaque point coûte deux fois plus cher.</p></div>';
    var badges = '<div class="card"><h2 style="margin-bottom:6px">Badges</h2><div class="cbadges">' + BM.CAREER_BADGES.map(function (b) {
      var l = (p.badges || {})[b.id] || 0, next = l < 4 ? b.th[l] : null;
      return '<div class="cbadge l' + l + '"><b>' + esc(b.l) + '</b><span class="lv">' + (l ? BM.CAREER_BLVL[l] : 'Verrouillé') + '</span><span>' + esc(b.d) + (next !== null ? ' · ' + Math.min(C.cnt[b.c], next) + '/' + next + ', ' + BM.ATTRS.find(function (a) { return a.k === b.a; }).l.toLowerCase() + ' ' + BM.CAREER_BREQ[l + 1] : '') + '</span></div>';
    }).join('') + '</div></div>';
    var s = p.stats, per = function (k) { return s.gp ? (s[k] / s.gp).toFixed(1) : '-'; };
    var season = '<div class="card"><div class="card-h"><h2>Saison</h2><span class="small muted">' + s.gp + ' match(s)</span></div>' +
      '<div class="cline"><div><b>' + per('pts') + '</b><span>pts</span></div><div><b>' + per('reb') + '</b><span>reb</span></div><div><b>' + per('ast') + '</b><span>pd</span></div><div><b>' + per('min') + '</b><span>min</span></div>' +
      '<div><b>' + (s.fga ? Math.round(s.fgm / s.fga * 100) : '-') + '%</b><span>tirs</span></div><div><b>' + (s.tpa ? Math.round(s.tpm / s.tpa * 100) : '-') + '%</b><span>3 pts</span></div></div>' +
      ((C.games || []).length ? '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Adv.</th><th class="num">Min</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Pd</th><th class="num">Tirs</th><th class="num">Rés.</th></tr></thead><tbody>' +
        C.games.slice(-8).reverse().map(function (x) {
          return '<tr><td>' + esc(x.opp) + '</td>' + (x.dnp ? '<td colspan="5" class="muted">N\'a pas joué</td>' : '<td class="num">' + x.min + '</td><td class="num"><b>' + x.pts + '</b></td><td class="num">' + x.reb + '</td><td class="num">' + x.ast + '</td><td class="num">' + x.fgm + '/' + x.fga + '</td>') +
            '<td class="num" style="color:' + (x.win ? 'var(--good)' : 'var(--bad)') + '">' + (x.win ? 'V ' : 'D ') + x.score + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '') + '</div>';
    return attrs + badges + season + UI.gravityCard(p);
  };
  UI.actions.cPP = function (el) {
    if (BM.careerSpendPP(UI.g, el.dataset.k)) { if (BM.Juice) { BM.Juice.sound('tap'); BM.Juice.haptic('light'); } UI.save(); UI.render(); }
  };

  // ---------------------------------------------------------------- Vie
  UI.c_life = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g);
    var money = '<div class="grid2"><div class="kpi"><b>' + BM.money(C.money) + '</b><span>Compte courant</span></div><div class="kpi"><b>' + BM.money(BM.careerNetWorth(C)) + '</b><span>Patrimoine</span></div>' +
      '<div class="kpi"><b>' + (p.teamId !== null ? BM.money(p.contract.salary) : BM.money(BM.CAREER_PATHS[C.path].pay)) + '</b><span>' + (p.teamId !== null ? 'Salaire annuel · ' + p.contract.years + ' an(s)' : 'Revenus de la saison') + '</span></div>' +
      '<div class="kpi"><b>' + C.sponsors.reduce(function (s, x) { return s + x.pay; }, 0) + ' k$</b><span>Sponsors par semaine</span></div></div>';
    var rels = '<div class="card"><h2 style="margin-bottom:6px">Proches</h2>' + C.rel.map(function (r) {
      return '<div class="rec"><div style="flex:1"><b>' + esc(r.l) + '</b>' + UI.bar(r.v) + '</div><button class="btn sm" data-act="cGift" data-id="' + r.id + '">Cadeau (20 k$)</button></div>';
    }).join('') + (C.partner ? '<div class="rec"><div style="flex:1"><b>' + esc(C.partner.name) + '</b> <span class="tag">' + { couple: 'En couple', fiance: 'Fiancés', marie: 'Mariés' }[C.partner.stage] + '</span>' + UI.bar(C.partner.v) + '</div><button class="btn sm" data-act="cGift" data-id="partner">Cadeau (30 k$)</button></div>' : '<p class="small muted" style="margin:6px 0 0">Célibataire. Activité « Rendez-vous galant » pour rencontrer quelqu\'un.</p>') +
      (C.kids ? '<p class="small" style="margin:6px 0 0">' + C.kids + ' enfant(s).</p>' : '') + '</div>';
    var assets = '<div class="card"><h2 style="margin-bottom:6px">Patrimoine</h2>' + BM.CAREER_ASSETS.map(function (a) {
      var own = C.assets[a.id];
      return '<div class="rec"><div><b>' + esc(a.l) + '</b><p>' + esc(a.d) + ' · ' + BM.money(a.p) + (a.up ? ', entretien ' + a.up + ' k$/sem.' : '') + '</p></div>' +
        (own ? '<button class="btn sm" data-act="cSell" data-id="' + a.id + '">Vendre</button>' : '<button class="btn sm primary" data-act="cBuy" data-id="' + a.id + '"' + (C.money < a.p ? ' disabled' : '') + '>Acheter</button>') + '</div>';
    }).join('') + '</div>';
    var staff = '<div class="card"><h2 style="margin-bottom:6px">Ton staff perso</h2>' + BM.CAREER_STAFF.map(function (s) {
      return '<div class="rec"><div><b>' + esc(s.l) + '</b><p>' + esc(s.d) + ' · ' + s.c + ' k$/sem.</p></div><button class="btn sm' + (C.staff[s.id] ? '' : ' primary') + '" data-act="cStaff" data-id="' + s.id + '">' + (C.staff[s.id] ? 'Libérer' : 'Engager') + '</button></div>';
    }).join('') + '</div>';
    var inv = '<div class="card"><h2 style="margin-bottom:6px">Placements</h2>' + Object.keys(BM.CAREER_INV).map(function (k) {
      var x = BM.CAREER_INV[k];
      return '<div class="rec"><div><b>' + x.l + ' · ' + BM.money(C.inv[k]) + '</b><p>' + esc(x.d) + '</p></div><span class="btn-row"><button class="btn sm" data-act="cInvest" data-k="' + k + '"' + (C.money < 100 ? ' disabled' : '') + '>+100 k$</button>' +
        '<button class="btn sm" data-act="cWithdraw" data-k="' + k + '"' + (C.inv[k] <= 0 ? ' disabled' : '') + '>Retirer</button></span></div>';
    }).join('') + '</div>';
    return money + rels + staff + assets + inv;
  };
  UI.actions.cGift = function (el) { if (BM.careerGift(UI.g, el.dataset.id)) UI.toast('Cadeau offert. La relation se réchauffe.'); else UI.toast('Déjà un cadeau cette semaine, ou pas assez d\'argent.'); UI.save(); UI.render(); };
  UI.actions.cBuy = function (el) { if (BM.careerBuy(UI.g, el.dataset.id)) UI.toast('Achat effectué.'); UI.save(); UI.render(); };
  UI.actions.cSell = function (el) { BM.careerSell(UI.g, el.dataset.id); UI.save(); UI.render(); };
  UI.actions.cStaff = function (el) { BM.careerToggleStaff(UI.g, el.dataset.id); UI.save(); UI.render(); };
  UI.actions.cInvest = function (el) { BM.careerInvest(UI.g, el.dataset.k, 100); UI.save(); UI.render(); };
  UI.actions.cWithdraw = function (el) { BM.careerWithdraw(UI.g, el.dataset.k); UI.save(); UI.render(); };

  // ---------------------------------------------------------------- Médias
  UI.c_media = function () {
    var g = UI.g, C = g.career, img = BM.careerImage(C);
    var head = '<div class="grid2"><div class="kpi"><b>' + BM.fmtN(C.followers) + '</b><span>Followers</span></div><div class="kpi"><b>' + Math.round(C.rep) + '</b><span>Réputation</span>' + UI.bar(C.rep) + '</div>' +
      '<div class="kpi"><b style="font-size:16px">' + (img ? esc(BM.TONES[img]) : 'Inconnu') + '</b><span>Ton image (selon tes interviews)</span></div><div class="kpi"><b>' + C.sponsors.length + '/' + BM.careerSpSlots(C) + '</b><span>Contrats de sponsoring</span></div></div>';
    var sp = '<div class="card"><h2 style="margin-bottom:6px">Sponsors</h2>' + (C.sponsors.length ? C.sponsors.map(function (s) {
      return '<div class="rec"><div><b>' + esc(s.brand) + '</b> <span class="tag">' + BM.SP_CATS[s.cat].l + '</span>' + (s.strikes ? ' <span class="tag bad">' + s.strikes + '/3</span>' : '') + '<p>' + s.pay + ' k$/sem. · ' + s.left + ' sem. restantes · ' + s.cl.map(BM.careerClauseTxt).join(' · ') + '</p></div></div>';
    }).join('') : '<p class="small muted" style="margin:0">Aucun contrat. Les marques arrivent avec la réputation.</p>') +
      (C.spOffers.length ? '<h3 style="margin:10px 0 4px">Offres</h3>' + C.spOffers.map(function (o) {
        return '<div class="rec"><div><b>' + esc(o.brand) + '</b> <span class="tag">' + BM.SP_CATS[o.cat].l + '</span> <span class="tag ' + (o.fit ? 'good' : '') + '">' + BM.SP_IMG[o.img] + '</span><p>' + o.pay + ' k$/sem. · ' + o.weeks + ' sem. · prime ' + BM.money(o.sign) + ' · ' + BM.careerBonusTxt(o.bonus) + '<br>' + o.cl.map(BM.careerClauseTxt).join(' · ') + '</p></div>' +
          '<span class="btn-row"><button class="btn sm primary" data-act="cSpYes" data-id="' + o.id + '">Signer</button><button class="btn sm" data-act="cSpNeg" data-id="' + o.id + '"' + (o.neg ? ' disabled' : '') + '>Négocier</button><button class="btn sm" data-act="cSpNo" data-id="' + o.id + '">Refuser</button></span></div>';
      }).join('') : '') + '</div>';
    var press = '<div class="card"><h2 style="margin-bottom:6px">La presse</h2>' + (C.press.length ? C.press.slice(0, 8).map(function (a) {
      return '<div class="art t' + (a.tone === '+' ? 'p' : a.tone === '-' ? 'n' : '') + '"><span class="lbl">' + esc(a.out) + '</span><h3>' + esc(a.t) + '</h3><p class="small muted" style="margin:0">' + esc(a.s) + '</p></div>';
    }).join('') : '<p class="small muted" style="margin:0">Personne n\'écrit encore sur toi.</p>') + '</div>';
    var feed = '<div class="card"><h2 style="margin-bottom:6px">Réseaux</h2>' + (C.feed.length ? C.feed.slice(0, 10).map(function (f) {
      return '<div class="post' + (f.mine ? ' mine' : '') + '"><div class="av">' + esc(f.who.charAt(0)) + '</div><div><b>' + esc(f.who) + '</b> <span class="muted small">' + esc(f.h) + '</span><p style="margin:2px 0 0">' + esc(f.t) + '</p><span class="small muted">♥ ' + BM.fmtN(f.likes) + '</span></div></div>';
    }).join('') : '<p class="small muted" style="margin:0">Fil vide.</p>') + '</div>';
    return head + sp + press + feed;
  };
  UI.actions.cSpYes = function (el) { UI.toast(BM.careerAcceptSp(UI.g, el.dataset.id)); UI.save(); UI.render(); };
  UI.actions.cSpNeg = function (el) { UI.toast(BM.careerNegotiateSp(UI.g, el.dataset.id)); UI.save(); UI.render(); };
  UI.actions.cSpNo = function (el) { BM.careerDeclineSp(UI.g, el.dataset.id); UI.save(); UI.render(); };

  // ---------------------------------------------------------------- Ligue
  UI.c_league = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
    var roster = t ? '<div class="card"><div class="card-h"><h2>' + esc(t.name) + '</h2><span class="small muted">Coach ' + esc(BM.coachName(g, t)) + ' · ' + esc(BM.tacticLabel(BM.SYSTEMS[t.tactics.system])) + '</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Joueur</th><th class="num">Âge</th><th class="num">Note</th><th class="num">Pts</th><th class="num">Min</th></tr></thead><tbody>' +
      BM.roster(g, t).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); }).map(function (x) {
        return '<tr class="click' + (x === p ? ' me' : '') + '" data-act="player" data-id="' + x.id + '"><td><span class="pname">' + BM.portrait(x, t, 22) + '<span><span class="pos">' + x.pos + '</span> ' + esc(BM.shortName(x)) + '</span></span></td><td class="num">' + x.age + '</td><td class="num">' + UI.ovrBadge(BM.ovr(x)) + '</td><td class="num">' + UI.per(x, 'pts') + '</td><td class="num">' + UI.per(x, 'min') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' : '';
    var conf = t ? t.conf : 'E';
    var st = '<div class="card"><h2 style="margin-bottom:6px">' + BM.CONFERENCES[conf] + '</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Équipe</th><th class="num">V</th><th class="num">D</th></tr></thead><tbody>' +
      BM.standings(g, conf).map(function (x, i) {
        return '<tr class="' + (t && x === t ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + UI.teamBadge(x, true) + ' ' + esc(x.name) + '</td><td class="num">' + x.record.w + '</td><td class="num">' + x.record.l + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return roster + st + UI.comp_stats();
  };

  // ---------------------------------------------------------------- Carrière
  UI.c_career = function () {
    var g = UI.g, C = g.career, p = BM.cPlayer(g), leg = BM.careerLegacy(g);
    var head = '<div class="grid2"><div class="kpi"><b>' + C.seasons.length + '</b><span>Saisons NBA</span></div><div class="kpi"><b>' + C.rings + '</b><span>Titre(s)</span></div>' +
      '<div class="kpi"><b>' + C.allStars + '</b><span>All-Star</span></div><div class="kpi"><b>' + leg.sc + '</b><span>' + esc(leg.tier) + '</span></div></div>';
    var draft = C.draft ? '<p class="small" style="margin:0">' + (C.draft.pick ? 'Drafté en ' + C.draft.pick + (C.draft.pick === 1 ? 're' : 'e') + ' position par les ' + esc(g.teams[C.draft.team].name) : 'Non drafté, signé en two-way par les ' + esc(g.teams[C.draft.team].name)) +
      ' après une saison ' + esc(BM.CAREER_PATHS[C.path].l) + ' (' + C.prospect.w + 'V-' + C.prospect.l + 'D).</p>' : '<p class="small muted" style="margin:0">Encore prospect : la draft arrive en fin de saison NBA.</p>';
    var seasons = '<div class="card wide"><h2 style="margin-bottom:6px">Parcours</h2>' + draft + (C.seasons.length ? '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Saison</th><th>Équipe</th><th>Statut</th><th class="num">MJ</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Pd</th><th class="num">Note</th><th>Bilan</th></tr></thead><tbody>' +
      C.seasons.map(function (s) {
        return '<tr><td>' + (2026 + s.season - 1) + '-' + String(2026 + s.season).slice(2) + '</td><td>' + esc(s.team) + '</td><td>' + esc(s.status) + '</td><td class="num">' + s.gp + '</td><td class="num"><b>' + s.pts + '</b></td><td class="num">' + s.reb + '</td><td class="num">' + s.ast + '</td><td class="num">' + s.ovr + '</td><td>' + esc(s.res) + (s.awards && s.awards.length ? ' · ' + s.awards.map(esc).join(', ') : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') + '</div>';
    var exp = '<div class="card"><h2 style="margin-bottom:6px">Sauvegarde</h2><p class="small muted" style="margin:0 0 8px">Exporte ta carrière en fichier pour ne jamais la perdre.</p><button class="btn" data-act="exportSave">Exporter (.json)</button> <button class="btn danger" data-act="cQuit">Quitter vers le menu</button></div>';
    return head + seasons + UI.cLogCard(30) + exp;
  };
  UI.actions.cQuit = function () { UI.g = null; UI.render(); };
})();

// ==================================================================== création du joueur (écran de départ)
(function () {
  var esc = function (s) { return UI.esc(s); };
  UI.cc = { first: '', last: '', home: '', pos: 'AIL', arch: 'twoway', trait: 'travail', path: 'ncaa', num: 7 };

  UI.actions.startMode = function (el) { UI.startMode = el.dataset.v; UI.render(); };

  UI.careerCreate = function () {
    var c = UI.cc, archs = BM.CAREER_ARCH[c.pos];
    if (!archs.some(function (a) { return a.id === c.arch; })) c.arch = archs[0].id;
    var chips = function (key, list) {
      return '<div class="chips">' + list.map(function (x) {
        return '<button class="chip' + (c[key] === x[0] ? ' on' : '') + '" data-act="ccSet" data-k="' + key + '" data-v="' + x[0] + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div>';
    };
    var opts = function (key, list) {
      return '<div class="opts">' + list.map(function (x) {
        return '<button class="opt' + (c[key] === x.id ? ' on' : '') + '" data-act="ccSet" data-k="' + key + '" data-v="' + x.id + '"><b>' + esc(x.l) + '</b><span>' + esc(x.d) + '</span></button>';
      }).join('') + '</div>';
    };
    var paths = Object.keys(BM.CAREER_PATHS).map(function (k) { var p = BM.CAREER_PATHS[k]; return { id: k, l: p.l + ' · ' + p.s, d: p.d }; });
    return '<div class="card wide" style="display:grid;gap:12px"><h2>Crée ton joueur</h2>' +
      '<div class="ccrow"><div class="field"><label for="ccf">Prénom</label><input type="text" id="ccf" maxlength="20" data-change="ccText" data-k="first" value="' + esc(c.first) + '" placeholder="Kofi"></div>' +
      '<div class="field"><label for="ccl">Nom</label><input type="text" id="ccl" maxlength="24" data-change="ccText" data-k="last" value="' + esc(c.last) + '" placeholder="Mensah"></div>' +
      '<div class="field"><label for="cch">Ville natale</label><input type="text" id="cch" maxlength="24" data-change="ccText" data-k="home" value="' + esc(c.home) + '" placeholder="Abidjan"></div>' +
      '<div class="field"><label for="ccn">Numéro</label><input type="number" id="ccn" min="0" max="99" data-change="ccText" data-k="num" value="' + c.num + '"></div></div>' +
      '<div class="field"><label>Poste</label>' + chips('pos', BM.POSITIONS.map(function (p) { return [p, BM.POS_LABEL[p]]; })) + '</div>' +
      '<div class="field"><label>Archétype</label>' + opts('arch', BM.CAREER_ARCH[c.pos]) + '</div>' +
      '<div class="field"><label>Trait de caractère</label>' + opts('trait', BM.CAREER_TRAITS) + '</div>' +
      '<div class="field"><label>Ta voie vers la draft (19 ans)</label>' + opts('path', paths) + '</div>' +
      '<button class="btn primary block" data-act="ccStart">Commencer ma carrière</button></div>';
  };

  UI.actions.ccSet = function (el) { UI.cc[el.dataset.k] = el.dataset.v; UI.render(); };
  UI.changes.ccText = function (el) { UI.cc[el.dataset.k] = el.dataset.k === 'num' ? BM.clamp(+el.value || 0, 0, 99) : el.value.trim(); };

  UI.actions.ccStart = function () {
    ['ccf', 'ccl', 'cch', 'ccn'].forEach(function (id) { var el = document.getElementById(id); if (el) UI.changes.ccText(el); });
    var c = UI.cc;
    if (!c.first || !c.last) { UI.toast('Donne un prénom et un nom à ton joueur.'); return; }
    UI.g = BM.newCareer({ seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, first: c.first, last: c.last, home: c.home, pos: c.pos, arch: c.arch, trait: c.trait, path: c.path, num: c.num });
    UI.cTab = 'day';
    UI.g.career.cine.push({ k: 'Ma Carrière', l: [c.home ? c.home + ', un terrain en béton.' : 'Un terrain en béton, un panier sans filet.', '19 ans. Un rêve : la NBA.', 'Premier jour à ' + BM.cPlayer(UI.g).college + '.'] });
    UI.save();
    UI.render();
  };
})();
