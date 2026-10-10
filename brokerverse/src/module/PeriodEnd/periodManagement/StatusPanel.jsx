import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Skeleton } from "primereact/skeleton";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import periodEndService from "../../../services/periodEndService";
import { canOpen } from "../../../utils/canOpen";
import { readableError } from "../../../utility/apiError";
import { date, money } from "../common";

/** The status move of each action of the panel. */
export const ACTION_STATUS = { softClose: "soft_closed", close: "closed", reopen: "open" };

const CHECK_SEVERITY = { passed: "success", failed: "danger", warning: "warning", "not-applicable": "secondary" };

/** Screen that clears a failed check (shown when the user's menu reaches it). */
export const RESOLVE_PATHS = {
  unposted_journals: "/accounts/journalvoucher",
  trial_balance: "/accounts/period-end/statements",
  suspense_balance: "/accounts/period-end/statements",
  unapplied_receipts: "/accounts/receipts",
  unreconciled_bank: "/accounts/bank-reconciliation",
};
const resolvePath = (code) => RESOLVE_PATHS[code] || "/accounts/period-end/close";

/**
 * Side panel of a period status change (soft-close, close, reopen). On opening it asks the server whether the move is
 * allowed and runs the blocking month-end checks (read-only preview); the action button stays disabled while a check
 * fails or the move is not allowed. The reason comes from the Reason Codes master (period_close or period_reopen).
 */
const StatusPanel = ({ request, onHide, onDone }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const period = request?.period;
  const to = request ? ACTION_STATUS[request.action] : null;

  const check = useCallback(async () => {
    if (!period || !to) return;
    setChecking(true);
    setPreviewError(null);
    try {
      setPreview(await periodEndService.statusPreview(period.period, to));
    } catch (e) {
      setPreviewError(readableError(e.message));
    } finally {
      setChecking(false);
    }
  }, [period, to]);

  useEffect(() => {
    setPreview(null);
    setReason(null);
    setTried(false);
    setError(null);
    check();
  }, [check]);

  const confirm = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    setBusy(true);
    setError(null);
    try {
      await periodEndService.setPeriodStatus(period.period, to, reasonPayload(reason));
      onDone(request);
    } catch (e) {
      setError(readableError(e.message));
      check();
    } finally {
      setBusy(false);
    }
  };

  if (!request) return null;
  const actionLabel = t(`periodManagement.action.${request.action}`);
  const context = to === "open" ? "period_reopen" : "period_close";
  const blocked = preview && !preview.allowed;
  const notAllowed = preview?.reason && preview.reason !== "checks"
    ? t(`periodManagement.notAllowed.${preview.reason}`, { defaultValue: preview.message || "" })
    : null;
  const checks = preview?.checks || [];

  const footer = (
    <div className="pm-panel__footer">
      {notAllowed && <span className="pm-panel__blocked" role="status"><i className="pi pi-lock" aria-hidden="true" /> {notAllowed}</span>}
      {preview?.reason === "checks" && <span className="pm-panel__blocked" role="status"><i className="pi pi-exclamation-circle" aria-hidden="true" /> {t("periodManagement.notAllowed.checks")}</span>}
      <Button type="button" label={t("periodEnd.cancel")} text onClick={onHide} disabled={busy} />
      <Button type="button" label={actionLabel} icon={to === "open" ? "pi pi-lock-open" : "pi pi-lock"} loading={busy}
        severity={to === "open" ? "warning" : undefined} onClick={confirm} disabled={!preview || checking || blocked || busy} />
    </div>
  );

  return (
    <Dialog className="pe-dialog pm-panel" visible onHide={onHide} footer={footer} style={{ width: "min(560px, 96vw)" }} draggable={false}
      header={t("periodManagement.panelTitle", { action: actionLabel, period: period.period })}>
      <KeyValueGrid columns={2} items={[
        { label: t("periodEnd.period"), value: period.isAdjustment ? `${period.period} (${t("periodEnd.adjustment")})` : period.period },
        { label: t("periodManagement.dates"), value: `${date(period.startDate)} – ${date(period.endDate)}` },
        { label: t("periodManagement.currentStatus"), value: <StatusChip code={period.status} label={t(`periodEnd.status.${period.status}`)} /> },
        { label: t("periodManagement.newStatus"), value: <StatusChip code={to} label={t(`periodEnd.status.${to}`)} /> },
      ]} />

      {to !== "open" && (
        <section className="pm-panel__section" aria-label={t("periodManagement.blockingChecks")}>
          <div className="pm-panel__section-title">
            <span>{t("periodManagement.blockingChecks")}</span>
            <Button type="button" icon="pi pi-refresh" text rounded size="small" onClick={check} disabled={checking}
              aria-label={t("periodManagement.recheck")} tooltip={t("periodManagement.recheck")} tooltipOptions={{ position: "left" }} />
          </div>
          {!preview && checking ? (
            <div className="pm-panel__skeleton">{[0, 1, 2].map((i) => <Skeleton key={i} height="1.75rem" />)}</div>
          ) : (
            <DataTable value={checks} dataKey="code" size="small" emptyMessage={notAllowed || t("periodManagement.noBlockingChecks")}>
              <Column field="label" header={t("periodManagement.check")} />
              <Column header={t("periodEnd.result")} style={{ width: "8rem" }}
                body={(c) => <StatusChip code={c.status} label={t(`periodEnd.status.${c.status}`)} severity={CHECK_SEVERITY[c.status] || "secondary"} />} />
              <Column header={t("periodManagement.countOrAmount")} className="bv-num" headerClassName="bv-num" style={{ width: "9rem" }}
                body={(c) => (c.status === "failed" ? (c.amount !== null && c.amount !== undefined ? money(c.amount) : c.count) : "—")} />
              <Column style={{ width: "6rem" }} body={(c) => (c.status === "failed" && canOpen(resolvePath(c.code)) ? (
                <Button type="button" label={t("periodManagement.resolve")} link size="small" className="pm-panel__resolve" onClick={() => navigate(resolvePath(c.code))} />
              ) : null)} />
            </DataTable>
          )}
        </section>
      )}
      {previewError && <div className="pe-error" role="alert">{previewError}</div>}

      <section className="pm-panel__section">
        <ReasonPicker context={context} value={reason} onChange={setReason} showErrors={tried} disabled={busy || blocked} />
      </section>
      {error && <div className="pe-error" role="alert">{error}</div>}
    </Dialog>
  );
};

StatusPanel.propTypes = {
  /** { action: softClose | close | reopen, period: the period row } */
  request: PropTypes.shape({ action: PropTypes.oneOf(Object.keys(ACTION_STATUS)), period: PropTypes.object }),
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};

export default StatusPanel;
