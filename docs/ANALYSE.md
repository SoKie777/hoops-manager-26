# Analyse de `26-moile.apk` (REA)

Cible : `D:\Claude\fm\26-moile.apk` · SHA-256 `585f001634fdf9bfbe242af5e72b1c1143dcc416c46a8d7530b75465305eae59` · 2,15 Go · 1 866 entrées ZIP.
Analyse statique uniquement : l'APK n'a jamais été exécuté.

## Identité

- **Football Manager 26 Mobile, édition Netflix** : `splashnetflix.png`, polices Netflix Sans, `assets/com/netflix/mediaclient/*`, `GameCredentials_Android.jwe`.
- Moteur natif C++ propriétaire de Sports Interactive (`lib/arm64-v8a/libgame.so`, 41 Mo, arm64 uniquement). Ce n'est **pas** Unity.
- Données : `assets/data/game/*.fmf`, soit 1,9 Go au format conteneur `fmf.` (en-tête `02 01 66 6d 66 2e`).
  - `db_archive_24xx/26xx.fmf` : bases joueurs et clubs.
  - `graphics.fmf`, `kits.fmf`, `facegen_portraits.fmf` : graphismes, maillots, visages.
  - `languages.fmf` : langues.
  - `assets/shared/data/sicomps.fmf` : 58 Mo de compétitions.
  - Les petits fichiers (`formations`, `scenarios`, `match_preparation`, `settings`) sont stockés non compressés.

## ⚠️ APK modifié par un tiers

- `lib/arm64-v8a/libandroidoyunclub.so` : il exporte `Java_androidoyunclub_androidoyunclub_register` et contient la chaîne `androidoyun.club`. Il affiche des boîtes de dialogue et des toasts. C'est une version repackagée par un site de mods.
- `lib/arm64-v8a/libcheckupdate.so` : chaînes obfusquées, client HTTP GET/POST et une URL interne `http://10.18.32.87:8080/...`.
- `liba7ade6.so` est un petit binaire, et la signature `META-INF/ANDROIDD.SF` n'est pas celle d'origine.
- **Ne pas installer cet APK sur un appareil personnel.** Le comportement réseau de ces bibliothèques n'a pas été vérifié.

## Mécaniques observées (reprises dans Hoops Manager)

| Observation dans l'APK | Source | Adaptation basket |
|---|---|---|
| 266 écrans `FMHI_*_PAGE` (effectif, tactique, entraînement, match, mercato, direction, actualités, staff, scouting, centre de formation…) | chaînes de `libgame.so` | 6 onglets : Accueil, Effectif, Tactique, Ligue, Mercato, Club |
| `match_preparation.fmf` : thèmes d'entraînement (Ball Retention, Pressing, Counter Attack…), intensité, attributs primaires et secondaires par thème, **bandes de progression** `Band_01..12` selon l'écart | JSON en clair | Thème + intensité quotidiens ; chance de progresser proportionnelle à l'écart au potentiel |
| `formations.fmf` : 22 formations (4-4-2, 4-2-3-1…) | chaînes | Rythme / orientation offensive / défense (individuelle, zone 2-3, press) |
| Écrans `FM_MATCH_TEAM_TALK`, `TACTICS_SUB`, `FM_MATCH_RATINGS`, `MATCH_REVIEW_*` | chaînes | Match en direct : causerie de mi-temps, changements, temps morts, notes des joueurs, feuille de match |
| `BOARD_CONFIDENCE_*`, `CLUB_EXPECTATIONS`, `JOB_OFFER`, licenciement | chaînes | Objectif de saison, jauge de confiance, licenciement |
| `TRANSFER_OFFER`, `CONTRACT_OFFER`, `CLUB_BUDGET_TRANSFER` | chaînes | Agents libres, rachats, prolongations, liste des transferts, offres de l'IA dans la messagerie |
| `CLUB_DEVELOPMENT_HUB_YOUTH_*` | chaînes | Deux espoirs du centre de formation par saison |
| `scenarios.fmf` : défis (crise de blessures, austérité…) | texte en clair | Non repris (piste d'évolution) |

## Ce qui n'a pas été fait

- Pas de décompilation de `libgame.so`. Le moteur de match de FM n'a pas été étudié en détail, et Hoops Manager utilise un moteur original, possession par possession.
- Classes Java non décompilées : JADX n'est pas configuré dans REA (`REA_JADX_MCP_JAR` absent).
- Les conteneurs `.fmf` compressés n'ont pas été décodés. Aucun asset, aucune donnée et aucun code de FM n'est réutilisé.
