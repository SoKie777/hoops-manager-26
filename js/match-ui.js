var BM = globalThis.BM = globalThis.BM || {};
var UI = BM.UI;

// ==================================================================== graphiques analytiques (Shot Chart & Game Flow)
UI.quarterTable = function (qPts, home, away, hs, as) {
  if (!qPts || !qPts.length) return '';
  var hdr = qPts.map(function (_, i) { return '<th>' + (i < 4 ? 'Q' + (i + 1) : 'P' + (i - 3)) + '</th>'; }).join('');
  var row = function (t, side, tot) {
    return '<tr><td style="text-align:left;font-weight:700">' + UI.teamBadge(t) + UI.esc(t.short) + '</td>' +
      qPts.map(function (q) { return '<td class="num">' + q[side] + '</td>'; }).join('') +
      '<td class="num" style="font-weight:800;color:var(--accent)">' + tot + '</td></tr>';
  };
  return '<table class="tbl q-tbl" style="margin-top:8px"><thead><tr><th style="text-align:left">Équipe</th>' + hdr + '<th>TOT</th></tr></thead>' +
    '<tbody>' + row(home, 0, hs) + row(away, 1, as) + '</tbody></table>';
};

// Carte des tirs SVG sur demi-terrain (coordonnées moteur : x dans [52..93], y dans [2..48], panier à x=88.75, y=25).
UI.shotChartSvg = function (shots, home, away, filterSide) {
  shots = (shots || []).filter(function (s) { return filterSide === undefined || filterSide === null || s.s === filterSide; });
  // Transformation demi-terrain -> SVG (largeur 250 = y terrain [0..50] * 5, hauteur 210 = profondeur depuis médiane [50..94] * 4.77)
  var sx = function (sh) { return BM.clamp(sh.y * 5, 8, 242).toFixed(1); };
  var sy = function (sh) { return BM.clamp((94 - sh.x) * 4.65 + 6, 10, 202).toFixed(1); };
  var zones = { rim: [0, 0], mid: [0, 0], three: [0, 0] };
  var dots = shots.map(function (sh) {
    var z = zones[sh.t] || zones.mid;
    z[1]++; if (sh.m) z[0]++;
    var col = sh.s === 0 ? home.color : away.color;
    var x = sx(sh), y = sy(sh);
    if (sh.m) {
      return '<circle cx="' + x + '" cy="' + y + '" r="4.2" fill="' + col + '" fill-opacity="0.88" stroke="#fff" stroke-width="1"/>';
    }
    return '<g transform="translate(' + x + ',' + y + ')" stroke="' + col + '" stroke-width="1.5" opacity="0.65">' +
      '<line x1="-3.2" y1="-3.2" x2="3.2" y2="3.2"/><line x1="3.2" y1="-3.2" x2="-3.2" y2="3.2"/></g>';
  }).join('');

  var zPct = function (k, lbl) {
    var m = zones[k][0], a = zones[k][1], p = a ? Math.round(m / a * 100) : 0;
    return '<div class="sc-zone"><span class="muted small">' + lbl + '</span><b>' + m + '/' + a + '</b><span class="tag ' + (p >= 45 ? 'good' : p <= 30 && a > 2 ? 'bad' : '') + '">' + p + '%</span></div>';
  };

  return '<div class="shotchart-box">' +
    '<svg viewBox="0 0 250 210" class="shotchart-svg" aria-label="Carte des tirs">' +
    '<defs><linearGradient id="scFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e2638"/><stop offset="100%" stop-color="#121826"/></linearGradient></defs>' +
    '<rect x="2" y="2" width="246" height="206" rx="10" fill="url(#scFloor)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>' +
    // Raquette (16 pieds de large -> 80px, 19 pieds de profond -> 88px)
    '<rect x="85" y="6" width="80" height="88" fill="rgba(255,122,26,0.08)" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/>' +
    '<circle cx="125" cy="94" r="30" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/>' +
    // Ligne à 3 points (corners y=3->15px et y=47->235px, arc rayon 23.75 pieds -> 114px autour du panier (125, 30.4))
    '<path d="M 15 6 L 15 71 A 114 114 0 0 0 235 71 L 235 6" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.4"/>' +
    // Zone de non-charge, planche et anneau
    '<path d="M 105 30.4 A 20 20 0 0 0 145 30.4" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.1"/>' +
    '<line x1="110" y1="24" x2="140" y2="24" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="125" cy="30.4" r="4.8" fill="none" stroke="#ff7a1a" stroke-width="1.8"/>' +
    dots +
    '</svg>' +
    '<div class="sc-legend">' +
    '<span><i class="dot" style="background:' + home.color + '"></i>' + UI.esc(home.short) + '</span>' +
    '<span><i class="dot" style="background:' + away.color + '"></i>' + UI.esc(away.short) + '</span>' +
    '<span class="muted">● Réussi · × Raté</span>' +
    '</div>' +
    '<div class="sc-zones">' + zPct('rim', 'Raquette') + zPct('mid', 'Mi-distance') + zPct('three', '3 Points') + '</div>' +
    '</div>';
};

// Courbe d'évolution de l'écart (Game Flow) sur 48 minutes.
UI.gameFlowSvg = function (flow, home, away, meta) {
  if (!flow || flow.length < 2) return '';
  var W = 320, H = 116, midY = H / 2;
  var maxT = Math.max(2880, flow[flow.length - 1].t || 2880);
  var maxDiff = 12;
  flow.forEach(function (pt) { var d = Math.abs(pt.s0 - pt.s1); if (d > maxDiff) maxDiff = d; });
  var xOf = function (t) { return (12 + (t / maxT) * (W - 24)).toFixed(1); };
  var yOf = function (diff) { return (midY - (diff / maxDiff) * (midY - 14)).toFixed(1); };

  var pts = flow.map(function (pt) { return xOf(pt.t) + ',' + yOf(pt.s0 - pt.s1); }).join(' ');
  var areaPts = xOf(0) + ',' + midY + ' ' + pts + ' ' + xOf(flow[flow.length - 1].t) + ',' + midY;

  var qLines = [720, 1440, 2160, 2880].map(function (sec, idx) {
    var qx = xOf(sec);
    return '<line x1="' + qx + '" y1="10" x2="' + qx + '" y2="' + (H - 14) + '" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2,2"/>' +
      '<text x="' + (qx - 18) + '" y="' + (H - 3) + '" fill="#8b95a7" font-size="8.5" font-weight="700">Q' + (idx + 1) + '</text>';
  }).join('');

  var bl = (meta && meta.biggestLead) || [0, 0];
  return '<div class="gameflow-box">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="gameflow-svg" aria-label="Évolution du score">' +
    '<defs>' +
    '<clipPath id="gfTop"><rect x="0" y="0" width="' + W + '" height="' + midY + '"/></clipPath>' +
    '<clipPath id="gfBot"><rect x="0" y="' + midY + '" width="' + W + '" height="' + midY + '"/></clipPath>' +
    '</defs>' +
    '<rect x="2" y="2" width="' + (W - 4) + '" height="' + (H - 4) + '" rx="8" fill="#121826" stroke="rgba(255,255,255,0.12)"/>' +
    qLines +
    '<line x1="12" y1="' + midY + '" x2="' + (W - 12) + '" y2="' + midY + '" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>' +
    '<polygon points="' + areaPts + '" fill="' + home.color + '" fill-opacity="0.32" clip-path="url(#gfTop)"/>' +
    '<polygon points="' + areaPts + '" fill="' + away.color + '" fill-opacity="0.32" clip-path="url(#gfBot)"/>' +
    '<polyline points="' + pts + '" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<text x="14" y="14" fill="' + home.color + '" font-size="9" font-weight="800">' + UI.esc(home.short) + ' +' + bl[0] + '</text>' +
    '<text x="14" y="' + (H - 16) + '" fill="' + away.color + '" font-size="9" font-weight="800">' + UI.esc(away.short) + ' +' + bl[1] + '</text>' +
    '</svg>' +
    (meta ? '<div class="gf-meta"><span class="tag">Changements de leader : <b>' + (meta.leadChanges || 0) + '</b></span><span class="tag">Égalités : <b>' + (meta.ties || 0) + '</b></span></div>' : '') +
    '</div>';
};

UI.matchAnalyticsCard = function (data, home, away) {
  if ((!data.shots || !data.shots.length) && (!data.flow || data.flow.length < 2)) return '';
  return '<div class="card"><h3>Analyse radar & télémétrie du match</h3>' +
    '<div class="analytics-grid">' +
    (data.shots && data.shots.length ? '<div><div class="small muted" style="margin-bottom:4px;font-weight:700">CARTE DES TIRS</div>' + UI.shotChartSvg(data.shots, home, away) + '</div>' : '') +
    (data.flow && data.flow.length >= 2 ? '<div><div class="small muted" style="margin-bottom:4px;font-weight:700">FLUX DU SCORE (GAME FLOW)</div>' + UI.gameFlowSvg(data.flow, home, away, data) + '</div>' : '') +
    '</div></div>';
};

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
  var oppStar = BM.availablePlayers(g, opp).sort(function (x, y) { return BM.ovrRaw(y) - BM.ovrRaw(x); })[0];
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>' + (fx.type === 'playoff' ? BM.ROUND_NAMES[fx.round] + ' · match ' + fx.game : 'Avant-match · Journée ' + fx.round) + '</h2></div>' +
    '<div class="card hero"><div class="vs"><div class="t">' + UI.teamBadge(h, true) + UI.esc(h.name) + '<span class="small muted">' + h.record.w + 'V-' + h.record.l + 'D · Note ' + avgOvr(h) + '</span></div>' +
    '<div class="mid">VS<br><span class="small muted">' + UI.esc(BM.dateLabel(g, fx.day)) + '</span></div>' +
    '<div class="t">' + UI.teamBadge(a, true) + UI.esc(a.name) + '<span class="small muted">' + a.record.w + 'V-' + a.record.l + 'D · Note ' + avgOvr(a) + '</span></div></div></div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Rapport du recruteur adverse</h3>' +
    '<p class="small" style="margin:0">' + UI.esc(opp.name) + ' (' + opp.record.w + 'V-' + opp.record.l + 'D, série ' + opp.record.streak + ') évolue sur un rythme <b>' + label('pace', opp.tactics.pace).toLowerCase() +
    '</b>, système <b>' + label('system', opp.tactics.system) + '</b> et défense <b>' + label('defense', opp.tactics.defense) + '</b>.' +
    (oppStar ? ' Menace n°1 : <b>' + UI.esc(BM.fullName(oppStar)) + '</b> (' + oppStar.pos + ', Note ' + BM.ovr(oppStar) + ').' : '') + '</p></div>' +
    '<div class="card"><h3 style="margin-bottom:6px">Votre cinq de départ</h3>' +
    (starters.length ? starters.map(function (p) {
      return '<div class="attr"><span><span class="pos">' + p.pos + '</span> ' + UI.esc(BM.shortName(p)) + '</span><span>' + UI.ovrBadge(BM.ovr(p)) + ' <span class="muted small">' + Math.round(p.condition) + '%</span></span></div>';
    }).join('') : '<p class="small muted" style="margin:0">Aucun titulaire défini : sélection automatique.</p>') +
    (tired.length ? '<p class="small" style="margin:8px 0 0;color:var(--warn)">Fatigués : ' + tired.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    (injured.length ? '<p class="small" style="margin:4px 0 0;color:var(--bad)">Blessés : ' + injured.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    '</div>' +
    '<button class="btn primary block" data-act="playLive">🏀 Jouer le match en direct</button>' +
    '<div class="btn-row"><button class="btn" style="flex:1" data-act="playQuick">⚡ Résultat instantané</button><button class="btn" style="flex:1" data-act="editTactics">📋 Modifier la tactique</button></div>');
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
  UI.live = { m: m, fx: UI.pendingFx, speed: 1, playing: true, timer: null, sel: null, panel: null, viewTab: 'feed' };
  UI.renderMatch();
  UI.schedule();
};

// ==================================================================== direct
// Durée d'une possession à l'écran (ms) selon la vitesse.
UI.SPEEDS = { 1: 2600, 2: 1300, 4: 480 };

UI.schedule = function (delay) {
  var L = UI.live;
  clearTimeout(L.timer);
  UI.flushPending();
  if (!L.playing || L.m.finished) return;
  L.timer = setTimeout(UI.tickMatch, delay === undefined ? 120 : delay);
};

// Joue une possession : la vue 2D l'anime, le score et le commentaire tombent quand le ballon arrive.
UI.tickMatch = function () {
  var L = UI.live;
  if (!L || !L.playing) return;
  var T = UI.SPEEDS[L.speed];
  var before = L.m.score.slice();
  var evs = L.m.step(), play = L.m.play;
  if (L.court) L.court.animate(play, T * 0.94);
  var impact = play && play.kind === 'shot' ? 0.8 : 0.55;
  L.pending = { evs: evs, before: before };
  L.timer = setTimeout(function () {
    UI.flushPending();
    if (L.m.finished) { L.timer = setTimeout(UI.finishMatch, 900); return; }
    if (L.m.halftimePending && L.m.career) { L.m.resumeAfterHalftime(); UI.toast('Mi-temps : ' + L.m.score[0] + '-' + L.m.score[1] + '. Retour au vestiaire, puis sur le parquet.'); }
    if (L.m.halftimePending) { L.playing = false; UI.renderControls(); UI.openPanel('talk'); return; }
    if (L.m.pendingMoment) { L.playing = false; UI.renderControls(); UI.openPanel('moment'); if (BM.Juice) { BM.Juice.sound('cheer'); BM.Juice.haptic('heavy'); } return; }
    if (L.panel === 'subs') UI.renderPanel();
    if (L.playing) L.timer = setTimeout(UI.tickMatch, T * (1 - impact));
  }, T * impact);
};

UI.flushPending = function () {
  var L = UI.live;
  if (!L || !L.pending) return;
  var p = L.pending;
  L.pending = null;
  UI.pushEvents(p.evs);
  var bump = [L.m.score[0] > p.before[0], L.m.score[1] > p.before[1]];
  UI.renderScore(bump);
  if (L.viewTab && L.viewTab !== 'feed') UI.renderLiveTab();
  if (p.evs.some(function (e) { return e.type === 'quarter'; })) { BM.Juice.sound('buzzer'); BM.Juice.haptic('medium'); }
  if (p.evs.some(function (e) { return e.type === 'momentum' || e.type === 'hot'; })) { BM.Juice.sound('cheer'); BM.Juice.haptic('medium'); }
  var u = L.m.user;
  if (u >= 0 && bump[u] && L.m.score[u] - p.before[u] >= 3) BM.Juice.haptic('light');
};

UI.clockLabel = function (q, clock) {
  var m = Math.floor(clock / 60), s = clock % 60;
  return (q > 4 ? 'P' + (q - 4) : 'Q' + q) + ' ' + m + ':' + (s < 10 ? '0' : '') + s;
};

UI.renderMatch = function () {
  var L = UI.live, m = L.m;
  L.viewTab = L.viewTab || 'feed';
  document.getElementById('modal-root').innerHTML =
    '<div class="match"><div class="inner">' +
    '<div class="scoreboard" id="m-score"></div>' +
    '<div class="court-wrap"><canvas id="m-court" aria-label="Vue 2D du terrain"></canvas></div>' +
    '<div class="live-right">' +
    '<div class="subtabs live-tabs" id="m-vtabs">' +
    '<button data-act="mViewTab" data-v="feed" class="' + (L.viewTab === 'feed' ? 'on' : '') + '">Direct</button>' +
    '<button data-act="mViewTab" data-v="on5" class="' + (L.viewTab === 'on5' ? 'on' : '') + '">5 sur le parquet</button>' +
    '<button data-act="mViewTab" data-v="chart" class="' + (L.viewTab === 'chart' ? 'on' : '') + '">Tirs & Flux</button>' +
    '</div>' +
    '<div class="feed" id="m-feed" style="' + (L.viewTab === 'feed' ? '' : 'display:none') + '"></div>' +
    '<div class="feed live-aux" id="m-aux" style="' + (L.viewTab === 'feed' ? 'display:none' : '') + '"></div>' +
    '</div>' +
    '<div class="controls" id="m-ctrl"></div>' +
    '</div><div id="m-panel"></div></div>';
  L.court = new BM.Court(document.getElementById('m-court'), m);
  UI.renderScore();
  UI.pushEvents(m.events);
  UI.renderLiveTab();
  UI.renderControls();
};

UI.actions.mViewTab = function (el) {
  var L = UI.live;
  if (!L) return;
  L.viewTab = el.dataset.v;
  var tabs = document.getElementById('m-vtabs');
  if (tabs) Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === L.viewTab); });
  var feed = document.getElementById('m-feed'), aux = document.getElementById('m-aux');
  if (feed && aux) {
    feed.style.display = L.viewTab === 'feed' ? '' : 'none';
    aux.style.display = L.viewTab === 'feed' ? 'none' : '';
  }
  UI.renderLiveTab();
};

UI.renderLiveTab = function () {
  var L = UI.live, aux = document.getElementById('m-aux');
  if (!L || !aux || L.viewTab === 'feed') return;
  var m = L.m, u = m.user >= 0 ? m.user : 0;
  if (L.viewTab === 'on5') {
    var fiveHtml = function (side) {
      var t = m.side[side];
      return '<div style="margin-bottom:8px"><div class="small muted" style="font-weight:700;margin-bottom:4px">' + UI.teamBadge(t) + UI.esc(t.name) + '</div>' +
        m.on[side].map(function (id) {
          var p = m.p(id), b = m.box[id], en = Math.round(m.en[id]);
          var hot = m.isHot(id) ? ' <span class="tag fire">🔥</span>' : '';
          var fl = b.pf >= 4 ? ' <span class="tag bad">' + b.pf + 'F</span>' : b.pf === 3 ? ' <span class="tag warn">3F</span>' : '';
          return '<div class="live-p-row"><span class="pos">' + p.pos + '</span>' +
            '<span class="nm">' + UI.esc(BM.shortName(p)) + hot + fl + '</span>' +
            '<span class="num small">' + b.pts + 'p · ' + (b.oreb + b.dreb) + 'r · ' + b.ast + 'a</span>' +
            UI.bar(en) + '</div>';
        }).join('') + '</div>';
    };
    aux.innerHTML = fiveHtml(u) + fiveHtml(1 - u);
  } else if (L.viewTab === 'chart') {
    aux.innerHTML = UI.shotChartSvg(m.shots, m.side[0], m.side[1]) +
      UI.gameFlowSvg(m.flow, m.side[0], m.side[1], { biggestLead: m.biggestLead, leadChanges: m.leadChanges, ties: m.ties });
  }
};

UI.renderScore = function (bump) {
  var m = UI.live.m, t = m.side;
  var el = document.getElementById('m-score');
  if (!el) return;
  var sc = function (i) { return '<i' + (bump && bump[i] ? ' class="bump"' : '') + '>' + m.score[i] + '</i>'; };
  var toDots = function (i) {
    var n = m.timeouts[i], dots = '';
    for (var k = 0; k < 4; k++) dots += '<span class="to-pip' + (k < n ? ' on' : '') + '"></span>';
    return '<span class="to-pips" title="Temps morts restants : ' + n + '">' + dots + '</span>';
  };
  var bonusTag = function (i) {
    return m.teamFouls[i] >= 4 ? ' <span class="bonus-pill">BONUS</span>' : '';
  };
  var qStrip = '';
  if (m.quarterBreakdown) {
    var qb = m.quarterBreakdown();
    qStrip = '<div class="q-strip">' + qb.map(function (q, idx) {
      return '<span><b>' + (idx < 4 ? 'Q' + (idx + 1) : 'P' + (idx - 3)) + '</b> ' + q[0] + '-' + q[1] + '</span>';
    }).join('') + '</div>';
  }
  el.innerHTML = '<div class="sb">' +
    '<div class="t">' + UI.teamBadge(t[0], true) + '<div class="t-meta"><span>' + UI.esc(t[0].short) + bonusTag(1) + '</span>' + toDots(0) + '</div></div>' +
    '<div class="sb-center"><div class="score">' + sc(0) + ' <span class="sep">–</span> ' + sc(1) + '</div>' +
    '<div class="clock">' + (m.finished ? '<b>TERMINÉ</b>' : '<b>' + UI.clockLabel(m.q, Math.max(0, Math.round(m.clock))) + '</b>') +
    ' · Fautes ' + m.teamFouls[0] + '–' + m.teamFouls[1] + '</div>' + qStrip + '</div>' +
    '<div class="t away"><div class="t-meta" style="align-items:flex-end"><span>' + bonusTag(0) + UI.esc(t[1].short) + '</span>' + toDots(1) + '</div>' + UI.teamBadge(t[1], true) + '</div></div>' +
    UI.momentumBar(m);
};

// Jauge de momentum : chaque équipe pousse depuis son côté, éclat quand elle dépasse 80.
UI.momentumBar = function (m) {
  var a = m.mom[0], b = m.mom[1], tot = Math.max(1, a + b), share = a / tot * 100;
  var glow = function (v) { return v >= 80 ? ' hot' : ''; };
  return '<div class="mom" title="Momentum"><span class="mom-l' + glow(a) + '" style="width:' + share.toFixed(1) + '%;background:' + m.side[0].color + '"></span>' +
    '<span class="mom-r' + glow(b) + '" style="width:' + (100 - share).toFixed(1) + '%;background:' + m.side[1].color + '"></span>' +
    '<em>MOMENTUM</em></div>';
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
  if (m.career) {
    // Mode carrière : pas de consignes de coach, mais ta mentalité sur le terrain.
    el.innerHTML = '<div class="btn-row" style="flex-wrap:nowrap">' +
      '<button class="btn" data-act="mPlay" style="flex:none;width:84px">' + (L.playing ? '⏸ Pause' : '▶ Jouer') + '</button>' +
      '<div class="seg" style="flex:1">' + [1, 2, 4].map(function (s) { return '<button data-act="mSpeed" data-v="' + s + '" class="' + (L.speed === s ? 'on' : '') + '">x' + s + '</button>'; }).join('') + '</div>' +
      '<button class="btn" data-act="mSimEnd" title="Simuler la fin du match" style="flex:none;width:44px">⏭</button></div>' +
      '<div class="seg cment">' + Object.keys(BM.CAREER_MENT).map(function (k) {
        return '<button data-act="mCMent" data-v="' + k + '" class="' + (m.career.ment === k ? 'on' : '') + '">' + BM.CAREER_MENT[k].l + '</button>';
      }).join('') + '</div>';
    return;
  }
  el.innerHTML = '<div class="btn-row" style="flex-wrap:nowrap">' +
    '<button class="btn" data-act="mPlay" style="flex:none;width:84px">' + (L.playing ? '⏸ Pause' : '▶ Jouer') + '</button>' +
    '<div class="seg" style="flex:1">' + [1, 2, 4].map(function (s) {
      return '<button data-act="mSpeed" data-v="' + s + '" class="' + (L.speed === s ? 'on' : '') + '">x' + s + '</button>';
    }).join('') + '</div>' +
    '<button class="btn" data-act="mSimEnd" title="Simuler la fin du match" style="flex:none;width:44px">⏭</button></div>' +
    '<div class="btn-row" style="flex-wrap:nowrap">' +
    '<button class="btn" style="flex:1" data-act="mTimeout"' + (m.timeouts[u] > 0 ? '' : ' disabled') + '>T. mort (' + m.timeouts[u] + ')</button>' +
    '<button class="btn" style="flex:1" data-act="mPanel" data-v="subs">Changer</button>' +
    '<button class="btn" style="flex:1" data-act="mPanel" data-v="tactic">Tactique</button>' +
    '<button class="btn' + (m.firstOpt[u] ? ' primary' : '') + '" style="flex:1.2" data-act="mPanel" data-v="option">★ ' +
    (m.firstOpt[u] ? UI.esc(m.p(m.firstOpt[u]).last) : '1re option') + '</button></div>';
};

UI.actions.mPlay = function () {
  var L = UI.live;
  if (L.m.pendingMoment) { UI.openPanel('moment'); return; }
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
  UI.flushPending();
  L.playing = false;
  if (L.m.career) { L.m.career.live = false; L.m.pendingMoment = null; }
  var start = L.m.events.length;
  L.m.simulateAll();
  UI.pushEvents(L.m.events.slice(start));
  UI.finishMatch();
};

// ==================================================================== panneaux du match
UI.openPanel = function (kind) {
  var L = UI.live;
  L.panel = kind;
  if (kind !== 'talk' && kind !== 'moment' && L.playing) { L.playing = false; clearTimeout(L.timer); UI.flushPending(); UI.renderControls(); }
  UI.renderPanel();
};

UI.actions.mPanel = function (el) { UI.openPanel(el.dataset.v); };

UI.actions.mClosePanel = function () {
  var L = UI.live;
  if (L.panel === 'talk' || L.panel === 'moment') return;
  L.panel = null; L.sel = null;
  document.getElementById('m-panel').innerHTML = '';
};

UI.renderPanel = function () {
  var L = UI.live, m = L.m, u = m.user, el = document.getElementById('m-panel');
  if (!el || !L.panel) return;
  var body = '';
  if (L.panel === 'moment' && m.pendingMoment) {
    body = UI.cMomentPanel(m);
  } else if (L.panel === 'talk') {
    var diff = m.score[u] - m.score[1 - u];
    body = '<div class="modal-h"><h2>Causerie de mi-temps</h2></div>' +
      '<p style="margin:0">' + (diff > 0 ? 'Vous menez de ' + diff + ' point' + (diff > 1 ? 's' : '') + '.' : diff < 0 ? 'Vous êtes menés de ' + (-diff) + ' point' + (diff < -1 ? 's' : '') + '.' : 'Égalité parfaite.') + ' Que dites-vous au vestiaire ?</p>' +
      '<div style="display:grid;gap:8px">' + BM.TEAM_TALKS.map(function (t) {
        return '<button class="btn block" data-act="mTalk" data-v="' + t.v + '">' + t.l + '</button>';
      }).join('') + '</div>';
  } else if (L.panel === 'option') {
    var cur = m.firstOpt[u];
    body = '<div class="modal-h"><h2>1re option offensive</h2><button class="btn sm x" data-act="mClosePanel">Fermer</button></div>' +
      '<p class="hint" style="margin:0">Un joueur <b>en feu 🔥</b> avec un <b>mismatch favorable</b> (+2 ou plus) marque beaucoup plus. Le bonus ne vaut que si vous suivez le match.</p>' +
      '<div class="court">' + m.on[u].map(function (id) {
        var p = m.p(id), mm = m.mismatch(u, id), vs = mm.vs ? m.p(mm.vs) : null, hot = m.isHot(id), b = m.box[id];
        var cls = mm.val >= 2 ? 'good' : mm.val <= -2 ? 'bad' : '';
        return '<div class="pl opt' + (cur === id ? ' sel' : '') + '" data-act="mOption" data-id="' + id + '" style="cursor:pointer;grid-template-columns:40px 1fr auto">' +
          BM.portrait(p, m.side[u], 36) +
          '<span><b>' + UI.esc(BM.shortName(p)) + '</b>' + (hot ? ' <span class="tag fire">🔥 En feu</span>' : '') +
          '<br><span class="muted small">' + b.pts + ' pts · vs ' + (vs ? UI.esc(BM.shortName(vs)) : '-') + ' · ' + (mm.kind === 'int' ? 'poste bas' : 'extérieur') + '</span></span>' +
          '<span class="tag ' + cls + '" style="font-size:13px">' + (mm.val > 0 ? '+' : '') + mm.val + '</span></div>';
      }).join('') + '</div>' +
      '<button class="btn block" data-act="mOption" data-id="">Jeu collectif (aucune option)</button>';
  } else if (L.panel === 'tactic') {
    var t = m.tac[u], O = BM.TACTIC_OPTIONS;
    var seg = function (f) {
      return '<div class="field"><label>' + { pace: 'Rythme', system: 'Système', defense: 'Défense' }[f] + '</label><div class="seg' + (f === 'pace' ? '' : ' wrap') + '">' + O[f].map(function (o) {
        return '<button data-act="mTactic" data-f="' + f + '" data-v="' + o.v + '" class="' + (t[f] === o.v ? 'on' : '') + '">' + o.l + '</button>';
      }).join('') + '</div></div>';
    };
    body = '<div class="modal-h"><h2>Consignes</h2><button class="btn sm x" data-act="mClosePanel">Fermer</button></div>' + seg('pace') + seg('system') + seg('defense');
  } else {
    var row = function (p, onCourt) {
      var b = m.box[p.id], en = Math.round(m.en[p.id]);
      var sel = L.sel === p.id ? ' sel' : '';
      var tags = (m.out[p.id] ? '<span class="tag bad">' + (p.injury > 0 ? 'Blessé' : BM.FOUL_OUT + ' fautes') + '</span>' : '') + (b.pf >= 3 && !m.out[p.id] ? '<span class="tag warn">' + b.pf + ' f.</span>' : '') +
        (m.isHot(p.id) ? '<span class="tag fire">🔥</span>' : '');
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
  el.innerHTML = '<div class="modal-bg"' + (L.panel === 'talk' || L.panel === 'moment' ? '' : ' data-act="mBg"') + '><div class="modal" role="dialog" aria-modal="true">' + body + '</div></div>';
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

UI.actions.mOption = function (el) {
  var L = UI.live, m = L.m, id = el.dataset.id ? +el.dataset.id : null;
  m.setFirstOption(m.user, id);
  UI.pushEvents(m.events.slice(-1));
  BM.Juice.haptic('medium');
  L.panel = null;
  document.getElementById('m-panel').innerHTML = '';
  UI.renderControls();
  UI.toast(id ? BM.shortName(m.p(id)) + ' devient la 1re option.' : 'Retour au jeu collectif.');
};

UI.actions.mTactic = function (el) {
  var L = UI.live;
  if (L.m.setTactic) L.m.setTactic(L.m.user, el.dataset.f, el.dataset.v);
  else L.m.tac[L.m.user][el.dataset.f] = el.dataset.v;
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
  if (L.court) { L.court.destroy(); L.court = null; }
  BM.applyResult(g, fx, m);
  UI.save();
  if (g.mode === 'career') { UI.cFinishMatch(); return; }
  var u = m.user, won = m.score[u] > m.score[1 - u];
  var mvp = m.mvp ? g.players[m.mvp] : null;
  var mvpBox = mvp && m.box[mvp.id] ? m.box[mvp.id] : null;
  UI.modalLocked = true;
  BM.Juice.sound(won ? 'win' : 'lose');
  BM.Juice.haptic(won ? 'heavy' : 'medium');
  if (won) setTimeout(function () { BM.Juice.confetti([g.teams[g.userTeam].color, '#ffd43b', '#ffffff', '#ff7a1a']); }, 250);
  UI.modal('<div class="result-banner"><h2 class="' + (won ? 'win' : 'loss') + '">' + (won ? 'Victoire' : 'Défaite') + '</h2></div>' +
    '<div class="card"><div class="sb"><div class="t">' + UI.teamBadge(m.side[0], true) + UI.esc(m.side[0].short) + '</div>' +
    '<div class="score">' + m.score[0] + ' – ' + m.score[1] + '</div><div class="t away">' + UI.esc(m.side[1].short) + UI.teamBadge(m.side[1], true) + '</div></div>' +
    UI.quarterTable(fx.qPts, m.side[0], m.side[1], m.score[0], m.score[1]) +
    (mvp ? '<div class="mvp-line">' + BM.portrait(mvp, g.teams[mvp.teamId], 48) + '<p class="small" style="margin:0">Homme du match · <b>Note ' + m.ratings[mvp.id].toFixed(1) + '</b><br><b>' + UI.esc(BM.fullName(mvp)) + '</b>' +
      (mvpBox ? ' · <span class="muted">' + mvpBox.pts + ' pts, ' + (mvpBox.oreb + mvpBox.dreb) + ' reb, ' + mvpBox.ast + ' pd</span>' : '') + '</p></div>' : '') + '</div>' +
    UI.whyCard(fx.why) +
    UI.matchAnalyticsCard(fx, m.side[0], m.side[1]) +
    UI.boxTable(g, fx.box, 0, m.side[0]) + UI.boxTable(g, fx.box, 1, m.side[1]) +
    '<button class="btn primary block" data-act="afterMatch">Continuer</button>');
};

UI.actions.afterMatch = function () {
  UI.live = null;
  UI.modalLocked = false;
  UI.closeModal();
  UI.cont(false);
};
