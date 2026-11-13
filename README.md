# Hoops Manager 26 (Édition Studio v2.0)

Un jeu complet de management et de carrière de basket pour **PC (Widescreen Studio)** et **Mobile (Android APK)**, en HTML, CSS et JavaScript pur, sans dépendance externe. Il reprend et enrichit la boucle de jeu de *Football Manager Mobile* (analysée dans [docs/ANALYSE.md](docs/ANALYSE.md)) avec une présentation Broadcast NBA et une télémétrie avancée.

---

## 💻 Tester et jouer sur PC

Aucune installation complexe n'est requise : le jeu fonctionne directement dans n'importe quel navigateur moderne (Chrome, Edge, Firefox).

### Option 1 : Ouverture directe (le plus rapide)
Double-cliquez simplement sur **`index.html`** dans le dossier `D:\Claude\FM\basket-manager\index.html` (ou glissez-le dans votre navigateur).

### Option 2 : Serveur local HTTP (recommandé pour un confort optimal)
Depuis un terminal PowerShell ou Invite de commandes dans `D:\Claude\FM\basket-manager` :

```powershell
# Avec Python :
python -m http.server 8765 --directory .
# Puis ouvrez http://127.0.0.1:8765 dans votre navigateur

# Ou avec Node.js (npx) :
npx serve . -l 8765
```

- **Sauvegarde** : automatique à chaque journée dans le `localStorage` du navigateur, avec export/import `.json` depuis l'onglet **Club**.
- **Interface PC Widescreen** : au-delà de `900px` de largeur, le jeu bascule automatiquement en mode **Studio Bureau** (navigation en rail latéral gauche, grilles double colonne et vue Broadcast écran scindé pendant les matchs en direct).

---

## Contenu & Nouveautés v2.0 (Édition Studio AAA)

Un seul mode de jeu : **Manager**. Dirigez l'une des 30 franchises avec l'effectif, la tactique sur demi-terrain, le mercato, le scouting, le développement, le vestiaire, la draft, les conférences de presse et les objectifs de la direction.

Le cœur de l'expérience est la construction d'une dynastie : chaque journée nourrit le classement, les médias, les rivalités et les relations du vestiaire. Après les rencontres, le fil social réagit aux performances, les supporters chambrent ou félicitent, les médias publient les résultats de la ligue et les confrontations répétées font monter la tension.

### Points forts techniques & gameplay
- **Interface Broadcast & Télémétrie SVG (v2.0)** :
  - **Scorebug TV complet** : détail quart-temps par quart-temps (`Q1 Q2 Q3 Q4`), pastilles de temps morts (`●`), indicateur `BONUS` de fautes d'équipe et barre de *Momentum* dynamique.
  - **Carte des Tirs (`Shot Chart`) & Courbe d'écart (`Game Flow`)** : tracés SVG en direct pendant le match et dans le rapport d'après-match (zones *Raquette*, *Mi-distance*, *3 Points*, changements de leader, égalités et plus gros écart).
  - **Portraits éclairés & Radar hexagonal 6 axes** : chaque joueur dispose d'un portrait vectoriel généré selon son identité (teint, coupe, barbe, bandeau, éclairage studio) et d'un radar de profil à 6 axes (`TIR EXT.`, `FINITION`, `CRÉATION`, `DÉFENSE`, `PHYSIQUE`, `MENTAL`).
  - **Tableau Tactique Demi-Terrain & Arbre des Playoffs** : visualisation interactive du 5 majeur selon le système offensif et tableau complet des séries de Playoffs par conférence.
- **Terrain 2D Broadcast & Chorégraphie Tactique (v2.0)** :
  - Parquet en érable multi-teintes avec reflets des projecteurs d'arène, tablier aux couleurs de la salle, table de marque et filets animés à chaque tir.
  - Chorégraphies spécifiques par système : pose d'écran sur **Pick & Roll (`pnr`)**, espacement sur **Isolation (`iso`)**, prise de position au **Poste bas (`post`)**, coupes **Princeton (`cut`)**, passes lobées (**Alley-Oop**), **Step-back 3** et **And-One**.
  - Audio synthétisé WebAudio : `swish`, `three`, `dunk`, `rim`, `block`, `whistle`, `buzzer`, `cheer`, `draft`.
- **Moteur de match calibré NBA & Coaching IA réactif** :
  - 30 effectifs NBA réels 2026-27 transposés dans des métropoles africaines (*Yamoussoukro Warriors*, *Dakar Spurs*, *Kinshasa Lakers*…), plafond salarial de 166 M$.
  - **Gravité (GSB / GAB / GD)** : gravité sans ballon, avec ballon et défensive, modulée par la forme des 5 derniers matchs.
  - **Coaching IA en direct** : l'IA adverse prend des temps morts pour couper vos séries (`run >= 9`), cible son joueur en feu en 1re option sur les *mismatches* et adapte son rythme et son pressing en fin de 4e quart-temps.
  - **Générateur d'offres d'échange IA** : bouton *« 🔍 Chercher des offres IA »* permettant de trouver instantanément des packages d'échange réalistes auprès des 29 autres GM.

---

## Structure du projet

| Fichier | Rôle |
|---|---|
| `js/rng.js` | Générateur aléatoire déterministe (état sauvegardé) |
| `js/data.js`, `js/nba-data.js` | Postes, attributs, 30 clubs, effectifs NBA 2026-27, systèmes tactiques |
| `js/model.js` | Génération des joueurs, notes, gravité (GSB/GAB/GD), salaires, rotations |
| `js/engine.js` | Moteur de match possession par possession, IA de coaching en direct, coordonnées de tirs |
| `js/court.js` | Rendu 2D Broadcast du parquet, chorégraphies tactiques et physique du ballon |
| `js/analysis.js` | Analyse tactique d'après-match (les clés de la victoire / défaite chiffrées en points) |
| `js/league.js` | Calendrier, playoffs, entraînement, mercato, direction, intersaison, sauvegarde |
| `js/scouting.js`, `js/development.js`, `js/ecosystem.js` | Recrutement, brouillard de guerre, pôle développement, vestiaire, échanges & Trade Finder IA |
| `js/portrait.js`, `js/juice.js` | Portraits vectoriels éclairés, radar SVG 6 axes, audio WebAudio, haptique et confettis |
| `js/ui.js`, `js/match-ui.js`, `js/main.js` | Interface Studio Manager, Scorebug, Shot Chart & Game Flow SVG |
| `js/career-data.js`, `js/career.js`, `js/career-events.js`, `js/career-match.js`, `js/career-ui.js` | Mode « Ma Carrière » complet (Prospect → Draft → NBA → Retraite → Coach) |
| `test/sim.test.js`, `test/career.test.js`, `test/engine.test.js` | Suites de tests automatisés (saisons complètes, carrière complète, calibration NBA sur 1 500+ matchs) |

### Lancer les tests automatisés

```bash
npm test                             # Simule 3 saisons complètes + vérifie le déterminisme et la taille de sauvegarde
node test/career.test.js             # Simule une carrière complète jusqu'à la reconversion en coach
node test/engine.test.js 1500        # Banc d'essai statistique NBA + scan anti-exploits tactiques
```

---

## 📱 Génération automatique de l'APK Android (GitHub Actions)

Le dépôt intègre un workflow CI/CD complet dans [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml).
À chaque `git push` sur `main` (ou lancement manuel depuis l'onglet *Actions* de GitHub) :
1. Les 3 suites de tests (`sim.test.js`, `career.test.js`, `engine.test.js`) sont exécutées pour valider le moteur.
2. Les fichiers web sont compilés dans `dist/` (`npm run build`) et encapsulés via **Capacitor Android** en mode paysage (`sensorLandscape`).
3. Les icônes et écrans de démarrage sont générés, puis Gradle compile et signe `hoops-manager-26.apk`.
4. L'APK signé est publié automatiquement en **Artifact** et dans une nouvelle **GitHub Release** (`build-<num>`).
