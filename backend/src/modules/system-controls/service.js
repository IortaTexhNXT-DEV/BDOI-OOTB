/**
 * Security and compliance controls register (Master > System Configuration > Security Controls): every non-functional
 * requirement of the BRD that the platform enforces, read from the configuration and the database as it is, and the
 * operational requirements (backups, monitoring, scans, drills, certifications) that are met outside the application,
 * recorded as dated evidence in control_evidence. Each control carries the requirement ids it answers, so the
 * register is the test evidence of the NFR items.
 *
 * A control is `met` when its configuration meets the target (or its latest evidence says so and is still current),
 * `review` when the delivered value differs from the target TISPH set (a go-live configuration item), `not-met` when
 * the latest evidence says so or the control is off, and `pending` when an evidence control has no evidence yet.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { passwordPolicy } from '../../lib/password.js';
import { isCalendarDate } from '../../lib/dates.js';
import { AUDIT_MIN_DAYS } from '../../jobs/housekeeping.js';
import { retentionSummary } from '../../jobs/retention.js';
import { validTimeZone } from '../system-settings/service.js';

export const RESULTS = ['met', 'not-met', 'review'];
export const GROUPS = [
  { code: 'access', label: 'Sign-in and sessions' },
  { code: 'data', label: 'Data protection and retention' },
  { code: 'audit', label: 'Audit and change control' },
  { code: 'operations', label: 'Operations and resilience' },
  { code: 'assurance', label: 'Security assurance' },
];
const CONFIG = { screen: 'Master > System Configuration > Configuration', path: '/master/configuration/settings' };

/** Evidence of an operational control stays current for this many days (setting controls.evidence_valid_days). */
const evidenceValidDays = async () => Math.max(1, Number(await getSetting('controls.evidence_valid_days', 365)) || 365);

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const on = (v) => v === true;
const minutes = (n) => `${n} minute${Number(n) === 1 ? '' : 's'}`;
const days = (n) => `${n} day${Number(n) === 1 ? '' : 's'}`;
const years = (n) => `${n} year${Number(n) === 1 ? '' : 's'}`;

/**
 * The controls the platform enforces: key, group, name, requirement ids, and `evaluate()` returning
 * { current, target, status, detail? } from the configuration and the database.
 */
const ENFORCED = [
  {
    key: 'idle-timeout', group: 'access', name: 'Idle session timeout', requirements: ['TIS-BRD-NFR-03', 'TIS-BRD-SEC-04', 'PBSM-NFR-SOW'],
    managedBy: CONFIG,
    async evaluate() {
      const m = num(await getSetting('limits.session_idle_minutes', 30), 30);
      return { current: `${minutes(m)}, enforced by the API and the browser`, target: 'Sign-out after 3 minutes without activity', status: m > 0 && m <= 3 ? 'met' : 'review' };
    },
  },
  {
    key: 'account-lockout', group: 'access', name: 'Account lockout after failed sign-ins', requirements: ['TIS-BRD-NFR-03', 'TIS-BRD-SEC-04'],
    managedBy: CONFIG,
    async evaluate() {
      const attempts = num(await getSetting('limits.max_login_attempts', 5), 5);
      const lock = num(await getSetting('limits.lockout_minutes', 15), 15);
      return { current: `${attempts} attempts, released after ${lock ? minutes(lock) : 'an administrator unlocks the account'}`, target: '5 attempts, 15-minute lockout', status: attempts <= 5 && lock === 15 ? 'met' : 'review' };
    },
  },
  {
    key: 'login-throttling', group: 'access', name: 'Sign-in and API rate limits', requirements: ['TIS-BRD-NFR-03', 'TIS-BRD-SEC-04'],
    managedBy: CONFIG,
    async evaluate() {
      const l = (await getSetting('security.login_rate_limit', null)) || {};
      const a = (await getSetting('security.api_rate_limit', null)) || {};
      const apiMax = a.max === undefined ? 600 : num(a.max, 0);
      return { current: `Sign-in ${num(l.max, 10)} attempts per ${num(l.windowSeconds, 300)} s per user and per address; API ${apiMax ? `${apiMax} requests per ${num(a.windowSeconds, 60)} s` : 'limit off'}`,
        target: 'Throttling per source address and per user; a global API limit', status: num(l.max, 10) > 0 && apiMax > 0 ? 'met' : 'not-met' };
    },
  },
  {
    key: 'single-session', group: 'access', name: 'Single session per user', requirements: ['TIS-BRD-NFR-03', 'TIS-BRD-SEC-04'],
    managedBy: CONFIG,
    async evaluate() {
      const v = on(await getSetting('security.single_session', false));
      return { current: v ? 'On: a fresh sign-in ends the earlier sessions' : 'Off: several sessions per user', target: 'A fresh sign-in supersedes the earlier one', status: v ? 'met' : 'review' };
    },
  },
  {
    key: 'mfa', group: 'access', name: 'Second factor at sign-in (MFA)', requirements: ['TIS-BRD-NFR-04', 'TIS-BRD-INTG-01', 'PBSM-NFR-SOW'],
    managedBy: CONFIG,
    async evaluate() {
      const all = on(await getSetting('security.require_2fa_all', false));
      const roles = (await getSetting('security.require_2fa_roles', [])) || [];
      const email = on(await getSetting('security.email_otp_enabled', false));
      const active = (await query("SELECT count(*)::int AS n FROM roles WHERE status = 'active'")).rows[0].n;
      const covered = all ? 'every user' : roles.length ? `${roles.length} of ${active} roles` : 'no role';
      return { current: `Required for ${covered}; authenticator app${email ? ' or one-time code by e-mail' : ''}`, target: 'Every user signs in with a second factor',
        status: all || (roles.length && roles.length >= active) ? 'met' : 'review' };
    },
  },
  {
    key: 'password-policy', group: 'access', name: 'Password policy', requirements: ['TIS-BRD-SEC-04', 'TIS-BRD-NFR-02'],
    managedBy: CONFIG,
    async evaluate() {
      const p = await passwordPolicy();
      const ok = p.minLength >= 8 && p.requireUpper && p.requireLower && p.requireDigit && p.requireSymbol && p.historyCount >= 5 && p.maxAgeDays > 0 && p.maxAgeDays <= 90;
      return { current: `${p.minLength} characters, ${[p.requireUpper && 'upper', p.requireLower && 'lower', p.requireDigit && 'digit', p.requireSymbol && 'symbol'].filter(Boolean).join(', ')}; last ${p.historyCount} refused; changed every ${days(p.maxAgeDays)}`,
        target: 'At least 8 characters of four classes, history of 5, changed every 90 days', status: ok ? 'met' : 'review' };
    },
  },
  {
    key: 'dormant-accounts', group: 'access', name: 'Dormant accounts deactivated', requirements: ['TIS-BRD-SEC-01', 'TIS-BRD-NFR-02'],
    managedBy: CONFIG,
    async evaluate() {
      const d = num(await getSetting('access.dormant_days', 90), 90);
      return { current: d ? `After ${days(d)} without a sign-in (reactivation restarts the clock)` : 'Off', target: 'Accounts unused for 90 days are deactivated', status: d > 0 && d <= 90 ? 'met' : 'review' };
    },
  },
  {
    key: 'pii-protection', group: 'data', name: 'Personal identifiers encrypted and masked', requirements: ['TIS-BRD-NFR-01', 'TIS-BRD-NFR-17', 'PBSM-NFR-SOW'],
    managedBy: CONFIG,
    async evaluate() {
      const masking = (await getSetting('privacy.masking_enabled', true)) !== false;
      const mode = String(await getSetting('privacy.pii_reveal_mode', 'always'));
      const encrypted = (await query("SELECT count(*)::int AS n FROM clients WHERE tin IS NOT NULL AND tin NOT LIKE 'pii:%'")).rows[0].n === 0;
      return { current: `${encrypted ? 'Identifiers stored encrypted' : 'Unencrypted identifiers found'}; masking ${masking ? 'on' : 'off'} (full values ${mode === 'on-request' ? 'on request' : 'for permitted users'})`,
        target: 'AES-256 at rest for identifiers; masked for users without the permission', status: encrypted && masking ? 'met' : 'not-met' };
    },
  },
  {
    key: 'data-retention', group: 'data', name: 'Retention of closed contracts', requirements: ['TIS-BRD-NFR-11.1', 'TIS-BRD-NFR-11.2', 'TIS-BRD-NFR-17.1'],
    managedBy: CONFIG,
    async evaluate() {
      const closed = num(await getSetting('retention.closed_contract_years', 5), 5);
      const claim = num(await getSetting('retention.claim_contract_years', 10), 10);
      const action = String(await getSetting('retention.action', 'flag'));
      const s = await retentionSummary();
      const job = (await query("SELECT enabled, last_run_at, last_status FROM scheduled_jobs WHERE code = 'data-retention'")).rows[0];
      return { current: `${years(closed)} closed, ${years(claim)} with a claim; action ${action}; ${s.closedContracts + s.claimContracts} contracts flagged, ${s.anonymisedClients} clients anonymised${job?.last_run_at ? `; last run ${new Date(job.last_run_at).toISOString().slice(0, 10)}` : ''}`,
        target: 'Closed contracts 5 years, contracts with cases 10 years', status: closed === 5 && claim === 10 && job?.enabled !== false ? 'met' : 'review', detail: s };
    },
  },
  {
    key: 'login-history-retention', group: 'audit', name: 'Sign-in history retention', requirements: ['TIS-BRD-NFR-11.3', 'TIS-BRD-NFR-14.11'],
    managedBy: CONFIG,
    async evaluate() {
      const d = num(await getSetting('housekeeping.login_history_days', 365), 365);
      return { current: d ? `Kept ${days(d)}` : 'Kept forever', target: 'At least 12 months', status: d === 0 || d >= 365 ? 'met' : 'not-met' };
    },
  },
  {
    key: 'audit-trail', group: 'audit', name: 'Audit trail append-only and retained', requirements: ['TIS-BRD-NFR-14.11', 'PBSM-M17v4-AUDIT', 'TIS-BRD-NFR-5.1'],
    managedBy: CONFIG,
    async evaluate() {
      const trigger = (await query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname IN ('audit_log_append_only', 'audit_log_no_truncate') AND NOT tgisinternal")).rows[0].n === 2;
      const d = num(await getSetting('housekeeping.audit_log_days', 0), 0);
      return { current: `${trigger ? 'Entries cannot be changed or deleted' : 'Entries can be changed'}; kept ${d ? days(Math.max(d, AUDIT_MIN_DAYS)) : 'forever'}`,
        target: 'Immutable entries kept at least 7 years', status: trigger && (d === 0 || d >= AUDIT_MIN_DAYS) ? 'met' : 'not-met' };
    },
  },
  {
    key: 'change-control', group: 'audit', name: 'Access changes under maker-checker', requirements: ['TIS-BRD-NFR-8.2', 'TIS-BRD-SEC-03', 'TIS-BRD-NFR-5.2'],
    managedBy: { screen: 'Master > User Management > Role Permissions > Access controls', path: '/master/generals/usermanagement/role-permissions?controls=1' },
    async evaluate() {
      const approval = (await getSetting('access.change_approval', true)) !== false;
      const sod = (await getSetting('access.sod_enforced', true)) !== false;
      return { current: `Access changes ${approval ? 'need a second administrator' : 'apply at once'}; segregation of duties ${sod ? 'enforced' : 'off'}`, target: 'A second person approves access changes; duties segregated', status: approval && sod ? 'met' : 'not-met' };
    },
  },
  {
    key: 'business-time-zone', group: 'operations', name: 'Business time zone and dates', requirements: ['TIS-BRD-NFR-10.3', 'TIS-BRD-INTG-04'],
    managedBy: CONFIG,
    async evaluate() {
      const tz = String(await getSetting('general.timezone', 'Asia/Manila'));
      const fmt = String(await getSetting('general.date_format', 'DD/MM/YYYY'));
      return { current: `${tz} (${validTimeZone(tz) ? 'valid' : 'unknown'}), dates ${fmt}`, target: 'Asia/Manila, dd/mm/yyyy', status: validTimeZone(tz) && tz === 'Asia/Manila' ? 'met' : 'review' };
    },
  },
];

/** The controls met outside the application: dated evidence recorded on the register (operations, scans, drills, certifications). */
const EVIDENCE = [
  { key: 'backups', group: 'operations', name: 'Database backups and restore drill', target: 'Backup every 4 hours, retained 10 years; restore within RTO 4 h with loss within RPO 1 h', requirements: ['TIS-BRD-NFR-11', 'TIS-BRD-NFR-06.2', 'TIS-BRD-NFR-06.3', 'TIS-BRD-NFR-06', 'PBSM-NFR-SOW'] },
  { key: 'availability', group: 'operations', name: 'Availability and failover', target: 'Uptime 99.9 %, MTBF 372 hours a month, MTTR under 1 hour, automatic failover exercised', requirements: ['TIS-BRD-NFR-15', 'TIS-BRD-NFR-15.1', 'TIS-BRD-NFR-15.2', 'TIS-BRD-NFR-15.3'] },
  { key: 'scalability', group: 'operations', name: 'Scalability and capacity', target: 'Horizontal and vertical scaling with auto-scale rules; annual capacity forecast', requirements: ['TIS-BRD-NFR-15.4', 'TIS-BRD-NFR-15.5', 'TIS-BRD-NFR-15.6', 'TIS-BRD-NFR-20'] },
  { key: 'performance', group: 'operations', name: 'Performance and load test', target: 'Responses under 200 ms at p95, 20 concurrent users, 1,000 TPS, latency under 100 ms, limits identified', requirements: ['TIS-BRD-NFR-07', 'TIS-BRD-NFR-07.1', 'TIS-BRD-NFR-07.2', 'TIS-BRD-NFR-07.3', 'TIS-BRD-NFR-07.5', 'TIS-BRD-NFR-07.6', 'TIS-BRD-NFR-07.7', 'TIS-BRD-NFR-12'] },
  { key: 'monitoring', group: 'operations', name: 'Monitoring, alerting and logging', target: 'Weekly uptime, utilisation, response time, API and database reports; real-time alerts with thresholds; central logs; dashboards; trends', requirements: ['TIS-BRD-NFR-05', 'TIS-BRD-NFR-14', 'TIS-BRD-NFR-14.1', 'TIS-BRD-NFR-14.2', 'TIS-BRD-NFR-14.3', 'TIS-BRD-NFR-14.4', 'TIS-BRD-NFR-14.5', 'TIS-BRD-NFR-14.8', 'TIS-BRD-NFR-14.9', 'TIS-BRD-NFR-14.10'] },
  { key: 'support', group: 'operations', name: 'Application and infrastructure support', target: 'Application support 8:30 to 17:30 Monday to Saturday PHT; infrastructure 24x7; portal and monitoring tool', requirements: ['TIS-BRD-NFR-13', 'TIS-BRD-NFR-13.1', 'TIS-BRD-NFR-13.2'] },
  { key: 'deployment', group: 'operations', name: 'Cloud deployment and orchestration', target: 'Azure with hybrid flexibility; containers under Kubernetes; infrastructure as code', requirements: ['TIS-BRD-NFR-06.1', 'TIS-BRD-NFR-19', 'TIS-BRD-NFR-19.1', 'TIS-BRD-NFR-01.1'] },
  { key: 'vulnerability-scans', group: 'assurance', name: 'Vulnerability assessment and penetration test', target: 'Pre-go-live VA and MBSS scans with no open Critical or High; annual VA and penetration test with certification', requirements: ['TIS-BRD-NFR-02.1', 'TIS-BRD-NFR-16', 'TIS-BRD-NFR-17.6'] },
  { key: 'incident-response', group: 'assurance', name: 'Security incident response', target: 'Detection under 5 minutes, response under 1 hour, resolution under 24 hours; containment, recovery, forensics; regulatory breach reporting', requirements: ['TIS-BRD-NFR-16.1', 'TIS-BRD-NFR-16.2', 'TIS-BRD-NFR-16.3', 'TIS-BRD-NFR-16.5', 'TIS-BRD-NFR-16.6', 'TIS-BRD-NFR-17.2'] },
  { key: 'secure-sdlc', group: 'assurance', name: 'Secure development and zero trust', target: 'Secure SDLC, zero-trust architecture, information security controls documented', requirements: ['TIS-BRD-NFR-16.4', 'TIS-BRD-NFR-16.7', 'TIS-BRD-NFR-17.5'] },
  { key: 'certifications', group: 'assurance', name: 'Certifications and compliance reports', target: 'PCI DSS, SOC 1 Type 1, SOC 2 Type 2, ISO 27001; annual cloud security posture report; third-party risk assessments; regulatory compliance', requirements: ['TIS-BRD-NFR-17.4', 'TIS-BRD-NFR-17.7', 'TIS-BRD-NFR-17.8', 'TIS-BRD-NFR-17.9', 'TIS-BRD-NFR-17.10', 'TIS-BRD-NFR-17.3'] },
];

export const CONTROLS = [...ENFORCED.map((c) => ({ ...c, kind: 'enforced' })), ...EVIDENCE.map((c) => ({ ...c, kind: 'evidence' }))];
export const controlOf = (key) => CONTROLS.find((c) => c.key === key) || null;

const evidenceRow = (r) => ({ id: Number(r.id), controlKey: r.control_key, evidenceDate: r.evidence_date instanceof Date ? r.evidence_date.toISOString().slice(0, 10) : r.evidence_date,
  result: r.result, reference: r.reference, remarks: r.remarks, recordedBy: r.recorded_by_name || r.recorded_by, recordedAt: r.recorded_at });

/** The latest evidence of every control, keyed by control. */
async function latestEvidence() {
  const rows = (await query(`SELECT DISTINCT ON (e.control_key) e.*, u.display_name AS recorded_by_name FROM control_evidence e
    LEFT JOIN users u ON u.id = e.recorded_by ORDER BY e.control_key, e.evidence_date DESC, e.id DESC`)).rows;
  return new Map(rows.map((r) => [r.control_key, evidenceRow(r)]));
}

/** The register: every control with its current state, target, status and latest evidence. */
export async function listControls() {
  const latest = await latestEvidence();
  const validDays = await evidenceValidDays();
  const out = [];
  for (const c of CONTROLS) {
    const base = { key: c.key, kind: c.kind, group: c.group, groupLabel: GROUPS.find((g) => g.code === c.group)?.label || c.group, name: c.name, requirements: c.requirements, managedBy: c.managedBy || null };
    const evidence = latest.get(c.key) || null;
    if (c.kind === 'enforced') {
      const e = await c.evaluate();
      out.push({ ...base, ...e, evidence });
      continue;
    }
    let status = 'pending';
    if (evidence) {
      const ageDays = (Date.now() - Date.parse(`${evidence.evidenceDate}T00:00:00Z`)) / 86400000;
      status = evidence.result === 'met' ? (ageDays <= validDays ? 'met' : 'review') : evidence.result;
    }
    out.push({ ...base, current: evidence ? `${evidence.result === 'met' ? 'Met' : evidence.result === 'not-met' ? 'Not met' : 'Under review'} on ${evidence.evidenceDate}${evidence.reference ? ` (${evidence.reference})` : ''}` : 'No evidence recorded', target: c.target, status, evidence });
  }
  return out;
}

export async function listEvidence(key) {
  if (!controlOf(key)) throw notFound(`Control ${key} not found`);
  const rows = (await query(`SELECT e.*, u.display_name AS recorded_by_name FROM control_evidence e LEFT JOIN users u ON u.id = e.recorded_by
    WHERE e.control_key = $1 ORDER BY e.evidence_date DESC, e.id DESC`, [key])).rows;
  return rows.map(evidenceRow);
}

/** Record dated evidence of a control: { evidenceDate, result, reference, remarks }. */
export async function recordEvidence(key, body, user) {
  if (!controlOf(key)) throw notFound(`Control ${key} not found`);
  const errors = [];
  if (!isCalendarDate(body.evidenceDate)) errors.push({ path: 'evidenceDate', message: 'Evidence date must be a date (YYYY-MM-DD)' });
  if (!RESULTS.includes(body.result)) errors.push({ path: 'result', message: `Result must be one of ${RESULTS.join(', ')}` });
  if (!String(body.reference || '').trim()) errors.push({ path: 'reference', message: 'Reference is required' });
  if (errors.length) throw badRequest('Validation failed', errors);
  const r = (await query(`INSERT INTO control_evidence(control_key, evidence_date, result, reference, remarks, recorded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [key, body.evidenceDate, body.result, String(body.reference).trim().slice(0, 200), body.remarks ? String(body.remarks).trim().slice(0, 2000) : null, user?.id ?? null])).rows[0];
  return evidenceRow(r);
}
