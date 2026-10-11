import React, { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import collectionService from "../../../services/collectionService";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { notifyError } from "../../../utility/dialogs";
import { calendarDateFormat, formatDate } from "../../../utility/dateFormat";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";

const EMPTY = { notes: "", callOutcome: "", commitmentDate: null, to: "", subject: "" };
const OUTCOMES = ["Answered", "NoAnswer", "WrongNumber", "CallbackRequested"];

/**
 * A follow-up on a collection: an e-mail reminder (to, subject and text, prefilled from the bill), a call with its
 * outcome, a note or a payment commitment. Every opening starts from a clean form, so text typed for one kind of
 * follow-up never ends up in another.
 */
const FollowUpModal = ({ loadingFollowUp, collection, visible, onHide, collectionId, actionType, onSaved, handleSendEmail }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const k = (key, opts) => t(`collectionDetail.followUp.${key}`, opts);

  useEffect(() => {
    if (!visible) return;
    if (actionType !== "Email" || !collection) {
      setFormData(EMPTY);
      return;
    }
    const client = collection.client || {};
    const values = {
      name: [client.firstName, client.lastName].filter(Boolean).join(" ") || client.name || "",
      policy: collection.policy?.policyNumber || collection.billNumber || "",
      amount: formatCurrency(collection.outstandingAmount),
      dueDate: formatDate(collection.dueDate),
    };
    setFormData({ ...EMPTY, to: client.email || "", subject: k("emailSubject", values), notes: k("emailBody", values) });
    // the form is rebuilt when the panel opens, not on every render of the collection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, actionType]);

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (actionType === "Commitment") {
        await collectionService.setCommitmentDate(collectionId, formData.commitmentDate, formData.notes);
      } else {
        await collectionService.addFollowUpAction(collectionId, {
          actionType,
          notes: formData.notes,
          callOutcome: actionType === "Call" ? formData.callOutcome : null,
          commitmentDate: null,
        });
      }
      setFormData(EMPTY);
      onSaved();
    } catch (error) {
      notifyError(k("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setFormData(EMPTY);
    onHide();
  };

  const field = (id, label, control, required = false) => (
    <div className="form-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {control}
    </div>
  );

  const renderContent = () => {
    switch (actionType) {
      case "Email":
        return (
          <div className="follow-up-form">
            {field("fu-to", k("to"), <InputText id="fu-to" value={formData.to} onChange={(e) => set("to", e.target.value)} />, true)}
            {field("fu-subject", k("subject"), <InputText id="fu-subject" value={formData.subject} onChange={(e) => set("subject", e.target.value)} />)}
            {field("fu-body", k("message"), <InputTextarea id="fu-body" value={formData.notes} onChange={(e) => set("notes", e.target.value)} rows={10} autoResize />)}
          </div>
        );
      case "Call":
        return (
          <div className="follow-up-form">
            {field("fu-outcome", k("callOutcome"), (
              <Dropdown inputId="fu-outcome" value={formData.callOutcome} options={OUTCOMES.map((o) => ({ label: k(`outcomes.${o}`), value: o }))}
                onChange={(e) => set("callOutcome", e.value)} placeholder={t("agent.selectOutcome")} />
            ), true)}
            {field("fu-call", k("callNotes"), <InputTextarea id="fu-call" value={formData.notes} onChange={(e) => set("notes", e.target.value)} rows={5} />)}
          </div>
        );
      case "Note":
        return (
          <div className="follow-up-form">
            {field("fu-note", k("note"), <InputTextarea id="fu-note" value={formData.notes} onChange={(e) => set("notes", e.target.value)} rows={5} />, true)}
          </div>
        );
      case "Commitment":
        return (
          <div className="follow-up-form">
            {field("fu-date", k("commitmentDate"), (
              <Calendar inputId="fu-date" value={formData.commitmentDate} onChange={(e) => set("commitmentDate", e.value)} minDate={new Date()} showIcon
                dateFormat={calendarDateFormat()} />
            ), true)}
            {field("fu-reason", k("delayReason"), <InputTextarea id="fu-reason" value={formData.notes} onChange={(e) => set("notes", e.target.value)} rows={4} />)}
          </div>
        );
      default:
        return null;
    }
  };

  const footer = (
    <div>
      <Button label={t("common.cancel")} outlined onClick={close} />
      {actionType === "Email" ? (
        <Button label={t("emailDocument.sendEmail")} icon="pi pi-send" disabled={!formData.to || !formData.notes}
          onClick={() => handleSendEmail({ notes: formData.notes, to: formData.to, subject: formData.subject })} loading={loadingFollowUp} />
      ) : (
        <Button label={k(`actions.${actionType}`, { defaultValue: t("common.save") })} icon="pi pi-check" onClick={handleSave} loading={saving}
          disabled={(actionType === "Commitment" && !formData.commitmentDate) || (actionType === "Call" && !formData.callOutcome) || (actionType === "Note" && !formData.notes.trim())} />
      )}
    </div>
  );

  return (
    <Dialog header={actionType ? k(`titles.${actionType}`, { defaultValue: actionType }) : ""} visible={visible} style={{ width: actionType === "Email" ? "640px" : "500px" }}
      breakpoints={{ "700px": "95vw" }} footer={footer} onHide={close} className="follow-up-modal bv-centered">
      {renderContent()}
    </Dialog>
  );
};

export default FollowUpModal;
