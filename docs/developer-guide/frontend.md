# BrokerVerse front end: developer guide

The front end is a React 18 single-page application in `brokerverse/`, built with Create React App
through craco. It uses PrimeReact for components, Redux Toolkit for shared state, Formik for most
forms and i18next for text. It talks only to the BrokerVerse API (`backend/`, see `backend.md`).

## 1. Layout of `brokerverse/src`

| Folder | What is in it |
| --- | --- |
| `index.js`, `App.js` | Entry point: store, router, theme, session renewal; `App.js` holds the sign-in and public routes |
| `routes/MainRoute.js` | Every signed-in route, wrapped by `routes/ProtectedRoute` |
| `components/SideBar/list.js` | The side menu: one tree of `{ name, path, includes, submenu }` |
| `utils/menuPermissions.js`, `utils/canOpen.js` | Which role sees which menu entry, route guard, `hasPermission` |
| `agentModule/` | Operations screens (leads, clients, quotations, policies, endorsements, claims, renewals, payments, open items); routes under `/agent/...` |
| `module/` | Everything else: masters, accounts and finance, placement, remittance, commission, incentive, product configurator, reports, system settings |
| `services/` | One file per API area; every HTTP call of a screen goes through a service |
| `utility/`, `utils/` | Shared helpers (formatting, dialogs, session, validation); `utils/` holds the permission helpers |
| `components/` | Shared UI pieces (error boundary, dialogs host, notification drawer, file upload, status badge, stats cards) |
| `hooks/` | `useFormatCurrency`, `useNotifications` |
| `redux/` | Store and the list of reducers |
| `locales/` | `en.json` (complete) and `th.json` |
| `theme/bdoi/` | PrimeReact theme and application styles (generated theme: `scripts/build-bdoi-theme.js`) |

### Why two source trees

`agentModule/` started as the agent (sales) application and `module/` as the finance and masters
application. They were merged into one product, but the folders were kept to avoid moving several
hundred files. The rule for new work: operations screens used by sales, processing and claims staff
go in `agentModule/<area>`, back-office screens (accounts, masters, configuration, reports) go in
`module/<Area>`. Both use the same services, helpers and store.

## 2. Routes, menus and permissions

Three layers decide what a user can do. They must agree.

1. **Menu** (`components/SideBar/list.js`). Each entry has a `path` and an `includes` list of path
   prefixes that belong to the same screen (detail and edit pages). The `permissions` field on an
   entry records the API permission the screen needs; it is documentation and is not checked in the
   browser.
2. **Role grants** (`utils/menuPermissions.js`, `roleMenuPermissions`). Deny by default. The
   administrator role (`system-admin`) gets `all: true`. Other roles list, per top-level menu, the
   second-level entries they may open (`"Operational Reports > Remittance"` grants one child).
   `ProtectedRoute` calls `isPathAllowed`: a path that belongs to a menu entry opens only when that
   entry is in the user's filtered menu; paths outside the menu (profile, notifications) are open to
   every signed-in user. `canOpen(path)` applies the same rule to buttons and links, and
   `hasPermission("write:policies")` hides actions the API would refuse (permissions come from the
   sign-in response).
3. **API** (backend). Every endpoint checks the user's permissions. The front end only hides what a
   role cannot use; the server is the authority. `utils/menuPermissions.test.js` walks each persona
   through the menu and checks the grants against the API permissions.

When a role must see a new screen: add the menu entry, add it to the role in `roleMenuPermissions`,
and make sure the backend role has the permission the screen's API calls need. Master is organised in
sections (Organization, Insurance Management, Location, Employee Management, User Management, Finance,
System Configuration); a grant such as `"Finance > Bank File Layouts"`
opens one item of a section.

4. **Help** (`components/HelpPanel/helpRoutes.js`). Every screen maps its address prefix to a heading
   of the user manual; F1 or the help button opens that section with the support contacts.
   `helpRoutes.test.js` checks each heading id against `public/help/sections.json`; `npm run help:build`
   rebuilds `public/help/` from `docs/package/source/user-manual.md`.

## 3. Business areas

| Area | Route prefix | Folder | Main service | Backend module |
| --- | --- | --- | --- | --- |
| Dashboards | `/executive/dashboard`, `/claims/dashboard`, `/processing/dashboard`, `/agent/home` | `module/ExecutiveDashboard`, `module/ClaimsModule`, `agentModule/dashBoardModule` | `dashboardService` | `dashboard` |
| Leads | `/agent/leadlisting`, `/agent/createlead` | `agentModule/leadModule` | `leadService` | `leads` |
| Clients | `/agent/clientlisting`, `/agent/clientview`, `/agent/client-onboarding` | `agentModule/quoteModule/clientListing`, `clientView`, `clientOnboarding` | `clientService`, `clientOnboarding/onboardingService` | `clients` |
| Quotations | `/agent/Quotation`, `/agent/createquote`, `/agent/editquote`, `/agent/quotedetailview` | `agentModule/quoteModule`, `agentModule/quotationModule` | `quotationService`, `emailService` | `quotations` |
| Placement | `/placement/broker-slips`, `/placement/placement-slips` | `module/Placement` | `placementService` | `placement` |
| Policies | `/agent/policy`, `/agent/policydetail` | `agentModule/policyModule` | `policyService` | `policies` |
| Endorsements | `/agent/endorsement...` | `agentModule/endorsementModule` | `endorsementService` | `endorsements` |
| Claims | `/agent/claim` | `agentModule/claimModule`, `agentModule/claimsModule` | `claimsService`, `claimSettlementCashService` | `claims` |
| Renewals | `/agent/expired-policies`, `/agent/renewal-batch`, `/renewal/...` | `agentModule/renewalModule`, `module/Renewal` | `policyRenewalService`, `batchRenewalService`, `renewalsWorkspaceService` | `renewals` |
| Open items, payments | `/agent/openitemslistdata`, `/agent/payments` | `agentModule/openItems`, `agentModule/paymentsModule` | `paymentsService` | `payments` |
| Receipts, collections | `/accounts/receipts`, `/agent/collections` | `module/Receipts`, `agentModule/collectionsModule` | `receiptsService`, `collectionService`, `billingService` | `receipts`, `collections` |
| Disbursements | `/accounts/paymentvoucher` | `module/PaymentVoucher` | `disbursementsService` | `disbursements` |
| Journals | `/accounts/journalvoucher`, correction and reversal JV | `module/JournalVoucher`, `module/CorrectionJV`, `module/Reversals` | `journalVoucherService`, `accountingService` | `journal-vouchers`, `accounting` |
| Petty cash | `/accounts/pettycash` | `module/PettyCashManagement` | `pettyCashService` | `payments` (petty cash) |
| Bank reconciliation | `/accounts/bank-reconciliation` | `module/BankReconciliation` | `bankReconciliationService` | `bank-reconciliation` |
| Period end, tax | `/accounts/period-end`, `/accounts/tax` | `module/PeriodEnd` | `periodEndService` | `period-end` |
| Remittance | `/finance/remittance`, `/master/finance/remittance` | `module/Remittance`, `module/FinanceMastersModule/RemittanceMaster` | `remittanceService` | `remittance` |
| Commission | `/commission` | `module/Commission` | `commissionService` | `commission`, `commission-rates` |
| Incentive | `/incentive`, `/master/incentive` | `module/Incentive` | `incentiveService` | `incentive` |
| Product configurator | `/product-configurator` | `module/ProductConfigurator` | `productConfiguratorService` | `product-configurator` |
| Masters | `/master/generals`, `/master/finance` | `module/GeneralMasters`, `module/FinanceMastersModule` | `mastersService` | `masters` |
| Users and roles | `/master/generals/usermanagement` | `module/GeneralMasters/UserManagementMasters` | `userService`, `adminService` | `users` |
| Configuration | `/master/configuration` | `module/SystemSettings`, `module/Administration` | `systemSettingsService`, `numberingService` | `system-settings`, `settings`, `schedules`, `document-numbering` |
| Reports | `/reports` | `module/Reports` | `reportsService` | `reports` |

## 4. Services and the API client

Each file in `services/` wraps the endpoints of one area and returns plain data or
`{ success, data, error }`. Screens do not build URLs themselves.

- The API base URL is `BASE_URL` from `utility/constant.js`, resolved by `config/runtimeConfig.js`: `/env-config.js`
  at run time, else `REACT_APP_BASE_URL` of the build, else the same-origin `/api`. Read deployment settings only
  through `config/runtimeConfig.js`, never `process.env` in a screen.
- Two request styles exist. Older services use `fetch` with `authService.getAuthHeader()`; newer ones
  use the axios client in `utility/interceptor.js` through `getRequest` / `postRequest` /
  `putRequest` / `patchRequest` / `deleteRequest` (`utility/commonServices.js`). Prefer the axios
  client for new code.
- Both styles renew the session the same way: `utility/sessionRefresh.js` wraps `window.fetch`, and
  the axios interceptor calls the same `refreshAccessToken`. A 401 is retried once with a new access
  token; when the refresh token is also rejected the user returns to the sign-in page.
- `npm run check:api` (`scripts/check-api-calls.js`) compares every call in `src` with the routes in
  `backend/docs/api/openapi.json` and lists calls to routes that do not exist or use the wrong
  method. Run it after changing a service or a backend route.

## 5. Redux store

`redux/store.js` combines the reducers listed in `redux/mainReducer.js` (back office) and
`redux/AgentReducer.js` (operations). Each area keeps its slice next to its screens in a `store/`
folder (`*Reducer.js` or `*Slice.js` with `createAsyncThunk` middlewares in `*Middleware.js`).
Notable slices: `systemSettingsReducer` (display currency, date format, branding), the quote creation
slice (`quotationReducers.currentQuoteCreation`, which carries a quote across the creation steps),
and the lead and client lists. `resetStore()` clears everything at sign-out. In development
`redux-logger` prints each action to the browser console.

Many newer screens keep their data in component state and call a service directly; that is
acceptable for data no other screen needs.

## 6. Shared UI layer

| Need | Use |
| --- | --- |
| Success / error / warning message | `notifySuccess`, `notifyError`, `notifyWarn`, `notifyInfo` from `utility/dialogs` |
| Confirm an action | `components/ConfirmDialog`, or `openConfirm({ title, severity, message, facts, note, input, confirmLabel, onConfirm })` from an event handler: the facts in an aligned table, a button named after the action (never Yes / No), the action run inside the dialog with its error shown there; never `window.confirm` |
| Ask for text (older screens) | `confirmAction`, `promptText` from `utility/dialogs`; new confirmations use `openConfirm` (its `input` asks for a reason, date, amount or choice) |
| Record detail pop-up | `components/DetailDialog` (centred, footer actions right-aligned) with `DetailHeader` (number, `StatusChip`, key facts, actions), `DetailSection` (titled card) and `KeyValueGrid` (label above value, formatted by type); sections in one view, tabs only for substantial, distinct content |
| Approve / Reject under maker-checker | `components/ApprovalActions` (disabled with the reason for the user who initiated the record), `useMakerChecker` |
| Activity log | `components/ActivityLog` with an adapter of `ActivityLog/adapters` for the API's history rows, or `RecordActivityLog entity id` (business events of `GET /api/audit/records/:entity/:id`) |
| Print | `printPdf(path)` for a PDF of the API, `printView(<PrintableDocument>)` for a page of the screen's own, from `components/Print`; never `window.print()` of the screen |
| Amounts | `useFormatCurrency()` in components, `formatCurrency` / `formatNumber` from `utility/currencyConverter` elsewhere |
| Dates | `formatDate(value, { withTime, empty })`, `toIsoDate`, `calendarDateFormat()` from `utility/dateFormat`; an instant (date and time) in the business time zone with `formatInstant` / `instantParts` |
| Date fields | `Calendar` from `primereact/calendar` resolves to `components/Calendar` (craco alias): the configured format and the calendar button on every screen; `components/DateField` in place of `<input type="date">` (ISO text in and out) |
| Error text of a failed request | `apiErrorMessage(body, status, fallback)` from `utility/apiError` in services (field messages, no "Validation failed" or field paths); the application toast cleans older text with `readableError` |
| Percentages, rounding | `utility/numberFormat` |
| Right-aligned numeric table columns | automatic: `utility/tableNumericAlign` marks numeric cells |
| Status tags | `components/StatusBadge`, `utils/statusHelpers` |
| File upload | `components/S3FileUpload`, `services/s3Service` |
| Bulk upload template | `agentModule/component/bulkUploadTemplate` |
| Required-field checks without Formik | `utility/requiredFields` |
| Lists | `components/DataTable` (skeleton rows while loading, paging, numeric alignment) |
| Detail screen loading, error and not-found states | `components/LoadState` (skeleton while loading, error with Retry, not found with Back; never a loader without an end) |
| What the user does next on a record | `components/NextStep` (title, short text and links or buttons to the next screen; renders nothing without them). The claim screens use the action bar `ClaimActions` of `claimsModule/shared/ClaimJourneyLayout` instead |
| Totals of a screen | `components/StatCards` (KPI cards; `bv-stat-cards--wide` for longer values) rather than totals inside the text |
| A long explanation of a screen or field | `InfoTip` of `components/RecordPage` (info icon with a tooltip; the `help` or `subtitle` of an accounts `PageHeader` and the `hint` of a `SectionCard` use it) rather than a paragraph under the title |
| Record history | `components/AuditTrail/AuditTimeline` (business events of `GET /api/audit/records/:entity/:id`) on the screens that have it; in a detail pop-up, `RecordActivityLog` |
| Philippine address | `agentModule/component/PhAddressFields` (region, province, city or municipality, barangay, ZIP code) |
| Colours and logo | the theme tokens; the saved theme is applied at run time by `theme/runtime/themeEngine.js` and `BrandingProvider`; never hard-code a brand colour |
| Charts, KPI cards and dashboards | `components/Dashboard` (toolbar with period, comparison and data as of; `ChartCard` with its table view and export; `ThemedChart`; `ShareChart`; drill-down) and the data colours of `useChartTheme()`; the rules are in [dashboards.md](dashboards.md) |
| Buttons | the primary button, `outlined` or `text` for secondary actions, `severity="danger"` / `"warning"` only for destructive or cautionary actions; no `info` / `help` / `success` buttons |
| Form fields and pickers | label above the field (`agentModule/component` fields and `components/LabelWrapper` follow `theme/bdoi/_fields.scss`); roles: `components/RoleChecklist`; shared patterns in `theme/bdoi/consistency.scss` |
| Masked identifiers (package B) | `utility/piiReveal.js`: the "Show full identifiers" switch for holders of `view:pii` |
| Diagnostics | `utility/logger` (silent in production, see section 8) |

The display currency and the date format come from the configuration (Master > Configuration, served by GET
/api/system-settings). `module/SystemSettings/store` loads them at start-up and `utility/applySystemSettings` passes them to the formatting helpers,
so formatted values follow the configuration without screens reading the settings. Do not format
dates with `toLocaleDateString` or amounts with a fixed currency symbol.

## 7. Translations

Text is in `src/locales/en.json` and `th.json`, loaded by `src/i18n.js`, and read with
`const { t } = useTranslation()`. Keys are grouped by screen (`"quoteDetailView.title"`). The
language pickers offer the languages configured in Master > Configuration that have a bundled translation
(`utility/languages.js`).

- Add every new key to `en.json`; add the Thai text to `th.json` when known (English is shown
  otherwise).
- `t("key", "Default")` shows the default when the key is missing, but the key still belongs in
  `en.json` so that it can be translated.
- `npm run check:i18n` (`scripts/check-translations.js`) lists keys used in code and missing from
  `en.json`.

## 8. Tracing a defect from a screen to the API

1. Find the screen: the address bar path is in `routes/MainRoute.js`, which names the component.
2. In the component, find the handler of the button or the `useEffect` that loads the data; it calls
   a service method (or dispatches a thunk in the area's `store/` folder, which calls a service).
3. The service method shows the HTTP method and path. Look the path up in
   `backend/docs/api/BrokerVerse_API_Touchpoints.csv` or `openapi.json` to find the backend module
   and the permissions it needs.
4. In the browser developer tools, the Network tab shows the request, the response and the
   `x-request-id` header; the same id is in the backend log line for the request.
5. Errors the user should see are shown with the notify helpers. Other diagnostics go through
   `utility/logger`, which prints nothing in production. To see them while reproducing a problem in
   production, run `localStorage.setItem("bv.debug", "1")` in the browser console, reload, and remove
   the item afterwards.
6. A screen that fails to render shows the error boundary (`components/ErrorBoundary`) instead of a
   blank page; the other screens keep working.

## 9. Common changes

**Add a screen.** Create the component in the right tree (section 1) with its service calls in
`services/`. Add a `<Route>` to `routes/MainRoute.js`. If users reach it from the menu, add an entry
to `components/SideBar/list.js` with `path` and `includes` (detail pages), then grant it to the roles
in `utils/menuPermissions.js` and extend `menuPermissions.test.js` when a persona's access changes.
Add its help entry to `components/HelpPanel/helpRoutes.js` and its texts to `en.json`.
Buttons that open another screen should check `canOpen(path)`.

**Add a menu entry for an existing screen.** Add it to `list.js` and to the roles that need it. An
entry without a role grant is visible only to the administrator.

**Add a translation.** Add the key to `en.json` (and `th.json`), use `t("area.key")`, run
`npm run check:i18n`.

**Add a report.** Standard reports are defined in the backend report catalogue and appear under
Reports > All Reports (`/reports/catalogue`, `/reports/run/:code`) without front-end work: the
filter form is built from the report definition (`module/Reports/ReportScreen`). A report with its
own layout gets a component under `module/Reports/...`, a route and a menu entry as above, and reads
its data through `reportsService`.

**Add an API call.** Add a method to the area's service, call it from the screen, then run
`npm run check:api`.

## 10. Build, configuration and tests

| Command (in `brokerverse/`) | Purpose |
| --- | --- |
| `npm ci --legacy-peer-deps` | Install dependencies |
| `REACT_APP_BASE_URL=http://localhost:8000/api npm start` | Development server on port 3000 |
| `npm run build` | Production build in `build/`, the same for every environment |
| `API_UPSTREAM=http://127.0.0.1:8000 ENVIRONMENT_NAME=UAT npm run serve` | Serve `build/` like the web server: `/env-config.js`, `/api` proxy, cache and security headers |
| `npm run lint` | ESLint on `src` (errors fail CI) |
| `CI=true npm test -- --watchAll=false` | Unit tests (Jest, Testing Library) |
| `npm run check:api`, `npm run check:i18n` | Consistency checks described above |

Nothing environment-specific is compiled in. `public/index.html` loads `/env-config.js` before the
bundle; the web server writes it at start-up or publication (`scripts/env-config.sh`: `API_BASE_URL`,
`ENVIRONMENT_NAME`, `ENVIRONMENT_COLOR`, `ANALYTICS_ENABLED`). `ENVIRONMENT_NAME` outside production
shows `components/EnvironmentBadge` next to the logo (sidebar and sign-in page) and prefixes the browser
tab title. The Docker images (`brokerverse/Dockerfile`, `Dockerfile.railway`) serve the files with nginx
(`nginx/default.conf.template`), which proxies `/api/` to `API_UPSTREAM`, sends unknown paths to
`index.html` so that deep links work, and adds the cache and Content-Security-Policy headers
(`scripts/nginx-snippets.sh`). `.env.production` keeps the webpack runtime out of `index.html`
(`INLINE_RUNTIME_CHUNK=false`) so the policy needs no inline script. Build warnings come from ESLint
(`react-app` rules plus `no-console`); keep the count from growing. Deployment:
[deploy/RELEASE_PIPELINE.md](../../deploy/RELEASE_PIPELINE.md).

Tests live next to the code they test (`*.test.js`, 31 suites, 162 tests on 04 October 2026): formatting
helpers, menu tree, permissions and route guard, help routes, the theme engine, the Philippine address
fields, Product Configurator rules, My Work, BIR Tax, client onboarding, Distribution and Integrations screens,
placement helpers, the lead and masters services and an application smoke test. `npm run lint` on
04 October 2026: no errors, 256 warnings (mostly `react-hooks/exhaustive-deps` and `eqeqeq`); new code
should add none. End-to-end scenarios are
in `docs/e2e`.
