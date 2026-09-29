# BrokerVerse persona walk: every menu screen, per persona

Run on 29/09/2026 against the production build served at http://127.0.0.1:5080 (build `main.65895c72.js` for every persona, checked at the start and end of each walk) and the API at http://localhost:8000/api. Browser: Chromium via Playwright, viewport 1440x900.

**Method.** For each persona the script signs in through the login page, expands the whole sidebar and records every entry it shows, then opens each menu screen by address, clicks each of its tabs, and opens its main create/add control (button, drop-down or clickable div). On the form it clicks the save/next button with the form empty. **Every non-GET request to the API (except sign-in) was aborted by the test**, so nothing could be saved, submitted, approved, deleted or sent. A form that tried to send a save request with every field empty is reported as having no validation (F11).
Checks on every screen, tab and form: error boundary ("Something went wrong on this screen"), "Not authorised", JavaScript page errors, API responses 4xx/5xx, error toasts, empty tables caused by a failed call, raw i18n keys, `undefined`/`NaN`/`Invalid Date` text, horizontal page scroll and content past the right edge, amount grouping (Indian grouping, missing thousands separators, non-peso symbols) and date format (anything other than DD/MM/YYYY).

Scripts: `walk.py` (per-persona walk), `gen.py` (classification), `report.py` (this file). Raw results: `res_<user>.json`, `add_<user>.json` (second pass for add controls rendered as `<div>`s). Screenshots (JPEG, quality 60): `shots/` (names starting `add-` come from the second pass). A first run (`run1/`, JSON only) was discarded because the build was replaced mid-run (`main.9d4b39cf.js` -> `main.a889740a.js` -> `main.65895c72.js`).

## Totals

| Persona | User | Screens | Pass | Fail | Fail other than date format | Menu as expected |
|---|---|---|---|---|---|---|
| Business Administrator (ba) | bea.admin | 119 | 51 | 68 | 21 | yes |
| Sales (sales) | maria.sales | 26 | 10 | 16 | 11 | yes |
| Agent (agent) | ramon.agent | 16 | 6 | 10 | 8 | yes |
| Underwriter (underwriting) | jose.uw | 38 | 14 | 24 | 15 | yes |
| Customer Services (customer-services) | ana.cs | 24 | 8 | 16 | 11 | yes |
| Claims (claims) | carlo.claims | 11 | 2 | 9 | 7 | yes |
| Claims (claims) | lisa.claims2 | 11 | 2 | 9 | 7 | yes |
| Finance (finance) | liza.finance | 51 | 22 | 29 | 17 | yes |
| Finance approver (finance) | fe.approver | 51 | 22 | 29 | 17 | yes |
| User Access Administrator (user-access-admin) | carmela.morfe | 3 | 1 | 2 | 0 | yes |
| IT Administrator (it-admin) | BrokerVerse | 119 | 51 | 68 | 21 | yes |

Every persona signed in and saw exactly the menu `menuPermissions.js` defines for its role (no missing and no extra entries). The 11 personas opened 469 screen visits (119 distinct screens).

**Most failures come from one cause.** Dates not shown as DD/MM/YYYY (F14) is the only failure on many screens. The column "Fail other than date format" counts screens with at least one other failure.

## Consolidated failures (root cause, affected screens, screenshots)

### F01. Retention Analytics crashes (error boundary) for every persona that has it

Suggested cause: `brokerverse/src/module/Renewal/RetentionAnalytics/index.js:35` starts `analyticsData` as `{}`, so on the first render `analyticsData.overall?.renewalRate` is `undefined` and PrimeReact `<Knob value=...>` (line 394-395 and 413-414) calls `value.toString()` -> `TypeError: Cannot read properties of undefined (reading 'toString')`. Pass `value={analyticsData.overall?.renewalRate ?? 0}` (and the same for premiumRetention).

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Operations > Renewals > Retention Analytics | `/renewal/analytics` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales, ramon.agent | error boundary "Something went wrong on this screen" | bea.admin__061-renewals-retention-analytics.jpg |

### F02. Employee Management > Hierarchy crashes (error boundary)

Suggested cause: `brokerverse/src/module/GeneralMasters/EmployeeManagementMasters/Hierarchy/HierarchyMaster/index.js:242` `rowData.levelNumber?.toUpperCase()` - `levelNumber` is a number, so `t.toUpperCase is not a function`. Use `String(rowData.levelNumber ?? "")`.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Master > Generals > Employee Management > Hierarchy | `/master/generals/employeemanagement/hierarchy` | BrokerVerse, bea.admin | error boundary "Something went wrong on this screen" | bea.admin__031-employee-management-hierarchy.jpg |

### F03. Agent: Renewals sub-menu offered but the API refuses it (403 + "Requires permission: read:renewals", empty tables)

Suggested cause: `brokerverse/src/utils/menuPermissions.js:99` grants the agent the whole "Renewals" group, but the agent role has no `read:renewals` (and cannot list `/policy-renewals/batches`). Either give the agent role read access to renewals on the server, or restrict the agent grant to "Renewals > Renewal Policy".

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Operations > Renewals > Renewal Batch | `/agent/renewal-batch` | ramon.agent | API GET /policy-renewals/batches? -> 403 | ramon.agent__009-renewals-renewal-batch.jpg |
| Operations > Renewals > At-Risk Policies | `/renewal/at-risk` | ramon.agent | API GET /renewals/at-risk -> 403; API GET /renewals/negotiations -> 403; empty table caused by failed API call; error toast: Error Requires permission: read:renewals | ramon.agent__012-renewals-at-risk-policies.jpg |
| Operations > Renewals > Lapse Management | `/renewal/lapse-management` | ramon.agent | API GET /renewals/campaigns -> 403; API GET /renewals/lapsed -> 403; API GET /renewals/queue?pageSize=500 -> 403; empty table caused by failed API call; error toast: Error Requires permission: read:renewals | ramon.agent__014-renewals-lapse-management.jpg |
| Operations > Renewals > Negotiations | `/renewal/negotiations` | ramon.agent | API GET /renewals/approvals -> 403; API GET /renewals/negotiations -> 403; empty table caused by failed API call; error toast: Error Requires permission: read:renewals | ramon.agent__013-renewals-negotiations.jpg |
| Operations > Renewals > Performance | `/renewal/performance` | ramon.agent | API GET /renewals/performance?from=2026-09-01&to=2026-09-29 -> 403; error toast: Error Requires permission: read:renewals | ramon.agent__015-renewals-performance.jpg |
| Operations > Renewals > Renewal Queue | `/renewal/queue` | ramon.agent | API GET /renewals/queue?pageSize=500 -> 403; empty table caused by failed API call; error toast: Error Requires permission: read:renewals | ramon.agent__010-renewals-renewal-queue.jpg |

### F04. Finance: Accounts > Incentive screens offered but the API refuses them (403 read:incentive; empty tables)

Suggested cause: `brokerverse/src/utils/menuPermissions.js:87` grants finance the "Incentive" group, but the finance role lacks `read:incentive`. Align server permissions or the menu grant.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Incentive > Approvals | `/incentive/approvals` | fe.approver, liza.finance | API GET /incentive/approvals -> 403; empty table caused by failed API call; error toast: Failed to load approval data Requires permission: read:incentive or write:incentive | liza.finance__037-incentive-approvals.jpg |
| Accounts > Incentive > Calculations | `/incentive/calculations` | fe.approver, liza.finance | API GET /incentive/calculations -> 403; empty table caused by failed API call; error toast: Error Requires permission: read:incentive or write:incentive | liza.finance__036-incentive-calculations.jpg |
| Accounts > Incentive > My Programs | `/incentive/my-programs` | fe.approver, liza.finance | API GET /incentive/agent-programs -> 403; empty table caused by failed API call; error toast: Failed to load program data Requires permission: read:incentive or write:incentive | liza.finance__035-incentive-my-programs.jpg |
| Accounts > Incentive > Statement | `/incentive/statement` | fe.approver, liza.finance | API GET /incentive/agents -> 403; error toast: Failed to load statement data Requires permission: read:incentive or write:incentive | liza.finance__038-incentive-statement.jpg |

### F05. Incentive > Statement calls a missing endpoint (GET /incentive/statement?period=... -> 404) for every persona

Suggested cause: `brokerverse/src/module/Incentive/Statement/index.js` requests `/incentive/statement?period=YYYY-MM`, which the API does not serve (404). Implement the route or point the screen at the existing one.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Incentive > Statement | `/incentive/statement` | BrokerVerse, bea.admin, fe.approver, liza.finance | API GET /incentive/statement?period=2026-09 -> 404; empty table caused by failed API call | bea.admin__102-incentive-statement.jpg |

### F06. Finance: Reinsurance > Reconciliation offered but the API refuses it (403 read:reinsurance)

Suggested cause: `brokerverse/src/utils/menuPermissions.js:90` gives finance `reinsurance: ["Reconciliation"]`, but the finance role has no `read:reinsurance` (GET /reinsurance/reconciliation and /reinsurance/reinsurers -> 403).

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Reinsurance > Reconciliation | `/reinsurance/reconciliation` | fe.approver, liza.finance | API GET /reinsurance/reconciliation -> 403; API GET /reinsurance/reinsurers -> 403; empty table caused by failed API call; error toast: Error Failed to load reconciliation data; error toast: Error Requires permission: read:reinsurance or write:reinsurance | liza.finance__041-reinsurance-reconciliation.jpg |

### F07. Reports: every report screen shows "Requires permission: read:users" for non-admin personas (agent filter list)

Suggested cause: `brokerverse/src/services/reportsService.js:39` `getAgentOptions` calls `GET /users?role=agent` which needs `read:users`; sales, underwriter, customer services, claims and finance do not have it. Serve agent options from a lighter endpoint (e.g. `/masters/agents/options`) or catch the 403 silently.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Reports > Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | fe.approver, liza.finance | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | liza.finance__048-financial-reports-collection-report.jpg |
| Reports > Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | fe.approver, liza.finance | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | liza.finance__047-financial-reports-soa-premium-receivable.jpg |
| Reports > Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | ana.cs, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | maria.sales__026-operational-reports-broker-commission.jpg |
| Reports > Operational Reports > Claims | `/reports/operationalreports/claims` | ana.cs, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | maria.sales__023-operational-reports-claims.jpg |
| Reports > Operational Reports > Production | `/reports/operationalreports/production` | ana.cs, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | maria.sales__022-operational-reports-production.jpg |
| Reports > Operational Reports > Remittance | `/reports/operationalreports/remittance` | ana.cs, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | maria.sales__025-operational-reports-remittance.jpg |
| Reports > Operational Reports > Renewal | `/reports/operationalreports/renewal` | ana.cs, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | API GET /users?role=agent&perPage=500 -> 403; error toast: Requires permission: read:users | maria.sales__024-operational-reports-renewal.jpg |

### F08. Remittance > Approval Workflow: GET /users -> 403 for finance

Suggested cause: `brokerverse/src/module/Remittance/RemittanceApproval/index.js:84` loads approvers with `GET /users` (needs `read:users`).

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Remittance > Approval Workflow | `/finance/remittance/approval` | fe.approver, liza.finance | API GET /users?perPage=500&status=active -> 403 | liza.finance__027-remittance-approval-workflow.jpg |

### F09. Claims: Clients screen offers "Create Lead", which opens "Not authorised"

Suggested cause: `brokerverse/src/agentModule/quoteModule/clientListing/index.js:100-106,133` always renders the Create Lead drop-down; the claims role has no Leads access, so `/agent/createlead` is blocked by the route guard. Hide the control when `hasMenuAccess(role, "Operations", "Leads/Prospects")` is false.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Operations > Clients | `/agent/clientlisting` | carlo.claims, lisa.claims2 | "Not authorised" on a screen its own menu offers | carlo.claims__003-operations-clients-form.jpg |

### F10. Underwriter: Treaty Dashboard "Add Treaty" opens "Not authorised"

Suggested cause: `brokerverse/src/module/Reinsurance/TreatyDashboard/index.js:215` navigates to `/master/reinsurance/treaty` (a Master screen the underwriter menu does not include). Hide the button for roles without Master > Finance > Reinsurance Treaty, or open the treaty form inside the Reinsurance module.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Reinsurance > Treaty Dashboard | `/reinsurance/treaties` | jose.uw | "Not authorised" on a screen its own menu offers | jose.uw__029-reinsurance-treaty-dashboard-form.jpg |

### F11. Create/add forms that send a save request with every field empty (no required-field validation) - request was blocked by the test, nothing saved

Suggested cause: Product Configurator `saveCoverage` / `saveFactor` / `saveRule` (`brokerverse/src/module/ProductConfigurator/ProductConfiguratorScreens.js:649, 885, 1074`) call `persist()` without checking required fields; Lapse Management campaign (`brokerverse/src/module/Renewal/LapseManagement/index.js:300`), Negotiation "Save Update" (`brokerverse/src/module/Renewal/NegotiationWorkspace/index.js:259`), Remittance Adjustments, Remittance Master (automated remittance add), Incentive Program create and Reinsurance Treaty master save likewise post without client-side validation. Add required-field checks (and rely on server 400s only as a backstop).

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Remittance > Adjustments | `/finance/remittance/adjustments` | BrokerVerse, bea.admin, fe.approver, liza.finance | 'Create Adjustment' on an EMPTY form sent POST /remittance/adjustments - no required-field validation (request blocked by test, nothing saved) | bea.admin__095-remittance-adjustments-validate.jpg |
| Master > Finance > Remittance Master | `/master/finance/remittance` | BrokerVerse, bea.admin | 'Save' on an EMPTY form sent POST /masters/remittance-automated - no required-field validation (request blocked by test, nothing saved) | bea.admin__049-finance-remittance-master-validate.jpg |
| Master > Finance > Incentive Programs | `/master/incentive/programs/view` | BrokerVerse, bea.admin | 'Create' on an EMPTY form sent POST /incentive/programs - no required-field validation (request blocked by test, nothing saved) | bea.admin__050-finance-incentive-programs-validate.jpg |
| Master > Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | BrokerVerse, bea.admin | 'Save' on an EMPTY form sent POST /reinsurance/treaties - no required-field validation (request blocked by test, nothing saved) | bea.admin__051-finance-reinsurance-treaty-validate.jpg |
| Product Configurator > Coverage Builder | `/product-configurator/coverages` | BrokerVerse, bea.admin, jose.uw | 'Save Coverage' on an EMPTY form sent POST /product-configurator/coverages - no required-field validation (request blocked by test, nothing saved) | bea.admin__007-product-configurator-coverage-builder-validate.jpg |
| Product Configurator > Rating Engine | `/product-configurator/rating` | BrokerVerse, bea.admin, jose.uw | 'Save Factor' on an EMPTY form sent POST /product-configurator/rating-factors - no required-field validation (request blocked by test, nothing saved) | bea.admin__008-product-configurator-rating-engine-validate.jpg |
| Product Configurator > Underwriting Rules | `/product-configurator/underwriting` | BrokerVerse, bea.admin, jose.uw | 'Save Rule' on an EMPTY form sent POST /product-configurator/underwriting-rules - no required-field validation (request blocked by test, nothing saved) | bea.admin__009-product-configurator-underwriting-rules-validate.jpg |
| Operations > Renewals > Lapse Management | `/renewal/lapse-management` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales, ramon.agent | 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | bea.admin__064-renewals-lapse-management-validate.jpg |
| Operations > Renewals > Negotiations | `/renewal/negotiations` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales | 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | add-bea.admin__027-renewals-negotiations-validate.jpg |

### F12. Create/add forms where clicking save on an empty form shows no message at all

Suggested cause: Product Template "Create" (`brokerverse/src/module/ProductConfigurator/ProductConfiguratorScreens.js:230` `saveTemplate` returns silently when nothing is selected), Remittance Exception "Create report", Reinsurance Treaty Dashboard "Add Treaty" dialog (ba/it-admin). Show field-level "required" messages.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Remittance > Exception Management | `/finance/remittance/exceptions` | BrokerVerse, bea.admin, fe.approver, liza.finance | 'Create report' on an empty form showed no required-field message | bea.admin__092-remittance-exception-management-validate.jpg |
| Product Configurator > Dashboard | `/product-configurator/dashboard` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales | 'Create Template' on an empty form showed no required-field message | bea.admin__005-product-configurator-dashboard-validate.jpg |
| Reinsurance > Treaty Dashboard | `/reinsurance/treaties` | BrokerVerse, bea.admin | 'Add Treaty' on an empty form showed no required-field message | bea.admin__105-reinsurance-treaty-dashboard-validate.jpg |

### F13. Raw i18n keys shown as column headers (Account Category)

Suggested cause: `brokerverse/src/module/FinanceMastersModule/AccountCategoryMaster/TableData/index.jsx:145,152` use `financeMasters.categoryCodeHeader` / `categoryNameHeader`, but `brokerverse/src/locales/en.json` defines `accountCategoryCodeHeader` / `accountCategoryNameHeader`.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Master > Finance > Account Category | `/master/finance/accountcategory` | BrokerVerse, bea.admin | raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader | bea.admin__044-finance-account-category.jpg |

### F14. Dates not in DD/MM/YYYY (ISO YYYY-MM-DD in tables and date inputs, US MM/DD/YYYY in others)

Suggested cause: `brokerverse/src/utility/dateFormat.js` provides `formatDate()` / `calendarDateFormat()` (DD/MM/YYYY), but many screens bypass it: 85 `<Calendar dateFormat="yy-mm-dd">` (e.g. all Reports filters `module/Reports/**`, Exchange Rate, Taxation, Commission, Petty Cash, Receipts), 25 `dateFormat="mm/dd/yy"` (Remittance Tracking/Settlement/AutomatedProcessing, all Renewal workspace screens, Premium/Misc/Customer/RI-Claims Account Setup, Incentive Program master), 66 `toLocaleDateString()` / `toLocaleDateString("en-US")` calls (Receipts `module/Receipts/store/receiptsMiddleware.js`, Journal Voucher `module/JournalVoucher/store/journalVoucherMiddleware.js`, Petty Cash `module/PettyCashManagement/pettyCashFormat.js`, Remittance `module/Remittance/shared.js`, Incentive, Renewal screens), and table cells that print the API value as-is (masters "Modified On", Policy Issued/Expiry in `agentModule` policy list, Remittance, Reinsurance). Replace with `formatDate()` and `dateFormat={calendarDateFormat()}`.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Accounts > Journal Voucher | `/accounts/journalvoucher` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as US MM/DD/YYYY: 09/29/2026, 09/28/2026, 09/27/2026 | bea.admin__080-accounts-journal-voucher.jpg |
| Accounts > Disbursement | `/accounts/paymentvoucher` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29; dates as US MM/DD/YYYY: 09/28/2026, 09/27/2026, 09/26/2026 | add-bea.admin__037-accounts-disbursement.jpg |
| Accounts > Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as US MM/DD/YYYY: 09/25/2026 | bea.admin__077-petty-cash-disbursement.jpg |
| Accounts > Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as US MM/DD/YYYY: 09/28/2026 | bea.admin__075-petty-cash-initiate.jpg |
| Accounts > Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as US MM/DD/YYYY: 09/24/2026, 09/28/2026 | bea.admin__076-petty-cash-request.jpg |
| Accounts > Receipts | `/accounts/receipts` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as US MM/DD/YYYY: 09/28/2026, 09/25/2026, 07/31/2026 | bea.admin__068-accounts-receipts.jpg |
| Operations > Clients | `/agent/clientlisting` | BrokerVerse, ana.cs, bea.admin, carlo.claims, jose.uw, lisa.claims2, maria.sales, ramon.agent | dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | bea.admin__054-operations-clients-tab1-retail.jpg |
| Operations > Renewals > Renewal Policy | `/agent/expired-policies` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales | dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 | bea.admin__058-renewals-renewal-policy.jpg |
| Operations > Payments | `/agent/payments` | BrokerVerse, ana.cs, bea.admin, fe.approver, jose.uw, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 | bea.admin__067-operations-payments.jpg |
| Operations > Policy | `/agent/policy` | BrokerVerse, ana.cs, bea.admin, carlo.claims, jose.uw, lisa.claims2, maria.sales, ramon.agent | dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28 | bea.admin__056-operations-policy.jpg |
| Operations > Renewals > Renewal Batch | `/agent/renewal-batch` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales | dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026 | bea.admin__059-renewals-renewal-batch.jpg |
| Dashboard > Claims Dashboard | `/claims/dashboard` | BrokerVerse, bea.admin, carlo.claims, lisa.claims2 | dates as US MM/DD/YYYY: 09/29/2026 | bea.admin__002-dashboard-claims-dashboard.jpg |
| Dashboard > Executive Dashboard | `/executive/dashboard` | BrokerVerse, ana.cs, bea.admin, fe.approver, jose.uw, liza.finance, maria.sales | dates as US MM/DD/YYYY: 09/29/2026 | bea.admin__001-dashboard-executive-dashboard.jpg |
| Accounts > Remittance > Analytics | `/finance/remittance/analytics` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 | bea.admin__098-remittance-analytics-tab3-alerts-insights.jpg |
| Accounts > Remittance > History | `/finance/remittance/history` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 | bea.admin__097-remittance-history-tab2-system-logs.jpg |
| Accounts > Remittance > Scheduling | `/finance/remittance/scheduling` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2025-09-27 | bea.admin__089-remittance-scheduling.jpg |
| Accounts > Incentive > Statement | `/incentive/statement` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 9/29/2026, 7/15/2026 | bea.admin__102-incentive-statement.jpg |
| Master > Audit Trail | `/master/configuration/audit-trail` | BrokerVerse, bea.admin, carmela.morfe | dates as US MM/DD/YYYY: 9/29/2026 | bea.admin__018-master-audit-trail.jpg |
| Master > Schedules | `/master/configuration/schedules` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 9/29/2026, 9/28/2026 | bea.admin__017-master-schedules.jpg |
| Master > Finance > Customer Account Setup | `/master/finance/customer-account-setup` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 | bea.admin__038-finance-customer-account-setup.jpg |
| Master > Finance > Exchange Rate | `/master/finance/exchangerate` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-30; dates as ISO YYYY-MM-DD: 2026-09-29 | add-bea.admin__020-finance-exchange-rate.jpg |
| Master > Finance > Miscellaneous Account Setup | `/master/finance/miscellaneous-account-setup` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 | bea.admin__037-finance-miscellaneous-account-setup.jpg |
| Master > Finance > Premium Account Setup | `/master/finance/premium-account-setup` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 | bea.admin__036-finance-premium-account-setup.jpg |
| Master > Finance > Remittance Master | `/master/finance/remittance` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__049-finance-remittance-master.jpg |
| Master > Finance > RI-Claims Account Setup | `/master/finance/ri-claim-account-setup` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 | bea.admin__039-finance-ri-claims-account-setup.jpg |
| Master > Finance > Taxation | `/master/finance/taxation` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-01-01 | bea.admin__047-finance-taxation.jpg |
| Master > Generals > Commission | `/master/generals/commission` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-01-01, 2026-12-31; dates as ISO YYYY-MM-DD: 2026-09-29 | add-bea.admin__011-generals-commission.jpg |
| Master > Generals > Employee Management > Designation | `/master/generals/employeemanagement/designation` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | add-bea.admin__012-employee-management-designation.jpg |
| Master > Generals > Employee Management > Employee | `/master/generals/employeemanagement/employee` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | add-bea.admin__013-employee-management-employee.jpg |
| Master > Generals > Insurance Management > Cover | `/master/generals/insurancemanagement/cover` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__024-insurance-management-cover.jpg |
| Master > Generals > Insurance Management > Insurance Company | `/master/generals/insurancemanagement/insurancecompany` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__021-insurance-management-insurance-company.jpg |
| Master > Generals > Insurance Management > Line of Business | `/master/generals/insurancemanagement/lineofbusiness` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__022-insurance-management-line-of-business.jpg |
| Master > Generals > Insurance Management > Product | `/master/generals/insurancemanagement/productmaster` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__023-insurance-management-product.jpg |
| Master > Generals > Insurance Management > Signatories | `/master/generals/insurancemanagement/signatories` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__025-insurance-management-signatories.jpg |
| Master > Generals > Location > City Master | `/master/generals/location/city` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__029-location-city-master.jpg |
| Master > Generals > Location > Country | `/master/generals/location/country` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__027-location-country.jpg |
| Master > Generals > Location > State | `/master/generals/location/state` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2026-09-28 | bea.admin__028-location-state.jpg |
| Master > Generals > User Management > Role | `/master/generals/usermanagement/role` | BrokerVerse, bea.admin, carmela.morfe | dates as ISO YYYY-MM-DD: 2026-09-28 | add-bea.admin__015-user-management-role.jpg |
| Master > Finance > Incentive Programs | `/master/incentive/programs/view` | BrokerVerse, bea.admin | dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026 | bea.admin__050-finance-incentive-programs.jpg |
| Master > Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | BrokerVerse, bea.admin | dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01 | bea.admin__051-finance-reinsurance-treaty.jpg |
| Reinsurance > Cession Tracking | `/reinsurance/cessions` | BrokerVerse, bea.admin, jose.uw | dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24 | bea.admin__106-reinsurance-cession-tracking.jpg |
| Reinsurance > Claims Recovery | `/reinsurance/claims` | BrokerVerse, bea.admin, carlo.claims, jose.uw, lisa.claims2 | dates as ISO YYYY-MM-DD: 2026-06-25; dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27 | bea.admin__107-reinsurance-claims-recovery.jpg |
| Reinsurance > Reconciliation | `/reinsurance/reconciliation` | BrokerVerse, bea.admin, jose.uw | dates as ISO YYYY-MM-DD: 2026-09-20, 2026-06-20 | bea.admin__108-reinsurance-reconciliation-tab1-exceptions.jpg |
| Reinsurance > Treaty Dashboard | `/reinsurance/treaties` | BrokerVerse, bea.admin, jose.uw | dates as ISO YYYY-MM-DD: 2026-12-31, 2027-01-01; dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01 | bea.admin__105-reinsurance-treaty-dashboard-tab2-renewal-timeline.jpg |
| Operations > Renewals > Lapse Management | `/renewal/lapse-management` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales, ramon.agent | dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026 | bea.admin__064-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Operations > Renewals > Negotiations | `/renewal/negotiations` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales | dates as US MM/DD/YYYY: 09/30/2026; dates as US MM/DD/YYYY: 9/28/2027 | add-bea.admin__027-renewals-negotiations-tab1-details.jpg |
| Reports > Financial Reports > Payables | `/reports/financialreports/Payables` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__117-financial-reports-payables.jpg |
| Reports > Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__116-financial-reports-collection-report.jpg |
| Reports > Financial Reports > Journal | `/reports/financialreports/journal` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__118-financial-reports-journal.jpg |
| Reports > Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__115-financial-reports-soa-premium-receivable.jpg |
| Reports > Financial Reports > Trail Balance | `/reports/financialreports/trailbalance` | BrokerVerse, bea.admin, fe.approver, liza.finance | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__119-financial-reports-trail-balance.jpg |
| Reports > Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | BrokerVerse, ana.cs, bea.admin, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__114-operational-reports-broker-commission.jpg |
| Reports > Operational Reports > Claims | `/reports/operationalreports/claims` | BrokerVerse, ana.cs, bea.admin, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29 | bea.admin__111-operational-reports-claims.jpg |
| Reports > Operational Reports > Production | `/reports/operationalreports/production` | BrokerVerse, ana.cs, bea.admin, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__110-operational-reports-production.jpg |
| Reports > Operational Reports > Remittance | `/reports/operationalreports/remittance` | BrokerVerse, ana.cs, bea.admin, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__113-operational-reports-remittance.jpg |
| Reports > Operational Reports > Renewal | `/reports/operationalreports/renewal` | BrokerVerse, ana.cs, bea.admin, carlo.claims, fe.approver, jose.uw, lisa.claims2, liza.finance, maria.sales | dates as ISO YYYY-MM-DD: 2026-09-29 | bea.admin__112-operational-reports-renewal.jpg |
| Dashboard > Underwriting Dashboard | `/underwriting/dashboard` | BrokerVerse, bea.admin, jose.uw | dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22 | bea.admin__003-dashboard-underwriting-dashboard.jpg |

### F15. Content runs past the right edge of the page (cards/tabs cut off at 1440 px)

Suggested cause: Executive Dashboard 4th KPI card ("Claims Rate") and Claims Dashboard "Recent Claims" card are wider than the content area; Quotation KPI row (5th card behind "Create Quote"); Master > Configuration tab strip (group tabs past "endorse..." cut); Remittance Analytics "Top Performers". Use a wrapping grid (`grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`) / scrollable TabView.

| Screen | Path | Personas | Detail | Screenshot |
|---|---|---|---|---|
| Operations > Quotation | `/agent/Quotation` | BrokerVerse, ana.cs, bea.admin, jose.uw, maria.sales, ramon.agent | content runs past the right edge: 1 / 4.0% of total / Customer Accepted; content runs past the right edge: ₱25,320.45 / Approved Quotations / 0 | bea.admin__055-operations-quotation.jpg |
| Dashboard > Claims Dashboard | `/claims/dashboard` | BrokerVerse, bea.admin, carlo.claims, lisa.claims2 | content runs past the right edge: Max Claims By State / Metro Manila / 53% | bea.admin__002-dashboard-claims-dashboard.jpg |
| Dashboard > Executive Dashboard | `/executive/dashboard` | BrokerVerse, ana.cs, bea.admin, fe.approver, jose.uw, liza.finance, maria.sales | content runs past the right edge: 93.8% / Target: 70% / Retention Rate | bea.admin__001-dashboard-executive-dashboard.jpg |
| Accounts > Remittance > Analytics | `/finance/remittance/analytics` | BrokerVerse, bea.admin, fe.approver, liza.finance | content runs past the right edge: Top Agents by Performance | bea.admin__098-remittance-analytics-tab1-top-performers.jpg |
| Master > Configuration | `/master/configuration/settings` | BrokerVerse, bea.admin | content runs past the right edge: finance / General / incentive | bea.admin__016-master-configuration.jpg |

### Findings from reading the screenshots (not caught by the automated rules)

| # | Finding | Where | Screenshot | Suggested cause |
|---|---|---|---|---|
| V1 | Executive Dashboard title "Executive Dashboard" is dark text on the dark-blue banner (unreadable) | `/executive/dashboard`, all personas with it | bea.admin__001-dashboard-executive-dashboard.jpg | Heading colour in the dashboard header overridden by the BDOI theme (`brokerverse/src/theme/bdoi/enterprise.scss:78-82` sets `h1, h2` to `$color-heading` for everything inside `.main__content`); give the banner title `color: #fff`. |
| V2 | Date-range input in dashboard headers is cut ("01/01/2026 - 09/29/202") and in MM/DD/YYYY; the range is year-to-date while the drop-down says "This Month" | Executive and Claims dashboards | bea.admin__001-dashboard-executive-dashboard.jpg, carlo.claims__001-dashboard-claims-dashboard.jpg | Calendar in range mode without `calendarDateFormat()`; input too narrow. |
| V3 | Dialog forms lay labels and inputs inline and misaligned (label and field on one line, fields of different widths, overlapping placeholders) | Lapse Management "Create Win-back Campaign", Negotiations "Add Negotiation Update" | ramon.agent__014-renewals-lapse-management-form.jpg, add-bea.admin__027-renewals-negotiations-form.jpg | Dialog body in `module/Renewal/LapseManagement/index.js` (around line 990) and `NegotiationWorkspace/index.js` (around line 496) lacks the `field`/`grid` classes the other forms use. |
| V4 | Revenue KPI uses a dollar-sign icon next to a peso amount | Lapse Management "Revenue at Risk" | ramon.agent__014-renewals-lapse-management.jpg | Icon choice in `module/Renewal/LapseManagement/index.js`. |
| V5 | Policy list header "GrossPremium" (no space) | Operations > Policy | ramon.agent__006-operations-policy.jpg | `brokerverse/src/locales/en.json:5313` `"grossPremium": "GrossPremium"`. |
| V6 | Menu label typo "Trail Balance" (should be "Trial Balance") | Reports > Financial Reports | - | `brokerverse/src/components/SideBar/list.js:1309`. |
| V7 | Master > Configuration tab names are raw group keys in lower case ("accounting", "claims", "collections", "dashboard", "direct_bill", "email", "endorsements") next to title-case ones ("Branding", "Commission", "Currency"); each setting shows its technical key under the field | `/master/configuration/settings` | bea.admin__016-master-configuration.jpg | Group label falls back to the settings group key when no label/translation exists. |
| V8 | Required-field messages with wrong wording: "First name Code is required", "Middle name Name is required" (middle name should not be mandatory), "This field Code is required" | Employee add, Company/Branch/Commission/Exchange Rate/Petty Cash add, Disbursement create | add-bea.admin__013-employee-management-employee-validate.jpg | `module/GeneralMasters/EmployeeManagementMasters/Employee/AddEmployee/index.js:111,114-115`; `locales/en.json:249,613` (`fieldCodeRequired` / `thisFieldCodeRequired`). |
| V9 | "Add" / "Create" on master screens and Disbursement are clickable `<div>`s, not buttons (not reachable by keyboard, no button role) | All Master > Generals / Finance list screens, Accounts > Disbursement | add-carmela.morfe__002-user-management-user.jpg | `.add__icon__view__hierarchy` divs with `onClick` in the master list screens. |
| V10 | Role Master action icons render tiny/cut; Add Role "Save" is styled disabled but still clickable and gives no message on an empty form | `/master/generals/usermanagement/role` | carmela.morfe__003-user-management-role.jpg, add-carmela.morfe__003-user-management-role-validate.jpg | Role list action column width; Add Role form validation. |
| V11 | User list "E-mail" column shows "-" for every user although users have e-mail addresses (e.g. ramon.agent@brokerverse.test in the API) | `/master/generals/usermanagement/user` | carmela.morfe__002-user-management-user.jpg | Column field name does not match the API property (`email`). |
| V12 | Create Policy drop-down (Motor Policy / Fire and Allied Perils) opened but choosing did not open a form in the test; Create Batch, Remittance "New schedule" open no form with a save button | Policy, Renewal Batch, Remittance Scheduling | ramon.agent__006-operations-policy-form.jpg | Not confirmed as a defect - check manually. |

## Data flow checks (read level)

| Persona | Check | Result |
|---|---|---|
| ramon.agent | Agent Dashboard cards vs own lists | Total Leads 2 = Leads list 2; Total Clients 2 = Clients API total 2; Policy Sold 2 = Policy list 2 (1-2 of 2). **Mismatch:** Quotation list shows 10 quotations (Total 10, Draft 8, Converted 2) but the dashboard funnel (`GET /agent/get-dashboard-details?scope=mine`) counts 9. The extra one is QT-2026-00002, created by Jose Reyes (underwriter) on Ramon's lead LD-2026-00001: the quotation list is scoped by lead owner, the dashboard by creator. Pick one rule (`agentModule/dashBoardModule/home/store/homeMiddleware.js` and the `/quotations` scope on the server). |
| ramon.agent | Policy POL-2026-00001 premium | Policy gross premium 40,086.27 equals the still-Draft quotation QT-2026-00002, not the converted QT-2026-00001 (35,076.27) - worth checking which quotation the policy was issued from. |
| liza.finance, fe.approver | Receipts, vouchers, disbursements, remittances visible | Receipts list 28 (API 28), Journal Vouchers 6, Disbursements 23, Remittance Tracking and History lists populated (Settlement and Direct Bill start empty until an insurer/period is chosen). Incentive (F04) and Reinsurance Reconciliation (F06) are empty because the API refuses them. |
| carlo.claims, lisa.claims2 | Claims visible | Claims list and Claims Dashboard populated (API total 17 claims; dashboard: 9 open, 4 overdue, 2 today). Both claims users see the same data. Receipts are refused (403) as expected. Data oddity: CLM-2026-90015 shows loss date 09/08/2026 and reported date 08/09/2026 (reported before the loss). Claims users can read `/leads` through the API (18 rows) although no leads screen is in their menu. |
| carmela.morfe | Only users/roles/audit | Menu shows only Master > Audit Trail and Generals > User Management > User/Role. API: `/users` 200 (22 users), `/roles` 200 (9), `/policies`, `/receipts`, `/claims`, `/leads` all 403. Correct. |
| maria.sales, ana.cs | Business data | Sales and customer services can read `/receipts` through the API (28 rows) although no Accounts menu is offered to them - check whether that is intended. |
| all | `/notifications` 401 right after sign-in | Benign but avoidable: two `GET /notifications` -> 401 happen **on the login page** before a token exists; every later call returns 200 (bell counts load). Cause: `brokerverse/src/context/NotificationContext.js:151` fetches on mount of the provider that wraps the whole app (`App.js:64`), including /login, and the 30-second unread-count poll (line 140-148) also runs signed-out. Skip both when there is no access token. |

Amounts: no Indian grouping, ungrouped amounts or non-peso currency symbols were detected on any screen; amounts show as ₱1,234.56.

## bea.admin - Business Administrator (ba)

Landing page after sign-in: `/`. Screens 119, passed 51, failed 68 (21 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
  - Claims Dashboard
  - Underwriting Dashboard
  - Agent Dashboard
- Product Configurator
  - Dashboard
  - Product Templates
  - Coverage Builder
  - Rating Engine
  - Underwriting Rules
  - Document Manager
  - Approval Workflows
  - Market Mapping
  - Risk Mapping
  - Product Analytics
- Master
  - System Settings
  - Configuration
  - Schedules
  - Audit Trail
  - Generals
    - Organization
      - Company
      - Branch
    - Insurance Management
      - Insurance Company
      - Line of Business
      - Product
      - Cover
      - Signatories
      - Vehicle
    - Location
      - Country
      - State
      - City Master
    - Commission
    - Employee Management
      - Hierarchy
      - Designation
      - Employee
    - User Management
      - User
      - Role
  - Finance
    - Premium Account Setup
    - Miscellaneous Account Setup
    - Customer Account Setup
    - RI-Claims Account Setup
    - Transaction code
    - Currency
    - Exchange Rate
    - Bank
    - Account Category
    - Main Account
    - Sub Account
    - Taxation
    - Petty cash
    - Remittance Master
    - Incentive Programs
    - Reinsurance Treaty
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
  - Open Items
  - Payments
- Accounts
  - Receipts
  - Collections
  - Accounting Query
  - All Clients Accounting
  - Open Entry Matching
  - Open Entry Un-Matching
  - Disbursement
  - Petty Cash
    - Initiate
    - Request
    - Disbursement
    - Receipts
    - Replenish
  - Journal Voucher
  - Correction JV
  - Reversal JV
  - Remittance
    - Automated Processing
    - Tracking
    - Statements
    - Settlement
    - Reconciliation
    - Bulk Processing
    - Scheduling
    - Electronic Transfer
    - Approval Workflow
    - Exception Management
    - Agency Bill Processing
    - Direct Bill Processing
    - Adjustments
    - Notifications
    - History
    - Analytics
  - Incentive
    - My Programs
    - Calculations
    - Approvals
    - Statement
- Commission
  - Commission Dashboard
  - Agents/Referrer Accounts
- Reinsurance
  - Treaty Dashboard
  - Cession Tracking
  - Claims Recovery
  - Reconciliation
  - Analytics
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission
  - Financial Reports
    - SOA/Premium Receivable
    - Collection Report
    - Payables
    - Journal
    - Trail Balance

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 | New Quote; validation shown (8 msgs) | bea.admin__001-dashboard-executive-dashboard.jpg |
| Claims Dashboard | `/claims/dashboard` | **Fail** | F15: content runs past the right edge: Max Claims By State / Metro Manila / 53%; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | bea.admin__002-dashboard-claims-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22; F14: [tab:Group Workload (Top 5)] dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22 | New Submission; validation shown (8 msgs) | bea.admin__003-dashboard-underwriting-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | bea.admin__004-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | F12: [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | bea.admin__005-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template | bea.admin__006-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | **Fail** | F11: [validate] 'Save Coverage' on an EMPTY form sent POST /product-configurator/coverages - no required-field validation (request blocked by test, nothing saved) | Add Coverage; EMPTY form sent a save request (blocked) | bea.admin__007-product-configurator-coverage-builder-validate.jpg |
| Rating Engine | `/product-configurator/rating` | **Fail** | F11: [validate] 'Save Factor' on an EMPTY form sent POST /product-configurator/rating-factors - no required-field validation (request blocked by test, nothing saved) | Add Factor; EMPTY form sent a save request (blocked) | bea.admin__008-product-configurator-rating-engine-validate.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | **Fail** | F11: [validate] 'Save Rule' on an EMPTY form sent POST /product-configurator/underwriting-rules - no required-field validation (request blocked by test, nothing saved) | Add Rule; EMPTY form sent a save request (blocked) | bea.admin__009-product-configurator-underwriting-rules-validate.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | bea.admin__010-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | bea.admin__011-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | bea.admin__012-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | bea.admin__013-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | bea.admin__014-product-configurator-product-analytics.jpg |
| System Settings | `/master/configuration/system-settings` | Pass |  | Add Company Logo | bea.admin__015-master-system-settings.jpg |
| Configuration | `/master/configuration/settings` | **Fail** | F15: content runs past the right edge: finance / General / incentive; F15: [tab:Branding] content runs past the right edge: finance / General / incentive; F15: [tab:claims] content runs past the right edge: finance / General / incentive; F15: [tab:collections] content runs past the right edge: finance / General / incentive; F15: [tab:Commission] content runs past the right edge: finance / General / incentive; F15: [t...; notes: setting keys shown as helper text (intentional?): accounting.account.agent_receivable, accounting.account.cash_in_bank, accounting.account.cash_on_hand; [tab:Branding] setting keys shown as helper tex |  | bea.admin__016-master-configuration.jpg |
| Schedules | `/master/configuration/schedules` | **Fail** | F14: dates as US MM/DD/YYYY: 9/29/2026, 9/28/2026 |  | bea.admin__017-master-schedules.jpg |
| Audit Trail | `/master/configuration/audit-trail` | **Fail** | F14: dates as US MM/DD/YYYY: 9/29/2026 |  | bea.admin__018-master-audit-trail.jpg |
| Organization > Company | `/master/generals/organization/companymaster` | Pass |  | Add (div, not a button); validation shown (8 msgs) | add-bea.admin__009-organization-company.jpg |
| Organization > Branch | `/master/generals/organization/branchmaster` | Pass |  | Add (div, not a button); validation shown (8 msgs) | add-bea.admin__010-organization-branch.jpg |
| Insurance Management > Insurance Company | `/master/generals/insurancemanagement/insurancecompany` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (8 msgs) | bea.admin__021-insurance-management-insurance-company.jpg |
| Insurance Management > Line of Business | `/master/generals/insurancemanagement/lineofbusiness` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | bea.admin__022-insurance-management-line-of-business.jpg |
| Insurance Management > Product | `/master/generals/insurancemanagement/productmaster` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | bea.admin__023-insurance-management-product.jpg |
| Insurance Management > Cover | `/master/generals/insurancemanagement/cover` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | bea.admin__024-insurance-management-cover.jpg |
| Insurance Management > Signatories | `/master/generals/insurancemanagement/signatories` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | bea.admin__025-insurance-management-signatories.jpg |
| Insurance Management > Vehicle | `/master/generals/insurancemanagement/vehicle` | Pass |  | Add; validation shown (6 msgs) | bea.admin__026-insurance-management-vehicle.jpg |
| Location > Country | `/master/generals/location/country` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | bea.admin__027-location-country.jpg |
| Location > State | `/master/generals/location/state` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | bea.admin__028-location-state.jpg |
| Location > City Master | `/master/generals/location/city` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | bea.admin__029-location-city-master.jpg |
| Generals > Commission | `/master/generals/commission` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-01-01, 2026-12-31; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Add (div, not a button); validation shown (7 msgs) | add-bea.admin__011-generals-commission.jpg |
| Employee Management > Hierarchy | `/master/generals/employeemanagement/hierarchy` | **Fail** | F02: error boundary "Something went wrong on this screen" |  | bea.admin__031-employee-management-hierarchy.jpg |
| Employee Management > Designation | `/master/generals/employeemanagement/designation` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); save disabled until filled | add-bea.admin__012-employee-management-designation.jpg |
| Employee Management > Employee | `/master/generals/employeemanagement/employee` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); validation shown (8 msgs) | add-bea.admin__013-employee-management-employee.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | add-bea.admin__014-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28; notes: [validate] 'Save' on an empty form does nothing (button styled as disabled but still clickable; no message) | Add (div, not a button) | add-bea.admin__015-user-management-role.jpg |
| Finance > Premium Account Setup | `/master/finance/premium-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | bea.admin__036-finance-premium-account-setup.jpg |
| Finance > Miscellaneous Account Setup | `/master/finance/miscellaneous-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | bea.admin__037-finance-miscellaneous-account-setup.jpg |
| Finance > Customer Account Setup | `/master/finance/customer-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | bea.admin__038-finance-customer-account-setup.jpg |
| Finance > RI-Claims Account Setup | `/master/finance/ri-claim-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | bea.admin__039-finance-ri-claims-account-setup.jpg |
| Finance > Transaction code | `/master/finance/transactioncode` | Pass |  | Add; validation shown (8 msgs) | bea.admin__040-finance-transaction-code.jpg |
| Finance > Currency | `/master/finance/currency` | Pass |  | Add; validation shown (8 msgs) | bea.admin__041-finance-currency.jpg |
| Finance > Exchange Rate | `/master/finance/exchangerate` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-30; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Add (div, not a button); validation shown (3 msgs) | add-bea.admin__020-finance-exchange-rate.jpg |
| Finance > Bank | `/master/finance/bank` | Pass |  | Add; validation shown (8 msgs) | bea.admin__043-finance-bank.jpg |
| Finance > Account Category | `/master/finance/accountcategory` | **Fail** | F13: raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader; F13: [form] raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader; F13: [validate] raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader | Add; validation shown (3 msgs) | bea.admin__044-finance-account-category.jpg |
| Finance > Main Account | `/master/finance/mainaccount` | Pass |  | Add | bea.admin__045-finance-main-account.jpg |
| Finance > Sub Account | `/master/finance/subaccount` | Pass |  | Add | bea.admin__046-finance-sub-account.jpg |
| Finance > Taxation | `/master/finance/taxation` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-01-01 |  | bea.admin__047-finance-taxation.jpg |
| Finance > Petty cash | `/master/finance/pettycash` | Pass |  | Add (div, not a button); validation shown (6 msgs) | add-bea.admin__022-finance-petty-cash.jpg |
| Finance > Remittance Master | `/master/finance/remittance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28; F11: [validate] 'Save' on an EMPTY form sent POST /masters/remittance-automated - no required-field validation (request blocked by test, nothing saved) | Add; EMPTY form sent a save request (blocked) | bea.admin__049-finance-remittance-master.jpg |
| Finance > Incentive Programs | `/master/incentive/programs/view` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F14: [form] dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F14: [validate] dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F11: [validate] 'Create' on an EMPTY form sent POST /incentive/programs - no required-field validation (request blocked by test, nothing saved) | Add Program; EMPTY form sent a save request (blocked) | bea.admin__050-finance-incentive-programs.jpg |
| Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [form] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [validate] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F11: [validate] 'Save' on an EMPTY form sent POST /reinsurance/treaties - no required-field validation (request blocked by test, nothing saved) | Add Treaty; EMPTY form sent a save request (blocked) | bea.admin__051-finance-reinsurance-treaty.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | bea.admin__052-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | bea.admin__053-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | bea.admin__054-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: 1 / 4.0% of total / Customer Accepted; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | bea.admin__055-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | bea.admin__056-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | bea.admin__057-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 |  | bea.admin__058-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F14: dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; F14: [form] dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; notes: create/add opened but no save/next button found | Create Batch | bea.admin__059-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | bea.admin__060-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | bea.admin__061-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | bea.admin__062-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F14: [tab:Details] dates as US MM/DD/YYYY: 9/28/2027; F14: [form] dates as US MM/DD/YYYY: 09/30/2026; F14: [validate] dates as US MM/DD/YYYY: 09/30/2026; F11: [validate] 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | Add Update (div, not a button); EMPTY form sent a save request (blocked) | add-bea.admin__027-renewals-negotiations-tab1-details.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F14: [tab:Win-back Campaigns] dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F11: [validate] 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | Create Campaign; EMPTY form sent a save request (blocked) | bea.admin__064-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | bea.admin__065-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | bea.admin__066-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | bea.admin__067-operations-payments.jpg |
| Receipts | `/accounts/receipts` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/25/2026, 07/31/2026 |  | bea.admin__068-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass | notes: dates in text form (not DD/MM/YYYY): Dec 22, 2025, May 31, 2026, Aug 4, 2026 |  | bea.admin__069-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | bea.admin__070-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | bea.admin__071-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass | notes: table empty: No results found |  | bea.admin__072-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass | notes: table empty: No results found |  | bea.admin__073-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/27/2026, 09/26/2026; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Create (div, not a button); validation shown (7 msgs) | add-bea.admin__037-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026 |  | bea.admin__075-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | **Fail** | F14: dates as US MM/DD/YYYY: 09/24/2026, 09/28/2026 |  | bea.admin__076-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | **Fail** | F14: dates as US MM/DD/YYYY: 09/25/2026 |  | bea.admin__077-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass | notes: table empty:  |  | bea.admin__078-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass | notes: table empty:  |  | bea.admin__079-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/29/2026, 09/28/2026, 09/27/2026 |  | bea.admin__080-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | bea.admin__081-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | bea.admin__082-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | bea.admin__083-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | bea.admin__084-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | bea.admin__085-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass | notes: table empty: No data | Add policies > Validation failed; validation shown (2 msgs) | bea.admin__086-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | bea.admin__087-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | bea.admin__088-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2025-09-27; F14: [form] dates as ISO YYYY-MM-DD: 2025-09-27; notes: create/add opened but no save/next button found | New schedule | bea.admin__089-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | bea.admin__090-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | bea.admin__091-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | F12: [validate] 'Create report' on an empty form showed no required-field message | Create report | bea.admin__092-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | bea.admin__093-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass | notes: table empty: Select an insurer and period, then load  |  | bea.admin__094-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | **Fail** | F11: [validate] 'Create Adjustment' on an EMPTY form sent POST /remittance/adjustments - no required-field validation (request blocked by test, nothing saved) | New Adjustment; EMPTY form sent a save request (blocked) | bea.admin__095-remittance-adjustments-validate.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | bea.admin__096-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | F14: [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | bea.admin__097-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | F15: [tab:Top Performers] content runs past the right edge: Top Agents by Performance; F14: [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | bea.admin__098-remittance-analytics-tab1-top-performers.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | bea.admin__099-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | bea.admin__100-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | bea.admin__101-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | **Fail** | F05: API GET /incentive/statement?period=2026-09 -> 404; F14: dates as US MM/DD/YYYY: 9/29/2026, 7/15/2026; F05: empty table caused by failed API call; notes: dates in text form (not DD/MM/YYYY): February 15, 2025 |  | bea.admin__102-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | bea.admin__103-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | bea.admin__104-commission-agents-referrer-accounts.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | **Fail** | F14: [tab:Renewal Timeline] dates as ISO YYYY-MM-DD: 2026-12-31, 2027-01-01; F14: [form] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [validate] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F12: [validate] 'Add Treaty' on an empty form showed no required-field message | Add Treaty | bea.admin__105-reinsurance-treaty-dashboard-tab2-renewal-timeline.jpg |
| Cession Tracking | `/reinsurance/cessions` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24; F14: [tab:Line of Business Breakdown] dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24 |  | bea.admin__106-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27; F14: [tab:Recovered Claims] dates as ISO YYYY-MM-DD: 2026-06-25 |  | bea.admin__107-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | **Fail** | F14: [tab:Exceptions] dates as ISO YYYY-MM-DD: 2026-09-20, 2026-06-20 |  | bea.admin__108-reinsurance-reconciliation-tab1-exceptions.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | bea.admin__109-reinsurance-analytics.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__110-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29 |  | bea.admin__111-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__112-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__113-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__114-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__115-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__116-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__117-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__118-financial-reports-journal.jpg |
| Financial Reports > Trail Balance | `/reports/financialreports/trailbalance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | bea.admin__119-financial-reports-trail-balance.jpg |

## maria.sales - Sales (sales)

Landing page after sign-in: `/`. Screens 26, passed 10, failed 16 (11 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
  - Agent Dashboard
- Product Configurator
  - Dashboard
  - Product Templates
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
  - Open Items
  - Payments
- Commission
  - Commission Dashboard
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 | New Quote; validation shown (8 msgs) | maria.sales__001-dashboard-executive-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | maria.sales__002-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | F12: [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | maria.sales__003-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template | maria.sales__004-product-configurator-product-templates.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | maria.sales__005-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | maria.sales__006-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | maria.sales__007-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: 1 / 4.0% of total / Customer Accepted; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | maria.sales__008-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | maria.sales__009-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | maria.sales__010-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 |  | maria.sales__011-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F14: dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; F14: [form] dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; notes: create/add opened but no save/next button found | Create Batch | maria.sales__012-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | maria.sales__013-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | maria.sales__014-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | maria.sales__015-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F14: [tab:Details] dates as US MM/DD/YYYY: 9/28/2027; F14: [form] dates as US MM/DD/YYYY: 09/30/2026; F14: [validate] dates as US MM/DD/YYYY: 09/30/2026; F11: [validate] 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | Add Update (div, not a button); EMPTY form sent a save request (blocked) | add-maria.sales__005-renewals-negotiations-tab1-details.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F14: [tab:Win-back Campaigns] dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F11: [validate] 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | Create Campaign; EMPTY form sent a save request (blocked) | maria.sales__017-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | maria.sales__018-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | maria.sales__019-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | maria.sales__020-operations-payments.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | maria.sales__021-commission-commission-dashboard.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | maria.sales__022-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | maria.sales__023-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | maria.sales__024-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | maria.sales__025-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | maria.sales__026-operational-reports-broker-commission.jpg |

## ramon.agent - Agent (agent)

Landing page after sign-in: `/agent/home`. Screens 16, passed 6, failed 10 (8 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Agent Dashboard
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
- Commission
  - Commission Dashboard

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Agent Dashboard | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | ramon.agent__001-dashboard-agent-dashboard.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | ramon.agent__002-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ramon.agent__003-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | ramon.agent__004-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: ₱25,320.45 / Approved Quotations / 0; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | ramon.agent__005-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | ramon.agent__006-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026 |  | ramon.agent__007-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | Pass | notes: table empty: No results found |  | ramon.agent__008-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F03: API GET /policy-renewals/batches? -> 403; notes: create/add opened but no save/next button found | Create Batch | ramon.agent__009-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | **Fail** | F03: API GET /renewals/queue?pageSize=500 -> 403; F03: empty table caused by failed API call; F03: error toast: Error Requires permission: read:renewals |  | ramon.agent__010-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | ramon.agent__011-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | **Fail** | F03: API GET /renewals/at-risk -> 403; F03: API GET /renewals/negotiations -> 403; F03: empty table caused by failed API call; F03: error toast: Error Requires permission: read:renewals |  | ramon.agent__012-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F03: API GET /renewals/negotiations -> 403; F03: API GET /renewals/approvals -> 403; F03: empty table caused by failed API call; F03: error toast: Error Requires permission: read:renewals |  | ramon.agent__013-renewals-negotiations.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F03: API GET /renewals/lapsed -> 403; F03: API GET /renewals/queue?pageSize=500 -> 403; F03: API GET /renewals/campaigns -> 403; F03: empty table caused by failed API call; F03: error toast: Error Requires permission: read:renewals; F03: [tab:Win-back Campaigns] error toast: Error Requires permission: read:renewals; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09... | Create Campaign; EMPTY form sent a save request (blocked) | ramon.agent__014-renewals-lapse-management.jpg |
| Renewals > Performance | `/renewal/performance` | **Fail** | F03: API GET /renewals/performance?from=2026-09-01&to=2026-09-29 -> 403; F03: error toast: Error Requires permission: read:renewals; F03: [tab:Agent Performance] error toast: Error Requires permission: read:renewals |  | ramon.agent__015-renewals-performance.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | ramon.agent__016-commission-commission-dashboard.jpg |

## jose.uw - Underwriter (underwriting)

Landing page after sign-in: `/`. Screens 38, passed 14, failed 24 (15 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
  - Underwriting Dashboard
- Product Configurator
  - Dashboard
  - Product Templates
  - Coverage Builder
  - Rating Engine
  - Underwriting Rules
  - Document Manager
  - Approval Workflows
  - Market Mapping
  - Risk Mapping
  - Product Analytics
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
  - Open Items
  - Payments
- Reinsurance
  - Treaty Dashboard
  - Cession Tracking
  - Claims Recovery
  - Reconciliation
  - Analytics
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 | New Quote; validation shown (8 msgs) | jose.uw__001-dashboard-executive-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22; F14: [tab:Group Workload (Top 5)] dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22 | New Submission; validation shown (8 msgs) | jose.uw__002-dashboard-underwriting-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | F12: [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | jose.uw__003-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template | jose.uw__004-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | **Fail** | F11: [validate] 'Save Coverage' on an EMPTY form sent POST /product-configurator/coverages - no required-field validation (request blocked by test, nothing saved) | Add Coverage; EMPTY form sent a save request (blocked) | jose.uw__005-product-configurator-coverage-builder-validate.jpg |
| Rating Engine | `/product-configurator/rating` | **Fail** | F11: [validate] 'Save Factor' on an EMPTY form sent POST /product-configurator/rating-factors - no required-field validation (request blocked by test, nothing saved) | Add Factor; EMPTY form sent a save request (blocked) | jose.uw__006-product-configurator-rating-engine-validate.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | **Fail** | F11: [validate] 'Save Rule' on an EMPTY form sent POST /product-configurator/underwriting-rules - no required-field validation (request blocked by test, nothing saved) | Add Rule; EMPTY form sent a save request (blocked) | jose.uw__007-product-configurator-underwriting-rules-validate.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | jose.uw__008-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | jose.uw__009-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | jose.uw__010-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | jose.uw__011-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | jose.uw__012-product-configurator-product-analytics.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | jose.uw__013-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | jose.uw__014-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | jose.uw__015-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: 1 / 4.0% of total / Customer Accepted; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | jose.uw__016-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | jose.uw__017-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | jose.uw__018-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 |  | jose.uw__019-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F14: dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; F14: [form] dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; notes: create/add opened but no save/next button found | Create Batch | jose.uw__020-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | jose.uw__021-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | jose.uw__022-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | jose.uw__023-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F14: [tab:Details] dates as US MM/DD/YYYY: 9/28/2027; F14: [form] dates as US MM/DD/YYYY: 09/30/2026; F14: [validate] dates as US MM/DD/YYYY: 09/30/2026; F11: [validate] 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | Add Update (div, not a button); EMPTY form sent a save request (blocked) | add-jose.uw__009-renewals-negotiations-tab1-details.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F14: [tab:Win-back Campaigns] dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F11: [validate] 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | Create Campaign; EMPTY form sent a save request (blocked) | jose.uw__025-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | jose.uw__026-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | jose.uw__027-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | jose.uw__028-operations-payments.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | **Fail** | F14: [tab:Renewal Timeline] dates as ISO YYYY-MM-DD: 2026-12-31, 2027-01-01; F10: [form] "Not authorised" on a screen its own menu offers; notes: create/add opened but no save/next button found | Add Treaty | jose.uw__029-reinsurance-treaty-dashboard-tab2-renewal-timeline.jpg |
| Cession Tracking | `/reinsurance/cessions` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24; F14: [tab:Line of Business Breakdown] dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24 |  | jose.uw__030-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27; F14: [tab:Recovered Claims] dates as ISO YYYY-MM-DD: 2026-06-25 |  | jose.uw__031-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | **Fail** | F14: [tab:Exceptions] dates as ISO YYYY-MM-DD: 2026-09-20, 2026-06-20 |  | jose.uw__032-reinsurance-reconciliation-tab1-exceptions.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | jose.uw__033-reinsurance-analytics.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | jose.uw__034-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | jose.uw__035-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | jose.uw__036-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | jose.uw__037-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | jose.uw__038-operational-reports-broker-commission.jpg |

## ana.cs - Customer Services (customer-services)

Landing page after sign-in: `/`. Screens 24, passed 8, failed 16 (11 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
- Product Configurator
  - Dashboard
  - Product Templates
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
  - Open Items
  - Payments
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 | New Quote; validation shown (8 msgs) | ana.cs__001-dashboard-executive-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | F12: [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | ana.cs__002-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template | ana.cs__003-product-configurator-product-templates.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | ana.cs__004-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | ana.cs__005-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | ana.cs__006-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: 1 / 4.0% of total / Customer Accepted; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | ana.cs__007-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | ana.cs__008-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | ana.cs__009-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 |  | ana.cs__010-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F14: dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; F14: [form] dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; notes: create/add opened but no save/next button found | Create Batch | ana.cs__011-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | ana.cs__012-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | ana.cs__013-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | ana.cs__014-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F14: [tab:Details] dates as US MM/DD/YYYY: 9/28/2027; F14: [form] dates as US MM/DD/YYYY: 09/30/2026; F14: [validate] dates as US MM/DD/YYYY: 09/30/2026; F11: [validate] 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | Add Update (div, not a button); EMPTY form sent a save request (blocked) | add-ana.cs__005-renewals-negotiations-tab1-details.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F14: [tab:Win-back Campaigns] dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F11: [validate] 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | Create Campaign; EMPTY form sent a save request (blocked) | ana.cs__016-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | ana.cs__017-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | ana.cs__018-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | ana.cs__019-operations-payments.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | ana.cs__020-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | ana.cs__021-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | ana.cs__022-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | ana.cs__023-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | ana.cs__024-operational-reports-broker-commission.jpg |

## carlo.claims - Claims (claims)

Landing page after sign-in: `/claims/dashboard`. Screens 11, passed 2, failed 9 (7 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Claims Dashboard
- Operations
  - Home
  - Clients
  - Policy
  - Claims
- Reinsurance
  - Claims Recovery
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Claims Dashboard | `/claims/dashboard` | **Fail** | F15: content runs past the right edge: Max Claims By State / Metro Manila / 53%; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | carlo.claims__001-dashboard-claims-dashboard.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | carlo.claims__002-operations-home.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15; F09: [form] "Not authorised" on a screen its own menu offers; notes: create/add opened but no save/next button found | Create Lead > Motor | carlo.claims__003-operations-clients-tab1-retail.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | carlo.claims__004-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | carlo.claims__005-operations-claims.jpg |
| Claims Recovery | `/reinsurance/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27; F14: [tab:Recovered Claims] dates as ISO YYYY-MM-DD: 2026-06-25 |  | carlo.claims__006-reinsurance-claims-recovery.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | carlo.claims__007-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | carlo.claims__008-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | carlo.claims__009-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | carlo.claims__010-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | carlo.claims__011-operational-reports-broker-commission.jpg |

## lisa.claims2 - Claims (claims)

Landing page after sign-in: `/claims/dashboard`. Screens 11, passed 2, failed 9 (7 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Claims Dashboard
- Operations
  - Home
  - Clients
  - Policy
  - Claims
- Reinsurance
  - Claims Recovery
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Claims Dashboard | `/claims/dashboard` | **Fail** | F15: content runs past the right edge: Max Claims By State / Metro Manila / 53%; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | lisa.claims2__001-dashboard-claims-dashboard.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | lisa.claims2__002-operations-home.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15; F09: [form] "Not authorised" on a screen its own menu offers; notes: create/add opened but no save/next button found | Create Lead > Motor | lisa.claims2__003-operations-clients-tab1-retail.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | lisa.claims2__004-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | lisa.claims2__005-operations-claims.jpg |
| Claims Recovery | `/reinsurance/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27; F14: [tab:Recovered Claims] dates as ISO YYYY-MM-DD: 2026-06-25 |  | lisa.claims2__006-reinsurance-claims-recovery.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | lisa.claims2__007-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | lisa.claims2__008-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | lisa.claims2__009-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | lisa.claims2__010-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | lisa.claims2__011-operational-reports-broker-commission.jpg |

## liza.finance - Finance (finance)

Landing page after sign-in: `/`. Screens 51, passed 22, failed 29 (17 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
- Operations
  - Open Items
  - Payments
- Accounts
  - Receipts
  - Collections
  - Accounting Query
  - All Clients Accounting
  - Open Entry Matching
  - Open Entry Un-Matching
  - Disbursement
  - Petty Cash
    - Initiate
    - Request
    - Disbursement
    - Receipts
    - Replenish
  - Journal Voucher
  - Correction JV
  - Reversal JV
  - Remittance
    - Automated Processing
    - Tracking
    - Statements
    - Settlement
    - Reconciliation
    - Bulk Processing
    - Scheduling
    - Electronic Transfer
    - Approval Workflow
    - Exception Management
    - Agency Bill Processing
    - Direct Bill Processing
    - Adjustments
    - Notifications
    - History
    - Analytics
  - Incentive
    - My Programs
    - Calculations
    - Approvals
    - Statement
- Commission
  - Commission Dashboard
  - Agents/Referrer Accounts
- Reinsurance
  - Reconciliation
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission
  - Financial Reports
    - SOA/Premium Receivable
    - Collection Report
    - Payables
    - Journal
    - Trail Balance

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | liza.finance__001-dashboard-executive-dashboard.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | liza.finance__002-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | liza.finance__003-operations-payments.jpg |
| Receipts | `/accounts/receipts` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/25/2026, 07/31/2026 |  | liza.finance__004-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass | notes: dates in text form (not DD/MM/YYYY): Dec 22, 2025, May 31, 2026, Aug 4, 2026 |  | liza.finance__005-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | liza.finance__006-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | liza.finance__007-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass | notes: table empty: No results found |  | liza.finance__008-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass | notes: table empty: No results found |  | liza.finance__009-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/27/2026, 09/26/2026; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Create (div, not a button); validation shown (7 msgs) | add-liza.finance__010-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026 |  | liza.finance__011-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | **Fail** | F14: dates as US MM/DD/YYYY: 09/24/2026, 09/28/2026 |  | liza.finance__012-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | **Fail** | F14: dates as US MM/DD/YYYY: 09/25/2026 |  | liza.finance__013-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass | notes: table empty:  |  | liza.finance__014-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass | notes: table empty:  |  | liza.finance__015-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/29/2026, 09/28/2026, 09/27/2026 |  | liza.finance__016-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | liza.finance__017-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | liza.finance__018-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | liza.finance__019-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | liza.finance__020-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | liza.finance__021-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass | notes: table empty: No data | Add policies > Validation failed; validation shown (2 msgs) | liza.finance__022-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | liza.finance__023-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | liza.finance__024-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2025-09-27; F14: [form] dates as ISO YYYY-MM-DD: 2025-09-27; notes: create/add opened but no save/next button found | New schedule | liza.finance__025-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | liza.finance__026-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | **Fail** | F08: API GET /users?perPage=500&status=active -> 403 |  | liza.finance__027-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | F12: [validate] 'Create report' on an empty form showed no required-field message | Create report | liza.finance__028-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | liza.finance__029-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass | notes: table empty: Select an insurer and period, then load  |  | liza.finance__030-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | **Fail** | F11: [validate] 'Create Adjustment' on an EMPTY form sent POST /remittance/adjustments - no required-field validation (request blocked by test, nothing saved) | New Adjustment; EMPTY form sent a save request (blocked) | liza.finance__031-remittance-adjustments-validate.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | liza.finance__032-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | F14: [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | liza.finance__033-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | F15: [tab:Top Performers] content runs past the right edge: Top Agents by Performance; F14: [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | liza.finance__034-remittance-analytics-tab1-top-performers.jpg |
| Incentive > My Programs | `/incentive/my-programs` | **Fail** | F04: API GET /incentive/agent-programs -> 403; F04: empty table caused by failed API call; F04: error toast: Failed to load program data Requires permission: read:incentive or write:incentive |  | liza.finance__035-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | **Fail** | F04: API GET /incentive/calculations -> 403; F04: empty table caused by failed API call; F04: error toast: Error Requires permission: read:incentive or write:incentive; F04: [form] error toast: Error Requires permission: read:incentive or write:incentive | New Calculation; save disabled until filled | liza.finance__036-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | **Fail** | F04: API GET /incentive/approvals -> 403; F04: empty table caused by failed API call; F04: error toast: Failed to load approval data Requires permission: read:incentive or write:incentive |  | liza.finance__037-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | **Fail** | F05: API GET /incentive/statement?period=2026-09 -> 404; F04: API GET /incentive/agents -> 403; F05: empty table caused by failed API call; F04: error toast: Failed to load statement data Requires permission: read:incentive or write:incentive; notes: dates in text form (not DD/MM/YYYY): February 15, 2025 |  | liza.finance__038-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | liza.finance__039-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | liza.finance__040-commission-agents-referrer-accounts.jpg |
| Reconciliation | `/reinsurance/reconciliation` | **Fail** | F06: API GET /reinsurance/reconciliation -> 403; F06: API GET /reinsurance/reinsurers -> 403; F06: empty table caused by failed API call; F06: error toast: Error Failed to load reconciliation data; F06: error toast: Error Requires permission: read:reinsurance or write:reinsurance; F06: [tab:Exceptions] error toast: Error Requires permission: read:reinsurance or write:reinsurance |  | liza.finance__041-reinsurance-reconciliation.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__042-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__043-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__044-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__045-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__046-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__047-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | liza.finance__048-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | liza.finance__049-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | liza.finance__050-financial-reports-journal.jpg |
| Financial Reports > Trail Balance | `/reports/financialreports/trailbalance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | liza.finance__051-financial-reports-trail-balance.jpg |

## fe.approver - Finance approver (finance)

Landing page after sign-in: `/`. Screens 51, passed 22, failed 29 (17 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
- Operations
  - Open Items
  - Payments
- Accounts
  - Receipts
  - Collections
  - Accounting Query
  - All Clients Accounting
  - Open Entry Matching
  - Open Entry Un-Matching
  - Disbursement
  - Petty Cash
    - Initiate
    - Request
    - Disbursement
    - Receipts
    - Replenish
  - Journal Voucher
  - Correction JV
  - Reversal JV
  - Remittance
    - Automated Processing
    - Tracking
    - Statements
    - Settlement
    - Reconciliation
    - Bulk Processing
    - Scheduling
    - Electronic Transfer
    - Approval Workflow
    - Exception Management
    - Agency Bill Processing
    - Direct Bill Processing
    - Adjustments
    - Notifications
    - History
    - Analytics
  - Incentive
    - My Programs
    - Calculations
    - Approvals
    - Statement
- Commission
  - Commission Dashboard
  - Agents/Referrer Accounts
- Reinsurance
  - Reconciliation
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission
  - Financial Reports
    - SOA/Premium Receivable
    - Collection Report
    - Payables
    - Journal
    - Trail Balance

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | fe.approver__001-dashboard-executive-dashboard.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | fe.approver__002-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | fe.approver__003-operations-payments.jpg |
| Receipts | `/accounts/receipts` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/25/2026, 07/31/2026 |  | fe.approver__004-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass | notes: dates in text form (not DD/MM/YYYY): Dec 22, 2025, May 31, 2026, Aug 4, 2026 |  | fe.approver__005-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | fe.approver__006-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | fe.approver__007-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass | notes: table empty: No results found |  | fe.approver__008-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass | notes: table empty: No results found |  | fe.approver__009-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/27/2026, 09/26/2026; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Create (div, not a button); validation shown (7 msgs) | add-fe.approver__010-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026 |  | fe.approver__011-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | **Fail** | F14: dates as US MM/DD/YYYY: 09/24/2026, 09/28/2026 |  | fe.approver__012-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | **Fail** | F14: dates as US MM/DD/YYYY: 09/25/2026 |  | fe.approver__013-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass | notes: table empty:  |  | fe.approver__014-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass | notes: table empty:  |  | fe.approver__015-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/29/2026, 09/28/2026, 09/27/2026 |  | fe.approver__016-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | fe.approver__017-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | fe.approver__018-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | fe.approver__019-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | fe.approver__020-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | fe.approver__021-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass | notes: table empty: No data | Add policies > Validation failed; validation shown (2 msgs) | fe.approver__022-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | fe.approver__023-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | fe.approver__024-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2025-09-27; F14: [form] dates as ISO YYYY-MM-DD: 2025-09-27; notes: create/add opened but no save/next button found | New schedule | fe.approver__025-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | fe.approver__026-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | **Fail** | F08: API GET /users?perPage=500&status=active -> 403 |  | fe.approver__027-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | F12: [validate] 'Create report' on an empty form showed no required-field message | Create report | fe.approver__028-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | fe.approver__029-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass | notes: table empty: Select an insurer and period, then load  |  | fe.approver__030-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | **Fail** | F11: [validate] 'Create Adjustment' on an EMPTY form sent POST /remittance/adjustments - no required-field validation (request blocked by test, nothing saved) | New Adjustment; EMPTY form sent a save request (blocked) | fe.approver__031-remittance-adjustments-validate.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | fe.approver__032-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | F14: [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | fe.approver__033-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | F15: [tab:Top Performers] content runs past the right edge: Top Agents by Performance; F14: [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | fe.approver__034-remittance-analytics-tab1-top-performers.jpg |
| Incentive > My Programs | `/incentive/my-programs` | **Fail** | F04: API GET /incentive/agent-programs -> 403; F04: empty table caused by failed API call; F04: error toast: Failed to load program data Requires permission: read:incentive or write:incentive |  | fe.approver__035-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | **Fail** | F04: API GET /incentive/calculations -> 403; F04: empty table caused by failed API call; F04: error toast: Error Requires permission: read:incentive or write:incentive; F04: [form] error toast: Error Requires permission: read:incentive or write:incentive | New Calculation; save disabled until filled | fe.approver__036-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | **Fail** | F04: API GET /incentive/approvals -> 403; F04: empty table caused by failed API call; F04: error toast: Failed to load approval data Requires permission: read:incentive or write:incentive |  | fe.approver__037-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | **Fail** | F05: API GET /incentive/statement?period=2026-09 -> 404; F04: API GET /incentive/agents -> 403; F05: empty table caused by failed API call; F04: error toast: Failed to load statement data Requires permission: read:incentive or write:incentive; notes: dates in text form (not DD/MM/YYYY): February 15, 2025 |  | fe.approver__038-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | fe.approver__039-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | fe.approver__040-commission-agents-referrer-accounts.jpg |
| Reconciliation | `/reinsurance/reconciliation` | **Fail** | F06: API GET /reinsurance/reconciliation -> 403; F06: API GET /reinsurance/reinsurers -> 403; F06: empty table caused by failed API call; F06: error toast: Error Failed to load reconciliation data; F06: error toast: Error Requires permission: read:reinsurance or write:reinsurance; F06: [tab:Exceptions] error toast: Error Failed to load reconciliation data; F06: [tab:Exceptions] error toast: Error Requires permission:... |  | fe.approver__041-reinsurance-reconciliation.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__042-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__043-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__044-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__045-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__046-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__047-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | **Fail** | F07: API GET /users?role=agent&perPage=500 -> 403; F14: dates as ISO YYYY-MM-DD: 2026-09-29; F07: error toast: Requires permission: read:users |  | fe.approver__048-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | fe.approver__049-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | fe.approver__050-financial-reports-journal.jpg |
| Financial Reports > Trail Balance | `/reports/financialreports/trailbalance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | fe.approver__051-financial-reports-trail-balance.jpg |

## carmela.morfe - User Access Administrator (user-access-admin)

Landing page after sign-in: `/master/configuration/audit-trail`. Screens 3, passed 1, failed 2 (0 failing for reasons other than date format).

**Menu seen**

- Master
  - Audit Trail
  - Generals
    - User Management
      - User
      - Role

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Audit Trail | `/master/configuration/audit-trail` | **Fail** | F14: dates as US MM/DD/YYYY: 9/29/2026 |  | carmela.morfe__001-master-audit-trail.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | add-carmela.morfe__002-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28; notes: [validate] 'Save' on an empty form does nothing (button styled as disabled but still clickable; no message) | Add (div, not a button) | add-carmela.morfe__003-user-management-role.jpg |

## BrokerVerse - IT Administrator (it-admin)

Landing page after sign-in: `/`. Screens 119, passed 51, failed 68 (21 failing for reasons other than date format).

**Menu seen**

- Dashboard
  - Executive Dashboard
  - Claims Dashboard
  - Underwriting Dashboard
  - Agent Dashboard
- Product Configurator
  - Dashboard
  - Product Templates
  - Coverage Builder
  - Rating Engine
  - Underwriting Rules
  - Document Manager
  - Approval Workflows
  - Market Mapping
  - Risk Mapping
  - Product Analytics
- Master
  - System Settings
  - Configuration
  - Schedules
  - Audit Trail
  - Generals
    - Organization
      - Company
      - Branch
    - Insurance Management
      - Insurance Company
      - Line of Business
      - Product
      - Cover
      - Signatories
      - Vehicle
    - Location
      - Country
      - State
      - City Master
    - Commission
    - Employee Management
      - Hierarchy
      - Designation
      - Employee
    - User Management
      - User
      - Role
  - Finance
    - Premium Account Setup
    - Miscellaneous Account Setup
    - Customer Account Setup
    - RI-Claims Account Setup
    - Transaction code
    - Currency
    - Exchange Rate
    - Bank
    - Account Category
    - Main Account
    - Sub Account
    - Taxation
    - Petty cash
    - Remittance Master
    - Incentive Programs
    - Reinsurance Treaty
- Operations
  - Home
  - Leads/Prospects
  - Clients
  - Quotation
  - Policy
  - Claims
  - Renewals
    - Renewal Policy
    - Renewal Batch
    - Renewal Queue
    - Retention Analytics
    - At-Risk Policies
    - Negotiations
    - Lapse Management
    - Performance
  - Open Items
  - Payments
- Accounts
  - Receipts
  - Collections
  - Accounting Query
  - All Clients Accounting
  - Open Entry Matching
  - Open Entry Un-Matching
  - Disbursement
  - Petty Cash
    - Initiate
    - Request
    - Disbursement
    - Receipts
    - Replenish
  - Journal Voucher
  - Correction JV
  - Reversal JV
  - Remittance
    - Automated Processing
    - Tracking
    - Statements
    - Settlement
    - Reconciliation
    - Bulk Processing
    - Scheduling
    - Electronic Transfer
    - Approval Workflow
    - Exception Management
    - Agency Bill Processing
    - Direct Bill Processing
    - Adjustments
    - Notifications
    - History
    - Analytics
  - Incentive
    - My Programs
    - Calculations
    - Approvals
    - Statement
- Commission
  - Commission Dashboard
  - Agents/Referrer Accounts
- Reinsurance
  - Treaty Dashboard
  - Cession Tracking
  - Claims Recovery
  - Reconciliation
  - Analytics
- Reports
  - Operational Reports
    - Production
    - Claims
    - Renewal
    - Remittance
    - Broker Commission
  - Financial Reports
    - SOA/Premium Receivable
    - Collection Report
    - Payables
    - Journal
    - Trail Balance

| Screen | Path | Result | Issue | Create/add form | Screenshot |
|---|---|---|---|---|---|
| Executive Dashboard | `/executive/dashboard` | **Fail** | F15: content runs past the right edge: 93.8% / Target: 70% / Retention Rate; F14: dates as US MM/DD/YYYY: 09/29/2026 | New Quote; validation shown (8 msgs) | BrokerVerse__001-dashboard-executive-dashboard.jpg |
| Claims Dashboard | `/claims/dashboard` | **Fail** | F15: content runs past the right edge: Max Claims By State / Metro Manila / 53%; F14: dates as US MM/DD/YYYY: 09/29/2026 |  | BrokerVerse__002-dashboard-claims-dashboard.jpg |
| Underwriting Dashboard | `/underwriting/dashboard` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22; F14: [tab:Group Workload (Top 5)] dates as ISO YYYY-MM-DD: 2026-10-19, 2026-10-20, 2026-10-22 | New Submission; validation shown (8 msgs) | BrokerVerse__003-dashboard-underwriting-dashboard.jpg |
| Agent Dashboard | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | BrokerVerse__004-dashboard-agent-dashboard.jpg |
| Dashboard | `/product-configurator/dashboard` | **Fail** | F12: [validate] 'Create Template' on an empty form showed no required-field message | Create New Product | BrokerVerse__005-product-configurator-dashboard-validate.jpg |
| Product Templates | `/product-configurator/templates` | Pass |  | Create Template | BrokerVerse__006-product-configurator-product-templates.jpg |
| Coverage Builder | `/product-configurator/coverages` | **Fail** | F11: [validate] 'Save Coverage' on an EMPTY form sent POST /product-configurator/coverages - no required-field validation (request blocked by test, nothing saved) | Add Coverage; EMPTY form sent a save request (blocked) | BrokerVerse__007-product-configurator-coverage-builder-validate.jpg |
| Rating Engine | `/product-configurator/rating` | **Fail** | F11: [validate] 'Save Factor' on an EMPTY form sent POST /product-configurator/rating-factors - no required-field validation (request blocked by test, nothing saved) | Add Factor; EMPTY form sent a save request (blocked) | BrokerVerse__008-product-configurator-rating-engine-validate.jpg |
| Underwriting Rules | `/product-configurator/underwriting` | **Fail** | F11: [validate] 'Save Rule' on an EMPTY form sent POST /product-configurator/underwriting-rules - no required-field validation (request blocked by test, nothing saved) | Add Rule; EMPTY form sent a save request (blocked) | BrokerVerse__009-product-configurator-underwriting-rules-validate.jpg |
| Document Manager | `/product-configurator/documents` | Pass |  |  | BrokerVerse__010-product-configurator-document-manager.jpg |
| Approval Workflows | `/product-configurator/workflows` | Pass |  | Create Workflow; save disabled until filled | BrokerVerse__011-product-configurator-approval-workflows.jpg |
| Market Mapping | `/product-configurator/market-mapping` | Pass |  |  | BrokerVerse__012-product-configurator-market-mapping.jpg |
| Risk Mapping | `/product-configurator/risk-mapping` | Pass |  |  | BrokerVerse__013-product-configurator-risk-mapping.jpg |
| Product Analytics | `/product-configurator/analytics` | Pass |  |  | BrokerVerse__014-product-configurator-product-analytics.jpg |
| System Settings | `/master/configuration/system-settings` | Pass |  | Add Company Logo | BrokerVerse__015-master-system-settings.jpg |
| Configuration | `/master/configuration/settings` | **Fail** | F15: content runs past the right edge: finance / General / incentive; F15: [tab:Branding] content runs past the right edge: finance / General / incentive; F15: [tab:claims] content runs past the right edge: finance / General / incentive; F15: [tab:collections] content runs past the right edge: finance / General / incentive; F15: [tab:Commission] content runs past the right edge: finance / General / incentive; F15: [t...; notes: setting keys shown as helper text (intentional?): accounting.account.agent_receivable, accounting.account.cash_in_bank, accounting.account.cash_on_hand; [tab:Branding] setting keys shown as helper tex |  | BrokerVerse__016-master-configuration.jpg |
| Schedules | `/master/configuration/schedules` | **Fail** | F14: dates as US MM/DD/YYYY: 9/29/2026, 9/28/2026 |  | BrokerVerse__017-master-schedules.jpg |
| Audit Trail | `/master/configuration/audit-trail` | **Fail** | F14: dates as US MM/DD/YYYY: 9/29/2026 |  | BrokerVerse__018-master-audit-trail.jpg |
| Organization > Company | `/master/generals/organization/companymaster` | Pass |  | Add (div, not a button); validation shown (8 msgs) | add-BrokerVerse__009-organization-company.jpg |
| Organization > Branch | `/master/generals/organization/branchmaster` | Pass |  | Add (div, not a button); validation shown (8 msgs) | add-BrokerVerse__010-organization-branch.jpg |
| Insurance Management > Insurance Company | `/master/generals/insurancemanagement/insurancecompany` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (8 msgs) | BrokerVerse__021-insurance-management-insurance-company.jpg |
| Insurance Management > Line of Business | `/master/generals/insurancemanagement/lineofbusiness` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | BrokerVerse__022-insurance-management-line-of-business.jpg |
| Insurance Management > Product | `/master/generals/insurancemanagement/productmaster` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | BrokerVerse__023-insurance-management-product.jpg |
| Insurance Management > Cover | `/master/generals/insurancemanagement/cover` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | BrokerVerse__024-insurance-management-cover.jpg |
| Insurance Management > Signatories | `/master/generals/insurancemanagement/signatories` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | BrokerVerse__025-insurance-management-signatories.jpg |
| Insurance Management > Vehicle | `/master/generals/insurancemanagement/vehicle` | Pass |  | Add; validation shown (6 msgs) | BrokerVerse__026-insurance-management-vehicle.jpg |
| Location > Country | `/master/generals/location/country` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (3 msgs) | BrokerVerse__027-location-country.jpg |
| Location > State | `/master/generals/location/state` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | BrokerVerse__028-location-state.jpg |
| Location > City Master | `/master/generals/location/city` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add; validation shown (4 msgs) | BrokerVerse__029-location-city-master.jpg |
| Generals > Commission | `/master/generals/commission` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-01-01, 2026-12-31; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Add (div, not a button); validation shown (7 msgs) | add-BrokerVerse__011-generals-commission.jpg |
| Employee Management > Hierarchy | `/master/generals/employeemanagement/hierarchy` | **Fail** | F02: error boundary "Something went wrong on this screen" |  | BrokerVerse__031-employee-management-hierarchy.jpg |
| Employee Management > Designation | `/master/generals/employeemanagement/designation` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); save disabled until filled | add-BrokerVerse__012-employee-management-designation.jpg |
| Employee Management > Employee | `/master/generals/employeemanagement/employee` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28 | Add (div, not a button); validation shown (8 msgs) | add-BrokerVerse__013-employee-management-employee.jpg |
| User Management > User | `/master/generals/usermanagement/user` | Pass |  | Add (div, not a button); save disabled until filled | add-BrokerVerse__014-user-management-user.jpg |
| User Management > Role | `/master/generals/usermanagement/role` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28; notes: [validate] 'Save' on an empty form does nothing (button styled as disabled but still clickable; no message) | Add (div, not a button) | add-BrokerVerse__015-user-management-role.jpg |
| Finance > Premium Account Setup | `/master/finance/premium-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | BrokerVerse__036-finance-premium-account-setup.jpg |
| Finance > Miscellaneous Account Setup | `/master/finance/miscellaneous-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | BrokerVerse__037-finance-miscellaneous-account-setup.jpg |
| Finance > Customer Account Setup | `/master/finance/customer-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | BrokerVerse__038-finance-customer-account-setup.jpg |
| Finance > RI-Claims Account Setup | `/master/finance/ri-claim-account-setup` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/28/2026 |  | BrokerVerse__039-finance-ri-claims-account-setup.jpg |
| Finance > Transaction code | `/master/finance/transactioncode` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__040-finance-transaction-code.jpg |
| Finance > Currency | `/master/finance/currency` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__041-finance-currency.jpg |
| Finance > Exchange Rate | `/master/finance/exchangerate` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-30; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Add (div, not a button); validation shown (3 msgs) | add-BrokerVerse__020-finance-exchange-rate.jpg |
| Finance > Bank | `/master/finance/bank` | Pass |  | Add; validation shown (8 msgs) | BrokerVerse__043-finance-bank.jpg |
| Finance > Account Category | `/master/finance/accountcategory` | **Fail** | F13: raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader; F13: [form] raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader; F13: [validate] raw i18n keys: financeMasters.categoryCodeHeader, financeMasters.categoryNameHeader | Add; validation shown (3 msgs) | BrokerVerse__044-finance-account-category.jpg |
| Finance > Main Account | `/master/finance/mainaccount` | Pass |  | Add | BrokerVerse__045-finance-main-account.jpg |
| Finance > Sub Account | `/master/finance/subaccount` | Pass |  | Add | BrokerVerse__046-finance-sub-account.jpg |
| Finance > Taxation | `/master/finance/taxation` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-01-01 |  | BrokerVerse__047-finance-taxation.jpg |
| Finance > Petty cash | `/master/finance/pettycash` | Pass |  | Add (div, not a button); validation shown (6 msgs) | add-BrokerVerse__022-finance-petty-cash.jpg |
| Finance > Remittance Master | `/master/finance/remittance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28; F11: [validate] 'Save' on an EMPTY form sent POST /masters/remittance-automated - no required-field validation (request blocked by test, nothing saved) | Add; EMPTY form sent a save request (blocked) | BrokerVerse__049-finance-remittance-master.jpg |
| Finance > Incentive Programs | `/master/incentive/programs/view` | **Fail** | F14: dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F14: [form] dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F14: [validate] dates as US MM/DD/YYYY: 12/31/2026, 9/30/2026, 6/30/2026; F11: [validate] 'Create' on an EMPTY form sent POST /incentive/programs - no required-field validation (request blocked by test, nothing saved) | Add Program; EMPTY form sent a save request (blocked) | BrokerVerse__050-finance-incentive-programs.jpg |
| Finance > Reinsurance Treaty | `/master/reinsurance/treaty` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [form] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [validate] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F11: [validate] 'Save' on an EMPTY form sent POST /reinsurance/treaties - no required-field validation (request blocked by test, nothing saved) | Add Treaty; EMPTY form sent a save request (blocked) | BrokerVerse__051-finance-reinsurance-treaty.jpg |
| Home | `/agent/home` | Pass | notes: create/add opened but no save/next button found | Create Quote > Motor | BrokerVerse__052-operations-home.jpg |
| Leads/Prospects | `/agent/leadlisting` | Pass |  | Create Lead > Motor; validation shown (8 msgs) | BrokerVerse__053-operations-leads-prospects.jpg |
| Clients | `/agent/clientlisting` | **Fail** | F14: [tab:Retail] dates as ISO YYYY-MM-DD: 2026-09-15, 1988-03-15 | Create Lead > Motor; validation shown (8 msgs) | BrokerVerse__054-operations-clients-tab1-retail.jpg |
| Quotation | `/agent/Quotation` | **Fail** | F15: content runs past the right edge: 1 / 4.0% of total / Customer Accepted; notes: create/add opened but no save/next button found | Create Quote > Motor Quote | BrokerVerse__055-operations-quotation.jpg |
| Policy | `/agent/policy` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29, 2027-09-29, 2026-09-28; notes: create/add opened but no save/next button found | Create Policy > Motor Policy | BrokerVerse__056-operations-policy.jpg |
| Claims | `/agent/claim` | Pass | notes: dates in text form (not DD/MM/YYYY): Sep 28, 2026, May 1, 2026, Jan 21, 2026 |  | BrokerVerse__057-operations-claims.jpg |
| Renewals > Renewal Policy | `/agent/expired-policies` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-08, 2026-09-20, 2026-09-13 |  | BrokerVerse__058-renewals-renewal-policy.jpg |
| Renewals > Renewal Batch | `/agent/renewal-batch` | **Fail** | F14: dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; F14: [form] dates as US MM/DD/YYYY: 9/27/2026, 9/16/2026; notes: create/add opened but no save/next button found | Create Batch | BrokerVerse__059-renewals-renewal-batch.jpg |
| Renewals > Renewal Queue | `/renewal/queue` | Pass |  |  | BrokerVerse__060-renewals-renewal-queue.jpg |
| Renewals > Retention Analytics | `/renewal/analytics` | **Fail** | F01: error boundary "Something went wrong on this screen" |  | BrokerVerse__061-renewals-retention-analytics.jpg |
| Renewals > At-Risk Policies | `/renewal/at-risk` | Pass |  |  | BrokerVerse__062-renewals-at-risk-policies.jpg |
| Renewals > Negotiations | `/renewal/negotiations` | **Fail** | F14: [tab:Details] dates as US MM/DD/YYYY: 9/28/2027; F14: [form] dates as US MM/DD/YYYY: 09/30/2026; F14: [validate] dates as US MM/DD/YYYY: 09/30/2026; F11: [validate] 'Save Update' on an EMPTY form sent POST /renewals/rnw_80789ef6b7b6a63f/activities - no required-field validation (request blocked by test, nothing saved) | Add Update (div, not a button); EMPTY form sent a save request (blocked) | add-BrokerVerse__027-renewals-negotiations-tab1-details.jpg |
| Renewals > Lapse Management | `/renewal/lapse-management` | **Fail** | F14: [tab:Win-back Campaigns] dates as US MM/DD/YYYY: 8/29/2026, 11/27/2026; F14: [form] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F14: [validate] dates as US MM/DD/YYYY: 09/29/2026, 10/29/2026; F11: [validate] 'Create Campaign' on an EMPTY form sent POST /renewals/campaigns - no required-field validation (request blocked by test, nothing saved) | Create Campaign; EMPTY form sent a save request (blocked) | BrokerVerse__064-renewals-lapse-management-tab1-win-back-campaigns.jpg |
| Renewals > Performance | `/renewal/performance` | Pass |  |  | BrokerVerse__065-renewals-performance.jpg |
| Open Items | `/agent/openitemslistdata` | Pass |  |  | BrokerVerse__066-operations-open-items.jpg |
| Payments | `/agent/payments` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-28, 2026-10-29, 2026-10-28; F14: [tab:Pending] dates as ISO YYYY-MM-DD: 2026-10-17, 2026-09-23, 2026-08-04 |  | BrokerVerse__067-operations-payments.jpg |
| Receipts | `/accounts/receipts` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/25/2026, 07/31/2026 |  | BrokerVerse__068-accounts-receipts.jpg |
| Collections | `/agent/collections` | Pass | notes: dates in text form (not DD/MM/YYYY): Dec 22, 2025, May 31, 2026, Aug 4, 2026 |  | BrokerVerse__069-accounts-collections.jpg |
| Accounting Query | `/agent/accounting/query` | Pass |  |  | BrokerVerse__070-accounts-accounting-query.jpg |
| All Clients Accounting | `/agent/accounting/all-clients-details` | Pass |  |  | BrokerVerse__071-accounts-all-clients-accounting.jpg |
| Open Entry Matching | `/accounts/open-entry-matching` | Pass | notes: table empty: No results found |  | BrokerVerse__072-accounts-open-entry-matching.jpg |
| Open Entry Un-Matching | `/accounts/open-entry-unmatching` | Pass | notes: table empty: No results found |  | BrokerVerse__073-accounts-open-entry-un-matching.jpg |
| Disbursement | `/accounts/paymentvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026, 09/27/2026, 09/26/2026; F14: [form] dates as ISO YYYY-MM-DD: 2026-09-29; F14: [validate] dates as ISO YYYY-MM-DD: 2026-09-29 | Create (div, not a button); validation shown (7 msgs) | add-BrokerVerse__037-accounts-disbursement.jpg |
| Petty Cash > Initiate | `/accounts/pettycash/pettycashcodeinitiate` | **Fail** | F14: dates as US MM/DD/YYYY: 09/28/2026 |  | BrokerVerse__075-petty-cash-initiate.jpg |
| Petty Cash > Request | `/accounts/pettycash/pettycashrequest` | **Fail** | F14: dates as US MM/DD/YYYY: 09/24/2026, 09/28/2026 |  | BrokerVerse__076-petty-cash-request.jpg |
| Petty Cash > Disbursement | `/accounts/pettycash/disbursement` | **Fail** | F14: dates as US MM/DD/YYYY: 09/25/2026 |  | BrokerVerse__077-petty-cash-disbursement.jpg |
| Petty Cash > Receipts | `/accounts/pettycash/receipts` | Pass | notes: table empty:  |  | BrokerVerse__078-petty-cash-receipts.jpg |
| Petty Cash > Replenish | `/accounts/pettycash/replenish` | Pass | notes: table empty:  |  | BrokerVerse__079-petty-cash-replenish.jpg |
| Journal Voucher | `/accounts/journalvoucher` | **Fail** | F14: dates as US MM/DD/YYYY: 09/29/2026, 09/28/2026, 09/27/2026 |  | BrokerVerse__080-accounts-journal-voucher.jpg |
| Correction JV | `/accounts/correctionsjv/correctionsjvdetails` | Pass |  |  | BrokerVerse__081-accounts-correction-jv.jpg |
| Reversal JV | `/accounts/reversaljv/reversaljvdetails` | Pass |  |  | BrokerVerse__082-accounts-reversal-jv.jpg |
| Remittance > Automated Processing | `/finance/remittance/automated/execute` | Pass |  |  | BrokerVerse__083-remittance-automated-processing.jpg |
| Remittance > Tracking | `/finance/remittance/tracking/status` | Pass |  |  | BrokerVerse__084-remittance-tracking.jpg |
| Remittance > Statements | `/finance/remittance/statements/generate` | Pass |  |  | BrokerVerse__085-remittance-statements.jpg |
| Remittance > Settlement | `/finance/remittance/settlement/process` | Pass | notes: table empty: No data | Add policies > Validation failed; validation shown (2 msgs) | BrokerVerse__086-remittance-settlement.jpg |
| Remittance > Reconciliation | `/finance/remittance/reconciliation` | Pass |  |  | BrokerVerse__087-remittance-reconciliation.jpg |
| Remittance > Bulk Processing | `/finance/remittance/bulkprocessing` | Pass |  |  | BrokerVerse__088-remittance-bulk-processing.jpg |
| Remittance > Scheduling | `/finance/remittance/scheduling` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2025-09-27; F14: [form] dates as ISO YYYY-MM-DD: 2025-09-27; notes: create/add opened but no save/next button found | New schedule | BrokerVerse__089-remittance-scheduling.jpg |
| Remittance > Electronic Transfer | `/finance/remittance/electronictransfer` | Pass |  | New transfer; save disabled until filled | BrokerVerse__090-remittance-electronic-transfer.jpg |
| Remittance > Approval Workflow | `/finance/remittance/approval` | Pass |  |  | BrokerVerse__091-remittance-approval-workflow.jpg |
| Remittance > Exception Management | `/finance/remittance/exceptions` | **Fail** | F12: [validate] 'Create report' on an empty form showed no required-field message | Create report | BrokerVerse__092-remittance-exception-management-validate.jpg |
| Remittance > Agency Bill Processing | `/finance/remittance/agencybill` | Pass |  |  | BrokerVerse__093-remittance-agency-bill-processing.jpg |
| Remittance > Direct Bill Processing | `/finance/remittance/directbill` | Pass | notes: table empty: Select an insurer and period, then load  |  | BrokerVerse__094-remittance-direct-bill-processing.jpg |
| Remittance > Adjustments | `/finance/remittance/adjustments` | **Fail** | F11: [validate] 'Create Adjustment' on an EMPTY form sent POST /remittance/adjustments - no required-field validation (request blocked by test, nothing saved) | New Adjustment; EMPTY form sent a save request (blocked) | BrokerVerse__095-remittance-adjustments-validate.jpg |
| Remittance > Notifications | `/finance/remittance/notifications` | Pass |  |  | BrokerVerse__096-remittance-notifications.jpg |
| Remittance > History | `/finance/remittance/history` | **Fail** | F14: [tab:System Logs] dates as ISO YYYY-MM-DD: 2026-09-28, 2026-08-15, 2026-07-15 |  | BrokerVerse__097-remittance-history-tab2-system-logs.jpg |
| Remittance > Analytics | `/finance/remittance/analytics` | **Fail** | F15: [tab:Top Performers] content runs past the right edge: Top Agents by Performance; F14: [tab:Alerts & Insights] dates as ISO YYYY-MM-DD: 2026-09-01, 2026-09-29 |  | BrokerVerse__098-remittance-analytics-tab1-top-performers.jpg |
| Incentive > My Programs | `/incentive/my-programs` | Pass |  |  | BrokerVerse__099-incentive-my-programs.jpg |
| Incentive > Calculations | `/incentive/calculations` | Pass |  | New Calculation; save disabled until filled | BrokerVerse__100-incentive-calculations.jpg |
| Incentive > Approvals | `/incentive/approvals` | Pass |  |  | BrokerVerse__101-incentive-approvals.jpg |
| Incentive > Statement | `/incentive/statement` | **Fail** | F05: API GET /incentive/statement?period=2026-09 -> 404; F14: dates as US MM/DD/YYYY: 9/29/2026, 7/15/2026; F05: empty table caused by failed API call; notes: dates in text form (not DD/MM/YYYY): February 15, 2025 |  | BrokerVerse__102-incentive-statement.jpg |
| Commission Dashboard | `/commission/dashboard` | Pass |  |  | BrokerVerse__103-commission-commission-dashboard.jpg |
| Agents/Referrer Accounts | `/commission/referrer-accounts` | Pass |  |  | BrokerVerse__104-commission-agents-referrer-accounts.jpg |
| Treaty Dashboard | `/reinsurance/treaties` | **Fail** | F14: [tab:Renewal Timeline] dates as ISO YYYY-MM-DD: 2026-12-31, 2027-01-01; F14: [form] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F14: [validate] dates as ISO YYYY-MM-DD: 2027-01-01, 2027-12-31, 2026-01-01; F12: [validate] 'Add Treaty' on an empty form showed no required-field message | Add Treaty | BrokerVerse__105-reinsurance-treaty-dashboard-tab2-renewal-timeline.jpg |
| Cession Tracking | `/reinsurance/cessions` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24; F14: [tab:Line of Business Breakdown] dates as ISO YYYY-MM-DD: 2026-09-25, 2026-09-17, 2026-08-24 |  | BrokerVerse__106-reinsurance-cession-tracking.jpg |
| Claims Recovery | `/reinsurance/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-14, 2026-09-25, 2026-09-27; F14: [tab:Recovered Claims] dates as ISO YYYY-MM-DD: 2026-06-25 |  | BrokerVerse__107-reinsurance-claims-recovery.jpg |
| Reconciliation | `/reinsurance/reconciliation` | **Fail** | F14: [tab:Exceptions] dates as ISO YYYY-MM-DD: 2026-09-20, 2026-06-20 |  | BrokerVerse__108-reinsurance-reconciliation-tab1-exceptions.jpg |
| Analytics | `/reinsurance/analytics` | Pass |  |  | BrokerVerse__109-reinsurance-analytics.jpg |
| Operational Reports > Production | `/reports/operationalreports/production` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__110-operational-reports-production.jpg |
| Operational Reports > Claims | `/reports/operationalreports/claims` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-08-30, 2026-09-29 |  | BrokerVerse__111-operational-reports-claims.jpg |
| Operational Reports > Renewal | `/reports/operationalreports/renewal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__112-operational-reports-renewal.jpg |
| Operational Reports > Remittance | `/reports/operationalreports/remittance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__113-operational-reports-remittance.jpg |
| Operational Reports > Broker Commission | `/reports/operationalreports/brokercommision` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__114-operational-reports-broker-commission.jpg |
| Financial Reports > SOA/Premium Receivable | `/reports/financialreports/soapremiumreceivable` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__115-financial-reports-soa-premium-receivable.jpg |
| Financial Reports > Collection Report | `/reports/financialreports/collectionreport` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__116-financial-reports-collection-report.jpg |
| Financial Reports > Payables | `/reports/financialreports/Payables` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__117-financial-reports-payables.jpg |
| Financial Reports > Journal | `/reports/financialreports/journal` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__118-financial-reports-journal.jpg |
| Financial Reports > Trail Balance | `/reports/financialreports/trailbalance` | **Fail** | F14: dates as ISO YYYY-MM-DD: 2026-09-29 |  | BrokerVerse__119-financial-reports-trail-balance.jpg |

