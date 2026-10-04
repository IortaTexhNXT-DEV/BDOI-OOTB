#!/usr/bin/env node
/**
 * Local static server for a production build, with the same behaviour as the nginx web server:
 * build/ served with the single-page fallback, /env-config.js generated from the environment variables,
 * /api forwarded to the backend, the same cache headers and Content-Security-Policy.
 *
 *   npm run build
 *   API_UPSTREAM=http://127.0.0.1:8000 ENVIRONMENT_NAME=UAT PORT=3000 npm run serve
 *
 * Variables: PORT (3000), BUILD_DIR (build), API_UPSTREAM (http://127.0.0.1:8000; "none" to disable the proxy),
 * API_BASE_URL, ENVIRONMENT_NAME, ENVIRONMENT_COLOR, ANALYTICS_ENABLED (as for scripts/env-config.sh).
 * For trials and local checks only; production uses nginx (nginx/ and deploy/ec2/nginx-web.conf).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const port = Number(process.env.PORT || 3000);
const root = path.resolve(process.env.BUILD_DIR || path.join(__dirname, "..", "build"));
const upstreamSetting = process.env.API_UPSTREAM === undefined ? "http://127.0.0.1:8000" : process.env.API_UPSTREAM;
const upstream = upstreamSetting && upstreamSetting !== "none" ? new URL(upstreamSetting) : null;

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`No build at ${root}: run npm run build first.`);
  process.exit(1);
}

// the same generator as the web servers, so a value refused there is refused here
const envConfig = execFileSync("sh", [path.join(__dirname, "env-config.sh")], { env: process.env, encoding: "utf8" });

const apiBase = process.env.API_BASE_URL || "";
const apiOrigin = /^https?:\/\//i.test(apiBase) ? new URL(apiBase).origin : "";
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  `frame-src 'self' blob:${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json",
  ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".gif": "image/gif",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": csp,
};

const send = (res, status, headers, body) => {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
};

const proxy = (req, res) => {
  const target = new URL(req.url, upstream);
  const out = http.request(
    target,
    { method: req.method, headers: { ...req.headers, host: target.host, "x-forwarded-proto": "http", "x-forwarded-for": req.socket.remoteAddress } },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  out.on("error", () => send(res, 502, { "Content-Type": "application/json" }, JSON.stringify({ error: "API not reachable" })));
  req.pipe(out);
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
  if (pathname.startsWith("/api/") || pathname === "/api") {
    if (upstream) return proxy(req, res);
    return send(res, 404, { "Content-Type": "text/plain" }, "API proxy disabled");
  }
  if (pathname === "/env-config.js") {
    return send(res, 200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store, max-age=0" }, envConfig);
  }
  const file = path.join(root, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
  const inside = file.startsWith(root + path.sep);
  if (inside && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const cache = pathname.startsWith("/static/") ? "public, max-age=31536000, immutable" : "no-cache";
    return send(res, 200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": cache }, fs.readFileSync(file));
  }
  if (pathname.startsWith("/static/")) return send(res, 404, { "Content-Type": "text/plain" }, "Not found");
  return send(res, 200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" }, fs.readFileSync(path.join(root, "index.html")));
});

server.listen(port, () => {
  console.log(`BrokerVerse build at http://localhost:${port} (environment '${process.env.ENVIRONMENT_NAME || "production"}', API ${upstream ? `proxied to ${upstream.origin}` : apiBase || "not proxied"})`);
});
