-- Remarks on the placement moves and the cancellation of a placement slip the insurer holds (TIS-BRD-ISSUE-04,
-- FR-SIS-024 pattern).
--
--   placement.remarks_required   the acknowledgement carries the insurer's reference or a remark, a declined line its
--                                reason, a cancellation its reason
--   placement.cancel_approval    once sent to the insurer, a placement slip is cancelled only by a user holding
--                                approve:policies who did not raise it, and each insurer holding it is told
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('placement.remarks_required', 'true', 'placement', 'Acknowledgement, declined line and cancellation of a placement slip carry a reference or remark', 'boolean'),
 ('placement.cancel_approval', 'true', 'placement', 'A placement slip sent to the insurer is cancelled only by an approver, and the insurer is told', 'boolean'),
 ('email.template.placement_cancelled', $j${"subject":"Placement slip {{placementNumber}} - cancelled - {{insuredName}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>Please cancel our firm order <b>{{placementNumber}}</b> ({{insuredName}}, {{productType}}, period {{period}}). Reason: {{reason}}.</p><p>No cover is to be issued under this placement slip.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: placement slip cancelled, to the insurers holding it', 'json')
ON CONFLICT (key) DO NOTHING;
