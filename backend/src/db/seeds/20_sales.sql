-- Sales and policy administration reference data: configuration keys and address lookups (districts / postal codes).
-- The fictional insurers and the linked sample (lead -> client -> quotation -> policy -> ...) are in sample/20_sales.sql.
-- Idempotent: settings ON CONFLICT DO NOTHING, lookups by natural key.

-- ---------- Configuration ----------
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('general.frontend_url', '"http://localhost:3000"', 'general', 'Front-end base URL (links in e-mails, e.g. quotation approval)', 'string'),
 ('leads.default_status', '"New"', 'leads', 'Status of a new lead', 'string'),
 ('leads.statuses', '["New","Contacted","Qualified","QuoteGenerated","Converted","Lost"]', 'leads', 'Lead statuses (report categories)', 'json'),
 ('leads.recent_days', '7', 'leads', 'Days counted as "recent" on the lead / quotation stats cards', 'number'),
 ('quotations.transitions', '{"Draft":["PendingCustomer","Rejected","Dropped"],"PendingCustomer":["CustomerAccepted","Rejected","Draft","Dropped"],"CustomerAccepted":["SubmittedToInsurer","Approved","Rejected"],"SubmittedToInsurer":["Approved","Rejected"],"Approved":["Rejected"],"Rejected":["Draft"],"Dropped":["Draft"],"Expired":["Draft"]}', 'quotations', 'Allowed quotation status changes (from: [to])', 'json'),
 ('quotations.locked_statuses', '["ConvertedToPolicy"]', 'quotations', 'Quotation statuses that can no longer be edited', 'json'),
 ('quotations.deletable_statuses', '["Draft","Rejected","Dropped"]', 'quotations', 'Quotation statuses that can be deleted', 'json'),
 ('quotations.convertible_statuses', '["CustomerAccepted","Approved"]', 'quotations', 'Quotation statuses that can be converted to a policy', 'json'),
 ('quotations.approval_link_ttl_hours', '168', 'quotations', 'Validity of the customer approval link (hours)', 'number'),
 ('quotations.approval_notify_roles', '["processing"]', 'quotations', 'Roles notified when a quotation is sent for approval', 'json'),
 ('workflow.quote_maker_checker', 'true', 'quotations', 'Quotation approval must be done by a different user than the creator', 'boolean'),
 ('premium.default_rates', '{"bodilyInjuryRate":1,"propertyDamageRate":1,"APPARate":0.5}', 'premium', 'Default cover rates (% of sum insured) when the quote gives none', 'json'),
 ('premium.taxes_by_lob', '{"MOTOR":["vat","dst","lgt"],"FIRE":["vat","dst","lgt","fst"],"IAR":["vat","dst","lgt","fst"],"DEFAULT":["vat","dst","lgt"]}', 'premium', 'Premium taxes applied per line of business', 'json'),
 ('policies.payment_statuses', '["Pending","Reviewing","Partial","Completed","Refunded"]', 'policies', 'Policy payment statuses', 'json'),
 ('policies.default_term_months', '12', 'policies', 'Default policy term (months) when no expiry is given', 'number'),
 ('receivables.due_days', '30', 'policies', 'Days from inception to the premium bill due date', 'number'),
 ('commission.initial_status', '"Accrued"', 'commission', 'Status of a commission line accrued at policy issuance', 'string'),
 ('endorsements.types', '{"1":"personal-details","2":"motor-details","3":"coverage","4":"policy-extension","5":"cancellation","fire_cancel":"cancellation","fire_details":"fire-details"}', 'endorsements', 'Endorsement type codes by the ids the endorsement screen sends', 'json'),
 ('dashboard.targets', '{"totalRevenue":5000000,"activePolicies":250,"newBusiness":2000000,"claimsRatio":70,"retentionRate":90,"customerSatisfaction":95}', 'dashboard', 'Executive dashboard targets', 'json'),
 ('dashboard.high_sum_insured', '5000000', 'dashboard', 'Sum insured from which a Processing Team case is high priority', 'number'),
 ('email.template.quote_approval', $j${"subject":"{{companyName}}: please review quotation {{quotationNumber}}","html":"<p>Dear {{customerName}},</p><p>Your {{productType}} quotation <b>{{quotationNumber}}</b> is ready. Gross premium: {{currency}} {{grossPremium}}.</p><p><a href=\"{{approvalUrl}}\">Review and accept the quotation</a> (link valid for {{validHours}} hours).</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: quotation approval request to the customer', 'json'),
 ('email.template.share_quote', $j${"subject":"Your {{productType}} quotation {{quotationNumber}}","html":"<p>Dear {{customerName}},</p><p>{{message}}</p><p>Quotation <b>{{quotationNumber}}</b> ({{productType}}): gross premium {{currency}} {{grossPremium}}, valid until {{validUntil}}.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: quotation shared with a recipient', 'json'),
 ('email.template.insurer_submission', $j${"subject":"Placement request {{quotationNumber}} - {{productType}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>Please review quotation <b>{{quotationNumber}}</b> for {{customerName}} ({{productType}}), sum insured {{currency}} {{sumInsured}}, indicated gross premium {{currency}} {{grossPremium}}.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: quotation submitted to an insurer', 'json'),
 ('email.template.policy_issued', $j${"subject":"Your policy {{policyNumber}} has been issued","html":"<p>Dear {{customerName}},</p><p>Policy <b>{{policyNumber}}</b> ({{productType}}) was issued from quotation {{quotationNumber}}. Gross premium: {{currency}} {{grossPremium}}.</p>"}$j$, 'email', 'E-mail: policy issued to the customer', 'json'),
 ('email.template.endorsement_customer', $j${"subject":"{{companyName}}: {{action}} {{endorsementNumber}} on policy {{policyNumber}}","html":"<p>Dear {{customerName}},</p><p>We have prepared {{action}} <b>{{endorsementNumber}}</b> on policy {{policyNumber}}. Premium adjustment: {{currency}} {{premiumDelta}}.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: endorsement sent to the customer', 'json')
ON CONFLICT (key) DO NOTHING;

-- ---------- Address lookups ----------
INSERT INTO states(country_id, code, name)
SELECT c.id, v.code, v.name FROM (VALUES ('BKK','Bangkok'),('CNX','Chiang Mai'),('PKT','Phuket')) AS v(code, name) JOIN countries c ON c.code = 'TH'
WHERE NOT EXISTS (SELECT 1 FROM states s WHERE s.name = v.name);
INSERT INTO cities(state_id, name)
SELECT s.id, v.city FROM (VALUES ('Bangkok','Pathum Wan'),('Bangkok','Bang Rak'),('Chiang Mai','Mueang Chiang Mai'),('Phuket','Mueang Phuket')) AS v(state, city)
JOIN states s ON s.name = v.state WHERE NOT EXISTS (SELECT 1 FROM cities c WHERE c.name = v.city);
INSERT INTO districts(city_id, name, postal_code)
SELECT ci.id, v.district, v.zip FROM (VALUES
 ('Makati','Poblacion','1210'),('Makati','Bel-Air','1209'),('Makati','San Lorenzo','1223'),('Quezon City','Diliman','1101'),('Quezon City','Cubao','1109'),
 ('Manila','Ermita','1000'),('Manila','Malate','1004'),('Taguig','Fort Bonifacio','1634'),('Pasig','Kapitolyo','1603'),('Bacoor','Molino','4102'),
 ('Santa Rosa','Balibago','4026'),('Cebu City','Lahug','6000'),('Mandaue','Banilad','6014'),('Davao City','Poblacion District','8000'),('San Fernando','Dolores','2000'),
 ('Malolos','Santo Rosario','3000'),('Batangas City','Poblacion','4200'),('Iloilo City','Jaro','5000'),('Bacolod','Mandalagan','6100'),
 ('Pathum Wan','Lumphini','10330'),('Pathum Wan','Pathum Wan','10330'),('Bang Rak','Si Lom','10500'),('Bang Rak','Suriya Wong','10500'),
 ('Mueang Chiang Mai','Si Phum','50200'),('Mueang Chiang Mai','Chang Phueak','50300'),('Mueang Phuket','Talat Yai','83000')) AS v(city, district, zip)
JOIN cities ci ON ci.name = v.city
ON CONFLICT (city_id, name) DO NOTHING;
INSERT INTO postal_codes(country_code, code, province, city, district)
SELECT co.code, d.postal_code, s.name, ci.name, d.name FROM districts d JOIN cities ci ON ci.id = d.city_id JOIN states s ON s.id = ci.state_id JOIN countries co ON co.id = s.country_id
WHERE d.postal_code IS NOT NULL
ON CONFLICT (country_code, code, district) DO NOTHING;
