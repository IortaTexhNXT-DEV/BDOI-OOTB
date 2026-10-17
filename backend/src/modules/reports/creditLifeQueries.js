/**
 * Credit Life reports (merged into QUERIES):
 *   cliGenerated   CLI Generated Report (TIS-BRD-RPT-OPS-01, CR-14): the Credit Life certificates of cover generated
 *                  from the financing bank's batches (credit-life module) with an issue date between From and To: the
 *                  batch, the certificate and master policy, the borrower with birth date, age at the start of cover and
 *                  gender, the TFS 10-digit loan account, the loan with its outstanding balance and its booking,
 *                  release and maturity dates, the cover, the sum insured and premium, and the status (in force or
 *                  cancelled).
 */
const cliGenerated = `SELECT b.batch_number AS "batchNumber", b.period AS "batchMonth", m.certificate_number AS "certificateNumber", mp.master_number AS "masterPolicy",
    m.customer_no AS "customerNo", concat_ws(', ', m.last_name, m.first_name) AS borrower, m.birth_date AS "birthDate",
    date_part('year', age(COALESCE(m.cover_from, m.release_date), m.birth_date))::int AS age, CASE m.gender WHEN 'M' THEN 'Male' WHEN 'F' THEN 'Female' END AS gender,
    m.loan_account AS "loanAccount", m.loan_amount AS "loanAmount", m.outstanding_balance AS "outstandingBalance", m.loan_term_months AS "loanTermMonths",
    m.booking_date AS "bookingDate", m.release_date AS "releaseDate", m.maturity_date AS "maturityDate", m.cover_from AS "coverFrom", m.cover_to AS "coverTo",
    m.sum_insured AS "sumInsured", m.premium, CASE m.status WHEN 'cancelled' THEN 'Cancelled' ELSE 'In force' END AS status, m.status AS _status,
    m.issued_at::date AS "issuedOn", CASE WHEN m.email_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS emailed,
    c.id AS _client_id, c.client_code AS _client_code, c.display_name AS client,
    ic.id::text AS _insurer_id, ic.code AS _insurer_code, ic.name AS insurer,
    pr.id::text AS _product_id, pr.code AS _product_code, pr.name AS product
  FROM credit_life_members m JOIN credit_life_batches b ON b.id = m.batch_id
  LEFT JOIN credit_life_master_policies mp ON mp.id = m.master_policy_id
  JOIN clients c ON c.id = b.financing_client_id
  JOIN insurance_companies ic ON ic.id = b.insurance_company_id
  LEFT JOIN products pr ON pr.id = b.product_id
  WHERE m.status IN ('issued', 'cancelled') AND m.issued_at::date BETWEEN $1 AND $2`;

export const CREDIT_LIFE_QUERIES = {
  cliGenerated: {
    sql: cliGenerated, filters: ['insurer', 'client', 'product'],
    criteria: { All: { groupBy: 'batchNumber' }, 'In force': { where: "t._status = 'issued'" }, Cancelled: { where: "t._status = 'cancelled'" } },
    orderBy: 'f."batchNumber", f."certificateNumber"',
  },
};
