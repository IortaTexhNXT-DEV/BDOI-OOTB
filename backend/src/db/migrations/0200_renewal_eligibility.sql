-- Renewal eligibility: how a renewal was opened (before expiry, in the grace period, or as a lapsed renewal after it),
-- renewal quotations prepared from a batch, and the settings behind the Renewal Policy list and batch defaults.
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS renewal_type text NOT NULL DEFAULT 'regular';   -- regular | grace | lapsed

ALTER TABLE renewal_batch_policies ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'NotQuoted';   -- NotQuoted | Queued | Quoted | Failed
ALTER TABLE renewal_batch_policies ADD COLUMN IF NOT EXISTS quote_number text;
ALTER TABLE renewal_batch_policies ADD COLUMN IF NOT EXISTS quoted_premium numeric(14,2);
ALTER TABLE renewal_batch_policies ADD COLUMN IF NOT EXISTS quoted_at timestamptz;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('renewals.batch_window_days', '30', 'renewals', 'Renewal batch: policies expiring from today up to this many days ahead are proposed', 'number'),
 ('renewals.lapsed_renewal_days', '90', 'renewals', 'Days after the grace period during which an expired policy can still be renewed as a lapsed renewal (new term starts on the renewal date)', 'number'),
 ('renewals.premium_change_display_cap', '300', 'renewals', 'Premium changes above this percentage are shown as "more than" the cap and flagged for review', 'number')
ON CONFLICT (key) DO NOTHING;
