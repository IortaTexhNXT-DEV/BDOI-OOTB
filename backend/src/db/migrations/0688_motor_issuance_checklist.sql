-- Motor issuance checklist (TIS-BRD-ISSUE-01, TIS-BRD-KYC-03; TISPH decision of 11 Oct 2026, gap register GAP-QUOTE-23).
--
-- The documents that must be on file before a Motor policy is booked from its placement slip, per Philippine broking
-- practice, kept as the Motor Issuance Checklist master (Master > Insurance Management > Motor Issuance Checklist):
-- each record names the document, whether it is mandatory, whether a second user may waive it, and when it applies
-- (brand-new or used vehicle, individual or corporate insured, financed or not, and a condition: always, a used
-- vehicle older than the minimum age, a transfer of insurance, CTPL included). A record with a KYC document type is
-- also met by that document on the client's KYC file. Delivered records (adjusted by TISPH on the master):
--   brand new: sales invoice and delivery receipt; used: OR/CR, and photos or an inspection report from 3 years;
--   individual: valid government ID; corporate: SEC or DTI registration and the ID of the authorised signatory with
--   the board resolution or secretary's certificate; every Motor risk: signed proposal / application form, TIN
--   (optional); financed: the loan and mortgagee details; transfer: the previous policy; CTPL: the OR/CR or sales
--   invoice with the MV file number the COC is issued on.
-- placement_checklist_items: the checklist of a Motor placement slip built from the master (received with a file or a
-- remark, reopened, waived under maker-checker: requested with the reason, approved or rejected by a user holding
-- approve:policies who did not request it).
-- placement.issuance_checklist_mode: block (delivered: booking refused while a mandatory document is missing), warn
-- (booked, the missing documents named in the result and the audit trail) or off. Idempotent.

INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('motor-issuance-checklist', 'Motor Issuance Checklist', 'general', NULL, 'generic', NULL, 'code', 'documentName',
  $j$[{"name":"code","label":"Code","type":"string","required":true},
      {"name":"documentName","label":"Document","type":"string","required":true},
      {"name":"vehicleCondition","label":"Vehicle","type":"select","required":true,"options":["Any","Brand new","Used"],"default":"Any"},
      {"name":"customerType","label":"Insured","type":"select","required":true,"options":["Any","Individual","Corporate"],"default":"Any"},
      {"name":"financing","label":"Financing","type":"select","required":true,"options":["Any","Financed","Not financed"],"default":"Any"},
      {"name":"condition","label":"Applies When","type":"select","required":true,"options":["Always","Vehicle older than the minimum age","Transfer of insurance","CTPL included"],"default":"Always"},
      {"name":"minVehicleAge","label":"Minimum Vehicle Age (years)","type":"integer","required":false},
      {"name":"kycDocType","label":"KYC Document Type","type":"string","required":false},
      {"name":"required","label":"Mandatory","type":"boolean","required":false,"default":true},
      {"name":"canWaive","label":"Can Be Waived","type":"boolean","required":false,"default":true},
      {"name":"sortOrder","label":"Sort Order","type":"integer","required":false,"default":100},
      {"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},
      {"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 155, true, 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'motor-issuance-checklist', v.code, v.name, jsonb_build_object('code', v.code, 'documentName', v.name, 'vehicleCondition', v.veh, 'customerType', v.cust, 'financing', v.fin,
  'condition', v.cond, 'minVehicleAge', v.age, 'kycDocType', v.kyc, 'required', v.req, 'canWaive', v.waive, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES
  ('MIC-SI', 'Sales invoice of the vehicle', 'Brand new', 'Any', 'Any', 'Always', NULL::int, NULL, true, true, 10),
  ('MIC-DR', 'Delivery receipt of the vehicle', 'Brand new', 'Any', 'Any', 'Always', NULL, NULL, true, true, 20),
  ('MIC-ORCR', 'OR/CR (LTO official receipt and certificate of registration)', 'Used', 'Any', 'Any', 'Always', NULL, 'or-cr', true, true, 30),
  ('MIC-INSPECT', 'Vehicle photos (four sides) or inspection report', 'Used', 'Any', 'Any', 'Vehicle older than the minimum age', 3, 'vehicle-photos', true, true, 40),
  ('MIC-GOVID', 'Valid government ID of the insured', 'Any', 'Individual', 'Any', 'Always', NULL, 'government-id', true, false, 50),
  ('MIC-PROPOSAL', 'Proposal / application form signed by the insured', 'Any', 'Any', 'Any', 'Always', NULL, 'signed-proposal', true, true, 60),
  ('MIC-SECDTI', 'SEC registration or DTI certificate of the insured', 'Any', 'Corporate', 'Any', 'Always', NULL, 'sec-registration', true, true, 70),
  ('MIC-SIGNATORY', 'ID of the authorised signatory with the board resolution or secretary''s certificate', 'Any', 'Corporate', 'Any', 'Always', NULL, 'secretary-certificate', true, true, 80),
  ('MIC-LOAN', 'Loan and mortgagee details (financing bank, loan account, mortgagee clause)', 'Any', 'Any', 'Financed', 'Always', NULL, NULL, true, true, 90),
  ('MIC-PREVPOL', 'Previous policy of the vehicle (transfer of insurance)', 'Any', 'Any', 'Any', 'Transfer of insurance', NULL, NULL, true, true, 100),
  ('MIC-COC', 'OR/CR or sales invoice with the MV file number for the CTPL certificate of cover', 'Any', 'Any', 'Any', 'CTPL included', NULL, NULL, true, true, 110),
  ('MIC-TIN', 'TIN of the insured', 'Any', 'Any', 'Any', 'Always', NULL, 'tin', false, true, 120)
) AS v(code, name, veh, cust, fin, cond, age, kyc, req, waive, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'motor-issuance-checklist')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'motor-issuance-checklist' AND lower(m.code) = lower(v.code));

CREATE TABLE IF NOT EXISTS placement_checklist_items (
  id bigserial PRIMARY KEY,
  placement_id text NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  code text NOT NULL,
  document text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  can_waive boolean NOT NULL DEFAULT true,
  kyc_doc_type text,
  sort_order integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'waiver-requested', 'waived')),
  file_key text,
  file_name text,
  remark text,
  received_at timestamptz,
  received_by text REFERENCES users(id),
  waiver_reason text,
  waiver_requested_by text REFERENCES users(id),
  waiver_requested_at timestamptz,
  waiver_decided_by text REFERENCES users(id),
  waiver_decided_at timestamptz,
  waiver_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, code)
);
CREATE INDEX IF NOT EXISTS placement_checklist_items_received_by_fk_idx ON placement_checklist_items (received_by);
CREATE INDEX IF NOT EXISTS placement_checklist_items_waiver_requested_by_fk_idx ON placement_checklist_items (waiver_requested_by);
CREATE INDEX IF NOT EXISTS placement_checklist_items_waiver_decided_by_fk_idx ON placement_checklist_items (waiver_decided_by);
CREATE INDEX IF NOT EXISTS placement_checklist_items_waiver_pending_idx ON placement_checklist_items (waiver_requested_at) WHERE status = 'waiver-requested';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('placement.issuance_checklist_mode', '"block"', 'placement',
  'Motor Issuance Checklist at booking: block (a mandatory document missing refuses the booking), warn (booked, the missing documents named) or off', 'string', true)
ON CONFLICT (key) DO NOTHING;
