# Journal vouchers

Manual journal vouchers with maker-checker, correction and reversal vouchers, the journal voucher upload and the
approval of system journals parked for approval. Routes under `/journal-vouchers` (Accounts > Journal Voucher,
Correction JV, Reversal JV). Permissions: `read:journal-vouchers`, `write:journal-vouchers`; the approver's limit is the
Authority Matrix transaction type `journal_voucher`.

## Files

| File | What it does |
|---|---|
| `router.js` | Register, voucher detail and PDF, create, correction, reversal, approve, reject, upload and its template. |
| `service.js` | Vouchers to ledger lines (currency conversion, cost centres), the register, approval and rejection, the upload (`JV_UPLOAD_COLUMNS`, `uploadVouchers`). |

The ledger itself (numbering, validation, posting, reversal) is `modules/accounting/lib/ledger.js`.

## Main flows

- A manual voucher is saved `for-approval` (`journal.require_approval`) and posted by a different user on approval
  (`finance.maker_checker_enabled`), within the approver's Authority Matrix limit. A correction voucher reverses the
  original and posts the corrected lines in one voucher; a reversal voucher mirrors a posted one.
- Each line may name a cost centre (Master > Finance > Cost Centres, active and valid on the voucher date); a line
  without one takes the default cost centre.
- Upload (TIS-BRD-NIA-05): the template (`GET /upload/template`, sheets Data, Columns, Instructions) has one row per
  journal line; rows with the same Voucher Ref make one voucher. The whole file is checked first: one date and
  transaction code per voucher, Debit or Credit on each row, debits equal credits, accounts active and open to manual
  entries, cost centres valid, the period open for posting. Any error saves nothing and lists every row to fix. The
  vouchers created are always parked for approval (status `for-approval`), whatever `journal.require_approval` says.
- System journals parked for approval (`accounting.parked_events`, see `modules/accounting/README.md`) are approved here
  and in My Work > Approvals like a voucher; `parked=true` on the register lists them. They cannot be rejected on their
  own: cancelling their source document cancels them.

## Debugging

- "Maker-checker: a journal voucher must be approved by a different user": the approver created the voucher (for a
  system journal: the user whose action created it).
- Upload refused with "not allowed on manual vouchers": the account has Allow manual entries off on the chart of
  accounts.
- "Unknown, inactive or expired cost centre(s)": the cost centre master has the code inactive or its Valid To before the
  voucher date.
