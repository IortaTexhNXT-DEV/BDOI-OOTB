-- Masking of personal data by role (Data Privacy Act of 2012, RA 10173; NPC Circular 16-01 on security of personal data).
--
-- view:pii ("View full personal identifiers"): without it, a user receives TIN, government ID numbers, mobile numbers,
-- e-mail addresses, bank account numbers and birth dates partially masked in every API response and every export
-- (lib/pii.js, lib/piiPolicy.js). Which keys are personal comes from the masking tool's catalogue
-- (scripts/lib/pii-catalogue.js). Delivered to the System Administrator, Sales (account executives call and write to
-- their clients), Operations (client servicing, data subject requests) and Accounting (BIR forms, payees' bank
-- accounts); Processing and Claims see masked values unless the broker grants it in Master > Users and Access > Roles.
--
-- privacy.pii_reveal_mode 'on-request' makes holders see masked values too until they switch on "Show full
-- identifiers"; each request answered in full is then recorded in the audit trail (entity personal_data, action unmask).

INSERT INTO permissions(code, module, description) VALUES
 ('view:pii', 'privacy', 'View full personal identifiers: TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'sales', 'operations', 'accounting', 'accounting-manager') AND p.code = 'view:pii'
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('privacy.masking_enabled', 'true', 'privacy', 'Mask personal identifiers (TIN, government ID, mobile, e-mail, bank account, birth date) for users without the permission View full personal identifiers', 'boolean'),
 ('privacy.pii_reveal_mode', '"always"', 'privacy', 'Users with View full personal identifiers: always (full values) or on-request (masked until they switch on Show full identifiers; each request is recorded in the audit trail)', 'string'),
 ('privacy.masking_exempt_paths', '["/api/auth", "/api/s3", "/api/settings", "/api/system-settings", "/api/data-load", "/api/privacy/parties", "/api/health"]', 'privacy', 'API paths answered without masking (sign-in and own profile, files, configuration, go-live workbench, personal data export to a data subject)', 'json')
ON CONFLICT (key) DO NOTHING;
