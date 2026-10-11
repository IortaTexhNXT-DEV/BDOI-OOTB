import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { saveBlob, schemeIssuanceService as service } from "../../services/dealerSchemesService";
import mastersService from "../../services/mastersService";
import distributionService from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import RowActions from "../../components/RowActions";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import { formatValue } from "../../components/KeyValueGrid/formatValue";
import ImportDialog, { errorRows } from "../../components/ImportDialog";

const STATUS_FILTERS = ["", "draft", "documents-pending", "ready", "sent", "declined", "issued", "cancelled"];
const amount = (v) => formatValue(v, { type: "amount" });

const EMPTY = { schemeId: null, loanAccount: "", bankChannelId: null, bookingDate: "", loanTermMonths: 60, releaseDate: "", kycSource: null,
  borrower: { firstName: "", lastName: "", companyName: "", birthday: "", nationality: "Filipino", mobile: "", email: "", address: "", city: "", province: "", idType: null, idNumber: "", idType2: null, idNumber2: "" },
  dealerChannelId: null, make: "Toyota", model: "", variant: "", yearModel: new Date().getFullYear(), color: "", chassisNumber: "", engineNumber: "", conductionSticker: "", plateNumber: "",
  invoicePrice: null, insuranceCompanyId: null, araSignedOn: "", araPaymentMode: null };

/** The form of an application from what the API returns. */
export const formOf = (a) => (a ? {
  ...EMPTY, id: a.id, applicationNumber: a.applicationNumber, schemeId: a.schemeId, loanAccount: a.loanAccount || "", bankChannelId: a.bankChannelId, bookingDate: a.bookingDate || "",
  loanTermMonths: a.loanTermMonths, releaseDate: a.releaseDate || "", kycSource: a.kycSource, borrower: { ...EMPTY.borrower, ...(a.borrower || {}) }, dealerChannelId: a.dealerChannelId,
  ...Object.fromEntries(["make", "model", "variant", "yearModel", "color", "chassisNumber", "engineNumber", "conductionSticker", "plateNumber"].map((k) => [k, a.vehicle?.[k] ?? EMPTY[k]])),
  invoicePrice: a.invoicePrice, insuranceCompanyId: a.insuranceCompanyId, araSignedOn: a.araSignedOn || "", araPaymentMode: a.araPaymentMode,
} : { ...EMPTY, borrower: { ...EMPTY.borrower } });
const bodyOf = (f) => {
  const { id, applicationNumber, ...rest } = f;
  return rest;
};

/**
 * The application form (FR-SIS-001, 005): loan, borrower and KYC, dealer and vehicle, insurer and the Auto Renewal
 * Agreement of Scheme 1. A missing value saves a Draft; a wrong value is refused with the field.
 */
export const ApplicationDialog = ({ value, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(formOf(value));
  const [choices, setChoices] = useState({ schemes: [], banks: [], paymentModes: [], kycSources: [], primaryIds: [], secondaryIds: [] });
  const [insurers, setInsurers] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(formOf(value)); setErrors({}); }, [value]);
  useEffect(() => {
    (async () => {
      try {
        const [c, ins, d] = await Promise.all([service.choices(), mastersService.options("insurance-company"), distributionService.channelOptions("dealer_group,dealer_branch").catch(() => [])]);
        setChoices(c);
        setInsurers(ins.map((x) => ({ value: Number(x.id), label: x.label })));
        setDealers((d || []).map((x) => ({ value: x.id, label: x.label || x.name })));
      } catch (e) {
        notifyError(e.message);
      }
    })();
  }, []);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setB = (patch) => setForm((f) => ({ ...f, borrower: { ...f.borrower, ...patch } }));
  const scheme = choices.schemes.find((s) => s.value === form.schemeId);
  const ids = [...(choices.primaryIds || []), ...(choices.secondaryIds || [])].map((x) => ({ value: x, label: x }));
  const err = (k) => errors[k] || errors[`borrower.${k}`];
  const field = (k, label, input, col = "md:col-3") => (
    <div className={`field col-12 ${col}`} key={k}>
      <label htmlFor={`sis-${k}`}>{label}</label>
      {input}
      <FieldError error={err(k)} />
    </div>
  );
  const text = (k, label, { borrower = false, upper = false, col } = {}) => field(k, label, (
    <InputText id={`sis-${k}`} value={(borrower ? form.borrower[k] : form[k]) || ""} invalid={Boolean(err(k))}
      onChange={(e) => (borrower ? setB({ [k]: e.target.value }) : set({ [k]: upper ? e.target.value.toUpperCase() : e.target.value }))} />
  ), col);
  const date = (k, label, { borrower = false } = {}) => field(k, label, (
    <DateField id={`sis-${k}`} value={(borrower ? form.borrower[k] : form[k]) || ""} invalid={Boolean(err(k))}
      onChange={(e) => (borrower ? setB({ [k]: e.target.value }) : set({ [k]: e.target.value }))} />
  ));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = form.id ? await service.update(form.id, bodyOf(form)) : await service.create(bodyOf(form));
      notifySuccess(r.message);
      onSaved(r.data);
    } catch (e) {
      const byPath = Object.fromEntries((e.errors || []).map((x) => [x.path, x.message]));
      setErrors({ ...byPath, form: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog visible onHide={onHide} modal style={{ width: "72rem" }} breakpoints={{ "960px": "96vw" }}
      header={form.id ? t("schemeIssuance.editTitle", "Edit application {{number}}", { number: form.applicationNumber }) : t("schemeIssuance.add", "New application")}
      footer={(
        <div className="flex gap-2 justify-content-end">
          <Button label={t("common.cancel", "Cancel")} text onClick={onHide} />
          <Button label={t("schemeIssuance.save", "Save")} icon="pi pi-save" loading={saving} onClick={save} />
        </div>
      )}>
      <TabView>
        <TabPanel header={t("schemeIssuance.loan", "Scheme and loan")}>
          <div className="grid formgrid p-fluid">
            {field("schemeId", t("schemeIssuance.scheme", "Scheme"), <Dropdown inputId="sis-schemeId" value={form.schemeId} options={choices.schemes} filter
              onChange={(e) => set({ schemeId: e.value })} invalid={Boolean(err("schemeId"))} />, "md:col-6")}
            {text("loanAccount", t("schemeIssuance.loanAccount", "TFS loan account"))}
            {field("bankChannelId", t("schemeIssuance.bank", "Financing bank"), <Dropdown inputId="sis-bankChannelId" value={form.bankChannelId} options={choices.banks} showClear
              onChange={(e) => set({ bankChannelId: e.value ?? null })} invalid={Boolean(err("bankChannelId"))} />)}
            {date("bookingDate", t("schemeIssuance.bookingDate", "Loan booking date"))}
            {field("loanTermMonths", t("schemeIssuance.loanTerm", "Loan term (months)"), <InputNumber inputId="sis-loanTermMonths" value={form.loanTermMonths} useGrouping={false}
              onValueChange={(e) => set({ loanTermMonths: e.value })} invalid={Boolean(err("loanTermMonths"))} />)}
            {date("releaseDate", t("schemeIssuance.releaseDate", "Vehicle release date"))}
            {field("insuranceCompanyId", t("schemeIssuance.insurer", "Insurer"), <Dropdown inputId="sis-insuranceCompanyId" value={form.insuranceCompanyId}
              options={insurers.filter((i) => !scheme || scheme.insurerIds.includes(i.value))} onChange={(e) => set({ insuranceCompanyId: e.value })} invalid={Boolean(err("insuranceCompanyId"))} />)}
            {scheme?.schemeType !== "scheme2" ? date("araSignedOn", t("schemeIssuance.araSignedOn", "ARA signed on")) : null}
            {scheme?.schemeType !== "scheme2" ? field("araPaymentMode", t("schemeIssuance.araPaymentMode", "ARA payment mode"), <Dropdown inputId="sis-araPaymentMode" value={form.araPaymentMode}
              options={(choices.paymentModes || []).map((m) => ({ value: m.code, label: m.label }))} onChange={(e) => set({ araPaymentMode: e.value })} invalid={Boolean(err("araPaymentMode"))} />) : null}
          </div>
        </TabPanel>
        <TabPanel header={t("schemeIssuance.borrower", "Borrower and KYC")}>
          <div className="grid formgrid p-fluid">
            {text("firstName", t("schemeIssuance.firstName", "First name"), { borrower: true })}
            {text("lastName", t("schemeIssuance.lastName", "Last name"), { borrower: true })}
            {text("companyName", t("schemeIssuance.companyName", "Company name"), { borrower: true, col: "md:col-6" })}
            {date("birthday", t("schemeIssuance.birthday", "Birthday"), { borrower: true })}
            {text("nationality", t("schemeIssuance.nationality", "Nationality"), { borrower: true })}
            {text("mobile", t("schemeIssuance.mobile", "Mobile"), { borrower: true })}
            {text("email", t("schemeIssuance.email", "E-mail"), { borrower: true })}
            {text("address", t("schemeIssuance.address", "Address"), { borrower: true, col: "md:col-6" })}
            {text("city", t("schemeIssuance.city", "City"), { borrower: true })}
            {text("province", t("schemeIssuance.province", "Province"), { borrower: true })}
            {field("kycSource", t("schemeIssuance.kycSource", "KYC source"), <Dropdown inputId="sis-kycSource" value={form.kycSource} options={choices.kycSources} showClear
              placeholder={t("schemeIssuance.kycByBank", "By the financing bank")} onChange={(e) => set({ kycSource: e.value ?? null })} />)}
            {field("idType", t("schemeIssuance.idType", "ID type"), <Dropdown inputId="sis-idType" value={form.borrower.idType} options={ids} filter onChange={(e) => setB({ idType: e.value })}
              invalid={Boolean(err("idType"))} />)}
            {text("idNumber", t("schemeIssuance.idNumber", "ID number"), { borrower: true })}
            {field("idType2", t("schemeIssuance.idType2", "Second ID type"), <Dropdown inputId="sis-idType2" value={form.borrower.idType2} options={ids} filter showClear
              onChange={(e) => setB({ idType2: e.value ?? null })} />)}
            {text("idNumber2", t("schemeIssuance.idNumber2", "Second ID number"), { borrower: true })}
          </div>
        </TabPanel>
        <TabPanel header={t("schemeIssuance.vehicleTab", "Dealer and vehicle")}>
          <div className="grid formgrid p-fluid">
            {field("dealerChannelId", t("schemeIssuance.dealer", "Dealer"), <Dropdown inputId="sis-dealerChannelId" value={form.dealerChannelId} options={dealers} filter
              onChange={(e) => set({ dealerChannelId: e.value })} invalid={Boolean(err("dealerChannelId"))} />, "md:col-6")}
            {text("make", t("schemeIssuance.make", "Make"))}
            {text("model", t("schemeIssuance.model", "Model"))}
            {text("variant", t("schemeIssuance.variant", "Variant"))}
            {field("yearModel", t("schemeIssuance.yearModel", "Year model"), <InputNumber inputId="sis-yearModel" value={form.yearModel} useGrouping={false}
              onValueChange={(e) => set({ yearModel: e.value })} invalid={Boolean(err("yearModel"))} />)}
            {text("color", t("schemeIssuance.color", "Color"))}
            {text("chassisNumber", t("schemeIssuance.chassis", "Chassis number"), { upper: true })}
            {text("engineNumber", t("schemeIssuance.engine", "Engine number"), { upper: true })}
            {text("conductionSticker", t("schemeIssuance.conduction", "Conduction sticker"), { upper: true })}
            {text("plateNumber", t("schemeIssuance.plate", "Plate number"), { upper: true })}
            {field("invoicePrice", t("schemeIssuance.invoicePrice", "Invoice price (sum insured year 1)"), <InputNumber inputId="sis-invoicePrice" value={form.invoicePrice} min={0}
              minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => set({ invoicePrice: e.value })} invalid={Boolean(err("invoicePrice"))} />)}
          </div>
        </TabPanel>
      </TabView>
      {errors.form ? <FieldError error={errors.form} /> : null}
    </Dialog>
  );
};

/**
 * Operations > Sales & Marketing > Scheme Issuance (TIS-BRD-SCHM-01, CR-05): scheme applications on TFS loan documents,
 * entered one by one or from the day's loan bookings upload, priced from the Scheme Master, completed through the
 * document checklist, sent to the insurer and issued.
 */
const SchemeIssuance = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const write = hasPermission("write:scheme-issuance");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [batches, setBatches] = useState([]);
  const [importing, setImporting] = useState(false);
  const [batch, setBatch] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await service.list({ status, search });
      setRows(r.data || []);
      setCounts(r.counts || {});
    } catch (e) {
      notifyError(e.message);
    }
  }, [status, search]);
  const loadBatches = useCallback(async () => {
    try {
      setBatches(await service.bookings());
    } catch (e) {
      notifyError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  const template = async () => {
    try {
      saveBlob(await service.bookingsTemplate(), "Scheme_Loan_Bookings_Upload_Template.xlsx");
    } catch (e) {
      notifyError(e.message);
    }
  };
  const uploaded = () => {
    load();
    loadBatches();
  };

  return (
    <div className="pe-page">
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("schemeIssuance.title", "Scheme Issuance")}
        trail={[t("schemeIssuance.title", "Scheme Issuance")]}>
        {write ? <Button label={t("schemeIssuance.add", "New application")} icon="pi pi-plus" onClick={() => setCreating(true)} /> : null}
      </PageHeader>
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("schemeIssuance.applications", "Applications")}>
            <div className="flex flex-wrap gap-2 mb-3">
              <Dropdown value={status} aria-label={t("schemeIssuance.status", "Status")} onChange={(e) => setStatus(e.value)}
                options={STATUS_FILTERS.map((s) => ({ value: s, label: `${t(`schemeIssuance.filter.${s || "all"}`, s || "all")} (${counts[s || "all"] ?? 0})` }))} />
              <span className="p-input-icon-left">
                <i className="pi pi-search" />
                <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("schemeIssuance.search", "Application, borrower, loan account or chassis")}
                  aria-label={t("schemeIssuance.search", "Application, borrower, loan account or chassis")} />
              </span>
            </div>
            <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("schemeIssuance.none", "No scheme applications")}>
              <Column field="applicationNumber" header={t("schemeIssuance.number", "Application")} body={(r) => <strong>{r.applicationNumber}</strong>} />
              <Column field="schemeNo" header={t("schemeIssuance.scheme", "Scheme")} />
              <Column field="loanAccount" header={t("schemeIssuance.loanAccount", "TFS loan account")} />
              <Column field="borrowerName" header={t("schemeIssuance.borrowerName", "Borrower")} />
              <Column field="dealerName" header={t("schemeIssuance.dealer", "Dealer")} />
              <Column field="vehicleLabel" header={t("schemeIssuance.vehicle", "Vehicle")} />
              <Column header={t("schemeIssuance.premium", "Year 1 premium")} body={(r) => amount(r.grossPremium)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("schemeIssuance.documents", "Documents")} body={(r) => `${r.checklist.in} / ${r.checklist.required}`} className="bv-num" headerClassName="bv-num" />
              <Column header={t("schemeIssuance.status", "Status")} body={(r) => <StatusChip code={r.status} label={r.statusLabel} />} />
              <Column header={t("common.actions", "Actions")} body={(r) => <RowActions onView={() => navigate(`/sales/scheme-issuance/${r.id}`)} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("schemeIssuance.bookings", "Loan bookings upload")}>
            {write ? (
              <div className="flex flex-wrap gap-2 align-items-center mb-3">
                <Button label={t("schemeIssuance.uploadBookings", "Upload loan bookings")} icon="pi pi-upload" outlined onClick={() => setImporting(true)} />
                <Button label={t("schemeIssuance.template", "Download template")} icon="pi pi-download" text onClick={template} />
              </div>
            ) : null}
            <DataTable value={batches} dataKey="id" size="small" stripedRows paginator rows={20}
              emptyMessage={t("schemeIssuance.noBatches", "No uploads yet. Upload the day's loan bookings file.")}>
              <Column field="batchNumber" header={t("schemeIssuance.batch", "Batch")}
                body={(b) => <Button label={b.batchNumber} link className="p-0 font-bold" onClick={() => setBatch(b)} />} />
              <Column field="fileName" header={t("schemeIssuance.fileName", "File")} />
              <Column field="rowsTotal" header={t("schemeIssuance.rows", "Rows")} className="bv-num" headerClassName="bv-num" />
              <Column field="rowsCreated" header={t("schemeIssuance.created", "Created")} className="bv-num" headerClassName="bv-num" />
              <Column field="rowsFailed" header={t("schemeIssuance.failed", "Failed")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("schemeIssuance.status", "Status")} body={(b) => <StatusChip code={b.status} />} />
              <Column header={t("schemeIssuance.uploadedAt", "Uploaded")} body={(b) => formatValue(b.createdAt, { type: "datetime" })} style={{ whiteSpace: "nowrap" }} />
              <Column field="createdBy" header={t("schemeIssuance.uploadedBy", "Uploaded by")} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>
      <ImportDialog visible={importing} onHide={() => setImporting(false)} title={t("schemeIssuance.uploadBookings", "Upload loan bookings")} accept=".xlsx"
        fileTypes={t("schemeIssuance.fileTypes", "Excel workbook (.xlsx)")} help={t("schemeIssuance.uploadHelp", "Each row is checked and priced on its own; a failed row creates nothing.")}
        targets={[{ label: t("schemeIssuance.bookings", "Loan bookings upload"), templatePath: "/scheme-issuance/bookings/template", uploadPath: "/scheme-issuance/bookings/upload" }]}
        onUploaded={uploaded} />
      <Dialog visible={!!batch} onHide={() => setBatch(null)} modal style={{ width: "48rem" }} breakpoints={{ "960px": "96vw" }}
        header={batch ? <span className="flex align-items-center gap-2">{batch.batchNumber}<StatusChip code={batch.status} /></span> : null}
        footer={<div className="flex justify-content-start"><Button label={t("common.close", "Close")} text onClick={() => setBatch(null)} /></div>}>
        {batch ? (
          <DataTable value={errorRows(batch.errors || [])} dataKey="key" size="small" stripedRows
            emptyMessage={t("schemeIssuance.noFailedRows", "No failed rows.")}>
            <Column field="row" header={t("schemeIssuance.row", "Row")} className="bv-num" headerClassName="bv-num" style={{ width: "5rem" }} />
            <Column field="message" header={t("schemeIssuance.problem", "Problem")} />
          </DataTable>
        ) : null}
      </Dialog>
      {creating ? <ApplicationDialog value={null} onHide={() => setCreating(false)} onSaved={(a) => { setCreating(false); navigate(`/sales/scheme-issuance/${a.id}`); }} /> : null}
    </div>
  );
};

export default SchemeIssuance;
