/**
 * Personal data breach and security incident register (Compliance > Data Privacy > Breach Register): the incident log,
 * the assessment against the NPC criteria, the 72-hour NPC notification tracker, the notification of the data
 * subjects, documents and the annual security incident report. Permissions: read:privacy / write:privacy (the data
 * privacy team: System Administrator, Operations). Rules: service.js.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { documentsSchema, optText, sendXlsx, usersWithPermission } from '../ic-compliance/common.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Data Privacy: Breach Register', '/privacy/breaches');
const read = [requirePermission('read:privacy')];
const write = [requirePermission('write:privacy')];
const S = 'Compliance > Data Privacy > Breach Register';
const when = z.string().max(40).optional().nullable();
const example = { id: 'pdb_1', breachNumber: 'PDB-2026-00001', incidentType: 'personal-data-breach', title: 'Policy schedules e-mailed to the wrong client',
  discoveredAt: '2026-10-03T01:00:00.000Z', npcDueAt: '2026-10-06T01:00:00.000Z', hoursLeft: 46, npcOverdue: false, notifiable: true, status: 'assessed' };

const body = z.object({
  incidentType: z.enum(svc.INCIDENT_TYPES).optional(), title: z.string().trim().min(3).max(300), description: optText(8000), discoveredAt: when, occurredAt: when,
  reportedBy: optText(200), nature: z.array(z.string()).max(3).optional(), dataCategories: z.array(z.string().max(120)).max(30).optional(),
  subjectsAffected: z.number().int().min(0).optional().nullable(), recordsAffected: z.number().int().min(0).optional().nullable(), systemsAffected: optText(1000),
  cause: optText(4000), containment: optText(4000), remediation: optText(4000), dpoUserId: z.string().max(80).optional().nullable(), documents: documentsSchema.optional(),
}).strict();

define({
  method: 'GET', path: '/', summary: 'Breach register (filters: status, incidentType, year, pendingNpc=true, search) with counts and the notification hours',
  screen: S, middleware: read, query: { pendingNpc: 'true' },
  response: { success: true, data: { items: [example], notifyHours: 72, summary: { open: 1, pendingNpc: 1, npcOverdue: 0, notAssessed: 0 } } },
  handler: async (req, res) => ok(res, await svc.listBreaches(req.query)),
});
define({
  method: 'GET', path: '/options', summary: 'Options of the breach form: incident types, natures, data categories (privacy.breach_data_categories), the data privacy team',
  screen: S, middleware: read, response: { success: true, data: { incidentTypes: svc.INCIDENT_TYPES, natures: svc.NATURES, dataCategories: ['Names and contact details'], team: [{ id: 'usr_1', name: 'Ana Reyes' }] } },
  handler: async (req, res) => ok(res, { incidentTypes: svc.INCIDENT_TYPES, natures: svc.NATURES, dataCategories: await svc.dataCategories(), team: await usersWithPermission('write:privacy') }),
});
define({
  method: 'GET', path: '/annual-report', summary: 'Annual security incident report of a calendar year (?year=): counts of incidents, breaches, notifiable breaches, notifications on time and late, by nature and data category',
  screen: `${S} > Annual report`, middleware: read, query: { year: '2025' },
  response: { success: true, data: { year: 2025, incidents: 3, breaches: 2, notifiable: 1, notifiedToNpc: 1, notifiedLate: 0 } },
  handler: async (req, res) => ok(res, await svc.annualReport(req.query.year)),
});
define({
  method: 'GET', path: '/annual-report/export', summary: 'Annual security incident report as Excel', screen: `${S} > Annual report > Download`, middleware: read, query: { year: '2025' }, response: 'xlsx',
  handler: async (req, res) => {
    const rep = await svc.annualReport(req.query.year);
    await audit(req, { entity: 'privacy_report', entityId: `security-incidents-${rep.year}`, action: 'export', after: { year: rep.year, incidents: rep.incidents } });
    sendXlsx(res, `security-incident-report-${rep.year}.xlsx`, svc.annualSheets(rep), 'Annual security incident report');
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One incident with its history', screen: S, middleware: read, response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.breachView(req.params.id)),
});
define({
  method: 'POST', path: '/', summary: 'Log a security incident or personal data breach when discovered (PDB series); the NPC deadline is privacy.breach_notify_hours after discovery and the data privacy team is notified',
  screen: `${S} > Log incident`, middleware: [...write, validate(body)],
  request: { title: 'Policy schedules e-mailed to the wrong client', discoveredAt: '2026-10-03T09:00:00+08:00', nature: ['confidentiality'], dataCategories: ['Names and contact details'], subjectsAffected: 1 },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await svc.createBreach(req.body, req.user);
    await audit(req, { entity: 'personal_data_breach', entityId: r.id, action: 'create', after: r });
    created(res, r, `Incident ${r.breachNumber} logged`);
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update the facts of an open incident (description, data involved, numbers, cause, containment, remediation, DPO, documents)',
  screen: `${S} > Edit`, middleware: [...write, validate(body.partial().strict())], request: { containment: 'Recipient asked to delete the e-mail; confirmation received' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await svc.updateBreach(req.params.id, req.body, req.user);
    await audit(req, { entity: 'personal_data_breach', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Incident updated');
  },
});
const actionBody = z.object({
  sensitiveData: z.boolean().optional(), identityFraudRisk: z.boolean().optional(), unauthorisedAcquisition: z.boolean().optional(), realRiskOfHarm: z.boolean().optional(),
  notifiable: z.boolean().optional().nullable(), overrideReason: optText(2000), incidentType: z.enum(svc.INCIDENT_TYPES).optional(), notes: optText(4000),
  notifiedAt: when, reference: optText(200), method: optText(200), delayReason: optText(2000), count: z.number().int().min(0).optional().nullable(), notNotifiedReason: optText(2000),
}).strict();
const STEPS = {
  assess: 'Assess the incident against the NPC criteria; notifiable follows the criteria unless decided otherwise with a reason',
  'notify-npc': 'Record the notification to the NPC: time, reference, method; the reason for the delay when after the deadline',
  'notify-subjects': 'Record the notification of the data subjects (time, number, method) or the reason they are not notified',
  close: 'Close the incident with the outcome and the measures taken (a notifiable breach must have been notified to the NPC)',
};
for (const [action, summary] of Object.entries(STEPS)) {
  define({
    method: 'POST', path: `/:id/${action}`, summary, screen: `${S} > Actions`, middleware: [...write, validate(actionBody)],
    request: action === 'assess' ? { sensitiveData: true, unauthorisedAcquisition: true, realRiskOfHarm: true, notes: 'Government ID images were attached' }
      : action === 'notify-npc' ? { notifiedAt: '2026-10-04T10:00:00+08:00', reference: 'NPC-BN-2026-0001', method: 'NPC breach notification portal' } : {},
    response: { success: true, data: { ...example, status: action === 'close' ? 'closed' : 'assessed' } },
    handler: async (req, res) => {
      const r = await svc.breachAction(req.params.id, action, req.body, req.user);
      await audit(req, { entity: 'personal_data_breach', entityId: r.after.id, action, before: r.before, after: r.after });
      ok(res, r.after, `Incident ${r.after.breachNumber}: ${action} recorded`);
    },
  });
}

export default router;
export const mount = '/privacy/breaches';
