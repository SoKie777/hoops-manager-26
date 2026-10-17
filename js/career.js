var BM = globalThis.BM = globalThis.BM || {};

// Mode « Ma Carrière » : un joueur, de prospect de 19 ans à la retraite, dans la vraie ligue de Hoops Manager.
// La ligue tourne normalement (IA des franchises, matchs, playoffs, draft) ; ce module gère la vie du joueur.
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  BM.cPlayer = function (g) { return g.career ? g.players[g.career.pid] : null; };
  BM.cTeam = function (g) { var p = BM.cPlayer(g); return p && p.teamId !== null ? g.teams[p.teamId] : null; };

  // ==================================================================== création
  BM.newCareer = function (o) {
    var g = BM.newGame({ seed: o.seed, teamId: 0, managerName: o.first + ' ' + o.last });
    g.mode = 'career';
    g.userTeam = -1;
    g.inbox = [];
    var rng = g.rng, path = BM.CAREER_PATHS[o.path] || BM.CAREER_PATHS.ncaa;
    var p = BM.genPlayer(g, { first: o.first, last: o.last, pos: o.pos, age: 19, quality: 11, teamId: null, years: 1 });
    var arch = (BM.CAREER_ARCH[o.pos] || BM.CAREER_ARCH.AIL).find(function (x) { return x.id === o.arch; }) || BM.CAREER_ARCH[o.pos][0];
    Object.keys(arch.b).forEach(function (k) { p.attrs[k] = clamp(p.attrs[k] + arch.b[k], 1, 20); });
    Object.keys(arch.m).forEach(function (k) { p.attrs[k] = clamp(p.attrs[k] + arch.m[k], 1, 20); });
    if (o.trait === 'leader') p.attrs.lead = clamp(p.attrs.lead + 2, 1, 20);
    if (o.trait === 'calme') p.attrs.sf = clamp(p.attrs.sf + 3, 1, 20);
    BM.fitOverall(p, 61); // profil de prospect : environ 61 à 19 ans
    p.pot = clamp(rng.range(16.2, 17.8) + (o.trait === 'travail' ? 0.5 : 0), 15, 19.4);
    p.number = o.num || rng.int(0, 45);
    p.prospect = true;
    p.college = rng.pick(path.teams);
    p.badges = {};
    p.morale = 70;
    p.career = [];
    g.draftClass = (g.draftClass || []).concat([p.id]);
    if (g.know) g.know[p.id] = 100;
    var C = g.career = {
      pid: p.id, phase: 'prospect', path: o.path, arch: arch.id, trait: o.trait, home: o.home || '',
      health: 92, money: 120, followers: 20000, rep: 5, confCoach: 55, confMates: 50, work: o.trait === 'travail' ? 65 : 50, pp: 0,
      repMult: o.trait === 'showman' ? 1.3 : 1, partyMult: o.trait === 'fetard' ? 2 : 1,
      xp: {}, cnt: { tpm: 0, midm: 0, rimm: 0, ast: 0, blk: 0, stl: 0, reb: 0, clutch: 0, min: 0 },
      rel: [{ id: 'mere', l: 'Ta mère', v: 85 }, { id: 'frere', l: rng.pick(BM.CAREER_FIRST) + ', ton petit frère', v: 75 },
        { id: 'ami', l: rng.pick(BM.CAREER_FIRST) + ', ton ami d\'enfance', v: 80 }, { id: 'agent', l: rng.pick(BM.CAREER_FIRST) + ' ' + rng.pick(BM.LAST_NAMES) + ', ton agent', v: 60 }],
      partner: null, kids: 0, assets: {}, staff: {}, inv: { immo: 0, bourse: 0, crypto: 0 }, media: {},
      sponsors: [], spOffers: [], feed: [], press: [], log: [], cine: [],
      training: { focus: 'shoot', inten: 'normal' }, ment: 'equil', demand: null,
      seasons: [], rings: 0, allStars: 0, gw: 0, decisions: 0,
      today: null, weekStart: g.day, prospect: null, status: 'banc'
    };
    if (o.trait === 'leader') C.confMates += 10;
    // Calendrier du prospect : un match tous les 5 jours pendant la saison NBA, puis le tournoi final.
    var sched = [];
    for (var i = 0; i < path.games; i++) sched.push(BM.LEAGUE_START + 3 + i * 5);
    var last = sched[sched.length - 1];
    for (var k = 1; k <= 3; k++) sched.push(last + 6 + k * 3);
    C.prospect = { sched: sched, games: [], w: 0, l: 0, cup: 0, workouts: 0, combine: null, stock: 0 };
    BM.careerNewDemand(g);
    BM.clog(g, 'Signe à ' + p.college + ' (' + path.l + '). Objectif : la draft.');
    BM.careerDayStart(g);
    return g;
  };

  BM.clog = function (g, t) {
    var C = g.career;
    C.log.unshift({ day: g.day, s: g.season, t: t });
    if (C.log.length > 160) C.log.length = 160;
  };
  BM.cfeed = function (g, who, h, t, mine, likes) {
    var C = g.career;
    C.feed.unshift({ day: g.day, who: who, h: h, t: t, mine: !!mine, likes: likes || Math.round(C.followers * (0.004 + g.rng.next() * 0.01) + 200) });
    if (C.feed.length > 50) C.feed.length = 50;
  };
  BM.cpress = function (g, out, t, s, tone) {
    var C = g.career;
    C.press.unshift({ day: g.day, out: out, t: t, s: s, tone: tone || '=' });
    if (C.press.length > 50) C.press.length = 50;
  };
  var rel = function (C, id) { return C.rel.find(function (r) { return r.id === id; }); };
  var relAdd = function (C, id, x) { var r = rel(C, id); if (r) r.v = clamp(r.v + x, 0, 100); };
  BM.cRel = rel;
  var firstName = function (C, id) { var r = rel(C, id); return r ? r.l.split(',')[0].split(' ')[0] : ''; };

  // Valeurs bornées après chaque action.
  BM.careerNormalize = function (g) {
    var C = g.career, p = BM.cPlayer(g);
    ['rep', 'confCoach', 'confMates', 'health', 'work'].forEach(function (k) { C[k] = clamp(C[k], 0, 100); });
    p.morale = clamp(p.morale, C.staff.mental ? 35 : 0, 100);
    p.condition = clamp(p.condition, 5, 100);
    C.followers = Math.max(0, Math.round(C.followers));
    C.rel.forEach(function (r) { r.v = clamp(r.v, 0, 100); });
    if (C.partner) C.partner.v = clamp(C.partner.v, 0, 100);
    C.money = Math.round(C.money * 10) / 10;
  };

  // ==================================================================== progression des attributs
  // Les gains s'accumulent en fraction (C.xp) : un point d'attribut entier dès que la réserve atteint 1.
  BM.careerGain = function (g, k, amount) {
    var C = g.career, p = BM.cPlayer(g);
    // Rendements décroissants : passer de 12 à 13 est facile, de 18 à 19 beaucoup moins.
    if (amount > 0) amount *= clamp((21 - p.attrs[k]) / 9, 0.08, 1.3);
    C.xp[k] = (C.xp[k] || 0) + amount;
    var changed = 0;
    while (C.xp[k] >= 1 && p.attrs[k] < 20) { C.xp[k] -= 1; p.attrs[k]++; changed++; p.lastProgress = { k: k, day: g.day }; }
    while (C.xp[k] <= -1 && p.attrs[k] > 1) { C.xp[k] += 1; p.attrs[k]--; changed--; }
    if (p.attrs[k] >= 20 && C.xp[k] > 0) C.xp[k] = 0;
    return changed;
  };

  // Facteur de progression : âge, marge de potentiel, éthique de travail.
  BM.careerGrowth = function (g) {
    var C = g.career, p = BM.cPlayer(g), o = BM.ovrRaw(p);
    var ageF = p.age <= 21 ? 1.3 : p.age <= 24 ? 1.15 : p.age <= 27 ? 0.85 : p.age <= 30 ? 0.45 : 0.15;
    var potF = o < p.pot ? clamp((p.pot - o) / 2.4, 0.25, 1.2) : 0.12;
    return ageF * potF * (0.8 + C.work / 250) * (C.trait === 'travail' ? 1.15 : 1) * (C.assets.gym ? 1.1 : 1);
  };

  BM.careerTrain = function (g, mult) {
    var C = g.career, f = BM.CAREER_FOCUS[C.training.focus], out = {};
    var path = C.phase === 'prospect' ? BM.CAREER_PATHS[C.path].train : 1;
    var st = (C.training.focus === 'shoot' && C.staff.tir) || ((C.training.focus === 'create' || C.training.focus === 'finish') && C.staff.skills) ? 1.25 : 1;
    var dB = C.demand && C.training.focus === C.demand.f ? 1.15 : 1;
    var eF = BM.cPlayer(g).condition < 30 ? 0.45 : 1;
    f.a.forEach(function (k, i) {
      var amt = (i === 0 ? 0.016 : 0.011) * mult * BM.careerGrowth(g) * path * st * dB * eF * (0.8 + g.rng.next() * 0.4);
      out[k] = amt;
      BM.careerGain(g, k, amt);
    });
    return out;
  };

  // Points de progression : coût d'un point d'attribut.
  BM.careerPPCost = function (g, k) {
    var p = BM.cPlayer(g), v = p.attrs[k];
    return Math.round((6 + v * 1.4) * (BM.ovrRaw(p) >= p.pot ? 2 : 1) * (p.age >= 30 ? 1.5 : 1));
  };
  BM.careerSpendPP = function (g, k) {
    var C = g.career, p = BM.cPlayer(g), c = BM.careerPPCost(g, k);
    if (C.pp < c || p.attrs[k] >= 20) return false;
    C.pp -= c; p.attrs[k]++; p.lastProgress = { k: k, day: g.day };
    BM.clog(g, BM.ATTRS.find(function (a) { return a.k === k; }).l + ' +1 (points de progression).');
    return true;
  };

  // ==================================================================== statut dans l'équipe
  BM.careerRank = function (g) {
    var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
    if (!t) return 9;
    var mine = BM.ovrRaw(p) + (C.confCoach - 50) * 0.03;
    return 1 + BM.roster(g, t).filter(function (x) { return x !== p && BM.ovrRaw(x) > mine; }).length;
  };
  BM.careerComputeStatus = function (g) {
    var C = g.career, p = BM.cPlayer(g), rank = BM.careerRank(g), old = C.status;
    var st = rank === 1 ? (BM.ovr(p) >= 86 && C.rep >= 55 ? 'star' : 'first') : rank === 2 ? 'second' : rank <= 5 ? 'role' : rank <= 8 ? 'rot' : 'banc';
    C.status = st; C.rank = rank;
    if (old && st !== old && C.phase === 'nba') {
      var up = BM.CAREER_STATUS_ORDER.indexOf(st) > BM.CAREER_STATUS_ORDER.indexOf(old);
      p.morale += up ? 5 : -5;
      BM.clog(g, 'Nouveau statut : ' + BM.CAREER_STATUS[st].l + '.');
      return { old: old, now: st, up: up };
    }
    return null;
  };
  BM.careerMinutes = function (g) {
    var C = g.career, p = BM.cPlayer(g);
    return clamp(BM.CAREER_STATUS[C.status].min * (0.9 + p.attrs.end / 200) + (C.confCoach - 50) * 0.08 + ((p.badges || {}).moteur || 0) * 0.5, 4, 40);
  };

  // Avant chaque match de l'équipe : le coach (IA) fixe la rotation, en tenant compte du statut du joueur.
  BM.careerPrepareMatch = function (g) {
    var t = BM.cTeam(g), p = BM.cPlayer(g), C = g.career;
    if (!t) return;
    BM.autoTactics(g, t);
    BM.careerComputeStatus(g);
    if (p.injury > 0 || C.suspended) { delete t.tactics.minutes[p.id]; t.tactics.starters = t.tactics.starters.filter(function (id) { return id !== p.id; }); return; }
    t.tactics.minutes[p.id] = Math.round(BM.careerMinutes(g));
    var starters = t.tactics.starters, isStarter = starters.indexOf(p.id) >= 0;
    if (C.rank <= 5 && !isStarter) {
      var same = starters.map(function (id) { return g.players[id]; }).filter(function (x) { return x.pos === p.pos; })[0];
      var worst = same || starters.map(function (id) { return g.players[id]; }).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
      starters[starters.indexOf(worst.id)] = p.id;
    } else if (C.rank > 6 && isStarter) {
      starters.splice(starters.indexOf(p.id), 1);
    }
  };

  // ==================================================================== objectif du coach
  BM.careerNewDemand = function (g) {
    var p = BM.cPlayer(g), w = BM.POS_WEIGHTS[p.pos];
    var best = Object.keys(BM.CAREER_FOCUS).map(function (f) {
      var s = BM.CAREER_FOCUS[f].a.reduce(function (x, k) { return x + (w[k] || 0.3) * Math.max(1, 18 - p.attrs[k]); }, 0) / 3;
      return { f: f, s: s * (0.75 + g.rng.next() * 0.5) };
    }).sort(function (a, b) { return b.s - a.s; })[0].f;
    g.career.demand = { f: best, left: 4, done: 0 };
  };

  // ==================================================================== journée
  BM.careerTeamGameToday = function (g) {
    var t = BM.cTeam(g);
    if (!t) return null;
    return g.fixtures.find(function (f) { return f.day === g.day && !f.played && (f.home === t.id || f.away === t.id); }) || null;
  };
  BM.careerProspectGameToday = function (g) {
    var C = g.career;
    if (C.phase !== 'prospect' || !C.prospect) return false;
    return C.prospect.sched.indexOf(g.day) >= 0 && !C.prospect.games.some(function (x) { return x.day === g.day; });
  };
  BM.careerIsGameDay = function (g) { return !!BM.careerTeamGameToday(g) || BM.careerProspectGameToday(g); };

  var AMBIENT = ['Grand soleil ce matin.', 'Le réveil sonne trop tôt.', 'Un café, deux bananes, et c\'est parti.', 'Petit-déjeuner en silence, casque sur les oreilles.', 'Ciel gris ce matin.', 'Il pleut sur la ville.'];

  // Matin : entraînement (ou shootaround les jours de match), rééducation si blessé.
  BM.careerDayStart = function (g) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng, msgs = [];
    if (g.day - C.weekStart >= 7) { C.weekStart = g.day; BM.careerWeekly(g).forEach(function (m) { msgs.push(m); }); }
    // Sans franchise NBA (prospect), la ligue ne gère pas sa récupération : on la fait ici.
    if (p.teamId === null) {
      if (p.injury > 0) p.injury--;
      p.condition = Math.min(100, p.condition + 10 + p.attrs.end / 20 * 3);
      p.morale += p.morale > 65 ? -0.5 : 0.5;
    }
    msgs.unshift(r.pick(AMBIENT) + ' Tu as dormi ' + clamp(Math.round(4.5 + p.condition / 22 + r.range(-1, 1)), 4, 10) + ' h. ' + r.int(12, 95) + ' notifications.');
    var game = BM.careerIsGameDay(g);
    var I = BM.CAREER_INTENS[C.training.inten];
    if (p.injury > 0) { msgs.push('Rééducation avec le staff médical (' + p.injury + ' j d\'absence). Pas d\'entraînement.'); C.health += 2; }
    else if (game) { msgs.push('Jour de match : shootaround léger et mise en place.'); }
    else if (g.phase === 'done' || g.phase === 'offseason') { msgs.push('Pas d\'entraînement collectif : travail individuel.'); BM.careerTrain(g, 0.5); }
    else {
      var gains = BM.careerTrain(g, I.m);
      p.condition -= I.e;
      msgs.push('Entraînement ' + BM.CAREER_FOCUS[C.training.focus].l.toLowerCase() + ' (' + I.l.toLowerCase() + ') : ' + BM.careerGainTxt(gains) + '.');
      C.trainedThisWeek = (C.trainedThisWeek || 0) + 1;
      if (C.demand && C.training.focus === C.demand.f) C.demand.hit = (C.demand.hit || 0) + 1;
      var inj = (I.inj + (p.condition < 25 ? 0.02 : 0)) * (1 + Math.max(0, 60 - C.health) / 40) * (C.staff.physio ? 0.6 : 1);
      if (r.chance(inj)) { p.injury = r.int(3, 9); C.health -= 6; msgs.push('Blessure à l\'entraînement : ' + p.injury + ' jours d\'absence.'); BM.clog(g, 'Blessé à l\'entraînement (' + p.injury + ' j).'); }
    }
    C.today = { day: g.day, morning: msgs, act: null, evening: null, event: null };
    BM.careerNormalize(g);
  };

  BM.careerGainTxt = function (gains) {
    return Object.keys(gains).map(function (k) { return BM.ATTRS.find(function (a) { return a.k === k; }).l + ' +' + gains[k].toFixed(2).replace('.', ','); }).join(', ');
  };

  // ==================================================================== activités du soir
  BM.careerDoActivity = function (g, id) {
    var C = g.career, T = C.today;
    if (!T || T.act) return null;
    var act = BM.CAREER_ACTS.find(function (a) { return a.id === id; });
    if (!act) return null;
    if (act.c && C.money < act.c) return { msgs: ['Pas assez d\'argent (' + BM.money(act.c) + ').'], fail: true };
    if (id === 'coachtalk' && C.lastCoachTalk && g.day - C.lastCoachTalk < 7) return { msgs: ['Le coach t\'a déjà reçu cette semaine.'], fail: true };
    if (act.c) C.money -= act.c;
    var msgs = [BM.careerOffcourt(g, id)];
    var tomorrowGame = BM.careerTomorrowGame(g);
    if (tomorrowGame && id === 'soiree') { BM.cPlayer(g).condition -= 8; msgs.push('Une fête la veille d\'un match : tes jambes le sentiront.'); }
    T.act = id; T.evening = msgs;
    C.weekActs = (C.weekActs || []).concat([id]);
    BM.careerNormalize(g);
    var ev = BM.careerDrawEvent(g);
    if (ev) T.event = ev;
    return { msgs: msgs, event: ev };
  };

  BM.careerTomorrowGame = function (g) {
    var C = g.career, t = BM.cTeam(g), d = g.day + 1;
    if (C.phase === 'prospect') return C.prospect.sched.indexOf(d) >= 0;
    return !!t && g.fixtures.some(function (f) { return f.day === d && (f.home === t.id || f.away === t.id); });
  };

  BM.careerOffcourt = function (g, id) {
    var C = g.career, p = BM.cPlayer(g), a = p.attrs, r = g.rng, mates = BM.careerMates(g);
    switch (id) {
      case 'repos': p.condition += 18; p.morale += 2; C.health += 2; return 'Repos complet. Énergie +18.';
      case 'spa': p.condition += 24; C.health += 4; return 'Cryothérapie, kiné, sommeil. Le corps dit merci.';
      case 'cuisine': C.health += 3; p.condition += 5; return 'Poisson, riz complet, légumes. Ton corps te remercie.';
      case 'shootnight': {
        var g3 = 0.06 * BM.careerGrowth(g), gm = 0.035 * BM.careerGrowth(g);
        BM.careerGain(g, 'tir3', g3); BM.careerGain(g, 'tirMi', gm); p.condition -= 8; C.work += 1;
        return '500 tirs, salle vide, minuit passé. Le geste se grave (tir à 3 pts +' + g3.toFixed(2).replace('.', ',') + ').';
      }
      case 'video': BM.careerGain(g, 'qi', 0.05 * BM.careerGrowth(g)); C.confCoach += 1.5; p.condition -= 3; return 'Deux heures de vidéo avec le staff. Lecture du jeu en hausse.';
      case 'perso': {
        if (p.injury > 0) { C.health += 4; return 'Ton coach perso t\'accompagne en rééducation. Santé +4.'; }
        var gp = BM.careerTrain(g, 0.45 * BM.CAREER_INTENS[C.training.inten].m); p.condition -= 5;
        return 'Séance privée avec ton coach perso : ' + BM.careerGainTxt(gp) + '.';
      }
      case 'coachtalk': {
        C.lastCoachTalk = g.day;
        if (C.phase === 'prospect') { C.confCoach += 3; return 'Ton coach te rassure : les scouts NBA viennent pour toi.'; }
        if (C.status === 'star') { C.confCoach += 2; return 'Le coach te consulte sur le plan de jeu. Tu es déjà le patron.'; }
        var t = BM.cTeam(g), above = BM.roster(g, t).filter(function (x) { return x !== p; }).sort(function (x, y) { return BM.ovrRaw(y) - BM.ovrRaw(x); })[Math.max(0, (C.rank || 9) - 2)];
        var gap = above ? BM.ovrRaw(p) - BM.ovrRaw(above) : 1;
        var pr = clamp(0.35 + gap * 0.25 + (C.confCoach - 50) / 150 + (a.lead - 10) / 60, 0.05, 0.9);
        if (r.chance(pr)) { C.confCoach += 7; return 'Tu plaides ta cause, chiffres à l\'appui. Le coach t\'entend : plus de responsabilités à venir.'; }
        C.confCoach -= 4; p.morale -= 2; return '« Montre-le-moi sur le terrain d\'abord. » Le coach n\'a pas apprécié.';
      }
      case 'mates': C.confMates += 4; p.condition -= 5; p.morale += 3; return 'Bowling et dîner avec l\'équipe. L\'entente progresse.';
      case 'soiree': {
        p.morale += 6 * C.partyMult; p.condition -= 18; C.health -= 2; C.followers += C.followers * 0.01 + 500; C.work -= 1;
        if (C.partner && r.chance(0.15)) { C.partner.v -= 10; return C.partner.name + ' n\'a pas aimé te voir rentrer à 4 h. Ça a crié.'; }
        if (r.chance(0.2)) { C.rep -= 2; C.confCoach -= 3; return 'Des photos de ta soirée tournent sur les réseaux. Le coach n\'apprécie pas.' + BM.careerSponsorHit(g, 'disc', true); }
        if (C.partyMult < 2 && r.chance(0.15)) { C.confCoach -= 4; return 'Tu arrives en retard à l\'entraînement le lendemain. Confiance du coach −4.'; }
        return 'Grosse soirée. Le moral est au top, les jambes un peu moins.';
      }
      case 'date':
        if (C.partner) { C.partner.v += 9; p.morale += 4; return 'Soirée en tête-à-tête avec ' + C.partner.name + '. Votre relation se renforce.'; }
        if (r.chance(0.35 + C.rep / 250)) { C.pendingMeet = { a: r.pick(BM.CAREER_FIRST_F), b: r.pick(BM.CAREER_FIRST) }; return 'Deux rencontres ont retenu ton attention cette semaine.'; }
        p.morale -= 1; return 'Le rendez-vous tombe à plat. Pas d\'étincelle.';
      case 'ami': relAdd(C, 'ami', 10); p.morale += 3; p.condition -= 2; return 'Après-midi avec ' + firstName(C, 'ami') + ', comme avant. Ça remet les pieds sur terre.';
      case 'famille': relAdd(C, 'mere', 7); relAdd(C, 'frere', 7); if (C.partner) C.partner.v += 4; p.morale += 4; p.condition += 3; return 'Une longue soirée au téléphone avec ta mère et ton frère. Ça recentre.';
      case 'culte': p.morale += 5; BM.careerGain(g, 'sf', 0.06); BM.careerGain(g, 'lead', 0.06); p.condition += 3; C.health += 1; return 'Une heure de louange et de prière. Tu repars apaisé.';
      case 'lecture': BM.careerGain(g, 'qi', 0.06 * BM.careerGrowth(g)); C.work += 0.5; p.condition += 2; return 'Un livre sur les grands meneurs d\'hommes. Quelques pages qui restent.';
      case 'console': p.morale += 3; p.condition += 4; C.confMates += 1; return 'En ligne avec ' + (mates.length ? BM.shortName(r.pick(mates)) : 'tes potes') + ' jusqu\'à minuit. Il t\'a battu deux fois.';
      case 'shopping': { p.morale += 5; var gf = C.followers * 0.005 + 1500; C.followers += gf; return 'Nouvelle montre, nouvelle veste. La story fait réagir : +' + BM.fmtN(gf) + ' followers.'; }
      case 'media': {
        var gm2 = (C.followers * 0.02 + 2000) * C.repMult; C.followers += gm2; C.rep += 0.8 * C.repMult;
        C.sponsors.forEach(function (s) { s.postsW = (s.postsW || 0) + 1; });
        if (r.chance(0.15)) { C.rep -= 2; C.confMates -= 3; return 'Une phrase sortie de son contexte fait polémique dans le vestiaire.' + BM.careerSponsorHit(g, 'humble'); }
        return 'Shooting photo et live. +' + BM.fmtN(gm2) + ' followers.';
      }
      case 'charite': C.rep += 1.2 * C.repMult; BM.careerGain(g, 'lead', 0.08); p.morale += 3; return 'Clinic gratuit pour les jeunes. Réputation et leadership en hausse.';
    }
    return '';
  };
  BM.fmtN = function (n) { return Math.round(n).toLocaleString('fr-FR'); };

  BM.careerMates = function (g) {
    var t = BM.cTeam(g), p = BM.cPlayer(g);
    return t ? BM.roster(g, t).filter(function (x) { return x !== p; }) : [];
  };

  // ==================================================================== semaine
  BM.careerWeekly = function (g) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng, msgs = [];
    var up = 0;
    Object.keys(C.assets).forEach(function (id) { up += BM.CAREER_ASSETS.find(function (x) { return x.id === id; }).up; });
    Object.keys(C.staff).forEach(function (id) { up += BM.CAREER_STAFF.find(function (x) { return x.id === id; }).c; });
    C.money -= up;
    C.money += C.sponsors.reduce(function (s, c) { return s + c.pay; }, 0);
    if (C.assets.resto) C.money += r.chance(0.68) ? r.int(10, 45) : -r.int(10, 35);
    if (C.assets.appart) p.morale += 1;
    if (C.assets.villa) { p.morale += 2; relAdd(C, 'mere', 1); relAdd(C, 'frere', 1); }
    if (C.assets.voiture) C.followers += C.followers * 0.003 + 300;
    if (C.assets.recup) { p.condition += 6; C.health += 1; }
    if (C.assets.fondation) { C.rep += 0.3; BM.careerGain(g, 'lead', 0.03); }
    if (C.assets.maisonfamille) relAdd(C, 'mere', 3);
    if (C.staff.nutri) { p.condition += 6; C.health += 1; }
    Object.keys(BM.CAREER_INV).forEach(function (k) { if (C.inv[k] > 0) C.inv[k] = Math.max(0, C.inv[k] * (1 + BM.CAREER_INV[k].mu + r.gauss(0, 1) * BM.CAREER_INV[k].sd)); });
    C.rel.forEach(function (x) { x.v -= x.id === 'agent' ? 0.5 : 1.1; });
    if (C.partner) { C.partner.v -= 1.4; C.partner.weeks++; }
    var fam = C.rel.filter(function (x) { return x.id === 'mere' || x.id === 'frere'; }).map(function (x) { return x.v; });
    if (C.partner) fam.push(C.partner.v);
    p.morale += (fam.reduce(function (s, x) { return s + x; }, 0) / fam.length - 60) / 40 + 0.5 * C.kids;
    C.health += (85 - C.health) * 0.05;
    var fcap = 60000 + C.rep * C.rep * 900;
    if (C.followers > fcap) C.followers -= (C.followers - fcap) * 0.5;
    C.pp += 1;
    // Éthique de travail : intensité, fêtes, séances en plus.
    var acts = C.weekActs || [];
    var wt = C.training.inten === 'intense' ? 84 : C.training.inten === 'normal' ? 66 : 40;
    wt -= 12 * acts.filter(function (x) { return x === 'soiree'; }).length;
    wt += 4 * acts.filter(function (x) { return x === 'perso' || x === 'shootnight'; }).length;
    C.work += (clamp(wt, 0, 100) - C.work) * 0.08;
    // Objectif du coach.
    if (C.demand) {
      if ((C.demand.hit || 0) >= 2) { C.demand.done++; C.confCoach += 1.2; } else if (C.trainedThisWeek) C.confCoach -= 0.4;
      C.demand.hit = 0; C.demand.left--;
      if (C.demand.left <= 0) {
        if (C.demand.done >= 3) { C.confCoach += 6; C.pp += 4; msgs.push('Objectif du coach rempli : confiance du coach +6, +4 PP.'); }
        else { C.confCoach -= 4; msgs.push('Objectif du coach non rempli : confiance du coach −4.'); }
        BM.careerNewDemand(g);
        msgs.push('Nouvel objectif du coach : ' + BM.CAREER_FOCUS[C.demand.f].l + '.');
      }
    }
    C.trainedThisWeek = 0;
    BM.careerSponsorWeekly(g, acts).forEach(function (m) { msgs.push(m); });
    C.weekActs = [];
    msgs.push('Nouvelle semaine : +1 PP.');
    BM.careerNormalize(g);
    return msgs;
  };

  // Salaire mensuel (et revenus du prospect).
  BM.careerPayday = function (g) {
    var C = g.career, p = BM.cPlayer(g);
    if (BM.dateOf(g, g.day).getUTCDate() !== 1) return;
    if (C.phase === 'nba' && p.teamId !== null) C.money += p.contract.salary / 12;
    else if (C.phase === 'prospect') C.money += BM.CAREER_PATHS[C.path].pay / 10;
  };

  // ==================================================================== avancer
  // Termine la journée en cours. Renvoie l'état suivant pour l'interface.
  BM.careerNext = function (g) {
    var C = g.career;
    if (C.phase === 'retired' || C.phase === 'coach') return { state: 'retired' };
    if (C.today && C.today.event) return { state: 'event' };
    if (BM.careerProspectGameToday(g)) return { state: 'prospectGame' };
    var r = BM.advance(g);
    if (r.state === 'match') { BM.careerPrepareMatch(g); return { state: 'match', fx: r.fx }; }
    if (r.state === 'draft') return { state: 'draft' };
    // La ligue enchaîne directement sur la fin de saison : la draft du prospect passe avant.
    if (r.state === 'seasonEnd' && C.phase === 'prospect') return { state: 'draft' };
    if (r.state === 'seasonEnd') return { state: 'seasonEnd' };
    if (r.state === 'seasonSummary') return { state: 'offseason' };
    if (r.state !== 'ok') return r;
    // La journée s'est terminée (matchs de la ligue joués) : nouveau jour.
    BM.careerPayday(g);
    BM.careerTradeCheck(g);
    if (C.suspended && !BM.careerTeamGameToday(g)) { /* suspension purgée au prochain match */ }
    BM.careerDayStart(g);
    return { state: 'ok' };
  };

  // ==================================================================== match du prospect (NCAA, Europe, Ignite)
  BM.careerProspectOpp = function (g) {
    var C = g.career, path = BM.CAREER_PATHS[C.path], i = C.prospect.games.length;
    var cup = i >= path.games;
    var opp = g.rng.pick(path.teams.filter(function (t) { return t !== BM.cPlayer(g).college; }));
    var label = cup ? path.cup + (i - path.games === 2 ? ' · finale' : i - path.games === 1 ? ' · demi-finale' : ' · quart de finale') : 'Saison régulière · match ' + (i + 1);
    return { opp: opp, cup: cup, label: label, lvl: path.level + (cup ? 0.6 : 0) + g.rng.range(-0.6, 0.6) };
  };

  BM.careerPlayProspect = function (g, choice) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng, a = p.attrs, path = BM.CAREER_PATHS[C.path];
    var info = BM.careerProspectOpp(g), ment = BM.CAREER_MENT[C.ment] || BM.CAREER_MENT.equil;
    var diff = BM.ovrRaw(p) - info.lvl + r.gauss(0, 1.1) + (p.morale - 60) / 40 + (p.condition - 70) / 50;
    var min = clamp(Math.round(r.gauss(31 + diff * 1.2, 3)), 16, 38);
    if (p.injury > 0) min = 0;
    var L = { day: g.day, opp: info.opp, label: info.label, cup: info.cup, min: min, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
    if (min > 0) {
      var f = min / 36, usage = (1 + ment.u * 0.5) * (1 + clamp(diff, -3, 4) * 0.07) * (choice === 'take' ? 1.25 : choice === 'team' ? 0.85 : 1);
      L.fga = clamp(Math.round(r.gauss(14 * f * usage, 2.5)), 2, 32);
      var s3 = clamp((a.tir3 - 5) / 22, 0.04, 0.62);
      L.tpa = Math.round(L.fga * s3);
      var p3 = clamp(0.3 + (a.tir3 - 12) * 0.013 + diff * 0.007 + ment.b, 0.15, 0.52);
      var p2 = clamp(0.47 + ((a.fin + a.tirMi) / 2 - 12) * 0.011 + diff * 0.01 + ment.b, 0.3, 0.68);
      for (var i = 0; i < L.fga; i++) { var three = i < L.tpa; if (r.chance(three ? p3 : p2)) { L.fgm++; if (three) L.tpm++; } }
      L.fta = Math.round(L.fga * clamp(0.18 + (a.fin - 10) * 0.012, 0.08, 0.45));
      for (var j = 0; j < L.fta; j++) if (r.chance(clamp(0.5 + a.lf * 0.02, 0.4, 0.92))) L.ftm++;
      L.pts = (L.fgm - L.tpm) * 2 + L.tpm * 3 + L.ftm;
      var posReb = { MEN: 0.45, ARR: 0.55, AIL: 0.75, AF: 1.05, PIV: 1.25 }[p.pos];
      L.reb = Math.max(0, Math.round(r.gauss(f * a.reb * 0.5 * posReb, 1.6)));
      L.ast = Math.max(0, Math.round(r.gauss(f * a.pas * 0.36 * (1 + ment.ast * 3) * (choice === 'team' ? 1.35 : 1), 1.4)));
      L.stl = Math.max(0, Math.round(r.gauss(f * a.int * 0.08 * (1 + ment.def * 20), 0.7)));
      L.blk = Math.max(0, Math.round(r.gauss(f * a.ctr * 0.07, 0.6)));
      L.tov = Math.max(0, Math.round(r.gauss(f * (2.2 + L.fga * 0.06 - a.drb * 0.05), 0.9)));
    }
    L.gs = BM.gameScore(L);
    var winP = clamp(0.5 + diff * 0.05 + (L.gs - 10) * 0.012, 0.12, 0.9);
    L.win = r.chance(winP);
    var us = r.int(64, 84), them = us + (L.win ? -r.int(1, 15) : r.int(1, 15));
    L.score = L.win ? us + '-' + them : us + '-' + them;
    C.prospect.games.push(L);
    if (L.win) C.prospect.w++; else C.prospect.l++;
    if (info.cup && L.win) C.prospect.cup++;
    var exp = 9 + (BM.ovrRaw(p) - path.level) * 1.5;
    C.rep += clamp((L.gs - exp) / 8, -1, 2) * path.vis * C.repMult;
    C.followers += C.followers * 0.006 + Math.max(0, L.gs) * 180 * path.vis * C.repMult;
    p.morale += (L.win ? 3 : -2) + clamp((L.gs - exp) / 5, -3, 3);
    p.condition -= min / 3.2;
    C.pp += Math.max(1, Math.round(0.3 + Math.max(0, L.gs) / 10 + (L.win ? 0.3 : 0)));
    C.cnt.tpm += L.tpm; C.cnt.ast += L.ast; C.cnt.reb += L.reb; C.cnt.stl += L.stl; C.cnt.blk += L.blk; C.cnt.min += min;
    if (min > 0 && r.chance(min * 0.0006 * (1 + Math.max(0, 60 - C.health) / 40))) { p.injury = r.int(3, 12); BM.clog(g, 'Blessé contre ' + info.opp + ' (' + p.injury + ' j).'); }
    var news = [];
    if (L.gs >= 22) { BM.cfeed(g, 'Hoops Daily', '@hoopsdaily', BM.fullName(p) + ' : ' + L.pts + ' pts, ' + L.reb + ' reb, ' + L.ast + ' pd contre ' + info.opp + '. Les scouts NBA prennent des notes.'); news.push('Les scouts NBA prennent des notes.'); }
    if (info.cup && i3(C) === 3 && L.win) {
      C.rep += 5; C.prospect.champion = true;
      BM.cpress(g, 'Le Parquet', BM.fullName(p) + ' remporte la ' + path.cup, 'Le prospect de ' + p.college + ' a porté son équipe jusqu\'au titre.', '+');
      C.cine.push({ k: path.cup, l: ['Le buzzer retentit.', p.college + ' remporte la ' + path.cup + '.', BM.fullName(p) + ' est porté en triomphe.'] });
      BM.clog(g, 'Vainqueur de la ' + path.cup + ' avec ' + p.college + '.');
    } else if (info.cup && !L.win) { C.prospect.cupOut = true; BM.clog(g, 'Éliminé de la ' + path.cup + '.'); }
    var badges = BM.careerCheckBadges(g);
    if (badges.length) news.push('Badge débloqué : ' + badges.join(', ') + '.');
    BM.careerNormalize(g);
    BM.careerUpdateStock(g);
    C.postGame = { prospect: true, line: L, info: info, news: news };
    BM.careerDayStartAfterGame(g);
    return L;
  };
  function i3(C) { return C.prospect.games.filter(function (x) { return x.cup; }).length; }

  // Après un match de prospect joué le jour même, la journée continue (soirée libre).
  BM.careerDayStartAfterGame = function (g) {
    var C = g.career;
    if (C.today) C.today.played = true;
  };

  BM.gameScore = function (b) {
    var reb = b.reb !== undefined ? b.reb : (b.oreb || 0) + (b.dreb || 0);
    return Math.round((b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.4 * reb + b.stl + 0.7 * b.ast + 0.7 * b.blk - b.tov) * 10) / 10;
  };

  // Cote à la draft : la valeur que les franchises lui donnent (même formule que l'IA de draft), plus sa saison.
  BM.careerUpdateStock = function (g) {
    var C = g.career, p = BM.cPlayer(g), path = BM.CAREER_PATHS[C.path], G = C.prospect.games;
    var played = G.filter(function (x) { return x.min > 0; });
    var avg = played.length ? played.reduce(function (s, x) { return s + x.gs; }, 0) / played.length : 0;
    var exp = 9 + (BM.ovrRaw(p) - path.level) * 1.5;
    var perf = played.length >= 3 ? clamp((avg - exp) * 0.09 * path.vis, -0.8, 1.2) : 0;
    var boost = perf + (C.prospect.champion ? 0.5 : 0) + C.prospect.cup * 0.1 + (C.prospect.combine || 0) + C.prospect.workouts * 0.08 + C.rep * 0.006 + (C.path === 'europe' ? 0.25 : 0);
    p.draftBoost = boost;
    C.prospect.stock = boost;
    C.prospect.avg = avg;
  };

  // Rang projeté parmi la classe de draft (sans le hasard du soir de la draft).
  BM.careerMockRank = function (g) {
    var p = BM.cPlayer(g);
    var val = function (x) { return x.pot * 0.7 + BM.ovrRaw(x) * 0.3 + (x.draftBoost || 0); };
    var mine = val(p);
    return 1 + (g.draftClass || []).filter(function (id) { var x = g.players[id]; return x !== p && val(x) > mine; }).length;
  };

  // Combine et workouts : options de fin de saison du prospect.
  BM.careerCombine = function (g) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng;
    if (C.prospect.combine !== null) return 'Tu as déjà passé le combine.';
    var ath = (p.attrs.vit + p.attrs.det + p.attrs.end) / 3;
    var res = clamp((ath - 12) * 0.08 + r.gauss(0, 0.15) + (p.condition - 70) / 300, -0.35, 0.5);
    C.prospect.combine = res;
    p.condition -= 10;
    BM.careerUpdateStock(g);
    var txt = res >= 0.2 ? 'Tests physiques impressionnants : ta cote grimpe.' : res >= 0 ? 'Tests corrects, rien de spectaculaire.' : 'Des tests décevants. Certains scouts tiquent.';
    BM.clog(g, 'Draft combine : ' + txt);
    return txt;
  };
  BM.careerWorkout = function (g) {
    var C = g.career, p = BM.cPlayer(g);
    if (C.prospect.workouts >= 4) return 'Ton agent a déjà calé tous les workouts possibles.';
    C.prospect.workouts++; p.condition -= 8;
    BM.careerUpdateStock(g);
    var t = g.rng.pick(g.teams);
    return 'Workout privé chez les ' + t.name + '. Les dirigeants repartent avec une bonne impression.';
  };

  // ==================================================================== draft
  BM.careerRunDraft = function (g) {
    var C = g.career, p = BM.cPlayer(g);
    BM.careerUpdateStock(g);
    if (!g.draft) BM.startDraft(g);
    BM.draftAdvance(g);
    BM.finishDraft(g);
    var pick = (g.draft.picks || []).find(function (x) { return x.pid === p.id; });
    var res;
    if (pick) {
      res = { pick: pick.pick, round: pick.round, team: pick.team };
    } else {
      // Non drafté : contrat two-way chez une franchise qui croit en lui.
      g.freeAgents = g.freeAgents.filter(function (id) { return id !== p.id; });
      var t = g.teams.slice().sort(function (a, b) { return a.rep - b.rep; })[g.rng.int(0, 9)];
      p.contract = { salary: 1300, years: 2 };
      p.teamId = null;
      BM.addToTeam(g, p, t);
      res = { pick: null, team: t.id };
    }
    p.prospect = false; p.rookie = true;
    g.userTeam = p.teamId;
    C.phase = 'nba';
    C.draft = res;
    C.draftSeason = g.season;
    C.confCoach = 52; C.confMates = 48;
    var team = g.teams[p.teamId];
    if (res.pick) {
      BM.clog(g, 'Drafté en ' + res.pick + (res.pick === 1 ? 're' : 'e') + ' position par les ' + team.name + '.');
      BM.cpress(g, 'Courtside TV', team.name + ' choisit ' + BM.fullName(p) + ' au ' + res.pick + (res.pick === 1 ? 'er' : 'e') + ' rang', 'Le prospect de ' + p.college + ' rejoint la NBA.', '+');
      C.rep += res.pick <= 5 ? 8 : res.pick <= 14 ? 5 : res.pick <= 30 ? 3 : 1;
      C.followers += res.pick <= 5 ? 250000 : res.pick <= 14 ? 120000 : 50000;
      C.cine.push({ k: 'Draft ' + (2026 + g.season), l: ['Le commissaire s\'avance vers le pupitre.', 'Avec le ' + res.pick + (res.pick === 1 ? 'er' : 'e') + ' choix de la draft…', 'les ' + team.name + ' sélectionnent…', BM.fullName(p) + ' !'] });
    } else {
      BM.clog(g, 'Non drafté. Contrat two-way avec les ' + team.name + '.');
      BM.cpress(g, 'Hoops Daily', BM.fullName(p) + ' passe au travers de la draft', 'Les ' + team.name + ' lui offrent un contrat two-way. Tout reste à prouver.', '-');
      C.cine.push({ k: 'Draft ' + (2026 + g.season), l: ['Soixante noms.', 'Pas le tien.', 'Le téléphone sonne à minuit : les ' + team.name + ' veulent te donner ta chance.'] });
    }
    p.number = p.number || g.rng.int(0, 45);
    BM.careerNewDemand(g);
    BM.careerComputeStatus(g);
    BM.careerNormalize(g);
    return res;
  };

  // ==================================================================== après un match NBA de l'équipe
  BM.careerAfterTeamMatch = function (g, fx, m) {
    var C = g.career, p = BM.cPlayer(g);
    if (!C || C.phase !== 'nba' || !p) return;
    var r = g.rng, side = fx.home === p.teamId ? 0 : 1, won = m.score[side] > m.score[1 - side];
    var b = m.box[p.id], cr = m.career;
    var before = { rep: C.rep, confCoach: C.confCoach, confMates: C.confMates, morale: p.morale };
    var opp = g.teams[side === 0 ? fx.away : fx.home];
    var L = { day: g.day, opp: opp.short, oppName: opp.name, win: won, score: m.score[side] + '-' + m.score[1 - side], po: fx.type === 'playoff', dnp: !b || b.sec < 30 };
    if (C.suspended) { C.suspended = 0; L.dnp = true; L.susp = true; }
    var pp = 0, badges = [];
    if (!L.dnp) {
      Object.assign(L, { min: Math.round(b.sec / 60), pts: b.pts, reb: b.oreb + b.dreb, ast: b.ast, stl: b.stl, blk: b.blk, tov: b.tov, pf: b.pf, fgm: b.fgm, fga: b.fga, tpm: b.tpm, tpa: b.tpa, ftm: b.ftm, fta: b.fta, pm: b.pm });
      L.gs = BM.gameScore(L);
      var exp = BM.CAREER_STATUS[C.status].exp;
      C.rep += clamp((L.gs - exp) / 8, -1.5, 2.5) * C.repMult + (won ? 0.3 : -0.1);
      p.morale += clamp((L.gs - exp) / 6, -2, 2);
      C.confCoach += clamp((L.gs - exp) / 12, -1, 1.2) + (cr && cr.coachPlus ? cr.coachPlus * 0.8 : 0);
      if (L.ast >= 6) C.confMates += 1.5;
      if (L.fga >= 16 && L.fgm / L.fga < 0.38) C.confMates -= 2;
      if (C.ment === 'collectif') C.confMates += 0.8;
      if (C.ment === 'agress' && L.fga && L.fgm / L.fga < 0.4) C.confMates -= 1.2;
      C.confMates += won ? 0.5 : -0.2;
      C.followers += Math.max(0, L.gs) * 150 * C.repMult + C.rep * 40;
      var mid = Math.round((L.fgm - L.tpm) * p.attrs.tirMi / Math.max(1, p.attrs.tirMi + p.attrs.fin));
      C.cnt.tpm += L.tpm; C.cnt.midm += mid; C.cnt.rimm += L.fgm - L.tpm - mid; C.cnt.ast += L.ast; C.cnt.blk += L.blk; C.cnt.stl += L.stl; C.cnt.reb += L.reb; C.cnt.min += L.min;
      if (cr) { C.cnt.clutch += cr.clutchMade || 0; C.decisions += cr.decisions; L.decisions = cr.decisions; }
      pp = Math.max(1, Math.round(0.3 + Math.max(0, L.gs) / 10 + (won ? 0.3 : 0)));
      // Panier de la gagne.
      if (cr && cr.clutchTry && cr.result === 'ok' && won && Math.abs(m.score[0] - m.score[1]) <= 3) {
        C.gw++; L.gw = true; C.rep += 2; C.followers += C.followers * 0.05 + 5000;
        BM.cfeed(g, 'Courtside TV', '@courtsidetv', 'LE PANIER DE LA GAGNE POUR ' + BM.fullName(p).toUpperCase() + '. On ne s\'en remet pas.', false, Math.round(C.followers * 0.06 + 5000));
        BM.clog(g, 'Panier décisif contre ' + opp.name + '.');
      }
      if (cr && cr.dunkTry && cr.result === 'ok') { C.followers += 8000; BM.cfeed(g, 'Hoops Daily', '@hoopsdaily', 'Le dunk de ' + BM.fullName(p) + ' contre ' + opp.name + '. Posterisé.', false); }
      if (L.gs >= 20) BM.cfeed(g, r.pick(BM.CAREER_OUTLETS), '@stats', BM.fullName(p) + ' : ' + L.pts + ' pts, ' + L.reb + ' reb, ' + L.ast + ' pd ' + (won ? 'dans la victoire' : 'malgré la défaite') + ' contre ' + opp.name + '.');
      if (L.gs < 2 && L.min >= 20) BM.cfeed(g, 'Fans', '@' + r.pick(BM.CAREER_FANS), BM.fullName(p) + ' était où ce soir ? Fantôme.');
      if (p.injury > 0) { C.health -= 8; L.injured = p.injury; BM.clog(g, 'Blessé contre ' + opp.name + ' (' + p.injury + ' j).'); }
      // Sponsors : primes de match.
      C.sponsors.forEach(function (s) { if (s.bonus.k === 'win' && won) C.money += s.bonus.v; if (s.bonus.k === 'pts' && L.pts >= s.bonus.n) C.money += s.bonus.v; });
      badges = BM.careerCheckBadges(g);
      C.interview = BM.careerBuildInterview(g, L);
    } else if (C.status === 'banc' && p.injury <= 0) p.morale -= 1;
    C.pp += pp;
    // La réputation revient lentement vers ce que justifient le niveau et le palmarès.
    var base = clamp((BM.ovr(p) - 60) * 2.2 + C.allStars * 5 + C.rings * 6, 5, 95);
    C.rep -= (C.rep - base) * 0.04;
    var st = BM.careerComputeStatus(g);
    BM.careerNormalize(g);
    C.games = (C.games || []).concat([L]).slice(-90);
    C.postGame = { line: L, pp: pp, badges: badges, status: st, deltas: { rep: C.rep - before.rep, confCoach: C.confCoach - before.confCoach, confMates: C.confMates - before.confMates, morale: p.morale - before.morale } };
  };

  BM.careerCheckBadges = function (g) {
    var C = g.career, p = BM.cPlayer(g), up = [];
    p.badges = p.badges || {};
    BM.CAREER_BADGES.forEach(function (b) {
      var l = p.badges[b.id] || 0, l0 = l;
      while (l < 4 && C.cnt[b.c] >= b.th[l] && p.attrs[b.a] >= BM.CAREER_BREQ[l + 1]) l++;
      if (l > l0) { p.badges[b.id] = l; up.push(b.l + ' ' + BM.CAREER_BLVL[l]); BM.clog(g, 'Badge : ' + b.l + ' (' + BM.CAREER_BLVL[l] + ').'); }
    });
    return up;
  };

  // ==================================================================== interview d'après-match
  var IQ = [
    { c: function (L) { return L.gs >= 18; }, q: function (L) { return L.pts + ' points ce soir. Qu\'est-ce qui a marché ?'; },
      a: [['« Le travail paie. Merci au staff. »', 'humble'], ['« Personne ne peut me défendre ce soir. »', 'cocky'], ['« Dieu m\'a donné ce talent, je le respecte. »', 'faith']] },
    { c: function (L) { return !L.win && L.gs < 6; }, q: function () { return 'Soirée compliquée pour toi. Comment tu l\'expliques ?'; },
      a: [['« C\'est sur moi. Je serai meilleur. »', 'humble'], ['« Les arbitres ont laissé passer beaucoup de choses. »', 'blame'], ['« On passe au suivant. »', 'neutral']] },
    { c: function (L) { return L.win; }, q: function (L) { return 'Belle victoire contre ' + L.oppName + '. Votre secret ?'; },
      a: [['« Le collectif. Tout le monde a joué juste. »', 'humble'], ['« On est la meilleure équipe de la ligue, point. »', 'cocky'], ['« On a mangé des pâtes avant le match. »', 'funny']] },
    { c: function (L) { return !L.win; }, q: function (L) { return 'Défaite contre ' + L.oppName + '. Qu\'est-ce qui a manqué ?'; },
      a: [['« De l\'énergie. À nous de réagir. »', 'humble'], ['« Certains doivent se regarder dans le miroir. »', 'blame'], ['« Rien. On passe au suivant. »', 'neutral']] },
    { c: function (L, C) { return C.status === 'banc' || C.status === 'rot'; }, q: function () { return 'Tu es frustré par ton temps de jeu ?'; },
      a: [['« Je dois continuer à travailler. »', 'humble'], ['« Oui, je mérite plus. »', 'cocky'], ['« Je fais confiance au coach. »', 'neutral']] },
    { c: function (L) { return L.gw; }, q: function () { return 'Le dernier tir, c\'était pour toi. Tu tremblais ?'; },
      a: [['« Je vis pour ces moments. »', 'cocky'], ['« J\'ai prié avant le tir. »', 'faith'], ['« Mes coéquipiers m\'ont trouvé. »', 'humble']] },
    { c: function (L) { return L.ast >= 8; }, q: function (L) { return L.ast + ' passes décisives. Tu te vois en distributeur ?'; },
      a: [['« Je prends ce que la défense me donne. »', 'neutral'], ['« Mes coéquipiers rendent mon travail facile. »', 'humble'], ['« Je peux tout faire sur un terrain. »', 'cocky']] }
  ];
  var TONE_FX = {
    humble: function (C) { C.confMates += 0.8; C.rep += 0.08; return 'Réponse saluée pour sa maturité.'; },
    cocky: function (C) { C.followers += 1500; C.rep += 0.15; C.confMates -= 1; return 'La sortie enflamme les réseaux. Le vestiaire beaucoup moins.'; },
    blame: function (C) { C.confMates -= 1.2; C.confCoach -= 0.8; return 'Tes mots font du bruit en interne.'; },
    faith: function (C, g) { BM.cPlayer(g).morale += 1.5; C.rep += 0.1; return 'Un message sincère, largement partagé.'; },
    funny: function (C) { C.followers += 1000; C.rep += 0.08; return 'La salle de presse a ri. Internet aussi.'; },
    neutral: function () { return 'Peu de choses à retenir. C\'est voulu.'; }
  };
  BM.careerBuildInterview = function (g, L) {
    var C = g.career, ok = IQ.filter(function (q) { return q.c(L, C); }), qs = [];
    while (qs.length < 2 && ok.length) { var q = g.rng.pick(ok); ok.splice(ok.indexOf(q), 1); qs.push({ q: q.q(L, C), a: q.a }); }
    return qs.length ? { j: g.rng.pick(BM.CAREER_JOURNOS), qs: qs, i: 0, answers: [] } : null;
  };
  BM.careerAnswer = function (g, idx) {
    var C = g.career, iv = C.interview;
    if (!iv) return '';
    var q = iv.qs[iv.i], ans = q.a[idx], tone = ans[1];
    C.media[tone] = (C.media[tone] || 0) + 1;
    var res = TONE_FX[tone](C, g);
    iv.answers.push(ans[0]); iv.i++;
    if (iv.i >= iv.qs.length) {
      var p = BM.cPlayer(g);
      BM.cpress(g, iv.j.split(' · ')[1], BM.fullName(p) + ' : ' + iv.answers[0], res, { cocky: '-', blame: '-', neutral: '=' }[tone] || '+');
      C.interview = null;
    }
    BM.careerNormalize(g);
    return res;
  };
  BM.careerSkipInterview = function (g) {
    var C = g.career;
    C.money -= 20; C.rep -= 0.8; C.interview = null;
    BM.careerNormalize(g);
    return 'Tu quittes la salle sans un mot. La ligue t\'inflige 20 k$ d\'amende.';
  };
  BM.careerImage = function (C) {
    var best = null, bv = 0;
    Object.keys(C.media).forEach(function (k) { if (C.media[k] > bv) { bv = C.media[k]; best = k; } });
    return best;
  };

  // ==================================================================== sponsors
  var r1 = function (x) { return Math.round(x); };
  BM.careerSpSlots = function (C) { return clamp(1 + Math.floor(C.rep / 25), 1, 4); };
  BM.careerMakeOffer = function (g) {
    var C = g.career, r = g.rng;
    var have = C.sponsors.map(function (c) { return c.cat; }), pend = C.spOffers.map(function (o) { return o.cat; });
    var cats = Object.keys(BM.SP_CATS).filter(function (k) { return C.rep >= BM.SP_CATS[k].rep && have.indexOf(k) < 0 && pend.indexOf(k) < 0; });
    if (!cats.length) return null;
    var cat = r.pick(cats), b = r.pick(BM.SP_BRANDS.filter(function (x) { return x.cat === cat; }));
    var fit = BM.SP_IMG_FIT[b.img].indexOf(BM.careerImage(C)) >= 0;
    var pay = r1(BM.SP_CATS[cat].base * (1 + C.rep / 50) * (1 + Math.log10(1 + C.followers / 100000) * 0.4) * (fit ? 1.25 : 1) * r.range(0.85, 1.15));
    var cl = [{ k: 'posts', n: r.pick([1, 1, 2]) }];
    if (b.img === 'disc' && r.chance(0.6)) cl.push({ k: 'noparty' });
    if (r.chance(0.5)) cl.push({ k: 'rep', min: Math.max(10, Math.round(C.rep - 12)) });
    var bonus = r.pick([{ k: 'win', v: r1(pay * 0.15) }, { k: 'pts', n: 20, v: r1(pay * 0.3) }, { k: 'allstar', v: r1(pay * 3) }]);
    return { id: 's' + g.day + r.int(100, 999), brand: b.n, cat: cat, img: b.img, pay: pay, weeks: r.pick([26, 52, 78]), cl: cl, bonus: bonus, sign: r1(pay * 2), fit: fit, exp: 3, neg: false };
  };
  BM.careerClauseTxt = function (c) { return c.k === 'posts' ? c.n + ' post sponsorisé' + (c.n > 1 ? 's' : '') + ' par semaine (activité Médias)' : c.k === 'noparty' ? 'Aucune fête' : 'Réputation minimum : ' + c.min; };
  BM.careerBonusTxt = function (b) { return b.k === 'win' ? '+' + BM.money(b.v) + ' par victoire' : b.k === 'pts' ? '+' + BM.money(b.v) + ' par match à ' + b.n + ' pts ou plus' : '+' + BM.money(b.v) + ' si All-Star'; };
  BM.careerAcceptSp = function (g, id) {
    var C = g.career, i = C.spOffers.findIndex(function (o) { return o.id === id; });
    if (i < 0) return '';
    if (C.sponsors.length >= BM.careerSpSlots(C)) return 'Ton agent ne peut pas gérer plus de ' + BM.careerSpSlots(C) + ' contrat(s) avec ta réputation actuelle.';
    var o = C.spOffers.splice(i, 1)[0];
    C.sponsors.push(Object.assign({}, o, { left: o.weeks, strikes: 0, postsW: 0, grace: 1 }));
    C.money += o.sign; relAdd(C, 'agent', 4);
    BM.clog(g, 'Sponsor : ' + o.brand + ' (' + BM.SP_CATS[o.cat].l + ').');
    BM.cpress(g, g.rng.pick(BM.CAREER_OUTLETS), BM.fullName(BM.cPlayer(g)) + ' signe avec ' + o.brand, 'Un contrat estimé à ' + BM.money(o.pay * o.weeks + o.sign) + '.', '+');
    return 'Contrat signé avec ' + o.brand + '. Prime de signature : ' + BM.money(o.sign) + '.';
  };
  BM.careerNegotiateSp = function (g, id) {
    var C = g.career, o = C.spOffers.find(function (x) { return x.id === id; });
    if (!o || o.neg) return '';
    o.neg = true;
    var pr = clamp(0.35 + (rel(C, 'agent').v - 60) / 200 + (o.fit ? 0.12 : 0) + C.rep / 400, 0.15, 0.85);
    if (g.rng.chance(pr)) { o.pay = r1(o.pay * 1.2); o.sign = r1(o.sign * 1.3); relAdd(C, 'agent', 3); return firstName(C, 'agent') + ' obtient 20 % de plus : ' + BM.money(o.pay) + ' par semaine.'; }
    if (g.rng.chance(0.5)) { C.spOffers.splice(C.spOffers.indexOf(o), 1); return o.brand + ' retire son offre. Ton agent a trop tiré sur la corde.'; }
    return o.brand + ' refuse de renégocier mais maintient son offre.';
  };
  BM.careerDeclineSp = function (g, id) { var C = g.career; C.spOffers = C.spOffers.filter(function (o) { return o.id !== id; }); };
  BM.careerSponsorHit = function (g, img, fatal) {
    var C = g.career, out = '';
    C.sponsors.slice().forEach(function (c) {
      if (c.img !== img) return;
      c.strikes++;
      if (fatal || c.strikes >= 3) {
        C.sponsors.splice(C.sponsors.indexOf(c), 1); C.rep -= 1;
        BM.cpress(g, g.rng.pick(BM.CAREER_OUTLETS), c.brand + ' lâche ' + BM.fullName(BM.cPlayer(g)), 'La marque évoque un comportement contraire à ses valeurs.', '-');
        out += ' ' + c.brand + ' rompt ton contrat.';
      } else out += ' ' + c.brand + ' n\'apprécie pas (avertissement ' + c.strikes + '/3).';
    });
    return out;
  };
  BM.careerSponsorWeekly = function (g, acts) {
    var C = g.career, msgs = [];
    C.sponsors.slice().forEach(function (c) {
      if (c.grace) { c.grace = 0; c.postsW = 0; c.left--; return; }
      c.cl.forEach(function (k) {
        if (k.k === 'posts' && (c.postsW || 0) < k.n) { c.strikes++; msgs.push(c.brand + ' : posts sponsorisés manquants. Avertissement ' + c.strikes + '/3.'); }
        if (k.k === 'noparty' && acts.indexOf('soiree') >= 0) { c.strikes++; msgs.push(c.brand + ' : tu as fait la fête malgré la clause. Avertissement ' + c.strikes + '/3.'); }
        if (k.k === 'rep' && C.rep < k.min) { c.strikes++; msgs.push(c.brand + ' : ta réputation est passée sous ' + k.min + '. Avertissement ' + c.strikes + '/3.'); }
      });
      c.postsW = 0; c.left--;
      if (c.strikes >= 3) { C.sponsors.splice(C.sponsors.indexOf(c), 1); C.rep -= 1; msgs.push(c.brand + ' met fin à votre contrat.'); return; }
      if (c.left <= 0) { C.sponsors.splice(C.sponsors.indexOf(c), 1); msgs.push('Ton contrat avec ' + c.brand + ' arrive à son terme.'); }
    });
    C.spOffers = C.spOffers.filter(function (o) { return --o.exp > 0; });
    if (C.spOffers.length < 3 && C.sponsors.length < BM.careerSpSlots(C) && g.rng.chance(0.5)) {
      var o = BM.careerMakeOffer(g);
      if (o) { C.spOffers.push(o); msgs.push('Nouvelle offre de sponsor : ' + o.brand + ' (' + BM.SP_CATS[o.cat].l + '). Rendez-vous dans l\'onglet Médias.'); }
    }
    return msgs;
  };

  // ==================================================================== vie : achats, staff, placements, cadeaux
  BM.careerBuy = function (g, id) {
    var C = g.career, a = BM.CAREER_ASSETS.find(function (x) { return x.id === id; });
    if (C.assets[id] || C.money < a.p) return false;
    C.money -= a.p; C.assets[id] = 1; BM.cPlayer(g).morale += 4;
    if (id === 'maisonfamille') { relAdd(C, 'mere', 20); C.cine.push({ k: 'Surprise', l: ['Tu lui tends les clés.', 'Elle ne comprend pas tout de suite.', 'Puis elle pleure.'] }); }
    if (id === 'voiture') C.followers += 10000;
    BM.clog(g, 'Achat : ' + a.l.toLowerCase() + '.');
    BM.careerNormalize(g);
    return true;
  };
  BM.careerSell = function (g, id) {
    var C = g.career, a = BM.CAREER_ASSETS.find(function (x) { return x.id === id; });
    if (!C.assets[id]) return false;
    delete C.assets[id]; C.money += a.p * 0.8;
    BM.clog(g, 'Vente : ' + a.l.toLowerCase() + '.');
    return true;
  };
  BM.careerToggleStaff = function (g, id) {
    var C = g.career;
    if (C.staff[id]) delete C.staff[id]; else { C.staff[id] = 1; BM.clog(g, 'Engage un ' + BM.CAREER_STAFF.find(function (x) { return x.id === id; }).l.toLowerCase() + '.'); }
  };
  BM.careerInvest = function (g, k, amt) { var C = g.career; if (amt > C.money) return false; C.money -= amt; C.inv[k] += amt; return true; };
  BM.careerWithdraw = function (g, k) { var C = g.career; C.money += C.inv[k]; C.inv[k] = 0; };
  BM.careerGift = function (g, id) {
    var C = g.career, r = id === 'partner' ? C.partner : rel(C, id), key = g.season + '-' + Math.floor(g.day / 7);
    if (!r || r.gw === key) return false;
    var cost = id === 'partner' ? 30 : 20;
    if (C.money < cost) return false;
    C.money -= cost; r.v = clamp(r.v + 10, 0, 100); r.gw = key; BM.cPlayer(g).morale += 2;
    BM.careerNormalize(g);
    return true;
  };
  BM.careerNetWorth = function (C) {
    var s = C.money;
    Object.keys(C.assets).forEach(function (id) { s += BM.CAREER_ASSETS.find(function (x) { return x.id === id; }).p * 0.8; });
    Object.keys(C.inv).forEach(function (k) { s += C.inv[k]; });
    return s;
  };

  // ==================================================================== transferts
  // À la date limite des échanges : un joueur qui a demandé son départ, ou qui a perdu la confiance du coach, peut être échangé.
  BM.careerTradeCheck = function (g) {
    var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
    if (C.phase !== 'nba' || !t || g.phase !== 'regular' || !BM.tradeOpen || C.tradeDone === g.season) return;
    var left = g.fixtures.filter(function (f) { return f.type === 'league' && !f.played; }).length / Math.max(1, g.fixtures.filter(function (f) { return f.type === 'league'; }).length);
    if (left > 0.42 || left < 0.36) return; // fenêtre de la date limite
    C.tradeDone = g.season;
    var chance = C.tradeReq ? 0.8 : C.confCoach < 30 ? 0.35 : C.status === 'star' ? 0.01 : 0.05;
    if (!g.rng.chance(chance)) return;
    var others = g.teams.filter(function (x) { return x !== t; });
    var dest = g.rng.pick(others);
    var oldName = t.name;
    BM.addToTeam(g, p, dest);
    if (dest.roster.length > 15) {
      var worst = BM.roster(g, dest).filter(function (x) { return x !== p; }).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
      BM.removeFromTeam(g, worst); g.freeAgents.push(worst.id);
    }
    BM.fillRoster(g, t);
    BM.autoTactics(g, dest);
    g.userTeam = dest.id;
    C.tradeReq = false; C.confCoach = 52; C.confMates = 46;
    BM.careerNewDemand(g); BM.careerComputeStatus(g);
    BM.clog(g, 'Échangé : de ' + oldName + ' aux ' + dest.name + '.');
    BM.cpress(g, 'Hoops Daily', 'Échange : ' + BM.fullName(p) + ' rejoint les ' + dest.name, 'Coup de théâtre à la date limite des échanges.', '=');
    C.cine.push({ k: 'Date limite des échanges', l: ['Ton téléphone vibre à 14 h 58.', 'C\'est ton agent.', '« Tu fais tes valises. Direction ' + dest.city + '. »'] });
  };

  // ==================================================================== fin de saison
  // À appeler AVANT BM.endSeason (qui remet les statistiques à zéro).
  BM.careerSnapshotSeason = function (g) {
    var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
    // Saison de la draft : le joueur était encore prospect, rien à enregistrer côté NBA.
    if (C.phase === 'prospect' || !t || (C.draftSeason === g.season)) { C.snap = null; return; }
    var s = p.stats, po = g.playoffs, reached = 0;
    if (po) po.series.forEach(function (x) { if (x.a === t.id || x.b === t.id) reached = Math.max(reached, x.round); });
    var champ = po && po.champion === t.id;
    var per = function (k) { return s.gp ? Math.round(s[k] / s.gp * 10) / 10 : 0; };
    C.snap = { season: g.season, team: t.short, teamName: t.name, status: BM.CAREER_STATUS[C.status].l, w: t.record.w, l: t.record.l, gp: s.gp,
      pts: per('pts'), reb: per('reb'), ast: per('ast'), stl: per('stl'), blk: per('blk'), min: per('min'),
      fg: s.fga ? Math.round(s.fgm / s.fga * 1000) / 10 : 0, tp: s.tpa ? Math.round(s.tpm / s.tpa * 1000) / 10 : 0,
      reached: reached, champ: champ, ovr: BM.ovr(p), age: p.age };
  };

  BM.careerSeasonEnd = function (g, summary) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng, out = { awards: [], potD: 0 };
    if (C.phase === 'prospect') return out;
    var S = C.snap;
    // Distinctions de la saison (attribuées par la ligue).
    (p.awards || []).filter(function (a) { return a.s === g.season; }).forEach(function (a) {
      out.awards.push(a.t);
      if (a.t === 'All-Star') { C.allStars++; C.rep += 4; C.pp += 8; C.followers += 60000; C.sponsors.forEach(function (s) { if (s.bonus.k === 'allstar') C.money += s.bonus.v; }); }
      else { C.pp += 10; C.rep += 3; }
    });
    if (out.awards.indexOf('MVP') >= 0) C.cine.push({ k: 'MVP', l: ['Le commissaire monte sur scène.', 'Le joueur le plus utile de la saison est…', BM.fullName(p) + '.'] });
    if (S && S.champ) {
      C.rings++; C.rep += 8; C.pp += 15;
      BM.cfeed(g, BM.fullName(p), '@' + (p.first + p.last).toLowerCase().replace(/[^a-z]/g, ''), 'CHAMPIONS. Merci Seigneur. Merci la famille.', true, Math.round(C.followers * 0.15 + 20000));
      C.cine.push({ k: 'Champion', l: ['Le buzzer retentit.', 'Les confettis tombent.', S.teamName + ', champions.', BM.fullName(p) + ' a une bague au doigt.'] });
      BM.clog(g, 'CHAMPION NBA avec les ' + S.teamName + ' !');
    }
    // Potentiel revu selon l'éthique de travail.
    var pot0 = p.pot;
    if (C.pot0 === undefined) C.pot0 = p.pot;
    if (p.age <= 27 && p.pot < C.pot0 + 1.2) { if (C.work >= 80) p.pot += 0.2; else if (C.work >= 70 && r.chance(0.3)) p.pot += 0.2; }
    if (C.work < 40) p.pot -= 0.2;
    out.potD = Math.round((p.pot - pot0) * 5);
    if (S) { S.awards = out.awards.slice(); S.res = S.champ ? 'Champion' : S.reached === 0 ? 'Pas de playoffs' : 'Éliminé (' + BM.ROUND_NAMES[S.reached].toLowerCase() + ')'; C.seasons.push(S); }
    // Contrat du joueur (géré ici, pas par la ligue).
    if (p.teamId !== null) {
      p.contract.years--;
      if (p.contract.years <= 0) out.fa = true;
    }
    out.canRetire = p.age >= 33;
    out.mustRetire = p.age >= 40 || (p.age >= 36 && BM.ovr(p) < 60);
    C.offseason = out;
    if (out.fa) C.offers = BM.careerOffers(g);
    BM.careerNormalize(g);
    return out;
  };

  // Offres de free agency : franchise actuelle (si la confiance est là) et trois autres.
  BM.careerOffers = function (g) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng, t = BM.cTeam(g), out = [];
    var ask = BM.askingSalary(p) * (1 + (C.rep - 40) / 300) * (1 + (rel(C, 'agent').v - 60) / 400);
    if (t && !C.tradeReq && C.confCoach >= 35) out.push({ team: t.id, sal: Math.round(ask * r.range(0.95, 1.05) / 50) * 50, years: r.int(2, 4) });
    var others = r.shuffle(g.teams.filter(function (x) { return !t || x.id !== t.id; })).slice(0, 3);
    others.forEach(function (x) { out.push({ team: x.id, sal: Math.round(ask * r.range(0.85, 1.15) / 50) * 50, years: r.int(1, 4) }); });
    return out.map(function (o) {
      var team = g.teams[o.team], better = BM.roster(g, team).filter(function (x) { return x !== p && BM.ovrRaw(x) > BM.ovrRaw(p); }).length;
      var role = better === 0 ? '1re option' : better === 1 ? '2e option' : better <= 4 ? 'Titulaire' : better <= 7 ? 'Rotation' : 'Banc';
      return Object.assign(o, { role: role, rep: team.rep });
    });
  };
  BM.careerSign = function (g, i) {
    var C = g.career, p = BM.cPlayer(g), o = C.offers[i], t = g.teams[o.team];
    p.contract = { salary: o.sal, years: o.years };
    if (p.teamId !== o.team) {
      var old = p.teamId !== null ? g.teams[p.teamId].name : 'agent libre';
      BM.addToTeam(g, p, t);
      if (t.roster.length > 15) {
        var worst = BM.roster(g, t).filter(function (x) { return x !== p; }).sort(function (a, b) { return BM.ovrRaw(a) - BM.ovrRaw(b); })[0];
        BM.removeFromTeam(g, worst); g.freeAgents.push(worst.id);
      }
      g.userTeam = t.id; C.confCoach = 52; C.confMates = 45;
      BM.clog(g, 'Signe chez les ' + t.name + ' (' + o.years + ' ans, ' + BM.money(o.sal) + ' par an). Départ de ' + old + '.');
      BM.cpress(g, 'Courtside TV', BM.fullName(p) + ' s\'engage avec les ' + t.name, o.years + ' saisons, ' + BM.money(o.sal) + ' par an.', '=');
    } else BM.clog(g, 'Prolonge ' + o.years + ' ans (' + BM.money(o.sal) + ' par an).');
    C.tradeReq = false; C.offers = null; C.offseason.fa = false;
    BM.careerNewDemand(g);
  };

  // Été : programme de travail, vieillissement, puis lancement de la nouvelle saison.
  BM.careerSummer = function (g, id) {
    var C = g.career, p = BM.cPlayer(g), prog = BM.CAREER_SUMMER.find(function (x) { return x.id === id; }) || BM.CAREER_SUMMER[0], gains = {};
    var gr = BM.careerGrowth(g) * 0.9;
    Object.keys(prog.a).forEach(function (k) { var v = prog.a[k] * gr * g.rng.range(0.85, 1.15); gains[k] = v; BM.careerGain(g, k, v); });
    // Déclin physique à partir de 30 ans (l'âge a déjà été incrémenté par la ligue).
    if (p.age >= 30) {
      var d = (p.age - 29) * 0.38 * (prog.rest ? 0.5 : 1) * (C.staff.physio ? 0.7 : 1) * (C.health < 50 ? 1.2 : 1);
      BM.careerGain(g, 'vit', -d * 0.9); BM.careerGain(g, 'det', -d); BM.careerGain(g, 'end', -d * 0.7); BM.careerGain(g, 'defE', -d * 0.4); BM.careerGain(g, 'fin', -d * 0.25);
      C.health -= 1.5;
    }
    if (prog.rest) C.health += 15;
    BM.careerGain(g, 'qi', 0.25); BM.careerGain(g, 'lead', 0.2);
    C.pp += 6;
    p.condition = 100; p.morale = clamp(p.morale + (prog.rest ? 18 : 8), 0, 100); p.injury = 0;
    C.offseason = null;
    BM.clog(g, 'Été : ' + prog.l.toLowerCase() + '.');
    BM.startNewSeason(g);
    // Le joueur reste dans son équipe : rotation du coach recalculée.
    BM.careerNewDemand(g); BM.careerComputeStatus(g);
    C.weekStart = g.day;
    BM.careerDayStart(g);
    BM.careerNormalize(g);
    return gains;
  };

  // ==================================================================== retraite et héritage
  BM.careerLegacy = function (g) {
    var C = g.career, p = BM.cPlayer(g), aw = function (n) { return (p.awards || []).filter(function (a) { return a.t.indexOf(n) === 0; }).length; };
    var nb = Object.keys(p.badges || {}).reduce(function (s, k) { return s + p.badges[k]; }, 0);
    var sc = C.seasons.length + C.allStars * 3 + aw('All-NBA') * 4 + aw('MVP') * 10 + C.rings * 8 + aw('Défenseur') * 5 + aw('Rookie') * 2 + C.gw * 0.5 + nb * 0.5;
    var tier = sc >= 95 ? 'Légende du jeu' : sc >= 60 ? 'Hall of Famer' : sc >= 32 ? 'Très grande carrière' : sc >= 16 ? 'Solide carrière NBA' : 'Une carrière NBA';
    return { sc: Math.round(sc), tier: tier };
  };
  BM.careerRetire = function (g) {
    var C = g.career, p = BM.cPlayer(g), t = BM.cTeam(g);
    C.legacy = BM.careerLegacy(g);
    C.lastTeam = t ? t.id : null;
    if (t) BM.removeFromTeam(g, p);
    p.retired = true;
    C.phase = 'retired';
    BM.clog(g, 'Annonce sa retraite. Héritage : ' + C.legacy.tier + '.');
    g.legends = (g.legends || []).concat([{ name: BM.fullName(p), season: g.season, tier: C.legacy.tier, score: C.legacy.sc, rings: C.rings }]);
    return C.legacy;
  };
  // Offres de poste d'entraîneur : les franchises en reconstruction, et l'ancien club pour une légende.
  BM.careerCoachOffers = function (g) {
    var C = g.career, list = g.teams.slice().sort(function (a, b) { return a.rep - b.rep; }).slice(0, 6);
    var picks = g.rng.shuffle(list).slice(0, 3).map(function (t) { return t.id; });
    if (C.lastTeam !== null && C.lastTeam !== undefined && C.legacy.sc >= 32 && picks.indexOf(C.lastTeam) < 0) picks[0] = C.lastTeam;
    return picks;
  };
  // Le joueur devient coach : la même sauvegarde bascule en mode Manager.
  BM.careerBecomeCoach = function (g, teamId) {
    var C = g.career, p = BM.cPlayer(g);
    g.mode = 'manager';
    g.userTeam = teamId;
    g.managerName = BM.fullName(p);
    g.board = { confidence: 60 + Math.min(20, Math.round(C.legacy.sc / 5)) };
    g.training = { focus: 'equilibre', intensity: 'normale' };
    g.staff = null; g.know = null; g.staffPool = null;
    BM.initScouting(g);
    C.phase = 'coach';
    var team = g.teams[teamId];
    BM.autoTactics(g, team);
    BM.startNewSeason(g);
    BM.addMessage(g, 'Bienvenue à ' + team.name + ', coach ' + p.last, 'Votre carrière de joueur est terminée (' + C.legacy.tier.toLowerCase() + '). La direction de ' + team.name +
      ' vous confie l\'équipe.\n\nObjectif : ' + BM.OBJECTIVES[g.objective] + '.', 'board');
    return team;
  };
})();
