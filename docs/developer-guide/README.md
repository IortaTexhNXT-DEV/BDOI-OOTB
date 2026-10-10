# BrokerVerse developer and production support guide

BrokerVerse is the insurance broking platform of iorta TechNXT for brokers in the Philippines: leads, quotations,
placement with insurers, policies, endorsements, claims, renewals, and the broker's accounting (billing, collection,
remittance to insurers, commission, payables and fixed assets, general ledger, period end, bank reconciliation, BIR
returns and invoicing), client onboarding and KYC, distribution and marketing, integrations with SMS gateways, CTPL, insurers
and banks, and the go-live data workbench. Updated 04 October 2026 for the current conventions.

This folder is for two readers: developers who change or extend the system, and the support team who look into
defects in production.

| Guide | Covers |
|---|---|
| [backend.md](backend.md) | The API and scheduled jobs (`backend/`): layout, running and testing, configuration, tracing a defect, logs, common production issues, how to add routes, settings, migrations, masters, posting rules, number series, reports and jobs. |
| [frontend.md](frontend.md) | The React application (`brokerverse/`), written by the front-end team. |
| [dashboards.md](dashboards.md) | The dashboard and chart standard: data colour tokens, chart forms, KPI cards, periods, drill-down and accessibility. |
| [`backend/docs/MODULE_GUIDE.md`](../../backend/docs/MODULE_GUIDE.md) and the module READMEs (`backend/src/modules/*/README.md`) | Modules of the API: purpose, routes, tables, jobs and settings. The TISPH architecture is described in `docs/TISPH/pack/TISPH_Solution_Architecture.docx` (index: [`docs/TISPH/README.md`](../TISPH/README.md)). |

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | Node.js 22 API (Express, PostgreSQL). Modules in `backend/src/modules`, one folder per business area. |
| `brokerverse/` | React front end. |
| `deploy/REFERENCE.md` | Installing and upgrading a server; environment variables; rotating the personal data key (package B). |
| `deploy/RELEASE_PIPELINE.md` | Build once, promote through Dev, SIT, UAT, Pre-Prod and Production with approvals; migrations policy; rollback; hotfix. |
| `docs/onboarding/` | Go-live workbench, smoke test and transaction reset, client data masking, branding and e-signatures. |
| `deploy/README.md` | What to check before a site goes live. |
| `docs/e2e/` | UAT scenario run, go-live rehearsal, document and report sweep, role walk, and the end-to-end test tooling. The earlier generic code reviews, end-to-end reports and defect register are in `docs/archive/2026-10-10/`. |
| `docs/TISPH/` | TISPH documents: functional specifications, the document pack (architecture, security, data, environments, migration, operations, governance) and the test pack. Start with `docs/TISPH/README.md`. |
| `docs/package/` | Product documents still used by the code or not yet replaced: user manual source, upload templates, brand packs, data dictionary workbook, templates. See `docs/package/README.md`. |
| `docs/architecture/`, `docs/manual/`, `docs/decks/` | Table catalogue and indicative load test, user manual screenshots and their capture tools, role presentations. |
| `backend/docs/api/` | Generated API list: OpenAPI, Postman collection, the API touchpoint workbook (screen to API). |
| `docker-compose.yml` | Database, API and web server for a single-server installation. |

## Quick start

```bash
# database: PostgreSQL 16 running locally
cd backend && npm ci && cp .env.example .env    # edit DATABASE_URL, JWT_SECRET, DATA_ENCRYPTION_KEY, ADMIN_PASSWORD
                                                # (and PII_ENCRYPTION_KEY once package B is merged)
npm run db:reset && npm run dev                 # API on http://localhost:8000/api
cd ../brokerverse && npm ci && npm start        # web on http://localhost:3000
```

Sign in as `BrokerVerse` with the `ADMIN_PASSWORD` you set, then create users and roles under Master > User
Management.

Before opening a pull request run `npm run lint` and `npm test` in `backend/`, and `npm run lint`,
`CI=true npm test -- --watchAll=false`, `npm run check:api` and `npm run check:i18n` in `brokerverse/`. CI requires
the four checks (backend lint and tests, front-end lint, tests and build, backend release artefact, dependency audit)
and one approving review.

## When something goes wrong in production

1. Get the request id. Every API response carries an `x-request-id` header and every error body a `requestId`.
   Ask the user for the screen, the time and, if shown, the request id.
2. Find the log lines with that id. A server error (500) has the real message and stack only in the log.
3. Find the route from the screen (the "By Screen" sheet of the API touchpoint workbook) and follow it to the module's
   service and tables: [backend.md, section 5](backend.md#5-tracing-a-defect-from-a-screen-to-the-database).
4. Check the usual suspects for the area: sign-in, document numbers, postings, period close, scheduled jobs, PDFs, the
   e-mail outbox: [backend.md, section 7](backend.md#7-common-production-issues-and-where-to-look).

Most business behaviour (rates, account codes, limits, e-mail text, switches) is configuration on Master >
Configuration, not code. Check the setting before changing code.
