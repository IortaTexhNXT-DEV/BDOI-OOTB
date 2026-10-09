# Deploying BrokerVerse on Microsoft Azure (TISPH)

TISPH hosts BrokerVerse on its own Azure subscription (BRD TIS-BRD-INTG-06, NFR-06.1). Four environments, DEV, SIT,
UAT and PROD, are built from the same Terraform code with different sizes (NFR-08, NFR-19.1), and the same container
images are promoted from one to the next (NFR-19). This page is the runbook: first set-up, releases, rollback,
backups and disaster recovery, and the Microsoft 365 pieces (sign-in, e-mail).

Do the sections in order the first time. Secrets go only into each environment's Key Vault, never into the
repository, the tfvars or GitHub.

## What runs where

```
browser -> Azure Front Door Premium (TLS, custom domain, WAF)
        -> web container app (nginx; public ingress, answers only requests that came through Front Door)
        -> /api over the Container Apps environment's internal network
        -> api container app (Node.js; internal ingress only, no public address)
              -> PostgreSQL 16 Flexible Server (private access, delegated subnet)
              -> Azure Files share "uploads" mounted at /app/uploads (private endpoint)
              -> Key Vault secrets (managed identity, private endpoint)
migrate: Container Apps job with the API image, run by the pipeline before each release
```

| Piece | Folder | Notes |
|---|---|---|
| Remote state | `deploy/azure/bootstrap` | one storage account for every Terraform state, applied once by hand |
| Container registry | `deploy/azure/shared` | one Premium registry for all environments, replicated to East Asia |
| One environment | `deploy/azure/environment` + `deploy/azure/modules/environment` | `environments/<env>.tfvars` and `<env>.backend.hcl` per environment |
| Pipeline | `.github/workflows/azure-deploy.yml`, `azure-deploy-environment.yml` | build once, approve, promote by digest |
| Revision helper | `deploy/azure/wait-for-revision.sh` | switch an app to an image and wait until it serves |

**Why Container Apps and not AKS.** BrokerVerse is two stateless containers, a scheduled-job runner inside the API
and a one-shot migration job. Container Apps gives that with managed ingress, revisions, scale rules, Key Vault
references and zone redundancy, without a Kubernetes cluster to patch, upgrade and staff. It runs the same Docker
images (NFR-19); if TISPH later standardises on AKS the images, probes and variables carry over unchanged.

## 1. Prerequisites

- An Azure subscription for BrokerVerse and an account with **Owner** on it (Terraform creates role assignments)
  for the first apply. Later applies need Contributor and User Access Administrator.
- Resource providers registered once: `Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.DBforPostgreSQL`,
  `Microsoft.Cdn`, `Microsoft.KeyVault`, `Microsoft.Storage`, `Microsoft.OperationalInsights`, `Microsoft.Insights`,
  `Microsoft.RecoveryServices`, `Microsoft.Network`, `Microsoft.ManagedIdentity`:

  ```
  for p in App ContainerRegistry DBforPostgreSQL Cdn KeyVault Storage OperationalInsights Insights RecoveryServices Network ManagedIdentity; do
    az provider register --namespace Microsoft.$p
  done
  ```
- On the operator's machine: Terraform 1.9 or later, Azure CLI 2.60 or later (`az login`), Docker (or use
  `az acr build`).
- From TISPH IT: the tenant ID, the custom domain names, the public IP ranges of the operators (they are let through
  the Key Vault and storage firewalls), the operations mailbox for alerts, the Entra ID group that manages secrets,
  the SMTP mailbox (section 7) and the SAP and bank SFTP details (section 11).

## 2. Remote state (once)

```
cd deploy/azure/bootstrap
terraform init
terraform apply -var="subscription_id=<subscription>" -var='allowed_ips=["<operator IP>/32"]'
```

The output `backend_config` gives the storage account name. Put it in `deploy/azure/shared/shared.backend.hcl`
(copy from `shared.backend.hcl.example`) and in each `deploy/azure/environment/environments/<env>.backend.hcl`.
The account has no shared keys: every operator who runs Terraform needs **Storage Blob Data Contributor** on it
(the bootstrap gives it to the person who ran it). Keep `bootstrap/terraform.tfstate` in the team's password vault.

## 3. Shared registry (once)

```
cd deploy/azure/shared
cp shared.tfvars.example shared.tfvars          # subscription, region, replica region
terraform init -backend-config=shared.backend.hcl
terraform apply -var-file=shared.tfvars
```

Note the outputs `acr_id` and `acr_login_server`, and set the repository variable **ACR_NAME** in GitHub
(Settings > Secrets and variables > Actions > Variables) to the registry name (the part before `.azurecr.io`).

## 4. First deployment of an environment

Repeat for `dev`, `sit`, `uat` and `prod`, in that order.

1. **Fill the tfvars.** In `deploy/azure/environment/environments/<env>.tfvars` replace every value marked `TISPH`
   and the registry placeholders with the outputs of section 3. Variables are listed in section 5.
2. **Put a first pair of images in the registry.** Terraform creates the apps with `api_image` / `web_image`; the
   pipeline replaces them on every release. For the very first environment build them once from the commit to
   deploy:

   ```
   ACR=<registry name>; SHA=$(git rev-parse HEAD)
   az acr build -r $ACR -t brokerverse-api:bootstrap --build-arg GIT_COMMIT=$SHA backend
   az acr build -r $ACR -t brokerverse-web:bootstrap brokerverse
   ```

   Later environments can start from any image the pipeline already pushed (`brokerverse-api:<sha>`).
3. **Apply.**

   ```
   cd deploy/azure/environment
   terraform init -reconfigure -backend-config=environments/<env>.backend.hcl
   terraform plan -var-file=environments/<env>.tfvars -out <env>.plan
   terraform apply <env>.plan
   ```

   The first apply takes 30 to 60 minutes (PostgreSQL with high availability and Front Door are the slow parts). Run
   it from an address listed in `operator_ips`: Terraform writes the generated secrets into Key Vault.
4. **Secrets an operator adds** (section 6): `smtp-url` when `smtp_enabled = true`, `entra-client-secret` when
   `entra_sign_in.enabled = true`. Then restart the API so it reads them:
   `az containerapp revision restart -g rg-tisph-bv-<env> -n ca-tisph-bv-<env>-api --revision <latest>` (or deploy).
5. **DNS** (section 8), then open the address, sign in as `BrokerVerse` with the `admin-password` secret
   (`az keyvault secret show --vault-name <key_vault_name> -n admin-password --query value -o tsv`) and choose a new
   password when asked. The site already shows the Toyota Insurance Services branding: the API enforces the bundled
   brand pack named by `BRAND_PACK`, enabling it at its first start and applying it again at any start where the
   screens differ from it (REFERENCE.md, "Brand pack of the deployment"); GET /api/branding/packs/bundled shows the
   enablement by `system`.
6. **GitHub environment** (section 9): copy the output `github_variables` into the environment's variables and set
   `DEPLOY_ENABLED=true`.
7. Continue with the smoke tests and go-live data of [README.md](README.md), sections 4 to 6, and the security
   settings of section 13 below.

Terraform does not change the running images after creation, so a later `terraform apply` (a size change, a new
alert address) never rolls an environment back.

## 5. Variables

Set in `environments/<env>.tfvars`. Defaults are in `deploy/azure/modules/environment/variables.tf`.

| Variable | DEV | SIT | UAT | PROD | Meaning |
|---|---|---|---|---|---|
| `address_space` | 10.40.0.0/16 | 10.41.0.0/16 | 10.42.0.0/16 | 10.43.0.0/16 | virtual network of the environment; must not overlap TISPH's ranges if it is ever peered |
| `public_host_name` | TISPH | TISPH | TISPH | TISPH | the address users open (section 8); empty uses `*.azurefd.net` |
| `environment_label` | DEV | SIT | UAT | empty | label next to the logo |
| `postgres_sku` | B_Standard_B2s | B_Standard_B2s | GP_Standard_D2ds_v5 | GP_Standard_D4ds_v5 | database compute |
| `postgres_backup_retention_days` | 7 | 7 | 14 | 35 | point-in-time restore window |
| `postgres_high_availability` | no | no | no | yes | zone-redundant standby, automatic failover |
| `postgres_geo_redundant_backup` | no | no | no | yes | backups copied to East Asia (cannot be changed after creation) |
| `zone_redundant` | no | no | no | yes | Container Apps environment across zones |
| `api` / `web` | 1 replica | 1-2 | 1-2 | 2-6 / 2-4 | CPU, memory and replicas |
| `uploads_replication` | LRS | LRS | ZRS | GZRS | redundancy of the documents share |
| `uploads_backup` | no | no | yes | yes | Azure Backup of the share every 4 hours |
| `smtp_enabled` | no | yes | yes | yes | pass `SMTP_URL` to the API (section 7) |
| `entra_sign_in` | off | off | on | on | sign-in with Microsoft (section 14) |
| `sftp_enabled`, `sftp_users`, `sftp_allowed_ips` | off | on | on | on | SFTP for SAP and bank files (section 11) |
| `waf_mode` | Detection | Prevention | Prevention | Prevention | Front Door WAF; Detection only logs |
| `sign_in_rate_limit_per_minute` | 60 | 60 | 60 | 60 | Front Door limit on `/api/auth/` per client address |
| `trust_proxy` | 4 | 4 | 4 | 4 | `TRUST_PROXY` of the API (section 13) |
| `brand_pack` | toyota-insurance-services | toyota-insurance-services | toyota-insurance-services | toyota-insurance-services | `BRAND_PACK` of the API: the Toyota Insurance Services brand pack is enforced at every start (default empty: none) |
| `key_vault_admins` | TISPH | TISPH | TISPH | TISPH | Entra ID group that manages secrets |
| `operator_ips` | TISPH | TISPH | TISPH | TISPH | addresses allowed through the Key Vault and storage firewalls |
| `alert_emails` | TISPH | TISPH | TISPH | TISPH | availability and database alerts |
| `github_environment` | azure-dev | azure-sit | azure-uat | azure-prod | GitHub environment trusted by the federated credential |
| `github_can_push_images` | yes | no | no | no | only the dev deployment builds and pushes images |

The API receives the settings of [REFERENCE.md](REFERENCE.md) from Terraform: `NODE_ENV=production`,
`UPLOAD_DIR=/app/uploads`, `CORS_ORIGINS` and `PUBLIC_BASE_URL` set to the public address (the browser reaches the API
on the web address, `/api` is proxied), `SEED_SAMPLE_DATA=false`, `SCHEDULER_ENABLED=true`, `APP_ENVIRONMENT`,
`TRUST_PROXY`, `BRAND_PACK` when `brand_pack` is set, and the `ENTRA_*` variables when sign-in with Microsoft is on. The web app receives `API_UPSTREAM`
(the API's internal address), `ENVIRONMENT_NAME` and `FRONT_DOOR_ID`.

## 6. Secrets

All in the environment's Key Vault (`kv-tisphbv<env>-xxxxx`), read by the containers through the managed identity
`id-tisph-bv-<env>-app`. A new secret version reaches the API at its next revision or restart.

| Secret | Created by | Variable |
|---|---|---|
| `database-url` | Terraform, from the generated `postgres-password` (TLS verified, `TimeZone=Asia/Manila` on every connection) | `DATABASE_URL` |
| `jwt-secret`, `data-encryption-key`, `pii-encryption-key` | Terraform, once (64 random characters each) | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY` |
| `admin-password` | Terraform, once | `ADMIN_PASSWORD` (first password of `BrokerVerse`) |
| `smtp-url` | operator (section 7) | `SMTP_URL` |
| `entra-client-secret` | operator (section 14) | `ENTRA_CLIENT_SECRET` |

```
az keyvault secret set --vault-name <key_vault_name> -n smtp-url --value '<value>'
```

Terraform leaves the values of the first five alone after creation, so they can be rotated in Key Vault (follow
[REFERENCE.md](REFERENCE.md) for `PII_ENCRYPTION_KEY`). `data-encryption-key` and `pii-encryption-key` must stay with
the database backups: without them two-factor secrets and personal identifiers cannot be read. Key Vault keeps
deleted secrets 90 days, and production's vault is purge-protected.

## 7. E-mail (INTG-01)

System e-mails (approval links, reset codes, reminders) leave through an authenticated SMTP relay with TISPH's own
identities (e.g. `no-reply@` and `support@` on the TISPH domain):

1. TISPH creates the mailbox(es) in Microsoft 365 and allows **Authenticated SMTP** on the sending mailbox (Microsoft
   365 admin center > Users > the mailbox > Mail > Manage email apps). If TISPH prefers a relay connector or another
   relay, use its host and port instead.
2. Store the address in Key Vault, writing `@` of the user as `%40` and URL-encoding the password:

   ```
   smtp://no-reply%40<tisph domain>:<password>@smtp.office365.com:587
   ```
3. `smtp_enabled = true` in the tfvars, apply, then in BrokerVerse set **Master > Configuration**
   `notification.from_address` to the same identity (e.g. `TISPH BrokerVerse <no-reply@...>`) and turn
   `notification.email_enabled` on.

Port 587 with STARTTLS works from Container Apps; outbound port 25 is blocked by Azure.

## 8. Custom domain and TLS

1. Apply with `public_host_name` set (e.g. `brokerverse-uat.<tisph domain>`). Terraform adds the domain to Front Door
   with a managed certificate (renewed by Azure).
2. In TISPH's DNS create:
   - `TXT _dnsauth.<host>` = output `custom_domain_validation_token`
   - `CNAME <host>` = output `front_door_endpoint_host`
3. Validation and the certificate take up to an hour; the Front Door domain then shows *Approved* and the site opens
   on the custom address. `CORS_ORIGINS`, `PUBLIC_BASE_URL`, the Entra redirect address and the availability test all
   follow `public_host_name`.

TLS 1.2 is the minimum. Front Door adds `Strict-Transport-Security` and redirects http to https.

## 9. Releases: DEV -> SIT -> UAT -> PROD

**GitHub set-up (repository owner, once):**

1. Settings > Environments: create `azure-dev`, `azure-sit`, `azure-uat`, `azure-prod`. On `azure-sit`, `azure-uat`
   and `azure-prod` add required reviewers (TISPH's release approvers; production: TISPH IT and the business owner)
   and limit deployment branches to `TISPH-DEV`.
2. In each environment add the variables of the Terraform output `github_variables` (`AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `API_APP_NAME`, `WEB_APP_NAME`,
   `MIGRATE_JOB_NAME`, `APP_URL`), `ENVIRONMENT_NAME` (`DEV`, `SIT`, `UAT`; empty in production) and
   `DEPLOY_ENABLED=true`.
3. Repository variable `ACR_NAME` (section 3). No secret is needed: each job signs in to Azure with OpenID Connect,
   trusted only for its own GitHub environment.

**What happens on a push to `TISPH-DEV`** (`azure-deploy.yml`):

1. The API and web images are built once, tagged with the commit and pushed; from here on they are addressed by
   digest, so every environment runs exactly the bytes DEV ran.
2. DEV: the migration job runs with the new API image (migrations and the reference seed, both idempotent), then the
   API and the web app switch. Each new revision takes traffic only when its readiness check (`/api/health`) passes;
   the old one drains (the API stops on SIGTERM within 25 seconds). Then `deploy/smoke-test.sh` checks the health,
   the running commit, the sign-in page and `env-config.js` through Front Door.
3. SIT, UAT and production each wait for approval in the run's page, then do the same with the same digests. They
   refuse a commit whose CI run (`ci.yml`) did not pass.

A failed smoke test puts the previous images back automatically. Migrations are forward-only and stay applied;
follow [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md), section 8 (expand, then contract) so the previous release still
runs on the new schema.

Pending approvals of older runs can be rejected; approving an old run deploys that older build.

## 10. Rollback

- **Automatic:** see section 9.
- **To an earlier release:** Actions > **Azure deploy** > Run workflow: environment, the commit SHA of the release to
  go back to, mode **rollback** (no migrations; the images of that commit by digest).
- **By hand** (pipeline unavailable):

  ```
  az containerapp revision list -g rg-tisph-bv-<env> -n ca-tisph-bv-<env>-api -o table   # earlier revisions and images
  bash deploy/azure/wait-for-revision.sh rg-tisph-bv-<env> ca-tisph-bv-<env>-api <registry>/brokerverse-api@sha256:<digest>
  bash deploy/azure/wait-for-revision.sh rg-tisph-bv-<env> ca-tisph-bv-<env>-web <registry>/brokerverse-web@sha256:<digest>
  ```

A database restore is not a rollback tool: it loses every transaction since the restore point. Use it only for data
damage (section 12).

## 11. SFTP for SAP and bank files (INTG-04, NFR-09)

With `sftp_enabled = true` each environment gets an Azure Storage account with SFTP and three containers:
`sap-outbound` (daily SAP text files, picked up by SAP), `bank-inbound` (statements dropped by the banks) and
`bank-outbound` (payment files for the banks).

1. TISPH collects the SSH public key of each partner account and their public IP addresses.
2. Add them to the tfvars and apply:

   ```
   sftp_users = {
     sap = { ssh_public_key = "ssh-rsa AAAA... sap", container = "sap-outbound", write = false }
     bpi = { ssh_public_key = "ssh-ed25519 AAAA... bpi", container = "bank-inbound", write = true }
   }
   sftp_allowed_ips = ["203.0.113.10/32"]
   ```
3. Partners connect with `sftp <account>.<user>@<account>.blob.core.windows.net` (output `sftp_host`), key only, on
   port 22. Passwords are disabled.

The API's managed identity has **Storage Blob Data Contributor** on the account and reaches it through a private
endpoint.

**SAP GL files (INTG-04 item 1).** The job `sap-gl-export` (Master > Schedules, 11:59 PM Manila) and Accounts > SAP GL
Export write the day's header and line files (`ARHDTISPH<date>.txt`, `ARLITISPH<date>.txt`; layout in the setting
`sap_gl.layout`, see `backend/src/modules/sap-gl/README.md`) to `SAP_GL_EXPORT_DIR` when the API has that variable,
else to the folder `sap_gl.folder` (default `sap-outbound`) of `UPLOAD_DIR`, that is `/app/uploads/sap-outbound` on the
documents share. Container Apps mount Azure Files shares, not Blob containers, so the files reach the SFTP container
`sap-outbound` in one of two ways, to be chosen with TISPH IT:

- a copy after the cut-off, for example an Azure Container Apps job or Automation runbook running
  `azcopy sync "https://<documents account>.file.core.windows.net/uploads/sap-outbound" "https://<sftp account>.blob.core.windows.net/sap-outbound"`
  with the managed identity, a few minutes after 11:59 PM;
- or an Azure Files share that SAP collects from, mounted in the API container and named in `SAP_GL_EXPORT_DIR`.

Every run also keeps its files in the database: Accounts > SAP GL Export downloads them as written, and **Run now**
re-generates a day (the files are written again under the same names). The bank files can be moved with Azure Storage
Explorer or `az storage blob upload --auth-mode login`.

## 12. Backups, restore and disaster recovery (RPO 1 hour, RTO 4 hours)

| What | Protection | Recovery point |
|---|---|---|
| Database | continuous backup, point-in-time restore to any second in the retention window (35 days in production); zone-redundant standby with automatic failover (about 60-120 seconds) | seconds within the region |
| Database, region lost | geo-redundant backup in East Asia, geo-restore | under 1 hour (Azure's stated geo-restore RPO) |
| Documents share | GZRS (synchronous across zones, asynchronous to East Asia), soft delete 30 days, Azure Backup every 4 hours | zone: none lost; region: typically under 15 minutes |
| Secrets | Key Vault soft delete 90 days, purge protection in production | none lost |
| Images | registry zone-redundant and replicated to East Asia | none lost |
| Infrastructure | Terraform in this repository, state versioned in RA-GZRS | rebuilt from code |

**Restore the database to a point in time** (data damage, e.g. a wrong bulk update at 14:05 Manila time):

```
az postgres flexible-server restore -g rg-tisph-bv-prod --name psql-restore-<date> \
  --source-server <postgres_server_name> --restore-time "2026-11-03T06:00:00Z"
```

The copy is created in the same delegated subnet. Compare or copy back the affected rows with `psql` from a
container in the environment (`az containerapp exec -n ca-tisph-bv-prod-api -g rg-tisph-bv-prod --command sh`), or,
for a full switch, point `database-url` at the restored server and restart the API. Delete the copy afterwards.

**Restore documents:** Azure portal > the recovery services vault > Backup items > Azure Storage (Azure Files) >
uploads > Restore share or Restore files (single files or folders, to the original or another location). Files
deleted within 30 days can also be undeleted from the share's soft delete.

**Regional disaster (production):**

1. Declare the disaster (TISPH IT). Target: service back within 4 hours.
2. Build the environment in East Asia from the same code: copy `prod.tfvars` to `prod-dr.tfvars` with
   `location = "eastasia"`, another `address_space` and `api_image` / `web_image` set to the production digests (the
   registry's East Asia replica serves them), and a `prod-dr.backend.hcl` with key `prod-dr.tfstate`. Apply (about
   an hour; the empty database it creates is not used).
3. Geo-restore the production database into the new network:

   ```
   az postgres flexible-server geo-restore -g rg-tisph-bv-prod -n psql-tisph-bv-prod-dr \
     --source-server <production server resource ID> -l eastasia \
     --vnet vnet-tisph-bv-prod --subnet snet-database --private-dns-zone <tisph-bv-prod.private.postgres.database.azure.com zone ID>
   ```
4. Set the new vault's `database-url` to the restored server (same user and password as production) and copy
   `jwt-secret`, `data-encryption-key`, `pii-encryption-key` from production's vault backup (the encrypted data needs
   the same keys). Fail the documents storage account over to East Asia (`az storage account failover`) and copy the
   share into the new environment's share with `azcopy`, or attach it. Restart the API.
5. Move the custom domain to the new Front Door profile (CNAME and TXT, section 8) and run `deploy/smoke-test.sh`.

Keep an offline copy of production's three keys (`az keyvault secret backup`) with the DR documents: Key Vault itself
is regional.

**DR drill (twice a year, and before go-live):** on UAT, restore the database to a point one hour back, start a copy
of the API against it (`az containerapp job start` of the migration job pointed at the copy proves the schema is
current), restore a documents folder from Azure Backup, time every step and record the achieved RPO and RTO in the
go-live checklist. For production, rehearse the geo-restore into East Asia without switching traffic and delete the
copy afterwards.

## 13. Security settings for TISPH

- **Sign-in protection** (NFR-03, SEC-04), Master > Configuration: `limits.max_login_attempts` = 5 (the account is
  locked after five failures; an administrator unlocks it), `security.login_rate_limit` (per address and user, in
  the API), `limits.session_idle_minutes` = 3, and Front Door's own limit on `/api/auth/` (section 5). The API keeps
  its rate-limit counters per replica, so with two replicas a client gets up to twice the allowance; the Front Door
  limit applies across replicas.
- **MFA for every user** (NFR-04): with sign-in with Microsoft, enforce MFA in a Conditional Access policy on the
  BrokerVerse app registration (section 14, step 6). For the local accounts that keep password
  sign-in, list their roles in `security.require_2fa_roles`.
- **Client addresses:** the API sees the browser's address through Front Door, the web app's ingress, nginx and its
  own ingress, so `TRUST_PROXY=4`. After the first deployment sign in once and check Profile > Sign-in history shows
  your public address; if it shows a 10.x or Microsoft address, adjust `trust_proxy` by one and apply.
- **WAF:** DEV runs in Detection. Watch `FrontDoorWebApplicationFirewallLog` in Log Analytics while SIT is tested; a
  rule that blocks a legitimate screen (large JSON bodies of quotations or imports are the usual case) gets an
  exclusion in `frontdoor.tf` before UAT, rather than turning the WAF off.
- **The origin:** the web app's own `*.azurecontainerapps.io` address answers 403 to anything that did not come
  through this environment's Front Door (header `X-Azure-FDID` checked by nginx), and the API has no public address.
- **Pre-go-live scans** (NFR-02.1): run the VA/MBSS scans against the UAT address through Front Door.

## 14. Sign-in with Microsoft Entra ID (INTG-02, SEC-05)

BrokerVerse signs staff in with their Microsoft 365 account (OpenID Connect, authorization code flow with PKCE). The
API checks the ID token itself (tenant signing keys, issuer, audience, nonce) and matches the account to a BrokerVerse
user by e-mail address or user ID (user principal name). Users are not created by the sign-in: they are set up in
Master > User Management with their Microsoft 365 address as e-mail (or as user ID), so roles stay under
BrokerVerse's maker-checker. The first sign-in binds the Microsoft account to the user; another account with the
same address is refused later.

**App registration (TISPH Entra ID administrator), per environment or one for all:**

1. Entra admin center > App registrations > New registration: name `BrokerVerse <ENV>`, *Accounts in this
   organizational directory only*, redirect URI platform **Web**: `https://<public host>/login`.
2. Certificates & secrets > New client secret (24 months; note the expiry in the operations calendar). Store the
   value: `az keyvault secret set --vault-name <key_vault_name> -n entra-client-secret --value '<secret>'`.
3. Token configuration > Add optional claim > ID token > `email` (and `upn`).
4. API permissions: Microsoft Graph delegated `openid`, `profile`, `email` (present by default) > Grant admin consent.
5. Enterprise applications > `BrokerVerse <ENV>` > Properties: **Assignment required = Yes**; Users and groups: add
   the BrokerVerse staff group. Only assigned staff can sign in (SEC-05).
6. Protection > Conditional Access > New policy: users = the staff group, target resource = `BrokerVerse <ENV>`,
   grant = **Require multifactor authentication** (NFR-04).
7. In the tfvars: `entra_sign_in = { enabled = true, tenant_id = "<tenant>", client_id = "<application (client) ID>" }`
   and apply. The sign-in page then shows **Sign in with Microsoft**.

**Production users and demo accounts (SEC-05):**

1. Load the licensed users (Master > User Management, or the go-live workbook) with their Microsoft 365 address.
2. Disable every demo or sample account (production is seeded without sample data, `SEED_SAMPLE_DATA=false`).
3. Master > Configuration: `security.password_sign_in_enabled` = off. Staff then sign in only with Microsoft. The
   roles in `security.password_sign_in_roles` (default: System Administrator) keep the user ID and password form
   behind a link on the sign-in page, as the break-glass route if Microsoft sign-in is unavailable; give that
   account a long password and two-factor authentication.
4. `security.sso_register_users` stays off in production. When on, an unknown Microsoft account is registered as an
   inactive user without roles for an administrator to complete.

Local two-factor and password expiry do not apply to a Microsoft sign-in (MFA and password policy are Entra ID's);
locked or inactive users, the sign-in rate limit, the sign-in history, the audit trail, idle time-out and sessions
apply as for any sign-in.

## 15. Monitoring and the 99.9% target (NFR-15)

- Application Insights runs `GET /api/health` through Front Door every 5 minutes from five locations; an alert goes
  to `alert_emails` when two locations fail. The availability report (Application Insights > Availability) is the
  monthly 99.9% figure; the TLS certificate is checked too (alert 14 days before expiry).
- Database alerts: CPU, memory and storage above their thresholds.
- Logs: Log Analytics workspace `log-tisph-bv-<env>`: `ContainerAppConsoleLogs_CL` (API JSON logs, one line per
  request with its `x-request-id`), `ContainerAppSystemLogs_CL` (revisions, probes, restarts), Front Door access and
  WAF logs, PostgreSQL logs (statements slower than 2 seconds), Key Vault audit.

Production runs at least two API and two web replicas in a zone-redundant environment, a zone-redundant database with
automatic failover and zone-redundant storage, so the loss of one zone does not stop the service.

## Checks when something is wrong

| What you see | Cause and fix |
|---|---|
| Terraform: `403` from Key Vault or storage | The address running Terraform is not in `operator_ips`; add it and apply, or run from an allowed network. |
| The API revision never becomes ready | `ContainerAppConsoleLogs_CL` for the revision: usually a Key Vault secret that does not exist yet (`smtp-url`, `entra-client-secret`) or the production start-up check (REFERENCE.md). `ContainerAppSystemLogs_CL` shows probe failures. |
| `EACCES` on `/app/uploads` | The share is not mounted with `uid=1000,gid=1000` (the image runs as `node`); check the volume's mount options. |
| `self-signed certificate` / `unable to verify` on the database | `database-url` must use the server's `*.postgres.database.azure.com` name, not an IP address. |
| Site answers 403 on every page | Requests are not coming through this environment's Front Door: `FRONT_DOOR_ID` on the web app must equal the Front Door profile ID (Terraform sets it). |
| Sign-in page loads, sign-in fails with 502/504 | `API_UPSTREAM` on the web app must be `https://<api internal FQDN>`; the web app's log shows the nginx error. |
| `Sign in with Microsoft` answers "not set up for this application" | No BrokerVerse user has that Microsoft 365 address as e-mail or user ID; add it in User Management. |
| Microsoft says the redirect URI does not match | The app registration's redirect must be exactly `https://<public host>/login`. |
| The site shows the iorta TechNXT branding | The API log at start-up says why: `BRAND_PACK=... is not a bundled brand pack` (a typing error in `brand_pack`), or `BRAND_PACK=... was not applied: <reason>`. Fix the variable and restart the API: the pack is applied again, and the log line names what differed. A browser that still shows the old look reloads the page. |
| Every user shares one address in the sign-in history | `trust_proxy` too low (section 13). |
| Pipeline: `AADSTS70021` / no matching federated identity | The job's GitHub environment differs from `github_environment` in the tfvars, or the variables belong to another environment. |
