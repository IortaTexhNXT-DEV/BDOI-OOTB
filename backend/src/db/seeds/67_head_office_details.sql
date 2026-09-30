-- Head office branch: fill the details shown on the Branch master (company, city, country, e-mail, phone) from the
-- primary company record, only where they are still blank. Changes made on screen are kept.
UPDATE branches b
   SET attrs = b.attrs
       || CASE WHEN COALESCE(b.attrs->>'CompanyName', '') = '' THEN jsonb_build_object('CompanyName', c.name) ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(b.attrs->>'City', '') = '' THEN jsonb_build_object('City', COALESCE(NULLIF(c.data->>'City', ''), 'Makati')) ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(b.attrs->>'State', '') = '' THEN jsonb_build_object('State', COALESCE(NULLIF(c.data->>'State', ''), 'Metro Manila')) ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(b.attrs->>'Country', '') = '' THEN jsonb_build_object('Country', COALESCE(NULLIF(c.data->>'Country', ''), 'Philippines')) ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(b.attrs->>'EmailID', '') = '' AND COALESCE(c.data->>'EmailID', '') <> '' THEN jsonb_build_object('EmailID', c.data->>'EmailID') ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(b.attrs->>'PhoneNumber', '') = '' AND COALESCE(c.data->>'PhoneNumber', '') <> '' THEN jsonb_build_object('PhoneNumber', c.data->>'PhoneNumber') ELSE '{}'::jsonb END,
       updated_at = now()
  FROM (SELECT name, data FROM master_records WHERE type_code = 'company' ORDER BY (data->>'IsPrimary')::boolean DESC NULLS LAST, id LIMIT 1) c
 WHERE b.code = 'HO';
