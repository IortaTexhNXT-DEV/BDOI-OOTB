/**
 * Run log of the UAT scenario: every step with its outcome, the API error of a failed step, entity counts and notes.
 * Printed as it goes and written as a Markdown report at the end. Passwords never reach the log.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from './http.js';

const stamp = () => new Date().toISOString().slice(11, 19);

export class RunLog {
  constructor({ quiet = false } = {}) {
    this.quiet = quiet;
    this.steps = [];
    this.counts = new Map();
    this.notes = [];
    this.phase = '';
    this.started = new Date();
    this.secrets = [];
  }

  /** Values that must never appear in the log (passwords). */
  hide(...values) { this.secrets.push(...values.filter(Boolean)); }

  scrub(text) {
    let s = String(text ?? '');
    for (const v of this.secrets) s = s.split(v).join('***');
    return s;
  }

  print(line) {
    if (!this.quiet) console.log(this.scrub(line));
  }

  setPhase(name) {
    this.phase = name;
    this.print(`\n== ${name}`);
  }

  /**
   * Run one step. A failure is recorded with the API error and the scenario carries on (the step returns undefined),
   * unless `critical` is set, in which case the error is thrown after being recorded.
   */
  async step(name, fn, { critical = false, who = '' } = {}) {
    const t0 = Date.now();
    try {
      const result = await fn();
      this.steps.push({ phase: this.phase, name, who, ok: true, ms: Date.now() - t0 });
      return result;
    } catch (e) {
      const error = e instanceof ApiError
        ? { call: `${e.method} ${e.path}`, status: e.status, message: e.apiMessage, details: e.details }
        : { call: '', status: null, message: e.message, stack: e.stack?.split('\n').slice(1, 4).join(' | ') };
      this.steps.push({ phase: this.phase, name, who, ok: false, ms: Date.now() - t0, error });
      this.print(`[${stamp()}] FAIL ${this.phase} / ${name}${who ? ` (${who})` : ''}: ${error.call} ${error.status ?? ''} ${error.message}${error.details ? ` ${JSON.stringify(error.details).slice(0, 300)}` : ''}`);
      if (critical) throw e;
      return undefined;
    }
  }

  count(entity, n = 1) { this.counts.set(entity, (this.counts.get(entity) || 0) + n); }
  note(text) { this.notes.push(text); this.print(`   note: ${text}`); }
  info(text) { this.print(`[${stamp()}] ${text}`); }

  get failures() { return this.steps.filter((s) => !s.ok); }

  summaryLines() {
    const byPhase = new Map();
    for (const s of this.steps) {
      const p = byPhase.get(s.phase) || { ok: 0, failed: 0 };
      if (s.ok) p.ok += 1; else p.failed += 1;
      byPhase.set(s.phase, p);
    }
    return [...byPhase.entries()].map(([phase, p]) => `${phase}: ${p.ok} passed, ${p.failed} failed`);
  }

  /** Markdown report. `extra` = { title, context: [[label, value]], sections: [{ title, body }] }. */
  markdown(extra = {}) {
    const esc = (v) => this.scrub(String(v ?? '')).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const L = [];
    L.push(`# ${extra.title || 'UAT scenario run'}`, '');
    if (extra.intro) L.push(extra.intro, '');
    L.push('## Run', '', '| Item | Value |', '|---|---|');
    for (const [k, v] of extra.context || []) L.push(`| ${esc(k)} | ${esc(v)} |`);
    L.push(`| Steps | ${this.steps.length} (${this.steps.length - this.failures.length} passed, ${this.failures.length} failed) |`);
    L.push(`| Duration | ${Math.round((Date.now() - this.started.getTime()) / 1000)} s |`, '');
    L.push('## Steps per phase', '', '| Phase | Passed | Failed |', '|---|---|---|');
    const byPhase = new Map();
    for (const s of this.steps) {
      const p = byPhase.get(s.phase) || { ok: 0, failed: 0 };
      if (s.ok) p.ok += 1; else p.failed += 1;
      byPhase.set(s.phase, p);
    }
    for (const [phase, p] of byPhase) L.push(`| ${esc(phase)} | ${p.ok} | ${p.failed} |`);
    L.push('', '## Records produced', '', '| Entity | Count |', '|---|---|');
    for (const [k, v] of [...this.counts.entries()]) L.push(`| ${esc(k)} | ${v} |`);
    L.push('', '## Failed steps', '');
    if (!this.failures.length) L.push('None.');
    else {
      L.push('| Phase | Step | Call | Status | Message |', '|---|---|---|---|---|');
      for (const f of this.failures) L.push(`| ${esc(f.phase)} | ${esc(f.name)} | ${esc(f.error.call)} | ${esc(f.error.status)} | ${esc(f.error.message)} |`);
    }
    if (this.notes.length) {
      L.push('', '## Notes', '');
      for (const n of this.notes) L.push(`- ${this.scrub(n)}`);
    }
    for (const s of extra.sections || []) L.push('', `## ${s.title}`, '', this.scrub(s.body));
    L.push('');
    return L.join('\n');
  }

  write(file, extra) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.markdown(extra));
  }
}
