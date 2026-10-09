-- Campaign templates of the TISPH build: the sample template HOME-PROTECT (home fire and allied perils, a product TISPH
-- does not sell) is set inactive while nobody has changed it, so it is no longer offered for a new campaign; the
-- campaigns already made with it keep it. The TISPH templates (Motor renewal, new Toyota owners, Personal Accident,
-- Credit Life) are reference seed 84_tisph_campaign_templates.sql. Idempotent.

UPDATE campaign_templates SET status = 'inactive', updated_at = now()
 WHERE lower(code) = 'home-protect' AND status = 'active' AND COALESCE(updated_by, 'seed') = 'seed';
