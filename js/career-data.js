var BM = globalThis.BM = globalThis.BM || {};

// Données du mode « Ma Carrière » : archétypes, traits, voies vers la draft, activités, badges, sponsors.
// Montants en k$ comme dans le reste du jeu.
(function () {
  // Archétypes par poste (bonus et malus sur l'échelle 1-20).
  BM.CAREER_ARCH = {
    MEN: [
      { id: 'playmaker', l: 'Playmaker', d: 'Il voit l\'action avant tout le monde.', b: { pas: 3, qi: 2, drb: 2 }, m: { reb: -1 } },
      { id: 'scorer', l: 'Scoring guard', d: 'Crée son tir en isolation, menace de partout.', b: { drb: 3, tirMi: 2, tir3: 2 }, m: { pas: -1 } },
      { id: 'pitbull', l: 'Pit-bull défensif', d: 'Harcèle le porteur adverse sur tout le terrain.', b: { defE: 3, int: 2, end: 2 }, m: { tir3: -1 } }
    ],
    ARR: [
      { id: 'sniper', l: 'Shooteur d\'élite', d: 'Une menace à 3 pts qui déforme les défenses.', b: { tir3: 4, tirMi: 2, lf: 1 }, m: { defE: -1 } },
      { id: '3d', l: '3&D', d: 'Tir du corner et défense sur la meilleure arme adverse.', b: { tir3: 3, defE: 3, end: 1 }, m: { drb: -1 } },
      { id: 'slasher', l: 'Slasher', d: 'Attaque le cercle et finit dans le contact.', b: { fin: 3, det: 2, vit: 2 }, m: { tir3: -1 } }
    ],
    AIL: [
      { id: 'twoway', l: 'Two-way wing', d: 'Aussi utile en attaque qu\'en défense.', b: { defE: 2, tirMi: 2, tir3: 2, vit: 1 }, m: {} },
      { id: 'pointfwd', l: 'Point forward', d: 'Un créateur dans un corps d\'ailier.', b: { pas: 3, qi: 2, drb: 2 }, m: { tir3: -1 } },
      { id: 'iso', l: 'Scoreur iso', d: 'Prend le ballon et punit en un contre un.', b: { tirMi: 3, drb: 2, fin: 2 }, m: { defE: -1 } }
    ],
    AF: [
      { id: 'stretch4', l: 'Stretch 4', d: 'Écarte le jeu depuis le poste 4.', b: { tir3: 4, reb: 1, qi: 1 }, m: { defI: -1 } },
      { id: 'swiss', l: 'Stoppeur polyvalent', d: 'Défend sur cinq postes.', b: { defI: 2, defE: 3, vit: 2 }, m: { tirMi: -1 } },
      { id: 'post', l: 'Poste bas', d: 'Dos au panier, il ne rate pas grand-chose.', b: { fin: 3, reb: 2, for: 2 }, m: { tir3: -1 } }
    ],
    PIV: [
      { id: 'rimprot', l: 'Protecteur de cercle', d: 'Personne n\'ose entrer dans sa raquette.', b: { ctr: 3, defI: 2, reb: 2 }, m: { tirMi: -1 } },
      { id: 'stretch5', l: 'Stretch 5', d: 'Pivot qui sort jusqu\'à la ligne à 3 pts.', b: { tir3: 5, defI: 1, qi: 1 }, m: { reb: -1 } },
      { id: 'hub', l: 'Pivot créateur', d: 'Le jeu passe par ses mains au poste haut.', b: { pas: 4, qi: 2, fin: 1 }, m: { det: -1 } }
    ]
  };

  BM.CAREER_TRAITS = [
    { id: 'travail', l: 'Travailleur', d: 'Progression +15 %, potentiel plus élevé.' },
    { id: 'showman', l: 'Showman', d: 'Réputation et followers montent 30 % plus vite.' },
    { id: 'leader', l: 'Leader-né', d: 'Leadership +2, confiance des coéquipiers +10.' },
    { id: 'calme', l: 'Glacé', d: 'Sang-froid +3 dans les moments clés.' },
    { id: 'fetard', l: 'Fêtard', d: 'Les soirées rapportent deux fois plus de moral. Discipline fragile.' }
  ];

  // Les trois voies vers la draft.
  BM.CAREER_PATHS = {
    ncaa: { l: 'Université NCAA', s: 'Duke, Kentucky, UConn…', d: 'Visibilité maximale : chaque match passe à la télé, la March Madness peut te propulser en haut de la draft. Pas de salaire, mais des revenus NIL.',
      level: 10.6, vis: 1.3, train: 1, pay: 150, games: 22, teams: ['Duke', 'Kentucky', 'Kansas', 'UConn', 'UCLA', 'Gonzaga', 'Arizona', 'Houston', 'Baylor', 'Villanova', 'Michigan', 'Auburn', 'Texas', 'North Carolina'], cup: 'March Madness' },
    europe: { l: 'Europe (EuroLeague)', s: 'Real Madrid, Partizan, ASVEL…', d: 'Contre des adultes, des pros. Des stats plus modestes, mais les scouts savent que tu es prêt. Un vrai salaire dès 19 ans.',
      level: 12.2, vis: 0.95, train: 1.1, pay: 700, games: 22, teams: ['Real Madrid', 'FC Barcelone', 'Partizan', 'Étoile rouge', 'ASVEL', 'AS Monaco', 'Fenerbahçe', 'Olympiakos', 'Panathinaïkos', 'Virtus Bologne', 'Bayern Munich', 'Maccabi Tel-Aviv'], cup: 'Final Four' },
    ignite: { l: 'G League Ignite', s: 'Programme pro de la NBA', d: 'Encadrement NBA, entraînement de pointe et contrat pro. Moins de projecteurs qu\'à l\'université, plus de progression.',
      level: 11.2, vis: 1.05, train: 1.3, pay: 500, games: 22, teams: ['Stockton Kings', 'Rio Grande Vipers', 'Capital City Go-Go', 'Raptors 905', 'Santa Cruz Warriors', 'Long Island Nets', 'Austin Spurs', 'Westchester Knicks', 'Motor City Cruise', 'Salt Lake City Stars'], cup: 'Showcase Cup' }
  };

  // Thèmes d'entraînement : attributs travaillés.
  BM.CAREER_FOCUS = {
    shoot: { l: 'Tir extérieur', a: ['tir3', 'tirMi', 'lf'] },
    create: { l: 'Création & passe', a: ['drb', 'pas', 'qi'] },
    finish: { l: 'Finition', a: ['fin', 'det', 'for'] },
    defense: { l: 'Défense', a: ['defE', 'defI', 'int'] },
    body: { l: 'Rebond & physique', a: ['reb', 'end', 'vit'] },
    mind: { l: 'Lecture du jeu', a: ['qi', 'sf', 'act'] }
  };
  BM.CAREER_INTENS = {
    leger: { l: 'Légère', m: 0.6, e: 4, inj: 0 },
    normal: { l: 'Normale', m: 1, e: 9, inj: 0.003 },
    intense: { l: 'Intense', m: 1.5, e: 16, inj: 0.012 }
  };

  // Mentalité en match (comme dans Gravité) : effets sur l'usage du joueur et sur l'équipe.
  BM.CAREER_MENT = {
    equil: { l: 'Équilibré', d: 'Tu laisses le jeu venir à toi.', u: 0, b: 0, ast: 0, team: 0, def: 0, drain: 1 },
    agress: { l: 'Agressif', d: 'Plus de tirs pour toi, plus de fatigue, des tirs parfois forcés.', u: 0.45, b: -0.012, ast: 0, team: 0, def: 0, drain: 1.2 },
    collectif: { l: 'Collectif', d: 'Tu cherches les autres : passes et confiance des coéquipiers.', u: -0.3, b: 0.01, ast: 0.08, team: 0.008, def: 0, drain: 1 },
    defense: { l: 'Défense', d: 'Tout pour le stop : interceptions, aides, contests.', u: -0.15, b: 0, ast: 0, team: 0, def: 0.012, drain: 1.15 },
    gestion: { l: 'Gestion', d: 'Tu économises tes jambes : moins de fatigue.', u: -0.1, b: 0, ast: 0, team: 0, def: 0, drain: 0.65 }
  };

  // Statuts dans l'équipe : minutes visées.
  BM.CAREER_STATUS = {
    banc: { l: 'Bout de banc', min: 8, exp: 3 },
    rot: { l: 'Rotation', min: 17, exp: 7 },
    role: { l: 'Role player', min: 26, exp: 10 },
    second: { l: '2e option', min: 32, exp: 14 },
    first: { l: '1re option', min: 34, exp: 18 },
    star: { l: 'Superstar', min: 36, exp: 22 }
  };
  BM.CAREER_STATUS_ORDER = ['banc', 'rot', 'role', 'second', 'first', 'star'];

  // Activités du soir (une par jour sans match).
  BM.CAREER_ACTS = [
    { id: 'repos', cat: 'Récupération', l: 'Repos', d: 'Énergie +18, santé +2.' },
    { id: 'spa', cat: 'Récupération', l: 'Cryo & kiné', d: 'Énergie +24, santé +4.', c: 25 },
    { id: 'cuisine', cat: 'Récupération', l: 'Cuisiner sain', d: 'Santé +3, énergie +5.' },
    { id: 'shootnight', cat: 'Basket', l: 'Shooting nocturne', d: 'Tir à 3 pts et mi-distance en hausse, énergie −8.' },
    { id: 'video', cat: 'Basket', l: 'Séance vidéo', d: 'Lecture du jeu, confiance du coach.' },
    { id: 'perso', cat: 'Basket', l: 'Coach personnel', d: 'Séance privée sur ton thème d\'entraînement.', c: 60 },
    { id: 'coachtalk', cat: 'Basket', l: 'Rendez-vous avec le coach', d: 'Réclamer plus de responsabilités. Risqué. Une fois par semaine.' },
    { id: 'mates', cat: 'Vestiaire', l: 'Sortie avec les coéquipiers', d: 'Entente, confiance des coéquipiers.', c: 20 },
    { id: 'soiree', cat: 'Vestiaire', l: 'Faire la fête', d: 'Gros moral, fatigue, risque d\'image. Pire la veille d\'un match.', c: 60 },
    { id: 'date', cat: 'Cœur', l: 'Rendez-vous galant', d: 'Rencontrer quelqu\'un, ou faire vivre ta relation.', c: 10 },
    { id: 'ami', cat: 'Cœur', l: 'Voir ton ami d\'enfance', d: 'Relation, moral.' },
    { id: 'famille', cat: 'Cœur', l: 'Appeler la famille', d: 'Relations familiales, moral.' },
    { id: 'culte', cat: 'Esprit', l: 'Culte & prière', d: 'Moral, sang-froid, leadership.' },
    { id: 'lecture', cat: 'Esprit', l: 'Lire et se former', d: 'Lecture du jeu, discipline.' },
    { id: 'console', cat: 'Loisirs', l: 'Jeux vidéo à la maison', d: 'Moral +3, énergie +4.' },
    { id: 'shopping', cat: 'Loisirs', l: 'Shopping de luxe', d: 'Moral +5, followers.', c: 40 },
    { id: 'media', cat: 'Image', l: 'Médias & réseaux', d: 'Followers, réputation. Peut déraper.' },
    { id: 'charite', cat: 'Image', l: 'Action caritative', d: 'Réputation, leadership.', c: 30 }
  ];
  BM.CAREER_ACT_CATS = ['Récupération', 'Basket', 'Vestiaire', 'Cœur', 'Esprit', 'Loisirs', 'Image'];

  BM.CAREER_ASSETS = [
    { id: 'appart', l: 'Appartement en centre-ville', p: 900, up: 2, d: 'Moral +1 par semaine.' },
    { id: 'voiture', l: 'Voiture de sport', p: 350, up: 3, d: 'Followers en hausse chaque semaine.' },
    { id: 'maisonfamille', l: 'Une maison pour ta mère', p: 1200, up: 0, d: 'Relation avec ta mère +3 par semaine.' },
    { id: 'gym', l: 'Salle de sport privée', p: 1200, up: 5, d: 'Entraînement +10 %.' },
    { id: 'recup', l: 'Centre de récupération à domicile', p: 800, up: 4, d: 'Énergie +6 et santé +1 par semaine.' },
    { id: 'villa', l: 'Villa avec piscine', p: 6000, up: 12, d: 'Moral +2, famille +1 par semaine.' },
    { id: 'resto', l: 'Restaurant', p: 1500, up: 0, d: 'Revenu variable chaque semaine. Peut perdre de l\'argent.' },
    { id: 'fondation', l: 'Fondation à ton nom', p: 2000, up: 20, d: 'Réputation et leadership chaque semaine.' }
  ];
  BM.CAREER_STAFF = [
    { id: 'tir', l: 'Coach de tir', c: 15, d: 'Entraînement « Tir extérieur » +25 %.' },
    { id: 'skills', l: 'Skills coach', c: 15, d: 'Entraînements « Création » et « Finition » +25 %.' },
    { id: 'physio', l: 'Préparateur physique', c: 18, d: 'Blessures −40 %, déclin physique ralenti.' },
    { id: 'mental', l: 'Préparateur mental', c: 12, d: 'Bonus dans les moments clés, moral jamais sous 35.' },
    { id: 'nutri', l: 'Nutritionniste', c: 8, d: 'Énergie +6 et santé +1 par semaine.' }
  ];
  BM.CAREER_INV = {
    immo: { l: 'Immobilier', d: 'Stable, rendement lent.', mu: 0.0025, sd: 0.006 },
    bourse: { l: 'Fonds indiciel', d: 'Suit le marché.', mu: 0.002, sd: 0.025 },
    crypto: { l: 'Crypto', d: 'Peut doubler. Ou fondre.', mu: 0.003, sd: 0.11 }
  };

  // Badges : compteur de carrière + attribut minimum (échelle 1-20) pour chaque niveau.
  BM.CAREER_BADGES = [
    { id: 'sniper', l: 'Sniper', c: 'tpm', a: 'tir3', th: [25, 80, 180, 350], d: 'Adresse à 3 pts' },
    { id: 'createur', l: 'Créateur de tir', c: 'midm', a: 'tirMi', th: [20, 70, 160, 320], d: 'Tirs à mi-distance' },
    { id: 'finisseur', l: 'Finisseur', c: 'rimm', a: 'fin', th: [25, 90, 200, 400], d: 'Finition près du cercle' },
    { id: 'maestro', l: 'Maestro', c: 'ast', a: 'pas', th: [40, 120, 280, 550], d: 'Passes décisives' },
    { id: 'mur', l: 'Le Mur', c: 'blk', a: 'ctr', th: [10, 35, 80, 160], d: 'Contres' },
    { id: 'pitbull', l: 'Pitbull', c: 'stl', a: 'int', th: [12, 40, 90, 180], d: 'Interceptions' },
    { id: 'aspi', l: 'Aspirateur', c: 'reb', a: 'reb', th: [40, 130, 300, 600], d: 'Rebonds' },
    { id: 'glace', l: 'Glacé', c: 'clutch', a: 'sf', th: [1, 3, 6, 10], d: 'Moments décisifs' },
    { id: 'moteur', l: 'Moteur', c: 'min', a: 'end', th: [150, 450, 1000, 2000], d: 'Fatigue réduite' }
  ];
  BM.CAREER_BLVL = ['', 'Bronze', 'Argent', 'Or', 'Légende'];
  BM.CAREER_BREQ = [0, 11, 13, 15, 17];

  // Sponsors (montants hebdomadaires en k$).
  BM.SP_CATS = {
    shoes: { l: 'Équipementier', rep: 12, base: 30 }, drink: { l: 'Boisson', rep: 20, base: 22 }, food: { l: 'Alimentation', rep: 22, base: 18 },
    tech: { l: 'Tech', rep: 35, base: 35 }, fashion: { l: 'Mode', rep: 40, base: 30 }, watch: { l: 'Horlogerie', rep: 55, base: 45 }, auto: { l: 'Automobile', rep: 65, base: 60 }
  };
  BM.SP_BRANDS = [
    { n: 'Ardent Running', cat: 'shoes', img: 'disc' }, { n: 'Skyward', cat: 'shoes', img: 'flam' }, { n: 'Terra Court', cat: 'shoes', img: 'humble' },
    { n: 'Volt Énergie', cat: 'drink', img: 'flam' }, { n: 'Source Claire', cat: 'drink', img: 'disc' }, { n: 'Maison Bissap', cat: 'drink', img: 'humble' },
    { n: 'Garba Express', cat: 'food', img: 'humble' }, { n: 'FitBowl', cat: 'food', img: 'disc' },
    { n: 'Nimbus Mobile', cat: 'tech', img: 'flam' }, { n: 'Pixeline', cat: 'tech', img: 'humble' },
    { n: 'Néon Club', cat: 'fashion', img: 'flam' }, { n: 'Maison Kôra', cat: 'fashion', img: 'humble' },
    { n: 'Horlogerie Vasseur', cat: 'watch', img: 'disc' }, { n: 'Aurum', cat: 'watch', img: 'flam' },
    { n: 'Mistral Motors', cat: 'auto', img: 'disc' }, { n: 'Vortex', cat: 'auto', img: 'flam' }
  ];
  BM.SP_IMG = { flam: 'Flamboyant', disc: 'Discipliné', humble: 'Humble' };
  BM.SP_IMG_FIT = { flam: ['cocky', 'funny'], disc: ['neutral', 'faith'], humble: ['humble', 'faith'] };
  BM.TONES = { humble: 'Le gentleman', cocky: 'Le provocateur', blame: 'Le franc-tireur', faith: 'L\'homme de foi', funny: 'Le showman', neutral: 'La langue de bois' };

  BM.CAREER_SUMMER = [
    { id: 'shoot', l: 'Camp de tir', d: 'Tir à 3 pts, mi-distance, lancers.', a: { tir3: 1.3, tirMi: 1, lf: 0.6 } },
    { id: 'body', l: 'Muscu & athlétisme', d: 'Vitesse, détente, force, endurance.', a: { det: 0.9, for: 1, end: 1, vit: 0.7 } },
    { id: 'handle', l: 'Dribble & création', d: 'Dribble et passe.', a: { drb: 1.3, pas: 1 } },
    { id: 'def', l: 'Camp défensif', d: 'Défense extérieure et intérieure, interceptions.', a: { defE: 1.1, defI: 0.9, int: 0.6 } },
    { id: 'film', l: 'Étude vidéo', d: 'Lecture du jeu et sang-froid.', a: { qi: 1.3, sf: 0.9 } },
    { id: 'rest', l: 'Repos & famille', d: 'Corps préservé : ralentit le déclin, santé +15.', a: {}, rest: true }
  ];

  BM.CAREER_FIRST = ['Marcus', 'Darius', 'Jalen', 'André', 'Malik', 'Théo', 'Isaiah', 'Kofi', 'Mamadou', 'Lucas', 'Evan', 'Caleb', 'Yannick', 'Omari', 'Moussa', 'Ibrahim', 'Kwame', 'Sékou'];
  BM.CAREER_FIRST_F = ['Aïcha', 'Léa', 'Maya', 'Inès', 'Naomi', 'Sarah', 'Kenza', 'Jade', 'Grace', 'Esther', 'Amara', 'Chloé', 'Fatou', 'Elena'];
  BM.CAREER_OUTLETS = ['Courtside TV', 'Hoops Daily', 'Le Parquet', 'Radio Baseline', 'Full Court Press', 'Paint Zone'];
  BM.CAREER_FANS = ['ballislife_abj', 'hoopsqueen', 'coach_du_dimanche', 'tribune_nord', 'le_vrai_fan', 'mamadou_hoops', 'courtvision23', 'basket_addict', 'reine_du_parquet', 'team_no_sleep'];
  BM.CAREER_JOURNOS = ['Léa Marchand · Courtside TV', 'Marcus Bell · Hoops Daily', 'Inès Kaboré · Le Parquet', 'Dave Ortiz · Radio Baseline', 'Sophie Lamar · Full Court Press', 'Kwame Asante · Paint Zone'];
})();
