# Team Management

A React + Vite workspace app backed by Supabase Auth and Postgres. There is no custom
API server or seed/demo data — roles and permissions live in Postgres and are enforced
with row-level security.

## Layout

- `frontend/` – Vite + React client
- `supabase/schema.sql` – tables, triggers, roles, RLS policies and the workspace loader
- `.env.example` – environment variables

## Scripts

- `npm run dev` – start the Vite dev server
- `npm run build` – build to `frontend/dist`
- `npm run preview` – preview the production build
- `npm run lint` – lint the frontend

## Setup

1. Copy `.env.example` to `.env` and add your Supabase project URL and publishable key:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

   Never put a service-role key in `.env` — Vite exposes `VITE_*` values to the browser.

2. Run `supabase/schema.sql` once in your Supabase Dashboard → SQL Editor → New query.
   It creates every table, the role permission helpers, RLS policies and the
   `get_workspace()` RPC. It inserts no users, projects or demo content.

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

4. The first account to sign up becomes the **owner**. Later signups are `viewer`
   unless an owner/admin has invited their email with a specific role. Everyone picks
   the role they use at login; a mismatch is rejected. Sessions persist across visits
   via Supabase Auth.

## Roles

`owner`, `admin`, `manager`, `member`, `viewer`. The same permission matrix is mirrored
in `frontend/src/auth.jsx` and `supabase/schema.sql` (`permissions_for` / `has_permission`).
