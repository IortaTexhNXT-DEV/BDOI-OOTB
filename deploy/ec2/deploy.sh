#!/usr/bin/env bash
# Older, manual route: install the API from the git checkout at BROKERVERSE_ROOT and reload it under PM2.
# The release pipeline (.github/workflows/deploy.yml) uses deploy/ec2/release.sh instead, which installs the
# artefact CI built for a commit into releases/<sha> (deploy/RELEASE_PIPELINE.md section 13).
# Install backend production dependencies and reload the API under PM2.
# Expects backend/.env (from deploy/backend.env.example) and does not overwrite it, except PORT, which this script sets to 8001.
# Run as root (the workflow uses sudo su), so the API joins root's PM2 with the other apps on this host.
# Node.js 22 comes from root's nvm, so other apps keep their own Node version.
set -euo pipefail

ROOT="${BROKERVERSE_ROOT:-/home/ubuntu/appdata/brokerverse}"
APP_NAME=brokerverse-api
export PATH="/usr/local/bin:/usr/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | PROFILE=/dev/null bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 22 >/dev/null
NODE_BIN="$(nvm which 22)"
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"
echo "Using Node $("$NODE_BIN" -v) at $NODE_BIN"

if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi

cd "$ROOT/backend"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/backend/.env. Copy deploy/backend.env.example and fill in the RDS and secret values." >&2
  exit 1
fi
# The API is published on 8001. brokerverse-be keeps 8000. The server .env is not in git, so set PORT here.
PORT=8001
if grep -q '^PORT=' .env; then
  sed -i "s/^PORT=.*/PORT=$PORT/" .env
else
  printf '\nPORT=%s\n' "$PORT" >> .env
fi
echo "API port: $PORT"

# npm ci replaces node_modules, so the running instance must not restart from a half-installed tree.
pm2 stop "$APP_NAME" >/dev/null 2>&1 || true

owner="$(ss -ltnpH "sport = :$PORT" 2>/dev/null || true)"
if [ -n "$owner" ]; then
  echo "Port $PORT is already used, so $APP_NAME cannot listen on it:" >&2
  echo "$owner" >&2
  pids="$(echo "$owner" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u | tr '\n' ' ')"
  node -e '
    const { execSync } = require("node:child_process");
    const wanted = new Set(process.argv.slice(1));
    let list = [];
    try { list = JSON.parse(execSync("pm2 jlist", { encoding: "utf8" })); } catch { /* PM2 has no process list yet */ }
    for (const app of list) {
      if (wanted.has(String(app.pid))) console.error(`  PM2 app "${app.name}" (pid ${app.pid}, status ${app.pm2_env && app.pm2_env.status})`);
    }
  ' $pids >&2 || true
  for pid in $pids; do
    ps -o pid,ppid,user,etime,cmd -p "$pid" >&2 || true
    echo "  working directory: $(readlink "/proc/$pid/cwd" 2>/dev/null || echo unknown)" >&2
  done
  echo "brokerverse-be on port 8000 is left running. Free port $PORT, then deploy again." >&2
  exit 1
fi

npm ci --omit=dev
mkdir -p "$ROOT/uploads"
node scripts/create-database.js

cd "$ROOT"
if [ -f "$ROOT/deploy/ec2/nginx-api.conf" ] && command -v nginx >/dev/null; then
  CONF=/etc/nginx/conf.d/brokerverse-api.conf
  BACKUP="$(mktemp)"
  HAD_CONF=false
  if [ -f "$CONF" ]; then cp "$CONF" "$BACKUP"; HAD_CONF=true; fi
  sed "s/__PORT__/$PORT/g" "$ROOT/deploy/ec2/nginx-api.conf" > "$CONF"
  if nginx -t; then
    systemctl reload nginx
  else
    echo "nginx rejected brokerverse-api.conf; restoring the previous configuration." >&2
    if [ "$HAD_CONF" = true ]; then cp "$BACKUP" "$CONF"; else rm -f "$CONF"; fi
  fi
  rm -f "$BACKUP"
  others="$(grep -rlE 'server_name[^;]*brokerverse-demo-api\.inxtuniverse\.com' /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null | grep -v "^$CONF$" || true)"
  if [ -n "$others" ]; then
    echo "WARNING: these nginx files also serve brokerverse-demo-api.inxtuniverse.com, and nginx uses the first one it loads:" >&2
    echo "$others" >&2
  fi
fi

export BROKERVERSE_ROOT="$ROOT"
export BROKERVERSE_NODE="$NODE_BIN"
export BROKERVERSE_PORT="$PORT"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start deploy/ec2/ecosystem.config.cjs --update-env
pm2 save

for _ in $(seq 1 40); do
  code="$(curl -sS -o /tmp/brokerverse-health.json -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" || true)"
  if [ "$code" = "200" ] && grep -q pendingMigrations /tmp/brokerverse-health.json; then
    cat /tmp/brokerverse-health.json
    echo
    exit 0
  fi
  sleep 3
done

echo "API did not become ready on port $PORT." >&2
pm2 logs "$APP_NAME" --lines 80 --nostream || true
exit 1
