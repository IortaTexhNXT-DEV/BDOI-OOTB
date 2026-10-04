---
title: Data Dictionary
subtitle: BrokerVerse OOTB database
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed: 
approved: 
acronyms: OOTB=Out of the box; BIR=Bureau of Internal Revenue; IC=Insurance Commission; DPA=Data Privacy Act of 2012 (Republic Act No. 10173); NPC=National Privacy Commission; FK=Foreign key; PK=Primary key; GL=General ledger; JV=Journal voucher; OR=Official receipt; PV=Payment voucher; DN=Debit note; EWT=Expanded withholding tax; WHT=Withholding tax; VAT=Value-added tax; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; LGU=Local government unit; TIN=Tax identification number; ATC=Alphanumeric tax code; TOTP=Time-based one-time password; JSON=JavaScript Object Notation; LOB=Line of business; SLA=Service level agreement
---

# About this document

This data dictionary describes the database of BrokerVerse OOTB: what each functional area stores, the key tables and how they relate, the conventions every table follows, the main status lifecycles and the columns that hold personal data. It is written for the broker's finance, operations and IT staff who read reports, run data migration and reconcile figures, and for the support team that maintains the system after go-live.

The column-level detail is in the companion workbook **BrokerVerse_Data_Dictionary.xlsx**. This document summarises it and explains the model. Where the two differ, the workbook is the more detailed reference.

## Sources

All facts come from the application and the database:

- the migration files in `backend/src/db/migrations` (80 files, `0001_core.sql` to `0216_claim_settlement_repair_shop.sql`), including the comments written next to the columns;
- the seed files in `backend/src/db/seeds` and the seed step `backend/src/db/seed.js`;
- the module code in `backend/src/modules` (status vocabularies, validation, posting) and the scheduled jobs in `backend/src/jobs`;
- the catalogue of a fully migrated and loaded PostgreSQL test database (`golive`): tables, columns, keys, indexes, constraints and row counts.

> Row counts in this document are those of the loaded test database at migration 0216, which holds reference data and the sample data set; the workbook, regenerated at migration 0242, holds the counts of the reference data only. They show the relative weight of the tables, not production volumes. A production database starts with reference data only.

## The companion workbook

| Sheet | Content |
|---|---|
| Summary | Counts of tables, columns, keys, indexes, constraints and settings; columns by data type; tables and rows by functional area. |
| Tables | One row per table and view: functional area, owning module, description, primary key, rows of reference data, number of columns, the migration that created it, retention class and whether it holds personal data. |
| Columns | One row per column (2,837 rows): position, data type, length or precision, nullable, default, primary key, foreign key target, uniqueness, personal data class, the migration that added it and a business description. |
| Relationships | All 293 foreign keys: child and parent table and columns, delete and update rule, functional areas and whether an index supports the key. |
| Indexes | All 564 indexes: kind, method, columns or expression and the condition of partial indexes. |
| Reference values | Status vocabularies from the code, allowed values of CHECK constraints, values documented in the migrations, all 404 application settings with group, label and seeded value, master types and master records, document number series, roles, tax codes, bank transaction types, the month-end checklist, scheduled jobs and posting rule events. |

## Database at a glance

| Item | Value (loaded test database) |
|---|---|
| Database engine | PostgreSQL, schema `public` |
| Migrations applied | 80 (0001_core.sql to 0216_claim_settlement_repair_shop.sql) |
| Tables | 167 |
| Views | 2 (`bank_account_links`, `bank_book_lines`) |
| Columns | 2,756 in tables, 2,797 including the views |
| Foreign keys | 292 (244 no action, 44 cascade, 4 set null) |
| Indexes | 520 (167 primary keys, 111 further unique, 40 partial, 1 GIN) |
| CHECK constraints | 174 |
| Application settings | 404 keys in 42 groups |
| Rows in all tables | 7,669 |
| Columns holding personal data | 137 in 41 tables |

> The figures above describe the loaded test database at migration 0216. The companion workbook was regenerated at migration 0242 from a new database built with the migrations and the reference seed data only (no sample data): 95 migrations, 169 tables and 2 views, 2,796 columns in tables, 293 foreign keys, 564 indexes, 181 check constraints, 414 settings in 45 groups and 145 columns holding personal data in 43 tables. Its row counts are those of the reference data (1,973 rows in all), not of the test database. Of migrations 0217 to 0242, the ones that change the model for users are 0221 (data privacy: tables `privacy_consents` and `data_subject_requests`, columns `anonymised_at` and `anonymised_by` on `clients` and `leads`), 0225 (`email_outbox.attachments`), 0235 (one base currency and dated exchange rates) and 0237 (`commission_referrers.wht_code`). These tables and columns are described below where they belong.

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
| Text key with prefix (61 tables) | Business records. The database generates a prefix and random hexadecimal characters, for example `pol_` + 16 characters for a policy, `qt_` for a quotation, `or_` for a receipt, `jv_` for a journal voucher. The ids cannot be guessed and never collide across tables. `commission_referrers` and `reinsurers` use a readable code instead (for example `ref-dcruz`, `RE001`). |
| Sequential number (83 tables) | Masters, lines and logs (`integer` or `bigint` from a sequence): countries, banks, insurers, products, `journal_lines`, `audit_log`, `login_history`, `claim_history`, `risk_participants`. |
| Natural or composite key (the other tables) | Codes that are themselves the key: `app_settings(key)`, `gl_accounts(code)`, `tax_codes(code)`, `accounting_periods(period)`, `fiscal_years(code)`, `master_types(code)`, `sequences(name, period)`, `opening_balances(fiscal_year, account_code)`, `role_permissions(role_id, permission_id)`. |

Business numbers (QT-2026-00001, POL-2026-00001, OR-2026-00019, JV-, BS-, PS-, REM-, DN-, BRC-, MEC-) are separate unique columns, never primary keys. Every number comes from a series of the Document Numbering master (`document_numbering`, 60 series). The SQL function `next_document_number()` locks the counter row in `sequences` until the transaction ends, so two users never receive the same number and a cancelled save gives its number back. The pattern tokens are `{PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {SEQ}`; the reset rule is yearly, fiscal_yearly, monthly or never.

## Money, rates and shares

- Amounts are `numeric`: 232 columns are `numeric(14,2)` and 61 are `numeric(16,2)` (sums insured, credit limits, bank statement and reconciliation figures, statement and certificate totals, treaty capacity). The application rounds every result to two decimals with half away from zero, the same rule as PostgreSQL `round(numeric, 2)`.
- The currency of a document is in a `currency` column (`PHP` by default) where a document can be in another currency; `journal_lines` carry `currency_code`, `exchange_rate` and `foreign_amount`. All ledger amounts are in the base currency of the Currency master (PHP); journal vouchers convert at the dated Exchange Rate in force on the voucher date.
- Commission rates are fractions: `commission_rate` 0.15 means 15% (`insurance_companies`, `commission_rates`, `insurer_rate_tables`, `risk_participants`). Tax rates in `tax_codes.rate` and `premium_charge_rules.rate` are percent (12 means 12%). Co-insurance shares (`share_percent`, `offered_share`) are percent from 0 to 100.
- Debit and credit are separate non-negative columns on `journal_lines` and `bank_statement_lines`; a journal line has either a debit or a credit (CHECK constraint).

## Dates and the business time zone

- Calendar dates (inception, expiry, due, loss, receipt, voucher, statement and period dates) are `date` columns (120 columns). They carry no time and cannot shift with the time zone.
- Instants (creation, approval, posting, sending) are `timestamptz` (363 columns): stored as an absolute point in time and shown in local time.
- "Today" is the business date in the time zone of the setting `general.timezone`, seeded as **Asia/Manila**. Date columns that default to today use the function `numbering_business_date()` (migration `0145_business_date_defaults.sql`), so a record created between 00:00 and 08:00 Manila time gets the Manila date, not the date of the server clock, which runs on UTC. Document numbering, period assignment, reports and scheduled jobs use the same business date.
- Accounting periods are keyed `YYYY-MM`; period 13 of a fiscal year is the year-end adjustment period. A journal falls in the period of its `jv_date`.
- The screens show dates as DD/MM/YYYY (`general.date_format`). This document writes dates as 03 October 2026.

## Audit columns

| Column | Tables | Meaning |
|---|---|---|
| `created_at` | 126 | Date and time the row was created. |
| `created_by` | 100 | User id of the creator. |
| `updated_at` | 94 | Date and time of the last change; set by the application, and by triggers on `users`, `roles`, `commission_rates` and `document_numbering`. |
| `updated_by` | 63 | User id of the last change. |
| Maker-checker stamps | many | `submitted_by` / `submitted_at`, `approved_by` / `approved_at`, `rejected_by` / `rejected_at`, `posted_by` / `posted_at`, `decided_by` / `decided_at`. |

Every create, update, approval, posting and sign-in related event is also written to `audit_log` (who, when, which record, action, values before and after, IP address). Domain histories add detail where it is needed: `claim_history`, `claim_field_changes`, `renewal_activities`, `renewal_notices`, `collection_actions`, `period_status_history`, `bank_reconciliation_history`, `remittance_approvals.history`, `login_history`, `password_history` and `job_runs`.

## Status, soft delete and cancellation

- Almost every business table has a `status` column (110 tables). Statuses are stored as lower-case codes in most tables; some older modules store the label (`Accrued`, `Paid`, `Active`). The screens map codes to labels, for example a quotation with status `sent` shows as **PendingCustomer**. The values of each status column are in the workbook, sheet Reference values.
- Masters are not deleted while in use: they become `inactive`, and generic master records get the status `deleted`; unique indexes on codes are partial (`WHERE status <> 'deleted'`) so a code can be reused after deletion.
- Leads, quotations and bank statements carry `deleted_at` (soft delete). A draft quotation is the only business record deleted physically.
- Financial documents are never deleted. A receipt is cancelled, a journal is reversed or corrected by another journal (`reversal_of`, `reversed_by_jv`, `correction_of`), a BIR Form 2307 certificate is cancelled (`cancelled_at`), a debit note collection is reversed.

## JSON document columns

103 columns are `jsonb`. They hold the parts of a record whose structure depends on the product or the screen: the full document of a quotation, broker slip, placement or policy (`doc`), vehicle and cover selections, claim details, endorsement changes, configuration values (`app_settings.value`), master record fields (`master_records.data`) and before and after values of the audit trail. Anything that is searched, totalled, joined or reported on is kept in ordinary columns. The workbook marks each JSON column and describes its content.

## Keys, constraints and indexes

- **Foreign keys.** 292 foreign keys. 244 use no action: a referenced record cannot be deleted while it is used. 44 cascade: lines and histories that have no meaning without their parent (journal lines, receipt lines, claim history, renewal notices, role grants, match items). 4 set the reference to empty when the parent goes. 47 foreign keys point to `users`; other user columns (`created_by`, `approved_by`) hold the user id without a foreign key.
- **Supporting indexes.** 69 foreign keys have no index whose first column is the foreign-key column. They are on small master and set-up tables or are maker-checker stamp columns. The sheet Relationships flags them.
- **CHECK constraints.** 174 constraints protect allowed values (statuses, kinds, rate bases), number ranges (rates, shares, instalment counts) and rules that span columns (a journal line has a debit or a credit, a limit is for a role or for a user, a delegation ends after it starts).
- **Unique and partial indexes.** Business numbers and codes are unique. Partial unique indexes enforce rules such as one active instalment plan per bill, one pending warranty extension per policy, one lead insurer per co-insured record and one open renewal per policy.
- **Triggers.** `jv_check_posting` refuses to post a journal that is unbalanced, has fewer than two lines or falls in a period that does not accept postings. `accounting_period_lock_guard` refuses to reopen a period locked by the year-end close. Further triggers keep `updated_at`, derive the normal balance of a GL account and mirror number series prefixes into settings.

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

# Data model by functional area

## Overview

| Functional area | Tables | Key tables |
|---|---|---|
| Party and client | 10 | `clients`, `insurance_companies` |
| Product and rating | 15 | `products`, `product_templates`, `premium_charge_rules` |
| Sales and quotation | 9 | `leads`, `quotes`, `payment_links` |
| Placement | 4 | `broker_slips`, `insurer_offers`, `placements`, `risk_participants` |
| Policy and endorsement | 4 | `policies`, `endorsements` |
| Billing, receipts and payments | 16 | `receivables`, `receipts`, `receipt_applications`, `disbursements` |
| Remittance and insurer accounting | 12 | `remittances`, `direct_bill_items`, `commission_debit_notes` |
| Commission | 4 | `commissions`, `commission_rates` |
| Claims | 4 | `claims`, `claim_settlement_movements` |
| Renewals | 7 | `renewals`, `renewal_quotes` |
| General ledger and period end | 20 | `journal_vouchers`, `journal_lines`, `gl_accounts`, `posting_rules`, `accounting_periods` |
| Bank and insurer reconciliation | 13 + 2 views | `bank_statements`, `bank_rec_matches`, `bank_reconciliations`, `insurer_statements` |
| Credit control | 7 | `collection_items`, `premium_instalment_plans` |
| Reinsurance | 7 | `reinsurance_treaties`, `cessions`, `reinsurance_recoveries` |
| Incentives | 3 | `incentive_programs`, `incentive_results` |
| Security and audit | 16 | `users`, `roles`, `audit_log` |
| Configuration and schedules | 16 | `app_settings`, `master_records`, `document_numbering`, `scheduled_jobs` |

## Party and client

The client is the insured party. A client is created from a lead when a quotation is converted, by bulk upload or directly on the client screen. Individual and corporate clients share one table (`client_type`); identity, contact and address fields are columns, further screen fields are in `extra`. Insurers (principals) carry the commission rate used when the rate matrix has no rate, the premium payment warranty days, the remittance terms and the default billing mode. The address masters (`countries` → `regions` → `states` (provinces) → `cities` (cities and municipalities) → `districts` (barangays), and `postal_codes`, from the Philippine Standard Geographic Code) feed the address fields. Branches and signatories are printed on documents.

| Table | Holds |
|---|---|
| `clients` | Insured parties: code, type, names, birth date, contact, address, TIN, owner, credit limit. |
| `insurance_companies` | Insurers: code, name, TIN, contact, default commission rate, premium warranty days, remittance terms days, default billing mode. |
| `banks` | Banks and mortgagees. Bank accounts of the broker are master records of type `bank-account`. |
| `branches`, `signatories` | Broker branches and the persons who sign documents. |
| `countries`, `regions`, `states`, `cities`, `districts`, `postal_codes` | Address masters (PSGC codes on regions, provinces, cities / municipalities and barangays). |

| From | To | Meaning |
|---|---|---|
| `clients.lead_id` | `leads` | Lead the client was converted from (unique when set). |
| `clients.owner_user_id` | `users` | Account executive who owns the client. |
| `states.country_id`, `cities.state_id`, `districts.city_id` | address masters | Province within a country, city within a province, district within a city. |

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

| From | To | Meaning |
|---|---|---|
| `policies.client_id`, `product_id`, `policy_type_id`, `insurance_company_id` | masters and `clients` | Insured, product and insurer of the policy. |
| `policies.quote_id`, `placement_id`, `lead_id` | `quotes`, `placements`, `leads` | Origin of the policy. |
| `policies.renewed_from` | `policies` | Expiring policy this one renews (`renewed_to` holds the reverse link). |
| `endorsements.policy_id`, `receivable_id` | `policies`, `receivables` | Policy changed; bill raised for the additional premium. |
| `policy_payments.policy_id`, `receivable_id`, `receipt_id` | `policies`, `receivables`, `receipts` | Payment captured, bill paid and receipt issued on confirmation. |

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

| From | To | Meaning |
|---|---|---|
| `receivables.policy_id`, `client_id`, `booking_jv_id` | `policies`, `clients`, `journal_vouchers` | Bill of a policy and the journal that booked it. |
| `receipt_lines.receipt_id` | `receipts` | Line of a receipt (deleted with it). |
| `receipt_applications.receipt_id`, `receipt_line_id`, `receivable_id`, `journal_id` | receipts, `receivables`, `journal_vouchers` | Money of a receipt line applied to a bill, and the posting journal. |
| `receivable_credits.receivable_id`, `journal_id` | `receivables`, `journal_vouchers` | Credit on a bill and its journal. |
| `invoice_lists.disbursement_id` | `disbursements` | Invoice list settled by a payment voucher. |
| `checkbooks.disbursement_id`, `invoice_list_id` | `disbursements`, `invoice_lists` | Cheque issued for a voucher. |
| `petty_cash_*.fund_id` | `petty_cash_funds` | Movements of a petty cash fund. |

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

| From | To | Meaning |
|---|---|---|
| `commissions.policy_id`, `endorsement_id`, `referrer_id` | `policies`, `endorsements`, `commission_referrers` | Source and payee of the commission line. |
| `commissions.accrual_jv_id`, `payment_jv_id`, `disbursement_id` | `journal_vouchers`, `disbursements` | Accrual and payment journals and the paying voucher. |
| `commission_adjustments.commission_id` | `commissions` | Line adjusted. |
| `commission_referrers.parent_referrer_id` | `commission_referrers` | Referrer hierarchy. |

## Claims

A claim belongs to a policy and client and carries the loss details, the estimate, approved and settled amounts and the handler. Motor claims keep driver and third-party details in JSON. Every status change is in `claim_history` and every field change in `claim_field_changes`. Settlement cash is recorded in `claim_settlement_movements`: funds received from each insurer and payments to the claimant, each with its journal. Recoveries from reinsurers are in the reinsurance area.

| Table | Holds |
|---|---|
| `claims` | Claims: number, policy, client, loss date, type, place, amounts, handler, adjuster, settlement, status. |
| `claim_history`, `claim_field_changes` | Status history and field-level change trail. |
| `claim_settlement_movements` | Funds received from insurers and paid to claimants, with journals. |

| From | To | Meaning |
|---|---|---|
| `claims.policy_id`, `client_id` | `policies`, `clients` | Policy and insured of the claim. |
| `claim_history.claim_id`, `claim_field_changes.claim_id` | `claims` | Histories (deleted with the claim). |
| `claim_settlement_movements.claim_id`, `insurance_company_id`, `journal_id` | `claims`, `insurance_companies`, `journal_vouchers` | Settlement cash movement, paying insurer and journal. |

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

| From | To | Meaning |
|---|---|---|
| `cessions.policy_id`, `treaty_id`, `facultative_reinsurer_id` | `policies`, `reinsurance_treaties`, `reinsurers` | Policy ceded and where. |
| `reinsurance_recoveries.claim_id`, `cession_id`, `treaty_id` | `claims`, `cessions`, `reinsurance_treaties` | Claim recovered under a cession. |
| `reinsurance_exceptions.reconciliation_id` | `reinsurance_reconciliations` | Exception found in a reconciliation. |

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

Users sign in with a username and password (bcrypt hash only) and, where required by role, a second factor (TOTP secret stored encrypted). Roles carry permissions (`read:<module>`, `write:<module>`, `approve:<area>`) and may inherit another role. Refresh tokens are rotated and revoked by family. The access control tables add the authority matrix (approval limits per role or user and transaction type, effective once a second administrator approves), segregation-of-duties rules, out-of-office delegations and periodic access reviews. `audit_log` and `login_history` are the audit trail.

| Table | Holds |
|---|---|
| `users`, `roles`, `permissions`, `user_roles`, `role_permissions` | Users, roles, permissions and their assignments. |
| `refresh_tokens`, `password_resets`, `password_history`, `login_history` | Sessions, reset codes (hash only), previous password hashes, sign-in attempts. |
| `authority_transaction_types`, `authority_limits` | Authority matrix. |
| `sod_rules`, `user_delegations` | Segregation-of-duties rules and delegations. |
| `access_reviews`, `access_review_items` | Access reviews and the decision per user. |
| `audit_log` | Audit trail of every change. |
| `privacy_consents` | Consent given, refused or withdrawn by a client or prospect per purpose (processing, marketing, sharing), with channel, notice version and evidence; never deleted. |
| `data_subject_requests` | Register of data subject requests (DSR-): type, requester, party, date received, due date, status, assignee, outcome and the exports and anonymisation done. |

| From | To | Meaning |
|---|---|---|
| `user_roles.user_id`, `role_id` | `users`, `roles` | Role assigned to a user. |
| `role_permissions.role_id`, `permission_id` | `roles`, `permissions` | Permission granted to a role. |
| `authority_limits.role_code`, `user_id`, `transaction_type` | `roles`, `users`, `authority_transaction_types` | Limit of a role or user for a transaction type. |
| `sod_rules.role_a`, `role_b` | `roles` | Conflicting pair of roles. |
| `access_review_items.review_id`, `user_id` | `access_reviews`, `users` | User reviewed in a campaign. |

## Configuration and schedules

Business parameters are keys of `app_settings` (404 keys in 42 groups), edited in Master > Configuration and System Settings; the workbook lists every key with its group, label and seeded value. Masters without a table of their own are records of `master_records` described by `master_types` (fields, unique keys, screen). Document number series and their counters are in `document_numbering` and `sequences`. Scheduled jobs and their run history, the background queue, notifications, the e-mail outbox, stored files and the report catalogue complete the platform tables.

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

| From | To | Meaning |
|---|---|---|
| `master_records.type_code` | `master_types` | Record of a master type. |
| `job_runs.job_id` | `scheduled_jobs` | Run of a job. |
| `report_schedules.report_code`, `job_id` | `report_definitions`, `scheduled_jobs` | Report sent by a schedule and the job that runs it. |

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

# Personal data and retention

## Personal data under the Data Privacy Act

BrokerVerse processes personal information of clients, prospects, claimants, drivers and third parties, referrers and staff users. The workbook classifies every column in the column **Personal data (RA 10173)** using four classes:

| Class | Meaning | Columns |
|---|---|---|
| Personal information | Information from which the identity of an individual is apparent or can be reasonably ascertained (Section 3(g) of RA 10173): names, addresses, e-mail, phone, IP address, plate number. | 90 |
| Sensitive personal information | Section 3(l) of RA 10173: age (date of birth), government-issued identifiers such as the TIN, and health or offence-related details that claims may contain. | 9 |
| Credential / security secret | Password hashes, second-factor secrets, reset codes, tokens. Not personal information in themselves but must be protected as security data. | 9 |
| May contain personal information | Free text, JSON documents and stored files that hold personal information depending on what users enter or upload. | 29 |

The classification is an assessment made for this document from the column names, their use in the code and the test data. The broker's Data Protection Officer should confirm it and record it in the register of processing activities.

## Tables and columns holding personal data

In the table, Personal, Sensitive, Credential and May contain refer to the four classes above.

| Table | Columns holding personal data |
|---|---|
| `clients` | Personal: first_name, last_name, company_name, display_name, email, phone, gender, address, city, state, country, postal_code, preferred_name, house_no, barangay, road, soi, moo<br>Sensitive: tin, birth_date<br>May contain: extra |
| `signatories` | Personal: name, designation, signature_key |
| `agent_events` | May contain: description |
| `leads` | Personal: first_name, last_name, company_name, display_name, email, phone, gender, address, city, state, country, postal_code, preferred_name, house_no, barangay, road, soi, moo<br>Sensitive: birth_date, tax_number<br>May contain: notes, extra |
| `package_quotes` | Personal: insured_name |
| `payment_events` | May contain: payload |
| `payment_links` | Personal: payer_name, payer_email, payer_mobile<br>Credential: token |
| `quote_customer_responses` | May contain: remarks, attachment_key |
| `quotes` | Personal: vehicle, approval_sent_to<br>Credential: approval_token<br>May contain: doc |
| `broker_slips` | Personal: insured_name<br>May contain: doc |
| `placements` | Personal: insured_name<br>May contain: doc |
| `endorsements` | May contain: changes |
| `policies` | Personal: insured_name<br>May contain: details, doc |
| `policy_payments` | May contain: proof_key |
| `checkbooks` | Personal: customer_name |
| `disbursements` | Personal: payee_name, referrer_name |
| `petty_cash_receipts` | Personal: requester_name |
| `petty_cash_requests` | Personal: requester_name |
| `receipts` | Personal: customer_name |
| `commission_debit_note_lines` | Personal: insured_name |
| `direct_bill_client_payments` | May contain: proof_key |
| `remittance_lines` | Personal: insured_name |
| `commission_referrers` | Personal: name, email, phone, bank_name, bank_account_no<br>Sensitive: tin |
| `claim_field_changes` | May contain: old_value, new_value |
| `claims` | Personal: loss_address<br>Sensitive: driver, third_party<br>May contain: description, details, policy_info, adjuster, settlement |
| `renewal_notices` | Personal: recipient |
| `renewals` | May contain: coverage_details |
| `bir_2307_certificates` | Personal: payee_name, payee_address, payor_name, payor_address<br>Sensitive: payee_tin, payor_tin |
| `insurer_statement_lines` | Personal: insured_name |
| `collection_actions` | May contain: notes |
| `cessions` | Personal: insured |
| `reinsurance_recoveries` | Personal: insured |
| `access_review_items` | Personal: last_login_at |
| `audit_log` | Personal: username, ip<br>May contain: before_data, after_data |
| `login_history` | Personal: username, ip, user_agent |
| `password_history` | Credential: password_hash |
| `password_resets` | Credential: code, code_hash |
| `refresh_tokens` | Personal: device_id<br>Credential: jti |
| `users` | Personal: username, display_name, first_name, last_name, email, phone, employee_code, department, designation, reporting_to, last_login_at<br>Credential: password_hash, totp_secret, totp_pending_secret |
| `documents` | May contain: storage_key, file_name |
| `email_outbox` | Personal: to_address, cc<br>May contain: body_html, attachments |
| `privacy_consents` | May contain: evidence, withdrawal_reason |
| `data_subject_requests` | Personal: requester_name, requester_contact<br>May contain: description, outcome, response_notes |

## Protection in the database

- Passwords are stored only as bcrypt hashes; reset codes only as keyed hashes; the second-factor secret is encrypted with AES-256-GCM using the key in `DATA_ENCRYPTION_KEY`. Payment gateway credentials are not stored in the database but read from the environment.
- Access to the data in the application follows the role permissions; the authority matrix, segregation-of-duties rules and access reviews control who may approve and who holds which roles.
- Every change to a record is in `audit_log` with the user, time, IP address and the values before and after. Because the audit trail copies record values, it holds personal information too.
- The database has no column-level encryption or masking of client data; protection relies on database access control, encryption of the storage and of backups, and the application's permissions. See the Architecture, Infrastructure, Security and Privacy document.

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
| Financial | 56 | Ledger, bills, receipts, payments, commissions, remittances, reconciliations, tax certificates. Kept for the statutory record-keeping period; cancelled or reversed, never deleted. |
| Transaction | 25 | Leads, quotations, placements, policies, endorsements, claims, renewals, reinsurance. Kept for the life of the policy or claim plus the regulatory period. |
| Reference | 61 | Masters, settings, posting rules, number series, roles. Kept while in use; changes audited. |
| Log / audit | 21 | Audit trail, histories, sign-in history, job runs. Kept for the audit period. |
| Temporary | 6 | Tokens, reset codes, outbox, queue, notifications, generated files. Purged by housekeeping. |

> Recommendation, to be confirmed by the broker's Data Protection Officer and finance: set the retention period of financial and transaction records to the longest period required by the BIR, the Insurance Commission and the broker's own policy, and apply the DPA principle of proportionality to prospects that never became clients (leads with no quotation or policy). The application has no anonymisation or erasure function for clients and leads; a data subject's request for erasure or blocking is handled by the support team with a reviewed database script, keeping the records that a statutory retention period still requires.

# Appendix A: Table list

This appendix lists every table and view with a one-line description and the number of rows in the loaded test database. The columns of each table are in the workbook, sheet Columns.

## Party and client

| Table | Description | Rows |
|---|---|---|
| `banks` | Banks and mortgagees | 17 |
| `branches` | Broker branches | 1 |
| `cities` | Cities and municipalities (PSGC code, class, ZIP code, region) | 1642 |
| `clients` | Clients (insured parties) with KYC fields and owner | 68 |
| `countries` | Countries | 5 |
| `districts` | Barangays with PSGC code and ZIP code (Metro Manila delivered; the rest loaded by script) | 1715 |
| `insurance_companies` | Insurers (principals): contact, default commission rate, credit terms, billing mode | 58 |
| `postal_codes` | ZIP code look-up (province, city, place) | 1846 |
| `regions` | Regions of a country (PSGC) | 18 |
| `signatories` | Authorised signatories for documents | 0 |
| `states` | Provinces (formerly called State), with region and PSGC code | 84 |

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
| `product_components` | Template components: covers, rating tables, rules, documents (JSONB data) | 48 |
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
| `leads` | Leads / prospects (individual or corporate), owner, status | 61 |
| `package_quotes` | Bundle quotations: client, location, premium, discount, taxes, commission and status | 0 |
| `package_sections` | Priced sections of a bundle quotation or package policy, each with its insurer, premium, taxes and commission | 0 |
| `payment_events` | Every notification received from a payment gateway (or simulated), valid or not: the payments log | 0 |
| `payment_gateways` | Online payment gateways (Dragonpay, PayMongo, sandbox): mode, methods, fee handling, link validity; credentials stay in the environment | 3 |
| `payment_links` | Payment links sent to a client to pay a package quotation, quotation or policy premium online, and the result | 0 |
| `quote_customer_responses` | Customer responses to a quotation recorded by staff (phone, Viber, meeting, signed form) as evidence of the status change | 72 |
| `quotes` | Quotations: vehicle / coverage JSONB, premium, taxes, commission, approval token hash | 72 |

## Placement

| Table | Description | Rows |
|---|---|---|
| `broker_slips` | Broker slips (BS-): a client risk sent to several insurers for terms | 48 |
| `insurer_offers` | Insurer offers (OFR-) on a broker slip: premium, rate, taxes, deductibles, validity, share, or a decline | 118 |
| `placements` | Placement slips (PS-): firm order to the chosen insurers, binding per participant, policy issue | 23 |
| `risk_participants` | Co-insurance participants of a broker slip, quotation, placement or policy: lead, share, premium and commission | 219 |

## Policy and endorsement

| Table | Description | Rows |
|---|---|---|
| `endorsements` | Policy endorsements and cancellations, premium delta, billing link | 8 |
| `package_endorsements` | Endorsements of one section of a package policy: change of sum insured and the additional premium billed | 0 |
| `policies` | Issued policies: term, premium, insurer, billing mode, details / doc JSONB | 82 |
| `policy_payments` | Premium payments captured on a policy, awaiting finance confirmation | 18 |

## Billing, receipts and payments

| Table | Description | Rows |
|---|---|---|
| `checkbooks` | Cheques issued (instrument, approval, printing) | 19 |
| `disbursements` | Payment vouchers (PV-) to insurers, agents, clients; approval and payment | 27 |
| `invoice_lists` | Invoice lists (IL-) settled by a disbursement | 55 |
| `petty_cash_disbursements` | Petty cash payments (VAT, WHT, journal) | 3 |
| `petty_cash_funds` | Petty cash funds (size, limits, custodian, available cash) | 1 |
| `petty_cash_receipts` | Receipts into a petty cash fund | 0 |
| `petty_cash_replenishments` | Fund replenishments from bank | 3 |
| `petty_cash_request_lines` | Lines of a petty cash request | 6 |
| `petty_cash_requests` | Petty cash requests and approval | 3 |
| `receipt_applications` | Application of receipt lines to bills, with journal link | 58 |
| `receipt_lines` | Receipt lines per policy (premium, taxes, EWT, discounts) | 58 |
| `receipts` | Official receipts (OR-) header: payer, amount, mode, status | 58 |
| `receivable_credits` | Return premium and cancellation credits applied to a bill, with the refund part and journal | 4 |
| `receivable_participants` | Per-insurer split of a co-insured bill: share, gross, commission, taxes, due to insurer | 22 |
| `receivables` | Premium bills (INV-) per policy / endorsement / renewal with balance and ageing | 66 |
| `write_off_reasons` | Write-off reasons with GL account and maximum amount | 4 |

## Remittance and insurer accounting

| Table | Description | Rows |
|---|---|---|
| `commission_debit_note_collections` | Insurer payments against a debit note (cash, EWT, Form 2307) | 2 |
| `commission_debit_note_lines` | Policies / items on a debit note | 6 |
| `commission_debit_notes` | Commission debit notes (DN-) to insurers for direct-billed policies | 4 |
| `direct_bill_client_payments` | Client's premium payment made directly to the insurer on a direct-billed policy, with the insurer's receipt reference and proof; no journal is posted | 6 |
| `direct_bill_items` | Commission receivable items booked for direct-billed policies | 6 |
| `insurer_refund_credits` | Refunds due from insurers on returned premium already remitted; netted against the next remittance | 0 |
| `remittance_allocations` | Premium collected on a co-insured policy, split for remittance to each insurer | 19 |
| `remittance_approvals` | Multi-level approval requests with SLA and history | 44 |
| `remittance_delegations` | Approval delegations of earlier releases; no longer read or written (see `user_delegations`) | 0 |
| `remittance_items` | Remittance work items (settlements, adjustments, transfers, exceptions) | 44 |
| `remittance_lines` | Policies included in a remittance | 52 |
| `remittances` | Premium remittances / bills to insurers (REM-): gross, commission, net due, approval, settlement | 22 |

## Commission

| Table | Description | Rows |
|---|---|---|
| `commission_adjustments` | Commission reversed or clawed back when premium is returned or a policy cancelled | 1 |
| `commission_rates` | Commission rate matrix: rate per insurer, product, line and policy type with effective dates | 25 |
| `commission_referrers` | Referrers / sub-agents (no sign-in): hierarchy, WHT rate, bank account | 2 |
| `commissions` | Commission lines per policy / endorsement and referrer: accrual, eligibility, approval, payment | 33 |

## Claims

| Table | Description | Rows |
|---|---|---|
| `claim_field_changes` | Field-level audit trail of claim edits | 79 |
| `claim_history` | Claim status history | 35 |
| `claim_settlement_movements` | Claim settlement cash: funds received from each insurer and payments to the claimant, with journal | 2 |
| `claims` | Claims: loss details, estimate, approved and settled amounts, handler, lifecycle status | 8 |

## Renewals

| Table | Description | Rows |
|---|---|---|
| `renewal_activities` | Contact and follow-up activities on a renewal | 37 |
| `renewal_batch_policies` | Policies in a renewal batch and their notice status | 0 |
| `renewal_batches` | Batch renewal notice runs | 0 |
| `renewal_notices` | Renewal notices sent (stage, method, recipient, status) | 11 |
| `renewal_quotes` | Renewal quotations (loading, discount, variance) | 1 |
| `renewals` | Renewal cases of expiring policies (status, notices, contact, premium old / new) | 13 |
| `winback_campaigns` | Win-back campaigns for lapsed business | 0 |

## General ledger and period end

| Table | Description | Rows |
|---|---|---|
| `accounting_config_changes` | Pending, approved or rejected changes to posting rules and account determination (maker-checker); a change takes effect only on approval by a different user | 0 |
| `accounting_periods` | Periods 1 to 12 and adjustment period 13 per fiscal year: dates and status (open, soft_closed, closed, locked) | 13 |
| `bir_2307_certificates` | BIR Form 2307 certificates issued and received, per payee and quarter | 0 |
| `entry_matches` | Open-item matching of debit and credit journal lines | 0 |
| `fiscal_years` | Fiscal years (FY2026): dates and status | 1 |
| `gl_accounts` | Chart of accounts (type, statement group, normal balance, open-item flag) | 129 |
| `journal_lines` | Journal lines: account, debit / credit, branch, department, client / policy tags | 804 |
| `journal_vouchers` | Journal vouchers (JV-): source, status, maker-checker, reversal / correction links | 194 |
| `opening_balances` | Opening balances per fiscal year and account: carried forward by the year-end close or loaded at go-live | 0 |
| `period_close_checklist` | Month-end checklist items (automatic or manual, severity) | 12 |
| `period_close_entries` | Journals created by a close run and their automatic reversal | 0 |
| `period_close_run_checks` | Checklist results of a close run and sign-off of manual items | 60 |
| `period_close_runs` | Month-end close runs (MEC-): steps, preparer, approval | 5 |
| `period_status_history` | Every change of an accounting period status, with source and user | 5 |
| `posting_rule_lines` | Lines of a posting rule: side, account or account role, amount key, split per co-insurer | 146 |
| `posting_rules` | Posting rule versions per business event (effective date, entry type, narration) | 37 |
| `recurring_journal_runs` | Journals generated from a recurring template per occurrence | 0 |
| `recurring_journals` | Recurring and accrual journal templates (frequency, lines, auto-post, auto-reverse) | 0 |
| `tax_codes` | Tax codes: VAT, expanded withholding with ATC, DST, LGT; rate and GL account | 26 |
| `year_end_runs` | Year-end close runs (YEC-): closing and transfer journals, net income, reversal | 0 |

## Bank and insurer reconciliation

| Table | Description | Rows |
|---|---|---|
| `bank_account_links` | View: bank account masters with their GL cash account | view |
| `bank_book_lines` | View: posted journal lines on bank cash accounts, the book side of bank matching | view |
| `bank_match_rules` | Automatic matching rules (reference, amount-date, one-to-many, many-to-one) | 6 |
| `bank_rec_match_items` | Bank and book lines of a match | 152 |
| `bank_rec_matches` | Matches between bank lines and cash-account journal lines, with difference treatment | 76 |
| `bank_reconciliation_history` | Status history of a reconciliation | 15 |
| `bank_reconciliations` | Monthly bank reconciliation statements (BRC-): figures, preparer, approver | 5 |
| `bank_statement_formats` | Bank statement file layouts (columns, date format, sign convention) | 4 |
| `bank_statement_lines` | Statement lines (amount, reference, line hash), status and adjustment journal | 78 |
| `bank_statements` | Imported or keyed bank statements per bank account and period, with file hash | 6 |
| `bank_transaction_types` | Bank-side transaction types (charges, interest, direct credits) and their GL account role | 7 |
| `insurer_statement_formats` | Column mapping of an insurer's statement export (CSV or XLSX) | 3 |
| `insurer_statement_lines` | Lines of an insurer statement with their match to the broker's remittance line, debit note line or policy and the differences | 17 |
| `insurer_statement_resolutions` | How a statement difference, or a broker record missing on the statement, was settled: note or adjustment journal | 9 |
| `insurer_statements` | Imported insurer statement of account (ISR): premium remittance confirmation or commission statement, totals, sign-off | 3 |

## Credit control

| Table | Description | Rows |
|---|---|---|
| `client_credit_exceptions` | Policies issued beyond a client's credit limit: exposure before and after, and Accounting's acknowledgement | 0 |
| `collection_actions` | Collection actions: calls, e-mails, commitments | 5 |
| `collection_items` | Collection follow-up items for open bills (commitment, escalation, assignee) | 66 |
| `premium_instalment_plans` | Instalment plan of a premium bill: frequency, number of instalments, first due date and down payment | 4 |
| `premium_instalments` | Instalments of a plan: sequence, due date and amount | 16 |
| `premium_warranty_actions` | Premium warranty monitor actions: reminders, extension decisions and cancellation requests | 6 |
| `premium_warranty_extensions` | Requests to extend the premium payment warranty deadline of a policy (maker-checker) | 0 |

## Reinsurance

| Table | Description | Rows |
|---|---|---|
| `cessions` | Cessions of policies to treaties / facultative reinsurers | 3 |
| `reinsurance_bordereaux` | Premium / claims bordereaux (entries JSONB, file) | 0 |
| `reinsurance_exceptions` | Reconciliation exceptions and resolution | 0 |
| `reinsurance_reconciliations` | Reinsurer statement reconciliations | 0 |
| `reinsurance_recoveries` | Claim recoveries from reinsurers | 0 |
| `reinsurance_treaties` | Treaties (type, capacity, share, retention, approval) | 1 |
| `reinsurers` | Reinsurers (rating, capacity, contact) | 1 |

## Incentives

| Table | Description | Rows |
|---|---|---|
| `incentive_calculations` | Incentive calculation batches with maker-checker and payment | 1 |
| `incentive_programs` | Incentive programmes (metric, targets, tiers, eligibility) | 1 |
| `incentive_results` | Incentive results and payouts per participant | 2 |

## Security and audit

| Table | Description | Rows |
|---|---|---|
| `access_review_items` | One user in an access review: the roles held, last sign-in and the reviewer's decision to keep or revoke | 0 |
| `access_reviews` | Periodic access review (recertification) campaign: scope, reviewer, due date and closure | 0 |
| `audit_log` | Who did what to which record, with before / after JSON and IP | 1,515 |
| `authority_limits` | Authority matrix: approval limit per role or per user and transaction type, effective once approved by another administrator | 24 |
| `authority_transaction_types` | Transactions that need an approver and are limited by amount or percent (authority matrix rows) | 9 |
| `login_history` | Every sign-in attempt: user, IP, user agent, success, reason, method | 26 |
| `password_history` | Previous password hashes for the history rule (last N kept) | 24 |
| `password_resets` | One-time password reset codes (HMAC hash only), expiry and attempts | 0 |
| `permissions` | Permission codes read:<module>, write:<module> and approve:<area> granted to roles | 64 |
| `refresh_tokens` | Refresh-token register (jti, family, expiry, rotation / revocation reason) | 14 |
| `role_permissions` | Grant of permissions to roles | 176 |
| `roles` | Role catalogue: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager and custom roles; a role may inherit another | 7 |
| `sod_rules` | Segregation-of-duties rules: pairs of roles one person should not hold together, with block or warn | 5 |
| `user_delegations` | Out-of-office delegation: the delegate may approve with the delegator's authority for the listed transaction types and dates | 0 |
| `user_roles` | Assignment of roles to users | 13 |
| `users` | User accounts: bcrypt password hash, status, lockout counter, 2FA (encrypted TOTP secret), token version | 13 |

## Configuration and schedules

| Table | Description | Rows |
|---|---|---|
| `app_settings` | Configuration keys (JSONB value, group, label, type); every business parameter | 404 |
| `currencies` | Currencies (one base currency, decimals) | 5 |
| `document_numbering` | Document number series: prefix, pattern, width, reset rule, start number | 60 |
| `documents` | Registry of stored files: storage key, name, type, size, owning entity, uploader | 125 |
| `email_outbox` | Queued e-mails (to, subject, HTML body, status, attempts, error) | 260 |
| `generated_reports` | Generated report files (code, parameters, format, storage key, rows) | 39 |
| `job_queue` | Background work queue (renewal notice batches); status, progress, attempts | 0 |
| `job_runs` | Run history of scheduled and manual job runs (status, output, error) | 0 |
| `master_records` | Generic master records (JSONB data) for masters without their own table | 295 |
| `master_types` | Master screen registry: fields, storage table, keys of each configurable master | 53 |
| `notifications` | In-app notifications per user or per permission audience | 497 |
| `report_definitions` | Report catalogue (parameters, query, columns, roles, permission) | 39 |
| `report_schedules` | E-mailed report schedules (cron, format, recipients) | 0 |
| `scheduled_jobs` | Cron jobs (code, cron, handler, params, enabled, last status) | 16 |
| `schema_migrations` | Applied migration files | 80 |
| `sequences` | Document-number counters per series and reset period (year, fiscal year, month or ALL) | 33 |

