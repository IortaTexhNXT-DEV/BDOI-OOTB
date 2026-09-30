/**
 * Matching an insurer statement to the broker's records.
 *
 * Broker records of the statement's insurer:
 *   remittance_line  a policy on a remittance / bill to the insurer (premium, commission, taxes, net remitted)
 *   debit_note_line  a policy on a commission debit note to the insurer (direct bill: premium, commission, VAT, total)
 *   policy           the policy itself (its bills or direct-bill items), when it is on neither
 * A premium statement looks at remittance lines first, a commission statement at debit note lines; policies come last.
 *
 * Auto match: by policy number (compared without spaces, dashes and case); among several records of the policy the one
 * with the closest gross premium. A line whose policy number is not found is matched on amount when exactly one unused
 * record of the period has the same gross premium (within the tolerance) and the same insured. A matched line is a
 * difference when its premium, commission, taxes or amount paid differ from the broker's by more than the tolerance
 * (an amount the insurer left blank is not compared; amount paid only on premium statements).
 *
 * Differences report: insurer lines not found at the broker, broker records of the period missing on the statement,
 * and amount differences, each with its resolution (a note, or an adjustment journal posted when the reconciliation is
 * approved).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';

export const normPolicy = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normName = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const key = (type, id) => `${type}:${id}`;

const recordOut = (r) => ({
  type: r.type, id: String(r.id), policyNumber: r.policy_number, policyId: r.policy_id, insured: r.insured, date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
  document: r.document, billingMode: r.billing_mode || null, grossPremium: round2(r.gross), commission: round2(r.commission), taxes: round2(r.taxes), amount: round2(r.amount),
});

/** Broker records of an insurer that a statement line can match (all dates), typed records first for the statement type. */
export async function brokerRecords(db, statement, { search = null } = {}) {
  const insurerId = statement.insurance_company_id;
  const like = search ? `%${search}%` : null;
  const remittance = (await db.query(`SELECT 'remittance_line' AS type, l.id, COALESCE(p.policy_number, l.policy_number) AS policy_number, l.policy_id,
      COALESCE(l.insured_name, c.display_name) AS insured, r.remittance_date AS date, r.remittance_number AS document, 'broker' AS billing_mode,
      l.premium AS gross, l.commission, l.tax AS taxes, l.net AS amount
    FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id LEFT JOIN policies p ON p.id = l.policy_id LEFT JOIN clients c ON c.id = p.client_id
    WHERE r.status NOT IN ('rejected', 'cancelled') AND COALESCE(l.insurance_company_id, r.insurance_company_id) = $1
      AND ($2::text IS NULL OR COALESCE(p.policy_number, l.policy_number) ILIKE $2 OR COALESCE(l.insured_name, c.display_name) ILIKE $2)`, [insurerId, like])).rows;
  const debitNotes = (await db.query(`SELECT 'debit_note_line' AS type, l.id, l.policy_number, l.policy_id, l.insured_name AS insured, d.dn_date AS date, d.dn_number AS document,
      'direct' AS billing_mode, l.gross_premium AS gross, l.commission, l.vat AS taxes, l.amount
    FROM commission_debit_note_lines l JOIN commission_debit_notes d ON d.id = l.debit_note_id
    WHERE d.insurance_company_id = $1 AND d.status NOT IN ('rejected', 'cancelled') AND ($2::text IS NULL OR l.policy_number ILIKE $2 OR l.insured_name ILIKE $2)`, [insurerId, like])).rows;
  // the policy itself: its premium bills (broker billed) or direct-bill items; amount = premium remitted to the insurer
  // (approved or paid insurer vouchers) or the commission and VAT booked from it (direct bill)
  const policies = (await db.query(`SELECT 'policy' AS type, p.id, p.policy_number, p.id AS policy_id, COALESCE(p.insured_name, c.display_name) AS insured,
      p.inception_date AS date, p.policy_number AS document, p.billing_mode,
      CASE WHEN p.billing_mode = 'direct' THEN COALESCE(db.gross, p.premium_total) ELSE COALESCE(rv.gross, p.premium_total) END AS gross,
      CASE WHEN p.billing_mode = 'direct' THEN COALESCE(db.commission, p.commission_amount) ELSE COALESCE(rv.commission, p.commission_amount) END AS commission,
      CASE WHEN p.billing_mode = 'direct' THEN COALESCE(db.vat, 0) ELSE COALESCE(rv.taxes, 0) END AS taxes,
      CASE WHEN p.billing_mode = 'direct' THEN COALESCE(db.amount, 0) ELSE COALESCE(rem.paid, 0) END AS amount
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN LATERAL (SELECT sum(amount) AS gross, sum(commission_amount) AS commission, sum(vat + dst + lgt) AS taxes FROM receivables x
      WHERE x.policy_id = p.id AND x.status <> 'cancelled') rv ON true
    LEFT JOIN LATERAL (SELECT sum(i.total_amount) AS paid FROM invoice_lists i JOIN disbursements d ON d.id = i.disbursement_id
      WHERE i.policy_id = p.id AND i.source = 'insurer-remittance' AND d.status IN ('approved', 'paid')) rem ON true
    LEFT JOIN LATERAL (SELECT sum(gross_premium) AS gross, sum(commission) AS commission, sum(vat) AS vat, sum(amount) AS amount FROM direct_bill_items y
      WHERE y.policy_id = p.id AND y.status <> 'cancelled') db ON true
    WHERE p.insurance_company_id = $1 AND p.status NOT IN ('draft', 'deleted')
      AND ($2::text IS NULL OR p.policy_number ILIKE $2 OR COALESCE(p.insured_name, c.display_name) ILIKE $2)`, [insurerId, like])).rows;
  const typed = statement.statement_type === 'commission' ? [...debitNotes, ...remittance] : [...remittance, ...debitNotes];
  return [...typed, ...policies].map(recordOut);
}

/**
 * Broker records the statement is expected to list: the typed records dated in its period (remittance lines for a
 * premium statement, debit note lines for a commission statement).
 */
const expected = (statement, records) => {
  const type = statement.statement_type === 'commission' ? 'debit_note_line' : 'remittance_line';
  const from = String(statement.period_from instanceof Date ? statement.period_from.toISOString().slice(0, 10) : statement.period_from);
  const to = String(statement.period_to instanceof Date ? statement.period_to.toISOString().slice(0, 10) : statement.period_to);
  return records.filter((r) => r.type === type && r.date >= from && r.date <= to);
};

/** Differences between an insurer line and a broker record; status matched | difference. */
export function compare(line, record, statement) {
  const tol = Number(statement.tolerance) || 0;
  const d = {
    grossPremium: Number(line.gross_premium) ? round2(Number(line.gross_premium) - record.grossPremium) : 0,
    commission: Number(line.commission) ? round2(Number(line.commission) - record.commission) : 0,
    taxes: Number(line.taxes) ? round2(Number(line.taxes) - record.taxes) : 0,
    amountPaid: statement.statement_type === 'premium' && Number(line.amount_paid) ? round2(Number(line.amount_paid) - record.amount) : 0,
  };
  return { diffs: d, status: Object.values(d).some((x) => Math.abs(x) > tol + 0.0001) ? 'difference' : 'matched' };
}

async function setMatch(db, line, record, statement, source, user) {
  const { status } = compare(line, record, statement);
  await db.query(`UPDATE insurer_statement_lines SET match_status = $2, match_source = $3, broker_type = $4, broker_id = $5, policy_id = $6, broker_gross = $7, broker_commission = $8,
      broker_taxes = $9, broker_amount = $10, matched_by = $11, matched_at = now() WHERE id = $1`,
  [line.id, status, source, record.type, record.id, record.policyId || null, record.grossPremium, record.commission, record.taxes, record.amount, user?.id ?? null]);
  return status;
}

export async function statementRow(db, id, lock = false) {
  const s = (await db.query(`SELECT s.*, ic.name AS insurer_name, ic.code AS insurer_code FROM insurer_statements s JOIN insurance_companies ic ON ic.id = s.insurance_company_id
    WHERE s.id = $1 OR s.statement_number = $1${lock ? ' FOR UPDATE OF s' : ''}`, [String(id)])).rows[0];
  if (!s) throw notFound('Insurer statement not found');
  return s;
}
export const assertDraft = (s) => {
  if (s.status !== 'draft') throw conflict(`Statement ${s.statement_number} is ${s.status}; only a draft can be changed`);
};

/** Auto-match the unmatched lines of a statement. Returns { matched, differences, unmatched }. */
export async function autoMatch(db, statementId, user) {
  const s = await statementRow(db, statementId, true);
  assertDraft(s);
  const lines = (await db.query('SELECT * FROM insurer_statement_lines WHERE statement_id = $1 ORDER BY line_no', [s.id])).rows;
  const records = await brokerRecords(db, s);
  const used = new Set(lines.filter((l) => l.broker_id).map((l) => key(l.broker_type, l.broker_id)));
  const byPolicy = new Map();
  for (const r of records) {
    const k = normPolicy(r.policyNumber);
    if (k) byPolicy.set(k, [...(byPolicy.get(k) || []), r]);
  }
  const closest = (line, list) => list.sort((a, b) => Math.abs(Number(line.gross_premium) - a.grossPremium) - Math.abs(Number(line.gross_premium) - b.grossPremium)
    || Math.abs(Number(line.commission) - a.commission) - Math.abs(Number(line.commission) - b.commission))[0] || null;
  const tol = Number(s.tolerance) || 0;
  const periodRecords = expected(s, records);
  for (const line of lines.filter((l) => l.match_status === 'unmatched')) {
    const free = (byPolicy.get(normPolicy(line.policy_number)) || []).filter((r) => !used.has(key(r.type, r.id)));
    let pick = closest(line, free.filter((r) => r.type !== 'policy')) || closest(line, free.filter((r) => r.type === 'policy'));
    if (!pick && Number(line.gross_premium) && line.insured_name) {
      // policy number not found: the only unused record of the period with the same premium and insured
      const same = periodRecords.filter((r) => !used.has(key(r.type, r.id)) && Math.abs(r.grossPremium - Number(line.gross_premium)) <= tol && normName(r.insured) === normName(line.insured_name));
      if (same.length === 1) [pick] = same;
    }
    if (!pick) continue;
    used.add(key(pick.type, pick.id));
    line.match_status = await setMatch(db, line, pick, s, 'auto', user);
  }
  const counts = (await db.query('SELECT match_status, count(*)::int AS n FROM insurer_statement_lines WHERE statement_id = $1 GROUP BY match_status', [s.id])).rows;
  const n = (st) => counts.find((c) => c.match_status === st)?.n || 0;
  return { matched: n('matched'), differences: n('difference'), unmatched: n('unmatched') };
}

/** Match one line by hand to a broker record { brokerType, brokerId }. */
export async function manualMatch(db, statementId, lineId, b, user) {
  const s = await statementRow(db, statementId, true);
  assertDraft(s);
  const line = (await db.query('SELECT * FROM insurer_statement_lines WHERE id = $1 AND statement_id = $2 FOR UPDATE', [Number(lineId) || 0, s.id])).rows[0];
  if (!line) throw notFound('Statement line not found');
  const record = (await brokerRecords(db, s)).find((r) => r.type === b.brokerType && r.id === String(b.brokerId));
  if (!record) throw badRequest('Validation failed', [{ path: 'brokerId', message: `No ${b.brokerType || 'broker'} record ${b.brokerId} for ${s.insurer_name}` }]);
  const taken = (await db.query('SELECT line_no FROM insurer_statement_lines WHERE statement_id = $1 AND broker_type = $2 AND broker_id = $3 AND id <> $4', [s.id, record.type, record.id, line.id])).rows[0];
  if (taken) throw conflict(`That record is already matched to line ${taken.line_no}`);
  await db.query('DELETE FROM insurer_statement_resolutions WHERE line_id = $1', [line.id]);
  const status = await setMatch(db, line, record, s, 'manual', user);
  return { lineId: line.id, status, record };
}

/** Undo the match of a line (its resolution goes with it). */
export async function unmatch(db, statementId, lineId) {
  const s = await statementRow(db, statementId, true);
  assertDraft(s);
  const r = await db.query(`UPDATE insurer_statement_lines SET match_status = 'unmatched', match_source = NULL, broker_type = NULL, broker_id = NULL, policy_id = NULL, broker_gross = NULL,
    broker_commission = NULL, broker_taxes = NULL, broker_amount = NULL, matched_by = NULL, matched_at = NULL WHERE id = $1 AND statement_id = $2`, [Number(lineId) || 0, s.id]);
  if (!r.rowCount) throw notFound('Statement line not found');
  await db.query('DELETE FROM insurer_statement_resolutions WHERE line_id = $1', [Number(lineId)]);
}

const resolutionOut = (r) => r && ({
  id: Number(r.id), kind: r.kind, note: r.note, premiumAdjustment: Number(r.premium_adjustment), commissionAdjustment: Number(r.commission_adjustment),
  commissionSide: r.commission_side, journalId: r.journal_id, journalNumber: r.jv_number || null, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at,
});

export const lineOut = (l, statement, resolution) => {
  const matched = !!l.broker_id;
  const diffs = matched ? compare(l, { grossPremium: Number(l.broker_gross), commission: Number(l.broker_commission), taxes: Number(l.broker_taxes), amount: Number(l.broker_amount) }, statement).diffs : null;
  return {
    id: Number(l.id), lineNo: l.line_no, row: l.row_no, policyNumber: l.policy_number, insured: l.insured_name, date: l.txn_date instanceof Date ? l.txn_date.toISOString().slice(0, 10) : l.txn_date,
    reference: l.reference, grossPremium: Number(l.gross_premium), commission: Number(l.commission), taxes: Number(l.taxes), amountPaid: Number(l.amount_paid),
    matchStatus: l.match_status, matchSource: l.match_source, brokerType: l.broker_type, brokerId: l.broker_id, policyId: l.policy_id,
    broker: matched ? { grossPremium: Number(l.broker_gross), commission: Number(l.broker_commission), taxes: Number(l.broker_taxes), amount: Number(l.broker_amount) } : null,
    differences: diffs, resolution: resolutionOut(resolution),
  };
};

const RES_SELECT = `SELECT r.*, j.jv_number, (SELECT display_name FROM users u WHERE u.id = r.created_by) AS created_by_name
  FROM insurer_statement_resolutions r LEFT JOIN journal_vouchers j ON j.id = r.journal_id`;

/**
 * Differences report of a statement: { summary, missingInBroker, missingInInsurer, amountDifferences, matched }.
 * missingInInsurer: broker records of the period (remittance lines / debit note lines) no line matched.
 */
export async function differences(db, statementId) {
  const s = await statementRow(db, statementId);
  const lines = (await db.query('SELECT * FROM insurer_statement_lines WHERE statement_id = $1 ORDER BY line_no', [s.id])).rows;
  const resolutions = (await db.query(`${RES_SELECT} WHERE r.statement_id = $1`, [s.id])).rows;
  const byLine = new Map(resolutions.filter((r) => r.line_id).map((r) => [Number(r.line_id), r]));
  const byBroker = new Map(resolutions.filter((r) => r.broker_id).map((r) => [key(r.broker_type, r.broker_id), r]));
  const out = lines.map((l) => lineOut(l, s, byLine.get(Number(l.id))));
  const used = new Set(lines.filter((l) => l.broker_id).map((l) => key(l.broker_type, l.broker_id)));
  const missingInInsurer = expected(s, await brokerRecords(db, s)).filter((r) => !used.has(key(r.type, r.id)))
    .map((r) => ({ ...r, resolution: resolutionOut(byBroker.get(key(r.type, r.id))) }));
  const missingInBroker = out.filter((l) => l.matchStatus === 'unmatched');
  const amountDifferences = out.filter((l) => l.matchStatus === 'difference');
  const unresolved = [...missingInBroker, ...amountDifferences, ...missingInInsurer].filter((x) => !x.resolution).length;
  const sum = (list, f) => round2(list.reduce((t, x) => t + (f(x) || 0), 0));
  const matchedLines = out.filter((l) => l.broker);
  return {
    summary: {
      lines: out.length, matched: out.filter((l) => l.matchStatus === 'matched').length, differences: amountDifferences.length, missingInBroker: missingInBroker.length,
      missingInInsurer: missingInInsurer.length, unresolved,
      insurer: { grossPremium: sum(out, (l) => l.grossPremium), commission: sum(out, (l) => l.commission), taxes: sum(out, (l) => l.taxes), amountPaid: sum(out, (l) => l.amountPaid) },
      broker: { grossPremium: sum(matchedLines, (l) => l.broker.grossPremium), commission: sum(matchedLines, (l) => l.broker.commission), taxes: sum(matchedLines, (l) => l.broker.taxes),
        amount: sum(matchedLines, (l) => l.broker.amount) },
      differenceTotals: { grossPremium: sum(amountDifferences, (l) => l.differences.grossPremium), commission: sum(amountDifferences, (l) => l.differences.commission),
        amountPaid: sum(amountDifferences, (l) => l.differences.amountPaid) },
      adjustments: { premium: round2(resolutions.reduce((t, r) => t + Number(r.premium_adjustment), 0)), commission: round2(resolutions.reduce((t, r) => t + Number(r.commission_adjustment), 0)) },
    },
    lines: out, missingInBroker, missingInInsurer, amountDifferences,
  };
}

/**
 * Resolve a difference: { lineId } for an insurer line (not found or amounts differ) or { brokerType, brokerId } for a
 * broker record missing on the statement; kind note | adjustment with a note, and for an adjustment the premium
 * adjustment (+ = more due to the insurer) and / or the commission adjustment (+ = less commission for the broker).
 * Replaces an earlier resolution of the same item. The journal is posted when the reconciliation is approved.
 */
export async function resolve(db, statementId, b, user) {
  const s = await statementRow(db, statementId, true);
  assertDraft(s);
  const kind = b.kind === 'adjustment' ? 'adjustment' : 'note';
  const note = String(b.note || '').trim();
  if (note.length < 3) throw badRequest('Validation failed', [{ path: 'note', message: 'Explain the difference (at least 3 characters)' }]);
  const premium = kind === 'adjustment' ? round2(Number(b.premiumAdjustment) || 0) : 0;
  const commission = kind === 'adjustment' ? round2(Number(b.commissionAdjustment) || 0) : 0;
  if (kind === 'adjustment' && !premium && !commission) throw badRequest('Validation failed', [{ path: 'premiumAdjustment', message: 'An adjustment needs a premium or commission amount' }]);
  let target;
  if (b.lineId) {
    const l = (await db.query('SELECT * FROM insurer_statement_lines WHERE id = $1 AND statement_id = $2', [Number(b.lineId) || 0, s.id])).rows[0];
    if (!l) throw notFound('Statement line not found');
    if (l.match_status === 'matched') throw conflict(`Line ${l.line_no} matches the broker's records; there is nothing to resolve`);
    target = { lineId: l.id, brokerType: l.broker_type, brokerId: null, policyNumber: l.policy_number, direct: l.broker_type === 'debit_note_line' };
    if (l.policy_id && !target.direct) target.direct = (await db.query('SELECT billing_mode FROM policies WHERE id = $1', [l.policy_id])).rows[0]?.billing_mode === 'direct';
    await db.query('DELETE FROM insurer_statement_resolutions WHERE line_id = $1', [l.id]);
  } else {
    const r = expected(s, await brokerRecords(db, s)).find((x) => x.type === b.brokerType && x.id === String(b.brokerId));
    if (!r) throw badRequest('Validation failed', [{ path: 'brokerId', message: 'Not a broker record of the statement period' }]);
    target = { lineId: null, brokerType: r.type, brokerId: r.id, policyNumber: r.policyNumber, direct: r.billingMode === 'direct' };
    await db.query('DELETE FROM insurer_statement_resolutions WHERE statement_id = $1 AND broker_type = $2 AND broker_id = $3', [s.id, r.type, r.id]);
  }
  const side = commission ? (target.direct ? 'commission_receivable' : 'due_to_insurer') : null;
  const r = (await db.query(`INSERT INTO insurer_statement_resolutions(statement_id, line_id, broker_type, broker_id, policy_number, kind, note, premium_adjustment, commission_adjustment,
      commission_side, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [s.id, target.lineId, target.lineId ? null : target.brokerType, target.brokerId, target.policyNumber, kind, note, premium, commission, side, user?.id ?? null])).rows[0];
  return resolutionOut((await db.query(`${RES_SELECT} WHERE r.id = $1`, [r.id])).rows[0]);
}

export async function removeResolution(db, statementId, resolutionId) {
  const s = await statementRow(db, statementId, true);
  assertDraft(s);
  const r = await db.query('DELETE FROM insurer_statement_resolutions WHERE id = $1 AND statement_id = $2', [Number(resolutionId) || 0, s.id]);
  if (!r.rowCount) throw notFound('Resolution not found');
}
