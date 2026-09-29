-- D102: incentives are calculated, approved (maker-checker between two finance users) and paid by finance, so the finance
-- role reads and writes incentive calculations. Program set-up (Master > Incentive Programs) stays with the business
-- administrator: the program endpoints now require write:masters. On a fresh database the roles and permissions do not
-- exist yet when migrations run and the seed grants the same; re-running changes nothing.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('read:incentive', 'write:incentive')
WHERE r.code = 'finance'
ON CONFLICT DO NOTHING;
