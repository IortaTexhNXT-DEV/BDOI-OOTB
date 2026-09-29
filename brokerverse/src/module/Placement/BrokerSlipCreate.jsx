import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import placementService from "../../services/placementService";
import { calendarDateFormat } from "../../utility/dateFormat";
import { CustomerPicker, PageHeader, RiskDetailsEditor, customerFields, customerName, round2, usePlacementOptions } from "./shared";
import { isoDate } from "./dates";
import "./index.scss";

const blankCover = () => ({ cover: "", sumInsured: null, deductible: "" });

/** New Broker Slip: the risk presented to the market (request for quotation to several insurers). */
const BrokerSlipCreate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const options = usePlacementOptions();
  const [customer, setCustomer] = useState({ kind: "lead" });
  const [productId, setProductId] = useState(null);
  const [insuredName, setInsuredName] = useState("");
  const [riskDetails, setRiskDetails] = useState({});
  const [vehicle, setVehicle] = useState({ vehicleBrand: "", vehicleModel: "", modelYear: "", plateNumber: "", fmv: null });
  const [covers, setCovers] = useState([blankCover()]);
  const [insurers, setInsurers] = useState([]);
  const [inception, setInception] = useState(null);
  const [expiry, setExpiry] = useState(null);
  const [responseDue, setResponseDue] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const product = options.products.find((p) => p.id === productId);
  const motor = product?.lob === "MOTOR";
  const sumInsured = useMemo(() => round2(covers.reduce((s, c) => s + (Number(c.sumInsured) || 0), 0)), [covers]);
  const setCover = (i, patch) => setCovers(covers.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const save = async (submit) => {
    const who = customerFields(customer);
    if (!who.leadRefId && !who.clientId) return toast.current?.show({ severity: "warn", summary: t("placement.validation.title"), detail: t("placement.validation.customer"), life: 3500 });
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
      <PageHeader title={t("placement.brokerSlip.newTitle")} subtitle={t("placement.brokerSlip.newSubtitle")} onBack={() => navigate("/placement/broker-slips")} />

      <div className="placement-card">
        <h3 className="section-title">{t("placement.sections.customerRisk")}</h3>
        <div className="grid">
          <div className="col-12 md:col-6">
            <label>{t("placement.fields.customer")} *</label>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.product")} *</label>
            <Dropdown value={productId} options={options.products.map((p) => ({ label: `${p.name} (${p.lob})`, value: p.id }))} onChange={(e) => setProductId(e.value)} filter className="w-full" placeholder={t("placement.fields.chooseProduct")} />
            {product && <small className="hint">{t("placement.journey.hint", { brokerSlip: t(`placement.journey.mode.${product.journey.brokerSlip}`), placementSlip: t(`placement.journey.mode.${product.journey.placementSlip}`) })}</small>}
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.insured")}</label>
            <InputText value={insuredName} onChange={(e) => setInsuredName(e.target.value)} placeholder={customerName(customer)} className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.inception")}</label>
            <Calendar value={inception} onChange={(e) => setInception(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label>{t("placement.fields.expiry")}</label>
            <Calendar value={expiry} onChange={(e) => setExpiry(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
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
            <RiskDetailsEditor value={riskDetails} onChange={setRiskDetails} />
          </>
        )}

        <h3 className="section-title">{t("placement.sections.covers")}</h3>
        <table className="participant-table">
          <thead><tr><th>{t("placement.fields.cover")}</th><th className="num">{t("placement.fields.sumInsured")}</th><th>{t("placement.fields.deductible")}</th><th /></tr></thead>
          <tbody>
            {covers.map((c, i) => (
              <tr key={i}>
                <td><InputText value={c.cover} onChange={(e) => setCover(i, { cover: e.target.value })} className="w-full" placeholder={t("placement.fields.coverPlaceholder")} /></td>
                <td style={{ width: "14rem" }}><InputNumber value={c.sumInsured} onValueChange={(e) => setCover(i, { sumInsured: e.value })} mode="decimal" minFractionDigits={2} className="w-full" inputClassName="w-full text-right" /></td>
                <td><InputText value={c.deductible} onChange={(e) => setCover(i, { deductible: e.target.value })} className="w-full" /></td>
                <td className="center"><Button icon="pi pi-trash" text rounded severity="danger" onClick={() => setCovers(covers.length > 1 ? covers.filter((_, k) => k !== i) : [blankCover()])} aria-label={t("placement.actions.remove")} /></td>
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
