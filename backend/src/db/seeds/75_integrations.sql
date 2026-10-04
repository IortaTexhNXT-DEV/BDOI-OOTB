-- Integration framework reference data (migrations 0310 to 0314): connectors in test mode, message templates and the
-- starter bank file layouts. Idempotent: a row is added only when its code is missing; administrator changes are kept.
--
-- Connectors start in test mode (the fake provider answers; nothing leaves the system). Going live is done on
-- Master > System Configuration > Integrations once the provider's endpoint is entered and its credentials are set as
-- environment variables (secret store) under the names shown; the values are never stored in the database.
--
-- The starter bank file layouts (BDO, BPI, Metrobank, Landbank, UnionBank) are EXAMPLES modelled on common bulk credit
-- uploads. Each must be validated against the bank's current file specification (and a test file accepted by the
-- bank) during onboarding before it is used for a real payment.

-- ---------- connectors ----------
INSERT INTO integration_connectors(code, name, kind, adapter, enabled, mode, endpoint, credential_env, options, max_attempts, retry_base_seconds, retry_max_seconds, description, sort_order, created_by)
VALUES
 ('SMS_SEMAPHORE', 'SMS gateway (Semaphore-style)', 'sms', 'http_sms', true, 'test', 'https://api.semaphore.co/api/v4/messages',
  $j${"apiKey":"SEMAPHORE_API_KEY"}$j$, $j${"preset":"semaphore","senderName":"","numberFormat":"local"}$j$, 5, 60, 3600,
  'Default SMS connector: form POST with the API key, number in local format (09...). Sender name as registered with the provider.', 10, 'seed'),
 ('SMS_GLOBE_LABS', 'SMS gateway (Globe Labs-style)', 'sms', 'http_sms', false, 'test', 'https://devapi.globelabs.com.ph',
  $j${"accessToken":"GLOBE_LABS_ACCESS_TOKEN"}$j$, $j${"preset":"globe_labs","shortCode":""}$j$, 5, 60, 3600,
  'Outbound SMS request with an access token and the short code of the application (options.shortCode).', 20, 'seed'),
 ('SMS_GENERIC', 'SMS gateway (generic HTTP API)', 'sms', 'http_sms', false, 'test', NULL,
  $j${"apiKey":"SMS_API_KEY"}$j$, $j${"preset":"generic","path":"/messages","numberFormat":"e164","idPath":"id"}$j$, 5, 60, 3600,
  'Any HTTP SMS provider: set the endpoint, path, body template, headers and the path of the message id in the answer.', 30, 'seed'),
 ('VIBER_BUSINESS', 'Viber business messages (optional)', 'messaging', 'viber_business', false, 'test', NULL,
  $j${"apiKey":"VIBER_API_KEY"}$j$, $j${"preset":"generic","path":"/viber/messages","numberFormat":"e164","idPath":"id"}$j$, 5, 60, 3600,
  'Viber business messages through an aggregator; same interface as SMS. Used by templates of channel viber.', 40, 'seed'),
 ('CTPL_AUTH', 'CTPL authentication provider (IC-accredited)', 'ctpl_auth', 'ctpl_http', true, 'test', NULL,
  $j${"apiKey":"CTPL_AUTH_API_KEY","webhookSecret":"CTPL_AUTH_WEBHOOK_SECRET"}$j$, $j${"path":"/authenticate","authCodePath":"authenticationCode","referencePath":"transactionId"}$j$, 6, 120, 7200,
  'Authentication of CTPL certificates of cover with the provider accredited by the Insurance Commission. Endpoint and field names from the provider during onboarding.', 50, 'seed'),
 ('LTO_FEED', 'LTO feed of authenticated COCs', 'lto_feed', 'lto_http', false, 'test', NULL,
  $j${"apiKey":"LTO_FEED_API_KEY"}$j$, $j${"path":"/coc","referencePath":"reference"}$j$, 6, 300, 21600,
  'Only when the authentication provider does not transmit to the LTO itself (setting ctpl.lto_feed).', 60, 'seed'),
 ('INSURER_API', 'Insurer API (mapping per insurer)', 'insurer_api', 'insurer_rest', true, 'test', NULL,
  $j${"apiKey":"INSURER_API_KEY","webhookSecret":"INSURER_API_WEBHOOK_SECRET"}$j$,
  $j${"paths":{"policyIssue":{"method":"POST","path":"/policies"},"policyData":{"method":"GET","path":"/policies/{{insurerPolicyNumber}}"},"claimStatus":{"method":"GET","path":"/claims/{{insurerClaimNumber}}"}}}$j$, 5, 120, 7200,
  'Policy issuance request, policy and premium data and claim status. Copy this connector per insurer (or aggregator) when their endpoints or keys differ.', 70, 'seed'),
 ('BANK_FILES', 'Bank payment files', 'bank_file', 'file_drop', true, 'live', NULL, '{}', '{}', 1, 60, 60,
  'Payment files written from the bank file layouts, downloaded and uploaded on the bank portal; status files imported back.', 80, 'seed')
ON CONFLICT (code) DO NOTHING;

-- ---------- message templates ----------
INSERT INTO message_templates(code, name, channel, event, body, consent_purpose, active, description, created_by) VALUES
 ('RENEWAL_NOTICE', 'Renewal notice', 'sms', 'renewal_notice',
  'Hi {{clientName}}, your policy {{policyNumber}} with {{insurer}} expires on {{expiryDate}}. Reply to this message or call us to renew. {{companyName}}', 'processing', true,
  'Sent by the job sms-renewal-notices on the days of messaging.renewal_notice_days before expiry', 'seed'),
 ('PAYMENT_REMINDER', 'Payment reminder', 'sms', 'payment_reminder',
  'Hi {{clientName}}, a premium of PHP {{amountDue}} for policy {{policyNumber}} (bill {{billNumber}}) is due on {{dueDate}}. Please disregard if paid. {{companyName}}', 'processing', true,
  'Sent by the job sms-payment-reminders on the days of messaging.payment_reminder_days before the due date', 'seed'),
 ('CLAIM_UPDATE', 'Claim update', 'sms', 'claim_update',
  'Hi {{clientName}}, your claim {{claimNumber}} under policy {{policyNumber}} is now {{claimStatus}}. We will keep you informed. {{companyName}}', 'processing', true,
  'Sent when a claim moves to one of the statuses of messaging.claim_update_statuses', 'seed'),
 ('CTPL_AUTHENTICATED', 'CTPL authenticated', 'sms', 'ctpl_authenticated',
  'Hi {{clientName}}, the CTPL of policy {{policyNumber}} is authenticated: COC {{cocNumber}}, authentication code {{authCode}}. {{companyName}}', 'processing', false,
  'Optional: sent when the authentication code of a COC is received', 'seed'),
 ('RENEWAL_NOTICE_VIBER', 'Renewal notice (Viber)', 'viber', 'renewal_notice',
  'Hi {{clientName}}, your policy {{policyNumber}} with {{insurer}} expires on {{expiryDate}}. Message us here to renew. {{companyName}}', 'processing', false,
  'Viber version of the renewal notice; activate it (and deactivate the SMS one) to send renewal notices by Viber', 'seed')
ON CONFLICT (code) DO NOTHING;

-- ---------- starter bank file layouts (examples: validate with each bank during onboarding) ----------
INSERT INTO bank_file_layouts(code, name, bank_code, channels, format, delimiter, quote_values, line_ending, file_name_pattern, header_fields, detail_fields, trailer_fields, status_file,
  max_amount_per_line, is_example, active, description, created_by)
VALUES
 ('BDO-BULK', 'BDO - bulk credit / InstaPay / PESONet (example)', 'BDO', ARRAY['bulk_credit','instapay','pesonet'], 'delimited', ',', false, 'CRLF', 'BDO_{batchNumber}_{valueDate:YYYYMMDD}.csv',
  $j$[{"name":"Record type","source":"const","value":"H"},{"name":"Company","source":"batch.companyName","format":"upper","width":40},{"name":"Debit account","source":"batch.bankAccountNumber","format":"digits"},{"name":"Value date","source":"batch.valueDate","format":"date:MM/DD/YYYY"},{"name":"Channel","source":"batch.channel","map":{"bulk_credit":"BC","instapay":"IP","pesonet":"PN"}},{"name":"Count","source":"batch.count"},{"name":"Total","source":"batch.totalAmount","format":"amount"}]$j$,
  $j$[{"name":"Record type","source":"const","value":"D"},{"name":"Sequence","source":"line.seq"},{"name":"Beneficiary bank","source":"line.bankCode","format":"upper"},{"name":"Account number","source":"line.accountNumber","format":"digits"},{"name":"Account name","source":"line.accountName","format":"upper","width":50},{"name":"Amount","source":"line.amount","format":"amount"},{"name":"Reference","source":"line.reference","width":20},{"name":"E-mail","source":"line.email","width":60}]$j$,
  $j$[{"name":"Record type","source":"const","value":"T"},{"name":"Count","source":"batch.count"},{"name":"Total","source":"batch.totalAmount","format":"amount"}]$j$,
  $j${"format":"delimited","delimiter":",","hasHeader":true,"columns":{"reference":"Reference|Ref No","status":"Status","bankReference":"Bank Reference|Transaction Reference","reason":"Remarks|Reason","amount":"Amount"},"paidValues":["SUCCESS","SUCCESSFUL","PAID","POSTED","CREDITED"],"rejectedValues":["FAILED","REJECTED","RETURNED","UNSUCCESSFUL"]}$j$,
  NULL, true, true, 'Example modelled on a bulk credit upload with header, detail and trailer records. Validate against BDO''s current file specification during onboarding.', 'seed'),
 ('BPI-BULK', 'BPI - bulk credit (fixed width, example)', 'BPI', ARRAY['bulk_credit','pesonet'], 'fixed', ',', false, 'CRLF', 'BPI{valueDate:MMDDYY}_{batchNumber}.txt',
  $j$[{"name":"Record type","source":"const","value":"1","width":1},{"name":"Debit account","source":"batch.bankAccountNumber","format":"digits","width":10,"align":"right","pad":"0"},{"name":"Value date","source":"batch.valueDate","format":"date:MMDDYYYY","width":8},{"name":"Count","source":"batch.count","width":6,"align":"right","pad":"0"},{"name":"Total (centavos)","source":"batch.totalAmount","format":"amount_cents","width":15,"align":"right","pad":"0"},{"name":"Company","source":"batch.companyName","format":"upper","width":40}]$j$,
  $j$[{"name":"Record type","source":"const","value":"2","width":1},{"name":"Account number","source":"line.accountNumber","format":"digits","width":16,"align":"right","pad":"0"},{"name":"Amount (centavos)","source":"line.amount","format":"amount_cents","width":15,"align":"right","pad":"0"},{"name":"Account name","source":"line.accountName","format":"upper","width":40},{"name":"Beneficiary bank","source":"line.bankCode","format":"upper","width":10},{"name":"Reference","source":"line.reference","width":20}]$j$,
  $j$[{"name":"Record type","source":"const","value":"3","width":1},{"name":"Count","source":"batch.count","width":6,"align":"right","pad":"0"},{"name":"Total (centavos)","source":"batch.totalAmount","format":"amount_cents","width":15,"align":"right","pad":"0"}]$j$,
  $j${"format":"fixed","columns":{"reference":{"start":1,"width":20},"status":{"start":21,"width":10},"bankReference":{"start":31,"width":20},"reason":{"start":51,"width":40}},"paidValues":["OK","PAID","SUCCESS"],"rejectedValues":["NG","REJ","REJECTED","FAILED"]}$j$,
  NULL, true, true, 'Example of a fixed-width upload (amounts in centavos, zero-padded). Validate against BPI''s current file specification during onboarding.', 'seed'),
 ('MBT-BULK', 'Metrobank - bulk credit (pipe delimited, example)', 'MBT', ARRAY['bulk_credit','instapay','pesonet'], 'delimited', '|', false, 'CRLF', 'MBT_{batchNumber}.txt',
  '[]',
  $j$[{"name":"Value date","source":"batch.valueDate","format":"date:YYYYMMDD"},{"name":"Debit account","source":"batch.bankAccountNumber","format":"digits"},{"name":"Beneficiary account","source":"line.accountNumber","format":"digits"},{"name":"Beneficiary name","source":"line.accountName","format":"upper","width":60},{"name":"Beneficiary bank","source":"line.bankCode","format":"upper"},{"name":"Amount","source":"line.amount","format":"amount"},{"name":"Channel","source":"batch.channel","map":{"bulk_credit":"CA","instapay":"IPAY","pesonet":"PNET"}},{"name":"Reference","source":"line.reference","width":25}]$j$,
  '[]',
  $j${"format":"delimited","delimiter":"|","hasHeader":false,"columns":{"reference":1,"status":2,"bankReference":3,"reason":4},"paidValues":["S","SUCCESS","00"],"rejectedValues":["F","FAILED","R","REJECTED"]}$j$,
  NULL, true, true, 'Example of a detail-only, pipe-delimited upload; status file without a header row. Validate against Metrobank''s current file specification during onboarding.', 'seed'),
 ('LBP-BULK', 'Landbank - payroll / bulk credit (example)', 'LBP', ARRAY['bulk_credit','pesonet'], 'delimited', ',', true, 'CRLF', 'LBP_{batchNumber}_{valueDate:YYYYMMDD}.csv',
  $j$[{"name":"Company","source":"batch.companyName","format":"upper"},{"name":"Funding account","source":"batch.bankAccountNumber","format":"digits"},{"name":"Credit date","source":"batch.valueDate","format":"date:MM/DD/YYYY"},{"name":"Total","source":"batch.totalAmount","format":"amount"},{"name":"Count","source":"batch.count"}]$j$,
  $j$[{"name":"Account number","source":"line.accountNumber","format":"digits"},{"name":"Account name","source":"line.accountName","format":"upper"},{"name":"Amount","source":"line.amount","format":"amount"},{"name":"Beneficiary bank","source":"line.bankCode","format":"upper"},{"name":"Remarks","source":"line.reference"}]$j$,
  '[]',
  $j${"format":"delimited","delimiter":",","hasHeader":true,"columns":{"reference":"Remarks|Reference","status":"Status","bankReference":"Confirmation No|Reference No","reason":"Reason"},"paidValues":["CREDITED","SUCCESS"],"rejectedValues":["NOT CREDITED","FAILED","REJECTED"]}$j$,
  NULL, true, true, 'Example of a quoted CSV with a control header row. Validate against Landbank''s current file specification during onboarding.', 'seed'),
 ('UBP-BULK', 'UnionBank - bulk transfers (example)', 'UBP', ARRAY['bulk_credit','instapay','pesonet'], 'delimited', ',', false, 'LF', 'UBP-{channel}-{batchNumber}.csv',
  $j$[{"name":"Batch","source":"batch.batchNumber"},{"name":"Source account","source":"batch.bankAccountNumber","format":"digits"},{"name":"Value date","source":"batch.valueDate","format":"date:YYYY-MM-DD"},{"name":"Count","source":"batch.count"},{"name":"Total","source":"batch.totalAmount","format":"amount"}]$j$,
  $j$[{"name":"Transfer type","source":"batch.channel","map":{"bulk_credit":"UB","instapay":"INSTAPAY","pesonet":"PESONET"}},{"name":"Beneficiary bank","source":"line.bankCode","format":"upper"},{"name":"Beneficiary account","source":"line.accountNumber","format":"digits"},{"name":"Beneficiary name","source":"line.accountName","width":50},{"name":"Amount","source":"line.amount","format":"amount"},{"name":"Reference","source":"line.reference"},{"name":"Notify e-mail","source":"line.email"}]$j$,
  '[]',
  $j${"format":"delimited","delimiter":",","hasHeader":true,"columns":{"reference":"Reference","status":"Status","bankReference":"Transaction ID","reason":"Message","amount":"Amount"},"paidValues":["COMPLETED","SUCCESS"],"rejectedValues":["FAILED","REJECTED","CANCELLED"]}$j$,
  NULL, true, true, 'Example of a CSV upload with the transfer type per line. Validate against UnionBank''s current file specification during onboarding.', 'seed'),
 ('GENERIC-CSV', 'Generic CSV (any bank)', NULL, ARRAY['bulk_credit','instapay','pesonet'], 'delimited', ',', false, 'CRLF', '{batchNumber}.csv',
  $j$[{"name":"Header","source":"const","value":"Reference"},{"name":"Bank","source":"const","value":"Bank"},{"name":"Account","source":"const","value":"Account Number"},{"name":"Name","source":"const","value":"Account Name"},{"name":"Amount","source":"const","value":"Amount"}]$j$,
  $j$[{"name":"Reference","source":"line.reference"},{"name":"Bank","source":"line.bankCode"},{"name":"Account","source":"line.accountNumber"},{"name":"Name","source":"line.accountName"},{"name":"Amount","source":"line.amount","format":"amount"}]$j$,
  '[]',
  $j${"format":"delimited","delimiter":",","hasHeader":true,"columns":{"reference":"Reference","status":"Status","bankReference":"Bank Reference","reason":"Reason","amount":"Amount"},"paidValues":["PAID","SUCCESS"],"rejectedValues":["REJECTED","FAILED"]}$j$,
  NULL, false, true, 'A plain CSV with a column header row, for a bank without a layout of its own or for the manual upload.', 'seed')
ON CONFLICT (code) DO NOTHING;
