import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import quotationService from "../../../services/quotationService";
import s3Service from "../../../services/s3Service";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { calendarDateFormat, toIsoDate } from "../../../utility/dateFormat";
import { getStatusLabel } from "../../../utils/statusHelpers";
import "./index.scss";

const OUTCOMES = ["accepted", "declined", "revise"];
const emptyForm = () => ({ outcome: "accepted", channel: null, responseDate: new Date(), reference: "", remarks: "", file: null });

/** Put text on the clipboard; false when the browser refuses (plain http, permissions). */
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * Actions of a quotation waiting for the customer (PendingCustomer): the waiting notice, "Copy approval link" to share
 * the link by Viber / WhatsApp, and "Record customer response" for an answer received by phone, in a meeting or on a
 * signed form. onRecorded receives the updated quotation.
 */
const CustomerResponseActions = ({ quotationId, onRecorded, notice }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [channels, setChannels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [manualLink, setManualLink] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const problems = {
    channel: !form.channel,
    responseDate: !form.responseDate,
    remarks: !form.reference.trim() && !form.remarks.trim(),
  };
  const invalid = Object.values(problems).some(Boolean);

  const openDialog = async () => {
    setForm(emptyForm());
    setSubmitted(false);
    setOpen(true);
    try {
      const body = await quotationService.getCustomerResponses(quotationId);
      setChannels(body.channels || []);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const copyLink = async () => {
    setLinkBusy(true);
    try {
      const { approvalUrl } = await quotationService.getApprovalLink(quotationId);
      if (await copyText(approvalUrl)) notifySuccess(t("customerResponse.linkCopied"));
      else setManualLink(approvalUrl);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setLinkBusy(false);
    }
  };

  const save = async () => {
    setSubmitted(true);
    if (invalid) return;
    setBusy(true);
    try {
      let attachment = {};
      if (form.file) {
        const uploaded = await s3Service.uploadFile(form.file, "quotation-responses");
        if (!uploaded?.key) throw new Error(uploaded?.error || t("customerResponse.uploadFailed"));
        attachment = { attachmentKey: uploaded.key, attachmentName: form.file.name };
      }
      const body = await quotationService.recordCustomerResponse(quotationId, {
        outcome: form.outcome,
        channel: form.channel,
        responseDate: toIsoDate(form.responseDate),
        reference: form.reference.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
        ...attachment,
      });
      notifySuccess(t("customerResponse.recorded", { status: getStatusLabel(body.data?.quotationStatus) }));
      setOpen(false);
      onRecorded?.(body.data);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const error = (field) => submitted && problems[field] && <small className="p-error">{t(`customerResponse.errors.${field}`)}</small>;

  return (
    <div className="customer-response-actions">
      <div className="waiting-notice">
        <i className="pi pi-clock" />
        {notice || t("customerResponse.waiting")}
      </div>
      <Button label={t("customerResponse.copyLink")} icon="pi pi-link" outlined size="small" loading={linkBusy} onClick={copyLink} />
      <Button label={t("customerResponse.record")} icon="pi pi-check-square" size="small" onClick={openDialog} />

      <Dialog className="customer-response-dialog" header={t("customerResponse.title")} visible={open} onHide={() => setOpen(false)}
        style={{ width: "34rem" }} breakpoints={{ "640px": "96vw" }}
        footer={<>
          <Button label={t("customerResponse.cancel")} text onClick={() => setOpen(false)} />
          <Button label={t("customerResponse.save")} icon="pi pi-check" loading={busy} onClick={save} />
        </>}>
        <label>{t("customerResponse.outcome")} *</label>
        <SelectButton value={form.outcome} onChange={(e) => e.value && set("outcome")(e.value)} className="mb-2"
          options={OUTCOMES.map((o) => ({ value: o, label: t(`customerResponse.outcomes.${o}`) }))} />
        <p className="muted">{t(`customerResponse.outcomeHelp.${form.outcome}`)}</p>

        <label htmlFor="cr-channel">{t("customerResponse.channel")} *</label>
        <Dropdown inputId="cr-channel" value={form.channel} options={channels} onChange={(e) => set("channel")(e.value)}
          placeholder={t("customerResponse.channelPlaceholder")} className="w-full" />
        {error("channel")}

        <label htmlFor="cr-date">{t("customerResponse.responseDate")} *</label>
        <Calendar inputId="cr-date" value={form.responseDate} onChange={(e) => set("responseDate")(e.value)} maxDate={new Date()}
          dateFormat={calendarDateFormat()} showIcon className="w-full" />
        {error("responseDate")}

        <label htmlFor="cr-reference">{t("customerResponse.reference")}</label>
        <InputText id="cr-reference" value={form.reference} onChange={(e) => set("reference")(e.target.value)} className="w-full"
          placeholder={t("customerResponse.referencePlaceholder")} maxLength={200} />

        <label htmlFor="cr-remarks">{t("customerResponse.remarks")}</label>
        <InputTextarea id="cr-remarks" value={form.remarks} onChange={(e) => set("remarks")(e.target.value)} rows={3} className="w-full" maxLength={2000} />
        {error("remarks")}

        <label htmlFor="cr-file">{t("customerResponse.attachment")}</label>
        <input id="cr-file" type="file" onChange={(e) => set("file")(e.target.files?.[0] || null)} />
      </Dialog>

      <Dialog header={t("customerResponse.copyLink")} visible={Boolean(manualLink)} onHide={() => setManualLink(null)} style={{ width: "34rem" }} breakpoints={{ "640px": "96vw" }}>
        <p className="muted">{t("customerResponse.copyManually")}</p>
        <InputText value={manualLink || ""} readOnly className="w-full" onFocus={(e) => e.target.select()} />
      </Dialog>
    </div>
  );
};

export default CustomerResponseActions;
