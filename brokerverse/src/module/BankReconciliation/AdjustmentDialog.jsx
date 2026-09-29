import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Amount, date } from "./common";

/**
 * Create the adjustment for an unrecorded bank item from a bank line: bank transaction type of the line's direction
 * (the suggested one preselected), posting date, counter account when the type allows it, and for a returned cheque
 * the official receipt to cancel.
 */
const AdjustmentDialog = ({ visible, line, types, glAccounts, bookLines, busy, onHide, onSubmit }) => {
  const { t } = useTranslation();
  const [typeCode, setTypeCode] = useState(null);
  const [postDate, setPostDate] = useState("");
  const [accountCode, setAccountCode] = useState(null);
  const [receiptId, setReceiptId] = useState("");
  const [remarks, setRemarks] = useState("");
  const direction = line && line.amount < 0 ? "debit" : "credit";
  const options = useMemo(() => types.filter((x) => x.direction === direction), [types, direction]);

  useEffect(() => {
    if (!visible || !line) return;
    setTypeCode(options.find((x) => x.code === line.typeCode)?.code || null);
    setPostDate(line.date);
    setAccountCode(null);
    setReceiptId("");
    setRemarks("");
  }, [visible, line, options]);

  const type = types.find((x) => x.code === typeCode);
  const receipts = useMemo(() => (line ? bookLines.filter((v) => v.receiptId && Math.abs(v.amount) === Math.abs(line.amount)) : []), [bookLines, line]);

  return (
    <Dialog className="pe-dialog" visible={visible} onHide={onHide} style={{ width: "min(600px, 95vw)" }} header={t("bankReconciliation.createAdjustment")}
      footer={(
        <div>
          <Button label={t("bankReconciliation.cancel")} text onClick={onHide} />
          <Button label={type?.requiresApproval ? t("bankReconciliation.submitForApproval") : t("bankReconciliation.post")} icon="pi pi-check" loading={busy}
            disabled={!type || (type.action === "returned-cheque" && !receiptId)}
            onClick={() => onSubmit({ typeCode, date: postDate || undefined, accountCode: type?.allowAccountOverride && accountCode ? accountCode : undefined,
              receiptId: type?.action === "returned-cheque" ? receiptId : undefined, remarks: remarks || undefined })} />
        </div>
      )}>
      {line && (
        <div className="grid">
          <div className="col-12">
            <div className="br-notice br-notice-ok">
              <b>{date(line.date)}</b> · {line.description}{line.reference ? ` · ${line.reference}` : ""} · <Amount value={line.amount} /> ({t(`bankReconciliation.direction.${direction}`)})
            </div>
          </div>
          <div className="col-12">
            <label htmlFor="br-adj-type">{t("bankReconciliation.transactionType")} *</label>
            <Dropdown inputId="br-adj-type" value={typeCode} onChange={(e) => setTypeCode(e.value)} className="w-full"
              options={options.map((x) => ({ label: `${x.code} – ${x.name}`, value: x.code }))} placeholder={t("bankReconciliation.select")} />
            {type && <div className="pe-muted mt-1">{type.description}{type.requiresApproval ? ` · ${t("bankReconciliation.requiresApproval")}` : ""}</div>}
          </div>
          {type?.action !== "returned-cheque" && (
            <div className="col-12 md:col-6">
              <label htmlFor="br-adj-date">{t("bankReconciliation.postingDate")}</label>
              <InputText id="br-adj-date" type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className="w-full" />
            </div>
          )}
          {type?.allowAccountOverride && (
            <div className="col-12 md:col-6">
              <label htmlFor="br-adj-acct">{t("bankReconciliation.counterAccount")}</label>
              <Dropdown inputId="br-adj-acct" value={accountCode} onChange={(e) => setAccountCode(e.value)} className="w-full" filter showClear
                placeholder={t("bankReconciliation.defaultAccount", { role: type.accountRole || type.glAccountCode })}
                options={glAccounts.map((g) => ({ label: `${g.code} – ${g.name}`, value: g.code }))} />
            </div>
          )}
          {type?.action === "returned-cheque" && (
            <div className="col-12">
              <label htmlFor="br-adj-receipt">{t("bankReconciliation.receipt")} *</label>
              {receipts.length > 0 ? (
                <Dropdown inputId="br-adj-receipt" value={receiptId} onChange={(e) => setReceiptId(e.value)} className="w-full" editable
                  options={receipts.map((v) => ({ label: `${v.documentNumber} · ${date(v.date)} · ${v.party || ""}`, value: v.documentNumber }))} />
              ) : (
                <InputText id="br-adj-receipt" value={receiptId} onChange={(e) => setReceiptId(e.target.value)} className="w-full" placeholder="OR-2026-00018" />
              )}
              <div className="pe-muted mt-1">{t("bankReconciliation.returnedChequeHelp")}</div>
            </div>
          )}
          <div className="col-12">
            <label htmlFor="br-adj-remarks">{t("bankReconciliation.remarks")}</label>
            <InputTextarea id="br-adj-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full" />
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default AdjustmentDialog;
