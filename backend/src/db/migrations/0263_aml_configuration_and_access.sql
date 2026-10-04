-- AML/CFT configuration and access: the Compliance Officer role and its permissions, the AML settings, the number
-- series, the scheduled jobs, the default risk factors, monitoring rules and screening lists.
--
-- Permissions: read:aml (Compliance menu, registers and reports), write:aml (screening lists, monitoring runs, alerts,
-- cases, report files, AML settings, EDD preparation), approve:aml (decisions reserved to the compliance officer: clear,
-- escalate or confirm a screening hit, approve or reject an EDD review, override a risk rating, approve a case for
-- filing). The Compliance Officer role holds all three plus read access to the client, policy, claim and payment records
-- it reviews. Onboarding (clients, signatories, beneficial owners, KYC documents) needs write:clients as before.
--
-- Values the broker must confirm with its compliance officer against the AMLC's current issuances (Compliance > AML
-- Settings, or Master > Configuration group aml):
--   aml.covered_threshold          PHP 500,000: a covered transaction is a cash transaction in excess of this amount
--                                  within one banking day (AMLA section 3(b) as amended by RA 10365; no other amount is
--                                  set for insurance intermediaries at the time of writing)
--   aml.ctr_due_working_days       5 working days to file a CTR (2018 IRR)
--   aml.str_due_working_days       1 working day from the establishment of suspicion to file an STR (2018 IRR as amended)
--   aml.record_retention_years     5 years from the end of the relationship or the transaction (AMLA section 9(b))
--   aml.amlc_institution_code      the covered person code given by the AMLC on registration (portal)
--   aml.amlc_transaction_codes     codes of the AMLC transaction code list for each kind of transaction reported

INSERT INTO permissions(code, module, description) VALUES
 ('read:aml', 'aml', 'View the Compliance menu: AML dashboard, client due diligence, screening hits, transaction alerts, cases and AMLC reports'),
 ('write:aml', 'aml', 'Maintain screening lists, run screening and transaction monitoring, prepare EDD reviews, cases and AMLC report files, change AML settings'),
 ('approve:aml', 'aml', 'Compliance officer decisions: clear, escalate or confirm a screening hit, approve or reject an EDD review, override a risk rating, approve a case for filing')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles(code, name, description, is_system) VALUES
 ('compliance-officer', 'Compliance Officer (AML/CFT)', 'Customer risk rating and EDD approval, sanctions and PEP screening decisions, transaction monitoring, AML cases and AMLC covered and suspicious transaction reports', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code = 'compliance-officer' AND p.code IN ('read:aml', 'write:aml', 'approve:aml', 'read:clients', 'write:clients', 'read:policies', 'read:claims',
   'read:receipts', 'read:disbursements', 'read:reports', 'read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:leads')
ON CONFLICT DO NOTHING;
-- the System Administrator holds every permission
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'system-admin' AND p.module = 'aml' ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('aml.covered_threshold', '500000', 'aml', 'Covered transaction: cash amount (PHP) above which a transaction within one banking day is covered (AMLA as amended; confirm with the AMLC''s current rules)', 'number'),
 ('aml.covered_aggregation', '"banking-day"', 'aml', 'Covered transaction test: banking-day (cash of the client on one banking day added up) or single (each transaction alone)', 'string'),
 ('aml.covered_payment_modes', '["cash"]', 'aml', 'Payment modes treated as cash or an equivalent monetary instrument for covered transactions', 'json'),
 ('aml.ctr_due_working_days', '5', 'aml', 'Working days after the transaction to file a covered transaction report (CTR)', 'number'),
 ('aml.str_due_working_days', '1', 'aml', 'Working days after the establishment of suspicion to file a suspicious transaction report (STR)', 'number'),
 ('aml.match_threshold', '0.85', 'aml', 'Name screening: lowest similarity score (0 to 1) reported as a potential match', 'number'),
 ('aml.risk_low_max_score', '2', 'aml', 'Customer risk rating: highest total score rated Low', 'number'),
 ('aml.risk_high_min_score', '8', 'aml', 'Customer risk rating: lowest total score rated High', 'number'),
 ('aml.pep_always_high', 'true', 'aml', 'A politically exposed person (client or beneficial owner) is always rated High', 'boolean'),
 ('aml.kyc_refresh_months', '{"low": 36, "normal": 24, "high": 12}', 'aml', 'Months between KYC refreshes per risk rating (low, normal, high)', 'json'),
 ('aml.kyc_refresh_notice_days', '30', 'aml', 'Days before the KYC refresh date from which a client is listed as due', 'number'),
 ('aml.beneficial_owner_threshold', '25', 'aml', 'Ownership percentage from which a natural person is a beneficial owner of a juridical client', 'number'),
 ('aml.record_retention_years', '5', 'aml', 'Years customer identification, transaction and AML case records are kept after the relationship ends or the case is closed', 'number'),
 ('aml.screening_block_events', '["policy-issue", "payout"]', 'aml', 'Events stopped while a screening hit of the party is open or confirmed: policy-issue, payout', 'json'),
 ('aml.block_issue_pending_edd', 'true', 'aml', 'Refuse to issue a policy to a High-risk client without an approved EDD review', 'boolean'),
 ('aml.screening_provider', '{"provider": "lists", "endpoint": "", "apiKeyEnv": "AML_SCREENING_API_KEY", "mode": "sandbox", "timeoutMs": 10000, "maxAttempts": 5}', 'aml',
  'Commercial screening provider: provider (lists = uploaded lists only, fake = test provider, http = provider API), endpoint, name of the environment variable holding the API key, mode sandbox or live, timeout, attempts', 'json'),
 ('aml.amlc_institution_code', '""', 'aml', 'Covered person (institution) code given by the AMLC on registration, printed on the report files', 'string'),
 ('aml.amlc_transaction_codes', '{"cash-premium-payment": "PPC", "premium-payment": "PPN", "premium-refund": "PRF", "claim-payment": "CLP", "other": "OTH"}', 'aml',
  'AMLC transaction code per kind of transaction in the report files (confirm against the AMLC transaction code list)', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('aml_edd', 'EDD Review', 'aml', 'EDD', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Enhanced due diligence review of a High-risk client (Compliance > EDD Reviews)', 'migration'),
 ('aml_alert', 'AML Transaction Alert', 'aml', 'AMA', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Covered or suspicious transaction alert (Compliance > Transaction Alerts)', 'migration'),
 ('aml_case', 'AML Case', 'aml', 'AMC', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'AML case: CTR, STR investigation or review (Compliance > AML Cases)', 'migration'),
 ('aml_report', 'AMLC Report File', 'aml', 'AMR', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Covered or suspicious transaction report file for the AMLC (Compliance > AMLC Reports)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('aml-transaction-monitoring', 'AML transaction monitoring', 'Run the covered and suspicious transaction rules over the last days (params.days, default 3) and notify the compliance officer (read:aml) of new alerts', '30 6 * * *', 'amlTransactionMonitoring', '{"days": 3}', true),
 ('aml-kyc-refresh-due', 'KYC refresh due', 'Mark clients whose KYC refresh date has come as refresh due and notify the compliance officer (read:aml) of the KYC refreshes and EDD reviews due', '0 7 * * 1', 'amlKycRefreshDue', '{}', true),
 ('aml-provider-retry', 'Screening provider retry', 'Send again the requests to the commercial screening provider that failed (aml.screening_provider), until maxAttempts', '*/15 * * * *', 'amlProviderRetry', '{}', false)
ON CONFLICT (code) DO NOTHING;

-- Monitoring rules (parameters editable on Compliance > AML Settings)
INSERT INTO aml_rules(code, name, kind, description, params, severity) VALUES
 ('CT_CASH', 'Covered transaction: cash above the threshold', 'covered',
  'Cash received from a client above aml.covered_threshold in one banking day (or in one transaction, aml.covered_aggregation)', '{}', 'high'),
 ('STR_STRUCTURING', 'Several cash payments below the threshold', 'suspicious',
  'At least minCount cash payments of a client within days days, each below the covered threshold, adding up to minTotal or more', '{"days": 7, "minCount": 3, "minTotal": 400000}', 'high'),
 ('STR_EARLY_CANCEL', 'Early cancellation with return premium', 'suspicious',
  'A policy cancelled within days days of inception with a return premium; flagged high when the refund is paid to someone else than the client', '{"days": 90}', 'medium'),
 ('STR_THIRD_PARTY_PAYOUT', 'Refund or claim paid to a third party', 'suspicious',
  'A premium refund or a claim payment to a payee whose name does not match the client (similarity below minScore)', '{"minScore": 0.85}', 'medium'),
 ('STR_OVERPAYMENT_REFUND', 'Overpayment refunded', 'suspicious',
  'Premium received above the premium billed by at least minExcess, with a refund to the client within days days', '{"days": 60, "minExcess": 5000}', 'medium'),
 ('STR_PAYER_DIFFERS', 'Payer differs from the client', 'suspicious',
  'A premium payment whose payer name (receipt or payment link) does not match the client (similarity below minScore)', '{"minScore": 0.85}', 'low')
ON CONFLICT (code) DO NOTHING;

-- Risk factors (Compliance > AML Settings > Risk factors): scores the broker's AML programme confirms
INSERT INTO aml_risk_factors(factor, match_value, min_amount, max_amount, score, description, created_by) VALUES
 ('client-type', 'INDIVIDUAL', NULL, NULL, 0, 'Individual', 'migration'),
 ('client-type', 'individual', NULL, NULL, 0, 'Individual (client type)', 'migration'),
 ('client-type', 'GOVERNMENT', NULL, NULL, 0, 'Government agency or GOCC', 'migration'),
 ('client-type', 'SOLE_PROP', NULL, NULL, 1, 'Sole proprietorship', 'migration'),
 ('client-type', 'COOPERATIVE', NULL, NULL, 1, 'Cooperative', 'migration'),
 ('client-type', 'HOA', NULL, NULL, 1, 'Homeowners'' association', 'migration'),
 ('client-type', 'CORPORATION', NULL, NULL, 2, 'Stock corporation', 'migration'),
 ('client-type', 'OPC', NULL, NULL, 2, 'One person corporation', 'migration'),
 ('client-type', 'PARTNERSHIP', NULL, NULL, 2, 'Partnership', 'migration'),
 ('client-type', 'corporate', NULL, NULL, 2, 'Juridical client (client type)', 'migration'),
 ('client-type', 'NONSTOCK', NULL, NULL, 3, 'Non-stock corporation or foundation', 'migration'),
 ('client-type', 'FOREIGN', NULL, NULL, 3, 'Branch of a foreign corporation', 'migration'),
 ('client-type', '*', NULL, NULL, 1, 'Any other client type', 'migration'),
 ('nationality', 'Filipino', NULL, NULL, 0, 'Filipino', 'migration'),
 ('nationality', 'Philippines', NULL, NULL, 0, 'Incorporated in the Philippines', 'migration'),
 ('nationality', 'North Korean', NULL, NULL, 6, 'FATF high-risk jurisdiction subject to a call for action (keep current)', 'migration'),
 ('nationality', 'Iranian', NULL, NULL, 6, 'FATF high-risk jurisdiction subject to a call for action (keep current)', 'migration'),
 ('nationality', 'Burmese', NULL, NULL, 6, 'FATF high-risk jurisdiction subject to a call for action (keep current)', 'migration'),
 ('nationality', '*', NULL, NULL, 1, 'Any other nationality or country', 'migration'),
 ('pep', 'yes', NULL, NULL, 6, 'Politically exposed person (client or beneficial owner)', 'migration'),
 ('pep', 'no', NULL, NULL, 0, 'Not a politically exposed person', 'migration'),
 ('line', 'BOND', NULL, NULL, 3, 'Surety bonds', 'migration'),
 ('line', 'HULL', NULL, NULL, 2, 'Marine hull', 'migration'),
 ('line', 'MARINE', NULL, NULL, 1, 'Marine cargo', 'migration'),
 ('line', 'MONEY', NULL, NULL, 1, 'Money and securities', 'migration'),
 ('line', '*', NULL, NULL, 0, 'Any other line', 'migration'),
 ('payment-mode', 'cash', NULL, NULL, 3, 'Cash', 'migration'),
 ('payment-mode', 'check', NULL, NULL, 1, 'Cheque', 'migration'),
 ('payment-mode', '*', NULL, NULL, 0, 'Bank transfer, card, e-wallet', 'migration'),
 ('premium-size', '*', 0, 100000, 0, 'Annual premium below PHP 100,000', 'migration'),
 ('premium-size', '*', 100000, 500000, 1, 'Annual premium PHP 100,000 to 499,999', 'migration'),
 ('premium-size', '*', 500000, 2000000, 2, 'Annual premium PHP 500,000 to 1,999,999', 'migration'),
 ('premium-size', '*', 2000000, NULL, 4, 'Annual premium PHP 2,000,000 or more', 'migration'),
 ('geography', '*', NULL, NULL, 0, 'Any address (add provinces, cities or countries the programme rates higher)', 'migration')
ON CONFLICT DO NOTHING;

-- Screening lists: the versions are uploaded on Compliance > Screening Lists (no list content is delivered)
INSERT INTO aml_screening_lists(code, name, list_type, source, description, created_by) VALUES
 ('UNSC', 'UN Security Council Consolidated List', 'sanctions', 'United Nations', 'Consolidated list of the UN Security Council sanctions committees (XML from the UN website, or CSV)', 'migration'),
 ('AMLC', 'AMLC and ATC designations', 'designation', 'Anti-Money Laundering Council / Anti-Terrorism Council', 'Persons designated under the Anti-Terrorism Act and AMLC sanctions freeze orders (CSV)', 'migration'),
 ('PEP', 'Politically exposed persons', 'pep', 'Broker or provider PEP list', 'Domestic and foreign PEPs, their family members and close associates (CSV)', 'migration'),
 ('INTERNAL', 'Internal negative list', 'negative', 'Broker', 'Persons and entities the broker does not deal with (entries added on screen or uploaded)', 'migration')
ON CONFLICT (code) DO NOTHING;
