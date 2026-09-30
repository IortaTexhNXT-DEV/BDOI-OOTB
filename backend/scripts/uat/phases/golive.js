/**
 * Go-live: the in-force book of the broker's old system is loaded with the policy bulk upload (mode go-live: no bill,
 * journal or commission, the old system billed them). These policies expire during the scenario and feed the renewals.
 */
import { dataOf, listOf } from '../http.js';
import { addDays, addMonths } from '../dates.js';
import { person, slug } from './common.js';
import { VEHICLES } from '../data.js';

const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export async function goLive(ctx) {
  const { rnd, log, as } = ctx;
  log.setPhase('Go-live migration');
  const n = Math.round(14 * ctx.cfg.scale);
  const first = ctx.months[0].start;
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    // expiries spread from the first month of the scenario to three months after today
    const expiry = addDays(addMonths(first, Math.floor((i * (ctx.cfg.months + 2)) / n)), rnd.int(3, 25));
    const inception = addDays(addMonths(expiry, -12), 1);
    const fire = i % 5 === 4;
    const p = person(rnd);
    const v = rnd.pick(VEHICLES);
    const si = fire ? rnd.amount(2000000, 8000000, 100000) : rnd.amount(v.value[0], v.value[1], 10000);
    const net = Math.round(si * (fire ? 0.0022 : 0.0165));
    const gross = Math.round(net * (fire ? 1.2725 : 1.2525) * 100) / 100 + (fire ? 0 : 610.4);
    const insurer = ctx.insurers[rnd.pick(['UAT-PCIC', 'UAT-LUZ', 'UAT-VIS', 'UAT-MIN'])];
    rows.push({ 'Policy Number': `OLD-${fire ? 'FI' : 'MC'}-${inception.slice(0, 4)}-${rnd.digits(5)}`, 'Insured Name': `${p.firstName} ${p.lastName}`, 'First Name': p.firstName,
      'Last Name': p.lastName, Email: p.emailId, 'Contact Number': p.contactNumber, 'Product Type': fire ? 'Fire' : 'Motor', 'Insurance Company': insurer.name,
      'Inception Date': inception, 'Expiry Date': expiry, 'Issue Date': addDays(inception, -rnd.int(3, 10)), 'Sum Insured': si, 'Net Premium': net, 'Gross Premium': gross,
      'Plate Number': fire ? '' : `${rnd.letters(3)} ${rnd.digits(4)}`, 'Payment Status': 'Completed', _vehicle: v, _person: p, _insurer: insurer.code });
  }
  const header = Object.keys(rows[0]).filter((k) => !k.startsWith('_'));
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n');
  await log.step(`Upload ${rows.length} in-force policies of the old system (mode go-live)`, async () => {
    const r = dataOf(await as.processing1.upload('POST', '/policies/bulk-upload', { mode: 'go-live' }, [{ field: 'file', name: 'old-system-in-force.csv', type: 'text/csv', data: Buffer.from(csv) }]));
    if (r.failed) throw new Error(`${r.failed} row(s) refused: ${JSON.stringify(r.errors).slice(0, 300)}`);
    log.count('Go-live: in-force policies migrated', r.created);
  }, { critical: true });
  ctx.migrated = [];
  for (const row of rows) {
    const p = listOf(await as.processing1.get('/policies', { search: row['Policy Number'], pageSize: 5 })).find((x) => x.policyNumber === row['Policy Number']);
    if (!p) continue;
    ctx.migrated.push({ id: p.policyId || p.id, policyNumber: p.policyNumber, clientId: p.clientId, product: row['Product Type'] === 'Fire' ? 'FIRE' : 'MOTOR', lob: p.lob,
      insurerCode: row._insurer, inception: row['Inception Date'], expiry: row['Expiry Date'], gross: row['Gross Premium'], net: row['Net Premium'], sumInsured: row['Sum Insured'],
      vehicle: row._vehicle, prospect: row._person, plate: row['Plate Number'], name: `${row._person.firstName} ${row._person.lastName}`, email: slug(row._person.firstName) });
  }
}
