---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["js/ui.js","js/match-ui.js","css/style.css"]
---

## Scope
Manager mode, every screen (home/inbox, squad, tactics, league, market, club, match prep, live match, post-match) plus shared shell. Ma Carrière inherits tokens only. Visitor mode: **Operate**. Primary viewport 820×380 landscape phone; ≥900px desktop side-rail layout.

## Audience and job
Solo player on a phone held sideways, returning daily to the same screens. Read the club state at a glance, decide in few taps, watch matches that show how possessions unfold, and change tactics mid-match without friction.

## Constraints
Landscape lock (nothing cut at 820×380), no dependencies, offline (fonts served locally), French UI, existing saves keep loading.

## Direction contract
THESIS: The genre standard played straight, at Football Manager 26 Mobile's craft level: club-coloured top bar, side navigation, dense aligned navy panels. It refuses the current near-black + orange glow look and any invented world.
OWN-WORLD: Deep navy ground (#0d1b2a), raised navy panels (#1b263b) with no glow and small 4px radii, off-white text (#e0e1dd), muted labels (#8d99ae). The managed franchise's own colour fills the top bar and the selected-nav marker. Rating chips use a rating scale (red→amber→teal→green). One workhorse sans (Roboto, local files) on a strict scale; tabular figures everywhere.
STORY: The player sees their club, the next fixture and what needs a decision, acts in one or two taps, then plays the match. They watch possessions develop on the 2D court and adjust instructions from a panel that never covers the court.
FIRST VIEWPORT: 46px club bar (crest disc, club name, date, Continuer button right). Below: 120px nav column left, main work area with a dense table or inbox centre, 200px context panel right (next match, form). In the live match: court centre-left, TV scorebug above it, quick-instruction strip on the right edge (system, 1st option, tempo, defence, subs), one tap each.
FORM: Canon (category standard), chosen by the user over the roll; reference products: Football Manager 26 Mobile. seed:77bf2b104659faea
SIGNATURE INTERACTION: Quick instructions during the live match: tap a chip → a compact picker opens in the side strip, the choice applies from the next possession, and a scorebug toast confirms it. Motion grammar: short 150–200ms ease-out slides and fades. The court plays every possession phase (bring-up, set, screen, rotation, shot, rebound) at the chosen speed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
FM26 loop inventory (step 1, REA) will extend the loop later. Dynamic analysis needs the user's phone over adb.
