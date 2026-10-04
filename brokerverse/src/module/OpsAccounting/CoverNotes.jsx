import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";

const STATUSES = ["active", "superseded", "expired", "cancelled", "all"];

/**
 * Operations > Cover Notes: temporary cover issued from an accepted quotation or a sent / bound placement slip while the
 * insurer's policy is pending. Print with the letterhead, e-mail to the client, cancel; the cover note is superseded
 * (and linked) when the policy is issued and expires after its end date.
 */
const CoverNotes = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issue, setIssue] = useState(null); // { sources, search, source, coverFrom, validityDays, insurerReference, conditions }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.coverNotes({ status, search: search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);

  const openIssue = async (q = "") => {
    try {
      setIssue((d) => ({ coverFrom: new Date(), validityDays: null, insurerReference: "", conditions: "", ...(d || {}), search: q, sources: [], source: null }));
      const sources = await service.coverNoteSources(q || undefined);
      setIssue((d) => ({ ...d, sources }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const doIssue = async () => {
    try {
      const s = issue.source;
      const cn = await service.issueCoverNote({ [s.kind === "quote" ? "quoteId" : "placementId"]: s.id, coverFrom: isoOf(issue.coverFrom),
        ...(issue.validityDays ? { validityDays: issue.validityDays } : {}), insurerReference: issue.insurerReference || null, conditions: issue.conditions || null });
      showSuccess(toast, t("opsAcc.coverNotes.issued", { number: cn.coverNoteNumber, to: cn.coverTo }));
      setIssue(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const act = async (fn, message) => {
    try {
      await fn();
      if (message) showSuccess(toast, message);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const cancel = async (r) => {
    const reason = await promptText(t("opsAcc.coverNotes.cancelReason"));
    if (reason) act(() => service.cancelCoverNote(r.id, reason), t("opsAcc.coverNotes.cancelled", { number: r.coverNoteNumber }));
  };
  const send = async (r) => {
    const to = await promptText(t("opsAcc.coverNotes.sendTo"));
    if (to !== null) act(() => service.sendCoverNote(r.id, to || undefined), t("opsAcc.coverNotes.sent", { number: r.coverNoteNumber }));
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.coverNotes.title")} group={t("opsAcc.operations")} subtitle={t("opsAcc.coverNotes.intro")}>
        <Button icon="pi pi-plus" label={t("opsAcc.coverNotes.issue")} onClick={() => openIssue()} />
      </PageHeader>
      {data && (
        <div className="flex gap-4 mb-3">
          <span>{t("opsAcc.coverNotes.active")}: <b>{data.summary.active}</b></span>
          <span>{t("opsAcc.coverNotes.expiringSoon")}: <b>{data.summary.expiringSoon}</b></span>
        </div>
      )}
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={status} options={STATUSES.map((s) => ({ label: t(`opsAcc.status.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} className="w-12rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.coverNotes.searchHint")} className="w-20rem" />
        </div>
        <DataTable value={data?.rows || []} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")}>
          <Column field="coverNoteNumber" header={t("opsAcc.coverNotes.number")} />
          <Column header={t("opsAcc.coverNotes.insured")} body={(r) => r.insuredName || r.clientName} />
          <Column field="insurerName" header={t("opsAcc.insurer")} />
          <Column header={t("opsAcc.coverNotes.source")} body={(r) => r.quoteNumber || r.placementNumber} />
          <Column header={t("opsAcc.coverNotes.period")} body={(r) => `${date(r.coverFrom)} - ${date(r.coverTo)}`} />
          <Column header={t("opsAcc.coverNotes.daysLeft")} body={(r) => (r.daysLeft === null ? "" : r.daysLeft)} {...numericColumn} />
          <Column header={t("opsAcc.premium")} body={(r) => money(r.premiumTotal)} {...numericColumn} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
          <Column field="policyNumber" header={t("opsAcc.policy")} />
          <Column body={(r) => (
            <span className="flex gap-1">
              <Button icon="pi pi-print" text size="small" aria-label={t("opsAcc.print")} tooltip={t("opsAcc.print")} onClick={() => act(() => service.printCoverNote(r.id))} />
              {r.status === "active" && <Button icon="pi pi-envelope" text size="small" aria-label={t("opsAcc.coverNotes.send")} tooltip={t("opsAcc.coverNotes.send")} onClick={() => send(r)} />}
              {r.status === "active" && <Button icon="pi pi-times" text size="small" severity="danger" aria-label={t("opsAcc.cancel")} tooltip={t("opsAcc.cancel")} onClick={() => cancel(r)} />}
            </span>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={t("opsAcc.coverNotes.issue")} visible={!!issue} style={{ width: "min(860px, 96vw)" }} onHide={() => setIssue(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setIssue(null)} /><Button label={t("opsAcc.coverNotes.issue")} icon="pi pi-check" disabled={!issue?.source} onClick={doIssue} /></div>}>
        {issue && (
          <>
            <div className="flex gap-2 mb-2">
              <InputText value={issue.search} onChange={(e) => setIssue({ ...issue, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && openIssue(issue.search)}
                placeholder={t("opsAcc.coverNotes.sourceSearch")} className="w-20rem" />
              <Button icon="pi pi-search" onClick={() => openIssue(issue.search)} aria-label={t("opsAcc.search")} />
            </div>
            <DataTable value={issue.sources} dataKey="id" size="small" selectionMode="single" selection={issue.source} onSelectionChange={(e) => setIssue({ ...issue, source: e.value })}
              scrollable scrollHeight="220px" emptyMessage={t("opsAcc.coverNotes.noSources")}>
              <Column header={t("opsAcc.coverNotes.sourceKind")} body={(r) => t(`opsAcc.coverNotes.kind.${r.kind}`)} />
              <Column field="reference" header={t("opsAcc.reference")} />
              <Column field="clientName" header={t("opsAcc.client")} />
              <Column field="insurerName" header={t("opsAcc.insurer")} />
              <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
              <Column header={t("opsAcc.premium")} body={(r) => money(r.premiumTotal)} {...numericColumn} />
            </DataTable>
            <div className="grid mt-2">
              <Field label={t("opsAcc.coverNotes.coverFrom")} col="col-12 md:col-4"><Calendar value={issue.coverFrom} onChange={(e) => setIssue({ ...issue, coverFrom: e.value })} showIcon className="w-full" /></Field>
              <Field label={t("opsAcc.coverNotes.validityDays")} col="col-12 md:col-4"><InputNumber value={issue.validityDays} min={1} max={366} placeholder={t("opsAcc.coverNotes.validityDefault")} onValueChange={(e) => setIssue({ ...issue, validityDays: e.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.coverNotes.insurerReference")} col="col-12 md:col-4"><InputText value={issue.insurerReference} onChange={(e) => setIssue({ ...issue, insurerReference: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.coverNotes.conditions")} col="col-12"><InputTextarea value={issue.conditions} onChange={(e) => setIssue({ ...issue, conditions: e.target.value })} rows={2} autoResize className="w-full" /></Field>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};

export default CoverNotes;
