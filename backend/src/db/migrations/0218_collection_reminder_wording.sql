-- The collection reminder said "is due on" also when the bill was already overdue. Installations still on the
-- original wording get the neutral text; an edited template is left as it is.
UPDATE app_settings
   SET value = to_jsonb('<p>Dear {{clientName}},</p><p>This is a reminder that the premium of <b>{{amount}}</b> for policy <b>{{policyNumber}}</b> (bill {{billNumber}}), due on {{dueDate}}, has not yet been received.</p><p>Please disregard this notice if payment has been made.</p><p>{{companyName}}</p>'::text)
 WHERE key = 'collections.email_template'
   AND value = to_jsonb('<p>Dear {{clientName}},</p><p>This is a friendly reminder that the premium of <b>{{amount}}</b> for policy <b>{{policyNumber}}</b> (bill {{billNumber}}) is due on {{dueDate}}.</p><p>Please disregard this notice if payment has been made.</p><p>{{companyName}}</p>'::text);
