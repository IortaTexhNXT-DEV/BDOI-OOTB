-- Configuration and masters: metadata-driven master registry, generic master store,
-- and extension columns on the 0002 reference tables so every master screen field persists.

-- Registry of master screens. Each entry describes the fields a screen edits (the front end's own field names),
-- where the records live (generic store or an existing reference table) and which keys must be unique.
CREATE TABLE IF NOT EXISTS master_types (
  code text PRIMARY KEY,                       -- country, branch, taxation, remittance-schedule ...
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',    -- general | finance | product | remittance | reinsurance | incentive
  screen text,                                 -- front-end route of the master screen
  storage text NOT NULL DEFAULT 'generic',     -- generic (master_records) | table (existing reference table)
  table_name text,                             -- reference table when storage = 'table'
  code_field text,                             -- field holding the business code (unique per type)
  label_field text,                            -- field used as the option label in dropdowns
  fields jsonb NOT NULL DEFAULT '[]',          -- [{name,label,type,required,options,optionsFrom,column,ref,auto}]
  unique_keys jsonb NOT NULL DEFAULT '[]',     -- [["CountryName"], ["CurrencyCode","ToCurrencyCode","EffectiveFrom"]]
  allow_extra boolean NOT NULL DEFAULT false,  -- keep fields not declared in the definition (nested configuration screens)
  sort_order int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT true,     -- system types cannot be deleted; their storage is fixed
  status text NOT NULL DEFAULT 'active',
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Generic master store: one row per record, the record's fields kept under their front-end names.
CREATE TABLE IF NOT EXISTS master_records (
  id serial PRIMARY KEY,
  type_code text NOT NULL REFERENCES master_types(code) ON UPDATE CASCADE,
  code text,
  name text,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',       -- active | inactive | deleted
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS master_records_code_uq ON master_records(type_code, lower(code)) WHERE code IS NOT NULL AND status <> 'deleted';
CREATE INDEX IF NOT EXISTS master_records_type_idx ON master_records(type_code, status);
CREATE INDEX IF NOT EXISTS master_records_data_idx ON master_records USING gin (data jsonb_path_ops);

-- Extension columns on the reference tables so fields without a dedicated column persist (attrs)
-- and every master carries who changed it and when.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['countries','states','cities','currencies','banks','insurance_companies','products','policy_types',
                           'vehicle_brands','vehicle_models','vehicle_variants','coverages','signatories','branches'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT ''{}''', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
  END LOOP;
END $$;

-- Document-number prefix from configuration (numbering.<entity>.prefix), used by seed scripts.
CREATE OR REPLACE FUNCTION numbering_prefix(p_entity text, p_default text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.' || p_entity || '.prefix'), p_default)
$$;
