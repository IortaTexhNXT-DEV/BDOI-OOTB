import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { confirmAction, notifyError, notifySuccess, promptText } from "../../utility/dialogs";
import { limitValue } from "./authorityFormat";
import { dateTime, shortDate, useLabels } from "./common";

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "all"];
const STATUS_SEVERITY = { pending: "warning", approved: "success", rejected: "danger", withdrawn: null };

/**
 * Approve, reject (reason required) and withdraw a change of the matrix (a configuration change, CFG-n) or a proposal
 * of the API (AL-n), each asked first; `onDone` reloads. `item`: { source: "change" | "limit", changeId | limitId, ref }.
 */
export const useAuthorityActions = (onDone) => {
  const k = useLabels();
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (item, action) => {
    setBusy(item.ref);
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
  const isChange = (item) => item.source === "change";
  const approve = useCallback(async (item, what) => {
    if (!(await confirmAction(k("authority.approveConfirm", "Approve {{what}}? It applies from its effective date.", { what }),
      { header: k("authority.approveTitle", "Approve {{ref}}", { ref: item.ref }), acceptLabel: k("approve", "Approve"), rejectLabel: k("cancel", "Cancel") }))) return;
    await run(item, () => (isChange(item) ? accessControlService.decideAccessChange(item.changeId, "approve") : accessControlService.decideLimit(item.limitId, "approve")));
  }, [k, run]);
  const reject = useCallback(async (item) => {
    const reason = await promptText(k("authority.rejectReason", "Why is it rejected? The requester sees this."), "",
      { header: k("authority.rejectTitle", "Reject {{ref}}", { ref: item.ref }), acceptLabel: k("reject", "Reject"), rejectLabel: k("cancel", "Cancel") });
    if (reason === null) return;
    if (!reason) {
      notifyError(k("authority.rejectReasonRequired", "Give the reason for rejecting it"));
      return;
    }
    await run(item, () => (isChange(item) ? accessControlService.decideAccessChange(item.changeId, "reject", reason) : accessControlService.decideLimit(item.limitId, "reject", reason)));
  }, [k, run]);
  const withdraw = useCallback(async (item) => {
    if (!(await confirmAction(k("authority.withdrawConfirm", "Withdraw {{ref}}? The limits stay as they are.", { ref: item.ref }),
      { header: k("withdraw", "Withdraw"), acceptLabel: k("withdraw", "Withdraw"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    await run(item, () => (isChange(item) ? accessControlService.withdrawAccessChange(item.changeId) : accessControlService.withdrawLimit(item.limitId)));
  }, [k, run]);
  return { approve, reject, withdraw, busy };
};

/**
 * The buttons a waiting change offers to this user: Approve and Reject to an approver who did not propose it (a
 * disabled Approve with the reason to the proposer who may approve), Withdraw to the proposer or an approver.
 */
export const PendingActions = ({ item, title, onDone, compact = false, actions: shared }) => {
  const k = useLabels();
  const own = useAuthorityActions(onDone);
  const actions = shared || own;
  const busy = actions.busy === item.ref;
  const props = (label, icon) => (compact ? { icon, text: true, rounded: true, "aria-label": label, tooltip: label, tooltipOptions: { position: "top" } } : { label, icon });
  return (
    <span className="rp-actions">
      {item.canDecide ? <Button {...props(k("approve", "Approve"), "pi pi-check")} loading={busy} onClick={() => actions.approve(item, title || item.ref)} /> : null}
      {item.canDecide ? <Button {...props(k("reject", "Reject"), "pi pi-times")} severity="danger" outlined={!compact} disabled={busy} onClick={() => actions.reject(item)} /> : null}
      {item.canWithdraw ? <Button {...props(k("withdraw", "Withdraw"), compact ? "pi pi-undo" : undefined)} text disabled={busy} onClick={() => actions.withdraw(item)} /> : null}
    </span>
  );
};

PendingActions.propTypes = { item: PropTypes.object.isRequired, title: PropTypes.string, onDone: PropTypes.func, compact: PropTypes.bool, actions: PropTypes.object };

/** The proposals of the API waiting for approval (AL-n), from the matrix and the personal limits, as rows of the tab. */
export const legacyRows = (data) => {
  const out = [];
  const add = (who, cell, transactionName, measure) => {
    const p = cell?.pending;
    if (!p || p.source !== "limit") return;
    out.push({ ...p, key: p.ref, status: "pending", title: `${transactionName} · ${who}`,
      lines: [{ transactionName, who, measure, before: { set: cell.set, maxAmount: cell.maxAmount, unlimited: cell.unlimited }, maxAmount: p.maxAmount, unlimited: p.unlimited,
        removes: false, effectiveFrom: p.effectiveFrom, referenceNo: p.referenceNo }] });
  };
  for (const row of data?.rows || []) for (const role of data.roles || []) add(role.name, row.cells[role.code], row.name, row.measure);
  for (const p of data?.userLimits || []) add(p.userName, p, p.transactionName, p.measure);
  return out;
};

const changeRow = (c) => ({ source: "change", changeId: c.id, ref: c.ref, key: c.ref, status: c.status, title: c.targetLabel, lines: c.payload?.lines || [],
  file: c.payload?.file || null, remarks: c.changeNote, requestedBy: c.requestedBy, requestedAt: c.requestedAt, decidedBy: c.decidedBy, decidedAt: c.decidedAt,
  decisionRemarks: c.decisionRemarks, canDecide: c.canDecide, canWithdraw: c.canWithdraw });

/** The lines of a change: transaction, role or person, in effect when proposed, proposed value, effective date, reference. */
export const ChangeLines = ({ lines }) => {
  const k = useLabels();
  const noLimit = k("noLimit", "No limit");
  const value = (l) => (l.removes ? k("authority.removal", "Remove the limit") : limitValue(l.measure, l.maxAmount, l.unlimited, noLimit));
  const was = (l) => (l.before?.set ? limitValue(l.measure, l.before.maxAmount, l.before.unlimited, noLimit) : k("notSet", "Not set"));
  return (
    <DataTable value={lines.map((l, i) => ({ ...l, lineKey: i }))} dataKey="lineKey" size="small" className="rp-table am-lines" scrollable scrollHeight="24rem">
      <Column header={k("colTransaction", "Transaction")} body={(l) => l.transactionName} />
      <Column header={k("authority.roleOrPerson", "Role or person")} body={(l) => l.who} />
      <Column header={k("authority.inEffect", "In effect")} body={(l) => <span className="am-num rp-muted">{was(l)}</span>} />
      <Column header={k("authority.proposed", "Proposed")} body={(l) => <strong className="am-num">{value(l)}</strong>} />
      <Column header={k("authority.effectiveFrom", "Effective from")} body={(l) => shortDate(l.effectiveFrom)} />
      <Column header={k("authority.reference", "Authority reference")} body={(l) => l.referenceNo || "—"} />
    </DataTable>
  );
};

ChangeLines.propTypes = { lines: PropTypes.arrayOf(PropTypes.object).isRequired };

/**
 * Tab "Pending approval": the changes of the matrix waiting for approval (or their history by status), each with its
 * lines, and the proposals of the API. `focus` opens one change (a link from a notification or My Work).
 */
const AuthorityPendingTab = ({ data, focus, onChanged }) => {
  const k = useLabels();
  const [status, setStatus] = useState("pending");
  const [expanded, setExpanded] = useState(focus ? { [`CFG-${focus}`]: true } : {});
  const loader = useCallback(() => accessControlService.accessChanges({ kind: "authority-limits", status: focus && status === "pending" ? "all" : status }), [status, focus]);
  const { data: list, loading, refreshing, error, reload } = useStableLoad(loader, { initialData: [] });
  const done = useCallback(async () => {
    await Promise.all([reload(), onChanged?.()]);
  }, [reload, onChanged]);
  const actions = useAuthorityActions(done);

  useEffect(() => {
    if (!focus) return;
    setExpanded({ [`CFG-${focus}`]: true });
    document.getElementById(`am-change-${focus}`)?.scrollIntoView?.({ block: "center" });
  }, [focus, list]);

  const rows = useMemo(() => {
    const changes = list.map(changeRow).filter((c) => !(focus && status === "pending") || c.status === "pending" || c.changeId === focus);
    return status === "pending" ? [...changes, ...legacyRows(data)] : changes;
  }, [list, data, status, focus]);
  const options = STATUSES.map((s) => ({ value: s, label: k(`rolePermissions.status.${s}`, { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn", all: "All" }[s]) }));

  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={refreshing} />
      <div className="rp-toolbar rp-toolbar--wrap">
        <Dropdown value={status} options={options} onChange={(e) => setStatus(e.value)} aria-label={k("colStatus", "Status")} />
      </div>
      {error ? (
        <div className="rp-error">
          <Message severity="error" text={error} />
          <Button label={k("rolePermissions.retry", "Try again")} text onClick={reload} />
        </div>
      ) : null}
      <DataTable value={rows} dataKey="key" loading={loading} size="small" expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)} className="rp-table"
        rowExpansionTemplate={(r) => (
          <div className="am-expansion">
            <ChangeLines lines={r.lines} />
            {r.decisionRemarks ? <p className="rp-muted">{k("authority.decisionNote", "Decision: {{note}}", { note: r.decisionRemarks })}</p> : null}
          </div>
        )}
        emptyMessage={status === "pending" ? k("authority.noPending", "No change of the Authority Matrix is waiting for approval") : k("authority.noChanges", "No change")}>
        <Column expander style={{ width: "3rem" }} />
        <Column header={k("authority.colChange", "Change")} body={(r) => (
          <span className="rp-cell-stack">
            <span id={r.changeId ? `am-change-${r.changeId}` : undefined} className="bv-nowrap">{r.ref}</span>
            {r.file ? <span className="rp-muted"><i className="pi pi-file-excel mr-1" aria-hidden="true" />{k("authority.upload", "Upload")}</span> : null}
          </span>
        )} />
        <Column header={k("authority.colWhat", "What")} body={(r) => (
          <span className="rp-cell-stack">
            <span>{r.title}</span>
            {r.lines.length > 1 ? <span className="rp-muted">{k("authority.limitsCount", "{{count}} limits", { count: r.lines.length })}</span> : null}
          </span>
        )} />
        <Column header={k("authority.reference", "Authority reference")} body={(r) => [...new Set(r.lines.map((l) => l.referenceNo).filter(Boolean))].join(", ") || "—"} />
        <Column header={k("colRemarks", "Remarks")} body={(r) => r.remarks || "—"} />
        <Column header={k("authority.proposedBy", "Proposed by")} body={(r) => (
          <span className="rp-cell-stack"><span>{r.requestedBy}</span><span className="rp-muted">{dateTime(r.requestedAt)}</span></span>
        )} />
        {status !== "pending" ? (
          <Column header={k("colStatus", "Status")} body={(r) => <Tag value={options.find((o) => o.value === r.status)?.label || r.status} severity={STATUS_SEVERITY[r.status]} />} />
        ) : null}
        <Column header="" className="bv-actions" body={(r) => (r.status === "pending" ? (
          <span className="rp-actions">
            {!r.canDecide && r.canWithdraw && data?.abilities?.approve ? (
              <span className="am-own" title={k("authority.ownChange", "You proposed this change; another administrator approves it")}>
                <Button icon="pi pi-check" text rounded disabled aria-label={k("authority.ownChange", "You proposed this change; another administrator approves it")} />
              </span>
            ) : null}
            <PendingActions item={r} title={r.title} actions={actions} compact />
          </span>
        ) : null)} />
      </DataTable>
    </div>
  );
};

AuthorityPendingTab.propTypes = { data: PropTypes.object, focus: PropTypes.number, onChanged: PropTypes.func };

export default AuthorityPendingTab;
