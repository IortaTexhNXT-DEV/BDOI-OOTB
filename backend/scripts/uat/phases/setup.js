/**
 * Set-up: sign in as the built-in administrator, create one persona per broker role (two where maker-checker needs a
 * second user), and the masters the business needs: insurers with credit terms, the commission rate matrix, bank
 * accounts linked to the ledger, insurer statement formats. Everything is looked up first, so a second run reuses it.
 */
import { Session, ApiError, dataOf, listOf } from '../http.js';
import { INSURERS, COMMISSION_OVERRIDES, BANK_ACCOUNTS } from '../data.js';
import { todayIn, timeline, monthStart, addMonths } from '../dates.js';

/** Job titles shown on the user records, by role. */
const DESIGNATIONS = {
  'system-admin': 'System Administrator', sales: 'Account Executive', processing: 'Placement Officer', operations: 'Client Service Officer',
  claims: 'Claims Officer', accounting: 'Accounting Officer', 'accounting-manager': 'Accounting Manager',
};

/** Persona users: key, username, name, roles. The key is how the phases refer to them. */
export const PERSONAS = [
  ['sysadmin', 'beatriz.lacson', 'Beatriz Lacson', ['system-admin']],
  ['sales1', 'maria.rivera', 'Maria Consuelo Rivera', ['sales']],
  ['sales2', 'paolo.dizon', 'Paolo Enrique Dizon', ['sales']],
  ['processing1', 'jose.bernardo', 'Jose Antonio Bernardo', ['processing']],
  ['processing2', 'rica.fernandez', 'Rica Mae Fernandez', ['processing']],
  ['operations', 'ana.buenaventura', 'Ana Lorraine Buenaventura', ['operations']],
  ['claims1', 'carlo.estrada', 'Carlo Miguel Estrada', ['claims']],
  ['claims2', 'joy.macaraeg', 'Joy Anne Macaraeg', ['claims']],
  ['accounting1', 'liza.quiambao', 'Liza Marie Quiambao', ['accounting']],
  ['accounting2', 'nestor.pangilinan', 'Nestor Pangilinan', ['accounting']],
  ['manager1', 'teresa.villaroman', 'Teresa Villaroman', ['accounting-manager']],
  ['manager2', 'ramon.almario', 'Ramon Almario', ['accounting-manager']],
];

async function ensurePersona(ctx, [key, username, name, roles]) {
  const { admin, api, cfg, log } = ctx;
  const [first, ...rest] = name.split(' ');
  const email = `${username}@example.ph`;
  const found = listOf(await admin.get('/users', { search: username, perPage: 5 })).find((u) => u.username === username);
  const session = new Session(api, username, name);
  if (!found) {
    // Without a password the administrator gets a temporary one; the persona changes it at the first sign-in.
    const created = dataOf(await admin.post('/users', { username, displayName: name, firstName: first, lastName: rest.join(' '), email, roles, branchCode: 'HO', designation: DESIGNATIONS[roles[0]] || roles[0] }));
    log.hide(created.temporaryPassword);
    await session.login(created.temporaryPassword, { newPassword: cfg.personaPassword });
    log.count('Persona users created');
  } else {
    try {
      await session.login(cfg.personaPassword);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      // The persona exists with another password (e.g. changed by hand): reset it through the administrator.
      const reset = dataOf(await admin.post(`/users/${found.userId}/reset-password`, {}));
      log.hide(reset.temporaryPassword);
      await session.login(reset.temporaryPassword, { newPassword: cfg.personaPassword });
      log.note(`Persona ${username} existed with another password; it was reset.`);
    }
  }
  ctx.as[key] = session;
  session.userId = session.user?.userId;
}

/** Find a master record by its code field. */
async function masterByCode(s, type, codeField, code) {
  const rows = listOf(await s.get(`/masters/${type}`, { search: code, perPage: 50 }));
  return rows.find((r) => String(r[codeField]) === String(code)) || null;
}

async function ensureInsurers(ctx) {
  const s = ctx.as.sysadmin;
  const { rnd, log } = ctx;
  for (const ins of INSURERS) {
    let row = await masterByCode(s, 'insurance-company', 'insuranceCompanyCode', ins.code);
    if (!row) {
      const place = { Makati: 'Ayala Ave.', Pasig: 'Ortigas Center', 'Cebu City': 'Cebu Business Park', 'Davao City': 'J.P. Laurel Ave.', 'Quezon City': 'Eastwood City', Manila: 'Port Area' };
      row = dataOf(await s.post('/masters/insurance-company', {
        insuranceCompanyCode: ins.code, insuranceCompanyName: ins.name, shortName: ins.short, insuranceCompanyDescription: 'Non-life insurer',
        tin: `${rnd.digits(3)}-${rnd.digits(3)}-${rnd.digits(3)}-000`, addressLine1: `${rnd.int(10, 40)}/F ${ins.short} Tower, ${place[ins.city] || 'Central Business District'}`,
        city: ins.city, state: ins.city === 'Cebu City' ? 'Cebu' : ins.city === 'Davao City' ? 'Davao del Sur' : 'Metro Manila', country: 'Philippines',
        email: `underwriting@${ins.short.toLowerCase().replace(/[^a-z]/g, '')}.example.ph`, phoneNumber: `(02) 8${rnd.digits(3)}-${rnd.digits(4)}`,
        contactPerson: `${rnd.pick(['Atty.', 'Ms.', 'Mr.'])} ${rnd.pick(['Reyes', 'Tolentino', 'Macapagal', 'Lopez', 'Ilagan'])}`,
        commissionRate: ins.rate, premiumWarrantyDays: ins.warrantyDays, remittanceTermsDays: ins.remitDays, defaultBillingMode: 'broker',
      }));
      log.count('Insurers created');
    }
    ctx.insurers[ins.code] = { ...ins, id: row.id };
  }
  // the credit terms the platform resolves for each insurer (warranty, remittance terms, billing mode)
  for (const ins of Object.values(ctx.insurers)) ins.terms = dataOf(await s.get(`/commission-rates/credit-terms/${ins.id}`));
}

async function ensureProducts(ctx) {
  const rows = listOf(await ctx.as.sysadmin.get('/masters/product', { perPage: 100 }));
  for (const p of rows) ctx.products[p.productCode] = { id: p.id, code: p.productCode, name: p.productName, line: p.lineofBusiness, businessType: p.businessType };
}

async function ensureCommissionRates(ctx) {
  // the commission rate matrix is a master (write:masters): maintained by the system administrator
  const s = ctx.as.sysadmin;
  const existing = listOf(await s.get('/commission-rates'));
  const start = `${ctx.months[0].start.slice(0, 4)}-01-01`;
  for (const [code, product, rate] of COMMISSION_OVERRIDES) {
    const ins = ctx.insurers[code];
    const prod = ctx.products[product];
    if (!ins || !prod) continue;
    if (existing.some((r) => r.insuranceCompanyId === ins.id && r.productId === prod.id)) continue;
    await ctx.log.step(`Commission rate ${code} / ${product} ${(rate * 100).toFixed(1)}%`, async () => {
      await s.post('/commission-rates', { insuranceCompanyId: ins.id, productId: prod.id, policyType: 'new', rate, effectiveFrom: start, remarks: 'Agreed brokerage per the broker agreement' });
      ctx.log.count('Commission rate rows');
    });
  }
  // renewals earn a lower rate with one insurer, so the matrix has a renewal row too
  const pcic = ctx.insurers['PCIC'];
  const motor = ctx.products.MOTOR;
  if (pcic && motor && !existing.some((r) => r.insuranceCompanyId === pcic.id && r.productId === motor.id && r.policyType === 'renewal')) {
    await ctx.log.step('Commission rate PCIC / MOTOR renewal', async () => {
      await s.post('/commission-rates', { insuranceCompanyId: pcic.id, productId: motor.id, policyType: 'renewal', rate: 0.175, effectiveFrom: start, remarks: 'Renewal brokerage per the broker agreement' });
      ctx.log.count('Commission rate rows');
    });
  }
  const check = dataOf(await s.get('/commission-rates/resolve', { insurerId: pcic.id, productId: motor.id, policyType: 'new' }));
  if (Math.abs(Number(check.rate) - 0.2) > 0.0001) throw new Error(`Commission rate resolution returned ${check.rate} for PCIC motor (expected 0.20)`);
}

async function ensureBankAccounts(ctx) {
  const s = ctx.as.sysadmin;
  const gl = { 'BDO-OPS': '1102001', 'MBT-COL': '1102003' };
  const reconcileFrom = ctx.months[0].start;
  for (const b of BANK_ACCOUNTS) {
    let row = await masterByCode(s, 'bank-account', 'accountCode', b.code);
    if (!row) {
      row = dataOf(await s.post('/masters/bank-account', { accountCode: b.code, accountName: b.name, bankCode: b.bankCode, bankName: b.bankName, accountNumber: b.accountNumber,
        accountType: b.accountType, currency: 'PHP', branch: 'Makati Main', branchCode: 'HO', openingDate: '2019-03-01' }));
      ctx.log.count('Bank accounts created');
    }
    const linked = listOf(await ctx.as.accounting1.get('/bank-reconciliation/bank-accounts')).find((a) => a.code === b.code);
    if (!linked?.glAccountCode) {
      // linking a bank account to its GL cash account is finance set-up (write:bank-reconciliation)
      await ctx.as.accounting1.put(`/bank-reconciliation/bank-accounts/${b.code}`, { glAccountCode: gl[b.code], statementFormat: b.bankCode === 'BDO' ? 'BDO-SAMPLE' : 'MBT-SAMPLE', reconcileFrom });
    }
    ctx.bankAccounts[b.code] = { ...b, glAccountCode: gl[b.code] };
  }
}

async function ensureInsurerFormats(ctx) {
  const s = ctx.as.accounting1;
  const formats = listOf(await s.get('/insurer-reconciliation/formats'));
  const wanted = [
    { code: 'PCIC-SOA', insurer: 'PCIC', name: 'Pacific Crest statement of account', columns: { policyNo: 'policy number', insured: 'assured', date: 'date remitted', reference: 'or number', grossPremium: 'gross premium', commission: 'commission', taxes: 'premium taxes', amountPaid: 'amount received' }, dateFormat: 'MM/DD/YYYY' },
    { code: 'LUZ-SOA', insurer: 'LUZ', name: 'Luzon Bay remittance confirmation', columns: { policyNo: 'pol no', insured: 'insured name', date: 'payment date', reference: 'reference', grossPremium: 'premium', commission: 'brokerage', amountPaid: 'net remitted' }, dateFormat: 'DD/MM/YYYY' },
  ];
  for (const f of wanted) {
    if (formats.some((x) => x.code === f.code)) continue;
    await s.post('/insurer-reconciliation/formats', { code: f.code, name: f.name, insurerId: ctx.insurers[f.insurer].id, columns: f.columns, dateFormat: f.dateFormat, hasHeader: true, skipRows: 0, skipPattern: '^(total|grand total)' });
    ctx.log.count('Insurer statement formats');
  }
}

/**
 * Settlement parameters of the remittance master: the reference data caps a settlement at PHP 500,000, below a single
 * corporate policy's premium, so the broker's own limit is set (the approval levels by amount still apply).
 */
async function settlementLimits(ctx) {
  const s = ctx.as.sysadmin;
  const row = listOf(await s.get('/masters/remittance-settlement-parameter', { perPage: 50 })).find((r) => r.code === 'STP-001');
  if (!row) throw new Error('Settlement parameter STP-001 is missing from the remittance master');
  if (Number(row.maximumAmount) < 10000000) await s.put(`/masters/remittance-settlement-parameter/${row.id}`, { maximumAmount: 10000000 });
}

/** Sub-agents who refer business (commission sub-agent lines, paid out through Disbursement). */
async function ensureReferrers(ctx) {
  const acc = ctx.as.accounting1;
  const wanted = [
    { id: 'uat-ref-rtiu', name: 'Rolando Tiu (dealer F&I officer)', type: 'Sub-agent', level: 'L1', bankName: 'BPI', bankAccountNo: '3179-0412-88', tin: '214-558-902-000', email: 'rolando.tiu@dealer.example.ph', phone: '09178820011' },
    { id: 'uat-ref-kaagapay', name: 'Kaagapay Insurance Agency', type: 'External', level: 'L1', bankName: 'BDO', bankAccountNo: '0071-5566-2201', tin: '008-771-340-000', email: 'billing@kaagapay.example.ph', phone: '(032) 8233-4410' },
  ];
  const have = listOf(await acc.get('/commission/referrer-accounts'));
  ctx.referrers = [];
  for (const r of wanted) {
    if (!have.some((x) => x.id === r.id)) {
      await acc.post('/commission/referrer-accounts', r);
      ctx.log.count('Sub-agent referrers');
    }
    ctx.referrers.push(r);
  }
}

/** Tax codes the commission taxes use must exist and be active (VAT 12% out, EWT on commission). */
async function checkTaxCodes(ctx) {
  const codes = listOf(await ctx.as.accounting1.get('/period-end/tax-codes'));
  const setup = dataOf(await ctx.as.accounting1.get('/account-determination/commission-taxes'));
  ctx.taxSetup = setup;
  const active = codes.filter((c) => c.active).map((c) => c.code);
  const needed = [setup?.vat?.enabled && setup.vat.code, setup?.ewt?.enabled && setup.ewt.code].filter(Boolean);
  const missing = needed.filter((c) => !active.includes(c));
  if (missing.length) throw new Error(`Commission tax code(s) not active: ${missing.join(', ')}`);
  ctx.log.info(`tax codes: ${codes.length} (${active.length} active); commission taxes use ${needed.join(', ') || 'the defaults'}`);
}

export async function setup(ctx) {
  const { log, cfg, api } = ctx;
  log.setPhase('Set-up');
  ctx.admin = new Session(api, cfg.adminUser, 'Administrator');
  await log.step(`Sign in as the administrator ${cfg.adminUser}`, () => ctx.admin.login(cfg.adminPassword), { critical: true });
  const settings = dataOf(await ctx.admin.get('/settings'));
  const flat = Object.fromEntries((settings || []).map((it) => [it.key, it.value]));
  ctx.settings = flat;
  ctx.today = todayIn(flat['general.timezone'] || 'Asia/Manila');
  ctx.months = timeline(ctx.today, cfg.months);
  log.info(`business date ${ctx.today}; months ${ctx.months.map((m) => m.period).join(', ')}`);
  const email = dataOf(await ctx.admin.get('/email/sending-status'));
  ctx.emailActive = Boolean(email?.active);
  log.info(`e-mail sending ${ctx.emailActive ? 'is ON' : 'is off (customer answers are recorded as customer responses)'}`);

  for (const p of PERSONAS) await log.step(`Persona ${p[1]} (${p[3].join(', ')})`, () => ensurePersona(ctx, p), { critical: true });
  await log.step('Products master', () => ensureProducts(ctx), { critical: true });
  await log.step('Insurers with credit terms', () => ensureInsurers(ctx), { critical: true });
  await log.step('Commission rate matrix', () => ensureCommissionRates(ctx));
  await log.step('Bank accounts linked to the ledger', () => ensureBankAccounts(ctx), { critical: true });
  await log.step('Insurer statement formats', () => ensureInsurerFormats(ctx));
  await log.step('Tax codes of the commission taxes', () => checkTaxCodes(ctx));
  await log.step('Sub-agent referrers', () => ensureReferrers(ctx));
  await log.step('Settlement limit of the remittance master', () => settlementLimits(ctx));
  ctx.firstMonth = monthStart(addMonths(ctx.today, -(cfg.months - 1)));
}
