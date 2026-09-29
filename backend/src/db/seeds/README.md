# Seed data

`src/db/seed.js` runs on every API start (after the migrations) and with `npm run seed`. Everything is idempotent:
rows are inserted by natural key or fixed id, and existing rows and administrator edits are kept.

1. In code: roles, permissions and role grants, the administrator `BrokerVerse` (password from `ADMIN_PASSWORD`).
2. `settings.json` (configuration keys) and `jobs.json` (scheduled jobs).
3. The SQL files, in file-name order: `seeds/*.sql` (**reference**) always, and `seeds/sample/*.sql` (**sample**)
   only when `SEED_SAMPLE_DATA` is on. Reference and sample files are interleaved by file name (a reference file
   runs before the sample file with the same name), so a sample file always runs after the reference data it reads.

Roles (broker terminology, `ROLES` in `seed.js`): `system-admin` System Administrator (Super Admin Access, every
permission), `sales` Sales & Marketing (Account Executive), `processing` Processing Team (Placement & Policy Processing),
`operations` Operations (Client Servicing), `claims` Claims, `accounting` Accounting and `accounting-manager` Accounting
Manager (includes Accounting, adds the period-end approval). A database of an earlier release is converted by migration
`0140_broker_roles.sql` (underwriting, customer-services, finance, finance-manager renamed; it-admin, ba and
user-access-admin merged into system-admin; the agent login role withdrawn, its users moved to sales); the seed never
creates the old codes.

`SEED_SAMPLE_DATA`: `true` / `false` (also `1` / `0`, `yes` / `no`, `on` / `off`). Unset: on in development and test,
off with `NODE_ENV=production`. To remove sample data from a database that was seeded with it, use
`npm run purge:sample` (`scripts/purge-sample-data.js`, see `docs/DEPLOY.md`).

Rule for new seed rows: data the business needs to operate the system (configuration, catalogues, tariffs, lookups,
real-world reference lists) is reference; fictional people, companies, accounts and every transaction are sample.
A sample row that the purge script must remove needs a key listed in `scripts/purge-sample-data.js`
(transaction tables are emptied completely).

## Classification

| File | Class | Contents |
|---|---|---|
| `settings.json`, `jobs.json` | reference | configuration keys; scheduled jobs |
| `10_masters.sql` | reference | countries, PH provinces / cities (all NCR LGUs), currencies, banks, insurers (PH non-life companies), products, policy types, vehicle brands / models / variants, BI / PD / PA covers, Head Office branch |
| `sample/10_masters.sql` | sample | fictional authorised signatories; Cebu and Davao demo branches |
| `20_sales.sql` | reference | sales / quotation / policy / endorsement / dashboard settings and e-mail templates; districts and postal codes |
| `sample/20_sales.sql` | sample | seven fictional insurers (quote Share dialog); 16 leads, 10 clients, 14 quotations, 8 policies with receivables, receipts, commissions, 3 endorsements |
| `30_claims_renewals_settings.sql` | reference | claims and renewals settings |
| `sample/31_claims_renewals_base.sql` | sample | 10 clients, 20 policies and receivables for the claims / renewals samples |
| `sample/32_claims.sql` | sample | 15 claims with history and field-change audit |
| `sample/33_renewals.sql` | sample | renewals, renewal quotes, notices, activities, batches, win-back campaign |
| `40_finance.sql` | reference | finance / accounting settings; chart of accounts |
| `sample/40_finance.sql` | sample | 8 fictional commission referrers; sample ledger (receivables, receipts, collections, disbursements, cheque books, petty cash, journal vouchers) |
| `50_system_settings.sql` | reference | System Settings / masters / product configurator / remittance / reinsurance / incentive settings |
| `51_masters.sql` | reference | master screen registry (`master_types`) and reference master records: account categories / setup, covers, departments, designations, hierarchy, lines of business, main / sub accounts, product categories, risk sections, security ratings, taxation, transaction codes, vehicles, remittance / reinsurance / incentive templates; descriptions on countries, provinces, cities, currencies, policy types, products |
| `sample/51_masters.sql` | sample | demo master records: broker companies, employees, bank accounts, petty cash funds, dated exchange rates, insurer commission rates; demo contact details on banks, insurers, signatories, branches |
| `52_product_configurator.sql` | reference | product templates, components, risk sections and mappings |
| `62_period_end_reports.sql` | reference | report catalogue rows of period-end processing and BIR tax (income statement, balance sheet, trial balance with opening / movement / closing, GL detail, aged payables to insurers, month-end close status, VAT summary, SAWT, QAP, SLSP) |
| `sample/53_remittance.sql` | sample | six sample users: five Account Executives with the Sales & Marketing role (`agent.jdelacruz`, `agent.msantos`, `agent.preyes`, `agent.agarcia`, `agent.jmartinez`; the usernames are kept from earlier releases) and an Accounting approver (`fin.approver`); random unusable passwords; remittances, bills, items, approvals, delegation |
| `sample/54_reinsurance.sql` | sample | reinsurers, treaties, cessions, recoveries, bordereaux, reconciliations, exceptions |
| `sample/55_incentive.sql` | sample | incentive programmes, calculations, results |
| `56_chart_of_accounts_masters.sql` | reference | Main / Sub Account masters mirroring the chart of accounts |
| `56_motor_tariff.sql`, `57_ctpl_inclusive_tariff.sql` | reference | motor tariff and CTPL premiums on the motor templates |
| `58_insurer_credit_terms.sql` | reference | credit-term fields (premium warranty days, remittance terms, default billing mode) on the insurance company master screen |
| `60_reports.sql` | reference | report settings and the report catalogue |
| `61_direct_bill.sql` | reference | direct-bill configuration and report columns |
| `70_security.sql` | reference | security configuration |

No persona test users are seeded: the end-to-end persona walk and the tests create their own users.
