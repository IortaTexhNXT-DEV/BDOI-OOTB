# BrokerVerse end-to-end test plan

The system is tested the way users work it: sign in, open each screen from the menu, type the data into the
fields, press the buttons, and read the results on screen. After every transaction the test checks that it
has reached every place it should: dashboards, lists, reports, the ledger, collections, remittance and
commission. Every step is screenshotted into the test report.

Environment: the production build of `brokerverse/` served with the `backend/` API on a fresh PostgreSQL
database (seeded reference data and sample book). Browser: Chromium, 1600 x 1000.

## Personas (created by the administrator through Master > User Management)

| User | Persona | Role |
|---|---|---|
| BrokerVerse | Platform administrator | it-admin |
| bea.admin | Business administrator (configuration, masters) | ba |
| maria.sales | Relationship manager | sales |
| ramon.agent | Agent / referrer | agent |
| jose.uw | Underwriter (quote checker) | underwriting |
| ana.cs | Customer service | customer-services |
| carlo.claims | Claims officer | claims |
| lisa.claims2 | Claims approver (checker) | claims |
| liza.finance | Finance officer (maker) | finance |
| fe.approver | Finance approver (checker) | finance |

## Scenario: one motor policy through its whole life

| # | Who | Screen | Data entered / action | Checks (on screen, then downstream) |
|---|---|---|---|---|
| 1 | BrokerVerse | Sign-in | wrong password, then correct | error shown; lock after the configured attempts; dashboard opens |
| 2 | BrokerVerse | Master > User Management > User > Add | the ten users above, one role each | required-field and e-mail validation; duplicate username refused; users listed with roles |
| 3 | BrokerVerse | Master > Configuration | read tax rates, numbering, limits | values match the database; a change is saved and audited |
| 4 | bea.admin | Master > Insurance Company, Product, Cover | add an insurer | required fields; appears in the quote insurer drop-down |
| 5 | ramon.agent | Operations > Leads/Prospects > Create | name, mobile, e-mail, birth date, address, product Motor | invalid e-mail / mobile rejected; lead listed under Motor; Agent dashboard lead count +1 |
| 6 | ramon.agent | Quotation > New (from the lead) | vehicle brand/model/variant/year, plate, chassis, engine, FMV, coverages (BI/PD/PA), insurer | required vehicle fields; premium breakdown = base + VAT + DST + LGT + FST from Configuration; quote number from the numbering prefix |
| 7 | ramon.agent | Quotation list / dashboard | - | quote listed as Draft; Executive and Agent dashboards: quotes +1; Reports > Lead conversion funnel includes it |
| 8 | ramon.agent | Quotation > Send for approval | - | status Pending customer; e-mail queued; underwriting notified (bell) |
| 9 | customer | Approval link | accept | status Customer accepted; maker cannot approve their own quote |
| 10 | ramon.agent | Convert to policy | payment mode, inception date | policy number issued; client created from the lead; policy listed Active |
| 11 | - | Downstream of 10 | - | Executive dashboard: active policies +1, premium +premium; Reports > Production register contains the policy; Accounting: receivable (bill number) and journal Dr Premium receivable / Cr Premium payable + commission income, balanced; Collections: outstanding = gross premium, bucket Current; Commission: line Accrued for the agent; Remittance > Direct bill: policy available with net due = premium - commission |
| 12 | liza.finance | Accounts > Receipts > Add | partial payment, then the balance | overpayment refused; receivable Partial then Paid; official receipt number; journal Dr Cash / Cr Premium receivable; Collections updated; SOA report shows the payments; Trial balance still balanced |
| 13 | liza.finance | Commission > Agents/Referrer Accounts | mark eligible, approve (fe.approver), pay | not eligible before full collection; maker cannot approve; WHT deducted at the configured rate; payable journal posted |
| 14 | liza.finance | Accounts > Remittance > Direct bill / Approval / Settlement | remit the policy to the insurer | approval by a second user; settlement creates the insurer voucher; Disbursement register and Remittance report include it; journal Dr Premium payable / Cr Cash |
| 15 | ana.cs | Policy > Endorsement | change address, then an additional cover | premium difference billed as a new receivable; policy updated; appears in collections and production |
| 16 | carlo.claims | Claims > Register | loss date, cause, estimate | refused for a loss date outside the policy period; refused while premium unpaid (rule on); registered; Claims dashboard and Claims report +1 |
| 17 | carlo.claims / lisa.claims2 | Claims > Review > Settle > Approve | settle amount | maker cannot approve; Settled; claims position report updated |
| 18 | liza.finance | Journal Voucher | manual JV, approve by fe.approver | unbalanced JV refused; posted JV in Journal report; trial balance balanced |
| 19 | BrokerVerse | Master > Schedules | run renewal notices, receivable ageing, collection reminders | runs recorded; notifications and e-mails queued; ageing buckets updated |
| 20 | jose.uw | Operations > Renewals | renewal quote for the policy, submit, approve, complete | re-rated premium and variance; new policy term; old term Renewed; renewal report |
| 21 | each persona | Menu and a forbidden address | - | only the persona's menus are shown; a typed forbidden address shows Not authorised; the API refuses the same action |
| 22 | BrokerVerse | Reports (all ten) | generate for the test period | each file downloads and contains the test transactions |
| 23 | BrokerVerse | Master > Audit Trail | filter by the policy | every create, approval and payment is listed with user and time |

## Screen-by-screen checks on every screen

For every menu screen: it opens without an error; lists show rows from the database; search and filters
narrow the list; Add opens the form; saving with empty required fields shows the field messages; a valid save
appears in the list; View and Edit show the saved values; status changes stick after reload.
