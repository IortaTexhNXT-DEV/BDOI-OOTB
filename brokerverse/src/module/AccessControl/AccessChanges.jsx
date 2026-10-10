import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { SelectButton } from "primereact/selectbutton";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { confirmAction, notifyError, notifySuccess, promptText } from "../../utility/dialogs";
import { EmptyState, LoadError, TwoLines, dateTime, severityOf, useLabels } from "./common";

/**
 * Approve, reject (remarks required, the requester sees them) and withdraw a change of access waiting for approval,
 * each asked first; `onDone` reloads what changed. `words` names the actions in the confirmations as the buttons do
 * ({ approve: "Sign off", reject: "Return" }).
 */
export const useChangeActions = (onDone, words = {}) => {
  const k = useLabels();
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (change, action) => {
    setBusy(change.id);
    try {
      const r = await action();
      notifySuccess(r.message);
      await onDone?.(change);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setBusy(null);
    }
  }, [onDone]);
  const approveWord = words.approve || k("approve", "Approve");
  const rejectWord = words.reject || k("reject", "Reject");
  const approve = useCallback(async (change) => {
    if (!(await confirmAction(k("changes.actionConfirm", "{{action}} {{ref}}? {{what}}", { action: approveWord, ref: change.ref, what: change.summary?.[0] || change.targetLabel }),
      { header: `${approveWord} ${change.ref}`, acceptLabel: approveWord, rejectLabel: k("cancel", "Cancel") }))) return;
    await run(change, () => accessControlService.decideAccessChange(change.id, "approve"));
  }, [k, run, approveWord]);
  const reject = useCallback(async (change) => {
    const remarks = await promptText(k("changes.rejectReason", "Why is it rejected? The requester sees this."), "",
      { header: `${rejectWord} ${change.ref}`, acceptLabel: rejectWord, rejectLabel: k("cancel", "Cancel") });
    if (remarks === null) return;
    if (!remarks) {
      notifyError(k("changes.rejectRequired", "Give the reason for rejecting it"));
      return;
    }
    await run(change, () => accessControlService.decideAccessChange(change.id, "reject", remarks));
  }, [k, run, rejectWord]);
  const withdraw = useCallback(async (change) => {
    if (!(await confirmAction(k("changes.withdrawConfirm", "Withdraw {{ref}}? Nothing is changed.", { ref: change.ref }),
      { header: k("withdraw", "Withdraw"), acceptLabel: k("withdraw", "Withdraw"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    await run(change, () => accessControlService.withdrawAccessChange(change.id));
  }, [k, run]);
  return { approve, reject, withdraw, busy };
};

/** The buttons a waiting change offers to this user (server flags canDecide / canWithdraw). */
export const ChangeActions = ({ change, actions, compact = false, approveLabel, rejectLabel }) => {
  const k = useLabels();
  if (change.status !== "pending") return null;
  const busy = actions.busy === change.id;
  const props = (label, icon) => (compact ? { icon, text: true, rounded: true, "aria-label": label, tooltip: label, tooltipOptions: { position: "top" } } : { label, icon });
  return (
    <span className="rp-actions">
      {change.canDecide ? <Button {...props(approveLabel || k("approve", "Approve"), "pi pi-check")} loading={busy} onClick={() => actions.approve(change)} /> : null}
      {change.canDecide ? <Button {...props(rejectLabel || k("reject", "Reject"), "pi pi-times")} severity="danger" outlined={!compact} disabled={busy} onClick={() => actions.reject(change)} /> : null}
      {change.canWithdraw ? <Button {...props(k("withdraw", "Withdraw"), compact ? "pi pi-undo" : undefined)} text disabled={busy} onClick={() => actions.withdraw(change)} /> : null}
    </span>
  );
};

ChangeActions.propTypes = { change: PropTypes.object.isRequired, actions: PropTypes.object.isRequired, compact: PropTypes.bool, approveLabel: PropTypes.string, rejectLabel: PropTypes.string };

/**
 * The block of a record waiting for approval: who asked and when, the change in business words, and the actions
 * this user may take, or "Waiting for another administrator".
 */
export const PendingBlock = ({ change, onDone, title, approveLabel, rejectLabel }) => {
  const k = useLabels();
  const actions = useChangeActions(onDone, { approve: approveLabel, reject: rejectLabel });
  return (
    <section className="access-pending" aria-label={k("changes.waiting", "Waiting for approval")}>
      <div className="access-pending__head">
        <i className="pi pi-clock" aria-hidden="true" />
        <strong>{title || k("changes.waiting", "Waiting for approval")}</strong>
        <span className="rp-muted">{change.ref}</span>
      </div>
      <ul className="access-pending__lines">
        {(change.summary || []).map((line) => <li key={line}>{line}</li>)}
      </ul>
      <span className="rp-muted">{k("changes.requestedBy", "Requested by {{name}} on {{date}}", { name: change.requestedBy || "", date: dateTime(change.requestedAt) })}</span>
      <ChangeActions change={change} actions={actions} approveLabel={approveLabel} rejectLabel={rejectLabel} />
      {!change.canDecide && !change.canWithdraw ? <span className="rp-muted">{k("changes.waitingOther", "Waiting for another administrator")}</span> : null}
    </section>
  );
};

PendingBlock.propTypes = { change: PropTypes.object.isRequired, onDone: PropTypes.func, title: PropTypes.string, approveLabel: PropTypes.string, rejectLabel: PropTypes.string };

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "all"];

/**
 * The changes of access of some kinds (comma separated) waiting for approval, or their history by status, each with
 * its summary and actions. `focus` (a change id from the address) shows that change whatever its status.
 */
const AccessChanges = ({ kinds, focus = null, onChanged, emptyText }) => {
  const k = useLabels();
  const [status, setStatus] = useState("pending");
  const loader = useCallback(() => accessControlService.accessChanges({ kind: kinds, status: focus && status === "pending" ? "all" : status }), [kinds, status, focus]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { initialData: [] });
  const done = useCallback(async () => {
    await Promise.all([reload(), onChanged?.()]);
  }, [reload, onChanged]);
  const actions = useChangeActions(done);
  const rows = useMemo(() => data.filter((c) => !(focus && status === "pending") || c.status === "pending" || c.id === focus), [data, focus, status]);
  const words = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, k(`rolePermissions.status.${s}`, { pending: "Waiting for approval", approved: "Approved",
    rejected: "Rejected", withdrawn: "Withdrawn", all: "All" }[s])])), [k]);

  useEffect(() => {
    if (focus) document.getElementById(`access-change-${focus}`)?.scrollIntoView?.({ block: "center" });
  }, [focus, data]);

  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={refreshing} />
      <div className="rp-toolbar rp-toolbar--wrap">
        <SelectButton value={status} options={STATUSES.map((s) => ({ value: s, label: words[s] }))} onChange={(e) => e.value && setStatus(e.value)}
          aria-label={k("colStatus", "Status")} />
      </div>
      <LoadError error={error} onRetry={reload} />
      <DataTable value={rows} dataKey="id" loading={loading && !data.length} size="small" className="rp-table" rowClassName={(c) => (c.id === focus ? "access-row--focus" : "")}
        emptyMessage={<EmptyState icon="pi pi-check-circle" text={status === "pending" ? emptyText || k("changes.noneWaiting", "Nothing is waiting for approval") : k("changes.none", "No change")} />}>
        <Column header={k("changes.colRequest", "Request")} body={(c) => <span id={`access-change-${c.id}`} className="bv-nowrap">{c.ref}</span>} style={{ width: "7rem" }} />
        <Column header={k("changes.colWhat", "What")} body={(c) => <TwoLines main={c.targetLabel} sub={c.kindLabel} />} />
        <Column header={k("changes.colChange", "Change")} body={(c) => (
          <ul className="access-lines">{(c.summary || []).map((line) => <li key={line}>{line}</li>)}</ul>
        )} />
        <Column header={k("changes.colRequested", "Requested by")} body={(c) => <TwoLines main={c.requestedBy} sub={dateTime(c.requestedAt)} />} />
        {status !== "pending" ? (
          <Column header={k("colStatus", "Status")} body={(c) => (
            <TwoLines main={<StatusChip code={c.status} severity={severityOf(c.status)} label={words[c.status] || c.status} />}
              sub={[c.decidedBy ? `${c.decidedBy} · ${dateTime(c.decidedAt)}` : null, c.decisionRemarks].filter(Boolean).join(" · ") || null} />
          )} />
        ) : null}
        <Column header="" className="bv-actions" body={(c) => <ChangeActions change={c} actions={actions} compact />} />
      </DataTable>
    </div>
  );
};

AccessChanges.propTypes = { kinds: PropTypes.string.isRequired, focus: PropTypes.number, onChanged: PropTypes.func, emptyText: PropTypes.string };

export default AccessChanges;
