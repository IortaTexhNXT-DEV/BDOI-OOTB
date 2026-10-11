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
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import StatusChip from "../../components/StatusChip";
import service from "../../services/integrationsService";
import { loadMasterOptions } from "../Remittance/shared";
import { IntTag, PageHeader, insurerOptions, parseJson, pretty, showError, showSuccess } from "./common";

const SECTIONS = ["headerFields", "detailFields", "trailerFields"];
const FORMAT_OPTIONS = ["text", "upper", "digits", "alnum", "amount", "amount_cents", "date:YYYYMMDD", "date:MMDDYYYY", "date:MM/DD/YYYY", "date:YYYY-MM-DD", "date:MMDDYY"];
const PAYEE_TYPES = ["Insurer", "Agent/Referrer", "Customer", "Supplier"];
const EMPTY_LAYOUT = { code: "", name: "", bankCode: null, channels: ["bulk_credit"], format: "delimited", delimiter: ",", quoteValues: false, lineEnding: "CRLF", fileNamePattern: "{bankCode}_{batchNumber}_{valueDate:YYYYMMDD}.csv",
  headerFields: [], detailFields: [], trailerFields: [], statusFile: {}, maxAmountPerLine: null, active: true, description: "" };

/** Fields of one record (header, detail or trailer): name, source, constant value, width, alignment, padding, format. */
const FieldsEditor = ({ fields, sources, fixed, onChange }) => {
  const { t } = useTranslation();
  const set = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i, d) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div>
      {fields.map((f, i) => (
        <div key={i} className="flex flex-wrap gap-2 align-items-center mb-2">
          <InputText value={f.name} placeholder={t("integrations.fieldName")} aria-label={t("integrations.fieldName")} onChange={(e) => set(i, { name: e.target.value })} style={{ width: "10rem" }} />
          <Dropdown value={f.source} options={sources.map((s) => ({ label: t(`integrations.sources.${s}`, { defaultValue: s }), value: s }))} filter aria-label={t("integrations.fieldSource")}
            onChange={(e) => set(i, { source: e.value })} style={{ width: "13rem" }} />
          {f.source === "const" && <InputText value={f.value || ""} placeholder={t("integrations.constant")} aria-label={t("integrations.constant")} onChange={(e) => set(i, { value: e.target.value })} style={{ width: "8rem" }} />}
          <Dropdown value={f.format || "text"} options={FORMAT_OPTIONS.map((x) => ({ label: x, value: x }))} editable aria-label={t("integrations.fieldFormat")} onChange={(e) => set(i, { format: e.value })} style={{ width: "10rem" }} />
          <InputNumber value={f.width ?? null} placeholder={t("integrations.width")} aria-label={t("integrations.width")} min={1} max={500} onValueChange={(e) => set(i, { width: e.value ?? null })} inputStyle={{ width: "5rem" }} />
          {fixed && (
            <>
              <Dropdown value={f.align || "left"} options={["left", "right"].map((x) => ({ label: t(`integrations.align.${x}`), value: x }))} aria-label={t("integrations.alignment")} onChange={(e) => set(i, { align: e.value })} style={{ width: "7rem" }} />
              <InputText value={f.pad ?? ""} maxLength={1} placeholder={t("integrations.pad")} aria-label={t("integrations.pad")} onChange={(e) => set(i, { pad: e.target.value })} style={{ width: "4rem" }} />
            </>
          )}
          <Button icon="pi pi-arrow-up" text size="small" disabled={i === 0} aria-label={t("integrations.moveUp")} onClick={() => move(i, -1)} />
          <Button icon="pi pi-arrow-down" text size="small" disabled={i === fields.length - 1} aria-label={t("integrations.moveDown")} onClick={() => move(i, 1)} />
          <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={t("integrations.remove")} onClick={() => onChange(fields.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button icon="pi pi-plus" label={t("integrations.addField")} text size="small" onClick={() => onChange([...fields, { name: "", source: "line.amount", format: "text" }])} />
    </div>
  );
};

const clean = (fields) => fields.map((f) => Object.fromEntries(Object.entries({ name: f.name, source: f.source, value: f.source === "const" ? f.value || "" : undefined, width: f.width || undefined,
  align: f.align || undefined, pad: f.pad || undefined, format: f.format && f.format !== "text" ? f.format : undefined, map: f.map || undefined }).filter(([, v]) => v !== undefined)));

const Layouts = ({ toast, banks }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ sources: [], channels: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await service.layouts({ all: "true" });
      setRows(r.data || []);
      setMeta({ sources: r.sources || [], channels: r.channels || [] });
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const v = editing?.values;
  const set = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));
  const body = () => {
    const [statusFile, err] = parseJson(v.statusText, {});
    if (err) throw new Error(`${t("integrations.statusFile")}: ${err}`);
    return { name: v.name, bankCode: v.bankCode || null, channels: v.channels, format: v.format, delimiter: v.delimiter || ",", quoteValues: !!v.quoteValues, lineEnding: v.lineEnding, fileNamePattern: v.fileNamePattern,
      headerFields: clean(v.headerFields), detailFields: clean(v.detailFields), trailerFields: clean(v.trailerFields), statusFile: Object.keys(statusFile).length ? statusFile : null,
      maxAmountPerLine: v.maxAmountPerLine ?? null, active: !!v.active, description: v.description || null };
  };
  const save = async () => {
    try {
      const b = body();
      const r = editing.isNew ? await service.createLayout({ code: v.code, ...b }) : await service.updateLayout(v.code, b);
      showSuccess(toast, r.message);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const runPreview = async () => {
    try {
      const b = body();
      const r = await service.previewLayout({ format: b.format, delimiter: b.delimiter, quoteValues: b.quoteValues, lineEnding: b.lineEnding, fileNamePattern: b.fileNamePattern,
        headerFields: b.headerFields, detailFields: b.detailFields, trailerFields: b.trailerFields });
      setPreview(r.data);
    } catch (e) {
      showError(toast, e);
    }
  };
  const open = (l) => {
    setPreview(null);
    setEditing({ isNew: !l, values: { ...EMPTY_LAYOUT, ...(l || {}), description: l?.description || "", statusText: pretty(l?.statusFile && Object.keys(l.statusFile).length ? l.statusFile : null) } });
  };
  return (
    <>
      <div className="flex justify-content-end mb-2"><Button icon="pi pi-plus" label={t("integrations.newLayout")} onClick={() => open(null)} /></div>
      <DataTable value={rows} loading={loading} dataKey="code" size="small" stripedRows>
        <Column field="code" header={t("integrations.code")} />
        <Column header={t("integrations.name")} body={(l) => <div><div>{l.name}</div><div className="pe-muted">{l.description}</div></div>} style={{ maxWidth: "30rem" }} />
        <Column field="bankCode" header={t("integrations.bank")} />
        <Column header={t("integrations.paymentChannels")} body={(l) => l.channels.map((c) => t(`integrations.channelTypes.${c}`)).join(", ")} />
        <Column header={t("integrations.fileFormat")} body={(l) => t(`integrations.fileFormats.${l.format}`)} />
        <Column header={t("integrations.status.label")} body={(l) => <span className="flex gap-1">{l.isExample && <IntTag status="test" />}<IntTag status={l.active ? "active" : "closed"} /></span>} />
        <Column header="" body={(l) => <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.edit")} tooltip={t("integrations.edit")} tooltipOptions={{ position: "top" }} onClick={() => open(l)} />} />
      </DataTable>
      <Dialog className="pe-dialog" header={editing ? (editing.isNew ? t("integrations.newLayout") : t("integrations.editLayout", { name: v.name || v.code })) : ""} visible={!!editing} style={{ width: "min(1100px, 98vw)" }} onHide={() => setEditing(null)}
        footer={<div><Button label={t("integrations.preview")} icon="pi pi-eye" outlined onClick={runPreview} /><Button label={t("integrations.cancel")} text onClick={() => setEditing(null)} />
          <Button label={t("integrations.save")} icon="pi pi-save" onClick={save} disabled={!v?.code || !v?.name || !v?.detailFields?.length} /></div>}>
        {editing && (
          <div className="grid">
            {v.isExample && <div className="col-12"><StatusChip label={t("integrations.starterLayout")} severity="warning" /></div>}
            <div className="col-12 md:col-3"><label>{t("integrations.code")} *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.name")} *</label><InputText value={v.name} onChange={(e) => set({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("integrations.bank")}</label><Dropdown value={v.bankCode} options={banks} showClear filter onChange={(e) => set({ bankCode: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.paymentChannels")}</label>
              <MultiSelect value={v.channels} options={(meta.channels.length ? meta.channels : ["bulk_credit", "instapay", "pesonet"]).map((c) => ({ label: t(`integrations.channelTypes.${c}`), value: c }))}
                onChange={(e) => set({ channels: e.value })} className="w-full" display="chip" /></div>
            <div className="col-6 md:col-2"><label>{t("integrations.fileFormat")}</label>
              <Dropdown value={v.format} options={["delimited", "fixed"].map((x) => ({ label: t(`integrations.fileFormats.${x}`), value: x }))} onChange={(e) => set({ format: e.value })} className="w-full" /></div>
            {v.format === "delimited" && <div className="col-6 md:col-2"><label>{t("integrations.delimiter")}</label><InputText value={v.delimiter} maxLength={3} onChange={(e) => set({ delimiter: e.target.value })} className="w-full" /></div>}
            <div className="col-6 md:col-2"><label>{t("integrations.lineEnding")}</label>
              <Dropdown value={v.lineEnding} options={["CRLF", "LF"].map((x) => ({ label: x, value: x }))} onChange={(e) => set({ lineEnding: e.value })} className="w-full" /></div>
            <div className="col-6 md:col-2"><label>{t("integrations.maxPerLine")}</label><InputNumber value={v.maxAmountPerLine} min={0} onValueChange={(e) => set({ maxAmountPerLine: e.value ?? null })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("integrations.fileName")}</label><InputText value={v.fileNamePattern} onChange={(e) => set({ fileNamePattern: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4 flex gap-3 align-items-center mt-4">
              {v.format === "delimited" && <span className="flex align-items-center gap-2"><Checkbox inputId="lay-quote" checked={!!v.quoteValues} onChange={(e) => set({ quoteValues: e.checked })} />
                <label htmlFor="lay-quote" className="m-0">{t("integrations.quoteValues")}</label></span>}
              <span className="flex align-items-center gap-2"><Checkbox inputId="lay-active" checked={!!v.active} onChange={(e) => set({ active: e.checked })} /><label htmlFor="lay-active" className="m-0">{t("integrations.active")}</label></span>
            </div>
            <div className="col-12">
              <TabView>
                {SECTIONS.map((s) => (
                  <TabPanel key={s} header={t(`integrations.records.${s}`)}>
                    <FieldsEditor fields={v[s]} sources={meta.sources} fixed={v.format === "fixed"} onChange={(fields) => set({ [s]: fields })} />
                  </TabPanel>
                ))}
                <TabPanel header={t("integrations.statusFile")}>
                  <p className="pe-muted mt-0">{t("integrations.statusFileHelp")}</p>
                  <InputTextarea value={v.statusText} rows={10} onChange={(e) => set({ statusText: e.target.value })} className="w-full int-mono" />
                </TabPanel>
              </TabView>
            </div>
            <div className="col-12"><label>{t("integrations.description")}</label><InputText value={v.description} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
            {preview && (
              <div className="col-12"><label>{t("integrations.preview")}: {preview.fileName}</label><pre className="pe-pre int-mono">{preview.content}</pre></div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
};

const PayeeAccounts = ({ toast, banks }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(null);
  const [insurers, setInsurers] = useState([]);
  const [form, setForm] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.payeeAccounts({ payeeType: type }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [toast, type]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { insurerOptions().then((o) => setInsurers(o.map((x) => ({ label: x.label, value: String(x.value) })))).catch(() => null); }, []);
  const save = async () => {
    try {
      const b = { payeeType: form.payeeType, payeeId: String(form.payeeId).trim(), bankCode: form.bankCode, bankBranch: form.bankBranch || null, accountNumber: form.accountNumber.trim(), accountName: form.accountName.trim(),
        accountType: form.accountType, isDefault: !!form.isDefault, email: form.email || null, active: !!form.active };
      const r = form.id ? await service.updatePayeeAccount(form.id, b) : await service.createPayeeAccount(b);
      showSuccess(toast, r.message);
      setForm(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <>
      <div className="pe-filters mb-2">
        <Dropdown value={type} showClear placeholder={t("integrations.allPayees")} aria-label={t("integrations.payeeType")} options={PAYEE_TYPES.map((x) => ({ label: t(`integrations.payeeTypes.${x}`), value: x }))} onChange={(e) => setType(e.value)} />
        <Button icon="pi pi-plus" label={t("integrations.newPayeeAccount")} onClick={() => setForm({ payeeType: "Insurer", payeeId: "", bankCode: null, bankBranch: "", accountNumber: "", accountName: "", accountType: "current", isDefault: true, email: "", active: true })} />
      </div>
      <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("integrations.noPayeeAccounts")}>
        <Column header={t("integrations.payee")} body={(a) => <div><div>{a.payeeName}</div><div className="pe-muted">{t(`integrations.payeeTypes.${a.payeeType}`, { defaultValue: a.payeeType })} · {a.payeeId}</div></div>} />
        <Column header={t("integrations.bank")} body={(a) => a.bankName || a.bankCode} />
        <Column field="accountNumber" header={t("integrations.accountNumber")} />
        <Column field="accountName" header={t("integrations.accountName")} />
        <Column header={t("integrations.default")} body={(a) => (a.isDefault ? t("integrations.yes") : "")} />
        <Column header={t("integrations.status.label")} body={(a) => <IntTag status={a.active ? "active" : "closed"} />} />
        <Column header="" body={(a) => <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.edit")} onClick={() => setForm({ ...a, bankBranch: a.bankBranch || "", email: a.email || "" })} />} />
      </DataTable>
      <Dialog className="pe-dialog" header={form?.id ? t("integrations.editPayeeAccount") : t("integrations.newPayeeAccount")} visible={!!form} style={{ width: "min(720px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setForm(null)} /><Button label={t("integrations.save")} icon="pi pi-save" onClick={save}
          disabled={!form?.payeeId || !form?.bankCode || !form?.accountNumber || !form?.accountName} /></div>}>
        {form && (
          <div className="grid">
            <div className="col-12 md:col-4"><label>{t("integrations.payeeType")}</label>
              <Dropdown value={form.payeeType} options={PAYEE_TYPES.map((x) => ({ label: t(`integrations.payeeTypes.${x}`), value: x }))} onChange={(e) => setForm({ ...form, payeeType: e.value, payeeId: "" })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("integrations.payee")} *</label>
              {form.payeeType === "Insurer"
                ? <Dropdown value={form.payeeId} options={insurers} filter onChange={(e) => setForm({ ...form, payeeId: e.value })} className="w-full" />
                : <InputText value={form.payeeId} placeholder={t(`integrations.payeeIdHelp.${form.payeeType}`)} onChange={(e) => setForm({ ...form, payeeId: e.target.value })} className="w-full" />}
            </div>
            <div className="col-12 md:col-6"><label>{t("integrations.bank")} *</label><Dropdown value={form.bankCode} options={banks} filter onChange={(e) => setForm({ ...form, bankCode: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.bankBranch")}</label><InputText value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.accountNumber")} *</label><InputText value={form.accountNumber} maxLength={34} keyfilter={/[0-9 -]/} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.accountName")} *</label><InputText value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.accountType")}</label>
              <Dropdown value={form.accountType} options={["savings", "current"].map((x) => ({ label: t(`integrations.accountTypes.${x}`), value: x }))} onChange={(e) => setForm({ ...form, accountType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("integrations.notifyEmail")}</label><InputText value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full" /></div>
            <div className="col-12 flex gap-4">
              <span className="flex align-items-center gap-2"><Checkbox inputId="pa-default" checked={!!form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.checked })} /><label htmlFor="pa-default" className="m-0">{t("integrations.default")}</label></span>
              <span className="flex align-items-center gap-2"><Checkbox inputId="pa-active" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.checked })} /><label htmlFor="pa-active" className="m-0">{t("integrations.active")}</label></span>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
};

/**
 * Master > Finance > Bank File Layouts: how each bank's bulk credit / InstaPay / PESONet upload file is written and its
 * status file read (starter layouts for BDO, BPI, Metrobank, Landbank and UnionBank are examples to validate with the
 * bank), and the bank accounts of the payees paid by file.
 */
const BankFileLayouts = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [banks, setBanks] = useState([]);
  useEffect(() => { loadMasterOptions("bank").then(setBanks).catch(() => null); }, []);
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Master")} section={t("sidebar.Finance")} title={t("integrations.layoutsTitle")} subtitle={t("integrations.layoutsIntro")} />
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("integrations.layouts")}><Layouts toast={toast} banks={banks} /></TabPanel>
          <TabPanel header={t("integrations.payeeAccounts")}><PayeeAccounts toast={toast} banks={banks} /></TabPanel>
        </TabView>
      </div>
    </div>
  );
};

export default BankFileLayouts;
