import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Chips } from "primereact/chips";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { insurerOptions } from "../InsurerReconciliation/common";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { BirTag, PageHeader, date, showError, showSuccess } from "./common";

export const TYPES = ["overriding", "profit", "contingent"];
export const BASES = ["production", "loss_ratio", "growth"];
const PERIOD_TYPES = ["monthly", "quarterly", "semi_annual", "annual"];
const EMPTY = { agreementCode: "", name: "", insurerId: null, commissionType: "overriding", basis: "production", periodType: "quarterly", premiumMeasure: "net_premium", tierMethod: "slab",
  linesOfBusiness: [], minProduction: 0, vatApplicable: true, ewtRate: 10, effectiveFrom: new Date(new Date().getFullYear(), 0, 1), effectiveTo: null, status: "active", remarks: "",
  tiers: [{ fromValue: 0, toValue: null, rate: 0 }] };

/** Tier bounds read as PHP amounts (production basis) or percentages (loss ratio, growth). */
const unitOf = (basis) => (basis === "production" ? "PHP" : "%");

/**
 * Commission > Insurer Overrides > Agreements: overriding, profit and contingent commission agreements per insurer:
 * basis (production volume, loss ratio, growth), period, lines of business, premium measure, minimum production,
 * VAT and expected withholding, and the tiers (from / to value of the basis and the rate on the production).
 */
const OverrideAgreements = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await birTaxService.overrideAgreements()); } catch (e) { showError(toast, e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); insurerOptions().then(setInsurers).catch((e) => showError(toast, e)); }, [load]);

  const v = editing?.values;
  const set = (p) => setEditing((e) => ({ ...e, values: { ...e.values, ...p } }));
  const setTier = (i, p) => set({ tiers: v.tiers.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const save = async () => {
    const body = { ...v, effectiveFrom: toIsoDate(v.effectiveFrom), effectiveTo: v.effectiveTo ? toIsoDate(v.effectiveTo) : null, remarks: v.remarks || undefined,
      tiers: v.tiers.map((x) => ({ fromValue: Number(x.fromValue || 0), toValue: x.toValue === null || x.toValue === undefined ? null : Number(x.toValue), rate: Number(x.rate || 0) })) };
    delete body.id; delete body.insurerName; delete body.createdBy; delete body.createdAt; delete body.updatedAt;
    try {
      const r = editing.isNew ? await birTaxService.createOverrideAgreement(body) : await birTaxService.updateOverrideAgreement(editing.id, body);
      showSuccess(toast, `${r.agreementCode} ${t("birTax.saved")}`);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader section={t("birTax.commission")} title={t("birTax.overrideAgreements")} trail={[t("birTax.insurerOverrides"), t("birTax.overrideAgreements")]} subtitle={t("birTax.overrideAgreementsHelp")}>
        <Button icon="pi pi-plus" label={t("birTax.newAgreement")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY, tiers: [...EMPTY.tiers] } })} />
      </PageHeader>
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("birTax.noRows")}>
          <Column field="agreementCode" header={t("birTax.agreementCode")} sortable />
          <Column field="name" header={t("birTax.name")} />
          <Column field="insurerName" header={t("birTax.insurer")} sortable />
          <Column header={t("birTax.commissionType")} body={(r) => t(`birTax.overrideType.${r.commissionType}`)} />
          <Column header={t("birTax.basis")} body={(r) => t(`birTax.basisValue.${r.basis}`)} />
          <Column header={t("birTax.periodType")} body={(r) => t(`birTax.periodTypeValue.${r.periodType}`)} />
          <Column header={t("birTax.tiers")} body={(r) => r.tiers.map((x) => `${x.fromValue.toLocaleString()}${x.toValue === null ? "+" : ` to ${x.toValue.toLocaleString()}`}: ${x.rate}%`).join("; ")} />
          <Column header={t("birTax.effectiveFrom")} body={(r) => date(r.effectiveFrom)} />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column body={(r) => <Button icon="pi pi-pencil" text size="small" aria-label={t("birTax.edit")} onClick={() => setEditing({ isNew: false, id: r.id, values: { ...EMPTY, ...r, remarks: r.remarks || "",
            effectiveFrom: toDate(r.effectiveFrom), effectiveTo: toDate(r.effectiveTo), tiers: r.tiers.map((x) => ({ fromValue: x.fromValue, toValue: x.toValue, rate: x.rate })) } })} />} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" visible={!!editing} header={editing ? (editing.isNew ? t("birTax.newAgreement") : v.agreementCode) : ""} style={{ width: "min(980px, 96vw)" }} onHide={() => setEditing(null)}
        footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setEditing(null)} /><Button label={t("periodEnd.save")} icon="pi pi-save" onClick={save} disabled={!v?.agreementCode || !v?.name || !v?.insurerId || !v?.tiers?.length} /></div>}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-4"><label>{t("birTax.agreementCode")} *</label><InputText value={v.agreementCode} onChange={(e) => set({ agreementCode: e.target.value.toUpperCase() })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("birTax.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.insurer")} *</label><Dropdown value={v.insurerId} options={insurers} filter onChange={(e) => set({ insurerId: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.commissionType")}</label><Dropdown value={v.commissionType} options={TYPES.map((x) => ({ label: t(`birTax.overrideType.${x}`), value: x }))} onChange={(e) => set({ commissionType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.statusLabel")}</label><Dropdown value={v.status} options={["draft", "active", "inactive"].map((x) => ({ label: t(`birTax.status.${x}`), value: x }))} onChange={(e) => set({ status: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.basis")}</label><Dropdown value={v.basis} options={BASES.map((x) => ({ label: t(`birTax.basisValue.${x}`), value: x }))} onChange={(e) => set({ basis: e.value, tierMethod: e.value === "production" ? v.tierMethod : "slab" })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.periodType")}</label><Dropdown value={v.periodType} options={PERIOD_TYPES.map((x) => ({ label: t(`birTax.periodTypeValue.${x}`), value: x }))} onChange={(e) => set({ periodType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.premiumMeasure")}</label><Dropdown value={v.premiumMeasure} options={["net_premium", "gross_premium"].map((x) => ({ label: t(`birTax.measure.${x}`), value: x }))} onChange={(e) => set({ premiumMeasure: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.tierMethod")}</label><Dropdown value={v.tierMethod} disabled={v.basis !== "production"} options={["slab", "banded"].map((x) => ({ label: t(`birTax.tierMethodValue.${x}`), value: x }))} onChange={(e) => set({ tierMethod: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.linesOfBusiness")}</label><Chips value={v.linesOfBusiness} onChange={(e) => set({ linesOfBusiness: e.value })} placeholder="MOTOR, FIRE" className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.minProduction")}</label><InputNumber value={v.minProduction} onValueChange={(e) => set({ minProduction: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.expectedEwt")}</label><InputNumber value={v.ewtRate} onValueChange={(e) => set({ ewtRate: e.value })} suffix="%" maxFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.effectiveFrom")}</label><Calendar value={v.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("birTax.effectiveTo")}</label><Calendar value={v.effectiveTo} onChange={(e) => set({ effectiveTo: e.value })} dateFormat={calendarDateFormat()} showIcon showButtonBar className="w-full" /></div>
            <div className="col-12 md:col-6 flex align-items-center gap-2 mt-4"><Checkbox inputId="ov-vat" checked={!!v.vatApplicable} onChange={(e) => set({ vatApplicable: e.checked })} /><label htmlFor="ov-vat" className="m-0">{t("birTax.vatApplicable")}</label></div>
            <div className="col-12">
              <h4>{t("birTax.tiers")} ({unitOf(v.basis)})</h4>
              <DataTable value={v.tiers} size="small">
                <Column header={t("birTax.tierNo")} body={(_, o) => o.rowIndex + 1} style={{ width: "4rem" }} />
                <Column header={t("birTax.fromValue")} body={(x, o) => <InputNumber value={x.fromValue} onValueChange={(e) => setTier(o.rowIndex, { fromValue: e.value })} maxFractionDigits={4} />} />
                <Column header={t("birTax.toValue")} body={(x, o) => <InputNumber value={x.toValue} placeholder={t("birTax.openEnded")} onValueChange={(e) => setTier(o.rowIndex, { toValue: e.value })} maxFractionDigits={4} />} />
                <Column header={t("birTax.ratePct")} body={(x, o) => <InputNumber value={x.rate} onValueChange={(e) => setTier(o.rowIndex, { rate: e.value })} suffix="%" maxFractionDigits={4} />} />
                <Column body={(_, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("birTax.removeLine")} disabled={v.tiers.length === 1} onClick={() => set({ tiers: v.tiers.filter((__, j) => j !== o.rowIndex) })} />} />
              </DataTable>
              <Button icon="pi pi-plus" text label={t("birTax.addTier")} onClick={() => set({ tiers: [...v.tiers, { fromValue: v.tiers[v.tiers.length - 1]?.toValue || 0, toValue: null, rate: 0 }] })} />
            </div>
            <div className="col-12"><label>{t("periodEnd.remarks")}</label><InputTextarea value={v.remarks} rows={2} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default OverrideAgreements;
