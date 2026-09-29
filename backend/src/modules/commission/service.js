/**
 * Commission (comsub) lines per referrer: Accrued -> Eligible (premium collected) -> Approved (maker-checker, accrual
 * journal Dr Commission Expense / Cr Commission Payable) -> Paid (Dr Commission Payable / Cr Cash / Cr WHT Payable).
 * Reversal after payment is a clawback (Dr Receivable from Agents / Cr Commission Expense).
 */
import { getSetting } from '../../lib/settings.js';
import { scopeSql } from '../../lib/scope.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { postEvent } from '../accounting/lib/posting.js';
import { assertChecker, round2, num } from '../accounting/lib/http.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cycleLabel = (d) => { const x = new Date(d); return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const dayLabel = (d) => { if (!d) return null; const x = new Date(d); return `${String(x.getUTCDate()).padStart(2, '0')} ${MONTHS[x.getUTCMonth()]}`; };
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
export const LINE_STATUSES = ['Accrued', 'Eligible', 'Approved', 'Paid'];

const LINE_SQL = `SELECT c.*, r.name AS referrer_name, r.wht_applicable AS referrer_wht_applicable FROM commissions c
  LEFT JOIN commission_referrers r ON r.id = c.referrer_id`;

export async function whtPctFor(ref) {
  if (ref.wht_rate !== null && ref.wht_rate !== undefined) return round2(Number(ref.wht_rate) * 100);
  const byType = (await getSetting('commission.wht_rate_by_type', {})) || {};
  const rate = byType[ref.referrer_type] ?? (await getSetting('tax.withholding_rate', 0.05));
  return round2(Number(rate) * 100);
}
/** Referrers shown as commission accounts: external / unlinked referrers, or users holding a commission-earning role. */
async function eligibleSql(alias, params) {
  const { commissionEligibleRoles } = await import('../policies/service.js');
  params.push(await commissionEligibleRoles());
  return `(${alias}.user_id IS NULL OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = ${alias}.user_id AND lower(ro.code) = ANY($${params.length})))`;
}

/** Why a referrer cannot be approved / paid (null when payable): no bank account on file (commission.require_bank_account). */
export async function payoutBlockReason(ref) {
  if (!(await getSetting('commission.require_bank_account', true))) return null;
  if (!ref.bank_account_no || !String(ref.bank_account_no).trim()) {
    return `${ref.name} has no bank account on file. Add the bank name and account number to the referrer before approving or paying commission.`;
  }
  return null;
}
export async function assertPayable(ref) {
  const reason = await payoutBlockReason(ref);
  if (reason) throw conflict(reason);
}

const maskAccount = (ref) => (ref.bank_account_no ? `${ref.bank_name || 'Bank'} ***${String(ref.bank_account_no).slice(-4)}` : null);

/** comsub = fixed + net premium x pct; WHT on comsub when applicable; net margin = brokerage - comsub. */
export function computeLine({ netPremium, comsubFixed = 0, comsubPct = 0, whtPct = 0, whtApplicable = true, brokeragePct = 0 }) {
  const comsub = round2(num(comsubFixed) + num(netPremium) * (num(comsubPct) / 100));
  const wht = whtApplicable ? round2(comsub * (num(whtPct) / 100)) : 0;
  const brokerageAmount = round2(num(netPremium) * (num(brokeragePct) / 100));
  return { comsub, wht, net: round2(comsub - wht), brokerageAmount, netMargin: round2(brokerageAmount - comsub) };
}

export async function lineView(c) {
  const symbol = await getSetting('currency.symbol', '₱');
  const fixed = Number(c.comsub_fixed); const pct = Number(c.comsub_pct);
  return {
    id: c.id, referrerId: c.referrer_id, policyId: c.policy_id, policyNo: c.policy_number,
    productInsurer: [c.product_label, c.insurer_label].filter(Boolean).join(' · '),
    cycle: c.cycle_date ? cycleLabel(c.cycle_date) : c.period, comsub: Number(c.amount),
    comsubRateLabel: fixed > 0 ? `${symbol}${fixed.toLocaleString('en-US')} + ${pct}%` : `${pct}%`,
    wht: Number(c.withholding), net: Number(c.net_amount), status: c.status, grossPremium: Number(c.gross_premium),
    discountAmount: Number(c.discount_amount), discountLabel: `${symbol}${Number(c.discount_amount).toLocaleString('en-US')} + ${Number(c.discount_pct)}%`,
    netPremium: Number(c.net_premium), brokeragePct: Number(c.brokerage_pct), brokerageAmount: Number(c.brokerage_amount),
    comsubFixed: fixed, comsubPct: pct, whtPct: Number(c.wht_pct), netMargin: round2(Number(c.brokerage_amount) - Number(c.amount)),
    lifecycle: { accruedAt: dayLabel(c.accrued_at), eligibleAt: dayLabel(c.eligible_at), approvedAt: dayLabel(c.approved_at), paidAt: dayLabel(c.paid_at) },
    receiptNo: c.receipt_no, voucherNo: c.voucher_no, disbursementId: c.disbursement_id, clawback: c.clawback,
    reversedAt: dayLabel(c.reversed_at),
  };
}

export async function getReferrer(db, id) {
  const r = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [id])).rows[0];
  if (!r) throw notFound('Referrer not found');
  return r;
}
async function getLine(db, referrerId, lineId, lock = false) {
  const l = (await db.query(`${LINE_SQL} WHERE c.id = $1 AND c.referrer_id = $2${lock ? ' FOR UPDATE OF c' : ''}`, [lineId, referrerId])).rows[0];
  if (!l) throw notFound('Commission line not found');
  return l;
}
const referrerLines = async (db, id) => (await db.query(`${LINE_SQL} WHERE c.referrer_id = $1 ORDER BY c.cycle_date NULLS LAST, c.created_at`, [id])).rows;

/** Bucket lines for the referrer account screen. */
function bucket(lines) {
  const current = monthStart();
  const past = lines.filter((l) => ['Paid', 'Reversed'].includes(l.status));
  const future = lines.filter((l) => l.status === 'Accrued' && l.cycle_date && String(l.cycle_date) > current);
  const cur = lines.filter((l) => !past.includes(l) && !future.includes(l));
  return { past, future, cur };
}
const sumNet = (ls) => round2(ls.reduce((s, l) => s + Number(l.net_amount), 0));

export async function referrerSummaryRow(db, ref) {
  const lines = await referrerLines(db, ref.id);
  const { cur } = bucket(lines);
  const whtPct = await whtPctFor(ref);
  return {
    id: ref.id, name: ref.name, type: ref.referrer_type, level: ref.level, policies: new Set(lines.filter((l) => l.status !== 'Reversed').map((l) => l.policy_id)).size,
    netPayable: sumNet(cur), whtType: `${ref.referrer_type === 'External' ? 'Company' : 'Individual'} ${whtPct}%`, whtApplicable: ref.wht_applicable, whtPct,
    bankAccount: maskAccount(ref), bankAccountMissing: !ref.bank_account_no, payoutBlockedReason: await payoutBlockReason(ref), status: ref.status, userId: ref.user_id, parentReferrerId: ref.parent_referrer_id,
  };
}

export async function listReferrers(db, scope = null) {
  const params = [];
  const own = scopeSql(scope, 'referrer', 'r', params);
  const eligible = await eligibleSql('r', params);
  const refs = (await db.query(`SELECT * FROM commission_referrers r WHERE ${own} AND ${eligible} ORDER BY name`, params)).rows;
  const referrers = [];
  for (const r of refs) referrers.push(await referrerSummaryRow(db, r));
  const rp = [];
  const ownLines = scopeSql(scope, 'commission', 'c', rp);
  const ready = (await db.query(`SELECT COALESCE(sum(net_amount),0) AS n FROM commissions c WHERE status = 'Approved' AND disbursement_id IS NULL AND ${ownLines}`, rp)).rows[0].n;
  return { summary: { cycleLabel: cycleLabel(monthStart()), dueThisCycle: round2(referrers.reduce((s, r) => s + r.netPayable, 0)), readyToPay: round2(ready) }, referrers };
}

/** Full referrer account (detail screen payload; also returned by every account-level action). */
export async function buildAccount(db, id) {
  const ref = await getReferrer(db, id);
  const lines = await referrerLines(db, id);
  const { past, future, cur } = bucket(lines);
  const view = async (ls) => Promise.all(ls.map(lineView));
  const row = await referrerSummaryRow(db, ref);
  return {
    referrer: { id: ref.id, name: ref.name, status: ref.status, type: ref.referrer_type, level: ref.level, whtType: row.whtType, whtApplicable: ref.wht_applicable,
      whtPct: row.whtPct, bankAccount: row.bankAccount, bankAccountMissing: row.bankAccountMissing, payoutBlockedReason: row.payoutBlockedReason, policiesCount: row.policies, email: ref.email, phone: ref.phone, tin: ref.tin },
    summary: { cycleLabel: cycleLabel(monthStart()), dueThisCycle: sumNet(cur), upcoming: sumNet(future), paidToDate: sumNet(past.filter((l) => l.status === 'Paid')) },
    currentCycle: { label: cycleLabel(monthStart()), totalNet: sumNet(cur), lines: await view(cur) },
    futureCycles: { totalNet: sumNet(future), lines: await view(future) },
    past: { totalNet: sumNet(past.filter((l) => l.status === 'Paid')), lines: await view(past) },
    actions: {
      approveCount: lines.filter((l) => l.status === 'Eligible').length,
      generatePayoutCount: lines.filter((l) => l.status === 'Approved' && !l.disbursement_id).length,
      markEligibleCount: lines.filter((l) => l.status === 'Accrued').length,
    },
  };
}

/**
 * Premium fully collected for a policy: it has receivables and none has an outstanding balance. For a direct-bill policy
 * (the client pays the insurer) it is the commission that must be collected: every commission debit note of the policy
 * is fully collected from the insurer.
 */
export async function isPremiumCollected(db, policyId) {
  const mode = (await db.query('SELECT billing_mode FROM policies WHERE id = $1', [policyId])).rows[0]?.billing_mode;
  if (mode === 'direct') {
    const { isDirectBillCollected } = await import('../remittance/directbill.js');
    return isDirectBillCollected(db, policyId);
  }
  const r = (await db.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE balance > 0 AND status IN ('open','partial'))::int AS open
    FROM receivables WHERE policy_id = $1 AND status <> 'cancelled'`, [policyId])).rows[0];
  return r.total > 0 && r.open === 0;
}

async function recompute(db, line, patch = {}) {
  const ref = await getReferrer(db, line.referrer_id);
  const whtPct = patch.whtPct ?? Number(line.wht_pct);
  const vals = { netPremium: Number(line.net_premium), comsubFixed: patch.comsubFixed ?? Number(line.comsub_fixed), comsubPct: patch.comsubPct ?? Number(line.comsub_pct), whtPct, whtApplicable: ref.wht_applicable, brokeragePct: Number(line.brokerage_pct) };
  const c = computeLine(vals);
  await db.query(`UPDATE commissions SET comsub_fixed = $2, comsub_pct = $3, wht_pct = $4, amount = $5, withholding = $6, net_amount = $7,
    rate = $8, brokerage_amount = $9, updated_at = now() WHERE id = $1`, [line.id, vals.comsubFixed, vals.comsubPct, whtPct, c.comsub, c.wht, c.net, round2(vals.comsubPct / 100), c.brokerageAmount]);
}

/**
 * Create Accrued lines for a policy from its commission details ({ brokeragePct, productLabel, primary, chain[] }).
 * Existing lines for the same (policy, referrer, position) are left untouched.
 */
export async function accrueForPolicy(db, policyId, details) {
  const p = (await db.query(`SELECT p.*, pr.name AS product_name, pr.line, ic.short_name AS insurer_short, ic.name AS insurer_name FROM policies p
    LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.id = $1 OR p.policy_number = $1`, [policyId])).rows[0];
  if (!p) throw notFound('Policy not found');
  const d = details || p.details?.commissionDetails;
  if (!d) return [];
  const byLevel = (await getSetting('commission.comsub_rate_by_level', { L1: 0.08, L2: 0.05 })) || {};
  const brokeragePct = num(d.brokeragePct) || round2(Number(await getSetting('commission.default_rate', 0.15)) * 100);
  const netPremium = num(d.netPremium ?? p.details?.netPremium) || Number(p.premium_total);
  const discount = num(d.discount ?? p.details?.discount);
  const created = [];
  const chain = [d.primary, ...(d.chain || [])].filter((e) => e && e.referrerId && e.referrerId !== 'direct');
  for (const [pos, e] of chain.entries()) {
    const ref = (await db.query('SELECT * FROM commission_referrers WHERE id = $1', [e.referrerId])).rows[0];
    if (!ref) throw badRequest(`Unknown referrer ${e.referrerId}`);
    const level = e.level || ref.level;
    const comsubPct = e.comsubPct !== undefined && e.comsubPct !== null && e.comsubPct !== '' ? num(e.comsubPct) : round2(Number(byLevel[level] || 0) * 100);
    const whtPct = await whtPctFor(ref);
    const c = computeLine({ netPremium, comsubFixed: num(e.comsubFixed), comsubPct, whtPct, whtApplicable: ref.wht_applicable, brokeragePct });
    const r = (await db.query(`INSERT INTO commissions(policy_id, agent_user_id, referrer_id, policy_number, product_label, insurer_label, cycle_date, period,
        gross_premium, discount_amount, net_premium, brokerage_pct, brokerage_amount, comsub_fixed, comsub_pct, wht_pct,
        basis_amount, rate, amount, withholding, net_amount, status, accrued_at, chain_position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,to_char($7::date,'YYYY-MM'),$8,$9,$10,$11,$12,$13,$14,$15,$10,$16,$17,$18,$19,'Accrued',now(),$20)
      ON CONFLICT (policy_id, referrer_id, chain_position) WHERE policy_id IS NOT NULL AND referrer_id IS NOT NULL DO NOTHING RETURNING id`,
    [p.id, ref.user_id, ref.id, p.policy_number, d.productLabel?.split('·')[0]?.trim() || p.product_name || p.line, p.insurer_short || p.insurer_name,
      monthStart(new Date(p.inception_date || Date.now())), Number(p.premium_total), discount, netPremium, brokeragePct, c.brokerageAmount,
      num(e.comsubFixed), comsubPct, whtPct, round2(comsubPct / 100), c.comsub, c.wht, c.net, pos])).rows[0];
    if (r) created.push(r.id);
  }
  return created;
}

/** Hook from receivables: premium fully collected -> accrue from policy details if needed, set receipt no, auto-eligible. */
export async function onPolicyPremiumCollected(db, policyId, receiptNo) {
  const existing = (await db.query('SELECT count(*)::int AS n FROM commissions WHERE policy_id = $1 AND referrer_id IS NOT NULL', [policyId])).rows[0].n;
  if (!existing) await accrueForPolicy(db, policyId, null);
  if (receiptNo) await db.query('UPDATE commissions SET receipt_no = COALESCE(receipt_no, $2) WHERE policy_id = $1', [policyId, receiptNo]);
  if (await getSetting('commission.auto_eligible_on_full_payment', true)) {
    await db.query('UPDATE commissions SET status = \'Eligible\', eligible_at = now(), eligible_by = NULL, updated_at = now() WHERE policy_id = $1 AND status = \'Accrued\'', [policyId]);
  }
}

async function markEligible(db, line, user) {
  if (line.status !== 'Accrued') throw conflict(`Line is ${line.status}; only Accrued lines can be marked eligible`);
  if ((await getSetting('commission.require_full_payment', true)) && line.policy_id && !(await isPremiumCollected(db, line.policy_id))) {
    throw conflict(`Premium for ${line.policy_number} is not fully collected yet`);
  }
  await db.query('UPDATE commissions SET status = \'Eligible\', eligible_at = now(), eligible_by = $2, updated_at = now() WHERE id = $1', [line.id, user.id]);
}

async function approve(db, line, user) {
  if (line.status !== 'Eligible') throw conflict(`Line is ${line.status}; only Eligible lines can be approved`);
  await assertPayable(await getReferrer(db, line.referrer_id));
  await assertChecker(user, line.eligible_by, 'commission line');
  const jv = await postEvent('commission.approve', {
    source: 'commission', entryType: 'COMMISSION_ACCRUAL', referenceType: 'Commission', referenceId: line.id, policyId: line.policy_id, policyNumber: line.policy_number,
    description: `Comsub approved – ${line.referrer_name} – ${line.policy_number}`, transactionCode: line.policy_number,
    amounts: { amount: Number(line.amount) }, vars: { referrerName: line.referrer_name, policyNumber: line.policy_number },
  }, { db, user });
  await db.query('UPDATE commissions SET status = \'Approved\', approved_at = now(), approved_by = $2, accrual_jv_id = $3, updated_at = now() WHERE id = $1', [line.id, user.id, jv.id]);
}

/**
 * Pay Approved lines through a disbursement voucher: posts Dr Commission Payable (gross) / Cr Cash (net) / Cr WHT Payable.
 * Direct payment (no voucher approval step) requires a payer other than the line approver (checkApprover).
 * Returns { gross, wht, net, journalId }.
 */
export async function payLines(db, { lines, disbursement, user, checkApprover = false }) {
  if (!lines.length) throw badRequest('No approved commission lines selected');
  for (const l of lines) {
    if (l.status !== 'Approved') throw conflict(`Line ${l.policy_number} is ${l.status}; only Approved lines can be paid`);
    if (l.disbursement_id && l.disbursement_id !== disbursement.id) throw conflict(`Line ${l.policy_number} is already on voucher ${l.voucher_no || l.disbursement_id}`);
    if (checkApprover) await assertChecker(user, l.approved_by, 'commission payment');
  }
  const gross = round2(lines.reduce((s, l) => s + Number(l.amount), 0));
  const wht = round2(lines.reduce((s, l) => s + Number(l.withholding), 0));
  const net = round2(gross - wht);
  const jv = await postEvent('commission.payout', {
    source: 'disbursement', entryType: 'COMMISSION_PAYMENT', referenceType: 'Disbursement', referenceId: disbursement.id, transactionCode: disbursement.voucher_number,
    description: `Comsub payout ${disbursement.voucher_number} – ${disbursement.payee_name}`,
    amounts: { gross, net, wht }, vars: { voucherNumber: disbursement.voucher_number, payeeName: disbursement.payee_name },
  }, { db, user });
  await db.query(`UPDATE commissions SET status = 'Paid', paid_at = now(), paid_by = $2, disbursement_id = $3, voucher_no = $4, payment_jv_id = $5, updated_at = now()
    WHERE id = ANY($1)`, [lines.map((l) => l.id), user.id, disbursement.id, disbursement.voucher_number, jv.id]);
  return { gross, wht, net, journalId: jv.id };
}

async function reverse(db, line, user) {
  if (line.status === 'Reversed') throw conflict('Line is already reversed');
  if (line.status === 'Paid') {
    await postEvent('commission.clawback', {
      source: 'commission', entryType: 'COMMISSION_CLAWBACK', referenceType: 'Commission', referenceId: line.id, policyId: line.policy_id, policyNumber: line.policy_number,
      description: `Comsub clawback – ${line.referrer_name} – ${line.policy_number}`,
      amounts: { amount: Number(line.amount) }, vars: { referrerName: line.referrer_name, policyNumber: line.policy_number },
    }, { db, user });
  } else if (line.status === 'Approved' && line.accrual_jv_id) {
    if (line.disbursement_id) throw conflict('Line is on a payout voucher; remove it from the voucher first');
    await reverseJournal(db, line.accrual_jv_id, user, { description: `Comsub reversal – ${line.policy_number}` });
  }
  await db.query('UPDATE commissions SET status = \'Reversed\', clawback = $3, reversed_at = now(), reversed_by = $2, updated_at = now() WHERE id = $1', [line.id, user.id, line.status === 'Paid']);
}

/** Line-level action dispatcher; returns { account, line }. */
export async function lineAction(db, referrerId, lineId, action, user, body = {}) {
  const line = await getLine(db, referrerId, lineId, true);
  if (action === 'mark-eligible') await markEligible(db, line, user);
  else if (action === 'approve') await approve(db, line, user);
  else if (action === 'reverse') await reverse(db, line, user);
  else if (action === 'rate') {
    if (!['Accrued', 'Eligible'].includes(line.status)) throw conflict(`Rate can only be changed before approval (line is ${line.status})`);
    await recompute(db, line, { comsubPct: body.comsubPct === undefined ? undefined : num(body.comsubPct), comsubFixed: body.comsubFixed === undefined ? undefined : num(body.comsubFixed) });
  } else if (action === 'pay') {
    const { createCommissionVoucher } = await import('../disbursements/service.js');
    const ref = await getReferrer(db, referrerId);
    const d = await createCommissionVoucher(db, { referrer: ref, lines: [line], user, status: 'paid' });
    await payLines(db, { lines: [line], disbursement: d, user, checkApprover: true });
  }
  const fresh = await getLine(db, referrerId, lineId);
  return { account: await buildAccount(db, referrerId), line: await lineView(fresh) };
}

/** Account-level bulk actions. */
export async function accountAction(db, referrerId, action, user) {
  const lines = await referrerLines(db, referrerId);
  if (action === 'approve') {
    const eligible = lines.filter((l) => l.status === 'Eligible');
    if (!eligible.length) throw conflict('No Eligible lines to approve');
    await assertPayable(await getReferrer(db, referrerId));
    for (const l of eligible) await approve(db, l, user);
  } else if (action === 'mark-eligible') {
    const accrued = lines.filter((l) => l.status === 'Accrued');
    let moved = 0;
    for (const l of accrued) {
      if (!(await getSetting('commission.require_full_payment', true)) || !l.policy_id || await isPremiumCollected(db, l.policy_id)) { await markEligible(db, l, user); moved += 1; }
    }
    if (!moved) throw conflict('No Accrued lines have fully collected premium yet');
  }
  return buildAccount(db, referrerId);
}

export async function setWht(db, referrerId, applicable) {
  await getReferrer(db, referrerId);
  await db.query('UPDATE commission_referrers SET wht_applicable = $2, updated_at = now() WHERE id = $1', [referrerId, !!applicable]);
  const open = (await db.query(`${LINE_SQL} WHERE c.referrer_id = $1 AND c.status IN ('Accrued','Eligible','Approved') AND c.disbursement_id IS NULL`, [referrerId])).rows;
  for (const l of open) await recompute(db, l);
  return buildAccount(db, referrerId);
}

export async function approvedLines(db, referrerId) {
  return (await db.query(`${LINE_SQL} WHERE c.referrer_id = $1 AND c.status = 'Approved' AND c.disbursement_id IS NULL ORDER BY c.cycle_date`, [referrerId])).rows;
}

export async function agentsReadyToPay(db, scope = null) {
  const params = [];
  const own = scopeSql(scope, 'referrer', 'r', params);
  const eligible = await eligibleSql('r', params);
  const rows = (await db.query(`SELECT r.*, count(c.id)::int AS n, COALESCE(sum(c.amount),0) AS gross, COALESCE(sum(c.net_amount),0) AS net
    FROM commission_referrers r JOIN commissions c ON c.referrer_id = r.id AND c.status = 'Approved' AND c.disbursement_id IS NULL
    WHERE ${own} AND ${eligible} GROUP BY r.id ORDER BY r.name`, params)).rows;
  const agents = [];
  for (const r of rows) {
    agents.push({ id: r.id, name: r.name, type: r.referrer_type, level: r.level, approvedLineCount: r.n, comsubGross: round2(r.gross), netPayable: round2(r.net),
      bankAccount: maskAccount(r), payoutBlockedReason: await payoutBlockReason(r) });
  }
  return { agents, summary: { agentCount: agents.length, totalComsubGross: round2(agents.reduce((s, a) => s + a.comsubGross, 0)), totalNet: round2(agents.reduce((s, a) => s + a.netPayable, 0)) } };
}

const pctRows = (rows) => {
  const total = rows.reduce((s, r) => s + Number(r.amount), 0) || 1;
  return rows.map((r) => ({ label: r.label || 'Other', amount: round2(r.amount), pct: Math.round((Number(r.amount) / total) * 100) }));
};

export async function dashboard(db, scope = null) {
  // Scoped users (agents) see their own lines only: every query below shares the one ownership parameter.
  const sp = [];
  const own = scopeSql(scope, 'commission', 'commissions', sp);
  const q = async (sql) => (await db.query(sql, sp)).rows;
  const live = `status <> 'Reversed' AND referrer_id IS NOT NULL AND ${own}`;
  const [k] = await q(`SELECT COALESCE(sum(brokerage_amount),0) AS b, COALESCE(sum(amount),0) AS c,
    COALESCE(sum(net_amount) FILTER (WHERE status IN ('Eligible','Approved')),0) AS o, COALESCE(sum(withholding) FILTER (WHERE status = 'Paid'),0) AS w FROM commissions WHERE ${live}`);
  const b = round2(k.b); const c = round2(k.c);
  const byStatus = await q(`SELECT status, count(*)::int AS n, COALESCE(sum(net_amount),0) AS amt FROM commissions WHERE ${live} GROUP BY status`);
  const [claw] = await q(`SELECT count(*)::int AS n, COALESCE(sum(amount),0) AS a FROM commissions WHERE status = 'Reversed' AND clawback AND ${own}`);
  const trend = await q(`SELECT cycle_date AS m, sum(brokerage_amount) AS b, sum(amount) AS c FROM commissions WHERE ${live} AND cycle_date IS NOT NULL
    GROUP BY cycle_date ORDER BY cycle_date DESC LIMIT 6`);
  return {
    kpis: { brokerageIncome: b, comsubGross: c, netMargin: round2(b - c), marginPct: b ? Math.round(((b - c) / b) * 1000) / 10 : 0, outstandingPayable: round2(k.o), whtWithheldPaid: round2(k.w) },
    comsubByReferrer: (await q(`SELECT r.name, sum(commissions.amount) AS amount FROM commissions JOIN commission_referrers r ON r.id = commissions.referrer_id WHERE commissions.status <> 'Reversed' AND ${own}
      GROUP BY r.name ORDER BY amount DESC LIMIT 8`)).map((r) => ({ name: r.name, amount: round2(r.amount) })),
    linesByStatus: LINE_STATUSES.map((s) => ({ status: s, count: byStatus.find((x) => x.status === s)?.n || 0 })),
    clawback: { lines: claw.n, amount: round2(claw.a) },
    monthlyTrend: trend.reverse().map((t) => ({ month: cycleLabel(t.m), brokerageIncome: round2(t.b), comsubGross: round2(t.c), netMargin: round2(t.b - t.c) })),
    comsubByProduct: pctRows(await q(`SELECT product_label AS label, sum(amount) AS amount FROM commissions WHERE ${live} GROUP BY product_label ORDER BY amount DESC`)),
    brokerageByInsurer: pctRows(await q(`SELECT insurer_label AS label, sum(brokerage_amount) AS amount FROM commissions WHERE ${live} GROUP BY insurer_label ORDER BY amount DESC`)),
    brokerageByProduct: pctRows(await q(`SELECT product_label AS label, sum(brokerage_amount) AS amount FROM commissions WHERE ${live} GROUP BY product_label ORDER BY amount DESC`)),
    payableFunnel: LINE_STATUSES.map((s) => ({ status: s, amount: round2(byStatus.find((x) => x.status === s)?.amt || 0) })),
  };
}

export async function upsertReferrer(db, id, b, user) {
  const vals = [b.name, b.type || 'Agent', b.level ?? null, b.parentReferrerId || null, b.userId || null, b.tin || null, b.email || null, b.phone || null,
    b.whtRate ?? null, b.whtApplicable ?? true, b.bankName || null, b.bankAccountNo || null, b.status || 'Active'];
  if (id) {
    await getReferrer(db, id);
    await db.query(`UPDATE commission_referrers SET name = COALESCE($2,name), referrer_type = $3, level = $4, parent_referrer_id = $5, user_id = $6, tin = $7, email = $8,
      phone = $9, wht_rate = $10, wht_applicable = $11, bank_name = $12, bank_account_no = $13, status = $14, updated_at = now() WHERE id = $1`, [id, ...vals]);
    return id;
  }
  const newId = b.id || `ref-${String(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)}`;
  const exists = (await db.query('SELECT 1 FROM commission_referrers WHERE id = $1', [newId])).rows[0];
  if (exists) throw conflict(`Referrer ${newId} already exists`);
  await db.query(`INSERT INTO commission_referrers(id, name, referrer_type, level, parent_referrer_id, user_id, tin, email, phone, wht_rate, wht_applicable,
    bank_name, bank_account_no, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [newId, ...vals, user.id]);
  return newId;
}
