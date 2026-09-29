# BrokerVerse persona walk 2: re-test of the persona walk fixes

Run on 29/09/2026 against the build served at http://127.0.0.1:5080 (`main.9ef4f42b.js` for every persona, checked at the start and end of each walk; branch `brokerverse-platform`, commit 40c29d7 with the security hardening D81-D99 and the persona-walk fixes D100-D129) and the API at http://localhost:8000/api. Chromium via Playwright, viewport 1440x900. First run: `docs/e2e/PERSONA_WALK.md` (build `main.65895c72.js`).

**Method.** Same scripts as the first run, adapted to the new build: menus regenerated from the current `components/SideBar/list.js` and `utils/menuPermissions.js`; sign-in through the page with the masked password field and detection of a "change password" / two-factor step (none was met); **every non-GET API request was aborted except `POST /auth/login` and `POST /auth/refresh`** (the first run allowed all of `/auth/*`), so nothing could be saved, submitted, approved, marked read or have its password changed; a "still shows Loading..." check; report-screen controls recorded. Each persona also opened the notifications page (`/agent/notification`, reported separately, not counted in the totals). Targeted scripts re-checked the claim pages, direct-bill policy POL-2026-00003, the agent dashboard counts, every report screen and token refresh. Report Preview and Generate are `POST /reports/:code/run|generate`, so they were not clicked; the controls were checked for being enabled.

Scripts in this folder: `walk.py`, `gen.py` (classification), `compare.py` (first run vs second run by root cause), `checks.py` (claims, directbill, agentdash, reports), `refresh.py`, `v11.py`, `flow2.py` (API read checks), `report2.py` (this file). Raw results `res_<user>.json`, `chk_*.json`, `flow2.json`; screenshots (JPEG q60) in `shots/`.

## Sign-in and session

- All 11 personas signed in through the page; the password box is `type="password"` (masked) for all. None got a "must change password" or two-factor step (also confirmed on the API: `mustChangePassword: false`, no `passwordChangeRequired`). `expiresIn` is 1800 s (30 minutes).
- No `/notifications` call before sign-in any more (first run: two 401s on the login page); every notifications call in the walks answered 200.
- Token refresh: each walk finished within 30 minutes, so no refresh happened on its own. Forced test (`refresh.py`, maria.sales): with an invalid stored access token the Leads screen made its calls, got 401, made **one** `POST /auth/refresh` (200), retried and showed the leads (token replaced: True; screenshot `shots/chk-refresh-invalid-token.jpg`). Setting only the stored expiry time in the past did not trigger an early refresh (the token was still valid, so the screen loaded normally).
- No 429 (rate limit) answers during the walks. Menus: every persona saw exactly the menu the current `menuPermissions.js` defines (no missing, no extra entries).

## Totals per persona (first run vs second run)

"Automated" counts every screen the rules flagged. "Real" removes the test artefacts FP1-FP3 described below (checked on the screenshots). The notifications page is not counted here (see its own section). The visual findings N3, R2 and R3 are on screens the automated rules pass, so they are not in these counts either.

| Persona | User | Run 1 screens | Run 1 pass | Run 1 fail | Run 2 screens | Run 2 pass | Run 2 fail (automated) | Run 2 fail (real) |
|---|---|---|---|---|---|---|---|---|
| Business Administrator (ba) | bea.admin | 119 | 51 | 68 | 120 | 114 | 6 | 3 |
| Sales (sales) | maria.sales | 26 | 10 | 16 | 27 | 26 | 1 | 0 |
| Agent (agent) | ramon.agent | 16 | 6 | 10 | 9 | 9 | 0 | 0 |
| Underwriter (underwriting) | jose.uw | 38 | 14 | 24 | 39 | 38 | 1 | 0 |
| Customer Services (customer-services) | ana.cs | 24 | 8 | 16 | 25 | 24 | 1 | 0 |
| Claims (claims) | carlo.claims | 11 | 2 | 9 | 12 | 11 | 1 | 1 |
| Claims (claims) | lisa.claims2 | 11 | 2 | 9 | 12 | 11 | 1 | 1 |
| Finance (finance) | liza.finance | 51 | 22 | 29 | 49 | 46 | 3 | 2 |
| Finance approver (finance) | fe.approver | 51 | 22 | 29 | 49 | 46 | 3 | 2 |
| User Access Administrator (user-access-admin) | carmela.morfe | 3 | 1 | 2 | 3 | 2 | 1 | 1 |
| IT Administrator (it-admin) | BrokerVerse | 119 | 51 | 68 | 120 | 114 | 6 | 3 |
| **Total** | | 469 | 189 | 280 | 465 | 441 | 24 | 13 |

Menu changes since run 1 (by design): Reports > All Reports (`/reports/catalogue`) added for ba, it-admin, sales, underwriting, customer services, claims and finance; "Trail Balance" renamed "Trial Balance"; agent Renewals reduced to Renewal Policy (7 entries removed, D100); finance lost the Production / Claims / Renewal registers (D104). That is why screen counts differ.

## Status of the first-run failures

| # | First-run failure | Status | Evidence (run 2) |
|---|---|---|---|
| F01 | Retention Analytics crashes (error boundary) | **Fixed** | Opens for ba / it-admin (agent no longer has it); no error boundary, no page error. |
| F02 | Employee Management > Hierarchy crashes | **Fixed** | Opens, Add form validates ("Rank Code is required", ...). |
| F03 | Agent Renewals sub-menu refused by the API (403) | **Changed (fixed by removing the menu)** | Agent menu now only has Renewals > Renewal Policy (D100), which opens with no API error. `GET /policy-renewals/batches` as agent still 403, as designed. |
| F04 | Finance Incentive screens refused (403 read:incentive) | **Fixed** | All 4 incentive screens open for liza.finance / fe.approver; API: calculations 4, approvals 4, agents 7 (D102). |
| F05 | Incentive Statement GET /incentive/statement -> 404 | **Fixed** | 200 for finance and administrators (empty statement + agent selection, D101). |
| F06 | Finance Reinsurance Reconciliation refused (403) | **Fixed** | Screen opens; API 200 (2 pending, 2 exceptions); treaties still 403 for finance, as designed (D103). |
| F07 | Report screens: "Requires permission: read:users" (agent filter) | **Fixed** | Report screens now call `GET /reports/filters/agents` (200 for sales, underwriting, CS, claims, finance). No API error on any report screen. |
| F08 | Remittance Approval Workflow GET /users -> 403 | **Fixed** | Uses `GET /remittance/approvals/approvers` (200, 4 users). |
| F09 | Claims: Clients "Create Lead" opens "Not authorised" | **Fixed** | Create Lead no longer offered to carlo.claims / lisa.claims2. **But see N1**: the same pattern now occurs on Operations > Policy "Create Policy". |
| F10 | Underwriter: Treaty Dashboard "Add Treaty" opens "Not authorised" | **Fixed** | jose.uw Treaty Dashboard passes; Add Treaty opens the treaty form. |
| F11 | Create/add forms sent an empty save request (no validation) | **Fixed** | No form sent any request on an empty save in run 2 (0 of 9 screens). Coverage / Rating / UW rule / Lapse campaign / Negotiation update / Remittance adjustment / Incentive program / Treaty all show field messages and a "Please complete" toast. |
| F12 | Empty save showed no required-field message | **Fixed (Product Template, Add Treaty dialog); 2 remaining hits are test artefacts** | Product Templates "Create" lists 5 required fields. The remaining hits are FP1 (Product Configurator Dashboard "Create Template" is a link to the template list, not a save) and FP2 (Remittance Exceptions "Create report" now exports "4 exception(s) exported to remittance_exception_report_2026-09-29.csv" in the browser, no form). |
| F13 | Raw i18n keys on Account Category headers | **Fixed** | No raw i18n key on any screen. |
| F14 | Dates not in DD/MM/YYYY (57 screens) | **Mostly fixed; still failing on 3 screens** | Role master "Modified On", Remittance History > System Logs "Timestamp", Remittance Analytics > Alerts & Insights "Time" (see R1). All other screens, date pickers and report criteria show DD/MM/YYYY. |
| F15 | Content past the right edge at 1440 px (5 screens) | **Fixed** | Executive / Claims dashboards, Quotation KPI row and Remittance Analytics Top Performers clean. Configuration still flagged by the rule but the tab strip now scrolls with an arrow (FP3, `shots/bea.admin__016-master-configuration.jpg`). |
| V1 | Executive Dashboard title dark on the navy banner | **Fixed** | White title (`shots/bea.admin__001-dashboard-executive-dashboard.jpg`). |
| V2 | Dashboard date range cut and MM/DD/YYYY; not matching "This Month" | **Fixed (note)** | Shows "29/08/2026 - 29/09/2026" in full. Note: "This Month" is a rolling month (29/08-29/09), not 01/09-29/09 - confirm that is intended. |
| V3 | Lapse campaign / negotiation dialogs laid out label-beside-field | **Fixed** | Labels above fields, two-column grid, message under the field (`shots/bea.admin__064-renewals-lapse-management-validate.jpg`, `shots/bea.admin__063-renewals-negotiations-validate.jpg`). |
| V4 | Dollar icon next to peso "Revenue at Risk" | **Fixed** | Wallet icon. |
| V5 | Policy list header "GrossPremium" | **Fixed** | "Gross Premium". |
| V6 | Menu "Trail Balance" | **Fixed** | Menu reads "Trial Balance". |
| V7 | Configuration tabs as raw lower-case keys; technical key under each field | **Fixed** | Tabs "General, Accounting, Branding, Claims, ..."; no key text under the fields. |
| V8 | Wrong required-field wording | **Partly fixed - still failing** | Employee messages correct and middle name optional. Still "This field Code is required" on Company, Branch, State and Bank add forms (and Exchange Rate / Department / bank account forms in code); mixed "This Field is Required" capitalisation and "TaxCode is required" (see R2). |
| V9 | Master "Add" controls are clickable divs | **Partly fixed - still failing on 2 screens** | Master, Disbursement and Negotiation add controls are buttons now. User and Role "Add" are still `<div>`s (D115 left the User master tables out on purpose, see R3). |
| V10 | Role icons cut; Add Role Save silent on empty form | **Fixed** | Fixed-size icons; Save lists "Role Code / Role Name / Menu Access / Permissions is required" in a toast and under the fields. |
| V11 | User list e-mail "-" for every user | **Fixed** | Page 2 shows fe.approver@brokerverse.test etc.; the "-" rows are the users with no e-mail in the API (`shots/chk-v11-user-list-page2.jpg`). |
| V12 | Create Policy / Create Batch / New schedule not confirmed | **Fixed** | Create Policy > Motor opens Leads (for roles with Leads); Create Batch opens Selection Criteria with "Generate Policy List"; New schedule keeps its save button disabled until Code, Name, Frequency are filled. |

### Data-flow checks from the first run

| Check | First run | Run 2 | Status |
|---|---|---|---|
| Agent dashboard vs quotation list (ramon.agent) | Dashboard funnel 9, list 10 | Funnel `quotations: 10`, quotation list "1 - 10 of 10" (Total Quotations 10); leads 2 = 2, policies 2 = 2. The dashboard screen shows Total Leads 2, Total Clients 2, Policy Sold 2 (it has no quotation card) | **Fixed** |
| POL-2026-00001 premium equals the draft QT-2026-00002 | noted | Not re-checked (data question, no fix listed) | Open question |
| Agent dashboard collected premium ₱0.00 (D118) | - | Collected Premium ₱40,086.27, Receivables ₱0.00, Gross ₱68,655.80 (`shots/chk-agentdash-home.jpg`) | Fixed |
| Finance lists | Receipts 28, JV 6, Disb 23; Incentive and RI reconciliation empty (403) | Receipts 28, JV 6, Disbursements 23, incentive calculations 4 / approvals 4, reconciliation 2 pending + 2 exceptions | **Fixed** |
| Claims users read /leads (18 rows) | 200 | `GET /leads` 403 for carlo.claims and lisa.claims2 (D92); claims 17 for both | **Fixed (by design)** |
| Sales / CS read /receipts | 200 (28) | 403 for maria.sales, ana.cs (and jose.uw) (D92) | **Fixed (by design)** |
| CLM-2026-90015 reported before loss | noted | Explained in D107 (dates were DD/MM read as MM/DD); not re-opened | Closed |
| carmela.morfe only users / roles / audit | correct | Same: users 200 (22), roles 200 (9), policies / receipts / claims / leads 403 | Unchanged (correct) |
| `/notifications` 401 on the login page | 2 per sign-in | 0 | **Fixed** |

## Targeted re-checks

### Notifications page for every role

| Persona | Opens | Not authorised | API errors | Screenshot |
|---|---|---|---|---|
| bea.admin | yes | no | none | shots/bea.admin__121-extra-notifications.jpg |
| maria.sales | yes | no | none | shots/maria.sales__028-extra-notifications.jpg |
| ramon.agent | yes | no | none | shots/ramon.agent__010-extra-notifications-form.jpg |
| jose.uw | yes | no | none | shots/jose.uw__040-extra-notifications-form.jpg |
| ana.cs | yes | no | none | shots/ana.cs__026-extra-notifications.jpg |
| carlo.claims | yes | no | none | shots/carlo.claims__013-extra-notifications-form.jpg |
| lisa.claims2 | yes | no | none | shots/lisa.claims2__013-extra-notifications-form.jpg |
| liza.finance | yes | no | none | shots/liza.finance__050-extra-notifications.jpg |
| fe.approver | yes | no | none | shots/fe.approver__050-extra-notifications.jpg |
| carmela.morfe | yes | no | none | shots/carmela.morfe__004-extra-notifications.jpg |
| BrokerVerse | yes | no | none | shots/BrokerVerse__121-extra-notifications.jpg |

The page opens for all 11 personas (first run: "Not authorised" for finance and the user access administrator, D120). The only real finding on it is N2 (amounts in the notification text). The walk clicked a "NEW" badge, which opens the notification and sends `PUT /notifications/:id/read`; the test blocked that request, which produced the "Failed to mark notification as read" toast (FP4, not a defect).

### Claim pages ("Loading..." header, D123)

carlo.claims opened settlement details, adjuster submission, settlement approval, request approval, claim detail and claim detailed view for one claim of each status (CLM-2026-00001 Pending, CLM-2026-00002 Settled, CLM-2026-90004 Processing, CLM-2026-90007 Pending Approval, CLM-2026-90008 Approved, CLM-2026-90013 Closed, CLM-2026-90015 Rejected): 42 page loads, **0 stuck on "Loading..." or failing**. Each header shows the claim number (e.g. "Andrea Villanueva / Claim: CLM-2026-00002"). Screenshots `shots/chk-claim-*.jpg`. **Fixed.**

### Direct-bill policy POL-2026-00003 (D117)

| Persona | Policy page | "Payment Required" | "PAID" | Payments list row | Screenshots |
|---|---|---|---|---|---|
| bea.admin | "Direct bill" section: "The client pays the premium directly to the insurer..." | no | no | POLICY MIGUEL SANTIAGO CL-2026-00002 POL-2026-00003 28,569.53 28/09/2026 29/10/2026 DIRECT BILL | shots/chk-directbill-policy-bea.admin.jpg, shots/chk-directbill-payments-bea.admin.jpg |
| ramon.agent | "Direct bill" section: "The client pays the premium directly to the insurer..." | no | no | no Payments menu (Not authorised by design) | shots/chk-directbill-policy-ramon.agent.jpg, shots/chk-directbill-payments-ramon.agent.jpg |
| maria.sales | "Direct bill" section: "The client pays the premium directly to the insurer..." | no | no | POLICY MIGUEL SANTIAGO CL-2026-00002 POL-2026-00003 28,569.53 28/09/2026 29/10/2026 DIRECT BILL | shots/chk-directbill-policy-maria.sales.jpg, shots/chk-directbill-payments-maria.sales.jpg |

**Fixed.** Note: opening the policy page sends `POST /s3/presigned-download-urls` (a read done as a POST; it was blocked by the test and the page still rendered).

### Report screens (D104)

| Persona | Reports in All Reports | Every report: CSV / Excel (XLSX) / PDF offered | Preview and Generate enabled | Criteria enable filters | API errors |
|---|---|---|---|---|---|
| bea.admin | 19 (production-register, claims-position, renewal-retention, remittance-summary, commission-statement, premium-by-product, new-vs-renewal, claims-ageing, lead-conversion-funnel, cession-register, premium-receivable-soa, collections-summary, collections-ageing, direct-bill-commission, receipts-register, disbursement-register, journal-register, trial-balance, incentive-results) | yes | yes | yes | 0 |
| maria.sales | 12 (production-register, claims-position, renewal-retention, remittance-summary, commission-statement, premium-by-product, new-vs-renewal, claims-ageing, lead-conversion-funnel, premium-receivable-soa, collections-ageing, incentive-results) | yes | yes | yes | 0 |
| jose.uw | 10 (production-register, claims-position, renewal-retention, remittance-summary, commission-statement, premium-by-product, new-vs-renewal, claims-ageing, lead-conversion-funnel, cession-register) | yes | yes | yes | 0 |
| ana.cs | 9 (production-register, claims-position, renewal-retention, remittance-summary, commission-statement, premium-by-product, new-vs-renewal, claims-ageing, lead-conversion-funnel) | yes | yes | yes | 0 |
| carlo.claims | 8 (production-register, claims-position, renewal-retention, remittance-summary, commission-statement, premium-by-product, new-vs-renewal, claims-ageing) | yes | yes | yes | 0 |
| liza.finance | 14 (remittance-summary, commission-statement, premium-by-product, new-vs-renewal, cession-register, premium-receivable-soa, collections-summary, collections-ageing, direct-bill-commission, receipts-register, disbursement-register, journal-register, trial-balance, incentive-results) | yes | yes | yes | 0 |

Every report screen (the 10 menu report screens in the walk and every `/reports/run/:code`) opened with no API error, Report Criteria / From / To enabled, dates prefilled as DD/MM/YYYY (01/09/2026 - 29/09/2026), the format selector offering CSV, Excel (XLSX) and PDF, and Preview and Generate enabled. Choosing each Report Criteria value enables the matching filter (e.g. Production Register: Agent -> Agent, Branch -> Branch, Principle Insurance -> Company). Preview and Generate were not clicked because both are POST requests. **Fixed.** Notes: the criteria value is spelled "Principle Insurance" (should be "Principal"); some criteria enable no extra filter (Production "Billing Mode", Disbursement "Payee Type", Journal "Account", Journal / Trial Balance "Principle Insurance").

## NEW failures

### N1. Claims: Operations > Policy "Create Policy" opens "Not authorised"

carlo.claims and lisa.claims2: Operations > Policy shows the "Create Policy" drop-down; choosing "Motor Policy" now navigates to `/agent/leadlisting`, which the claims role cannot open, so the screen shows "Not authorised". In run 1 choosing did nothing (V12), so this appeared with the D129 change. Claims is the only role that has Policy but not Leads/Prospects.

Screenshot: `shots/carlo.claims__004-operations-policy-form.jpg`

Suggested cause: `brokerverse/src/agentModule/policyModule/index.jsx:35-38` (`handleCreatePolicy` navigates to `/agent/leadlisting`) and `:131-141` (the Create Policy `<Dropdown>` is always rendered). Show it only when `canOpen("/agent/leadlisting")` (`brokerverse/src/utils/canOpen.js`), as D109 did for Create Lead. The "Bulk Upload" button next to it is also shown to claims users; check whether that role may upload policies.

### N2. Notification texts show amounts without grouping or peso formatting

On the notifications page (liza.finance, fe.approver, bea.admin, BrokerVerse): "liza.finance submitted JV-2026-00117 (85000)", "DN-... to ... for PHP 4598.50 needs approval", "... 26935.02 (ref ...)". Elsewhere amounts are shown as ₱1,234.56. The notifications page was not part of run 1, so this is new in scope rather than a regression.

Screenshot: `shots/liza.finance__050-extra-notifications.jpg`

Suggested cause: the server builds the text with raw numbers: `backend/src/modules/journal-vouchers/router.js:26` (`(${jv.total_debit})`), `backend/src/modules/remittance/directbill.js:379` (`${dn.currency} ${dn.amount.toFixed(2)}`), `backend/src/modules/policies/router.js:84` (`${r.capture.amount.toFixed(2)}`), `backend/src/modules/payments/pettycash.js:108` (`${r.total_amount}`). Format with a shared helper (e.g. `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`).

### N3. Indian "+91" dialling prefix and "Pin Code" on master add forms (found on the screenshots)

Company (phone and fax), Branch, Country and Bank add forms show a fixed "+91" prefix in front of the phone / fax fields; the Company form also labels the postal code "Pin Code". The system is configured for the Philippines (Configuration > General: Phone country code +63, hint "0917 123 4567 or +63 917 123 4567"). Not caught in run 1 (visual only).

Screenshot: `shots/bea.admin__019-organization-company-validate.jpg`

Suggested cause: hard-coded `<div>+91</div>` in `brokerverse/src/module/GeneralMasters/OrganizationMasters/ComapanyMaster/AddCompany/index.js:626,655`, `.../BranchMaster/AddBranch/index.js:468`, `brokerverse/src/module/GeneralMasters/LocationMasters/CountryMaster/AddCountry/index.js:242`, `brokerverse/src/module/FinanceMastersModule/BankMaster/AddBankMaster/index.js:433,459`. Use the configured phone country code setting (general phone country code, +63) and "ZIP Code".

## Remaining (still failing) items

### R1. Dates still in ISO YYYY-MM-DD (F14 remainder)

| Screen | Where | Personas | Screenshot | Suggested cause |
|---|---|---|---|---|
| Master > User Management > Role | "Modified On" column (2026-09-28) | bea.admin, BrokerVerse, carmela.morfe | shots/carmela.morfe__003-user-management-role.jpg | `brokerverse/src/module/GeneralMasters/UserManagementMasters/Role/RoleMaster/index.js:249` prints `modifiedOn` as is; add `body={(r) => formatDate(r.modifiedOn)}` (D115 left the User master tables out on purpose). |
| Accounts > Remittance > History, tab System Logs | "Timestamp" column (2026-09-28, 2026-08-15, ...) | bea.admin, BrokerVerse, liza.finance, fe.approver | shots/liza.finance__033-remittance-history-tab2-system-logs.jpg | `brokerverse/src/module/Remittance/RemittanceHistory/index.js:454` `<Column field="timestamp">` without a date body (the Archive tab next to it uses `dateBody`). |
| Accounts > Remittance > Analytics, tab Alerts & Insights | "Time" column of Recent Alerts (2026-09-01, 2026-09-29) | same four | shots/liza.finance__034-remittance-analytics-tab3-alerts-insights.jpg | `brokerverse/src/module/Remittance/RemittanceAnalytics/index.js:571` `<Column field="timestamp">` without `formatDate`. |

### R2. Required-field wording (V8 remainder)

"This field Code is required" on Company, Branch, State and Bank add forms (screenshot `shots/bea.admin__019-organization-company-validate.jpg`). Hard-coded in `brokerverse/src/module/GeneralMasters/OrganizationMasters/ComapanyMaster/AddCompany/index.js:170`, `.../BranchMaster/AddBranch/index.js:108`, `.../BranchMaster/AddBranch/DepartMentList/index.js:131`, `brokerverse/src/module/GeneralMasters/LocationMasters/StateMaster/AddState/index.js:144`, `brokerverse/src/module/FinanceMastersModule/BankMaster/AddBankMaster/index.js:129`, `.../ExchangeRateMaster/ViewExchange/index.jsx:88`, `.../BankMaster/AccountDataView/ViewAccountData/index.js:66`, `.../EditAccountData/CheckEditData.jsx:36`, plus locale keys `fieldCodeRequired` / `thisFieldCodeRequired` (`brokerverse/src/locales/en.json:252,616,1827`). Also "This Field is Required" (capitalised, `en.json:1796`) next to "This field is required" on Transaction Code, Currency, Exchange Rate and Petty Cash, and "TaxCode / TaxName / TaxRate is required" on Taxation.

### R3. User and Role "Add" are clickable divs (V9 remainder)

`/master/generals/usermanagement/user` and `/role`: "Add" is still a `<div>` with a click handler (not reachable by keyboard). Explicitly left out in D115 ("the two User master tables"). Screenshot `shots/carmela.morfe__002-user-management-user.jpg`.

## Automated hits that are test artefacts (not defects)

| # | Screen | Rule hit | Why it is not a defect |
|---|---|---|---|
| FP1 | Product Configurator > Dashboard | "Create Template" on an empty form showed no message | "Create New Product" opens `/product-configurator/create`, whose "Create Template" button opens the template list and its create dialog (`shots/bea.admin__005-product-configurator-dashboard-validate.jpg`); that dialog validates (Product Templates passes). Same hit in run 1. |
| FP2 | Accounts > Remittance > Exception Management | "Create report" showed no message | Now an export: toast "4 exception(s) exported to remittance_exception_report_2026-09-29.csv" (D105). |
| FP3 | Master > Configuration | content past the right edge | The group tab strip scrolls (arrow at the right); the rule counts the scrolled-out tabs. |
| FP4 | Notifications (all roles) | error toast / write request when the form was opened | The test clicked a "NEW" badge; opening a notification marks it read (`PUT`), which the test blocked. |

## Other observations (not counted as failures)

- Policy detail page sends `POST /s3/presigned-download-urls` when it opens (a read done with POST; blocked by the test, page still rendered). Harmless, but a GET would keep read-only sessions and proxies simple.
- Master > Configuration > General "Available languages" is edited as raw JSON (`[{"code":"en","label":"English"}, ...]`).
- Report criteria spelling "Principle Insurance"; some criteria enable no extra filter (see Report screens).
- Executive Dashboard "This Month" shows a rolling 30-day window (29/08/2026 - 29/09/2026).
- Amounts elsewhere: no Indian grouping, missing thousands separators or non-peso symbols on any menu screen.

## bea.admin - Business Administrator (ba)

Landing page `/`. Menu screens 120, passed 114, failed 6 (run 1: 119 / 51 / 68).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  | New Quote; validation shown (8 msgs) | bea.admin__001-dashboard-executive-dashboard.jpg |
| Claims Dashboard | `/claims/dashboard` | Pass |  |  | bea.admin__002-dashboard-claims-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | Pass |  | New Submission; validation shown (8 msgs) | bea.admin__003-dashboard-underwriting-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass |  | Create Quote > Motor | bea.admin__004-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | FP1 (test artefact): [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | bea.admin__005-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template; validation shown (8 msgs) | bea.admin__006-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | Pass |  | Add Coverage; validation shown (6 msgs) | bea.admin__007-product-configurator-coverage-builder.jpg |
| Rating Engine | `/product-configurator/rating` | Pass |  | Add Factor; validation shown (6 msgs) | bea.admin__008-product-configurator-rating-engine.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | Pass |  | Add Rule; validation shown (8 msgs) | bea.admin__009-product-configurator-underwriting-rules.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | bea.admin__010-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | bea.admin__011-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | bea.admin__012-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | bea.admin__013-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | bea.admin__014-product-configurator-product-analytics.jpg |
| System Settings | `/master/configuration/system-settings` | Pass |  | Add Company Logo | bea.admin__015-master-system-settings.jpg |
| Configuration | `/master/configuration/settings` | **Fail** | FP3 (test artefact): content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Accounting] content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Branding] content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Claims] content runs past... |  | bea.admin__016-master-configuration.jpg |
| Schedules | `/master/configuration/schedules` | Pass |  |  | bea.admin__017-master-schedules.jpg |
| Audit Trail | `/master/configuration/audit-trail` | Pass |  |  | bea.admin__018-master-audit-trail.jpg |
| Organization > Company | `/master/generals/organization/companymaster` | Pass |  | Add; validation shown (8 msgs) | bea.admin__019-organization-company.jpg |
| Organization > Branch | `/master/generals/organization/branchmaster` | Pass |  | Add; validation shown (8 msgs) | bea.admin__020-organization-branch.jpg |
| Insurance Management > Insurance Company | `/master/generals/insurancemanagement/insurancecompany` | Pass |  | Add; validation shown (8 msgs) | bea.admin__021-insurance-management-insurance-company.jpg |
| Insurance Management > Line of Business | `/master/generals/insurancemanagement/lineofbusiness` | Pass |  | Add; validation shown (3 msgs) | bea.admin__022-insurance-management-line-of-business.jpg |
| Insurance Management > Product | `/master/generals/insurancemanagement/productmaster` | Pass |  | Add; validation shown (4 msgs) | bea.admin__023-insurance-management-product.jpg |
| Insurance Management > Cover | `/master/generals/insurancemanagement/cover` | Pass |  | Add; validation shown (3 msgs) | bea.admin__024-insurance-management-cover.jpg |
| Insurance Management > Signatories | `/master/generals/insurancemanagement/signatories` | Pass |  | Add; validation shown (3 msgs) | bea.admin__025-insurance-management-signatories.jpg |
| Insurance Management > Vehicle | `/master/generals/insurancemanagement/vehicle` | Pass |  | Add; validation shown (6 msgs) | bea.admin__026-insurance-management-vehicle.jpg |
| Location > Country | `/master/generals/location/country` | Pass |  | Add; validation shown (3 msgs) | bea.admin__027-location-country.jpg |
| Location > State | `/master/generals/location/state` | Pass |  | Add; validation shown (4 msgs) | bea.admin__028-location-state.jpg |
| Location > City Master | `/master/generals/location/city` | Pass |  | Add; validation shown (4 msgs) | bea.admin__029-location-city-master.jpg |
| Generals > Commission | `/master/generals/commission` | Pass |  | Add; validation shown (7 msgs) | bea.admin__030-generals-commission.jpg |
| Employee Management > Hierarchy | `/master/generals/employeemanagement/hierarchy` | Pass |  | Add; validation shown (6 msgs) | bea.admin__031-employee-management-hierarchy.jpg |
| Employee Management > Designation | `/master/generals/employeemanagement/designation` | Pass |  | Add; save disabled until filled | bea.admin__032-employee-management-designation.jpg |
| Employee Management > Employee | `/master/generals/employeemanagement/employee` | Pass |  | Add; validation shown (8 msgs) | bea.admin__033-employee-management-employee.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | bea.admin__034-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); validation shown (8 msgs) | bea.admin__035-user-management-role.jpg |
| Finance > Premium Account Setup | `/master/finance/premium-account-setup` | Pass |  |  | bea.admin__036-finance-premium-account-setup.jpg |
| Finance > Miscellaneous Account Setup | `/master/finance/miscellaneous-account-setup` | Pass |  |  | bea.admin__037-finance-miscellaneous-account-setup.jpg |
| Finance > Customer Account Setup | `/master/finance/customer-account-setup` | Pass |  |  | bea.admin__038-finance-customer-account-setup.jpg |
| Finance > RI-Claims Account Setup | `/master/finance/ri-claim-account-setup` | Pass |  |  | bea.admin__039-finance-ri-claims-account-setup.jpg |
| Finance > Transaction code | `/master/finance/transactioncode` | Pass |  | Add; validation shown (8 msgs) | bea.admin__040-finance-transaction-code.jpg |
| Finance > Currency | `/master/finance/currency` | Pass |  | Add; validation shown (8 msgs) | bea.admin__041-finance-currency.jpg |
| Finance > Exchange Rate | `/master/finance/exchangerate` | Pass |  | Add; validation shown (3 msgs) | bea.admin__042-finance-exchange-rate.jpg |
| Finance > Bank | `/master/finance/bank` | Pass |  | Add; validation shown (8 msgs) | bea.admin__043-finance-bank.jpg |
| Finance > Account Category | `/master/finance/accountcategory` | Pass |  | Add; validation shown (3 msgs) | bea.admin__044-finance-account-category.jpg |
| Finance > Main Account | `/master/finance/mainaccount` | Pass |  | Add | bea.admin__045-finance-main-account.jpg |
| Finance > Sub Account | `/master/finance/subaccount` | Pass |  | Add | bea.admin__046-finance-sub-account.jpg |
| Finance > Taxation | `/master/finance/taxation` | Pass |  | Add; validation shown (8 msgs) | bea.admin__047-finance-taxation.jpg |
| Finance > Petty cash | `/master/finance/pettycash` | Pass |  | Add; validation shown (6 msgs) | bea.admin__048-finance-petty-cash.jpg |
| Finance > Remittance Master | `/master/finance/remittance` | Pass |  | Add; validation shown (4 msgs) | bea.admin__049-finance-remittance-master.jpg |
| Finance > Incentive Programs | `/master/incentive/programs/view` | Pass |  | Add Program; validation shown (8 msgs) | bea.admin__050-finance-incentive-programs.jpg |
| Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | Pass |  | Add Treaty; validation shown (8 msgs) | bea.admin__051-finance-reinsurance-treaty.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | bea.admin__052-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | bea.admin__053-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | bea.admin__054-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | bea.admin__055-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | bea.admin__056-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | bea.admin__057-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | bea.admin__058-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | Pass |  | Create Batch | bea.admin__059-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | bea.admin__060-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | Pass |  |  | bea.admin__061-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | bea.admin__062-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | Pass |  | Add Update (div, not a button); validation shown (2 msgs) | bea.admin__063-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | Pass |  | Create Campaign; validation shown (2 msgs) | bea.admin__064-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | bea.admin__065-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | bea.admin__066-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | bea.admin__067-operations-payments.jpg |
| Receipts | `/accounts/receipts` | Pass |  |  | bea.admin__068-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass |  |  | bea.admin__069-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | bea.admin__070-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | bea.admin__071-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass |  |  | bea.admin__072-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass |  |  | bea.admin__073-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | Pass |  | Create; validation shown (7 msgs) | bea.admin__074-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | Pass |  |  | bea.admin__075-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | Pass |  |  | bea.admin__076-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | Pass |  |  | bea.admin__077-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass |  |  | bea.admin__078-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass |  |  | bea.admin__079-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | Pass |  |  | bea.admin__080-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | bea.admin__081-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | bea.admin__082-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | bea.admin__083-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | bea.admin__084-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | bea.admin__085-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass |  | Add policies > Validation failed; validation shown (2 msgs) | bea.admin__086-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | bea.admin__087-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | bea.admin__088-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | Pass |  | New schedule | bea.admin__089-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | bea.admin__090-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | bea.admin__091-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | FP2 (test artefact): [validate] 'Create report' on an empty form showed no required-field message | Create report > Create report | bea.admin__092-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | bea.admin__093-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass |  |  | bea.admin__094-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | Pass |  | New Adjustment; validation shown (8 msgs) | bea.admin__095-remittance-adjustments.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | bea.admin__096-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | bea.admin__097-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | bea.admin__098-remittance-analytics-tab3-alerts-insights.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | bea.admin__099-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | bea.admin__100-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | bea.admin__101-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | Pass |  |  | bea.admin__102-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | bea.admin__103-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | bea.admin__104-commission-agents-referrer-accounts.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | Pass |  | Add Treaty; validation shown (8 msgs) | bea.admin__105-reinsurance-treaty-dashboard.jpg |
| Cession Tracking | `/reinsurance/cessions` | Pass |  |  | bea.admin__106-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | Pass |  |  | bea.admin__107-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | Pass |  |  | bea.admin__108-reinsurance-reconciliation.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | bea.admin__109-reinsurance-analytics.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | bea.admin__110-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | bea.admin__111-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | bea.admin__112-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | bea.admin__113-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | bea.admin__114-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | bea.admin__115-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | Pass |  |  | bea.admin__116-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | Pass |  |  | bea.admin__117-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | Pass |  |  | bea.admin__118-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | Pass |  |  | bea.admin__119-financial-reports-journal.jpg |
| Financial Reports > Trial Balance | `/reports/financialreports/trailbalance` | Pass |  |  | bea.admin__120-financial-reports-trial-balance.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | amounts without thousands grouping: PHP 4598.50; [form] amounts without thousands grouping: PHP 4598.50; FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_024f6cdfb1353d8a/read (blocked by test) | NEW (div, not a button) > Error | bea.admin__121-extra-notifications.jpg |

## maria.sales - Sales (sales)

Landing page `/`. Menu screens 27, passed 26, failed 1 (run 1: 26 / 10 / 16).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  | New Quote; validation shown (8 msgs) | maria.sales__001-dashboard-executive-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass |  | Create Quote > Motor | maria.sales__002-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | FP1 (test artefact): [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | maria.sales__003-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template; validation shown (8 msgs) | maria.sales__004-product-configurator-product-templates.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | maria.sales__005-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | maria.sales__006-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | maria.sales__007-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | maria.sales__008-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | maria.sales__009-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | maria.sales__010-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | maria.sales__011-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | Pass |  | Create Batch | maria.sales__012-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | maria.sales__013-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | Pass |  |  | maria.sales__014-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | maria.sales__015-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | Pass |  | Add Update (div, not a button); validation shown (2 msgs) | maria.sales__016-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | Pass |  | Create Campaign; validation shown (2 msgs) | maria.sales__017-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | maria.sales__018-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | maria.sales__019-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | maria.sales__020-operations-payments.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | maria.sales__021-commission-commission-dashboard.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | maria.sales__022-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | maria.sales__023-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | maria.sales__024-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | maria.sales__025-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | maria.sales__026-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | maria.sales__027-operational-reports-broker-commission.jpg |
| (extra) Notifications | `/agent/notification` | Pass |  |  | maria.sales__028-extra-notifications.jpg |

## ramon.agent - Agent (agent)

Landing page `/agent/home`. Menu screens 9, passed 9, failed 0 (run 1: 16 / 6 / 10).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Agent Dashboard | `/agent/home` | Pass |  | Create Quote > Motor | ramon.agent__001-dashboard-agent-dashboard.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | ramon.agent__002-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ramon.agent__003-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ramon.agent__004-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | ramon.agent__005-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | ramon.agent__006-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | ramon.agent__007-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | ramon.agent__008-renewals-renewal-policy.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | ramon.agent__009-commission-commission-dashboard.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_2cfaf8f6756131ba/read (blocked by test) | NEW (div, not a button) > Error | ramon.agent__010-extra-notifications-form.jpg |

## jose.uw - Underwriter (underwriting)

Landing page `/`. Menu screens 39, passed 38, failed 1 (run 1: 38 / 14 / 24).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  | New Quote; validation shown (8 msgs) | jose.uw__001-dashboard-executive-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | Pass |  | New Submission; validation shown (8 msgs) | jose.uw__002-dashboard-underwriting-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | FP1 (test artefact): [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | jose.uw__003-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template; validation shown (8 msgs) | jose.uw__004-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | Pass |  | Add Coverage; validation shown (6 msgs) | jose.uw__005-product-configurator-coverage-builder.jpg |
| Rating Engine | `/product-configurator/rating` | Pass |  | Add Factor; validation shown (6 msgs) | jose.uw__006-product-configurator-rating-engine.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | Pass |  | Add Rule; validation shown (8 msgs) | jose.uw__007-product-configurator-underwriting-rules.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | jose.uw__008-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | jose.uw__009-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | jose.uw__010-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | jose.uw__011-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | jose.uw__012-product-configurator-product-analytics.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | jose.uw__013-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | jose.uw__014-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | jose.uw__015-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | jose.uw__016-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | jose.uw__017-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | jose.uw__018-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | jose.uw__019-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | Pass |  | Create Batch | jose.uw__020-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | jose.uw__021-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | Pass |  |  | jose.uw__022-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | jose.uw__023-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | Pass |  | Add Update (div, not a button); validation shown (2 msgs) | jose.uw__024-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | Pass |  | Create Campaign; validation shown (2 msgs) | jose.uw__025-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | jose.uw__026-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | jose.uw__027-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | jose.uw__028-operations-payments.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | Pass |  |  | jose.uw__029-reinsurance-treaty-dashboard.jpg |
| Cession Tracking | `/reinsurance/cessions` | Pass |  |  | jose.uw__030-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | Pass |  |  | jose.uw__031-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | Pass |  |  | jose.uw__032-reinsurance-reconciliation.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | jose.uw__033-reinsurance-analytics.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | jose.uw__034-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | jose.uw__035-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | jose.uw__036-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | jose.uw__037-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | jose.uw__038-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | jose.uw__039-operational-reports-broker-commission.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_9d1b773fb70352e9/read (blocked by test) | NEW (div, not a button) > Error | jose.uw__040-extra-notifications-form.jpg |

## ana.cs - Customer Services (customer-services)

Landing page `/`. Menu screens 25, passed 24, failed 1 (run 1: 24 / 8 / 16).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  | New Quote; validation shown (8 msgs) | ana.cs__001-dashboard-executive-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | FP1 (test artefact): [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | ana.cs__002-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template; validation shown (8 msgs) | ana.cs__003-product-configurator-product-templates.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | ana.cs__004-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ana.cs__005-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ana.cs__006-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | ana.cs__007-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | ana.cs__008-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | ana.cs__009-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | ana.cs__010-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | Pass |  | Create Batch | ana.cs__011-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | ana.cs__012-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | Pass |  |  | ana.cs__013-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | ana.cs__014-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | Pass |  | Add Update (div, not a button); validation shown (2 msgs) | ana.cs__015-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | Pass |  | Create Campaign; validation shown (2 msgs) | ana.cs__016-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | ana.cs__017-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | ana.cs__018-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | ana.cs__019-operations-payments.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | ana.cs__020-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | ana.cs__021-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | ana.cs__022-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | ana.cs__023-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | ana.cs__024-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | ana.cs__025-operational-reports-broker-commission.jpg |
| (extra) Notifications | `/agent/notification` | Pass |  |  | ana.cs__026-extra-notifications.jpg |

## carlo.claims - Claims (claims)

Landing page `/claims/dashboard`. Menu screens 12, passed 11, failed 1 (run 1: 11 / 2 / 9).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Claims Dashboard | `/claims/dashboard` | Pass |  |  | carlo.claims__001-dashboard-claims-dashboard.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | carlo.claims__002-operations-home.jpg |
| Clients | `/agent/clientlisting` | Pass |  |  | carlo.claims__003-operations-clients.jpg |
| Policy | `/agent/policy` | **Fail** | [form] "Not authorised" on a screen its own menu offers | Create Policy > Motor Policy | carlo.claims__004-operations-policy-form.jpg |
| Claims | `/agent/claim` | Pass |  |  | carlo.claims__005-operations-claims.jpg |
| Claims Recovery | `/reinsurance/claims` | Pass |  |  | carlo.claims__006-reinsurance-claims-recovery.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | carlo.claims__007-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | carlo.claims__008-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | carlo.claims__009-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | carlo.claims__010-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | carlo.claims__011-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | carlo.claims__012-operational-reports-broker-commission.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_fc1e7bf68efba9ad/read (blocked by test) | New claim CLM-2026-00001 NEW normal (div, not a button) > Error | carlo.claims__013-extra-notifications-form.jpg |

## lisa.claims2 - Claims (claims)

Landing page `/claims/dashboard`. Menu screens 12, passed 11, failed 1 (run 1: 11 / 2 / 9).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Claims Dashboard | `/claims/dashboard` | Pass |  |  | lisa.claims2__001-dashboard-claims-dashboard.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | lisa.claims2__002-operations-home.jpg |
| Clients | `/agent/clientlisting` | Pass |  |  | lisa.claims2__003-operations-clients.jpg |
| Policy | `/agent/policy` | **Fail** | [form] "Not authorised" on a screen its own menu offers | Create Policy > Motor Policy | lisa.claims2__004-operations-policy-form.jpg |
| Claims | `/agent/claim` | Pass |  |  | lisa.claims2__005-operations-claims.jpg |
| Claims Recovery | `/reinsurance/claims` | Pass |  |  | lisa.claims2__006-reinsurance-claims-recovery.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | lisa.claims2__007-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | lisa.claims2__008-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | lisa.claims2__009-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | lisa.claims2__010-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | lisa.claims2__011-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | lisa.claims2__012-operational-reports-broker-commission.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_f74755672d3b1c4f/read (blocked by test) | NEW (div, not a button) > Error | lisa.claims2__013-extra-notifications-form.jpg |

## liza.finance - Finance (finance)

Landing page `/`. Menu screens 49, passed 46, failed 3 (run 1: 51 / 22 / 29).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  |  | liza.finance__001-dashboard-executive-dashboard.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | liza.finance__002-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | liza.finance__003-operations-payments.jpg |
| Receipts | `/accounts/receipts` | Pass |  |  | liza.finance__004-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass |  |  | liza.finance__005-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | liza.finance__006-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | liza.finance__007-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass |  |  | liza.finance__008-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass |  |  | liza.finance__009-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | Pass |  | Create; validation shown (7 msgs) | liza.finance__010-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | Pass |  |  | liza.finance__011-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | Pass |  |  | liza.finance__012-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | Pass |  |  | liza.finance__013-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass |  |  | liza.finance__014-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass |  |  | liza.finance__015-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | Pass |  |  | liza.finance__016-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | liza.finance__017-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | liza.finance__018-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | liza.finance__019-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | liza.finance__020-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | liza.finance__021-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass |  | Add policies > Validation failed; validation shown (2 msgs) | liza.finance__022-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | liza.finance__023-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | liza.finance__024-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | Pass |  | New schedule | liza.finance__025-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | liza.finance__026-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | liza.finance__027-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | FP2 (test artefact): [validate] 'Create report' on an empty form showed no required-field message | Create report > Create report | liza.finance__028-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | liza.finance__029-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass |  |  | liza.finance__030-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | Pass |  | New Adjustment; validation shown (8 msgs) | liza.finance__031-remittance-adjustments.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | liza.finance__032-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | liza.finance__033-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | liza.finance__034-remittance-analytics-tab3-alerts-insights.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | liza.finance__035-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | liza.finance__036-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | liza.finance__037-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | Pass |  |  | liza.finance__038-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | liza.finance__039-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | liza.finance__040-commission-agents-referrer-accounts.jpg |
| Reconciliation | `/reinsurance/reconciliation` | Pass |  |  | liza.finance__041-reinsurance-reconciliation.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | liza.finance__042-reports-all-reports.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | liza.finance__043-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | liza.finance__044-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | Pass |  |  | liza.finance__045-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | Pass |  |  | liza.finance__046-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | Pass |  |  | liza.finance__047-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | Pass |  |  | liza.finance__048-financial-reports-journal.jpg |
| Financial Reports > Trial Balance | `/reports/financialreports/trailbalance` | Pass |  |  | liza.finance__049-financial-reports-trial-balance.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | amounts without thousands grouping: PHP 4598.50, 26935.02; [form] amounts without thousands grouping: PHP 4598.50, 26935.02; FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_643a727cd7cd5b72/read (blocked by test) | NEW (div, not a button) > Error | liza.finance__050-extra-notifications.jpg |

## fe.approver - Finance approver (finance)

Landing page `/`. Menu screens 49, passed 46, failed 3 (run 1: 51 / 22 / 29).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  |  | fe.approver__001-dashboard-executive-dashboard.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | fe.approver__002-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | fe.approver__003-operations-payments.jpg |
| Receipts | `/accounts/receipts` | Pass |  |  | fe.approver__004-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass |  |  | fe.approver__005-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | fe.approver__006-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | fe.approver__007-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass |  |  | fe.approver__008-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass |  |  | fe.approver__009-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | Pass |  | Create; validation shown (7 msgs) | fe.approver__010-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | Pass |  |  | fe.approver__011-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | Pass |  |  | fe.approver__012-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | Pass |  |  | fe.approver__013-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass |  |  | fe.approver__014-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass |  |  | fe.approver__015-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | Pass |  |  | fe.approver__016-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | fe.approver__017-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | fe.approver__018-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | fe.approver__019-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | fe.approver__020-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | fe.approver__021-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass |  | Add policies > Validation failed; validation shown (2 msgs) | fe.approver__022-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | fe.approver__023-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | fe.approver__024-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | Pass |  | New schedule | fe.approver__025-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | fe.approver__026-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | fe.approver__027-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | FP2 (test artefact): [validate] 'Create report' on an empty form showed no required-field message | Create report > Create report | fe.approver__028-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | fe.approver__029-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass |  |  | fe.approver__030-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | Pass |  | New Adjustment; validation shown (8 msgs) | fe.approver__031-remittance-adjustments.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | fe.approver__032-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | fe.approver__033-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | fe.approver__034-remittance-analytics-tab3-alerts-insights.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | fe.approver__035-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | fe.approver__036-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | fe.approver__037-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | Pass |  |  | fe.approver__038-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | fe.approver__039-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | fe.approver__040-commission-agents-referrer-accounts.jpg |
| Reconciliation | `/reinsurance/reconciliation` | Pass |  |  | fe.approver__041-reinsurance-reconciliation.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | fe.approver__042-reports-all-reports.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | fe.approver__043-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | fe.approver__044-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | Pass |  |  | fe.approver__045-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | Pass |  |  | fe.approver__046-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | Pass |  |  | fe.approver__047-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | Pass |  |  | fe.approver__048-financial-reports-journal.jpg |
| Financial Reports > Trial Balance | `/reports/financialreports/trailbalance` | Pass |  |  | fe.approver__049-financial-reports-trial-balance.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | amounts without thousands grouping: PHP 4598.50, 26935.02; [form] amounts without thousands grouping: PHP 4598.50, 26935.02; FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_024f6cdfb1353d8a/read (blocked by test) | NEW (div, not a button) > Error | fe.approver__050-extra-notifications.jpg |

## carmela.morfe - User Access Administrator (user-access-admin)

Landing page `/master/configuration/audit-trail`. Menu screens 3, passed 2, failed 1 (run 1: 3 / 1 / 2).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Audit Trail | `/master/configuration/audit-trail` | Pass |  |  | carmela.morfe__001-master-audit-trail.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | carmela.morfe__002-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); validation shown (8 msgs) | carmela.morfe__003-user-management-role.jpg |
| (extra) Notifications | `/agent/notification` | Pass |  |  | carmela.morfe__004-extra-notifications.jpg |

## BrokerVerse - IT Administrator (it-admin)

Landing page `/`. Menu screens 120, passed 114, failed 6 (run 1: 119 / 51 / 68).

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | Pass |  | New Quote; validation shown (8 msgs) | BrokerVerse__001-dashboard-executive-dashboard.jpg |
| Claims Dashboard | `/claims/dashboard` | Pass |  |  | BrokerVerse__002-dashboard-claims-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | Pass |  | New Submission; validation shown (8 msgs) | BrokerVerse__003-dashboard-underwriting-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass |  | Create Quote > Motor | BrokerVerse__004-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | FP1 (test artefact): [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | BrokerVerse__005-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template; validation shown (8 msgs) | BrokerVerse__006-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | Pass |  | Add Coverage; validation shown (6 msgs) | BrokerVerse__007-product-configurator-coverage-builder.jpg |
| Rating Engine | `/product-configurator/rating` | Pass |  | Add Factor; validation shown (6 msgs) | BrokerVerse__008-product-configurator-rating-engine.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | Pass |  | Add Rule; validation shown (8 msgs) | BrokerVerse__009-product-configurator-underwriting-rules.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | BrokerVerse__010-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | BrokerVerse__011-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | BrokerVerse__012-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | BrokerVerse__013-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | BrokerVerse__014-product-configurator-product-analytics.jpg |
| System Settings | `/master/configuration/system-settings` | Pass |  | Add Company Logo | BrokerVerse__015-master-system-settings.jpg |
| Configuration | `/master/configuration/settings` | **Fail** | FP3 (test artefact): content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Accounting] content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Branding] content runs past the right edge: Document numbering | E-mail | Endorsements; FP3 (test artefact): [tab:Claims] content runs past... |  | BrokerVerse__016-master-configuration.jpg |
| Schedules | `/master/configuration/schedules` | Pass |  |  | BrokerVerse__017-master-schedules.jpg |
| Audit Trail | `/master/configuration/audit-trail` | Pass |  |  | BrokerVerse__018-master-audit-trail.jpg |
| Organization > Company | `/master/generals/organization/companymaster` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__019-organization-company.jpg |
| Organization > Branch | `/master/generals/organization/branchmaster` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__020-organization-branch.jpg |
| Insurance Management > Insurance Company | `/master/generals/insurancemanagement/insurancecompany` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__021-insurance-management-insurance-company.jpg |
| Insurance Management > Line of Business | `/master/generals/insurancemanagement/lineofbusiness` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__022-insurance-management-line-of-business.jpg |
| Insurance Management > Product | `/master/generals/insurancemanagement/productmaster` | Pass |  | Add; validation shown (4 msgs) | BrokerVerse__023-insurance-management-product.jpg |
| Insurance Management > Cover | `/master/generals/insurancemanagement/cover` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__024-insurance-management-cover.jpg |
| Insurance Management > Signatories | `/master/generals/insurancemanagement/signatories` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__025-insurance-management-signatories.jpg |
| Insurance Management > Vehicle | `/master/generals/insurancemanagement/vehicle` | Pass |  | Add; validation shown (6 msgs) | BrokerVerse__026-insurance-management-vehicle.jpg |
| Location > Country | `/master/generals/location/country` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__027-location-country.jpg |
| Location > State | `/master/generals/location/state` | Pass |  | Add; validation shown (4 msgs) | BrokerVerse__028-location-state.jpg |
| Location > City Master | `/master/generals/location/city` | Pass |  | Add; validation shown (4 msgs) | BrokerVerse__029-location-city-master.jpg |
| Generals > Commission | `/master/generals/commission` | Pass |  | Add; validation shown (7 msgs) | BrokerVerse__030-generals-commission.jpg |
| Employee Management > Hierarchy | `/master/generals/employeemanagement/hierarchy` | Pass |  | Add; validation shown (6 msgs) | BrokerVerse__031-employee-management-hierarchy.jpg |
| Employee Management > Designation | `/master/generals/employeemanagement/designation` | Pass |  | Add; save disabled until filled | BrokerVerse__032-employee-management-designation.jpg |
| Employee Management > Employee | `/master/generals/employeemanagement/employee` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__033-employee-management-employee.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | BrokerVerse__034-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); validation shown (8 msgs) | BrokerVerse__035-user-management-role.jpg |
| Finance > Premium Account Setup | `/master/finance/premium-account-setup` | Pass |  |  | BrokerVerse__036-finance-premium-account-setup.jpg |
| Finance > Miscellaneous Account Setup | `/master/finance/miscellaneous-account-setup` | Pass |  |  | BrokerVerse__037-finance-miscellaneous-account-setup.jpg |
| Finance > Customer Account Setup | `/master/finance/customer-account-setup` | Pass |  |  | BrokerVerse__038-finance-customer-account-setup.jpg |
| Finance > RI-Claims Account Setup | `/master/finance/ri-claim-account-setup` | Pass |  |  | BrokerVerse__039-finance-ri-claims-account-setup.jpg |
| Finance > Transaction code | `/master/finance/transactioncode` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__040-finance-transaction-code.jpg |
| Finance > Currency | `/master/finance/currency` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__041-finance-currency.jpg |
| Finance > Exchange Rate | `/master/finance/exchangerate` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__042-finance-exchange-rate.jpg |
| Finance > Bank | `/master/finance/bank` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__043-finance-bank.jpg |
| Finance > Account Category | `/master/finance/accountcategory` | Pass |  | Add; validation shown (3 msgs) | BrokerVerse__044-finance-account-category.jpg |
| Finance > Main Account | `/master/finance/mainaccount` | Pass |  | Add | BrokerVerse__045-finance-main-account.jpg |
| Finance > Sub Account | `/master/finance/subaccount` | Pass |  | Add | BrokerVerse__046-finance-sub-account.jpg |
| Finance > Taxation | `/master/finance/taxation` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__047-finance-taxation.jpg |
| Finance > Petty cash | `/master/finance/pettycash` | Pass |  | Add; validation shown (6 msgs) | BrokerVerse__048-finance-petty-cash.jpg |
| Finance > Remittance Master | `/master/finance/remittance` | Pass |  | Add; validation shown (4 msgs) | BrokerVerse__049-finance-remittance-master.jpg |
| Finance > Incentive Programs | `/master/incentive/programs/view` | Pass |  | Add Program; validation shown (8 msgs) | BrokerVerse__050-finance-incentive-programs.jpg |
| Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | Pass |  | Add Treaty; validation shown (8 msgs) | BrokerVerse__051-finance-reinsurance-treaty.jpg |
| Home | `/agent/home` | Pass |  | Create Quote > Motor | BrokerVerse__052-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | BrokerVerse__053-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | BrokerVerse__054-operations-clients.jpg |
| Quotation | `/agent/Quotation` | Pass |  | Create Quote > Motor Quote | BrokerVerse__055-operations-quotation.jpg |
| Policy | `/agent/policy` | Pass |  | Create Policy > Motor Policy | BrokerVerse__056-operations-policy.jpg |
| Claims | `/agent/claim` | Pass |  |  | BrokerVerse__057-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass |  |  | BrokerVerse__058-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | Pass |  | Create Batch | BrokerVerse__059-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | BrokerVerse__060-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | Pass |  |  | BrokerVerse__061-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | BrokerVerse__062-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | Pass |  | Add Update (div, not a button); validation shown (2 msgs) | BrokerVerse__063-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | Pass |  | Create Campaign; validation shown (2 msgs) | BrokerVerse__064-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | BrokerVerse__065-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | BrokerVerse__066-operations-open-items.jpg |
| Payments | `/agent/payments` | Pass |  |  | BrokerVerse__067-operations-payments.jpg |
| Receipts | `/accounts/receipts` | Pass |  |  | BrokerVerse__068-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass |  |  | BrokerVerse__069-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | BrokerVerse__070-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | BrokerVerse__071-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass |  |  | BrokerVerse__072-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass |  |  | BrokerVerse__073-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | Pass |  | Create; validation shown (7 msgs) | BrokerVerse__074-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | Pass |  |  | BrokerVerse__075-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | Pass |  |  | BrokerVerse__076-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | Pass |  |  | BrokerVerse__077-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass |  |  | BrokerVerse__078-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass |  |  | BrokerVerse__079-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | Pass |  |  | BrokerVerse__080-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | BrokerVerse__081-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | BrokerVerse__082-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | BrokerVerse__083-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | BrokerVerse__084-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | BrokerVerse__085-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass |  | Add policies > Validation failed; validation shown (2 msgs) | BrokerVerse__086-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | BrokerVerse__087-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | BrokerVerse__088-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | Pass |  | New schedule | BrokerVerse__089-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | BrokerVerse__090-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | BrokerVerse__091-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | FP2 (test artefact): [validate] 'Create report' on an empty form showed no required-field message | Create report > Create report | BrokerVerse__092-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | BrokerVerse__093-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass |  |  | BrokerVerse__094-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | Pass |  | New Adjustment; validation shown (8 msgs) | BrokerVerse__095-remittance-adjustments.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | BrokerVerse__096-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | BrokerVerse__097-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | BrokerVerse__098-remittance-analytics-tab3-alerts-insights.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | BrokerVerse__099-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | BrokerVerse__100-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | BrokerVerse__101-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | Pass |  |  | BrokerVerse__102-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | BrokerVerse__103-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | BrokerVerse__104-commission-agents-referrer-accounts.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | Pass |  | Add Treaty; validation shown (8 msgs) | BrokerVerse__105-reinsurance-treaty-dashboard.jpg |
| Cession Tracking | `/reinsurance/cessions` | Pass |  |  | BrokerVerse__106-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | Pass |  |  | BrokerVerse__107-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | Pass |  |  | BrokerVerse__108-reinsurance-reconciliation.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | BrokerVerse__109-reinsurance-analytics.jpg |
| All Reports | `/reports/catalogue` | Pass |  | New Business vs Renewals (div, not a button) | BrokerVerse__110-reports-all-reports.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | Pass |  |  | BrokerVerse__111-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | Pass |  |  | BrokerVerse__112-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | Pass |  |  | BrokerVerse__113-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | Pass |  |  | BrokerVerse__114-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | Pass |  |  | BrokerVerse__115-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | Pass |  |  | BrokerVerse__116-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | Pass |  |  | BrokerVerse__117-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | Pass |  |  | BrokerVerse__118-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | Pass |  |  | BrokerVerse__119-financial-reports-journal.jpg |
| Financial Reports > Trial Balance | `/reports/financialreports/trailbalance` | Pass |  |  | BrokerVerse__120-financial-reports-trial-balance.jpg |
| (extra) Notifications | `/agent/notification` | **Fail** | amounts without thousands grouping: PHP 4598.50; [form] amounts without thousands grouping: PHP 4598.50; FP4 (test artefact): [form] error toast: Error Failed to mark notification as read; FP4 (test artefact): [form] screen fired a write request just by opening: PUT /notifications/ntf_024f6cdfb1353d8a/read (blocked by test) | NEW (div, not a button) > Error | BrokerVerse__121-extra-notifications.jpg |

