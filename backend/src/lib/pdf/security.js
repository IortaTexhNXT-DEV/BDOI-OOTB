/**
 * Password protection of generated PDFs: the PDF standard security handler, revision 4 with the AESV2 crypt filter
 * (AES-128 in CBC mode for every string and stream). Opening the file asks for the user password; the owner password
 * (random unless given) keeps the permissions. Used for the certificates e-mailed to customers (Credit Life, parcel),
 * whose password follows a configurable rule (birth date, last digits of the loan account).
 *
 * The O and U entries of revision 3 and 4 are computed with RC4 (PDF 1.7, 7.6.3.3 and 7.6.3.4); Node's OpenSSL build
 * no longer offers RC4, so the few RC4 rounds needed are done here.
 */
import crypto from 'node:crypto';

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
/** Permissions: print, copy, fill-in and assemble allowed; changing the document needs the owner password. */
export const DEFAULT_PERMISSIONS = -3392;

const md5 = (...parts) => crypto.createHash('md5').update(Buffer.concat(parts)).digest();

/** RC4 of data with key (stream cipher: the same call encrypts and decrypts). */
export function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n += 1) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

/** A password padded or cut to 32 bytes with the standard padding string (Latin-1 bytes). */
const padded = (password) => Buffer.concat([Buffer.from(String(password ?? ''), 'latin1'), PAD]).subarray(0, 32);

const rc4Rounds = (key, data) => {
  let out = rc4(key, data);
  for (let i = 1; i <= 19; i += 1) out = rc4(Buffer.from(key.map((b) => b ^ i)), out);
  return out;
};

/**
 * Security of one document: { encryptDict (the /Encrypt dictionary body), id (the file identifier, Buffer),
 * string(objNum, buffer) and stream(objNum, buffer) encrypting a string or stream of an object }.
 */
export function pdfSecurity({ userPassword, ownerPassword = null, permissions = DEFAULT_PERMISSIONS, id = crypto.randomBytes(16) }) {
  let ownerKey = md5(padded(ownerPassword || crypto.randomBytes(12).toString('hex')));
  for (let i = 0; i < 50; i += 1) ownerKey = md5(ownerKey);
  const O = rc4Rounds(ownerKey, padded(userPassword));
  const P = Buffer.alloc(4);
  P.writeInt32LE(permissions);
  let key = md5(padded(userPassword), O, P, id);
  for (let i = 0; i < 50; i += 1) key = md5(key);
  const U = Buffer.concat([rc4Rounds(key, md5(PAD, id)), Buffer.alloc(16)]);
  const objectKey = (num) => {
    const n = Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0]);
    return md5(key, n, Buffer.from('sAlT', 'latin1')).subarray(0, 16);
  };
  const aes = (num, data) => {
    const iv = crypto.randomBytes(16);
    const c = crypto.createCipheriv('aes-128-cbc', objectKey(num), iv);
    return Buffer.concat([iv, c.update(data), c.final()]);
  };
  return {
    id,
    encryptDict: `<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >> /StmF /StdCF /StrF /StdCF `
      + `/O <${O.toString('hex')}> /U <${U.toString('hex')}> /P ${permissions} /EncryptMetadata true >>`,
    string: aes,
    stream: aes,
  };
}
