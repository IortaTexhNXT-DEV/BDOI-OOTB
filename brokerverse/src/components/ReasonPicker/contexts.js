/**
 * The contexts of the Reason Codes master (its Used For field): the decision a reason belongs to. The server checks a
 * reason code against the context of the action (backend ops-masters/records.js); the labels are reasonCodes.contexts.*.
 */
export const REASON_CONTEXTS = [
  "decline", "repudiation", "lapse", "refund", "adjustment", "non-materialise", "reassignment",
  "period_close", "period_reopen", "year_end_reverse", "year_end_cancel", "cas_print_void", "cas_document_change", "incentive_batch_reject", "incentive_adjustment",
  "sales_invoice_cancel", "invoice_payment_cancel", "access_change", "delegation", "delegation_end", "sod_exception", "access_review",
  "remittance_reject", "remittance_withdraw", "remittance_cancel", "remittance_revoke", "remittance_off_cycle", "remittance_line_exclude",
  "exception_escalate", "exception_resolve", "exception_reopen", "reconciliation_difference", "reconciliation_unmatch", "confirmation_difference",
  "payment_duplicate_override", "billing_reject", "billing_cancel", "pdc_cancel", "pdc_bounce", "receipt_reversal", "receipt_reversal_reject", "unapplied_refund",
  "feature_change", "feature_reject", "policy_suspend", "policy_reinstate",
  "commission_share_change", "commission_rate_change", "commission_reversal", "commission_wht_change", "scheme_end",
  "talkbot_line_remove", "talkbot_list_cancel",
  "policy_correction", "policy_correction_reject", "endorsement_reject", "promotion_return", "promotion_status", "discount_cap_return",
  "dealer_scheme_return", "dealer_scheme_status", "scheme_application_cancel", "lockin_renew", "lockin_hold", "lockin_release", "lockin_not_renewed", "lockin_end",
];

const words = (code) => {
  const text = String(code || "").replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Business label of a context ("period_close" -> "Period close, soft-close or lock"). */
export const reasonContextLabel = (t, context) => t(`reasonCodes.contexts.${context}`, { defaultValue: words(context) });
