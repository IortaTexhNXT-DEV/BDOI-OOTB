import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, CASE_STATUSES, CASE_TYPES, PageHeader, PartyCell, SUSPICION_REASONS, fromIsoDay, isoDay, showDate, showDateTime, showMoney, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > AML Cases: the compliance officer's files. An STR case holds the narrative, the grounds of suspicion and
 * the date suspicion was established (the due date follows in working days); a CTR case the covered transactions. The
 * compliance officer approves the case for filing, the report file is generated (AMLC Reports) and, once filed in the
 * AMLC portal, the case is marked filed. A case that needs no report is closed with the reason.
 */
const AmlCases = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const statuses = useOptionList(CASE_STATUSES, "caseStatus");
  const types = useOptionList(CASE_TYPES, "caseType");
  const reasons = useOptionList(SUSPICION_REASONS, "suspicion");
  const [filters, setFilters] = useState({ status: "open,for-filing", caseType: null, search: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [closing, setClosing] = useState(null);
  const [creating, setCreating] = useState(null);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:aml");
  const canApprove = hasPermission("approve:aml");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.cases(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  const openCase = useCallback(async (id) => {
    try {
      setDetail(await amlService.caseDetail(id));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    }
  }, [t]);
  useEffect(() => { if (params.get("case")) openCase(params.get("case")); }, [params, openCase]);

  const run = async (fn, after) => {
    setSaving(true);
    try {
      const r = await fn();
      toast.current?.show({ severity: "success", summary: r.message });
      after?.(r);
      load();
      return r;
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
      return null;
    } finally {
      setSaving(false);
    }
  };
  const open = detail && ["open", "for-filing"].includes(detail.status);
  const saveDetail = () => run(() => amlService.saveCase(detail.id, { title: detail.title, narrative: detail.narrative || "", suspicionReasons: detail.suspicionReasons, suspicionOn: detail.suspicionOn || undefined }),
    (r) => setDetail((d) => ({ ...d, ...r.data })));

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.casesTitle")} intro={t("aml.casesIntro")}
        actions={canWrite ? <Button icon="pi pi-plus" label={t("aml.newCase")} onClick={() => setCreating({ caseType: "review", title: "", narrative: "" })} /> : null} />
      <div className="admin__filters">
        <Dropdown value={filters.status} options={[{ value: "open,for-filing", label: t("aml.allPending") }, ...statuses]} showClear placeholder={t("aml.colStatus")} onChange={(e) => setFilters((f) => ({ ...f, status: e.value || null }))} />
        <Dropdown value={filters.caseType} options={types} showClear placeholder={t("aml.colCaseType")} onChange={(e) => setFilters((f) => ({ ...f, caseType: e.value || null }))} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("aml.searchCases")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.none")}
        selectionMode="single" onRowSelect={(e) => openCase(e.data.id)}>
        <Column field="caseNumber" header={t("aml.colNumber")} sortable />
        <Column header={t("aml.colCaseType")} body={(r) => t(`aml.caseType.${r.caseType}`)} />
        <Column field="title" header={t("aml.colTitle")} />
        <Column header={t("aml.colClient")} body={(r) => <PartyCell name={r.clientName} code={r.clientCode} />} />
        <Column field="alerts" header={t("aml.colAlerts")} />
        <Column header={t("aml.colDue")} body={(r) => <span className="aml__due">{showDate(r.dueOn)}{r.overdue ? <Tag value={t("aml.overdue")} severity="danger" /> : null}</span>} />
        <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="caseStatus" />} />
        <Column field="amlcReference" header={t("aml.amlcReference")} />
      </DataTable>

      <Dialog header={detail ? `${detail.caseNumber}: ${t(`aml.caseType.${detail.caseType}`)}` : ""} visible={!!detail} style={{ width: "60rem" }} modal onHide={() => setDetail(null)}
        footer={detail ? (<>
          {detail.clientId ? <Button label={t("aml.openProfile")} text icon="pi pi-user" onClick={() => navigate(`/compliance/aml/clients/${detail.clientId}`)} /> : null}
          <Button label={t("aml.cancel")} text onClick={() => setDetail(null)} />
          {open && canWrite ? <Button label={t("aml.save")} outlined icon="pi pi-save" loading={saving} onClick={saveDetail} /> : null}
          {open && canApprove ? <Button label={t("aml.closeCase")} severity="secondary" outlined onClick={() => setClosing({ reason: "" })} /> : null}
          {detail.status === "open" && canApprove && detail.caseType !== "review" ? <Button label={t("aml.approveForFiling")} icon="pi pi-check" loading={saving}
            onClick={async () => { const s = await run(() => amlService.saveCase(detail.id, { narrative: detail.narrative || "", suspicionReasons: detail.suspicionReasons, title: detail.title })); if (s) run(() => amlService.approveCase(detail.id), (r) => setDetail(r.data)); }} /> : null}
          {detail.status === "for-filing" && canWrite ? <Button label={t("aml.generateReport")} icon="pi pi-file" loading={saving}
            onClick={() => run(() => amlService.caseReport(detail.id), () => openCase(detail.id))} /> : null}
        </>) : null}>
        {detail ? (
          <div className="admin__grid admin__grid--single">
            <div className="aml__summary">
              <div><label>{t("aml.colStatus")}</label><AmlTag value={detail.status} group="caseStatus" /></div>
              <div><label>{t("aml.colClient")}</label>{detail.clientName ? `${detail.clientName} (${detail.clientCode})` : "-"}</div>
              <div><label>{t("aml.colDue")}</label>{showDate(detail.dueOn)}</div>
              <div><label>{t("aml.approvedBy")}</label>{detail.approvedAt ? `${detail.approvedBy} ${showDateTime(detail.approvedAt)}` : "-"}</div>
              {detail.closedReason ? <div><label>{t("aml.closedReason")}</label>{detail.closedReason}</div> : null}
            </div>
            <div className="admin__field">
              <label htmlFor="cs-title">{t("aml.colTitle")}</label>
              <InputText id="cs-title" value={detail.title || ""} disabled={!open} onChange={(e) => setDetail((d) => ({ ...d, title: e.target.value }))} />
            </div>
            {detail.caseType === "STR" ? (
              <div className="access__two">
                <div className="admin__field">
                  <label htmlFor="cs-reasons">{t("aml.grounds")}</label>
                  <MultiSelect inputId="cs-reasons" value={detail.suspicionReasons} options={reasons} disabled={!open} display="chip" onChange={(e) => setDetail((d) => ({ ...d, suspicionReasons: e.value }))} />
                </div>
                <div className="admin__field">
                  <label htmlFor="cs-on">{t("aml.suspicionOn")}</label>
                  <Calendar inputId="cs-on" value={fromIsoDay(detail.suspicionOn)} disabled={!open} onChange={(e) => setDetail((d) => ({ ...d, suspicionOn: isoDay(e.value) }))} showIcon dateFormat="dd M yy" />
                </div>
              </div>
            ) : null}
            <div className="admin__field">
              <label htmlFor="cs-narrative">{t("aml.narrative")}</label>
              <InputTextarea id="cs-narrative" rows={6} value={detail.narrative || ""} disabled={!open} onChange={(e) => setDetail((d) => ({ ...d, narrative: e.target.value }))} />
              <small>{t("aml.narrativeHelp")}</small>
            </div>
            <h4>{t("aml.alertsInCase")}</h4>
            <DataTable value={detail.alertList} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
              <Column field="alertNumber" header={t("aml.colNumber")} />
              <Column header={t("aml.colDate")} body={(a) => showDate(a.transactionDate)} />
              <Column field="ruleName" header={t("aml.colRule")} />
              <Column header={t("aml.colAmount")} className="text-right" body={(a) => showMoney(a.amount)} />
              <Column field="summary" header={t("aml.colSummary")} />
              <Column header={t("aml.colStatus")} body={(a) => <AmlTag value={a.status} group="alertStatus" />} />
            </DataTable>
            {detail.hitList?.length ? (
              <>
                <h4>{t("aml.hitsInCase")}</h4>
                <DataTable value={detail.hitList} dataKey="id" size="small" className="access__table">
                  <Column field="partyName" header={t("aml.colParty")} />
                  <Column header={t("aml.colMatch")} body={(h) => `${h.matchedName} (${h.listCode})`} />
                  <Column header={t("aml.colScore")} body={(h) => h.score.toFixed(2)} />
                  <Column header={t("aml.colStatus")} body={(h) => <AmlTag value={h.status} group="hitStatus" />} />
                </DataTable>
              </>
            ) : null}
            <h4>{t("aml.reportFiles")}</h4>
            <DataTable value={detail.reports} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
              <Column field="reportNumber" header={t("aml.colNumber")} />
              <Column field="reportType" header={t("aml.colType")} />
              <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="reportStatus" />} />
              <Column header="" body={(r) => <Button icon="pi pi-download" text rounded size="small" aria-label={t("aml.download")} onClick={() => amlService.downloadReport(r.id)} />} />
            </DataTable>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.closeCase")} visible={!!closing} style={{ width: "30rem" }} modal onHide={() => setClosing(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setClosing(null)} />
          <Button label={t("aml.closeCase")} icon="pi pi-check" loading={saving} disabled={(closing?.reason || "").trim().length < 5}
            onClick={() => run(() => amlService.closeCase(detail.id, closing.reason.trim()), (r) => { setClosing(null); setDetail(r.data); })} />
        </>}>
        {closing ? (
          <div className="admin__field">
            <label htmlFor="cc-reason">{t("aml.colReason")}</label>
            <InputTextarea id="cc-reason" rows={3} value={closing.reason} onChange={(e) => setClosing({ reason: e.target.value })} />
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.newCase")} visible={!!creating} style={{ width: "34rem" }} modal onHide={() => setCreating(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setCreating(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} disabled={(creating?.title || "").trim().length < 3}
            onClick={() => run(() => amlService.openCase({ caseType: creating.caseType, title: creating.title.trim(), narrative: creating.narrative || undefined }), (r) => { setCreating(null); setDetail(r.data); })} />
        </>}>
        {creating ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="nc-type">{t("aml.colCaseType")}</label><Dropdown inputId="nc-type" value={creating.caseType} options={types} onChange={(e) => setCreating((c) => ({ ...c, caseType: e.value }))} /></div>
            <div className="admin__field"><label htmlFor="nc-title">{t("aml.colTitle")}</label><InputText id="nc-title" value={creating.title} onChange={(e) => setCreating((c) => ({ ...c, title: e.target.value }))} /></div>
            <div className="admin__field"><label htmlFor="nc-narrative">{t("aml.narrative")}</label><InputTextarea id="nc-narrative" rows={4} value={creating.narrative} onChange={(e) => setCreating((c) => ({ ...c, narrative: e.target.value }))} /></div>
            <small className="access__muted">{t("aml.newCaseNote")}</small>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AmlCases;
