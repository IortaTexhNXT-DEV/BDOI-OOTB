/*
 * Source collector for build_api_catalogue.py (run by it; prints one JSON document on stdout).
 *
 *   node docs/package/tools/api_catalogue_sources.mjs
 *
 * Back end: every route of the route registry, loaded the same way as `npm run export:api`
 * (backend/src/tools/export-api.js collectRoutes), with folder, label, method, path, summary, access and screen.
 * Front end: the call-site parser of brokerverse/scripts/check-api-calls.js (loaded without running its report,
 * fed with an OpenAPI document built in memory from the same registry, so it never depends on a stale
 * openapi.json), the side menu (src/components/SideBar/list.js), the routes (src/routes/MainRoute.js) and
 * the import graph of every front-end file. For each menu item: its route, component, the import closure of the
 * component (and of the routes in the item's includes list), the call sites found in that closure matched to
 * registry routes, and the master types read through mastersService.
 */
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..');
const BACKEND = path.join(REPO, 'backend');
const FRONT = path.join(REPO, 'brokerverse');

// The registry modules read their configuration on import; keep the process quiet and offline.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const exportApi = await import(pathToFileURL(path.join(BACKEND, 'src', 'tools', 'export-api.js')).href);
const { routes: registry, skipped } = await exportApi.collectRoutes();
const spec = exportApi.buildOpenApi(registry, { baseUrl: 'http://localhost/api', version: 'catalogue' });

/* ---------- load the front-end call-site parser as a library ---------- */
const checker = path.join(FRONT, 'scripts', 'check-api-calls.js');
let source = fs.readFileSync(checker, 'utf8');
const patches = [
  // read the in-memory OpenAPI document instead of backend/docs/api/openapi.json
  ['JSON.parse(fs.readFileSync(OPENAPI, "utf8"))', 'globalThis.__CATALOGUE_SPEC__'],
  // keep the documented (registry) path next to the served path
  ['routes.push({ method: verb, path: p, segments: p.split("/"), used: false });',
    'routes.push({ method: verb, path: p, documented: documented.replace(/\\{([A-Za-z0-9_]+)\\}/g, ":$1"), segments: p.split("/"), used: false });'],
];
for (const [from, to] of patches) {
  if (!source.includes(from)) throw new Error(`check-api-calls.js changed: cannot find ${from}`);
  source = source.replace(from, to);
}
source = source.replace(/\nmain\(\);\s*$/, '\nmodule.exports = { loadRoutes, listFiles, parseFile, findHelpers, collectCalls, matches, FILES, SRC, ROOT };\n');
if (!source.includes('module.exports = { loadRoutes')) throw new Error('check-api-calls.js changed: cannot find the main() call');
globalThis.__CATALOGUE_SPEC__ = spec;
const lib = new Module(checker);
lib.filename = checker;
lib.paths = Module._nodeModulePaths(path.dirname(checker));
lib._compile(source, checker);
const api = lib.exports;
const requireFront = createRequire(checker);
const traverse = requireFront('@babel/traverse').default;

const routes = api.loadRoutes();
const topSegments = new Set(routes.map((r) => r.path.split('/')[1]));
const parseErrors = [];
for (const file of api.listFiles(api.SRC)) {
  try {
    api.FILES.set(file, api.parseFile(file));
  } catch (e) {
    parseErrors.push(`${path.relative(api.ROOT, file)}: ${e.message}`);
  }
}
api.findHelpers();
const sites = api.collectCalls(topSegments);

// Call sites per file and line, each resolved to the registry routes it reaches.
const sitesByFile = new Map();
for (const site of sites) {
  if (site.every((c) => c.unresolved)) continue;
  let hits = site.flatMap((c) => routes.filter((r) => api.matches(r, c)));
  if (!hits.length) hits = site.flatMap((c) => routes.filter((r) => api.matches(r, { ...c, method: undefined })));
  if (!hits.length) continue;
  const file = path.join(api.ROOT, site[0].file);
  if (!sitesByFile.has(file)) sitesByFile.set(file, []);
  sitesByFile.get(file).push({ line: site[0].line, endpoints: [...new Set(hits.map((r) => `${r.method} ${r.documented}`))] });
}

/*
 * Reachability by name. A screen file is used whole. An imported service is used only through the members the
 * reached code names (svc.list(...) reaches the unit "list" of the service file, and what "list" itself refers
 * to); a call site counts when one of the named units around it is reached, or when it sits outside any unit.
 */
const ALL = '*';
const isFn = (n) => n && ['FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const analyses = new Map();
function analyse(file) {
  if (analyses.has(file)) return analyses.get(file);
  const entry = api.FILES.get(file);
  const units = new Map(); // name -> [{ start, end, refs:Set }]
  const reexports = {}; // exported name -> { file, name }
  const topLevel = new Set();
  const all = { refs: new Set() };
  const resolveFile = (from, source) => {
    let target = path.resolve(path.dirname(from), source);
    for (const ext of ['', '.js', '.jsx', '/index.js', '/index.jsx']) {
      if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) return target + ext;
    }
    return target;
  };
  for (const st of entry.ast.program.body) {
    if (st.type === 'ExportNamedDeclaration' && st.source && st.source.value.startsWith('.')) {
      for (const sp of st.specifiers) reexports[sp.exported.name] = { file: resolveFile(file, st.source.value), name: sp.local.name };
    }
    const decl = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(st.type) ? st.declaration : st;
    if (decl && decl.type === 'VariableDeclaration') decl.declarations.forEach((d) => d.id.name && topLevel.add(d.id.name));
    if (decl && decl.id && decl.id.name) topLevel.add(decl.id.name);
  }
  const refOf = (p) => {
    const n = p.node;
    if (p.isIdentifier() || p.isJSXIdentifier()) {
      if (p.isIdentifier() && !p.isReferencedIdentifier()) return undefined;
      const name = n.name;
      const parent = p.parentPath;
      if (entry.imports[name]) {
        if (parent.isMemberExpression() && parent.node.object === n && !parent.node.computed) return `${name}.${parent.node.property.name}`;
      }
      return name;
    }
    if (p.isMemberExpression() && !n.computed && n.property.type === 'Identifier') {
      if (n.object.type === 'ThisExpression') return n.property.name;
      if (n.object.type === 'Identifier' && topLevel.has(n.object.name)) return n.property.name;
    }
    return undefined;
  };
  const collect = (p, set) => {
    p.traverse({
      enter(q) {
        const r = refOf(q);
        if (r) set.add(r);
      },
    });
  };
  traverse(entry.ast, {
    enter(p) {
      const r = refOf(p);
      if (r) all.refs.add(r);
      const n = p.node;
      let name;
      // units: top-level functions and constants, and the methods of objects and classes (a class itself is not
      // a unit, so reaching one method of a service class does not reach the others)
      const statement = p.isVariableDeclarator() ? p.parentPath : p;
      const atTop = statement.parentPath && (statement.parentPath.isProgram()
        || (statement.parentPath.isExportDeclaration() && statement.parentPath.parentPath.isProgram()));
      if (p.isFunctionDeclaration() && n.id && atTop) name = n.id.name;
      else if (p.isVariableDeclarator() && n.id.type === 'Identifier' && atTop) name = n.id.name;
      else if ((p.isObjectMethod() || p.isClassMethod()) && !n.computed) name = n.key.name ?? n.key.value;
      else if ((p.isObjectProperty() || p.isClassProperty()) && !n.computed && isFn(n.value)) name = n.key.name ?? n.key.value;
      if (!name || !n.loc) return;
      const unit = { start: n.loc.start.line, end: n.loc.end.line, refs: new Set() };
      collect(p, unit.refs);
      if (!units.has(name)) units.set(name, []);
      units.get(name).push(unit);
    },
  });
  const a = { entry, units, reexports, all };
  analyses.set(file, a);
  return a;
}

/** Files reached from the given screen files, each with the set of reached unit names (or ALL). */
function reach(startFiles) {
  const state = new Map(); // file -> Set(names) | ALL
  const queue = [];
  const add = (file, names) => {
    if (!api.FILES.has(file)) return;
    const cur = state.get(file);
    if (cur === ALL) return;
    if (names === ALL) {
      state.set(file, ALL);
      queue.push(file);
      return;
    }
    const a = analyse(file);
    const set = cur || new Set();
    let grew = !cur;
    for (const n of names) {
      if (a.reexports[n]) { add(a.reexports[n].file, new Set([a.reexports[n].name])); continue; }
      if (!set.has(n)) { set.add(n); grew = true; }
    }
    state.set(file, set);
    if (grew) queue.push(file);
  };
  startFiles.filter(Boolean).forEach((f) => add(f, ALL));
  while (queue.length) {
    const file = queue.shift();
    const a = analyse(file);
    const cur = state.get(file);
    let refs;
    if (cur === ALL) refs = a.all.refs;
    else {
      // close the reached names over the units they refer to inside this file
      const seen = new Set();
      const todo = [...cur];
      refs = new Set();
      while (todo.length) {
        const n = todo.pop();
        if (seen.has(n)) continue;
        seen.add(n);
        for (const u of a.units.get(n) || []) {
          for (const r of u.refs) {
            refs.add(r);
            const local = r.split('.')[0];
            if (!r.includes('.') && a.units.has(local) && !seen.has(local)) todo.push(local);
          }
        }
      }
      seen.forEach((n) => cur.add(n));
    }
    // follow the imports the reached code uses
    const byTarget = new Map();
    for (const r of refs) {
      const [local, member] = r.split('.');
      const imp = a.entry.imports[local];
      if (!imp || !api.FILES.has(imp.file)) continue;
      const other = analyse(imp.file);
      let names;
      if (member) names = new Set([member]);
      else {
        const localName = other.entry.exports[imp.name];
        if (other.reexports[imp.name]) names = new Set([imp.name]);
        else names = localName ? new Set([localName]) : ALL;
      }
      const prev = byTarget.get(imp.file);
      if (prev === ALL || names === ALL) byTarget.set(imp.file, ALL);
      else byTarget.set(imp.file, new Set([...(prev || []), ...names]));
    }
    for (const [f, names] of byTarget) add(f, names);
  }
  return state;
}

function endpointsOf(state) {
  const endpoints = new Set();
  const serviceFiles = new Set();
  for (const [file, names] of state) {
    const list = sitesByFile.get(file);
    if (!list) continue;
    const a = analyse(file);
    for (const site of list) {
      let ok = names === ALL;
      if (!ok) {
        const owners = [...a.units].filter(([, us]) => us.some((u) => u.start <= site.line && site.line <= u.end)).map(([n]) => n);
        ok = owners.length === 0 || owners.some((n) => names.has(n));
      }
      if (!ok) continue;
      site.endpoints.forEach((e) => endpoints.add(e));
      if (/Service\.jsx?$/.test(file)) serviceFiles.add(path.basename(file));
    }
  }
  return { endpoints, serviceFiles };
}

/* ---------- menu and routes ---------- */
const rel = (f) => path.relative(FRONT, f).split(path.sep).join('/');
const valueOf = (node) => {
  if (!node) return undefined;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  if (node.type === 'NumericLiteral') return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(valueOf);
  if (node.type === 'ObjectExpression') {
    const out = {};
    for (const p of node.properties) {
      if (p.type !== 'ObjectProperty') continue;
      const key = p.key.name ?? p.key.value;
      if (key === 'icon') continue;
      out[key] = valueOf(p.value);
    }
    return out;
  }
  return undefined;
};

const listFile = path.join(FRONT, 'src', 'components', 'SideBar', 'list.js');
const listEntry = api.FILES.get(listFile);
let menuList = [];
for (const st of listEntry.ast.program.body) {
  const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (decl && decl.type === 'VariableDeclaration') {
    const d = decl.declarations.find((x) => x.id.name === 'menuList');
    if (d) menuList = valueOf(d.init);
  }
}
const menuItems = [];
const walk = (items, trail) => {
  for (const item of items || []) {
    const menuPath = [...trail, item.name];
    if (item.path) menuItems.push({ menu: menuPath.join(' > '), name: item.name, path: item.path, includes: item.includes || [] });
    if (item.submenu) walk(item.submenu, menuPath);
  }
};
walk(menuList, []);

const routeFile = path.join(FRONT, 'src', 'routes', 'MainRoute.js');
const routeEntry = api.FILES.get(routeFile);
const appRoutes = [];
const norm = (p) => (`/${String(p || '').replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/');
traverse(routeEntry.ast, {
  JSXElement(p) {
    const opening = p.node.openingElement;
    if (opening.name.name !== 'Route') return;
    const attr = (n) => opening.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === n);
    const pathAttr = attr('path');
    const element = attr('element');
    const index = !!attr('index');
    if (!element || (!pathAttr && !index)) return;
    // parent route paths (nested <Route path=...>)
    const parents = [];
    for (let up = p.parentPath; up; up = up.parentPath) {
      if (up.isJSXElement() && up.node.openingElement.name.name === 'Route') {
        const pa = up.node.openingElement.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'path');
        if (pa) parents.unshift(valueOf(pa.value));
      }
    }
    const own = pathAttr ? valueOf(pathAttr.value) : '';
    const full = own && own.startsWith('/') ? own : [...parents, own].filter(Boolean).join('/');
    const expr = element.value.expression;
    if (!expr || expr.type !== 'JSXElement') return;
    const component = expr.openingElement.name.name;
    if (!component || component === 'Navigate') return;
    const imported = routeEntry.imports[component];
    let file = imported ? imported.file : undefined;
    // follow a re-export (export { default as RiskMappingList } from "./RiskMappingList")
    if (file && api.FILES.has(file)) {
      const re = analyse(file).reexports[imported.name];
      if (re) file = re.file;
    }
    appRoutes.push({ path: norm(full), component, file });
  },
});

const routesFor = (include) => {
  const raw = String(include);
  const n = norm(raw);
  const exact = appRoutes.filter((r) => r.path.toLowerCase() === n.toLowerCase());
  if (exact.length) return exact;
  // a route with parameters (/accounts/tax/reports/:code serves /accounts/tax/reports/bir-sawt)
  const segs = n.toLowerCase().split('/');
  const param = appRoutes.filter((r) => {
    const rs = r.path.toLowerCase().split('/');
    return rs.length === segs.length && rs.every((x, i) => x === segs[i] || (x.startsWith(':') && segs[i]));
  });
  if (param.length || !raw.endsWith('/')) return param;
  return appRoutes.filter((r) => r.path.toLowerCase().startsWith(`${n.toLowerCase()}/`));
};

const MASTER_CALL = /mastersService\s*\.\s*\w+\(\s*["'`]([a-z][a-z0-9-]*)["'`]/g;
const screens = menuItems.map((item) => {
  const own = routesFor(item.path)[0];
  const extra = item.includes.flatMap(routesFor);
  const state = reach([own && own.file, ...extra.map((r) => r.file)]);
  const { endpoints, serviceFiles } = endpointsOf(state);
  const masters = new Set();
  for (const f of state.keys()) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(MASTER_CALL)) masters.add(m[1]);
  }
  return {
    menu: item.menu, name: item.name, route: item.path,
    component: own ? own.component : null, file: own && own.file ? rel(own.file) : null,
    closureFiles: state.size, serviceFiles: [...serviceFiles].sort(), endpoints: [...endpoints], masters: [...masters].sort(),
  };
});

const out = {
  skipped,
  parseErrors,
  registry: registry.map((r) => ({ folder: r.folder, module: r.module, method: r.method, path: r.path, summary: r.summary,
    auth: r.auth, roles: r.roles, permissions: r.permissions, screen: r.screen })),
  screens,
  appRoutes: appRoutes.length,
  callSites: sites.length,
};
// exit once the output is flushed (open database pools and timers of the loaded modules would keep node running)
process.stdout.write(JSON.stringify(out), () => process.exit(0));
