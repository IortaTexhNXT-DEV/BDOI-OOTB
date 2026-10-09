import 'dotenv/config';

/** Development-only fallbacks. In production (NODE_ENV=production) the server refuses to start with them. */
export const DEV_JWT_SECRET = 'dev-only-secret-change-me';
export const DEV_DATA_ENCRYPTION_KEY = 'dev-only-data-key-change-me';
export const DEV_PII_ENCRYPTION_KEY = 'dev-only-personal-data-key-change-me';

const MB = 1024 * 1024;

/** Build the configuration from an environment object (process.env by default; tests pass their own). */
export function buildConfig(source = process.env) {
  const env = (name, fallback) => {
    const v = source[name];
    return v === undefined || v === '' ? fallback : v;
  };
  const num = (name, fallback) => {
    const n = Number(env(name, fallback));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return Object.freeze({
    port: Number(env('PORT', 8000)),
    nodeEnv: env('NODE_ENV', 'development'),
    databaseUrl: env('DATABASE_URL', 'postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse'),
    jwtSecret: env('JWT_SECRET', DEV_JWT_SECRET),
    /** Access-token lifetime (seconds). Short by default: the front end renews it with the refresh token. */
    accessTtl: num('JWT_ACCESS_TTL_SECONDS', 1800),
    refreshTtl: num('JWT_REFRESH_TTL_SECONDS', 2592000),
    /** Key for data encrypted at rest (TOTP secrets) and for hashing reset codes. */
    dataEncryptionKey: env('DATA_ENCRYPTION_KEY', DEV_DATA_ENCRYPTION_KEY),
    /**
     * Field-level encryption of personal identifiers (TIN, government ID and bank account numbers; lib/pii.js). The
     * previous key is set only while a key rotation runs (npm run pii:rotate), so values encrypted with it stay readable.
     */
    piiEncryptionKey: env('PII_ENCRYPTION_KEY', DEV_PII_ENCRYPTION_KEY),
    piiEncryptionKeyPrevious: env('PII_ENCRYPTION_KEY_PREVIOUS', ''),
    corsOrigins: env('CORS_ORIGINS', '*').split(',').map((s) => s.trim()).filter(Boolean),
    uploadDir: env('UPLOAD_DIR', './uploads'),
    /** Folder of the SAP GL text files when it is outside the storage area (e.g. a share SAP reads); empty: sap_gl.folder under UPLOAD_DIR. */
    sapGlExportDir: env('SAP_GL_EXPORT_DIR', ''),
    publicBaseUrl: env('PUBLIC_BASE_URL', 'http://localhost:8000').replace(/\/+$/, ''),
    smtpUrl: env('SMTP_URL', ''),
    /**
     * Bundled brand pack (backend/assets/brand-packs/<id>) enabled at start-up in a deployment made for its client, once:
     * an administrator's Back to default is kept across restarts (modules/branding/bundled.js, enableDeploymentPack).
     */
    brandPack: env('BRAND_PACK', '').trim(),
    logLevel: env('LOG_LEVEL', 'info'),
    /** Lifetime of signed file links (GET /api/s3/object/... ?exp=&sig=). */
    fileUrlTtl: num('FILE_URL_TTL_SECONDS', 1800),
    /** Request size limits (memory-resident uploads). */
    jsonBodyLimit: env('JSON_BODY_LIMIT', '2mb'),
    uploadMaxBytes: num('UPLOAD_MAX_MB', 10) * MB,
    uploadMaxFiles: num('UPLOAD_MAX_FILES', 10),
    importMaxBytes: num('IMPORT_MAX_MB', 10) * MB,
    /** Spreadsheet import caps: uncompressed bytes per workbook part and data rows per file. */
    importMaxInflatedBytes: num('IMPORT_MAX_INFLATED_MB', 50) * MB,
    importMaxRows: num('IMPORT_MAX_ROWS', 20000),
    /**
     * Proxies in front of the API whose X-Forwarded-For is believed (Express "trust proxy"): a hop count, or addresses
     * and subnets separated by commas. 1 for one reverse proxy (nginx, Railway); Azure counts every hop between Front
     * Door and the API (deploy/AZURE.md). The client address feeds the sign-in rate limits and the sign-in history.
     */
    trustProxy: trustProxySetting(env('TRUST_PROXY', '1')),
    /**
     * Sign-in with Microsoft Entra ID (OpenID Connect, authorization code flow with PKCE). Off unless the tenant, the
     * application (client) ID, its secret and the redirect address are all set (deploy/AZURE.md, Entra ID).
     */
    entra: Object.freeze({
      tenantId: env('ENTRA_TENANT_ID', ''),
      clientId: env('ENTRA_CLIENT_ID', ''),
      clientSecret: env('ENTRA_CLIENT_SECRET', ''),
      redirectUri: env('ENTRA_REDIRECT_URI', ''),
      authority: env('ENTRA_AUTHORITY', 'https://login.microsoftonline.com').replace(/\/+$/, ''),
    }),
  });
}

/** TRUST_PROXY as Express takes it: a number of hops, true / false, or a list of addresses and subnets. */
function trustProxySetting(value) {
  const v = String(value).trim();
  if (/^\d+$/.test(v)) return Number(v);
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const ENTRA_VARIABLES = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'ENTRA_REDIRECT_URI'];
/** Is sign-in with Microsoft Entra ID configured (every ENTRA_* variable set)? */
export const entraConfigured = (cfg = config) => !!(cfg.entra.tenantId && cfg.entra.clientId && cfg.entra.clientSecret && cfg.entra.redirectUri);

export const config = buildConfig();

const isLocalUrl = (u) => /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(String(u || ''));

/**
 * Problems that make a configuration unsafe for production. Empty outside production (development and tests keep
 * their defaults).
 */
export function productionConfigProblems(cfg = config, source = process.env) {
  if (cfg.nodeEnv !== 'production') return [];
  const problems = [];
  const secret = source.JWT_SECRET;
  if (!secret) problems.push('JWT_SECRET is not set');
  else if (secret === DEV_JWT_SECRET || /change[-_ ]?me/i.test(secret)) problems.push('JWT_SECRET is a placeholder value');
  else if (Buffer.byteLength(secret) < 32) problems.push('JWT_SECRET must be at least 32 characters');
  const dataKey = source.DATA_ENCRYPTION_KEY;
  if (!dataKey) problems.push('DATA_ENCRYPTION_KEY is not set');
  else if (dataKey === DEV_DATA_ENCRYPTION_KEY || /change[-_ ]?me/i.test(dataKey)) problems.push('DATA_ENCRYPTION_KEY is a placeholder value');
  else if (Buffer.byteLength(dataKey) < 32) problems.push('DATA_ENCRYPTION_KEY must be at least 32 characters');
  else if (dataKey === secret) problems.push('DATA_ENCRYPTION_KEY must differ from JWT_SECRET');
  const piiKey = source.PII_ENCRYPTION_KEY;
  if (!piiKey) problems.push('PII_ENCRYPTION_KEY is not set');
  else if (piiKey === DEV_PII_ENCRYPTION_KEY || /change[-_ ]?me/i.test(piiKey)) problems.push('PII_ENCRYPTION_KEY is a placeholder value');
  else if (Buffer.byteLength(piiKey) < 32) problems.push('PII_ENCRYPTION_KEY must be at least 32 characters');
  else if (piiKey === secret || piiKey === dataKey) problems.push('PII_ENCRYPTION_KEY must differ from JWT_SECRET and DATA_ENCRYPTION_KEY');
  if (!source.CORS_ORIGINS || cfg.corsOrigins.includes('*') || !cfg.corsOrigins.length) problems.push('CORS_ORIGINS must list the web application origin(s); "*" is not allowed');
  if (!source.PUBLIC_BASE_URL) problems.push('PUBLIC_BASE_URL is not set');
  else if (isLocalUrl(cfg.publicBaseUrl)) problems.push('PUBLIC_BASE_URL must be the public address of the API, not localhost');
  const entraSet = ENTRA_VARIABLES.filter((name) => source[name]);
  if (entraSet.length && entraSet.length < ENTRA_VARIABLES.length) {
    problems.push(`Entra ID sign-in is partly configured: set ${ENTRA_VARIABLES.filter((name) => !source[name]).join(', ')} or none of the ENTRA_* variables`);
  } else if (entraSet.length && !/^https:\/\//i.test(cfg.entra.redirectUri)) problems.push('ENTRA_REDIRECT_URI must be an https:// address');
  return problems;
}

/** Refuse to start in production with an unsafe configuration (called by server.js before anything else). */
export function assertProductionConfig(cfg = config, source = process.env) {
  const problems = productionConfigProblems(cfg, source);
  if (problems.length) {
    throw new Error(`Refusing to start in production: ${problems.join('; ')}. See deploy/REFERENCE.md.`);
  }
}
