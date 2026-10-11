# Credit Life

Monthly Credit Life batches of the financing bank (TIS-BRD-PJRN-01, PJRN-02; FGA CL-01 to CL-04; gap register
GAP-QUOTE-18). Route: `/credit-life` (Operations > Credit Life, `/operations/credit-life`). Migration 0680. Access:
`read:credit-life`, `write:credit-life`.

Credit Life has no lead or quotation journey for the bank's batch: the year-1 compulsory cover (CL-COMP) is placed from
the bank's list. The voluntary renewal keeps the quotation of QUOT-06 (`quotations/creditLife.js`), whose rules the
batch reuses.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/credit-life` routes. |
| `service.js` | Batches, members (`CREDIT_LIFE_COLUMNS`: upload and encoding), the member checks, issue with one master policy per customer, cancellation, master policies. |
| `certificates.js` | The certificate of cover on the document engine, its password rule and e-mail, the master policy schedule, the list forwarded to the insurer. |

## Rules

- **Batch.** One per financing bank, insurer and month (CLB series), product `credit_life.batch_product` (CL-COMP).
  Members change only while the batch is a Draft.
- **Checks.** The Credit Life rules of `credit_life.rules` (QUOT-06): a borrower aged `maxAge` or more on the start of
  cover, more than `maxAccounts` accounts (the ACCOUNT_COUNT of the file, or the loans of the customer in the batch),
  a loan term outside `termYears`, a sum insured above `defaultSumInsured`; required data, dates, e-mail, +63 mobile;
  a loan account already in the batch or covered by an issued certificate. An uploaded row that fails is kept with
  its messages and is not issued; an encoded one is refused.
- **Issue.** Every valid member gets a certificate of cover (CLC series) on the master policy of its customer (CLMP
  series): one per customer of the bank with the insurer (the bank's customer number, else name and birth date),
  covering all the customer's loans. Cover from the release date (`credit_life.cover_start`) for the loan term;
  premium fixed per account or at the rate per 1,000 (`credit_life.batch_premium_basis`).
- **Certificate.** Printed by staff in clear; e-mailed to the borrower as a PDF protected by
  `credit_life.certificate_password` (delivered: the birth date as DDMMYYYY).
- **Insurer.** Send to insurer e-mails the list of the issued accounts (Excel) to the insurer's contact e-mail or the
  address given; the batch becomes Sent.

## Settings

`credit_life.batch_product` (CL-COMP), `credit_life.batch_sum_insured` (1,000,000), `credit_life.batch_premium_basis`
(fixed), `credit_life.batch_premium_per_account` (2,000), `credit_life.cover_start` (release_date),
`credit_life.max_upload_rows` (10,000), `credit_life.email_certificate` (true), `credit_life.certificate_password`
(birth_ddmmyyyy), `credit_life.certificate_email_subject` / `_body`, `credit_life.certificate_wording`,
`credit_life.insurer_email_subject` / `_body`; and `credit_life.rules` of the quotations.
