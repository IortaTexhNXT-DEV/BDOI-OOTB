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

-- ---------------------------------------------------------------- remittances register and import
-- Status names TISPH reads until the Phase 2 statuses arrive: a rejected remittance went back to its maker (Returned),
-- and a settled one has its payment voucher raised, which is not yet a payment (Settled (voucher raised)). Only while
-- the two labels are still the reference ones.
UPDATE app_settings s
   SET value = s.value || '{"rejected": "Returned", "settled": "Settled (voucher raised)"}'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.status_labels' AND s.updated_by IS NULL
   AND s.value->>'rejected' = 'Rejected' AND s.value->>'settled' = 'Completed'
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- Status names in sentence case, as the screens write them (migration 0404)
UPDATE app_settings s
   SET value = s.value || '{"for-approval": "Pending approval"}'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.status_labels' AND s.updated_by IS NULL AND s.value->>'for-approval' = 'Pending Approval'
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- Off-cycle remittances come from Import policy list only (migration 0402): the bulk upload of earlier releases, whose
-- typed amounts replaced the booked ones, is closed.
UPDATE app_settings s
   SET value = 'false'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.bulk_upload_enabled' AND s.updated_by IS NULL AND s.value = 'true'::jsonb
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- ---------------------------------------------------------------- insurer payments and schedules
-- Insurers are paid from Insurer payments, through Bank Payment Files and Disbursement (migration 0403): electronic
-- transfers are neither created, executed nor approved any more.
UPDATE app_settings s
   SET value = 'false'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.transfers_enabled' AND s.updated_by IS NULL AND s.value = 'true'::jsonb
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- An approved remittance is paid through the voucher of its settlement only, never marked settled by hand (migration 0404).
UPDATE app_settings s
   SET value = 'false'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.direct_settle_enabled' AND s.updated_by IS NULL AND s.value = 'true'::jsonb
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- The automated configurations ARM-001 and ARM-002 name insurers that are not on the TISPH panel, and SCH-001 runs
-- ARM-001: retired and paused while unchanged. TISPH remits weekly with TIS-WEEKLY: every Monday at 06:15 for the
-- policies of the Monday to Friday before, every active insurer. The "Remittance schedules" job of Master > Schedules
-- stays off until TISPH switches it on.
UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE ((type_code = 'remittance-automated' AND code IN ('ARM-001', 'ARM-002')) OR (type_code = 'remittance-schedule' AND code = 'SCH-001'))
   AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'remittance-schedule', 'TIS-WEEKLY', 'Weekly remittance',
       jsonb_build_object('code', 'TIS-WEEKLY', 'name', 'Weekly remittance', 'kind', 'Remittance run', 'allInsurers', true, 'insurers', '[]'::jsonb,
         'frequency', 'Weekly', 'paymentWindow', 'Previous Monday to Friday', 'groupBy', 'Insurer and product line', 'runTime', '06:15', 'cutOffDays', 0,
         'timezone', tz.name, 'nextRun', to_char(date_trunc('week', (now() AT TIME ZONE tz.name)::date) + interval '7 days', 'YYYY-MM-DD')),
       'active', 'seed'
  FROM (SELECT COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'general.timezone'), 'Asia/Manila') AS name) tz
 WHERE EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance')
   AND EXISTS (SELECT 1 FROM master_types WHERE code = 'remittance-schedule')
   AND NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'remittance-schedule' AND code = 'TIS-WEEKLY');
