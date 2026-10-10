/**
 * Access controls (Master > Users and Access > Role Permissions > Access controls): the switches that decide how the
 * other access screens are enforced. access.change_approval (changes of access wait for a second administrator),
 * access.sod_enforced (segregation of duties checked when roles are given), access.authority_enforced (approvals
 * checked against the approval limits) and access.authority_without_limit (an approver without a limit is allowed or
 * refused).
 *
 * A change of these switches is a change of kind access-controls that always waits for a different user holding
 * approve:access-control, whatever access.change_approval says (switching the approval off is itself approved). The
 * generic configuration endpoints refuse these keys (lib/settingOwners.js).
 */
import { badRequest } from '../../lib/errors.js';
import { clearSettingsCache, getSetting } from '../../lib/settings.js';
import { requiredReason } from '../ops-masters/records.js';
import { listAccessChanges, registerAccessKind, requestAccessChange } from './changes.js';

export const KIND = 'access-controls';
export const CONTROLS_PATH = '/master/generals/usermanagement/role-permissions?controls=1';
const TARGET = 'access-controls';

/** The switches, in the order of the screen, with their business words. */
export const CONTROLS = [
  { key: 'access.change_approval', name: 'Changes of access wait for a second administrator', type: 'boolean', fallback: true },
  { key: 'access.sod_enforced', name: 'Segregation of duties is checked when roles are given', type: 'boolean', fallback: true },
  { key: 'access.authority_enforced', name: 'Approvals are checked against the approval limits', type: 'boolean', fallback: true },
  { key: 'access.authority_without_limit', name: 'An approver without a limit for the transaction', type: 'choice', fallback: 'allow',
    options: [{ value: 'allow', name: 'May approve' }, { value: 'refuse', name: 'Is refused' }] },
];
export const CONTROL_KEYS = CONTROLS.map((c) => c.key);

const valueText = (c, v) => {
  if (c.type === 'boolean') return v ? 'On' : 'Off';
  return c.options.find((o) => o.value === v)?.name || String(v);
};

/** "Approvals are checked against the approval limits: On → Off". */
const lineText = (l) => {
  const c = CONTROLS.find((x) => x.key === l.key);
  return `${c?.name || l.key}: ${valueText(c, l.before)} → ${valueText(c, l.value)}`;
};

/** The switches with their value and the change waiting for approval. */
export async function controlsOverview(db, user) {
  const items = [];
  for (const c of CONTROLS) items.push({ key: c.key, name: c.name, type: c.type, options: c.options || null, value: await getSetting(c.key, c.fallback) });
  const pending = (await listAccessChanges(db, { kind: KIND }, user))[0] || null;
  return { items, pending };
}

/** Propose new values ({ values: { key: value }, reasonCode, note }): always a change waiting for approval. */
export async function proposeControls(db, b, user) {
  const lines = [];
  for (const c of CONTROLS) {
    if (!b.values || !(c.key in b.values)) continue;
    const value = b.values[c.key];
    if (c.type === 'boolean' && typeof value !== 'boolean') throw badRequest('Validation failed', [{ path: `values.${c.key}`, message: 'Choose On or Off' }]);
    if (c.type === 'choice' && !c.options.some((o) => o.value === value)) throw badRequest('Validation failed', [{ path: `values.${c.key}`, message: 'Choose one of the options' }]);
    const before = await getSetting(c.key, c.fallback);
    if (JSON.stringify(before) !== JSON.stringify(value)) lines.push({ key: c.key, before, value });
  }
  if (!lines.length) throw badRequest('Validation failed', [{ path: 'values', message: 'No change: the switches are already as chosen' }]);
  const reason = await requiredReason(db, 'access_change', { reasonCode: b.reasonCode, note: b.note });
  return requestAccessChange(db, { kind: KIND, target: TARGET, payload: { lines, reasonCode: reason.code, reason: reason.text }, note: reason.text, user });
}

registerAccessKind(KIND, {
  label: 'Access controls',
  link: (c) => `${CONTROLS_PATH}&change=${c.id}`,
  describe: async (_db, c) => ({ targetLabel: 'Access controls', summary: (c.payload?.lines || []).map(lineText) }),
  apply: async (db, c, user) => {
    const lines = c.payload?.lines || [];
    for (const l of lines) {
      await db.query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [l.key, JSON.stringify(l.value), user?.id ?? null]);
    }
    clearSettingsCache();
    return { audit: { entity: 'app_settings', entityId: KIND, action: 'access-controls', before: Object.fromEntries(lines.map((l) => [l.key, l.before])),
      after: { ...Object.fromEntries(lines.map((l) => [l.key, l.value])), change: `CFG-${c.id}` } } };
  },
  applied: () => 'the access controls are changed',
});
