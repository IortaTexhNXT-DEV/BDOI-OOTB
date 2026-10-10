-- Printable remittance advice (Accounts > Remittance > Tracking > Print, GET /api/remittance/remittances/:id/pdf): the
-- print icon of the remittance list printed the browser page, which came out blank. The remittance now prints as a
-- document on the broker letterhead with its policies and the amount due; an agency bill prints with its own title.
-- Idempotent.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.advice_title', '"Remittance Advice"', 'remittance', 'Title printed on the remittance advice to an insurer', 'string'),
 ('remittance.agency_bill_title', '"Agency Bill"', 'remittance', 'Title printed on an agency bill', 'string')
ON CONFLICT (key) DO NOTHING;
