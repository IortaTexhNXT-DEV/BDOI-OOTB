import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { RadioButton } from "primereact/radiobutton";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import policyService from "../../../services/policyService";
import quotationService from "../../../services/quotationService";
import systemSettingsService from "../../../services/systemSettingsService";
import S3FileUpload from "../../../components/S3FileUpload";

const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { referenceNo: "", amount: null, paymentDate: todayIso(), proofKey: "", proofFileName: "", remarks: "" };
const STATUS_SEVERITY = { submitted: "warning", confirmed: "success", rejected: "danger" };
const STATUS_LABEL = { submitted: "Awaiting finance verification", confirmed: "Confirmed", rejected: "Rejected" };

/**
 * Policy payment (Operations > Quotation / Policy > Payment).
 *
 * Replaces the former mock payment that auto-completed and issued an official receipt without any money captured.
 * The user chooses how the client pays:
 *  - Billing mode at issue: broker billed (the client pays the broker, who remits to the insurer) or direct bill (the
 *    client pays the insurer directly; no premium bill is raised and the broker bills its commission to the insurer with
 *    a debit note). The default comes from System Settings (direct_bill.default_billing_mode).
 *  - Pay later: nothing is posted; the bill raised at issuance stays open.
 *  - Bank transfer / cheque / online / cash: mode, reference, amount, date and an optional proof are recorded for
 *    finance to verify. Only a user with write:receipts (finance) posts the official receipt, at capture or by
 *    confirming a pending capture here.
 * An online gateway is offered only when policy.payment_gateway_url is configured.
 */
const PaymentConfirmation = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: routePolicyId } = useParams();
  const toast = useRef(null);

  const { policydetailedlist } = useSelector(({ policyDetailedViewMainReducers }) => ({
    policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
  }));

  const quotationId = state?.quotationId || null;
  const [policyId, setPolicyId] = useState(state?.policyId || routePolicyId || null);
  const [resolving, setResolving] = useState(Boolean(!state?.policyId && !routePolicyId && quotationId));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [option, setOption] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [issueErrors, setIssueErrors] = useState([]);
  const [billingMode, setBillingMode] = useState("broker");

  useEffect(() => {
    systemSettingsService
      .getConfiguration("direct_bill")
      .then((rows) => {
        const mode = (rows || []).find((r) => r.key === "direct_bill.default_billing_mode")?.value;
        if (mode === "direct" || mode === "broker") setBillingMode(mode);
      })
      .catch(() => {});
  }, []);

  // The policy itself (GET /policies/:id) is the source of the premium breakdown and the client shown in the header.
  // Pages that open this one without a full policy in the navigation state (e.g. the finance "Premium payment to
  // verify" notification) otherwise only had the gross premium and the internal client id.
  const [loadedPolicy, setLoadedPolicy] = useState(null);
  useEffect(() => {
    if (!policyId) return undefined;
    let active = true;
    policyService.getPolicyDetails(policyId).then((r) => {
      const data = r?.success ? r.data?.data || r.data : null;
      if (active && data && (data.policyId || data.id)) setLoadedPolicy(data);
    });
    return () => {
      active = false;
    };
  }, [policyId]);

  const statePolicy = state?.policy || state?.policyData || {};
  const reduxPolicy = policydetailedlist && (!policyId || policydetailedlist.policyId === policyId) ? policydetailedlist : {};
  const policy = loadedPolicy || (statePolicy.policyId || statePolicy.id || !policyId ? statePolicy : reduxPolicy) || {};
  const quote = policy.quotation || state?.quotation || {};
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "") ?? 0;
  const premium = {
    net: pick(policy.netPremium, quote.netPremium, state?.netPremium),
    dst: pick(policy.documentaryStampTax, quote.documentaryStampTax),
    vat: pick(policy.valueAddedTax, quote.valueAddedTax),
    lgt: pick(policy.localGovernmentTax, quote.localGovernmentTax),
    others: pick(policy.accountPremiumOthers, quote.accountPremiumOthers),
    discount: pick(policy.discount, quote.discount, quote.firePremiumDetails?.totalDiscount),
    gross: pick(policy.grossPremium, state?.grossPremium, state?.GrossPremium, quote.grossPremium),
  };

  // Client code (CL-2026-00001) and name; the internal client id is never shown.
  const client = policy.client || {};
  const internalClientId = policy.clientId || client.clientId || client.id || state?.clientId;
  const clientName = pick(client.displayName, policy.insuredName, policy.ClientName, state?.clientName, state?.ClientName) || null;
  const stateCode = state?.clientNumber && state.clientNumber !== internalClientId ? state.clientNumber : null;
  const clientCode = pick(client.clientCode, client.generatedClientId, policy.clientCode, stateCode) || null;
  const displayTitle = useMemo(() => {
    const parts = [];
    if (clientName) parts.push(clientName);
    if (clientCode) parts.push(`${t("agent.clientIdLabel", "Client ID :")} ${clientCode}`);
    return parts.join(" / ") || t("agent.paymentDetails", "Payment details");
  }, [clientName, clientCode, t]);

  const showToast = (severity, summaryText, detail, life = 4000) => toast.current?.show({ severity, summary: summaryText, detail, life });

  // A quotation may already have been issued (e.g. sent to the insurer first): use that policy.
  useEffect(() => {
    if (policyId || !quotationId) return;
    let active = true;
    policyService
      .getPolicies(1, 1, { quoteRefId: quotationId })
      .then((r) => {
        const existing = r?.success ? r.data?.data?.[0] : null;
        if (active && existing) setPolicyId(existing.policyId || existing.id);
      })
      .finally(() => active && setResolving(false));
    return () => {
      active = false;
    };
  }, [policyId, quotationId]);

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
    const pending = (r.data.receivables || []).reduce((s, b) => s + Number(b.pendingVerification || 0), 0);
    setForm((f) => ({ ...f, amount: Math.max(0, Math.round((Number(r.data.outstanding || 0) - pending) * 100) / 100) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleBack = () => navigate(-1);

  /** Quote flow: issue the policy (KYC is checked by the server); the bill it raises stays open until paid. */
  const handleIssuePolicy = async () => {
    setIssuing(true);
    setIssueErrors([]);
    const result = await quotationService.convertQuotationToPolicy(
      quotationId,
      { ...(state?.additionalPolicyData || {}), paymentStatus: "Pending", billingMode },
      localStorage.getItem("USERNAME") || "agent",
      state?.lob || null
    );
    setIssuing(false);
    if (!result.success) {
      const message = result.error || "The policy could not be issued";
      const missing = message.includes("Missing:") ? message.split("Missing:")[1].split(";").map((s) => s.trim()).filter(Boolean) : [];
      setIssueErrors(missing);
      showToast("error", t("agent.policyCreationFailed", "Policy not issued"), message, 8000);
      return;
    }
    const created = result.data?.data?.policy || result.data?.policy;
    showToast(
      "success",
      t("agent.policyCreated", "Policy issued"),
      created?.billingMode === "direct" || billingMode === "direct"
        ? `Policy ${created?.policyNumber || ""} issued as direct bill: the client pays the insurer; finance bills the commission to the insurer`
        : `Policy ${created?.policyNumber || ""} issued; bill ${created?.billNumber || ""} is open for payment`
    );
    setPolicyId(created?.policyId || created?.id);
  };

  const modes = summary?.modes || [];
  const selectedMode = modes.find((m) => m.value === option);
  const outstanding = Number(summary?.outstanding || 0);
  const pendingTotal = (summary?.receivables || []).reduce((s, b) => s + Number(b.pendingVerification || 0), 0);
  const payable = Math.max(0, Math.round((outstanding - pendingTotal) * 100) / 100);

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
      setTimeout(() => navigate(`/agent/policydetail/${policyId}`), 1200);
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
    const reason = window.prompt("Reason for rejecting this payment (e.g. no matching credit in the bank statement)");
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

  const row = (label, value, className = "mt-3") => (
    <div className={`premium__header ${className}`}>
      <label className="net__premium">{label}</label>
      <label className="premium__id">{value}</label>
    </div>
  );

  return (
    <div className="overall__payment__confirmation">
      <Toast ref={toast} />
      <div className="header__title">{t("agent.clientsLabel", "Clients")}</div>
      <div className="left__arrow mt-3" onClick={handleBack}>
        <SvgLeftArrow />
        <label className="left__arrow__text">{displayTitle}</label>
      </div>

      <Card className="mt-3">
        <div className="table__header">{t("agent.paymentConfirmation", "Payment")}</div>
        <div className="sub__title__header mt-3">
          <label className="sub__title">{t("agent.paymentDetailsLabel", "Premium")}</label>
          {summary && (
            <label className="waiting__payment">
              {summary.policyNumber} · {summary.paymentStatus}
            </label>
          )}
        </div>
        {row(t("agent.netPremium", "Net premium"), formatCurrency(premium.net))}
        {row(t("agent.dst", "DST"), formatCurrency(premium.dst))}
        {row(t("agent.vat", "VAT"), formatCurrency(premium.vat))}
        {row(t("agent.lgt", "LGT"), formatCurrency(premium.lgt))}
        {row(t("agent.others", "Others"), formatCurrency(premium.others))}
        {row(t("agent.discount", "Discount"), `- ${formatCurrency(premium.discount)}`)}
        <div className="premium__header mt-5">
          <label className="gross__premium">{t("agent.grossPremium", "Gross premium")}</label>
          <label className="gross__id">{formatCurrency(summary ? summary.receivables?.[0]?.amount ?? premium.gross : premium.gross)}</label>
        </div>
      </Card>

      {!policyId && (
        <Card className="mt-3">
          {resolving ? (
            <p>Loading…</p>
          ) : (
            <>
              <p className="mt-0">
                Issue the policy first. Choose who the client pays: the broker (a bill is raised and stays open until the client&apos;s payment is recorded and verified by
                finance) or the insurer directly (direct bill: no premium bill; the broker&apos;s commission is billed to the insurer).
              </p>
              <div className="flex flex-column gap-2 mb-3">
                <div className="flex align-items-center gap-2">
                  <RadioButton inputId="bill-broker" name="billingMode" value="broker" onChange={(e) => setBillingMode(e.value)} checked={billingMode === "broker"} />
                  <label htmlFor="bill-broker">
                    <strong>Broker billed</strong> — the client pays the premium to us; we remit it to the insurer net of commission
                  </label>
                </div>
                <div className="flex align-items-center gap-2">
                  <RadioButton inputId="bill-direct" name="billingMode" value="direct" onChange={(e) => setBillingMode(e.value)} checked={billingMode === "direct"} />
                  <label htmlFor="bill-direct">
                    <strong>Direct bill</strong> — the client pays the premium directly to the insurer; we raise a commission debit note to the insurer
                  </label>
                </div>
              </div>
              {issueErrors.length > 0 && (
                <Message
                  severity="error"
                  className="w-full justify-content-start mb-3"
                  text={`Complete the customer information before issuing: ${issueErrors.join(", ")}`}
                />
              )}
              <div className="button_component">
                <Button label={t("common.cancel", "Cancel")} severity="help" text className="download_button" onClick={handleBack} disabled={issuing} />
                <Button label="Issue policy" className="policy_button" onClick={handleIssuePolicy} loading={issuing} disabled={issuing || !quotationId} />
              </div>
            </>
          )}
        </Card>
      )}

      {policyId && (
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
            <Message severity="success" className="w-full justify-content-start mt-3" text="This policy has no outstanding premium." />
          )}
          {summary && pendingTotal > 0 && (
            <Message
              severity="info"
              className="w-full justify-content-start mt-3"
              text={`${formatCurrency(pendingTotal)} is awaiting finance verification.`}
            />
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
                    <InputTextarea
                      id="pay-remarks"
                      className="w-full"
                      rows={1}
                      autoResize
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    />
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
                <Button label={t("common.cancel", "Cancel")} severity="help" text className="download_button" onClick={handleBack} disabled={saving} />
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
      )}

      {summary?.captures?.length > 0 && (
        <Card className="mt-3">
          <div className="table__header">Payments recorded</div>
          {summary.captures.map((c) => (
            <div key={c.id} className="flex flex-wrap align-items-center justify-content-between gap-2 py-3 border-bottom-1 surface-border">
              <div>
                <div className="font-semibold">
                  {c.paymentModeLabel} · {formatCurrency(c.amount)} · {c.paymentDate}
                </div>
                <div className="text-sm text-600">
                  Ref {c.referenceNo || "—"}
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
    </div>
  );
};

export default PaymentConfirmation;
