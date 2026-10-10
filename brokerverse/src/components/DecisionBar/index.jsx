/**
 * Footer of an approval panel or record: Approve (primary), Reject (outlined danger) and the user's authority in one
 * line, "Your limit PHP 1,000,000.00 · This item PHP 409,141.43". When the server says the user cannot decide
 * (decision.canDecide false) the buttons are not shown at all; the EligibilityNote says why and who can. Native
 * buttons in reading order, so both are reached with Tab and pressed with Enter or Space. With canReject the note keeps
 * a Reject button: the server lets the user return what they may not approve (above their limit, changed since its
 * submission).
 *
 *   <DecisionBar decision={approval.decision} onApprove={approve} onReject={() => setRejecting(true)} />
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import EligibilityNote from "../EligibilityNote";
import { formatNumber } from "../../utility/currencyConverter";
import "./decisionBar.scss";

/** "PHP 409,141.43": the currency code, then the amount with two decimals and thousands separators. */
export const codeAmount = (value, currency = "PHP") => {
  const text = formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return text ? `${currency} ${text}` : "";
};

const DecisionBar = ({ decision, onApprove, onReject, approveLabel, rejectLabel, busy, currency, className, canReject }) => {
  const { t } = useTranslation();
  const d = decision || {};
  const classes = ["bv-decision-bar", className].filter(Boolean).join(" ");
  if (!d.canDecide) {
    return (
      <div className={`${classes} bv-decision-bar--note`}>
        <EligibilityNote reason={d.blockedReason} approvers={d.eligibleApprovers} />
        {canReject ? (
          <span className="bv-decision-bar__buttons">
            <Button type="button" label={rejectLabel || t("decisionBar.reject")} outlined severity="danger" onClick={onReject} disabled={!!busy} />
          </span>
        ) : null}
      </div>
    );
  }
  const limit = d.myLimit === null || d.myLimit === undefined ? t("decisionBar.noLimit") : t("decisionBar.yourLimit", { amount: codeAmount(d.myLimit, currency) });
  const item = d.amount === null || d.amount === undefined ? null : t("decisionBar.thisItem", { amount: codeAmount(d.amount, currency) });
  return (
    <div className={classes} role="group" aria-label={t("decisionBar.label")}>
      <span className="bv-decision-bar__authority">
        <span>{limit}</span>
        {item ? <span className="bv-decision-bar__item">{item}</span> : null}
      </span>
      <span className="bv-decision-bar__buttons">
        <Button type="button" label={rejectLabel || t("decisionBar.reject")} outlined severity="danger" onClick={onReject} disabled={!!busy} />
        <Button type="button" label={approveLabel || t("decisionBar.approve")} onClick={onApprove} loading={busy === "approve"} disabled={!!busy} />
      </span>
    </div>
  );
};

DecisionBar.propTypes = {
  /** the server's decision block: { canDecide, blockedCode, blockedReason, myLimit, amount, eligibleApprovers } */
  decision: PropTypes.shape({
    canDecide: PropTypes.bool,
    blockedCode: PropTypes.string,
    blockedReason: PropTypes.node,
    myLimit: PropTypes.number,
    amount: PropTypes.number,
    eligibleApprovers: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
  }),
  onApprove: PropTypes.func.isRequired,
  /** opens the ReasonDialog of the rejection */
  onReject: PropTypes.func.isRequired,
  approveLabel: PropTypes.string,
  rejectLabel: PropTypes.string,
  /** "approve" while the approval runs (any other truthy value: both buttons wait) */
  busy: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  currency: PropTypes.string,
  className: PropTypes.string,
  /** the user may reject although not approve (the reject action the server allows) */
  canReject: PropTypes.bool,
};

DecisionBar.defaultProps = { decision: null, approveLabel: null, rejectLabel: null, busy: false, currency: "PHP", className: null, canReject: false };

export default DecisionBar;
