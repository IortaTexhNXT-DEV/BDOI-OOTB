/**
 * Print (PDF on the company letterhead) and Excel of a computed BIR return (returns.js#computeReturn): the form items
 * in BIR order, the schedules (per ATC, alphalists, working papers), the reconciliation and the filing record.
 * Also a generic table PDF / workbook for the other BIR outputs.
 */
import { renderPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';

const cell = (v, type) => {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'money' || type === 'number') return Number(v);
  if (type === 'integer') return Number(v);
  return String(v);
};
const pdfColumn = (c) => (c.type === 'money' || c.type === 'number' || c.type === 'integer' || c.type === 'date' ? { label: c.label, type: c.type === 'integer' ? 'number' : c.type } : c.label);
const totalsRow = (columns, totals) => (totals ? columns.map((c, i) => (i === 0 ? 'TOTAL' : totals[c.key] !== undefined ? Number(totals[c.key]) : '')) : null);

/** A schedule as a PDF table section. */
export function scheduleSection(s) {
  const rows = s.rows.map((r) => s.columns.map((c) => cell(r[c.key], c.type)));
  const tot = totalsRow(s.columns, s.totals);
  return { heading: s.title, table: { columns: s.columns.map(pdfColumn), rows: tot ? [...rows, tot] : rows, totalRow: !!tot, fontSize: s.columns.length > 8 ? 6.5 : undefined } };
}

const itemsSection = (r) => ({
  heading: `Part II: ${r.form === '1604-E' ? 'summary' : 'computation of tax'}`,
  table: { columns: ['Item', 'Particulars', { label: 'Tax base', type: 'money' }, { label: 'Rate (%)', type: 'number' }, { label: 'Amount', type: 'money' }],
    rows: r.items.map((i) => [i.no, i.label, i.taxBase ?? '', i.rate ?? '', Number(i.amount) || 0]) },
});

function reconciliationSection(r) {
  if (!r.reconciliation?.checks?.length) return null;
  return { heading: 'Reconciliation', table: { columns: ['Check', { label: 'Return', type: 'money' }, { label: 'Compared with', type: 'money' }, { label: 'Difference', type: 'money' }, 'Result'],
    rows: r.reconciliation.checks.map((c) => [c.label, c.returnAmount, c.otherAmount, c.difference, c.reconciled ? 'Reconciled' : 'Difference to explain']) } };
}

function filingSection(r) {
  const f = r.filing;
  if (!f) return { heading: 'Filing record', text: 'Not yet filed.' };
  return { heading: 'Filing record', rows: [['Date filed', f.dateFiled], ['Filing reference', f.filingReference || '-'], ['Amount paid', f.amountPaid.toFixed(2)],
    ['Penalties', f.penalties.toFixed(2)], ['Payment date', f.paymentDate || '-'], ['Payment reference', f.paymentReference || '-'], ['Payment channel', f.paymentChannel || '-'],
    ['Amended return', f.amended ? 'Yes' : 'No']], columns: 2 };
}

/** PDF of a return in the BIR form layout. */
export function returnPdf(r) {
  return renderPdf({
    title: `BIR Form No. ${r.form}`, subtitle: r.title, number: r.period.label, orientation: r.schedules.some((s) => s.columns.length > 8) ? 'landscape' : 'portrait',
    meta: [['Period', `${r.period.from} to ${r.period.to}`], ['Form version', r.formVersion]],
    footerNote: 'Figures computed by the system from the books of accounts. Transfer them to the eBIRForms / eFPS return; the filed return is the official record.',
    sections: [
      { heading: 'Part I: background information', rows: r.header.map(([k, v]) => [k, v || '-']), columns: 2 },
      itemsSection(r),
      ...r.schedules.map(scheduleSection),
      reconciliationSection(r),
      filingSection(r),
    ].filter(Boolean),
  });
}

/** Excel of a return: the form, each schedule on its own sheet, the reconciliation. */
export function returnXlsx(r) {
  const sheets = [
    { name: r.form, columns: [{ header: 'Item', width: 8 }, { header: 'Particulars', width: 70 }, { header: 'Tax base', type: 'money', width: 16 }, { header: 'Rate (%)', type: 'number', width: 10 }, { header: 'Amount', type: 'money', width: 16 }],
      rows: [...r.header.map(([k, v]) => ['', `${k}: ${v || '-'}`, '', '', '']), ...r.items.map((i) => [i.no, i.label, i.taxBase ?? '', i.rate ?? '', Number(i.amount) || 0])], autoFilter: false },
    ...r.schedules.map((s) => scheduleSheet(s)),
  ];
  if (r.reconciliation?.checks?.length) {
    sheets.push({ name: 'Reconciliation', columns: [{ header: 'Check', width: 60 }, { header: 'Return', type: 'money', width: 16 }, { header: 'Compared with', type: 'money', width: 16 },
      { header: 'Difference', type: 'money', width: 16 }, { header: 'Result', width: 22 }],
    rows: [...r.reconciliation.checks.map((c) => [c.label, c.returnAmount, c.otherAmount, c.difference, c.reconciled ? 'Reconciled' : 'Difference to explain']),
      ...(r.reconciliation.perAtc || []).map((a) => [`ATC ${a.atc || '(none)'}: return against QAP`, a.returnAmount, a.qapAmount, a.difference, a.difference === 0 ? 'Reconciled' : 'Difference to explain'])] });
  }
  return writeXlsx({ title: `BIR Form ${r.form} ${r.period.label}`, sheets });
}

/** One schedule as a worksheet with a totals row. */
export function scheduleSheet(s) {
  const rows = s.rows.map((r) => s.columns.map((c) => cell(r[c.key], c.type)));
  const tot = totalsRow(s.columns, s.totals);
  return { name: s.title.slice(0, 31), columns: s.columns.map((c) => ({ header: c.label, type: c.type === 'integer' ? 'integer' : c.type || 'text', width: c.type ? 16 : 26 })),
    rows: tot ? [...rows, tot] : rows, rowStyles: tot ? [...rows.map(() => null), 'bold'] : undefined };
}
