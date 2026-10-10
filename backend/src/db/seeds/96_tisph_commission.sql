-- TISPH configuration of the commission rules register, the sharing schemes and the commission controls (migrations
-- 0570 and 0571; TIS-BRD-PROD-16, COMM-02, COMM-05, COMM-06). Runs on a new database and on every start of one in
-- use, only where the TISPH roles exist. Idempotent: a setting is changed only while it still holds the reference
-- value and nobody has changed it, so administrator changes are kept.

-- Motor policies are booked on the per-peril rates of the register; rules and schemes are approved on Configuration
-- Approvals; a rate change, reversal or withholding tax change on a commission line waits for a second user; a
-- commission line becomes payable once the policy is fully paid and remitted to the insurer.
UPDATE app_settings s
   SET value = v.value, updated_at = now()
  FROM (VALUES ('commission.peril_based_motor', 'false'::jsonb, 'true'::jsonb),
               ('commission.rules_approval_required', 'false'::jsonb, 'true'::jsonb),
               ('commission.adjustment_approval_required', 'false'::jsonb, 'true'::jsonb),
               ('commission.eligible_requires_remittance', 'false'::jsonb, 'true'::jsonb)) AS v(key, reference, value)
 WHERE s.key = v.key AND s.updated_by IS NULL AND s.value = v.reference
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- The TISPH exception type of a policy booked without rates on the register (raised by the remittance runs)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'remittance-exception', 'EXC-RATES', 'Rates missing',
       $j${"code":"EXC-RATES","name":"Rates missing","category":"Commission","severity":"Medium","autoResolve":false,"resolutionSteps":["Add the rates on Master > Finance > Commission Rate Matrix","Recompute the commission of the policy","Resolve the exception"],"notification":["system"],"sla":"2 days","glImpact":false}$j$::jsonb,
       'active', 'seed'
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'remittance-exception')
  AND NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'remittance-exception' AND code = 'EXC-RATES');
