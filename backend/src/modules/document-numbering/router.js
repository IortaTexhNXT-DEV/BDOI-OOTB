import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

/**
 * Master > Document Numbering: document series (prefix, pattern, sequence width, reset rule, next number).
 * Reading needs the settings permission; changes need write:settings (system configuration) and are audited.
 */
const { router, define } = moduleRouter('Document Numbering', '/document-numbering');
const SCREEN = 'Master > Document Numbering';
const example = {
  code: 'policy', name: 'Policy', module: 'policy', prefix: 'POL', pattern: '{PREFIX}-{YYYY}-{SEQ}', seqWidth: 5, resetRule: 'yearly', startNumber: 1,
  active: true, periodKey: '2026', currentValue: 41, periodStartNumber: null, nextNumber: 42, nextPreview: 'POL-2026-00042',
};

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  module: z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_-]*$/, 'module must be lower-case letters, digits, - or _').optional(),
  prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9]+$/, 'prefix may contain letters and digits only').optional(),
  pattern: z.string().trim().min(1).max(80).optional(),
  seqWidth: z.coerce.number().int().min(1).max(12).optional(),
  resetRule: z.enum(svc.RESET_RULES).optional(),
  startNumber: z.coerce.number().int().min(1).max(999999999999).optional(),
  active: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).strict();

define({
  method: 'GET', path: '/', summary: 'Document series with the current counter and a preview of the next number (filters: module, search, active)', screen: SCREEN,
  middleware: canRead('settings'), query: { module: 'finance', search: 'receipt', active: 'true' },
  response: { success: true, data: [example], modules: [{ module: 'policy', count: 5 }], tokens: svc.TOKENS, resetRules: svc.RESET_RULES },
  handler: async (req, res) => ok(res, await svc.listSeries(req.query), 'OK', { modules: await svc.modules(), tokens: svc.TOKENS, resetRules: svc.RESET_RULES }),
});
define({
  method: 'GET', path: '/:code', summary: 'One document series', screen: SCREEN, middleware: canRead('settings'),
  response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getSeries(req.params.code)),
});
define({
  method: 'GET', path: '/:code/preview', summary: 'Preview the next number; unsaved pattern, prefix, seqWidth, resetRule, startNumber, branch, lob and date may be given', screen: `${SCREEN} > Edit`,
  middleware: canRead('settings'), query: { pattern: '{PREFIX}-{BRANCH}-{YY}{MM}-{SEQ}', prefix: 'POL', seqWidth: 6, resetRule: 'monthly', branch: 'MKT' },
  response: { success: true, data: { valid: true, errors: [], preview: 'POL-MKT-2609-000001', periodKey: '2026-09', currentValue: 0, nextNumber: 1 } },
  handler: async (req, res) => ok(res, await svc.previewSeries(req.params.code, req.query)),
});
define({
  method: 'PUT', path: '/:code', summary: 'Update a series (name, module, prefix, pattern, seqWidth, resetRule, startNumber, active, description); prefixes are unique across active series', screen: `${SCREEN} > Edit`,
  middleware: [...canWrite('settings'), validate(updateSchema)], request: { prefix: 'POL', pattern: '{PREFIX}-{YYYY}-{SEQ}', seqWidth: 6, resetRule: 'yearly' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateSeries(req.params.code, req.body, req.user);
    await audit(req, { entity: 'document_numbering', entityId: req.params.code, action: 'update', before, after });
    ok(res, after, 'Document series saved');
  },
});
define({
  method: 'PUT', path: '/:code/next-number', summary: 'Set the next number of the current period; forward only (never at or below a number already issued). Kept as the start of the period: after a transaction reset the series restarts there', screen: `${SCREEN} > Set next number`,
  middleware: [...canWrite('settings'), validate(z.object({ nextNumber: z.coerce.number().int().min(1).max(999999999999) }).strict())],
  request: { nextNumber: 1001 }, response: { success: true, data: { ...example, nextNumber: 1001, periodStartNumber: 1001, nextPreview: 'POL-2026-01001' } },
  handler: async (req, res) => {
    const { before, after } = await svc.setNextNumber(req.params.code, req.body.nextNumber, req.user);
    await audit(req, { entity: 'document_numbering', entityId: req.params.code, action: 'set-next-number',
      before: { nextNumber: before.nextNumber, periodKey: before.periodKey }, after: { nextNumber: after.nextNumber, periodKey: after.periodKey } });
    ok(res, after, 'Next number set');
  },
});

export default router;
export const mount = '/document-numbering';
