# Print review: documents and report PDFs

Every PDF of the platform is now produced by one dependency-free engine (`backend/src/lib/pdf/`) and carries the
letterhead of the **primary company of the Company master** (`backend/src/lib/letterhead.js`). Out of the box that is
iorta TechNXT Corp., UB, 111 Paseo De Roxas Building, Legazpi Village, San Lorenzo, Makati, with the iorta TechNXT logo.

How this was checked: a fresh database (`brokerverse_prn`, migrations + seed with sample data), a motor quotation with
3-year CTPL created through the API, then `scripts/doc-report-sweep.js` (177 of 177 passed). Every saved PDF was rendered with
`pdftoppm -r 90` and each page was inspected. The primary company was then switched through the Company master API to a test
company (TIN, licence, contact line, uploaded logo): every document and report followed. It was then switched back.

Images, 90 dpi, before and after:

| Document | Before | After |
|---|---|---|
| Motor quotation | `quotation-motor-before.png` | `quotation-motor-after.png` |
| Policy billing statement | `billing-statement-before.png` | `billing-statement-after.png` |
| Disbursement print (payment voucher) | `payment-voucher-before.png` | `payment-voucher-after.png` |
| Production Register (report PDF) | `production-register-before.png` | `production-register-after.png` |
| Claims acknowledgement letter | `claim-acknowledgement-before.png` | `claim-acknowledgement-after.png` |
| Official receipt printed with another primary company | | `official-receipt-other-primary-company.png` |

## Common to every PDF

- Page 1 letterhead: the logo (PNG with transparency or JPEG, from the uploads store or `documents.default_logo_path`),
  company name, address, and a TIN, licence and contact line when those are filled in. The document title and number are
  on the right. Later pages have a compact running header.
- Footer on every page: the company, "Generated DD/MM/YYYY HH:mm by <user display name>" (Manila time, `general.date_format`)
  and "Page X of Y". No ISO or UTC timestamps are printed.
- Real Helvetica metrics are used. En and em dashes, curly quotes, bullets and the ellipsis print as themselves, and the
  peso sign prints as "PHP". Nothing prints as "?".
- Tables: amounts, numbers, dates, document numbers and codes are never truncated, and text columns wrap. The header row
  repeats after a page break, rows are zebra-striped and there is a bold totals row. Amounts have thousand separators.
  Wide reports shrink the font down to 6 pt first, and then switch to A3 landscape.

## Documents checked, and what was fixed

| Document | Fixes |
|---|---|
| Quotation (motor, fire, IAR) | Date was "Sun Sep 20"; now formatted. A "CTPL (inclusive of taxes and fees)" line was added, so the lines add up to the gross (22,250 + 2,670 + 2,781.25 + 166.88 + 1,660.40 = 29,528.53). Cover premiums are read from the saved premium breakdown. The policy type shows its label (IAR "2009" is now "Standard"). "OtherContents" is now "Other contents". |
| Policy schedule | Uses the policy's own net and gross premium. A policy without a breakdown prints only the gross (no more 0.00 lines that do not add up). The risk section depends on the line of business: PA, marine, CGL, EB and bond no longer print empty fire fields, and empty sections are left out. Sum insured was added. |
| Placing slip | Sum insured is formatted as an amount. "Placed by" uses the letterhead company. Acceptance signature lines were added. |
| Official receipt (single, bulk) | Uses the Official Receipt layout, one receipt per page (was a Courier list). Payment mode shows its label ("GCash", "Cheque"). Formatted amount and amount in words, applied-to table with totals, "Authorized signature" line, and a configurable footer (`documents.receipt_footer`). |
| Billing statements (policy / endorsement / renewal) | Were Courier text with "BrokerVerse ? ..." and raw amounts. Now a proper statement: bill to (name and address), policy, period, endorsement or renewal details, a bills table (bill date, due date, amount, paid, balance) with totals, total amount due (an endorsement with no bill yet shows its premium change), and payment instructions from `documents.payment_instructions`. |
| Disbursement print | Was a Courier list with the Status column cut off. Now a Payment Voucher per page: payee, amount and amount in words (pesos and centavos), particulars (invoice lines when present), gross, less WHT and deductions, net payable, account distribution from the posted journal, and Prepared / Checked / Approved / Received by blocks. |
| Commission debit note | "Gross premium" and "Rate" no longer overlap. "Policy / reference" wraps instead of truncating ("POL-2026-00003 /.."). A totals row and Prepared / Approved signature lines were added. |
| Claim documents (acknowledgement letter, discharge voucher, data sheet) | Now on the shared engine with the letterhead, still built from the `claims.documents` templates. "Label: value" lines become a details grid and dates are formatted. Empty placeholders ("PHP -") are left out. Signature blocks: Claims Department, Insured / Witness / company, Prepared / Reviewed. |
| Report PDFs (all 19 in the catalogue) | Policy numbers, dates and amounts were truncated ("POL-2026-..", "270,482,.." even in TOTAL); now printed in full. The parameter line under the title shows period, criteria, filters, currency and row count. The "Generated 2026-09-29T09:54:55Z" subtitle was replaced by the footer. Account codes are left-aligned. |

Sample data fixed: claims and renewals invoices were billed after their due date (INV-2025-90016 was billed 28/09/2026 and due
22/12/2025); they are now billed on the policy inception date. IAR quotations now have policy type IAR-STD "Standard".
