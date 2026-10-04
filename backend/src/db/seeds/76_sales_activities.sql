-- Sales activities (migration 0320): the activity types and outcomes account executives choose when they log a call,
-- meeting, e-mail or visit (generic masters, maintained on Master > Organization > Sales Activity Types / Outcomes).
-- Reference data; idempotent: existing records and administrator edits are kept.
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('sales-activity-type', 'Sales Activity Type', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Activity Type","type":"string","required":true},{"name":"channel","label":"Channel","type":"select","required":true,"options":["call","meeting","email","visit","other"]},{"name":"followUpDays","label":"Default Days to Next Step","type":"integer","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 170, true, 'seed'),
 ('sales-activity-outcome', 'Sales Activity Outcome', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Outcome","type":"string","required":true},{"name":"result","label":"Result","type":"select","required":true,"options":["positive","neutral","negative"]},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 171, true, 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'sales-activity-type', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'channel', v.channel, 'followUpDays', v.days, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('CALL', 'Phone call', 'call', 3, 10),
             ('MEETING', 'Meeting at the office', 'meeting', 5, 20),
             ('VISIT', 'Client or site visit', 'visit', 5, 30),
             ('EMAIL', 'E-mail', 'email', 3, 40),
             ('VIRTUAL', 'Video call', 'meeting', 3, 50),
             ('MESSAGE', 'SMS or chat message', 'other', 2, 60),
             ('PRESENTATION', 'Proposal presentation', 'meeting', 7, 70)) AS v(code, name, channel, days, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'sales-activity-type' AND lower(m.code) = lower(v.code));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'sales-activity-outcome', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'result', v.result, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('INTERESTED', 'Interested, wants a quotation', 'positive', 10),
             ('DOCS_REQUESTED', 'Documents requested from the client', 'positive', 20),
             ('QUOTE_PRESENTED', 'Quotation presented', 'positive', 30),
             ('ACCEPTED', 'Client accepted the quotation', 'positive', 40),
             ('CALL_BACK', 'Asked to call back', 'neutral', 50),
             ('NO_ANSWER', 'No answer / not reachable', 'neutral', 60),
             ('NOT_INTERESTED', 'Not interested', 'negative', 70),
             ('LOST_TO_COMPETITOR', 'Placed with another broker or insurer', 'negative', 80)) AS v(code, name, result, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'sales-activity-outcome' AND lower(m.code) = lower(v.code));
