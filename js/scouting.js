var BM = globalThis.BM = globalThis.BM || {};

// Cellule de recrutement, sur le modèle des scouts de FM26 : staff noté, connaissance des joueurs
// (notes en fourchette tant qu'ils ne sont pas observés), missions, rapports, assistant et draft NBA.
(function () {
  // Bruit stable par joueur : l'estimation ne "clignote" pas d'un écran à l'autre.
  var noise = function (pid, salt) {
    var x = Math.sin(pid * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };

  BM.STAFF_ROLES = {
    assistant: { l: 'Assistant coach', skills: { tac: 'Tactique', dev: 'Développement' } },
    scout: { l: 'Scout', skills: { judgeA: 'Juger le niveau', judgeP: 'Juger le potentiel' } },
    physio: { l: 'Kiné / préparateur', skills: { med: 'Médical' } }
  };
  BM.SCOUT_MAX = 3;

  BM.genStaff = function (g, role, quality) {
    var r = g.rng, s = { id: g.nextId++, role: role, name: r.pick(BM.FIRST_NAMES) + ' ' + r.pick(BM.LAST_NAMES), age: r.int(32, 64), skills: {} };
    Object.keys(BM.STAFF_ROLES[role].skills).forEach(function (k) { s.skills[k] = BM.clamp(Math.round(quality + r.gauss(0, 2)), 4, 20); });
    var avg = Object.keys(s.skills).reduce(function (a, k) { return a + s.skills[k]; }, 0) / Object.keys(s.skills).length;
    s.salary = Math.round(120 * Math.pow(1.17, avg - 8) / 10) * 10; // k$ par saison
    return s;
  };

  BM.initScouting = function (g) {
    var r = g.rng;
    if (!g.staff) {
      g.staff = [BM.genStaff(g, 'assistant', 11), BM.genStaff(g, 'scout', 10), BM.genStaff(g, 'scout', 9), BM.genStaff(g, 'physio', 10)];
    }
    if (!g.staffPool) BM.refreshStaffPool(g);
    if (!g.know) {
      g.know = {};
      Object.keys(g.players).forEach(function (id) {
        var p = g.players[id];
        g.know[id] = p.teamId === g.userTeam ? 100 : p.real ? 60 : p.teamId !== null ? 45 : 20;
      });
    }
    // Les joueurs NBA ont des statistiques publiques : connaissance de base relevée (anciennes sauvegardes comprises).
    if (!g.knowV2) {
      Object.keys(g.players).forEach(function (id) { if (g.players[id].real && g.know[id] < 60) g.know[id] = 60; });
      g.knowV2 = true;
    }
    if (!g.assignments) {
      var sc = g.staff.filter(function (s) { return s.role === 'scout'; });
      g.assignments = {};
      if (sc[0]) g.assignments[sc[0].id] = { type: 'need' };
      if (sc[1]) g.assignments[sc[1].id] = { type: 'draft' };
    }
    if (!g.draftClass) BM.genDraftClass(g);
    if (!g.reports) g.reports = [];
  };

  BM.refreshStaffPool = function (g) {
    g.staffPool = [];
    ['assistant', 'assistant', 'scout', 'scout', 'scout', 'scout', 'physio', 'physio'].forEach(function (role) {
      g.staffPool.push(BM.genStaff(g, role, g.rng.range(7, 17)));
    });
  };

  BM.staffOf = function (g, role) { return (g.staff || []).filter(function (s) { return s.role === role; }); };

  // Effets du staff (équipe de l'utilisateur uniquement ; l'IA est neutre).
  BM.staffBonus = function (g, team, kind) {
    if (!g.staff || team.id !== g.userTeam) return 1;
    var a = BM.staffOf(g, 'assistant')[0], ph = BM.staffOf(g, 'physio')[0];
    if (kind === 'dev') return a ? 0.85 + a.skills.dev / 20 * 0.35 : 0.85;
    if (kind === 'tac') return a ? 0.8 + a.skills.tac / 20 * 0.45 : 0.8;
    if (kind === 'med') return ph ? 1.3 - ph.skills.med / 20 * 0.55 : 1.3; // multiplicateur du risque de blessure
    return 1;
  };

  BM.staffPayroll = function (g) { return (g.staff || []).reduce(function (s, x) { return s + x.salary; }, 0); };

  BM.hireStaff = function (g, staffId) {
    var s = g.staffPool.find(function (x) { return x.id === staffId; });
    if (!s) return 'Candidat indisponible.';
    var same = BM.staffOf(g, s.role);
    var max = s.role === 'scout' ? BM.SCOUT_MAX : 1;
    if (same.length >= max) return 'Poste déjà pourvu : libérez d\'abord un membre du staff (' + BM.STAFF_ROLES[s.role].l.toLowerCase() + ').';
    g.staff.push(s);
    g.staffPool = g.staffPool.filter(function (x) { return x.id !== staffId; });
    return s.name + ' rejoint le staff (' + BM.STAFF_ROLES[s.role].l.toLowerCase() + ').';
  };

  BM.fireStaff = function (g, staffId) {
    var s = g.staff.find(function (x) { return x.id === staffId; });
    if (!s) return '';
    g.staff = g.staff.filter(function (x) { return x.id !== staffId; });
    delete g.assignments[staffId];
    g.teams[g.userTeam].balance -= Math.round(s.salary / 2);
    return s.name + ' quitte le club (indemnité ' + BM.money(Math.round(s.salary / 2)) + ').';
  };

  // ---------------------------------------------------------------- connaissance et estimations
  BM.knowledge = function (g, p) {
    if (!g.know || p.teamId === g.userTeam) return 100;
    return g.know[p.id] === undefined ? 25 : g.know[p.id];
  };

  BM.bestJudge = function (g) {
    var sc = BM.staffOf(g, 'scout');
    if (!sc.length) return { a: 8, p: 8 };
    return { a: Math.max.apply(null, sc.map(function (s) { return s.skills.judgeA; })), p: Math.max.apply(null, sc.map(function (s) { return s.skills.judgeP; })) };
  };

  // Estimation de la note et du potentiel (échelle 1-20) selon la connaissance et le jugement des scouts.
  BM.scoutEstimate = function (g, p) {
    var k = BM.knowledge(g, p);
    if (k >= 100) return { ovr: BM.ovrRaw(p), pot: Math.max(p.pot, BM.ovrRaw(p)), errO: 0, errP: 0, k: 100 };
    var j = BM.bestJudge(g);
    var errO = (100 - k) / 100 * (0.8 + (20 - j.a) / 20 * 1.6);
    var errP = (100 - k) / 100 * (1.4 + (20 - j.p) / 20 * 2.8) + 0.3;
    var o = BM.ovrRaw(p) + noise(p.id, 1) * errO * 0.8;
    var pt = Math.max(p.pot, BM.ovrRaw(p)) + noise(p.id, 2) * errP * 0.8;
    return { ovr: o, pot: Math.max(pt, o), errO: errO, errP: errP, k: k };
  };

  // Texte d'affichage : note exacte, "~78" ou fourchette "72-84".
  BM.estLabel = function (val, err) {
    var v = Math.round(val * 5), e = Math.round(err * 5);
    if (e <= 1) return String(v);
    if (e <= 3) return '~' + v;
    return Math.max(25, v - e) + '-' + Math.min(99, v + e);
  };

  BM.attrLabel = function (g, p, k) {
    var kn = BM.knowledge(g, p);
    if (kn >= 70) return { t: String(p.attrs[k]), v: p.attrs[k] };
    var e = Math.ceil((70 - kn) / 70 * 4);
    var c = BM.clamp(Math.round(p.attrs[k] + noise(p.id, k.length + k.charCodeAt(0)) * e * 0.6), 1, 20);
    return { t: Math.max(1, c - e) + '-' + Math.min(20, c + e), v: c };
  };

  BM.addKnowledge = function (g, p, n) {
    var before = BM.knowledge(g, p);
    g.know[p.id] = Math.min(100, before + n);
    return { before: before, after: g.know[p.id] };
  };

  // ---------------------------------------------------------------- missions des scouts
  BM.ASSIGNMENTS = {
    need: 'Besoins de l\'équipe',
    fa: 'Agents libres',
    draft: 'Prospects de la draft',
    league: 'Toute la NBA',
    conf: 'Conférence adverse'
  };

  BM.assignmentPool = function (g, a) {
    var me = g.teams[g.userTeam];
    var all = Object.keys(g.players).map(function (id) { return g.players[id]; }).filter(function (p) { return !p.retired && p.teamId !== g.userTeam; });
    if (a.type === 'draft') return (g.draftClass || []).map(function (id) { return g.players[id]; });
    if (a.type === 'fa') return all.filter(function (p) { return p.teamId === null && !p.prospect; });
    if (a.type === 'conf') return all.filter(function (p) { return p.teamId !== null && g.teams[p.teamId].conf !== me.conf; });
    if (a.type === 'need') {
      var needs = BM.teamNeeds(g, me).map(function (n) { return n.pos; });
      return all.filter(function (p) { return !p.prospect && needs.indexOf(p.pos) >= 0; });
    }
    return all.filter(function (p) { return !p.prospect && p.teamId !== null; });
  };

  BM.scoutDaily = function (g) {
    if (!g.staff) return;
    BM.staffOf(g, 'scout').forEach(function (s) {
      var a = g.assignments[s.id];
      if (!a) return;
      var pool = BM.assignmentPool(g, a).filter(function (p) { return BM.knowledge(g, p) < 100; });
      if (!pool.length) return;
      // Les scouts privilégient les joueurs prometteurs déjà repérés.
      var p = g.rng.weighted(pool, function (x) { return 1 + Math.max(0, BM.scoutEstimate(g, x).pot - 10); });
      var gain = 10 + (s.skills.judgeA + s.skills.judgeP) / 2;
      var k = BM.addKnowledge(g, p, gain);
      if (k.before < 70 && k.after >= 70) BM.scoutReport(g, p, s);
    });
  };

  BM.gradeFor = function (g, p) {
    var me = g.teams[g.userTeam], est = BM.scoutEstimate(g, p);
    var slot = BM.roster(g, me).filter(function (x) { return x.pos === p.pos; }).map(function (x) { return BM.ovrRaw(x); }).sort(function (a, b) { return b - a; });
    var ref = slot[1] || slot[0] || 10; // comparé au 2e meilleur du poste
    var score = (est.ovr - ref) * 0.7 + (est.pot - est.ovr) * (p.age <= 23 ? 0.5 : 0.1);
    return score >= 2 ? 'A' : score >= 0.7 ? 'B' : score >= -0.7 ? 'C' : 'D';
  };

  BM.GRADE_LABEL = { A: 'Fortement recommandé', B: 'Recommandé', C: 'À surveiller', D: 'Pas au niveau' };

  BM.scoutReport = function (g, p, s) {
    var est = BM.scoutEstimate(g, p), grade = BM.gradeFor(g, p);
    var where = p.prospect ? 'prospect de la draft' : p.teamId === null ? 'agent libre' : g.teams[p.teamId].name;
    var rep = { day: g.day, pid: p.id, scout: s.name, grade: grade };
    g.reports.unshift(rep);
    if (g.reports.length > 40) g.reports.length = 40;
    if (grade === 'A' || grade === 'B') {
      BM.addMessage(g, 'Rapport de scout : ' + BM.fullName(p) + ' (' + grade + ')',
        s.name + ' a observé ' + BM.fullName(p) + ' (' + BM.POS_LABEL[p.pos].toLowerCase() + ', ' + p.age + ' ans, ' + where + ').\n\n' +
        'Niveau estimé : ' + BM.estLabel(est.ovr, est.errO) + ' · potentiel : ' + BM.estLabel(est.pot, est.errP) + ' (' + BM.potentialLabel(est.pot) + ').\n' +
        'Verdict : ' + BM.GRADE_LABEL[grade] + '.', 'scout');
    }
  };

  // ---------------------------------------------------------------- assistant de recrutement
  BM.teamNeeds = function (g, team) {
    var rot = BM.rotationPlayers(g, team), needs = [];
    BM.POSITIONS.forEach(function (pos) {
      var at = BM.roster(g, team).filter(function (p) { return p.pos === pos && !p.gleague; }).map(function (p) { return BM.ovrRaw(p); }).sort(function (a, b) { return b - a; });
      var depth = at.length, top = at[0] || 0;
      var leagueTop = 15;
      if (!depth) needs.push({ pos: pos, w: 3, why: 'Aucun ' + BM.POS_LABEL[pos].toLowerCase() + ' dans l\'effectif.' });
      else if (top < leagueTop - 2) needs.push({ pos: pos, w: 2, why: BM.POS_LABEL[pos] + ' titulaire en dessous du niveau attendu.' });
      else if (depth < 2) needs.push({ pos: pos, w: 1, why: 'Manque de profondeur au poste de ' + BM.POS_LABEL[pos].toLowerCase() + '.' });
    });
    var sys = BM.SYSTEMS[team.tactics.system];
    var roles = rot.map(function (p) { return BM.roleOf(team, p); });
    sys.roles.slice(0, 3).forEach(function (r) {
      if (roles.indexOf(r) < 0) {
        var pos = BM.ROLES[r].pos[BM.ROLES[r].pos.length > 2 ? 1 : 0];
        needs.push({ pos: pos, role: r, w: 1.5, why: 'Votre système (' + sys.l + ') réclame un profil « ' + BM.ROLES[r].l + ' ».' });
      }
    });
    return needs.sort(function (a, b) { return b.w - a.w; }).slice(0, 4);
  };

  BM.assistantTargets = function (g, n) {
    var me = g.teams[g.userTeam], needs = BM.teamNeeds(g, me), room = me.wageBudget - BM.payroll(g, me);
    var mine = BM.roster(g, me).filter(function (p) { return !p.gleague; });
    var refAt = function (pos) {
      var v = mine.filter(function (x) { return x.pos === pos; }).map(function (x) { return BM.ovrRaw(x); }).sort(function (a, b) { return b - a; });
      return v[1] || v[0] || 8; // à battre : le 2e meilleur du poste
    };
    var out = [];
    Object.keys(g.players).forEach(function (id) {
      var p = g.players[id];
      if (p.retired || p.prospect || p.teamId === g.userTeam) return;
      var access;
      if (p.teamId === null) {
        if (BM.askingSalary(p) > Math.max(room, BM.MIN_EXCEPTION)) return;
        access = 'Signable';
      } else {
        if (BM.rankInTeam(g, p) < 2 && !p.listed) return; // joueurs franchise : intouchables
        access = BM.playerValue(p) <= me.balance && p.contract.salary <= Math.max(room, BM.MIN_EXCEPTION) ? 'Rachat possible' : 'Échange';
      }
      var est = BM.scoutEstimate(g, p), need = needs.find(function (x) { return x.pos === p.pos; });
      var gain = est.ovr - refAt(p.pos);
      if (gain < 0.3 && !(p.age <= 23 && est.pot - refAt(p.pos) > 2)) return;
      var roleFit = need && need.role ? BM.roleStars(p, need.role) / 5 : 0;
      var score = gain + (p.age <= 24 ? (est.pot - est.ovr) * 0.3 : 0) + (need ? need.w * 0.6 : 0) + roleFit;
      score *= { Signable: 1.25, 'Rachat possible': 1.1, 'Échange': 0.85 }[access] * (0.85 + BM.knowledge(g, p) / 700);
      out.push({ p: p, est: est, score: score, need: need, access: access, gain: gain });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).slice(0, n || 10);
  };

  // ---------------------------------------------------------------- draft
  BM.genDraftClass = function (g) {
    var r = g.rng, ids = [];
    for (var i = 0; i < 70; i++) {
      var tier = i < 4 ? 13.5 : i < 14 ? 12.3 : i < 30 ? 11.2 : 9.8;
      var p = BM.genPlayer(g, { quality: tier + r.gauss(0, 1), age: r.int(19, 22), teamId: null, years: 1 });
      p.prospect = true;
      p.pot = Math.min(19.6, BM.ovrRaw(p) + (p.age <= 20 ? r.range(2.5, 6.5) : r.range(1, 4)));
      p.college = r.pick(['Duke', 'Kentucky', 'Kansas', 'UCLA', 'Michigan', 'UConn', 'Arizona', 'Baylor', 'Gonzaga', 'Real Madrid', 'Partizan', 'ASVEL', 'Ignite', 'NBL Next Stars', 'Villanova', 'Texas', 'Auburn', 'Houston']);
      if (g.know) g.know[p.id] = 0;
      ids.push(p.id);
    }
    g.draftClass = ids;
  };

  // Ordre de draft : non qualifiés du pire au meilleur bilan, loterie sur les 4 premiers choix, puis les qualifiés.
  BM.draftOrder = function (g) {
    var st = BM.standings(g).slice().reverse(), r = g.rng;
    var poIds = g.playoffs ? [].concat(g.playoffs.seeds.E || [], g.playoffs.seeds.W || []) : [];
    var lottery = st.filter(function (t) { return poIds.indexOf(t.id) < 0; });
    var rest = st.filter(function (t) { return poIds.indexOf(t.id) >= 0; });
    var odds = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];
    var pool = lottery.map(function (t, i) { return { t: t, w: odds[i] || 5 }; }), top = [];
    for (var k = 0; k < 4 && pool.length; k++) {
      var pick = r.weighted(pool, function (x) { return x.w; });
      top.push(pick.t);
      pool = pool.filter(function (x) { return x !== pick; });
    }
    var round1 = top.concat(pool.map(function (x) { return x.t; })).concat(rest);
    return round1.concat(round1).map(function (t, i) { return { pick: i + 1, round: i < round1.length ? 1 : 2, team: t.id }; });
  };

  BM.startDraft = function (g) {
    g.draft = { order: BM.draftOrder(g), next: 0, picks: [] };
    var me = g.draft.order.filter(function (x) { return x.team === g.userTeam; }).map(function (x) { return x.pick; });
    BM.addMessage(g, 'Draft ' + (2026 + g.season), 'La loterie est tirée. Vos choix : n°' + me.join(' et n°') + '. Préparez votre big board !', 'scout');
  };

  BM.rookieScale = function (pick) {
    if (pick > 30) return { salary: 1300, years: 2 };
    return { salary: Math.round((13000 - (pick - 1) * 370) / 50) * 50, years: 4 };
  };

  BM.draftPlayer = function (g, pid) {
    var d = g.draft, slot = d.order[d.next], p = g.players[pid];
    var team = g.teams[slot.team], sc = BM.rookieScale(slot.pick);
    p.prospect = false; p.rookie = true;
    p.contract = { salary: sc.salary, years: sc.years };
    p.teamId = null;
    BM.addToTeam(g, p, team);
    g.draftClass = g.draftClass.filter(function (id) { return id !== pid; });
    d.picks.push({ pick: slot.pick, round: slot.round, team: team.id, pid: pid });
    if (team.id === g.userTeam) g.know[pid] = 100;
    d.next++;
  };

  // L'IA choisit le meilleur prospect (vraie valeur + bruit) ; s'arrête au choix de l'utilisateur.
  BM.draftAdvance = function (g) {
    var d = g.draft;
    while (d.next < d.order.length && d.order[d.next].team !== g.userTeam) {
      var avail = g.draftClass.map(function (id) { return g.players[id]; });
      if (!avail.length) { d.next = d.order.length; break; }
      var best = avail.map(function (p) { return { p: p, v: p.pot * 0.7 + BM.ovrRaw(p) * 0.3 + g.rng.gauss(0, 0.8) }; }).sort(function (a, b) { return b.v - a.v; })[0];
      BM.draftPlayer(g, best.p.id);
    }
    return d.next < d.order.length;
  };

  BM.finishDraft = function (g) {
    // Les prospects non draftés deviennent agents libres.
    (g.draftClass || []).forEach(function (id) { var p = g.players[id]; p.prospect = false; g.freeAgents.push(id); });
    g.draftClass = [];
    g.draft.done = true;
  };
})();
