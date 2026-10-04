# BrokerVerse release pipeline

How a change travels from a pull request to Production: one build, promoted unchanged through the environments,
with approvals, backups, forward-only migrations, smoke tests and rollback. For the iorta TechNXT DevOps team and the
release manager. The runtime settings of each environment are in [REFERENCE.md](REFERENCE.md); the first set-up of a
server in [README.md](README.md) (AWS) and [RAILWAY.md](RAILWAY.md).

| File | Role |
|---|---|
| `.github/workflows/ci.yml` | Every pull request and push: lint, tests, audit, build; keeps the artefacts `web-<sha>` and `backend-<sha>`; starts the automatic deployments |
| `.github/workflows/deploy.yml` | Deploys the artefacts of one commit to one environment (called by CI, or run by hand to promote) |
| `.github/workflows/rollback.yml` | Manual rollback of the application of one environment to an earlier build |
| `deploy/package-backend.sh` | Packs the API release artefact (code, production `node_modules`, `build-info.json`) |
| `deploy/ec2/release.sh` | On the server: install, backup, migrate, switch, roll back |
| `deploy/smoke-test.sh` | Post-deployment checks (also for manual use) |
| `brokerverse/scripts/env-config.sh` | Writes the front end's runtime configuration `/env-config.js` |
| `brokerverse/scripts/nginx-snippets.sh` | Writes the web server's security headers and `/api` proxy |

## 1. Build once, promote the same artefact

```
pull request ──► CI: lint · tests (PostgreSQL 16) · audit · build ──► artefacts web-<sha>, backend-<sha> (90 days)
                                                                              │
          ┌───────────────────────────────────────────────────────────────────┘ the same files, never rebuilt
          ▼
   dev ──► (sit) ──► uat ──► (preprod, temporary) ──► production
   auto     manual   rc tag     manual                  release tag vX.Y.Z
            approval approval   approval                approval
```

- **Front end.** Built once with no API address and no environment name. Each environment's web server publishes
  `/env-config.js` (generated at deployment or container start from the environment's variables) and forwards `/api`
  to its own backend, so the browser calls the API on the same origin. Details in section 4.
- **Backend.** `backend-<sha>.tar.gz`: the code, its production dependencies installed from `package-lock.json` and
  `build-info.json` (commit, build time, ref). `GET /api/version` reports that commit; the smoke test compares it with
  the commit deployed. The Docker image (`backend/Dockerfile`, build arguments `GIT_COMMIT`, `BUILD_TIME`, `GIT_REF`)
  is the same artefact for container platforms.
- **Database.** Migration files travel inside the backend artefact and run, forward only, before the new release is
  switched in (section 8).
- **Configuration and data** are not in the artefact: the configuration workbook and the go-live loads move them
  (section 12).

Only these differ between environments: the backend environment file (secrets, `DATABASE_URL`, `CORS_ORIGINS`,
`PUBLIC_BASE_URL`, `APP_ENVIRONMENT`, `SEED_SAMPLE_DATA`...) and the front end's runtime values (`API_BASE_URL`,
`ENVIRONMENT_NAME`, `ENVIRONMENT_COLOR`).

## 2. Environments per broker size

| Broker size | Environments | Notes |
|---|---|---|
| Small | **Dev** (build and integration) → **UAT** → **Production** | SIT testing is done by iorta TechNXT in Dev before the release candidate goes to UAT |
| Medium | **Dev** (build and integration) → **UAT** → **Production** | As small; UAT is the broker's acceptance and training environment |
| Large | **Dev** → **SIT** → **UAT** → **Production** | SIT and UAT are separate: iorta TechNXT end-to-end testing and mock loads in SIT, broker acceptance in UAT |
| Every size | **Pre-Prod**, temporary | Created for the go-live rehearsal and for major releases: restored from a **production backup** (masked where the broker requires it, section 12), used for the rehearsal, then **removed** |

Pre-Prod lifecycle:

1. Create the database from the latest production backup (`pg_restore` of a `release.sh backup` file or an RDS
   snapshot restore). Before go-live, when there is no production yet, it is built like Production and loaded with the
   final mock migration.
2. Give it its own secrets (`JWT_SECRET`, `DATA_ENCRYPTION_KEY` **of production** when two-factor users must sign in
   with their existing enrolment, otherwise new ones), `SMTP_URL` pointing at a test mailbox, scheduler off until the
   rehearsal needs it.
3. If personal data must not be visible to the rehearsal team, run the data masking script
   (`backend/scripts/mask-data.js`) before anyone signs in.
4. Deploy the release tag to `preprod` (Actions > Deploy, environment preprod), rehearse, run the comparison report
   against Production (section 12), record timings.
5. Remove the environment: drop the database, delete the server or service, delete the GitHub Environment's secrets
   (or set `DEPLOY_ENABLED` to `false`). Backups taken there are deleted with it.

## 3. Branches, tags and what deploys where

| Ref | Meaning | CI | Deployment |
|---|---|---|---|
| `feature/<ticket>-<name>`, `fix/<ticket>-<name>` | Work in progress | Lint, tests, audit, build | None |
| Pull request into `brokerverse-platform` | Review | Same, required to pass (branch protection) | None |
| `brokerverse-platform` | Integration branch (trunk) | Same, artefacts kept 90 days | **dev**, automatically |
| `vX.Y.Z-rc.N` tag | Release candidate | Same | **uat**, automatically, after approval; **sit** by hand (large brokers) |
| `vX.Y.Z` tag | Release approved by the CAB | Same | **production**, automatically, after approval; **preprod** by hand before it |
| `hotfix/vX.Y.Z+1` branch | Production fix (section 10) | Same | Tags from it follow the rows above |

Tags are created from a commit whose CI run is green (`git tag -a v1.2.0 <sha> -m "..."` then `git push origin v1.2.0`,
or a GitHub Release). Tags are never moved or reused; a corrected release gets the next number.

## 4. Front-end runtime configuration

| Variable (GitHub Environment, container or service) | Meaning | Default |
|---|---|---|
| `API_BASE_URL` | API address for the browser. Leave **empty** when the web server forwards `/api` (recommended); else e.g. `https://api.uat.broker.ph/api` | same origin `/api` |
| `API_UPSTREAM` | (web container / server only) where the web server forwards `/api`, e.g. `http://api:8000`, `http://api.railway.internal:8000`, `http://127.0.0.1:8001` | none |
| `ENVIRONMENT_NAME` | Label next to the logo and in the browser tab: `DEV`, `SIT`, `UAT`, `PREPROD`, `TRAINING`. **Empty or `PRODUCTION`: no label** | none |
| `ENVIRONMENT_COLOR` | Label colour `#rrggbb` | DEV/LOCAL slate, SIT violet, UAT amber, PREPROD red, DEMO/TRAINING teal |
| `ANALYTICS_ENABLED` | Allow analytics (none is wired in today) | `false` |

- `index.html` loads `/env-config.js` (a separate file, so the Content-Security-Policy needs no inline script) before
  the app bundle. `brokerverse/src/config/runtimeConfig.js` is the only place the app reads its settings: runtime
  value, then the build-time `REACT_APP_BASE_URL` (builds made before this change keep working), then `/api`.
- Caching: `/static/*` (content-hashed) one year, `immutable`; `index.html` `no-cache`; `env-config.js` `no-store`.
  The S3 upload sets the same headers object by object; CloudFront invalidates `/index.html`, `/env-config.js`, `/`.
- Headers on every response of the web server: `Content-Security-Policy` (`script-src 'self'`; `connect-src 'self'`
  plus the API origin when `API_BASE_URL` is absolute), `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`. With S3 + CloudFront, add the same policy as a CloudFront response headers policy.
- Where it is generated: `brokerverse/nginx/40-brokerverse-runtime.sh` at container start (Docker Compose, Railway),
  `deploy/ec2/release.sh web` on the EC2 host, the deploy workflow for S3, `npm run serve` for a local check.

## 5. The workflows

**CI (`ci.yml`)**, on every pull request and push, and by hand:

| Job | Steps |
|---|---|
| Backend lint and tests | `npm ci`, `npm run lint`, `npm test` (the full suite against a `postgres:16` service) |
| Front-end lint, tests and build | `npm ci --legacy-peer-deps`, `npm run lint`, `craco test`, environment-neutral build, checks that the build is real, loads `/env-config.js` and carries no API address; artefact `web-<sha>` |
| Backend release artefact | `deploy/package-backend.sh` → artefact `backend-<sha>` |
| Dependency audit | `npm audit --omit=dev --audit-level=high` for backend and front end (high or critical in a production dependency fails) |
| Deploy to dev / uat / production | Calls `deploy.yml` after all four jobs pass: dev on `brokerverse-platform`, uat on `vX.Y.Z-rc.N`, production on `vX.Y.Z` |

Artefacts are kept 90 days (7 for pull requests). Superseded runs of a branch or pull request are cancelled.

**Deploy (`deploy.yml`)**, one environment, one commit:

1. *Resolve the build*: the commit (the calling run's, the one chosen in "Use workflow from", or the `sha` input)
   and the successful CI run holding its artefacts. Production refuses anything but a `vX.Y.Z` tag.
2. *Check the environment is configured*: `DEPLOY_ENABLED=true` and the secrets of the chosen targets. If not, the job
   ends **green with a notice** "Deployment to <env> skipped: ..."; nothing is touched. An environment GitHub creates
   on the fly (first tag push before the owner set it up) therefore never deploys without its rules and reviewers.
3. Approval: the job waits for the environment's required reviewers (uat, preprod, production).
4. Connect to the server (SSH, 20 s timeout, pinned host key); a clear error if it cannot be reached.
5. *Pre-deploy database backup* (`pg_dump`, verified readable): always for preprod and production, elsewhere with
   `BACKUP_BEFORE_DEPLOY=true`. No backup, no deployment.
6. *Install* the backend release beside the running one, *migrate* (forward-only), *seed* (idempotent reference data),
   *switch* (PM2 restart on the new release, wait for `/api/version` = the new commit and `/api/health` ready; the
   script switches back by itself if the release does not come up).
7. *Front end*: S3 (keeps a copy of the live site, uploads with the cache headers, writes `env-config.js`, invalidates
   CloudFront) or the server (`release.sh web`).
8. *Smoke test* (`deploy/smoke-test.sh`, up to 5 minutes): `/api/health` ready, `/api/version` = deployed commit,
   `/login` serves the app shell, `/env-config.js` names the environment.
9. *Automatic rollback* when 6 to 8 fail: the API goes back to the release that ran before, the S3 front end is
   restored from the copy, the server front end is switched back. The database keeps the new migrations (section 8).
10. Summary in the run page. Runs per environment are queued, never parallel (`concurrency: deploy-<env>`).

**Rollback (`rollback.yml`)**: section 9.

## 6. Promotion and approvals

| Step | How | Approval (GitHub Environment) | Entry and exit criteria |
|---|---|---|---|
| → dev | Merge to `brokerverse-platform` | none | Green CI |
| → sit (large brokers) | Actions > Deploy, "Use workflow from" the rc tag, environment `sit` | optional reviewer (iorta TechNXT test lead) | rc tag; exit: SIT report, `uat-scenario.js` passed |
| → uat | Push the tag `vX.Y.Z-rc.N` (automatic) or Deploy by hand | **required**: iorta TechNXT delivery lead | SIT passed (or Dev for small and medium); exit: UAT Sign-off Certificate |
| → preprod (temporary) | Actions > Deploy, "Use workflow from" `vX.Y.Z`, environment `preprod` | **required**: DevOps lead | UAT sign-off, configuration frozen; exit: rehearsal report, comparison report clean |
| → production | Push the tag `vX.Y.Z` (automatic) or Deploy by hand from the tag | **required**: two reviewers (DevOps lead and the broker's release approver / CAB), "prevent self-review" on | CAB approval, release notes sent 5 business days before; deployment inside the maintenance window (set a wait timer or approve at the window) |

"Promote" always means: run Deploy for the **same commit** in the next environment. The run summary links the CI
run whose artefacts were used, which is the release record's evidence.

## 7. GitHub settings (repository owner)

Done once in **Settings** of `IortaTexhNXT-DEV/BDOI-OOTB`; none of it is in the code.

1. **Environments** (Settings > Environments > New environment): `dev`, `sit`, `uat`, `preprod`, `production`.
   - Deployment protection rules: required reviewers on `uat`, `preprod`, `production` (production: at least two,
     "Prevent self-review"). Optionally a wait timer on production.
   - Deployment branches and tags: `dev` → `brokerverse-platform`; `sit`, `uat` → tags `v*`; `preprod`,
     `production` → **tags `v*.*.*` only** ("Selected branches and tags", add tag rule `v*.*.*`; the workflow also
     refuses production from anything but `vX.Y.Z`).
2. **Variables per environment** (Environment > Environment variables):

   | Variable | dev | uat | production |
   |---|---|---|---|
   | `DEPLOY_ENABLED` | `true` once the server is reachable | `true` | `true` |
   | `BACKEND_TARGET` | `ec2` | `ec2` | `ec2` (or `none` where the platform deploys itself) |
   | `FRONTEND_TARGET` | `s3` | `s3` or `ec2` | `s3` |
   | `APP_URL` | `https://brokerverse-demo.inxtuniverse.com` | the UAT web address | the production address |
   | `API_URL` | `https://brokerverse-demo-api.inxtuniverse.com/api` (API on its own host) | empty if same origin | empty if same origin |
   | `API_BASE_URL` | same as `API_URL` while the API is on another host; empty once CloudFront forwards `/api/*` | | |
   | `ENVIRONMENT_NAME` | `DEV` | `UAT` | empty |
   | `BROKERVERSE_ROOT`, `BROKERVERSE_PORT` | `/home/ubuntu/appdata/brokerverse`, `8001` (defaults) | per server | per server |
   | `BACKUP_S3_URI`, `BACKUP_BEFORE_DEPLOY` | | optional | `s3://<backup-bucket>/brokerverse/` |
   | `AWS_REGION`, `AWS_ROLE_ARN` | `ap-southeast-1`; role for OIDC instead of keys (recommended) | | |
   | `WEB_SERVER_NAME` | only with `FRONTEND_TARGET=ec2` | | |

3. **Secrets per environment** (Environment > Environment secrets), each environment its own values:
   `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (a deploy key allowed only on that server), `EC2_KNOWN_HOSTS` (output of
   `ssh-keyscan <host>`, checked once by hand), `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (unless
   `AWS_ROLE_ARN`), `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`. Move the current **repository** secrets of the same
   names into the `dev` environment and delete them at repository level, so no environment can use another's.
   Application secrets (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `DATABASE_URL`, `ADMIN_PASSWORD`, `SMTP_URL`) stay on
   the server (`shared/backend.env`) or in the platform's secret store, never in GitHub.
4. **Branch protection** on `brokerverse-platform`: pull request required, one approving review, required status
   checks "Backend lint and tests", "Front-end lint, tests and build", "Backend release artefact", "Dependency
   audit". **Tag protection** (rulesets): only release managers create `v*` tags; tags cannot be deleted or moved.
5. **Actions** settings: workflow permissions "Read repository contents"; artefact retention at least 90 days.
6. **Reachability**: the `dev` deployment to the current EC2 host failed on every push with an SSH timeout. The host
   must accept SSH from GitHub-hosted runners (security group on port 22; GitHub publishes its address ranges at
   `https://api.github.com/meta`, key `actions`), or use a self-hosted runner inside the VPC (`runs-on` label) or AWS
   SSM instead of SSH. Until then leave `DEPLOY_ENABLED` unset on `dev`: pushes stay green, with the "skipped" notice.

## 8. Migrations policy

1. Forward only. Migrations add tables, columns, indexes; there are no down-migrations. The previous release must run
   on the newer schema (expand / contract): a column or table is removed only in a later release, after no deployed
   release reads it. This is what makes an application-only rollback safe.
2. A migration file is never edited after it left Dev; a correction is a new file with a higher number.
3. The deploy runs migrations **before** switching the API (`release.sh migrate`: create the database if missing,
   `src/db/migrate.js`, then `src/db/seed.js`), under the migration advisory lock. The API start runs them again,
   which then finds nothing to do. `migrate --reset` is refused with `NODE_ENV=production`.
4. Every migration runs in Dev, then (SIT), UAT and Pre-Prod before Production. A migration that fails stops the
   deployment before the switch: the old release keeps running on a database where the failed migration rolled back.
5. Long data migrations (rewriting large tables) are reviewed separately and run in the maintenance window.

## 9. Rollback

| Situation | What happens / what to do |
|---|---|
| The new release does not start | `release.sh activate` switches back to the previous release by itself; the run fails |
| Smoke test fails after the switch | `deploy.yml` rolls the API and the front end back automatically; the run fails, the summary says "previous release restored" |
| Problem found later | **Actions > Rollback**: "Use workflow from" the earlier tag (production: its `vX.Y.Z` tag; elsewhere a tag, branch or `sha`), environment, reason. Same approvals as a deployment. Switches the API (from the server's kept releases, the last five, or the CI artefact) and republishes that commit's front end. No migrations, no backup |
| Data must go back | Restore the pre-deploy backup (`backups/<time>-<env>-pre-<sha>.dump` on the server and in `BACKUP_S3_URI`, or the RDS snapshot): stop the API, `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>`, roll the application back to the release of that backup, start. Transactions entered since the backup are re-entered: decide with the broker (CAB) |
| On the server by hand | `sudo bash /home/ubuntu/appdata/brokerverse/current/deploy/ec2/release.sh status`, then `... rollback [<sha>]` or `... web-rollback [<sha>]` (each release carries the script) |

## 10. Hotfix path

1. Branch from the production tag: `git switch -c hotfix/v1.2.1 v1.2.0`.
2. Fix, pull request into `hotfix/v1.2.1` (CI runs), review.
3. Tag `v1.2.1-rc.1` on the hotfix branch → UAT (approval), regression of the area.
4. Tag `v1.2.1` → production (approval; emergency change: support manager and the broker's IT head, reviewed at the
   next CAB).
5. Merge the hotfix branch back into `brokerverse-platform` so the next release contains the fix.

## 11. Backups

- Pre-deploy: `release.sh backup` (`pg_dump --format=custom`, checked with `pg_restore --list`, mode 600), the
  newest ten kept on the server, a copy in `BACKUP_S3_URI` (server-side encryption) when set. The server needs
  `postgresql-client-16` and, for the copy, the AWS CLI with an instance role allowed to write to that prefix.
- These are restore points for a release, not the backup plan: daily RDS snapshots (30 days), the upload volume and
  `DATA_ENCRYPTION_KEY` remain as in [README.md](README.md) section 2.

## 12. Configuration comparison and data masking in the pipeline

| Tool | Where it fits |
|---|---|
| Comparison report, `backend/scripts/compare-environments.js` (configuration mirrored check) | After every promotion of configuration: UAT against Pre-Prod before the rehearsal, Pre-Prod (or UAT) against Production before the go/no-go and after each release. Run it from a machine that can reach both APIs; keep its output with the release record. A difference that is not in the approved change list stops the promotion |
| Data masking, `backend/scripts/mask-data.js` | Whenever a database is copied from Production to a lower environment: the temporary Pre-Prod when the rehearsal team may not see personal data, SIT or training copies. Run on the restored copy **before** the environment is opened to users and before `DEPLOY_ENABLED` is set; never on Production |
| Go-live workbench (configuration workbook, Master > Go-Live Data Load) | Moves configuration between environments; its validation of a "Current data" workbook is the on-screen comparison |

Both scripts are owned by their own changes; this pipeline only calls for them at the points above. Neither runs
automatically in `deploy.yml`, because both need decisions (which pair of environments, which data may be seen).

## 13. Servers and platforms

**EC2 (existing host).** `deploy.yml` uses `deploy/ec2/release.sh` over SSH as root (the apps run under root's PM2):

```
/home/ubuntu/appdata/brokerverse/
  releases/<sha>/backend      the API of one build      current -> releases/<sha>
  shared/backend.env          API environment (copied once from backend/.env of the older layout)
  uploads/, backend/uploads/  documents (linked into every release)
  backups/                    pre-deploy backups
  web/releases/<sha>, web/current   front end, only with FRONTEND_TARGET=ec2 (deploy/ec2/nginx-web.conf)
```

The first release-based deployment moves the host from the git-checkout layout of `deploy/ec2/deploy.sh` (still
usable by hand) to this one; `backend/.env` is copied, the API keeps port 8001, `nginx-api.conf` is unchanged. The
first deployment cannot roll back automatically to the git-checkout process; keep `deploy.sh` for that case.

**Docker Compose / any container host.** The web image (`brokerverse/Dockerfile`) is environment-neutral: set
`API_UPSTREAM` and `ENVIRONMENT_NAME` on the container. Tag images with the commit (`brokerverse-web:<sha>`,
`brokerverse-api:<sha>` built with `--build-arg GIT_COMMIT=<sha>`) and deploy the same tags everywhere.

**Railway.** Railway builds from the repository per service ([RAILWAY.md](RAILWAY.md)); the web image is
environment-neutral there too (runtime variables, no rebuild for an address change). For strict build-once on
Railway, push the CI images to a registry and point each Railway environment's service at the image tag, then set
`BACKEND_TARGET=none` and `FRONTEND_TARGET=none` and let `deploy.yml` run the smoke test only.

## 14. Checking locally

```
cd brokerverse && npm run build
API_UPSTREAM=http://127.0.0.1:8000 ENVIRONMENT_NAME=UAT PORT=3000 npm run serve    # label "UAT", /api proxied
API_UPSTREAM=http://127.0.0.1:8000 ENVIRONMENT_NAME= PORT=3001 npm run serve       # same build, production look
APP_URL=http://localhost:3000 ENVIRONMENT_NAME=UAT bash ../deploy/smoke-test.sh
```
