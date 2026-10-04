/** Distribution channels API (/channels): Master > Insurance Management > Distribution Channels. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Distribution channels', '/channels');
const SCREEN = 'Master > Insurance Management > Distribution Channels';
// the channel drop-downs of the prospect, quotation, programme and campaign screens read the active channels
const canRead = [requireAuth, requirePermission('read:channels', 'write:channels', 'read:leads', 'read:motor-programmes', 'read:campaigns')];
const canWrite = [requireAuth, requirePermission('write:channels')];

const text = (n) => z.string().max(n).optional().nullable();
const body = z.object({
  code: z.string().trim().min(1).max(30), name: z.string().trim().min(1).max(200), channelType: z.enum(svc.TYPES),
  parentId: text(40), referrerId: text(40), comsubPct: z.coerce.number().min(0).max(100).optional().nullable(), bankId: z.coerce.number().int().optional().nullable(),
  branchCode: text(40), province: text(120), city: text(120), address: text(500), contactPerson: text(200),
  contactEmail: z.string().email('contactEmail must be a valid e-mail').optional().nullable().or(z.literal('')), contactPhone: text(40), tin: text(30),
  mortgageeClause: text(2000), letterAddressee: text(300), status: z.enum(['active', 'inactive']).optional(), notes: text(2000),
});
const example = { id: 'ch_1', code: 'TOY-MKT', name: 'Toyota Makati', channelType: 'dealer_branch', parentId: 'ch_0', parentName: 'Toyota Dealer Group', path: 'Toyota Dealer Group > Toyota Makati', level: 1, referrerId: 'REF-001', comsubPct: 5, status: 'active' };

define({
  method: 'GET', path: '/', summary: 'Distribution channels with their hierarchy path (filter type, comma-separated; status; parentId; search; withProduction=true adds prospects, policies and premium)',
  screen: SCREEN, middleware: canRead, query: { type: 'dealer_group,dealer_branch', status: 'active', withProduction: 'true' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listChannels(req.query) }),
});
define({
  method: 'GET', path: '/options', summary: 'Active channels for drop-downs (filter type, comma-separated)', screen: `${SCREEN}; Prospects; Dealer Programmes; Campaigns`, middleware: canRead,
  query: { type: 'financing_bank,bank_branch' }, response: { success: true, data: [{ id: 'ch_1', code: 'TOY-MKT', name: 'Toyota Makati', channelType: 'dealer_branch', label: 'Toyota Dealer Group > Toyota Makati' }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.channelOptions(req.query.type ? String(req.query.type).split(',') : null) }),
});
define({
  method: 'GET', path: '/:id', summary: 'One channel (id or code)', screen: `${SCREEN} > View`, middleware: canRead, response: { success: true, data: example },
  handler: async (req, res) => res.json({ success: true, data: await svc.getChannel(req.params.id) }),
});
define({
  method: 'POST', path: '/', summary: 'Add a channel (dealer branch under a dealer group, bank branch under a financing bank)', screen: `${SCREEN} > Add`,
  middleware: [...canWrite, validate(body)], request: { code: 'TOY-MKT', name: 'Toyota Makati', channelType: 'dealer_branch', parentId: 'ch_0', referrerId: 'REF-001', comsubPct: 5 },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const c = await svc.createChannel(req.body, req.user.id);
    await audit(req, { entity: 'distribution_channel', entityId: c.id, action: 'create', after: c });
    res.status(201).json({ success: true, message: 'Channel added', data: c });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a channel', screen: `${SCREEN} > Edit`, middleware: [...canWrite, validate(body.partial())],
  request: { comsubPct: 6, contactEmail: 'fleet@toyotamakati.example.ph' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateChannel(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'distribution_channel', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Channel saved', data: after });
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Remove a channel (made inactive when it has business, programmes or a billing account)', screen: `${SCREEN} > Delete`, middleware: canWrite,
  response: { success: true, message: 'Channel removed', data: { removed: true } },
  handler: async (req, res) => {
    const out = await svc.deleteChannel(req.params.id, req.user.id);
    await audit(req, { entity: 'distribution_channel', entityId: out.channel.id, action: out.removed ? 'delete' : 'deactivate', before: out.channel });
    res.json({ success: true, message: out.removed ? 'Channel removed' : 'The channel has business on record, so it was made inactive', data: { removed: out.removed } });
  },
});

export default router;
export const mount = '/channels';
