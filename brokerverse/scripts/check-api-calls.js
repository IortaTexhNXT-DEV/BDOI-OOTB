/*
 * Compares the API calls made by the front end with the routes the backend publishes.
 *
 *   node scripts/check-api-calls.js            report calls to routes that do not exist
 *   node scripts/check-api-calls.js --strict   same, and exit with code 1 when there are any
 *   node scripts/check-api-calls.js --unused   also list backend routes that no screen calls
 *   node scripts/check-api-calls.js --calls    also list every call site that was found
 *
 * Backend routes come from backend/docs/api/openapi.json (regenerate it with `npm run export:api`
 * in backend/). Front-end calls are found by parsing every file under src:
 *   - fetch(url, { method }) and the shared axios client (getRequest/postRequest/... in
 *     utility/commonServices, request.get/post/... on utility/interceptor);
 *   - the small request helpers the services wrap around them (for example
 *     `call("GET", "security-policy")` in reinsuranceService adds `/reinsurance/`); a helper is
 *     recognised when it passes one of its own parameters into the URL of one of the calls above;
 *   - any other template literal that starts with `${BASE_URL}` (window.open, download links).
 * `${BASE_URL}` and constants are resolved; any other `${...}` inside a path counts as a path
 * parameter, and a trailing `${...}` that is not a whole segment is taken as a query string.
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const BACKEND = path.join(ROOT, "..", "backend");
const OPENAPI = path.join(BACKEND, "docs", "api", "openapi.json");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const SHOW_UNUSED = args.includes("--unused");
const SHOW_CALLS = args.includes("--calls");

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARAM = ":param";
const BASE = "\u0000"; // stands for BASE_URL while a URL is being evaluated
const UNKNOWN = "\u0001"; // a value only known at run time
const ARG = (i) => `\u0002${i}\u0003`; // parameter i of the helper being analysed
const MAX_VARIANTS = 8;

/* ---------- backend routes ---------- */

const braces = (p) => p.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
const trimSlash = (p) => (p.length > 1 ? p.replace(/\/$/, "") : p) || "/";

/** `define({ method: 'GET', path: '/x' ...` blocks with a literal path; `owner` is the router variable ("" = define). */
function literalDefines(source, owner) {
  const call = owner ? `${owner}.define(` : "define(";
  const found = [];
  for (let at = source.indexOf(call); at >= 0; at = source.indexOf(call, at + 1)) {
    if (!owner && /[\w.]/.test(source[at - 1] || "")) continue;
    const block = source.slice(at, at + 400);
    const method = (block.match(/method: '([A-Z]+)'/) || [])[1];
    const p = (block.match(/path: '([^']*)'/) || [])[1];
    if (method && p !== undefined) found.push({ method, path: p });
  }
  return found;
}

/**
 * openapi.json lists the routes of a module's secondary routers (extraMounts in the module's
 * router.js) under the module's own mount, e.g. /quotations/email/send, although Express serves
 * them at /email/send. Read the mounts from the backend source so the served path is checked.
 * Returns { exact: Map("METHOD documented" -> served), prefixes: [{ from, to, keep:Set }] }.
 */
function subRouterMounts() {
  const modules = path.join(BACKEND, "src", "modules");
  const exact = new Map();
  const prefixes = [];
  const tagMounts = {};
  if (!fs.existsSync(modules)) return { exact, prefixes, tagMounts };
  for (const name of fs.readdirSync(modules)) {
    const file = path.join(modules, name, "router.js");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const mount = (text.match(/export const mount = '([^']+)'/) || [])[1] || "";
    const main = text.match(/const \{ router, define \} = moduleRouter\('([^']*)', '([^']*)'\)/);
    if (main && mount && main[2] === mount) tagMounts[main[1]] = mount;
    const extra = (text.match(/export const extraMounts = \[(.*)\];/) || [])[1];
    if (!extra) continue;
    const documentedPath = (registered) => trimSlash(mount && !registered.startsWith(mount) ? mount + registered : registered);
    // Routes of the module's main router keep their documented path.
    const mainPrefix = (text.match(/const \{ router, define \} = moduleRouter\('[^']*', '([^']*)'\)/) || [])[1] || "";
    const keep = new Set(literalDefines(text, "").map((r) => `${r.method} ${braces(documentedPath(mainPrefix + r.path))}`));
    for (const [, prefix, variable] of extra.matchAll(/\['([^']*)',\s*([A-Za-z_$][\w$.]*)\]/g)) {
      // The sub-router is either `x.router` built in this file or the default export of another file.
      let source = text;
      let owner = variable.split(".")[0];
      if (!variable.includes(".")) {
        const from = (text.match(new RegExp(`import ${owner} from '\\./([^']+)'`)) || [])[1];
        if (!from) continue;
        source = fs.readFileSync(path.join(modules, name, from), "utf8");
        owner = "";
      }
      const declared = owner
        ? source.match(new RegExp(`const ${owner} = moduleRouter\\('[^']*', '([^']*)'\\)`))
        : source.match(/moduleRouter\('[^']*', '([^']*)'\)/);
      const registryPrefix = declared ? declared[1] : "";
      const servedPrefix = prefix === "/" ? "" : prefix;
      for (const r of literalDefines(source, owner)) {
        exact.set(`${r.method} ${braces(documentedPath(registryPrefix + r.path))}`, braces(trimSlash(servedPrefix + r.path)));
      }
      // Paths built in loops (path: `/${kind}/:id`) are mapped by their prefix.
      if (registryPrefix) prefixes.push({ from: documentedPath(registryPrefix), to: servedPrefix, keep });
    }
  }
  return { exact, prefixes, tagMounts };
}

function loadRoutes() {
  const spec = JSON.parse(fs.readFileSync(OPENAPI, "utf8"));
  const { exact, prefixes, tagMounts } = subRouterMounts();
  const served = (method, documented, tag) => {
    const key = `${method} ${documented}`;
    if (exact.has(key)) return exact.get(key);
    const rule = prefixes.find((r) => !r.keep.has(key) && (documented === r.from || documented.startsWith(`${r.from}/`)));
    if (rule) return trimSlash(rule.to + documented.slice(rule.from.length));
    // A module imported by another module's router is documented under that module's mount
    // (e.g. /accounting/notifications for /notifications): use the tag's own mount.
    const own = tagMounts[tag];
    if (own && !documented.startsWith(own)) {
      const at = documented.indexOf(`${own}/`) >= 0 ? documented.indexOf(`${own}/`) : documented.endsWith(own) ? documented.length - own.length : -1;
      if (at > 0) return documented.slice(at);
    }
    return documented;
  };
  const routes = [];
  for (const [documented, ops] of Object.entries(spec.paths)) {
    for (const method of Object.keys(ops)) {
      const verb = method.toUpperCase();
      if (!METHODS.includes(verb)) continue;
      const p = served(verb, documented, (ops[method].tags || [])[0]);
      routes.push({ method: verb, path: p, segments: p.split("/"), used: false });
    }
  }
  return routes;
}

/* ---------- parsing the front end ---------- */

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") out.push(...listFiles(full));
    } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const AXIOS_METHODS = { get: "GET", post: "POST", put: "PUT", patch: "PATCH", delete: "DELETE" };
const SHARED_CLIENT = { getRequest: "GET", postRequest: "POST", putRequest: "PUT", patchRequest: "PATCH", deleteRequest: "DELETE" };

const stringValue = (node) => {
  if (!node) return undefined;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
};

/** Initialiser of a top-level `const name = ...` (exported or not) in a parsed file. */
function topLevelConstant(entry, name) {
  if (!entry) return undefined;
  for (const statement of entry.ast.program.body) {
    const decl = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (!decl || decl.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    const found = decl.declarations.find((d) => d.id.type === "Identifier" && d.id.name === name);
    if (found) return found.init;
  }
  return undefined;
}

/** Initialiser of an imported constant of the file being analysed. */
function importedConstant(localName) {
  const entry = FILES.get(currentFile);
  const imported = entry && entry.imports[localName];
  if (!imported) return undefined;
  const other = FILES.get(imported.file);
  const exported = other && other.exports[imported.name];
  return exported ? topLevelConstant(other, exported) : undefined;
}

/** Node reached by `ROOT.A.B` when ROOT is a constant object literal (local or imported). */
function constantMember(node, scope) {
  const keys = [];
  let current = node;
  while (current.type === "MemberExpression") {
    if (current.computed ? current.property.type !== "StringLiteral" : current.property.type !== "Identifier") return undefined;
    keys.unshift(current.computed ? current.property.value : current.property.name);
    current = current.object;
  }
  if (current.type !== "Identifier") return undefined;
  const binding = scope.getBinding(current.name);
  let target;
  if (binding && binding.kind === "module") target = importedConstant(current.name);
  else if (binding && binding.path.isVariableDeclarator() && binding.constantViolations.length === 0) target = binding.path.node.init;
  for (const key of keys) {
    if (!target || target.type !== "ObjectExpression") return undefined;
    const prop = target.properties.find((q) => q.type === "ObjectProperty" && (q.key.name === key || q.key.value === key));
    target = prop && prop.value;
  }
  return target;
}

const cartesian = (parts) =>
  parts.reduce((acc, options) => acc.flatMap((a) => options.map((o) => a + o)).slice(0, MAX_VARIANTS), [""]);

/**
 * Evaluates an expression to the possible URL strings. `helper` is the function whose parameters
 * become ARG markers (when looking for request helpers); `seen` stops cycles.
 */
function evaluate(p, helper, seen = new Set()) {
  const node = p.node;
  if (!node) return [UNKNOWN];
  switch (node.type) {
    case "StringLiteral":
      return [node.value];
    case "TemplateLiteral": {
      const parts = [];
      p.get("quasis").forEach((q, i) => {
        parts.push([q.node.value.cooked]);
        if (i < node.expressions.length) parts.push(evaluate(p.get(`expressions.${i}`), helper, seen));
      });
      return cartesian(parts);
    }
    case "BinaryExpression":
      if (node.operator !== "+") return [UNKNOWN];
      return cartesian([evaluate(p.get("left"), helper, seen), evaluate(p.get("right"), helper, seen)]);
    case "ConditionalExpression":
      return [...evaluate(p.get("consequent"), helper, seen), ...evaluate(p.get("alternate"), helper, seen)].slice(0, MAX_VARIANTS);
    case "LogicalExpression":
      return evaluate(p.get("left"), helper, seen);
    case "CallExpression": {
      // A local one-line path builder: const base = (id) => `/claims/${id}/settlement-cash`;
      if (node.callee.type !== "Identifier") return [UNKNOWN];
      const binding = p.scope.getBinding(node.callee.name);
      if (!binding || seen.has(binding) || !binding.path.isVariableDeclarator()) return [UNKNOWN];
      const init = binding.path.get("init");
      if (!init.isArrowFunctionExpression() || init.get("body").isBlockStatement()) return [UNKNOWN];
      return evaluate(init.get("body"), undefined, new Set([...seen, binding]));
    }
    case "Identifier": {
      if (node.name === "BASE_URL") return [BASE];
      const binding = p.scope.getBinding(node.name);
      if (!binding || seen.has(binding)) return [UNKNOWN];
      if (binding.kind === "param") {
        if (helper && binding.scope.block === helper.node) {
          const index = helper.node.params.indexOf(binding.path.node);
          if (index >= 0) return [ARG(index)];
          // a destructured or defaulted parameter
          const top = helper.node.params.findIndex((param) => param === binding.path.node || (param.type === "AssignmentPattern" && param.left === binding.identifier));
          if (top >= 0) return [ARG(top)];
        }
        return [UNKNOWN];
      }
      if (binding.path.isVariableDeclarator() && binding.path.node.init && binding.constantViolations.length === 0) {
        return evaluate(binding.path.get("init"), helper, new Set([...seen, binding]));
      }
      if (binding.kind === "module") {
        const value = stringValue(importedConstant(node.name));
        if (value !== undefined) return [value];
      }
      return [UNKNOWN];
    }
    case "MemberExpression": {
      // this.baseURL = `${BASE_URL}/email` in a service class constructor
      if (node.object.type === "ThisExpression" && !node.computed) {
        const value = thisValues[node.property.name];
        return value !== undefined ? [value] : [UNKNOWN];
      }
      // A route table: APIROUTES.JOURNALVOUCHER.GET_JOURNAL_VOUCHER_HISTORY
      const value = stringValue(constantMember(node, p.scope));
      return value !== undefined ? [value] : [UNKNOWN];
    }
    default:
      return [UNKNOWN];
  }
}

/** Name used to call a function node: `foo`, `this.foo` for class and object methods. */
function functionName(p) {
  const node = p.node;
  if ((p.isFunctionDeclaration() || p.isFunctionExpression()) && node.id) return node.id.name;
  if (p.isClassMethod() || p.isObjectMethod()) return node.key.name ? `this.${node.key.name}` : undefined;
  if ((p.isArrowFunctionExpression() || p.isFunctionExpression()) && p.parentPath.isVariableDeclarator()) return p.parent.id.name;
  return undefined;
}

/** How a call reaches the network: which argument is the path, what method, and the prefix added. */
function resolveTarget(callPath, file) {
  const callee = callPath.node.callee;
  if (callee.type === "Identifier") {
    if (callee.name === "fetch") return { kind: "fetch", pathIndex: 0, prefix: "" };
    if (SHARED_CLIENT[callee.name]) return { kind: "axios", pathIndex: 0, prefix: BASE, method: SHARED_CLIENT[callee.name] };
    const local = file.helpers[callee.name];
    if (local) return local;
    const imported = file.imports[callee.name];
    if (imported) {
      const other = FILES.get(imported.file);
      const local = other && other.exports[imported.name];
      const helper = local && other.helpers[local];
      if (helper) return helper;
    }
    return undefined;
  }
  if (callee.type === "MemberExpression" && !callee.computed) {
    const method = AXIOS_METHODS[callee.property.name];
    if (callee.object.type === "ThisExpression") return file.helpers[`this.${callee.property.name}`];
    // XMLHttpRequest uploads: xhr.open("POST", url)
    const verb = stringValue(callPath.node.arguments[0]);
    if (callee.property.name === "open" && verb && METHODS.includes(verb.toUpperCase())) {
      return { kind: "xhr", pathIndex: 1, prefix: "", method: verb.toUpperCase() };
    }
    if (method && callee.object.type === "Identifier" && /^(request|api|client|axios|http|instance)$/i.test(callee.object.name)) {
      return { kind: "axios", pathIndex: 0, prefix: callee.object.name === "axios" ? "" : BASE, method };
    }
  }
  return undefined;
}

/** Method of a fetch call from its options argument, given the helper whose parameters are ARG markers. */
function fetchMethod(callPath, helper) {
  const options = callPath.get("arguments.1");
  if (!options || !options.node) return { method: "GET" };
  if (options.isObjectExpression()) {
    const prop = options.get("properties").find((q) => q.isObjectProperty() && (q.node.key.name === "method" || q.node.key.value === "method"));
    if (prop) {
      // (path, { method = "GET", body } = {}) => fetch(url, { method, ... })
      const destructured = helper && optionsParamIndex(helper, prop.get("value"));
      if (destructured !== undefined) return { optionsIndex: destructured, methodDefault: defaultOf(helper, prop.node.value) || "GET" };
      const value = evaluate(prop.get("value"), helper)[0];
      if (METHODS.includes(String(value).toUpperCase())) return { method: value.toUpperCase() };
      const arg = /^\u0002(\d+)\u0003$/.exec(value || "");
      if (arg) return { methodIndex: Number(arg[1]), methodDefault: defaultOf(helper, prop.node.value) };
      return {};
    }
    const spread = options.get("properties").find((q) => q.isSpreadElement());
    if (spread && helper) {
      const value = evaluate(spread.get("argument"), helper)[0];
      const arg = /^\u0002(\d+)\u0003$/.exec(value || "");
      if (arg) return { optionsIndex: Number(arg[1]), methodDefault: "GET" };
      return {};
    }
    return { method: "GET" };
  }
  const value = evaluate(options, helper)[0];
  const arg = /^\u0002(\d+)\u0003$/.exec(value || "");
  if (arg) return { optionsIndex: Number(arg[1]), methodDefault: "GET" };
  return {};
}

/** Index of the helper parameter an identifier was destructured from ({ method } = {}), or undefined. */
function optionsParamIndex(helper, idPath) {
  if (!idPath.isIdentifier()) return undefined;
  const binding = idPath.scope.getBinding(idPath.node.name);
  if (!binding || binding.kind !== "param" || binding.scope.block !== helper.node) return undefined;
  const at = binding.identifier.start;
  const index = helper.node.params.findIndex((param) => {
    const pattern = param.type === "AssignmentPattern" ? param.left : param;
    return pattern.type === "ObjectPattern" && pattern.start <= at && at <= pattern.end;
  });
  return index >= 0 ? index : undefined;
}

/** Default of `method` when a helper destructures it: async (path, { method = "GET" } = {}). */
function defaultOf(helper, identifier) {
  if (!helper || !identifier || identifier.type !== "Identifier") return undefined;
  for (const param of helper.node.params) {
    const pattern = param.type === "AssignmentPattern" ? param.left : param;
    if (pattern.type !== "ObjectPattern") continue;
    for (const prop of pattern.properties) {
      if (prop.type === "ObjectProperty" && prop.value.type === "AssignmentPattern" && prop.value.left.name === identifier.name) {
        return prop.value.right.type === "StringLiteral" ? prop.value.right.value.toUpperCase() : undefined;
      }
    }
  }
  return undefined;
}

/** Method used by one call of `target`, given the call's arguments. */
function callMethod(target, callPath, helper) {
  if (target.kind === "fetch") return fetchMethod(callPath, helper);
  if (target.method) return { method: target.method };
  if (target.methodIndex !== undefined) {
    const argPath = callPath.get(`arguments.${target.methodIndex}`);
    if (!argPath || !argPath.node) return target.methodDefault ? { method: target.methodDefault } : {};
    const value = evaluate(argPath, helper)[0];
    if (METHODS.includes(String(value).toUpperCase())) return { method: value.toUpperCase() };
    const arg = /^\u0002(\d+)\u0003$/.exec(value || "");
    return arg ? { methodIndex: Number(arg[1]), methodDefault: target.methodDefault } : {};
  }
  if (target.optionsIndex !== undefined) {
    const argPath = callPath.get(`arguments.${target.optionsIndex}`);
    if (!argPath || !argPath.node) return { method: target.methodDefault };
    if (argPath.isObjectExpression()) {
      const prop = argPath.get("properties").find((q) => q.isObjectProperty() && q.node.key.name === "method");
      if (!prop) return { method: target.methodDefault };
      const value = evaluate(prop.get("value"), helper)[0];
      if (METHODS.includes(String(value).toUpperCase())) return { method: value.toUpperCase() };
      return {};
    }
    const value = evaluate(argPath, helper)[0];
    const arg = /^\u0002(\d+)\u0003$/.exec(value || "");
    return arg ? { optionsIndex: Number(arg[1]), methodDefault: target.methodDefault } : {};
  }
  return {};
}

const FILES = new Map();
let thisValues = {}; // this.<name> URL values of the file being analysed
let currentFile = "";

function parseFile(file) {
  const code = fs.readFileSync(file, "utf8");
  const ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "classProperties", "optionalChaining"] });
  // exports: exported name -> local name
  const entry = { file, ast, helpers: {}, exports: {}, imports: {}, thisValues: {}, functions: [], calls: [] };
  thisValues = entry.thisValues;
    currentFile = entry.file;
  traverse(ast, {
    ImportDeclaration(p) {
      const source = p.node.source.value;
      if (!source.startsWith(".")) return;
      let target = path.resolve(path.dirname(file), source);
      for (const ext of ["", ".js", ".jsx", "/index.js", "/index.jsx"]) {
        if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) {
          target += ext;
          break;
        }
      }
      for (const s of p.node.specifiers) {
        const name = s.type === "ImportSpecifier" ? s.imported.name : "default";
        entry.imports[s.local.name] = { file: target, name };
      }
    },
    ExportNamedDeclaration(p) {
      const decl = p.node.declaration;
      if (decl && decl.type === "VariableDeclaration") decl.declarations.forEach((d) => { entry.exports[d.id.name] = d.id.name; });
      else if (decl && decl.id) entry.exports[decl.id.name] = decl.id.name;
      p.node.specifiers.forEach((s) => { entry.exports[s.exported.name] = s.local.name; });
    },
    ExportDefaultDeclaration(p) {
      const decl = p.node.declaration;
      if (decl.type === "Identifier") entry.exports.default = decl.name;
      else if (decl.id) entry.exports.default = decl.id.name;
    },
    Function(p) {
      const name = functionName(p);
      if (name) entry.functions.push({ name, path: p });
    },
    CallExpression(p) {
      entry.calls.push(p);
    },
    AssignmentExpression(p) {
      const left = p.node.left;
      if (left.type === "MemberExpression" && left.object.type === "ThisExpression" && !left.computed) {
        const values = evaluate(p.get("right"));
        if (values.length === 1 && !values[0].includes(UNKNOWN) && values[0].startsWith(BASE)) entry.thisValues[left.property.name] = values[0];
      }
    },
  });
  return entry;
}

/** Finds the request helpers of every file, repeating until no new helper appears (helpers call helpers). */
function findHelpers() {
  let changed = true;
  let rounds = 0;
  while (changed && rounds < 10) {
    changed = false;
    rounds += 1;
    for (const entry of FILES.values()) {
      thisValues = entry.thisValues;
    currentFile = entry.file;
      for (const fn of entry.functions) {
        if (entry.helpers[fn.name]) continue;
        const helper = fn.path;
        let found;
        helper.traverse({
          CallExpression(callPath) {
            if (found) return;
            const target = resolveTarget(callPath, entry);
            if (!target) return;
            const argPath = callPath.get(`arguments.${target.pathIndex}`);
            if (!argPath || !argPath.node) return;
            const value = evaluate(argPath, helper)[0];
            const m = /^([^\u0002]*)\u0002(\d+)\u0003(.*)$/.exec(value || "");
            if (!m || m[1].includes(UNKNOWN) || !/^(\u0001)?$/.test(m[3].replace(/^\?.*/, ""))) return;
            const prefix = (target.prefix || "") + m[1];
            found = { kind: "helper", pathIndex: Number(m[2]), prefix, ...callMethod(target, callPath, helper) };
          },
        });
        if (found) {
          entry.helpers[fn.name] = found;
          changed = true;
        }
      }
    }
  }
}

/** Every network call site outside the helpers themselves. */
function collectCalls(topSegments) {
  const calls = [];
  for (const entry of FILES.values()) {
    thisValues = entry.thisValues;
    currentFile = entry.file;
    const rel = path.relative(ROOT, entry.file);
    const consumed = new Set();
    for (const callPath of entry.calls) {
      const target = resolveTarget(callPath, entry);
      if (!target) continue;
      const argPath = callPath.get(`arguments.${target.pathIndex}`);
      if (!argPath || !argPath.node) continue;
      argPath.traverse({ TemplateLiteral(t) { consumed.add(t.node); } });
      consumed.add(argPath.node);
      // Inside a helper the path is one of the helper's own parameters: not a call site.
      const fn = callPath.getFunctionParent();
      const inHelper = fn && entry.helpers[functionName(fn)] && entry.functions.some((f) => f.path === fn);
      const raw = evaluate(argPath, inHelper ? fn : undefined);
      if (inHelper && raw.some((v) => v.includes("\u0002"))) continue;
      const method = callMethod(target, callPath).method;
      addSite(calls, raw.map((value) => toCall((target.prefix || "") + value, method, rel, callPath.node.loc.start.line, topSegments)));
    }
    // Any other `${BASE_URL}/...` literal: download links, window.open, URLs built before the call.
    traverse(entry.ast, {
      TemplateLiteral(t) {
        if (consumed.has(t.node) || t.parentPath.isTemplateLiteral()) return;
        // Variables and this.baseURL are resolved where they are used.
        if (t.parentPath.isVariableDeclarator() || t.parentPath.isAssignmentExpression()) return;
        const values = evaluate(t);
        addSite(calls, values.filter((v) => v.startsWith(BASE)).map((v) => toCall(v, undefined, rel, t.node.loc.start.line, topSegments)));
      },
    });
  }
  return calls;
}

/** One call site with the URL variants it can produce (a ternary gives two). */
function addSite(sites, variants) {
  const seen = new Set();
  const unique = variants.filter((c) => c && !seen.has(c.method + c.path) && seen.add(c.method + c.path));
  if (unique.length) sites.push(unique);
}

function toCall(full, method, file, line, topSegments) {
  if (full.includes("\u0002")) return undefined;
  const hasBase = full.startsWith(BASE);
  let text = full.split(BASE).join("");
  text = text.split("?")[0].replace(/([^/])\u0001$/, "$1");
  if (/^(https?:)?\/\//.test(text) || /\s/.test(text)) return undefined;
  if (!text.startsWith("/")) text = `/${text}`;
  const first = text.split("/")[1];
  if (first && first.includes(UNKNOWN)) return { method, path: "(built at run time)", unresolved: true, file, line };
  if (!first || (!hasBase && !topSegments.has(first))) return undefined;
  const dynamic = text.includes(UNKNOWN);
  const shown = text.replace(/[^/]*\u0001[^/]*/g, PARAM).replace(/\/+$/, "") || "/";
  return { method, path: shown, dynamic, file, line };
}

/* ---------- compare ---------- */

/** Segment by segment: a route parameter ({id}) or a run-time value in the call matches any one segment. */
function matches(route, call) {
  if (call.method && call.method !== route.method) return false;
  const a = route.segments;
  const b = call.path.split("/");
  if (a[a.length - 1] === "*") {
    if (b.length < a.length) return false;
  } else if (a.length !== b.length) {
    return false;
  }
  return a.every((seg, i) => seg === "*" || seg === b[i] || /^\{.+\}$/.test(seg) || b[i] === PARAM);
}

function main() {
  if (!fs.existsSync(OPENAPI)) {
    console.error(`Cannot find ${OPENAPI}; run the check from a full checkout (brokerverse/ next to backend/).`);
    process.exit(2);
  }
  const routes = loadRoutes();
  const topSegments = new Set(routes.map((r) => r.path.split("/")[1]));
  const parseErrors = [];
  for (const file of listFiles(SRC)) {
    try {
      FILES.set(file, parseFile(file));
    } catch (e) {
      parseErrors.push(`${path.relative(ROOT, file)}: ${e.message}`);
    }
  }
  findHelpers();
  const sites = collectCalls(topSegments);
  const calls = sites.flat();

  const missing = [];
  const wrongMethod = [];
  const unresolved = sites.filter((site) => site.every((c) => c.unresolved));
  for (const site of sites.filter((x) => !unresolved.includes(x))) {
    // A site is fine when one of its variants reaches a route.
    const hits = site.map((c) => routes.filter((r) => matches(r, c)));
    if (hits.some((h) => h.length)) {
      hits.flat().forEach((r) => { r.used = true; });
      continue;
    }
    const call = site[0];
    const anyMethod = routes.filter((r) => matches(r, { ...call, method: undefined }));
    if (anyMethod.length) {
      anyMethod.forEach((r) => { r.used = true; });
      wrongMethod.push({ ...call, allowed: [...new Set(anyMethod.map((r) => r.method))].join(", ") });
    } else {
      missing.push(call);
    }
  }

  const where = (c) => `${c.file}:${c.line}`;
  const label = (c) => `${(c.method || "ANY").padEnd(6)} ${c.path}${c.dynamic ? "  (built at run time)" : ""}`;
  console.log(`Backend routes: ${routes.length}. Front-end call sites: ${sites.length}.`);
  if (SHOW_CALLS) {
    console.log("\nCall sites:");
    calls.forEach((c) => console.log(`  ${label(c)}  ${where(c)}`));
  }
  console.log(`\nCalls to routes that do not exist: ${missing.length}`);
  missing.forEach((c) => console.log(`  ${label(c)}  ${where(c)}`));
  console.log(`\nCalls with a method the route does not accept: ${wrongMethod.length}`);
  wrongMethod.forEach((c) => console.log(`  ${label(c)}  ${where(c)}  (route accepts ${c.allowed})`));
  console.log(`\nCall sites whose path is only known at run time (not checked): ${unresolved.length}`);
  unresolved.forEach(([c]) => console.log(`  ${(c.method || "ANY").padEnd(6)} ${where(c)}`));
  const unused = routes.filter((r) => !r.used);
  console.log(`\nBackend routes no screen calls: ${unused.length}${SHOW_UNUSED ? "" : " (list them with --unused)"}`);
  if (SHOW_UNUSED) unused.forEach((r) => console.log(`  ${r.method.padEnd(6)} ${r.path}`));
  if (parseErrors.length) {
    console.log(`\nFiles that could not be parsed: ${parseErrors.length}`);
    parseErrors.forEach((e) => console.log(`  ${e}`));
  }
  if (STRICT && (missing.length || wrongMethod.length)) process.exit(1);
}

main();
