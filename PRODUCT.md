# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(HTML/CSS/JS wrapped in a Capacitor Android APK; the design language is web, not native Android.)

## Users
The author, plus friends and family who get the signed APK privately. They play solo, mostly on an Android phone held in landscape, and sometimes in a desktop browser. Each player manages one franchise over many seasons, so sessions return to the same screens again and again: roster, tactics, match day, results. There is no public release planned for now.

## Product Purpose
A basketball management game that brings the depth of *Football Manager Mobile* to an NBA-style league. Success means a season feels like FM: choices about tactics, development, scouting, the locker room and trades visibly shape results, and the player understands why.

## Positioning
Two things together, which neighbouring basketball managers don't offer:
- **FM-grade depth adapted to basketball**: real offensive and defensive systems, roles and familiarity, a development hub, scouting staff and the draft, locker-room promises, press conferences, board objectives, trades.
- **Explainable matches**: a match engine calibrated on NBA statistics (checked by a stat test bench in CI) that tells the player after each game why it was won or lost (rebounds, tactic fit, 4th-quarter fatigue…).

## Operating Context
- Played offline on Android in landscape (tested at 820×380), and in desktop browsers, where screens wider than 900px switch to a side-rail "studio" layout.
- Saves live in `localStorage` with `.json` export/import from the Club tab.
- Builds: each push to GitHub triggers GitHub Actions, which produces a signed release APK so updates install over the previous version.

## Capabilities and Constraints
- **Manager mode**: run one of 30 franchises (roster, half-court tactics board, transfers with AI trade offers, scouting, development, locker room, draft, press, board objectives, playoffs bracket).
- **Social layer**: post-match media coverage, fan reactions, player praise, rivalry heat, trash talk, and a league-wide results roundup after each matchday.
- **League data**: real 2026-27 NBA rosters and contracts (from Basketball-Reference) with NBA 2K27 ratings, moved to African cities with NBA nicknames (*Kinshasa Lakers*, *Dakar Spurs*…). Current practice is surnames with one doubled vowel and procedurally generated portraits; no real photos.
- **Live match**: a 2D court with system-specific movement, a TV scorebug, a momentum bar, a shot chart and a game-flow chart, and synthesized WebAudio sounds.
- **Hard constraints**:
  - Landscape is locked on mobile. Every screen must fit and stay usable at 820×380, and also work in a widescreen browser. Long menus that get cut off in landscape are a known past problem.
  - No dependencies, works offline: plain HTML/CSS/JS, no runtime libraries or network calls, everything stored locally. Capacitor is used for packaging only.
- **Language**: the UI is currently all in French (not stated as a binding rule).
- **Known engine gap**: overtime happens in about 3% of games (NBA: about 6%).

## Brand Commitments
- **Category standard, played straight** (user's choice, 2026-10-25, for the whole game): the interface follows the conventions of the genre and does not invent an unusual world. The quality bar is **Football Manager 26 Mobile**: its navigation, information density, match screen and quick in-match instructions.
- Name: Hoops Manager 26.

## Evidence on Hand
- Analysis of the FM Mobile game loop: `docs/ANALYSE.md`.
- Engine and season simulation tests: `test/engine.test.js`, `test/sim.test.js`.
- No testimonials, players or press exist. Never invent any.

## Product Principles
1. Depth over shortcuts: every system should feed into results the way it does in FM, not be decoration.
2. Explain what happens: the player should always be able to find out why something happened.
3. Landscape first: designed for a phone held sideways, and it must scale up to a desktop browser.
4. Self-contained: offline, no dependencies, saves under the player's control.
