import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import onboardingService, { errorMessage } from "./onboardingService";
import { DOC_TYPES, isoDay, showDate, showDateTime } from "./common";

/**
 * KYC documents of a client on the onboarding screen: the list with a link to each file, and the upload of a new one
 * linked to the client, a signatory (board resolution, secretary's certificate) or a beneficial owner.
 */
const KycDocuments = ({ clientId, documents = [], signatories = [], owners = [], onUploaded }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileRef = useRef(null);
  const docTypes = DOC_TYPES.map((value) => ({ value, label: t(`onboarding.docType.${value}`, { defaultValue: value }) }));
  const related = [
    { value: "client", label: t("onboarding.relatedClient") },
    ...signatories.filter((s) => s.status === "active").map((s) => ({ value: `signatory:${s.id}`, label: `${t("onboarding.relatedSignatory")}: ${s.fullName}` })),
    ...owners.filter((o) => o.status === "active").map((o) => ({ value: `beneficial-owner:${o.id}`, label: `${t("onboarding.relatedOwner")}: ${o.fullName}` })),
  ];
  const [form, setForm] = useState({ docType: "government-id", related: "client", description: "", expiryDate: null, file: null });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const [relatedType, relatedId] = form.related.split(":");
    try {
      const r = await onboardingService.uploadDocument(clientId, form.file, { docType: form.docType, relatedType, relatedId, description: form.description, expiryDate: isoDay(form.expiryDate) });
      toast.current?.show({ severity: "success", summary: r.message });
      setForm((f) => ({ ...f, description: "", expiryDate: null, file: null }));
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.uploadFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const open = async (d) => {
    try {
      const url = await onboardingService.documentUrl(d.storageKey);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.fileFailed")) });
    }
  };
  const relatedLabel = (d) => {
    if (d.relatedType === "signatory") return `${t("onboarding.relatedSignatory")}: ${signatories.find((s) => s.id === d.relatedId)?.fullName || ""}`;
    if (d.relatedType === "beneficial-owner") return `${t("onboarding.relatedOwner")}: ${owners.find((o) => o.id === d.relatedId)?.fullName || ""}`;
    return t("onboarding.relatedClient");
  };

  return (
    <div>
      <Toast ref={toast} />
      {clientId ? (
        <div className="admin__filters onboarding__upload">
          <Dropdown value={form.docType} options={docTypes} onChange={(e) => setForm((f) => ({ ...f, docType: e.value }))} placeholder={t("onboarding.colDocType")} />
          <Dropdown value={form.related} options={related} onChange={(e) => setForm((f) => ({ ...f, related: e.value }))} placeholder={t("onboarding.colRelated")} />
          <InputText value={form.description} placeholder={t("onboarding.colDescription")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Calendar value={form.expiryDate} placeholder={t("onboarding.colExpiry")} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.value }))} showIcon dateFormat="dd M yy" />
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={t("onboarding.chooseFile")} onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
          <Button icon="pi pi-upload" label={t("onboarding.upload")} loading={saving} disabled={!form.file} onClick={save} />
        </div>
      ) : null}
      <DataTable value={documents} dataKey="id" size="small" className="access__table" emptyMessage={t("onboarding.noDocuments")}>
        <Column header={t("onboarding.colDocType")} body={(d) => t(`onboarding.docType.${d.docType}`, { defaultValue: d.docType })} />
        <Column header={t("onboarding.colRelated")} body={relatedLabel} />
        <Column field="description" header={t("onboarding.colDescription")} />
        <Column header={t("onboarding.colExpiry")} body={(d) => showDate(d.expiryDate)} />
        <Column header={t("onboarding.colUploaded")} body={(d) => `${showDateTime(d.uploadedAt)} ${d.uploadedBy || ""}`} />
        <Column header="" body={(d) => <Button icon="pi pi-external-link" text rounded size="small" aria-label={t("onboarding.openFile")} tooltip={d.fileName} onClick={() => open(d)} />} />
      </DataTable>
    </div>
  );
};

export default KycDocuments;
