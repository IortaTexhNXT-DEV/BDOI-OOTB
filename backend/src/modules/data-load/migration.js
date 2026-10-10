/**
 * Migration kit: the open business of the old system at cutover. Clients and in-force policies keep their legacy
 * numbers (the natural keys, so a workbook loaded again never duplicates), open premium bills become open items, cheques
 * on hand become post-dated cheques against them, open claims are registered with their legacy claim number, and the
 * trial balance of the day before the cutover date becomes the GL opening balances. Migrated records carry origin
 * 'migrated' with the legacy system, the legacy number, when and by whom they were migrated and the load
 * (lib/origin.js); the older flags (source 'go-live-migration' on clients, policy doc.source, claim details.source,
 * receivable source 'opening') are still written for the readers of them. Each record created or changed gets its own
 * audit entry (migrate-create / migrate-update) with its values before and after and the load number, written in the
 * load transaction (ctx.record). Nothing posts a journal, a bill booking or a commission accrual: the opening balances
 * carry the money.
 *
 * Policies are loaded from one sheet per kind of product (products.js); the single Policies sheet of the earlier layout
 * is still read (any product, a warning that the layout is old). Legacy values are translated through the value maps
 * (maps.js) before the master lookups. Amounts are pesos with at most two decimals. A migrated CTPL policy also writes
 * its CTPL authentication (authenticated, manual, not sent to the LTO), so its COC number can never be issued again.
 */
import { many, one, query } from '../../db/pool.js';
import { baseCurrency } from '../../lib/currency.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { addDays } from '../../lib/dates.js';
import { issuePolicy, derivedPremiumTaxes } from '../policies/service.js';
import { writeParticipants } from '../placement/participants.js';
import { lobOf } from '../documents/common.js';
import { OPEN_ITEM_COLUMNS, OPENING_SOURCE, loadOpenItem } from '../receipts/opening.js';
import { registerPdc } from '../pdc/service.js';
import { GO_LIVE_PREFIX, OPENING_BALANCE_COLUMNS, importOpeningBalances, zeroBalanceRow } from '../period-end/opening.js';
import { cocClash, seriesClash, seriesShapes } from './numbering.js';
import { resolveValue } from './maps.js';
import { BUSINESS_TYPES, COMMON_COLUMNS, POLICY_KINDS, POLICY_SAMPLES, currencyDoc, policyColumns, policyKindOf, presentKinds, productColumns, productDoc, sheetKindOf } from './products.js';
import { MIGRATION_SOURCE, amountValue, beforeCutover, cell, centavos, dateValue, fail, isDate, keyText, numberCell, pesoSum, pesoValue } from './common.js';
import { MIGRATED } from '../../lib/origin.js';
import { regionOf } from '../../lib/address.js';
import { revealPii } from '../../lib/pii.js';

/**
 * Refuse a legacy number that the numbering series of the same kind would issue again to a new record, in any period
 * and form of the go-live window (numbering.js). The forms are read once per series and load.
 */
async function assertNoSeriesClash(ctx, code, number, column) {
  ctx.seriesShapes ||= {};
  ctx.seriesShapes[code] ||= await seriesShapes(code);
  const clash = await seriesClash(code, number, ctx.seriesShapes[code]);
  if (clash) {
    const period = clash.shape.periods.length === 1 ? ` in period ${clash.shape.periods[0]}` : '';
    fail(column, `${number} has the format of the ${code} numbering series, whose next number${period} is ${clash.shape.next}: a new record would get the same number. Set the series' Next Number above ${clash.seq} (Numbering sheet of the configuration workbook) first`);
  }
}

const userIdOf = async (ctx, column, username) => {
  if (!username) return null;
  const name = resolveValue(ctx, 'user', username);
  const u = await one('SELECT id FROM users WHERE lower(username) = lower($1) AND status <> \'deleted\'', [name]);
  if (!u) fail(column, `User ${username} was not found`);
  return u.id;
};

/** Insurer of a cell value (through the value maps): code, name or short name; null when none. Cached per load. */
async function insurerOf(ctx, value) {
  if (!value) return null;
  const name = resolveValue(ctx, 'insurer', value);
  ctx.insurers ||= new Map();
  const k = String(name).trim().toLowerCase();
  if (!ctx.insurers.has(k)) {
    ctx.insurers.set(k, await one(`SELECT id, code, name, commission_rate FROM insurance_companies
      WHERE (lower(code) = $1 OR lower(name) = $1 OR lower(short_name) = $1) AND status <> 'deleted' ORDER BY id LIMIT 1`, [k]) || null);
  }
  return ctx.insurers.get(k);
}

/** Records that hang on a migrated record and stop a load from changing it: [label]. */
async function dependentsOf(sql, id) {
  return (await many(sql, [id])).filter((r) => r.n > 0).map((r) => r.label);
}
const POLICY_DEPENDENTS = `SELECT 'receipts' AS label, count(*)::int AS n FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id WHERE r.policy_id = $1
  UNION ALL SELECT 'bills issued in BrokerVerse', count(*)::int FROM receivables WHERE policy_id = $1 AND origin = 'issued'
  UNION ALL SELECT 'endorsements', count(*)::int FROM endorsements WHERE policy_id = $1
  UNION ALL SELECT 'claims registered in BrokerVerse', count(*)::int FROM claims WHERE policy_id = $1 AND origin = 'issued'
  UNION ALL SELECT 'renewals', count(*)::int FROM renewals WHERE policy_id = $1
  UNION ALL SELECT 'renewal issued', count(*)::int FROM policies WHERE renewed_from = $1
  UNION ALL SELECT 'post-dated cheques deposited', count(*)::int FROM post_dated_cheques WHERE policy_id = $1 AND status NOT IN ('on-hand', 'cancelled')
  UNION ALL SELECT 'CTPL authentication sent to the LTO', count(*)::int FROM ctpl_authentications WHERE policy_id = $1 AND lto_status IN ('queued', 'sent')`;
const CLAIM_DEPENDENTS = `SELECT 'claim history' AS label, GREATEST(count(*)::int - 1, 0) AS n FROM claim_history WHERE claim_id = $1
  UNION ALL SELECT 'settlement movements', count(*)::int FROM claim_settlement_movements WHERE claim_id = $1
  UNION ALL SELECT 'letters of authority', count(*)::int FROM claim_loas WHERE claim_id = $1
  UNION ALL SELECT 'documents', count(*)::int FROM claim_document_items WHERE claim_id = $1`;

/** Error of a Changed row on a record that can no longer be changed by a load. */
function changedAfterLoad(column, what, number, batchId, dependents) {
  const load = batchId ? `undo load MIG-${String(batchId).padStart(6, '0')} or ` : '';
  fail(column, `${what} ${number} was changed after it was loaded (${dependents.join(', ')}): ${load}correct it on the ${what.toLowerCase()} screen`);
}

// ------------------------------------------------------------------ clients

const CLIENT_COLUMNS = [
  { key: 'clientCode', header: 'Client Code', required: true, format: 'Client number in the old system; kept as the BrokerVerse client code' },
  { key: 'clientType', header: 'Client Type', required: true, list: 'Client Type', format: 'individual or corporate' },
  { key: 'firstName', header: 'First Name', format: 'Individual: required' },
  { key: 'lastName', header: 'Last Name', format: 'Individual: required' },
  { key: 'companyName', header: 'Company Name', format: 'Corporate: required' },
  { key: 'email', header: 'Email', pii: 'email' },
  { key: 'phone', header: 'Phone', pii: 'phone' },
  { key: 'tin', header: 'TIN', pii: 'identifier', format: 'Tax identification number, e.g. 123-456-789-000' },
  { key: 'birthDate', header: 'Birth Date', type: 'date', pii: 'dob', format: 'Date YYYY-MM-DD (individual)' },
  { key: 'gender', header: 'Gender' },
  { key: 'address', header: 'Address', format: 'House / unit no. and street' },
  { key: 'barangay', header: 'Barangay' },
  { key: 'city', header: 'City / Municipality', aliases: ['City'] },
  { key: 'province', header: 'Province', format: 'Province of the Province master (Metro Manila for NCR)' },
  { key: 'region', header: 'Region', format: 'Filled from the province when empty' },
  { key: 'country', header: 'Country', format: 'Philippines when empty' },
  { key: 'postalCode', header: 'ZIP Code', aliases: ['Postal Code'] },
];

/** A stored client in the column keys of the Clients sheet (current data, audit before / after). */
const clientValues = (c) => ({ clientCode: c.client_code, clientType: c.client_type, firstName: cell(c.first_name), lastName: cell(c.last_name), companyName: cell(c.company_name),
  email: cell(c.email), phone: cell(c.phone), tin: cell(revealPii(c.tin)), birthDate: cell(c.birth_date), gender: cell(c.gender), address: cell(c.address), barangay: cell(c.barangay),
  city: cell(c.city), province: cell(c.state), region: cell(c.region), country: cell(c.country), postalCode: cell(c.postal_code) });

const clientsSheet = () => ({
  key: 'clients', name: 'Clients', menu: 'Operations > Clients', columns: CLIENT_COLUMNS, keyColumns: ['clientCode'], keyOf: (v) => keyText(v.clientCode),
  sample: { clientCode: 'C-000123', clientType: 'individual', firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.ph', phone: '09171234567', tin: '123-456-789-000',
    birthDate: '1988-04-12', address: 'Unit 4B, 12 Mabini St.', barangay: 'San Antonio', city: 'Pasig City', province: 'Metro Manila', region: 'National Capital Region (NCR)', country: 'Philippines', postalCode: '1600' },
  async exportRows() {
    return (await many('SELECT * FROM clients WHERE origin = $1 ORDER BY client_code', [MIGRATED])).map(clientValues);
  },
  check(ctx, v) {
    if (v.birthDate) beforeCutover(ctx, 'birthDate', v.birthDate, 'Birth Date');
  },
  /** "Use existing": the client of BrokerVerse the legacy code is mapped to (value map client). */
  async existingRecord(ctx, code) {
    const c = await one('SELECT id, client_code FROM clients WHERE client_code = $1', [code]);
    return c && { table: 'clients', id: c.id, key: c.client_code };
  },
  async importRow(ctx, v) {
    const type = String(v.clientType || '').toLowerCase();
    if (!['individual', 'corporate'].includes(type)) fail('clientType', 'Client Type must be individual or corporate');
    if (type === 'individual' && !(v.firstName && v.lastName)) fail(v.firstName ? 'lastName' : 'firstName', 'An individual client needs a First Name and a Last Name');
    if (type === 'corporate' && !v.companyName) fail('companyName', 'A corporate client needs a Company Name');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) fail('email', 'Email must be a valid e-mail address');
    const displayName = type === 'corporate' ? v.companyName : `${v.firstName} ${v.lastName}`;
    const before = await one('SELECT * FROM clients WHERE client_code = $1', [v.clientCode]);
    if (before && before.origin !== MIGRATED) fail('clientCode', `Client code ${v.clientCode} belongs to a client created in BrokerVerse; give the legacy client another code`);
    const region = v.region || (v.province ? await regionOf({ province: v.province, city: v.city || null }) : null);
    const values = [type, v.firstName || null, v.lastName || null, v.companyName || null, displayName, v.email || null, v.phone || null, v.tin || null, v.birthDate || null,
      v.gender || null, v.address || null, v.city || null, v.province || null, v.country || 'Philippines', v.postalCode || null, type === 'corporate' ? 'Corporate' : 'Retail',
      v.barangay || null, region];
    if (before) {
      await query(`UPDATE clients SET client_type = $2, first_name = $3, last_name = $4, company_name = $5, display_name = $6, email = $7, phone = $8, tin = $9,
          birth_date = $10, gender = $11, address = $12, city = $13, state = $14, country = $15, postal_code = $16, lead_category = $17, barangay = $18, region = $19,
          updated_by = $20, updated_at = now()
        WHERE id = $1`, [before.id, ...values, ctx.user.id]);
      await ctx.record({ entity: 'client', table: 'clients', id: before.id, key: v.clientCode, action: 'updated', before: clientValues(before),
        after: clientValues(await one('SELECT * FROM clients WHERE id = $1', [before.id])) });
      return 'updated';
    }
    await assertNoSeriesClash(ctx, 'client', v.clientCode, 'clientCode');
    const c = await one(`INSERT INTO clients(client_code, client_type, first_name, last_name, company_name, display_name, email, phone, tin, birth_date, gender, address, city, state,
        country, postal_code, lead_category, barangay, region, source, created_by, owner_user_id, load_batch_id, origin, legacy_system, legacy_number, migrated_at, migrated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21,$22,'migrated',$23,$1,now(),$24) RETURNING *`,
    [v.clientCode, ...values, MIGRATION_SOURCE, ctx.user.id, ctx.batchId, ctx.legacySystem, ctx.migratedBy]);
    await ctx.record({ entity: 'client', table: 'clients', id: c.id, key: v.clientCode, action: 'created', after: clientValues(c) });
    return 'created';
  },
});

// ------------------------------------------------------------------ in-force policies

/** Columns of the single Policies sheet of the earlier layout (still read, any product). */
const LEGACY_POLICY_COLUMNS = [
  ...COMMON_COLUMNS.filter((c) => ['policyNumber', 'clientCode', 'insurer', 'product', 'insuredName', 'inceptionDate', 'expiryDate', 'issueDate', 'sumInsured',
    'netPremium', 'grossPremium', 'commissionRate', 'billingMode', 'paymentStatus'].includes(c.key))
    .map((c) => (c.key === 'product' ? { ...c, list: 'Products', format: 'Product code (or name) of the Product master, e.g. MOTOR, FIRE' } : c)),
  { key: 'plateNumber', header: 'Plate Number', format: 'Motor only' },
  { key: 'accountExecutive', header: 'Account Executive', format: 'Username of the account executive who owns the policy (renewal follow-up)' },
];

const POLICY_EXPORT = `SELECT p.*, c.client_code, ic.code AS insurer_code, pr.code AS product_code, pr.name AS product_name, pr.line AS product_line,
    u.username AS owner_username, ch.code AS channel_code
  FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN users u ON u.id = p.owner_user_id LEFT JOIN distribution_channels ch ON ch.id = p.channel_id`;

const docCell = (doc, key) => cell(doc?.[key]);
/** The number of a policy as in the workbook: the legacy number when the policy carries the insurer suffix. */
const workbookNumber = (p) => (p.legacy_number && p.policy_number === `${p.legacy_number}/${p.insurer_code}` ? p.legacy_number : p.policy_number);

/** A stored policy in the column keys of a policy sheet (kind: its product columns too; null: the earlier layout). */
function policyValues(p, kind) {
  const doc = p.doc || {};
  const out = {
    policyNumber: workbookNumber(p), clientCode: cell(p.client_code), insurer: cell(p.insurer_code), product: cell(p.product_code), insuredName: cell(p.insured_name),
    inceptionDate: cell(p.inception_date), expiryDate: cell(p.expiry_date), issueDate: cell(p.issued_date), sumInsured: String(Number(p.sum_insured)), netPremium: String(Number(p.net_premium)),
    grossPremium: String(Number(p.premium_total)), commissionRate: doc.commissionRate === undefined || doc.commissionRate === null ? '' : String(doc.commissionRate),
    billingMode: p.billing_mode, paymentStatus: p.payment_status, accountExecutive: cell(p.owner_username),
  };
  if (kind === null) return { ...out, plateNumber: docCell(doc, 'plateNumber') };
  Object.assign(out, { branch: docCell(doc, 'branchCode'), distributionChannel: cell(p.channel_code), businessType: docCell(doc, 'legacyBusinessType'),
    previousPolicyNumber: docCell(doc, 'legacyPreviousPolicyNumber'), legacySystem: cell(p.legacy_system), originalCurrency: docCell(doc, 'originalCurrency'),
    originalSumInsured: docCell(doc, 'originalSumInsured'), exchangeRate: docCell(doc, 'exchangeRate') });
  for (const c of productColumns(kind)) out[c.key] = docCell(doc, c.key);
  return out;
}

/** The migrated policies of a kind (null: every migrated policy, earlier layout), in the sheet's column keys. */
async function policyExport(kind, kinds, where = 'p.origin = $1', params = [MIGRATED]) {
  const rows = await many(`${POLICY_EXPORT} WHERE ${where} ORDER BY p.policy_number`, params);
  return rows.filter((p) => kind === null || sheetKindOf({ code: p.product_code, name: p.product_name, line: p.product_line }, kinds) === kind).map((p) => policyValues(p, kind));
}

/** The stored policy a row stands for: the same number, or the migrated policy of the same insurer that keeps it as legacy number. */
const storedPolicy = (number, insurerId) => one(`SELECT p.*, ic.code AS insurer_code FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  WHERE p.policy_number = $1 OR (p.legacy_number = $1 AND p.insurance_company_id = $2 AND p.origin = 'migrated')
  ORDER BY (p.insurance_company_id = $2) DESC NULLS LAST, (p.policy_number = $1) DESC LIMIT 1`, [number, insurerId]);

/** CTPL authentication of a migrated CTPL policy: authenticated manually in the legacy system, never sent to the LTO. */
async function writeCtplAuthentication(ctx, policyId, number, insurer, v, branchCode) {
  const series = await one(`SELECT s.id FROM coc_series s WHERE s.insurance_company_id = $1 AND $2 LIKE COALESCE(s.prefix, '') || '%'
      AND substr($2, length(COALESCE(s.prefix, '')) + 1) ~ '^[0-9]+$' AND substr($2, length(COALESCE(s.prefix, '')) + 1)::numeric BETWEEN s.series_from AND s.series_to
    ORDER BY s.series_from LIMIT 1`, [insurer.id, v.certNumber]);
  const taken = await one("SELECT policy_number FROM ctpl_authentications WHERE insurance_company_id = $1 AND coc_number = $2 AND status <> 'cancelled' AND policy_id <> $3",
    [insurer.id, v.certNumber, policyId]);
  if (taken) fail('certNumber', `COC ${v.certNumber} of ${insurer.code} is the certificate of policy ${taken.policy_number}`);
  await query(`INSERT INTO ctpl_authentications(policy_id, policy_number, insurance_company_id, branch_code, coc_series_id, coc_number, plate_number, mv_file_number, chassis_number,
      engine_number, vehicle_type, ctpl_premium, period_from, period_to, status, method, auth_code, lto_status, authenticated_at, authenticated_by, created_by, updated_by, load_batch_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'authenticated','manual',$15,'not-required',now(),$16,$16,$16,$17)
    ON CONFLICT (policy_id) WHERE status <> 'cancelled' DO UPDATE SET coc_number = EXCLUDED.coc_number, coc_series_id = EXCLUDED.coc_series_id, plate_number = EXCLUDED.plate_number,
      mv_file_number = EXCLUDED.mv_file_number, chassis_number = EXCLUDED.chassis_number, engine_number = EXCLUDED.engine_number, vehicle_type = EXCLUDED.vehicle_type,
      ctpl_premium = EXCLUDED.ctpl_premium, period_from = EXCLUDED.period_from, period_to = EXCLUDED.period_to, auth_code = EXCLUDED.auth_code, updated_by = EXCLUDED.updated_by, updated_at = now()`,
  [policyId, number, insurer.id, branchCode || null, series?.id || null, v.certNumber, v.plateNumber || null, v.mvFileNumber || null, v.chassisNumber || null, v.motorNumber || null,
    v.vehicleType || null, round2(numberCell(v.grossPremium) || 0), v.inceptionDate, v.expiryDate, v.authenCode || null, ctx.user.id, ctx.batchId]);
}

/**
 * The values of a policy row, checked and looked up: { client, insurer, product, kind, number, gross, net, sumInsured,
 * rate, billingMode, paymentStatus, owner, channel, doc }.
 */
async function policyInput(ctx, sheet, v) {
  const clientCode = resolveValue(ctx, 'client', v.clientCode);
  const client = await one('SELECT id, display_name FROM clients WHERE client_code = $1', [clientCode]);
  if (!client) fail('clientCode', `Client ${v.clientCode} is not in the Clients sheet or in BrokerVerse`);
  const insurer = await insurerOf(ctx, v.insurer);
  if (!insurer) fail('insurer', `Insurer ${v.insurer} is not in the Insurance Company master`);
  const productCode = resolveValue(ctx, 'product', v.product);
  const product = await one('SELECT id, code, name, line FROM products WHERE (lower(code) = lower($1) OR lower(name) = lower($1)) AND status <> \'deleted\' ORDER BY id LIMIT 1', [productCode]);
  if (!product) fail('product', `Product ${v.product} is not in the Product master`);
  const kind = sheet.policyKind ? sheetKindOf(product, ctx.presentKinds) : policyKindOf(product);
  if (sheet.policyKind && kind !== sheet.policyKind) {
    fail('product', `Product ${product.code} goes on the sheet ${POLICY_KINDS.find((k) => k.kind === kind)?.name || 'Policies - Other Lines'}`);
  }
  const gross = pesoValue('grossPremium', v.grossPremium, 'Gross Premium', { positive: true });
  const net = pesoValue('netPremium', v.netPremium, 'Net Premium') ?? gross;
  if (net > gross) fail('netPremium', 'Net Premium cannot be more than the Gross Premium');
  const productFields = sheet.policyKind ? productDoc(ctx, kind, v, product) : {};
  const sumInsured = pesoValue('sumInsured', v.sumInsured, 'Sum Insured') ?? (kind === 'credit-life' && productFields.loanAmount ? productFields.loanAmount : 0);
  let rate = numberCell(v.commissionRate);
  if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 1)) fail('commissionRate', 'Commission Rate must be a fraction from 0 to 1');
  if (rate === null) rate = Number(insurer.commission_rate || 0) || Number(await getSetting('commission.default_rate', 0.15));
  const billingMode = v.billingMode ? String(v.billingMode).toLowerCase() : null;
  if (billingMode && !['broker', 'direct'].includes(billingMode)) fail('billingMode', 'Billing Mode must be broker or direct');
  const allowed = await getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded']);
  const status = resolveValue(ctx, 'payment-status', v.paymentStatus);
  const paymentStatus = status ? allowed.find((x) => x.toLowerCase() === String(status).toLowerCase()) : 'Completed';
  if (!paymentStatus) fail('paymentStatus', `Payment Status must be one of ${allowed.join(', ')}`);
  const owner = await userIdOf(ctx, 'accountExecutive', v.accountExecutive);
  const doc = { ...productFields };
  if (!sheet.policyKind && v.plateNumber) doc.plateNumber = v.plateNumber;
  let channel = null;
  if (sheet.policyKind) {
    if (v.branch) {
      const code = resolveValue(ctx, 'branch', v.branch);
      const b = await one('SELECT code FROM branches WHERE lower(code) = lower($1) OR lower(name) = lower($1) ORDER BY id LIMIT 1', [code]);
      if (!b) fail('branch', `Branch ${v.branch} is not in the Branch master`);
      doc.branchCode = b.code;
    }
    if (v.distributionChannel) {
      const code = resolveValue(ctx, 'channel', v.distributionChannel);
      channel = await one('SELECT id, code FROM distribution_channels WHERE lower(code) = lower($1) OR lower(name) = lower($1) ORDER BY code LIMIT 1', [code]);
      if (!channel) fail('distributionChannel', `Distribution channel ${v.distributionChannel} is not in the Distribution Channel master`);
    }
    if (v.businessType) {
      const t = BUSINESS_TYPES.find((x) => x.toLowerCase() === String(v.businessType).toLowerCase());
      if (!t) fail('businessType', `Business Type must be ${BUSINESS_TYPES.join(' or ')}`);
      doc.legacyBusinessType = t;
    }
    if (v.previousPolicyNumber) doc.legacyPreviousPolicyNumber = v.previousPolicyNumber;
    Object.assign(doc, await currencyDoc(v, await baseCurrency()));
  }
  const number = ctx.rowResolution === 'insurer-suffix' ? `${v.policyNumber}/${insurer.code}` : v.policyNumber;
  return { client, insurer, product, kind, number, gross, net, sumInsured, rate, billingMode, paymentStatus, owner, channel, doc };
}

/** Change a policy created by a migration load (Changed row): nothing may hang on it yet. */
async function updateMigratedPolicy(ctx, sheet, existing, input, v) {
  if (!existing.load_batch_id) fail('policyNumber', `Policy ${existing.policy_number} was migrated outside a load: correct it on the policy screen (Operations > Policy)`);
  const deps = await dependentsOf(POLICY_DEPENDENTS, existing.id);
  if (deps.length) changedAfterLoad('policyNumber', 'Policy', existing.policy_number, existing.load_batch_id, deps);
  const kinds = ctx.presentKinds;
  const exportKind = sheet.policyKind ? input.kind : null;
  const before = (await policyExport(exportKind, kinds, 'p.id = $1', [existing.id]))[0];
  const lob = lobOf(input.product.line === 'fire' && /industrial/i.test(input.product.name) ? 'IAR' : input.product.line || input.product.code);
  const taxes = await derivedPremiumTaxes({ lob, productId: input.product.id, netPremium: input.net, grossPremium: input.gross });
  const doc = { ...input.doc, commissionRate: input.rate, ...(taxes || {}) };
  await query(`UPDATE policies SET client_id = $2, product_id = $3, insured_name = $4, inception_date = $5, expiry_date = $6, issued_date = $7, sum_insured = $8, net_premium = $9,
      premium_total = $10, commission_amount = $11, billing_mode = COALESCE($12, billing_mode), payment_status = $13, owner_user_id = COALESCE($14, owner_user_id), channel_id = $15,
      product_type = $16, lob = $17, doc = doc || $18::jsonb, legacy_system = COALESCE($19, legacy_system), updated_by = $20, updated_at = now()
    WHERE id = $1`, [existing.id, input.client.id, input.product.id, v.insuredName || input.client.display_name, v.inceptionDate, v.expiryDate, v.issueDate, input.sumInsured,
    input.net, input.gross, round2(input.net * input.rate), input.billingMode, input.paymentStatus, input.owner, input.channel?.id || null, input.product.name, lob,
    JSON.stringify(doc), v.legacySystem || null, ctx.user.id]);
  await writeParticipants({ query }, 'policy', existing.id, [{ insuranceCompanyId: input.insurer.id, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: existing.policy_number }],
    { sumInsured: input.sumInsured, premium: input.net, taxes: round2(input.gross - input.net), premiumTotal: input.gross, commissionAmount: round2(input.net * input.rate) },
    { userId: ctx.user.id, commissionRate: input.rate });
  if (input.kind === 'ctpl' && sheet.policyKind) await writeCtplAuthentication(ctx, existing.id, existing.policy_number, input.insurer, v, input.doc.branchCode);
  await ctx.record({ entity: 'policy', table: 'policies', id: existing.id, key: existing.policy_number, action: 'updated', before,
    after: (await policyExport(exportKind, kinds, 'p.id = $1', [existing.id]))[0] });
  return 'updated';
}

/** Load one policy row of a policy sheet: create the migrated policy, or change one created by an earlier load. */
async function importPolicy(ctx, sheet, v) {
  const input = await policyInput(ctx, sheet, v);
  const existing = await storedPolicy(input.number, input.insurer.id);
  if (existing) {
    if (existing.insurance_company_id !== input.insurer.id) {
      fail('policyNumber', `Policy number ${input.number} is the policy of ${existing.insurer_code || 'another insurer'}: load it with the insurer suffix (${input.number}/${input.insurer.code})`);
    }
    if (existing.origin !== MIGRATED) fail('policyNumber', `Policy number ${input.number} already belongs to a policy issued in BrokerVerse`);
    return updateMigratedPolicy(ctx, sheet, existing, input, v);
  }
  if (input.number !== v.policyNumber) {
    const taken = await one('SELECT 1 AS x FROM policies WHERE policy_number = $1', [input.number]);
    if (taken) fail('policyNumber', `Policy number ${input.number} is taken`);
  } else await assertNoSeriesClash(ctx, 'policy', v.policyNumber, 'policyNumber');
  if (input.kind === 'ctpl' && sheet.policyKind) {
    const clash = await cocClash(input.insurer.id, v.certNumber);
    if (clash) fail('certNumber', `COC ${v.certNumber} is in the range of a COC series of ${input.insurer.code} whose next number is ${clash.next}: raise the series' next number above it first`);
  }
  const { product, insurer, client } = input;
  const lob = lobOf(product.line === 'fire' && /industrial/i.test(product.name) ? 'IAR' : product.line || product.code);
  const taxes = await derivedPremiumTaxes({ lob, productId: product.id, netPremium: input.net, grossPremium: input.gross });
  const r = await issuePolicy({ query }, {
    clientId: client.id, productId: product.id, insuranceCompanyId: insurer.id, sumInsured: input.sumInsured, netPremium: input.net, grossPremium: input.gross,
    commissionAmount: round2(input.net * input.rate), commissionRate: input.rate, currency: await baseCurrency(), insuredName: v.insuredName || v.borrowerName || client.display_name,
    productType: product.name, lob, ownerUserId: input.owner || ctx.user.id, agentUserId: input.owner || ctx.user.id, migration: true,
    legacySystem: v.legacySystem || ctx.legacySystem, legacyNumber: v.policyNumber, migratedBy: ctx.migratedBy, loadBatchId: ctx.batchId,
    doc: { ...input.doc, source: MIGRATION_SOURCE, loadBatchId: ctx.batchId, commissionRate: input.rate, ...(taxes || {}) },
  }, { policyNumber: input.number, inception: v.inceptionDate, expiry: v.expiryDate, issuedDate: v.issueDate, paymentStatus: input.paymentStatus, billingMode: input.billingMode }, ctx.user.id);
  if (input.channel) await query('UPDATE policies SET channel_id = $2 WHERE id = $1', [r.policyId, input.channel.id]);
  if (input.kind === 'ctpl' && sheet.policyKind) await writeCtplAuthentication(ctx, r.policyId, input.number, insurer, v, input.doc.branchCode);
  await ctx.record({ entity: 'policy', table: 'policies', id: r.policyId, key: input.number, action: 'created',
    after: (await policyExport(sheet.policyKind ? input.kind : null, ctx.presentKinds, 'p.id = $1', [r.policyId]))[0] });
  return 'created';
}

const policyTotals = (rows) => ({ grossPremium: pesoSum(rows.map((r) => r.grossPremium)), netPremium: pesoSum(rows.map((r) => r.netPremium || r.grossPremium)),
  sumInsured: pesoSum(rows.map((r) => r.sumInsured)) });

/** A policy sheet: kind entry of products.js, or null for the single Policies sheet of the earlier layout. */
function policySheet(def) {
  const sheet = {
    key: def ? def.key : 'policies', name: def ? def.name : 'Policies', menu: 'Operations > Policy',
    columns: def ? policyColumns(def.kind) : LEGACY_POLICY_COLUMNS, keyColumns: ['policyNumber'], keyOf: (v) => keyText(v.policyNumber),
    policyKind: def ? def.kind : null, productLines: def ? def.lines : [], legacyLayout: !def, keyGroup: 'policies',
    sample: def ? POLICY_SAMPLES[def.kind] : POLICY_SAMPLES.motor,
    exportRows: async (ctx) => policyExport(def ? def.kind : null, ctx.presentKinds || await presentKinds()),
    /** The stored row of the same policy when the number is shared by two insurers' policies. */
    pickStored: (list, v) => list.find((r) => keyText(r.insurer) === keyText(v.insurer)) || list[0],
    /** Who the row is to the duplicate rules: its insurer, and whether a stored policy is its own record. */
    async duplicateSubject(ctx, v) {
      const insurer = await insurerOf(ctx, v.insurer);
      const own = (m) => m.number === v.policyNumber || (!!insurer && m.insurerId === insurer.id && (m.legacyNumber === v.policyNumber || m.number === `${v.policyNumber}/${insurer.code}`));
      return { insurer, sameRecord: own };
    },
    check(ctx, v) {
      beforeCutover(ctx, 'issueDate', v.issueDate, 'Issue Date');
      const inception = dateValue('inceptionDate', v.inceptionDate, 'Inception Date');
      const expiry = dateValue('expiryDate', v.expiryDate, 'Expiry Date');
      if (inception && expiry && expiry <= inception) fail('expiryDate', 'Expiry Date must be after the Inception Date');
      if (expiry && ctx.cutover && expiry < ctx.cutover) fail('expiryDate', `Expiry Date ${expiry} is before the cutover date ${ctx.cutover}: the policy is not in force (expired business stays in the old system)`);
    },
    importRow: (ctx, v) => importPolicy(ctx, sheet, v),
    totals: policyTotals,
  };
  return sheet;
}

// ------------------------------------------------------------------ open premium receivables

const OPEN_LABEL = { policyNumber: 'Policy Number', billReference: 'Bill Reference', dueDate: 'Due Date', originalAmount: 'Original Amount', openBalance: 'Open Balance' };
const openItemValues = (r) => ({ policyNumber: r.policy_number, billReference: cell(r.reference), dueDate: cell(r.due_date), originalAmount: String(Number(r.amount)),
  openBalance: String(Number(r.balance)), currency: cell(r.currency) });
const openItemsSheet = () => ({
  key: 'open-items', name: 'Open Items', menu: 'Accounts > Collections',
  columns: [...OPEN_ITEM_COLUMNS.map((c) => ({ key: c.key, header: c.header, required: c.required === true, format: c.format, aliases: c.aliases,
    ...(['dueDate'].includes(c.key) ? { type: 'date' } : {}), ...(['originalAmount', 'openBalance'].includes(c.key) ? { type: 'number' } : {}) })),
  { key: 'currency', header: 'Currency', list: 'Currencies', format: 'PHP when empty; an open item of another currency is loaded at its peso amount as booked' }],
  keyColumns: ['policyNumber', 'billReference'], keyOf: (v) => keyText(v.policyNumber, v.billReference),
  sample: { policyNumber: 'PC-MLY-2026-000101', billReference: 'DN-2026-08812', dueDate: '2026-11-30', originalAmount: '35946.88', openBalance: '20000' },
  async exportRows(ctx) {
    if (!ctx.cutover) return [];
    const rows = await many(`SELECT r.*, p.policy_number FROM receivables r JOIN policies p ON p.id = r.policy_id WHERE r.source = $1 AND r.go_live_date = $2::date
      ORDER BY p.policy_number, r.reference`, [OPENING_SOURCE, ctx.cutover]);
    return rows.map(openItemValues);
  },
  async importRow(ctx, v) {
    if (v.dueDate && !isDate(v.dueDate)) fail('dueDate', 'Due Date must be a date YYYY-MM-DD');
    const base = await baseCurrency();
    if (v.currency && String(v.currency).trim().toUpperCase() !== base) {
      fail('currency', `Currency ${v.currency}: open items are loaded in ${base}, at the peso amount booked in the legacy ledger`);
    }
    const balance = pesoValue('openBalance', v.openBalance, 'Open Balance', { positive: true });
    const amount = pesoValue('originalAmount', v.originalAmount, 'Original Amount');
    if (amount !== null && amount < balance) fail('originalAmount', 'Original Amount cannot be less than the Open Balance');
    let r;
    try {
      r = await loadOpenItem({ query }, v, { goLiveDate: ctx.cutover, user: ctx.user, legacySystem: ctx.legacySystem, batchId: ctx.batchId, migratedBy: ctx.migratedBy });
    } catch (e) {
      // the amounts of an open item touched since its load can no longer change
      const col = (/since it was loaded/.test(e.message) ? 'openBalance' : null)
        || Object.entries(OPEN_LABEL).find(([, label]) => String(e.message).startsWith(label) || String(e.message).includes(` ${label}`))?.[0]
        || (/Policy|policy/.test(e.message) ? 'policyNumber' : null);
      if (col && !e.details?.length) fail(col, e.message);
      throw e;
    }
    if (r.status === 'skipped') return 'unchanged';
    const key = `${v.policyNumber} / ${v.billReference}`;
    const after = { policyNumber: v.policyNumber, billReference: v.billReference, billNumber: r.billNumber, dueDate: v.dueDate, originalAmount: v.originalAmount || v.openBalance, openBalance: v.openBalance };
    if (r.status === 'updated') {
      await ctx.record({ entity: 'receivable', table: 'receivables', id: r.receivableId, key, action: 'updated', before: r.before, after });
      return 'updated';
    }
    await ctx.record({ entity: 'receivable', table: 'receivables', id: r.receivableId, key, action: 'created', after });
    return 'created';
  },
  totals: (rows) => ({ originalAmount: pesoSum(rows.map((r) => r.originalAmount || r.openBalance)), openBalance: pesoSum(rows.map((r) => r.openBalance)) }),
});

// ------------------------------------------------------------------ post-dated cheques on hand

const PDC_EXPORT = `SELECT d.*, b.code AS bank_code, p.policy_number, r.reference AS bill_reference FROM post_dated_cheques d LEFT JOIN banks b ON b.id = d.bank_id
  LEFT JOIN policies p ON p.id = d.policy_id LEFT JOIN receivables r ON r.id = d.receivable_id`;
const pdcValues = (d) => ({ draweeBank: cell(d.bank_code || d.drawee_bank), chequeNumber: d.cheque_number, chequeDate: cell(d.cheque_date), amount: String(Number(d.amount)),
  policyNumber: cell(d.policy_number), billReference: cell(d.bill_reference), receivedDate: cell(d.received_date), storageLocation: cell(d.storage_location), branch: cell(d.branch) });
const pdcSheet = () => ({
  key: 'post-dated-cheques', name: 'Post-Dated Cheques', menu: 'Accounts > Post-Dated Cheques',
  columns: [
    { key: 'draweeBank', header: 'Drawee Bank', required: true, list: 'Banks', format: 'Bank code of the Bank master, or the bank name' },
    { key: 'chequeNumber', header: 'Cheque Number', required: true },
    { key: 'chequeDate', header: 'Cheque Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, on or after the cutover date (a cheque dated earlier was deposited in the legacy system)' },
    { key: 'amount', header: 'Amount', required: true, type: 'number', format: 'Amount in PHP, greater than zero, not more than the open balance of the open item' },
    { key: 'policyNumber', header: 'Policy Number', required: true, format: 'Policy of the open item the cheque pays' },
    { key: 'billReference', header: 'Bill Reference', required: true, format: 'Bill Reference of the open item (Open Items sheet or already loaded)' },
    { key: 'receivedDate', header: 'Received Date', type: 'date', format: 'Date YYYY-MM-DD, before the cutover date; the day before the cutover when empty' },
    { key: 'storageLocation', header: 'Storage Location', format: 'Vault or safe where the cheque is kept' },
    { key: 'branch', header: 'Drawee Branch' },
  ],
  keyColumns: ['draweeBank', 'chequeNumber'], keyOf: (v) => keyText(v.draweeBank, v.chequeNumber),
  sample: { draweeBank: 'PNB', chequeNumber: '0001234567', chequeDate: '2026-11-15', amount: '10000.00', policyNumber: 'PC-MLY-2026-000101', billReference: 'DN-2026-08812',
    receivedDate: '2026-10-20', storageLocation: 'Head Office vault' },
  async exportRows() {
    return (await many(`${PDC_EXPORT} WHERE d.origin = $1 AND d.status = 'on-hand' ORDER BY d.cheque_date, d.cheque_number`, [MIGRATED])).map(pdcValues);
  },
  check(ctx, v) {
    const date = dateValue('chequeDate', v.chequeDate, 'Cheque Date');
    if (date && ctx.cutover && date < ctx.cutover) {
      fail('chequeDate', `Cheque Date ${date} is before the cutover date ${ctx.cutover}: a cheque of an earlier date was deposited in the legacy system and stays on its bank reconciliation`);
    }
    if (v.receivedDate) beforeCutover(ctx, 'receivedDate', v.receivedDate, 'Received Date');
  },
  async importRow(ctx, v) {
    const amount = pesoValue('amount', v.amount, 'Amount', { positive: true });
    const bank = await one('SELECT id, code FROM banks WHERE lower(code) = lower($1) OR lower(name) = lower($1) ORDER BY id LIMIT 1', [v.draweeBank]);
    const stored = await one(`SELECT id, origin FROM post_dated_cheques WHERE COALESCE(bank_id, 0) = COALESCE($1::int, 0) AND lower(COALESCE(drawee_bank, '')) = lower(COALESCE($2::text, ''))
      AND cheque_number = $3 AND status <> 'cancelled'`, [bank?.id ?? null, bank ? null : v.draweeBank, String(v.chequeNumber).trim()]);
    if (stored) {
      fail('chequeNumber', stored.origin === MIGRATED ? `Cheque ${v.chequeNumber} was already migrated with other values; correct it on Accounts > Post-Dated Cheques`
        : `Cheque ${v.chequeNumber} of ${v.draweeBank} is registered in BrokerVerse already`);
    }
    const item = await one(`SELECT r.id, r.balance FROM receivables r JOIN policies p ON p.id = r.policy_id
      WHERE (p.policy_number = $1 OR (p.legacy_number = $1 AND p.origin = 'migrated')) AND r.reference = $2 AND r.source = $3 AND r.go_live_date = $4::date AND r.status IN ('open', 'partial')
      ORDER BY (p.policy_number = $1) DESC LIMIT 1`, [v.policyNumber, v.billReference, OPENING_SOURCE, ctx.cutover]);
    if (!item) fail('billReference', `Open item ${v.policyNumber} / ${v.billReference} is not in the Open Items sheet or among the open items migrated for the cutover`);
    let d;
    try {
      d = await registerPdc({ query }, { receivableId: item.id, bankId: bank?.id || null, draweeBank: bank ? null : v.draweeBank, branch: v.branch || null, chequeNumber: v.chequeNumber,
        chequeDate: v.chequeDate, amount, receivedDate: v.receivedDate || addDays(ctx.cutover, -1), storageLocation: v.storageLocation || null },
      ctx.user, { migration: { legacySystem: ctx.legacySystem, batchId: ctx.batchId, migratedBy: ctx.migratedBy } });
    } catch (e) {
      if (e.status === 409) fail('amount', e.message);
      throw e;
    }
    await ctx.record({ entity: 'post_dated_cheque', table: 'post_dated_cheques', id: d.id, key: `${v.draweeBank} / ${v.chequeNumber}`, action: 'created',
      after: pdcValues((await many(`${PDC_EXPORT} WHERE d.id = $1`, [d.id]))[0]) });
    return 'created';
  },
  totals: (rows) => ({ amount: pesoSum(rows.map((r) => r.amount)) }),
});

// ------------------------------------------------------------------ open claims

const CLAIM_STATUSES = ['registered', 'in-review'];
const CLAIM_EXPORT = `SELECT c.*, p.policy_number, u.username AS handler_username FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN users u ON u.id = c.handler_user_id`;
/** A stored claim in the column keys of the Open Claims sheet. */
const claimValues = (c) => ({ claimNumber: c.claim_number, policyNumber: c.policy_number, lossDate: cell(c.loss_date), reportedDate: cell(c.reported_date), status: c.status,
  lossType: cell(c.loss_type), description: cell(c.description), estimateAmount: String(Number(c.estimate_amount)), insurerClaimNumber: cell(c.insurer_claim_number), handler: cell(c.handler_username) });
const claimsSheet = () => ({
  key: 'claims', name: 'Open Claims', menu: 'Operations > Claims',
  columns: [
    { key: 'claimNumber', header: 'Claim Number', required: true, format: 'Claim number in the old system; kept' },
    { key: 'policyNumber', header: 'Policy Number', required: true, format: 'Policy of the policy sheets or already in BrokerVerse' },
    { key: 'lossDate', header: 'Loss Date', required: true, type: 'date', format: 'Date YYYY-MM-DD, before the cutover date' },
    { key: 'reportedDate', header: 'Reported Date', type: 'date', format: 'Date YYYY-MM-DD, before the cutover date; the loss date when empty' },
    { key: 'status', header: 'Status', list: 'Claim Status', format: 'registered or in-review (registered when empty)' },
    { key: 'lossType', header: 'Loss Type', format: 'e.g. Collision, Fire, Theft' },
    { key: 'description', header: 'Description' },
    { key: 'estimateAmount', header: 'Outstanding Estimate', required: true, type: 'number', format: 'Amount claimed / reserve still open in PHP, at most two decimals' },
    { key: 'insurerClaimNumber', header: 'Insurer Claim Number' },
    { key: 'handler', header: 'Handler', format: 'Username of the claims handler' },
  ],
  keyColumns: ['claimNumber'], keyOf: (v) => keyText(v.claimNumber),
  sample: { claimNumber: 'OLD-CLM-2026-0042', policyNumber: 'PC-MLY-2026-000101', lossDate: '2026-09-12', reportedDate: '2026-09-13', status: 'in-review', lossType: 'Collision',
    description: 'Rear-end collision on EDSA', estimateAmount: '85000', insurerClaimNumber: 'MLY-CL-77812' },
  async exportRows() {
    const rows = await many(`${CLAIM_EXPORT}
      WHERE c.origin = $1 ORDER BY c.claim_number`, [MIGRATED]);
    return rows.map(claimValues);
  },
  check(ctx, v) {
    beforeCutover(ctx, 'lossDate', v.lossDate, 'Loss Date');
    beforeCutover(ctx, 'reportedDate', v.reportedDate, 'Reported Date');
    if (v.reportedDate && v.lossDate && v.reportedDate < v.lossDate) fail('reportedDate', 'Reported Date cannot be before the Loss Date');
  },
  async importRow(ctx, v) {
    const status = String(resolveValue(ctx, 'claim-status', v.status) || 'registered').toLowerCase();
    if (!CLAIM_STATUSES.includes(status)) fail('status', `Status must be ${CLAIM_STATUSES.join(' or ')}: settled and closed claims stay in the old system`);
    const estimate = pesoValue('estimateAmount', v.estimateAmount, 'Outstanding Estimate');
    const policy = await one(`SELECT id, client_id, lob, inception_date, expiry_date FROM policies WHERE policy_number = $1 OR (legacy_number = $1 AND origin = 'migrated')
      ORDER BY (policy_number = $1) DESC LIMIT 1`, [v.policyNumber]);
    if (!policy) fail('policyNumber', `Policy ${v.policyNumber} is not in the policy sheets or in BrokerVerse`);
    if (v.lossDate < String(policy.inception_date) || v.lossDate > String(policy.expiry_date)) {
      fail('lossDate', `Loss Date ${v.lossDate} is outside the policy period ${policy.inception_date} to ${policy.expiry_date}`);
    }
    const handler = await userIdOf(ctx, 'handler', v.handler);
    const reported = v.reportedDate || v.lossDate;
    const existing = await one('SELECT id, origin, load_batch_id FROM claims WHERE claim_number = $1', [v.claimNumber]);
    if (existing) {
      if (existing.origin !== MIGRATED) fail('claimNumber', `Claim number ${v.claimNumber} already belongs to a claim registered in BrokerVerse`);
      if (!existing.load_batch_id) fail('claimNumber', `Claim ${v.claimNumber} was migrated outside a load: correct it on the claim screen`);
      const deps = await dependentsOf(CLAIM_DEPENDENTS, existing.id);
      if (deps.length) changedAfterLoad('claimNumber', 'Claim', v.claimNumber, existing.load_batch_id, deps);
      const before = claimValues(await one(`${CLAIM_EXPORT} WHERE c.id = $1`, [existing.id]));
      await query(`UPDATE claims SET policy_id = $2, client_id = $3, status = $4, loss_date = $5, reported_date = $6, loss_type = $7, description = $8, estimate_amount = $9,
          handler_user_id = $10, insurer_claim_number = $11, updated_at = now() WHERE id = $1`,
      [existing.id, policy.id, policy.client_id, status, v.lossDate, reported, v.lossType || null, v.description || null, estimate ?? 0, handler, v.insurerClaimNumber || null]);
      await ctx.record({ entity: 'claim', table: 'claims', id: existing.id, key: v.claimNumber, action: 'updated', before,
        after: claimValues(await one(`${CLAIM_EXPORT} WHERE c.id = $1`, [existing.id])) });
      return 'updated';
    }
    await assertNoSeriesClash(ctx, 'claim', v.claimNumber, 'claimNumber');
    const lob = String(policy.lob || 'MOTOR').toUpperCase();
    const sla = Number(await getSetting('claims.sla_days', 20));
    const claim = await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description, estimate_amount, handler_user_id,
        lob, claim_type, priority, insurer_claim_number, due_date, details, created_by, load_batch_id, origin, legacy_system, legacy_number, migrated_at, migrated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,($6::date + $15::int),$16,$17,$18,'migrated',$19,$1,now(),$20) RETURNING id`,
    [v.claimNumber, policy.id, policy.client_id, status, v.lossDate, reported, v.lossType || null, v.description || null, estimate ?? 0, handler, lob,
      lob.charAt(0) + lob.slice(1).toLowerCase(), await getSetting('claims.default_priority', 'Medium'), v.insurerClaimNumber || null, sla,
      JSON.stringify({ source: MIGRATION_SOURCE, loadBatchId: ctx.batchId }), ctx.user.username, ctx.batchId, ctx.legacySystem, ctx.migratedBy]);
    await query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)',
      [claim.id, ctx.user.username, status, `Open claim migrated from the old system (cutover ${ctx.cutover})`]);
    await ctx.record({ entity: 'claim', table: 'claims', id: claim.id, key: v.claimNumber, action: 'created',
      after: claimValues(await one(`${CLAIM_EXPORT} WHERE c.id = $1`, [claim.id])) });
    return 'created';
  },
  totals: (rows) => ({ estimateAmount: pesoSum(rows.map((r) => r.estimateAmount)) }),
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
  check(ctx, v) {
    for (const [k, label] of [['debit', 'Debit'], ['credit', 'Credit']]) {
      const n = numberCell(v[k]);
      if (n !== null && !Number.isNaN(n) && centavos(n) === null) fail(k, `${label} has more than two decimals`);
    }
  },
  /**
   * All or nothing, like the opening balance import: { rows: [{ action } | { errors } | { held }] per row, sheetError }.
   * A row with no debit or credit (zero balance) is accepted and ignored. When the sheet fails, the rows in error carry
   * their own errors, the other rows are held (not loaded, no error of their own) and sheetError says why.
   */
  async importSheet(ctx, rows) {
    const existing = new Map((await many('SELECT account_code, balance FROM opening_balances WHERE source_run = $1', [`${GO_LIVE_PREFIX}${ctx.cutover}`]))
      .map((r) => [r.account_code, round2(Number(r.balance))]));
    const amount = (x) => numberCell(x) || 0;
    const zero = rows.map((r) => zeroBalanceRow(r.values));
    const ignored = { action: 'ignored', note: 'no debit or credit (zero balance): accepted, nothing to load' };
    const balances = rows.filter((_, i) => !zero[i]);
    const zeroCodes = rows.filter((_, i) => zero[i]).map((r) => String(r.values.accountCode || '').trim());
    const known = zeroCodes.length ? (await many('SELECT code FROM gl_accounts WHERE code = ANY($1)', [zeroCodes])).length === new Set(zeroCodes).size : true;
    const same = known && balances.length && existing.size === balances.length
      && balances.every((r) => existing.get(String(r.values.accountCode).trim()) === round2(amount(r.values.debit) - amount(r.values.credit)));
    if (same) return { rows: rows.map((_, i) => (zero[i] ? ignored : { action: 'unchanged' })) };
    let out;
    try {
      out = await importOpeningBalances({ query }, rows.map((r) => r.values), { goLiveDate: ctx.cutover, batchId: ctx.batchId });
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
      const sheetError = byRow.size
        ? `Nothing was loaded: the sheet loads all or nothing and ${byRow.size} row(s) are in error (${[...byRow.keys()].map((i) => `row ${rows[i].rowNumber}`).join(', ')}); the other rows are held until they are fixed`
        : `Nothing was loaded: ${String(e.message).replace(/;? *nothing was loaded\.?$/i, '')}`;
      return { rows: rows.map((_, i) => (byRow.has(i) ? { errors: byRow.get(i) } : { held: true })), sheetError };
    }
    const skipped = new Set(out.ignored.map((x) => x.row - 2));
    // one audit entry per account of the set: its balance before and after the load (accounts no longer in the set go to zero)
    const run = `${GO_LIVE_PREFIX}${ctx.cutover}`;
    const after = new Map((await many('SELECT account_code, balance FROM opening_balances WHERE source_run = $1', [run])).map((r) => [r.account_code, round2(Number(r.balance))]));
    for (const code of new Set([...existing.keys(), ...after.keys()])) {
      if (existing.get(code) === after.get(code)) continue;
      await ctx.record({ entity: 'opening_balances', table: 'opening_balances', id: `${run}:${code}`, key: code, action: existing.has(code) ? 'updated' : 'created',
        before: existing.has(code) ? { accountCode: code, balance: existing.get(code) } : null, after: { accountCode: code, balance: after.get(code) ?? 0 } });
    }
    return { rows: rows.map((r, i) => (skipped.has(i) ? ignored : { action: existing.has(String(r.values.accountCode).trim()) ? 'updated' : 'created' })) };
  },
  totals: (rows) => ({ debit: pesoSum(rows.map((r) => r.debit)), credit: pesoSum(rows.map((r) => r.credit)), zeroBalanceRows: rows.filter(zeroBalanceRow).length }),
});

// ------------------------------------------------------------------ control totals of the legacy system

/** Objects of the Control Totals sheet and their measures. */
export const CONTROL_MEASURES = {
  Clients: ['count'],
  Policies: ['count', 'gross premium', 'net premium', 'sum insured'],
  'Open Items': ['count', 'original amount', 'open balance'],
  'Post-Dated Cheques': ['count', 'amount'],
  'Open Claims': ['count', 'outstanding estimate'],
  'Opening Balances': ['debit', 'credit', 'balance'],
  'Sub-ledger': ['due to insurers', 'commission receivable', 'unapplied collections', 'cash in bank', 'sap trial balance'],
};

const controlTotalsSheet = () => ({
  key: 'control-totals', name: 'Control Totals', menu: 'Data Migration & Go-Live > Reconciliation',
  columns: [
    { key: 'object', header: 'Object', required: true, list: 'Control Objects', format: `One of ${Object.keys(CONTROL_MEASURES).join(', ')}` },
    { key: 'measure', header: 'Measure', required: true, list: 'Control Measures', format: 'count, gross premium, open balance ... (Instructions: measures per object)' },
    { key: 'group', header: 'Group', format: 'Product, insurer, ageing bucket, account or bank account; empty for the total' },
    { key: 'legacyValue', header: 'Legacy Value', required: true, type: 'number', format: 'Figure of the legacy system at the close of the day before the cutover; amounts in PHP, at most two decimals' },
  ],
  keyColumns: ['object', 'measure', 'group'], keyOf: (v) => keyText(v.object, v.measure, v.group),
  sample: { object: 'Policies', measure: 'gross premium', group: 'MOTOR', legacyValue: '1250000.00' },
  async importRow(ctx, v) {
    const object = Object.keys(CONTROL_MEASURES).find((o) => o.toLowerCase() === String(v.object).trim().toLowerCase());
    if (!object) fail('object', `Object must be one of ${Object.keys(CONTROL_MEASURES).join(', ')}`);
    if (!CONTROL_MEASURES[object].includes(String(v.measure).trim().toLowerCase())) fail('measure', `Measure of ${object} must be one of ${CONTROL_MEASURES[object].join(', ')}`);
    const n = amountValue('legacyValue', v.legacyValue, 'Legacy Value');
    if (String(v.measure).trim().toLowerCase() === 'count' ? !Number.isInteger(n) : centavos(n) === null) {
      fail('legacyValue', String(v.measure).trim().toLowerCase() === 'count' ? 'A count is a whole number' : 'Legacy Value has more than two decimals');
    }
    return 'ignored';
  },
});

/** Sheets of the migration kit by key; their load order and dependencies are declared in registry.js. */
export const MIGRATION_SHEETS = {
  clients: clientsSheet,
  ...Object.fromEntries(POLICY_KINDS.map((k) => [k.key, () => policySheet(k)])),
  policies: () => policySheet(null),
  'open-items': openItemsSheet, 'post-dated-cheques': pdcSheet, claims: claimsSheet, 'opening-balances': openingBalancesSheet, 'control-totals': controlTotalsSheet,
};

/**
 * Reconciliation summary of a migration load (inside the load transaction): control totals of the workbook and of
 * BrokerVerse after the load, and the checks the broker compares with the old system: trial balance debits = credits
 * and premiums receivable control account = open items. sheets: the sheets of the migration kit (registry.js); the
 * policy sheets add up to one Policies line.
 */
export async function reconciliation(ctx, rowsBySheet, sheets) {
  const cutover = ctx.cutover;
  const wb = Object.fromEntries(sheets.map((s) => [s.key, (rowsBySheet[s.key] || []).filter((r) => r.status !== 'error').map((r) => r.values)]));
  const policyRows = sheets.filter((s) => s.keyGroup === 'policies').flatMap((s) => wb[s.key]);
  const clients = await one(`SELECT count(*)::int AS n, count(*) FILTER (WHERE client_type = 'corporate')::int AS corporate FROM clients WHERE source = $1`, [MIGRATION_SOURCE]);
  const policies = await one(`SELECT count(*)::int AS n, COALESCE(sum(premium_total), 0) AS gross, COALESCE(sum(net_premium), 0) AS net, COALESCE(sum(sum_insured), 0) AS si,
      count(*) FILTER (WHERE expiry_date < $2::date + 90)::int AS expiring
    FROM policies WHERE doc->>'source' = $1`, [MIGRATION_SOURCE, cutover]);
  const items = await one(`SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS amount, COALESCE(sum(balance), 0) AS balance FROM receivables WHERE source = $1 AND go_live_date = $2::date`,
    [OPENING_SOURCE, cutover]);
  const cheques = await one("SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS amount FROM post_dated_cheques WHERE origin = $1 AND status = 'on-hand'", [MIGRATED]);
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
      { sheet: 'Policies', workbookRows: policyRows.length, workbook: policyTotals(policyRows), inBrokerVerse: policies.n,
        detail: { grossPremium: n(policies.gross), netPremium: n(policies.net), sumInsured: n(policies.si), expiringWithin90Days: policies.expiring } },
      { sheet: 'Open Items', workbookRows: wb['open-items'].length, workbook: totals['open-items'], inBrokerVerse: items.n, detail: { originalAmount: n(items.amount), openBalance: n(items.balance) } },
      { sheet: 'Post-Dated Cheques', workbookRows: wb['post-dated-cheques'].length, workbook: totals['post-dated-cheques'], inBrokerVerse: cheques.n, detail: { amount: n(cheques.amount) } },
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
  ['Cheques deposited in the legacy system but not cleared at cutover', 'Stay on the legacy bank reconciliation; a bounce after go-live is a late legacy item'],
  ['Credit balances and unapplied collections', 'Part of the GL opening balances, with the legacy listing per client in the Control Totals sheet'],
  ['Leads and quotations in progress', 'Operations > Sales & Marketing > Prospects / Quotations > Bulk Upload'],
  ['Unreconciled bank items', 'Stay on the old bank reconciliation; BrokerVerse reconciles from the reconcile-from date of each bank account'],
  ['Documents and images of the old system', 'Named by the document file naming convention below and attached on the record screen when needed'],
];
