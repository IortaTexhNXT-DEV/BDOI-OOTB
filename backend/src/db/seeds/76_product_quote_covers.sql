-- The motor quote wizard offers the covers of the governing template's Coverage Builder (migration 0322): the motor
-- pricing template MOT-003-2025 also lists the two optional covers the wizard prices that it did not list yet
-- (roadside assistance and the personal accident cover of the driver), each with the quotation premium it is priced
-- on. Reference data; idempotent: a cover already on the template (added here or on screen) is left alone.
INSERT INTO product_components(template_id, kind, code, name, data, status, sort_order, created_by, updated_by)
SELECT t.id, 'coverages', v.code, v.name, jsonb_build_object('coverageCode', v.code, 'coverageName', v.name, 'type', 'Optional', 'description', v.description, 'deductible', 0,
  'waitingPeriod', 0, 'premiumImpact', v.impact, 'limits', '[]'::jsonb, 'exclusions', '[]'::jsonb, 'requiredDocuments', '[]'::jsonb, 'quoteField', v.quote_field), 'Active', v.sort, 'seed', 'seed'
FROM (SELECT id FROM product_templates WHERE template_code = 'MOT-003-2025' ORDER BY version DESC LIMIT 1) t,
  (VALUES ('RSA', 'Roadside Assistance', '24/7 towing, jump start, flat tyre and fuel delivery', '+0.25%', 'roadsideAssistancePremium', 27),
          ('PAC', 'Personal Accident of the Driver', 'Accidental death and disablement of the named driver', '+2%', 'personalAccidentCoverPremium', 28)) AS v(code, name, description, impact, quote_field, sort)
WHERE NOT EXISTS (SELECT 1 FROM product_components c WHERE c.template_id = t.id AND c.kind = 'coverages' AND c.code = v.code);
