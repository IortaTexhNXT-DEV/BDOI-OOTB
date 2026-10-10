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
 * Fiscal year on the calendar year (accounting.fiscal_year_start_month = 1) for suites whose dates and fiscal year codes
 * assume it. TISPH's April start (seed 80_tisph_configuration.sql) is covered by test/period-end-calendar.test.js and
 * test/tisph-configuration.test.js.
 */
export async function withCalendarFiscalYear() {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  await query('UPDATE app_settings SET value = \'1\' WHERE key = \'accounting.fiscal_year_start_month\'');
  clearSettingsCache();
}
/**
 * No blocking manual items on the month-end checklist (seed 63_bank_reconciliation.sql signs off the bank
 * reconciliations), for suites that close whole years from Period Management to test what follows. The sign-off itself
 * is covered by test/period-end.test.js.
 */
export async function withoutManualSignOffs() {
  const { query } = await import('../src/db/pool.js');
  await query('UPDATE period_close_checklist SET active = false WHERE item_type = \'manual\' AND severity = \'blocking\'');
}
/**
 * The starter accounts of the premium payable roles (seed 40_finance.sql, migration 0131: premiums payable to insurers
 * and the VAT, DST and LGT on premium in their own accounts), for suites whose expected journals name them. The TISPH
 * mapping of these roles to Accounts Payable - Insurance Company (seed 81_tisph_finance.sql) is covered by
 * test/remittance-basis.test.js.
 */
export async function withStarterInsurerAccounts() {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  await query(`UPDATE app_settings s SET value = to_jsonb(v.code) FROM (VALUES ('accounting.account.due_to_insurer', '2201001'), ('accounting.account.premium_vat_payable', '2201002'),
    ('accounting.account.premium_dst_payable', '2201003'), ('accounting.account.premium_lgt_payable', '2201004')) AS v(key, code) WHERE s.key = v.key`);
  await query('UPDATE app_settings SET value = value || \'{"Insurer": "2201001"}\'::jsonb WHERE key = \'accounting.payable_account_by_payee\'');
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

/**
 * Switch back on the starter records TISPH does not use (seed 93_tisph_master_data.sql), as an administrator would: the
 * insurers MAPFRE, FPG and Mercantile, the foreign currencies and the bank file layouts other than Metrobank. For suites
 * that test other insurers, foreign currencies or other banks' payment files.
 */
export async function withStarterMasters() {
  const { query } = await import('../src/db/pool.js');
  await query("UPDATE insurance_companies SET status = 'active', updated_by = 'test' WHERE code IN ('MAPFRE', 'FPG', 'MERCANTILE')");
  await query("UPDATE currencies SET status = 'active', updated_by = 'test' WHERE code IN ('USD', 'EUR', 'SGD', 'JPY')");
  await query("UPDATE bank_file_layouts SET active = true, updated_by = 'test' WHERE code IN ('BDO-BULK', 'BPI-BULK', 'LBP-BULK', 'UBP-BULK', 'GENERIC-CSV')");
}

/**
 * The packaged products the package suites price (test/fixtures/packaged-products.sql: insurer rate tables and the SME
 * Shield and Home Protect bundles, on lines TISPH does not sell), loaded before withProducts() switches those lines on.
 */
export async function withPackagedProducts() {
  const fs = await import('node:fs');
  const { query } = await import('../src/db/pool.js');
  await query(fs.readFileSync(new URL('./fixtures/packaged-products.sql', import.meta.url), 'utf8'));
  await withProducts();
}

/**
 * A sample motor policy (and its quotation) reduced to own damage only: sum insured x rate, no acts of nature, excess
 * liability, auto passenger PA or CTPL, with VAT, DST and LGT at the tax.*_rate settings. For the endorsement suites
 * whose figures start from a plain own damage premium.
 */
export async function withOwnDamageOnly(policyId, sumInsured, ratePercent) {
  const { query } = await import('../src/db/pool.js');
  const rate = Object.fromEntries((await query("SELECT key, (value #>> '{}')::numeric AS v FROM app_settings WHERE key IN ('tax.vat_rate', 'tax.dst_rate', 'tax.lgt_rate')"))
    .rows.map((r) => [r.key, Number(r.v)]));
  const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const net = cents((sumInsured * ratePercent) / 100);
  const vat = cents(net * rate['tax.vat_rate']);
  const dst = cents(net * rate['tax.dst_rate']);
  const lgt = cents(net * rate['tax.lgt_rate']);
  const gross = cents(net + vat + dst + lgt);
  const drop = ['actsOfNatureRate', 'actsOfNaturePremium', 'bodilyInjury', 'bodilyInjuryCoveragePremium', 'biCoverageId', 'propertyDamage', 'propertyDamageCoveragePremium',
    'pdCoverageId', 'autoPassengerPersonalAccident', 'APPAtotalCoverage', 'APPAcoveragePremium', 'appaSeats', 'APPARate', 'includeCTPL', 'ctplTermYears', 'ctplCoveragePremium',
    'ctplCoverageRate', 'cocNumber', 'premiumBreakdown'];
  const doc = JSON.stringify({ lossAndDamageCoverage: String(sumInsured), lossAndDamageCoverageRate: String(ratePercent), lossAndDamageCoveragePremium: net, totalSumInsured: sumInsured,
    netPremium: net, valueAddedTax: vat, documentaryStampTax: dst, localGovernmentTax: lgt, grossPremium: gross });
  const { rows: [p] } = await query(`UPDATE policies SET doc = (doc - $2::text[]) || $3::jsonb, sum_insured = $4, net_premium = $5, premium_total = $6,
      commission_amount = round($5 * COALESCE((SELECT commission_rate FROM quotes WHERE id = policies.quote_id), 0.15), 2) WHERE id = $1 RETURNING quote_id`,
  [policyId, drop, doc, sumInsured, net, gross]);
  if (p?.quote_id) {
    await query(`UPDATE quotes SET doc = (doc - $2::text[]) || $3::jsonb, sum_insured = $4, premium_base = $5, vat = $6, dst = $7, lgt = $8, premium_total = $9,
        commission_amount = round($5 * commission_rate, 2) WHERE id = $1`, [p.quote_id, drop, doc, sumInsured, net, vat, dst, lgt, gross]);
  }
  return { net, gross };
}

/**
 * A remittance body whose lines name a policy number with the amounts the test needs: each such policy is issued to
 * the remittance's insurer at those amounts (premium, commission, tax) unless it exists, so the remittance is built at
 * the system amounts as BrokerVerse requires. Lines naming a policy id are kept as they are.
 */
export async function remittanceBody(body) {
  const { pool } = await import('../src/db/pool.js');
  const ins = (await pool.query('SELECT id FROM insurance_companies WHERE id::text = $1 OR lower(code) = lower($1) ORDER BY id LIMIT 1', [String(body.insurerCode ?? body.insurerId)])).rows[0];
  const lines = [];
  for (const l of body.lines || []) {
    if (l.policyId || l.premium === undefined) { lines.push(l); continue; }
    await pool.query(`INSERT INTO policies(policy_number, status, insurance_company_id, premium_total, commission_amount, details, expiry_date)
      VALUES ($1, 'issued', $2, $3, $4, $5, current_date + 365) ON CONFLICT (policy_number) DO NOTHING`,
    [l.policyNo, ins?.id ?? null, l.premium, l.commission ?? 0, JSON.stringify({ taxTotal: l.tax ?? 0 })]);
    lines.push({ policyNo: l.policyNo });
  }
  return { ...body, lines };
}
const secondAdministrators = new WeakMap();
/**
 * A delegation of approval authority in force, as Access Control grants it: requested by the administrator of `ctx`
 * for the next 30 days on annual leave (DLG-LEAVE) and approved by a second administrator, created once per app.
 * `body` names the delegator, the delegate and the transaction types. Returns { id, dateTo } of the delegation.
 */
export async function delegateAuthority(ctx, body) {
  const { addDays, today } = await import('../src/lib/dates.js');
  if (!secondAdministrators.has(ctx.app)) {
    await ctx.api('post', '/users').send({ username: 'test.admin2', password: 'Welcome@123', displayName: 'Second administrator', roles: ['system-admin'],
      email: 'test.admin2@example.ph' });
    const token = await loginAs(ctx.app, 'test.admin2', 'Welcome@123');
    secondAdministrators.set(ctx.app, (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`));
  }
  const day = await today();
  const d = await ctx.api('post', '/access-control/delegations').send({ dateFrom: day, dateTo: addDays(day, 30), reasonCode: 'DLG-LEAVE', ...body });
  if (d.status !== 201) throw new Error(`delegation: ${d.status} ${JSON.stringify(d.body)}`);
  const approved = await secondAdministrators.get(ctx.app)('post', `/access-control/changes/${d.body.data.change.id}/decision`).send({ decision: 'approve' });
  if (approved.status !== 200) throw new Error(`delegation approval: ${approved.status} ${JSON.stringify(approved.body)}`);
  const { query } = await import('../src/db/pool.js');
  const { rows: [delegation] } = await query('SELECT id FROM user_delegations WHERE change_id = $1', [d.body.data.change.id]);
  return { id: Number(delegation.id), dateTo: addDays(day, 30) };
}

/**
 * Two iorta TechNXT platform administrators signed in with their second factor (maker and checker of the feature
 * changes, modules/features), as api(method, path) functions. Created once per app (the accounts come from the same
 * seed function PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD use).
 */
const platformSessions = new WeakMap();
export const PLATFORM_ADMINS = [['platform.maker@iorta.test', 'Platform#Maker2026'], ['platform.checker@iorta.test', 'Platform#Checker2026']];
export async function platformAdmins(app) {
  if (platformSessions.has(app)) return platformSessions.get(app);
  const { query } = await import('../src/db/pool.js');
  const { seedPlatformAdmin } = await import('../src/db/seed.js');
  const { encryptSecret } = await import('../src/lib/secrets.js');
  const { generateSecret, totp } = await import('../src/lib/totp.js');
  const sessions = [];
  for (const [email, password] of PLATFORM_ADMINS) {
    const id = await seedPlatformAdmin({ log: () => {}, source: { PLATFORM_ADMIN_EMAIL: email, PLATFORM_ADMIN_PASSWORD: password } });
    const secret = generateSecret();
    await query('UPDATE users SET totp_secret = $2, totp_enabled = true, totp_enabled_at = now(), totp_last_step = NULL WHERE id = $1', [id, encryptSecret(secret)]);
    const first = await request(app).post('/api/auth/login').send({ username: email, password });
    const done = await request(app).post('/api/auth/login/2fa').send({ challengeToken: first.body.challengeToken, code: totp(secret) });
    if (!done.body.accessToken) throw new Error(`platform administrator ${email}: ${done.status} ${JSON.stringify(done.body)}`);
    const token = done.body.accessToken;
    sessions.push({ id, email, token, api: (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) });
  }
  const out = { maker: sessions[0], checker: sessions[1] };
  platformSessions.set(app, out);
  return out;
}

/**
 * Enable Phase 2 or future-release features for a suite that tests them: requested by one platform administrator,
 * approved by the other, through the API. `what`: feature keys, or { tier: 'PHASE_2' | 'FUTURE' }.
 */
export async function enableFeatures(app, what) {
  const { maker, checker } = await platformAdmins(app);
  const body = Array.isArray(what) ? { features: what } : what;
  const r = await maker.api('post', '/platform/features/changes').send({ action: 'enable', ...body, reasonCode: 'FTR-CONTRACT', releaseRef: 'TEST-SUITE', effective: 'immediate' });
  if (r.status === 400 && /Nothing to change/.test(r.body.message)) return null;
  if (r.status !== 201) throw new Error(`enable features: ${r.status} ${JSON.stringify(r.body)}`);
  const d = await checker.api('post', `/platform/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' });
  if (d.status !== 200) throw new Error(`approve features: ${d.status} ${JSON.stringify(d.body)}`);
  return d.body.data;
}
