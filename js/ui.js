var BM = globalThis.BM = globalThis.BM || {};

var UI = BM.UI = {
  g: null,
  tab: 'home',
  sub: { tactics: 'plan', comp: 'table', market: 'fa' },
  sort: { key: 'ovr', dir: -1 },
  marketPos: '',
  actions: {},
  changes: {}
};

// ==================================================================== utilitaires
UI.esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
};

UI.toast = function (msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(UI.toastTimer);
  UI.toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
};

UI.store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* stockage indisponible */ } }
};

UI.save = function () {
  if (!UI.g) return;
  if (!UI.store.set(BM.SAVE_KEY, BM.serialize(UI.g))) UI.toast('Sauvegarde locale impossible : utilisez l\'export.');
};

UI.ovrColor = function (v) {
  var h = BM.clamp((v - 35) / 50, 0, 1) * 130;
  return 'hsl(' + Math.round(h) + ' 55% 40%)';
};
UI.ovrBadge = function (v) { return '<span class="ovr" style="background:' + UI.ovrColor(v) + '">' + v + '</span>'; };
UI.attrClass = function (v) { return v >= 15 ? 'a-hi' : v <= 7 ? 'a-lo' : 'a-mid'; };
UI.teamBadge = function (t, sm) {
  return '<span class="badge' + (sm ? ' sm' : '') + '" style="background:' + t.color + '">' + UI.esc(t.short) + '</span>';
};
UI.barClass = function (v) { return v >= 70 ? '' : v >= 45 ? 'warn' : 'bad'; };
UI.bar = function (v) { return '<div class="bar ' + UI.barClass(v) + '"><i style="width:' + BM.clamp(v, 0, 100) + '%"></i></div>'; };
UI.avgForm = function (p) {
  if (!p.form.length) return '-';
  return (p.form.reduce(function (s, x) { return s + x; }, 0) / p.form.length).toFixed(1);
};
UI.statusTags = function (p) {
  var t = '';
  if (p.injury > 0) t += '<span class="tag bad">Blessé ' + p.injury + 'j</span>';
  if (p.listed) t += '<span class="tag warn">Transférable</span>';
  if (p.teamId !== null && p.contract.years <= 1) t += '<span class="tag">Fin de contrat</span>';
  if (p.legend) t += '<span class="tag legend">Légende</span>';
  if (p.rookie) t += '<span class="tag good">Rookie</span>';
  else if (p.age <= 19) t += '<span class="tag good">Espoir</span>';
  return t;
};
UI.per = function (p, k) { return p.stats.gp ? (p.stats[k] / p.stats.gp).toFixed(1) : '-'; };

var ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  squad: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8-.2 5 1.4 5.5 4.4"/>',
  tactics: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h4M17 12h4"/><circle cx="12" cy="12" r="2.5"/>',
  comp: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  market: '<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  club: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'
};
UI.icon = function (k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</svg>';
};

// ==================================================================== rendu principal
UI.render = function () {
  var app = document.getElementById('app');
  if (!UI.g) { app.innerHTML = UI.startScreen(); UI.afterRender(); return; }
  var g = UI.g, me = g.teams[g.userTeam];
  // Animation d'entrée seulement au changement d'écran (pas à chaque tri ou réglage).
  var screenKey = UI.tab + '/' + (UI.sub[UI.tab] || '');
  var enter = screenKey !== UI.lastScreen;
  UI.lastScreen = screenKey;
  var matchToday = !!BM.userFixtureToday(g);
  var unread = g.inbox.some(function (m) { return !m.read; });
  var tabs = [['home', 'Accueil'], ['squad', 'Effectif'], ['tactics', 'Tactique'], ['comp', 'Ligue'], ['market', 'Mercato'], ['club', 'Club']];
  var body = UI['tab_' + UI.tab]();
  app.innerHTML =
    '<div class="app" style="--team:' + me.color + '">' +
    '<header class="topbar">' + UI.teamBadge(me) +
    '<div class="who"><b>' + UI.esc(me.name) + '</b><span>' + UI.esc(BM.dateLabel(g)) + ' · Saison ' + g.season + '</span></div>' +
    '<button class="btn sm" data-act="fastForward" title="Avancer jusqu\'au prochain événement">▶▶</button>' +
    '<button class="btn primary' + (matchToday ? ' pulse' : '') + '" data-act="continue">' + (matchToday ? 'Match !' : 'Continuer') + '</button>' +
    '</header>' +
    '<main class="page' + (enter ? ' enter' : '') + '">' + body + '</main>' +
    '<nav class="nav"><div class="nav-inner">' + tabs.map(function (t) {
      var dot = t[0] === 'home' && unread ? ' class="dot"' : '';
      return '<button data-act="tab" data-tab="' + t[0] + '" class="' + (UI.tab === t[0] ? 'on' : '') + '"><span' + dot + '>' + UI.icon(t[0]) + '</span>' + t[1] + '</button>';
    }).join('') + '</div></nav>' +
    '</div>';
  UI.afterRender();
};

UI.afterRender = function () {
  if (BM.Juice) BM.Juice.countUp(document.getElementById('app'));
};

UI.subTabs = function (key, items) {
  return '<div class="tabs">' + items.map(function (it) {
    return '<button data-act="subtab" data-key="' + key + '" data-v="' + it[0] + '" class="' + (UI.sub[key] === it[0] ? 'on' : '') + '">' + it[1] + '</button>';
  }).join('') + '</div>';
};

// ==================================================================== écran de départ
// Aperçu des clubs avant création : force (top 8) et vedette, calculés depuis les données.
UI.previewTeams = function () {
  if (UI._preview) return UI._preview;
  var keys = BM.NBA.attrKeys;
  var list = BM.NBA.teams.map(function (t, i) {
    var ps = BM.NBA.players.filter(function (d) { return d.t === t.code && d.a; }).map(function (d) {
      var attrs = {};
      keys.forEach(function (k, j) { attrs[k] = d.a[j]; });
      return { n: d.n, o: BM.ovrRaw({ pos: d.pos, attrs: attrs }) };
    }).sort(function (a, b) { return b.o - a.o; });
    var top = ps.slice(0, 8);
    return { i: i, t: t, strength: top.reduce(function (s, p) { return s + p.o; }, 0) / Math.max(1, top.length), star: ps[0] ? ps[0].n : '-' };
  });
  list.slice().sort(function (a, b) { return b.strength - a.strength; }).forEach(function (x, r) { x.rank = r + 1; });
  UI._preview = list;
  return list;
};

UI.ballSvg = function () {
  return '<svg class="ball" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="bg1" cx="35%" cy="30%" r="75%">' +
    '<stop offset="0" stop-color="#ffb066"/><stop offset="1" stop-color="#d9480f"/></radialGradient></defs>' +
    '<circle cx="50" cy="50" r="46" fill="url(#bg1)"/><g fill="none" stroke="#3a1300" stroke-width="3.5" stroke-linecap="round">' +
    '<path d="M4 50h92M50 4v92"/><path d="M18 17c14 14 14 52 0 66M82 17c-14 14-14 52 0 66"/></g></svg>';
};

UI.startScreen = function () {
  var hasSave = !!UI.store.get(BM.SAVE_KEY);
  var prev = UI.previewTeams();
  if (UI.pickTeam === undefined) UI.pickTeam = BM.NBA.teams.findIndex(function (t) { return t.code === 'GSW'; });
  var cur = prev[UI.pickTeam], t = cur.t;
  var obj = cur.rank <= 3 ? 'titre' : cur.rank <= 8 ? 'demi' : cur.rank <= 16 ? 'playoffs' : 'maintien';
  var confBlock = function (c) {
    return '<label style="margin-top:6px">' + BM.CONFERENCES[c] + '</label><div class="team-pick">' +
      prev.filter(function (x) { return x.t.conf === c; }).sort(function (a, b) { return a.rank - b.rank; }).map(function (x) {
        return '<button data-act="pickTeam" data-i="' + x.i + '" class="' + (x.i === UI.pickTeam ? 'on' : '') + '">' +
          '<span class="badge sm" style="background:' + x.t.color + '">' + x.t.short + '</span><span><b>' + UI.esc(x.t.city + ' ' + x.t.nick) + '</b><small>' +
          x.rank + 'e effectif · ' + UI.esc(x.star) + '</small></span></button>';
      }).join('') + '</div>';
  };
  return '<div class="app" style="padding-bottom:24px">' +
    '<div class="hero">' + UI.ballSvg() + '<h1>Hoops <span>Manager</span> 26</h1><p>Effectifs NBA réels 2026-27, version africaine.</p></div>' +
    '<div class="page">' +
    (hasSave ? '<div class="card"><div class="card-h"><h2>Reprendre</h2></div><button class="btn primary block" data-act="loadSave">Charger la partie sauvegardée</button></div>' : '') +
    '<div class="card" style="display:grid;gap:12px">' +
    '<h2>Nouvelle carrière</h2>' +
    '<div class="field"><label for="mgr">Nom du coach</label><input type="text" id="mgr" maxlength="30" value="' + UI.esc(UI.mgrName || '') + '" placeholder="Votre nom"></div>' +
    '<div class="field"><label>Choisissez votre club</label>' + confBlock('E') + confBlock('W') + '</div>' +
    '<p class="small muted" style="margin:0">Objectif de la direction pour <b>' + UI.esc(t.city + ' ' + t.nick) + '</b> : ' + BM.OBJECTIVES[obj] + '.</p>' +
    '<button class="btn primary block" data-act="newGame">Commencer</button>' +
    '</div>' +
    '<div class="card"><div class="card-h"><h2>Importer</h2></div><p class="small muted" style="margin-top:0">Charger un fichier de sauvegarde exporté (.json).</p>' +
    '<input type="file" accept="application/json,.json" data-change="importFile"></div>' +
    '</div></div>';
};

// ==================================================================== accueil
UI.tab_home = function () {
  var g = UI.g, me = g.teams[g.userTeam];
  var confPos = BM.standings(g, me.conf).indexOf(me) + 1;
  var next = BM.nextUserFixture(g), nextHtml;
  if (next) {
    var h = g.teams[next.home], a = g.teams[next.away];
    var label = next.type === 'playoff' ? BM.ROUND_NAMES[next.round] + ' · match ' + next.game : 'Journée ' + next.round;
    var today = next.day === g.day;
    nextHtml = '<div class="card hero-card"><div class="card-h"><h2>' + (today ? 'Match aujourd\'hui' : 'Prochain match') + '</h2><span class="small muted">' + UI.esc(BM.dateLabel(g, next.day)) + '</span></div>' +
      '<div class="vs"><div class="t">' + UI.teamBadge(h) + UI.esc(h.name) + '<span class="small muted">' + h.record.w + 'V-' + h.record.l + 'D</span></div>' +
      '<div class="mid">VS<small>' + label + '</small></div>' +
      '<div class="t">' + UI.teamBadge(a) + UI.esc(a.name) + '<span class="small muted">' + a.record.w + 'V-' + a.record.l + 'D</span></div></div>' +
      (today ? '<div style="margin-top:12px"><button class="btn primary block" data-act="continue">Aller au match</button></div>' : '') +
      '</div>';
  } else {
    nextHtml = '<div class="card"><h2>Aucun match programmé</h2><p class="small muted">' + (g.phase === 'playoffs' ? 'Votre équipe est éliminée. Les playoffs continuent.' : 'Fin de saison en approche.') + '</p></div>';
  }
  var roster = BM.roster(g, me);
  var morale = Math.round(roster.reduce(function (s, p) { return s + p.morale; }, 0) / roster.length);
  var injured = roster.filter(function (p) { return p.injury > 0; }).length;
  var conf = g.board.confidence;
  var msgs = g.inbox.slice(0, 20);
  var icons = { board: '🏛', match: '🏀', medical: '✚', transfer: '⇄', finance: '$', info: '✉', dev: '📈', scout: '🔭', media: '🎤', dyn: '👥' };
  return nextHtml +
    '<div class="grid2">' +
    '<div class="kpi"><b><span data-count="' + confPos + '">' + confPos + '</span><sup>e</sup></b><span>' + UI.esc(BM.CONFERENCES[me.conf]) + ' · ' + me.record.w + 'V-' + me.record.l + 'D</span></div>' +
    '<div class="kpi"><b data-count="' + conf + '" data-suffix="%">' + conf + '%</b><span>Confiance direction</span>' + UI.bar(conf) + '</div>' +
    '<div class="kpi"><b data-count="' + morale + '">' + morale + '</b><span>Moral moyen</span>' + UI.bar(morale) + '</div>' +
    '<div class="kpi"><b data-count="' + injured + '">' + injured + '</b><span>Blessé(s) · cohésion ' + Math.round(me.cohesion) + '</span></div>' +
    '</div>' +
    '<div class="card"><div class="card-h"><h2>Messagerie</h2><span class="small muted">Objectif : ' + BM.OBJECTIVES[g.objective] + '</span></div>' +
    (msgs.length ? msgs.map(function (m) {
      return '<div class="msg' + (m.read ? '' : ' unread') + '" data-act="openMsg" data-id="' + m.id + '"><div class="ic">' + (icons[m.type] || '✉') + '</div><div style="min-width:0">' +
        '<b>' + UI.esc(m.title) + '</b>' + (m.actions ? '<span class="tag warn">Action requise</span>' : '') +
        '<p>' + UI.esc(BM.dateLabel(g, m.day)) + '</p></div></div>';
    }).join('') : '<p class="muted">Aucun message.</p>') +
    '</div>';
};

UI.actions.openMsg = function (el) {
  var g = UI.g, m = g.inbox.find(function (x) { return x.id === +el.dataset.id; });
  if (!m) return;
  m.read = true;
  UI.modal('<div class="modal-h"><h2>' + UI.esc(m.title) + '</h2><button class="btn sm x" data-act="closeModal">Fermer</button></div>' +
    '<p class="small muted" style="margin:0">' + UI.esc(BM.dateLabel(g, m.day)) + '</p>' +
    '<div class="card" style="white-space:pre-line">' + UI.esc(m.body) + (m.resolved ? '\n\n' + UI.esc(m.resolved) : '') + '</div>' +
    (m.actions ? '<div class="btn-row">' + m.actions.map(function (a, i) {
      return '<button class="btn' + (i === 0 ? ' primary' : '') + '" data-act="msgAction" data-id="' + m.id + '" data-i="' + i + '">' + UI.esc(a.label) + '</button>';
    }).join('') + '</div>' : ''));
  UI.save();
  UI.render();
};

UI.actions.msgAction = function (el) {
  var res = BM.handleMessageAction(UI.g, +el.dataset.id, +el.dataset.i);
  UI.closeModal();
  UI.toast(res);
  UI.save();
  UI.render();
};

// ==================================================================== effectif
UI.SQUAD_COLS = [
  ['pos', 'Pos'], ['name', 'Nom'], ['age', 'Âge', 1], ['ovr', 'Note', 1], ['pot', 'Pot.', 1], ['form', 'Forme', 1],
  ['gsb', 'GSB', 1], ['gab', 'GAB', 1], ['gd', 'GD', 1],
  ['cond', 'Cond.', 1], ['morale', 'Moral', 1], ['pts', 'Pts', 1], ['salary', 'Salaire', 1]
];

// Valeur de gravité avec flèche de tendance (écart à la base du joueur, dû à la forme).
UI.gravCell = function (v, trend) {
  var arrow = trend >= 2 ? ' <span style="color:var(--good)">▲</span>' : trend <= -2 ? ' <span style="color:var(--bad)">▼</span>' : trend > 0 ? ' <span style="color:var(--good)">↗</span>' : trend < 0 ? ' <span style="color:var(--bad)">↘</span>' : '';
  return '<b class="' + UI.attrClass(v) + '">' + v + '</b>' + arrow;
};

UI.sortValue = function (p, k) {
  switch (k) {
    case 'pos': return BM.POSITIONS.indexOf(p.pos);
    case 'name': return p.last;
    case 'age': return p.age;
    case 'ovr': return BM.ovrRaw(p);
    case 'pot': return BM.potDisplay(p);
    case 'form': return p.form.length ? p.form.reduce(function (s, x) { return s + x; }, 0) / p.form.length : 0;
    case 'cond': return p.condition;
    case 'morale': return p.morale;
    case 'pts': return p.stats.gp ? p.stats.pts / p.stats.gp : 0;
    case 'salary': return p.contract.salary;
    case 'gsb': return BM.gravity(p).off;
    case 'gab': return BM.gravity(p).on;
    case 'gd': return BM.gravity(p).def;
  }
  return 0;
};

UI.sortPlayers = function (list) {
  var k = UI.sort.key, d = UI.sort.dir;
  return list.sort(function (a, b) {
    var x = UI.sortValue(a, k), y = UI.sortValue(b, k);
    return (x < y ? -1 : x > y ? 1 : 0) * d;
  });
};

UI.tab_squad = function () {
  UI.sub.squad = UI.sub.squad || 'list';
  var tabs = UI.subTabs('squad', UI.SQUAD_TABS);
  if (UI.sub.squad !== 'list') return tabs + UI['squad_' + UI.sub.squad]();
  return tabs + UI.squad_list();
};
UI.SQUAD_TABS = [['list', 'Effectif'], ['dev', 'Développement']];

UI.squad_list = function () {
  var g = UI.g, me = g.teams[g.userTeam];
  var list = UI.sortPlayers(BM.roster(g, me));
  return '<div class="card"><div class="card-h"><h2>Effectif (' + list.length + '/' + BM.ROSTER_MAX + ')</h2><span class="small muted">Masse salariale ' + BM.money(BM.payroll(g, me)) + ' / ' + BM.money(me.wageBudget) + '</span></div>' +
    '<div class="table-wrap"><table><thead><tr>' + UI.SQUAD_COLS.map(function (c) {
      var arrow = UI.sort.key === c[0] ? (UI.sort.dir < 0 ? ' ↓' : ' ↑') : '';
      return '<th data-act="sort" data-k="' + c[0] + '" class="' + (c[2] ? 'num' : '') + (c[0] === 'salary' || c[0] === 'pts' ? ' hide-sm' : '') + '">' + c[1] + arrow + '</th>';
    }).join('') + '</tr></thead><tbody>' +
    list.map(function (p) {
      var gr = BM.gravity(p);
      return '<tr class="click" data-act="player" data-id="' + p.id + '">' +
        '<td><span class="pos">' + p.pos + '</span></td>' +
        '<td>' + UI.esc(BM.shortName(p)) + UI.statusTags(p) + '</td>' +
        '<td class="num">' + p.age + '</td>' +
        '<td class="num">' + UI.ovrBadge(BM.ovr(p)) + '</td>' +
        '<td class="num muted">' + BM.potDisplay(p) + '</td>' +
        '<td class="num">' + UI.avgForm(p) + '</td>' +
        '<td class="num">' + UI.gravCell(gr.off, gr.trend.off) + '</td>' +
        '<td class="num">' + UI.gravCell(gr.on, gr.trend.on) + '</td>' +
        '<td class="num">' + UI.gravCell(gr.def, gr.trend.def) + '</td>' +
        '<td class="num">' + Math.round(p.condition) + '%</td>' +
        '<td class="num">' + Math.round(p.morale) + '</td>' +
        '<td class="num hide-sm">' + UI.per(p, 'pts') + '</td>' +
        '<td class="num hide-sm">' + BM.money(p.contract.salary) + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="hint" style="margin:10px 0 0">GSB / GAB / GD : gravité sans ballon, avec ballon et défensive. ▲▼ : variation due à la forme des 5 derniers matchs.</p></div>';
};

UI.actions.sort = function (el) {
  var k = el.dataset.k;
  if (UI.sort.key === k) UI.sort.dir *= -1;
  else { UI.sort.key = k; UI.sort.dir = k === 'name' || k === 'pos' || k === 'age' ? 1 : -1; }
  UI.render();
};

// ==================================================================== fiche joueur
UI.actions.player = function (el) { UI.showPlayer(+el.dataset.id); };

UI.showPlayer = function (id) {
  var g = UI.g, p = g.players[id];
  var team = p.teamId === null ? null : g.teams[p.teamId];
  var mine = p.teamId === g.userTeam;
  var groups = {};
  BM.ATTRS.forEach(function (a) { (groups[a.g] = groups[a.g] || []).push(a); });
  var s = p.stats;
  var pct = function (m, a) { return a ? Math.round(m / a * 100) + '%' : '-'; };
  var actions;
  if (mine) {
    actions = '<div class="btn-row">' +
      '<button class="btn" data-act="extendForm" data-id="' + p.id + '">Prolonger</button>' +
      '<button class="btn" data-act="toggleList" data-id="' + p.id + '">' + (p.listed ? 'Retirer de la liste' : 'Placer sur la liste des transferts') + '</button>' +
      '<button class="btn danger" data-act="releaseAsk" data-id="' + p.id + '">Libérer</button></div>';
  } else {
    actions = p.prospect ? '<p class="hint" style="margin:0">Prospect de la draft (' + UI.esc(p.college) + ') : disponible le soir de la draft.</p>'
      : '<button class="btn primary block" data-act="offerForm" data-id="' + p.id + '">' + (team ? 'Faire une offre de rachat' : 'Proposer un contrat') + '</button>';
    if (BM.knowledge(g, p) < 100) actions += '<button class="btn block" data-act="scoutPlayer" data-id="' + p.id + '">Faire observer par un scout</button>';
  }
  var progress = p.lastProgress && g.day - p.lastProgress.day <= 14
    ? '<p class="small" style="margin:0;color:var(--good)">Progression récente : ' + UI.esc(BM.ATTRS.find(function (a) { return a.k === p.lastProgress.k; }).l) + ' +1</p>' : '';
  UI.modal(
    '<div class="modal-h">' + (team ? UI.teamBadge(team) : '<span class="badge" style="background:#868e96">AL</span>') +
    '<div><h2>' + UI.esc(BM.fullName(p)) + '</h2><span class="small muted">' + BM.POS_LABEL[p.pos] + ' · ' + p.age + ' ans · ' + p.height + ' cm · ' + (team ? UI.esc(team.name) : 'Agent libre') + '</span></div>' +
    '<button class="btn sm x" data-act="closeModal">Fermer</button></div>' +
    '<div class="grid2">' +
    (mine ? '<div class="kpi"><b>' + UI.ovrBadge(BM.ovr(p)) + ' <span class="muted" style="font-size:14px">pot. ' + BM.potDisplay(p) + '</span></b><span>Note actuelle / potentiel estimé</span></div>'
      : '<div class="kpi"><b>' + UI.estBadge(p) + ' <span class="muted" style="font-size:14px">pot. ' + UI.estPot(p) + '</span></b><span>Estimation des scouts · connu à ' + Math.round(BM.knowledge(g, p)) + '%</span>' + UI.knowBar(p) + '</div>') +
    '<div class="kpi"><b>' + BM.money(p.contract.salary) + '</b><span>' + p.contract.years + ' saison(s) restante(s) · valeur ' + BM.money(BM.playerValue(p)) + '</span></div>' +
    '<div class="kpi"><b>' + Math.round(p.condition) + '%</b><span>Condition physique' + (p.injury > 0 ? ' · blessé ' + p.injury + ' j' : '') + '</span>' + UI.bar(p.condition) + '</div>' +
    '<div class="kpi"><b>' + Math.round(p.morale) + '</b><span>Moral · forme ' + UI.avgForm(p) + '</span>' + UI.bar(p.morale) + '</div>' +
    '</div>' + progress + (mine ? UI.devCard(p) : '') + UI.gravityCard(p) +
    '<div class="card attrs">' + Object.keys(groups).map(function (gk) {
      return '<div><h3>' + BM.ATTR_GROUPS[gk] + '</h3>' + groups[gk].map(function (a) {
        var lab = BM.attrLabel(g, p, a.k);
        return '<div class="attr"><span>' + a.l + '</span><b class="' + UI.attrClass(lab.v) + '">' + lab.t + '</b></div>';
      }).join('') + '</div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-h"><h3>Saison en cours</h3><span class="small muted">' + s.gp + ' match(s)</span></div>' +
    '<div class="table-wrap"><table><thead><tr><th class="num">Min</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Pd</th><th class="num">Int</th><th class="num">Ctr</th><th class="num">Tirs</th><th class="num">3 pts</th><th class="num">LF</th><th class="num">Note</th></tr></thead><tbody><tr>' +
    '<td class="num">' + UI.per(p, 'min') + '</td><td class="num">' + UI.per(p, 'pts') + '</td><td class="num">' + UI.per(p, 'reb') + '</td><td class="num">' + UI.per(p, 'ast') + '</td>' +
    '<td class="num">' + UI.per(p, 'stl') + '</td><td class="num">' + UI.per(p, 'blk') + '</td><td class="num">' + pct(s.fgm, s.fga) + '</td><td class="num">' + pct(s.tpm, s.tpa) + '</td>' +
    '<td class="num">' + pct(s.ftm, s.fta) + '</td><td class="num">' + UI.per(p, 'rtg') + '</td></tr></tbody></table></div>' +
    (p.real ? '<p class="small muted" style="margin:10px 0 0">Saison NBA passée : ' + p.real.pts + ' pts · ' + p.real.reb + ' reb · ' + p.real.ast + ' pd · ' +
      p.real.stl + ' int · ' + p.real.blk + ' ctr (' + p.real.gp + ' matchs)</p>' : '') +
    (p.career.length ? '<p class="small muted" style="margin:10px 0 0">Carrière : ' + p.career.map(function (c) {
      return 'S' + c.season + ' ' + c.team + ' ' + (c.pts / c.gp).toFixed(1) + ' pts';
    }).join(' · ') + '</p>' : '') + '</div>' +
    actions
  );
};

UI.gravityCard = function (p) {
  var gr = BM.gravity(p), base = BM.gravityBase(p);
  return '<div class="card"><div class="card-h"><h3>Gravité</h3><span class="small muted">forme ' + UI.avgForm(p) + ' sur 5 matchs</span></div>' +
    BM.GRAVITY.map(function (d) {
      var v = gr[d.k], t = gr.trend[d.k];
      return '<div style="padding:6px 0;border-bottom:1px solid var(--border)"><div class="attr"><span>' + d.l + '</span><span>' + UI.gravCell(v, t) +
        ' <span class="muted small">(base ' + base[d.k] + (t ? ', ' + (t > 0 ? '+' : '') + t + ' forme' : '') + ')</span></span></div>' +
        UI.bar(v * 5) + '<p class="hint" style="margin:4px 0 0">' + UI.esc(d.d) + '</p></div>';
    }).join('') + '</div>';
};

UI.actions.toggleList = function (el) {
  var p = UI.g.players[+el.dataset.id];
  p.listed = !p.listed;
  UI.toast(p.listed ? 'Joueur placé sur la liste des transferts.' : 'Joueur retiré de la liste.');
  UI.save(); UI.showPlayer(p.id); UI.render();
};

UI.actions.releaseAsk = function (el) {
  var p = UI.g.players[+el.dataset.id];
  var cost = Math.round(p.contract.salary * p.contract.years * 0.5);
  UI.modal('<div class="modal-h"><h2>Libérer ' + UI.esc(BM.fullName(p)) + ' ?</h2></div>' +
    '<p>Le contrat sera résilié. Indemnité à verser : <b>' + BM.money(cost) + '</b>.</p>' +
    '<div class="btn-row"><button class="btn danger" data-act="release" data-id="' + p.id + '">Confirmer</button><button class="btn" data-act="player" data-id="' + p.id + '">Annuler</button></div>');
};

UI.actions.release = function (el) {
  var g = UI.g, p = g.players[+el.dataset.id];
  BM.releasePlayer(g, p.id);
  UI.closeModal(); UI.toast(BM.fullName(p) + ' a été libéré.'); UI.save(); UI.render();
};

UI.contractForm = function (p, opts) {
  var asking = BM.askingSalary(p);
  return '<div class="field"><label for="f-sal">Salaire annuel (k$) · demandé ≈ ' + BM.money(asking) + '</label><input type="number" id="f-sal" min="1300" step="50" value="' + (opts.salary || asking) + '"></div>' +
    '<div class="field"><label for="f-yrs">Durée</label><select id="f-yrs">' + [1, 2, 3, 4].map(function (y) {
      return '<option value="' + y + '"' + (y === (opts.years || 2) ? ' selected' : '') + '>' + y + ' saison' + (y > 1 ? 's' : '') + '</option>';
    }).join('') + '</select></div>' +
    (opts.fee !== undefined ? '<div class="field"><label for="f-fee">Indemnité de rachat (k$) · valeur ≈ ' + BM.money(BM.playerValue(p)) + '</label><input type="number" id="f-fee" min="0" step="50" value="' + opts.fee + '"></div>' : '');
};

UI.actions.offerForm = function (el) {
  var g = UI.g, p = g.players[+el.dataset.id], me = g.teams[g.userTeam];
  var other = p.teamId !== null;
  UI.modal('<div class="modal-h"><h2>Offre pour ' + UI.esc(BM.fullName(p)) + '</h2><button class="btn sm x" data-act="player" data-id="' + p.id + '">Retour</button></div>' +
    '<p class="small muted" style="margin:0">Masse salariale disponible : ' + BM.money(me.wageBudget - BM.payroll(g, me)) + ' · budget transferts : ' + BM.money(me.balance) + '</p>' +
    UI.contractForm(p, { fee: other ? BM.playerValue(p) : undefined }) +
    '<button class="btn primary block" data-act="sendOffer" data-id="' + p.id + '">Envoyer l\'offre</button>');
};

UI.readNum = function (id) { var el = document.getElementById(id); return el ? Math.max(0, Math.round(+el.value || 0)) : 0; };

UI.actions.sendOffer = function (el) {
  var g = UI.g, id = +el.dataset.id;
  var r = BM.offerContract(g, id, UI.readNum('f-sal'), UI.readNum('f-yrs') || 1, UI.readNum('f-fee'));
  UI.toast(r.msg);
  if (r.ok) { UI.closeModal(); UI.save(); UI.render(); }
};

UI.actions.extendForm = function (el) {
  var p = UI.g.players[+el.dataset.id];
  UI.modal('<div class="modal-h"><h2>Prolonger ' + UI.esc(BM.fullName(p)) + '</h2><button class="btn sm x" data-act="player" data-id="' + p.id + '">Retour</button></div>' +
    '<p class="small muted" style="margin:0">Contrat actuel : ' + BM.money(p.contract.salary) + ', ' + p.contract.years + ' saison(s). Un joueur au bon moral est plus conciliant.</p>' +
    UI.contractForm(p, { salary: Math.max(p.contract.salary, BM.askingSalary(p)), years: 2 }) +
    '<button class="btn primary block" data-act="sendExtend" data-id="' + p.id + '">Proposer</button>');
};

UI.actions.sendExtend = function (el) {
  var r = BM.extendContract(UI.g, +el.dataset.id, UI.readNum('f-sal'), UI.readNum('f-yrs') || 1);
  UI.toast(r.msg);
  if (r.ok) { UI.save(); UI.showPlayer(+el.dataset.id); UI.render(); }
};

// ==================================================================== tactique & entraînement
UI.tab_tactics = function () {
  var html = UI.subTabs('tactics', [['plan', 'Plan de jeu'], ['roles', 'Rôles'], ['rotation', 'Rotation'], ['training', 'Entraînement']]);
  return html + UI['tactics_' + UI.sub.tactics]();
};

UI.seg = function (field, options, value) {
  return '<div class="seg">' + options.map(function (o) {
    return '<button data-act="setTactic" data-f="' + field + '" data-v="' + o.v + '" class="' + (o.v === value ? 'on' : '') + '">' + o.l + '</button>';
  }).join('') + '</div><p class="hint" style="margin:0">' + UI.esc((options.find(function (o) { return o.v === value; }) || {}).d || '') + '</p>';
};

UI.tactics_plan = function () {
  var g = UI.g, me = g.teams[g.userTeam], t = me.tactics, O = BM.TACTIC_OPTIONS;
  var roster = BM.roster(g, me).sort(function (a, b) { return BM.POSITIONS.indexOf(a.pos) - BM.POSITIONS.indexOf(b.pos) || BM.ovrRaw(b) - BM.ovrRaw(a); });
  var slots = ['Meneur', 'Arrière', 'Ailier', 'Ailier fort', 'Pivot'];
  var bt = BM.bestTactic(g, me);
  var card = function (field, map, kind, fitFn, current) {
    return Object.keys(map).map(function (id) {
      var fit = fitFn(g, me, id), fam = Math.round(BM.familiarity(me, kind, id)), on = id === current;
      return '<button class="tac-card' + (on ? ' on' : '') + '" data-act="setTactic" data-f="' + field + '" data-v="' + id + '">' +
        '<span class="tac-h"><b>' + UI.esc(map[id].l) + '</b>' + (id === bt[field] ? '<span class="tag good">Conseillé</span>' : '') + '</span>' +
        '<span class="tac-d">' + UI.esc(map[id].d) + '</span>' +
        '<span class="tac-m"><span>Adéquation</span>' + UI.bar(fit) + '<em>' + fit + '</em></span>' +
        '<span class="tac-m"><span>Familiarité</span>' + UI.bar(fam) + '<em>' + fam + '</em></span></button>';
    }).join('');
  };
  return '<div class="card"><div class="card-h"><h2>Système offensif</h2><span class="small muted">Adéquation = effectif vs reste de la NBA</span></div>' +
    '<div class="tac-grid">' + card('system', BM.SYSTEMS, 'off', BM.systemFit, t.system) + '</div></div>' +
    '<div class="card"><div class="card-h"><h2>Schéma défensif</h2></div><div class="tac-grid">' + card('defense', BM.SCHEMES, 'def', BM.schemeFit, t.defense) + '</div>' +
    '<p class="hint" style="margin:10px 0 0">La familiarité monte avec les matchs et l\'entraînement « Tactique » ; changer de système repart d\'une familiarité basse.</p></div>' +
    '<div class="card" style="display:grid;gap:10px"><h2>Rythme</h2>' + UI.seg('pace', O.pace, t.pace) + '</div>' +
    '<div class="card" style="display:grid;gap:10px"><div class="card-h" style="margin:0"><h2>Cinq de départ</h2><button class="btn sm" data-act="autoTactics">Auto</button></div>' +
    slots.map(function (label, i) {
      return '<div class="field"><label>' + label + '</label><select data-change="starter" data-i="' + i + '">' +
        '<option value="">—</option>' + roster.map(function (p) {
          return '<option value="' + p.id + '"' + (t.starters[i] === p.id ? ' selected' : '') + (p.injury > 0 ? ' disabled' : '') + '>' +
            p.pos + ' · ' + UI.esc(BM.shortName(p)) + ' (' + BM.ovr(p) + ')' + (p.injury > 0 ? ' – blessé' : '') + '</option>';
        }).join('') + '</select></div>';
    }).join('') + '</div>';
};

UI.stars = function (n) {
  var full = Math.floor(n), half = n - full >= 0.5;
  return '<span class="stars">' + '★'.repeat(full) + (half ? '<i>★</i>' : '') + '<s>' + '★'.repeat(5 - full - (half ? 1 : 0)) + '</s></span>';
};

UI.tactics_roles = function () {
  var g = UI.g, me = g.teams[g.userTeam], t = me.tactics, sys = BM.SYSTEMS[t.system];
  BM.ensureRoles(g, me);
  var mins = t.minutes || {};
  var roster = BM.roster(g, me).sort(function (a, b) { return (mins[b.id] || 0) - (mins[a.id] || 0); });
  return '<div class="card"><div class="card-h"><h2>Rôles</h2><button class="btn sm" data-act="autoRoles">Auto</button></div>' +
    '<p class="hint" style="margin:0 0 8px">Rôles clés du ' + UI.esc(sys.l) + ' : ' + sys.roles.map(function (r) { return UI.esc(BM.ROLES[r].l); }).join(', ') +
    '. Le rôle oriente les tirs, le volume de jeu et l\'impact défensif.</p>' +
    roster.map(function (p) {
      var cur = t.roles[p.id], stars = BM.roleStars(p, cur), bestR = BM.bestRole(p), key = sys.roles.indexOf(cur) >= 0;
      return '<div class="role-row"><div><span class="pos">' + p.pos + '</span> <b>' + UI.esc(BM.shortName(p)) + '</b> ' + UI.ovrBadge(BM.ovr(p)) +
        '<div class="small muted">' + UI.stars(stars) + (key ? ' <span class="tag good">Clé du système</span>' : '') +
        (bestR !== cur ? ' · conseillé : ' + UI.esc(BM.ROLES[bestR].l) : '') + '</div></div>' +
        '<select data-change="role" data-id="' + p.id + '" aria-label="Rôle de ' + UI.esc(BM.shortName(p)) + '">' + Object.keys(BM.ROLES).map(function (r) {
          return '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>' + UI.esc(BM.ROLES[r].l) + ' (' + BM.roleStars(p, r) + '★)</option>';
        }).join('') + '</select></div>';
    }).join('') + '</div>';
};

UI.changes.role = function (el) {
  var t = UI.g.teams[UI.g.userTeam].tactics;
  t.roles[+el.dataset.id] = el.value;
  UI.save(); UI.render();
};

UI.actions.autoRoles = function () {
  var me = UI.g.teams[UI.g.userTeam];
  me.tactics.roles = {};
  BM.ensureRoles(UI.g, me);
  UI.toast('Rôles attribués selon les profils.');
  UI.save(); UI.render();
};

UI.tactics_rotation = function () {
  var g = UI.g, me = g.teams[g.userTeam], mins = me.tactics.minutes;
  var roster = BM.roster(g, me).sort(function (a, b) { return (mins[b.id] || 0) - (mins[a.id] || 0); });
  var total = roster.reduce(function (s, p) { return s + (p.injury > 0 ? 0 : (mins[p.id] || 0)); }, 0);
  return '<div class="card"><div class="card-h"><h2>Temps de jeu prévu</h2><button class="btn sm" data-act="autoTactics">Auto</button></div>' +
    '<p class="small" style="margin:0 0 8px">Total : <b style="color:' + (Math.abs(total - 200) <= 10 ? 'var(--good)' : 'var(--warn)') + '">' + total + '</b> / 200 min. ' +
    '<span class="muted">Le plan est normalisé à 200 min en match ; les rotations automatiques tiennent compte de la fatigue et des fautes.</span></p>' +
    roster.map(function (p) {
      var v = mins[p.id] || 0;
      return '<div class="min-row"><div><span class="pos">' + p.pos + '</span> ' + UI.esc(BM.shortName(p)) + ' ' + UI.ovrBadge(BM.ovr(p)) + (p.injury > 0 ? '<span class="tag bad">Blessé</span>' : '') + '</div>' +
        '<input type="range" min="0" max="40" step="1" value="' + v + '" data-change="minutes" data-id="' + p.id + '" aria-label="Minutes ' + UI.esc(BM.shortName(p)) + '">' +
        '<b class="num" id="min-' + p.id + '">' + v + '</b></div>';
    }).join('') + '</div>';
};

UI.tactics_training = function () {
  var g = UI.g, me = g.teams[g.userTeam], tr = g.training;
  var roster = BM.roster(g, me).sort(function (a, b) { return a.condition - b.condition; });
  var recent = roster.filter(function (p) { return p.lastProgress && g.day - p.lastProgress.day <= 14; });
  var focusDesc = {
    equilibre: 'Travail général : progression répartie sur tous les attributs.',
    tir: 'Tir à 3 pts, mi-distance, lancers francs, finition.',
    defense: 'Défense extérieure et intérieure, contres, interceptions, rebond.',
    physique: 'Vitesse, détente, force, endurance.',
    tactique: 'Lecture du jeu, passe, dribble, sang-froid. Augmente la cohésion collective.',
    repos: 'Aucune progression, récupération maximale et léger gain de moral.'
  };
  return '<div class="card" style="display:grid;gap:12px"><h2>Programme quotidien</h2>' +
    '<div class="field"><label>Thème</label><div class="tabs" style="flex-wrap:wrap">' + BM.TRAINING.focus.map(function (f) {
      return '<button data-act="setTraining" data-f="focus" data-v="' + f.v + '" class="' + (tr.focus === f.v ? 'on' : '') + '">' + f.l + '</button>';
    }).join('') + '</div><p class="hint" style="margin:0">' + focusDesc[tr.focus] + '</p></div>' +
    '<div class="field"><label>Intensité</label><div class="seg">' + BM.TRAINING.intensity.map(function (i) {
      return '<button data-act="setTraining" data-f="intensity" data-v="' + i.v + '" class="' + (tr.intensity === i.v ? 'on' : '') + '">' + i.l + '</button>';
    }).join('') + '</div><p class="hint" style="margin:0">Une intensité élevée accélère la progression mais ralentit la récupération et augmente le risque de blessure.</p></div>' +
    '<p class="small muted" style="margin:0">Cohésion de l\'équipe : <b>' + Math.round(me.cohesion) + '</b>/100 (bonus d\'adresse en match).</p></div>' +
    (recent.length ? '<div class="card"><h2 style="margin-bottom:8px">Progressions récentes</h2>' + recent.map(function (p) {
      return '<div class="attr"><span>' + UI.esc(BM.shortName(p)) + '</span><span class="a-hi">' + UI.esc(BM.ATTRS.find(function (a) { return a.k === p.lastProgress.k; }).l) + ' +1</span></div>';
    }).join('') + '</div>' : '') +
    '<div class="card"><h2 style="margin-bottom:8px">État physique</h2>' + roster.map(function (p) {
      return '<div class="min-row" style="grid-template-columns:1fr 110px 44px"><div>' + UI.esc(BM.shortName(p)) + (p.injury > 0 ? '<span class="tag bad">' + p.injury + 'j</span>' : '') + '</div>' + UI.bar(p.condition) + '<b class="num">' + Math.round(p.condition) + '%</b></div>';
    }).join('') + '</div>';
};

UI.actions.setTactic = function (el) {
  var me = UI.g.teams[UI.g.userTeam];
  if (me.tactics[el.dataset.f] !== el.dataset.v && (el.dataset.f === 'system' || el.dataset.f === 'defense')) {
    var fam = BM.familiarity(me, el.dataset.f === 'system' ? 'off' : 'def', el.dataset.v);
    UI.toast(fam < 60 ? 'Nouveau système : familiarité ' + Math.round(fam) + '. Travaillez-le à l\'entraînement (Tactique).' : 'Système adopté.');
  }
  me.tactics[el.dataset.f] = el.dataset.v;
  UI.save(); UI.render();
};

UI.actions.setTraining = function (el) {
  UI.g.training[el.dataset.f] = el.dataset.v;
  UI.save(); UI.render();
};

UI.actions.autoTactics = function () {
  BM.autoTactics(UI.g, UI.g.teams[UI.g.userTeam]);
  UI.toast('Cinq de départ et rotation définis automatiquement.');
  UI.save(); UI.render();
};


UI.changes.starter = function (el) {
  var t = UI.g.teams[UI.g.userTeam].tactics, i = +el.dataset.i, id = el.value ? +el.value : null;
  var prev = t.starters.indexOf(id);
  if (id !== null && prev >= 0 && prev !== i) t.starters[prev] = t.starters[i];
  t.starters[i] = id;
  t.starters = t.starters.slice(0, 5);
  UI.save(); UI.render();
};
UI.changes.minutes = function (el, ev) {
  var t = UI.g.teams[UI.g.userTeam].tactics;
  t.minutes[+el.dataset.id] = +el.value;
  if (ev.type === 'change') { UI.save(); UI.render(); }
  else { var b = document.getElementById('min-' + el.dataset.id); if (b) b.textContent = el.value; }
};

// ==================================================================== ligue
UI.tab_comp = function () {
  var html = UI.subTabs('comp', [['table', 'Classement'], ['fixtures', 'Calendrier'], ['stats', 'Statistiques'], ['playoffs', 'Playoffs'], ['history', 'Palmarès']]);
  return html + UI['comp_' + UI.sub.comp]();
};

UI.comp_table = function () {
  var g = UI.g, me = g.teams[g.userTeam];
  return ['E', 'W'].sort(function (a) { return a === me.conf ? -1 : 1; }).map(function (c) {
    var st = BM.standings(g, c);
    return '<div class="card"><div class="card-h"><h2>' + BM.CONFERENCES[c] + '</h2><span class="small muted">Top 8 en playoffs</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>#</th><th>Équipe</th><th class="num">V</th><th class="num">D</th><th class="num">Diff</th><th class="num hide-sm">Pts+</th><th class="num">Série</th></tr></thead><tbody>' +
      st.map(function (t, i) {
        var r = t.record, diff = r.pf - r.pa;
        return '<tr class="' + (t.id === g.userTeam ? 'me' : '') + '"' + (i === 7 ? ' style="border-bottom:2px solid var(--accent)"' : '') + '>' +
          '<td>' + (i + 1) + '</td><td>' + UI.teamBadge(t, true) + ' ' + UI.esc(t.name) + '</td><td class="num">' + r.w + '</td><td class="num">' + r.l + '</td>' +
          '<td class="num">' + (diff > 0 ? '+' : '') + diff + '</td><td class="num hide-sm">' + r.pf + '</td><td class="num">' + (r.streak || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('');
};

UI.comp_fixtures = function () {
  var g = UI.g;
  var mine = g.fixtures.filter(function (f) { return f.home === g.userTeam || f.away === g.userTeam; }).sort(function (a, b) { return a.day - b.day; });
  return '<div class="card"><h2 style="margin-bottom:8px">Calendrier de ' + UI.esc(g.teams[g.userTeam].name) + '</h2>' +
    '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Adversaire</th><th></th><th class="num">Score</th></tr></thead><tbody>' +
    mine.map(function (f) {
      var home = f.home === g.userTeam, opp = g.teams[home ? f.away : f.home];
      var res = '-';
      if (f.played) {
        var us = home ? f.hs : f.as, them = home ? f.as : f.hs;
        res = '<b style="color:' + (us > them ? 'var(--good)' : 'var(--bad)') + '">' + (us > them ? 'V ' : 'D ') + us + '-' + them + '</b>';
      }
      return '<tr class="' + (f.played ? 'click' : '') + '"' + (f.played ? ' data-act="boxScore" data-id="' + f.id + '"' : '') + '>' +
        '<td>' + UI.esc(BM.dateLabel(g, f.day)) + '</td><td>' + UI.teamBadge(opp, true) + ' ' + UI.esc(opp.name) + '</td>' +
        '<td class="muted">' + (home ? 'Dom.' : 'Ext.') + (f.type === 'playoff' ? ' · PO' : '') + '</td><td class="num">' + res + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
};

UI.comp_stats = function () {
  var g = UI.g;
  var cats = [['pts', 'Points'], ['reb', 'Rebonds'], ['ast', 'Passes déc.'], ['stl', 'Interceptions'], ['blk', 'Contres'], ['rtg', 'Note moyenne']];
  return cats.map(function (c) {
    var list = BM.leaders(g, c[0], 5);
    return '<div class="card"><h2 style="margin-bottom:6px">' + c[1] + '</h2>' + (list.length ? list.map(function (p, i) {
      return '<div class="attr click" data-act="player" data-id="' + p.id + '" style="cursor:pointer"><span>' + (i + 1) + '. ' + UI.esc(BM.shortName(p)) +
        ' <span class="muted small">' + g.teams[p.teamId].short + '</span></span><b>' + (p.stats[c[0]] / p.stats.gp).toFixed(1) + '</b></div>';
    }).join('') : '<p class="muted small" style="margin:0">Pas encore assez de matchs.</p>') + '</div>';
  }).join('');
};

UI.comp_playoffs = function () {
  var g = UI.g, po = g.playoffs;
  if (!po) return '<div class="card"><h2>Playoffs</h2><p class="muted">Les 8 premiers de chaque conférence se qualifient. Séries au meilleur des 5 matchs, finales au meilleur des 7.</p></div>';
  var rounds = [1, 2, 3, 4];
  return rounds.map(function (r) {
    var ss = po.series.filter(function (s) { return s.round === r; });
    if (!ss.length) return '';
    return '<div class="card"><h2 style="margin-bottom:8px">' + BM.ROUND_NAMES[r] + '</h2>' + ss.map(function (s) {
      var a = g.teams[s.a], b = g.teams[s.b];
      var line = function (t, w, won) {
        return '<div class="attr"><span style="' + (won ? 'font-weight:700' : '') + '">' + UI.teamBadge(t, true) + ' ' + UI.esc(t.name) + '</span><b>' + w + '</b></div>';
      };
      return '<div style="padding:6px 0;border-bottom:1px solid var(--border)">' + line(a, s.wa, s.winner === s.a) + line(b, s.wb, s.winner === s.b) + '</div>';
    }).join('') + '</div>';
  }).join('') + (po.champion !== undefined ? '<div class="card"><h2>🏆 ' + UI.esc(g.teams[po.champion].name) + '</h2></div>' : '');
};

UI.comp_history = function () {
  var g = UI.g;
  return '<div class="card"><h2 style="margin-bottom:8px">Palmarès</h2>' + (g.history.length ? '<div class="table-wrap"><table><thead><tr><th>Saison</th><th>Champion</th><th class="num">Votre rang</th><th>MVP</th></tr></thead><tbody>' +
    g.history.map(function (h) {
      return '<tr><td>' + h.season + '</td><td>' + UI.esc(g.teams[h.champion].name) + '</td><td class="num">' + h.pos + 'e</td><td>' + UI.esc(h.mvp) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin:0">Aucune saison terminée.</p>') + '</div>';
};

UI.actions.boxScore = function (el) {
  var g = UI.g, f = g.fixtures.find(function (x) { return x.id === +el.dataset.id; });
  if (!f || !f.box) return;
  UI.modal('<div class="modal-h"><h2>' + UI.esc(g.teams[f.home].short + ' ' + f.hs + ' - ' + f.as + ' ' + g.teams[f.away].short) + '</h2><button class="btn sm x" data-act="closeModal">Fermer</button></div>' +
    UI.boxTable(g, f.box, 0, g.teams[f.home]) + UI.boxTable(g, f.box, 1, g.teams[f.away]));
};

UI.boxTable = function (g, box, side, team) {
  var rows = Object.keys(box).filter(function (id) { return box[id].side === side && box[id].min > 0; })
    .sort(function (a, b) { return box[b].min - box[a].min; });
  return '<div class="card"><h3 style="margin-bottom:6px">' + UI.teamBadge(team, true) + ' ' + UI.esc(team.name) + '</h3><div class="table-wrap"><table><thead><tr>' +
    '<th>Joueur</th><th class="num">Min</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Pd</th><th class="num">Tirs</th><th class="num">3pts</th><th class="num">LF</th><th class="num">+/-</th><th class="num">Note</th></tr></thead><tbody>' +
    rows.map(function (id) {
      var b = box[id], p = g.players[id];
      return '<tr class="click" data-act="player" data-id="' + id + '"><td>' + UI.esc(BM.shortName(p)) + '</td><td class="num">' + b.min + '</td><td class="num"><b>' + b.pts + '</b></td><td class="num">' + b.reb + '</td><td class="num">' + b.ast + '</td>' +
        '<td class="num">' + b.fgm + '/' + b.fga + '</td><td class="num">' + b.tpm + '/' + b.tpa + '</td><td class="num">' + b.ftm + '/' + b.fta + '</td>' +
        '<td class="num">' + (b.pm > 0 ? '+' : '') + b.pm + '</td><td class="num">' + (b.rtg ? b.rtg.toFixed(1) : '-') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
};

// ==================================================================== mercato
UI.MARKET_TABS = [['reco', 'Recrutement'], ['fa', 'Agents libres'], ['clubs', 'Joueurs NBA'], ['scouts', 'Scouts'], ['draft', 'Draft']];

// Note estimée (fourchette si le joueur est mal connu) et potentiel estimé.
UI.estBadge = function (p) {
  var g = UI.g, est = BM.scoutEstimate(g, p), lbl = BM.estLabel(est.ovr, est.errO);
  return '<span class="ovr' + (est.errO * 5 > 1 ? ' est' : '') + '" style="background:' + UI.ovrColor(Math.round(est.ovr * 5)) + '">' + lbl + '</span>';
};
UI.estPot = function (p) { var est = BM.scoutEstimate(UI.g, p); return BM.estLabel(est.pot, est.errP); };
UI.knowBar = function (p) { var k = Math.round(BM.knowledge(UI.g, p)); return '<span class="know" title="Connaissance ' + k + '%"><i style="width:' + k + '%"></i></span>'; };

UI.tab_market = function () {
  var g = UI.g, me = g.teams[g.userTeam];
  if (!UI.MARKET_TABS.some(function (t) { return t[0] === UI.sub.market; })) UI.sub.market = 'reco';
  var src = UI.sub.market;
  var head = '<div class="grid2">' +
    '<div class="kpi"><b>' + BM.money(me.balance) + '</b><span>Trésorerie (rachats)</span></div>' +
    '<div class="kpi"><b>' + BM.money(me.wageBudget - BM.payroll(g, me)) + '</b><span>Marge salariale</span></div></div>' +
    UI.subTabs('market', UI.MARKET_TABS);
  if (src === 'reco') return head + UI.market_reco();
  if (src === 'scouts') return head + UI.market_scouts();
  if (src === 'draft') return head + UI.market_draft();
  var list = src === 'fa' ? g.freeAgents.map(function (id) { return g.players[id]; }).filter(function (p) { return !p.prospect; })
    : Object.keys(g.players).map(function (id) { return g.players[id]; }).filter(function (p) {
      return p.teamId !== null && p.teamId !== g.userTeam;
    });
  if (UI.marketPos) list = list.filter(function (p) { return p.pos === UI.marketPos; });
  list.sort(function (a, b) { return BM.scoutEstimate(g, b).ovr - BM.scoutEstimate(g, a).ovr; });
  list = list.slice(0, 60);
  return head +
    '<div class="tabs">' + [['', 'Tous']].concat(BM.POSITIONS.map(function (p) { return [p, p]; })).map(function (p) {
      return '<button data-act="marketPos" data-v="' + p[0] + '" class="' + (UI.marketPos === p[0] ? 'on' : '') + '">' + p[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="card"><div class="table-wrap"><table><thead><tr><th>Pos</th><th>Nom</th><th class="num">Âge</th><th class="num">Note</th><th class="num">Pot.</th><th>Connu</th>' +
    (src === 'fa' ? '' : '<th class="hide-sm">Club</th><th class="num">Valeur</th>') + '<th class="num">Salaire</th></tr></thead><tbody>' +
    list.map(function (p) {
      return '<tr class="click" data-act="player" data-id="' + p.id + '"><td><span class="pos">' + p.pos + '</span></td><td>' + UI.esc(BM.shortName(p)) + UI.statusTags(p) + '</td>' +
        '<td class="num">' + p.age + '</td><td class="num">' + UI.estBadge(p) + '</td><td class="num muted">' + UI.estPot(p) + '</td><td>' + UI.knowBar(p) + '</td>' +
        (src === 'fa' ? '' : '<td class="hide-sm">' + g.teams[p.teamId].short + '</td><td class="num">' + BM.money(BM.playerValue(p)) + '</td>') +
        '<td class="num">' + BM.money(src === 'fa' ? BM.askingSalary(p) : p.contract.salary) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (list.length ? '' : '<p class="muted">Aucun joueur.</p>') +
    '<p class="hint" style="margin:10px 0 0">Les notes en fourchette viennent de vos scouts : plus un joueur est observé, plus l\'estimation est précise.</p></div>';
};

UI.market_reco = function () {
  var g = UI.g, me = g.teams[g.userTeam], needs = BM.teamNeeds(g, me), targets = BM.assistantTargets(g, 10);
  var a = BM.staffOf(g, 'assistant')[0];
  return '<div class="card hero-card"><div class="card-h"><h2>Besoins de l\'équipe</h2><span class="small muted">' + (a ? UI.esc(a.name) + ', assistant' : 'Pas d\'assistant') + '</span></div>' +
    (needs.length ? needs.map(function (n) { return '<div class="rec"><div><b>' + BM.POS_LABEL[n.pos] + (n.role ? ' · ' + UI.esc(BM.ROLES[n.role].l) : '') + '</b><p>' + UI.esc(n.why) + '</p></div><span class="tag ' + (n.w >= 2 ? 'bad' : 'warn') + '">' + (n.w >= 2 ? 'Prioritaire' : 'Utile') + '</span></div>'; }).join('')
      : '<p class="muted small" style="margin:0">Effectif équilibré : aucun manque majeur.</p>') + '</div>' +
    '<div class="card"><div class="card-h"><h2>L\'assistant recommande</h2></div>' + targets.map(function (x) {
      var p = x.p, where = p.teamId === null ? 'Agent libre' : g.teams[p.teamId].short + (p.listed ? ' · transférable' : '');
      return '<div class="rec click" data-act="player" data-id="' + p.id + '" style="cursor:pointer"><div><b><span class="pos">' + p.pos + '</span> ' + UI.esc(BM.shortName(p)) + '</b> <span class="muted small">' + p.age + ' ans · ' + UI.esc(where) + '</span>' +
        '<p><span class="tag ' + (x.access === 'Signable' ? 'good' : x.access === 'Échange' ? '' : 'warn') + '">' + x.access + '</span> ' + (x.need ? UI.esc(x.need.why) : 'Renfort de qualité') +
        ' · +' + Math.round(x.gain * 5) + ' sur le poste · ' + BM.money(p.teamId === null ? BM.askingSalary(p) : p.contract.salary) + '/an</p></div>' +
        '<span style="text-align:right">' + UI.estBadge(p) + '<br>' + UI.knowBar(p) + '</span></div>';
    }).join('') + '</div>';
};

UI.market_scouts = function () {
  var g = UI.g, scouts = BM.staffOf(g, 'scout');
  return '<div class="card"><div class="card-h"><h2>Missions des scouts</h2><span class="small muted">' + scouts.length + '/' + BM.SCOUT_MAX + '</span></div>' +
    (scouts.length ? scouts.map(function (s) {
      var a = g.assignments[s.id] || { type: '' };
      return '<div class="role-row"><div><b>' + UI.esc(s.name) + '</b><div class="small muted">Niveau ' + s.skills.judgeA + ' · potentiel ' + s.skills.judgeP + '</div></div>' +
        '<select data-change="assign" data-id="' + s.id + '"><option value="">Aucune mission</option>' + Object.keys(BM.ASSIGNMENTS).map(function (k) {
          return '<option value="' + k + '"' + (a.type === k ? ' selected' : '') + '>' + BM.ASSIGNMENTS[k] + '</option>';
        }).join('') + '</select></div>';
    }).join('') : '<p class="muted small" style="margin:0">Aucun scout : engagez-en dans l\'onglet Club.</p>') + '</div>' +
    '<div class="card"><div class="card-h"><h2>Derniers rapports</h2></div>' + ((g.reports || []).slice(0, 15).map(function (r) {
      var p = g.players[r.pid];
      if (!p) return '';
      return '<div class="rec click" data-act="player" data-id="' + p.id + '" style="cursor:pointer"><div><b><span class="pos">' + p.pos + '</span> ' + UI.esc(BM.fullName(p)) + '</b><p>' +
        UI.esc(r.scout) + ' · ' + UI.esc(BM.dateLabel(g, r.day)) + (p.prospect ? ' · ' + UI.esc(p.college) : '') + '</p></div>' +
        '<span class="grade g' + r.grade + '">' + r.grade + '</span></div>';
    }).join('') || '<p class="muted small" style="margin:0">Pas encore de rapport : les scouts publient quand ils connaissent un joueur à 70 %.</p>') + '</div>';
};

UI.market_draft = function () {
  var g = UI.g, board = (g.draftClass || []).map(function (id) { return g.players[id]; })
    .sort(function (a, b) { return BM.scoutEstimate(g, b).pot - BM.scoutEstimate(g, a).pot; });
  return '<div class="card"><div class="card-h"><h2>Big board · draft ' + (2026 + g.season) + '</h2><span class="small muted">' + board.length + ' prospects</span></div>' +
    '<p class="hint" style="margin:0 0 8px">Classement selon les estimations de vos scouts (mission « Prospects de la draft »). La draft a lieu après les finales.</p>' +
    '<div class="table-wrap"><table><thead><tr><th>#</th><th>Pos</th><th>Prospect</th><th class="num">Âge</th><th class="num">Note</th><th class="num">Pot.</th><th>Connu</th></tr></thead><tbody>' +
    board.slice(0, 40).map(function (p, i) {
      return '<tr class="click" data-act="player" data-id="' + p.id + '"><td>' + (i + 1) + '</td><td><span class="pos">' + p.pos + '</span></td><td>' + UI.esc(BM.shortName(p)) +
        '<div class="small muted">' + UI.esc(p.college) + '</div></td><td class="num">' + p.age + '</td><td class="num">' + UI.estBadge(p) + '</td><td class="num">' + UI.estPot(p) + '</td><td>' + UI.knowBar(p) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
};

UI.changes.assign = function (el) {
  var g = UI.g;
  if (el.value) g.assignments[+el.dataset.id] = { type: el.value }; else delete g.assignments[+el.dataset.id];
  UI.toast(el.value ? 'Mission : ' + BM.ASSIGNMENTS[el.value] + '.' : 'Mission retirée.');
  UI.save();
};

// ==================================================================== salle de draft
UI.showDraft = function () {
  var g = UI.g;
  if (!g.draft) BM.startDraft(g);
  var userTurn = BM.draftAdvance(g);
  UI.save();
  if (!userTurn) {
    BM.finishDraft(g);
    UI.save();
    UI.modalLocked = false;
    UI.closeModal();
    UI.toast('Draft terminée.');
    UI.cont(false);
    return;
  }
  var d = g.draft, slot = d.order[d.next];
  var board = g.draftClass.map(function (id) { return g.players[id]; }).sort(function (a, b) { return BM.scoutEstimate(g, b).pot - BM.scoutEstimate(g, a).pot; });
  var recent = d.picks.slice(-6).reverse();
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>Draft · choix n°' + slot.pick + '</h2><span class="tag good">À vous</span></div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Derniers choix</h3>' + (recent.length ? recent.map(function (x) {
      var p = g.players[x.pid];
      return '<div class="attr"><span>n°' + x.pick + ' ' + UI.esc(g.teams[x.team].short) + '</span><span>' + UI.esc(BM.shortName(p)) + ' <span class="muted small">' + p.pos + '</span></span></div>';
    }).join('') : '<p class="muted small" style="margin:0">Vous ouvrez la draft.</p>') + '</div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Votre big board</h3>' + board.slice(0, 15).map(function (p, i) {
      return '<div class="rec"><div><b>' + (i + 1) + '. <span class="pos">' + p.pos + '</span> ' + UI.esc(BM.fullName(p)) + '</b><p>' + p.age + ' ans · ' + UI.esc(p.college) +
        ' · note ' + BM.estLabel(BM.scoutEstimate(g, p).ovr, BM.scoutEstimate(g, p).errO) + ' · pot. ' + UI.estPot(p) + '</p></div>' +
        '<button class="btn sm primary" data-act="draftPick" data-id="' + p.id + '">Drafter</button></div>';
    }).join('') + '</div>');
};

UI.actions.draftPick = function (el) {
  var g = UI.g, p = g.players[+el.dataset.id];
  BM.draftPlayer(g, p.id);
  BM.Juice.sound('cheer'); BM.Juice.haptic('heavy');
  UI.toast(BM.fullName(p) + ' rejoint ' + g.teams[g.userTeam].name + ' !');
  UI.showDraft();
};

UI.actions.marketPos = function (el) { UI.marketPos = el.dataset.v; UI.render(); };

// ==================================================================== club
UI.tab_club = function () {
  var g = UI.g, me = g.teams[g.userTeam], payroll = BM.payroll(g, me);
  var theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  return '<div class="card"><div class="card-h"><h2>' + UI.esc(me.name) + '</h2>' + UI.teamBadge(me) + '</div>' +
    '<div class="grid2">' +
    '<div class="kpi"><b>' + me.rep + '</b><span>Réputation</span></div>' +
    '<div class="kpi"><b>' + me.titles + '</b><span>Titre(s)</span></div>' +
    '<div class="kpi"><b>' + BM.money(me.balance) + '</b><span>Trésorerie / budget transferts</span></div>' +
    '<div class="kpi"><b>' + BM.money(payroll) + '</b><span>Masse salariale (plafond ' + BM.money(me.wageBudget) + ')</span>' + UI.bar(100 - payroll / me.wageBudget * 100 + 50) + '</div>' +
    '</div></div>' +
    UI.staffCard() +
    '<div class="card"><h2 style="margin-bottom:8px">Direction</h2>' +
    '<p style="margin:0 0 6px">Objectif : <b>' + BM.OBJECTIVES[g.objective] + '</b></p>' +
    '<p class="small muted" style="margin:0 0 6px">Confiance : ' + g.board.confidence + '%</p>' + UI.bar(g.board.confidence) +
    '<p class="small muted" style="margin:8px 0 0">En dessous de 12 %, vous êtes licencié. Chaque victoire, en particulier contre un club mieux classé, renforce votre position.</p></div>' +
    '<div class="card" style="display:grid;gap:10px"><h2>Partie</h2>' +
    '<p class="small muted" style="margin:0">Coach : ' + UI.esc(g.managerName) + ' · sauvegarde automatique chaque jour.</p>' +
    '<div class="btn-row"><button class="btn" data-act="saveNow">Sauvegarder</button><button class="btn" data-act="exportSave">Exporter (.json)</button>' +
    '<button class="btn" data-act="theme">Thème : ' + (theme === 'light' ? 'clair' : 'arena') + '</button>' +
    '<button class="btn" data-act="sound">Son : ' + (BM.Juice.isOn() ? 'activé' : 'coupé') + '</button></div>' +
    '<button class="btn danger" data-act="quitAsk">Quitter vers le menu</button></div>' +
    '<p class="small muted" style="text-align:center">Hoops Manager 26 · jeu original inspiré de la boucle de jeu des simulateurs de management.</p>';
};

UI.actions.saveNow = function () { UI.save(); UI.toast('Partie sauvegardée.'); };

UI.actions.exportSave = function () {
  var blob = new Blob([BM.serialize(UI.g)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hoops-manager-s' + UI.g.season + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
};

UI.actions.theme = function () {
  var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  UI.store.set('hoops_theme', next);
  UI.render();
};

UI.actions.sound = function () {
  var on = BM.Juice.toggle();
  if (on) BM.Juice.sound('coin');
  UI.render();
};

UI.actions.quitAsk = function () {
  UI.modal('<div class="modal-h"><h2>Quitter la partie ?</h2></div><p>La partie est sauvegardée localement ; vous pourrez la reprendre depuis le menu.</p>' +
    '<div class="btn-row"><button class="btn primary" data-act="quit">Quitter</button><button class="btn" data-act="closeModal">Annuler</button></div>');
};
UI.actions.quit = function () { UI.save(); UI.g = null; UI.closeModal(); UI.render(); };

// ==================================================================== modale
UI.modal = function (html) {
  var root = document.getElementById('modal-root');
  var already = !!root.querySelector('.modal');
  root.innerHTML = '<div class="modal-bg" data-act="bgClose"' + (already ? ' style="animation:none"' : '') + '><div class="modal" role="dialog" aria-modal="true"' +
    (already ? ' style="animation:none"' : '') + '>' + html + '</div></div>';
  if (!already && BM.Juice) BM.Juice.sound('open');
  if (BM.Juice) BM.Juice.countUp(root);
};
UI.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };
UI.actions.closeModal = function () { UI.closeModal(); };
UI.actions.bgClose = function (el, ev) { if (ev.target === el && !UI.modalLocked) UI.closeModal(); };

// ==================================================================== navigation
UI.actions.tab = function (el) {
  if (UI.tab !== el.dataset.tab && BM.Juice) { BM.Juice.sound('nav'); BM.Juice.haptic('light'); }
  UI.tab = el.dataset.tab; UI.render(); window.scrollTo(0, 0);
};
UI.actions.subtab = function (el) { UI.sub[el.dataset.key] = el.dataset.v; UI.render(); };

// ==================================================================== pôle développement
UI.squad_dev = function () {
  var g = UI.g, me = g.teams[g.userTeam], roster = BM.roster(g, me);
  var recs = BM.devRecommendations(g, me);
  UI._recs = recs;
  var prog = roster.map(function (p) { return { p: p, d: BM.ovr(p) - Math.round((p.seasonStartOvr || BM.ovrRaw(p)) * 5) }; })
    .sort(function (a, b) { return b.d - a.d; });
  var opt = function (list, sel) { return list.map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + UI.esc(BM.shortName(p)) + ' (' + p.age + ' ans)</option>'; }).join(''); };
  var vets = roster.filter(function (p) { return p.age >= 26; }).sort(function (a, b) { return b.attrs.lead - a.attrs.lead; });
  var youngs = roster.filter(function (p) { return p.age <= 24; }).sort(function (a, b) { return b.pot - a.pot; });
  return '<div class="card"><div class="card-h"><h2>Recommandations du staff</h2><span class="small muted">' + recs.length + '</span></div>' +
    (recs.length ? recs.map(function (r, i) {
      return '<div class="rec"><div><b>' + UI.esc(r.t) + '</b><p>' + UI.esc(r.why) + '</p></div>' +
        (r.act === 'extend' ? '<button class="btn sm" data-act="extendForm" data-id="' + r.id + '">Ouvrir</button>' : '<button class="btn sm primary" data-act="applyRec" data-i="' + i + '">Appliquer</button>') + '</div>';
    }).join('') : '<p class="muted small" style="margin:0">Rien à signaler : le staff est satisfait.</p>') + '</div>' +
    '<div class="card"><div class="card-h"><h2>Progression de la saison</h2></div>' + prog.slice(0, 8).map(function (x) {
      return '<div class="attr click" data-act="player" data-id="' + x.p.id + '" style="cursor:pointer"><span><span class="pos">' + x.p.pos + '</span> ' + UI.esc(BM.shortName(x.p)) +
        (x.p.retrain ? ' <span class="tag warn">→ ' + x.p.retrain.to + ' ' + Math.round(x.p.retrain.progress) + '%</span>' : '') + '</span>' +
        '<b class="' + (x.d > 0 ? 'a-hi' : x.d < 0 ? 'a-lo' : 'a-mid') + '">' + (x.d > 0 ? '+' : '') + x.d + '</b></div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-h"><h2>Mentorat</h2><span class="small muted">' + (me.mentoring || []).length + '/3</span></div>' +
    ((me.mentoring || []).map(function (x, i) {
      var m = g.players[x.mentor], pu = g.players[x.pupil];
      return '<div class="rec"><div><b>' + UI.esc(BM.shortName(m)) + ' → ' + UI.esc(BM.shortName(pu)) + '</b><p>Leadership ' + m.attrs.lead + ' · depuis ' + (g.day - x.since) + ' j</p></div>' +
        '<button class="btn sm danger" data-act="endMentor" data-i="' + i + '">Arrêter</button></div>';
    }).join('') || '<p class="muted small" style="margin:0 0 8px">Aucun binôme. Un vétéran leader transmet QI, sang-froid, activité et leadership à un jeune.</p>') +
    ((me.mentoring || []).length < 3 ? '<div class="grid2" style="margin-top:8px"><select id="mt-m" class="sel">' + opt(vets) + '</select><select id="mt-p" class="sel">' + opt(youngs) + '</select></div>' +
      '<button class="btn block" style="margin-top:8px" data-act="addMentor">Créer le binôme</button>' : '') + '</div>' +
    '<div class="card"><div class="card-h"><h2>G League</h2><span class="small muted">' + roster.filter(function (p) { return p.gleague; }).length + '/' + BM.GLEAGUE_MAX + '</span></div>' +
    (roster.filter(function (p) { return p.gleague; }).map(function (p) {
      var gl = p.gl || { gp: 0, pts: 0, reb: 0, ast: 0 };
      return '<div class="rec"><div><b>' + UI.esc(BM.shortName(p)) + '</b><p>' + gl.gp + ' m · ' + (gl.gp ? (gl.pts / gl.gp).toFixed(1) : '-') + ' pts · ' + (gl.gp ? (gl.reb / gl.gp).toFixed(1) : '-') + ' reb</p></div>' +
        '<button class="btn sm" data-act="toggleGL" data-id="' + p.id + '">Rappeler</button></div>';
    }).join('') || '<p class="muted small" style="margin:0">Envoyez les jeunes sans temps de jeu en G League : progression ×1,6.</p>') + '</div>';
};

UI.devCard = function (p) {
  var g = UI.g, me = g.teams[g.userTeam], rep = BM.coachReport(g, me, p);
  var mentor = (me.mentoring || []).find(function (x) { return x.pupil === p.id; });
  return '<div class="card"><div class="card-h"><h3>Rapport du staff</h3><span class="tag">' + UI.esc(rep.potential) + '</span></div>' +
    '<div class="grid2"><div><p class="small muted" style="margin:0 0 4px">Points forts</p>' + rep.strengths.map(function (x) { return '<div class="attr"><span>' + x.l + '</span><b class="a-hi">' + x.v + '</b></div>'; }).join('') + '</div>' +
    '<div><p class="small muted" style="margin:0 0 4px">À travailler</p>' + rep.weaknesses.map(function (x) { return '<div class="attr"><span>' + x.l + '</span><b class="a-lo">' + x.v + '</b></div>'; }).join('') + '</div></div>' +
    '<p class="small" style="margin:8px 0 0">Rôle conseillé : <b>' + UI.esc(BM.ROLES[rep.role].l) + '</b> · Progression cette saison : <b>' + (rep.delta > 0 ? '+' : '') + rep.delta + '</b>' +
    (mentor ? ' · Mentor : <b>' + UI.esc(BM.shortName(g.players[mentor.mentor])) + '</b>' : '') + '</p>' +
    '<div class="field" style="margin-top:10px"><label>Focus individuel</label><select data-change="devFocus" data-id="' + p.id + '" class="sel">' + Object.keys(BM.DEV_FOCUS).map(function (k) {
      return '<option value="' + k + '"' + ((p.devFocus || 'auto') === k ? ' selected' : '') + '>' + UI.esc(BM.DEV_FOCUS[k].l) + (k === rep.focus ? ' (conseillé)' : '') + '</option>';
    }).join('') + '</select></div>' +
    '<div class="field" style="margin-top:8px"><label>Repositionnement</label><select data-change="retrain" data-id="' + p.id + '" class="sel"><option value="">' +
    (p.retrain ? 'En cours → ' + BM.POS_LABEL[p.retrain.to] + ' (' + Math.round(p.retrain.progress) + '%) — arrêter' : 'Garder le poste actuel') + '</option>' +
    BM.adjacentPositions(p.pos).map(function (pos) {
      var d = Math.round((BM.ovrRaw(p, pos) - BM.ovrRaw(p)) * 5);
      return '<option value="' + pos + '"' + (p.retrain && p.retrain.to === pos ? ' selected' : '') + '>' + BM.POS_LABEL[pos] + ' (' + (d >= 0 ? '+' : '') + d + ')</option>';
    }).join('') + '</select></div>' +
    '<button class="btn block" style="margin-top:8px" data-act="toggleGL" data-id="' + p.id + '">' + (p.gleague ? 'Rappeler de G League' : 'Envoyer en G League') + '</button></div>';
};

UI.actions.applyRec = function (el) {
  var r = UI._recs && UI._recs[+el.dataset.i];
  if (!r) return;
  UI.toast(BM.applyRecommendation(UI.g, UI.g.teams[UI.g.userTeam], r));
  UI.save(); UI.render();
};
UI.actions.toggleGL = function (el) {
  var g = UI.g, p = g.players[+el.dataset.id];
  UI.toast(BM.toggleGLeague(g, g.teams[g.userTeam], p));
  UI.save(); UI.render();
  if (document.querySelector('.modal')) UI.showPlayer(p.id);
};
UI.actions.addMentor = function () {
  var g = UI.g, m = +document.getElementById('mt-m').value, pu = +document.getElementById('mt-p').value;
  UI.toast(BM.addMentoring(g, g.teams[g.userTeam], m, pu));
  UI.save(); UI.render();
};
UI.actions.endMentor = function (el) {
  var me = UI.g.teams[UI.g.userTeam];
  me.mentoring.splice(+el.dataset.i, 1);
  UI.save(); UI.render();
};
UI.changes.devFocus = function (el) {
  var p = UI.g.players[+el.dataset.id];
  p.devFocus = el.value;
  UI.toast('Focus : ' + BM.DEV_FOCUS[el.value].l + '.');
  UI.save();
};
UI.changes.retrain = function (el) {
  var p = UI.g.players[+el.dataset.id];
  p.retrain = el.value ? { to: el.value, progress: p.retrain && p.retrain.to === el.value ? p.retrain.progress : 0 } : null;
  UI.toast(el.value ? 'Repositionnement vers ' + BM.POS_LABEL[el.value].toLowerCase() + ' lancé (~3 mois).' : 'Repositionnement arrêté.');
  UI.save(); UI.showPlayer(p.id);
};

UI.actions.scoutPlayer = function (el) {
  var g = UI.g, p = g.players[+el.dataset.id], scouts = BM.staffOf(g, 'scout');
  if (!scouts.length) { UI.toast('Aucun scout dans le staff.'); return; }
  var s = scouts.sort(function (a, b) { return (b.skills.judgeA + b.skills.judgeP) - (a.skills.judgeA + a.skills.judgeP); })[0];
  var k = BM.addKnowledge(g, p, 18 + s.skills.judgeA);
  if (k.before < 70 && k.after >= 70) BM.scoutReport(g, p, s);
  UI.toast(s.name + ' a observé ' + BM.shortName(p) + ' : connu à ' + Math.round(k.after) + '%.');
  UI.save(); UI.showPlayer(p.id);
};

// ==================================================================== staff
UI.staffCard = function () {
  var g = UI.g;
  return '<div class="card"><div class="card-h"><h2>Staff</h2><span class="small muted">' + BM.money(BM.staffPayroll(g)) + '/an</span></div>' +
    (g.staff || []).map(function (s) {
      var sk = BM.STAFF_ROLES[s.role].skills;
      return '<div class="rec"><div><b>' + UI.esc(s.name) + '</b> <span class="tag">' + BM.STAFF_ROLES[s.role].l + '</span><p>' +
        Object.keys(sk).map(function (k) { return sk[k] + ' ' + s.skills[k]; }).join(' · ') + ' · ' + BM.money(s.salary) + '</p></div>' +
        '<button class="btn sm danger" data-act="fireStaff" data-id="' + s.id + '">Libérer</button></div>';
    }).join('') +
    '<p class="hint" style="margin:8px 0">Assistant : développement des joueurs et familiarité tactique. Scouts : précision et vitesse du recrutement. Kiné : moins de blessures.</p>' +
    '<button class="btn block" data-act="staffMarket">Recruter du staff</button></div>';
};

UI.actions.staffMarket = function () {
  var g = UI.g;
  UI.modal('<div class="modal-h"><h2>Recruter du staff</h2><button class="btn sm x" data-act="closeModal">Fermer</button></div>' +
    g.staffPool.map(function (s) {
      var sk = BM.STAFF_ROLES[s.role].skills;
      return '<div class="rec"><div><b>' + UI.esc(s.name) + '</b> <span class="tag">' + BM.STAFF_ROLES[s.role].l + '</span><p>' +
        Object.keys(sk).map(function (k) { return sk[k] + ' <b>' + s.skills[k] + '</b>'; }).join(' · ') + ' · ' + BM.money(s.salary) + '/an</p></div>' +
        '<button class="btn sm primary" data-act="hireStaff" data-id="' + s.id + '">Engager</button></div>';
    }).join(''));
};
UI.actions.hireStaff = function (el) { UI.toast(BM.hireStaff(UI.g, +el.dataset.id)); UI.save(); UI.closeModal(); UI.render(); };
UI.actions.fireStaff = function (el) { UI.toast(BM.fireStaff(UI.g, +el.dataset.id)); UI.save(); UI.render(); };
