# Front-end code review (brokerverse/)

Review of the React front end at commit `cb035c2`, with the clean-up made on top of it. Scope: code
smells, standards, naming and branding, disconnects between screens, menu, translations and the API,
and how easy the code is to support.

## 1. What was checked and how

| Check | Method |
| --- | --- |
| Branding and naming | Case-insensitive search of `src`, `public`, `package.json` for names of third-party tools, vendors, other products and companies, and wording that describes generated content |
| API disconnects | New `scripts/check-api-calls.js` (`npm run check:api`): parses every file, resolves the request helpers of the services and compares each call with `backend/docs/api/openapi.json` |
| Routes and menu | Every `path` in `components/SideBar/list.js` against `routes/MainRoute.js`; every route against the menu and all path literals in `src` |
| Translations | New `scripts/check-translations.js` (`npm run check:i18n`): keys used in code against `en.json` / `th.json` |
| Dead code | Import graph from `src/index.js` and the tests; ESLint `no-unused-vars`; commented-out code detected by parsing comment text |
| Smells | ESLint (react-app rules), console calls, defect tags and change-log comments, duplicated helpers, hard-coded data and URLs, folder name typos |
| Behaviour | Build, 30 unit tests, and a browser run (Playwright) that signs in as the administrator and opens all 154 menu entries, before and after the changes |

## 2. Results in numbers

| Measure | Before | After |
| --- | --- | --- |
| ESLint warnings (whole `src`) | 1,899 | 293 |
| of which `no-unused-vars` | 1,571 | 0 |
| `console.*` calls | 1,572 | 0 (173 diagnostics go through `utility/logger`) |
| Commented-out code blocks | about 1,260 (3,600 lines) | 0 |
| Source files under `src` | 1,335 | 1,176 |
| Unused files removed (`src` and `public`) | | 168 |
| Lines of code removed / added | | about 27,800 / 1,450 |
| Calls to API routes that do not exist | 0 (after correcting for the openapi issue in section 4) | 0 |
| Translation keys used but missing from en.json | 86 | 0 |
| Unit tests | 30 pass | 30 pass |
| Menu entries with page errors or failed API calls | 0 of 155 | 0 of 154 (the 155th was a commented-out entry) |

The remaining 293 warnings: 163 `react-hooks/exhaustive-deps`, 121 `eqeqeq` (`==` between values of
possibly different types), 5 `anchor-is-valid`, 3 `no-lone-blocks`, 1 `default-case`. They were left
because changing them changes behaviour and needs testing per screen (section 6).

## 3. Findings and what was fixed

### Branding and wording
- The quote Share dialog described the template-based e-mail text (`POST /email/generate`, filled by
  the backend from the `share_quote` template) as machine-generated, with sparkle emojis, and
  `emailService` used the same wording in its timeout message. It is now "Use suggested content" with
  new en/th keys; state and props are renamed (`suggestedContent`, `suggestedSubject`,
  `suggestedHtml`).
- Quote comparison and remittance analytics labelled the backend's rule-based notes the same way,
  and the product recommendation data used mock-style names (`mockPlans`). All renamed.
- Other companies and products: `package.json` was `finance_module`; `index.html` and the manifest
  said "INXT Broker Suite" with Open Graph tags for another domain; translations had "INXT" and
  "inxtcover"; a payment tile "INXT payment" had no action; the remittance statement preview printed
  "INXT Insurance Broker, 123 Main Street"; bulk upload templates were downloaded from another
  company's S3 bucket; `formatBaht` formatted pesos; a treaty field was labelled THB. All replaced
  with BrokerVerse / iorta TechNXT wording, system settings or neutral names.

### Defects fixed
1. Share dialog: the editable body was the plain-text version but was sent as HTML, so paragraphs
   were lost; it now edits and sends the HTML. The e-mail is now recorded against the quotation
   (`quotationId` passed to `/email/send`), and the recipient name comes from the lead instead of
   "Valued Client".
2. Sales Dashboard > Existing client: every client opened quote creation for the hard-coded lead id
   123; the list was empty unless the Clients screen had been opened; searching rendered the raw
   result array. Fixed: loads clients, filters, opens the chosen client.
3. Add Receipts pickers showed raw keys `accounts.addReceipts.draftCount` / `billsOpen`.
4. Receipts and Payment Voucher "Download Template" opened files in a third-party bucket; templates
   are now generated in the browser with the columns the API reads, and `.csv` is accepted.
5. Transaction code setup showed a made-up row (period 12/1/2023, numbers 123 to 12) until loaded.
6. `th.json` had 48 keys written twice (some whole sections), so earlier values were silently lost;
   de-duplicated keeping the effective value.
7. Duplicate object keys and a duplicate `className` prop (the overridden values removed); holes in
   two breadcrumb arrays; a self-assignment in a reducer.
8. Renewal waiting screen loaded its picture from i.ibb.co; the top bar showed "user@example.com"
   when no e-mail was stored; `index.html` preloaded a font through a path the build does not serve.

### Disconnects
- API: after resolving service helpers, every front-end call matches a documented route and method.
  72 backend routes have no caller (informational, `npm run check:api -- --unused`): mostly legacy
  aliases kept for compatibility (`/lead/*`, `/master/*`, `/quote/calculate-premium-quote`), record
  detail endpoints the screens do not need, report schedules, `/search`, `/version`.
- `routes/apiRoutes.js` listed about 60 paths of an older API (`user/user-login`,
  `biCoverage/...`); only three journal-voucher paths were used. Removed.
- Menu: every menu entry has a route. 38 routes are not reached from the menu or a literal link;
  most are edit/detail steps reached through paths built at run time. Removed only
  `master/finance/bankaccount` and `master/finance/bankcheque` (declared twice, no link, the cheque
  master showed PrimeReact demo products such as "Bamboo Watch"). Left and listed:
  `master/finance/branch` and `department` (use the masters API but have no menu entry),
  `master/finance/taxation-legacy`, `/underwriting/dashboard` (redirect),
  `/agent/policy/paymenterror`, `/reports/financialreports/payables`, `/finance/remittance/reports`,
  `/agent/editprofile`, `/agent/claim/claimtable`, `/agent/quotation/quotationtable`.
- The `permissions` field on menu entries (46 entries) is not read by the front end; access is
  decided by `utils/menuPermissions.js` and the API. It now serves as documentation.

### Code smells cleaned
- Console output: 1,033 `console.log` statements (form values, API payloads, `"=======>"` markers)
  removed with the debug-only effects they needed; 269 `console.error/warn` removed where the error
  was already shown to the user or returned; 174 moved to `utility/logger` (silent in production,
  enabled per browser with `localStorage.bv.debug = "1"`). ESLint now warns on `console`.
- Comments: defect tags (D36 to D118), "BUG #n FIX", "Task n", "(FIXED)", emoji markers and
  commented-out code removed; explanatory comments kept.
- Unused code: 944 unused imports, 633 unused variables and handlers, 104 plus 39 files nothing
  imports (old masters, mock data, unused components, icons, fonts, images).
- Service pattern: `emailService` had four copies of the same fetch block; now one helper. Services
  export named instances.
- Folder typos fixed: `PoductConfiguratorTab`, `productRecommandation`, `ComapanyMaster`,
  `coverageDetailedVew`, `DropdwonField`, file `contants.js`.

## 4. For the backend team

`backend/src/tools/export-api.js` documents some routes under the wrong path, so `openapi.json`,
the Postman collection and the touchpoints CSV disagree with what Express serves:
- routes of a module's secondary routers (`extraMounts`) get the module's mount in front:
  `/quotations/email/send` is served at `/email/send`, `/users/roles` at `/roles`,
  `/placements/broker-slips` at `/broker-slips`, `/payments/petty-cash/*` at `/petty-cash/*`,
  `/payments/open-items` at `/open-items`, `/posting-rules/account-determination` at
  `/account-determination`, `/receipts/billing-statement/*` at `/billing-statement/*`,
  `/policy-renewals/renewals/*` at `/renewals/*`, `/leads/lead/*` at `/lead/*`,
  `/clients/customers/*` at `/customers/*`, `/s3/upload/file/*` at `/upload/file/*`, and the
  quotation masters (`/quotations/master/...`) at `/master/...`;
- the notifications routes are listed as `/accounting/notifications/*` (the accounting router
  imports the notifications code first, so the registry attributes them to it); they are served at
  `/notifications/*`.

`check-api-calls.js` corrects for both by reading the mounts from the backend source; the generator
should be fixed so the published documents are right.

## 5. Left as is, with a recommendation

| Item | Recommendation |
| --- | --- |
| Create React App (`react-scripts` 5) is no longer maintained | Move to Vite: `REACT_APP_*` becomes `VITE_*`, craco config goes away; plan with a regression run |
| `react-router-dom` 6.30 | Current; the future flags for v7 can be enabled when the router is next touched |
| Access and refresh tokens in `localStorage` | Readable by any script on the page (XSS). Prefer an httpOnly, SameSite refresh cookie with a short-lived access token in memory; needs a backend change |
| Two request styles (fetch in older services, axios client in newer ones) | Both renew the session; migrate a service to `utility/commonServices` when it is next changed |
| 163 `exhaustive-deps` and 121 `eqeqeq` warnings | Fix per screen with a test; some effects rely on running only on mount, and some `==` compare numbers with strings |
| Product recommendation step in Motor quote creation shows illustrative plans with fixed monthly premiums and insurers ("Alternative Insurer A") | Product decision: drive it from the Product Configurator or remove the step; the choice made there is not used later |
| Employee benefit flow (`agentModule/EmployeeFlow`) uses mock option lists (including THB currency options) and is reachable from the Sales Dashboard | Build on the API or hide the option |
| Endorsement city list (`endorsementModule/personalDetails/mock.js`) is a fixed list | Use the address masters (`/addresses/*`) like lead creation |
| `th.json` misses 1,398 keys used by the screens (English is shown) | Translate, or offer only English until complete |
| Legacy screens still in `module/FinanceMastersModule` and `GeneralMasters` with Redux middlewares that keep unused thunks (for example `getClientTableSearchListMiddleware`, `getLeadDataMiddleware`) | Remove when those screens are next reworked |
| Very large components (`ProductConfiguratorScreens.js`, `PolicyDetailView`, `coverageDetailsCard`, over 1,500 lines) | Split along their tabs when changed; not split here because there is no test coverage for them |
| Dependencies no file imports any more: `web-vitals`, `js-cookie`, `react-pro-sidebar`; `moment` is used by 4 files next to the shared date helpers | Remove the unused ones and move the 4 files to `utility/dateFormat` with the next dependency update |
| Menu paths `/agent/Quotation` (capital Q) and a few legacy routes | Normalise when the menu is next edited, keeping redirects |

## 6. How to keep it clean

Run before every merge: `npm run build` (warnings must not grow), `CI=true npm test -- --watchAll=false`,
`npm run check:api`, `npm run check:i18n`. The developer guide
(`docs/developer-guide/frontend.md`) explains the structure, how to trace a defect and how to add a
screen, menu entry, translation or report.
