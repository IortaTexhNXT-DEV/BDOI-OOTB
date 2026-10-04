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
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { ALERT_STATUSES, AmlTag, CASE_TYPES, PageHeader, PartyCell, isoDay, showDate, showMoney, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Transaction Alerts: covered transactions (cash above the threshold in one banking day) and suspicious
 * transaction red flags found by the monitoring rules (daily job, or Run monitoring for a period). Select alerts to
 * open a case (CTR, STR or review) or add them to an open case; close a suspicious alert with the reason when the
 * review explains it. Covered transactions are reported in a CTR file (AMLC Reports), never closed.
 */
const TransactionAlerts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const statuses = useOptionList(ALERT_STATUSES, "alertStatus");
  const kinds = useOptionList(["covered", "suspicious"], "kind");
  const caseTypes = useOptionList(CASE_TYPES, "caseType");
  const [rules, setRules] = useState([]);
  const [filters, setFilters] = useState({ status: "open", kind: params.get("kind") || null, ruleCode: null, search: "" });
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [closing, setClosing] = useState(null);
  const [toCase, setToCase] = useState(null);
  const [openCases, setOpenCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:aml");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.alerts(filters));
      setSelected([]);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { amlService.rules().then((r) => setRules(r.map((x) => ({ value: x.code, label: x.name })))).catch(() => setRules([])); }, []);

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
  const openCaseDialog = async () => {
    const covered = selected.every((a) => a.kind === "covered");
    setToCase({ mode: "new", caseType: covered ? "CTR" : "STR", title: selected[0]?.summary?.slice(0, 120) || "", caseId: null });
    try {
      setOpenCases((await amlService.cases({ status: "open,for-filing" })).map((c) => ({ value: c.id, label: `${c.caseNumber} ${c.title}` })));
    } catch {
      setOpenCases([]);
    }
  };
  const saveCase = () => run(() => (toCase.mode === "new"
    ? amlService.openCase({ caseType: toCase.caseType, title: toCase.title, alertIds: selected.map((a) => a.id) })
    : amlService.addAlertsToCase(toCase.caseId, selected.map((a) => a.id))), (r) => { setToCase(null); if (r.data?.id) navigate(`/compliance/aml/cases?case=${r.data.id}`); });
  const selectable = selected.length && selected.every((a) => a.status === "open");

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.alertsTitle")} intro={t("aml.alertsIntro")}
        actions={canWrite ? <>
          <Button icon="pi pi-folder-open" outlined label={t("aml.toCase")} disabled={!selectable} onClick={openCaseDialog} />
          <Button icon="pi pi-play" label={t("aml.runMonitoring")} onClick={() => setRunning({ from: null, to: null })} />
        </> : null} />
      <div className="admin__filters">
        <Dropdown value={filters.status} options={statuses} showClear placeholder={t("aml.colStatus")} onChange={(e) => setFilters((f) => ({ ...f, status: e.value || null }))} />
        <Dropdown value={filters.kind} options={kinds} showClear placeholder={t("aml.colKind")} onChange={(e) => setFilters((f) => ({ ...f, kind: e.value || null }))} />
        <Dropdown value={filters.ruleCode} options={rules} showClear placeholder={t("aml.colRule")} onChange={(e) => setFilters((f) => ({ ...f, ruleCode: e.value || null }))} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("aml.searchAlerts")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.noAlerts")}
        selectionMode="checkbox" selection={selected} onSelectionChange={(e) => setSelected(e.value)}>
        <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
        <Column field="alertNumber" header={t("aml.colNumber")} sortable />
        <Column field="transactionDate" header={t("aml.colDate")} sortable body={(r) => showDate(r.transactionDate)} />
        <Column header={t("aml.colRule")} body={(r) => <PartyCell name={r.ruleName} code={t(`aml.kind.${r.kind}`)} />} />
        <Column header={t("aml.colClient")} body={(r) => <PartyCell name={r.clientName} code={r.clientCode} />} />
        <Column header={t("aml.colAmount")} className="text-right" body={(r) => showMoney(r.amount)} />
        <Column field="summary" header={t("aml.colSummary")} />
        <Column header={t("aml.colSeverity")} body={(r) => <AmlTag value={r.severity} group="severity" />} />
        <Column header={t("aml.colStatus")} body={(r) => (
          <div className="access__user"><AmlTag value={r.status} group="alertStatus" />{r.caseNumber ? <span className="access__muted">{r.caseNumber}</span> : null}{r.decisionReason ? <span className="access__muted">{r.decisionReason}</span> : null}</div>
        )} />
        <Column header="" body={(r) => (canWrite && r.status === "open" && r.kind === "suspicious"
          ? <Button label={t("aml.close")} text size="small" onClick={() => setClosing({ id: r.id, number: r.alertNumber, reason: "" })} /> : null)} />
      </DataTable>

      <Dialog header={t("aml.runMonitoring")} visible={!!running} style={{ width: "30rem" }} modal onHide={() => setRunning(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setRunning(null)} />
          <Button label={t("aml.run")} icon="pi pi-play" loading={saving} onClick={() => run(() => amlService.runMonitoring({ from: isoDay(running.from), to: isoDay(running.to) }), () => setRunning(null))} />
        </>}>
        {running ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="rm-from">{t("aml.from")}</label><Calendar inputId="rm-from" value={running.from} onChange={(e) => setRunning((r) => ({ ...r, from: e.value }))} showIcon dateFormat="dd M yy" /></div>
            <div className="admin__field"><label htmlFor="rm-to">{t("aml.to")}</label><Calendar inputId="rm-to" value={running.to} onChange={(e) => setRunning((r) => ({ ...r, to: e.value }))} showIcon dateFormat="dd M yy" /></div>
            <small className="access__muted">{t("aml.runNote")}</small>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.closeAlert", { number: closing?.number || "" })} visible={!!closing} style={{ width: "30rem" }} modal onHide={() => setClosing(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setClosing(null)} />
          <Button label={t("aml.close")} icon="pi pi-check" loading={saving} disabled={(closing?.reason || "").trim().length < 5} onClick={() => run(() => amlService.closeAlert(closing.id, closing.reason.trim()), () => setClosing(null))} />
        </>}>
        {closing ? (
          <div className="admin__field">
            <label htmlFor="ca-reason">{t("aml.colReason")}</label>
            <InputTextarea id="ca-reason" rows={3} value={closing.reason} onChange={(e) => setClosing((c) => ({ ...c, reason: e.target.value }))} />
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.toCase")} visible={!!toCase} style={{ width: "34rem" }} modal onHide={() => setToCase(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setToCase(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} disabled={toCase?.mode === "existing" ? !toCase?.caseId : (toCase?.title || "").trim().length < 3} onClick={saveCase} />
        </>}>
        {toCase ? (
          <div className="admin__grid admin__grid--single">
            <p className="access__muted">{t("aml.selectedAlerts", { count: selected.length })}</p>
            <Dropdown value={toCase.mode} options={[{ value: "new", label: t("aml.newCase") }, { value: "existing", label: t("aml.existingCase") }]} onChange={(e) => setToCase((c) => ({ ...c, mode: e.value }))} />
            {toCase.mode === "new" ? (
              <>
                <div className="admin__field"><label htmlFor="tc-type">{t("aml.colCaseType")}</label><Dropdown inputId="tc-type" value={toCase.caseType} options={caseTypes} onChange={(e) => setToCase((c) => ({ ...c, caseType: e.value }))} /></div>
                <div className="admin__field"><label htmlFor="tc-title">{t("aml.colTitle")}</label><InputText id="tc-title" value={toCase.title} onChange={(e) => setToCase((c) => ({ ...c, title: e.target.value }))} /></div>
              </>
            ) : (
              <div className="admin__field"><label htmlFor="tc-case">{t("aml.case")}</label><Dropdown inputId="tc-case" value={toCase.caseId} options={openCases} onChange={(e) => setToCase((c) => ({ ...c, caseId: e.value }))} /></div>
            )}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default TransactionAlerts;
