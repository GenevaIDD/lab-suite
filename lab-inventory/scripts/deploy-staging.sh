#!/usr/bin/env bash
# Deploy to the *staging* Vercel project (separate from production).
#
# Setup once:
#   cp .vercel-staging.env.example .vercel-staging.env
#   # fill in the staging project's org + project IDs (Vercel → Project → Settings)
#
# The staging project's Environment Variables (VITE_SUPABASE_URL, anon key,
# SUPABASE_SERVICE_ROLE_KEY, VITE_APP_ENV=staging) are configured in the
# Vercel dashboard, not here. See docs/STAGING.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .vercel-staging.env ]]; then
  echo "Missing .vercel-staging.env — copy .vercel-staging.env.example and fill it in." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .vercel-staging.env

: "${VERCEL_ORG_ID:?set VERCEL_ORG_ID in .vercel-staging.env}"
: "${VERCEL_PROJECT_ID:?set VERCEL_PROJECT_ID in .vercel-staging.env}"

# VERCEL_ORG_ID / VERCEL_PROJECT_ID override the .vercel link, so this targets
# the staging project without disturbing the production link.
export VERCEL_ORG_ID VERCEL_PROJECT_ID
exec npx vercel --prod "$@"
