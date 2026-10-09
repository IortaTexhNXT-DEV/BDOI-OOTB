/**
 * Approve and Reject of a record under maker-checker. The user who initiated the record sees both buttons disabled with
 * the reason next to them; any other user can decide. The server applies the same rule; this shows it before the click.
 *
 *   <ApprovalActions initiator={{ id: r.createdById, username: r.createdByUsername }}
 *     approveLabel={t("remittance.approveRemittance")} rejectLabel={t("remittance.rejectRemittance")}
 *     onApprove={approve} onReject={reject} />
 *
 * `useMakerChecker(initiator)` gives { blocked, reason } for screens that place their own buttons.
 */
import React, { useId } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { currentUser } from "../../utility/userIdentity";
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

const ApprovalActions = ({ initiator, onApprove, onReject, approveLabel, rejectLabel, disabled, busy, size, className }) => {
  const { t } = useTranslation();
  const reasonId = useId();
  const { blocked, reason } = useMakerChecker(initiator);
  const describedBy = blocked ? reasonId : undefined;
  return (
    <div className={["bv-approval-actions", className].filter(Boolean).join(" ")}>
      {blocked ? (
        <span id={reasonId} className="bv-approval-actions__reason">
          <i className="pi pi-lock" aria-hidden="true" />
          {reason}
        </span>
      ) : null}
      {onReject ? (
        <Button type="button" label={rejectLabel || t("makerChecker.reject")} severity="danger" outlined size={size} disabled={disabled || blocked || busy}
          aria-describedby={describedBy} onClick={onReject} />
      ) : null}
      {onApprove ? (
        <Button type="button" label={approveLabel || t("makerChecker.approve")} size={size} disabled={disabled || blocked} loading={busy}
          aria-describedby={describedBy} onClick={onApprove} />
      ) : null}
    </div>
  );
};

ApprovalActions.propTypes = {
  /** who initiated the record: { id, username } (or the id / user name alone) */
  initiator: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({ id: PropTypes.any, userId: PropTypes.any, username: PropTypes.string })]),
  onApprove: PropTypes.func,
  onReject: PropTypes.func,
  /** the action as a verb: "Approve remittance" */
  approveLabel: PropTypes.string,
  rejectLabel: PropTypes.string,
  disabled: PropTypes.bool,
  busy: PropTypes.bool,
  size: PropTypes.oneOf(["small", "large"]),
  className: PropTypes.string,
};

ApprovalActions.defaultProps = {
  initiator: null, onApprove: null, onReject: null, approveLabel: null, rejectLabel: null, disabled: false, busy: false, size: undefined, className: null,
};

export default ApprovalActions;
