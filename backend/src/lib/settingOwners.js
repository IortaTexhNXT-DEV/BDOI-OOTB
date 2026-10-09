/**
 * Settings that belong to a screen of their own. Each of these keys has exactly one screen that changes it (with that
 * screen's permission and validation); the generic configuration endpoints (PUT /settings, PUT
 * /system-settings/configuration) refuse a change to them and Master > Configuration shows them read-only with a link.
 *
 *   Brand pack / layout screens    look of the application (application name, logo on screen, favicon, colours):
 *                                  the brand pack of the deployment (BRAND_PACK); the e-mail and document sections of
 *                                  the theme: Master > System Configuration > E-mail Layout / Documents and Reports
 *                                  Layout
 *   Master > Company               the legal identity: company name, TIN, registered address and the print logo are
 *                                  fields of the primary company; these settings are only the fallback used when no
 *                                  company exists (lib/letterhead.js, period-end/tax.js)
 *   Master > Finance > Premium Taxes & LGU Rates
 *                                  premium tax rates and which taxes apply per line of business
 */
import { badRequest } from './errors.js';

export const SETTING_OWNERS = [
  {
    screen: 'the brand pack (BRAND_PACK) and Master > System Configuration > E-mail Layout / Documents and Reports Layout',
    path: '/master/configuration/documents-layout',
    keys: ['general.system_name'],
    prefixes: ['branding.'],
  },
  {
    screen: 'Master > Company',
    path: '/master/generals/organization/companymaster',
    keys: ['general.company_name', 'documents.default_logo_path', 'bir.registered_name', 'bir.registered_address', 'bir.withholding_agent_tin', 'bir.zip_code'],
    prefixes: [],
  },
  {
    screen: 'Master > Finance > Premium Taxes & LGU Rates',
    path: '/master/finance/premium-taxes',
    keys: ['tax.vat_rate', 'tax.dst_rate', 'tax.lgt_rate', 'tax.fst_rate', 'premium.taxes_by_lob'],
    prefixes: [],
  },
];

/** The screen that owns a setting ({ screen, path }), or null when Master > Configuration edits it. */
export function settingOwner(key) {
  const o = SETTING_OWNERS.find((x) => x.keys.includes(key) || x.prefixes.some((p) => key.startsWith(p)));
  return o ? { screen: o.screen, path: o.path } : null;
}

/**
 * Refuse a generic change to settings owned by another screen. `changes` are [key, value, before] (the shape
 * posting-rules' assertNotControlled takes); a key sent with its current value is not a change and passes.
 */
export function assertNotOwnedElsewhere(changes) {
  const errors = changes
    .filter(([k, v, before]) => settingOwner(k) && JSON.stringify(v) !== JSON.stringify(before))
    .map(([k]) => ({ path: k, message: `${k} is managed in ${settingOwner(k).screen}` }));
  if (!errors.length) return;
  const screens = [...new Set(errors.map((e) => settingOwner(e.path).screen))];
  throw badRequest(`${errors.map((e) => e.path).join(', ')} ${errors.length > 1 ? 'are' : 'is'} managed in ${screens.join(' and ')}; change ${errors.length > 1 ? 'them' : 'it'} there`, errors);
}
