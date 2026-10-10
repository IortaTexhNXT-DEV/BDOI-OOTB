import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PageHeader, StatusTag, dateTime, previousPeriod, showError } from "./common";

/** Accounts > Period End > Month-End Close: close runs per period (MEC numbers) and a new run for an open period. */
const MonthEndClose = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [years, setYears] = useState([]);
  const [fiscalYear, setFiscalYear] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    periodEndService.fiscalYears().then((list) => {
      setYears(list);
      setFiscalYear(list.find((y) => y.status !== "closed")?.code || list[0]?.code || null);
    }).catch((e) => showError(toast, e));
  }, []);
  const load = useCallback(async () => {
    if (!fiscalYear) return;
    setLoading(true);
    try {
      const [r, fy] = await Promise.all([periodEndService.closeRuns({ fiscalYear }), periodEndService.fiscalYear(fiscalYear)]);
      setRuns(r);
      setPeriods(fy.periods || []);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);
  useEffect(() => { load(); }, [load]);

  const openPeriods = useMemo(() => periods.filter((p) => !p.isAdjustment && ["open", "soft_closed"].includes(p.status))
    .map((p) => ({ label: `${p.period} (${t(`periodEnd.status.${p.status}`)})`, value: p.period })), [periods, t]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await periodEndService.createCloseRun(creating.period, creating.remarks);
      navigate(`/accounts/period-end/close/${r.id}`);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.monthEndClose")} trail={[t("periodEnd.monthEndClose")]}>
        <Dropdown value={fiscalYear} options={years.map((y) => ({ label: y.code, value: y.code }))} onChange={(e) => setFiscalYear(e.value)} style={{ minWidth: 160 }} />
        <Button icon="pi pi-plus" label={t("periodEnd.newCloseRun")} onClick={() => {
          const prev = previousPeriod();
          setCreating({ period: openPeriods.find((o) => o.value === prev)?.value || openPeriods[0]?.value || null, remarks: "" });
        }} />
      </PageHeader>

      <div className="pe-card">
        <DataTable value={runs} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("periodEnd.noRuns")} onRowClick={(e) => navigate(`/accounts/period-end/close/${e.data.id}`)}
          rowClassName={() => "cursor-pointer"}>
          <Column header={t("periodEnd.runNumber")} body={(r) => <span className="pe-link">{r.runNumber}</span>} />
          <Column field="period" header={t("periodEnd.period")} />
          <Column header={t("periodEnd.runStatus")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("periodEnd.periodStatus")} body={(r) => <StatusTag status={r.periodStatus} />} />
          <Column field="failedChecks" header={t("periodEnd.blockingFailures")} className="bv-num" headerClassName="bv-num" />
          <Column field="warnings" header={t("periodEnd.warnings")} className="bv-num" headerClassName="bv-num" />
          <Column field="journalCount" header={t("periodEnd.journals")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("periodEnd.preparedBy")} body={(r) => (r.preparedByName ? `${r.preparedByName}, ${dateTime(r.preparedAt)}` : "-")} />
          <Column header={t("periodEnd.approvedBy")} body={(r) => (r.approvedByName ? `${r.approvedByName}, ${dateTime(r.approvedAt)}` : "-")} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog bv-centered" header={t("periodEnd.newCloseRun")} visible={!!creating} style={{ width: "min(480px, 95vw)" }} onHide={() => setCreating(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setCreating(null)} />
            <Button label={t("periodEnd.startRun")} icon="pi pi-play" loading={busy} disabled={!creating?.period} onClick={create} />
          </div>
        )}>
        {creating && (
          <div className="grid">
            <div className="col-12">
              <label htmlFor="pe-run-period">{t("periodEnd.period")} *</label>
              <Dropdown inputId="pe-run-period" value={creating.period} options={openPeriods} onChange={(e) => setCreating({ ...creating, period: e.value })} className="w-full"
                placeholder={t("periodEnd.selectPeriod")} emptyMessage={t("periodEnd.noOpenPeriods")} />
            </div>
            <div className="col-12">
              <label htmlFor="pe-run-remarks">{t("periodEnd.remarks")}</label>
              <InputTextarea id="pe-run-remarks" value={creating.remarks} onChange={(e) => setCreating({ ...creating, remarks: e.target.value })} rows={2} className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default MonthEndClose;
