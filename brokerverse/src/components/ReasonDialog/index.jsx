/**
 * Confirmation of a decision that needs a coded reason: the shared ConfirmDialog (title with the verb, the facts the
 * decision applies to, the consequence, Cancel and the verb button) with a ReasonPicker of one context of the Reason
 * Codes master. The reason is required; the note becomes required when the chosen reason asks for one. The action
 * receives { reasonCode, note } and runs inside the dialog, which stays open with the server's message when it fails.
 *
 *   <ReasonDialog visible={open} onHide={() => setOpen(false)} context="remittance_cancel" severity="danger"
 *     title={cancelDraftTitle} facts={[{ label: refLabel, value: r.remittanceNo }]} note={policiesGoBack}
 *     confirmLabel={cancelDraftLabel} onConfirm={(reason) => service.cancel(r.id, reason)} />
 */
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import ConfirmDialog, { factShape } from "../ConfirmDialog/ConfirmDialog";
import ReasonPicker, { reasonPayload, reasonProblem } from "../ReasonPicker";
import "./reasonDialog.scss";

const ReasonDialog = ({ visible, onHide, context, title, severity, message, facts, note, confirmLabel, confirmIcon, onConfirm, reasonLabel, initialReason, className }) => {
  const [reason, setReason] = useState(initialReason);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(initialReason);
    setTried(false);
  }, [visible, initialReason]);

  const check = () => {
    setTried(true);
    return !reasonProblem(reason);
  };

  return (
    <ConfirmDialog visible={visible} onHide={onHide} title={title} severity={severity} message={message} facts={facts} note={note}
      confirmLabel={confirmLabel} confirmIcon={confirmIcon} beforeConfirm={check} onConfirm={() => onConfirm(reasonPayload(reason))}
      className={["bv-reason-dialog", className].filter(Boolean).join(" ")}>
      <ReasonPicker context={context} value={reason} onChange={setReason} label={reasonLabel} showErrors={tried} className="bv-reason-dialog__picker" />
    </ConfirmDialog>
  );
};

ReasonDialog.propTypes = {
  visible: PropTypes.bool,
  /** called once answered: { confirmed: true } after the action succeeded, { confirmed: false } when cancelled */
  onHide: PropTypes.func.isRequired,
  /** context of the Reason Codes master (remittance_cancel, remittance_off_cycle ...) */
  context: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]).isRequired,
  /** the decision as a verb phrase: "Cancel REM-2026-00021?" */
  title: PropTypes.node.isRequired,
  severity: PropTypes.oneOf(["neutral", "warning", "danger"]),
  message: PropTypes.node,
  /** reference, amount and what the decision applies to */
  facts: PropTypes.arrayOf(factShape),
  /** the consequence ("12 policies go back to the next run.") */
  note: PropTypes.node,
  /** the verb: "Cancel draft", "Withdraw to draft" */
  confirmLabel: PropTypes.string.isRequired,
  confirmIcon: PropTypes.string,
  /** runs the decision with { reasonCode, note }; a thrown error is shown in the dialog */
  onConfirm: PropTypes.func.isRequired,
  reasonLabel: PropTypes.string,
  /** a reason chosen beforehand ({ reasonCode, reasonLabel, note, noteRequired }), e.g. "Missed run" */
  initialReason: PropTypes.shape({ reasonCode: PropTypes.string, reasonLabel: PropTypes.string, note: PropTypes.string, noteRequired: PropTypes.bool }),
  className: PropTypes.string,
};

ReasonDialog.defaultProps = {
  visible: false,
  severity: "neutral",
  message: null,
  facts: [],
  note: null,
  confirmIcon: null,
  reasonLabel: null,
  initialReason: null,
  className: null,
};

export default ReasonDialog;
