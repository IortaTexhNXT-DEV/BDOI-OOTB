# Commission rates

The commission rules register (Master > Finance > Commission Rate Matrix, routes under `/commission-rates`): which
commission applies to a placement, by insurer, product, line of business, policy type, channel type, motor type and sum
insured band, on one of two bases (migration 0570; TIS-BRD-PROD-16, FR-CMR-001 to 009). Permissions: `read:commission-rules`
(and `read:masters` / `read:commission`), `write:commission-rules` (and `write:masters`), `approve:commission-rules`
(decisions on Configuration Approvals, never the maker).

## Files

| File | What it does |
|---|---|
| `router.js` | The routes: list and filters, options, `GET /resolve` (Test rate), the Excel template and upload, history, submit, withdraw, end, delete. |
| `service.js` | The rules: create, amend (an approved rule is amended as a new version with `replaces_id`), the overlap check on the keys and the sum insured band, submit and withdraw, end, `applyRuleDecision` (called by posting-rules on approve / reject: the new version comes in force and end-dates the one it replaces). `approvalRequired()` reads `commission.rules_approval_required`; off, a saved rule is approved at once. |
| `resolve.js` | `resolveCommissionRate({ insurerId, productId, lob, policyType, channelType, motorType, sumInsured, date, perPeril })`: the most specific approved rule in force on the date (SPECIFICITY levels: insurer + product + motor type first), then the insurer default rate and `commission.default_rate`. Per-peril (issuing / remitting) rules apply only with `perPeril: true`, which the Motor breakdown passes; every other caller sees net-premium rules only. `motorTypeOf(doc)` derives the motor type of a policy (`commission.motor_type_by_vehicle_type`). |
| `perils.js` | The perils of a Motor policy (OD, AON, BI, PD, APPA, RSA; CTPL is remitted in full) and `cleanPerilRates`: issuing, TIS remitting and insurer net rate per peril, 0 to 100 with 4 decimals, insurer net <= TIS remitting <= issuing (MSG-CMR-009 to 014). |
| `changes.js` | `submitRuleChange`: the Configuration Approvals change (kind `commission-rule`) of a submitted rule. |
| `upload.js` | The Excel template and the upload of rules (one row per peril; rows grouped by keys and dates; result per row). |
| `terms.js` | Credit terms of an insurer (unchanged). |

## Main tables

`commission_rates` (one row per rule version: keys, `rate_basis`, `rate`, `peril_rates` jsonb, `approval_status`
draft / pending / approved / returned / withdrawn, `version`, `replaces_id`, maker and approver fields, `upload_id`),
`accounting_config_changes` (kind `commission-rule`).

## Main flows

- Add or upload (draft) -> submit (pending; a change on Configuration Approvals) -> approve (in force from the effective
  date; the replaced version is end-dated the day before) or reject (returned to the maker, who amends and submits again).
  A pending rule is withdrawn by its maker. An approved rule is ended with an end date, never deleted.
- The go-live workbook (`data-load/configuration.js`, sheet Commission Rates) carries the net-premium rules only, keyed
  on insurer, product, line, policy type, channel, motor type, band and effective date, and writes them directly
  (`direct: true`); per-peril rules travel through the upload of this screen, which carries their peril rates.
- A Motor policy of the TISPH panel is booked on the per-peril rates (`commission.peril_based_motor`): see
  `../commission/breakdown.js`. Without a rule the policy is booked with status `rates-missing` and raised as a
  Rates missing exception by the remittance run.

## Key settings

`commission.rules_approval_required` (false; TISPH true), `commission.peril_based_motor` (false; TISPH true),
`commission.dual_rate_lines`, `commission.default_tis_remitting_rates`, `commission.peril_defaults`,
`commission.default_peril_commission_pct`, `commission.rules_max_rows` (upload), `commission.variance_channels`
(the channel types whose referrer shares the variance), `commission.variance_perils`, `commission.promo_variance_basis`,
`commission.motor_types`, `commission.motor_type_by_vehicle_type`.
