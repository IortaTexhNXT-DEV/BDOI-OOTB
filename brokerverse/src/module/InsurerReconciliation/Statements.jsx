import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/insurerReconciliationService";
import { IrTag, PageHeader, date, insurerOptions, money, showError, showSuccess } from "./common";
import FileField from "../../components/FileField";

const STATUSES = ["draft", "submitted", "approved", "cancelled"];
const iso = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "");
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const EMPTY = () => ({ insurerId: null, statementType: "premium", periodFrom: monthStart(), periodTo: new Date(), statementRef: "", formatCode: null, tolerance: null, file: null });

/**
 * Accounts > Insurer Reconciliation: statements of account imported from insurers (premium remittance confirmations
 * and commission statements) with their reconciliation status, and the import (file, insurer, period, format, preview).
 */
const Statements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState([]);
  const [filter, setFilter] = useState({ insurerId: null, status: null });
  const [form, setForm] = useState(null);
  const [formats, setFormats] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.statements({ insurerId: filter.insurerId, status: filter.status }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { insurerOptions().then(setInsurers).catch((e) => showError(toast, e)); }, []);
  useEffect(() => {
    if (!form?.insurerId) return;
    service.formats({ insurerId: form.insurerId }).then(setFormats).catch((e) => showError(toast, e));
  }, [form?.insurerId]);

  const fields = () => ({ insurerId: form.insurerId, statementType: form.statementType, periodFrom: iso(form.periodFrom), periodTo: iso(form.periodTo),
    statementRef: form.statementRef, formatCode: form.formatCode, tolerance: form.tolerance });
  const runPreview = async () => {
    setBusy(true);
    try {
      setPreview(await service.preview(form.file, fields()));
    } catch (e) {
      setPreview(null);
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  const runImport = async () => {
    setBusy(true);
    try {
      const s = await service.importStatement(form.file, fields());
      showSuccess(toast, t("insurerRec.imported", { number: s.statementNumber, matched: s.summary.matched, differences: s.summary.differences }));
      setForm(null);
      setPreview(null);
      navigate(`/accounts/insurer-reconciliation/statements/${s.id}`);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  const ready = form?.insurerId && form?.file && form?.periodFrom && form?.periodTo;

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("insurerRec.statements")} trail={[t("insurerRec.statements")]}>
        <Button icon="pi pi-upload" label={t("insurerRec.importStatement")} onClick={() => { setForm(EMPTY()); setPreview(null); }} />
      </PageHeader>
      <div className="pe-card">
        <div className="grid mb-2">
          <div className="col-12 md:col-4">
            <Dropdown value={filter.insurerId} options={insurers} onChange={(e) => setFilter({ ...filter, insurerId: e.value })} placeholder={t("insurerRec.allInsurers")} showClear filter className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: t(`insurerRec.status.${s}`), value: s }))} onChange={(e) => setFilter({ ...filter, status: e.value })}
              placeholder={t("insurerRec.allStatuses")} showClear className="w-full" />
          </div>
        </div>
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("insurerRec.noStatements")}
          onRowClick={(e) => navigate(`/accounts/insurer-reconciliation/statements/${e.data.id}`)} rowHover className="cursor-pointer">
          <Column field="statementNumber" header={t("insurerRec.number")} />
          <Column field="insurerName" header={t("insurerRec.insurer")} />
          <Column header={t("insurerRec.type")} body={(r) => t(`insurerRec.type_${r.statementType}`)} />
          <Column field="statementRef" header={t("insurerRec.insurerReference")} />
          <Column header={t("insurerRec.period")} body={(r) => `${date(r.periodFrom)} - ${date(r.periodTo)}`} />
          <Column field="lineCount" header={t("insurerRec.lines")} className="bv-num" headerClassName="bv-num" />
          <Column field="matched" header={t("insurerRec.status.matched")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("insurerRec.grossPremium")} body={(r) => money(r.totals.grossPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("insurerRec.commission")} body={(r) => money(r.totals.commission)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("insurerRec.statusLabel")} body={(r) => <IrTag status={r.status} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={t("insurerRec.importStatement")} visible={!!form} style={{ width: "min(900px, 96vw)" }} onHide={() => setForm(null)}
        footer={(
          <div>
            <Button label={t("insurerRec.cancel")} text onClick={() => setForm(null)} />
            <Button label={t("insurerRec.preview")} icon="pi pi-eye" outlined onClick={runPreview} disabled={!ready || busy} />
            <Button label={t("insurerRec.import")} icon="pi pi-check" onClick={runImport} disabled={!ready || busy || (preview && preview.errors.length > 0)} loading={busy} />
          </div>
        )}>
        {form && (
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("insurerRec.insurer")} *</label>
              <Dropdown value={form.insurerId} options={insurers} filter onChange={(e) => setForm({ ...form, insurerId: e.value, formatCode: null })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("insurerRec.type")} *</label>
              <Dropdown value={form.statementType} options={["premium", "commission"].map((x) => ({ label: t(`insurerRec.type_${x}`), value: x }))} onChange={(e) => setForm({ ...form, statementType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("insurerRec.periodFrom")} *</label>
              <Calendar value={form.periodFrom} onChange={(e) => setForm({ ...form, periodFrom: e.value })} showIcon className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("insurerRec.periodTo")} *</label>
              <Calendar value={form.periodTo} onChange={(e) => setForm({ ...form, periodTo: e.value })} showIcon className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("insurerRec.insurerReference")}</label>
              <InputText value={form.statementRef} onChange={(e) => setForm({ ...form, statementRef: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("insurerRec.tolerance")}</label>
              <InputNumber value={form.tolerance} mode="decimal" minFractionDigits={2} min={0} placeholder={t("insurerRec.toleranceDefault")} onValueChange={(e) => setForm({ ...form, tolerance: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("insurerRec.format")}</label>
              <Dropdown value={form.formatCode} options={formats.map((f) => ({ label: `${f.code} - ${f.name}`, value: f.code }))} showClear placeholder={t("insurerRec.formatDefault")}
                onChange={(e) => setForm({ ...form, formatCode: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("insurerRec.file")} *</label>
              <FileField accept=".csv,.xlsx" value={form.file || null} onChange={(f) => { setForm({ ...form, file: f }); setPreview(null); }} /></div>
            {preview && (
              <div className="col-12">
                <div className="flex flex-wrap gap-4 mb-2">
                  <span>{t("insurerRec.format")}: <b>{preview.format}</b></span>
                  <span>{t("insurerRec.lines")}: <b>{preview.totals.count}</b></span>
                  <span>{t("insurerRec.grossPremium")}: <b>{money(preview.totals.grossPremium)}</b></span>
                  <span>{t("insurerRec.commission")}: <b>{money(preview.totals.commission)}</b></span>
                  <span>{t("insurerRec.amountPaid")}: <b>{money(preview.totals.amountPaid)}</b></span>
                  <span>{t("insurerRec.errors")}: <b>{preview.errors.length}</b></span>
                </div>
                {preview.errors.length > 0 && (
                  <div className="p-message p-message-error p-2 mb-2">{preview.errors.slice(0, 8).map((e) => <div key={e.row}>{t("insurerRec.row")} {e.row}: {e.message}</div>)}</div>
                )}
                <DataTable value={preview.lines} size="small" scrollable scrollHeight="260px" dataKey="lineNo">
                  <Column field="policyNo" header={t("insurerRec.policyNo")} />
                  <Column field="insured" header={t("insurerRec.insured")} />
                  <Column header={t("insurerRec.date")} body={(l) => date(l.date)} />
                  <Column header={t("insurerRec.grossPremium")} body={(l) => money(l.grossPremium)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("insurerRec.commission")} body={(l) => money(l.commission)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("insurerRec.amountPaid")} body={(l) => money(l.amountPaid)} className="bv-num" headerClassName="bv-num" />
                </DataTable>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Statements;
