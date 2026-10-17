-- The remittance e-mail to the insurer with its schedule (FRS COMM-06 FR-RMT-015: "attached to the e-mail of the
-- remittance to the insurer"). POST /remittance/remittances/:id/send e-mails an approved or settled remittance to the
-- insurer's contact e-mail (or the address given) with the insurer's copy of the per-peril schedule as XLSX
-- (documents/emailDocuments.js remittance-schedule).
--
-- Settings:
--   remittance.email_schedule_attachment   the schedule (XLSX) is attached to the remittance e-mail (on)
--   remittance.schedule_email_subject / remittance.schedule_email_body   text of the e-mail ({{remittanceNo}},
--       {{insurerName}}, {{currency}}, {{amount}}, {{remittanceDate}}, {{companyName}})
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('remittance.email_schedule_attachment', 'true', 'remittance', 'Attach the remittance schedule (XLSX, insurer copy) to the remittance e-mail to the insurer', 'boolean', true),
 ('remittance.schedule_email_subject', '"{{companyName}}: premium remittance {{remittanceNo}}"', 'remittance', 'Subject of the remittance e-mail to the insurer', 'string', true),
 ('remittance.schedule_email_body', '"<p>Dear {{insurerName}},</p><p>Please find attached the schedule of our premium remittance <b>{{remittanceNo}}</b> of {{currency}} {{amount}}.</p><p>Thank you,<br/>{{companyName}}</p>"', 'remittance', 'Body of the remittance e-mail to the insurer', 'string', true)
ON CONFLICT (key) DO NOTHING;
