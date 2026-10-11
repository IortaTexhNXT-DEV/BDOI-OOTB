import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
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
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { openConfirm } from "../../components/ConfirmDialog";
import { humanize } from "../../components/ActivityLog";
import { IntTag, PageHeader, SEVERITY, dateTime, parseJson, pretty, showError, showSuccess } from "./common";

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
  // closing clears the connector one render before the effect clears the form
  if (!v || !connector) return null;
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
              {(connector.credentials || []).find((c) => c.envName === r.envName)?.present
                ? <Tag className="pe-tag" value={t("integrations.credentialSet")} severity="success" />
                : <Tag className="pe-tag" value={t("integrations.credentialNotSet")} severity="warning" />}
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

/** A message type in words: its label in the registry, else the code humanised ("policy.issued" -> "Policy issued"). */
const typeLabel = (types, code) => types.find((x) => x.type === code)?.label || humanize(String(code || "").replace(/\./g, " "));

const statusChip = (t, status) => ({ code: status, label: t(`integrations.status.${status}`, { defaultValue: humanize(status) }), severity: SEVERITY[status] });

/** Message detail: who and what it went to, the payload, the provider's answer and every attempt. */
const MessageDialog = ({ messageId, onHide, messageTypes }) => {
  const { t } = useTranslation();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!messageId) return;
    setM(null);
    setError(null);
    service.message(messageId).then(setM).catch((e) => setError(e.message));
  }, [messageId]);
  if (!messageId) return null;
  return (
    <DetailDialog visible onHide={onHide} header={t("integrations.messageDetail")} size="lg">
      {error && <div className="pe-error">{error}</div>}
      {m && (
        <>
          <DetailHeader
            title={`${t("integrations.message")} #${m.id}`}
            subtitle={typeLabel(messageTypes, m.messageType)}
            status={statusChip(t, m.status)}
            meta={[
              { label: t("integrations.connector"), value: m.connectorName || m.connectorCode },
              { label: t("integrations.mode"), value: t(`integrations.status.${m.mode}`, { defaultValue: humanize(m.mode) }) },
              { label: t("integrations.attempts"), value: `${m.attempts} / ${m.maxAttempts}` },
              { label: t("integrations.created"), value: m.createdAt, type: "datetime" },
            ]}
          />
          {m.lastError && <Message severity="error" text={m.lastError} className="w-full mb-3" />}
          <DetailSection title={t("integrations.messageFacts")}>
            <KeyValueGrid columns={3} items={[
              { label: t("integrations.reference"), value: m.reference },
              { label: t("integrations.externalRef"), value: m.externalRef },
              { label: t("integrations.record"), value: m.entity ? `${humanize(m.entity)} ${m.entityId || ""}`.trim() : null },
              { label: t("integrations.createdBy"), value: m.createdBy },
              { label: t("integrations.sentAt"), value: m.sentAt, type: "datetime" },
              { label: t("integrations.nextAttempt"), value: ["queued", "retry"].includes(m.status) ? m.nextAttemptAt : null, type: "datetime" },
            ]} />
          </DetailSection>
          <DetailSection title={t("integrations.content")}>
            <div className="grid">
              <div className="col-12 md:col-6"><h4 className="bv-int-pre-title">{t("integrations.payload")}</h4><pre className="pe-pre">{pretty(m.payload)}</pre></div>
              <div className="col-12 md:col-6"><h4 className="bv-int-pre-title">{t("integrations.response")}</h4><pre className="pe-pre">{pretty(m.response) || "-"}</pre></div>
            </div>
          </DetailSection>
          <DetailSection title={t("integrations.attempts")} flush>
            <DataTable value={m.attemptLog} size="small" stripedRows emptyMessage={t("integrations.noAttempts")}>
              <Column field="attempt" header="#" />
              <Column header={t("integrations.mode")} body={(a) => <IntTag status={a.mode} />} />
              <Column header={t("integrations.result")} body={(a) => <IntTag status={a.ok ? "sent" : "failed"} />} />
              <Column field="httpStatus" header="HTTP" />
              <Column field="durationMs" header={t("integrations.durationMs")} className="bv-num" headerClassName="bv-num" />
              <Column field="error" header={t("integrations.lastError")} style={{ maxWidth: "24rem", wordBreak: "break-word" }} />
              <Column header={t("integrations.at")} body={(a) => dateTime(a.at)} />
            </DataTable>
          </DetailSection>
        </>
      )}
    </DetailDialog>
  );
};

/** The outbox list with its filters, shared by the monitor and the screens that show their own messages. */
export const OutboxTable = ({ fixed = {}, connectors = [], messageTypes = [], toast, allowActions = true, listKey = "integration-outbox" }) => {
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
  // resend and cancel reach an outside system (SMS gateway, insurer, LTO): asked first, run inside the confirmation
  const act = async (row, action, fn) => {
    let r;
    setBusy(row.id);
    const done = await openConfirm({
      title: t(`integrations.outboxSteps.${action}.title`),
      severity: action === "cancel" ? "danger" : "warning",
      message: t(`integrations.outboxSteps.${action}.message`),
      facts: [
        { label: t("integrations.message"), value: `#${row.id}` },
        { label: t("integrations.messageType"), value: typeLabel(messageTypes, row.messageType) },
        { label: t("integrations.connector"), value: row.connectorName },
        { label: t("integrations.reference"), value: row.reference, hidden: !row.reference },
        { label: t("integrations.status.label"), value: t(`integrations.status.${row.status}`, { defaultValue: humanize(row.status) }) },
        { label: t("integrations.attempts"), value: `${row.attempts} / ${row.maxAttempts}` },
      ],
      confirmLabel: t(`integrations.outboxSteps.${action}.action`),
      onConfirm: async () => {
        r = await fn();
      },
    });
    setBusy(null);
    if (!done) return;
    showSuccess(toast, r?.message);
    list.reload();
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
        <Column header={t("integrations.messageType")} body={(r) => <div><div>{typeLabel(messageTypes, r.messageType)}</div><div className="pe-muted">{r.connectorName}</div></div>} />
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
                onClick={() => act(r, "resend", () => service.resend(r.id))} />
            )}
            {allowActions && ["queued", "retry", "failed", "skipped"].includes(r.status) && (
              <Button icon="pi pi-times" text rounded size="small" severity="danger" aria-label={t("integrations.cancelMessage")} tooltip={t("integrations.cancelMessage")} tooltipOptions={{ position: "top" }}
                onClick={() => act(r, "cancel", () => service.cancel(r.id))} />
            )}
          </span>
        )} />
      </DataTable>
      <MessageDialog messageId={detail} onHide={() => setDetail(null)} messageTypes={messageTypes} />
    </>
  );
};

const InboxTable = ({ toast, messageTypes = [] }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [detail, setDetail] = useState(null);
  const fetchPage = useCallback(({ page, pageSize }) => service.inbox({ status, page, pageSize }), [status]);
  const list = useServerList(fetchPage, { key: "integration-inbox" });
  const reprocess = async (r) => {
    let res;
    const done = await openConfirm({
      title: t("integrations.inboxSteps.reprocess.title"),
      severity: "warning",
      message: t("integrations.inboxSteps.reprocess.message"),
      facts: [
        { label: t("integrations.messageType"), value: typeLabel(messageTypes, r.messageType) },
        { label: t("integrations.source"), value: t(`integrations.sourceType.${r.source}`, { defaultValue: r.source }) },
        { label: t("integrations.reference"), value: r.externalRef || r.entityId },
        { label: t("integrations.received"), value: r.receivedAt, type: "datetime" },
      ],
      confirmLabel: t("integrations.inboxSteps.reprocess.action"),
      onConfirm: async () => {
        res = await service.reprocess(r.id);
      },
    });
    if (!done) return;
    showSuccess(toast, res?.message);
    list.reload();
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
        <Column header={t("integrations.messageType")} body={(r) => typeLabel(messageTypes, r.messageType)} />
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
      {detail ? (
        <DetailDialog visible onHide={() => setDetail(null)} header={t("integrations.inboxDetail")} size="lg">
          <DetailHeader
            title={`${t("integrations.inbox")} #${detail.id}`}
            subtitle={typeLabel(messageTypes, detail.messageType)}
            status={statusChip(t, detail.status)}
            meta={[
              { label: t("integrations.source"), value: t(`integrations.sourceType.${detail.source}`, { defaultValue: detail.source }) },
              { label: t("integrations.received"), value: detail.receivedAt, type: "datetime" },
              { label: t("integrations.attempts"), value: detail.attempts, type: "number" },
            ]}
          />
          {detail.lastError && <Message severity="error" text={detail.lastError} className="w-full mb-3" />}
          <DetailSection title={t("integrations.messageFacts")}>
            <KeyValueGrid columns={3} items={[
              { label: t("integrations.reference"), value: detail.externalRef },
              { label: t("integrations.record"), value: detail.entity ? `${humanize(detail.entity)} ${detail.entityId || ""}`.trim() : null },
              { label: t("integrations.connector"), value: detail.connectorCode },
              { label: t("integrations.receivedBy"), value: detail.receivedBy },
              { label: t("integrations.processedAt"), value: detail.processedAt, type: "datetime" },
              { label: t("integrations.signature"), value: detail.signatureValid === null || detail.signatureValid === undefined ? null : detail.signatureValid, type: "boolean" },
            ]} />
          </DetailSection>
          <DetailSection title={t("integrations.content")}>
            <div className="grid">
              <div className="col-12 md:col-6"><h4 className="bv-int-pre-title">{t("integrations.payload")}</h4><pre className="pe-pre">{pretty(detail.payload)}</pre></div>
              <div className="col-12 md:col-6"><h4 className="bv-int-pre-title">{t("integrations.result")}</h4><pre className="pe-pre">{pretty(detail.result) || "-"}</pre></div>
            </div>
          </DetailSection>
        </DetailDialog>
      ) : null}
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
            {tab === 1 && <OutboxTable connectors={connectors} messageTypes={registry.messageTypes} toast={toast} />}
          </TabPanel>
          <TabPanel header={t("integrations.inbox")}>
            {tab === 2 && <InboxTable toast={toast} messageTypes={registry.messageTypes} />}
          </TabPanel>
        </TabView>
      </div>
      <ConnectorDialog connector={editing} adapters={registry.adapters} toast={toast} onHide={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
};

export default IntegrationsMonitor;
