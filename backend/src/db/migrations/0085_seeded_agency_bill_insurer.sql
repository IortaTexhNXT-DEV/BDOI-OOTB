-- The three seeded agency bills were saved without an insurer, so the remittance screens showed a blank insurer.
-- The seed now builds each bill from one insurer's policies; existing databases take the insurer carrying the largest
-- premium on the bill's lines. Only seeded rows without an insurer are touched, so re-running changes nothing.
UPDATE remittances r
SET insurance_company_id = x.ins, updated_at = now()
FROM (
  SELECT DISTINCT ON (l.remittance_id) l.remittance_id, p.insurance_company_id AS ins
  FROM remittance_lines l JOIN policies p ON p.id = l.policy_id
  WHERE p.insurance_company_id IS NOT NULL
  GROUP BY l.remittance_id, p.insurance_company_id
  ORDER BY l.remittance_id, sum(l.premium) DESC, p.insurance_company_id
) x
WHERE x.remittance_id = r.id AND r.insurance_company_id IS NULL AND r.data->>'seed' = 'remittance-v1';
