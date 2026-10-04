-- Help panel (avatar menu > Help, or F1): how users reach the broker's support desk. Each value is shown only when it
-- is set; "Raise a support ticket" opens support.portal_url, or else an e-mail to support.email with the screen, the
-- user, the version and the time filled in. Edited on Master > Configuration (Company & Branding > Support).
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('support.email', '""', 'support', 'Support e-mail address shown in Help (also receives the support tickets raised by e-mail)', 'string', true),
 ('support.phone', '""', 'support', 'Support telephone number shown in Help', 'string', true),
 ('support.hours', '"Monday to Friday, 8:00 AM to 6:00 PM (Philippine time)"', 'support', 'Support hours shown in Help', 'string', true),
 ('support.portal_url', '""', 'support', 'Support portal address (https://...) where users raise a ticket; when empty, tickets are raised by e-mail', 'string', true)
ON CONFLICT (key) DO NOTHING;
