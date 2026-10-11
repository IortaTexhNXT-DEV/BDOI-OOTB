# Commission

The commission TISPH pays to agents, sub-agents, external agents, TFS team members, referrals and dealers on the
policies they bring in (Commission > Commission Dashboard, Agents/Referrer Accounts, Sharing Schemes; routes under
`/commission`). Permissions: `read:commission`, `write:commission`, `approve:commission` (decides a line change
request, migration 0571), `write:commission-share` (changes the share of a line within the scheme limits),
`read:sharing-schemes`, `write:sharing-schemes`, `approve:sharing-schemes` (migration 0570).

## Files

| File | What it does |
|---|---|
| `router.js` | All routes: the dashboard, the referrer accounts and their lines (eligible, approve, pay, rate, reverse, WHT, requests, share), the breakdown and recompute of a policy, the sharing schemes. |
| `service.js` | The lines and their cycle on the business date: Accrued -> Eligible (premium fully paid; and the policy remitted when `commission.eligible_requires_remittance`) -> Approved (maker-checker, accrual journal) -> Paid (payment voucher). `lineAction` (direct changes; refused with DIRECT_CHANGE_OFF while `commission.adjustment_approval_required`), `requestLineChange` / `decideLineRequest` (rate, reversal, withholding tax under review), `changeShare`, `onPolicyPremiumCollected`, `onPoliciesRemitted`, `revertEligibility` (receipt reversed), `adjustForReturnPremium` (`commission.reverse_on_cancellation`). |
| `breakdown.js` | The commission basis of a policy (`computeBasis`, stored in `policies.details.commissionBasis` at issue): per peril the premium at the issuing rate less the premium at the TIS remitting rate (CTPL remitted in full), the variance share of the channel types in `commission.variance_channels`, the promo handling, the shares of the sharing scheme (capped per peril at the room between the issuing and the TIS remitting / insurer net rate) and what TISPH keeps; `rates-missing` for a Motor policy without a per-peril rule; `policyBreakdown` (the screen section) and `recomputeBasis` (refused once the policy is on an approved remittance; re-syncs the share lines and the draft remittance lines). |
| `schemes.js` | The sharing schemes: versions, submit / withdraw, decisions through Configuration Approvals (`applySchemeDecision`), suspend / resume / end with a reason, assignment to referrers and distribution channels with an override within the min / max of the scheme, `schemeFor` (the scheme of a policy), the daily job `commission-rules-schemes` (activate, supersede, end). |

## Main tables

`commissions` (the lines; `scheme_code`, `share_basis`, `share_value`, `share_min`, `share_max`), `commission_referrers`
(`scheme_code`, `scheme_override`, `pending_scheme`), `distribution_channels` (same), `commission_line_requests`
(kind rate / reversal / wht; pending / approved / rejected), `sharing_schemes`, `accounting_config_changes` (kinds
`sharing-scheme`, `scheme-assignment`).

## Main flows

- A policy issued through the placement computes its basis (`policies/service.js` -> `computeBasis`) and accrues the
  lines of its referrer and of its scheme (`accrueShares`). Premium collected in full makes the lines eligible, or, for
  TISPH, the approval of the remittance that carries the policy (`remittance/service.js onRemittanceApproved`).
- A change on a line: direct (`POST .../lines/:lineId/rate|reverse|wht`) or, under review, a request with a reason
  code of the contexts commission_rate_change / commission_reversal / commission_wht_change (seed
  `96_commission_reasons.sql`) decided by `approve:commission` other than the requester.
- A scheme: draft -> pending -> scheduled / active -> superseded or ended; the assignment of a referrer or channel is a
  change under review too. The share of a line is changed within the scheme limits with a reason (commission_share_change).

## Key settings

`commission.adjustment_approval_required` (false; TISPH true), `commission.eligible_requires_remittance` (false; TISPH
true), `commission.reverse_on_cancellation` (true; the CANC-03 proposal), `commission.max_chain_levels`,
`commission.share_change_reason_required`, `commission.variance_channels`, `commission.default_rate`.
