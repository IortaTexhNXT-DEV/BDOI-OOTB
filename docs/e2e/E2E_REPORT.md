# BrokerVerse end-to-end test report

> Roles renamed since this run (broker terminology, migration 0140): underwriting -> processing (Processing Team),
> customer-services -> operations, finance -> accounting, finance-manager -> accounting-manager; it-admin, ba and
> user-access-admin merged into system-admin; the agent login role withdrawn (its users are Sales & Marketing). The
> Underwriting Dashboard is now the Processing Dashboard (/processing/dashboard). The results below are as recorded.

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
| 24 | Motor pricing per business decision: QT-2026-00006 (Honda City, private car, 5 seats) — CTPL 560 at the Insurance Commission tariff, Auto Passenger PA 50,000 x 5 = 250,000 cover for 250.00, net 22,810, gross 28,569.53, brokerage 18% = 4,105.80; same figures on coverage page, order summary, saved quote, quote detail and the customer's approval page; CTPL untick gives 27,868.13; endorsement APPA 50,000 -> 100,000 re-prices APPA to 500.00 only | ramon.agent, client, ana.cs | Pass after fixes D12, D13, D77 | |
| 25 | Direct bill: QT-2026-00006 approved by the client, KYC and photos, POL-2026-00003 issued; switched to direct bill by finance (premium bill INV-2026-00004 cancelled and its booking reversed; JV-2026-00113 Dr commission receivable 4,598.50 / Cr commission income 4,105.80 / Cr output VAT 492.70); debit note DN-2026-00001 raised by liza.finance, maker approval refused, approved by fe.approver; insurer payments 2,000 + EWT 205.29 (Partially Collected) and 2,187.92 + EWT 205.29 (Collected), JV-2026-00114/115 Dr cash / Dr creditable WHT / Cr commission receivable; direct-bill report and trial balance agree | ramon.agent, liza.finance, fe.approver | Pass after fixes D36, D78 | |
| 26 | Chart of accounts: 128 accounts grouped by type and statement group on Master > Main Account; office rent 85,000 booked by liza.finance (JV-2026-00117, Dr 4402001 Rent Expense / Cr 1102001 Cash in Bank – Operating Account), approved by fe.approver; trial balance grouped and balanced (1,289,443.44) | bea.admin, liza.finance, fe.approver | Pass after fix D57 | |

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

149 defects logged over the functional run and the persona walks, all 149 fixed and re-tested. They are listed in [DEFECTS.md](DEFECTS.md); the business decisions on D12 (CTPL), D13 (APPA), D36 (direct bill) and D57 (chart of accounts) were given on 29 Sep 2026 and all four are fixed and re-tested (steps 24-26).

## Confirmed business settings (29 Sep 2026)

Confirmed by the business owner; seeded in `backend/src/db/seeds/settings.json` and editable in System Settings.

| Setting | Value |
|---|---|
| `direct_bill.default_billing_mode` | broker (new policies are broker-billed unless direct bill is chosen at issue) |
| `direct_bill.commission_vat_rate` / `direct_bill.commission_vat_inclusive` | 12%, added on top of the commission |
| `direct_bill.insurer_ewt_rate` | 10% of the commission, withheld by the insurer (creditable, BIR Form 2307) |
| `direct_bill.debit_note_due_days` | 30 days after the debit note date |
| CTPL tariff (Product Configurator, motor templates) | Annual amounts inclusive of taxes and fees: motorcycles / tricycles / trailers 300.40, private cars 610.40, light / medium trucks 660.40, AC and tourist cars 790.40, taxi / PUJ / mini bus 1,150.40, heavy trucks and private buses 1,250.40, PUB and tourist buses 1,500.40. 3-year upfront for brand-new private cars 1,660.40 (other classes to be supplied). Added to the gross outside the taxed net premium; not discounted |
| Auto Passenger PA | Limit per person x seats x 0.1%; limits 25,000 to 200,000 |

Business settings moved from code to configuration (D133-D137, D146; seeded with the values the code used, **to be confirmed by the business owner**, editable in Master > Configuration):

| Setting | Value |
|---|---|
| Executive Dashboard periods | Calendar month / quarter / year to date in Manila time (confirmed by the user); compared with the whole previous period |
| `quote.bodily_injury_limits` / `quote.property_damage_limits` | 100,000 to 500,000 in steps of 100,000 (quote and endorsement screens) |
| `dashboard.renewals_due_days` | 60 days (renewals due on the dashboards) |
| `renewals.due_soon_days` / `renewals.risk_thresholds` | 30 days; retention risk: no contact within 30 days of expiry, premium increase above 10%, due within 15 days |
| `product.expiry_warning_days` | 60 days (templates listed as expiring) |
| `incentive.program_lookback_days` | 30 days (ended programs still shown to agents) |
| `security.reset_code_minutes` / `security.restricted_token_minutes` | 15 / 15 minutes |
| E-mail texts | `security.reset_email_*`, `remittance.statement_email_*`, `remittance.bill_email_*` |

Where to maintain them: Product Configurator > template MOT-003-2025 (the template named in System Settings, `motor.pricing_template_code`) > tab "CTPL & Auto PA". Each vehicle class has its name, default seats, 1-year CTPL and 3-year CTPL (blank = the 3-year cover is not offered for that class); classes can be added or removed; the Auto Passenger PA rate and limits are on the same tab. The server checks the values on save (amounts of 0 or more, whole-number seats, unique class codes) and the quote screens use them at once. Re-tested on screen as bea.admin: a 3-year amount entered for motorcycles was saved and offered by the quotation tariff, then cleared again.
