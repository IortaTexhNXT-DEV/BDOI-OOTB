# Introduction

## Purpose and scope

This document lists the technologies used by BrokerVerse OOTB, with the versions resolved in the lock files of the baseline, their purpose and their licence type, together with the runtime, infrastructure, build and test tooling. It is the reference for dependency management, security patching and licence review.

Sources: `backend/package.json` and `backend/package-lock.json`, `brokerverse/package.json` and `brokerverse/package-lock.json` (licences read from the installed packages), `backend/Dockerfile`, `brokerverse/Dockerfile`, `brokerverse/nginx.conf`, `docker-compose.yml`, `.github/workflows/ci.yml`, `brokerverse/.github/workflows/deploy.yml` and `deploy/README.md`. Versions are the exact versions in the lock files; the manifests use caret ranges and `npm ci` installs the locked versions.

## Stack overview

{widths: 22,78}
| Layer | Technology |
|---|---|
| Browser | Current evergreen browsers (build targets `>0.2%, not dead, not op_mini all`) |
| Front end | React 18.2 single-page application, PrimeReact 10, PrimeFlex, PrimeIcons, Redux Toolkit 2, React Router 6, Formik, i18next, axios, Chart.js, FullCalendar, Sass; built with Create React App 5 (react-scripts) and craco 7 |
| Web serving | Amazon S3 and CloudFront on the existing BrokerVerse URL; nginx 1.27-alpine in the Docker Compose option |
| API | Node.js 22 (ES modules), Express 4.22, node-postgres 8, zod 3, pino 9, helmet 8, jsonwebtoken 9, bcryptjs 2, multer 1.4, nodemailer 10, node-cron 4 |
| Database | PostgreSQL 16 (16.13 on the build host; `postgres:16-alpine` in Docker Compose and CI; Amazon RDS for PostgreSQL 16 as the production option) with `pgcrypto`; database time zone Asia/Manila |
| File storage | Persistent volume at `UPLOAD_DIR` (Amazon EFS or another shared volume in production) |
| E-mail | Office 365 SMTP (`smtp.office365.com`, port 587, STARTTLS) through `SMTP_URL` |
| Containers | Docker images `node:22-alpine` (API) and a `node:22-alpine` build stage with an `nginx:1.27-alpine` runtime (web); Docker Compose |
| CI/CD | GitHub Actions: `.github/workflows/ci.yml` (backend lint and tests on PostgreSQL 16, front-end tests and build, backend image build) and `brokerverse/.github/workflows/deploy.yml` (front-end tests, build, S3 sync, CloudFront invalidation) |
| Cloud | AWS ap-southeast-1 (Singapore): S3 and CloudFront for the front end; for the backend a load balancer with HTTPS, a container service (ECS Fargate, App Runner or EC2), PostgreSQL, a persistent volume and a secret store (Secrets Manager or SSM); monitoring recommended in CloudWatch |

# Backend (backend/)

## Runtime dependencies

{widths: 18,11,13,58}
| Package | Version | Licence | Purpose in BrokerVerse |
|---|---|---|---|
| express | 4.22.3 | MIT | HTTP server, routing, middleware chain (`src/app.js`, module routers) |
| pg (node-postgres) | 8.23.0 | MIT | PostgreSQL client and connection pool (`src/db/pool.js`, 10 connections), type parsers for numeric, bigint and date |
| zod | 3.25.76 | MIT | Request validation schemas (`lib/validate.js`) |
| pino | 9.14.0 | MIT | Structured JSON logging with redaction (`lib/logger.js`) |
| pino-http | 10.5.0 | MIT | HTTP access log with request id |
| helmet | 8.3.0 | MIT | Security headers |
| cors | 2.8.6 | MIT | Cross-origin policy from `CORS_ORIGINS` |
| jsonwebtoken | 9.0.3 | MIT | Access, refresh, challenge and approval tokens (HS256) |
| bcryptjs | 2.4.3 | MIT | Password hashing (bcrypt in JavaScript, cost 10) |
| multer | 1.4.5-lts.2 | MIT | Multipart uploads held in memory with size and count limits |
| nodemailer | 10.0.12 | MIT-0 | SMTP delivery of the e-mail outbox |
| node-cron | 4.6.0 | ISC | Cron scheduling of the jobs, in the business time zone |
| dotenv | 16.6.1 | BSD-2-Clause | Loads `.env` in development |

The backend has 13 direct runtime dependencies (333 packages in the lock file, including development tools). The following are part of the code base instead of third-party libraries: the PDF engine (`lib/pdf`: writer, layout, tables, fonts, images) with the letterhead (`lib/letterhead.js`), the XLSX writer (`lib/xlsx.js`) and ZIP container (`lib/zip.js` over `node:zlib`), CSV with formula-injection guarding (`lib/csv.js`), TOTP two-factor (`lib/totp.js`), AES-256-GCM secret encryption and HMAC link signing (`lib/secrets.js` over `node:crypto`), rate limiting (`lib/rateLimit.js`) and workbook import with inflate caps (`lib/uploadLimits.js`).

## Development and test dependencies

{widths: 18,11,13,58}
| Package | Version | Licence | Purpose |
|---|---|---|---|
| vitest | 2.1.9 | MIT | Integration tests against a real PostgreSQL (`backend/test`, 50 files, 518 tests) |
| supertest | 7.3.0 | MIT | HTTP assertions against the in-process app |
| eslint, @eslint/js | 9.39.5 | MIT | Linting (`npm run lint`; `no-console` outside scripts, `no-unused-vars` and `eqeqeq` as errors) |
| globals | 15.15.0 | MIT | ESLint environment globals |

## Scripts and tools

{widths: 30,70}
| Command | Purpose |
|---|---|
| `npm start` | `node src/server.js`: production configuration check, migrations under an advisory lock, seed, HTTP server, scheduler |
| `npm run dev` | Development server with `node --watch` |
| `npm run migrate`, `npm run seed`, `npm run db:reset` | Apply migrations; run the seed; drop and rebuild the schema (development only) |
| `npm run export:api` | Write OpenAPI, Postman and Excel API documentation from the route registry |
| `npm run purge:sample` | Remove sample data before go-live (dry run by default) |
| `npm run check:settings` | Compare the setting keys read in code with the keys in the database |
| `node scripts/provision-users.js` | Create named users from a CSV kept outside the repository |
| `node scripts/build-upload-templates.js` | Regenerate the upload templates in `docs/templates` |
| `node scripts/fk-index-report.js` | List foreign keys without a supporting index |
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
| @fullcalendar/core, daygrid, react | 6.1.x | MIT | Calendar views (open items) |
| moment | 2.29.4 | MIT | Date handling in four older screens |
| sass | 1.69.5 | MIT | SCSS styles and theme |
| @fontsource/nunito | 5.3.0 | OFL-1.1 | Nunito web font, bundled (no external font service) |
| redux-logger | 3.0.6 | MIT | Redux logging in development builds only |
| js-cookie, react-pro-sidebar, web-vitals | 3.0.8 / 1.1.0-alpha.1 / 2.1.4 | MIT, MIT, Apache-2.0 | Listed in `package.json` but no longer imported; to be removed with the next dependency update |

The `@testing-library/*` packages are listed under dependencies but are used only by the 30 front-end tests.

## Build and delivery

{widths: 28,72}
| Item | Detail |
|---|---|
| Build | `npm run build` (`craco build`). `REACT_APP_BASE_URL` (the API base, for example `https://<brokerverse-url>/api`) is compiled in at build time; `GENERATE_SOURCEMAP=false`. |
| Deployment workflow | `brokerverse/.github/workflows/deploy.yml`: on a push or pull request to `dev`, Node 22, `npm ci --legacy-peer-deps`, `craco test`, a check that the repository variable `REACT_APP_BASE_URL` is set (push only), build; on a push to `dev` the deploy job syncs `build/` to the S3 bucket with `--delete` and invalidates CloudFront `/*`. Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`. |
| Repository CI | `.github/workflows/ci.yml`: on every push to `brokerverse-platform` or `main` and on pull requests; backend `npm ci`, `eslint`, `vitest` against a `postgres:16-alpine` service; front end `npm ci`, `craco test`, production build; backend image build after the backend job passes. |
| Container | Multi-stage `brokerverse/Dockerfile`: `node:22-alpine` build, `nginx:1.27-alpine` runtime with `nginx.conf` (SPA fallback, `/static/` cached for one year, `index.html` not cached, `/api/` proxied to the API, `client_max_body_size 25m`, security headers). |

# Infrastructure and platform

{widths: 24,20,56}
| Component | Version / service | Purpose and status |
|---|---|---|
| Node.js | 22 (image `node:22-alpine`) | API runtime and both GitHub workflows; `engines` in `backend/package.json` is `>=22` |
| PostgreSQL | 16 | System of record; time zone Asia/Manila (documents 07 and 09) |
| nginx | 1.27-alpine | Web container of the Docker Compose option |
| Docker, Docker Compose | Compose file without a version key | Single-server, test and trial installations |
| GitHub Actions | `actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4`, `download-artifact@v4`, `configure-aws-credentials@v4` | CI and front-end deployment |
| AWS | ap-southeast-1 | S3 and CloudFront for the front end; backend services per `deploy/README.md` (load balancer, container service, PostgreSQL, persistent volume, secret store) |
| Office 365 | SMTP submission | Outbound e-mail from `connect@iortatechnxt.com` |
| Monitoring | CloudWatch (recommended) | Logs, metrics, alarms (document 11) |

# Lifecycle and risk notes

{widths: 26,74}
| Item | Observation (from `docs/review/CODE_REVIEW.md` and the lock files) |
|---|---|
| Backend advisories | `npm audit` reported no backend advisories after the nodemailer 10 and node-cron 4 upgrades (29 Sep 2026). |
| Front-end advisories | 71 advisories were reported at the review (3 critical, 35 high), almost all build-time dependencies of react-scripts 5.0.1; react-router 6 and craco have moderate ones. Create React App is no longer maintained. A move to Vite (and later React Router 7) is the planned remedy; to be scheduled. |
| Pipeline credentials | The deployment workflow uses long-lived AWS access keys stored as GitHub secrets. Recommended: GitHub OIDC with an IAM role limited to the bucket and the distribution. |
| Backend release pipeline | CI builds the backend image but does not push it to a registry. The image registry and the release steps are to be confirmed by DevOps. |
| Unused front-end packages | `js-cookie`, `react-pro-sidebar` and `web-vitals` are no longer imported; `moment` is used by four files. Remove them with the next dependency update. |
| Licences | All listed runtime dependencies use permissive licences (MIT, MIT-0, ISC, BSD-2-Clause, Apache-2.0) and the Nunito font the SIL Open Font License; no copyleft licence was found among the direct dependencies. A full scan of indirect dependencies (for example `license-checker`) is recommended before each release. |
