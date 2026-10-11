import React from "react";
import { useTranslation } from "react-i18next";
import ReasonPicker, { reasonProblem } from "../../../components/ReasonPicker";

/** Payee types of a refund to the insured client (Client is the API spelling of Customer). */
export const REFUND_PAYEES = ["Customer", "Client"];

/** The payee type code of the Create Voucher form (an option object or its code). */
export const payeeCodeOf = (payeeType) => (typeof payeeType === "object" && payeeType ? payeeType.code : payeeType);

/**
 * What is missing in the refund reason of a voucher (GAP-CASH-17): a refund to a customer needs a reason of the refund
 * context (e.g. REF-CANCEL, with its note); other payees have none. Returns the translation key of the error or null.
 */
export const refundReasonError = (values) => {
  if (!REFUND_PAYEES.includes(payeeCodeOf(values?.PayeeType))) return null;
  const problem = reasonProblem(values?.RefundReason);
  if (!problem) return null;
  return problem === "note" ? "paymentVoucher.refundNoteRequired" : "paymentVoucher.refundReasonRequired";
};

/** The refund reason picker of Create Voucher, shown for a Customer payee only. */
const RefundReason = ({ payeeType, value, onChange, showErrors = false }) => {
  const { t } = useTranslation();
  if (!REFUND_PAYEES.includes(payeeCodeOf(payeeType))) return null;
  return <ReasonPicker context="refund" label={t("paymentVoucher.refundReason")} value={value} onChange={onChange} showErrors={showErrors} />;
};

export default RefundReason;
