-- Reasons of the renewal and claim decisions on the Reason Codes master (Master > Insurance Management > Reason Codes).
-- The contexts are added to the Used For list of the master and their reasons to the master; a decision of these kinds
-- is taken with a reason code of its context and a remark, checked by requiredReason() in
-- src/modules/ops-masters/records.js:
--   renewal_reassign      reassign a renewal to another user (Operations > Renewals > Renewal Queue)
--   non_renewal           mark a renewal not for renewal
--   claim_cancel          cancel a claim registered in error (Operations > Claims)
--   claim_cash_reversal   reverse funds received from an insurer or a payment to the claimant recorded in error
--                         (Accounts > Claims Settlements)
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['renewal_reassign', 'non_renewal', 'claim_cancel', 'claim_cash_reversal']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['renewal_reassign', 'non_renewal', 'claim_cancel', 'claim_cash_reversal']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('RRA-WORKLOAD', 'Workload balancing', 'renewal_reassign', true, 900),
             ('RRA-LEAVE', 'Owner on leave', 'renewal_reassign', true, 910),
             ('RRA-TERRITORY', 'Territory or branch change', 'renewal_reassign', true, 920),
             ('RRA-RESIGNED', 'Owner left the company', 'renewal_reassign', true, 930),
             ('RRA-CLIENTREQ', 'Request of the client', 'renewal_reassign', true, 940),
             ('RRA-OTHER', 'Other', 'renewal_reassign', true, 990),
             ('NFR-LOANCLOSED', 'Loan fully paid or account closed', 'non_renewal', true, 1000),
             ('NFR-SOLD', 'Vehicle sold or asset disposed of', 'non_renewal', true, 1010),
             ('NFR-INSURER', 'Insurer declined to renew', 'non_renewal', true, 1020),
             ('NFR-RISK', 'Unacceptable claims experience', 'non_renewal', true, 1030),
             ('NFR-CLIENT', 'Client declined the renewal', 'non_renewal', true, 1040),
             ('NFR-BROKER', 'Placed with another broker', 'non_renewal', true, 1050),
             ('NFR-OTHER', 'Other', 'non_renewal', true, 1090),
             ('CCN-ERROR', 'Registered in error', 'claim_cancel', true, 1100),
             ('CCN-DUPLICATE', 'Duplicate notification of the same loss', 'claim_cancel', true, 1110),
             ('CCN-WITHDRAWN', 'Withdrawn by the claimant', 'claim_cancel', true, 1120),
             ('CCN-WRONGPOLICY', 'Registered on the wrong policy', 'claim_cancel', true, 1130),
             ('CCN-OTHER', 'Other', 'claim_cancel', true, 1190),
             ('CRV-AMOUNT', 'Wrong amount recorded', 'claim_cash_reversal', true, 1200),
             ('CRV-BANK', 'Wrong bank account', 'claim_cash_reversal', true, 1210),
             ('CRV-DUPLICATE', 'Recorded twice', 'claim_cash_reversal', true, 1220),
             ('CRV-RETURNED', 'Cheque returned or transfer failed', 'claim_cash_reversal', true, 1230),
             ('CRV-OTHER', 'Other', 'claim_cash_reversal', true, 1290)) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));

-- Status labels of the statuses added by migrations 0500 and 0502, while the label list does not have them yet.
UPDATE app_settings SET value = value || '{"not-renewed": "Not for renewal"}'::jsonb, updated_at = now()
 WHERE key = 'renewals.status_labels' AND NOT (value ? 'not-renewed');

-- ---------------------------------------------------------------- TISPH approval limits
-- Renewal terms and claim settlements are approved within an Authority Matrix limit (migrations 0500 and 0503). Proposed
-- limits until TISPH names its signing authority: renewal terms (gross renewal premium) Sales Officer PHP 250,000.00,
-- Sales Unit Head and Operations Unit Head PHP 1,000,000.00, General Manager without limit; claim settlements Operations
-- Unit Head PHP 500,000.00, General Manager without limit. An approver needs a limit (require_authority_limit). Only
-- where the TISPH roles exist; a setting is changed only while nobody has changed it, a limit added only where the role
-- has none for the type.
UPDATE app_settings s
   SET value = 'true'::jsonb, updated_at = now()
 WHERE s.key IN ('renewals.require_authority_limit', 'claims.require_authority_limit') AND s.updated_by IS NULL AND s.value = 'false'::jsonb
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-ops-unit-head');

INSERT INTO authority_limits(transaction_type, role_code, max_amount, status, remarks, decided_at, decision_note)
SELECT v.type, v.role, v.amount, 'active', 'Proposed approver until TISPH names its signing authority', now(), 'TISPH default'
FROM (VALUES ('renewal_terms', 'tis-sales-officer', 250000::numeric), ('renewal_terms', 'tis-sales-unit-head', 1000000),
             ('renewal_terms', 'tis-ops-unit-head', 1000000), ('renewal_terms', 'tis-general-manager', NULL),
             ('claim_settlement', 'tis-ops-unit-head', 500000), ('claim_settlement', 'tis-general-manager', NULL)) AS v(type, role, amount)
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.code = v.role)
  AND EXISTS (SELECT 1 FROM authority_transaction_types t WHERE t.code = v.type)
  AND NOT EXISTS (SELECT 1 FROM authority_limits l WHERE l.transaction_type = v.type AND l.role_code = v.role);
