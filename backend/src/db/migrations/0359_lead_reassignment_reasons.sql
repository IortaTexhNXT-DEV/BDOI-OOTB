-- Reassignment of prospects (Operations > Sales & Marketing > Lead Assignment): the reason of a reassignment or of a
-- prospect sent to the reassignment queue is a reason code of the Reason Codes master (context reassignment, seed
-- 84_lead_reassignment_reasons.sql) with an optional note, or a note alone. The code is kept beside the reason text.
-- leads.reassignment_reason_required asks for a reason on every reassignment (the queue always needs one). A prospect
-- taken from the queue by the lead assignment team is recorded with the history action taken. Idempotent.

ALTER TABLE lead_assignment_history ADD COLUMN IF NOT EXISTS reason_code text;
COMMENT ON COLUMN lead_assignment_history.reason_code IS 'Reason code (master reason-code, context reassignment); reason holds its name and the note';
ALTER TABLE lead_assignment_history DROP CONSTRAINT IF EXISTS lead_assignment_history_action_check;
ALTER TABLE lead_assignment_history ADD CONSTRAINT lead_assignment_history_action_check CHECK (action IN ('auto', 'manual', 'bulk', 'queue', 'queued', 'taken'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS queue_reason_code text;
COMMENT ON COLUMN leads.queue_reason_code IS 'Reason code of a prospect sent to the reassignment queue by hand (master reason-code, context reassignment)';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('leads.reassignment_reason_required', 'true', 'leads', 'Lead assignment: a reassignment needs a reason (a reason code of Master > Insurance Management > Reason Codes, or a note)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
