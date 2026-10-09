# Insurer statement reconciliation

Reconciles an insurer's statement of account with the broker's records: premium remittance confirmations (what the
insurer says it received for broker-billed policies) and commission statements (commission the insurer recognises on
direct-bill policies). Routes are under `/insurer-reconciliation` (Accounts > Insurer Reconciliation; column mappings
under Master > Finance > Insurer Statement Formats). Permissions: `read:remittance` to view, `write:remittance` to
import, match, resolve and submit, `approve:insurer-reconciliation` (Accounting Manager) to approve or reject. The
approver must not be the preparer or the submitter.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes: formats, statements, preview / import, matching, resolutions, workflow, report download. |
| `statements.js` | Formats (column mapping per insurer) and parsing a CSV / XLSX into statement lines; import (duplicate file check). |
| `matching.js` | Broker records a line can match, automatic and manual matching, the differences report and resolutions. |
| `reconcile.js` | Statement list and detail, submit / approve / reject / cancel, adjustment journals on approval, report rows and PDF. |

## Main tables

`insurer_statement_formats`, `insurer_statements` (ISR number, series `insurer_statement`), `insurer_statement_lines`,
`insurer_statement_resolutions`.

## Main flows

1. Import the statement file with the insurer's format (else the generic one): insurer, type (premium or commission),
   period, the insurer's statement reference and the amount tolerance. A row that cannot be read stops the import; the
   same file cannot be imported twice for an insurer. The import dialog offers the upload template of the GENERIC format
   (`GET /insurer-reconciliation/statements/template`).
2. Automatic matching: by policy number (ignoring case, spaces and dashes) to a remittance line (premium statement) or
   commission debit note line (commission statement), then any other record of the policy; the closest gross premium
   wins. A line whose policy number is unknown is matched on gross premium within the tolerance and the insured name
   when exactly one record of the period fits. Premium, commission, taxes and, on premium statements, amount paid are
   compared within the tolerance; an amount the insurer left blank is not compared.
3. Differences: lines not found at the broker, broker records of the period missing on the statement (remittance or
   debit note lines dated in the period) and amount differences. Each is resolved with a note or an adjustment:
   premium adjustment (+ = more premium due to the insurer) and commission adjustment (+ = less commission for the
   broker; offset on the commission receivable for direct bill, on the premium due to the insurer otherwise).
4. Submit (with `insurer_reconciliation.require_resolved`, everything must be resolved), then a second user with
   `approve:insurer-reconciliation` approves: every adjustment posts through the posting rule
   `insurer_statement.adjustment` and the statement is locked. Rejecting sends it back to draft with the reason.
5. The differences report downloads as Excel (reconciliation and summary sheets), CSV or PDF.

## Key settings

`insurer_reconciliation.amount_tolerance` (default for new statements), `insurer_reconciliation.require_resolved`.

## Debugging

- "The file does not have the columns of format ...": the header row does not contain the mapped texts. Check the rows
  to skip and the column mapping of the format; the message lists the headers found.
- A line stays unmatched although the policy exists: the policy belongs to another insurer (co-insurance lead
  insurer), or its record is already matched to another line of the statement. Match it by hand.
- An adjustment journal fails on approval: the posting rule `insurer_statement.adjustment` or an account role it uses is
  not set up; simulate the rule on Master > Finance > Posting Rules.
