-- Lead sources and reason codes (generic masters, maintained on Master > Insurance Management > Lead Sources / Reason
-- Codes). A lead source is where a prospect came from (the Source of the prospect form and of the lead upload, a lead
-- assignment condition); a reason code is the coded reason of a decision that has no master of its own: a declined or
-- dropped quotation, a claim repudiation, a lapse, a refund, an adjustment, business that did not materialise.
-- Cancellations and write-offs keep their own masters (cancellation-reason, write-off-reason). The values are the
-- broker's (seed 83_tisph_lists.sql). Reference data; idempotent: existing types and administrator edits are kept.
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('lead-source', 'Lead Source', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Lead Source","type":"string","required":true},{"name":"channelType","label":"Channel Type","type":"string","required":false},{"name":"branchCode","label":"Linked Office (branch code)","type":"string","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 172, true, 'seed'),
 ('reason-code', 'Reason Code', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Reason","type":"string","required":true},{"name":"context","label":"Used For","type":"select","required":true,"options":["decline","repudiation","lapse","refund","adjustment","non-materialise"]},{"name":"requiresNote","label":"Requires Note","type":"boolean","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 173, true, 'seed')
ON CONFLICT (code) DO NOTHING;
