#!/bin/sh
# Runs when the web container starts (nginx image, /docker-entrypoint.d): writes the environment's
# /env-config.js and the nginx snippets from the container's variables. The image itself is the same for every
# environment. Variables: API_BASE_URL, API_UPSTREAM, ENVIRONMENT_NAME, ENVIRONMENT_COLOR, ANALYTICS_ENABLED,
# CSP_CONNECT_EXTRA (see scripts/env-config.sh and scripts/nginx-snippets.sh).
set -eu
/opt/brokerverse/env-config.sh /usr/share/nginx/html/env-config.js
/opt/brokerverse/nginx-snippets.sh /etc/nginx/brokerverse
case "${API_BASE_URL:-}" in
  ""|/*)
    if [ -z "${API_UPSTREAM:-}" ]; then
      echo "brokerverse: neither API_UPSTREAM nor an absolute API_BASE_URL is set; /api is not proxied from this container." >&2
    fi
    ;;
esac
