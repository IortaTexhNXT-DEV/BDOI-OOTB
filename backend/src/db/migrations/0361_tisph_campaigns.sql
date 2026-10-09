-- Marketing campaigns of the TISPH build.
--
-- The sample template HOME-PROTECT (home fire and allied perils, a product TISPH does not sell) is set inactive while
-- nobody has changed it, so it is no longer offered for a new campaign; the campaigns already made with it keep it.
-- The TISPH templates (Motor renewal, new Toyota owners, Personal Accident, Credit Life) are reference seed
-- 85_tisph_campaign_templates.sql.
--
-- Marketing campaigns get their own number series (CPG-YYYY-00001): they took the next number of the win-back
-- campaigns of Renewals (WB), so the two registers shared one sequence. Campaigns numbered before keep their number.
-- Idempotent.

UPDATE campaign_templates SET status = 'inactive', updated_at = now()
 WHERE lower(code) = 'home-protect' AND status = 'active' AND COALESCE(updated_by, 'seed') = 'seed';

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('marketing_campaign', 'Marketing Campaign', 'campaigns', 'CPG', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'E-mail campaign to clients and prospects (Operations > Sales & Marketing > Campaigns)', 'migration')
ON CONFLICT (code) DO NOTHING;
