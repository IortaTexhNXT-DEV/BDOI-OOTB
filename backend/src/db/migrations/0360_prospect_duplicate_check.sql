-- Create Prospect warns of possible duplicates before a new customer's prospect is saved: clients and open prospects
-- with the same e-mail, mobile number, or name and date of birth (GET /leads/duplicates). The user then uses the
-- existing client, opens the existing prospect, or saves the new prospect anyway. leads.duplicate_check switches the
-- warning off. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('leads.duplicate_check', 'true', 'leads', 'Prospects: warn of possible duplicates (clients and open prospects with the same e-mail, mobile number, or name and date of birth) before a new customer''s prospect is saved', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
