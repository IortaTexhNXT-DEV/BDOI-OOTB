# Document and report generation sweep

Run 2026-09-29 15:37 UTC against http://localhost:8000/api: **291 of 291 passed**.

Each file is fetched and checked: HTTP 200, the PDF (`%PDF-`) or XLSX (zip) signature, a CSV header, and that the row count of each report file matches its on-screen preview.

| Area | Item | Output | Result | Detail |
|---|---|---|---|---|
| Document | Quotation - motor | PDF | Pass | 58 KB |
| Document | Quotation - fire | PDF | Pass | 57 KB |
| Document | Quotation - industrial all risks | PDF | Pass | 57 KB |
| Document | Policy schedule - motor | PDF | Pass | 58 KB |
| Document | Policy schedule - fire / non-motor | PDF | Pass | 56 KB |
| Document | Insurance placing slip | PDF | Pass | 59 KB |
| Document | Billing statement - policy | PDF | Pass | 57 KB |
| Document | Billing statement - endorsement | PDF | Pass | 58 KB |
| Document | Billing statement - renewal | PDF | Pass | 57 KB |
| Document | Official receipt | PDF | Pass | 56 KB |
| Document | Receipt print (single) | PDF | Pass | 56 KB |
| Document | Receipts bulk print (date range) | PDF | Pass | 128 KB |
| Document | Disbursement vouchers bulk print | PDF | Pass | 210 KB |
| Document | Commission debit note (direct bill) | PDF | Pass | 58 KB |
| Document | Claim - Claims Data Sheet | PDF | Pass | 55 KB |
| Document | Claim - Claims Discharge Voucher | PDF | Pass | 55 KB |
| Document | Claim - Claims Acknowledgement Letter | PDF | Pass | 55 KB |
| Document | Broker slip (to the market) | PDF | Pass | 57 KB |
| Document | Broker slip (to one insurer) | PDF | Pass | 57 KB |
| Document | Placement slip (lead insurer) | PDF | Pass | 60 KB |
| Document | Placement slip (whole security) | PDF | Pass | 59 KB |
| Document | Placement slip (co-insurer share) | PDF | Pass | 60 KB |
| Module export | Claims dashboard report | XLSX | Pass | 7 KB |
| Module export | Lead report | XLSX | Pass | 6 KB |
| Module export | Lead report (CSV) | CSV | Pass | 3 KB |
| Module export | Accounting entries export | CSV | Pass | 40 KB |
| Module export | Renewal batch report | XLSX | Pass | 4 KB |
| Module export | Renewal batch report (CSV) | CSV | Pass | 1 KB |
| Module export | Remittance statement (default layout) | CSV | Pass | 1 KB |
| Module export | Remittance statement - Standard Monthly Statement | CSV | Pass | 1 KB |
| Module export | Remittance statement - Detailed Transaction Report | CSV | Pass | 1 KB |
| Module export | Remittance report - Daily Remittance Summary | CSV | Pass | 3 KB |
| Module export | Remittance report - Monthly Commission Analysis | CSV | Pass | 3 KB |
| Module export | Reinsurance report - Monthly Premium Bordereau | CSV | Pass | 1 KB |
| Module export | Reinsurance report - Quarterly Claims Report | CSV | Pass | 1 KB |
| Module export | Reinsurance report - Annual Treaty Performance | CSV | Pass | 1 KB |
| Module export | Reinsurance report - IC Quarterly Submission | CSV | Pass | 1 KB |
| Module export | Incentive report - Monthly Payout Summary | CSV | Pass | <1 KB |
| Module export | Incentive report - Agent Payout Details | CSV | Pass | <1 KB |
| Module export | Incentive report - Target Achievement Report | CSV | Pass | <1 KB |
| Module export | Incentive report - Top Performers | CSV | Pass | <1 KB |
| Module export | Incentive report - Program Effectiveness | CSV | Pass | <1 KB |
| Report: operational | Production Register (Overall) | Screen preview | Pass | 17 rows |
| Report: operational | Production Register (Agent) | Screen preview | Pass | 17 rows |
| Report: operational | Production Register (Principal Insurer) | Screen preview | Pass | 17 rows |
| Report: operational | Production Register (Branch) | Screen preview | Pass | 17 rows |
| Report: operational | Production Register (Billing Mode) | Screen preview | Pass | 17 rows |
| Report: operational | Production Register | CSV | Pass | 17 rows, 4 KB |
| Report: operational | Production Register | XLSX | Pass | 17 rows, 7 KB |
| Report: operational | Production Register | PDF | Pass | 17 rows, 83 KB |
| Report: operational | Claims Position (All) | Screen preview | Pass | 17 rows |
| Report: operational | Claims Position (Open) | Screen preview | Pass | 9 rows |
| Report: operational | Claims Position (Settled) | Screen preview | Pass | 6 rows |
| Report: operational | Claims Position (Rejected) | Screen preview | Pass | 2 rows |
| Report: operational | Claims Position (Aging) | Screen preview | Pass | 9 rows |
| Report: operational | Claims Position | CSV | Pass | 17 rows, 3 KB |
| Report: operational | Claims Position | XLSX | Pass | 17 rows, 6 KB |
| Report: operational | Claims Position | PDF | Pass | 17 rows, 79 KB |
| Report: operational | Renewal Retention (Overall) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Agent) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Principal Insurer) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Branch) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention | CSV | Pass | 4 rows, 1 KB |
| Report: operational | Renewal Retention | XLSX | Pass | 4 rows, 5 KB |
| Report: operational | Renewal Retention | PDF | Pass | 4 rows, 60 KB |
| Report: operational | Remittance Summary (Overall) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Agent) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Principal Insurer) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Branch) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary | CSV | Pass | 18 rows, 3 KB |
| Report: operational | Remittance Summary | XLSX | Pass | 18 rows, 6 KB |
| Report: operational | Remittance Summary | PDF | Pass | 18 rows, 71 KB |
| Report: operational | Broker Commission Statement (Overall) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Agent) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Principal Insurer) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Branch) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement | CSV | Pass | 53 rows, 10 KB |
| Report: operational | Broker Commission Statement | XLSX | Pass | 53 rows, 9 KB |
| Report: operational | Broker Commission Statement | PDF | Pass | 53 rows, 137 KB |
| Report: operational | Premium by Product / Month / Insurer (Overall) | Screen preview | Pass | 16 rows |
| Report: operational | Premium by Product / Month / Insurer (Product) | Screen preview | Pass | 4 rows |
| Report: operational | Premium by Product / Month / Insurer (Month) | Screen preview | Pass | 8 rows |
| Report: operational | Premium by Product / Month / Insurer (Principal Insurer) | Screen preview | Pass | 8 rows |
| Report: operational | Premium by Product / Month / Insurer | CSV | Pass | 16 rows, 1 KB |
| Report: operational | Premium by Product / Month / Insurer | XLSX | Pass | 16 rows, 6 KB |
| Report: operational | Premium by Product / Month / Insurer | PDF | Pass | 16 rows, 62 KB |
| Report: operational | New Business vs Renewals (Overall) | Screen preview | Pass | 9 rows |
| Report: operational | New Business vs Renewals (Business Type) | Screen preview | Pass | 2 rows |
| Report: operational | New Business vs Renewals (Agent) | Screen preview | Pass | 4 rows |
| Report: operational | New Business vs Renewals | CSV | Pass | 9 rows, <1 KB |
| Report: operational | New Business vs Renewals | XLSX | Pass | 9 rows, 5 KB |
| Report: operational | New Business vs Renewals | PDF | Pass | 9 rows, 57 KB |
| Report: operational | Claims Ageing (Overall) | Screen preview | Pass | 2 rows |
| Report: operational | Claims Ageing (Principal Insurer) | Screen preview | Pass | 8 rows |
| Report: operational | Claims Ageing (Agent) | Screen preview | Pass | 3 rows |
| Report: operational | Claims Ageing | CSV | Pass | 2 rows, <1 KB |
| Report: operational | Claims Ageing | XLSX | Pass | 2 rows, 5 KB |
| Report: operational | Claims Ageing | PDF | Pass | 2 rows, 55 KB |
| Report: operational | Lead Conversion Funnel (Overall) | Screen preview | Pass | 4 rows |
| Report: operational | Lead Conversion Funnel (Agent) | Screen preview | Pass | 5 rows |
| Report: operational | Lead Conversion Funnel (Branch) | Screen preview | Pass | 4 rows |
| Report: operational | Lead Conversion Funnel (Source) | Screen preview | Pass | 10 rows |
| Report: operational | Lead Conversion Funnel | CSV | Pass | 4 rows, <1 KB |
| Report: operational | Lead Conversion Funnel | XLSX | Pass | 4 rows, 5 KB |
| Report: operational | Lead Conversion Funnel | PDF | Pass | 4 rows, 55 KB |
| Report: operational | Placement Pipeline (Overall) | Screen preview | Pass | 3 rows |
| Report: operational | Placement Pipeline (Slip Type) | Screen preview | Pass | 3 rows |
| Report: operational | Placement Pipeline (Status) | Screen preview | Pass | 3 rows |
| Report: operational | Placement Pipeline (Open by Age) | Screen preview | Pass | 3 rows |
| Report: operational | Placement Pipeline (Agent) | Screen preview | Pass | 3 rows |
| Report: operational | Placement Pipeline | CSV | Pass | 3 rows, 1 KB |
| Report: operational | Placement Pipeline | XLSX | Pass | 3 rows, 5 KB |
| Report: operational | Placement Pipeline | PDF | Pass | 3 rows, 60 KB |
| Report: operational | Market Response (Overall) | Screen preview | Pass | 4 rows |
| Report: operational | Market Response (Line of Business) | Screen preview | Pass | 5 rows |
| Report: operational | Market Response (Agent) | Screen preview | Pass | 4 rows |
| Report: operational | Market Response | CSV | Pass | 4 rows, <1 KB |
| Report: operational | Market Response | XLSX | Pass | 4 rows, 5 KB |
| Report: operational | Market Response | PDF | Pass | 4 rows, 57 KB |
| Report: operational | Reinsurance Cession Register (Overall) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Treaty) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Reinsurer) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Principal Insurer) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register | CSV | Pass | 12 rows, 3 KB |
| Report: operational | Reinsurance Cession Register | XLSX | Pass | 12 rows, 6 KB |
| Report: operational | Reinsurance Cession Register | PDF | Pass | 12 rows, 68 KB |
| Report: operational | Co-insurance Register (Overall) | Screen preview | Pass | 0 rows |
| Report: operational | Co-insurance Register (Co-insurer) | Screen preview | Pass | 0 rows |
| Report: operational | Co-insurance Register (Policy) | Screen preview | Pass | 0 rows |
| Report: operational | Co-insurance Register (Agent) | Screen preview | Pass | 0 rows |
| Report: operational | Co-insurance Register | CSV | Pass | 0 rows, <1 KB |
| Report: operational | Co-insurance Register | XLSX | Pass | 0 rows, 5 KB |
| Report: operational | Co-insurance Register | PDF | Pass | 0 rows, 56 KB |
| Report: financial | SOA / Premium Receivable (Overall) | Screen preview | Pass | 18 rows |
| Report: financial | SOA / Premium Receivable (Agent) | Screen preview | Pass | 18 rows |
| Report: financial | SOA / Premium Receivable (Principal Insurer) | Screen preview | Pass | 18 rows |
| Report: financial | SOA / Premium Receivable (Branch) | Screen preview | Pass | 18 rows |
| Report: financial | SOA / Premium Receivable | CSV | Pass | 18 rows, 3 KB |
| Report: financial | SOA / Premium Receivable | XLSX | Pass | 18 rows, 6 KB |
| Report: financial | SOA / Premium Receivable | PDF | Pass | 18 rows, 76 KB |
| Report: financial | Collection Report (Overall) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Agent) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Principal Insurer) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Branch) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report | CSV | Pass | 15 rows, 2 KB |
| Report: financial | Collection Report | XLSX | Pass | 15 rows, 6 KB |
| Report: financial | Collection Report | PDF | Pass | 15 rows, 69 KB |
| Report: financial | Receivables Ageing (Ageing Bucket) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Overall) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Agent) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Principal Insurer) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Branch) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Client) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing | CSV | Pass | 5 rows, 1 KB |
| Report: financial | Receivables Ageing | XLSX | Pass | 5 rows, 6 KB |
| Report: financial | Receivables Ageing | PDF | Pass | 5 rows, 60 KB |
| Report: financial | Commission Receivable – Direct Bill (Ageing Bucket) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Principal Insurer) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Outstanding) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Overall) | Screen preview | Pass | 1 rows |
| Report: financial | Commission Receivable – Direct Bill | CSV | Pass | 0 rows, <1 KB |
| Report: financial | Commission Receivable – Direct Bill | XLSX | Pass | 0 rows, 5 KB |
| Report: financial | Commission Receivable – Direct Bill | PDF | Pass | 0 rows, 56 KB |
| Report: financial | Receipts Register (Overall) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Agent) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Principal Insurer) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Branch) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Payment Mode) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register | CSV | Pass | 17 rows, 3 KB |
| Report: financial | Receipts Register | XLSX | Pass | 17 rows, 6 KB |
| Report: financial | Receipts Register | PDF | Pass | 17 rows, 74 KB |
| Report: financial | Payables / Disbursement Register (Overall) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Agent) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Principal Insurer) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Branch) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Payee Type) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register | CSV | Pass | 23 rows, 3 KB |
| Report: financial | Payables / Disbursement Register | XLSX | Pass | 23 rows, 6 KB |
| Report: financial | Payables / Disbursement Register | PDF | Pass | 23 rows, 80 KB |
| Report: financial | Journal Register (Overall) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Agent) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Principal Insurer) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Branch) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Account) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register | CSV | Pass | 222 rows, 40 KB |
| Report: financial | Journal Register | XLSX | Pass | 222 rows, 16 KB |
| Report: financial | Journal Register | PDF | Pass | 222 rows, 291 KB |
| Report: financial | Trial Balance (Overall) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Agent) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Principal Insurer) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Branch) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance | CSV | Pass | 21 rows, 2 KB |
| Report: financial | Trial Balance | XLSX | Pass | 21 rows, 6 KB |
| Report: financial | Trial Balance | PDF | Pass | 21 rows, 69 KB |
| Report: financial | Incentive Results (Overall) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Program) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Agent) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Branch) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results | CSV | Pass | 18 rows, 2 KB |
| Report: financial | Incentive Results | XLSX | Pass | 18 rows, 6 KB |
| Report: financial | Incentive Results | PDF | Pass | 18 rows, 67 KB |
| Report: financial | Due to Insurers by Co-insurer (Co-insurer) | Screen preview | Pass | 8 rows |
| Report: financial | Due to Insurers by Co-insurer (Co-insurer and Policy) | Screen preview | Pass | 16 rows |
| Report: financial | Due to Insurers by Co-insurer (Placement) | Screen preview | Pass | 8 rows |
| Report: financial | Due to Insurers by Co-insurer | CSV | Pass | 8 rows, 1 KB |
| Report: financial | Due to Insurers by Co-insurer | XLSX | Pass | 8 rows, 5 KB |
| Report: financial | Due to Insurers by Co-insurer | PDF | Pass | 8 rows, 60 KB |
| Report: financial | Income Statement (Detailed) | Screen preview | Pass | 7 rows |
| Report: financial | Income Statement (Summary) | Screen preview | Pass | 3 rows |
| Report: financial | Income Statement | CSV | Pass | 7 rows, 1 KB |
| Report: financial | Income Statement | XLSX | Pass | 7 rows, 5 KB |
| Report: financial | Income Statement | PDF | Pass | 7 rows, 59 KB |
| Report: financial | Balance Sheet (Detailed) | Screen preview | Pass | 15 rows |
| Report: financial | Balance Sheet (Summary) | Screen preview | Pass | 3 rows |
| Report: financial | Balance Sheet | CSV | Pass | 15 rows, 1 KB |
| Report: financial | Balance Sheet | XLSX | Pass | 15 rows, 6 KB |
| Report: financial | Balance Sheet | PDF | Pass | 15 rows, 62 KB |
| Report: financial | Trial Balance (Opening / Movement / Closing) (Overall) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Opening / Movement / Closing) (Account Type) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Opening / Movement / Closing) (Statement Group) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Opening / Movement / Closing) | CSV | Pass | 21 rows, 2 KB |
| Report: financial | Trial Balance (Opening / Movement / Closing) | XLSX | Pass | 21 rows, 6 KB |
| Report: financial | Trial Balance (Opening / Movement / Closing) | PDF | Pass | 21 rows, 71 KB |
| Report: financial | General Ledger Detail (Account) | Screen preview | Pass | 226 rows |
| Report: financial | General Ledger Detail (Overall) | Screen preview | Pass | 226 rows |
| Report: financial | General Ledger Detail | CSV | Pass | 226 rows, 30 KB |
| Report: financial | General Ledger Detail | XLSX | Pass | 226 rows, 18 KB |
| Report: financial | General Ledger Detail | PDF | Pass | 226 rows, 250 KB |
| Report: financial | Aged Payables to Insurers (Ageing Bucket) | Screen preview | Pass | 3 rows |
| Report: financial | Aged Payables to Insurers (Principal Insurer) | Screen preview | Pass | 3 rows |
| Report: financial | Aged Payables to Insurers (Overall) | Screen preview | Pass | 3 rows |
| Report: financial | Aged Payables to Insurers | CSV | Pass | 3 rows, <1 KB |
| Report: financial | Aged Payables to Insurers | XLSX | Pass | 3 rows, 6 KB |
| Report: financial | Aged Payables to Insurers | PDF | Pass | 3 rows, 57 KB |
| Report: financial | Month-End Close Status (Overall) | Screen preview | Pass | 9 rows |
| Report: financial | Month-End Close Status (Fiscal Year) | Screen preview | Pass | 9 rows |
| Report: financial | Month-End Close Status (Period Status) | Screen preview | Pass | 9 rows |
| Report: financial | Month-End Close Status | CSV | Pass | 9 rows, 1 KB |
| Report: financial | Month-End Close Status | XLSX | Pass | 9 rows, 5 KB |
| Report: financial | Month-End Close Status | PDF | Pass | 9 rows, 65 KB |
| Report: financial | VAT Summary (Monthly) | Screen preview | Pass | 8 rows |
| Report: financial | VAT Summary (Quarterly) | Screen preview | Pass | 3 rows |
| Report: financial | VAT Summary | CSV | Pass | 8 rows, <1 KB |
| Report: financial | VAT Summary | XLSX | Pass | 8 rows, 5 KB |
| Report: financial | VAT Summary | PDF | Pass | 8 rows, 57 KB |
| Report: financial | SAWT - Summary Alphalist of Withholding Taxes (Summary) | Screen preview | Pass | 1 rows |
| Report: financial | SAWT - Summary Alphalist of Withholding Taxes | CSV | Pass | 1 rows, <1 KB |
| Report: financial | SAWT - Summary Alphalist of Withholding Taxes | XLSX | Pass | 1 rows, 5 KB |
| Report: financial | SAWT - Summary Alphalist of Withholding Taxes | PDF | Pass | 1 rows, 56 KB |
| Report: financial | QAP - Quarterly Alphalist of Payees (Summary) | Screen preview | Pass | 5 rows |
| Report: financial | QAP - Quarterly Alphalist of Payees | CSV | Pass | 5 rows, 1 KB |
| Report: financial | QAP - Quarterly Alphalist of Payees | XLSX | Pass | 5 rows, 5 KB |
| Report: financial | QAP - Quarterly Alphalist of Payees | PDF | Pass | 5 rows, 59 KB |
| Report: financial | SLSP - Summary List of Sales (Summary) | Screen preview | Pass | 1 rows |
| Report: financial | SLSP - Summary List of Sales | CSV | Pass | 1 rows, <1 KB |
| Report: financial | SLSP - Summary List of Sales | XLSX | Pass | 1 rows, 5 KB |
| Report: financial | SLSP - Summary List of Sales | PDF | Pass | 1 rows, 57 KB |
| Report: financial | SLSP - Summary List of Purchases (Summary) | Screen preview | Pass | 1 rows |
| Report: financial | SLSP - Summary List of Purchases | CSV | Pass | 1 rows, 1 KB |
| Report: financial | SLSP - Summary List of Purchases | XLSX | Pass | 1 rows, 5 KB |
| Report: financial | SLSP - Summary List of Purchases | PDF | Pass | 1 rows, 58 KB |
| Report: financial | Bank Reconciliation Statement (Overall) | Screen preview | Pass | 0 rows |
| Report: financial | Bank Reconciliation Statement (Bank Account) | Screen preview | Pass | 0 rows |
| Report: financial | Bank Reconciliation Statement | CSV | Pass | 0 rows, <1 KB |
| Report: financial | Bank Reconciliation Statement | XLSX | Pass | 0 rows, 5 KB |
| Report: financial | Bank Reconciliation Statement | PDF | Pass | 0 rows, 57 KB |
| Report: financial | Outstanding Cheques (Overall) | Screen preview | Pass | 23 rows |
| Report: financial | Outstanding Cheques (Bank Account) | Screen preview | Pass | 23 rows |
| Report: financial | Outstanding Cheques (Status) | Screen preview | Pass | 23 rows |
| Report: financial | Outstanding Cheques | CSV | Pass | 23 rows, 3 KB |
| Report: financial | Outstanding Cheques | XLSX | Pass | 23 rows, 6 KB |
| Report: financial | Outstanding Cheques | PDF | Pass | 23 rows, 75 KB |
| Report: financial | Deposits in Transit (Overall) | Screen preview | Pass | 7 rows |
| Report: financial | Deposits in Transit (Bank Account) | Screen preview | Pass | 7 rows |
| Report: financial | Deposits in Transit | CSV | Pass | 7 rows, 1 KB |
| Report: financial | Deposits in Transit | XLSX | Pass | 7 rows, 5 KB |
| Report: financial | Deposits in Transit | PDF | Pass | 7 rows, 60 KB |
| Report: financial | Unmatched Bank Lines (Overall) | Screen preview | Pass | 3 rows |
| Report: financial | Unmatched Bank Lines (Bank Account) | Screen preview | Pass | 3 rows |
| Report: financial | Unmatched Bank Lines (Suggested Type) | Screen preview | Pass | 3 rows |
| Report: financial | Unmatched Bank Lines | CSV | Pass | 3 rows, <1 KB |
| Report: financial | Unmatched Bank Lines | XLSX | Pass | 3 rows, 5 KB |
| Report: financial | Unmatched Bank Lines | PDF | Pass | 3 rows, 57 KB |
| Report: financial | Bank Book (Bank Account) | Screen preview | Pass | 32 rows |
| Report: financial | Bank Book (Overall) | Screen preview | Pass | 32 rows |
| Report: financial | Bank Book | CSV | Pass | 32 rows, 4 KB |
| Report: financial | Bank Book | XLSX | Pass | 32 rows, 8 KB |
| Report: financial | Bank Book | PDF | Pass | 32 rows, 90 KB |
| Report schedule (run now) | Sweep pdf | PDF | Pass | 17 rows, e-mail queued to 1 |
| Report schedule (run now) | Sweep csv | CSV | Pass | 17 rows, e-mail queued to 1 |
| Report schedule (run now) | Sweep xlsx | XLSX | Pass | 17 rows, e-mail queued to 1 |
