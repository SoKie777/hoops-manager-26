# Hoop Land : ce qui fait son succès (analyse statique)

Source : `Hoop Lamd.apk` (SHA-256 `3bfa0b21…9840`), analysé avec REA le 2026-10-25.
Jeu Unity compilé en IL2CPP. Les observations viennent de `global-metadata.dat` : 19 811 chaînes du jeu et environ 100 000 identifiants (classes, méthodes, champs).

**Limite :** l'APK fourni est l'APK de base, sans dossier `lib/`. Le code natif (`libil2cpp.so`) est dans un APK séparé d'architecture (`split_config.arm64_v8a.apk`), donc aucune formule n'a pu être décompilée dans Ghidra. Ce qui suit décrit **les systèmes et leurs textes**. Les mécaniques chiffrées restent à confirmer.

## 1. Une carrière racontée de bout en bout

On observe un parcours complet, chaque étape ayant son propre écran ou événement :

1. **Sortie du lycée.** Le jeu s'ouvre sur « Welcome to the Hoop Land Career Mode! You are one of the top prospects in the world coming fresh out of high school ».
2. **Koality Showcase.** Un match vitrine devant les recruteurs, où le joueur est classé « #[RANK] ranked prospect ».
3. **Offres des universités.** Elles dépendent des envies du joueur : « Wants to play for a contender », « … closer to home », « … for a better program », « Wants a better developer ».
4. **Saison universitaire.** Elle se termine sur « What are your plans now that your college season has completed? ».
5. **Workouts de draft, draft, puis carrière pro.**
6. **Retraite.** Elle passe par un vrai discours (« I want to thank my coach, my teammates… ») puis « Your player will be retired but a new chapter awaits » : le joueur devient coach.
7. **Hall of Fame.** On y trouve « First-Ballot Hall of Famer », les maillots retirés, la question « What will people say about your legacy…? », et des années plus tard « BREAKING: Hall of Famer [PLAYER] has passed away at the age of [AGE] ».

**À retenir pour nous :** la ligue a une mémoire. Les légendes vieillissent, sont intronisées, et finissent par disparaître.

## 2. Le rang Legacy débloque des pouvoirs

- Les objectifs de carrière font monter le rang Legacy : « Complete various career objectives to continue increasing your Legacy Rank! ». Il existe aussi un rang de célébrité (`GetFameLevel`) et un nombre de fans (« +{0} New Fans »).
- **Le rang donne de l'influence**, et il peut **redescendre** (« Your rank has decreased to »). Il faut être All-Star ou mieux pour :
  - créer un archétype personnalisé ;
  - modifier et lancer les systèmes de jeu (play calls) ;
  - demander un transfert, puis attendre la saison suivante pour en redemander un ;
  - suggérer des cibles de transfert.
- **La relation avec le coach** sert aussi de verrou : « Your coach relationship must be at least 10 points … to edit and make play calls ». Il existe des relations joueur par joueur (`PlayerRelationships`, `UpdateRelationship`).

## 3. Un fil social qui réagit à chaque match

- Les publications sont générées à partir de la feuille de match et de modèles : « Another loss for the [TEAM] in which [PLAYER] scored [POINTS] points. COLOR ME SURPRISED! », « Excited to watch [PLAYER] representing my home town of [HOMETOWN]! ». On en compte une centaine.
- **Plusieurs voix** s'y expriment : fans, coéquipiers, adversaires, médias (« BREAKING », « OFFICIAL », « FINAL… Player of the Game »), et même des trolls (« Did you forget to switch over to your burner account? »).
- **Après le match, tu publies toi-même**, en choisissant un ton et une cible :
  - « Praise », « Shout Out », « Call Out » ou « Blame » ;
  - × Self, Coach, un coéquipier, Fans, Team ou Referees.
  - On peut aussi répondre positivement ou négativement aux publications.
  - D'après les noms de méthodes (`UpdateRelationship`, `UpdateMorale`, `UpdateFanSupport`), ces choix agiraient sur les relations, le moral et les fans. C'est une inférence, sans code pour la confirmer.
- **Les déclarations d'après-match dépendent du contexte** : crédit au coach, aux fans, à un coéquipier… Il y a aussi un « top story », des mentions et des publications non lues.

## 4. Une progression qu'on sent méritée

- **L'expérience est découpée par catégorie** : `Shooting_XP`, `Finishing_XP`, `Creating_XP`, `Defensive_XP`. On monte de niveau en jouant.
- **Compétences :** un point tous les 5 niveaux (5 au maximum à l'université) et 4 emplacements à équiper.
- **Archétypes :** un principal, un secondaire, et un archétype personnalisé débloqué par le rang. Il peut être perdu si le joueur décline (« no longer available due to your player's regression »).
- **Entraînement :** des programmes les jours sans match, ou en sautant un match. Ils servent aussi à se remettre d'une blessure.
- **Accomplissements par paliers** sur un match, une saison et une carrière : par exemple « Make 1 / 3 / 5 / 10 / 15 Three-Pointers in a game », puis « 25 … 500 in a season », puis « 100 … 5000 Career Three-Pointers ». On en compte environ 160, et ils alimentent la Legacy.

## 5. Les autres modes, construits sur la même mécanique

- **Coach à l'université :**
  - les objectifs du campus font monter le prestige, qui fait monter le budget de l'effectif (« Complete campus goals to increase your school's prestige and earn a bigger budget! ») ;
  - le recrutement passe par les recrues cinq étoiles, les bourses demandées et la maturité de la recrue.
- **Coach pro :** des points d'attribut gagnés avec l'expérience de coaching, et des tendances de coaching réglables.
- **Envies des agents libres et des coachs** (`Wants…`) : un contender, se rapprocher de chez soi, un coach offensif ou défensif, un meilleur formateur, devenir All-Star, être mentor.
- **Économie de pièces** (version Premium). C'est sans intérêt pour nous.

## Pistes pour Hoops Manager 26

Classées par impact estimé :

1. **Fil social et réponse d'après-match** (Ma Carrière et Manager). Les publications seraient générées à partir de la feuille de match. Tu répondrais avec un ton et une cible, ce qui ferait bouger la relation avec le coach ou un coéquipier, le moral et les fans.
2. **Rang Legacy qui donne de l'influence** (Ma Carrière) :
   - choisir sa propre 1re option ;
   - influencer le système du coach ;
   - demander un transfert ;
   - suggérer des recrues.
   Le rang peut aussi redescendre.
3. **Relations chiffrées** avec le coach et chaque coéquipier, qui ouvrent ou ferment des actions.
4. **Accomplissements par paliers** (match, saison, carrière) qui nourrissent la Legacy, avec une progression par catégorie gagnée sur le terrain (un tir réussi rapporte de l'expérience au tir).
5. **Une ligue qui se souvient** : intronisations au Hall of Fame, maillots retirés, fil « BREAKING », décès des légendes des décennies plus tard, discours de retraite.
6. **Envies des joueurs** pour le mercato et les agents libres, à brancher sur la v1.8 (contrats, plafond, agents libres).
7. **Showcase lycéen** classé, puis offres des universités selon tes envies : le prologue de Ma Carrière.

## Pour aller plus loin

Pour lire les formules (calcul de la Legacy, effets des réponses sociales, chances de retraite via `CalculateRetirementChance`), il faut le code natif. Il y a deux moyens de récupérer l'APK d'architecture depuis le téléphone :
- l'extraire avec une application comme SAI ou APKMirror Installer, qui exporte le bundle `.apks` ou `.xapk` complet ;
- ou faire `adb shell pm path <paquet>` puis `adb pull` du fichier `split_config.arm64_v8a.apk`.

Ensuite : Il2CppDumper pour obtenir les adresses des méthodes, puis REA avec Ghidra sur `libil2cpp.so`.

Le jeu embarque aussi l'anti-triche ACTk et des fichiers d'assets aux noms aléatoires (probablement chiffrés). L'analyse dynamique sur le téléphone donnerait des captures d'écran, mais l'essentiel de la boucle se lit déjà dans les textes.
