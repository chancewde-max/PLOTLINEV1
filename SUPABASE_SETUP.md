# Plotline — Supabase Cloud Sync Setup

Plotline works **out of the box with zero configuration**: projects, sheets, and
custom categories are saved to your browser's `localStorage`. Cloud sync is an
*optional upgrade* that makes your data follow you across devices and teammates.

This guide wires up **Supabase** (Postgres + Auth + Row Level Security) as the
multi-tenant cloud backend. You need a free Supabase account — the app can't
create one for you.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up / log in.
2. Click **New project**.
3. Pick an organization, name it (e.g. `plotline`), set a database password
   (save it somewhere), and choose a region close to you.
4. Wait for the project to finish provisioning (~1–2 min).

## 2. Run the SQL migrations — ALL REQUIRED, IN THIS ORDER

Every file below is required for any cloud setup. Order matters: later files
reference tables/functions (`org_data`, `org_members`, `is_org_member`) that
only exist once `schema_teams.sql` has run. Supabase runs each pasted script
as a single transaction, so if one statement fails, **the whole file rolls
back** — including its `app_data` columns — and every save silently fails
while the UI still shows "Saved".

For each file: open **SQL → New query**, paste the **entire** file, click
**Run**, and confirm it succeeded before moving on.

1. [`supabase/schema.sql`](./supabase/schema.sql) — the personal `app_data`
   table with Row Level Security.
2. [`supabase/schema_teams.sql`](./supabase/schema_teams.sql) — **REQUIRED**
   (not optional, even if you never use Teams): `organizations`,
   `org_members`, `org_invites`, `org_data`, and the `is_org_member` helper
   that every later file depends on.
3. [`supabase/schema_add_templates.sql`](./supabase/schema_add_templates.sql)
4. [`supabase/schema_add_pdf_assets.sql`](./supabase/schema_add_pdf_assets.sql)
5. [`supabase/schema_add_ocr_memory.sql`](./supabase/schema_add_ocr_memory.sql)
6. [`supabase/schema_add_member_names.sql`](./supabase/schema_add_member_names.sql)
7. [`supabase/schema_add_storage.sql`](./supabase/schema_add_storage.sql) —
   also creates the private `sheet-pdfs` Storage bucket (see "PDF storage"
   below).
8. [`supabase/schema_add_delete_org.sql`](./supabase/schema_add_delete_org.sql) —
   owner-only `delete_organization()` RPC; prevents a team from being
   abandoned with nobody able to clean it up.

If a file errors, fix the cause (usually an earlier file that was skipped),
then re-run that file — they're safe to re-run.

**Verify** by running this in the SQL editor — it should return `clients`,
`company`, `custom_cats`, `mto_templates`, `ocr_memory`, `pdf_assets`,
`phrases`, `projects`, `proposal_templates`, `sheets`, `updated_at`,
`user_id`, `vendors`:

```sql
select column_name from information_schema.columns
where table_name = 'app_data' and table_schema = 'public'
order by column_name;
```

If any are missing, saves are failing right now — re-run the files above in
order, starting from the first one that didn't succeed.

### PDF storage — why this matters

Before `schema_add_storage.sql`, every uploaded PDF was base64-encoded and
embedded directly as JSONB text on the sheet (or the shared `pdf_assets`
map) — the wrong medium for binary data. One team's cloud row grew to
**~49MB** of embedded PDF text this way, which made Postgres reject every
save to that row with a `statement timeout`, blocking that entire team's
sync (not just the oversized sheet). New uploads now go into the
`sheet-pdfs` Storage bucket instead; existing accounts self-heal (any
legacy embedded PDFs get moved to Storage automatically, in the background,
the next time that account signs in) once this migration has been run.

## 3. Enable Email/Password auth

1. Open **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. Under **Authentication → URL Configuration**, add your dev URL
   (`http://localhost:5173` by default for Vite) to **Redirect URLs**. Sign-up
   confirmation emails link back to whatever origin the user signed up from,
   but only if that origin is on this list — otherwise Supabase falls back to
   the Site URL. (For production, see "Deploying to Vercel" below.)

## 4. Copy the credentials into `.env`

1. In Supabase, open **Project Settings → API**.
2. Copy **Project URL** and the **anon public** key.
3. In the project root (`PLOTLINEV1/`), create a file named `.env`:

   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

   > The `anon` key is safe to ship to the browser — Row Level Security is what
   > keeps data per-user. Never put the `service_role` key in a `VITE_` var.

4. Restart the dev server (`npm run dev`) so Vite picks up the new env vars.

## 5. Verify

- Reload the app. The landing page **Sign in** button now opens a real
  login/sign-up dialog.
- Create an account (check your email to confirm if confirmation is on).
- Add a project / sheet / custom category. It syncs to Supabase automatically.
- Open the app in another browser/profile and sign in with the same account —
  your data is there.

## 6. Teams

The **Team** tab on the home page lets one account own a shared workspace
that teammates are invited into. Its database pieces (`schema_teams.sql`,
`schema_add_member_names.sql`, `schema_add_delete_org.sql`) are already
installed by step 2 — no extra SQL and no new env vars.

How it works:

- From the **Team** tab, a signed-in user can create a team (they become
  admin) or paste an invite link to join one.
- Admins invite teammates by email from the Team tab. There's no outbound
  email sending wired up (this app has no backend to send mail from), so
  inviting generates a link (`/invite/<token>`) that the admin copies and
  sends manually — text, Slack, email, whatever's convenient.
- Once someone is on a team, **their projects/sheets/categories switch from
  their private workspace to the team's shared one** — everyone on the team
  sees and edits the same projects. Existing personal projects are not
  auto-migrated into a newly created team, to avoid surprising other members
  with someone's private data.
- The **Pipeline** sub-tab is a lightweight CRM view: filter projects by
  status or assignee, and assign a project to a teammate (stored as an
  `assignedTo` field directly on the project — no separate table needed).
- v1 keeps this simple: a user belongs to **at most one team at a time**.

---

## Deploying to Vercel

1. In Vercel, **Add New → Project** and import this repo (framework preset:
   Vite).
2. **Before the first build**, open **Settings → Environment Variables** and
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your
   `.env`), checking both **Production** and **Preview**. Vite bakes these in
   at build time: if they're missing, the deployed site silently runs
   localStorage-only with no cloud sync, and adding them later has no effect
   until you redeploy.
3. In Supabase, open **Authentication → URL Configuration**:
   - Set **Site URL** to your production Vercel domain
     (e.g. `https://plotline.vercel.app`).
   - Add to **Redirect URLs**: that production domain, plus a pattern for
     preview deployments (e.g. `https://*-<your-vercel-team>.vercel.app/**`).
4. After **any** env var change in Vercel, redeploy (**Deployments → ⋯ →
   Redeploy**) — a running deployment never picks up new values.

---

## How it works (no-cred safe)

- `src/lib/supabaseClient.js` exports `supabaseEnabled` (false when the env vars
  are absent) and the client (or `null`).
- Every cloud call is guarded. With no credentials, the app transparently
  falls back to `localStorage` and behaves exactly as before — the e2e smoke
  test runs without Supabase at all.
- `src/auth/AuthProvider.jsx` wraps the existing `useAppData` context: it hydrates
  cloud data on login and debounce-saves (~800 ms) on every change while signed in,
  then resets to defaults on sign-out. It never changes `useAppData`'s function
  signatures, so the rest of the app is unaffected.

## Files

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | **Required (run 1st)** — `app_data` table + RLS policies |
| `supabase/schema_teams.sql` | **Required (run 2nd)** — orgs, membership, invites, shared `org_data`, `is_org_member` |
| `supabase/schema_add_templates.sql` | **Required** — adds `company`/`proposal_templates`/`mto_templates`/`clients` columns |
| `supabase/schema_add_pdf_assets.sql` | **Required** — adds `pdf_assets` column |
| `supabase/schema_add_ocr_memory.sql` | **Required** — adds `ocr_memory` column |
| `supabase/schema_add_member_names.sql` | **Required** — caches member display names, adds `create_organization`/`accept_org_invite` RPCs |
| `supabase/schema_add_delete_org.sql` | **Required (run last)** — adds `delete_organization()` RPC and locks the owner's membership row so a team can be deleted but never abandoned |
| `supabase/schema_add_storage.sql` | **Required** — creates the private `sheet-pdfs` Storage bucket + RLS, adds `phrases`/`vendors` columns |
| `src/data/pdfStorage.js` | Upload/path-builder/signed-URL helpers + the legacy-PDF self-heal migration |
| `src/lib/supabaseClient.js` | `createClient` + `supabaseEnabled` guard |
| `src/data/cloudSync.js` | `loadUserSnapshot` / `saveUserSnapshot` (personal) |
| `src/data/orgSync.js` | Org CRUD, invites, `loadOrgSnapshot` / `saveOrgSnapshot` (shared) |
| `src/auth/AuthProvider.jsx` | Session tracking, hydration/autosave, org data-source switching |
| `src/auth/AuthModal.jsx` | Login/sign-up modal |
| `src/pages/TeamTab.jsx` | Team tab: create/join team, roster, invites, CRM pipeline view |
| `src/pages/AcceptInvitePage.jsx` | `/invite/:token` — preview + accept an invite |
| `.env` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
