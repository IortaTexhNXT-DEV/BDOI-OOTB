#!/usr/bin/env bash
# Install and switch BrokerVerse releases on an EC2 (or any Linux) host from the artefacts built by CI.
# Called by .github/workflows/deploy.yml over SSH; can also be run by hand as root.
#
#   release.sh install  <backend-<sha>.tar.gz> <sha>   unpack the API release into releases/<sha>
#   release.sh backup   <label>                        pg_dump of the database (pre-deploy backup)
#   release.sh migrate  <sha>                          create the database if missing, run migrations then seeds
#   release.sh activate <sha>                          point current at the release, restart PM2, wait until healthy
#                                                      (switches back to the previous release if it does not come up)
#   release.sh rollback [<sha>]                        re-activate the previous release (or the one given); no migrations
#   release.sh web      <web-<sha>.tar.gz> <sha>       install the front end, write env-config.js, switch, reload nginx
#   release.sh web-rollback [<sha>]                    switch the front end back
#   release.sh status                                  current and previous releases, health, version
#
# Layout under BROKERVERSE_ROOT (default /home/ubuntu/appdata/brokerverse):
#   releases/<sha>/backend        API code with its production node_modules and build-info.json
#   current -> releases/<sha>     the running release; previous-release holds the one before
#   shared/backend.env            the API environment (DATABASE_URL, secrets...); copied once from backend/.env of
#                                 the older git-checkout layout (deploy/ec2/deploy.sh) when missing
#   uploads/, backend/uploads/    documents, kept outside the releases (linked into each release)
#   backups/                      pre-deploy database backups
#   web/releases/<sha>, web/current   front end (only with FRONTEND_TARGET=ec2)
#
# Environment: BROKERVERSE_ROOT, BROKERVERSE_PORT (8001), KEEP_RELEASES (5), KEEP_BACKUPS (10), BACKUP_S3_URI
# (optional s3://bucket/prefix for a copy of each backup), for "web": API_BASE_URL, ENVIRONMENT_NAME,
# ENVIRONMENT_COLOR, ANALYTICS_ENABLED, WEB_SERVER_NAME (host name served by nginx).
set -euo pipefail

ROOT="${BROKERVERSE_ROOT:-/home/ubuntu/appdata/brokerverse}"
PORT="${BROKERVERSE_PORT:-8001}"
APP_NAME=brokerverse-api
KEEP_RELEASES="${KEEP_RELEASES:-5}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
ENV_FILE="$ROOT/shared/backend.env"

log() { echo "[release] $*"; }
die() { echo "[release] ERROR: $*" >&2; exit 1; }

valid_sha() { [[ "$1" =~ ^[0-9a-f]{7,40}$ ]] || die "not a commit SHA: '$1'"; }

use_node() {
  export PATH="/usr/local/bin:/usr/bin:$PATH"
  # a host with Node.js 22 installed otherwise (BROKERVERSE_NODE=/usr/bin/node) skips nvm
  if [ -n "${BROKERVERSE_NODE:-}" ] && [ -x "$BROKERVERSE_NODE" ]; then
    NODE_BIN="$BROKERVERSE_NODE"
    PATH="$(dirname "$NODE_BIN"):$PATH"; export PATH
    command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
    return 0
  fi
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | PROFILE=/dev/null bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22 >/dev/null
  NODE_BIN="$(nvm which 22)"
  PATH="$(dirname "$NODE_BIN"):$PATH"; export PATH
  command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
}

shared_env() {
  mkdir -p "$ROOT/shared" "$ROOT/uploads" "$ROOT/backend/uploads" "$ROOT/backups"
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ROOT/backend/.env" ]; then
      install -m 600 "$ROOT/backend/.env" "$ENV_FILE"
      log "copied $ROOT/backend/.env to $ENV_FILE (first release-based deployment)"
    else
      die "missing $ENV_FILE: create it from deploy/backend.env.example"
    fi
  fi
  chmod 600 "$ENV_FILE"
}

env_value() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

release_dir() { echo "$ROOT/releases/$1"; }
current_sha() { [ -L "$ROOT/current" ] && basename "$(readlink -f "$ROOT/current")" || true; }

cmd_install() {
  local tarball="$1" sha="$2"; valid_sha "$sha"
  [ -f "$tarball" ] || die "artefact $tarball not found"
  shared_env
  local dir; dir="$(release_dir "$sha")"
  if [ -d "$dir/backend/node_modules" ] && [ -f "$dir/backend/build-info.json" ]; then
    log "release $sha already installed"
  else
    rm -rf "$dir.tmp" && mkdir -p "$dir.tmp"
    tar -xzf "$tarball" -C "$dir.tmp"
    [ -f "$dir.tmp/backend/src/server.js" ] || die "artefact has no backend/src/server.js"
    rm -rf "$dir" && mv "$dir.tmp" "$dir"
  fi
  ln -sfn "$ENV_FILE" "$dir/backend/.env"
  # a relative UPLOAD_DIR keeps pointing at the same documents whichever release runs
  [ -e "$dir/backend/uploads" ] || ln -sfn "$ROOT/backend/uploads" "$dir/backend/uploads"
  [ -e "$dir/uploads" ] || ln -sfn "$ROOT/uploads" "$dir/uploads"
  log "installed $sha in $dir"
}

cmd_backup() {
  local label="${1:-manual}"
  [[ "$label" =~ ^[A-Za-z0-9._-]+$ ]] || die "backup label may hold letters, digits, . _ -"
  shared_env
  command -v pg_dump >/dev/null || die "pg_dump is not installed (apt-get install postgresql-client-16); no backup, no deployment"
  local url; url="$(env_value DATABASE_URL)"
  [ -n "$url" ] || die "DATABASE_URL is not set in $ENV_FILE"
  # pg_dump does not understand the options= part used for the session time zone
  url="$(printf '%s' "$url" | sed -E 's/([?&])options=[^&]*&?/\1/; s/[?&]$//')"
  local file
  file="$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$label.dump"
  log "backing up the database to $file"
  pg_dump --format=custom --no-owner --file="$file.partial" "$url"
  mv "$file.partial" "$file"
  chmod 600 "$file"
  pg_restore --list "$file" >/dev/null || die "backup $file cannot be read back"
  log "backup done ($(du -h "$file" | cut -f1))"
  if [ -n "${BACKUP_S3_URI:-}" ] && command -v aws >/dev/null; then
    aws s3 cp --only-show-errors --sse AES256 "$file" "${BACKUP_S3_URI%/}/$(basename "$file")" && log "copied to $BACKUP_S3_URI"
  fi
  # keep the newest KEEP_BACKUPS local files
  ls -1t "$ROOT"/backups/*.dump 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f
  echo "$file" > "$ROOT/backups/LATEST"
}

cmd_migrate() {
  local sha="$1"; valid_sha "$sha"
  use_node
  local dir; dir="$(release_dir "$sha")"
  [ -d "$dir/backend" ] || die "release $sha is not installed"
  cd "$dir/backend"
  log "database check"
  NODE_ENV=production node scripts/create-database.js
  log "migrations (forward-only)"
  NODE_ENV=production node src/db/migrate.js
  log "seeds (idempotent reference data)"
  NODE_ENV=production node src/db/seed.js
}

wait_healthy() {
  local sha="$1"
  for _ in $(seq 1 60); do
    if curl -fsS -o /tmp/brokerverse-version.json "http://127.0.0.1:$PORT/api/version" 2>/dev/null \
       && grep -q "\"commit\":\"$sha" /tmp/brokerverse-version.json \
       && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null; then
      cat /tmp/brokerverse-version.json; echo
      return 0
    fi
    sleep 3
  done
  return 1
}

start_release() {
  local sha="$1" dir; dir="$(release_dir "$sha")"
  ln -sfn "$dir" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"
  export BROKERVERSE_ROOT="$ROOT" BROKERVERSE_NODE="$NODE_BIN" BROKERVERSE_PORT="$PORT"
  export BROKERVERSE_APP_DIR="$ROOT/current/backend"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  pm2 start "$dir/deploy/ec2/ecosystem.config.cjs" --update-env
  pm2 save >/dev/null
}

cmd_activate() {
  local sha="$1"; valid_sha "$sha"
  use_node
  local dir; dir="$(release_dir "$sha")"
  [ -d "$dir/backend" ] || die "release $sha is not installed"
  local before; before="$(current_sha)"
  start_release "$sha"
  if wait_healthy "$sha"; then
    if [ -n "$before" ] && [ "$before" != "$sha" ]; then echo "$before" > "$ROOT/previous-release"; fi
    log "release $sha is live (previous: ${before:-none})"
    # keep the newest KEEP_RELEASES releases, never the current or previous one
    local keep_prev; keep_prev="$(cat "$ROOT/previous-release" 2>/dev/null || true)"
    ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
      old="${old%/}"; case "$(basename "$old")" in "$sha"|"$keep_prev") ;; *) rm -rf "$old" ;; esac
    done
    return 0
  fi
  echo "[release] release $sha did not become healthy on port $PORT" >&2
  pm2 logs "$APP_NAME" --lines 60 --nostream || true
  if [ -n "$before" ] && [ "$before" != "$sha" ] && [ -d "$(release_dir "$before")" ]; then
    log "switching back to $before"
    start_release "$before"
    wait_healthy "$before" || echo "[release] previous release $before did not come up either" >&2
  fi
  exit 1
}

cmd_rollback() {
  local target="${1:-}"
  [ -n "$target" ] || target="$(cat "$ROOT/previous-release" 2>/dev/null || true)"
  [ -n "$target" ] || die "no previous release recorded; give the SHA to roll back to (ls $ROOT/releases)"
  valid_sha "$target"
  [ -d "$(release_dir "$target")/backend" ] || die "release $target is no longer on this host; redeploy it with the rollback workflow"
  log "rolling the API back to $target (database unchanged: migrations are forward-only)"
  cmd_activate "$target"
}

web_reload_nginx() {
  command -v nginx >/dev/null || { log "nginx not installed: front end files are in place, nothing reloaded"; return 0; }
  local conf=/etc/nginx/conf.d/brokerverse-web.conf src="$1/deploy/ec2/nginx-web.conf"
  [ -f "$src" ] || src="$ROOT/current/deploy/ec2/nginx-web.conf"
  local server_name="${WEB_SERVER_NAME:-_}"
  [[ "$server_name" =~ ^[A-Za-z0-9._\ -]+$ ]] || die "WEB_SERVER_NAME holds unexpected characters"
  local backup; backup="$(mktemp)"; local had=false
  [ -f "$conf" ] && { cp "$conf" "$backup"; had=true; }
  sed -e "s#__WEB_ROOT__#$ROOT/web/current#g" -e "s#__SERVER_NAME__#$server_name#g" "$src" > "$conf"
  if nginx -t; then systemctl reload nginx; else
    echo "[release] nginx rejected the front-end configuration; restoring the previous one" >&2
    if $had; then cp "$backup" "$conf"; else rm -f "$conf"; fi
    rm -f "$backup"; exit 1
  fi
  rm -f "$backup"
}

cmd_web() {
  local tarball="$1" sha="$2"; valid_sha "$sha"
  [ -f "$tarball" ] || die "artefact $tarball not found"
  local dir="$ROOT/web/releases/$sha"
  rm -rf "$dir.tmp" && mkdir -p "$dir.tmp"
  tar -xzf "$tarball" -C "$dir.tmp"
  [ -f "$dir.tmp/index.html" ] || die "front-end artefact has no index.html"
  rm -rf "$dir" && mv "$dir.tmp" "$dir"
  local tools="$ROOT/releases/$sha/brokerverse-scripts"
  [ -d "$tools" ] || tools="$(dirname "$0")/../../brokerverse/scripts"
  sh "$tools/env-config.sh" "$dir/env-config.js"
  API_UPSTREAM="${API_UPSTREAM:-http://127.0.0.1:$PORT}" sh "$tools/nginx-snippets.sh" /etc/nginx/brokerverse
  local before=""; [ -L "$ROOT/web/current" ] && before="$(basename "$(readlink -f "$ROOT/web/current")")"
  # the nginx configuration is checked (nginx -t) before the new files go live; a rejected one stops here
  web_reload_nginx "$(release_dir "$sha")"
  ln -sfn "$dir" "$ROOT/web/current.new" && mv -T "$ROOT/web/current.new" "$ROOT/web/current"
  command -v nginx >/dev/null && systemctl reload nginx || true
  if [ -n "$before" ] && [ "$before" != "$sha" ]; then echo "$before" > "$ROOT/web/previous-release"; fi
  ls -1dt "$ROOT"/web/releases/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
    old="${old%/}"; case "$(basename "$old")" in "$sha"|"$before") ;; *) rm -rf "$old" ;; esac
  done
  log "front end $sha is live (previous: ${before:-none})"
}

cmd_web_rollback() {
  local target="${1:-$(cat "$ROOT/web/previous-release" 2>/dev/null || true)}"
  [ -n "$target" ] || die "no previous front-end release recorded"
  valid_sha "$target"
  [ -d "$ROOT/web/releases/$target" ] || die "front end $target is no longer on this host"
  ln -sfn "$ROOT/web/releases/$target" "$ROOT/web/current.new" && mv -T "$ROOT/web/current.new" "$ROOT/web/current"
  command -v nginx >/dev/null && systemctl reload nginx || true
  log "front end rolled back to $target"
}

cmd_status() {
  echo "root:     $ROOT"
  echo "current:  $(current_sha)"
  echo "previous: $(cat "$ROOT/previous-release" 2>/dev/null || echo none)"
  echo "releases: $(ls -1t "$ROOT/releases" 2>/dev/null | tr '\n' ' ')"
  [ -L "$ROOT/web/current" ] && echo "web:      $(basename "$(readlink -f "$ROOT/web/current")")"
  curl -fsS "http://127.0.0.1:$PORT/api/version" 2>/dev/null && echo || echo "API not answering on port $PORT"
}

case "${1:-}" in
  install)      cmd_install "${2:?artefact}" "${3:?sha}" ;;
  backup)       cmd_backup "${2:-manual}" ;;
  migrate)      cmd_migrate "${2:?sha}" ;;
  activate)     cmd_activate "${2:?sha}" ;;
  rollback)     cmd_rollback "${2:-}" ;;
  web)          cmd_web "${2:?artefact}" "${3:?sha}" ;;
  web-rollback) cmd_web_rollback "${2:-}" ;;
  status)       cmd_status ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
