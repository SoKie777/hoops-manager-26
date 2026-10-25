---
name: Hoops Manager 26
description: A basketball management game held sideways, built to the Football Manager 26 Mobile standard.
colors:
  club-colour: "#c8102e"
  club-ink: "#ffffff"
  interaction-blue: "#3d8bfd"
  interaction-ink: "#ffffff"
  interaction-blue-soft: "rgba(61, 139, 253, 0.16)"
  night-navy: "#0d1b2a"
  panel-navy: "#1b263b"
  panel-navy-raised: "#24324d"
  panel-navy-high: "#2c3c5c"
  chalk-text: "#e0e1dd"
  slate-label: "#8d99ae"
  hairline: "rgba(224, 225, 221, 0.1)"
  hairline-strong: "rgba(224, 225, 221, 0.2)"
  win-green: "#2fbf71"
  caution-amber: "#f2b33d"
  loss-red: "#f0565b"
  trophy-gold: "#f2c94c"
  clock-black: "#06101c"
  rating-elite: "#1f9d55"
  rating-starter: "#2f8f6f"
  rating-rotation: "#2f7d95"
  rating-bench: "#4a6488"
  rating-fringe: "#b45309"
  rating-weak: "#b63a3f"
  light-ground: "#e9edf2"
  light-panel: "#ffffff"
  light-panel-raised: "#f1f4f8"
  light-panel-high: "#e3e8ef"
  light-text: "#0d1b2a"
  light-label: "#56637a"
  light-interaction-blue: "#1f6fe5"
typography:
  display:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: 1.2
  scoreline:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  table:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  hair: "2px"
  chip: "3px"
  panel: "4px"
  modal: "6px"
  disc: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
components:
  button-primary:
    backgroundColor: "{colors.interaction-blue}"
    textColor: "{colors.interaction-ink}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
    typography: "{typography.body}"
  button-default:
    backgroundColor: "{colors.panel-navy-raised}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
  button-default-hover:
    backgroundColor: "{colors.panel-navy-high}"
  button-continue:
    backgroundColor: "{colors.club-ink}"
    textColor: "{colors.night-navy}"
    rounded: "{rounded.panel}"
    padding: "8px 14px"
  button-continue-matchday:
    backgroundColor: "{colors.trophy-gold}"
    textColor: "{colors.night-navy}"
  club-bar:
    backgroundColor: "{colors.club-colour}"
    textColor: "{colors.club-ink}"
    height: "46px"
    padding: "0 12px"
  nav-item:
    textColor: "{colors.slate-label}"
    typography: "{typography.label}"
    width: "84px"
  nav-item-selected:
    backgroundColor: "{colors.club-colour}"
    textColor: "{colors.club-ink}"
  card:
    backgroundColor: "{colors.panel-navy}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
  chip:
    backgroundColor: "{colors.panel-navy-raised}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.panel}"
    padding: "4px 8px"
  chip-selected:
    backgroundColor: "{colors.interaction-blue-soft}"
  rating-chip:
    backgroundColor: "{colors.rating-starter}"
    textColor: "{colors.club-ink}"
    rounded: "{rounded.chip}"
    padding: "2px 4px"
    width: "28px"
  input-field:
    backgroundColor: "{colors.panel-navy-raised}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.panel}"
    padding: "8px 10px"
  scorebug-clock:
    backgroundColor: "{colors.clock-black}"
    textColor: "{colors.club-ink}"
    height: "44px"
    width: "92px"
---

# Design System: Hoops Manager 26

## Overview

**Creative North Star: "The Club Office, Held Sideways"**

This is the management-game category standard played straight, at Football Manager 26 Mobile's level of craft. A deep night-navy ground carries flat navy panels with small corners and hairline borders. The only loud surface is the managed club's own colour, which fills the top bar and marks the selected navigation item. Everything else is information: dense aligned tables, tabular figures, rating chips and short uppercase panel labels. The system is built for a phone held sideways (820×380) and widens to a labelled-rail desktop layout from 900px.

Density is the point. Rows are 28 to 32px tall, panels pad at 8 to 12px, and the type ramp runs from 11px labels to 16px headings, with only the scorebug and result banners going larger. One workhorse sans (Roboto, self-hosted, variable 100 to 900) does every job. Depth comes from tonal steps between navy layers, not from glow; shadows exist only where something truly floats above the page (top bar, modal, toast). The 2D court is the one place the world gets warm: a maple floor, an orange ball and club-coloured players.

The user rejected the incumbent near-black + orange-glow look and any invented world. Selection reads the same for all 30 franchises because interaction uses a single blue that never changes with the club.

**Key Characteristics:**
- Night-navy ground, three tonal panel steps, hairline borders, no glow.
- The franchise colour on the top bar and selected nav item, lifted automatically when it is too dark to read on navy.
- A single interaction blue for primary buttons, selected tabs, chips, pickers and focus rings.
- Roboto everywhere, with tabular figures set on the body.
- 4px corners on panels and controls, 3px on chips, circles only for crests and avatars.
- Landscape 820×380 first, labelled side rail at 900px and up, bottom navigation in portrait.

## Colors

A cold, quiet navy system with two signal colours on top: the club's own colour for identity, a single blue for interaction.

### Primary
- **Club Colour** (per franchise; `#c8102e` is the stylesheet fallback): set as a custom property on the app shell for each franchise. It fills the club bar and the selected nav item, tints the hero card (14% over the panel) and the user's own row in league tables (34% over the panel, 16% in light theme). Before it is applied, the franchise colour is lightened in 5% steps until it reaches at least 1.9:1 contrast against the night-navy ground, and the text on it is chosen as white or navy by luminance.
- **Interaction Blue**: primary buttons, the underline on the selected tab, selected segment, selected chip/card/picker border, focus outline (2px), text selection, range and checkbox accents, the scorebug confirmation toast. A 16% wash of it (Interaction Blue Soft) fills selected chips, cards and quick-instruction tiles.

### Secondary
- **Trophy Gold**: matchday state of the Continuer button, timeouts left, the bonus pill, the shot clock, filled rating stars, legend tags, the event card in Ma Carrière. It marks occasions and scarce resources, never selection.

### Tertiary
- **Rating scale** (Elite → Starter → Rotation → Bench → Fringe → Weak): rating chips behind overall ratings, with white numerals. Thresholds are 85+, 78+, 70+, 62+, 55+ and below 55. The scale runs green → teal → steel blue → slate → amber → red, with Rating Bench a muted slate step between the cool and warm ends.
- **Win Green / Caution Amber / Loss Red**: meter fills, status tags (22% washes with the full colour as text), attribute values (15+ green, 7 and below red), form pips, win/loss result banners, the unread nav dot.

### Neutral
- **Night Navy**: the page ground, the sticky tab strip and the modal surface.
- **Panel Navy**: cards, the nav rail, the scoreboard and the live-match side strip.
- **Panel Navy Raised**: default buttons, inputs, segments, chips, picker options, even table rows (40% mix).
- **Panel Navy High**: hover on raised surfaces, position pills, empty meter tracks, scrollbar thumbs.
- **Chalk Text**: primary text on navy.
- **Slate Label**: column headers, panel labels, nav items at rest, secondary lines.
- **Hairline / Hairline Strong**: 10% and 20% chalk borders. Hairline separates rows and panels; the strong one outlines controls and sits under table headers.
- **Clock Black**: the scorebug clock block only.

### Light theme
A user-switchable light variant (toggled from the Club page, saved locally) swaps the ground to Light Ground, the panels to Light Panel / Raised / High, the text to Light Text and Light Label, and the interaction blue to the deeper Light Interaction Blue. Semantic colours darken (green `#1f8a53`, amber `#a86a00`, red `#c7353a`). The club colour and rating scale stay as they are.

### Named Rules
**The Two Voices Rule.** The club colour says whose club this is; the blue says what you selected. Never use the club colour to show selection inside content, and never tint the bar or rail with the blue.

**The Lift Rule.** A franchise colour is never applied raw. It goes through the lift (at least 1.9:1 against Night Navy) and the ink pick before it reaches any surface.

## Typography

**Display Font:** Roboto (self-hosted variable woff2, falling back to system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Roboto
**Label Font:** Roboto, uppercase, tracked

**Character:** One neutral workhorse sans pushed through weight rather than size: 400 for data, 600 to 700 for controls and headings, 800 to 900 for the club name, scores and result banners. Tabular figures are set on the body, so every column of numbers lines up.

### Hierarchy
- **Display** (900, 22px, 1.2): the start-screen title and the post-match result banner (uppercase, 0.04em). Nowhere else.
- **Scoreline** (900, 26px; 22px at 820×380, 30px at 900px and up): the two score blocks of the scorebug, on the teams' colours.
- **Headline** (800, 16px): the club name in the top bar (15px at 820×380) and modal titles (700).
- **Title** (700, 15px): card headings. Secondary headings are 13px.
- **Body** (400, 14px, 1.4; 13px at 820×380): running text, messages, buttons at 13px/600.
- **Table** (400, 12.5px; 12px at 820×380): tables, picker options, feed lines.
- **Label** (700, 11px, 0.06em, uppercase): panel headings inside cards, column headers (0.03em), field labels (0.05em), quick-instruction captions, playoff column headers. Slate Label colour.

### Named Rules
**The Tabular Rule.** Every number is set with tabular figures and right-aligned in columns. The body sets it globally; don't override it.

**The Weight-Not-Size Rule.** Hierarchy inside a screen comes from weight and colour (Chalk vs Slate), not from larger sizes. Nothing on a management screen goes above 16px except the scorebug, the match-up centre (18px), the start title and the result banner.

## Layout

The app shell is a two-row, two-column grid: the club bar across the top (46px; 40px at 820×380), the navigation rail on the left, the work area on the right. Safe-area insets are added to both.

- **Landscape phone (orientation landscape, height ≤ 620px; designed at 820×380):** a 72px rail with each icon above its label, pages laid out in two equal columns with 8px gaps and 8/10px padding, table rows at 28px. Wide blocks (tabs, tables, tactic grids, the hero card, KPI strips) span both columns. Lists of five or more recruitment items flow into two text columns. Modals become two-column and fill the viewport below 460px of height.
- **Desktop (≥ 900px):** a 176px rail with icons beside their labels (44px rows), two page columns with 12px gaps and 14/20px padding, capped at 1320px wide. The live-match side strip is fixed at 380px.
- **Portrait browser (< 900px):** the rail moves to a bottom bar of 54px buttons; the live-match strip stacks under the court.
- **Default (other sizes):** an 84px rail and a single page column.

There is no persistent right-hand context panel at any width; next match and form live on the Home page. Spacing runs on a 4 / 6 / 8 / 10 / 12px rhythm; table cells pad at 5px 4px (3px 4px at 820×380).

**Live match.** A full-screen layer: scorebug on top (44px; 38px at 820×380, 52px at 900px and up), then the court on the left and the quick-instruction strip on the right (at least 232px or 36% at 820×380). The court canvas scales to fit and is never covered by a panel; pickers open inside the strip.

### Named Rules
**The 820×380 Rule.** Every screen must fit and stay usable at 820×380 in landscape. A layout that only works at desktop width is unfinished.

## Elevation & Depth

Flat, layered by tone. Panels sit on the ground through a lighter navy and a hairline border, not a shadow. Raised controls are one step lighter again, hover is one more step. Shadows are reserved for the three things that really float: the sticky club bar, modals and toasts. There is no glow anywhere in the interface.

### Shadow Vocabulary
- **Bar lift** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25)`): the club bar, so scrolling content passes under it.
- **Toast** (`box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)`): the bottom toast.
- **Modal** (`box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5)`): modals, over a scrim of `rgba(5, 10, 18, 0.62)`.

### Named Rules
**The Tone-Step Rule.** To raise something, step it up the navy ladder (Panel → Raised → High). Reach for a shadow only if the element floats above scrolling content.

## Shapes

Small, near-square corners: 4px on panels, buttons, inputs, segments, chips, picker options and the court canvas; 3px on rating chips, position pills, tags and form pips; 2px on meter bars; 6px on modals (0 when full-screen). Circles are kept for team crests (32px, 22px small, 42px in match-ups), message icons, avatars and status dots. Selection draws with lines: a 2px inset underline on tabs and quick-instruction tiles, a 1px blue border or inset ring on chips, cards and players. Grouped controls (segments, the quick-instruction grid, KPI strips, flat tactic grids) share hairline dividers instead of gaps.

Icons are drawn inline as 24-unit SVG strokes (1.8 stroke, round caps) at 18px, 14px small, 20px in the rail.

## Components

### Buttons
Compact and quiet; only one per area is blue.
- **Shape:** 4px corners, 1px Hairline Strong border.
- **Default:** Panel Navy Raised fill, 13px/600 text, 8px 12px padding; hover steps to Panel Navy High; press shifts down 1px; disabled at 40% opacity.
- **Primary:** Interaction Blue fill and border with white text; hover mixes 14% white in.
- **Small / Block:** small at 5px 9px and 12px; block is full width, 11px padding, 14px/700.
- **Continuer (club bar):** white with navy text, 800 weight. On match days it turns Trophy Gold and reads "Jour de match".
- **Icon button:** 34×32px, raised navy, 16px icon; selected state is solid blue.

### Chips
- **Style:** Panel Navy Raised, 1px Hairline border, 4px corners, 12.5px text, 4px 8px padding.
- **State:** hover steps to Panel Navy High; selected gets a blue border and the 16% blue wash. Tactic cards, team picks, mode picks, picker options and Ma Carrière options all use this same selected treatment.

### Rating Chip (signature)
- A 28px-minimum pill, 3px corners, 12.5px/700 white numerals on the rating scale colour. Scouted estimates drop to 11.5px. Position pills next to it are Panel Navy High with Chalk Text, 32px minimum.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Panel Navy with a 1px Hairline border; the Home hero card mixes 14% club colour into the panel and 35% into the border.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 10px 12px (8px 10px at 820×380). Card headings are 11px uppercase Slate labels; a heading row carries a title left and actions or meta right.
- **KPI strip:** figures sit in one bordered band split by hairlines (16px/700 value over an 11.5px label), not in separate tiles.

### Tables
- Header 11px/700 uppercase Slate over a Hairline Strong rule; sortable headers turn Chalk on hover and when sorted. Rows are 32px (28px at 820×380), divided by hairlines, with every second row mixed 40% toward Panel Navy Raised. Clickable rows highlight to Raised on hover; the user's club row uses the club tint and bold; a blue rule marks a cut line (playoff places).

### Inputs / Fields
- **Style:** Panel Navy Raised, 1px Hairline Strong border, 4px corners, 8px 10px padding, 13px text; labels are 11px uppercase Slate.
- **Focus:** the border turns Interaction Blue (inputs); everything else shows a 2px blue focus-visible outline.
- **Segmented control:** one bordered strip, buttons split by hairlines; the selected one is solid blue with white text.

### Navigation
- **Rail:** Panel Navy with a hairline right edge. Items are icon plus 11px/600 Slate label; hover steps to Raised and Chalk; the selected item is filled with the club colour and its ink at 700. An 8px Loss Red dot flags unread messages. 150ms colour and background transitions.
- **Tabs:** a sticky strip on the ground with a hairline base; 13px/600 Slate tabs, the selected one in Chalk with a 2px blue underline.

### Scorebug and Quick Instructions (signature)
- **Scorebug:** a Panel Navy band. Team names in 800 sit outside two score blocks filled with each team's colour (white 900 numerals that bump 1.25× on a score), and a Clock Black block shows period and time, with the shot clock in gold. Timeout pips (gold when available), a bonus pill and a 3px momentum bar in the two team colours sit in the band.
- **Quick-instruction strip:** a 3-column grid of tiles split by hairlines on Panel Navy; each tile is an 11px uppercase Slate caption over the current value at 12.5px/700. Tapping a tile marks it selected (blue wash plus a 2px blue underline) and opens a picker of option rows in the pane below. A choice applies from the next possession and a blue toast confirms it over the scorebug.
- **Court:** a canvas with a maple floor (`#dda66b` → `#ba7c42` gradient with planks), an apron tinted 25% with the home colour, home players as solid club-colour discs with white rims, away players as white discs rimmed in their colour, an orange ball, and a broadcast caption bar naming the possession phase. Court text uses Roboto 700 to 800.

### Motion
Short ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`): pages fade in over 180ms, modals rise 8px over 200ms, toasts slide up over 200ms, meters grow over 500ms, hover transitions take 150ms. All animation and transition is switched off under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** put the managed club's colour on the club bar and the selected nav item only, always through the lift (at least 1.9:1 against Night Navy) and the ink pick.
- **Do** use Interaction Blue for every selected, primary or focused state, so selection looks the same for all 30 franchises.
- **Do** raise surfaces by stepping up the navy ladder (Panel Navy → Raised → High) with hairline borders.
- **Do** set numbers in tabular figures, right-aligned, and show overall ratings as rating chips on the six-step scale.
- **Do** keep panels dense: 28 to 32px rows, 8 to 12px padding, 11px uppercase Slate labels for panel headings.
- **Do** check every screen at 820×380 landscape before calling it done.
- **Do** draw icons as inline stroke SVGs (24-unit grid, 1.8 stroke).

### Don't:
- **Don't** bring back the near-black + orange-glow look: no coloured glows, no glowing borders, no orange chrome. On the court, orange belongs to the ball and the rim.
- **Don't** use the club colour to show selection inside content, or the blue on the club bar or rail.
- **Don't** add a persistent right-hand context panel; at 820×380 the tables need the room.
- **Don't** add shadows to cards or controls; only the club bar, toasts and modals float.
- **Don't** go above 16px on management screens; the scorebug, the match-up centre, the start title and the result banner are the only exceptions.
- **Don't** cover the court with a panel during a live match; pickers open in the side strip.
