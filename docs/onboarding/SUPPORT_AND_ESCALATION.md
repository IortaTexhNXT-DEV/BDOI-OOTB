# Support and escalation

How users report a problem with BrokerVerse, how it is graded, the response targets and what production support
checks first. Contacts, hours and targets marked "to be agreed with the customer" are settled in the support agreement
before go-live; fill them in here once agreed.

## 1. Who to contact

| Level | Who | How |
|---|---|---|
| First line | Key user of the team (one trained person per team) | In person or team chat |
| Second line | Customer's System Administrator | Internal ticket or e-mail (to be agreed with the customer) |
| Third line | iorta TechNXT production support | Support mailbox or portal and telephone for severity 1 (to be agreed with the customer) |

The key user answers "how do I" questions and checks the problem is not a missing role or setting. The System
Administrator handles users, roles, passwords, two-step verification resets, settings and master data, and raises a
ticket to iorta TechNXT for anything else.

## 2. Reporting an issue

A report must contain:

1. the screen (menu path) and the record number (policy, quotation, receipt, voucher, journal);
2. the date and time, to the minute;
3. the request ID shown in the error message, if any;
4. what was done, what happened and what was expected;
5. a screenshot, with client personal data covered;
6. the username (never the password) and the role;
7. how many users are affected and whether work can continue.

Do not send passwords, two-step codes, the environment settings or full client ID numbers.

## 3. Severity levels and response targets

All targets are to be agreed with the customer. The figures below are a proposal to start the discussion.

| Severity | Meaning | Examples | First response | Workaround or fix |
|---|---|---|---|---|
| 1 Critical | The system is down or a core process is stopped for everyone, or data is wrong or exposed | Nobody can sign in; receipts cannot be issued; wrong amounts posted to the ledger | 1 business hour (to be agreed with the customer) | 1 business day (to be agreed with the customer) |
| 2 High | A core process is stopped for one team or has no workaround | Month-end close run fails; bank statement import refused for a valid file | 4 business hours (to be agreed with the customer) | 3 business days (to be agreed with the customer) |
| 3 Medium | A function fails but there is a workaround | A report column is wrong; an upload rejects one valid row | 1 business day (to be agreed with the customer) | Next planned release (to be agreed with the customer) |
| 4 Low | Question, cosmetic issue or change request | Wording, layout, new report request | 2 business days (to be agreed with the customer) | Planned with the customer |

Escalation: if a severity 1 or 2 issue has no response within the target, the System Administrator calls the
iorta TechNXT support lead, then the account manager (names and numbers to be agreed with the customer).

## 4. What production support checks first

The developer and production support guide is `docs/developer-guide/README.md`; the back-end details are in
`docs/developer-guide/backend.md`. In order:

1. **Request ID.** Every error message and API response carries one. Find the log lines with that ID; a server error
   has its real message and stack only in the log
   ([backend.md, section 6](../developer-guide/backend.md#6-logs-and-request-ids)).
2. **Health.** `GET /api/health` answers ready, database latency and pending migrations; 503 means not ready.
3. **Screen to route to table.** Find the route of the screen in the API touchpoint workbook
   (`backend/docs/api/BrokerVerse_API_Touchpoints.csv`) and follow it to the module and tables
   ([backend.md, section 5](../developer-guide/backend.md#5-tracing-a-defect-from-a-screen-to-the-database)).
4. **The usual suspects** for the area: sign-in and lockouts (`login_history`), document numbers, postings and
   closed periods, scheduled jobs, PDFs, the e-mail outbox
   ([backend.md, section 7](../developer-guide/backend.md#7-common-production-issues-and-where-to-look)).
5. **Configuration before code.** Rates, account codes, limits, e-mail texts and switches are settings in Master >
   Configuration. Check the setting and the Audit Trail (Master > Audit Trail) for a recent change.
6. **Uploads.** A rejected upload lists the failing rows with reasons. Compare the file with the template in
   `docs/package/05_Delivery/Upload_Templates` (headers, date format YYYY-MM-DD, plain numbers).

## 5. Changes and releases

Fixes and changes are delivered as a new release of the front end and the back end following
`deploy/README.md` (sections 2 to 4 and the rollback in section 8). Database migrations only add; a
database snapshot is taken before each release. The customer tests a release in a test environment before it goes to
production, using the scripts in `UAT_SCRIPTS.md`.
