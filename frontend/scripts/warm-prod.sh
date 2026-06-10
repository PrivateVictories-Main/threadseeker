#!/usr/bin/env bash
# Warm production's edge caches right after a deploy. Deploys here are MANUAL
# (`wrangler pages deploy` — the Pages project is not git-connected), so no
# workflow trigger can observe them: run this immediately after deploying.
# caches.default is per-colo; this warms the colo serving this machine plus
# the upstream cf-cached index fetches (which ARE shared), so the worst
# first-visitor cost (multi-second big-index recompute) is paid here instead.
set -uo pipefail
BASE="${1:-https://threadseeker.pages.dev}"
QUERIES=("react state management" "vector database" "local llm runtime" "rust http framework" "python web framework" "css framework" "self-hosted photo library" "terraform aws modules")
FNS=(search-homebrew search-fdroid search-vcpkg search-melpa search-arxiv)
echo "warming $BASE"
for fn in "${FNS[@]}"; do
  for q in "${QUERIES[@]}"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST "$BASE/api/$fn" \
      -H 'Content-Type: application/json' -d "{\"query\":\"$q\"}")
    printf '  %s %-16s %s\n' "$code" "$fn" "$q"
  done
done
echo "done"
