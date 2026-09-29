-- Backfill of risk_participants for quotations and policies written before participants were stored: from the
-- co-insurance participants kept in doc.participantDetails (insurer matched by id, code, short name or name), or 100%
-- of insurance_company_id. Amounts are split by share (2 decimals) with the rounding remainder on the lead insurer.
-- The functions stay installed so rows loaded later by SQL (e.g. the sample data) can be backfilled the same way:
--   SELECT backfill_risk_participants();

-- Insurer id from a reference (id, code, short name or name); null when unknown.
CREATE OR REPLACE FUNCTION rp_insurer_id(p_ref text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT id FROM insurance_companies
   WHERE p_ref IS NOT NULL AND btrim(p_ref) <> ''
     AND (id::text = btrim(p_ref) OR lower(code) = lower(btrim(p_ref)) OR lower(short_name) = lower(btrim(p_ref)) OR lower(name) = lower(btrim(p_ref)))
   ORDER BY id LIMIT 1
$$;

-- Share percentage from the casings the screens have used ("50", "50%", 50).
CREATE OR REPLACE FUNCTION rp_share(p jsonb) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text := COALESCE(p->>'sharePercentage', p->>'Sharepercentage', p->>'SharePercentage', p->>'sharePercent', p->>'share');
BEGIN
  s := regexp_replace(COALESCE(s, ''), '[^0-9.]', '', 'g');
  IF s = '' OR s !~ '^[0-9]*\.?[0-9]+$' THEN RETURN NULL; END IF;
  RETURN s::numeric;
END $$;

-- Participants [{ic, share, lead}] of a document: the co-insurance list when it is complete (every insurer known,
-- distinct, shares totalling 100), else 100% of the fallback insurer (the entity's insurance_company_id or the first
-- participant); an empty array when no insurer is known.
CREATE OR REPLACE FUNCTION rp_parts_from_doc(p_doc jsonb, p_ic int) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  list jsonb := CASE WHEN jsonb_typeof(p_doc->'participantDetails') = 'array' THEN p_doc->'participantDetails' ELSE '[]'::jsonb END;
  e jsonb; i int := 0; ic int; sh numeric; total numeric := 0; ok boolean := true; lead_idx int := NULL;
  parts jsonb := '[]'::jsonb; first_ic int;
BEGIN
  FOR e IN SELECT value FROM jsonb_array_elements(list) LOOP
    ic := rp_insurer_id(COALESCE(e->>'insuranceCompanyId', e->>'insuranceCompanyName', e->>'InsuranceCompanyName', e->>'participantName', e->>'ParticipantName'));
    IF i = 0 THEN first_ic := ic; END IF;
    sh := rp_share(e);
    IF ic IS NULL OR sh IS NULL OR sh <= 0 OR sh > 100 OR parts @> jsonb_build_array(jsonb_build_object('ic', ic)) THEN ok := false; END IF;
    IF lead_idx IS NULL AND lower(COALESCE(e->>'isLead', e->>'isPrimary', 'false')) IN ('true', 'yes', '1') THEN lead_idx := i; END IF;
    parts := parts || jsonb_build_array(jsonb_build_object('ic', ic, 'share', sh, 'idx', i));
    total := total + COALESCE(sh, 0);
    i := i + 1;
  END LOOP;
  IF COALESCE((p_doc->>'isCoInsurance')::text, 'false') IN ('true', 'yes', '1') AND i > 1 AND ok AND abs(total - 100) < 0.0001 THEN
    RETURN (SELECT jsonb_agg(jsonb_build_object('ic', (x->>'ic')::int, 'share', (x->>'share')::numeric, 'lead', (x->>'idx')::int = COALESCE(lead_idx, 0))) FROM jsonb_array_elements(parts) x);
  END IF;
  ic := COALESCE(p_ic, first_ic);
  IF ic IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN jsonb_build_array(jsonb_build_object('ic', ic, 'share', 100, 'lead', true));
END $$;

-- Write the participants of one entity, splitting the totals by share (remainder on the lead).
CREATE OR REPLACE FUNCTION rp_write_split(p_type text, p_id text, p_parts jsonb, p_si numeric, p_prem numeric, p_tax numeric, p_total numeric,
  p_comm numeric, p_rate numeric, p_by text DEFAULT 'backfill') RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  x jsonb; n int := 0;
  o_si numeric := 0; o_prem numeric := 0; o_tax numeric := 0; o_total numeric := 0; o_comm numeric := 0;
  sh numeric;
BEGIN
  IF p_parts IS NULL OR jsonb_array_length(p_parts) = 0 THEN RETURN 0; END IF;
  -- non-lead shares first, rounded; the lead takes what is left
  FOR x IN SELECT value FROM jsonb_array_elements(p_parts) WHERE NOT (value->>'lead')::boolean LOOP
    sh := (x->>'share')::numeric;
    INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, is_lead, share_percent, sum_insured, premium, taxes, premium_total,
      commission_rate, commission_amount, status, created_by)
    VALUES (p_type, p_id, (x->>'ic')::int, false, sh, round(COALESCE(p_si, 0) * sh / 100, 2), round(COALESCE(p_prem, 0) * sh / 100, 2),
      round(COALESCE(p_tax, 0) * sh / 100, 2), round(COALESCE(p_total, 0) * sh / 100, 2), p_rate, round(COALESCE(p_comm, 0) * sh / 100, 2), 'active', p_by);
    o_si := o_si + round(COALESCE(p_si, 0) * sh / 100, 2); o_prem := o_prem + round(COALESCE(p_prem, 0) * sh / 100, 2);
    o_tax := o_tax + round(COALESCE(p_tax, 0) * sh / 100, 2); o_total := o_total + round(COALESCE(p_total, 0) * sh / 100, 2);
    o_comm := o_comm + round(COALESCE(p_comm, 0) * sh / 100, 2);
    n := n + 1;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p_parts) WHERE (value->>'lead')::boolean LOOP
    INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, is_lead, share_percent, sum_insured, premium, taxes, premium_total,
      commission_rate, commission_amount, status, created_by)
    VALUES (p_type, p_id, (x->>'ic')::int, true, (x->>'share')::numeric, COALESCE(p_si, 0) - o_si, COALESCE(p_prem, 0) - o_prem, COALESCE(p_tax, 0) - o_tax,
      COALESCE(p_total, 0) - o_total, p_rate, COALESCE(p_comm, 0) - o_comm, 'active', p_by);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Participants for every quotation and policy that has none yet. Returns the number of entities backfilled.
CREATE OR REPLACE FUNCTION backfill_risk_participants() RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; parts jsonb; n int := 0;
BEGIN
  FOR r IN SELECT q.* FROM quotes q WHERE q.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM risk_participants rp WHERE rp.entity_type = 'quote' AND rp.entity_id = q.id) LOOP
    parts := rp_parts_from_doc(r.doc, r.insurance_company_id);
    IF jsonb_array_length(parts) > 0 THEN
      PERFORM rp_write_split('quote', r.id, parts, r.sum_insured, r.premium_base, r.vat + r.dst + r.lgt + r.fst, r.premium_total, r.commission_amount, r.commission_rate);
      UPDATE quotes SET insurance_company_id = (SELECT (x->>'ic')::int FROM jsonb_array_elements(parts) x WHERE (x->>'lead')::boolean LIMIT 1)
       WHERE id = r.id AND insurance_company_id IS NULL;
      n := n + 1;
    END IF;
  END LOOP;
  FOR r IN SELECT p.*, q.vat + q.dst + q.lgt + q.fst AS q_taxes, q.doc AS q_doc, q.commission_rate AS q_rate FROM policies p LEFT JOIN quotes q ON q.id = p.quote_id
      WHERE NOT EXISTS (SELECT 1 FROM risk_participants rp WHERE rp.entity_type = 'policy' AND rp.entity_id = p.id) LOOP
    parts := rp_parts_from_doc(CASE WHEN jsonb_typeof(r.doc->'participantDetails') = 'array' THEN r.doc ELSE COALESCE(r.q_doc, r.doc) END, r.insurance_company_id);
    IF jsonb_array_length(parts) > 0 THEN
      PERFORM rp_write_split('policy', r.id, parts, r.sum_insured, r.net_premium, COALESCE(r.q_taxes, 0), r.premium_total, r.commission_amount, r.q_rate);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;

SELECT backfill_risk_participants();
