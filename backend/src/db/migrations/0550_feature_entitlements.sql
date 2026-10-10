-- Feature entitlements: which functions of the platform this environment runs (modules/features).
--
-- The catalogue of features is code (modules/features/catalogue.js). Phase 1 and platform functions are always on and
-- have no row. A Phase 2 or future-release feature is on (or read-only after a disable with records) only while it has
-- a row here signed with ENTITLEMENT_SIGNING_KEY; no row means off. A row whose signature does not match counts as off.
--
-- Changes are requested and approved by two different iorta TechNXT platform administrators (feature_changes,
-- maker-checker), immediately or on a scheduled date. Each environment keeps its own state; a promotion from another
-- environment is a change request like any other.
--
-- Role iorta-platform-admin with manage:feature-entitlements, held by no tenant role. read:features (the read-only
-- Features & Releases of Master > System Configuration) for TIS IT AppSupport / Admin and the General Manager.
-- Setting features.notify_roles: who is told by e-mail and on the bell when a feature is enabled or disabled.
-- Idempotent.

CREATE TABLE IF NOT EXISTS feature_entitlements (
  feature_key text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('enabled', 'read_only')),
  effective_from timestamptz NOT NULL,
  change_id bigint,
  change_ref text,
  release_ref text,
  approved_by text,
  approved_at timestamptz,
  signature text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_changes (
  id bigserial PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('enable', 'disable')),
  tier text,
  features text[] NOT NULL,
  plan jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL,
  release_ref text NOT NULL,
  immediate boolean NOT NULL DEFAULT true,
  effective_at timestamptz,
  source text NOT NULL DEFAULT 'request' CHECK (source IN ('request', 'promotion')),
  source_environment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'applied', 'rejected', 'withdrawn')),
  requested_by text NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  remarks text,
  applied_at timestamptz
);
CREATE INDEX IF NOT EXISTS feature_changes_status_idx ON feature_changes(status, effective_at);

INSERT INTO roles(code, name, description, is_system) VALUES
 ('iorta-platform-admin', 'iorta TechNXT Platform Administrator', 'Vendor role: enables and disables the releases of the platform (Phase 2, future releases); no business access', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('manage:feature-entitlements', 'features', 'Request and approve the enabling and disabling of platform features (iorta TechNXT platform administrator only)'),
 ('read:features', 'features', 'See the catalogue of features and releases with their status')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('manage:feature-entitlements', 'read:features', 'read:profile')
WHERE r.code = 'iorta-platform-admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'read:features'
WHERE r.code IN ('system-admin', 'tis-it-admin', 'tis-general-manager')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp USING permissions p, roles r
WHERE rp.permission_id = p.id AND rp.role_id = r.id AND p.code = 'manage:feature-entitlements' AND r.code <> 'iorta-platform-admin';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('features.notify_roles', '["tis-it-admin", "tis-general-manager"]', 'security', 'Roles told by e-mail and notification when a platform feature is enabled or disabled', 'json')
ON CONFLICT (key) DO NOTHING;
