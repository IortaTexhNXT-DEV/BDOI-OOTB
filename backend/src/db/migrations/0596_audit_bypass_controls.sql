-- The append-only audit trail (migration 0591) is lifted only through audit_bypass_begin(tool, reason, actor), never
-- by setting app.audit_purge by hand:
--   - audit_bypass_begin writes an audit entry of its own (entity audit_bypass, action begin: the tool, the reason, the
--     database user, the actor) and sets app.audit_purge to a token bound to the current transaction; the token is
--     worthless in any other transaction and the trigger refuses a token without its begin entry;
--   - audit_bypass_end writes the closing entry with the rows deleted and updated under the bypass;
--   - entries of entity audit_bypass are never updated or deleted, bypass or not; TRUNCATE of the audit trail is always
--     refused (the tools delete what they remove, row by row, so the count is recorded);
--   - an update under the bypass may change only the personal-data columns (before_data, after_data, ip, username:
--     the masking tool and the key rotation); id, time, user, entity, record and action never change.
-- The application refuses any statement that names the bypass (db/pool.js); the bypass is used by the operator tools
-- (scripts/) and by the housekeeping job. Idempotent.

CREATE OR REPLACE FUNCTION audit_bypass_token() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'tx:' || txid_current()::text
$$;

CREATE OR REPLACE FUNCTION audit_bypass_begin(p_tool text, p_reason text, p_actor text DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  IF coalesce(trim(p_tool), '') = '' OR coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'The audit trail bypass needs a tool and a reason' USING ERRCODE = '42501';
  END IF;
  INSERT INTO audit_log(username, entity, entity_id, action, after_data)
  VALUES (coalesce(p_actor, session_user::text), 'audit_bypass', audit_bypass_token(), 'begin',
          jsonb_build_object('tool', p_tool, 'reason', p_reason, 'databaseUser', session_user::text, 'actor', p_actor, 'transaction', txid_current()))
  RETURNING id INTO v_id;
  PERFORM set_config('app.audit_purge', audit_bypass_token(), true);
  PERFORM set_config('app.audit_bypass_deleted', '0', true);
  PERFORM set_config('app.audit_bypass_updated', '0', true);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION audit_bypass_active() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.audit_purge', true) = audit_bypass_token()
     AND EXISTS (SELECT 1 FROM audit_log WHERE entity = 'audit_bypass' AND action = 'begin' AND entity_id = audit_bypass_token())
$$;

CREATE OR REPLACE FUNCTION audit_bypass_end() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT audit_bypass_active() THEN RETURN; END IF;
  INSERT INTO audit_log(username, entity, entity_id, action, after_data)
  SELECT b.username, 'audit_bypass', audit_bypass_token(), 'end',
         b.after_data || jsonb_build_object('rowsDeleted', coalesce(nullif(current_setting('app.audit_bypass_deleted', true), ''), '0')::int,
                                            'rowsUpdated', coalesce(nullif(current_setting('app.audit_bypass_updated', true), ''), '0')::int)
    FROM audit_log b WHERE b.entity = 'audit_bypass' AND b.action = 'begin' AND b.entity_id = audit_bypass_token() ORDER BY b.id LIMIT 1;
  PERFORM set_config('app.audit_purge', '', true);
END $$;

CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'The audit trail cannot be truncated; delete its rows under audit_bypass_begin' USING ERRCODE = '42501';
  END IF;
  IF OLD.entity = 'audit_bypass' THEN
    RAISE EXCEPTION 'The record of an audit trail bypass cannot be changed or deleted' USING ERRCODE = '42501';
  END IF;
  IF audit_bypass_active() THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM set_config('app.audit_bypass_deleted', (coalesce(nullif(current_setting('app.audit_bypass_deleted', true), ''), '0')::int + 1)::text, true);
      RETURN OLD;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.at IS DISTINCT FROM OLD.at OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.entity IS DISTINCT FROM OLD.entity OR NEW.entity_id IS DISTINCT FROM OLD.entity_id OR NEW.action IS DISTINCT FROM OLD.action THEN
      RAISE EXCEPTION 'Only the personal data of an audit entry may be rewritten (masking, key rotation)' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.audit_bypass_updated', (coalesce(nullif(current_setting('app.audit_bypass_updated', true), ''), '0')::int + 1)::text, true);
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'The audit trail cannot be changed or deleted' USING ERRCODE = '42501';
END $$;
