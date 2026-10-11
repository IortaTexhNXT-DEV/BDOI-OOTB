-- Data Migration & Go-Live: controls after the mock migration review.
--
-- Reconciliation. A difference keeps who explained it and when (explained_by, explained_at) and the note of its
-- acceptance (acceptance_note): accepting no longer replaces the explanation. A sign-off slot may name the roles that
-- sign it (migration_recon_signoffs.roles, copied from migration.recon_signoffs when the reconciliation is created): the
-- Finance Head slot is signed by the finance role.
--
-- Settings of the Go-Live tab. A change is a request approved by a second user, like the lock: go_live_lock_requests
-- takes the action 'settings' with the values requested (settings) and those they replace (settings_before).
-- migration.numbering_mask_series: the series of new business that follow the TISPH numbering mask (BRD DOC-01, carry
-- the branch); the Go / No-Go criterion G8 and the hypercare numbering check name a series that does not.
--
-- Access. Finance (tis-finance) enters the legacy control totals, explains differences and runs the checklist steps it
-- owns: write:data-load, with approve:data-load as before (maker-checker on every item). Audit (tis-auditor) reads the
-- records it reconciles: clients, policies, claims, receivables, receipts, journals, period-end, reports; personal data
-- stay masked (no view:pii). Users of both roles get a new token version once (the permissions travel in the token).
-- Idempotent.

ALTER TABLE migration_recon_differences ADD COLUMN IF NOT EXISTS explained_by text REFERENCES users(id);
ALTER TABLE migration_recon_differences ADD COLUMN IF NOT EXISTS explained_at timestamptz;
ALTER TABLE migration_recon_differences ADD COLUMN IF NOT EXISTS acceptance_note text;
CREATE INDEX IF NOT EXISTS migration_recon_differences_explained_by_idx ON migration_recon_differences(explained_by) WHERE explained_by IS NOT NULL;
COMMENT ON COLUMN migration_recon_differences.explained_by IS 'User who gave the explanation (never the user who accepts the difference)';
COMMENT ON COLUMN migration_recon_differences.acceptance_note IS 'Note of the user who accepted the difference';

ALTER TABLE migration_recon_signoffs ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN migration_recon_signoffs.roles IS 'Role codes whose holders sign the slot (empty: any approver who did not load the batches)';

UPDATE app_settings SET value = (SELECT jsonb_agg(CASE WHEN s->>'slot' = 'finance-head' AND NOT s ? 'roles' THEN s || '{"roles": ["tis-finance"]}'::jsonb ELSE s END ORDER BY i)
    FROM jsonb_array_elements(value) WITH ORDINALITY AS x(s, i)),
       label = 'Reconciliation of migration loads: the sign-offs needed (slot, label and the roles that sign it), each by a user who neither uploaded nor approved its loads',
       updated_at = now()
 WHERE key = 'migration.recon_signoffs' AND jsonb_typeof(value) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(value) s WHERE s->>'slot' = 'finance-head' AND NOT s ? 'roles');

ALTER TABLE go_live_lock_requests DROP CONSTRAINT IF EXISTS go_live_lock_requests_action_check;
ALTER TABLE go_live_lock_requests ADD CONSTRAINT go_live_lock_requests_action_check CHECK (action IN ('lock', 'unlock', 'settings'));
ALTER TABLE go_live_lock_requests ADD COLUMN IF NOT EXISTS settings jsonb;
ALTER TABLE go_live_lock_requests ADD COLUMN IF NOT EXISTS settings_before jsonb;
COMMENT ON COLUMN go_live_lock_requests.settings IS 'Settings request: the values requested by API field (loadApprovalRequired, kpiIncludeMigrated ...)';
COMMENT ON COLUMN go_live_lock_requests.settings_before IS 'Settings request: the values they replace, when requested';
COMMENT ON TABLE go_live_lock_requests IS 'Requests of the Go-Live tab: switch the go-live lock on (lock), lift it for named imports and hours (unlock) or change its settings (settings), each approved by a second user';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('migration.numbering_mask_series', '["quote", "policy", "endorsement", "claim", "receipt"]', 'golive',
  'Numbering series of new business that follow the TISPH numbering mask (Product Type, Subline Type, Business Type, Branch and Sequence): checked before go-live', 'json')
ON CONFLICT (key) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('tis-finance', 'tis-auditor'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
                    WHERE r.code = 'tis-finance' AND p.code = 'write:data-load');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('tis-finance', ARRAY['write:data-load']),
  ('tis-auditor', ARRAY['read:reports', 'read:leads', 'read:clients', 'read:quotations', 'read:policies', 'read:endorsements', 'read:renewals', 'read:claims',
    'read:collections', 'read:receipts', 'read:remittance', 'read:commission', 'read:incentive', 'read:disbursements', 'read:journal-vouchers', 'read:payables',
    'read:fixed-assets', 'read:period-end', 'read:bank-reconciliation'])
) AS v(role, perms)
JOIN roles r ON r.code = v.role
JOIN permissions p ON p.code = ANY(v.perms)
ON CONFLICT DO NOTHING;
