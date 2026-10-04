/**
 * Run log of the go-live rehearsal: the UAT run log (steps, failures, notes, passwords hidden) plus, for every check,
 * its PASS / FAIL result and the figures it produced, written step by step into the Markdown report.
 */
import { RunLog } from '../uat/log.js';

export class RehearsalLog extends RunLog {
  constructor(opts) {
    super(opts);
    this.checks = [];
  }

  /**
   * One check of a step. fn returns the figures (text) of the check; throwing (or an Error from expect) makes it FAIL.
   * critical: the rehearsal stops when it fails (the next steps depend on it).
   */
  async check(name, fn, { critical = false } = {}) {
    const entry = { phase: this.phase, name, ok: false, figures: '' };
    this.checks.push(entry);
    try {
      return await this.step(name, async () => {
        const r = await fn();
        entry.figures = typeof r === 'string' ? r : r?.figures || '';
        return r;
      }, { critical });
    } finally {
      const done = this.steps.at(-1);
      entry.ok = done.ok;
      if (!done.ok) entry.figures = [entry.figures, `${done.error.call ? `${done.error.call} -> ${done.error.status}: ` : ''}${done.error.message}`].filter(Boolean).join(' | ');
      this.print(`[${new Date().toISOString().slice(11, 19)}] ${entry.ok ? 'PASS' : 'FAIL'} ${name}${entry.figures ? ` - ${entry.figures}` : ''}`);
    }
  }

  /** Markdown of the checks, one table per step (phase). */
  checksMarkdown() {
    const esc = (v) => this.scrub(String(v ?? '')).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    const L = [];
    const phases = [...new Set(this.checks.map((c) => c.phase))];
    for (const p of phases) {
      const list = this.checks.filter((c) => c.phase === p);
      L.push(`### ${p}`, '', `${list.filter((c) => c.ok).length} of ${list.length} checks passed.`, '', '| # | Check | Result | Figures |', '|---|---|---|---|');
      list.forEach((c, i) => L.push(`| ${i + 1} | ${esc(c.name)} | ${c.ok ? 'PASS' : '**FAIL**'} | ${esc(c.figures)} |`));
      L.push('');
    }
    return L.join('\n');
  }
}

/** Throw when a condition does not hold (the message says what was expected). */
export function expect(condition, message) {
  if (!condition) throw new Error(message);
}

export const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
