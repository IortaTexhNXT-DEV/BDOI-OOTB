# SAP GL export

The daily SAP GL text files of TIS-BRD-INTG-04 (item 1; CR-12): a header file and a line file of the GL entries posted
in the day, for the SAP GL upload. The vendor and customer master files of INTG-04 (items 2 and 3) are out of scope
(TISPH remark of 09.11). Routes under `/sap-gl` (Accounts > SAP GL Export). Permissions: `read:journal-vouchers` to see
the runs and download the files, `write:journal-vouchers` to run now / re-generate.

## Files

| File | What it does |
|---|---|
| `layout.js` | The record layout (setting `sap_gl.layout`): checks it, fills the file name and header text templates, renders the header and line records (delimited or fixed width). No database access. |
| `service.js` | A day's run: the window, the journal lines posted in it, one SAP document per posting date, the files written to the folder, the run history, the scheduled job. |
| `router.js` | Runs, run now, download, the folder / cut-off / layout in force. |

## Main tables

`sap_gl_exports` (one row per run: day, run number, window, counts, totals, warnings, status `done`, `empty`,
`failed`), `sap_gl_export_files` (the header and line file of a run, with their content and SHA-256).

## Main flow

1. The job `sap-gl-export` (Master > Schedules, `59 23 * * *` in the business time zone) or **Run now** starts a run
   for a day.
2. The window is the previous day's cut-off (exclusive) to the day's cut-off (inclusive), `sap_gl.cut_off` (default
   23:59) in `general.timezone`. Journals count by the time they were **posted** (`posted_at`): a journal parked for
   approval goes into the file of the day it is approved; a journal posted and later reversed stays in its day, its
   reversal goes into the day of the reversal.
3. The lines are grouped into one SAP document (`DOCNO`) per posting date (`BUDAT` = the journal date), in date order.
   Each document balances because every journal does.
4. The files are written to `SAP_GL_EXPORT_DIR` when the environment sets it, else to `sap_gl.folder` (default
   `sap-outbound`) under `UPLOAD_DIR`. A re-generation of a day is a new run and writes the day's files again (same
   names). A day with nothing posted is recorded as `empty` and writes no file.
5. Lines on accounts that do not match `sap_gl.account_pattern` (default six digits, the SAP chart) and lines without a
   cost centre are written and listed as warnings on the run.

## Layout (`sap_gl.layout`)

`format` (`delimited` or `fixed`), `delimiter` (tab), `lineEnding` (`CRLF` / `LF`), `fieldNames` (first row with the
field names), `encoding` (`utf8` / `latin1`), `dateFormat` (`YYYY-MM-DD`), `amountDecimals` (2), `debitKey` (40),
`creditKey` (50), `header.fileName` (`ARHDTISPH{date:YYYYMMDD}.txt`), `header.text` (BKTXT:
`{postingDate:MMM DD YYYY} TISPH GL Bal #{docNo:00}`), `line.fileName` (`ARLITISPH{date:YYYYMMDD}.txt`) and the
`fields` of each record: `{ name, source }` or `{ name, value }`, with `width`, `align`, `pad`, `maxLength`, `format`.
Sources are listed in `layout.js`. A layout that cannot be used is refused with its problems before anything is written.

The default follows the sample rows of the workbook sheet "Text File - SAP" where the sheet contradicts itself:

| Field | Default | Note |
|---|---|---|
| Line file name | `ARLITISPH<date>` | The sheet gives `ARHDTISPH` for both files; the BRD names ARHD / ARLI files. |
| `WRBTR`, `MWSKZ`, `SGTXT`, `KOSTL`, `PRCTR` | amount, blank, line text, cost centre, cost centre | The "Requirements" block is one field out from `WRBTR` on (it labels `WRBTR` "Transaction Description"); the sample has the amount in `WRBTR`, the text in `SGTXT` and 900901 in `KOSTL` and `PRCTR`. |
| `SAKNR`, `HKONT` | GL account | The sample's vendor numbers in `SAKNR` on payable lines (28000001) have no source in the platform. |
| `ZUONR` | client code, else insurer code of the line | "Vendor Code / Customer Code / Asset Code". |
| `XREF1`, `XREF2`, `XREF3` | cost centre, journal number, source document number | The sample has `XREF2` blank and the APV / PV number in `XREF3`. |
| `BKTXT` | `Aug 01 2026 TISPH GL Bal #01` | "Posting date + TISPH GL Bal + number series"; the sample omits "TISPH". |
| `BUKRS`, `BLART`, `XBLNR`, `WAERS` | `4F29`, `ZI`, `UPLOAD_GL`, journal currency | Constants of the sheet. |

## Key settings

`sap_gl.folder`, `sap_gl.cut_off`, `sap_gl.account_pattern`, `sap_gl.layout` (Master > Configuration, group
integrations); environment `SAP_GL_EXPORT_DIR` (deploy/AZURE.md, SFTP). When the cut-off changes, change the cron of the
job `sap-gl-export` to the same time.

## Debugging

- "The SAP GL layout ... cannot be used": the run lists the layout problems (unknown source, missing width in a fixed
  layout ...). Correct `sap_gl.layout` on Master > Configuration.
- A journal is missing from a day's file: check its `posted_at` against the run's window (shown on the screen); an entry
  approved after the cut-off is in the next day's file.
- The files are not in the SFTP container: see deploy/AZURE.md section 11 (the folder the API writes to and how it
  reaches the SFTP storage).
