/**
 * Migration kit: the open business of the old system at cutover. Clients and in-force policies keep their legacy
 * numbers (the natural keys, so a workbook loaded again never duplicates), open premium bills become open items, open
 * claims are registered with their legacy claim number, and the trial balance of the day before the cutover date
 * becomes the GL opening balances. Migrated records carry source 'go-live-migration' (clients, policy doc.source,
 * claim details.source; open items: receivable source 'opening') and the load batch id. Nothing posts a journal, a
 * bill booking or a commission accrual: the opening balances carry the money.
 */
import { many, one, query } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { issuePolicy, derivedPremiumTaxes } from '../policies/service.js';
import { lobOf } from '../documents/common.js';
import { OPEN_ITEM_COLUMNS, OPENING_SOURCE, loadOpenItem } from '../receipts/opening.js';
import { GO_LIVE_PREFIX, OPENING_BALANCE_COLUMNS, importOpeningBalances } from '../period-end/opening.js';
import { seriesShape, sequenceOf } from './numbering.js';
import { MIGRATION_SOURCE, amountValue, beforeCutover, cell, dateValue, fail, isDate, keyText, numberCell } from './common.js';

/** Refuse a legacy number that the numbering series of the same kind would issue again to a new record. */
async function assertNoSeriesClash(code, number, column) {
  const shape = await seriesShape(code);
  const seq = sequenceOf(shape, number);
  if (seq !== null && seq >= shape.next) {
    fail(column, `${number} has the format of the ${code} numbering series, whose next number is ${shape.next}: a new record would get the same number. Set the series' Next Number above ${seq} (Numbering sheet of the configuration workbook) first`);
  }
}

const userIdOf = async (column, username) => {
  if (!username) return null;
  const u = await one('SELECT id FROM users WHERE lower(username) = lower($1) AND status <> \'deleted\'', [username]);
  if (!u) fail(column, `User ${username} was not found`);
  return u.id;
};

// ------------------------------------------------------------------ clients

const CLIENT_COLUMNS = [
  { key: 'clientCode', header: 'Client Code', required: true, format: 'Client number in the old system; kept as the BrokerVerse client code' },
  { key: 'clientType', header: 'Client Type', required: true, list: 'Client Type', format: 'individual or corporate' },
  { key: 'firstName', header: 'First Name', format: 'Individual: required' },
  { key: 'lastName', header: 'Last Name', format: 'Individual: required' },
  { key: 'companyName', header: 'Company Name', format: 'Corporate: required' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'tin', header: 'TIN', format: 'Tax identification number, e.g. 123-456-789-000' },
  { key: 'birthDate', header: 'Birth Date', type: 'date', format: 'Date YYYY-MM-DD (individual)' },
  { key: 'gender', header: 'Gender' },
  { key: 'address', header: 'Address', format: 'Street address' },
  { key: 'city', header: 'City' },
  { key: 'province', header: 'Province' },
  { key: 'country', header: 'Country', format: 'Philippines when empty' },
  { key: 'postalCode', header: 'Postal Code' },
];

const clientsSheet = () => ({
  key: 'clients', name: 'Clients', menu: 'Operations > Clients', columns: CLIENT_COLUMNS, keyColumns: ['clientCode'], keyOf: (v) => keyText(v.clientCode),
  sample: { clientCode: 'C-000123', clientType: 'individual', firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.ph', phone: '09171234567', tin: '123-456-789-000',
    birthDate: '1988-04-12', address: '12 Mabini St., San Antonio', city: 'Pasig City', province: 'Metro Manila', country: 'Philippines', postalCode: '1600' },
  async exportRows() {
    const rows = await many('SELECT * FROM clients WHERE source = $1 ORDER BY client_code', [MIGRATION_SOURCE]);
    return rows.map((c) => ({ clientCode: c.client_code, clientType: c.client_type, firstName: cell(c.first_name), lastName: cell(c.last_name), companyName: cell(c.company_name),
      email: cell(c.email), phone: cell(c.phone), tin: cell(c.tin), birthDate: cell(c.birth_date), gender: cell(c.gender), address: cell(c.address), city: cell(c.city),
      province: cell(c.state), country: cell(c.country), postalCode: cell(c.postal_code) }));
  },
  check(ctx, v) {
    if (v.birthDate) beforeCutover(ctx, 'birthDate', v.birthDate, 'Birth Date');
  },
  async importRow(ctx, v) {
    const type = String(v.clientType || '').toLowerCase();
    if (!['individual', 'corporate'].includes(type)) fail('clientType', 'Client Type must be individual or corporate');
    if (type === 'individual' && !(v.firstName && v.lastName)) fail(v.firstName ? 'lastName' : 'firstName', 'An individual client needs a First Name and a Last Name');
    if (type === 'corporate' && !v.companyName) fail('companyName', 'A corporate client needs a Company Name');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) fail('email', 'Email must be a valid e-mail address');
    const displayName = type === 'corporate' ? v.companyName : `${v.firstName} ${v.lastName}`;
    const before = await one('SELECT id, source FROM clients WHERE client_code = $1', [v.clientCode]);
    if (before && before.source !== MIGRATION_SOURCE) fail('clientCode', `Client code ${v.clientCode} belongs to a client created in BrokerVerse; give the legacy client another code`);
    const values = [type, v.firstName || null, v.lastName || null, v.companyName || null, displayName, v.email || null, v.phone || null, v.tin || null, v.birthDate || null,
      v.gender || null, v.address || null, v.city || null, v.province || null, v.country || 'Philippines', v.postalCode || null, type === 'corporate' ? 'Corporate' : 'Retail'];
    if (before) {
      await query(`UPDATE clients SET client_type = $2, first_name = $3, last_name = $4, company_name = $5, display_name = $6, email = $7, phone = $8, tin = $9,
          birth_date = $10, gender = $11, address = $12, city = $13, state = $14, country = $15, postal_code = $16, lead_category = $17, updated_by = $18, updated_at = now()
        WHERE id = $1`, [before.id, ...values, ctx.user.id]);
      return 'updated';
    }
    await assertNoSeriesClash('client', v.clientCode, 'clientCode');
    await query(`INSERT INTO clients(client_code, client_type, first_name, last_name, company_name, display_name, email, phone, tin, birth_date, gender, address, city, state,
        country, postal_code, lead_category, source, created_by, owner_user_id, load_batch_id, extra)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20,$21)`,
    [v.clientCode, ...values, MIGRATION_SOURCE, ctx.user.id, ctx.batchId, JSON.stringify({ loadBatchId: ctx.batchId, migratedAt: ctx.cutover })]);
    return 'created';
  },
});

// ------------------------------------------------------------------ in-force policies

const POLICY_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', required: true, format: 'Policy number in the old system (insurer policy number); kept' },
  { key: 'clientCode', header: 'Client Code', required: true, format: 'Client Code of the Clients sheet (or of a client already migrated)' },
  { key: 'insurer', header: 'Insurer', required: true, list: 'Insurers', format: 'Insurer code (or name) of the Insurance Company master' },
  { key: 'product', header: 'Product', required: true, list: 'Products', format: 'Product code (or name) of the Product master, e.g. MOTOR, FIRE' },
  { key: 'insuredName', header: 'Insured Name', format: 'The client name when empty' },
  { key: 'inceptionDate', header: 'Inception Date', required: true, type: 'date', format: 'Date YYYY-MM-DD' },
  { key: 'expiryDate', header: 'Expiry Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, on or after the cutover date (in force)' },
  { key: 'issueDate', header: 'Issue Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, before the cutover date' },
  { key: 'sumInsured', header: 'Sum Insured', type: 'number', format: 'Amount in PHP' },
  { key: 'netPremium', header: 'Net Premium', type: 'number', format: 'Amount in PHP; the gross premium when empty' },
  { key: 'grossPremium', header: 'Gross Premium', required: true, type: 'number', format: 'Amount in PHP including taxes, greater than zero' },
  { key: 'commissionRate', header: 'Commission Rate', type: 'number', format: 'Decimal fraction (0.20 for 20%); the insurer default when empty' },
  { key: 'billingMode', header: 'Billing Mode', list: 'Billing Mode', format: 'broker or direct; the insurer default when empty' },
  { key: 'paymentStatus', header: 'Payment Status', list: 'Payment Status', format: 'Completed when empty; Pending or Partial when an open item is loaded' },
  { key: 'plateNumber', header: 'Plate Number', format: 'Motor only' },
  { key: 'accountExecutive', header: 'Account Executive', format: 'Username of the account executive who owns the policy (renewal follow-up)' },
];

async function policyExport(where, params) {
  const rows = await many(`SELECT p.*, c.client_code, ic.code AS insurer_code, pr.code AS product_code, u.username AS owner_username
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN users u ON u.id = p.owner_user_id WHERE ${where} ORDER BY p.policy_number`, params);
  return rows.map((p) => ({
    policyNumber: p.policy_number, clientCode: cell(p.client_code), insurer: cell(p.insurer_code), product: cell(p.product_code), insuredName: cell(p.insured_name),
    inceptionDate: cell(p.inception_date), expiryDate: cell(p.expiry_date), issueDate: cell(p.issued_date), sumInsured: String(Number(p.sum_insured)), netPremium: String(Number(p.net_premium)),
    grossPremium: String(Number(p.premium_total)), commissionRate: p.doc?.commissionRate === undefined || p.doc?.commissionRate === null ? '' : String(p.doc.commissionRate),
    billingMode: p.billing_mode, paymentStatus: p.payment_status, plateNumber: cell(p.doc?.plateNumber), accountExecutive: cell(p.owner_username),
  }));
}

const policiesSheet = () => ({
  key: 'policies', name: 'Policies', menu: 'Operations > Policy', columns: POLICY_COLUMNS, keyColumns: ['policyNumber'], keyOf: (v) => keyText(v.policyNumber),
  sample: { policyNumber: 'PC-MLY-2026-000101', clientCode: 'C-000123', insurer: 'MALAYAN', product: 'MOTOR', inceptionDate: '2026-03-01', expiryDate: '2027-03-01', issueDate: '2026-02-25',
    sumInsured: '1250000', netPremium: '28750', grossPremium: '35946.88', billingMode: 'broker', paymentStatus: 'Completed', plateNumber: 'NCA 4521', accountExecutive: '' },
  exportRows: () => policyExport("p.doc->>'source' = $1", [MIGRATION_SOURCE]),
  check(ctx, v) {
    beforeCutover(ctx, 'issueDate', v.issueDate, 'Issue Date');
    const inception = dateValue('inceptionDate', v.inceptionDate, 'Inception Date');
    const expiry = dateValue('expiryDate', v.expiryDate, 'Expiry Date');
    if (inception && expiry && expiry <= inception) fail('expiryDate', 'Expiry Date must be after the Inception Date');
    if (expiry && ctx.cutover && expiry < ctx.cutover) fail('expiryDate', `Expiry Date ${expiry} is before the cutover date ${ctx.cutover}: the policy is not in force (expired business stays in the old system)`);
  },
  async importRow(ctx, v) {
    const existing = await one('SELECT id, doc FROM policies WHERE policy_number = $1', [v.policyNumber]);
    if (existing) {
      fail('policyNumber', existing.doc?.source === MIGRATION_SOURCE
        ? `Policy ${v.policyNumber} was already migrated with other values; correct it on the policy screen (Operations > Policy)`
        : `Policy number ${v.policyNumber} already belongs to a policy issued in BrokerVerse`);
    }
    const client = await one('SELECT id, display_name FROM clients WHERE client_code = $1', [v.clientCode]);
    if (!client) fail('clientCode', `Client ${v.clientCode} is not in the Clients sheet or in BrokerVerse`);
    const insurer = await one('SELECT id, commission_rate FROM insurance_companies WHERE (lower(code) = lower($1) OR lower(name) = lower($1) OR lower(short_name) = lower($1)) AND status <> \'deleted\' ORDER BY id LIMIT 1', [v.insurer]);
    if (!insurer) fail('insurer', `Insurer ${v.insurer} is not in the Insurance Company master`);
    const product = await one('SELECT id, code, name, line FROM products WHERE (lower(code) = lower($1) OR lower(name) = lower($1)) AND status <> \'deleted\' ORDER BY id LIMIT 1', [v.product]);
    if (!product) fail('product', `Product ${v.product} is not in the Product master`);
    const gross = amountValue('grossPremium', v.grossPremium, 'Gross Premium', { positive: true });
    const net = amountValue('netPremium', v.netPremium, 'Net Premium') ?? gross;
    if (net > gross) fail('netPremium', 'Net Premium cannot be more than the Gross Premium');
    const sumInsured = amountValue('sumInsured', v.sumInsured, 'Sum Insured') ?? 0;
    let rate = numberCell(v.commissionRate);
    if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 1)) fail('commissionRate', 'Commission Rate must be a fraction from 0 to 1');
    if (rate === null) rate = Number(insurer.commission_rate || 0) || Number(await getSetting('commission.default_rate', 0.15));
    const billingMode = v.billingMode ? String(v.billingMode).toLowerCase() : null;
    if (billingMode && !['broker', 'direct'].includes(billingMode)) fail('billingMode', 'Billing Mode must be broker or direct');
    const allowed = await getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded']);
    const paymentStatus = v.paymentStatus ? allowed.find((x) => x.toLowerCase() === String(v.paymentStatus).toLowerCase()) : 'Completed';
    if (!paymentStatus) fail('paymentStatus', `Payment Status must be one of ${allowed.join(', ')}`);
    const owner = await userIdOf('accountExecutive', v.accountExecutive);
    await assertNoSeriesClash('policy', v.policyNumber, 'policyNumber');
    const lob = lobOf(product.line === 'fire' && /industrial/i.test(product.name) ? 'IAR' : product.line || product.code);
    const taxes = await derivedPremiumTaxes({ lob, productId: product.id, netPremium: net, grossPremium: gross });
    const r = await issuePolicy({ query }, {
      clientId: client.id, productId: product.id, insuranceCompanyId: insurer.id, sumInsured, netPremium: net, grossPremium: gross,
      commissionAmount: round2(net * rate), commissionRate: rate, currency: await baseCurrency(), insuredName: v.insuredName || client.display_name,
      productType: product.name, lob, ownerUserId: owner || ctx.user.id, agentUserId: owner || ctx.user.id, migration: true,
      doc: { plateNumber: v.plateNumber || undefined, source: MIGRATION_SOURCE, loadBatchId: ctx.batchId, commissionRate: rate, ...(taxes || {}) },
    }, { policyNumber: v.policyNumber, inception: v.inceptionDate, expiry: v.expiryDate, issuedDate: v.issueDate, paymentStatus, billingMode }, ctx.user.id);
    await query('UPDATE policies SET load_batch_id = $2 WHERE id = $1', [r.policyId, ctx.batchId]);
    return 'created';
  },
  totals: (rows) => ({ grossPremium: sum(rows, 'grossPremium'), netPremium: sum(rows, 'netPremium', 'grossPremium'), sumInsured: sum(rows, 'sumInsured') }),
});

// ------------------------------------------------------------------ open premium receivables

const OPEN_LABEL = { policyNumber: 'Policy Number', billReference: 'Bill Reference', dueDate: 'Due Date', originalAmount: 'Original Amount', openBalance: 'Open Balance' };
const openItemsSheet = () => ({
  key: 'open-items', name: 'Open Items', menu: 'Accounts > Collections',
  columns: OPEN_ITEM_COLUMNS.map((c) => ({ key: c.key, header: c.header, required: c.required === true, format: c.format, aliases: c.aliases,
    ...(['dueDate'].includes(c.key) ? { type: 'date' } : {}), ...(['originalAmount', 'openBalance'].includes(c.key) ? { type: 'number' } : {}) })),
  keyColumns: ['policyNumber', 'billReference'], keyOf: (v) => keyText(v.policyNumber, v.billReference),
  sample: { policyNumber: 'PC-MLY-2026-000101', billReference: 'DN-2026-08812', dueDate: '2026-11-30', originalAmount: '35946.88', openBalance: '20000' },
  async exportRows(ctx) {
    if (!ctx.cutover) return [];
    const rows = await many(`SELECT r.*, p.policy_number FROM receivables r JOIN policies p ON p.id = r.policy_id WHERE r.source = $1 AND r.go_live_date = $2::date
      ORDER BY p.policy_number, r.reference`, [OPENING_SOURCE, ctx.cutover]);
    return rows.map((r) => ({ policyNumber: r.policy_number, billReference: cell(r.reference), dueDate: cell(r.due_date), originalAmount: String(Number(r.amount)), openBalance: String(Number(r.balance)) }));
  },
  async importRow(ctx, v) {
    if (v.dueDate && !isDate(v.dueDate)) fail('dueDate', 'Due Date must be a date YYYY-MM-DD');
    const balance = amountValue('openBalance', v.openBalance, 'Open Balance', { positive: true });
    const amount = amountValue('originalAmount', v.originalAmount, 'Original Amount');
    if (amount !== null && amount < balance) fail('originalAmount', 'Original Amount cannot be less than the Open Balance');
    let r;
    try {
      r = await loadOpenItem({ query }, v, { goLiveDate: ctx.cutover, user: ctx.user });
    } catch (e) {
      const col = Object.entries(OPEN_LABEL).find(([, label]) => String(e.message).startsWith(label) || String(e.message).includes(` ${label}`))?.[0]
        || (/Policy|policy/.test(e.message) ? 'policyNumber' : null);
      if (col && !e.details?.length) fail(col, e.message);
      throw e;
    }
    if (r.status === 'skipped') return 'unchanged';
    await query('UPDATE receivables SET load_batch_id = $2 WHERE bill_number = $1', [r.billNumber, ctx.batchId]);
    return 'created';
  },
  totals: (rows) => ({ originalAmount: sum(rows, 'originalAmount', 'openBalance'), openBalance: sum(rows, 'openBalance') }),
});

// ------------------------------------------------------------------ open claims

const CLAIM_STATUSES = ['registered', 'in-review'];
const claimsSheet = () => ({
  key: 'claims', name: 'Open Claims', menu: 'Operations > Claims',
  columns: [
    { key: 'claimNumber', header: 'Claim Number', required: true, format: 'Claim number in the old system; kept' },
    { key: 'policyNumber', header: 'Policy Number', required: true, format: 'Policy of the Policies sheet or already in BrokerVerse' },
    { key: 'lossDate', header: 'Loss Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, before the cutover date' },
    { key: 'reportedDate', header: 'Reported Date', type: 'date', format: 'Date YYYY-MM-DD, before the cutover date; the loss date when empty' },
    { key: 'status', header: 'Status', list: 'Claim Status', format: 'registered or in-review (registered when empty)' },
    { key: 'lossType', header: 'Loss Type', format: 'e.g. Collision, Fire, Theft' },
    { key: 'description', header: 'Description' },
    { key: 'estimateAmount', header: 'Outstanding Estimate', required: true, type: 'number', format: 'Amount claimed / reserve still open in PHP' },
    { key: 'insurerClaimNumber', header: 'Insurer Claim Number' },
    { key: 'handler', header: 'Handler', format: 'Username of the claims handler' },
  ],
  keyColumns: ['claimNumber'], keyOf: (v) => keyText(v.claimNumber),
  sample: { claimNumber: 'OLD-CLM-2026-0042', policyNumber: 'PC-MLY-2026-000101', lossDate: '2026-09-12', reportedDate: '2026-09-13', status: 'in-review', lossType: 'Collision',
    description: 'Rear-end collision on EDSA', estimateAmount: '85000', insurerClaimNumber: 'MLY-CL-77812' },
  async exportRows() {
    const rows = await many(`SELECT c.*, p.policy_number, u.username AS handler_username FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN users u ON u.id = c.handler_user_id
      WHERE c.details->>'source' = $1 ORDER BY c.claim_number`, [MIGRATION_SOURCE]);
    return rows.map((c) => ({ claimNumber: c.claim_number, policyNumber: c.policy_number, lossDate: cell(c.loss_date), reportedDate: cell(c.reported_date), status: c.status,
      lossType: cell(c.loss_type), description: cell(c.description), estimateAmount: String(Number(c.estimate_amount)), insurerClaimNumber: cell(c.insurer_claim_number), handler: cell(c.handler_username) }));
  },
  check(ctx, v) {
    beforeCutover(ctx, 'lossDate', v.lossDate, 'Loss Date');
    beforeCutover(ctx, 'reportedDate', v.reportedDate, 'Reported Date');
    if (v.reportedDate && v.lossDate && v.reportedDate < v.lossDate) fail('reportedDate', 'Reported Date cannot be before the Loss Date');
  },
  async importRow(ctx, v) {
    const status = (v.status || 'registered').toLowerCase();
    if (!CLAIM_STATUSES.includes(status)) fail('status', `Status must be ${CLAIM_STATUSES.join(' or ')}: settled and closed claims stay in the old system`);
    const existing = await one('SELECT id, details FROM claims WHERE claim_number = $1', [v.claimNumber]);
    if (existing) {
      fail('claimNumber', existing.details?.source === MIGRATION_SOURCE ? `Claim ${v.claimNumber} was already migrated with other values; correct it on the claim screen`
        : `Claim number ${v.claimNumber} already belongs to a claim registered in BrokerVerse`);
    }
    const policy = await one('SELECT id, client_id, lob, inception_date, expiry_date FROM policies WHERE policy_number = $1', [v.policyNumber]);
    if (!policy) fail('policyNumber', `Policy ${v.policyNumber} is not in the Policies sheet or in BrokerVerse`);
    if (v.lossDate < String(policy.inception_date) || v.lossDate > String(policy.expiry_date)) {
      fail('lossDate', `Loss Date ${v.lossDate} is outside the policy period ${policy.inception_date} to ${policy.expiry_date}`);
    }
    const estimate = amountValue('estimateAmount', v.estimateAmount, 'Outstanding Estimate');
    const handler = await userIdOf('handler', v.handler);
    await assertNoSeriesClash('claim', v.claimNumber, 'claimNumber');
    const reported = v.reportedDate || v.lossDate;
    const lob = String(policy.lob || 'MOTOR').toUpperCase();
    const sla = Number(await getSetting('claims.sla_days', 20));
    const claim = await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description, estimate_amount, handler_user_id,
        lob, claim_type, priority, insurer_claim_number, due_date, details, created_by, load_batch_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,($6::date + $15::int),$16,$17,$18) RETURNING id`,
    [v.claimNumber, policy.id, policy.client_id, status, v.lossDate, reported, v.lossType || null, v.description || null, estimate ?? 0, handler, lob,
      lob.charAt(0) + lob.slice(1).toLowerCase(), await getSetting('claims.default_priority', 'Medium'), v.insurerClaimNumber || null, sla,
      JSON.stringify({ source: MIGRATION_SOURCE, loadBatchId: ctx.batchId }), ctx.user.username, ctx.batchId]);
    await query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)',
      [claim.id, ctx.user.username, status, `Open claim migrated from the old system (cutover ${ctx.cutover})`]);
    return 'created';
  },
  totals: (rows) => ({ estimateAmount: sum(rows, 'estimateAmount') }),
});

// ------------------------------------------------------------------ GL opening balances

const openingBalancesSheet = () => ({
  key: 'opening-balances', name: 'Opening Balances', menu: 'Accounts > Period End > Period Management (opening balances)',
  columns: OPENING_BALANCE_COLUMNS.map((c) => ({ key: c.key, header: c.header, required: c.required === true, format: c.format, aliases: c.aliases,
    ...(['debit', 'credit'].includes(c.key) ? { type: 'number' } : {}) })),
  keyColumns: ['accountCode'], keyOf: (v) => keyText(v.accountCode),
  sample: { accountCode: '1102001', accountName: 'Cash in Bank – Operating Account', debit: '1250000.00' },
  async exportRows(ctx) {
    if (!ctx.cutover) return [];
    const rows = await many(`SELECT o.account_code, a.name, o.balance FROM opening_balances o JOIN gl_accounts a ON a.code = o.account_code WHERE o.source_run = $1 ORDER BY o.account_code`,
      [`${GO_LIVE_PREFIX}${ctx.cutover}`]);
    return rows.map((r) => ({ accountCode: r.account_code, accountName: r.name, debit: Number(r.balance) > 0 ? String(Number(r.balance)) : '', credit: Number(r.balance) < 0 ? String(-Number(r.balance)) : '' }));
  },
  /** All or nothing, like the opening balance import: [{ action } | { errors }] per row. */
  async importSheet(ctx, rows) {
    const existing = new Map((await many('SELECT account_code, balance FROM opening_balances WHERE source_run = $1', [`${GO_LIVE_PREFIX}${ctx.cutover}`]))
      .map((r) => [r.account_code, round2(Number(r.balance))]));
    const amount = (x) => numberCell(x) || 0;
    const same = existing.size === rows.length && rows.every((r) => existing.get(String(r.values.accountCode).trim()) === round2(amount(r.values.debit) - amount(r.values.credit)));
    if (same) return rows.map(() => ({ action: 'unchanged' }));
    try {
      await importOpeningBalances({ query }, rows.map((r) => r.values), { goLiveDate: ctx.cutover });
    } catch (e) {
      const byRow = new Map();
      for (const d of e.details || []) {
        const m = /^row (\d+)$/.exec(d.path || '');
        if (!m) continue;
        const i = Number(m[1]) - 2;
        const message = String(d.message).replace(/^Row \d+: /, '');
        const column = /Debit|Credit|amount/.test(message) ? 'debit' : 'accountCode';
        byRow.set(i, [...(byRow.get(i) || []), { column, message }]);
      }
      if (!byRow.size) return rows.map(() => ({ errors: [{ column: null, message: e.message }] }));
      return rows.map((_, i) => (byRow.has(i) ? { errors: byRow.get(i) } : { errors: [{ column: null, message: 'Not loaded: the opening balances load all or nothing; fix the other rows' }] }));
    }
    return rows.map((r) => ({ action: existing.has(String(r.values.accountCode).trim()) ? 'updated' : 'created' }));
  },
  totals: (rows) => ({ debit: sum(rows, 'debit'), credit: sum(rows, 'credit') }),
});

function sum(rows, key, fallback = null) {
  return round2(rows.reduce((s, r) => s + (numberCell(r[key]) ?? (fallback ? numberCell(r[fallback]) ?? 0 : 0)), 0));
}

/** Sheets of the migration kit, in load order. */
export function migrationSheets() {
  return [clientsSheet(), policiesSheet(), openItemsSheet(), claimsSheet(), openingBalancesSheet()];
}

/**
 * Reconciliation summary of a migration load (inside the load transaction): control totals of the workbook and of
 * BrokerVerse after the load, and the checks the broker compares with the old system: trial balance debits = credits
 * and premiums receivable control account = open items.
 */
export async function reconciliation(ctx, rowsBySheet) {
  const cutover = ctx.cutover;
  const sheets = migrationSheets();
  const wb = Object.fromEntries(sheets.map((s) => [s.key, (rowsBySheet[s.key] || []).filter((r) => r.status !== 'error').map((r) => r.values)]));
  const clients = await one(`SELECT count(*)::int AS n, count(*) FILTER (WHERE client_type = 'corporate')::int AS corporate FROM clients WHERE source = $1`, [MIGRATION_SOURCE]);
  const policies = await one(`SELECT count(*)::int AS n, COALESCE(sum(premium_total), 0) AS gross, COALESCE(sum(net_premium), 0) AS net, COALESCE(sum(sum_insured), 0) AS si,
      count(*) FILTER (WHERE expiry_date < $2::date + 90)::int AS expiring
    FROM policies WHERE doc->>'source' = $1`, [MIGRATION_SOURCE, cutover]);
  const items = await one(`SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS amount, COALESCE(sum(balance), 0) AS balance FROM receivables WHERE source = $1 AND go_live_date = $2::date`,
    [OPENING_SOURCE, cutover]);
  const claims = await one(`SELECT count(*)::int AS n, COALESCE(sum(estimate_amount), 0) AS estimate FROM claims WHERE details->>'source' = $1`, [MIGRATION_SOURCE]);
  const tb = await one(`SELECT count(*)::int AS n, COALESCE(sum(balance) FILTER (WHERE balance > 0), 0) AS debit, COALESCE(-sum(balance) FILTER (WHERE balance < 0), 0) AS credit
    FROM opening_balances WHERE source_run = $1`, [`${GO_LIVE_PREFIX}${cutover}`]);
  const control = String(await getSetting('accounting.account.premium_receivable', '1202001'));
  const ob = await one('SELECT COALESCE(sum(balance), 0) AS b FROM opening_balances WHERE source_run = $1 AND account_code = $2', [`${GO_LIVE_PREFIX}${cutover}`, control]);
  const n = (x) => round2(Number(x || 0));
  const totals = Object.fromEntries(sheets.map((s) => [s.key, s.totals ? s.totals(wb[s.key]) : {}]));
  const asAt = isDate(cutover) ? new Date(Date.parse(`${cutover}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : null;
  const check = (name, left, right) => ({ check: name, left: n(left), right: n(right), difference: n(n(left) - n(right)), ok: Math.abs(n(left) - n(right)) < 0.005 });
  return {
    cutoverDate: cutover, openingBalanceDate: asAt,
    sheets: [
      { sheet: 'Clients', workbookRows: wb.clients.length, inBrokerVerse: clients.n, detail: { corporate: clients.corporate, individual: clients.n - clients.corporate } },
      { sheet: 'Policies', workbookRows: wb.policies.length, workbook: totals.policies, inBrokerVerse: policies.n,
        detail: { grossPremium: n(policies.gross), netPremium: n(policies.net), sumInsured: n(policies.si), expiringWithin90Days: policies.expiring } },
      { sheet: 'Open Items', workbookRows: wb['open-items'].length, workbook: totals['open-items'], inBrokerVerse: items.n, detail: { originalAmount: n(items.amount), openBalance: n(items.balance) } },
      { sheet: 'Open Claims', workbookRows: wb.claims.length, workbook: totals.claims, inBrokerVerse: claims.n, detail: { estimateAmount: n(claims.estimate) } },
      { sheet: 'Opening Balances', workbookRows: wb['opening-balances'].length, workbook: totals['opening-balances'], inBrokerVerse: tb.n, detail: { debit: n(tb.debit), credit: n(tb.credit) } },
    ],
    checks: [
      check('Trial balance: total debits = total credits', tb.debit, tb.credit),
      check(`Premiums receivable control account ${control} opening balance = open items total`, ob.b, items.balance),
    ],
  };
}

/** Business the migration kit does not carry, and where it goes (Instructions sheet). */
export const MIGRATION_ON_SCREEN = [
  ['Premium due to insurers on bills of the old system; commission due to referrers and agents', 'Part of the GL opening balances (Due to Insurers, Commission Payable); paid with payment vouchers: Accounts > Disbursement'],
  ['Commission receivable from insurers on direct-bill business', 'Part of the opening balance of Commission Receivable - Insurers; cleared with a journal voucher when the insurer pays (Accounts > Journal Voucher)'],
  ['Co-insured in-force policies (several insurers)', 'The workbook loads the policy with its insurer at 100%: add the participants on Operations > Policy'],
  ['Expired, cancelled and lapsed policies; settled and closed claims; paid bills; journals before the cutover', 'Not migrated: they stay in the old system (read only)'],
  ['Leads and quotations in progress', 'Operations > Sales & Marketing > Prospects / Quotations > Bulk Upload'],
  ['Unreconciled bank items', 'Stay on the old bank reconciliation; BrokerVerse reconciles from the reconcile-from date of each bank account'],
  ['Documents and images of the old system', 'Attach on the policy or claim screen when needed'],
];

