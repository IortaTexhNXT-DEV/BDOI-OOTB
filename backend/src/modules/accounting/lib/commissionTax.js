/**
 * Taxes on the brokerage commission of broker-billed business.
 *
 * On a broker-billed policy the broker keeps its commission out of the premium it remits, so the insurer is billed for
 * the commission implicitly. The same taxes as on a direct-bill commission debit note apply:
 *   - output VAT on the commission (the broker's sale of services), borne by the insurer: the premium due to the
 *     insurer is reduced by it;
 *   - expanded withholding tax the insurer withholds on the commission (BIR 2307 to the broker): the broker pays it
 *     back with the premium, so the premium due to the insurer is increased by it and the broker books a creditable
 *     withholding tax receivable.
 *
 * Rates and GL accounts come from the tax codes master (tax.commission_vat_code, tax.commission_ewt_code); a tax code
 * without a GL account falls back to the account roles output_vat / creditable_wht (Account Determination). Each tax
 * can be switched off (accounting.broker_billed_commission_vat / _ewt), e.g. for a broker that is not VAT registered.
 */
import { query } from '../../../db/pool.js';
import { getSetting } from '../../../lib/settings.js';
import { round2 } from '../../../lib/money.js';

const ZERO = { commission_vat: 0, commission_ewt: 0 };

async function taxCodeRow(db, code) {
  if (!code) return null;
  return (await db.query('SELECT code, description, tax_type, rate, atc, gl_account, payee_kind, active FROM tax_codes WHERE code = $1', [String(code)])).rows[0] || null;
}

/**
 * Rate of a tax code (Master > Finance > Taxation, tax_codes), the one source of every commission tax rate: output VAT
 * and EWT on broker-billed and direct-bill commission, and the withholding tax on sub-agent / agent commission.
 * { code, rate (fraction, 0.12), found, active, atc, glAccount, payeeKind, description }; a missing or inactive code
 * gives rate 0, so nothing is withheld or charged on a code the tax team withdrew.
 */
export async function taxCodeRate(db, code) {
  const row = await taxCodeRow(db || { query }, code);
  return { code: code || null, rate: row?.active ? Number(row.rate) / 100 : 0, found: !!row, active: !!row?.active, atc: row?.atc || null, glAccount: row?.gl_account || null,
    payeeKind: row?.payee_kind || null, description: row?.description || null };
}

/**
 * Commission tax set-up in force: { vat: { enabled, code, rate, glAccount, atc }, ewt: { ... } }. rate is a fraction
 * (0.12); a missing or inactive tax code gives rate 0 so nothing is booked on a code the tax team withdrew.
 */
export async function commissionTaxSetup(db) {
  const out = {};
  for (const [kind, flag, codeKey, fallback] of [['vat', 'accounting.broker_billed_commission_vat', 'tax.commission_vat_code', 'VAT12-OUT'],
    ['ewt', 'accounting.broker_billed_commission_ewt', 'tax.commission_ewt_code', 'WC139']]) {
    const enabled = (await getSetting(flag, true)) !== false;
    const code = (await getSetting(codeKey, fallback)) || null;
    const row = await taxCodeRow(db, code);
    out[kind] = { enabled, code, rate: enabled && row?.active ? Number(row.rate) / 100 : 0, glAccount: row?.gl_account || null, atc: row?.atc || null,
      description: row?.description || null, found: !!row, active: !!row?.active };
  }
  return out;
}

/** Output VAT and EWT on a commission amount at the set-up rates (or given rates { vat, ewt } as fractions). */
export function commissionTaxes(commission, rates) {
  const c = round2(commission);
  if (!c || !rates) return { ...ZERO };
  return { commission_vat: round2(c * (Number(rates.vat) || 0)), commission_ewt: round2(c * (Number(rates.ewt) || 0)) };
}

/** Rates as fractions from a set-up ({ vat, ewt }). */
export const ratesOf = (setup) => ({ vat: setup?.vat?.rate || 0, ewt: setup?.ewt?.rate || 0 });

/** GL account of a commission tax: the tax code's account, else null (the posting rule line falls back to its role). */
export async function commissionTaxAccount(db, kind) {
  const setup = await commissionTaxSetup(db);
  return setup[kind]?.glAccount || null;
}
