-- Credit Life renewal (TIS-BRD-PJRN-03, CR-04; gap register GAP-QUOTE-17, GAP-RENEW-CLAIM-17): the year-1 compulsory
-- cover is renewed as the voluntary cover on a fresh renewal quotation. credit_life.renewal_product_switch maps the
-- product of the expiring cover to the product of the renewal; the quotation follows the Credit Life rules of
-- credit_life.rules (fixed rate per 1,000, default sum insured, term 1 to 5 years) and a reduced sum insured raises the
-- alert and is referred to credit_life.rules siReductionRoles (never the maker). Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('credit_life.renewal_product_switch', '{"CL-COMP": "CL-VOL"}', 'credit_life', 'Product of the Credit Life renewal quotation by product of the expiring cover (the compulsory year-1 cover renews as the voluntary cover)', 'json', true)
ON CONFLICT (key) DO NOTHING;
