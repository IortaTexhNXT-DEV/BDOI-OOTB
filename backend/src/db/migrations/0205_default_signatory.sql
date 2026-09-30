-- Authorised signatory printed on quotations (order summary) and acknowledgement receipts.
--  * A fresh installation without sample data had no signatory at all, so the order summary dropdown was empty. The
--    OOTB head-office signatory (reference data, created_by 'system' so the sample-data purge keeps it) is added when
--    the Signatories master has no active record; the customer renames it or adds the real officers in
--    Master > Insurance Management > Signatories.
--  * documents.default_signatory names the signatory proposed on a new quotation and printed when none is chosen.

INSERT INTO signatories(name, designation, status, attrs, created_by)
SELECT 'Head Office Authorized Signatory', 'Authorized Representative', 'active',
       jsonb_build_object('signatoryCode', 'SIG-HO', 'signatoryDescription', 'Signs quotations and acknowledgement receipts for the head office'), 'system'
WHERE NOT EXISTS (SELECT 1 FROM signatories WHERE status = 'active');

INSERT INTO app_settings(key, value, "group", label, type)
VALUES ('documents.default_signatory', '""', 'documents',
        'Authorized signatory proposed on new quotations and printed when none is chosen (a name from Master > Signatories; blank: the first active signatory)', 'string')
ON CONFLICT (key) DO NOTHING;
