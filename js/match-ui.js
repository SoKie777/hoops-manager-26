var BM = globalThis.BM = globalThis.BM || {};
var UI = BM.UI;

// ==================================================================== avant-match
UI.preMatch = function (fx) {
  var g = UI.g, h = g.teams[fx.home], a = g.teams[fx.away];
  var me = g.teams[g.userTeam], opp = fx.home === g.userTeam ? a : h;
  var avgOvr = function (t) {
    var r = BM.availablePlayers(g, t).sort(function (x, y) { return BM.ovrRaw(y) - BM.ovrRaw(x); }).slice(0, 8);
    return Math.round(r.reduce(function (s, p) { return s + BM.ovr(p); }, 0) / r.length);
  };
  var label = function (field, v) { return (BM.TACTIC_OPTIONS[field].find(function (o) { return o.v === v; }) || {}).l; };
  var tired = BM.availablePlayers(g, me).filter(function (p) { return p.condition < 70; });
  var injured = BM.roster(g, me).filter(function (p) { return p.injury > 0; });
  var starters = (me.tactics.starters || []).map(function (id) { return g.players[id]; }).filter(function (p) { return p && p.injury <= 0; });
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>' + (fx.type === 'playoff' ? BM.ROUND_NAMES[fx.round] + ' · match ' + fx.game : 'Journée ' + fx.round) + '</h2></div>' +
    '<div class="card"><div class="vs"><div class="t">' + UI.teamBadge(h) + UI.esc(h.name) + '<span class="small muted">Note ' + avgOvr(h) + '</span></div>' +
    '<div class="mid">' + UI.esc(BM.dateLabel(g, fx.day)) + '</div>' +
    '<div class="t">' + UI.teamBadge(a) + UI.esc(a.name) + '<span class="small muted">Note ' + avgOvr(a) + '</span></div></div></div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Rapport de l\'adversaire</h3>' +
    '<p class="small" style="margin:0">' + UI.esc(opp.name) + ' (' + opp.record.w + 'V-' + opp.record.l + 'D) joue un rythme <b>' + label('pace', opp.tactics.pace).toLowerCase() +
    '</b>, une attaque <b>' + label('focus', opp.tactics.focus).toLowerCase() + '</b> et une défense <b>' + label('defense', opp.tactics.defense).toLowerCase() + '</b>.</p></div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Votre cinq</h3>' +
    (starters.length ? starters.map(function (p) {
      return '<div class="attr"><span><span class="pos">' + p.pos + '</span> ' + UI.esc(BM.shortName(p)) + '</span><span>' + UI.ovrBadge(BM.ovr(p)) + ' <span class="muted small">' + Math.round(p.condition) + '%</span></span></div>';
    }).join('') : '<p class="small muted" style="margin:0">Aucun titulaire défini : sélection automatique.</p>') +
    (tired.length ? '<p class="small" style="margin:8px 0 0;color:var(--warn)">Fatigués : ' + tired.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    (injured.length ? '<p class="small" style="margin:4px 0 0;color:var(--bad)">Blessés : ' + injured.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    '</div>' +
    '<button class="btn primary block" data-act="playLive">Jouer le match en direct</button>' +
    '<div class="btn-row"><button class="btn" style="flex:1" data-act="playQuick">Résultat instantané</button><button class="btn" style="flex:1" data-act="editTactics">Modifier la tactique</button></div>');
  UI.pendingFx = fx;
};

UI.actions.editTactics = function () {
  UI.modalLocked = false;
  UI.closeModal();
  UI.tab = 'tactics';
  UI.render();
};

UI.actions.playQuick = function () {
  var m = new BM.Match(UI.g, UI.pendingFx);
  m.simulateAll();
  UI.live = { m: m, fx: UI.pendingFx };
  UI.finishMatch();
};

UI.actions.playLive = function () {
  UI.modalLocked = false;
  var m = new BM.Match(UI.g, UI.pendingFx);
  UI.live = { m: m, fx: UI.pendingFx, speed: 1, playing: true, timer: null, sel: null, panel: null };
  UI.renderMatch();
  UI.schedule();
};

// ==================================================================== direct
UI.SPEEDS = { 1: 1100, 2: 450, 4: 110 };

UI.schedule = function () {
  var L = UI.live;
  clearTimeout(L.timer);
  if (!L.playing || L.m.finished) return;
  L.timer = setTimeout(UI.tickMatch, UI.SPEEDS[L.speed]);
};

UI.tickMatch = function () {
  var L = UI.live;
  if (!L || !L.playing) return;
  var evs = L.m.step();
  UI.pushEvents(evs);
  UI.renderScore();
  if (L.m.finished) { UI.finishMatch(); return; }
  if (L.m.halftimePending) { L.playing = false; UI.renderControls(); UI.openPanel('talk'); return; }
  if (L.panel === 'subs') UI.renderPanel();
  UI.schedule();
};

UI.clockLabel = function (q, clock) {
  var m = Math.floor(clock / 60), s = clock % 60;
  return (q > 4 ? 'P' + (q - 4) : 'Q' + q) + ' ' + m + ':' + (s < 10 ? '0' : '') + s;
};

UI.renderMatch = function () {
  var L = UI.live, m = L.m;
  document.getElementById('modal-root').innerHTML =
    '<div class="match"><div class="inner">' +
    '<div class="scoreboard" id="m-score"></div>' +
    '<div class="feed" id="m-feed"></div>' +
    '<div class="controls" id="m-ctrl"></div>' +
    '</div><div id="m-panel"></div></div>';
  UI.renderScore();
  UI.pushEvents(m.events);
  UI.renderControls();
};

UI.renderScore = function () {
  var m = UI.live.m, t = m.side;
  var el = document.getElementById('m-score');
  if (!el) return;
  el.innerHTML = '<div class="sb"><div class="t">' + UI.teamBadge(t[0], true) + '<span>' + UI.esc(t[0].short) + '</span></div>' +
    '<div><div class="score">' + m.score[0] + ' – ' + m.score[1] + '</div><div class="clock">' + (m.finished ? 'Terminé' : UI.clockLabel(m.q, Math.max(0, Math.round(m.clock)))) +
    ' · fautes ' + m.teamFouls[0] + '/' + m.teamFouls[1] + '</div></div>' +
    '<div class="t away"><span>' + UI.esc(t[1].short) + '</span>' + UI.teamBadge(t[1], true) + '</div></div>';
};

UI.pushEvents = function (evs) {
  var feed = document.getElementById('m-feed');
  if (!feed || !evs.length) return;
  var m = UI.live.m, html = '';
  evs.forEach(function (e) {
    var color = e.side >= 0 ? m.side[e.side].color : 'transparent';
    if (e.type === 'quarter' || e.type === 'final') html = '<div class="ev ' + e.type + '">' + UI.esc(e.text) + '</div>' + html;
    else html = '<div class="ev ' + e.type + '"><span class="tm"><i class="side" style="display:inline-block;height:10px;margin-right:6px;background:' + color + '"></i>' + UI.clockLabel(e.q, e.clock) + '</span>' +
      '<span class="tx">' + UI.esc(e.text) + '</span><span class="sc">' + e.score[0] + '-' + e.score[1] + '</span></div>' + html;
  });
  feed.insertAdjacentHTML('afterbegin', html);
};

UI.renderControls = function () {
  var L = UI.live, m = L.m, u = m.user;
  var el = document.getElementById('m-ctrl');
  if (!el) return;
  el.innerHTML = '<div class="btn-row" style="flex-wrap:nowrap">' +
    '<button class="btn" data-act="mPlay" style="min-width:76px">' + (L.playing ? '⏸ Pause' : '▶ Jouer') + '</button>' +
    '<div class="seg" style="flex:1">' + [1, 2, 4].map(function (s) {
      return '<button data-act="mSpeed" data-v="' + s + '" class="' + (L.speed === s ? 'on' : '') + '">x' + s + '</button>';
    }).join('') + '</div>' +
    '<button class="btn" data-act="mSimEnd" title="Simuler la fin du match">⏭</button></div>' +
    '<div class="btn-row" style="flex-wrap:nowrap">' +
    '<button class="btn" style="flex:1" data-act="mTimeout"' + (m.timeouts[u] > 0 ? '' : ' disabled') + '>Temps mort (' + m.timeouts[u] + ')</button>' +
    '<button class="btn" style="flex:1" data-act="mPanel" data-v="subs">Changements</button>' +
    '<button class="btn" style="flex:1" data-act="mPanel" data-v="tactic">Tactique</button></div>';
};

UI.actions.mPlay = function () {
  var L = UI.live;
  if (L.m.halftimePending) { UI.openPanel('talk'); return; }
  L.playing = !L.playing;
  UI.renderControls();
  UI.schedule();
};

UI.actions.mSpeed = function (el) {
  UI.live.speed = +el.dataset.v;
  UI.renderControls();
  UI.schedule();
};

UI.actions.mTimeout = function () {
  var L = UI.live;
  if (L.m.timeout(L.m.user)) {
    UI.pushEvents(L.m.events.slice(-1));
    L.playing = false;
    UI.renderControls();
    UI.openPanel('subs');
  }
};

UI.actions.mSimEnd = function () {
  var L = UI.live;
  clearTimeout(L.timer);
  L.playing = false;
  var start = L.m.events.length;
  L.m.simulateAll();
  UI.pushEvents(L.m.events.slice(start));
  UI.finishMatch();
};

// ==================================================================== panneaux du match
UI.openPanel = function (kind) {
  var L = UI.live;
  L.panel = kind;
  if (kind !== 'talk' && L.playing) { L.playing = false; UI.renderControls(); clearTimeout(L.timer); }
  UI.renderPanel();
};

UI.actions.mPanel = function (el) { UI.openPanel(el.dataset.v); };

UI.actions.mClosePanel = function () {
  var L = UI.live;
  if (L.panel === 'talk') return;
  L.panel = null; L.sel = null;
  document.getElementById('m-panel').innerHTML = '';
};

UI.renderPanel = function () {
  var L = UI.live, m = L.m, u = m.user, el = document.getElementById('m-panel');
  if (!el || !L.panel) return;
  var body = '';
  if (L.panel === 'talk') {
    var diff = m.score[u] - m.score[1 - u];
    body = '<div class="modal-h"><h2>Causerie de mi-temps</h2></div>' +
      '<p style="margin:0">' + (diff > 0 ? 'Vous menez de ' + diff + ' point' + (diff > 1 ? 's' : '') + '.' : diff < 0 ? 'Vous êtes menés de ' + (-diff) + ' point' + (diff < -1 ? 's' : '') + '.' : 'Égalité parfaite.') + ' Que dites-vous au vestiaire ?</p>' +
      '<div style="display:grid;gap:8px">' + BM.TEAM_TALKS.map(function (t) {
        return '<button class="btn block" data-act="mTalk" data-v="' + t.v + '">' + t.l + '</button>';
      }).join('') + '</div>';
  } else if (L.panel === 'tactic') {
    var t = m.tac[u], O = BM.TACTIC_OPTIONS;
    var seg = function (f) {
      return '<div class="field"><label>' + { pace: 'Rythme', focus: 'Attaque', defense: 'Défense' }[f] + '</label><div class="seg">' + O[f].map(function (o) {
        return '<button data-act="mTactic" data-f="' + f + '" data-v="' + o.v + '" class="' + (t[f] === o.v ? 'on' : '') + '">' + o.l + '</button>';
      }).join('') + '</div></div>';
    };
    body = '<div class="modal-h"><h2>Consignes</h2><button class="btn sm x" data-act="mClosePanel">Fermer</button></div>' + seg('pace') + seg('focus') + seg('defense');
  } else {
    var row = function (p, onCourt) {
      var b = m.box[p.id], en = Math.round(m.en[p.id]);
      var sel = L.sel === p.id ? ' sel' : '';
      var tags = (m.out[p.id] ? '<span class="tag bad">' + (p.injury > 0 ? 'Blessé' : '5 fautes') + '</span>' : '') + (b.pf >= 3 && !m.out[p.id] ? '<span class="tag warn">' + b.pf + ' f.</span>' : '');
      return '<div class="pl' + sel + '" data-act="mSel" data-id="' + p.id + '" data-on="' + (onCourt ? 1 : 0) + '" style="cursor:pointer">' +
        '<span class="pos">' + p.pos + '</span><span>' + UI.esc(BM.shortName(p)) + tags + ' <span class="muted small">' + b.pts + ' pts · ' + Math.round(b.sec / 60) + ' min</span></span>' +
        UI.bar(en) + '<b class="num small">' + en + '</b></div>';
    };
    var onIds = m.on[u];
    body = '<div class="modal-h"><h2>Changements</h2><button class="btn sm x" data-act="mClosePanel">Fermer</button></div>' +
      '<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-change="mAuto"' + (m.auto[u] ? ' checked' : '') + '> Rotations automatiques (selon le plan de minutes et la fatigue)</label>' +
      '<p class="hint" style="margin:0">Touchez un joueur sur le terrain puis un remplaçant pour effectuer le changement.</p>' +
      '<h3>Sur le terrain</h3><div class="court">' + onIds.map(function (id) { return row(m.p(id), true); }).join('') + '</div>' +
      '<h3>Banc</h3><div class="court">' + m.roster[u].filter(function (p) { return onIds.indexOf(p.id) < 0; }).map(function (p) { return row(p, false); }).join('') + '</div>';
  }
  el.innerHTML = '<div class="modal-bg"' + (L.panel === 'talk' ? '' : ' data-act="mBg"') + '><div class="modal" role="dialog" aria-modal="true">' + body + '</div></div>';
};

UI.actions.mBg = function (el, ev) { if (ev.target === el) UI.actions.mClosePanel(); };

UI.actions.mTalk = function (el) {
  var L = UI.live, res = L.m.teamTalk(L.m.user, el.dataset.v);
  L.m.resumeAfterHalftime();
  UI.pushEvents(L.m.events.slice(-1));
  L.panel = null;
  document.getElementById('m-panel').innerHTML = '';
  UI.toast(res);
  L.playing = true;
  UI.renderControls();
  UI.schedule();
};

UI.actions.mTactic = function (el) {
  var L = UI.live;
  L.m.tac[L.m.user][el.dataset.f] = el.dataset.v;
  L.m.log('info', L.m.user, 'Changement de consignes : ' + BM.TACTIC_OPTIONS[el.dataset.f].find(function (o) { return o.v === el.dataset.v; }).l + '.');
  UI.pushEvents(L.m.events.slice(-1));
  UI.renderPanel();
};

UI.actions.mSel = function (el) {
  var L = UI.live, m = L.m, u = m.user, id = +el.dataset.id, onCourt = el.dataset.on === '1';
  if (m.out[id] && !onCourt) { UI.toast('Ce joueur ne peut plus revenir en jeu.'); return; }
  if (L.sel === null) { L.sel = id; UI.renderPanel(); return; }
  var selOn = m.on[u].indexOf(L.sel) >= 0;
  if (selOn !== onCourt) {
    var outId = onCourt ? id : L.sel, inId = onCourt ? L.sel : id;
    if (m.substitute(u, outId, inId)) UI.pushEvents(m.events.slice(-1));
    L.sel = null;
  } else {
    L.sel = L.sel === id ? null : id;
  }
  UI.renderPanel();
};

UI.changes.mAuto = function (el) { UI.live.m.auto[UI.live.m.user] = el.checked; };

// ==================================================================== fin de match
UI.finishMatch = function () {
  var L = UI.live, g = UI.g, m = L.m, fx = L.fx;
  clearTimeout(L.timer);
  BM.applyResult(g, fx, m);
  UI.save();
  var u = m.user, won = m.score[u] > m.score[1 - u];
  var mvp = m.mvp ? g.players[m.mvp] : null;
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>' + (won ? 'Victoire !' : 'Défaite') + '</h2></div>' +
    '<div class="card"><div class="sb"><div class="t">' + UI.teamBadge(m.side[0], true) + UI.esc(m.side[0].short) + '</div>' +
    '<div class="score">' + m.score[0] + ' – ' + m.score[1] + '</div><div class="t away">' + UI.esc(m.side[1].short) + UI.teamBadge(m.side[1], true) + '</div></div>' +
    (mvp ? '<p class="small" style="text-align:center;margin:8px 0 0">Homme du match : <b>' + UI.esc(BM.fullName(mvp)) + '</b> (' + m.ratings[mvp.id].toFixed(1) + ')</p>' : '') + '</div>' +
    UI.boxTable(g, fx.box, 0, m.side[0]) + UI.boxTable(g, fx.box, 1, m.side[1]) +
    '<button class="btn primary block" data-act="afterMatch">Continuer</button>');
};

UI.actions.afterMatch = function () {
  UI.live = null;
  UI.modalLocked = false;
  UI.closeModal();
  UI.cont(false);
};
