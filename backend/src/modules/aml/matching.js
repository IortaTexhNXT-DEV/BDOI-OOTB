/**
 * Name matching for sanctions, PEP and negative list screening.
 *
 * A name is normalised (accents removed, upper case, punctuation dropped, honorifics and legal forms such as MR, ATTY,
 * INC, CORP left out) and split into words. Two names are compared word by word with the Jaro-Winkler similarity: each
 * word takes its best counterpart in the other name and the score is the average over the words of both names, so word
 * order does not matter ("DELA CRUZ, JUAN" matches "JUAN DELA CRUZ") and a missing middle name lowers the score a
 * little instead of failing the match. The whole names (words sorted) are also compared, and the higher score is kept.
 * A score of 1 is an exact match after normalisation; aml.match_threshold (default 0.85) decides what is reported.
 */

const NOISE = new Set([
  'MR', 'MRS', 'MS', 'MISS', 'DR', 'ATTY', 'ENGR', 'HON', 'SIR', 'MADAM', 'JR', 'SR', 'II', 'III', 'IV',
  'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'LLC', 'PLC', 'OPC', 'THE', 'AND',
]);

/** Upper-case words of a name without accents, punctuation, honorifics and legal forms. */
export function nameTokens(name) {
  const plain = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/Ñ/gi, 'N')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ');
  const words = plain.split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !NOISE.has(w));
  return kept.length ? kept : words;
}

/** The normalised name stored with list entries and used as the key of a screened party. */
export const normalizeName = (name) => nameTokens(name).join(' ');

/** Jaro-Winkler similarity of two strings (0 to 1). */
export function jaroWinkler(a, b) {
  if (a === b) return a.length ? 1 : 0;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array(a.length).fill(false);
  const bHit = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const from = Math.max(0, i - range);
    const to = Math.min(i + range + 1, b.length);
    for (let j = from; j < to; j += 1) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = true;
      bHit[j] = true;
      matches += 1;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k += 1;
    if (a[i] !== b[k]) t += 1;
    k += 1;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

const best = (word, others) => others.reduce((m, o) => Math.max(m, jaroWinkler(word, o)), 0);

/** Similarity of two names (0 to 1), whatever the order of their words. */
export function nameScore(x, y) {
  const a = nameTokens(x);
  const b = nameTokens(y);
  if (!a.length || !b.length) return 0;
  const words = (a.reduce((s, w) => s + best(w, b), 0) + b.reduce((s, w) => s + best(w, a), 0)) / (a.length + b.length);
  const whole = jaroWinkler([...a].sort().join(' '), [...b].sort().join(' '));
  return Math.round(Math.max(words, whole) * 10000) / 10000;
}

/**
 * Best match of a name against a list entry and its aliases: { score, matchedName }. A different year of birth, when
 * both are known, lowers the score by 0.1 (the same name, another person).
 */
export function matchEntry(name, entry, { birthDate = null } = {}) {
  let top = { score: 0, matchedName: entry.full_name };
  for (const candidate of [entry.full_name, ...(entry.aliases || [])]) {
    const score = nameScore(name, candidate);
    if (score > top.score) top = { score, matchedName: candidate };
  }
  const year = (v) => (String(v || '').match(/(19|20)\d{2}/) || [])[0] || null;
  const mine = year(birthDate);
  const theirs = year(entry.birth_date);
  if (mine && theirs && mine !== theirs) top.score = Math.max(0, Math.round((top.score - 0.1) * 10000) / 10000);
  return top;
}
