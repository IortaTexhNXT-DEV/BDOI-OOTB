/**
 * Insurer statement reconciliation: list and detail, workflow (draft -> submitted -> approved; rejected back to draft;
 * a draft can be cancelled) and the differences report export.
 *
 * Maker-checker: the approver holds approve:insurer-reconciliation (Accounting Manager) and must not be the preparer.
 * Approval posts the adjustment journal of every adjustment resolution through the posting rule
 * insurer_statement.adjustment and locks the statement.
 */
import { badRequest, conflict } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { round2 } from '../../lib/money.js';
import { postEvent } from '../accounting/lib/posting.js';
import { account } from '../accounting/lib/ledger.js';
import { STATEMENT_TYPES } from './statements.js';
import { differences, statementRow } from './matching.js';

const at = (v) => (v ? new Date(v).toISOString() : null);

export const statementOut = (s) => ({
  id: s.id, statementNumber: s.statement_number, insurerId: s.insurance_company_id, insurerCode: s.insurer_code, insurerName: s.insurer_name,
  statementType: s.statement_type, statementTypeLabel: STATEMENT_TYPES[s.statement_type], statementRef: s.statement_ref, periodFrom: s.period_from, periodTo: s.period_to,
  formatCode: s.format_code, fileName: s.file_name, tolerance: Number(s.tolerance), lineCount: s.line_count,
  totals: { grossPremium: Number(s.total_gross), commission: Number(s.total_commission), taxes: Number(s.total_taxes), amountPaid: Number(s.total_paid) },
  status: s.status, remarks: s.remarks, createdBy: s.created_by_name || s.created_by, createdById: s.created_by, createdAt: at(s.created_at),
  submittedBy: s.submitted_by_name || s.submitted_by, submittedAt: at(s.submitted_at), approvedBy: s.approved_by_name || s.approved_by, approvedAt: at(s.approved_at),
  approvalRemarks: s.approval_remarks, rejectedBy: s.rejected_by_name || s.rejected_by, rejectedAt: at(s.rejected_at), rejectionReason: s.rejection_reason,
  matched: s.matched ?? undefined, unresolved: s.unresolved ?? undefined,
});

const NAMES = `(SELECT display_name FROM users u WHERE u.id = s.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = s.submitted_by) AS submitted_by_name,
  (SELECT display_name FROM users u WHERE u.id = s.approved_by) AS approved_by_name, (SELECT display_name FROM users u WHERE u.id = s.rejected_by) AS rejected_by_name`;

export async function listStatements(db, qs = {}) {
  const conds = ['TRUE'];
  const vals = [];
  const add = (sql, v) => { vals.push(v); conds.push(sql.replaceAll('?', `$${vals.length}`)); };
  if (qs.insurerId || qs.insurerCode) add('(ic.id::text = ? OR ic.code = ?)', String(qs.insurerId ?? qs.insurerCode));
  if (qs.status && qs.status !== 'all') add('s.status = ?', String(qs.status));
  if (qs.statementType) add('s.statement_type = ?', String(qs.statementType));
  if (qs.from) add('s.period_to >= ?::date', String(qs.from));
  if (qs.to) add('s.period_from <= ?::date', String(qs.to));
  const rows = (await db.query(`SELECT s.*, ic.name AS insurer_name, ic.code AS insurer_code, ${NAMES},
      (SELECT count(*)::int FROM insurer_statement_lines l WHERE l.statement_id = s.id AND l.match_status = 'matched') AS matched
    FROM insurer_statements s JOIN insurance_companies ic ON ic.id = s.insurance_company_id WHERE ${conds.join(' AND ')}
    ORDER BY s.period_to DESC, s.created_at DESC LIMIT 500`, vals)).rows;
  return rows.map(statementOut);
}

/** Statement header with its lines, the differences report and the audit of its workflow. */
export async function getStatement(db, id) {
  const base = await statementRow(db, id);
  const s = (await db.query(`SELECT s.*, ic.name AS insurer_name, ic.code AS insurer_code, ${NAMES} FROM insurer_statements s JOIN insurance_companies ic ON ic.id = s.insurance_company_id
    WHERE s.id = $1`, [base.id])).rows[0];
  const report = await differences(db, s.id);
  return { ...statementOut(s), summary: report.summary, lines: report.lines, missingInBroker: report.missingInBroker, missingInInsurer: report.missingInInsurer,
    amountDifferences: report.amountDifferences };
}

/** Submit a draft for approval; with insurer_reconciliation.require_resolved every difference must be resolved first. */
export async function submit(db, id, user) {
  const s = await statementRow(db, id, true);
  if (s.status !== 'draft') throw conflict(`Statement ${s.statement_number} is ${s.status}; only a draft can be submitted`);
  const { summary } = await differences(db, s.id);
  if (summary.unresolved && (await getSetting('insurer_reconciliation.require_resolved', true)) !== false) {
    throw conflict(`${summary.unresolved} difference(s) of ${s.statement_number} are not resolved; resolve each with a note or an adjustment before submitting`);
  }
  await db.query('UPDATE insurer_statements SET status = \'submitted\', submitted_by = $2, submitted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [s.id, user.id]);
  return { before: { status: s.status }, after: await getStatement(db, s.id) };
}

/**
 * Approve (posts the adjustment journals, locks the statement) or reject (back to draft, reason required). The approver
 * must not be the preparer or the submitter.
 */
export async function decide(db, id, action, remarks, user) {
  const s = await statementRow(db, id, true);
  if (s.status !== 'submitted') throw conflict(`Statement ${s.statement_number} is ${s.status}; only a submitted statement can be ${action === 'approve' ? 'approved' : 'rejected'}`);
  await assertChecker(user, s.created_by, 'insurer statement reconciliation');
  await assertChecker(user, s.submitted_by, 'insurer statement reconciliation');
  if (action === 'reject') {
    if (!String(remarks || '').trim()) throw badRequest('Validation failed', [{ path: 'remarks', message: 'A reason is required to reject' }]);
    await db.query(`UPDATE insurer_statements SET status = 'draft', rejected_by = $2, rejected_at = now(), rejection_reason = $3, submitted_by = NULL, submitted_at = NULL,
      updated_by = $2, updated_at = now() WHERE id = $1`, [s.id, user.id, String(remarks).trim()]);
    return { before: { status: s.status }, after: await getStatement(db, s.id), submittedBy: s.submitted_by };
  }
  const adjustments = (await db.query('SELECT * FROM insurer_statement_resolutions WHERE statement_id = $1 AND kind = \'adjustment\' AND journal_id IS NULL ORDER BY id', [s.id])).rows;
  for (const r of adjustments) {
    const policy = r.policy_number ? (await db.query('SELECT id, client_id FROM policies WHERE policy_number = $1', [r.policy_number])).rows[0] : null;
    const jv = await postEvent('insurer_statement.adjustment', {
      source: 'remittance', entryType: 'REMITTANCE', transactionCode: s.statement_number, referenceType: 'InsurerStatement', referenceId: s.id,
      policyId: policy?.id || null, policyNumber: r.policy_number || null, clientId: policy?.client_id || null, insuranceCompanyId: s.insurance_company_id, payeeType: 'Insurer',
      description: `Insurer statement ${s.statement_number} adjustment ${r.policy_number || ''} (${s.insurer_name})`.replace(/\s+/g, ' '),
      accounts: { commission_offset: r.commission_side ? await account(r.commission_side) : undefined },
      amounts: { premium: round2(r.premium_adjustment), commission: round2(r.commission_adjustment) },
      vars: { statementNumber: s.statement_number, statementRef: s.statement_ref || s.statement_number, insurer: s.insurer_name, policyNumber: r.policy_number || '', note: r.note },
    }, { db, user });
    await db.query('UPDATE insurer_statement_resolutions SET journal_id = $2 WHERE id = $1', [r.id, jv.id]);
  }
  await db.query('UPDATE insurer_statements SET status = \'approved\', approved_by = $2, approved_at = now(), approval_remarks = $3, updated_by = $2, updated_at = now() WHERE id = $1',
    [s.id, user.id, remarks || null]);
  return { before: { status: s.status }, after: await getStatement(db, s.id), journals: adjustments.length, submittedBy: s.submitted_by };
}

/** Cancel a draft statement imported in error (the same file can then be imported again). */
export async function cancel(db, id, reason, user) {
  const s = await statementRow(db, id, true);
  if (s.status !== 'draft') throw conflict(`Statement ${s.statement_number} is ${s.status}; only a draft can be cancelled`);
  await db.query('UPDATE insurer_statements SET status = \'cancelled\', remarks = COALESCE($3, remarks), updated_by = $2, updated_at = now() WHERE id = $1', [s.id, user.id, reason || null]);
  return { before: { status: s.status }, after: { id: s.id, statementNumber: s.statement_number, status: 'cancelled' } };
}

// ---------- differences report (Excel / PDF) ----------

const STATUS_LABELS = { matched: 'Matched', difference: 'Amount difference', unmatched: 'Not found at the broker' };
const resolutionText = (r) => (r ? `${r.kind === 'adjustment' ? `Adjustment (premium ${r.premiumAdjustment.toFixed(2)}, commission ${r.commissionAdjustment.toFixed(2)})` : 'Note'}: ${r.note}${r.journalNumber ? ` [${r.journalNumber}]` : ''}` : '');

/** Rows of the report: every insurer line, then the broker records missing on the statement. */
export function reportRows(st) {
  const lines = st.lines.map((l) => [l.lineNo, l.policyNumber, l.insured || '', l.date || '', l.reference || '', STATUS_LABELS[l.matchStatus],
    l.grossPremium, l.broker?.grossPremium ?? '', l.differences?.grossPremium ?? '', l.commission, l.broker?.commission ?? '', l.differences?.commission ?? '',
    l.amountPaid, l.broker?.amount ?? '', l.differences?.amountPaid ?? '', l.brokerType || '', resolutionText(l.resolution)]);
  const missing = st.missingInInsurer.map((r) => ['', r.policyNumber, r.insured || '', r.date || '', r.document || '', 'Missing on the insurer statement',
    '', r.grossPremium, '', '', r.commission, '', '', r.amount, '', r.type, resolutionText(r.resolution)]);
  return [...lines, ...missing];
}
export const REPORT_HEADER = ['Line', 'Policy No', 'Insured', 'Date', 'Reference', 'Status', 'Insurer gross premium', 'Broker gross premium', 'Premium difference',
  'Insurer commission', 'Broker commission', 'Commission difference', 'Insurer amount paid', 'Broker amount', 'Amount difference', 'Broker record', 'Resolution'];

/** Document spec (documents/pdf.js buildPdf) of the differences report. */
export function reportPdfSpec(st, company) {
  const m = (v) => round2(v || 0);
  const s = st.summary;
  const diffTable = (list, columns, row) => ({ columns, rows: list.map(row) });
  const sections = [
    { heading: 'Summary', rows: [['Lines on the statement', String(s.lines)], ['Matched', String(s.matched)], ['Amount differences', String(s.differences)],
      ['Not found at the broker', String(s.missingInBroker)], ['Missing on the insurer statement', String(s.missingInInsurer)], ['Unresolved', String(s.unresolved)],
      ['Insurer gross premium / commission', `${m(s.insurer.grossPremium).toFixed(2)} / ${m(s.insurer.commission).toFixed(2)}`],
      ['Broker gross premium / commission (matched)', `${m(s.broker.grossPremium).toFixed(2)} / ${m(s.broker.commission).toFixed(2)}`],
      ['Adjustments: premium / commission', `${m(s.adjustments.premium).toFixed(2)} / ${m(s.adjustments.commission).toFixed(2)}`]] },
  ];
  if (st.amountDifferences.length) {
    sections.push({ heading: `Amount differences (${st.amountDifferences.length})`, table: diffTable(st.amountDifferences, ['Policy', 'Premium diff.', 'Commission diff.', 'Paid diff.', 'Resolution'],
      (l) => [l.policyNumber, m(l.differences.grossPremium), m(l.differences.commission), m(l.differences.amountPaid), resolutionText(l.resolution).slice(0, 80)]) });
  }
  if (st.missingInBroker.length) {
    sections.push({ heading: `Not found at the broker (${st.missingInBroker.length})`, table: diffTable(st.missingInBroker, ['Policy', 'Insured', 'Gross premium', 'Commission', 'Resolution'],
      (l) => [l.policyNumber, (l.insured || '').slice(0, 30), m(l.grossPremium), m(l.commission), resolutionText(l.resolution).slice(0, 80)]) });
  }
  if (st.missingInInsurer.length) {
    sections.push({ heading: `Missing on the insurer statement (${st.missingInInsurer.length})`, table: diffTable(st.missingInInsurer, ['Policy', 'Document', 'Gross premium', 'Commission', 'Resolution'],
      (r) => [r.policyNumber, r.document, m(r.grossPremium), m(r.commission), resolutionText(r.resolution).slice(0, 80)]) });
  }
  sections.push({ heading: 'Sign-off', rows: [['Prepared by', st.createdBy || '-'], ['Submitted by', st.submittedBy || '-'], ['Approved by', st.approvedBy || '-'], ['Approved at', st.approvedAt || '-']] });
  return {
    title: 'Insurer Statement Reconciliation',
    subtitle: `${company.name || ''}${company.name ? ' - ' : ''}${st.statementNumber}`,
    meta: [['Insurer', st.insurerName], ['Statement', `${st.statementTypeLabel}${st.statementRef ? ` ${st.statementRef}` : ''}`], ['Period', `${st.periodFrom} to ${st.periodTo}`],
      ['Tolerance', `PHP ${Number(st.tolerance).toFixed(2)}`], ['Status', st.status.toUpperCase()]],
    sections,
    footer: `${company.system || company.name || ''} - generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
  };
}
