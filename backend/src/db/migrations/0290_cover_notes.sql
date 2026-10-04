-- Cover notes (binders): temporary evidence of cover issued to the client while the insurer's policy is pending.
--   cover_notes   one cover note per quotation or placement slip: cover period (cover.note validity setting), status
--                 active -> superseded (the policy is issued, linked here) | expired (cover_to passed) | cancelled
-- Issued from an accepted quotation (cover_note.quote_statuses) or a sent / bound placement slip
-- (cover_note.placement_statuses); printed with the company letterhead (GET /cover-notes/:id/pdf).
CREATE TABLE IF NOT EXISTS cover_notes (
  id text PRIMARY KEY DEFAULT ('cvn_' || encode(gen_random_bytes(8), 'hex')),
  cover_note_number text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('quote', 'placement')),
  quote_id text REFERENCES quotes(id),
  placement_id text REFERENCES placements(id),
  client_id text REFERENCES clients(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  lob text,
  insured_name text,
  risk_description text,                               -- vehicle (make, model, plate) or location of the risk
  sum_insured numeric(16,2) NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  cover_from date NOT NULL,
  cover_to date NOT NULL,
  validity_days int NOT NULL CHECK (validity_days BETWEEN 1 AND 366),
  conditions text,                                     -- special conditions printed on the cover note
  insurer_reference text,                              -- the insurer's binder or confirmation reference
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired', 'cancelled')),
  policy_id text REFERENCES policies(id),
  superseded_at timestamptz,
  expired_at timestamptz,
  reminder_sent_at timestamptz,
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cover_to >= cover_from),
  CHECK ((source = 'quote' AND quote_id IS NOT NULL) OR (source = 'placement' AND placement_id IS NOT NULL)));
CREATE INDEX IF NOT EXISTS cover_notes_status ON cover_notes(status, cover_to);
CREATE INDEX IF NOT EXISTS cover_notes_quote ON cover_notes(quote_id);
CREATE INDEX IF NOT EXISTS cover_notes_placement ON cover_notes(placement_id);
CREATE INDEX IF NOT EXISTS cover_notes_client ON cover_notes(client_id);
CREATE INDEX IF NOT EXISTS cover_notes_policy ON cover_notes(policy_id);
-- one active cover note per quotation / placement slip
CREATE UNIQUE INDEX IF NOT EXISTS cover_notes_active_quote_uq ON cover_notes(quote_id) WHERE status = 'active' AND quote_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cover_notes_active_placement_uq ON cover_notes(placement_id) WHERE status = 'active' AND placement_id IS NOT NULL;
