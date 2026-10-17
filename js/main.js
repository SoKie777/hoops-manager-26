var BM = globalThis.BM = globalThis.BM || {};
var UI = BM.UI;

// ==================================================================== avancer dans le temps
UI.cont = function (fastForward) {
  if (UI.live || !UI.g) return;
  var g = UI.g, lastId = g.nextMsgId, days = 0;
  for (;;) {
    var r = BM.advance(g);
    if (r.state !== 'ok') { UI.handleAdvance(r); break; }
    days++;
    if (!fastForward || days >= 60) break;
    var important = g.inbox.some(function (m) { return m.id >= lastId && (m.actions || m.type === 'board' || m.type === 'medical'); });
    if (important) break;
  }
  UI.save();
  UI.render();
};

UI.handleAdvance = function (r) {
  var g = UI.g;
  if (r.state === 'match') UI.preMatch(r.fx);
  else if (r.state === 'blocked') UI.toast(r.msg);
  else if (r.state === 'seasonEnd') {
    var summary = BM.endSeason(g);
    UI.save();
    if (g.gameOver) UI.showGameOver(summary); else UI.showSeasonSummary(summary);
  }
  else if (r.state === 'seasonSummary') UI.showSeasonSummary(r.summary);
  else if (r.state === 'gameover') UI.showGameOver(null);
};

UI.showSeasonSummary = function (s) {
  var g = UI.g;
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>Bilan de la saison ' + s.season + '</h2></div>' +
    '<div class="grid2"><div class="kpi"><b>' + s.finalPos + '<sup>e</sup></b><span>Saison régulière</span></div>' +
    '<div class="kpi"><b>' + UI.esc(s.champion) + '</b><span>Champion</span></div></div>' +
    '<div class="card"><p style="margin:0">Objectif : ' + UI.esc(s.objective) + ' — <b style="color:' + (s.met ? 'var(--good)' : 'var(--bad)') + '">' + (s.met ? 'atteint' : 'manqué') + '</b></p>' +
    '<p class="small muted" style="margin:6px 0 0">Confiance de la direction : ' + g.board.confidence + '% · MVP de la saison : ' + UI.esc(s.mvp) + '</p></div>' +
    (s.departures && s.departures.length ? '<div class="card"><h3 style="margin-bottom:6px">Départs</h3><p class="small" style="margin:0">' + s.departures.map(UI.esc).join('<br>') + '</p></div>' : '') +
    (s.prospects && s.prospects.length ? '<div class="card"><h3 style="margin-bottom:6px">Centre de formation</h3><p class="small" style="margin:0">' + s.prospects.map(UI.esc).join('<br>') + '</p></div>' : '') +
    '<p class="small muted" style="margin:0">Les joueurs ont pris un an : progression des jeunes, déclin des vétérans, contrats mis à jour.</p>' +
    '<button class="btn primary block" data-act="newSeason">Lancer la saison ' + (s.season + 1) + '</button>');
};

UI.actions.newSeason = function () {
  BM.startNewSeason(UI.g);
  UI.modalLocked = false;
  UI.closeModal();
  UI.tab = 'home';
  UI.save();
  UI.render();
};

UI.showGameOver = function (s) {
  UI.modalLocked = true;
  UI.modal('<div class="modal-h"><h2>Fin de l\'aventure</h2></div>' +
    '<p>La direction de ' + UI.esc(UI.g.teams[UI.g.userTeam].name) + ' a décidé de se séparer de vous' + (s ? ' à l\'issue de la saison ' + s.season : '') + '.</p>' +
    '<button class="btn primary block" data-act="restart">Nouvelle carrière</button>');
};

UI.actions.restart = function () {
  UI.store.del(BM.SAVE_KEY);
  UI.g = null;
  UI.modalLocked = false;
  UI.closeModal();
  UI.render();
};

UI.actions.continue = function () { UI.cont(false); };
UI.actions.fastForward = function () { UI.cont(true); };

// ==================================================================== écran de départ
UI.actions.pickTeam = function (el) {
  var name = document.getElementById('mgr');
  if (name) UI.mgrName = name.value;
  UI.pickTeam = +el.dataset.i;
  UI.render();
};

UI.actions.newGame = function () {
  var name = (document.getElementById('mgr').value || '').trim() || 'Coach';
  UI.g = BM.newGame({ teamId: UI.pickTeam, managerName: name, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  UI.tab = 'home';
  UI.save();
  UI.render();
};

UI.actions.loadSave = function () {
  try {
    UI.g = BM.deserialize(UI.store.get(BM.SAVE_KEY));
    UI.render();
  } catch (e) {
    UI.toast('Sauvegarde illisible.');
  }
};

UI.changes.importFile = function (el) {
  var file = el.files && el.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      UI.g = BM.deserialize(reader.result);
      UI.save();
      UI.render();
      UI.toast('Partie importée.');
    } catch (e) {
      UI.toast('Fichier de sauvegarde invalide.');
    }
  };
  reader.readAsText(file);
};

// ==================================================================== délégation d'événements
// Effet d'onde + vibration + clic sonore sur tous les boutons.
document.addEventListener('pointerdown', function (ev) {
  var b = ev.target.closest('.btn, .seg button, .tabs button, .team-pick button');
  if (!b || b.disabled || BM.Juice.reduced) return;
  var r = b.getBoundingClientRect(), size = Math.max(r.width, r.height);
  var s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (ev.clientX - r.left - size / 2) + 'px;top:' + (ev.clientY - r.top - size / 2) + 'px';
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.style.overflow = 'hidden';
  b.appendChild(s);
  setTimeout(function () { s.remove(); }, 600);
  BM.Juice.haptic(b.classList.contains('primary') ? 'medium' : 'light');
  BM.Juice.sound('tap');
});

document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-act]');
  if (!el) return;
  var fn = UI.actions[el.dataset.act];
  if (fn) fn(el, ev);
});

['input', 'change'].forEach(function (type) {
  document.addEventListener(type, function (ev) {
    var el = ev.target.closest('[data-change]');
    if (!el) return;
    var fn = UI.changes[el.dataset.change];
    if (!fn) return;
    // Les sélecteurs et cases ne réagissent qu'à "change" ; les curseurs aux deux.
    if (type === 'input' && el.type !== 'range') return;
    fn(el, ev);
  });
});

document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape' && !UI.modalLocked && !UI.live) UI.closeModal();
});

(function boot() {
  var theme = UI.store.get('hoops_theme');
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  UI.render();
})();
