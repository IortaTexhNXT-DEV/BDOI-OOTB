/**
 * The permissions of the TISPH roles that the front end checks its menu against (brokerverse/src/utils/
 * tisphRolePermissions.json, read by utils/tisphMenus.test.js: no menu entry a role sees needs a permission the role
 * lacks) are those db/seed.js grants. After a change of the grants, write the file again from ROLE_PERMISSIONS.
 */
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../src/db/seed.js';

const FILE = new URL('../../brokerverse/src/utils/tisphRolePermissions.json', import.meta.url);

describe('TISPH role permissions of the front-end menu check', () => {
  it('match the grants of db/seed.js role by role', () => {
    const menu = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const tisRoles = Object.keys(ROLE_PERMISSIONS).filter((role) => role.startsWith('tis-'));
    expect(Object.keys(menu).sort()).toEqual(tisRoles.sort());
    for (const role of tisRoles) expect(menu[role], role).toEqual([...ROLE_PERMISSIONS[role]].sort());
  });
});
