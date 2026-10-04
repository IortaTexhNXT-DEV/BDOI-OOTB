-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Compliance registers of the demo broker (Compliance > Insurance Commission): the firm's broker licence, a licence for
-- every fictional agent and sub-agent paid commission (so the commission payout check finds them licensed), and the
-- fit and proper records of two fictional directors. Licence numbers are fictional. Idempotent.

INSERT INTO compliance_licences(holder_type, holder_name, licence_type, licence_number, issuing_authority, lines_authorised, issue_date, expiry_date, remarks, created_by)
SELECT 'firm', COALESCE((SELECT COALESCE(data->>'CompanyName', name) FROM master_records WHERE type_code = 'company' ORDER BY id LIMIT 1), 'BrokerVerse Demo Insurance Brokers, Inc.'),
  'Insurance Broker (Non-life)', 'DEMO-BRK-0001', 'Insurance Commission', 'Non-life', date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '3 years' - interval '1 day')::date,
  'Sample licence of the demo broker', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM compliance_licences WHERE holder_type = 'firm');

-- every agent and sub-agent referrer (including those linked to sample users) holds a licence valid for a year
INSERT INTO compliance_licences(holder_type, referrer_id, holder_name, licence_type, licence_number, issuing_authority, lines_authorised, issue_date, expiry_date, created_by)
SELECT 'referrer', r.id, r.name, CASE WHEN r.referrer_type = 'Sub-agent' THEN 'Sub-agent' ELSE 'Non-life Insurance Agent' END,
  'DEMO-AGT-' || lpad((row_number() OVER (ORDER BY r.id))::text, 4, '0'), 'Insurance Commission', 'Non-life',
  (current_date - 120), (current_date + 245), 'seed'
FROM commission_referrers r
WHERE r.referrer_type IN ('Agent', 'Sub-agent') AND NOT EXISTS (SELECT 1 FROM compliance_licences l WHERE l.referrer_id = r.id);

INSERT INTO compliance_fit_proper(person_name, role_category, position, appointed_on, declarations, declaration_signed_on, last_review_on, next_review_on, review_outcome, reviewed_by, created_by)
SELECT v.name, v.cat, v.pos, v.appointed, (SELECT COALESCE(jsonb_agg(jsonb_build_object('item', d, 'answer', 'yes', 'remarks', NULL)), '[]'::jsonb)
    FROM jsonb_array_elements_text(COALESCE((SELECT value FROM app_settings WHERE key = 'compliance.fit_proper_declarations'), '[]'::jsonb)) d),
  current_date - 200, current_date - 200, current_date + 165, 'fit', 'BrokerVerse', 'seed'
FROM (VALUES ('Leonora Bautista Villareal', 'director', 'Chairperson of the Board', DATE '2021-03-15'),
             ('Rafael Domingo Ocampo', 'officer', 'President and Chief Executive Officer', DATE '2022-07-01')) AS v(name, cat, pos, appointed)
WHERE NOT EXISTS (SELECT 1 FROM compliance_fit_proper f WHERE f.person_name = v.name);
