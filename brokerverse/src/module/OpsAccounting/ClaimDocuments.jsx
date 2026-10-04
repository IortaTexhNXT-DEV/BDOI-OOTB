import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { OpsTag, PageHeader, date, dateTime, showError, showSuccess } from "./common";

/**
 * Operations > Claim Documents: the documents a claim needs (checklist master by line of business and claim type),
 * received, waived or still missing; upload a copy, remind the claimant of what is missing, and submit the claim to the
 * insurer once every required document is in.
 */
const ClaimDocuments = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [claims, setClaims] = useState([]);
  const [list, setList] = useState(null);
  const claimRef = params.get("claim");

  const findClaims = useCallback(async () => {
    try {
      setClaims(await service.claims({ search: search || undefined, status: "open" }));
    } catch (e) {
      showError(toast, e);
    }
  }, [search]);
  useEffect(() => { findClaims(); }, [findClaims]);
  const load = useCallback(async () => {
    if (!claimRef) { setList(null); return; }
    try {
      setList(await service.claimChecklist(claimRef));
    } catch (e) {
      showError(toast, e);
    }
  }, [claimRef]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, message) => {
    try {
      const r = await fn();
      if (message) showSuccess(toast, typeof message === "function" ? message(r) : message);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const waive = async (item) => {
    const reason = await promptText(t("opsAcc.claimDocs.waiveReason"));
    if (reason) act(() => service.updateChecklistItem(claimRef, item.id, { status: "waived", waiveReason: reason }), t("opsAcc.claimDocs.updated"));
  };
  const upload = (item) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => input.files[0] && act(() => service.uploadChecklistItem(claimRef, item.id, input.files[0]), t("opsAcc.claimDocs.uploaded"));
    input.click();
  };
  const add = async () => {
    const name = await promptText(t("opsAcc.claimDocs.addPrompt"));
    if (name) act(() => service.addChecklistItem(claimRef, { documentName: name, required: true }), t("opsAcc.claimDocs.updated"));
  };
  const submit = async () => {
    const reference = await promptText(t("opsAcc.claimDocs.submitPrompt"));
    if (reference !== null) act(() => service.submitClaimToInsurer(claimRef, { reference: reference || undefined }), t("opsAcc.claimDocs.submitted"));
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.claimDocs.title")} group={t("opsAcc.operations")} subtitle={t("opsAcc.claimDocs.intro")} />
      <div className="grid">
        <div className="col-12 lg:col-4">
          <div className="pe-card">
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.claimSearch")} className="w-full mb-2" />
            <DataTable value={claims} dataKey="id" size="small" selectionMode="single" selection={claims.find((c) => c.id === claimRef || c.claimNumber === claimRef) || null}
              onSelectionChange={(e) => e.value && setParams({ claim: e.value.id })} scrollable scrollHeight="480px" emptyMessage={t("opsAcc.none")}>
              <Column field="claimNumber" header={t("opsAcc.claim")} />
              <Column field="policyNumber" header={t("opsAcc.policy")} />
              <Column field="claimStatus" header={t("opsAcc.statusLabel")} />
            </DataTable>
          </div>
        </div>
        <div className="col-12 lg:col-8">
          {!list && <div className="pe-card pe-muted">{t("opsAcc.claimDocs.pick")}</div>}
          {list && (
            <div className="pe-card">
              <div className="flex flex-wrap align-items-center gap-2 mb-2">
                <h3 className="m-0">{list.claimNumber}</h3>
                <span className="pe-muted">{list.policyNumber} · {list.lob} · {list.claimType} · {list.claimantName}</span>
                {list.summary.complete ? <Tag value={t("opsAcc.claimDocs.complete")} severity="success" /> : <Tag value={t("opsAcc.claimDocs.missing", { count: list.summary.missingRequired })} severity="warning" />}
                {list.submittedToInsurerAt && <Tag value={t("opsAcc.claimDocs.submittedOn", { at: dateTime(list.submittedToInsurerAt) })} severity="info" />}
              </div>
              <div className="flex gap-2 mb-2">
                <Button label={t("opsAcc.claimDocs.remind")} icon="pi pi-envelope" outlined disabled={list.summary.missingRequired + list.summary.missingOptional === 0}
                  onClick={() => act(() => service.remindClaimant(claimRef), (r) => t("opsAcc.claimDocs.reminded", { to: r.to }))} />
                <Button label={t("opsAcc.claimDocs.submit")} icon="pi pi-send" disabled={!!list.submittedToInsurerAt || (list.requireComplete && !list.summary.complete)} onClick={submit}
                  tooltip={list.requireComplete && !list.summary.complete ? t("opsAcc.claimDocs.submitBlocked") : undefined} tooltipOptions={{ showOnDisabled: true }} />
                <Button label={t("opsAcc.claimDocs.add")} icon="pi pi-plus" text onClick={add} />
              </div>
              <DataTable value={list.items} dataKey="id" size="small" stripedRows>
                <Column field="documentName" header={t("opsAcc.claimDocs.document")} />
                <Column header={t("opsAcc.claimDocs.required")} body={(r) => (r.required ? t("opsAcc.yes") : t("opsAcc.no"))} />
                <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
                <Column header={t("opsAcc.claimDocs.receivedOn")} body={(r) => (r.receivedOn ? date(r.receivedOn) : r.waiveReason || "")} />
                <Column field="fileName" header={t("opsAcc.claimDocs.file")} />
                <Column body={(r) => (
                  <span className="flex gap-1">
                    {r.status !== "received" && <Button label={t("opsAcc.claimDocs.markReceived")} size="small" text onClick={() => act(() => service.updateChecklistItem(claimRef, r.id, { status: "received" }), t("opsAcc.claimDocs.updated"))} />}
                    <Button icon="pi pi-upload" size="small" text aria-label={t("opsAcc.claimDocs.upload")} tooltip={t("opsAcc.claimDocs.upload")} onClick={() => upload(r)} />
                    {r.status === "pending" && <Button label={t("opsAcc.claimDocs.waive")} size="small" text onClick={() => waive(r)} />}
                    {r.status !== "pending" && <Button label={t("opsAcc.claimDocs.reopen")} size="small" text onClick={() => act(() => service.updateChecklistItem(claimRef, r.id, { status: "pending" }), t("opsAcc.claimDocs.updated"))} />}
                  </span>
                )} />
              </DataTable>
              {list.reminders.length > 0 && (
                <>
                  <h4>{t("opsAcc.claimDocs.reminders")}</h4>
                  <DataTable value={list.reminders} dataKey="id" size="small">
                    <Column header={t("opsAcc.date")} body={(r) => dateTime(r.at)} />
                    <Column field="to" header={t("opsAcc.claimDocs.to")} />
                    <Column header={t("opsAcc.claimDocs.missingList")} body={(r) => (r.missing || []).join("; ")} />
                    <Column header={t("opsAcc.claimDocs.sentBy")} body={(r) => (r.automatic ? t("opsAcc.claimDocs.automatic") : r.by)} />
                  </DataTable>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimDocuments;
