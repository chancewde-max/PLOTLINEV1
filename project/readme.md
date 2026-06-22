# Plotline — Design System

> **Plotline** is a web app for landscape & hardscape contractors: open a sheet of plans,
> mark it up, and run **takeoff** tools — measuring areas, linear runs, counts and volumes —
> so quantities flow straight into a live estimate. Think "Figma for site plans, with a
> calculator built in."

This design system is the single source of truth for Plotline's visual language and UI.
It contains the foundations (color, type, spacing, effects), reusable React components,
domain-specific takeoff primitives, and full-screen UI kits.

---

## ⚠️ Provenance & substitutions (read me)

- **No source code or brand existed when this was built.** The attached GitHub repo
  [`chancewde-max/landscape-site`](https://github.com/chancewde-max/landscape-site) was **empty**
  (no commits), and the user confirmed there is no existing codebase. **Everything here —
  name, logo, palette, type, components — is an original proposal** and is meant to be
  iterated on, not treated as locked brand truth.
- **Fonts are loaded from Google Fonts CDN**, not self-hosted binaries (Space Grotesk,
  Hanken Grotesk, JetBrains Mono). To self-host, drop `.woff2` files in `assets/fonts/` and
  replace the `@import` in `tokens/fonts.css` with `@font-face` rules. See "Type" below.
- **Icons are Lucide via CDN** (`https://unpkg.com/lucide`), a substitute for any bespoke icon
  set Plotline might adopt later. See "Iconography."
- The "Plotline" name and the leaf/sheet logomark are placeholders — swap freely.

If you have access to the repos above, explore them to ground future work in the real product.

---

## Content fundamentals — how Plotline writes

The voice is **plain, confident, and trade-literate** — it sounds like a sharp estimator,
not a marketing team or a SaaS bot.

- **Voice & person.** Address the user as **"you"**; the product is "Plotline" (never "we"
  in the UI). Imperative for actions: *"Open a sheet," "Set the scale," "Trace the area."*
- **Casing.** **Sentence case everywhere** — buttons, menus, headings, table headers.
  ("Save estimate," not "Save Estimate.") Sheet codes and units stay as the trade writes
  them: `L-2`, `sq ft`, `ln ft`, `cu yd`, `ea`, `1" = 20'`.
- **Numbers are first-class.** Quantities, money, and units are always set in mono with
  tabular figures. Use trade units, not generic ones. Round sensibly (`12,480 sq ft`,
  `$48,210`). A measured value never appears in body sans.
- **Tone.** Direct and unfussy. Short labels. Helpful empty states ("Set a scale before you
  measure"). No exclamation points, no hype, no "Oops!" Errors say what happened and what to
  do: *"Scale not set — set a sheet scale before measuring."*
- **Terminology.** Consistent domain words: **sheet** (a plan page), **takeoff** (the act of
  measuring), **measurement** (one traced item), **layer/category**, **estimate**, **line
  item**, **scale**, **markup**. Don't synonym-swap.
- **No emoji.** Not in product UI. Status is shown with color + icon, never an emoji.
- **Examples.** Button: `New takeoff`. Toast: `Estimate exported · Saved to Downloads.`
  Empty state: `No measurements yet — pick a tool and trace your first area.`
  Tooltip: `Area tool` + shortcut `A`.

---

## Visual foundations

The aesthetic is **precise, measured, and tool-like** — CAD-adjacent but warm. It should feel
like a well-made instrument: calm chrome, a paper sheet you actually work on, and color used
*with intent* (mostly to encode meaning, not decorate).

- **Color.**
  - **Brand = pine/emerald green** (`--brand-600 #157a52` is the primary action color). One
    confident green; not minty, not neon. Used for primary buttons, active tools, focus,
    selection, and the total line.
  - **Neutrals = cool slate** with a faint green tint — chrome, text, borders. The app shell
    is light (`--bg-app`), the plan workspace is a slightly darker cool gray (`--bg-canvas`)
    so the **warm paper sheet** (`--surface-paper #faf8f2`) visually lifts off it.
  - **Takeoff categorical palette** — the signature move. Every measurement *type* owns a hue,
    consistently across canvas, layer list, tags, and estimate: **area=green, linear=amber,
    count=blue, volume=violet, region=magenta, slope=cyan.** Color = meaning here.
  - **Status** is conventional: success green, warning amber, danger red, info blue.
- **Type.** Display **Space Grotesk** (geometric, technical; tight tracking, semibold/bold for
  headings & wordmark). UI/body **Hanken Grotesk** (high x-height, sentence-case labels).
  Measurements/quantities/codes **JetBrains Mono** with tabular figures. Min UI text 12px;
  body 15px. Display tracking is tight (`-0.02em`); never letter-space body text.
- **Spacing & layout.** 4px base grid. Fixed app rails: `--rail-left 56px` (tool rail),
  `--panel-left 264px` (sheets/layers), `--panel-right 320px` (estimate/properties),
  `--topbar 52px`. Dense but breathable; controls are 28/34/42px tall.
- **Corner radii.** Crisp and instrument-like: 3–10px for most UI (`--radius-md 7px` is the
  default), up to 14–20px only for dialogs/large cards. Pills reserved for badges/switches.
  Nothing should look squishy.
- **Borders.** Hairline `1px` cool-gray borders (`--border-default`) define structure; cards
  are border + soft shadow, not heavy. `1.5px` for emphasis (checkboxes, totals).
- **Elevation / shadows.** Subtle, **cool-tinted** (rgba of `#0e1311`), never muddy black.
  `xs/sm` for resting cards & inputs, `md` for popovers/hover-lift, `lg` for toasts, `xl` for
  dialogs. Paper sheets get a dedicated soft `--sheet-shadow`.
- **Backgrounds & texture.** The recurring motif is the **blueprint grid** (`--grid-blueprint`,
  22px) — used on the canvas, empty states, and marketing hero. Plan sheets carry a finer
  16px paper grid. **No gradients** as decoration (a flat brand wash at most), no glassmorphism
  beyond a 2px dialog scrim blur, no noise.
- **Motion.** Measured and quick — tools *snap*, they don't wobble. Durations 120/180/280ms;
  easing `--ease-standard`/`--ease-out`. Fades and small translate/scale (dialog pop-in 8px).
  **No bounce, no infinite decorative loops.** Respect `prefers-reduced-motion`.
- **Interaction states.**
  - *Hover:* neutral surfaces lighten to `--surface-muted`/`--action-neutral-hover`; primary
    darkens one step (`--action-primary-hover`); cards lift 1px + `shadow-md`.
  - *Active/press:* darken another step; buttons translate down 0.5px (a tactile "click").
  - *Selected (tool/layer/sheet):* brand-tinted fill + brand border/ring — the same language
    everywhere.
  - *Focus:* always the brand focus ring (`--focus-ring`, 3px brand at 35%). Never remove it.
  - *Disabled:* 45–50% opacity, no pointer.
- **Imagery vibe.** Plan sheets are clean line-work on warm paper. Photography (marketing)
  should read **outdoor, natural, daylight** — real landscapes and job sites, slightly warm,
  never cold stock-blue. Drop images into `<image-slot>`s or `SheetThumb src=…`.

---

## Iconography

- **Library: [Lucide](https://lucide.dev)** loaded from CDN — clean **2px stroke, 24px grid,
  round caps/joins.** This is a **substitution** stand-in for a future bespoke set; it matches
  the precise, light-stroke aesthetic well.
- **Usage.** In cards/kits, load `lucide.min.js` then `assets/icons.js`, and call
  `window.plIconSVG("ruler", { size: 18 })` → an `<svg>` element (inherits `currentColor`).
  In React components, pass icon nodes as props (`iconLeft`, `tools[].icon`, …) — the
  components never hard-code icons.
- **Tool metaphors.** `hand`=pan, `square-dashed`=area, `spline`=linear, `locate`=count,
  `box`=volume, `ruler`=scale/measure, `layers`=layers, `map`=sheets, `message-square`=note.
- **Color.** Icons inherit text color; on the active tool they go white on brand green.
- **No emoji, no unicode glyphs as icons.** Status uses an icon + semantic color.

---

## Index / manifest

**Foundations**
- `styles.css` — the single entry point consumers link. `@import`s only.
- `tokens/colors.css` · `typography.css` · `spacing.css` · `effects.css` · `fonts.css`
- `guidelines/*.html` — foundation specimen cards (Type, Colors, Spacing, Brand) shown in the
  Design System tab.
- `assets/` — `plotline-mark.svg`, `plotline-mark-mono.svg`, `icons.js` (Lucide helper).

**Components** (`window.PlotlineDesignSystem_0cdb69.*`) — see each dir's `.prompt.md`:
- `components/buttons/` — **Button**, **IconButton**
- `components/forms/` — **Input**, **Select**, **Checkbox**, **Switch**
- `components/data-display/` — **Badge**, **Tag**, **Avatar**
- `components/surfaces/` — **Card**, **Tabs**
- `components/feedback/` — **Tooltip**, **Dialog**, **Toast**
- `components/takeoff/` — **ToolRail**, **MeasurementChip**, **SheetThumb**, **EstimateRow**

**UI kits** (full-screen recreations)
- `ui_kits/app/` — the Plotline plan viewer + takeoff workspace (see its `README.md`)
- `ui_kits/marketing/` — the marketing landing page

**Other**
- `SKILL.md` — makes this folder usable as a downloadable Claude Agent Skill.

---

*Generated files — never edit by hand:* `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`.
