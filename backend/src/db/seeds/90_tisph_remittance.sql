-- TISPH configuration of Accounts > Remittance. Runs after the reference seeds, on a new database and on every start
-- of one in use, only where the TISPH roles exist (db/seed.js, migration 0348). Idempotent: a setting is changed only
-- while it still holds the reference value and nobody has changed it, and a limit is added only where the role has
-- none for the transaction type, so administrator changes are kept. One section per subject.

-- ---------------------------------------------------------------- authority
-- Remittance approvals (migration 0400): an approver needs a remittance limit in the Authority Matrix, and an approval
-- is not handed to another user one by one (an absent approver is covered by a dated delegation).
UPDATE app_settings s
   SET value = v.value, updated_at = now()
  FROM (VALUES ('remittance.require_authority_limit', 'false'::jsonb, 'true'::jsonb),
               ('remittance.item_delegation_enabled', 'true'::jsonb, 'false'::jsonb)) AS v(key, reference, value)
 WHERE s.key = v.key AND s.updated_by IS NULL AND s.value = v.reference
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- Proposed approvers and their limits, until TISPH names its remittance approvers: TIS Finance & General Accounting up
-- to PHP 1,000,000.00 and the TIS General Manager without limit, for remittances and for settlements, adjustments and
-- transfers. A limit for one named user (Limit for one person) takes precedence over these role limits.
INSERT INTO authority_limits(transaction_type, role_code, max_amount, status, remarks, decided_at, decision_note)
SELECT v.type, v.role, v.amount, 'active', 'Proposed remittance approver until TISPH names its approvers', now(), 'TISPH default'
FROM (VALUES ('remittance', 'tis-finance', 1000000::numeric), ('remittance', 'tis-general-manager', NULL),
             ('remittance_settlement', 'tis-finance', 1000000), ('remittance_settlement', 'tis-general-manager', NULL)) AS v(type, role, amount)
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.code = v.role)
  AND EXISTS (SELECT 1 FROM authority_transaction_types t WHERE t.code = v.type)
  AND NOT EXISTS (SELECT 1 FROM authority_limits l WHERE l.transaction_type = v.type AND l.role_code = v.role);
