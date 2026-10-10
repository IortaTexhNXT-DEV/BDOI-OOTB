import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { StatusTag, date, showError, showSuccess } from "./common";
import { useAccountOptions } from "./LinesEditor";

const TYPES = ["VAT", "EWT", "FWT", "DST", "LGT", "PT", "FST", "OTHER"];
const EMPTY = { code: "", description: "", taxType: "EWT", rate: 0, atc: "", natureOfPayment: "", glAccount: null, appliesTo: "both", payeeKind: "any", effectiveFrom: null, effectiveTo: null, active: true, sortOrder: 500, remarks: "" };

/**
 * Master > Finance > Taxation: the tax codes master (VAT, expanded and final withholding with the BIR ATC, DST, LGT,
 * premium tax) with the GL account each tax is booked to. The ATC and nature of payment print on BIR Form 2307 and
 * the QAP / SAWT alphalists. Seeded Philippine codes are editable.
 */
const TaxCodes = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const accounts = useAccountOptions();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ taxType: null, search: "" });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await periodEndService.taxCodes({ taxType: filters.taxType, search: filters.search.trim() }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const v = editing?.values;
  const setValue = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const save = async () => {
    const body = { description: v.description, taxType: v.taxType, rate: Number(v.rate || 0), atc: v.atc || null, natureOfPayment: v.natureOfPayment || null, glAccount: v.glAccount || null,
      appliesTo: v.appliesTo, payeeKind: v.payeeKind, effectiveFrom: v.effectiveFrom ? toIsoDate(v.effectiveFrom) : null, effectiveTo: v.effectiveTo ? toIsoDate(v.effectiveTo) : null,
      active: !!v.active, sortOrder: v.sortOrder, remarks: v.remarks || null };
    try {
      const r = editing.isNew ? await periodEndService.createTaxCode({ code: v.code.toUpperCase(), ...body }) : await periodEndService.updateTaxCode(v.code, body);
      showSuccess(toast, `${r.code} ${t("periodEnd.saved")}`);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <div className="pe-header">
        <div>
          <h1 className="pe-title">{t("periodEnd.taxCodes")}</h1>
        </div>
        <div className="pe-header-actions">
          <Dropdown value={filters.taxType} options={TYPES.map((x) => ({ label: x, value: x }))} onChange={(e) => setFilters({ ...filters, taxType: e.value })} placeholder={t("periodEnd.allTaxTypes")} showClear />
          <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder={t("periodEnd.searchTax")} /></span>
          <Button icon="pi pi-plus" label={t("periodEnd.addTaxCode")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
        </div>
      </div>
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="code" size="small" stripedRows paginator rows={20} emptyMessage={t("periodEnd.noRows")}>
          <Column field="code" header={t("periodEnd.code")} sortable />
          <Column field="taxType" header={t("periodEnd.taxType")} sortable />
          <Column field="atc" header="ATC" sortable />
          <Column field="description" header={t("periodEnd.description")} />
          <Column header={t("periodEnd.rate")} body={(r) => `${Number(r.rate)}%`} className="bv-num" headerClassName="bv-num" />
          <Column field="glAccount" header={t("periodEnd.glAccount")} />
          <Column header={t("periodEnd.appliesTo")} body={(r) => t(`periodEnd.appliesToValue.${r.appliesTo}`)} />
          <Column header={t("periodEnd.effectiveFrom")} body={(r) => date(r.effectiveFrom)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.active ? "active" : "inactive"} />} />
          <Column body={(r) => <Button icon="pi pi-pencil" text size="small" disabled={!r.editable}
            onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, atc: r.atc || "", natureOfPayment: r.natureOfPayment || "", remarks: r.remarks || "", effectiveFrom: toDate(r.effectiveFrom), effectiveTo: toDate(r.effectiveTo) } })} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("periodEnd.addTaxCode") : t("periodEnd.editTaxCode", { name: [v.code, v.description].filter(Boolean).join(" – ") })) : ""} visible={!!editing} style={{ width: "min(760px, 95vw)" }} onHide={() => setEditing(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("periodEnd.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.description} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-4"><label>{t("periodEnd.code")} *</label><InputText value={v.code} maxLength={20} keyfilter={/[A-Za-z0-9-]/} disabled={!editing.isNew} onChange={(e) => setValue({ code: e.target.value.toUpperCase() })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("periodEnd.taxType")}</label><Dropdown value={v.taxType} options={TYPES.map((x) => ({ label: x, value: x }))} onChange={(e) => setValue({ taxType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("periodEnd.rate")} (%)</label><InputNumber value={v.rate} onValueChange={(e) => setValue({ rate: e.value })} min={0} max={100} minFractionDigits={0} maxFractionDigits={4} className="w-full" /></div>
            <div className="col-12"><label>{t("periodEnd.description")} *</label><InputText value={v.description} onChange={(e) => setValue({ description: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>ATC</label><InputText value={v.atc} maxLength={10} onChange={(e) => setValue({ atc: e.target.value.toUpperCase() })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("periodEnd.natureOfPayment")}</label><InputText value={v.natureOfPayment} maxLength={200} onChange={(e) => setValue({ natureOfPayment: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("periodEnd.glAccount")}</label><Dropdown value={v.glAccount} options={accounts} filter showClear onChange={(e) => setValue({ glAccount: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.appliesTo")}</label>
              <Dropdown value={v.appliesTo} options={["sales", "purchases", "both"].map((x) => ({ label: t(`periodEnd.appliesToValue.${x}`), value: x }))} onChange={(e) => setValue({ appliesTo: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.payeeKind")}</label>
              <Dropdown value={v.payeeKind} options={["any", "individual", "corporate"].map((x) => ({ label: t(`periodEnd.payeeKindValue.${x}`), value: x }))} onChange={(e) => setValue({ payeeKind: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("periodEnd.effectiveFrom")}</label><Calendar value={v.effectiveFrom} onChange={(e) => setValue({ effectiveFrom: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("periodEnd.effectiveTo")}</label><Calendar value={v.effectiveTo} onChange={(e) => setValue({ effectiveTo: e.value })} dateFormat={calendarDateFormat()} showIcon showButtonBar className="w-full" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-2 mt-4"><Checkbox inputId="tc-active" checked={!!v.active} onChange={(e) => setValue({ active: e.checked })} /><label htmlFor="tc-active" className="m-0">{t("periodEnd.status.active")}</label></div>
            <div className="col-12"><label>{t("periodEnd.remarks")}</label><InputTextarea value={v.remarks} onChange={(e) => setValue({ remarks: e.target.value })} rows={2} className="w-full" /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default TaxCodes;
