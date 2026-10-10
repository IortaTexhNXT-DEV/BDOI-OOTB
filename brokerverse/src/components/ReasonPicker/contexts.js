/**
 * The contexts of the Reason Codes master (its Used For field): the decision a reason belongs to. The server checks a
 * reason code against the context of the action (backend ops-masters/records.js); the labels are reasonCodes.contexts.*.
 */
export const REASON_CONTEXTS = [
  "decline", "repudiation", "lapse", "refund", "adjustment", "non-materialise", "reassignment",
  "period_close", "period_reopen", "year_end_reverse", "year_end_cancel", "cas_print_void", "cas_document_change", "incentive_batch_reject", "incentive_adjustment",
  "sales_invoice_cancel", "invoice_payment_cancel",
];

const words = (code) => {
  const text = String(code || "").replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Business label of a context ("period_close" -> "Period close, soft-close or lock"). */
export const reasonContextLabel = (t, context) => t(`reasonCodes.contexts.${context}`, { defaultValue: words(context) });
