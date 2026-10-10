/**
 * Exports of the accounting flow (flow.js): the accounting reference workbook for audit and the Accounting Entries
 * Handbook (PDF) for Finance sign-off. Pure functions over the read model and the worked examples, so they are tested
 * without a server; the route adds the letterhead and sends the file.
 */
import { MAPPING_TEXT } from './flow.js';
import { formatDate } from '../../lib/pdf/format.js';

const SCREENS = {
  '/master/finance/account-determination': 'Master › Finance › Account Determination',
  '/master/finance/premium-account-setup': 'Master › Finance › Account Determination › Premium',
  '/master/finance/customer-account-setup': 'Master › Finance › Account Determination › Customer',
  '/master/finance/miscellaneous-account-setup': 'Master › Finance › Account Determination › Miscellaneous',
  '/master/finance/ri-claim-account-setup': 'Master › Finance › Account Determination › Claims',
  '/master/finance/taxation': 'Master › Finance › Taxation',
  '/master/finance/posting-rules': 'Master › Finance › Posting Rules',
};
const yesNo = (v) => (v ? 'Yes' : 'No');
const all = (flow) => [...flow.events, ...flow.systemJournals];
const areaName = (flow, code) => flow.areas.find((a) => a.code === code)?.name || code;
const pendingText = (e) => (e.pending ? `Waiting for approval since ${String(e.pending.requestedAt || '').slice(0, 10)}${e.pending.requestedBy ? ` (requested by ${e.pending.requestedBy})` : ''}` : '');
const journalText = (e) => (e.fixed ? 'Fixed entry' : e.version ? e.postingText : 'No rule in force');
const appliesWhen = (l) => (l.condition ? `${l.condition.on ? 'Only when' : 'Not posted: switched off'} – ${l.condition.name.toLowerCase()}` : '');
const optionsText = (a) => (a.options || []).map((o) => `${o.name} ${o.glCode || '-'}${o.mapping ? ` (${MAPPING_TEXT[o.mapping]})` : ''}`).join('; ');
const sourceText = (a) => [a.source, a.fallback ? `else ${a.fallback.glCode} ${a.fallback.glName || ''}`.trim() : '', optionsText(a)].filter(Boolean).join('; ');
const lineMapping = (a) => (a.mapping ? MAPPING_TEXT[a.mapping] : a.options?.some((o) => o.mapping) ? 'Some accounts pending' : a.fallback?.mapping ? `Fallback: ${MAPPING_TEXT[a.fallback.mapping]}` : '');
const accountPending = (a) => (a.pendingChange?.glCode ? `To ${a.pendingChange.glCode} ${a.pendingChange.glName || ''} on approval`.trim() : a.pendingChange ? 'Change waiting for approval' : '');
const col = (header, width, type) => ({ header, width, ...(type ? { type } : {}) });

/** Workbook sheets: Entries, Events, Mapping pending, Examples and, for finance administrators, Technical. */
export function flowWorkbook(flow, { technical = false, examples = [] } = {}) {
  const entries = all(flow).flatMap((e) => e.lines.map((l) => [areaName(flow, e.area), e.label, e.when, e.where, e.approval, journalText(e), l.side, l.account.glCode || '',
    l.account.glName || '', sourceText(l.account), l.amount, yesNo(l.perParticipant), appliesWhen(l), lineMapping(l.account), accountPending(l.account) || pendingText(e)]));
  const events = all(flow).map((e) => [areaName(flow, e.area), e.label, e.summary || '', e.when, e.where, e.approval, e.authority?.name || '', journalText(e), pendingText(e),
    e.scheduled ? `Version from ${formatDate(e.scheduled.effectiveFrom)}` : '', e.lastPosted || (e.fixed ? '' : 'Not posted yet')]);
  const mapping = flow.mapping.pending.map((p) => [p.item, p.glCode || '', p.glName || '', MAPPING_TEXT[p.reason], p.events.map((x) => x.label).join('; '), SCREENS[p.configure] || '']);
  const exampleRows = examples.flatMap((x) => x.lines.map((l) => [x.label, x.coInsurance ? 'Two insurers (60 / 40)' : 'Single insurer', l.accountCode, l.accountName || '', l.debit || null, l.credit || null]));
  const sheets = [
    { name: 'Entries', freeze: true, columns: [col('Module', 22), col('Event', 32), col('When', 40, 'wrap'), col('Where', 30), col('Approval before posting', 36, 'wrap'), col('Journal', 18),
      col('Dr/Cr', 7), col('Account code', 13), col('Account name', 34), col('Account source', 44, 'wrap'), col('Amount', 40, 'wrap'), col('For each insurer', 10), col('Applies when', 30, 'wrap'),
      col('Mapping', 20), col('Pending change', 30, 'wrap')], rows: entries },
    { name: 'Events', freeze: true, columns: [col('Module', 22), col('Event', 32), col('Summary', 50, 'wrap'), col('When', 40, 'wrap'), col('Where', 30), col('Approval before posting', 36, 'wrap'),
      col('Approval limit', 30), col('Journal', 18), col('Pending change', 30, 'wrap'), col('New rule from', 18), col('Last posted', 14)], rows: events },
    { name: 'Mapping pending', freeze: true, columns: [col('Item', 40), col('Account', 13), col('Name', 40), col('Reason', 22), col('Events using it', 60, 'wrap'), col('Where to change', 44)], rows: mapping },
    { name: 'Examples', freeze: true, columns: [col('Event', 32), col('Variant', 22), col('Account code', 13), col('Account name', 40), col('Debit', 16, 'money'), col('Credit', 16, 'money')], rows: exampleRows },
  ];
  if (technical) {
    const rows = flow.events.flatMap((e) => e.lines.map((l) => [e.eventCode, e.version, e.effectiveFrom || '', e.ruleId, l.side, l.accountType, l.accountRef, l.fallbackRole || '',
      l.amountKey, yesNo(l.perParticipant), l.narration || '']));
    sheets.push({ name: 'Technical', freeze: true, columns: [col('Event code', 34), col('Rule version', 10, 'integer'), col('Effective from', 14), col('Rule id', 9, 'integer'), col('Side', 6),
      col('Account type', 12), col('Account / role / resolver', 30), col('Fallback role', 24), col('Amount key', 18), col('Per participant', 10), col('Line text', 50, 'wrap')], rows });
  }
  return sheets;
}

const HOW_TO_READ = [
  'Dr is the debit side and Cr the credit side of the journal; each event lists its debits first, then its credits.',
  'Amounts are described in business words; where an amount is derived, its formula is given under the entries.',
  '"For each insurer": the line is posted once per insurer of a co-insured policy, at the insurer\'s share.',
  'A negative amount posts on the other side; a zero amount posts no line.',
  '"Mapping pending": the account is provisional, outside the chart or inactive, and Finance still has to confirm the SAP account.',
].map((s, i) => `${i + 1}. ${s}`).join('\n');

/** Document spec of the Accounting Entries Handbook (lib/pdf/layout.js). */
export function flowHandbookSpec(flow, examples = [], { asOf } = {}) {
  const exampleOf = new Map(examples.map((x) => [x.eventCode, x]));
  const sections = [{ heading: 'How to read this handbook', text: HOW_TO_READ }];
  flow.areas.forEach((area, i) => {
    const list = all(flow).filter((e) => e.area === area.code);
    if (!list.length) return;
    if (i > 0) sections.push({ pageBreak: true });
    list.forEach((e, n) => {
      sections.push({ heading: n === 0 ? `${area.name}: ${e.label}` : e.label, columns: 1, rows: [['When', e.when], ['Where', e.where], ['Approval before posting', e.approval],
        ...(e.authority ? [['Approval limit', `Authority Matrix: ${e.authority.name}`]] : []), ['Journal', journalText(e)], ...(e.summary ? [['Summary', e.summary]] : []),
        ...(e.pending ? [['Pending change', pendingText(e)]] : []), ...(e.scheduled ? [['New rule', `Version from ${formatDate(e.scheduled.effectiveFrom)}`]] : [])] });
      if (e.lines.length) {
        const formulas = e.lines.filter((l) => l.formula).map((l) => `${l.amount}: ${l.formula}`);
        sections.push({ table: { columns: [{ label: 'Dr/Cr', type: 'code' }, { label: 'Account', type: 'code' }, { label: 'Name' }, { label: 'Amount' }, { label: 'Notes' }],
          rows: e.lines.map((l) => [l.side, l.account.glCode || '', l.account.glCode ? l.account.glName || '' : sourceText(l.account),
            `${l.amount}${l.perParticipant ? ' (for each insurer)' : ''}`, [appliesWhen(l), lineMapping(l.account)].filter(Boolean).join('; ')]) } });
        if (formulas.length) sections.push({ note: formulas.join('\n') });
      }
      const x = exampleOf.get(e.eventCode);
      if (x?.lines.length) {
        sections.push({ heading: 'Example with sample amounts', table: { columns: [{ label: 'Account', type: 'code' }, { label: 'Name' }, { label: 'Debit', type: 'money' }, { label: 'Credit', type: 'money' }],
          rows: x.lines.map((l) => [l.accountCode, l.accountName || '', l.debit || null, l.credit || null]), totals: ['Total', '', x.totalDebit, x.totalCredit] } });
      }
    });
  });
  if (flow.mapping.pending.length) {
    sections.push({ pageBreak: true }, { heading: 'Accounts pending mapping', table: { columns: [{ label: 'Item' }, { label: 'Account', type: 'code' }, { label: 'Name' }, { label: 'Reason' }, { label: 'Events', type: 'integer' }],
      rows: flow.mapping.pending.map((p) => [p.item, p.glCode || '', p.glName || '', MAPPING_TEXT[p.reason], p.events.length]) } });
  }
  sections.push({ heading: 'Sign-off', signatures: ['Prepared by', 'Reviewed by', 'Approved by'], perRow: 3 });
  return { title: 'Accounting Entries Handbook', params: `Rules in force on ${formatDate(asOf || flow.asOf)}`, sections };
}
