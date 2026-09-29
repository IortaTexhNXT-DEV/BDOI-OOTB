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
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import bankReconciliationService from "../../services/bankReconciliationService";
import { Amount, BrTag, PageHeader, date, showError, showSuccess } from "./common";

const EMPTY = { code: "", name: "", bankCode: "", description: "", fileType: "any", skipRows: 0, hasHeader: true, columns: {}, dateFormat: "MM/DD/YYYY", amountSign: "credit-positive", skipPattern: "", active: true };

/**
 * Master > Finance > Bank Statement Formats: how each bank's CSV / XLSX export is read (column mapping by header text
 * or column number, date format, title rows to skip, signed amount or debit / credit columns), with a file test.
 */
const StatementFormats = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [data, setData] = useState({ items: [], dateFormats: [], columnKeys: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [test, setTest] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await bankReconciliationService.formats());
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const v = editing?.values;
  const set = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const setColumn = (k, val) => set({ columns: { ...v.columns, [k]: val === "" ? null : (/^\d+$/.test(val) ? Number(val) : val) } });
  const save = async () => {
    try {
      const columns = Object.fromEntries(Object.entries(v.columns || {}).filter(([, x]) => x !== null && x !== ""));
      const body = { name: v.name, bankCode: v.bankCode || null, description: v.description || null, fileType: v.fileType, skipRows: v.skipRows || 0, hasHeader: !!v.hasHeader, columns,
        dateFormat: v.dateFormat, amountSign: v.amountSign, skipPattern: v.skipPattern || null, active: !!v.active };
      if (editing.isNew) await bankReconciliationService.addFormat({ code: v.code, ...body });
      else await bankReconciliationService.updateFormat(v.code, body);
      showSuccess(toast, v.name);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const runTest = async (file) => {
    try {
      setTest({ ...test, result: await bankReconciliationService.testFormat(test.code, file) });
    } catch (e) {
      setTest({ ...test, result: null, error: e.message });
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader master title={t("bankReconciliation.statementFormats")} trail={[t("bankReconciliation.statementFormats")]} subtitle={t("bankReconciliation.formatsHelp")}>
        <Button icon="pi pi-plus" label={t("bankReconciliation.addFormat")} onClick={() => setEditing({ isNew: true, values: { ...EMPTY } })} />
      </PageHeader>
      <div className="pe-card">
        <DataTable value={data.items} loading={loading} dataKey="code" size="small" stripedRows>
          <Column field="code" header={t("bankReconciliation.code")} />
          <Column header={t("bankReconciliation.name")} body={(r) => <div><div>{r.name}</div><div className="pe-muted">{r.description}</div></div>} />
          <Column field="bankCode" header={t("bankReconciliation.bank")} />
          <Column field="dateFormat" header={t("bankReconciliation.dateFormat")} />
          <Column header={t("bankReconciliation.amounts")} body={(r) => (r.columns.amount ? t("bankReconciliation.signedAmount") : t("bankReconciliation.debitCredit"))} />
          <Column header={t("bankReconciliation.status.label")} body={(r) => <span className="flex gap-1"><BrTag status={r.active ? "active" : "inactive"} />{r.isExample && <BrTag status="example" />}</span>} />
          <Column body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-pencil" text size="small" onClick={() => setEditing({ isNew: false, values: { ...EMPTY, ...r, bankCode: r.bankCode || "", description: r.description || "", skipPattern: r.skipPattern || "" } })} aria-label={t("bankReconciliation.edit")} />
              <Button icon="pi pi-file-import" text size="small" tooltip={t("bankReconciliation.testFile")} onClick={() => setTest({ code: r.code })} aria-label={t("bankReconciliation.testFile")} />
            </div>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("bankReconciliation.addFormat") : v.code) : ""} visible={!!editing} style={{ width: "min(860px, 96vw)" }} onHide={() => setEditing(null)}
        footer={(
          <div>
            <Button label={t("bankReconciliation.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("bankReconciliation.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.name || !v?.columns?.date} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.code")} *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("bankReconciliation.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.bank")}</label><InputText value={v.bankCode} onChange={(e) => set({ bankCode: e.target.value.toUpperCase() })} className="w-full" placeholder="BDO" /></div>
            <div className="col-12"><label>{t("bankReconciliation.description")}</label><InputTextarea value={v.description} rows={2} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.fileType")}</label>
              <Dropdown value={v.fileType} options={["any", "csv", "xlsx"].map((x) => ({ label: x.toUpperCase(), value: x }))} onChange={(e) => set({ fileType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.dateFormat")}</label>
              <Dropdown value={v.dateFormat} options={data.dateFormats.map((x) => ({ label: x, value: x }))} onChange={(e) => set({ dateFormat: e.value })} className="w-full" editable /></div>
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.skipRows")}</label>
              <InputNumber value={v.skipRows} min={0} max={100} onValueChange={(e) => set({ skipRows: e.value ?? 0 })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("bankReconciliation.amountSign")}</label>
              <Dropdown value={v.amountSign} options={["credit-positive", "debit-positive"].map((x) => ({ label: t(`bankReconciliation.sign.${x}`), value: x }))} onChange={(e) => set({ amountSign: e.value })} className="w-full" /></div>
            <div className="col-12"><div className="pe-card-title mt-2 mb-1" style={{ fontSize: "0.95rem" }}>{t("bankReconciliation.columnMapping")}</div>
              <p className="pe-muted mt-0">{t("bankReconciliation.columnMappingHelp")}</p>
              <div className="br-columns-grid">
                {data.columnKeys.map((k) => (
                  <div key={k}><label>{t(`bankReconciliation.column.${k}`)}{k === "date" ? " *" : ""}</label>
                    <InputText value={v.columns?.[k] ?? ""} onChange={(e) => setColumn(k, e.target.value)} className="w-full" /></div>
                ))}
              </div>
            </div>
            <div className="col-12 md:col-8"><label>{t("bankReconciliation.skipPattern")}</label><InputText value={v.skipPattern} onChange={(e) => set({ skipPattern: e.target.value })} className="w-full" placeholder="^(total|beginning balance)" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-3 mt-4">
              <span className="flex align-items-center gap-2"><Checkbox inputId="bf-header" checked={!!v.hasHeader} onChange={(e) => set({ hasHeader: e.checked })} /><label htmlFor="bf-header" className="m-0">{t("bankReconciliation.hasHeader")}</label></span>
              <span className="flex align-items-center gap-2"><Checkbox inputId="bf-active" checked={!!v.active} onChange={(e) => set({ active: e.checked })} /><label htmlFor="bf-active" className="m-0">{t("bankReconciliation.status.active")}</label></span>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={test ? `${t("bankReconciliation.testFile")} · ${test.code}` : ""} visible={!!test} style={{ width: "min(900px, 96vw)" }} onHide={() => setTest(null)}>
        {test && (
          <div>
            <input type="file" accept=".csv,.xlsx" className="p-inputtext w-full mb-3" onChange={(e) => e.target.files?.[0] && runTest(e.target.files[0])} />
            {test.error && <div className="br-notice br-notice-bad">{test.error}</div>}
            {test.result && (
              <>
                <div className="br-preview-summary"><span>{t("bankReconciliation.lines")}: <b>{test.result.lineCount}</b></span><span>{t("bankReconciliation.skippedRows")}: <b>{test.result.skippedRows}</b></span>
                  <span>{t("bankReconciliation.errors")}: <b>{test.result.errors.length}</b></span></div>
                {test.result.errors.length > 0 && <div className="br-notice br-notice-bad">{test.result.errors.slice(0, 6).map((e) => <div key={e.row}>{t("bankReconciliation.row")} {e.row}: {e.message}</div>)}</div>}
                <DataTable value={test.result.lines} size="small" scrollable scrollHeight="320px" dataKey="lineNo">
                  <Column header={t("bankReconciliation.date")} body={(l) => date(l.date)} />
                  <Column field="description" header={t("bankReconciliation.description")} />
                  <Column field="reference" header={t("bankReconciliation.reference")} />
                  <Column header={t("bankReconciliation.amount")} body={(l) => <Amount value={l.amount} />} className="bv-num" headerClassName="bv-num" />
                </DataTable>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default StatementFormats;
