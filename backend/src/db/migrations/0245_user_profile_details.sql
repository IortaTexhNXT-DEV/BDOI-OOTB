-- My Profile (avatar menu > Profile): the personal details a staff user keeps up to date themselves. Date of birth,
-- gender and the Philippine address (house no / unit no / street, barangay / subdivision, city / municipality, province,
-- ZIP code, country). User ID, roles, branch, designation and reporting line stay with User Management.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS barangay text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;

-- The e-mail address receives the password reset codes, so by default only User Management changes it.
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('security.profile_email_editable', 'false', 'security', 'Users may change their own e-mail address on My Profile (the address receives password reset codes)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
