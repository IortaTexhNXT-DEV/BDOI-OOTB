-- Reports of the internal and external auditors (role tis-auditor, migration 0440; read grants of migration 0445): the
-- reports the General Manager sees, so that the auditor ties the opening balances, the migrated receivables and the
-- business issued since go-live to the books (trial balance, financial statements, ledgers, registers). The reports'
-- read permission still applies. Runs after 82_tisph_roles.sql. Idempotent: a report already naming the auditor is kept.
UPDATE report_definitions SET roles = roles || ARRAY['tis-auditor'], updated_at = now()
 WHERE roles && ARRAY['tis-general-manager'] AND NOT roles && ARRAY['tis-auditor']
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-auditor');
