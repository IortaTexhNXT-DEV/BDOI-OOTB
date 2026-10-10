import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import accessControlService from "../../services/accessControlService";
import { useStableLoad } from "../../hooks/useStableLoad";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { confirmAction, notifyError, notifySuccess, promptText } from "../../utility/dialogs";
import { dateTime, useAccessNames, useLabels } from "./common";

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "all"];

/** "+2 −1": what a change adds and removes. */
export const changeCounts = (change) => `+${change.payload?.grant?.length || 0} −${change.payload?.revoke?.length || 0}`;

/** Approve, reject (remarks required) and withdraw a change of access, each asked first; `onDone` reloads. */
export const useChangeActions = (onDone) => {
  const k = useLabels();
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (id, action) => {
    setBusy(id);
    try {
      const r = await action();
      notifySuccess(r.message);
      await onDone?.();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setBusy(null);
    }
  }, [onDone]);
  const approve = useCallback(async (c, affected) => {
    const who = affected ? k("rolePermissions.approveAffects", " It applies at once to {{count}} active users.", { count: affected }) : "";
    if (!(await confirmAction(`${k("rolePermissions.approveConfirm", "Approve the change of the access of {{role}}?", { role: c.targetLabel })}${who}`,
      { header: k("rolePermissions.approveTitle", "Approve change {{ref}}", { ref: c.ref }), acceptLabel: k("approve", "Approve"), rejectLabel: k("cancel", "Cancel") }))) return;
    await run(c.id, () => accessControlService.decideAccessChange(c.id, "approve"));
  }, [k, run]);
  const reject = useCallback(async (c) => {
    const remarks = await promptText(k("rolePermissions.rejectReason", "Why is the change rejected? The requester sees this."), "",
      { header: k("rolePermissions.rejectTitle", "Reject change {{ref}}", { ref: c.ref }), acceptLabel: k("reject", "Reject"), rejectLabel: k("cancel", "Cancel") });
    if (remarks === null) return;
    if (!remarks) {
      notifyError(k("rolePermissions.rejectReasonRequired", "Give the reason for rejecting the change"));
      return;
    }
    await run(c.id, () => accessControlService.decideAccessChange(c.id, "reject", remarks));
  }, [k, run]);
  const withdraw = useCallback(async (c) => {
    if (!(await confirmAction(k("rolePermissions.withdrawConfirm", "Withdraw change {{ref}}? The access of {{role}} stays as it is.", { ref: c.ref, role: c.targetLabel }),
      { header: k("withdraw", "Withdraw"), acceptLabel: k("withdraw", "Withdraw"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    await run(c.id, () => accessControlService.withdrawAccessChange(c.id));
  }, [k, run]);
  return { approve, reject, withdraw, busy };
};

/**
 * The buttons a change offers to this user (the server says which): labelled buttons, or icon buttons with a tooltip
 * in a table row (`compact`).
 */
export const ChangeActions = ({ change, actions, affected, compact = false }) => {
  const k = useLabels();
  const busy = actions.busy === change.id;
  const props = (label, icon) => (compact ? { icon, text: true, rounded: true, "aria-label": label, tooltip: label, tooltipOptions: { position: "top" } } : { label, icon });
  return (
    <span className="rp-actions">
      {change.canDecide ? <Button {...props(k("approve", "Approve"), "pi pi-check")} loading={busy} onClick={() => actions.approve(change, affected)} /> : null}
      {change.canDecide ? <Button {...props(k("reject", "Reject"), "pi pi-times")} severity="danger" outlined={!compact} disabled={busy} onClick={() => actions.reject(change)} /> : null}
      {change.canWithdraw ? (
        <Button {...props(k("withdraw", "Withdraw"), compact ? "pi pi-undo" : undefined)} text disabled={busy} onClick={() => actions.withdraw(change)} />
      ) : null}
    </span>
  );
};

ChangeActions.propTypes = { change: PropTypes.object.isRequired, actions: PropTypes.object.isRequired, affected: PropTypes.number, compact: PropTypes.bool };

/**
 * "Accounts › Bank reconciliation › Approve" in the user's language (the code when it is unknown); without the area
 * when the lines are already grouped by area.
 */
export const accessLine = (idx, names, code, { area = true } = {}) => {
  const p = idx?.permission(code);
  if (!p) return code;
  return [area ? names.area(idx.area(p.area)) : null, names.module(idx.module(p.module)), names.level(p.level)].filter(Boolean).join(" › ");
};

/** What a change does, in business words: the lines added and removed, the reason, the segregation-of-duties warnings. */
export const ChangeDetails = ({ change, idx }) => {
  const k = useLabels();
  const names = useAccessNames();
  const warnings = change.payload?.warnings || [];
  const lines = idx ? [...(change.payload?.grant || []).map((c) => ["added", c]), ...(change.payload?.revoke || []).map((c) => ["removed", c])] : [];
  return (
    <div className="rp-change">
      <ul className="rp-change__lines">
        {lines.length ? lines.map(([kind, code]) => (
          <li key={code} className={`is-${kind}`}>
            <i className={`pi ${kind === "added" ? "pi-plus-circle" : "pi-minus-circle"}`} aria-hidden="true" />
            {kind === "added" ? k("rolePermissions.lineAdded", "Added: {{line}}", { line: accessLine(idx, names, code) })
              : k("rolePermissions.lineRemoved", "Removed: {{line}}", { line: accessLine(idx, names, code) })}
          </li>
        )) : change.summary.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <KeyValueGrid columns={3} className="rp-change__facts" items={[
        { label: k("rolePermissions.reason", "Reason"), value: change.payload?.reason || change.changeNote },
        { label: k("rolePermissions.requested", "Requested"), value: k("rolePermissions.requestedBy", "{{who}}, {{when}}", { who: change.requestedBy, when: dateTime(change.requestedAt) }) },
        { label: k("rolePermissions.decided", "Decided"), hidden: !change.decidedAt,
          value: `${k("rolePermissions.requestedBy", "{{who}}, {{when}}", { who: change.decidedBy, when: dateTime(change.decidedAt) })}${change.decisionRemarks ? ` · ${change.decisionRemarks}` : ""}` },
      ]} />
      {warnings.length ? (
        <div className="rp-change__sod">
          <h4>{k("rolePermissions.sodTitle", "Segregation of duties")}</h4>
          <ul>
            {warnings.map((w) => (
              <li key={w.code}>
                <strong>{w.name}</strong>
                {w.reason ? `: ${w.reason}` : ""}
                {w.users?.length ? ` (${w.users.join(", ")}${w.more ? ` +${w.more}` : ""})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

ChangeDetails.propTypes = { change: PropTypes.object.isRequired, idx: PropTypes.object };

/**
 * Tab "Waiting for approval": the changes of role access (all roles), pending by default or the history by status,
 * with what each adds and removes, the reason and the segregation-of-duties warnings. `focus` opens one change (a link
 * from a notification or My Work), whatever its status.
 */
const RoleAccessChanges = ({ idx, focus, technical, onOpenRole, onChanged }) => {
  const k = useLabels();
  const [status, setStatus] = useState("pending");
  const [expanded, setExpanded] = useState(focus ? { [focus]: true } : {});
  const loader = useCallback(() => accessControlService.accessChanges({ kind: "role-access", status: focus && status === "pending" ? "all" : status }), [status, focus]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { initialData: [] });
  const done = useCallback(async () => {
    await Promise.all([reload(), onChanged?.()]);
  }, [reload, onChanged]);
  const actions = useChangeActions(done);

  useEffect(() => {
    if (!focus) return;
    setExpanded({ [focus]: true });
    document.getElementById(`rp-change-${focus}`)?.scrollIntoView?.({ block: "center" });
  }, [focus, data]);

  const rows = focus && status === "pending" ? data.filter((c) => c.status === "pending" || c.id === focus) : data;
  const options = STATUSES.map((s) => ({ value: s, label: k(`rolePermissions.status.${s}`, { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn", all: "All" }[s]) }));

  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={refreshing} />
      <div className="rp-toolbar">
        <Dropdown value={status} options={options} onChange={(e) => setStatus(e.value)} aria-label={k("rolePermissions.colStatus", "Status")} />
      </div>
      {error ? (
        <div className="rp-error">
          <Message severity="error" text={error} />
          <Button label={k("rolePermissions.retry", "Try again")} text onClick={reload} />
        </div>
      ) : null}
      <DataTable value={rows} dataKey="id" loading={loading} size="small" expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)}
        rowExpansionTemplate={(c) => <ChangeDetails change={c} idx={idx} />} className="rp-table"
        emptyMessage={status === "pending" ? k("rolePermissions.noPending", "No access change is waiting for approval") : k("rolePermissions.noChanges", "No change of access")}>
        <Column expander style={{ width: "3rem" }} />
        <Column header={k("rolePermissions.colRequest", "Request")} body={(c) => <span id={`rp-change-${c.id}`} className="bv-nowrap">{c.ref}</span>} />
        <Column header={k("rolePermissions.colRole", "Role")} body={(c) => (
          <span className="rp-cell-stack">
            <button type="button" className="rp-linkbtn" onClick={() => onOpenRole(c.target, c.id)}>{c.targetLabel}</button>
            {technical ? <span className="rp-code">{c.target}</span> : null}
          </span>
        )} />
        <Column header={k("rolePermissions.colChanges", "Changes")} body={(c) => <span className="bv-nowrap" title={c.summary.join("\n")}>{changeCounts(c)}</span>} />
        <Column header={k("rolePermissions.reason", "Reason")} body={(c) => c.payload?.reason || c.changeNote || ""} />
        <Column header={k("rolePermissions.colSod", "Segregation of duties")} body={(c) => (c.payload?.warnings?.length
          ? <Tag value={k("rolePermissions.warnings", "{{count}} warnings", { count: c.payload.warnings.length })} severity="warning" /> : "—")} />
        <Column header={k("rolePermissions.colRequested", "Requested by")} body={(c) => (
          <span className="rp-cell-stack"><span>{c.requestedBy}</span><span className="rp-muted">{dateTime(c.requestedAt)}</span></span>
        )} />
        {status !== "pending" ? (
          <Column header={k("rolePermissions.colStatus", "Status")} body={(c) => <StatusChip code={c.status} label={options.find((o) => o.value === c.status)?.label || c.status} />} />
        ) : null}
        <Column header="" className="bv-actions" body={(c) => (c.status === "pending" ? <ChangeActions change={c} actions={actions} compact /> : null)} />
      </DataTable>
    </div>
  );
};

RoleAccessChanges.propTypes = {
  idx: PropTypes.object,
  focus: PropTypes.number,
  technical: PropTypes.bool,
  onOpenRole: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};

export default RoleAccessChanges;
