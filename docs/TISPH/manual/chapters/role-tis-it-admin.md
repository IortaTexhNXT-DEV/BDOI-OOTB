<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-it-admin.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.it-admin.
Screens to refresh: none of this chapter's own.
The user acceptance testing role is not a TISPH role and is not described: its clean-up before go-live belongs to the
cut-over plan.
-->
# TIS IT AppSupport / Admin {#tis-it-appsupport-admin}

## Role summary {#tis-it-appsupport-admin-summary}

{{role-summary:tis-it-admin}}

TIS IT AppSupport / Admin runs the system for the business. You create the user accounts and give them their TISPH
role, unlock accounts and reset passwords, maintain the access of the roles, the approval limits, the delegations and
the segregation-of-duties rules, and run the quarterly access reviews. You also keep the reference masters (insurers,
products, covers, vehicles, branches, banks), the products of the Product Configurator, the document layouts and
numbering, the scheduled jobs and the interfaces (SMS, e-mail, CTPL authentication, insurers, banks).

You read the business data to answer support questions. As delivered, the role also sets up the dealer programmes
and uploads the dealers' sales files (see [Dealer programme policies](#process-dealer-programme)); apart from these,
you enter no business or accounting transaction. Every
change of access you make waits for another user of this role: TISPH needs at least two users with this role. You work
with the department heads, who ask for the access of their staff, with TIS Finance & General Accounting, who approves
the changes to the posting rules, and with the TIS General Manager, who decides the approval limits.

{{include:generated/roles/tis-it-admin.md}}

## Daily and periodic tasks {#tis-it-appsupport-admin-tasks}

| Task | When | Screen |
|---|---|---|
| Decide the changes of access of the other administrator waiting for you | Every morning and through the day | [My Work](#my-work), [Role Permissions](#roles-and-role-permissions) |
| Check the scheduled jobs: last run, last status, failures | Every morning | [Schedules](#schedules) |
| Check the messages waiting or failed: e-mails, SMS, insurer and bank interfaces | Every morning | [E-mail Outbox](#e-mail-outbox), [Integrations](#integrations) |
| Create accounts for new staff; deactivate leavers | On the request of the department head; on the last working day | [User](#users) |
| Unlock an account, reset a password, turn off two-step verification after a lost phone | On the user's request | [User](#users) |
| Change the access of a role | On an approved access request | [Role Permissions](#roles-and-role-permissions) |
| Record the approval limits decided by Management | When Management changes them | [Authority Matrix](#authority-matrix) |
| Record the cover for an approver who is away | Before the leave | [Delegations](#delegations) |
| Follow the segregation-of-duties conflicts and their exceptions | Weekly | [Segregation of Duties](#segregation-of-duties), [User Access Matrix](#user-access-matrix) |
| Review the access of every user | At least every quarter | [Access Reviews](#access-reviews) |
| Set up the dealer programmes and upload the dealers' sales files | When a programme is agreed; as the dealers send their files | [Dealer Programmes](#dealer-programmes) |
| Maintain the reference masters | On the request of the business | [Masters that work the same way](#masters-that-work-the-same-way) |
| Configure products, covers, rating and acceptance rules | On the request of the business | [Product Templates](#product-templates) |
| Maintain the document layouts, signatures and numbering | On the request of the business | [Documents and Reports Layout](#documents-and-reports-layout), [Document Numbering](#document-numbering) |
| Answer audit questions: who changed what and when | On request | [Audit Trail](#audit-trail) |

## Procedures {#tis-it-appsupport-admin-procedures}

### Create a user account {#tis-it-appsupport-admin-create-user}

1. Choose {{menu:/master/generals/usermanagement/user}} and select **Add**.
2. Type the **Username**, the **E-mail** and the **Display Name**.
3. Leave **Password** empty: the system creates a temporary password.
4. Select the **Branch**, the **Designation** and **Reporting to**.
5. Under **Roles**, tick the TISPH role of the user. The roles are grouped by department, each with a one-line summary.
6. Select **Save**.
7. The temporary password is shown once. Give it to the user in person or by phone. The user must choose a new
   password at the first sign-in.

Users who sign in with **Sign in with Microsoft** are matched to their account by e-mail: the **E-mail** (or the
**Username**) must be the user's Microsoft 365 address. At the first sign-in the account is bound to that Microsoft
account; later sign-ins must come from the same Microsoft account. When you give roles that one person should not hold together, the system warns
you, or refuses a combination its rule blocks; see [Segregation of Duties](#segregation-of-duties).

![Master > Users and Access > User > Add User, with the TISPH roles grouped by department](images/role-tis-it-admin/add-user.png)

> You cannot change your own account or roles, nor give a role that includes the built-in administrator. Another
> administrator changes your account.

### Unlock an account or reset a password {#tis-it-appsupport-admin-account-actions}

1. Choose {{menu:/master/generals/usermanagement/user}} and find the user.
2. Open the account actions of the user's row and select one of:
   - **Unlock**: the account is unlocked and its failed sign-in attempts are cleared. Confirm with **Unlock account**.
   - **Reset password**: the account receives a temporary password, shown once; the user's sessions end and the user
     must choose a new password at the next sign-in. Give the password to the user in person or by phone.
   - **Turn off two-step verification** (for example after a lost phone): the user signs in with the password alone
     until two-step verification is set up again.
   - **Sign-in history**: the user's sign-ins with the device and the result.

To stop a leaver from signing in, switch off the **Status** of the user in the list; the account is inactive. Each action is recorded in the
[Audit Trail](#audit-trail). See [Users](#users).

### Change the access of a role {#tis-it-appsupport-admin-role-access}

1. Choose {{menu:/master/generals/usermanagement/role-permissions}}.
2. On **By role**, select the role. The modules of the role show their access: **View**, **Create and edit**,
   **Approve**.
3. Select **Edit access** and switch the access on or off module by module. The bar at the bottom counts the changes.
4. Select **Review and submit**. The system lists the segregation-of-duties rules the change would break, for the
   role and for its users.
5. Select the reason and submit the change. It waits on **Waiting for approval**; one change per role waits at a time.
6. Another user of TIS IT AppSupport / Admin opens **Waiting for approval** (or My Work) and selects **Approve**, or
   **Reject** with the reason. The change applies at once to every active user of the role, whose sessions are
   renewed.

The approver is never the requester and must not hold the role changed. You cannot change a role you hold: a change to
the TIS IT AppSupport / Admin role itself is made by the built-in administrator. The requester can **Withdraw** a change
before it is decided. Use **Compare roles** to see two roles side by side and **Export to Excel** for the access of
every role. See [Roles and role permissions](#roles-and-role-permissions).

![Master > Users and Access > Role Permissions, the access of the TIS Sales Associate open with Edit access](images/role-tis-it-admin/role-permissions-edit.png)

### Record approval limits {#tis-it-appsupport-admin-authority-matrix}

1. Choose {{menu:/master/generals/usermanagement/authority-matrix}}. The matrix shows the transactions down and the
   approver roles across, by department, with the limit in effect in each cell; a cell without a limit shows
   **Not set**.
2. Select the cell and **Set a limit** (amount in PHP), or no limit, with the **Effective from** date (today or
   later), the **Authority reference** and its **Reference date**, and the **Remarks for the approver**. To change many cells at once, select **Download**, fill the file
   and select **Upload**: the whole file is checked and nothing is saved while one row is wrong.
3. Submit the change. It waits on **Pending approval**.
4. Another user of TIS IT AppSupport / Admin approves it, or rejects it with the reason. The limits apply from their
   effective date.

Nobody approves a change to his or her own personal limit or to the limit of a role he or she holds. While a cell is
**Not set**, the delivered rule lets the approver approve without an amount check (shown as "Approver without a limit:
may approve"). See [Authority Matrix](#authority-matrix).

### Record a delegation {#tis-it-appsupport-admin-delegation}

1. Choose {{menu:/master/generals/usermanagement/delegations}} and select **New delegation**.
2. Select the approver who is away, the person covering, the transactions and the dates (from today, for a limited
   number of days), and the reason.
3. Submit. The delegation waits for approval by another user of TIS IT AppSupport / Admin, who is neither the
   requester nor the person covering.

Once approved, the person covering approves the chosen transactions with the limit of the approver who is away, for
the dates chosen; both people are told. Select **End early** with the **Reason for ending** to stop a delegation. See
[Delegations](#delegations).

### Follow segregation-of-duties conflicts {#tis-it-appsupport-admin-conflicts}

1. Choose {{menu:/master/generals/usermanagement/segregation-of-duties}}.
2. On **Conflicts**, check each user with an **Open** conflict: the roles held, the rule broken and its state.
3. Remove the conflicting role from the user, or select **Request exception** with a reason and an end date. The
   exception waits for approval by another administrator; the person concerned does not approve it.

New rules (**New rule**), changes (**Edit rule**) and switching a rule off (**Switch off**) also wait for the approval of
another administrator. A **Block** rule refuses the combination of roles when they are given; a **Warn** rule allows it
and lists the person here. The delivered TISPH rules warn. The {{menu:/master/generals/usermanagement/access-matrix}}
shows, for each user, the roles, the last sign-in, two-step verification, the password age and the conflicts. See
[Segregation of Duties](#segregation-of-duties) and [User Access Matrix](#user-access-matrix).

### Run the quarterly access review {#tis-it-appsupport-admin-access-review}

1. Choose {{menu:/master/generals/usermanagement/access-reviews}} and select **Start a review**.
2. Check the **Review** name and the **Due** date; choose the **Scope**: **All active users**, **Departments** or
   **Roles**. The window counts the users to be reviewed. Select **Start**.
3. For each user, with the department head, decide: **Keep access**, **Remove roles** or **Deactivate account** (a
   removal needs a reason). You cannot decide your own line.
4. When every line is decided, select **Submit for sign-off**.
5. Another user of TIS IT AppSupport / Admin, who decided none of its lines, selects **Sign off**. The roles removed are taken away, the
   accounts deactivated and the users' sessions renewed; the review is closed.

See [Access Reviews](#access-reviews).

![Master > Users and Access > Access Reviews, the Start a review window](images/role-tis-it-admin/access-review-start.png)

### Maintain a reference master {#tis-it-appsupport-admin-masters}

1. Choose the master on the Master menu, for example {{menu:/master/generals/insurancemanagement/insurancecompany}} or
   {{menu:/master/generals/insurancemanagement/vehicle}}.
2. Select **Add** for a new record, or the edit icon of a record; fill in the form and save.
3. To withdraw a record, set it inactive rather than deleting it: the records already using it keep it.

Some finance masters (posting rules, account determination, account roles) are maintained by TIS Finance &
General Accounting; a change you propose to the accounting accounts waits for their approval on
{{menu:/master/finance/configuration-approvals}}. See [Masters that work the same way](#masters-that-work-the-same-way),
[Insurance companies](#insurance-companies) and [Distribution Channels](#distribution-channels).

### Configure a product {#tis-it-appsupport-admin-product}

1. Choose {{menu:/product-configurator/templates}}. The template marked **In use** is the one the business applies to
   its product.
2. Select **Create Template**, or the edit icon of a template, and set its covers
   ({{menu:/product-configurator/coverages}}), rating ({{menu:/product-configurator/rating}}), acceptance rules
   ({{menu:/product-configurator/underwriting}}), documents ({{menu:/product-configurator/documents}}) and insurer
   market ({{menu:/product-configurator/market-mapping}}).
3. Select **Activate** and confirm with **Activate template**. The template applies to new quotations; quotations
   already issued are not changed. **Deactivate** stops its use for new quotations.

See [Product Templates](#product-templates) and the other sections of the Product Configurator.

### Watch the scheduled jobs {#tis-it-appsupport-admin-schedules}

1. Choose {{menu:/master/configuration/schedules}}. Each job shows what it does, its schedule (Asia/Manila time), its
   status (**Scheduled** or **Switched off**), the next run, the last run and the last status.
2. Select the run history icon of a job to see its runs and the error of a failed run.
3. To run a job outside its schedule, select the run icon and confirm with **Run job**: what the job sends or updates
   is sent or updated as on a scheduled run.
4. To change the schedule of a job or switch it on or off (**Enabled**), select **Edit schedule**.

Agree with TIS Finance & General Accounting before you switch on or reschedule an accounting job (recurring journals,
accrual auto-reversal, period auto soft-close, SAP GL export). See [Schedules](#schedules).

![Master > System > Schedules, the jobs with their schedule and status](images/role-tis-it-admin/schedules.png)

### Resend a message that failed {#tis-it-appsupport-admin-messages}

1. Choose {{menu:/master/configuration/integrations}}. **Connectors** shows each interface with its mode, the messages
   waiting, failed and sent today, and the last success and failure.
2. Open **Outbox** to see the messages sent and failed, with the error; resend or cancel a failed message.
3. Select **Send due messages** to send the messages waiting now.
4. For e-mails, choose {{menu:/master/configuration/email-outbox}}: each e-mail shows its status, attempts and last
   error.

See [Integrations](#integrations), [E-mail Outbox](#e-mail-outbox) and [Insurer integration](#insurer-integration).
