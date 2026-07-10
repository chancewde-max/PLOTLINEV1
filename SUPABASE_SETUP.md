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
| `src/lib/supabaseClient.js` | `createClient` + `supabaseEnabled` guard |
| `src/data/cloudSync.js` | `loadUserSnapshot` / `saveUserSnapshot` |
| `src/auth/AuthProvider.jsx` | Session tracking, hydration, autosave |
| `src/auth/AuthModal.jsx` | Login/sign-up modal |
| `.env` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
