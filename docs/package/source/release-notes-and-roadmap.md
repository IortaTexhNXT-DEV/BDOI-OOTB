---
title: Release Notes and Product Roadmap
subtitle: BrokerVerse OOTB Release 1.1
version: 1.1.1
date: 04 October 2026
prepared: iorta TechNXT
reviewed:
approved:
change: Version 1.1.1: release figures aligned with the release verification of 04 October 2026 (packages B and G merged, migrations to 0331, 1,113 backend tests in 104 files, 175 front-end tests in 33 suites, UAT cycle of 433 steps, rehearsal of 52 checks, defects BV-DEF-009 to 014 closed). Version 1.1: release 1.1 entry (migrations 0243 to 0329): Philippine masters, enterprise menu and help, My Work, Product Configurator in the flow, audit trail, go-live workbench, release pipeline, AML/CFT, IC and NPC compliance, BIR, operations and accounting, distribution, integrations, branding and e-signatures; upgrade notes; roadmap of partner certifications
open_item: Release tag of the 1.1 build to be confirmed; partner certifications per broker; roadmap dates indicative
acronyms: OOTB=Out of the box; IC=Insurance Commission; BIR=Bureau of Internal Revenue; NPC=National Privacy Commission; DPA=Data Privacy Act of 2012 (RA 10173); EOPT=Ease of Paying Taxes Act (RA 11976); EIS=Electronic Invoicing System; CAS=Computerized accounting system; CTPL=Compulsory Third Party Liability; COC=Certificate of cover; LTO=Land Transportation Office; LOA=Letter of authority; PDC=Post-dated cheque; PSGC=Philippine Standard Geographic Code; AML=Anti-money laundering; CFT=Countering the financing of terrorism; AMLC=Anti-Money Laundering Council; CTR=Covered transaction report; STR=Suspicious transaction report; EDD=Enhanced due diligence; PEP=Politically exposed person; DST=Documentary stamp tax; LGT=Local government tax; FST=Fire service tax; VAT=Value-added tax; EWT=Expanded withholding tax; ATC=Alphanumeric tax code; DAT=Data file format of the BIR alphalists; KYC=Know your customer; OR=Official receipt; JV=Journal voucher; GL=General ledger; SoD=Segregation of duties; TOTP=Time-based one-time password; API=Application programming interface; BI=Business intelligence; AMC=Annual Maintenance Contract; CAB=Change advisory board; CR=Change request; Dev=Development environment; Pre-Prod=Pre-production environment; SIT=System integration test; UAT=User acceptance test
---

# About this release

## Release identification

| Item | Value |
|---|---|
| Product | iNXT BrokerVerse OOTB, insurance broking platform for Philippine non-life brokers |
| Release | 1.1 |
| Build | Branch `brokerverse-platform` of 04 October 2026 with package B (Insurance Commission and data privacy compliance) and package G (sales activities, quote covers and risk fields, supplier BIR Form 2307, fixed asset disposal) merged, verified end to end on the final code (Test Summary Report 1.3). The release tag `v1.1.0` is [to confirm] |
| Previous release | 1.0 (03 October 2026); its content is summarised in the chapter "Release 1.0" |
| Database migrations | `0243` to `0331`: `0243` to `0254` platform and go-live, `0260` to `0263` AML/CFT, `0270` to `0277` package B, `0280` to `0284` BIR, `0290` to `0298` operations and accounting, `0300` to `0308` distribution, `0310` to `0314` integrations, `0320` to `0322` package G, `0330` and `0331` release verification fixes (EIS outbox restart safety; encryption of the client identifiers of the AML/CFT onboarding); `0323` to `0329` unused |
| Technology | React 18 web application, Node.js 22 API, PostgreSQL 16 database |
| Audience | Broker management, key users, System Administrator, compliance officer, auditors, and the iorta TechNXT delivery and support teams |

## Release in figures

| Item | Release 1.0 | Release 1.1 |
|---|---|---|
| Delivered roles | 7 | 8 (Compliance Officer added) |
| Back-end modules | 45 | 73 |
| Registered API routes | 868 | 1,356 |
| Menu screens | 170 | 223 |
| Database tables | 167 | 260 |
| Settings | 404 | 660 |
| Scheduled jobs (Asia/Manila time) | 18 | 35; 14 delivered switched off |
| Document number series | 61 | 85 |
| Posting events with a delivered rule | 31 | 43 |
| Automated back-end tests | 634 | 1,113 in 104 files, all passed on 04 October 2026 on the merged release |
| Front-end tests | 43 | 175 in 33 suites, all passed |
| End-to-end UAT cycle and go-live rehearsal | 371 steps | 433 steps in 12 phases (2,168 API calls) and 52 rehearsal checks, all passed on the final code |

# Release 1.1: what is new

## Platform, navigation and Philippine masters

| Capability | Where |
|---|---|
| Philippine geography out of the box from the PSGC of the 2nd quarter 2026: Region, Province (no longer "State"), City / Municipality with class and ZIP code, Barangay (full list as an optional load); Philippine address format on leads, clients, users, claims and endorsements, the region filled from the city or province (migration 0250, seed `12_ph_geography.sql`) | Master > Location; every address form |
| Philippine practice masters: banks, government ID types with number formats, salutations, holidays, the IC list of insurers (seed `69_ph_practice_masters.sql`) | Master > Organization; Master > Insurance Management |
| Enterprise side menu: Master in sections (Organization, Insurance Management, Location, Employee Management, User Management, Finance, System Configuration, Data Privacy, Go-Live and Data); skeleton rows while lists load | Side menu |
| Help panel: F1 or the help button opens the user manual section of the screen, with the support contacts (`support.*` settings, migration 0251) | Every screen |
| My Work: My Items, My Team by reporting line, My Tasks with reminders, Calendar; reassignment where the module allows it (migration 0253) | Operations > My Work |
| Product Configurator in the business flow: acceptance rules (refer, decline, loading) with authority, rating factors, document templates with merge fields, market mapping and the governing template applied to quotations (migration 0252) | Product Configurator; quotations |
| Audit trail as business events: who, when, from which screen, each changed field with old and new value; History panel on records; filters and Excel export (migration 0247) | Master > System Configuration > Audit Trail |
| Theme and Branding: themes, logo, favicon, sign-in picture, brand packs (the optional Toyota Insurance Services pack only with the client's written permission); branded documents, report files and e-mails; e-signatures captured with consent and mapped to document slots (migration 0254) | Master > System Configuration > System Settings > Theme and Branding; Master > Insurance Management > Signatories; My Profile |

## Go-live and release tooling

| Capability | Where |
|---|---|
| Go-Live Data Workbench: configuration and migration kits, validation as a dry run, errors workbook, load (all or nothing), reconciliation (migrations 0244, 0246) | Master > Go-Live and Data > Go-Live Data Load |
| Environment comparison report: configuration and masters mirrored between environments, on screen and as `backend/scripts/compare-environments.js` (migration 0248) | Go-Live Data Load > Compare environments |
| Transaction reset after the smoke test (`npm run reset:transactions`), refused once the go-live lock `golive.locked` is on (migration 0243) | Command line |
| Client data masking for non-production copies (`npm run mask:data`) with `--remark-copy` and `--register-production`; environment marker `system.environment` (migration 0249) | Command line; `docs/onboarding/DATA_MASKING.md` |
| Release pipeline: one build promoted through Dev, SIT, UAT, a temporary Pre-Prod and Production with approvals, pre-deploy backup, smoke test, automatic and manual rollback (`ci.yml`, `deploy.yml`, `rollback.yml`) | `deploy/RELEASE_PIPELINE.md` |

## Compliance

| Capability | Where |
|---|---|
| AML/CFT: onboarding of juridical clients before the first policy with signatories and beneficial owners, KYC documents, risk rating and EDD, screening lists (UN, AMLC, PEP, internal) and hits, covered and suspicious transaction alerts, cases, AMLC report files; Compliance Officer role (migrations 0260 to 0263) | Compliance |
| Package B, Insurance Commission: licence register with expiry reminders and payout block for unlicensed referrers, fit and proper records, insurer authority check at placement and issue, IC annual statement and production report (migrations 0270, 0271, 0274) | Compliance > Insurance Commission |
| Package B, complaints register under RA 11765 with acknowledgement and resolution deadlines and escalation (migration 0272) | Compliance > Insurance Commission > Complaints |
| Package B, breach register with the NPC 72-hour notification tracker (migration 0273) | Compliance > Data Privacy (NPC) > Breach Register |
| Package B, masking of personal data by role: TIN, ID, mobile, e-mail, bank account and birth date shown partially masked to users without `view:pii`, in screens and exports; optional "Show full identifiers" on request with audit (migration 0276) | Every screen and export |
| Package B, field encryption of TIN, government ID and bank account numbers at rest with key `PII_ENCRYPTION_KEY` and blind indexes for search (migration 0277) | Database |

## BIR and tax

| Capability | Where |
|---|---|
| BIR returns with filing records: 0619-E, 1601-EQ, 1604-E with the alphalist DAT files, 2551Q percentage tax (migration 0280) | Accounts > Tax |
| Sales invoices under the EOPT Act for commission, fees and override commission, with payment acknowledgements (migration 0281) | Accounts > Tax > Sales Invoices |
| CAS registration pack: loose-leaf books of accounts with running page numbers (migration 0282) | Accounts > Tax |
| EIS connector: every invoice and cancellation queued for the BIR Electronic Invoicing System (migration 0283; job `eis-outbox` delivered off) | Accounts > Tax |
| Overriding, profit and contingent commission from insurers: agreements with tiers, computation, approval, settlement (migration 0284) | Commission > Insurer Overrides |
| Package G: supplier BIR Form 2307 from payables and supplier EWT in the returns | Accounts > Tax |

## Operations and accounting

| Capability | Where |
|---|---|
| Cover notes (binders) issued from an accepted quotation or placement, superseded by the policy (migration 0290) | Operations > Cover Notes |
| Computed cancellation: pro-rata, short-period scale when the insured cancels, flat; return premium with taxes and commission taken back (migration 0291) | Operations > Policy Cancellation |
| Post-dated cheque register: deposit due list, deposit into an official receipt, bounce, replacement (migration 0292) | Accounts > Post-Dated Cheques |
| Instalment invoices for instalment plans (migration 0293) | Accounts > Credit Control |
| Claim document checklist with reminders; claims settlements worked from the Accounting menu (migration 0294) | Operations > Claim Documents; Accounts > Claims Settlements |
| Motor claim repairs: estimates, letters of authority, vehicle release (migration 0295) | Operations > Motor Claim Repairs |
| Accounts payable: supplier invoices with input VAT and EWT, payments, AP ageing (migration 0296) | Accounts > Payables |
| Fixed assets and monthly depreciation (migration 0297); package G adds disposal by sale or write-off with gain or loss | Accounts > Fixed Assets |

## Distribution and marketing

| Capability | Where |
|---|---|
| Lead assignment rules, queue and reassignment SLA (migration 0300) | Operations > Sales & Marketing > Lead Assignment |
| Distribution channels: dealer groups and branches, financing banks, affinity partners (migration 0301) | Master > Insurance Management > Distribution Channels |
| Brand-new vehicle dealer programmes with dealer sales uploads and bank letters (migration 0302) | Operations > Sales & Marketing > Dealer Programmes |
| Fleet schedules (migration 0303) and marine cargo open covers with certificates and declarations (migration 0304) | Operations > Fleet Schedules; Marine Open Covers |
| Facultative reinsurance placement as reinsurance broker (migration 0305) | Reinsurance > Facultative Placements |
| Client comparison and recommendation report (migration 0306) | Operations > Sales & Marketing > Comparison Reports |
| Marketing campaigns to consenting clients and prospects with opt-out (migration 0307) | Operations > Sales & Marketing > Campaigns |
| Report builder and scheduled BI extract (migration 0308) | Reports > Report Builder |
| Package G: sales activity log with follow-ups in My Work; quote wizard offering the covers and asking the risk fields of the Product Configurator template | Sales; quotations |

## Integrations

| Capability | Where |
|---|---|
| Integration framework: connectors in test or live mode, outbox with retries, inbox with signature check, monitor (migration 0310) | Master > System Configuration > Integrations |
| SMS (Semaphore, Globe Labs, generic) and Viber business messages with templates per event (migration 0311) | Master > System Configuration > Message Templates |
| CTPL authentication with COC number series and optional LTO feed (migration 0312) | Operations > CTPL Authentication |
| Insurer API connectors: policy issuance request and claim status updates per insurer mapping (migration 0313) | Master > System Configuration > Insurer Integration |
| Bank payment files (bulk credit, InstaPay, PESONet layouts) and status files (migration 0314) | Accounts > Bank Payment Files; Master > Finance > Bank File Layouts |

Every connector is delivered in test mode with a built-in fake provider. Live use needs the provider's credentials in the environment and the certification listed in the roadmap.

# Upgrade notes for release 1.1

## How the upgrade runs

The API applies migrations `0243` onwards and the seed by itself when it starts, under the migration lock, before it reports ready. Deploy through the release pipeline: the pre-deploy backup is taken first, one instance migrates, the smoke test runs. The previous release still runs on the newer schema, so an application rollback needs no database change. Run the environment comparison report against UAT before and after the production upgrade.

## New environment variable: PII_ENCRYPTION_KEY

Package B adds `PII_ENCRYPTION_KEY`. Set it before deploying the release that contains migration `0277`:

1. Generate a random value of at least 32 characters (`openssl rand -hex 32`), different from `JWT_SECRET` and `DATA_ENCRYPTION_KEY` and different in every environment.
2. Store it in the secret store of the environment and add it to the backend environment (`deploy/backend.env.example`). In production the API refuses to start without it.
3. Keep it with the database backups under the same controls as `DATA_ENCRYPTION_KEY`: without it the TIN, ID and bank account numbers in the database and in every later backup cannot be read.
4. Migration `0277` encrypts the identifiers already stored during the upgrade; allow for it in the maintenance window on a large database.
5. Rotation later: set the new key in `PII_ENCRYPTION_KEY` and the old one in `PII_ENCRYPTION_KEY_PREVIOUS`, restart, run `npm run pii:rotate` then `npm run pii:rotate -- --execute`, remove the previous key when nothing is left on it (`deploy/REFERENCE.md`).

Other variables: `APP_ENVIRONMENT` names the environment; integration connectors and the EIS read their credentials from environment variables named on the connector (`credential_env`, `eis.*_env`), never from the database.

## Jobs delivered switched off

These jobs are installed but off. Switch each on in Master > System Configuration > Schedules only when its prerequisite is met.

| Job | Switch on when |
|---|---|
| `recurring-journals`, `accrual-reversal`, `period-auto-soft-close`, `month-end-reminder` | Accounting has set up recurring journals, accruals and the close calendar |
| `bank-auto-match` | Bank statement formats and match rules are confirmed |
| `remittance-schedules` | Remittance schedules are agreed with each insurer |
| `privacy-requests-due` | The DPO has confirmed the response period for data subject requests |
| `lead-assignment-sla` | Lead assignment rules and SLA hours are set |
| `sms-renewal-notices`, `sms-payment-reminders` | The SMS connector is live and the templates are approved |
| `eis-outbox` | The broker's EIS accreditation is granted and the EIS credentials are in the environment |
| `campaign-dispatch` | The first campaign is approved and marketing consents are recorded |
| `aml-provider-retry` | A commercial screening provider is contracted |
| `bi-extract` | The BI datasets and the extract folder are agreed |

The new jobs delivered on are `my-work-reminders`, `integration-outbox`, `cover-note-expiry`, `pdc-deposit-due`, `claim-document-reminders`, `aml-transaction-monitoring`, `aml-kyc-refresh-due` and, with package B, `compliance-reminders`, `complaints-deadlines` and `privacy-breach-deadlines`.

## Settings to review

| Group | Review |
|---|---|
| `aml.*` | Covered transaction threshold and payment modes, risk score bands, beneficial owner threshold, KYC refresh months, block of issue pending EDD, AMLC institution code (compliance officer) |
| `bir.*`, `invoice.*`, `cas.*`, `eis.*` | Registered trade name, TIN branch code, withholding agent category, percentage tax rate and ATC, ATP and CAS permit numbers, invoice serial range, EIS mode and endpoint (finance and tax adviser) |
| `compliance.*`, `complaints.*`, `privacy.*` (package B) | Licence types and reminder days, referrer licence check, insurer authority check (warn or block), IC statement mapping and minimum net worth, complaint deadlines, breach notification hours, masking and reveal mode |
| `cover_note.*`, `endorsements.cancellation_*`, `pdc.*`, `payables.*`, `fixed_assets.*`, `motor_claims.*`, `claims.document_*` | Cover note validity and wording, short-period rules, PDC deposit account, input VAT code and maker-checker, depreciation start, LOA wording and participation |
| `leads.assignment_*`, `channels.*`, `motor_programmes.*`, `fleet.*`, `marine.*`, `campaigns.*`, `comparison.*`, `report_builder.*`, `bi.*`, `sales_activities.*` | Assignment fallback and SLA, mortgagee clause, bank letter text, fleet pro-rata basis, marine conveyances and wording, opt-out text, comparison disclaimer, report row limits |
| `integrations.*`, `messaging.*`, `ctpl.*`, `bank_payments.*`, `insurer_integration.*` | Inbound enabled, stuck minutes, SMS and Viber connectors and consent, CTPL authentication on issue, InstaPay limit, premium tolerance |
| `branding.*`, `signatures.*`, `support.*`, `system.environment`, `golive.*` | Theme and logos, draft watermark, support e-mail and hours, environment marker, cutover date and go-live lock |

Review the number series of the new documents in Master > Document Numbering (cover notes, sales invoices, supplier invoices, complaints and others) and the posting rules of the new events in Master > Finance > Posting Rules (`ap.invoice`, `ap.payment`, `fa.depreciation`, `fa.disposal`, `sales_invoice.issue`, `sales_invoice.payment`, `override_commission.accrual`, `override_commission.settlement`, `ri.facultative.*`).

## Before the release is tagged

- Done on 04 October 2026: packages B and G merged and the full suites run again on the merged release (1,113 backend tests, 175 front-end tests, UAT cycle of 433 steps, go-live rehearsal of 52 checks, data masking verified, environment comparison identical; Test Summary Report 1.3). The defects found in that verification, BV-DEF-009 to BV-DEF-014, are fixed and closed.
- Done: the number series prefix of the complaints register (migration `0272` of package B) is `CPT`; the comparison report series of migration `0306` keeps `CMP`.
- Add housekeeping rules for the new operational tables (integration outbox and attempts, EIS outbox, go-live workbook rows).
- Add the 25 translation keys reported missing by `npm run check:i18n` (audit timeline, claim audit trail, currency master, policy history).

# Release 1.0

## What release 1.0 delivered

Release 1.0 (03 October 2026, tag `v1.0.0`) delivered the core broking cycle: prospects, quick quote and comparison of packaged products, requests for quotation to several insurers, quotations with premium taxes and commission, placement slips with co-insurance, policy issue with KYC, endorsements and cancellations, claims to settlement, renewals with notices and win-back, open items and payment capture, billing and official receipts, collections and credit control, disbursements and petty cash, remittance with approvals, commission and incentives, the general ledger from posting rules with journal vouchers and period end, bank and insurer reconciliation, reinsurance treaties and cessions, the Product Configurator, masters, user management with the authority matrix, SoD and access reviews, data privacy (consents, data subject requests, export and anonymisation), payment links and the report catalogue. Philippine rules built in: DST, VAT, LGT and FST premium taxes, CTPL tariff, KYC, commission VAT and EWT, BIR Form 2307 and the BIR working papers, Asia/Manila time and PHP.

## Defects and observations carried forward

| ID | Item | Status in 1.1 |
|---|---|---|
| BV-DEF-001 | react-router moderate security advisory (open redirect) | Open; navigation targets come from the application's own routes; upgrade on the roadmap |
| BV-DEF-003 | Application-level encryption covered only two-step verification secrets | Closed with package B: TIN, ID and bank account numbers encrypted at rest |
| BV-DEF-002, 004, 006; BV-OBS-005, 007, 008 | Data privacy module, template column, charges calculator, renewal beyond grace, menu group address, incentive card | Closed in 1.0 |
| BV-DEF-009 to BV-DEF-014 | Found in the release verification of 04 October 2026 on the merged release (UAT scenario set-up, CTPL tariff cancellation, masking of SMS recipients and key columns, rehearsal migration headers, incentive period keys, sample data in two tests) | Fixed and closed before the tag; see the Test Summary Report 1.3 |

## Limits of release 1.0 resolved in 1.1

| Topic | Release 1.0 | Release 1.1 |
|---|---|---|
| Insurer systems | No insurer API | Insurer API connectors (test mode until certified) |
| IC report formats | No IC-format report | IC annual statement and production report (package B) |
| Percentage tax | No working paper for a non-VAT broker | 2551Q return |
| Anti-money laundering | Outside OOTB | AML/CFT module |
| Bank payments | No bank payment file | Bank payment files and status files |
| Claim settlement cash | On the claim screens only | Accounts > Claims Settlements |
| Personal identifiers | Not encrypted, not masked | Encrypted and masked by role (package B) |

# Known limitations and open items

## Limits of the OOTB scope in release 1.1

| Topic | Release 1.1 behaviour | Route |
|---|---|---|
| Partner connectors | Delivered in test mode; live use after certification with each partner | Roadmap and change request per partner |
| Report schedules | Scheduled e-mail of reports exists in the API; no setup screen | System Administrator through the API |
| Two-step enrolment | Shows the key and a link, not a QR code | Users type the key into the authenticator app |
| Session tokens | Kept in browser local storage | Move to httpOnly cookie on the roadmap |
| Housekeeping | No retention rule yet for the integration outbox and attempts, the EIS outbox and go-live workbook rows | Next minor release |
| Mobile | Web application for desktop and laptop browsers | See roadmap |
| Language | English screens; Thai partly translated; no Filipino translation file | Change request |
| Load test and penetration test | Not run on a production-sized environment | Before go-live at each broker |

## Before go-live at a broker

- Set `security.require_2fa_roles` to at least System Administrator, Accounting and Accounting Manager; decide who holds `view:pii`.
- Replace the default authority limits with the board-approved signing authority; appoint the Compliance Officer.
- Fill the BIR, invoice and CAS settings; confirm premium tax rules, LGU rates, ATC and GL accounts with the broker's tax adviser.
- Load configuration and open business through the Go-Live Data Workbench; run the transaction reset after the smoke test, then switch on the go-live lock.
- Register production for the masking tool (`npm run mask:data -- --register-production`) and set `PII_ENCRYPTION_KEY` with its escrow copy.
- Keep every integration connector in test mode until its certification is signed; switch off the Sandbox payment gateway in production.
- Switch on "Send e-mails" only after the SMTP mailbox is tested.

# Upgrade and versioning policy

## Version numbers

Releases are numbered MAJOR.MINOR.PATCH and tagged in the repository (for example `v1.1.0`); `GET /api/version` shows the commit that is running.

| Type | Example | Content | Frequency (standard) |
|---|---|---|---|
| Patch | 1.1.1 | Defect fixes and security fixes; no change to how users work | As needed; emergency release for P1 or security |
| Minor | 1.2.0 | New functions, new reports, regulatory form updates, upgrades of components; existing data and settings kept | Planned releases, monthly when there are fixes or changes |
| Major | 2.0.0 | Changes that need a migration project, retraining or a change of hosting components | Announced at least 6 months ahead [to confirm] |

## Rules for every release

- Database changes only add to the schema; they are applied automatically when the API starts, under a lock, and recorded. The previous release runs on the newer schema, so a release can be rolled back by redeploying the previous build.
- Settings and master data changed by the broker are kept: the seed inserts only what is missing.
- Every release has release notes: fixes, changes, migrations, new environment variables, jobs delivered off, settings to review and anything the System Administrator must do by hand.
- Each release follows the release pipeline: Dev, then SIT for a large broker, then UAT on a release candidate tag, a temporary Pre-Prod for a major release, then Production on the release tag after the CAB approval; the broker runs the UAT scripts for the changed areas; iorta TechNXT runs the regression.
- A verified backup is taken before every deployment to Pre-Prod and Production; deployment happens in the agreed maintenance window, announced at least 5 business days ahead.

## Entitlement and support of versions

- Updates of the OOTB version and regulatory form updates released for all customers are included while the subscription or the AMC is in force.
- Support covers the current release and the two planned releases before it (assumption in the Production Support Approach). A broker that stays further behind is asked to upgrade before a defect is fixed.
- Broker-specific changes made under a change request are carried forward into later releases only where the change request says so [to confirm the standard clause].

# Product roadmap

> **Indicative and not contractual.** The roadmap shows iorta TechNXT's current intentions. Content, order and timing may change. It is not a commitment to deliver any function, it is not part of any licence, subscription or support agreement, and a purchase decision should be based on the functions in the release delivered. Items a broker needs by a date are agreed as change requests.

## Partner certifications (what remains for live connectors)

The connectors are built and tested against the fake provider. Each needs the partner's sandbox, credentials, test cases signed by the partner and, where the partner requires it, a formal certification before it is switched to live for a broker.

| Partner connector | What remains | Owner |
|---|---|---|
| BIR EIS | Broker's EIS accreditation, BIR test environment run, production credentials | Broker with iorta TechNXT |
| CTPL authentication provider and LTO feed | Provider onboarding per insurer, COC series issued by the insurer, test authentications | Broker, insurer, iorta TechNXT |
| Insurer APIs | Mapping per insurer (products, codes, answers), the insurer's sandbox and sign-off, one insurer at a time | Insurer with iorta TechNXT |
| Bank payment files | Bank's file layout confirmation and test file acceptance per bank and service (bulk credit, InstaPay, PESONet) | Broker's bank |
| SMS and Viber | Sender name registration, gateway account, template approval | Broker |
| Payment gateways (PayMongo, Dragonpay) | Merchant account, live keys, test in the provider's sandbox | Broker |
| Commercial AML screening provider | Contract and API credentials, list coverage confirmation | Broker's compliance officer |

## Near term (indicative: within 3 months)

| Item | Why |
|---|---|
| Done on 04 October 2026: packages B and G merged (supplier 2307, fixed asset disposal, sales activities, quote covers and risk fields included) and verified on the final code | Release 1.1 complete |
| Housekeeping rules for the integration, EIS and workbench tables | Control database growth |
| Upgrade react-router (BV-DEF-001) | Close the moderate advisory |
| QR code for two-step enrolment; setup screen for scheduled report e-mails | Easier use |
| Image scanning in the pipeline | Secure development lifecycle |

## Mid term (indicative: 3 to 9 months)

| Item | Why |
|---|---|
| Session refresh in an httpOnly cookie | Remove tokens from browser local storage |
| Move of the front-end build from Create React App to Vite | Maintained build tooling; clears build-time advisories |
| Rate limits shared across API instances | Consistent limits with several instances |
| Load test results and sizing confirmation on a production-sized environment | Evidence for larger brokers |

## Later (indicative: beyond 9 months)

| Item | Why |
|---|---|
| Mobile-friendly screens for sales and claims | Field use |
| Filipino screen translation | Users who prefer Filipino |
| Further partner connectors as brokers request them | Fewer files and e-mails with partners |

Brokers can propose roadmap items through their account manager. iorta TechNXT reviews the roadmap with customers at least once a year [to confirm the forum, for example a customer advisory meeting].
