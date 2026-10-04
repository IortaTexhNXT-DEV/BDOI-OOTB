-- Placement only with insurers authorised by the Insurance Commission (Insurance Code: an insurer transacts business only
-- with a certificate of authority in force).
--
-- The certificate of authority number and validity are fields of the insurer master (Master > Insurance > Insurance
-- Company: icCertificateNumber, icCertificateValidUntil, seeded by 69_ph_practice_masters.sql). They are checked when a
-- request for quotation is sent to an insurer (broker slip submitted, insurer added to a submitted slip), when the firm
-- order of a placement slip is sent and when a policy is issued (from a quotation, a placement slip, or recorded as
-- issued). compliance.insurer_authority_check: block (refused with the reason), warn (allowed; the warning is returned
-- with the answer and recorded in the audit trail) or off. Delivered as warn: the broker fills in the certificate
-- numbers of the insurers it works with, then switches to block.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('compliance.insurer_authority_check', '"warn"', 'compliance', 'Insurer without an IC certificate of authority in force (number and validity on the insurer master) at request for quotation, firm order and policy issue: block, warn or off', 'string'),
 ('compliance.insurer_authority_expiring_days', '60', 'compliance', 'Certificates of authority expiring within this many days are reported as expiring and reminded to the compliance team', 'number')
ON CONFLICT (key) DO NOTHING;
