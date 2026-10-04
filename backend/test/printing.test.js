import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { decodePng, loadImage } from '../src/lib/pdf/image.js';
import { textWidth, toWinAnsi, wrapText } from '../src/lib/pdf/fonts.js';
import { prepareTable, allocateWidths } from '../src/lib/pdf/table.js';
import { amountInWords, formatDate, formatDateTime, humanize } from '../src/lib/pdf/format.js';
import { buildPdf, buildReportPdf, fitReport } from '../src/lib/pdf/index.js';
import { premiumLines, policyPremium, lineOf, riskSection, formatters } from '../src/modules/documents/templates.js';
import { claimDocSpec } from '../src/modules/claims/service.js';
import { getLetterhead, clearLetterheadCache, companyAddressLines } from '../src/lib/letterhead.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- a small PNG encoder (every filter type) to feed the decoder ----------
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
  return Buffer.concat([len, td, crc]);
};
const paeth = (a, b, c) => { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
/** rows: Buffer per scanline (already packed); filter type per row cycles 0..4. */
function png({ width, height, depth, colorType, rows, plte = null, trns = null }) {
  const bpp = Math.max(1, ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] * depth) >> 3);
  const out = [];
  rows.forEach((row, y) => {
    const f = y % 5;
    const prev = y ? rows[y - 1] : Buffer.alloc(row.length);
    const enc = Buffer.alloc(row.length);
    for (let x = 0; x < row.length; x += 1) {
      const a = x >= bpp ? row[x - bpp] : 0; const b = prev[x]; const c = x >= bpp ? prev[x - bpp] : 0;
      enc[x] = (row[x] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 0xff;
    }
    out.push(Buffer.from([f]), enc);
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = depth; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...(plte ? [chunk('PLTE', plte)] : []), ...(trns ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(out))), chunk('IEND', Buffer.alloc(0))]);
}

/** Every object offset in the xref table points at "n 0 obj". */
function assertValidXref(buf) {
  const s = buf.toString('latin1');
  expect(s.startsWith('%PDF-1.4')).toBe(true);
  const startxref = Number(/startxref\n(\d+)/.exec(s)[1]);
  expect(s.slice(startxref, startxref + 4)).toBe('xref');
  const offsets = [...s.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  offsets.forEach((o, i) => expect(s.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  return s;
}

describe('PNG decoding and embedding', () => {
  it('decodes an RGBA image through all five scanline filters and embeds it with a soft mask', () => {
    const width = 3;
    const height = 6;
    const px = (x, y) => [x * 80, y * 40, (x + y) * 20, 255 - y * 30];
    const rows = Array.from({ length: height }, (_, y) => Buffer.from(Array.from({ length: width }, (_, x) => px(x, y)).flat()));
    const img = decodePng(png({ width, height, depth: 8, colorType: 6, rows }));
    expect(img).toMatchObject({ width, height, colorSpace: 'DeviceRGB' });
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const k = y * width + x;
        const [r, g, b, a] = px(x, y);
        expect([img.pixels[k * 3], img.pixels[k * 3 + 1], img.pixels[k * 3 + 2], img.alpha[k]]).toEqual([r, g, b, a]);
      }
    }
    const pdf = buildPdf({ title: 'Logo test', letterhead: { name: 'Test Co.', addressLines: ['1 Street'], logo: { buffer: png({ width, height, depth: 8, colorType: 6, rows }) } }, sections: [{ text: 'x' }] });
    const s = assertValidXref(pdf);
    expect(s).toMatch(/\/Subtype \/Image \/Width 3 \/Height 6 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode \/SMask \d+ 0 R/);
    expect(s).toMatch(/\/ColorSpace \/DeviceGray \/BitsPerComponent 8 \/Filter \/FlateDecode/);
    expect(s).toContain('/Im1 Do');
  });
  it('decodes 4-bit palette images with tRNS transparency, and gray / gray + alpha', () => {
    const plte = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const rows = [Buffer.from([0x01, 0x20]), Buffer.from([0x21, 0x00])]; // 3 px per row at 4 bits: indices 0,1,2 / 2,1,0
    const img = decodePng(png({ width: 3, height: 2, depth: 4, colorType: 3, rows, plte, trns: Buffer.from([0, 255, 128]) }));
    expect([...img.pixels.subarray(0, 9)]).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    expect([...img.pixels.subarray(9, 18)]).toEqual([0, 0, 255, 0, 255, 0, 255, 0, 0]);
    expect([...img.alpha]).toEqual([0, 255, 128, 128, 255, 0]);
    const gray = decodePng(png({ width: 2, height: 1, depth: 8, colorType: 0, rows: [Buffer.from([10, 200])] }));
    expect(gray).toMatchObject({ colorSpace: 'DeviceGray', alpha: null });
    expect([...gray.pixels]).toEqual([10, 200]);
    const ga = decodePng(png({ width: 2, height: 1, depth: 8, colorType: 4, rows: [Buffer.from([10, 0, 200, 255])] }));
    expect([...ga.pixels]).toEqual([10, 200]);
    expect([...ga.alpha]).toEqual([0, 255]);
    // an opaque RGBA image needs no soft mask
    expect(decodePng(png({ width: 1, height: 1, depth: 8, colorType: 6, rows: [Buffer.from([1, 2, 3, 255])] })).alpha).toBeNull();
  });
  it('loads the shipped iorta TechNXT logo and ignores broken images', () => {
    const logo = loadImage(fs.readFileSync(path.join(ROOT, 'assets', 'iorta-technxt.png')));
    expect(logo).toMatchObject({ type: 'png', width: 604, height: 178, colorSpace: 'DeviceRGB' });
    expect(logo.alpha).not.toBeNull();
    expect(loadImage(Buffer.from('not an image'))).toBeNull();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
    expect(loadImage(jpeg)).toMatchObject({ type: 'jpeg', width: 64, height: 32, components: 3 });
  });
});

describe('text measuring and wrapping', () => {
  it('uses the Helvetica AFM widths', () => {
    expect(textWidth('Hello', 10)).toBeCloseTo(22.78, 2);
    expect(textWidth('Hello', 10, true)).toBeCloseTo(24.45, 2);
    expect(textWidth('1,234,567.89', 8)).toBeCloseTo(8 * (9 * 556 + 3 * 278) / 1000, 5);
  });
  it('maps Unicode punctuation to WinAnsi instead of "?"', () => {
    const t = toWinAnsi('A – B — ‘c’ “d” • e … ₱5 café ā');
    expect(t).toBe(`A \x96 B \x97 \x91c\x92 \x93d\x94 \x95 e \x85 PHP 5 café a`);
    expect(t).not.toContain('?');
    // converted text passes through again unchanged (no double conversion)
    expect(toWinAnsi(t)).toBe(t);
  });
  it('wraps at the width and breaks words longer than a line, never dropping characters', () => {
    const lines = wrapText('Comprehensive General Liability POL-2026-000000000000003 cover', 9, 70);
    for (const l of lines) expect(textWidth(l, 9)).toBeLessThanOrEqual(70);
    expect(lines.join('').replace(/ /g, '')).toBe('ComprehensiveGeneralLiabilityPOL-2026-000000000000003cover');
    expect(wrapText('a\nb', 9, 100)).toEqual(['a', 'b']);
  });
});

describe('table width allocation', () => {
  const columns = [{ key: 'no', label: 'Policy No.', type: 'text' }, { key: 'date', label: 'Issue Date', type: 'date' }, { key: 'client', label: 'Client', type: 'text' },
    { key: 'insurer', label: 'Insurer', type: 'text' }, { key: 'si', label: 'Sum Insured', type: 'money' }, { key: 'gross', label: 'Gross Premium', type: 'money' }];
  const rows = Array.from({ length: 30 }, (_, i) => ({ no: `POL-2026-${String(i).padStart(5, '0')}`, date: '2026-09-01', client: `Client ${i} with a long registered trading name Inc.`,
    insurer: 'MAPFRE Insurance Corporation of the Philippines', si: 1250000 * i, gross: 38750.5 * i }));
  it('gives numbers, dates and document numbers at least their widest value; text columns wrap', () => {
    const t = prepareTable({ columns, rows, totals: { si: 999999999.99, gross: 270482123.45 } });
    expect(t.columns.map((c) => c.nowrap)).toEqual([true, true, false, false, true, true]);
    expect(t.columns.map((c) => c.align)).toEqual(['left', 'left', 'left', 'left', 'right', 'right']);
    const { widths, fits } = allocateWidths(t, 500, 7);
    expect(fits).toBe(true);
    t.columns.forEach((c, i) => {
      if (!c.nowrap) return;
      const widest = Math.max(...t.rows.map((r) => textWidth(r[i], 7, true)));
      expect(widths[i]).toBeGreaterThanOrEqual(widest);
    });
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(500, 5);
  });
  it('reports a table that does not fit, and the report layout shrinks the font then moves to A3', () => {
    const extra = (n) => Array.from({ length: n }, (_, i) => `a${i}`);
    const widen = (n) => ({ columns: [...columns, ...extra(n).map((k) => ({ key: k, label: `Amount ${k}`, type: 'money' }))],
      rows: rows.map((r) => ({ ...r, ...Object.fromEntries(extra(n).map((k) => [k, 123456789.12])) })) });
    expect(allocateWidths(prepareTable(widen(8)), 780, 7.5).fits).toBe(false);
    const medium = fitReport(widen(8));
    expect(medium.pageSize).toBe('A4');
    expect(medium.fontSize).toBeLessThan(7.5);
    expect(fitReport(widen(16)).pageSize).toBe('A3');
    const small = fitReport({ columns, rows });
    expect(small).toMatchObject({ pageSize: 'A4', fontSize: 7.5 });
  });
  it('prints every number, date and policy number in full in a report PDF (totals too)', () => {
    const pdf = buildReportPdf({ title: 'Production Register', params: 'Period 01/01/2026 to 29/09/2026', columns, rows, totals: { si: 999999999.99, gross: 270482123.45 },
      letterhead: { name: 'Test Co.', addressLines: [] }, generatedAt: '29/09/2026 18:03', generatedBy: 'Tester', format: { dateFormat: 'DD/MM/YYYY' } });
    const s = assertValidXref(pdf);
    expect(s).toContain('(POL-2026-00029)');
    expect(s).toContain('(01/09/2026)');
    expect(s).toContain('(270,482,123.45)');
    expect(s).toContain('(999,999,999.99)');
    expect(s).not.toMatch(/\.\.\)/);
    expect(s).toContain('(Generated 29/09/2026 18:03 by Tester)');
    expect(s).toMatch(/\(Page 1 of \d\)/);
    expect(s).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  });
});

describe('formatting', () => {
  it('formats dates in the configured pattern, never as JS Date strings', () => {
    expect(formatDate('2026-09-20', { dateFormat: 'DD/MM/YYYY' })).toBe('20/09/2026');
    expect(formatDate(new Date('2026-09-20T00:30:00+08:00'), { dateFormat: 'MMM D, YYYY', timeZone: 'Asia/Manila' })).toBe('Sep 20, 2026');
    expect(formatDate('Sun Sep 20 2026 08:00:00 GMT+0800', { dateFormat: 'DD/MM/YYYY', timeZone: 'Asia/Manila' })).toBe('20/09/2026');
    expect(formatDateTime(new Date('2026-09-29T09:54:55.648Z'), { dateFormat: 'DD/MM/YYYY', timeZone: 'Asia/Manila' })).toBe('29/09/2026 17:54');
  });
  it('humanises keys and writes amounts in words', () => {
    expect(humanize('OtherContents')).toBe('Other contents');
    expect(humanize('sum_insured')).toBe('Sum insured');
    expect(humanize('CTPL')).toBe('CTPL');
    expect(amountInWords(1102)).toBe('One Thousand One Hundred Two Pesos Only');
    expect(amountInWords(28569.53)).toBe('Twenty-Eight Thousand Five Hundred Sixty-Nine Pesos and Fifty-Three Centavos Only');
    expect(amountInWords(1.01)).toBe('One Peso and One Centavo Only');
  });
});

describe('premium lines add up to the gross premium', () => {
  const sum = (rows) => Math.round(rows.slice(0, -1).reduce((s, r) => s + r[1], 0) * 100) / 100;
  it('motor quotation with CTPL: net + taxes + CTPL = gross', () => {
    const q = { netPremium: 22250, valueAddedTax: 2670, documentaryStampTax: 2781.25, localGovernmentTax: 166.88, fireServiceTax: 0, ctplCoveragePremium: 1660.4, accountPremiumOthers: 0, discount: 0, grossPremium: 29528.53 };
    const { rows, itemised } = premiumLines(q);
    expect(itemised).toBe(true);
    expect(rows.map((r) => r[0])).toContain('CTPL (inclusive of taxes and fees)');
    expect(rows.at(-1)).toEqual(['Gross premium', 29528.53]);
    expect(sum(rows)).toBe(29528.53);
  });
  it('fire quotation with FST and a discount', () => {
    const { rows } = premiumLines({ netPremium: 135200, valueAddedTax: 16224, documentaryStampTax: 16900, localGovernmentTax: 1014, fireServiceTax: 2704, discount: 1000, grossPremium: 171042 });
    expect(rows).toContainEqual(['Discount', -1000]);
    expect(sum(rows)).toBe(171042);
  });
  it('a policy schedule uses the policy columns, and prints only the gross when there is no breakdown', () => {
    const quote = { netPremium: 20460, valueAddedTax: 2455.2, documentaryStampTax: 2557.5, localGovernmentTax: 153.45, grossPremium: 25626.15 };
    const withQuote = premiumLines(policyPremium({ netPremium: 20460, premiumTotal: 25626.15 }, quote));
    expect(withQuote.itemised).toBe(true);
    expect(sum(withQuote.rows)).toBe(25626.15);
    // imported / seeded policy: net 0, gross 9,700, no quotation
    const imported = premiumLines(policyPremium({ netPremium: 0, premiumTotal: 9700 }, {}));
    expect(imported.rows).toEqual([['Gross premium', 9700]]);
    // a breakdown that does not add up is not printed
    expect(premiumLines({ netPremium: 100, valueAddedTax: 12, grossPremium: 500 }).rows).toEqual([['Gross premium', 500]]);
  });
  it('chooses the risk section by line of business and leaves out empty fields', () => {
    const f = formatters({ format: { dateFormat: 'DD/MM/YYYY', currency: 'PHP' } });
    expect(lineOf({ productLine: 'accident', productName: 'Personal Accident' })).toBe('ACCIDENT');
    expect(lineOf({ lob: 'IAR' })).toBe('PROPERTY');
    const pa = riskSection({ productLine: 'accident', productName: 'Personal Accident', policyTypeName: 'Group', sumInsured: 2000000, currency: 'PHP' }, f);
    expect(pa.rows.map((r) => r[0])).toEqual(['Class of insurance', 'Policy type', 'Sum insured']);
    expect(pa.rows.flat().join(' ')).not.toMatch(/Location|Construction|Occupancy/);
    expect(riskSection({ lob: 'FIRE', fireRiskDetails: {} }, f).rows).toEqual([]);
  });
});

describe('claim documents from their templates', () => {
  it('turns "Label: value" lines into a details grid and adds signature blocks', () => {
    const spec = claimDocSpec('Claims Discharge Voucher', ['Claim CLM-1 under policy POL-1', 'Insured: Jose Reyes', 'Settlement amount: PHP 1,000.00', 'Settlement type: ',
      'I accept the above amount in full and final settlement of this claim.', 'Signature: ______________________   Date: ____________'], { claimNumber: 'CLM-1', insuredName: 'Jose Reyes' }, { letterhead: { name: 'Test Co.' } });
    expect(spec.sections.find((s) => s.rows)?.rows).toEqual([['Insured', 'Jose Reyes'], ['Settlement amount', 'PHP 1,000.00']]);
    expect(spec.sections.at(-1).signatures.map((s) => s.label)).toEqual(['Insured / claimant', 'Witness', 'For Test Co.']);
    expect(JSON.stringify(spec)).not.toContain('____');
  });
});

describe('letterhead and the primary company', () => {
  let ctx;
  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => { await pool.end(); });

  it('reads the primary company of the Company master (iorta TechNXT Corp. out of the box) with its logo', async () => {
    clearLetterheadCache();
    const lh = await getLetterhead({ fresh: true });
    expect(lh).toMatchObject({ code: 'ITX', name: 'iorta TechNXT Corp.', tin: '00-010-0234-8393', licence: '', phone: '', email: 'connect@iortatechnxt.com' });
    expect(lh.addressLines).toEqual(['UB, 111 Paseo De Roxas Building', 'Legazpi Village, San Lorenzo', 'Makati, Metro Manila, Philippines']);
    expect(lh.logo?.type).toBe('png');
    expect(companyAddressLines({ AddressLine1: 'A', City: 'Makati', State: 'Metro Manila', PinCode: '1226', Country: 'Philippines' })).toEqual(['A', 'Makati, Metro Manila 1226, Philippines']);
  });
  it('allows one primary company only, and prints follow the primary company', async () => {
    const body = { CompanyCode: 'TPC', CompanyName: 'Test Primary Brokers Corp.', City: 'Pasig', State: 'Metro Manila', Country: 'Philippines', TIN: '123-456-789-000', IsPrimary: true };
    const dup = await ctx.api('post', '/masters/company').send(body);
    expect(dup.status).toBe(400);
    expect(dup.body.errors[0].message).toMatch(/Only one company can be the letterhead \(primary\) company: iorta TechNXT Corp\. is already primary/);
    const itx = (await query("SELECT id FROM master_records WHERE type_code = 'company' AND code = 'ITX'")).rows[0].id;
    expect((await ctx.api('put', `/masters/company/${itx}`).send({ IsPrimary: false })).status).toBe(200);
    const c = await ctx.api('post', '/masters/company').send(body);
    expect(c.status).toBe(201);
    const lh = await getLetterhead();
    expect(lh).toMatchObject({ name: 'Test Primary Brokers Corp.', tin: '123-456-789-000' });
    expect(lh.logo?.type).toBe('png'); // no logo of its own: documents.default_logo_path
    expect((await query("SELECT value FROM app_settings WHERE key = 'general.company_name'")).rows[0].value).toBe('Test Primary Brokers Corp.');
    // a second primary through an update is refused as well
    expect((await ctx.api('put', `/masters/company/${itx}`).send({ IsPrimary: true })).status).toBe(400);
    // a quotation PDF prints the new letterhead
    const q = (await query('SELECT id FROM quotes ORDER BY created_at DESC LIMIT 1')).rows[0];
    if (q) {
      const pdf = await ctx.api('get', `/document-templates/quote-template/${q.id}`).buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
      expect(pdf.status).toBe(200);
      expect(pdf.body.toString('latin1')).toContain('(Test Primary Brokers Corp.)');
    }
    // no primary company: the first active company is the letterhead
    expect((await ctx.api('patch', `/masters/company/${c.body.data.id}/status`).send({ status: 'Inactive' })).status).toBe(200);
    const fallback = await getLetterhead();
    expect(fallback.name).not.toBe('Test Primary Brokers Corp.');
    expect(fallback.name).toBeTruthy();
    expect((await ctx.api('put', `/masters/company/${itx}`).send({ IsPrimary: true })).status).toBe(200);
    expect((await getLetterhead()).name).toBe('iorta TechNXT Corp.');
  });
});
