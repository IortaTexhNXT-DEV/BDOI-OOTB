import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import service from "../../services/distributionService";
import systemSettingsService from "../../services/systemSettingsService";
import useMasterOptions from "../../agentModule/component/useMasterOptions";
import { Field } from "./common";

/** leads.reassignment_reason_required (System Settings, group leads); on until read. */
const useReasonRequired = () => {
  const [required, setRequired] = useState(true);
  useEffect(() => {
    let alive = true;
    systemSettingsService
      .getConfiguration("leads")
      .then((rows) => {
        const row = (rows || []).find((r) => r.key === "leads.reassignment_reason_required");
        if (alive && row) setRequired(String(row.value) !== "false");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return required;
};

/**
 * Assignee options grouped for the drop-down: first the account executives of the assignment rule that matches the
 * prospects (suggested), then every other active user who may own prospects.
 */
export const assigneeGroups = (assignees, t) => {
  const option = (a) => ({ value: a.id, label: a.name, branchCode: a.branchCode, designation: a.designation, open: a.open, rules: a.rules || [] });
  const suggested = assignees.filter((a) => a.suggested).map(option);
  const others = assignees.filter((a) => !a.suggested).map(option);
  return [
    ...(suggested.length ? [{ label: t("distribution.la.suggested", "Suggested by the assignment rules"), items: suggested }] : []),
    ...(others.length ? [{ label: suggested.length ? t("distribution.la.others", "Other account executives") : t("distribution.la.allAssignees", "Account executives"), items: others }] : []),
  ];
};

/**
 * Reassign prospects to an account executive, or send them to the reassignment queue (mode queue). The account
 * executive is chosen from the active users who may own prospects, those of the matching assignment rule first; the
 * reason from the Reason Codes master (context reassignment) with an optional note, or a note alone.
 */
const ReassignDialog = ({ leads, mode = "reassign", onHide, onDone, onError }) => {
  const { t } = useTranslation();
  const visible = Boolean(leads?.length);
  const reasons = useMasterOptions("reason-code", { filter: (r) => r.context === "reassignment" });
  const reasonRequired = useReasonRequired();
  const [assignees, setAssignees] = useState([]);
  const [toUserId, setToUserId] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const leadKey = (leads || []).map((l) => l.id).join(",");

  useEffect(() => {
    setToUserId(null);
    setReasonCode(null);
    setNote("");
    if (!leadKey || mode !== "reassign") return undefined;
    let alive = true;
    service.assignees(leadKey.split(",")).then((a) => alive && setAssignees(a)).catch(() => alive && setAssignees([]));
    return () => {
      alive = false;
    };
  }, [leadKey, mode]);

  const groups = useMemo(() => assigneeGroups(assignees, t), [assignees, t]);
  const owners = new Set((leads || []).map((l) => l.ownerUserId).filter(Boolean));
  const reason = reasons.find((r) => r.value === reasonCode)?.record;
  const noteRequired = ["true", "yes", "1"].includes(String(reason?.requiresNote).toLowerCase());
  const needsReason = mode === "queue" || reasonRequired;
  const problem = (mode === "reassign" && !toUserId && t("distribution.la.chooseAssignee", "Choose the account executive"))
    || (needsReason && !reasonCode && !note.trim() && t("distribution.la.chooseReason", "Choose the reason or enter a note"))
    || (noteRequired && !note.trim() && t("distribution.la.noteRequired", "This reason needs a note"))
    || null;
  const sameOwner = mode === "reassign" && toUserId && owners.size === 1 && owners.has(toUserId);

  const save = async () => {
    setSaving(true);
    try {
      const body = { leadIds: leads.map((l) => l.id), reasonCode: reasonCode || undefined, reason: note.trim() || undefined };
      const r = mode === "queue" ? await service.sendToQueue(body) : await service.reassign({ ...body, toUserId });
      onDone(r);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const assigneeItem = (o) => (
    <div className="la-assignee">
      <span>{o.label}</span>
      <small className="pe-muted">
        {[o.designation, o.branchCode, t("distribution.la.openCount", "{{count}} open", { count: o.open ?? 0 })].filter(Boolean).join(" · ")}
      </small>
    </div>
  );
  const title = mode === "queue"
    ? t("distribution.la.queueTitle", "Send {{count}} prospect(s) to the queue", { count: leads?.length || 0 })
    : t("distribution.la.reassignTitle", "Reassign {{count}} prospect(s)", { count: leads?.length || 0 });
  const names = (leads || []).slice(0, 5).map((l) => `${l.leadNumber} ${l.name || ""}`.trim()).join(", ");

  return (
    <Dialog className="pe-dialog" header={title} visible={visible} style={{ width: "min(560px, 96vw)" }} onHide={onHide}
      footer={(
        <div>
          <Button label={t("distribution.common.cancel", "Cancel")} text onClick={onHide} />
          <Button label={mode === "queue" ? t("distribution.la.toQueue", "Send to queue") : t("distribution.la.reassign", "Reassign")}
            icon={mode === "queue" ? "pi pi-inbox" : "pi pi-check"} onClick={save} disabled={Boolean(problem)} loading={saving} />
        </div>
      )}>
      {visible && (
        <div className="dist-grid">
          <p className="pe-muted m-0 dist-field--full">
            {names}{leads.length > 5 ? ` ${t("distribution.la.andMore", "and {{count}} more", { count: leads.length - 5 })}` : ""}
          </p>
          {mode === "reassign" && (
            <Field label={`${t("distribution.la.to", "To account executive")} *`} full htmlFor="la-reassign-to"
              help={groups.length > 1 || assignees.some((a) => a.suggested) ? t("distribution.la.suggestedHelp", "The account executives of the assignment rule for these prospects come first") : null}>
              <Dropdown inputId="la-reassign-to" value={toUserId} options={groups} optionGroupLabel="label" optionGroupChildren="items" itemTemplate={assigneeItem}
                filter filterBy="label,branchCode,designation" placeholder={t("distribution.la.chooseAssignee", "Choose the account executive")}
                emptyMessage={t("distribution.la.noAssignee", "No active user can own prospects")} onChange={(e) => setToUserId(e.value)} />
            </Field>
          )}
          {sameOwner && <Message severity="warn" className="dist-field--full" text={t("distribution.la.sameOwner", "The prospect already belongs to this account executive")} />}
          <Field label={`${t("distribution.la.reason", "Reason")}${needsReason ? " *" : ""}`} full htmlFor="la-reason">
            <Dropdown inputId="la-reason" value={reasonCode} options={reasons} showClear filter={reasons.length > 10}
              placeholder={t("distribution.la.chooseReasonCode", "Choose the reason")} emptyMessage={t("distribution.la.noReasons", "No reassignment reason in Master > Reason Codes")}
              onChange={(e) => setReasonCode(e.value || null)} />
          </Field>
          <Field label={`${t("distribution.la.note", "Note")}${noteRequired ? " *" : ""}`} full htmlFor="la-note">
            <InputTextarea id="la-note" rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
              placeholder={t("distribution.la.notePlaceholder", "Details for the history (optional unless the reason asks for it)")} />
          </Field>
          {problem && <small className="pe-muted dist-field--full">{problem}</small>}
        </div>
      )}
    </Dialog>
  );
};

ReassignDialog.propTypes = {
  /** the prospects (rows of the team view or the queue); the dialog is open while there are some */
  leads: PropTypes.arrayOf(PropTypes.object),
  mode: PropTypes.oneOf(["reassign", "queue"]),
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

export default ReassignDialog;
