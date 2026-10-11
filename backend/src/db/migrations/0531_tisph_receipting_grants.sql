-- Receipting grants of the TISPH personas (PBSM-M17v4-RECEIPTING, GAP-CASH-15): Receipting & Official Receipts is
-- CCD-BP's (create, read, update); CCD-PDC and CCD-Recon read it; CCD-PDU has no access. CCD-Recon keeps the reversals
-- (reverse:receipts, migration 0524) and CCD-PDC the post-dated cheques, whose deposit and partner clearing raise the
-- cheque's receipt under write:pdc. Idempotent.

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
               WHERE (r.code IN ('tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-recon') AND p.code = 'write:receipts') OR (r.code = 'tis-ccd-pdu' AND p.code = 'read:receipts'));

DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE r.id = rp.role_id AND p.id = rp.permission_id
   AND ((r.code IN ('tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-recon') AND p.code = 'write:receipts') OR (r.code = 'tis-ccd-pdu' AND p.code = 'read:receipts'));
