/**
 * Credit Life quotation rules (TIS-BRD-QUOT-06, PJRN-01, PJRN-03; CR-03, CR-04), setting credit_life.rules (migration
 * 0484): an individual borrower with no agent and one open quotation per loan account, under the age and account
 * limits and with no pending balance; priced at the fixed rate per 1,000 of sum insured; a sum insured below the
 * default is referred for approval before the quotation is sent or issued.
 */
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney, num, round2 } from '../../lib/money.js';
import { today } from '../../lib/dates.js';

const DEFAULTS = { products: ['CL-VOL'], maxAge: 65, maxAccounts: 6, ratePerThousand: 3.68, defaultSumInsured: 1000000, termYears: { min: 1, max: 5 }, siReductionRoles: [] };
export const SI_REDUCTION_RULE = 'CL_SI_REDUCTION';

export const creditLifeRules = async () => ({ ...DEFAULTS, ...((await getSetting('credit_life.rules', DEFAULTS)) || {}) });

/** Age in whole years on a date. */
export function ageOn(birth, on) {
  const [by, bm, bd] = String(birth).slice(0, 10).split('-').map(Number);
  const [y, m, d] = String(on).slice(0, 10).split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const fail = (path, message) => badRequest('Validation failed', [{ path: `creditLife.${path}`, message }]);

/**
 * The Credit Life terms of a quotation of a Credit Life product, or null for any other product. c: db client; party:
 * the lead or client row; quoteId: the quotation being changed (left out of the one-per-account check).
 * Returns { creditLife (stored on the document), doc (the priced fields), reduction (the referral rule or null) }.
 */
export async function creditLifeTerms(c, { productId = null, productType = null }, doc, party, quoteId = null) {
  const rules = await creditLifeRules();
  const product = (await c.query('SELECT code, name FROM products WHERE ($1::int IS NOT NULL AND id = $1::int) OR ($2::text IS NOT NULL AND (lower(code) = lower($2) OR lower(name) = lower($2))) LIMIT 1',
    [productId ? Number(productId) : null, productType || null])).rows[0];
  if (!product || !rules.products.map((x) => x.toUpperCase()).includes(String(product.code).toUpperCase())) return null;
  const cl = doc.creditLife || {};
  const account = String(cl.loanAccountNo || '').trim();
  if (!account) throw fail('loanAccountNo', 'Enter the TFS loan account number');
  if (party?.corporate) throw fail('customer', 'Credit Life covers individual borrowers only, not a corporate account');
  if (String(doc.accountCode || doc.referrerCode || doc.agentCode || '').trim()) throw fail('accountCode', 'A Credit Life quotation has no agent or referrer');
  const birth = cl.borrowerBirthDate || party?.birth_date;
  if (!birth) throw fail('borrowerBirthDate', "Enter the borrower's date of birth");
  const age = ageOn(birth, await today());
  if (age >= rules.maxAge) throw fail('borrowerBirthDate', `The borrower is ${age}: Credit Life excludes borrowers aged ${rules.maxAge} and over`);
  const accounts = Number(cl.accountCount);
  if (!Number.isInteger(accounts) || accounts < 1) throw fail('accountCount', "Enter the number of the borrower's TFS accounts");
  if (accounts > rules.maxAccounts) throw fail('accountCount', `The borrower has ${accounts} accounts: Credit Life excludes borrowers with more than ${rules.maxAccounts}`);
  if (num(cl.pendingBalance) > 0) throw fail('pendingBalance', 'The borrower has a pending balance: no Credit Life quotation until it is settled');
  const term = Number(cl.loanTermYears ?? rules.termYears.min);
  if (!Number.isInteger(term) || term < rules.termYears.min || term > rules.termYears.max) {
    throw fail('loanTermYears', `The term follows the loan tenor: ${rules.termYears.min} to ${rules.termYears.max} years`);
  }
  if (cl.ratePerThousand !== undefined && cl.ratePerThousand !== null && cl.ratePerThousand !== '' && num(cl.ratePerThousand) !== num(rules.ratePerThousand)) {
    throw fail('ratePerThousand', `The Credit Life rate is fixed at ${rules.ratePerThousand} per 1,000`);
  }
  const open = (await c.query(`SELECT quote_number FROM quotes WHERE deleted_at IS NULL AND id IS DISTINCT FROM $2 AND doc->'creditLife'->>'loanAccountNo' = $1
      AND status NOT IN ('rejected', 'dropped', 'expired', 'converted') LIMIT 1`, [account, quoteId])).rows[0];
  if (open) throw fail('loanAccountNo', `Loan account ${account} already has quotation ${open.quote_number}: one quotation per account`);
  const si = round2(num(cl.sumInsured) > 0 ? num(cl.sumInsured) : rules.defaultSumInsured);
  if (si > rules.defaultSumInsured) throw fail('sumInsured', `The sum insured is at most ${await formatMoney(rules.defaultSumInsured)}`);
  const net = round2((si / 1000) * num(rules.ratePerThousand));
  const reduction = si < rules.defaultSumInsured ? {
    ruleCode: SI_REDUCTION_RULE, outcome: 'referred', authorityRoles: rules.siReductionRoles, sumInsured: si,
    message: `Sum insured reduced from ${await formatMoney(rules.defaultSumInsured)} to ${await formatMoney(si)}: approval needed before issuance`,
  } : null;
  return {
    creditLife: { loanAccountNo: account, borrowerBirthDate: String(birth).slice(0, 10), borrowerAge: age, accountCount: accounts, pendingBalance: num(cl.pendingBalance),
      loanTermYears: term, sumInsured: si, ratePerThousand: num(rules.ratePerThousand), defaultSumInsured: rules.defaultSumInsured },
    doc: { totalSumInsured: si, netPremium: net, discount: 0 },
    reduction,
  };
}

/**
 * The referral of a quotation with a reduced Credit Life sum insured merged in: approved again only for the same sum
 * insured; otherwise pending for siReductionRoles (and the acceptance rules' authority roles).
 */
export function withReduction(referral, reduction, previous, roleNames = {}) {
  if (!reduction) return referral;
  const prior = previous?.creditLifeSumInsured;
  if (!referral && previous?.status === 'approved' && (previous.ruleCodes || []).includes(SI_REDUCTION_RULE) && num(prior) === num(reduction.sumInsured)) return previous;
  const base = referral && referral.status === 'pending' ? referral : { status: 'pending', ruleCodes: [], authorityRoles: [], authorityRoleNames: [], reasons: [], requestedAt: new Date().toISOString() };
  const roles = [...new Set([...(base.authorityRoles || []), ...reduction.authorityRoles])];
  return { ...base, ruleCodes: [...new Set([...(base.ruleCodes || []), SI_REDUCTION_RULE])], authorityRoles: roles,
    authorityRoleNames: roles.map((r) => roleNames[r] || r), reasons: [...(base.reasons || []), `${SI_REDUCTION_RULE}: ${reduction.message}`],
    creditLifeSumInsured: reduction.sumInsured };
}
