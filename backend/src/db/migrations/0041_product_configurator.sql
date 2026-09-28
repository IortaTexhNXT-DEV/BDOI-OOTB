-- Product configurator: templates (extends product_templates), configuration components and risk mappings.
ALTER TABLE product_templates
  ADD COLUMN IF NOT EXISTS template_code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS line_of_business text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS version_label text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS base_rate numeric(10,4),
  ADD COLUMN IF NOT EXISTS min_premium numeric(14,2),
  ADD COLUMN IF NOT EXISTS max_premium numeric(14,2),
  ADD COLUMN IF NOT EXISTS commission_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurers jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS parent_id int REFERENCES product_templates(id),
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_reason text,
  ADD COLUMN IF NOT EXISTS updated_by text;
CREATE UNIQUE INDEX IF NOT EXISTS product_templates_code_uq ON product_templates(lower(template_code), version) WHERE template_code IS NOT NULL;

-- Coverages, rating factors, underwriting rules, documents, workflows, market mappings, commission structures,
-- statutory taxes, acceptance limits and rating parameters of a template (component fields as the screens use them).
CREATE TABLE IF NOT EXISTS product_components (
  id serial PRIMARY KEY,
  template_id int REFERENCES product_templates(id) ON DELETE CASCADE,
  kind text NOT NULL,
  code text,
  name text,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active',
  sort_order int NOT NULL DEFAULT 100,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_components_idx ON product_components(kind, template_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS product_components_code_uq ON product_components(kind, COALESCE(template_id, 0), lower(code)) WHERE code IS NOT NULL AND status <> 'Deleted';

-- Risk mapping: which risk definition a product line uses, with optional risk sections (IAR).
CREATE TABLE IF NOT EXISTS product_risk_mappings (
  id text PRIMARY KEY DEFAULT ('prm_' || encode(gen_random_bytes(6), 'hex')),
  product_code text NOT NULL UNIQUE,
  lob_code text NOT NULL,
  product_name text NOT NULL,
  line_of_business text,
  definition_type text NOT NULL,
  definition_label text,
  status text NOT NULL DEFAULT 'Active',
  configuration jsonb NOT NULL DEFAULT '{}',
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_risk_sections (
  id text PRIMARY KEY DEFAULT ('prs_' || encode(gen_random_bytes(6), 'hex')),
  mapping_id text NOT NULL REFERENCES product_risk_mappings(id) ON DELETE CASCADE,
  section_code text NOT NULL,
  section_label text NOT NULL,
  remarks text,
  default_rate_percent numeric(8,4),
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mapping_id, section_code)
);
