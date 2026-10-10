-- People and roles named in the CAS registration (Accounts > Tax > CAS Books and Documents):
--   cas.staff_roles               roles of the staff who may be named backup custodian or system contact (the pickers
--                                 list only them; producers and external users are left out; empty: every active user)
--   cas.document_excluded_roles   roles left out of the role list printed in the CAS documents (test roles such as SUPERID)
-- Idempotent: an administrator's values are kept.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('cas.staff_roles', '["accounting", "accounting-manager", "tis-finance", "tis-it-admin", "tis-general-manager", "system-admin"]', 'cas',
  'Roles of the staff who may be named CAS backup custodian or system contact (empty: every active user)', 'json'),
 ('cas.document_excluded_roles', '["tis-superid"]', 'cas', 'Roles left out of the user roles printed in the CAS documents (test roles)', 'json')
ON CONFLICT (key) DO NOTHING;
