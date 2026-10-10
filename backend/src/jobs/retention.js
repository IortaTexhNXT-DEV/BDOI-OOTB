/**
 * Data retention (scheduled job "data-retention", monthly): the closed contracts past their retention period
 * (TIS-BRD-NFR-11.1 five years for a closed contract, NFR-11.2 ten years for a contract with a claim; settings
 * retention.*). A policy that is expired, cancelled or lapsed for longer than the period of its rule is flagged
 * (policies.retention_due_at / retention_rule) and listed on Master > System Configuration > Security Controls.
 * With retention.action = anonymise, a client whose every contract is flagged has their personal data replaced
 * (clients.anonymised_at), as the withdrawn data-privacy module did; the financial records stay.
 */
import { query, withTransaction } from '../db/pool.js';
import { getSetting } from '../lib/settings.js';

const CLOSED = ['expired', 'cancelled', 'lapsed'];
/** The columns of a client replaced by anonymisation (the keys and codes stay, so the ledger and the policies keep their references). */
const CLIENT_PII = ['first_name', 'last_name', 'middle_name', 'suffix', 'preferred_name', 'email', 'phone', 'tin', 'tin_bidx', 'birth_date', 'place_of_birth', 'address', 'house_no',
  'barangay', 'road', 'city', 'state', 'postal_code', 'id_type', 'id_number', 'id_expiry', 'occupation', 'employer_name', 'source_of_funds', 'pep_details'];

const years = async (key, fallback) => {
  const v = Number(await getSetting(key, fallback));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** The policies due for retention action: { rule, years } per policy, from the closing date of the contract. */
async function flagDuePolicies(db, { closed, withClaim, now }) {
  const r = await db.query(`WITH closed AS (
      SELECT p.id, p.client_id,
        EXISTS (SELECT 1 FROM claims c WHERE c.policy_id = p.id) AS has_claim,
        GREATEST(COALESCE(p.expiry_date, p.updated_at::date), p.updated_at::date) AS closed_on
      FROM policies p WHERE p.status = ANY($1) AND p.retention_due_at IS NULL)
    UPDATE policies p SET retention_due_at = $4, retention_rule = CASE WHEN c.has_claim THEN 'claim-contract' ELSE 'closed-contract' END
    FROM closed c WHERE c.id = p.id
      AND ((c.has_claim AND $3 > 0 AND c.closed_on < ($4::date - make_interval(years => $3::int))) OR (NOT c.has_claim AND $2 > 0 AND c.closed_on < ($4::date - make_interval(years => $2::int))))
    RETURNING p.id, p.client_id, p.retention_rule`, [CLOSED, closed, withClaim, now]);
  return r.rows;
}

/** Anonymise the clients whose every policy is flagged and who have no open policy, quotation or claim. */
async function anonymiseClients(db, now) {
  const r = await db.query(`UPDATE clients c SET ${CLIENT_PII.map((col) => `${col} = NULL`).join(', ')},
      display_name = 'Anonymised client ' || c.client_code, company_name = CASE WHEN c.company_name IS NULL THEN NULL ELSE 'Anonymised client ' || c.client_code END,
      anonymised_at = $1, anonymised_by = 'data-retention', updated_at = now()
    WHERE c.anonymised_at IS NULL
      AND EXISTS (SELECT 1 FROM policies p WHERE p.client_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.client_id = c.id AND p.retention_due_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM claims k WHERE k.client_id = c.id AND lower(COALESCE(k.status, '')) NOT IN ('closed', 'settled', 'rejected', 'withdrawn', 'repudiated'))
    RETURNING c.id, c.client_code`, [now]);
  return r.rows;
}

/** Run the retention rules. `now` is for tests. Returns { flagged, anonymised, action }. */
export async function dataRetention(_params = {}, { now = new Date() } = {}) {
  const closed = await years('retention.closed_contract_years', 5);
  const withClaim = await years('retention.claim_contract_years', 10);
  const action = String(await getSetting('retention.action', 'flag')) === 'anonymise' ? 'anonymise' : 'flag';
  return withTransaction(async (db) => {
    const flagged = await flagDuePolicies(db, { closed, withClaim, now });
    const anonymised = action === 'anonymise' ? await anonymiseClients(db, now) : [];
    return { action, years: { closedContract: closed, claimContract: withClaim }, flagged: flagged.length, anonymised: anonymised.length,
      policies: flagged.map((p) => p.id), clients: anonymised.map((c) => c.client_code) };
  });
}

/** What the retention register shows: counts of flagged contracts per rule and the clients anonymised by the job. */
export async function retentionSummary() {
  const r = (await query(`SELECT count(*) FILTER (WHERE retention_rule = 'closed-contract')::int AS closed_contracts,
      count(*) FILTER (WHERE retention_rule = 'claim-contract')::int AS claim_contracts, max(retention_due_at) AS last_flagged_at FROM policies WHERE retention_due_at IS NOT NULL`)).rows[0];
  const a = (await query("SELECT count(*)::int AS n, max(anonymised_at) AS last FROM clients WHERE anonymised_by = 'data-retention'")).rows[0];
  return { closedContracts: r.closed_contracts, claimContracts: r.claim_contracts, lastFlaggedAt: r.last_flagged_at, anonymisedClients: a.n, lastAnonymisedAt: a.last };
}
