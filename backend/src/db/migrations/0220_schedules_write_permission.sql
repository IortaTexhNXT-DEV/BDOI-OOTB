-- Master > Schedules (edit and run now) is guarded by write:schedules instead of the Accounting role; Accounting keeps
-- the access it had.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code IN ('accounting', 'system-admin') AND p.code = 'write:schedules'
ON CONFLICT DO NOTHING;
