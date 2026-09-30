-- Bespoke placements (migration 0200): the roles that hold its permissions. The migration grants them on an existing
-- database; on a new database the roles are created by the seed after the migrations ran, so they are granted here.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON (r.code, p.code) IN (
  ('processing', 'read:bespoke'), ('processing', 'write:bespoke'), ('processing', 'write:clause-library'),
  ('operations', 'read:bespoke'), ('operations', 'write:bespoke'),
  ('accounting', 'read:bespoke'), ('accounting', 'write:bespoke-finance'),
  ('system-admin', 'read:bespoke'), ('system-admin', 'write:bespoke'), ('system-admin', 'write:clause-library'), ('system-admin', 'write:bespoke-finance'))
ON CONFLICT DO NOTHING;
