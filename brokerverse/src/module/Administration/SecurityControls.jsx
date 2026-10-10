import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import PageHeader from "../../components/PageHeader";
import LoadingBar from "../../components/LoadingBar";
import DetailDialog from "../../components/DetailDialog";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import DateField from "../../components/DateField";
import { useStableLoad } from "../../hooks/useStableLoad";
import adminService from "../../services/adminService";
import { hasPermission } from "../../utils/canOpen";
import { formatDate, formatInstant } from "../../utility/dateFormat";
import "./index.scss";

const STATUS_SEVERITY = { met: "success", review: "warning", "not-met": "danger", pending: "secondary" };
const RESULTS = ["met", "not-met", "review"];
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Master > System Configuration > Security Controls (TIS IT AppSupport / Admin): the security, data-protection and
 * operational controls of the BRD with their current state against the target, and the dated evidence of the
 * controls met outside the application (backups, monitoring, scans, drills, certifications).
 */
const SecurityControls = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`securityControls.${key}`, opts);
  const navigate = useNavigate();
  const toast = useRef(null);
  const [group, setGroup] = useState(null);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(null);
  const [history, setHistory] = useState([]);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ evidenceDate: today(), result: "met", reference: "", remarks: "" });
  const canRecord = hasPermission("write:settings");
  const loader = useCallback(() => adminService.getControls(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const rows = useMemo(() => (data?.data || []).filter((r) => (!group || r.group === group) && (!status || r.status === status)), [data, group, status]);
  const groups = useMemo(() => (data?.groups || []).map((g) => ({ label: k(`groups.${g.code}`, { defaultValue: g.label }), value: g.code })), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusOptions = ["met", "review", "not-met", "pending"].map((s) => ({ label: k(`status.${s}`), value: s }));
  const counts = useMemo(() => (data?.data || []).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}), [data]);

  const openDetail = async (r) => {
    setOpen(r);
    setHistory([]);
    try {
      setHistory(await adminService.getControlEvidence(r.key));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("title"), detail: e.message });
    }
  };
  const startRecord = (r) => {
    setForm({ evidenceDate: today(), result: "met", reference: "", remarks: "" });
    setRecord(r);
  };
  const saveEvidence = async () => {
    await adminService.recordControlEvidence(record.key, { ...form, remarks: form.remarks || null });
    toast.current?.show({ severity: "success", summary: record.name, detail: k("evidenceRecorded") });
    setRecord(null);
    reload();
    if (open?.key === record.key) openDetail(record);
  };
  const statusChip = (s) => <StatusChip label={k(`status.${s}`)} severity={STATUS_SEVERITY[s] || "secondary"} />;
  const nameBody = (r) => <Button type="button" link label={r.name} className="fr-link" onClick={() => openDetail(r)} />;
  const actions = (r) => (
    <div className="admin__actions">
      {r.kind === "evidence" && canRecord ? (
        <Button icon="pi pi-plus" rounded text aria-label={k("recordEvidence")} tooltip={k("recordEvidence")} tooltipOptions={{ position: "top" }} onClick={() => startRecord(r)} />
      ) : null}
      {r.managedBy?.path && canRecord ? (
        <Button icon="pi pi-cog" rounded text aria-label={k("configure")} tooltip={k("configure")} tooltipOptions={{ position: "top" }} onClick={() => navigate(r.managedBy.path)} />
      ) : null}
    </div>
  );

  return (
    <div className="admin__page sc-page">
      <Toast ref={toast} />
      <PageHeader title={k("title")} home={t("sidebar.Master")} section={t("sidebar.System Configuration")} trail={[k("title")]} help={k("help")}
        actions={<Button type="button" icon="pi pi-refresh" label={t("numberingMasters.refresh")} outlined loading={refreshing} onClick={() => reload()} />} />
      <div className="dn__stats">
        {["met", "review", "not-met", "pending"].map((s) => (
          <div className="dn__stat" key={s}>
            <span className="dn__stat-value">{counts[s] || 0}</span>
            <span className="dn__stat-label">{k(`status.${s}`)}</span>
          </div>
        ))}
      </div>
      <div className="bv-list-toolbar">
        <Dropdown value={group} options={groups} onChange={(e) => setGroup(e.value ?? null)} placeholder={k("allGroups")} showClear className="bv-list-filter" aria-label={k("columns.group")} />
        <Dropdown value={status} options={statusOptions} onChange={(e) => setStatus(e.value ?? null)} placeholder={k("allStatuses")} showClear className="bv-list-filter" aria-label={k("columns.status")} />
      </div>
      <div className="bv-loading-host">
        <LoadingBar active={refreshing} />
        <DataTable value={rows} dataKey="key" size="small" stripedRows loading={loading} rowGroupMode="subheader" groupRowsBy="groupLabel" sortField="groupLabel" sortOrder={1}
          rowGroupHeaderTemplate={(r) => <strong>{k(`groups.${r.group}`, { defaultValue: r.groupLabel })}</strong>}
          emptyMessage={error || k("empty")} className="fr-table" data-testid="security-controls">
          <Column header={k("columns.control")} body={nameBody} style={{ minWidth: "16rem" }} />
          <Column header={k("columns.requirements")} body={(r) => (r.requirements || []).join(", ")} style={{ maxWidth: "16rem" }} />
          <Column header={k("columns.current")} field="current" style={{ minWidth: "18rem" }} />
          <Column header={k("columns.target")} field="target" style={{ minWidth: "16rem" }} />
          <Column header={k("columns.status")} body={(r) => statusChip(r.status)} />
          <Column header={k("columns.evidence")} body={(r) => (r.evidence ? `${formatDate(r.evidence.evidenceDate)} · ${r.evidence.reference || ""}` : "-")} />
          <Column header="" body={actions} style={{ width: "6.5rem" }} />
        </DataTable>
      </div>

      <DetailDialog visible={!!open} onHide={() => setOpen(null)} header={open?.name} size="md">
        {open ? (
          <>
            <DetailSection title={k("detail.control")}>
              <KeyValueGrid columns={2} items={[
                { label: k("columns.group"), value: k(`groups.${open.group}`, { defaultValue: open.groupLabel }) },
                { label: k("columns.status"), value: statusChip(open.status) },
                { label: k("columns.requirements"), value: (open.requirements || []).join(", "), span: "full" },
                { label: k("columns.current"), value: open.current, span: "full" },
                { label: k("columns.target"), value: open.target, span: "full" },
                ...(open.managedBy ? [{ label: k("managedBy"), value: open.managedBy.screen, span: "full" }] : []),
              ]} />
            </DetailSection>
            <DetailSection title={k("detail.evidence")} actions={open.kind === "evidence" && canRecord ? <Button type="button" icon="pi pi-plus" label={k("recordEvidence")} outlined size="small" onClick={() => startRecord(open)} /> : null}>
              <DataTable value={history} dataKey="id" size="small" emptyMessage={k("noEvidence")}>
                <Column header={k("form.evidenceDate")} body={(e) => formatDate(e.evidenceDate)} />
                <Column header={k("form.result")} body={(e) => statusChip(e.result)} />
                <Column header={k("form.reference")} field="reference" />
                <Column header={k("form.remarks")} field="remarks" />
                <Column header={k("recordedBy")} body={(e) => `${e.recordedBy || ""} · ${formatInstant(e.recordedAt)}`} />
              </DataTable>
            </DetailSection>
          </>
        ) : null}
      </DetailDialog>

      <ConfirmDialog visible={!!record} onHide={() => setRecord(null)} title={record ? k("recordTitle", { name: record.name }) : ""} message={k("recordMessage")}
        facts={record ? [{ label: k("columns.target"), value: record.target }] : []} confirmLabel={k("recordEvidence")} confirmIcon="pi pi-check"
        beforeConfirm={() => !!form.reference.trim() && !!form.evidenceDate} onConfirm={saveEvidence}>
        <div className="admin__grid">
          <div className="admin__field">
            <label htmlFor="sc-date">{k("form.evidenceDate")}</label>
            <DateField id="sc-date" name="evidenceDate" value={form.evidenceDate} max={today()} onChange={(e) => setForm((f) => ({ ...f, evidenceDate: e.target.value }))} />
          </div>
          <div className="admin__field">
            <label htmlFor="sc-result">{k("form.result")}</label>
            <Dropdown inputId="sc-result" value={form.result} options={RESULTS.map((r) => ({ label: k(`status.${r}`), value: r }))} onChange={(e) => setForm((f) => ({ ...f, result: e.value }))} />
          </div>
        </div>
        <div className="admin__field">
          <label htmlFor="sc-reference">{k("form.reference")}</label>
          <InputText id="sc-reference" value={form.reference} maxLength={200} className={!form.reference.trim() ? "p-invalid" : undefined} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
        </div>
        <div className="admin__field">
          <label htmlFor="sc-remarks">{k("form.remarks")}</label>
          <InputTextarea id="sc-remarks" rows={2} autoResize value={form.remarks} maxLength={2000} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default SecurityControls;
