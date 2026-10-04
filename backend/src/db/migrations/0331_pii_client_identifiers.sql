-- Encryption at rest (0277) for the identifiers the AML/CFT onboarding added (0260): the government ID number on the
-- client record and on its authorised signatories and beneficial owners. Same trigger, same keys (db/pool.js session
-- settings); the rows already stored are encrypted here, through the trigger.
DROP TRIGGER IF EXISTS clients_pii ON clients;
CREATE TRIGGER clients_pii BEFORE INSERT OR UPDATE ON clients FOR EACH ROW
  EXECUTE FUNCTION pii_protect_columns('tin:tin_bidx', 'id_number', 'json:extra');
DROP TRIGGER IF EXISTS client_signatories_pii ON client_signatories;
CREATE TRIGGER client_signatories_pii BEFORE INSERT OR UPDATE ON client_signatories FOR EACH ROW
  EXECUTE FUNCTION pii_protect_columns('id_number');
DROP TRIGGER IF EXISTS client_beneficial_owners_pii ON client_beneficial_owners;
CREATE TRIGGER client_beneficial_owners_pii BEFORE INSERT OR UPDATE ON client_beneficial_owners FOR EACH ROW
  EXECUTE FUNCTION pii_protect_columns('id_number');

UPDATE clients SET id_number = id_number WHERE COALESCE(id_number, '') <> '' AND id_number NOT LIKE 'pii:1:%';
UPDATE client_signatories SET id_number = id_number WHERE COALESCE(id_number, '') <> '' AND id_number NOT LIKE 'pii:1:%';
UPDATE client_beneficial_owners SET id_number = id_number WHERE COALESCE(id_number, '') <> '' AND id_number NOT LIKE 'pii:1:%';
