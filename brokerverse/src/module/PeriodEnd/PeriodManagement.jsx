import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { PageHeader, StatusTag, date, dateTime, money, showError, showSuccess, yearLabel } from "./common";
import { hasPermission } from "../../utils/canOpen";
import { useStableLoad } from "../../hooks/useStableLoad";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import ImportDialog from "../../components/ImportDialog";
import StatusPanel from "./periodManagement/StatusPanel";
import HistoryPanel from "./periodManagement/HistoryPanel";
import { OPENING_UPLOAD, openingConfirm, openingPreviewFacts } from "./periodManagement/openingBalances";
import "./periodManagement/PeriodManagement.scss";

const ACTION_ICONS = { softClose: "pi pi-lock-open", close: "pi pi-lock", reopen: "pi pi-refresh" };

/** The fiscal year after the latest one: code, start and end (a year of twelve months starting the day after). */
export const nextFiscalYear = (years) => {
  const last = (years || []).reduce((m, y) => (!m || y.endDate > m.endDate ? y : m), null);
  if (!last) return null;
  const [y, m, d] = last.endDate.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + 1));
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1));
  const iso = (x) => x.toISOString().slice(0, 10);
  return { code: `FY${end.getUTCFullYear()}`, startDate: iso(start), endDate: iso(end) };
};

/**
 * Accounts > Period End > Period Management: fiscal years and their periods (1-12 and adjustment period 13) with
 * status open / soft-closed / closed / locked. Each status change opens a side panel that previews the blocking
 * month-end checks and takes a coded reason; reopening needs approve:period-end; periods of a closed fiscal year are
 * locked. Go-live opening balances are validated before they are loaded.
 */
const PeriodManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const canWrite = hasPermission("write:period-end");
  const [selected, setSelected] = useState(null);
  const [request, setRequest] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [checks, setChecks] = useState(null);
  const [showOpening, setShowOpening] = useState(false);
  const [creating, setCreating] = useState(null);

  const yearsLoader = useCallback(() => periodEndService.fiscalYears(), []);
  const { data: years, error: yearsError, reload: reloadYears } = useStableLoad(yearsLoader, { initialData: [] });
  useEffect(() => {
    if (!selected && years?.length) setSelected(years.find((y) => y.status !== "closed")?.code || years[0].code);
  }, [years, selected]);
  const fyLoader = useCallback(() => periodEndService.fiscalYear(selected), [selected]);
  const { data: fy, loading, refreshing, error: fyError, reload: reloadFy } = useStableLoad(fyLoader, { enabled: !!selected });
  useEffect(() => {
    const message = yearsError || fyError;
    if (message) showError(toast, { message });
  }, [yearsError, fyError]);

  const statusDone = (req) => {
    showSuccess(toast, t("periodManagement.done", { period: req.period.period, status: t(`periodEnd.status.${{ softClose: "soft_closed", close: "closed", reopen: "open" }[req.action]}`) }));
    setRequest(null);
    reloadFy();
    reloadYears();
  };

  const createNext = async () => {
    const f = await periodEndService.createFiscalYear();
    showSuccess(toast, t("periodManagement.yearCreated", { code: f.code }));
    await reloadYears();
    setSelected(f.code);
  };

  const openChecks = async (row) => {
    setChecks({ period: row.period, rows: null });
    try {
      setChecks({ period: row.period, rows: await periodEndService.periodChecks(row.period) });
    } catch (e) {
      setChecks(null);
      showError(toast, e);
    }
  };

  const actions = (row) => {
    const offered = row.actions || {};
    return (
      <div className="pm-actions">
        {row.status === "locked" && <span className="pe-muted">{t("periodEnd.lockedHint")}</span>}
        {canWrite && ["softClose", "close", "reopen"].filter((a) => offered[a] && !(a === "reopen" && row.status === "locked")).map((a) => {
          // a move the user may not make (reopen without the approval permission) stays visible, disabled, with the reason
          const { allowed, reason, message } = offered[a];
          const tip = allowed ? undefined : t(`periodManagement.notAllowed.${reason}`, { defaultValue: message || "" });
          return (
            <Button key={a} type="button" icon={ACTION_ICONS[a]} label={t(`periodManagement.button.${a}`)} size="small" outlined
              severity={a === "reopen" ? "warning" : undefined} disabled={!allowed} tooltip={tip} tooltipOptions={{ showOnDisabled: true, position: "top" }}
              onClick={() => setRequest({ action: a, period: row })} />
          );
        })}
        <Button type="button" icon="pi pi-check-square" size="small" text tooltip={t("periodEnd.previewChecks")} onClick={() => openChecks(row)} aria-label={t("periodEnd.previewChecks")} />
        <Button type="button" icon="pi pi-history" size="small" text tooltip={t("periodEnd.history")} onClick={() => setHistoryFor(row.period)} aria-label={t("periodEnd.history")} />
      </div>
    );
  };

  const lastChange = (row) => {
    const c = row.lastChange;
    if (!c) return <span className="pe-muted">-</span>;
    return (
      <div className="pm-last-change">
        <div className="pm-last-change__who">
          <StatusChip code={c.to} label={t(`periodEnd.status.${c.to}`)} />
          <span>{c.byName || t("periodManagement.system")}</span>
        </div>
        <div className="pe-muted">{dateTime(c.at)}</div>
        {(c.reasonName || c.remarks) && <div className="pm-last-change__reason" title={c.remarks || ""}>{c.reasonName || c.remarks}</div>}
      </div>
    );
  };

  const counts = (fy?.periods || []).reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {});
  const next = nextFiscalYear(years);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.periodManagement")} trail={[t("periodEnd.periodManagement")]} help={t("periodManagement.help")}>
        <Dropdown value={selected} options={(years || []).map((y) => ({ label: yearLabel(t, y), value: y.code }))}
          onChange={(e) => setSelected(e.value)} style={{ minWidth: 220 }} aria-label={t("periodEnd.fiscalYear")} />
        {canWrite && next && <Button type="button" icon="pi pi-plus" label={t("periodEnd.nextFiscalYear")} onClick={() => setCreating(next)} />}
        {canWrite && (
          <Button type="button" icon="pi pi-upload" label={t("periodManagement.importOpening")} className="p-button-outlined" onClick={() => setShowOpening(true)} />
        )}
      </PageHeader>
      <ImportDialog visible={showOpening} onHide={() => setShowOpening(false)} title={t("periodManagement.importOpening")} targets={OPENING_UPLOAD} goLiveDate
        help={t("periodManagement.opening.help")} previewFacts={openingPreviewFacts(t)} confirmLoad={openingConfirm(t)} loadLabel={t("periodManagement.opening.load")}
        onDone={() => { reloadYears(); reloadFy(); }} />

      {/* the figures keep their place before the year is loaded, so the periods below do not move */}
      <div className="pe-kpis pm-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.fiscalYear")}</div><div className="pe-kpi-value">{fy ? fy.code : "-"}</div><div className="pe-muted">{fy ? `${date(fy.startDate)} – ${date(fy.endDate)}` : " "}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.yearStatus")}</div><div className="pe-kpi-value">{fy ? <StatusTag status={fy.status} /> : "-"}</div></div>
        {["open", "soft_closed", "closed", "locked"].map((s) => (
          <div className="pe-kpi" key={s}><div className="pe-kpi-label">{t(`periodEnd.status.${s}`)}</div><div className="pe-kpi-value">{fy ? counts[s] || 0 : "-"}</div></div>
        ))}
      </div>

      <div className="pe-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <div className="pe-card-title">
          <span>{t("periodEnd.periods")}</span>
          <Button type="button" label={t("periodEnd.monthEndClose")} icon="pi pi-arrow-right" iconPos="right" text onClick={() => navigate("/accounts/period-end/close")} />
        </div>
        <DataTable value={fy?.periods || []} loading={loading} dataKey="period" size="small" stripedRows emptyMessage={t("periodEnd.noRows")}>
          <Column field="periodNo" header={t("periodEnd.no")} style={{ width: "4rem" }} />
          <Column header={t("periodEnd.period")} body={(r) => (r.isAdjustment ? <span>{r.period} <span className="pe-muted">({t("periodEnd.adjustment")})</span></span> : r.period)} />
          <Column header={t("periodEnd.start")} body={(r) => date(r.startDate)} />
          <Column header={t("periodEnd.end")} body={(r) => date(r.endDate)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusChip code={r.status} label={t(`periodEnd.status.${r.status}`)} />} />
          <Column header={t("periodEnd.closeRun")} body={(r) => (r.closeRun ? (
            <span><button type="button" className="pe-link" onClick={() => navigate(`/accounts/period-end/close/${r.closeRun.id}`)}>{r.closeRun.runNumber}</button> <StatusTag status={r.closeRun.status} /></span>
          ) : "")} />
          <Column header={t("periodEnd.lastChange")} body={lastChange} style={{ minWidth: 200 }} />
          <Column header={t("periodEnd.actions")} body={actions} className="pm-actions-cell" headerClassName="pm-actions-cell" />
        </DataTable>
      </div>

      {request && <StatusPanel request={request} onHide={() => setRequest(null)} onDone={statusDone} />}
      {historyFor && <HistoryPanel key={historyFor} period={historyFor} onHide={() => setHistoryFor(null)} />}

      <ConfirmDialog visible={!!creating} onHide={() => setCreating(null)} onConfirm={createNext}
        title={t("periodManagement.createYearTitle", { code: creating?.code })}
        facts={creating ? [
          { label: t("periodEnd.fiscalYear"), value: creating.code },
          { label: t("periodEnd.start"), value: creating.startDate, type: "date" },
          { label: t("periodEnd.end"), value: creating.endDate, type: "date" },
          { label: t("periodEnd.periods"), value: t("periodManagement.createYearPeriods") },
        ] : []}
        confirmLabel={t("periodManagement.createYear")} confirmIcon="pi pi-plus" />

      <Dialog className="pe-dialog" header={checks ? `${t("periodEnd.checklist")} ${checks.period}` : ""} visible={!!checks} style={{ width: "min(860px, 95vw)" }} onHide={() => setChecks(null)}>
        <DataTable value={checks?.rows || []} loading={checks && !checks.rows} size="small" emptyMessage={t("periodEnd.noRows")}>
          <Column field="label" header={t("periodEnd.item")} />
          <Column header={t("periodEnd.severity")} body={(r) => t(`periodEnd.severityValue.${r.severity}`)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("periodManagement.countOrAmount")} className="bv-num" headerClassName="bv-num"
            body={(r) => (r.status === "failed" || r.status === "warning" ? (r.amount !== null && r.amount !== undefined ? money(r.amount) : r.count) : "-")} />
        </DataTable>
      </Dialog>
    </div>
  );
};

export default PeriodManagement;
