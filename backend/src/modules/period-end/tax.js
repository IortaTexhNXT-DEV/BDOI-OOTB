/**
 * Tax codes master (tax_codes) and BIR Form 2307 (Certificate of Creditable Tax Withheld at Source).
 *   issued    the broker as withholding agent: expanded withholding on payment vouchers (disbursements.wht_amount,
 *             gross_amount) to agents / referrers, suppliers and others, per payee and quarter
 *   received  creditable tax withheld from the broker: insurers on direct-bill commission (debit-note collections,
 *             ewt_amount) and clients on receipts (receipt_lines.ewt), per payor and quarter (for reconciliation and SAWT)
 * The ATC of an issued line comes from bir.atc_by_payee (referrer type, else payee type); received lines use
 * bir.sawt_default_atc. Certificates are numbered with the bir_2307 series (prefix CWT) when issued. The broker's name,
 * TIN, registered address and RDO code come from the primary company of the Company master (lib/letterhead.js).
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { legalIdentity } from '../../lib/letterhead.js';
import { addMonths, iso, monthEnd } from './fiscal.js';

export const TAX_TYPES = ['VAT', 'EWT', 'FWT', 'DST', 'LGT', 'PT', 'FST', 'OTHER'];

export const taxRow = (t) => t && ({
  code: t.code, description: t.description, taxType: t.tax_type, rate: Number(t.rate), atc: t.atc, natureOfPayment: t.nature_of_payment, glAccount: t.gl_account,
  appliesTo: t.applies_to, payeeKind: t.payee_kind, effectiveFrom: t.effective_from ? iso(t.effective_from) : null, effectiveTo: t.effective_to ? iso(t.effective_to) : null,
  editable: t.editable, active: t.active, status: t.active ? 'Active' : 'Inactive', sortOrder: t.sort_order, remarks: t.remarks, updatedAt: t.updated_at,
});

export async function listTaxCodes(db, q = {}) {
  const rows = (await db.query(`SELECT * FROM tax_codes WHERE ($1::text IS NULL OR tax_type = $1) AND ($2::boolean IS NULL OR active = $2)
    AND ($3::text IS NULL OR code ILIKE '%' || $3 || '%' OR description ILIKE '%' || $3 || '%' OR atc ILIKE '%' || $3 || '%') ORDER BY sort_order, code`,
  [q.taxType || null, q.active === undefined || q.active === '' ? null : String(q.active) === 'true', q.search || null])).rows;
  return rows.map(taxRow);
}

export async function saveTaxCode(db, code, b, user, { create = false } = {}) {
  const current = (await db.query('SELECT * FROM tax_codes WHERE code = $1', [code])).rows[0];
  if (create && current) throw conflict(`Tax code ${code} already exists`);
  if (!create && !current) throw notFound(`Tax code ${code} not found`);
  if (current && !current.editable) throw conflict(`Tax code ${code} is not editable`);
  const m = { ...(current ? taxRow(current) : {}), ...b };
  if (!m.description) throw badRequest('description is required');
  if (!TAX_TYPES.includes(m.taxType)) throw badRequest(`taxType must be one of ${TAX_TYPES.join(', ')}`);
  const rate = Number(m.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw badRequest('rate must be a percentage between 0 and 100');
  if (m.glAccount) {
    const a = (await db.query('SELECT 1 FROM gl_accounts WHERE code = $1 AND status = \'active\'', [m.glAccount])).rows[0];
    if (!a) throw badRequest(`GL account ${m.glAccount} not found or inactive`);
  }
  if (m.atc) {
    const dup = (await db.query('SELECT code FROM tax_codes WHERE atc = $1 AND code <> $2', [m.atc, code])).rows[0];
    if (dup) throw conflict(`ATC ${m.atc} is already used by tax code ${dup.code}`);
  }
  const values = [code, m.description, m.taxType, rate, m.atc || null, m.natureOfPayment || null, m.glAccount || null, m.appliesTo || 'both', m.payeeKind || 'any',
    m.effectiveFrom || null, m.effectiveTo || null, m.active !== false, Number(m.sortOrder ?? 100), m.remarks || null, user?.id ?? null];
  const sql = current
    ? `UPDATE tax_codes SET description = $2, tax_type = $3, rate = $4, atc = $5, nature_of_payment = $6, gl_account = $7, applies_to = $8, payee_kind = $9, effective_from = $10,
        effective_to = $11, active = $12, sort_order = $13, remarks = $14, updated_by = $15, updated_at = now() WHERE code = $1 RETURNING *`
    : `INSERT INTO tax_codes(code, description, tax_type, rate, atc, nature_of_payment, gl_account, applies_to, payee_kind, effective_from, effective_to, active, sort_order, remarks, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`;
  return taxRow((await db.query(sql, values)).rows[0]);
}

export const quarterRange = (year, quarter) => {
  const y = Number(year); const q = Number(quarter);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw badRequest('year is invalid');
  if (!Number.isInteger(q) || q < 1 || q > 4) throw badRequest('quarter must be 1 to 4');
  const from = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
  return { from, to: monthEnd(addMonths(from, 2)), months: [0, 1, 2].map((i) => addMonths(from, i).slice(0, 7)) };
};

/** Withholding lines of a quarter: [{ key, name, tin, address, date, atc, income, tax, reference }]. */
async function withholdingLines(db, direction, from, to) {
  if (direction === 'issued') {
    const map = (await getSetting('bir.atc_by_payee', {})) || {};
    const rows = (await db.query(`SELECT d.voucher_number, d.voucher_date, d.payee_type, d.payee_name, d.gross_amount, d.amount, d.wht_amount,
        COALESCE(d.referrer_id, d.insurance_company_id::text, d.client_id, d.payee_id, d.payee_name) AS pid, cr.referrer_type,
        COALESCE(cr.tin, ic.tin, cl.tin) AS tin, COALESCE(ic.address, cl.address) AS address
      FROM disbursements d LEFT JOIN commission_referrers cr ON cr.id = d.referrer_id LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id
      LEFT JOIN clients cl ON cl.id = d.client_id
      WHERE d.wht_amount > 0 AND d.status IN ('approved','paid') AND d.voucher_date BETWEEN $1 AND $2 ORDER BY d.voucher_date, d.voucher_number`, [from, to])).rows;
    return rows.map((r) => ({ key: `${r.payee_type}:${r.pid}`, name: r.payee_name, tin: r.tin || '', address: r.address || '', date: iso(r.voucher_date),
      atc: map[r.referrer_type] || map[r.payee_type] || '', income: round2(Number(r.gross_amount) || Number(r.amount) + Number(r.wht_amount)), tax: round2(r.wht_amount), reference: r.voucher_number }));
  }
  const atc = (await getSetting('bir.sawt_default_atc')) || '';
  const dn = (await db.query(`SELECT c.collection_number, c.received_date, c.ewt_amount, c.form_2307_no, d.ewt_rate, d.commission, d.expected_ewt, ic.id AS insurer_id, ic.name, ic.tin, ic.address
      FROM commission_debit_note_collections c JOIN commission_debit_notes d ON d.id = c.debit_note_id JOIN insurance_companies ic ON ic.id = d.insurance_company_id
     WHERE c.status = 'posted' AND c.ewt_amount > 0 AND c.received_date BETWEEN $1 AND $2 ORDER BY c.received_date`, [from, to])).rows;
  const rc = (await db.query(`SELECT r.receipt_number, r.received_date, rl.ewt, rl.net_premium, cl.id AS client_id, COALESCE(cl.display_name, r.customer_name) AS name, cl.tin, cl.address
      FROM receipt_lines rl JOIN receipts r ON r.id = rl.receipt_id LEFT JOIN clients cl ON cl.id = r.client_id
     WHERE rl.ewt > 0 AND r.status <> 'cancelled' AND r.received_date BETWEEN $1 AND $2 ORDER BY r.received_date`, [from, to])).rows;
  return [
    ...dn.map((r) => ({ key: `Insurer:${r.insurer_id}`, name: r.name, tin: r.tin || '', address: r.address || '', date: iso(r.received_date), atc,
      income: round2(Number(r.ewt_rate) > 0 ? Number(r.ewt_amount) / Number(r.ewt_rate) : r.commission), tax: round2(r.ewt_amount), reference: r.form_2307_no || r.collection_number })),
    ...rc.map((r) => ({ key: `Client:${r.client_id || r.name}`, name: r.name, tin: r.tin || '', address: r.address || '', date: iso(r.received_date), atc,
      income: round2(r.net_premium), tax: round2(r.ewt), reference: r.receipt_number })),
  ];
}

/** Aggregate lines of one payee into the 2307 layout: per ATC, income in each month of the quarter, total and tax. */
function certificateLines(lines, months, natures) {
  const byAtc = new Map();
  for (const l of lines) {
    const k = l.atc || '';
    const row = byAtc.get(k) || { atc: k, nature: natures.get(k) || '', month1: 0, month2: 0, month3: 0, total: 0, tax: 0 };
    const idx = months.indexOf(l.date.slice(0, 7));
    row[`month${idx + 1}`] = round2(row[`month${idx + 1}`] + l.income);
    row.total = round2(row.total + l.income);
    row.tax = round2(row.tax + l.tax);
    byAtc.set(k, row);
  }
  return [...byAtc.values()].sort((a, b) => a.atc.localeCompare(b.atc));
}

async function natures(db) {
  return new Map((await db.query('SELECT atc, COALESCE(nature_of_payment, description) AS n FROM tax_codes WHERE atc IS NOT NULL')).rows.map((r) => [r.atc, r.n]));
}

/** Payees (issued) or payors (received) with withholding in the quarter. */
export async function payees2307(db, { year, quarter, direction = 'issued' }) {
  const { from, to, months } = quarterRange(year, quarter);
  const lines = await withholdingLines(db, direction, from, to);
  const certs = new Map((await db.query('SELECT payee_key, cert_number, id FROM bir_2307_certificates WHERE direction = $1 AND year = $2 AND quarter = $3 AND status = \'issued\'',
    [direction, Number(year), Number(quarter)])).rows.map((c) => [c.payee_key, c]));
  const groups = new Map();
  for (const l of lines) {
    const g = groups.get(l.key) || { payeeKey: l.key, payeeName: l.name, tin: l.tin, transactions: 0, totalIncome: 0, totalTax: 0, atcs: new Set() };
    g.transactions += 1; g.totalIncome = round2(g.totalIncome + l.income); g.totalTax = round2(g.totalTax + l.tax); g.atcs.add(l.atc);
    groups.set(l.key, g);
  }
  return { direction, year: Number(year), quarter: Number(quarter), from, to, months,
    payees: [...groups.values()].map((g) => ({ ...g, atcs: [...g.atcs].filter(Boolean), certificateNumber: certs.get(g.payeeKey)?.cert_number || null, certificateId: certs.get(g.payeeKey)?.id || null }))
      .sort((a, b) => a.payeeName.localeCompare(b.payeeName)) };
}

/** Certificate data of one payee and quarter (live figures). */
export async function certificate2307(db, { year, quarter, direction = 'issued', payeeKey }) {
  const { from, to, months } = quarterRange(year, quarter);
  const lines = (await withholdingLines(db, direction, from, to)).filter((l) => l.key === payeeKey);
  if (!lines.length) throw notFound(`No withholding for ${payeeKey} in ${year} Q${quarter}`);
  // the broker: the primary company of the Company master (bir.* settings only when no company exists)
  const broker = await legalIdentity();
  const other = { name: lines[0].name, tin: lines[0].tin, address: lines[0].address, zip: '' };
  const rows = certificateLines(lines, months, await natures(db));
  const existing = (await db.query('SELECT cert_number, id, created_at FROM bir_2307_certificates WHERE direction = $1 AND payee_key = $2 AND year = $3 AND quarter = $4 AND status = \'issued\'',
    [direction, payeeKey, Number(year), Number(quarter)])).rows[0];
  return {
    direction, year: Number(year), quarter: Number(quarter), periodFrom: from, periodTo: to, months, payeeKey,
    payee: direction === 'issued' ? other : broker, payor: direction === 'issued' ? broker : other,
    lines: rows, totalIncome: round2(rows.reduce((s, r) => s + r.total, 0)), totalTax: round2(rows.reduce((s, r) => s + r.tax, 0)),
    transactions: lines.map((l) => ({ date: l.date, reference: l.reference, atc: l.atc, income: l.income, tax: l.tax })),
    certificateNumber: existing?.cert_number || null, certificateId: existing?.id || null, issuedAt: existing?.created_at || null,
  };
}

/** Issue (number and record) the certificate; an already issued one is returned unchanged. */
export async function issue2307(db, params, user) {
  const c = await certificate2307(db, params);
  if (c.certificateId) return { ...c, alreadyIssued: true };
  const number = await nextDocumentNumber('bir_2307');
  const row = (await db.query(`INSERT INTO bir_2307_certificates(cert_number, direction, payee_key, payee_name, payee_tin, payee_address, payor_name, payor_tin, payor_address,
      year, quarter, period_from, period_to, lines, total_income, total_tax, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id, cert_number, created_at`,
  [number, c.direction, c.payeeKey, c.payee.name, c.payee.tin, c.payee.address, c.payor.name, c.payor.tin, c.payor.address, c.year, c.quarter, c.periodFrom, c.periodTo,
    JSON.stringify(c.lines), c.totalIncome, c.totalTax, user?.id ?? null])).rows[0];
  return { ...c, certificateNumber: row.cert_number, certificateId: row.id, issuedAt: row.created_at, alreadyIssued: false };
}

export async function listCertificates(db, q = {}) {
  const rows = (await db.query(`SELECT * FROM bir_2307_certificates WHERE ($1::int IS NULL OR year = $1) AND ($2::int IS NULL OR quarter = $2) AND ($3::text IS NULL OR direction = $3)
    ORDER BY created_at DESC LIMIT 500`, [q.year ? Number(q.year) : null, q.quarter ? Number(q.quarter) : null, q.direction || null])).rows;
  return rows.map((c) => ({ id: c.id, certificateNumber: c.cert_number, direction: c.direction, payeeKey: c.payee_key, payeeName: c.payee_name, payeeTin: c.payee_tin,
    payorName: c.payor_name, year: c.year, quarter: c.quarter, periodFrom: iso(c.period_from), periodTo: iso(c.period_to), lines: c.lines,
    totalIncome: Number(c.total_income), totalTax: Number(c.total_tax), status: c.status, createdAt: c.created_at, cancelReason: c.cancel_reason }));
}

export async function cancelCertificate(db, id, user, reason) {
  const r = (await db.query(`UPDATE bir_2307_certificates SET status = 'cancelled', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3 WHERE id = $1 AND status = 'issued' RETURNING id`,
    [id, user.id, reason || null])).rows[0];
  if (!r) throw notFound('Issued certificate not found');
  return r;
}
