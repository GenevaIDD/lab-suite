# Staging environment

A separate, throwaway copy of the app for testing new features, invites,
the SQL wipe/refresh scripts, role changes, etc. — without touching real
lab data or emailing real users.

**Architecture:** a dedicated **staging Supabase project** (its own database,
users, and storage) behind a dedicated **staging Vercel project** (its own
stable URL). Production is untouched.

```
 prod:    lab-inventory (Vercel)        ──▶  prod Supabase project
 staging: lab-inventory-staging (Vercel) ──▶ staging Supabase project
```

The same source tree deploys to both; which Supabase it talks to is decided
entirely by each Vercel project's environment variables.

---

## One-time setup

### 1. Create the staging Supabase project
1. Supabase dashboard → **New project** (free tier allows 2 projects).
   Name it e.g. `lab-inventory-staging`.
2. Open **SQL Editor** and run [`supabase/schema.sql`](../supabase/schema.sql).
   That single file is the full, current schema (tables, enums, RLS policies,
   storage buckets) and is all a fresh project needs.
3. *(Optional)* load test items by running
   [`supabase/refresh_item_types_2026_06.sql`](../supabase/refresh_item_types_2026_06.sql).
4. **Auth → URL Configuration → Redirect URLs:** add
   `https://<your-staging-url>/set-password` (so invite links work).
5. From **Settings → API**, copy: Project URL, `anon` public key, and
   `service_role` key.

### 2. Create the staging Vercel project
1. Vercel → **Add New → Project**, import the same repo, name it
   `lab-inventory-staging`. Set the **Root Directory** to `lab-inventory`
   (same as production).
2. **Settings → Environment Variables** (Production scope is fine for this
   project — it *is* your staging app):
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | staging Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | staging `anon` key |
   | `VITE_APP_ENV` | `staging` |
   | `SUPABASE_SERVICE_ROLE_KEY` | staging `service_role` key (server-only) |

   ⚠️ `SUPABASE_SERVICE_ROLE_KEY` must **never** have a `VITE_` prefix — it
   would leak into the browser bundle and bypass all security.

### 3. Wire up the deploy script (local)
```bash
cp .vercel-staging.env.example .vercel-staging.env
# fill in the staging project's VERCEL_ORG_ID and VERCEL_PROJECT_ID
# (Vercel → staging project → Settings → General for the project ID;
#  Team/Account settings for the org ID)
```
`.vercel-staging.env` is gitignored.

---

## Daily use

```bash
npm run deploy:staging   # deploy current code to the staging Vercel project
npm run deploy:prod      # deploy to production (the default-linked project)
```

The staging app shows an amber **“STAGING — test data”** badge (bottom-right)
so it's never confused with production. That badge is driven by
`VITE_APP_ENV=staging`.

## Notes
- Schema changes: when you add a migration for production, also run it in the
  staging Supabase SQL Editor (or re-run `schema.sql` on a fresh staging DB).
- Staging and production have **separate user accounts** — invite yourself on
  staging to test the invite flow end-to-end.
- Keeping prod safe: test destructive things (delete, wipe scripts, deactivate)
  on staging first.
