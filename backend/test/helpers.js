import request from 'supertest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

/** Fresh schema + seed, an app instance and an admin token. Call once per test file (beforeAll). */
export async function setup() {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  return { app, token: r.body.accessToken, api: (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`) };
}
/**
 * A custom role limited to its own book, for the record-scoping tests. The Agent / Referrer login role was withdrawn
 * (referrers do not sign in), but any role an administrator creates can be restricted to its own book through
 * security.scoped_roles; this one has the permissions the withdrawn agent role had.
 */
export const OWN_BOOK_ROLE = 'own-book';
export const OWN_BOOK_PERMISSIONS = ['profile', 'leads', 'quotations', 'policies', 'endorsements', 'claims', 'notifications']
  .flatMap((m) => [`read:${m}`, `write:${m}`]).concat('read:clients');
export async function createOwnBookRole(api) {
  const r = await api('post', '/roles').send({ code: OWN_BOOK_ROLE, name: 'Own book (test)', permissions: OWN_BOOK_PERMISSIONS });
  if (r.status !== 201) throw new Error(`own-book role: ${r.status} ${JSON.stringify(r.body)}`);
  const s = await api('put', '/settings').send({ settings: { 'security.scoped_roles': [OWN_BOOK_ROLE] } });
  if (s.status !== 200) throw new Error(`scoped roles: ${s.status}`);
  return OWN_BOOK_ROLE;
}
/**
 * A custom user-administration role that is not an administrator (what the withdrawn User Access Administrator did):
 * users, roles, the audit trail. Used to check the protections of the System Administrator role and of one's own access.
 */
export const USER_DESK_ROLE = 'user-desk';
export async function createUserDeskRole(api) {
  const permissions = ['read:profile', 'write:profile', 'read:users', 'write:users', 'read:roles', 'write:roles', 'read:audit', 'read:notifications', 'write:notifications', 'read:settings'];
  const r = await api('post', '/roles').send({ code: USER_DESK_ROLE, name: 'User desk (test)', permissions });
  if (r.status !== 201) throw new Error(`user-desk role: ${r.status} ${JSON.stringify(r.body)}`);
  return USER_DESK_ROLE;
}
export async function loginAs(app, username, password) {
  const r = await request(app).post('/api/auth/login').send({ username, password });
  return r.body.accessToken;
}
/**
 * Switch off the output VAT and EWT on broker-billed commission (migration 0170), for suites whose expected figures
 * are the premium due to insurers without commission taxes. test/commission-taxes.test.js covers them switched on.
 */
export async function withoutCommissionTaxes() {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  await query('UPDATE app_settings SET value = \'false\' WHERE key IN (\'accounting.broker_billed_commission_vat\', \'accounting.broker_billed_commission_ewt\')');
  clearSettingsCache();
}
/**
 * Apply posting rule and account determination changes at once (no second approver, migration 0174), for suites that
 * test the effect of a change. test/configuration-controls.test.js covers the approval.
 */
export async function withoutConfigurationApproval() {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  await query('UPDATE app_settings SET value = \'false\' WHERE key = \'accounting.configuration_maker_checker\'');
  clearSettingsCache();
}
/**
 * A policy through the placement chain, the only way a policy is issued (TIS-BRD-ISSUE-01): a direct placement is
 * raised, sent, its e-policy (insurer number = policyNumber) recorded, checked against the slip and booked. The check is
 * confirmed by `checker`; without one the maker-checker of the check is switched off for that step (suites that only
 * need an issued policy). Returns the response of the first step that fails, else the booking's.
 */
export async function placeAndBook(api, body, { policyNumber = null, checker = null } = {}) {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  const raised = await api('post', '/placements').send(body);
  if (raised.status !== 201) return raised;
  const p = raised.body;
  const sent = await api('post', `/placements/${p.id}/send`).send({});
  if (sent.status !== 200) return sent;
  const file = await api('post', '/s3/upload').field('folder', 'placement-epolicies')
    .attach('file', Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'), 'e-policy.pdf');
  const number = policyNumber || `INS-${p.placementNumber}`;
  const ep = await api('post', `/placements/${p.id}/epolicy`).send({ documentKey: file.body.data.key, insurerPolicyNumber: number, brokerPolicyNumber: policyNumber || undefined,
    participantName: p.insuredName, sumInsured: p.sumInsured, netPremium: p.netPremium, issueDate: p.inceptionDate, effectiveDate: p.inceptionDate, expiryDate: p.expiryDate,
    vehicle: body.vehicle });
  if (ep.status !== 200) return ep;
  const setCheck = async (on) => { await query("UPDATE app_settings SET value = $1 WHERE key = 'placement.check_maker_checker'", [JSON.stringify(on)]); clearSettingsCache(); };
  if (!checker) await setCheck(false);
  try {
    const checked = await (checker || api)('post', `/placements/${p.id}/check`).send({ decision: 'confirm' });
    if (checked.status !== 200) return checked;
  } finally {
    if (!checker) await setCheck(true);
  }
  return (checker || api)('post', `/placements/${p.id}/book`).send({});
}

/**
 * Switch products outside the TISPH catalogue (migration 0341) back on, with their policy types, lines of business,
 * Product Configurator templates and risk mappings, insurer rate tables and the package bundles made of active
 * products only: for suites that test the lines TISPH does not sell yet (fire, IAR, employee benefits, marine cargo).
 * Without codes, every inactive product.
 */
export async function withProducts(codes = null) {
  const { query } = await import('../src/db/pool.js');
  if (!codes) codes = (await query("SELECT code FROM products WHERE status = 'inactive'")).rows.map((r) => r.code);
  await query("UPDATE products SET status = 'active' WHERE code = ANY($1)", [codes]);
  await query(`UPDATE policy_types t SET status = 'active' FROM products p
    WHERE p.id = t.product_id AND p.code = ANY($1) AND t.code NOT IN ('ODTH', 'PA-GRP')`, [codes]);
  await query(`UPDATE master_records SET status = 'active' WHERE type_code = 'line-of-business'
    AND code IN (SELECT upper(line) FROM products WHERE code = ANY($1))`, [codes]);
  await query(`UPDATE product_templates t SET status = 'Active' FROM products p
    WHERE p.id = t.product_id AND p.code = ANY($1) AND t.status = 'Inactive'`, [codes]);
  await query("UPDATE product_risk_mappings SET status = 'Active' WHERE upper(lob_code) = ANY($1)", [codes]);
  await query('UPDATE insurer_rate_tables r SET active = true FROM products p WHERE p.id = r.product_id AND p.code = ANY($1)', [codes]);
  await query(`UPDATE package_bundles b SET status = 'active' WHERE NOT EXISTS (SELECT 1 FROM package_bundle_sections s
    JOIN products p ON p.id = s.product_id WHERE s.bundle_id = b.id AND p.status <> 'active')`);
}
