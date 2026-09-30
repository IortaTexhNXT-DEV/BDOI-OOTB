/**
 * Package policies: issuance of a package quotation under ONE policy number (series package_policy) with its sections
 * underneath, section endorsements and the renewal of the whole package.
 *
 * Issuance goes through policies/service.js#issuePolicy (policy row, bill, booking journal, commission accrual, credit
 * limit warning) with:
 *   - one participant per insurer (risk_participants), share = the insurer's part of the gross premium, and then the
 *     exact premium, taxes, gross and commission of that insurer's sections, so remittance and insurer reconciliation
 *     read each carrier's own amounts;
 *   - the booking split per insurer (packageSplit): each insurer's gross, commission, premium taxes (VAT, DST, LGT in
 *     their accounts when accounting.split_premium_taxes is on), commission VAT / EWT and premium due, posted through
 *     the posting rule of the event with its per-participant lines (one journal, lines per insurer).
 * The lead insurer (policy insurer) is the one with the largest gross premium. Packages are broker billed.
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, today, isoDate } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { SCOPE, scopeSql } from '../../lib/scope.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { issuePolicy } from '../policies/service.js';
import { clientFromLead } from '../clients/service.js';
import { findPolicy, createReceivable } from '../receipts/receivables.js';
import { commissionTaxSetup, commissionTaxes, ratesOf } from '../accounting/lib/commissionTax.js';
import { splitTaxes } from '../accounting/lib/posting.js';
import { chargesFor } from '../premium-charges/service.js';
import { getBundle } from './bundles.js';
import { premiumOnRate } from './rateTables.js';
import { createPackageQuote, getQuoteRow, getPackageQuote, sectionsOf, writeSections, quoteOut } from './bundleQuotes.js';

/** Default note on comparisons and bundle schedules (setting packages.comparison_disclaimer). */
const DISCLAIMER = "Premiums are indicative and subject to the insurer's acceptance of the risk, the policy wording and the final underwriting information.";

const run = (db) => db || { query };
const addMonths = (d, m) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

/** Amounts per insurer of priced sections (lead = largest gross first), with shares totalling exactly 100%. */
export function insurerTotals(sections) {
  const map = new Map();
  for (const s of sections) {
    const cur = map.get(s.insuranceCompanyId) || { insuranceCompanyId: s.insuranceCompanyId, insurerName: s.insurerName, sumInsured: 0, netPremium: 0, vat: 0, dst: 0, lgt: 0,
      fst: 0, premiumTax: 0, otherCharges: 0, totalCharges: 0, totalAmount: 0, commissionAmount: 0, sections: [] };
    for (const k of ['sumInsured', 'netPremium', 'vat', 'dst', 'lgt', 'fst', 'premiumTax', 'otherCharges', 'totalCharges', 'totalAmount', 'commissionAmount']) cur[k] = round2(cur[k] + (Number(s[k]) || 0));
    cur.sections.push(s.sectionNo);
    map.set(s.insuranceCompanyId, cur);
  }
  const list = [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount || a.insuranceCompanyId - b.insuranceCompanyId);
  const gross = round2(list.reduce((s, x) => s + x.totalAmount, 0));
  let others = 0;
  list.forEach((x, i) => {
    x.isLead = i === 0;
    if (i > 0) { x.sharePercent = gross ? Math.round((x.totalAmount / gross) * 1e6) / 1e4 : 0; others += x.sharePercent; }
  });
  if (list[0]) list[0].sharePercent = Math.round((100 - others) * 1e4) / 1e4;
  return list;
}

/**
 * Booking split of a package bill in the shape of receipts/receivables.js#premiumSplit: per insurer its gross, own
 * commission, premium taxes, commission taxes and premium due. `groups` come from insurerTotals().
 */
export async function packageSplit(db, groups) {
  const split = await splitTaxes();
  const rates = ratesOf(await commissionTaxSetup(db));
  const parts = groups.map((g) => {
    const gross = round2(g.totalAmount);
    const commission = round2(Math.min(g.commissionAmount, gross));
    const ctax = commissionTaxes(commission, rates);
    let t = split ? { vat: round2(g.vat), dst: round2(g.dst), lgt: round2(g.lgt) } : { vat: 0, dst: 0, lgt: 0 };
    if (t.vat < 0 || t.dst < 0 || t.lgt < 0 || round2(t.vat + t.dst + t.lgt) > round2(gross - commission - ctax.commission_vat)) t = { vat: 0, dst: 0, lgt: 0 };
    const due = round2(gross - commission - t.vat - t.dst - t.lgt - ctax.commission_vat + ctax.commission_ewt);
    return { insurerId: g.insuranceCompanyId, insurerName: g.insurerName || 'insurer', share: g.sharePercent, isLead: g.isLead,
      amounts: { gross, commission, ...t, ...ctax, due_to_insurer: due } };
  });
  const sum = (f) => round2(parts.reduce((s, p) => s + f(p.amounts), 0));
  return {
    coInsured: parts.length > 1, commission: sum((a) => a.commission), taxes: { vat: sum((a) => a.vat), dst: sum((a) => a.dst), lgt: sum((a) => a.lgt) },
    commissionTaxes: { commission_vat: sum((a) => a.commission_vat), commission_ewt: sum((a) => a.commission_ewt) }, parts,
  };
}

/** Write the exact amounts of each insurer on the policy's participant rows. */
async function exactParticipants(db, policyId, groups) {
  for (const g of groups) {
    await db.query(`UPDATE risk_participants SET sum_insured = $3, premium = $4, taxes = $5, premium_total = $6, commission_amount = $7, commission_rate = $8, share_percent = $9, is_lead = $10
      WHERE entity_type = 'policy' AND entity_id = $1 AND insurance_company_id = $2`,
    [policyId, g.insuranceCompanyId, g.sumInsured, g.netPremium, g.totalCharges, g.totalAmount, g.commissionAmount, g.netPremium ? Math.round((g.commissionAmount / g.netPremium) * 1e4) / 1e4 : 0,
      g.sharePercent, g.isLead]);
  }
}

/**
 * Issue a package quotation (draft or accepted). body: { inceptionDate, insuredName, allowExpired }. Returns
 * { policyId, policyNumber, billNumber, quote }.
 */
export async function issuePackageQuote(id, body, user, { scope = null, db: outer = null } = {}) {
  const go = async (db) => {
    const found = await getQuoteRow(id, db, scope);
    const q = (await db.query('SELECT * FROM package_quotes WHERE id = $1 FOR UPDATE', [found.id])).rows[0];
    if (q.status === 'issued') throw conflict(`Package quotation ${q.quote_number} is already issued (policy ${found.policy_number})`);
    if (!['draft', 'accepted'].includes(q.status)) throw badRequest(`A ${q.status} package quotation cannot be issued`);
    if (!body.allowExpired && q.valid_until && String(q.valid_until) < (await today())) throw badRequest(`Package quotation ${q.quote_number} expired on ${q.valid_until}: re-quote it`);
    const bundle = await getBundle(q.bundle_id, db);
    const sections = await sectionsOf('quote', q.id, db);
    if (!sections.length) throw badRequest('The package quotation has no section');
    const clientId = q.client_id || (q.lead_id ? await clientFromLead(db, q.lead_id, {}, q.created_by || user?.id) : null);
    if (!clientId) throw badRequest('The package quotation has no client or prospect to insure');
    const groups = insurerTotals(sections);
    const lead = groups[0];
    const inception = isoDate(body.inceptionDate) || isoDate(q.inception_date) || (await today());
    const policyNumber = await nextDocumentNumber('package_policy', { db, unique: { table: 'policies', column: 'policy_number' } });
    const net = Number(q.net_premium);
    const commission = Number(q.commission_amount);
    const pkg = { bundleId: bundle.id, bundleCode: bundle.code, bundleName: bundle.name, packageQuoteId: q.id, packageQuoteNumber: q.quote_number, lguCode: q.lgu_code,
      discountPercent: Number(q.discount_percent), sections: sections.length, insurers: groups.map((g) => ({ insuranceCompanyId: g.insuranceCompanyId, insurerName: g.insurerName, sections: g.sections })) };
    const issued = await issuePolicy(db, {
      quoteId: null, clientId, leadId: q.lead_id, productId: null, insuranceCompanyId: lead.insuranceCompanyId, ownerUserId: q.owner_user_id || q.created_by,
      agentUserId: q.owner_user_id || q.created_by, sumInsured: Number(q.sum_insured), netPremium: net, grossPremium: Number(q.total_amount), commissionAmount: commission,
      commissionRate: net ? Math.round((commission / net) * 1e6) / 1e6 : 0, currency: q.currency, insuredName: body.insuredName || q.insured_name, productType: bundle.name,
      lob: 'PACKAGE', taxes: Number(q.total_charges),
      doc: { package: pkg, valueAddedTax: Number(q.vat), documentaryStampTax: Number(q.dst), localGovernmentTax: Number(q.lgt), fireServiceTax: Number(q.fst),
        premiumTax: Number(q.premium_tax), otherCharges: Number(q.other_charges), discount: Number(q.discount_amount), charges: q.doc?.charges || [], source: 'package' },
      participants: groups.map((g) => ({ insuranceCompanyId: g.insuranceCompanyId, sharePercent: g.sharePercent, isLead: g.isLead, commissionRate: null, insurerReference: null })),
      split: await packageSplit(db, groups),
    }, { policyNumber, inception, expiry: addMonths(inception, bundle.termMonths || 12), billingMode: 'broker', insuredName: body.insuredName || q.insured_name || undefined }, user?.id ?? null);
    await exactParticipants(db, issued.policyId, groups);
    await writeSections(db, 'policy', issued.policyId, sections);
    await db.query('UPDATE policies SET details = details || $2::jsonb WHERE id = $1', [issued.policyId, JSON.stringify({ package: pkg })]);
    if (issued.receivable?.id) {
      await db.query('UPDATE receivables SET other_charges = $2 WHERE id = $1', [issued.receivable.id, round2(Number(q.fst) + Number(q.premium_tax) + Number(q.other_charges))]);
    }
    if (q.renewal_of) {
      const old = (await db.query('SELECT id, policy_number, status, renewed_to FROM policies WHERE id = $1 FOR UPDATE', [q.renewal_of])).rows[0];
      if (old?.renewed_to) throw conflict(`Policy ${old.policy_number} has already been renewed`);
      await db.query('UPDATE policies SET renewed_from = $2, details = details || $3::jsonb WHERE id = $1', [issued.policyId, q.renewal_of,
        JSON.stringify({ businessType: 'Renewal', renewal: { previousPolicyId: q.renewal_of, previousPolicyNumber: old?.policy_number || null, packageQuoteId: q.id } })]);
      await db.query("UPDATE policies SET status = 'renewed', renewed_to = $2, updated_by = $3, updated_at = now() WHERE id = $1", [q.renewal_of, issued.policyId, user?.id ?? null]);
    }
    await db.query("UPDATE package_quotes SET status = 'issued', policy_id = $2, client_id = $3, updated_by = $4 WHERE id = $1", [q.id, issued.policyId, clientId, user?.id ?? null]);
    return { policyId: issued.policyId, policyNumber, billNumber: issued.receivable?.bill_number || null, creditWarning: issued.creditWarning || null, quote: await getPackageQuote(q.id, { db }) };
  };
  return outer ? go(outer) : withTransaction(go);
}

// ------------------------------------------------------------------ package policies

const POLICY_SELECT = `SELECT p.id, p.policy_number, p.status, p.inception_date, p.expiry_date, p.issued_date, p.sum_insured, p.net_premium, p.premium_total,
    p.commission_amount, p.currency, p.bill_number, p.payment_status, p.insured_name, p.client_id, p.renewed_from, p.renewed_to, p.details, p.product_type,
    c.display_name AS client_name, c.client_code, ic.name AS insurer_name
  FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id`;

const policyOut = (r, sections = null, endorsements = null) => ({
  policyId: r.id, policyNumber: r.policy_number, status: r.status, bundleId: r.details?.package?.bundleId ?? null, bundleName: r.details?.package?.bundleName || r.product_type,
  packageQuoteId: r.details?.package?.packageQuoteId || null, packageQuoteNumber: r.details?.package?.packageQuoteNumber || null, lguCode: r.details?.package?.lguCode || null,
  inceptionDate: r.inception_date, expiryDate: r.expiry_date, issuedDate: r.issued_date, sumInsured: Number(r.sum_insured), netPremium: Number(r.net_premium),
  grossPremium: Number(r.premium_total), commissionAmount: Number(r.commission_amount), currency: r.currency, billNumber: r.bill_number, paymentStatus: r.payment_status,
  insuredName: r.insured_name || r.client_name, clientId: r.client_id, clientCode: r.client_code, clientName: r.client_name, leadInsurer: r.insurer_name,
  renewedFrom: r.renewed_from, renewedTo: r.renewed_to, ...(sections ? { sections } : {}), ...(endorsements ? { endorsements } : {}),
});

const endorsementOut = (e) => ({
  id: e.id, endorsementNumber: e.endorsement_number, sectionNo: e.section_no, insuranceCompanyId: e.insurance_company_id, insurerName: e.insurer_name || null,
  effectiveDate: e.effective_date, sumInsuredBefore: Number(e.sum_insured_before), sumInsuredAfter: Number(e.sum_insured_after), prorataFactor: Number(e.prorata_factor),
  netPremium: Number(e.net_premium), totalCharges: Number(e.total_charges), totalAmount: Number(e.total_amount), commissionAmount: Number(e.commission_amount),
  charges: e.charges || [], billNumber: e.bill_number, remarks: e.remarks, createdAt: e.created_at,
});

async function packagePolicyRow(db, policyId, scope = null) {
  const params = [String(policyId)];
  const pred = scopeSql(scope, 'policy', 'p', params);
  const r = (await run(db).query(`${POLICY_SELECT} WHERE (p.id = $1 OR p.policy_number = $1) AND p.details ? 'package' AND ${pred}`, params)).rows[0];
  if (!r) throw notFound('Package policy not found');
  return r;
}

export async function getPackagePolicy(policyId, { scope = null, db = null } = {}) {
  const r = await packagePolicyRow(db, policyId, scope);
  const ends = (await run(db).query(`SELECT e.*, ic.name AS insurer_name FROM package_endorsements e JOIN insurance_companies ic ON ic.id = e.insurance_company_id
    WHERE e.policy_id = $1 ORDER BY e.created_at`, [r.id])).rows.map(endorsementOut);
  return policyOut(r, await sectionsOf('policy', r.id, db), ends);
}

export async function listPackagePolicies(q, pg) {
  const where = ["p.details ? 'package'"];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('p.status = ?', String(q.status));
  if (q.clientId) add('p.client_id = ?', q.clientId);
  if (q.search) add("(p.policy_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", q.search);
  if (q[SCOPE]) where.push(scopeSql(q[SCOPE], 'policy', 'p', params));
  const w = where.join(' AND ');
  const total = (await query(`SELECT count(*)::int AS n FROM policies p LEFT JOIN clients c ON c.id = p.client_id WHERE ${w}`, params)).rows[0].n;
  const rows = (await query(`${POLICY_SELECT} WHERE ${w} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows;
  return { total, rows: rows.map((r) => policyOut(r)) };
}

/**
 * Endorse one section: a new sum insured from an effective date. The additional premium is the difference of the annual
 * premiums on the section's rate, less the package discount, pro rata to the days left (packages.endorsement_prorata);
 * it is billed with its own taxes and booked as due to that section's insurer only. A return premium (lower sum
 * insured) is not billed here: it is refused, to be processed as a cancellation and re-issue of the section.
 */
export async function endorseSection(policyId, sectionNo, b, user, { scope = null } = {}) {
  return withTransaction(async (db) => {
    const r = await packagePolicyRow(db, policyId, scope);
    await db.query('SELECT id FROM policies WHERE id = $1 FOR UPDATE', [r.id]);
    if (!['active', 'issued'].includes(r.status)) throw badRequest(`A ${r.status} policy cannot be endorsed`);
    const sec = (await db.query("SELECT * FROM package_sections WHERE entity_type = 'policy' AND entity_id = $1 AND section_no = $2 FOR UPDATE", [r.id, Number(sectionNo)])).rows[0];
    if (!sec) throw notFound(`Section ${sectionNo} not found on policy ${r.policy_number}`);
    if (sec.status !== 'active') throw badRequest(`Section ${sec.name} is ${sec.status}`);
    const effective = isoDate(b.effectiveDate) || (await today());
    const inception = isoDate(r.inception_date);
    const expiry = isoDate(r.expiry_date);
    if (effective < inception || effective > expiry) throw badRequest('Validation failed', [{ path: 'effectiveDate', message: `The effective date must be within the policy term (${inception} to ${expiry})` }]);
    const before = Number(sec.sum_insured);
    const after = round2(b.sumInsured);
    if (!(after > 0)) throw badRequest('Validation failed', [{ path: 'sumInsured', message: 'The new sum insured must be greater than zero' }]);
    if (after === before) throw badRequest('Validation failed', [{ path: 'sumInsured', message: 'The new sum insured is the same as the current one' }]);
    const basis = { rateBasis: sec.rate_basis, rate: Number(sec.rate), minimumPremium: 0 };
    const annual = round2(premiumOnRate(basis, after).premium - premiumOnRate(basis, before).premium);
    const days = (a, z) => Math.round((Date.parse(`${z}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
    const prorata = (await getSetting('packages.endorsement_prorata', true)) !== false;
    const factor = prorata ? Math.max(0, Math.min(1, days(effective, expiry) / Math.max(1, days(inception, expiry)))) : 1;
    const discountPct = Number(r.details?.package?.discountPercent) || 0;
    const net = round2(annual * (1 - discountPct / 100) * factor);
    if (net < 0) throw badRequest('A lower sum insured gives a return premium: cancel and re-issue the section, or process the refund through Accounts');
    const charges = net ? await chargesFor({ premium: net, productId: sec.product_id, property: sec.property, lguCode: r.details?.package?.lguCode || null, date: effective, includeFlat: false }, db) : null;
    const total = charges ? charges.total : 0;
    const commission = round2(net * Number(sec.commission_rate));
    const number = await nextDocumentNumber('endorsement', { db, unique: { table: 'package_endorsements', column: 'endorsement_number' } });
    let bill = null;
    if (total > 0) {
      const policy = await findPolicy(db, r.id);
      const ins = (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [sec.insurance_company_id])).rows[0];
      const groups = [{ insuranceCompanyId: sec.insurance_company_id, insurerName: ins?.name, totalAmount: total, commissionAmount: commission, vat: charges.vat, dst: charges.dst,
        lgt: charges.lgt, sharePercent: 100, isLead: true }];
      bill = await createReceivable(db, { policy, amount: total, source: 'endorsement', reference: number, user,
        breakdown: { netPremium: net, vat: charges.vat, dst: charges.dst, lgt: charges.lgt, other: round2(charges.fst + charges.premiumTax + charges.other), commissionAmount: commission },
        split: await packageSplit(db, groups) });
    }
    // amounts are numbers computed here (never request text), rounded to cents
    const add = (col, v) => `${col} = ${col} + ${round2(Number(v) || 0)}`;
    if (charges) {
      await db.query(`UPDATE package_sections SET sum_insured = $2, ${add('base_premium', annual * factor)}, ${add('net_premium', net)}, ${add('vat', charges.vat)}, ${add('premium_tax', charges.premiumTax)},
        ${add('dst', charges.dst)}, ${add('fst', charges.fst)}, ${add('lgt', charges.lgt)}, ${add('other_charges', charges.other)}, ${add('total_charges', charges.totalCharges)},
        ${add('total_amount', total)}, ${add('commission_amount', commission)} WHERE id = $1`, [sec.id, after]);
    } else {
      await db.query('UPDATE package_sections SET sum_insured = $2 WHERE id = $1', [sec.id, after]);
    }
    await db.query(`UPDATE policies SET sum_insured = sum_insured + $2, net_premium = net_premium + $3, premium_total = premium_total + $4, commission_amount = commission_amount + $5,
      updated_by = $6, updated_at = now() WHERE id = $1`, [r.id, round2(after - before), net, total, commission, user?.id ?? null]);
    await db.query(`UPDATE risk_participants SET sum_insured = sum_insured + $3, premium = premium + $4, taxes = taxes + $5, premium_total = premium_total + $6, commission_amount = commission_amount + $7
      WHERE entity_type = 'policy' AND entity_id = $1 AND insurance_company_id = $2`, [r.id, sec.insurance_company_id, round2(after - before), net, charges ? charges.totalCharges : 0, total, commission]);
    await reshare(db, r.id);
    const e = (await db.query(`INSERT INTO package_endorsements(endorsement_number, policy_id, section_no, insurance_company_id, effective_date, sum_insured_before, sum_insured_after, prorata_factor,
        net_premium, total_charges, total_amount, commission_amount, charges, receivable_id, bill_number, remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [number, r.id, sec.section_no, sec.insurance_company_id, effective, before, after, Math.round(factor * 1e6) / 1e6, net, charges ? charges.totalCharges : 0, total, commission,
      JSON.stringify(charges?.lines || []), bill?.id || null, bill?.bill_number || null, b.remarks || null, user?.id ?? null])).rows[0];
    return { endorsement: endorsementOut(e), policy: await getPackagePolicy(r.id, { db }) };
  });
}

/** Shares of a policy's participants from their gross premiums (lead takes the rounding). */
async function reshare(db, policyId) {
  const rows = (await db.query("SELECT id, premium_total, is_lead FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC, id", [policyId])).rows;
  const gross = rows.reduce((s, x) => s + Number(x.premium_total), 0);
  if (!gross || rows.length < 2) return;
  let others = 0;
  for (const x of rows.filter((z) => !z.is_lead)) {
    const share = Math.max(0.0001, Math.round((Number(x.premium_total) / gross) * 1e6) / 1e4);
    others += share;
    await db.query('UPDATE risk_participants SET share_percent = $2 WHERE id = $1', [x.id, share]);
  }
  const lead = rows.find((z) => z.is_lead);
  if (lead) await db.query('UPDATE risk_participants SET share_percent = $2 WHERE id = $1', [lead.id, Math.round((100 - others) * 1e4) / 1e4]);
}

/**
 * Renew the whole package: a package quotation for the next term (inception = expiry + 1 day) with the same sections,
 * sums insured and insurers, priced at the rates in force then. Issuing it marks this policy renewed.
 */
export async function renewPackage(policyId, b, user, { scope = null } = {}) {
  return withTransaction(async (db) => {
    const r = await packagePolicyRow(db, policyId, scope);
    if (r.renewed_to || r.status === 'renewed') throw conflict(`Policy ${r.policy_number} has already been renewed`);
    if (r.status === 'cancelled') throw conflict(`Policy ${r.policy_number} is cancelled`);
    const open = (await db.query("SELECT quote_number FROM package_quotes WHERE renewal_of = $1 AND status IN ('draft', 'accepted') LIMIT 1", [r.id])).rows[0];
    if (open) throw conflict(`Renewal quotation ${open.quote_number} is already open for policy ${r.policy_number}`);
    const sections = (await sectionsOf('policy', r.id, db)).filter((s) => s.status === 'active');
    const pkg = r.details.package;
    const quote = await createPackageQuote({
      bundleId: pkg.bundleId, clientId: r.client_id, insuredName: r.insured_name, lguCode: b.lguCode ?? pkg.lguCode, inceptionDate: addDays(isoDate(r.expiry_date), 1),
      sections: sections.map((s) => ({ sectionNo: s.sectionNo, included: true, insuranceCompanyId: s.insuranceCompanyId, sumInsured: s.sumInsured })),
      renewalOf: r.id, remarks: b.remarks || `Renewal of ${r.policy_number}`,
    }, user, db);
    return quote;
  });
}

// ------------------------------------------------------------------ prints

const m = (v) => round2(v);

function sectionTable(sections) {
  return {
    columns: ['Section', 'Insurer', 'Sum insured', 'Premium', 'Taxes and charges', 'Total'],
    rows: sections.map((s) => [`${s.sectionNo}. ${s.name}`, s.insurerName || '-', m(s.sumInsured), m(s.netPremium), m(s.totalCharges), m(s.totalAmount)]),
    totals: ['Total', '', m(sections.reduce((a, s) => a + s.sumInsured, 0)), m(sections.reduce((a, s) => a + s.netPremium, 0)),
      m(sections.reduce((a, s) => a + s.totalCharges, 0)), m(sections.reduce((a, s) => a + s.totalAmount, 0))],
  };
}

function chargesTable(x) {
  const rows = [['Premium before discount', m(x.basePremium ?? x.netPremium)]];
  if (x.discountAmount) rows.push([`Package discount (${x.discountPercent}%)`, -m(x.discountAmount)]);
  rows.push(['Net premium', m(x.netPremium)]);
  for (const [label, v] of [['Value Added Tax', x.vat], ['Premium Tax', x.premiumTax], ['Documentary Stamp Tax', x.dst], ['Fire Service Tax', x.fst], ['Local Government Tax', x.lgt], ['Other charges', x.otherCharges]]) {
    if (Number(v)) rows.push([label, m(v)]);
  }
  rows.push(['Total amount due', m(x.totalAmount)]);
  return { columns: ['Premium and charges', 'Amount'], rows };
}

/** Client copy of a package quotation (no commission). */
export async function packageQuotePdf(id, { scope = null } = {}) {
  const q = await getPackageQuote(id, { scope });
  return renderPdf({
    title: 'Package Quotation', number: q.quoteNumber,
    meta: [['Package', q.bundleName], ['Insured', q.insuredName || '-'], ['Location', q.lgu ? `${q.lgu.name}` : (q.location || '-')], ['Inception', q.inceptionDate || '-'],
      ['Valid until', q.validUntil || '-'], ['Status', q.status.toUpperCase()]],
    sections: [
      { heading: 'Sections', table: sectionTable(q.sections) },
      { heading: 'Premium and charges', table: chargesTable({ ...q, otherCharges: q.otherCharges }) },
      ...q.sections.filter((s) => s.deductible || (s.benefits || []).length).map((s) => ({ heading: `${s.name}: cover`, text: [s.deductible ? `Deductible: ${s.deductible}` : null, ...(s.benefits || []).map((x) => `- ${x}`)].filter(Boolean).join('\n') })),
      { note: String(await getSetting('packages.comparison_disclaimer', DISCLAIMER)) },
    ],
  });
}

/** Policy schedule of a package policy: one policy number, the sections underneath with their insurers. */
export async function packageScheduleSpec(policyId, { scope = null } = {}) {
  const p = await getPackagePolicy(policyId, { scope });
  const q = p.packageQuoteId ? quoteOut(await getQuoteRow(p.packageQuoteId)) : null;
  const totals = { basePremium: q?.basePremium ?? p.netPremium, discountAmount: q?.discountAmount ?? 0, discountPercent: q?.discountPercent ?? 0, netPremium: p.netPremium,
    vat: p.sections.reduce((a, s) => a + s.vat, 0), premiumTax: p.sections.reduce((a, s) => a + s.premiumTax, 0), dst: p.sections.reduce((a, s) => a + s.dst, 0),
    fst: p.sections.reduce((a, s) => a + s.fst, 0), lgt: p.sections.reduce((a, s) => a + s.lgt, 0), otherCharges: p.sections.reduce((a, s) => a + s.otherCharges, 0), totalAmount: p.grossPremium };
  if (q?.discountAmount) totals.basePremium = round2(p.netPremium + q.discountAmount);
  return {
    title: 'Package Policy Schedule', number: p.policyNumber,
    meta: [['Package', p.bundleName], ['Insured', p.insuredName || '-'], ['Period of insurance', `${p.inceptionDate} to ${p.expiryDate}`], ['Issued', p.issuedDate || '-'],
      ['Bill number', p.billNumber || '-'], ['Status', String(p.status).toUpperCase()]],
    sections: [
      { heading: 'Sections and insurers', table: sectionTable(p.sections.filter((s) => s.status === 'active')) },
      { heading: 'Premium and charges', table: chargesTable(totals) },
      ...p.sections.filter((s) => s.deductible || (s.benefits || []).length).map((s) => ({ heading: `${s.name} (${s.insurerName})`, text: [s.deductible ? `Deductible: ${s.deductible}` : null, ...(s.benefits || []).map((x) => `- ${x}`)].filter(Boolean).join('\n') })),
      ...(p.endorsements.length ? [{ heading: 'Endorsements', table: { columns: ['Number', 'Section', 'Effective', 'Sum insured', 'Additional premium'], rows: p.endorsements.map((e) => [e.endorsementNumber, String(e.sectionNo), e.effectiveDate, m(e.sumInsuredAfter), m(e.totalAmount)]) } }] : []),
      { note: 'Each section is insured by the insurer named against it, under that insurer\'s policy wording, conditions and exclusions.' },
    ],
  };
}

export async function packageSchedulePdf(policyId, opts = {}, ctx = {}) {
  return renderPdf(await packageScheduleSpec(policyId, opts), ctx);
}
