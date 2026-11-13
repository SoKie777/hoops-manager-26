# Notes de coordination — v2.1 (système social)

Salut l'autre IA 👋 — voici ce que j'ai touché sur le repo `hoops-manager-26`. Si tu bosses en parallèle, on évite de se marcher sur les pieds en respectant ces zones.

## Fichiers créés (nouveaux)
- `js/rivalries.js` — système de rivalités (heat 0-100, 10 paires historiques seed, émergentes, déclin)
- `js/social.js` — enrichit le fil social (louanges sur exploits, headlines médiatiques quotidiennes, trash-talk adversaire, wrap de `BM.afterUserMatch`, `BM.endDay`, `BM.applyResult`, `BM.deserialize`, `BM.handleMessageAction`, `BM.newGame`, `BM.startNewSeason`)
- `js/night-scores.js` — panneau "Scores de la nuit" post-match (simule les autres fixtures, expose `BM.nightScores`)
- `css/social.css` — styles des nouveaux composants (feed social, scores de la nuit, headlines, badge rivalry, toasts exploit, msg inbox taunt/praise, page rivalités)
- `docs/DESIGN_SOCIAL.md` — doc de design rédigée par le Game Designer (957 lignes)
- `test/smoke-v21.test.js` — smoke test qui valide rivalités + headlines + panneau nuit + louanges + sérialisation

## Fichiers supprimés
- `js/career.js`, `js/career-data.js`, `js/career-events.js`, `js/career-match.js`, `js/career-ui.js`
- `test/career.test.js`

## Fichiers modifiés (additif / minimisé)
| Fichier | Nature de la modif | Risque conflit |
|---|---|---|
| `index.html` | 4 `<script>` career retirés, 3 nouveaux (`rivalries.js`, `social.js`, `night-scores.js`), 1 `<link>` social.css, 1 `<div id="exploit-toast-root">`. Ordre chargement réorganisé : league AVANT social/rivalries/night-scores. | Faible |
| `js/legacy.js` | Suppression des fonctions `BM.ACH_PLAYER`, `BM.careerTotals`, `BM.careerAchCtx`, `BM.LEGACY_RANKS`, `BM.legacyRank`, `BM.CAREER_POWERS`, `BM.careerPowerOk`, `BM.careerUsePower`, `BM.cMate`, `BM.cMateAdd`, `BM.CAREER_CATS`, `BM.catLevel`, `BM.catNext`, `BM.careerCatCheck`. Simplification de `BM.feedOf` / `BM.post` (branche carrière retirée). | Moyen — si tu touches au feed/legends |
| `js/league.js` | `BM.isCareer` devient `function (g) { return false; }` (stub pour ne pas casser les sauvegardes). 1 commentaire pour marquer le mode carrière supprimé. | Faible |
| `js/ui.js` | `UI.startScreen` nettoyé (bouton "Ma Carrière" retiré). `UI.render` sans branche career. `UI.feedHtml` étendu (variantes CSS par auteur). `UI.tab_media` étendu (sous-onglets Presse + Rivalités). `UI.actions.openMsg` (classe `taunt`/`praise` sur la card). Ajouts en fin de fichier : `UI.nightScoresCard`, `UI.headlinesHtml`, `UI.rivalriesHtml`, `UI.rivalryBadge`. | Moyen — si tu touches au tab_media ou feedHtml |
| `js/match-ui.js` | `UI.preMatch` : badge `RIVALRY GAME` ajouté après le `<h2>`. `UI.finishMatch` : `UI.nightScoresCard` inséré après `UI.replyCard`. Branche career retirée. | Faible |
| `js/main.js` | Wrap de `UI.preMatch` au tout début du fichier (appelle `BM.rivalryPreMatchTaunt` avant le match). | Faible |
| `test/sim.test.js` | Liste de fichiers chargés mise à jour (ordre : legacy → league → rivalries → social → night-scores). | Faible |

## Zones NON touchées (à toi sans souci)
- `js/engine.js` — moteur de match
- `js/court.js` — rendu 2D
- `js/analysis.js` — analyse tactique post-match
- `js/scouting.js`, `js/development.js`, `js/tactics.js` — recrutement, dev, tactiques
- `js/data.js`, `js/nba-data.js`, `js/model.js`, `js/portrait.js`, `js/juice.js`, `js/rng.js` — base
- `js/ecosystem.js` — vestiaire / conférence de presse / All-Star
- `css/style.css` — styles principaux

## Hooks runtime (peut affecter ton code)
- `BM.afterUserMatch` est wrappé : après l'original, ça appelle `BM.simulateOtherFixturesOfDay` (pré-simule les autres matchs de la journée) + `BM.nightScores`. Donc quand tu cliques "Continuer" après ton match, les autres fixtures du jour sont déjà `played`. La boucle suivante de `BM.advance` ne les re-simulera pas (le check `if (!fx.played)` les skip).
- `BM.applyResult` est wrappé : appelle `BM.rivalryAfterAnyMatch` (heat) pour les matchs IA.
- `BM.endDay` est wrappé : appelle `BM.dailyHeadlines` (génère max 3 headlines/jour) + `BM.rivalryDecay`.
- `BM.deserialize` est wrappé : migration des sauvegardes v2.0 (initialise `g.rivalries` si absent, convertit `g.mode==='career'` en mode manager).
- `BM.handleMessageAction` est wrappé : intercepte `act === 'rivalryReply'` (sinon délègue à l'original).
- `UI.preMatch` est wrappé : appelle `BM.rivalryPreMatchTaunt` qui peut ajouter un message inbox de taunt adverse si heat >= 80.

## État des tests
- `node test/sim.test.js` ✅ OK (3 saisons, 187 matchs utilisateur, 120.4 pts/équipe, FG% 48.3, save 1190 Ko)
- `node test/smoke-v21.test.js` ✅ OK (10 rivalités initiales, heat BOS-LAL 55→67, panneau nuit 7 items, headlines 12 articles, sérialisation round-trip)
- `node test/engine.test.js 500` ✅ OK (calibration NBA)

Bon dev !
