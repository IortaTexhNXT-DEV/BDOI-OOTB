# BrokerVerse onboarding kit

Everything to hand to the customer's users and administrators at go-live, and where it is.

| Item | For | Where |
|---|---|---|
| Getting started guide | Every user | [GETTING_STARTED.md](GETTING_STARTED.md): first sign-in, password rules, two-step verification, menus per role, how to get help |
| Go-live data set-up | System Administrator and Accounting | [GO_LIVE_DATA_SETUP.md](GO_LIVE_DATA_SETUP.md): the order of set-up, from company and users to opening balances and the first month-end |
| Support and escalation | Key users, System Administrator | [SUPPORT_AND_ESCALATION.md](SUPPORT_AND_ESCALATION.md): how to report an issue, severity levels, response targets (to be agreed with the customer), what support checks first |
| User acceptance test scripts | Key users of each role | [UAT_SCRIPTS.md](UAT_SCRIPTS.md): 5 to 8 scenarios per role for the first week |
| Upload templates | People preparing data | [../templates](../templates/README.md): one XLSX per upload with a Data, Columns and Instructions sheet, and the verification results |
| User manual | Every user | [../manual/BrokerVerse_User_Manual.pdf](../manual/BrokerVerse_User_Manual.pdf) (also .docx) |
| Role decks | Trainers and new users | [../decks](../decks/README.md): one PowerPoint per persona. The decks were written for the earlier persona set; map them to the broker roles as follows: Sales / Relationship Manager and Agent / Referrer to Sales & Marketing, Underwriter to Processing Team, Customer Services to Operations, Claims Officer to Claims, Finance / Accounts to Accounting and Accounting Manager, IT, Business and User Access Administrator to System Administrator |
| Credentials sheet | Each user, privately | Kept outside the repository by the System Administrator (usernames and temporary passwords, or the provisioning CSV). Never commit it, e-mail it as a whole or store it with the templates; delete it once every user has signed in |
| Installation and go-live checklist | DevOps, System Administrator | [../GO_LIVE_CHECKLIST.md](../GO_LIVE_CHECKLIST.md) and [../DEPLOY.md](../DEPLOY.md) |
| Developer and production support guide | Production support | [../developer-guide/README.md](../developer-guide/README.md) |
