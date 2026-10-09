/**
 * Marketing campaigns to consenting clients and prospects (Operations > Sales & Marketing > Campaigns).
 *
 * A campaign sends an e-mail template to a segment. Only a party whose latest marketing consent in the consent
 * register (privacy_consents, purpose 'marketing') is granted and not withdrawn, with an e-mail address and not
 * anonymised, receives it; everyone else in the segment is recorded as excluded with the reason. Messages go through
 * the e-mail outbox (lib/mailer.js), so delivery and retries are those of the outbox. Each message carries an opt-out
 * link (signed, campaigns.opt_out_link_days) that records a refusal of the marketing purpose in the consent register.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { renderTemplate } from '../../lib/template.js';
import { companyName } from '../../lib/letterhead.js';
import { queueEmail } from '../../lib/mailer.js';
import { signToken, verify } from '../../lib/auth.js';
import { config } from '../../config.js';
import { today } from '../../lib/dates.js';
import { lobOf } from '../documents/common.js';
import { emailLayout } from '../branding/service.js';

export const PARTY_TYPES = ['client', 'lead', 'both'];

// ---------- segments ----------

export const segmentOut = (s) => ({ id: s.id, name: s.name, description: s.description, criteria: s.criteria || {}, status: s.status, createdAt: s.created_at, updatedAt: s.updated_at });

function cleanCriteria(c = {}) {
  const out = { partyType: PARTY_TYPES.includes(c.partyType) ? c.partyType : 'both' };
  for (const k of ['province', 'city', 'channelId', 'clientType', 'leadStatus']) if (c[k]) out[k] = String(c[k]).trim();
  if (c.lob) out.lob = lobOf(c.lob);
  if (Number(c.productId) > 0) out.productId = Number(c.productId);
  if (Number(c.expiringWithinDays) > 0) out.expiringWithinDays = Math.min(366, Number(c.expiringWithinDays));
  if (c.hasActivePolicy === true || c.hasActivePolicy === 'true') out.hasActivePolicy = true;
  return out;
}

export const listSegments = async () => (await many('SELECT * FROM campaign_segments ORDER BY name')).map(segmentOut);
export async function getSegment(id) {
  const s = await one('SELECT * FROM campaign_segments WHERE id = $1', [Number(id) || 0]);
  if (!s) throw notFound('Segment not found');
  return s;
}
export async function saveSegment(id, b, userId) {
  const criteria = JSON.stringify(cleanCriteria(b.criteria));
  if (id) {
    const before = await getSegment(id);
    await query('UPDATE campaign_segments SET name = COALESCE($2, name), description = COALESCE($3, description), criteria = $4, status = COALESCE($5, status), updated_by = $6, updated_at = now() WHERE id = $1',
      [before.id, b.name || null, b.description ?? null, b.criteria ? criteria : JSON.stringify(before.criteria), b.status || null, userId]);
    return { before: segmentOut(before), after: segmentOut(await getSegment(before.id)) };
  }
  const r = await one('INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by) VALUES ($1,$2,$3,$4,$4) RETURNING id', [b.name, b.description || null, criteria, userId]);
  return { after: segmentOut(await getSegment(r.id)) };
}

/** Current marketing consent of a party (true / false / null when never recorded), SQL over alias x (party_type, id). */
const CONSENT = `(SELECT pc.granted AND pc.withdrawn_at IS NULL FROM privacy_consents pc WHERE pc.party_type = x.party_type AND pc.party_id = x.id
  AND pc.purpose = 'marketing' ORDER BY pc.recorded_at DESC, pc.id DESC LIMIT 1)`;

/** The parties of a segment with their e-mail and consent. */
export async function segmentParties(criteria) {
  const c = cleanCriteria(criteria);
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const parts = [];
  if (c.partyType !== 'lead') {
    const w = ['c.anonymised_at IS NULL', "COALESCE(c.status, 'active') <> 'deleted'"];
    if (c.province) w.push(`c.state ILIKE ${p(c.province)}`);
    if (c.city) w.push(`c.city ILIKE ${p(c.city)}`);
    if (c.clientType) w.push(`c.client_type = ${p(c.clientType)}`);
    if (c.lob) w.push(`EXISTS (SELECT 1 FROM policies pl WHERE pl.client_id = c.id AND pl.lob = ${p(c.lob)})`);
    if (c.productId) w.push(`EXISTS (SELECT 1 FROM policies pl WHERE pl.client_id = c.id AND pl.product_id = ${p(c.productId)})`);
    if (c.channelId) w.push(`EXISTS (SELECT 1 FROM policies pl WHERE pl.client_id = c.id AND pl.channel_id = ${p(c.channelId)})`);
    if (c.hasActivePolicy) w.push("EXISTS (SELECT 1 FROM policies pl WHERE pl.client_id = c.id AND pl.status IN ('active', 'issued'))");
    if (c.expiringWithinDays) {
      const d = p(await today());
      w.push(`EXISTS (SELECT 1 FROM policies pl WHERE pl.client_id = c.id AND pl.status IN ('active', 'issued') AND pl.expiry_date BETWEEN ${d}::date AND ${d}::date + ${p(c.expiringWithinDays)}::int)`);
    }
    parts.push(`SELECT 'client'::text AS party_type, c.id, c.display_name AS name, c.first_name, c.email FROM clients c WHERE ${w.join(' AND ')}`);
  }
  if (c.partyType !== 'client' && !c.hasActivePolicy && !c.expiringWithinDays && !c.clientType) {
    const w = ['l.deleted_at IS NULL', 'l.anonymised_at IS NULL', 'l.client_id IS NULL'];
    if (c.province) w.push(`l.state ILIKE ${p(c.province)}`);
    if (c.city) w.push(`l.city ILIKE ${p(c.city)}`);
    if (c.lob) w.push(`l.lob = ${p(c.lob)}`);
    if (c.productId) w.push(`l.product_id = ${p(c.productId)}`);
    if (c.channelId) w.push(`l.channel_id = ${p(c.channelId)}`);
    if (c.leadStatus) w.push(`l.status = ${p(c.leadStatus)}`);
    parts.push(`SELECT 'lead'::text, l.id, l.display_name, l.first_name, l.email FROM leads l WHERE ${w.join(' AND ')}`);
  }
  if (!parts.length) return [];
  return many(`SELECT x.*, ${CONSENT} AS consent FROM (${parts.join(' UNION ALL ')}) x ORDER BY x.name`, params);
}

/** Why a party is not sent the campaign (null when it is). */
const exclusion = (x) => {
  if (x.consent === null) return 'No marketing consent recorded';
  if (x.consent === false) return 'Marketing consent refused or withdrawn';
  if (!x.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) return 'No valid e-mail address';
  return null;
};

/** Counts of a segment: total, eligible (consenting with an e-mail) and the excluded by reason. */
export async function previewSegment(criteria) {
  const rows = await segmentParties(criteria);
  const excluded = {};
  let eligible = 0;
  for (const x of rows) {
    const why = exclusion(x);
    if (why) excluded[why] = (excluded[why] || 0) + 1; else eligible += 1;
  }
  return { total: rows.length, eligible, excluded, sample: rows.filter((x) => !exclusion(x)).slice(0, 10).map((x) => ({ partyType: x.party_type, name: x.name, email: x.email })) };
}

// ---------- marketing consents ----------

export const CONSENT_CHANNELS = ['Form', 'E-mail', 'Phone', 'In person', 'Website'];
const CONSENT_STATUSES = ['granted', 'refused', 'withdrawn', 'not-recorded'];

const consentOut = (r) => ({
  partyType: r.party_type, partyId: r.id, name: r.name, code: r.code, email: r.email,
  status: r.granted === null || r.granted === undefined ? 'not-recorded' : r.granted && !r.withdrawn_at ? 'granted' : r.granted ? 'withdrawn' : 'refused',
  channel: r.channel || null, evidence: r.evidence || null, recordedAt: r.recorded_at || null,
});

/**
 * Clients and prospects with their current marketing consent (the latest record of the purpose 'marketing' in the
 * consent register), found by name, code or e-mail and narrowed by party type, consent status or party. At most 200 rows.
 */
export async function marketingConsents(q = {}) {
  const search = String(q.search || '').trim();
  const status = CONSENT_STATUSES.includes(q.status) ? q.status : null;
  const partyType = ['client', 'lead'].includes(q.partyType) ? q.partyType : null;
  const rows = await many(`SELECT x.*, pc.granted, pc.withdrawn_at, pc.channel, pc.evidence, pc.recorded_at FROM (
      SELECT 'client'::text AS party_type, c.id, c.display_name AS name, c.client_code AS code, c.email FROM clients c
       WHERE c.anonymised_at IS NULL AND COALESCE(c.status, 'active') <> 'deleted'
      UNION ALL
      SELECT 'lead'::text, l.id, l.display_name, l.lead_number, l.email FROM leads l WHERE l.deleted_at IS NULL AND l.anonymised_at IS NULL AND l.client_id IS NULL) x
    LEFT JOIN LATERAL (SELECT granted, withdrawn_at, channel, evidence, recorded_at FROM privacy_consents p WHERE p.party_type = x.party_type AND p.party_id = x.id
      AND p.purpose = 'marketing' ORDER BY p.recorded_at DESC, p.id DESC LIMIT 1) pc ON true
    WHERE ($1::text IS NULL OR x.party_type = $1)
      AND ($2::text = '' OR x.name ILIKE '%' || $2 || '%' OR x.code ILIKE '%' || $2 || '%' OR x.email ILIKE '%' || $2 || '%')
      AND ($3::text IS NULL OR $3 = CASE WHEN pc.granted IS NULL THEN 'not-recorded' WHEN pc.granted AND pc.withdrawn_at IS NULL THEN 'granted'
        WHEN pc.granted THEN 'withdrawn' ELSE 'refused' END)
      AND ($4::text IS NULL OR x.id = $4)
    ORDER BY x.name LIMIT 200`, [partyType, search, status, q.partyId ? String(q.partyId) : null]);
  return rows.map(consentOut);
}

/**
 * Record the marketing consent of a client or prospect (agreed or refused, how it was given and the evidence). A newer
 * record ends the consent in force before it, so one record is in force per party.
 */
export async function recordMarketingConsent(b, userId) {
  const table = b.partyType === 'lead' ? 'leads' : 'clients';
  const party = await one(`SELECT id, anonymised_at FROM ${table} WHERE id = $1`, [String(b.partyId)]);
  if (!party) throw badRequest('Validation failed', [{ path: 'partyId', message: b.partyType === 'lead' ? 'Prospect not found' : 'Client not found' }]);
  if (party.anonymised_at) throw badRequest('The personal data of this party were anonymised');
  const version = await getSetting('privacy.notice_version', '1.0');
  const id = await withTransaction(async (db) => {
    const r = (await db.query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version, evidence, recorded_by)
      VALUES ($1,$2,'marketing',$3,$4,$5,$6,$7) RETURNING id`, [b.partyType, party.id, b.granted, b.channel, String(version), b.evidence || null, userId])).rows[0];
    await db.query(`UPDATE privacy_consents SET withdrawn_at = now(), withdrawn_by = $4, withdrawal_reason = 'Superseded by a later record'
      WHERE party_type = $1 AND party_id = $2 AND purpose = 'marketing' AND granted AND withdrawn_at IS NULL AND id <> $3`, [b.partyType, party.id, r.id, userId]);
    return r.id;
  });
  const [out] = await marketingConsents({ partyType: b.partyType, partyId: party.id });
  return { id: Number(id), ...out };
}

// ---------- templates ----------

export const templateOut = (t) => ({ id: t.id, code: t.code, name: t.name, subject: t.subject, bodyHtml: t.body_html, status: t.status, updatedAt: t.updated_at });
export const listTemplates = async () => (await many('SELECT * FROM campaign_templates ORDER BY name')).map(templateOut);
export async function getTemplate(id) {
  const t = await one('SELECT * FROM campaign_templates WHERE id = $1', [Number(id) || 0]);
  if (!t) throw notFound('Template not found');
  return t;
}
export async function saveTemplate(id, b, userId) {
  if (b.code && await one('SELECT 1 FROM campaign_templates WHERE lower(code) = lower($1) AND ($2::int IS NULL OR id <> $2)', [b.code, id ? Number(id) : null])) {
    throw badRequest('Validation failed', [{ path: 'code', message: `Template code ${b.code} is already used` }]);
  }
  if (id) {
    const before = await getTemplate(id);
    await query(`UPDATE campaign_templates SET code = COALESCE($2, code), name = COALESCE($3, name), subject = COALESCE($4, subject), body_html = COALESCE($5, body_html),
      status = COALESCE($6, status), updated_by = $7, updated_at = now() WHERE id = $1`, [before.id, b.code || null, b.name || null, b.subject || null, b.bodyHtml || null, b.status || null, userId]);
    return { before: templateOut(before), after: templateOut(await getTemplate(before.id)) };
  }
  const r = await one('INSERT INTO campaign_templates(code, name, subject, body_html, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id', [b.code, b.name, b.subject, b.bodyHtml, userId]);
  return { after: templateOut(await getTemplate(r.id)) };
}

// ---------- campaigns ----------

export const campaignOut = (c) => c && ({
  id: c.id, campaignNumber: c.campaign_number, name: c.name, segmentId: c.segment_id, segmentName: c.segment_name ?? null, templateId: c.template_id, templateName: c.template_name ?? null,
  status: c.status, scheduledAt: c.scheduled_at, sentAt: c.sent_at, recipients: c.recipients, excluded: c.excluded, notes: c.notes, createdAt: c.created_at,
  createdBy: c.created_by_name || c.created_by,
});
const SELECT = `SELECT c.*, s.name AS segment_name, t.name AS template_name, u.display_name AS created_by_name FROM campaigns c
  JOIN campaign_segments s ON s.id = c.segment_id JOIN campaign_templates t ON t.id = c.template_id LEFT JOIN users u ON u.id = c.created_by`;

export async function listCampaigns(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR c.status = $1) ORDER BY c.created_at DESC LIMIT 500`, [q.status || null])).map(campaignOut);
}
export async function getCampaignRow(id) {
  const c = await one(`${SELECT} WHERE c.id = $1 OR c.campaign_number = $1`, [String(id)]);
  if (!c) throw notFound('Campaign not found');
  return c;
}

export async function createCampaign(b, userId) {
  await getSegment(b.segmentId);
  const t = await getTemplate(b.templateId);
  if (t.status !== 'active') throw badRequest('Validation failed', [{ path: 'templateId', message: 'The template is inactive' }]);
  const number = await nextDocumentNumber('marketing_campaign', { unique: { table: 'campaigns', column: 'campaign_number' } });
  const r = await one('INSERT INTO campaigns(campaign_number, name, segment_id, template_id, notes, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id',
    [number, b.name, b.segmentId, b.templateId, b.notes || null, userId]);
  return campaignOut(await getCampaignRow(r.id));
}

export async function updateCampaign(id, b, userId) {
  const before = await getCampaignRow(id);
  if (!['draft', 'scheduled'].includes(before.status)) throw conflict(`Campaign ${before.campaign_number} is ${before.status}`);
  if (b.segmentId) await getSegment(b.segmentId);
  if (b.templateId) await getTemplate(b.templateId);
  await query(`UPDATE campaigns SET name = COALESCE($2, name), segment_id = COALESCE($3, segment_id), template_id = COALESCE($4, template_id), notes = COALESCE($5, notes),
    updated_by = $6, updated_at = now() WHERE id = $1`, [before.id, b.name || null, b.segmentId || null, b.templateId || null, b.notes ?? null, userId]);
  return { before: campaignOut(before), after: campaignOut(await getCampaignRow(before.id)) };
}

export async function scheduleCampaign(id, at, userId) {
  const c = await getCampaignRow(id);
  if (!['draft', 'scheduled'].includes(c.status)) throw conflict(`Campaign ${c.campaign_number} is ${c.status}`);
  const when = new Date(at);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60000) throw badRequest('Validation failed', [{ path: 'scheduledAt', message: 'Choose a time in the future' }]);
  await query("UPDATE campaigns SET status = 'scheduled', scheduled_at = $2, updated_by = $3, updated_at = now() WHERE id = $1", [c.id, when, userId]);
  return campaignOut(await getCampaignRow(c.id));
}

export async function cancelCampaign(id, userId) {
  const c = await getCampaignRow(id);
  if (!['draft', 'scheduled'].includes(c.status)) throw conflict(`Campaign ${c.campaign_number} is ${c.status}`);
  await query("UPDATE campaigns SET status = 'cancelled', updated_by = $2, updated_at = now() WHERE id = $1", [c.id, userId]);
  return campaignOut(await getCampaignRow(c.id));
}

/** Signed opt-out token of a recipient, and the public link that uses it. */
export async function optOutLink(recipientId) {
  const days = Number(await getSetting('campaigns.opt_out_link_days', 365)) || 365;
  const token = signToken({ type: 'campaign-optout', rid: Number(recipientId) }, { expiresIn: `${days}d` });
  return `${config.publicBaseUrl}/api/campaigns/opt-out/${token}`;
}

const OPT_OUT = /\{\{\s*optOutLink\s*\}\}/;

/** Personalised subject and body of a recipient (opt-out paragraph appended when the template has no {{optOutLink}}). */
export async function renderMessage(template, party, link) {
  const vars = { firstName: party.first_name || party.name, fullName: party.name, companyName: await companyName(), optOutLink: link };
  let html = renderTemplate(template.body_html, vars);
  if (!OPT_OUT.test(template.body_html)) {
    // the link of the paragraph is a link, not the address as text
    const anchor = `<a href="${renderTemplate('{{optOutLink}}', vars)}">${renderTemplate('{{optOutLink}}', vars)}</a>`;
    const text = String((await getSetting('campaigns.opt_out_text', null)) || '').split(OPT_OUT).map((part) => renderTemplate(part, vars)).join(anchor);
    html += `<p style="font-size:12px;color:#5f6b76">${text}</p>`;
  }
  return { subject: renderTemplate(template.subject, vars, { html: false }), html };
}

/**
 * A template filled in for a sample recipient in the e-mail layout of the theme (header with the logo, footer line, theme
 * font), as the recipient sees it. The opt-out link is a sample address (it opens nothing).
 */
export async function previewMessage(template) {
  const msg = await renderMessage(template, { first_name: 'Maria', name: 'Maria Santos' }, `${config.publicBaseUrl}/api/campaigns/opt-out/sample`);
  return { subject: msg.subject, html: (await emailLayout(msg.html, { logoAs: 'data' })).html, hasOptOutLink: OPT_OUT.test(template.body_html) };
}

/** Send a campaign: recipients of the segment, consenting ones queued to the outbox, the others excluded. */
export async function dispatchCampaign(id, userId = null) {
  const c = await getCampaignRow(id);
  if (!['draft', 'scheduled'].includes(c.status)) throw conflict(`Campaign ${c.campaign_number} is ${c.status}`);
  const segment = await getSegment(c.segment_id);
  const template = await getTemplate(c.template_id);
  const parties = await segmentParties(segment.criteria);
  const max = Number(await getSetting('campaigns.max_recipients', 5000));
  const eligible = parties.filter((x) => !exclusion(x));
  if (eligible.length > max) throw badRequest(`The segment has ${eligible.length} consenting recipients; a campaign may reach at most ${max} (campaigns.max_recipients)`);
  return withTransaction(async (db) => {
    const locked = (await db.query('SELECT status FROM campaigns WHERE id = $1 FOR UPDATE', [c.id])).rows[0];
    if (!['draft', 'scheduled'].includes(locked.status)) throw conflict('The campaign was sent by another request');
    let queued = 0;
    let excluded = 0;
    for (const x of parties) {
      const why = exclusion(x);
      const r = (await db.query(`INSERT INTO campaign_recipients(campaign_id, party_type, party_id, party_name, email, status, excluded_reason) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (campaign_id, party_type, party_id) DO NOTHING RETURNING id`, [c.id, x.party_type, x.id, x.name, x.email || null, why ? 'excluded' : 'queued', why])).rows[0];
      if (!r) continue;
      if (why) { excluded += 1; continue; }
      const msg = await renderMessage(template, x, await optOutLink(r.id));
      const outboxId = await queueEmail({ to: x.email, subject: msg.subject, html: msg.html, template: `campaign:${template.code}`, entity: 'campaign', entityId: c.id, db });
      await db.query('UPDATE campaign_recipients SET outbox_id = $2 WHERE id = $1', [r.id, outboxId]);
      queued += 1;
    }
    await db.query("UPDATE campaigns SET status = 'sent', sent_at = now(), sent_by = $2, recipients = $3, excluded = $4, updated_at = now() WHERE id = $1", [c.id, userId, queued, excluded]);
    return { campaignNumber: c.campaign_number, queued, excluded };
  });
}

/** Results: recipients by delivery status (outbox), opt-outs, exclusions by reason, and conversions within the window. */
export async function campaignResults(id) {
  const c = await getCampaignRow(id);
  const window = Number(await getSetting('campaigns.conversion_window_days', 30));
  const recipients = await many(`SELECT r.id, r.party_type AS "partyType", r.party_id AS "partyId", r.party_name AS "partyName", r.email, r.status, r.excluded_reason AS "excludedReason",
      r.opted_out_at AS "optedOutAt", o.status AS delivery, o.sent_at AS "deliveredAt", o.error AS "deliveryError",
      (CASE WHEN r.party_type = 'lead' THEN EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = r.party_id AND q.deleted_at IS NULL AND q.created_at BETWEEN $2 AND $2 + make_interval(days => $3))
        ELSE EXISTS (SELECT 1 FROM quotes q WHERE q.client_id = r.party_id AND q.deleted_at IS NULL AND q.created_at BETWEEN $2 AND $2 + make_interval(days => $3)) END) AS quoted,
      (CASE WHEN r.party_type = 'lead' THEN EXISTS (SELECT 1 FROM policies p WHERE p.lead_id = r.party_id AND p.created_at BETWEEN $2 AND $2 + make_interval(days => $3))
        ELSE EXISTS (SELECT 1 FROM policies p WHERE p.client_id = r.party_id AND p.created_at BETWEEN $2 AND $2 + make_interval(days => $3)) END) AS insured
    FROM campaign_recipients r LEFT JOIN email_outbox o ON o.id = r.outbox_id WHERE r.campaign_id = $1 ORDER BY r.party_name`, [c.id, c.sent_at || new Date(), window]);
  const count = (f) => recipients.filter(f).length;
  const excludedByReason = {};
  for (const r of recipients.filter((x) => x.status === 'excluded')) excludedByReason[r.excludedReason] = (excludedByReason[r.excludedReason] || 0) + 1;
  return {
    campaign: campaignOut(c),
    totals: { recipients: count((r) => r.status !== 'excluded'), sent: count((r) => r.delivery === 'sent'), queued: count((r) => r.delivery === 'queued'),
      failed: count((r) => r.delivery === 'failed'), excluded: count((r) => r.status === 'excluded'), optedOut: count((r) => r.status === 'opted-out'),
      quoted: count((r) => r.status !== 'excluded' && r.quoted), insured: count((r) => r.status !== 'excluded' && r.insured) },
    conversionWindowDays: window, excludedByReason, recipients,
  };
}

/** Opt-out from a campaign e-mail link: a refusal of the marketing purpose in the consent register. */
export async function optOut(token) {
  let p;
  try {
    p = verify(token);
  } catch {
    throw badRequest('This opt-out link is not valid or has expired');
  }
  if (p.type !== 'campaign-optout' || !p.rid) throw badRequest('This opt-out link is not valid or has expired');
  const r = await one('SELECT r.*, c.campaign_number FROM campaign_recipients r JOIN campaigns c ON c.id = r.campaign_id WHERE r.id = $1', [Number(p.rid)]);
  if (!r) throw notFound('This opt-out link is not valid or has expired');
  if (r.opted_out_at) return { already: true, partyName: r.party_name, recipientId: Number(r.id), campaignNumber: r.campaign_number };
  await withTransaction(async (db) => {
    const version = await getSetting('privacy.notice_version', '1.0');
    const rec = (await db.query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version, evidence, recorded_by)
      VALUES ($1,$2,'marketing',false,'E-mail',$3,$4,NULL) RETURNING id`, [r.party_type, r.party_id, String(version), `Opt-out link of campaign ${r.campaign_number}`])).rows[0];
    await db.query(`UPDATE privacy_consents SET withdrawn_at = now(), withdrawal_reason = 'Opted out from a campaign e-mail' WHERE party_type = $1 AND party_id = $2 AND purpose = 'marketing'
      AND granted AND withdrawn_at IS NULL AND id <> $3`, [r.party_type, r.party_id, rec.id]);
    await db.query("UPDATE campaign_recipients SET status = 'opted-out', opted_out_at = now() WHERE id = $1", [r.id]);
  });
  return { already: false, partyName: r.party_name, recipientId: Number(r.id), campaignNumber: r.campaign_number };
}

/** Job campaign-dispatch: send the scheduled campaigns whose time has come. */
export async function campaignDispatch() {
  if (!(await one("SELECT to_regclass('campaigns') IS NOT NULL AS ok")).ok) return { skipped: 'campaigns not migrated' };
  const due = await many("SELECT id FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= now() ORDER BY scheduled_at");
  const sent = [];
  const failed = [];
  for (const c of due) {
    try {
      sent.push(await dispatchCampaign(c.id, null));
    } catch (e) {
      failed.push({ id: c.id, error: e.message });
    }
  }
  return { due: due.length, sent: sent.length, failed };
}
