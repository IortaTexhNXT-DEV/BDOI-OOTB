-- Partial and full settlements of a claim (TIS-BRD-CLAIM-05, Pre-BSM P07 step 8): a claim may be settled in parts; each
-- settlement is submitted, approved by another user within the Authority Matrix limit (or returned) and released. A
-- partial settlement leaves the claim open (status partially-settled) to be revisited and completed later by the final
-- settlement. claims.approved_amount and claims.settled_amount are the totals of the approved settlements.
--
-- The settlement in the claims.settlement document and the settlement request columns stay the latest submission
-- (the claim screens read them). Claims settled before this migration get their settlement as one final row.
--
-- Settlement cash movements recorded in error are reversed (reversing journal, reason and reverser); a reversed
-- movement no longer counts in the cash position.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS claim_settlements (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  seq int NOT NULL,
  kind text NOT NULL DEFAULT 'final' CHECK (kind IN ('partial', 'final')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  approved_amount numeric(14,2),
  settlement_type text,
  settlement_issue_date date,
  settlement_date date,
  paid_through_broker boolean NOT NULL DEFAULT false,
  payee text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned')),
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  journal_id text REFERENCES journal_vouchers(id),
  UNIQUE (claim_id, seq)
);
CREATE INDEX IF NOT EXISTS claim_settlements_claim_idx ON claim_settlements(claim_id, status);
COMMENT ON TABLE claim_settlements IS 'Settlements of a claim, partial or final, each submitted and approved by another user';

INSERT INTO claim_settlements(claim_id, seq, kind, amount, approved_amount, settlement_type, settlement_issue_date, settlement_date, paid_through_broker, payee,
                              status, requested_by, requested_at, decided_by, decided_at, journal_id)
SELECT c.id, 1, 'final', COALESCE(NULLIF(c.settlement->>'settlementAmount', '')::numeric, c.settled_amount, c.approved_amount),
       CASE WHEN c.status IN ('approved', 'settled', 'closed') THEN COALESCE(c.approved_amount, c.settled_amount) END,
       c.settlement->>'settlementType', NULLIF(c.settlement->>'settlementIssueDate', '')::date, NULLIF(c.settlement->>'settlementDate', '')::date,
       COALESCE((c.settlement->>'paidThroughBroker')::boolean, false), c.settlement->>'payee',
       CASE WHEN c.status = 'pending-approval' THEN 'pending' ELSE 'approved' END, c.settlement_requested_by, COALESCE((c.settlement->>'requestedAt')::timestamptz, c.updated_at),
       c.settlement_approved_by, c.settlement_approved_at, c.settlement_jv_id
  FROM claims c
 WHERE COALESCE(NULLIF(c.settlement->>'settlementAmount', '')::numeric, c.settled_amount, c.approved_amount) > 0
   AND (c.status IN ('pending-approval', 'approved', 'settled') OR (c.status = 'closed' AND c.settled_amount IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM claim_settlements s WHERE s.claim_id = c.id);

ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS reversed_by text;
ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS reversal_reason_code text;
ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS reversal_journal_id text REFERENCES journal_vouchers(id);
COMMENT ON COLUMN claim_settlement_movements.reversed_at IS 'When the movement was reversed (recorded in error); a reversed movement does not count';

CREATE TABLE IF NOT EXISTS claim_communications (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('insurer', 'client', 'adjuster', 'repair-shop', 'other')),
  direction text NOT NULL DEFAULT 'out' CHECK (direction IN ('in', 'out')),
  method text NOT NULL,
  subject text,
  message text NOT NULL,
  follow_up_date date,
  follow_up_done_at timestamptz,
  follow_up_done_by text,
  follow_up_alerted_at timestamptz,
  email_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_communications_claim_idx ON claim_communications(claim_id, created_at);
CREATE INDEX IF NOT EXISTS claim_communications_follow_up_idx ON claim_communications(follow_up_date) WHERE follow_up_done_at IS NULL AND follow_up_date IS NOT NULL;
COMMENT ON TABLE claim_communications IS 'Exchanges on a claim with the insurer, the client, the adjuster or the repair shop, with follow-up dates';
