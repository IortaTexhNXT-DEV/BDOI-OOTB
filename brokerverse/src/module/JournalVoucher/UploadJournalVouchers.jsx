import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import journalVoucherService, { apiErrorMessage } from "../../services/journalVoucherService";

/**
 * Accounts > Journal Voucher > Upload (TIS-BRD-NIA-05): journal vouchers from the upload template, one voucher per
 * Voucher Ref. The whole file is checked first; nothing is saved when a row is wrong, and the rows to fix are listed.
 * The vouchers created wait for the approval of another user.
 */
const UploadJournalVouchers = ({ visible, onHide, onUploaded }) => {
  const { t } = useTranslation();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");

  const reset = () => { setFile(null); setResult(null); setErrors([]); setMessage(""); };
  const close = () => { reset(); onHide(); };
  const upload = async () => {
    setBusy(true);
    setErrors([]);
    setMessage("");
    try {
      const r = await journalVoucherService.upload(file);
      setResult(r.data);
      setMessage(r.message);
      onUploaded();
    } catch (e) {
      setMessage(apiErrorMessage(e, t("jvTools.uploadFailed")));
      setErrors(e?.response?.data?.errors || []);
    } finally {
      setBusy(false);
    }
  };
  const template = async () => {
    try {
      await journalVoucherService.downloadTemplate();
    } catch (e) {
      setMessage(apiErrorMessage(e, t("jvTools.uploadFailed")));
    }
  };

  return (
    <Dialog header={t("jvTools.uploadTitle")} visible={visible} onHide={close} style={{ width: "min(860px, 96vw)" }}
      footer={(
        <div>
          <Button label={t("common.close")} text onClick={close} />
          <Button label={t("jvTools.upload")} icon="pi pi-upload" loading={busy} disabled={!file || !!result} onClick={upload} />
        </div>
      )}>
      <div className="flex flex-wrap gap-2 align-items-center mb-3">
        <Button label={t("jvTools.downloadTemplate")} icon="pi pi-download" outlined onClick={template} />
        <input ref={input} type="file" accept=".xlsx,.csv" style={{ display: "none" }} aria-label={t("jvTools.chooseFile")}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; reset(); setFile(f || null); }} />
        <Button label={t("jvTools.chooseFile")} icon="pi pi-file" onClick={() => input.current?.click()} />
        <span>{file ? file.name : t("jvTools.noFile")}</span>
      </div>
      {message && <Message severity={result ? "success" : "error"} className="w-full mb-2" text={message} />}
      {errors.length > 0 && (
        <DataTable value={errors} size="small" stripedRows scrollable scrollHeight="18rem">
          <Column field="path" header={t("jvTools.row")} style={{ width: "14rem" }} />
          <Column field="message" header={t("jvTools.problem")} />
        </DataTable>
      )}
      {result && (
        <DataTable value={result.vouchers} dataKey="id" size="small" stripedRows>
          <Column field="voucherRef" header={t("jvTools.voucherRef")} />
          <Column field="transactionNumber" header={t("accounts.transactionNumber")} />
          <Column field="date" header={t("common.date")} />
          <Column field="lineCount" header={t("jvTools.lines")} />
          <Column header={t("jvTools.total")} body={(v) => Number(v.totalDebit).toLocaleString("en-US", { minimumFractionDigits: 2 })} />
          <Column header={t("common.status")} body={() => t("jvTools.awaitingApproval")} />
        </DataTable>
      )}
    </Dialog>
  );
};

export default UploadJournalVouchers;
