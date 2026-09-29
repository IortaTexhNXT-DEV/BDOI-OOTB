import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { RadioButton } from "primereact/radiobutton";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import policyService from "../../services/policyService";
import S3FileUpload from "../S3FileUpload";
import { formatDate as formatAppDate } from "../../utility/dateFormat";
import { promptText } from "../../utility/dialogs";

const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { referenceNo: "", amount: null, paymentDate: todayIso(), proofKey: "", proofFileName: "", remarks: "" };
const STATUS_SEVERITY = { submitted: "warning", confirmed: "success", rejected: "danger" };
const STATUS_LABEL = { submitted: "Awaiting finance verification", confirmed: "Confirmed", rejected: "Rejected" };

/**
 * Premium payment capture for a policy bill (quote / policy payment and endorsement payment screens).
 *
 * The user records how the client pays: pay later (the bill stays open) or a payment (mode, reference, amount, date,
 * optional proof) through POST /policies/:id/payments. For Sales & Marketing, the Processing Team and Operations the
 * payment is recorded as pending; Accounting verifies (confirm / reject) it and only then is the official receipt issued.
 * An Accounting user (summary.canConfirm) posts the receipt at capture and can confirm or reject pending payments here.
 *
 * Props:
 *  - policyId: the policy whose bills are paid
 *  - receivableId: restrict to one bill (e.g. the bill raised by an endorsement); otherwise all open bills of the policy
 *  - onSummary(summary): called with the payment summary each time it is loaded
 *  - onPayLater(): called after "pay later" was recorded
 *  - onCancel(): the Cancel button
 */
const PolicyPaymentCapture = ({ policyId, receivableId = null, onSummary, onPayLater, onCancel }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [option, setOption] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const showToast = (severity, summaryText, detail, life = 4000) => toast.current?.show({ severity, summary: summaryText, detail, life });

  // the bills this panel pays: one bill (endorsement) or every open bill of the policy
  const billsOf = useCallback((s) => (s?.receivables || []).filter((b) => !receivableId || b.receivableId === receivableId), [receivableId]);

  const loadSummary = useCallback(async () => {
    if (!policyId) return;
    setLoading(true);
    const r = await policyService.getPolicyPayments(policyId);
    setLoading(false);
    if (!r.success) {
      showToast("error", "Could not load the payment details", r.error);
      return;
    }
    setSummary(r.data);
    if (onSummary) onSummary(r.data);
    const bills = billsOf(r.data);
    const open = bills.reduce((s, b) => s + Number(b.balance || 0) - Number(b.pendingVerification || 0), 0);
    setForm((f) => ({ ...f, amount: Math.max(0, Math.round(open * 100) / 100) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId, billsOf]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const bills = billsOf(summary);
  const modes = summary?.modes || [];
  const selectedMode = modes.find((m) => m.value === option);
  const outstanding = Math.round(bills.reduce((s, b) => s + Number(b.balance || 0), 0) * 100) / 100;
  const pendingTotal = bills.reduce((s, b) => s + Number(b.pendingVerification || 0), 0);
  const payable = Math.max(0, Math.round((outstanding - pendingTotal) * 100) / 100);
  const captures = (summary?.captures || []).filter((c) => !receivableId || c.receivableId === receivableId);

  const validationMessage = () => {
    if (!option) return "Choose how the client pays";
    if (option === "pay-later") return null;
    if (selectedMode?.referenceRequired && !String(form.referenceNo || "").trim()) return `Enter the ${selectedMode.label.toLowerCase()} reference number`;
    if (!(Number(form.amount) > 0)) return "Enter the amount paid";
    if (Number(form.amount) > payable) return `The amount cannot exceed ${formatCurrency(payable)}`;
    if (!form.paymentDate) return "Enter the payment date";
    if (form.paymentDate > todayIso()) return "The payment date cannot be in the future";
    return null;
  };

  const handleSubmit = async () => {
    const problem = validationMessage();
    if (problem) {
      showToast("warn", "Payment details incomplete", problem);
      return;
    }
    setSaving(true);
    if (option === "pay-later") {
      const r = await policyService.recordPayLater(policyId);
      setSaving(false);
      if (!r.success) {
        showToast("error", "Could not record pay later", r.error);
        return;
      }
      showToast("success", "Pay later", "The bill stays open; capture the payment when the client pays.");
      if (onPayLater) setTimeout(onPayLater, 1200);
      return;
    }
    const r = await policyService.capturePolicyPayment(policyId, {
      paymentMode: option,
      referenceNo: form.referenceNo || undefined,
      amount: Number(form.amount),
      paymentDate: form.paymentDate,
      proofKey: form.proofKey || undefined,
      proofFileName: form.proofFileName || undefined,
      remarks: form.remarks || undefined,
      ...(receivableId ? { receivableId } : {}),
    });
    setSaving(false);
    if (!r.success) {
      showToast("error", "Payment not recorded", r.error, 7000);
      return;
    }
    showToast("success", r.data.posted ? "Payment confirmed" : "Payment recorded", r.message, 6000);
    setOption(null);
    setForm({ ...EMPTY_FORM });
    loadSummary();
  };

  const handleConfirm = async (capture) => {
    setSaving(true);
    const r = await policyService.confirmPolicyPayment(policyId, capture.id);
    setSaving(false);
    if (!r.success) {
      showToast("error", "Could not confirm the payment", r.error, 7000);
      return;
    }
    showToast("success", "Payment confirmed", r.message);
    loadSummary();
  };

  const handleReject = async (capture) => {
    // eslint-disable-next-line no-alert
    const reason = await promptText("Reason for rejecting this payment (e.g. no matching credit in the bank statement)");
    if (!reason || reason.trim().length < 3) return;
    setSaving(true);
    const r = await policyService.rejectPolicyPayment(policyId, capture.id, reason.trim());
    setSaving(false);
    if (!r.success) {
      showToast("error", "Could not reject the payment", r.error);
      return;
    }
    showToast("info", "Payment rejected", r.message);
    loadSummary();
  };

  const openGateway = () => {
    const url = summary?.gateway?.url;
    if (!url) return;
    const target = `${url}${url.includes("?") ? "&" : "?"}reference=${encodeURIComponent(summary.policyNumber || policyId)}&amount=${encodeURIComponent(payable)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Toast ref={toast} />
      <Card className="mt-3">
        <div className="sub__title__header">
          <label className="sub__title">How does the client pay?</label>
          <label className="waiting__payment">Outstanding {formatCurrency(outstanding)}</label>
        </div>
        {loading && !summary && <p>Loading…</p>}
        {summary?.billingMode === "direct" && (
          <Message
            severity="info"
            className="w-full justify-content-start mt-3"
            text={`Direct bill: the client pays the premium directly to the insurer. No premium is collected by the broker; our commission of ${formatCurrency(
              summary.directBill?.commissionDue || 0
            )} (with VAT) is billed to the insurer by finance (Remittance > Direct Bill Processing).`}
          />
        )}
        {summary && summary.billingMode !== "direct" && outstanding <= 0 && (
          <Message
            severity="success"
            className="w-full justify-content-start mt-3"
            text={receivableId ? "This bill has no outstanding premium." : "This policy has no outstanding premium."}
          />
        )}
        {summary && pendingTotal > 0 && (
          <Message severity="info" className="w-full justify-content-start mt-3" text={`${formatCurrency(pendingTotal)} is awaiting finance verification.`} />
        )}

        {summary && outstanding > 0 && (
          <>
            <div className="flex flex-column gap-3 mt-3">
              <div className="flex align-items-center gap-2">
                <RadioButton inputId="pay-later" name="payOption" value="pay-later" onChange={(e) => setOption(e.value)} checked={option === "pay-later"} />
                <label htmlFor="pay-later">
                  <strong>Pay later</strong> — the bill stays open; record the payment when the client pays
                </label>
              </div>
              {modes.map((m) => (
                <div className="flex align-items-center gap-2" key={m.value}>
                  <RadioButton inputId={`mode-${m.value}`} name="payOption" value={m.value} onChange={(e) => setOption(e.value)} checked={option === m.value} />
                  <label htmlFor={`mode-${m.value}`}>
                    <strong>{m.label}</strong>
                    {m.value === "online" && !summary.gateway?.enabled ? " — paid online by the client; enter the transaction reference" : ""}
                  </label>
                </div>
              ))}
            </div>

            {option === "online" && summary.gateway?.enabled && (
              <div className="mt-3">
                <Button type="button" icon="pi pi-external-link" label="Open the online payment gateway" className="p-button-outlined" onClick={openGateway} />
                <div className="text-sm text-600 mt-2">
                  Gateway configured in System Settings (policy.payment_gateway_url). After the client pays, enter the gateway transaction reference below.
                </div>
              </div>
            )}

            {option && option !== "pay-later" && (
              <div className="grid mt-3">
                <div className="col-12 md:col-6">
                  <label htmlFor="pay-ref" className="block mb-2">
                    Reference number{selectedMode?.referenceRequired ? " *" : ""}
                  </label>
                  <InputText
                    id="pay-ref"
                    className="w-full"
                    value={form.referenceNo}
                    placeholder={option === "check" ? "Cheque number / bank" : "Bank / transaction reference"}
                    onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label htmlFor="pay-amount" className="block mb-2">Amount paid *</label>
                  <InputNumber
                    inputId="pay-amount"
                    className="w-full"
                    value={form.amount}
                    mode="decimal"
                    minFractionDigits={2}
                    maxFractionDigits={2}
                    min={0}
                    max={payable}
                    onValueChange={(e) => setForm({ ...form, amount: e.value })}
                  />
                  <div className="text-sm text-600 mt-1">Up to {formatCurrency(payable)}</div>
                </div>
                <div className="col-12 md:col-6">
                  <label htmlFor="pay-date" className="block mb-2">Payment date *</label>
                  <InputText
                    id="pay-date"
                    type="date"
                    className="w-full"
                    max={todayIso()}
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label htmlFor="pay-remarks" className="block mb-2">Remarks</label>
                  <InputTextarea id="pay-remarks" className="w-full" rows={1} autoResize value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="block mb-2">Proof of payment (deposit slip, cheque image, screenshot) — optional</label>
                  <S3FileUpload
                    accept=".pdf,.png,.jpg,.jpeg"
                    maxFileSize={10 * 1024 * 1024}
                    multiple={false}
                    showPreview
                    autoUpload
                    uploadPath="payment-proofs"
                    onUploadSuccess={(url, file) => setForm((f) => ({ ...f, proofKey: url, proofFileName: file?.name || "" }))}
                    onRemove={() => setForm((f) => ({ ...f, proofKey: "", proofFileName: "" }))}
                  />
                </div>
                {!summary.canConfirm && (
                  <div className="col-12">
                    <Message
                      severity="info"
                      className="w-full justify-content-start"
                      text="The payment is recorded for finance to verify. The official receipt is issued once finance confirms it."
                    />
                  </div>
                )}
              </div>
            )}

            <div className="button_component">
              <Button label={t("common.cancel", "Cancel")} severity="help" text className="download_button" onClick={onCancel} disabled={saving} />
              <Button
                label={option === "pay-later" ? "Confirm pay later" : summary.canConfirm ? "Record payment and issue receipt" : "Record payment"}
                className="policy_button"
                onClick={handleSubmit}
                loading={saving}
                disabled={saving || !option}
              />
            </div>
          </>
        )}
      </Card>

      {captures.length > 0 && (
        <Card className="mt-3">
          <div className="table__header">Payments recorded</div>
          {captures.map((c) => (
            <div key={c.id} className="flex flex-wrap align-items-center justify-content-between gap-2 py-3 border-bottom-1 surface-border">
              <div>
                <div className="font-semibold">
                  {c.paymentModeLabel} · {formatCurrency(c.amount)} · {formatAppDate(c.paymentDate)}
                </div>
                <div className="text-sm text-600">
                  Ref {c.referenceNo || "—"}
                  {c.billNumber ? ` · Bill ${c.billNumber}` : ""}
                  {c.receiptNumber ? ` · Receipt ${c.receiptNumber}` : ""}
                  {c.submittedBy ? ` · by ${c.submittedBy}` : ""}
                  {c.rejectReason ? ` · ${c.rejectReason}` : ""}
                </div>
                {c.proofKey && (
                  <a href={c.proofKey} target="_blank" rel="noopener noreferrer" className="text-sm">
                    {c.proofFileName || "Proof of payment"}
                  </a>
                )}
              </div>
              <div className="flex align-items-center gap-2">
                <Tag value={STATUS_LABEL[c.status] || c.status} severity={STATUS_SEVERITY[c.status]} />
                {summary.canConfirm && c.status === "submitted" && (
                  <>
                    <Button size="small" label="Confirm" icon="pi pi-check" onClick={() => handleConfirm(c)} disabled={saving} />
                    <Button size="small" label="Reject" icon="pi pi-times" severity="danger" text onClick={() => handleReject(c)} disabled={saving} />
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
};

export default PolicyPaymentCapture;
