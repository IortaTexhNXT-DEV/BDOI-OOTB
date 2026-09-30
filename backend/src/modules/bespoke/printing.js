/**
 * Prints of the bespoke module on the company letterhead (documents/templates.js header()): the composed slip, and the
 * composed wording appended to the standard Broker Slip / Placement Slip prints.
 */
import { formatters, header, kv } from '../documents/templates.js';
import { humanize } from '../../lib/pdf/format.js';

const TYPE_HEADINGS = { clause: 'Clauses', warranty: 'Warranties', exclusion: 'Exclusions', endorsement: 'Endorsements', condition: 'Conditions', deductible: 'Deductibles', subjectivity: 'Subjectivities' };

/** Sections of the composed wording: the slip sections, then the clauses grouped by type in the configured order. */
export function composedSections(slip) {
  const out = (slip.sections || []).filter((s) => String(s.rendered || '').trim()).map((s) => ({ heading: s.heading, text: s.rendered }));
  const order = slip.clauseTypeOrder || Object.keys(TYPE_HEADINGS);
  const types = [...order, ...new Set((slip.clauses || []).map((c) => c.clauseType).filter((t) => !order.includes(t)))];
  for (const type of types) {
    const list = (slip.clauses || []).filter((c) => c.clauseType === type);
    if (!list.length) continue;
    out.push({ heading: TYPE_HEADINGS[type] || humanize(type), text: list.map((c, i) => `${i + 1}. ${c.title}${c.code ? ` (${c.code})` : ''}\n${c.rendered}`).join('\n\n') });
  }
  return out;
}

/** The composed slip on its own (Operations > Placement > Slip Composer > Print). */
export async function composedSlipDoc(slip) {
  const h = await header(slip.placementId ? 'Placement Slip' : 'Slip - Request for Quotation', slip.slipNumber);
  const f = formatters(h);
  const v = slip.values || {};
  return { ...h, meta: kv([['Title', slip.title], ['Insured', slip.insuredName || v.insured_name], ['Request for quotation', slip.brokerSlipNumber], ['Placement slip', slip.placementNumber],
    ['Period', v.period_from ? `${f.date(v.period_from)} to ${f.date(v.period_to) || '-'}` : ''], ['Version', `${slip.version}${slip.status === 'final' ? '' : ' (draft)'}`],
    ['Status', humanize(slip.status)]]),
  sections: [...composedSections(slip), { heading: 'Acceptance', signatures: [{ label: 'For the broker' }, { label: 'For the insurer' }] }] };
}
