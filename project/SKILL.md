---
name: plotline-design
description: Use this skill to generate well-branded interfaces and assets for Plotline, either for production or throwaway prototypes/mocks/etc. Plotline is a web app for landscape & hardscape contractors to view plan sheets, mark them up, and run takeoff/estimating tools. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and
create static HTML files for the user to view. If working on production code, you can copy
assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or
design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_
production code, depending on the need.

## Quick map
- `readme.md` — full design guide: content voice, visual foundations, iconography, manifest.
- `styles.css` — the only stylesheet to link; `@import`s all tokens + fonts.
- `tokens/` — color, typography, spacing, effects CSS custom properties.
- `guidelines/*.html` — foundation specimen cards (color/type/spacing/brand).
- `components/<group>/` — React primitives (`Button`, `Input`, `Tag`, `Dialog`, the takeoff
  set `ToolRail`/`MeasurementChip`/`SheetThumb`/`EstimateRow`, …). Each has a `.prompt.md`.
- `ui_kits/app/` — the plan-viewer + takeoff workspace recreation.
- `ui_kits/marketing/` — the landing page.
- `assets/` — logo SVGs + `icons.js` (Lucide helper).

## House rules (the short version)
- **Voice:** sentence case everywhere, "you" not "we", trade-literate, no emoji. Numbers,
  money, and units are always mono with tabular figures and trade units (`sq ft`, `ln ft`,
  `cu yd`, `ea`, `1" = 20'`).
- **Color:** pine green `--brand-600` is the one action color. Cool slate neutrals. Warm paper
  for plan sheets. **Takeoff types own hues** — area=green, linear=amber, count=blue,
  volume=violet — used consistently across canvas, layers, tags, estimate.
- **Type:** Space Grotesk (display), Hanken Grotesk (UI/body), JetBrains Mono (numbers).
- **Feel:** crisp small radii, hairline borders + subtle cool shadows, blueprint-grid motif,
  measured motion (no bounce). Always keep the brand focus ring.
- **Icons:** Lucide, 2px stroke. Never hand-roll SVG icons or use emoji.

## Substitutions flagged
Fonts are Google Fonts (not self-hosted); icons are Lucide via CDN; the name/logo are original
proposals — all are safe to replace. There was no source codebase or prior brand.
