var BM = globalThis.BM = globalThis.BM || {};

// Mode carrière en match : moments clés où le joueur décide, résolus par le vrai moteur sur la possession suivante.
// Les moments n'existent qu'en direct (récompense du joueur qui suit le match), jamais en simulation instantanée.
(function () {
  var M = BM.Match.prototype;

  // Prépare le match pour le joueur du mode carrière.
  BM.careerSetupMatch = function (m, g, live) {
    var C = g.career;
    if (!C || C.phase !== 'nba') return;
    var p = g.players[C.pid];
    var side = m.roster[0].some(function (x) { return x.id === p.id; }) ? 0 : m.roster[1].some(function (x) { return x.id === p.id; }) ? 1 : -1;
    if (side < 0) return; // blessé ou suspendu : il regarde depuis le banc
    var r = m.rng, Q = BM.QUARTER_MIN * 60;
    m.career = {
      pid: p.id, side: side, ment: C.ment || 'equil', live: !!live, usage: 0, decisions: 0, clutchMade: 0, good: 0,
      // Quatre moments répartis dans le match, plus la dernière possession si elle est serrée.
      at: [r.range(0.35, 0.8) * Q, r.range(1.25, 1.8) * Q, r.range(2.3, 2.8) * Q, r.range(3.25, 3.6) * Q],
      clutchDone: {}, used: {}
    };
  };

  M.badgeBonus = function (p, type) {
    var b = p.badges || {};
    var lvl = type === 'three' ? b.sniper : type === 'mid' ? b.createur : b.finisseur;
    var bonus = (lvl || 0) * 0.006;
    if (this.clutch()) bonus += (b.glace || 0) * 0.008;
    return bonus;
  };

  // Tireur désigné par la décision du joueur.
  M.careerShooter = function (cf, O, me) {
    var self = this, mates = O.filter(function (p) { return p !== me; });
    if (cf.shooter === 'me' || !mates.length) return me;
    if (cf.shooter === 'big') {
      var bigs = mates.filter(function (p) { return p.pos === 'PIV' || p.pos === 'AF'; });
      return (bigs.length ? bigs : mates).sort(function (a, b) { return self.a(b, 'fin') - self.a(a, 'fin'); })[0];
    }
    // « open » : le meilleur shooteur, laissé seul par la défense attirée.
    return mates.sort(function (a, b) { return self.a(b, 'tir3') - self.a(a, 'tir3'); })[0];
  };

  M.meOnCourt = function () {
    var c = this.career;
    return !!c && this.on[c.side].indexOf(c.pid) >= 0 && !this.out[c.pid];
  };

  // Vérifié au début de chaque possession : déclenche un moment si c'est le bon moment.
  M.checkMoment = function () {
    var c = this.career;
    if (!c || this.finished || !this.meOnCourt()) return false;
    var lead = this.score[c.side] - this.score[1 - c.side];
    var clutchKey = this.q + '-' + (this.poss === c.side ? 'o' : 'd');
    if (this.q >= 4 && this.clock <= 26 && this.clock > 4 && Math.abs(lead) <= 3 && !c.clutchDone[clutchKey]) {
      c.clutchDone[clutchKey] = true;
      this.pendingMoment = this.poss === c.side ? this.clutchOffMoment(lead) : this.clutchDefMoment(lead);
      return true;
    }
    if (c.at.length && this.elapsed >= c.at[0]) {
      c.at.shift();
      this.pendingMoment = this.poss === c.side ? this.offMoment() : this.defMoment();
      return !!this.pendingMoment;
    }
    return false;
  };

  function mk(kind, id, title, text, choices) { return { kind: kind, id: id, title: title, text: text, choices: choices }; }
  M.momentLine = function () {
    var c = this.career, b = this.box[c.pid];
    return 'Toi : ' + b.pts + ' pts, ' + (b.oreb + b.dreb) + ' reb, ' + b.ast + ' pd en ' + Math.round(b.sec / 60) + ' min. Énergie ' + Math.round(this.en[c.pid]) + '.';
  };
  M.oppStar = function () {
    var self = this, D = this.lineup(1 - this.career.side);
    return D.slice().sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); })[0];
  };

  M.offMoment = function () {
    var c = this.career, me = this.p(c.pid), self = this, ids = ['pnr', 'pnr', 'transition'];
    var mm = this.mismatch(c.side, c.pid);
    if (mm.val >= 2) ids.push('iso', 'iso');
    var sch = this.tac[1 - c.side].defense;
    if (sch === 'zone' || sch === 'drop') ids.push('zone');
    if (this.isHot(c.pid)) ids.push('hot', 'hot');
    ids = ids.filter(function (id) { return !c.used[id] || ids.length <= 2; });
    var id = this.rng.pick(ids);
    c.used[id] = true;
    var O = this.lineup(c.side).filter(function (p) { return p !== me; });
    var big = O.filter(function (p) { return p.pos === 'PIV' || p.pos === 'AF'; })[0] || O[0];
    var shooter = O.slice().sort(function (a, b) { return self.a(b, 'tir3') - self.a(a, 'tir3'); })[0];
    var vs = mm.vs ? this.p(mm.vs) : null, line = this.momentLine();
    c.ctx = { big: big ? big.id : null, shooter: shooter ? shooter.id : null, mm: mm };
    var best3 = me.attrs.tir3 >= me.attrs.tirMi;
    switch (id) {
      case 'pnr': return mk('off', 'pnr', 'Pick and roll', 'Écran de ' + BM.shortName(big) + '. Son défenseur recule, le tien passe sous l\'écran. ' + line, [
        { t: best3 ? 'Tirer à 3 pts derrière l\'écran' : 'Pull-up à mi-distance', h: (best3 ? 'Tir à 3 pts ' : 'Mi-distance ') + (best3 ? me.attrs.tir3 : me.attrs.tirMi) },
        { t: 'Servir ' + BM.shortName(big) + ' qui plonge', h: 'Passe ' + me.attrs.pas },
        { t: 'Attaquer le décalage jusqu\'au cercle', h: 'Finition ' + me.attrs.fin + ' · dribble ' + me.attrs.drb }]);
      case 'iso': return mk('off', 'iso', 'Mismatch', BM.shortName(vs) + ' se retrouve sur toi (' + (mm.kind === 'int' ? 'avantage au poste' : 'avantage à l\'extérieur') + ', +' + mm.val + '). ' + line, [
        { t: mm.kind === 'int' ? 'L\'emmener au poste bas' : 'L\'isoler en dribble', h: 'Le mismatch joue pour toi' },
        { t: 'Faire tourner, ils vont devoir aider', h: 'Lecture du jeu ' + me.attrs.qi }]);
      case 'zone': return mk('off', 'zone', 'Défense resserrée', 'Ils ferment la raquette et laissent de l\'espace loin du cercle. ' + line, [
        { t: 'Punir de loin', h: 'Tir à 3 pts ' + me.attrs.tir3 },
        { t: 'Attaquer le cœur de la défense et ressortir', h: 'Passe ' + me.attrs.pas + ' · lecture ' + me.attrs.qi },
        { t: 'Laisser tourner le ballon', h: '' }]);
      case 'hot': return mk('off', 'hot', 'Tu es en feu', 'La salle se lève à chaque fois que tu touches le ballon. ' + line, [
        { t: 'Réclamer tous les ballons', h: 'Plus de tirs pour toi pendant quelques minutes' },
        { t: 'Prendre ce tir, tout de suite', h: 'Tir difficile, mais tu es chaud' },
        { t: 'Revenir au système', h: 'Le coach et les coéquipiers apprécient' }]);
      default: return mk('off', 'transition', 'Contre-attaque', 'Rebond défensif, tu pousses le ballon. ' + BM.shortName(shooter) + ' court à ta gauche, un seul défenseur recule. ' + line, [
        { t: 'Servir ' + BM.shortName(shooter), h: 'Le choix sûr' },
        { t: 'Finir toi-même', h: 'Finition ' + me.attrs.fin },
        { t: 'Tenter le dunk spectaculaire', h: 'Détente ' + me.attrs.det + ' · énorme si ça passe' }]);
    }
  };

  M.defMoment = function () {
    var c = this.career, me = this.p(c.pid), star = this.oppStar(), ids = ['stardef', 'charge', 'gamble'];
    ids = ids.filter(function (id) { return !c.used[id]; });
    if (!ids.length) ids = ['stardef', 'charge', 'gamble'];
    var id = this.rng.pick(ids);
    c.used[id] = true;
    c.ctx = { star: star.id };
    var line = this.momentLine();
    switch (id) {
      case 'stardef': return mk('def', 'stardef', BM.shortName(star) + ' est chaud', BM.shortName(star) + ' remonte le ballon et cherche le duel. ' + line, [
        { t: 'Demander à défendre sur lui', h: 'Défense ext. ' + me.attrs.defE + ' · vitesse ' + me.attrs.vit },
        { t: 'Rester dans le plan du coach', h: 'Défense collective' }]);
      case 'charge': return mk('def', 'charge', 'Dernier rempart', BM.shortName(star) + ' fonce vers le cercle. Tu es le dernier défenseur. ' + line, [
        { t: 'Prendre le passage en force', h: 'Lecture du jeu ' + me.attrs.qi },
        { t: 'Tenter le contre', h: 'Contre ' + me.attrs.ctr + ' · détente ' + me.attrs.det },
        { t: 'Le laisser passer, éviter la faute', h: 'Prudence' }]);
      default: return mk('def', 'gamble', 'Ligne de passe', 'Tu lis l\'attaque : le meneur adverse regarde trop longtemps son ailier. ' + line, [
        { t: 'Jouer l\'interception', h: 'Interception ' + me.attrs.int + ' · risque de faute' },
        { t: 'Rester sur ton joueur', h: 'Sobre' }]);
    }
  };

  M.clutchOffMoment = function (lead) {
    var c = this.career, me = this.p(c.pid);
    var txt = lead === 0 ? 'Égalité ' + this.score[c.side] + '-' + this.score[1 - c.side] + ', ' + Math.round(this.clock) + ' secondes. Le coach a dessiné l\'action pour toi.'
      : lead < 0 ? (-lead) + ' point' + (lead < -1 ? 's' : '') + ' de retard, ' + Math.round(this.clock) + ' secondes. Le ballon est dans tes mains.'
        : 'Vous menez de ' + lead + ', ' + Math.round(this.clock) + ' secondes. Il faut un panier pour plier le match.';
    var ch = [{ t: lead === -3 ? 'Prendre le tir à 3 pts' : 'Prendre le dernier tir', h: 'Sang-froid ' + me.attrs.sf + ' · adresse' }];
    if (lead >= -2) ch.push({ t: 'Attaquer le cercle et chercher la faute', h: 'Finition ' + me.attrs.fin + ', puis lancers francs' });
    ch.push({ t: 'Attirer la défense et servir le partenaire ouvert', h: 'Ta gravité et la confiance de tes coéquipiers' });
    return mk('cOff', 'cOff', 'Dernière possession', txt, ch);
  };

  M.clutchDefMoment = function (lead) {
    var c = this.career, star = this.oppStar();
    c.ctx = { star: star.id };
    var ch = [{ t: 'Défendre ' + BM.shortName(star) + ' toi-même', h: 'Défense ext. ' + this.p(c.pid).attrs.defE }];
    ch.push({ t: 'Jouer l\'interception', h: 'Tout ou rien' });
    ch.push({ t: 'Rester dans le plan, aide collective', h: 'La défense de l\'équipe' });
    var txt = (lead > 0 ? '+' + lead : lead === 0 ? 'Égalité' : lead) + ', ' + Math.round(this.clock) + ' secondes. ' + BM.shortName(star) + ' a le ballon.';
    return mk('cDef', 'cDef', 'Défense finale', txt, ch);
  };

  // Applique la décision. Renvoie le texte affiché au joueur.
  M.resolveMoment = function (idx) {
    var c = this.career, M0 = this.pendingMoment, me = this.p(c.pid), a = me.attrs, r = this.rng;
    this.pendingMoment = null;
    if (!M0 || !c) return '';
    c.decisions++;
    var ctx = c.ctx || {}, out = '', next = null, nextDef = null;
    var z = function (v) { return (v - 12) * 0.006; }; // attribut au-dessus de la moyenne = bonus
    switch (M0.id) {
      case 'pnr':
        if (idx === 0) { var b3 = a.tir3 >= a.tirMi; next = { shooter: 'me', type: b3 ? 'three' : 'mid', bonus: 0.03 + z(b3 ? a.tir3 : a.tirMi) }; out = 'Tu prends le tir derrière l\'écran.'; }
        else if (idx === 1) { next = { shooter: 'big', type: 'rim', bonus: 0.05 + z(a.pas), passer: true }; out = 'Tu attires deux défenseurs et lobes vers le cercle.'; }
        else { next = { shooter: 'me', type: 'rim', bonus: 0.02 + z(a.fin) * 0.6 + z(a.drb) * 0.4, foulUp: 0.08 }; out = 'Tu attaques le décalage.'; }
        break;
      case 'iso':
        if (idx === 0) { var mm = ctx.mm || { val: 2, kind: 'ext' }; next = { shooter: 'me', type: mm.kind === 'int' ? 'rim' : (a.tir3 >= a.tirMi ? 'three' : 'mid'), bonus: 0.025 + mm.val * 0.008, foulUp: mm.kind === 'int' ? 0.06 : 0 }; out = 'Tu exploites le mismatch.'; }
        else { next = { shooter: 'open', type: null, bonus: 0.025 + z(a.qi), passer: true }; out = 'Le ballon tourne, la défense doit aider.'; }
        break;
      case 'zone':
        if (idx === 0) { next = { shooter: 'me', type: 'three', bonus: 0.02 + z(a.tir3) * 1.3 }; out = a.tir3 >= 14 ? 'Tu te places derrière l\'arc. La zone va devoir sortir.' : 'Tu tentes de punir de loin. Pas sûr que ce soit ton arme.'; }
        else if (idx === 1) { next = { shooter: 'open', type: null, bonus: 0.02 + z(a.pas) + z(a.qi) * 0.5, passer: true, tov: a.qi < 10 ? 0.06 : 0 }; out = 'Tu reçois au cœur de la défense et tu ressors.'; }
        else { out = 'Le ballon tourne.'; }
        break;
      case 'hot':
        if (idx === 0) { c.usage = 0.8; c.usageUntil = this.elapsed + 240; out = '« Donnez-moi la balle. » Message reçu pour les 4 prochaines minutes.'; }
        else if (idx === 1) { next = { shooter: 'me', type: a.tir3 >= a.tirMi ? 'three' : 'mid', bonus: 0.04 - 0.02 }; out = 'Tu dégaines sans réfléchir.'; }
        else { c.coachPlus = (c.coachPlus || 0) + 1; out = 'Tu reviens au système. Le banc apprécie.'; }
        break;
      case 'transition':
        if (idx === 0) { next = { shooter: 'open', type: 'rim', fast: true, bonus: 0.03, passer: true }; out = 'Passe à l\'aveugle, lay-up facile.'; }
        else if (idx === 1) { next = { shooter: 'me', type: 'rim', fast: true, bonus: z(a.fin) }; out = 'Tu fonces vers le cercle.'; }
        else { next = { shooter: 'me', type: 'rim', fast: true, bonus: (a.det - 13) * 0.025, dunk: true }; c.dunkTry = true; out = 'Tu décolles…'; }
        break;
      case 'stardef':
        if (idx === 0) { nextDef = { forceShooter: ctx.star, bonus: -(0.03 + z(a.defE) + z(a.vit) * 0.5) }; out = 'Tu prends le duel. Tout le monde regarde.'; }
        else { nextDef = { bonus: -0.012 }; out = 'Défense collective, chacun à sa place.'; }
        break;
      case 'charge':
        if (idx === 0) { nextDef = { forceShooter: ctx.star, charge: BM.clamp(0.25 + (a.qi - 10) * 0.025, 0.1, 0.55) }; out = 'Tu plantes tes appuis.'; }
        else if (idx === 1) { nextDef = { forceShooter: ctx.star, block: BM.clamp(0.18 + (a.ctr - 10) * 0.025 + (a.det - 10) * 0.012, 0.06, 0.55) }; out = 'Tu sautes avec lui.'; }
        else { nextDef = { forceShooter: ctx.star, bonus: 0.08 }; out = 'Tu le laisses passer.'; }
        break;
      case 'gamble':
        if (idx === 0) { nextDef = { steal: BM.clamp(0.16 + (a.int - 10) * 0.025, 0.08, 0.45), foul: 0.35, bonus: 0.06 }; out = 'Tu sautes dans la ligne de passe.'; }
        else { nextDef = { bonus: -0.008 }; out = 'Tu restes collé à ton joueur.'; }
        break;
      case 'cOff':
        var lead = this.score[c.side] - this.score[1 - c.side];
        if (idx === 0) { next = { shooter: 'me', type: lead === -3 ? 'three' : (a.tir3 >= a.tirMi + 2 ? 'three' : 'mid'), bonus: z(a.sf) * 1.5 + 0.02 }; out = 'Le ballon est pour toi.'; }
        else if (idx === 1 && M0.choices.length === 3) { next = { shooter: 'me', type: 'rim', bonus: z(a.fin), foulUp: 0.15 }; out = 'Tu attaques le cercle.'; }
        else { next = { shooter: 'open', type: lead === -3 ? 'three' : null, bonus: 0.04 + z(a.pas) * 0.5, passer: true }; out = 'Tu attires la défense et tu sers le partenaire ouvert.'; }
        c.clutchTry = true;
        break;
      case 'cDef':
        if (idx === 0) { nextDef = { forceShooter: ctx.star, bonus: -(0.04 + z(a.defE) * 1.2) }; out = 'Tu prends leur star.'; }
        else if (idx === 1) { nextDef = { steal: BM.clamp(0.14 + (a.int - 10) * 0.02, 0.06, 0.35), foul: 0.4, bonus: 0.1 }; out = 'Tout ou rien.'; }
        else { nextDef = { bonus: -0.02 }; out = 'Aide collective.'; }
        break;
    }
    if (next) c.next = next;
    if (nextDef) c.nextDef = nextDef;
    c.lastMoment = { id: M0.id, choice: idx };
    this.log('info', c.side, 'Décision : ' + M0.choices[idx].t + '.');
    return out;
  };

  // Usage renforcé limité dans le temps (« réclamer tous les ballons »).
  var baseTick = M.tick;
  M.tick = function (dur) {
    baseTick.call(this, dur);
    var c = this.career;
    if (c && c.usageUntil && this.elapsed >= c.usageUntil) { c.usage = 0; c.usageUntil = 0; }
  };
})();
