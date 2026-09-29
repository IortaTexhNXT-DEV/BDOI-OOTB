# Deploying BrokerVerse on Railway

Railway builds straight from the connected GitHub repository (`IortaTexhNXT-DEV/BDOI-OOTB`). One Railway project
holds three services: PostgreSQL, the API (`backend/`) and the web app (`brokerverse/`). Each code service has its
own `railway.json` in its folder, so Railway picks up the build and health check settings from the repository.

Do the steps in order. Put secrets only in Railway's variables, never in the repository.

## 1. Project and database

1. In Railway, open the project (or create one) and choose **New > Database > PostgreSQL**.
2. When the database is up, open it, go to **Data > Query** (or connect with `psql`) and run once:

   ```sql
   ALTER DATABASE railway SET timezone TO 'Asia/Manila';
   ```

   Use the database name shown in the `PGDATABASE` variable if it is not `railway`. Reports, cut-off times and
   scheduled jobs expect Manila time.

## 2. API service (backend)

1. **New > GitHub Repo >** `IortaTexhNXT-DEV/BDOI-OOTB`. Rename the service to `api`.
2. **Settings > Source:** branch `brokerverse-platform`, **Root Directory** `/backend`.
3. **Settings > Config-as-code:** file path `/backend/railway.json`. It builds `backend/Dockerfile` and waits for
   `/api/health` (answers only after the migrations have run).
4. **Volume:** right-click the service > **Attach Volume**, mount path `/app/uploads`. Documents, photos and
   generated reports live here; without a volume they are lost on every deploy.
5. **Variables** (Raw Editor):

   ```
   NODE_ENV=production
   PORT=8000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<random, at least 32 characters>
   DATA_ENCRYPTION_KEY=<a different random value, at least 32 characters>
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
6. **Settings > Networking > Generate Domain** (target port 8000). Note the address, e.g.
   `https://api-production-xxxx.up.railway.app`.

## 3. Web service (front end)

1. **New > GitHub Repo >** the same repository again. Rename the service to `web`.
2. **Settings > Source:** branch `brokerverse-platform`, **Root Directory** `/brokerverse`.
3. **Settings > Config-as-code:** file path `/brokerverse/railway.json`. It builds `brokerverse/Dockerfile.railway`
   (React build, then nginx on Railway's port with the single-page fallback).
4. **Variables:**

   ```
   REACT_APP_BASE_URL=https://<api address>/api
   PORT=8080
   ```

   The address is baked into the build. The build stops if it is missing, and it must be rebuilt (Redeploy) whenever
   the API address changes.
5. **Settings > Networking > Generate Domain** (target port 8080).

## 4. Connect the two

1. On `api`, set `CORS_ORIGINS` to the web address and `PUBLIC_BASE_URL` to the API address. Railway redeploys.
2. Open the web address, sign in as `BrokerVerse` with the `ADMIN_PASSWORD`, and change the password when asked.
3. Continue with the smoke tests and go-live data in [README.md](README.md) sections 4 and 6.

## 5. The existing BrokerVerse URL

To serve BrokerVerse on the existing address (for example `brokerverse-dev.inxtuniverse.com`):

1. On `web`, **Settings > Networking > Custom Domain**, enter the address and create the CNAME record Railway shows at
   your DNS provider. Remove the old record that points to CloudFront.
2. Optionally give `api` its own custom domain the same way (for example `brokerverse-api-dev.inxtuniverse.com`).
3. Update the variables: `CORS_ORIGINS` on `api` (add the custom web address), `PUBLIC_BASE_URL` on `api` if the API
   has a custom domain, and `REACT_APP_BASE_URL` on `web`, then redeploy `web` so the build takes the new address.

## Checks when something is wrong

| What you see | Cause and fix |
|---|---|
| `api` deploy stays on "health check" and fails | Look at the deploy logs. Usually a missing variable (the API refuses to start in production without `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`) or `DATABASE_URL` not pointing at the Postgres service. |
| `EACCES` on `/app/uploads` in the logs | `RAILWAY_RUN_UID=0` is missing on `api`. |
| Blank page, `%PUBLIC_URL%` errors in the browser console | The unbuilt source is served. Check the `web` service uses `/brokerverse/railway.json` (Dockerfile.railway), not a Nixpacks or static build of the folder. |
| Login page shows but sign-in fails with a network or CORS error | `REACT_APP_BASE_URL` on `web` is wrong (must end in `/api`, rebuild after a change) or the web address is not in `CORS_ORIGINS` on `api`. |
| Refreshing a page other than the home page gives 404 | The `web` service is not using `Dockerfile.railway`, whose nginx serves `index.html` for every address. |

Railway runs one `api` instance. The scheduler and migrations are safe with more, but documents are on the volume,
which Railway attaches to one instance only.
