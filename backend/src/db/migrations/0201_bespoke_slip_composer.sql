-- Non-packaged (bespoke) placements, part 2: the slip composer. A composed slip belongs to a Request for Quotation
-- (broker slip) or a placement slip and holds the printed wording: sections (insured, period, situation, interest,
-- sum insured, limits, deductibles, premium, conditions, subjectivities or custom ones) and an ordered list of clauses.
-- Each clause keeps the library clause and version it came from; its wording may be edited on the slip (manuscript).
-- Every save is a version with a full snapshot, the list of changes and who made them.

CREATE TABLE IF NOT EXISTS composed_slips (
  id text PRIMARY KEY DEFAULT ('csl_' || encode(gen_random_bytes(8), 'hex')),
  slip_number text UNIQUE,
  title text NOT NULL,
  broker_slip_id text REFERENCES broker_slips(id),
  placement_id text REFERENCES placements(id),
  template_id int REFERENCES slip_templates(id),
  lob text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'cancelled')),
  version int NOT NULL DEFAULT 1,
  variables jsonb NOT NULL DEFAULT '{}',             -- placeholder values entered on the slip (override the derived ones)
  sections jsonb NOT NULL DEFAULT '[]',              -- [{ key, heading, text }] in print order
  finalised_at timestamptz, finalised_by text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS composed_slips_broker_slip ON composed_slips(broker_slip_id);
CREATE INDEX IF NOT EXISTS composed_slips_placement ON composed_slips(placement_id);

CREATE TABLE IF NOT EXISTS composed_slip_clauses (
  id bigserial PRIMARY KEY,
  slip_id text NOT NULL REFERENCES composed_slips(id) ON DELETE CASCADE,
  position int NOT NULL,
  clause_id int REFERENCES clause_library(id),       -- null: a manuscript clause written on the slip
  clause_version int,
  code text, title text NOT NULL,
  clause_type text NOT NULL,
  wording text NOT NULL,                             -- as printed on this slip (placeholders not yet filled)
  library_wording text,                              -- the library wording of clause_version when it was taken
  UNIQUE (slip_id, position));
CREATE INDEX IF NOT EXISTS composed_slip_clauses_clause ON composed_slip_clauses(clause_id);

CREATE TABLE IF NOT EXISTS composed_slip_versions (
  id bigserial PRIMARY KEY,
  slip_id text NOT NULL REFERENCES composed_slips(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,                           -- { title, status, variables, sections, clauses }
  changes jsonb NOT NULL DEFAULT '[]',               -- human-readable list of what changed against the previous version
  change_note text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slip_id, version));

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('composed_slip', 'Composed Slip', 'placement', 'CSL', 'Bespoke slip composed from the clause library', 'migration:0201')
ON CONFLICT (code) DO NOTHING;
