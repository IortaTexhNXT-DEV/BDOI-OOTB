# Support and escalation

Version 1.2, 11 October 2026, iorta TechNXT. Changes: tailored for TISPH: the support steps of the modules removed
from the TISPH build (compliance and AML, complaints, data-privacy breach deadlines) are taken out, and releases follow
the TISPH route (section 5).

How users at Toyota Insurance Services Philippines (TISPH) report a problem with BrokerVerse, how it is graded, the
response targets and what production support checks first. Contacts, hours and targets marked "to be agreed with
TISPH" are settled in the support agreement before go-live; fill them in here once agreed.

The TISPH support model, incident, problem and change management, the scheduled jobs and the runbooks are in
`docs/TISPH/pack/TISPH_Operations_and_Support.docx` (index: [`docs/TISPH/README.md`](../TISPH/README.md)); this guide
is the user-facing part of it.

## 1. Who to contact

| Level | Who | How |
|---|---|---|
| First line | Key user of the team (one trained person per team) | In person or team chat |
| Second line | TISPH IT AppSupport (role TIS IT AppSupport / Admin) | Internal ticket or e-mail (to be agreed with TISPH) |
| Third line | iorta TechNXT production support | Support mailbox or portal and telephone for severity 1 (to be agreed with TISPH) |

The key user answers "how do I" questions and checks the problem is not a missing role or setting. TISPH IT
AppSupport handles users, roles, passwords, two-step verification resets, settings and master data, and raises a
ticket to iorta TechNXT for anything else.

## 2. Reporting an issue

A report must contain:

1. the screen (menu path) and the record number (policy, quotation, receipt, voucher, journal);
2. the date and time, to the minute;
3. the request ID shown in the error message, if any;
4. what was done, what happened and what was expected;
5. a screenshot, with client personal data covered;
6. the username (never the password), the role, and the version and environment shown under **About BrokerVerse**
   in the Help panel (F1);
7. how many users are affected and whether work can continue.

Do not send passwords, two-step codes, the environment settings or full client ID numbers.

## 3. Severity levels and response targets

All targets are to be agreed with TISPH in the support agreement. The figures below are a proposal to start the discussion.

| Severity | Meaning | Examples | First response | Workaround or fix |
|---|---|---|---|---|
| 1 Critical | The system is down or a core process is stopped for everyone, or data is wrong or exposed | Nobody can sign in; receipts cannot be issued; wrong amounts posted to the ledger | 1 business hour (to be agreed with TISPH) | 1 business day (to be agreed with TISPH) |
| 2 High | A core process is stopped for one team or has no workaround | Month-end close run fails; bank statement import refused for a valid file | 4 business hours (to be agreed with TISPH) | 3 business days (to be agreed with TISPH) |
| 3 Medium | A function fails but there is a workaround | A report column is wrong; an upload rejects one valid row | 1 business day (to be agreed with TISPH) | Next planned release (to be agreed with TISPH) |
| 4 Low | Question, cosmetic issue or change request | Wording, layout, new report request | 2 business days (to be agreed with TISPH) | Planned with TISPH |

Escalation: if a severity 1 or 2 issue has no response within the target, TISPH IT AppSupport calls the
iorta TechNXT support lead, then the account manager (names and numbers to be agreed with TISPH).

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
   closed periods, scheduled jobs, PDFs, the e-mail outbox, the integrations outbox (SMS, CTPL authentication,
   insurer requests, bank files), the EIS outbox, and personal identifiers shown masked because the role lacks
   `view:pii`
   ([backend.md, section 7](../developer-guide/backend.md#7-common-production-issues-and-where-to-look)).
5. **Configuration before code.** Rates, account codes, limits, e-mail texts and switches are settings in Master >
   Configuration. Check the setting and the Audit Trail (Master > Audit Trail) for a recent change.
6. **Uploads.** A rejected upload lists the failing rows with reasons. Compare the file with the template in
   `docs/package/05_Delivery/Upload_Templates` (headers, date format YYYY-MM-DD, plain numbers).

## 5. Changes and releases

Fixes and changes are merged into the branch `TISPH-DEV`. Every push deploys DEV automatically (today on Railway,
`deploy/RAILWAY.md`). SIT, UAT and production receive the same build through the Azure pipeline (`azure-deploy.yml`,
`deploy/AZURE.md`) after approval by their reviewers; UAT is set up only after TISPH confirms. Database migrations
only add; on Azure a failed smoke test restores the previous images. The environments, approvals, rollback and hotfix
route are described in `docs/TISPH/pack/TISPH_Environments_and_Release.docx`. TISPH tests a release in UAT before it
goes to production, using the scripts in `UAT_SCRIPTS.md` and the TISPH test pack.

## 6. Support procedures by area

The full procedures, the scheduled jobs and their runbooks are in `docs/TISPH/pack/TISPH_Operations_and_Support.docx`
(sections 9 and 10). In short:

| Area | First line (key user, TISPH IT AppSupport) | Third line (iorta TechNXT) |
|---|---|---|
| SMS, CTPL authentication, insurer requests, bank files not going out | Master > System Configuration > Integrations: is the connector Enabled and Live, what does Last error say? Correct the client data and **Resend**; **Cancel message** what must not go | Provider down, credentials rejected, messages stuck; credentials are set by DevOps in the secret store, never on the screen |
| E-invoices to the BIR EIS failed or rejected | Accounts > Tax > E-Invoicing (EIS): rejected means cancel and reissue the invoice; failed is retried | Connector settings, submissions stuck in sending, manual upload fallback |
| A scheduled job did not run or failed (for example renewal notices, the e-mail outbox, period-end or SAP GL export jobs) | Master > Schedules: is the job on and did its last run succeed? Tell the business owner when a deadline depends on it | Restore the job the same day; job list and runbook per job in the TISPH operations document, section 9 |
| Personal identifiers unreadable for everyone (TIN, ID, bank numbers) | Report as severity 1 | Wrong or missing `PII_ENCRYPTION_KEY` after a deployment or restore; key custody and rotation follow the documented procedure |
| Branding wrong (default colours, logo or name instead of the client's) | With `BRAND_PACK` set: restart the API; the start-up log names what differed and the pack is applied again. Without it: import the pack exported before the change (`POST /api/branding/brand-pack`) | Brand pack checks; a client brand pack only in that client's environments, under its contract with iorta TechNXT |
| A signature must stop printing | Master > Generals > Insurance Management > Signatories (or the user), E-signature, **Revoke** with the reason | Audit of the documents issued with the version when misuse is suspected |

