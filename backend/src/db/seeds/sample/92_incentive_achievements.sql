-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Business booked by the account executives in the month before the seed runs, so that the incentive programmes of
-- 92_incentive.sql have achievements to calculate for the latest closed month (New Business Champion counts the
-- policies, Q3 TFS Motor Premium Achievers the premium). Private car CTPL terms at the tariff amount. Idempotent by id.
WITH agents(username, booked) AS (VALUES
  ('agent.jdelacruz', 6), ('agent.msantos', 9), ('agent.preyes', 7), ('agent.agarcia', 3), ('agent.jmartinez', 5),
  ('carla.mendoza', 4), ('paolo.villanueva', 2)
), terms AS (
  SELECT u.id AS owner_id, a.username, s.k, row_number() OVER (ORDER BY a.username, s.k) AS n
  FROM agents a JOIN users u ON u.username = a.username CROSS JOIN LATERAL generate_series(1, a.booked) AS s(k)
), dated AS (
  SELECT t.*, (date_trunc('month', current_date) - interval '1 month')::date + ((t.n * 3) % 27)::int AS incep,
         'cl_crs_' || lpad((((t.n - 1) % 10) + 1)::text, 2, '0') AS client,
         (ARRAY['MAAGAP', 'PIONEER', 'MALAYAN', 'STANDARD'])[((t.n - 1) % 4) + 1] AS insurer
  FROM terms t
)
INSERT INTO policies(id, policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, issued_date,
                     sum_insured, net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob, doc, details, created_by, created_at)
SELECT 'pol_inc_' || lpad(d.n::text, 3, '0'), 'POL-' || to_char(d.incep, 'YYYY') || '-93' || lpad(d.n::text, 3, '0'), d.client, pr.id,
       (SELECT pt.id FROM policy_types pt WHERE pt.code = 'CTPL'), ic.id, d.owner_id, 'active', d.incep, d.incep + 364, d.incep - 1,
       100000, 0, 610.40, 0, 'PHP', cl.display_name, pr.name, 'MOTOR',
       jsonb_build_object('productType', pr.name, 'insurancePolicyType', 'CTPL', 'vehicleType', 'private_cars', 'insuranceCompanyName', ic.name,
         'plateNumber', 'NIN ' || lpad(d.n::text, 4, '0'), 'includeCTPL', true, 'ctplTermYears', 1, 'ctplCoveragePremium', 610.40,
         'cocNumber', upper(left(ic.code, 3)) || lpad((93000 + d.n)::text, 8, '0'),
         'insuranceVehicleDetails', jsonb_build_array(jsonb_build_object('vehicleType', 'private_cars', 'vehicleBrand', 'Toyota', 'vehicleModel', 'Vios', 'seatingCapacity', 5))),
       jsonb_build_object('businessType', 'New Business', 'source', 'seed', 'netPremium', 0, 'grossPremium', 610.40),
       'seed', LEAST(now(), (d.incep - 1 + time '10:00') AT TIME ZONE 'Asia/Manila')
FROM dated d JOIN products pr ON pr.code = 'CTPL' JOIN insurance_companies ic ON ic.code = d.insurer JOIN clients cl ON cl.id = d.client
ON CONFLICT (id) DO NOTHING;
