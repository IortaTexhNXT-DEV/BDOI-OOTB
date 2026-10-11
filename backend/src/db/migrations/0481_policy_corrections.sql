-- Guarded policy data (TIS-BRD-ISSUE-04, ENDT-02, SEC-03; TIS-BRD-ISSUE-01, BULK-02).
--
-- The core data of an issued policy (policy number, insured name, period, insurer) no longer changes by editing the
-- policy: a correction is requested with a reason (and the insurer's reference when the insurer's document changes),
-- and applied only when a second user holding approve:policies approves it. The status of a policy never changes by
-- editing: it follows endorsement, cancellation, renewal and expiry.
--
-- Settings:
--   policies.correction_fields             the fields a correction may change
--   policies.correction_insurer_fields     the fields whose correction needs the insurer's reference (insurer confirmation)
--   policies.bulk_upload_issue             on: the policy bulk upload issues policies with bill, journal and commission;
--                                          off (TISPH, seed 95_tisph_quote_policy.sql): only the go-live load of in-force
--                                          policies, by write:data-load
-- Idempotent.

CREATE TABLE IF NOT EXISTS policy_corrections (
  id text PRIMARY KEY DEFAULT 'pcr_' || encode(gen_random_bytes(8), 'hex'),
  policy_id text NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,
  reason_code text,
  reason text NOT NULL,
  insurer_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_by text REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  decision_reason_code text,
  decision_reason text
);
CREATE INDEX IF NOT EXISTS policy_corrections_policy_idx ON policy_corrections(policy_id);
CREATE UNIQUE INDEX IF NOT EXISTS policy_corrections_one_pending ON policy_corrections(policy_id) WHERE status = 'pending';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('policies.correction_fields', '["policyNumber","insuredName","inception","expiry","insuranceCompanyId"]', 'policies', 'Policy fields a correction (approved by a second user) may change', 'json'),
 ('policies.correction_insurer_fields', '["policyNumber","inception","expiry","insuranceCompanyId"]', 'policies', 'Policy fields whose correction needs the insurer''s reference', 'json'),
 ('policies.bulk_upload_issue', 'true', 'policies', 'The policy bulk upload issues new policies with bill, journal and commission (off: only the go-live load of in-force policies)', 'boolean')
ON CONFLICT (key) DO NOTHING;
