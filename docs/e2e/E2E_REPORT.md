# BrokerVerse end-to-end test report

Manual, screen-by-screen run of the full broking cycle on the production build of `brokerverse/` with the
`backend/` API and PostgreSQL. Every step was entered through the screens as the persona who does the job, and
each result was checked in the database, the ledger, the dashboards and the reports. Defects are in
[DEFECTS.md](DEFECTS.md); screenshots are in [evidence/](evidence/).

Environment: Chromium 1600 x 1000, Asia/Manila business time, currency PHP with Philippine number grouping.

## Personas

| User | Persona | Role |
|---|---|---|
| BrokerVerse | Administrator | it-admin |
| bea.admin | Business Administrator | ba |
| maria.sales | Sales / Relationship Manager | sales |
| ramon.agent | Agent / Referrer | agent |
| jose.uw | Underwriter | underwriting |
| ana.cs | Customer Services | customer-services |
| carlo.claims, lisa.claims2 | Claims Officers (maker and checker) | claims |
| liza.finance, fe.approver | Finance / Accounts (maker and checker) | finance |
| carmela.morfe and five others | User Access Administrators | user-access-admin |

## Results by step

| # | Step | Persona | Result | Evidence |
|---|---|---|---|---|
| 1-2 | Sign-in; create persona users through Master > User Management | BrokerVerse | Pass after fix D1 (15/15) | |
| 3-5 | Lead LD-2026-00001 with validations; agent dashboard funnel | ramon.agent | Pass | |
| 6-8 | Quote QT-2026-00001 (MAPFRE, Toyota Rav4): net 28,005.00, VAT 3,360.60, DST 3,500.63, LGT 210.04, gross 35,076.27 — server re-priced with the configured rates | ramon.agent | Pass | |
| 9 | Customer approval through the e-mailed link | client | Pass | |
| 10 | Convert to policy POL-2026-00001; documents and photos stored | ramon.agent | Pass (D18, D23 open) | |
| 11 | Downstream: dashboard +1 policy / +35,076.27; production register; receivable INV-2026-00001 with booking journal and collection item; commission 4,200.75 accrued | - | Pass after fix D22 | |
| 12 | Receipts: 2,000 partial (OR-2026-00020), 4,000 refused, 3,010 balance (OR-2026-00021); bill Paid, collection item closed | liza.finance | Pass after fix D58 | 12-receipt-* |
| 13 | Commission payout PV-2026-00022: gross 4,200.75, WHT 210.04, net 3,990.71; maker refused; approved by fe.approver; JV Dr commission payable / Cr cash / Cr WHT, balanced | liza.finance, fe.approver | Pass after fixes D29-D34 | 13-payout-* |
| 14 | Remittance to MAPFRE: bill REM-2026-00018 net 30,875.52; maker refused, approved by fe.approver; settlement SET-2026-00002 approved; insurer voucher PV-2026-00023 raised, cheque approved and printed; JV Dr premium payable / Cr cash; payable and receivable for the policy both nil | liza.finance, fe.approver | Pass after fixes D35-D39 | 14-* |
| 15 | Endorsements: address change END-2026-00002 updated the client; cover change END-2026-00003 re-priced to gross 40,086.27 and billed +5,010.00 (INV-2026-00002, JV 5,010 / 4,410 / 600, collection item) | ana.cs | Pass after fixes D41-D47 | 15-* |
| 16-17 | Claim refused for a loss date outside the policy period; CLM-2026-00002 registered (loss 28 Sep, collision, estimate 85,000); settlement 78,500 by carlo.claims, maker refused, approved by lisa.claims2; claims report and dashboard updated | carlo.claims, lisa.claims2 | Pass after fixes D48-D54 | 16-* |
| 18 | Journal voucher: unbalanced refused (screen and API); JV-2026-00106 submitted and approved/posted by fe.approver; trial balance balanced | liza.finance, fe.approver | Pass after fixes D55-D56 | 18-* |
| 19 | Schedules run: renewal notices, receivable ageing (5 updated), renewal pipeline, collection reminders (3 e-mails, 3 notifications); runs recorded | BrokerVerse | Pass (D62 cosmetic) | 19-schedules |
| 20 | Renewal of POL-2025-90021: QT-2026-00003 gross 26,935.02 linked to the policy, approved by the client; issue refused until ID and vehicle identifiers entered; new term POL-2026-00002 (14/09/2026-14/09/2027), old policy Renewed; payment recorded by the underwriter left the bill open, finance confirmed OR-2026-00022; commission 1,075.25 to the original referrer | jose.uw, client, liza.finance | Pass after fixes D63, D18, D20, D71 | 20-* |
| 21 | Persona access: menu per role, forbidden address blocked, forbidden API call 403 — 8 personas | all | Pass after fix D60 (security) — [persona_access.md](persona_access.md) | 21-* |
| 22 | All 18 reports generated as CSV, XLSX and PDF and contain this run's transactions | BrokerVerse | Pass after fix D65 — [reports_check.md](reports_check.md) | |
| 23 | Audit trail records logins, reports, jobs, endorsements, receipts, claims, vouchers, cheques, remittances and settlements | BrokerVerse | Pass | |

## Money trail for POL-2026-00001

| Event | Document | Debit | Credit | Amount |
|---|---|---|---|---|
| Policy issued | INV-2026-00001 / JV-2026-00100 | Premium receivable | Payable to insurer 30,875.52; commission income 4,200.75 | 35,076.27 |
| Premium received | OR-2026-00019 / JV-2026-00101 | Cash | Premium receivable | 35,076.27 |
| Commission paid to agent | PV-2026-00022 / JV-2026-00103 | Commission accrued 4,200.75 | Cash 3,990.71; WHT payable 210.04 | 4,200.75 |
| Premium remitted to MAPFRE | PV-2026-00023 / JV-2026-00104 | Premium payable | Cash | 30,875.52 |
| Cover increased by endorsement | INV-2026-00002 / JV-2026-00105 | Premium receivable | Payable to insurer 4,410.00; commission income 600.00 | 5,010.00 |
| Endorsement premium received | OR-2026-00020, OR-2026-00021 | Cash | Premium receivable | 2,000.00 + 3,010.00 |

## Defects

75 defects logged, 59 fixed (most re-tested on screen). The open ones are listed in [DEFECTS.md](DEFECTS.md); the ones that need a business decision are D12 (CTPL), D13 (APPA), D36 (direct bill) and D57 (chart of accounts).
