-- Plain labels for settings shown on Master > Configuration (the earlier labels quoted other setting keys).
UPDATE app_settings SET label = v.label
FROM (VALUES
 ('accounting.broker_billed_commission_ewt', 'Broker-billed policies: book the withholding tax the insurer deducts from the commission as creditable withholding tax'),
 ('accounting.broker_billed_commission_vat', 'Broker-billed policies: book output VAT on the brokerage commission'),
 ('accounting.configuration_maker_checker', 'Changes to posting rules and account determination wait for approval by a second person (Accounting Manager or System Administrator)'),
 ('bir.registered_name', 'Registered name printed on BIR forms (blank: the company name)'),
 ('commission.wht_rate_by_type', 'Withholding tax on sub-agent commission, per referrer type'),
 ('credit.instalment_frequencies', 'Instalment frequencies offered, with the months between instalments'),
 ('documents.receipt_footer', 'Footer printed on official receipts, for example the BIR permit or ATP details (blank: none)'),
 ('general.frontend_url', 'Web address of the platform, used in links sent by e-mail (for example quotation approval)'),
 ('limits.password_min_length', 'Minimum password length (older setting; the one under Security applies)'),
 ('placement.journey', 'Placement steps per product type or line of business, overriding the steps by business type'),
 ('placement.journey_by_business_type', 'Placement steps for package and non-package products (request for quotation, quotation slip, placement slip, direct policy)'),
 ('quotations.customer_response_status', 'Quotation status set when a customer''s response is recorded (accepted, declined, revise)')
) AS v(key, label)
WHERE app_settings.key = v.key;
