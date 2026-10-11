import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/insurerReconciliationService";
import { IrTag, PageHeader, insurerOptions, showError, showSuccess } from "./common";

const COLUMN_KEYS = ["policyNo", "insured", "date", "reference", "grossPremium", "commission", "taxes", "amountPaid"];
const DATE_FORMATS = ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "M/D/YYYY", "DD-MMM-YYYY", "MMM DD, YYYY", "MM/DD/YY"];
const EMPTY = { code: "", name: "", insurerId: null, description: "", fileType: "any", skipRows: 0, hasHeader: true, columns: {}, dateFormat: "MM/DD/YYYY", skipPattern: "", active: true };

/**
 * Master > Finance > Insurer Statement Formats: how each insurer's statement of account is read (column by header text,
 * with "|" alternatives, or by column number; rows to skip; date format; rows to ignore such as totals).
 */
const Formats = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.formats({ all: true }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); insurerOptions().then(setInsurers).catch((e) => showError(toast, e)); }, [load]);

  const v = editing?.values;
  const set = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const setColumn = (k, val) => set({ columns: { ...v.columns, [k]: val === "" ? null : (/^\d+$/.test(val) ? Number(val) : val) } });
  const save = async () => {
    try {
      const columns = Object.fromEntries(Object.entries(v.columns || {}).filter(([, x]) => x !== null && x !== ""));
      const body = { name: v.name, insurerId: v.insurerId || null, description: v.description || null, fileType: v.fileType, skipRows: v.skipRows || 0, hasHeader: !!v.hasHeader, columns,
        dateFormat: v.dateFormat, skipPattern: v.skipPattern || null, active: !!v.active };
      if (editing.isNew) await service.addFormat({ code: v.code, ...body });
      else await service.updateFormat(v.code, body);
      showSuccess(toast, t("insurerRec.formatSaved", { code: v.code }));
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader master title={t("insurerRec.formats")} trail={[t("insurerRec.formats")]}>
        <Button icon="pi pi-plus" label={t("insurerRec.addFormat")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
      </PageHeader>
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="code" size="small" stripedRows>
          <Column field="code" header={t("insurerRec.code")} />
          <Column header={t("insurerRec.name")} body={(r) => <div><div>{r.name}</div><div className="pe-muted">{r.description}</div></div>} />
          <Column header={t("insurerRec.insurer")} body={(r) => r.insurerName || t("insurerRec.anyInsurer")} />
          <Column field="dateFormat" header={t("insurerRec.dateFormat")} />
          <Column header={t("insurerRec.statusLabel")} body={(r) => <IrTag status={r.active ? "approved" : "cancelled"} />} />
          <Column body={(r) => <Button icon="pi pi-pencil" text size="small" aria-label={t("insurerRec.edit")}
            onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, description: r.description || "", skipPattern: r.skipPattern || "" } })} tooltip={t("insurerRec.edit")} tooltipOptions={{ position: "top" }}
            />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("insurerRec.addFormat") : t("insurerRec.editFormat", { name: v.name || v.code })) : ""} visible={!!editing} style={{ width: "min(860px, 96vw)" }} onHide={() => setEditing(null)}
        footer={(
          <div>
            <Button label={t("insurerRec.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("insurerRec.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.name || !v?.columns?.policyNo} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-3"><label>{t("insurerRec.code")} *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className="w-full" /></div>
            <div className="col-12 md:col-5"><label>{t("insurerRec.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("insurerRec.insurer")}</label>
              <Dropdown value={v.insurerId} options={insurers} showClear filter placeholder={t("insurerRec.anyInsurer")} onChange={(e) => set({ insurerId: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("insurerRec.description")}</label><InputText value={v.description} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("insurerRec.fileType")}</label>
              <Dropdown value={v.fileType} options={["any", "csv", "xlsx"].map((x) => ({ label: x.toUpperCase(), value: x }))} onChange={(e) => set({ fileType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("insurerRec.dateFormat")}</label>
              <Dropdown value={v.dateFormat} options={DATE_FORMATS.map((x) => ({ label: x, value: x }))} editable onChange={(e) => set({ dateFormat: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("insurerRec.skipRows")}</label>
              <InputNumber value={v.skipRows} min={0} max={100} onValueChange={(e) => set({ skipRows: e.value ?? 0 })} className="w-full" /></div>
            <div className="col-12">
              <p className="pe-muted mt-2 mb-1">{t("insurerRec.columnMappingHelp")}</p>
              <div className="grid">
                {COLUMN_KEYS.map((k) => (
                  <div className="col-12 md:col-3" key={k}><label>{t(`insurerRec.column.${k}`)}{k === "policyNo" ? " *" : ""}</label>
                    <InputText value={v.columns?.[k] ?? ""} onChange={(e) => setColumn(k, e.target.value)} className="w-full" /></div>
                ))}
              </div>
            </div>
            <div className="col-12 md:col-8"><label>{t("insurerRec.skipPattern")}</label>
              <InputText value={v.skipPattern} onChange={(e) => set({ skipPattern: e.target.value })} className="w-full" placeholder="^(total|grand total)" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-3 mt-4">
              <span className="flex align-items-center gap-2"><Checkbox inputId="if-header" checked={!!v.hasHeader} onChange={(e) => set({ hasHeader: e.checked })} /><label htmlFor="if-header" className="m-0">{t("insurerRec.hasHeader")}</label></span>
              <span className="flex align-items-center gap-2"><Checkbox inputId="if-active" checked={!!v.active} onChange={(e) => set({ active: e.checked })} /><label htmlFor="if-active" className="m-0">{t("insurerRec.active")}</label></span>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Formats;
