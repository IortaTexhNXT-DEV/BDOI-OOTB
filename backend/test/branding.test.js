import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { clearLetterheadCache, getLetterhead } from '../src/lib/letterhead.js';
import { signFileQuery } from '../src/lib/secrets.js';
import { buildPdf, buildReportPdf, printContext, renderPdf } from '../src/lib/pdf/index.js';
import { rgb } from '../src/lib/pdf/writer.js';
import { readZip } from '../src/modules/documents/xlsx.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { contrastRatio } from '../src/modules/branding/contrast.js';
import { validateTheme, resolveTheme, documentBranding, fillLine, assertSafeSvg, emailLayout } from '../src/modules/branding/service.js';
import { DEFAULT_THEME, PRESETS, googleFontUrl } from '../src/modules/branding/presets.js';
import { samplePdf } from '../src/modules/branding/sample.js';
import {
  quoteDoc, brokerSlipDoc, placementSlipDoc, policyScheduleDoc, placingSlipDoc, receiptDoc, acknowledgementReceiptDoc, commissionDebitNoteDoc, endorsementDoc,
} from '../src/modules/documents/templates.js';
import { billingStatementDoc, voucherDoc, journalVoucherDoc } from '../src/modules/documents/finance.js';
import { claimDocSpec } from '../src/modules/claims/service.js';
import { documentState, effectiveSignature, signatureSection, renderSignatureBlock } from '../src/modules/e-signatures/service.js';
import { buildMessage } from '../src/lib/mailer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIS = path.join(ROOT, '..', 'docs', 'package', '04_Onboarding_and_Go_Live', 'Brand_Packs', 'toyota-insurance-services');

// ---------- a small RGBA PNG (a "signature": dark strokes on transparent) ----------
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(width, height, shade = 20) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const on = Math.abs(y - Math.round(height / 2 + Math.sin(x / 5) * (height / 4))) < 2;
      row.set([shade, shade, shade + 40, on ? 255 : 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

/** "r g b rg" fill operator of a colour as the PDF writer prints it. */
const n2 = (v) => (Math.round(v * 100) / 100).toString();
const fillOp = (hex) => `${rgb(hex).map(n2).join(' ')} rg`;
const pdfText = (buf) => buf.toString('latin1');
const imageCount = (buf) => (pdfText(buf).match(/\/Subtype \/Image/g) || []).length;
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });

let ctx;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: `${username} name`, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  await makeUser('br.ae', ['sales']);
  await makeUser('br.ae2', ['sales']);
  await makeUser('br.acctmgr', ['accounting-manager']);
  await query("UPDATE users SET designation = 'Accounting Manager' WHERE id = $1", [ids['br.acctmgr']]);
});
afterAll(async () => { await pool.end(); });

describe('theme validation', () => {
  it('keeps the compiled BDOI theme as the default preset, and every preset passes WCAG AA', () => {
    expect(resolveTheme(null).colors.primary).toBe('#0072d8');
    expect(resolveTheme({}).preset).toBe('iorta-technxt');
    for (const p of Object.values(PRESETS)) expect(validateTheme(p).errors).toEqual([]);
    // never saved: the System Settings colours of earlier releases still apply
    expect(resolveTheme(null, { primary: '#123456' }).colors.buttonBg).toBe('#123456');
  });

  it('refuses unknown fonts, bad colours, external images and failing contrast; warns on the rest', () => {
    const bad = validateTheme({ font: 'comic-sans', colors: { primary: 'red', nope: '#000000' }, login: { panelImageUrl: 'https://tracker.example.com/x.png' }, radius: { sm: 99 } });
    const paths = bad.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['font', 'colors.primary', 'colors.nope', 'login.panelImageUrl', 'radius.sm']));
    const contrast = validateTheme({ colors: { headerBg: '#ffffff', headerText: '#f0f0f0' } });
    expect(contrast.errors.map((e) => e.path)).toContain('contrast.headerText');
    const tableHead = validateTheme({ colors: { tableHeaderBg: '#ffff00', tableHeaderText: '#ffffff' } });
    expect(tableHead.errors.map((e) => e.path)).toContain('contrast.tableHeaderText');
    const warn = validateTheme({ colors: { sidebarBg: '#ffffff', sidebarText: '#aaaaaa' } });
    expect(warn.errors).toEqual([]);
    expect(warn.warnings.map((w) => w.path)).toContain('contrast.sidebarText');
    expect(validateTheme({ documents: { footerText: '<script>' } }).errors.map((e) => e.path)).toContain('documents.footerText');
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
  });

  it('builds Google Font links only for fonts of the list, only from fonts.googleapis.com', () => {
    expect(googleFontUrl('roboto')).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Roboto:/);
    expect(googleFontUrl('nunito')).toBeNull();
    expect(googleFontUrl('https://evil.example/font.css')).toBeNull();
  });

  it('refuses SVG images with scripts, event handlers or external references', () => {
    expect(() => assertSafeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'))).not.toThrow();
    for (const s of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><image href="https://x.example/a.png"/></svg>', '<svg><foreignObject/></svg>']) {
      expect(() => assertSafeSvg(Buffer.from(s))).toThrow();
    }
  });

  it('fills the footer line from the primary company, and leaves out a licence line without a licence', () => {
    expect(fillLine('Licence No. {{licence}}', { licence: '' })).toBe('');
    expect(fillLine('Licence No. {{licence}}', { licence: 'IC-123' })).toBe('Licence No. IC-123');
    expect(fillLine('{{companyName}} | {{address}}', { name: 'ABC', addressLines: [] })).toBe('ABC');
  });
});

describe('public branding endpoint and theme editor', () => {
  it('serves the branding before sign-in with an ETag (304 when unchanged), and a saved theme changes it', async () => {
    const r1 = await request(ctx.app).get('/api/branding');
    expect(r1.status).toBe(200);
    expect(r1.body.data.theme.preset).toBe('iorta-technxt');
    expect(r1.body.data.theme.login.libraryUrl).toBe('/brand/login-panel.svg');
    const etag = r1.headers.etag;
    expect(etag).toBeTruthy();
    expect((await request(ctx.app).get('/api/branding').set('If-None-Match', etag)).status).toBe(304);

    // refused: header text that fails AA; nothing changes
    const refused = await ctx.api('put', '/branding/theme').send({ theme: { preset: 'custom', colors: { headerBg: '#ffffff', headerText: '#eeeeee' } } });
    expect(refused.status).toBe(400);
    expect(refused.body.errors?.map((e) => e.path) || refused.body.details?.map((e) => e.path)).toContain('contrast.headerText');

    const saved = await ctx.api('put', '/branding/theme').send({ theme: { ...PRESETS.teal, login: { ...PRESETS.teal.login, headline: 'Hello brokers' } }, systemName: 'Teal Broker' });
    expect(saved.status).toBe(200);
    const r2 = await request(ctx.app).get('/api/branding').set('If-None-Match', etag);
    expect(r2.status).toBe(200);
    expect(r2.headers.etag).not.toBe(etag);
    expect(r2.body.data.theme.colors.primary).toBe('#0f766e');
    expect(r2.body.data.theme.login.headline).toBe('Hello brokers');
    expect(r2.body.data.systemName).toBe('Teal Broker');
    // the generic configuration endpoint cannot change it (owned by System Settings)
    expect((await ctx.api('put', '/system-settings/configuration').send({ settings: { 'branding.theme': {} } })).status).toBe(400);
    const audit = await one("SELECT action FROM audit_log WHERE entity = 'branding' AND entity_id = 'theme' ORDER BY id DESC LIMIT 1");
    expect(audit.action).toBe('update');
    // the editor and the sample document
    const ed = await ctx.api('get', '/branding/theme');
    expect(ed.body.data.presets.map((p) => p.key)).toEqual(['iorta-technxt', 'classic-blue', 'corporate-grey', 'teal']);
    expect(ed.body.data.loginLibrary.length).toBeGreaterThanOrEqual(4);
    const sample = await binary(ctx.api('post', '/branding/preview-document').send({ theme: PRESETS['classic-blue'] }));
    expect(sample.status).toBe(200);
    expect(pdfText(sample.body)).toContain(fillOp('#1e3a8a'));
    const mail = await ctx.api('post', '/branding/preview-email').send({ theme: PRESETS['corporate-grey'] });
    expect(mail.body.data.html).toContain('background:#1f2937');
    // only administrators of settings may save
    expect((await as('br.ae', 'put', '/branding/theme').send({ theme: PRESETS.teal })).status).toBe(403);
    await ctx.api('put', '/branding/theme').send({ theme: DEFAULT_THEME, systemName: 'BrokerVerse' });
  });

  it('serves an uploaded sign-in picture publicly, and refuses unsafe or oversize uploads', async () => {
    const up = await ctx.api('post', '/branding/upload/login-panel').attach('file', png(64, 40), 'panel.png');
    expect(up.status).toBe(200);
    expect(up.body.data.theme.login.panel).toBe('image');
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    const url = new URL(pub.theme.login.panelImageUrl);
    expect(url.pathname).toBe('/api/branding/assets/login-panel');
    const img = await request(ctx.app).get(`${url.pathname}${url.search}`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toContain('image/png');
    const svg = await ctx.api('post', '/branding/upload/login-panel').attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>'), 'evil.svg');
    expect(svg.status).toBe(400);
    expect((await ctx.api('post', '/branding/upload/favicon').attach('file', Buffer.alloc(600 * 1024, 1), 'big.png')).status).toBe(400);
    expect((await ctx.api('delete', '/branding/upload/login-panel')).body.data.theme.login.panel).toBe('library');
  });
});

describe('branding on every printed document and report', () => {
  const ACCENT = '#123456';
  const HEADING = '#5a1020';
  const TH = '#204060';
  let h;
  beforeAll(async () => {
    const r = await ctx.api('put', '/branding/theme').send({ theme: { preset: 'custom', documents: { accentColor: ACCENT, headingColor: HEADING, tableHeaderBg: TH, footerText: 'BRANDTEST footer line', reportFooterText: 'BRANDTEST report line' } } });
    expect(r.status).toBe(200);
    clearLetterheadCache();
    h = await printContext();
  });

  const builders = () => [
    ['quotation', () => quoteDoc({ quotationNumber: 'Q-1', quotationStatus: 'PendingCustomer', lob: 'MOTOR', createdAt: '2026-10-01', netPremium: 1000, grossPremium: 1000, currency: 'PHP' })],
    ['broker slip', () => brokerSlipDoc({ slipNumber: 'BS-1', insuredName: 'Juan', productType: 'Fire', requestedCovers: [{ cover: 'Fire', sumInsured: 1000 }] })],
    ['placement slip', () => placementSlipDoc({ placementNumber: 'PL-1', insuredName: 'Juan', participants: [] })],
    ['policy schedule', () => policyScheduleDoc({ policyNumber: 'P-1', status: 'Active', issuedDate: '2026-10-01', netPremium: 1000, premiumTotal: 1000, lob: 'MOTOR' })],
    ['placing slip', () => placingSlipDoc({ policyNumber: 'P-1', insuranceCompanyName: 'Insurer', netPremium: 1000, premiumTotal: 1000 })],
    ['official receipt', () => receiptDoc({ receipt_number: 'OR-1', amount: 100, received_date: '2026-10-01', receipt_status: 'Posted' }, [])],
    ['acknowledgement receipt', () => acknowledgementReceiptDoc({ arNumber: 'AR-1', amount: 100, status: 'confirmed', paymentDate: '2026-10-01' })],
    ['debit note', () => commissionDebitNoteDoc({ dnNumber: 'DN-1', statusCode: 'open', commission: 10, vat: 1.2, amount: 11.2, netPayable: 11, currency: 'PHP' }, [])],
    ['billing statement', () => billingStatementDoc('Policy', { policy: { policy_number: 'P-1', premium_total: 100, client_name: 'Juan' }, bills: [{ bill_number: 'B-1', amount: 100, balance: 100, status: 'open', created_at: '2026-10-01', due_date: '2026-10-31' }] })],
    ['payment voucher', () => voucherDoc({ voucher_number: 'PV-1', status: 'Approved', amount: 100, gross_amount: 100, voucher_date: '2026-10-01' }, {})],
    ['journal voucher', () => journalVoucherDoc({ transactionNumber: 'JV-1', status: 'posted', voucherDate: '2026-10-01', entries: [{ accountCode: '1001', accountName: 'Cash', debit: 10, credit: 0 }, { accountCode: '2001', accountName: 'Payable', debit: 0, credit: 10 }] }, {})],
    ['endorsement', () => endorsementDoc({ endorsementNumber: 'E-1', status: 'Completed', policyNumber: 'P-1', premiumDelta: 0 }, { status: 'completed', changes: { personalDetails: { mobile: '0917' } } })],
    ['claim letter', async () => ({ ...h, ...claimDocSpec('Claim Settlement Letter', ['Claim CL-1 approved.', 'Insured: Juan'], { claimNumber: 'CL-1' }, h) })],
    ['report', async () => ({ report: true })],
  ];

  it('every document and the report PDF print the logo, the theme colours and the footer line', async () => {
    for (const [name, build] of builders()) {
      const spec = await build();
      const buf = spec.report
        ? buildReportPdf({ ...h, title: 'Production Register', params: 'Period', columns: [{ key: 'a', label: 'Policy' }, { key: 'b', label: 'Premium', type: 'money' }], rows: [{ a: 'P-1', b: 10 }] })
        : buildPdf(spec);
      const t = pdfText(buf);
      expect(t, name).toContain(fillOp(ACCENT)); // the rule under the letterhead
      expect(t, name).toContain(fillOp(HEADING)); // the title
      expect(t, name).toContain('(BRANDTEST footer line) Tj');
      expect(imageCount(buf), name).toBeGreaterThanOrEqual(1); // the letterhead logo
      if (!['endorsement', 'claim letter'].includes(name)) expect(t, name).toContain(fillOp(TH)); // a table header
    }
  });

  it('the printed documents of the modules do not bypass the branding (every PDF goes through printContext)', () => {
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name))));
    walk(path.join(ROOT, 'src', 'modules'));
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      if (/new (PdfWriter|DocRenderer)\(/.test(src)) offenders.push(`${f}: builds a PDF without the document engine`);
      for (const m of src.matchAll(/\bbuildPdf(?:Batch)?\(\s*([^)]{0,60})/g)) {
        const arg = m[1];
        // allowed: a *Doc spec (header() = printContext), a spec spread over a print context, or specs of *Doc functions
        if (!/^(await \w+Doc\(|\{\s*\.\.\.(ctx|h|print|shared)|spec\b|specs\b|list\b)/.test(arg)) offenders.push(`${path.relative(ROOT, f)}: buildPdf(${arg}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('report Excel files take the header colours of the theme, and the logo and banner when the theme asks', async () => {
    const lh = await getLetterhead();
    const buf = writeXlsx({ sheets: [{ name: 'R', columns: [{ header: 'A' }], rows: [['x']], banner: ['Company', 'TIN 1'], logo: true }], brand: { headerBg: '#204060', headerText: '#ffffff', logoImage: { buffer: lh.logo.buffer, type: 'png', width: 100, height: 40 } } });
    const z = readZip(buf);
    expect(z.get('xl/styles.xml')).toContain('FF204060');
    expect(z.names).toContain('xl/media/logo.png');
    expect(z.get('xl/worksheets/sheet1.xml')).toContain('<pane ySplit="5"');
    expect(z.get('xl/worksheets/sheet1.xml')).toContain('<drawing r:id="rIdLogo"/>');
    const plain = readZip(writeXlsx({ sheets: [{ name: 'R', columns: [{ header: 'A' }], rows: [['x']] }] }));
    expect(plain.get('xl/worksheets/sheet1.xml')).toContain('<pane ySplit="1"');
    expect(plain.get('xl/styles.xml')).toContain('FF1F4E78');
  });

  it('e-mails are sent in the e-mail layout of the theme', async () => {
    const msg = await buildMessage({ to_address: 'a@example.ph', subject: 'x', body_html: '<p>Body</p>', attachments: [] });
    expect(msg.html).toContain('data-bv-layout');
    expect(msg.html).toContain('<p>Body</p>');
    const off = await emailLayout('<p>B</p>', { theme: { ...DEFAULT_THEME, email: { ...DEFAULT_THEME.email, enabled: false } } });
    expect(off.html).toBe('<p>B</p>');
  });

  it('the sample document of the theme editor uses the unsaved theme', async () => {
    const buf = await samplePdf(resolveTheme(PRESETS.teal));
    expect(pdfText(buf)).toContain(fillOp('#0f766e'));
    const b = await documentBranding(null, resolveTheme(PRESETS.teal));
    expect(b.tableHeaderBg).toBe('#0f766e');
  });

  afterAll(async () => { await ctx.api('put', '/branding/theme').send({ theme: DEFAULT_THEME }); });
});

describe('e-signatures', () => {
  let signatoryId;
  let firstSig;
  beforeAll(async () => {
    signatoryId = (await one("INSERT INTO signatories(name, designation) VALUES ('Brand Test Signer', 'President') RETURNING id")).id;
    await query("UPDATE app_settings SET value = '\"Brand Test Signer\"' WHERE key = 'documents.default_signatory'");
    clearSettingsCache();
  });

  it('captures a drawn signature only with consent and a printable image; versions replace each other', async () => {
    expect((await ctx.api('post', '/e-signatures').send({ ownerType: 'signatory', ownerId: signatoryId, imageData: dataUrl(png(120, 40)) })).status).toBe(400);
    expect((await ctx.api('post', '/e-signatures').send({ ownerType: 'signatory', ownerId: signatoryId, imageData: 'data:image/png;base64,AAAA', consent: true })).status).toBe(400);
    const c = await ctx.api('get', `/e-signatures/consent?ownerType=signatory&ownerId=${signatoryId}`);
    expect(c.body.data.text).toContain('Brand Test Signer');
    const r1 = await ctx.api('post', '/e-signatures').send({ ownerType: 'signatory', ownerId: signatoryId, imageData: dataUrl(png(120, 40, 10)), consent: true, effectiveFrom: '2026-01-01' });
    expect(r1.status).toBe(201);
    expect(r1.body.data).toMatchObject({ version: 1, method: 'drawn', status: 'active' });
    firstSig = r1.body.data;
    // a second version effective 2026-07-01: the first one ends on 2026-06-30
    const r2 = await ctx.api('post', '/e-signatures').attach('file', png(150, 50, 60), 'sig.png').field('ownerType', 'signatory').field('ownerId', String(signatoryId))
      .field('consent', 'true').field('effectiveFrom', '2026-07-01');
    expect(r2.status).toBe(201);
    expect(r2.body.data).toMatchObject({ version: 2, method: 'uploaded' });
    const list = (await ctx.api('get', `/e-signatures?ownerType=signatory&ownerId=${signatoryId}`)).body.data;
    expect(list.map((s) => [s.version, s.status, s.effectiveTo])).toEqual([[2, 'active', null], [1, 'replaced', '2026-06-30']]);
    const old = await effectiveSignature('signatory', signatoryId, '2026-03-01');
    const now = await effectiveSignature('signatory', signatoryId, '2026-09-01');
    expect(old.buffer.equals(now.buffer)).toBe(false);
  });

  it('prints the signature on issued documents only; drafts carry the UNSIGNED DRAFT watermark', async () => {
    const q = { quotationNumber: 'Q-9', lob: 'MOTOR', createdAt: '2026-09-01', netPremium: 1000, grossPremium: 1000 };
    const draft = await quoteDoc({ ...q, quotationStatus: 'Draft' });
    expect(draft.watermark).toBe('UNSIGNED DRAFT');
    const draftBlock = draft.sections.find((s) => s?.signatures).signatures[0];
    expect(draftBlock).toMatchObject({ name: 'Brand Test Signer', image: null });
    const issued = await quoteDoc({ ...q, quotationStatus: 'PendingCustomer' });
    expect(issued.watermark).toBeUndefined();
    const block = issued.sections.find((s) => s?.signatures).signatures[0];
    expect(block.image?.buffer?.length).toBeGreaterThan(0);
    expect(block).toMatchObject({ name: 'Brand Test Signer', title: 'President' });
    expect(block.date).toMatch(/^Date: /);
    const dPdf = buildPdf(draft);
    const iPdf = buildPdf(issued);
    expect(pdfText(dPdf)).toContain('(UNSIGNED DRAFT) Tj');
    expect(pdfText(iPdf)).not.toContain('UNSIGNED DRAFT');
    expect(imageCount(iPdf)).toBeGreaterThan(imageCount(dPdf)); // the signature (and its transparency mask)
    // policy schedule, official receipt, endorsement, debit note and billing statement print the default signatory once issued
    for (const spec of [
      await policyScheduleDoc({ policyNumber: 'P-9', status: 'Active', issuedDate: '2026-09-01' }),
      await receiptDoc({ receipt_number: 'OR-9', amount: 1, received_date: '2026-09-01', receipt_status: 'Posted' }, []),
      await endorsementDoc({ endorsementNumber: 'E-9', status: 'Completed', completedAt: '2026-09-01' }, { status: 'completed', changes: {} }),
      await commissionDebitNoteDoc({ dnNumber: 'DN-9', statusCode: 'open', dnDate: '2026-09-01' }, []),
      await billingStatementDoc('Policy', { policy: { policy_number: 'P-9', premium_total: 1 }, bills: [] }),
    ]) {
      const blocks = spec.sections.filter(Boolean).flatMap((s) => s.signatures || []);
      expect(blocks.some((b) => b.image), spec.title).toBe(true);
    }
    const cancelled = await receiptDoc({ receipt_number: 'OR-10', amount: 1, received_date: '2026-09-01', receipt_status: 'Cancelled' }, []);
    expect(cancelled.watermark).toBe('CANCELLED');
    expect(documentState('payment-voucher', 'Pending')).toBe('draft');
    expect(documentState('payment-voucher', 'Approved')).toBe('approved');
  });

  it('a user signs their own signature; the approving user signs the payment voucher once approved', async () => {
    // an administrator cannot capture another user's signature
    expect((await ctx.api('post', '/e-signatures').send({ ownerType: 'user', ownerId: ids['br.acctmgr'], imageData: dataUrl(png(100, 30)), consent: true })).status).toBe(403);
    const own = await as('br.acctmgr', 'post', '/e-signatures').send({ ownerType: 'user', imageData: dataUrl(png(100, 30, 90)), consent: true, effectiveFrom: '2026-01-01' });
    expect(own.status).toBe(201);
    const pending = await voucherDoc({ voucher_number: 'PV-9', status: 'Pending', amount: 1, voucher_date: '2026-09-01', approved_by: ids['br.acctmgr'] }, {});
    expect(pending.watermark).toBe('UNSIGNED DRAFT');
    const approved = await voucherDoc({ voucher_number: 'PV-9', status: 'Approved', amount: 1, voucher_date: '2026-09-01', approved_by: ids['br.acctmgr'] }, {});
    const blocks = approved.sections.filter(Boolean).find((s) => s.signatures).signatures;
    expect(blocks.map((b) => b.label)).toEqual(['Prepared by', 'Checked by', 'Approved by', 'Received by']);
    expect(blocks[2]).toMatchObject({ name: 'br.acctmgr name', title: 'Accounting Manager' });
    expect(blocks[2].image).toBeTruthy();
    expect(blocks[1].image).toBeFalsy();
    // the {{signature:slot}} placeholder helper of uploaded templates
    const b = await renderSignatureBlock('payment-voucher', 'approved-by', { status: 'Approved', approvedBy: ids['br.acctmgr'], date: '2026-09-01' });
    expect(b).toMatchObject({ signed: true, name: 'br.acctmgr name' });
  });

  it('keeps signature images out of the file links and shows them only to authorised users; every event is audited', async () => {
    const row = await one('SELECT storage_key FROM e_signatures WHERE id = $1', [firstSig.id]);
    expect((await ctx.api('get', `/s3/object/${row.storage_key}`)).status).toBe(403);
    expect((await request(ctx.app).get(`/api/s3/object/${row.storage_key}?${signFileQuery(row.storage_key)}`)).status).toBe(403);
    expect((await ctx.api('delete', `/s3/file/${row.storage_key}`)).status).toBe(403);
    const img = await binary(ctx.api('get', `/e-signatures/${firstSig.id}/image`));
    expect(img.status).toBe(200);
    expect(img.headers['cache-control']).toBe('no-store');
    expect((await as('br.ae', 'get', `/e-signatures/${firstSig.id}/image`)).status).toBe(403);
    const mine = await one("SELECT id FROM e_signatures WHERE owner_type = 'user' AND owner_id = $1", [ids['br.acctmgr']]);
    expect((await as('br.acctmgr', 'get', `/e-signatures/${mine.id}/image`)).status).toBe(200);
    expect((await as('br.ae2', 'get', `/e-signatures/${mine.id}/image`)).status).toBe(403);
    expect((await as('br.ae2', 'get', `/e-signatures?ownerType=user&ownerId=${ids['br.acctmgr']}`)).status).toBe(403);
    // revoke: reason required, then it never prints again
    expect((await ctx.api('post', `/e-signatures/${mine.id}/revoke`).send({})).status).toBe(400);
    expect((await ctx.api('post', `/e-signatures/${mine.id}/revoke`).send({ reason: 'Left the company' })).body.data.status).toBe('revoked');
    const after = await voucherDoc({ voucher_number: 'PV-9', status: 'Approved', amount: 1, voucher_date: '2026-09-01', approved_by: ids['br.acctmgr'] }, {});
    expect(after.sections.filter(Boolean).find((s) => s.signatures).signatures[2].image).toBeFalsy();
    const actions = (await query("SELECT action FROM audit_log WHERE entity = 'e-signature' ORDER BY id")).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['capture', 'replace', 'revoke']));
    const cap = await one("SELECT after_data FROM audit_log WHERE entity = 'e-signature' AND action = 'capture' ORDER BY id LIMIT 1");
    expect(cap.after_data.consentText).toContain('Brand Test Signer');
    expect(JSON.stringify(cap.after_data)).not.toContain('base64');
  });

  it('maps signatures to documents through the slot configuration', async () => {
    const cfg = (await ctx.api('get', '/e-signatures/slots')).body.data;
    expect(cfg.documentTypes.map((d) => d.key)).toEqual(expect.arrayContaining(['quotation', 'policy-schedule', 'official-receipt', 'payment-voucher', 'debit-note', 'endorsement', 'claim-settlement-letter']));
    expect(cfg.placeholder).toBe('{{signature:<slot>}}');
    const bad = await ctx.api('put', '/e-signatures/slots').send({ slots: [{ documentType: 'official-receipt', slot: 'x', label: 'X', source: 'the-boss' }] });
    expect(bad.status).toBe(400);
    // the receipt prints a second, named signatory ("Noted by") once mapped
    const named = (await one("INSERT INTO signatories(name, designation) VALUES ('Noted Signer', 'Treasurer') RETURNING id")).id;
    const save = await ctx.api('put', '/e-signatures/slots').send({ slots: [
      { documentType: 'official-receipt', slot: 'authorized', label: 'Authorized signature', source: 'default-signatory', condition: 'issued' },
      { documentType: 'official-receipt', slot: 'noted-by', label: 'Noted by', source: 'named-signatory', signatoryId: named, condition: 'always' },
    ] });
    expect(save.status).toBe(200);
    const s = await signatureSection('official-receipt', { status: 'Draft', date: '2026-09-01' });
    expect(s.section.signatures.map((b) => b.label)).toEqual(['Authorized signature', 'Noted by']);
    expect(s.section.signatures[1].name).toBe('Noted Signer');
    expect(s.watermark).toBe('UNSIGNED DRAFT');
  });
});

describe('brand packs', () => {
  it('exports and imports a brand pack (zip and JSON), dry run first', async () => {
    await ctx.api('put', '/branding/theme').send({ theme: { ...PRESETS['corporate-grey'], name: 'Grey Broker' } });
    const zip = await binary(ctx.api('get', '/branding/brand-pack?format=zip'));
    expect(zip.status).toBe(200);
    expect(zip.headers['content-type']).toContain('application/zip');
    const json = (await ctx.api('get', '/branding/brand-pack?format=json')).body;
    expect(json.format).toBe('brokerverse-brand-pack');
    expect(json.theme.name).toBe('Grey Broker');
    expect(Object.keys(json.files).length).toBeGreaterThanOrEqual(1);

    await ctx.api('put', '/branding/theme').send({ theme: PRESETS.teal });
    const dry = await ctx.api('post', '/branding/brand-pack?dryRun=true').attach('file', zip.body, 'grey.brandpack.zip');
    expect(dry.status).toBe(200);
    expect(dry.body.data.dryRun).toBe(true);
    expect((await ctx.api('get', '/branding/theme')).body.data.theme.preset).toBe('teal');
    const applied = await ctx.api('post', '/branding/brand-pack').attach('file', zip.body, 'grey.brandpack.zip');
    expect(applied.status).toBe(200);
    expect(applied.body.data.applied).toContain('theme');
    const t = (await ctx.api('get', '/branding/theme')).body.data.theme;
    expect(t).toMatchObject({ preset: 'corporate-grey', name: 'Grey Broker', layout: { sidebarStyle: 'dark' } });

    await ctx.api('put', '/branding/theme').send({ theme: PRESETS.teal });
    const viaJson = await ctx.api('post', '/branding/brand-pack').send(json);
    expect(viaJson.status).toBe(200);
    expect((await ctx.api('get', '/branding/theme')).body.data.theme.name).toBe('Grey Broker');
    const audit = await one("SELECT action FROM audit_log WHERE entity = 'branding' AND entity_id = 'brand-pack' ORDER BY id DESC LIMIT 1");
    expect(audit.action).toBe('import');

    // a pack whose theme fails AA is refused
    const badPack = { ...json, theme: { ...json.theme, colors: { ...json.theme.colors, buttonBg: '#ffffff', buttonText: '#ffffff' } } };
    expect((await ctx.api('post', '/branding/brand-pack').send(badPack)).status).toBe(400);
    expect((await ctx.api('post', '/branding/brand-pack').send({ hello: 'world' })).status).toBe(400);
  });

  it('applies the Toyota Insurance Services brand pack (optional client pack, not the default)', async () => {
    expect(DEFAULT_THEME.name).not.toMatch(/toyota/i);
    expect(Object.keys(PRESETS).some((k) => /toyota|tis/i.test(k))).toBe(false);
    const seed = fs.readFileSync(path.join(ROOT, 'src', 'db', 'seeds', 'settings.json'), 'utf8');
    expect(seed).not.toMatch(/toyota/i);
    const zipFile = fs.readFileSync(path.join(TIS, 'toyota-insurance-services.brandpack.zip'));
    const dry = await ctx.api('post', '/branding/brand-pack?dryRun=true').attach('file', zipFile, 'toyota-insurance-services.brandpack.zip');
    expect(dry.status).toBe(200);
    expect(dry.body.data).toMatchObject({ name: 'Toyota Insurance Services', warnings: [] });
    const r = await ctx.api('post', '/branding/brand-pack').attach('file', zipFile, 'toyota-insurance-services.brandpack.zip');
    expect(r.status).toBe(200);
    expect(r.body.data.applied).toEqual(expect.arrayContaining(['theme', 'logo', 'documentLogo', 'systemName']));
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.colors).toMatchObject({ primary: '#1a1a1a', accent: '#eb0a1e', headerBg: '#ffffff' });
    expect(pub.systemName).toBe('Toyota Insurance Services');
    const logo = new URL(pub.logoUrl);
    const img = await binary(request(ctx.app).get(`${logo.pathname}${logo.search}`));
    expect(img.body.equals(fs.readFileSync(path.join(TIS, 'logo.png')))).toBe(true);
    clearLetterheadCache();
    expect((await getLetterhead()).logo.buffer.equals(fs.readFileSync(path.join(TIS, 'logo.png')))).toBe(true);
    const pdf = await renderPdf({ title: 'Policy Schedule', number: 'P-T', sections: [{ heading: 'X', table: { columns: ['A'], rows: [['1']] } }] });
    expect(pdfText(pdf)).toContain(fillOp('#1a1a1a'));
    await ctx.api('put', '/branding/theme').send({ theme: DEFAULT_THEME, systemName: 'BrokerVerse' });
  });
});
