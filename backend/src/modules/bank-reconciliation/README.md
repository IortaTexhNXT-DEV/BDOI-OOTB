# Bank reconciliation

Matches bank statement lines with the cash-account lines of the ledger and produces the monthly bank reconciliation
statement. Routes are under `/bank-reconciliation` (Accounts > Bank Reconciliation; set-up under Master > Finance).
Permissions: `read:bank-reconciliation` to view, `write:bank-reconciliation` to import, match, adjust and prepare,
`approve:bank-reconciliation` (Accounting Manager) to approve and reopen. The approver must not be the preparer.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes: bank accounts, statement formats, transaction types, match rules, statements, matching workspace, stale cheques, reconciliation runs. |
| `statements.js` | Parses a bank CSV / XLSX with a statement format, previews, imports, refuses duplicates. |
| `matching.js` | Automatic rules (adjustment, contra, reference, amount-date, one-to-many, many-to-one) and manual matches. |
| `adjustments.js` | Journals for bank-side items (charges, interest, direct credits) and returned cheques. The only place this module posts. |
| `reconcile.js` | Reconciliation runs (`BRC-` numbers): draft, prepared, approved, reopened; the statement figures. |
| `common.js` | Bank account look-up, dates and the "period already reconciled" guard. |
| `jobs.js` | `bank-auto-match` job (disabled by default). |

Sign convention everywhere: a bank line amount is credit minus debit (money in is positive); a book line amount is the
GL debit minus credit on the cash account.

## Main tables

`bank_statement_formats`, `bank_transaction_types`, `bank_match_rules`, `bank_statements`, `bank_statement_lines`,
`bank_rec_matches`, `bank_rec_match_items`, `bank_reconciliations`, `bank_reconciliation_history`. The bank account
master is a master type (`master_records`), linked to a GL cash account.

## Main flows

1. Import a statement (or enter it by hand). The import dialog offers the upload template of the GENERIC format
   (`GET /bank-reconciliation/statements/template`, Data, Columns and Instructions sheets). The statement must balance when
   `bank_reconciliation.require_balanced_statement` is on. Automatic matching runs after import when
   `bank_reconciliation.auto_match_on_import` is on.
2. Match the rest by hand. A difference is explained as an adjustment journal, a bank error or a book error.
3. Prepare the reconciliation for the period, then a second user approves it. Approval locks the matches cleared up
   to the period end.

## Key settings

`bank_reconciliation.date_window_days` (amount-date rule), `bank_reconciliation.group_max_lines` (one-to-many and
many-to-one search), `bank_reconciliation.stale_cheque_days`, `bank_reconciliation.check_from_period` (first period the
month-end checklist looks at), `bank_reconciliation.require_balanced_statement`, `bank_reconciliation.auto_match_on_import`.

## Debugging

- "This file was already imported for ...": the file hash is on an earlier statement of the same account. Delete that statement if
  it was wrong, then import again.
- A line does not auto-match: the rules only match exact amounts, and amount-date needs exactly one candidate on each
  side inside the date window. Look at the candidates on the matching workspace or match it by hand.
- The statement does not agree with the GL: the book balance is `pe_balance_before` on the cash account, which includes
  year-end opening balances. Check that the bank account master points to the right GL cash account.
- A match cannot be undone: the reconciliation that cleared it is approved. Reopen the reconciliation (approver, with
  remarks) first.
