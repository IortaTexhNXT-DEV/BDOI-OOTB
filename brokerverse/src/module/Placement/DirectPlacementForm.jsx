import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import placementService from "../../services/placementService";
import s3Service from "../../services/s3Service";
import quotationService from "../../services/quotationService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { calendarDateFormat } from "../../utility/dateFormat";
import { CustomerPicker, PageHeader, ParticipantEditor, RiskDetailsEditor, customerFields, customerName, participantProblem, usePlacementOptions } from "./shared";
import { isoDate } from "./dates";
import ProductPicker from "../Sales/ProductPicker";
import "./index.scss";

/**
 * Direct placement: a client instructs placement with named insurer(s), no quotation (e.g. a CTPL, whose LTO document /
 * official receipt goes to the insurer with the slip). The placement then follows the same chain to "Insurer issued".
 */
const DirectPlacementForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const options = usePlacementOptions();
  const [customer, setCustomer] = useState({ kind: "client" });
  const [productId, setProductId] = useState(null);
  const [insuredName, setInsuredName] = useState("");
  const [riskDetails, setRiskDetails] = useState({});
  const [sumInsured, setSumInsured] = useState(null);
  const [netPremium, setNetPremium] = useState(null);
  const [commissionRate, setCommissionRate] = useState(null);
  const [inception, setInception] = useState(null);
  const [expiry, setExpiry] = useState(null);
  const [billingMode, setBillingMode] = useState("default");
  const [ltoFile, setLtoFile] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [participants, setParticipants] = useState([{ insuranceCompanyId: null, sharePercent: 100, isLead: true, insurerReference: "" }]);
  const [breakdown, setBreakdown] = useState(null);
  const [saving, setSaving] = useState(false);
  const product = options.products.find((p) => p.id === productId);
  const journey = product?.journey;
  const blocked = journey && (journey.quotationSlip === "required" || journey.placementSlip === "skip");
  // a motor-line product placed without a quotation (CTPL) needs its LTO document (placement.direct_document_products)
  const needsLto = product?.lob === "MOTOR";

  // server-side premium preview (taxes by line of business, commission) for the participant split
  useEffect(() => {
    if (!product || !(netPremium > 0)) { setBreakdown(null); return undefined; }
    const h = setTimeout(async () => {
      const r = await quotationService.calculatePremium({ productType: product.name, lob: product.lob, agreedNetPremium: netPremium, totalSumInsured: sumInsured || 0, includeCTPL: false,
        ...(commissionRate != null ? { commissionRate: commissionRate / 100 } : {}) }).catch(() => null);
      setBreakdown(r || null);
    }, 300);
    return () => clearTimeout(h);
  }, [product, netPremium, sumInsured, commissionRate]);

  const save = async () => {
    const who = customerFields(customer);
    const warn = (detail) => toast.current?.show({ severity: "warn", summary: t("placement.validation.title"), detail, life: 4000 });
    if (!who.leadRefId && !who.clientId && !who.companyName && !who.firstName) return warn(t("placement.validation.customer"));
    if (!product) return warn(t("placement.validation.product"));
    if (!(netPremium > 0)) return warn(t("placement.validation.premium"));
    if (!inception) return warn(t("placement.validation.inception"));
    const problem = participantProblem(participants, t);
    if (problem) return warn(problem);
    if (needsLto && !ltoFile) return warn(t("placement.validation.ltoDocument"));
    setSaving(true);
    try {
      let lto = {};
      if (needsLto) {
        const up = await s3Service.uploadFile(ltoFile, "placement-documents");
        if (!up?.key) throw new Error(up?.error || t("placement.epolicy.errors.upload"));
        lto = { ltoDocumentKey: up.key, ltoDocumentName: ltoFile.name };
      }
      const body = {
        ...who, productId: product.id, productType: product.name, insuredName: insuredName || customerName(customer) || undefined, riskDetails, doc: lto, sumInsured: sumInsured || 0, netPremium,
        commissionRate: commissionRate == null ? undefined : commissionRate / 100, inceptionDate: isoDate(inception), expiryDate: isoDate(expiry), billingMode: billingMode === "default" ? undefined : billingMode, remarks: remarks || undefined,
        participants: participants.map((p) => ({ insuranceCompanyId: p.insuranceCompanyId, sharePercent: p.sharePercent, isLead: p.isLead, insurerReference: p.insurerReference || undefined })),
      };
      const p = await placementService.createPlacement(body);
      navigate(`/placement/placement-slips/${p.id}`);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const totals = { sumInsured: sumInsured || 0, netPremium: netPremium || 0, grossPremium: breakdown?.grossPremium ?? netPremium ?? 0, commissionAmount: breakdown?.commissionAmount ?? 0 };
  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={t("placement.placementSlip.newTitle")}
        onBack={() => navigate("/placement/placement-slips")} />

      <div className="placement-card">
        <h3 className="section-title">{t("placement.sections.customerRisk")}</h3>
        <div className="grid">
          <div className="col-12 lg:col-6">
            <label>{t("placement.fields.customer")} *</label>
            <CustomerPicker value={customer} onChange={setCustomer} allowNew />
          </div>
          <div className="col-12 lg:col-6">
            <ProductPicker value={{ productId }} onChange={(v) => setProductId(v.productId)} idPrefix="direct-placement" required />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <label>{t("placement.fields.insured")}</label>
            <InputText value={insuredName} onChange={(e) => setInsuredName(e.target.value)} placeholder={customerName(customer)} className="w-full" />
          </div>
        </div>
        {blocked && <Message severity="warn" className="w-full mt-2" text={t("placement.placementSlip.blocked", { lob: product.lob })} />}
        {needsLto && !blocked && (
          <div className="mt-3">
            <label htmlFor="lto-file">{t("placement.placementSlip.ltoDocument")} *</label>
            <input id="lto-file" type="file" accept="application/pdf,image/*" onChange={(e) => setLtoFile(e.target.files?.[0] || null)} />
            <small className="hint">{t("placement.placementSlip.ltoDocumentHint")}</small>
          </div>
        )}

        <h3 className="section-title">{t("placement.sections.riskDetails")}</h3>
        <RiskDetailsEditor value={riskDetails} onChange={setRiskDetails} />

        <h3 className="section-title">{t("placement.sections.terms")}</h3>
        <div className="grid">
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.inception")} *</label>
            <Calendar value={inception} onChange={(e) => setInception(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.expiry")}</label>
            <Calendar value={expiry} onChange={(e) => setExpiry(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" placeholder={t("placement.fields.expiryDefault")} />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.sumInsured")}</label>
            <InputNumber value={sumInsured} onValueChange={(e) => setSumInsured(e.value)} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.netPremium")} *</label>
            <InputNumber value={netPremium} onValueChange={(e) => setNetPremium(e.value)} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.commissionRate")}</label>
            <InputNumber value={commissionRate} onValueChange={(e) => setCommissionRate(e.value)} suffix="%" maxFractionDigits={4} className="w-full" inputClassName="w-full" placeholder={t("placement.fields.commissionDefault")} />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.billingMode")}</label>
            <Dropdown value={billingMode} options={[{ label: t("placement.billing.default"), value: "default" }, { label: t("placement.billing.broker"), value: "broker" }, { label: t("placement.billing.direct"), value: "direct" }]}
              onChange={(e) => setBillingMode(e.value)} className="w-full" />
          </div>
          <div className="col-12 md:col-6">
            <label>{t("placement.fields.remarks")}</label>
            <InputTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={1} autoResize className="w-full" />
          </div>
        </div>
        {breakdown && (
          <div className="premium-strip">
            <span>{t("placement.fields.netPremium")}: <strong>{formatCurrency(breakdown.netPremium)}</strong></span>
            <span>{t("placement.fields.taxes")}: <strong>{formatCurrency((breakdown.valueAddedTax || 0) + (breakdown.documentaryStampTax || 0) + (breakdown.localGovernmentTax || 0) + (breakdown.fireServiceTax || 0))}</strong></span>
            <span>{t("placement.fields.grossPremium")}: <strong>{formatCurrency(breakdown.grossPremium)}</strong></span>
            <span>{t("placement.fields.commission")}: <strong>{formatCurrency(breakdown.commissionAmount)}</strong></span>
          </div>
        )}

        <h3 className="section-title">{t("placement.sections.security")}</h3>
        <p className="muted">{t("placement.placementSlip.participantsNote")}</p>
        <ParticipantEditor value={participants} onChange={setParticipants} insurers={options.insurers} totals={totals} />

        <div className="form-actions">
          <Button label={t("placement.actions.cancel")} text onClick={() => navigate("/placement/placement-slips")} />
          <Button label={t("placement.actions.createPlacement")} icon="pi pi-check" onClick={save} loading={saving} disabled={blocked} />
        </div>
      </div>
    </div>
  );
};

export default DirectPlacementForm;
