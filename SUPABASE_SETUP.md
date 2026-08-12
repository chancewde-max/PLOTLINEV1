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

## 2. Create the database table

1. In your project, open **SQL → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql)
   (in this repo) into the editor.
3. Click **Run**.
4. This creates a `public.app_data` table with **Row Level Security** enabled,
   so each user can only read/write their own row.

## 2b. Apply the follow-up migrations — REQUIRED, not optional

`schema.sql` alone is not enough to run this app. The client
(`src/data/cloudSync.js`) has always saved/loaded a few columns —
`company`, `proposal_templates`, `mto_templates`, `clients`, `pdf_assets`,
`ocr_memory` — that only exist once these run. **Skip this step and every
single save silently fails** (Postgres rejects an upsert that references a
column that doesn't exist) while the UI still shows "Saved" — this is a
real incident that happened because these migrations were undocumented.

Run each of these, **in this exact order**, in **SQL → New query** (one at a
time, click **Run** after each):

1. [`supabase/schema_add_templates.sql`](./supabase/schema_add_templates.sql)
2. [`supabase/schema_add_pdf_assets.sql`](./supabase/schema_add_pdf_assets.sql)
3. [`supabase/schema_add_ocr_memory.sql`](./supabase/schema_add_ocr_memory.sql)
4. [`supabase/schema_add_member_names.sql`](./supabase/schema_add_member_names.sql)
   (only meaningful once you've also run `schema_teams.sql` in step 6 below,
   but safe to run now regardless)
5. [`supabase/schema_add_storage.sql`](./supabase/schema_add_storage.sql) —
   creates the private `sheet-pdfs` Storage bucket (uploaded PDFs now live
   here instead of embedded as base64 text — see the "PDF storage" note
   below) and adds the `phrases`/`vendors` columns, which had never had a
   cloud column at all before this.

**Verify** by running this in the SQL editor — it should return `clients`,
`company`, `custom_cats`, `mto_templates`, `ocr_memory`, `pdf_assets`,
`phrases`, `projects`, `proposal_templates`, `sheets`, `updated_at`,
`user_id`, `vendors`:

```sql
select column_name from information_schema.columns
where table_name = 'app_data' and table_schema = 'public'
order by column_name;
```

If any of `company`, `proposal_templates`, `mto_templates`, `pdf_assets`,
`ocr_memory`, `phrases`, or `vendors` are missing, saves are failing
silently right now (for the missing-before-`schema_add_templates.sql`
columns) or that data just isn't reaching the cloud (`phrases`/`vendors`) —
run the missing migration file(s) above.

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
3. (Optional) Under **Authentication → URL Configuration**, set the Site URL to
   your dev URL (`http://localhost:5173` by default for Vite) so confirmation
   emails link back correctly.

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

## 6. (Optional) Teams

The **Team** tab on the home page lets one account own a shared workspace
that teammates are invited into. It needs one more SQL file on top of the
base schema above:

1. In Supabase, open **SQL → New query**.
2. Paste the entire contents of
   [`supabase/schema_teams.sql`](./supabase/schema_teams.sql) and click **Run**.
   This adds `organizations`, `org_members`, `org_invites`, and `org_data`
   (a shared, RLS-scoped counterpart to `app_data`), plus a couple of
   `security definer` RPCs (`create_organization`, `accept_org_invite`) that
   do the multi-row writes those actions need atomically.
3. Then run [`supabase/schema_add_member_names.sql`](./supabase/schema_add_member_names.sql)
   (step 2b above) if you haven't already — it caches each member's display
   name on `org_members` for the roster/assignment UI, and depends on
   `schema_teams.sql` already existing.
4. Then run [`supabase/schema_add_delete_org.sql`](./supabase/schema_add_delete_org.sql) —
   **required**, not optional, if Teams is enabled at all. Without it, a
   team's creator can only "leave" it like any other member, which abandons
   the team's `org_data` row (and every project/sheet in it) with nobody left
   who can reach it to clean up — a real ghost row was found holding ~49MB of
   stale data this way, large enough to make an unrelated team's saves start
   failing. This migration adds a `delete_organization()` RPC (owner-only —
   permanently deletes the team and everything in it) and locks the owner's
   own membership row so leaving isn't possible for them; only deleting the
   team is.
5. No new env vars — it reuses the same Supabase project/credentials.

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
| `supabase/schema.sql` | Table + RLS policies to run in Supabase |
| `supabase/schema_add_templates.sql` | **Required** — adds `company`/`proposal_templates`/`mto_templates`/`clients` columns |
| `supabase/schema_add_pdf_assets.sql` | **Required** — adds `pdf_assets` column |
| `supabase/schema_add_ocr_memory.sql` | **Required** — adds `ocr_memory` column |
| `supabase/schema_add_member_names.sql` | **Required for Teams** — caches member display names, adds `create_organization`/`accept_org_invite` RPCs |
| `supabase/schema_add_delete_org.sql` | **Required for Teams** — adds `delete_organization()` RPC and locks the owner's membership row so a team can be deleted but never abandoned |
| `supabase/schema_add_storage.sql` | **Required** — creates the private `sheet-pdfs` Storage bucket + RLS, adds `phrases`/`vendors` columns |
| `src/data/pdfStorage.js` | Upload/path-builder/signed-URL helpers + the legacy-PDF self-heal migration |
| `supabase/schema_teams.sql` | Teams: orgs, membership, invites, shared `org_data` |
| `src/lib/supabaseClient.js` | `createClient` + `supabaseEnabled` guard |
| `src/data/cloudSync.js` | `loadUserSnapshot` / `saveUserSnapshot` (personal) |
| `src/data/orgSync.js` | Org CRUD, invites, `loadOrgSnapshot` / `saveOrgSnapshot` (shared) |
| `src/auth/AuthProvider.jsx` | Session tracking, hydration/autosave, org data-source switching |
| `src/auth/AuthModal.jsx` | Login/sign-up modal |
| `src/pages/TeamTab.jsx` | Team tab: create/join team, roster, invites, CRM pipeline view |
| `src/pages/AcceptInvitePage.jsx` | `/invite/:token` — preview + accept an invite |
| `.env` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
