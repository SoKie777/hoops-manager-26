# Hoops Manager 26 — Document de Design : Système Social du Mode Coach

**Version** : 1.0
**Auteur** : Game Designer Senior
**Cible** : Programmeur JS (vanilla, pas de framework)
**Périmètre** : Mode Manager uniquement. Le mode Ma Carrière hérite déjà d'une partie du socle (`BM.feedOf`, `BM.post`, `BM.cfeed`) — ce doc se concentre sur la boucle **Coach**, mais les helpers restent compatibles.

---

## 0. Rappel du socle existant (ne pas réinventer)

| Helper | Fichier | Rôle |
|---|---|---|
| `BM.post(g, who, handle, text, mine, likes)` | `legacy.js:273` | Ajoute un post en tête du fil (cap 60). |
| `BM.feedOf(g)` | `legacy.js:272` | Renvoie le bon fil (carrière vs manager). |
| `BM.socialAfterMatch(g, fx, m, focusId)` | `legacy.js:294` | Génère les posts d'après-match. Appelé depuis `BM.afterUserMatch` (`league.js:285`). |
| `BM.socialReply(g, target, tone)` | `legacy.js:333` | Applique la pub utilisateur (relations, moral, fans). |
| `BM.fansOf(team)` | `legacy.js:280` | `team.rep * 9000 + 120 000`. |
| `BM.news(g, kind, text, big)` | `legacy.js:11` | Actu ligue (cap 120). |
| `BM.addMessage(g, title, body, kind, options)` | `ecosystem.js:105+` | Inbox. |
| `BM.fixturesOn(g, day)` | `league.js:134` | Tous les matchs d'une journée. |
| `BM.playMatch(g, fx)` | `league.js:156` | Simule un match (sans UI). |
| `BM.afterUserMatch(g, fx, m)` | `league.js:250` | Hook après match utilisateur. |
| `BM.advance(g)` | `league.js:291` | Avance d'un jour ; retourne `{state:'match'}` si l'user a un match. |
| `BM.pressConference(g, fx, when)` | `ecosystem.js:180` | Système de conf existant (à réutiliser pour les taunts coach adverse). |
| `UI.feedHtml(list, n)` / `UI.newsHtml(g, n)` | `ui.js:1399-1411` | Rendu fil + actu. |
| `UI.tab_media()` | `ui.js:1459` | Onglet Médias (sous-onglets : Fil / Actualités / HoF / Héritage). |

**Important — timing des simulations** : dans `BM.advance` (ligne 305), les autres matchs du jour sont simulés **après** que l'utilisateur a joué le sien (au prochain appel d'`advance`). Pour pouvoir afficher un panneau "Scores de la nuit" *juste après* le match de l'utilisateur, il faut soit :
- **(A)** Simuler les autres matchs dans `BM.afterUserMatch` (recommandé — UX immédiate), puis `BM.endDay` au prochain `advance` ne rejoue rien.
- **(B)** Afficher le panneau au prochain `advance` (avant `BM.endDay`).

Le présent doc recommande **(A)**. Voir §2 pour le point d'ancrage exact.

---

## 1. Système de RIVALITÉS

### 1.1 Modèle de données

Trois types de rivalité, stockés sur la paire `{a, b}` (codes équipe triés alphabétiquement pour la clé) :

```js
// à ajouter dans js/legacy.js (à côté de BM.RIVALRIES_SEED plus bas)
BM.RIVAL_TYPES = { hist: 'Historique', recent: 'Récente', emerg: 'Émergente' };

// état runtime d'une paire rivale (créé à la volée)
g.rivalries = g.rivalries || {};            // clé "ATL-PHO" -> { type, heat, lastMet, events:[] }
```

Champ `heat` (0-100) : intensité courante. Valeurs initiales : 30 pour une `hist` adulte, 20 pour `recent`, 0 pour `emerg` (détectée à la volée).

### 1.2 Variations du heat

| Événement | Δ heat | Hook de code |
|---|---|---|
| Match gagné contre le rival | **+5** | `BM.afterUserMatch` (côté user) + `BM.applyResult` (côté IA, via `BM.legacyAfterMatch`) |
| Match perdu contre le rival | **+3** | idem |
| Trash-talk du coach adverse (inbox) | **+8** | nouveau hook `BM.rivalryTaunt` (voir §3.2) |
| Incident de match (flagrant 2, bagarre simulée) | **+12** | nouveau flag `m.incident` produit par `engine.js` (signalé par `BM.applyResult` quand `m.incident`) |
| Trade récent entre les deux clubs (≤ 30 jours) | **+6** ponctuel | `BM.executeTrade` (`ecosystem.js:377`) |
| Match de playoffs gagné contre le rival | **+10** bonus | `BM.applyResult` quand `fx.type==='playoff'` |
| Décroissance naturelle (saison régulière) | **−0,5 / jour** sans rencontre | `BM.ecoDaily` (`ecosystem.js:96`) |
| Décroissance bloquée en playoffs | **0** | `if (g.phase !== 'playoffs') decay` |

**Plafond** : 100. **Seuil d'émergence** : si deux équipes se rencontrent ≥ 2 fois en saison régulière avec un écart final ≤ 5 points, une rivalité `emerg` est créée à heat 35 (une seule fois par paire/saison).

### 1.3 Table de données initiale `BM.RIVALRIES_SEED`

30 équipes, 2 conférences (E/W), 30 villes africaines. Les paires ci-dessous sont des **rivalités historiques** (heat initial 55-70), basées sur la proximité géographique ou la transposition d'une vraie rivalité NBA.

> Programmeur : à coller tel quel dans `js/legacy.js`, juste après `BM.RIVAL_TYPES`.

```js
BM.RIVALRIES_SEED = [
  // --- Derbies géographiques (proximité ville) ---
  { a: 'SAC', b: 'BOS', heat: 68, type: 'hist', reason: 'Rivalité du fleuve Congo — Kinshasa vs Brazzaville,面对面 across the river.' },
  { a: 'LAL', b: 'DEN', heat: 60, type: 'hist', reason: 'Lagos vs Douala — les deux mégapoles du golfe de Guinée se disputent la suprématie économique et sportive.' },
  { a: 'NYK', b: 'MIN', heat: 58, type: 'hist', reason: 'Nairobi vs Mombasa — derby du Kenya, capitale vs port.' },
  { a: 'MIA', b: 'TOR', heat: 62, type: 'hist', reason: 'Marrakech vs Tunis — derby du Maghreb, les villes impériales s\'affrontent.' },
  { a: 'CHO', b: 'MIA', heat: 55, type: 'hist', reason: 'Casablanca vs Marrakech — derby marocain, le port vs la cité ocre.' },
  { a: 'SAS', b: 'CLE', heat: 57, type: 'hist', reason: 'Dakar vs Conakry — côte ouest-africaine, les deux capitales francophones.' },
  { a: 'ATL', b: 'PHO', heat: 60, type: 'hist', reason: 'Abidjan vs Accra — derby de la lagune, à 4 h de bus l\'une de l\'autre.' },
  { a: 'UTA', b: 'DAL', heat: 54, type: 'hist', reason: 'Kampala vs Dar es Salaam — corne de l\'Afrique, les Grands Lacs vs l\'océan Indien.' },
  { a: 'HOU', b: 'MEM', heat: 56, type: 'hist', reason: 'Harare vs Maputo — Afrique australe, le Zimbabwe vs le Mozambique.' },
  { a: 'LAC', b: 'SAC', heat: 64, type: 'hist', reason: 'Luanda vs Kinshasa — derby du bassin du Congo, à peine 600 km.' },

  // --- Rivalités de marque (transposition NBA) ---
  { a: 'BOS', b: 'LAL', heat: 70, type: 'hist', reason: 'Celtics vs Lakers : la plus grande rivalité de la ligue, transposée Brazzaville vs Lagos.' },
  { a: 'CHI', b: 'DET', heat: 66, type: 'hist', reason: 'Le Caire vs Djibouti : transposition Bulls–Pistons, la "Bad Boy" rivalité.' },
  { a: 'SAS', b: 'PHO', heat: 61, type: 'hist', reason: 'Dakar vs Accra : transposition Spurs–Suns, duel technique des années 2000.' },
  { a: 'GSW', b: 'CLE', heat: 60, type: 'hist', reason: 'Yamoussoukro vs Conakry : finales 2015-2018, le run des 3-points vs le roi solitaire.' }
];
```

**Total : 14 paires** (l'utilisateur demandait ~10, on en donne 14 pour densifier le tissu). À l'init, chaque paire est inscrite dans `g.rivalries` avec son `heat` de départ et un champ `events: []` (logs des incidents).

### 1.4 Helpers à créer

```js
BM.rivalryKey = function (codeA, codeB) {
  return [codeA, codeB].sort().join('-');
};

BM.rivalryOf = function (g, codeA, codeB) {
  var k = BM.rivalryKey(codeA, codeB);
  return g.rivalries ? g.rivalries[k] : null;
};

BM.rivalryHeat = function (g, codeA, codeB) {
  var r = BM.rivalryOf(g, codeA, codeB);
  return r ? r.heat : 0;
};

BM.rivalryAddHeat = function (g, codeA, codeB, delta, reason) {
  var k = BM.rivalryKey(codeA, codeB);
  g.rivalries = g.rivalries || {};
  var r = g.rivalries[k] = g.rivalries[k] || { heat: 0, type: 'emerg', events: [] };
  r.heat = Math.max(0, Math.min(100, r.heat + delta));
  r.lastMet = g.day;
  r.events.unshift({ day: g.day, season: g.season, d: delta, why: reason || '' });
  if (r.events.length > 8) r.events.length = 8;
  return r.heat;
};

BM.rivalryDecay = function (g) {
  if (g.phase === 'playoffs') return;            // fige en playoffs
  Object.keys(g.rivalries || {}).forEach(function (k) {
    var r = g.rivalries[k];
    if (r.lastMet === g.day) return;              // joué aujourd'hui, pas de decay
    r.heat = Math.max(0, r.heat - 0.5);
  });
};

// À appeler dans BM.ecoDaily (ecosystem.js:96)
// -> ajouter : if (BM.rivalryDecay) BM.rivalryDecay(g);

BM.initRivalries = function (g) {
  g.rivalries = g.rivalries || {};
  BM.RIVALRIES_SEED.forEach(function (s) {
    var k = BM.rivalryKey(s.a, s.b);
    if (!g.rivalries[k]) g.rivalries[k] = { heat: s.heat, type: s.type, reason: s.reason, events: [] };
  });
};
// À appeler dans BM.newGame (league.js:8) après la création des équipes.
```

### 1.5 Détection des émergentes

À ajouter dans `BM.applyResult` (`league.js:163`), après `BM.updateStreak` :

```js
// Détection de rivalité émergente
if (fx.type === 'league') {
  var diff = Math.abs(fx.hs - fx.as);
  if (diff <= 5 && BM.rivalryOf(g, home.code, away.code) === null) {
    // compter les rencontres serrées cette saison
    var metCount = g.fixtures.filter(function (f) {
      return f.played && f.type === 'league'
        && ((f.home === fx.home && f.away === fx.away) || (f.home === fx.away && f.away === fx.home));
    }).length;
    if (metCount >= 2 && !g.rivalries._emergChecked) {
      var k = BM.rivalryKey(home.code, away.code);
      g.rivalries[k] = { heat: 35, type: 'emerg', reason: 'Série de matchs serrés cette saison', events: [] };
      BM.news(g, 'record', 'Nouvelle rivalité en marche : ' + home.name + ' vs ' + away.name + '. La ligue surveille.', false);
    }
  }
}
```

### 1.6 Effets visibles (UI + juice)

| Seuil | Déclencheur | Effet |
|---|---|---|
| **heat ≥ 60** | Avant-match (journée où l'user joue le rival) | Le fil affiche 2-3 taunts de fans adverses en haut (`POSTS.rivalryFanTaunt`, voir §3.1). Toast d'entrée : *"La rivalry est chaude : {T} vs {O}."* |
| **heat ≥ 80** | Inbox avant le match | Le coach adverse envoie un message (`BM.rivalryTaunt`), 3 choix de réponse (voir §3.2). |
| **heat ≥ 90** | Scorebug pendant le match | Badge **"RIVALRY GAME"** rouge pulsant à côté du scorebug (cf. `js/match-ui.js`). Confettis `BM.Juice.confetti()` plus denses sur une victoire. |
| **heat ≥ 100** | Dès qu'atteint | Notification toast "La rivalité {T} vs {O} est à son comble !" + titre automatique "Match de l'année" sur le prochain match (header accueil). |

**Note UI** : sur l'onglet Ligue (`UI.tab_comp`) et sur la fiche équipe (`UI.teamCard`), afficher pour chaque équipe un mini-badge "Rivalités" qui ouvre une vue listant ses paires rivales (heat actuel, type, derniers événements). Pas de nouvel onglet — c'est un sous-panneau.

---

## 2. SCORES DE LA NUIT (panneau post-match)

### 2.1 Timing d'exécution (le point d'ancrage)

**Décision** : simuler les autres matchs du jour **dans `BM.afterUserMatch`** (option A du §0). Concrètement, à la fin de `BM.afterUserMatch` (`league.js:250`), juste avant le bloc `BM.socialAfterMatch` :

```js
// À insérer dans BM.afterUserMatch, juste avant l'appel à BM.socialAfterMatch :
if (BM.simOtherMatches) BM.simOtherMatches(g);   // simule les autres matchs du jour
if (BM.buildNightScores) g.nightScores = BM.buildNightScores(g, fx);  // construit le panneau
```

Et le corps de `BM.simOtherMatches` :

```js
BM.simOtherMatches = function (g) {
  var others = BM.fixturesOn(g, g.day).filter(function (f) {
    return !f.played && f.home !== g.userTeam && f.away !== g.userTeam;
  });
  others.forEach(function (fx) { BM.playMatch(g, fx); });
};
```

Quand l'utilisateur re-clique sur "Avancer" ensuite, `BM.advance` ne rejouera rien (les `fx.played` sont déjà à `true`) — `BM.endDay` s'exécute direct.

### 2.2 Sélection des résultats à afficher

Tous les matchs du jour sont déjà joués. On en sélectionne **5 à 7** maximum, selon cet ordre de priorité :

1. **Matchs de rivalité** (peu importe le score) — jusqu'à 2, signalés d'un chip `RIVALRY`.
2. **Matchs de la division/conférence de l'utilisateur** — jusqu'à 2.
3. **Upsets** (vainqueur classé ≥ 10 places derrière le perdant au moment du match) — jusqu'à 2, chip `UPSET`.
4. **Grosses perfs individuelles** (joueur à 45+ pts, triple-double, OT) — jusqu'à 2, chip `PERF`.
5. **Matchs en OT** (prolongations) — 1, chip `OT`.
6. **Complément** : autres matchs du jour pour remplir jusqu'à 5 minimum.

**Clé de tri** : `score * poids`, où chaque match reçoit un score d'"intérêt" :
- `upsetMag` (différence de classement) × 4
- `+ 25` si rivalité (heat × 0,3)
- `+ 20` si division/conférence user
- `+ bestPlayerPts × 0,8` (si ≥ 35 pts)
- `+ 15` si OT
- `+ 30` si l'adversaire direct de l'user a perdu (voir §2.3)

### 2.3 Spécial "Bonne nouvelle"

Pour chaque rival de l'utilisateur (toutes paires où l'une des équipes est l'user), si ce rival **perd** ce soir :
- Ligne affichée en vert (`#1f7a3a`) avec chip `+1 BONNE NOUVELLE` en suffixe.
- Si le rival gagne : ligne neutre, mais chip `À surveiller` en gris.

Pour les équipes devant l'user au classement de la conférence : même traitement — une défaite de l'un des 3 équipes juste au-dessus est surlignée en vert tendre.

### 2.4 Format visuel

Panneau plein écran modal (même chrome que la feuille de match d'après-match). Structure :

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌙 SCORES DE LA NUIT · Journée 24 · 12 mars 2027            [Fermer]│
├─────────────────────────────────────────────────────────────────────┤
│  Ton match :  Lagos Lakers 112 — 108 Brazzaville Celtics   ★ GAGNÉ  │
│                                                                       │
│  📌 À LA UNE                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ RIVALRY  Abidjan Hawks 101 — 99 Accra Suns        +1 BN (perd)  ││
│  │ UPSET    Tunis Raptors 104 — 99 Le Caire Bulls    OT · Sarr 38  ││
│  │ PERF     Yamoussoukro Warriors 118 — 105 Dakar Sp  Diallo 51   ││
│  │ CONF     Conakry Cavaliers 97 — 92 Malabo Bucks                 ││
│  │ PERF     Nairobi Knicks 121 — 110 Mombasa TW       OT · Trip-dbl ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  📊 CLASSEMENT — Conférence Ouest                                    │
│  1. Lagos Lakers   24-10  ▲1                                         │
│  2. Douala Nuggets 23-11  ▼1                                         │
│  3. Yamoussoukro   22-12  —                                          │
│  ...                                                                  │
│  6. Dakar Spurs    18-16  ▲2   ← ton prochain adversaire (heat 57)  │
│                                                                       │
│  ▶ Continuer vers la journée suivante                                │
└─────────────────────────────────────────────────────────────────────┘
```

Chips utilisées (classes CSS suggérées) :

| Chip | Couleur | Usage |
|---|---|---|
| `RIVALRY` | rouge bordeaux `#9b1c2e` | match entre deux rivaux |
| `UPSET` | orange `#d97706` | surprise |
| `PERF` | violet `#7c3aed` | perf individuelle ≥ 40 pts / TD |
| `OT` | cyan `#0891b2` | prolongation(s) |
| `CONF` | bleu `#1d4ed8` | match de conférence user |
| `+1 BN` | vert `#15803d` | bonne nouvelle (rival perd) |
| `À surveiller` | gris `#6b7280` | rival gagne |

**Densité** : 5 lignes "À la une" + 1 bloc classement condensé (top 8 conférence user avec les deltas `▲/▼` de la nuit). Bouton "Continuer" en bas qui déclenche `BM.advance` (le `BM.endDay`).

### 2.5 Helper à coder

```js
BM.buildNightScores = function (g, userFx) {
  var night = BM.fixturesOn(g, g.day).filter(function (f) { return f.played; });
  var me = g.teams[g.userTeam], myConf = me.conf;

  var rows = night.map(function (fx) {
    var home = g.teams[fx.home], away = g.teams[fx.away];
    var winner = fx.hs > fx.as ? home : away;
    var loser = winner === home ? away : home;
    var heat = BM.rivalryHeat(g, home.code, away.code);
    var isUserFx = fx.home === me.id || fx.away === me.id;
    var diff = Math.abs(fx.hs - fx.as);
    var ot = fx.ot || (diff <= 3 && fx.qPts && fx.qPts.length > 4); // OT détecté
    var mvp = fx.mvp ? g.players[fx.mvp] : null;
    var mvpPts = mvp && fx.box && fx.box[mvp.id] ? fx.box[mvp.id].pts : 0;

    // sélecteur de chip primaire
    var chip = heat >= 55 ? 'RIVALRY'
             : diff >= 0 && BM.isUpset(g, fx, winner, loser) ? 'UPSET'
             : mvpPts >= 45 ? 'PERF'
             : ot ? 'OT'
             : (home.conf === myConf && away.conf === myConf) ? 'CONF'
             : null;

    // Bonne nouvelle : rival de l'user perd
    var rivalOfUser = BM.isRivalOf(g, me, winner) || BM.isRivalOf(g, me, loser);
    var goodNews = rivalOfUser && loser === (BM.isRivalOf(g, me, winner) ? winner : loser) ? 'BN' : null;
    // version simple : si l'une des 2 équipes est rivale de l'user et qu'elle perd
    goodNews = null;
    [home, away].forEach(function (t) {
      if (BM.rivalryHeat(g, me.code, t.code) >= 50 && t !== me && t === loser) goodNews = 'BN';
    });

    var score = (heat >= 55 ? 25 + heat * 0.3 : 0)
              + (chip === 'UPSET' ? 30 : 0)
              + (mvpPts >= 40 ? mvpPts * 0.8 : 0)
              + (ot ? 15 : 0)
              + (goodNews === 'BN' ? 30 : 0)
              + (home.conf === myConf && away.conf === myConf && !isUserFx ? 8 : 0);

    return { fx: fx, home: home, away: away, winner: winner, loser: loser, heat: heat, chip: chip,
             ot: ot, mvp: mvp, mvpPts: mvpPts, goodNews: goodNews, score: score, isUserFx: isUserFx };
  });

  rows.sort(function (a, b) { return b.score - a.score; });
  return {
    userFx: userFx,
    headline: rows.filter(function (r) { return r.score > 0; }).slice(0, 5),
    rest: rows.filter(function (r) { return r.score === 0; }).slice(0, 3),
    standings: BM.standings(g, myConf).slice(0, 8),
    prevStandings: g._prevStandings || {} // pour calculer ▲/▼ ; à snap avant sim
  };
};

BM.isUpset = function (g, fx, winner, loser) {
  var st = BM.standings(g);
  return st.indexOf(loser) >= 0 && st.indexOf(winner) >= 0
    && st.indexOf(winner) - st.indexOf(loser) >= 8; // winner au moins 8 places derrière
};

BM.isRivalOf = function (g, me, t) {
  return BM.rivalryHeat(g, me.code, t.code) >= 50;
};
```

### 2.6 UI à coder

Ajouter dans `UI.tab_home` ou un nouvel écran modal déclenché après le post-match user :

```js
UI.nightScoresModal = function (g) {
  var ns = g.nightScores;
  if (!ns) return '';
  // rendu HTML du panneau décrit en §2.4
  // ...
};
```

Bouton "Continuer vers la journée suivante" → `UI.actions.continue` qui appelle `BM.advance(g)` (qui ne rejoue pas les matchs, ils sont déjà `played`).

---

## 3. TRASH-TALK (voix multiples)

### 3.1 Fans adverses (étendre `POSTS.troll` / `POSTS.oppFan`)

**État actuel** (`legacy.js:286-287`) : 3 templates `troll`, 2 templates `oppFan`. On étend à **8 + 8** et on ajoute un pool dédié aux rivalités (`rivalryFanTaunt`, 6 templates).

```js
// À insérer dans le var POSTS = {...} de legacy.js (ligne 283), en remplaçant troll et oppFan :

troll: [
  'Les {T} sans {S}, c\'est une équipe de G League. Point.',
  'Très surcoté ce {S}. Changez-moi d\'avis.',
  'J\'ai pas regardé le match mais je sais que {S} a forcé ses tirs.',
  '{US}-{THEM} ? Pas besoin de résumé, on sait déjà qui a pris la sauce. 💀',
  'Le banc des {T} ferait pas peur à un club de quartier.',
  'Vous appelez ça une défense ? {O} a mis 40 dans la raquette.',
  '{S} a le contrat, pas le niveau. Point final.',
  'Les {T} en mode "reconstruction" depuis 12 ans, ça devient une tradition.'
],
oppFan: [
  'Merci les {T} pour la victoire facile. Revenez quand vous voulez.',
  'Respect à {S}, il a tenu sa baraque. Mais la victoire est pour nous.',
  'On vous attendait plus coriaces. {O} en mode patron ce soir.',
  '{US}-{THEM}… pas besoin de forcer, on a géré du début à la fin.',
  'GG les {T}, mais la différence s\'est faite là où il fallait : dans la tête.',
  'Le parquet de chez nous, c\'est pas un cadeau. Vous l\'avez compris.',
  'On garde le tie-break maintenant. Bonne chance pour la suite. 😉',
  '{S} a beau avoir mis {PTS}, il a fini sur le parquet. La victoire reste à {O}.'
],
rivalryFanTaunt: [
  'Encore une fois les {T}. Vous nous appartenez. #{TS}vs{OS}',
  'Ce derby-là, il est à {O}. Comme d\'habitude.',
  'On vous attend au retour. Avec des huées, promis. 🔥',
  'Règle n°1 : on ne perd jamais contre les {T}. Respectée.',
  'Le heat est monté d\'un cran. Préparez vos parquets, ça va chauffer.',
  'Vous croyiez à un exploit ? Mignon. {O} ne perd jamais à domicile contre les {T}.'
],
```

**Hooks** :
- Dans `BM.socialAfterMatch` (`legacy.js:294`), remplacer le tirage actuel :
  ```js
  var isRival = BM.rivalryHeat(g, team.code, opp.code) >= 60;
  var pool = isRival ? POSTS.rivalryFanTaunt : (won ? POSTS.troll : POSTS.oppFan);
  if (r.chance(isRival ? 0.85 : 0.55)) BM.post(g, 'Fan adverse', '@' + r.pick(FAN_HANDLES), fill(r.pick(pool), o));
  ```
- En **pré-match** d'un rival heat ≥ 60, pousser 2 taunts adverses en haut du fil (via un nouveau helper `BM.preMatchRivalryPosts` appelé dans `BM.advance` quand on détecte un match rival à venir dans la journée).

### 3.2 Coach adverse (inbox + réponse)

Nouveau helper `BM.rivalryTaunt(g, fx)` à appeler dans `BM.advance` quand un match rival est détecté pour la prochaine journée de l'utilisateur et `heat >= 80`. Utilise le canal `BM.addMessage` (déjà existant dans `ecosystem.js`) avec 3 choix de réponse.

```js
BM.RIVALRY_TAUNTS = {
  arrogant: [
    'On va vous faire la même chose qu\'au match aller. Préparez vos excuses.',
    'Votre effectif ne nous fait pas peur. On attend ça avec impatience.',
    'Le parquet, on le connaît par cœur. Vous allez souffrir.'
  ],
  respectful: [
    'Belle série pour vous. Ce soir, ce sera du basket de haut niveau.',
    'On se respecte. Que le meilleur gagne — mais on a une revanche à prendre.',
    'Vous êtes solides à domicile. On vient pour jouer notre basket.'
  ],
  provoc: [
    'Vous avez eu chaud la dernière fois. La chance ne dure qu\'un match.',
    'Votre star, on va l\'éteindre. Dès la 1re minute.',
    'Le vestiaire nous attend pour la 3e mi-temps. Préparez-vous à perdre du monde.'
  ]
};

BM.rivalryTaunt = function (g, fx) {
  var me = g.teams[g.userTeam], opp = g.teams[fx.home === me.id ? fx.away : fx.home];
  var heat = BM.rivalryHeat(g, me.code, opp.code);
  if (heat < 80) return;
  var rng = g.rng, tone = rng.pick(['arrogant', 'respectful', 'provoc']);
  var body = 'Message du coach des ' + opp.name + ' (heat ' + Math.round(heat) + '/100) :\n\n"' + rng.pick(BM.RIVALRY_TAUNTS[tone]) + '"';
  BM.addMessage(g, 'Message de ' + opp.city + ' — ton ' + tone, body, 'media', [
    { label: 'Répondre avec classe',   act: 'rivalryReply', kind: 'classy',  opp: opp.id, hint: '−3 heat (apaise)' },
    { label: 'Renvoyer la balle',       act: 'rivalryReply', kind: 'fireback', opp: opp.id, hint: '+5 heat (relance la rivalité)' },
    { label: 'Répondre froidement',    act: 'rivalryReply', kind: 'cold',    opp: opp.id, hint: '+2 heat (tendu)' }
  ]);
};

// Handler de réponse (à câbler dans UI.actions comme les autres act)
BM.rivalryReply = function (g, kind, oppId) {
  var opp = g.teams[oppId], me = g.teams[g.userTeam];
  var replies = {
    classy:  ['Nous aussi on respecte le jeu. Que le meilleur gagne.', 'On répondra sur le parquet.', 'Beaux mots. Le ballon parlera.'],
    fireback: ['On vous attend. Préparez votre parquet, on le marquera.', 'Belle provocation. On note.', 'Parlez moins, jouez plus. Vous verrez bien.'],
    cold:    ['…', 'Pas de commentaire.', 'On verra sur le terrain.']
  };
  var deltas = { classy: -3, fireback: +5, cold: +2 };
  var r = g.rng.pick(replies[kind]);
  BM.rivalryAddHeat(g, me.code, opp.code, deltas[kind], 'taunt coach (' + kind + ')');
  BM.post(g, 'Coach ' + g.managerName, '@coach' + (g.managerName || '').toLowerCase().replace(/[^a-z]/g, ''),
          r + ' #rivalry', true, Math.round(BM.fansOf(me) * 0.012 + 800));
  return 'Réponse publiée. Heat ' + (deltas[kind] > 0 ? '+' : '') + deltas[kind] + ' (' + kind + ').';
};
```

`UI.actions.rivalryReply` :
```js
UI.actions.rivalryReply = function (el) {
  var res = BM.rivalryReply(UI.g, el.dataset.kind, +el.dataset.opp);
  UI.toast(res);
  UI.save();
};
```

### 3.3 Joueurs adverses (post-match de rivalité)

Après un match de rivalité (heat ≥ 50), 1 joueur adverse (le MVP adverse s'il a ≥ 25 pts, sinon le capitaine adverse) poste dans le fil.

```js
BM.OPP_PLAYER_POSTS = {
  won: [
    'On vous a eu. Rien de personnel, juste du basket. 🔥',
    'Gros match les {T}. La prochaine fois ça sera pire, promis.',
    'Le parquet, c\'est nous. Le tie-break, c\'est nous. La suite, on verra.',
    'Respect pour le fight, mais la W est pour {O}.',
    'On savait qu\'on l\'aurait. {S} a essayé, pas suffisant.'
  ],
  lost: [
    'OK celle-là elle est pour vous. On vous attend au retour.',
    'Rien à dire, vous avez été plus forts. Tournons la page.',
    'On prend note. Et on revient.',
    'La prochaine fois, finissez pas le match avant la 4e. 😉',
    'GG les {T}. Mais le compteur n\'est pas fini.'
  ]
};
```

**Hook** : dans `BM.socialAfterMatch` (`legacy.js:294`), après les posts existants :
```js
if (isRival) {
  var oppStar = m.roster[1 - userSide].slice().sort(function (a, b) { return m.box[b.id].pts - m.box[a.id].pts; })[0];
  if (oppStar && m.box[oppStar.id].pts >= 20 && r.chance(0.7)) {
    var pool = won ? BM.OPP_PLAYER_POSTS.lost : BM.OPP_PLAYER_POSTS.won;   // si l'user gagne, l'opp a perdu → pool "lost"
    var o2 = { T: team.nick || team.name, O: opp.nick || opp.name, S: star ? BM.fullName(star) : '' };
    BM.post(g, BM.fullName(oppStar), '@' + (oppStar.first + oppStar.last).toLowerCase().replace(/[^a-z]/g, ''), fill(r.pick(pool), o2));
    // Déclarer `g.replyOppPlayer = oppStar.id` pour permettre la réponse user
    g.replyOppPlayer = oppStar.id;
  }
}
```

**Réponse user** : ajouter `['oppPlayer', 'Joueur adverse']` dans `BM.socialTargets` (mode Manager), avec gestion spécifique dans `BM.socialReply` : `fireback` ajoute +4 heat, `dismiss` −1, `respect` +0 mais +5 relation future si re-trade.

### 3.4 Joueurs de ton équipe (étendre `POSTS.mate` / `POSTS.mateLoss`)

**État actuel** (`legacy.js:288-289`) : 3 templates `mate`, 2 `mateLoss`. On étend à 8 + 5, plus un pool dédié aux **exploits** (`mateExploit`, voir §5).

```js
mate: [
  'Grosse soirée de la famille ! Fier de jouer avec {S}.',
  'On se remet au travail dès demain. Ensemble.',
  'Le vestiaire est soudé, ça se voit sur le terrain.',
  '{S} est notre leader. On le suit les yeux fermés.',
  'On a été sérieux du début à la fin. Voilà le résultat.',
  'Toute l'équipe a répondu présent. Le banc a fait la différence.',
  'Le coach a donné le plan, on a exécuté. Simple.',
  'Une victoire collective. C\'est ça qui compte en playoffs.'
],
mateLoss: [
  'On doit être meilleurs. Moi le premier.',
  'Pas notre soirée. On répond au prochain match.',
  'On prend la leçon, on corrige, on avance.',
  'Le vestiaire reste uni. On sortira de ça.',
  'Franchement, on s\'est loupés. On assume.'
],
mateExploit: [
  'Le goat {S} ! On a un leader, on l\'a vu ce soir. 🐐',
  'Je l\'ai vu de près : {S} est pas de ce monde. {PTS} points, sérieux ?',
  'Quand {S} est dans cette zone, on a juste à courir et marquer.',
  'On a assisté à un match historique. {S} dans la légende des {T}.',
  'Celle-là on s\'en souviendra. {S} au sommet, le vestiaire en feu.',
  'Le parquet brûlait encore après son dernier tir. {S} = légende.',
  'Y\'a des soirées où tu regardes ton coéquipier et tu sais que c\'est sa nuit. Ce soir c\'était {S}.',
  'On joue pour ces moments-là. {S} a tout donné, on a suivi.'
],
```

**Hook** : dans `BM.socialAfterMatch`, si l'exploit est détecté (voir §5), remplacer le pool `mate` par `mateExploit` et pousser **2 posts** de coéquipiers différents (au lieu d'1 avec proba 0,6).

---

## 4. MÉDIAS (presse + headlines)

### 4.1 Les 4 publications

| Nom | Style | Couleur de logo | Ton |
|---|---|---|---|
| **Hoops Daily** | Généraliste | bleu marine | Factuel, sobre, score en tête |
| **Courtside TV** | Analyses | violet | Posé, stats, "clés du match" |
| **The Bleacher Africa** | Punchlines | orange | Ton décalé, memes, buzz |
| **Rep League** | Presse à scandale | rouge | Ton provoc, rumeurs, adjectifs chargés |

Chaque publication a un `handle` unique : `@hoopsdaily`, `@courtsidetv`, `@bleacherafrica`, `@repleague`.

### 4.2 Génération des headlines après CHAQUE journée

**Important** : c'est après `BM.endDay` (donc pour les journées sans match user, ET pour les journées avec match user — dans ce cas le panneau "Scores de la nuit" affiche déjà les perfs, mais on ajoute aussi 2-3 headlines ligue).

Nouveau helper `BM.dailyHeadlines(g)` à appeler dans `BM.endDay` (`league.js:312`), juste avant `g.day++` :

```js
BM.dailyHeadlines = function (g) {
  var night = BM.fixturesOn(g, g.day).filter(function (f) { return f.played; });
  var cands = [];
  night.forEach(function (fx) {
    var home = g.teams[fx.home], away = g.teams[fx.away];
    var winner = fx.hs > fx.as ? home : away, loser = winner === home ? away : home;
    var mvp = fx.mvp ? g.players[fx.mvp] : null;
    var mvpPts = mvp && fx.box && fx.box[mvp.id] ? fx.box[mvp.id].pts : 0;
    var td = mvp && fx.box && fx.box[mvp.id] && (function (b) {
      return [b.pts, b.reb, b.ast, b.stl, b.blk].filter(function (v) { return v >= 10; }).length >= 3;
    })(fx.box[mvp.id]);
    var ot = fx.qPts && fx.qPts.length > 4;
    var isUpset = BM.isUpset(g, fx, winner, loser);
    var heat = BM.rivalryHeat(g, home.code, away.code);

    // Catégories de headlines
    if (mvpPts >= 50) cands.push({ k: 'big', t: BM.fullName(mvp) + ' lance une bombe : ' + mvpPts + ' points', s: 'Les ' + winner.name + ' dominent ' + loser.city + ' ' + fx.hs + '-' + fx.as, pub: 'Hoops Daily', score: 50 + mvpPts });
    if (td) cands.push({ k: 'td', t: 'Triple-double de ' + BM.shortName(mvp) + ' !', s: 'Performance complète dans la victoire des ' + winner.name, pub: 'Courtside TV', score: 45 });
    if (isUpset) cands.push({ k: 'upset', t: 'Le hold-up du soir : ' + loser.city + ' tombe à ' + winner.city, s: 'Les ' + winner.nick + ' surprennent tout le monde. Analyse.', pub: 'Courtside TV', score: 40 });
    if (ot) cands.push({ k: 'ot', t: fx.hs + '-' + fx.as + ' après prolongation : le match fou de ' + winner.city, s: 'Un classique pour les fans. ' + (mvp ? BM.shortName(mvp) + ' MVP.' : ''), pub: 'Hoops Daily', score: 35 });
    if (heat >= 70) cands.push({ k: 'rivalry', t: 'Rivalité en feu : ' + winner.city + ' prend le dessus sur ' + loser.city, s: 'Le heat monte. La ligue s\'enflamme.', pub: 'The Bleacher Africa', score: 30 + heat * 0.2 });

    // Streaks
    var wStreak = parseInt((winner.record.streak || 'V0').slice(1), 10);
    var lStreak = parseInt((loser.record.streak || 'D0').slice(1), 10);
    if ((winner.record.streak || '').charAt(0) === 'V' && wStreak >= 8)
      cands.push({ k: 'streak', t: 'Les ' + winner.nick + ' en feu : ' + wStreak + ' victoires de suite', s: 'Personne ne semble pouvoir les arrêter.', pub: 'Hoops Daily', score: 25 + wStreak });
    if ((loser.record.streak || '').charAt(0) === 'D' && lStreak >= 6)
      cands.push({ k: 'slump', t: 'Crise à ' + loser.city + ' : ' + lStreak + ' défaites de suite', s: 'La direction commence à s\'agiter.', pub: 'Rep League', score: 25 + lStreak });

    // Rep League : pique perso si l'user perd avec un grand écart
    if ((fx.home === g.userTeam || fx.away === g.userTeam) && loser.id === g.userTeam && Math.abs(fx.hs - fx.as) >= 20)
      cands.push({ k: 'roast', t: 'Les ' + loser.nick + ' humiliés : ' + Math.abs(fx.hs - fx.as) + ' points d\'écart', s: 'Le parquet, la salle, et peut-être le coach tremblent.', pub: 'Rep League', score: 60 });
  });

  cands.sort(function (a, b) { return b.score - a.score; });
  var top = cands.slice(0, 3);
  g.headlines = g.headlines || [];
  g.headlines.unshift({ day: g.day, season: g.season, items: top });
  if (g.headlines.length > 30) g.headlines.length = 30;

  // Pousser chaque headline dans le fil (visible dans "Médias" + "Fil")
  top.forEach(function (h) {
    BM.post(g, h.pub, '@' + h.pub.toLowerCase().replace(/[^a-z]/g, ''), h.t + ' | ' + h.s, false, Math.round(BM.fansOf(g.teams[g.userTeam]) * 0.003 + 600));
    // Et en actu ligue si score ≥ 50
    if (h.score >= 50) BM.news(g, 'record', h.t + ' — ' + h.s, h.k === 'big' || h.k === 'roast');
  });
};
```

### 4.3 Templates de headlines (15 concrets en français)

Format `"Titre court | sous-titre"`. À piocher dans `BM.dailyHeadlines` selon le contexte pour varier le wording.

```js
BM.HEADLINE_TEMPLATES = {
  big50: [
    '{MVP} explose à {PTS} points | Les {W} renversent les {L}, {HS}-{AS}',
    'Soirée historique pour {MVP} | {PTS} unités et une victoire des {W}, la ligue est prévenue',
    'L\'orage {MVP} sur le parquet | {PTS} points, les {L} n\'ont rien pu faire'
  ],
  big60: [
    'INSOLITE : {MVP} plante {PTS} points | La ligne statistique la plus folle de la saison',
    '{MVP} rentre dans la légende | {PTS} points, les {W} surclassent tout le monde'
  ],
  tripleDouble: [
    'Triple-double de {MVP} | {PTS} pts, {REB} reb, {AST} pd — les {W} gèrent la nuit',
    'Le tableau complet de {MVP} | Triple-double et victoire des {W}, carton plein'
  ],
  upset: [
    'Hold-up à {WCITY} | Les {W} surprennent les {L}, fin de série ?',
    'Le choc de la nuit | Les {L} tombent à {WCITY}, personne ne l\'attendait',
    'Les {W} frappent fort | {L} renversés, la conférence tremble'
  ],
  ot: [
    '{HS}-{AS} après prolongation | Le match fou de la nuit à {WCITY}',
    'OT {N} : le parquet a tremblé | Les {W} arrachent la victoire face aux {L}',
    'Suspens jusqu\'au bout | Les {W} s\'imposent en OT, {MVP} MVP du match'
  ],
  rivalry: [
    'Derby en feu : {W} > {L} | Le heat monte à {HEAT}/100, la ligue s\'enflamme',
    'Rivalité classique, les {W} s\'imposent | {L} prépare déjà la revanche',
    'Pas de quartier entre {W} et {L} | La rivalité monte d\'un cran'
  ],
  streak: [
    'Les {W} en feu : {N} victoires de suite | Personne ne semble pouvoir les arrêter',
    'Machine à gagner | Les {W} enchaînent, {N}e victoire consécutive',
    'Série en cours : {N} | Les {W} survolent la conférence'
  ],
  slump: [
    'Crise à {LCITY} : {N} défaites de suite | La direction commence à s\'agiter',
    'Les {L} coulent | {N}e revers consécutif, le coach en sursis ?',
    'Le fond de tableau se rapproche | Les {L} ne gagnent plus, ça inquiète'
  ],
  roast: [
    'Les {L} humiliés à {N} points d\'écart | Le parquet, la salle et le coach tremblent',
    'Fiasco total pour les {L} | {HS}-{AS}, le compte Twitter se moque déjà',
    'Les {L} prennent l\'eau | Le pire écart de la saison, le vestiaire silencieux'
  ]
};
```

**Règles de remplissage** : `{MVP}` = nom court du joueur du match, `{PTS}` `{REB}` `{AST}` = stats, `{W}` `{L}` = nick vainqueur/perdant, `{WCITY}` `{LCITY}` = ville, `{HS}` `{AS}` = scores, `{N}` = nombre (streak ou OT), `{HEAT}` = heat rivalité.

### 4.4 Page "Médias" rénovée (`UI.tab_media`)

Sous-onglets actuels : `Fil / Actualités / HoF / Héritage`. **Ajouter 2 sous-onglets** : `À la une` (headlines du jour) et `Presse` (vue par publication).

Nouvel ordre : `Fil · À la une · Presse · Actualités · HoF · Héritage`.

**Vue "À la une"** : les 7 derniers jours de headlines (3 par jour = 21 headlines max), groupés par jour avec la date en header. Chaque headline = une carte `[logo pub] Titre / Sous-titre /jour`.

**Vue "Presse"** : 4 colonnes (une par publication), 6 derniers posts de chacune. Clic sur une pub filtre tout le reste.

**Vue "Fil"** (existante) : inchangée, mais on y pousse aussi les headlines du jour (déjà fait par `BM.dailyHeadlines`).

### 4.5 Hook de câblage

```js
// Dans BM.endDay (league.js:312), avant g.day++ :
if (BM.dailyHeadlines) BM.dailyHeadlines(g);
```

---

## 5. LOUANGES SUR EXPLOITS

### 5.1 Déclencheurs et effets

Chaque déclencheur produit : **(a)** un effet visuel, **(b)** un boost de fans, **(c)** un nombre de posts générés dans le fil, **(d)** un message inbox optionnel du board.

| ID | Déclencheur | (a) Effet visuel | (b) Boost fans | (c) Posts fil | (d) Inbox board |
|---|---|---|---|---|---|
| `L1_UPSET_TOP5` | Victoire contre une équipe top-5 conférence alors que l'user est hors top-15 | Toast "EXPLOIT DU SOIR" + confettis denses + son `BM.Juice.sound('cheer')` | +3 % `team.fans` (×1,5 si en playoffs) | 4 posts (2 fans, 1 mate, 1 Hoops Daily) | "La direction vous tire chapeau. Ce soir on a fait parler la ville." |
| `L2_STREAK_5` | 5 victoires consécutives | Toast "SÉRIE DE 5 !" + mini-confettis | +1,5 % fans | 2 posts (1 fan + 1 Bleacher Africa) | — |
| `L2_STREAK_10` | 10 victoires consécutives | Toast "DIX D\'AFFILÉE !" + confettis + animation bannière | +3 % fans | 3 posts | "On parle de vous dans toute la ligue. Continuez." |
| `L2_STREAK_15` | 15 victoires consécutives | Toast + bannière clignotante + son spécial | +5 % fans | 4 posts | "Vous écrivez l\'histoire du club. Bravo." |
| `L2_STREAK_20` | 20 victoires consécutives | Confettis denses + écran de coupure "HISTORIQUE" + son spécial | +8 % fans | 6 posts + 1 headline big | "Le board vous propose une prolongation de contrat." |
| `L3_COMEBACK_20` | Comeback de ≥ 20 pts au halftime | Toast "COMEBACK !" + bannière + confettis | +2 % fans | 3 posts (1 fan + 1 mate + 1 Courtside TV) | — |
| `L4_PTS_50` | Ton joueur marque 50+ pts | Toast "50 POINTS !" + animation portrait + confettis | +1,5 % fans | 4 posts (2 mateExploit + 1 fan + 1 Bleacher) | — |
| `L4_TRIPLE_DOUBLE` | Ton joueur réalise un triple-double | Toast "TRIPLE-DOUBLE" | +1 % fans | 2 posts (1 mate + 1 Courtside) | — |
| `L4_BUZZER_BEATER` | Game-winner au buzzer (à détecter dans `engine.js`) | Toast "BUZZER BEATER !" + ralenti + confettis | +2,5 % fans | 5 posts (2 fans + 1 mate + 1 Bleacher + 1 Rep League) | — |
| `L5_CLINCH_PLAYOFFS` | Match qui qualifie mathématiquement pour les playoffs | Toast + bannière "PLAYOFFS !" + confettis | +4 % fans | 5 posts + 1 headline | "Mission accomplie. La direction est fière. La suite ? Allez chercher le titre." |
| `L5_CLINCH_DIVISION` | Match qui décroque le titre de division | Toast + bannière + confettis + son spécial | +5 % fans | 6 posts + 1 headline big | "Champions de division ! Un immense bravo du board." |
| `L5_CLINCH_SEED1` | Match qui sécurise la 1re place de conférence | Bannière pleine + confettis denses | +6 % fans | 7 posts + 1 headline big | "Vous finissez 1er de conf. Le board rêve déjà du titre." |

### 5.2 Hook centralisé

Créer `BM.checkPraises(g, fx, m)` appelé depuis `BM.afterUserMatch` (juste après `BM.socialAfterMatch`) :

```js
BM.PRAISES = [
  { id: 'L1_UPSET_TOP5', test: function (g, fx, m, ctx) {
      var st = BM.standings(g, ctx.me.conf);
      var oppRank = st.indexOf(ctx.opp) + 1, meRank = st.indexOf(ctx.me) + 1;
      return ctx.won && oppRank <= 5 && meRank >= 15;
  }},
  { id: 'L2_STREAK_5',  test: function (g, fx, m, ctx) { return ctx.won && ctx.streakN === 5; } },
  { id: 'L2_STREAK_10', test: function (g, fx, m, ctx) { return ctx.won && ctx.streakN === 10; } },
  { id: 'L2_STREAK_15', test: function (g, fx, m, ctx) { return ctx.won && ctx.streakN === 15; } },
  { id: 'L2_STREAK_20', test: function (g, fx, m, ctx) { return ctx.won && ctx.streakN === 20; } },
  { id: 'L3_COMEBACK_20', test: function (g, fx, m, ctx) {
      return ctx.won && m.halftimeDeficit && m.halftimeDeficit <= -20; // négatif = l'user menait de 20+
      // NB : exiger que engine.js peuple m.halftimeDeficit = userScore - oppScore à la mi-temps
  }},
  { id: 'L4_PTS_50', test: function (g, fx, m, ctx) { return ctx.starBox && ctx.starBox.pts >= 50; } },
  { id: 'L4_TRIPLE_DOUBLE', test: function (g, fx, m, ctx) {
      var b = ctx.starBox; if (!b) return false;
      return [b.pts, b.reb, b.ast, b.stl, b.blk].filter(function (v) { return v >= 10; }).length >= 3;
  }},
  { id: 'L4_BUZZER_BEATER', test: function (g, fx, m, ctx) { return ctx.won && m.buzzerBeater; } },
  { id: 'L5_CLINCH_PLAYOFFS', test: function (g, fx, m, ctx) { return ctx.clinch === 'playoffs'; } },
  { id: 'L5_CLINCH_DIVISION', test: function (g, fx, m, ctx) { return ctx.clinch === 'division'; } },
  { id: 'L5_CLINCH_SEED1',   test: function (g, fx, m, ctx) { return ctx.clinch === 'seed1'; } }
];

BM.PRAISE_EFFECTS = {
  L1_UPSET_TOP5:      { toast: 'EXPLOIT DU SOIR', confetti: 'dense',  sound: 'cheer',   fansPct: 0.03, posts: 4, board: 'La direction vous tire chapeau. Ce soir on a fait parler la ville.' },
  L2_STREAK_5:        { toast: 'SÉRIE DE 5 !',    confetti: 'mini',   sound: null,     fansPct: 0.015, posts: 2, board: null },
  L2_STREAK_10:       { toast: '10 D\'AFFILÉE !', confetti: 'normal', sound: 'cheer',   fansPct: 0.03,  posts: 3, board: 'On parle de vous dans toute la ligue. Continuez.' },
  L2_STREAK_15:       { toast: '15 D\'AFFILÉE !', confetti: 'normal', sound: 'cheer',   fansPct: 0.05,  posts: 4, board: 'Vous écrivez l\'histoire du club. Bravo.' },
  L2_STREAK_20:       { toast: '20 D\'AFFILÉE !', confetti: 'dense',  sound: 'cheer',   fansPct: 0.08,  posts: 6, board: 'Le board vous propose une prolongation de contrat.' },
  L3_COMEBACK_20:     { toast: 'COMEBACK !',      confetti: 'normal', sound: null,     fansPct: 0.02,  posts: 3, board: null },
  L4_PTS_50:          { toast: '50 POINTS !',     confetti: 'normal', sound: 'cheer',   fansPct: 0.015, posts: 4, board: null },
  L4_TRIPLE_DOUBLE:   { toast: 'TRIPLE-DOUBLE',  confetti: 'mini',   sound: null,     fansPct: 0.01,  posts: 2, board: null },
  L4_BUZZER_BEATER:   { toast: 'BUZZER BEATER !', confetti: 'dense', sound: 'cheer',   fansPct: 0.025, posts: 5, board: null },
  L5_CLINCH_PLAYOFFS: { toast: 'PLAYOFFS !',     confetti: 'dense',  sound: 'cheer',   fansPct: 0.04,  posts: 5, board: 'Mission accomplie. La direction est fière. La suite ? Allez chercher le titre.' },
  L5_CLINCH_DIVISION: { toast: 'CHAMPIONS DE DIVISION !', confetti: 'dense', sound: 'cheer', fansPct: 0.05, posts: 6, board: 'Champions de division ! Un immense bravo du board.' },
  L5_CLINCH_SEED1:    { toast: '1er DE LA CONF !', confetti: 'dense', sound: 'cheer', fansPct: 0.06, posts: 7, board: 'Vous finissez 1er de conférence. Le board rêve déjà du titre.' }
};

BM.checkPraises = function (g, fx, m) {
  var userSide = fx.home === g.userTeam ? 0 : 1;
  var me = g.teams[g.userTeam], opp = g.teams[userSide === 0 ? fx.away : fx.home];
  var won = m.score[userSide] > m.score[1 - userSide];
  var streakS = me.record.streak || '';
  var streakN = streakS.charAt(0) === 'V' ? parseInt(streakS.slice(1), 10) : 0;
  var star = m.roster[userSide].slice().sort(function (a, b) { return m.box[b.id].pts - m.box[a.id].pts; })[0];
  var starBox = star ? m.box[star.id] : null;

  // Détection des clinchers
  var clinch = BM.detectClinch(g, me, fx, won);

  var ctx = { me: me, opp: opp, won: won, streakN: streakN, starBox: starBox, clinch: clinch };
  var fired = [];
  BM.PRAISES.forEach(function (p) {
    // Éviter le re-déclenchement : on garde un set par saison des IDs déjà déclenchés
    g.praisesFired = g.praisesFired || {};
    var key = g.season + ':' + p.id;
    if (g.praisesFired[key]) return;
    if (p.test(g, fx, m, ctx)) {
      g.praisesFired[key] = { day: g.day };
      fired.push(p.id);
      BM.applyPraise(g, p.id, ctx);
    }
  });
  return fired;
};

BM.applyPraise = function (g, id, ctx) {
  var e = BM.PRAISE_EFFECTS[id], me = ctx.me;
  // (a) visuel — UI.toasts est déjà câblé dans main.js
  if (window && window.UI && UI.toast) UI.toast(e.toast, { big: true, confetti: e.confetti });
  if (e.sound && BM.Juice) BM.Juice.sound(e.sound);
  // (b) fans
  var bonus = e.fansPct;
  if (g.phase === 'playoffs') bonus *= 1.5;
  me.fans = Math.round(BM.fansOf(me) * (1 + bonus));
  me.rep = Math.min(99, (me.rep || 50) + (bonus * 10));
  // (c) posts
  BM.praisePosts(g, id, ctx, e.posts);
  // (d) inbox board
  if (e.board) BM.addMessage(g, 'La direction', e.board, 'board');
};

BM.praisePosts = function (g, id, ctx, n) {
  var me = ctx.me, opp = ctx.opp;
  var POOLS = {
    fan: [
      'INCROYABLE les {T} ! Ce soir on a assisté à un match qu\'on racontera aux petits-enfants.',
      'Je pleurais à la fin. Les {T} au sommet, le parquet tremblait.',
      'Celle-là, elle restera. Les {T} écrivent l\'histoire.',
      'On n\'était pas 18 000 ce soir, on était une seule voix. MAGISTRAL.',
      'Je suis ressorti de la salle en courant. Les {T}, c\'est plus du basket, c\'est une religion.'
    ],
    mateExploit: [
      'Le goat {S} ! On a un leader, on l\'a vu ce soir. 🐐',
      'Quand {S} est dans cette zone, on a juste à courir et marquer.',
      'On a assisté à un match historique. {S} dans la légende des {T}.'
    ],
    bleacher: [
      'Les {T} viennent de PUNKT les {O}. Repostez si vous l\'avez vu. 🔥🔥',
      'Ce match-là, vous allez le revoir 15 fois. Les {T} en mode gods.',
      'POV : tu支持的 {O} en sortant de la salle. 🪦'
    ],
    courtside: [
      'Analyse : les {T} ont tout fait bien ce soir. Le plan de jeu, l\'exécution, le mentaL. Carton plein.',
      'X éléments qui expliquent la masterclass des {T}. Thread. 🧵',
      'Les {T} rentrent dans une autre dimension. La suite va être compliquée pour les adversaires.'
    ],
    repleague: [
      'Les {O} humiliés. Le parquet, la salle, le coach, tout tremblait. Les {T} au sommet.',
      'Le pire souvenir de la saison pour les {O}. Les {T} en mode écrabouilleur.'
    ]
  };
  var fill2 = function (s) { return s.replace(/\{T\}/g, me.nick).replace(/\{O\}/g, opp.nick).replace(/\{S\}/g, ctx.starBox ? BM.fullName(g.players[Object.keys(m).find...]) : me.nick); };
  // (placeholder simplifié pour le doc ; le programmeur utilisera le helper `fill` existant)
  // ... boucler n fois pour pousser n posts dans des pools variés
};
```

### 5.3 Détection du clincher

`BM.detectClinch(g, me, fx, won)` calcule mathématiquement si la victoire de `me` sécurise une place en playoffs / titre de division / seed 1. Algorithme simplifié :

```js
BM.detectClinch = function (g, me, fx, won) {
  if (!won) return null;
  var totalGames = g.fixtures.filter(function (f) { return f.type === 'league' && (f.home === me.id || f.away === me.id); }).length;
  var remaining = g.fixtures.filter(function (f) { return !f.played && f.type === 'league' && (f.home === me.id || f.away === me.id); }).length;
  var myW = me.record.w, myL = me.record.l;

  // Clinch playoffs : 9e de la conférence ne peut plus nous rattraper
  var conf = BM.standings(g, me.conf);
  var ninth = conf[8];
  var ninthRemaining = g.fixtures.filter(function (f) { return !f.played && f.type === 'league' && (f.home === ninth.id || f.away === ninth.id); }).length;
  var ninthMaxW = ninth.record.w + ninthRemaining;
  if (myW > ninthMaxW && !me._clinchedPlayoffs) { me._clinchedPlayoffs = g.season; return 'playoffs'; }

  // Clinch division : supposer 1 division par conf (simplification) ; ici par conférence.
  // Clinch seed 1 : aucun autre club de conf ne peut mathématiquement nous dépasser
  var confTop = conf.filter(function (t) { return t !== me; }).map(function (t) {
    var rem = g.fixtures.filter(function (f) { return !f.played && f.type === 'league' && (f.home === t.id || f.away === t.id); }).length;
    return t.record.w + rem;
  });
  if (confTop.length && myW > Math.max.apply(null, confTop) && !me._clinchedSeed1) { me._clinchedSeed1 = g.season; return 'seed1'; }

  return null;
};
```

> Programmeur : `me._clinchedPlayoffs` et `me._clinchedSeed1` sont des flags saisonniers à reset dans `BM.seasonEnd` (ou à l'init du calendrier).

### 5.4 Dépendances `engine.js` à signaler

Pour activer **L3_COMEBACK_20** et **L4_BUZZER_BEATER**, le moteur de match (`js/engine.js`) doit peupler deux champs sur l'objet match `m` :

- `m.halftimeDeficit` = (score de l'équipe user) − (score adverse) à la mi-temps. Négatif si l'user menait de ≥ 20.
- `m.buzzerBeater` = booléen vrai si le tir de la dernière possession du Q4 (ou OT) a eu lieu dans les 2 dernières secondes et a fait passer l'user de perdant à gagnant.

> Ce sont les **seules** modifs à faire dans `engine.js`. Tout le reste se branche sur `league.js` / `legacy.js` / `ui.js`.

### 5.5 Hook de câblage final

```js
// Dans BM.afterUserMatch (league.js:250), APRES BM.socialAfterMatch :
if (BM.checkPraises) BM.checkPraises(g, fx, m);
```

---

## 6. Synthèse — Checklist d'implémentation pour le programmeur

### 6.1 Fichiers à modifier

| Fichier | Modifs |
|---|---|
| `js/legacy.js` | Ajouter `BM.RIVAL_TYPES`, `BM.RIVALRIES_SEED`, helpers `rivalryKey`/`rivalryOf`/`rivalryHeat`/`rivalryAddHeat`/`rivalryDecay`/`initRivalries`. Étendre `POSTS.{troll, oppFan, mate, mateLoss}` + ajouter `rivalryFanTaunt`, `mateExploit`, `OPP_PLAYER_POSTS`, `RIVALRY_TAUNTS`, `HEADLINE_TEMPLATES`, `PRAISES`, `PRAISE_EFFECTS`. Brancher `BM.rivalryTaunt`/`BM.rivalryReply`. Ajouter `BM.dailyHeadlines`, `BM.buildNightScores`, `BM.simOtherMatches`, `BM.checkPraises`, `BM.applyPraise`, `BM.detectClinch`. |
| `js/league.js` | Appeler `BM.initRivalries(g)` dans `BM.newGame`. Brancher `BM.rivalryAddHeat` dans `BM.applyResult` (gagné/perdu). Brancher `BM.simOtherMatches` + `g.nightScores` dans `BM.afterUserMatch` avant `BM.socialAfterMatch`. Brancher `BM.checkPraises` après `BM.socialAfterMatch`. Brancher `BM.dailyHeadlines` dans `BM.endDay`. Brancher `BM.rivalryDecay` dans `BM.ecoDaily` (en fait `BM.ecoDaily` est dans ecosystem.js — cf. ci-dessous). |
| `js/ecosystem.js` | Dans `BM.ecoDaily` (ligne 96) : appeler `BM.rivalryDecay(g)`. Avant un match user rival heat ≥ 80 : appeler `BM.rivalryTaunt` (via `BM.advance` quand on détecte le match à venir — OU dans `BM.pressConference(g, fx, 'pre')` si plus simple). |
| `js/engine.js` | Peupler `m.halftimeDeficit` et `m.buzzerBeater` (voir §5.4). |
| `js/ui.js` | Ajouter `UI.nightScoresModal(g)` + sous-onglets "À la une" / "Presse" dans `UI.tab_media`. Câbler `UI.actions.rivalryReply` et `UI.actions.replyTarget`/`replyPost` (existants). Ajouter chip "RIVALRY GAME" au scorebug (cf. `js/match-ui.js`). Ajouter badge "Rivalités" sur `UI.teamCard`. |
| `js/match-ui.js` | Badge "RIVALRY GAME" pulsant quand heat ≥ 90. |

### 6.2 Points d'attention

1. **Save localStorage** : `g.rivalries`, `g.headlines`, `g.praisesFired` sont nouveaux. Vérifier qu'ils survivent au cycle export/import JSON (déjà fait pour `g.feed`, `g.news` — même mécanisme, aucune action).
2. **Taille de save** : `g.headlines` plafonné à 30, `g.rivalries` à ~15 paires × 8 events max = ~120 entrées, `g.praisesFired` ~12 entrées/saison. Négligeable.
3. **Déterminisme RNG** : tous les tirs aléatoires passent par `g.rng` (cf. `BM.socialAfterMatch` qui utilise déjà `g.rng.pick` / `g.rng.chance`).
4. **Tests** : ajouter dans `test/sim.test.js` une vérification qu'après 1 saison complète, ≥ 80 % des paires `BM.RIVALRIES_SEED` ont un `heat` > 30 et que `g.headlines.length > 0`.
5. **Mode Carrière** : ce doc cible le **Mode Manager**. Les helpers `BM.post`, `BM.feedOf`, `BM.socialAfterMatch` routent déjà vers le bon fil. Les rivalités sont **partagées** entre les deux modes (stockées sur `g`, pas sur `g.career`), ce qui est cohérent : un joueur en carrière connaît aussi les rivalités de sa ligue.

### 6.3 Priorité d'implémentation (sprint)

| Sprint | Périmètre | Effort |
|---|---|---|
| **S1** | §1 Rivalités (modèle + seed + decay + détection émergente) | 2 j |
| **S1** | §2 Scores de la nuit (simOtherMatches + panneau + chips) | 2 j |
| **S2** | §3 Trash-talk (extension pools + taunt coach + opp player) | 1,5 j |
| **S2** | §4 Médias (dailyHeadlines + page Presse rénovée) | 2 j |
| **S3** | §5 Louanges (déclencheurs + applyPraise + clinchers) | 2,5 j |
| **S3** | Dépendances engine.js (halftimeDeficit, buzzerBeater) | 1 j |
| **S3** | Polish UI (scorebug badge, bannières, confettis) | 1 j |

**Total estimé** : 12 jours-homme.

---

## 7. Exemple de session utilisateur (restitution narrative)

> Pour valider que l'expérience est cohérente.

**Journée 24, Lagos Lakers (user, 18-16) reçoit Yamoussoukro Warriors (22-12), rivalité historique heat 70.**

1. L'user clique "Avancer". `BM.advance` détecte le match du jour et `heat ≥ 60` → pousse 2 taunts adverses dans le fil via `BM.preMatchRivalryPosts`. Ensuite, `heat ≥ 80` → `BM.rivalryTaunt` envoie un message inbox du coach de Yamoussoukro : *"On va vous faire la même chose qu'au match aller."* (ton provoc).
2. L'user répond "Renvoyer la balle" → +5 heat (75→80). Post user publié dans le fil.
3. L'user joue le match. Scorebug affiche **"RIVALRY GAME"** (heat ≥ 90 si jamais le taunt l'a fait monter). Lagos gagne 112-108 avec une stars à 33 pts, OT.
4. Fin du match → `BM.afterUserMatch` :
   - `BM.simOtherMatches` joue les 6 autres matchs du jour.
   - `g.nightScores = BM.buildNightScores(...)` construit le panneau.
   - `BM.socialAfterMatch` pousse 5 posts (Hoops Daily, fan, opp fan taunt rivalry, opp player "On vous attend au retour", mate).
   - `BM.checkPraises` détecte `L1_UPSET_TOP5` (Yamoussoukro top-5, Lagos hors top-15) → toast "EXPLOIT DU SOIR", confettis denses, +3 % fans, 4 posts `mateExploit`/fan/Bleacher, inbox board "La direction vous tire chapeau".
   - `rivalryAddHeat(+5)` pour la victoire → heat 75→80.
5. L'user ferme le panneau match. **Le panneau "Scores de la nuit" s'affiche**, mettant en avant :
   - RIVALRY : Lagos Lakers 112-108 Yamoussoukro Warriors (★ GAGNÉ, chip `RIVALRY`, `OT`, `PERF`)
   - Autres matchs du jour, dont Casablanca Hornets a perdu (rival de Lagos ? non, juste division Est) → pas de BN.
   - Classement : Lagos ▲1, Yamoussoukro ▼1.
6. L'user clique "Continuer vers la journée suivante" → `BM.advance` → `BM.endDay` :
   - `BM.dailyHeadlines` génère 3 headlines : "EXPLOIT DU SOIR : Lagos renverse Yamoussoukro", "Le heat monte à 80/100 entre les deux clubs", "OT {N} : le match fou de la nuit".
   - Les headlines sont poussés dans le fil et `g.news` (1 en `big`).
7. L'user va sur l'onglet Médias → "À la une" voit les 3 headlines du jour + celles des 6 jours précédents.

**Boucle ressenti** : l'user a vécu un match qui compte (rivalité), il a été taunté (engagement), il a gagné (joie), le panneau scores valide la performance (récompense), le fil inonde de louanges (validation sociale), la presse en parle (récit), et la rivalité est inscrite dans la mémoire de la ligue (durée).

---

*Fin du document.*
