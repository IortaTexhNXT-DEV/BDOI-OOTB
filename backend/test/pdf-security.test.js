/**
 * Password-protected PDFs (lib/pdf/security.js): the standard security handler revision 4 with AES-128. The test
 * derives the file key from the password the way a PDF reader does (PDF 1.7, 7.6.3.3 algorithm 2), checks the user
 * password entry (algorithm 5) and decrypts the page content, so the files open with their password and only with it.
 */
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { buildPdf } from '../src/lib/pdf/index.js';
import { rc4 } from '../src/lib/pdf/security.js';

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const md5 = (...p) => crypto.createHash('md5').update(Buffer.concat(p)).digest();
const padded = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32);

/** The key of a password, or null when the password is wrong (U entry check). */
function keyFor(pdf, password) {
  const s = pdf.toString('latin1');
  const hex = (name) => Buffer.from(new RegExp(`/${name} <([0-9a-f]+)>`).exec(s)[1], 'hex');
  const O = hex('O');
  const U = hex('U');
  const P = Number(/\/P (-?\d+)/.exec(s)[1]);
  const id = Buffer.from(/\/ID \[<([0-9a-f]+)>/.exec(s)[1], 'hex');
  const p = Buffer.alloc(4);
  p.writeInt32LE(P);
  let key = md5(padded(password), O, p, id);
  for (let i = 0; i < 50; i += 1) key = md5(key);
  let u = rc4(key, md5(PAD, id));
  for (let i = 1; i <= 19; i += 1) u = rc4(Buffer.from(key.map((b) => b ^ i)), u);
  return u.equals(U.subarray(0, 16)) ? key : null;
}

/** Decrypt the first content stream of the file with the key. */
function firstContent(pdf, key) {
  const s = pdf.toString('latin1');
  const m = /(\d+) 0 obj\n<< {2}\/Length (\d+) >>\nstream\n/.exec(s);
  const start = m.index + m[0].length;
  const data = pdf.subarray(start, start + Number(m[2]));
  const n = Number(m[1]);
  const objKey = md5(key, Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, 0, 0]), Buffer.from('sAlT', 'latin1')).subarray(0, 16);
  const d = crypto.createDecipheriv('aes-128-cbc', objKey, data.subarray(0, 16));
  return Buffer.concat([d.update(data.subarray(16)), d.final()]).toString('latin1');
}

describe('password-protected PDFs', () => {
  const spec = { title: 'Certificate of Cover', number: 'CLC-2026-000001', sections: [{ heading: 'Borrower', text: 'Juan Dela Cruz' }] };

  it('opens with its password only, and its content is encrypted', () => {
    const pdf = buildPdf({ ...spec, password: '14031980' });
    const s = pdf.toString('latin1');
    expect(s.startsWith('%PDF-1.6')).toBe(true);
    expect(s).toContain('/Filter /Standard /V 4 /R 4 /Length 128');
    expect(s).not.toContain('Juan Dela Cruz');
    expect(keyFor(pdf, 'wrong')).toBeNull();
    const key = keyFor(pdf, '14031980');
    expect(key).not.toBeNull();
    expect(firstContent(pdf, key)).toContain('Juan Dela Cruz');
  });

  it('without a password the file is written as before', () => {
    const pdf = buildPdf(spec).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).not.toContain('/Encrypt');
    expect(pdf).toContain('Juan Dela Cruz');
  });
});
