/**
 * Report queries of the TISPH report layouts (CR-14 operations, CR-15 cash control, CR-16 finance and general ledger),
 * merged into QUERIES (queries.js). Same conventions: $1 from date, $2 to date, extras from $3, "_" columns internal.
 *
 * CR-16  fsByVersion        trial balance by the lines of a financial statement version (TIS01 / TIS02 / TIS03):
 *                           opening, period movement, closing, year to date and the prior year to date; lines with
 *                           nothing to show are left out (zero suppression)
 *        dailyGlBalance     beginning balance and the balance at the end of each calendar day from From Date
 * CR-15  paymentSummary, dailyReversals, pdcEncoded, pdcCancelled, pdcMaturing, pdcMaturingMatrix, pdcHistory,
 *        pdcAcknowledgements
 * CR-14  netRemittanceFullyPaid, netRemittancePartiallyPaid, premiumPaymentStatus, invoiceTracker; the bank matching
 *        reports insufficientPayments and overpayments
 */
import { FS_MAP } from '../accounting/fsVersions.js';
import { FY_START, POSTED } from './periodEndQueries.js';

const setting = (key, fallback, type) => ({ key, fallback, type });
const DAYS = 31;
const USER = (col, alias) => `LEFT JOIN LATERAL (SELECT display_name FROM users WHERE id = ${col} OR username = ${col} ORDER BY (id = ${col}) DESC LIMIT 1) ${alias} ON true`;
const CLIENT_DIMS = 'c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client';
const INSURER_DIMS = 'ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer';

// ------------------------------------------------------------------ CR-16 finance and general ledger
// Accounts with their version line; amounts signed by the line's normal balance (a credit line shows credits positive)
const fsRows = (movementFrom) => `WITH map AS (${FS_MAP})
  SELECT map.version_code AS _fs_version, map.statement, map.section, map.caption, map.line_no AS _line, map.code AS "accountCode", map.name AS "accountName",
    map.code AS _account, x.kind AS _kind, x.d AS _date, CASE WHEN map.normal_balance = 'credit' THEN -x.amt ELSE x.amt END AS _amt
  FROM map JOIN (
    SELECT account_code, 'open' AS kind, NULL::date AS d, balance AS amt FROM pe_balance_before($1::date)
    UNION ALL
    SELECT l.account_code, 'move', j.jv_date, l.debit - l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE ${POSTED} AND j.jv_date BETWEEN ${movementFrom} AND $2::date
       AND (j.source <> 'year-end-close' OR NOT EXISTS (SELECT 1 FROM gl_accounts ga WHERE ga.code = l.account_code AND ga.account_type IN ('income', 'expense')))
  ) x ON x.account_code = map.code`;
const YS = FY_START('$2');
const fsMeasures = {
  openingBalance: "COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'open'), 0)",
  periodMovement: "COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'move' AND t._date BETWEEN $1::date AND $2::date), 0)",
  closingBalance: "COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'open' OR (t._kind = 'move' AND t._date BETWEEN $1::date AND $2::date)), 0)",
  yearToDate: `COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'move' AND t._date BETWEEN ${YS} AND $2::date), 0)`,
  priorYearToDate: `COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'move' AND t._date BETWEEN (${YS} - interval '1 year')::date AND ($2::date - interval '1 year')::date), 0)`,
  _order: 'min(t._line)',
};
const dayMeasures = Object.fromEntries(Array.from({ length: DAYS }, (_, i) => [`d${String(i + 1).padStart(2, '0')}`,
  `CASE WHEN $1::date + ${i} <= $2::date THEN COALESCE(sum(t._amt) FILTER (WHERE t._kind = 'open' OR t._date <= $1::date + ${i}), 0) END`]));
const FS_DIMS = ['statement', 'section', 'caption'];
const FS_ACCOUNT_DIMS = [...FS_DIMS, 'accountCode', 'accountName'];
const fsOrder = (dims) => ['f._order', ...(dims.includes('accountCode') ? ['f."accountCode"'] : [])].join(', ');
const FS_VERSION = { fsVersion: setting('accounting.default_fs_version', 'TIS01', 'text') };

// ------------------------------------------------------------------ CR-15 cash control
const RECEIPT_STATE = "CASE r.receipt_status WHEN 'Cancelled' THEN 'Reversed' WHEN 'Draft' THEN 'Not posted' ELSE 'Posted' END";
const paymentSummary = `SELECT r.received_date AS "paymentDate", r.created_at::date AS "postingDate", r.receipt_number AS "receiptNumber",
    COALESCE(p.policy_number, r.policy_number) AS "policyNumber", r.reference_no AS "referenceNo", ${CLIENT_DIMS}, r.amount,
    COALESCE(bk.name, r.bank_account_code) AS bank, CASE WHEN r.payment_mode IN ('check', 'cheque', 'pdc') THEN r.reference_no END AS "chequeNumber",
    r.payment_mode AS "paymentMethod", COALESCE(r.source, 'manual') AS channel, r.receipt_status AS status, cu.display_name AS "user", ${RECEIPT_STATE} AS "postingStatus"
  FROM receipts r LEFT JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
  LEFT JOIN banks bk ON bk.id = r.bank_id ${USER('r.created_by', 'cu')}
  WHERE r.received_date BETWEEN $1 AND $2`;

const reasonName = (code) => `(SELECT m.name FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = ${code} LIMIT 1)`;
const dailyReversals = `SELECT 'Receipt reversal' AS kind, r.cancelled_at::date AS "reversalDate", r.received_date AS "actualDate", r.receipt_number AS reference,
    COALESCE(r.reversal_reason, r.cancel_reason) AS reason, COALESCE(p.policy_number, r.policy_number) AS "policyNumber", ${CLIENT_DIMS}, r.amount,
    COALESCE(r.bank_account_code, bk.name, 'Not recorded') AS "bankAccount", CASE WHEN r.payment_mode IN ('check', 'cheque', 'pdc') THEN r.reference_no END AS "chequeNumber",
    r.payment_mode AS "paymentMethod", cu.display_name AS "user"
  FROM receipts r LEFT JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = COALESCE(r.client_id, p.client_id)
  LEFT JOIN banks bk ON bk.id = r.bank_id ${USER('r.cancelled_by', 'cu')}
  WHERE r.receipt_status = 'Cancelled' AND r.cancelled_at::date BETWEEN $1 AND $2
  UNION ALL
  SELECT 'Bounced cheque', d.bounced_on, d.cheque_date, d.pdc_number, COALESCE(${reasonName('d.bounce_reason_code')}, d.bounce_reason), p.policy_number, ${CLIENT_DIMS}, d.amount,
    COALESCE(d.deposit_account, CASE WHEN d.payee = 'insurance-partner' THEN ic.name END, 'Not recorded'), d.cheque_number, 'check', du.display_name
  FROM post_dated_cheques d LEFT JOIN policies p ON p.id = d.policy_id LEFT JOIN clients c ON c.id = d.client_id
  LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id ${USER('d.updated_by', 'du')}
  WHERE d.bounced_on BETWEEN $1 AND $2`;

const PDC_STATUS = `CASE d.status WHEN 'on-hand' THEN 'Received at TIS' WHEN 'forwarded' THEN 'Forwarded' WHEN 'warehoused' THEN 'Warehoused' WHEN 'deposited' THEN 'Deposited'
  WHEN 'cleared' THEN 'Cleared' WHEN 'bounced' THEN 'Bounced' WHEN 'replaced' THEN 'Replaced' WHEN 'cancellation-pending' THEN 'Cancellation pending'
  WHEN 'cancelled' THEN 'Cancelled' WHEN 'returned' THEN 'Returned' ELSE d.status END`;
const WAREHOUSE = "CASE WHEN d.payee = 'insurance-partner' THEN COALESCE(ic.name, 'Insurance Partner') ELSE COALESCE(d.deposit_account, 'TISPH') END";
const PDC_FROM = `FROM post_dated_cheques d LEFT JOIN pdc_sets s ON s.id = d.set_id LEFT JOIN policies p ON p.id = d.policy_id
  LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN insurance_companies ic ON ic.id = COALESCE(d.insurance_company_id, p.insurance_company_id)
  LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN banks bk ON bk.id = d.bank_id`;
const PDC_COLUMNS = `d.pdc_number AS "pdcNumber", s.set_number AS "setNumber", p.policy_number AS "policyNumber", ${CLIENT_DIMS}, ${INSURER_DIMS},
    COALESCE(bk.name, d.drawee_bank) AS bank, d.cheque_number AS "chequeNumber", d.cheque_date AS "chequeDate", d.amount,
    CASE WHEN d.instalment_seq IS NOT NULL THEN d.instalment_seq || ' of ' || COALESCE(d.instalment_count, d.instalment_seq) END AS amortisation,
    ${WAREHOUSE} AS warehouse, ${PDC_STATUS} AS status`;
const pdcEncoded = `SELECT ${PDC_COLUMNS}, d.received_date AS "transactionDate", d.created_at::date AS "encodedDate", initcap(COALESCE(p.status, '')) AS "contractState",
    eu.display_name AS "encodedBy"
  ${PDC_FROM} ${USER('d.created_by', 'eu')}
  WHERE d.created_at::date BETWEEN $1 AND $2`;
const pdcCancelled = `SELECT ${PDC_COLUMNS}, d.cancelled_on AS "cancelledDate", COALESCE(${reasonName('d.cancel_reason_code')}, d.cancel_remarks) AS reason, d.cancel_remarks AS remarks,
    ru.display_name AS "requestedBy", au.display_name AS "cancelledBy"
  ${PDC_FROM} ${USER('d.cancel_requested_by', 'ru')} ${USER('COALESCE(d.cancel_approved_by, d.cancelled_by)', 'au')}
  WHERE d.status = 'cancelled' AND d.cancelled_on BETWEEN $1 AND $2`;
const pdcMaturing = `SELECT ${PDC_COLUMNS}, COALESCE(pr.name, 'No product') AS product, d.instalment_due_date AS "instalmentDate", p.expiry_date AS "endOfTerm",
    CASE WHEN d.status = 'cancellation-pending' THEN 'Held for cancellation' WHEN rh.policy_id IS NOT NULL THEN 'Remittance on hold' ELSE '' END AS suspension
  ${PDC_FROM} LEFT JOIN remittance_holds rh ON rh.policy_id = d.policy_id AND rh.status = 'held'
  WHERE d.cheque_date BETWEEN $1 AND $2 AND d.status IN ('on-hand', 'forwarded', 'warehoused', 'deposited', 'cancellation-pending', 'bounced')`;
const pdcHistory = `SELECT a.at AS "eventAt", d.pdc_number AS "pdcNumber", d.cheque_number AS "chequeNumber", COALESCE(bk.name, d.drawee_bank) AS bank, p.policy_number AS "policyNumber",
    ${CLIENT_DIMS}, ${INSURER_DIMS}, initcap(replace(a.action, '-', ' ')) AS event, COALESCE(a.after_data->>'statusText', a.after_data->>'status') AS "statusAfter",
    COALESCE(a.after_data->>'remark', a.after_data->>'reason', a.after_data->>'receivedBy') AS detail, COALESCE(au.display_name, a.username) AS "user", d.amount
  FROM audit_log a JOIN post_dated_cheques d ON d.id = a.entity_id LEFT JOIN policies p ON p.id = d.policy_id LEFT JOIN clients c ON c.id = d.client_id
  LEFT JOIN insurance_companies ic ON ic.id = COALESCE(d.insurance_company_id, p.insurance_company_id) LEFT JOIN banks bk ON bk.id = d.bank_id ${USER('a.user_id', 'au')}
  WHERE a.entity = 'post_dated_cheque' AND a.at::date BETWEEN $1 AND $2`;
const pdcAcknowledgements = `SELECT s.set_number AS "setNumber", s.received_date AS "receivedDate", p.policy_number AS "policyNumber", ${CLIENT_DIMS}, ${INSURER_DIMS},
    CASE s.payee WHEN 'insurance-partner' THEN 'Insurance Partner' ELSE 'TISPH' END AS "payableTo",
    (SELECT count(*) FROM post_dated_cheques x WHERE x.set_id = s.id AND x.status NOT IN ('cancelled', 'replaced', 'returned')) AS cheques,
    (SELECT COALESCE(sum(x.amount), 0) FROM post_dated_cheques x WHERE x.set_id = s.id AND x.status NOT IN ('cancelled', 'replaced', 'returned')) AS amount,
    su.display_name AS "receivedBy", initcap(s.status) AS status
  FROM pdc_sets s LEFT JOIN policies p ON p.id = s.policy_id LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN insurance_companies ic ON ic.id = s.insurance_company_id
  ${USER('s.received_by', 'su')}
  WHERE s.received_date BETWEEN $1 AND $2`;

// ------------------------------------------------------------------ CR-14 operations: premium and net remittance
// Payment position of each broker-billed policy from its bills: billed, paid to date, outstanding, last payment
const POSITION = `SELECT rv.policy_id, sum(rv.amount) AS billed, sum(rv.amount - rv.balance) AS paid, sum(rv.balance) AS outstanding,
    sum(COALESCE(rv.vat, 0) + COALESCE(rv.dst, 0) + COALESCE(rv.lgt, 0)) AS taxes,
    (SELECT max(a.collected_on) FROM receipt_applications a JOIN receivables x ON x.id = a.receivable_id WHERE x.policy_id = rv.policy_id AND a.status = 'applied') AS last_paid
  FROM receivables rv WHERE rv.status NOT IN ('cancelled', 'written-off', 'credited') GROUP BY rv.policy_id`;
const REMITTED = `LEFT JOIN LATERAL (SELECT r.remittance_number, r.status, COALESCE(r.remittance_date, r.created_at::date) AS remitted_on FROM remittance_lines l
    JOIN remittances r ON r.id = l.remittance_id WHERE l.policy_id = p.id AND r.status NOT IN ('rejected', 'cancelled') ORDER BY r.created_at DESC LIMIT 1) rm ON true`;
const netRemittance = (where) => `SELECT ${INSURER_DIMS}, p.policy_number AS "policyNumber", ${CLIENT_DIMS}, pr.name AS product, p.inception_date AS "inceptionDate",
    p.premium_total AS "grossPremium", p.commission_amount AS commission,
    round(100.0 * (p.premium_total - COALESCE(p.commission_amount, 0)) / NULLIF(p.premium_total, 0), 2) AS "remittingRate",
    p.premium_total - COALESCE(p.commission_amount, 0) AS "netRemittance", pos.taxes, pos.paid AS "paidToDate", pos.outstanding,
    pos.last_paid AS "lastPaymentDate", CASE WHEN pos.outstanding <= 0 THEN 'Fully paid' ELSE 'Partially paid' END AS "paymentStatus",
    rm.remittance_number AS "remittanceNumber", initcap(rm.status) AS "remittanceStatus", pr.id::text AS _product_id, pr.code AS _product_code
  FROM policies p JOIN (${POSITION}) pos ON pos.policy_id = p.id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id ${REMITTED}
  WHERE p.billing_mode <> 'direct' AND ${where}`;
const premiumPaymentStatus = `SELECT p.policy_number AS "policyNumber", p.inception_date AS "inceptionDate", ${CLIENT_DIMS}, ${INSURER_DIMS}, pr.name AS product,
    pr.id::text AS _product_id, pr.code AS _product_code, p.premium_total AS premium, COALESCE(pos.paid, 0) AS paid, COALESCE(pos.outstanding, p.premium_total) AS outstanding,
    CASE WHEN p.status IN ('cancelled', 'Cancelled') THEN 'Cancelled' WHEN pos.policy_id IS NULL OR COALESCE(pos.paid, 0) <= 0 THEN 'Pending'
      WHEN pos.outstanding <= 0 THEN 'Fully paid' ELSE 'Partially paid' END AS "paymentStatus",
    (SELECT string_agg(r.receipt_number, ', ' ORDER BY r.received_date) FROM receipts r WHERE r.policy_id = p.id AND r.receipt_status <> 'Cancelled') AS "receiptNumbers",
    rm.remittance_number AS "remittanceBatch", initcap(rm.status) AS "remittanceStatus"
  FROM policies p LEFT JOIN (${POSITION}) pos ON pos.policy_id = p.id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id ${REMITTED}
  WHERE p.billing_mode <> 'direct' AND p.inception_date BETWEEN $1 AND $2`;

// Bank payment matching (FGA-BR-03 to BR-06): insufficient payments and the overpayments held On Account
const insufficientPayments = `SELECT l.paid_on AS "paidOn", l.reference, p.policy_number AS "policyNumber", ${CLIENT_DIMS}, ${INSURER_DIMS}, l.expected AS "expectedPremium",
    l.amount AS paid, -l.difference AS shortfall, l.bank_account AS "bankAccount", 'Bank payment' AS channel, b.batch_number AS batch, r.receipt_number AS "receiptNumber",
    (SELECT COALESCE(sum(x.balance), 0) FROM receivables x WHERE x.policy_id = p.id AND x.status IN ('open', 'partial')) AS "stillOwed"
  FROM bank_payment_lines l JOIN receipt_batches b ON b.id = l.batch_id LEFT JOIN policies p ON p.id = l.policy_id LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN receipts r ON r.id = l.receipt_id
  WHERE l.outcome = 'underpaid' AND l.paid_on BETWEEN $1 AND $2`;
const overpayments = `SELECT u.received_date AS "receivedDate", COALESCE(r.receipt_number, u.reference_no) AS reference, p.policy_number AS "policyNumber", ${CLIENT_DIMS}, ${INSURER_DIMS},
    l.expected AS "expectedPremium", COALESCE(l.amount, r.amount) AS paid, u.amount AS excess, u.balance AS "heldBalance", initcap(u.status) AS status,
    CASE WHEN l.id IS NOT NULL THEN 'Bank payment' ELSE 'Receipt' END AS channel, u.allocate_by AS "allocateBy", u.refund_reason AS "refundReason"
  FROM unapplied_collections u LEFT JOIN receipts r ON r.id = u.receipt_id LEFT JOIN bank_payment_lines l ON l.unapplied_id = u.id
  LEFT JOIN policies p ON p.id = u.policy_id LEFT JOIN clients c ON c.id = COALESCE(u.client_id, p.client_id) LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  WHERE u.kind = 'excess' AND u.status <> 'reversed' AND u.received_date BETWEEN $1 AND $2`;
// Invoice tracker (TIS-BRD-RPT-OPS-10): the bills of the period by state and by days overdue in the buckets of
// reports.invoice_tracker_buckets (1-15, 16-30, 31-60, 61+ for TISPH), as of To Date
const TRACKER_BUCKET = `(SELECT CASE WHEN x.days <= 0 THEN 'Not due' ELSE COALESCE((SELECT (COALESCE(($3::int[])[i - 1], 0) + 1) || '-' || ($3::int[])[i]
    FROM generate_subscripts($3::int[], 1) i WHERE x.days <= ($3::int[])[i] ORDER BY i LIMIT 1), (($3::int[])[array_length($3::int[], 1)] + 1) || '+') END)`;
const invoiceTracker = `SELECT x.*, CASE WHEN x.balance <= 0 THEN 'Paid' WHEN x.balance < x.amount THEN 'Partially paid' ELSE 'Not paid' END AS "paymentState",
    CASE WHEN x.balance <= 0 THEN 'Paid' WHEN x.days > 0 THEN 'Overdue' ELSE 'Not due' END AS status, CASE WHEN x.balance <= 0 THEN 'Paid' ELSE ${TRACKER_BUCKET} END AS "ageBucket"
  FROM (SELECT rv.bill_number AS "billNumber", COALESCE(rv.created_at::date, rv.due_date) AS "billDate", rv.due_date AS "dueDate", p.policy_number AS "policyNumber",
      ${CLIENT_DIMS}, ${INSURER_DIMS}, rv.amount, rv.amount - rv.balance AS paid, rv.balance, GREATEST($2::date - rv.due_date, 0) AS days
    FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN clients c ON c.id = COALESCE(rv.client_id, p.client_id)
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE rv.status NOT IN ('cancelled', 'credited') AND COALESCE(rv.created_at::date, rv.due_date) BETWEEN $1 AND $2) x`;

export const TISPH_QUERIES = {
  fsByVersion: {
    sql: fsRows(`(LEAST($1::date, ${YS}) - interval '1 year')::date`), filters: ['account', 'fsVersion'], defaults: FS_VERSION,
    criteria: { 'FS Line': { dims: FS_DIMS, groupBy: 'section' }, 'GL Account': { dims: FS_ACCOUNT_DIMS, groupBy: 'caption' } },
    aggregate: fsMeasures, orderBy: fsOrder,
    having: 'h."openingBalance" <> 0 OR h."periodMovement" <> 0 OR h."yearToDate" <> 0 OR h."priorYearToDate" <> 0',
  },
  dailyGlBalance: {
    sql: fsRows('$1::date'), filters: ['account', 'fsVersion'], defaults: FS_VERSION,
    criteria: { 'GL Account': { dims: FS_ACCOUNT_DIMS, groupBy: 'caption' }, 'FS Line': { dims: FS_DIMS, groupBy: 'section' } },
    aggregate: { beginningBalance: fsMeasures.openingBalance, ...dayMeasures, endingBalance: fsMeasures.closingBalance, _order: 'min(t._line)' },
    orderBy: fsOrder, having: 'h."beginningBalance" <> 0 OR h."endingBalance" <> 0',
  },
  paymentSummary: {
    sql: paymentSummary, filters: ['client', 'status'],
    criteria: { Overall: {}, User: { groupBy: 'user' }, 'Payment Method': { groupBy: 'paymentMethod' }, 'Posting Status': { groupBy: 'postingStatus' } },
    orderBy: 'f."paymentDate", f."receiptNumber"',
  },
  dailyReversals: {
    sql: dailyReversals, filters: ['client'], criteria: { 'Bank Account': { groupBy: 'bankAccount' }, Overall: {}, Kind: { groupBy: 'kind' } },
    orderBy: 'f."bankAccount", f."reversalDate", f.reference',
  },
  pdcEncoded: {
    sql: pdcEncoded, filters: ['client', 'insurer', 'status'], criteria: { 'Warehouse Bank': { groupBy: 'warehouse' }, User: { groupBy: 'encodedBy' }, Overall: {} },
    orderBy: 'f.warehouse, f."encodedDate", f."pdcNumber"',
  },
  pdcCancelled: {
    sql: pdcCancelled, filters: ['client', 'insurer'], criteria: { Overall: {}, Reason: { groupBy: 'reason' } }, orderBy: 'f."cancelledDate", f."pdcNumber"',
  },
  pdcMaturing: {
    sql: pdcMaturing, filters: ['client', 'insurer', 'status'], criteria: { Overall: {}, Product: { groupBy: 'product' }, 'Warehouse Bank': { groupBy: 'warehouse' } },
    orderBy: 'f."chequeDate", f."pdcNumber"',
  },
  pdcMaturingMatrix: {
    sql: pdcMaturing, filters: ['insurer'], criteria: { 'Product and Warehouse Bank': { dims: ['product', 'warehouse'] }, Product: { dims: ['product'] }, 'Warehouse Bank': { dims: ['warehouse'] } },
    aggregate: { cheques: 'count(*)', amount: 'sum(t.amount)', heldForCancellation: "count(*) FILTER (WHERE t.suspension <> '')" },
  },
  pdcHistory: {
    sql: pdcHistory, filters: ['client', 'insurer'], criteria: { Overall: {}, Cheque: { groupBy: 'pdcNumber' }, Contract: { groupBy: 'policyNumber' } },
    orderBy: 'f."pdcNumber", f."eventAt"',
  },
  pdcAcknowledgements: {
    sql: pdcAcknowledgements, filters: ['client', 'insurer'], criteria: { Overall: {}, 'Payable To': { groupBy: 'payableTo' } }, orderBy: 'f."receivedDate", f."setNumber"',
  },
  netRemittanceFullyPaid: {
    sql: netRemittance('pos.billed > 0 AND pos.outstanding <= 0 AND pos.last_paid BETWEEN $1 AND $2'), filters: ['insurer', 'client', 'product'],
    criteria: { 'Principal Insurer': { groupBy: 'insurer' }, Overall: {} }, orderBy: 'f.insurer, f."lastPaymentDate", f."policyNumber"',
  },
  netRemittancePartiallyPaid: {
    sql: netRemittance('pos.paid > 0 AND pos.outstanding > 0 AND pos.last_paid BETWEEN $1 AND $2'), filters: ['insurer', 'client', 'product'],
    criteria: { 'Principal Insurer': { groupBy: 'insurer' }, Overall: {} }, orderBy: 'f.insurer, f."policyNumber"',
  },
  insufficientPayments: {
    sql: insufficientPayments, filters: ['insurer', 'client'], criteria: { Overall: {}, 'Principal Insurer': { groupBy: 'insurer' }, 'Bank Account': { groupBy: 'bankAccount' } },
    orderBy: 'f."paidOn", f.reference',
  },
  overpayments: {
    sql: overpayments, filters: ['insurer', 'client', 'status'], criteria: { Overall: {}, Status: { groupBy: 'status' }, Channel: { groupBy: 'channel' } },
    orderBy: 'f."receivedDate", f.reference',
  },
  invoiceTracker: {
    sql: invoiceTracker, extras: [setting('reports.invoice_tracker_buckets', [15, 30, 60], 'int[]')], filters: ['insurer', 'client', 'status'],
    criteria: { Ageing: { groupBy: 'ageBucket' }, Status: { groupBy: 'status' }, 'Payment State': { groupBy: 'paymentState' }, Overall: {} },
    orderBy: 'f."dueDate", f."billNumber"',
    summary: { overdue: 'count(*) FILTER (WHERE f.status = \'Overdue\')', notDue: 'count(*) FILTER (WHERE f.status = \'Not due\')',
      partiallyPaid: 'count(*) FILTER (WHERE f."paymentState" = \'Partially paid\')', paid: 'count(*) FILTER (WHERE f."paymentState" = \'Paid\')',
      overpayments: "(SELECT count(*) FROM unapplied_collections u WHERE u.kind = 'excess' AND u.status = 'open')" },
  },
  premiumPaymentStatus: {
    sql: premiumPaymentStatus, filters: ['insurer', 'client', 'product'],
    criteria: { 'Payment Status': { groupBy: 'paymentStatus' }, Overall: {}, 'Principal Insurer': { groupBy: 'insurer' } }, orderBy: 'f."inceptionDate", f."policyNumber"',
  },
};
