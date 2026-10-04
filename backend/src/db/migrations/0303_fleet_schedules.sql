-- Fleet schedules (Operations > Fleet Schedules): one motor policy covering many vehicles of a client.
--
-- fleet_schedules: the fleet of a client with one insurer and one period. While 'draft' vehicles are added (one by one
-- or from the Fleet Vehicles upload template); each vehicle is priced on its own with the quotation premium routine
-- (own damage rate x sum insured, acts of nature, excess bodily injury and property damage, the CTPL tariff of its
-- vehicle class, the premium taxes). Issuing the schedule issues one policy for the total (bill, booking journal,
-- commission) and the vehicles become the policy's schedule.
--
-- fleet_vehicles: the vehicles with their own premium figures. After issue a vehicle is added or deleted by an
-- endorsement: the premium of the change is the vehicle's annual premium pro-rata to the days left in the period
-- (fleet.pro_rata_basis), billed as additional premium or credited as return premium through the endorsement routine
-- (Operations > Policy > Endorsements), and the vehicle keeps the dates it was on cover.

CREATE TABLE IF NOT EXISTS fleet_schedules (
  id text PRIMARY KEY DEFAULT ('flt_' || encode(gen_random_bytes(8), 'hex')),
  fleet_number text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES clients(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  channel_id text REFERENCES distribution_channels(id),
  inception_date date NOT NULL,
  expiry_date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  policy_id text REFERENCES policies(id),
  owner_user_id text REFERENCES users(id),
  issued_at timestamptz,
  issued_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expiry_date > inception_date)
);
CREATE INDEX IF NOT EXISTS fleet_schedules_client_id_fk_idx ON fleet_schedules(client_id);
CREATE INDEX IF NOT EXISTS fleet_schedules_insurance_company_id_fk_idx ON fleet_schedules(insurance_company_id);
CREATE INDEX IF NOT EXISTS fleet_schedules_product_id_fk_idx ON fleet_schedules(product_id);
CREATE INDEX IF NOT EXISTS fleet_schedules_channel_id_fk_idx ON fleet_schedules(channel_id);
CREATE INDEX IF NOT EXISTS fleet_schedules_policy_id_fk_idx ON fleet_schedules(policy_id);
CREATE INDEX IF NOT EXISTS fleet_schedules_owner_user_id_fk_idx ON fleet_schedules(owner_user_id);

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id bigserial PRIMARY KEY,
  fleet_id text NOT NULL REFERENCES fleet_schedules(id) ON DELETE CASCADE,
  item_no int NOT NULL,
  plate_number text,
  conduction_sticker text,
  chassis_number text,
  engine_number text,
  make text,
  model text,
  year_model int,
  color text,
  vehicle_type text,
  usage text,
  mortgagee text,
  sum_insured numeric(14,2) NOT NULL DEFAULT 0,
  own_damage_rate numeric(8,4) NOT NULL DEFAULT 0,
  acts_of_nature_rate numeric(8,4) NOT NULL DEFAULT 0,
  bodily_injury numeric(14,2) NOT NULL DEFAULT 0,
  property_damage numeric(14,2) NOT NULL DEFAULT 0,
  include_ctpl boolean NOT NULL DEFAULT true,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,      -- own damage, acts of nature, excess liability (before taxes)
  taxes numeric(14,2) NOT NULL DEFAULT 0,            -- VAT, DST, LGT and other charges on the net premium
  ctpl_premium numeric(14,2) NOT NULL DEFAULT 0,     -- CTPL tariff amount (taxes included)
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,    -- annual premium of the vehicle
  breakdown jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  cover_from date,
  cover_to date,
  added_endorsement_id text REFERENCES endorsements(id),
  deleted_endorsement_id text REFERENCES endorsements(id),
  prorated_premium numeric(14,2),                    -- premium of the endorsement that added or deleted the vehicle
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fleet_vehicles_item_uq ON fleet_vehicles(fleet_id, item_no);
CREATE INDEX IF NOT EXISTS fleet_vehicles_added_endorsement_id_fk_idx ON fleet_vehicles(added_endorsement_id);
CREATE INDEX IF NOT EXISTS fleet_vehicles_deleted_endorsement_id_fk_idx ON fleet_vehicles(deleted_endorsement_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('fleet_schedule', 'Fleet Schedule', 'fleet', 'FLT', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Fleet schedule of a client (Operations > Fleet Schedules)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('read:fleet', 'fleet', 'View fleet schedules and print the schedule of vehicles'),
 ('write:fleet', 'fleet', 'Prepare and issue fleet schedules and add or delete vehicles by endorsement')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('system-admin', 'processing', 'operations') AND p.code IN ('read:fleet', 'write:fleet'))
    OR (r.code IN ('sales', 'claims', 'accounting') AND p.code = 'read:fleet')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('fleet.pro_rata_basis', '"days_in_period"', 'fleet', 'Pro-rata premium of a vehicle added or deleted mid-term: days_in_period (days left / days of the policy period) or days_365 (days left / 365)', 'string'),
 ('fleet.return_premium_on_delete', 'true', 'fleet', 'Credit the pro-rata premium of a deleted vehicle as return premium (off: deletion without refund)', 'boolean'),
 ('fleet.minimum_vehicles', '2', 'fleet', 'Minimum vehicles to issue a fleet schedule', 'number'),
 ('fleet.max_upload_rows', '1000', 'fleet', 'Maximum vehicles in one Fleet Vehicles upload', 'number')
ON CONFLICT (key) DO NOTHING;
