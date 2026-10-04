import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import { IntTag, PageHeader, dateTime, parseJson, pretty, showError, showSuccess } from "./common";

const OUTBOX_STATUSES = ["queued", "retry", "processing", "sent", "failed", "cancelled", "skipped"];
const INBOX_STATUSES = ["received", "processed", "failed", "ignored"];

/** Connector settings dialog: mode, endpoint, credential variable names (never values), options and retry policy. */
const ConnectorDialog = ({ connector, adapters, onHide, onSaved, toast }) => {
  const { t } = useTranslation();
  const [v, setV] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!connector) {
      setV(null);
      return;
    }
    setV({ ...connector, endpoint: connector.endpoint || "", options: pretty(connector.options),
      credentialRows: Object.entries(connector.credentialEnv || {}).map(([key, envName]) => ({ key, envName })) });
  }, [connector]);
  if (!v) return null;
  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const setCred = (i, patch) => set({ credentialRows: v.credentialRows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const save = async () => {
    const [options, err] = parseJson(v.options, {});
    if (err) {
      showError(toast, new Error(`${t("integrations.options")}: ${err}`));
      return;
    }
    setSaving(true);
    try {
      const credentialEnv = Object.fromEntries(v.credentialRows.filter((r) => r.key).map((r) => [r.key.trim(), r.envName.trim()]));
      const r = await service.updateConnector(v.code, { name: v.name, enabled: v.enabled, mode: v.mode, adapter: v.adapter, endpoint: v.endpoint || null, credentialEnv, options,
        timeoutMs: v.timeoutMs, maxAttempts: v.maxAttempts, retryBaseSeconds: v.retryBaseSeconds, retryMaxSeconds: v.retryMaxSeconds, description: v.description || null });
      showSuccess(toast, r.message);
      onSaved();
    } catch (e) {
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };
  const adapterOptions = adapters.filter((a) => a.kinds.includes(v.kind)).map((a) => ({ label: a.label, value: a.code }));
  return (
    <Dialog className="pe-dialog" header={`${v.name} (${v.code})`} visible onHide={onHide} style={{ width: "min(900px, 96vw)" }}
      footer={<div><Button label={t("integrations.cancel")} text onClick={onHide} /><Button label={t("integrations.save")} icon="pi pi-save" loading={saving} onClick={save} /></div>}>
      <div className="grid">
        <div className="col-12 md:col-6"><label>{t("integrations.name")}</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
        <div className="col-12 md:col-6"><label>{t("integrations.adapter")}</label>
          <Dropdown value={v.adapter} options={adapterOptions} onChange={(e) => set({ adapter: e.value })} className="w-full" /></div>
        <div className="col-12 md:col-4"><label>{t("integrations.mode")}</label>
          <Dropdown value={v.mode} options={["test", "live"].map((m) => ({ label: t(`integrations.status.${m}`), value: m }))} onChange={(e) => set({ mode: e.value })} className="w-full" /></div>
        <div className="col-12 md:col-8 flex align-items-center gap-2 mt-4">
          <Checkbox inputId="conn-enabled" checked={!!v.enabled} onChange={(e) => set({ enabled: e.checked })} /><label htmlFor="conn-enabled" className="m-0">{t("integrations.enabled")}</label>
        </div>
        <div className="col-12"><label>{t("integrations.endpoint")}</label><InputText value={v.endpoint} placeholder="https://" onChange={(e) => set({ endpoint: e.target.value })} className="w-full" /></div>
        <div className="col-12">
          <label>{t("integrations.credentials")}</label>
          <p className="pe-muted mt-1 mb-2">{t("integrations.credentialsHelp")}</p>
          {v.credentialRows.map((r, i) => (
            <div className="flex gap-2 mb-2 align-items-center" key={i}>
              <InputText value={r.key} placeholder={t("integrations.credentialKey")} onChange={(e) => setCred(i, { key: e.target.value })} style={{ width: "12rem" }} aria-label={t("integrations.credentialKey")} />
              <InputText value={r.envName} placeholder="ENVIRONMENT_VARIABLE" onChange={(e) => setCred(i, { envName: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} className="flex-1" aria-label={t("integrations.envName")} />
              <IntTag status={(connector.credentials || []).find((c) => c.envName === r.envName)?.present ? "sent" : "not-sent"} />
              <Button icon="pi pi-trash" text severity="danger" aria-label={t("integrations.remove")} onClick={() => set({ credentialRows: v.credentialRows.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button icon="pi pi-plus" label={t("integrations.addCredential")} text size="small" onClick={() => set({ credentialRows: [...v.credentialRows, { key: "", envName: "" }] })} />
        </div>
        <div className="col-12"><label>{t("integrations.options")}</label>
          <InputTextarea value={v.options} rows={8} onChange={(e) => set({ options: e.target.value })} className="w-full" style={{ fontFamily: "monospace" }} /></div>
        <div className="col-6 md:col-3"><label>{t("integrations.timeoutMs")}</label><InputNumber value={v.timeoutMs} min={1000} max={120000} onValueChange={(e) => set({ timeoutMs: e.value })} className="w-full" /></div>
        <div className="col-6 md:col-3"><label>{t("integrations.maxAttempts")}</label><InputNumber value={v.maxAttempts} min={1} max={20} onValueChange={(e) => set({ maxAttempts: e.value })} className="w-full" /></div>
        <div className="col-6 md:col-3"><label>{t("integrations.retryBase")}</label><InputNumber value={v.retryBaseSeconds} min={1} onValueChange={(e) => set({ retryBaseSeconds: e.value })} className="w-full" /></div>
        <div className="col-6 md:col-3"><label>{t("integrations.retryMax")}</label><InputNumber value={v.retryMaxSeconds} min={1} onValueChange={(e) => set({ retryMaxSeconds: e.value })} className="w-full" /></div>
        <div className="col-12"><label>{t("integrations.description")}</label><InputText value={v.description || ""} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
      </div>
    </Dialog>
  );
};

/** Message detail: payload, the provider's answer and every attempt. */
const MessageDialog = ({ messageId, onHide }) => {
  const { t } = useTranslation();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!messageId) return;
    setM(null);
    setError(null);
    service.message(messageId).then(setM).catch((e) => setError(e.message));
  }, [messageId]);
  return (
    <Dialog className="pe-dialog" header={messageId ? `${t("integrations.message")} #${messageId}` : ""} visible={!!messageId} onHide={onHide} style={{ width: "min(900px, 96vw)" }}>
      {error && <div className="pe-error">{error}</div>}
      {m && (
        <div className="grid">
          <div className="col-12 md:col-6"><strong>{t("integrations.messageType")}:</strong> {m.messageType}</div>
          <div className="col-12 md:col-6"><strong>{t("integrations.status.label")}:</strong> <IntTag status={m.status} /> <IntTag status={m.mode} /></div>
          <div className="col-12 md:col-6"><strong>{t("integrations.reference")}:</strong> {m.reference || "-"}</div>
          <div className="col-12 md:col-6"><strong>{t("integrations.externalRef")}:</strong> {m.externalRef || "-"}</div>
          {m.lastError && <div className="col-12"><Message severity="error" text={m.lastError} className="w-full" /></div>}
          <div className="col-12 md:col-6"><label>{t("integrations.payload")}</label><pre className="pe-pre">{pretty(m.payload)}</pre></div>
          <div className="col-12 md:col-6"><label>{t("integrations.response")}</label><pre className="pe-pre">{pretty(m.response) || "-"}</pre></div>
          <div className="col-12">
            <DataTable value={m.attemptLog} size="small" stripedRows emptyMessage={t("integrations.noAttempts")}>
              <Column field="attempt" header="#" />
              <Column header={t("integrations.mode")} body={(a) => <IntTag status={a.mode} />} />
              <Column header={t("integrations.result")} body={(a) => <IntTag status={a.ok ? "sent" : "failed"} />} />
              <Column field="httpStatus" header="HTTP" />
              <Column field="durationMs" header={t("integrations.durationMs")} />
              <Column field="error" header={t("integrations.lastError")} style={{ maxWidth: "24rem", wordBreak: "break-word" }} />
              <Column header={t("integrations.at")} body={(a) => dateTime(a.at)} />
            </DataTable>
          </div>
        </div>
      )}
    </Dialog>
  );
};

/** The outbox list with its filters, shared by the monitor and the screens that show their own messages. */
export const OutboxTable = ({ fixed = {}, connectors = [], toast, allowActions = true, listKey = "integration-outbox" }) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ status: null, connectorCode: null, search: "" });
  const [counts, setCounts] = useState({});
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(null);
  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const r = await service.outbox({ ...fixed, ...filters, search: filters.search.trim(), page, pageSize });
    setCounts(r.counts);
    return r;
  }, [filters, fixed]);
  const list = useServerList(fetchPage, { key: listKey });
  const act = async (row, fn) => {
    setBusy(row.id);
    try {
      const r = await fn();
      showSuccess(toast, r.message);
      list.reload();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <div className="pe-filters mb-2">
        <span className="p-input-icon-left"><i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("integrations.searchMessages")} aria-label={t("integrations.searchMessages")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></span>
        <Dropdown value={filters.status} showClear placeholder={t("integrations.allStatuses")} aria-label={t("integrations.status.label")}
          options={OUTBOX_STATUSES.map((s) => ({ label: `${t(`integrations.status.${s}`)} (${counts[s] || 0})`, value: s }))} onChange={(e) => setFilters((f) => ({ ...f, status: e.value }))} />
        {!fixed.connectorCode && connectors.length > 0 && (
          <Dropdown value={filters.connectorCode} showClear placeholder={t("integrations.allConnectors")} aria-label={t("integrations.connector")}
            options={connectors.map((c) => ({ label: c.name, value: c.code }))} onChange={(e) => setFilters((f) => ({ ...f, connectorCode: e.value }))} />
        )}
        <Button icon="pi pi-refresh" outlined aria-label={t("integrations.refresh")} onClick={list.reload} />
      </div>
      <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("integrations.noMessages")}>
        <Column field="id" header="#" />
        <Column header={t("integrations.status.label")} body={(r) => <IntTag status={r.status} />} />
        <Column header={t("integrations.messageType")} body={(r) => <div><div>{r.messageType}</div><div className="pe-muted">{r.connectorName}</div></div>} />
        <Column field="reference" header={t("integrations.reference")} />
        <Column header={t("integrations.attempts")} body={(r) => `${r.attempts} / ${r.maxAttempts}`} />
        <Column header={t("integrations.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "20rem", wordBreak: "break-word" }} />
        <Column header={t("integrations.nextAttempt")} body={(r) => (["queued", "retry"].includes(r.status) ? dateTime(r.nextAttemptAt) : "-")} />
        <Column header={t("integrations.created")} body={(r) => dateTime(r.createdAt)} />
        <Column header="" body={(r) => (
          <span className="flex gap-1">
            <Button icon="pi pi-eye" text rounded size="small" aria-label={t("integrations.view")} tooltip={t("integrations.view")} tooltipOptions={{ position: "top" }} onClick={() => setDetail(r.id)} />
            {allowActions && !["sent", "processing"].includes(r.status) && (
              <Button icon="pi pi-replay" text rounded size="small" loading={busy === r.id} aria-label={t("integrations.resend")} tooltip={t("integrations.resend")} tooltipOptions={{ position: "top" }}
                onClick={() => act(r, () => service.resend(r.id))} />
            )}
            {allowActions && ["queued", "retry", "failed", "skipped"].includes(r.status) && (
              <Button icon="pi pi-times" text rounded size="small" severity="danger" aria-label={t("integrations.cancelMessage")} tooltip={t("integrations.cancelMessage")} tooltipOptions={{ position: "top" }}
                onClick={() => act(r, () => service.cancel(r.id))} />
            )}
          </span>
        )} />
      </DataTable>
      <MessageDialog messageId={detail} onHide={() => setDetail(null)} />
    </>
  );
};

const InboxTable = ({ toast }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [detail, setDetail] = useState(null);
  const fetchPage = useCallback(({ page, pageSize }) => service.inbox({ status, page, pageSize }), [status]);
  const list = useServerList(fetchPage, { key: "integration-inbox" });
  const reprocess = async (r) => {
    try {
      const res = await service.reprocess(r.id);
      showSuccess(toast, res.message);
      list.reload();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <>
      <div className="pe-filters mb-2">
        <Dropdown value={status} showClear placeholder={t("integrations.allStatuses")} aria-label={t("integrations.status.label")}
          options={INBOX_STATUSES.map((s) => ({ label: t(`integrations.status.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} />
        <Button icon="pi pi-refresh" outlined aria-label={t("integrations.refresh")} onClick={list.reload} />
      </div>
      <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("integrations.noMessages")}>
        <Column field="id" header="#" />
        <Column header={t("integrations.status.label")} body={(r) => <IntTag status={r.status} />} />
        <Column field="messageType" header={t("integrations.messageType")} />
        <Column header={t("integrations.source")} body={(r) => t(`integrations.sourceType.${r.source}`, { defaultValue: r.source })} />
        <Column header={t("integrations.reference")} body={(r) => r.externalRef || r.entityId || "-"} />
        <Column header={t("integrations.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "20rem", wordBreak: "break-word" }} />
        <Column header={t("integrations.received")} body={(r) => dateTime(r.receivedAt)} />
        <Column header="" body={(r) => (
          <span className="flex gap-1">
            <Button icon="pi pi-eye" text rounded size="small" aria-label={t("integrations.view")} onClick={() => setDetail(r)} />
            {r.status === "failed" && <Button icon="pi pi-replay" text rounded size="small" aria-label={t("integrations.reprocess")} tooltip={t("integrations.reprocess")} onClick={() => reprocess(r)} />}
          </span>
        )} />
      </DataTable>
      <Dialog className="pe-dialog" header={detail ? `${t("integrations.inbox")} #${detail.id}` : ""} visible={!!detail} onHide={() => setDetail(null)} style={{ width: "min(800px, 96vw)" }}>
        {detail && (
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("integrations.payload")}</label><pre className="pe-pre">{pretty(detail.payload)}</pre></div>
            <div className="col-12 md:col-6"><label>{t("integrations.result")}</label><pre className="pe-pre">{pretty(detail.result) || "-"}</pre></div>
          </div>
        )}
      </Dialog>
    </>
  );
};

/**
 * Master > System Configuration > Integrations: every connector (SMS, Viber, CTPL authentication, LTO feed, insurer
 * APIs, bank files) with its mode, credentials by environment variable name and health; the outbox with resend and
 * cancel; the inbox of pushed messages and imported files.
 */
const IntegrationsMonitor = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [connectors, setConnectors] = useState([]);
  const [registry, setRegistry] = useState({ adapters: [], messageTypes: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [testing, setTesting] = useState(null);
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnectors(await service.connectors());
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); service.registry().then(setRegistry).catch(() => null); }, [load]);

  const test = async (c) => {
    setTesting(c.code);
    try {
      const r = await service.testConnector(c.code);
      toast.current?.show({ severity: r.data.ok ? "success" : "error", summary: c.name, detail: r.data.detail, life: 7000 });
    } catch (e) {
      showError(toast, e);
    } finally {
      setTesting(null);
    }
  };
  const processDue = async () => {
    try {
      const r = await service.processDue();
      showSuccess(toast, r.message);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Master")} section={t("sidebar.System Configuration")} title={t("integrations.monitorTitle")} subtitle={t("integrations.monitorIntro")}>
        <Button icon="pi pi-send" label={t("integrations.processDue")} outlined onClick={processDue} />
      </PageHeader>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("integrations.connectors")}>
            <DataTable value={connectors} loading={loading} dataKey="code" size="small" stripedRows>
              <Column header={t("integrations.connector")} body={(c) => <div><div>{c.name}</div><div className="pe-muted">{c.code} · {c.adapterLabel}</div></div>} />
              <Column header={t("integrations.kind")} body={(c) => t(`integrations.kinds.${c.kind}`, { defaultValue: c.kind })} />
              <Column header={t("integrations.mode")} body={(c) => <span className="flex gap-1"><IntTag status={c.mode} />{!c.enabled && <IntTag status="cancelled" />}</span>} />
              <Column header={t("integrations.credentials")} body={(c) => (c.credentials.length ? c.credentials.map((x) => (
                <div key={x.key} className="white-space-nowrap"><i className={`pi ${x.present ? "pi-check-circle text-green-600" : "pi-exclamation-circle text-orange-600"} mr-1`} aria-hidden="true" />{x.envName || x.key}</div>
              )) : "-")} />
              <Column header={t("integrations.health")} body={(c) => (
                <div>
                  <div>{t("integrations.waiting")}: {c.queued} · {t("integrations.status.failed")}: {c.failed} · {t("integrations.sentToday")}: {c.sentToday}</div>
                  {c.mode === "live" || !c.liveBlockers.length ? null : <div className="pe-muted">{t("integrations.beforeLive")}: {c.liveBlockers.join("; ")}</div>}
                </div>
              )} />
              <Column header={t("integrations.lastSuccess")} body={(c) => dateTime(c.lastSuccessAt)} />
              <Column header={t("integrations.lastFailure")} body={(c) => dateTime(c.lastFailureAt)} />
              <Column header="" body={(c) => (
                <span className="flex gap-1">
                  <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.edit")} tooltip={t("integrations.edit")} tooltipOptions={{ position: "top" }} onClick={() => setEditing(c)} />
                  <Button icon="pi pi-bolt" text rounded size="small" loading={testing === c.code} aria-label={t("integrations.testConnection")} tooltip={t("integrations.testConnection")} tooltipOptions={{ position: "top" }} onClick={() => test(c)} />
                </span>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("integrations.outbox")}>
            {tab === 1 && <OutboxTable connectors={connectors} toast={toast} />}
          </TabPanel>
          <TabPanel header={t("integrations.inbox")}>
            {tab === 2 && <InboxTable toast={toast} />}
          </TabPanel>
        </TabView>
      </div>
      <ConnectorDialog connector={editing} adapters={registry.adapters} toast={toast} onHide={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
};

export default IntegrationsMonitor;
