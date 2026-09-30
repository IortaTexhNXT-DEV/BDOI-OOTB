import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { PageHeader, dateTime, shortDate, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);
const DECISION_SEVERITY = { pending: "warning", keep: "success", revoke: "danger" };

/**
 * Master > User Management > Access Reviews: periodic recertification. A review lists every active user with their
 * roles; each is confirmed or revoked (revoking deactivates the account), and the closed review is the audit record.
 */
const AccessReviews = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false);

  const notify = (severity, summary) => toast.current?.show({ severity, summary });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await accessControlService.reviews());
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (id) => {
    try {
      setCurrent(await accessControlService.review(id));
    } catch (e) {
      notify("error", e.message);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const r = await accessControlService.startReview({ name: starting.name, dueDate: iso(starting.dueDate) });
      notify("success", r.message);
      setStarting(null);
      setCurrent(r.data);
      load();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (item, decision, remarks) => {
    setBusy(true);
    try {
      const r = await accessControlService.decideReviewItem(current.id, item.id, decision, remarks);
      setCurrent(r.data);
      setRevoking(null);
      load();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    try {
      const r = await accessControlService.closeReview(current.id);
      notify("success", r.message);
      setCurrent(r.data);
      load();
    } catch (e) {
      notify("error", e.message);
    }
  };

  const progress = (r) => (r.users ? Math.round(((r.users - r.pending) / r.users) * 100) : 0);

  if (current) {
    const isOpen = current.status === "open";
    return (
      <div className="admin__page access__page">
        <Toast ref={toast} />
        <PageHeader
          title={current.name}
          intro={k("reviewDetailIntro", "Due {{date}} · {{done}} of {{total}} users reviewed · {{revoked}} revoked", {
            date: shortDate(current.dueDate), done: current.users - current.pending, total: current.users, revoked: current.revoked })}
          actions={<>
            <Button icon="pi pi-arrow-left" label={k("allReviews", "All reviews")} text onClick={() => setCurrent(null)} />
            <Button icon="pi pi-file-excel" label={k("exportExcel", "Export to Excel")} outlined onClick={() => accessControlService.downloadReview(current.id).catch((e) => notify("error", e.message))} />
            {isOpen ? <Button icon="pi pi-lock" label={k("closeReview", "Close review")} onClick={close} disabled={current.pending > 0} /> : null}
          </>}
        />
        <ProgressBar value={progress(current)} className="access__progress" showValue={false} />
        <DataTable value={current.items} dataKey="id" size="small" stripedRows paginator rows={20} className="access__table">
          <Column header={k("colUser", "User")} body={(i) => (
            <div className="access__user"><span className="access__user-name">{i.displayName}</span><span className="access__muted">{i.username}</span></div>
          )} />
          <Column field="branch" header={k("colBranch", "Branch")} />
          <Column header={k("colRoles", "Roles")} body={(i) => <div className="access__chips">{i.roles.map((r) => <Tag key={r} value={r} className="access__role-tag" />)}</div>} />
          <Column header={k("colLastSignIn", "Last sign-in")} body={(i) => (i.lastLoginAt ? dateTime(i.lastLoginAt) : k("never", "Never"))} />
          <Column header={k("colDecision", "Decision")} body={(i) => (
            <div className="access__user">
              <Tag value={k(`decision.${i.decision}`, i.decision)} severity={DECISION_SEVERITY[i.decision]} />
              {i.decidedBy ? <span className="access__muted">{i.decidedBy}{i.remarks ? ` · ${i.remarks}` : ""}</span> : null}
            </div>
          )} />
          <Column header="" style={{ width: "13rem" }} body={(i) => (isOpen ? (
            <div className="access__row-actions">
              <Button label={k("keep", "Keep")} icon="pi pi-check" size="small" outlined={i.decision !== "keep"} disabled={busy} onClick={() => decide(i, "keep")} />
              <Button label={k("revoke", "Revoke")} icon="pi pi-ban" size="small" severity="danger" outlined={i.decision !== "revoke"} disabled={busy}
                onClick={() => setRevoking({ item: i, remarks: "" })} />
            </div>
          ) : null)} />
        </DataTable>

        <Dialog header={k("revokeTitle", "Revoke access")} visible={!!revoking} style={{ width: "30rem" }} modal onHide={() => setRevoking(null)}
          footer={<>
            <Button label={k("cancel", "Cancel")} text onClick={() => setRevoking(null)} />
            <Button label={k("revoke", "Revoke")} severity="danger" icon="pi pi-ban" loading={busy} disabled={!revoking?.remarks.trim()}
              onClick={() => decide(revoking.item, "revoke", revoking.remarks.trim())} />
          </>}>
          {revoking ? (
            <div className="admin__grid admin__grid--single">
              <p className="m-0">{k("revokeExplain", "{{name}} will be deactivated and signed out. Their records and roles stay for the audit trail.", { name: revoking.item.displayName })}</p>
              <div className="admin__field">
                <label htmlFor="rv-remarks">{k("colReason", "Reason")}</label>
                <InputText id="rv-remarks" value={revoking.remarks} onChange={(e) => setRevoking((r) => ({ ...r, remarks: e.target.value }))} placeholder={k("revokeHint", "For example: resigned on 30 Sep 2026")} />
              </div>
            </div>
          ) : null}
        </Dialog>
      </div>
    );
  }

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <PageHeader
        title={k("reviewsTitle", "Access Reviews")}
        intro={k("reviewsIntro", "Confirm at least every quarter that each active user still needs their access. The closed review is kept as the audit record.")}
        actions={<Button icon="pi pi-plus" label={k("startReview", "Start a review")} onClick={() => setStarting({ name: "", dueDate: null })} />}
      />
      <DataTable value={reviews} dataKey="id" loading={loading} size="small" stripedRows className="access__table" emptyMessage={k("noReviews", "No access reviews yet")}
        onRowClick={(e) => open(e.data.id)} rowClassName={() => "access__clickable"}>
        <Column field="name" header={k("colReview", "Review")} />
        <Column header={k("colDue", "Due")} body={(r) => shortDate(r.dueDate)} />
        <Column header={k("colProgress", "Progress")} style={{ minWidth: "12rem" }} body={(r) => (
          <div className="access__user"><ProgressBar value={progress(r)} showValue={false} className="access__progress-sm" /><span className="access__muted">{r.users - r.pending} / {r.users}</span></div>
        )} />
        <Column field="revoked" header={k("colRevoked", "Revoked")} style={{ textAlign: "right" }} />
        <Column header={k("colStatus", "Status")} body={(r) => <Tag value={k(`reviewStatus.${r.status}`, r.status)} severity={r.status === "open" ? "info" : "success"} />} />
        <Column header={k("colStartedBy", "Started by")} body={(r) => `${r.createdBy || ""} · ${shortDate(r.createdAt)}`} />
      </DataTable>

      <Dialog header={k("startReview", "Start a review")} visible={!!starting} style={{ width: "30rem" }} modal onHide={() => setStarting(null)}
        footer={<>
          <Button label={k("cancel", "Cancel")} text onClick={() => setStarting(null)} />
          <Button label={k("start", "Start")} icon="pi pi-play" loading={busy} disabled={!starting?.name.trim() || !starting?.dueDate} onClick={start} />
        </>}>
        {starting ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="rv-name">{k("colReview", "Review")}</label>
              <InputText id="rv-name" value={starting.name} onChange={(e) => setStarting((s) => ({ ...s, name: e.target.value }))} placeholder={k("reviewNameHint", "For example: Q4 2026 access review")} />
            </div>
            <div className="admin__field">
              <label htmlFor="rv-due">{k("colDue", "Due")}</label>
              <Calendar inputId="rv-due" value={starting.dueDate} minDate={new Date()} onChange={(e) => setStarting((s) => ({ ...s, dueDate: e.value }))} dateFormat="dd M yy" showIcon />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AccessReviews;
