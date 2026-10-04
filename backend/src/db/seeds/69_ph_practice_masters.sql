-- Philippine practice reference masters (Master > Configuration; API /api/masters/<type>): salutations, civil status,
-- gender, nationality (Filipino by default), government ID types, customer types with their registration authority
-- (DTI / SEC / CDA), payment modes used in the Philippines, Philippine public holidays (current and next year), the
-- Philippine banks and the non-life insurers licensed by the Insurance Commission, with the IC certificate fields.
-- Items the broker confirms before go-live are listed in docs/onboarding/GO_LIVE_DATA_SETUP.md (Philippine settings).
-- Idempotent: a type, record, bank or insurer is added only when it is missing; administrator changes are kept.
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$salutation$s$, $s$Salutation$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Salutation","type":"string","required":true},{"name":"description","label":"Description","type":"text","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 140, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$MR$s$, $s$Mr.$s$, $j${"code":"MR","name":"Mr.","description":"Mister","sortOrder":10}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$MR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$MS$s$, $s$Ms.$s$, $j${"code":"MS","name":"Ms.","description":"Woman, civil status not stated","sortOrder":20}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$MS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$MRS$s$, $s$Mrs.$s$, $j${"code":"MRS","name":"Mrs.","description":"Married woman","sortOrder":30}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$MRS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$MISS$s$, $s$Miss$s$, $j${"code":"MISS","name":"Miss","description":"Unmarried woman","sortOrder":40}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$MISS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$DR$s$, $s$Dr.$s$, $j${"code":"DR","name":"Dr.","description":"Doctor (medicine, dentistry, doctorate)","sortOrder":50}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$DR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$ATTY$s$, $s$Atty.$s$, $j${"code":"ATTY","name":"Atty.","description":"Attorney-at-law (member of the Philippine Bar)","sortOrder":60}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$ATTY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$ENGR$s$, $s$Engr.$s$, $j${"code":"ENGR","name":"Engr.","description":"Licensed engineer (PRC)","sortOrder":70}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$ENGR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$ARCH$s$, $s$Arch.$s$, $j${"code":"ARCH","name":"Arch.","description":"Licensed architect (PRC)","sortOrder":80}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$ARCH$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$HON$s$, $s$Hon.$s$, $j${"code":"HON","name":"Hon.","description":"Honorable (elected or appointed official, judge)","sortOrder":90}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$HON$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$salutation$s$, $s$REV$s$, $s$Rev.$s$, $j${"code":"REV","name":"Rev.","description":"Reverend (clergy)","sortOrder":100}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$salutation$s$ AND lower(code) = lower($s$REV$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$civil-status$s$, $s$Civil Status$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Civil Status","type":"string","required":true},{"name":"description","label":"Description","type":"text","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 141, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$SINGLE$s$, $s$Single$s$, $j${"code":"SINGLE","name":"Single","description":"Never married","sortOrder":10}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$SINGLE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$MARRIED$s$, $s$Married$s$, $j${"code":"MARRIED","name":"Married","description":"","sortOrder":20}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$MARRIED$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$WIDOWED$s$, $s$Widowed$s$, $j${"code":"WIDOWED","name":"Widowed","description":"Widow or widower","sortOrder":30}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$WIDOWED$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$SEPARATED$s$, $s$Legally Separated$s$, $j${"code":"SEPARATED","name":"Legally Separated","description":"Decree of legal separation (Family Code)","sortOrder":40}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$SEPARATED$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$ANNULLED$s$, $s$Annulled$s$, $j${"code":"ANNULLED","name":"Annulled","description":"Marriage annulled or declared void by a court","sortOrder":50}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$ANNULLED$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$civil-status$s$, $s$DIVORCED$s$, $s$Divorced$s$, $j${"code":"DIVORCED","name":"Divorced","description":"Divorce recognised in the Philippines (foreign divorce judicially recognised, or under the Code of Muslim Personal Laws)","sortOrder":60}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$civil-status$s$ AND lower(code) = lower($s$DIVORCED$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$gender$s$, $s$Gender$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Gender","type":"string","required":true},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 142, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$gender$s$, $s$M$s$, $s$Male$s$, $j${"code":"M","name":"Male","sortOrder":10}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$gender$s$ AND lower(code) = lower($s$M$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$gender$s$, $s$F$s$, $s$Female$s$, $j${"code":"F","name":"Female","sortOrder":20}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$gender$s$ AND lower(code) = lower($s$F$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$nationality$s$, $s$Nationality$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Nationality","type":"string","required":true},{"name":"countryCode","label":"Country (ISO code)","type":"string","required":false},{"name":"isDefault","label":"Default","type":"boolean","required":false,"default":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 143, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$FIL$s$, $s$Filipino$s$, $j${"code":"FIL","name":"Filipino","countryCode":"PH","isDefault":true}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$FIL$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$AME$s$, $s$American$s$, $j${"code":"AME","name":"American","countryCode":"US","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$AME$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$AUS$s$, $s$Australian$s$, $j${"code":"AUS","name":"Australian","countryCode":"AU","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$AUS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$BRI$s$, $s$British$s$, $j${"code":"BRI","name":"British","countryCode":"GB","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$BRI$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$CAN$s$, $s$Canadian$s$, $j${"code":"CAN","name":"Canadian","countryCode":"CA","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$CAN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$CHI$s$, $s$Chinese$s$, $j${"code":"CHI","name":"Chinese","countryCode":"CN","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$CHI$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$FRE$s$, $s$French$s$, $j${"code":"FRE","name":"French","countryCode":"FR","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$FRE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$GER$s$, $s$German$s$, $j${"code":"GER","name":"German","countryCode":"DE","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$GER$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$IND$s$, $s$Indian$s$, $j${"code":"IND","name":"Indian","countryCode":"IN","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$IND$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$INA$s$, $s$Indonesian$s$, $j${"code":"INA","name":"Indonesian","countryCode":"ID","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$INA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$JPN$s$, $s$Japanese$s$, $j${"code":"JPN","name":"Japanese","countryCode":"JP","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$JPN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$KOR$s$, $s$Korean$s$, $j${"code":"KOR","name":"Korean","countryCode":"KR","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$KOR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$MAL$s$, $s$Malaysian$s$, $j${"code":"MAL","name":"Malaysian","countryCode":"MY","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$MAL$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$SGP$s$, $s$Singaporean$s$, $j${"code":"SGP","name":"Singaporean","countryCode":"SG","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$SGP$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$SPA$s$, $s$Spanish$s$, $j${"code":"SPA","name":"Spanish","countryCode":"ES","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$SPA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$TWN$s$, $s$Taiwanese$s$, $j${"code":"TWN","name":"Taiwanese","countryCode":"TW","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$TWN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$nationality$s$, $s$VIE$s$, $s$Vietnamese$s$, $j${"code":"VIE","name":"Vietnamese","countryCode":"VN","isDefault":false}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$nationality$s$ AND lower(code) = lower($s$VIE$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$government-id-type$s$, $s$Government ID Type$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"ID Type","type":"string","required":true},{"name":"issuingAgency","label":"Issuing Agency","type":"string","required":false},{"name":"numberFormat","label":"Number Format (example)","type":"string","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 144, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$PHILSYS$s$, $s$PhilSys National ID (PhilID / ePhilID)$s$, $j${"code":"PHILSYS","name":"PhilSys National ID (PhilID / ePhilID)","issuingAgency":"Philippine Statistics Authority (PhilSys)","numberFormat":"1234-5678-9012-3456 (PhilSys Card Number)","sortOrder":10}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$PHILSYS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$UMID$s$, $s$UMID (Unified Multi-Purpose ID)$s$, $j${"code":"UMID","name":"UMID (Unified Multi-Purpose ID)","issuingAgency":"Social Security System / Government Service Insurance System","numberFormat":"0111-1234567-8 (CRN)","sortOrder":20}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$UMID$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$SSS$s$, $s$SSS ID$s$, $j${"code":"SSS","name":"SSS ID","issuingAgency":"Social Security System","numberFormat":"34-1234567-8","sortOrder":30}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$SSS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$GSIS$s$, $s$GSIS eCard$s$, $j${"code":"GSIS","name":"GSIS eCard","issuingAgency":"Government Service Insurance System","numberFormat":"","sortOrder":40}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$GSIS$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$TIN$s$, $s$TIN ID$s$, $j${"code":"TIN","name":"TIN ID","issuingAgency":"Bureau of Internal Revenue","numberFormat":"123-456-789-000","sortOrder":50}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$TIN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$PASSPORT$s$, $s$Passport$s$, $j${"code":"PASSPORT","name":"Passport","issuingAgency":"Department of Foreign Affairs","numberFormat":"P1234567A","sortOrder":60}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$PASSPORT$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$DL$s$, $s$Driver's License$s$, $j${"code":"DL","name":"Driver's License","issuingAgency":"Land Transportation Office","numberFormat":"N01-23-456789","sortOrder":70}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$DL$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$PRC$s$, $s$PRC ID$s$, $j${"code":"PRC","name":"PRC ID","issuingAgency":"Professional Regulation Commission","numberFormat":"0123456","sortOrder":80}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$PRC$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$POSTAL$s$, $s$Postal ID$s$, $j${"code":"POSTAL","name":"Postal ID","issuingAgency":"Philippine Postal Corporation","numberFormat":"","sortOrder":90}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$POSTAL$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$VOTER$s$, $s$Voter's ID / Voter's Certification$s$, $j${"code":"VOTER","name":"Voter's ID / Voter's Certification","issuingAgency":"Commission on Elections","numberFormat":"","sortOrder":100}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$VOTER$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$SENIOR$s$, $s$Senior Citizen ID$s$, $j${"code":"SENIOR","name":"Senior Citizen ID","issuingAgency":"Office of Senior Citizens Affairs (city / municipality)","numberFormat":"","sortOrder":110}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$SENIOR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$government-id-type$s$, $s$PWD$s$, $s$PWD ID$s$, $j${"code":"PWD","name":"PWD ID","issuingAgency":"Persons with Disability Affairs Office (city / municipality)","numberFormat":"","sortOrder":120}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$government-id-type$s$ AND lower(code) = lower($s$PWD$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$customer-type$s$, $s$Customer Type$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Customer Type","type":"string","required":true},{"name":"clientType","label":"Client Type","type":"select","required":true,"options":["individual","corporate"]},{"name":"registrationAuthority","label":"Registration Authority","type":"select","required":false,"options":["None","DTI","SEC","CDA","DHSUD","Charter / law"]},{"name":"registrationNumberLabel","label":"Registration Number Label","type":"string","required":false},{"name":"tinRequired","label":"TIN Required","type":"boolean","required":false,"default":true},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 145, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$INDIVIDUAL$s$, $s$Individual$s$, $j${"code":"INDIVIDUAL","name":"Individual","clientType":"individual","registrationAuthority":"None","registrationNumberLabel":"","tinRequired":true,"description":"Natural person"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$INDIVIDUAL$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$SOLE_PROP$s$, $s$Sole Proprietorship$s$, $j${"code":"SOLE_PROP","name":"Sole Proprietorship","clientType":"corporate","registrationAuthority":"DTI","registrationNumberLabel":"DTI Business Name Registration No.","tinRequired":true,"description":"Business of one owner, insured in the owner's name doing business under the registered business name"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$SOLE_PROP$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$PARTNERSHIP$s$, $s$Partnership$s$, $j${"code":"PARTNERSHIP","name":"Partnership","clientType":"corporate","registrationAuthority":"SEC","registrationNumberLabel":"SEC Registration No.","tinRequired":true,"description":"General or limited partnership"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$PARTNERSHIP$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$CORPORATION$s$, $s$Stock Corporation$s$, $j${"code":"CORPORATION","name":"Stock Corporation","clientType":"corporate","registrationAuthority":"SEC","registrationNumberLabel":"SEC Company Registration No.","tinRequired":true,"description":"Domestic stock corporation (Revised Corporation Code)"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$CORPORATION$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$OPC$s$, $s$One Person Corporation$s$, $j${"code":"OPC","name":"One Person Corporation","clientType":"corporate","registrationAuthority":"SEC","registrationNumberLabel":"SEC Company Registration No.","tinRequired":true,"description":"Corporation with a single stockholder (Revised Corporation Code)"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$OPC$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$NONSTOCK$s$, $s$Non-stock Corporation / Foundation$s$, $j${"code":"NONSTOCK","name":"Non-stock Corporation / Foundation","clientType":"corporate","registrationAuthority":"SEC","registrationNumberLabel":"SEC Company Registration No.","tinRequired":true,"description":"Non-stock, non-profit corporation, foundation or association"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$NONSTOCK$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$FOREIGN$s$, $s$Branch of a Foreign Corporation$s$, $j${"code":"FOREIGN","name":"Branch of a Foreign Corporation","clientType":"corporate","registrationAuthority":"SEC","registrationNumberLabel":"SEC License to Do Business No.","tinRequired":true,"description":"Branch, regional headquarters or representative office of a foreign corporation"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$FOREIGN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$COOPERATIVE$s$, $s$Cooperative$s$, $j${"code":"COOPERATIVE","name":"Cooperative","clientType":"corporate","registrationAuthority":"CDA","registrationNumberLabel":"CDA Certificate of Registration No.","tinRequired":true,"description":"Cooperative registered with the Cooperative Development Authority"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$COOPERATIVE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$HOA$s$, $s$Homeowners' Association$s$, $j${"code":"HOA","name":"Homeowners' Association","clientType":"corporate","registrationAuthority":"DHSUD","registrationNumberLabel":"DHSUD Certificate of Registration No.","tinRequired":true,"description":"Homeowners' association registered with the Department of Human Settlements and Urban Development"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$HOA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$customer-type$s$, $s$GOVERNMENT$s$, $s$Government Agency / GOCC$s$, $j${"code":"GOVERNMENT","name":"Government Agency / GOCC","clientType":"corporate","registrationAuthority":"Charter / law","registrationNumberLabel":"Charter or law","tinRequired":true,"description":"National government agency, local government unit or government-owned or -controlled corporation"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$customer-type$s$ AND lower(code) = lower($s$GOVERNMENT$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$payment-mode$s$, $s$Payment Mode$s$, $s$finance$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Payment Mode","type":"string","required":true},{"name":"channel","label":"Captured As","type":"select","required":true,"options":["cash","check","bank-transfer","online","card"]},{"name":"referenceRequired","label":"Reference Required","type":"boolean","required":false,"default":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 146, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$CASH$s$, $s$Cash$s$, $j${"code":"CASH","name":"Cash","channel":"cash","referenceRequired":false,"description":"Cash received at a branch; an official receipt is issued","sortOrder":10}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$CASH$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$CHECK$s$, $s$Check$s$, $j${"code":"CHECK","name":"Check","channel":"check","referenceRequired":true,"description":"Current-dated check; check number, bank and date are recorded","sortOrder":20}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$CHECK$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$PDC$s$, $s$Post-dated Check$s$, $j${"code":"PDC","name":"Post-dated Check","channel":"check","referenceRequired":true,"description":"Check dated in the future, deposited on its date","sortOrder":30}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$PDC$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$DEPOSIT$s$, $s$Bank Deposit$s$, $j${"code":"DEPOSIT","name":"Bank Deposit","channel":"bank-transfer","referenceRequired":true,"description":"Over-the-counter deposit to the broker's bank account; deposit slip reference","sortOrder":40}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$DEPOSIT$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$INSTAPAY$s$, $s$InstaPay$s$, $j${"code":"INSTAPAY","name":"InstaPay","channel":"bank-transfer","referenceRequired":true,"description":"Real-time electronic fund transfer (BSP NRPS), up to PHP 50,000 per transaction","sortOrder":50}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$INSTAPAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$PESONET$s$, $s$PESONet$s$, $j${"code":"PESONET","name":"PESONet","channel":"bank-transfer","referenceRequired":true,"description":"Batch electronic fund transfer (BSP NRPS), credited within the banking day","sortOrder":60}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$PESONET$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$GCASH$s$, $s$GCash$s$, $j${"code":"GCASH","name":"GCash","channel":"online","referenceRequired":true,"description":"E-wallet payment; GCash reference number","sortOrder":70}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$GCASH$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$MAYA$s$, $s$Maya$s$, $j${"code":"MAYA","name":"Maya","channel":"online","referenceRequired":true,"description":"E-wallet payment; Maya reference number","sortOrder":80}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$MAYA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$CREDIT_CARD$s$, $s$Credit Card$s$, $j${"code":"CREDIT_CARD","name":"Credit Card","channel":"card","referenceRequired":true,"description":"Card payment through the payment gateway or a POS terminal","sortOrder":90}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$CREDIT_CARD$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$payment-mode$s$, $s$DEBIT_CARD$s$, $s$Debit Card$s$, $j${"code":"DEBIT_CARD","name":"Debit Card","channel":"card","referenceRequired":true,"description":"Card payment through the payment gateway or a POS terminal","sortOrder":100}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$payment-mode$s$ AND lower(code) = lower($s$DEBIT_CARD$s$));
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$holiday$s$, $s$Holiday$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$, $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Holiday","type":"string","required":true},{"name":"date","label":"Date","type":"date","required":true},{"name":"holidayType","label":"Type","type":"select","required":true,"options":["Regular Holiday","Special Non-working Day","Special Working Day"]},{"name":"scope","label":"Scope","type":"select","required":false,"options":["National","Local"]},{"name":"location","label":"Province / City (local holidays)","type":"string","required":false},{"name":"legalBasis","label":"Legal Basis","type":"string","required":false},{"name":"remarks","label":"Remarks","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["code"]]$j$, false, 147, true, 'seed')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-01-01-NEWYEARSDAY$s$, $s$New Year's Day$s$, $j${"code":"2026-01-01-NEWYEARSDAY","name":"New Year's Day","date":"2026-01-01","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-01-01-NEWYEARSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-02-17-CHINESENEWYEAR$s$, $s$Chinese New Year$s$, $j${"code":"2026-02-17-CHINESENEWYEAR","name":"Chinese New Year","date":"2026-02-17","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-02-17-CHINESENEWYEAR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-02-25-EDSAPEOPLEPOWERR$s$, $s$EDSA People Power Revolution Anniversary$s$, $j${"code":"2026-02-25-EDSAPEOPLEPOWERR","name":"EDSA People Power Revolution Anniversary","date":"2026-02-25","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":"Declared each year by proclamation; in some years a special working day"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-02-25-EDSAPEOPLEPOWERR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-03-20-EIDLFITR$s$, $s$Eid'l Fitr$s$, $j${"code":"2026-03-20-EIDLFITR","name":"Eid'l Fitr","date":"2026-03-20","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":"Date declared by a separate proclamation (NCMF recommendation); adjust when proclaimed"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-03-20-EIDLFITR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-04-02-MAUNDYTHURSDAY$s$, $s$Maundy Thursday$s$, $j${"code":"2026-04-02-MAUNDYTHURSDAY","name":"Maundy Thursday","date":"2026-04-02","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-04-02-MAUNDYTHURSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-04-03-GOODFRIDAY$s$, $s$Good Friday$s$, $j${"code":"2026-04-03-GOODFRIDAY","name":"Good Friday","date":"2026-04-03","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-04-03-GOODFRIDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-04-04-BLACKSATURDAY$s$, $s$Black Saturday$s$, $j${"code":"2026-04-04-BLACKSATURDAY","name":"Black Saturday","date":"2026-04-04","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-04-04-BLACKSATURDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-04-09-ARAWNGKAGITINGAN$s$, $s$Araw ng Kagitingan$s$, $j${"code":"2026-04-09-ARAWNGKAGITINGAN","name":"Araw ng Kagitingan","date":"2026-04-09","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-04-09-ARAWNGKAGITINGAN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-05-01-LABORDAY$s$, $s$Labor Day$s$, $j${"code":"2026-05-01-LABORDAY","name":"Labor Day","date":"2026-05-01","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-05-01-LABORDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-05-27-EIDLADHA$s$, $s$Eid'l Adha$s$, $j${"code":"2026-05-27-EIDLADHA","name":"Eid'l Adha","date":"2026-05-27","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":"Date declared by a separate proclamation (NCMF recommendation); adjust when proclaimed"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-05-27-EIDLADHA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-06-12-INDEPENDENCEDAY$s$, $s$Independence Day$s$, $j${"code":"2026-06-12-INDEPENDENCEDAY","name":"Independence Day","date":"2026-06-12","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-06-12-INDEPENDENCEDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-08-21-NINOYAQUINODAY$s$, $s$Ninoy Aquino Day$s$, $j${"code":"2026-08-21-NINOYAQUINODAY","name":"Ninoy Aquino Day","date":"2026-08-21","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-08-21-NINOYAQUINODAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-08-31-NATIONALHEROESDA$s$, $s$National Heroes Day$s$, $j${"code":"2026-08-31-NATIONALHEROESDA","name":"National Heroes Day","date":"2026-08-31","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":"Last Monday of August"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-08-31-NATIONALHEROESDA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-10-31-ALLSAINTSDAYEVE$s$, $s$All Saints' Day Eve$s$, $j${"code":"2026-10-31-ALLSAINTSDAYEVE","name":"All Saints' Day Eve","date":"2026-10-31","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-10-31-ALLSAINTSDAYEVE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-11-01-ALLSAINTSDAY$s$, $s$All Saints' Day$s$, $j${"code":"2026-11-01-ALLSAINTSDAY","name":"All Saints' Day","date":"2026-11-01","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-11-01-ALLSAINTSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-11-30-BONIFACIODAY$s$, $s$Bonifacio Day$s$, $j${"code":"2026-11-30-BONIFACIODAY","name":"Bonifacio Day","date":"2026-11-30","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-11-30-BONIFACIODAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-12-08-FEASTOFTHEIMMACU$s$, $s$Feast of the Immaculate Conception of Mary$s$, $j${"code":"2026-12-08-FEASTOFTHEIMMACU","name":"Feast of the Immaculate Conception of Mary","date":"2026-12-08","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-12-08-FEASTOFTHEIMMACU$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-12-24-CHRISTMASEVE$s$, $s$Christmas Eve$s$, $j${"code":"2026-12-24-CHRISTMASEVE","name":"Christmas Eve","date":"2026-12-24","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-12-24-CHRISTMASEVE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-12-25-CHRISTMASDAY$s$, $s$Christmas Day$s$, $j${"code":"2026-12-25-CHRISTMASDAY","name":"Christmas Day","date":"2026-12-25","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-12-25-CHRISTMASDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-12-30-RIZALDAY$s$, $s$Rizal Day$s$, $j${"code":"2026-12-30-RIZALDAY","name":"Rizal Day","date":"2026-12-30","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-12-30-RIZALDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2026-12-31-LASTDAYOFTHEYEAR$s$, $s$Last Day of the Year$s$, $j${"code":"2026-12-31-LASTDAYOFTHEYEAR","name":"Last Day of the Year","date":"2026-12-31","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2026","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2026-12-31-LASTDAYOFTHEYEAR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-01-01-NEWYEARSDAY$s$, $s$New Year's Day$s$, $j${"code":"2027-01-01-NEWYEARSDAY","name":"New Year's Day","date":"2027-01-01","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-01-01-NEWYEARSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-02-06-CHINESENEWYEAR$s$, $s$Chinese New Year$s$, $j${"code":"2027-02-06-CHINESENEWYEAR","name":"Chinese New Year","date":"2027-02-06","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-02-06-CHINESENEWYEAR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-02-25-EDSAPEOPLEPOWERR$s$, $s$EDSA People Power Revolution Anniversary$s$, $j${"code":"2027-02-25-EDSAPEOPLEPOWERR","name":"EDSA People Power Revolution Anniversary","date":"2027-02-25","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":"Declared each year by proclamation; in some years a special working day"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-02-25-EDSAPEOPLEPOWERR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-03-10-EIDLFITR$s$, $s$Eid'l Fitr$s$, $j${"code":"2027-03-10-EIDLFITR","name":"Eid'l Fitr","date":"2027-03-10","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":"Date declared by a separate proclamation (NCMF recommendation); adjust when proclaimed"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-03-10-EIDLFITR$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-03-25-MAUNDYTHURSDAY$s$, $s$Maundy Thursday$s$, $j${"code":"2027-03-25-MAUNDYTHURSDAY","name":"Maundy Thursday","date":"2027-03-25","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-03-25-MAUNDYTHURSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-03-26-GOODFRIDAY$s$, $s$Good Friday$s$, $j${"code":"2027-03-26-GOODFRIDAY","name":"Good Friday","date":"2027-03-26","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-03-26-GOODFRIDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-03-27-BLACKSATURDAY$s$, $s$Black Saturday$s$, $j${"code":"2027-03-27-BLACKSATURDAY","name":"Black Saturday","date":"2027-03-27","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-03-27-BLACKSATURDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-04-09-ARAWNGKAGITINGAN$s$, $s$Araw ng Kagitingan$s$, $j${"code":"2027-04-09-ARAWNGKAGITINGAN","name":"Araw ng Kagitingan","date":"2027-04-09","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-04-09-ARAWNGKAGITINGAN$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-05-01-LABORDAY$s$, $s$Labor Day$s$, $j${"code":"2027-05-01-LABORDAY","name":"Labor Day","date":"2027-05-01","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-05-01-LABORDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-05-17-EIDLADHA$s$, $s$Eid'l Adha$s$, $j${"code":"2027-05-17-EIDLADHA","name":"Eid'l Adha","date":"2027-05-17","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":"Date declared by a separate proclamation (NCMF recommendation); adjust when proclaimed"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-05-17-EIDLADHA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-06-12-INDEPENDENCEDAY$s$, $s$Independence Day$s$, $j${"code":"2027-06-12-INDEPENDENCEDAY","name":"Independence Day","date":"2027-06-12","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-06-12-INDEPENDENCEDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-08-21-NINOYAQUINODAY$s$, $s$Ninoy Aquino Day$s$, $j${"code":"2027-08-21-NINOYAQUINODAY","name":"Ninoy Aquino Day","date":"2027-08-21","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-08-21-NINOYAQUINODAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-08-30-NATIONALHEROESDA$s$, $s$National Heroes Day$s$, $j${"code":"2027-08-30-NATIONALHEROESDA","name":"National Heroes Day","date":"2027-08-30","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":"Last Monday of August"}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-08-30-NATIONALHEROESDA$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-10-31-ALLSAINTSDAYEVE$s$, $s$All Saints' Day Eve$s$, $j${"code":"2027-10-31-ALLSAINTSDAYEVE","name":"All Saints' Day Eve","date":"2027-10-31","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-10-31-ALLSAINTSDAYEVE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-11-01-ALLSAINTSDAY$s$, $s$All Saints' Day$s$, $j${"code":"2027-11-01-ALLSAINTSDAY","name":"All Saints' Day","date":"2027-11-01","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-11-01-ALLSAINTSDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-11-30-BONIFACIODAY$s$, $s$Bonifacio Day$s$, $j${"code":"2027-11-30-BONIFACIODAY","name":"Bonifacio Day","date":"2027-11-30","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-11-30-BONIFACIODAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-12-08-FEASTOFTHEIMMACU$s$, $s$Feast of the Immaculate Conception of Mary$s$, $j${"code":"2027-12-08-FEASTOFTHEIMMACU","name":"Feast of the Immaculate Conception of Mary","date":"2027-12-08","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-12-08-FEASTOFTHEIMMACU$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-12-24-CHRISTMASEVE$s$, $s$Christmas Eve$s$, $j${"code":"2027-12-24-CHRISTMASEVE","name":"Christmas Eve","date":"2027-12-24","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-12-24-CHRISTMASEVE$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-12-25-CHRISTMASDAY$s$, $s$Christmas Day$s$, $j${"code":"2027-12-25-CHRISTMASDAY","name":"Christmas Day","date":"2027-12-25","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-12-25-CHRISTMASDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-12-30-RIZALDAY$s$, $s$Rizal Day$s$, $j${"code":"2027-12-30-RIZALDAY","name":"Rizal Day","date":"2027-12-30","holidayType":"Regular Holiday","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-12-30-RIZALDAY$s$));
INSERT INTO master_records(type_code, code, name, data, status, created_by) SELECT $s$holiday$s$, $s$2027-12-31-LASTDAYOFTHEYEAR$s$, $s$Last Day of the Year$s$, $j${"code":"2027-12-31-LASTDAYOFTHEYEAR","name":"Last Day of the Year","date":"2027-12-31","holidayType":"Special Non-working Day","scope":"National","location":"","legalBasis":"Republic Act No. 9492 and the proclamation of the holidays for 2027","remarks":""}$j$, 'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = $s$holiday$s$ AND lower(code) = lower($s$2027-12-31-LASTDAYOFTHEYEAR$s$));

-- ---------- Philippine banks (SWIFT / BIC of the head office; the bank's branch and contact details are added on the screen) ----------
INSERT INTO banks(code, name, swift_code, attrs, created_by)
SELECT v.code, v.name, NULLIF(v.swift, ''), jsonb_build_object('category', v.category), 'seed' FROM (VALUES
 ('BDO', 'BDO Unibank, Inc.', 'BNORPHMM', 'Universal Bank'),
 ('BPI', 'Bank of the Philippine Islands', 'BOPIPHMM', 'Universal Bank'),
 ('MBT', 'Metropolitan Bank and Trust Company', 'MBTCPHMM', 'Universal Bank'),
 ('LBP', 'Land Bank of the Philippines', 'TLBPPHMM', 'Government Bank'),
 ('PNB', 'Philippine National Bank', 'PNBMPHMM', 'Universal Bank'),
 ('SECB', 'Security Bank Corporation', 'SETCPHMM', 'Universal Bank'),
 ('UBP', 'Union Bank of the Philippines', 'UBPHPHMM', 'Universal Bank'),
 ('RCBC', 'Rizal Commercial Banking Corporation', 'RCBCPHMM', 'Universal Bank'),
 ('CBC', 'China Banking Corporation', 'CHBKPHMM', 'Universal Bank'),
 ('EWB', 'East West Banking Corporation', 'EWBCPHMM', 'Universal Bank'),
 ('DBP', 'Development Bank of the Philippines', 'DBPHPHMM', 'Government Bank'),
 ('PSB', 'Philippine Savings Bank', 'PHSBPHMM', 'Thrift Bank'),
 ('AUB', 'Asia United Bank Corporation', 'AUBKPHMM', 'Universal Bank'),
 ('MAYBANK', 'Maybank Philippines, Inc.', 'MBBEPHMM', 'Commercial Bank'),
 ('PBCOM', 'Philippine Bank of Communications', 'CPHIPHMM', 'Commercial Bank'),
 ('BOC', 'Bank of Commerce', 'PABIPHMM', 'Commercial Bank'),
 ('PVB', 'Philippine Veterans Bank', 'PHVBPHMM', 'Commercial Bank')
) AS v(code, name, swift, category)
WHERE NOT EXISTS (SELECT 1 FROM banks b WHERE lower(b.code) = lower(v.code) OR lower(b.name) = lower(v.name))
ON CONFLICT (code) DO NOTHING;
UPDATE banks SET attrs = jsonb_build_object('category', 'Universal Bank') || attrs
WHERE code IN ('BDO', 'BPI', 'MBT', 'SECB', 'CBC') AND NOT attrs ? 'category';
UPDATE banks SET attrs = jsonb_build_object('category', 'Government Bank') || attrs WHERE code = 'LBP' AND NOT attrs ? 'category';

-- ---------- Insurance Commission certificate on the insurer master ----------
UPDATE master_types t SET fields = t.fields || (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements($j$[
    {"name":"icCertificateNumber","label":"IC Certificate of Authority No.","type":"string","required":false},
    {"name":"icCertificateValidUntil","label":"Certificate of Authority Valid Until","type":"date","required":false},
    {"name":"icLineOfBusiness","label":"IC Licence","type":"select","required":false,"options":["Non-life","Life","Composite"]}
  ]$j$::jsonb) f
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) e WHERE e->>'name' = f->>'name'))
WHERE t.code = 'insurance-company';

-- ---------- Non-life insurers licensed by the Insurance Commission ----------
-- Shipped INACTIVE: the broker activates the insurers it places business with (Master > Generals > Insurance Company).
-- The six insurers of 10_masters.sql (MAPFRE, Malayan, Pioneer, FPG, Standard, Mercantile) stay active as the starter set.
-- Names as published on the Insurance Commission list of non-life insurance companies with a Certificate of Authority;
-- the IC certificate number and validity are left blank for the broker to fill in.
INSERT INTO insurance_companies(code, name, short_name, status, attrs, created_by)
SELECT v.code, v.name, v.short, 'inactive', jsonb_build_object('icLineOfBusiness', v.licence), 'seed' FROM (VALUES
 ('AIG', 'AIG Philippines Insurance, Inc.', 'AIG', 'Non-life'),
 ('ALLIEDBANKERS', 'Alliedbankers Insurance Corporation', 'Alliedbankers', 'Non-life'),
 ('ALPHA', 'Alpha Insurance and Surety Company, Inc.', 'Alpha', 'Non-life'),
 ('ASIAINS', 'Asia Insurance (Philippines) Corporation', 'Asia Insurance', 'Non-life'),
 ('BANKERS', 'Bankers Assurance Corporation', 'Bankers Assurance', 'Non-life'),
 ('BPIMS', 'BPI/MS Insurance Corporation', 'BPI/MS', 'Non-life'),
 ('CENTRALSURETY', 'Central Surety and Insurance Company', 'Central Surety', 'Non-life'),
 ('CHARTERPINGAN', 'Charter Ping An Insurance Corporation', 'Charter Ping An', 'Non-life'),
 ('COCOGEN', 'Cocogen Insurance, Inc.', 'Cocogen', 'Non-life'),
 ('COMMONWEALTH', 'Commonwealth Insurance Company', 'Commonwealth', 'Non-life'),
 ('CORPGUARANTEE', 'Corporate Guarantee and Insurance Company', 'Corporate Guarantee', 'Non-life'),
 ('COUNTRYBANKERS', 'Country Bankers Insurance Corporation', 'Country Bankers', 'Non-life'),
 ('DOMESTIC', 'Domestic Insurance Company of the Philippines', 'Domestic', 'Non-life'),
 ('EASTERN', 'Eastern Assurance and Surety Corporation', 'Eastern Assurance', 'Non-life'),
 ('EMPIRE', 'Empire Insurance Company', 'Empire', 'Non-life'),
 ('EQUITABLE', 'Equitable Insurance Corporation', 'Equitable', 'Non-life'),
 ('FEDPHOENIX', 'Federal Phoenix Assurance Company, Inc.', 'Federal Phoenix', 'Non-life'),
 ('FIBIC', 'First Integrated Bonding and Insurance Company, Inc.', 'FIBIC', 'Non-life'),
 ('FORTUNEGEN', 'Fortune General Insurance Corporation', 'Fortune General', 'Non-life'),
 ('GREATDOMESTIC', 'Great Domestic Insurance Company of the Philippines, Inc.', 'Great Domestic', 'Non-life'),
 ('INTRASTRATA', 'Intra-Strata Assurance Corporation', 'Intra-Strata', 'Non-life'),
 ('LIBERTY', 'Liberty Insurance Corporation', 'Liberty', 'Non-life'),
 ('MAAGEN', 'MAA General Assurance Philippines, Inc.', 'MAA General', 'Non-life'),
 ('MANILAINS', 'The Manila Insurance Company, Inc.', 'Manila Insurance', 'Non-life'),
 ('MILESTONE', 'Milestone Guaranty and Assurance Corporation', 'Milestone', 'Non-life'),
 ('ORIENTAL', 'Oriental Assurance Corporation', 'Oriental', 'Non-life'),
 ('PACIFICUNION', 'Pacific Union Insurance Company', 'Pacific Union', 'Non-life'),
 ('PARAMOUNT', 'Paramount Life & General Insurance Corporation', 'Paramount', 'Composite'),
 ('PEOPLESGEN', 'People''s General Insurance Corporation', 'People''s General', 'Non-life'),
 ('PHILBRITISH', 'Philippine British Assurance Company, Inc.', 'Phil. British', 'Non-life'),
 ('PHILCHARTER', 'Philippine Charter Insurance Corporation', 'Phil. Charter', 'Non-life'),
 ('PHILFIRST', 'Philippines First Insurance Company, Inc.', 'Phil. First', 'Non-life'),
 ('PHILPHOENIX', 'Philippine Phoenix Surety and Insurance, Inc.', 'Phil. Phoenix', 'Non-life'),
 ('PIONEERINTL', 'Pioneer Intercontinental Insurance Corporation', 'Pioneer Intercontinental', 'Non-life'),
 ('PLARIDEL', 'Plaridel Surety and Insurance Company', 'Plaridel', 'Non-life'),
 ('PRUDENTIALGUAR', 'Prudential Guarantee and Assurance, Inc.', 'PGAI', 'Non-life'),
 ('QBESEABOARD', 'QBE Seaboard Insurance Philippines, Inc.', 'QBE Seaboard', 'Non-life'),
 ('RBINS', 'R&B Insurance Corporation', 'R&B', 'Non-life'),
 ('RIZALSURETY', 'Rizal Surety and Insurance Company', 'Rizal Surety', 'Non-life'),
 ('STERLING', 'Sterling Insurance Company, Inc.', 'Sterling', 'Non-life'),
 ('STRONGHOLD', 'Stronghold Insurance Company, Inc.', 'Stronghold', 'Non-life'),
 ('TOKIOMARINE', 'Tokio Marine Malayan Insurance Corporation', 'Tokio Marine Malayan', 'Non-life'),
 ('TRAVELLERS', 'Travellers Insurance and Surety Corporation', 'Travellers', 'Non-life'),
 ('VISAYAN', 'Visayan Surety and Insurance Corporation', 'Visayan Surety', 'Non-life'),
 ('WESTERNGUAR', 'Western Guaranty Corporation', 'Western Guaranty', 'Non-life')
) AS v(code, name, short, licence)
WHERE NOT EXISTS (SELECT 1 FROM insurance_companies i WHERE lower(i.code) = lower(v.code) OR lower(i.name) = lower(v.name))
ON CONFLICT (code) DO NOTHING;
UPDATE insurance_companies SET attrs = jsonb_build_object('icLineOfBusiness', 'Non-life') || attrs
WHERE code IN ('MAPFRE', 'MALAYAN', 'PIONEER', 'FPG', 'STANDARD', 'MERCANTILE') AND NOT attrs ? 'icLineOfBusiness';
