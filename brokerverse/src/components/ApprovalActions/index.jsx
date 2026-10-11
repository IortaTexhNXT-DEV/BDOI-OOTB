/**
 * Approve and Reject of a record awaiting a decision, in one of two forms:
 *
 * - Maker-checker (`initiator`): the user who initiated the record sees both buttons disabled with the reason next to
 *   them; any other user can decide. The server applies the same rule; this shows it before the click.
 *
 *     <ApprovalActions initiator={{ id: r.createdById, username: r.createdByUsername }}
 *       approveLabel={approveLabel} rejectLabel={rejectLabel} onApprove={approve} onReject={reject} />
 *
 * - The server's decision (`decision`, the decision block of an approval): Approve (primary), Reject (outlined danger)
 *   and the user's authority in one line, "Your limit PHP 1,000,000.00 · This item PHP 409,141.43". When the server
 *   says the user cannot decide (decision.canDecide false) the buttons are not shown at all; the EligibilityNote says
 *   why and who can. With canReject the note keeps a Reject button: the server lets the user return what they may not
 *   approve (above their limit, changed since its submission).
 *
 *     <ApprovalActions decision={approval.decision} onApprove={approve} onReject={() => setRejecting(true)} />
 *
 * Native buttons in reading order, so both are reached with Tab and pressed with Enter or Space.
 * `useMakerChecker(initiator)` gives { blocked, reason } for screens that place their own buttons.
 */
import React, { useId } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import EligibilityNote from "../EligibilityNote";
import { currentUser } from "../../utility/userIdentity";
import { codeAmount } from "../../utility/currencyConverter";
import "./approvalActions.scss";

const keysOf = (who) => {
  const list = who && typeof who === "object" ? [who.id, who.userId, who.username] : [who];
  return list.filter((v) => v !== null && v !== undefined && v !== "").map((v) => String(v).trim().toLowerCase());
};

/** Whether `user` (the signed-in user by default) initiated the record: same user id or user name. */
export const isInitiator = (initiator, user = currentUser()) => {
  const theirs = keysOf(initiator);
  const mine = keysOf({ userId: user?.userId, username: user?.username });
  return theirs.some((k) => mine.includes(k));
};

/** { blocked, reason } of the signed-in user for a record initiated by `initiator`. */
export const useMakerChecker = (initiator) => {
  const { t } = useTranslation();
  const blocked = isInitiator(initiator);
  return { blocked, reason: blocked ? t("makerChecker.ownRecord") : null };
};

const MakerChecker = ({ initiator, onApprove, onReject, approveLabel, rejectLabel, disabled, busy, size, className }) => {
  const { t } = useTranslation();
  const reasonId = useId();
  const { blocked, reason } = useMakerChecker(initiator);
  const describedBy = blocked ? reasonId : undefined;
  return (
    <div className={["bv-approval-actions", className].filter(Boolean).join(" ")}>
      {blocked ? <EligibilityNote id={reasonId} reason={reason} className="bv-approval-actions__reason" /> : null}
      {onReject ? (
        <Button type="button" label={rejectLabel || t("makerChecker.reject")} severity="danger" outlined size={size} disabled={disabled || blocked || !!busy}
          aria-describedby={describedBy} onClick={onReject} />
      ) : null}
      {onApprove ? (
        <Button type="button" label={approveLabel || t("makerChecker.approve")} size={size} disabled={disabled || blocked} loading={!!busy}
          aria-describedby={describedBy} onClick={onApprove} />
      ) : null}
    </div>
  );
};

const ServerDecision = ({ decision, onApprove, onReject, approveLabel, rejectLabel, busy, currency, className, canReject }) => {
  const { t } = useTranslation();
  const classes = ["bv-decision-bar", className].filter(Boolean).join(" ");
  const reject = (
    <Button type="button" label={rejectLabel || t("makerChecker.reject")} outlined severity="danger" onClick={onReject} disabled={!!busy} />
  );
  if (!decision.canDecide) {
    return (
      <div className={`${classes} bv-decision-bar--note`}>
        <EligibilityNote reason={decision.blockedReason} approvers={decision.eligibleApprovers} />
        {canReject && onReject ? <span className="bv-decision-bar__buttons">{reject}</span> : null}
      </div>
    );
  }
  const limit = decision.myLimit === null || decision.myLimit === undefined
    ? t("decisionBar.noLimit") : t("decisionBar.yourLimit", { amount: codeAmount(decision.myLimit, currency) });
  const item = decision.amount === null || decision.amount === undefined ? null : t("decisionBar.thisItem", { amount: codeAmount(decision.amount, currency) });
  return (
    <div className={classes} role="group" aria-label={t("decisionBar.label")}>
      <span className="bv-decision-bar__authority">
        <span>{limit}</span>
        {item ? <span className="bv-decision-bar__item">{item}</span> : null}
      </span>
      <span className="bv-decision-bar__buttons">
        {onReject ? reject : null}
        {onApprove ? (
          <Button type="button" label={approveLabel || t("makerChecker.approve")} onClick={onApprove} loading={busy === "approve"} disabled={!!busy} />
        ) : null}
      </span>
    </div>
  );
};

const ApprovalActions = ({ decision, initiator, canReject, currency, ...props }) => (decision
  ? <ServerDecision decision={decision} canReject={canReject} currency={currency} {...props} />
  : <MakerChecker initiator={initiator} {...props} />);

ApprovalActions.propTypes = {
  /** who initiated the record: { id, username } (or the id / user name alone) */
  initiator: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({ id: PropTypes.any, userId: PropTypes.any, username: PropTypes.string })]),
  /** the server's decision block: { canDecide, blockedCode, blockedReason, myLimit, amount, eligibleApprovers } */
  decision: PropTypes.shape({
    canDecide: PropTypes.bool,
    blockedCode: PropTypes.string,
    blockedReason: PropTypes.node,
    myLimit: PropTypes.number,
    amount: PropTypes.number,
    eligibleApprovers: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
  }),
  /** with `decision`: the user may reject although not approve (the reject action the server allows) */
  canReject: PropTypes.bool,
  /** with `decision`: the currency of the limit and the amount */
  currency: PropTypes.string,
  onApprove: PropTypes.func,
  /** rejects, or opens the confirmation with the reason of the rejection */
  onReject: PropTypes.func,
  /** the action as a verb: "Approve remittance" */
  approveLabel: PropTypes.string,
  rejectLabel: PropTypes.string,
  disabled: PropTypes.bool,
  /** true while the decision runs; with `decision`, "approve" while the approval runs (any other truthy value: both wait) */
  busy: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  size: PropTypes.oneOf(["small", "large"]),
  className: PropTypes.string,
};

ApprovalActions.defaultProps = {
  initiator: null, decision: null, canReject: false, currency: "PHP", onApprove: null, onReject: null, approveLabel: null, rejectLabel: null,
  disabled: false, busy: false, size: undefined, className: null,
};

export default ApprovalActions;
