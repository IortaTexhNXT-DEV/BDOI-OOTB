# Document numbering

Every number the system issues (policy, quotation, official receipt, journal voucher, claim, ...) comes from a series
in the Document Numbering master (Master > Document Numbering). This module lists, previews and edits the series;
issuing numbers is `nextDocumentNumber()` in `src/lib/numbering.js`, which calls the database function
`next_document_number()`. Reading needs `read:settings`, changes need `write:settings` and are audited.

## Tables and database functions

- `document_numbering`: one row per series: `code` (for example `receipt`), name, module, prefix, pattern, sequence
  width, reset rule (`yearly`, `fiscal_yearly`, `monthly`, `never`), start number, active.
- `sequences`: the counters, one row per series and reset period (`name` = series code, `period` = `2026`,
  `FY2027`, `2026-09` or `ALL`).
- `next_document_number(code, branch, lob, date)`: locks the counter row until the caller's transaction ends, so two
  users never get the same number, and a rolled-back transaction gives its number back.
- `format_document_number()`: applies the pattern. Tokens: `{PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {OFFICE}
  {PRODUCT} {SUBLINE} {BUSINESS} {PARENT} {SEQ}`. `{BRANCH}`, `{LOB}` and the segment tokens are dropped with the
  separator in front of them when the caller gives no value. The segment values come from `numberingContext()`
  (`src/lib/numbering.js`): the office code and Numbering Code of the user's branch (Branch master; `numbering.default_office`
  when the user has none), and the PRODUCT / SUBLINE / BUSINESS rows of the Numbering Segment master (type
  `numbering-segment`: product code, policy type code, NEW / RENEWAL). `{PARENT}` is the number of the parent document.
- Reset rule `per_document`: the counter runs under the parent number (`sequences.period = 'DOC:<parent>'`), for an
  endorsement or a cancellation notice numbered under its policy; the pattern must carry `{PARENT}`.
- A trigger mirrors each series prefix into the read-only setting `numbering.<code>.prefix` (older seed scripts read
  prefixes from there).

## Main flows

- Issue: `nextDocumentNumber('receipt', { db })` inside the caller's transaction. With `unique: { table, column }` a
  number already present in the target column (entered by hand or imported) is skipped.
- Edit a series: prefix, pattern, width and reset rule can change at any time; the change applies to the next number.
  A prefix used by another active series is refused.
- Move the next number: `PUT /document-numbering/:code/next-number`. It can only move forward.
- Apply the broker's numbering structure: `GET /document-numbering/structure` previews the change of every series the
  setting `numbering.structure` names (prefix, pattern, width, reset rule, active) with the first number in the new
  format; `POST /document-numbering/structure/apply` applies it in one transaction (audited per series). The delivered
  value is the structure proposed for TISPH (Pre-BSM M21): the 10-digit TIS Policy Number
  `{PRODUCT}{SUBLINE}{BUSINESS}{OFFICE}{SEQ}`, `CN-{YY}-{BRANCH}-{SEQ}`, `ENDT-{PARENT}-{SEQ}`, `CAN-{PARENT}-{SEQ}`
  (series `cancellation_notice`, used by cancellation endorsements once active) and `PS/{BRANCH}/{YY}/{SEQ}`.

## Key settings

`accounting.fiscal_year_start_month` (the `{FY}` token and the `fiscal_yearly` reset), `general.timezone` (the business
date used for `{YYYY}`, `{MM}` and the reset period), `numbering.default_office` (office of a number issued by a user
without a branch), `numbering.structure` (the structure applied from the screen).

## Adding a series

Insert the row in a new migration with `INSERT INTO document_numbering(code, name, module, prefix, description,
created_by) VALUES (...) ON CONFLICT (code) DO NOTHING`, then call `nextDocumentNumber('<code>', { db })` from the
service. `test/numbering.test.js` fails when code calls `nextDocumentNumber` with a code that has no series.

## Debugging

- "Document numbering series X is not configured" or "is inactive": the code is missing from `document_numbering` or
  its `active` flag is off. Check the migration that should add it, or reactivate it on the master screen.
- "Could not allocate a X number": twenty numbers in a row were already present in the unique column. Somebody has
  imported numbers ahead of the counter; move the next number forward past them.
- Skipped numbers: a number taken outside the saving transaction (a call without `db`) is lost when the save then
  fails. Inside the transaction the rollback returns it. Duplicates cannot come from the counter; look for numbers
  typed by hand.
- The current counter: `SELECT * FROM sequences WHERE name = '<code>' ORDER BY period DESC`.
