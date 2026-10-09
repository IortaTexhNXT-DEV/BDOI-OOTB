-- A prospect may be created before its product is known (Create Prospect > Skip - tag product later, the lead upload
-- without a LOB or Product). Its line of business and product stay empty until the account executive tags them
-- (Prospects > Tag product, or the product asked for when the first quotation is started). The prospect list shows
-- such prospects on the tab Product not yet tagged; the lead assignment rules with a line of business do not match
-- them, so they follow the rules without a line, else leads.assignment_fallback.
-- leads.product_required restores the product as mandatory on every new prospect. Idempotent.

ALTER TABLE leads ALTER COLUMN lob DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN lob DROP DEFAULT;
COMMENT ON COLUMN leads.lob IS 'Line of business of the prospect (MOTOR, FIRE, IAR, ACCIDENT ...); NULL while the product is not yet tagged';

CREATE INDEX IF NOT EXISTS leads_untagged_idx ON leads (created_at DESC) WHERE lob IS NULL AND deleted_at IS NULL;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('leads.product_required', 'false', 'leads', 'Prospects: the line of business and product must be chosen when a prospect is created (off: Skip - tag product later is offered and the product is tagged later)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
