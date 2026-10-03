import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import FieldError from "../FieldError";
import emailService from "../../services/emailService";
import { notifySuccess, notifyWarn } from "../../utility/dialogs";
import { isSendingOff, withQueuedNotice } from "../../utility/emailNotice";

/**
 * Side panel to e-mail a client document (official receipt, premium invoice) with its PDF attached: confirm the
 * recipient (the client's address by default), add Cc and a note, then queue it. `send(body)` is the emailService call
 * ({ success, data } | { success: false, error }); `onSent(result)` runs after the e-mail is queued.
 */
const EmailDocumentDialog = ({ visible, onHide, title, defaultTo = "", fileName, send, onSent }) => {
  const { t } = useTranslation();
  const [to, setTo] = useState(defaultTo || "");
  const [cc, setCc] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTo(defaultTo || "");
    setCc("");
    setNote("");
    setError(null);
  }, [visible, defaultTo]);

  const submit = async () => {
    // an empty To is allowed when the client has an address on file: the server uses it
    if (!to.trim() && !defaultTo) {
      setError(t("emailDocument.toRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await send({ to: to.trim(), cc: cc.trim(), note: note.trim() });
    setBusy(false);
    if (!r.success) {
      setError(r.error || t("emailDocument.failed"));
      return;
    }
    const sentTo = r.data?.data?.to || to.trim();
    const text = t("emailDocument.queued", { to: sentTo });
    const status = await emailService.sendingStatus();
    if (isSendingOff(status)) notifyWarn(withQueuedNotice(text, status));
    else notifySuccess(text);
    onSent?.(r.data?.data);
    onHide();
  };

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button type="button" label={t("emailDocument.cancel")} outlined onClick={onHide} disabled={busy} />
      <Button type="button" label={t("emailDocument.send")} icon="pi pi-send" onClick={submit} loading={busy} />
    </div>
  );

  return (
    <Dialog header={title} visible={visible} onHide={onHide} footer={footer} style={{ width: "36rem" }} breakpoints={{ "640px": "100vw" }} draggable={false}>
      <div className="flex flex-column gap-3">
        <div className="field mb-0">
          <label htmlFor="email-doc-to">{t("emailDocument.to")}</label>
          <InputText id="email-doc-to" type="email" className="w-full" value={to} placeholder={t("emailDocument.toPlaceholder")}
            onChange={(e) => setTo(e.target.value)} aria-describedby="email-doc-to-help" />
          <small id="email-doc-to-help" className="block mt-1">{t("emailDocument.toHelp")}</small>
        </div>
        <div className="field mb-0">
          <label htmlFor="email-doc-cc">{t("emailDocument.cc")}</label>
          <InputText id="email-doc-cc" className="w-full" value={cc} onChange={(e) => setCc(e.target.value)} aria-describedby="email-doc-cc-help" />
          <small id="email-doc-cc-help" className="block mt-1">{t("emailDocument.ccHelp")}</small>
        </div>
        <div className="field mb-0">
          <label htmlFor="email-doc-note">{t("emailDocument.note")}</label>
          <InputTextarea id="email-doc-note" className="w-full" rows={4} autoResize value={note} maxLength={2000}
            placeholder={t("emailDocument.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
        </div>
        {fileName && (
          <div className="text-sm">
            <i className="pi pi-paperclip mr-1" aria-hidden="true" />
            {t("emailDocument.attachment", { file: fileName })}
          </div>
        )}
        <FieldError error={error} />
      </div>
    </Dialog>
  );
};

export default EmailDocumentDialog;
