-- Product Configurator rules as the business flow applies them (product-configurator/underwriting.js): the shipped
-- acceptance rules get a structured condition (risk field, operator, value), the authority role that approves a
-- referral (Processing Team, within the Underwriting referral limit of the authority matrix) and the loading %;
-- rating factors the risk field they rate on; coverages the quotation cover they belong to (cover terms printed on
-- the quotation slip and policy schedule); document templates what they are printed as. Idempotent: a row that
-- already has the structured value (set here or on screen) is left alone.

UPDATE product_components SET data = (data - 'authority') || $j${"field": "vehicleAge", "operator": "<=", "value": 15, "condition": "Vehicle age (years) <= 15", "action": "Auto-Accept", "otherwiseAction": "Refer", "otherwiseMessage": "Vehicle older than 15 years: refer to the insurer underwriter with an inspection report", "message": "Vehicle within the acceptable age"}$j$::jsonb || jsonb_build_object('authorityRole', (SELECT code FROM roles WHERE code IN ('tis-ops-unit-head', 'processing') ORDER BY code = 'processing' LIMIT 1)), updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$VEH_AGE_LIMIT$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "sumInsured", "operator": ">", "valueField": "fairMarketValue", "valueFactor": 1.1, "condition": "Sum insured > Fair market value x 1.1", "action": "Refer", "message": "Sum insured exceeds the fair market value by more than 10%"}$j$::jsonb || jsonb_build_object('authorityRole', (SELECT code FROM roles WHERE code IN ('tis-ops-unit-head', 'processing') ORDER BY code = 'processing' LIMIT 1)), updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$SI_VALIDATION$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "sumInsured", "operator": ">", "value": 5000000, "condition": "Sum insured > 5000000", "action": "Refer", "message": "Sum insured above PHP 5,000,000: insurer underwriter approval required"}$j$::jsonb || jsonb_build_object('authorityRole', (SELECT code FROM roles WHERE code IN ('tis-ops-unit-head', 'processing') ORDER BY code = 'processing' LIMIT 1)), updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$HIGH_SI$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "vehicleUse", "operator": "=", "value": "PUV", "condition": "Vehicle use = PUV", "action": "Decline", "message": "Public utility vehicles (PUV) are not accepted under this product: place PUV risks under a PUV programme"}$j$::jsonb, updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$PUV$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "claimsLast3Years", "operator": ">=", "value": 2, "condition": "Claims in the last 3 years >= 2", "action": "Apply Loading", "loadingPercent": 20, "message": "20% loading for two or more claims in the last 3 years"}$j$::jsonb, updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$CLAIMS_HIST$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "driverAge", "operator": "<", "value": 21, "condition": "Driver age < 21", "action": "Apply Loading", "loadingPercent": 15, "message": "15% loading for a driver under 21"}$j$::jsonb, updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$YOUNG_DRV$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "modified", "operator": "=", "value": true, "condition": "Vehicle has modifications", "action": "Refer", "message": "Modified vehicle: refer with the modification details"}$j$::jsonb || jsonb_build_object('authorityRole', (SELECT code FROM roles WHERE code IN ('tis-ops-unit-head', 'processing') ORDER BY code = 'processing' LIMIT 1)), updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$MODIFIED$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "memberCount", "operator": ">=", "value": 10, "condition": "Number of members >= 10", "action": "Auto-Accept", "otherwiseAction": "Refer", "otherwiseMessage": "Group below 10 members: refer to the insurer underwriter", "message": "Meets the minimum group size"}$j$::jsonb || jsonb_build_object('authorityRole', (SELECT code FROM roles WHERE code IN ('tis-ops-unit-head', 'processing') ORDER BY code = 'processing' LIMIT 1)), updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$GRP_SIZE_MIN$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = (data - 'authority') || $j${"field": "floodProne", "operator": "=", "value": true, "condition": "Location in a flood-prone area", "action": "Apply Loading", "loadingPercent": 25, "message": "25% loading for a flood-prone location"}$j$::jsonb, updated_at = now()
WHERE kind = 'underwriting-rules' AND code = $s$HIGH_RISK_LOC$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "vehicleAge"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$VEH_AGE$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "driverAge"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$DRV_AGE$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "ncbYears"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$NCB$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "vehicleUse"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$USE$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "fleetSize"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$FLEET$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"field": "constructionType"}$j$::jsonb WHERE kind = 'rating-factors' AND code = $s$CONST_TYPE$s$ AND NOT (data ? 'field');
UPDATE product_components SET data = data || $j${"quoteField": "lossAndDamageCoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$OD$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "lossAndDamageCoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$THEFT$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "ctplCoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$CTPL$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "actsOfNaturePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$AOG$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "bodilyInjuryCoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$VTPL-BI$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "propertyDamageCoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$VTPL-PD$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = data || $j${"quoteField": "APPAcoveragePremium"}$j$::jsonb WHERE kind = 'coverages' AND code = $s$APA$s$ AND NOT (data ? 'quoteField');
UPDATE product_components SET data = (data - 'template') || $j${"printAs": "policy-schedule", "format": "PDF"}$j$::jsonb WHERE kind = 'documents' AND code = $s$MOTOR_SCHED$s$ AND NOT (data ? 'printAs');
UPDATE product_components SET data = (data - 'template') || $j${"printAs": "ctpl-certificate", "format": "PDF"}$j$::jsonb WHERE kind = 'documents' AND code = $s$CTPL_CERT$s$ AND NOT (data ? 'printAs');
UPDATE product_components SET data = (data - 'template') || $j${"printAs": "member-enrollment", "format": "PDF"}$j$::jsonb WHERE kind = 'documents' AND code = $s$MEMBER_ENROLL$s$ AND NOT (data ? 'printAs');

-- The motor policy schedule and CTPL certificate templates also on the motor pricing template (MOT-003-2025), the
-- template that governs motor quotations and policies, so that their uploaded layouts are used when printing.
INSERT INTO product_components(template_id, kind, code, name, data, status, sort_order, created_by, updated_by)
SELECT m.id, c.kind, c.code, c.name, c.data, 'Active', c.sort_order, 'seed', 'seed'
FROM product_components c
JOIN product_templates s ON s.id = c.template_id AND s.template_code = 'MOTOR-COMP-2026'
CROSS JOIN LATERAL (SELECT id FROM product_templates WHERE template_code = 'MOT-003-2025' ORDER BY version DESC LIMIT 1) m
WHERE c.kind = 'documents' AND c.code IN ('MOTOR_SCHED', 'CTPL_CERT') AND c.status <> 'Deleted'
  AND NOT EXISTS (SELECT 1 FROM product_components x WHERE x.template_id = m.id AND x.kind = 'documents' AND x.code = c.code);
