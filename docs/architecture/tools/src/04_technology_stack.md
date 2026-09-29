# Introduction

## Purpose and scope

This document lists the technologies used by BrokerVerse, with the versions resolved in the lock files of the baseline, their purpose and their licence type, together with the runtime, infrastructure, build and test tooling. It is the reference for dependency management, security patching and licence review.

Sources: `backend/package.json` and `backend/package-lock.json`, `brokerverse/package.json` and `brokerverse/package-lock.json` (licences read from the installed packages), `backend/Dockerfile`, `brokerverse/Dockerfile`, `brokerverse/nginx.conf`, `docker-compose.yml`, `render.yaml`, `brokerverse/.github/workflows/deploy.yml` and `docs/GO_LIVE_CHECKLIST.md`. Versions are the exact versions in the lock files (the manifests use caret ranges; `npm ci` installs the locked versions).

## Stack overview

{widths: 22,78}
| Layer | Technology |
|---|---|
| Browser | Modern evergreen browsers (build targets `>0.2%, not dead, not op_mini all`) |
| Front end | React 18.2 single-page application, PrimeReact 10 / PrimeFlex / PrimeIcons, Redux Toolkit 2, React Router 6, Formik, i18next, axios, Chart.js, FullCalendar, Sass; built with Create React App 5 (react-scripts) and craco 7 |
| Web serving | Amazon S3 + CloudFront (target); nginx 1.27-alpine (container option); Render static site (blueprint) |
| API | Node.js 22 (ES modules), Express 4.22, node-postgres 8, zod 3, pino 9, helmet 8, jsonwebtoken 9, bcryptjs 2, multer 1.4, nodemailer 10, node-cron 4 |
| Database | PostgreSQL 16 (local 16.13; `postgres:16-alpine` in Docker Compose; Amazon RDS for PostgreSQL 16 target) with `pgcrypto` |
| File storage | Local file system / persistent volume (`UPLOAD_DIR`); Amazon EFS target |
| E-mail | Any SMTP server through `SMTP_URL` (for example Amazon SES) |
| Containers | Docker images `node:22-alpine` (API), `node:22-alpine` build stage + `nginx:1.27-alpine` (web); Docker Compose |
| CI/CD | GitHub Actions (front end: build, S3 sync, CloudFront invalidation); backend pipeline to be set up |
| Cloud | AWS ap-southeast-1 (Singapore): S3, CloudFront, and for the backend ALB, ECS Fargate / App Runner / EC2, RDS, EFS, Secrets Manager / SSM, CloudWatch (recommended) |

# Backend (backend/)

## Runtime dependencies

{widths: 18,11,13,58}
| Package | Version | Licence | Purpose in BrokerVerse |
|---|---|---|---|
| express | 4.22.3 | MIT | HTTP server, routing, middleware chain (`src/app.js`, module routers) |
| pg (node-postgres) | 8.23.0 | MIT | PostgreSQL client and connection pool (`src/db/pool.js`, max 10 connections), type parsers for numeric, bigint, date |
| zod | 3.25.76 | MIT | Request validation schemas (`lib/validate.js`) |
| pino | 9.14.0 | MIT | Structured JSON logging with redaction |
| pino-http | 10.5.0 | MIT | HTTP access log with request id |
| helmet | 8.3.0 | MIT | Security headers |
| cors | 2.8.6 | MIT | Cross-origin policy from `CORS_ORIGINS` |
| jsonwebtoken | 9.0.3 | MIT | Access, refresh, challenge and approval tokens (HS256) |
| bcryptjs | 2.4.3 | MIT | Password hashing (pure JavaScript bcrypt, cost 10) |
| multer | 1.4.5-lts.2 | MIT | Multipart uploads held in memory with size and count limits |
| nodemailer | 10.0.12 | MIT-0 | SMTP delivery of the e-mail outbox |
| node-cron | 4.6.0 | ISC | Cron scheduling of the scheduled jobs |
| dotenv | 16.6.1 | BSD-2-Clause | Loads `.env` in development |

The backend has 13 direct runtime dependencies (141 packages including transitive ones, per the code review). The following are implemented in the code base instead of third-party libraries: PDF writers (`src/tools/pdf.js`, `modules/documents/pdf.js`), XLSX writer (`tools/xlsx.js`) and ZIP container (`tools/zip.js` over `node:zlib`), CSV with formula-injection guarding (`tools/csv.js`), TOTP two-factor (`lib/totp.js`), AES-256-GCM secret encryption and HMAC link signing (`lib/secrets.js` over `node:crypto`), rate limiting (`lib/rateLimit.js`), and workbook import with inflate caps (`lib/uploadLimits.js`).

## Development and test dependencies

{widths: 18,11,13,58}
| Package | Version | Licence | Purpose |
|---|---|---|---|
| vitest | 2.1.9 | MIT | Unit and API tests (`backend/test`, 40 files, about 345 test cases) |
| supertest | 7.3.0 | MIT | HTTP assertions against the in-process app |
| eslint, @eslint/js, globals | 9.39.5 | MIT | Linting (`npm run lint`; strict rules including `no-console`, `eqeqeq`) |

## Scripts and tools

{widths: 28,72}
| Command | Purpose |
|---|---|
| `npm start` | `node src/server.js`: production configuration check, migrations, seed, HTTP server, scheduler |
| `npm run dev` | Development server with `node --watch` |
| `npm run migrate`, `npm run seed`, `npm run db:reset` | Apply migrations; run the seed; drop and rebuild the schema (development only) |
| `npm run export:api` | Generate OpenAPI, Postman and Excel API documentation from the route registry |
| `npm run purge:sample` | Remove sample / demo data before go-live (dry run by default) |
| `npm test`, `npm run lint` | Tests and lint |

# Front end (brokerverse/)

## Runtime dependencies

{widths: 24,11,13,52}
| Package | Version | Licence | Purpose |
|---|---|---|---|
| react, react-dom | 18.2.0 | MIT | UI library |
| react-scripts (Create React App) | 5.0.1 | MIT | Build tool chain (webpack, Babel, Jest, ESLint) |
| @craco/craco | 7.1.0 | Apache-2.0 | Overrides the CRA webpack configuration (`craco.config.js`) |
| primereact | 10.3.1 | MIT | Component library (tables, forms, dialogs, toasts, calendars) |
| primeflex | 3.3.1 | MIT | CSS utility classes |
| primeicons | 6.0.1 | MIT | Icon font |
| @reduxjs/toolkit | 2.0.1 | MIT | Application state (`src/redux/store.js`) |
| react-redux | 9.0.4 | MIT | React bindings for Redux |
| react-router, react-router-dom | 6.30.6 | MIT | Client-side routing (`routes/MainRoute.js`) |
| history | 5.3.0 | MIT | Navigation history helper |
| formik | 2.4.5 | Apache-2.0 | Forms and validation |
| axios | 1.20.0 | MIT | HTTP client (interceptor with token refresh) |
| i18next, react-i18next, i18next-browser-languagedetector | 25.8.13 / 16.5.4 / 8.2.1 | MIT | Internationalisation (English, Thai) |
| chart.js | 4.5.1 | MIT | Dashboard charts |
| @fullcalendar/core, daygrid, react | 6.1.x | MIT | Calendar views (agent events) |
| moment | 2.29.4 | MIT | Date handling in older screens |
| js-cookie | 3.0.8 | MIT | Cookie access (legacy) |
| react-pro-sidebar | 1.1.0-alpha.1 | MIT | Side menu |
| sass | 1.69.5 | MIT | SCSS styles and theme |
| @fontsource/nunito | 5.3.0 | OFL-1.1 | Nunito web font, bundled (no external font CDN) |
| redux-logger | 3.0.6 | MIT | Redux logging in development builds only |
| web-vitals | 2.1.4 | Apache-2.0 | Performance metrics hook |

The `@testing-library/*` packages are listed under dependencies but are only used by tests.

## Build and delivery

{widths: 28,72}
| Item | Detail |
|---|---|
| Build | `npm run build` (`craco build`); `REACT_APP_BASE_URL` (the API base, for example `https://<brokerverse-url>/api`) is compiled in at build time; `GENERATE_SOURCEMAP=false` in the Docker and Render builds |
| Pipeline | `.github/workflows/deploy.yml`: on push to `dev`, Node 20, `npm install --legacy-peer-deps`, build with `CI=false`, `aws-actions/configure-aws-credentials@v4` (access keys in secrets), `aws s3 sync build/ s3://$S3_BUCKET --delete`, `aws cloudfront create-invalidation --paths "/*"` |
| Container | Multi-stage `Dockerfile`: `node:22-alpine` build, `nginx:1.27-alpine` runtime with `nginx.conf` (SPA fallback, `/static/` cached for one year, `index.html` `no-cache`, `/api/` proxied to the API, `client_max_body_size 25m`, security headers) |

# Infrastructure and platform

{widths: 24,20,56}
| Component | Version / service | Purpose and status |
|---|---|---|
| Node.js | 22 (image `node:22-alpine`; local v22.22.2) | API runtime. `engines` in `package.json` says `>=20`; the front-end pipeline builds with Node 20 |
| PostgreSQL | 16 | System of record; RDS target (document 07, 09) |
| nginx | 1.27-alpine | Web container of the Docker Compose option |
| Docker / Docker Compose | Compose file format without version key | Local and single-server deployment |
| Render | Blueprint `render.yaml` | Managed demo / UAT hosting option |
| GitHub Actions | `actions/checkout@v4`, `setup-node@v4`, `configure-aws-credentials@v4` | Front-end CI/CD |
| AWS | ap-southeast-1 | S3 and CloudFront in use for the front end; backend services per the go-live checklist (ALB, ECS / App Runner / EC2, RDS, EFS, Secrets Manager or SSM) |
| Monitoring | CloudWatch (recommended) | Logs, metrics, alarms (document 11) |

# Lifecycle and risk notes

{widths: 26,74}
| Item | Observation (from `docs/review/CODE_REVIEW.md` and the lock files) |
|---|---|
| Backend advisories | `npm audit` reported 0 backend advisories after nodemailer 10 and node-cron 4 upgrades (29 Sep 2026). |
| Front-end advisories | 71 advisories remain (3 critical, 35 high), almost all build-time transitive dependencies of react-scripts 5.0.1; react-router 6 and craco have moderate advisories. Create React App is no longer maintained; a migration to Vite (or another maintained tool chain) and React Router 7 is the planned remediation. |
| Node.js versions | Align the front-end pipeline (Node 20) and the backend image (Node 22); Node 20 reaches end of life on 30 April 2026 per the Node.js release schedule, so move the pipeline to Node 22 LTS (recommended). |
| Pipeline credentials | The workflow uses long-lived AWS access keys stored as GitHub secrets. Recommended: GitHub OIDC with an IAM role limited to the bucket and distribution. |
| Pipeline tests | The test and SonarQube steps of the workflow are commented out; the workflow edits a `tsconfig.json` that the project does not have (harmless, `\|\| true`). Recommended: run `npm test` and the backend tests in CI. |
| Licences | All listed runtime dependencies use permissive licences (MIT, MIT-0, ISC, BSD-2-Clause, Apache-2.0) and the Nunito font uses the SIL Open Font License; no copyleft licence was found among the direct dependencies. A full transitive licence scan (for example `license-checker`) is recommended before release. |
