import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { DOC_TYPES, isoDay, showDate, showDateTime, useOptionList } from "./common";

/**
 * KYC documents of a client (onboarding screen, AML profile, EDD review): the list with a link to each file, and the
 * upload of a new one linked to the client, a signatory (board resolution, secretary's certificate), a beneficial
 * owner or an EDD review.
 */
const KycDocuments = ({ clientId, documents = [], signatories = [], owners = [], eddId = null, onUploaded }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileRef = useRef(null);
  const docTypes = useOptionList(DOC_TYPES, "docType");
  const related = [
    { value: "client", label: t("aml.relatedClient") },
    ...signatories.filter((s) => s.status === "active").map((s) => ({ value: `signatory:${s.id}`, label: `${t("aml.relatedSignatory")}: ${s.fullName}` })),
    ...owners.filter((o) => o.status === "active").map((o) => ({ value: `beneficial-owner:${o.id}`, label: `${t("aml.relatedOwner")}: ${o.fullName}` })),
    ...(eddId ? [{ value: `edd:${eddId}`, label: t("aml.relatedEdd") }] : []),
  ];
  const [form, setForm] = useState({ docType: eddId ? "edd-evidence" : "government-id", related: eddId ? `edd:${eddId}` : "client", description: "", expiryDate: null, file: null });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const [relatedType, relatedId] = form.related.split(":");
    try {
      const r = await amlService.uploadDocument(clientId, form.file, { docType: form.docType, relatedType, relatedId, description: form.description, expiryDate: isoDay(form.expiryDate) });
      toast.current?.show({ severity: "success", summary: r.message });
      setForm((f) => ({ ...f, description: "", expiryDate: null, file: null }));
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const open = async (d) => {
    try {
      const url = await amlService.documentUrl(d.storageKey);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    }
  };
  const relatedLabel = (d) => {
    if (d.relatedType === "signatory") return `${t("aml.relatedSignatory")}: ${signatories.find((s) => s.id === d.relatedId)?.fullName || ""}`;
    if (d.relatedType === "beneficial-owner") return `${t("aml.relatedOwner")}: ${owners.find((o) => o.id === d.relatedId)?.fullName || ""}`;
    return t(d.relatedType === "edd" ? "aml.relatedEdd" : "aml.relatedClient");
  };
  const list = eddId ? documents.filter((d) => d.relatedType === "edd" && d.relatedId === eddId) : documents;

  return (
    <div>
      <Toast ref={toast} />
      {clientId ? (
        <div className="admin__filters aml__upload">
          <Dropdown value={form.docType} options={docTypes} onChange={(e) => setForm((f) => ({ ...f, docType: e.value }))} placeholder={t("aml.colDocType")} />
          {!eddId ? <Dropdown value={form.related} options={related} onChange={(e) => setForm((f) => ({ ...f, related: e.value }))} placeholder={t("aml.colRelated")} /> : null}
          <InputText value={form.description} placeholder={t("aml.colDescription")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Calendar value={form.expiryDate} placeholder={t("aml.colExpiry")} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.value }))} showIcon dateFormat="dd M yy" />
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={t("aml.chooseFile")} onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
          <Button icon="pi pi-upload" label={t("aml.upload")} loading={saving} disabled={!form.file} onClick={save} />
        </div>
      ) : null}
      <DataTable value={list} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.noDocuments")}>
        <Column header={t("aml.colDocType")} body={(d) => t(`aml.docType.${d.docType}`, { defaultValue: d.docType })} />
        <Column header={t("aml.colRelated")} body={relatedLabel} />
        <Column field="description" header={t("aml.colDescription")} />
        <Column header={t("aml.colExpiry")} body={(d) => showDate(d.expiryDate)} />
        <Column header={t("aml.colUploaded")} body={(d) => `${showDateTime(d.uploadedAt)} ${d.uploadedBy || ""}`} />
        <Column header="" body={(d) => <Button icon="pi pi-external-link" text rounded size="small" aria-label={t("aml.openFile")} tooltip={d.fileName} onClick={() => open(d)} />} />
      </DataTable>
    </div>
  );
};

export default KycDocuments;
