/**
 * Role facts of the TISPH user manual (npm run manual:role-facts [-- --out <dir>]).
 *
 * Reads the delivered configuration of the database in DATABASE_URL (run it on a database freshly migrated and
 * seeded) and the menu of the front end, and writes to docs/TISPH/manual/generated/:
 *   role-facts.json        per TISPH role: department, summary, menu entries with their routes and access level,
 *                          permissions in business words, approvals it gives and receives, approval limits and the
 *                          segregation-of-duties rules that concern it; per screen the roles that open it
 *   roles/<role>.md        the same facts as Markdown, included by the role chapters ({{include:generated/roles/...}})
 *
 * The TISPH roles are those of the departments of access.role_groups, without the roles of the base platform
 * (access.platform_roles) and without the roles that include the administrator (SUPERID). Business words come from
 * the access catalogue (Role Permissions), the menu labels from the side bar (en.json sidebar.*), the access level of
 * a screen from the modules of the catalogue that list it and from the permissions the menu entry requires.
 * test/manual-role-facts.test.js fails when the committed files differ from what this writes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AREAS, LEVEL_NAMES, LEVELS, catalogue } from '../modules/access-control/catalogue.js';
import { roleDirectory } from '../modules/access-control/roles.js';
import { AUTHORITY_STEPS, authorityMatrix, limitWords } from '../modules/access-control/authority.js';
import { listSodRules } from '../modules/access-control/service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..');
const WEB = path.join(REPO, 'brokerverse', 'src');
export const OUT_DIR = path.join(REPO, 'docs', 'TISPH', 'manual', 'generated');

// a role's own permission changes are decided on Access Control, not in the role's module
const CROSS_MODULE_APPROVALS = { 'write:roles': ['approve:access-control'] };
const RANK = { view: 1, edit: 2, approve: 3 };
const ACTION_WORDS = { block: 'Blocked', warn: 'Warning' };

const slug = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] || '');

/** The menu of the front end: the tree, the role grants and the side bar labels. */
export async function loadMenu(web = WEB) {
  const load = (file) => import(pathToFileURL(path.join(web, file)).href);
  const [{ menuList }, { filterMenuForRoles }, { flattenLeaves }] = await Promise.all([
    load('components/SideBar/list.js'), load('utils/menuPermissions.js'), load('components/SideBar/menuTree.js'),
  ]);
  const labels = JSON.parse(fs.readFileSync(path.join(web, 'locales', 'en.json'), 'utf8')).sidebar || {};
  return { menuList, filterMenuForRoles, flattenLeaves, label: (name) => labels[name] || name };
}

/** Permissions of every role with those of the active roles it includes. */
async function effectivePermissions(db) {
  const { rows } = await db.query(`SELECT r.code, r.status, r.inherits, COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS perms
    FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id GROUP BY r.id`);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const out = new Map();
  for (const r of rows) {
    const held = new Set(r.perms);
    const seen = new Set([r.code]);
    const queue = [...(r.inherits || [])];
    while (queue.length) {
      const next = byCode.get(queue.shift());
      if (!next || seen.has(next.code) || next.status !== 'active') continue;
      seen.add(next.code);
      next.perms.forEach((p) => held.add(p));
      queue.push(...(next.inherits || []));
    }
    out.set(r.code, held);
  }
  return out;
}

/** The catalogue modules of a menu entry: those whose screens name it or the nearest group above it, and those of the permissions it requires. */
function screenModules(leaf, cat) {
  const byPermission = (leaf.item.permissions || []).map((code) => cat.permissions.find((p) => p.code === code)?.module).filter(Boolean);
  const names = [leaf.item.name, ...leaf.ancestors.map((a) => a.name).reverse()];
  for (const name of names) {
    const found = cat.modules.filter((m) => m.screens.includes(name)).map((m) => m.code);
    if (found.length) return [...new Set([...found, ...byPermission])];
  }
  if (byPermission.length) return [...new Set(byPermission)];
  return leaf.ancestors[0]?.name === 'Master' ? ['masters'] : [];
}

/** Highest level (view, edit, approve) a set of permissions gives in the modules of a screen; view when the menu alone opens it. */
function accessLevel(modules, held, cat) {
  let best = 'view';
  for (const p of cat.permissions) {
    if (!held.has(p.code) || !modules.includes(p.module) || !RANK[p.level]) continue;
    if (RANK[p.level] > RANK[best]) best = p.level;
  }
  return best;
}

/**
 * The facts of every TISPH role. `menu` is loadMenu(); `db` a pool or client of a migrated and seeded database.
 */
export async function roleFacts(db, menu) {
  const dir = await roleDirectory(db);
  const roles = dir.roles.filter((r) => r.department && !r.platform && !r.fullAccess && r.status === 'active');
  const perms = await effectivePermissions(db);
  const cat = catalogue((await db.query('SELECT code, module, description FROM permissions ORDER BY code')).rows);
  const moduleOf = new Map(cat.modules.map((m) => [m.code, m]));
  const areaOf = new Map(AREAS.map((a) => [a.code, a.name]));
  const matrix = await authorityMatrix(db);
  const approvesByRole = new Map(matrix.roles.map((r) => [r.code, r.approves]));
  const sod = (await listSodRules(db)).filter((s) => s.active);
  const leaves = menu.flattenLeaves(menu.menuList).filter((l) => l.item.path);
  const leafKey = (l) => `${l.item.path}|${[...l.ancestors.map((a) => a.name), l.item.name].join('/')}`;
  const modulesOf = new Map(leaves.map((l) => [leafKey(l), screenModules(l, cat)]));
  const words = (codes) => codes.map((code) => {
    const p = cat.permissions.find((x) => x.code === code);
    return p ? `${moduleOf.get(p.module)?.name || p.module} (${LEVEL_NAMES[p.level].toLowerCase()})` : code;
  }).join(', ');
  const holders = (code) => roles.filter((r) => perms.get(r.code)?.has(code)).map((r) => r.name);
  const typeName = new Map(matrix.rows.map((t) => [t.code, t.name]));
  const limitOf = (type, role) => {
    const t = matrix.rows.find((x) => x.code === type);
    const c = t?.cells?.[role];
    return limitWords(t?.measure, c?.maxAmount, c?.unlimited, !!c?.set);
  };

  const facts = roles.map((role) => {
    const held = perms.get(role.code) || new Set();
    const own = menu.filterMenuForRoles(menu.menuList, [role.code]);
    const menus = menu.flattenLeaves(own).filter((l) => l.item.path).map((l) => {
      const level = accessLevel(modulesOf.get(leafKey(l)) || [], held, cat);
      return { section: l.ancestors.map((a) => menu.label(a.name)).join(' > '), screen: menu.label(l.item.name), path: l.item.path, access: LEVEL_NAMES[level] };
    });

    const permissions = cat.permissions.filter((p) => held.has(p.code) && p.checked)
      .sort((a, b) => moduleOf.get(a.module).order - moduleOf.get(b.module).order || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)).map((p) => ({
      area: areaOf.get(p.area) || 'Other', module: moduleOf.get(p.module)?.name || p.module, level: LEVEL_NAMES[p.level], meaning: p.meaning,
    }));

    const approves = [
      ...cat.permissions.filter((p) => held.has(p.code) && p.level === 'approve' && p.checked).map((p) => ({ what: p.meaning, kind: 'maker-checker' })),
      ...(approvesByRole.get(role.code) || []).map((type) => ({ what: typeName.get(type) || type, kind: 'authority', step: AUTHORITY_STEPS[type]?.step || null,
        limit: limitOf(type, role.code) })),
    ];

    const approvedBy = [];
    for (const p of cat.permissions.filter((x) => held.has(x.code) && x.level === 'edit')) {
      const checkers = [...cat.permissions.filter((x) => x.module === p.module && x.level === 'approve' && x.checked).map((x) => x.code),
        ...(CROSS_MODULE_APPROVALS[p.code] || [])];
      for (const code of checkers) {
        if (approvedBy.some((a) => a.code === code)) continue;
        const checker = cat.permissions.find((x) => x.code === code);
        approvedBy.push({ code, work: moduleOf.get(p.module)?.name || p.module, approval: checker?.meaning || code, approvers: holders(code) });
      }
    }
    for (const [type, step] of Object.entries(AUTHORITY_STEPS)) {
      const maker = step.permissions.filter((code) => !code.startsWith('approve:'));
      if (!maker.every((code) => held.has(code))) continue;
      approvedBy.push({ code: `authority:${type}`, work: step.step, approval: `${typeName.get(type) || type} within the approver's limit`, approvers: roles.filter((r) => approvesByRole.get(r.code)?.includes(type)).map((r) => r.name) });
    }

    const rules = [];
    for (const s of sod) {
      if (s.kind !== 'access' && (s.roleA === role.code || s.roleB === role.code)) {
        const other = s.roleA === role.code ? s.roleBName : s.roleAName;
        rules.push({ rule: s.name, conflict: `${role.name} and ${other} held by the same person`, action: ACTION_WORDS[s.action] || s.action, reason: s.reason || '' });
      } else if (s.kind === 'access') {
        const a = s.accessA.some((c) => held.has(c));
        const b = s.accessB.some((c) => held.has(c));
        if (!a && !b) continue;
        const [mine, other] = a ? [s.accessA, s.accessB] : [s.accessB, s.accessA];
        const conflict = a && b ? `This role itself combines ${words(mine.filter((c) => held.has(c)))} with ${words(other.filter((c) => held.has(c)))}`
          : `${words(mine.filter((c) => held.has(c)))} with ${words(other)} held by the same person`;
        rules.push({ rule: s.name, conflict, action: ACTION_WORDS[s.action] || s.action, reason: s.reason || '' });
      }
    }

    return {
      code: role.code, name: role.name, chapterId: slug(role.name), department: role.department, summary: role.summary || role.description || '',
      menus, permissions, approves, approvedBy: approvedBy.map(({ code, ...rest }) => ({ ...rest, ...(code.startsWith('authority:') ? { kind: 'authority' } : { kind: 'maker-checker' }) })),
      sod: rules,
    };
  });

  const screens = {};
  for (const l of leaves) {
    const open = facts.map((f) => ({ role: f.name, entry: f.menus.find((m) => m.path === l.item.path) })).filter((x) => x.entry);
    if (!open.length) continue;
    screens[l.item.path] = { menu: [...l.ancestors.map((a) => menu.label(a.name)), menu.label(l.item.name)].join(' > '),
      roles: open.map((x) => ({ role: x.role, access: x.entry.access })) };
  }
  const permissionHolders = Object.fromEntries(cat.permissions.filter((p) => p.checked).map((p) => [p.code, holders(p.code)]));

  return {
    departments: dir.departments.map((d) => d.name).filter((d) => facts.some((f) => f.department === d)),
    levels: LEVELS.filter((l) => RANK[l]).map((l) => LEVEL_NAMES[l]),
    withoutLimit: matrix.withoutLimit,
    roles: facts,
    screens,
    permissionHolders,
  };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

/** The Markdown include of one role: menus, access, approvals and segregation of duties, with explicit heading ids. */
export function roleMarkdown(role, { withoutLimit = 'allow' } = {}) {
  const id = role.chapterId;
  const notSet = withoutLimit === 'refuse' ? 'Not set: approval refused until a limit is set' : 'Not set: no amount limit applies';
  const out = [];
  out.push(`## Menus available {#${id}-menus}`, '');
  out.push('The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).', '');
  out.push(table(['Menu', 'Screen', 'Access'], role.menus.map((m) => [m.section || m.screen, m.screen, m.access])), '');

  out.push(`## What you can view, change and approve {#${id}-access}`, '');
  const byModule = new Map();
  for (const p of role.permissions) {
    const key = `${p.area}|${p.module}`;
    if (!byModule.has(key)) byModule.set(key, { area: p.area, module: p.module, rows: [] });
    byModule.get(key).rows.push(p);
  }
  out.push(table(['Area', 'Module', 'Access', 'What it allows'], [...byModule.values()].flatMap((m) => m.rows.map((p) => [m.area, m.module, p.level, p.meaning]))), '');

  out.push(`## Approvals {#${id}-approvals}`, '');
  const approves = role.approves.filter((a) => a.kind === 'maker-checker');
  const authority = role.approves.filter((a) => a.kind === 'authority');
  if (!approves.length && !authority.length) out.push('This role approves nothing.', '');
  if (approves.length) out.push('This role approves the work of other users:', '', ...approves.map((a) => `- ${a.what}`), '');
  if (authority.length) {
    out.push('Approval limits of this role on the Authority Matrix:', '');
    out.push(table(['Transaction', 'Approval step', 'Limit of the role'], authority.map((a) => [a.what, a.step || '', a.limit === 'Not set' ? notSet : a.limit])), '');
  }
  const received = role.approvedBy.filter((a) => a.approvers.length);
  if (received.length) {
    out.push('Who approves the work of this role:', '');
    out.push(table(['Work', 'Approval', 'Approved by'], received.map((a) => [a.work, a.approval, list(a.approvers)])), '');
  }
  out.push('The user who enters a record never approves it: the approval is always another user\'s.', '');

  out.push(`## Segregation of duties {#${id}-sod}`, '');
  if (!role.sod.length) out.push('No delivered segregation-of-duties rule concerns this role.', '');
  else {
    out.push(table(['Rule', 'Conflict', 'When given together', 'Reason'], role.sod.map((s) => [s.rule, s.conflict, s.action, s.reason])), '');
  }
  out.push('These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.', '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** The files the generator writes: { relative path: content }. */
export function renderFiles(facts) {
  const files = { 'role-facts.json': `${JSON.stringify(facts, null, 1)}\n` };
  for (const role of facts.roles) files[`roles/${role.code}.md`] = roleMarkdown(role, { withoutLimit: facts.withoutLimit });
  return files;
}

async function main() {
  const at = process.argv.indexOf('--out');
  const out = at > 0 ? path.resolve(process.argv[at + 1]) : OUT_DIR;
  const { pool } = await import('../db/pool.js');
  try {
    const files = renderFiles(await roleFacts(pool, await loadMenu()));
    fs.rmSync(path.join(out, 'roles'), { recursive: true, force: true });
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
      fs.writeFileSync(path.join(out, file), content);
    }
    console.log(`role facts: ${Object.keys(files).length - 1} roles -> ${path.relative(process.cwd(), out) || out}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
