/**
 * Underwriter rooms (/bespoke/rooms) and the external underwriter link (/bespoke/underwriter-link, no sign-in: the
 * signed token is the credential, like the customer approval link of a quotation).
 */
import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { assertVisible, ownRecord } from '../../lib/scope.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { checkUploadedFiles } from '../uploads/fileTypes.js';
import * as room from './room.js';
import { canRead, canWrite } from './composerRouter.js';

const ROOM = 'Operations > Placement > Underwriter Room';
const upload = memoryUpload({ files: 1 }).single('file');
const money = z.union([z.number(), z.string()]).optional().nullable();
const idRef = z.union([z.number(), z.string().min(1)]);

const bidExample = { id: 'bid_1', bidNumber: 'BID-2026-00001', insuranceCompanyId: 2, insuranceCompanyName: 'Sample Insurer', round: 1, status: 'quoted', premium: 1250000, rate: 0.147059,
  capacityPercent: 40, deductibles: 'Typhoon and flood 2% min PHP 250,000', deviations: [{ clause: 'PH-72HR', requested: '72 hours', offered: '48 hours' }], validityDate: '2026-10-30' };
const roomExample = { id: 'uwr_1', roomNumber: 'UWR-2026-00001', title: 'BS-2026-00001 Mandaue Cold Chain Corp.', status: 'open', currentRound: 1, brokerSlipNumber: 'BS-2026-00001', insuredName: 'Mandaue Cold Chain Corp.',
  sumInsured: 850000000, insurers: [{ insuranceCompanyId: 2, name: 'Sample Insurer', status: 'invited', latestBidStatus: 'quoted' }],
  sov: { current: { version: 1, locationCount: 3, totals: { building: 500000000, totalValue: 850000000 }, locations: [] } }, bids: [bidExample],
  comparison: { rows: [{ ...bidExample, rank: 1, isBest: true }], summary: { quoted: 1, bestPremium: 1250000, capacityOffered: 40, acceptedShare: 0 } },
  messages: [{ id: 1, authorType: 'underwriter', author: 'Sample Insurer (underwriter link)', body: 'Please confirm the sprinkler system' }],
  timeline: [{ at: '2026-09-30T02:00:00Z', actorType: 'broker', actor: 'processing.officer', event: 'bid-requested', insurer: 'Sample Insurer' }] };

/** A scoped user sees a room only when they see its broker slip or placement. */
async function visibleRoom(req) {
  const r = await room.getRoomRow(req.params.id);
  if (r.broker_slip_id) await assertVisible(req, 'broker_slip', r.broker_slip_id);
  if (r.placement_id) await assertVisible(req, 'placement', r.placement_id);
  return r;
}
const actorOf = (req) => ({ via: 'broker', userId: req.user.id, name: req.user.username });

const rooms = moduleRouter('Underwriter Rooms', '/bespoke/rooms');
rooms.define({
  method: 'GET', path: '/', summary: 'Underwriter rooms (status (comma-separated), brokerSlipId, placementId, insurerId, search)', screen: ROOM, middleware: canRead,
  query: { status: 'open' }, response: { success: true, data: [{ id: 'uwr_1', roomNumber: 'UWR-2026-00001', status: 'open', insurerCount: 3, quotedCount: 2 }] },
  handler: async (req, res) => res.json({ success: true, data: await room.listRooms(req.query) }),
});
rooms.define({
  method: 'POST', path: '/', summary: 'Open a room for a Request for Quotation (its insurers are invited unless insurerIds is given) or a placement slip; the latest composed slip is shared',
  screen: `${ROOM} > New`, middleware: [...canWrite, validate(z.object({ brokerSlipId: z.string().optional().nullable(), placementId: z.string().optional().nullable(), composedSlipId: z.string().optional().nullable(),
    title: z.string().max(200).optional(), insurerIds: z.array(idRef).optional(), responseDueDate: z.string().optional().nullable() })),
  ownRecord('broker_slip', (req) => req.body.brokerSlipId), ownRecord('placement', (req) => req.body.placementId)],
  request: { brokerSlipId: 'bs_1', insurerIds: ['MALAYAN', 'PIONEER'], responseDueDate: '2026-10-15' }, response: { success: true, data: roomExample },
  handler: async (req, res) => {
    const r = await room.createRoom(req.body, req.user);
    await audit(req, { entity: 'uw_room', entityId: r.id, action: 'create', after: { roomNumber: r.roomNumber, insurers: r.insurers.map((i) => i.name) } });
    res.status(201).json({ success: true, message: `Room ${r.roomNumber} opened`, data: r });
  },
});
rooms.define({
  method: 'GET', path: '/:id', summary: 'Room with insurers, SOV (current locations and totals, versions), attachments, bids of every round, comparison, messages and the timeline',
  screen: ROOM, middleware: canRead, response: { success: true, data: roomExample },
  handler: async (req, res) => { await visibleRoom(req); res.json({ success: true, data: await room.roomById(req.params.id) }); },
});
rooms.define({
  method: 'POST', path: '/:id/insurers', summary: 'Invite insurers (id, code or name from the insurer master) to the room', screen: `${ROOM} > Invite`,
  middleware: [...canWrite, validate(z.object({ insurerIds: z.array(idRef).min(1) }))], request: { insurerIds: ['STANDARD'] }, response: { success: true, data: roomExample },
  handler: async (req, res) => {
    await visibleRoom(req);
    const added = await room.inviteInsurers(req.params.id, req.body.insurerIds, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'invite', after: { insurers: added } });
    res.json({ success: true, message: `${added.length} insurer(s) invited`, data: await room.roomById(req.params.id) });
  },
});
rooms.define({
  method: 'DELETE', path: '/:id/insurers/:insurerId', summary: 'Withdraw an insurer\'s invitation (its link stops working; its bids stay in the history)', screen: `${ROOM} > Insurers`,
  middleware: canWrite, response: { success: true, data: roomExample },
  handler: async (req, res) => {
    await visibleRoom(req);
    await room.removeInsurer(req.params.id, req.params.insurerId, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'remove-insurer', after: { insurerId: Number(req.params.insurerId) } });
    res.json({ success: true, message: 'Invitation withdrawn', data: await room.roomById(req.params.id) });
  },
});
rooms.define({
  method: 'POST', path: '/:id/sov', summary: 'Upload the statement of values (multipart file: XLSX or CSV, one row per location; headings per bespoke.sov_columns): a new SOV version with location totals',
  screen: `${ROOM} > Statement of values`, middleware: [...canWrite, upload, checkUploadedFiles], request: { file: '<sov.xlsx>' },
  response: { success: true, data: { version: 1, totals: { building: 500000000, contents: 200000000, totalValue: 850000000 }, warnings: [], sov: { locationCount: 3 } } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const r = await room.uploadSov(req.params.id, req.file, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'sov-upload', after: { version: r.version, locations: r.locations.length, total: r.totals.totalValue } });
    res.status(201).json({ success: true, message: `Statement of values version ${r.version}: ${r.locations.length} location(s)`, data: { version: r.version, totals: r.totals, warnings: r.warnings, sov: r.sov } });
  },
});
rooms.define({
  method: 'POST', path: '/:id/attachments', summary: 'Attach a file to the room (multipart file, kind loss_run | survey | slip | other, description, shared=true shows it to the underwriters)',
  screen: `${ROOM} > Attachments`, middleware: [...canWrite, upload, checkUploadedFiles], request: { file: '<loss-run.pdf>', kind: 'loss_run', description: 'Loss run 2021-2025', shared: 'true' },
  response: { success: true, data: { id: 1, kind: 'loss_run', fileName: 'loss-run.pdf', shared: true } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const kind = ['loss_run', 'survey', 'slip', 'other'].includes(req.body.kind) ? req.body.kind : 'other';
    const a = await room.addAttachment(req.params.id, req.file, { kind, description: req.body.description || null, shared: req.body.shared }, { userId: req.user.id, name: req.user.username });
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'attach', after: { kind, fileName: a.fileName, shared: a.shared } });
    res.status(201).json({ success: true, message: 'Attachment added', data: a });
  },
});
rooms.define({
  method: 'POST', path: '/:id/bids/request', summary: 'Request bids from the invited insurers (all or insurerIds): a new round when the current round already has answers',
  screen: `${ROOM} > Request bids`, middleware: [...canWrite, validate(z.object({ insurerIds: z.array(idRef).optional(), note: z.string().max(2000).optional().nullable(), responseDueDate: z.string().optional().nullable() }))],
  request: { note: 'Please quote on the attached slip and SOV', responseDueDate: '2026-10-15' }, response: { success: true, data: { round: 1, created: ['bid_1'] } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const r = await room.requestBids(req.params.id, req.body, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'request-bids', after: r });
    res.json({ success: true, message: `Round ${r.round}: ${r.created.length} request(s)`, data: r });
  },
});
const bidBody = z.object({
  insuranceCompanyId: idRef, status: z.enum(['quoted', 'declined']).optional(), premium: money, rate: money, capacityPercent: money, deductibles: z.string().max(2000).optional().nullable(),
  deviations: z.array(z.object({ clause: z.string().max(200).optional().nullable(), requested: z.string().max(2000).optional().nullable(), offered: z.string().max(2000).optional().nullable() })).optional(),
  validityDate: z.string().optional().nullable(), remarks: z.string().max(4000).optional().nullable(), declineReason: z.string().max(1000).optional().nullable(),
});
rooms.define({
  method: 'POST', path: '/:id/bids', summary: 'Record an underwriter\'s bid received by e-mail or phone: quoted (premium for 100%, rate, line %, deductibles, deviations from the slip, validity) or declined',
  screen: `${ROOM} > Record bid`, middleware: [...canWrite, validate(bidBody)], request: { insuranceCompanyId: 2, premium: 1250000, capacityPercent: 40, deviations: bidExample.deviations, validityDate: '2026-10-30' },
  response: { success: true, data: bidExample },
  handler: async (req, res) => {
    await visibleRoom(req);
    const b = await room.recordBid(req.params.id, req.body, actorOf(req));
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: `bid-${b.status}`, after: b });
    res.status(201).json({ success: true, message: `Bid of ${b.insuranceCompanyName} recorded (${b.status})`, data: b });
  },
});
rooms.define({
  method: 'POST', path: '/:id/bids/:bidId/counter', summary: 'Broker counter-offer on a quoted bid (premium, rate, line %, terms): the bid is countered and the insurer is asked again in the next round',
  screen: `${ROOM} > Counter-offer`, middleware: [...canWrite, validate(z.object({ premium: money, rate: money, capacityPercent: money, terms: z.string().max(4000).optional().nullable(), remarks: z.string().max(2000).optional().nullable() }))],
  request: { premium: 1150000, capacityPercent: 50, terms: 'Keep the 72-hour clause' }, response: { success: true, data: { ...bidExample, round: 2, status: 'requested', counterPremium: 1150000 } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const b = await room.counterBid(req.params.id, req.params.bidId, req.body, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'counter', after: b });
    res.status(201).json({ success: true, message: `Counter-offer sent to ${b.insuranceCompanyName} (round ${b.round})`, data: b });
  },
});
for (const [action, label] of [['accept', 'Accept a quoted bid (sharePercent: the line taken, at most the line offered)'], ['decline', 'Record that the insurer declined'],
  ['withdraw', 'Record that the insurer withdrew its quote'], ['reopen', 'Undo the acceptance of a bid (back to quoted)']]) {
  rooms.define({
    method: 'POST', path: `/:id/bids/:bidId/${action}`, summary: label, screen: `${ROOM} > Bids`,
    middleware: [...canWrite, validate(z.object({ sharePercent: money, reason: z.string().max(1000).optional().nullable() }))], request: action === 'accept' ? { sharePercent: 40 } : { reason: 'Capacity used elsewhere' },
    response: { success: true, data: { ...bidExample, status: { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn', reopen: 'quoted' }[action] } },
    handler: async (req, res) => {
      await visibleRoom(req);
      const b = await room.bidAction(req.params.id, req.params.bidId, action, req.body, actorOf(req));
      await audit(req, { entity: 'uw_room', entityId: req.params.id, action: `bid-${action}`, after: { bid: b.bidNumber, status: b.status, share: b.acceptedShare } });
      res.json({ success: true, message: `Bid ${b.bidNumber} ${b.status}`, data: b });
    },
  });
}
rooms.define({
  method: 'POST', path: '/:id/messages', summary: 'Post a message to one underwriter (insuranceCompanyId) or all invited underwriters, or an internal note (internal=true); attachmentIds from the room',
  screen: `${ROOM} > Messages`, middleware: [...canWrite, validate(z.object({ insuranceCompanyId: idRef.optional().nullable(), body: z.string().trim().min(1).max(8000), internal: z.boolean().optional(), attachmentIds: z.array(idRef).optional() }))],
  request: { insuranceCompanyId: 2, body: 'The sprinkler system was upgraded in 2025; survey report attached', attachmentIds: [3] }, response: { success: true, data: roomExample.messages[0] },
  handler: async (req, res) => {
    await visibleRoom(req);
    const m = await room.postMessage(req.params.id, req.body, actorOf(req));
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: m.internal ? 'note' : 'message', after: { messageId: m.id, insurerId: m.insuranceCompanyId } });
    res.status(201).json({ success: true, message: 'Message posted', data: m });
  },
});
rooms.define({
  method: 'POST', path: '/:id/insurers/:insurerId/link', summary: 'Issue the external response link of an invited underwriter (signed, expires after bespoke.underwriter_link_ttl_hours; replaces the earlier link); sendEmail queues the invitation',
  screen: `${ROOM} > Underwriter link`, middleware: [...canWrite, validate(z.object({ sendEmail: z.boolean().optional() }))], request: { sendEmail: true },
  response: { success: true, data: { url: 'https://app.example/underwriter-room?token=...', expiresAt: '2026-10-14T02:00:00Z', emailId: 12 } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const r = await room.issueLink(req.params.id, req.params.insurerId, req.body, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'issue-link', after: { insurerId: Number(req.params.insurerId), expiresAt: r.expiresAt, emailed: Boolean(r.emailId) } });
    res.json({ success: true, message: r.emailId ? 'Link e-mailed to the underwriter' : 'Link issued', data: { url: r.url, expiresAt: r.expiresAt, emailId: r.emailId } });
  },
});
rooms.define({
  method: 'POST', path: '/:id/award', summary: 'Award the accepted bids (shares must total 100%): they become the insurer offers of the Request for Quotation and then the Quotation Slip (target quotation) or the Placement Slip (target placement)',
  screen: `${ROOM} > Award`, middleware: [...canWrite, validate(z.object({ bidIds: z.array(z.string()).optional(), leadBidId: z.string().optional().nullable(), shares: z.record(z.union([z.number(), z.string()])).optional(),
    target: z.enum(['quotation', 'placement']).optional(), inceptionDate: z.string().optional().nullable(), expiryDate: z.string().optional().nullable(), billingMode: z.enum(['broker', 'direct']).optional().nullable() }))],
  request: { leadBidId: 'bid_1', target: 'placement', inceptionDate: '2026-11-01' }, response: { success: true, data: { target: 'placement', placementId: 'plc_1', placementNumber: 'PS-2026-00003' } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const r = await room.awardRoom(req.params.id, req.body, req.user);
    await audit(req, { entity: 'uw_room', entityId: req.params.id, action: 'award', after: { target: r.target, quoteId: r.quoteId || null, placementId: r.placementId || null } });
    res.status(201).json({ success: true, message: r.target === 'quotation' ? 'Quotation slip prepared from the accepted bids' : `Placement slip ${r.placementNumber} prepared from the accepted bids`,
      data: { target: r.target, quoteId: r.quoteId || null, placementId: r.placementId || null, placementNumber: r.placementNumber || null }, room: r.room });
  },
});
rooms.define({
  method: 'POST', path: '/:id/close', summary: 'Close the room (links stop working)', screen: `${ROOM} > Close`, middleware: [...canWrite, validate(z.object({ reason: z.string().max(1000).optional().nullable() }))],
  request: { reason: 'Client renewed with the incumbent' }, response: { success: true, data: { ...roomExample, status: 'closed' } },
  handler: async (req, res) => {
    await visibleRoom(req);
    const r = await room.closeRoom(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'uw_room', entityId: r.id, action: 'close', after: { reason: req.body.reason || null } });
    res.json({ success: true, message: 'Room closed', data: r });
  },
});

// ---------------------------------------------------------------- external underwriter link (no sign-in)
const link = moduleRouter('Underwriter Link', '/bespoke/underwriter-link');
const token = z.string().min(20);
const linkAudit = (req, roomId, action, after, name) => audit({ ip: req.ip, user: { id: null, username: name } }, { entity: 'uw_room', entityId: roomId, action, after });
link.define({
  method: 'POST', path: '/view', auth: false, summary: 'External underwriter page: the slip, statement of values, shared attachments, its own bids and messages (signed token, no sign-in)', screen: 'Public /underwriter-room',
  middleware: [validate(z.object({ token }))], request: { token: '<token from the invitation link>' },
  response: { success: true, data: { room: { roomNumber: 'UWR-2026-00001', insuredName: 'Mandaue Cold Chain Corp.' }, slip: { sections: [], clauses: [] }, sov: { locations: [] }, bids: [], messages: [] } },
  handler: async (req, res) => res.json({ success: true, data: await room.linkView(req.body.token) }),
});
link.define({
  method: 'POST', path: '/bid', auth: false, summary: 'External underwriter submits a quote (premium, rate, line %, deductibles, deviations, validity), a declinature or withdraws its quote', screen: 'Public /underwriter-room > Submit bid',
  middleware: [validate(bidBody.omit({ insuranceCompanyId: true }).extend({ token, status: z.enum(['quoted', 'declined', 'withdrawn']).optional() }))],
  request: { token: '<token>', premium: 1250000, capacityPercent: 40, validityDate: '2026-10-30' }, response: { success: true, data: bidExample },
  handler: async (req, res) => {
    const { token: tk, ...body } = req.body;
    const ctx = await room.linkContext(tk);
    const b = await room.linkBid(tk, body);
    await linkAudit(req, ctx.room.id, `link-bid-${b.status}`, { bid: b.bidNumber, premium: b.premium, capacityPercent: b.capacityPercent }, ctx.actor.name);
    res.json({ success: true, message: b.status === 'quoted' ? 'Thank you: your quote was received' : `Your answer was recorded (${b.status})`, data: b });
  },
});
link.define({
  method: 'POST', path: '/message', auth: false, summary: 'External underwriter posts a message to the broker', screen: 'Public /underwriter-room > Messages',
  middleware: [validate(z.object({ token, body: z.string().trim().min(1).max(8000) }))], request: { token: '<token>', body: 'Please send the 2025 survey report' }, response: { success: true, data: { id: 5, authorType: 'underwriter' } },
  handler: async (req, res) => {
    const ctx = await room.linkContext(req.body.token);
    const m = await room.linkMessage(req.body.token, req.body.body);
    await linkAudit(req, ctx.room.id, 'link-message', { messageId: m.id }, ctx.actor.name);
    res.json({ success: true, message: 'Message sent', data: m });
  },
});

export const roomRouter = rooms.router;
export const linkRouter = link.router;
