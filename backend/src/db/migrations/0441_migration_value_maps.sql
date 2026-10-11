-- Data Migration & Go-Live: value maps of the legacy code tables, and personal data of the load rows at rest.
--
-- Value maps. The legacy system names insurers, products, branches, users, channels, clients and statuses in its own
-- way ("Malayan Ins. Co.", "MC-COMP", "Makati Br."). A value map translates a legacy value to the BrokerVerse code
-- before the master lookup of a migration load (data-load/maps.js resolveValue). legacy_norm is the value in its
-- normalised form (lower case, accents kept, punctuation and company words removed for insurers), unique per object,
-- so "MALAYAN INSURANCE" and "Malayan Ins." resolve the same way. Maps are configuration: kept by the transaction reset,
-- maintained on Templates > Value Maps and written by the "Use existing" resolution of a duplicate row. A batch keeps
-- the latest updated_at it read (data_load_batches.maps_version); a map changed afterwards makes the batch validate again.
--
-- Load rows. The values of a load row (data) and the stored values it changes (before) hold personal identifiers as
-- supplied in the workbook: the identifier keys are encrypted by the same trigger as the other JSON documents, and the
-- loader encrypts the other personal columns (birth date, e-mail, phone) before it writes the row.
-- Idempotent.

CREATE TABLE IF NOT EXISTS migration_value_maps (
  id bigserial PRIMARY KEY,
  object text NOT NULL,
  legacy_value text NOT NULL,
  legacy_norm text NOT NULL,
  target_code text NOT NULL,
  note text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id),
  updated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS migration_value_maps_uq ON migration_value_maps(object, legacy_norm);
CREATE INDEX IF NOT EXISTS migration_value_maps_created_by_idx ON migration_value_maps(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS migration_value_maps_updated_by_idx ON migration_value_maps(updated_by) WHERE updated_by IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE migration_value_maps DROP CONSTRAINT IF EXISTS migration_value_maps_object_check;
  ALTER TABLE migration_value_maps ADD CONSTRAINT migration_value_maps_object_check CHECK (object IN ('insurer', 'product', 'branch', 'user', 'channel', 'client',
    'payment-status', 'claim-status', 'vehicle-type'));
END $$;

COMMENT ON TABLE migration_value_maps IS 'Legacy value -> BrokerVerse code, per object, applied by migration loads before the master lookup';
COMMENT ON COLUMN migration_value_maps.legacy_norm IS 'Legacy value in its normalised form (data-load/maps.js normalise): unique per object';

DROP TRIGGER IF EXISTS data_load_rows_pii ON data_load_rows;
CREATE TRIGGER data_load_rows_pii BEFORE INSERT OR UPDATE ON data_load_rows FOR EACH ROW
  EXECUTE FUNCTION pii_protect_columns('json:data', 'json:before');

-- rows written before this migration: their identifier keys are encrypted now
UPDATE data_load_rows SET data = data WHERE pii_jsonb_needs(data) OR pii_jsonb_needs(before);
