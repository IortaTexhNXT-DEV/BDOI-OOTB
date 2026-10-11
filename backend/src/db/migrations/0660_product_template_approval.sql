-- Product register maker-checker (TIS-BRD-PROD-03, TIS-BRD-SEC-03, RBAC v4 "A" on the Product Configurator for the
-- Unit Heads and the General Manager; gap register GAP-PLAT-09).
--
-- A product template is drafted by a holder of write:products, submitted for review (status Pending Approval) and put
-- in force (Active) only when a holder of approve:products who neither submitted nor last changed it approves it; a
-- return sends it back to Draft with the reviewer's note. Reactivating an inactive or retired template takes the same
-- route. Retiring stays one step (it only takes a product out of use).
--   product.approval_required      on: Draft -> Pending Approval -> Active (off: the status is set directly, as before)
--   product.lock_active_templates  on: a template in force and its components are changed only through a new version
--                                  (delivered off: switch it on once the product team works by versions)
-- Idempotent.

ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS decision_note text;
COMMENT ON COLUMN product_templates.decision IS 'Last review decision: approved or returned (product.approval_required)';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('product.approval_required', 'true', 'product', 'Product templates go in force only when a second user holding approve:products approves them (draft, review, approve)', 'boolean', true),
 ('product.lock_active_templates', 'false', 'product', 'A product template in force and its components are changed only through a new version (draft, review, approve)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

-- the review status joins the statuses a template can take (only while the list is the delivered one)
UPDATE app_settings SET value = '["Draft", "Pending Approval", "Active", "Inactive", "Retired"]'::jsonb, updated_at = now()
 WHERE key = 'product.template_statuses' AND value = '["Draft", "Active", "Inactive", "Retired"]'::jsonb;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('system-admin', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'approve:products');

INSERT INTO permissions(code, module, description) VALUES
 ('approve:products', 'products', 'Approve or return product templates submitted for review')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'approve:products'
 WHERE r.code IN ('system-admin', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager')
ON CONFLICT DO NOTHING;
