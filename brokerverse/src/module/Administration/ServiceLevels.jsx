import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import PageHeader from "../../components/PageHeader";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import slaService from "../../services/slaService";
import { hasPermission } from "../../utils/canOpen";
import { formatInstant } from "../../utility/dateFormat";
import "./index.scss";

const DOCUMENTS = ["lead", "quotation", "placement", "policy", "endorsement", "cancellation", "claim", "renewal"];

/**
 * Master > System Configuration > Service Levels (TIS IT AppSupport / Admin): the turnaround of every status a
 * document waits in (hours, working time, escalation roles) and the open clocks of the items against them.
 */
const ServiceLevels = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`serviceLevels.${key}`, opts);
  const toast = useRef(null);
  const [document, setDocument] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [roles, setRoles] = useState([]);
  const [breachedOnly, setBreachedOnly] = useState(false);
  const canWrite = hasPermission("write:settings");
  const loader = useCallback(() => slaService.list(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const clocksLoader = useCallback(() => slaService.clocks({ breached: breachedOnly ? "true" : "" }), [breachedOnly]);
  const clocks = useStableLoad(clocksLoader);
  const rows = useMemo(() => (data?.data || []).filter((r) => !document || r.document === document), [data, document]);
  const summary = data?.summary || {};
  useEffect(() => {
    slaService.roles().then((list) => setRoles(list.map((r) => ({ label: r.name, value: r.code })))).catch(() => setRoles([]));
  }, []);

  const error$ = (e) => toast.current?.show({ severity: "error", summary: k("title"), detail: e.message, life: 6000 });
  const save = async () => {
    setSaving(true);
    try {
      await slaService.update(edit.code, { name: edit.name, targetHours: edit.targetHours, workingTime: !!edit.workingTime, escalateToRoles: edit.escalateToRoles || [], active: !!edit.active });
      toast.current?.show({ severity: "success", summary: edit.name, detail: k("saved") });
      setEdit(null);
      reload();
    } catch (e) {
      error$(e);
    } finally {
      setSaving(false);
    }
  };
  const run = async () => {
    setRunning(true);
    try {
      const r = await slaService.run();
      toast.current?.show({ severity: "success", summary: k("title"), detail: k("runDone", r) });
      reload();
      clocks.reload();
    } catch (e) {
      error$(e);
    } finally {
      setRunning(false);
    }
  };
  const documentLabel = (d) => k(`documents.${d}`, { defaultValue: d });
  const hours = (r) => (r.workingTime ? k("workingHours", { count: r.targetHours }) : k("calendarHours", { count: r.targetHours }));

  return (
    <div className="admin__page sl-page">
      <Toast ref={toast} />
      <PageHeader title={k("title")} home={t("sidebar.Master")} section={t("sidebar.System Configuration")} trail={[k("title")]} help={k("help")}
        actions={canWrite ? <Button type="button" icon="pi pi-play" label={k("runNow")} outlined loading={running} onClick={run} /> : null} />
      <div className="dn__stats">
        <div className="dn__stat"><span className="dn__stat-value">{summary.open ?? 0}</span><span className="dn__stat-label">{k("statOpen")}</span></div>
        <div className="dn__stat"><span className="dn__stat-value">{summary.dueSoon ?? 0}</span><span className="dn__stat-label">{k("statDueSoon")}</span></div>
        <div className="dn__stat"><span className="dn__stat-value">{summary.breached ?? 0}</span><span className="dn__stat-label">{k("statBreached")}</span></div>
      </div>
      <TabView>
        <TabPanel header={k("tabs.register")}>
          <div className="bv-list-toolbar">
            <Dropdown value={document} options={DOCUMENTS.map((d) => ({ label: documentLabel(d), value: d }))} onChange={(e) => setDocument(e.value ?? null)} placeholder={k("allDocuments")} showClear className="bv-list-filter" aria-label={k("columns.document")} />
          </div>
          <div className="bv-loading-host">
            <LoadingBar active={refreshing} />
            <DataTable value={rows} dataKey="code" size="small" stripedRows loading={loading} emptyMessage={error || k("empty")} className="fr-table" data-testid="service-levels">
              <Column header={k("columns.name")} body={(r) => <span className="dn__name"><span className="dn__name-title">{r.name}</span><span className="dn__name-code">{r.code}</span></span>} style={{ minWidth: "16rem" }} />
              <Column header={k("columns.document")} body={(r) => documentLabel(r.document)} />
              <Column header={k("columns.target")} body={hours} />
              <Column header={k("columns.escalation")} body={(r) => (r.escalateToRoles || []).map((c) => roles.find((x) => x.value === c)?.label || c).join(", ") || "-"} />
              <Column header={k("columns.monitored")} body={(r) => <StatusChip label={r.monitored ? k("monitored") : k("register")} severity={r.monitored ? "info" : "secondary"} />} />
              <Column header={k("columns.status")} body={(r) => <StatusChip label={r.active ? t("numberingMasters.active") : t("numberingMasters.inactive")} severity={r.active ? "success" : "secondary"} />} />
              <Column header="" body={(r) => (canWrite ? <Button icon="pi pi-pencil" rounded text aria-label={t("numberingMasters.edit")} tooltip={t("numberingMasters.edit")} tooltipOptions={{ position: "top" }} onClick={() => setEdit({ ...r })} /> : null)} style={{ width: "4rem" }} />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={k("tabs.clocks", { count: summary.open ?? 0 })}>
          <div className="bv-list-toolbar">
            <div className="admin__field admin__field--inline">
              <InputSwitch inputId="sl-breached" checked={breachedOnly} onChange={(e) => setBreachedOnly(e.value)} />
              <label htmlFor="sl-breached">{k("breachedOnly")}</label>
            </div>
          </div>
          <div className="bv-loading-host">
            <LoadingBar active={clocks.refreshing} />
            <DataTable value={clocks.data || []} dataKey="id" size="small" stripedRows loading={clocks.loading} paginator rows={25} emptyMessage={clocks.error || k("noClocks")} className="fr-table" data-testid="service-level-clocks">
              <Column header={k("columns.item")} body={(r) => `${r.title || ""} ${r.ref || ""}`.trim()} />
              <Column header={k("columns.client")} field="clientName" />
              <Column header={k("columns.name")} field="targetName" />
              <Column header={k("columns.owner")} field="ownerName" />
              <Column header={k("columns.started")} body={(r) => formatInstant(r.startedAt)} />
              <Column header={k("columns.due")} body={(r) => formatInstant(r.dueAt)} />
              <Column header={k("columns.status")} body={(r) => <StatusChip label={r.breachedAt ? k("breached") : k("running")} severity={r.breachedAt ? "danger" : "info"} />} />
            </DataTable>
          </div>
        </TabPanel>
      </TabView>

      <Dialog header={edit ? k("editTitle", { name: edit.name }) : ""} visible={!!edit} onHide={() => setEdit(null)} style={{ width: "min(640px, 96vw)" }}
        footer={<div><Button label={t("numberingMasters.cancel")} text onClick={() => setEdit(null)} /><Button label={t("numberingMasters.save")} icon="pi pi-check" onClick={save} loading={saving} disabled={!edit || !(edit.targetHours > 0)} /></div>}>
        {edit && (
          <div className="dn__form">
            <div className="admin__grid">
              <div className="admin__field">
                <label htmlFor="sl-name">{k("columns.name")}</label>
                <InputText id="sl-name" value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} />
              </div>
              <div className="admin__field">
                <label htmlFor="sl-hours">{k("form.targetHours")}</label>
                <InputNumber inputId="sl-hours" value={edit.targetHours} min={0.5} max={9999} minFractionDigits={0} maxFractionDigits={2} onValueChange={(e) => setEdit((x) => ({ ...x, targetHours: e.value }))} />
              </div>
              <div className="admin__field admin__field--inline">
                <label htmlFor="sl-working">{k("form.workingTime")}</label>
                <InputSwitch inputId="sl-working" checked={!!edit.workingTime} onChange={(e) => setEdit((x) => ({ ...x, workingTime: e.value }))} />
              </div>
              <div className="admin__field admin__field--inline">
                <label htmlFor="sl-active">{t("numberingMasters.active")}</label>
                <InputSwitch inputId="sl-active" checked={!!edit.active} onChange={(e) => setEdit((x) => ({ ...x, active: e.value }))} />
              </div>
            </div>
            <div className="admin__field">
              <label htmlFor="sl-roles">{k("form.escalateTo")}</label>
              <MultiSelect inputId="sl-roles" value={edit.escalateToRoles || []} options={roles} onChange={(e) => setEdit((x) => ({ ...x, escalateToRoles: e.value }))} display="chip" filter className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ServiceLevels;
