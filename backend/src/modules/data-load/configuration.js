/**
 * Configuration kit: everything needed to run new business, one sheet per object in dependency order. Every sheet
 * upserts on its natural key (code, username, setting key ...), so a corrected workbook updates and never duplicates,
 * and the workbook downloaded with the current data of one environment loads into the next one (Dev -> SIT -> UAT ->
 * Pre-Prod -> Production).
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { many, one, query } from '../../db/pool.js';
import { isAdmin, ADMIN_ROLES, revokeSessions } from '../../lib/auth.js';
import { setSetting } from '../../lib/settings.js';
import { settingOwner } from '../../lib/settingOwners.js';
import { passwordPolicy, recordHistory } from '../../lib/password.js';
import { temporaryPassword } from '../../lib/secrets.js';
import * as masters from '../masters/service.js';
import { MASTER_TEMPLATES } from '../masters/uploadSamples.js';
import { ACCOUNT_UPLOAD_COLUMNS, FS_GROUPS, accountFromRow, upsertAccount } from '../accounting/service.js';
import * as rates from '../commission-rates/service.js';
import { POLICY_TYPES } from '../commission-rates/resolve.js';
import * as charges from '../premium-charges/service.js';
import { RULE_KINDS, RULE_METHODS, TAX_REGIMES } from '../premium-charges/calculator.js';
import { assertSod, proposeLimit } from '../access-control/service.js';
import { setNextNumber, updateSeries, validatePattern } from '../document-numbering/service.js';
import { isControlledSetting } from '../posting-rules/service.js';
import { MIGRATED_NUMBER_TARGETS, collidingNumber } from './numbering.js';
import { amountValue, cell, dateValue, fail, isDate, keyText, toBool, numberCell, yesNo } from './common.js';

// ------------------------------------------------------------------ masters (generic master types)

const FIELD_TYPE = { number: 'number', integer: 'number', boolean: 'bool', date: 'date', multiselect: 'multi' };

/** Master types of the kit, in load order: [type code, sheet name]. Location, finance and insurance masters. */
const MASTER_SHEETS = {
  company: 'Company', country: 'Countries', region: 'Regions', state: 'Provinces', city: 'Cities and Municipalities', barangay: 'Barangays',
  branch: 'Branches', department: 'Departments',
  hierarchy: 'Hierarchy', designation: 'Designations', currency: 'Currencies', 'exchange-rate': 'Exchange Rates', bank: 'Banks',
  'bank-account': 'Bank Accounts', signatory: 'Signatories', 'transaction-code': 'Transaction Codes', 'write-off-reason': 'Write-off Reasons',
  'insurance-company': 'Insurers', 'line-of-business': 'Lines of Business', product: 'Products', 'policy-type': 'Policy Types', cover: 'Covers',
  'vehicle-brand': 'Vehicle Brands', 'vehicle-model': 'Vehicle Models', 'vehicle-variant': 'Vehicle Variants', vehicle: 'Vehicles',
  // operations and accounting masters (seed 73_ops_accounting.sql)
  supplier: 'Suppliers', 'asset-class': 'Asset Classes', 'short-period-rate': 'Short-Period Rates', 'cancellation-reason': 'Cancellation Reasons',
  'claim-document-requirement': 'Claim Document Checklist', 'repair-shop': 'Repair Shops',
};

/** Earlier names of a sheet, still read from an uploaded workbook (the Province master was called State). */
const SHEET_ALIASES = { state: ['States'], city: ['Cities'] };
/**
 * Records a sheet leaves out of the downloaded workbook: barangays of the PSGC list (with a PSGC code) are loaded in
 * every environment by scripts/load-barangays.js, so the Barangays sheet carries only the barangays the broker added.
 */
const EXPORT_FILTER = { barangay: (r) => !r.BarangayCode };

/** Sheet of one master type (columns from the type definition, like the master upload template). */
export async function masterSheet(code) {
  const t = await masters.getType(code);
  const info = MASTER_TEMPLATES.find((m) => m.type === code) || {};
  const key = (t.unique_keys || [])[0] || (t.code_field ? [t.code_field] : []);
  const columns = masters.uploadColumns(t).map((c) => {
    const f = t.fields.find((x) => x.name === c.key);
    return {
      key: c.key, header: c.header, required: c.required === true || key.includes(c.key), format: info.formats?.[c.key] || c.format,
      type: f ? FIELD_TYPE[f.type] || 'text' : 'text',
      ...(c.allowed ? { list: c.key === 'status' ? 'Status' : `${t.label} ${c.header}`, allowed: c.allowed } : {}),
    };
  });
  const keyOf = (v) => keyText(...key.map((k) => v[k]));
  return {
    key: `master:${code}`, name: MASTER_SHEETS[code], aliases: SHEET_ALIASES[code] || [], menu: info.menu || `Master > ${t.label}`, columns, keyColumns: key, keyOf,
    sample: info.samples?.[0] || {},
    async exportRows() {
      const { rows } = await masters.listRecords(t, { sortBy: t.code_field || t.label_field }, { limit: 1000000, offset: 0 });
      // a reference is written as the label of the record it points to (e.g. the state of a city), or as its code
      // when several records share that label (two states named Cebu): the key of the row then names one record
      const refs = new Map();
      for (const f of t.fields.filter((x) => x.ref && t.storage !== 'generic' && columns.some((c) => c.key === x.name))) refs.set(f.name, await masters.ambiguousRefCodes(f));
      const valueOf = (r, c) => {
        if (c.key === 'status') return r.status;
        const code = refs.get(c.key)?.get(r[`${c.key}Id`]);
        return cell(code ?? r[c.key]);
      };
      return rows.filter(EXPORT_FILTER[code] || (() => true)).map((r) => Object.fromEntries(columns.map((c) => [c.key, valueOf(r, c)])));
    },
    async importRow(ctx, v) {
      const body = {};
      for (const c of columns) {
        if (v[c.key] === undefined || v[c.key] === '') continue;
        const f = t.fields.find((x) => x.name === c.key);
        if (f?.type === 'json') {
          try { body[c.key] = JSON.parse(v[c.key]); } catch { fail(c.key, `${c.header} must be JSON text`); }
        } else body[c.key] = v[c.key];
      }
      const id = await masters.findRecordByKey(t, body);
      if (id) {
        await masters.updateRecord(t, id, body, ctx.user);
        return 'updated';
      }
      await masters.createRecord(t, body, ctx.user);
      return 'created';
    },
  };
}

// ------------------------------------------------------------------ system settings

/** Settings never loaded from a workbook: secrets (none are kept in settings, the check is a safeguard) and the go-live lock. */
const NOT_LOADED = /(secret|api_?key|credential|private_?key)/i;
const LOCK_KEY = 'golive.locked';

/** Settings the workbook carries: editable, changed on Master > Configuration (not owned by another screen, not under approval). */
const loadableSetting = (s) => s.editable !== false && !settingOwner(s.key) && !isControlledSetting(s.key) && !NOT_LOADED.test(s.key) && s.key !== LOCK_KEY;

const settingText = (s) => (s.type === 'json' || (s.value !== null && typeof s.value === 'object') ? JSON.stringify(s.value) : cell(s.value === true ? 'true' : s.value === false ? 'false' : s.value));

function parseSettingValue(s, text) {
  const raw = String(text ?? '').trim();
  // the stored value decides the type when it is not text (a list kept under a "string" setting stays a list)
  const kind = typeof s.value === 'number' ? 'number' : typeof s.value === 'boolean' ? 'boolean'
    : s.value !== null && typeof s.value === 'object' ? 'json' : s.type;
  switch (kind) {
    case 'number': {
      const n = numberCell(raw);
      if (n === null || Number.isNaN(n)) fail('value', `${s.key} must be a number`);
      return n;
    }
    case 'boolean': {
      const b = toBool(raw);
      if (b === null || b === undefined) fail('value', `${s.key} must be true or false`);
      return b;
    }
    case 'json':
      try { return JSON.parse(raw); } catch { return fail('value', `${s.key} must be JSON text`); }
    default:
      return raw;
  }
}

const settingsSheet = () => ({
  key: 'settings', name: 'Settings', menu: 'Master > Configuration',
  columns: [
    { key: 'key', header: 'Setting Key', required: true, format: 'Key of a setting of Master > Configuration, e.g. golive.cutover_date' },
    { key: 'value', header: 'Value', required: true, format: 'Text, number, true / false or JSON text, as the setting type says' },
    { key: 'description', header: 'Description', format: 'For your reference only; not loaded' },
  ],
  keyColumns: ['key'], keyOf: (v) => keyText(v.key),
  sample: { key: 'golive.cutover_date', value: '2026-11-01', description: 'First day of live transactions' },
  async exportRows() {
    const rows = await many('SELECT key, value, type, editable, label FROM app_settings ORDER BY "group", key');
    return rows.filter(loadableSetting).map((s) => ({ key: s.key, value: settingText(s), description: s.label || '' }));
  },
  async check(ctx, v) {
    if (v.key === LOCK_KEY) fail('key', `${LOCK_KEY} is not loaded from a workbook: switch it on in Master > Configuration (Go-live) once the migration is signed off`);
  },
  async importRow(ctx, v) {
    const s = await one('SELECT key, value, type, editable FROM app_settings WHERE key = $1', [v.key]);
    if (!s) fail('key', `Unknown setting ${v.key}`);
    if (!s.editable) fail('key', `${v.key} cannot be changed`);
    const owner = settingOwner(v.key);
    if (owner) fail('key', `${v.key} is managed in ${owner.screen}; change it there`);
    if (isControlledSetting(v.key)) fail('key', `${v.key} is changed on Master > Finance > Account Determination, where a second user approves it`);
    if (NOT_LOADED.test(v.key)) fail('key', `${v.key} is not loaded from a workbook`);
    const value = parseSettingValue(s, v.value);
    if (v.key === 'golive.cutover_date' && value !== '' && !isDate(value)) fail('value', 'golive.cutover_date must be a date YYYY-MM-DD');
    if (JSON.stringify(value) === JSON.stringify(s.value)) return 'unchanged';
    await setSetting(v.key, value, ctx.user.id);
    if (v.key === 'golive.cutover_date') ctx.cutover = value || null;
    return 'updated';
  },
});

// ------------------------------------------------------------------ users

const USERNAME = /^[A-Za-z0-9._@-]{3,60}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usersSheet = () => ({
  key: 'users', name: 'Users', menu: 'Master > Generals > User Management > User',
  columns: [
    { key: 'username', header: 'Username', required: true, format: '3 to 60 letters, digits or . _ @ -; the sign-in name' },
    { key: 'displayName', header: 'Display Name', format: 'Name shown on screens; First + Last Name when empty' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'email', header: 'Email', required: true, format: 'E-mail address; password reset codes are sent here' },
    { key: 'phone', header: 'Phone' },
    { key: 'employeeCode', header: 'Employee Code' },
    { key: 'branchCode', header: 'Branch Code', format: 'Code of a branch (Branches sheet or Master > Branch)' },
    { key: 'department', header: 'Department' },
    { key: 'designation', header: 'Designation', format: 'Code or name of a designation (Designations sheet)' },
    { key: 'reportingTo', header: 'Reporting To', format: 'Username of the manager (listed on an earlier row or already a user)' },
    { key: 'roles', header: 'Roles', required: true, type: 'multi', format: 'Role codes separated by commas (Lists sheet, Roles)', list: 'Roles' },
    { key: 'status', header: 'Status', list: 'User Status', format: 'active when empty' },
  ],
  keyColumns: ['username'], keyOf: (v) => keyText(v.username),
  sample: { username: 'andrea.lim', displayName: 'Andrea Lim', firstName: 'Andrea', lastName: 'Lim', email: 'andrea.lim@example.ph', branchCode: 'HO', roles: 'accounting', status: 'active' },
  async exportRows() {
    const rows = await many(`SELECT u.*, (SELECT r.username FROM users r WHERE r.id = u.reporting_to) AS reporting_username,
        COALESCE((SELECT string_agg(ro.code, ', ' ORDER BY ro.code) FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id), '') AS role_codes
      FROM users u WHERE u.status <> 'deleted' ORDER BY (u.reporting_to IS NOT NULL), u.username`);
    return rows.map((u) => ({
      username: u.username, displayName: u.display_name, firstName: cell(u.first_name), lastName: cell(u.last_name), email: cell(u.email), phone: cell(u.phone),
      employeeCode: cell(u.employee_code), branchCode: cell(u.branch_code), department: cell(u.department), designation: cell(u.designation),
      reportingTo: cell(u.reporting_username), roles: u.role_codes, status: u.status,
    }));
  },
  async importRow(ctx, v) {
    if (!USERNAME.test(v.username)) fail('username', 'Username must be 3 to 60 letters, digits or . _ @ -');
    if (v.email && !EMAIL.test(v.email)) fail('email', 'Email must be a valid e-mail address');
    const status = (v.status || 'active').toLowerCase();
    if (!['active', 'inactive'].includes(status)) fail('status', 'Status must be active or inactive');
    const codes = [...new Set(String(v.roles || '').split(/[;,]/).map((r) => r.trim().toLowerCase()).filter(Boolean))];
    if (!codes.length) fail('roles', 'Give at least one role');
    const roles = await many('SELECT id, code FROM roles WHERE code = ANY($1)', [codes]);
    const unknown = codes.filter((c) => !roles.some((r) => r.code === c));
    if (unknown.length) fail('roles', `Unknown role(s): ${unknown.join(', ')}`);
    if (!isAdmin(ctx.user) && codes.some((c) => ADMIN_ROLES.includes(c))) fail('roles', 'Only a System Administrator can grant the System Administrator role');
    if (v.branchCode && !(await one('SELECT 1 FROM branches WHERE lower(code) = lower($1) AND status <> \'deleted\'', [v.branchCode]))) fail('branchCode', `Branch ${v.branchCode} is not in the Branch master`);
    let designation = v.designation || undefined;
    if (designation) {
      const d = await one(`SELECT name FROM master_records WHERE type_code = 'designation' AND status = 'active' AND (lower(code) = lower($1) OR lower(name) = lower($1)) ORDER BY id LIMIT 1`, [designation]);
      if (!d) fail('designation', `Designation ${designation} is not in the Designation master`);
      designation = d.name;
    }
    let reportingTo;
    if (v.reportingTo) {
      const r = await one('SELECT id FROM users WHERE lower(username) = lower($1) AND status <> \'deleted\'', [v.reportingTo]);
      if (!r) fail('reportingTo', `Reporting To: user ${v.reportingTo} was not found (list the manager on an earlier row)`);
      reportingTo = r.id;
    }
    const warnings = await assertSod({ query }, codes).catch((e) => fail('roles', e.message));
    if (warnings?.length) ctx.warn(`Segregation of duties: ${warnings.join('; ')}`);
    const before = await one(`SELECT u.*, COALESCE((SELECT array_agg(ro.code ORDER BY ro.code) FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS roles
      FROM users u WHERE lower(u.username) = lower($1)`, [v.username]);
    const displayName = v.displayName || [v.firstName, v.lastName].filter(Boolean).join(' ') || v.username;
    if (!before) {
      // A new user gets a temporary password, shown once to the administrator after the load and never stored in clear.
      const password = ctx.dryRun ? null : temporaryPassword(await passwordPolicy());
      const hash = password ? await bcrypt.hash(password, 10) : `!dry-run-${crypto.randomUUID()}`;
      const u = await one(`INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, phone, employee_code, branch_code, department,
          designation, reporting_to, status, must_change_password, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14) RETURNING id`,
      [v.username, hash, displayName, v.firstName || null, v.lastName || null, v.email || null, v.phone || null, v.employeeCode || null, v.branchCode || null,
        v.department || null, designation || null, reportingTo || null, status, ctx.user.username]);
      for (const r of roles) await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2)', [u.id, r.id]);
      if (password) {
        await recordHistory(u.id, hash);
        ctx.temporaryPasswords.push({ username: v.username, displayName, temporaryPassword: password });
      }
      return 'created';
    }
    if (before.status === 'deleted') fail('username', `User ${v.username} was deleted; choose another username`);
    if (before.id === ctx.user.id) fail('username', 'You cannot change your own access through the workbook; another administrator does it');
    if (!isAdmin(ctx.user) && (before.roles || []).some((r) => ADMIN_ROLES.includes(r))) fail('username', 'Only a System Administrator can change a System Administrator account');
    const rolesChanged = [...codes].sort().join(',') !== [...(before.roles || [])].sort().join(',');
    await query(`UPDATE users SET display_name = $2, first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name), email = COALESCE($5, email),
        phone = COALESCE($6, phone), employee_code = COALESCE($7, employee_code), branch_code = COALESCE($8, branch_code), department = COALESCE($9, department),
        designation = COALESCE($10, designation), reporting_to = COALESCE($11, reporting_to), status = $12, updated_by = $13, updated_at = now() WHERE id = $1`,
    [before.id, v.displayName || before.display_name, v.firstName || null, v.lastName || null, v.email || null, v.phone || null, v.employeeCode || null,
      v.branchCode || null, v.department || null, designation || null, reportingTo || null, status, ctx.user.username]);
    if (rolesChanged) {
      await query('DELETE FROM user_roles WHERE user_id = $1', [before.id]);
      for (const r of roles) await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2)', [before.id, r.id]);
    }
    if (status !== 'active' && before.status === 'active') await revokeSessions(before.id, { refresh: true });
    else if (rolesChanged) await revokeSessions(before.id);
    return 'updated';
  },
});

// ------------------------------------------------------------------ chart of accounts

const accountsSheet = () => {
  const LISTS = { accountType: 'Account Type', fsGroup: 'Statement Group', normalBalance: 'Normal Balance', isOpenItem: 'Yes No', allowManual: 'Yes No', status: 'Account Status' };
  const TYPES = { isOpenItem: 'bool', allowManual: 'bool' };
  return {
    key: 'chart-of-accounts', name: 'Chart of Accounts', menu: 'Master > Finance > Main Account / Sub Account',
    columns: ACCOUNT_UPLOAD_COLUMNS.map((c) => ({ key: c.key, header: c.header, required: c.required === true, format: c.format || (c.required && c.required !== true ? `Required: ${c.required}` : undefined),
      aliases: c.aliases, ...(LISTS[c.key] ? { list: LISTS[c.key] } : {}), ...(TYPES[c.key] ? { type: TYPES[c.key] } : {}) })),
    keyColumns: ['code'], keyOf: (v) => keyText(v.code),
    sample: { code: '4401030', name: 'Training and Seminars', accountType: 'expense', fsGroup: 'Operating Expenses', category: 'Operating Expenses', normalBalance: 'debit', isOpenItem: 'No', allowManual: 'Yes', status: 'active' },
    async exportRows() {
      const rows = await many(`WITH RECURSIVE t AS (SELECT a.*, 0 AS depth FROM gl_accounts a WHERE parent_code IS NULL
          UNION ALL SELECT a.*, t.depth + 1 FROM gl_accounts a JOIN t ON a.parent_code = t.code WHERE t.depth < 10)
        SELECT * FROM t ORDER BY depth, code`);
      return rows.map((a) => ({ code: a.code, name: a.name, accountType: a.account_type, parentCode: cell(a.parent_code), fsGroup: cell(a.fs_group), category: cell(a.category),
        normalBalance: cell(a.normal_balance), isOpenItem: yesNo(a.is_open_item), allowManual: yesNo(a.allow_manual), status: a.status, description: cell(a.description) }));
    },
    async importRow(ctx, v) {
      const b = accountFromRow(v);
      if (!/^[0-9A-Za-z-]{3,20}$/.test(b.code || '')) fail('code', 'Account Code must be 3 to 20 letters, digits or dashes');
      if (b.name !== undefined && String(b.name).trim().length < 2) fail('name', 'Account Name must have at least 2 characters');
      if (b.accountType && !['asset', 'liability', 'equity', 'income', 'expense'].includes(b.accountType)) fail('accountType', 'Account Type must be asset, liability, equity, income or expense');
      if (b.fsGroup && !FS_GROUPS.some(([g]) => g === b.fsGroup)) fail('fsGroup', `Statement Group must be one of ${FS_GROUPS.map(([g]) => g).join(', ')}`);
      if (b.normalBalance && !['debit', 'credit'].includes(b.normalBalance)) fail('normalBalance', 'Normal Balance must be debit or credit');
      if (b.status && !['active', 'inactive'].includes(b.status)) fail('status', 'Status must be active or inactive');
      if (b.description && b.description.length > 500) fail('description', 'Description is limited to 500 characters');
      const exists = await one('SELECT 1 FROM gl_accounts WHERE code = $1', [b.code]);
      if (!exists && !b.accountType) fail('accountType', 'Account Type is required for a new account');
      await upsertAccount({ query }, b.code, b);
      return exists ? 'updated' : 'created';
    },
  };
};

// ------------------------------------------------------------------ commission rate matrix

async function insurerOf(column, value) {
  if (!value) return null;
  const r = await one('SELECT id FROM insurance_companies WHERE (lower(code) = lower($1) OR lower(name) = lower($1) OR lower(short_name) = lower($1)) AND status <> \'deleted\' ORDER BY id LIMIT 1', [value]);
  if (!r) fail(column, `Insurer ${value} is not in the Insurance Company master`);
  return r.id;
}
async function productOf(column, value) {
  if (!value) return null;
  const r = await one('SELECT id FROM products WHERE (lower(code) = lower($1) OR lower(name) = lower($1)) AND status <> \'deleted\' ORDER BY id LIMIT 1', [value]);
  if (!r) fail(column, `Product ${value} is not in the Product master`);
  return r.id;
}

const commissionSheet = () => ({
  key: 'commission-rates', name: 'Commission Rates', menu: 'Master > Finance > Commission Rate Matrix',
  columns: [
    { key: 'insurer', header: 'Insurer', format: 'Insurer code (or name); empty = any insurer', list: 'Insurers' },
    { key: 'product', header: 'Product', format: 'Product code (or name); empty = any product', list: 'Products' },
    { key: 'lineOfBusiness', header: 'Line of Business', format: 'Line of business code, e.g. motor; empty = any' },
    { key: 'policyType', header: 'Policy Type', list: 'Commission Policy Type', format: 'new, renewal or any (any when empty)' },
    { key: 'rate', header: 'Rate', required: true, type: 'number', format: 'Decimal fraction: 0.20 for 20%' },
    { key: 'effectiveFrom', header: 'Effective From', required: true, type: 'date', format: 'Date YYYY-MM-DD' },
    { key: 'effectiveTo', header: 'Effective To', type: 'date', format: 'Date YYYY-MM-DD; open ended when empty' },
    { key: 'active', header: 'Active', type: 'bool', list: 'Yes No', format: 'Yes when empty' },
    { key: 'remarks', header: 'Remarks' },
  ],
  keyColumns: ['insurer', 'product', 'lineOfBusiness', 'policyType', 'effectiveFrom'], keyDefaults: { policyType: 'any' },
  keyOf: (v) => keyText(v.insurer, v.product, v.lineOfBusiness, v.policyType || 'any', v.effectiveFrom),
  sample: { insurer: 'MALAYAN', product: 'MOTOR', policyType: 'new', rate: '0.175', effectiveFrom: '2026-01-01', active: 'Yes', remarks: 'Agreement 2026' },
  async exportRows() {
    return (await rates.listRates()).map((r) => ({ insurer: cell(r.insurerCode), product: cell(r.productCode), lineOfBusiness: cell(r.lineOfBusiness), policyType: r.policyType,
      rate: String(r.rate), effectiveFrom: cell(r.effectiveFrom), effectiveTo: cell(r.effectiveTo), active: yesNo(r.active), remarks: cell(r.remarks) }));
  },
  async importRow(ctx, v) {
    const policyType = (v.policyType || 'any').toLowerCase();
    if (!POLICY_TYPES.includes(policyType)) fail('policyType', `Policy Type must be one of ${POLICY_TYPES.join(', ')}`);
    const rate = numberCell(v.rate);
    if (rate === null || Number.isNaN(rate) || rate < 0 || rate > 1) fail('rate', 'Rate must be a fraction from 0 to 1 (0.20 for 20%)');
    const effectiveFrom = dateValue('effectiveFrom', v.effectiveFrom, 'Effective From');
    const effectiveTo = dateValue('effectiveTo', v.effectiveTo, 'Effective To');
    const active = toBool(v.active);
    if (active === null) fail('active', 'Active must be Yes or No');
    // a rate on an unknown line of business would never apply: the code must be in the Line of Business master
    if (v.lineOfBusiness && !(await one(`SELECT 1 FROM master_records WHERE type_code = 'line-of-business' AND status <> 'deleted' AND lower(code) = lower($1)`, [v.lineOfBusiness]))) {
      fail('lineOfBusiness', `Line of Business ${v.lineOfBusiness} is not in the Line of Business master (Lines of Business sheet or Master > Line of Business)`);
    }
    const body = { insuranceCompanyId: await insurerOf('insurer', v.insurer), productId: await productOf('product', v.product), lineOfBusiness: v.lineOfBusiness || null,
      policyType, rate, effectiveFrom, effectiveTo: effectiveTo || null, active: active ?? true, remarks: v.remarks || null };
    const hit = await one(`SELECT id FROM commission_rates WHERE insurance_company_id IS NOT DISTINCT FROM $1::int AND product_id IS NOT DISTINCT FROM $2::int
        AND lower(line_of_business) IS NOT DISTINCT FROM lower($3::text) AND policy_type = $4 AND effective_from = $5::date ORDER BY id LIMIT 1`,
    [body.insuranceCompanyId, body.productId, body.lineOfBusiness, policyType, effectiveFrom]);
    if (hit) {
      await rates.updateRate(hit.id, body, ctx.user);
      return 'updated';
    }
    await rates.createRate(body, ctx.user);
    return 'created';
  },
});

// ------------------------------------------------------------------ premium taxes and charges, LGU rates

const chargesSheet = () => ({
  key: 'premium-charges', name: 'Premium Taxes', menu: 'Master > Finance > Premium Taxes & LGU Rates (Taxes & Charges)',
  columns: [
    { key: 'code', header: 'Code', required: true, format: 'Letters, digits, _ or -, up to 20, e.g. VAT, DST, FST, LGT' },
    { key: 'name', header: 'Name', required: true },
    { key: 'kind', header: 'Kind', required: true, list: 'Charge Kind' },
    { key: 'method', header: 'Method', list: 'Charge Method', format: 'percent when empty' },
    { key: 'rate', header: 'Rate', type: 'number', format: 'Percent, e.g. 12 for 12%' },
    { key: 'unitAmount', header: 'Unit Amount', type: 'number', format: 'Per unit: amount per unit; flat: the amount' },
    { key: 'unitSize', header: 'Unit Size', type: 'number', format: 'Per unit: premium per unit, e.g. 4.00' },
    { key: 'fractionRule', header: 'Fraction Rule', list: 'Fraction Rule' },
    { key: 'lines', header: 'Lines', type: 'multi', format: 'Lines of business it applies to, separated by commas; all when empty' },
    { key: 'regimes', header: 'Tax Regimes', type: 'multi', format: `Separated by commas: ${TAX_REGIMES.join(', ')}; all when empty` },
    { key: 'minimumAmount', header: 'Minimum Amount', type: 'number' },
    { key: 'sortOrder', header: 'Sort Order', type: 'number' },
    { key: 'active', header: 'Active', type: 'bool', list: 'Yes No', format: 'Yes when empty' },
    { key: 'effectiveFrom', header: 'Effective From', type: 'date' },
    { key: 'effectiveTo', header: 'Effective To', type: 'date' },
    { key: 'remarks', header: 'Remarks' },
  ],
  keyColumns: ['code'], keyOf: (v) => keyText(v.code),
  sample: { code: 'NOTARIAL', name: 'Notarial fee', kind: 'other', method: 'flat', unitAmount: '150', active: 'Yes', effectiveFrom: '2026-01-01' },
  async exportRows() {
    return (await charges.listRules()).map((r) => ({ code: r.code, name: r.name, kind: r.kind, method: r.method, rate: String(r.rate), unitAmount: String(r.unitAmount), unitSize: String(r.unitSize),
      fractionRule: cell(r.fractionRule), lines: (r.lines || []).join(', '), regimes: (r.regimes || []).join(', '), minimumAmount: String(r.minimumAmount), sortOrder: String(r.sortOrder),
      active: yesNo(r.active), effectiveFrom: cell(r.effectiveFrom), effectiveTo: cell(r.effectiveTo), remarks: cell(r.remarks) }));
  },
  async importRow(ctx, v) {
    const code = String(v.code).trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_-]{0,19}$/.test(code)) fail('code', 'Code must start with a letter: letters, digits, _ or -, up to 20');
    if (!RULE_KINDS.includes(String(v.kind).toLowerCase())) fail('kind', `Kind must be one of ${RULE_KINDS.join(', ')}`);
    if (v.method && !RULE_METHODS.includes(v.method.toLowerCase())) fail('method', `Method must be one of ${RULE_METHODS.join(', ')}`);
    if (v.fractionRule && !['round_up', 'prorate'].includes(v.fractionRule.toLowerCase())) fail('fractionRule', 'Fraction Rule must be round_up or prorate');
    const list = (s) => (s ? s.split(/[;,]/).map((x) => x.trim()).filter(Boolean) : undefined);
    const regimes = list(v.regimes)?.map((x) => x.toLowerCase());
    if (regimes?.some((x) => !TAX_REGIMES.includes(x))) fail('regimes', `Tax Regimes must be among ${TAX_REGIMES.join(', ')}`);
    const n = (k, label, max = 1e12) => {
      const x = amountValue(k, v[k], label);
      if (x !== null && x > max) fail(k, `${label} must be at most ${max}`);
      return x ?? undefined;
    };
    const active = toBool(v.active);
    if (active === null) fail('active', 'Active must be Yes or No');
    const body = { name: v.name, kind: v.kind.toLowerCase(), method: v.method?.toLowerCase(), rate: n('rate', 'Rate', 100), unitAmount: n('unitAmount', 'Unit Amount'),
      unitSize: n('unitSize', 'Unit Size'), fractionRule: v.fractionRule?.toLowerCase(), lines: list(v.lines), regimes, minimumAmount: n('minimumAmount', 'Minimum Amount'),
      sortOrder: n('sortOrder', 'Sort Order', 10000), active, effectiveFrom: dateValue('effectiveFrom', v.effectiveFrom, 'Effective From') || undefined,
      effectiveTo: v.effectiveTo ? dateValue('effectiveTo', v.effectiveTo, 'Effective To') : undefined, remarks: v.remarks || undefined };
    const clean = Object.fromEntries(Object.entries(body).filter(([, x]) => x !== undefined));
    if (await one('SELECT 1 FROM premium_charge_rules WHERE code = $1', [code])) {
      await charges.updateRule(code, clean, ctx.user);
      return 'updated';
    }
    await charges.createRule({ code, ...clean }, ctx.user);
    return 'created';
  },
});

const lguSheet = () => ({
  key: 'lgu-rates', name: 'LGU Rates', menu: 'Master > Finance > Premium Taxes & LGU Rates (LGU Tax Rates)',
  columns: [
    { key: 'code', header: 'Code', required: true, format: 'Letters, digits, _ or -, up to 20' },
    { key: 'name', header: 'Name', required: true, format: 'City or municipality (the local government unit levying the tax)' },
    { key: 'province', header: 'Province', format: 'Province of the Province master (Metro Manila for NCR)' },
    { key: 'city', header: 'City / Municipality', aliases: ['City'], format: 'Name or PSGC code of a city / municipality of the City / Municipality master (optional link)' },
    { key: 'rate', header: 'Rate', required: true, type: 'number', format: 'Percent, e.g. 0.2 for 0.2%' },
    { key: 'effectiveFrom', header: 'Effective From', type: 'date' },
    { key: 'effectiveTo', header: 'Effective To', type: 'date' },
    { key: 'active', header: 'Active', type: 'bool', list: 'Yes No' },
    { key: 'remarks', header: 'Remarks' },
  ],
  keyColumns: ['code'], keyOf: (v) => keyText(v.code),
  sample: { code: 'VAL', name: 'Valenzuela City', province: 'Metro Manila', city: 'Valenzuela City', rate: '0.2', effectiveFrom: '2026-01-01', active: 'Yes' },
  async exportRows() {
    return (await charges.listLgus()).map((r) => ({ code: r.code, name: r.name, province: cell(r.province), city: cell(r.cityName), rate: String(r.rate),
      effectiveFrom: cell(r.effectiveFrom), effectiveTo: cell(r.effectiveTo), active: yesNo(r.active), remarks: cell(r.remarks) }));
  },
  async importRow(ctx, v) {
    const code = String(v.code).trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(code)) fail('code', 'Code must be letters, digits, _ or -, up to 20');
    const rate = amountValue('rate', v.rate, 'Rate');
    if (rate === null || rate > 100) fail('rate', 'Rate must be a percent from 0 to 100');
    let cityId = null;
    if (v.city) {
      // a PSGC code, or a name (several cities share a name, e.g. San Jose: the one in the row's province first)
      const c = await one(`SELECT ci.id FROM cities ci JOIN states s ON s.id = ci.state_id
        WHERE (ci.psgc_code = $1 OR lower(ci.name) = lower($1)) AND ci.status <> 'deleted'
        ORDER BY (ci.psgc_code = $1) DESC, (lower(s.name) = lower($2)) DESC, (ci.status = 'active') DESC, ci.id LIMIT 1`, [String(v.city).trim(), v.province || '']);
      if (!c) fail('city', `City / municipality ${v.city} is not in the City / Municipality master`);
      cityId = c.id;
    }
    const active = toBool(v.active);
    if (active === null) fail('active', 'Active must be Yes or No');
    const body = Object.fromEntries(Object.entries({ code, name: v.name, province: v.province || null, cityId, rate, active,
      effectiveFrom: dateValue('effectiveFrom', v.effectiveFrom, 'Effective From') || undefined, effectiveTo: v.effectiveTo ? dateValue('effectiveTo', v.effectiveTo, 'Effective To') : undefined,
      remarks: v.remarks || undefined }).filter(([, x]) => x !== undefined));
    const hit = await one('SELECT id FROM lgu_tax_rates WHERE code = $1', [code]);
    if (hit) {
      await charges.updateLgu(hit.id, body, ctx.user);
      return 'updated';
    }
    await charges.createLgu(body, ctx.user);
    return 'created';
  },
});

// ------------------------------------------------------------------ authority matrix

const authoritySheet = () => ({
  key: 'authority-limits', name: 'Authority Limits', menu: 'Master > Generals > User Management > Authority Matrix',
  columns: [
    { key: 'transactionType', header: 'Transaction Type', required: true, list: 'Transaction Types', format: 'Code of the transaction type (Lists sheet)' },
    { key: 'role', header: 'Role', required: true, list: 'Roles', format: 'Role code' },
    { key: 'maxAmount', header: 'Max Amount', type: 'number', format: 'Amount in PHP (percent for the quotation discount); empty = no limit' },
    { key: 'remarks', header: 'Remarks' },
  ],
  keyColumns: ['transactionType', 'role'], keyOf: (v) => keyText(v.transactionType, v.role),
  sample: { transactionType: 'payment_voucher', role: 'accounting', maxAmount: '2000000', remarks: 'Board resolution 2026-05' },
  async exportRows() {
    const rows = await many(`SELECT transaction_type, role_code, max_amount, remarks FROM authority_limits WHERE status = 'active' AND role_code IS NOT NULL
      ORDER BY transaction_type, role_code`);
    return rows.map((r) => ({ transactionType: r.transaction_type, role: r.role_code, maxAmount: r.max_amount === null ? '' : String(Number(r.max_amount)), remarks: cell(r.remarks) }));
  },
  async importRow(ctx, v) {
    const type = String(v.transactionType).trim().toLowerCase();
    const role = String(v.role).trim().toLowerCase();
    if (!(await one('SELECT 1 FROM authority_transaction_types WHERE code = $1', [type]))) fail('transactionType', `Unknown transaction type ${v.transactionType}`);
    if (!(await one('SELECT 1 FROM roles WHERE code = $1', [role]))) fail('role', `Unknown role ${v.role}`);
    const max = amountValue('maxAmount', v.maxAmount, 'Max Amount');
    const same = (x) => (x === null || x === undefined ? null : Number(x)) === max;
    const active = await one('SELECT max_amount FROM authority_limits WHERE transaction_type = $1 AND role_code = $2 AND status = \'active\' ORDER BY id DESC LIMIT 1', [type, role]);
    if (active && same(active.max_amount)) return 'unchanged';
    const pending = await one('SELECT max_amount FROM authority_limits WHERE transaction_type = $1 AND role_code = $2 AND status = \'pending\' ORDER BY id DESC LIMIT 1', [type, role]);
    if (pending && same(pending.max_amount)) return 'unchanged';
    // maker-checker: the limit waits for another administrator's approval on the Authority Matrix screen
    await proposeLimit({ query }, { transactionType: type, roleCode: role, maxAmount: max, unlimited: max === null, remarks: v.remarks || 'Go-live configuration workbook' }, ctx.user);
    return 'proposed';
  },
});

// ------------------------------------------------------------------ document numbering

/**
 * Counter of a series in the current period: counter (the last number issued, null when the period has no counter yet,
 * e.g. after the transaction reset) and start (where that counter starts: the configured next number of the period,
 * else the start number).
 */
const COUNTER_SQL = (code, rule) => `(SELECT q.value AS counter, numbering_start_number(${code}, k.period) AS start
  FROM (SELECT numbering_period_key(${rule}, numbering_business_date()) AS period) k LEFT JOIN sequences q ON q.name = ${code} AND q.period = k.period) s`;
const nextOf = (c) => (c.counter === null || c.counter === undefined ? Number(c.start) : Number(c.counter) + 1);

const numberingSheet = () => ({
  key: 'numbering', name: 'Numbering', menu: 'Master > Configuration > Document Numbering',
  columns: [
    { key: 'code', header: 'Series Code', required: true, format: 'Code of a document series (fixed by the system), e.g. policy, receipt, invoice' },
    { key: 'name', header: 'Name' },
    { key: 'prefix', header: 'Prefix', format: '1 to 20 characters; unique among active series' },
    { key: 'pattern', header: 'Pattern', format: 'Tokens {PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {SEQ}, e.g. {PREFIX}-{YYYY}-{SEQ}' },
    { key: 'seqWidth', header: 'Sequence Width', type: 'number', format: 'Digits of the sequence, 1 to 12 (padding with zeros)' },
    { key: 'resetRule', header: 'Reset Rule', list: 'Reset Rule' },
    { key: 'nextNumber', header: 'Next Number', type: 'number', format: 'Next sequence number of the current period: the last number used in the old system plus one. It cannot go below a number already issued; the transaction reset restarts the series here' },
    { key: 'active', header: 'Active', type: 'bool', list: 'Yes No' },
  ],
  keyColumns: ['code'], keyOf: (v) => keyText(v.code),
  sample: { code: 'receipt', name: 'Official Receipt', prefix: 'OR', pattern: '{PREFIX}-{YYYY}-{SEQ}', seqWidth: '5', resetRule: 'yearly', nextNumber: '1201', active: 'Yes' },
  async exportRows() {
    const rows = await many(`SELECT d.*, s.counter, s.start FROM document_numbering d CROSS JOIN LATERAL ${COUNTER_SQL('d.code', 'd.reset_rule')} ORDER BY d.module, d.code`);
    return rows.map((d) => ({ code: d.code, name: d.name, prefix: d.prefix, pattern: d.pattern, seqWidth: String(d.seq_width), resetRule: d.reset_rule,
      nextNumber: String(nextOf(d)), active: yesNo(d.active) }));
  },
  async importRow(ctx, v) {
    const code = String(v.code).trim().toLowerCase();
    const s = await one('SELECT * FROM document_numbering WHERE code = $1', [code]);
    if (!s) fail('code', `Unknown document series ${v.code}; series are fixed by the system`);
    const input = {};
    if (v.name && v.name !== s.name) input.name = v.name;
    if (v.prefix && v.prefix !== s.prefix) {
      if (v.prefix.length > 20) fail('prefix', 'Prefix is limited to 20 characters');
      input.prefix = v.prefix;
    }
    if (v.pattern && v.pattern !== s.pattern) input.pattern = v.pattern;
    if (v.resetRule && v.resetRule.toLowerCase() !== s.reset_rule) input.resetRule = v.resetRule.toLowerCase();
    if (v.seqWidth) {
      const w = numberCell(v.seqWidth);
      if (!Number.isInteger(w) || w < 1 || w > 12) fail('seqWidth', 'Sequence Width must be a whole number from 1 to 12');
      if (w !== Number(s.seq_width)) input.seqWidth = w;
    }
    const active = toBool(v.active);
    if (active === null) fail('active', 'Active must be Yes or No');
    if (active !== undefined && active !== s.active) input.active = active;
    const pattern = input.pattern ?? s.pattern;
    const errors = validatePattern(pattern, input.resetRule ?? s.reset_rule);
    if (errors.length) fail('pattern', errors.map((e) => e.message).join('; '));
    let changed = false;
    if (Object.keys(input).length) {
      await updateSeries(code, input, ctx.user);
      changed = true;
    }
    const counterOf = async () => one(`SELECT s.counter, s.start FROM ${COUNTER_SQL('$1::text', '$2::text')}`, [code, input.resetRule ?? s.reset_rule]);
    if (v.nextNumber) {
      const next = numberCell(v.nextNumber);
      if (!Number.isInteger(next) || next < 1) fail('nextNumber', 'Next Number must be a whole number of 1 or more');
      const c = await counterOf();
      // never below a number already issued in the current period
      if (c.counter !== null && next <= Number(c.counter)) {
        fail('nextNumber', `The next number cannot go backwards: ${c.counter} has already been issued; enter ${Number(c.counter) + 1} or more`);
      }
      // the next number becomes the start of the period's counter too (kept on the series), so the transaction reset
      // restarts the series here and the Numbering sheet need not be loaded again
      if (next !== nextOf(c)) {
        await setNextNumber(code, next, ctx.user);
        changed = true;
      }
    }
    // new numbers must not collide with migrated numbers of the same format (legacy numbers kept by migration)
    if (MIGRATED_NUMBER_TARGETS[code]) {
      const next = nextOf(await counterOf());
      const clash = await collidingNumber(code, next);
      if (clash) fail('nextNumber', `${MIGRATED_NUMBER_TARGETS[code].label} ${clash} already exists with the format of this series: set the Next Number above it`);
    }
    return changed ? 'updated' : 'unchanged';
  },
});

// ------------------------------------------------------------------ integrations: payee bank accounts and COC series

const payeeAccountsSheet = () => ({
  key: 'payee-bank-accounts', name: 'Payee Bank Accounts', menu: 'Master > Finance > Bank File Layouts (Payee bank accounts)',
  columns: [
    { key: 'payeeType', header: 'Payee Type', required: true, list: 'Payee Type', allowed: ['Insurer', 'Agent/Referrer', 'Customer', 'Supplier'], format: 'Insurer, Agent/Referrer, Customer or Supplier' },
    { key: 'payeeId', header: 'Payee', required: true, format: 'Insurer code, referrer id, client code or supplier code' },
    { key: 'bankCode', header: 'Bank Code', required: true, format: 'Code of the Bank master (BDO, BPI, MBT, LBP, UBP ...)' },
    { key: 'accountNumber', header: 'Account Number', required: true, format: 'Digits, spaces and -' },
    { key: 'accountName', header: 'Account Name', required: true },
    { key: 'accountType', header: 'Account Type', list: 'Bank Account Type', allowed: ['savings', 'current'], format: 'savings or current (savings when empty)' },
    { key: 'bankBranch', header: 'Bank Branch' },
    { key: 'email', header: 'Email', format: 'E-mail for the bank\'s credit advice' },
    { key: 'active', header: 'Active', type: 'bool', list: 'Yes No', format: 'Yes when empty' },
  ],
  keyColumns: ['payeeType', 'payeeId', 'accountNumber'], keyOf: (v) => `${keyText(v.payeeType)}|${keyText(v.payeeId)}|${keyText(v.accountNumber)}`,
  sample: { payeeType: 'Insurer', payeeId: 'MALAYAN', bankCode: 'MBT', accountNumber: '0071-2345-67', accountName: 'Malayan Insurance Co., Inc.', accountType: 'current', active: 'Yes' },
  async exportRows() {
    const rows = await many(`SELECT a.*, ic.code AS insurer_code FROM payee_bank_accounts a LEFT JOIN insurance_companies ic ON a.payee_type = 'Insurer' AND ic.id::text = a.payee_id
      ORDER BY a.payee_type, a.payee_name, a.id`);
    return rows.map((a) => ({ payeeType: a.payee_type, payeeId: a.insurer_code || a.payee_id, bankCode: a.bank_code, accountNumber: a.account_number, accountName: a.account_name,
      accountType: a.account_type, bankBranch: cell(a.bank_branch), email: cell(a.email), active: yesNo(a.active) }));
  },
  async importRow(ctx, v) {
    const { savePayeeAccount, PAYEE_TYPES } = await import('../integrations/bankfiles/batches.js');
    if (!PAYEE_TYPES.includes(v.payeeType)) fail('payeeType', `Payee Type must be one of ${PAYEE_TYPES.join(', ')}`);
    const active = v.active === undefined || v.active === null || v.active === '' ? true : toBool(v.active);
    if (active === null) fail('active', 'Active must be Yes or No');
    let payeeId = String(v.payeeId).trim();
    if (v.payeeType === 'Insurer') {
      const ins = await one('SELECT id FROM insurance_companies WHERE id::text = $1 OR upper(code) = upper($1) OR name = $1', [payeeId]);
      if (!ins) fail('payeeId', `Insurer ${payeeId} is not in the Insurer master`);
      payeeId = String(ins.id);
    }
    const hit = await one('SELECT id FROM payee_bank_accounts WHERE payee_type = $1 AND payee_id = $2 AND account_number = $3', [v.payeeType, payeeId, String(v.accountNumber).trim()]);
    await savePayeeAccount(hit?.id || null, { payeeType: v.payeeType, payeeId, bankCode: String(v.bankCode).trim(), accountNumber: String(v.accountNumber).trim(), accountName: v.accountName,
      accountType: v.accountType === 'current' ? 'current' : 'savings', bankBranch: v.bankBranch || null, email: v.email || null, isDefault: true, active }, ctx.user);
    return hit ? 'updated' : 'created';
  },
});

const cocSeriesSheet = () => ({
  key: 'coc-series', name: 'COC Series', menu: 'Operations > CTPL Authentication (COC series)',
  columns: [
    { key: 'insurer', header: 'Insurer', required: true, list: 'Insurers', format: 'Insurer code (or name)' },
    { key: 'branchCode', header: 'Branch Code', format: 'Branch the series is for; empty = every branch' },
    { key: 'prefix', header: 'Prefix', format: 'Capital letters, digits and -' },
    { key: 'seriesFrom', header: 'From', required: true, type: 'number', format: 'First COC number' },
    { key: 'seriesTo', header: 'To', required: true, type: 'number', format: 'Last COC number' },
    { key: 'nextNumber', header: 'Next Number', type: 'number', format: 'Next number not yet used (the first number when empty)' },
    { key: 'numberWidth', header: 'Digits', type: 'number', format: 'Digits of the number, zero-padded (8 when empty)' },
    { key: 'remarks', header: 'Remarks' },
  ],
  keyColumns: ['insurer', 'prefix', 'seriesFrom'], keyOf: (v) => `${keyText(v.insurer)}|${keyText(v.prefix)}|${keyText(v.seriesFrom)}`,
  sample: { insurer: 'MALAYAN', prefix: 'MIC', seriesFrom: '10000', seriesTo: '10499', nextNumber: '10000', numberWidth: '8' },
  async exportRows() {
    const rows = await many('SELECT s.*, ic.code AS insurer_code FROM coc_series s JOIN insurance_companies ic ON ic.id = s.insurance_company_id ORDER BY ic.code, s.prefix, s.series_from');
    return rows.map((r) => ({ insurer: r.insurer_code, branchCode: cell(r.branch_code), prefix: r.prefix, seriesFrom: String(r.series_from), seriesTo: String(r.series_to),
      nextNumber: String(r.next_number), numberWidth: String(r.number_width), remarks: cell(r.remarks) }));
  },
  async importRow(ctx, v) {
    const ins = await one('SELECT id FROM insurance_companies WHERE upper(code) = upper($1) OR name = $1', [String(v.insurer).trim()]);
    if (!ins) fail('insurer', `Insurer ${v.insurer} is not in the Insurer master`);
    const prefix = String(v.prefix || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]*$/.test(prefix)) fail('prefix', 'Prefix must be capital letters, digits and -');
    const from = numberCell(v.seriesFrom); const to = numberCell(v.seriesTo);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) fail('seriesTo', 'From and To must be whole numbers, To not below From');
    const next = v.nextNumber ? numberCell(v.nextNumber) : from;
    if (!Number.isInteger(next) || next < from || next > to + 1) fail('nextNumber', 'Next Number must be between From and To + 1');
    const width = v.numberWidth ? numberCell(v.numberWidth) : 8;
    const hit = await one('SELECT id FROM coc_series WHERE insurance_company_id = $1 AND prefix = $2 AND series_from = $3', [ins.id, prefix, from]);
    if (hit) {
      await query(`UPDATE coc_series SET series_to = $2, next_number = GREATEST(next_number, $3), number_width = $4, branch_code = $5, remarks = $6,
        status = CASE WHEN GREATEST(next_number, $3) > $2 THEN 'exhausted' ELSE status END, updated_by = $7, updated_at = now() WHERE id = $1`,
      [hit.id, to, next, width, v.branchCode || null, v.remarks || null, ctx.user?.id ?? null]);
      return 'updated';
    }
    const overlap = await one('SELECT 1 FROM coc_series WHERE insurance_company_id = $1 AND prefix = $2 AND series_from <= $4 AND series_to >= $3', [ins.id, prefix, from, to]);
    if (overlap) fail('seriesFrom', 'The numbers overlap another series of the insurer with the same prefix');
    await query(`INSERT INTO coc_series(insurance_company_id, branch_code, prefix, series_from, series_to, next_number, number_width, status, remarks, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, [ins.id, v.branchCode || null, prefix, from, to, next, width, next > to ? 'exhausted' : 'active', v.remarks || null, ctx.user?.id ?? null]);
    return 'created';
  },
});

// ------------------------------------------------------------------ the kit

/** Sheets of the configuration kit, in load order. */
export async function configurationSheets() {
  const m = async (code) => masterSheet(code);
  return [
    await m('company'), settingsSheet(),
    await m('country'), await m('region'), await m('state'), await m('city'), await m('barangay'),
    await m('branch'), await m('department'), await m('hierarchy'), await m('designation'), usersSheet(),
    await m('currency'), await m('exchange-rate'), accountsSheet(),
    await m('bank'), await m('bank-account'), await m('signatory'), await m('transaction-code'), await m('write-off-reason'),
    await m('insurance-company'), await m('line-of-business'), await m('product'), await m('policy-type'), await m('cover'),
    await m('vehicle-brand'), await m('vehicle-model'), await m('vehicle-variant'), await m('vehicle'),
    await m('supplier'), await m('asset-class'), await m('short-period-rate'), await m('cancellation-reason'), await m('claim-document-requirement'), await m('repair-shop'),
    commissionSheet(), chargesSheet(), lguSheet(), authoritySheet(), numberingSheet(),
    // integrations: bank accounts of the payees paid by bank file, COC number series of the insurers
    payeeAccountsSheet(), cocSeriesSheet(),
  ];
}

/** Configuration objects without a sheet: entered on their screen (Instructions sheet). */
export const CONFIGURATION_ON_SCREEN = [
  ['Roles and their permissions', 'Master > Generals > User Management > Role'],
  ['Segregation of duties rules, delegations, access reviews', 'Master > Generals > User Management > Segregation of Duties / Delegations / Access Reviews'],
  ['Approval of the authority limits loaded by this workbook (maker-checker)', 'Master > Generals > User Management > Authority Matrix'],
  ['Tax codes (VAT, withholding, BIR ATC)', 'Master > Finance > Taxation'],
  ['Account determination and posting rules (changes approved by a second user)', 'Master > Finance > Account Determination / Posting Rules / Configuration Approvals'],
  ['Bank statement formats, bank transaction types, insurer statement formats, close checklist', 'Master > Finance > Bank Statement Formats / Bank Transaction Types / Insurer Statement Formats / Close Checklist'],
  ['Product templates, rating, acceptance rules, motor tariff, documents', 'Product Configurator > Product Templates'],
  ['Package bundles and insurer rate tables', 'Master > Packaged Products'],
  ['Payment gateway credentials (kept in the secret store)', 'Master > Finance > Payment Gateways'],
  ['Integration connectors (endpoint, mode, credential variable names; the credentials themselves in the secret store), message templates, insurer API mappings', 'Master > System Configuration > Integrations / Message Templates / Insurer Integration'],
  ['Bank file layouts (validate each starter layout with the bank)', 'Master > Finance > Bank File Layouts'],
  ['Application name, logo, colours, display currency, language', 'Master > System Settings'],
  ['Company logo and letterhead images', 'Master > Generals > Organization > Company (upload the logo on the screen)'],
  ['Scheduled jobs', 'Master > Configuration > Schedules'],
  ['Sales activity types and outcomes (starter lists are installed)', 'Master > Organization > Sales Activity Types / Sales Activity Outcomes'],
  ['Fiscal years and accounting periods (close the periods before the cutover date)', 'Accounts > Period End > Period Management'],
  ['Remittance masters, incentive programs', 'Master > Finance > Remittance Master; Incentive'],
  ['Referrers / agents and their commission accounts', 'Commission > Agents/Referrer Accounts'],
  ['Petty cash funds', 'Accounts > Petty Cash > Initiate'],
  ['Users\' passwords: never in the workbook. A new user gets a temporary password shown once after the load (change at first sign-in); a forgotten one is reset on the screen', 'Master > Generals > User Management > User > Reset password'],
  ['Go-live lock (golive.locked)', 'Master > Configuration (Go-live): switch it on once the migration is signed off'],
];
