/**
 * Helvetica / Helvetica-Bold metrics (the PDF base-14 fonts, WinAnsiEncoding) and text helpers: Unicode to WinAnsi
 * mapping, string widths from the AFM advance widths, and word wrapping. No dependencies.
 */

// Advance widths (1/1000 em) for WinAnsi codes 32..255, from the Adobe AFM files of Helvetica and Helvetica-Bold.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 278,
  556, 278, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 278, 611, 278, 278, 222, 222, 333, 333, 350, 556, 1000,
  333, 1000, 500, 333, 944, 278, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 552,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722,
  667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584,
  611, 556, 556, 556, 556, 500, 556, 500,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 278,
  556, 278, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 278, 611, 278, 278, 278, 278, 500, 500, 350, 556, 1000,
  333, 1000, 556, 333, 944, 278, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 552,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722,
  667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584,
  611, 611, 611, 611, 611, 556, 611, 556,
];

// Unicode characters that WinAnsiEncoding places in 0x80..0x9F.
const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
// Characters without a WinAnsi glyph: a readable substitute.
const SUBSTITUTES = {
  '₱': 'PHP ', '‐': '-', '‑': '-', '‒': '-', '―': '—', '−': '-', '′': "'", '″': '"',
  '‛': "'", '‟': '"', '‧': '·', '⁃': '-', '●': '•', '▪': '•', '∙': '•',
  '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '✓': 'v', '✔': 'v',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '﻿': '', '\t': ' ',
};

/**
 * A string in WinAnsi: every character of the result is one byte (char code 0..255) as the base fonts encode it.
 * En / em dashes, curly quotes, bullets and the ellipsis keep their own glyphs; the peso sign becomes "PHP ";
 * accented letters outside Latin-1 lose their accent; anything else unprintable becomes "?".
 */
export function toWinAnsi(input) {
  let out = '';
  for (const ch of String(input ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 10 || cp === 13) { out += ' '; continue; }
    if (SUBSTITUTES[ch] !== undefined) { out += toWinAnsi(SUBSTITUTES[ch]); continue; }
    // 0x80..0x9F are C1 controls in Unicode: here they are WinAnsi bytes already (text converted before), kept as is
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0x80 && cp <= 0xff && cp !== 0x81 && cp !== 0x8d && cp !== 0x8f && cp !== 0x90 && cp !== 0x9d)) { out += ch; continue; }
    if (CP1252_HIGH[cp]) { out += String.fromCharCode(CP1252_HIGH[cp]); continue; }
    if (cp < 0x20) continue;
    const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    out += base && base !== ch && [...base].every((c) => c.charCodeAt(0) < 0x100) ? base : '?';
  }
  return out;
}

/** Width in points of a (WinAnsi or Unicode) string in Helvetica / Helvetica-Bold at the given size. */
export function textWidth(s, size, bold = false) {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  const t = toWinAnsi(s);
  let w = 0;
  for (let i = 0; i < t.length; i += 1) {
    const c = t.charCodeAt(i);
    w += c >= 32 ? table[c - 32] : 0;
  }
  return (w * size) / 1000;
}

/** Break one word that is wider than `width` into pieces that fit (never drops characters). */
function breakWord(word, size, bold, width) {
  const parts = [];
  let cur = '';
  for (const ch of word) {
    if (cur && textWidth(cur + ch, size, bold) > width) { parts.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * Word-wrap text into lines no wider than `width` points (explicit "\n" starts a new line). Words wider than the
 * line are broken by character, so nothing is ever cut off. Returns WinAnsi strings.
 */
export function wrapText(input, size, width, { bold = false } = {}) {
  const lines = [];
  for (const para of String(input ?? '').split(/\r?\n/)) {
    const words = toWinAnsi(para).split(' ').filter((w, i, a) => w !== '' || (i === 0 && a.length === 1));
    let line = '';
    for (const raw of words) {
      const pieces = textWidth(raw, size, bold) > width ? breakWord(raw, size, bold, width) : [raw];
      for (const word of pieces) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && textWidth(candidate, size, bold) > width) { lines.push(line); line = word; } else line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Width of the widest single word (the narrowest a column can be without breaking words). */
export const longestWord = (s, size, bold = false) => Math.max(0, ...String(s ?? '').split(/\s+/).map((w) => textWidth(w, size, bold)));
