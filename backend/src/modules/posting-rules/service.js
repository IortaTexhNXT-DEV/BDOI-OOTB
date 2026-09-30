/**
 * Posting Rules master and Account Determination.
 *
 * Posting rules: one versioned rule per business event (see EVENTS in accounting/lib/posting.js). Editing a rule creates
 * a new version effective from a date; the version in force on a posting date is the latest active one. A version is
 * saved only when its lines are valid for the event (amount keys the event supplies, known roles / resolvers, active GL
 * codes) and the journal it builds for the event's sample context balances.
 *
 * Account determination: the account roles the rules reference (accounting.account.<role>), the payable account per payee
 * type, the cash account per payment mode and the write-off reasons. What this screen shows is what posting uses.
 */
import { getSetting, setSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { AMOUNT_KEYS, EVENTS, RESOLVERS, activeRule, ruleOut, simulate } from '../accounting/lib/posting.js';
import { today } from '../accounting/lib/http.js';
import { commissionTaxSetup } from '../accounting/lib/commissionTax.js';

const SIDES = ['Dr', 'Cr'];
const ACCOUNT_TYPES = ['role', 'gl', 'resolver', 'context'];
export const BRANCH_SOURCES = ['policy_owner', 'user', 'context', 'none'];

/** Account Determination sections (the former Premium / Customer / Miscellaneous / RI-Claims account setup screens). */
export const ROLE_SECTIONS = {
  premium: ['premium_receivable', 'due_to_insurer', 'premium_vat_payable', 'premium_dst_payable', 'premium_lgt_payable', 'commission_income', 'commission_receivable', 'insurer_refund_receivable', 'output_vat', 'creditable_wht'],
  customer: ['cash_in_bank', 'cash_on_hand', 'client_refund_payable', 'agent_receivable', 'commission_payable', 'commission_expense', 'wht_payable', 'incentive_expense', 'incentive_payable'],
  miscellaneous: ['petty_cash_fund', 'employee_advances', 'input_vat', 'supplier_payable', 'write_off', 'remittance_adjustment'],
  'ri-claims': ['ri_premium_receivable', 'due_to_reinsurer', 'ri_commission_income', 'due_from_reinsurer', 'ri_recovery_payable', 'claims_receivable', 'claims_payable'],
};
const sectionOf = (role) => Object.entries(ROLE_SECTIONS).find(([, roles]) => roles.includes(role))?.[0] || 'other';

async function roleRows(db) {
  return (await db.query(`SELECT s.key, s.value, s.label, s.updated_at, s.updated_by, a.name AS gl_name, a.status AS gl_status FROM app_settings s
    LEFT JOIN gl_accounts a ON a.code = (s.value #>> '{}') WHERE s.key LIKE 'accounting.account.%' ORDER BY s.key`)).rows;
}
export async function roleNames(db) {
  return new Set((await roleRows(db)).map((r) => r.key.slice('accounting.account.'.length)));
}

// ---------- posting rules ----------

async function rulesWithLines(db, rows) {
  if (!rows.length) return [];
  const lines = (await db.query('SELECT * FROM posting_rule_lines WHERE rule_id = ANY($1) ORDER BY rule_id, line_no', [rows.map((r) => r.id)])).rows;
  return rows.map((r) => ruleOut(r, lines.filter((l) => l.rule_id === r.id)));
}

/** Event catalogue with the version in force today. */
export async function events(db) {
  const date = await today();
  const counts = new Map((await db.query('SELECT event_code, count(*)::int AS n, max(updated_at) AS last FROM posting_rules GROUP BY event_code')).rows.map((r) => [r.event_code, r]));
  const out = [];
  for (const [code, e] of Object.entries(EVENTS)) {
    let current = null;
    try { current = (await activeRule(db, code, date)).rule; } catch { current = null; }
    out.push({ eventCode: code, label: e.label, module: e.module, amountKeys: e.amounts || [], vars: e.vars || [], contextAccounts: e.contextAccounts || [], perParticipant: !!e.participants,
      activeRuleId: current?.id || null, activeVersion: current?.version || null, name: current?.name || e.label, description: current?.description || null,
      effectiveFrom: current ? ruleOut(current).effectiveFrom : null, versions: counts.get(code)?.n || 0, lastChanged: counts.get(code)?.last || null });
  }
  return out;
}

/** Pickers of the rule editor: sides, account types, roles (with GL), resolvers, amount keys, branch sources. */
export async function meta(db) {
  const roles = (await roleRows(db)).map((r) => ({ role: r.key.slice('accounting.account.'.length), label: String(r.label || '').replace(/^GL:\s*/, ''), glCode: r.value, glName: r.gl_name, section: sectionOf(r.key.slice('accounting.account.'.length)) }));
  return { sides: SIDES, accountTypes: ACCOUNT_TYPES, branchSources: BRANCH_SOURCES, amountKeys: AMOUNT_KEYS, roles,
    resolvers: Object.entries(RESOLVERS).map(([name, r]) => ({ name, label: r.label })) };
}

export async function listRules(db, q = {}) {
  const rows = (await db.query(`SELECT * FROM posting_rules WHERE ($1::text IS NULL OR event_code = $1) AND ($2::text IS NULL OR module = $2)
    ORDER BY event_code, version DESC`, [q.eventCode || null, q.module || null])).rows;
  return rulesWithLines(db, rows);
}

export async function getRule(db, id) {
  const r = (await db.query('SELECT * FROM posting_rules WHERE id = $1', [Number(id) || 0])).rows[0];
  if (!r) throw notFound('Posting rule not found');
  return (await rulesWithLines(db, [r]))[0];
}

/** Lines from the editor, normalised and checked against the event (throws 400 with the problems found). */
export async function cleanLines(db, eventCode, lines) {
  const ev = EVENTS[eventCode];
  if (!ev) throw badRequest(`Unknown posting event ${eventCode}`);
  if (!Array.isArray(lines) || lines.length < 2) throw badRequest('Validation failed', [{ path: 'lines', message: 'A posting rule needs at least two lines' }]);
  const roles = await roleNames(db);
  const errors = [];
  const out = [];
  for (const [i, l] of lines.entries()) {
    const at = `lines[${i}]`;
    const side = l.side === 'Debit' ? 'Dr' : l.side === 'Credit' ? 'Cr' : l.side;
    if (!SIDES.includes(side)) errors.push({ path: `${at}.side`, message: 'Side must be Dr or Cr' });
    const type = l.accountType;
    const acct = String(l.account ?? '').trim();
    if (!ACCOUNT_TYPES.includes(type)) errors.push({ path: `${at}.accountType`, message: `Account type must be one of ${ACCOUNT_TYPES.join(', ')}` });
    else if (!acct) errors.push({ path: `${at}.account`, message: 'Account is required' });
    else if (type === 'role' && !roles.has(acct)) errors.push({ path: `${at}.account`, message: `Unknown account role ${acct}` });
    else if (type === 'resolver' && !RESOLVERS[acct]) errors.push({ path: `${at}.account`, message: `Unknown resolver ${acct}` });
    else if (type === 'gl' && !(await db.query('SELECT 1 FROM gl_accounts WHERE code = $1 AND status = \'active\'', [acct])).rows[0]) errors.push({ path: `${at}.account`, message: `GL account ${acct} is not an active account` });
    else if (type === 'context' && !/^[a-z][a-z0-9_]*$/.test(acct)) errors.push({ path: `${at}.account`, message: 'Context account key must be lower case letters, digits and _' });
    const fallback = l.fallbackRole ? String(l.fallbackRole) : null;
    if (fallback && !roles.has(fallback)) errors.push({ path: `${at}.fallbackRole`, message: `Unknown account role ${fallback}` });
    if (!(ev.amounts || []).includes(l.amountKey)) errors.push({ path: `${at}.amountKey`, message: `Amount ${l.amountKey} is not supplied by ${eventCode} (${(ev.amounts || []).join(', ')})` });
    const perParticipant = l.perParticipant === true;
    if (perParticipant && !ev.participants) errors.push({ path: `${at}.perParticipant`, message: `${eventCode} has no co-insurance participants` });
    out.push({ line_no: i + 1, side, account_type: type, account: acct, fallback_role: fallback, amount_key: l.amountKey, per_participant: perParticipant,
      narration: l.narration === undefined || l.narration === null || l.narration === '' ? null : String(l.narration) });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return out;
}

/** Simulate a rule: a saved version (ruleId), unsaved lines, or the version in force. */
export async function simulateRule(db, b) {
  const eventCode = b.eventCode;
  let rule = null;
  if (b.ruleId) {
    const r = (await db.query('SELECT * FROM posting_rules WHERE id = $1', [Number(b.ruleId) || 0])).rows[0];
    if (!r) throw notFound('Posting rule not found');
    rule = { rule: r, lines: (await db.query('SELECT * FROM posting_rule_lines WHERE rule_id = $1 ORDER BY line_no', [r.id])).rows };
  } else if (Array.isArray(b.lines)) {
    const current = await activeRule(db, eventCode, await today()).catch(() => null);
    rule = { rule: { ...(current?.rule || { name: EVENTS[eventCode]?.label, narration: null, source: null, entry_type: null }), branch_source: b.branchSource || current?.rule.branch_source || 'none', narration: b.narration ?? current?.rule.narration },
      lines: await cleanLines(db, eventCode, b.lines) };
  }
  return simulate(db, rule?.rule.event_code || eventCode, { context: b.context || null, rule, coInsurance: b.coInsurance === true });
}

/**
 * Save a new version of an event's rule. The sample journal (and, for co-insurance events, the co-insured sample) must
 * balance. Returns { before, after }.
 */
export async function createVersion(db, eventCode, b, user) {
  const ev = EVENTS[eventCode];
  if (!ev) throw notFound(`Unknown posting event ${eventCode}`);
  const lines = await cleanLines(db, eventCode, b.lines);
  const branchSource = b.branchSource || 'policy_owner';
  if (!BRANCH_SOURCES.includes(branchSource)) throw badRequest('Validation failed', [{ path: 'branchSource', message: `Branch source must be one of ${BRANCH_SOURCES.join(', ')}` }]);
  const effectiveFrom = b.effectiveFrom || (await today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveFrom))) throw badRequest('Validation failed', [{ path: 'effectiveFrom', message: 'Effective from must be a date (YYYY-MM-DD)' }]);
  const prev = (await db.query('SELECT * FROM posting_rules WHERE event_code = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE', [eventCode])).rows[0];
  const draft = { rule: { event_code: eventCode, name: b.name || prev?.name || ev.label, narration: b.narration ?? prev?.narration ?? null, source: b.source ?? prev?.source ?? null,
    entry_type: b.entryType ?? prev?.entry_type ?? null, branch_source: 'none' }, lines };
  const problems = [];
  for (const coInsurance of ev.participants ? [false, true] : [false]) {
    const sim = await simulate(db, eventCode, { rule: draft, coInsurance }).catch((e) => ({ error: e.message }));
    if (sim.error) problems.push({ path: 'lines', message: sim.error });
    else if (!sim.balanced) problems.push({ path: 'lines', message: `The ${coInsurance ? 'co-insured ' : ''}sample journal does not balance: debit ${sim.totalDebit} vs credit ${sim.totalCredit}` });
  }
  if (problems.length) throw badRequest('Validation failed', problems);
  const version = (prev?.version || 0) + 1;
  const r = (await db.query(`INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, effective_from, active, change_note, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$12) RETURNING *`,
  [eventCode, version, draft.rule.name, b.description ?? prev?.description ?? null, ev.module, draft.rule.entry_type, draft.rule.source, draft.rule.narration, branchSource, effectiveFrom,
    b.changeNote || null, user?.id ?? null])).rows[0];
  for (const l of lines) {
    await db.query(`INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [r.id, l.line_no, l.side, l.account_type, l.account, l.fallback_role, l.amount_key, l.per_participant, l.narration]);
  }
  return { before: prev ? await getRule(db, prev.id) : null, after: await getRule(db, r.id) };
}

/** Activate / deactivate a version; an event always keeps at least one active version. */
export async function setActive(db, id, active, user) {
  const r = (await db.query('SELECT * FROM posting_rules WHERE id = $1 FOR UPDATE', [Number(id) || 0])).rows[0];
  if (!r) throw notFound('Posting rule not found');
  if (!active) {
    const others = (await db.query('SELECT count(*)::int AS n FROM posting_rules WHERE event_code = $1 AND active AND id <> $2 AND effective_from <= $3::date', [r.event_code, r.id, await today()])).rows[0].n;
    if (!others) throw conflict(`Version ${r.version} is the only version of ${r.event_code} in force; save a new version before deactivating it`);
  }
  await db.query('UPDATE posting_rules SET active = $2, updated_by = $3, updated_at = now() WHERE id = $1', [r.id, !!active, user?.id ?? null]);
  return { before: await getRule(db, r.id).then((x) => ({ ...x, active: r.active })), after: await getRule(db, r.id) };
}

// ---------- account determination ----------

export async function accountDetermination(db) {
  const rows = await roleRows(db);
  const used = (await db.query(`SELECT DISTINCT r.event_code, COALESCE(NULLIF(l.fallback_role, ''), l.account) AS role FROM posting_rule_lines l JOIN posting_rules r ON r.id = l.rule_id
    WHERE r.active AND (l.account_type = 'role' OR l.fallback_role IS NOT NULL)`)).rows;
  const roles = rows.map((r) => {
    const role = r.key.slice('accounting.account.'.length);
    return { role, key: r.key, label: String(r.label || '').replace(/^GL:\s*/, ''), glCode: r.value, glName: r.gl_name, glActive: r.gl_status === 'active', section: sectionOf(role),
      usedBy: [...new Set(used.filter((u) => u.role === role).map((u) => u.event_code))].sort(), updatedAt: r.updated_at, updatedBy: r.updated_by };
  });
  const sections = [...Object.keys(ROLE_SECTIONS), 'other'].map((s) => ({ section: s, roles: roles.filter((r) => r.section === s) })).filter((s) => s.roles.length);
  return {
    sections,
    payableByPayee: (await getSetting('accounting.payable_account_by_payee', {})) || {},
    cashByPaymentMode: (await getSetting('accounting.cash_account_by_payment_mode', {})) || {},
    writeOffReasons: await listWriteOffReasons(db, { all: true }),
    splitPremiumTaxes: (await getSetting('accounting.split_premium_taxes', true)) !== false,
  };
}

async function assertGl(db, code, path = 'glCode') {
  const a = (await db.query('SELECT code, name, status FROM gl_accounts WHERE code = $1', [String(code || '')])).rows[0];
  if (!a || a.status !== 'active') throw badRequest('Validation failed', [{ path, message: `GL account ${code} is not an active account` }]);
  return a;
}

export async function setRoleAccount(db, role, glCode, user) {
  const key = `accounting.account.${role}`;
  const before = (await db.query('SELECT value FROM app_settings WHERE key = $1', [key])).rows[0];
  if (!before) throw notFound(`Unknown account role ${role}`);
  const a = await assertGl(db, glCode);
  await setSetting(key, a.code, user?.id ?? null);
  return { before: { role, glCode: before.value }, after: { role, glCode: a.code, glName: a.name } };
}

const MAPS = { 'payable-by-payee': 'accounting.payable_account_by_payee', 'cash-by-payment-mode': 'accounting.cash_account_by_payment_mode' };
export async function setMap(db, name, map, user) {
  const key = MAPS[name];
  if (!key) throw notFound(`Unknown account map ${name}`);
  if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length) throw badRequest('Validation failed', [{ path: 'map', message: 'map must be an object of name -> GL code' }]);
  const clean = {};
  for (const [k, v] of Object.entries(map)) clean[String(k)] = (await assertGl(db, v, `map.${k}`)).code;
  const before = await getSetting(key, {});
  await setSetting(key, clean, user?.id ?? null);
  return { before, after: clean };
}

// ---------- commission taxes (broker billed) ----------

const COMMISSION_TAX_KEYS = { vatEnabled: 'accounting.broker_billed_commission_vat', ewtEnabled: 'accounting.broker_billed_commission_ewt',
  vatCode: 'tax.commission_vat_code', ewtCode: 'tax.commission_ewt_code' };

/** Output VAT and EWT on broker-billed commission: switches, tax codes (rate, ATC, GL) and the accounts posting falls back to. */
export async function commissionTaxes(db) {
  const setup = await commissionTaxSetup(db);
  const fallback = async (role) => (await db.query('SELECT value #>> \'{}\' AS gl FROM app_settings WHERE key = $1', [`accounting.account.${role}`])).rows[0]?.gl || null;
  const codes = (await db.query(`SELECT code, description, tax_type, rate, atc, gl_account, active FROM tax_codes WHERE tax_type IN ('VAT', 'EWT') AND applies_to IN ('sales', 'both')
    ORDER BY tax_type, sort_order, code`)).rows.map((t) => ({ code: t.code, description: t.description, taxType: t.tax_type, rate: Number(t.rate), atc: t.atc, glAccount: t.gl_account, active: t.active }));
  const out = (kind, role) => ({ enabled: setup[kind].enabled, code: setup[kind].code, ratePercent: Math.round(setup[kind].rate * 10000) / 100, atc: setup[kind].atc,
    description: setup[kind].description, glAccount: setup[kind].glAccount, fallbackRole: role, codeFound: setup[kind].found, codeActive: setup[kind].active });
  return { vat: { ...out('vat', 'output_vat'), fallbackGl: await fallback('output_vat') }, ewt: { ...out('ewt', 'creditable_wht'), fallbackGl: await fallback('creditable_wht') }, taxCodes: codes };
}

/** Settings changes of the commission tax set-up (validated): { key: value }. */
export async function commissionTaxChanges(db, b) {
  const changes = {};
  for (const [field, key] of Object.entries(COMMISSION_TAX_KEYS)) {
    if (b[field] === undefined) continue;
    if (field.endsWith('Enabled')) { changes[key] = b[field] === true; continue; }
    const code = String(b[field] || '').trim();
    const t = (await db.query('SELECT tax_type, active FROM tax_codes WHERE code = $1', [code])).rows[0];
    const want = field === 'vatCode' ? 'VAT' : 'EWT';
    if (!t || t.tax_type !== want) throw badRequest('Validation failed', [{ path: field, message: `${code || 'Tax code'} is not a ${want} tax code` }]);
    if (!t.active) throw badRequest('Validation failed', [{ path: field, message: `Tax code ${code} is inactive` }]);
    changes[key] = code;
  }
  if (!Object.keys(changes).length) throw badRequest('Validation failed', [{ path: 'body', message: 'Nothing to change' }]);
  return changes;
}

export async function setCommissionTaxes(db, b, user) {
  const before = await commissionTaxes(db);
  for (const [key, value] of Object.entries(await commissionTaxChanges(db, b))) await setSetting(key, value, user?.id ?? null);
  return { before, after: await commissionTaxes(db) };
}

// ---------- write-off reasons ----------

const reasonOut = (r) => ({ id: r.id, code: r.code, name: r.name, glAccount: r.gl_account, glName: r.gl_name || null, maxAmount: r.max_amount === null ? null : Number(r.max_amount),
  description: r.description, status: r.status, updatedAt: r.updated_at });

export async function listWriteOffReasons(db, { all = false } = {}) {
  return (await db.query(`SELECT w.*, a.name AS gl_name FROM write_off_reasons w LEFT JOIN gl_accounts a ON a.code = w.gl_account
    WHERE $1 OR w.status = 'active' ORDER BY w.code`, [all])).rows.map(reasonOut);
}

export async function saveWriteOffReason(db, code, b, user) {
  const existing = code ? (await db.query('SELECT * FROM write_off_reasons WHERE code = $1 FOR UPDATE', [code])).rows[0] : null;
  if (code && !existing) throw notFound(`Write-off reason ${code} not found`);
  const newCode = String(b.code ?? existing?.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(newCode)) throw badRequest('Validation failed', [{ path: 'code', message: 'Code: 2-30 letters, digits, _ or -' }]);
  const name = String(b.name ?? existing?.name ?? '').trim();
  if (!name) throw badRequest('Validation failed', [{ path: 'name', message: 'Reason is required' }]);
  const gl = (await assertGl(db, b.glAccount ?? existing?.gl_account, 'glAccount')).code;
  const max = b.maxAmount === undefined ? existing?.max_amount ?? null : (b.maxAmount === null || b.maxAmount === '' ? null : Number(b.maxAmount));
  if (max !== null && !(Number(max) > 0)) throw badRequest('Validation failed', [{ path: 'maxAmount', message: 'Maximum amount must be greater than zero' }]);
  const status = b.status ? (String(b.status).toLowerCase() === 'inactive' ? 'inactive' : 'active') : existing?.status || 'active';
  if (!existing && (await db.query('SELECT 1 FROM write_off_reasons WHERE code = $1', [newCode])).rows[0]) throw conflict(`Write-off reason ${newCode} already exists`);
  const r = existing
    ? (await db.query(`UPDATE write_off_reasons SET name = $2, gl_account = $3, max_amount = $4, description = $5, status = $6, updated_by = $7, updated_at = now() WHERE id = $1 RETURNING *`,
      [existing.id, name, gl, max, b.description ?? existing.description, status, user?.id ?? null])).rows[0]
    : (await db.query(`INSERT INTO write_off_reasons(code, name, gl_account, max_amount, description, status, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [newCode, name, gl, max, b.description || null, status, user?.id ?? null])).rows[0];
  return { before: existing ? reasonOut(existing) : null, after: reasonOut(r) };
}
