/**
 * Bespoke placements, part 1: clause library (versions, effective dates, placeholders), slip templates, the slip
 * composer (blank or from a template, add / remove / reorder, manuscript wording, versions with who changed what,
 * diff) and the prints (composed slip PDF, composed wording on the broker slip PDF). Permissions by role.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { diffWords, diffSnapshots } from '../src/modules/bespoke/diff.js';
import { fillPlaceholders, placeholdersOf } from '../src/modules/bespoke/clauses.js';

let ctx;
let proc;
let ops;
let acct;
let sales;
const pdfText = (req) => req.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); })
  .then((r) => ({ status: r.status, type: r.headers['content-type'], text: r.body.toString('latin1') }));

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  proc = await persona('b.proc', ['processing']);
  ops = await persona('b.ops', ['operations']);
  acct = await persona('b.acct', ['accounting']);
  sales = await persona('b.sales', ['sales']);
});
afterAll(async () => { await pool.end(); });

describe('helpers', () => {
  it('reads and fills placeholders; a missing value stays visible', () => {
    expect(placeholdersOf('{currency} {deductible_amount} and {currency}')).toEqual(['currency', 'deductible_amount']);
    expect(fillPlaceholders('Min {currency} {deductible_amount}', { currency: 'PHP' })).toBe('Min PHP [deductible_amount]');
  });
  it('diffs words and snapshots', () => {
    expect(diffWords('a b c', 'a x c')).toEqual([{ op: 'equal', text: 'a ' }, { op: 'delete', text: 'b' }, { op: 'insert', text: 'x' }, { op: 'equal', text: ' c' }]);
    const d = diffSnapshots({ title: 'T', sections: [{ key: 'insured', heading: 'Insured', text: 'A' }], clauses: [{ clauseId: 1, code: 'X', title: 'X', wording: 'one' }] },
      { title: 'T', sections: [{ key: 'insured', heading: 'Insured', text: 'B' }], clauses: [{ clauseId: 2, code: 'Y', title: 'Y', wording: 'two' }] });
    expect(d.changes).toEqual(['Section "Insured" changed', 'Clause Y Y added', 'Clause X X removed']);
  });
});

describe('clause library', () => {
  it('ships the Philippine market clauses and the templates', async () => {
    const r = await proc('get', '/bespoke/clauses?lob=FIRE');
    expect(r.status).toBe(200);
    const codes = r.body.data.map((c) => c.code);
    for (const c of ['PH-TYF-DED', 'PH-EQV-DED', 'PH-SRCC', 'PH-72HR', 'PH-SPRINKLER', 'PH-FEXT-WTY', 'GEN-CYBER-EXCL']) expect(codes).toContain(c);
    expect(codes).not.toContain('MAR-ICC-A');
    const marine = await proc('get', '/bespoke/clauses?lob=MARINE&clauseType=clause');
    expect(marine.body.data.map((c) => c.code)).toEqual(expect.arrayContaining(['MAR-ICC-A', 'MAR-ICC-B', 'MAR-ICC-C']));
    expect((await proc('get', '/bespoke/clauses/ENG-CAR-MAINT')).body.data.placeholders).toEqual(['maintenance_months']);
    const tpl = await proc('get', '/bespoke/slip-templates?lob=FIRE');
    expect(tpl.body.data.map((t) => t.code)).toContain('PROPERTY-STD');
    const opts = await ops('get', '/bespoke/clauses/options');
    expect(opts.body.data.clauseTypes).toContain('subjectivity');
    expect(opts.body.data.sections.map((s) => s.key)).toEqual(['insured', 'period', 'situation', 'interest', 'sum_insured', 'limits', 'deductibles', 'premium', 'conditions', 'subjectivities']);
  });

  it('adds a clause and versions its wording with effective dates', async () => {
    const bad = await proc('post', '/bespoke/clauses').send({ code: 'T-FLOOD', title: 'Flood sub-limit', clauseType: 'rider', wording: 'Flood limited to {currency} {flood_limit}.' });
    expect(bad.status).toBe(400);
    const c = await proc('post', '/bespoke/clauses').send({ code: 'T-FLOOD', title: 'Flood sub-limit', clauseType: 'condition', linesOfBusiness: 'fire, iar', wording: 'Flood limited to {currency} {flood_limit}.', effectiveFrom: '2026-01-01' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ code: 'T-FLOOD', linesOfBusiness: ['FIRE', 'IAR'], currentVersion: 1, placeholders: ['currency', 'flood_limit'] });
    expect((await proc('post', '/bespoke/clauses').send({ code: 't-flood', title: 'Again', clauseType: 'condition', wording: 'Some wording' })).status).toBe(409);
    const early = await proc('put', '/bespoke/clauses/T-FLOOD').send({ wording: 'Too early', effectiveFrom: '2025-12-01' });
    expect(early.status).toBe(400);
    const v2 = await proc('put', '/bespoke/clauses/T-FLOOD').send({ wording: 'Flood limited to {currency} {flood_limit} in the annual aggregate.', effectiveFrom: '2026-06-01', changeNote: 'Aggregate' });
    expect(v2.status).toBe(200);
    expect(v2.body.data.currentVersion).toBe(2);
    const detail = await proc('get', '/bespoke/clauses/T-FLOOD');
    expect(detail.body.data.versions.map((v) => [v.version, v.effectiveFrom, v.effectiveTo])).toEqual([[2, '2026-06-01', null], [1, '2026-01-01', '2026-05-31']]);
    // the wording in force on a past date is the old one
    const past = await proc('get', '/bespoke/clauses?search=T-FLOOD&date=2026-03-01');
    expect(past.body.data[0].wording).toBe('Flood limited to {currency} {flood_limit}.');
    const [row] = (await pool.query("SELECT action FROM audit_log WHERE entity = 'clause' ORDER BY id DESC LIMIT 1")).rows;
    expect(row.action).toBe('new-version');
  });

  it('maintains slip templates', async () => {
    const t = await proc('post', '/bespoke/slip-templates').send({ code: 'T-CGL', name: 'Liability test slip', linesOfBusiness: ['CASUALTY'],
      sections: [{ key: 'insured', text: '{insured_name}' }, { heading: 'Territory', text: 'Philippines' }], clauseIds: ['GEN-CYBER-EXCL', 'T-FLOOD'] });
    expect(t.status).toBe(201);
    expect(t.body.data.sections.map((s) => [s.key, s.heading])).toEqual([['insured', 'Insured'], ['custom_2', 'Territory']]);
    expect(t.body.data.clauses.map((c) => c.code)).toEqual(['GEN-CYBER-EXCL', 'T-FLOOD']);
    const u = await proc('put', '/bespoke/slip-templates/T-CGL').send({ clauseIds: ['T-FLOOD'] });
    expect(u.body.data.clauses.map((c) => c.code)).toEqual(['T-FLOOD']);
  });

  it('only the Processing Team (and the administrator) maintains the library', async () => {
    expect((await ops('post', '/bespoke/clauses').send({ code: 'T-X', title: 'Not allowed', clauseType: 'clause', wording: 'Some wording' })).status).toBe(403);
    expect((await acct('get', '/bespoke/clauses')).status).toBe(200);
    expect((await sales('get', '/bespoke/clauses')).status).toBe(403);
  });
});

describe('slip composer', () => {
  let slipId;
  let composed;
  beforeAll(async () => {
    const r = await proc('post', '/broker-slips').send({ prospect: { companyName: 'Mandaue Cold Chain Corp.' }, productType: 'Fire and Allied Perils', insuredName: 'Mandaue Cold Chain Corp.', riskDetails: { location: 'Mandaue City, Cebu' },
      requestedCovers: [{ cover: 'Fire and lightning', sumInsured: 85000000 }], insurers: ['MALAYAN', 'PIONEER'], inceptionDate: '2026-10-01', expiryDate: '2027-10-01' });
    expect(r.status).toBe(201);
    slipId = r.body.id;
  });

  it('starts from a template with the derived placeholder values', async () => {
    const r = await proc('post', '/bespoke/slips').send({ brokerSlipId: slipId, templateId: 'PROPERTY-STD', variables: { deductible_percent: '2' } });
    expect(r.status).toBe(201);
    composed = r.body.data;
    expect(composed.slipNumber).toMatch(/^CSL-\d{4}-\d{5}$/);
    expect(composed.version).toBe(1);
    expect(composed.clauses.map((c) => c.code).slice(0, 3)).toEqual(['PH-TYF-DED', 'PH-EQV-DED', 'PH-72HR']);
    expect(composed.sections.find((s) => s.key === 'insured').rendered).toBe('Mandaue Cold Chain Corp.');
    expect(composed.sections.find((s) => s.key === 'sum_insured').rendered).toBe('PHP 85,000,000.00 as per the statement of values');
    expect(composed.clauses[0].rendered).toContain('2% of the sum insured');
    expect(composed.missingPlaceholders).toContain('deductible_amount');
    expect(composed.versions[0]).toMatchObject({ version: 1, changes: ['Created from template PROPERTY-STD'], changedBy: 'b.proc' });
    const blank = await ops('post', '/bespoke/slips').send({ brokerSlipId: slipId, title: 'Blank draft' });
    expect(blank.body.data.sections).toHaveLength(10);
    expect(blank.body.data.clauses).toEqual([]);
  });

  it('adds, removes, reorders and rewords clauses (manuscript keeps the library reference) and versions each save', async () => {
    const add = await proc('get', '/bespoke/slips/library-clause/PH-SPRINKLER');
    expect(add.body.data).toMatchObject({ code: 'PH-SPRINKLER', clauseVersion: 1 });
    const list = composed.clauses.filter((c) => c.code !== 'GEN-SURVEY-SUBJ').map((c) => ({ clauseId: c.clauseId, clauseVersion: c.clauseVersion }));
    list.reverse();
    list[0] = { ...list[0], wording: 'Premium to be paid within 60 days of inception.' };
    list.push({ clauseId: add.body.data.clauseId }, { title: 'Hot works permit', clauseType: 'warranty', wording: 'Warranted that hot works are done under a written permit system.' });
    const r = await proc('put', `/bespoke/slips/${composed.id}`).send({ clauses: list, variables: { deductible_percent: '2', deductible_amount: '250,000.00', premium: 'to be quoted' }, changeNote: 'Lead underwriter comments' });
    expect(r.status).toBe(200);
    expect(r.body.data.version).toBe(2);
    expect(r.body.changes).toEqual(expect.arrayContaining(['Value of {deductible_amount} changed from "" to "250,000.00"', 'Wording of GEN-PREM-WTY Premium payment warranty changed (manuscript)',
      'Clause PH-SPRINKLER Sprinkler leakage added', 'Clause Hot works permit added', 'Clauses reordered', 'Clause GEN-SURVEY-SUBJ Subject to satisfactory risk survey removed']));
    const prem = r.body.data.clauses.find((c) => c.code === 'GEN-PREM-WTY');
    expect(prem).toMatchObject({ position: 1, manuscript: true, clauseVersion: 1 });
    expect(prem.libraryWording).toContain('Insurance Code');
    expect(r.body.data.clauses.find((c) => c.title === 'Hot works permit')).toMatchObject({ clauseId: null, manuscript: true });
    expect(r.body.data.missingPlaceholders).toEqual([]);
    const same = await proc('put', `/bespoke/slips/${composed.id}`).send({ clauses: r.body.data.clauses.map((c) => ({ clauseId: c.clauseId, clauseVersion: c.clauseVersion, title: c.title, clauseType: c.clauseType, wording: c.wording })) });
    expect(same.body.message).toBe('No changes to save');
    expect(same.body.data.version).toBe(2);
  });

  it('diffs versions word by word and keeps who changed what', async () => {
    const d = await proc('get', `/bespoke/slips/${composed.id}/diff?from=1&to=2`);
    expect(d.status).toBe(200);
    const prem = d.body.data.clauses.find((c) => c.label.startsWith('GEN-PREM-WTY'));
    expect(prem.change).toBe('changed');
    expect(prem.diff.some((p) => p.op === 'insert' && p.text.includes('60'))).toBe(true);
    expect(d.body.data.to).toMatchObject({ version: 2, changedBy: 'b.proc' });
    const v1 = await proc('get', `/bespoke/slips/${composed.id}/versions/1`);
    expect(v1.body.data.snapshot.clauses).toHaveLength(8);
  });

  it('finalises (no edits), reopens, and refuses an unknown clause', async () => {
    expect((await proc('post', `/bespoke/slips/${composed.id}/finalise`).send({})).body.data.status).toBe('final');
    expect((await proc('put', `/bespoke/slips/${composed.id}`).send({ title: 'Changed' })).status).toBe(409);
    const re = await proc('post', `/bespoke/slips/${composed.id}/reopen`).send({ note: 'Insurer asked for a change' });
    expect(re.body.data).toMatchObject({ status: 'draft', version: 4 });
    const bad = await proc('put', `/bespoke/slips/${composed.id}`).send({ clauses: [{ clauseId: 999999 }] });
    expect(bad.status).toBe(400);
    const r = await proc('post', `/bespoke/slips/${composed.id}/finalise`).send({});
    expect(r.body.data.versions[0].changes).toEqual(['Status changed from "draft" to "final"']);
  });

  it('prints the composed slip and adds the wording to the broker slip print', async () => {
    const pdf = await pdfText(proc('get', `/bespoke/slips/${composed.id}/pdf`));
    expect(pdf.status).toBe(200);
    expect(pdf.type).toContain('application/pdf');
    expect(pdf.text).toContain('Warranties');
    expect(pdf.text).toContain('Hot works permit');
    const bs = await pdfText(proc('get', `/broker-slips/${slipId}/documents/broker-slip`));
    expect(bs.text).toContain('Sprinkler leakage');
    expect(bs.text).toContain('Deductibles');
  });

  it('lists slips of a broker slip and limits access by role', async () => {
    const l = await ops('get', `/bespoke/slips?brokerSlipId=${slipId}`);
    expect(l.body.data.length).toBe(2);
    expect((await acct('put', `/bespoke/slips/${composed.id}`).send({ title: 'x' })).status).toBe(403);
    expect((await sales('get', `/bespoke/slips/${composed.id}`)).status).toBe(403);
  });
});
