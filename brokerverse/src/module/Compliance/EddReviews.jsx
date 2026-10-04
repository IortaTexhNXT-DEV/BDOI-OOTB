import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, EDD_STATUSES, PageHeader, PartyCell, showDateTime, useOptionList } from "./common";
import KycDocuments from "./KycDocuments";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

const TEXT_FIELDS = ["sourceOfWealth", "sourceOfFunds", "purpose", "findings"];

/**
 * Compliance > EDD Reviews: enhanced due diligence of High-risk clients. The preparer records the source of wealth and
 * funds, the purpose of the relationship, the findings and the evidence, and submits; a compliance officer (approve:aml)
 * other than the preparer approves or rejects. A High-risk client gets no policy until its review is approved.
 */
const EddReviews = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const statuses = useOptionList(EDD_STATUSES, "eddStatus");
  const [filters, setFilters] = useState({ status: params.get("status") || "open,submitted,rejected", search: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [profile, setProfile] = useState(null);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const canApprove = hasPermission("approve:aml");

  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
  const done = (m) => toast.current?.show({ severity: "success", summary: m });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.eddReviews(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);

  const openReview = useCallback(async (id) => {
    try {
      const r = await amlService.eddReview(id);
      setEdit(r);
      setProfile(await amlService.profile(r.clientId));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    }
  }, [t]);
  useEffect(() => { if (params.get("review")) openReview(params.get("review")); }, [params, openReview]);

  const run = async (fn, close = true) => {
    setSaving(true);
    try {
      const r = await fn();
      done(r.message);
      if (close) { setEdit(null); setDecision(null); } else setEdit(r.data);
      load();
      return r;
    } catch (e) {
      fail(e);
      return null;
    } finally {
      setSaving(false);
    }
  };
  const editable = edit && ["open", "rejected"].includes(edit.status);
  const body = () => ({ ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, edit[k] || ""])), seniorManagementApproval: !!edit.seniorManagementApproval });
  const saveAndSubmit = async () => {
    const saved = await run(() => amlService.saveEdd(edit.id, body()), false);
    if (saved) await run(() => amlService.submitEdd(edit.id));
  };

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.eddTitle")} intro={t("aml.eddIntro")} />
      <div className="admin__filters">
        <Dropdown value={filters.status} options={[{ value: "open,submitted,rejected", label: t("aml.allPending") }, ...statuses]} showClear placeholder={t("aml.colStatus")}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.value || null }))} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("aml.searchClients")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.none")}
        selectionMode="single" onRowSelect={(e) => openReview(e.data.id)}>
        <Column field="reviewNumber" header={t("aml.colNumber")} sortable />
        <Column header={t("aml.colClient")} body={(r) => <PartyCell name={r.clientName} code={r.clientCode} />} />
        <Column field="reason" header={t("aml.colReason")} />
        <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="eddStatus" />} />
        <Column header={t("aml.colSubmitted")} body={(r) => (r.submittedAt ? `${showDateTime(r.submittedAt)} ${r.submittedBy || ""}` : "")} />
        <Column header={t("aml.colDecided")} body={(r) => (r.decidedAt ? `${showDateTime(r.decidedAt)} ${r.decidedBy || ""}` : "")} />
      </DataTable>

      <Dialog header={edit ? `${edit.reviewNumber}: ${edit.clientName} (${edit.clientCode})` : ""} visible={!!edit} style={{ width: "52rem" }} modal onHide={() => setEdit(null)}
        footer={edit ? (<>
          <Button label={t("aml.openProfile")} text icon="pi pi-user" onClick={() => navigate(`/compliance/aml/clients/${edit.clientId}`)} />
          <Button label={t("aml.cancel")} text onClick={() => setEdit(null)} />
          {editable ? <Button label={t("aml.save")} outlined icon="pi pi-save" loading={saving} onClick={() => run(() => amlService.saveEdd(edit.id, body()), false)} /> : null}
          {editable ? <Button label={t("aml.submit")} icon="pi pi-send" loading={saving} onClick={saveAndSubmit} /> : null}
          {edit.status === "submitted" && canApprove ? <Button label={t("aml.reject")} severity="danger" outlined onClick={() => setDecision({ decision: "reject", notes: "" })} /> : null}
          {edit.status === "submitted" && canApprove ? <Button label={t("aml.approve")} icon="pi pi-check" onClick={() => setDecision({ decision: "approve", notes: "" })} /> : null}
        </>) : null}>
        {edit ? (
          <div className="admin__grid admin__grid--single">
            <div className="aml__summary">
              <div><label>{t("aml.colStatus")}</label><AmlTag value={edit.status} group="eddStatus" /></div>
              <div><label>{t("aml.colReason")}</label>{edit.reason}</div>
              {edit.decisionNotes ? <div><label>{t("aml.decisionNotes")}</label>{edit.decisionNotes}</div> : null}
            </div>
            {edit.status === "rejected" ? <Message severity="warn" text={t("aml.eddRejectedNote")} /> : null}
            {TEXT_FIELDS.map((k) => (
              <div className="admin__field" key={k}>
                <label htmlFor={`edd-${k}`}>{t(`aml.edd.${k}`)}</label>
                <InputTextarea id={`edd-${k}`} rows={k === "findings" ? 4 : 2} value={edit[k] || ""} disabled={!editable} onChange={(e) => setEdit((x) => ({ ...x, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="access__toggle">
              <Checkbox inputId="edd-smo" checked={!!edit.seniorManagementApproval} disabled={!editable} onChange={(e) => setEdit((x) => ({ ...x, seniorManagementApproval: e.checked }))} />
              <label htmlFor="edd-smo">{t("aml.edd.seniorManagementApproval")}</label>
            </div>
            <h4>{t("aml.evidence")}</h4>
            <KycDocuments clientId={editable ? edit.clientId : null} eddId={edit.id} documents={profile?.documents || []} onUploaded={() => openReview(edit.id)} />
          </div>
        ) : null}
      </Dialog>

      <Dialog header={decision?.decision === "approve" ? t("aml.approve") : t("aml.reject")} visible={!!decision} style={{ width: "30rem" }} modal onHide={() => setDecision(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setDecision(null)} />
          <Button label={t("aml.confirm")} icon="pi pi-check" loading={saving} disabled={decision?.decision === "reject" && (decision?.notes || "").trim().length < 5}
            onClick={() => run(() => amlService.decideEdd(edit.id, decision))} />
        </>}>
        {decision ? (
          <div className="admin__field">
            <label htmlFor="edd-notes">{t("aml.decisionNotes")}</label>
            <InputTextarea id="edd-notes" rows={3} value={decision.notes} onChange={(e) => setDecision((d) => ({ ...d, notes: e.target.value }))} />
            <small>{t("aml.makerCheckerNote")}</small>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default EddReviews;
