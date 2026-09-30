/**
 * Clause library, slip templates and the slip composer (routes under /bespoke/clauses, /bespoke/slip-templates and
 * /bespoke/slips). Reading needs read:bespoke; the library and templates are maintained with write:clause-library,
 * composed slips with write:bespoke.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { assertVisible, ownRecord } from '../../lib/scope.js';
import { getSetting } from '../../lib/settings.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import * as lib from './clauses.js';
import * as cmp from './composer.js';
import { composedSlipDoc } from './printing.js';

export const canRead = [requireAuth, requirePermission('read:bespoke')];
export const canWrite = [requireAuth, requirePermission('write:bespoke')];
const canMaintain = [requireAuth, requirePermission('write:clause-library')];

const MASTER = 'Master > Clause Library';
const TEMPLATES = 'Master > Slip Templates';
const COMPOSER = 'Operations > Placement > Slip Composer';

const lobs = z.union([z.array(z.string().max(40)), z.string().max(400)]).optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use the date format YYYY-MM-DD').optional().nullable();
const clauseBody = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'code may contain letters, digits, - and _'),
  title: z.string().trim().min(3).max(200), clauseType: z.string().min(3).max(40), linesOfBusiness: lobs, category: z.string().max(80).optional().nullable(),
  wording: z.string().trim().min(5, 'wording is required').max(20000), effectiveFrom: date, effectiveTo: date, changeNote: z.string().max(500).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(), status: z.enum(['active', 'inactive']).optional(),
});
const clauseExample = { id: 1, code: 'PH-TYF-DED', title: 'Typhoon and flood deductible', clauseType: 'deductible', linesOfBusiness: ['FIRE', 'IAR'], currentVersion: 1,
  wording: 'Loss or damage caused by typhoon ... {deductible_percent}% of the sum insured ...', placeholders: ['deductible_percent', 'currency', 'deductible_amount'], effectiveFrom: '2026-01-01', status: 'active' };

const clauses = moduleRouter('Clause Library', '/bespoke/clauses');
clauses.define({
  method: 'GET', path: '/', summary: 'Clause library with the wording in force (date=, default today): filters clauseType (comma-separated), lob, status (active by default, all), search',
  screen: `${MASTER}; ${COMPOSER} > Add clause`, middleware: canRead, query: { clauseType: 'deductible,warranty', lob: 'FIRE' }, response: { success: true, data: [clauseExample] },
  handler: async (req, res) => res.json({ success: true, data: await lib.listClauses(req.query) }),
});
clauses.define({
  method: 'GET', path: '/options', summary: 'Reference data of the clause editor and composer: clause types, standard slip sections, placeholders (settings bespoke.*)', screen: `${MASTER}; ${COMPOSER}`,
  middleware: canRead, response: { success: true, data: { clauseTypes: lib.DEFAULT_CLAUSE_TYPES, sections: [{ key: 'insured', heading: 'Insured' }], placeholders: [{ key: 'sum_insured', label: 'Sum insured' }] } },
  handler: async (req, res) => res.json({ success: true, data: { clauseTypes: await lib.clauseTypes(), sections: (await getSetting('bespoke.slip_sections', [])) || [],
    placeholders: (await getSetting('bespoke.placeholders', [])) || [] } }),
});
clauses.define({
  method: 'GET', path: '/:id', summary: 'One clause (id or code) with every version of its wording, effective dates and who changed it', screen: `${MASTER} > Detail`, middleware: canRead,
  response: { success: true, data: { ...clauseExample, versions: [{ version: 1, wording: '...', effectiveFrom: '2026-01-01', effectiveTo: null, changeNote: 'Initial wording' }] } },
  handler: async (req, res) => res.json({ success: true, data: await lib.clauseById(req.params.id) }),
});
clauses.define({
  method: 'GET', path: '/:id/versions/:version', summary: 'One version of a clause wording', screen: `${COMPOSER} > Compare with library`, middleware: canRead,
  response: { success: true, data: { version: 1, wording: '...', placeholders: [] } },
  handler: async (req, res) => { const c = await lib.getClauseRow(req.params.id); res.json({ success: true, data: await lib.clauseVersion(c.id, Number(req.params.version)) }); },
});
clauses.define({
  method: 'POST', path: '/', summary: 'Add a clause to the library (version 1 of its wording; placeholders are read from the {name} tokens)', screen: `${MASTER} > New`,
  middleware: [...canMaintain, validate(clauseBody)], request: { code: 'PH-FLOOD-SUBLIMIT', title: 'Flood sub-limit', clauseType: 'condition', linesOfBusiness: ['FIRE'], wording: 'Flood losses are limited to {currency} {flood_limit} in the aggregate.' },
  response: { success: true, data: clauseExample },
  handler: async (req, res) => {
    const c = await lib.createClause(req.body, req.user.id);
    await audit(req, { entity: 'clause', entityId: c.id, action: 'create', after: { code: c.code, title: c.title, version: 1 } });
    res.status(201).json({ success: true, message: `Clause ${c.code} added`, data: c });
  },
});
clauses.define({
  method: 'PUT', path: '/:id', summary: 'Edit a clause: title, type, lines, status in place; a new wording becomes the next version effective from effectiveFrom (the previous version ends the day before)',
  screen: `${MASTER} > Edit`, middleware: [...canMaintain, validate(clauseBody.partial().omit({ code: true }))],
  request: { wording: 'Revised wording with {deductible_amount}', effectiveFrom: '2026-11-01', changeNote: 'Minimum deductible raised' }, response: { success: true, data: { ...clauseExample, currentVersion: 2 } },
  handler: async (req, res) => {
    const r = await lib.updateClause(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'clause', entityId: r.after.id, action: r.after.currentVersion !== r.before.currentVersion ? 'new-version' : 'update',
      before: { title: r.before.title, status: r.before.status, version: r.before.currentVersion }, after: { title: r.after.title, status: r.after.status, version: r.after.currentVersion, changeNote: req.body.changeNote } });
    res.json({ success: true, message: r.after.currentVersion !== r.before.currentVersion ? `Version ${r.after.currentVersion} of ${r.after.code} saved` : `Clause ${r.after.code} updated`, data: r.after });
  },
});

// ---------------------------------------------------------------- slip templates
const templateBody = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'code may contain letters, digits, - and _'), name: z.string().trim().min(3).max(200),
  linesOfBusiness: lobs, description: z.string().max(2000).optional().nullable(),
  sections: z.array(z.object({ key: z.string().max(60).optional(), heading: z.string().max(200).optional(), text: z.string().max(20000).optional() })).optional(),
  clauseIds: z.array(z.union([z.number(), z.string()])).optional(), status: z.enum(['active', 'inactive']).optional(),
});
const templateExample = { id: 1, code: 'PROPERTY-STD', name: 'Property (Fire / IAR) placement slip', linesOfBusiness: ['FIRE', 'IAR'], sections: [{ key: 'insured', heading: 'Insured', text: '{insured_name}' }],
  clauses: [{ clauseId: 1, code: 'PH-TYF-DED', title: 'Typhoon and flood deductible', clauseType: 'deductible', position: 1 }] };
const templates = moduleRouter('Slip Templates', '/bespoke/slip-templates');
templates.define({
  method: 'GET', path: '/', summary: 'Slip templates (lob= filters by line; status= active by default, all)', screen: `${TEMPLATES}; ${COMPOSER} > New slip`, middleware: canRead,
  query: { lob: 'FIRE' }, response: { success: true, data: [templateExample] },
  handler: async (req, res) => res.json({ success: true, data: await lib.listTemplates(req.query) }),
});
templates.define({
  method: 'GET', path: '/:id', summary: 'One slip template (id or code) with its sections and clauses', screen: `${TEMPLATES} > Detail`, middleware: canRead, response: { success: true, data: templateExample },
  handler: async (req, res) => res.json({ success: true, data: await lib.templateById(req.params.id) }),
});
templates.define({
  method: 'POST', path: '/', summary: 'Create a slip template: sections (key, heading, text with placeholders) and library clauses in print order', screen: `${TEMPLATES} > New`,
  middleware: [...canMaintain, validate(templateBody)], request: { code: 'CGL-STD', name: 'General liability slip', linesOfBusiness: ['CASUALTY'], sections: [{ key: 'insured', text: '{insured_name}' }], clauseIds: ['GEN-CYBER-EXCL'] },
  response: { success: true, data: templateExample },
  handler: async (req, res) => {
    const t = await lib.createTemplate(req.body, req.user.id);
    await audit(req, { entity: 'slip_template', entityId: t.id, action: 'create', after: { code: t.code, clauses: t.clauses.map((c) => c.code) } });
    res.status(201).json({ success: true, message: `Slip template ${t.code} created`, data: t });
  },
});
templates.define({
  method: 'PUT', path: '/:id', summary: 'Edit a slip template (sections, clauses, lines, status)', screen: `${TEMPLATES} > Edit`,
  middleware: [...canMaintain, validate(templateBody.partial().omit({ code: true }))], request: { clauseIds: ['PH-TYF-DED', 'PH-SRCC'] }, response: { success: true, data: templateExample },
  handler: async (req, res) => {
    const r = await lib.updateTemplate(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'slip_template', entityId: r.after.id, action: 'update', before: { name: r.before.name, clauses: r.before.clauses.map((c) => c.code), status: r.before.status },
      after: { name: r.after.name, clauses: r.after.clauses.map((c) => c.code), status: r.after.status } });
    res.json({ success: true, message: `Slip template ${r.after.code} updated`, data: r.after });
  },
});

// ---------------------------------------------------------------- composed slips
const slipClause = z.object({
  clauseId: z.union([z.number(), z.string()]).optional().nullable(), clauseVersion: z.union([z.number(), z.string()]).optional().nullable(), code: z.string().max(40).optional().nullable(),
  title: z.string().max(200).optional(), clauseType: z.string().max(40).optional(), wording: z.string().max(20000).optional().nullable(), manuscriptOnly: z.boolean().optional(),
}).passthrough();
const sectionBody = z.object({ key: z.string().max(60).optional(), heading: z.string().max(200).optional(), text: z.string().max(20000).optional() });
const composeBody = z.object({
  brokerSlipId: z.string().optional().nullable(), placementId: z.string().optional().nullable(), templateId: z.union([z.number(), z.string()]).optional().nullable(),
  title: z.string().max(200).optional(), lob: z.string().max(40).optional(), variables: z.record(z.union([z.string(), z.number()]).nullable()).optional(),
  sections: z.array(sectionBody).optional(), clauses: z.array(slipClause).optional(), changeNote: z.string().max(500).optional().nullable(), blank: z.boolean().optional(),
});
const slipExample = { id: 'csl_1', slipNumber: 'CSL-2026-00001', title: 'Request for quotation BS-2026-00001 - Cebu Cold Storage Corp.', status: 'draft', version: 3, brokerSlipNumber: 'BS-2026-00001',
  sections: [{ key: 'insured', heading: 'Insured', text: '{insured_name}', rendered: 'Cebu Cold Storage Corp.' }],
  clauses: [{ position: 1, clauseId: 1, clauseVersion: 1, code: 'PH-TYF-DED', title: 'Typhoon and flood deductible', clauseType: 'deductible', manuscript: true, rendered: '...' }],
  versions: [{ version: 3, changes: ['Wording of PH-TYF-DED Typhoon and flood deductible changed (manuscript)'], changedBy: 'Processing Officer', changedAt: '2026-09-30T02:00:00Z' }] };

/** A scoped user sees a composed slip only when they see its broker slip or placement. */
async function assertSlipVisible(req, slip) {
  if (slip.brokerSlipId) await assertVisible(req, 'broker_slip', slip.brokerSlipId);
  if (slip.placementId) await assertVisible(req, 'placement', slip.placementId);
  return slip;
}
const loadVisible = async (req) => assertSlipVisible(req, await cmp.composedById(req.params.id));

const slips = moduleRouter('Slip Composer', '/bespoke/slips');
slips.define({
  method: 'GET', path: '/', summary: 'Composed slips (brokerSlipId, placementId, status, search)', screen: COMPOSER, middleware: canRead, query: { brokerSlipId: 'BS-2026-00001' },
  response: { success: true, data: [{ id: 'csl_1', slipNumber: 'CSL-2026-00001', title: '...', status: 'draft', version: 3 }] },
  handler: async (req, res) => res.json({ success: true, data: await cmp.listComposed(req.query) }),
});
slips.define({
  method: 'POST', path: '/', summary: 'Start a composed slip for a Request for Quotation (brokerSlipId) or placement slip (placementId): blank (standard sections) or from a template',
  screen: `${COMPOSER} > New`, middleware: [...canWrite, validate(composeBody), ownRecord('broker_slip', (req) => req.body.brokerSlipId), ownRecord('placement', (req) => req.body.placementId)],
  request: { brokerSlipId: 'bs_1', templateId: 'PROPERTY-STD', variables: { deductible_percent: 2, deductible_amount: '250,000.00' } }, response: { success: true, data: slipExample },
  handler: async (req, res) => {
    const s = await cmp.createComposed(req.body, req.user.id);
    await audit(req, { entity: 'composed_slip', entityId: s.id, action: 'create', after: { slipNumber: s.slipNumber, template: s.templateCode, clauses: s.clauses.map((c) => c.code || c.title) } });
    res.status(201).json({ success: true, message: `Slip ${s.slipNumber} created`, data: s });
  },
});
slips.define({
  method: 'GET', path: '/library-clause/:clauseId', summary: 'A library clause as the composer adds it (wording and version in force today)', screen: `${COMPOSER} > Add clause`, middleware: canRead,
  response: { success: true, data: { clauseId: 1, clauseVersion: 1, code: 'PH-SRCC', title: 'Strike, riot and civil commotion', clauseType: 'clause', wording: '...' } },
  handler: async (req, res) => res.json({ success: true, data: await cmp.libraryClauseForSlip(req.params.clauseId) }),
});
slips.define({
  method: 'GET', path: '/:id', summary: 'Composed slip with sections and clauses (wording as saved and rendered with the placeholder values), missing placeholders and its version history',
  screen: COMPOSER, middleware: canRead, response: { success: true, data: slipExample },
  handler: async (req, res) => res.json({ success: true, data: await loadVisible(req) }),
});
slips.define({
  method: 'PUT', path: '/:id', summary: 'Save the composer (title, placeholder values, sections, the whole clause list in order; a library clause with a changed wording is manuscript). Each save with changes is a new version',
  screen: `${COMPOSER} > Save`, middleware: [...canWrite, validate(composeBody.omit({ brokerSlipId: true, placementId: true, templateId: true }))],
  request: { clauses: [{ clauseId: 1, wording: 'Typhoon and flood: 5% of the loss, minimum {currency} {deductible_amount}' }, { clauseId: 3 }, { title: 'Hot works permit', clauseType: 'warranty', wording: 'Warranted that hot works ...' }], changeNote: 'Underwriter comments' },
  response: { success: true, data: slipExample, changes: ['Clause PH-SRCC added'] },
  handler: async (req, res) => {
    await loadVisible(req);
    const r = await cmp.saveComposed(req.params.id, req.body, req.user.id);
    if (!r.unchanged) await audit(req, { entity: 'composed_slip', entityId: r.slip.id, action: 'save', after: { version: r.slip.version, changes: r.changes, changeNote: req.body.changeNote || null } });
    res.json({ success: true, message: r.unchanged ? 'No changes to save' : `Version ${r.slip.version} saved`, changes: r.changes, data: r.slip });
  },
});
for (const [path, status, label, message] of [['/:id/finalise', 'final', 'Finalise the slip (no more edits; printed and shared as final)', 'Slip finalised'],
  ['/:id/reopen', 'draft', 'Reopen a final slip for editing (a new version)', 'Slip reopened'], ['/:id/cancel', 'cancelled', 'Cancel a composed slip', 'Slip cancelled']]) {
  slips.define({
    method: 'POST', path, summary: label, screen: `${COMPOSER} > ${label.split(' ')[0]}`, middleware: [...canWrite, validate(z.object({ note: z.string().max(500).optional().nullable() }))],
    request: { note: 'Agreed with the lead underwriter' }, response: { success: true, data: { ...slipExample, status } },
    handler: async (req, res) => {
      await loadVisible(req);
      const r = await cmp.setComposedStatus(req.params.id, status, req.user.id, req.body.note);
      await audit(req, { entity: 'composed_slip', entityId: r.slip.id, action: path.split('/').pop(), before: { status: r.before.status }, after: { status, version: r.slip.version, note: req.body.note || null } });
      res.json({ success: true, message, data: r.slip });
    },
  });
}
slips.define({
  method: 'GET', path: '/:id/versions/:version', summary: 'Snapshot of one version (title, values, sections, clauses) with who saved it and what changed', screen: `${COMPOSER} > History`, middleware: canRead,
  response: { success: true, data: { version: 2, snapshot: { title: '...', sections: [], clauses: [] }, changes: ['Clause PH-SRCC added'], changedBy: 'Processing Officer' } },
  handler: async (req, res) => { await loadVisible(req); res.json({ success: true, data: await cmp.versionSnapshot(req.params.id, req.params.version) }); },
});
slips.define({
  method: 'GET', path: '/:id/diff', summary: 'Differences between two versions (from=, to=; default the previous and the current): header, values, sections and clauses with a word diff of each changed wording',
  screen: `${COMPOSER} > History > Compare`, middleware: canRead, query: { from: 1, to: 3 },
  response: { success: true, data: { from: { version: 1 }, to: { version: 3 }, changes: ['Clause PH-SRCC added'], clauses: [{ label: 'PH-SRCC Strike, riot and civil commotion', change: 'added', diff: [{ op: 'insert', text: '...' }] }] } },
  handler: async (req, res) => { await loadVisible(req); res.json({ success: true, data: await cmp.diffVersions(req.params.id, req.query.from, req.query.to) }); },
});
slips.define({
  method: 'GET', path: '/:id/pdf', summary: 'Composed slip PDF on the company letterhead (sections, clauses by type, placeholders filled)', screen: `${COMPOSER} > Print`, middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const s = await loadVisible(req);
    sendPdf(res, buildPdf(await composedSlipDoc(s)), `slip-${s.slipNumber}-v${s.version}.pdf`);
  },
});

export const clauseRouter = clauses.router;
export const templateRouter = templates.router;
export const composerRouter = slips.router;
