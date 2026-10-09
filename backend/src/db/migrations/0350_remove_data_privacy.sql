-- Master > Data Privacy (data subject requests, consent register, personal data export and anonymisation, migration
-- 0221) is withdrawn from this build: the register of data subject requests with its DSR number series, the settings
-- privacy.request_due_days and privacy.retention_years, the scheduled job privacy-requests-due, its notifications and
-- the read:privacy / write:privacy permissions.
--
-- Kept: privacy_consents (the opt-out of a campaign e-mail records a refusal there; campaigns and the messaging
-- consent check read it) with privacy.notice_version recorded on those consents, clients / leads anonymised_at (a
-- party anonymised before stays anonymised: campaigns, the report builder and the audit trail leave it out), and the
-- masking and encryption of personal identifiers (view:pii, privacy.masking_*, privacy.pii_reveal_mode). Idempotent.

DROP TABLE IF EXISTS data_subject_requests;

DELETE FROM notifications WHERE entity = 'data_subject_request';

DELETE FROM app_settings WHERE key IN ('privacy.request_due_days', 'privacy.retention_years', 'numbering.data_subject_request.prefix');
UPDATE app_settings SET label = 'Version of the privacy notice in force (recorded with the consents, e.g. the refusal of a campaign opt-out)', updated_at = now()
 WHERE key = 'privacy.notice_version' AND label <> 'Version of the privacy notice in force (recorded with the consents, e.g. the refusal of a campaign opt-out)';
UPDATE app_settings SET value = value - '/api/privacy/parties',
       label = 'API paths answered without masking (sign-in and own profile, files, configuration, go-live workbench)', updated_at = now()
 WHERE key = 'privacy.masking_exempt_paths' AND (value ? '/api/privacy/parties' OR label LIKE '%data subject%');

DELETE FROM sequences WHERE name = 'data_subject_request';
DELETE FROM document_numbering WHERE code = 'data_subject_request';

DELETE FROM scheduled_jobs WHERE code = 'privacy-requests-due';

-- permissions (role grants go with them); view:pii, also of module privacy, stays
DELETE FROM permissions WHERE code IN ('read:privacy', 'write:privacy');
