/**
 * Role facts of the TISPH user manual (src/tools/manual-role-facts.js): the committed files under
 * docs/TISPH/manual/generated are those of the delivered configuration, so a change to the role grants, the menus,
 * the authority matrix or the segregation-of-duties rules that is not carried into the manual fails here. The fix is
 * `npm run manual:role-facts` on a freshly migrated and seeded database, never a hand edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { OUT_DIR, loadMenu, renderFiles, roleFacts } from '../src/tools/manual-role-facts.js';

let facts;
let files;

beforeAll(async () => {
  await setup();
  facts = await roleFacts(pool, await loadMenu());
  files = renderFiles(facts);
});
afterAll(async () => {
  await pool.end();
});

describe('TISPH manual role facts', () => {
  it('covers the thirteen roles of the departments, not the base platform roles or SUPERID', () => {
    expect(facts.roles.map((r) => r.code)).toEqual(['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer',
      'tis-ops-unit-head', 'tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-it-admin', 'tis-general-manager']);
    expect(facts.departments).toEqual(['Sales', 'Operations', 'Cash Control', 'Finance and Accounting', 'IT', 'Management']);
  });

  it('gives the access of a screen from the permissions of the role', () => {
    const role = (code) => facts.roles.find((r) => r.code === code);
    const access = (code, p) => role(code).menus.find((m) => m.path === p)?.access;
    expect(access('tis-ccd-bp', '/accounts/receipts')).toBe('Create and edit');
    expect(access('tis-ccd-bp', '/accounts/bank-reconciliation')).toBe('View');
    expect(access('tis-sales-officer', '/agent/Quotation')).toBe('Approve');
    expect(access('tis-sales-associate', '/agent/Quotation')).toBe('Create and edit');
    expect(access('tis-ccd-pdu', '/agent/Quotation')).toBeUndefined();
    expect(role('tis-sales-associate').approves).toEqual([]);
    expect(role('tis-sales-associate').approvedBy.find((a) => a.work === 'Quotations and placement').approvers).toContain('TIS Sales Officer');
    expect(role('tis-ccd-bp').sod.map((s) => s.rule)).toContain('Receipting and reversals');
  });

  it('writes business words only: no permission, role or setting code in the role chapters', () => {
    for (const [file, text] of Object.entries(files)) {
      if (!file.endsWith('.md')) continue;
      expect(text, file).not.toMatch(/\b(read|write|approve|view):[a-z-]+/);
      expect(text, file).not.toMatch(/\btis-[a-z]+-[a-z-]+\b(?![a-z-]*})/);
      expect(text, file).not.toMatch(/\b[a-z_]+\.[a-z_]+\b/);
    }
  });

  it('matches the committed files (run npm run manual:role-facts after a change to roles, menus or approvals)', () => {
    const committed = fs.readdirSync(path.join(OUT_DIR, 'roles')).map((f) => `roles/${f}`).concat('role-facts.json').sort();
    expect(committed).toEqual(Object.keys(files).sort());
    for (const [file, text] of Object.entries(files)) expect(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'), file).toBe(text);
  });
});
