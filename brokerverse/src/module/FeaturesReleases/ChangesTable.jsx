import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import RowActions from "../../components/RowActions";
import { openConfirm } from "../../components/ConfirmDialog";
import { formatDate } from "../../utility/dateFormat";

const CHANGE_SEVERITY = { pending: "warning", scheduled: "info", applied: "success", rejected: "danger", withdrawn: "secondary" };

/** The signed-in user's id (stored at sign-in), to tell one's own requests. */
export const currentUserId = () => {
  try {
    return localStorage.getItem("USER_ID");
  } catch {
    return null;
  }
};

/**
 * Feature change requests with their approval (Features & Releases of the platform and of TISPH): approve and reject
 * (never one's own request), withdraw one's own pending request or a scheduled change. `decide` and `withdraw` are the
 * calls of the screen (platform or tenant); `actionable(row)` says which rows the viewer may act on (the tenant acts on
 * the changes of the tenant only); `ownRequestText` explains why the requester cannot approve.
 */
const ChangesTable = ({ changes, decide, withdraw, actionable = () => true, onChanged, notify, ownRequestText, testId = "feature-changes" }) => {
  const { t } = useTranslation();
  const myId = currentUserId();

  const onDecide = async (row, decision) => {
    const facts = [
      { label: t("features.changes.ref"), value: row.ref },
      { label: t("features.changes.action"), value: t(`features.changes.actions.${row.action}`) },
      { label: t("features.changes.features"), value: row.plan.map((p) => p.name).join(", ") },
      { label: t("features.change.releaseRef"), value: row.releaseRef },
      { label: t("features.changes.effective"), value: row.immediate ? t("features.change.immediate") : formatDate(row.effectiveAt) },
    ];
    const value = await openConfirm({
      title: t(`features.changes.${decision}Title`, { ref: row.ref }), severity: decision === "approve" ? "info" : "danger", facts,
      confirmLabel: t(`features.changes.${decision}`),
      ...(decision === "reject" ? { reason: { context: "feature_reject" } } : {}),
    });
    if (!value) return;
    try {
      const r = await decide(row.id, { decision, ...(decision === "reject" ? value : {}) });
      notify("success", r.message);
      await onChanged({ applied: decision === "approve" });
    } catch (e) {
      notify("error", e.message);
    }
  };

  const onWithdraw = async (row) => {
    if (!(await openConfirm({ title: t("features.changes.withdrawTitle", { ref: row.ref }), confirmLabel: t("features.changes.withdraw"), severity: "warning" }))) return;
    try {
      const r = await withdraw(row.id);
      notify("success", r.message);
      await onChanged({ applied: false });
    } catch (e) {
      notify("error", e.message);
    }
  };

  const actionsOf = (row) => {
    if (!actionable(row)) return [];
    const mine = row.requestedBy === myId;
    return [
      row.status === "pending" && !mine ? { code: "approve", label: t("features.changes.approve"), allowed: true } : null,
      row.status === "pending" && !mine ? { code: "reject", label: t("features.changes.reject"), allowed: true } : null,
      row.status === "pending" && mine ? { code: "approve", label: t("features.changes.approve"), allowed: false, blockedReason: ownRequestText } : null,
      (row.status === "pending" && mine) || row.status === "scheduled" ? { code: "withdraw", label: t("features.changes.withdraw"), allowed: true } : null,
    ].filter(Boolean);
  };
  const onAction = (action, row) => (action.code === "withdraw" ? onWithdraw(row) : onDecide(row, action.code));

  return (
    <div className="bv-loading-host">
      <LoadingBar active={changes.refreshing} />
      <DataTable value={changes.data || []} dataKey="id" size="small" stripedRows loading={changes.loading} emptyMessage={changes.error || t("features.changes.empty")}
        className="fr-table" data-testid={testId}>
        <Column field="ref" header={t("features.changes.ref")} />
        <Column header={t("features.changes.action")} body={(r) => (r.tier ? t(`features.change.${r.action}Tier`, { tier: t(`features.tiers.${r.tier}`) }) : t(`features.changes.actions.${r.action}`))} />
        <Column header={t("features.changes.features")} body={(r) => r.plan.map((p) => p.name).join(", ")} style={{ maxWidth: "20rem" }} />
        <Column field="reason" header={t("features.changes.reason")} />
        <Column field="releaseRef" header={t("features.change.releaseRef")} />
        <Column header={t("features.changes.effective")} body={(r) => (r.immediate ? t("features.change.immediate") : formatDate(r.effectiveAt))} />
        <Column header={t("features.changes.raisedBy")} body={(r) => t(`features.changes.channels.${r.channel || "platform"}`)} />
        <Column header={t("features.changes.requestedBy")} body={(r) => `${r.requestedByName || "-"} · ${formatDate(r.requestedAt)}`} />
        <Column header={t("features.changes.decidedBy")} body={(r) => (r.decidedByName ? `${r.decidedByName} · ${formatDate(r.decidedAt)}` : "-")} />
        <Column header={t("features.columns.status")} body={(r) => <StatusChip code={r.status} label={t(`features.changes.status.${r.status}`)} severity={CHANGE_SEVERITY[r.status]} />} />
        <Column header="" body={(r) => (actionsOf(r).length ? (
          <RowActions label={t("features.changes.actionsFor", { ref: r.ref })} actions={actionsOf(r)} onAction={(action) => onAction(action, r)} />
        ) : null)} />
      </DataTable>
    </div>
  );
};

ChangesTable.propTypes = {
  changes: PropTypes.shape({ data: PropTypes.array, loading: PropTypes.bool, refreshing: PropTypes.bool, error: PropTypes.string }).isRequired,
  decide: PropTypes.func.isRequired,
  withdraw: PropTypes.func.isRequired,
  actionable: PropTypes.func,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
  ownRequestText: PropTypes.string.isRequired,
  testId: PropTypes.string,
};

export default ChangesTable;
