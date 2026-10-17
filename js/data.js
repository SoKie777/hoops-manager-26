var BM = globalThis.BM = globalThis.BM || {};

BM.VERSION = 2;
BM.SAVE_KEY = 'hoops_manager_save_v2';
BM.ROSTER_MIN = 13;
BM.ROSTER_MAX = 17;
BM.QUARTER_MIN = 12;           // format NBA : 4 x 12 min
BM.GAME_MINUTES = 48;
BM.FOUL_OUT = 6;
BM.SALARY_CAP = 166000;        // k$ (plafond 2026-27)
BM.MIN_EXCEPTION = 3000;       // contrat minimum signable même au-dessus du plafond (k$)

BM.POSITIONS = ['MEN', 'ARR', 'AIL', 'AF', 'PIV'];
BM.POS_LABEL = { MEN: 'Meneur', ARR: 'Arrière', AIL: 'Ailier', AF: 'Ailier fort', PIV: 'Pivot' };
BM.POS_HEIGHT = { MEN: 186, ARR: 193, AIL: 200, AF: 205, PIV: 211 };

// Attributs sur l'échelle 1-20 (même principe que la fiche joueur de FM).
BM.ATTRS = [
  { k: 'tir3', l: 'Tir à 3 pts', g: 'tech' },
  { k: 'tirMi', l: 'Mi-distance', g: 'tech' },
  { k: 'fin', l: 'Finition', g: 'tech' },
  { k: 'lf', l: 'Lancers francs', g: 'tech' },
  { k: 'pas', l: 'Passe', g: 'tech' },
  { k: 'drb', l: 'Dribble', g: 'tech' },
  { k: 'reb', l: 'Rebond', g: 'tech' },
  { k: 'defE', l: 'Défense ext.', g: 'tech' },
  { k: 'defI', l: 'Défense int.', g: 'tech' },
  { k: 'ctr', l: 'Contre', g: 'tech' },
  { k: 'int', l: 'Interception', g: 'tech' },
  { k: 'qi', l: 'Lecture du jeu', g: 'ment' },
  { k: 'sf', l: 'Sang-froid', g: 'ment' },
  { k: 'act', l: 'Activité', g: 'ment' },
  { k: 'lead', l: 'Leadership', g: 'ment' },
  { k: 'vit', l: 'Vitesse', g: 'phys' },
  { k: 'det', l: 'Détente', g: 'phys' },
  { k: 'for', l: 'Force', g: 'phys' },
  { k: 'end', l: 'Endurance', g: 'phys' }
];
BM.ATTR_GROUPS = { tech: 'Technique', ment: 'Mental', phys: 'Physique' };

// Biais de génération par poste, ajouté à la qualité de base du joueur.
BM.POS_BIAS = {
  MEN: { tir3: 1, tirMi: 1, fin: -1, lf: 1, pas: 4, drb: 4, reb: -4, defE: 1, defI: -4, ctr: -5, int: 2, qi: 2, vit: 3, det: -1, for: -4, end: 1 },
  ARR: { tir3: 3, tirMi: 2, lf: 2, pas: 1, drb: 2, reb: -3, defE: 2, defI: -3, ctr: -4, int: 1, vit: 2, for: -2 },
  AIL: { tir3: 1, tirMi: 1, fin: 1, defE: 2, ctr: -1, int: 1, vit: 1, det: 1 },
  AF: { tir3: -2, fin: 2, lf: -1, pas: -1, drb: -2, reb: 3, defE: -1, defI: 2, ctr: 1, vit: -1, det: 1, for: 3 },
  PIV: { tir3: -6, tirMi: -2, fin: 3, lf: -3, pas: -2, drb: -5, reb: 5, defE: -3, defI: 4, ctr: 4, int: -2, vit: -3, det: 1, for: 5 }
};

// Pondération de la note globale par poste (attribut absent = poids 0).
BM.POS_WEIGHTS = {
  MEN: { pas: 3, drb: 3, tir3: 2, tirMi: 1.5, fin: 1, lf: 0.5, defE: 2, int: 1.5, qi: 2.5, sf: 1, vit: 2, end: 1 },
  ARR: { tir3: 3, tirMi: 2, fin: 1.5, lf: 1, drb: 1.5, pas: 1, defE: 2, int: 1, qi: 1.5, sf: 1.5, vit: 1.5, end: 1 },
  AIL: { tir3: 2, tirMi: 1.5, fin: 2, drb: 1, pas: 1, reb: 1, defE: 2, defI: 1, int: 1, qi: 1.5, vit: 1.5, det: 1, end: 1 },
  AF: { fin: 2.5, tirMi: 1, tir3: 0.7, reb: 2.5, defI: 2.5, ctr: 1.5, defE: 1, qi: 1.5, for: 2, det: 1.5, end: 1 },
  PIV: { fin: 3, reb: 3, defI: 3, ctr: 2.5, for: 2.5, det: 1.5, qi: 1, end: 1, lf: 0.5 }
};

BM.CONFERENCES = { E: 'Conférence Est', W: 'Conférence Ouest' };

// Gravité : attention que le joueur attire, variable selon la forme du moment.
BM.GRAVITY = [
  { k: 'off', l: 'Gravité sans ballon', s: 'GSB', d: 'Attire la défense loin du ballon (menace de tir, déplacements) : ouvre des espaces à ses coéquipiers.' },
  { k: 'on', l: 'Gravité avec ballon', s: 'GAB', d: 'Aspire les aides quand il attaque : crée des tirs ouverts pour les autres.' },
  { k: 'def', l: 'Gravité défensive', s: 'GD', d: 'Dissuade l\'adversaire : moins de tirs au cercle, moins de réussite, plus de pertes.' }
];

// Noms des joueurs générés (draft) : fictifs.
BM.FIRST_NAMES = ['Lucas', 'Hugo', 'Théo', 'Nathan', 'Enzo', 'Louis', 'Jules', 'Mathis', 'Noah', 'Adam', 'Ethan', 'Malik',
  'Yanis', 'Moussa', 'Ibrahima', 'Kevin', 'Jordan', 'Tyrese', 'Marcus', 'Jalen', 'Andre', 'Luka', 'Nikola', 'Bogdan',
  'Dario', 'Mateo', 'Joel', 'Victor', 'Rudy', 'Evan', 'Killian', 'Sékou', 'Bilal', 'Axel', 'Rayan', 'Isaïa', 'Bastien',
  'Alexis', 'Thomas', 'Paul', 'Damien', 'Aaron', 'Elijah', 'Darius', 'Tony', 'Boris', 'Nando', 'Mike', 'Jaylen', 'Omar'];

BM.LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Durand', 'Lefebvre', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Garcia',
  'Diallo', 'Traoré', 'Koné', 'Camara', 'Cissé', 'Diop', 'Ndiaye', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller',
  'Wilson', 'Petrović', 'Jovanović', 'Marković', 'Bertrand', 'Fournier', 'Girard', 'Bonnet', 'Lambert', 'Fontaine',
  'Rousseau', 'Vincent', 'Muller', 'Faure', 'André', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier',
  'Legrand', 'Gauthier', 'Perrin', 'Robin', 'Clément', 'Morin', 'Henry', 'Roussel', 'Mathieu', 'Masson', 'Okafor',
  'Adebayo', 'Sy', 'Ba', 'Kanté', 'Sarr', 'Hoard', 'Lessort', 'Yabusele', 'Coulibaly', 'Touré'];

BM.TACTIC_OPTIONS = {
  pace: [
    { v: 'lent', l: 'Lent', d: 'Jeu placé, moins de possessions, moins de fatigue.' },
    { v: 'normal', l: 'Normal', d: 'Rythme équilibré.' },
    { v: 'rapide', l: 'Rapide', d: 'Transition, plus de possessions, plus de pertes et de fatigue.' }
  ],
  focus: [
    { v: 'interieur', l: 'Intérieur', d: 'Attaque du cercle et jeu poste bas.' },
    { v: 'equilibre', l: 'Équilibré', d: 'Prendre ce que la défense donne.' },
    { v: 'exterieur', l: 'Extérieur', d: 'Spacing et tirs à 3 points.' }
  ],
  defense: [
    { v: 'homme', l: 'Individuelle', d: 'Défense standard homme à homme.' },
    { v: 'zone', l: 'Zone 2-3', d: 'Protège la raquette, concède des tirs extérieurs.' },
    { v: 'press', l: 'Press', d: 'Provoque des pertes, épuise les deux équipes, laisse des brèches.' }
  ]
};

// Entraînement : inspiré des "match_preparation" de FM26 (focus + intensité + bandes de progression).
BM.TRAINING = {
  focus: [
    { v: 'equilibre', l: 'Équilibré', attrs: null },
    { v: 'tir', l: 'Tir', attrs: ['tir3', 'tirMi', 'lf', 'fin'] },
    { v: 'defense', l: 'Défense', attrs: ['defE', 'defI', 'ctr', 'int', 'reb'] },
    { v: 'physique', l: 'Physique', attrs: ['vit', 'det', 'for', 'end'] },
    { v: 'tactique', l: 'Tactique', attrs: ['qi', 'pas', 'drb', 'sf'] },
    { v: 'repos', l: 'Repos', attrs: [] }
  ],
  intensity: [
    { v: 'faible', l: 'Faible', prog: 0.6, rec: 12, inj: 0.4 },
    { v: 'normale', l: 'Normale', prog: 1, rec: 9, inj: 1 },
    { v: 'elevee', l: 'Élevée', prog: 1.45, rec: 5, inj: 2 }
  ]
};

// Causeries de mi-temps : effet selon l'écart au score.
BM.TEAM_TALKS = [
  { v: 'encourager', l: 'Encourager', fx: { mene: 2, serre: 4, derriere: 5 } },
  { v: 'feliciter', l: 'Féliciter', fx: { mene: 5, serre: 1, derriere: -4 } },
  { v: 'exiger', l: 'Exiger plus', fx: { mene: -2, serre: 3, derriere: 4 } },
  { v: 'calme', l: 'Rester calme', fx: { mene: 2, serre: 2, derriere: 1 } },
  { v: 'furieux', l: 'Coup de gueule', fx: { mene: -6, serre: 0, derriere: 6 }, spread: 7 }
];

BM.OBJECTIVES = {
  titre: 'Remporter le titre',
  demi: 'Atteindre la finale de conférence',
  playoffs: 'Se qualifier pour les playoffs',
  maintien: 'Ne pas finir dans les 5 derniers'
};
