import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Chips } from "primereact/chips";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import packagesService from "../../services/packagesService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { PageHeader } from "../Placement/shared";
import { usePackageOptions } from "./common";
import "../Placement/index.scss";
import "../Administration/index.scss";
import "./index.scss";

const SEGMENTS = ["retail", "sme", "corporate", "both"];
const EMPTY_SECTION = { name: "", productId: null, defaultSumInsured: 0, ratePercent: 0, minimumPremium: 0, property: null, optional: false, insurerIds: [], benefits: [] };
const EMPTY = { code: "", name: "", description: "", customerSegment: "retail", discountPercent: 0, termMonths: 12, autoIssue: true, status: "active", sections: [{ ...EMPTY_SECTION }] };

/**
 * Master > Packaged Products > Bundle Products: packages sold as one (e.g. SME Shield = Fire + CGL + Burglary) with their
 * sections: product, default sum insured, rate and minimum premium (used when the insurer has no rate table), property
 * section (fire service tax), optional, and the insurers that may carry it (the first is the default carrier).
 */
const BundleProducts = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.bundles.${key}`, opts);
  const { formatCurrency } = useFormatCurrency();
  const options = usePackageOptions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);

  const load = () => {
    setLoading(true);
    packagesService.listBundles().then(setRows).catch((e) => notifyError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const insurers = useMemo(() => options.insurers.map((i) => ({ label: i.name, value: i.id })), [options.insurers]);
  const products = useMemo(() => options.products.map((p) => ({ label: p.name, value: p.id })), [options.products]);
  const propertyOptions = [{ label: k("propertyAuto"), value: null }, { label: t("common.yes", "Yes"), value: true }, { label: t("common.no", "No"), value: false }];

  const setSection = (i, patch) => setEdit((e) => ({ ...e, sections: e.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const save = async () => {
    const body = {
      code: edit.code, name: edit.name, description: edit.description || null, customerSegment: edit.customerSegment, discountPercent: edit.discountPercent || 0,
      termMonths: edit.termMonths || 12, autoIssue: Boolean(edit.autoIssue), status: edit.status,
      sections: edit.sections.map((s, i) => ({ sectionNo: i + 1, name: s.name, productId: s.productId, defaultSumInsured: s.defaultSumInsured || 0, ratePercent: s.ratePercent || 0,
        minimumPremium: s.minimumPremium || 0, property: s.property, optional: Boolean(s.optional), insurerIds: s.insurerIds || [], benefits: s.benefits || [] })),
    };
    try {
      if (edit.id) {
        delete body.code;
        await packagesService.updateBundle(edit.id, body);
      } else await packagesService.createBundle(body);
      notifySuccess(k("saved"));
      setEdit(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const remove = async (b) => {
    if (!(await confirmAction(k("deleteConfirm", { name: b.name }), { danger: true }))) return;
    packagesService.deleteBundle(b.id).then((r) => { notifySuccess(r.deactivated ? k("deactivated") : k("deleted")); load(); }).catch((e) => notifyError(e.message));
  };

  return (
    <div className="placement-page pkg-page">
      <PageHeader title={k("title")} subtitle={k("subtitle")}>
        <Button label={k("add")} icon="pi pi-plus" onClick={() => setEdit(JSON.parse(JSON.stringify(EMPTY)))} />
      </PageHeader>
      <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={k("empty")} responsiveLayout="scroll">
        <Column field="code" header={k("code")} />
        <Column field="name" header={k("name")} />
        <Column header={k("segment")} body={(b) => t(`packagedProducts.segments.${b.customerSegment}`, { defaultValue: b.customerSegment })} />
        <Column header={k("sections")} body={(b) => b.sections.map((s) => `${s.name}${s.optional ? ` (${k("optional").toLowerCase()})` : ""}`).join(" + ")} />
        <Column header={k("discount")} body={(b) => `${b.discountPercent}%`} className="num" headerClassName="num" />
        <Column header={k("defaultSumInsured")} body={(b) => formatCurrency(b.sections.filter((s) => !s.optional).reduce((a, s) => a + s.defaultSumInsured, 0))} className="num" headerClassName="num" />
        <Column header={k("status")} body={(b) => <Tag value={t(`packagedProducts.${b.status}`)} severity={b.status === "active" ? "success" : "danger"} />} />
        <Column body={(b) => (
          <div className="admin__actions">
            <Button icon="pi pi-pencil" rounded text aria-label={t("common.edit")} onClick={() => setEdit(JSON.parse(JSON.stringify({ ...b, description: b.description || "" })))} />
            <Button icon="pi pi-trash" rounded text severity="danger" aria-label={t("common.delete")} onClick={() => remove(b)} />
          </div>
        )} style={{ width: "7rem" }} />
      </DataTable>

      <Dialog header={edit?.id ? k("edit") : k("add")} visible={Boolean(edit)} onHide={() => setEdit(null)} style={{ width: "min(72rem, 96vw)" }} maximizable
        footer={<><Button label={t("common.cancel")} text onClick={() => setEdit(null)} /><Button label={t("common.save")} icon="pi pi-check" onClick={save} /></>}>
        {edit && (
          <>
            <div className="admin__grid">
              <div className="admin__field"><label htmlFor="b-code">{k("code")}</label><InputText id="b-code" value={edit.code} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></div>
              <div className="admin__field"><label htmlFor="b-name">{k("name")}</label><InputText id="b-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="admin__field"><label htmlFor="b-seg">{k("segment")}</label><Dropdown inputId="b-seg" value={edit.customerSegment} options={SEGMENTS.map((s) => ({ label: t(`packagedProducts.segments.${s}`, { defaultValue: s }), value: s }))} onChange={(e) => setEdit({ ...edit, customerSegment: e.value })} /></div>
              <div className="admin__field"><label htmlFor="b-disc">{k("discount")}</label><InputNumber inputId="b-disc" value={edit.discountPercent} suffix="%" maxFractionDigits={4} min={0} max={99.99} onValueChange={(e) => setEdit({ ...edit, discountPercent: e.value })} /></div>
              <div className="admin__field"><label htmlFor="b-term">{k("termMonths")}</label><InputNumber inputId="b-term" value={edit.termMonths} min={1} max={60} onValueChange={(e) => setEdit({ ...edit, termMonths: e.value })} /></div>
              <div className="admin__field"><label htmlFor="b-auto">{k("autoIssue")}</label><InputSwitch inputId="b-auto" checked={Boolean(edit.autoIssue)} onChange={(e) => setEdit({ ...edit, autoIssue: e.value })} /></div>
              <div className="admin__field"><label htmlFor="b-status">{k("status")}</label><Dropdown inputId="b-status" value={edit.status} options={["active", "inactive"].map((s) => ({ label: t(`packagedProducts.${s}`), value: s }))} onChange={(e) => setEdit({ ...edit, status: e.value })} /></div>
              <div className="admin__field pkg-wide"><label htmlFor="b-desc">{k("description")}</label><InputTextarea id="b-desc" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            </div>
            <h3 className="pkg-subtitle">{k("sections")}</h3>
            <div className="table-scroll">
              <table className="pkg-table">
                <thead>
                  <tr>
                    <th>#</th><th>{k("sectionName")}</th><th>{k("product")}</th><th className="num">{k("defaultSumInsured")}</th><th className="num">{k("rate")}</th>
                    <th className="num">{k("minimumPremium")}</th><th>{k("property")}</th><th>{k("optional")}</th><th>{k("insurers")}</th><th>{k("benefits")}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {edit.sections.map((s, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><InputText value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} aria-label={k("sectionName")} /></td>
                      <td style={{ minWidth: "12rem" }}><Dropdown value={s.productId} options={products} filter onChange={(e) => setSection(i, { productId: e.value })} className="w-full" aria-label={k("product")} /></td>
                      <td><InputNumber value={s.defaultSumInsured} min={0} onValueChange={(e) => setSection(i, { defaultSumInsured: e.value })} inputClassName="num" aria-label={k("defaultSumInsured")} /></td>
                      <td><InputNumber value={s.ratePercent} suffix="%" maxFractionDigits={6} min={0} onValueChange={(e) => setSection(i, { ratePercent: e.value })} inputClassName="num" aria-label={k("rate")} /></td>
                      <td><InputNumber value={s.minimumPremium} min={0} maxFractionDigits={2} onValueChange={(e) => setSection(i, { minimumPremium: e.value })} inputClassName="num" aria-label={k("minimumPremium")} /></td>
                      <td><Dropdown value={s.property} options={propertyOptions} onChange={(e) => setSection(i, { property: e.value })} aria-label={k("property")} /></td>
                      <td className="center"><Checkbox checked={Boolean(s.optional)} onChange={(e) => setSection(i, { optional: e.checked })} aria-label={k("optional")} /></td>
                      <td style={{ minWidth: "14rem" }}><MultiSelect value={s.insurerIds} options={insurers} filter display="chip" onChange={(e) => setSection(i, { insurerIds: e.value })} className="w-full" aria-label={k("insurers")} /></td>
                      <td style={{ minWidth: "12rem" }}><Chips value={s.benefits} onChange={(e) => setSection(i, { benefits: e.value })} separator="," aria-label={k("benefits")} /></td>
                      <td><Button icon="pi pi-trash" text rounded severity="danger" disabled={edit.sections.length < 2} aria-label={t("common.delete")}
                        onClick={() => setEdit({ ...edit, sections: edit.sections.filter((_, j) => j !== i) })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button label={k("addSection")} icon="pi pi-plus" text onClick={() => setEdit({ ...edit, sections: [...edit.sections, { ...EMPTY_SECTION }] })} />
            <p className="muted">{k("insurersHelp")}</p>
          </>
        )}
      </Dialog>
    </div>
  );
};

export default BundleProducts;
