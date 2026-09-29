# BrokerVerse developer and production support guide

BrokerVerse is the insurance broking platform of iorta TechNXT for brokers in the Philippines: leads, quotations,
placement with insurers, policies, endorsements, claims, renewals, and the broker's accounting (billing, collection,
remittance to insurers, commission, general ledger, period end, bank reconciliation, BIR reporting).

This folder is for two readers: developers who change or extend the system, and the support team who look into
defects in production.

| Guide | Covers |
|---|---|
| [backend.md](backend.md) | The API and scheduled jobs (`backend/`): layout, running and testing, configuration, tracing a defect, logs, common production issues, how to add routes, settings, migrations, masters, posting rules, number series, reports and jobs. |
| [frontend.md](frontend.md) | The React application (`brokerverse/`), written by the front-end team. |

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | Node.js 22 API (Express, PostgreSQL). Modules in `backend/src/modules`, one folder per business area. |
| `brokerverse/` | React front end. |
| `docs/DEPLOY.md` | Installing and upgrading a server. |
| `docs/GO_LIVE_CHECKLIST.md` | What to check before a site goes live. |
| `docs/review/CODE_REVIEW.md` | Code reviews: what was found, fixed and left open. |
| `docs/e2e/` | End-to-end test runs on the screens and their defect register. |
| `docs/architecture/`, `docs/manual/`, `docs/decks/` | Architecture description, user manual, presentations. |
| `backend/docs/api/` | Generated API list: OpenAPI, Postman collection, the API touchpoint workbook (screen to API). |
| `docker-compose.yml` | Database, API and web server for a single-server installation. |

## Quick start

```bash
# database: PostgreSQL 16 running locally
cd backend && npm ci && cp .env.example .env    # edit DATABASE_URL, JWT_SECRET, DATA_ENCRYPTION_KEY, ADMIN_PASSWORD
npm run db:reset && npm run dev                 # API on http://localhost:8000/api
cd ../brokerverse && npm ci && npm start        # web on http://localhost:3000
```

Sign in as `BrokerVerse` with the `ADMIN_PASSWORD` you set, then create users and roles under Master > User
Management.

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
