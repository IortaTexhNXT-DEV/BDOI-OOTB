-- Sales target master and the variance of commission to target (TIS-BRD-RPT-02, Phase 1; TISPH remark "Include:
-- Total Comm vs Total Target = Variance").
--
-- sales_targets: the commission target of an agent (a payee of the Commission Payees master, commission_referrers) or
-- of a sales unit (a branch of the Branch master: the unit of the agent is the branch of the user linked to the payee)
-- for a month (period YYYY-MM). A target is kept on Master > Finance > Sales Targets (write:incentive), drafted,
-- submitted and approved by a holder of approve:incentive who neither created, last changed nor submitted it
-- (maker-checker); a return sends it back to Draft with the reviewer's note. Only an Approved target counts in the
-- reports; one target is in force per agent or unit and month, and an approved target is changed only through a new
-- draft that replaces it on approval. Targets are uploaded from the Sales Targets template (as drafts).
--
-- Reports: Agent Policy Conversion gains Target and Variance (total commission less total target of the agent and
-- month); Sales Target Variance shows the commission of each sales unit against its target per month.
-- No new permissions: the incentive permissions keep and approve the targets.
-- Idempotent.

CREATE TABLE IF NOT EXISTS sales_targets (
  id bigserial PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('agent', 'unit')),
  referrer_id text REFERENCES commission_referrers(id),
  branch_id integer REFERENCES branches(id),
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  target_amount numeric(16,2) NOT NULL CHECK (target_amount >= 0),
  remarks text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending-approval', 'approved', 'superseded', 'withdrawn')),
  replaces_id bigint REFERENCES sales_targets(id),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  CHECK ((scope = 'agent' AND referrer_id IS NOT NULL AND branch_id IS NULL) OR (scope = 'unit' AND branch_id IS NOT NULL AND referrer_id IS NULL))
);
COMMENT ON TABLE sales_targets IS 'Commission target of an agent or a sales unit (branch) for a month, approved by a second user (RPT-02)';
CREATE UNIQUE INDEX IF NOT EXISTS sales_targets_in_force_uq ON sales_targets (scope, COALESCE(referrer_id, ''), COALESCE(branch_id, 0), period) WHERE status = 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS sales_targets_open_uq ON sales_targets (scope, COALESCE(referrer_id, ''), COALESCE(branch_id, 0), period) WHERE status IN ('draft', 'pending-approval');
CREATE INDEX IF NOT EXISTS sales_targets_period_idx ON sales_targets (period, status);
CREATE INDEX IF NOT EXISTS sales_targets_referrer_id_fk_idx ON sales_targets (referrer_id);
CREATE INDEX IF NOT EXISTS sales_targets_branch_id_fk_idx ON sales_targets (branch_id);
CREATE INDEX IF NOT EXISTS sales_targets_replaces_id_fk_idx ON sales_targets (replaces_id);

-- Setting (seeds/settings.json, group incentive): incentive.sales_target_max_rows (2000).

-- Agent Policy Conversion of a database in use shows Target and Variance (a new database takes them from seed 96)
UPDATE report_definitions
   SET default_columns = default_columns || '[{"key":"target","label":"Target","type":"money"},{"key":"variance","label":"Variance","type":"money"}]'::jsonb
 WHERE code = 'tisph-agent-conversion' AND NOT default_columns @> '[{"key":"variance"}]'::jsonb;
