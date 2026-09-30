import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Chips } from "primereact/chips";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import packagesService from "../../services/packagesService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { formatDate } from "../../utility/dateFormat";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { PageHeader } from "../Placement/shared";
import { RATE_BASES, todayIso, usePackageOptions } from "./common";
import "../Placement/index.scss";
import "../Administration/index.scss";
import "./index.scss";

const EMPTY = { insuranceCompanyId: null, productId: null, rateBasis: "percent", rate: null, minimumPremium: 0, deductible: "", deductibleAmount: null, keyBenefits: [],
  commissionPercent: null, effectiveFrom: todayIso(), effectiveTo: "", active: true, remarks: "" };

/**
 * Master > Packaged Products > Insurer Rate Tables: per insurer and product the rate (percent or per mille of the sum
 * insured, or a flat premium), minimum premium, deductible, key benefits, commission and effective dates. The quick
 * quote comparison prices every insurer from these rows; package sections use them for their carrier.
 */
const InsurerRateTables = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.rates.${key}`, opts);
  const { formatCurrency } = useFormatCurrency();
  const options = usePackageOptions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ productId: null, insuranceCompanyId: null });
  const [edit, setEdit] = useState(null);

  const load = () => {
    setLoading(true);
    packagesService.listRateTables(filter).then(setRows).catch((e) => notifyError(e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [filter.productId, filter.insuranceCompanyId]);

  const insurers = useMemo(() => options.insurers.map((i) => ({ label: i.name, value: i.id })), [options.insurers]);
  const products = useMemo(() => options.products.map((p) => ({ label: p.name, value: p.id })), [options.products]);
  const basisLabel = (b) => t(`packagedProducts.basis.${b}`, { defaultValue: b });
  const rateText = (r) => (r.rateBasis === "flat" ? formatCurrency(r.rate) : `${r.rate}${r.rateBasis === "per_mille" ? " per mille" : "%"}`);

  const save = async () => {
    const body = {
      insuranceCompanyId: edit.insuranceCompanyId, productId: edit.productId, rateBasis: edit.rateBasis, rate: edit.rate ?? 0, minimumPremium: edit.minimumPremium || 0,
      deductible: edit.deductible || null, deductibleAmount: edit.deductibleAmount ?? null, keyBenefits: edit.keyBenefits || [],
      commissionRate: edit.commissionPercent === null || edit.commissionPercent === undefined ? null : Math.round(edit.commissionPercent * 100) / 10000,
      effectiveFrom: edit.effectiveFrom, effectiveTo: edit.effectiveTo || null, active: Boolean(edit.active), remarks: edit.remarks || null,
    };
    try {
      if (edit.id) await packagesService.updateRateTable(edit.id, body);
      else await packagesService.createRateTable(body);
      notifySuccess(k("saved"));
      setEdit(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const remove = async (r) => {
    if (!(await confirmAction(k("deleteConfirm", { insurer: r.insurerName, product: r.productName }), { danger: true }))) return;
    packagesService.deleteRateTable(r.id).then(load).catch((e) => notifyError(e.message));
  };
  const set = (patch) => setEdit((e) => ({ ...e, ...patch }));

  return (
    <div className="placement-page pkg-page">
      <PageHeader title={k("title")} subtitle={k("subtitle")}>
        <Button label={k("add")} icon="pi pi-plus" onClick={() => setEdit({ ...EMPTY, productId: filter.productId })} />
      </PageHeader>
      <div className="pkg-toolbar">
        <Dropdown value={filter.productId} options={products} onChange={(e) => setFilter({ ...filter, productId: e.value })} placeholder={k("anyProduct")} showClear filter aria-label={k("product")} />
        <Dropdown value={filter.insuranceCompanyId} options={insurers} onChange={(e) => setFilter({ ...filter, insuranceCompanyId: e.value })} placeholder={k("anyInsurer")} showClear filter aria-label={k("insurer")} />
      </div>
      <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={15} emptyMessage={k("empty")} responsiveLayout="scroll">
        <Column field="productName" header={k("product")} sortable />
        <Column field="insurerName" header={k("insurer")} sortable />
        <Column header={k("basis")} body={(r) => basisLabel(r.rateBasis)} />
        <Column header={k("rate")} body={rateText} className="num" headerClassName="num" />
        <Column header={k("minimumPremium")} body={(r) => formatCurrency(r.minimumPremium)} className="num" headerClassName="num" />
        <Column header={k("deductible")} body={(r) => r.deductible || "-"} />
        <Column header={k("benefits")} body={(r) => (r.keyBenefits || []).length} className="num" headerClassName="num" />
        <Column header={k("commission")} body={(r) => (r.commissionRate === null ? k("matrix") : `${Math.round(r.commissionRate * 10000) / 100}%`)} />
        <Column header={k("effective")} body={(r) => `${formatDate(r.effectiveFrom)} - ${r.effectiveTo ? formatDate(r.effectiveTo) : k("open")}`} />
        <Column header={t("packagedProducts.active")} body={(r) => <Tag value={r.active ? t("packagedProducts.active") : t("packagedProducts.inactive")} severity={r.active ? "success" : "danger"} />} />
        <Column body={(r) => (
          <div className="admin__actions">
            <Button icon="pi pi-pencil" rounded text aria-label={t("common.edit")} onClick={() => setEdit({ ...r, effectiveTo: r.effectiveTo || "", remarks: r.remarks || "", deductible: r.deductible || "",
              commissionPercent: r.commissionRate === null ? null : Math.round(r.commissionRate * 10000) / 100 })} />
            <Button icon="pi pi-trash" rounded text severity="danger" aria-label={t("common.delete")} onClick={() => remove(r)} />
          </div>
        )} style={{ width: "7rem" }} />
      </DataTable>

      <Dialog header={edit?.id ? k("edit") : k("add")} visible={Boolean(edit)} onHide={() => setEdit(null)} style={{ width: "46rem" }} breakpoints={{ "760px": "95vw" }}
        footer={<><Button label={t("common.cancel")} text onClick={() => setEdit(null)} /><Button label={t("common.save")} icon="pi pi-check" onClick={save} /></>}>
        {edit && (
          <div className="admin__grid">
            <div className="admin__field"><label htmlFor="rt-product">{k("product")}</label><Dropdown inputId="rt-product" value={edit.productId} options={products} filter onChange={(e) => set({ productId: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-insurer">{k("insurer")}</label><Dropdown inputId="rt-insurer" value={edit.insuranceCompanyId} options={insurers} filter onChange={(e) => set({ insuranceCompanyId: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-basis">{k("basis")}</label><Dropdown inputId="rt-basis" value={edit.rateBasis} options={RATE_BASES.map((b) => ({ label: basisLabel(b), value: b }))} onChange={(e) => set({ rateBasis: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-rate">{edit.rateBasis === "flat" ? k("flatPremium") : k("rate")}</label><InputNumber inputId="rt-rate" value={edit.rate} maxFractionDigits={6} min={0} onValueChange={(e) => set({ rate: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-min">{k("minimumPremium")}</label><InputNumber inputId="rt-min" value={edit.minimumPremium} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => set({ minimumPremium: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-comm">{k("commissionPercent")}</label><InputNumber inputId="rt-comm" value={edit.commissionPercent} suffix="%" maxFractionDigits={2} min={0} max={100} placeholder={k("matrix")} onValueChange={(e) => set({ commissionPercent: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-ded">{k("deductible")}</label><InputText id="rt-ded" value={edit.deductible} onChange={(e) => set({ deductible: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-ded-amt">{k("deductibleAmount")}</label><InputNumber inputId="rt-ded-amt" value={edit.deductibleAmount} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => set({ deductibleAmount: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-from">{k("effectiveFrom")}</label><InputText id="rt-from" type="date" value={edit.effectiveFrom || ""} onChange={(e) => set({ effectiveFrom: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-to">{k("effectiveTo")}</label><InputText id="rt-to" type="date" value={edit.effectiveTo || ""} onChange={(e) => set({ effectiveTo: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rt-active">{t("packagedProducts.active")}</label><InputSwitch inputId="rt-active" checked={Boolean(edit.active)} onChange={(e) => set({ active: e.value })} /></div>
            <div className="admin__field pkg-wide"><label htmlFor="rt-benefits">{k("benefits")}</label><Chips inputId="rt-benefits" value={edit.keyBenefits} onChange={(e) => set({ keyBenefits: e.value })} separator="," placeholder={k("benefitsHelp")} /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default InsurerRateTables;
