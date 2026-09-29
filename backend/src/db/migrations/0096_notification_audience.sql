-- A notification without a user was shown to every signed-in user, so customer services received finance
-- approvals ("Journal voucher ... awaiting approval"). Such notifications now name the permission that can act on
-- them (audience); only users holding it (administrators hold every permission) see them. Existing role-less
-- approval notifications are given the audience of the module that raised them. Idempotent.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience text;

UPDATE notifications SET audience = CASE
    WHEN title LIKE 'Journal voucher % awaiting approval' THEN 'write:journal-vouchers'
    WHEN title = 'Incentive calculation awaiting approval' THEN 'write:incentive'
    WHEN title = 'Treaty awaiting approval' THEN 'write:reinsurance'
    WHEN title IN ('Commission debit note awaiting approval', 'Remittances awaiting approval') THEN 'write:remittance'
    WHEN title LIKE 'Petty cash %' THEN 'write:disbursements'
    WHEN entity = 'collection' THEN 'write:collections'
    ELSE audience END
WHERE user_id IS NULL AND audience IS NULL;
