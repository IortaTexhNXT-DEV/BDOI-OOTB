import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import FieldError from "../../components/FieldError";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { useStableLoad } from "../../hooks/useStableLoad";
import incentiveService from "../../services/incentiveService";
import { readableError } from "../../utility/apiError";
import { formatCurrency } from "../../utility/currencyConverter";
import { formatDate } from "../../utility/dateFormat";

/** Policy incentive statuses of the Policies tab (FRS COMM-08 5.4). */
export const POLICY_STATUSES = ["Counted", "Excluded", "Waiting for commission", "Not fully paid", "Cancelled", "Recovery", "Disqualified", "Not eligible", "Not a call-out lead"];

/**
 * Policies tab of a telesales batch (FR-TSI-011, 020 to 022, 035, 036): every policy considered with NB / renewal, the
 * fully paid, commission settled and eligible dates, the net commission and the status, filtered by caller and status.
 * While the batch is Calculated or Rejected a counted policy is excluded with a reason (incentive_exclude) and its
 * remark, and an excluded one is included again; the caller's line is recalculated.
 */
const TelesalesPolicies = ({ batch, editable, onChanged }) => {
  const { t } = useTranslation();
  const [callerId, setCallerId] = useState(null);
  const [status, setStatus] = useState(null);
  const [excluding, setExcluding] = useState(null);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const loader = useCallback(() => incentiveService.batchPolicies(batch.batchId, { callerId: callerId || undefined, status: status || undefined }), [batch.batchId, callerId, status]);
  const { data, reload } = useStableLoad(loader, { enabled: true });
  const callers = (batch.details || []).map((d) => ({ value: d.agentId, label: d.agentName }));

  const close = () => {
    setExcluding(null);
    setReason(null);
    setTried(false);
    setError(null);
  };
  const exclude = async () => {
    setTried(true);
    if (reasonProblem(reason) || !reason?.note) {
      setError(t("incentive.telesales.excludeNeedsRemark"));
      return;
    }
    setBusy(true);
    try {
      const r = await incentiveService.excludePolicy(batch.batchId, excluding.policyId, reasonPayload(reason));
      close();
      await reload();
      onChanged(r.message || t("incentive.telesales.excluded"));
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };
  const include = async (row) => {
    try {
      const r = await incentiveService.includePolicy(batch.batchId, row.policyId);
      await reload();
      onChanged(r.message);
    } catch (e) {
      onChanged(readableError(e?.message) || t("confirmDialog.failed"));
    }
  };

  return (
    <>
      <div className="inc-filters">
        <Dropdown value={callerId} options={callers} onChange={(e) => setCallerId(e.value)} showClear placeholder={t("incentive.telesales.allCallers")} aria-label={t("incentive.telesales.caller")} />
        <Dropdown value={status} options={POLICY_STATUSES.map((s) => ({ value: s, label: t(`incentive.telesales.status.${s}`, s) }))} onChange={(e) => setStatus(e.value)} showClear
          placeholder={t("incentive.telesales.allStatuses")} aria-label={t("incentive.telesales.statusLabel")} />
      </div>
      <DataTable value={data || []} dataKey="id" size="small" paginator rows={20} emptyMessage={t("incentive.batch.noResults")} scrollable className="inc-table">
        <Column header={t("incentive.telesales.caller")} field="caller" />
        <Column header={t("incentive.telesales.policyNo")} field="policyNumber" />
        <Column header={t("incentive.telesales.kind")} body={(r) => (r.kind === "Renewal" ? t("incentive.telesales.renewal") : t("incentive.telesales.nb"))} />
        <Column header={t("incentive.telesales.fullyPaid")} body={(r) => (r.fullyPaidOn ? formatDate(r.fullyPaidOn) : t("incentive.telesales.partial"))} />
        <Column header={t("incentive.telesales.settled")} body={(r) => (r.commissionSettledOn ? formatDate(r.commissionSettledOn) : t("incentive.telesales.pending"))} />
        <Column header={t("incentive.telesales.eligibleOn")} body={(r) => (r.eligibleOn ? formatDate(r.eligibleOn) : "-")} />
        <Column header={t("incentive.telesales.netCommission")} body={(r) => (r.netCommission === null ? "-" : formatCurrency(r.netCommission))} className="inc-num" headerClassName="inc-num" />
        <Column header={t("incentive.telesales.statusLabel")} body={(r) => (<span>{t(`incentive.telesales.status.${r.status}`, r.status)}{r.detail ? <span className="inc-muted"> {r.detail}</span> : null}</span>)} />
        {editable ? (
          <Column header={t("incentive.batch.actions")} body={(r) => {
            if (["Counted", "Disqualified"].includes(r.status)) return <Button type="button" label={t("incentive.telesales.exclude")} text size="small" onClick={() => setExcluding(r)} />;
            if (r.status === "Excluded") return <Button type="button" label={t("incentive.telesales.include")} text size="small" onClick={() => include(r)} />;
            return null;
          }} />
        ) : null}
      </DataTable>
      <Dialog visible={!!excluding} onHide={close} header={t("incentive.telesales.excludeTitle", { policy: excluding?.policyNumber })} modal draggable={false} resizable={false}
        className="bv-centered" style={{ width: "34rem" }} breakpoints={{ "640px": "100vw" }}
        footer={(
          <>
            <Button type="button" label={t("common.cancel")} outlined onClick={close} disabled={busy} />
            <Button type="button" label={t("incentive.telesales.exclude")} severity="danger" onClick={exclude} loading={busy} />
          </>
        )}>
        <ReasonPicker context="incentive_exclude" value={reason} onChange={setReason} showErrors={tried} autoFocus />
        {error ? <FieldError error={error} /> : null}
      </Dialog>
    </>
  );
};

TelesalesPolicies.propTypes = {
  batch: PropTypes.shape({ batchId: PropTypes.string.isRequired, details: PropTypes.array }).isRequired,
  editable: PropTypes.bool,
  onChanged: PropTypes.func.isRequired,
};
TelesalesPolicies.defaultProps = { editable: false };

export default TelesalesPolicies;
