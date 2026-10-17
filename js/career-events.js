var BM = globalThis.BM = globalThis.BM || {};

// Événements de vie du mode carrière (repris de Gravité, branchés sur la vraie ligue).
// Un événement tiré est figé (titre, texte, choix) dans la sauvegarde ; sa résolution est recalculée à partir de son id.
(function () {
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var COACHES = ['Ray Dalloway', 'Gene Whitcomb', 'Paula Marchetti', 'Ousmane Fofana', 'Lyle Brandt', 'Teresa Okoro', 'Dale Huxley', 'Samir Haddad', 'Vince Corrado', 'Irène Lacombe', 'Hank Pruitt', 'Bruno Salles', 'Marcel Doré', 'Kenji Abe', 'Tom Wexler', 'Nadia Rahmani'];

  BM.coachName = function (g, team) {
    g.coaches = g.coaches || {};
    if (!g.coaches[team.id]) {
      var h = 0;
      for (var i = 0; i < team.name.length; i++) h = (h * 31 + team.name.charCodeAt(i)) >>> 0;
      g.coaches[team.id] = COACHES[h % COACHES.length];
    }
    return g.coaches[team.id];
  };

  function ctxMate(g, pickFn) {
    var m = BM.careerMates(g);
    if (!m.length) return null;
    return pickFn ? pickFn(m) : g.rng.pick(m);
  }
  var pl = function (g, id) { return g.players[id]; };
  var nm = function (g, id) { return BM.fullName(g.players[id]); };
  var rel = function (C, id) { return BM.cRel(C, id); };
  var relAdd = function (C, id, x) { var r = rel(C, id); if (r) r.v = clamp(r.v + x, 0, 100); };
  var fn = function (C, id) { var r = rel(C, id); return r ? r.l.split(',')[0].split(' ')[0] : ''; };
  var pn = function (C) { return C.partner ? C.partner.name : ''; };
  var nba = function (C) { return C.phase === 'nba'; };
  var hit = function (g, img, fatal) { return BM.careerSponsorHit(g, img, fatal); };

  // Chaque événement : w (poids), pri (prioritaire), cond, t (titre), txt (texte), c (choix : [libellé, effet]).
  var E = [
    { id: 'meet', w: 0, cond: function (g, C) { return !!C.pendingMeet; }, t: 'Une rencontre',
      txt: function (g, C) { return 'Cette semaine, deux personnes t\'ont marqué : ' + C.pendingMeet.a + ' et ' + C.pendingMeet.b + '. Les deux t\'ont laissé leur numéro.'; },
      c: function (g, C, p, x) {
        var meet = function (n) { return function () { C.pendingMeet = null; C.partner = { name: n, v: 62, stage: 'couple', weeks: 0 }; p.morale += 6; BM.clog(g, 'En couple avec ' + n + '.'); return 'Deuxième rendez-vous, puis un troisième. Vous êtes ensemble.'; }; };
        var a = C.pendingMeet ? C.pendingMeet.a : x.a, b = C.pendingMeet ? C.pendingMeet.b : x.b;
        return [['Revoir ' + a, meet(a)], ['Revoir ' + b, meet(b)], ['Rester concentré sur le basket', function () { C.pendingMeet = null; BM.careerGain(g, 'sf', 0.05); return 'Le cœur attendra la fin de saison.'; }]];
      }, ctx: function (g, C) { return { a: C.pendingMeet.a, b: C.pendingMeet.b }; } },
    { id: 'breakup', pri: true, cond: function (g, C) { return C.partner && C.partner.v < 28; }, t: 'Rupture',
      txt: function (g, C) { return pn(C) + ' t\'attend dans le salon, valise prête : « Tu n\'es jamais là. Même quand tu es là. »'; },
      c: function (g, C, p) { return [
        ['Supplier de rester', function () { if (g.rng.chance(0.4)) { C.partner.v = 45; p.morale -= 3; return 'Une dernière chance. Ne la gâche pas.'; } var n = pn(C); C.partner = null; p.morale -= 12; BM.clog(g, 'Rupture avec ' + n + '.'); return 'La porte se ferme. Le silence de l\'appartement est assourdissant.'; }],
        ['Laisser partir', function () { var n = pn(C); C.partner = null; p.morale -= 8; BM.clog(g, 'Rupture avec ' + n + '.'); return 'Tu ne la retiens pas. Ça fait mal quand même.'; }]]; } },
    { id: 'propose', w: 5, cond: function (g, C) { return C.partner && C.partner.stage === 'couple' && C.partner.v >= 78 && C.partner.weeks >= 12; }, t: 'La bague',
      txt: function (g, C) { return 'Ça fait des mois avec ' + pn(C) + '. Ton frère te demande ce que tu attends.'; },
      c: function (g, C, p) { return [
        ['Faire ta demande (80 k$)', function () { C.money -= 80; if (g.rng.chance(0.85)) { C.partner.stage = 'fiance'; C.partner.since = C.partner.weeks; p.morale += 10; BM.clog(g, 'Fiançailles avec ' + pn(C) + '.'); return pn(C) + ' dit oui, en larmes.'; } C.partner.v -= 15; p.morale -= 8; return pn(C) + ' te demande du temps. Gros malaise.'; }],
        ['Pas encore', function () { return 'Tu as le temps.'; }]]; } },
    { id: 'wedding', pri: true, cond: function (g, C) { return C.partner && C.partner.stage === 'fiance' && C.partner.weeks - C.partner.since >= 8; }, t: 'Le mariage',
      txt: function (g, C) { return 'La date est fixée avec ' + pn(C) + '. Reste à choisir le style.'; },
      c: function (g, C, p) { var done = function (cost, v, m, f, l) { return function () { C.money -= cost; C.partner.stage = 'marie'; C.partner.v += v; p.morale += m; C.followers += f; relAdd(C, 'mere', 10); BM.clog(g, 'Marié avec ' + pn(C) + '.'); C.cine.push({ k: 'Mariage', l: l.concat([BM.fullName(p) + ' et ' + pn(C) + '.']) }); return 'Une journée parfaite.'; }; };
        return [['Grand mariage, 400 invités (300 k$)', done(300, 15, 15, 40000, ['Les familles sont réunies.', 'Ta mère pleure depuis le début.'])],
          ['Cérémonie intime (40 k$)', done(40, 12, 12, 0, ['Trente personnes.', 'Pas de caméras.'])]]; } },
    { id: 'baby', w: 0.8, cond: function (g, C) { return C.partner && C.partner.stage === 'marie' && C.partner.v >= 65 && C.kids < 4; }, t: 'Une grande nouvelle',
      txt: function (g, C) { return pn(C) + ' et toi allez être parents.'; },
      c: function (g, C, p) { return [['Pleurer de joie', function () { C.kids++; p.morale += 15; p.condition -= 8; BM.careerGain(g, 'lead', 0.4); BM.clog(g, C.kids === 1 ? 'Naissance de ton premier enfant.' : 'Naissance de ton ' + C.kids + 'e enfant.'); C.cine.push({ k: 'Naissance', l: ['4 h du matin.', 'Un tout petit poing serre ton doigt.', C.kids === 1 ? 'Tu es papa.' : 'La famille s\'agrandit.'] }); return 'Tout change. Les nuits seront courtes.'; }]]; } },
    { id: 'jealous', w: 1, cond: function (g, C) { return C.partner && C.followers > 150000; }, t: 'Rumeur',
      txt: function (g, C) { return 'Un compte people affirme t\'avoir vu avec quelqu\'un d\'autre. ' + pn(C) + ' a vu la story.'; },
      c: function (g, C) { return [['Rassurer et montrer tes messages', function () { C.partner.v += 4; return 'La tempête passe.'; }],
        ['Ignorer, c\'est faux', function () { C.partner.v -= 10; return pn(C) + ' aurait aimé que tu en parles.'; }],
        ['Démentir publiquement', function () { C.partner.v += 2; C.followers += 10000; C.rep -= 0.5; return 'Le démenti fait plus de bruit que la rumeur.'; }]]; } },
    { id: 'mere_low', w: 4, cond: function (g, C) { return rel(C, 'mere').v < 45; }, t: 'Un message de ta mère',
      txt: function () { return '« Tu ne m\'appelles plus. Je te vois plus souvent à la télé qu\'au téléphone. »'; },
      c: function (g, C, p) { return [['L\'appeler tout de suite', function () { relAdd(C, 'mere', 15); p.morale += 3; return 'Une heure au téléphone. Elle rit à nouveau.'; }],
        ['Lui envoyer de l\'argent (20 k$)', function () { C.money -= 20; relAdd(C, 'mere', 4); return '« Ce n\'est pas ce que je demandais. »'; }]]; } },
    { id: 'ami_low', w: 3, cond: function (g, C) { return rel(C, 'ami').v < 45; }, t: 'Ton ami d\'enfance',
      txt: function (g, C) { return fn(C, 'ami') + ' poste : « Certains oublient d\'où ils viennent. » Tout le monde a compris.'; },
      c: function (g, C, p) { return [['L\'inviter à un match, places VIP', function () { relAdd(C, 'ami', 14); p.morale += 2; return 'Il est au bord du terrain. Vous vous retrouvez.'; }],
        ['Assumer : la vie change', function () { relAdd(C, 'ami', -6); p.morale -= 2; return 'Un pont de plus qui brûle.'; }]]; } },
    { id: 'brother', w: 1, cond: function (g, C) { return C.money > 100; }, t: 'Le rêve de ton frère',
      txt: function (g, C) { return fn(C, 'frere') + ' veut lancer sa carrière de rappeur. Il te demande 50 k$ pour un studio et un clip.'; },
      c: function (g, C) { return [['Financer son projet', function () { C.money -= 50; relAdd(C, 'frere', 12); if (g.rng.chance(0.25)) { C.followers += 25000; return 'Le clip cartonne. Tu fais un caméo, ça buzze.'; } return 'Le clip sort. Il est fier. C\'est déjà ça.'; }],
        ['Refuser', function () { relAdd(C, 'frere', -10); return 'Il raccroche sans dire au revoir.'; }]]; } },
    { id: 'cover', w: 2, cond: function (g, C) { return C.rep >= 68 && C.coverSeason !== g.season; }, t: 'La jaquette',
      txt: function (g, C) { return fn(C, 'agent') + ' a une offre : la jaquette du prochain jeu vidéo de basket.'; },
      c: function (g, C) { return [['Accepter (600 k$)', function () { C.coverSeason = g.season; C.money += 600; C.followers += 80000; C.rep += 2; relAdd(C, 'agent', 8); BM.clog(g, 'Sur la jaquette du jeu vidéo de basket.'); return 'Ton visage dans toutes les vitrines.'; }],
        ['Refuser, rester focus', function () { C.coverSeason = g.season; relAdd(C, 'agent', -5); return 'Ton agent soupire.'; }]]; } },
    { id: 'doc', w: 1, cond: function (g, C) { return C.rep >= 55 && C.docSeason !== g.season; }, t: 'Documentaire',
      txt: function () { return 'Une plateforme veut suivre ta saison caméra à l\'épaule.'; },
      c: function (g, C) { return [['Ouvrir les portes', function () { C.docSeason = g.season; C.money += 250; C.followers += 60000; C.rep += 2; C.confMates -= 3; return 'Les caméras partout. Certains coéquipiers fatiguent.'; }],
        ['Garder le vestiaire privé', function () { C.docSeason = g.season; C.confMates += 2; return 'Le vestiaire apprécie.'; }]]; } },
    { id: 'fankid', w: 0.8, cond: function (g, C) { return C.rep >= 30; }, t: 'Un jeune fan',
      txt: function () { return 'Un enfant hospitalisé rêve de te rencontrer. Sa famille a écrit au club.'; },
      c: function (g, C, p) { return [['Aller le voir', function () { p.morale += 6; C.rep += 1.5; p.condition -= 3; return 'Une heure à l\'hôpital. Tu lui promets un panier. Tu tiendras parole.'; }],
        ['Envoyer un maillot signé', function () { C.rep += 0.3; return 'Le maillot arrive. Ce n\'est pas pareil.'; }]]; } },
    { id: 'church', w: 0.8, cond: function () { return true; }, t: 'Témoigner',
      txt: function () { return 'Ta communauté religieuse te demande de parler aux jeunes dimanche.'; },
      c: function (g, C, p) { return [['Accepter', function () { BM.careerGain(g, 'lead', 0.3); p.morale += 4; C.rep += 0.8; return 'Tu parles de discipline, de doute, de foi. Les jeunes boivent tes paroles.'; }],
        ['Décliner, pas le temps', function () { return 'Une autre fois.'; }]]; } },
    { id: 'cousin', w: 0.7, cond: function (g, C) { return C.money > 1500; }, t: 'Le cousin',
      txt: function () { return 'Un cousin éloigné te demande de te porter garant pour un prêt de 300 k$.'; },
      c: function (g, C, p) { return [['Signer', function () { if (g.rng.chance(0.45)) { C.money -= 300; p.morale -= 5; return 'Six semaines plus tard, il ne répond plus. Tu paies.'; } p.morale += 2; return 'Il rembourse. Tout le monde n\'est pas un piège.'; }],
        ['Refuser', function () { return 'La famille en parlera au prochain mariage.'; }]]; } },
    { id: 'health', w: 3, cond: function (g, C) { return C.health < 45; }, t: 'Le médecin s\'inquiète',
      txt: function (g, C) { return 'Bilan médical : santé ' + Math.round(C.health) + '/100. Le staff recommande de lever le pied.'; },
      c: function (g, C, p) { return [['Lever le pied quelques jours', function () { C.health += 12; p.condition += 20; C.confCoach -= 1; return 'Repos forcé. Le corps récupère.'; }],
        ['Ignorer, la saison n\'attend pas', function () { C.health -= 3; return 'Le risque de blessure grimpe.'; }]]; } },
    { id: 'fired', pri: true, cond: function (g, C) { var t = BM.cTeam(g); return nba(C) && t && g.phase === 'regular' && C.firedSeason !== g.season && t.record.w + t.record.l >= 15 && t.record.l - t.record.w >= 8; }, t: 'Le coach est limogé',
      txt: function (g, C) {
        var t = BM.cTeam(g), old = BM.coachName(g, t);
        C.firedSeason = g.season;
        var used = Object.keys(g.coaches).map(function (k) { return g.coaches[k]; });
        var nc = g.rng.pick(COACHES.filter(function (c) { return used.indexOf(c) < 0; }).concat(['Hugo Ventura']));
        g.coaches[t.id] = nc;
        var sys = g.rng.pick(Object.keys(BM.SYSTEMS).filter(function (s) { return s !== t.tactics.system; }));
        t.tactics.system = sys;
        C.confCoach = 50; BM.careerNewDemand(g);
        BM.clog(g, old + ' limogé. ' + nc + ' arrive avec un système ' + BM.SYSTEMS[sys].l + '.');
        return old + ' est remercié après un début de saison raté. ' + nc + ' prend la suite et installe un nouveau système : ' + BM.tacticLabel(BM.SYSTEMS[sys]) + '.';
      },
      c: function (g, C) { return [['Défendre ton ancien coach publiquement', function () { C.rep += 1; C.confMates += 2; C.confCoach -= 4; return 'Loyauté saluée par le vestiaire. Le nouveau coach note.'; }],
        ['Te montrer disponible pour le nouveau projet', function () { C.confCoach += 5; return 'Premier entretien positif avec le nouveau staff.'; }],
        ['Rester neutre', function () { return '« Je suis là pour jouer. »'; }]]; } },
    { id: 'ext', w: 3, cond: function (g, C, p) { return nba(C) && p.contract.years === 1 && C.extSeason !== g.season && g.phase === 'regular' && BM.ovr(p) >= 66 && C.confCoach >= 45; }, t: 'Prolongation anticipée',
      txt: function (g, C, p) { C.extSeason = g.season; C.extSal = Math.round(BM.askingSalary(p) * 0.92 / 50) * 50; return fn(C, 'agent') + ' : la franchise propose de prolonger 3 ans à ' + BM.money(C.extSal) + ' par an, tout de suite. En free agency, tu pourrais avoir plus… ou moins.'; },
      c: function (g, C, p) { return [['Signer la prolongation', function () { p.contract = { salary: C.extSal, years: 4 }; C.confCoach += 3; BM.clog(g, 'Prolongation signée (' + BM.money(C.extSal) + ' par an).'); return 'La sécurité, et la confiance du club.'; }],
        ['Attendre la free agency', function () { return 'Tu tentes ta chance en fin de saison.'; }]]; } },
    { id: 'party', w: 1.2, cond: function () { return true; }, t: 'Invitation VIP',
      txt: function () { return 'Un rappeur que tu écoutes depuis le lycée t\'invite à sa release party. C\'est la veille d\'un match.'; },
      c: function (g, C, p) { return [['Y aller jusqu\'au bout', function () { p.morale += 8 * C.partyMult; p.condition -= 22; C.health -= 3; C.followers += 8000; if (g.rng.chance(0.35)) { C.rep -= 2; C.confCoach -= 3; return 'Tu rentres à 5 h. Des vidéos circulent, le coach est au courant.' + hit(g, 'disc', true); } return 'Nuit mémorable. La tête dans le brouillard, mais le moral au plafond.'; }],
        ['Passer une heure et rentrer', function () { p.morale += 4; p.condition -= 6; return 'Une photo, une poignée de main, et au lit.'; }],
        ['Décliner', function () { C.work += 1; p.morale -= 1; return 'Tu restes concentré sur le match.'; }]]; } },
    { id: 'vet', w: 1, cond: function (g, C, p) { return nba(C) && p.age <= 23 && BM.careerMates(g).some(function (m) { return m.age >= 31; }); }, t: 'Le vétéran',
      ctx: function (g) { return { m: ctxMate(g, function (ms) { return ms.slice().sort(function (a, b) { return b.age - a.age; })[0]; }).id }; },
      txt: function (g, C, p, x) { var v = pl(g, x.m); return BM.fullName(v) + ', ' + v.age + ' ans, te prend à part : « Je vais te montrer deux, trois trucs que personne ne t\'apprendra. »'; },
      c: function (g, C, p, x) { return [['Écouter et bosser avec lui', function () { BM.careerGain(g, 'qi', 0.5); C.confMates += 2; p.condition -= 4; C.work += 1; return 'Tu gagnes en lecture du jeu. ' + nm(g, x.m) + ' t\'a à la bonne.'; }],
        ['Le remercier, tu as ta routine', function () { C.confMates -= 1; return 'Il hausse les épaules. Pas de rancune, pas de complicité non plus.'; }]]; } },
    { id: 'minutes', w: 1.2, cond: function (g, C) { return nba(C) && (C.status === 'banc' || C.status === 'rot'); }, t: 'Micro tendu',
      txt: function () { return 'Un journaliste : « Tu es frustré par ton temps de jeu ? »'; },
      c: function (g, C) { return [['« Oui, je mérite plus. »', function () { C.rep += 1.5; C.confCoach -= 6; C.followers += 5000; return 'La phrase fait le tour des réseaux. Le coach la lit aussi.' + hit(g, 'humble'); }],
        ['« Je dois continuer à travailler. »', function () { C.confCoach += 3; BM.careerGain(g, 'lead', 0.1); return 'Réponse mature. Le staff apprécie.'; }],
        ['Langue de bois', function () { C.rep += 0.3; return 'Rien à retenir. C\'est parfois le but.'; }]]; } },
    { id: 'fight', w: 1, cond: function (g, C) { return nba(C) && BM.careerMates(g).length > 0; }, t: 'Accrochage à l\'entraînement',
      ctx: function (g) { return { m: ctxMate(g).id }; },
      txt: function (g, C, p, x) { return nm(g, x.m) + ' te met un coup d\'épaule après une action et te fixe.'; },
      c: function (g, C, p, x) { return [['Répliquer', function () { C.confMates -= 3; C.confCoach -= 2; return 'Les assistants vous séparent. Ambiance glaciale avec ' + nm(g, x.m) + '.'; }],
        ['En parler en privé après', function () { C.confMates += 2; BM.careerGain(g, 'lead', 0.15); return 'Vous vous expliquez. ' + nm(g, x.m) + ' reconnaît qu\'il était à cran.'; }],
        ['Laisser couler', function () { p.morale -= 2; return 'Tu gardes ça pour toi.'; }]]; } },
    { id: 'sixam', w: 1, cond: function (g, C, p) { return nba(C) && BM.careerMates(g).some(function (m) { return BM.ovrRaw(m) > BM.ovrRaw(p); }); }, t: 'Séance à 6 h',
      ctx: function (g) { return { m: ctxMate(g, function (ms) { return ms.slice().sort(function (a, b) { return BM.ovrRaw(b) - BM.ovrRaw(a); })[0]; }).id }; },
      txt: function (g, C, p, x) { return nm(g, x.m) + ', la star de l\'équipe, te propose de shooter avec lui demain à 6 h.'; },
      c: function (g, C, p, x) { return [['Être là à 5 h 50', function () { BM.careerGain(g, 'tir3', 0.2 * BM.careerGrowth(g)); C.confMates += 2; p.condition -= 6; C.work += 1; return nm(g, x.m) + ' est impressionné. Tir à 3 pts en hausse.'; }],
        ['Rester au lit', function () { p.condition += 4; C.confMates -= 1; return 'Tu dors. Il le remarque.'; }]]; } },
    { id: 'fans', w: 0.8, cond: function (g, C) { return C.rep >= 20; }, t: 'Reconnu en ville',
      txt: function () { return 'Un groupe de jeunes te reconnaît à la sortie d\'un restaurant.'; },
      c: function (g, C, p) { return [['Prendre le temps', function () { C.rep += 0.8; C.followers += 3000; p.condition -= 2; return 'Selfies, autographes. La vidéo fait du bruit.'; }],
        ['Filer discrètement', function () { C.rep -= 0.5; return 'Quelqu\'un poste : « Il se prend pour qui ? »' + hit(g, 'humble'); }]]; } },
    { id: 'doubt', w: 2, cond: function (g, C, p) { return p.morale < 40; }, t: 'Le doute',
      txt: function () { return 'Les derniers matchs pèsent. Tu dors mal.'; },
      c: function (g, C, p) { return [['Voir un préparateur mental (40 k$)', function () { C.money -= 40; BM.careerGain(g, 'sf', 0.5); p.morale += 8; return 'Tu mets des mots sur la pression. Sang-froid en hausse.'; }],
        ['Bosser encore plus', function () { p.condition -= 10; p.morale += 2; C.work += 2; return 'Tu passes tes soirées à la salle.'; }],
        ['Sortir te changer les idées', function () { p.morale += 5; C.work -= 1; return 'Une soirée légère. Ça fait du bien.'; }]]; } },
    { id: 'ghost', w: 2, cond: function (g, C) { return nba(C) && C.confMates < 38; }, t: 'Le ballon ne revient plus',
      txt: function () { return 'Sur le terrain, tes coéquipiers t\'oublient. Tu le sens.'; },
      c: function (g, C) { return [['Mettre les choses à plat', function () { C.confMates += 7; BM.careerGain(g, 'lead', 0.2); return 'Une vraie discussion au vestiaire. Ça respire mieux.'; }],
        ['Aller voir le coach', function () { C.confCoach += 1; C.confMates -= 4; return 'Le coach t\'écoute. Les coéquipiers l\'apprennent.'; }],
        ['Jouer encore plus perso', function () { C.confMates -= 5; C.rep += 0.5; return 'Tu prends tes tirs. Le vestiaire se ferme.'; }]]; } },
    { id: 'bigperf', w: 2, cond: function (g, C) { var L = C.postGame && C.postGame.line; return L && L.gs >= 18 && L.day >= g.day - 2; }, t: 'Après ta grosse perf',
      txt: function (g, C) { return C.postGame.line.pts + ' points au dernier match. Les micros se tendent.'; },
      c: function (g, C, p) { return [['Remercier les coéquipiers', function () { C.confMates += 4; BM.careerGain(g, 'lead', 0.15); return 'Le vestiaire apprécie.'; }],
        ['Mettre ta perf en avant', function () { C.rep += 2.5 * C.repMult; C.confMates -= 3; return 'Ça buzze. Dans le vestiaire, moins.' + hit(g, 'humble'); }],
        ['Rester humble, remercier Dieu et ta famille', function () { C.rep += 1; p.morale += 3; relAdd(C, 'mere', 3); return 'Un message simple, bien reçu.'; }]]; } },
    { id: 'friend', w: 0.7, cond: function (g, C) { return C.money > 300; }, t: 'Le business d\'un ami',
      txt: function (g, C) { return fn(C, 'ami') + ' te demande 150 k$ pour lancer son business.'; },
      c: function (g, C, p) { return [['Investir', function () { C.money -= 150; relAdd(C, 'ami', 8); if (g.rng.chance(0.35)) { C.money += 420; p.morale += 5; return 'Six mois plus tard, le business décolle : +420 k$.'; } p.morale -= 3; return 'Le business coule. L\'amitié tient.'; }],
        ['Refuser poliment', function () { relAdd(C, 'ami', -8); p.morale -= 2; return 'Il dit qu\'il comprend. Le ton est froid.'; }]]; } },
    { id: 'rumor', w: 2, cond: function (g, C) { return nba(C) && C.confCoach < 35 && !C.tradeReq; }, t: 'Rumeur de transfert',
      txt: function () { return 'Ton nom circule dans les discussions de transfert.'; },
      c: function (g, C, p) { return [['Demander un transfert', function () { C.tradeReq = true; C.confCoach -= 3; p.morale += 2; BM.clog(g, 'Demande de transfert.'); return 'Ton agent transmet. Ça peut bouger à la date limite des échanges.'; }],
        ['Rester concentré', function () { p.morale -= 2; C.confCoach += 1; return 'Tu ne commentes pas.'; }]]; } },
    { id: 'camp', w: 0.7, cond: function (g, C) { return C.money > 200 && C.rep >= 20; }, t: 'Retour aux sources',
      txt: function (g, C) { return 'On te propose d\'organiser un camp pour les jeunes' + (C.home ? ' à ' + C.home : ' de ta ville natale') + '.'; },
      c: function (g, C, p) { return [['Organiser le camp (100 k$)', function () { C.money -= 100; C.rep += 2.5; BM.careerGain(g, 'lead', 0.3); p.morale += 5; return 'Deux cents gamins, un terrain plein. Tu t\'en souviendras.'; }],
        ['Pas cette année', function () { return 'Peut-être l\'été prochain.'; }]]; } },
    { id: 'bags', w: 2, cond: function (g, C, p) { return nba(C) && p.rookie && C.bagsDone !== true; }, t: 'Bizutage',
      txt: function (g, C) { C.bagsDone = true; return 'Les vétérans t\'attendent : un rookie porte les sacs, tout le voyage.'; },
      c: function (g, C, p) { return [['Porter les sacs en souriant', function () { C.confMates += 4; p.morale -= 1; return 'Les vétérans rigolent. Tu fais partie du groupe.'; }],
        ['Refuser', function () { C.confMates -= 5; C.rep += 0.5; return 'Le vestiaire retient.'; }]]; } },
    { id: 'beef', w: 0.9, cond: function (g, C) { return C.rep >= 15; }, t: 'Clash en ligne',
      ctx: function (g) { var me = BM.cPlayer(g); var stars = Object.keys(g.players).map(function (id) { return g.players[id]; }).filter(function (x) { return x.teamId !== null && x.teamId !== me.teamId && BM.ovr(x) >= 84; }); return { m: g.rng.pick(stars).id }; },
      txt: function (g, C, p, x) { return nm(g, x.m) + ' (' + g.teams[pl(g, x.m).teamId].short + ') se moque de toi sur les réseaux.'; },
      c: function (g, C) { return [['Répondre cash', function () { C.followers += 15000; C.rep += g.rng.chance(0.5) ? 1.5 : -1.5; return 'Le clash fait 2 millions de vues.' + hit(g, 'disc'); }],
        ['Répondre avec humour', function () { C.followers += 8000; C.rep += 1; return 'Tu gagnes la manche sans hausser le ton.'; }],
        ['Ignorer', function () { return 'Silence.' + hit(g, 'flam'); }]]; } },
    { id: 'extra', w: 1, cond: function (g, C) { return nba(C); }, t: 'Le coach te retient',
      txt: function (g) { return 'Coach ' + BM.coachName(g, BM.cTeam(g)) + ' : « Reste après l\'entraînement, on bosse les placements. »'; },
      c: function (g, C, p) { return [['Rester', function () { BM.careerGain(g, 'qi', 0.2); BM.careerGain(g, 'end', 0.15); C.confCoach += 3; p.condition -= 8; C.work += 1; return 'Une heure de plus. Le coach note.'; }],
        ['Prétexter la fatigue', function () { C.confCoach -= 2; p.condition += 3; return 'Il n\'insiste pas. Il s\'en souviendra.'; }]]; } },
    { id: 'mom', w: 0.8, cond: function (g, C) { return C.money > 50; }, t: 'Un appel de ta mère',
      txt: function () { return 'Ta mère aimerait venir te voir jouer au moins une fois cette saison.'; },
      c: function (g, C, p) { return [['Lui offrir le voyage (15 k$)', function () { C.money -= 15; p.morale += 8; relAdd(C, 'mere', 10); return 'Elle sera en tribune au prochain match.'; }],
        ['Pas cette fois', function () { p.morale -= 3; relAdd(C, 'mere', -6); return 'Elle dit qu\'elle comprend.'; }]]; } },
    { id: 'sms_frere', w: 1.2, cond: function () { return true; }, t: 'SMS de ton frère',
      txt: function (g, C) { return fn(C, 'frere') + ' : « T\'as écouté mon dernier son ? Sois honnête. »'; },
      c: function (g, C, p) { return [['L\'écouter et l\'encourager', function () { relAdd(C, 'frere', 6); p.condition -= 1; return 'Il t\'envoie trois émojis qui pleurent de joie.'; }],
        ['Lui dire la vérité : c\'est moyen', function () { relAdd(C, 'frere', g.rng.chance(0.5) ? 3 : -5); return 'Silence radio pendant une heure. Puis : « T\'as raison. »'; }],
        ['Laisser en vu', function () { relAdd(C, 'frere', -4); return 'Il a vu que tu as vu.'; }]]; } },
    { id: 'sms_mere', w: 1.2, cond: function () { return true; }, t: 'Message de ta mère',
      txt: function () { return '« Tu manges bien au moins ? Et tu pries ? »'; },
      c: function (g, C, p) { return [['L\'appeler vingt minutes', function () { relAdd(C, 'mere', 6); p.morale += 2; return 'Elle te raconte tout le quartier. Ça fait du bien.'; }],
        ['Répondre « Oui maman » avec un cœur', function () { relAdd(C, 'mere', 1); return '« Appelle-moi quand même. »'; }]]; } },
    { id: 'console_inv', w: 1, cond: function (g, C) { return nba(C) && BM.careerMates(g).length > 0; }, t: 'Soirée console',
      ctx: function (g) { return { m: ctxMate(g).id }; },
      txt: function (g, C, p, x) { return nm(g, x.m) + ' t\'invite à une soirée console en ligne avec les gars.'; },
      c: function (g, C, p) { return [['Brancher la manette', function () { C.confMates += 2; p.morale += 2; p.condition -= 3; return 'Tu termines à 1 h du matin. Ça chambre dans le groupe.'; }],
        ['Décliner, dodo', function () { p.condition += 2; return 'Tu dors comme un bébé.'; }]]; } },
    { id: 'shoes', w: 0.8, cond: function (g, C) { return C.followers > 40000; }, t: 'Colis surprise',
      txt: function () { return 'Une marque t\'envoie une paire de chaussures exclusive, pas encore sortie.'; },
      c: function (g, C, p) { return [['Poster une photo', function () { C.followers += 5000; var eq = C.sponsors.find(function (s) { return s.cat === 'shoes'; }); if (eq) { eq.strikes++; return 'Ton équipementier ' + eq.brand + ' n\'a pas aimé voir une autre marque (avertissement ' + eq.strikes + '/3).'; } return 'La photo cartonne.'; }],
        ['Les offrir à un jeune du quartier', function () { C.rep += 0.6; p.morale += 2; return 'Le gamin n\'en revient pas.'; }]]; } },
    { id: 'insomnie', w: 1.4, cond: function (g, C, p) { return p.morale < 50 || p.condition < 45; }, t: 'Insomnie',
      txt: function () { return '3 h du matin. Impossible de dormir.'; },
      c: function (g, C, p) { return [['Revoir ton dernier match en vidéo', function () { BM.careerGain(g, 'qi', 0.1); p.condition -= 4; return 'Tu repères deux erreurs de placement.'; }],
        ['Scroller les réseaux', function () { p.condition -= 4; p.morale -= 2; return 'Mauvaise idée. Les commentaires piquent.'; }],
        ['Prier et te rendormir', function () { p.morale += 2; p.condition += 2; return 'Le sommeil finit par venir.'; }]]; } },
    { id: 'podcast', w: 0.8, cond: function (g, C) { return C.rep >= 35; }, t: 'Invitation podcast',
      txt: function () { return 'Le plus gros podcast basket du pays t\'invite pour deux heures sans filtre.'; },
      c: function (g, C) { return [['Y aller et parler cash', function () { C.followers += 30000; C.confMates -= 1; var ok = g.rng.chance(0.5); C.rep += ok ? 1.5 : -1; return ok ? 'Tes punchlines font le tour des réseaux.' : 'Une phrase sur un ancien coéquipier fait polémique.'; }],
        ['Y aller et rester lisse', function () { C.followers += 10000; return 'Bon moment, rien de fou.'; }],
        ['Refuser', function () { return 'Peut-être l\'an prochain.'; }]]; } },
    { id: 'crypto', w: 0.7, cond: function (g, C) { return C.money > 500 && BM.careerMates(g).length > 0; }, t: 'Le tuyau',
      ctx: function (g) { return { m: ctxMate(g).id }; },
      txt: function (g, C, p, x) { return nm(g, x.m) + ' jure qu\'une crypto va « faire x10 avant Noël ».'; },
      c: function (g, C) { return [['Mettre 200 k$', function () { C.money -= 200; C.inv.crypto += 200; return 'C\'est placé. Croise les doigts.'; }],
        ['Passer ton tour', function () { return 'Il hausse les épaules.'; }]]; } },
    { id: 'ecole', w: 1.5, cond: function (g, C) { return C.kids > 0; }, t: 'Le spectacle de l\'école',
      txt: function () { return 'Ton enfant a un spectacle à l\'école ce soir, en même temps que la séance vidéo du staff.'; },
      c: function (g, C, p) { return [['Aller au spectacle', function () { if (C.partner) C.partner.v += 6; p.morale += 6; C.confCoach -= 2; return 'Tu filmes tout. Tu as pleuré un peu.'; }],
        ['Aller à la séance vidéo', function () { BM.careerGain(g, 'qi', 0.1); C.confCoach += 2; if (C.partner) C.partner.v -= 6; p.morale -= 2; return 'Le staff note ta présence. À la maison, moins.'; }]]; } },
    { id: 'hurt', w: 3, cond: function (g, C, p) { return nba(C) && p.injury > 0 && p.injury <= 4; }, t: 'Jouer blessé ?',
      txt: function () { return 'Le coach te demande si tu peux tenir ta place malgré la douleur.'; },
      c: function (g, C, p) { return [['Jouer quand même', function () { p.injury = 0; C.health -= 6; C.confCoach += 3; return 'Tu seras sur le parquet. Moins explosif, et un risque de rechute.'; }],
        ['Respecter le protocole', function () { return 'Le staff médical approuve.'; }]]; } },
    // Spécifiques à l'année de prospect.
    { id: 'nil', w: 2, cond: function (g, C) { return C.phase === 'prospect' && C.path === 'ncaa' && !C.nilDone; }, t: 'Contrat NIL',
      txt: function (g, C) { C.nilDone = true; return 'Une marque de boisson locale propose un contrat NIL : 80 k$ pour trois vidéos.'; },
      c: function (g, C) { return [['Signer', function () { C.money += 80; C.followers += 12000; return 'Trois vidéos, un chèque, des followers.'; }],
        ['Refuser, rester focus', function () { C.work += 2; return 'Le coach apprécie ta concentration.'; }]]; } },
    { id: 'mock', w: 2, cond: function (g, C) { return C.phase === 'prospect' && C.prospect.games.length >= 6; }, t: 'Mock draft',
      txt: function (g) { return 'Le dernier mock draft de Hoops Daily te place au ' + BM.careerMockRank(g) + 'e rang. Les commentaires s\'enflamment.'; },
      c: function (g, C, p) { return [['Poster le classement, fier', function () { C.followers += 6000; C.rep += 0.5; return 'Ta story fait réagir.'; }],
        ['Ne pas lire, continuer à bosser', function () { C.work += 2; p.morale += 1; return 'Les classements, c\'est en juin.'; }]]; } },
    { id: 'scout', w: 1.5, cond: function (g, C) { return C.phase === 'prospect' && C.prospect.games.length >= 3; }, t: 'Scouts en tribune',
      ctx: function (g) { return { t: g.rng.int(0, 29) }; },
      txt: function (g, C, p, x) { return 'Le directeur général des ' + g.teams[x.t].name + ' est en tribune pour toi au prochain match.'; },
      c: function (g, C, p) { return [['Le rencontrer après le match', function () { C.prospect.workouts = Math.min(4, C.prospect.workouts + 0.5); BM.careerUpdateStock(g); return 'Poignée de main, regard franc. Bonne impression.'; }],
        ['Ne rien changer à ta routine', function () { p.morale += 1; return 'Tu joues ton jeu.'; }]]; } }
  ];
  BM.CAREER_EVENTS = E;

  // Tirage après l'activité du soir : événement prioritaire s'il y en a, sinon 40 % de chance.
  BM.careerDrawEvent = function (g) {
    var C = g.career, p = BM.cPlayer(g), r = g.rng;
    var ok = function (e) { try { return e.cond(g, C, p); } catch (err) { return false; } };
    var ev = null;
    if (C.pendingMeet) ev = E.find(function (e) { return e.id === 'meet'; });
    else {
      var pri = E.filter(function (e) { return e.pri && ok(e); });
      if (pri.length) ev = r.pick(pri);
      else if (r.chance(0.4)) {
        var pool = E.filter(function (e) { return !e.pri && e.w > 0 && ok(e); });
        if (pool.length) ev = r.weighted(pool, function (e) { return e.w; });
      }
    }
    if (!ev) return null;
    var ctx = ev.ctx ? ev.ctx(g, C, p) : {};
    var labels = ev.c(g, C, p, ctx).map(function (c) { return c[0]; });
    return { id: ev.id, t: ev.t, txt: ev.txt(g, C, p, ctx), ctx: ctx, labels: labels };
  };

  BM.careerResolveEvent = function (g, idx) {
    var C = g.career, p = BM.cPlayer(g), T = C.today;
    if (!T || !T.event) return '';
    var ev = E.find(function (e) { return e.id === T.event.id; });
    var choice = ev ? ev.c(g, C, p, T.event.ctx)[idx] : null;
    var res = choice ? choice[1]() : '';
    T.eventDone = { t: T.event.t, choice: T.event.labels[idx], res: res };
    T.event = null;
    BM.careerNormalize(g);
    return res;
  };
})();
