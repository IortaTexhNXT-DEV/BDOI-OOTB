-- Office 365 only relays mail whose sender is the signed-in mailbox, so the default sender is the iorta TechNXT
-- mailbox the SMTP account uses. An address already changed by an administrator is kept.
UPDATE app_settings
   SET value = to_jsonb('BrokerVerse <connect@iortatechnxt.com>'::text), updated_at = now()
 WHERE key = 'notification.from_address' AND value = to_jsonb('no-reply@brokerverse.local'::text);
