import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { SelectButton } from "primereact/selectbutton";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { OUTCOMES, OUTCOME_WORDS, decisionProblems, effectiveOutcome } from "./accessReviews";
import { ConflictChip, dateTime, useLabels } from "./common";

const EMPTY = { outcome: null, removeRoles: [], note: "" };

/**
 * Side panel to decide one user of a review: the facts (roles at the start and now, department, last sign-in,
 * conflicts), the outcome (Keep access, Remove roles with the roles to remove, Deactivate account), the reason of a
 * removal (Reason Codes, context access_review) or the note to keep a dormant user or one with an open conflict.
 * Save, or Save and next (the next user still to review). A line this user may not decide shows why.
 */
const ReviewDecisionPanel = ({ review, item, onHide, onSaved }) => {
  const k = useLabels();
  const [form, setForm] = useState(EMPTY);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    const decided = item.decision !== "pending";
    setForm({ outcome: decided ? item.decision : null, removeRoles: item.removeRoles || [], note: item.decision === "keep" ? item.remarks || "" : "" });
    setReason(null);
    setTried(false);
  }, [item]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const removal = form.outcome === "remove-roles" || form.outcome === "deactivate";
  const problems = item ? decisionProblems(form, item, { reasonMissing: !!reasonProblem(reason) }) : {};
  const outcome = item ? effectiveOutcome(form, item) : null;
  const words = (o) => k(`review.outcome.${o}`, OUTCOME_WORDS[o]);
  const blocked = item?.blocked;

  const save = async (next) => {
    setTried(true);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const body = { outcome: form.outcome, removeRoles: form.outcome === "remove-roles" ? form.removeRoles : undefined,
        ...(removal ? reasonPayload(reason) : { note: form.note.trim() || undefined }) };
      const r = await accessControlService.decideReviewItem(review.id, item.id, body);
      notifySuccess(r.message);
      await onSaved(r.data, next ? item.id : null);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = item?.canDecide ? (
    <div className="am-panel__footer">
      <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
      <span className="rp-actions">
        <Button label={k("save", "Save")} outlined onClick={() => save(false)} loading={saving} />
        <Button label={k("review.saveNext", "Save and next")} icon="pi pi-arrow-right" iconPos="right" onClick={() => save(true)} disabled={saving} />
      </span>
    </div>
  ) : <Button label={k("authority.close", "Close")} text onClick={onHide} />;
  const blockedText = {
    own: k("review.blockedOwn", "You cannot review your own access."),
    admin: k("review.blockedAdmin", "An administrator account is decided by a System Administrator."),
  }[blocked];

  return (
    <Dialog visible={!!item} onHide={onHide} modal className="am-panel access-form" style={{ width: "36rem" }} footer={footer}
      header={(
        <div className="am-panel__title">
          <span>{item?.displayName}</span>
          {item ? <span className="am-panel__subtitle">{[item.username, item.designation, item.department].filter(Boolean).join(" · ")}</span> : null}
        </div>
      )}>
      {item ? (
        <div className="am-panel__body">
          {blockedText ? <Message severity="info" text={blockedText} /> : null}
          {item.appliedAt ? <Message severity="success" text={k("review.appliedOn", "Applied by {{name}} on {{date}}", { name: item.appliedBy, date: dateTime(item.appliedAt) })} /> : null}
          <KeyValueGrid columns={2} items={[
            { key: "start", label: k("review.rolesAtStart", "Roles at start"), value: item.roleNamesAtStart.join(", ") || "—", span: "full" },
            { key: "now", label: k("review.rolesNow", "Roles now"), value: item.roleNamesNow.join(", ") || "—", span: "full", hidden: !item.rolesChanged },
            { key: "signin", label: k("colLastSignIn", "Last sign-in"),
              value: `${item.lastLoginAt ? dateTime(item.lastLoginAt) : k("never", "Never")}${item.dormant ? ` · ${k("dormantFor", "Dormant {{days}} days", { days: item.daysSinceLogin })}` : ""}` },
            { key: "branch", label: k("colBranch", "Branch"), value: item.branchName || item.branch },
            { key: "sod", label: k("colSod", "Segregation of duties"), span: "full",
              value: item.conflicts.length ? <span className="access-chips">{item.conflicts.map((c) => <ConflictChip key={c.ruleName} conflict={{ ...c, name: c.ruleName }} />)}</span>
                : k("uam.noConflicts", "No conflict") },
          ]} />
          {item.canDecide ? (
            <>
              <div className="admin__field">
                <span className="bv-field-label">{k("review.colOutcome", "Outcome")}</span>
                <SelectButton value={form.outcome} options={OUTCOMES.map((o) => ({ value: o, label: words(o), disabled: o === "deactivate" && item.builtIn }))}
                  onChange={(e) => e.value && set({ outcome: e.value })} />
                <FieldError error={tried && problems.outcome ? k("review.chooseOutcome", "Choose the outcome") : null} />
              </div>
              {form.outcome === "remove-roles" ? (
                <fieldset className="access-checklist">
                  <legend>{k("review.rolesToRemove", "Roles to remove")}</legend>
                  {item.rolesNow.map((code, i) => (
                    <div key={code} className="access-checklist__item">
                      <Checkbox inputId={`rv-role-${code}`} checked={form.removeRoles.includes(code)}
                        onChange={(e) => set({ removeRoles: e.checked ? [...form.removeRoles, code] : form.removeRoles.filter((x) => x !== code) })} />
                      <label htmlFor={`rv-role-${code}`}>{item.roleNamesNow[i]}</label>
                    </div>
                  ))}
                  <FieldError error={tried && problems.removeRoles ? k("review.chooseRoles", "Choose the roles to remove") : null} />
                  {outcome === "deactivate" ? <span className="rp-muted">{k("review.allRoles", "Removing every role deactivates the account")}</span> : null}
                </fieldset>
              ) : null}
              {removal ? <ReasonPicker context="access_review" value={reason} onChange={setReason} showErrors={tried} /> : null}
              {form.outcome === "keep" ? (
                <div className="admin__field">
                  <label htmlFor="rv-note">
                    {k("review.keepNote", "Why is this access kept?")}
                    {item.needsNote ? <span className="required-marker">*</span> : <span className="rp-muted"> {k("authority.optional", "(optional)")}</span>}
                  </label>
                  <InputTextarea id="rv-note" rows={2} autoResize maxLength={1000} value={form.note} onChange={(e) => set({ note: e.target.value })}
                    className={tried && problems.note ? "p-invalid" : ""} />
                  <FieldError error={tried && problems.note ? k("review.noteRequired", "This user is dormant or has a conflict: say why the access is kept") : null} />
                </div>
              ) : null}
            </>
          ) : (
            <KeyValueGrid columns={1} items={[
              { key: "outcome", label: k("review.colOutcome", "Outcome"), value: words(item.decision) },
              { key: "removed", label: k("review.rolesToRemove", "Roles to remove"), value: item.removeRoleNames.join(", "), hidden: !item.removeRoleNames.length },
              { key: "remarks", label: k("colReason", "Reason"), value: item.remarks, hidden: !item.remarks },
              { key: "by", label: k("review.decidedBy", "Decided by"), value: item.decidedBy ? `${item.decidedBy} · ${dateTime(item.decidedAt)}` : null, hidden: !item.decidedBy },
            ]} />
          )}
        </div>
      ) : null}
    </Dialog>
  );
};

ReviewDecisionPanel.propTypes = { review: PropTypes.object, item: PropTypes.object, onHide: PropTypes.func.isRequired, onSaved: PropTypes.func.isRequired };

export default ReviewDecisionPanel;
