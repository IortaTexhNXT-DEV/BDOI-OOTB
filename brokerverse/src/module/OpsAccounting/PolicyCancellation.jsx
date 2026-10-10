import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Toast } from "primereact/toast";
import StatCards from "../../components/StatCards";
import service from "../../services/opsAccountingService";
import { canOpen } from "../../utils/canOpen";
import { Field, PageHeader, date, isoOf, money, showError, showSuccess } from "./common";
import { openConfirm } from "../../components/ConfirmDialog";

const METHODS = ["auto", "pro-rata", "short-period", "flat"];
const TYPES = ["FULL", "PARTIAL"];
const SHORT_PERIOD_MASTER = "/master/insurance/short-period-rates";

const policyOption = (p) => ({ id: p.policyId || p.id, label: `${p.policyNumber}${p.insuredName ? ` - ${p.insuredName}` : ""}` });

/** Percentage of the premium the insurer keeps: the band of the scale, else what the factor leaves. */
export const keptPercent = (quote) => {
  if (quote.shortPeriodBand) return Number(quote.shortPeriodBand.retainedPercent);
  if (quote.factor === null || quote.factor === undefined) return null;
  return Math.round((1 - Number(quote.factor)) * 10000) / 100;
};

/** The figures of a computed return premium as KPI cards: what this cancellation means for this policy only. */
export const resultCards = (quote, t) => {
  const taxes = Object.values(quote.taxes || {}).reduce((s, v) => s + Number(v || 0), 0);
  const kept = keptPercent(quote);
  return [
    { key: "inForce", label: t("opsAcc.cancellation.inForce"), value: `${quote.daysInForce} / ${quote.totalDays}`, note: t("opsAcc.cancellation.daysLeftNote", { count: quote.daysLeft }) },
    { key: "band", label: t("opsAcc.cancellation.bandApplied"), value: quote.shortPeriodBand?.description || t(`opsAcc.cancellation.methods.${quote.method}`), note: t(`opsAcc.cancellation.methods.${quote.method}`) },
    { key: "kept", label: t("opsAcc.cancellation.keptPercent"), value: kept === null ? "-" : `${kept}%`, note: t("opsAcc.cancellation.ofPremium", { amount: money(quote.basePremium) }) },
    { key: "retained", label: t("opsAcc.cancellation.retained"), value: money(quote.retainedNetPremium) },
    { key: "returnNet", label: t("opsAcc.cancellation.returnNet"), value: money(quote.returnNetPremium) },
    { key: "taxes", label: t("opsAcc.cancellation.taxesReturned"), value: money(taxes), note: t("opsAcc.cancellation.taxesNote", { vat: money(quote.taxes.vat), lgt: money(quote.taxes.lgt) }) },
    { key: "client", label: t("opsAcc.cancellation.refundClient"), value: money(quote.grossReturn) },
    { key: "insurer", label: t("opsAcc.cancellation.dueFromInsurer"), value: money(quote.insurerReturn),
      note: quote.remittanceBasis === "gross" ? t("opsAcc.cancellation.grossBasisNote") : t("opsAcc.cancellation.commissionNote", { amount: money(quote.commissionReversed) }) },
  ];
};

/**
 * Operations > Policy Cancellation: the return premium of cancelling one policy on a date, computed from the days left
 * (pro-rata when the insurer cancels, the short-period scale of Master > Short-Period Rates when the insured cancels,
 * flat from inception). Only this policy's result is shown; creating the cancellation opens the endorsement summary
 * (approval, send to the insurer, complete), and the server recomputes the same figures.
 */
const PolicyCancellation = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [reasons, setReasons] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [policy, setPolicy] = useState(params.get("policy") ? { id: params.get("policy"), label: params.get("policy") } : null);
  const [form, setForm] = useState({ effectiveDate: new Date(), reason: null, method: "auto", cancellationType: "FULL", partialPercent: null, partialPremium: null });
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    service.cancellationReasons()
      .then((r) => { setReasons(r); setForm((f) => ({ ...f, reason: f.reason || r[0]?.code || null })); })
      .catch((e) => showError(toast, e));
  }, []);

  const searchPolicies = async (e) => {
    try {
      setSuggestions((await service.searchPolicies(e.query)).map(policyOption));
    } catch {
      setSuggestions([]);
    }
  };
  const policyId = typeof policy === "object" && policy ? policy.id : null;
  const body = () => ({ policyId, effectiveDate: isoOf(form.effectiveDate), reason: form.reason || undefined, method: form.method,
    cancellationType: form.cancellationType, ...(form.cancellationType === "PARTIAL" ? { partialPercent: form.partialPercent || undefined, partialPremium: form.partialPremium || undefined } : {}) });
  const compute = async () => {
    if (!policyId) return;
    setBusy(true);
    try {
      setQuote(await service.cancellationQuote(body()));
    } catch (e) {
      setQuote(null);
      showError(toast, e);
    } finally {
      setBusy(false);
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
          <Field label={t("opsAcc.policyNumber")} col="col-12 md:col-4" required>
            <AutoComplete inputId="cxl-policy" value={policy} suggestions={suggestions} completeMethod={searchPolicies} field="label" forceSelection dropdown
              placeholder={t("opsAcc.cancellation.policyHint")} onChange={(e) => { setPolicy(e.value); setQuote(null); }} className="w-full" inputClassName="w-full" />
          </Field>
          <Field label={t("opsAcc.cancellation.effectiveDate")} col="col-12 md:col-2"><Calendar value={form.effectiveDate} onChange={(e) => set({ effectiveDate: e.value })} showIcon className="w-full" /></Field>
          <Field label={t("opsAcc.cancellation.reason")} col="col-12 md:col-6">
            <Dropdown value={form.reason} options={reasons.map((r) => ({ label: `${r.name} (${t(`opsAcc.cancellation.by.${r.initiatedBy}`)})`, value: r.code }))} onChange={(e) => set({ reason: e.value })} className="w-full" />
          </Field>
          <Field label={t("opsAcc.cancellation.method")} col="col-12 md:col-3">
            <Dropdown value={form.method} options={METHODS.map((m) => ({ label: m === "auto" && reason && reason.method !== "auto" ? t("opsAcc.cancellation.fromReason", { method: t(`opsAcc.cancellation.methods.${reason.method}`) }) : t(`opsAcc.cancellation.methods.${m}`), value: m }))}
              onChange={(e) => set({ method: e.value })} className="w-full" />
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
        <Button icon="pi pi-calculator" label={t("opsAcc.cancellation.compute")} onClick={compute} loading={busy && !quote} disabled={!policyId} />
      </div>

      {quote && (
        <div className="pe-card mb-3">
          <div className="flex align-items-center justify-content-between flex-wrap gap-2">
            <h3 className="m-0">{t("opsAcc.cancellation.resultTitle", { number: quote.policyNumber })}</h3>
            <span className="pe-muted">{t("opsAcc.cancellation.periodLine", { from: date(quote.inceptionDate), to: date(quote.expiryDate), on: date(quote.effectiveDate) })}</span>
          </div>
          <StatCards items={resultCards(quote, t)} className="bv-stat-cards--wide" />
          <div className="flex align-items-center justify-content-between flex-wrap gap-2">
            {quote.method === "short-period" && canOpen(SHORT_PERIOD_MASTER) ? <Link to={SHORT_PERIOD_MASTER}>{t("opsAcc.cancellation.scaleLink")}</Link> : <span />}
            <Button icon="pi pi-check" label={t("opsAcc.cancellation.create")} onClick={create} loading={busy} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyCancellation;
