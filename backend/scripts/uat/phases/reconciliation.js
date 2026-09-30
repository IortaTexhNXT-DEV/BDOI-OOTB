/**
 * Reconciliation. Bank: the operating account's opening balance at go-live is journalised (maker-checker), then each
 * closed month's bank statement is imported in the BDO export format, matched automatically and by hand, bank-only items
 * are booked as adjustments, and the month's reconciliation is prepared and approved. Insurers: statements of account of
 * three insurers are imported (two with their own column formats) with deliberate differences, resolved with notes and one
 * adjustment that the Accounting Manager approves.
 */
import { dataOf } from '../http.js';
import { addDays, minDate, monthEnd } from '../dates.js';

const OPENING_BALANCE = 3500000;
const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const mdY = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
const dmY = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** The operating account's balance at go-live, brought in by a manual journal (maker-checker) dated the day before. */
async function openingBalance(ctx) {
  const date = addDays(ctx.months[0].start, -1);
  const jv = dataOf(await ctx.as.accounting1.post('/journal-vouchers', { transactionCode: 'JV01', transactionDescription: 'Go-live: balance of the BDO operating account', date,
    entries: [{ mainAccount: '1102001', entryType: 'Debit', currencyCode: 'PHP', foreignAmount: OPENING_BALANCE, remarks: 'Balance per bank at go-live', branchCode: 'HO', departmentCode: 'FI' },
      { mainAccount: '5101001', entryType: 'Credit', currencyCode: 'PHP', foreignAmount: OPENING_BALANCE, remarks: 'Opening balance brought forward from the old system', branchCode: 'HO', departmentCode: 'FI' }] }));
  await ctx.as.accounting2.post(`/journal-vouchers/${jv.id}/approve`, {});
  ctx.log.count('Manual journal vouchers approved');
}

/**
 * One month's bank statement built from the book: deposits clear 0 to 2 days after the receipt, cheques 3 to 8 days
 * after they are issued (later ones carry over as deposits in transit and outstanding cheques), plus the bank's own
 * charges, interest and the final tax on it.
 */
function buildStatement(ctx, month, book, carried, opening) {
  const { rnd } = ctx;
  const lines = [];
  const next = [];
  // one deposit a month reaches the bank a week late without a reference: outside the date window of the automatic
  // rules, so it is matched by hand
  const late = book.find((b) => b.amount > 0 && addDays(b.date, 7) <= month.end);
  for (const b of [...carried, ...book]) {
    const lag = b === late ? 6 : b.amount > 0 ? rnd.int(0, 2) : rnd.int(3, 8);
    const date = b.bankDate || addDays(b.date, lag);
    if (date > month.end) { next.push({ ...b, bankDate: date }); continue; }
    const deposit = b.amount > 0;
    // most deposits quote the official receipt number; some come in as plain cash / cheque deposits (amount and date match)
    const withRef = deposit ? b !== late && rnd.chance(0.7) : true;
    const reference = deposit ? (withRef ? b.documentNumber || '' : '') : (b.chequeNumber || b.documentNumber || '');
    const description = deposit ? (withRef ? `DEPOSIT ${b.documentNumber || ''}`.trim() : rnd.pick(['CHECK DEPOSIT', 'CASH DEPOSIT', 'INSTAPAY CREDIT'])) : b.chequeNumber ? 'CHECK ENCASHMENT' : 'DEBIT MEMO';
    lines.push({ date, description, reference, debit: deposit ? 0 : -b.amount, credit: deposit ? b.amount : 0, bookId: b.id });
  }
  const end = month.end;
  const interest = Math.round(opening * 0.0025 / 12 * 100) / 100;
  lines.push({ date: end, description: 'SERVICE CHARGE', reference: '', debit: 150, credit: 0, bankOnly: 'BCHG' });
  lines.push({ date: end, description: 'INTEREST CREDIT', reference: '', debit: 0, credit: interest, bankOnly: 'INT' });
  lines.push({ date: end, description: 'W/TAX ON INTEREST', reference: '', debit: Math.round(interest * 0.2 * 100) / 100, credit: 0, bankOnly: 'FTAX' });
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let balance = opening;
  for (const l of lines) { balance = Math.round((balance + l.credit - l.debit) * 100) / 100; l.balance = balance; }
  return { lines, closing: balance, next };
}

/** BDO account activity export: Posting Date, Description, Debit, Credit, Running Balance, Check Number. */
const bdoCsv = (lines) => Buffer.from(['Posting Date,Description,Debit,Credit,Running Balance,Check Number',
  ...lines.map((l) => [mdY(l.date), l.description, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '', money(l.balance), l.reference].map(cell).join(','))].join('\n'));

async function bankMonth(ctx, month, state) {
  const acc = ctx.as.accounting1;
  const code = 'BDO-OPS';
  const ws = dataOf(await acc.get('/bank-reconciliation/workspace', { bankAccount: code, period: month.period }));
  const carriedIds = new Set(state.carried.map((c) => c.id));
  const book = ws.bookLines.filter((b) => !b.matchId && b.date >= month.start && b.date <= month.end && !carriedIds.has(b.id));
  const st = buildStatement(ctx, month, book, state.carried, state.opening);
  const file = bdoCsv(st.lines);
  const preview = dataOf(await acc.upload('POST', '/bank-reconciliation/statements/preview', { bankAccount: code, format: 'BDO-SAMPLE' }, [{ field: 'file', name: `bdo-${month.period}.csv`, type: 'text/csv', data: file }]));
  if (!preview.balanced) throw new Error(`Statement ${month.period} does not balance in the preview`);
  const imported = dataOf(await acc.upload('POST', '/bank-reconciliation/statements/import', { bankAccount: code, format: 'BDO-SAMPLE', statementRef: `BDO SOA ${month.period}`,
    openingBalance: money(state.opening), closingBalance: money(st.closing) }, [{ field: 'file', name: `bdo-${month.period}.csv`, type: 'text/csv', data: file }]));
  ctx.log.count('Bank statements imported');
  ctx.log.count('Bank statement lines', st.lines.length);
  const auto = imported.autoMatch?.matched ?? Object.values(imported.autoMatch?.byRule || {}).reduce((s, n) => s + n, 0);
  ctx.log.count('Bank lines matched automatically', auto);
  // what the rules could not match: bank-only items become adjustments, the rest is matched by hand
  const after = dataOf(await acc.get('/bank-reconciliation/workspace', { bankAccount: code, period: month.period }));
  for (const line of after.bankLines.filter((l) => !l.matchId)) {
    const src = st.lines.find((l) => l.date === line.date && l.description === line.description && Math.abs((l.credit - l.debit) - line.amount) < 0.005);
    if (src?.bankOnly) {
      await acc.post(`/bank-reconciliation/bank-lines/${line.id}/adjustment`, { typeCode: src.bankOnly, remarks: `${line.description} ${month.period}` });
      ctx.log.count('Bank adjustments booked');
    } else if (src?.bookId) {
      await acc.post('/bank-reconciliation/matches', { bankAccount: code, bankLineIds: [line.id], bookLineIds: [src.bookId], remarks: 'Matched to the deposit slip / cheque register' });
      ctx.log.count('Bank lines matched by hand');
    } else {
      throw new Error(`Bank line ${line.date} ${line.description} ${line.amount} has no source in the generated statement`);
    }
  }
  const rec = dataOf(await acc.post('/bank-reconciliation/reconciliations', { bankAccount: code, period: month.period }));
  if (Math.abs(rec.statement.difference) > 0.005) throw new Error(`Bank reconciliation ${month.period} differs by ${rec.statement.difference}`);
  await acc.post(`/bank-reconciliation/reconciliations/${rec.id}/prepare`, { remarks: `Deposits in transit ${money(rec.statement.depositsInTransit)}, outstanding cheques ${money(rec.statement.outstandingCheques)}` });
  await ctx.as.manager1.post(`/bank-reconciliation/reconciliations/${rec.id}/approve`, { remarks: 'Reviewed with the bank statement' });
  ctx.log.count('Bank reconciliations approved');
  state.opening = st.closing;
  state.carried = st.next;
}

async function currentMonthStatement(ctx, month, state) {
  const acc = ctx.as.accounting1;
  const code = 'BDO-OPS';
  const cutOff = addDays(ctx.today, -3);
  const ws = dataOf(await acc.get('/bank-reconciliation/workspace', { bankAccount: code, period: month.period }));
  const carriedIds = new Set(state.carried.map((c) => c.id));
  const book = ws.bookLines.filter((b) => !b.matchId && b.date >= month.start && b.date <= cutOff && !carriedIds.has(b.id));
  const st = buildStatement(ctx, { ...month, end: cutOff }, book, state.carried, state.opening);
  // bank-only items of the month so far: an unidentified deposit and the charge for a returned cheque
  const extra = [{ date: addDays(cutOff, -2), description: 'DEPOSIT - UNIDENTIFIED', reference: '', debit: 0, credit: 12500, bankOnly: 'open' },
    { date: addDays(cutOff, -1), description: 'RETURNED CHECK CHARGE', reference: '', debit: 500, credit: 0, bankOnly: 'open' }];
  const lines = [...st.lines.filter((l) => !['BCHG', 'INT', 'FTAX'].includes(l.bankOnly)), ...extra].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let balance = state.opening;
  for (const l of lines) { balance = Math.round((balance + l.credit - l.debit) * 100) / 100; l.balance = balance; }
  const file = bdoCsv(lines);
  const imported = dataOf(await acc.upload('POST', '/bank-reconciliation/statements/import', { bankAccount: code, format: 'BDO-SAMPLE', statementRef: `BDO SOA ${month.period} (to ${cutOff})`,
    openingBalance: money(state.opening), closingBalance: money(balance) }, [{ field: 'file', name: `bdo-${month.period}-to-date.csv`, type: 'text/csv', data: file }]));
  ctx.log.count('Bank statements imported');
  ctx.log.count('Bank statement lines', lines.length);
  const auto = imported.autoMatch?.matched ?? Object.values(imported.autoMatch?.byRule || {}).reduce((sum, n) => sum + n, 0);
  ctx.log.count('Bank lines matched automatically', auto);
  const open = dataOf(await acc.get('/bank-reconciliation/workspace', { bankAccount: code, period: month.period })).summary;
  ctx.log.info(`bank ${month.period}: ${open.unmatchedBank} bank line(s) and ${open.unmatchedBook} book line(s) still to match`);
}

/** Insurer statement of account: the remitted policies as the insurer reports them, with deliberate differences. */
async function insurerStatement(ctx, code, format, remitted) {
  const { rnd, as, log } = ctx;
  const acc = as.accounting1;
  const ins = ctx.insurers[code];
  const rows = [];
  for (const r of remitted) {
    const rem = dataOf(await acc.get(`/remittance/remittances/${r.remittanceId}`));
    for (const p of rem.policies || []) rows.push({ policyNo: p.policyNo, insured: p.insuredName, date: r.date, reference: `${ins.short.split(' ')[0].toUpperCase()}-OR-${rnd.digits(6)}`, gross: p.premium, commission: p.commission, taxes: p.tax, paid: p.netAmount });
  }
  if (rows.length < 2) throw new Error(`Too few remitted policies for a statement from ${code}`);
  // differences: the insurer applied a lower commission on one policy, lists a policy placed by another broker, and
  // leaves out the last remitted policy (remitted after its cut-off)
  const [first, second, ...rest] = rows;
  const lower = { ...second, commission: Math.round((second.commission - 250) * 100) / 100, paid: Math.round((second.paid + 250) * 100) / 100 };
  const foreign = { policyNo: `${ins.short.split(' ')[0].toUpperCase()}-PC-${rnd.digits(6)}`, insured: 'Dizon Hardware Trading', date: first.date, reference: `OR-${rnd.digits(6)}`, gross: 15840.5, commission: 2376.08, taxes: 0, paid: 13464.42 };
  const listed = [first, lower, ...rest.slice(0, -1), foreign];
  const periodFrom = remitted.map((r) => r.date).sort()[0];
  const periodTo = remitted.map((r) => r.date).sort().at(-1);
  let csv;
  if (format === 'PCIC-SOA') {
    csv = ['Policy Number,Assured,Date Remitted,OR Number,Gross Premium,Commission,Premium Taxes,Amount Received',
      ...listed.map((l) => [l.policyNo, l.insured, mdY(l.date), l.reference, money(l.gross), money(l.commission), money(l.taxes || 0), money(l.paid)].map(cell).join(',')), 'TOTAL,,,,,,,'];
  } else if (format === 'LUZ-SOA') {
    csv = ['Pol No,Insured Name,Payment Date,Reference,Premium,Brokerage,Net Remitted',
      ...listed.map((l) => [l.policyNo, l.insured, dmY(l.date), l.reference, money(l.gross), money(l.commission), money(l.paid)].map(cell).join(','))];
  } else {
    csv = ['Policy No,Insured,Date,Reference,Gross Premium,Commission,Taxes,Amount Paid',
      ...listed.map((l) => [l.policyNo, l.insured, l.date, l.reference, money(l.gross), money(l.commission), money(l.taxes || 0), money(l.paid)].map(cell).join(','))];
  }
  const s = dataOf(await acc.upload('POST', '/insurer-reconciliation/statements/import', { insurerId: ins.id, statementType: 'premium', periodFrom, periodTo, formatCode: format,
    statementRef: `SOA-${code}-${periodTo.slice(0, 7)}`, tolerance: 1 }, [{ field: 'file', name: `soa-${code}.csv`, type: 'text/csv', data: Buffer.from(csv.join('\n')) }]));
  log.count('Insurer statements imported');
  log.count('Insurer statement lines', s.lines.length);
  const matched = s.lines.filter((l) => l.matchStatus === 'matched').length;
  log.count('Insurer statement lines matched automatically', matched);
  for (const l of s.lines.filter((x) => x.matchStatus !== 'matched')) {
    if (l.matchStatus === 'difference') {
      // the adjustment: the lower commission the insurer applied is accepted (commission income reduced)
      await acc.post(`/insurer-reconciliation/statements/${s.id}/resolutions`, { lineId: l.id, kind: 'adjustment', commissionAdjustment: Math.round(-(l.differences?.commission || -250) * 100) / 100,
        note: 'Insurer applies its standard rate on this line; broker accepts the lower commission' });
      log.count('Insurer statement adjustments');
    } else {
      await acc.post(`/insurer-reconciliation/statements/${s.id}/resolutions`, { lineId: l.id, kind: 'note', note: 'Policy placed by another broker; insurer asked to remove it from our statement' });
      log.count('Insurer statement differences resolved with a note');
    }
  }
  const detail = dataOf(await acc.get(`/insurer-reconciliation/statements/${s.id}`));
  for (const x of detail.missingInInsurer || []) {
    await acc.post(`/insurer-reconciliation/statements/${s.id}/resolutions`, { brokerType: x.type, brokerId: x.id, kind: 'note', note: 'Remitted after the insurer statement cut-off; will appear next month' });
    log.count('Insurer statement differences resolved with a note');
  }
  await acc.post(`/insurer-reconciliation/statements/${s.id}/submit`, {});
  const ap = dataOf(await as.manager2.post(`/insurer-reconciliation/statements/${s.id}/approve`, { remarks: 'Differences agreed with the insurer' }));
  if (ap.status !== 'approved') throw new Error(`Insurer statement ${s.statementNumber} not approved (${ap.status})`);
  log.count('Insurer reconciliations approved');
}

export async function reconciliation(ctx) {
  const { log } = ctx;
  log.setPhase('Reconciliation: bank and insurer statements');
  await log.step('Opening balance of the operating bank account (journal voucher, maker-checker)', () => openingBalance(ctx));
  const state = { opening: OPENING_BALANCE, carried: [] };
  for (const month of ctx.months.filter((m) => !m.current)) {
    const ok = await log.step(`Bank statement and reconciliation ${month.period}`, async () => { await bankMonth(ctx, month, state); return true; });
    if (!ok) { state.ok = false; break; } // later months build on this month's closing balance
  }
  // the current month: the statement so far is imported and matched automatically; what is left (an unidentified
  // deposit, a charge not yet booked) stays open until the month is reconciled
  const current = ctx.months.find((m) => m.current);
  if (current && state.ok !== false) {
    await log.step(`Bank statement ${current.period} to date (open month, matching in progress)`, () => currentMonthStatement(ctx, current, state));
  }
  // insurer statements for the insurers with the most remittances
  const byInsurer = new Map();
  for (const r of ctx.remitted || []) byInsurer.set(r.insurerCode, [...(byInsurer.get(r.insurerCode) || []), r]);
  const picks = [['PCIC', 'PCIC-SOA'], ['LUZ', 'LUZ-SOA'], [[...byInsurer.keys()].find((k) => !['PCIC', 'LUZ'].includes(k)), 'GENERIC']];
  for (const [code, format] of picks) {
    if (!code || !byInsurer.get(code)?.length) { log.note(`No remittance to ${code || 'a third insurer'}: its statement of account was not reconciled`); continue; }
    await log.step(`Insurer statement of account ${code} (${format})`, () => insurerStatement(ctx, code, format, byInsurer.get(code)));
  }
  ctx.state.bankClosing = state.opening;
  ctx.state.lastRecDate = minDate(monthEnd(ctx.months.at(-2).start), ctx.today);
}
