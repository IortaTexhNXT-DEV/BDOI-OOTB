-- Enabling of Phase 2 by TISPH (TIS-BRD-NFR-8.2; TISPH decisions FT-D01 fixed assets and FT-D02 sales dashboard of
-- 11 October 2026: both Phase 2, enabled by the SUPERID role). Besides the iorta TechNXT platform administrator, a user
-- of the tenant may request, approve and withdraw the enabling and disabling of Phase 2 functions on Master > System
-- Configuration > Features & Releases, with the same controls (impact preview, dependencies, reason and release
-- reference, effective date, signed entitlements, audit trail, notices, read-only on a disable; modules/features/tenant.js).
--
-- Permission enable:phase2-features, granted to tis-superid (and held by the System Administrator, who holds every
-- permission of the tenant); it counts only together with a role of the setting features.tenant_enable_roles.
-- Settings (group security):
--   features.tenant_enable_roles     roles whose holders of the permission enable Phase 2 (default ["tis-superid"]); SUPERID
--                                    is for UAT and set inactive before go-live, so in Production the platform administrator
--                                    stays the enabler unless TISPH names another role here and grants it the permission
--   features.tenant_enable_tiers     tiers the tenant may switch (default ["PHASE_2"]; future releases never; [] switches the
--                                    enabling by TISPH off)
--   features.tenant_enable_approval  four-eyes (default: a second enabler or a platform administrator approves, never the
--                                    requester) or single (the request applies at once; DEV only, ignored in production)
-- feature_changes.channel (platform or tenant) and feature_changes.approval (four-eyes or single) record who raised a
-- change and how it was approved. Idempotent.

ALTER TABLE feature_changes ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'platform';
ALTER TABLE feature_changes ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'four-eyes';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_changes_channel_check') THEN
    ALTER TABLE feature_changes ADD CONSTRAINT feature_changes_channel_check CHECK (channel IN ('platform', 'tenant'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_changes_approval_check') THEN
    ALTER TABLE feature_changes ADD CONSTRAINT feature_changes_approval_check CHECK (approval IN ('four-eyes', 'single'));
  END IF;
END $$;

INSERT INTO permissions(code, module, description) VALUES
 ('enable:phase2-features', 'features', 'Request, approve and withdraw the enabling and disabling of Phase 2 functions of this environment (with a role of features.tenant_enable_roles)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('enable:phase2-features', 'read:features')
WHERE r.code IN ('tis-superid', 'system-admin')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('features.tenant_enable_roles', '["tis-superid"]', 'security', 'Roles whose users holding Enable Phase 2 functions (enable:phase2-features) enable and disable Phase 2 on Features & Releases, besides the iorta TechNXT platform administrator', 'json', true),
 ('features.tenant_enable_tiers', '["PHASE_2"]', 'security', 'Release tiers TISPH enables itself on Features & Releases: PHASE_2 or nothing (future releases are enabled by the platform administrator only)', 'json', true),
 ('features.tenant_enable_approval', '"four-eyes"', 'security', 'Approval of a Phase 2 change raised by TISPH: four-eyes (a second enabler or the platform administrator approves) or single (applies at once; development only, ignored in production)', 'string', true)
ON CONFLICT (key) DO NOTHING;
