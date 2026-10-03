---
title: BrokerVerse Reports Book
subtitle: Reports and dashboards
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; SOA=Statement of account; OR=Official receipt; PV=Payment voucher; JV=Journal voucher; GL=General ledger; TB=Trial balance; VAT=Value-added tax; EWT=Expanded withholding tax; CWT=Creditable withholding tax; ATC=Alphanumeric tax code; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; TIN=Taxpayer identification number; LOB=Line of business; CSV=Comma-separated values; XLSX=Excel workbook; PDF=Portable document format; API=Application programming interface
---

# About this book

This book lists every report and dashboard that ships with BrokerVerse OOTB: what each one shows, where to find it, who may run it, which filters and columns it has, what it totals, which outputs it produces and which transactions feed it. It is written for the people who run the reports every day (operations, finance, management) and for the support team that maintains them.

Everything in this book comes from the application code, the seeded configuration and a run against the loaded test system on 03 October 2026. Sample rows are real rows from that test system; they show the layout and are not reference figures.

## How the book is organised

- Chapter 4 explains how the report engine works: the catalogue, the report screen, file generation, download links, retention and scheduled delivery.
- Chapters 5 to 9 describe the reports by group: operational, financial, tax (BIR), reconciliation, and management reports and dashboards.
- Chapter 10 covers the exports and printed outputs that live on the module screens rather than in the report catalogue.
- Chapter 11 lists the report settings and the troubleshooting steps.
- Chapter 12 records the gaps found while preparing the book.

The companion workbook **BrokerVerse_Reports_Book.xlsx** holds the full reference lists: one row per report, every column of every report, the report settings, the module exports and dashboards, and the sample totals.

## Report inventory at a glance

| Group | Catalogue reports | Other outputs in this book |
|---|---|---|
| Operational | 11 | Claims dashboard export, lead report, renewal batch report, placement and policy documents |
| Financial | 16 | Accounting entries export, receipts and voucher bulk print, financial statements screen |
| Tax (BIR) | 5 | BIR Form 2307 (issued and received) with certificate register |
| Reconciliation | 5 | Bank reconciliation statement PDF, insurer statement differences report, remittance ageing, reinsurance reconciliation |
| Management | 2 | Executive, Sales, Processing, Claims, Commission, Collections, Renewal, Remittance, Reinsurance and Product dashboards |
| Total | 39 |  |

# How reports work

## The report catalogue

All catalogue reports are rows of the table `report_definitions` (39 active rows in the OOTB seed). A definition holds the report code, name, category (operational or financial), description, the filter form as a JSON schema, the default columns with their types, the roles allowed and the permission needed, and the name of the query in `backend/src/modules/reports/queries.js` (with `periodEndQueries.js` and `bankRecQueries.js`).

**Reports > All Reports** shows every report the signed-in user may run, grouped under Operational Reports and Financial Reports, with a search box. Clicking a report opens its report screen. The menu also has direct entries for the most used reports (Reports > Operational Reports, Reports > Financial Reports, Accounts > Tax, Accounts > Bank Reconciliation and Accounts > Period End > Financial Statements); they open the same report screen.

## Who may run a report

A user sees and runs a catalogue report when both conditions hold:

- the user holds the report's permission (`read:reports` for every OOTB report), and
- the report lists no roles, or the user holds one of the listed roles.

The System Administrator role passes every check. In the OOTB roles, `read:reports` is held by Accounting, Claims, Operations, Processing Team, Sales & Marketing and System Administrator; the Accounting Manager role inherits Accounting. The per-report role list is given with each report in this book.

> Dashboards and module exports do not use the catalogue check. Each one has its own permission, listed with it in chapters 9 and 10.

## The report screen

1. Pick the **Report Criteria** (required). It decides the grouping or the subset of rows: for example Overall, Agent, Principal Insurer, Branch.
2. Enter **From Date** and **To Date** (both marked required on the screen). When a run arrives without a From Date, the engine goes back `reports.default_range_days` (365) from To Date.
3. Fill the optional filters the report offers (Agent, Company (principal insurer), Branch, Client, Product, Status, Account, Bank Account). Agent, Company, Branch and Client accept an id, a code or a name. Some filters are enabled only for a matching criterion (for example Agent only with the Agent criterion).
4. Click **Preview** to see the rows on screen, 50 to a page (`reports.default_page_size`), with the totals row, the summary figures and, for a grouping criterion, a group summary.
5. Choose the **File format** (Excel, CSV or PDF) and click **Generate** to produce the file and download it.

## What the engine does

- The query receives the period (From Date, To Date) and the settings it needs. "Today" in ageing reports is the business date in `general.timezone` (Asia/Manila), not the database server date.
- Filters are applied around the base query. Columns whose name starts with an underscore are used for filtering only and never shown.
- Every money, number and integer column in the default columns is totalled unless it is marked not to be (age in days, rates, percentages).
- Some reports also return **summary figures** (for example net income, retention rate, collection efficiency). They show under the table on screen and in the PDF, and on the Parameters sheet of the Excel file.

## Output formats

| Output | What you get |
|---|---|
| Screen (Preview) | Paged rows, totals row, summary figures, group summary for a grouping criterion. |
| Excel (.xlsx) | Sheet with the report rows and a TOTAL row; a Summary sheet for a grouping criterion; a Parameters sheet (report, company, period, criteria, filters, rows, currency, generated at, generated by, summary figures). |
| CSV | The rows and a TOTAL row, UTF-8. |
| PDF | Company letterhead, report title, a parameter line (period, criteria, filters, currency, row count), the table with totals and a Summary table. Page size from `reports.pdf_page_size` (A4). |

Generated files are written to the file store under `reports/` and recorded in `generated_reports` (who, when, parameters, row count, totals, status). A file holds at most `reports.max_rows` rows (50,000); the response says when a file was truncated. The download link is signed and valid for `reports.download_link_ttl_hours` (72 hours). Files older than `reports.retention_days` (90 days) are deleted when a scheduled report runs.

File names follow the pattern `<code>_<from>_<to>_<yyyymmdd-hhmmss>.<ext>`, for example `production-register_2026-01-01_2026-09-30_20260928-101500.xlsx`.

## Scheduled delivery by e-mail

A report can be generated on a timetable and e-mailed to a list of addresses (a report schedule: report code, cron expression, parameters, format, recipients, enabled). Creating a schedule also creates a job `report-<schedule id>` with handler `scheduledReport` in Master > Schedules, so it runs, shows its history and can be run on demand like any other job. The e-mail carries a download link, not the file; its wording is in the settings `reports.email_subject` and `reports.email_body` (see the Communication Templates document).

For scheduled runs the parameter `period` gives a relative window when no dates are stored: today, yesterday, last-7-days, last-30-days, month-to-date, previous-month or year-to-date.

> In the OOTB front end there is no screen for report schedules or for the history of generated files. Both exist in the API (`/api/reports/schedules`, `/api/reports/generated`, permission `write:reports` to change schedules). Until a screen is added, a System Administrator creates schedules through the API; once created they appear in Master > Schedules.

The separate job **Daily reports** (Master > Schedules, 05:00 Manila time) generates the Production Register, Collection Report and Claims Position every day into the generated-file history; it does not e-mail them.


# Operational reports

Operational reports follow the business from prospect to placement, policy, claim, renewal and remittance. Most offer the standard criteria Overall, Agent, Principal Insurer and Branch: Overall lists the rows, the others add a summary by that dimension. Agent is the policy owner (the account executive) and Branch is that user's branch.

| Report | Menu | Used by |
|---|---|---|
| Production Register | Reports > Operational Reports > Production | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims |
| Claims Position | Reports > Operational Reports > Claims | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims |
| Renewal Retention | Reports > Operational Reports > Renewal | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims |
| Remittance Summary | Reports > Operational Reports > Remittance | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager) |
| Broker Commission Statement | Reports > Operational Reports > Broker Commission | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager) |
| Claims Ageing | Reports > All Reports > Claims Ageing | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims |
| Lead Conversion Funnel | Reports > All Reports > Lead Conversion Funnel | Sales & Marketing, Processing Team, Operations (Client Servicing) |
| Placement Pipeline | Reports > All Reports > Placement Pipeline | Sales & Marketing, Processing Team, Operations (Client Servicing) |
| Market Response | Reports > All Reports > Market Response | Sales & Marketing, Processing Team, Operations (Client Servicing) |
| Reinsurance Cession Register | Reports > All Reports > Reinsurance Cession Register | Processing Team, Accounting (and Accounting Manager) |
| Co-insurance Register | Reports > Financial Reports > Co-insurance Register | Accounting (and Accounting Manager), Processing Team, Sales & Marketing |

## Production Register

Policies incepted in the period with premium, commission, new business / renewal flag; grouped by agent, insurer or branch per Report Criteria.

| Item | Detail |
|---|---|
| Code | `production-register` |
| Menu | Reports > Operational Reports > Production |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch, Billing Mode (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Policy No., Issue Date, Inception, Expiry, Business Type, Client, Product, Insurer, Agent, Branch, Sum Insured, Gross Premium, Commission, Currency, Status, Billing Mode |
| Totals | Sum Insured, Gross Premium, Commission |
| Summary figures | New business count, Renewals count, Direct bill count |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | policies, clients, products, insurance_companies, users, branches |
| Fed by | Policy issue (Convert to policy, Issue policy from a placement slip, Record Issued Policy), policy bulk upload, renewal completion. Rows are selected on the inception date. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 55; amounts in PHP):

| Policy No. | Inception | Business Type | Client | Insurer | Gross Premium |
|---|---|---|---|---|---|
| POL-2026-00001 | 02 May 2026 | New Business | Jerome Mercado | Pacific Crest Insurance Corp. | 49,161.47 |
| POL-2026-00027 | 06 May 2026 | New Business | Mark Gonzales | Mindanao Shield Insurance Corp. | 610.40 |
| POL-2026-00054 | 10 May 2026 | New Business | Himlayan Cold Storage Corp. | Harbor Point Non-Life Insurance Inc. | 980,902.89 |
| POL-2026-00011 | 23 May 2026 | New Business | Liza Ocampo | Mindanao Shield Insurance Corp. | 50,052.84 |

Report totals for the period: Sum Insured PHP 4,105,734,000.00; Gross Premium PHP 14,310,401.18; Commission PHP 1,765,752.54.

Summary figures returned: New business: 50; Renewals: 5; Direct bill: 5.

## Claims Position

Claims reported in the period with estimate, approved and settled amounts, age and ageing bucket. Criteria: All, Open, Settled, Rejected, Aging (open claims by ageing bucket).

| Item | Detail |
|---|---|
| Code | `claims-position` |
| Menu | Reports > Operational Reports > Claims |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | All, Open, Settled, Rejected, Aging (default All) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Claim No., Policy No., Client, Insurer, Product, Agent, Loss Date, Reported, Loss Type, Status, Estimate, Approved, Settled, Age (days), Ageing |
| Totals | Estimate, Approved, Settled |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | claims, policies, clients, products, insurance_companies, users, branches |
| Fed by | Claim registration (Operations > Claims), claim status changes, settlement. Rows are selected on the reported date. Open, settled and rejected follow the settings reports.claim_open_statuses, reports.claim_settled_statuses and reports.claim_rejected_statuses; buckets follow reports.claim_ageing_buckets. |

Sample from the test system (criteria All, 01 January 2026 to 30 September 2026, first rows of 7; amounts in PHP):

| Claim No. | Policy No. | Insurer | Status | Estimate | Settled |
|---|---|---|---|---|---|
| CLM-2026-00001 | POL-2026-00001 | Pacific Crest Insurance Corp. | closed | 85,000.00 | 72,500.00 |
| CLM-2026-00006 | POL-2026-00050 | Archipelago General Insurance Co., Inc. | in-review | 340,000.00 | - |
| CLM-2026-00004 | POL-2026-00036 | Harbor Point Non-Life Insurance Inc. | closed | 35,000.00 | 28,750.00 |
| CLM-2026-00008 | POL-2026-00011 | Mindanao Shield Insurance Corp. | closed | 12,000.00 | - |

Report totals for the period: Estimate PHP 1,890,000.00; Approved PHP 1,097,750.00; Settled PHP 1,097,750.00.

## Renewal Retention

Renewals due in the period with outcome (retained, lost, pending), old and new premium and the retention rate.

| Item | Detail |
|---|---|
| Code | `renewal-retention` |
| Menu | Reports > Operational Reports > Renewal |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Policy No., Client, Insurer, Product, Agent, Branch, Due Date, Renewal Status, Outcome, Expiring Premium, Renewal Premium, Renewed Policy No. |
| Totals | Expiring Premium, Renewal Premium |
| Summary figures | Retained, Lost, Pending, Retention rate (retained / (retained + lost)) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | renewals, policies (expiring and renewed), clients, products, insurance_companies, users |
| Fed by | Renewal pipeline (renewal-pipeline job, Renewal Queue), renewal completion and lapse. Outcome Retained or Lost follows reports.renewal_retained_statuses and reports.renewal_lost_statuses; anything else is Pending. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 6; amounts in PHP):

| Policy No. | Client | Due Date | Outcome | Expiring Premium | Renewal Premium |
|---|---|---|---|---|---|
| OLD-MC-2025-96274 | Mark Dela Cruz | 19 June 2026 | Retained | 39,462.95 | 39,977.30 |
| OLD-MC-2025-17813 | Noel Reyes | 11 July 2026 | Retained | 45,662.83 | 45,557.19 |
| OLD-FI-2025-07528 | Paolo Samonte | 25 July 2026 | Retained | 10,918.05 | 11,245.09 |
| OLD-MC-2025-52877 | Maricel Samonte | 21 August 2026 | Lost | 34,916.38 | - |

Report totals for the period: Expiring Premium PHP 177,233.44; Renewal Premium PHP 147,346.77.

Summary figures returned: Retained: 5; Lost: 1; Pending: 0; Retention rate: 83.33%.

## Remittance Summary

Premium remittances to insurers in the period: gross premium, commission retained and net due, by status.

| Item | Detail |
|---|---|
| Code | `remittance-summary` |
| Menu | Reports > Operational Reports > Remittance |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Status |
| Columns | Remittance No., Date, Insurer, Type, Period, Policies, Gross Premium, Commission, Net Due, Status, Settled, Prepared By, Branch |
| Totals | Policies, Gross Premium, Commission, Net Due |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | remittances, remittance_lines, insurance_companies, users (preparer) |
| Fed by | Remittances created on Accounts > Remittance (Automated Processing, Bulk Processing, Agency Bill Processing, Direct Bill Processing), their approval and settlement. Agent and Branch are those of the user who prepared the remittance. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 22; amounts in PHP):

| Remittance No. | Date | Insurer | Policies | Gross Premium | Commission |
|---|---|---|---|---|---|
| REM-2026-00008 | 07 June 2026 | Luzon Bay Assurance Inc. | 2 | 135,653.75 | 16,485.78 |
| REM-2026-00016 | 08 June 2026 | Pacific Crest Insurance Corp. | 1 | 49,161.47 | 7,165.00 |
| REM-2026-00004 | 09 June 2026 | Harbor Point Non-Life Insurance Inc. | 2 | 1,200,208.08 | 162,903.60 |
| REM-2026-00012 | 09 June 2026 | Mindanao Shield Insurance Corp. | 1 | 87,722.08 | 10,340.52 |

Report totals for the period: Gross Premium PHP 8,909,355.59; Commission PHP 1,211,723.12; Net Due PHP 6,441,739.56.

## Broker Commission Statement

Commission accrued in the period per agent and policy: basis, rate, gross, withholding tax and net, with payment status.

| Item | Detail |
|---|---|
| Code | `commission-statement` |
| Menu | Reports > Operational Reports > Broker Commission |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Agent, Branch, Policy No., Client, Insurer, Product, Period, Accrued, Basis, Rate, Commission, Withholding Tax, Net, Status, Paid, Billing Mode |
| Totals | Basis, Commission, Withholding Tax, Net |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | commissions, policies, clients, products, insurance_companies, users, branches |
| Fed by | Commission accrued at policy issue (one row per agent and policy); status and paid date change when the payout voucher is approved and paid (Accounts > Disbursement > Bulk Disburse). |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 28; amounts in PHP):

| Agent | Policy No. | Basis | Rate | Commission | Withholding Tax |
|---|---|---|---|---|---|
| Maria Consuelo Rivera | POL-2026-00001 | 35,825.00 | 0.05 | 1,791.25 | 89.56 |
| Maria Consuelo Rivera | POL-2026-00032 | 3,250.00 | 0.30 | 975.00 | 48.75 |
| Maria Consuelo Rivera | POL-2026-00011 | 37,690.00 | 0.08 | 2,826.75 | 282.68 |
| Maria Consuelo Rivera | POL-2026-00006 | 4,350.00 | 0.17 | 761.25 | 38.06 |

Report totals for the period: Basis PHP 459,105.54; Commission PHP 59,791.94; Withholding Tax PHP 3,349.34; Net PHP 56,442.60.

## Claims Ageing

Open claims by ageing bucket (optionally per insurer or agent) with estimate and approved amounts.

| Item | Detail |
|---|---|
| Code | `claims-ageing` |
| Menu | Reports > All Reports > Claims Ageing |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Principal Insurer, Agent (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Insurer, Agent, Ageing, Claims, Estimate, Approved, Average Age (days) |
| Totals | Claims, Estimate, Approved |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | claims, policies, insurance_companies, users |
| Fed by | Open claims only (reports.claim_open_statuses), aged from the reported date to today's business date, bucketed by reports.claim_ageing_buckets. |

## Lead Conversion Funnel

Leads created in the period by stage with share and overall conversion rate.

| Item | Detail |
|---|---|
| Code | `lead-conversion-funnel` |
| Menu | Reports > All Reports > Lead Conversion Funnel |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Branch, Source (default Overall) |
| Filters | From Date, To Date, Agent, Branch, Product |
| Columns | Agent, Branch, Source, Stage, Leads, Share % |
| Totals | Leads |
| Summary figures | Conversion rate (converted / all leads) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | leads, users, branches, products |
| Fed by | Prospects created in the period (Prospects screen, leads bulk upload) and their current stage. Stage order follows reports.lead_funnel_stages. |

## Placement Pipeline

Broker slips and placement slips created in the period with status, lead insurer, sum insured, premium and age (open slips by age bucket).

| Item | Detail |
|---|---|
| Code | `placement-pipeline` |
| Menu | Reports > All Reports > Placement Pipeline |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Slip Type, Status, Open by Age, Agent (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Slip, Slip No., Created, Status, Client / Insured, Product, LOB, Lead Insurer, Insurers, Agent, Sum Insured, Premium (best offer / gross), Age (days), Age Bucket |
| Totals | Sum Insured, Premium (best offer / gross) |
| Summary figures | Broker slips, Placement slips, Open, Average age (days) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | broker_slips, insurer_offers, placements, risk_participants, clients, products, insurance_companies, users |
| Fed by | Requests for quotation (broker slips) and placement slips created in the period. Age is frozen when a slip is closed, issued or cancelled. Open statuses and age buckets follow reports.placement_open_statuses and reports.placement_age_buckets. |

## Market Response

Insurers approached on broker slips in the period: offers, declines, pending, response rate, average response days, offers taken and hit ratio (offers taken / offers made).

| Item | Detail |
|---|---|
| Code | `market-response` |
| Menu | Reports > All Reports > Market Response |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Line of Business, Agent (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Product |
| Columns | Insurer, LOB, Agent, Approached, Offers, Declined, Pending, Offers Taken, Response %, Hit Ratio %, Avg Response (days), Premium Offered |
| Totals | Approached, Offers, Declined, Pending, Offers Taken, Premium Offered |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | insurer_offers, broker_slips, insurance_companies, products, users |
| Fed by | Insurers approached on broker slips created in the period (Request for Quotation > Submit / Add insurer) and their recorded answers (offered, declined, pending) and offer selection. |

## Reinsurance Cession Register

Cessions made in the period per treaty and policy: sum insured, ceded sum, ceded premium and share.

| Item | Detail |
|---|---|
| Code | `cession-register` |
| Menu | Reports > All Reports > Reinsurance Cession Register |
| Used by | Processing Team, Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Treaty, Reinsurer, Principal Insurer (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Treaty, Reinsurer, Type, Ceded On, Policy No., Client, Insurer, Sum Insured, Ceded Sum, Ceded Premium, Ceded % |
| Totals | Sum Insured, Ceded Sum, Ceded Premium |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | cessions, reinsurance_treaties, policies, clients, insurance_companies |
| Fed by | Cessions recorded on Reinsurance > Cession Tracking, selected on the cession date. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 2; amounts in PHP):

| Treaty | Reinsurer | Ceded On | Policy No. | Sum Insured | Ceded Sum |
|---|---|---|---|---|---|
| Property Quota Share 2026 | Maharlika Reinsurance Corp. | 03 July 2026 | POL-2026-00051 | 1,015,000,000.00 | 304,500,000.00 |
| Property Quota Share 2026 | Maharlika Reinsurance Corp. | 06 August 2026 | POL-2026-00046 | 196,000,000.00 | 58,800,000.00 |

Report totals for the period: Sum Insured PHP 1,211,000,000.00; Ceded Sum PHP 363,300,000.00; Ceded Premium PHP 662,084.30.

## Co-insurance Register

Co-insured policies incepted in the period: every participating insurer with its role, share, premium, commission, premium taxes and premium due as booked on the bills.

| Item | Detail |
|---|---|
| Code | `coinsurance-register` |
| Menu | Reports > Financial Reports > Co-insurance Register |
| Used by | Accounting (and Accounting Manager), Processing Team, Sales & Marketing; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Co-insurer, Policy, Agent (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Policy No., Inception, Client, Product, Lead Insurer, Insurer, Role, Share %, Sum Insured, Premium, Commission, Premium Taxes, Due to Insurer, Insurer Ref., Agent, Status |
| Totals | Sum Insured, Premium, Commission, Premium Taxes, Due to Insurer |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | risk_participants, policies, receivable_participants, receivables, insurance_companies, clients, products, users |
| Fed by | Co-insured policies (more than one active participant) issued from placement slips or Record Issued Policy, selected on inception date. Amounts are those booked on the policy bills, else the participant row. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 19; amounts in PHP):

| Policy No. | Insurer | Role | Share % | Premium | Commission |
|---|---|---|---|---|---|
| POL-2026-00049 | Harbor Point Non-Life Insurance Inc. | Lead | 50 | 219,305.19 | 25,851.30 |
| POL-2026-00049 | Luzon Bay Assurance Inc. | Co-insurer | 30 | 131,583.12 | 15,510.78 |
| POL-2026-00049 | Mindanao Shield Insurance Corp. | Co-insurer | 20 | 87,722.08 | 10,340.52 |
| POL-2026-00051 | Archipelago General Insurance Co., Inc. | Lead | 50 | 664,760.36 | 94,032.90 |

Report totals for the period: Sum Insured PHP 2,640,500,000.00; Premium PHP 5,724,755.84; Commission PHP 772,241.07; Premium Taxes PHP 1,143,638.68; Due to Insurer PHP 3,793,431.29.

# Financial reports

Financial reports read the receivables, receipts, vouchers and the general ledger. The ledger reports (Trial Balance, Trial Balance (Opening / Movement / Closing), General Ledger Detail, Income Statement, Balance Sheet) read posted journals only, except the Trial Balance, which reads the statuses in `reports.trial_balance_statuses`. Accounts > Period End > Financial Statements opens the same income statement, balance sheet, trial balance and GL detail.

| Report | Menu | Used by |
|---|---|---|
| SOA / Premium Receivable | Reports > Financial Reports > SOA/Premium Receivable | Accounting (and Accounting Manager), Sales & Marketing |
| Collection Report | Reports > Financial Reports > Collection Report | Accounting (and Accounting Manager) |
| Receivables Ageing | Reports > All Reports > Receivables Ageing | Accounting (and Accounting Manager), Sales & Marketing |
| Commission Receivable – Direct Bill | Reports > All Reports > Commission Receivable – Direct Bill | Accounting (and Accounting Manager) |
| Receipts Register | Reports > All Reports > Receipts Register | Accounting (and Accounting Manager) |
| Payables / Disbursement Register | Reports > Financial Reports > Payables | Accounting (and Accounting Manager) |
| Journal Register | Reports > Financial Reports > Journal | Accounting (and Accounting Manager) |
| Trial Balance | Reports > Financial Reports > Trial Balance | Accounting (and Accounting Manager) |
| Incentive Results | Reports > All Reports > Incentive Results | Accounting (and Accounting Manager), Sales & Marketing |
| Due to Insurers by Co-insurer | Reports > Financial Reports > Due to Insurers by Co-insurer | Accounting (and Accounting Manager) |
| Income Statement | Reports > Financial Reports > Income Statement | Accounting (and Accounting Manager) |
| Balance Sheet | Reports > Financial Reports > Balance Sheet | Accounting (and Accounting Manager) |
| Trial Balance (Opening / Movement / Closing) | Reports > Financial Reports > Trial Balance Movement | Accounting (and Accounting Manager) |
| General Ledger Detail | Reports > Financial Reports > General Ledger Detail | Accounting (and Accounting Manager) |
| Aged Payables to Insurers | Reports > Financial Reports > Aged Payables to Insurers | Accounting (and Accounting Manager) |
| Month-End Close Status | Reports > Financial Reports > Month-End Close Status | Accounting (and Accounting Manager) |

## SOA / Premium Receivable

Statement of account: premium bills issued in the period with amount, paid, balance, age and ageing bucket as of To Date.

| Item | Detail |
|---|---|
| Code | `premium-receivable-soa` |
| Menu | Reports > Financial Reports > SOA/Premium Receivable |
| Used by | Accounting (and Accounting Manager), Sales & Marketing; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Client, Bill No., Bill Date, Due Date, Policy No., Insurer, Agent, Branch, Amount, Paid, Balance, Age (days), Ageing, Status |
| Totals | Amount, Paid, Balance |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | receivables, journal_vouchers (bill date), policies, clients, products, insurance_companies, users, branches |
| Fed by | Premium bills raised at policy issue, endorsement and renewal (the bill date is the date of the booking journal), open items loaded at go-live; paid and balance move with official receipts. Ageing uses limits.receivable_ageing_buckets as of To Date. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 57; amounts in PHP):

| Client | Bill No. | Bill Date | Due Date | Amount | Paid |
|---|---|---|---|---|---|
| Ana Ramos | INV-2026-00025 | 10 July 2026 | 29 August 2026 | 46,063.53 | 46,063.53 |
| Andrea Aguilar | INV-2026-00021 | 03 July 2026 | 01 September 2026 | 7,316.88 | 7,316.88 |
| Angelica Evangelista | INV-2026-00004 | 04 September 2026 | 03 November 2026 | 42,307.03 | 42,307.03 |
| Angelica Lim | INV-2026-00022 | 28 September 2026 | 01 January 2027 | 3,757.50 | 3,757.50 |

Report totals for the period: Amount PHP 10,683,995.70; Paid PHP 6,721,773.43; Balance PHP 3,962,222.27.

## Collection Report

Bills due in the period with amount billed, collected (posted receipts up to To Date), balance and collection rate.

| Item | Detail |
|---|---|
| Code | `collections-summary` |
| Menu | Reports > Financial Reports > Collection Report |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Bill No., Bill Date, Due Date, Policy No., Client, Insurer, Agent, Branch, Billed, Collected, Balance, Collection %, Status |
| Totals | Billed, Collected, Balance |
| Summary figures | Collection efficiency (collected / billed, %) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | receivables, receipts, policies, clients, products, insurance_companies, users, branches |
| Fed by | Bills falling due in the period; Collected is the sum of posted official receipts on the bill received up to To Date. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 32; amounts in PHP):

| Bill No. | Due Date | Client | Billed | Collected | Balance |
|---|---|---|---|---|---|
| INV-2026-00024 | 05 June 2026 | Mark Gonzales | 610.40 | 0.00 | 0.00 |
| INV-2026-00010 | 22 June 2026 | Liza Ocampo | 47,817.13 | 47,817.13 | 0.00 |
| INV-2026-00001 | 01 July 2026 | Jerome Mercado | 46,531.22 | 46,531.22 | 0.00 |
| INV-2026-00059 | 04 July 2026 | Liza Ocampo | 2,235.71 | 2,235.71 | 0.00 |

Report totals for the period: Billed PHP 2,989,608.70; Collected PHP 2,543,696.72; Balance PHP 445,301.58.

Summary figures returned: Collection efficiency: 85.08%.

## Receivables Ageing

Outstanding premium receivables as of To Date by ageing bucket (buckets from limits.receivable_ageing_buckets).

| Item | Detail |
|---|---|
| Code | `collections-ageing` |
| Menu | Reports > All Reports > Receivables Ageing (definition screen: Accounts > Collections > Aging Report) |
| Used by | Accounting (and Accounting Manager), Sales & Marketing; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Ageing Bucket, Overall, Agent, Principal Insurer, Branch, Client (default Ageing Bucket) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Client, Bill No., Bill Date, Due Date, Policy No., Insurer, Agent, Branch, Amount, Paid, Balance, Age (days), Ageing, Status |
| Totals | Amount, Paid, Balance |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | receivables, journal_vouchers, policies, clients, products, insurance_companies, users, branches |
| Fed by | Open premium bills (balance above zero, not written off) dated up to To Date, aged from the due date. Buckets: limits.receivable_ageing_buckets. |

Sample from the test system (criteria Ageing Bucket, 01 January 2026 to 30 September 2026, first rows of 12; amounts in PHP):

| Client | Bill No. | Due Date | Balance | Age (days) | Ageing |
|---|---|---|---|---|---|
| Liwayway Printing and Packaging Corp. | INV-2026-00055 | 27 July 2026 | 342,819.14 | 65 | 61-90 |
| Jose Mendoza | INV-2026-00005 | 02 August 2026 | 5,535.38 | 59 | 31-60 |
| Camille Bautista | INV-2026-00030 | 06 August 2026 | 300.40 | 55 | 31-60 |
| Tagumpay Construction Supply Inc. | INV-2026-00049 | 06 August 2026 | 96,646.66 | 55 | 31-60 |

Report totals for the period: Amount PHP 5,012,253.80; Paid PHP 1,050,031.53; Balance PHP 3,962,222.27.

## Commission Receivable – Direct Bill

Commission (with VAT) due from insurers on direct-bill policies, where the client pays the insurer: unbilled, on a debit note, partially collected or collected, with the outstanding share and ageing as of To Date (buckets from limits.receivable_ageing_buckets).

| Item | Detail |
|---|---|
| Code | `direct-bill-commission` |
| Menu | Reports > All Reports > Commission Receivable – Direct Bill (definition screen: Accounts > Remittance > Direct Bill Processing) |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Ageing Bucket, Principle Insurance, Outstanding, Overall (default Ageing Bucket) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Product |
| Columns | Insurer, Policy No., Reference, Insured, Product, Booked, Debit Note, Due Date, Gross Premium, Commission, VAT, Total Due, Outstanding, Age (days), Ageing, Status |
| Totals | Gross Premium, Commission, VAT, Total Due, Outstanding |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | direct_bill_items, commission_debit_notes, policies, endorsements, clients, products, insurance_companies, users |
| Fed by | Direct-bill policies and endorsements (client pays the insurer) create commission items; Direct Bill Processing raises the commission debit note, and insurer collections reduce its balance. The Overall criterion lists items booked in the period; the other criteria list everything still outstanding at To Date. |

## Receipts Register

Official receipts received in the period with bill, policy, payment mode, bank and reference.

| Item | Detail |
|---|---|
| Code | `receipts-register` |
| Menu | Reports > All Reports > Receipts Register (definition screen: Accounts > Receipts) |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch, Payment Mode (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | OR No., Received, Bill No., Policy No., Client, Insurer, Agent, Branch, Mode, Bank, Reference, Amount, Status |
| Totals | Amount |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | receipts, receivables, policies, clients, products, insurance_companies, users, branches, banks |
| Fed by | Official receipts issued on Accounts > Receipts, receipts bulk upload, verified premium payments and online payment links. Selected on the received date. |

## Payables / Disbursement Register

Payment vouchers raised in the period (insurers, agents, clients, vendors) with approval and payment dates.

| Item | Detail |
|---|---|
| Code | `disbursement-register` |
| Menu | Reports > Financial Reports > Payables |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch, Payee Type (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Status |
| Columns | Voucher No., Date, Payee Type, Payee, Purpose, Mode, Bank, Reference, Amount, Status, Approved, Paid, Prepared By, Branch |
| Totals | Amount |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | disbursements, banks, users, insurance_companies, clients |
| Fed by | Payment vouchers created on Accounts > Disbursement (single, bulk upload, Bulk Disburse for referrers), with approval and payment dates. Agent, insurer and client columns are filled according to the payee type. |

## Journal Register

Journal voucher lines dated in the period with account, debit, credit and memo.

| Item | Detail |
|---|---|
| Code | `journal-register` |
| Menu | Reports > Financial Reports > Journal |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch, Account (default Overall) |
| Filters | From Date, To Date, Agent, Branch, Status |
| Columns | JV No., JV Date, Description, Status, Account, Account Name, Debit, Credit, Memo, Prepared By, Branch |
| Totals | Debit, Credit |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, users |
| Fed by | Every journal dated in the period whatever its status (system journals from the posting rules, manual, correction and reversal JVs, recurring and close journals). Filter Status to restrict. |

## Trial Balance

Per account: opening balance before From Date, period debits and credits, and closing debit / credit balance as of To Date (approved and posted JVs).

| Item | Detail |
|---|---|
| Code | `trial-balance` |
| Menu | Reports > Financial Reports > Trial Balance |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Agent, Principal Insurer, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Branch |
| Columns | Type, Statement Group, Branch, Account, Account Name, Opening Balance, Debit, Credit, Closing Debit, Closing Credit |
| Totals | Opening Balance, Debit, Credit, Closing Debit, Closing Credit |
| Summary figures | Balanced (closing debit = closing credit) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, gl_accounts |
| Fed by | Journals with a status in reports.trial_balance_statuses (approved, posted) dated up to To Date. Opening is everything before From Date. Does not read go-live opening balances (use Trial Balance (Opening / Movement / Closing) for that). |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 17; amounts in PHP):

| Account | Account Name | Opening Balance | Debit | Credit | Closing Debit |
|---|---|---|---|---|---|
| 1101001 | Cash on Hand | 0.00 | 166,436.18 | 0.00 | 166,436.18 |
| 1102001 | Cash in Bank – Operating Account | 0.00 | 9,927,367.08 | 2,880,629.78 | 7,046,737.30 |
| 1102002 | Cash in Bank – E-wallet Clearing (GCash) | 0.00 | 122,009.17 | 0.00 | 122,009.17 |
| 1202001 | Premiums Receivable – Direct Clients | 0.00 | 10,683,995.70 | 6,689,954.68 | 3,994,041.02 |

Report totals for the period: Opening Balance PHP 0.00; Debit PHP 23,967,498.75; Credit PHP 23,967,498.75; Closing Debit PHP 11,481,693.20; Closing Credit PHP 11,481,693.20.

Summary figures returned: Balanced: yes.

## Incentive Results

Incentive programme results for programmes active in the period: target, achieved, achievement % and payout per agent.

| Item | Detail |
|---|---|
| Code | `incentive-results` |
| Menu | Reports > All Reports > Incentive Results (definition screen: incentive reports, /incentive/reports) |
| Used by | Accounting (and Accounting Manager), Sales & Marketing; System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Program, Agent, Branch (default Overall) |
| Filters | From Date, To Date, Agent, Branch, Status |
| Columns | Programme, Metric, Period, Agent, Branch, Target, Achieved, Achievement %, Payout, Status |
| Totals | Payout |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | incentive_results, incentive_programs, users, branches |
| Fed by | Incentive calculations of programmes active in the period (Accounts > Incentive > Calculations and Approvals). |

## Due to Insurers by Co-insurer

Premium due to each insurer on bills issued in the period (co-insured bills split per participant, net of that insurer's commission): due, collected from clients, remitted and still held for the insurer.

| Item | Detail |
|---|---|
| Code | `due-to-insurers-by-coinsurer` |
| Menu | Reports > Financial Reports > Due to Insurers by Co-insurer |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Co-insurer, Co-insurer and Policy, Placement (default Co-insurer) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Insurer, Placement, Policy No., Bills, Premium, Commission, Due to Insurer, Collected, Remitted, Held for Insurer, Not yet Collected |
| Totals | Bills, Premium, Commission, Due to Insurer, Collected, Remitted, Held for Insurer, Not yet Collected |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | receivables, receivable_participants, receipt_applications, remittance_allocations, policies, insurance_companies, clients, products, users |
| Fed by | Premium bills (per participant on co-insured bills), receipts applied to them (collected share, pro rata) and remittances to the insurers (remitted). Held for Insurer = collected minus remitted; Not yet Collected = due minus collected. |

Sample from the test system (criteria Co-insurer, 01 January 2026 to 30 September 2026, first rows of 7; amounts in PHP):

| Insurer | Bills | Premium | Commission | Due to Insurer | Collected |
|---|---|---|---|---|---|
| Archipelago General Insurance Co., Inc. | 15 | 4,278,573.68 | 637,329.26 | 3,641,244.42 | 2,159,586.33 |
| Harbor Point Non-Life Insurance Inc. | 19 | 3,340,738.42 | 453,769.25 | 2,886,969.17 | 2,012,887.88 |
| Luzon Bay Assurance Inc. | 14 | 1,647,934.33 | 208,147.14 | 1,439,787.19 | 652,989.69 |
| Mindanao Shield Insurance Corp. | 6 | 509,785.83 | 70,773.85 | 439,011.98 | 439,011.98 |

Report totals for the period: Premium PHP 10,683,995.70; Commission PHP 1,486,526.26; Due to Insurer PHP 9,197,469.44; Collected PHP 5,783,616.68; Remitted PHP 5,042,409.93; Held for Insurer PHP 741,206.75; Not yet Collected PHP 3,413,852.76.

## Income Statement

Revenue and expenses for the period and fiscal year to date (from the fiscal year start of To Date), with the same periods of the prior year. Year-end closing entries are left out; net income is in the summary.

| Item | Detail |
|---|---|
| Code | `income-statement` |
| Menu | Reports > Financial Reports > Income Statement; Accounts > Period End > Financial Statements |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Detailed, Summary (default Detailed) |
| Filters | From Date, To Date, Account |
| Columns | Type, Statement Group, Account, Account Name, Current Period, Year to Date, Prior Year Period, Prior Year to Date |
| Totals | None (amounts are per account or per run) |
| Summary figures | Net income (period, year to date, prior period, prior year to date), Total income, Total expense |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, gl_accounts, fiscal_years |
| Fed by | Posted and reversed journals on income and expense accounts. Year-end closing journals are left out so a closed year still shows its result. |

Sample from the test system (criteria Detailed, 01 January 2026 to 30 September 2026, first rows of 4; amounts in PHP):

| Type | Statement Group | Account | Account Name | Current Period | Year to Date |
|---|---|---|---|---|---|
| income | Revenue | 3201001 | Brokerage Commission Income | 1,505,381.85 | 1,505,381.85 |
| income | Other Income | 3301001 | Interest Income | 4,942.25 | 4,942.25 |
| expense | Operating Expenses | 4401004 | Bank Charges | 750.00 | 750.00 |
| expense | Income Tax | 4601002 | Final Tax on Interest Income | 988.46 | 988.46 |

Summary figures returned: Net income: PHP 1,508,585.64; Net income year to date: PHP 1,508,585.64; Prior net income: PHP 0.00; Prior net income year to date: PHP 0.00; Total income: PHP 1,510,324.10; Total expense: PHP 1,738.46.

## Balance Sheet

Assets, liabilities and equity as of To Date with the balances at the end of the previous fiscal year; income and expense not yet closed show as current year earnings. The summary checks assets = liabilities + equity.

| Item | Detail |
|---|---|
| Code | `balance-sheet` |
| Menu | Reports > Financial Reports > Balance Sheet; Accounts > Period End > Financial Statements |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Detailed, Summary (default Detailed) |
| Filters | From Date, To Date, Account |
| Columns | Type, Statement Group, Account, Account Name, Balance, Prior Year End |
| Totals | None (amounts are per account or per run) |
| Summary figures | Total assets, Total liabilities, Total equity, Total liabilities and equity, Difference (must be 0), Prior year-end totals |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, gl_accounts, fiscal_years |
| Fed by | Posted and reversed journals up to To Date. Income and expense not yet closed appear as one equity line, Current year earnings (not yet closed). |

Sample from the test system (criteria Detailed, 01 January 2026 to 30 September 2026, first rows of 14; amounts in PHP):

| Type | Statement Group | Account | Account Name | Balance | Prior Year End |
|---|---|---|---|---|---|
| asset | Current Assets | 1101001 | Cash on Hand | 166,436.18 | 0.00 |
| asset | Current Assets | 1102001 | Cash in Bank – Operating Account | 7,046,737.30 | 0.00 |
| asset | Current Assets | 1102002 | Cash in Bank – E-wallet Clearing (GCash) | 122,009.17 | 0.00 |
| asset | Current Assets | 1202001 | Premiums Receivable – Direct Clients | 3,994,041.02 | 0.00 |

Summary figures returned: Total assets: PHP 11,479,954.74; Total liabilities: PHP 6,471,369.10; Total equity: PHP 5,008,585.64; Total liabilities and equity: PHP 11,479,954.74; Difference: PHP 0.00; Prior total assets: PHP 0.00; Prior total liabilities and equity: PHP 0.00.

## Trial Balance (Opening / Movement / Closing)

Per account: opening balance at From Date (opening balances of the fiscal year plus earlier movements), debits and credits of the period and the closing balance at To Date, from posted journals.

| Item | Detail |
|---|---|
| Code | `trial-balance-ocm` |
| Menu | Reports > Financial Reports > Trial Balance Movement |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Account Type, Statement Group (default Overall) |
| Filters | From Date, To Date, Account |
| Columns | Account, Account Name, Type, Statement Group, Opening Debit, Opening Credit, Period Debit, Period Credit, Closing Debit, Closing Credit |
| Totals | Opening Debit, Opening Credit, Period Debit, Period Credit, Closing Debit, Closing Credit |
| Summary figures | Balanced, Opening balanced, Net income (closing), Period net income |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | gl_accounts, journal_lines, journal_vouchers, opening_balances (through pe_balance_before) |
| Fed by | Posted and reversed journals; opening balance at From Date includes the fiscal year opening balances (go-live load or year-end carry forward). |

## General Ledger Detail

Per account: the opening balance at From Date, every posted movement of the period with its journal, and the running (closing) balance.

| Item | Detail |
|---|---|
| Code | `gl-detail` |
| Menu | Reports > Financial Reports > General Ledger Detail |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Account, Overall (default Account) |
| Filters | From Date, To Date, Account |
| Columns | Account, Account Name, Date, Period, Journal No., Description, Source, Opening Balance, Debit, Credit, Balance |
| Totals | Debit, Credit |
| Summary figures | Closing balance |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | gl_accounts, journal_lines, journal_vouchers, opening_balances |
| Fed by | Posted and reversed journals of the period, with an opening balance line per account and a running balance. |

## Aged Payables to Insurers

Premiums payable to insurers not yet remitted (open payables) aged from the payable date as of To Date (buckets from limits.receivable_ageing_buckets).

| Item | Detail |
|---|---|
| Code | `aged-payables-insurers` |
| Menu | Reports > Financial Reports > Aged Payables to Insurers |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Ageing Bucket, Principal Insurer, Overall (default Ageing Bucket) |
| Filters | From Date, To Date, Company (principal insurer) |
| Columns | Payable No., Payable Date, Policy No., Insurer, Client, Amount, Outstanding, Age (days), Ageing Bucket, Status |
| Totals | Amount, Outstanding |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | invoice_lists, insurance_companies, clients |
| Fed by | Payable lines to insurer payees entered on the Disbursement screen (invoice lists) that are open or in a voucher and still have an outstanding amount, aged from the date the line was created. |

## Month-End Close Status

Accounting periods overlapping the date range with their status, latest month-end close run, failed checks, generated journals and who prepared and approved the close.

| Item | Detail |
|---|---|
| Code | `month-end-close-status` |
| Menu | Reports > Financial Reports > Month-End Close Status; Accounts > Period End > Month-End Close |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Fiscal Year, Period Status (default Overall) |
| Filters | From Date, To Date |
| Columns | Fiscal Year, Period, No., Start, End, Period Status, Close Run, Run Status, Blocking Failures, Warnings, Journals, Prepared By, Prepared At, Approved By, Approved At, Closed At, Bank Recs Approved / Required |
| Totals | Blocking Failures, Warnings, Journals |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | accounting_periods, period_close_runs, period_close_run_checks, period_close_entries, bank_reconciliations, bank_account_links, users |
| Fed by | Accounting periods (Period Management) and month-end close runs (Month-End Close: execute, sign, submit, approve). |

# Tax reports (BIR)

The BIR reports are working papers prepared from the ledger and the documents: they give the figures and the column layout of the BIR forms and alphalists. They do not produce the BIR DAT files or e-file anything; the CSV or Excel output is the input for the BIR validation module or eFPS preparation. All are under Accounts > Tax and are restricted to Accounting.

| Report | Menu | Used by |
|---|---|---|
| VAT Summary | Accounts > Tax > VAT Summary | Accounting (and Accounting Manager) |
| SAWT - Summary Alphalist of Withholding Taxes | Accounts > Tax > SAWT | Accounting (and Accounting Manager) |
| QAP - Quarterly Alphalist of Payees | Accounts > Tax > QAP | Accounting (and Accounting Manager) |
| SLSP - Summary List of Sales | Accounts > Tax > SLSP Sales | Accounting (and Accounting Manager) |
| SLSP - Summary List of Purchases | Accounts > Tax > SLSP Purchases | Accounting (and Accounting Manager) |

## VAT Summary

Vatable revenue (commission and fees), output VAT and input VAT per month or quarter from the ledger, with the net VAT payable (BIR 2550M / 2550Q working paper).

| Item | Detail |
|---|---|
| Code | `bir-vat-summary` |
| Menu | Accounts > Tax > VAT Summary |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Monthly, Quarterly (default Monthly) |
| Filters | From Date, To Date |
| Columns | Month, Quarter, Vatable Sales / Receipts, Output VAT, Input VAT, Net VAT Payable |
| Totals | Vatable Sales / Receipts, Output VAT, Input VAT, Net VAT Payable |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, gl_accounts |
| Fed by | Posted journals on revenue accounts (account type income, statement group Revenue), the output VAT account (accounting.account.output_vat, default 2204003) and the input VAT account (accounting.account.input_vat, default 1301001). Period-close and year-end-close journals are excluded. |

Sample from the test system (criteria Monthly, 01 January 2026 to 30 September 2026, first rows of 5; amounts in PHP):

| Month | Vatable Sales / Receipts | Output VAT | Input VAT | Net VAT Payable |
|---|---|---|---|---|
| 2026-05 | 217,804.86 | 26,136.59 | 0.00 | 26,136.59 |
| 2026-06 | 94,987.65 | 11,398.52 | 0.00 | 11,398.52 |
| 2026-07 | 357,702.42 | 42,924.30 | 0.00 | 42,924.30 |
| 2026-08 | 415,686.07 | 49,882.33 | 0.00 | 49,882.33 |

Report totals for the period: Vatable Sales / Receipts PHP 1,505,381.85; Output VAT PHP 180,645.85; Input VAT PHP 0.00; Net VAT Payable PHP 180,645.85.

## SAWT - Summary Alphalist of Withholding Taxes

Creditable tax withheld from the broker by insurers (direct-bill commission collections) and clients (receipts) in the period, per payor and ATC, in the BIR SAWT column layout (CSV / Excel for the DAT file preparation).

| Item | Detail |
|---|---|
| Code | `bir-sawt` |
| Menu | Accounts > Tax > SAWT |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Summary (default Summary) |
| Filters | From Date, To Date |
| Columns | SEQ NO, TAXPAYER IDENTIFICATION NUMBER, CORPORATION (Registered Name), INDIVIDUAL (Last Name), First Name, Middle Name, ATC CODE, NATURE OF PAYMENT, RATE OF TAX, AMOUNT OF INCOME PAYMENT, AMOUNT OF TAX WITHHELD |
| Totals | AMOUNT OF INCOME PAYMENT, AMOUNT OF TAX WITHHELD |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | commission_debit_note_collections, commission_debit_notes, insurance_companies, receipt_lines, receipts, clients |
| Fed by | Creditable withholding tax deducted by insurers when they pay a commission debit note (direct bill collections, with the BIR Form 2307 number) and by clients on receipt lines. ATC from bir.sawt_default_atc (default WC139). |

Sample from the test system (criteria Summary, 01 January 2026 to 30 September 2026, first rows of 2; amounts in PHP):

| SEQ NO | TAXPAYER IDENTIFICATION NUMBER | CORPORATION (Registered Name) | ATC CODE | RATE OF TAX | AMOUNT OF INCOME PAYMENT |
|---|---|---|---|---|---|
| 1 | 107-944-920-000 | Luzon Bay Assurance Inc. | WC139 | 10 | 12,956.70 |
| 2 | 449-763-203-000 | Mindanao Shield Insurance Corp. | WC139 | 10 | 7,548.80 |

Report totals for the period: AMOUNT OF INCOME PAYMENT PHP 20,505.50; AMOUNT OF TAX WITHHELD PHP 2,050.55.

## QAP - Quarterly Alphalist of Payees

Expanded withholding tax the broker withheld on payment vouchers in the period, per payee and ATC, in the BIR QAP (1601-EQ attachment) column layout.

| Item | Detail |
|---|---|
| Code | `bir-qap` |
| Menu | Accounts > Tax > QAP |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Summary (default Summary) |
| Filters | From Date, To Date |
| Columns | SEQ NO, TAXPAYER IDENTIFICATION NUMBER, CORPORATION (Registered Name), INDIVIDUAL (Last Name), First Name, Middle Name, ATC CODE, NATURE OF PAYMENT, RATE OF TAX, AMOUNT OF INCOME PAYMENT, AMOUNT OF TAX WITHHELD |
| Totals | AMOUNT OF INCOME PAYMENT, AMOUNT OF TAX WITHHELD |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | disbursements, commission_referrers, insurance_companies, clients, tax_codes |
| Fed by | Approved and paid payment vouchers with withholding tax (referrer payouts, suppliers). ATC per payee type from bir.atc_by_payee; nature of payment from the tax codes master. |

## SLSP - Summary List of Sales

Sales (commission and fees) and output tax per customer and month in the BIR Summary List of Sales layout; the customer of commission is the insurer of the policy.

| Item | Detail |
|---|---|
| Code | `bir-slsp-sales` |
| Menu | Accounts > Tax > SLSP Sales |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Summary (default Summary) |
| Filters | From Date, To Date, Company (principal insurer) |
| Columns | TAXABLE MONTH, TAXPAYER IDENTIFICATION NUMBER, REGISTERED NAME, NAME OF CUSTOMER (Last, First, Middle), CUSTOMER'S ADDRESS, AMOUNT OF GROSS SALES, AMOUNT OF EXEMPT SALES, AMOUNT OF ZERO RATED SALES, AMOUNT OF TAXABLE SALES, AMOUNT OF OUTPUT TAX, AMOUNT OF GROSS TAXABLE SALES |
| Totals | AMOUNT OF GROSS SALES, AMOUNT OF EXEMPT SALES, AMOUNT OF ZERO RATED SALES, AMOUNT OF TAXABLE SALES, AMOUNT OF OUTPUT TAX, AMOUNT OF GROSS TAXABLE SALES |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, gl_accounts, policies, insurance_companies, clients |
| Fed by | Posted journals that carry output VAT: revenue and output tax per customer (the insurer of the policy for commission, else the client) and month. |

Sample from the test system (criteria Summary, 01 January 2026 to 30 September 2026, first rows of 26; amounts in PHP):

| TAXABLE MONTH | TAXPAYER IDENTIFICATION NUMBER | REGISTERED NAME | AMOUNT OF TAXABLE SALES | AMOUNT OF OUTPUT TAX | AMOUNT OF GROSS TAXABLE SALES |
|---|---|---|---|---|---|
| 2026-05 | 107-944-920-000 | Luzon Bay Assurance Inc. | 13,494.15 | 1,619.30 | 15,113.45 |
| 2026-05 | 449-763-203-000 | Mindanao Shield Insurance Corp. | 7,629.56 | 915.55 | 8,545.11 |
| 2026-05 | 632-474-749-000 | Pacific Crest Insurance Corp. | 7,926.25 | 951.15 | 8,877.40 |
| 2026-05 | 929-527-202-000 | Harbor Point Non-Life Insurance Inc. | 188,754.90 | 22,650.59 | 211,405.49 |

Report totals for the period: AMOUNT OF GROSS SALES PHP 1,505,381.85; AMOUNT OF EXEMPT SALES PHP 0.00; AMOUNT OF ZERO RATED SALES PHP 0.00; AMOUNT OF TAXABLE SALES PHP 1,505,381.85; AMOUNT OF OUTPUT TAX PHP 180,645.85; AMOUNT OF GROSS TAXABLE SALES PHP 1,686,027.70.

## SLSP - Summary List of Purchases

Purchases and input tax per supplier and month in the BIR Summary List of Purchases layout, from the input VAT booked in the ledger.

| Item | Detail |
|---|---|
| Code | `bir-slsp-purchases` |
| Menu | Accounts > Tax > SLSP Purchases |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Summary (default Summary) |
| Filters | From Date, To Date |
| Columns | TAXABLE MONTH, TAXPAYER IDENTIFICATION NUMBER, REGISTERED NAME, NAME OF SUPPLIER (Last, First, Middle), SUPPLIER'S ADDRESS, AMOUNT OF GROSS PURCHASE, AMOUNT OF EXEMPT PURCHASE, AMOUNT OF ZERO-RATED PURCHASE, AMOUNT OF TAXABLE PURCHASE, AMOUNT OF PURCHASE OF SERVICES, AMOUNT OF PURCHASE OF CAPITAL GOODS, AMOUNT OF PURCHASE OF GOODS OTHER THAN CAPITAL GOODS, AMOUNT OF INPUT TAX, AMOUNT OF GROSS TAXABLE PURCHASE |
| Totals | AMOUNT OF GROSS PURCHASE, AMOUNT OF EXEMPT PURCHASE, AMOUNT OF ZERO-RATED PURCHASE, AMOUNT OF TAXABLE PURCHASE, AMOUNT OF PURCHASE OF SERVICES, AMOUNT OF PURCHASE OF CAPITAL GOODS, AMOUNT OF PURCHASE OF GOODS OTHER THAN CAPITAL GOODS, AMOUNT OF INPUT TAX, AMOUNT OF GROSS TAXABLE PURCHASE |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | journal_lines, journal_vouchers, disbursements, commission_referrers, insurance_companies |
| Fed by | Posted journals on the input VAT account; the taxable purchase is the input tax divided by tax.vat_rate. Supplier from the payment voucher payee, else the journal description. |

## BIR Form 2307 (issued and received)

**Menu:** Accounts > Tax > BIR Form 2307. **Permission:** `read:period-end` (or `read:journal-vouchers`) to view; issuing and cancelling certificates need `write:period-end`. **Used by:** Accounting.

The screen works per quarter and in two directions:

- **Issued**: payees from whom the broker withheld tax on payment vouchers (agents, referrers, suppliers). The broker issues their Form 2307.
- **Received**: payors who withheld tax from the broker (insurers paying commission debit notes, clients on receipts). The broker collects their Form 2307 and claims the credit (these lines also feed the SAWT).

| Function | What it does |
|---|---|
| List | Payees or payors with creditable withholding in the quarter: name, TIN, number of transactions, total income, total tax, ATCs, certificate number when issued. |
| Print | The Form 2307 data of one payee and quarter: per ATC the income of each month of the quarter, the total and the tax withheld. |
| Issue | Numbers the certificate with the CWT series and records it; issuing again returns the same certificate. |
| Certificates | Register of issued certificates (filter year, quarter, direction). |
| Cancel | Cancels an issued certificate so that a corrected one can be issued. |

Settings used: `bir.withholding_agent_tin`, `bir.registered_name`, `bir.registered_address`, `bir.zip_code`, `bir.atc_by_payee`, `bir.sawt_default_atc`. Source tables: `disbursements`, `commission_debit_note_collections`, `receipt_lines`, `tax_codes`, `bir_2307_certificates`.

Sample from the test system (direction Received, third quarter 2026):

| Payor | TIN | Transactions | Income | Tax withheld | ATC |
|---|---|---|---|---|---|
| Luzon Bay Assurance Inc. | 107-944-920-000 | 1 | 12,956.70 | 1,295.67 | WC139 |
| Mindanao Shield Insurance Corp. | 449-763-203-000 | 1 | 7,548.80 | 754.88 | WC139 |

## Monthly and quarterly tax calendar

The table maps each report to the BIR return it supports. The filing deadlines are those of the BIR, not settings of the system; confirm them with the tax adviser.

| BIR return or attachment | Report to run | Period to enter |
|---|---|---|
| 2550M / 2550Q VAT return | VAT Summary (Monthly or Quarterly) | The month or quarter |
| SLSP (sales and purchases) | SLSP - Summary List of Sales; SLSP - Summary List of Purchases | The quarter |
| 1601-EQ with QAP | QAP - Quarterly Alphalist of Payees | The quarter |
| Income tax return with SAWT | SAWT - Summary Alphalist of Withholding Taxes | The quarter |
| Form 2307 to payees | BIR Form 2307, direction Issued | The quarter |
| Form 2307 from insurers and clients | BIR Form 2307, direction Received | The quarter |

# Reconciliation reports

Reconciliation reports support the monthly bank reconciliation and the reconciliation of insurer statements. The bank reports read the bank statement lines, the matches and the book view `bank_book_lines` (the cash GL lines of each bank account with the date they cleared). All are under Accounts > Bank Reconciliation and restricted to Accounting.

| Report | Menu | Used by |
|---|---|---|
| Bank Reconciliation Statement | Accounts > Bank Reconciliation > Reconciliation Statement Report | Accounting (and Accounting Manager) |
| Outstanding Cheques | Accounts > Bank Reconciliation > Outstanding Cheques | Accounting (and Accounting Manager) |
| Deposits in Transit | Accounts > Bank Reconciliation > Deposits in Transit | Accounting (and Accounting Manager) |
| Unmatched Bank Lines | Accounts > Bank Reconciliation > Unmatched Bank Lines | Accounting (and Accounting Manager) |
| Bank Book | Accounts > Bank Reconciliation > Bank Book | Accounting (and Accounting Manager) |

## Bank Reconciliation Statement

Bank reconciliation runs with an as-of date in the range: balance per bank statement, deposits in transit, outstanding cheques and bank errors (adjusted bank balance); balance per books, bank credits and charges not yet booked and book errors (adjusted book balance); the difference must be zero to approve.

| Item | Detail |
|---|---|
| Code | `bank-reconciliation-statement` |
| Menu | Accounts > Bank Reconciliation > Reconciliation Statement Report |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Bank Account (default Overall) |
| Filters | From Date, To Date, Status, Bank Account |
| Columns | Reconciliation No., Bank Account, Account Name, GL Account, Period, As of, Status, Balance per Bank, Deposits in Transit, Outstanding Cheques, Bank Errors, Adjusted Bank Balance, Balance per Books, Bank Credits not Booked, Bank Charges not Booked, Book Errors, Adjusted Book Balance, Difference, Prepared By, Prepared At, Approved By, Approved At |
| Totals | None (amounts are per account or per run) |
| Summary figures | Reconciled (approved runs), Not agreed (difference not zero) |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | bank_reconciliations, bank_account_links, users |
| Fed by | Reconciliation runs (BRC numbers) prepared and approved on Accounts > Bank Reconciliation > Reconciliations, selected on the as-of date. |

Sample from the test system (criteria Overall, 01 January 2026 to 30 September 2026, first rows of 5; amounts in PHP):

| Reconciliation No. | Bank Account | Period | Status | Balance per Bank | Deposits in Transit |
|---|---|---|---|---|---|
| BRC-2026-00001 | BDO-OPS | 2026-05 | approved | 4,966,477.84 | 4,070.63 |
| BRC-2026-00002 | BDO-OPS | 2026-06 | approved | 3,836,761.73 | 0.00 |
| BRC-2026-00003 | BDO-OPS | 2026-07 | approved | 5,191,563.09 | 0.00 |
| BRC-2026-00004 | BDO-OPS | 2026-08 | approved | 6,227,930.85 | 0.00 |

Summary figures returned: Reconciled: 5; Not agreed: 0.

## Outstanding Cheques

Payments recorded in the books (cheques, transfers) on or before To Date that have not cleared the bank as of To Date, aged; cheques older than bank_reconciliation.stale_cheque_days are stale.

| Item | Detail |
|---|---|
| Code | `bank-outstanding-cheques` |
| Menu | Accounts > Bank Reconciliation > Outstanding Cheques |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Bank Account, Status (default Overall) |
| Filters | From Date, To Date, Bank Account |
| Columns | Bank Account, GL Account, Date, Journal No., Document, Document No., Cheque No., Payee, Description, Amount, Age (days), Status |
| Totals | Amount |
| Summary figures | Stale count, Stale amount |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | bank_book_lines (view of the cash GL lines with their clearing date) |
| Fed by | Payments posted to a bank cash account (payment vouchers, other credits) on or before To Date not yet cleared by a bank statement match. Older than bank_reconciliation.stale_cheque_days (default 180) shows as Stale. |

## Deposits in Transit

Collections recorded in the books (official receipts, other debits to the bank account) on or before To Date that have not reached the bank statement as of To Date.

| Item | Detail |
|---|---|
| Code | `bank-deposits-in-transit` |
| Menu | Accounts > Bank Reconciliation > Deposits in Transit |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Bank Account (default Overall) |
| Filters | From Date, To Date, Bank Account |
| Columns | Bank Account, GL Account, Date, Journal No., Document, Document No., Reference, Payer, Description, Amount, Age (days) |
| Totals | Amount |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | bank_book_lines |
| Fed by | Official receipts and other debits to a bank cash account on or before To Date not yet matched to the bank statement. |

## Unmatched Bank Lines

Bank statement lines dated in the range that are not matched to the books as of To Date, with the suggested bank transaction type (bank charges, interest, returned cheques, direct credits).

| Item | Detail |
|---|---|
| Code | `bank-unmatched-lines` |
| Menu | Accounts > Bank Reconciliation > Unmatched Bank Lines |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Bank Account, Suggested Type (default Overall) |
| Filters | From Date, To Date, Bank Account |
| Columns | Bank Account, Statement No., Date, Value Date, Description, Reference, Debit, Credit, Net, Suggested Type, Status, Age (days) |
| Totals | Debit, Credit, Net |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | bank_statement_lines, bank_statements, bank_account_links, bank_transaction_types, bank_rec_matches, bank_rec_match_items |
| Fed by | Imported or manually entered bank statement lines not matched (or matched after To Date), with the suggested bank transaction type. |

## Bank Book

GL detail of each bank account's cash-in-bank account: opening balance at From Date, every posted receipt, payment and journal with its source document, the running balance and whether it has cleared the bank.

| Item | Detail |
|---|---|
| Code | `bank-book` |
| Menu | Accounts > Bank Reconciliation > Bank Book |
| Used by | Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Bank Account, Overall (default Bank Account) |
| Filters | From Date, To Date, Bank Account |
| Columns | Bank Account, GL Account, Date, Journal No., Document, Document No., Cheque No., Payee / Payer, Description, Opening Balance, Debit, Credit, Balance, Reconciled |
| Totals | Debit, Credit |
| Summary figures | Closing balance |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | bank_account_links, bank_book_lines, opening_balances |
| Fed by | Every posted receipt, payment and journal on the cash account linked to each bank account, with a running balance and whether it has cleared. |

Sample from the test system (criteria Bank Account, 01 January 2026 to 30 September 2026, first rows of 78; amounts in PHP):

| Bank Account | Date | Journal No. | Document No. | Payee / Payer | Debit |
|---|---|---|---|---|---|
| BDO-OPS | 01 January 2026 | - | - | - | - |
| BDO-OPS | 18 May 2026 | JV-2026-00063 | OR-2026-00001 | Jerome Mercado | 46,531.22 |
| BDO-OPS | 21 May 2026 | JV-2026-00105 | OR-2026-00043 | Himlayan Cold Storage Corp. | 980,902.89 |
| BDO-OPS | 29 May 2026 | JV-2026-00101 | OR-2026-00039 | Silangan Retail Holdings Inc. | 438,610.39 |

Report totals for the period: Debit PHP 6,427,367.08; Credit PHP 2,880,629.78.

Summary figures returned: Closing balance: PHP 3,546,737.30.

## Bank Reconciliation Statement (PDF and preview)

Besides the catalogue report, each reconciliation run prints as a PDF from Accounts > Bank Reconciliation > Reconciliations > Reconciliation statement (`/api/bank-reconciliation/reconciliations/:id/pdf`), and the workspace shows a statement as of any date without a run (`/api/bank-reconciliation/statement-preview`). Permission `read:bank-reconciliation`.

## Insurer statement differences report

**Menu:** Accounts > Insurer Reconciliation > Insurer Statements > (statement) > Differences report. **Permission:** `read:remittance`. **Outputs:** Excel (reconciliation and summary sheets, default), CSV, PDF.

After an insurer's statement (premium remittance confirmation or commission statement) is imported and matched, the differences report lists every line with the insurer's and the broker's figures side by side.

| Columns |
|---|
| Line, Policy No, Insured, Date, Reference, Status, Insurer gross premium, Broker gross premium, Premium difference, Insurer commission, Broker commission, Commission difference, Insurer amount paid, Broker amount, Amount difference, Broker record, Resolution |

Source tables: `insurer_statements`, `insurer_statement_lines`, `insurer_statement_resolutions`, `remittance_lines`, `commission_debit_notes`. Fed by the statement import (Batch Processes document) and the resolutions entered on the screen.

## Remittance Ageing (premium held for insurers)

**Menu:** Accounts > Credit Control > Remittance Ageing. **Permission:** `read:collections` or `read:remittance`. **Outputs:** screen, Excel, CSV (`format=xlsx` or `csv`).

Premium collected from clients and not yet remitted to the insurer, aged on the insurer's remittance terms (the insurer master field Remittance Terms, days after collection). Filters: insurer, as-of date, overdue only.

## Remittance and reinsurance reconciliation screens

- Accounts > Remittance > Reconciliation: imports bank transactions (Remittance_Bank_Transactions_Template) and matches them to remittances.
- Reinsurance > Reconciliation: premium and claims bordereaux by period (see chapter 10).

# Management reports

Management reports summarise production for the executive view. Chapter 9 also covers the dashboards, which are screens with figures and charts rather than catalogue reports.

| Report | Menu | Used by |
|---|---|---|
| Premium by Product / Month / Insurer | Reports > All Reports > Premium by Product / Month / Insurer | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager) |
| New Business vs Renewals | Reports > All Reports > New Business vs Renewals | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager) |

## Management catalogue reports

### Premium by Product / Month / Insurer

Policy count, sum insured, premium and commission by month, product and insurer (criteria picks the dimension).

| Item | Detail |
|---|---|
| Code | `premium-by-product` |
| Menu | Reports > All Reports > Premium by Product / Month / Insurer (definition screen: Dashboard > Executive Dashboard > Reports) |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Product, Month, Principal Insurer (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Month, Product, Insurer, Policies, Sum Insured, Gross Premium, Commission |
| Totals | Policies, Sum Insured, Gross Premium, Commission |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | policies, products, insurance_companies, users, branches, clients |
| Fed by | Same rows as the Production Register (policies by inception date), summed by month, product and insurer. |

### New Business vs Renewals

Policies and premium split into new business and renewals per month (or per agent).

| Item | Detail |
|---|---|
| Code | `new-vs-renewal` |
| Menu | Reports > All Reports > New Business vs Renewals (definition screen: Dashboard > Executive Dashboard > Reports) |
| Used by | Sales & Marketing, Processing Team, Operations (Client Servicing), Claims, Accounting (and Accounting Manager); System Administrator |
| Permission | `read:reports` and one of the roles above |
| Report Criteria | Overall, Business Type, Agent (default Overall) |
| Filters | From Date, To Date, Agent, Company (principal insurer), Branch, Client, Product, Status |
| Columns | Month, Agent, Business Type, Policies, Gross Premium, Commission |
| Totals | Policies, Gross Premium, Commission |
| Outputs | Screen, Excel, CSV, PDF; scheduled e-mail |
| Source tables | policies, products, insurance_companies, users, branches, clients |
| Fed by | Same rows as the Production Register; a policy is a renewal when it was renewed from an earlier policy. |

## Dashboards

Dashboards are screens with figures and charts. They read live data each time they open and have no file output, except the Claims Dashboard export.

### Executive Dashboard

**Menu:** Dashboard > Executive Dashboard. **Permission:** `read:reports`. **Period:** month, quarter or year.

KPIs with target and achievement: total revenue (premium), active policies, new business, claims ratio, retention rate and customer satisfaction (shows "No survey data captured": the system holds no survey data). Charts: premium by product, monthly trend, regions, products, agents. Targets come from the setting `dashboard.targets` (OOTB: total revenue PHP 5,000,000.00, active policies 250, new business PHP 2,000,000.00, claims ratio 70, retention rate 90, customer satisfaction 95).

Test system, period year: total revenue PHP 15,204,363.59 against a target of PHP 5,000,000.00 (304.1%); active policies 68 against 250; claims ratio 7 against 70; retention rate 85.7 against 90.

### Sales Dashboard

**Menu:** Dashboard > Sales Dashboard. **Permission:** `read:leads` or `read:quotations`. Prospects, new and converted prospects, quotations, quoted premium, policies, premium, prospect and quotation conversion rates, pipeline by stage, figures by sales person, premium by product, monthly trend, for a month, quarter, year or a date range. Roles limited to their own book (Sales & Marketing) see only their own figures; others see the whole book or pick one sales person.

Test system, year to date: 61 prospects, 72 quotations (quoted premium PHP 15,252,579.67), 68 policies, premium PHP 15,204,363.59, prospect conversion 88.5%, quotation conversion 91.7%, pipeline 2 quotations worth PHP 105,322.24.

The Operations > Home page (Account Executive) uses `/api/agent/get-dashboard-details`: own funnel, premium this month, renewals due within `dashboard.renewals_due_days` (60), recent quotations and expiring policies.

### Processing Dashboard

**Menu:** Dashboard > Processing Dashboard. **Permission:** `read:quotations`. New and older submissions, average cycle time, data-quality alerts (duplicate submission, missing dates, missing LOB), the cases awaiting the customer or the insurer with priority (high from `dashboard.high_sum_insured`, PHP 5,000,000.00), and volume by LOB.

### Claims Dashboard

**Menu:** Dashboard > Claims Dashboard (and Operations > Claims > Claims Dashboard). **Permission:** `read:claims`. Total claims, settled amount, average days to settle, claims and estimates by status. Test system: 8 claims, PHP 1,097,750.00 settled, 29.75 days on average to settle. The operations version (`/api/claims/report`, permission `read:claims` or `read:reports`) adds breakdowns, ageing and detailed rows and downloads them as Excel.

### Commission Dashboard

**Menu:** Commission > Commission Dashboard. **Permission:** `read:commission` or `read:quotations`. Brokerage income, sub-agent commission (comsub) gross, net margin and margin %, outstanding payable, withholding tax withheld and paid, comsub by referrer and by product, brokerage by insurer, payout lines by status (Accrued, Eligible, Approved, Paid), clawbacks and monthly trend.

### Collections dashboard and ageing

**Menu:** Accounts > Collections. **Permission:** `read:collections` or `read:receipts`. KPIs: total outstanding, items, overdue count and amount, committed, escalated, collected this month, and items by status. The Aging report on the same screen gives bucket totals and percentages (current, 1-30, 31-60, 61-90, over 90) with the open items. Test system: outstanding PHP 4,251,087.52 on 18 items, of which PHP 445,301.58 overdue.

### Renewal performance and retention analytics

**Menu:** Operations > Renewals > Performance and Retention Analytics; Renewal Queue (counters); At-Risk Policies. **Permission:** `read:renewals`. Renewal rate, premium retention, cycle time, by product, by agent and monthly trend; at-risk renewals with risk score, factors and recommended actions (weights and bands in the `renewals.risk_*` settings).

### Remittance Analytics

**Menu:** Accounts > Remittance > Analytics. **Permission:** `read:remittance`. KPIs with targets (settlement efficiency, payment success rate, average processing time, exception rate), top insurers, monthly trend and status distribution.

### Reinsurance Treaty Dashboard and Analytics

**Menu:** Reinsurance > Treaty Dashboard; Reinsurance > Analytics. **Permission:** `read:reinsurance`. Treaty utilisation, loss-ratio trend (gross and net by month), retention and cession, recovery performance and catastrophe exposure.

### Product Configurator Dashboard and Product Analytics

**Menu:** Product Configurator > Dashboard; Product Configurator > Product Analytics. **Permission:** `read:products`. Template counts, categories, components, recent and expiring templates; top products, performance trend and category breakdown from issued policies and claims.

# Module exports and printed registers

These outputs are produced on the module screens. They are not in the report catalogue, so the catalogue role check and the report schedules do not apply to them.

| Output | Menu | Format | Permission | Content |
|---|---|---|---|---|
| Claims dashboard report | Operations > Claims > Claims Dashboard > Export Report | Excel | `read:claims` or `read:reports` | Detailed claim rows for a start and end date. |
| Claims by criteria | API only: `/api/claims/reports/criteria` (the menu entry Reports > Operational Reports > Claims opens the catalogue Claims Position) | Excel (or JSON) | `read:claims` | All, Open, Settled, Rejected or Aging. |
| Lead report | Operations > Sales & Marketing > Prospects > Generate Report | Excel or CSV | `read:leads` | Prospects of a status or quotation-status category. |
| Accounting entries export | Accounts > Accounting Query > Export | CSV | `read:journal-vouchers`, `read:receipts` or `read:disbursements` | Entries matching the search filters (dates, account, reference). |
| Renewal batch report | Operations > Renewals > Renewal Batch > Generate Report | Excel or CSV | `read:renewals` | Policies of the batch with notice and quote status. |
| Remittance statement | Accounts > Remittance > Statements > Generate | CSV (optionally e-mailed as a link) | `read:remittance` / `write:remittance` | Transaction Date, Remittance No, Policy Number, Insured Name, Insurer, Premium, Commission, Taxes, Net Amount, Status for a period and insurers. |
| Reinsurance bordereaux | Reinsurance > Treaty Dashboard > Generate Report > Bordereau; Reinsurance > Reconciliation | CSV | `read:reinsurance` / `write:reinsurance` | Premium bordereau (confirmed cessions) or claims bordereau (recoveries) for a period. |
| Reinsurance reports | Reinsurance > Treaty Dashboard > Generate Report | CSV | `write:reinsurance` | Templates Monthly Premium Bordereau (RPT001), Quarterly Claims Report (RPT002), Annual Treaty Performance (RPT003), IC Quarterly Submission (RPT004). |
| Incentive reports | Incentive reports screen (address /incentive/reports; no menu entry) | CSV | `write:incentive` | Templates Monthly Payout Summary, Agent Payout Details, Target Achievement Report, Top Performers, Program Effectiveness. |
| Incentive statement | Accounts > Incentive > Statement | Screen | `read:incentive` or `read:profile` (own statement) | An agent's incentive statement for a period. |
| Official receipts print | Accounts > Receipts > Bulk print / Print | PDF, one receipt per page | `read:receipts` | One receipt, or a customer code and date range. |
| Payment vouchers print | Accounts > Disbursement > Bulk print | PDF, one voucher per page | `read:disbursements` | One voucher, or a customer code and date range. |

## Regulatory outputs (Insurance Commission)

The OOTB system has no Insurance Commission statement in the prescribed IC format. The reinsurance report template **IC Quarterly Submission** (RPT004, type Regulatory) exists, but the generator treats every template that is not of type Premium or Claims the same way: it writes the list of treaties (treaty number, name, type, LOB, status, dates, premium ceded, claims recovered, utilisation, security rating) as CSV, without a period filter. Treat it as a working list, not as a filing.

For the broker's own statutory reporting, the Income Statement, Balance Sheet, Trial Balance (Opening / Movement / Closing) and the production, claims and remittance registers give the figures an IC or audit schedule needs; the schedules themselves are prepared outside the system.


# Report settings and administration

## Settings

All settings are on Master > Configuration, area Reports & Dashboards, unless shown otherwise.

| Setting | OOTB value | Effect |
|---|---|---|
| `reports.default_format` | xlsx | File format when none is chosen. |
| `reports.default_page_size` | 50 | Rows per page on screen. |
| `reports.default_range_days` | 365 | Days covered when a run has no From Date. |
| `reports.max_rows` | 50000 | Maximum rows written to a file. |
| `reports.download_link_ttl_hours` | 72 | Validity of download links. |
| `reports.retention_days` | 90 | Generated files are deleted after this many days. |
| `reports.pdf_page_size` | A4 | PDF page size (A4 or LETTER). |
| `reports.email_subject`, `reports.email_body` | see Communication Templates | Scheduled report e-mail. |
| `reports.claim_ageing_buckets` | 30, 60, 90, 180 | Claim ageing buckets. |
| `reports.claim_open_statuses` | registered, in-review, pending-approval, approved | Open claims. |
| `reports.claim_settled_statuses` | settled, closed | Settled claims. |
| `reports.claim_rejected_statuses` | rejected | Rejected claims. |
| `reports.renewal_retained_statuses` / `reports.renewal_lost_statuses` | renewed / lapsed | Renewal outcome. |
| `reports.lead_funnel_stages` | new, contacted, qualified, quoted, converted, lost | Funnel order. |
| `reports.placement_age_buckets` | 7, 14, 30, 60 | Placement pipeline buckets. |
| `reports.placement_open_statuses` | draft, submitted, responses-in, sent, bound, declined | Open slips. |
| `reports.trial_balance_statuses` | approved, posted | Journals in the Trial Balance. |
| `limits.receivable_ageing_buckets` (area Security & Access, Limits) | 30, 60, 90, 120 | Receivable and payable ageing buckets. |
| `bank_reconciliation.stale_cheque_days` | 180 | Stale cheque threshold. |
| `accounting.account.output_vat` / `accounting.account.input_vat` | 2204003 / 1301001 | VAT accounts read by the tax reports. |
| `bir.sawt_default_atc`, `bir.atc_by_payee` | WC139, per payee type | ATC on the alphalists. |
| `dashboard.targets`, `dashboard.renewals_due_days`, `dashboard.high_sum_insured` | see chapter 9 | Dashboard targets and windows. |

## Adding or changing a report

Reports are configuration plus a query. To add one, the support team writes the base query in `backend/src/modules/reports/queries.js` (period as `$1` and `$2`, the standard dimension columns for filtering), adds a `report_definitions` row in a migration or seed (code, name, category, screen, query name, parameters, default columns with types, roles), and adds a test in `backend/test/reports.test.js`. The catalogue test fails when a definition names a query that does not exist. To hide a report, set its `status` to anything other than `active`; to change who sees it, change its `roles` or `permission`.

## Troubleshooting

| Symptom | Check |
|---|---|
| A user does not see a report in All Reports | The user needs `read:reports` and, when the report lists roles, one of them. |
| "Report X has no query named Y" | The definition and `queries.js` disagree; correct `query_name`. |
| A download link says it has expired | Links last 72 hours; the file stays in `generated_reports` for 90 days. Generate again or sign a new link. |
| A scheduled report did not arrive | Master > Schedules > Run history of job `report-<id>`, then Master > E-mail Outbox. E-mail leaves only when `notification.email_enabled` is on and SMTP is configured. |
| Trial Balance and Trial Balance (Opening / Movement / Closing) differ | The first reads approved and posted journals and no opening balances; the second reads posted journals and the fiscal-year opening balances. |
| Ageing looks one day off | Ageing uses the business date in Asia/Manila. Check `general.timezone`. |


# Gaps and observations

The following points were found while preparing this book. They are recorded so that the broker and the support team can decide on them; none of them stops the reports from running.

| No. | Observation | Effect | Suggested action |
|---|---|---|---|
| 1 | No front-end screen for report schedules and for the generated-file history (API only). | Users cannot set up e-mailed reports themselves. | Add Reports > Schedules and Reports > Generated reports screens, or have the administrator create schedules through the API. |
| 2 | Scheduled report e-mails carry a download link, not the file. | Recipients need the link within 72 hours. | Keep `reports.download_link_ttl_hours` in line with how recipients work. |
| 3 | No Insurance Commission report in the prescribed format; the IC Quarterly Submission template writes the treaty list. | IC returns are prepared outside the system. | Specify the IC schedules required and add them as catalogue reports. |
| 4 | Remittance report templates (Daily Remittance Summary, Monthly Commission Analysis) produce the same statement CSV; the sections, pivots and PDF / Excel formats in the templates are not applied. Remittance statement templates STM-001 (PDF) and STM-002 (Excel) also produce CSV. | Output differs from the template description. | Use the catalogue Remittance Summary for formatted output, or extend the generator. |
| 5 | Reinsurance report templates are not filtered by period. | Every run lists all confirmed cessions, recoveries or treaties. | Filter the CSV, or use the bordereau screen, which takes a period. |
| 6 | The Trial Balance report does not include go-live opening balances. | It differs from Trial Balance (Opening / Movement / Closing) in the year of go-live. | Use Trial Balance (Opening / Movement / Closing) for statutory work. |
| 7 | The BIR reports are working papers; no DAT file is produced. | The DAT file is prepared with the BIR tools from the CSV / Excel output. | None in the OOTB scope. |
| 8 | The report definition of the Trial Balance names the screen "Trail Balance" (and the route `/reports/financialreports/trailbalance`); the menu shows "Trial Balance". | Cosmetic. | Correct the screen text in the definition. |
