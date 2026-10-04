-- Product Configurator rules applied in the business flow (product-configurator/underwriting.js): a quotation referred
-- by an acceptance rule is approved by a user of the rule's authority role within the Underwriting referral limit of
-- the authority matrix (sum insured). Default limits per role are in seeds/66_authority_matrix.sql; the structured
-- conditions, authority roles and loadings of the shipped rules are in seeds/53_product_rules.sql.
INSERT INTO authority_transaction_types(code, name, measure, description, sort_order) VALUES
 ('underwriting_referral', 'Underwriting referral approval', 'amount', 'Sum insured of a quotation referred by a product acceptance rule (Product Configurator > Acceptance Rules) and approved to proceed', 120)
ON CONFLICT (code) DO NOTHING;
