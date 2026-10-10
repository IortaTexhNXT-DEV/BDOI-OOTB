-- Controls on the renewal terms and the dispositions of a renewal (Operations > Renewals):
--   * the terms submitted for approval are the terms approved and booked: the wizard and the renewal quotation refuse
--     a change while a renewal awaits approval, and Complete books the approved premium (renewals/service.js)
--   * an expired renewal quote is neither submitted nor completed; the renewal term follows the expiring one
--     (renewals.term_continuity)
--   * renewal terms are approved within the approver's Authority Matrix limit of the new transaction type
--     renewal_terms (renewals.require_authority_limit: an approver without a limit is refused)
--   * the renewal owner's unit reassigns a renewal or marks it Not for renewal, each with a coded reason and a remark
--     (permission assign:renewals); a renewal marked Not for renewal closes (status not-renewed, apart from a lapse)
--   * the reinstatement window is counted in Manila calendar days, or in working days
--     (renewals.reinstatement_day_basis)
--
-- Settings:
--   renewals.require_authority_limit   an approver of renewal terms needs a renewal_terms limit (off: the access
--                                      rule access.authority_without_limit decides)
--   renewals.term_continuity           a regular or grace-period renewal term starts the day after the expiring term
--                                      ends; a lapsed renewal is not backdated
--   renewals.reinstatement_day_basis   calendar | working
-- The status label of not-renewed (Not for renewal) is added to renewals.status_labels by seed 92_renewals_claims.sql.
--
-- Idempotent.

INSERT INTO authority_transaction_types(code, name, measure, description, sort_order) VALUES
 ('renewal_terms', 'Renewal terms approval', 'amount', 'Gross renewal premium of renewal terms approved in Operations > Renewals > Negotiations', 45)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('renewals.require_authority_limit', 'false', 'renewals', 'An approver of renewal terms needs a renewal terms limit in the Authority Matrix', 'boolean'),
 ('renewals.term_continuity', 'true', 'renewals', 'A renewal term starts the day after the expiring term ends (a lapsed renewal starts on the renewal date or later)', 'boolean'),
 ('renewals.reinstatement_day_basis', '"calendar"', 'renewals', 'Reinstatement window counted in calendar days or in working days (calendar | working)', 'string')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE renewals ADD COLUMN IF NOT EXISTS disposition text;
COMMENT ON COLUMN renewals.disposition IS 'How a closed renewal was disposed of besides renewal or lapse: not-for-renewal';

-- one open renewal per policy: a renewal marked not for renewal is closed like a renewed or lapsed one
DROP INDEX IF EXISTS renewals_open_policy_uq;
CREATE UNIQUE INDEX IF NOT EXISTS renewals_open_policy_uq ON renewals(policy_id) WHERE status NOT IN ('renewed', 'lapsed', 'not-renewed');

INSERT INTO permissions(code, module, description) VALUES
 ('assign:renewals', 'renewals', 'Reassign a renewal to another user or mark it not for renewal, with a reason')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain the permission get a new token version (the permissions travel in the access token);
-- only on the first run, while no role holds assign:renewals yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
               WHERE p.code = 'approve:renewals')
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'assign:renewals');

-- the roles that approve renewal terms (Sales Officer, Sales Unit Head, Operations Unit Head, General Manager and the
-- reference approvers) dispose of renewals
INSERT INTO role_permissions(role_id, permission_id)
SELECT rp.role_id, a.id FROM role_permissions rp JOIN permissions w ON w.id = rp.permission_id, permissions a
 WHERE w.code = 'approve:renewals' AND a.code = 'assign:renewals'
ON CONFLICT DO NOTHING;
