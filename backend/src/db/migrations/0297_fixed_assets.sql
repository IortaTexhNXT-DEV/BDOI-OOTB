-- Fixed asset register (Accounts > Fixed Assets): assets with their class (generic master asset-class: useful life,
-- asset, accumulated depreciation and depreciation expense accounts), the straight-line depreciation schedule and the
-- monthly depreciation posting (posting rule fa.depreciation), run on its own or as a step of the month-end close.
CREATE TABLE IF NOT EXISTS fixed_assets (
  id text PRIMARY KEY DEFAULT ('fas_' || encode(gen_random_bytes(8), 'hex')),
  asset_number text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  class_code text NOT NULL,                            -- asset-class master code
  location text,
  custodian text,
  serial_number text,
  supplier_id int REFERENCES master_records(id),
  supplier_invoice_id text REFERENCES supplier_invoices(id),
  acquisition_date date NOT NULL,
  in_service_date date NOT NULL,
  cost numeric(14,2) NOT NULL CHECK (cost > 0),
  salvage_value numeric(14,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  useful_life_months int NOT NULL CHECK (useful_life_months BETWEEN 1 AND 600),
  method text NOT NULL DEFAULT 'straight-line' CHECK (method IN ('straight-line')),
  asset_account text NOT NULL,
  accumulated_account text NOT NULL,
  expense_account text NOT NULL,
  opening_accumulated numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_accumulated >= 0),   -- carried at go-live
  depreciate_from text NOT NULL CHECK (depreciate_from ~ '^\d{4}-\d{2}$'),                 -- first period depreciated here
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fully-depreciated', 'disposed')),
  disposed_on date, disposal_remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (salvage_value < cost), CHECK (in_service_date >= acquisition_date));
CREATE INDEX IF NOT EXISTS fixed_assets_class ON fixed_assets(class_code, status);

CREATE TABLE IF NOT EXISTS fixed_asset_depreciation (
  id bigserial PRIMARY KEY,
  asset_id text NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  accumulated_after numeric(14,2) NOT NULL,
  book_value_after numeric(14,2) NOT NULL,
  journal_id text REFERENCES journal_vouchers(id),
  close_run_id text,
  posted_by text, posted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period));
CREATE INDEX IF NOT EXISTS fixed_asset_depreciation_period ON fixed_asset_depreciation(period);
CREATE INDEX IF NOT EXISTS fixed_asset_depreciation_journal ON fixed_asset_depreciation(journal_id);
