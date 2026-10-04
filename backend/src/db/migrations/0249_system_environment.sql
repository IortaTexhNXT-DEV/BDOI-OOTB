-- Environment marker and masking stamp (client data masking tool, npm run mask:data, docs/onboarding/DATA_MASKING.md).
--
-- system.environment: dev, sit, uat, preprod, training or production. It is 'production' on a database whose go-live
-- lock is already on (the live book), else 'dev'; the administrator of the Production environment sets it to
-- 'production' at go-live (Master > Configuration, group System). The masking tool refuses to run on a database marked
-- 'production'; a copy restored from a production backup is re-marked by the DBA as the copy it is (step 2 of the
-- refresh procedure) and the tool then sets it to the target environment.
-- system.masked_at: when the personal data of this copy was masked (ISO date-time, empty when never masked); written
-- by the masking tool only.
INSERT INTO app_settings(key, value, "group", label, type, editable)
SELECT 'system.environment',
       CASE WHEN EXISTS (SELECT 1 FROM app_settings WHERE key = 'golive.locked' AND value IN ('true'::jsonb, '"true"'::jsonb))
            THEN '"production"'::jsonb ELSE '"dev"'::jsonb END,
       'system', 'Environment of this database: dev, sit, uat, preprod, training or production. Set production in the live environment; the client data masking tool (npm run mask:data) refuses to run on production', 'string', true
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('system.masked_at', '""', 'system', 'When the personal data of this database was masked by the client data masking tool (empty: never masked). Written by the tool only', 'string', false)
ON CONFLICT (key) DO NOTHING;
