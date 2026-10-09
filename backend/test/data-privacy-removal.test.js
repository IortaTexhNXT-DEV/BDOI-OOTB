/**
 * Master > Data Privacy withdrawn (migration 0350): no data subject request register, privacy API, job, DSR series or
 * read:privacy / write:privacy; the consent register table stays for the campaign opt-out and the messaging consent
 * check (campaigns.test.js, integrations.test.js), with privacy.notice_version, the anonymised_at columns and the
 * masking of personal identifiers (view:pii).
 */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';

const MIGRATION = fs.readFileSync(new URL('../src/db/migrations/0350_remove_data_privacy.sql', import.meta.url), 'utf8');
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

const state = async () => ({
  dsr: (await q("SELECT to_regclass('data_subject_requests') IS NOT NULL AS ok"))[0].ok,
  consents: (await q("SELECT to_regclass('privacy_consents') IS NOT NULL AS ok"))[0].ok,
  anonymised: (await q(`SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_name IN ('clients', 'leads') AND column_name = 'anonymised_at'`))[0].n,
  permissions: (await q("SELECT code FROM permissions WHERE code IN ('read:privacy', 'write:privacy', 'view:pii') ORDER BY code")).map((r) => r.code),
  settings: (await q("SELECT key FROM app_settings WHERE key LIKE 'privacy.%' OR key = 'numbering.data_subject_request.prefix' ORDER BY key")).map((r) => r.key),
  exempt: (await q("SELECT value FROM app_settings WHERE key = 'privacy.masking_exempt_paths'"))[0].value,
  job: (await q("SELECT count(*)::int AS n FROM scheduled_jobs WHERE code = 'privacy-requests-due'"))[0].n,
  series: (await q("SELECT count(*)::int AS n FROM document_numbering WHERE code = 'data_subject_request'"))[0].n,
});

describe('data privacy withdrawn', () => {
  it('leaves no register, job, number series, setting or permission of the data subject requests', async () => {
    expect(await state()).toEqual({
      dsr: false, consents: true, anonymised: 2, permissions: ['view:pii'],
      settings: ['privacy.masking_enabled', 'privacy.masking_exempt_paths', 'privacy.notice_version', 'privacy.pii_reveal_mode'],
      exempt: expect.not.arrayContaining(['/api/privacy/parties']), job: 0, series: 0,
    });
  });

  it('answers the former privacy API with Not found', async () => {
    for (const path of ['/privacy/requests', '/privacy/consents/register', '/privacy/parties?search=a']) {
      expect((await ctx.api('get', path)).status, path).toBe(404);
    }
  });

  it('removes them from a database in use and changes nothing when run again', async () => {
    const before = await state();
    await q(`CREATE TABLE data_subject_requests (id text PRIMARY KEY, request_number text NOT NULL)`);
    await q(`INSERT INTO permissions(code, module, description) VALUES ('read:privacy', 'privacy', 'View'), ('write:privacy', 'privacy', 'Change')`);
    await q(`INSERT INTO role_permissions(role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.code = 'operations' AND p.code IN ('read:privacy', 'write:privacy')`);
    await q(`INSERT INTO app_settings(key, value, "group", label, type) VALUES ('privacy.request_due_days', '15', 'privacy', 'Due days', 'number'),
      ('privacy.retention_years', '10', 'privacy', 'Retention', 'number')`);
    await q(`UPDATE app_settings SET value = value || '["/api/privacy/parties"]'::jsonb WHERE key = 'privacy.masking_exempt_paths'`);
    await q(`INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled)
      VALUES ('privacy-requests-due', 'Overdue data subject requests', 'Reminder', '0 7 * * *', 'privacyRequestsDue', '{}', false)`);
    await pool.query(MIGRATION);
    expect(await state()).toEqual(before);
    await pool.query(MIGRATION);
    expect(await state()).toEqual(before);
  });
});
