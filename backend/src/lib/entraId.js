/**
 * Sign-in with Microsoft Entra ID (Azure AD, Microsoft 365): OpenID Connect authorization code flow with PKCE, for one
 * tenant (config.entra, ENTRA_* variables). The API is a confidential client: it exchanges the code with the client
 * secret and the PKCE verifier, then checks the ID token itself (RS256 signature against the tenant's published keys,
 * issuer, audience, expiry, nonce and tenant) before the user is looked up (modules/auth/sso.js).
 *
 * The flow's state, nonce and verifier travel in a short-lived signed transaction token that the browser keeps for the
 * round trip to Microsoft; the API stores nothing between the two calls.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError, unauthorized } from './errors.js';
import { signToken, verify } from './auth.js';

/** Seconds the browser has to come back from Microsoft with the code. */
export const TRANSACTION_TTL_SECONDS = 600;
/** Clock difference tolerated on the ID token's times (seconds). */
const CLOCK_TOLERANCE_SECONDS = 120;
/** Discovery document and signing keys are kept this long; an unknown key id reloads the keys at most once a minute. */
const METADATA_TTL_MS = 60 * 60 * 1000;
const KEYS_RELOAD_MS = 60 * 1000;
const HTTP_TIMEOUT_MS = 10000;
const SCOPES = 'openid profile email';

const cache = { metadata: null, metadataAt: 0, keys: null, keysAt: 0 };

/** Forget the cached discovery document and keys (tests, or after a tenant change). */
export function resetEntraCache() {
  cache.metadata = null;
  cache.metadataAt = 0;
  cache.keys = null;
  cache.keysAt = 0;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const randomValue = () => b64url(crypto.randomBytes(32));
const unavailable = () => new HttpError(502, 'Microsoft sign-in is not available at the moment; try again later');

async function getJson(url, init) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  } catch {
    throw unavailable();
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** The tenant's OpenID configuration (authorization, token and keys addresses, issuer). */
export async function metadata(cfg = config.entra) {
  if (cache.metadata && Date.now() - cache.metadataAt < METADATA_TTL_MS) return cache.metadata;
  const r = await getJson(`${cfg.authority}/${encodeURIComponent(cfg.tenantId)}/v2.0/.well-known/openid-configuration`);
  if (!r.ok || !r.body.authorization_endpoint || !r.body.token_endpoint || !r.body.jwks_uri || !r.body.issuer) throw unavailable();
  cache.metadata = r.body;
  cache.metadataAt = Date.now();
  return cache.metadata;
}

/** The signing key with this key id, reloading the tenant's key set when the id is not known yet (key rollover). */
async function signingKey(kid, cfg) {
  const fresh = cache.keys && Date.now() - cache.keysAt < METADATA_TTL_MS;
  let jwk = fresh ? cache.keys.find((k) => k.kid === kid) : null;
  if (!jwk && (!cache.keys || Date.now() - cache.keysAt >= KEYS_RELOAD_MS)) {
    const r = await getJson((await metadata(cfg)).jwks_uri);
    if (!r.ok || !Array.isArray(r.body.keys)) throw unavailable();
    cache.keys = r.body.keys;
    cache.keysAt = Date.now();
    jwk = cache.keys.find((k) => k.kid === kid);
  }
  if (!jwk || jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig')) throw unauthorized('Microsoft sign-in could not be verified');
  return crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
}

/**
 * Start a sign-in: the address of Microsoft's sign-in page and the transaction token the browser hands back with the
 * code. `deviceId` is carried through to the session.
 */
export async function startSignIn({ deviceId = null } = {}, cfg = config.entra) {
  const state = randomValue();
  const nonce = randomValue();
  const verifier = randomValue();
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const url = new URL((await metadata(cfg)).authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: cfg.clientId, response_type: 'code', redirect_uri: cfg.redirectUri, response_mode: 'query', scope: SCOPES,
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  const transaction = signToken({ type: 'sso-transaction', state, nonce, verifier, deviceId }, { expiresIn: TRANSACTION_TTL_SECONDS });
  return { authorizationUrl: url.toString(), transaction };
}

/** Check the transaction token against the state Microsoft returned; answers its contents. */
export function openTransaction(transaction, state) {
  let t;
  try { t = verify(transaction); } catch { throw unauthorized('The Microsoft sign-in took too long or was interrupted; sign in again'); }
  if (t.type !== 'sso-transaction' || typeof t.state !== 'string') throw unauthorized('Invalid sign-in request');
  const a = Buffer.from(String(state || ''));
  const b = Buffer.from(t.state);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw unauthorized('Invalid sign-in request');
  return t;
}

/** Exchange the authorization code for tokens (client secret and PKCE verifier); answers the ID token. */
export async function redeemCode(code, verifier, cfg = config.entra) {
  const r = await getJson((await metadata(cfg)).token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'authorization_code', code,
      redirect_uri: cfg.redirectUri, code_verifier: verifier, scope: SCOPES,
    }).toString(),
  });
  if (r.status >= 500) throw unavailable();
  if (!r.ok || !r.body.id_token) throw unauthorized('Microsoft did not accept the sign-in; sign in again');
  return r.body.id_token;
}

/**
 * Verify an ID token of the configured tenant and application: RS256 signature with the tenant's key, issuer, audience,
 * expiry and not-before, the nonce of this sign-in and the tenant id. Answers the claims.
 */
export async function verifyIdToken(idToken, { nonce }, cfg = config.entra) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') throw unauthorized('Microsoft sign-in could not be verified');
  const key = await signingKey(decoded.header.kid, cfg);
  const issuer = String((await metadata(cfg)).issuer).replace('{tenantid}', cfg.tenantId);
  let claims;
  try {
    claims = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: cfg.clientId, issuer, clockTolerance: CLOCK_TOLERANCE_SECONDS });
  } catch {
    throw unauthorized('Microsoft sign-in could not be verified');
  }
  const sameNonce = typeof claims.nonce === 'string' && typeof nonce === 'string' && claims.nonce.length === nonce.length
    && crypto.timingSafeEqual(Buffer.from(claims.nonce), Buffer.from(nonce));
  if (!sameNonce) throw unauthorized('Microsoft sign-in could not be verified');
  if (claims.tid && claims.tid !== cfg.tenantId) throw unauthorized('This Microsoft account belongs to another organisation');
  return claims;
}

/**
 * Who signed in: a stable subject (tenant and object id), the addresses that may match a BrokerVerse user (e-mail and
 * user principal name, lower case) and the display name.
 */
export function identityOf(claims) {
  const addresses = [claims.email, claims.preferred_username, claims.upn]
    .filter((v) => typeof v === 'string' && v.includes('@'))
    .map((v) => v.trim().toLowerCase());
  return {
    subject: `${claims.tid || ''}:${claims.oid || claims.sub}`,
    addresses: [...new Set(addresses)],
    name: typeof claims.name === 'string' ? claims.name.trim() : '',
  };
}
