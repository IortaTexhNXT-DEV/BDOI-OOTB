-- TISPH values of the lead rules (TIS-BRD-LEAD-01 to LEAD-08) on the settings of migrations 0300 and 0461, and the lead
-- sources the BRD confirms (LEAD-04) that the Pre-BSM list (seed 83_tisph_lists.sql) lacks. Runs on a new database and
-- on every start of one in use. Idempotent: a source is added only when its code is missing, and a setting is changed
-- only while it still holds the reference value and nobody has changed it (updated_by empty).

-- ---------------------------------------------------------------- LEAD-04 / INTG-03 lead sources
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'lead-source', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'channelType', v.kind, 'branchCode', 'HO', 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('TFS', 'TFS', 'Bancassurance / Affinity', 5),
             ('EML', 'E-mail', 'Direct', 25),
             ('CS', 'Customer Service', 'Direct', 35),
             ('DLR', 'Dealer', 'Dealer', 45),
             ('COMM', 'Commission', 'Direct', 115),
             ('RENDLR', 'Renewals via Toyota Dealer', 'Dealer', 95)) AS v(code, name, kind, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'lead-source')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'lead-source' AND lower(m.code) = lower(v.code));

-- ---------------------------------------------------------------- lead rules
-- LEAD-03: duplicate check on first name, last name, mobile and date of birth together
UPDATE app_settings SET value = '"four-key"', updated_at = now() WHERE key = 'leads.duplicate_rule' AND value = '"any"' AND updated_by IS NULL;
-- LEAD-07: three days on working time before an account not worked is queued for reassignment
UPDATE app_settings SET value = '72', updated_at = now() WHERE key = 'leads.assignment_sla_hours' AND value = '48' AND updated_by IS NULL;
UPDATE app_settings SET value = 'true', updated_at = now() WHERE key = 'leads.sla_working_time' AND value = 'false' AND updated_by IS NULL;
-- LEAD-08: prospects not converted are kept open 90 days
UPDATE app_settings SET value = '90', updated_at = now() WHERE key = 'leads.retention_days' AND value = '0' AND updated_by IS NULL;
-- LEAD-06: reassignment within the insurer group
UPDATE app_settings SET value = 'true', updated_at = now() WHERE key = 'leads.reassign_within_insurer' AND value = 'false' AND updated_by IS NULL;
