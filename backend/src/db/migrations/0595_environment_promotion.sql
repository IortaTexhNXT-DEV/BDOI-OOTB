-- Environment Promotion menu (TIS-BRD-NFR-08, TIS-BRD-NFR-8.2, Pre-BSM M17): the administrator moves the configuration
-- of one environment to the next with the Setup Workbook (the configuration kit of the data-load module), compares
-- environments and keeps the promotion path. promotion.path is the order of the environments; system.environment (the
-- marker of this database) is set on Promotion Path only and never travels in a workbook. TIS IT AppSupport / Admin
-- holds the data-load permissions. Idempotent.
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('promotion.path', '["dev", "sit", "uat", "preprod", "production"]', 'system', 'Order of the environments a configuration is promoted through (the codes of system.environment)', 'json', true),
 ('promotion.environment_labels', '{"dev": "Development", "sit": "System Integration Testing", "uat": "User Acceptance Testing", "preprod": "Pre-Production", "training": "Training", "production": "Production"}', 'system', 'Name shown for each environment code', 'json', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('read:data-load', 'write:data-load') WHERE r.code = 'tis-it-admin'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
