-- OOTB defaults confirmed by iorta TechNXT.

-- The BDO, BPI and Metrobank statement layouts ship as the standard formats (editable in
-- Master > Finance > Bank Statement Formats), not as examples.
UPDATE bank_statement_formats
   SET is_example = false,
       name = regexp_replace(name, '\s*\(example\)$', ''),
       description = regexp_replace(description, '^Example layout modelled on', 'Standard layout of'),
       updated_at = now()
 WHERE code IN ('BDO-SAMPLE', 'BPI-SAMPLE', 'MBT-SAMPLE') AND is_example;

UPDATE bank_statement_formats
   SET description = replace(description, 'Verify against the actual file before use.', 'Adjust the columns here if the bank changes its export.')
 WHERE code IN ('BDO-SAMPLE', 'BPI-SAMPLE', 'MBT-SAMPLE');

-- Letterhead company: TIN and contact e-mail, only where they are still blank.
UPDATE master_records
   SET data = data
       || CASE WHEN COALESCE(data->>'TIN', '') = '' THEN jsonb_build_object('TIN', '00-010-0234-8393') ELSE '{}'::jsonb END
       || CASE WHEN COALESCE(data->>'EmailID', '') = '' THEN jsonb_build_object('EmailID', 'connect@iortatechnxt.com') ELSE '{}'::jsonb END
 WHERE type_code = 'company' AND code = 'ITX';
