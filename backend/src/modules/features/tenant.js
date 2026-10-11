/**
 * Enabling of Phase 2 by the tenant (TISPH): besides the iorta TechNXT platform administrator, a user of the tenant may
 * request, approve and withdraw the enabling and disabling of Phase 2 functions on Master > System Configuration >
 * Features & Releases (TISPH decisions FT-D01 and FT-D02: fixed assets and the sales dashboard are Phase 2, enabled by
 * the SUPERID role). The change goes through the same service as the platform's (impact preview, dependencies, reason
 * and release reference, effective date, signed entitlements, audit trail, notices, read-only on a disable).
 *
 * Who: a user who holds the permission enable:phase2-features through one of its own roles (the administrator's
 * bypass of requirePermission does not count) and one of the roles of features.tenant_enable_roles (default
 * tis-superid). What: the features of the tiers of features.tenant_enable_tiers (default PHASE_2); a future release is
 * never enabled by the tenant, whatever the setting says, and a change whose plan reaches a future release (a
 * dependency or a dependent) is refused. Approval: features.tenant_enable_approval, 'four-eyes' (default: a second
 * enabler of the tenant or a platform administrator approves, never the requester) or 'single' (the request applies at
 * once; for a development environment, never honoured on a database marked production).
 */
import { getSetting } from '../../lib/settings.js';
import { refused } from '../../lib/errors.js';
import { PLATFORM_ROLE } from '../../lib/platform.js';
import { SYSTEM_ENVIRONMENT_KEY } from '../../lib/environment.js';

export const TENANT_ENABLE = 'enable:phase2-features';
/** Tiers the tenant may ever switch: the future releases stay with the platform administrator. */
export const TENANT_TIER_CEILING = Object.freeze(['PHASE_2']);
export const APPROVAL_MODES = Object.freeze(['four-eyes', 'single']);
export const SETTING_KEYS = Object.freeze({
  roles: 'features.tenant_enable_roles',
  tiers: 'features.tenant_enable_tiers',
  approval: 'features.tenant_enable_approval',
});
const DEFAULTS = { roles: ['tis-superid'], tiers: ['PHASE_2'], approval: 'four-eyes' };

const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

/**
 * The policy in force: { roles, tiers, approval, configuredApproval, production }. Values outside the rules are
 * dropped (a future tier, the platform role, an unknown approval mode); 'single' turns back to 'four-eyes' on a
 * database marked production.
 */
export async function tenantPolicy() {
  const [roles, tiers, approval, env] = await Promise.all([
    getSetting(SETTING_KEYS.roles, DEFAULTS.roles), getSetting(SETTING_KEYS.tiers, DEFAULTS.tiers),
    getSetting(SETTING_KEYS.approval, DEFAULTS.approval), getSetting(SYSTEM_ENVIRONMENT_KEY, ''),
  ]);
  const production = String(env || '').trim().toLowerCase() === 'production';
  const configuredApproval = APPROVAL_MODES.includes(approval) ? approval : DEFAULTS.approval;
  return {
    roles: list(roles).filter((r) => r !== PLATFORM_ROLE),
    tiers: list(tiers).filter((t) => TENANT_TIER_CEILING.includes(t)),
    approval: configuredApproval === 'single' && !production ? 'single' : 'four-eyes',
    configuredApproval,
    production,
  };
}

/** Does the user enable Phase 2 for the tenant: the permission held through its roles and one of the roles of the setting? */
export const isTenantEnabler = (user, policy) => !!user && (user.permissions || []).includes(TENANT_ENABLE)
  && (user.roles || []).some((r) => policy.roles.includes(r)) && !(user.roles || []).includes(PLATFORM_ROLE);

/** Middleware: the tenant enabler (req.tenantPolicy is set for the handler). */
export const requireTenantEnabler = (() => {
  const mw = async (req, _res, next) => {
    try {
      const policy = await tenantPolicy();
      if (!policy.tiers.length) return next(refused('TENANT_ENABLING_OFF', 'Enabling by TISPH is switched off (features.tenant_enable_tiers is empty): the platform administrator enables the functions'));
      if (!isTenantEnabler(req.user, policy)) {
        return next(refused('NOT_TENANT_ENABLER', `Requires the permission ${TENANT_ENABLE} through one of the roles of ${SETTING_KEYS.roles} (${policy.roles.join(', ') || 'none'})`));
      }
      req.tenantPolicy = policy;
      return next();
    } catch (e) {
      return next(e);
    }
  };
  mw.permissions = [TENANT_ENABLE];
  return mw;
})();

/** Refuse a plan that reaches a tier the tenant does not switch (`features`: the features of the preview with their tier). */
export function assertTenantTiers(features, policy) {
  const outside = features.filter((f) => !policy.tiers.includes(f.tier));
  if (outside.length) {
    throw refused('FEATURE_TIER_NOT_ALLOWED', `${outside.map((f) => `${f.name} (${f.tierName})`).join(', ')} ${outside.length > 1 ? 'are' : 'is'} enabled and disabled by the iorta TechNXT platform administrator only`,
      outside.map((f) => ({ path: 'features', message: `${f.key}: ${f.tierName}` })));
  }
}

/**
 * Errors of a change of the settings above ([key, value] pairs, as Master > Configuration and the configuration
 * workbook pass them): roles a list of role codes without the platform role, tiers a list of PHASE_2 only, approval
 * one of the modes.
 */
export function tenantSettingErrors(changes, paths = {}) {
  const errors = [];
  for (const [key, value] of changes) {
    const path = paths[key] || key;
    if (key === SETTING_KEYS.roles && (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim() || v === PLATFORM_ROLE))) {
      errors.push({ path, message: `must list role codes (never ${PLATFORM_ROLE})` });
    }
    if (key === SETTING_KEYS.tiers && (!Array.isArray(value) || value.some((v) => !TENANT_TIER_CEILING.includes(v)))) {
      errors.push({ path, message: `may list ${TENANT_TIER_CEILING.join(', ')} only (or nothing): future releases are enabled by the platform administrator` });
    }
    if (key === SETTING_KEYS.approval && !APPROVAL_MODES.includes(value)) errors.push({ path, message: `must be ${APPROVAL_MODES.join(' or ')}` });
  }
  return errors;
}
