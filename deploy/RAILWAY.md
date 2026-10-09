# Deploying BrokerVerse on Railway

Railway builds straight from the connected GitHub repository (`IortaTexhNXT-DEV/BDOI-OOTB`). One Railway project
holds three services: PostgreSQL, the API (`backend/`) and the web app (`brokerverse/`). Railway no longer reads
`railway.json` files, so the build and health check settings below are entered on each service.

Do the steps in order. Put secrets only in Railway's variables, never in the repository.

## 1. Project and database

1. In Railway, open the project (or create one) and choose **New > Database > PostgreSQL**.
2. When the database is up, open it, go to **Data > Query** (or connect with `psql`) and run once:

   Nothing else is needed on the database. The API sets Manila time on its own connections through the
   `options` part of `DATABASE_URL` (step 2), which reports, cut-off times and scheduled jobs rely on.

## 2. API service (backend)

1. **New > GitHub Repo >** `IortaTexhNXT-DEV/BDOI-OOTB`. Rename the service to `api`.
2. **Settings > Source:** branch `brokerverse-platform`, **Root Directory** `/backend`.
3. **Settings > Build:** Dockerfile path `Dockerfile`. **Settings > Deploy:** healthcheck path `/api/health`,
   healthcheck timeout `300`, restart policy "On failure" (5 retries). The health check answers only after the
   migrations have run.
4. **Volume:** right-click the service > **Attach Volume**, mount path `/app/uploads`. Documents, photos and
   generated reports live here; without a volume they are lost on every deploy.
5. **Variables** (Raw Editor):

   ```
   NODE_ENV=production
   PORT=8000
   DATABASE_URL=${{Postgres.DATABASE_URL}}?options=-c%20TimeZone%3DAsia%2FManila
   JWT_SECRET=<random, at least 32 characters>
   DATA_ENCRYPTION_KEY=<a different random value, at least 32 characters>
   PII_ENCRYPTION_KEY=<a third random value, at least 32 characters>
   ADMIN_PASSWORD=<first password of the BrokerVerse administrator>
   CORS_ORIGINS=https://<web address>
   PUBLIC_BASE_URL=https://<api address>
   UPLOAD_DIR=/app/uploads
   SMTP_URL=smtp://connect%40iortatechnxt.com:<mailbox-password>@smtp.office365.com:587
   SEED_SAMPLE_DATA=false
   SCHEDULER_ENABLED=true
   LOG_LEVEL=info
   RAILWAY_RUN_UID=0
   ```

   - Generate each secret with `openssl rand -hex 32`. Keep `DATA_ENCRYPTION_KEY` safe with the database backups:
     encrypted fields cannot be read without it.
   - `RAILWAY_RUN_UID=0` lets the container write to the Railway volume, which is mounted as root.
   - `CORS_ORIGINS` and `PUBLIC_BASE_URL` are filled in after step 4 gives the addresses. Write several web addresses
     separated by commas (for example the Railway address and the BrokerVerse URL).
   - In the SMTP address, write the `@` of the user name as `%40` and URL-encode special characters of the password.
   - A TISPH environment adds `BRAND_PACK=toyota-insurance-services`: the API enforces the Toyota Insurance Services
     brand pack, enabling it at its first start and applying it again at any later start when the screens differ from
     it (deploy/REFERENCE.md, "Brand pack of the deployment"). Redeploy or restart the API to bring back a branding that
     was changed: the start-up log names what differed.
6. **Settings > Networking > Generate Domain** (target port 8000). Note the address, e.g.
   `https://api-production-xxxx.up.railway.app`.

## 3. Web service (front end)

1. **New > GitHub Repo >** the same repository again. Rename the service to `web`.
2. **Settings > Source:** branch `brokerverse-platform`, **Root Directory** `/brokerverse`.
3. **Settings > Build:** Dockerfile path `Dockerfile.railway` (React build, then nginx on Railway's port with the
   single-page fallback). **Settings > Deploy:** healthcheck path `/`, timeout `120`, restart policy "On failure".
4. **Variables:**

   ```
   PORT=8080
   API_UPSTREAM=http://api.railway.internal:8000
   ENVIRONMENT_NAME=UAT
   ```

   - The build holds no address: the same image serves every Railway environment. When the container starts it writes
     `/env-config.js` and forwards `/api` to `API_UPSTREAM` over Railway's private network, so the browser calls the
     API on the web address itself (no CORS, no public API domain needed). `api` is the API service's name; `8000`
     its `PORT`.
   - Instead of the proxy, `API_BASE_URL=https://<api address>/api` makes the browser call the API service directly
     (then `CORS_ORIGINS` on `api` must list the web address).
   - `ENVIRONMENT_NAME` (`DEV`, `SIT`, `UAT`, `PREPROD`...) shows a small label next to the logo; leave it empty on
     production. `ENVIRONMENT_COLOR=#rrggbb` changes its colour.
   - Changing any of these needs a restart of `web`, not a rebuild.
   - `REACT_APP_BASE_URL` is no longer needed; delete it from older services (if kept, it is only used when no runtime
     address is set).
5. **Settings > Networking > Generate Domain** (target port 8080).

## 4. Connect the two

1. On `api`, set `CORS_ORIGINS` to the web address and `PUBLIC_BASE_URL` to the address the browser uses for the API:
   the web address when `web` forwards `/api` (`API_UPSTREAM`), else the API's own address. Railway redeploys.
2. Open the web address, sign in as `BrokerVerse` with the `ADMIN_PASSWORD`, and change the password when asked.
3. Continue with the smoke tests and go-live data in [README.md](README.md) sections 4 and 6.

## 5. The existing BrokerVerse URL

To serve BrokerVerse on the existing address (for example `brokerverse-dev.inxtuniverse.com`):

1. On `web`, **Settings > Networking > Custom Domain**, enter the address and create the CNAME record Railway shows at
   your DNS provider. Remove the old record that points to CloudFront.
2. Optionally give `api` its own custom domain the same way (for example `brokerverse-api-dev.inxtuniverse.com`).
3. Update the variables: `CORS_ORIGINS` on `api` (add the custom web address) and `PUBLIC_BASE_URL` on `api`; with
   `API_UPSTREAM` nothing changes on `web`. With `API_BASE_URL` on `web`, set the new API address and restart `web`
   (no rebuild).

## Loading UAT data

`backend/scripts/uat-scenario.js` loads six months of synthetic broking business (personas, insurers, retail and
corporate clients, placements, billing, claims, renewals, remittances, reconciliations, month-end closes) through the
public API of a running `api` service. It needs nothing but Node, so it runs as a one-off service built from the same
repository; no Dockerfile is added. Run it once, on a UAT environment only, never on production data.

1. **New > GitHub Repo >** the same repository. Rename the service to `uat-loader`.
2. **Settings > Source:** branch `brokerverse-platform`, **Root Directory** `/backend` (the same folder as `api`; its
   build is reused and the script is part of it).
3. **Settings > Deploy:**
   - **Custom Start Command:** `node scripts/uat-scenario.js`
   - **Restart Policy:** Never (the script ends when the data is loaded; a restart would only find the data already
     there).
   - No healthcheck path, no volume, no public domain: the service only calls `api` over the private network.
4. **Variables** (Raw Editor):

   ```
   API_BASE=http://api.railway.internal:8000/api
   ADMIN_USER=BrokerVerse
   ADMIN_PASSWORD=<current password of the BrokerVerse administrator>
   PERSONA_PASSWORD=<password for the persona users the script creates>
   UAT_SEED=brokerverse-uat
   UAT_SCALE=1
   UAT_REPORT=none
   ```

   - `ADMIN_PASSWORD` is the administrator's password as it is now (it may have been changed since the first
     sign-in). `${{api.ADMIN_PASSWORD}}` can be used when it has not.
   - `PERSONA_PASSWORD` must meet the password policy (8 characters or more, upper and lower case, a digit and a
     symbol). The personas (`uat.maria.sales`, `uat.jose.processing`, `uat.liza.accounting`, `uat.teresa.manager`
     and the others) sign in with it; give it to the UAT testers.
   - `api.railway.internal` is the private address of the `api` service (rename it if the API service has another
     name); the port is the `PORT` of `api`.
   - `UAT_SCALE=2` doubles the volume; `UAT_SEED` changes the names and amounts.
5. **Deploy.** Follow the deploy logs: every step is printed, failed steps with the API call and the answer, then the
   counts per entity. The run takes a few minutes. The service ends with exit code 0 when every step passed.
6. **Delete the `uat-loader` service** afterwards (**Settings > Danger > Delete Service**). The data stays in the
   database. Running it again is harmless: an inactive client named `UAT-MARKER` records the completed run, and a second
   run only signs in, checks the masters and runs the reports.

## Checks when something is wrong

| What you see | Cause and fix |
|---|---|
| `api` deploy stays on "health check" and fails | Look at the deploy logs. Usually a missing variable (the API refuses to start in production without `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`) or `DATABASE_URL` not pointing at the Postgres service. |
| `EACCES` on `/app/uploads` in the logs | `RAILWAY_RUN_UID=0` is missing on `api`. |
| Blank page, `%PUBLIC_URL%` errors in the browser console | The unbuilt source is served. Check the `web` service has Dockerfile path `Dockerfile.railway` and root directory `/brokerverse`, not a Railpack or static build of the folder. |
| Login page shows but sign-in fails with a network or CORS error | With `API_UPSTREAM`: the API service name or port is wrong (`http://<api service>.railway.internal:<PORT>`); the `web` log shows the proxy error. With `API_BASE_URL`: it must end in `/api` and the web address must be in `CORS_ORIGINS` on `api`. Open `<web address>/env-config.js` to see what the app uses. |
| The environment label (UAT, SIT...) is missing or wrong | `ENVIRONMENT_NAME` on `web`; restart `web`. A browser keeping an old `/env-config.js` is excluded: it is sent with `no-store`. |
| Refreshing a page other than the home page gives 404 | The `web` service is not using `Dockerfile.railway`, whose nginx serves `index.html` for every address. |

Releases, promotion between Railway environments and rollback follow [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md)
(section 13 for Railway). Railway runs one `api` instance. The scheduler and migrations are safe with more, but documents are on the volume,
which Railway attaches to one instance only.

## Deploys paused

A new Railway account on the free tier can get "Deploys have been paused temporarily" when Railway is busy. Builds
already queued run later; new services cannot be created until the pause lifts. The Pro plan is not paused.
