/**
 * Password rules from GET /auth/password-policy, checked as the user types (the server checks them again, together
 * with the password history).
 */
export const DEFAULT_POLICY = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
  historyCount: 0,
};

/** [{ key, ok, params }] for every rule of the policy. */
export const passwordChecks = (policy, password) => {
  const p = { ...DEFAULT_POLICY, ...(policy || {}) };
  const pw = String(password || "");
  const checks = [{ key: "minLength", ok: pw.length >= p.minLength, params: { count: p.minLength } }];
  if (p.requireUpper) checks.push({ key: "upper", ok: /[A-Z]/.test(pw) });
  if (p.requireLower) checks.push({ key: "lower", ok: /[a-z]/.test(pw) });
  if (p.requireDigit) checks.push({ key: "digit", ok: /[0-9]/.test(pw) });
  if (p.requireSymbol) checks.push({ key: "symbol", ok: /[^A-Za-z0-9]/.test(pw) });
  return checks;
};

export const meetsPolicy = (policy, password) => passwordChecks(policy, password).every((c) => c.ok);

/** Error message of a failed API call (the first field error when the API lists them). */
export const apiError = (error, fallback) => {
  if (!error) return fallback;
  if (Array.isArray(error.errors) && error.errors[0]?.message) return error.errors.map((e) => e.message).join(". ");
  return error.message || fallback;
};
