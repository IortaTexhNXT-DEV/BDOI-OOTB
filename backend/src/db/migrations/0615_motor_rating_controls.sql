-- Motor rating controls of a quotation (TIS-BRD-PROD-12, PROD-09, PROD-10, QUOT-02, RENEW-03; MC-01, MC-02, MC-05),
-- applied by src/modules/quotations/motorRating.js and kept on the quotation as doc.motorRating.
--
-- FMV: the Own Damage sum insured of a Comprehensive Motor quotation is worked out from a reference value (the FMV of
-- the expiring term on a renewal, the SRP of a TFS prospect, or a reference value given on the quotation) less the
-- depreciation. Changing the FMV the system worked out needs override:motor-fmv and a reason (Reason Codes, context
-- fmv_edit). Issuing rates: the defaults are the issuing rates of the commission rule (FR-CMR-020), else the motor tariff
-- rate of the vehicle class, else promotions.standard_rates; another rate needs override:quotation-rates (closed to
-- external agents and associates). A rate below the minimum issuing rate (setting, or the lowest Own Damage rate of
-- the discount cap) is referred (rule RATE_BELOW_MIN). Without a promotion the Order Summary discount stays within the
-- discount cap and above the maker's Quotation discount authority is referred (PROD-09). The Motor excess (PROD-10).
--
-- Settings:
--   motor.fmv_rating                          the FMV is worked out from the reference value less depreciation
--   motor.depreciation_pct                    default depreciation of the reference value (10%)
--   motor.depreciation_options                depreciation rates a user may choose (MC-01: 8, 10, 15, 20%)
--   motor.fmv_edit_reason_required            an FMV other than the one worked out needs a reason
--   motor.rate_override_controlled            a peril rate other than the issuing rate needs override:quotation-rates
--   motor.minimum_issuing_rates               the lowest Own Damage / Acts of Nature rate without approval (null: none)
--   motor.min_rate_approval_roles             the roles that approve a rate below the minimum
--   motor.excess                              the Motor excess: % of the sum insured (or of each loss), minimum
--   quotations.discount_caps_without_promotion  the discount cap and authority apply to a discount without a promotion
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('motor.fmv_rating', 'true', 'quotations', 'Motor: the fair market value (Own Damage sum insured) is worked out from the reference value (FMV of the expiring term, SRP of the prospect, or the reference value given) less the depreciation', 'boolean', true),
 ('motor.depreciation_pct', '10', 'quotations', 'Motor: default depreciation (%) of the reference value; a brand-new vehicle on its SRP is not depreciated', 'number', true),
 ('motor.depreciation_options', '[8, 10, 15, 20]', 'quotations', 'Motor: the depreciation rates (%) a user may choose on the quotation', 'json', true),
 ('motor.fmv_edit_reason_required', 'true', 'quotations', 'Motor: a fair market value other than the one worked out needs a reason (and the right override:motor-fmv)', 'boolean', true),
 ('motor.rate_override_controlled', 'true', 'quotations', 'Motor: an Own Damage or Acts of Nature rate other than the issuing rate needs the right override:quotation-rates', 'boolean', true),
 ('motor.minimum_issuing_rates', '{"OD": null, "AON": null}', 'quotations', 'Motor: lowest Own Damage (OD) and Acts of Nature (AON) rates (%) without approval; the lowest OD rate of the discount cap also applies (null: none)', 'json', true),
 ('motor.min_rate_approval_roles', '["operations", "tis-sales-unit-head", "tis-ops-unit-head", "tis-general-manager"]', 'quotations', 'Motor: the roles that approve a rate below the minimum issuing rate (underwriting referral RATE_BELOW_MIN)', 'json', true),
 ('motor.excess', '{"pct": 5, "basis": "sum-insured", "minimum": 0}', 'quotations', 'Motor excess: pct of the sum insured (basis sum-insured) or of each loss (basis loss), with a minimum amount; a promotion''s fixed excess replaces it', 'json', true),
 ('quotations.discount_caps_without_promotion', 'true', 'quotations', 'A Motor Order Summary discount without a promotion stays within the discount cap of the product and channel type, and above the maker''s Quotation discount limit is referred', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

-- Users of the roles that gain a permission get a new token version (the permissions travel in the access token);
-- only on the first run, while the permissions do not exist yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'override:quotation-rates');

INSERT INTO permissions(code, module, description) VALUES
 ('override:quotation-rates', 'quotations', 'Change the Own Damage or Acts of Nature rate of a Motor quotation away from the issuing rate'),
 ('override:motor-fmv', 'quotations', 'Change the fair market value of a Motor quotation away from the value less depreciation, with a reason')
ON CONFLICT (code) DO NOTHING;

-- the internal users who rate (about 20: the Officers and Unit Heads of Sales and Operations and the General Manager),
-- never the associates; the broker roles keep what they could do
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('override:quotation-rates', 'override:motor-fmv')
WHERE r.code IN ('system-admin', 'sales', 'processing', 'operations', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager')
ON CONFLICT DO NOTHING;
