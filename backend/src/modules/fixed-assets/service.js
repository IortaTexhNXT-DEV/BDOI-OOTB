/**
 * Fixed asset register and depreciation (Accounts > Fixed Assets).
 *
 * An asset belongs to an asset class (master asset-class: useful life in months, salvage percent, asset / accumulated
 * depreciation / depreciation expense accounts, copied onto the asset when it is registered). Assets come from an
 * approved supplier invoice line with an asset class, or are registered by hand (with the accumulated depreciation
 * carried at go-live and the first period to depreciate here).
 *
 * Straight-line: (cost - salvage) / useful life per month, from the in-service month (fixed_assets.first_month =
 * in-service-month) or the month after (next-month); the last month takes the rounding so the asset ends at its salvage
 * value. The monthly run posts, per asset class, one journal of posting rule fa.depreciation dated the last day of the
 * period, and records each asset's amount (fixed_asset_depreciation); an asset is never depreciated twice for a period,
 * so a rerun posts only what is missing. The run is a step of the month-end close (fixed_assets.depreciation_in_month_end).
 *
 * Disposal (sale or write-off, migration 0321): the asset's cost and accumulated depreciation leave the books, the
 * proceeds (and the output VAT of a sale) come in, and the difference is the gain or loss on disposal: one journal of
 * posting rule fa.disposal. A sale also issues its BIR sales invoice (fixed_assets.disposal_sales_invoice). The asset
 * becomes disposed and is not depreciated again; a cancelled disposal reverses its journal and restores the asset.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { bankAccountGl, postEvent } from '../accounting/lib/posting.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { taxCodeRate } from '../accounting/lib/commissionTax.js';
import { activeRecord, activeRecords } from '../ops-masters/records.js';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
export const periodOfDate = (d) => String(d).slice(0, 7);
export const addPeriods = (p, n) => {
  const [y, m] = p.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const periodsBetween = (a, b) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
};
export const periodEnd = (p) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export const classes = async (db) => (await activeRecords(db, 'asset-class')).map((c) => ({ code: c.code, name: c.name, usefulLifeMonths: Number(c.usefulLifeMonths),
  salvagePercent: Number(c.salvagePercent || 0), assetAccount: c.assetAccount, accumulatedAccount: c.accumulatedAccount, expenseAccount: c.expenseAccount }));

/** First period an asset is depreciated in, from its in-service date. */
async function startPeriod(inService) {
  const rule = await getSetting('fixed_assets.first_month', 'in-service-month');
  return rule === 'next-month' ? addPeriods(periodOfDate(inService), 1) : periodOfDate(inService);
}

/**
 * Straight-line schedule of an asset: [{ period, amount, accumulated, bookValue }] over its whole life, plus the periods
 * already posted. Amounts before depreciate_from are covered by the opening accumulated depreciation.
 */
export function straightLine({ cost, salvage, lifeMonths, start }) {
  const base = round2(cost - salvage);
  const monthly = Math.floor((base / lifeMonths) * 100) / 100;
  const rows = [];
  let acc = 0;
  for (let k = 0; k < lifeMonths; k += 1) {
    const amount = k === lifeMonths - 1 ? round2(base - acc) : monthly;
    acc = round2(acc + amount);
    rows.push({ period: addPeriods(start, k), amount, accumulated: acc, bookValue: round2(cost - acc) });
  }
  return rows;
}

const SELECT = `SELECT f.*, m.name AS supplier_name, i.voucher_number, cls.name AS class_name,
  (SELECT COALESCE(sum(d.amount), 0) FROM fixed_asset_depreciation d WHERE d.asset_id = f.id) AS posted,
  (SELECT max(d.period) FROM fixed_asset_depreciation d WHERE d.asset_id = f.id) AS last_period
  FROM fixed_assets f LEFT JOIN master_records m ON m.id = f.supplier_id LEFT JOIN supplier_invoices i ON i.id = f.supplier_invoice_id
  LEFT JOIN master_records cls ON cls.type_code = 'asset-class' AND cls.code = f.class_code`;

const assetOut = (r) => {
  const accumulated = round2(Number(r.opening_accumulated) + Number(r.posted));
  return {
    id: r.id, assetNumber: r.asset_number, name: r.name, description: r.description, classCode: r.class_code, className: r.class_name || null, location: r.location, custodian: r.custodian,
    serialNumber: r.serial_number, supplierId: r.supplier_id, supplierName: r.supplier_name || null, supplierInvoiceId: r.supplier_invoice_id, supplierInvoiceVoucher: r.voucher_number || null,
    acquisitionDate: isoDate(r.acquisition_date), inServiceDate: isoDate(r.in_service_date), cost: Number(r.cost), salvageValue: Number(r.salvage_value), usefulLifeMonths: r.useful_life_months,
    method: r.method, assetAccount: r.asset_account, accumulatedAccount: r.accumulated_account, expenseAccount: r.expense_account, openingAccumulated: Number(r.opening_accumulated),
    depreciateFrom: r.depreciate_from, accumulatedDepreciation: accumulated, bookValue: round2(Number(r.cost) - accumulated), lastPeriod: r.last_period || null, status: r.status,
    disposalId: r.disposal_id || null, disposedOn: isoDate(r.disposed_on), createdAt: r.created_at,
  };
};

export async function listAssets(db, q = {}) {
  const params = [];
  const where = ['TRUE'];
  if (q.classCode) { params.push(q.classCode); where.push(`f.class_code = $${params.length}`); }
  if (q.status && q.status !== 'all') { params.push(q.status); where.push(`f.status = $${params.length}`); }
  if (q.search) { params.push(`%${q.search}%`); where.push(`(f.asset_number ILIKE $${params.length} OR f.name ILIKE $${params.length} OR f.serial_number ILIKE $${params.length} OR f.custodian ILIKE $${params.length})`); }
  const rows = (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY f.asset_number`, params)).rows.map(assetOut);
  const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
  return { summary: { assets: rows.length, cost: sum('cost'), accumulatedDepreciation: sum('accumulatedDepreciation'), bookValue: sum('bookValue') }, rows };
}

/** One asset with its depreciation schedule (planned and posted). */
export async function getAsset(db, ref) {
  const r = (await db.query(`${SELECT} WHERE f.id = $1 OR f.asset_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Fixed asset not found');
  const a = assetOut(r);
  const posted = new Map((await db.query(`SELECT d.*, j.jv_number FROM fixed_asset_depreciation d LEFT JOIN journal_vouchers j ON j.id = d.journal_id WHERE d.asset_id = $1`, [a.id])).rows
    .map((d) => [d.period, d]));
  const plan = straightLine({ cost: a.cost, salvage: a.salvageValue, lifeMonths: a.usefulLifeMonths, start: await startPeriod(a.inServiceDate) });
  const schedule = plan.map((p) => {
    const d = posted.get(p.period);
    const before = p.period < a.depreciateFrom;
    return { ...p, status: d ? 'posted' : before ? 'opening' : 'planned', postedAmount: d ? Number(d.amount) : null, journalNumber: d?.jv_number || null };
  });
  return { ...a, schedule };
}

/** Register an asset by hand. */
export async function createAsset(db, b, user, { supplierInvoiceId = null } = {}) {
  const cls = await activeRecord(db, 'asset-class', b.classCode);
  if (!cls) throw badRequest('Validation failed', [{ path: 'classCode', message: `Asset class ${b.classCode} is not active` }]);
  const cost = round2(b.cost);
  if (!(cost > 0)) throw badRequest('Validation failed', [{ path: 'cost', message: 'Cost must be greater than zero' }]);
  const acquisition = isoDate(b.acquisitionDate);
  const inService = isoDate(b.inServiceDate) || acquisition;
  if (!acquisition) throw badRequest('Validation failed', [{ path: 'acquisitionDate', message: 'Acquisition date is required' }]);
  const life = Number(b.usefulLifeMonths || cls.usefulLifeMonths);
  if (!Number.isInteger(life) || life < 1) throw badRequest('Validation failed', [{ path: 'usefulLifeMonths', message: 'Useful life (months) is required' }]);
  const salvage = round2(b.salvageValue ?? (cost * Number(cls.salvagePercent || 0)) / 100);
  const opening = round2(b.openingAccumulated || 0);
  if (opening > cost - salvage) throw badRequest('Validation failed', [{ path: 'openingAccumulated', message: 'Opening accumulated depreciation is more than the depreciable amount' }]);
  const start = await startPeriod(inService);
  const from = b.depreciateFrom && PERIOD.test(b.depreciateFrom) ? b.depreciateFrom : start;
  let supplierId = null;
  if (b.supplierId) supplierId = (await activeRecord(db, 'supplier', b.supplierId))?.id || null;
  const number = await nextDocumentNumber('fixed_asset', { db, unique: { table: 'fixed_assets', column: 'asset_number' } });
  const r = (await db.query(`INSERT INTO fixed_assets(asset_number, name, description, class_code, location, custodian, serial_number, supplier_id, supplier_invoice_id, acquisition_date,
      in_service_date, cost, salvage_value, useful_life_months, asset_account, accumulated_account, expense_account, opening_accumulated, depreciate_from, status, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21) RETURNING id`,
  [number, String(b.name || '').trim() || cls.name, b.description || null, cls.code, b.location || null, b.custodian || null, b.serialNumber || null, supplierId, supplierInvoiceId,
    acquisition, inService, cost, salvage, life, cls.assetAccount, cls.accumulatedAccount, cls.expenseAccount, opening, from,
    opening >= cost - salvage ? 'fully-depreciated' : 'active', user?.id ?? null])).rows[0];
  return getAsset(db, r.id);
}

/** Asset of an approved supplier invoice line with an asset class (cost = the line net of VAT). */
export async function registerFromInvoiceLine(db, inv, line, user) {
  const a = await createAsset(db, { name: line.description, classCode: line.asset_class, cost: Number(line.amount), acquisitionDate: isoDate(inv.invoice_date),
    inServiceDate: isoDate(inv.invoice_date), supplierId: inv.supplier_id }, user, { supplierInvoiceId: inv.id });
  await db.query('UPDATE supplier_invoice_lines SET fixed_asset_id = $2 WHERE id = $1', [line.id, a.id]);
  return a;
}

export async function updateAsset(db, id, b, user) {
  const before = await getAsset(db, id);
  await db.query(`UPDATE fixed_assets SET name = COALESCE($2, name), description = COALESCE($3, description), location = COALESCE($4, location), custodian = COALESCE($5, custodian),
    serial_number = COALESCE($6, serial_number), updated_by = $7, updated_at = now() WHERE id = $1`, [before.id, b.name || null, b.description ?? null, b.location ?? null, b.custodian ?? null,
    b.serialNumber ?? null, user?.id ?? null]);
  return { before, after: await getAsset(db, before.id) };
}

/** Depreciation each active asset is due for in a period (not yet posted), capped at what is left to depreciate. */
async function dueFor(db, period) {
  const assets = (await db.query(`${SELECT} WHERE f.status = 'active' AND f.depreciate_from <= $1
    AND NOT EXISTS (SELECT 1 FROM fixed_asset_depreciation d WHERE d.asset_id = f.id AND d.period = $1) ORDER BY f.class_code, f.asset_number`, [period])).rows.map(assetOut);
  const out = [];
  for (const a of assets) {
    const plan = straightLine({ cost: a.cost, salvage: a.salvageValue, lifeMonths: a.usefulLifeMonths, start: await startPeriod(a.inServiceDate) });
    const row = plan.find((p) => p.period === period);
    const left = round2(a.cost - a.salvageValue - a.accumulatedDepreciation);
    const amount = round2(Math.min(row ? row.amount : 0, left));
    if (amount > 0) out.push({ asset: a, amount, left });
  }
  return out;
}

/** Preview of the run of a period: what each asset would be depreciated, by class. */
export async function previewRun(db, period) {
  if (!PERIOD.test(String(period))) throw badRequest('Validation failed', [{ path: 'period', message: 'Period is YYYY-MM' }]);
  const due = await dueFor(db, period);
  const posted = (await db.query(`SELECT d.period, count(*)::int AS assets, COALESCE(sum(d.amount), 0) AS amount, string_agg(DISTINCT j.jv_number, ', ') AS journals
    FROM fixed_asset_depreciation d LEFT JOIN journal_vouchers j ON j.id = d.journal_id WHERE d.period = $1 GROUP BY d.period`, [period])).rows[0];
  return { period, date: periodEnd(period), due: due.map((d) => ({ assetId: d.asset.id, assetNumber: d.asset.assetNumber, name: d.asset.name, classCode: d.asset.classCode, amount: d.amount })),
    total: round2(due.reduce((s, d) => s + d.amount, 0)), posted: posted ? { assets: posted.assets, amount: Number(posted.amount), journals: posted.journals } : null };
}

/** Post the depreciation of a period: one fa.depreciation journal per asset class and accounts, dated the period end. */
export async function runDepreciation(db, period, { user = null, closeRunId = null } = {}) {
  if (!PERIOD.test(String(period))) throw badRequest('Validation failed', [{ path: 'period', message: 'Period is YYYY-MM' }]);
  if (periodEnd(period) > periodEnd(periodOfDate(await today()))) throw conflict(`Period ${period} has not started yet`);
  const due = await dueFor(db, period);
  const groups = new Map();
  for (const d of due) {
    const key = `${d.asset.classCode}|${d.asset.expenseAccount}|${d.asset.accumulatedAccount}`;
    groups.set(key, [...(groups.get(key) || []), d]);
  }
  const journals = [];
  const now = await today();
  const date = periodEnd(period) <= now ? periodEnd(period) : now;
  for (const list of groups.values()) {
    const a0 = list[0].asset;
    const amount = round2(list.reduce((s, d) => s + d.amount, 0));
    const jv = await postEvent('fa.depreciation', {
      date, source: 'fixed-assets', entryType: 'DEPRECIATION', transactionCode: `DEP-${period}-${a0.classCode}`, referenceType: 'FixedAssets', referenceId: period,
      description: `Depreciation ${period} – ${a0.className || a0.classCode} (${list.length} asset${list.length === 1 ? '' : 's'})`, amounts: { amount },
      accounts: { expense: a0.expenseAccount, accumulated: a0.accumulatedAccount }, vars: { period, assetClass: a0.className || a0.classCode },
    }, { db, user });
    for (const d of list) {
      const acc = round2(d.asset.accumulatedDepreciation + d.amount);
      await db.query(`INSERT INTO fixed_asset_depreciation(asset_id, period, amount, accumulated_after, book_value_after, journal_id, close_run_id, posted_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [d.asset.id, period, d.amount, acc, round2(d.asset.cost - acc), jv.id, closeRunId, user?.id ?? null]);
      if (d.amount >= d.left - 0.005) await db.query('UPDATE fixed_assets SET status = \'fully-depreciated\', updated_at = now() WHERE id = $1', [d.asset.id]);
    }
    journals.push({ journalId: jv.id, journalNumber: jv.jv_number, classCode: a0.classCode, assets: list.length, amount });
  }
  return { period, assets: due.length, amount: round2(journals.reduce((s, j) => s + j.amount, 0)), journals };
}

/** The month-end close step: the period's depreciation, unless fixed_assets.depreciation_in_month_end is off. */
export async function depreciationStep(db, periodRow, { user = null, runId = null } = {}) {
  if ((await getSetting('fixed_assets.depreciation_in_month_end', true)) === false) return { status: 'skipped', message: 'Depreciation is not part of the close (fixed_assets.depreciation_in_month_end)' };
  const r = await runDepreciation(db, periodRow.period, { user, closeRunId: runId });
  const done = await previewRun(db, periodRow.period);
  return { status: 'done', amount: done.posted ? done.posted.amount : 0, journals: r.journals.map((j) => j.journalId),
    message: r.assets ? `${r.assets} asset(s) depreciated, ${r.amount.toFixed(2)} posted` : `Nothing left to depreciate${done.posted ? ` (${done.posted.assets} asset(s) already posted, ${done.posted.amount.toFixed(2)})` : ''}`,
    detail: r.journals };
}

// ---------------------------------------------------------------- disposal

const DISPOSAL_SELECT = `SELECT d.*, f.asset_number, f.name AS asset_name, f.class_code, cls.name AS class_name, j.jv_number, rj.jv_number AS reversal_jv_number,
  si.invoice_number, si.status AS invoice_status, si.balance AS invoice_balance, u.display_name AS created_by_name
  FROM fixed_asset_disposals d JOIN fixed_assets f ON f.id = d.asset_id
  LEFT JOIN master_records cls ON cls.type_code = 'asset-class' AND cls.code = f.class_code
  LEFT JOIN journal_vouchers j ON j.id = d.journal_id LEFT JOIN journal_vouchers rj ON rj.id = d.reversal_journal_id
  LEFT JOIN sales_invoices si ON si.id = d.sales_invoice_id LEFT JOIN users u ON u.id = d.created_by`;

const disposalOut = (d) => d && ({
  id: d.id, disposalNumber: d.disposal_number, assetId: d.asset_id, assetNumber: d.asset_number, assetName: d.asset_name, classCode: d.class_code, className: d.class_name || null,
  disposalDate: isoDate(d.disposal_date), disposalType: d.disposal_type, reason: d.reason, buyerName: d.buyer_name, buyerTin: d.buyer_tin, buyerAddress: d.buyer_address,
  cost: Number(d.cost), accumulatedDepreciation: Number(d.accumulated_depreciation), bookValue: Number(d.book_value), proceeds: Number(d.proceeds), vatCode: d.vat_code,
  outputVat: Number(d.output_vat), grossProceeds: Number(d.gross_proceeds), gainLoss: Number(d.gain_loss), bankAccount: d.bank_account, journalId: d.journal_id,
  journalNumber: d.jv_number || null, salesInvoiceId: d.sales_invoice_id, salesInvoiceNumber: d.invoice_number || null, salesInvoiceStatus: d.invoice_status || null,
  amountDue: d.invoice_balance === null || d.invoice_balance === undefined ? null : Number(d.invoice_balance), status: d.status, reversalJournalNumber: d.reversal_jv_number || null,
  cancelReason: d.cancel_reason, cancelledAt: d.cancelled_at, createdBy: d.created_by_name || d.created_by, createdAt: d.created_at,
});

export async function getDisposal(db, ref) {
  const d = (await db.query(`${DISPOSAL_SELECT} WHERE d.id = $1 OR d.disposal_number = $1`, [String(ref)])).rows[0];
  if (!d) throw notFound('Disposal not found');
  return disposalOut(d);
}

/** Disposal register: disposals of a period (from, to), type, status, class, search; with totals of the posted ones. */
export async function listDisposals(db, q = {}) {
  const params = [];
  const where = ['TRUE'];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.from) add('d.disposal_date >= ?::date', q.from);
  if (q.to) add('d.disposal_date <= ?::date', q.to);
  if (q.disposalType) add('d.disposal_type = ?', q.disposalType);
  if (q.status && q.status !== 'all') add('d.status = ?', q.status);
  if (q.classCode) add('f.class_code = ?', q.classCode);
  if (q.search) add("(d.disposal_number ILIKE '%' || ? || '%' OR f.asset_number ILIKE '%' || ? || '%' OR f.name ILIKE '%' || ? || '%' OR d.buyer_name ILIKE '%' || ? || '%')", q.search);
  const rows = (await db.query(`${DISPOSAL_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.disposal_date DESC, d.disposal_number DESC LIMIT 2000`, params)).rows.map(disposalOut);
  const posted = rows.filter((r) => r.status === 'posted');
  const sum = (k) => round2(posted.reduce((t, r) => t + r[k], 0));
  return { summary: { disposals: posted.length, cost: sum('cost'), accumulatedDepreciation: sum('accumulatedDepreciation'), bookValue: sum('bookValue'), proceeds: sum('proceeds'),
    outputVat: sum('outputVat'), gain: round2(posted.filter((r) => r.gainLoss > 0).reduce((t, r) => t + r.gainLoss, 0)),
    loss: round2(-posted.filter((r) => r.gainLoss < 0).reduce((t, r) => t + r.gainLoss, 0)) }, rows };
}

/** Periods of the asset's schedule before the disposal month that are not depreciated yet (posted or covered by the opening balance). */
async function unpostedBefore(db, a, date) {
  const plan = straightLine({ cost: a.cost, salvage: a.salvageValue, lifeMonths: a.usefulLifeMonths, start: await startPeriod(a.inServiceDate) });
  const posted = new Set((await db.query('SELECT period FROM fixed_asset_depreciation WHERE asset_id = $1', [a.id])).rows.map((r) => r.period));
  return plan.filter((p) => p.period < periodOfDate(date) && p.period >= a.depreciateFrom && !posted.has(p.period)).map((p) => p.period);
}

/**
 * Figures of a disposal before it is posted: cost, accumulated depreciation, book value, output VAT on a sale, gain or
 * loss, and the depreciation periods still to post. b: { disposalType, disposalDate, proceeds }.
 */
export async function previewDisposal(db, assetRef, b = {}) {
  const a = await getAsset(db, assetRef);
  const date = isoDate(b.disposalDate) || (await today());
  const type = b.disposalType === 'write-off' ? 'write-off' : 'sale';
  const proceeds = type === 'sale' ? round2(b.proceeds || 0) : 0;
  const registered = (await getSetting('direct_bill.broker_vat_registered', true)) !== false;
  const vatCode = type === 'sale' && registered && proceeds > 0 ? await getSetting('fixed_assets.disposal_vat_code', 'VAT12-OUT') : null;
  const vat = vatCode ? await taxCodeRate(db, vatCode) : null;
  const outputVat = vat ? round2(proceeds * vat.rate) : 0;
  return { assetId: a.id, assetNumber: a.assetNumber, assetName: a.name, status: a.status, disposalDate: date, disposalType: type, cost: a.cost,
    accumulatedDepreciation: a.accumulatedDepreciation, bookValue: a.bookValue, proceeds, vatCode, vatGlAccount: vat?.glAccount || null, outputVat,
    grossProceeds: round2(proceeds + outputVat), gainLoss: round2(proceeds - a.bookValue), unpostedPeriods: a.status === 'disposed' ? [] : await unpostedBefore(db, a, date),
    asset: a };
}

/** Dispose of an asset (sale or write-off): fa.disposal journal, the sale's sales invoice, the asset disposed. */
export async function disposeAsset(db, assetRef, b, user) {
  const lock = (await db.query('SELECT id FROM fixed_assets WHERE id = $1 OR asset_number = $1 FOR UPDATE', [String(assetRef)])).rows[0];
  if (!lock) throw notFound('Fixed asset not found');
  const p = await previewDisposal(db, lock.id, b);
  const a = p.asset;
  const errors = [];
  if (a.status === 'disposed') throw conflict(`Asset ${a.assetNumber} is already disposed`);
  const now = await today();
  const back = Number(await getSetting('fixed_assets.disposal_backdate_days', 60)) || 0;
  if (p.disposalDate > now) errors.push({ path: 'disposalDate', message: 'The disposal date is in the future' });
  else if (back && p.disposalDate < addDays(now, -back)) errors.push({ path: 'disposalDate', message: `A disposal can be dated up to ${back} days back (fixed_assets.disposal_backdate_days)` });
  if (p.disposalDate < a.acquisitionDate) errors.push({ path: 'disposalDate', message: 'The disposal date is before the asset was acquired' });
  if (p.disposalType === 'sale') {
    if (!(p.proceeds > 0)) errors.push({ path: 'proceeds', message: 'Enter the selling price (net of VAT); an asset given away is written off' });
    if (!String(b.buyerName || '').trim()) errors.push({ path: 'buyerName', message: 'Enter the buyer' });
  }
  if (p.disposalType === 'write-off' && !String(b.reason || '').trim()) errors.push({ path: 'reason', message: 'Give the reason for the write-off (lost, damaged beyond repair, obsolete...)' });
  if (errors.length) throw badRequest('Validation failed', errors);
  if (p.unpostedPeriods.length && (await getSetting('fixed_assets.disposal_requires_depreciation_to_date', true)) !== false) {
    throw conflict(`Post the depreciation of ${p.unpostedPeriods.join(', ')} first (Accounts > Fixed Assets > Depreciation Run): the asset is disposed at its book value after depreciation up to the month before the disposal`);
  }
  let bankGl = null;
  if (p.disposalType === 'sale' && b.bankAccount) {
    bankGl = await bankAccountGl(db, b.bankAccount);
    if (!bankGl) throw badRequest('Validation failed', [{ path: 'bankAccount', message: `${b.bankAccount} is not a bank account of the Bank Account master` }]);
  }
  const number = await nextDocumentNumber('asset_disposal', { db, date: p.disposalDate, unique: { table: 'fixed_asset_disposals', column: 'disposal_number' } });
  const buyer = p.disposalType === 'sale' ? String(b.buyerName).trim() : null;
  const jv = await postEvent('fa.disposal', {
    date: p.disposalDate, source: 'fixed-assets', entryType: 'ASSET_DISPOSAL', transactionCode: number, referenceType: 'FixedAssetDisposal', referenceId: a.id,
    description: `${p.disposalType === 'sale' ? 'Sale' : 'Write-off'} of ${a.assetNumber} ${a.name} (${number})`,
    amounts: { cost: a.cost, accumulated: a.accumulatedDepreciation, receivable: p.grossProceeds, vat: p.outputVat, gain: p.gainLoss > 0 ? p.gainLoss : 0, loss: p.gainLoss < 0 ? -p.gainLoss : 0 },
    accounts: { asset: a.assetAccount, accumulated: a.accumulatedAccount, ...(bankGl ? { proceeds: bankGl } : {}), ...(p.vatGlAccount ? { vat: p.vatGlAccount } : {}) },
    vars: { disposalNumber: number, assetNumber: a.assetNumber, assetName: a.name, buyer: buyer ? `– ${buyer}` : '' },
  }, { db, user });
  const d = (await db.query(`INSERT INTO fixed_asset_disposals(disposal_number, asset_id, disposal_date, disposal_type, reason, buyer_name, buyer_tin, buyer_address, cost, accumulated_depreciation,
      book_value, proceeds, vat_code, output_vat, gross_proceeds, gain_loss, bank_account, journal_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
  [number, a.id, p.disposalDate, p.disposalType, b.reason || null, buyer, b.buyerTin || null, b.buyerAddress || null, a.cost, a.accumulatedDepreciation, a.bookValue, p.proceeds, p.vatCode,
    p.outputVat, p.grossProceeds, p.gainLoss, bankGl ? String(b.bankAccount) : null, jv.id, user?.id ?? null])).rows[0];
  await db.query(`UPDATE fixed_assets SET status_before_disposal = status, status = 'disposed', disposed_on = $2, disposal_remarks = $3, disposal_id = $4, updated_by = $5, updated_at = now()
    WHERE id = $1`, [a.id, p.disposalDate, b.reason || (buyer ? `Sold to ${buyer}` : null), d.id, user?.id ?? null]);
  const invoiceOn = b.issueSalesInvoice ?? ((await getSetting('fixed_assets.disposal_sales_invoice', true)) !== false);
  if (p.disposalType === 'sale' && invoiceOn) {
    const { issueInvoice } = await import('../bir/invoices.js');
    const inv = await issueInvoice(db, { sourceType: 'asset_disposal', sourceId: d.id, invoiceDate: p.disposalDate, remarks: b.reason || null }, user);
    await db.query('UPDATE fixed_asset_disposals SET sales_invoice_id = $2 WHERE id = $1', [d.id, inv.id]);
  }
  return getDisposal(db, d.id);
}

/** Cancel a disposal: its sales invoice cancelled (refused when a payment is recorded on it), its journal reversed, the asset restored. */
export async function cancelDisposal(db, ref, reason, user) {
  const d = (await db.query('SELECT * FROM fixed_asset_disposals WHERE id = $1 OR disposal_number = $1 FOR UPDATE', [String(ref)])).rows[0];
  if (!d) throw notFound('Disposal not found');
  if (d.status !== 'posted') throw conflict(`Disposal ${d.disposal_number} is ${d.status}`);
  if (d.sales_invoice_id) {
    const inv = (await db.query('SELECT status FROM sales_invoices WHERE id = $1', [d.sales_invoice_id])).rows[0];
    if (inv?.status === 'issued') {
      const { cancelInvoice } = await import('../bir/invoices.js');
      await cancelInvoice(db, d.sales_invoice_id, `Disposal ${d.disposal_number} cancelled: ${reason}`, user);
    }
  }
  const rev = await reverseJournal(db, d.journal_id, user, { description: `Cancellation of disposal ${d.disposal_number}: ${reason}` });
  await db.query(`UPDATE fixed_asset_disposals SET status = 'cancelled', reversal_journal_id = $2, cancelled_by = $3, cancelled_at = now(), cancel_reason = $4 WHERE id = $1`,
    [d.id, rev.id, user?.id ?? null, reason]);
  await db.query(`UPDATE fixed_assets SET status = COALESCE(status_before_disposal, 'active'), status_before_disposal = NULL, disposed_on = NULL, disposal_remarks = NULL, disposal_id = NULL,
    updated_by = $2, updated_at = now() WHERE id = $1`, [d.asset_id, user?.id ?? null]);
  return getDisposal(db, d.id);
}
