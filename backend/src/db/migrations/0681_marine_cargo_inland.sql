-- Marine Cargo inland in Phase 1 (TIS-BRD-PJRN-09, FRS PJRN-09 4.4, client decision of 11 October 2026): a cargo open cover
-- rated on the inland conveyances (marine.inland_conveyances, Land) is always available (feature marine-cargo-inland);
-- the other conveyances (Sea, Air) are the Phase 2 feature marine-cargo, enabled by SUPERID on Features & Releases.
-- The open policies of the open covers are remitted bill by bill: policies.details.openCover. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('marine.inland_conveyances', '["Land"]', 'marine', 'Conveyances of a Marine Cargo inland open cover (Phase 1); a cover rated on another conveyance needs the Phase 2 feature Marine cargo open covers (sea and air)', 'json', true)
ON CONFLICT (key) DO NOTHING;

UPDATE policies p SET details = COALESCE(p.details, '{}'::jsonb) || '{"openCover": true}'::jsonb
  FROM open_covers o WHERE o.policy_id = p.id AND COALESCE(p.details->>'openCover', '') <> 'true';
