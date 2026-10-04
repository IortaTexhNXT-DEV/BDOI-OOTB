/**
 * Bank endorsement letter of a brand-new vehicle programme: the letter to the financing bank confirming that the car
 * it finances is insured with the bank as mortgagee (subject and body from motor_programmes.bank_letter_subject /
 * bank_letter_body), with the policy, vehicle and mortgagee clause, signed by the default signatory.
 */
import { pool } from '../../db/pool.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../../lib/template.js';
import { today } from '../../lib/dates.js';
import { header, formatters, kv } from '../documents/templates.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';

const LETTER_SQL = `SELECT s.*, p.policy_number, p.inception_date, p.expiry_date, p.sum_insured, p.insured_name, p.doc AS policy_doc, p.currency,
    ic.name AS insurer_name, q.quote_number, q.doc AS quote_doc, k.name AS bank_branch_name, k.channel_type AS bank_type, k.letter_addressee AS branch_addressee,
    k.address AS branch_address, k.contact_person AS branch_contact, kp.name AS bank_parent_name, kp.letter_addressee AS parent_addressee, kp.address AS parent_address,
    d.name AS dealer_name
  FROM dealer_sales s LEFT JOIN policies p ON p.id = s.policy_id LEFT JOIN quotes q ON q.id = s.quote_id
  LEFT JOIN insurance_companies ic ON ic.id = COALESCE(p.insurance_company_id, q.insurance_company_id)
  LEFT JOIN distribution_channels k ON k.id = s.bank_channel_id LEFT JOIN distribution_channels kp ON kp.id = k.parent_id
  LEFT JOIN distribution_channels d ON d.id = s.dealer_channel_id`;

/** Letter spec of one sale (needs a financing bank). */
export async function bankLetterSpec(saleId, db = pool) {
  const s = (await db.query(`${LETTER_SQL} WHERE s.id = $1`, [String(saleId)])).rows[0];
  if (!s) throw notFound('Dealer sale not found');
  if (!s.bank_channel_id) throw badRequest('This sale has no financing bank: there is no bank endorsement letter for a cash sale');
  const bankName = s.bank_type === 'bank_branch' && s.bank_parent_name ? s.bank_parent_name : s.bank_branch_name;
  const doc = s.policy_doc || s.quote_doc || {};
  const buyerName = [s.buyer_first_name, s.buyer_last_name].filter(Boolean).join(' ') || s.buyer_company_name;
  const vars = { bankName, buyerName, policyNumber: s.policy_number || s.quote_number || '' };
  const h = await header('Bank Endorsement Letter', s.policy_number || s.quote_number);
  const f = formatters(h);
  const subject = renderTemplate(await getSetting('motor_programmes.bank_letter_subject', 'Confirmation of insurance cover with mortgagee clause'), vars, { html: false });
  const body = renderTemplate((await getSetting('motor_programmes.bank_letter_body', null)) || '', vars, { html: false });
  const addressee = s.branch_addressee || s.parent_addressee || 'The Manager, Auto Loans';
  const signatory = await signatoryFor(null);
  return {
    ...h,
    meta: kv([['Date', f.date(await today())], ['To', addressee], ['Bank', bankName], ['Branch', s.bank_type === 'bank_branch' ? s.bank_branch_name : ''],
      ['Address', s.branch_address || s.parent_address], ['Subject', subject]]),
    sections: [
      { text: `Dear ${s.branch_contact || 'Sir / Madam'},` },
      { text: body },
      { heading: 'Policy and vehicle', rows: kv([['Policy number', s.policy_number || `To follow (quotation ${s.quote_number})`], ['Insurer', s.insurer_name],
        ['Insured / borrower', buyerName], ['Period of cover', s.inception_date ? `${f.date(s.inception_date)} to ${f.date(s.expiry_date)}` : ''],
        ['Vehicle', [s.year_model, s.make, s.model, s.variant].filter(Boolean).join(' ')], ['Colour', s.color], ['Chassis number', s.chassis_number],
        ['Engine number', s.engine_number], ['Plate / conduction sticker', s.plate_number || s.conduction_sticker],
        ['Sum insured', s.sum_insured || s.invoice_price ? f.ccy(s.sum_insured || s.invoice_price, s.currency) : ''],
        ['Loan amount', s.loan_amount ? f.ccy(s.loan_amount, s.currency) : ''], ['Dealer', s.dealer_name], ['Sales invoice', s.invoice_number]]), columns: 1 },
      { heading: 'Mortgagee clause', text: doc.mortgageeClause || `Loss, if any, payable to ${bankName} as mortgagee.` },
      { signatures: [signatureBlock('Very truly yours', signatory)] },
    ],
  };
}

/** Specs of every sale with a financing bank in a batch (optionally of one bank), for one PDF. */
export async function batchLetterSpecs(batchId, bankChannelId = null) {
  const ids = (await pool.query(`SELECT id FROM dealer_sales WHERE batch_id = $1 AND status = 'created' AND bank_channel_id IS NOT NULL
    AND ($2::text IS NULL OR bank_channel_id = $2) ORDER BY row_no`, [batchId, bankChannelId])).rows.map((r) => r.id);
  if (!ids.length) throw badRequest('No financed sale in this batch: there is no bank endorsement letter to print');
  const specs = [];
  for (const id of ids) specs.push(await bankLetterSpec(id));
  return specs;
}
