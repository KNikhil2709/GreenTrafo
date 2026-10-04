#!/usr/bin/env bash
set -euo pipefail
: "${VERCEL_ORG_ID:?Set VERCEL_ORG_ID}"
: "${VERCEL_PROJECT_ID:?Set VERCEL_PROJECT_ID}"
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
: "${GITHUB_SHA:?Run from the deployment workflow}"
: "${GITHUB_REPOSITORY:?Run from the deployment workflow}"
check_current_commit() {
  local current
  current="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)"
  if [[ "$current" != "$GITHUB_SHA" ]]; then
    echo 'A newer commit exists on main; this run will not promote.'
    exit 0
  fi
}
check_current_commit
node scripts/package-vercel.cjs
deployment_url="$(vercel deploy --prebuilt --prod --skip-domain --yes --token "$VERCEL_TOKEN")"
if [[ ! "$deployment_url" =~ ^https://[a-zA-Z0-9.-]+\.vercel\.app$ ]]; then
  echo 'Unexpected deployment URL; refusing promotion.' >&2
  exit 1
fi
echo "Staged: $deployment_url"
BASE_URL="$deployment_url" node tests/deployment.cjs
check_current_commit
vercel promote "$deployment_url" --yes --token "$VERCEL_TOKEN"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf 'Promoted verified release `%s`: %s\n' "$GITHUB_SHA" "$deployment_url" >> "$GITHUB_STEP_SUMMARY"
fi
