-- BrokerVerse OOTB branding: product name BrokerVerse and the iorta TechNXT logo by default (the BDOI name and logo were
-- the client theme). Changes only values still at the old defaults; a client's own choice in System Settings is kept.
UPDATE app_settings SET value = '"BrokerVerse"', updated_at = now() WHERE key = 'general.system_name' AND value = '"BIBS - BDOI Broker System"';
UPDATE app_settings SET value = '"BrokerVerse"', updated_at = now() WHERE key = 'general.app_title' AND value = '"Brokerverse"';
UPDATE app_settings SET value = '"/bdoi/iorta-technxt.png"', updated_at = now() WHERE key = 'branding.default_logo_url' AND value = '"/BDO_insure_logo.png.png"';
UPDATE app_settings
SET value = value || '[{"id":"iorta-technxt","label":"iorta TechNXT (BrokerVerse)","url":"/bdoi/iorta-technxt.png","builtIn":true}]'::jsonb, updated_at = now()
WHERE key = 'branding.logo_presets' AND jsonb_typeof(value) = 'array' AND NOT value @> '[{"id":"iorta-technxt"}]'::jsonb;
