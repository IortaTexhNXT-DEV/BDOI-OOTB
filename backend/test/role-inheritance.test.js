/**
 * Finance Manager includes Finance: effective roles and permissions at sign-in, notification recipients by role.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, pool } from '../src/db/pool.js';
import { loadUser } from '../src/lib/auth.js';
import { usersWithRoles } from '../src/modules/documents/common.js';
import { setup } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('Finance Manager (role inheritance)', () => {
  it('holds the finance role and permissions plus the period-end approval', async () => {
    const role = (await query("SELECT id, inherits FROM roles WHERE code = 'accounting-manager'")).rows[0];
    expect(role.inherits).toEqual(['accounting']);
    await query(`INSERT INTO users(id, username, display_name, email, status, password_hash) VALUES ('usr_fm_t', 'fm.test', 'FM Test', 'fm.test@example.test', 'active', 'x')
      ON CONFLICT (id) DO NOTHING`);
    await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['usr_fm_t', role.id]);
    const u = await loadUser('u.id = $1', ['usr_fm_t']);
    expect(u.roles).toEqual(expect.arrayContaining(['accounting', 'accounting-manager']));
    expect(u.permissions).toEqual(expect.arrayContaining(['approve:period-end', 'write:receipts', 'read:journal-vouchers']));
    expect((await usersWithRoles(['accounting'])).map((x) => x.id)).toContain('usr_fm_t');
    // the user record shows the role assigned, as the list does; the inherited one is listed apart
    const view = (await ctx.api('get', '/users/usr_fm_t')).body.data;
    expect(view.roles).toEqual(['accounting-manager']);
    expect(view.effectiveRoles).toEqual(expect.arrayContaining(['accounting', 'accounting-manager']));
    const listed = (await ctx.api('get', '/users?search=fm.test')).body.data.find((x) => x.userId === 'usr_fm_t');
    expect(listed.roles).toEqual(view.roles);
  });
  it('a plain finance user does not get the approval', async () => {
    const fin = (await query("SELECT id FROM roles WHERE code = 'accounting'")).rows[0];
    await query(`INSERT INTO users(id, username, display_name, email, status, password_hash) VALUES ('usr_fin_t', 'fin.test', 'Fin Test', 'fin.test@example.test', 'active', 'x')
      ON CONFLICT (id) DO NOTHING`);
    await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['usr_fin_t', fin.id]);
    const u = await loadUser('u.id = $1', ['usr_fin_t']);
    expect(u.roles).toEqual(['accounting']);
    expect(u.permissions).not.toContain('approve:period-end');
  });
});
