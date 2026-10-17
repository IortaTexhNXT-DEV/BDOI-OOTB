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
import { OUT_DIR, effectivePermissions, loadMenu, renderFiles, roleFacts } from '../src/tools/manual-role-facts.js';

let facts;
let files;
let menu;

beforeAll(async () => {
  await setup();
  menu = await loadMenu();
  facts = await roleFacts(pool, menu);
  files = renderFiles(facts);
});
afterAll(async () => {
  await pool.end();
});

describe('TISPH manual role facts', () => {
  it('covers the fourteen roles of the departments, not the base platform roles or SUPERID', () => {
    expect(facts.roles.map((r) => r.code)).toEqual(['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer',
      'tis-ops-unit-head', 'tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-it-admin', 'tis-general-manager', 'tis-auditor']);
    expect(facts.departments).toEqual(['Sales', 'Operations', 'Cash Control', 'Finance and Accounting', 'IT', 'Management', 'Audit']);
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

  it('lists for every role exactly the side menu it is shown', async () => {
    const perms = await effectivePermissions(pool);
    const tree = await import(new URL('../../brokerverse/src/components/SideBar/menuTree.js', import.meta.url).href);
    // as components/SideBar/NewSideBar.jsx draws it: the filtered menu without the tabs, then without the search-only entries
    const drawn = (items) => (items || []).filter((item) => !item.searchOnly).flatMap((item) => (item.submenu ? drawn(item.submenu) : [item.path]));
    for (const role of facts.roles) {
      const shown = drawn(tree.withoutTabs(menu.filterMenuForRoles(menu.menuList, [role.code], [...perms.get(role.code)]))).filter(Boolean);
      expect(role.menus.map((m) => m.path), role.code).toEqual(shown);
    }
    const paths = (code) => facts.roles.find((r) => r.code === code).menus.map((m) => m.path);
    for (const code of ['tis-finance', 'tis-general-manager']) {
      expect(paths(code), code).not.toContain('/accounts/correctionsjv/correctionsjvdetails');
      expect(paths(code), code).not.toContain('/accounts/reversaljv/reversaljvdetails');
      expect(paths(code), code).not.toContain('/accounts/open-entry-unmatching');
      expect(paths(code), code).toContain('/reports/catalogue');
      expect(paths(code).filter((p) => p.startsWith('/reports/operationalreports') || p.startsWith('/reports/financialreports')), code).toEqual([]);
    }
    expect(paths('tis-ops-associate')).not.toContain('/agent/claim/documents');
    expect(paths('tis-ops-associate')).not.toContain('/agent/expired-policies');
    expect(paths('tis-ops-associate')).not.toContain('/agent/payments');
    expect(facts.screens['/agent/payments'].menu).toBe('Accounts > Receipts > Policy Payments to Verify');
    expect(facts.screens['/agent/claim/documents'].menu).toBe('Policy Servicing > Claims > Awaiting Documents');
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
