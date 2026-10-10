import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { Field, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";
import { openConfirm } from "../../components/ConfirmDialog";

const METHODS = ["auto", "pro-rata", "short-period", "flat"];
const TYPES = ["FULL", "PARTIAL"];

/**
 * Operations > Policy Cancellation: the return premium of cancelling a policy on a date, computed from the days left
 * (pro-rata when the insurer cancels, the short-period scale when the insured cancels, flat from inception), with the
 * premium taxes of the charge engine and the commission taken back. Creating the cancellation opens the endorsement
 * summary (send to the client, complete); the server recomputes the same figures.
 */
const PolicyCancellation = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [reasons, setReasons] = useState([]);
  const [scale, setScale] = useState([]);
  const [form, setForm] = useState({ policyId: params.get("policy") || "", effectiveDate: new Date(), reason: null, method: "auto", cancellationType: "FULL", partialPercent: null, partialPremium: null });
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    Promise.all([service.cancellationReasons(), service.shortPeriodScale()])
      .then(([r, s]) => { setReasons(r); setScale(s); setForm((f) => ({ ...f, reason: f.reason || r[0]?.code || null })); })
      .catch((e) => showError(toast, e));
  }, []);

  const body = () => ({ policyId: form.policyId.trim(), effectiveDate: isoOf(form.effectiveDate), reason: form.reason || undefined, method: form.method,
    cancellationType: form.cancellationType, ...(form.cancellationType === "PARTIAL" ? { partialPercent: form.partialPercent || undefined, partialPremium: form.partialPremium || undefined } : {}) });
  const compute = async () => {
    if (!form.policyId.trim()) return;
    try {
      setQuote(await service.cancellationQuote(body()));
    } catch (e) {
      setQuote(null);
      showError(toast, e);
    }
  };
  // the endorsement is created inside the confirmation, which names the policy and the figures it carries
  const create = async () => {
    const b = body();
    let e = null;
    const done = await openConfirm({
      title: t("opsAcc.cancellation.confirmTitle", { number: quote.policyNumber }),
      severity: "warning",
      message: t("opsAcc.cancellation.confirmMessage"),
      facts: [
        { label: t("opsAcc.policyNumber"), value: quote.policyNumber },
        { label: t("opsAcc.cancellation.effectiveDate"), value: b.effectiveDate, type: "date" },
        { label: t("opsAcc.cancellation.reason"), value: reason?.name || b.reason },
        { label: t("opsAcc.cancellation.method"), value: t(`opsAcc.cancellation.methods.${quote.method}`) },
        { label: t("opsAcc.cancellation.type"), value: t(`opsAcc.cancellation.types.${b.cancellationType}`) },
        { label: t("opsAcc.cancellation.grossReturn"), value: quote.grossReturn, type: "amount", emphasis: true },
        { label: t("opsAcc.cancellation.commission"), value: quote.commissionReversed, type: "amount" },
      ],
      confirmLabel: t("opsAcc.cancellation.create"),
      onConfirm: async () => {
        e = await service.createCancellation({ policyId: quote.policyId, endorsementTypeIds: [], isCancelPolicy: true, cancellationType: b.cancellationType, cancellationReason: b.reason,
          cancellationMethod: b.method === "auto" ? undefined : b.method, effectiveDate: b.effectiveDate, partialPercent: b.partialPercent, partialPremium: b.partialPremium });
      },
    });
    if (!done || !e) return;
    showSuccess(toast, t("opsAcc.cancellation.created", { number: e.endorsementNumber }));
    navigate(`/agent/endorsement/summary/${e.endorsementId}`, { state: { endorsementId: e.endorsementId, policyId: quote.policyId, endorsementData: e } });
  };
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setQuote(null); };
  const reason = reasons.find((r) => r.code === form.reason);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.cancellation.title")} group={t("opsAcc.operations")} subtitle={t("opsAcc.cancellation.intro")} />
      <div className="pe-card mb-3">
        <div className="grid">
          <Field label={t("opsAcc.policyNumber")} col="col-12 md:col-3" required><InputText value={form.policyId} onChange={(e) => set({ policyId: e.target.value })} onKeyDown={(e) => e.key === "Enter" && compute()} className="w-full" /></Field>
          <Field label={t("opsAcc.cancellation.effectiveDate")} col="col-12 md:col-3"><Calendar value={form.effectiveDate} onChange={(e) => set({ effectiveDate: e.value })} showIcon className="w-full" /></Field>
          <Field label={t("opsAcc.cancellation.reason")} col="col-12 md:col-6">
            <Dropdown value={form.reason} options={reasons.map((r) => ({ label: `${r.name} (${t(`opsAcc.cancellation.by.${r.initiatedBy}`)})`, value: r.code }))} onChange={(e) => set({ reason: e.value })} className="w-full" />
          </Field>
          <Field label={t("opsAcc.cancellation.method")} col="col-12 md:col-3">
            <Dropdown value={form.method} options={METHODS.map((m) => ({ label: t(`opsAcc.cancellation.methods.${m}`), value: m }))} onChange={(e) => set({ method: e.value })} className="w-full" />
          </Field>
          <Field label={t("opsAcc.cancellation.type")} col="col-12 md:col-3">
            <Dropdown value={form.cancellationType} options={TYPES.map((x) => ({ label: t(`opsAcc.cancellation.types.${x}`), value: x }))} onChange={(e) => set({ cancellationType: e.value })} className="w-full" />
          </Field>
          {form.cancellationType === "PARTIAL" && (
            <>
              <Field label={t("opsAcc.cancellation.partialPercent")} col="col-12 md:col-3"><InputNumber value={form.partialPercent} min={0} max={100} suffix="%" onValueChange={(e) => set({ partialPercent: e.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.cancellation.partialPremium")} col="col-12 md:col-3"><InputNumber value={form.partialPremium} mode="decimal" minFractionDigits={2} onValueChange={(e) => set({ partialPremium: e.value })} className="w-full" /></Field>
            </>
          )}
        </div>
        {reason && <p className="pe-muted mt-0">{t("opsAcc.cancellation.reasonHelp", { by: t(`opsAcc.cancellation.by.${reason.initiatedBy}`), method: t(`opsAcc.cancellation.methods.${reason.method}`) })}</p>}
        <Button icon="pi pi-calculator" label={t("opsAcc.cancellation.compute")} onClick={compute} />
      </div>

      {quote && (
        <div className="pe-card mb-3">
          <h3 className="mt-0">{quote.policyNumber}: {t(`opsAcc.cancellation.methods.${quote.method}`)}</h3>
          <p>{quote.explanation}</p>
          <div className="grid">
            <div className="col-12 md:col-6">
              <table className="w-full">
                <tbody>
                  <tr><td>{t("opsAcc.cancellation.period")}</td><td className="bv-num">{date(quote.inceptionDate)} - {date(quote.expiryDate)} ({quote.totalDays})</td></tr>
                  <tr><td>{t("opsAcc.cancellation.inForce")}</td><td className="bv-num">{quote.daysInForce}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.daysLeft")}</td><td className="bv-num">{quote.daysLeft}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.basePremium")}</td><td className="bv-num">{money(quote.basePremium)}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.retained")}</td><td className="bv-num">{money(quote.retainedNetPremium)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="col-12 md:col-6">
              <table className="w-full">
                <tbody>
                  <tr><td>{t("opsAcc.cancellation.returnNet")}</td><td className="bv-num">{money(quote.returnNetPremium)}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.vat")}</td><td className="bv-num">{money(quote.taxes.vat)}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.dst")}</td><td className="bv-num">{money(quote.taxes.dst)}</td></tr>
                  <tr><td>{t("opsAcc.cancellation.lgt")}</td><td className="bv-num">{money(quote.taxes.lgt)}</td></tr>
                  <tr><td><b>{t("opsAcc.cancellation.grossReturn")}</b></td><td className="bv-num"><b>{money(quote.grossReturn)}</b></td></tr>
                  <tr><td>{t("opsAcc.cancellation.commission")}</td><td className="bv-num">{money(quote.commissionReversed)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <Button icon="pi pi-check" label={t("opsAcc.cancellation.create")} onClick={create} />
        </div>
      )}

      <div className="pe-card">
        <h3 className="mt-0">{t("opsAcc.cancellation.scale")}</h3>
        <DataTable value={scale} dataKey="code" size="small" stripedRows emptyMessage={t("opsAcc.none")}>
          <Column field="description" header={t("opsAcc.cancellation.band")} />
          <Column field="maxDays" header={t("opsAcc.cancellation.upToDays")} {...numericColumn} />
          <Column header={t("opsAcc.cancellation.retainedPercent")} body={(r) => `${r.retainedPercent}%`} {...numericColumn} />
        </DataTable>
      </div>
    </div>
  );
};

export default PolicyCancellation;
