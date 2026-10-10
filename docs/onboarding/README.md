# BrokerVerse onboarding kit

Everything to hand to the customer's users and administrators at go-live, and where it is. Version 1.1, 04 October 2026,
iorta TechNXT.

**TISPH.** The TISPH documents (functional specifications, the document pack and the test pack) are indexed in
[`docs/TISPH/README.md`](../TISPH/README.md); the Document Register (`docs/TISPH/pack/TISPH_Document_Register.docx`)
says where each required document is held. Support model and runbooks: `docs/TISPH/pack/TISPH_Operations_and_Support.docx`;
environments and release: `docs/TISPH/pack/TISPH_Environments_and_Release.docx`; data migration and cutover:
`docs/TISPH/pack/TISPH_Data_Migration_and_Cutover.docx`. The guides below were written for the generic product and
are being corrected for TISPH (getting started and role decks under work packages MAN-A and MAN-B, UAT scripts with the
TISPH UAT test cases, support and escalation under operations planned item P29).

| Item | For | Where |
|---|---|---|
| Getting started guide | Every user | [GETTING_STARTED.md](GETTING_STARTED.md): first sign-in, password rules, two-step verification, the side menu and menu search, menus per role (including the Compliance Officer), My Work, masked personal identifiers, the Help panel (F1) and how to get help |
| Go-live data set-up | System Administrator and Accounting | [GO_LIVE_DATA_SETUP.md](GO_LIVE_DATA_SETUP.md): the order of set-up, from company and users to opening balances and the first month-end |
| Branding and e-signatures | System Administrator, onboarding lead | [BRANDING_AND_SIGNATURES.md](BRANDING_AND_SIGNATURES.md): theme, sign-in page, documents, reports and e-mails per broker; signature capture and mapping; brand packs between environments; client trademark permission; support procedures for brand pack import and e-signature revocation |
| Smoke test and transaction reset | System Administrator, DevOps | [SMOKE_TEST_AND_RESET.md](SMOKE_TEST_AND_RESET.md): where to run the smoke test, then `npm run reset:transactions` to remove its transactions while masters, configuration and users stay, and the go-live lock |
| Client data masking | DevOps / DBA, Data Protection Officer | [DATA_MASKING.md](DATA_MASKING.md): `npm run mask:data` masks the personal data of a copy of production before it is used in SIT, UAT, Pre-Prod, training or support; refresh rules, procedure, evidence to keep |
| Go-live rehearsal | System Administrator, DevOps, migration lead | `npm run rehearsal:golive` ([GO_LIVE_DATA_WORKBENCH.md](GO_LIVE_DATA_WORKBENCH.md#go-live-rehearsal)): configuration promotion, smoke test and reset, migration with reconciliation, new and migrated data, go-live lock, rehearsed between two environments; run log [../e2e/GOLIVE_REHEARSAL_RUN.md](../e2e/GOLIVE_REHEARSAL_RUN.md) |
| Environment comparison | System Administrator, DevOps, auditors | Master > Go-Live Data Load > Compare environments, or `npm run compare:environments` in a release pipeline ([GO_LIVE_DATA_WORKBENCH.md](GO_LIVE_DATA_WORKBENCH.md#compare-environments)): proves configuration and masters are mirrored between environments (verdict *Mirrored* or *Differences found*, field-level differences, environment-specific values apart) and gives the comparison workbook |
| Support and escalation | Key users, System Administrator | [SUPPORT_AND_ESCALATION.md](SUPPORT_AND_ESCALATION.md): how to report an issue, severity levels, response targets (to be agreed with the customer), what support checks first, support procedures by area (integrations, EIS, compliance reminders, keys, brand packs, e-signatures) |
| Production support procedures | Production support, DevOps | [Production Support Approach and Standards](../package/06_Support/BrokerVerse_Production_Support_Approach_and_Standards.pdf), chapter "Operational procedures for the new capabilities": integrations outbox monitoring, compliance deadline jobs, encryption key custody and rotation (`npm run pii:rotate`), brand pack import, e-signature revocation |
| Scheduled jobs and their runbook | System Administrator, production support | [Schedules and Batch Jobs](../package/05_Delivery/BrokerVerse_Schedules_and_Batch_Jobs.pdf): every job, its switch, the jobs to switch on at go-live and the support runbook per job |
| User acceptance test scripts | Key users of each role | [UAT_SCRIPTS.md](UAT_SCRIPTS.md): 5 to 8 scenarios per role for the first week |
| Upload templates | People preparing data | [../package/05_Delivery/Upload_Templates](../package/05_Delivery/Upload_Templates/README.md): one XLSX per upload with a Data, Columns and Instructions sheet, and the verification results |
| User manual | Every user | [../package/05_Delivery/BrokerVerse_User_Manual.pdf](../package/05_Delivery/BrokerVerse_User_Manual.pdf) (also .docx); the section of each screen also opens from the Help panel (F1) |
| Role decks | Trainers and new users | [../decks](../decks/README.md): one PowerPoint per persona. The decks were written for the earlier persona set; map them to the broker roles as follows: Sales / Relationship Manager and Agent / Referrer to Sales & Marketing, Underwriter to Processing Team, Customer Services to Operations, Claims Officer to Claims, Finance / Accounts to Accounting and Accounting Manager, IT, Business and User Access Administrator to System Administrator. There is no deck for the Compliance Officer: use the Compliance Officer chapter of the user manual |
| Credentials sheet | Each user, privately | Kept outside the repository by the System Administrator (usernames and temporary passwords, or the provisioning CSV). Never commit it, e-mail it as a whole or store it with the templates; delete it once every user has signed in |
| Installation and go-live checklist | DevOps, System Administrator | [../../deploy/README.md](../../deploy/README.md) and [../../deploy/REFERENCE.md](../../deploy/REFERENCE.md) |
| Developer and production support guide | Production support | [../developer-guide/README.md](../developer-guide/README.md) |
