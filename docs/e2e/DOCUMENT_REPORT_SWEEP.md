# Document and report generation sweep

Run 2026-09-29 09:50 UTC against http://localhost:8000/api: **176 of 176 passed**.

Each file is fetched and checked: HTTP 200, the PDF (`%PDF-`) or XLSX (zip) signature, a CSV header, and that the row count of each report file matches its on-screen preview.

| Area | Item | Output | Result | Detail |
|---|---|---|---|---|
| Document | Quotation - motor | PDF | Pass | 4 KB |
| Document | Policy schedule - motor | PDF | Pass | 5 KB |
| Document | Policy schedule - fire / non-motor | PDF | Pass | 4 KB |
| Document | Insurance placing slip | PDF | Pass | 4 KB |
| Document | Billing statement - policy | PDF | Pass | 1 KB |
| Document | Billing statement - endorsement | PDF | Pass | 2 KB |
| Document | Billing statement - renewal | PDF | Pass | 1 KB |
| Document | Official receipt | PDF | Pass | 2 KB |
| Document | Receipt print (single) | PDF | Pass | 1 KB |
| Document | Receipts bulk print (date range) | PDF | Pass | 3 KB |
| Document | Disbursement vouchers bulk print | PDF | Pass | 4 KB |
| Document | Commission debit note (direct bill) | PDF | Pass | 4 KB |
| Document | Claim - Claims Data Sheet | PDF | Pass | 1 KB |
| Document | Claim - Claims Discharge Voucher | PDF | Pass | 1 KB |
| Document | Claim - Claims Acknowledgement Letter | PDF | Pass | 1 KB |
| Module export | Claims dashboard report | XLSX | Pass | 25 KB |
| Module export | Lead report | XLSX | Pass | 3 KB |
| Module export | Lead report (CSV) | CSV | Pass | 3 KB |
| Module export | Accounting entries export | CSV | Pass | 41 KB |
| Module export | Renewal batch report | XLSX | Pass | 5 KB |
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
| Report: operational | Production Register | PDF | Pass | 17 rows, 16 KB |
| Report: operational | Claims Position (All) | Screen preview | Pass | 17 rows |
| Report: operational | Claims Position (Open) | Screen preview | Pass | 9 rows |
| Report: operational | Claims Position (Settled) | Screen preview | Pass | 6 rows |
| Report: operational | Claims Position (Rejected) | Screen preview | Pass | 2 rows |
| Report: operational | Claims Position (Aging) | Screen preview | Pass | 9 rows |
| Report: operational | Claims Position | CSV | Pass | 17 rows, 3 KB |
| Report: operational | Claims Position | XLSX | Pass | 17 rows, 6 KB |
| Report: operational | Claims Position | PDF | Pass | 17 rows, 15 KB |
| Report: operational | Renewal Retention (Overall) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Agent) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Principal Insurer) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention (Branch) | Screen preview | Pass | 4 rows |
| Report: operational | Renewal Retention | CSV | Pass | 4 rows, 1 KB |
| Report: operational | Renewal Retention | XLSX | Pass | 4 rows, 5 KB |
| Report: operational | Renewal Retention | PDF | Pass | 4 rows, 5 KB |
| Report: operational | Remittance Summary (Overall) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Agent) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Principal Insurer) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary (Branch) | Screen preview | Pass | 18 rows |
| Report: operational | Remittance Summary | CSV | Pass | 18 rows, 3 KB |
| Report: operational | Remittance Summary | XLSX | Pass | 18 rows, 6 KB |
| Report: operational | Remittance Summary | PDF | Pass | 18 rows, 13 KB |
| Report: operational | Broker Commission Statement (Overall) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Agent) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Principal Insurer) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement (Branch) | Screen preview | Pass | 53 rows |
| Report: operational | Broker Commission Statement | CSV | Pass | 53 rows, 10 KB |
| Report: operational | Broker Commission Statement | XLSX | Pass | 53 rows, 9 KB |
| Report: operational | Broker Commission Statement | PDF | Pass | 53 rows, 44 KB |
| Report: operational | Premium by Product / Month / Insurer (Overall) | Screen preview | Pass | 16 rows |
| Report: operational | Premium by Product / Month / Insurer (Product) | Screen preview | Pass | 4 rows |
| Report: operational | Premium by Product / Month / Insurer (Month) | Screen preview | Pass | 8 rows |
| Report: operational | Premium by Product / Month / Insurer (Principal Insurer) | Screen preview | Pass | 8 rows |
| Report: operational | Premium by Product / Month / Insurer | CSV | Pass | 16 rows, 1 KB |
| Report: operational | Premium by Product / Month / Insurer | XLSX | Pass | 16 rows, 5 KB |
| Report: operational | Premium by Product / Month / Insurer | PDF | Pass | 16 rows, 8 KB |
| Report: operational | New Business vs Renewals (Overall) | Screen preview | Pass | 9 rows |
| Report: operational | New Business vs Renewals (Business Type) | Screen preview | Pass | 2 rows |
| Report: operational | New Business vs Renewals (Agent) | Screen preview | Pass | 4 rows |
| Report: operational | New Business vs Renewals | CSV | Pass | 9 rows, <1 KB |
| Report: operational | New Business vs Renewals | XLSX | Pass | 9 rows, 5 KB |
| Report: operational | New Business vs Renewals | PDF | Pass | 9 rows, 4 KB |
| Report: operational | Claims Ageing (Overall) | Screen preview | Pass | 2 rows |
| Report: operational | Claims Ageing (Principal Insurer) | Screen preview | Pass | 8 rows |
| Report: operational | Claims Ageing (Agent) | Screen preview | Pass | 3 rows |
| Report: operational | Claims Ageing | CSV | Pass | 2 rows, <1 KB |
| Report: operational | Claims Ageing | XLSX | Pass | 2 rows, 5 KB |
| Report: operational | Claims Ageing | PDF | Pass | 2 rows, 2 KB |
| Report: operational | Lead Conversion Funnel (Overall) | Screen preview | Pass | 4 rows |
| Report: operational | Lead Conversion Funnel (Agent) | Screen preview | Pass | 5 rows |
| Report: operational | Lead Conversion Funnel (Branch) | Screen preview | Pass | 4 rows |
| Report: operational | Lead Conversion Funnel (Source) | Screen preview | Pass | 10 rows |
| Report: operational | Lead Conversion Funnel | CSV | Pass | 4 rows, <1 KB |
| Report: operational | Lead Conversion Funnel | XLSX | Pass | 4 rows, 5 KB |
| Report: operational | Lead Conversion Funnel | PDF | Pass | 4 rows, 2 KB |
| Report: operational | Reinsurance Cession Register (Overall) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Treaty) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Reinsurer) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register (Principal Insurer) | Screen preview | Pass | 12 rows |
| Report: operational | Reinsurance Cession Register | CSV | Pass | 12 rows, 3 KB |
| Report: operational | Reinsurance Cession Register | XLSX | Pass | 12 rows, 6 KB |
| Report: operational | Reinsurance Cession Register | PDF | Pass | 12 rows, 9 KB |
| Report: financial | SOA / Premium Receivable (Overall) | Screen preview | Pass | 32 rows |
| Report: financial | SOA / Premium Receivable (Agent) | Screen preview | Pass | 32 rows |
| Report: financial | SOA / Premium Receivable (Principal Insurer) | Screen preview | Pass | 32 rows |
| Report: financial | SOA / Premium Receivable (Branch) | Screen preview | Pass | 32 rows |
| Report: financial | SOA / Premium Receivable | CSV | Pass | 32 rows, 5 KB |
| Report: financial | SOA / Premium Receivable | XLSX | Pass | 32 rows, 7 KB |
| Report: financial | SOA / Premium Receivable | PDF | Pass | 32 rows, 24 KB |
| Report: financial | Collection Report (Overall) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Agent) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Principal Insurer) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report (Branch) | Screen preview | Pass | 15 rows |
| Report: financial | Collection Report | CSV | Pass | 15 rows, 2 KB |
| Report: financial | Collection Report | XLSX | Pass | 15 rows, 6 KB |
| Report: financial | Collection Report | PDF | Pass | 15 rows, 12 KB |
| Report: financial | Receivables Ageing (Ageing Bucket) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Overall) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Agent) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Principal Insurer) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Branch) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing (Client) | Screen preview | Pass | 5 rows |
| Report: financial | Receivables Ageing | CSV | Pass | 5 rows, 1 KB |
| Report: financial | Receivables Ageing | XLSX | Pass | 5 rows, 6 KB |
| Report: financial | Receivables Ageing | PDF | Pass | 5 rows, 6 KB |
| Report: financial | Commission Receivable – Direct Bill (Ageing Bucket) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Principal Insurer) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Outstanding) | Screen preview | Pass | 0 rows |
| Report: financial | Commission Receivable – Direct Bill (Overall) | Screen preview | Pass | 1 rows |
| Report: financial | Commission Receivable – Direct Bill | CSV | Pass | 0 rows, <1 KB |
| Report: financial | Commission Receivable – Direct Bill | XLSX | Pass | 0 rows, 5 KB |
| Report: financial | Commission Receivable – Direct Bill | PDF | Pass | 0 rows, 3 KB |
| Report: financial | Receipts Register (Overall) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Agent) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Principal Insurer) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Branch) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register (Payment Mode) | Screen preview | Pass | 17 rows |
| Report: financial | Receipts Register | CSV | Pass | 17 rows, 3 KB |
| Report: financial | Receipts Register | XLSX | Pass | 17 rows, 6 KB |
| Report: financial | Receipts Register | PDF | Pass | 17 rows, 13 KB |
| Report: financial | Payables / Disbursement Register (Overall) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Agent) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Principal Insurer) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Branch) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register (Payee Type) | Screen preview | Pass | 23 rows |
| Report: financial | Payables / Disbursement Register | CSV | Pass | 23 rows, 3 KB |
| Report: financial | Payables / Disbursement Register | XLSX | Pass | 23 rows, 6 KB |
| Report: financial | Payables / Disbursement Register | PDF | Pass | 23 rows, 17 KB |
| Report: financial | Journal Register (Overall) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Agent) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Principal Insurer) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Branch) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register (Account) | Screen preview | Pass | 222 rows |
| Report: financial | Journal Register | CSV | Pass | 222 rows, 40 KB |
| Report: financial | Journal Register | XLSX | Pass | 222 rows, 16 KB |
| Report: financial | Journal Register | PDF | Pass | 222 rows, 132 KB |
| Report: financial | Trial Balance (Overall) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Agent) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Principal Insurer) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance (Branch) | Screen preview | Pass | 21 rows |
| Report: financial | Trial Balance | CSV | Pass | 21 rows, 2 KB |
| Report: financial | Trial Balance | XLSX | Pass | 21 rows, 6 KB |
| Report: financial | Trial Balance | PDF | Pass | 21 rows, 11 KB |
| Report: financial | Incentive Results (Overall) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Program) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Agent) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results (Branch) | Screen preview | Pass | 18 rows |
| Report: financial | Incentive Results | CSV | Pass | 18 rows, 2 KB |
| Report: financial | Incentive Results | XLSX | Pass | 18 rows, 6 KB |
| Report: financial | Incentive Results | PDF | Pass | 18 rows, 10 KB |
| Report schedule (run now) | Sweep pdf | PDF | Pass | 17 rows, e-mail queued to 1 |
| Report schedule (run now) | Sweep csv | CSV | Pass | 17 rows, e-mail queued to 1 |
| Report schedule (run now) | Sweep xlsx | XLSX | Pass | 17 rows, e-mail queued to 1 |
