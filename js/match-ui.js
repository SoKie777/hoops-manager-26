var BM = globalThis.BM = globalThis.BM || {};
var UI = BM.UI;

// ==================================================================== graphiques analytiques (Shot Chart & Game Flow)
UI.quarterTable = function (qPts, home, away, hs, as) {
  if (!qPts || !qPts.length) return '';
  var hdr = qPts.map(function (q, i) { return '<th class="num">' + (q.l || (i < 4 ? 'Q' + (i + 1) : 'P' + (i - 3))) + '</th>'; }).join('');
  var row = function (t, side, tot) {
    return '<tr><td style="text-align:left;font-weight:700">' + UI.teamBadge(t, true) + ' ' + UI.esc(t.short) + '</td>' +
      qPts.map(function (q) { return '<td class="num">' + (q.s ? q.s[side] : q[side]) + '</td>'; }).join('') +
      '<td class="num" style="font-weight:800">' + tot + '</td></tr>';
  };
  return '<table class="tbl q-tbl" style="margin-top:8px"><thead><tr><th style="text-align:left">Équipe</th>' + hdr + '<th class="num">Tot.</th></tr></thead>' +
    '<tbody>' + row(home, 0, hs) + row(away, 1, as) + '</tbody></table>';
};

// Carte des tirs SVG sur demi-terrain (coordonnées moteur : x dans [52..93], y dans [2..48], panier à x=88.75, y=25).
UI.shotChartSvg = function (shots, home, away, filterSide) {
  // Format moteur : { side, depth (pieds depuis le panier), y (0-50), type, made }. Anciennes sauvegardes : { s, x, y, t, m }.
  shots = (shots || []).map(function (sh) {
    return sh.depth !== undefined ? sh : { side: sh.s, depth: 88.75 - sh.x, y: sh.y, type: sh.t, made: sh.m };
  }).filter(function (s) { return isFinite(s.depth) && isFinite(s.y) && (filterSide === undefined || filterSide === null || s.side === filterSide); });
  // Demi-terrain SVG : panier en (125, 30.4), 4,8 px par pied.
  var sx = function (sh) { return BM.clamp(sh.y * 5, 8, 242).toFixed(1); };
  var sy = function (sh) { return BM.clamp(30.4 + sh.depth * 4.8, 10, 202).toFixed(1); };
  var zones = { rim: [0, 0], mid: [0, 0], three: [0, 0] };
  var dots = shots.map(function (sh) {
    var z = zones[sh.type] || zones.mid;
    z[1]++; if (sh.made) z[0]++;
    var col = sh.side === 0 ? home.color : away.color;
    var x = sx(sh), y = sy(sh);
    if (sh.made) {
      return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + col + '" stroke="#fff" stroke-width="1"/>';
    }
    return '<g transform="translate(' + x + ',' + y + ')" stroke="' + col + '" stroke-width="1.6" opacity="0.8">' +
      '<line x1="-3" y1="-3" x2="3" y2="3"/><line x1="3" y1="-3" x2="-3" y2="3"/></g>';
  }).join('');

  var zPct = function (k, lbl) {
    var m = zones[k][0], a = zones[k][1], p = a ? Math.round(m / a * 100) : 0;
    return '<div class="sc-zone"><span class="muted small">' + lbl + '</span><b>' + m + '/' + a + '</b><span class="tag ' + (p >= 45 ? 'good' : p <= 30 && a > 2 ? 'bad' : '') + '">' + p + '%</span></div>';
  };

  return '<div class="shotchart-box">' +
    '<svg viewBox="0 0 250 210" class="shotchart-svg" aria-label="Carte des tirs">' +
    '' +
    '<rect x="2" y="2" width="246" height="206" rx="10" fill="#13223a" stroke="rgba(224,225,221,0.14)" stroke-width="1"/>' +
    // Raquette (16 pieds de large -> 80px, 19 pieds de profond -> 88px)
    '<rect x="85" y="6" width="80" height="88" fill="rgba(224,225,221,0.05)" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/>' +
    '<circle cx="125" cy="94" r="30" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/>' +
    // Ligne à 3 points (corners y=3->15px et y=47->235px, arc rayon 23.75 pieds -> 114px autour du panier (125, 30.4))
    '<path d="M 15 6 L 15 71 A 114 114 0 0 0 235 71 L 235 6" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.4"/>' +
    // Zone de non-charge, planche et anneau
    '<path d="M 105 30.4 A 20 20 0 0 0 145 30.4" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.1"/>' +
    '<line x1="110" y1="24" x2="140" y2="24" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="125" cy="30.4" r="4.8" fill="none" stroke="#e8722c" stroke-width="1.8"/>' +
    dots +
    '</svg>' +
    '<div class="sc-legend">' +
    '<span><i class="dot" style="background:' + home.color + '"></i>' + UI.esc(home.short) + '</span>' +
    '<span><i class="dot" style="background:' + away.color + '"></i>' + UI.esc(away.short) + '</span>' +
    '<span class="muted">Rond : réussi · croix : raté</span>' +
    '</div>' +
    '<div class="sc-zones">' + zPct('rim', 'Raquette') + zPct('mid', 'Mi-distance') + zPct('three', '3 Points') + '</div>' +
    '</div>';
};

// Courbe d'évolution de l'écart (Game Flow) sur 48 minutes.
UI.gameFlowSvg = function (flow, home, away, meta) {
  if (!flow || flow.length < 2) return '';
  // Format moteur : { t, d } avec d = écart domicile − extérieur ; anciennes sauvegardes : { t, s0, s1 }.
  flow = flow.map(function (pt) { return { t: pt.t, d: pt.d !== undefined ? pt.d : pt.s0 - pt.s1 }; }).filter(function (pt) { return isFinite(pt.t) && isFinite(pt.d); });
  if (flow.length < 2) return '';
  var W = 320, H = 116, midY = H / 2;
  var maxT = Math.max(2880, flow[flow.length - 1].t || 2880);
  var maxDiff = 12;
  flow.forEach(function (pt) { var d = Math.abs(pt.d); if (d > maxDiff) maxDiff = d; });
  var xOf = function (t) { return (12 + (t / maxT) * (W - 24)).toFixed(1); };
  var yOf = function (diff) { return (midY - (diff / maxDiff) * (midY - 14)).toFixed(1); };

  var pts = flow.map(function (pt) { return xOf(pt.t) + ',' + yOf(pt.d); }).join(' ');
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
    '<rect x="2" y="2" width="' + (W - 4) + '" height="' + (H - 4) + '" rx="8" fill="#13223a" stroke="rgba(224,225,221,0.12)"/>' +
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
  return '<div class="card wide"><h3>Tirs et évolution du score</h3>' +
    '<div class="analytics-grid">' +
    (data.shots && data.shots.length ? '<div><div class="small muted" style="margin-bottom:4px;font-weight:700">Carte des tirs</div>' + UI.shotChartSvg(data.shots, home, away) + '</div>' : '') +
    (data.flow && data.flow.length >= 2 ? '<div><div class="small muted" style="margin-bottom:4px;font-weight:700">Écart au score</div>' + UI.gameFlowSvg(data.flow, home, away, data) + '</div>' : '') +
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
  var t = me.tactics;
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>' + (fx.type === 'playoff' ? BM.ROUND_NAMES[fx.round] + ' · match ' + fx.game : 'Avant-match · Journée ' + fx.round) + '</h2>' +
    (UI.rivalryBadge ? UI.rivalryBadge(g, fx) : '') +
    '<span class="small muted" style="margin-left:auto">' + UI.esc(BM.dateLabel(g, fx.day)) + '</span></div>' +
    '<div class="card wide"><div class="vs"><div class="t">' + UI.teamBadge(h) + UI.esc(h.name) + '<span class="small muted">' + h.record.w + 'V-' + h.record.l + 'D · note ' + avgOvr(h) + '</span>' + UI.formPips(g, h) + '</div>' +
    '<div class="mid">VS</div>' +
    '<div class="t">' + UI.teamBadge(a) + UI.esc(a.name) + '<span class="small muted">' + a.record.w + 'V-' + a.record.l + 'D · note ' + avgOvr(a) + '</span>' + UI.formPips(g, a) + '</div></div></div>' +
    '<div class="card"><h3>Rapport sur l\'adversaire</h3>' +
    '<p class="small" style="margin:0">' + UI.esc(opp.name) + ' joue un rythme <b>' + UI.esc(label('pace', opp.tactics.pace).toLowerCase()) +
    '</b>, en <b>' + UI.esc(label('system', opp.tactics.system)) + '</b>, défense <b>' + UI.esc(label('defense', opp.tactics.defense)) + '</b>.' +
    (oppStar ? ' Menace n°1 : <b>' + UI.esc(BM.fullName(oppStar)) + '</b> (' + oppStar.pos + ', note ' + BM.ovr(oppStar) + ').' : '') + '</p></div>' +
    '<div class="card"><div class="card-h"><h3>Votre plan</h3><button class="btn sm" data-act="editTactics">' + UI.icon('clip', 'ico sm') + 'Modifier</button></div>' +
    '<div class="attr"><span class="muted">Système</span><b style="font-size:12.5px">' + UI.esc(label('system', t.system)) + '</b></div>' +
    '<div class="attr"><span class="muted">Défense</span><b style="font-size:12.5px">' + UI.esc(label('defense', t.defense)) + '</b></div>' +
    '<div class="attr"><span class="muted">Cinq</span><span class="small">' + (starters.length ? starters.map(function (p) { return UI.esc(p.last); }).join(', ') : 'automatique') + '</span></div>' +
    (tired.length ? '<p class="small" style="margin:6px 0 0;color:var(--warn)">Fatigués : ' + tired.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    (injured.length ? '<p class="small" style="margin:4px 0 0;color:var(--bad)">Blessés : ' + injured.map(function (p) { return UI.esc(BM.shortName(p)); }).join(', ') + '</p>' : '') +
    '</div>' +
    '<div class="btn-row"><button class="btn primary" style="flex:2" data-act="playLive">' + UI.icon('play', 'ico sm') + 'Jouer en direct</button>' +
    '<button class="btn" style="flex:1" data-act="playQuick">' + UI.icon('bolt', 'ico sm') + 'Résultat direct</button></div>');
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
// Durée d'une possession à l'écran (ms) selon la vitesse : assez longue pour voir la remontée, la mise en place et la défense.
UI.SPEEDS = { 1: 4600, 2: 2400, 4: 1000 };
// En mode « Temps forts », les possessions ordinaires défilent en accéléré.
UI.SKIP_MS = 320;
UI.viewMode = function () { return UI.store.get('hoops_view') === 'key' ? 'key' : 'all'; };

UI.schedule = function (delay) {
  var L = UI.live;
  clearTimeout(L.timer);
  UI.flushPending();
  if (!L.playing || L.m.finished) return;
  L.timer = setTimeout(UI.tickMatch, delay === undefined ? 120 : delay);
};

// Une possession mérite d'être jouée en entier en mode « Temps forts » ?
UI.isKeyPlay = function (m, play, evs, before) {
  if (!play) return false;
  if (evs.some(function (e) { return e.type === 'quarter' || e.type === 'momentum' || e.type === 'hot' || e.type === 'injury' || e.type === 'final'; })) return true;
  if (play.firstOption || play.blocker || play.alleyOop || play.dunk || play.stealer) return true;
  if (play.kind === 'shot' && play.made && play.type === 'three') return true;
  var lead0 = before[0] - before[1], lead1 = m.score[0] - m.score[1];
  if (lead0 * lead1 <= 0 && lead0 !== lead1) return true; // changement de leader ou égalisation
  return m.q >= 4 && m.clock <= 120 && Math.abs(lead1) <= 6;
};

// Joue une possession : la vue 2D l'anime, le score et le commentaire tombent quand le ballon arrive.
UI.tickMatch = function () {
  var L = UI.live;
  if (!L || !L.playing) return;
  var before = L.m.score.slice(), c0 = { q: L.m.q, clock: L.m.clock };
  var evs = L.m.step(), play = L.m.play;
  var key = UI.viewMode() === 'all' || UI.isKeyPlay(L.m, play, evs, before);
  var T = key ? UI.SPEEDS[L.speed] : UI.SKIP_MS;
  if (L.court) L.court.animate(play, T * 0.96, !key);
  var impact = !key ? 0.9 : play && play.kind === 'shot' ? 0.82 : 0.6;
  L.pending = { evs: evs, before: before };
  UI.runClock(c0, play, T * impact);
  L.timer = setTimeout(function () {
    UI.flushPending();
    if (L.m.finished) { L.timer = setTimeout(UI.finishMatch, 900); return; }
    if (L.m.halftimePending && L.m.career) { L.m.resumeAfterHalftime(); UI.toast('Mi-temps : ' + L.m.score[0] + '-' + L.m.score[1] + '.'); }
    if (L.m.halftimePending) { L.playing = false; UI.renderControls(); UI.openPanel('talk'); return; }
    if (L.m.pendingMoment) { L.playing = false; UI.renderControls(); UI.openPanel('moment'); if (BM.Juice) { BM.Juice.sound('cheer'); BM.Juice.haptic('heavy'); } return; }
    if (L.pick) UI.renderPane();
    if (L.playing) L.timer = setTimeout(UI.tickMatch, T * (1 - impact));
  }, T * impact);
};

// L'horloge de match et celle des 24 secondes défilent pendant que la possession se joue à l'écran.
UI.runClock = function (c0, play, ms) {
  var L = UI.live;
  clearInterval(L.clockTimer);
  if (!play || ms < 400) return;
  var m = L.m, to = m.q !== c0.q ? 0 : m.clock, t0 = Date.now(), sc0 = play.putback ? 14 : 24;
  var tick = function () {
    var k = Math.min(1, (Date.now() - t0) / ms), clk = document.getElementById('m-clk'), sh = document.getElementById('m-shot');
    if (clk) clk.textContent = UI.clockLabel(c0.q, Math.max(0, Math.round(c0.clock + (to - c0.clock) * k)));
    if (sh) sh.textContent = Math.max(0, Math.ceil(sc0 - (play.dur || 0) * k));
    if (k >= 1) clearInterval(L.clockTimer);
  };
  tick();
  L.clockTimer = setInterval(tick, 120);
};

UI.flushPending = function () {
  var L = UI.live;
  if (!L || !L.pending) return;
  clearInterval(L.clockTimer);
  var p = L.pending;
  L.pending = null;
  UI.pushEvents(p.evs);
  var bump = [L.m.score[0] > p.before[0], L.m.score[1] > p.before[1]];
  UI.renderScore(bump);
  if (!L.pick && L.paneTab !== 'feed') UI.renderPane();
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
  L.paneTab = L.paneTab || 'feed';
  L.pick = null;
  document.getElementById('modal-root').innerHTML =
    '<div class="match" style="--c0:' + UI.liftTeam(m.side[0].color) + ';--c1:' + UI.liftTeam(m.side[1].color) + '">' +
    '<div class="scoreboard" id="m-score"></div>' +
    '<div class="m-body">' +
    '<div class="m-left"><div class="court-wrap"><canvas id="m-court" aria-label="Vue 2D du terrain"></canvas></div><div class="m-bar" id="m-ctrl"></div></div>' +
    '<div class="m-side"><div class="qi" id="m-qi"></div><div class="m-pane" id="m-pane"></div></div>' +
    '</div><div id="m-panel"></div></div>';
  L.court = new BM.Court(document.getElementById('m-court'), m);
  L.feedHtml = '';
  UI.renderScore();
  UI.pushEvents(m.events);
  UI.renderControls();
  // Le panneau latéral vient d'être rempli : on recale la taille du terrain sur la place réellement disponible.
  requestAnimationFrame(function () { if (L.court) L.court.resize(); });
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
  var bonus = function (i) { return m.teamFouls[1 - i] >= 4 ? '<span class="bonus-pill">BONUS</span>' : ''; };
  el.innerHTML = '<div class="sb">' +
    '<div class="t">' + UI.teamBadge(t[0], true) + '<div class="t-meta"><span class="nm">' + UI.esc(t[0].short) + ' <span class="small muted hide-sm">' + UI.esc(t[0].nick) + '</span>' + bonus(0) + '</span>' + toDots(0) + '</div></div>' +
    '<div class="score h">' + sc(0) + '</div>' +
    '<div class="clock"><b id="m-clk">' + (m.finished ? 'FIN' : UI.clockLabel(m.q, Math.max(0, Math.round(m.clock)))) + '</b><span><i id="m-shot" class="shot" title="Horloge des 24 secondes">24</i> · Fautes ' + m.teamFouls[0] + '–' + m.teamFouls[1] + '</span></div>' +
    '<div class="score a">' + sc(1) + '</div>' +
    '<div class="t away"><div class="t-meta" style="align-items:flex-end"><span class="nm">' + bonus(1) + '<span class="small muted hide-sm">' + UI.esc(t[1].nick) + '</span> ' + UI.esc(t[1].short) + '</span>' + toDots(1) + '</div>' + UI.teamBadge(t[1], true) + '</div></div>' +
    UI.momentumBar(m);
};

// Jauge de momentum : fine bande sous le scorebug, chaque équipe pousse depuis son côté.
UI.momentumBar = function (m) {
  var a = m.mom[0], b = m.mom[1], tot = Math.max(1, a + b), share = a / tot * 100;
  return '<div class="mom" title="Momentum"><span style="width:' + share.toFixed(1) + '%;background:' + m.side[0].color + '"></span>' +
    '<span style="width:' + (100 - share).toFixed(1) + '%;background:' + m.side[1].color + '"></span></div>';
};

// Confirmation d'une consigne, affichée sous le scorebug sans bloquer le jeu.
UI.sbToast = function (msg) {
  var el = document.querySelector('.m-left');
  if (!el) return;
  var old = el.querySelector('.sb-toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'sb-toast';
  t.textContent = msg;
  el.appendChild(t);
  clearTimeout(UI.sbTimer);
  UI.sbTimer = setTimeout(function () { t.remove(); }, 2200);
};

UI.evHtml = function (e) {
  var m = UI.live.m, color = e.side >= 0 ? m.side[e.side].color : 'transparent';
  if (e.type === 'quarter' || e.type === 'final') return '<div class="ev ' + e.type + '">' + UI.esc(e.text) + '</div>';
  return '<div class="ev ' + e.type + '"><span class="tm"><i class="side" style="background:' + color + '"></i>' + UI.clockLabel(e.q, e.clock) + '</span>' +
    '<span class="tx">' + UI.esc(e.text) + '</span><span class="sc">' + e.score[0] + '-' + e.score[1] + '</span></div>';
};

UI.pushEvents = function (evs) {
  var L = UI.live;
  if (!L || !evs.length) return;
  var html = '';
  evs.forEach(function (e) { html = UI.evHtml(e) + html; });
  L.feedHtml = (html + (L.feedHtml || '')).slice(0, 60000);
  var feed = document.getElementById('m-feed');
  if (feed) feed.insertAdjacentHTML('afterbegin', html);
  var last = evs[evs.length - 1], tk = document.getElementById('m-ticker');
  if (tk && last && last.type !== 'quarter') tk.innerHTML = '<b>' + UI.clockLabel(last.q, last.clock) + '</b> · ' + UI.esc(last.text);
};

// Barre sous le terrain : lecture, vitesse, mode de visionnage, fin simulée, dernière action.
UI.renderControls = function () {
  var L = UI.live, m = L.m;
  var el = document.getElementById('m-ctrl');
  if (!el) return;
  var mode = UI.viewMode();
  el.innerHTML = '<button class="icon-btn" data-act="mPlay" aria-label="' + (L.playing ? 'Pause' : 'Lecture') + '">' + UI.icon(L.playing ? 'pause' : 'play') + '</button>' +
    '<div class="seg" role="group" aria-label="Vitesse">' + [1, 2, 4].map(function (s) {
      return '<button data-act="mSpeed" data-v="' + s + '" class="' + (L.speed === s ? 'on' : '') + '">x' + s + '</button>';
    }).join('') + '</div>' +
    '<div class="seg" role="group" aria-label="Visionnage"><button data-act="mView" data-v="all" class="' + (mode === 'all' ? 'on' : '') + '">Tout voir</button>' +
    '<button data-act="mView" data-v="key" class="' + (mode === 'key' ? 'on' : '') + '">Temps forts</button></div>' +
    '<span class="ticker" id="m-ticker"></span>' +
    '<button class="icon-btn" data-act="mSimEnd" title="Simuler la fin du match" aria-label="Simuler la fin du match">' + UI.icon('skip') + '</button>';
  var last = m.events[m.events.length - 1];
  if (last) document.getElementById('m-ticker').innerHTML = '<b>' + UI.clockLabel(last.q, last.clock) + '</b> · ' + UI.esc(last.text);
  UI.renderQuick();
  UI.renderPane();
};

// Consignes rapides : toujours visibles, une touche ouvre le choix dans le panneau, sans quitter le terrain.
UI.renderQuick = function () {
  var L = UI.live, m = L.m, u = m.user, el = document.getElementById('m-qi');
  if (!el) return;
  var chip = function (k, lab, val, dis) {
    return '<button data-act="mPick" data-v="' + k + '" class="' + (L.pick === k ? 'on' : '') + '"' + (dis ? ' disabled' : '') + '><span>' + lab + '</span><b>' + val + '</b></button>';
  };
  if (m.career) {
    el.innerHTML = Object.keys(BM.CAREER_MENT).map(function (k) {
      return '<button data-act="mCMent" data-v="' + k + '" class="' + (m.career.ment === k ? 'on' : '') + '"><span>Mentalité</span><b>' + UI.esc(BM.CAREER_MENT[k].l) + '</b></button>';
    }).join('');
    return;
  }
  var t = m.tac[u], O = BM.TACTIC_OPTIONS;
  var short = function (f) { var o = O[f].find(function (x) { return x.v === t[f]; }); return o ? UI.esc(o.s || o.l) : '-'; };
  el.innerHTML =
    chip('system', 'Système', short('system')) +
    chip('option', '1re option', m.firstOpt[u] ? UI.esc(m.p(m.firstOpt[u]).last) : 'Collectif') +
    chip('pace', 'Rythme', short('pace')) +
    chip('defense', 'Défense', short('defense')) +
    chip('subs', 'Changements', m.auto[u] ? 'Auto' : 'Manuel') +
    chip('timeout', 'Temps mort', m.timeouts[u] + ' restant' + (m.timeouts[u] > 1 ? 's' : ''), m.timeouts[u] <= 0);
};

UI.renderPane = function () {
  var L = UI.live, m = L.m, u = m.user, el = document.getElementById('m-pane');
  if (!el) return;
  if (!L.pick) {
    var tabs = '<div class="tabs" role="tablist">' + [['feed', 'Direct'], ['on5', 'Sur le terrain'], ['chart', 'Tirs & écart']].map(function (x) {
      return '<button role="tab" data-act="mPaneTab" data-v="' + x[0] + '" class="' + (L.paneTab === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var body = '';
    if (L.paneTab === 'feed') body = '<div class="feed" id="m-feed">' + (L.feedHtml || '') + '</div>';
    else if (L.paneTab === 'on5') {
      var five = function (side) {
        var t = m.side[side];
        return '<div class="pick"><div class="pick-h"><h3>' + UI.esc(t.name) + '</h3></div>' + m.on[side].map(function (id) {
          var p = m.p(id), b = m.box[id], en = Math.round(m.en[id]);
          var tags = (m.isHot(id) ? '<span class="tag fire">En feu</span>' : '') + (b.pf >= 4 ? '<span class="tag bad">' + b.pf + ' f.</span>' : b.pf === 3 ? '<span class="tag warn">3 f.</span>' : '');
          return '<div class="live-p-row"><span class="pos">' + p.pos + '</span><span>' + UI.esc(BM.shortName(p)) + tags + '</span>' +
            '<span class="small muted">' + b.pts + ' pts · ' + (b.oreb + b.dreb) + ' reb · ' + b.ast + ' pd</span>' + UI.bar(en) + '</div>';
        }).join('') + '</div>';
      };
      body = five(u >= 0 ? u : 0) + five(u >= 0 ? 1 - u : 1);
    } else {
      body = '<div class="pick">' + UI.shotChartSvg(m.shots, m.side[0], m.side[1]) +
        UI.gameFlowSvg(m.flow, m.side[0], m.side[1], { biggestLead: m.biggestLead, leadChanges: m.leadChanges, ties: m.ties }) + '</div>';
    }
    el.innerHTML = tabs + body;
    return;
  }
  var head = function (title) { return '<div class="pick-h"><h3>' + title + '</h3><button class="btn sm" data-act="mPick" data-v="">Fermer</button></div>'; };
  var html = '';
  if (L.pick === 'system' || L.pick === 'defense' || L.pick === 'pace') {
    var t = m.tac[u];
    html = head({ system: 'Système offensif', defense: 'Schéma défensif', pace: 'Rythme' }[L.pick]) +
      BM.TACTIC_OPTIONS[L.pick].map(function (o) {
        return '<button class="pick-opt' + (t[L.pick] === o.v ? ' on' : '') + '" data-act="mTactic" data-f="' + L.pick + '" data-v="' + o.v + '"><b>' + UI.esc(o.s || o.l) + '</b>' +
          (t[L.pick] === o.v ? '<span class="tag good">Actif</span>' : '<span></span>') + '<small>' + UI.esc(o.d || '') + '</small></button>';
      }).join('');
  } else if (L.pick === 'option') {
    var cur = m.firstOpt[u];
    html = head('1re option offensive') +
      '<p class="hint" style="margin:0 0 2px">Un joueur en feu avec un mismatch de +2 ou plus marque beaucoup plus.</p>' +
      m.on[u].map(function (id) {
        var p = m.p(id), mm = m.mismatch(u, id), vs = mm.vs ? m.p(mm.vs) : null, b = m.box[id];
        var cls = mm.val >= 2 ? 'good' : mm.val <= -2 ? 'bad' : '';
        return '<button class="pick-opt pl' + (cur === id ? ' on' : '') + '" data-act="mOption" data-id="' + id + '">' + BM.portrait(p, m.side[u], 28) +
          '<b>' + UI.esc(BM.shortName(p)) + (m.isHot(id) ? ' <span class="tag fire">En feu</span>' : '') + '</b>' +
          '<span class="tag ' + cls + '">' + (mm.val > 0 ? '+' : '') + mm.val + '</span>' +
          '<small>' + b.pts + ' pts · face à ' + (vs ? UI.esc(BM.shortName(vs)) : '-') + ' · ' + (mm.kind === 'int' ? 'poste bas' : 'extérieur') + '</small></button>';
      }).join('') +
      '<button class="pick-opt' + (!cur ? ' on' : '') + '" data-act="mOption" data-id=""><b>Jeu collectif</b><span></span><small>Aucune option prioritaire : le ballon circule.</small></button>';
  } else if (L.pick === 'subs') {
    var onIds = m.on[u];
    var row = function (p, onCourt) {
      var b = m.box[p.id], en = Math.round(m.en[p.id]);
      var tags = (m.out[p.id] ? '<span class="tag bad">' + (p.injury > 0 ? 'Blessé' : BM.FOUL_OUT + ' fautes') + '</span>' : '') + (b.pf >= 3 && !m.out[p.id] ? '<span class="tag warn">' + b.pf + ' f.</span>' : '') +
        (m.isHot(p.id) ? '<span class="tag fire">En feu</span>' : '');
      return '<div class="pl' + (L.sel === p.id ? ' sel' : '') + '" data-act="mSel" data-id="' + p.id + '" data-on="' + (onCourt ? 1 : 0) + '">' +
        '<span class="pos">' + p.pos + '</span><span>' + UI.esc(BM.shortName(p)) + tags + '<br><span class="muted small">' + b.pts + ' pts · ' + Math.round(b.sec / 60) + ' min</span></span>' +
        UI.bar(en) + '<b class="num small">' + en + '</b></div>';
    };
    html = head('Changements') +
      '<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-change="mAuto"' + (m.auto[u] ? ' checked' : '') + '> Rotations automatiques</label>' +
      '<p class="hint" style="margin:0">' + (L.sel ? 'Touchez maintenant le joueur à échanger.' : 'Touchez un joueur sur le terrain puis un remplaçant.') + '</p>' +
      '<div class="pick-h"><h3>Sur le terrain</h3></div><div class="court">' + onIds.map(function (id) { return row(m.p(id), true); }).join('') + '</div>' +
      '<div class="pick-h"><h3>Banc</h3></div><div class="court">' + m.roster[u].filter(function (p) { return onIds.indexOf(p.id) < 0; }).map(function (p) { return row(p, false); }).join('') + '</div>';
  }
  el.innerHTML = '<div class="pick">' + html + '</div>';
};

UI.actions.mPaneTab = function (el) { UI.live.paneTab = el.dataset.v; UI.renderPane(); };

UI.actions.mPick = function (el) {
  var L = UI.live, k = el.dataset.v || null;
  if (k === 'timeout') { UI.actions.mTimeout(); return; }
  L.pick = L.pick === k ? null : k;
  L.sel = null;
  UI.renderQuick();
  UI.renderPane();
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

UI.actions.mView = function (el) {
  UI.store.set('hoops_view', el.dataset.v);
  UI.renderControls();
  UI.sbToast(el.dataset.v === 'key' ? 'Temps forts : seules les actions décisives sont jouées' : 'Tout voir : chaque possession est jouée');
};

UI.actions.mTimeout = function () {
  var L = UI.live;
  if (L.m.timeout(L.m.user)) {
    UI.pushEvents(L.m.events.slice(-1));
    L.playing = false;
    clearTimeout(L.timer);
    UI.flushPending();
    L.pick = 'subs';
    UI.renderControls();
    UI.sbToast('Temps mort : le jeu est arrêté, faites vos changements');
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

// ==================================================================== panneaux bloquants (mi-temps, moments de carrière)
UI.openPanel = function (kind) {
  var L = UI.live;
  L.panel = kind;
  UI.renderPanel();
};

UI.actions.mClosePanel = function () {
  var L = UI.live;
  if (L.panel === 'talk' || L.panel === 'moment') return;
  L.panel = null;
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
      '<div style="display:grid;gap:6px">' + BM.TEAM_TALKS.map(function (t) {
        return '<button class="btn block" data-act="mTalk" data-v="' + t.v + '">' + t.l + '</button>';
      }).join('') + '</div>';
  }
  el.innerHTML = '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">' + body + '</div></div>';
};

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
  L.pick = null;
  UI.renderQuick(); UI.renderPane();
  UI.sbToast(id ? BM.shortName(m.p(id)) + ' en 1re option dès la prochaine possession' : 'Retour au jeu collectif');
};

UI.actions.mTactic = function (el) {
  var L = UI.live, f = el.dataset.f, v = el.dataset.v;
  if (L.m.setTactic) L.m.setTactic(L.m.user, f, v);
  else L.m.tac[L.m.user][f] = v;
  if (f === 'system' || f === 'defense') L.m.log('info', L.m.user, 'Consigne : ' + (BM.TACTIC_OPTIONS[f].find(function (o) { return o.v === v; }) || {}).l + '.');
  UI.pushEvents(L.m.events.slice(-1));
  BM.Juice.haptic('light');
  L.pick = null;
  UI.renderQuick(); UI.renderPane();
  var o = BM.TACTIC_OPTIONS[f].find(function (x) { return x.v === v; }) || {};
  UI.sbToast((o.s || o.l) + ' : appliqué dès la prochaine possession');
};

UI.actions.mSel = function (el) {
  var L = UI.live, m = L.m, u = m.user, id = +el.dataset.id, onCourt = el.dataset.on === '1';
  if (m.out[id] && !onCourt) { UI.sbToast('Ce joueur ne peut plus revenir en jeu'); return; }
  if (L.sel === null || L.sel === undefined) { L.sel = id; UI.renderPane(); return; }
  var selOn = m.on[u].indexOf(L.sel) >= 0;
  if (selOn !== onCourt) {
    var outId = onCourt ? id : L.sel, inId = onCourt ? L.sel : id;
    if (m.substitute(u, outId, inId)) {
      UI.pushEvents(m.events.slice(-1));
      UI.sbToast(BM.shortName(m.p(inId)) + ' entre pour ' + BM.shortName(m.p(outId)));
    }
    L.sel = null;
  } else {
    L.sel = L.sel === id ? null : id;
  }
  UI.renderPane();
};

UI.changes.mAuto = function (el) { UI.live.m.auto[UI.live.m.user] = el.checked; UI.renderQuick(); };

// ==================================================================== fin de match
UI.finishMatch = function () {
  var L = UI.live, g = UI.g, m = L.m, fx = L.fx;
  clearTimeout(L.timer);
  clearInterval(L.clockTimer);
  if (L.court) { L.court.destroy(); L.court = null; }
  BM.applyResult(g, fx, m);
  UI.save();
  var u = m.user, won = m.score[u] > m.score[1 - u];
  var mvp = m.mvp ? g.players[m.mvp] : null;
  var mvpBox = mvp && m.box[mvp.id] ? m.box[mvp.id] : null;
  UI.modalLocked = true;
  BM.Juice.sound(won ? 'win' : 'lose');
  BM.Juice.haptic(won ? 'heavy' : 'medium');
  if (won) setTimeout(function () { BM.Juice.confetti([g.teams[g.userTeam].color, '#f2c94c', '#ffffff']); }, 250);
  UI.modal('<div class="modal-h"><div class="result-banner"><h2 class="' + (won ? 'win' : 'loss') + '">' + (won ? 'Victoire' : 'Défaite') + '</h2></div>' +
    '<button class="btn primary" style="margin-left:auto" data-act="afterMatch">Continuer' + UI.icon('next', 'ico sm') + '</button></div>' +
    '<div class="card wide"><div class="vs"><div class="t">' + UI.teamBadge(m.side[0]) + UI.esc(m.side[0].name) + '</div>' +
    '<div class="mid" style="color:var(--text);font-size:26px">' + m.score[0] + ' – ' + m.score[1] + '</div><div class="t">' + UI.teamBadge(m.side[1]) + UI.esc(m.side[1].name) + '</div></div>' +
    UI.quarterTable(fx.qPts, m.side[0], m.side[1], m.score[0], m.score[1]) +
    (mvp ? '<div class="mvp-line">' + BM.portrait(mvp, g.teams[mvp.teamId], 44) + '<p class="small" style="margin:0">Homme du match · <b>note ' + UI.dec(m.ratings[mvp.id]) + '</b><br><b>' + UI.esc(BM.fullName(mvp)) + '</b>' +
      (mvpBox ? ' · <span class="muted">' + mvpBox.pts + ' pts, ' + (mvpBox.oreb + mvpBox.dreb) + ' reb, ' + mvpBox.ast + ' pd</span>' : '') + '</p></div>' : '') + '</div>' +
    (fx.ach ? '<div class="card wide"><h3>Accomplissement débloqué</h3>' + fx.ach.map(function (a) { return '<div class="attr"><span>' + UI.esc(a.l) + '</span><b class="a-hi">+' + a.pts + '</b></div>'; }).join('') + '</div>' : '') +
    UI.replyCard(g, fx) +
    UI.nightScoresCard(g, fx) +
    UI.whyCard(fx.why) +
    UI.matchAnalyticsCard(fx, m.side[0], m.side[1]) +
    UI.boxTable(g, fx.box, 0, m.side[0]) + UI.boxTable(g, fx.box, 1, m.side[1]));
};

UI.actions.afterMatch = function () {
  UI.live = null;
  UI.modalLocked = false;
  UI.closeModal();
  UI.cont(false);
};
