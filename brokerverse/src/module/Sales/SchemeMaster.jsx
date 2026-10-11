import React, { useCallback, useEffect, useState } from "react";
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
import { saveBlob, schemesService as service } from "../../services/dealerSchemesService";
import mastersService from "../../services/mastersService";
import distributionService from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { openConfirm } from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import RowActions from "../../components/RowActions";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import ApprovalActions, { isInitiator } from "../../components/ApprovalActions";
import { formatValue } from "../../components/KeyValueGrid/formatValue";

const STATUS_FILTERS = ["", "active", "scheduled", "pending-approval", "draft", "suspended", "expired,withdrawn,superseded"];
const NEW_LINE = { make: "Toyota", model: "", variant: "ALL", yearFrom: new Date().getFullYear(), yearTo: new Date().getFullYear() + 1, siFrom: null, siTo: null, vehicleClass: "private_cars", odRate: null, aonRate: null };
const amount = (v) => formatValue(v, { type: "amount" });
const rate = (v) => (v === null || v === undefined ? formatValue(null, {}) : `${Number(v)}%`);
const period = (s) => `${formatValue(s.effectiveFrom, { type: "date" })} - ${formatValue(s.effectiveTo, { type: "date" })}`;

/** The body the API takes from the form. */
const bodyOf = (f) => ({
  schemeNo: f.schemeNo, schemeType: f.schemeType, description: f.description, effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo, bankChannelId: f.bankChannelId,
  allDealers: f.allDealers, dealerChannelIds: f.allDealers ? [] : f.dealerChannelIds, insurerIds: f.insurerIds, productId: f.productId, vehicleClasses: f.vehicleClasses,
  odDeductible: f.odDeductible ?? null, perils: f.perils.map(({ code, included, rate: r, limit, premium }) => ({ code, included, rate: r ?? null, limit: limit ?? null, premium: premium ?? null })),
  commissionPct: f.commissionPct ?? null, dealerCommissionPct: f.dealerCommissionPct ?? null, termYears: f.termYears, year1PaidBy: f.year1PaidBy, siSchedule: f.siSchedule, notes: f.notes || null,
  lines: f.lines.map(({ make, model, variant, yearFrom, yearTo, siFrom, siTo, vehicleClass, odRate, aonRate }) => ({
    make, model: model || null, variant: variant || null, yearFrom, yearTo, siFrom, siTo, vehicleClass, odRate: odRate ?? null, aonRate: aonRate ?? null })),
});

/**
 * Operations > Sales & Marketing > Scheme Master (TIS-BRD-SCHM-02): the Scheme 1 and Scheme 2 bundling schemes agreed
 * with TFSPH, the dealers and the insurers. A scheme is set up as a Draft (coverage, commission and the term schedule,
 * vehicle lines entered or uploaded), approved by another user, activated on its effective date by the daily job, and
 * changed only as a new version (Amend). The premium preview prices every policy year of a sample vehicle.
 */
const SchemeMaster = () => {
  const { t } = useTranslation();
  const write = hasPermission("write:schemes");
  const approve = hasPermission("approve:schemes");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState({ products: [], vehicleClasses: [], perils: [], schemeTypes: [], year1PaidBy: [], vehicles: [], standardRates: {} });
  const [insurers, setInsurers] = useState([]);
  const [channels, setChannels] = useState({ banks: [], dealers: [] });
  const [viewed, setViewed] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState({ make: "Toyota", model: "Vios", variant: "", yearModel: new Date().getFullYear(), sumInsured: 1000000, insurerId: null, result: null });
  const [upload, setUpload] = useState(null); // { scheme, mode, file, result }

  const load = useCallback(async () => {
    try {
      const r = await service.list({ status, search });
      setRows(r.data || []);
      setCounts(r.counts || {});
    } catch (e) {
      notifyError(e.message);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    (async () => {
      try {
        const [c, ins, banks, dealers] = await Promise.all([service.choices(), mastersService.options("insurance-company"),
          distributionService.channelOptions("financing_bank,bank_branch").catch(() => []), distributionService.channelOptions("dealer_group,dealer_branch").catch(() => [])]);
        setChoices(c);
        setInsurers(ins.map((x) => ({ value: Number(x.id), label: x.label })));
        const opts = (list) => (list || []).map((x) => ({ value: x.id, label: x.label || x.name }));
        setChannels({ banks: opts(banks), dealers: opts(dealers) });
      } catch (e) {
        notifyError(e.message);
      }
    })();
  }, []);

  const open = async (row) => {
    try {
      setPreview((p) => ({ ...p, result: null }));
      setViewed(await service.get(row.id));
    } catch (e) {
      notifyError(e.message);
    }
  };
  const refresh = async (id) => {
    load();
    if (id) setViewed(await service.get(id));
  };
  const perilsOf = (current = []) => choices.perils.map((p) => ({ ...p, ...(current.find((c) => c.code === p.code) || { included: p.mandatory || false }) }));
  const edit = (s) => {
    setErrors({});
    setForm(s ? { ...s, perils: perilsOf(s.perils), lines: (s.lines || []).map((l) => ({ ...NEW_LINE, ...l, make: l.brand, model: l.model || "", variant: l.variant || "ALL" })) }
      : { schemeNo: "", schemeType: "scheme1", description: "", effectiveFrom: "", effectiveTo: "", bankChannelId: null, allDealers: true, dealerChannelIds: [], insurerIds: [],
        productId: choices.products[0]?.value || null, vehicleClasses: ["private_cars"], odDeductible: null, perils: perilsOf(), commissionPct: null, dealerCommissionPct: null,
        termYears: choices.defaultTermYears || 5, year1PaidBy: "dealer", siSchedule: choices.defaultSchedule || [100, 90, 80, 70, 60], notes: "", lines: [{ ...NEW_LINE }] });
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) }));
  const setPeril = (code, patch) => setForm((f) => ({ ...f, perils: f.perils.map((p) => (p.code === code ? { ...p, ...patch } : p)) }));
  const setYears = (n) => setForm((f) => ({ ...f, termYears: n, siSchedule: Array.from({ length: n || 1 }, (_x, i) => f.siSchedule[i] ?? f.siSchedule[f.siSchedule.length - 1] ?? 100) }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = form.id ? await service.update(form.id, bodyOf(form)) : await service.create(bodyOf(form));
      notifySuccess(r.message || t("schemeMaster.saved", "Scheme saved"));
      setForm(null);
      await refresh(r.data.id);
    } catch (e) {
      const byPath = Object.fromEntries((e.errors || []).map((x) => [x.path, x.message]));
      setErrors(Object.keys(byPath).length ? { ...byPath, form: byPath.form || e.message } : { form: e.message });
    } finally {
      setSaving(false);
    }
  };

  const facts = (s) => [
    { label: t("schemeMaster.schemeNo", "Scheme No."), value: `${s.schemeNo} v${s.version}` },
    { label: t("schemeMaster.description", "Description"), value: s.description },
    { label: t("schemeMaster.period", "Effective period"), value: period(s) },
  ];
  const act = async (s, action, { reason = false, severity = null } = {}) => {
    const done = await openConfirm({
      title: t(`schemeMaster.actions.${action}Title`, `${action.charAt(0).toUpperCase()}${action.slice(1)} scheme`), severity, facts: facts(s),
      confirmLabel: t(`schemeMaster.actions.${action}`, `${action.charAt(0).toUpperCase()}${action.slice(1)}`),
      ...(reason ? { reason: { context: action === "return" ? "dealer_scheme_return" : "dealer_scheme_status" } } : {}),
      onConfirm: (why) => service.act(s.id, action, reason ? { note: why?.note || why?.reasonCode, reasonCode: why?.reasonCode } : {}),
    });
    if (!done) return;
    notifySuccess(t("schemeMaster.actionDone", "Scheme updated"));
    if (action === "amend" || action === "discard") {
      load();
      setViewed(null);
      return;
    }
    await refresh(s.id);
  };
  const remove = async (s) => {
    const done = await openConfirm({ title: t("schemeMaster.actions.deleteTitle", "Delete draft scheme"), severity: "danger", facts: facts(s),
      confirmLabel: t("schemeMaster.actions.delete", "Delete"), onConfirm: () => service.remove(s.id) });
    if (!done) return;
    setViewed(null);
    load();
  };
  const copy = async (s) => {
    const done = await openConfirm({ title: t("schemeMaster.actions.copyTitle", "Copy into a new scheme"), facts: facts(s), confirmLabel: t("schemeMaster.actions.copy", "Copy"),
      input: { type: "text", label: t("schemeMaster.newSchemeNo", "New Scheme No."), required: true },
      onConfirm: (schemeNo) => service.copy(s.id, { schemeNo: String(schemeNo || "").toUpperCase() }) });
    if (!done) return;
    notifySuccess(t("schemeMaster.copied", "Scheme copied into a new Draft"));
    load();
  };
  const runPreview = async () => {
    try {
      const r = await service.preview(viewed.id, { make: preview.make, model: preview.model, variant: preview.variant, yearModel: preview.yearModel, sumInsured: preview.sumInsured, insurerId: preview.insurerId });
      setPreview((p) => ({ ...p, result: r }));
    } catch (e) {
      notifyError(e.message);
    }
  };
  const exportList = async () => {
    try {
      saveBlob(await service.exportList({ status, search }), "schemes.xlsx");
    } catch (e) {
      notifyError(e.message);
    }
  };
  const downloadTemplate = async () => {
    try {
      saveBlob(await service.linesTemplate(), "Scheme_Vehicle_Lines_Upload_Template.xlsx");
    } catch (e) {
      notifyError(e.message);
    }
  };
  const sendUpload = async () => {
    try {
      const r = await service.uploadLines(upload.scheme.id, upload.mode, upload.file);
      setUpload((u) => ({ ...u, result: r }));
      notifySuccess(r.message);
      await refresh(upload.scheme.id);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const footer = (s) => {
    if (!s) return null;
    const mine = isInitiator({ id: s.createdById }) || isInitiator({ id: s.updatedById }) || isInitiator({ id: s.submittedById });
    return (
      <div className="flex flex-wrap gap-2 justify-content-end">
        {write && s.status === "draft" ? <Button label={t("schemeMaster.actions.edit", "Edit")} icon="pi pi-pencil" outlined onClick={() => edit(s)} /> : null}
        {write && s.status === "draft" ? <Button label={t("schemeMaster.uploadLines", "Upload vehicle lines")} icon="pi pi-upload" outlined
          onClick={() => setUpload({ scheme: s, mode: "add", file: null, result: null })} /> : null}
        {write && s.status === "draft" && s.version === 1 ? <Button label={t("schemeMaster.actions.delete", "Delete")} icon="pi pi-trash" severity="danger" text onClick={() => remove(s)} /> : null}
        {write && s.status === "draft" && s.version > 1 ? <Button label={t("schemeMaster.actions.discard", "Discard version")} icon="pi pi-trash" severity="danger" text onClick={() => act(s, "discard")} /> : null}
        {write && s.status === "draft" ? <Button label={t("schemeMaster.actions.submit", "Submit")} icon="pi pi-send" onClick={() => act(s, "submit")} /> : null}
        {write && s.status === "pending-approval" && isInitiator({ id: s.submittedById })
          ? <Button label={t("schemeMaster.actions.recall", "Recall")} icon="pi pi-undo" outlined onClick={() => act(s, "recall")} /> : null}
        {approve && s.status === "pending-approval" && !mine ? (
          <ApprovalActions initiator={{ id: s.submittedById }} approveLabel={t("schemeMaster.actions.approve", "Approve")} rejectLabel={t("schemeMaster.actions.return", "Return")}
            onApprove={() => act(s, "approve")} onReject={() => act(s, "return", { reason: true, severity: "danger" })} />
        ) : null}
        {write ? <Button label={t("schemeMaster.actions.copy", "Copy")} icon="pi pi-clone" outlined onClick={() => copy(s)} /> : null}
        {write && ["scheduled", "active", "suspended"].includes(s.status) ? <Button label={t("schemeMaster.actions.amend", "Amend")} icon="pi pi-copy" outlined onClick={() => act(s, "amend")} /> : null}
        {approve && ["scheduled", "active"].includes(s.status) ? <Button label={t("schemeMaster.actions.suspend", "Suspend")} icon="pi pi-pause" outlined onClick={() => act(s, "suspend", { reason: true })} /> : null}
        {approve && s.status === "suspended" ? <Button label={t("schemeMaster.actions.resume", "Resume")} icon="pi pi-play" outlined onClick={() => act(s, "resume", { reason: true })} /> : null}
        {approve && ["draft", "scheduled", "active", "suspended"].includes(s.status)
          ? <Button label={t("schemeMaster.actions.withdraw", "Withdraw")} icon="pi pi-ban" severity="danger" outlined onClick={() => act(s, "withdraw", { reason: true, severity: "danger" })} /> : null}
        <Button label={t("common.close", "Close")} text onClick={() => setViewed(null)} />
      </div>
    );
  };

  const scheduleTable = (s) => (
    <DataTable value={s.schedule || []} dataKey="year" size="small" stripedRows>
      <Column field="year" header={t("schemeMaster.year", "Year")} />
      <Column header={t("schemeMaster.siPct", "Sum insured %")} body={(y) => rate(y.sumInsuredPct)} className="bv-num" headerClassName="bv-num" />
      <Column header={t("schemeMaster.exampleSi", "Example sum insured (1,000,000)")} body={(y) => amount(y.exampleSumInsured)} className="bv-num" headerClassName="bv-num" />
      <Column header={t("schemeMaster.whoPays", "Who pays")} body={(y) => y.whoPaysLabel || y.whoPays} />
    </DataTable>
  );

  return (
    <div className="pe-page">
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("schemeMaster.title", "Scheme Master")}>
        <Button label={t("schemeMaster.export", "Export to Excel")} icon="pi pi-file-excel" outlined onClick={exportList} disabled={!rows.length} />
        {write ? <Button label={t("schemeMaster.add", "New scheme")} icon="pi pi-plus" disabled={!choices.perils.length} onClick={() => edit(null)} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="flex flex-wrap gap-2 mb-3">
          <Dropdown value={status} aria-label={t("schemeMaster.status", "Status")} onChange={(e) => setStatus(e.value)}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: `${t(`schemeMaster.filter.${(s || "all").split(",")[0]}`, (s || "all").split(",")[0])}${counts[s || "all"] !== undefined ? ` (${counts[s || "all"]})` : ""}` }))} />
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("schemeMaster.search", "Scheme No. or description")} aria-label={t("schemeMaster.search", "Scheme No. or description")} />
          </span>
        </div>
        <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("schemeMaster.none", "No schemes")}>
          <Column field="schemeNo" header={t("schemeMaster.schemeNo", "Scheme No.")} body={(r) => <strong>{r.schemeNo}</strong>} />
          <Column header={t("schemeMaster.schemeType", "Scheme type")} body={(r) => r.schemeTypeLabel} />
          <Column field="description" header={t("schemeMaster.description", "Description")} />
          <Column header={t("schemeMaster.period", "Effective period")} body={period} />
          <Column header={t("schemeMaster.dealers", "Dealers")} body={(r) => (r.allDealers ? t("schemeMaster.allDealers", "All dealers") : r.dealers.map((d) => d.name).join(", "))} />
          <Column header={t("schemeMaster.insurers", "Insurers")} body={(r) => r.insurers.map((i) => i.name).join(", ")} />
          <Column header={t("schemeMaster.lines", "Vehicle lines")} body={(r) => r.lineCount} className="bv-num" headerClassName="bv-num" />
          <Column header={t("schemeMaster.commission", "Commission")} body={(r) => rate(r.commissionPct)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("schemeMaster.version", "Version")} body={(r) => `v${r.version}`} />
          <Column header={t("schemeMaster.status", "Status")} body={(r) => <StatusChip code={r.status} label={r.statusLabel} />} />
          <Column header={t("common.actions", "Actions")} body={(r) => <RowActions onView={() => open(r)} />} />
        </DataTable>
      </div>

      <DetailDialog visible={Boolean(viewed)} onHide={() => setViewed(null)} size="xl" footer={footer(viewed)}
        header={viewed ? `${viewed.schemeNo} v${viewed.version} - ${viewed.description}` : ""}>
        {viewed ? (
          <TabView>
            <TabPanel header={t("schemeMaster.general", "General")}>
              <KeyValueGrid columns={4} items={[
                { label: t("schemeMaster.status", "Status"), value: <StatusChip code={viewed.status} label={viewed.statusLabel} /> },
                { label: t("schemeMaster.schemeType", "Scheme type"), value: viewed.schemeTypeLabel },
                { label: t("schemeMaster.effectiveFrom", "Effective from"), value: viewed.effectiveFrom, type: "date" },
                { label: t("schemeMaster.effectiveTo", "Effective to"), value: viewed.effectiveTo, type: "date" },
                { label: t("schemeMaster.bank", "Financing bank"), value: viewed.bankName },
                { label: t("schemeMaster.product", "Product"), value: viewed.productName },
                { label: t("schemeMaster.dealers", "Dealers"), value: viewed.allDealers ? t("schemeMaster.allDealers", "All dealers") : viewed.dealers.map((d) => d.name).join(", "), span: 2 },
                { label: t("schemeMaster.insurers", "Insurers"), value: viewed.insurers.map((i) => i.name).join(", "), span: 2 },
                { label: t("schemeMaster.vehicleClasses", "Vehicle classes"), value: viewed.vehicleClasses.map((c) => choices.vehicleClasses.find((x) => x.value === c)?.label || c).join(", "), span: 2 },
                { label: t("schemeMaster.notes", "Notes"), value: viewed.notes, span: 2 },
                { label: t("schemeMaster.createdBy", "Created by"), value: viewed.createdBy },
                { label: t("schemeMaster.submittedBy", "Submitted by"), value: viewed.submittedBy, hidden: !viewed.submittedAt },
                { label: t("schemeMaster.decidedBy", "Approved / returned by"), value: viewed.decidedBy ? `${viewed.decidedBy}, ${formatValue(viewed.decidedAt, { type: "datetime" })}` : null, hidden: !viewed.decidedAt },
                { label: t("schemeMaster.decision", "Decision note"), value: viewed.decisionNote, hidden: !viewed.decisionNote, span: 2 },
                { label: t("schemeMaster.statusReason", "Status reason"), value: viewed.statusNote, hidden: !viewed.statusNote, span: 2 },
              ]} />
              {(viewed.warnings || []).map((w) => <div key={w.message} className="bv-text-alert mt-2"><i className="pi pi-exclamation-triangle mr-2" />{w.message}</div>)}
              {viewed.changes ? <div className="bv-muted mt-2">{t("schemeMaster.changesSince", "Changed since version {{version}}: {{what}}", { version: viewed.changes.previousVersion, what: Object.keys(viewed.changes).filter((k) => k !== "previousVersion").join(", ") })}</div> : null}
            </TabPanel>
            <TabPanel header={t("schemeMaster.coverage", "Coverage")}>
              <DataTable value={viewed.perils} dataKey="code" size="small" stripedRows>
                <Column field="name" header={t("schemeMaster.peril", "Peril")} />
                <Column header={t("schemeMaster.included", "Included")} body={(p) => (p.included ? t("common.yes", "Yes") : t("common.no", "No"))} />
                <Column header={t("schemeMaster.basis", "Basis")} body={(p) => p.basisLabel} />
                <Column header={t("schemeMaster.rate", "Rate")} body={(p) => rate(p.rate)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("schemeMaster.limit", "Limit")} body={(p) => amount(p.limit)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("schemeMaster.premium", "Premium")} body={(p) => amount(p.premium)} className="bv-num" headerClassName="bv-num" />
              </DataTable>
            </TabPanel>
            <TabPanel header={t("schemeMaster.commissionTerm", "Commission & term")}>
              <KeyValueGrid columns={4} items={[
                { label: t("schemeMaster.commission", "Commission"), value: rate(viewed.commissionPct) },
                { label: t("schemeMaster.dealerShare", "Dealer share of the commission"), value: rate(viewed.dealerCommissionPct) },
                { label: t("schemeMaster.tisphShare", "TISPH share"), value: rate(viewed.tisphPct) },
                { label: t("schemeMaster.termYears", "Term (years)"), value: viewed.termYears },
                { label: t("schemeMaster.eqCommission", "Commission on OD rate"), value: rate(viewed.equivalents?.commission) },
                { label: t("schemeMaster.eqRemitting", "Remitting rate"), value: rate(viewed.equivalents?.remitting) },
                { label: t("schemeMaster.eqDealer", "Dealer rate"), value: rate(viewed.equivalents?.dealer) },
                { label: t("schemeMaster.eqTisph", "TISPH rate"), value: rate(viewed.equivalents?.tisph) },
              ]} />
              <div className="mt-3">{scheduleTable(viewed)}</div>
            </TabPanel>
            <TabPanel header={t("schemeMaster.lines", "Vehicle lines")}>
              <DataTable value={viewed.lines || []} dataKey="lineNo" size="small" stripedRows paginator rows={25}>
                <Column field="lineNo" header="#" />
                <Column field="vehicle" header={t("schemeMaster.vehicle", "Vehicle")} />
                <Column header={t("schemeMaster.yearModels", "Year models")} body={(l) => (l.yearFrom === l.yearTo ? l.yearFrom : `${l.yearFrom} - ${l.yearTo}`)} />
                <Column header={t("schemeMaster.siRange", "Sum insured")} body={(l) => `${amount(l.siFrom)} - ${amount(l.siTo)}`} />
                <Column field="vehicleClass" header={t("schemeMaster.vehicleClass", "Vehicle class")} />
                <Column header={t("schemeMaster.odRate", "OD rate")} body={(l) => rate(l.odRate)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("schemeMaster.aonRate", "AON rate")} body={(l) => rate(l.aonRate)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("schemeMaster.check", "Check")} body={(l) => (l.check === "OK" ? <StatusChip code="active" label="OK" /> : <span className="bv-text-alert">{l.check}</span>)} />
              </DataTable>
            </TabPanel>
            <TabPanel header={t("schemeMaster.preview", "Premium preview")}>
              <div className="grid formgrid p-fluid">
                {[["make", t("schemeMaster.make", "Make")], ["model", t("schemeMaster.model", "Model")], ["variant", t("schemeMaster.variant", "Variant")]].map(([k, label]) => (
                  <div className="field col-12 md:col-2" key={k}>
                    <label htmlFor={`sch-pv-${k}`}>{label}</label>
                    <InputText id={`sch-pv-${k}`} value={preview[k]} onChange={(e) => setPreview((p) => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="field col-12 md:col-2">
                  <label htmlFor="sch-pv-year">{t("schemeMaster.yearModel", "Year model")}</label>
                  <InputNumber inputId="sch-pv-year" value={preview.yearModel} useGrouping={false} onValueChange={(e) => setPreview((p) => ({ ...p, yearModel: e.value }))} />
                </div>
                <div className="field col-12 md:col-2">
                  <label htmlFor="sch-pv-si">{t("schemeMaster.sumInsured", "Sum insured")}</label>
                  <InputNumber inputId="sch-pv-si" value={preview.sumInsured} min={0} onValueChange={(e) => setPreview((p) => ({ ...p, sumInsured: e.value }))} />
                </div>
                <div className="field col-12 md:col-2">
                  <label htmlFor="sch-pv-ins">{t("schemeMaster.insurer", "Insurer")}</label>
                  <Dropdown inputId="sch-pv-ins" value={preview.insurerId} showClear options={insurers.filter((i) => viewed.insurerIds.includes(i.value))}
                    onChange={(e) => setPreview((p) => ({ ...p, insurerId: e.value ?? null }))} />
                </div>
              </div>
              <Button label={t("schemeMaster.runPreview", "Preview premiums")} icon="pi pi-calculator" onClick={runPreview} />
              {preview.result ? (
                <DataTable value={preview.result.years} dataKey="year" size="small" stripedRows className="mt-3">
                  <Column field="year" header={t("schemeMaster.year", "Year")} />
                  {["sumInsured", "ownDamage", "actsOfNature", "netPremium", "vat", "dst", "lgt", "ctpl", "grossPremium", "commission", "dealerShare", "tisphShare"].map((k) => (
                    <Column key={k} header={t(`schemeMaster.pv.${k}`, k)} body={(y) => amount(y[k])} className="bv-num" headerClassName="bv-num" />
                  ))}
                </DataTable>
              ) : null}
            </TabPanel>
            {viewed.versions?.length > 1 ? (
              <TabPanel header={t("schemeMaster.versions", "Versions")}>
                <DataTable value={viewed.versions} dataKey="id" size="small">
                  <Column header={t("schemeMaster.version", "Version")} body={(v) => `v${v.version}`} />
                  <Column header={t("schemeMaster.status", "Status")} body={(v) => <StatusChip code={v.status} label={v.statusLabel} />} />
                  <Column header={t("schemeMaster.period", "Effective period")} body={period} />
                  <Column header={t("common.actions", "Actions")} body={(v) => (v.id === viewed.id ? null : <RowActions onView={() => open(v)} />)} />
                </DataTable>
              </TabPanel>
            ) : null}
          </TabView>
        ) : null}
      </DetailDialog>

      <Dialog visible={Boolean(form)} onHide={() => setForm(null)} modal style={{ width: "76rem" }} breakpoints={{ "960px": "96vw" }}
        header={form?.id ? t("schemeMaster.editTitle", "Edit {{schemeNo}} v{{version}}", { schemeNo: form.schemeNo, version: form.version }) : t("schemeMaster.add", "New scheme")}
        footer={(
          <div className="flex gap-2 justify-content-end">
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setForm(null)} />
            <Button label={t("schemeMaster.saveDraft", "Save draft")} icon="pi pi-save" loading={saving} onClick={save} />
          </div>
        )}>
        {form ? (
          <TabView>
            <TabPanel header={t("schemeMaster.general", "General")}>
              <div className="grid formgrid p-fluid">
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-no">{t("schemeMaster.schemeNo", "Scheme No.")}</label>
                  <InputText id="sch-no" value={form.schemeNo} disabled={Boolean(form.id)} onChange={(e) => set({ schemeNo: e.target.value.toUpperCase() })} invalid={Boolean(errors.schemeNo)} />
                  <FieldError error={errors.schemeNo} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-type">{t("schemeMaster.schemeType", "Scheme type")}</label>
                  <Dropdown inputId="sch-type" value={form.schemeType} disabled={form.version > 1} options={choices.schemeTypes} onChange={(e) => set({ schemeType: e.value })} />
                </div>
                <div className="field col-12 md:col-6">
                  <label htmlFor="sch-desc">{t("schemeMaster.description", "Description")}</label>
                  <InputText id="sch-desc" value={form.description} onChange={(e) => set({ description: e.target.value })} invalid={Boolean(errors.description)} />
                  <FieldError error={errors.description} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-from">{t("schemeMaster.effectiveFrom", "Effective from")}</label>
                  <DateField id="sch-from" value={form.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} invalid={Boolean(errors.effectiveFrom)} />
                  <FieldError error={errors.effectiveFrom} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-to">{t("schemeMaster.effectiveTo", "Effective to")}</label>
                  <DateField id="sch-to" value={form.effectiveTo} onChange={(e) => set({ effectiveTo: e.target.value })} invalid={Boolean(errors.effectiveTo)} />
                  <FieldError error={errors.effectiveTo} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-bank">{t("schemeMaster.bank", "Financing bank")}</label>
                  <Dropdown inputId="sch-bank" value={form.bankChannelId} options={channels.banks} filter onChange={(e) => set({ bankChannelId: e.value })} invalid={Boolean(errors.bankChannelId)} />
                  <FieldError error={errors.bankChannelId} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-product">{t("schemeMaster.product", "Product")}</label>
                  <Dropdown inputId="sch-product" value={form.productId} options={choices.products} onChange={(e) => set({ productId: e.value })} />
                </div>
                <div className="field-checkbox col-12 md:col-3">
                  <Checkbox inputId="sch-all" checked={form.allDealers} onChange={(e) => set({ allDealers: e.checked })} />
                  <label htmlFor="sch-all">{t("schemeMaster.allDealers", "All dealers")}</label>
                </div>
                {!form.allDealers ? (
                  <div className="field col-12 md:col-9">
                    <label htmlFor="sch-dealers">{t("schemeMaster.dealers", "Dealers")}</label>
                    <MultiSelect inputId="sch-dealers" value={form.dealerChannelIds} options={channels.dealers} filter display="chip" onChange={(e) => set({ dealerChannelIds: e.value })}
                      invalid={Boolean(errors.dealerChannelIds)} />
                    <FieldError error={errors.dealerChannelIds} />
                  </div>
                ) : null}
                <div className="field col-12 md:col-6">
                  <label htmlFor="sch-insurers">{t("schemeMaster.insurers", "Insurers")}</label>
                  <MultiSelect inputId="sch-insurers" value={form.insurerIds} options={insurers} filter display="chip" onChange={(e) => set({ insurerIds: e.value })} invalid={Boolean(errors.insurerIds)} />
                  <FieldError error={errors.insurerIds} />
                </div>
                <div className="field col-12 md:col-6">
                  <label htmlFor="sch-classes">{t("schemeMaster.vehicleClasses", "Vehicle classes")}</label>
                  <MultiSelect inputId="sch-classes" value={form.vehicleClasses} options={choices.vehicleClasses} display="chip" onChange={(e) => set({ vehicleClasses: e.value })} />
                </div>
                <div className="field col-12">
                  <label htmlFor="sch-notes">{t("schemeMaster.notes", "Notes")}</label>
                  <InputTextarea id="sch-notes" rows={2} value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
                </div>
              </div>
            </TabPanel>
            <TabPanel header={t("schemeMaster.coverage", "Coverage")}>
              <KeyValueGrid columns={4} items={[
                { label: t("schemeMaster.standardOd", "Standard OD rate"), value: rate(choices.standardRates?.ownDamage) },
                { label: t("schemeMaster.standardAon", "Standard AON rate"), value: rate(choices.standardRates?.actsOfNature) },
              ]} />
              <DataTable value={form.perils} dataKey="code" size="small" className="mt-2">
                <Column field="name" header={t("schemeMaster.peril", "Peril")} />
                <Column header={t("schemeMaster.included", "Included")} body={(p) => (
                  <Checkbox checked={Boolean(p.included)} disabled={p.mandatory} onChange={(e) => setPeril(p.code, { included: e.checked })} aria-label={p.name} />
                )} />
                <Column header={t("schemeMaster.basis", "Basis")} body={(p) => p.basisLabel} />
                {["rate", "limit", "premium"].map((k) => (
                  <Column key={k} header={t(`schemeMaster.${k}`, k)} body={(p) => (p.code === "CTPL" ? null : (
                    <InputNumber value={p[k] ?? null} disabled={!p.included} maxFractionDigits={4} onValueChange={(e) => setPeril(p.code, { [k]: e.value })} inputStyle={{ width: "7rem" }}
                      aria-label={`${p.name} ${k}`} />
                  ))} />
                ))}
              </DataTable>
              {errors.perils ? <FieldError error={errors.perils} /> : null}
            </TabPanel>
            <TabPanel header={t("schemeMaster.commissionTerm", "Commission & term")}>
              <div className="grid formgrid p-fluid">
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-comm">{t("schemeMaster.commission", "Commission")} %</label>
                  <InputNumber inputId="sch-comm" value={form.commissionPct} min={0} max={100} maxFractionDigits={2} onValueChange={(e) => set({ commissionPct: e.value })} invalid={Boolean(errors.commissionPct)} />
                  <FieldError error={errors.commissionPct} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-dealer">{t("schemeMaster.dealerShare", "Dealer share of the commission")} %</label>
                  <InputNumber inputId="sch-dealer" value={form.dealerCommissionPct} min={0} max={100} maxFractionDigits={2} onValueChange={(e) => set({ dealerCommissionPct: e.value })}
                    invalid={Boolean(errors.dealerCommissionPct)} />
                  <FieldError error={errors.dealerCommissionPct} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="sch-term">{t("schemeMaster.termYears", "Term (years)")}</label>
                  <InputNumber inputId="sch-term" value={form.termYears} min={1} max={choices.maxTermYears || 5} useGrouping={false} onValueChange={(e) => setYears(e.value)} invalid={Boolean(errors.termYears)} />
                  <FieldError error={errors.termYears} />
                </div>
                {form.schemeType === "scheme1" ? (
                  <div className="field col-12 md:col-3">
                    <label htmlFor="sch-y1">{t("schemeMaster.year1PaidBy", "Year 1 paid by")}</label>
                    <Dropdown inputId="sch-y1" value={form.year1PaidBy} options={choices.year1PaidBy} onChange={(e) => set({ year1PaidBy: e.value })} />
                  </div>
                ) : null}
                {form.siSchedule.map((v, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className="field col-6 md:col-2" key={`y${i}`}>
                    <label htmlFor={`sch-si-${i}`}>{t("schemeMaster.yearSi", "Year {{year}} sum insured %", { year: i + 1 })}</label>
                    <InputNumber inputId={`sch-si-${i}`} value={v} min={1} max={100} onValueChange={(e) => set({ siSchedule: form.siSchedule.map((x, n) => (n === i ? e.value : x)) })} />
                  </div>
                ))}
                {errors.siSchedule ? <div className="col-12"><FieldError error={errors.siSchedule} /></div> : null}
              </div>
            </TabPanel>
            <TabPanel header={t("schemeMaster.lines", "Vehicle lines")}>
              <DataTable value={form.lines} size="small" dataKey="lineNo">
                <Column header="#" body={(_l, o) => o.rowIndex + 1} />
                {["make", "model", "variant"].map((k) => (
                  <Column key={k} header={t(`schemeMaster.${k}`, k)} body={(l, o) => (
                    <InputText value={l[k] || ""} onChange={(e) => setLine(o.rowIndex, { [k]: e.target.value })} style={{ width: "8rem" }} aria-label={t(`schemeMaster.${k}`, k)} />
                  )} />
                ))}
                {["yearFrom", "yearTo"].map((k) => (
                  <Column key={k} header={t(`schemeMaster.${k}`, k)} body={(l, o) => (
                    <InputNumber value={l[k]} useGrouping={false} onValueChange={(e) => setLine(o.rowIndex, { [k]: e.value })} inputStyle={{ width: "5rem" }} aria-label={t(`schemeMaster.${k}`, k)} />
                  )} />
                ))}
                {["siFrom", "siTo"].map((k) => (
                  <Column key={k} header={t(`schemeMaster.${k}`, k)} body={(l, o) => (
                    <InputNumber value={l[k]} min={0} onValueChange={(e) => setLine(o.rowIndex, { [k]: e.value })} inputStyle={{ width: "8rem" }} aria-label={t(`schemeMaster.${k}`, k)} />
                  )} />
                ))}
                <Column header={t("schemeMaster.vehicleClass", "Vehicle class")} body={(l, o) => (
                  <Dropdown value={l.vehicleClass} options={choices.vehicleClasses.filter((c) => form.vehicleClasses.includes(c.value))} onChange={(e) => setLine(o.rowIndex, { vehicleClass: e.value })}
                    aria-label={t("schemeMaster.vehicleClass", "Vehicle class")} />
                )} />
                {["odRate", "aonRate"].map((k) => (
                  <Column key={k} header={t(`schemeMaster.${k}`, k)} body={(l, o) => (
                    <InputNumber value={l[k]} maxFractionDigits={4} onValueChange={(e) => setLine(o.rowIndex, { [k]: e.value })} inputStyle={{ width: "5rem" }} aria-label={t(`schemeMaster.${k}`, k)} />
                  )} />
                ))}
                <Column body={(_l, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("schemeMaster.removeLine", "Remove line")}
                  onClick={() => set({ lines: form.lines.filter((_x, n) => n !== o.rowIndex) })} />} />
              </DataTable>
              <Button label={t("schemeMaster.addLine", "Add line")} icon="pi pi-plus" text className="mt-2" onClick={() => set({ lines: [...form.lines, { ...NEW_LINE }] })} />
              {errors.lines ? <FieldError error={errors.lines} /> : null}
            </TabPanel>
          </TabView>
        ) : null}
        {errors.form ? <FieldError error={errors.form} /> : null}
      </Dialog>

      <Dialog visible={Boolean(upload)} onHide={() => setUpload(null)} modal style={{ width: "40rem" }} breakpoints={{ "640px": "96vw" }}
        header={t("schemeMaster.uploadLines", "Upload vehicle lines")}
        footer={(
          <div className="flex gap-2 justify-content-end">
            <Button label={t("schemeMaster.template", "Download template")} icon="pi pi-download" text onClick={downloadTemplate} />
            <Button label={t("common.close", "Close")} text onClick={() => setUpload(null)} />
            <Button label={t("schemeMaster.upload", "Upload")} icon="pi pi-upload" disabled={!upload?.file} onClick={sendUpload} />
          </div>
        )}>
        {upload ? (
          <div className="flex flex-column gap-3">
            <div>{upload.scheme.schemeNo} v{upload.scheme.version}</div>
            <Dropdown value={upload.mode} aria-label={t("schemeMaster.uploadMode", "Upload mode")} onChange={(e) => setUpload((u) => ({ ...u, mode: e.value }))}
              options={[{ value: "add", label: t("schemeMaster.modeAdd", "Add to the lines") }, { value: "replace", label: t("schemeMaster.modeReplace", "Replace all lines") }]} />
            <input type="file" accept=".xlsx" aria-label={t("schemeMaster.file", "File")} onChange={(e) => setUpload((u) => ({ ...u, file: e.target.files?.[0] || null }))} />
            {upload.result ? (
              <div>
                <strong>{upload.result.message}</strong>
                {(upload.result.data?.errors || []).map((x) => <div key={x.text} className="bv-text-alert">{x.text}</div>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default SchemeMaster;
