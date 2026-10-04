-- Field-level encryption of personal identifiers at rest (Data Privacy Act of 2012; NPC Circular 16-01, encryption of
-- personal data): TIN, government ID numbers and bank account numbers.
--
-- Encrypted columns:  clients.tin, leads.tax_number, commission_referrers.tin, commission_referrers.bank_account_no,
--                     bir_2307_certificates.payee_tin
-- Encrypted JSON keys: government ID, TIN and bank account keys (pii_json_key) anywhere inside clients.extra,
--                     leads.extra, quotes.doc, placements.doc, policies.doc and policies.details (the ID captured on the
--                     KYC steps of policy issuance), and the before / after values of the audit trail
-- Blind indexes:      clients.tin_bidx, leads.tax_number_bidx, commission_referrers.tin_bidx and bank_account_no_bidx:
--                     HMAC-SHA256 of the value reduced to letters and digits, upper case, so search by exact value works
--
-- The keys come from the environment (PII_ENCRYPTION_KEY, lib/pii.js) and reach the database as session settings set
-- on every connection of the API (db/pool.js): brokerverse.pii_kid, pii_enc_key, pii_mac_key, pii_bidx_key and, during a
-- key rotation, pii_prev_kid / pii_prev_enc_key / pii_prev_mac_key. They are never stored in a table. A session without
-- them (psql) cannot write a new identifier: the trigger refuses, so nothing is ever stored in clear by mistake.
-- Format: pii:1:<key id>:<base64 iv + AES-256-CBC ciphertext>:<base64 first 16 bytes of HMAC-SHA256(key id + iv + ct)>.
-- A value sent back masked by a form (contains "**") keeps the stored value. Key rotation: deploy/REFERENCE.md.
-- The last statements encrypt the identifiers already stored.

CREATE OR REPLACE FUNCTION pii_setting(name text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('brokerverse.' || name, true), '')
$$;

CREATE OR REPLACE FUNCTION pii_encrypt(p text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  kid text := pii_setting('pii_kid');
  k bytea;
  m bytea;
  body bytea;
BEGIN
  IF p IS NULL OR p = '' THEN RETURN p; END IF;
  IF kid IS NULL THEN
    RAISE EXCEPTION 'Personal identifiers cannot be stored: the encryption key of this session is not set (PII_ENCRYPTION_KEY)';
  END IF;
  k := decode(pii_setting('pii_enc_key'), 'hex');
  m := decode(pii_setting('pii_mac_key'), 'hex');
  body := gen_random_bytes(16);
  body := body || encrypt_iv(convert_to(p, 'UTF8'), k, body, 'aes-cbc/pad:pkcs');
  RETURN 'pii:1:' || kid || ':' || replace(encode(body, 'base64'), E'\n', '') || ':'
    || replace(encode(substring(hmac(convert_to(kid, 'UTF8') || body, m, 'sha256') FROM 1 FOR 16), 'base64'), E'\n', '');
END $$;

CREATE OR REPLACE FUNCTION pii_decrypt(v text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  parts text[];
  kid text;
  k bytea;
  m bytea;
  body bytea;
BEGIN
  IF v IS NULL OR v NOT LIKE 'pii:1:%' THEN RETURN v; END IF;
  parts := string_to_array(v, ':');
  kid := parts[3];
  IF kid = pii_setting('pii_kid') THEN
    k := decode(pii_setting('pii_enc_key'), 'hex'); m := decode(pii_setting('pii_mac_key'), 'hex');
  ELSIF kid = pii_setting('pii_prev_kid') THEN
    k := decode(pii_setting('pii_prev_enc_key'), 'hex'); m := decode(pii_setting('pii_prev_mac_key'), 'hex');
  ELSE
    RAISE EXCEPTION 'Personal identifier encrypted with key % cannot be read: set PII_ENCRYPTION_KEY_PREVIOUS', kid;
  END IF;
  body := decode(parts[4], 'base64');
  IF encode(substring(hmac(convert_to(kid, 'UTF8') || body, m, 'sha256') FROM 1 FOR 16), 'base64') <> parts[5] THEN
    RAISE EXCEPTION 'Personal identifier failed its integrity check';
  END IF;
  RETURN convert_from(decrypt_iv(substring(body FROM 17), k, substring(body FROM 1 FOR 16), 'aes-cbc/pad:pkcs'), 'UTF8');
END $$;

CREATE OR REPLACE FUNCTION pii_blind_index(p text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  n text := upper(regexp_replace(COALESCE(p, ''), '[^A-Za-z0-9]', '', 'g'));
  k text := pii_setting('pii_bidx_key');
BEGIN
  IF n = '' THEN RETURN NULL; END IF;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Personal identifiers cannot be indexed: the encryption key of this session is not set (PII_ENCRYPTION_KEY)';
  END IF;
  RETURN encode(hmac(convert_to(n, 'UTF8'), decode(k, 'hex'), 'sha256'), 'hex');
END $$;

-- A value as it must be stored: ciphertext of the current key; an unchanged or masked value keeps the old ciphertext.
CREATE OR REPLACE FUNCTION pii_store(v text, old text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE plain text;
BEGIN
  IF v IS NULL OR v = '' THEN RETURN v; END IF;
  IF pii_setting('pii_kid') IS NULL THEN
    RAISE EXCEPTION 'Personal identifiers cannot be stored: the encryption key of this session is not set (PII_ENCRYPTION_KEY)';
  END IF;
  IF old IS NOT NULL AND (v = old OR position('**' IN v) > 0) AND old LIKE 'pii:1:' || pii_setting('pii_kid') || ':%' THEN RETURN old; END IF;
  IF old IS NOT NULL AND position('**' IN v) > 0 THEN RETURN pii_encrypt(pii_decrypt(old)); END IF;
  IF v LIKE 'pii:1:' || pii_setting('pii_kid') || ':%' THEN RETURN v; END IF;
  plain := pii_decrypt(v);
  IF old IS NOT NULL AND old LIKE 'pii:1:' || pii_setting('pii_kid') || ':%' AND pii_decrypt(old) = plain THEN RETURN old; END IF;
  RETURN pii_encrypt(plain);
END $$;

-- JSON keys that hold an identifier: letters and digits of the key, lower case.
CREATE OR REPLACE FUNCTION pii_json_key(k text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(k, '[^A-Za-z0-9]', '', 'g')) = ANY (ARRAY[
    'idnumber', 'idno', 'idcardnumber', 'idcardno', 'governmentidnumber', 'governmentidno', 'passportnumber', 'passportno',
    'sssno', 'sssnumber', 'gsisno', 'gsisnumber', 'umidno', 'umidnumber', 'philsysno', 'philsysnumber', 'philhealthno', 'pagibigno',
    'tin', 'tinno', 'tinnumber', 'taxnumber', 'taxidentificationnumber', 'taxinformationnumber',
    'bankaccountno', 'bankaccountnumber'])
$$;

-- Encrypt the identifier keys of a JSON document (any depth); old: the stored document (unchanged values keep their ciphertext).
CREATE OR REPLACE FUNCTION pii_protect_jsonb(j jsonb, old jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  out jsonb;
  r record;
  i int;
BEGIN
  IF j IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(j) = 'object' THEN
    out := '{}'::jsonb;
    FOR r IN SELECT key, value FROM jsonb_each(j) LOOP
      IF jsonb_typeof(r.value) = 'string' AND pii_json_key(r.key) THEN
        out := out || jsonb_build_object(r.key, pii_store(r.value #>> '{}',
          CASE WHEN jsonb_typeof(old) = 'object' AND jsonb_typeof(old -> r.key) = 'string' THEN old ->> r.key END));
      ELSIF jsonb_typeof(r.value) IN ('object', 'array') THEN
        out := out || jsonb_build_object(r.key, pii_protect_jsonb(r.value, CASE WHEN jsonb_typeof(old) = 'object' THEN old -> r.key END));
      ELSE
        out := out || jsonb_build_object(r.key, r.value);
      END IF;
    END LOOP;
    RETURN out;
  ELSIF jsonb_typeof(j) = 'array' THEN
    out := '[]'::jsonb;
    FOR i IN 0 .. jsonb_array_length(j) - 1 LOOP
      out := out || jsonb_build_array(pii_protect_jsonb(j -> i, CASE WHEN jsonb_typeof(old) = 'array' THEN old -> i END));
    END LOOP;
    RETURN out;
  END IF;
  RETURN j;
END $$;

-- True when a JSON document holds an identifier key whose value is in clear or encrypted with an older key (the trigger
-- skips documents without any).
CREATE OR REPLACE FUNCTION pii_jsonb_needs(j jsonb) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT j IS NOT NULL AND j::text ~* ('"(id_?number|id_?no|id_?card_?(number|no)|government_?id_?(number|no)|passport_?(number|no)|sss_?(no|number)|gsis_?(no|number)|umid_?(no|number)|philsys_?(no|number)|philhealth_?no|pagibig_?no|tin(_?no|_?number)?|tax_?number|tax_?(identification|information)_?number|bank_?account_?(no|number))"\s*:\s*"(?!pii:1:' || COALESCE(pii_setting('pii_kid'), '') || ':)')
$$;

-- Trigger: arguments are 'column' or 'column:blind_index_column' for text columns, 'json:column' for JSON documents.
CREATE OR REPLACE FUNCTION pii_protect_columns() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  arg text;
  col text;
  bcol text;
  newj jsonb := to_jsonb(NEW);
  oldj jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  patch jsonb := '{}'::jsonb;
  v text;
  o text;
  stored text;
BEGIN
  FOREACH arg IN ARRAY TG_ARGV LOOP
    IF arg LIKE 'json:%' THEN
      col := substring(arg FROM 6);
      IF pii_jsonb_needs(newj -> col) THEN
        patch := patch || jsonb_build_object(col, pii_protect_jsonb(newj -> col, oldj -> col));
      END IF;
      CONTINUE;
    END IF;
    col := split_part(arg, ':', 1);
    bcol := NULLIF(split_part(arg, ':', 2), '');
    v := newj ->> col;
    o := oldj ->> col;
    IF v IS NULL OR v = '' THEN
      IF bcol IS NOT NULL THEN patch := patch || jsonb_build_object(bcol, NULL); END IF;
      CONTINUE;
    END IF;
    IF position('**' IN v) > 0 AND (o IS NULL OR o = '') THEN
      -- a masked value with nothing stored behind it: nothing to keep
      patch := patch || jsonb_build_object(col, o);
      CONTINUE;
    END IF;
    stored := pii_store(v, o);
    patch := patch || jsonb_build_object(col, stored);
    IF bcol IS NOT NULL THEN patch := patch || jsonb_build_object(bcol, pii_blind_index(pii_decrypt(stored))); END IF;
  END LOOP;
  IF patch <> '{}'::jsonb THEN NEW := jsonb_populate_record(NEW, patch); END IF;
  RETURN NEW;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS tin_bidx text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tax_number_bidx text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS tin_bidx text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS bank_account_no_bidx text;
CREATE INDEX IF NOT EXISTS clients_tin_bidx_idx ON clients(tin_bidx) WHERE tin_bidx IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_tax_number_bidx_idx ON leads(tax_number_bidx) WHERE tax_number_bidx IS NOT NULL;
CREATE INDEX IF NOT EXISTS commission_referrers_tin_bidx_idx ON commission_referrers(tin_bidx) WHERE tin_bidx IS NOT NULL;

DROP TRIGGER IF EXISTS clients_pii ON clients;
CREATE TRIGGER clients_pii BEFORE INSERT OR UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('tin:tin_bidx', 'json:extra');
DROP TRIGGER IF EXISTS leads_pii ON leads;
CREATE TRIGGER leads_pii BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('tax_number:tax_number_bidx', 'json:extra');
DROP TRIGGER IF EXISTS commission_referrers_pii ON commission_referrers;
CREATE TRIGGER commission_referrers_pii BEFORE INSERT OR UPDATE ON commission_referrers FOR EACH ROW
  EXECUTE FUNCTION pii_protect_columns('tin:tin_bidx', 'bank_account_no:bank_account_no_bidx');
DROP TRIGGER IF EXISTS bir_2307_certificates_pii ON bir_2307_certificates;
CREATE TRIGGER bir_2307_certificates_pii BEFORE INSERT OR UPDATE ON bir_2307_certificates FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('payee_tin');
DROP TRIGGER IF EXISTS audit_log_pii ON audit_log;
CREATE TRIGGER audit_log_pii BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('json:before_data', 'json:after_data');
DROP TRIGGER IF EXISTS quotes_pii ON quotes;
CREATE TRIGGER quotes_pii BEFORE INSERT OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('json:doc');
DROP TRIGGER IF EXISTS placements_pii ON placements;
CREATE TRIGGER placements_pii BEFORE INSERT OR UPDATE ON placements FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('json:doc');
DROP TRIGGER IF EXISTS policies_pii ON policies;
CREATE TRIGGER policies_pii BEFORE INSERT OR UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('json:doc', 'json:details');

-- encrypt what is already stored (a plain value differs from the stored one only by being clear: the trigger encrypts it)
UPDATE clients SET tin = tin WHERE tin IS NOT NULL AND tin <> '' AND tin NOT LIKE 'pii:1:%';
UPDATE clients SET extra = extra WHERE pii_jsonb_needs(extra);
UPDATE leads SET tax_number = tax_number WHERE tax_number IS NOT NULL AND tax_number <> '' AND tax_number NOT LIKE 'pii:1:%';
UPDATE leads SET extra = extra WHERE pii_jsonb_needs(extra);
UPDATE commission_referrers SET tin = tin WHERE (tin IS NOT NULL AND tin <> '' AND tin NOT LIKE 'pii:1:%')
   OR (bank_account_no IS NOT NULL AND bank_account_no <> '' AND bank_account_no NOT LIKE 'pii:1:%');
UPDATE bir_2307_certificates SET payee_tin = payee_tin WHERE payee_tin IS NOT NULL AND payee_tin <> '' AND payee_tin NOT LIKE 'pii:1:%';
UPDATE quotes SET doc = doc WHERE pii_jsonb_needs(doc);
UPDATE placements SET doc = doc WHERE pii_jsonb_needs(doc);
UPDATE policies SET doc = doc WHERE pii_jsonb_needs(doc) OR pii_jsonb_needs(details);
-- the audit trail keeps before and after values: identifiers in them are encrypted too (new entries by the trigger)
UPDATE audit_log SET before_data = pii_protect_jsonb(before_data, NULL) WHERE pii_jsonb_needs(before_data);
UPDATE audit_log SET after_data = pii_protect_jsonb(after_data, NULL) WHERE pii_jsonb_needs(after_data);
