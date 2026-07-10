# Plotline — takeoff & estimating software for landscape and irrigation contractors

Upload a plan, measure it, count it, price it, and walk out with a bid. Plotline turns PDF landscape and irrigation plans into clean takeoffs and printable proposals — no spreadsheets, no hand-scaling, no guesswork.

## Features

- **Upload PDF plans** — drop in your landscape or irrigation drawings and measure directly on the page.
- **Measure areas, lines, and counts** — area (sq ft), linear (ft), and point counts (fixtures, plants, heads) with a calibrated scale.
- **Materials takeoff** — attach materials, quantities, and unit costs to every measurement.
- **Export** — printable bid/proposal plus **CSV** and **JSON** exports for your workflow.
- **Cloud sync when signed in** — optional Supabase backend keeps projects following you across devices and crew.
- **Zero-config local mode** — runs entirely on `localStorage` with no account and no setup.

## Tech Stack

- **React** + **Vite** (frontend, fast dev server, modern build)
- **Supabase** (optional cloud backend — Postgres + Auth + Row Level Security)
- PDF rendering via `pdfjs-dist`, OCR via `tesseract.js`

## Quick Start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. That's it — the app is fully usable immediately. The demo project is seeded on first load so you can try a real takeoff without importing anything.

## Enabling Cloud Sync (optional)

Plotline works offline-first. To sync projects across devices and teammates:

1. Create a free project at <https://supabase.com>.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and set the two variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Enable **Email** auth in Supabase (Authentication → Providers).

Full step-by-step wiring, verification, and how the no-credentials fallback works are in [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

> The `anon` key is safe to ship to the browser — Row Level Security keeps each user's data isolated. Never put the `service_role` key in a `VITE_` variable.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the Vite dev server (http://localhost:5173) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |

## License

See repository for license details.
