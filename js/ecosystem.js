var BM = globalThis.BM = globalThis.BM || {};

// Écosystème hors match, transposé des concepts de FM26 (dynamique du vestiaire, interactions,
// promesses, médias, récompenses) à la NBA : statuts, conférences de presse, All-Star, trophées, échanges.
(function () {
  // ---------------------------------------------------------------- personnalité et statut
  BM.PERSONAS = {
    pro: { l: 'Professionnel', d: 'Exemplaire, accepte les décisions.', mood: 0.6 },
    leader: { l: 'Leader né', d: 'Tient le vestiaire, très influent.', mood: 0.8 },
    ambitieux: { l: 'Ambitieux', d: 'Veut jouer et gagner tout de suite.', mood: 1.4 },
    sanguin: { l: 'Tempérament sanguin', d: 'Réagit fort aux critiques et au banc.', mood: 1.6 },
    loyal: { l: 'Loyal', d: 'Attaché au club, patient.', mood: 0.7 },
    discret: { l: 'Discret', d: 'Peu d\'influence, réactions modérées.', mood: 1 }
  };

  BM.assignPersona = function (g, p) {
    if (p.persona) return;
    var a = p.attrs, r = g.rng;
    var w = { pro: a.act + a.sf, leader: a.lead * 2 + (p.age > 28 ? 6 : 0), ambitieux: a.act + (p.age < 26 ? 8 : 0), sanguin: 26 - a.sf * 1.2, loyal: p.age > 30 ? 18 : 10, discret: 16 };
    p.persona = r.weighted(Object.keys(w), function (k) { return Math.max(1, w[k]) * r.range(0.6, 1.4); });
  };

  BM.STATUS = {
    franchise: { l: 'Joueur franchise', min: 32 },
    titulaire: { l: 'Titulaire', min: 26 },
    rotation: { l: 'Rotation', min: 16 },
    banc: { l: 'Fin de banc', min: 6 },
    espoir: { l: 'Espoir', min: 0 }
  };

  BM.assignStatuses = function (g, team) {
    var r = BM.roster(g, team).sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
    r.forEach(function (p, i) {
      p.status = i === 0 || (i === 1 && BM.ovr(p) >= 88) ? 'franchise' : i <= 4 ? 'titulaire' : i <= 8 ? 'rotation' : p.age <= 21 ? 'espoir' : 'banc';
    });
  };

  var avgMin = function (p, n) {
    var r = (p.recent || []).slice(-(n || 5));
    return r.length ? r.reduce(function (s, x) { return s + x.min; }, 0) / r.length : null;
  };

  // Raisons du moral (affichées comme les facteurs de bonheur de FM).
  BM.happiness = function (g, p) {
    var out = [], st = BM.STATUS[p.status || 'rotation'], m = avgMin(p);
    if (p.injury > 0) out.push({ l: 'Blessé', v: -1 });
    else if (m !== null) {
      var d = m - st.min;
      if (d <= -8) out.push({ l: 'Temps de jeu insuffisant pour un ' + st.l.toLowerCase(), v: -2 });
      else if (d >= 5) out.push({ l: 'Ravi de son temps de jeu', v: 2 });
      else out.push({ l: 'Temps de jeu conforme à son statut', v: 1 });
    }
    if (p.teamId !== null) {
      var t = g.teams[p.teamId], wp = t.record.w / Math.max(1, t.record.w + t.record.l);
      if (t.record.w + t.record.l >= 8) out.push(wp >= 0.6 ? { l: 'L\'équipe gagne', v: 1 } : wp <= 0.35 ? { l: 'Frustré par les résultats', v: -1 } : null);
    }
    if (p.contract.years <= 1 && p.age < 33 && BM.ovr(p) >= 70) out.push({ l: 'Attend une prolongation', v: -1 });
    var pr = (g.promises || []).find(function (x) { return x.pid === p.id; });
    if (pr) out.push({ l: 'Promesse en cours : ' + pr.target + ' min sur ' + pr.games + ' matchs', v: 0 });
    if (p.trust === 'broken') out.push({ l: 'N\'a plus confiance (promesse rompue)', v: -2 });
    var rel = p.rel === undefined ? 50 : p.rel;
    if (rel >= 72) out.push({ l: 'Excellente relation avec le coach', v: 1 });
    else if (rel <= 30) out.push({ l: 'Relation tendue avec le coach', v: -2 });
    return out.filter(Boolean);
  };

  // Après chaque match de l'utilisateur : réaction au temps de jeu selon le statut et la personnalité.
  BM.playingTimeMood = function (g, team, fx) {
    if (!BM.managed(g, team)) return;
    BM.roster(g, team).forEach(function (p) {
      var b = fx.box[p.id];
      if (!b || p.injury > 0 || p.gleague) return;
      var st = BM.STATUS[p.status || 'rotation'], per = BM.PERSONAS[p.persona || 'discret'];
      var d = b.min - st.min;
      if (d <= -10) p.morale = BM.clamp(p.morale - 2 * per.mood, 0, 100);
      else if (d >= 6) p.morale = BM.clamp(p.morale + 1, 0, 100);
    });
    BM.checkPromises(g, team);
  };

  // ---------------------------------------------------------------- dynamique du vestiaire
  BM.dynamics = function (g, team) {
    var r = BM.roster(g, team).map(function (p) {
      var inf = p.attrs.lead * 0.5 + Math.min(p.age, 34) * 0.25 + BM.ovrRaw(p) * 0.35 + (p.persona === 'leader' ? 3 : 0) + (p.status === 'franchise' ? 2 : 0);
      return { p: p, inf: inf };
    }).sort(function (a, b) { return b.inf - a.inf; });
    var leaders = r.slice(0, 3).map(function (x) { return x.p; }), influents = r.slice(3, 6).map(function (x) { return x.p; }), others = r.slice(6).map(function (x) { return x.p; });
    var w = 0, s = 0;
    r.forEach(function (x, i) { var k = i < 3 ? 2.5 : i < 6 ? 1.5 : 1; w += k; s += x.p.morale * k; });
    var atm = w ? s / w : 60;
    var label = atm >= 80 ? 'Excellente' : atm >= 66 ? 'Bonne' : atm >= 52 ? 'Correcte' : atm >= 38 ? 'Tendue' : 'Explosive';
    return { leaders: leaders, influents: influents, others: others, atmosphere: Math.round(atm), label: label };
  };

  // Une fois par jour : l'ambiance influe sur la cohésion ; un joueur très mécontent demande à vous parler.
  BM.ecoDaily = function (g) {
    if (BM.isAllStarDay(g) && !BM.managed(g, BM.myTeam(g))) { BM.allStar(g); return; }
    if (!BM.managed(g, BM.myTeam(g))) return;
    var me = g.teams[g.userTeam], dyn = BM.dynamics(g, me);
    me.cohesion = BM.clamp(me.cohesion + (dyn.atmosphere - 60) / 250, 20, 100);
    BM.roster(g, me).forEach(function (p) {
      if (p.morale < 30 && (!p.lastTalk || g.day - p.lastTalk > 14) && g.rng.chance(0.15)) {
        p.lastTalk = g.day;
        var reasons = BM.happiness(g, p).filter(function (x) { return x.v < 0; }).map(function (x) { return x.l.toLowerCase(); });
        BM.addMessage(g, BM.fullName(p) + ' veut vous parler', BM.fullName(p) + ' (' + BM.PERSONAS[p.persona].l.toLowerCase() + ') est mécontent : ' + (reasons.join(', ') || 'situation au club') + '.', 'dyn',
          [{ label: 'Promettre du temps de jeu', act: 'talk', pid: p.id, kind: 'promise' }, { label: 'Le rassurer', act: 'talk', pid: p.id, kind: 'reassure' }, { label: 'Fermer la porte', act: 'talk', pid: p.id, kind: 'dismiss' }]);
      }
    });
    if (BM.isAllStarDay(g)) BM.allStar(g);
  };

  // ---------------------------------------------------------------- interactions et promesses
  BM.TALKS = {
    praise: { l: 'Féliciter pour sa forme' },
    criticize: { l: 'Critiquer sa forme' },
    reassure: { l: 'Le rassurer sur son rôle' },
    promise: { l: 'Promettre plus de temps de jeu' },
    dismiss: { l: 'Fermer la porte' }
  };

  BM.interact = function (g, pid, kind) {
    var p = g.players[pid], per = BM.PERSONAS[p.persona || 'discret'], rng = g.rng, me = g.teams[g.userTeam];
    var form = p.form.length ? p.form.reduce(function (a, b) { return a + b; }, 0) / p.form.length : 6.5;
    var d = 0, txt;
    p.lastTalk = g.day;
    if (kind === 'praise') {
      if (form >= 7) { d = 5; txt = 'apprécie la reconnaissance et veut continuer sur sa lancée.'; }
      else { d = per === BM.PERSONAS.pro ? 1 : -2; txt = 'trouve les compliments déplacés vu ses performances.'; }
    } else if (kind === 'criticize') {
      if (form < 6.3) {
        d = p.persona === 'sanguin' ? -8 : p.persona === 'pro' || p.persona === 'leader' ? 4 : rng.chance(0.5) ? 3 : -3;
        txt = d > 0 ? 'prend la critique comme un défi et promet de réagir.' : 'le prend très mal et ferme le dialogue.';
      } else { d = -6; txt = 'ne comprend pas cette critique alors qu\'il joue bien.'; }
    } else if (kind === 'reassure') {
      d = p.trust === 'broken' ? -2 : p.persona === 'ambitieux' ? 1 : 4;
      txt = d > 0 ? 'est rassuré par votre discours.' : 'ne vous croit plus vraiment.';
    } else if (kind === 'promise') {
      if ((g.promises || []).some(function (x) { return x.pid === pid; })) return BM.fullName(p) + ' attend déjà que vous teniez votre promesse.';
      if (p.trust === 'broken') { d = -3; txt = 'refuse de vous croire après votre dernière promesse non tenue.'; }
      else {
        var target = Math.max(BM.STATUS[p.status || 'rotation'].min, Math.round((avgMin(p) || 10) + 8));
        g.promises = g.promises || [];
        g.promises.push({ pid: pid, target: Math.min(36, target), games: 8, start: g.day, played: [] });
        d = 8; txt = 'compte sur vous : au moins ' + Math.min(36, target) + ' minutes de moyenne sur les 8 prochains matchs.';
      }
    } else {
      d = p.persona === 'sanguin' ? -10 : p.persona === 'pro' ? -2 : -5;
      txt = 'repart frustré.';
      if (p.persona === 'sanguin' || p.persona === 'ambitieux') { p.listed = true; txt += ' Il demande à être transféré.'; }
    }
    p.morale = BM.clamp(p.morale + d, 0, 100);
    if (BM.relAdd) BM.relAdd(g, p, Math.round(d * 0.6));
    // Les leaders et l'ambiance réagissent aux conflits.
    if (d <= -6 && BM.dynamics(g, me).leaders.indexOf(p) >= 0) BM.roster(g, me).forEach(function (x) { if (x !== p) x.morale = BM.clamp(x.morale - 2, 0, 100); });
    return BM.fullName(p) + ' ' + txt;
  };

  BM.checkPromises = function (g, team) {
    if (team.id !== g.userTeam || !g.promises) return;
    g.promises = g.promises.filter(function (pr) {
      var p = g.players[pr.pid];
      if (!p || p.teamId !== team.id) return false;
      var last = p.recent && p.recent[p.recent.length - 1];
      pr.played.push(last ? last.min : 0);
      if (pr.played.length < pr.games) return true;
      var avg = pr.played.reduce(function (a, b) { return a + b; }, 0) / pr.played.length;
      if (avg >= pr.target - 1) {
        p.morale = BM.clamp(p.morale + 10, 0, 100); p.trust = 'ok';
        BM.addMessage(g, 'Promesse tenue : ' + BM.fullName(p), 'Il a joué ' + avg.toFixed(1) + ' min de moyenne. Sa confiance en vous grandit.', 'dyn');
      } else {
        p.morale = BM.clamp(p.morale - 20, 0, 100); p.trust = 'broken';
        BM.roster(g, team).forEach(function (x) { if (x !== p) x.morale = BM.clamp(x.morale - 2, 0, 100); });
        BM.addMessage(g, 'Promesse rompue : ' + BM.fullName(p), 'Seulement ' + avg.toFixed(1) + ' min de moyenne au lieu de ' + pr.target + '. Le vestiaire l\'a remarqué.', 'dyn');
      }
      return false;
    });
  };

  // ---------------------------------------------------------------- conférences de presse
  BM.pressConference = function (g, fx, when) {
    var me = g.teams[g.userTeam], opp = g.teams[fx.home === me.id ? fx.away : fx.home], rng = g.rng;
    var streak = me.record.streak || '', n = parseInt(streak.slice(1), 10) || 0, q = null;
    if (when === 'pre' && opp.rep >= me.rep + 8 && rng.chance(0.35)) {
      q = { k: 'underdog', q: 'Avant d\'affronter ' + opp.name + ', on vous donne largement perdants. Votre réaction ?',
        a: [['Nous n\'avons peur de personne.', 'Votre vestiaire adore (+moral), mais une défaite vous coûtera.'], ['Ils sont favoris, à nous de surprendre.', 'Réponse mesurée.'], ['Pas de commentaire.', 'Les journalistes notent votre froideur.']] };
    } else if (when === 'post' && streak.charAt(0) === 'D' && n >= 3 && rng.chance(0.5)) {
      q = { k: 'pressure', q: n + ' défaites de suite : votre poste est-il menacé ?',
        a: [['J\'ai toute la confiance de la direction.', 'Rassure les joueurs, agace un peu la direction.'], ['Les joueurs doivent se regarder dans la glace.', 'Électrochoc… ou fracture du vestiaire.'], ['On travaille, ça va tourner.', 'Réponse apaisante.']] };
    } else if (when === 'post' && streak.charAt(0) === 'V' && n >= 4 && rng.chance(0.4)) {
      q = { k: 'title', q: n + ' victoires d\'affilée : pouvez-vous viser le titre ?',
        a: [['Oui, c\'est notre objectif.', 'Le vestiaire s\'enflamme, la direction attendra beaucoup.'], ['Restons humbles, match après match.', 'Discours de vieux briscard.'], ['On en reparlera en avril.', 'Sourires dans la salle.']] };
    } else if (when === 'post' && rng.chance(0.15)) {
      var star = BM.roster(g, me).filter(function (p) { return p.form.length >= 3; })
        .sort(function (a, b) { return b.form.reduce(function (x, y) { return x + y; }, 0) / b.form.length - a.form.reduce(function (x, y) { return x + y; }, 0) / a.form.length; })[0];
      if (star) q = { k: 'star', pid: star.id, q: BM.fullName(star) + ' est en feu ces derniers temps. Est-il le meilleur à son poste ?',
        a: [['Le meilleur de la ligue, point.', 'Il sera ravi ; certains coéquipiers moins.'], ['Il brille grâce au collectif.', 'L\'équipe apprécie.'], ['Il peut encore progresser.', 'Il prendra ça comme un défi… ou un reproche.']] };
    }
    if (!q) return;
    BM.addMessage(g, 'Conférence de presse', q.q, 'media', q.a.map(function (a, i) {
      return { label: a[0], hint: a[1], act: 'press', k: q.k, i: i, pid: q.pid };
    }));
  };

  BM.pressAnswer = function (g, a) {
    var me = g.teams[g.userTeam], roster = BM.roster(g, me), all = function (d) { roster.forEach(function (p) { p.morale = BM.clamp(p.morale + d, 0, 100); }); };
    var res = '';
    if (a.k === 'underdog') {
      if (a.i === 0) { all(3); g.press = { bold: true, until: g.day + 1 }; res = 'Vos joueurs sont gonflés à bloc.'; }
      else if (a.i === 1) { all(1); res = 'Message reçu par le vestiaire.'; }
      else { g.board.confidence = BM.clamp(g.board.confidence - 1, 0, 100); res = 'Les médias vous trouvent distant.'; }
    } else if (a.k === 'pressure') {
      if (a.i === 0) { all(2); g.board.confidence = BM.clamp(g.board.confidence - 2, 0, 100); res = 'Les joueurs vous suivent, la direction grince des dents.'; }
      else if (a.i === 1) {
        roster.forEach(function (p) { var d = p.persona === 'pro' || p.persona === 'leader' ? 4 : p.persona === 'sanguin' ? -6 : -1; p.morale = BM.clamp(p.morale + d, 0, 100); });
        res = 'Les pros réagissent, les sanguins boudent.';
      } else { all(1); res = 'Discours apaisant.'; }
    } else if (a.k === 'title') {
      if (a.i === 0) { all(3); g.board.confidence = BM.clamp(g.board.confidence + 2, 0, 100); res = 'La salle s\'emballe, la direction aussi.'; }
      else { all(1); res = 'Réponse appréciée.'; }
    } else if (a.k === 'star') {
      var p = g.players[a.pid];
      if (p && a.i === 0) { p.morale = BM.clamp(p.morale + 8, 0, 100); roster.forEach(function (x) { if (x !== p && x.persona === 'ambitieux') x.morale = BM.clamp(x.morale - 3, 0, 100); }); res = BM.shortName(p) + ' est aux anges ; les ambitieux grimacent.'; }
      else if (a.i === 1) { all(2); res = 'Le collectif apprécie.'; }
      else if (p) { var d = p.persona === 'pro' ? 3 : p.persona === 'sanguin' ? -6 : -2; p.morale = BM.clamp(p.morale + d, 0, 100); res = d > 0 ? BM.shortName(p) + ' relève le défi.' : BM.shortName(p) + ' le prend mal.'; }
    }
    return res;
  };

  // ---------------------------------------------------------------- All-Star et trophées
  BM.isAllStarDay = function (g) {
    if (g.phase !== 'regular' || g.allStarDone === g.season) return false;
    var league = g.fixtures.filter(function (f) { return f.type === 'league'; });
    return league.length && league.filter(function (f) { return f.played; }).length >= league.length * 0.5;
  };

  var seasonScore = function (p) {
    var s = p.stats;
    if (!s.gp) return 0;
    return s.rtg / s.gp * 3 + s.pts / s.gp * 0.35 + (s.reb + s.ast) / s.gp * 0.15 + Math.min(s.gp, 50) * 0.05;
  };
  var award = function (g, p, t) { (p.awards = p.awards || []).push({ s: g.season, t: t }); };
  var players = function (g) { return Object.keys(g.players).map(function (id) { return g.players[id]; }).filter(function (p) { return p.teamId !== null && !p.retired; }); };

  BM.allStar = function (g) {
    g.allStarDone = g.season;
    var me = BM.myTeam(g) || { id: -1 }, picked = [];
    ['E', 'W'].forEach(function (c) {
      players(g).filter(function (p) { return g.teams[p.teamId].conf === c && p.stats.gp >= 10; })
        .sort(function (a, b) { return seasonScore(b) - seasonScore(a); }).slice(0, 12)
        .forEach(function (p) { award(g, p, 'All-Star'); picked.push(p); if (p.teamId === me.id) p.morale = BM.clamp(p.morale + 6, 0, 100); });
    });
    var mine = picked.filter(function (p) { return p.teamId === me.id; });
    BM.addMessage(g, 'All-Star Game ' + (2026 + g.season), 'Sélectionnés : ' + picked.slice(0, 6).map(function (p) { return BM.shortName(p); }).join(', ') + '…\n\n' +
      (mine.length ? 'Votre club place ' + mine.map(function (p) { return BM.fullName(p); }).join(', ') + ' !' : 'Aucun joueur de votre club cette année.'), 'board');
  };

  // Trophées de fin de saison : MVP, DPOY, ROY, 6e homme, MIP, coach de l'année, All-NBA.
  BM.seasonAwards = function (g) {
    var ps = players(g), out = {};
    var eligible = ps.filter(function (p) { return p.stats.gp >= 35; });
    var wp = function (p) { var r = g.teams[p.teamId].record; return r.w / Math.max(1, r.w + r.l); };
    var top = function (list, fn) { return list.slice().sort(function (a, b) { return fn(b) - fn(a); })[0]; };
    out.mvp = top(eligible, function (p) { return seasonScore(p) * (0.75 + wp(p) * 0.5); });
    out.dpoy = top(eligible, function (p) { var s = p.stats; return (s.stl + s.blk * 1.2) / s.gp * 2 + (p.attrs.defE + p.attrs.defI + p.attrs.ctr) / 6; });
    out.roy = top(eligible.filter(function (p) { return p.rookie; }), seasonScore);
    out.sixth = top(eligible.filter(function (p) { var t = g.teams[p.teamId]; var mpg = p.stats.min / p.stats.gp; return (t.tactics.starters || []).indexOf(p.id) < 0 && mpg >= 16 && mpg <= 30; }), seasonScore);
    out.mip = top(eligible, function (p) { return BM.ovrRaw(p) - (p.seasonStartOvr || BM.ovrRaw(p)); });
    var allNba = eligible.slice().sort(function (a, b) { return seasonScore(b) - seasonScore(a); }).slice(0, 15);
    var labels = { mvp: 'MVP', dpoy: 'Défenseur de l\'année', roy: 'Rookie de l\'année', sixth: '6e homme de l\'année', mip: 'Meilleure progression' };
    Object.keys(labels).forEach(function (k) { if (out[k]) award(g, out[k], labels[k]); });
    allNba.forEach(function (p, i) { award(g, p, 'All-NBA ' + (i < 5 ? '1re' : i < 10 ? '2e' : '3e') + ' équipe'); });
    // Coach de l'année : la plus forte surperformance par rapport à la réputation.
    var st = BM.standings(g), coy = g.teams.slice().sort(function (a, b) {
      var ra = g.teams.slice().sort(function (x, y) { return y.rep - x.rep; });
      return (ra.indexOf(b) - st.indexOf(b)) - (ra.indexOf(a) - st.indexOf(a));
    })[0];
    var summary = {};
    Object.keys(labels).forEach(function (k) { if (out[k]) summary[labels[k]] = BM.fullName(out[k]) + ' (' + g.teams[out[k].teamId].short + ')'; });
    summary['Coach de l\'année'] = BM.managed(g, coy) ? g.managerName + ' (vous !)' : 'Coach de ' + coy.name;
    if (BM.managed(g, coy)) g.board.confidence = BM.clamp(g.board.confidence + 10, 0, 100);
    summary.allNba = allNba.slice(0, 5).map(function (p) { return BM.shortName(p); }).join(', ');
    g.awardsHistory = g.awardsHistory || {};
    g.awardsHistory[g.season] = summary;
    return summary;
  };

  // ---------------------------------------------------------------- échanges
  // Date limite des échanges : après 60 % de la saison régulière.
  BM.tradeOpen = function (g) {
    if (g.phase !== 'regular') return g.phase !== 'playoffs';
    var league = g.fixtures.filter(function (f) { return f.type === 'league'; });
    return league.filter(function (f) { return f.played; }).length < league.length * 0.6;
  };

  // Valeur d'un joueur pour un club IA : un candidat au titre pense au présent, un club en reconstruction à l'avenir.
  BM.tradeValue = function (g, team, p) {
    var rank = BM.standings(g).indexOf(team), rebuilding = rank >= 18;
    var now = Math.pow(Math.max(1, BM.ovrRaw(p) - 7), 2.2), future = Math.pow(Math.max(1, p.pot - 7), 2.2);
    var v = rebuilding ? now * 0.4 + future * 0.6 : now * 0.8 + future * 0.2;
    if (p.age >= 32) v *= rebuilding ? 0.5 : 0.85;
    v -= p.contract.salary / 1000 * (rebuilding ? 0.9 : 0.5) * Math.min(p.contract.years, 3) / 2; // contrat lourd = négatif
    return v;
  };

  BM.evalTrade = function (g, partnerId, giveIds, getIds) {
    var me = g.teams[g.userTeam], ai = g.teams[partnerId];
    if (!BM.tradeOpen(g)) return { ok: false, mood: 'refuse', msg: 'La date limite des échanges est passée (réouverture après les playoffs).' };
    if (!giveIds.length || !getIds.length) return { ok: false, mood: 'refuse', msg: 'Sélectionnez des joueurs des deux côtés.' };
    var give = giveIds.map(function (id) { return g.players[id]; }), get = getIds.map(function (id) { return g.players[id]; });
    var sal = function (l) { return l.reduce(function (s, p) { return s + p.contract.salary; }, 0); };
    var out = sal(give), inn = sal(get);
    // Règle salariale simplifiée de la NBA : au-dessus du plafond, on ne reçoit pas plus de 125 % + 250 k$ de ce qu'on envoie.
    if (BM.payroll(g, me) - out + inn > me.wageBudget && inn > out * 1.25 + 250) return { ok: false, mood: 'refuse', msg: 'Salaires incompatibles : vous recevez ' + BM.money(inn) + ' pour ' + BM.money(out) + ' envoyés (max 125 % + 250 k$ au-dessus du plafond).' };
    if (BM.payroll(g, ai) - inn + out > ai.wageBudget && out > inn * 1.25 + 250) return { ok: false, mood: 'refuse', msg: ai.name + ' ne peut pas absorber ce salaire.' };
    if (me.roster.length - give.length + get.length > BM.ROSTER_MAX) return { ok: false, mood: 'refuse', msg: 'Votre effectif dépasserait ' + BM.ROSTER_MAX + ' joueurs.' };
    if (ai.roster.length - get.length + give.length > 15 || ai.roster.length - get.length + give.length < BM.ROSTER_MIN - 1) return { ok: false, mood: 'refuse', msg: ai.name + ' refuse : effectif déséquilibré.' };
    var vIn = give.reduce(function (s, p) { return s + BM.tradeValue(g, ai, p); }, 0);
    var vOut = get.reduce(function (s, p) { return s + BM.tradeValue(g, ai, p) * (BM.rankInTeam(g, p) < 2 ? 1.4 : 1); }, 0);
    var margin = vIn - vOut * 1.08;
    var mood = margin >= 0 ? 'accepte' : margin > -vOut * 0.15 ? 'hésite' : 'refuse';
    return { ok: margin >= 0, mood: mood, msg: ai.name + (margin >= 0 ? ' accepte l\'échange.' : margin > -vOut * 0.15 ? ' hésite : ajoutez un peu de valeur.' : ' refuse : l\'offre est trop faible.') };
  };

  // Recherche automatique d'offres d'échange réalistes à travers la ligue.
  BM.findTradeOffers = function (g, giveIds, getIds) {
    if (!BM.tradeOpen(g)) return [];
    var me = g.teams[g.userTeam], myRoster = BM.roster(g, me);
    var offers = [];
    // Cas 1 : l'utilisateur a sélectionné un ou plusieurs joueurs à céder -> les 29 clubs proposent une contrepartie.
    if (giveIds && giveIds.length) {
      g.teams.forEach(function (ai) {
        if (ai.id === me.id) return;
        var their = BM.roster(g, ai).filter(function (p) { return !p.injury; });
        for (var i = 0; i < their.length; i++) {
          var cand = [their[i].id];
          var ev = BM.evalTrade(g, ai.id, giveIds, cand);
          if (ev.ok) {
            offers.push({ partnerId: ai.id, give: giveIds.slice(), get: cand, score: BM.ovr(their[i]) * 10 - their[i].age * 0.4 });
          }
        }
      });
    } else if (getIds && getIds.length) {
      // Cas 2 : l'utilisateur vise un joueur adverse -> trouver quel(s) joueur(s) de notre effectif le club adverse accepterait.
      var target = g.players[getIds[0]];
      if (target && target.teamId !== null && target.teamId !== me.id) {
        var aiId = target.teamId;
        for (var a = 0; a < myRoster.length; a++) {
          var g1 = [myRoster[a].id];
          if (BM.evalTrade(g, aiId, g1, getIds).ok) {
            offers.push({ partnerId: aiId, give: g1, get: getIds.slice(), score: 100 - BM.ovr(myRoster[a]) });
          }
          for (var b = a + 1; b < myRoster.length; b++) {
            var g2 = [myRoster[a].id, myRoster[b].id];
            if (BM.evalTrade(g, aiId, g2, getIds).ok) {
              offers.push({ partnerId: aiId, give: g2, get: getIds.slice(), score: 95 - (BM.ovr(myRoster[a]) + BM.ovr(myRoster[b])) * 0.65 });
            }
          }
        }
      }
    } else {
      // Cas 3 : aucune sélection -> suggérer des pistes autour des joueurs mécontents ou remplaçables.
      var shoppable = myRoster.slice().sort(function (a, b) { return a.morale - b.morale || b.contract.salary - a.contract.salary; }).slice(0, 4);
      shoppable.forEach(function (mp) {
        g.teams.forEach(function (ai) {
          if (ai.id === me.id) return;
          BM.roster(g, ai).forEach(function (tp) {
            if (BM.evalTrade(g, ai.id, [mp.id], [tp.id]).ok && BM.ovr(tp) >= BM.ovr(mp) - 1) {
              offers.push({ partnerId: ai.id, give: [mp.id], get: [tp.id], score: BM.ovr(tp) * 10 - tp.age * 0.3 });
            }
          });
        });
      });
    }
    return offers.sort(function (a, b) { return b.score - a.score; }).slice(0, 6);
  };

  BM.executeTrade = function (g, partnerId, giveIds, getIds) {
    var ev = BM.evalTrade(g, partnerId, giveIds, getIds);
    if (!ev.ok) return ev;
    var me = g.teams[g.userTeam], ai = g.teams[partnerId];
    giveIds.forEach(function (id) { var p = g.players[id]; BM.addToTeam(g, p, ai); g.know[id] = Math.max(g.know[id] || 0, 100); });
    getIds.forEach(function (id) { var p = g.players[id]; BM.addToTeam(g, p, me); g.know[id] = 100; p.status = null; });
    BM.assignStatuses(g, me); BM.assignStatuses(g, ai);
    if (BM.news) BM.news(g, 'trade', 'BREAKING : échange entre les ' + me.name + ' et les ' + ai.name + ' (' + getIds.map(function (id) { return BM.fullName(g.players[id]); }).join(', ') + ').', true);
    BM.addMessage(g, 'Échange conclu avec ' + ai.name, 'Partent : ' + giveIds.map(function (id) { return BM.fullName(g.players[id]); }).join(', ') +
      '.\nArrivent : ' + getIds.map(function (id) { return BM.fullName(g.players[id]); }).join(', ') + '.', 'transfer');
    return { ok: true, msg: 'Échange conclu !' };
  };

  BM.initEcosystem = function (g) {
    Object.keys(g.players).forEach(function (id) { BM.assignPersona(g, g.players[id]); });
    g.teams.forEach(function (t) { if (BM.roster(g, t).some(function (p) { return !p.status; })) BM.assignStatuses(g, t); });
    g.promises = g.promises || [];
  };
})();
