#!/usr/bin/env bash
# Package the API as a versioned release artefact: backend-<sha>.tar.gz with the code, its production
# node_modules (installed from package-lock.json), build-info.json (commit, build time, ref: shown by
# GET /api/version), the EC2 release scripts and the front-end runtime scripts. Built once by CI and deployed
# unchanged to every environment (deploy/RELEASE_PIPELINE.md).
#
#   deploy/package-backend.sh <commit-sha> <output.tar.gz> [ref]
set -euo pipefail

sha="${1:?commit SHA}"
out="${2:?output file}"
ref="${3:-}"
[[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || { echo "not a commit SHA: $sha" >&2; exit 1; }

here="$(cd "$(dirname "$0")/.." && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/backend" "$stage/deploy" "$stage/brokerverse-scripts"
cp "$here/backend/package.json" "$here/backend/package-lock.json" "$stage/backend/"
cp -r "$here/backend/src" "$here/backend/scripts" "$here/backend/assets" "$stage/backend/"
cp -r "$here/deploy/ec2" "$stage/deploy/"
cp "$here/brokerverse/scripts/env-config.sh" "$here/brokerverse/scripts/nginx-snippets.sh" "$stage/brokerverse-scripts/"

(cd "$stage/backend" && npm ci --omit=dev --no-audit --no-fund --ignore-scripts >/dev/null)

build_time="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
version="$(node -p "require('$stage/backend/package.json').version")"
printf '{\n  "commit": "%s",\n  "buildTime": "%s",\n  "ref": "%s",\n  "version": "%s"\n}\n' \
  "$sha" "$build_time" "$ref" "$version" > "$stage/backend/build-info.json"

mkdir -p "$(dirname "$out")"
tar -C "$stage" -czf "$out" backend deploy brokerverse-scripts
echo "packaged $out ($(du -h "$out" | cut -f1)), commit $sha, built $build_time"
