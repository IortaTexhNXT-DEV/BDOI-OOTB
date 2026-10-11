-- Withdraw, cancel and revoke a remittance (TIS-BRD-COMM-01, COMM-04, CANC-03; FRS FR-RMT-014, FR-RMT-040; gap register
-- GAP-REMIT-23; remittance/lifecycle.js). Each takes a reason of its context of the Reason Codes master (seed
-- 89_remittance_reasons.sql: remittance_withdraw, remittance_cancel, remittance_revoke) and is written to the audit
-- trail of the remittance:
--   withdraw  a remittance awaiting approval back to Draft, by its submitter or preparer (the approval closes Withdrawn)
--   cancel    a draft or returned remittance; its policies are free for the next run
--   revoke    the approval of a remittance not yet on a settlement, billed or paid, by a holder of approve:remittance;
--             the remittance returns to its preparer and its policies no longer read remitted
-- A remittance holding a policy cancelled since it was drafted is not submitted (validateRemittances).
--
-- Setting remittance.revoke_enabled: an approved remittance not yet paid may have its approval revoked.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('remittance.revoke_enabled', 'true', 'remittance', 'The approval of a remittance not yet on a settlement, billed or paid may be revoked by a holder of approve:remittance, with a reason; the remittance returns to its preparer', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
