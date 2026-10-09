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
 ('email.template.endorsement_customer', $j${"subject":"{{companyName}}: {{action}} {{endorsementNumber}} on policy {{policyNumber}}","html":"<p>Dear {{customerName}},</p><p>We have prepared {{action}} <b>{{endorsementNumber}}</b> on policy {{policyNumber}}. Premium adjustment: {{currency}} {{premiumDelta}}.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: endorsement sent to the customer', 'json'),
 ('email.template.endorsement_insurer', $j${"subject":"{{companyName}}: {{action}} request {{endorsementNumber}} on policy {{policyNumber}}","html":"<p>Dear {{insurerName}},</p><p>Please issue the {{action}} of policy <b>{{policyNumber}}</b> ({{insuredName}}) effective {{effectiveDate}}, our reference {{endorsementNumber}}. Premium adjustment: {{currency}} {{premiumDelta}}. The request is attached.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: endorsement or cancellation request sent to the insurer', 'json')
ON CONFLICT (key) DO NOTHING;

