var BM = globalThis.BM = globalThis.BM || {};

// Pôle développement, sur le modèle du Development Hub de FM26 : focus individuel, mentorat,
// repositionnement, G League (équivalent des prêts), rapports du staff et recommandations.
(function () {
  BM.DEV_FOCUS = {
    auto: { l: 'Programme de l\'équipe', attrs: null },
    tir: { l: 'Tir extérieur', attrs: ['tir3', 'tirMi', 'lf'] },
    finition: { l: 'Finition au cercle', attrs: ['fin', 'det', 'for'] },
    creation: { l: 'Création (dribble, passe)', attrs: ['drb', 'pas', 'qi'] },
    defext: { l: 'Défense extérieure', attrs: ['defE', 'int', 'vit'] },
    defint: { l: 'Protection du cercle', attrs: ['defI', 'ctr', 'reb'] },
    physique: { l: 'Physique', attrs: ['vit', 'det', 'for', 'end'] },
    mental: { l: 'QI basket & sang-froid', attrs: ['qi', 'sf', 'act'] },
    role: { l: 'Travail du rôle', attrs: null }
  };
  var ADJ = { MEN: ['ARR'], ARR: ['MEN', 'AIL'], AIL: ['ARR', 'AF'], AF: ['AIL', 'PIV'], PIV: ['AF'] };
  BM.adjacentPositions = function (pos) { return ADJ[pos] || []; };
  BM.GLEAGUE_MAX = 4;

  BM.focusAttrs = function (team, p) {
    var f = BM.DEV_FOCUS[p.devFocus];
    if (!f || p.devFocus === 'auto') return null;
    if (p.devFocus === 'role') return Object.keys(BM.ROLES[BM.roleOf(team, p)].key);
    return f.attrs;
  };

  // Multiplicateur de progression : temps de jeu, G League, mentorat, staff.
  BM.devMultiplier = function (g, team, p) {
    var m = 1, r = p.recent || [];
    var avgMin = r.length ? r.reduce(function (s, x) { return s + x.min; }, 0) / r.length : 0;
    if (p.age <= 24 && avgMin >= 20) m *= 1.3;
    if (p.gleague) m *= 1.6;
    if ((team.mentoring || []).some(function (x) { return x.pupil === p.id; })) m *= 1.15;
    if (BM.staffBonus) m *= BM.staffBonus(g, team, 'dev');
    return m;
  };

  // Appelé chaque jour d'entraînement pour chaque joueur valide ; renvoie true si la progression est gérée ici.
  BM.devProgress = function (g, team, p, teamAttrs, inten) {
    var rng = g.rng;
    if (p.retrain) return true; // le temps d'entraînement est consacré au nouveau poste
    var cur = BM.ovrRaw(p), gap = p.pot - cur;
    if (gap > 0 && p.age <= 29) {
      var ageF = p.age <= 20 ? 1.4 : p.age <= 23 ? 1.1 : p.age <= 26 ? 0.7 : 0.35;
      var chance = 0.035 * ageF * inten.prog * BM.clamp(gap / 3, 0.3, 1.5) * (0.8 + p.attrs.act / 50) * BM.devMultiplier(g, team, p);
      if (rng.chance(chance)) {
        var own = BM.focusAttrs(team, p);
        BM.improve(g, p, own && rng.chance(0.65) ? own : teamAttrs);
      }
    }
    return true;
  };

  // Mentorat, repositionnement et G League : une fois par jour et par équipe.
  BM.devDaily = function (g, team, matchDay) {
    var rng = g.rng, user = team.id === g.userTeam;
    team.mentoring = (team.mentoring || []).filter(function (x) {
      var m = g.players[x.mentor], pu = g.players[x.pupil];
      return m && pu && m.teamId === team.id && pu.teamId === team.id;
    });
    team.mentoring.forEach(function (x) {
      var m = g.players[x.mentor], pu = g.players[x.pupil];
      pu.morale = Math.min(100, pu.morale + 0.3);
      if (rng.chance(0.025 * (m.attrs.lead / 15))) {
        var ks = ['qi', 'sf', 'act', 'lead'].filter(function (k) { return m.attrs[k] > pu.attrs[k] && pu.attrs[k] < 20; });
        if (ks.length) {
          var k = rng.pick(ks);
          pu.attrs[k]++;
          pu.lastProgress = { k: k, day: g.day };
          if (user && rng.chance(0.3)) BM.addMessage(g, 'Mentorat : ' + BM.fullName(pu), BM.fullName(m) + ' transmet son expérience : ' + BM.ATTRS.find(function (a) { return a.k === k; }).l + ' +1.', 'dev');
        }
      }
    });
    BM.roster(g, team).forEach(function (p) {
      if (p.retrain) {
        p.retrain.progress = Math.min(100, p.retrain.progress + (matchDay ? 0.5 : 1.2) * (BM.staffBonus ? BM.staffBonus(g, team, 'dev') : 1));
        if (p.retrain.progress >= 100) {
          var from = p.pos;
          p.pos = p.retrain.to;
          p.retrain = null;
          if (user) BM.addMessage(g, 'Repositionnement terminé : ' + BM.fullName(p), BM.fullName(p) + ' est désormais ' + BM.POS_LABEL[p.pos].toLowerCase() + ' (ancien poste : ' + BM.POS_LABEL[from].toLowerCase() + '). Note : ' + BM.ovr(p) + '.', 'dev');
        }
      }
      // Match de G League tous les trois jours : temps de jeu garanti.
      if (p.gleague && g.day % 3 === 0 && p.injury <= 0) {
        var q = BM.ovrRaw(p);
        var line = { pts: Math.max(0, Math.round(rng.gauss(q * 1.4, 5))), reb: Math.max(0, Math.round(rng.gauss(4, 2))), ast: Math.max(0, Math.round(rng.gauss(3, 2))) };
        p.gl = p.gl || { gp: 0, pts: 0, reb: 0, ast: 0 };
        p.gl.gp++; p.gl.pts += line.pts; p.gl.reb += line.reb; p.gl.ast += line.ast;
        p.morale = Math.min(100, p.morale + 1);
        p.condition = Math.max(60, p.condition - 8);
      }
    });
  };

  // ---------------------------------------------------------------- rapports du staff
  var posMeans = function (g) {
    var key = g.season + ':' + g.day;
    if (g._posMeans && g._posMeans.key === key) return g._posMeans;
    var out = { key: key };
    BM.POSITIONS.forEach(function (pos) {
      var ps = Object.keys(g.players).map(function (id) { return g.players[id]; }).filter(function (p) { return p.teamId !== null && p.pos === pos; });
      out[pos] = {};
      BM.ATTRS.forEach(function (a) { out[pos][a.k] = ps.reduce(function (s, p) { return s + p.attrs[a.k]; }, 0) / Math.max(1, ps.length); });
    });
    Object.defineProperty(g, '_posMeans', { value: out, writable: true, enumerable: false, configurable: true });
    return out;
  };

  BM.potentialLabel = function (pot) {
    var v = pot * 5;
    return v >= 92 ? 'Futur MVP' : v >= 87 ? 'Futur All-Star' : v >= 80 ? 'Titulaire de qualité' : v >= 72 ? 'Joueur de rotation' : v >= 64 ? 'Fin de banc' : 'Limité';
  };

  BM.coachReport = function (g, team, p) {
    var mean = posMeans(g)[p.pos], w = BM.POS_WEIGHTS[p.pos];
    var rel = BM.ATTRS.filter(function (a) { return w[a.k]; }).map(function (a) { return { k: a.k, l: a.l, d: p.attrs[a.k] - mean[a.k], v: p.attrs[a.k] }; });
    rel.sort(function (a, b) { return b.d - a.d; });
    var weakest = rel[rel.length - 1];
    var focus = Object.keys(BM.DEV_FOCUS).find(function (f) { return BM.DEV_FOCUS[f].attrs && BM.DEV_FOCUS[f].attrs.indexOf(weakest.k) >= 0; }) || 'auto';
    var est = BM.scoutEstimate ? BM.scoutEstimate(g, p) : { pot: p.pot };
    var delta = p.seasonStartOvr ? BM.ovr(p) - Math.round(p.seasonStartOvr * 5) : 0;
    return {
      strengths: rel.slice(0, 3), weaknesses: rel.slice(-3).reverse(), role: BM.bestRole(p), focus: focus,
      potential: BM.potentialLabel(est.pot), delta: delta
    };
  };

  // ---------------------------------------------------------------- recommandations
  BM.devRecommendations = function (g, team) {
    var recs = [], roster = BM.roster(g, team);
    var ranked = roster.slice().sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); });
    var avgMin = function (p) { var r = p.recent || []; return r.length ? r.reduce(function (s, x) { return s + x.min; }, 0) / r.length : 0; };
    var inGL = roster.filter(function (p) { return p.gleague; }).length;
    var available = BM.availablePlayers(g, team).length;
    var mentored = {}, mentors = {};
    (team.mentoring || []).forEach(function (x) { mentored[x.pupil] = 1; mentors[x.mentor] = 1; });

    roster.forEach(function (p) {
      var rank = ranked.indexOf(p), name = BM.shortName(p);
      if (p.contract.years <= 1 && rank < 8) recs.push({ t: 'Prolonger ' + name, why: 'Fin de contrat, pièce importante de la rotation.', act: 'extend', id: p.id });
      if (!p.gleague && p.age <= 22 && rank >= 9 && avgMin(p) < 12 && inGL < BM.GLEAGUE_MAX && available > 11)
        recs.push({ t: 'Envoyer ' + name + ' en G League', why: 'Jeune, peu de minutes : du temps de jeu accélérerait sa progression.', act: 'gleague', id: p.id });
      if (p.gleague && rank < 9) recs.push({ t: 'Rappeler ' + name + ' de G League', why: 'Son niveau justifie une place dans la rotation NBA.', act: 'gleague', id: p.id });
      if (!p.retrain) {
        BM.adjacentPositions(p.pos).forEach(function (pos) {
          var gain = (BM.ovrRaw(p, pos) - BM.ovrRaw(p)) * 5;
          if (gain >= 2.5) recs.push({ t: 'Repositionner ' + name + ' en ' + BM.POS_LABEL[pos].toLowerCase(), why: 'Son profil y vaudrait +' + Math.round(gain) + ' de note.', act: 'retrain', id: p.id, pos: pos });
        });
      }
      if (p.age <= 24 && (!p.devFocus || p.devFocus === 'auto') && p.pot - BM.ovrRaw(p) > 1) {
        var rep = BM.coachReport(g, team, p);
        recs.push({ t: 'Focus individuel pour ' + name + ' : ' + BM.DEV_FOCUS[rep.focus].l, why: 'Point faible principal : ' + rep.weaknesses[0].l.toLowerCase() + '.', act: 'focus', id: p.id, focus: rep.focus });
      }
      if (p.contract.salary > 15000 && rank >= 9 && p.age >= 29 && !p.listed)
        recs.push({ t: 'Placer ' + name + ' sur la liste des transferts', why: 'Salaire élevé (' + BM.money(p.contract.salary) + ') pour un rôle limité.', act: 'list', id: p.id });
    });
    // Mentorat : meilleur vétéran disponible pour le jeune au plus fort potentiel non suivi.
    var pupils = roster.filter(function (p) { return p.age <= 23 && !mentored[p.id]; }).sort(function (a, b) { return b.pot - a.pot; });
    var vets = roster.filter(function (p) { return p.age >= 28 && p.attrs.lead >= 13 && !mentors[p.id]; }).sort(function (a, b) { return b.attrs.lead - a.attrs.lead; });
    if (pupils.length && vets.length && (team.mentoring || []).length < 3)
      recs.push({ t: 'Confier ' + BM.shortName(pupils[0]) + ' à ' + BM.shortName(vets[0]), why: 'Mentorat : leadership ' + vets[0].attrs.lead + ', transmet QI, sang-froid et activité.', act: 'mentor', id: pupils[0].id, mentor: vets[0].id });
    return recs.slice(0, 10);
  };

  BM.applyRecommendation = function (g, team, r) {
    var p = g.players[r.id];
    if (!p || p.teamId !== team.id) return 'Recommandation expirée.';
    if (r.act === 'gleague') return BM.toggleGLeague(g, team, p);
    if (r.act === 'retrain') { p.retrain = { to: r.pos, progress: 0 }; return BM.shortName(p) + ' commence son repositionnement.'; }
    if (r.act === 'focus') { p.devFocus = r.focus; return 'Focus « ' + BM.DEV_FOCUS[r.focus].l + ' » pour ' + BM.shortName(p) + '.'; }
    if (r.act === 'list') { p.listed = true; return BM.shortName(p) + ' est sur la liste des transferts.'; }
    if (r.act === 'mentor') return BM.addMentoring(g, team, r.mentor, r.id);
    return '';
  };

  BM.toggleGLeague = function (g, team, p) {
    if (p.gleague) { p.gleague = false; return BM.shortName(p) + ' rejoint l\'effectif NBA.'; }
    var n = BM.roster(g, team).filter(function (x) { return x.gleague; }).length;
    if (n >= BM.GLEAGUE_MAX) return 'Maximum ' + BM.GLEAGUE_MAX + ' joueurs en G League.';
    if (BM.availablePlayers(g, team).length <= 10) return 'Il faut garder au moins 10 joueurs disponibles.';
    p.gleague = true;
    return BM.shortName(p) + ' part en G League (temps de jeu garanti, progression accélérée).';
  };

  BM.addMentoring = function (g, team, mentorId, pupilId) {
    team.mentoring = team.mentoring || [];
    var m = g.players[mentorId], pu = g.players[pupilId];
    if (!m || !pu || mentorId === pupilId) return 'Binôme invalide.';
    if (team.mentoring.length >= 3) return 'Trois binômes maximum.';
    if (team.mentoring.some(function (x) { return x.mentor === mentorId || x.pupil === pupilId || x.pupil === mentorId; })) return 'Un des joueurs est déjà engagé dans un binôme.';
    if (m.age < 26) return 'Le mentor doit être un joueur expérimenté (26 ans et plus).';
    team.mentoring.push({ mentor: mentorId, pupil: pupilId, since: g.day });
    return BM.shortName(m) + ' devient le mentor de ' + BM.shortName(pu) + '.';
  };
})();
