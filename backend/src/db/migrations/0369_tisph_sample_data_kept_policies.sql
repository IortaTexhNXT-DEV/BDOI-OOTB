-- Earlier sample policies kept on a database in use. Migration 0365 keeps the sample clients and prospects a user worked
-- on with everything on them (and the whole earlier sample when another record still refers to it), so those policies
-- keep the shape of the earlier sample under the fixed ids the TISPH sample seed uses: no premium breakdown (details
-- without the net premium and the premium taxes, net premium 0, no line of business) and bills without one. The seed
-- reads the breakdown of these policies (sample/85_claims_renewals_base.sql bills them with their taxes), so each such
-- policy gets the breakdown of the TISPH sample. The earlier sample booked its premiums without premium taxes (Dr Premium
-- Receivable / Cr Due to Insurer and Commission Income only), so the whole premium is the net premium and the taxes are
-- nil, as in the ledger; the line of business is that of the product. The bills of these policies that have no
-- breakdown get their amount as the net premium. No journal changes.
--
-- Only sample rows are changed (fixed ids pol_sls_, pol_crs_, pol_fin_) and only while they have no breakdown: the
-- policies of the TISPH sample and every policy a user entered are left as they are. The audit trail records the
-- conversion (entity database, id sample-data, action convert) with the policies converted. Idempotent.

DO $$
DECLARE
  v_policies jsonb;
  v_bills int;
BEGIN
  CREATE TEMP TABLE smp_kept_policy ON COMMIT DROP AS
    SELECT id FROM policies WHERE id ~ '^pol_(sls|crs|fin)_' AND net_premium = 0 AND premium_total <> 0 AND NOT details ? 'netPremium';
  IF NOT EXISTS (SELECT 1 FROM smp_kept_policy) THEN
    RETURN;
  END IF;

  UPDATE policies p SET net_premium = p.premium_total,
    details = jsonb_build_object('netPremium', p.premium_total, 'valueAddedTax', 0, 'documentaryStampTax', 0, 'localGovernmentTax', 0, 'otherCharges', 0,
      'grossPremium', p.premium_total) || p.details,
    lob = COALESCE(p.lob, (SELECT CASE WHEN pr.line = 'fire' AND pr.name ~* 'industrial' THEN 'IAR' ELSE upper(pr.line) END FROM products pr WHERE pr.id = p.product_id)),
    updated_at = now()
  WHERE p.id IN (SELECT id FROM smp_kept_policy);

  UPDATE receivables SET net_premium = amount, updated_at = now()
  WHERE policy_id IN (SELECT id FROM smp_kept_policy) AND amount <> 0
    AND net_premium = 0 AND vat = 0 AND dst = 0 AND lgt = 0 AND other_charges = 0 AND discount = 0;
  GET DIAGNOSTICS v_bills = ROW_COUNT;

  SELECT jsonb_agg(id ORDER BY id) INTO v_policies FROM smp_kept_policy;
  INSERT INTO audit_log(username, entity, entity_id, action, after_data)
  VALUES ('system', 'database', 'sample-data', 'convert', jsonb_build_object('migration', '0369_tisph_sample_data_kept_policies', 'policies', v_policies, 'bills', v_bills));
END $$;
