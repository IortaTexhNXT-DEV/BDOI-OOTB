/**
 * Role Permissions: the rules of the screen, without React. The data is GET /access-control/role-access: the access
 * catalogue (areas, modules with their levels, every permission code with its module, level and meaning), the
 * departments, and the roles with their own grants, the grants of the roles they include (code -> included role) and
 * the change waiting for approval.
 *
 * Edits are kept as `staged`: { code: true | false }, the own grants the user wants that differ from the role's
 * (true = to add, false = to remove). A level held through an included role, Basic access and a full-access role are
 * locked.
 */

export const LEVELS = ["view", "edit", "approve", "special"];
export const OTHER_GROUP = "other";
export const PLATFORM_GROUP = "platform";

/** Look-ups over the catalogue: the code of a module's level, a permission, an area, the modules of an area. */
export const indexCatalogue = (catalogue) => {
  const cat = catalogue || { areas: [], modules: [], permissions: [] };
  const byLevel = new Map(cat.permissions.filter((p) => p.checked).map((p) => [`${p.module}|${p.level}`, p]));
  const byCode = new Map(cat.permissions.map((p) => [p.code, p]));
  const modules = cat.modules.filter((m) => m.levels.length);
  return {
    areas: cat.areas.filter((a) => modules.some((m) => m.area === a.code)),
    modules,
    modulesOf: (area) => modules.filter((m) => m.area === area),
    module: (code) => cat.modules.find((m) => m.code === code),
    area: (code) => cat.areas.find((a) => a.code === code),
    code: (module, level) => byLevel.get(`${module}|${level}`)?.code || null,
    permission: (code) => byCode.get(code) || null,
    areaHasSpecial: (area) => modules.some((m) => m.area === area && m.levels.includes("special")),
  };
};

/** Roles of the list and the pickers: TISPH roles only, the base platform roles as well with `base`. */
export const visibleRoles = (roles = [], base = false) => roles.filter((r) => base || !r.platform);

/**
 * Roles by department in the order of the departments (roles in their order), then the roles in no department and,
 * with `base`, the base platform roles. Empty groups are left out.
 */
export const roleGroups = (roles = [], departments = [], { base = false } = {}) => {
  const names = new Set(departments.map((d) => d.name));
  const groups = departments.map((d) => ({ key: d.name, label: d.name, items: roles.filter((r) => !r.platform && r.department === d.name) }));
  groups.push({ key: OTHER_GROUP, label: null, items: roles.filter((r) => !r.platform && !names.has(r.department)) });
  if (base) groups.push({ key: PLATFORM_GROUP, label: null, items: roles.filter((r) => r.platform) });
  return groups.filter((g) => g.items.length);
};

/** The role after `code` in its group (Compare with: the selected role and the next one of its department). */
export const nextInGroup = (groups, code) => {
  const group = groups.find((g) => g.items.some((r) => r.code === code));
  if (!group) return null;
  const others = group.items.filter((r) => r.code !== code);
  const at = group.items.findIndex((r) => r.code === code);
  return (group.items[at + 1] || others[0] || null)?.code || null;
};

/** How a role holds a code: { granted, how: "full" | "own" | "included" | null, via (the included role) }. */
export const holds = (role, code) => {
  if (!role || !code) return { granted: false, how: null, via: null };
  if (role.fullAccess) return { granted: true, how: "full", via: null };
  if (role.own.includes(code)) return { granted: true, how: "own", via: null };
  if (role.included?.[code]) return { granted: true, how: "included", via: role.included[code] };
  return { granted: false, how: null, via: null };
};

/** The waiting change of a role for a code: "added", "removed" or null. */
export const pendingOf = (role, code) => {
  const p = role?.pending?.payload;
  if (!p || !code) return null;
  if ((p.grant || []).includes(code)) return "added";
  if ((p.revoke || []).includes(code)) return "removed";
  return null;
};

/**
 * One level of a module for a role: { code, on, locked, change ("added" | "removed" | null, staged by the user),
 * pending, how, via }. code null: the module has no such level.
 */
export const cellState = (idx, role, staged, module, level) => {
  const code = idx.code(module, level);
  if (!code) return { code: null, on: false, locked: true, change: null, pending: null, how: null, via: null };
  const h = holds(role, code);
  const baseline = !!idx.permission(code)?.baseline;
  const locked = h.how === "full" || h.how === "included" || (baseline && h.granted);
  const change = staged && code in staged ? (staged[code] ? "added" : "removed") : null;
  const on = change ? staged[code] : h.granted;
  return { code, on, locked, change, pending: pendingOf(role, code), how: h.how, via: h.via };
};

const own = (role, code) => role.own.includes(code);

/**
 * Turn one level on or off. Turning on Create and edit or Approve turns on View when the module has it; turning off
 * View turns off the other levels of the module the role holds itself. Returns { staged, implied, dropped }: the codes
 * turned on or off with it.
 */
export const toggleLevel = (idx, role, staged, module, level, on) => {
  const next = { ...staged };
  const isOn = (code) => (code in next ? next[code] : holds(role, code).granted);
  const set = (code, value) => {
    const h = holds(role, code);
    if (!code || h.how === "full" || h.how === "included") return false;
    if (!value && idx.permission(code)?.baseline) return false;
    if (value === own(role, code)) delete next[code];
    else next[code] = value;
    return true;
  };
  const implied = [];
  const dropped = [];
  set(idx.code(module, level), on);
  if (on && (level === "edit" || level === "approve")) {
    const view = idx.code(module, "view");
    if (view && !isOn(view) && set(view, true)) implied.push(view);
  }
  if (!on && level === "view") {
    for (const other of ["edit", "approve"]) {
      const code = idx.code(module, other);
      if (code && isOn(code) && set(code, false)) dropped.push(code);
    }
  }
  return { staged: next, implied, dropped };
};

/** The levels turning View off would also turn off (asked before doing it). */
export const viewDependents = (idx, role, staged, module) => ["edit", "approve"]
  .map((l) => cellState(idx, role, staged, module, l))
  .filter((c) => c.code && c.on && !c.locked);

/** The change to send: { grant, revoke }. */
export const stagedDelta = (staged = {}) => ({
  grant: Object.keys(staged).filter((c) => staged[c]).sort(),
  revoke: Object.keys(staged).filter((c) => !staged[c]).sort(),
});

/** Modules of an area with at least one level the role holds (or will hold with the staged edits). */
export const modulesWithAccess = (idx, role, staged, area) => idx.modulesOf(area)
  .filter((m) => role.fullAccess || m.levels.some((l) => cellState(idx, role, staged, m.code, l).on));

const fold = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Does a module match the search: its area, name, screens and the meaning of its levels (the names as shown, given by
 * `names(module)`), and with technical names its permission codes.
 */
export const moduleMatches = (idx, module, query, { technical = false, names = null } = {}) => {
  const q = fold(query).trim();
  if (!q) return true;
  const codes = module.levels.map((l) => idx.code(module.code, l));
  const text = [idx.area(module.area)?.name, module.name, ...(module.screens || []), ...codes.map((c) => idx.permission(c)?.meaning),
    ...(names ? names(module) : []), ...(technical ? codes : [])];
  return text.some((t) => fold(t).includes(q));
};

/** The levels a role holds in a module: [{ level, how, via, pending }] (full access: every level). */
export const heldLevels = (idx, role, module) => module.levels
  .map((level) => ({ level, code: idx.code(module.code, level) }))
  .map(({ level, code }) => ({ level, code, ...holds(role, code), pending: pendingOf(role, code) }))
  .filter((x) => x.granted || x.pending === "added");

/**
 * Rows of Compare roles: one per module, area by area, with the levels each role holds and whether the roles differ
 * (a level waiting for approval counts as it is today). `diffOnly` keeps the rows where they differ.
 */
export const compareRows = (idx, roles, { diffOnly = false, query = "", technical = false, names = null } = {}) => idx.modules
  .filter((m) => moduleMatches(idx, m, query, { technical, names }))
  .map((m) => {
    const cells = Object.fromEntries(roles.map((r) => [r.code, heldLevels(idx, r, m)]));
    const signature = (r) => cells[r.code].filter((x) => x.granted).map((x) => x.level).join(",");
    const differs = new Set(roles.map(signature)).size > 1;
    return { key: m.code, area: m.area, module: m, cells, differs };
  })
  .filter((row) => !diffOnly || row.differs);

/** Number of levels the staged edits turn on or off. */
export const changeCount = (staged = {}) => Object.keys(staged).length;
