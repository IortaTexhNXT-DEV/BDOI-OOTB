# deploy

Deployment files of BrokerVerse for Toyota Insurance Services Philippines (TISPH). The TISPH source branch is
`TISPH-DEV`. How the environments, pipeline and releases work for TISPH is described in the TISPH pack:
`docs/TISPH/pack/TISPH_Environments_and_Release.docx` (index: [docs/TISPH/README.md](../docs/TISPH/README.md)).

| Environment | Where it runs | Runbook |
|---|---|---|
| DEV | Railway, project `tisph-dev`; services `api` and `web` deploy automatically on every push to `TISPH-DEV` | [RAILWAY.md](RAILWAY.md) |
| SIT, UAT | Microsoft Azure, or another environment TISPH approves; set up only after TISPH confirms | [AZURE.md](AZURE.md) |
| PROD | Microsoft Azure | [AZURE.md](AZURE.md) |

The Azure environments are not provisioned yet: the repository variable `ACR_NAME` is unset, so `azure-deploy.yml`
skips its build. Once Azure DEV is provisioned it replaces Railway for DEV.

| File in this folder | Use |
|---|---|
| `RAILWAY.md` | TISPH DEV on Railway: services, variables (`BRAND_PACK=toyota-insurance-services`, `ENVIRONMENT_NAME=DEV`), checks |
| `AZURE.md` | TISPH on Microsoft Azure: Terraform per environment (`azure/`), promotion DEV -> SIT -> UAT -> PROD, backups and disaster recovery, sign-in with Microsoft Entra ID |
| `REFERENCE.md` | Every environment variable, seed data, scheduled jobs, health checks, production start-up rules |
| `smoke-test.sh` | Post-deployment checks (API readiness, version, sign-in page, runtime configuration) |
| `backend.env.example`, `frontend.env.example` | The backend environment and the front end's runtime settings (`/env-config.js`) with placeholders |
| `RELEASE_PIPELINE.md`, `ec2/`, `package-backend.sh` | The product's own pipeline (`ci.yml` deploy jobs, `deploy.yml`, `rollback.yml`) for EC2 and other hosts, triggered from the product branch `brokerverse-platform`. It does not deploy TISPH; its migrations policy (section 8) applies to TISPH too |

Business set-up before go-live (company, users with the TISPH roles, insurers, products, accounts, opening balances):
[docs/onboarding/GO_LIVE_DATA_SETUP.md](../docs/onboarding/GO_LIVE_DATA_SETUP.md). Sample data purge and
transaction reset: [docs/onboarding/SMOKE_TEST_AND_RESET.md](../docs/onboarding/SMOKE_TEST_AND_RESET.md). Known
limitations of the build: `docs/TISPH/pack/TISPH_Operations_and_Support.docx` section 17.
