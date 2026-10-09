import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Toast } from "primereact/toast";
import placementService from "../../services/placementService";
import { calendarDateFormat } from "../../utility/dateFormat";
import { CustomerPicker, PageHeader, RiskDetailsEditor, customerFields, customerName, round2, usePlacementOptions } from "./shared";
import { isoDate } from "./dates";
import useMasterOptions from "../GeneralMasters/common/useMasterOptions";
import useQuoteSetup from "../../agentModule/quoteModule/utils/useQuoteSetup";
import RiskFactsFields from "../../agentModule/quoteModule/policyDetails/policyDetailsCard/RiskFactsFields";
import ProductPicker from "../Sales/ProductPicker";
import "./index.scss";

const blankCover = () => ({ cover: "", sumInsured: null, deductible: "" });

/** End of a one-year term: the day before the anniversary of the inception (30 Sep 2026 -> 29 Sep 2027). */
const termEnd = (start) => {
  if (!start) return null;
  const d = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  d.setDate(d.getDate() - 1);
  return d;
};

/** The customer of a prefilled request (Fire / IAR quote cards, Quick Quote, the product choosers): a lead, a client or a new prospect. */
const prefilledCustomer = (prefill) => {
  if (prefill?.leadRefId) return { kind: "lead", selected: { id: prefill.leadRefId, label: `${prefill.leadName || prefill.leadRefId} (${prefill.leadRefId})`, name: prefill.leadName || "" } };
  if (prefill?.clientId) {
    return { kind: "client", selected: { id: prefill.clientId, label: `${prefill.clientName || prefill.clientId} (${prefill.clientCode || prefill.clientId})`, name: prefill.clientName || "" } };
  }
  return { kind: prefill?.newProspect ? "new" : "lead" };
};

/**
 * New Request for Quotation (broker slip): the risk presented to the market, several insurers asked for terms. Mostly
 * for non-package products; the customer is an existing prospect or client, or a new prospect entered here.
 * location.state.prefill: { leadRefId, leadName | clientId, clientName, clientCode | newProspect, productId, productType, riskDetails,
 * requestedCovers }.
 */
const BrokerSlipCreate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefill = useLocation().state?.prefill || null;
  const toast = useRef(null);
  const options = usePlacementOptions();
  const [customer, setCustomer] = useState(() => prefilledCustomer(prefill));
  const [productId, setProductId] = useState(prefill?.productId || null);
  const [showPackage, setShowPackage] = useState(false);
  const [insuredName, setInsuredName] = useState(prefill?.leadName || prefill?.clientName || "");
  const [riskDetails, setRiskDetails] = useState(prefill?.riskDetails || {});
  const [vehicle, setVehicle] = useState({ vehicleBrand: "", vehicleModel: "", modelYear: "", plateNumber: "", fmv: null });
  const [covers, setCovers] = useState(() => (prefill?.requestedCovers?.length ? prefill.requestedCovers.map((c) => ({ ...blankCover(), ...c })) : [blankCover()]));
  const [insurers, setInsurers] = useState([]);
  const [inception, setInception] = useState(() => new Date());
  const [expiry, setExpiry] = useState(() => termEnd(new Date()));
  // the expiry follows the inception (one-year term) until the user sets it
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [responseDue, setResponseDue] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // a prefilled product type is matched to the product master once the options are loaded
  useEffect(() => {
    if (productId || !prefill?.productType || !options.products.length) return;
    const wanted = String(prefill.productType).toLowerCase();
    const match = options.products.find((p) => p.name.toLowerCase() === wanted || String(p.code).toLowerCase() === wanted);
    if (match) setProductId(match.id);
  }, [options.products, prefill, productId]);

  const product = options.products.find((p) => p.id === productId);
  // covers of the product's line from the Cover master (covers without a line are offered for every line)
  const coverOptions = useMasterOptions("cover", { filter: product?.line ? { linesOfBusiness: product.line } : {}, enabled: Boolean(product) });
  const coverChoices = (current) => {
    const list = coverOptions.map((o) => ({ label: o.label, value: o.label }));
    return current && !list.some((o) => o.value === current) ? [...list, { label: current, value: current }] : list;
  };
  // non-package products are placed through requests for quotation; package ones are offered on request
  const offered = (p) => showPackage || p.businessType !== "package" || p.id === productId;
  const motor = product?.lob === "MOTOR";
  // the risk details the acceptance rules and rating factors of the product's template test (number of members...)
  const ruleSetup = useQuoteSetup(product ? { productId: product.id, lob: product.lob } : { lob: "NONE" });
  const sumInsured = useMemo(() => round2(covers.reduce((s, c) => s + (Number(c.sumInsured) || 0), 0)), [covers]);
  const setCover = (i, patch) => setCovers(covers.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const save = async (submit) => {
    // a new prospect is saved as a lead together with the request
    const who = customer.kind === "new" ? { prospect: customerFields(customer) } : customerFields(customer);
    const namedProspect = who.prospect && (who.prospect.companyName || who.prospect.firstName);
    if (!who.leadRefId && !who.clientId && !namedProspect) return toast.current?.show({ severity: "warn", summary: t("placement.validation.title"), detail: t("placement.validation.customer"), life: 3500 });
    if (!product) return toast.current?.show({ severity: "warn", summary: t("placement.validation.title"), detail: t("placement.validation.product"), life: 3500 });
    if (!insurers.length) return toast.current?.show({ severity: "warn", summary: t("placement.validation.title"), detail: t("placement.validation.insurers"), life: 3500 });
    setSaving(true);
    try {
      const doc = motor ? { insuranceVehicleDetails: [{ vehicleBrand: vehicle.vehicleBrand, vehicleModel: vehicle.vehicleModel, modelYear: vehicle.modelYear }], plateNumber: vehicle.plateNumber,
        lossAndDamageCoverage: vehicle.fmv || undefined } : {};
      const slip = await placementService.createSlip({
        ...who, productId: product.id, productType: product.name, insuredName: insuredName || customerName(customer) || undefined, riskDetails, doc,
        requestedCovers: covers.filter((c) => c.cover).map((c) => ({ cover: c.cover, sumInsured: c.sumInsured, deductible: c.deductible || undefined })),
        sumInsured: sumInsured || (motor ? vehicle.fmv : undefined), inceptionDate: isoDate(inception), expiryDate: isoDate(expiry), responseDueDate: isoDate(responseDue),
        insurers, remarks: remarks || undefined,
      });
      if (submit) await placementService.submitSlip(slip.id);
      navigate(`/placement/broker-slips/${slip.id}`);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={t("placement.brokerSlip.newTitle")} onBack={() => navigate("/placement/broker-slips")} />

      <div className="placement-card">
        <h3 className="section-title">{t("placement.sections.customerRisk")}</h3>
        <div className="grid">
          <div className="col-12 md:col-6">
            <label>{t("placement.fields.customer")} *</label>
            <CustomerPicker value={customer} onChange={setCustomer} allowNew newLabel={t("salesMarketing.newProspect")} />
          </div>
          <div className="col-12 md:col-6">
            <ProductPicker value={{ productId }} onChange={(v) => setProductId(v.productId)} keep={offered} idPrefix="rfq" required
              emptyText={showPackage ? undefined : t("productPicker.noneNonPackage")} />
            <div className="flex align-items-center gap-2 mt-1">
              <Checkbox inputId="rfq-package" checked={showPackage} onChange={(e) => setShowPackage(e.checked)} />
              <label htmlFor="rfq-package" className="m-0">{t("salesMarketing.includePackage")}</label>
            </div>
            {product && <small className="hint">{t("placement.journey.hint", { brokerSlip: t(`placement.journey.mode.${product.journey.brokerSlip}`), placementSlip: t(`placement.journey.mode.${product.journey.placementSlip}`) })}</small>}
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.insured")}</label>
            <InputText value={insuredName} onChange={(e) => setInsuredName(e.target.value)} placeholder={customerName(customer)} className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.inception")}</label>
            <Calendar value={inception} onChange={(e) => { setInception(e.value); if (!expiryTouched) setExpiry(termEnd(e.value)); }} dateFormat={calendarDateFormat()} showIcon className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.expiry")}</label>
            <Calendar value={expiry} onChange={(e) => { setExpiry(e.value); setExpiryTouched(true); }} minDate={inception || undefined} dateFormat={calendarDateFormat()} showIcon className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.responseDue")}</label>
            <Calendar value={responseDue} onChange={(e) => setResponseDue(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" placeholder={t("placement.brokerSlip.dueDefault")} />
          </div>
        </div>

        {motor ? (
          <>
            <h3 className="section-title">{t("placement.sections.vehicle")}</h3>
            <div className="grid">
              {["vehicleBrand", "vehicleModel", "modelYear", "plateNumber"].map((k) => (
                <div className="col-12 md:col-2" key={k}>
                  <label>{t(`placement.vehicle.${k}`)}</label>
                  <InputText value={vehicle[k]} onChange={(e) => setVehicle({ ...vehicle, [k]: e.target.value })} className="w-full" />
                </div>
              ))}
              <div className="col-12 md:col-4">
                <label>{t("placement.vehicle.fmv")}</label>
                <InputNumber value={vehicle.fmv} onValueChange={(e) => setVehicle({ ...vehicle, fmv: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full" />
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="section-title">{t("placement.sections.riskDetails")}</h3>
            <RiskFactsFields setup={ruleSetup} value={riskDetails} onChange={setRiskDetails} />
            <RiskDetailsEditor value={riskDetails} onChange={setRiskDetails} />
          </>
        )}

        <h3 className="section-title">{t("placement.sections.covers")}</h3>
        <table className="participant-table">
          <thead><tr><th>{t("placement.fields.cover")}</th><th className="num">{t("placement.fields.sumInsured")}</th><th>{t("placement.fields.deductible")}</th><th /></tr></thead>
          <tbody>
            {covers.map((c, i) => (
              <tr key={i}>
                <td><Dropdown value={c.cover} options={coverChoices(c.cover)} onChange={(e) => setCover(i, { cover: e.value })} filter className="w-full" disabled={!product} placeholder={product ? t("placement.fields.chooseCover") : t("placement.fields.chooseProductFirst")} emptyMessage={t("placement.fields.noCovers")} /></td>
                <td style={{ width: "14rem" }}><InputNumber value={c.sumInsured} onValueChange={(e) => setCover(i, { sumInsured: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full text-right" /></td>
                <td><InputText value={c.deductible} onChange={(e) => setCover(i, { deductible: e.target.value })} className="w-full" /></td>
                <td className="center"><Button icon="pi pi-trash" text rounded severity="danger" onClick={() => setCovers(covers.length > 1 ? covers.filter((_, k) => k !== i) : [blankCover()])} aria-label={t("placement.actions.remove")} tooltip={t("placement.actions.remove")} tooltipOptions={{ position: "top" }} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td><Button label={t("placement.actions.addCover")} icon="pi pi-plus" text onClick={() => setCovers([...covers, blankCover()])} /></td><td className="num"><strong>{sumInsured.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></td><td colSpan={2} /></tr></tfoot>
        </table>

        <h3 className="section-title">{t("placement.sections.market")}</h3>
        <div className="grid">
          <div className="col-12 md:col-8">
            <label>{t("placement.fields.insurersApproached")} *</label>
            <MultiSelect value={insurers} options={options.insurers.map((i) => ({ label: i.name, value: i.id }))} onChange={(e) => setInsurers(e.value)} filter display="chip" className="w-full" placeholder={t("placement.fields.chooseInsurers")} />
          </div>
          <div className="col-12">
            <label>{t("placement.fields.remarks")}</label>
            <InputTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} autoResize className="w-full" />
          </div>
        </div>

        <div className="form-actions">
          <Button label={t("placement.actions.cancel")} text onClick={() => navigate("/placement/broker-slips")} />
          <Button label={t("placement.actions.saveDraft")} icon="pi pi-save" severity="secondary" outlined onClick={() => save(false)} loading={saving} />
          <Button label={t("placement.actions.saveAndSubmit")} icon="pi pi-send" onClick={() => save(true)} loading={saving} />
        </div>
      </div>
    </div>
  );
};

export default BrokerSlipCreate;
