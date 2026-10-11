-- Talkbot call lists and call results (Operations > Renewals > Talkbot Calls, TIS-BRD-LEAD-09, CR-02).
--
-- Talkbot, the outbound calling service of TIS Sales, calls Motor clients a few days before their policy expires and
-- asks whether they will renew. It is not connected to BrokerVerse: a call list is prepared here and downloaded in the
-- Talkbot Contact Import layout, the Call Records export of the campaign is uploaded back, one Talkbot outcome is
-- derived per account, and Generate Renewal Quotes on a renewal batch quotes only the Talkbot-confirmed Motor policies.
--
--   talkbot_call_lists      one call list TCL-yyyy-nnnnn: criteria, accounts left out by reason, status
--                           draft -> sent -> results-loaded -> closed, or cancelled (draft or sent), Talkbot task name,
--                           downloads, the renewal batch created from its confirmed accounts
--   talkbot_call_lines      one line per policy: contact data written to the file, removal (reason), Talkbot outcome
--                           (derived from the attempts or recorded by hand), renewal batch and renewal quote
--   talkbot_call_uploads    one uploaded call records file: the file kept with the list, counts, failed rows
--   talkbot_call_attempts   one row of a call records file (one call attempt), unique by Talkbot Call ID
--
-- renewal_batch_policies.quote_status gains Skipped (not confirmed by Talkbot) and skip_reason.
-- Numbering series talkbot_call_list (TCL). Permissions read:talkbot-calls and write:talkbot-calls; settings
-- talkbot.*; jobs talkbot-call-list (working days 06:10, delivered off) and talkbot-call-list-close (daily 01:50).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS talkbot_call_lists (
  id               text PRIMARY KEY DEFAULT 'tcl_' || encode(gen_random_bytes(8), 'hex'),
  list_number      text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'results-loaded', 'closed', 'cancelled')),
  criteria         jsonb NOT NULL DEFAULT '{}'::jsonb,
  excluded         jsonb NOT NULL DEFAULT '{}'::jsonb,
  expiry_from      date,
  expiry_to        date,
  recall_of        text REFERENCES talkbot_call_lists(id),
  task_name        text,
  sent_at          timestamptz,
  sent_by          text REFERENCES users(id),
  downloads        int NOT NULL DEFAULT 0,
  last_download_at timestamptz,
  last_download_by text REFERENCES users(id),
  last_download_rows int,
  last_download_dropped jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_upload_at   timestamptz,
  batch_ids        jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_at        timestamptz,
  closed_by        text REFERENCES users(id),
  cancelled_at     timestamptz,
  cancelled_by     text REFERENCES users(id),
  cancel_reason    text,
  created_by       text REFERENCES users(id),
  created_by_system boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS talkbot_call_lists_status_idx ON talkbot_call_lists(status, created_at DESC);

CREATE TABLE IF NOT EXISTS talkbot_call_lines (
  id               bigserial PRIMARY KEY,
  list_id          text NOT NULL REFERENCES talkbot_call_lists(id) ON DELETE CASCADE,
  policy_id        text NOT NULL REFERENCES policies(id),
  client_id        text REFERENCES clients(id),
  owner_user_id    text REFERENCES users(id),
  contact_name     text,
  phone            text,
  email            text,
  expiry_date      date,
  sum_insured      numeric(14,2),
  premium          numeric(14,2),
  car_model        text,
  line_status      text NOT NULL DEFAULT 'active' CHECK (line_status IN ('active', 'removed')),
  removed_reason   text,
  removed_reason_code text,
  removed_by       text REFERENCES users(id),
  removed_at       timestamptz,
  outcome          text NOT NULL DEFAULT 'not-called',
  outcome_detail   text,
  outcome_at       timestamptz,
  outcome_source   text CHECK (outcome_source IN ('file', 'manual')),
  outcome_rank     int,
  callback_date    date,
  manual_remark    text,
  manual_by        text REFERENCES users(id),
  attempts         int NOT NULL DEFAULT 0,
  last_call_at     timestamptz,
  renewal_id       text REFERENCES renewals(id),
  batch_id         text REFERENCES renewal_batches(id) ON DELETE SET NULL,
  quote_status     text,
  quote_number     text,
  skip_reason      text,
  UNIQUE (list_id, policy_id)
);
CREATE INDEX IF NOT EXISTS talkbot_call_lines_policy_idx ON talkbot_call_lines(policy_id, outcome_at DESC);
CREATE INDEX IF NOT EXISTS talkbot_call_lines_list_idx ON talkbot_call_lines(list_id, outcome);

CREATE TABLE IF NOT EXISTS talkbot_call_uploads (
  id             text PRIMARY KEY DEFAULT 'tcu_' || encode(gen_random_bytes(8), 'hex'),
  list_id        text NOT NULL REFERENCES talkbot_call_lists(id) ON DELETE CASCADE,
  upload_number  int NOT NULL,
  file_key       text,
  file_name      text NOT NULL,
  file_size      bigint NOT NULL DEFAULT 0,
  task_name      text,
  rows_total     int NOT NULL DEFAULT 0,
  rows_loaded    int NOT NULL DEFAULT 0,
  rows_failed    int NOT NULL DEFAULT 0,
  errors         jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_purged_at timestamptz,
  uploaded_by    text REFERENCES users(id),
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, upload_number)
);

CREATE TABLE IF NOT EXISTS talkbot_call_attempts (
  id               bigserial PRIMARY KEY,
  line_id          bigint NOT NULL REFERENCES talkbot_call_lines(id) ON DELETE CASCADE,
  upload_id        text NOT NULL REFERENCES talkbot_call_uploads(id) ON DELETE CASCADE,
  row_no           int NOT NULL,
  call_id          text NOT NULL UNIQUE,
  contact_id       text,
  contact_name     text,
  contact_number   text,
  result           text,
  call_time        timestamptz,
  duration_seconds int,
  tags             text,
  drop_off_point   text,
  call_status      text,
  call_result      text,
  callback_date    date,
  outcome          text,
  outcome_rank     int
);
CREATE INDEX IF NOT EXISTS talkbot_call_attempts_line_idx ON talkbot_call_attempts(line_id, call_time);

ALTER TABLE renewal_batch_policies ADD COLUMN IF NOT EXISTS skip_reason text;

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('talkbot_call_list', 'Talkbot Call List', 'renewals', 'TCL', 'Talkbot call list (Operations > Renewals > Talkbot Calls)', 'migration:0460')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain the permissions get a new token version (the permissions travel in the access token);
-- only on the first run, while the permissions do not exist yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head',
                                'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:talkbot-calls');

INSERT INTO permissions(code, module, description) VALUES
 ('read:talkbot-calls', 'talkbot-calls', 'Open the Talkbot call lists and see the Talkbot outcome on Renewal Queue and Renewal Batch'),
 ('write:talkbot-calls', 'talkbot-calls', 'Create, download, send, close and cancel Talkbot call lists; upload the call results; record an outcome')
ON CONFLICT (code) DO NOTHING;

-- FRS LEAD-09 default grants: Sales & Marketing and Operations maintain the call lists, the Processing Team views them
-- (and creates the renewal batch with write:renewals).
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('read:talkbot-calls', 'write:talkbot-calls')
WHERE r.code IN ('system-admin', 'sales', 'operations')
   OR (r.code = 'processing' AND p.code = 'read:talkbot-calls')
ON CONFLICT DO NOTHING;

-- TISPH (roles of migration 0348): Sales personas and the General Manager maintain the call lists; Operations view them
-- and create the renewal batch of the confirmed accounts.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('read:talkbot-calls', 'write:talkbot-calls')
WHERE r.code IN ('tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-general-manager')
   OR (r.code IN ('tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head') AND p.code = 'read:talkbot-calls')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('talkbot.days_before_expiry', '3', 'talkbot', 'Days between the call list date and the expiry date of the accounts called', 'number'),
 ('talkbot.max_accounts', '2000', 'talkbot', 'Most accounts on one call list', 'number'),
 ('talkbot.max_lists_per_policy', '3', 'talkbot', 'Call lists a policy can be on without being reached', 'number'),
 ('talkbot.confirmation_valid_days', '30', 'talkbot', 'Days a Willing to renew outcome stays Talkbot-confirmed', 'number'),
 ('talkbot.task_name_pattern', '"TIS_MV - MMM DD, YYYY"', 'talkbot', 'Proposed Talkbot task name (MMM DD, YYYY: the date the list is sent)', 'string'),
 ('talkbot.export_format', '"xlsx"', 'talkbot', 'File type of the Contact Import file', 'string'),
 ('talkbot.max_upload_rows', '20000', 'talkbot', 'Most rows in one call records upload', 'number'),
 ('talkbot.bulk_quote_filter', 'true', 'talkbot', 'Generate Renewal Quotes on a renewal batch quotes only Talkbot-confirmed Motor policies', 'boolean'),
 ('talkbot.auto_close_days', '30', 'talkbot', 'Days after the last upload before a call list is closed', 'number'),
 ('talkbot.file_retention_days', '365', 'talkbot', 'Days an uploaded call records file is kept with its call list', 'number'),
 ('talkbot.sum_insured_depreciation_pct', '10', 'talkbot', 'Depreciation applied to the expiring Motor sum insured for the renewal sum insured of the Contact Import file (%)', 'number'),
 ('talkbot.outcome_rules', '[
   {"rank": 1, "outcome": "already-renewed", "callStatus": ["Already Renewed"]},
   {"rank": 2, "outcome": "willing", "callResult": ["Will Renew"]},
   {"rank": 3, "outcome": "not-willing", "callResult": ["Will not Renew", "Not Interested"], "callStatus": ["Stop Calling/Already Called"]},
   {"rank": 4, "outcome": "wrong-contact", "callStatus": ["Wrong PIC", "Wrong Number/Deny Car Loan"]},
   {"rank": 5, "outcome": "call-back", "anyCallResult": true, "anyCallStatus": true, "callbackDate": true},
   {"rank": 6, "outcome": "uncontacted", "result": ["Connected(200)", "Connected(202)"]},
   {"rank": 7, "outcome": "wrong-contact", "result": ["Invalid Number(1)", "Out of Service(5)"], "noneConnected": true},
   {"rank": 8, "outcome": "missed-call", "anyResult": true}
 ]', 'talkbot', 'Talkbot outcome rules in rank order (Call Status, Call Result, Result of each call attempt)', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('talkbot-call-list', 'Talkbot call list', 'Create the Draft Talkbot call list of the day: Motor policies expiring talkbot.days_before_expiry days ahead (working days only)', '10 6 * * 1-5', 'talkbotCallList', '{}', false),
 ('talkbot-call-list-close', 'Talkbot call list close', 'Close the Talkbot call lists talkbot.auto_close_days after their last upload and remove uploaded files older than talkbot.file_retention_days', '50 1 * * *', 'talkbotCallListClose', '{}', true)
ON CONFLICT (code) DO NOTHING;
