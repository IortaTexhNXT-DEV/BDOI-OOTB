#!/usr/bin/env bash
# Post-deployment smoke test of one BrokerVerse environment. Used by .github/workflows/deploy.yml after every
# deployment (a failure there rolls the application back) and by people after a manual change.
#
#   APP_URL=https://uat.broker.example.ph EXPECTED_SHA=<commit> ENVIRONMENT_NAME=UAT deploy/smoke-test.sh
#
# Checks, retried for up to SMOKE_TIMEOUT seconds (default 300) while the new release starts:
#   1. API readiness   GET  $API_URL/health    200 with "ready":true (database reachable, no pending migration)
#   2. Version         GET  $API_URL/version   "commit" equals EXPECTED_SHA (skipped when EXPECTED_SHA is empty)
#   3. Sign-in page    GET  $APP_URL/login     200, the app shell (<div id="root">) loading /env-config.js
#   4. Runtime config  GET  $APP_URL/env-config.js  served without caching, naming ENVIRONMENT_NAME when given
# API_URL defaults to $APP_URL/api (same-origin set-up).
set -euo pipefail

APP_URL="${APP_URL:?set APP_URL to the web address of the environment}"
APP_URL="${APP_URL%/}"
API_URL="${API_URL:-$APP_URL/api}"
API_URL="${API_URL%/}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-300}"
SKIP_WEB="${SKIP_WEB:-false}"
SKIP_API="${SKIP_API:-false}"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fetch() { curl -sS -L --max-time 20 -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$1" 2>"$tmp/err" || echo 000; }

check_api() {
  local code
  code="$(fetch "$API_URL/health")"
  [ "$code" = 200 ] || { echo "health: HTTP $code"; return 1; }
  grep -q '"ready":true' "$tmp/body" || { echo "health: not ready: $(head -c 300 "$tmp/body")"; return 1; }
  code="$(fetch "$API_URL/version")"
  [ "$code" = 200 ] || { echo "version: HTTP $code"; return 1; }
  if [ -n "$EXPECTED_SHA" ]; then
    local commit
    commit="$(sed -nE 's/.*"commit":"?([0-9a-f]*|null)"?.*/\1/p' "$tmp/body")"
    [ "$commit" = "$EXPECTED_SHA" ] || { echo "version: running commit '$commit', expected '$EXPECTED_SHA'"; return 1; }
  fi
  echo "api ok: $(head -c 400 "$tmp/body")"
}

check_web() {
  local code
  code="$(fetch "$APP_URL/login")"
  [ "$code" = 200 ] || { echo "sign-in page: HTTP $code"; return 1; }
  grep -q 'id="root"' "$tmp/body" || { echo "sign-in page: not the BrokerVerse app shell"; return 1; }
  grep -q 'env-config.js' "$tmp/body" || { echo "sign-in page: does not load /env-config.js"; return 1; }
  if grep -q '%PUBLIC_URL%' "$tmp/body"; then echo "sign-in page: unbuilt index.html is being served"; return 1; fi
  code="$(fetch "$APP_URL/env-config.js")"
  [ "$code" = 200 ] || { echo "env-config.js: HTTP $code"; return 1; }
  grep -q '__BROKERVERSE_CONFIG__' "$tmp/body" || { echo "env-config.js: unexpected content"; return 1; }
  if [ -n "$ENVIRONMENT_NAME" ]; then
    grep -q "\"ENVIRONMENT_NAME\": \"$ENVIRONMENT_NAME\"" "$tmp/body" || { echo "env-config.js: does not name $ENVIRONMENT_NAME (a cache still serving the previous file?)"; return 1; }
  fi
  grep -qiE '^cache-control:.*(no-store|no-cache|max-age=0)' "$tmp/headers" \
    || echo "warning: env-config.js is served without no-cache/no-store; a browser may keep an old configuration"
  echo "web ok: sign-in page and env-config.js"
}

deadline=$(( $(date +%s) + SMOKE_TIMEOUT ))
attempt=0
while :; do
  attempt=$((attempt + 1))
  ok=true
  if [ "$SKIP_API" != true ]; then check_api || ok=false; fi
  if $ok && [ "$SKIP_WEB" != true ]; then check_web || ok=false; fi
  if $ok; then echo "smoke test passed (attempt $attempt)"; exit 0; fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "smoke test FAILED after $attempt attempts against $APP_URL" >&2
    exit 1
  fi
  sleep 10
done
