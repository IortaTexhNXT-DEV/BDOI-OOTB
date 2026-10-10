-- Remittance eligibility (migration 0521, FRS FR-RMT-010 to 012) on the masters of Accounts > Remittance:
--   - the schedule master gains Eligibility (Incepted up to the cut-off | Fully paid in the window) and Proof of payment
--     required;
--   - TIS-WEEKLY, the TISPH weekly schedule of seed 90, remits fully paid policies with proof of payment (proposal
--     D-CASH-03 of the build: TISPH confirms the basis); a TIS-WEEKLY an administrator changed is left as it is;
--   - the exception type "No proof of payment" of the exceptions a run opens, worked by Cash Control.
-- Idempotent.

UPDATE master_types t SET fields = t.fields || (
  SELECT COALESCE(jsonb_agg(f ORDER BY n), '[]'::jsonb) FROM jsonb_array_elements($j$[
    {"name":"eligibility","label":"Eligibility","type":"select","required":false,"options":["Incepted up to the cut-off","Fully paid in the window"]},
    {"name":"proofRequired","label":"Proof of payment required","type":"boolean","required":false}]$j$::jsonb) WITH ORDINALITY AS x(f, n)
  WHERE NOT t.fields @> jsonb_build_array(jsonb_build_object('name', f->>'name'))), updated_at = now()
WHERE t.code = 'remittance-schedule'
  AND NOT (t.fields @> '[{"name":"eligibility"}]'::jsonb AND t.fields @> '[{"name":"proofRequired"}]'::jsonb);

UPDATE master_records SET data = data || '{"eligibility":"Fully paid in the window","proofRequired":true}'::jsonb, updated_at = now()
 WHERE type_code = 'remittance-schedule' AND code = 'TIS-WEEKLY' AND created_by = 'seed' AND updated_by IS NULL AND NOT data ? 'eligibility';

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'remittance-exception', 'EXC-PROOF', 'No proof of payment',
       $j${"code":"EXC-PROOF","name":"No proof of payment","category":"Collections","severity":"Medium","autoResolve":false,"resolutionSteps":["Attach the proof of payment to the receipt on Accounts > Receipts","Resolve the exception"],"notification":["system"],"sla":"2 days","glImpact":false}$j$::jsonb,
       'active', 'seed'
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'remittance-exception')
  AND NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'remittance-exception' AND code = 'EXC-PROOF');
