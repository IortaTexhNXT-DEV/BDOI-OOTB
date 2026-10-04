---
title: Data Dictionary
subtitle: BrokerVerse OOTB database
version: 1.1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed: 
approved: 
change: Version 1.1.1: release figures aligned (packages B and G merged; migrations to 0331, where 0330 and 0331 add a setting and a trigger and no table or column). Version 1.1: regenerated at migration 0322 (reference data only): Philippine geography, My Work, go-live workbench, AML/CFT, IC and NPC compliance, BIR, operations and accounting, distribution, integrations, e-signatures; encryption of personal identifiers
acronyms: OOTB=Out of the box; BIR=Bureau of Internal Revenue; IC=Insurance Commission; DPA=Data Privacy Act of 2012 (Republic Act No. 10173); NPC=National Privacy Commission; FK=Foreign key; PK=Primary key; GL=General ledger; JV=Journal voucher; OR=Official receipt; PV=Payment voucher; DN=Debit note; EWT=Expanded withholding tax; WHT=Withholding tax; VAT=Value-added tax; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; LGU=Local government unit; TIN=Tax identification number; ATC=Alphanumeric tax code; TOTP=Time-based one-time password; JSON=JavaScript Object Notation; LOB=Line of business; SLA=Service level agreement; PSGC=Philippine Standard Geographic Code; AML=Anti-money laundering; CFT=Countering the financing of terrorism; AMLC=Anti-Money Laundering Council; CTR=Covered transaction report; STR=Suspicious transaction report; EDD=Enhanced due diligence; KYC=Know your customer; CAS=Computerized accounting system; EIS=Electronic Invoicing System; EOPT=Ease of Paying Taxes Act (RA 11976); CTPL=Compulsory third party liability; COC=Certificate of cover; LOA=Letter of authority; PDC=Post-dated cheque; AP=Accounts payable
---

# About this document

This data dictionary describes the database of BrokerVerse OOTB: what each functional area stores, the key tables and how they relate, the conventions every table follows, the main status lifecycles and the columns that hold personal data. It is written for the broker's finance, operations and IT staff who read reports, run data migration and reconcile figures, and for the support team that maintains the system after go-live.

The column-level detail is in the companion workbook **BrokerVerse_Data_Dictionary.xlsx**. This document summarises it and explains the model. Where the two differ, the workbook is the more detailed reference.

## Sources

All facts come from the application and the database:

- the migration files in `backend/src/db/migrations` (151 files, `0001_core.sql` to `0331_pii_client_identifiers.sql`), including the comments written next to the columns;
- among them the migrations of package B, Insurance Commission and data privacy compliance (`0270` to `0277`), and package G, sales activities, product covers in the quotation and fixed asset disposal (`0320` to `0322`), both merged on 04 October 2026, and the two release verification migrations `0330` (EIS outbox restart safety setting) and `0331` (encryption of the client identifiers of the AML/CFT onboarding), which add no table or column;
- the seed files in `backend/src/db/seeds` and the seed step `backend/src/db/seed.js`;
- the module code in `backend/src/modules` (status vocabularies, validation, posting) and the scheduled jobs in `backend/src/jobs`;
- the personal data catalogue of the client data masking tool (`backend/scripts/lib/pii-catalogue.js`) for the classification of personal data;
- the catalogue of a new PostgreSQL database built on 04 October 2026 with all these migrations and the reference seed data only (`SEED_SAMPLE_DATA=false`): tables, columns, keys, indexes, constraints and row counts.

> Row counts in this document and in the workbook are those of the reference data a new database starts with: masters, the Philippine geography, settings, posting rules, number series, report definitions and jobs. Transaction tables are empty. They show what the broker receives out of the box, not production volumes.

The pipeline that regenerates the workbook and the generated parts of this document is in `docs/package/tools/data-dictionary` (`ddpaths.py` describes the steps). Migration numbers 0323 to 0329 are unused.

## The companion workbook

| Sheet | Content |
|---|---|
| Summary | Counts of tables, columns, keys, indexes, constraints and settings; columns by data type; tables and rows by functional area. |
| Tables | One row per table and view: functional area, owning module, description, primary key, rows of reference data, number of columns, the migration that created it, retention class and whether it holds personal data. |
| Columns | One row per column (4,589 rows): position, data type, length or precision, nullable, default, primary key, foreign key target, uniqueness, personal data class, the migration that added it and a business description. |
| Relationships | All 468 foreign keys: child and parent table and columns, delete and update rule, functional areas and whether an index supports the key. |
| Indexes | All 901 indexes: kind, method, columns or expression and the condition of partial indexes. |
| Reference values | Status vocabularies from the code, allowed values of CHECK constraints, values documented in the migrations, all 659 application settings with group, label and seeded value, master types and master records, document number series, roles, tax codes, bank transaction types, the month-end checklist, scheduled jobs and posting rule events. |

## Database at a glance

| Item | Value (reference data only) |
|---|---|
| Database engine | PostgreSQL, schema `public` |
| Migrations applied | 149 (0001_core.sql to 0322_quote_covers_and_risk_fields.sql) |
| Tables | 260 |
| Views | 2 (`bank_account_links`, `bank_book_lines`) |
| Columns | 4,548 in tables, 4,589 including the views |
| Foreign keys | 468 (369 no action, 77 cascade, 22 set null) |
| Indexes | 901 (260 primary keys, 180 further unique, 71 partial, 1 GIN) |
| CHECK constraints | 390 |
| Application settings | 659 keys in 64 groups |
| Rows in all tables | 8,025 (reference data a new database starts with) |
| Columns holding personal data | 367 in 126 tables |

> Compared with issue 1.0 (migration 0216, loaded test database), the model grew by 93 tables. Migrations 0243 to 0322 add the areas Distribution and marketing, Fleet, marine and motor claims, Payables and fixed assets, BIR returns and invoicing, Compliance and Integrations, and tables in the existing areas (cover notes, post-dated cheques, claim documents, facultative reinsurance, override commission, KYC of juridical clients, go-live data load, My Work, e-signatures). Each is described below where it belongs.

# Conventions

## Naming

- Tables and columns are lower case with underscores (`journal_vouchers`, `premium_total`). Table names are plural nouns (`policies`, `receipts`); line and child tables add a suffix (`receipt_lines`, `posting_rule_lines`, `renewal_notices`).
- A foreign-key column is named after the parent with `_id` (`policy_id`, `client_id`, `insurance_company_id`). Where a table refers to the same parent more than once, the column says the role: `renewed_from`, `new_policy_id`, `reversal_of`, `booking_jv_id`, `accrual_jv_id`, `owner_user_id`, `handler_user_id`.
- Stamps end in `_at` (date and time) and `_by` (user): `approved_at`, `approved_by`. Calendar dates end in `_date` (`jv_date`, `due_date`, `loss_date`). Flags start with `is_` or read as a yes or no question (`is_open_item`, `allow_manual`, `per_participant`).
- Readable document numbers end in `_number` (`policy_number`, `receipt_number`, `jv_number`). Rates and shares say their unit where it matters: `_pct` and `_percent` hold percent, `commission_rate` holds a fraction.
- Codes taken from settings or masters keep the code of the source (`branch_code`, `account_code`, `gl_account_code`, `type_code`).

## Identifiers

| Kind | How it works |
|---|---|
| Text key with prefix (103 tables) | Business records. The database generates a prefix and random hexadecimal characters, for example `pol_` + 16 characters for a policy, `qt_` for a quotation, `or_` for a receipt, `jv_` for a journal voucher. The ids cannot be guessed and never collide across tables. `commission_referrers` and `reinsurers` use a readable code instead (for example `ref-dcruz`, `RE001`). |
| Sequential number (125 tables) | Masters, lines and logs (`integer` or `bigint` from a sequence): countries, banks, insurers, products, `journal_lines`, `audit_log`, `login_history`, `claim_history`, `risk_participants`. |
| Natural or composite key (the other tables) | Codes that are themselves the key: `app_settings(key)`, `gl_accounts(code)`, `tax_codes(code)`, `accounting_periods(period)`, `fiscal_years(code)`, `master_types(code)`, `sequences(name, period)`, `opening_balances(fiscal_year, account_code)`, `role_permissions(role_id, permission_id)`. |

Business numbers (QT-2026-00001, POL-2026-00001, OR-2026-00019, JV-, BS-, PS-, REM-, DN-, BRC-, MEC-) are separate unique columns, never primary keys. Every number comes from a series of the Document Numbering master (`document_numbering`, 85 series). The SQL function `next_document_number()` locks the counter row in `sequences` until the transaction ends, so two users never receive the same number and a cancelled save gives its number back. The pattern tokens are `{PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {SEQ}`; the reset rule is yearly, fiscal_yearly, monthly or never.

## Money, rates and shares

- Amounts are `numeric`: 310 columns are `numeric(14,2)` and 102 are `numeric(16,2)` (sums insured, credit limits, bank statement and reconciliation figures, statement and certificate totals, treaty capacity). The application rounds every result to two decimals with half away from zero, the same rule as PostgreSQL `round(numeric, 2)`.
- The currency of a document is in a `currency` column (`PHP` by default) where a document can be in another currency; `journal_lines` carry `currency_code`, `exchange_rate` and `foreign_amount`. All ledger amounts are in the base currency of the Currency master (PHP); journal vouchers convert at the dated Exchange Rate in force on the voucher date.
- Commission rates are fractions: `commission_rate` 0.15 means 15% (`insurance_companies`, `commission_rates`, `insurer_rate_tables`, `risk_participants`). Tax rates in `tax_codes.rate` and `premium_charge_rules.rate` are percent (12 means 12%). Co-insurance shares (`share_percent`, `offered_share`) are percent from 0 to 100.
- Debit and credit are separate non-negative columns on `journal_lines` and `bank_statement_lines`; a journal line has either a debit or a credit (CHECK constraint).

## Dates and the business time zone

- Calendar dates (inception, expiry, due, loss, receipt, voucher, statement and period dates) are `date` columns (217 columns). They carry no time and cannot shift with the time zone.
- Instants (creation, approval, posting, sending) are `timestamptz` (590 columns): stored as an absolute point in time and shown in local time.
- "Today" is the business date in the time zone of the setting `general.timezone`, seeded as **Asia/Manila**. Date columns that default to today use the function `numbering_business_date()` (migration `0145_business_date_defaults.sql`), so a record created between 00:00 and 08:00 Manila time gets the Manila date, not the date of the server clock, which runs on UTC. Document numbering, period assignment, reports and scheduled jobs use the same business date.
- Accounting periods are keyed `YYYY-MM`; period 13 of a fiscal year is the year-end adjustment period. A journal falls in the period of its `jv_date`.
- The screens show dates as DD/MM/YYYY (`general.date_format`). This document writes dates as 03 October 2026.

## Audit columns

| Column | Tables | Meaning |
|---|---|---|
| `created_at` | 192 | Date and time the row was created. |
| `created_by` | 157 | User id of the creator. |
| `updated_at` | 148 | Date and time of the last change; set by the application, and by triggers on `users`, `roles`, `commission_rates` and `document_numbering`. |
| `updated_by` | 107 | User id of the last change. |
| Maker-checker stamps | many | `submitted_by` / `submitted_at`, `approved_by` / `approved_at`, `rejected_by` / `rejected_at`, `posted_by` / `posted_at`, `decided_by` / `decided_at`. |

Every create, update, approval, posting and sign-in related event is also written to `audit_log` (who, when, which record, action, values before and after, IP address). Domain histories add detail where it is needed: `claim_history`, `claim_field_changes`, `renewal_activities`, `renewal_notices`, `collection_actions`, `period_status_history`, `bank_reconciliation_history`, `remittance_approvals.history`, `login_history`, `password_history` and `job_runs`.

## Status, soft delete and cancellation

- Almost every business table has a `status` column (171 tables). Statuses are stored as lower-case codes in most tables; some older modules store the label (`Accrued`, `Paid`, `Active`). The screens map codes to labels, for example a quotation with status `sent` shows as **PendingCustomer**. The values of each status column are in the workbook, sheet Reference values.
- Masters are not deleted while in use: they become `inactive`, and generic master records get the status `deleted`; unique indexes on codes are partial (`WHERE status <> 'deleted'`) so a code can be reused after deletion.
- Leads, quotations and bank statements carry `deleted_at` (soft delete). A draft quotation is the only business record deleted physically.
- Financial documents are never deleted. A receipt is cancelled, a journal is reversed or corrected by another journal (`reversal_of`, `reversed_by_jv`, `correction_of`), a BIR Form 2307 certificate is cancelled (`cancelled_at`), a debit note collection is reversed.

## JSON document columns

166 columns are `jsonb`. They hold the parts of a record whose structure depends on the product or the screen: the full document of a quotation, broker slip, placement or policy (`doc`), vehicle and cover selections, claim details, endorsement changes, configuration values (`app_settings.value`), master record fields (`master_records.data`) and before and after values of the audit trail. Anything that is searched, totalled, joined or reported on is kept in ordinary columns. The workbook marks each JSON column and describes its content.

## Keys, constraints and indexes

- **Foreign keys.** 468 foreign keys. 369 use no action: a referenced record cannot be deleted while it is used. 77 cascade: lines and histories that have no meaning without their parent (journal lines, receipt lines, claim history, renewal notices, role grants, match items). 22 set the reference to empty when the parent goes. 64 foreign keys point to `users`; other user columns (`created_by`, `approved_by`) hold the user id without a foreign key.
- **Supporting indexes.** 60 foreign keys have no index whose first column is the foreign-key column. They are on small master and set-up tables or are maker-checker stamp columns. The sheet Relationships flags them.
- **CHECK constraints.** 390 constraints protect allowed values (statuses, kinds, rate bases), number ranges (rates, shares, instalment counts) and rules that span columns (a journal line has a debit or a credit, a limit is for a role or for a user, a delegation ends after it starts).
- **Unique and partial indexes.** Business numbers and codes are unique. Partial unique indexes enforce rules such as one active instalment plan per bill, one pending warranty extension per policy, one lead insurer per co-insured record and one open renewal per policy.
- **Triggers.** `jv_check_posting` refuses to post a journal that is unbalanced, has fewer than two lines or falls in a period that does not accept postings. `accounting_period_lock_guard` refuses to reopen a period locked by the year-end close. Further triggers keep `updated_at`, derive the normal balance of a GL account and mirror number series prefixes into settings. With package B, triggers on `clients`, `leads`, `commission_referrers`, `bir_2307_certificates`, the JSON documents of quotations, placements and policies and `audit_log` encrypt personal identifiers before they are stored (chapter 6).

## References without a foreign key

Some tables refer to more than one kind of parent, so the reference is a pair of columns without a foreign key:

| Table | Columns | Refers to |
|---|---|---|
| `risk_participants` | `entity_type`, `entity_id` | A broker slip, quotation, placement or policy (co-insurance participants). |
| `package_sections` | `entity_type`, `entity_id` | A bundle quotation or a package policy. |
| `journal_vouchers` | `reference_type`, `reference_id` | The source document of a journal (Policy, Receipt, Disbursement, Commission, Endorsement, Claim ...). |
| `documents` | `entity`, `entity_id` | The record a stored file belongs to. |
| `audit_log`, `notifications`, `email_outbox`, `agent_events` | `entity`, `entity_id` | The record the entry is about. |
| `remittance_approvals` | `entity`, `entity_id` | A remittance or a remittance work item. |
| `payment_links` | `target_type`, `target_id` | A bundle quotation, quotation or policy. |
| `bank_statement_lines`, `bank_statements`, `bank_rec_matches` | `bank_account_id` | A bank account master record (`master_records`, type `bank-account`). |
| `work_tasks` | `entity`, `entity_id` | The record a task is about (client, policy, claim, quotation, renewal, collection item). |
| `integration_outbox`, `integration_inbox` | `entity`, `entity_id` | The business record a message was sent or received for. |
| `aml_alerts`, `aml_report_items` | `reference_type`, `reference_id` | The transaction a monitoring rule raised an alert on (receipt, policy, claim payment). |
| `sales_invoices` | `source_type`, `source_id` | The commission, fee, override settlement or asset disposal invoiced. |
| `e_signatures`, `payee_bank_accounts` | `owner_type`, `owner_id` / `payee_type`, `payee_id` | A signatory or a user; an insurer, referrer, client or supplier. |

# Data model by functional area

## Overview

| Functional area | Tables | Key tables |
|---|---|---|
| Party and client | 14 | `clients`, `insurance_companies`, `client_beneficial_owners` |
| Product and rating | 15 | `products`, `product_templates`, `premium_charge_rules` |
| Sales and quotation | 9 | `leads`, `quotes`, `payment_links` |
| Placement | 4 | `broker_slips`, `insurer_offers`, `placements`, `risk_participants` |
| Policy and endorsement | 5 | `policies`, `endorsements`, `cover_notes` |
| Billing, receipts and payments | 17 | `receivables`, `receipts`, `receipt_applications`, `disbursements` |
| Remittance and insurer accounting | 12 | `remittances`, `direct_bill_items`, `commission_debit_notes` |
| Commission | 8 | `commissions`, `commission_rates`, `override_agreements` |
| Claims | 6 | `claims`, `claim_settlement_movements`, `claim_document_items` |
| Renewals | 7 | `renewals`, `renewal_quotes` |
| General ledger and period end | 20 | `journal_vouchers`, `journal_lines`, `gl_accounts`, `posting_rules`, `accounting_periods` |
| Bank and insurer reconciliation | 13 + 2 views | `bank_statements`, `bank_rec_matches`, `bank_reconciliations`, `insurer_statements` |
| Credit control | 7 | `collection_items`, `premium_instalment_plans` |
| Reinsurance | 10 | `reinsurance_treaties`, `cessions`, `fac_placements` |
| Incentives | 3 | `incentive_programs`, `incentive_results` |
| Security and audit | 16 | `users`, `roles`, `audit_log` |
| Configuration and schedules | 24 | `app_settings`, `master_records`, `document_numbering`, `scheduled_jobs`, `data_load_batches` |
| Distribution and marketing | 13 | `lead_assignment_rules`, `distribution_channels`, `motor_programmes`, `campaigns` |
| Fleet, marine and motor claims | 8 | `fleet_schedules`, `open_covers`, `claim_repair_estimates` |
| Payables and fixed assets | 7 | `supplier_invoices`, `supplier_payments`, `fixed_assets` |
| BIR returns and invoicing | 6 | `bir_return_filings`, `sales_invoices`, `eis_submissions` |
| Compliance | 24 | `aml_risk_assessments`, `aml_cases`, `compliance_licences`, `complaints`, `personal_data_breaches` |
| Integrations | 12 | `integration_connectors`, `integration_outbox`, `ctpl_authentications`, `bank_payment_batches` |

## Party and client

The client is the insured party. A client is created from a lead when a quotation is converted, by bulk upload or directly on the client screen. Individual and corporate clients share one table (`client_type`); identity, contact and address fields are columns, further screen fields are in `extra`. Insurers (principals) carry the commission rate used when the rate matrix has no rate, the premium payment warranty days, the remittance terms and the default billing mode. The address masters (`countries` → `regions` → `states` (provinces) → `cities` (cities and municipalities) → `districts` (barangays), and `postal_codes`, from the Philippine Standard Geographic Code, 2nd quarter 2026) feed the address fields. The table `states` keeps its earlier name; every screen calls it Province. The full barangay list is an optional load (`backend/scripts/load-barangays.js`). A juridical client is onboarded with its signatories, beneficial owners and due diligence documents before its first policy (AML/CFT). Branches and signatories are printed on documents.

| Table | Holds |
|---|---|
| `clients` | Insured parties: code, type, names, birth date, contact, address, TIN, owner, credit limit. |
| `insurance_companies` | Insurers: code, name, TIN, contact, default commission rate, premium warranty days, remittance terms days, default billing mode. |
| `banks` | Banks and mortgagees. Bank accounts of the broker are master records of type `bank-account`. |
| `branches`, `signatories` | Broker branches and the persons who sign documents. |
| `countries`, `regions`, `states`, `cities`, `districts`, `postal_codes` | Address masters (PSGC codes on regions, provinces, cities / municipalities and barangays). |
| `client_signatories`, `client_beneficial_owners`, `client_kyc_documents` | Signatories and beneficial owners of a juridical client and the customer due diligence documents (AML/CFT onboarding). |

| From | To | Meaning |
|---|---|---|
| `clients.lead_id` | `leads` | Lead the client was converted from (unique when set). |
| `clients.owner_user_id` | `users` | Account executive who owns the client. |
| `states.country_id`, `cities.state_id`, `districts.city_id` | address masters | Province within a country, city within a province, barangay within a city. |
| `states.region_id`, `cities.region_id` | `regions` | Region of a province and of a city or municipality (migration 0250). |
| `client_signatories.client_id`, `client_beneficial_owners.client_id`, `client_kyc_documents.client_id` | `clients` | KYC records of a client. |

## Product and rating

Products are the lines sold (motor, fire, marine, casualty, engineering, accident, employee benefits). Each product has policy types and, for motor, the cover options for bodily injury, property damage and personal accident. The product configurator keeps versioned templates with their components (covers, rating factors, taxes, rules, documents) and the risk definitions per line. Premium charges (VAT or premium tax, DST, FST, LGT) are computed from `premium_charge_rules` and the LGT rates per province or city. Packaged products combine several products in one bundle; insurer rate tables price each section for the quick quote comparison.

| Table | Holds |
|---|---|
| `products`, `policy_types`, `coverages` | Product catalogue, policy types per product, motor cover options. |
| `product_templates`, `product_components` | Versioned product templates and their components (JSON). |
| `product_risk_mappings`, `product_risk_sections` | Risk fields and risk sections per product or line. |
| `premium_charge_rules`, `lgu_tax_rates` | Tax and charge rules with effective dates; LGT rate per LGU. |
| `package_bundles`, `package_bundle_sections`, `insurer_rate_tables` | Bundles, their sections and the insurer rates used to price them. |
| `vehicle_brands`, `vehicle_models`, `vehicle_variants` | Vehicle make, model and variant lists for motor quotations. |

| From | To | Meaning |
|---|---|---|
| `policy_types.product_id` | `products` | Policy type of a product. |
| `coverages.policy_type_id` | `policy_types` | Cover option of a policy type. |
| `product_templates.product_id`, `parent_id` | `products`, `product_templates` | Template of a product; version derived from an earlier one. |
| `product_components.template_id` | `product_templates` | Component of a template (deleted with it). |
| `package_bundle_sections.bundle_id`, `product_id` | `package_bundles`, `products` | Section of a bundle and its product. |
| `insurer_rate_tables.insurance_company_id`, `product_id` | `insurance_companies`, `products` | Rate of an insurer for a product. |
| `lgu_tax_rates.city_id` | `cities` | City whose LGT rate applies. |

## Sales and quotation

A lead is a prospect with its contact data, product interest, source and owner. A quotation (`quotes`) is prepared for a lead or a client, for a product, policy type and insurer; motor quotations keep the vehicle and cover selections, all quotations keep the full document in `doc` with the premium breakdown. The customer accepts through an e-mailed approval link (only the hash of the token is checked) or staff record the answer in `quote_customer_responses`. Converting an accepted quotation issues the policy. Packaged products have their own bundle quotations with one priced section per product. Payment links let a client pay a quotation, a bundle quotation or a policy's open premium online through a gateway; every gateway notification is logged in `payment_events`.

| Table | Holds |
|---|---|
| `leads` | Prospects: number, type, names, contact, address, product interest, source, status, owner. |
| `quotes` | Quotations: number, lead or client, product, insurer, vehicle and covers, premium, taxes, commission, approval link, status. |
| `quote_customer_responses` | Customer answers recorded by staff, with channel, outcome and evidence. |
| `package_quotes`, `package_sections` | Bundle quotations and their priced sections (also the sections of a package policy). |
| `payment_gateways`, `payment_links`, `payment_events` | Online payment set-up, payment requests and the gateway notification log. |
| `agent_events` | Calendar events and reminders of a user. |

| From | To | Meaning |
|---|---|---|
| `quotes.lead_id`, `client_id` | `leads`, `clients` | Prospect or client quoted. |
| `quotes.product_id`, `policy_type_id`, `insurance_company_id` | masters | What is quoted and with which insurer. |
| `quotes.broker_slip_id` | `broker_slips` | Broker slip the quotation was prepared from (placement journey). |
| `quotes.policy_id` | `policies` | Policy issued from the quotation. |
| `quote_customer_responses.quote_id` | `quotes` | Response to a quotation. |
| `package_quotes.bundle_id`, `policy_id` | `package_bundles`, `policies` | Bundle quoted; package policy issued. |
| `payment_links.gateway_code`, `receipt_id` | `payment_gateways`, `receipts` | Gateway used; official receipt created from the payment. |
| `payment_events.link_id` | `payment_links` | Notification about a payment link. |

## Placement

Placement is the journey for risks that need terms from several insurers. A broker slip describes the risk and the covers requested and is sent to several insurers; each answer is an insurer offer (premium, rate, taxes, deductibles, validity, share offered) or a decline. The selected offers become a quotation or a placement slip, the firm order to the chosen insurers. When the risk is co-insured, `risk_participants` holds the lead insurer and the co-insurers with their shares, premium, taxes and commission; the same table serves the broker slip, quotation, placement and policy. The policy is issued when every participant has bound.

| Table | Holds |
|---|---|
| `broker_slips` | Broker slips (BS-): client or lead, product, risk details, requested covers, response due date, status. |
| `insurer_offers` | Offers (OFR-) or declines from each insurer on a slip; the selected flag. |
| `placements` | Placement slips (PS-): lead insurer, premium, taxes, billing mode, binding and issue stamps, policy issued. |
| `risk_participants` | Co-insurance participants: insurer, lead flag, share, premium, taxes, commission, binding confirmation. |

| From | To | Meaning |
|---|---|---|
| `insurer_offers.broker_slip_id` | `broker_slips` | Offer on a slip (deleted with the slip). |
| `broker_slips.quote_id` | `quotes` | Quotation slip prepared from the selected offers. |
| `placements.broker_slip_id`, `quote_id` | `broker_slips`, `quotes` | Origin of the placement. |
| `placements.policy_id` | `policies` | Policy issued from the placement. |
| `risk_participants.insurance_company_id` | `insurance_companies` | Participating insurer; the parent record is given by `entity_type` and `entity_id`. |

## Policy and endorsement

The policy is the central record. It points to the client, product, policy type, insurer (the lead insurer when co-insured), the quotation or placement it came from and the policy it renews. `billing_mode` decides the money flow: **broker** (the broker bills and collects the premium and remits it to the insurer) or **direct** (the insurer bills the client and the broker bills its commission to the insurer). Endorsements change an issued policy, re-price it and may raise their own bill or return premium; a cancellation is an endorsement. Front-office staff capture premium payments on a policy in `policy_payments` until Accounting confirms them and issues the official receipt.

| Table | Holds |
|---|---|
| `policies` | Policies: number, client, product, insurer, term, sum insured, premium, taxes, commission, billing mode, payment status, renewal links, status. |
| `endorsements` | Endorsements and cancellations: type, changes, premium change, billing link, status. |
| `package_endorsements` | Changes of one section of a package policy and the additional premium. |
| `policy_payments` | Payments captured on a policy awaiting confirmation by Accounting. |
| `cover_notes` | Cover notes (binders) issued from a quotation or placement while the insurer's policy is pending; superseded by the policy. |

| From | To | Meaning |
|---|---|---|
| `policies.client_id`, `product_id`, `policy_type_id`, `insurance_company_id` | masters and `clients` | Insured, product and insurer of the policy. |
| `policies.quote_id`, `placement_id`, `lead_id` | `quotes`, `placements`, `leads` | Origin of the policy. |
| `policies.renewed_from` | `policies` | Expiring policy this one renews (`renewed_to` holds the reverse link). |
| `endorsements.policy_id`, `receivable_id` | `policies`, `receivables` | Policy changed; bill raised for the additional premium. |
| `policy_payments.policy_id`, `receivable_id`, `receipt_id` | `policies`, `receivables`, `receipts` | Payment captured, bill paid and receipt issued on confirmation. |
| `cover_notes.quote_id`, `placement_id`, `policy_id` | `quotes`, `placements`, `policies` | Origin of the cover note and the policy that superseded it. |

## Billing, receipts and payments

Issuing a broker-billed policy, endorsement or renewal raises a premium bill (`receivables`, INV-) and its booking journal. For a co-insured policy `receivable_participants` splits the bill per insurer. An official receipt (`receipts`, OR-) has lines per policy, and receipt applications allocate the money to the bills and link the posting journal. Return premium and cancellations reduce a bill through `receivable_credits`; small differences are written off with a reason from `write_off_reasons`. Payments out are payment vouchers (`disbursements`, PV-) that settle invoice lists (amounts due to insurers, clients or referrers) and may be paid by cheque (`checkbooks`). Petty cash funds have their own requests, payments, receipts and replenishments.

| Table | Holds |
|---|---|
| `receivables` | Premium bills: number, policy, client, amount, balance, due date, ageing, booking journal, status. |
| `receivable_participants` | Insurer shares of a co-insured bill: gross, commission, taxes, due to insurer. |
| `receivable_credits` | Return premium and cancellation credits applied to a bill, with the refund part. |
| `receipts`, `receipt_lines`, `receipt_applications` | Official receipts, their lines per policy and the application to bills. |
| `write_off_reasons` | Write-off reasons with GL account and maximum amount. |
| `disbursements`, `invoice_lists`, `checkbooks` | Payment vouchers, the invoice lists they settle and cheques. |
| `petty_cash_funds`, `petty_cash_requests`, `petty_cash_request_lines`, `petty_cash_disbursements`, `petty_cash_receipts`, `petty_cash_replenishments` | Petty cash. |
| `post_dated_cheques` | Post-dated cheques on hand against bills; depositing one on its date creates the official receipt. |

| From | To | Meaning |
|---|---|---|
| `receivables.policy_id`, `client_id`, `booking_jv_id` | `policies`, `clients`, `journal_vouchers` | Bill of a policy and the journal that booked it. |
| `receipt_lines.receipt_id` | `receipts` | Line of a receipt (deleted with it). |
| `receipt_applications.receipt_id`, `receipt_line_id`, `receivable_id`, `journal_id` | receipts, `receivables`, `journal_vouchers` | Money of a receipt line applied to a bill, and the posting journal. |
| `receivable_credits.receivable_id`, `journal_id` | `receivables`, `journal_vouchers` | Credit on a bill and its journal. |
| `invoice_lists.disbursement_id` | `disbursements` | Invoice list settled by a payment voucher. |
| `checkbooks.disbursement_id`, `invoice_list_id` | `disbursements`, `invoice_lists` | Cheque issued for a voucher. |
| `petty_cash_*.fund_id` | `petty_cash_funds` | Movements of a petty cash fund. |
| `post_dated_cheques.receivable_id`, `receipt_id`, `replaced_by_id` | `receivables`, `receipts`, `post_dated_cheques` | Bill the cheque pays, receipt created on deposit, replacement cheque. |

## Remittance and insurer accounting

Broker-billed premium collected from clients is remitted to the insurers net of commission. A remittance (REM-) has lines per policy; for a co-insured policy `remittance_allocations` splits each collection by insurer share. Settlements, adjustments and exceptions are remittance work items, and `remittance_approvals` is the multi-level approval register with SLA and history. Refunds due from an insurer on premium already remitted are held in `insurer_refund_credits` and netted against the next remittance. For direct-billed policies the broker's commission is a receivable from the insurer: `direct_bill_items` are billed on commission debit notes (DN-) and settled by debit note collections (cash plus EWT supported by BIR Form 2307). The client's own payment to the insurer is recorded in `direct_bill_client_payments` for follow-up only; it posts no journal.

| Table | Holds |
|---|---|
| `remittances`, `remittance_lines` | Remittance bills to insurers and the policies included. |
| `remittance_allocations` | Co-insurance split of each collection by insurer. |
| `remittance_items`, `remittance_approvals` | Work items and approval requests (approval limits and delegations: `authority_limits`, `user_delegations`). |
| `insurer_refund_credits` | Refunds due from insurers, netted against later remittances. |
| `direct_bill_items`, `commission_debit_notes`, `commission_debit_note_lines`, `commission_debit_note_collections` | Direct-bill commission receivable, debit notes and their collection. |
| `direct_bill_client_payments` | Client payments made directly to the insurer (no journal). |

| From | To | Meaning |
|---|---|---|
| `remittance_lines.remittance_id`, `policy_id` | `remittances`, `policies` | Policy in a remittance (deleted with the remittance). |
| `remittances.insurance_company_id` | `insurance_companies` | Insurer paid. |
| `remittance_allocations.receipt_application_id`, `invoice_list_id` | `receipt_applications`, `invoice_lists` | Collection split and the invoice list that remitted it. |
| `direct_bill_items.debit_note_id`, `policy_id`, `booking_jv_id` | `commission_debit_notes`, `policies`, `journal_vouchers` | Commission item billed on a debit note, its policy and booking journal. |
| `commission_debit_note_lines.debit_note_id`, `item_id` | `commission_debit_notes`, `direct_bill_items` | Lines of a debit note. |
| `commission_debit_note_collections.debit_note_id`, `journal_id` | `commission_debit_notes`, `journal_vouchers` | Collection against a debit note and its journal. |

## Commission

Commission (`commissions`) here is the referrer commission (comsub) paid to sub-agents and external referrers. One line is created per policy or endorsement and per referrer in the referral chain (`chain_position`); the line shows the brokerage the broker earns, the comsub (a fixed amount plus a percent of net premium), withholding tax and the net payable. The line links to its accrual and payment journals and to the payment voucher that paid it. When premium is returned or a policy cancelled, `commission_adjustments` records the reduction, reversal or clawback. The broker's own commission rate for a new policy comes from `commission_rates` (insurer, product, line, new or renewal, effective dates), else from the insurer's default rate.

| Table | Holds |
|---|---|
| `commissions` | Referrer commission lines: basis, rates, comsub, withholding, net, journals, voucher, status. |
| `commission_adjustments` | Reductions, reversals and clawbacks of commission lines. |
| `commission_rates` | Broker commission rate matrix with effective dates. |
| `commission_referrers` | Referrers and sub-agents: hierarchy, withholding rate, payout bank account. |
| `override_agreements`, `override_agreement_tiers`, `override_computations`, `override_settlements` | Overriding, profit and contingent commission from insurers: agreements and tiers, computed amounts (accrued) and settlements (invoiced and posted). |

| From | To | Meaning |
|---|---|---|
| `commissions.policy_id`, `endorsement_id`, `referrer_id` | `policies`, `endorsements`, `commission_referrers` | Source and payee of the commission line. |
| `commissions.accrual_jv_id`, `payment_jv_id`, `disbursement_id` | `journal_vouchers`, `disbursements` | Accrual and payment journals and the paying voucher. |
| `commission_adjustments.commission_id` | `commissions` | Line adjusted. |
| `commission_referrers.parent_referrer_id` | `commission_referrers` | Referrer hierarchy. |
| `override_computations.agreement_id`, `override_settlements.computation_id` | `override_agreements`, `override_computations` | Computation under an agreement and its settlement. |

## Claims

A claim belongs to a policy and client and carries the loss details, the estimate, approved and settled amounts and the handler. Motor claims keep driver and third-party details in JSON. Every status change is in `claim_history` and every field change in `claim_field_changes`. Settlement cash is recorded in `claim_settlement_movements`: funds received from each insurer and payments to the claimant, each with its journal. Recoveries from reinsurers are in the reinsurance area.

| Table | Holds |
|---|---|
| `claims` | Claims: number, policy, client, loss date, type, place, amounts, handler, adjuster, settlement, status. |
| `claim_history`, `claim_field_changes` | Status history and field-level change trail. |
| `claim_settlement_movements` | Funds received from insurers and paid to claimants, with journals. |
| `claim_document_items`, `claim_document_reminders` | Document checklist of a claim (copied from the checklist master) and the reminders sent for missing documents. |

| From | To | Meaning |
|---|---|---|
| `claims.policy_id`, `client_id` | `policies`, `clients` | Policy and insured of the claim. |
| `claim_history.claim_id`, `claim_field_changes.claim_id` | `claims` | Histories (deleted with the claim). |
| `claim_settlement_movements.claim_id`, `insurance_company_id`, `journal_id` | `claims`, `insurance_companies`, `journal_vouchers` | Settlement cash movement, paying insurer and journal. |
| `claim_document_items.claim_id`, `document_id` | `claims`, `documents` | Required document of a claim and the file received. |

## Renewals

The renewal pipeline job creates a renewal case for each policy approaching expiry. The case tracks notices sent, contact attempts, the renewal quotation (re-rating with loading and discounts), approval and the outcome: the renewal policy or a lapse. Renewal batches send notices and quotations for many policies at once through the background queue. Win-back campaigns target lapsed business.

| Table | Holds |
|---|---|
| `renewals` | Renewal cases: expiring policy, client, old and new premium, notice stage, contact attempts, type, status, renewal policy. |
| `renewal_quotes` | Renewal quotations with loading, discount and variance. |
| `renewal_notices`, `renewal_activities` | Notices sent and contact activities. |
| `renewal_batches`, `renewal_batch_policies` | Batch runs and the policies in them. |
| `winback_campaigns` | Win-back campaigns. |

| From | To | Meaning |
|---|---|---|
| `renewals.policy_id`, `new_policy_id` | `policies` | Expiring policy and the renewal policy issued. |
| `renewal_quotes.renewal_id`, `renewal_notices.renewal_id`, `renewal_activities.renewal_id` | `renewals` | Quotation, notices and activities of a case (deleted with it). |
| `renewal_batch_policies.batch_id`, `policy_id`, `renewal_id` | `renewal_batches`, `policies`, `renewals` | Policy in a batch run. |

## General ledger and period end

Every system journal is built from a posting rule: the rule of a business event (for example `policy.issue.broker_billed`, `receipt.apply`, `remittance.settlement`) has versions with an effective date and lines that name a GL account or an account role. Account roles resolve to GL accounts through the Account Determination settings `accounting.account.<role>`. A line marked per participant is split across co-insurers by share. Changes to posting rules and account determination wait for a second user's approval (`accounting_config_changes`). Journal vouchers hold balanced journal lines on the chart of accounts; open-item accounts are matched debit to credit in `entry_matches`. Periods 1 to 12 and the adjustment period 13 of each fiscal year are opened, soft-closed, closed and locked; the month-end close run posts accruals and recurring journals, checks the checklist and closes the period. The year-end close posts the closing entries, carries the balances into `opening_balances` of the next year and locks the year. Tax codes hold VAT, EWT with ATC, DST and LGT; BIR Form 2307 certificates are kept per payee or payor and quarter.

| Table | Holds |
|---|---|
| `gl_accounts` | Chart of accounts: type, category, financial statement group, normal balance, open-item and manual-use flags. |
| `journal_vouchers`, `journal_lines` | Journals and their debit and credit lines with client, policy, insurer, branch and department tags. |
| `entry_matches` | Open-item matching of debit and credit lines, with write-off. |
| `posting_rules`, `posting_rule_lines`, `accounting_config_changes` | Posting rule versions, their lines and pending configuration changes. |
| `fiscal_years`, `accounting_periods`, `period_status_history` | Fiscal years, periods and every period status change. |
| `period_close_checklist`, `period_close_runs`, `period_close_run_checks`, `period_close_entries` | Month-end checklist, close runs, check results and close journals. |
| `recurring_journals`, `recurring_journal_runs` | Recurring and accrual journal templates and their occurrences. |
| `year_end_runs`, `opening_balances` | Year-end close runs and the opening balances they carry forward (or loaded at go-live). |
| `tax_codes`, `bir_2307_certificates` | Tax codes and BIR Form 2307 certificates. |

| From | To | Meaning |
|---|---|---|
| `journal_lines.jv_id` | `journal_vouchers` | Lines of a journal (deleted with a draft journal). |
| `journal_lines.policy_id`, `client_id` | `policies`, `clients` | Subsidiary-ledger tags of a line. |
| `journal_vouchers.posting_rule_id` | `posting_rules` | Rule version the journal was built from. |
| `journal_vouchers.reversal_of`, `reversed_by_jv`, `correction_of` | `journal_vouchers` | Reversal and correction chain. |
| `entry_matches.debit_line_id`, `credit_line_id` | `journal_lines` | Lines matched as an open item. |
| `posting_rule_lines.rule_id` | `posting_rules` | Lines of a rule version. |
| `accounting_periods.fiscal_year`, `opening_balances.fiscal_year` | `fiscal_years` | Periods and opening balances of a year. |
| `period_close_runs.period` | `accounting_periods` | Period closed by a run. |
| `year_end_runs.closing_jv_id`, `transfer_jv_id` | `journal_vouchers` | Closing and retained-earnings transfer journals. |

## Bank and insurer reconciliation

Bank statements are imported with a statement format (or keyed) into `bank_statements` and `bank_statement_lines`; a line hash refuses duplicates. Matches link bank lines to the journal lines on the GL cash account of the bank account (the view `bank_book_lines` gives that book side). Unmatched bank items such as charges and interest are posted with a bank transaction type. The monthly bank reconciliation stores the statement figures and, once approved, locks the matches cleared up to its date. Insurer statements of account (premium remittance confirmations or commission statements) are imported with a per-insurer column mapping and matched line by line to remittance lines, debit note lines or policies; differences are resolved with a note or an adjustment journal posted on approval.

| Table | Holds |
|---|---|
| `bank_statement_formats`, `bank_transaction_types`, `bank_match_rules` | File layouts, bank-side transaction types and automatic matching rules. |
| `bank_statements`, `bank_statement_lines` | Imported or keyed statements and their lines. |
| `bank_rec_matches`, `bank_rec_match_items` | Matches and the bank and book lines in each. |
| `bank_reconciliations`, `bank_reconciliation_history` | Monthly reconciliation statements and their status history. |
| `bank_account_links`, `bank_book_lines` (views) | Bank accounts with their GL account; posted lines on bank cash accounts. |
| `insurer_statement_formats`, `insurer_statements`, `insurer_statement_lines`, `insurer_statement_resolutions` | Insurer statement layouts, imported statements, lines with match results and resolutions. |

| From | To | Meaning |
|---|---|---|
| `bank_statement_lines.statement_id` | `bank_statements` | Line of a statement. |
| `bank_rec_match_items.match_id`, `bank_line_id`, `journal_line_id` | `bank_rec_matches`, `bank_statement_lines`, `journal_lines` | Bank side and book side of a match. |
| `bank_reconciliation_history.rec_id` | `bank_reconciliations` | Status change of a reconciliation. |
| `insurer_statement_lines.statement_id`, `policy_id` | `insurer_statements`, `policies` | Line of an insurer statement and the policy it concerns. |
| `insurer_statement_resolutions.line_id`, `journal_id` | `insurer_statement_lines`, `journal_vouchers` | Resolution of a line and the adjustment journal. |

## Credit control

Credit control applies to broker-billed business. Collection items follow up open bills with assignments, commitments and escalation; every call, e-mail or visit is a collection action. A premium bill can be split into instalments without changing the bill in the ledger. The premium warranty monitor lists policies whose premium is unpaid near or past the warranty deadline; Accounting sends reminders, requests a deadline extension (approved by a second user holding approve:credit-control) or requests the cancellation of a breached policy, which creates a draft cancellation endorsement for Operations. A client credit limit is checked when a new policy is issued and every policy issued beyond it is logged for Accounting to acknowledge.

| Table | Holds |
|---|---|
| `collection_items`, `collection_actions` | Follow-up of open bills and the actions taken. |
| `premium_instalment_plans`, `premium_instalments` | Instalment plans of a bill and their due dates and amounts. |
| `premium_warranty_extensions`, `premium_warranty_actions` | Warranty deadline extension requests and monitor actions. |
| `client_credit_exceptions` | Policies issued beyond a client's credit limit (`clients.credit_limit`). |

| From | To | Meaning |
|---|---|---|
| `collection_items.receivable_id` | `receivables` | Bill followed up (one item per bill). |
| `collection_actions.collection_id` | `collection_items` | Actions on an item (deleted with it). |
| `premium_instalment_plans.receivable_id`, `policy_id` | `receivables`, `policies` | Bill split into instalments. |
| `premium_instalments.plan_id` | `premium_instalment_plans` | Instalments of a plan. |
| `premium_warranty_actions.extension_id` | `premium_warranty_extensions` | Action taken on an extension request. |
| `client_credit_exceptions.client_id`, `policy_id` | `clients`, `policies` | Client over limit and the policy that took it there. |

## Reinsurance

Reinsurers and treaties (type, capacity, share, retention) are set up in the reinsurance module. A cession passes part of a policy's sum insured and premium to a treaty or, facultatively, to one reinsurer. Recoveries claim the reinsured part of a loss. Bordereaux report cessions or claims to reinsurers, and reconciliations compare the broker's figures with the reinsurer's statement, with exceptions to resolve.

| Table | Holds |
|---|---|
| `reinsurers`, `reinsurance_treaties` | Reinsurers and treaties. |
| `cessions` | Treaty and facultative cessions per policy. |
| `reinsurance_recoveries` | Claim recoveries from reinsurers. |
| `reinsurance_bordereaux`, `reinsurance_reconciliations`, `reinsurance_exceptions` | Bordereaux, statement reconciliations and their exceptions. |
| `fac_placements`, `fac_placement_shares`, `fac_settlements` | Facultative slips placed by the broker as reinsurance broker, the reinsurers' lines and the premium settlements. |

| From | To | Meaning |
|---|---|---|
| `cessions.policy_id`, `treaty_id`, `facultative_reinsurer_id` | `policies`, `reinsurance_treaties`, `reinsurers` | Policy ceded and where. |
| `reinsurance_recoveries.claim_id`, `cession_id`, `treaty_id` | `claims`, `cessions`, `reinsurance_treaties` | Claim recovered under a cession. |
| `reinsurance_exceptions.reconciliation_id` | `reinsurance_reconciliations` | Exception found in a reconciliation. |
| `fac_placements.cedant_id`, `policy_id` | `insurance_companies`, `policies` | Cedant offering the risk and the original policy. |
| `fac_placement_shares.placement_id`, `reinsurer_id` | `fac_placements`, `reinsurers` | Line of a reinsurer on a slip. |
| `fac_settlements.placement_id`, `share_id`, `journal_id` | `fac_placements`, `fac_placement_shares`, `journal_vouchers` | Premium received or paid and its journal. |

## Incentives

Incentive programmes define the measure (premium, policies, conversion), targets, tiers and eligibility. A calculation batch computes the results of a period for every participant and goes through maker-checker approval before payment.

| Table | Holds |
|---|---|
| `incentive_programs` | Programmes: measure, target, stretch target, structure, eligibility, frequency. |
| `incentive_calculations` | Calculation batches with approval, journals and payment. |
| `incentive_results` | Result and payout per programme, participant and period. |

| From | To | Meaning |
|---|---|---|
| `incentive_results.program_id`, `calculation_id`, `agent_user_id` | `incentive_programs`, `incentive_calculations`, `users` | Result of a participant in a programme and batch. |

## Security and audit

Users sign in with a username and password (bcrypt hash only) and, where required by role, a second factor (TOTP secret stored encrypted). Roles carry permissions (`read:<module>`, `write:<module>`, `approve:<area>`) and may inherit another role. Refresh tokens are rotated and revoked by family. The access control tables add the authority matrix (approval limits per role or user and transaction type, effective once a second administrator approves), segregation-of-duties rules, out-of-office delegations and periodic access reviews. `audit_log` and `login_history` are the audit trail; `audit_log.source` (migration 0247) tells whether a change came from a screen, a job, an import or a script. Eight roles are seeded, including the Compliance Officer (AML/CFT) of migration 0263; package B adds the permission `view:pii` (full personal identifiers).

| Table | Holds |
|---|---|
| `users`, `roles`, `permissions`, `user_roles`, `role_permissions` | Users, roles, permissions and their assignments. |
| `refresh_tokens`, `password_resets`, `password_history`, `login_history` | Sessions, reset codes (hash only), previous password hashes, sign-in attempts. |
| `authority_transaction_types`, `authority_limits` | Authority matrix. |
| `sod_rules`, `user_delegations` | Segregation-of-duties rules and delegations. |
| `access_reviews`, `access_review_items` | Access reviews and the decision per user. |
| `audit_log` | Audit trail of every change. |

| From | To | Meaning |
|---|---|---|
| `user_roles.user_id`, `role_id` | `users`, `roles` | Role assigned to a user. |
| `role_permissions.role_id`, `permission_id` | `roles`, `permissions` | Permission granted to a role. |
| `authority_limits.role_code`, `user_id`, `transaction_type` | `roles`, `users`, `authority_transaction_types` | Limit of a role or user for a transaction type. |
| `sod_rules.role_a`, `role_b` | `roles` | Conflicting pair of roles. |
| `access_review_items.review_id`, `user_id` | `access_reviews`, `users` | User reviewed in a campaign. |

## Configuration and schedules

Business parameters are keys of `app_settings` (659 keys in 64 groups), edited in Master > Configuration and System Settings; the workbook lists every key with its group, label and seeded value. Masters without a table of their own are records of `master_records` described by `master_types` (fields, unique keys, screen). Document number series and their counters are in `document_numbering` and `sequences`. Scheduled jobs and their run history, the background queue, notifications, the e-mail outbox, stored files and the report catalogue complete the platform tables.

| Table | Holds |
|---|---|
| `app_settings` | Configuration keys with JSON value, group, label and type. |
| `master_types`, `master_records` | Master screen registry and generic master records. |
| `currencies` | Currencies with the base flag (exactly one base currency, locked once a journal exists) and decimals. Exchange rates come only from the dated Exchange Rate master; the old `exchange_rate` column is kept for history and not read. |
| `document_numbering`, `sequences` | Number series and their counters per period. |
| `scheduled_jobs`, `job_runs`, `job_queue` | Cron jobs, run history and the background queue. |
| `notifications`, `email_outbox`, `documents` | In-app notifications, queued e-mails, registry of stored files. |
| `report_definitions`, `report_schedules`, `generated_reports` | Report catalogue, e-mailed schedules and generated files. |
| `schema_migrations` | Applied migration files. |
| `data_load_batches`, `data_load_rows`, `data_load_comparisons` | Go-Live Data Workbench: uploaded configuration and migration workbooks, their rows with validation results, and the environment comparison reports. |
| `work_tasks` | Tasks and follow-ups of Operations > My Work (due date, priority, reminder, related record). |
| `e_signatures`, `document_signature_slots` | Signature images with consent and capture details, and which signature prints in which slot of which document. |
| `report_builder_reports`, `bi_extract_runs` | Reports designed in Reports > Report Builder and the runs of the BI extract. |

| From | To | Meaning |
|---|---|---|
| `master_records.type_code` | `master_types` | Record of a master type. |
| `job_runs.job_id` | `scheduled_jobs` | Run of a job. |
| `report_schedules.report_code`, `job_id` | `report_definitions`, `scheduled_jobs` | Report sent by a schedule and the job that runs it. |
| `data_load_rows.batch_id` | `data_load_batches` | Row of an uploaded workbook. |
| `document_signature_slots.signatory_id` | `signatories` | Named signatory of a slot. |

## Distribution and marketing

New prospects are routed by lead assignment rules (branch, line of business, source, channel, territory) and every assignment is kept. Distribution channels hold dealer groups and branches, financing banks and affinity partners in one hierarchy; a channel can pay premiums through a client billing account. Brand-new vehicle dealer programmes set the insurer, rate and CTPL terms for the cars a dealer sells; dealer sales are uploaded in batches and become quotations or policies. Comparison reports present the insurer options to a client. Campaigns e-mail consenting clients and prospects in a segment; recipients are recorded with consent, result and opt-out. Package G adds the sales activity log.

| Table | Holds |
|---|---|
| `lead_assignment_rules`, `lead_assignment_history` | Assignment rules and every assignment or reassignment of a prospect. |
| `distribution_channels`, `channel_billing_accounts` | Channel hierarchy and the client account a channel is billed through. |
| `motor_programmes`, `dealer_sales_batches`, `dealer_sales` | Dealer programmes, uploaded sales batches and each vehicle sold. |
| `comparison_reports` | Client comparison and recommendation reports. |
| `campaigns`, `campaign_segments`, `campaign_templates`, `campaign_recipients` | Campaigns, their audience, e-mail template and recipients. |
| `sales_activities` | Calls, meetings, e-mails and visits on a prospect, quotation or client (package G). |

| From | To | Meaning |
|---|---|---|
| `lead_assignment_history.lead_id`, `rule_id` | `leads`, `lead_assignment_rules` | Prospect assigned and the rule that matched. |
| `distribution_channels.parent_id`, `bank_id`, `referrer_id` | `distribution_channels`, `banks`, `commission_referrers` | Parent channel, bank of a financing bank channel, referrer paid for the channel. |
| `motor_programmes.dealer_channel_id`, `bank_channel_id`, `insurance_company_id` | `distribution_channels`, `insurance_companies` | Dealer, financing bank and insurer of a programme. |
| `dealer_sales.batch_id`, `programme_id`, `quote_id`, `policy_id` | `dealer_sales_batches`, `motor_programmes`, `quotes`, `policies` | Sale in a batch and the business created from it. |
| `comparison_reports.broker_slip_id`, `client_id`, `lead_id` | `broker_slips`, `clients`, `leads` | Request for quotation compared and the party it is for. |
| `campaigns.segment_id`, `template_id`; `campaign_recipients.campaign_id` | `campaign_segments`, `campaign_templates`, `campaigns` | Audience and template of a campaign; its recipients. |
| `sales_activities.task_id` | `work_tasks` | Follow-up task created in My Work for the next step. |

## Fleet, marine and motor claims

A fleet schedule puts many vehicles of a client under one motor policy; vehicles are added and removed by endorsement. A marine open cover is the contract of a client with an insurer for its shipments; certificates are issued per shipment and declared monthly, and each declaration is billed. Motor claim repairs record the repair shop's estimates and their approval, the letter of authority to the shop and the release of the repaired vehicle.

| Table | Holds |
|---|---|
| `fleet_schedules`, `fleet_vehicles` | Fleets and their vehicles with premium, additions and deletions. |
| `open_covers`, `open_cover_certificates`, `open_cover_declarations` | Open cover contracts, certificates per shipment and monthly declarations. |
| `claim_repair_estimates`, `claim_loas`, `claim_vehicle_releases` | Repair estimates, letters of authority and vehicle releases of a motor claim. |

| From | To | Meaning |
|---|---|---|
| `fleet_schedules.client_id`, `policy_id`, `channel_id` | `clients`, `policies`, `distribution_channels` | Client, policy and channel of a fleet. |
| `fleet_vehicles.fleet_id`, `added_endorsement_id`, `deleted_endorsement_id` | `fleet_schedules`, `endorsements` | Vehicle of a fleet and the endorsements that added or removed it. |
| `open_cover_certificates.open_cover_id`, `declaration_id` | `open_covers`, `open_cover_declarations` | Certificate under a cover and the declaration that reported it. |
| `open_cover_declarations.receivable_id` | `receivables` | Premium bill of a declaration. |
| `claim_repair_estimates.claim_id`, `claim_loas.claim_id`, `claim_vehicle_releases.loa_id` | `claims`, `claim_loas` | Repair records of a claim. |

## Payables and fixed assets

The accounts payable sub-ledger holds supplier invoices with input VAT and expanded withholding tax, approved by maker-checker and posted through rule `ap.invoice`, and supplier payments allocated to the invoices they settle (`ap.payment`). The fixed asset register depreciates each asset straight-line and posts the monthly depreciation (`fa.depreciation`); package G adds the disposal by sale or write-off with the gain or loss (`fa.disposal`). Suppliers are generic master records of type supplier.

| Table | Holds |
|---|---|
| `supplier_invoices`, `supplier_invoice_lines` | Supplier invoices and their expense lines. |
| `supplier_payments`, `supplier_payment_allocations` | Payments to suppliers and their allocation to invoices. |
| `fixed_assets`, `fixed_asset_depreciation`, `fixed_asset_disposals` | Asset register, monthly depreciation and disposals. |

| From | To | Meaning |
|---|---|---|
| `supplier_invoices.supplier_id`, `journal_id` | `master_records`, `journal_vouchers` | Supplier and the journal posted on approval. |
| `supplier_payment_allocations.payment_id`, `invoice_id` | `supplier_payments`, `supplier_invoices` | Part of a payment applied to an invoice. |
| `fixed_assets.supplier_invoice_id` | `supplier_invoices` | Invoice the asset was bought on. |
| `fixed_asset_depreciation.asset_id`, `journal_id` | `fixed_assets`, `journal_vouchers` | Depreciation of a month and its journal. |
| `fixed_asset_disposals.asset_id`, `sales_invoice_id`, `journal_id` | `fixed_assets`, `sales_invoices`, `journal_vouchers` | Disposal, its sales invoice and journal. |

## BIR returns and invoicing

The figures of the withholding and percentage tax returns (0619-E, 1601-EQ, 1604-E with its alphalist DAT files, 2551Q) are computed live from the ledger and the BIR Form 2307 certificates; `bir_return_filings` records each filing with its reference, payment and any amended return. Sales invoices under the Ease of Paying Taxes Act are the broker's primary documents for commission, fees and override commission; every invoice and cancellation is queued for the BIR Electronic Invoicing System. The CAS registration pack prints the loose-leaf books with running page numbers.

| Table | Holds |
|---|---|
| `bir_return_filings` | Filing record of each return period and form. |
| `sales_invoices`, `sales_invoice_lines`, `sales_invoice_payments` | Sales invoices, their lines and the payments received. |
| `eis_submissions` | E-invoice submissions to the EIS with status, attempts and reply. |
| `cas_book_prints` | Loose-leaf books printed per period with page ranges. |

| From | To | Meaning |
|---|---|---|
| `bir_return_filings.supersedes` | `bir_return_filings` | Amended return replacing an earlier filing. |
| `sales_invoice_lines.invoice_id`, `sales_invoice_payments.invoice_id` | `sales_invoices` | Lines and payments of an invoice. |
| `eis_submissions.invoice_id` | `sales_invoices` | Submission of an invoice or its cancellation. |

## Compliance

Compliance holds the AML/CFT records of the Compliance menu and, with package B, the Insurance Commission and data privacy registers. The customer risk rating scores each client with `aml_risk_factors`; high-risk clients need an enhanced due diligence review. Parties are screened against the lists loaded in `aml_screening_lists` (or a commercial provider); potential matches are cleared or confirmed. Monitoring rules raise alerts on covered and suspicious transactions; the compliance officer works them in cases and generates the AMLC report files. The licence register blocks payouts to referrers whose licence has lapsed, fit and proper records cover officers and staff, complaints follow the RA 11765 deadlines and the breach register follows the NPC 72-hour notification. Consents and data subject requests (migration 0221) are part of this area.

| Table | Holds |
|---|---|
| `aml_risk_factors`, `aml_risk_assessments`, `aml_edd_reviews` | Risk scoring table, every rating made and enhanced due diligence reviews. |
| `aml_screening_lists`, `aml_list_versions`, `aml_list_entries` | Screening lists, their loaded versions and names. |
| `aml_screenings`, `aml_screening_hits`, `aml_provider_requests` | Screening runs, potential matches and requests to a screening provider. |
| `aml_rules`, `aml_alerts`, `aml_cases` | Monitoring rules, alerts and case files. |
| `aml_reports`, `aml_report_items` | CTR and STR files in the AMLC layout and the transactions in them. |
| `compliance_licences`, `compliance_licence_reminders`, `compliance_fit_proper` | Licence register with expiry reminders; fit and proper records (package B). |
| `ic_statement_lines` | Mapping of GL accounts to the lines of the IC annual statement (package B). |
| `complaints`, `complaint_reminders` | Complaints register and its deadline reminders (package B). |
| `personal_data_breaches`, `personal_data_breach_reminders` | Breach register and its notification reminders (package B). |
| `privacy_consents`, `data_subject_requests` | Consents per purpose and the register of data subject requests. |

| From | To | Meaning |
|---|---|---|
| `aml_risk_assessments.client_id`, `aml_edd_reviews.assessment_id` | `clients`, `aml_risk_assessments` | Rating of a client and the EDD it triggered. |
| `aml_screening_hits.screening_id`, `entry_id`, `case_id` | `aml_screenings`, `aml_list_entries`, `aml_cases` | Match found by a screening and the case it was escalated to. |
| `aml_alerts.rule_code`, `client_id`, `case_id` | `aml_rules`, `clients`, `aml_cases` | Alert of a rule on a client's transaction and its case. |
| `aml_report_items.report_id`, `alert_id` | `aml_reports`, `aml_alerts` | Transaction reported in a file. |
| `compliance_licences.referrer_id`, `superseded_by` | `commission_referrers`, `compliance_licences` | Licence of a referrer and the licence that renewed it. |
| `complaints.client_id`, `policy_id`, `claim_id`, `insurance_company_id` | `clients`, `policies`, `claims`, `insurance_companies` | Subject of a complaint. |

## Integrations

Every connection to a third party goes through one framework: a connector (adapter, test or live mode, endpoint, names of the environment variables that hold the credentials), an outbox with retries and an attempt log, and an inbox for messages received. SMS and Viber texts come from message templates. CTPL covers are authenticated with a COC number from the insurer's series. Insurer API mappings say how a policy issuance request and the answers are mapped per insurer. Bank payment files pay a batch of vouchers in one bank upload with the layout of the bank.

| Table | Holds |
|---|---|
| `integration_connectors`, `integration_outbox`, `integration_attempts`, `integration_inbox` | Connectors, messages to send, attempts and messages received. |
| `message_templates` | SMS and Viber templates per event. |
| `coc_series`, `ctpl_authentications` | COC number series and the authentication of each CTPL cover. |
| `insurer_api_mappings` | API mapping per insurer. |
| `bank_file_layouts`, `payee_bank_accounts`, `bank_payment_batches`, `bank_payment_batch_lines` | Bank file layouts, payee accounts, payment batches and their lines. |

| From | To | Meaning |
|---|---|---|
| `integration_outbox.connector_code`, `integration_attempts.outbox_id` | `integration_connectors`, `integration_outbox` | Message of a connector and its attempts. |
| `ctpl_authentications.coc_series_id`, `policy_id`, `outbox_id` | `coc_series`, `policies`, `integration_outbox` | COC allocated to a policy and the request sent. |
| `insurer_api_mappings.insurance_company_id`, `connector_code` | `insurance_companies`, `integration_connectors` | Insurer and the connector of its API. |
| `bank_payment_batches.layout_code`, `outbox_id` | `bank_file_layouts`, `integration_outbox` | Layout of the file and the message that delivered it. |
| `bank_payment_batch_lines.batch_id`, `disbursement_id`, `journal_id` | `bank_payment_batches`, `disbursements`, `journal_vouchers` | Voucher paid in a batch and its journal. |

# Status lifecycles

The tables below give the main status flows. The values are the codes stored in the database; screen labels are given where they differ. The complete vocabularies, including the allowed values enforced by CHECK constraints, are in the workbook, sheet Reference values.

## Sales, placement and policy

| Record | Status flow | Notes |
|---|---|---|
| Lead (`leads.status`) | New → Contacted → Qualified → QuoteGenerated → Converted; or Lost | QuoteGenerated is set when the first quotation is created; Converted when the lead becomes a client. |
| Quotation (`quotes.status`) | draft (Draft) → sent (PendingCustomer) → accepted (CustomerAccepted) → submitted (SubmittedToInsurer) → approved → converted (ConvertedToPolicy); or rejected, dropped, expired | Sending e-mails the approval link. A recorded customer response sets accepted, rejected or back to draft (`quotations.customer_response_status`). Conversion is allowed from the statuses in `quotations.convertible_statuses` (CustomerAccepted, Approved). The quotation expiry job sets expired. |
| Broker slip (`broker_slips.status`) | draft → submitted → responses-in → closed; or cancelled | |
| Insurer offer (`insurer_offers.status`) | pending → offered or declined | The chosen offers carry `selected`. |
| Placement slip (`placements.status`) | draft → sent → bound → issued; or declined, cancelled | Bound when every participant has confirmed (`risk_participants.confirmed_at`). |
| Policy (`policies.status`) | active → expired, renewed or cancelled | The policy expiry job sets expired; issuing the renewal sets renewed; a cancellation endorsement sets cancelled. `payment_status` follows the premium: Pending, Reviewing, Partial, Completed, Refunded. |
| Endorsement (`endorsements.status`) | draft → submitted (PendingCustomer) → approved → completed; or cancel-initiated, rejected, cancelled | |
| Payment capture (`policy_payments.status`) | submitted → confirmed or rejected | Confirmation by Accounting issues the official receipt. |
| Payment link (`payment_links.status`) | pending → paid, failed, expired, cancelled or review | `apply_status`: not_applied → applied, awaiting_issue or error. |

## Money and accounting

| Record | Status flow | Notes |
|---|---|---|
| Premium bill (`receivables.status`) | open → partial → paid; or credited, written-off, cancelled | |
| Official receipt (`receipts.status`) | posted → cancelled | Receipt applications: applied → reversed. |
| Payment voucher (`disbursements.status`) | draft → for-approval → approved → paid; or rejected | Cheque (`checkbooks.status`): Pending → Approved → Printed; or Cancelled. Invoice list: open → in-voucher → paid; or cancelled. |
| Remittance (`remittances.status`) | draft → for-approval → approved → settled; or rejected | |
| Direct-bill item (`direct_bill_items.status`) | unbilled → billed → collected; or cancelled | |
| Commission debit note (`commission_debit_notes.status`) | draft → for-approval → open → partial → collected; or rejected, cancelled | |
| Commission line (`commissions.status`) | Accrued → Eligible → Approved → Paid | Eligible once the premium is collected. A reversal after payment sets the clawback flag. |
| Journal voucher (`journal_vouchers.status`) | draft → for-approval → approved → posted; or rejected; posted → reversed | The trigger refuses an unbalanced journal or one in a period that does not accept postings. |
| Accounting period (`accounting_periods.status`) | open → soft_closed → closed → locked | Locked only by the year-end close; a locked period cannot be reopened. |
| Month-end close run (`period_close_runs.status`) | draft → in-progress → blocked or ready → pending-approval → soft-closed or closed; or cancelled | A blocking automatic check that fails gives blocked. |
| Year-end close run (`year_end_runs.status`) | draft → checked → closed → reversed; or cancelled | |
| Bank reconciliation (`bank_reconciliations.status`) | draft → prepared → approved; or cancelled | An approved reconciliation can be reopened with remarks. |
| Insurer statement (`insurer_statements.status`) | draft → submitted → approved; or cancelled | Adjustment journals post on approval. |
| Posting rule version (`posting_rules.approval_status`) | pending → approved or rejected | Configuration changes: pending → approved, rejected or withdrawn. |

## Claims, renewals and other areas

| Record | Status flow | Notes |
|---|---|---|
| Claim (`claims.status`) | registered → in-review → pending-approval → approved → settled → closed; or rejected | Every change is written to `claim_history`. |
| Renewal case (`renewals.status`) | pipeline → notice-1 → notice-2 → final-notice → quoted → pending-approval → renewed; or lapsed | `renewal_type` records whether the renewal was regular, in the grace period or after lapse. |
| Instalment plan / warranty extension | plan: active or cancelled; extension: pending → approved or rejected | |
| Cession (`cessions.status`) | Pending → Confirmed; or Rejected, Cancelled | Recovery: Pending → Processing → Recovered; or Disputed, Rejected. |
| Incentive calculation (`incentive_calculations.status`) | Calculated → Pending Approval → Approved → Paid; or Rejected | |
| Authority limit (`authority_limits.status`) | pending → active → retired; or rejected | A changed limit is a new pending row that retires the old one on approval. |
| Access review | review: open → closed; item: pending → keep or revoke | |
| User (`users.status`) | active, inactive, locked | The dormant accounts job deactivates users who have not signed in for `access.dormant_days`. |
| Cover note (`cover_notes.status`) | active → superseded (policy issued) or expired; or cancelled | The cover note expiry job sets expired. |
| Post-dated cheque (`post_dated_cheques.status`) | on-hand → deposited → cleared; or bounced, replaced, returned, cancelled | Depositing creates the official receipt; nothing is posted while on hand. |
| Supplier invoice (`supplier_invoices.status`) | draft → for-approval → approved → partially-paid → paid; or rejected, cancelled | Posted on approval (`ap.invoice`). |
| Fixed asset (`fixed_assets.status`) | active → fully-depreciated or disposed | |
| Sales invoice (`sales_invoices.status`) | issued → cancelled | EIS submission: queued → sending → accepted; or rejected, failed, manual. |
| Override computation (`override_computations.status`) | draft → submitted → approved → partially_settled → settled; or rejected, cancelled | |
| Facultative slip (`fac_placements.status`) | draft → in-market → placed → bound → closed; or cancelled | |
| Fleet schedule / open cover | fleet: draft → issued; or cancelled. Open cover: draft → active → expired; or cancelled | |
| Bank payment batch (`bank_payment_batches.status`) | draft → for-approval → approved → file-generated → sent → completed; or cancelled | |
| Integration message (`integration_outbox.status`) | queued → processing → sent; or retry, failed, cancelled, skipped | |
| CTPL authentication (`ctpl_authentications.status`) | pending → requested → authenticated; or failed, cancelled | |
| AML case (`aml_cases.status`) | open → for-filing → filed → closed | Alert: open → escalated → reported or closed. Screening hit: open → cleared, escalated or confirmed. |
| Complaint (`complaints.status`) | received → acknowledged → in-progress → resolved → closed; or escalated | Package B. |
| Personal data breach (`personal_data_breaches.status`) | open → assessed → notified → closed | Package B. |
| Go-live workbook (`data_load_batches.status`) | validated or failed → loaded | |
| My Work task (`work_tasks.status`) | open → done or cancelled | |

# Personal data and retention

## Personal data under the Data Privacy Act

BrokerVerse processes personal information of clients, prospects, claimants, drivers and third parties, beneficial owners and signatories of juridical clients, complainants, referrers, payees and staff users. The workbook classifies every column in the column **Personal data (RA 10173)** using four classes:

| Class | Meaning | Columns |
|---|---|---|
| Personal information | Information from which the identity of an individual is apparent or can be reasonably ascertained (Section 3(g) of RA 10173): names, addresses, e-mail, phone, IP address, plate number. | 164 |
| Sensitive personal information | Section 3(l) of RA 10173: age (date of birth), government-issued identifiers such as the TIN, and health or offence-related details that claims may contain. | 20 |
| Credential / security secret | Password hashes, second-factor secrets, reset codes, tokens. Not personal information in themselves but must be protected as security data. | 11 |
| May contain personal information | Free text, JSON documents and stored files that hold personal information depending on what users enter or upload. | 172 |

The classification is an assessment made from the column names, their use in the code and the personal data catalogue of the client data masking tool (`backend/scripts/lib/pii-catalogue.js`), which every new migration must complete (its test fails otherwise). The broker's Data Protection Officer should confirm it and record it in the register of processing activities.

## Tables and columns holding personal data

In the table, Personal, Sensitive, Credential and May contain refer to the four classes above.

| Table | Columns holding personal data |
|---|---|
| `client_beneficial_owners` | Personal: full_name, address<br>Sensitive: birth_date, id_number<br>May contain: pep_details |
| `client_kyc_documents` | May contain: description, storage_key, file_name |
| `client_signatories` | Personal: full_name<br>Sensitive: birth_date, id_number |
| `clients` | Personal: first_name, last_name, company_name, display_name, email, phone, gender, address, city, state, country, postal_code, preferred_name, house_no, barangay, road, soi, moo, middle_name, place_of_birth, employer_name, trade_name<br>Sensitive: tin, birth_date, id_number, registration_number<br>May contain: extra, suffix, occupation, source_of_funds, pep_details |
| `insurance_companies` | Personal: contact_person, contact_email, contact_phone |
| `signatories` | Personal: name, designation, signature_key |
| `agent_events` | May contain: description |
| `leads` | Personal: first_name, last_name, company_name, display_name, email, phone, gender, address, city, state, country, postal_code, preferred_name, house_no, barangay, road, soi, moo<br>Sensitive: birth_date, tax_number<br>May contain: notes, extra |
| `package_quotes` | Personal: insured_name, location<br>May contain: remarks, doc |
| `payment_events` | May contain: payload |
| `payment_links` | Personal: payer_name, payer_email, payer_mobile<br>Credential: token, checkout_url<br>May contain: outcome |
| `quote_customer_responses` | May contain: remarks, attachment_key, attachment_name |
| `quotes` | Personal: vehicle, approval_sent_to<br>Credential: approval_token_hash, approval_token<br>May contain: coverage, remarks, doc |
| `broker_slips` | Personal: insured_name<br>May contain: risk_details, doc, remarks |
| `insurer_offers` | May contain: attachment_key, attachment_name, remarks |
| `placements` | Personal: insured_name<br>May contain: doc, remarks |
| `risk_participants` | May contain: remarks |
| `cover_notes` | Personal: insured_name<br>May contain: risk_description, conditions |
| `endorsements` | May contain: changes, remarks, document_key, completion |
| `package_endorsements` | May contain: remarks |
| `policies` | Personal: insured_name<br>May contain: details, doc |
| `policy_payments` | May contain: proof_key, proof_file_name, remarks |
| `checkbooks` | Personal: customer_name |
| `disbursements` | Personal: payee_name, referrer_name<br>May contain: transaction_description, remarks |
| `petty_cash_disbursements` | May contain: remarks |
| `petty_cash_receipts` | Personal: requester_name<br>May contain: remarks |
| `petty_cash_replenishments` | May contain: remarks |
| `petty_cash_requests` | Personal: requester_name |
| `post_dated_cheques` | May contain: remarks |
| `receipts` | Personal: customer_name<br>May contain: remarks |
| `commission_debit_note_collections` | May contain: remarks |
| `commission_debit_note_lines` | Personal: insured_name |
| `commission_debit_notes` | May contain: remarks |
| `direct_bill_client_payments` | May contain: proof_key, proof_file_name, remarks |
| `remittance_approvals` | May contain: remarks, history |
| `remittance_items` | May contain: data, remarks |
| `remittance_lines` | Personal: insured_name |
| `remittances` | Personal: agency_name<br>May contain: remarks, data |
| `commission_referrers` | Personal: name, email, phone, bank_name, bank_account_no<br>Sensitive: tin |
| `override_agreements` | May contain: remarks |
| `override_computations` | May contain: claims_note, remarks |
| `override_settlements` | May contain: remarks |
| `claim_document_reminders` | Personal: recipient_email |
| `claim_field_changes` | May contain: old_value, new_value |
| `claim_history` | May contain: note |
| `claim_settlement_movements` | Personal: bank_account, payee<br>May contain: remarks |
| `claims` | Personal: loss_address, loss_city, loss_province<br>Sensitive: driver, third_party<br>May contain: description, details, policy_info, adjuster, settlement |
| `renewal_activities` | May contain: description, details |
| `renewal_notices` | Personal: recipient |
| `renewals` | May contain: remarks, coverage_details, accessories, approval_note |
| `bir_2307_certificates` | Personal: payee_name, payee_address, payor_name, payor_address<br>Sensitive: payee_tin, payor_tin<br>May contain: lines |
| `journal_lines` | May contain: memo |
| `journal_vouchers` | May contain: description |
| `bank_rec_matches` | May contain: remarks |
| `bank_reconciliation_history` | May contain: remarks |
| `bank_reconciliations` | May contain: reopen_remarks, remarks |
| `bank_statement_lines` | May contain: description, flag_remarks |
| `bank_statements` | May contain: remarks |
| `insurer_statement_lines` | Personal: insured_name |
| `insurer_statement_resolutions` | May contain: note |
| `insurer_statements` | May contain: remarks, approval_remarks |
| `client_credit_exceptions` | May contain: remarks |
| `collection_actions` | May contain: notes |
| `collection_items` | May contain: commitment_reason |
| `premium_instalment_plans` | May contain: remarks |
| `premium_instalments` | May contain: remarks |
| `premium_warranty_actions` | May contain: notes |
| `premium_warranty_extensions` | May contain: decision_remarks |
| `cessions` | Personal: insured<br>May contain: notes |
| `fac_placement_shares` | May contain: notes |
| `fac_placements` | Personal: insured_name |
| `reinsurance_recoveries` | Personal: insured<br>May contain: cash_call, documents, notes |
| `reinsurers` | May contain: contact |
| `access_review_items` | Personal: last_login_at<br>May contain: remarks |
| `audit_log` | Personal: username, ip<br>May contain: before_data, after_data |
| `login_history` | Personal: username, ip, user_agent |
| `password_history` | Credential: password_hash |
| `password_resets` | Credential: code, code_hash |
| `refresh_tokens` | Personal: device_id<br>Credential: jti |
| `users` | Personal: username, display_name, first_name, last_name, email, phone, employee_code, department, designation, reporting_to, last_login_at, address_line, barangay, city, province, zip_code<br>Sensitive: date_of_birth<br>Credential: password_hash, totp_secret, totp_pending_secret |
| `data_load_rows` | May contain: data, errors |
| `documents` | May contain: storage_key, file_name |
| `e_signatures` | Personal: consent_ip |
| `email_outbox` | Personal: to_address, cc<br>May contain: body_html, attachments |
| `generated_reports` | May contain: params |
| `job_queue` | May contain: payload, result |
| `job_runs` | May contain: output |
| `master_records` | Personal: name<br>May contain: data |
| `notifications` | May contain: title, message |
| `report_schedules` | Personal: recipients |
| `work_tasks` | May contain: title, notes, completion_note |
| `campaign_recipients` | Personal: party_name, email |
| `campaigns` | May contain: notes |
| `comparison_reports` | Personal: prepared_for, sent_to |
| `dealer_sales` | Personal: buyer_first_name, buyer_last_name, buyer_company_name, buyer_email, buyer_phone, buyer_address, conduction_sticker, plate_number, chassis_number, engine_number |
| `dealer_sales_batches` | May contain: file_name |
| `distribution_channels` | Personal: address, contact_person, contact_email, contact_phone<br>Sensitive: tin<br>May contain: notes |
| `motor_programmes` | May contain: notes |
| `claim_loas` | May contain: remarks |
| `claim_repair_estimates` | Personal: adjuster_name<br>May contain: decision_remarks |
| `claim_vehicle_releases` | Personal: released_to<br>May contain: remarks |
| `fleet_vehicles` | Personal: plate_number, conduction_sticker, chassis_number, engine_number |
| `open_cover_certificates` | Personal: consignee |
| `open_cover_declarations` | May contain: notes |
| `fixed_assets` | Personal: custodian<br>May contain: disposal_remarks |
| `supplier_payments` | May contain: remarks |
| `bir_return_filings` | May contain: figures, remarks |
| `eis_submissions` | May contain: payload, response |
| `sales_invoice_lines` | May contain: description |
| `sales_invoices` | Personal: buyer_name, buyer_address, buyer_business_style<br>Sensitive: buyer_tin<br>May contain: remarks |
| `aml_cases` | May contain: narrative |
| `aml_edd_reviews` | May contain: source_of_wealth, source_of_funds, purpose, findings, decision_notes |
| `aml_provider_requests` | May contain: request, response |
| `aml_reports` | May contain: amlc_notes |
| `complaints` | Personal: complainant_name, complainant_contact<br>May contain: description, resolution, escalation_reason |
| `compliance_fit_proper` | Personal: person_name<br>May contain: declarations, review_notes, remarks |
| `compliance_licences` | Personal: holder_name<br>Sensitive: licence_number<br>May contain: remarks |
| `data_subject_requests` | Personal: requester_name, requester_contact<br>May contain: description, outcome, response_notes, actions |
| `personal_data_breaches` | Personal: reported_by<br>May contain: description, assessment_notes, closure_notes |
| `privacy_consents` | May contain: evidence, withdrawal_reason |
| `bank_payment_batch_lines` | Personal: payee_name, account_number, account_name, email |
| `bank_payment_batches` | May contain: file_content, remarks |
| `ctpl_authentications` | Personal: plate_number, chassis_number, engine_number<br>Sensitive: mv_file_number |
| `integration_inbox` | May contain: payload, result |
| `integration_outbox` | May contain: payload, response |
| `payee_bank_accounts` | Personal: payee_name, account_number, account_name, email |

## Protection in the database

- Passwords are stored only as bcrypt hashes; reset codes only as keyed hashes; the second-factor secret is encrypted with AES-256-GCM using the key in `DATA_ENCRYPTION_KEY`. Payment gateway credentials are not stored in the database but read from the environment.
- Access to the data in the application follows the role permissions; the authority matrix, segregation-of-duties rules and access reviews control who may approve and who holds which roles.
- Every change to a record is in `audit_log` with the user, time, IP address and the values before and after. Because the audit trail copies record values, it holds personal information too.
- With package B (migration 0277), TINs, government ID numbers and bank account numbers are encrypted in the database with the key in `PII_ENCRYPTION_KEY` (AES-256-CBC with an HMAC-SHA256 tag): `clients.tin`, `leads.tax_number`, `commission_referrers.tin` and `bank_account_no`, `bir_2307_certificates.payee_tin`, and the identifier keys inside the JSON documents of clients, leads, quotations, placements, policies and the audit trail. Blind indexes (`*_bidx`, keyed HMAC) keep search by exact value. The keys reach the database as session settings of the API connections; a session without them cannot write a new identifier.
- With package B (migration 0276), users without the permission `view:pii` receive TIN, ID, mobile, e-mail, bank account and birth date values partially masked in every screen and export (`privacy.masking_enabled`, `privacy.pii_reveal_mode`).
- Other columns are protected by database access control, encryption of the storage and of backups, and the application's permissions. See the Architecture, Infrastructure, Security and Privacy document.

## Retention

The system has two kinds of retention. Operational rows are deleted by the daily housekeeping job after the number of days set in System Settings > Housekeeping (0 means keep forever). Business and financial records are never deleted by the system. The personal data of a client or prospect can be anonymised from a data subject request once `privacy.retention_years` (10 years after the last policy expiry) has passed: names are replaced by an anonymised label and contact details, addresses, ID numbers, birth date and personal notes are cleared in the party and its prospects, policies, quotations, claims and slips, while numbers, amounts and dates stay (`clients.anonymised_at`, `leads.anonymised_at`).

| Table | Rows deleted | Setting | Seeded days |
|---|---|---|---|
| `job_runs` | Job run history | `housekeeping.job_runs_days` | 90 |
| `email_outbox` | Sent e-mails | `housekeeping.email_outbox_sent_days` | 180 |
| `email_outbox` | Failed e-mails | `housekeeping.email_outbox_failed_days` | 730 |
| `login_history` | Sign-in attempts | `housekeeping.login_history_days` | 365 |
| `refresh_tokens` | Expired or revoked sessions | `housekeeping.refresh_tokens_days` | 30 |
| `password_resets` | Used or expired reset codes | `housekeeping.password_resets_days` | 7 |
| `notifications` | Read notifications | `housekeeping.notifications_read_days` | 180 |
| `job_queue` | Completed background jobs | `housekeeping.job_queue_done_days` | 30 |
| `audit_log` | Audit entries | `housekeeping.audit_log_days` | 0 (keep); when set, never less than 2,557 days (7 years) |
| `generated_reports` | Generated report files | `reports.retention_days` (daily reports job) | 90 |

Each table also carries a retention class in the workbook (sheet Tables):

| Class | Tables | Handling |
|---|---|---|
| Financial | 72 | Ledger, bills, receipts, payments, commissions, remittances, reconciliations, tax certificates. Kept for the statutory record-keeping period; cancelled or reversed, never deleted. |
| Transaction | 56 | Leads, quotations, placements, policies, endorsements, claims, renewals, reinsurance. Kept for the life of the policy or claim plus the regulatory period. |
| Reference | 85 | Masters, settings, posting rules, number series, roles. Kept while in use; changes audited. |
| Log / audit | 37 | Audit trail, histories, sign-in history, job runs. Kept for the audit period. |
| Temporary | 10 | Tokens, reset codes, outbox, queue, notifications, generated files. Purged by housekeeping. |

> Recommendation, to be confirmed by the broker's Data Protection Officer and finance: set the retention period of financial and transaction records to the longest period required by the BIR, the Insurance Commission and the broker's own policy, and apply the DPA principle of proportionality to prospects that never became clients (leads with no quotation or policy). Erasure and blocking requests are handled from the data subject request register (Master > Data Privacy > Data Subject Requests): anonymisation is offered once `privacy.retention_years` has passed, and the records that a statutory retention period still requires are kept.

# Appendix A: Table list

This appendix lists every table and view with a one-line description and the number of rows of reference data a new database starts with (transaction tables are empty). The columns of each table are in the workbook, sheet Columns.

## Party and client

| Table | Description | Rows |
|---|---|---|
| `banks` | Banks and mortgagees | 17 |
| `branches` | Broker branches | 1 |
| `cities` | Cities and municipalities (PSGC code, city class, ZIP code, region) | 1,642 |
| `client_beneficial_owners` | Natural persons who own or control a juridical client (beneficial owners) | 0 |
| `client_kyc_documents` | Customer due diligence documents: IDs, registration certificates, board resolutions, EDD evidence | 0 |
| `client_signatories` | Authorised signatories of a juridical client with the board resolution or certificate | 0 |
| `clients` | Clients (insured parties) with KYC fields and owner | 0 |
| `countries` | Countries | 5 |
| `districts` | Barangays (PSGC code) with postal code; master type Barangay | 1,715 |
| `insurance_companies` | Insurers (principals): contact, default commission rate, credit terms, billing mode | 51 |
| `postal_codes` | Postal code lookup (province, city, district) | 1,846 |
| `regions` | Philippine regions (PSGC code), above Province (migration 0250) | 18 |
| `signatories` | Authorised signatories for documents | 0 |
| `states` | Provinces (PSGC code, region); the table keeps its earlier name "states" | 84 |

## Product and rating

| Table | Description | Rows |
|---|---|---|
| `coverages` | BI / PD / PA cover options with amount and premium | 11 |
| `insurer_rate_tables` | Insurer rates per product for the quick quote comparison of packaged products: rate basis, minimum premium, deductible, commission | 0 |
| `lgu_tax_rates` | Local government (LGT) tax rates per province or city with effective dates | 10 |
| `package_bundle_sections` | Sections of a bundle: product, default sum insured, rate, minimum premium and the insurers that may carry it | 0 |
| `package_bundles` | Packaged product bundles (for example a multi-line SME cover): segment, term, discount, online issue | 0 |
| `policy_types` | Policy types per product | 14 |
| `premium_charge_rules` | Premium charge rules (VAT, premium tax, DST, FST, LGT, other): method, rate, unit size, minimum and effective dates | 6 |
| `product_components` | Template components: covers, rating tables, rules, documents (JSONB data) | 50 |
| `product_risk_mappings` | Product / line-of-business risk definitions | 8 |
| `product_risk_sections` | Risk sections of a mapping with default rates | 4 |
| `product_templates` | Versioned product templates (config JSONB, rates, limits, insurers) | 13 |
| `products` | Insurance products / lines | 19 |
| `vehicle_brands` | Vehicle makes | 8 |
| `vehicle_models` | Vehicle models per make | 19 |
| `vehicle_variants` | Vehicle variants (body type, seating) | 20 |

## Sales and quotation

| Table | Description | Rows |
|---|---|---|
| `agent_events` | Calendar events and reminders of a user (open items screen) | 0 |
| `leads` | Leads / prospects (individual or corporate), owner, status | 0 |
| `package_quotes` | Bundle quotations: client, location, premium, discount, taxes, commission and status | 0 |
| `package_sections` | Priced sections of a bundle quotation or package policy, each with its insurer, premium, taxes and commission | 0 |
| `payment_events` | Every notification received from a payment gateway (or simulated), valid or not: the payments log | 0 |
| `payment_gateways` | Online payment gateways (Dragonpay, PayMongo, sandbox): mode, methods, fee handling, link validity; credentials stay in the environment | 3 |
| `payment_links` | Payment links sent to a client to pay a package quotation, quotation or policy premium online, and the result | 0 |
| `quote_customer_responses` | Customer responses to a quotation recorded by staff (phone, Viber, meeting, signed form) as evidence of the status change | 0 |
| `quotes` | Quotations: vehicle / coverage JSONB, premium, taxes, commission, approval token hash | 0 |

## Placement

| Table | Description | Rows |
|---|---|---|
| `broker_slips` | Broker slips (BS-): a client risk sent to several insurers for terms | 0 |
| `insurer_offers` | Insurer offers (OFR-) on a broker slip: premium, rate, taxes, deductibles, validity, share, or a decline | 0 |
| `placements` | Placement slips (PS-): firm order to the chosen insurers, binding per participant, policy issue | 0 |
| `risk_participants` | Co-insurance participants of a broker slip, quotation, placement or policy: lead, share, premium and commission | 0 |

## Policy and endorsement

| Table | Description | Rows |
|---|---|---|
| `cover_notes` | Cover notes (binders) issued while the insurer policy is pending: cover period, status, superseding policy | 0 |
| `endorsements` | Policy endorsements and cancellations, premium delta, billing link | 0 |
| `package_endorsements` | Endorsements of one section of a package policy: change of sum insured and the additional premium billed | 0 |
| `policies` | Issued policies: term, premium, insurer, billing mode, details / doc JSONB | 0 |
| `policy_payments` | Premium payments captured on a policy, awaiting finance confirmation | 0 |

## Billing, receipts and payments

| Table | Description | Rows |
|---|---|---|
| `checkbooks` | Cheques issued (instrument, approval, printing) | 0 |
| `disbursements` | Payment vouchers (PV-) to insurers, agents, clients; approval and payment | 0 |
| `invoice_lists` | Invoice lists (IL-) settled by a disbursement | 0 |
| `petty_cash_disbursements` | Petty cash payments (VAT, WHT, journal) | 0 |
| `petty_cash_funds` | Petty cash funds (size, limits, custodian, available cash) | 0 |
| `petty_cash_receipts` | Receipts into a petty cash fund | 0 |
| `petty_cash_replenishments` | Fund replenishments from bank | 0 |
| `petty_cash_request_lines` | Lines of a petty cash request | 0 |
| `petty_cash_requests` | Petty cash requests and approval | 0 |
| `post_dated_cheques` | Post-dated cheques received against bills, kept until their date, deposited into an official receipt or returned | 0 |
| `receipt_applications` | Application of receipt lines to bills, with journal link | 0 |
| `receipt_lines` | Receipt lines per policy (premium, taxes, EWT, discounts) | 0 |
| `receipts` | Official receipts (OR-) header: payer, amount, mode, status | 0 |
| `receivable_credits` | Return premium and cancellation credits applied to a bill, with the refund part and journal | 0 |
| `receivable_participants` | Per-insurer split of a co-insured bill: share, gross, commission, taxes, due to insurer | 0 |
| `receivables` | Premium bills (INV-) per policy / endorsement / renewal with balance and ageing | 0 |
| `write_off_reasons` | Write-off reasons with GL account and maximum amount | 4 |

## Remittance and insurer accounting

| Table | Description | Rows |
|---|---|---|
| `commission_debit_note_collections` | Insurer payments against a debit note (cash, EWT, Form 2307) | 0 |
| `commission_debit_note_lines` | Policies / items on a debit note | 0 |
| `commission_debit_notes` | Commission debit notes (DN-) to insurers for direct-billed policies | 0 |
| `direct_bill_client_payments` | Client's premium payment made directly to the insurer on a direct-billed policy, with the insurer's receipt reference and proof; no journal is posted | 0 |
| `direct_bill_items` | Commission receivable items booked for direct-billed policies | 0 |
| `insurer_refund_credits` | Refunds due from insurers on returned premium already remitted; netted against the next remittance | 0 |
| `remittance_allocations` | Premium collected on a co-insured policy, split for remittance to each insurer | 0 |
| `remittance_approvals` | Multi-level approval requests with SLA and history | 0 |
| `remittance_delegations` | Approval delegations (period, transaction types, amount limit) | 0 |
| `remittance_items` | Remittance work items (settlements, adjustments, transfers, exceptions) | 0 |
| `remittance_lines` | Policies included in a remittance | 0 |
| `remittances` | Premium remittances / bills to insurers (REM-): gross, commission, net due, approval, settlement | 0 |

## Commission

| Table | Description | Rows |
|---|---|---|
| `commission_adjustments` | Commission reversed or clawed back when premium is returned or a policy cancelled | 0 |
| `commission_rates` | Commission rate matrix: rate per insurer, product, line and policy type with effective dates | 0 |
| `commission_referrers` | Referrers / sub-agents (no sign-in): hierarchy, WHT rate, bank account | 0 |
| `commissions` | Commission lines per policy / endorsement and referrer: accrual, eligibility, approval, payment | 0 |
| `override_agreement_tiers` | Tiers of an override agreement: from and to value of the basis and the rate | 0 |
| `override_agreements` | Overriding, profit and contingent commission agreements with insurers: basis, period, lines | 0 |
| `override_computations` | Override commission computed for a period, accrued through rule override_commission.accrual | 0 |
| `override_settlements` | Settlement of an override computation by the insurer, with its sales invoice and journal | 0 |

## Claims

| Table | Description | Rows |
|---|---|---|
| `claim_document_items` | Documents a claim needs, copied from the checklist master, with received and waived status | 0 |
| `claim_document_reminders` | Missing-document reminders sent to the claimant | 0 |
| `claim_field_changes` | Field-level audit trail of claim edits | 0 |
| `claim_history` | Claim status history | 0 |
| `claim_settlement_movements` | Claim settlement cash: funds received from each insurer and payments to the claimant, with journal | 0 |
| `claims` | Claims: loss details, estimate, approved and settled amounts, handler, lifecycle status | 0 |

## Renewals

| Table | Description | Rows |
|---|---|---|
| `renewal_activities` | Contact and follow-up activities on a renewal | 0 |
| `renewal_batch_policies` | Policies in a renewal batch and their notice status | 0 |
| `renewal_batches` | Batch renewal notice runs | 0 |
| `renewal_notices` | Renewal notices sent (stage, method, recipient, status) | 0 |
| `renewal_quotes` | Renewal quotations (loading, discount, variance) | 0 |
| `renewals` | Renewal cases of expiring policies (status, notices, contact, premium old / new) | 0 |
| `winback_campaigns` | Win-back campaigns for lapsed business | 0 |

## General ledger and period end

| Table | Description | Rows |
|---|---|---|
| `accounting_config_changes` | Pending, approved or rejected changes to posting rules and account determination (maker-checker); a change takes effect only on approval by a different user | 0 |
| `accounting_periods` | Periods 1 to 12 and adjustment period 13 per fiscal year: dates and status (open, soft_closed, closed, locked) | 0 |
| `bir_2307_certificates` | BIR Form 2307 certificates issued and received, per payee and quarter | 0 |
| `entry_matches` | Open-item matching of debit and credit journal lines | 0 |
| `fiscal_years` | Fiscal years (FY2026): dates and status | 0 |
| `gl_accounts` | Chart of accounts (type, statement group, normal balance, open-item flag) | 133 |
| `journal_lines` | Journal lines: account, debit / credit, branch, department, client / policy tags | 0 |
| `journal_vouchers` | Journal vouchers (JV-): source, status, maker-checker, reversal / correction links | 0 |
| `opening_balances` | Opening balances per fiscal year and account: carried forward by the year-end close or loaded at go-live | 0 |
| `period_close_checklist` | Month-end checklist items (automatic or manual, severity) | 12 |
| `period_close_entries` | Journals created by a close run and their automatic reversal | 0 |
| `period_close_run_checks` | Checklist results of a close run and sign-off of manual items | 0 |
| `period_close_runs` | Month-end close runs (MEC-): steps, preparer, approval | 0 |
| `period_status_history` | Every change of an accounting period status, with source and user | 0 |
| `posting_rule_lines` | Lines of a posting rule: side, account or account role, amount key, split per co-insurer | 180 |
| `posting_rules` | Posting rule versions per business event (effective date, entry type, narration) | 48 |
| `recurring_journal_runs` | Journals generated from a recurring template per occurrence | 0 |
| `recurring_journals` | Recurring and accrual journal templates (frequency, lines, auto-post, auto-reverse) | 0 |
| `tax_codes` | Tax codes: VAT, expanded withholding with ATC, DST, LGT; rate and GL account | 27 |
| `year_end_runs` | Year-end close runs (YEC-): closing and transfer journals, net income, reversal | 0 |

## Bank and insurer reconciliation

| Table | Description | Rows |
|---|---|---|
| `bank_account_links` | View: bank account masters with their GL cash account | view |
| `bank_book_lines` | View: posted journal lines on bank cash accounts, the book side of bank matching | view |
| `bank_match_rules` | Automatic matching rules (reference, amount-date, one-to-many, many-to-one) | 6 |
| `bank_rec_match_items` | Bank and book lines of a match | 0 |
| `bank_rec_matches` | Matches between bank lines and cash-account journal lines, with difference treatment | 0 |
| `bank_reconciliation_history` | Status history of a reconciliation | 0 |
| `bank_reconciliations` | Monthly bank reconciliation statements (BRC-): figures, preparer, approver | 0 |
| `bank_statement_formats` | Bank statement file layouts (columns, date format, sign convention) | 4 |
| `bank_statement_lines` | Statement lines (amount, reference, line hash), status and adjustment journal | 0 |
| `bank_statements` | Imported or keyed bank statements per bank account and period, with file hash | 0 |
| `bank_transaction_types` | Bank-side transaction types (charges, interest, direct credits) and their GL account role | 7 |
| `insurer_statement_formats` | Column mapping of an insurer's statement export (CSV or XLSX) | 1 |
| `insurer_statement_lines` | Lines of an insurer statement with their match to the broker's remittance line, debit note line or policy and the differences | 0 |
| `insurer_statement_resolutions` | How a statement difference, or a broker record missing on the statement, was settled: note or adjustment journal | 0 |
| `insurer_statements` | Imported insurer statement of account (ISR): premium remittance confirmation or commission statement, totals, sign-off | 0 |

## Credit control

| Table | Description | Rows |
|---|---|---|
| `client_credit_exceptions` | Policies issued beyond a client's credit limit: exposure before and after, and Accounting's acknowledgement | 0 |
| `collection_actions` | Collection actions: calls, e-mails, commitments | 0 |
| `collection_items` | Collection follow-up items for open bills (commitment, escalation, assignee) | 0 |
| `premium_instalment_plans` | Instalment plan of a premium bill: frequency, number of instalments, first due date and down payment | 0 |
| `premium_instalments` | Instalments of a plan: sequence, due date and amount | 0 |
| `premium_warranty_actions` | Premium warranty monitor actions: reminders, extension decisions and cancellation requests | 0 |
| `premium_warranty_extensions` | Requests to extend the premium payment warranty deadline of a policy (maker-checker) | 0 |

## Reinsurance

| Table | Description | Rows |
|---|---|---|
| `cessions` | Cessions of policies to treaties / facultative reinsurers | 0 |
| `fac_placement_shares` | Reinsurers approached on a facultative slip and their written and signed lines | 0 |
| `fac_placements` | Facultative reinsurance slips offered by a cedant, placed by the broker as reinsurance broker | 0 |
| `fac_settlements` | Facultative premium received from the cedant and paid to each reinsurer, with journals | 0 |
| `reinsurance_bordereaux` | Premium / claims bordereaux (entries JSONB, file) | 0 |
| `reinsurance_exceptions` | Reconciliation exceptions and resolution | 0 |
| `reinsurance_reconciliations` | Reinsurer statement reconciliations | 0 |
| `reinsurance_recoveries` | Claim recoveries from reinsurers | 0 |
| `reinsurance_treaties` | Treaties (type, capacity, share, retention, approval) | 0 |
| `reinsurers` | Reinsurers (rating, capacity, contact) | 0 |

## Incentives

| Table | Description | Rows |
|---|---|---|
| `incentive_calculations` | Incentive calculation batches with maker-checker and payment | 0 |
| `incentive_programs` | Incentive programmes (metric, targets, tiers, eligibility) | 0 |
| `incentive_results` | Incentive results and payouts per participant | 0 |

## Security and audit

| Table | Description | Rows |
|---|---|---|
| `access_review_items` | One user in an access review: the roles held, last sign-in and the reviewer's decision to keep or revoke | 0 |
| `access_reviews` | Periodic access review (recertification) campaign: scope, reviewer, due date and closure | 0 |
| `audit_log` | Who did what to which record, with before / after JSON and IP | 0 |
| `authority_limits` | Authority matrix: approval limit per role or per user and transaction type, effective once approved by another administrator | 30 |
| `authority_transaction_types` | Transactions that need an approver and are limited by amount or percent (authority matrix rows) | 12 |
| `login_history` | Every sign-in attempt: user, IP, user agent, success, reason, method | 0 |
| `password_history` | Previous password hashes for the history rule (last N kept) | 0 |
| `password_resets` | One-time password reset codes (HMAC hash only), expiry and attempts | 0 |
| `permissions` | Permission codes read:<module>, write:<module> and approve:<area> granted to roles | 98 |
| `refresh_tokens` | Refresh-token register (jti, family, expiry, rotation / revocation reason) | 0 |
| `role_permissions` | Grant of permissions to roles | 279 |
| `roles` | Role catalogue: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager and custom roles; a role may inherit another | 8 |
| `sod_rules` | Segregation-of-duties rules: pairs of roles one person should not hold together, with block or warn | 5 |
| `user_delegations` | Out-of-office delegation: the delegate may approve with the delegator's authority for the listed transaction types and dates | 0 |
| `user_roles` | Assignment of roles to users | 1 |
| `users` | User accounts: bcrypt password hash, status, lockout counter, 2FA (encrypted TOTP secret), token version | 1 |

## Configuration and schedules

| Table | Description | Rows |
|---|---|---|
| `app_settings` | Configuration keys (JSONB value, group, label, type); every business parameter | 659 |
| `bi_extract_runs` | Runs of the scheduled BI extract (one CSV file per dataset) with status and files | 0 |
| `currencies` | Currencies (base flag, decimals, exchange rate) | 5 |
| `data_load_batches` | Go-live workbooks uploaded (configuration or migration kit): validation, errors, load and reconciliation | 0 |
| `data_load_comparisons` | Environment comparison reports of configuration and masters between environments | 0 |
| `data_load_rows` | Rows of an uploaded go-live workbook with their validation result and loaded record | 0 |
| `document_numbering` | Document number series: prefix, pattern, width, reset rule, start number | 85 |
| `document_signature_slots` | Which signature prints in which slot of which document type, and when | 15 |
| `documents` | Registry of stored files: storage key, name, type, size, owning entity, uploader | 0 |
| `e_signatures` | Signature images of signatories and approving or issuing users, with consent and capture details | 0 |
| `email_outbox` | Queued e-mails (to, subject, HTML body, status, attempts, error) | 0 |
| `generated_reports` | Generated report files (code, parameters, format, storage key, rows) | 0 |
| `job_queue` | Background work queue (renewal notice batches); status, progress, attempts | 0 |
| `job_runs` | Run history of scheduled and manual job runs (status, output, error) | 0 |
| `master_records` | Generic master records (JSONB data) for masters without their own table | 449 |
| `master_types` | Master screen registry: fields, storage table, keys of each configurable master | 69 |
| `notifications` | In-app notifications per user or per permission audience | 0 |
| `report_builder_reports` | Ad hoc reports designed by users over curated datasets: columns, filters, grouping, sharing | 0 |
| `report_definitions` | Report catalogue (parameters, query, columns, roles, permission) | 40 |
| `report_schedules` | E-mailed report schedules (cron, format, recipients) | 0 |
| `scheduled_jobs` | Cron jobs (code, cron, handler, params, enabled, last status) | 35 |
| `schema_migrations` | Applied migration files | 149 |
| `sequences` | Document-number counters per series and reset period (year, fiscal year, month or ALL) | 0 |
| `work_tasks` | Tasks and follow-ups of the My Work diary: due date, priority, reminder, related record | 0 |

## Distribution and marketing

| Table | Description | Rows |
|---|---|---|
| `campaign_recipients` | Recipients of a campaign run: consent checked, sent, failed or opted out | 0 |
| `campaign_segments` | Who a campaign is for: clients, prospects or both, narrowed by line, place, channel and type | 0 |
| `campaign_templates` | E-mail templates of campaigns with merge fields and the opt-out link | 0 |
| `campaigns` | Marketing campaigns to consenting clients and prospects: segment, template, schedule, status | 0 |
| `channel_billing_accounts` | Client account a channel is billed through when it pays a premium for its customers | 0 |
| `comparison_reports` | Client comparison and recommendation reports between insurer options | 0 |
| `dealer_sales` | One vehicle sold by a dealer under a programme, with the buyer and the resulting policy | 0 |
| `dealer_sales_batches` | Uploaded dealer sales batches of a programme, validated and converted into business | 0 |
| `distribution_channels` | Dealer groups and branches, financing banks and affinity partners in one hierarchy | 0 |
| `lead_assignment_history` | Every assignment and reassignment of a prospect (automatic, manual, bulk, queue) with the reason | 0 |
| `lead_assignment_rules` | Lead assignment rules: who receives a new prospect by branch, line, source, channel and territory | 0 |
| `motor_programmes` | Brand-new vehicle dealer programmes: insurer, own damage rate, CTPL term, free or subsidised first year | 0 |
| `sales_activities` | Calls, meetings, e-mails and visits logged on a prospect, quotation or client, with the next step (package G) | 0 |

## Fleet, marine and motor claims

| Table | Description | Rows |
|---|---|---|
| `claim_loas` | Letters of authority to the repair shop issued from an approved estimate | 0 |
| `claim_repair_estimates` | Motor repair estimates of an accredited repair shop and their approval, with supplementary estimates | 0 |
| `claim_vehicle_releases` | Release of the repaired vehicle to the insured | 0 |
| `fleet_schedules` | Fleet of a client under one motor policy with one insurer and one period | 0 |
| `fleet_vehicles` | Vehicles of a fleet schedule with their premium, additions and deletions | 0 |
| `open_cover_certificates` | Marine insurance certificates issued against an open cover, one per shipment | 0 |
| `open_cover_declarations` | Monthly declarations of the shipments of an open cover, billed as a premium | 0 |
| `open_covers` | Marine cargo open cover contracts: period, goods, voyages, limit and rate per conveyance | 0 |

## Payables and fixed assets

| Table | Description | Rows |
|---|---|---|
| `fixed_asset_depreciation` | Monthly depreciation of each asset and the journal that posted it | 0 |
| `fixed_asset_disposals` | Sale or write-off of an asset with the gain or loss posted (package G) | 0 |
| `fixed_assets` | Fixed asset register: class, cost, useful life, straight-line schedule, status | 0 |
| `supplier_invoice_lines` | Expense lines of a supplier invoice (account, amount, VAT, EWT) | 0 |
| `supplier_invoices` | Supplier invoices with input VAT and expanded withholding tax, approved by maker-checker | 0 |
| `supplier_payment_allocations` | Allocation of a supplier payment to the invoices it settles | 0 |
| `supplier_payments` | Payments to suppliers, posted through rule ap.payment | 0 |

## BIR returns and invoicing

| Table | Description | Rows |
|---|---|---|
| `bir_return_filings` | Filing record of each BIR return period (0619-E, 1601-EQ, 1604-E, 2551Q): status, reference, payment | 0 |
| `cas_book_prints` | Loose-leaf books of accounts printed per period for the CAS registration pack, with page numbers | 0 |
| `eis_submissions` | E-invoice submissions to the BIR Electronic Invoicing System: payload, status, attempts, reply | 0 |
| `sales_invoice_lines` | Lines of a sales invoice (description, amount, VAT) | 0 |
| `sales_invoice_payments` | Payments received against a sales invoice | 0 |
| `sales_invoices` | Sales invoices under the Ease of Paying Taxes Act for commission, fees and override commission | 0 |

## Compliance

| Table | Description | Rows |
|---|---|---|
| `aml_alerts` | Alerts raised by a monitoring rule on a transaction, reviewed by the compliance officer | 0 |
| `aml_cases` | Compliance officer case files: CTR to file, STR investigation or review | 0 |
| `aml_edd_reviews` | Enhanced due diligence of a high-risk client: source of wealth and funds, findings, approval | 0 |
| `aml_list_entries` | Names and identifiers of a screening list version | 0 |
| `aml_list_versions` | Loaded versions of a screening list | 0 |
| `aml_provider_requests` | Outbox of requests to a commercial screening provider (status, attempts) | 0 |
| `aml_report_items` | Transactions included in an AMLC report file | 0 |
| `aml_reports` | CTR and STR files generated in the AMLC reporting layout | 0 |
| `aml_risk_assessments` | Every customer risk rating made, with the factors that scored and the resulting risk | 0 |
| `aml_risk_factors` | Scoring table of the customer risk rating (factor, value, score) | 33 |
| `aml_rules` | Covered and suspicious transaction monitoring rules with their parameters | 6 |
| `aml_screening_hits` | Potential matches of a screening and their disposition (true match, false positive) | 0 |
| `aml_screening_lists` | Lists screened against (UN Security Council, AMLC designations, PEP and internal lists) | 4 |
| `aml_screenings` | Every screening run of a party (event, provider, result) | 0 |
| `complaint_reminders` | Acknowledgement and resolution deadline reminders of complaints | 0 |
| `complaints` | Complaints register under RA 11765: complainant, product, deadlines, resolution | 0 |
| `compliance_fit_proper` | Fit and proper declarations and checks of officers and staff | 0 |
| `compliance_licence_reminders` | Licence expiry reminders sent | 0 |
| `compliance_licences` | Licences issued by the IC or another authority to the firm, its officers and individuals, with expiry | 0 |
| `data_subject_requests` | Register of data subject requests (DSR-): type, requester, party, date received, due date, status, assignee, outcome and the exports and anonymisation done | 0 |
| `ic_statement_lines` | Lines of the IC annual statement schedules mapped to GL accounts | 37 |
| `personal_data_breach_reminders` | Notification deadline reminders of breaches | 0 |
| `personal_data_breaches` | Personal data breach and security incident register with the NPC 72-hour notification | 0 |
| `privacy_consents` | Consent given, refused or withdrawn by a client or prospect per purpose (processing, marketing, sharing), with channel, notice version and evidence; never deleted | 0 |

## Integrations

| Table | Description | Rows |
|---|---|---|
| `bank_file_layouts` | Layout of a bank bulk credit, InstaPay or PESONet upload file | 6 |
| `bank_payment_batch_lines` | One line per voucher in a bank payment batch, with the status from the bank | 0 |
| `bank_payment_batches` | Batches of payment vouchers paid through one bank account and layout | 0 |
| `coc_series` | CTPL certificate of cover number series received from an insurer | 0 |
| `ctpl_authentications` | CTPL cover authentications: COC number, vehicle identifiers, authentication result | 0 |
| `insurer_api_mappings` | Per insurer: API connector, broker code, product codes, request and response maps | 0 |
| `integration_attempts` | One row per send attempt (duration, result, error) for the monitor | 0 |
| `integration_connectors` | Configured connections to third parties: adapter, mode test or live, endpoint, credential variable names | 8 |
| `integration_inbox` | Messages received from a third party (webhook) or read from an imported file | 0 |
| `integration_outbox` | Every message to send through a connector: status, attempts, next attempt, last error | 0 |
| `message_templates` | SMS and Viber text templates per event | 5 |
| `payee_bank_accounts` | Bank accounts of payees credited by bank payment files | 0 |
