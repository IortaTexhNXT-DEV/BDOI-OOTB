# BrokerVerse onboarding kit

Everything to hand to the customer's users and administrators at go-live, and where it is.

| Item | For | Where |
|---|---|---|
| Getting started guide | Every user | [GETTING_STARTED.md](GETTING_STARTED.md): first sign-in, password rules, two-step verification, menus per role, how to get help |
| Go-live data set-up | System Administrator and Accounting | [GO_LIVE_DATA_SETUP.md](GO_LIVE_DATA_SETUP.md): the order of set-up, from company and users to opening balances and the first month-end |
| Smoke test and transaction reset | System Administrator, DevOps | [SMOKE_TEST_AND_RESET.md](SMOKE_TEST_AND_RESET.md): where to run the smoke test, then `npm run reset:transactions` to remove its transactions while masters, configuration and users stay, and the go-live lock |
| Go-live rehearsal | System Administrator, DevOps, migration lead | `npm run rehearsal:golive` ([GO_LIVE_DATA_WORKBENCH.md](GO_LIVE_DATA_WORKBENCH.md#go-live-rehearsal)): configuration promotion, smoke test and reset, migration with reconciliation, new and migrated data, go-live lock, rehearsed between two environments; run log [../e2e/GOLIVE_REHEARSAL_RUN.md](../e2e/GOLIVE_REHEARSAL_RUN.md) |
| Support and escalation | Key users, System Administrator | [SUPPORT_AND_ESCALATION.md](SUPPORT_AND_ESCALATION.md): how to report an issue, severity levels, response targets (to be agreed with the customer), what support checks first |
| User acceptance test scripts | Key users of each role | [UAT_SCRIPTS.md](UAT_SCRIPTS.md): 5 to 8 scenarios per role for the first week |
| Upload templates | People preparing data | [../package/05_Delivery/Upload_Templates](../package/05_Delivery/Upload_Templates/README.md): one XLSX per upload with a Data, Columns and Instructions sheet, and the verification results |
| User manual | Every user | [../manual/BrokerVerse_User_Manual.pdf](../manual/BrokerVerse_User_Manual.pdf) (also .docx) |
| Role decks | Trainers and new users | [../decks](../decks/README.md): one PowerPoint per persona. The decks were written for the earlier persona set; map them to the broker roles as follows: Sales / Relationship Manager and Agent / Referrer to Sales & Marketing, Underwriter to Processing Team, Customer Services to Operations, Claims Officer to Claims, Finance / Accounts to Accounting and Accounting Manager, IT, Business and User Access Administrator to System Administrator |
| Credentials sheet | Each user, privately | Kept outside the repository by the System Administrator (usernames and temporary passwords, or the provisioning CSV). Never commit it, e-mail it as a whole or store it with the templates; delete it once every user has signed in |
| Installation and go-live checklist | DevOps, System Administrator | [../../deploy/README.md](../../deploy/README.md) and [../../deploy/REFERENCE.md](../../deploy/REFERENCE.md) |
| Developer and production support guide | Production support | [../developer-guide/README.md](../developer-guide/README.md) |
