-- Targets of the renewal KPIs shown on Renewals > Performance (were fixed in the screen).
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('renewals.target_renewal_rate', '85', 'renewals', 'Target renewal rate (%) on Renewals > Performance', 'number'),
 ('renewals.target_premium_retention', '90', 'renewals', 'Target premium retention (%) on Renewals > Performance', 'number'),
 ('renewals.target_cycle_days', '15', 'renewals', 'Target renewal cycle time in days, from renewal opened to renewed', 'number'),
 ('renewals.target_satisfaction', '4.5', 'renewals', 'Target customer satisfaction (out of 5) when surveys are captured', 'number')
ON CONFLICT (key) DO NOTHING;
