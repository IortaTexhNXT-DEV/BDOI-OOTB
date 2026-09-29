/**
 * Raster images for PDF output without dependencies: PNG is decoded (chunks, zlib inflate of IDAT, scanline
 * un-filtering) into 8-bit colour samples plus an optional alpha channel (written as an /SMask); JPEG is embedded as is
 * (/DCTDecode). Supported PNG: bit depth 8 (and 16, reduced to 8) for grey, grey + alpha, RGB and RGBA; bit depth
 * 1, 2, 4 and 8 for greyscale and palette images (palette transparency from tRNS). Interlaced PNGs are not supported.
 */
import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const isPng = (buf) => Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIG);
export const isJpeg = (buf) => Buffer.isBuffer(buf) && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8;

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/** Reverse the per-scanline PNG filters (None, Sub, Up, Average, Paeth). */
function unfilter(data, height, rowBytes, bpp) {
  const out = Buffer.alloc(height * rowBytes);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const type = data[pos];
    pos += 1;
    const row = y * rowBytes;
    const prev = row - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = data[pos + x];
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;
      let v;
      switch (type) {
        case 0: v = raw; break;
        case 1: v = raw + a; break;
        case 2: v = raw + b; break;
        case 3: v = raw + ((a + b) >> 1); break;
        case 4: v = raw + paeth(a, b, c); break;
        default: throw new Error(`PNG: unknown filter type ${type}`);
      }
      out[row + x] = v & 0xff;
    }
    pos += rowBytes;
  }
  return out;
}

/**
 * Decode a PNG into { width, height, colorSpace: 'DeviceRGB' | 'DeviceGray', pixels (8-bit samples), alpha (8-bit
 * samples or null) }.
 */
export function decodePng(buf) {
  if (!isPng(buf)) throw new Error('Not a PNG file');
  let pos = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], colorType: body[9], interlace: body[12] };
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr || !idat.length) throw new Error('PNG: missing IHDR or IDAT');
  const { width, height, depth, colorType, interlace } = ihdr;
  if (interlace) throw new Error('PNG: interlaced images are not supported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`PNG: unsupported colour type ${colorType}`);
  if (![1, 2, 4, 8, 16].includes(depth) || (depth < 8 && ![0, 3].includes(colorType)) || (depth === 16 && colorType === 3)) {
    throw new Error(`PNG: unsupported bit depth ${depth} for colour type ${colorType}`);
  }
  const bitsPerPixel = channels * depth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const raw = unfilter(zlib.inflateSync(Buffer.concat(idat)), height, rowBytes, bpp);

  // Samples of pixel i, channel ch, as 8-bit values
  const sample = (row, i, ch) => {
    if (depth === 8) return raw[row * rowBytes + i * channels + ch];
    if (depth === 16) return raw[row * rowBytes + (i * channels + ch) * 2];
    const perByte = 8 / depth;
    const byte = raw[row * rowBytes + Math.floor(i / perByte)];
    const shift = 8 - depth * ((i % perByte) + 1);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  const scale = depth < 8 && colorType === 0 ? 255 / ((1 << depth) - 1) : 1;
  const n = width * height;
  const isGray = colorType === 0 || colorType === 4;
  const pixels = Buffer.alloc(n * (isGray ? 1 : 3));
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && trns) || (colorType === 0 && trns);
  const alpha = hasAlpha ? Buffer.alloc(n) : null;
  const grayKey = colorType === 0 && trns && trns.length >= 2 ? trns.readUInt16BE(0) : null;
  let k = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, k += 1) {
      if (colorType === 3) {
        const idx = sample(y, x, 0);
        if (!palette || idx * 3 + 2 >= palette.length) throw new Error('PNG: palette index out of range');
        pixels[k * 3] = palette[idx * 3]; pixels[k * 3 + 1] = palette[idx * 3 + 1]; pixels[k * 3 + 2] = palette[idx * 3 + 2];
        if (alpha) alpha[k] = idx < trns.length ? trns[idx] : 255;
      } else if (isGray) {
        const v = sample(y, x, 0);
        pixels[k] = Math.round(v * scale);
        if (colorType === 4) alpha[k] = sample(y, x, 1);
        else if (alpha) alpha[k] = grayKey !== null && v === (depth === 16 ? grayKey >> 8 : grayKey) ? 0 : 255;
      } else {
        pixels[k * 3] = sample(y, x, 0); pixels[k * 3 + 1] = sample(y, x, 1); pixels[k * 3 + 2] = sample(y, x, 2);
        if (colorType === 6) alpha[k] = sample(y, x, 3);
      }
    }
  }
  // A fully opaque alpha channel is dropped (no soft mask needed)
  const opaque = alpha && alpha.every((v) => v === 255);
  return { width, height, colorSpace: isGray ? 'DeviceGray' : 'DeviceRGB', pixels, alpha: opaque ? null : alpha };
}

/** Width, height and components of a baseline / progressive JPEG (from its SOF marker). */
export function jpegInfo(buf) {
  if (!isJpeg(buf)) throw new Error('Not a JPEG file');
  let pos = 2;
  while (pos + 4 < buf.length) {
    if (buf[pos] !== 0xff) { pos += 1; continue; }
    const marker = buf[pos + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) { pos += marker === 0xff ? 1 : 2; continue; }
    const len = buf.readUInt16BE(pos + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7), components: buf[pos + 9] };
    }
    pos += 2 + len;
  }
  throw new Error('JPEG: no frame header');
}

/**
 * An image ready for the PDF writer: { width, height, type: 'png' | 'jpeg', ...decoded }. Returns null (and never
 * throws) when the bytes are not a supported image, so a bad logo never breaks a document.
 */
export function loadImage(buf) {
  try {
    if (isPng(buf)) return { type: 'png', ...decodePng(buf) };
    if (isJpeg(buf)) return { type: 'jpeg', ...jpegInfo(buf), data: buf };
  } catch { /* unsupported image: no logo */ }
  return null;
}
