import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Tag } from "primereact/tag";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { addDays } from "./delegations";
import { useLabels } from "./common";

/**
 * Side panel to accept a conflict for one person until a date: the person, the rule and what is held together, the
 * reason (Reason Codes, context sod_exception; a compensating review names who reviews) and the last day (tomorrow at
 * the earliest, at most the longest exception). Another administrator, not the person concerned, approves it.
 */
const SodExceptionPanel = ({ conflict, asOf, maxDays = 365, approval = true, onHide, onDone }) => {
  const k = useLabels();
  const [validUntil, setValidUntil] = useState("");
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!conflict) return;
    setValidUntil("");
    setReason(null);
    setTried(false);
  }, [conflict]);

  const first = asOf ? addDays(asOf, 1) : undefined;
  const last = asOf ? addDays(asOf, maxDays) : undefined;
  let dateProblem = null;
  if (!validUntil) dateProblem = k("sod.untilRequired", "Enter the last day of the exception");
  else if (first && validUntil < first) dateProblem = k("sod.untilPast", "The exception must end after today");
  else if (last && validUntil > last) dateProblem = k("sod.untilTooLong", "An exception lasts at most {{days}} days", { days: maxDays });

  const submit = async () => {
    setTried(true);
    if (dateProblem || reasonProblem(reason)) return;
    setSaving(true);
    try {
      const r = await accessControlService.requestSodException({ ruleId: conflict.ruleId, userId: conflict.userId, validUntil, ...reasonPayload(reason) });
      notifySuccess(r.message);
      await onDone?.();
      onHide();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="am-panel__footer">
      <span />
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
        <Button label={approval ? k("submitForApproval", "Submit for approval") : k("save", "Save")} icon="pi pi-send" onClick={submit} loading={saving} />
      </span>
    </div>
  );

  return (
    <Dialog visible={!!conflict} onHide={onHide} modal className="am-panel access-form" style={{ width: "36rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{k("sod.requestException", "Request exception")}</span>
          {conflict ? <span className="am-panel__subtitle">{`${conflict.userName} · ${conflict.ruleName}`}</span> : null}
        </div>
      )}>
      {conflict ? (
        <div className="am-panel__body">
          <KeyValueGrid columns={2} items={[
            { key: "user", label: k("colUser", "User"), value: [conflict.userName, conflict.department].filter(Boolean).join(" · ") },
            { key: "rule", label: k("colRule", "Rule"), value: <span>{conflict.ruleName} <Tag value={conflict.action === "block" ? k("actionBlock", "Block") : k("actionWarn", "Warn")}
              severity={conflict.action === "block" ? "danger" : "warning"} /></span> },
            { key: "held", label: k("sod.rolesHeld", "Roles held"), value: conflict.heldTogether.join(" + "), span: "full" },
            { key: "risk", label: k("sod.risk", "Risk"), value: conflict.risk, hidden: !conflict.risk, span: "full" },
          ]} />
          <ReasonPicker context="sod_exception" value={reason} onChange={setReason} showErrors={tried} />
          <div className="admin__field">
            <label htmlFor="sod-until">{k("sod.validUntil", "Valid until")}</label>
            <DateField id="sod-until" value={validUntil} min={first} max={last} onChange={(e) => setValidUntil(e.target.value)} invalid={tried && !!dateProblem} />
            <FieldError error={tried ? dateProblem : null} />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
};

SodExceptionPanel.propTypes = {
  conflict: PropTypes.object, asOf: PropTypes.string, maxDays: PropTypes.number, approval: PropTypes.bool, onHide: PropTypes.func.isRequired, onDone: PropTypes.func,
};

export default SodExceptionPanel;
