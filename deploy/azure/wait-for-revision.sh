#!/usr/bin/env bash
# Point an Azure container app at an image and wait until the new revision serves the traffic.
#
#   deploy/azure/wait-for-revision.sh <resource group> <container app> <image>
#
# The apps run in single revision mode: the new revision takes the traffic once its readiness probe passes and the
# previous one is then stopped. Fails when the revision does not become ready within REVISION_TIMEOUT seconds
# (default 900; the API applies pending migrations before it reports ready). Used by azure-deploy-environment.yml
# and by people rolling back by hand (deploy/AZURE.md, section 10). Needs the Azure CLI, signed in.
set -euo pipefail

rg="${1:?resource group}"
app="${2:?container app}"
image="${3:?image}"
timeout="${REVISION_TIMEOUT:-900}"

current="$(az containerapp show -n "$app" -g "$rg" --query 'properties.template.containers[0].image' -o tsv)"
if [ "$current" = "$image" ]; then
  echo "$app already runs $image"
else
  az containerapp update -n "$app" -g "$rg" --image "$image" --only-show-errors -o none
fi

revision="$(az containerapp show -n "$app" -g "$rg" --query properties.latestRevisionName -o tsv)"
echo "$app: waiting for revision $revision ($image)"
deadline=$(( $(date +%s) + timeout ))
while :; do
  ready="$(az containerapp show -n "$app" -g "$rg" --query properties.latestReadyRevisionName -o tsv)"
  state="$(az containerapp revision show -n "$app" -g "$rg" --revision "$revision" --query 'properties.runningState' -o tsv 2>/dev/null || echo unknown)"
  if [ "$ready" = "$revision" ]; then
    echo "$app: revision $revision ready ($state)"
    exit 0
  fi
  case "$state" in
    Failed|Degraded)
      echo "$app: revision $revision is $state; see Log Analytics, ContainerAppConsoleLogs_CL where RevisionName_s == '$revision'" >&2
      exit 1 ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "$app: revision $revision not ready after ${timeout}s (state $state)" >&2
    exit 1
  fi
  sleep 10
done
