# Hoops Manager 26

Un jeu de management de basket pour mobile, en HTML et JavaScript, sans dépendance ni build. Il reprend la boucle de jeu de Football Manager Mobile, analysée dans [docs/ANALYSE.md](docs/ANALYSE.md), mais adaptée au basket.

## Lancer

```bash
python -m http.server 8765 --directory .
# puis ouvrir http://127.0.0.1:8765
```

Ouvrir directement `index.html` fonctionne aussi. La partie est sauvegardée automatiquement dans le navigateur (`localStorage`), et un export/import en `.json` est disponible depuis l'onglet Club.

## Contenu

- **Ligue** : les 30 effectifs NBA réels de 2026-27, transposés dans des villes africaines avec les surnoms NBA (Yamoussoukro Warriors, Dakar Spurs…). Saison de 58 matchs, puis des playoffs à 8 par conférence : séries au meilleur des 5 matchs, finales au meilleur des 7.
- **Données réelles** : les attributs sont dérivés des statistiques 2025-26 (2024-25 pour les joueurs blessés). Les contrats sont ceux de 2026-27, avec un plafond salarial de 166 M$. Les noms de famille sont modifiés (une voyelle doublée). Pour regénérer les données : `python -I tools/build_nba.py <dossier_html> js/nba-data.js`.
- **Gravité** (GSB / GAB / GD) : trois notes, sans ballon, avec ballon et défensive. Chacune vaut une base tirée du profil réel, ajustée par la forme des 5 derniers matchs (notes, adresse à 3 points, points, interceptions et contres). En match, la gravité sans ballon ouvre des espaces, la gravité avec ballon facilite les tirs des coéquipiers, et la gravité défensive dissuade les attaques au cercle et provoque des pertes.
- **Coaching en direct** : jauge de momentum par équipe (paniers, stops, interceptions ; un temps mort casse celui de l'adversaire), joueurs « en feu » après une série, et choix d'une 1re option offensive à tout moment. Le menu affiche le mismatch de chaque joueur contre son défenseur : un joueur en feu avec un mismatch favorable devient redoutable (environ +7 pts par match pour un coach attentif, aucun bonus en simulation instantanée).
- **Tactiques réelles** (inspirées des formations/rôles de FM26) : 6 systèmes offensifs (Pick & Roll, Motion 5-Out, Isolation, Poste bas, Run & Gun, Princeton), 5 schémas défensifs (Drop, Switch, Blitz, Zone 2-3, Press), 12 rôles NBA notés en étoiles, adéquation de l'effectif (normalisée sur la ligue) et familiarité qui se travaille.
- **Pôle développement** (Development Hub) : focus individuel, mentorat vétéran → jeune, repositionnement, G League, rapports du staff et recommandations applicables en un tap.
- **Recrutement** : staff noté (assistant, scouts, kiné), connaissance des joueurs (notes en fourchette tant qu'ils ne sont pas observés), missions et rapports de scouts, assistant qui analyse les besoins et propose des cibles réalistes, draft NBA (loterie, big board, salle de draft).
- **Écosystème** : personnalités, statuts (franchise → espoir), hiérarchie et ambiance du vestiaire, discussions et promesses de temps de jeu, conférences de presse, All-Star Game, trophées (MVP, DPOY, ROY, 6e homme, MIP, coach de l'année, All-NBA), échanges avec règle salariale et date limite.
- **Joueurs** : 19 attributs notés de 1 à 20 (technique, mental, physique), 5 postes, potentiel, moral, condition, blessures et contrats.
- **Match en direct** : moteur possession par possession au format NBA (4 × 12 min, exclusion à 6 fautes). Il gère la fatigue, les fautes (bonus, 5 fautes), les contres, les rebonds offensifs et la transition. Au bord du terrain, on dispose des temps morts, des changements manuels ou automatiques, des consignes et de la causerie de mi-temps. En fin de match, on obtient une feuille de match et des notes.
- **Tactique** : rythme, orientation offensive, défense (individuelle, zone 2-3, press), cinq de départ et plan de minutes.
- **Entraînement** : choix d'un thème et d'une intensité. La progression dépend de l'âge et de l'écart au potentiel. Le travail tactique augmente la cohésion de l'équipe.
- **Mercato** : agents libres, rachats de contrat, prolongations, liste des transferts avec offres de l'IA, masse salariale plafonnée.
- **Direction** : objectif de saison, confiance, licenciement possible.
- **Intersaison** : vieillissement, retraites, fins de contrat, centre de formation, évolution de la réputation.

## Structure

| Fichier | Rôle |
|---|---|
| `js/rng.js` | Générateur aléatoire déterministe (état sauvegardé) |
| `js/data.js` | Postes, attributs, clubs, noms, options tactiques et d'entraînement |
| `js/model.js` | Génération des joueurs, notes, salaires, plan de minutes |
| `js/engine.js` | Moteur de match |
| `js/league.js` | Calendrier, playoffs, entraînement, mercato, direction, intersaison, sauvegarde |
| `js/ui.js`, `js/match-ui.js`, `js/main.js` | Interface |
| `test/sim.test.js` | Simule plusieurs saisons et vérifie que les statistiques sont réalistes |

```bash
node test/sim.test.js
```

## Vers un APK

Le jeu est une page web statique. Pour le packager en application Android, on peut utiliser Capacitor : `npx cap init`, avec `webDir` pointant sur ce dossier, puis `npx cap add android`.
