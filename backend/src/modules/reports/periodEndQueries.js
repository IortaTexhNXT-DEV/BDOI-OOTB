/**
 * Report queries of period-end processing and BIR tax (merged into QUERIES in queries.js). Same conventions: $1 = from,
 * $2 = to, extras from app_settings follow; columns starting with "_" are internal.
 *
 * Ledger balances come from posted and reversed journals (a reversed journal and its reversal both count). Opening
 * balances use pe_balance_before(date): the opening balances written by the year-end close (or loaded at go-live) plus
 * movements since the fiscal year start, or all earlier movements when the year has none; the balance sheet reads them
 * the same way. The income statement leaves out the year-end closing entries (source year-end-close) so a closed year
 * still shows its result.
 */
const setting = (key, fallback, type) => ({ key, fallback, type });
export const POSTED = "j.status IN ('posted', 'reversed')";
const FS_ORDER = "ARRAY['Current Assets','Non-current Assets','Current Liabilities','Non-current Liabilities','Equity','Revenue','Other Income','Cost of Services','Operating Expenses','Other Expenses','Income Tax']";
const TYPE_ORDER = "ARRAY['asset','liability','equity','income','expense']";
const FS_GROUP = "COALESCE(a.fs_group, CASE a.account_type WHEN 'asset' THEN 'Current Assets' WHEN 'liability' THEN 'Current Liabilities' WHEN 'equity' THEN 'Equity' WHEN 'income' THEN 'Revenue' ELSE 'Operating Expenses' END)";
export const FY_START = (d) => `COALESCE((SELECT start_date FROM fiscal_years WHERE ${d}::date BETWEEN start_date AND end_date), date_trunc('year', ${d}::date)::date)`;
const statementOrder = (dims) => dims.map((d) => {
  if (d === 'accountType') return `COALESCE(array_position(${TYPE_ORDER}, f."accountType"), 99)`;
  if (d === 'fsGroup') return `COALESCE(array_position(${FS_ORDER}, f."fsGroup"), 99)`;
  return `f."${d}"`;
}).join(', ');
const ACCOUNT_FILTER = ['account'];

// Opening balances loaded at go-live (source_run go-live:<date>) are the old system's balances at the day before the
// go-live date (null for the balances carried forward by the year-end close, which are at the day before the fiscal year
// starts).
const GO_LIVE_EVE = "(CASE WHEN o.source_run ~ '^go-live:[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN substr(o.source_run, 9)::date - 1 END)";

// Income statement: amounts positive for income and for expense, in their natural sign (a credit on an expense account,
// such as a clawback or the reversal of an earlier month's expense, is negative); period, year to date (from the
// fiscal year start of To Date) and the same two windows one year earlier. Income and expense loaded at go-live count in
// the year-to-date windows only (_opening).
const incomeStatement = `SELECT a.account_type AS "accountType", ${FS_GROUP} AS "fsGroup", a.code AS "accountCode", a.name AS "accountName", a.code AS _account,
    x.d AS _date, x.opening AS _opening, CASE WHEN a.account_type = 'income' THEN -x.amt ELSE x.amt END AS _amt
  FROM (
    SELECT l.account_code, j.jv_date AS d, false AS opening, l.debit - l.credit AS amt FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE ${POSTED} AND j.source <> 'year-end-close' AND j.jv_date BETWEEN (LEAST($1::date, ${FY_START('$2')}) - interval '1 year')::date AND $2::date
    UNION ALL
    SELECT o.account_code, ${GO_LIVE_EVE}, true, o.balance FROM opening_balances o
     WHERE ${GO_LIVE_EVE} BETWEEN (LEAST($1::date, ${FY_START('$2')}) - interval '1 year')::date AND $2::date
  ) x JOIN gl_accounts a ON a.code = x.account_code
  WHERE a.account_type IN ('income', 'expense')`;
const YS = FY_START('$2');
const isMeasures = {
  currentPeriod: 'COALESCE(sum(t._amt) FILTER (WHERE NOT t._opening AND t._date BETWEEN $1::date AND $2::date), 0)',
  yearToDate: `COALESCE(sum(t._amt) FILTER (WHERE t._date BETWEEN ${YS} AND $2::date), 0)`,
  priorPeriod: "COALESCE(sum(t._amt) FILTER (WHERE NOT t._opening AND t._date BETWEEN ($1::date - interval '1 year')::date AND ($2::date - interval '1 year')::date), 0)",
  priorYearToDate: `COALESCE(sum(t._amt) FILTER (WHERE t._date BETWEEN (${YS} - interval '1 year')::date AND ($2::date - interval '1 year')::date), 0)`,
};
const net = (col) => `COALESCE(sum(f."${col}") FILTER (WHERE f."accountType" = 'income'), 0) - COALESCE(sum(f."${col}") FILTER (WHERE f."accountType" = 'expense'), 0)`;

// Balance sheet: assets debit-positive, liabilities and equity credit-positive, as of To Date; comparative: the end of
// the previous fiscal year. A fiscal year with opening balances starts from them and leaves out the journals before it,
// as pe_balance_before does. Income and expense not yet closed show under equity: this fiscal year's as "Current year
// earnings", earlier years' as "Earnings of prior years not yet closed".
const balanceSheet = `WITH fy AS (SELECT f.code, f.start_date FROM fiscal_years f WHERE $2::date BETWEEN f.start_date AND f.end_date),
  ob AS (SELECT o.account_code, COALESCE(${GO_LIVE_EVE}, fy.start_date - 1) AS d, o.balance
    FROM opening_balances o JOIN fy ON fy.code = o.fiscal_year)
  SELECT CASE WHEN a.account_type IN ('income', 'expense') THEN 'equity' ELSE a.account_type END AS "accountType",
    CASE WHEN a.account_type IN ('income', 'expense') THEN 'Equity' ELSE ${FS_GROUP} END AS "fsGroup",
    CASE WHEN a.account_type NOT IN ('income', 'expense') THEN a.code WHEN x.d < ${YS} THEN 'PYE' ELSE 'CYE' END AS "accountCode",
    CASE WHEN a.account_type NOT IN ('income', 'expense') THEN a.name WHEN x.d < ${YS} THEN 'Earnings of prior years not yet closed' ELSE 'Current year earnings' END AS "accountName",
    a.code AS _account, x.d AS _date,
    CASE WHEN a.account_type = 'asset' THEN x.amt ELSE -x.amt END AS _amt
  FROM (
    SELECT ob.account_code, ob.d, ob.balance AS amt FROM ob WHERE ob.d <= $2::date
    UNION ALL
    SELECT l.account_code, j.jv_date, l.debit - l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE ${POSTED} AND j.jv_date <= $2::date AND (NOT EXISTS (SELECT 1 FROM ob) OR j.jv_date >= (SELECT fy.start_date FROM fy))
  ) x JOIN gl_accounts a ON a.code = x.account_code`;
const bsTotal = (col, types) => `COALESCE(sum(f."${col}") FILTER (WHERE f."accountType" IN (${types})), 0)`;

// Trial balance with opening, movement and closing columns
const trialBalanceOcm = `SELECT a.code AS "accountCode", a.name AS "accountName", a.account_type AS "accountType", ${FS_GROUP} AS "fsGroup", a.code AS _account,
    GREATEST(x.opening, 0) AS "openingDebit", GREATEST(-x.opening, 0) AS "openingCredit", x.debit AS "periodDebit", x.credit AS "periodCredit",
    GREATEST(x.opening + x.debit - x.credit, 0) AS "closingDebit", GREATEST(-(x.opening + x.debit - x.credit), 0) AS "closingCredit"
  FROM gl_accounts a JOIN (
    SELECT account_code, sum(ob) AS opening, sum(d) AS debit, sum(c) AS credit FROM (
      SELECT account_code, balance AS ob, 0::numeric AS d, 0::numeric AS c FROM pe_balance_before($1::date)
      UNION ALL SELECT l.account_code, 0, l.debit, l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE ${POSTED} AND j.jv_date BETWEEN $1::date AND $2::date
    ) u GROUP BY account_code) x ON x.account_code = a.code
  WHERE x.opening <> 0 OR x.debit <> 0 OR x.credit <> 0`;

// General ledger detail: per account an opening balance line, the movements of the period and a running balance
const glDetail = `WITH u AS (
    SELECT account_code, $1::date AS d, NULL::text AS jv_number, 'Opening balance' AS descr, NULL::text AS source, NULL::text AS period, NULL::text AS cost_centre,
      GREATEST(balance, 0) AS debit, GREATEST(-balance, 0) AS credit, 0::bigint AS seq, true AS is_open FROM pe_balance_before($1::date)
    UNION ALL
    SELECT l.account_code, j.jv_date, j.jv_number, COALESCE(NULLIF(l.memo, ''), j.description), j.source, j.period, l.cost_centre, l.debit, l.credit, l.id, false
      FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE ${POSTED} AND j.jv_date BETWEEN $1::date AND $2::date)
  SELECT u.account_code AS "accountCode", a.name AS "accountName", u.account_code AS _account, u.d AS "date", u.period, u.jv_number AS "journalNumber", u.descr AS description, u.source,
    u.cost_centre AS "costCentre",
    CASE WHEN u.is_open THEN u.debit - u.credit END AS "openingBalance",
    CASE WHEN u.is_open THEN NULL ELSE u.debit END AS debit, CASE WHEN u.is_open THEN NULL ELSE u.credit END AS credit,
    sum(u.debit - u.credit) OVER (PARTITION BY u.account_code ORDER BY u.is_open DESC, u.d, u.seq) AS "runningBalance", u.seq AS _seq, u.is_open AS _open
  FROM u JOIN gl_accounts a ON a.code = u.account_code`;

// Premiums payable to insurers (invoice lists not yet paid), aged from the payable date as of To Date
const agedPayables = `SELECT il.invoice_number AS "payableNumber", il.created_at::date AS "payableDate", il.policy_number AS "policyNumber",
    ic.id::text AS _insurer_id, ic.code AS _insurer_code, COALESCE(ic.name, il.customer_code) AS insurer, c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
    il.payables AS amount, il.outstanding, il.status, ($2::date - il.created_at::date) AS "ageDays", rpt_age_bucket($2::date - il.created_at::date, $3::int[]) AS "ageBucket"
  FROM invoice_lists il LEFT JOIN insurance_companies ic ON ic.id = il.insurance_company_id LEFT JOIN clients c ON c.id = il.client_id
  WHERE lower(il.payee_type) = 'insurer' AND il.status IN ('open', 'in-voucher') AND il.outstanding > 0 AND il.created_at::date <= $2::date`;

// Month-end close status per accounting period in the date range
const closeStatus = `SELECT p.period, p.fiscal_year AS "fiscalYear", p.period_no AS "periodNo", p.start_date AS "startDate", p.end_date AS "endDate", p.status AS "periodStatus",
    r.run_number AS "runNumber", r.status AS "runStatus",
    (SELECT count(*) FROM period_close_run_checks c WHERE c.run_id = r.id AND c.status = 'failed') AS "blockingFailures",
    (SELECT count(*) FROM period_close_run_checks c WHERE c.run_id = r.id AND c.status = 'warning') AS warnings,
    (SELECT count(*) FROM period_close_entries e WHERE e.run_id = r.id AND e.status = 'active') AS journals,
    pu.display_name AS "preparedBy", r.prepared_at AS "preparedAt", au.display_name AS "approvedBy", r.approved_at AS "approvedAt", p.closed_at AS "closedAt", p.status AS status,
    -- bank reconciliations approved for the period / bank accounts with GL activity in it (see bank reconciliation)
    (SELECT count(*) FROM bank_reconciliations br WHERE br.period = p.period AND br.status = 'approved') || ' / ' ||
    (SELECT count(*) FROM bank_account_links b WHERE b.gl_account_code IS NOT NULL AND EXISTS (SELECT 1 FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE l.account_code = b.gl_account_code AND j.status IN ('posted', 'reversed') AND j.jv_date BETWEEN p.start_date AND p.end_date)) AS "bankReconciliations"
  FROM accounting_periods p
  LEFT JOIN LATERAL (SELECT * FROM period_close_runs x WHERE x.period = p.period AND x.status <> 'cancelled' ORDER BY x.created_at DESC LIMIT 1) r ON true
  LEFT JOIN users pu ON pu.id = r.prepared_by LEFT JOIN users au ON au.id = r.approved_by
  WHERE p.start_date <= $2::date AND p.end_date >= $1::date`;

// VAT summary: vatable revenue, output VAT and input VAT per month from the ledger (period-end valuation entries excluded)
const vatSummary = `SELECT to_char(j.jv_date, 'YYYY-MM') AS month, to_char(j.jv_date, 'YYYY') || '-Q' || to_char(j.jv_date, 'Q') AS quarter,
    CASE WHEN l.account_code = $3 THEN l.credit - l.debit ELSE 0 END AS _out,
    CASE WHEN l.account_code = $4 THEN l.debit - l.credit ELSE 0 END AS _in,
    CASE WHEN a.account_type = 'income' AND a.fs_group = 'Revenue' THEN l.credit - l.debit ELSE 0 END AS _sales
  FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
  WHERE ${POSTED} AND j.jv_date BETWEEN $1::date AND $2::date AND j.source NOT IN ('period-close', 'year-end-close')
    AND (l.account_code IN ($3, $4) OR (a.account_type = 'income' AND a.fs_group = 'Revenue'))`;
const vatExtras = [setting('accounting.account.output_vat', '2204003', 'text'), setting('accounting.account.input_vat', '1301001', 'text')];

// Name parts of an individual payee for the BIR alphalists ("First Middle Last" -> last, first, middle)
const nameParts = (col, individual) => `CASE WHEN ${individual} THEN split_part(${col}, ' ', array_length(string_to_array(${col}, ' '), 1)) END AS "lastName",
    CASE WHEN ${individual} THEN split_part(${col}, ' ', 1) END AS "firstName",
    CASE WHEN ${individual} AND array_length(string_to_array(${col}, ' '), 1) > 2 THEN split_part(${col}, ' ', 2) END AS "middleName",
    CASE WHEN ${individual} THEN NULL ELSE ${col} END AS "registeredName"`;

// SAWT: creditable tax withheld from the broker (insurers on direct-bill commission; clients on receipts)
const sawt = `SELECT x.* FROM (
    SELECT c.received_date AS _date, ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS payor, COALESCE(ic.tin, '') AS tin,
      NULL::text AS "lastName", NULL::text AS "firstName", NULL::text AS "middleName", ic.name AS "registeredName", $3::text AS atc, 'Commission of insurance brokers' AS "natureOfPayment",
      round(d.ewt_rate * 100, 2) AS "taxRate", round(CASE WHEN d.ewt_rate > 0 THEN c.ewt_amount / d.ewt_rate ELSE 0 END, 2) AS "incomePayment", c.ewt_amount AS "taxWithheld",
      COALESCE(c.form_2307_no, c.collection_number) AS reference
    FROM commission_debit_note_collections c JOIN commission_debit_notes d ON d.id = c.debit_note_id JOIN insurance_companies ic ON ic.id = d.insurance_company_id
    WHERE c.status = 'posted' AND c.ewt_amount > 0 AND c.received_date BETWEEN $1::date AND $2::date
    UNION ALL
    SELECT r.received_date, NULL, NULL, COALESCE(cl.display_name, r.customer_name), COALESCE(cl.tin, ''),
      ${nameParts("COALESCE(cl.display_name, r.customer_name, '')", "COALESCE(cl.client_type, 'individual') = 'individual'")},
      $3::text, 'Payment for services', round(100 * rl.ewt / NULLIF(rl.net_premium, 0), 2), rl.net_premium, rl.ewt, r.receipt_number
    FROM receipt_lines rl JOIN receipts r ON r.id = rl.receipt_id LEFT JOIN clients cl ON cl.id = r.client_id
    WHERE rl.ewt > 0 AND r.status <> 'cancelled' AND r.received_date BETWEEN $1::date AND $2::date) x`;
const ALPHA_DIMS = ['tin', 'registeredName', 'lastName', 'firstName', 'middleName', 'atc', 'natureOfPayment', 'taxRate'];
const alphaMeasures = { seqNo: 'row_number() OVER (ORDER BY t."registeredName" NULLS LAST, t."lastName", t.atc)', incomePayment: 'sum(t."incomePayment")', taxWithheld: 'sum(t."taxWithheld")' };

// QAP: tax the broker withheld from payees on payment vouchers (agents / referrers, suppliers, others) and on the
// supplier invoices of accounts payable (EWT of the invoice's tax code on the amount net of VAT, dated with its journal)
const qap = `SELECT x.* FROM (
  SELECT d.voucher_date AS _date, d.payee_name AS payee, COALESCE(cr.tin, ic.tin, cl.tin, '') AS tin,
    ${nameParts('d.payee_name', "COALESCE(cr.referrer_type, '') IN ('Agent', 'Sub-agent') OR COALESCE(cl.client_type, '') = 'individual'")},
    COALESCE($3::jsonb ->> cr.referrer_type, $3::jsonb ->> d.payee_type, '') AS atc,
    COALESCE((SELECT COALESCE(tc.nature_of_payment, tc.description) FROM tax_codes tc WHERE tc.atc = COALESCE($3::jsonb ->> cr.referrer_type, $3::jsonb ->> d.payee_type)), d.payee_type) AS "natureOfPayment",
    round(100 * d.wht_amount / NULLIF(COALESCE(NULLIF(d.gross_amount, 0), d.amount + d.wht_amount), 0), 2) AS "taxRate",
    COALESCE(NULLIF(d.gross_amount, 0), d.amount + d.wht_amount) AS "incomePayment", d.wht_amount AS "taxWithheld", d.voucher_number AS reference, d.payee_type AS "payeeType"
  FROM disbursements d LEFT JOIN commission_referrers cr ON cr.id = d.referrer_id LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id LEFT JOIN clients cl ON cl.id = d.client_id
  WHERE d.wht_amount > 0 AND d.status IN ('approved', 'paid') AND d.voucher_date BETWEEN $1::date AND $2::date
  UNION ALL
  SELECT COALESCE(j.jv_date, i.invoice_date), m.name, COALESCE(m.data->>'tin', ''),
    ${nameParts('m.name', "COALESCE(tc.payee_kind, '') = 'individual'")},
    COALESCE(tc.atc, $3::jsonb ->> 'Supplier', ''), COALESCE(tc.nature_of_payment, tc.description, 'Supplier'),
    round(100 * i.ewt_amount / NULLIF(i.net_amount, 0), 2), i.net_amount, i.ewt_amount, i.voucher_number, 'Supplier'
  FROM supplier_invoices i JOIN master_records m ON m.id = i.supplier_id LEFT JOIN journal_vouchers j ON j.id = i.journal_id LEFT JOIN tax_codes tc ON tc.code = i.ewt_code
  WHERE i.ewt_amount > 0 AND i.status IN ('approved', 'partially-paid', 'paid') AND COALESCE(j.jv_date, i.invoice_date) BETWEEN $1::date AND $2::date) x`;

// SLSP – sales: revenue and output VAT per customer (the insurer of the policy for commission, else the client)
const slspSales = `SELECT to_char(j.jv_date, 'YYYY-MM') AS "taxableMonth", COALESCE(ic.tin, cl.tin, '') AS tin,
    COALESCE(ic.name, CASE WHEN cl.client_type = 'corporate' THEN cl.display_name END, '') AS "registeredName",
    CASE WHEN ic.id IS NULL AND COALESCE(cl.client_type, 'individual') = 'individual' THEN cl.display_name END AS "customerName",
    COALESCE(ic.address, cl.address, '') AS address,
    CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE 0 END AS "grossSales",
    0::numeric AS "exemptSales", 0::numeric AS "zeroRatedSales",
    CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE 0 END AS "taxableSales",
    CASE WHEN l.account_code = $3 THEN l.credit - l.debit ELSE 0 END AS "outputTax",
    ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer, cl.id AS _client_id, cl.client_code AS _client_code, cl.display_name AS client
  FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
  LEFT JOIN policies p ON p.id = COALESCE(l.policy_id, j.policy_id) LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN clients cl ON cl.id = COALESCE(l.client_id, j.client_id, p.client_id)
  WHERE ${POSTED} AND j.jv_date BETWEEN $1::date AND $2::date AND j.source NOT IN ('period-close', 'year-end-close')
    AND EXISTS (SELECT 1 FROM journal_lines v WHERE v.jv_id = j.id AND v.account_code = $3)
    AND ((a.account_type = 'income' AND a.fs_group = 'Revenue') OR l.account_code = $3)`;
const slspDims = ['taxableMonth', 'tin', 'registeredName', 'customerName', 'address'];

// SLSP – purchases: input VAT per supplier (payment voucher payee, else the journal description)
const slspPurchases = `SELECT to_char(j.jv_date, 'YYYY-MM') AS "taxableMonth", COALESCE(cr.tin, ic.tin, '') AS tin,
    COALESCE(d.payee_name, j.description, '') AS "registeredName", NULL::text AS "supplierName", COALESCE(ic.address, '') AS address,
    round((l.debit - l.credit) / NULLIF($4::numeric, 0), 2) AS "taxablePurchases", l.debit - l.credit AS "inputTax"
  FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
  LEFT JOIN disbursements d ON d.journal_id = j.id LEFT JOIN commission_referrers cr ON cr.id = d.referrer_id LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id
  WHERE ${POSTED} AND j.jv_date BETWEEN $1::date AND $2::date AND l.account_code = $3 AND j.source NOT IN ('period-close', 'year-end-close')`;

export const PERIOD_END_QUERIES = {
  incomeStatement: {
    sql: incomeStatement, filters: ACCOUNT_FILTER,
    criteria: { Detailed: { dims: ['accountType', 'fsGroup', 'accountCode', 'accountName'] }, Summary: { dims: ['accountType', 'fsGroup'] } },
    aggregate: isMeasures, orderBy: statementOrder,
    summary: { netIncome: net('currentPeriod'), netIncomeYearToDate: net('yearToDate'), priorNetIncome: net('priorPeriod'), priorNetIncomeYearToDate: net('priorYearToDate'),
      totalIncome: 'COALESCE(sum(f."currentPeriod") FILTER (WHERE f."accountType" = \'income\'), 0)', totalExpense: 'COALESCE(sum(f."currentPeriod") FILTER (WHERE f."accountType" = \'expense\'), 0)' },
  },
  balanceSheet: {
    sql: balanceSheet, filters: ACCOUNT_FILTER,
    criteria: { Detailed: { dims: ['accountType', 'fsGroup', 'accountCode', 'accountName'] }, Summary: { dims: ['accountType', 'fsGroup'] } },
    aggregate: { balance: 'COALESCE(sum(t._amt), 0)', priorYearEnd: `COALESCE(sum(t._amt) FILTER (WHERE t._date < ${YS}), 0)` },
    orderBy: statementOrder,
    summary: { totalAssets: bsTotal('balance', "'asset'"), totalLiabilities: bsTotal('balance', "'liability'"), totalEquity: bsTotal('balance', "'equity'"),
      totalLiabilitiesAndEquity: bsTotal('balance', "'liability','equity'"), difference: `${bsTotal('balance', "'asset'")} - ${bsTotal('balance', "'liability','equity'")}`,
      priorTotalAssets: bsTotal('priorYearEnd', "'asset'"), priorTotalLiabilitiesAndEquity: bsTotal('priorYearEnd', "'liability','equity'") },
  },
  trialBalanceOcm: {
    sql: trialBalanceOcm, filters: ACCOUNT_FILTER, criteria: { Overall: {}, 'Account Type': { groupBy: 'accountType' }, 'Statement Group': { groupBy: 'fsGroup' } },
    orderBy: `COALESCE(array_position(${TYPE_ORDER}, f."accountType"), 99), f."accountCode"`,
    summary: { balanced: 'sum(f."closingDebit") = sum(f."closingCredit")', openingBalanced: 'sum(f."openingDebit") = sum(f."openingCredit")',
      netIncome: 'COALESCE(sum(f."closingCredit" - f."closingDebit") FILTER (WHERE f."accountType" IN (\'income\', \'expense\')), 0)',
      periodNetIncome: 'COALESCE(sum(f."periodCredit" - f."periodDebit") FILTER (WHERE f."accountType" IN (\'income\', \'expense\')), 0)' },
  },
  glDetail: {
    sql: glDetail, filters: ACCOUNT_FILTER, criteria: { Account: { groupBy: 'accountCode' }, Overall: {} },
    orderBy: 'f."accountCode", f._open DESC, f."date", f._seq',
    summary: { closingBalance: 'COALESCE(sum(f."openingBalance"), 0) + COALESCE(sum(f.debit), 0) - COALESCE(sum(f.credit), 0)' },
  },
  agedPayablesInsurers: {
    sql: agedPayables, extras: [setting('limits.receivable_ageing_buckets', [30, 60, 90, 120], 'int[]')], filters: ['insurer', 'client', 'status'],
    criteria: { 'Ageing Bucket': { groupBy: 'ageBucket' }, 'Principal Insurer': { groupBy: 'insurer' }, Overall: {} }, orderBy: 'f.insurer, f."ageDays" DESC',
  },
  monthEndCloseStatus: {
    sql: closeStatus, filters: ['status'], criteria: { Overall: {}, 'Fiscal Year': { groupBy: 'fiscalYear' }, 'Period Status': { groupBy: 'periodStatus' } },
    orderBy: 'f."fiscalYear", f."periodNo"',
  },
  vatSummary: {
    sql: vatSummary, extras: vatExtras, criteria: { Monthly: { dims: ['month'] }, Quarterly: { dims: ['quarter'] } },
    aggregate: { vatableSales: 'COALESCE(sum(t._sales), 0)', outputVat: 'COALESCE(sum(t._out), 0)', inputVat: 'COALESCE(sum(t._in), 0)', netVatPayable: 'COALESCE(sum(t._out), 0) - COALESCE(sum(t._in), 0)' },
  },
  sawt: {
    sql: sawt, extras: [setting('bir.sawt_default_atc', 'WC139', 'text')], criteria: { Summary: { dims: ALPHA_DIMS } }, aggregate: alphaMeasures,
    orderBy: 'f."seqNo"',
  },
  qap: {
    sql: qap, extras: [setting('bir.atc_by_payee', {}, 'jsonb')], criteria: { Summary: { dims: ALPHA_DIMS } }, aggregate: alphaMeasures, orderBy: 'f."seqNo"',
  },
  slspSales: {
    sql: slspSales, extras: [setting('accounting.account.output_vat', '2204003', 'text')], filters: ['insurer', 'client'],
    criteria: { Summary: { dims: slspDims } },
    aggregate: { grossSales: 'sum(t."grossSales")', exemptSales: 'sum(t."exemptSales")', zeroRatedSales: 'sum(t."zeroRatedSales")', taxableSales: 'sum(t."taxableSales")',
      outputTax: 'sum(t."outputTax")', grossTaxableSales: 'sum(t."taxableSales") + sum(t."outputTax")' },
  },
  slspPurchases: {
    sql: slspPurchases, extras: [setting('accounting.account.input_vat', '1301001', 'text'), setting('tax.vat_rate', 0.12, 'numeric')],
    criteria: { Summary: { dims: ['taxableMonth', 'tin', 'registeredName', 'supplierName', 'address'] } },
    aggregate: { grossPurchases: 'sum(t."taxablePurchases")', exemptPurchases: '0', zeroRatedPurchases: '0', taxablePurchases: 'sum(t."taxablePurchases")',
      purchaseOfServices: 'sum(t."taxablePurchases")', purchaseOfCapitalGoods: '0', purchaseOfOtherGoods: '0', inputTax: 'sum(t."inputTax")',
      grossTaxablePurchases: 'sum(t."taxablePurchases") + sum(t."inputTax")' },
  },
};
