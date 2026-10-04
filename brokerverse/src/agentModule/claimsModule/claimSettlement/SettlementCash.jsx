import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import claimSettlementCashService from "../../../services/claimSettlementCashService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { hasPermission } from "../../../utils/canOpen";

const PAYMENT_MODES = [
  { label: "Cheque", value: "check" },
  { label: "Bank transfer", value: "bank-transfer" },
  { label: "Cash", value: "cash" },
];

/**
 * Cash of a settlement paid through the broker: money received from each insurer and the payment to the claimant.
 * Only shown for such settlements; the buttons follow the finance permissions the API checks.
 */
const SettlementCash = ({ claimId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [pos, setPos] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, amount, bankAccount, insurerId, reference, paymentMode, payee, date }
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!claimId) return;
    claimSettlementCashService.getPosition(claimId).then(setPos).catch(() => setPos(null));
  }, [claimId]);
  useEffect(() => { load(); }, [load]);

  if (!pos || !pos.paidThroughBroker) return null;

  const bankOptions = (pos.bankAccounts || []).map((b) => ({ label: `${b.name} (${b.code})`, value: b.code }));
  const open = (kind) => {
    const due = pos.insurers.find((i) => i.outstanding > 0);
    setDialog(kind === "funds-received"
      ? { kind, amount: due?.outstanding || 0, insurerId: due?.insurerId ?? null, bankAccount: bankOptions[0]?.value || "", reference: "", date: "" }
      : { kind, amount: pos.payableToClaimant, bankAccount: bankOptions[0]?.value || "", paymentMode: "check", payee: pos.claimant || "", reference: "", date: "" });
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...dialog, date: dialog.date || undefined };
      delete body.kind;
      const r = dialog.kind === "funds-received"
        ? await claimSettlementCashService.recordFundsReceived(claimId, body)
        : await claimSettlementCashService.recordPaidToClaimant(claimId, body);
      setPos(r.position);
      toast.current?.show({ severity: "success", summary: t("followUps.settlementCash", "Settlement cash"), detail: r.journalNumber || "" });
      setDialog(null);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("followUps.settlementCash", "Settlement cash"), detail: e.message });
    } finally {
      setSaving(false);
    }
  };
  const field = (label, input) => (
    <div className="field mb-3">
      <label className="block mb-1">{label}</label>
      {input}
    </div>
  );
  const outstanding = pos.insurers.reduce((s, i) => s + i.outstanding, 0);
  const canReceive = pos.canRecord && outstanding > 0 && hasPermission("write:receipts");
  const canPay = pos.canRecord && pos.payableToClaimant > 0 && hasPermission("write:disbursements");

  return (
    <Card className="mt-3">
      <Toast ref={toast} />
      <div className="flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="claim__title">{t("followUps.settlementCash", "Settlement cash")}</div>
        <div className="flex gap-2">
          {canReceive && <Button icon="pi pi-download" label={t("followUps.recordFundsReceived", "Record funds received")} onClick={() => open("funds-received")} />}
          {canPay && <Button icon="pi pi-upload" severity="success" label={t("followUps.payClaimant", "Pay claimant")} onClick={() => open("paid-to-claimant")} />}
        </div>
      </div>
      {!pos.canRecord && <small className="block mt-2">{t("followUps.settlementNotBooked", "Cash can be recorded once the settlement through the broker is booked.")}</small>}
      <DataTable value={pos.insurers} size="small" className="mt-3">
        <Column field="insurer" header={t("followUps.insurer", "Insurer")} />
        <Column header={t("followUps.recoverable", "Recoverable")} body={(r) => formatCurrency(r.recoverable)} />
        <Column header={t("followUps.received", "Received")} body={(r) => formatCurrency(r.received)} />
        <Column header={t("followUps.outstanding", "Outstanding")} body={(r) => formatCurrency(r.outstanding)} />
      </DataTable>
      <div className="mt-3">
        {t("followUps.claimantPaid", "Paid to claimant")}: <b>{formatCurrency(pos.paidToClaimant)}</b> / {formatCurrency(pos.settlementAmount)}
        {" · "}{t("followUps.stillPayable", "Still payable")}: <b>{formatCurrency(pos.payableToClaimant)}</b>
      </div>
      {pos.movements.length > 0 && (
        <DataTable value={pos.movements} size="small" className="mt-3">
          <Column header={t("followUps.date", "Date")} body={(m) => formatAppDate(m.date)} />
          <Column header={t("followUps.movement", "Movement")} body={(m) => (m.kind === "funds-received" ? `${t("followUps.fundsReceived", "Funds received")} – ${m.insurer || ""}` : `${t("followUps.paidToClaimant", "Paid to claimant")} – ${m.payee || ""}`)} />
          <Column header={t("followUps.amount", "Amount")} body={(m) => formatCurrency(m.amount)} />
          <Column field="bankAccount" header={t("followUps.bankAccount", "Bank account")} />
          <Column field="reference" header={t("followUps.reference", "Reference")} />
          <Column field="journalNumber" header={t("followUps.journal", "Journal")} />
        </DataTable>
      )}
      <Dialog visible={!!dialog} onHide={() => setDialog(null)} style={{ width: "min(480px, 95vw)" }}
        header={dialog?.kind === "funds-received" ? t("followUps.recordFundsReceived", "Record funds received") : t("followUps.payClaimant", "Pay claimant")}
        footer={<Button label={t("followUps.save", "Save")} icon="pi pi-check" loading={saving} onClick={save} disabled={!dialog?.amount || !dialog?.bankAccount} />}>
        {dialog && (
          <div>
            {dialog.kind === "funds-received" && pos.insurers.length > 1 && field(t("followUps.insurer", "Insurer"),
              <Dropdown className="w-full" value={dialog.insurerId} options={pos.insurers.map((i) => ({ label: `${i.insurer} (${formatCurrency(i.outstanding)})`, value: i.insurerId }))}
                onChange={(e) => setDialog({ ...dialog, insurerId: e.value })} />)}
            {field(t("followUps.amount", "Amount"), <InputNumber className="w-full" value={dialog.amount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => setDialog({ ...dialog, amount: e.value })} />)}
            {field(t("followUps.bankAccount", "Bank account"), <Dropdown className="w-full" value={dialog.bankAccount} options={bankOptions} onChange={(e) => setDialog({ ...dialog, bankAccount: e.value })} />)}
            {dialog.kind === "paid-to-claimant" && field(t("followUps.paymentMode", "Payment mode"),
              <Dropdown className="w-full" value={dialog.paymentMode} options={PAYMENT_MODES} onChange={(e) => setDialog({ ...dialog, paymentMode: e.value })} />)}
            {dialog.kind === "paid-to-claimant" && field(t("followUps.payee", "Payee"), <InputText className="w-full" value={dialog.payee} onChange={(e) => setDialog({ ...dialog, payee: e.target.value })} />)}
            {field(dialog.kind === "funds-received" ? t("followUps.adviceReference", "Remittance advice / reference") : t("followUps.voucherReference", "Voucher / cheque number"),
              <InputText className="w-full" value={dialog.reference} onChange={(e) => setDialog({ ...dialog, reference: e.target.value })} />)}
            {field(t("followUps.date", "Date"), <InputText className="w-full" type="date" value={dialog.date} onChange={(e) => setDialog({ ...dialog, date: e.target.value })} />)}
          </div>
        )}
      </Dialog>
    </Card>
  );
};

export default SettlementCash;
