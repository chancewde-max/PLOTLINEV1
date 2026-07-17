# Handoff

Last updated: 2026-07-17 · covers work through commit `dca235d` on `main`.

## What this app is

Plotline — takeoff & estimating software for landscape/irrigation contractors.
React + Vite frontend, optional Supabase backend (Postgres + Auth + RLS),
offline-first (works entirely on `localStorage` with no account). See
`README.md` for the stack/quick-start and `SUPABASE_SETUP.md` for cloud sync
setup. `CLAUDE.md`/skills aren't set up in this repo — there's no
project-specific agent config beyond what's in this file.

## Recent work (this thread)

Two rounds of changes, both merged straight to `main` (no PR — pushed
directly at the user's request each time):

**Round 1 — design/security review + fixes** (`1f109d0`, `fa86385`):
- Security review of auth/Supabase/RLS — no criticals found; one medium
  (org-invite email-spoofing) depends on a Supabase dashboard setting
  (email confirmation) that isn't visible from the repo — **worth
  verifying that's enabled**.
- Fixed: mobile nav had no way to reach Product/Pricing/Customers/Docs
  below 760px (added a hamburger menu on `LandingPage` and `PricingPage`).
- Fixed: cookie consent banner sized for desktop, buried content on
  mobile.
- Fixed: CSP report-only header didn't allow Google Fonts or the
  jsdelivr CDN `tesseract.js` actually pulls from — added both, but
  **left it report-only, not enforcing** (see "Open items" below).
- Added: `SheetPrintView` — printing a sheet's plan + measured
  quantities to a printer or PDF via `window.print()`.
- Fixed: a real pinch-zoom/pan bug on mobile (iOS Safari native
  page-zoom fighting the app's own touch handlers) — `touch-action: none`
  on the canvas container.

**Round 2 — sheet-page fixes + features** (`dca235d`):
- Fixed: several dialogs used `--surface-paper` (a token frozen to a
  warm cream color in both themes, meant only for the plan-sheet
  graphic) as a generic dialog background. Paired with theme-aware text,
  that's near-invisible text in dark mode. Fixed in `SheetPage.jsx`
  (New area/line/count, Edit group), `SheetUploadWizard.jsx`, and
  `TeamTab.module.css`.
- Fixed: `.sheetWrap`'s CSS transition was double-animating on top of
  JS-driven pan/zoom, making drag-panning visibly lag the cursor.
  Removed the transition (see `SheetPage.module.css`).
- Print: sheet print now offers This sheet / All sheets / Choose sheets,
  one page per sheet.
- New: right-click context menu on the canvas — Stop recording, New
  area, Place Legend (draggable/resizable box of live category counts).
  Notable gotcha: deciding "was this a click or the start of a
  right-drag pan" can't be done in the `contextmenu` handler — that
  event fires alongside mousedown, before any drag has happened. The
  decision is made in `onMouseUp` instead, gated on a flag
  (`rightDragMovedRef`) set only once real movement is observed.
- New: Measurement precision setting (whole / 0.1 / 0.01) in the
  settings popover, plus better spacing in that popover.

## Where things live

- `src/pages/SheetPage.jsx` — the takeoff canvas/editor. Large file
  (~3600 lines). Pan/zoom, drawing tools, right-click menu, legends,
  settings popover all live here.
- `src/components/SheetPrintView.jsx` — the print flow (portal-rendered,
  `window.print()`-based, mirrors `BidProposal.jsx`'s pattern).
- `src/workspace/geometry.js` — shared pure geometry helpers (polygon
  area/perimeter, arc-path building, point-in-polygon). Both
  `SheetPage.jsx` and `SheetPrintView.jsx` import from here — don't
  re-derive arc math elsewhere.
- `src/data/sampleData.js` — seed/demo data, `CATS`/`CAT_COLOR`
  taxonomy, and `categoryTotals()` (shared by the print legend and the
  on-canvas Legend feature).
- `src/styles/print.css` — global print rules. Both print flows
  (`BidProposal` and `SheetPrintView`) portal into `.plotline-print-root`
  and get hidden/reset the same way. If you add a third print flow,
  reuse this class rather than inventing another portal-hiding rule.
- `src/styles/colors.css` — design tokens. `--surface-paper` is
  intentionally frozen (doesn't flip in dark mode) because it represents
  the physical plan sheet. **Don't reuse it for generic UI chrome** —
  that's the bug that was just fixed twice in different files.

## Known quirk in the data model (not fixed, just documented)

Seeded/demo sheets store each area & line **twice** under the same id:
once as a bare `{id,type,poly}` thumbnail copy on `sheet.areas`/
`sheet.lines`, and once as the richer, authoritative copy (with
`arcSegs`/`groupId`/`color`) in `sheet.savedAreas`/`sheet.savedLines`
(exposed as `addedAreas`/`addedLines` in `SheetPage.jsx`). The live
canvas renders both as two separately-keyed layers (a faint "base" ghost
under the editable layer) so it never surfaces as a bug there — but
anything that flattens `allAreas = [...sheet.areas, ...addedAreas]` into
one list (which `SheetPage.jsx` already did, for region-total math)
will double-count. `SheetPrintView.jsx` has a `dedupeById()` helper to
guard against this; if you add another feature that consumes
`allAreas`/`allLines`/`allPoints` as a flat list, dedupe by id first
(added/saved entries should win — they're the richer copy).

## Open items / things flagged but not done

- **CSP is still report-only**, not enforcing. Flipping it requires
  verifying `tesseract.js`'s CDN calls (jsdelivr, for its OCR worker/core/
  lang-data) are fully allow-listed, or better, self-hosting those
  assets the way `pdf.js`'s worker already is (see
  `src/components/PdfCanvas.jsx`). Not attempted — real OCR testing
  needed first.
- **Org-invite email-spoofing risk** (medium severity, from the security
  review) depends on the Supabase project's "Confirm email" setting,
  which isn't in this repo. Check the dashboard.
- The `org_data` table lets any org member overwrite the whole shared
  snapshot (not just admins) — looked intentional (there's a comment
  saying so) but has no undo/audit trail. Flagged, not changed.
- `subscription.js` billing is a client-side-only simulation with no
  server enforcement — fine today since nothing is actually gated by it,
  but would be a trivial bypass if real paid-feature gating gets added
  later without a server-side check.
- No numeric "print every Nth sheet" control — "Choose sheets" checkboxes
  cover picking any subset instead. If a specific range-based UI is
  wanted, it isn't built.

## Testing notes

No test suite exercises the sheet editor or print flow — everything in
this thread was verified manually via a local dev server + Playwright
screenshots (dark mode, pan/zoom, print output, context menu, drag/resize
on the Legend). There's an `e2e/` directory (`npm run test:e2e`) but it
wasn't run as part of this work — worth checking what it actually covers
before relying on it for regression safety on the sheet page.
