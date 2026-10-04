import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, PageHeader, REPORT_STATUSES, isoDay, showDate, showDateTime, showMoney, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > AMLC Reports: covered transaction report (CTR) files per period and the STR files of the cases, in the
 * AMLC reporting layout (format version on each file). The compliance officer downloads the file, files it in the
 * AMLC portal and records the filing date and the AMLC acknowledgement here.
 */
const AmlReports = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const statuses = useOptionList(REPORT_STATUSES, "reportStatus");
  const [filters, setFilters] = useState({ reportType: null, status: null });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ctr, setCtr] = useState(null);
  const [submit, setSubmit] = useState(null);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:aml");
  const canApprove = hasPermission("approve:aml");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.reports(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, after) => {
    setSaving(true);
    try {
      const r = await fn();
      toast.current?.show({ severity: "success", summary: r.message });
      after?.(r);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const download = async (r) => {
    try {
      await amlService.downloadReport(r.id, r.fileName);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    }
  };

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.reportsTitle")} intro={t("aml.reportsIntro")}
        actions={canWrite ? <Button icon="pi pi-file" label={t("aml.generateCtr")} onClick={() => setCtr({ from: null, to: null })} /> : null} />
      <Message severity="info" className="w-full mb-2" text={t("aml.formatNote")} />
      <div className="admin__filters">
        <Dropdown value={filters.reportType} options={[{ value: "CTR", label: "CTR" }, { value: "STR", label: "STR" }]} showClear placeholder={t("aml.colType")} onChange={(e) => setFilters((f) => ({ ...f, reportType: e.value || null }))} />
        <Dropdown value={filters.status} options={statuses} showClear placeholder={t("aml.colStatus")} onChange={(e) => setFilters((f) => ({ ...f, status: e.value || null }))} />
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.none")}>
        <Column field="reportNumber" header={t("aml.colNumber")} sortable />
        <Column field="reportType" header={t("aml.colType")} />
        <Column header={t("aml.period")} body={(r) => `${showDate(r.periodFrom)} - ${showDate(r.periodTo)}`} />
        <Column field="caseNumber" header={t("aml.case")} />
        <Column field="transactions" header={t("aml.colTransactions")} />
        <Column header={t("aml.colAmount")} className="text-right" body={(r) => showMoney(r.totalAmount)} />
        <Column field="formatVersion" header={t("aml.colFormat")} />
        <Column header={t("aml.colGenerated")} body={(r) => `${showDateTime(r.generatedAt)} ${r.generatedBy || ""}`} />
        <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="reportStatus" />} />
        <Column header={t("aml.amlcReference")} body={(r) => (r.amlcReference ? `${r.amlcReference} (${showDate(r.submittedOn)})` : "")} />
        <Column header="" style={{ width: "12rem" }} body={(r) => (
          <div className="aml__row-actions">
            <Button icon="pi pi-download" text rounded size="small" aria-label={t("aml.download")} tooltip={t("aml.download")} onClick={() => download(r)} />
            {canApprove && ["generated", "submitted"].includes(r.status) ? <Button label={t("aml.recordFiling")} text size="small" onClick={() => setSubmit({ id: r.id, number: r.reportNumber, submittedOn: new Date(), amlcReference: r.amlcReference || "", notes: "", status: r.status === "submitted" ? "acknowledged" : "submitted" })} /> : null}
          </div>
        )} />
      </DataTable>

      <Dialog header={t("aml.generateCtr")} visible={!!ctr} style={{ width: "30rem" }} modal onHide={() => setCtr(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setCtr(null)} />
          <Button label={t("aml.generate")} icon="pi pi-check" loading={saving} disabled={!ctr?.from || !ctr?.to} onClick={() => run(() => amlService.generateCtr({ from: isoDay(ctr.from), to: isoDay(ctr.to) }), () => setCtr(null))} />
        </>}>
        {ctr ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="ctr-from">{t("aml.from")}</label><Calendar inputId="ctr-from" value={ctr.from} onChange={(e) => setCtr((c) => ({ ...c, from: e.value }))} showIcon dateFormat="dd M yy" /></div>
            <div className="admin__field"><label htmlFor="ctr-to">{t("aml.to")}</label><Calendar inputId="ctr-to" value={ctr.to} onChange={(e) => setCtr((c) => ({ ...c, to: e.value }))} showIcon dateFormat="dd M yy" /></div>
            <small className="access__muted">{t("aml.ctrNote")}</small>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.recordFilingOf", { number: submit?.number || "" })} visible={!!submit} style={{ width: "32rem" }} modal onHide={() => setSubmit(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setSubmit(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} onClick={() => run(() => amlService.submitReport(submit.id, { submittedOn: isoDay(submit.submittedOn), amlcReference: submit.amlcReference || undefined, notes: submit.notes || undefined, status: submit.status }), () => setSubmit(null))} />
        </>}>
        {submit ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="sb-status">{t("aml.colStatus")}</label>
              <Dropdown inputId="sb-status" value={submit.status} options={statuses.filter((s) => s.value !== "generated")} onChange={(e) => setSubmit((s) => ({ ...s, status: e.value }))} /></div>
            <div className="admin__field"><label htmlFor="sb-on">{t("aml.filedOn")}</label><Calendar inputId="sb-on" value={submit.submittedOn} onChange={(e) => setSubmit((s) => ({ ...s, submittedOn: e.value }))} showIcon dateFormat="dd M yy" /></div>
            <div className="admin__field"><label htmlFor="sb-ref">{t("aml.amlcReference")}</label><InputText id="sb-ref" value={submit.amlcReference} onChange={(e) => setSubmit((s) => ({ ...s, amlcReference: e.target.value }))} /></div>
            <div className="admin__field"><label htmlFor="sb-notes">{t("aml.notes")}</label><InputTextarea id="sb-notes" rows={2} value={submit.notes} onChange={(e) => setSubmit((s) => ({ ...s, notes: e.target.value }))} /></div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AmlReports;
