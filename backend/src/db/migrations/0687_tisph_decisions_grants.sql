-- TISPH decisions of 11 Oct 2026 on who maintains client KYC and the scheme and promotion masters.
--
-- GAP-POLICY-09 (TIS-BRD-KYC-01 to KYC-05): Operations maintains the client KYC. write:client-kyc lets a user keep the
-- KYC of an existing client (identification, signatories and beneficial owners of a juridical client, KYC documents)
-- without the other client edits of write:clients. Granted to the TIS Operations personas (Associate, Officer, Unit
-- Head); every other persona keeps what it had (Sales edits clients with write:clients, the others read).
--
-- GAP-SALES-17 (TIS-BRD-SCHM-02, TIS-BRD-PROD-15): the Scheme Master and the promotions are maintained by the TIS Sales
-- Unit Head, the General Manager and IT AppSupport / Admin, each of whom makes and approves; the maker of a scheme or a
-- promotion never approves it (the services refuse it). The Operations Officer and Unit Head, who proposed them until
-- now (migrations 0485 and 0600), read them; the discount caps stay with Operations. Every other persona reads.
-- Idempotent; the seed (seed.js SCHEME_PERMS, TIS_PROMOTION_*) gives the same grants to a fresh database.

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-sales-unit-head', 'tis-general-manager', 'tis-it-admin'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'write:client-kyc');

INSERT INTO permissions(code, module, description) VALUES
 ('write:client-kyc', 'clients', 'Maintain the KYC of a client: identification, signatories, beneficial owners and KYC documents')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'write:client-kyc'),
  ('tis-ops-associate', 'write:client-kyc'), ('tis-ops-officer', 'write:client-kyc'), ('tis-ops-unit-head', 'write:client-kyc'),
  ('tis-sales-unit-head', 'read:schemes'), ('tis-sales-unit-head', 'write:schemes'), ('tis-sales-unit-head', 'approve:schemes'),
  ('tis-sales-unit-head', 'read:promotions'), ('tis-sales-unit-head', 'write:promotions'), ('tis-sales-unit-head', 'approve:promotions'),
  ('tis-general-manager', 'read:schemes'), ('tis-general-manager', 'write:schemes'), ('tis-general-manager', 'approve:schemes'),
  ('tis-general-manager', 'read:promotions'), ('tis-general-manager', 'write:promotions'), ('tis-general-manager', 'approve:promotions'),
  ('tis-it-admin', 'read:schemes'), ('tis-it-admin', 'write:schemes'), ('tis-it-admin', 'approve:schemes'),
  ('tis-it-admin', 'read:promotions'), ('tis-it-admin', 'write:promotions'), ('tis-it-admin', 'approve:promotions')
) AS g(role, perm)
JOIN roles r ON r.code = g.role JOIN permissions p ON p.code = g.perm
ON CONFLICT DO NOTHING;

-- the Operations Officer and Unit Head no longer make schemes and promotions (read only)
DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE rp.role_id = r.id AND rp.permission_id = p.id
   AND r.code IN ('tis-ops-officer', 'tis-ops-unit-head') AND p.code IN ('write:schemes', 'write:promotions');
