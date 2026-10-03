-- Authorised signatory printed on quotations (order summary) and acknowledgement receipts.
--  * documents.default_signatory names the signatory proposed on a new quotation and printed when none is chosen.
--  * Signatories are the broker's own officers: none is created here. Until one is added in
--    Master > Insurance Management > Signatories the order summary links to that master.

INSERT INTO app_settings(key, value, "group", label, type)
VALUES ('documents.default_signatory', '""', 'documents',
        'Authorized signatory proposed on new quotations and printed when none is chosen (a name from Master > Signatories; blank: the first active signatory)', 'string')
ON CONFLICT (key) DO NOTHING;
