/** Deterministic random numbers (UAT_SEED): the same seed produces the same people, risks and amounts. */

/** mulberry32: small, fast, good enough for test data. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from any string (the UAT_SEED value). */
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export class Random {
  constructor(seed) { this.next = mulberry32(typeof seed === 'number' ? seed : seedOf(seed)); }

  float() { return this.next(); }
  /** Integer in [min, max]. */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p) { return this.next() < p; }
  pick(list) { return list[Math.floor(this.next() * list.length)]; }
  /** Amount in [min, max] rounded to `step` (e.g. 1000 for sums insured). */
  amount(min, max, step = 1) { return Math.round((min + this.next() * (max - min)) / step) * step; }
  digits(n) { let s = ''; for (let i = 0; i < n; i += 1) s += String(this.int(0, 9)); return s; }
  letters(n) { let s = ''; for (let i = 0; i < n; i += 1) s += String.fromCharCode(65 + this.int(0, 25)); return s; }
  shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /** `n` distinct items of a list. */
  sample(list, n) { return this.shuffle(list).slice(0, Math.min(n, list.length)); }
}
