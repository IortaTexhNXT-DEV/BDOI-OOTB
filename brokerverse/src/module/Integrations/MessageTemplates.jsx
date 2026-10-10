import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { OutboxTable } from "./IntegrationsMonitor";
import { IntTag, PageHeader, showError, showSuccess } from "./common";

const EVENTS = ["renewal_notice", "payment_reminder", "claim_update", "ctpl_authenticated", "general"];
const CHANNELS = ["sms", "viber"];
const PURPOSES = ["none", "processing", "marketing"];
const EMPTY = { code: "", name: "", channel: "sms", event: "general", body: "", consentPurpose: "processing", connectorCode: null, active: true, description: "" };
const MESSAGE_FILTER = { messageType: "sms.send,viber.send" };

/**
 * Master > System Configuration > Message Templates: SMS and Viber texts per event (renewal notice, payment reminder,
 * claim update, CTPL authenticated, general) with their placeholders and the consent they need; a test message; the
 * messages sent to clients.
 */
const MessageTemplates = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [placeholders, setPlaceholders] = useState({});
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await service.templates();
      setRows(r.data || []);
      setPlaceholders(r.placeholders || {});
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    service.connectors().then((list) => setConnectors(list.filter((c) => ["sms", "messaging"].includes(c.kind)))).catch(() => null);
  }, [load]);

  const v = editing?.values;
  const set = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  useEffect(() => {
    if (!v?.body) {
      setPreview(null);
      return undefined;
    }
    const timer = setTimeout(() => service.previewTemplate(v.body).then((r) => setPreview(r.data)).catch(() => setPreview(null)), 300);
    return () => clearTimeout(timer);
  }, [v?.body]);

  const save = async () => {
    try {
      const body = { name: v.name, channel: v.channel, event: v.event, body: v.body, consentPurpose: v.consentPurpose, connectorCode: v.connectorCode || null, active: !!v.active, description: v.description || null };
      const r = editing.isNew ? await service.createTemplate({ code: v.code, ...body }) : await service.updateTemplate(v.code, body);
      showSuccess(toast, r.message);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const sendTest = async () => {
    try {
      const r = await service.testTemplate(testing.code, testTo);
      toast.current?.show({ severity: r.data.status === "sent" ? "success" : "warn", summary: testing.name, detail: r.message, life: 6000 });
      setTesting(null);
    } catch (e) {
      showError(toast, e);
    }
  };
  const connectorOptions = (channel) => [{ label: t("integrations.defaultConnector"), value: null },
    ...connectors.filter((c) => (channel === "viber" ? c.kind === "messaging" : c.kind === "sms")).map((c) => ({ label: c.name, value: c.code }))];

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Master")} section={t("sidebar.System Configuration")} title={t("integrations.templatesTitle")} subtitle={t("integrations.templatesIntro")}>
        <Button icon="pi pi-plus" label={t("integrations.newTemplate")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
      </PageHeader>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("integrations.templates")}>
            <DataTable value={rows} loading={loading} dataKey="code" size="small" stripedRows emptyMessage={t("integrations.noTemplates")}>
              <Column field="code" header={t("integrations.code")} />
              <Column header={t("integrations.name")} body={(r) => <div><div>{r.name}</div><div className="pe-muted">{r.body}</div></div>} style={{ maxWidth: "32rem" }} />
              <Column header={t("integrations.event")} body={(r) => t(`integrations.events.${r.event}`)} />
              <Column header={t("integrations.channel")} body={(r) => t(`integrations.channels.${r.channel}`)} />
              <Column header={t("integrations.consent")} body={(r) => t(`integrations.purposes.${r.consentPurpose}`)} />
              <Column header={t("integrations.status.label")} body={(r) => <IntTag status={r.active ? "active" : "closed"} />} />
              <Column header="" body={(r) => (
                <span className="flex gap-1">
                  <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.edit")} tooltip={t("integrations.edit")} tooltipOptions={{ position: "top" }}
                    onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, description: r.description || "" } })} />
                  <Button icon="pi pi-send" text rounded size="small" aria-label={t("integrations.sendTest")} tooltip={t("integrations.sendTest")} tooltipOptions={{ position: "top" }} onClick={() => setTesting(r)} />
                </span>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("integrations.messagesSent")}>
            {tab === 1 && <OutboxTable fixed={MESSAGE_FILTER} toast={toast} allowActions={false} listKey="messages-sent" />}
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("integrations.newTemplate") : t("integrations.editTemplate", { name: v.name || v.code })) : ""} visible={!!editing} style={{ width: "min(860px, 96vw)" }} onHide={() => setEditing(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setEditing(null)} /><Button label={t("integrations.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.name || !v?.body} /></div>}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-4"><label>{t("integrations.code")} *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("integrations.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.event")}</label>
              <Dropdown value={v.event} options={EVENTS.map((x) => ({ label: t(`integrations.events.${x}`), value: x }))} onChange={(e) => set({ event: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.channel")}</label>
              <Dropdown value={v.channel} options={CHANNELS.map((x) => ({ label: t(`integrations.channels.${x}`), value: x }))} onChange={(e) => set({ channel: e.value, connectorCode: null })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.consent")}</label>
              <Dropdown value={v.consentPurpose} options={PURPOSES.map((x) => ({ label: t(`integrations.purposes.${x}`), value: x }))} onChange={(e) => set({ consentPurpose: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("integrations.connector")}</label>
              <Dropdown value={v.connectorCode} options={connectorOptions(v.channel)} onChange={(e) => set({ connectorCode: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-2 mt-4">
              <Checkbox inputId="tpl-active" checked={!!v.active} onChange={(e) => set({ active: e.checked })} /><label htmlFor="tpl-active" className="m-0">{t("integrations.active")}</label>
            </div>
            <div className="col-12"><label>{t("integrations.body")} *</label>
              <InputTextarea value={v.body} rows={4} autoResize onChange={(e) => set({ body: e.target.value })} className="w-full" /></div>
            <div className="col-12 pe-muted">{t("integrations.placeholders")}: {Object.keys(placeholders).map((k) => `{{${k}}}`).join(" ")}</div>
            {preview && (
              <div className="col-12">
                <label>{t("integrations.preview")}</label>
                <pre className="pe-pre">{preview.text}</pre>
                <div className="pe-muted">{t("integrations.characters", { count: preview.length, parts: preview.parts })}</div>
              </div>
            )}
            <div className="col-12"><label>{t("integrations.description")}</label><InputText value={v.description} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={testing ? `${t("integrations.sendTest")}: ${testing.name}` : ""} visible={!!testing} style={{ width: "min(480px, 96vw)" }} onHide={() => setTesting(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setTesting(null)} /><Button label={t("integrations.send")} icon="pi pi-send" onClick={sendTest} disabled={testTo.trim().length < 7} /></div>}>
        <label htmlFor="tpl-test-to">{t("integrations.mobileNumber")}</label>
        <InputText id="tpl-test-to" value={testTo} placeholder="0917 123 4567" onChange={(e) => setTestTo(e.target.value)} className="w-full" />
        <p className="pe-muted">{t("integrations.testHelp")}</p>
      </Dialog>
    </div>
  );
};

export default MessageTemplates;
