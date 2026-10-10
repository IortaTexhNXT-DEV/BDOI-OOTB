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
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";
import { hasPermission } from "../../utils/canOpen";
import PageHeader from "../../components/PageHeader";
import RowActions, { actionsColumn } from "../../components/RowActions";
import DealerPremiumPreview, { usePayerTerms } from "./DealerPremiumPreview";
import { Field, StatusTag, dateTime, fromIsoDay, isoDay, money, printFile, showError, showSuccess } from "./common";

const EMPTY = { code: "", name: "", dealerChannelId: null, bankChannelId: null, insuranceCompanyId: null, vehicleType: "private_cars", ownDamageRate: 1.5, actsOfNatureRate: 0.5,
  bodilyInjury: 0, propertyDamage: 0, includeCtpl: true, ctplTermYears: 3, freeFirstYear: false, subsidyPayer: "none", subsidyType: "percent", subsidyValue: 0, issueMode: "quotation",
  mortgageeClause: "", effectiveFrom: null, effectiveTo: null, status: "active", notes: "" };

/** A sale with a financing bank, created: it has a bank endorsement letter. */
const financed = (sale) => Boolean(sale.bankChannelId) && sale.status === "created";

/**
 * Operations > Sales & Marketing > Dealer Programmes: brand-new vehicle programmes of a captive agency (dealer,
 * financing bank as mortgagee, free or subsidised first year and who pays, issue mode), the upload of a dealer's vehicle
 * sales (Dealer Sales template) creating the prospects, quotations and policies, and the bank endorsement letters.
 */
const DealerProgrammes = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileRef = useRef(null);
  const write = hasPermission("write:motor-programmes");
  const [programmes, setProgrammes] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [uploadFor, setUploadFor] = useState(null);
  const [result, setResult] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState(null);
  const [sales, setSales] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([service.programmes(), service.salesBatches()]);
      setProgrammes(p);
      setBatches(b);
    } catch (e) {
      showError(toast, e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    service.channelOptions("dealer_group,dealer_branch").then((r) => setDealers(r.map((c) => ({ value: c.id, label: c.label })))).catch(() => setDealers([]));
    service.channelOptions("financing_bank,bank_branch").then((r) => setBanks(r.map((c) => ({ value: c.id, label: c.label })))).catch(() => setBanks([]));
    mastersService.options("insurance-company").then((r) => setInsurers(r.map((x) => ({ value: Number(x.id), label: x.label })))).catch(() => setInsurers([]));
    service.previewOptions().then((r) => setVehicleTypes(r.vehicleTypes.map((v) => ({ value: v.value, label: v.label, threeYears: v.ctplPremium3Year !== null })))).catch(() => setVehicleTypes([]));
  }, []);
  const openBatch = async (b) => {
    setBatch(b);
    try {
      setSales(await service.dealerSales({ batchId: b.id }));
    } catch (e) {
      showError(toast, e);
    }
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    const body = Object.fromEntries(Object.entries(form).filter(([k]) => Object.prototype.hasOwnProperty.call(EMPTY, k)).map(([k, v]) => [k, v === "" ? null : v]));
    body.effectiveFrom = form.effectiveFrom ? isoDay(form.effectiveFrom) : null;
    body.effectiveTo = form.effectiveTo ? isoDay(form.effectiveTo) : null;
    try {
      const r = form.id ? await service.updateProgramme(form.id, body) : await service.createProgramme(body);
      showSuccess(toast, r.message);
      setForm(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const upload = async (file) => {
    if (!file || !uploadFor) return;
    setBusy(true);
    try {
      const r = await service.uploadSales(uploadFor, file);
      setResult(r.data);
      showSuccess(toast, r.message);
      load();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const run = async (fn) => {
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
    } catch (e) {
      showError(toast, e);
    }
  };

  const payerTerms = usePayerTerms();
  const threeYearCtpl = !form?.vehicleType || vehicleTypes.find((v) => v.value === form.vehicleType)?.threeYears !== false;

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.mp.title", "Dealer Programmes")}
        help={t("distribution.mp.subtitle", "Brand-new vehicle programmes with dealers and financing banks, the dealers' sales uploads and the bank endorsement letters.")}>
        {write ? <Button label={t("distribution.mp.add", "Add programme")} icon="pi pi-plus" onClick={() => setForm({ ...EMPTY })} /> : null}
      </PageHeader>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("distribution.mp.programmes", "Programmes")}>
            <DataTable value={programmes} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="code" header={t("distribution.common.code", "Code")} />
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column header={t("distribution.mp.dealerBank", "Dealer / financing bank")} body={(p) => (
                <span>{p.dealerName}{p.bankName ? <><br /><small className="pe-muted">{p.bankName}</small></> : null}</span>
              )} />
              <Column field="insurerName" header={t("distribution.mp.insurer", "Insurer")} />
              <Column header={t("distribution.mp.rates", "Rates")} body={(p) => (
                <span className="dist-rates">{[`OD ${p.ownDamageRate}%`, p.actsOfNatureRate ? `AON ${p.actsOfNatureRate}%` : null, p.includeCtpl ? `CTPL ${p.ctplTermYears}y` : null]
                  .filter(Boolean).map((r) => <span key={r}>{r}</span>)}</span>
              )} />
              <Column header={t("distribution.mp.whoPays", "Who pays")} body={payerTerms} />
              <Column header={t("distribution.mp.issueMode", "Upload creates")} body={(p) => t(`distribution.mp.mode.${p.issueMode}`, p.issueMode)} />
              <Column field="sales" header={t("distribution.mp.sales", "Sales")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.common.status", "Status")} body={(p) => <StatusTag status={p.status} />} />
              <Column {...actionsColumn} header={t("common.actions", "Actions")} body={(p) => (
                <RowActions editLabel={t("distribution.mp.edit", "Edit programme")} onEdit={write ? () => setForm({ ...EMPTY, ...p, mortgageeClause: p.mortgageeClause || "", notes: p.notes || "",
                  effectiveFrom: fromIsoDay(p.effectiveFrom), effectiveTo: fromIsoDay(p.effectiveTo) }) : null}>
                  <Button type="button" icon="pi pi-calculator" text rounded tooltip={t("distribution.mp.preview", "Premium preview")} tooltipOptions={{ position: "top" }}
                    aria-label={t("distribution.mp.preview", "Premium preview")} onClick={() => setPreview(p)} />
                </RowActions>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.mp.upload", "Dealer Sales Upload")}>
            {write ? (
              <div className="dist-toolbar">
                <Dropdown value={uploadFor} options={programmes.filter((p) => p.status === "active").map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
                  placeholder={t("distribution.mp.choose", "Choose the programme")} onChange={(e) => setUploadFor(e.value)} className="dist-upload-programme" />
                <Button label={t("distribution.mp.template", "Template")} icon="pi pi-download" outlined size="small" onClick={() => run(() => service.salesTemplate())} />
                <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => upload(e.target.files?.[0])} aria-label={t("distribution.mp.file", "Sales file")} />
                <Button label={t("distribution.mp.uploadFile", "Upload sales")} icon="pi pi-upload" size="small" disabled={!uploadFor || busy} loading={busy} onClick={() => fileRef.current?.click()} />
              </div>
            ) : null}
            {result ? (
              <div className="dist-summary">
                <span>{t("distribution.mp.batch", "Batch")} <b>{result.batchNumber}</b></span>
                <span>{t("distribution.mp.created", "Created")} <b>{result.created}</b></span>
                <span>{t("distribution.mp.failed", "Failed")} <b>{result.failed}</b></span>
                {result.errors.length ? <span className="p-error">{result.errors.slice(0, 5).map((e) => `${t("distribution.mp.row", "Row")} ${e.row}: ${e.message}`).join(" | ")}</span> : null}
              </div>
            ) : null}
            <DataTable value={batches} dataKey="id" size="small" stripedRows selectionMode="single" selection={batch} onSelectionChange={(e) => e.value && openBatch(e.value)}
              emptyMessage={t("distribution.mp.noBatches", "No upload yet")}>
              <Column field="batchNumber" header={t("distribution.mp.batch", "Batch")} />
              <Column field="programmeCode" header={t("distribution.mp.programme", "Programme")} />
              <Column field="fileName" header={t("distribution.mp.file", "Sales file")} />
              <Column field="rowsCreated" header={t("distribution.mp.created", "Created")} className="bv-num" headerClassName="bv-num" />
              <Column field="rowsFailed" header={t("distribution.mp.failed", "Failed")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.common.status", "Status")} body={(b) => <StatusTag status={b.status} />} />
              <Column header={t("distribution.mp.uploaded", "Uploaded")} body={(b) => dateTime(b.createdAt)} />
              <Column field="createdBy" header={t("distribution.mp.uploadedBy", "Uploaded by")} />
            </DataTable>
            {batch ? (
              <>
                <div className="flex align-items-center justify-content-between gap-2 mt-4 mb-2">
                  <h3 className="m-0">{t("distribution.mp.salesOf", "Sales of batch {{batch}}", { batch: batch.batchNumber })}</h3>
                  {sales.some(financed) ? (
                    <Button label={t("distribution.mp.batchLetters", "Bank letters of the batch")} icon="pi pi-print" outlined size="small"
                      onClick={() => printFile(toast, `/motor-programmes/batches/${encodeURIComponent(batch.id)}/bank-letters`, `${batch.batchNumber}-bank-letters.pdf`)} />
                  ) : null}
                </div>
                <DataTable value={sales} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
                  <Column field="rowNo" header={t("distribution.mp.row", "Row")} />
                  <Column field="buyerName" header={t("distribution.mp.buyer", "Buyer")} />
                  <Column field="vehicle" header={t("distribution.mp.vehicle", "Vehicle")} />
                  <Column field="dealerName" header={t("distribution.mp.dealer", "Dealer")} />
                  <Column field="bankName" header={t("distribution.mp.bank", "Financing bank")} />
                  <Column header={t("distribution.mp.premium", "Premium")} body={(s) => money(s.grossPremium)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.mp.payerShare", "Dealer / bank")} body={(s) => money(s.payerShare)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.mp.buyerShare", "Buyer")} body={(s) => money(s.buyerShare)} className="bv-num" headerClassName="bv-num" />
                  <Column header={t("distribution.mp.document", "Quotation / policy")} body={(s) => s.policyNumber || s.quoteNumber || ""} />
                  <Column header={t("distribution.common.status", "Status")} body={(s) => (<span><StatusTag status={s.status} />{s.error ? <><br /><small className="p-error">{s.error}</small></> : null}</span>)} />
                  <Column body={(s) => (financed(s) ? (
                    <div className="dist-actions">
                      <Button icon="pi pi-print" text size="small" tooltip={t("distribution.mp.bankLetter", "Bank endorsement letter")} aria-label={t("distribution.mp.bankLetter", "Bank endorsement letter")}
                        onClick={() => printFile(toast, `/motor-programmes/sales/${encodeURIComponent(s.id)}/bank-letter`, "bank-letter.pdf")} />
                      {write ? <Button icon="pi pi-envelope" text size="small" tooltip={t("distribution.mp.emailLetter", "E-mail the letter to the bank")} aria-label={t("distribution.mp.emailLetter", "E-mail the letter to the bank")} onClick={() => run(() => service.emailBankLetter(s.id))} /> : null}
                    </div>
                  ) : null)} />
                </DataTable>
              </>
            ) : null}
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={form?.id ? t("distribution.mp.edit", "Edit programme") : t("distribution.mp.add", "Add programme")} visible={!!form} style={{ width: "min(860px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={save} disabled={!form?.code || !form?.name || !form?.dealerChannelId} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.common.code", "Code")}><InputText value={form.code} onChange={(e) => set({ code: e.target.value })} /></Field>
            <Field label={t("distribution.common.name", "Name")}><InputText value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t("distribution.mp.dealer", "Dealer")}><Dropdown value={form.dealerChannelId} options={dealers} filter onChange={(e) => set({ dealerChannelId: e.value })} /></Field>
            <Field label={t("distribution.mp.bank", "Financing bank")} help={t("distribution.mp.bankHelp", "Mortgagee of the financed cars")}>
              <Dropdown value={form.bankChannelId} options={banks} filter showClear onChange={(e) => set({ bankChannelId: e.value || null })} />
            </Field>
            <Field label={t("distribution.mp.insurer", "Insurer")}><Dropdown value={form.insuranceCompanyId} options={insurers} filter showClear onChange={(e) => set({ insuranceCompanyId: e.value || null })} /></Field>
            <Field label={t("distribution.mp.vehicleType", "Default vehicle class")} htmlFor="mp-class">
              <Dropdown inputId="mp-class" value={form.vehicleType} options={vehicleTypes} filter
                onChange={(e) => set({ vehicleType: e.value, ...(vehicleTypes.find((v) => v.value === e.value)?.threeYears === false ? { ctplTermYears: 1 } : {}) })} />
            </Field>
            <Field label={t("distribution.mp.odRate", "Own damage rate %")}><InputNumber value={form.ownDamageRate} min={0} maxFractionDigits={4} onValueChange={(e) => set({ ownDamageRate: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.aonRate", "Acts of nature rate %")}><InputNumber value={form.actsOfNatureRate} min={0} maxFractionDigits={4} onValueChange={(e) => set({ actsOfNatureRate: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.bi", "Excess bodily injury")}><InputNumber value={form.bodilyInjury} min={0} onValueChange={(e) => set({ bodilyInjury: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.pd", "Property damage")}><InputNumber value={form.propertyDamage} min={0} onValueChange={(e) => set({ propertyDamage: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.ctpl", "CTPL")}>
              <span className="flex align-items-center gap-2"><Checkbox inputId="mp-ctpl" checked={form.includeCtpl} onChange={(e) => set({ includeCtpl: e.checked })} />
                <label htmlFor="mp-ctpl">{t("distribution.mp.includeCtpl", "Include CTPL")}</label>
                <Dropdown value={form.ctplTermYears} options={[1, 3].map((v) => ({ value: v, label: t("distribution.mp.years", "{{count}} year(s)", { count: v }), disabled: v === 3 && !threeYearCtpl }))}
                  onChange={(e) => set({ ctplTermYears: e.value })} disabled={!form.includeCtpl} /></span>
            </Field>
            <Field label={t("distribution.mp.issueMode", "Upload creates")}>
              <Dropdown value={form.issueMode} options={["quotation", "policy"].map((v) => ({ value: v, label: t(`distribution.mp.mode.${v}`, v) }))} onChange={(e) => set({ issueMode: e.value })} />
            </Field>
            <Field label={t("distribution.mp.freeFirstYear", "Free first year")}>
              <span className="flex align-items-center gap-2"><Checkbox inputId="mp-free" checked={form.freeFirstYear} onChange={(e) => set({ freeFirstYear: e.checked })} />
                <label htmlFor="mp-free">{t("distribution.mp.freeHelp", "The dealer (or bank) pays the whole first-year premium")}</label></span>
            </Field>
            <Field label={t("distribution.mp.subsidyPayer", "Subsidy paid by")}>
              <Dropdown value={form.subsidyPayer} options={["none", "dealer", "bank"].map((v) => ({ value: v, label: t(`distribution.mp.payer.${v}`, v) }))} onChange={(e) => set({ subsidyPayer: e.value })} />
            </Field>
            <Field label={t("distribution.mp.subsidyType", "Subsidy")}>
              <Dropdown value={form.subsidyType} options={["percent", "amount", "full"].map((v) => ({ value: v, label: t(`distribution.mp.subsidyKind.${v}`, v) }))} onChange={(e) => set({ subsidyType: e.value })}
                disabled={form.subsidyPayer === "none"} />
            </Field>
            <Field label={t("distribution.mp.subsidyValue", "Subsidy value")}>
              <InputNumber value={form.subsidyValue} min={0} maxFractionDigits={2} disabled={form.subsidyPayer === "none" || form.subsidyType === "full"} onValueChange={(e) => set({ subsidyValue: e.value ?? 0 })} />
            </Field>
            <Field label={t("distribution.mp.from", "Effective from")}><Calendar value={form.effectiveFrom} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ effectiveFrom: e.value })} /></Field>
            <Field label={t("distribution.mp.to", "Effective to")}><Calendar value={form.effectiveTo} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ effectiveTo: e.value })} /></Field>
            <Field label={t("distribution.mp.clause", "Mortgagee clause")} full help={t("distribution.mp.clauseHelp", "Used when the bank has no clause of its own ({{bankName}} is replaced by the bank's name)")}>
              <InputTextarea rows={2} value={form.mortgageeClause} onChange={(e) => set({ mortgageeClause: e.target.value })} />
            </Field>
            <Field label={t("distribution.common.status", "Status")}>
              <Dropdown value={form.status} options={["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => set({ status: e.value })} />
            </Field>
            <Field label={t("distribution.common.notes", "Notes")} full><InputTextarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <DealerPremiumPreview programme={preview} onHide={() => setPreview(null)} toast={toast} />
    </div>
  );
};

export default DealerProgrammes;
