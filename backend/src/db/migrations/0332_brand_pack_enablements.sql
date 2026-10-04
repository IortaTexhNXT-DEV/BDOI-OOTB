-- Bundled brand packs (Master > System Settings > Theme and Branding > Brand packs > Bundled packs).
--
-- A bundled pack ships with the product under backend/assets/brand-packs/<id>/ (manifest.json, theme.json, images)
-- and is never applied by default: a System Administrator enables it on the screen after acknowledging that the
-- environment belongs to the client engagement whose contract with iorta TechNXT covers the marks the pack carries. Each enablement is one row here
-- (who, when, the acknowledgement, what the branding was before, so "Back to default" can restore the print logo of
-- the primary company); going back to the iorta TechNXT default closes the row (status reverted) and enabling
-- another pack closes it as replaced. The audit trail carries the same facts (entity branding, actions enable-pack
-- and reset-default).
CREATE TABLE IF NOT EXISTS brand_pack_enablements (
  id serial PRIMARY KEY,
  pack_id text NOT NULL,
  pack_name text NOT NULL,
  pack_version text,
  trademark_owner text,
  acknowledged_permission boolean NOT NULL DEFAULT false CHECK (acknowledged_permission = true),
  acknowledgement_text text NOT NULL,
  applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous jsonb,
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'reverted', 'replaced')),
  enabled_by_user_id text REFERENCES users(id),
  enabled_by text,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  reverted_by_user_id text REFERENCES users(id),
  reverted_by text,
  reverted_at timestamptz
);
CREATE INDEX IF NOT EXISTS brand_pack_enablements_status_idx ON brand_pack_enablements(status, enabled_at DESC);
