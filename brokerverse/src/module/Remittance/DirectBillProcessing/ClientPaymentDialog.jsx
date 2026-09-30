import React, { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import S3FileUpload from "../../../components/S3FileUpload";
import remittanceService from "../../../services/remittanceService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { calendarDateFormat, dateBody, isoDate, showError, showSuccess } from "../shared";
import { promptText } from "../../../utility/dialogs";

export const PAYMENT_SEVERITY = { Paid: "success", "Partially paid": "warning", Unpaid: "danger" };
const emptyForm = (balance) => ({ paymentDate: new Date(), amount: balance || null, insurerReference: "", paymentMode: null, proofKey: "", proofFileName: "", remarks: "" });

/**
 * Direct bill: the client's payment to the insurer on one policy. Lists what was recorded (the insurer's OR / reference,
 * proof) with the payment status, records a new payment and voids one entered in error. Nothing is posted to the GL.
 */
const ClientPaymentDialog = ({ policy, paymentModes, toast, onClose, onChanged }) => {
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!policy) return;
    try {
      const d = await remittanceService.clientPayments(policy.policyId);
      setData(d);
      setForm(emptyForm(d.balance));
    } catch (e) {
      showError(toast, e);
    }
  }, [policy, toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.insurerReference.trim() || !(Number(form.amount) > 0) || !form.paymentDate) {
      toast.current?.show({ severity: "warn", summary: "Details required", detail: "Enter the payment date, amount and the insurer's OR / reference number", life: 4000 });
      return;
    }
    setSaving(true);
    try {
      await remittanceService.recordClientPayment(policy.policyId, { ...form, paymentDate: isoDate(form.paymentDate), insurerReference: form.insurerReference.trim(),
        paymentMode: form.paymentMode || undefined, proofKey: form.proofKey || undefined, proofFileName: form.proofFileName || undefined, remarks: form.remarks || undefined });
      showSuccess(toast, `Payment ${form.insurerReference.trim()} recorded on ${data.policyNo}`);
      await load();
      onChanged?.();
    } catch (e) {
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };

  const voidPayment = async (row) => {
    const reason = await promptText(`Reason for voiding ${row.insurerReference}`);
    if (!reason || !reason.trim()) return;
    try {
      await remittanceService.voidClientPayment(row.id, reason.trim());
      showSuccess(toast, `${row.insurerReference} voided`);
      await load();
      onChanged?.();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <Dialog className="direct-bill-dialog" header={policy ? `Client payment to the insurer · ${policy.policyNo}` : ""} visible={!!policy} style={{ width: "min(900px, 95vw)" }} onHide={onClose}
      footer={<div><Button label="Close" className="p-button-text" onClick={onClose} /><Button label="Record payment" icon="pi pi-check" className="p-button-success" loading={saving} onClick={save} /></div>}>
      {data && form && (
        <>
          <Message severity="info" className="w-full justify-content-start mb-3"
            text={`Premium billed by the insurer ${formatCurrency(data.premium)} · paid ${formatCurrency(data.paid)} · balance ${formatCurrency(data.balance)}. The client pays the insurer directly, so nothing is posted to the ledger.`} />
          <div className="mb-3">Status: <Tag value={data.statusLabel} severity={PAYMENT_SEVERITY[data.statusLabel]} /></div>
          <DataTable value={data.items} size="small" stripedRows emptyMessage="No payment recorded yet" className="mb-3">
            <Column field="paymentDate" header="Paid on" body={dateBody("paymentDate")} />
            <Column field="insurerReference" header="Insurer OR / reference" />
            <Column field="paymentMode" header="Mode" />
            <Column field="amount" header="Amount" body={(r) => formatCurrency(r.amount)} className="text-right" />
            <Column header="Proof" body={(r) => (r.proofKey ? <a href={r.proofKey} target="_blank" rel="noopener noreferrer">{r.proofFileName || "View"}</a> : "-")} />
            <Column field="createdBy" header="Recorded by" />
            <Column field="status" header="Status" body={(r) => <Tag value={r.status} severity={r.status === "recorded" ? "success" : "secondary"} />} />
            <Column body={(r) => (r.status === "recorded" ? <Button icon="pi pi-ban" className="p-button-text p-button-sm" tooltip="Void" onClick={() => voidPayment(r)} /> : null)} />
          </DataTable>
          <div className="grid">
            <div className="col-12 md:col-4">
              <label>Paid on *</label>
              <Calendar value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.value })} maxDate={new Date()} dateFormat={calendarDateFormat()} showIcon className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label>Amount *</label>
              <InputNumber value={form.amount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className="w-full" onValueChange={(e) => setForm({ ...form, amount: e.value })} />
            </div>
            <div className="col-12 md:col-4">
              <label>Payment mode</label>
              <Dropdown value={form.paymentMode} options={paymentModes} showClear onChange={(e) => setForm({ ...form, paymentMode: e.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>Insurer OR / reference *</label>
              <InputText value={form.insurerReference} onChange={(e) => setForm({ ...form, insurerReference: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>Remarks</label>
              <InputTextarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={1} autoResize className="w-full" />
            </div>
            <div className="col-12">
              <label className="block mb-2">Proof (insurer OR copy, deposit slip, screenshot)</label>
              <S3FileUpload accept=".pdf,.png,.jpg,.jpeg" maxFileSize={10 * 1024 * 1024} multiple={false} showPreview autoUpload uploadPath="direct-bill-payments"
                onUploadSuccess={(url, file) => setForm((f) => ({ ...f, proofKey: url, proofFileName: file?.name || "" }))}
                onRemove={() => setForm((f) => ({ ...f, proofKey: "", proofFileName: "" }))} />
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
};

export default ClientPaymentDialog;
