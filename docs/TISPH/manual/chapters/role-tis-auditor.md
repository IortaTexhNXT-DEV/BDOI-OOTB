<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-auditor.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build.
Screens to refresh: none of this chapter's own (the Data Migration & Go-Live screenshots are in the screen reference).
-->
# TIS Audit {#tis-audit-read-only}

## Role summary {#tis-audit-read-only-summary}

{{role-summary:tis-auditor}}

TIS Audit is the role of the internal and external auditors of the cut-over. You read the Data Migration & Go-Live
workspace (the loads and their approvals, the reconciliation and its signatures, the runs, the checklist, the Go / No-Go
decision, the lock and the hypercare figures) and the audit trail, and you change nothing: no tab of the workspace
offers you an action. Through the reports and the records you read, you tie the opening balances, the migrated
receivables and the business issued since go-live to the books. Personal data in every download and review is masked.

{{include:generated/roles/tis-auditor.md}}

## Daily and periodic tasks {#tis-audit-read-only-tasks}

| Task | When | Screen |
|---|---|---|
| Read the loads of the production run: who uploaded, submitted and approved each one, the counts per result | During the cut-over and the hypercare | [Data Migration & Go-Live](#data-migration-and-go-live) |
| Check the reconciliation: every difference explained and accepted by a user who did not load the data; the signed report | Before and after the Go / No-Go decision | [Data Migration & Go-Live](#data-migration-and-go-live) |
| Read the Go / No-Go decision, the criteria, the waivers and the votes, and the lock and unlock requests | At the decision; after every unlock | [Data Migration & Go-Live](#data-migration-and-go-live) |
| Check who changed what and when, with the values before and after | On request; monthly during the hypercare | [Audit Trail](#audit-trail) |

## Procedures {#tis-audit-read-only-procedures}

### Review a load {#tis-audit-read-only-review-load}

1. Choose {{menu:/master/configuration/go-live}} and open **Loads**.
2. Open the load. The header shows its number, the run, the file and its hash, who uploaded, submitted and approved it
   and when, and the counts per result.
3. **Rows** lists every row with its result; a **Changed** row shows the fields changed with the values before.
   **Duplicates** lists the matches and the decision taken on each, with the user and the reason.
4. **Activity** lists every action on the load: validation, submission, approval or rejection with its reason, load,
   undo request and decision.

### Review the reconciliation and the decision {#tis-audit-read-only-review-reconciliation}

1. On **Reconciliation**, open the reconciliation of the run. Each line shows the figure of the old system, the figure
   loaded, the difference and its explanation, who accepted it and who signed each slot. **Download report** gives the
   signed report; its hash is shown next to it.
2. On **Go-Live**, read the criteria with their results, the waivers with their reasons, the votes of the named
   approvers and the lock and unlock requests with their two users.
3. On **Runs**, open the production run for its checklist steps with owner, times and evidence, its defects and the
   **Evidence pack**.
