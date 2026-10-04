-- Product rules drive the quotation fully (Product Configurator > Coverage Builder, Acceptance Rules, Rating Engine):
-- the quote wizard offers the covers of the governing template (mandatory always included, optional added or removed,
-- each priced on its "Priced on quotation as" premium; quotations.selectedCovers) and asks for the risk fields the
-- template's acceptance rules and rating factors test (driver date of birth or age, claims in the last 3 years, fair
-- market value, number of members), so every rule is evaluated. The setting below makes those fields compulsory on the
-- server as well (the wizard always asks for them).
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('underwriting.require_rule_fields', 'false', 'premium', 'Quotations: refuse a quotation that does not give a risk field tested by an acceptance rule of its product template (the wizard always asks for them)', 'boolean')
ON CONFLICT (key) DO NOTHING;
