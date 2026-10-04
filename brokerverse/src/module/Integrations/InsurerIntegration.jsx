import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import { IntTag, PageHeader, dateTime, insurerOptions, parseJson, pretty, showError, showSuccess } from "./common";

const REQUEST_TYPES = ["insurer.policy_issue", "insurer.policy_data", "insurer.claim_status"];
const MAP_FIELDS = ["productMap", "requestMap", "responseMap", "claimStatusMap"];

/** Requests sent to insurers with a new request dialog. */
const Requests = ({ toast }) => {
  const { t } = useTranslation();
  const [type, setType] = useState(null);
  const [form, setForm] = useState(null);
  const fetchPage = useCallback(({ page, pageSize }) => service.insurerRequests({ messageType: type, page, pageSize }), [type]);
  const list = useServerList(fetchPage, { key: "insurer-requests" });
  const send = async () => {
    try {
      const body = form.type === "insurer.claim_status" ? { type: form.type, claimId: form.reference.trim() } : { type: form.type, policyId: form.reference.trim(), force: form.force || undefined };
      const r = await service.insurerRequest(body);
      toast.current?.show({ severity: r.data.status === "sent" ? "success" : "warn", summary: t(`integrations.requestTypes.${form.type}`), detail: r.message, life: 7000 });
      setForm(null);
      list.reload();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <>
      <div className="pe-filters mb-2">
        <Dropdown value={type} showClear placeholder={t("integrations.allRequests")} aria-label={t("integrations.messageType")} options={REQUEST_TYPES.map((x) => ({ label: t(`integrations.requestTypes.${x}`), value: x }))}
          onChange={(e) => setType(e.value)} />
        <Button icon="pi pi-refresh" outlined aria-label={t("integrations.refresh")} onClick={list.reload} />
        <Button icon="pi pi-send" label={t("integrations.newRequest")} onClick={() => setForm({ type: "insurer.policy_issue", reference: "", force: false })} />
      </div>
      <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("integrations.noMessages")}>
        <Column field="id" header="#" />
        <Column header={t("integrations.messageType")} body={(r) => t(`integrations.requestTypes.${r.messageType}`, { defaultValue: r.messageType })} />
        <Column field="reference" header={t("integrations.reference")} />
        <Column header={t("integrations.status.label")} body={(r) => <span className="flex gap-1"><IntTag status={r.status} /><IntTag status={r.mode} /></span>} />
        <Column header={t("integrations.insurerAnswer")} body={(r) => r.externalRef || (r.response?.status ? String(r.response.status) : "-")} />
        <Column header={t("integrations.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "20rem", wordBreak: "break-word" }} />
        <Column header={t("integrations.created")} body={(r) => dateTime(r.createdAt)} />
      </DataTable>
      <Dialog className="pe-dialog" header={t("integrations.newRequest")} visible={!!form} style={{ width: "min(520px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setForm(null)} /><Button label={t("integrations.send")} icon="pi pi-send" onClick={send} disabled={!form?.reference?.trim()} /></div>}>
        {form && (
          <div className="grid">
            <div className="col-12"><label>{t("integrations.messageType")}</label>
              <Dropdown value={form.type} options={REQUEST_TYPES.map((x) => ({ label: t(`integrations.requestTypes.${x}`), value: x }))} onChange={(e) => setForm({ ...form, type: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{form.type === "insurer.claim_status" ? t("integrations.claimNumber") : t("integrations.policyNumber")} *</label>
              <InputText value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="w-full" /></div>
            {form.type === "insurer.policy_issue" && (
              <div className="col-12 flex align-items-center gap-2"><Checkbox inputId="req-force" checked={!!form.force} onChange={(e) => setForm({ ...form, force: e.checked })} />
                <label htmlFor="req-force" className="m-0">{t("integrations.forceIssue")}</label></div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
};

/** Claim status file (CSV) import: the file fallback when the insurer has no API. */
const ClaimStatusFile = ({ toast }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await service.importClaimStatus(file);
      setResult(r.data);
      showSuccess(toast, r.message);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid">
      <div className="col-12"><p className="pe-muted mt-0">{t("integrations.claimFileHelp")}</p></div>
      <div className="col-12 md:col-8 flex gap-2 align-items-center">
        <input type="file" accept=".csv,text/csv" aria-label={t("integrations.chooseFile")} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button icon="pi pi-upload" label={t("integrations.import")} loading={busy} disabled={!file} onClick={run} />
      </div>
      <div className="col-12 md:col-4 text-right">
        <Button icon="pi pi-external-link" label={t("integrations.statementImport")} text onClick={() => navigate("/accounts/insurer-reconciliation/statements")} />
      </div>
      {result && (
        <div className="col-12">
          <DataTable value={result.results} size="small" stripedRows dataKey="row">
            <Column field="row" header={t("integrations.row")} />
            <Column field="claimNumber" header={t("integrations.claimNumber")} />
            <Column header={t("integrations.status.label")} body={(r) => <IntTag status={r.status} />} />
            <Column header={t("integrations.lastError")} body={(r) => r.error || "-"} />
          </DataTable>
        </div>
      )}
    </div>
  );
};

/**
 * Master > System Configuration > Insurer Integration: the API mapping per insurer (connector, broker code, product
 * codes, request, response and claim status maps), the requests sent (policy issuance, policy data, claim status) and
 * the claim status file import; premium and policy data by file go through the insurer statement import.
 */
const InsurerIntegration = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [defaultMap, setDefaultMap] = useState({});
  const [insurers, setInsurers] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await service.mappings();
      setRows(r.data || []);
      setDefaultMap(r.defaultRequestMap || {});
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    insurerOptions().then(setInsurers).catch(() => null);
    service.connectors().then((list) => setConnectors(list.filter((c) => c.kind === "insurer_api").map((c) => ({ label: c.name, value: c.code })))).catch(() => null);
  }, [load]);

  const open = (m) => setEditing({ insuranceCompanyId: m?.insuranceCompanyId || null, connectorCode: m?.connectorCode || "INSURER_API", enabled: m ? m.enabled : true, brokerCode: m?.brokerCode || "",
    autoIssueRequest: !!m?.autoIssueRequest, remarks: m?.remarks || "", ...Object.fromEntries(MAP_FIELDS.map((k) => [k, pretty(m?.[k] || {})])), isNew: !m, policyNumber: "" });
  const save = async () => {
    const parsed = {};
    for (const k of MAP_FIELDS) {
      const [val, err] = parseJson(editing[k], {});
      if (err) {
        showError(toast, new Error(`${t(`integrations.maps.${k}`)}: ${err}`));
        return;
      }
      parsed[k] = val;
    }
    try {
      const r = await service.saveMapping(editing.insuranceCompanyId, { connectorCode: editing.connectorCode, enabled: editing.enabled, brokerCode: editing.brokerCode || null,
        autoIssueRequest: editing.autoIssueRequest, remarks: editing.remarks || null, ...parsed });
      showSuccess(toast, r.message);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const runPreview = async () => {
    try {
      const r = await service.previewMapping(editing.insuranceCompanyId, editing.policyNumber.trim());
      setPreview(r.data.request);
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Master")} section={t("sidebar.System Configuration")} title={t("integrations.insurerTitle")} subtitle={t("integrations.insurerIntro")}>
        <Button icon="pi pi-plus" label={t("integrations.newMapping")} onClick={() => open(null)} />
      </PageHeader>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("integrations.mappings")}>
            <DataTable value={rows} loading={loading} dataKey="insuranceCompanyId" size="small" stripedRows emptyMessage={t("integrations.noMappings")}>
              <Column field="insurerName" header={t("integrations.insurer")} />
              <Column field="connectorCode" header={t("integrations.connector")} />
              <Column field="brokerCode" header={t("integrations.brokerCode")} />
              <Column header={t("integrations.products")} body={(m) => Object.entries(m.productMap).map(([k, v]) => `${k}: ${v}`).join(", ") || "-"} />
              <Column header={t("integrations.autoIssue")} body={(m) => (m.autoIssueRequest ? t("integrations.yes") : t("integrations.no"))} />
              <Column header={t("integrations.status.label")} body={(m) => <IntTag status={m.enabled ? "active" : "closed"} />} />
              <Column header="" body={(m) => <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.edit")} tooltip={t("integrations.edit")} tooltipOptions={{ position: "top" }} onClick={() => open(m)} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("integrations.requests")}>
            {tab === 1 && <Requests toast={toast} />}
          </TabPanel>
          <TabPanel header={t("integrations.claimStatusFile")}>
            <ClaimStatusFile toast={toast} />
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={editing?.isNew ? t("integrations.newMapping") : t("integrations.editMapping")} visible={!!editing} style={{ width: "min(960px, 96vw)" }} onHide={() => { setEditing(null); setPreview(null); }}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setEditing(null)} /><Button label={t("integrations.save")} icon="pi pi-save" onClick={save} disabled={!editing?.insuranceCompanyId} /></div>}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("integrations.insurer")} *</label>
              <Dropdown value={editing.insuranceCompanyId} options={insurers} filter disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, insuranceCompanyId: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.connector")}</label>
              <Dropdown value={editing.connectorCode} options={connectors} onChange={(e) => setEditing({ ...editing, connectorCode: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.brokerCode")}</label><InputText value={editing.brokerCode} onChange={(e) => setEditing({ ...editing, brokerCode: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-2 mt-4"><Checkbox inputId="map-enabled" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.checked })} />
              <label htmlFor="map-enabled" className="m-0">{t("integrations.enabled")}</label></div>
            <div className="col-12 md:col-4 flex align-items-center gap-2 mt-4"><Checkbox inputId="map-auto" checked={editing.autoIssueRequest} onChange={(e) => setEditing({ ...editing, autoIssueRequest: e.checked })} />
              <label htmlFor="map-auto" className="m-0">{t("integrations.autoIssue")}</label></div>
            {MAP_FIELDS.map((k) => (
              <div className="col-12 md:col-6" key={k}><label>{t(`integrations.maps.${k}`)}</label>
                <InputTextarea value={editing[k]} rows={6} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} className="w-full int-mono" /></div>
            ))}
            <div className="col-12 pe-muted">{t("integrations.mapHelp")} {t("integrations.defaultRequestMap")}: <span className="int-mono">{JSON.stringify(defaultMap)}</span></div>
            <div className="col-12 md:col-8 flex gap-2 align-items-end">
              <span className="flex-1"><label>{t("integrations.previewPolicy")}</label><InputText value={editing.policyNumber} onChange={(e) => setEditing({ ...editing, policyNumber: e.target.value })} className="w-full" /></span>
              <Button label={t("integrations.preview")} icon="pi pi-eye" outlined disabled={editing.isNew || !editing.policyNumber.trim()} onClick={runPreview} />
            </div>
            {preview && <div className="col-12"><pre className="pe-pre">{pretty(preview)}</pre></div>}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default InsurerIntegration;
