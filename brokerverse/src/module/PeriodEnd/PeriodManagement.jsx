import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { PageHeader, StatusTag, date, dateTime, showError, showSuccess } from "./common";

/**
 * Accounts > Period End > Period Management: fiscal years and their periods (1-12 and adjustment period 13) with
 * status open / soft-closed / closed / locked. Closing runs the blocking month-end checks; reopening needs the
 * Accounting Manager's approval permission and remarks; periods of a closed (locked) fiscal year cannot be reopened.
 */
const PeriodManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [years, setYears] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fy, setFy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null); // { period, status }
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);
  const [checks, setChecks] = useState(null);

  const loadYears = useCallback(async () => {
    try {
      const list = await periodEndService.fiscalYears();
      setYears(list);
      setSelected((s) => s || list.find((y) => y.status !== "closed")?.code || list[0]?.code);
    } catch (e) {
      showError(toast, e);
    }
  }, []);
  const loadFy = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      setFy(await periodEndService.fiscalYear(selected));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [selected]);
  useEffect(() => { loadYears(); }, [loadYears]);
  useEffect(() => { loadFy(); }, [loadFy]);

  const createNext = async () => {
    try {
      const f = await periodEndService.createFiscalYear();
      showSuccess(toast, `${f.code} ${t("periodEnd.created")}`);
      await loadYears();
      setSelected(f.code);
    } catch (e) {
      showError(toast, e);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      await periodEndService.setPeriodStatus(action.period, action.status, remarks);
      showSuccess(toast, `${action.period}: ${t(`periodEnd.status.${action.status}`)}`);
      setAction(null);
      setRemarks("");
      loadFy();
      loadYears();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (row) => {
    try {
      setHistory({ period: row.period, rows: await periodEndService.periodHistory(row.period) });
    } catch (e) {
      showError(toast, e);
    }
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
    const b = [];
    if (row.status === "locked") return <span className="pe-muted">{t("periodEnd.lockedHint")}</span>;
    if (row.status === "open" && !row.isAdjustment) b.push(["soft_closed", "pi pi-lock-open", t("periodEnd.softClose")]);
    if (row.status !== "closed") b.push(["closed", "pi pi-lock", t("periodEnd.close")]);
    if (row.status !== "open") b.push(["open", "pi pi-refresh", t("periodEnd.reopen")]);
    return (
      <div className="flex gap-1 flex-wrap">
        {b.map(([status, icon, label]) => (
          <Button key={status} icon={icon} label={label} size="small" outlined={status !== "closed"} severity={status === "open" ? "warning" : undefined}
            onClick={() => { setAction({ period: row.period, status, current: row.status }); setRemarks(""); }} />
        ))}
        <Button icon="pi pi-check-square" size="small" text tooltip={t("periodEnd.previewChecks")} onClick={() => openChecks(row)} />
        <Button icon="pi pi-history" size="small" text tooltip={t("periodEnd.history")} onClick={() => openHistory(row)} />
      </div>
    );
  };

  const counts = (fy?.periods || []).reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {});

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.periodManagement")} trail={[t("periodEnd.periodManagement")]} subtitle={t("periodEnd.periodManagementHelp")}>
        <Dropdown value={selected} options={years.map((y) => ({ label: `${y.code} (${t(`periodEnd.status.${y.status}`)})`, value: y.code }))} onChange={(e) => setSelected(e.value)} style={{ minWidth: 220 }} />
        <Button icon="pi pi-plus" label={t("periodEnd.nextFiscalYear")} onClick={createNext} />
      </PageHeader>

      {fy && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.fiscalYear")}</div><div className="pe-kpi-value">{fy.code}</div><div className="pe-muted">{date(fy.startDate)} – {date(fy.endDate)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.yearStatus")}</div><div className="pe-kpi-value"><StatusTag status={fy.status} /></div></div>
          {["open", "soft_closed", "closed", "locked"].map((s) => (
            <div className="pe-kpi" key={s}><div className="pe-kpi-label">{t(`periodEnd.status.${s}`)}</div><div className="pe-kpi-value">{counts[s] || 0}</div></div>
          ))}
        </div>
      )}

      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("periodEnd.periods")}</span>
          <Button label={t("periodEnd.monthEndClose")} icon="pi pi-arrow-right" iconPos="right" text onClick={() => navigate("/accounts/period-end/close")} />
        </div>
        <DataTable value={fy?.periods || []} loading={loading} dataKey="period" size="small" stripedRows emptyMessage={t("periodEnd.noRows")}>
          <Column field="periodNo" header={t("periodEnd.no")} style={{ width: "4rem" }} />
          <Column header={t("periodEnd.period")} body={(r) => (r.isAdjustment ? <span>{r.period} <span className="pe-muted">({t("periodEnd.adjustment")})</span></span> : r.period)} />
          <Column header={t("periodEnd.start")} body={(r) => date(r.startDate)} />
          <Column header={t("periodEnd.end")} body={(r) => date(r.endDate)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("periodEnd.closeRun")} body={(r) => (r.closeRun ? (
            <span><button type="button" className="pe-link" onClick={() => navigate(`/accounts/period-end/close/${r.closeRun.id}`)}>{r.closeRun.runNumber}</button> <StatusTag status={r.closeRun.status} /></span>
          ) : "")} />
          <Column header={t("periodEnd.lastChange")} body={(r) => dateTime(r.lockedAt || r.closedAt || r.softClosedAt || r.reopenedAt)} />
          <Column header={t("periodEnd.remarks")} field="remarks" style={{ maxWidth: 220 }} />
          <Column header={t("periodEnd.actions")} body={actions} style={{ minWidth: 380 }} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={action ? `${action.period}: ${t(`periodEnd.status.${action.status}`)}` : ""} visible={!!action} style={{ width: "min(520px, 95vw)" }}
        onHide={() => setAction(null)} footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setAction(null)} />
            <Button label={t("periodEnd.confirm")} icon="pi pi-check" loading={busy} onClick={apply} />
          </div>
        )}>
        {action && (
          <div>
            <p className="pe-muted">{action.status === "open" ? t("periodEnd.reopenHelp") : t("periodEnd.closeHelp")}</p>
            <label htmlFor="pe-remarks">{t("periodEnd.remarks")}{action.status === "open" ? " *" : ""}</label>
            <InputTextarea id="pe-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full" autoResize />
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={history ? `${t("periodEnd.history")} ${history.period}` : ""} visible={!!history} style={{ width: "min(760px, 95vw)" }} onHide={() => setHistory(null)}>
        <DataTable value={history?.rows || []} size="small" emptyMessage={t("periodEnd.noRows")}>
          <Column header={t("periodEnd.when")} body={(r) => dateTime(r.changedAt)} />
          <Column header={t("periodEnd.from")} body={(r) => <StatusTag status={r.from} />} />
          <Column header={t("periodEnd.to")} body={(r) => <StatusTag status={r.to} />} />
          <Column field="changedBy" header={t("periodEnd.by")} />
          <Column field="source" header={t("periodEnd.source")} />
          <Column field="remarks" header={t("periodEnd.remarks")} />
        </DataTable>
      </Dialog>

      <Dialog className="pe-dialog" header={checks ? `${t("periodEnd.checklist")} ${checks.period}` : ""} visible={!!checks} style={{ width: "min(860px, 95vw)" }} onHide={() => setChecks(null)}>
        <DataTable value={checks?.rows || []} loading={checks && !checks.rows} size="small" emptyMessage={t("periodEnd.noRows")}>
          <Column field="label" header={t("periodEnd.item")} />
          <Column header={t("periodEnd.severity")} body={(r) => t(`periodEnd.severityValue.${r.severity}`)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
          <Column field="message" header={t("periodEnd.result")} />
        </DataTable>
      </Dialog>
    </div>
  );
};

export default PeriodManagement;
