-- Fixed asset disposal (Accounts > Fixed Assets > Disposals): the sale or write-off of an asset.
--
-- The disposal removes the asset's cost and its accumulated depreciation (opening plus posted) from the books and
-- posts the difference with the proceeds as a gain or a loss, through posting rule fa.disposal:
--   Dr accumulated depreciation (asset's account)          accumulated
--   Dr bank account received into, else the receivable     receivable  (proceeds + output VAT; sale only)
--   Dr loss on disposal                                    loss
--   Cr asset account (asset's account)                     cost
--   Cr output VAT (tax code fixed_assets.disposal_vat_code) vat        (sale by a VAT-registered broker)
--   Cr gain on disposal                                    gain
-- A sale on credit is collected through its sales invoice (issued with the disposal, source asset_disposal), so the
-- receivable is the sales invoice receivable. The asset becomes disposed and is no longer depreciated; depreciation up
-- to the month before the disposal must be posted first (fixed_assets.disposal_requires_depreciation_to_date).
-- A disposal can be cancelled: its journal is reversed, its sales invoice cancelled and the asset restored.
CREATE TABLE IF NOT EXISTS fixed_asset_disposals (
  id text PRIMARY KEY DEFAULT ('fad_' || encode(gen_random_bytes(8), 'hex')),
  disposal_number text NOT NULL UNIQUE,
  asset_id text NOT NULL REFERENCES fixed_assets(id),
  disposal_date date NOT NULL,
  disposal_type text NOT NULL CHECK (disposal_type IN ('sale', 'write-off')),
  reason text,
  buyer_name text,
  buyer_tin text,
  buyer_address text,
  cost numeric(14,2) NOT NULL,
  accumulated_depreciation numeric(14,2) NOT NULL,
  book_value numeric(14,2) NOT NULL,
  proceeds numeric(14,2) NOT NULL DEFAULT 0 CHECK (proceeds >= 0),   -- selling price net of VAT
  vat_code text,
  output_vat numeric(14,2) NOT NULL DEFAULT 0,
  gross_proceeds numeric(14,2) NOT NULL DEFAULT 0,                   -- proceeds + output VAT
  gain_loss numeric(14,2) NOT NULL,                                  -- proceeds - book value (negative: loss)
  bank_account text,                                                 -- received into (Bank Account master); null: on credit
  journal_id text REFERENCES journal_vouchers(id),
  sales_invoice_id text REFERENCES sales_invoices(id),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  reversal_journal_id text REFERENCES journal_vouchers(id),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (disposal_type = 'sale' OR proceeds = 0));
CREATE UNIQUE INDEX IF NOT EXISTS fixed_asset_disposals_one_posted ON fixed_asset_disposals(asset_id) WHERE status = 'posted';
CREATE INDEX IF NOT EXISTS fixed_asset_disposals_date ON fixed_asset_disposals(disposal_date);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS disposal_id text;
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS status_before_disposal text;

-- a sales invoice made out for an asset sold
ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_source_type_check;
ALTER TABLE sales_invoices ADD CONSTRAINT sales_invoices_source_type_check CHECK (source_type IN ('manual', 'debit_note', 'override_commission', 'policy_commission', 'asset_disposal'));

-- GL accounts of the gain and loss on disposal (the chart itself is seeded by seeds/40_finance.sql)
INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('3301004', 'Gain on Disposal of Property and Equipment', 'income', 'Other Income', false, false, 'Other Income', 'credit', 'Proceeds above the book value of fixed assets sold'),
 ('4501004', 'Loss on Disposal of Property and Equipment', 'expense', 'Other Expenses', false, false, 'Other Expenses', 'debit', 'Book value of fixed assets written off or sold below their book value')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.account.gain_on_disposal', '"3301004"', 'accounting', 'GL account: gain on disposal of fixed assets', 'string'),
 ('accounting.account.loss_on_disposal', '"4501004"', 'accounting', 'GL account: loss on disposal of fixed assets', 'string'),
 ('fixed_assets.disposal_vat_code', '"VAT12-OUT"', 'accounting', 'Fixed assets: output VAT tax code on the sale of an asset (VAT-registered broker)', 'string'),
 ('fixed_assets.disposal_requires_depreciation_to_date', 'true', 'accounting', 'Fixed assets: an asset is disposed only when its depreciation up to the month before the disposal is posted', 'boolean'),
 ('fixed_assets.disposal_sales_invoice', 'true', 'accounting', 'Fixed assets: issue the BIR sales invoice of an asset sold with the disposal', 'boolean'),
 ('fixed_assets.disposal_backdate_days', '60', 'accounting', 'Fixed assets: how many days back a disposal may be dated', 'number')
ON CONFLICT (key) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'fa.disposal', 1, 'Fixed asset disposed', 'Sale or write-off of a fixed asset: cost and accumulated depreciation removed, proceeds and output VAT, gain or loss on disposal.',
    'fixed-assets', 'ASSET_DISPOSAL', 'fixed-assets', 'Disposal {{disposalNumber}} – {{assetNumber}} {{assetName}}', 'none', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'fa.disposal') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'accumulated', 'accumulated_depreciation', 'accumulated', false, 'Accumulated depreciation of {{assetNumber}} removed'),
  (2, 'Dr', 'context', 'proceeds', 'service_fee_receivable', 'receivable', false, 'Proceeds of the sale of {{assetNumber}} {{buyer}}'),
  (3, 'Dr', 'role', 'loss_on_disposal', NULL::text, 'loss', false, 'Loss on disposal of {{assetNumber}}'),
  (4, 'Cr', 'context', 'asset', NULL::text, 'cost', false, 'Cost of {{assetNumber}} {{assetName}} removed'),
  (5, 'Cr', 'context', 'vat', 'output_vat', 'vat', false, 'Output VAT on the sale of {{assetNumber}}'),
  (6, 'Cr', 'role', 'gain_on_disposal', NULL::text, 'gain', false, 'Gain on disposal of {{assetNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
