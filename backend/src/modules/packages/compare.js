/**
 * Quick Quote > Compare Insurers: the instant multi-carrier matrix of a package product. Every insurer with a rate
 * table in force for the product is priced on the same sum insured and location: premium, taxes and charges (premium
 * charges engine), total, deductible, key benefits and, for staff only, the commission. The client copy (PDF on the
 * company letterhead) never shows the commission. The chosen insurer becomes a quotation priced with the engine.
 */
import { withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { chargesFor, lguFor, productTaxProfile, rulesInForce } from '../premium-charges/service.js';
import { resolveCommissionRate } from '../commission-rates/resolve.js';
import { resolveLob } from '../placement/journey.js';
import { createQuote } from '../quotations/service.js';
import { premiumOnRate, rateTablesInForce } from './rateTables.js';

/** Commission rate of an insurer on a product: the rate table's, else the Commission Rate Matrix (with its fallbacks). */
export async function commissionRateFor({ rateTable = null, insurerId, productId, lob, date, renewal = false }, db = null) {
  if (rateTable && rateTable.commissionRate !== null && rateTable.commissionRate !== undefined) return { rate: rateTable.commissionRate, source: 'rate-table' };
  const r = await resolveCommissionRate({ insurerId, productId, lob: lob ? String(lob).toLowerCase() : null, policyType: renewal ? 'renewal' : 'new', date, db });
  return { rate: r.rate, source: r.source };
}

/**
 * The comparison of a product: { product, sumInsured, date, lgu, columns: [...] (cheapest total first), cheapestId }.
 * body: { productId, sumInsured, lguCode | city, date, insurerIds (optional filter) }.
 */
export async function compareInsurers({ productId, sumInsured, lguCode = null, city = null, date = null, insurerIds = null }, db = null) {
  const on = date || (await today());
  const profile = await productTaxProfile(productId, db);
  if (!profile.productId) throw badRequest('Validation failed', [{ path: 'productId', message: `Product ${productId} not found` }]);
  const si = round2(sumInsured);
  if (!(si > 0)) throw badRequest('Validation failed', [{ path: 'sumInsured', message: 'The sum insured must be greater than zero' }]);
  const lob = await resolveLob({ productId: profile.productId }, db);
  const rules = await rulesInForce(on, db);
  const lgu = await lguFor({ lguCode, city }, on, db);
  if ((lguCode || city) && !lgu) throw badRequest('Validation failed', [{ path: 'lguCode', message: `No LGU tax rate in force for ${lguCode || city}` }]);
  let tables = await rateTablesInForce(db, profile.productId, on);
  if (Array.isArray(insurerIds) && insurerIds.length) tables = tables.filter((t) => insurerIds.map(Number).includes(t.insuranceCompanyId));
  const columns = [];
  for (const t of tables) {
    const p = premiumOnRate(t, si);
    const c = await chargesFor({ premium: p.premium, productId: profile.productId, date: on, rules, lgu }, db);
    const commission = await commissionRateFor({ rateTable: t, insurerId: t.insuranceCompanyId, productId: profile.productId, lob, date: on }, db);
    columns.push({
      insuranceCompanyId: t.insuranceCompanyId, insurerName: t.insurerName, insurerCode: t.insurerCode, rateTableId: t.id, rateBasis: t.rateBasis, rate: t.rate,
      computedPremium: p.computed, minimumPremium: t.minimumPremium, minimumApplied: p.minimumApplied, premium: p.premium,
      vat: c.vat, premiumTax: c.premiumTax, dst: c.dst, fst: c.fst, lgt: c.lgt, otherCharges: c.other, taxes: c.taxes, totalCharges: c.totalCharges, total: c.total,
      charges: c.lines, deductible: t.deductible, deductibleAmount: t.deductibleAmount, keyBenefits: t.keyBenefits, effectiveFrom: t.effectiveFrom, effectiveTo: t.effectiveTo,
      commissionRate: commission.rate, commissionSource: commission.source, commissionAmount: round2(p.premium * commission.rate),
    });
  }
  columns.sort((a, b) => a.total - b.total || a.insurerName.localeCompare(b.insurerName));
  return {
    product: { id: profile.productId, code: profile.code, name: profile.name, line: profile.line, lob, taxRegime: profile.regime },
    sumInsured: si, date: on, lgu: lgu ? { code: lgu.code, name: lgu.name, rate: lgu.rate } : null, currency: await getSetting('currency.default', 'PHP'),
    columns, cheapestId: columns[0]?.insuranceCompanyId ?? null,
  };
}

/** The client view of a comparison: no commission figures. */
export function clientView(result) {
  return { ...result, columns: result.columns.map(({ commissionRate: _r, commissionSource: _s, commissionAmount: _a, ...rest }) => rest) };
}

const money = (v) => round2(v);

/**
 * PDF spec of the comparison for the client (letterhead, one column per insurer). The commission is never printed.
 * `selected` limits the columns to some insurers; `preparedFor` names the client.
 */
export async function comparisonPdfSpec(result, { preparedFor = null, selected = null } = {}) {
  const view = clientView(result);
  let cols = view.columns;
  if (Array.isArray(selected) && selected.length) cols = cols.filter((c) => selected.map(Number).includes(c.insuranceCompanyId));
  if (!cols.length) throw badRequest('No insurer to print: the product has no rate table in force for the insurers chosen');
  const row = (label, pick) => [label, ...cols.map(pick)];
  const rows = [
    row('Premium', (c) => money(c.premium)),
    row(result.product.taxRegime === 'premium_tax' ? 'Premium Tax' : 'Value Added Tax', (c) => money(c.vat + c.premiumTax)),
    row('Documentary Stamp Tax', (c) => money(c.dst)),
    row('Fire Service Tax', (c) => money(c.fst)),
    row('Local Government Tax', (c) => money(c.lgt)),
    row('Other charges', (c) => money(c.otherCharges)),
    row('Total amount due', (c) => money(c.total)),
    row('Deductible', (c) => c.deductible || '-'),
  ];
  const benefits = cols.map((c) => ({ heading: `${c.insurerName}: key benefits`, text: (c.keyBenefits || []).length ? c.keyBenefits.map((b) => `- ${b}`).join('\n') : 'As per the policy wording' }));
  return {
    title: 'Insurer Comparison',
    subtitle: result.product.name,
    meta: [['Product', result.product.name], ['Sum insured', `${result.currency} ${money(result.sumInsured).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Location', result.lgu ? `${result.lgu.name} (LGT ${result.lgu.rate}%)` : '-'], ['Date', result.date], ...(preparedFor ? [['Prepared for', preparedFor]] : [])],
    orientation: cols.length > 3 ? 'landscape' : 'portrait',
    sections: [
      { heading: 'Premium and charges', table: { columns: ['', ...cols.map((c) => c.insurerName)], rows } },
      ...benefits,
      { note: String(await getSetting('packages.comparison_disclaimer', '')) || 'Premiums are indicative.' },
    ],
  };
}

export async function comparisonPdf(result, opts = {}, ctx = {}) {
  return renderPdf(await comparisonPdfSpec(result, opts), ctx);
}

/**
 * Proceed with one insurer: a quotation for the lead or client priced with the charge engine (premium from the insurer's
 * rate table, taxes by product, location and date). Returns the quotation row.
 */
export async function quotationFromComparison(body, user) {
  const result = await compareInsurers({ productId: body.productId, sumInsured: body.sumInsured, lguCode: body.lguCode, city: body.city, date: body.date, insurerIds: [body.insuranceCompanyId] });
  const col = result.columns[0];
  if (!col) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'The insurer has no rate table in force for this product' }]);
  return withTransaction(async (db) => {
    const quote = await createQuote({
      leadRefId: body.leadRefId || undefined, clientId: body.clientId || undefined, productType: result.product.name, lob: result.product.lob, productId: result.product.id,
      insuranceCompanyId: col.insuranceCompanyId, insuranceCompanyName: col.insurerName, participantDetails: [{ insuranceCompanyId: col.insuranceCompanyId }],
      totalSumInsured: result.sumInsured, netPremium: col.premium, agreedNetPremium: col.premium, commissionRate: col.commissionRate, chargeEngine: true,
      lguCode: result.lgu?.code || null, deductible: col.deductible, keyBenefits: col.keyBenefits, remarks: body.remarks || null,
      comparison: { rateTableId: col.rateTableId, rateBasis: col.rateBasis, rate: col.rate, date: result.date, insurersCompared: body.insurersCompared ?? null },
    }, user.id, db);
    await db.query('UPDATE quotes SET product_id = $2 WHERE id = $1', [quote.id, result.product.id]);
    return (await db.query('SELECT id, quote_number, premium_total FROM quotes WHERE id = $1', [quote.id])).rows[0];
  });
}
