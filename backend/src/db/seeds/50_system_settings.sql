-- Configuration keys for System Settings, masters, product configurator, remittance, reinsurance and incentive.
-- Every value below is editable from the front end (PUT /api/system-settings or PUT /api/system-settings/configuration).
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 -- deprecated and unused (migration 0231): the application name is general.system_name, edited in System Settings
 ('general.app_title', '"Brokerverse"', 'system', 'Deprecated, not used: the application name is general.system_name (Master > System Settings)', 'string', false),
 ('general.default_language', '"en"', 'general', 'Default language', 'string', true),
 ('general.languages', $j$[{"code":"en","label":"English"},{"code":"th","label":"Thai"},{"code":"fil","label":"Filipino"}]$j$, 'general', 'Available languages', 'json', true),
 ('branding.default_logo_url', '"/bdoi/iorta-technxt.png"', 'branding', 'Default logo (used when no logo is selected)', 'image', true),
 ('branding.favicon_url', '"/favicon.ico"', 'branding', 'Favicon', 'image', true),
 ('branding.logo_presets', $j$[{"id":"eastwest","label":"EastWest Bank","url":"/temp-logo/eastwestbank.png","builtIn":true},{"id":"chinabank","label":"China Bank","url":"/chinabank.png","builtIn":true},{"id":"iorta","label":"iorta","url":"/iorta.png","builtIn":true},{"id":"iorta-technxt","label":"iorta TechNXT (BrokerVerse)","url":"/bdoi/iorta-technxt.png","builtIn":true}]$j$, 'branding', 'Company logo presets', 'json', true),
 ('currency.allowed', $j$[{"code":"PHP","name":"Philippine Peso","locale":"en-PH","region":"Asia"},{"code":"THB","name":"Thai Baht","locale":"th-TH","region":"Asia"},{"code":"JPY","name":"Japanese Yen","locale":"ja-JP","region":"Asia"},{"code":"CNY","name":"Chinese Yuan","locale":"zh-CN","region":"Asia"},{"code":"INR","name":"Indian Rupee","locale":"en-IN","region":"Asia"},{"code":"KRW","name":"South Korean Won","locale":"ko-KR","region":"Asia"},{"code":"SGD","name":"Singapore Dollar","locale":"en-SG","region":"Asia"},{"code":"MYR","name":"Malaysian Ringgit","locale":"ms-MY","region":"Asia"},{"code":"IDR","name":"Indonesian Rupiah","locale":"id-ID","region":"Asia"},{"code":"VND","name":"Vietnamese Dong","locale":"vi-VN","region":"Asia"},{"code":"HKD","name":"Hong Kong Dollar","locale":"zh-HK","region":"Asia"},{"code":"TWD","name":"New Taiwan Dollar","locale":"zh-TW","region":"Asia"},{"code":"PKR","name":"Pakistani Rupee","locale":"en-PK","region":"Asia"},{"code":"BDT","name":"Bangladeshi Taka","locale":"bn-BD","region":"Asia"},{"code":"LKR","name":"Sri Lankan Rupee","locale":"si-LK","region":"Asia"},{"code":"NPR","name":"Nepalese Rupee","locale":"ne-NP","region":"Asia"},{"code":"MMK","name":"Myanmar Kyat","locale":"my-MM","region":"Asia"},{"code":"KHR","name":"Cambodian Riel","locale":"km-KH","region":"Asia"},{"code":"LAK","name":"Lao Kip","locale":"lo-LA","region":"Asia"},{"code":"BND","name":"Brunei Dollar","locale":"ms-BN","region":"Asia"},{"code":"MOP","name":"Macanese Pataca","locale":"zh-MO","region":"Asia"},{"code":"MVR","name":"Maldivian Rufiyaa","locale":"dv-MV","region":"Asia"},{"code":"BTN","name":"Bhutanese Ngultrum","locale":"dz-BT","region":"Asia"},{"code":"AFN","name":"Afghan Afghani","locale":"fa-AF","region":"Asia"},{"code":"KZT","name":"Kazakhstani Tenge","locale":"kk-KZ","region":"Asia"},{"code":"UZS","name":"Uzbekistani Som","locale":"uz-UZ","region":"Asia"},{"code":"MNT","name":"Mongolian Tugrik","locale":"mn-MN","region":"Asia"},{"code":"EUR","name":"Euro","locale":"de-DE","region":"Europe"},{"code":"GBP","name":"British Pound","locale":"en-GB","region":"Europe"},{"code":"CHF","name":"Swiss Franc","locale":"de-CH","region":"Europe"},{"code":"NOK","name":"Norwegian Krone","locale":"nb-NO","region":"Europe"},{"code":"SEK","name":"Swedish Krona","locale":"sv-SE","region":"Europe"},{"code":"DKK","name":"Danish Krone","locale":"da-DK","region":"Europe"},{"code":"PLN","name":"Polish Zloty","locale":"pl-PL","region":"Europe"},{"code":"CZK","name":"Czech Koruna","locale":"cs-CZ","region":"Europe"},{"code":"HUF","name":"Hungarian Forint","locale":"hu-HU","region":"Europe"},{"code":"RON","name":"Romanian Leu","locale":"ro-RO","region":"Europe"},{"code":"BGN","name":"Bulgarian Lev","locale":"bg-BG","region":"Europe"},{"code":"ISK","name":"Icelandic Krona","locale":"is-IS","region":"Europe"},{"code":"TRY","name":"Turkish Lira","locale":"tr-TR","region":"Europe"},{"code":"UAH","name":"Ukrainian Hryvnia","locale":"uk-UA","region":"Europe"},{"code":"RUB","name":"Russian Ruble","locale":"ru-RU","region":"Europe"},{"code":"RSD","name":"Serbian Dinar","locale":"sr-RS","region":"Europe"},{"code":"ALL","name":"Albanian Lek","locale":"sq-AL","region":"Europe"},{"code":"MKD","name":"Macedonian Denar","locale":"mk-MK","region":"Europe"},{"code":"BAM","name":"Bosnia-Herzegovina Convertible Mark","locale":"bs-BA","region":"Europe"},{"code":"MDL","name":"Moldovan Leu","locale":"ro-MD","region":"Europe"},{"code":"GEL","name":"Georgian Lari","locale":"ka-GE","region":"Europe"},{"code":"AMD","name":"Armenian Dram","locale":"hy-AM","region":"Europe"},{"code":"AZN","name":"Azerbaijani Manat","locale":"az-AZ","region":"Europe"},{"code":"BYN","name":"Belarusian Ruble","locale":"be-BY","region":"Europe"}]$j$, 'currency', 'Display currencies offered in System Settings', 'json', true),
 ('system.group_labels', $j${"general":"General","branding":"Branding","currency":"Currency","tax":"Taxes","numbering":"Document numbering","limits":"Limits","commission":"Commission","policy":"Policy issuance","notification":"Notifications","reports":"Reports","uploads":"Uploads","product":"Product configurator","remittance":"Remittance","reinsurance":"Reinsurance","incentive":"Incentive","system":"System"}$j$, 'system', 'Configuration group labels', 'json', true),
 ('uploads.image_max_bytes', '2097152', 'uploads', 'Maximum logo / favicon size (bytes)', 'number', true),
 ('uploads.image_types', $j$["image/png","image/jpeg","image/gif","image/webp","image/svg+xml","image/x-icon","image/vnd.microsoft.icon"]$j$, 'uploads', 'Allowed logo / favicon file types', 'json', true),
 ('uploads.bulk_max_bytes', '10485760', 'uploads', 'Maximum bulk-processing file size (bytes)', 'number', true),
 -- document numbering
 ('numbering.remittance.prefix', '"REM"', 'numbering', 'Remittance number prefix', 'string', true),
 ('numbering.remittance_bill.prefix', '"BIL"', 'numbering', 'Direct / agency bill number prefix', 'string', true),
 ('numbering.remittance_batch.prefix', '"BLK"', 'numbering', 'Remittance processing batch prefix', 'string', true),
 ('numbering.settlement.prefix', '"SET"', 'numbering', 'Settlement reference prefix', 'string', true),
 ('numbering.adjustment.prefix', '"ADJ"', 'numbering', 'Remittance adjustment prefix', 'string', true),
 ('numbering.transfer.prefix', '"TRF"', 'numbering', 'Electronic transfer reference prefix', 'string', true),
 ('numbering.statement.prefix', '"STMT"', 'numbering', 'Remittance statement prefix', 'string', true),
 ('numbering.remittance_exception.prefix', '"EXC"', 'numbering', 'Remittance exception prefix', 'string', true),
 ('numbering.remittance_notice.prefix', '"NTF"', 'numbering', 'Remittance notification prefix', 'string', true),
 ('numbering.remittance_schedule.prefix', '"SCH"', 'numbering', 'Remittance schedule prefix', 'string', true),
 ('numbering.remittance_report.prefix', '"RPT"', 'numbering', 'Remittance report prefix', 'string', true),
 ('numbering.bank_txn.prefix', '"BNK"', 'numbering', 'Imported bank transaction prefix', 'string', true),
 ('numbering.treaty.prefix', '"TRT"', 'numbering', 'Treaty number prefix (when none is entered)', 'string', true),
 ('numbering.reinsurer.prefix', '"RE"', 'numbering', 'Reinsurer id prefix', 'string', true),
 ('numbering.cession.prefix', '"CES"', 'numbering', 'Cession number prefix', 'string', true),
 ('numbering.ri_recovery.prefix', '"RCL"', 'numbering', 'Reinsurance recovery claim prefix', 'string', true),
 ('numbering.bordereau.prefix', '"BDX"', 'numbering', 'Bordereau reference prefix', 'string', true),
 ('numbering.ri_reconciliation.prefix', '"REC"', 'numbering', 'Reinsurance reconciliation prefix', 'string', true),
 ('numbering.incentive_program.prefix', '"INC"', 'numbering', 'Incentive program code prefix', 'string', true),
 ('numbering.incentive_calc.prefix', '"CALC"', 'numbering', 'Incentive calculation batch prefix', 'string', true),
 ('numbering.product_template.prefix', '"TPL"', 'numbering', 'Product template code prefix (when none is entered)', 'string', true),
 -- product configurator
 ('product.analytics_months', '6', 'product', 'Months shown in product performance trend', 'number', true),
 ('product.template_statuses', $j$["Draft","Active","Inactive","Retired"]$j$, 'product', 'Product template statuses', 'json', true),
 ('product.component_kinds', $j$["coverages","rating-factors","underwriting-rules","documents","workflows","market-mappings","commissions","taxes","acceptance-limits","rating-parameters"]$j$, 'product', 'Product configuration component kinds', 'json', false),
 -- remittance
 ('remittance.status_labels', $j${"draft":"Draft","for-approval":"Pending Approval","approved":"Approved","processing":"Processing","settled":"Completed","rejected":"Rejected","cancelled":"Cancelled"}$j$, 'remittance', 'Remittance status labels', 'json', true),
 ('remittance.transfer_methods', $j$[{"label":"InstaPay","value":"InstaPay","limit":50000},{"label":"PESONet","value":"PESONet","limit":10000000},{"label":"RTGS (PhilPaSS)","value":"RTGS","limit":1000000000},{"label":"Wire Transfer","value":"Wire","limit":100000000}]$j$, 'remittance', 'Electronic transfer methods and limits', 'json', true),
 ('remittance.priority_sla_hours', $j${"Urgent":4,"High":12,"Normal":24,"Low":48}$j$, 'remittance', 'Approval SLA hours by priority', 'json', true),
 ('remittance.priority_thresholds', $j$[{"min":1000000,"priority":"Urgent"},{"min":250000,"priority":"High"},{"min":20000,"priority":"Normal"},{"min":0,"priority":"Low"}]$j$, 'remittance', 'Priority by amount', 'json', true),
 ('remittance.approval_levels', $j$[{"level":1,"maxAmount":100000},{"level":2,"maxAmount":1000000},{"level":3,"maxAmount":null}]$j$, 'remittance', 'Approval levels required by amount', 'json', true),
 ('remittance.default_due_days', '30', 'remittance', 'Default days until a remittance / bill is due', 'number', true),
 ('remittance.kpi_targets', $j${"settlementEfficiency":95,"paymentSuccessRate":95,"averageProcessingHours":24,"exceptionRate":2}$j$, 'remittance', 'Remittance KPI targets', 'json', true),
 ('remittance.reconciliation_tolerance', '0.5', 'remittance', 'Auto-match tolerance (amount, PHP)', 'number', true),
 -- reinsurance
 ('reinsurance.min_security_rating', '"A-"', 'reinsurance', 'Minimum reinsurer security rating for treaties and cessions', 'string', true),
 ('reinsurance.treaty_requires_approval', 'true', 'reinsurance', 'New treaties need approval by a second user', 'boolean', true),
 ('reinsurance.reconciliation_tolerance_percent', '1', 'reinsurance', 'Reconciliation variance tolerance (%)', 'number', true),
 ('reinsurance.target_retention_percent', '65', 'reinsurance', 'Target retention (%) for retention analysis', 'number', true),
 ('reinsurance.bordereau_due_days', '30', 'reinsurance', 'Bordereau due days after period end', 'number', true),
 ('reinsurance.cat_perils', $j$[{"peril":"Typhoon","pmlPercent":2.5},{"peril":"Earthquake","pmlPercent":4},{"peril":"Flood","pmlPercent":1.5}]$j$, 'reinsurance', 'Catastrophe perils and probable maximum loss (% of exposure)', 'json', true),
 -- incentive
 ('incentive.eligible_roles', $j$["sales"]$j$, 'incentive', 'Roles that take part in incentive programs', 'json', true),
 ('incentive.metric_map', $j${"Premium Volume":"premium","Policy Count":"policies","Renewal Rate":"renewal-rate","Conversion Rate":"conversion","New Business":"policies"}$j$, 'incentive', 'Target metric to measure', 'json', true),
 ('incentive.program_types', $j$["Target Based","Commission Based","Hybrid","Contest"]$j$, 'incentive', 'Incentive program types', 'json', true),
 ('incentive.calculation_frequencies', $j$["Monthly","Quarterly","Semi-Annual","Annual"]$j$, 'incentive', 'Calculation frequencies', 'json', true)
ON CONFLICT (key) DO NOTHING;

-- Group label for the quotation options (vehicle colours, model year span) on the Configuration screen
UPDATE app_settings SET value = value || '{"quote":"Quotation"}'::jsonb
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'quote';
