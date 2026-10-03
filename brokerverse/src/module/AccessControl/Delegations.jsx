import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { PageHeader, shortDate, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);
const EMPTY = { delegatorId: null, delegateId: null, transactionTypes: [], dateFrom: null, dateTo: null, reason: "" };

/**
 * Master > User Management > Delegations: while an approver is on leave or travelling, another person approves with
 * their authority for the chosen transaction types and dates. Every delegation stays on record.
 */
const Delegations = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [types, setTypes] = useState([]);
  const [currentOnly, setCurrentOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, u, t] = await Promise.all([accessControlService.delegations({ active: currentOnly }), accessControlService.userMatrix({ status: "active" }), accessControlService.transactionTypes()]);
      setRows(d);
      setUsers(u.rows.map((x) => ({ label: `${x.displayName} (${x.username})`, value: x.id })));
      setTypes(t.filter((x) => x.active).map((x) => ({ label: x.name, value: x.code })));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    } finally {
      setLoading(false);
    }
  }, [currentOnly]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await accessControlService.createDelegation({ ...form, dateFrom: iso(form.dateFrom), dateTo: iso(form.dateTo), reason: form.reason || undefined });
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (d) => {
    try {
      const r = await accessControlService.revokeDelegation(d.id);
      toast.current?.show({ severity: "success", summary: r.message });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    }
  };

  const typeName = (code) => types.find((t) => t.value === code)?.label || code;
  const valid = form && form.delegatorId && form.delegateId && form.delegatorId !== form.delegateId && form.dateFrom && form.dateTo && form.dateTo >= form.dateFrom;

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <PageHeader
        title={k("delegationsTitle", "Delegations")}
        actions={<Button icon="pi pi-plus" label={k("newDelegation", "New delegation")} onClick={() => setForm({ ...EMPTY })} />}
      />
      <div className="access__toggle">
        <InputSwitch inputId="ac-current" checked={currentOnly} onChange={(e) => setCurrentOnly(e.value)} />
        <label htmlFor="ac-current">{k("currentOnly", "Current and upcoming only")}</label>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={k("noDelegations", "No delegations")}>
        <Column field="delegatorName" header={k("colDelegator", "Approver away")} />
        <Column field="delegateName" header={k("colDelegate", "Covered by")} />
        <Column header={k("colTransactions", "Transactions")} body={(d) => (d.transactionTypes.length
          ? <div className="access__chips">{d.transactionTypes.map((t) => <Tag key={t} value={typeName(t)} className="access__role-tag" />)}</div>
          : <span>{k("allTransactions", "All transactions")}</span>)} />
        <Column header={k("colPeriod", "Period")} body={(d) => `${shortDate(d.dateFrom)} – ${shortDate(d.dateTo)}`} />
        <Column field="reason" header={k("colReason", "Reason")} />
        <Column header={k("colStatus", "Status")} body={(d) => (d.status === "revoked"
          ? <Tag value={k("revoked", "Revoked")} severity="secondary" />
          : <Tag value={d.inEffect ? k("inEffect", "In effect") : k("scheduled", "Scheduled")} severity={d.inEffect ? "success" : "info"} />)} />
        <Column header="" style={{ width: "8rem" }} body={(d) => (d.status === "active" ? <Button label={k("revoke", "Revoke")} text size="small" onClick={() => revoke(d)} /> : null)} />
      </DataTable>

      <Dialog header={k("newDelegation", "New delegation")} visible={!!form} style={{ width: "34rem" }} modal onHide={() => setForm(null)}
        footer={<>
          <Button label={k("cancel", "Cancel")} text onClick={() => setForm(null)} />
          <Button label={k("save", "Save")} icon="pi pi-check" loading={saving} disabled={!valid} onClick={save} />
        </>}>
        {form ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="dl-from-user">{k("colDelegator", "Approver away")}</label>
              <Dropdown inputId="dl-from-user" value={form.delegatorId} options={users} filter onChange={(e) => setForm((f) => ({ ...f, delegatorId: e.value }))} placeholder={k("choosePerson", "Choose the person")} />
            </div>
            <div className="admin__field">
              <label htmlFor="dl-to-user">{k("colDelegate", "Covered by")}</label>
              <Dropdown inputId="dl-to-user" value={form.delegateId} options={users.filter((u) => u.value !== form.delegatorId)} filter
                onChange={(e) => setForm((f) => ({ ...f, delegateId: e.value }))} placeholder={k("choosePerson", "Choose the person")} />
            </div>
            <div className="admin__field">
              <label htmlFor="dl-types">{k("colTransactions", "Transactions")}</label>
              <MultiSelect inputId="dl-types" value={form.transactionTypes} options={types} display="chip" onChange={(e) => setForm((f) => ({ ...f, transactionTypes: e.value }))}
                placeholder={k("allTransactions", "All transactions")} />
            </div>
            <div className="access__two">
              <div className="admin__field">
                <label htmlFor="dl-date-from">{k("from", "From")}</label>
                <Calendar inputId="dl-date-from" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.value }))} dateFormat="dd M yy" showIcon />
              </div>
              <div className="admin__field">
                <label htmlFor="dl-date-to">{k("to", "To")}</label>
                <Calendar inputId="dl-date-to" value={form.dateTo} minDate={form.dateFrom || undefined} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.value }))} dateFormat="dd M yy" showIcon />
              </div>
            </div>
            <div className="admin__field">
              <label htmlFor="dl-reason">{k("colReason", "Reason")}</label>
              <InputText id="dl-reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={k("reasonHint", "For example: annual leave")} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default Delegations;
