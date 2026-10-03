import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { PageHeader, dateTime, limitText, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const EMPTY = { transactionType: null, roleCode: null, userId: null, maxAmount: null, unlimited: false, remarks: "" };

/**
 * Master > User Management > Authority Matrix: who may approve how much. Transaction types down, roles across; a
 * limit can also be set for one person. Every change waits for a second administrator's approval before it applies,
 * and the approval steps (journal vouchers, cheque release, claim settlement...) check it.
 */
const AuthorityMatrix = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [matrix, setMatrix] = useState({ roles: [], rows: [], userLimits: [], withoutLimit: "allow" });
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // the parts under the matrix appear with it (not above it first, then pushed down)
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const noLimit = k("noLimit", "No limit");
  const notify = (severity, summary, detail) => toast.current?.show({ severity, summary, detail });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p, u] = await Promise.all([accessControlService.authorityMatrix(), accessControlService.limits({ status: "pending" }), accessControlService.userMatrix({ status: "active" })]);
      setMatrix(m);
      setPending(p);
      setUsers(u.rows.map((x) => ({ label: `${x.displayName} (${x.username})`, value: x.id })));
    } catch (e) {
      notify("error", k("loadFailed", "Could not load the users"), e.message);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const typeOf = useMemo(() => Object.fromEntries(matrix.rows.map((r) => [r.code, r])), [matrix.rows]);

  const openCell = (row, role) => {
    const cell = row.cells[role.code];
    setForm({ ...EMPTY, transactionType: row.code, roleCode: role.code, maxAmount: cell.set && !cell.unlimited ? cell.maxAmount : null, unlimited: !!cell.unlimited });
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { transactionType: form.transactionType, remarks: form.remarks || undefined, unlimited: form.unlimited,
        maxAmount: form.unlimited ? null : form.maxAmount, ...(form.roleCode ? { roleCode: form.roleCode } : { userId: form.userId }) };
      const r = await accessControlService.proposeLimit(body);
      notify("success", r.message);
      setForm(null);
      load();
    } catch (e) {
      notify("error", k("saveFailed", "Could not save"), e.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (limit, decision) => {
    try {
      const r = await accessControlService.decideLimit(limit.id, decision);
      notify("success", r.message);
      load();
    } catch (e) {
      notify("error", e.message);
    }
  };

  const withdraw = async (limit) => {
    try {
      const r = await accessControlService.withdrawLimit(limit.id);
      notify("success", r.message);
      load();
    } catch (e) {
      notify("error", e.message);
    }
  };

  const cellBody = (row, role) => {
    const c = row.cells[role.code];
    return (
      <button type="button" className={`access__cell${c.set ? "" : " is-empty"}`} onClick={() => openCell(row, role)}
        aria-label={k("editLimitFor", "Set the limit of {{role}} for {{type}}", { role: role.name, type: row.name })}>
        <span>{c.set ? limitText(row.measure, c.maxAmount, c.unlimited, noLimit) : k("notSet", "Not set")}</span>
        {c.pending ? <Tag value={k("pendingShort", "Change pending")} severity="warning" className="access__cell-tag" /> : null}
      </button>
    );
  };

  const formType = form ? typeOf[form.transactionType] : null;

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <PageHeader
        title={k("authorityTitle", "Authority Matrix")}
        actions={<>
          <Button icon="pi pi-user-plus" label={k("addUserLimit", "Limit for one person")} outlined onClick={() => setForm({ ...EMPTY })} />
          <Button icon="pi pi-refresh" label={k("refresh", "Refresh")} outlined onClick={load} disabled={loading} />
        </>}
      />

      <Message severity="info" className="w-full mb-3" text={matrix.withoutLimit === "refuse"
        ? k("withoutLimitRefuse", "A role with no limit for a transaction type cannot approve it.")
        : k("withoutLimitAllow", "A role with no limit for a transaction type is not restricted by this matrix (Not set). Set a limit to restrict it.")} />

      {pending.length ? (
        <div className="access__panel">
          <h3>{k("pendingTitle", "Waiting for approval")}</h3>
          <DataTable value={pending} dataKey="id" size="small" className="access__table">
            <Column field="transactionName" header={k("colTransaction", "Transaction")} />
            <Column header={k("colFor", "For")} body={(l) => l.roleName || l.userName} />
            <Column header={k("colNewLimit", "New limit")} body={(l) => limitText(l.measure, l.maxAmount, l.unlimited, noLimit)} />
            <Column field="remarks" header={k("colRemarks", "Remarks")} />
            <Column header={k("colProposedBy", "Proposed by")} body={(l) => `${l.requestedBy || ""} · ${dateTime(l.requestedAt)}`} />
            <Column header="" style={{ width: "13rem" }} body={(l) => (
              <div className="access__row-actions">
                <Button label={k("approve", "Approve")} icon="pi pi-check" size="small" onClick={() => decide(l, "approve")} />
                <Button label={k("reject", "Reject")} icon="pi pi-times" size="small" severity="secondary" outlined onClick={() => decide(l, "reject")} />
              </div>
            )} />
          </DataTable>
        </div>
      ) : null}

      <DataTable value={matrix.rows} dataKey="code" loading={loading} size="small" scrollable className="access__table access__matrix">
        <Column header={k("colTransaction", "Transaction")} frozen style={{ minWidth: "15rem" }} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.name}</span>
            <span className="access__muted">{r.measure === "percent" ? k("measurePercent", "Percent of premium") : k("measureAmount", "Amount in PHP")}</span>
          </div>
        )} />
        {matrix.roles.map((role) => (
          <Column key={role.code} header={role.name} style={{ minWidth: "10rem" }} body={(r) => cellBody(r, role)} />
        ))}
      </DataTable>

      {loaded && <div className="access__panel">
        <h3>{k("userLimitsTitle", "Limits for individual people")}</h3>
        <DataTable value={matrix.userLimits} dataKey="id" size="small" emptyMessage={k("noUserLimits", "No personal limits")} className="access__table">
          <Column field="userName" header={k("colPerson", "Person")} />
          <Column field="transactionName" header={k("colTransaction", "Transaction")} />
          <Column header={k("colLimit", "Limit")} body={(l) => limitText(l.measure, l.maxAmount, l.unlimited, noLimit)} />
          <Column header={k("colStatus", "Status")} body={(l) => <Tag value={k(`limitStatus.${l.status}`, l.status)} severity={l.status === "active" ? "success" : "warning"} />} />
          <Column header="" style={{ width: "9rem" }} body={(l) => (l.status === "active"
            ? <Button label={k("withdraw", "Withdraw")} text size="small" onClick={() => withdraw(l)} /> : null)} />
        </DataTable>
      </div>}

      <Dialog header={form?.roleCode ? k("setRoleLimit", "Set approval limit") : k("setUserLimit", "Set a limit for one person")} visible={!!form}
        style={{ width: "32rem" }} onHide={() => setForm(null)} modal
        footer={<>
          <Button label={k("cancel", "Cancel")} text onClick={() => setForm(null)} />
          <Button label={k("submitForApproval", "Submit for approval")} icon="pi pi-send" loading={saving} onClick={save}
            disabled={!form?.transactionType || (!form?.roleCode && !form?.userId) || (!form?.unlimited && (form?.maxAmount === null || form?.maxAmount === undefined))} />
        </>}>
        {form ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="ac-type">{k("colTransaction", "Transaction")}</label>
              <Dropdown inputId="ac-type" value={form.transactionType} options={matrix.rows.map((r) => ({ label: r.name, value: r.code }))}
                onChange={(e) => setForm((f) => ({ ...f, transactionType: e.value }))} disabled={!!form.roleCode} placeholder={k("chooseType", "Choose the transaction")} />
            </div>
            {form.roleCode ? (
              <div className="admin__field">
                <label>{k("colRole", "Role")}</label>
                <div className="access__readonly">{matrix.roles.find((r) => r.code === form.roleCode)?.name}</div>
              </div>
            ) : (
              <div className="admin__field">
                <label htmlFor="ac-user">{k("colPerson", "Person")}</label>
                <Dropdown inputId="ac-user" value={form.userId} options={users} filter onChange={(e) => setForm((f) => ({ ...f, userId: e.value }))} placeholder={k("choosePerson", "Choose the person")} />
              </div>
            )}
            <div className="admin__field">
              <label htmlFor="ac-limit">{formType?.measure === "percent" ? k("limitPercent", "Limit (%)") : k("limitAmount", "Limit (PHP)")}</label>
              <InputNumber inputId="ac-limit" value={form.maxAmount} onValueChange={(e) => setForm((f) => ({ ...f, maxAmount: e.value }))} disabled={form.unlimited}
                mode="decimal" minFractionDigits={formType?.measure === "percent" ? 0 : 2} maxFractionDigits={2} min={0} max={formType?.measure === "percent" ? 100 : undefined} />
              <div className="access__check">
                <Checkbox inputId="ac-unlimited" checked={form.unlimited} onChange={(e) => setForm((f) => ({ ...f, unlimited: e.checked }))} />
                <label htmlFor="ac-unlimited">{noLimit}</label>
              </div>
            </div>
            <div className="admin__field">
              <label htmlFor="ac-remarks">{k("colRemarks", "Remarks")}</label>
              <InputTextarea id="ac-remarks" rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder={k("remarksHint", "For example: per the board resolution on signing authority")} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AuthorityMatrix;
