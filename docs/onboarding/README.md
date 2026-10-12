# BrokerVerse onboarding kit for TISPH

Everything to hand to the users and administrators of Toyota Insurance Services Philippines (TISPH) at go-live, and
where it is. Version 1.2, 11 October 2026, iorta TechNXT.

The TISPH documents (functional specifications, the document pack and the test pack) are indexed in
[`docs/TISPH/README.md`](../TISPH/README.md); the Document Register (`docs/TISPH/pack/TISPH_Document_Register.docx`)
says where each required document is held. Support model, scheduled jobs and runbooks:
`docs/TISPH/pack/TISPH_Operations_and_Support.docx`; environments and release:
`docs/TISPH/pack/TISPH_Environments_and_Release.docx`; data migration and cutover:
`docs/TISPH/pack/TISPH_Data_Migration_and_Cutover.docx`; training: `docs/TISPH/pack/TISPH_Delivery_Governance.docx`
(sections 10 and 11).

| Item | For | Where |
|---|---|---|
| Getting started guide | Every user | [GETTING_STARTED.md](GETTING_STARTED.md): first sign-in, password rules, two-step verification, the side menu and menu search, the TISPH roles, My Work, masked personal identifiers, the Help panel (F1) and how to get help |
| Go-live data set-up | TISPH IT AppSupport and Finance | [GO_LIVE_DATA_SETUP.md](GO_LIVE_DATA_SETUP.md): the order of set-up, from company and users to opening balances and the first month-end |
| Branding and e-signatures | TISPH IT AppSupport, onboarding lead | [BRANDING_AND_SIGNATURES.md](BRANDING_AND_SIGNATURES.md): theme, sign-in page, documents, reports and e-mails per broker; signature capture and mapping; brand packs between environments; client trademark permission; support procedures for brand pack import and e-signature revocation |
| Smoke test and transaction reset | TISPH IT AppSupport, DevOps | [SMOKE_TEST_AND_RESET.md](SMOKE_TEST_AND_RESET.md): where to run the smoke test, then `npm run reset:transactions` to remove its transactions while masters, configuration and users stay, and the go-live lock |
| Client data masking | DevOps / DBA, Data Protection Officer | [DATA_MASKING.md](DATA_MASKING.md): `npm run mask:data` masks the personal data of a copy of production before it is used in SIT, UAT, Pre-Prod, training or support; refresh rules, procedure, evidence to keep |
| Go-live rehearsal | TISPH IT AppSupport, DevOps, migration lead | `npm run rehearsal:golive` ([GO_LIVE_DATA_WORKBENCH.md](GO_LIVE_DATA_WORKBENCH.md#go-live-rehearsal)): configuration promotion, smoke test and reset, migration with reconciliation, new and migrated data, go-live lock, rehearsed between two environments; run log [../e2e/GOLIVE_REHEARSAL_RUN.md](../e2e/GOLIVE_REHEARSAL_RUN.md) |
| Environment comparison | TISPH IT AppSupport, DevOps, auditors | Master > Go-Live Data Load > Compare environments, or `npm run compare:environments` in a release pipeline ([GO_LIVE_DATA_WORKBENCH.md](GO_LIVE_DATA_WORKBENCH.md#compare-environments)): proves configuration and masters are mirrored between environments (verdict *Mirrored* or *Differences found*, field-level differences, environment-specific values apart) and gives the comparison workbook |
| Support and escalation | Key users, TISPH IT AppSupport | [SUPPORT_AND_ESCALATION.md](SUPPORT_AND_ESCALATION.md): how to report an issue, severity levels, response targets (to be agreed with TISPH), what support checks first, support procedures by area (integrations, EIS, scheduled jobs, keys, brand packs, e-signatures) |
| Production support procedures, scheduled jobs and their runbooks | Production support, DevOps | `docs/TISPH/pack/TISPH_Operations_and_Support.docx` (sections 4 to 10): support model, monitoring, every scheduled job of the TISPH build with its switch, runbooks, encryption key custody and rotation (`npm run pii:rotate`) |
| User acceptance test scripts | Key users of each TISPH role | [UAT_SCRIPTS.md](UAT_SCRIPTS.md): first-week scenarios per TISPH role; the TISPH UAT test cases are in `docs/TISPH/testing/` |
| Upload templates | People preparing data | [../package/05_Delivery/Upload_Templates](../package/05_Delivery/Upload_Templates/README.md): one XLSX per upload with a Data, Columns and Instructions sheet, and the verification results |
| User manual | Every user | The TISPH user manual, one chapter per TISPH role: in the Help panel (F1), which opens the section of each screen, and as Word and PDF downloaded from it (`brokerverse/public/help/TISPH_User_Manual.docx`, `.pdf`, regenerated after the build; source [`docs/TISPH/manual/`](../TISPH/manual/README.md)) |
| Credentials sheet | Each user, privately | Kept outside the repository by TISPH IT AppSupport (usernames and temporary passwords, or the provisioning CSV). Never commit it, e-mail it as a whole or store it with the templates; delete it once every user has signed in |
| Deployment | DevOps, TISPH IT AppSupport | [../../deploy/README.md](../../deploy/README.md) (TISPH DEV on Railway, Azure environments) and [../../deploy/REFERENCE.md](../../deploy/REFERENCE.md) |
| Developer and production support guide | Production support | [../developer-guide/README.md](../developer-guide/README.md) |
