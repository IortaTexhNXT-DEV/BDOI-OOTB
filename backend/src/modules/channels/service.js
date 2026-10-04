/**
 * Distribution channels (Master > Insurance Management > Distribution Channels): dealer groups and dealer branches,
 * financing banks and bank branches, affinity partners, in one hierarchy. A channel may be linked to a referrer
 * (commission accounts) whose comsub its business earns, and a financing bank carries the mortgagee clause and the
 * addressee of the bank endorsement letter.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../../lib/template.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

export const TYPES = ['dealer_group', 'dealer_branch', 'financing_bank', 'bank_branch', 'affinity_partner'];
/** Parent types a channel type may sit under (none: top level only). */
const PARENTS = {
  dealer_group: [], dealer_branch: ['dealer_group'], financing_bank: [], bank_branch: ['financing_bank'], affinity_partner: ['affinity_partner'],
};
export const BANK_TYPES = ['financing_bank', 'bank_branch'];
export const DEALER_TYPES = ['dealer_group', 'dealer_branch'];

const FIELDS = {
  code: 'code', name: 'name', channelType: 'channel_type', parentId: 'parent_id', referrerId: 'referrer_id', comsubPct: 'comsub_pct', bankId: 'bank_id',
  branchCode: 'branch_code', province: 'province', city: 'city', address: 'address', contactPerson: 'contact_person', contactEmail: 'contact_email',
  contactPhone: 'contact_phone', tin: 'tin', mortgageeClause: 'mortgagee_clause', letterAddressee: 'letter_addressee', status: 'status', notes: 'notes',
};

export const channelOut = (r) => r && ({
  id: r.id, code: r.code, name: r.name, channelType: r.channel_type, parentId: r.parent_id, parentName: r.parent_name ?? null,
  groupName: r.group_name ?? null, level: r.level ?? null, path: r.path ?? null,
  referrerId: r.referrer_id, referrerName: r.referrer_name ?? null, comsubPct: r.comsub_pct == null ? null : Number(r.comsub_pct),
  bankId: r.bank_id, bankName: r.bank_name ?? null, branchCode: r.branch_code, province: r.province, city: r.city, address: r.address,
  contactPerson: r.contact_person, contactEmail: r.contact_email, contactPhone: r.contact_phone, tin: r.tin,
  mortgageeClause: r.mortgagee_clause, letterAddressee: r.letter_addressee, status: r.status, notes: r.notes,
  children: r.children ?? undefined, leads: r.leads ?? undefined, policies: r.policies ?? undefined, premium: r.premium == null ? undefined : Number(r.premium),
  createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at,
});

/** Channels with their place in the hierarchy (level, path of names, top-level group) and the related names. */
const TREE = `WITH RECURSIVE tree AS (
    SELECT c.id, 0 AS level, c.name::text AS path, c.name AS group_name, ARRAY[c.id] AS ids FROM distribution_channels c WHERE c.parent_id IS NULL
    UNION ALL SELECT c.id, t.level + 1, t.path || ' > ' || c.name, t.group_name, t.ids || c.id FROM distribution_channels c JOIN tree t ON c.parent_id = t.id
      WHERE NOT c.id = ANY(t.ids) AND t.level < 5)
  SELECT c.*, t.level, t.path, t.group_name, p.name AS parent_name, r.name AS referrer_name, b.name AS bank_name,
    (SELECT count(*)::int FROM distribution_channels k WHERE k.parent_id = c.id) AS children
  FROM distribution_channels c LEFT JOIN tree t ON t.id = c.id LEFT JOIN distribution_channels p ON p.id = c.parent_id
  LEFT JOIN commission_referrers r ON r.id = c.referrer_id LEFT JOIN banks b ON b.id = c.bank_id`;

export async function listChannels(q = {}) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.type) add('x.channel_type = ANY(?::text[])', String(q.type).split(','));
  if (q.status) add('x.status = ?', q.status);
  if (q.parentId) add('x.parent_id = ?', q.parentId);
  if (q.search) add("(x.name ILIKE '%' || ? || '%' OR x.code ILIKE '%' || ? || '%' OR x.path ILIKE '%' || ? || '%')", q.search);
  const rows = await many(`SELECT * FROM (${TREE}) x WHERE ${where.join(' AND ')} ORDER BY x.path NULLS LAST, x.name`, params);
  if (String(q.withProduction) !== 'true') return rows.map(channelOut);
  const prod = await many(`SELECT ch.id, (SELECT count(*)::int FROM leads l WHERE l.channel_id = ch.id AND l.deleted_at IS NULL) AS leads,
      (SELECT count(*)::int FROM policies p WHERE p.channel_id = ch.id AND p.status <> 'cancelled') AS policies,
      (SELECT COALESCE(sum(p.premium_total), 0) FROM policies p WHERE p.channel_id = ch.id AND p.status <> 'cancelled') AS premium
    FROM distribution_channels ch WHERE ch.id = ANY($1)`, [rows.map((r) => r.id)]);
  return rows.map((r) => channelOut({ ...r, ...(prod.find((p) => p.id === r.id) || {}) }));
}

export async function getChannelRow(id, db = { query }) {
  const r = (await db.query(`SELECT * FROM (${TREE}) x WHERE x.id = $1 OR lower(x.code) = lower($1)`, [String(id)])).rows[0];
  if (!r) throw notFound('Distribution channel not found');
  return r;
}
export const getChannel = async (id) => channelOut(await getChannelRow(id));

function columnsFrom(b) {
  const cols = {};
  for (const [k, c] of Object.entries(FIELDS)) if (b[k] !== undefined) cols[c] = b[k] === '' ? null : b[k];
  return cols;
}

async function validate(cols, id = null) {
  const errors = [];
  const type = cols.channel_type;
  if (type && !TYPES.includes(type)) errors.push({ path: 'channelType', message: `channelType must be one of ${TYPES.join(', ')}` });
  if (cols.parent_id) {
    if (id && cols.parent_id === id) errors.push({ path: 'parentId', message: 'A channel cannot be its own parent' });
    const p = await one('SELECT id, channel_type FROM distribution_channels WHERE id = $1', [cols.parent_id]);
    if (!p) errors.push({ path: 'parentId', message: 'The parent channel does not exist' });
    else if (type && !PARENTS[type]?.includes(p.channel_type)) errors.push({ path: 'parentId', message: `A ${type.replace('_', ' ')} cannot sit under a ${p.channel_type.replace('_', ' ')}` });
    else if (id) {
      // no cycle: the new parent must not be a descendant of the channel
      const loop = await one(`WITH RECURSIVE d AS (SELECT id FROM distribution_channels WHERE parent_id = $1 UNION ALL SELECT c.id FROM distribution_channels c JOIN d ON c.parent_id = d.id)
        SELECT 1 FROM d WHERE id = $2 LIMIT 1`, [id, cols.parent_id]);
      if (loop) errors.push({ path: 'parentId', message: 'The parent is below this channel in the hierarchy' });
    }
  } else if (type && PARENTS[type]?.length && type !== 'affinity_partner') {
    errors.push({ path: 'parentId', message: `A ${type.replace('_', ' ')} sits under a ${PARENTS[type].join(' or ').replace('_', ' ')}` });
  }
  if (cols.referrer_id && !(await one("SELECT 1 FROM commission_referrers WHERE id = $1 AND status = 'Active'", [cols.referrer_id]))) {
    errors.push({ path: 'referrerId', message: 'The referrer does not exist or is not active' });
  }
  if (cols.bank_id && !(await one('SELECT 1 FROM banks WHERE id = $1', [cols.bank_id]))) errors.push({ path: 'bankId', message: 'The bank does not exist' });
  if (cols.comsub_pct != null && !(Number(cols.comsub_pct) >= 0 && Number(cols.comsub_pct) <= 100)) errors.push({ path: 'comsubPct', message: 'comsubPct must be between 0 and 100' });
  if (cols.code) {
    const dup = await one('SELECT 1 FROM distribution_channels WHERE lower(code) = lower($1) AND ($2::text IS NULL OR id <> $2)', [cols.code, id]);
    if (dup) errors.push({ path: 'code', message: `Channel code ${cols.code} is already used` });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

export async function createChannel(b, userId) {
  const cols = columnsFrom(b);
  await validate(cols);
  const data = { ...cols, created_by: userId, updated_by: userId };
  const keys = Object.keys(data);
  const r = await one(`INSERT INTO distribution_channels(${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(data));
  return getChannel(r.id);
}

export async function updateChannel(id, b, userId) {
  const before = await getChannelRow(id);
  const cols = columnsFrom(b);
  await validate({ channel_type: before.channel_type, parent_id: before.parent_id, ...cols }, before.id);
  if (cols.status === 'inactive') {
    const active = await one("SELECT 1 FROM distribution_channels WHERE parent_id = $1 AND status = 'active' LIMIT 1", [before.id]);
    if (active) throw conflict('Deactivate the channels under this one first');
  }
  const data = { ...cols, updated_by: userId, updated_at: new Date() };
  const keys = Object.keys(data);
  await query(`UPDATE distribution_channels SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(data)]);
  return { before: channelOut(before), after: await getChannel(before.id) };
}

/** A channel with business, children or programmes is made inactive; an unused one is deleted. */
export async function deleteChannel(id, userId) {
  const c = await getChannelRow(id);
  const used = await one(`SELECT (SELECT 1 FROM distribution_channels WHERE parent_id = $1 LIMIT 1) AS kids,
    (SELECT 1 FROM leads WHERE channel_id = $1 LIMIT 1) AS l, (SELECT 1 FROM quotes WHERE channel_id = $1 LIMIT 1) AS q,
    (SELECT 1 FROM policies WHERE channel_id = $1 LIMIT 1) AS p,
    (SELECT 1 FROM motor_programmes WHERE dealer_channel_id = $1 OR bank_channel_id = $1 LIMIT 1) AS m,
    (SELECT 1 FROM channel_billing_accounts WHERE channel_id = $1) AS b`, [c.id]);
  if (used.kids && !used.l && !used.q && !used.p && !used.m) throw conflict('Remove or move the channels under this one first');
  if (Object.values(used).some(Boolean)) {
    await query("UPDATE distribution_channels SET status = 'inactive', updated_by = $2, updated_at = now() WHERE id = $1", [c.id, userId]);
    return { channel: channelOut(c), removed: false };
  }
  await query('DELETE FROM distribution_channels WHERE id = $1', [c.id]);
  return { channel: channelOut(c), removed: true };
}

/** The mortgagee clause of a financing bank (its own clause, else channels.default_mortgagee_clause) with the names filled in. */
export async function mortgageeClause(bank, branch = null) {
  if (!bank) return null;
  const tpl = bank.mortgagee_clause || bank.mortgageeClause || ((await getSetting('channels.default_mortgagee_clause', null)) || '');
  const bankName = bank.name;
  return renderTemplate(String(tpl || ''), { bankName, bankBranch: branch?.name || bank.name }, { html: false });
}

/**
 * The client account a channel is billed through (a dealer or bank paying a premium); created on first use from the
 * channel's name, TIN and contacts.
 */
export async function billingClient(db, channelId, userId) {
  const linked = (await db.query('SELECT client_id FROM channel_billing_accounts WHERE channel_id = $1', [channelId])).rows[0];
  if (linked) return linked.client_id;
  const ch = (await db.query('SELECT * FROM distribution_channels WHERE id = $1', [channelId])).rows[0];
  if (!ch) throw notFound('Distribution channel not found');
  const code = await nextDocumentNumber('client', { db, unique: { table: 'clients', column: 'client_code' } });
  const c = (await db.query(`INSERT INTO clients(client_code, company_name, display_name, email, phone, city, state, tin, source, created_by, owner_user_id, client_type, lead_category)
    VALUES ($1,$2,$2,$3,$4,$5,$6,$7,'channel',$8,$8,'corporate','Corporate') RETURNING id`,
  [code, ch.name, ch.contact_email, ch.contact_phone, ch.city, ch.province, ch.tin, userId])).rows[0];
  await db.query('INSERT INTO channel_billing_accounts(channel_id, client_id) VALUES ($1,$2) ON CONFLICT (channel_id) DO NOTHING', [channelId, c.id]);
  return (await db.query('SELECT client_id FROM channel_billing_accounts WHERE channel_id = $1', [channelId])).rows[0].client_id;
}

/**
 * Commission details for a policy brought by a channel linked to a referrer, in the shape of the quotation's
 * commissionDetails (commission/service.js#accrueForPolicy): the channel's referrer at the channel's comsub rate (else
 * the rate of the referrer's level). Null when the policy has no channel or its channel no referrer.
 */
export async function channelReferral(db, policyId) {
  const r = (await db.query(`SELECT ch.referrer_id, ch.comsub_pct, p.net_premium FROM policies p JOIN distribution_channels ch ON ch.id = p.channel_id
    WHERE p.id = $1 AND ch.referrer_id IS NOT NULL`, [policyId])).rows[0];
  if (!r) return null;
  return { primary: { referrerId: r.referrer_id, ...(r.comsub_pct == null ? {} : { comsubPct: Number(r.comsub_pct) }) }, chain: [], netPremium: Number(r.net_premium) || undefined, source: 'channel' };
}

/** Options for drop-downs: active channels (optionally of some types), with their path. */
export async function channelOptions(types = null) {
  const rows = await listChannels({ status: 'active', type: types || undefined });
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, channelType: c.channelType, path: c.path, label: c.path || c.name }));
}
