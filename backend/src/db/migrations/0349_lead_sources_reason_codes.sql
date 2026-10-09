-- Lead sources and reason codes (masters lead-source and reason-code, seed 77_lead_sources_reason_codes.sql; the
-- TISPH values in seed 83_tisph_lists.sql).
--  - The Source of a prospect (form, API, lead upload) is matched to the Lead Source master by code or name and stored
--    as the master's name; a value the master does not know is kept as typed unless leads.source_list_only is on.
--  - A claim rejection (repudiation) and a renewal lapse may carry a reason code of the Reason Codes master; its code is
--    kept beside the reason text. The free-text reason stays possible. Idempotent.

ALTER TABLE claims ADD COLUMN IF NOT EXISTS rejected_reason_code text;
COMMENT ON COLUMN claims.rejected_reason_code IS 'Repudiation reason code (master reason-code, context repudiation); rejected_reason holds its name and the note';
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS lapse_reason_code text;
COMMENT ON COLUMN renewals.lapse_reason_code IS 'Lapse reason code (master reason-code, context lapse); lapse_reason holds its name and the note';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('leads.source_list_only', 'false', 'leads', 'Prospects: the Source must be a lead source of Master > Insurance Management > Lead Sources (off: a source the list does not know is kept as typed)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
