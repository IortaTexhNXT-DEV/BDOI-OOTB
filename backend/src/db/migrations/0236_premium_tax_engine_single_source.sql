-- Premium taxes: one source, the premium tax and charge engine (Master > Premium Taxes & LGU Rates:
-- premium_charge_rules, lgu_tax_rates; modules/premium-charges). Quotations (and so endorsements and placement slips),
-- insurer offers on broker slips, the renewal queue quote, the renewal quotation and the product configurator
-- illustration all price taxes through chargesFor(); there is no longer a switch (tax.charge_engine.quotations) nor a
-- per-line tax list (premium.taxes_by_lob): the rules' lines and tax regimes decide which taxes apply.
--
-- The seeded rules are aligned with the rates the flat tax.* settings charged, so a default quotation keeps its
-- amounts (only rules still exactly as migration 0190 seeded them are changed; edited rules are left alone):
--   DST  stays as seeded: P0.50 on each P4.00 of premium, a fractional P4.00 counting as a whole one (NIRC section 184),
--        so quotations now follow the round-up instead of a flat 12.5%.
--   LGT  0.2%  ->  0.75% (tax.lgt_rate), the rate used where the location has no rate in LGU Tax Rates (city rates,
--        e.g. the Metro Manila rows at 0.2%, still apply to quotations that name the city or municipality).
--   VAT 12% (products under the VAT regime) and FST 2% (fire lines) were already equal.
-- The flat tax.* settings stay only as the fallback for a tax kind with no rule at all in the table.

UPDATE premium_charge_rules
   SET rate = 0.75, updated_by = 'migration:0236',
       remarks = 'Default local government tax (0.75%); the rate of the city / municipality in LGU Tax Rates applies when the quotation names one'
 WHERE code = 'LGT' AND kind = 'lgt' AND method = 'percent' AND rate = 0.2 AND updated_by IS NULL;

DELETE FROM app_settings WHERE key IN ('tax.charge_engine.quotations', 'premium.taxes_by_lob');

UPDATE app_settings SET label = v.label
FROM (VALUES
 ('tax.vat_rate', 'Fallback VAT rate: used only when Premium Taxes & LGU Rates has no VAT rule'),
 ('tax.dst_rate', 'Fallback documentary stamp tax rate: used only when Premium Taxes & LGU Rates has no DST rule'),
 ('tax.lgt_rate', 'Fallback local government tax rate: used only when Premium Taxes & LGU Rates has no LGT rule'),
 ('tax.fst_rate', 'Fallback fire service tax rate (fire lines): used only when Premium Taxes & LGU Rates has no FST rule'),
 ('tax.charge_engine.default_lgu', 'LGU tax rate code used when a quotation names no city or municipality (empty: the LGT rule rate)')
) AS v(key, label)
WHERE app_settings.key = v.key;
