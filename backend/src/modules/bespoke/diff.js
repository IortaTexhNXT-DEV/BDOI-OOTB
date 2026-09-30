/**
 * Differences between two versions of a composed slip: header fields and placeholder values, sections (by key) and
 * clauses (by library clause, else by code or title), with a word-level diff of every wording that changed.
 */

const MAX_CELLS = 400000;
const words = (s) => String(s || '').split(/(\s+)/).filter((w) => w !== '');

/**
 * Word diff of two texts (longest common subsequence). Returns [{ op: 'equal' | 'insert' | 'delete', text }] with
 * neighbouring parts of the same kind merged. Very long texts fall back to delete-all / insert-all.
 */
export function diffWords(a, b) {
  const x = words(a);
  const y = words(b);
  if (x.join('') === y.join('')) return x.length ? [{ op: 'equal', text: x.join('') }] : [];
  let parts;
  if ((x.length + 1) * (y.length + 1) > MAX_CELLS) {
    parts = [{ op: 'delete', text: x.join('') }, { op: 'insert', text: y.join('') }];
  } else {
    const n = x.length;
    const m = y.length;
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    parts = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { parts.push({ op: 'equal', text: x[i] }); i += 1; j += 1; } else if (lcs[i + 1][j] >= lcs[i][j + 1]) { parts.push({ op: 'delete', text: x[i] }); i += 1; } else { parts.push({ op: 'insert', text: y[j] }); j += 1; }
    }
    while (i < n) { parts.push({ op: 'delete', text: x[i] }); i += 1; }
    while (j < m) { parts.push({ op: 'insert', text: y[j] }); j += 1; }
  }
  const merged = [];
  for (const p of parts.filter((q) => q.text)) {
    const last = merged[merged.length - 1];
    if (last && last.op === p.op) last.text += p.text; else merged.push({ ...p });
  }
  return merged;
}

const clauseKey = (c) => (c.clauseId ? `id:${c.clauseId}` : `code:${c.code || c.title}`);
const label = (c) => [c.code, c.title].filter(Boolean).join(' ');

/**
 * Compare two snapshots { title, status, variables, sections, clauses }. Returns { changes: [text], header, variables,
 * sections, clauses } where every entry says what happened (added, removed, changed, moved) with its word diff.
 */
export function diffSnapshots(from, to) {
  const a = from || {};
  const b = to || {};
  const changes = [];
  const header = [];
  for (const k of ['title', 'status']) {
    if ((a[k] ?? null) !== (b[k] ?? null)) { header.push({ field: k, from: a[k] ?? null, to: b[k] ?? null }); changes.push(`${k === 'title' ? 'Title' : 'Status'} changed from "${a[k] ?? ''}" to "${b[k] ?? ''}"`); }
  }
  const variables = [];
  const va = a.variables || {};
  const vb = b.variables || {};
  for (const k of [...new Set([...Object.keys(va), ...Object.keys(vb)])].sort()) {
    if (String(va[k] ?? '') !== String(vb[k] ?? '')) { variables.push({ key: k, from: va[k] ?? null, to: vb[k] ?? null }); changes.push(`Value of {${k}} changed from "${va[k] ?? ''}" to "${vb[k] ?? ''}"`); }
  }
  const sections = [];
  const sa = new Map((a.sections || []).map((s, i) => [s.key, { ...s, index: i }]));
  const sb = new Map((b.sections || []).map((s, i) => [s.key, { ...s, index: i }]));
  for (const [key, s] of sb) {
    const old = sa.get(key);
    if (!old) { sections.push({ key, heading: s.heading, change: 'added', diff: diffWords('', s.text) }); changes.push(`Section "${s.heading}" added`); continue; }
    if (old.text !== s.text || old.heading !== s.heading) {
      sections.push({ key, heading: s.heading, change: 'changed', diff: diffWords(old.text, s.text), headingFrom: old.heading !== s.heading ? old.heading : undefined });
      changes.push(`Section "${s.heading}" changed`);
    } else if (old.index !== s.index) {
      sections.push({ key, heading: s.heading, change: 'moved', from: old.index + 1, to: s.index + 1 });
    }
  }
  for (const [key, s] of sa) if (!sb.has(key)) { sections.push({ key, heading: s.heading, change: 'removed', diff: diffWords(s.text, '') }); changes.push(`Section "${s.heading}" removed`); }
  const clauses = [];
  const ca = new Map((a.clauses || []).map((c, i) => [clauseKey(c), { ...c, index: i }]));
  const cb = new Map((b.clauses || []).map((c, i) => [clauseKey(c), { ...c, index: i }]));
  for (const [key, c] of cb) {
    const old = ca.get(key);
    if (!old) { clauses.push({ key, label: label(c), change: 'added', diff: diffWords('', c.wording) }); changes.push(`Clause ${label(c)} added`); continue; }
    const entry = { key, label: label(c) };
    if (old.wording !== c.wording) {
      clauses.push({ ...entry, change: 'changed', diff: diffWords(old.wording, c.wording), versionFrom: old.clauseVersion ?? null, versionTo: c.clauseVersion ?? null });
      changes.push(`Wording of ${label(c)} changed${c.manuscript ? ' (manuscript)' : ''}`);
    } else if ((old.clauseVersion ?? null) !== (c.clauseVersion ?? null)) {
      clauses.push({ ...entry, change: 'version', versionFrom: old.clauseVersion ?? null, versionTo: c.clauseVersion ?? null });
      changes.push(`${label(c)} moved to library version ${c.clauseVersion}`);
    } else if (old.index !== c.index) {
      clauses.push({ ...entry, change: 'moved', from: old.index + 1, to: c.index + 1 });
    }
  }
  if (clauses.some((c) => c.change === 'moved')) changes.push('Clauses reordered');
  for (const [key, c] of ca) if (!cb.has(key)) { clauses.push({ key, label: label(c), change: 'removed', diff: diffWords(c.wording, '') }); changes.push(`Clause ${label(c)} removed`); }
  if (sections.some((s) => s.change === 'moved')) changes.push('Sections reordered');
  return { changes, header, variables, sections, clauses };
}
