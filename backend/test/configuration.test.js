/**
 * Configuration instead of hard-coding: every setting the code reads is seeded (so it appears on Master >
 * Configuration), code defaults never contradict the seed, business dates use the configured time zone and money
 * is rounded one way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { many, one } from '../src/db/pool.js';
import { clearSettingsCache, getSetting, setSetting } from '../src/lib/settings.js';
import { addDays, businessDate, isoInZone, nowInTz, today } from '../src/lib/dates.js';
import { formatMoney, round2 } from '../src/lib/money.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? (e.name === 'db' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const FILES = walk(SRC).map((f) => ({ file: path.relative(SRC, f), src: fs.readFileSync(f, 'utf8') }));

/** Text of the argument list after `open` (index just past the opening parenthesis), up to the matching ')'. */
function argsAt(src, open) {
  let depth = 1; let i = open; let quote = null;
  for (; i < src.length && depth; i += 1) {
    const ch = src[i];
    if (quote) { if (ch === '\\') i += 1; else if (ch === quote) quote = null; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
  }
  return src.slice(open, i - 1);
}

/** Every literal key the code reads, with its literal fallback when it has one. */
function settingReads() {
  const reads = [];
  for (const { file, src } of FILES) {
    const re = /\bgetSetting\(\s*'([^'$]+)'\s*(,)?/g;
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      const read = { key: m[1], where: `${file}:${line}` };
      if (m[2]) {
        const args = argsAt(src, m.index + 'getSetting('.length);
        const expr = args.slice(args.indexOf(',') + 1).trim();
        try { read.fallback = { value: Function(`"use strict"; return (${expr});`)() }; } catch { /* an identifier or expression: not a literal */ }
      }
      reads.push(read);
    }
    // reports/queries.js reads settings inside SQL: setting('key', fallback, type)
    for (const s of src.matchAll(/\bsetting\(\s*'([a-z_]+\.[a-z0-9_.]+)'/g)) reads.push({ key: s[1], where: `${file}:${src.slice(0, s.index).split('\n').length}` });
    // Keys built from a name: numbering.<entity>.prefix and email.template.<name>
    if (/nextNumber[^;]*from '\.\.\/masters\/helpers\.js'/.test(src)) {
      for (const s of src.matchAll(/\bnextNumber\('([a-z_]+)'\)/g)) reads.push({ key: `numbering.${s[1]}.prefix`, where: file });
    }
    if (/nextNumber[^;]*from '\.\.\/documents\/common\.js'/.test(src)) {
      for (const s of src.matchAll(/\bnextNumber\(\s*\w+,\s*'[a-z_]+',\s*'([a-z_]+)'\)/g)) reads.push({ key: `numbering.${s[1]}.prefix`, where: file });
    }
    for (const s of src.matchAll(/\bemailTemplate\(\s*'([a-z_]+)'\s*\)/g)) reads.push({ key: `email.template.${s[1]}`, where: file });
    for (const s of src.matchAll(/emailTemplate\(\s*\w+\s*\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)'\s*\)/g)) {
      reads.push({ key: `email.template.${s[1]}`, where: file }, { key: `email.template.${s[2]}`, where: file });
    }
  }
  return reads;
}

let seeded;
beforeAll(async () => {
  await setup();
  seeded = new Map((await many('SELECT key, value, "group", label, type FROM app_settings')).map((r) => [r.key, r]));
});

describe('settings the code reads', () => {
  it('finds the reads (sanity check of the scanner)', () => {
    const reads = settingReads();
    expect(reads.length).toBeGreaterThan(200);
    expect(reads.some((r) => r.key === 'numbering.cession.prefix')).toBe(true);
    expect(reads.some((r) => r.key === 'email.template.quote_approval')).toBe(true);
  });

  it('every key read by the code is seeded, with a label and a group (so Master > Configuration shows it)', () => {
    const missing = [...new Set(settingReads().filter((r) => !seeded.has(r.key)).map((r) => `${r.key} (${r.where})`))];
    expect(missing).toEqual([]);
    const unlabeled = [...new Set(settingReads().map((r) => seeded.get(r.key)).filter((s) => !s.label || !s.group).map((s) => s.key))];
    expect(unlabeled).toEqual([]);
  });

  it('code fallbacks never contradict each other or the seeded value', () => {
    const byKey = new Map();
    for (const r of settingReads().filter((x) => x.fallback)) (byKey.get(r.key) || byKey.set(r.key, []).get(r.key)).push(r);
    const conflicts = [];
    for (const [key, list] of byKey) {
      const values = new Set(list.map((r) => JSON.stringify(r.fallback.value)));
      if (values.size > 1) conflicts.push(`${key}: ${[...values].join(' vs ')} (${list.map((r) => r.where).join(', ')})`);
      // A scalar default (number, text, switch) must be the seeded value; null / [] / {} mean "not configured".
      for (const r of list) {
        const v = r.fallback.value;
        if (v !== null && typeof v !== 'object' && JSON.stringify(v) !== JSON.stringify(seeded.get(key)?.value)) {
          conflicts.push(`${key}: code ${JSON.stringify(v)} vs seed ${JSON.stringify(seeded.get(key)?.value)} (${r.where})`);
        }
      }
    }
    expect(conflicts).toEqual([]);
  });

  it('the settings added for former hard-coded values are seeded with their defaults', async () => {
    const expected = {
      'dashboard.renewals_due_days': 60, 'product.expiry_warning_days': 60, 'renewals.due_soon_days': 30, 'incentive.program_lookback_days': 30,
      'security.restricted_token_minutes': 15, 'security.reset_code_minutes': 15,
      'renewals.risk_thresholds': { noContactDays: 30, increasePercent: 10, dueSoonDays: 15 },
      'remittance.bill_email_subject': 'Statement of account {{billNumber}}', 'remittance.statement_email_subject': 'Remittance statement {{period}}',
    };
    for (const [key, value] of Object.entries(expected)) expect(seeded.get(key)?.value, key).toEqual(value);
    const tabs = await many('SELECT DISTINCT "group" FROM app_settings WHERE key = ANY($1)', [Object.keys(expected)]);
    expect(tabs.map((t) => t.group).sort()).toEqual(['dashboard', 'incentive', 'product', 'remittance', 'renewals', 'security']);
  });
});

describe('former hard-coded texts and limits come from settings', () => {
  it('password reset e-mail and code lifetime follow security.reset_* settings', async () => {
    const { default: request } = await import('supertest');
    const { createApp } = await import('../src/app.js');
    const app = await createApp();
    const admin = await one('SELECT id, email FROM users WHERE username = \'BrokerVerse\'');
    const last = () => one('SELECT subject, body_html FROM email_outbox WHERE template = \'password-reset\' ORDER BY id DESC LIMIT 1');
    const lifetime = async () => Number((await one('SELECT extract(epoch FROM expires_at - created_at) AS s FROM password_resets WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [admin.id])).s);
    await request(app).post('/api/auth/forgot-password').send({ username: 'BrokerVerse' }).expect(200);
    expect((await last()).subject).toBe('Your BrokerVerse password reset code');
    expect((await last()).body_html).toContain('It expires in 15 minutes.');
    expect(Math.round((await lifetime()) / 60)).toBe(15);
    await setSetting('security.reset_code_minutes', 30, admin.id);
    await setSetting('security.reset_email_subject', '{{companyName}} code', admin.id);
    try {
      await request(app).post('/api/auth/forgot-password').send({ username: 'BrokerVerse' }).expect(200);
      expect((await last()).subject).toBe('BrokerVerse code');
      expect((await last()).body_html).toContain('It expires in 30 minutes.');
      expect(Math.round((await lifetime()) / 60)).toBe(30);
    } finally {
      await setSetting('security.reset_code_minutes', 15, admin.id);
      await setSetting('security.reset_email_subject', 'Your {{companyName}} password reset code', admin.id);
    }
  });
});

describe('business date in the configured time zone', () => {
  it('is Manila time near midnight UTC, not the UTC date', async () => {
    expect(await getSetting('general.timezone')).toBe('Asia/Manila');
    // 17:30 UTC on 28 Sep = 01:30 on 29 Sep in Manila (UTC+8)
    const lateUtc = new Date('2026-09-28T17:30:00Z');
    expect(await today(lateUtc)).toBe('2026-09-29');
    expect(await businessDate(lateUtc)).toBe('2026-09-29');
    expect(await businessDate('2026-09-28T17:30:00.000Z')).toBe('2026-09-29');
    expect(await nowInTz(lateUtc)).toEqual({ date: '2026-09-29', time: '01:30:00', timeZone: 'Asia/Manila' });
    // 15:59 UTC is still the same day in Manila (23:59)
    expect(await today(new Date('2026-09-28T15:59:00Z'))).toBe('2026-09-28');
    expect(await businessDate('2026-09-28')).toBe('2026-09-28');
    expect(await businessDate('not a date')).toBe(null);
    expect(isoInZone(lateUtc, 'Not/AZone')).toBe('2026-09-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('follows a change of general.timezone', async () => {
    const admin = await one('SELECT id FROM users WHERE username = \'BrokerVerse\'');
    await setSetting('general.timezone', 'UTC', admin.id);
    try {
      expect(await today(new Date('2026-09-28T17:30:00Z'))).toBe('2026-09-28');
    } finally {
      await setSetting('general.timezone', 'Asia/Manila', admin.id);
      clearSettingsCache();
    }
    expect(await today(new Date('2026-09-28T17:30:00Z'))).toBe('2026-09-29');
  });

  it('no module keeps its own UTC "today"', () => {
    const offenders = FILES.filter(({ src }) => /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/.test(src) || /const today = \(\) =>/.test(src)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });
});

describe('amounts in texts the server writes', () => {
  it('formatMoney uses the configured currency, grouping and decimals', async () => {
    expect(await formatMoney(85000)).toBe('₱85,000.00');
    expect(await formatMoney('4598.5')).toBe('₱4,598.50');
    expect(await formatMoney(-26935.015)).toBe('-₱26,935.02');
    expect(await formatMoney(1200, 'USD')).toMatch(/1,200\.00/);
    const admin = await one('SELECT id FROM users WHERE username = \'BrokerVerse\'');
    await setSetting('currency.decimals', 0, admin.id);
    try {
      expect(await formatMoney(85000.4)).toBe('₱85,000');
    } finally {
      await setSetting('currency.decimals', 2, admin.id);
    }
  });

  it('notification texts format their amounts (see also journal.test.js)', () => {
    // No raw number left in notification texts: every amount goes through formatMoney
    const raw = FILES.filter(({ src }) => /notify\(\{[^;]*message: `[^`]*\$\{[^}]*(total_debit|total_amount|\.amount\.toFixed|premium_new|minimum_cashbox)\}/.test(src)).map((f) => f.file);
    expect(raw).toEqual([]);
  });
});

describe('round2: cents, half away from zero', () => {
  it.each([
    [1.005, 1.01], [-1.005, -1.01], [2.675, 2.68], [0.125, 0.13], [-0.125, -0.13], [1.004999, 1], [10.235, 10.24],
    [1234567.895, 1234567.9], [0.1 + 0.2, 0.3], ['12.345', 12.35], [100, 100], [-2.5, -2.5],
  ])('round2(%s) = %s', (input, expected) => {
    expect(round2(input)).toBe(expected);
  });
  it('treats empty and invalid input as 0 (never -0 or NaN)', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity, -0.001]) expect(Object.is(round2(v), 0)).toBe(true);
  });
  it('is the only round2 in the code base', () => {
    const copies = FILES.filter(({ src }) => /(const|function) round2\b/.test(src)).map((f) => f.file);
    expect(copies).toEqual(['lib/money.js']);
  });
});
