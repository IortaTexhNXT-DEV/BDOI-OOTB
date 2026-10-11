import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import CommissionService from "../../../services/commissionService";
import numberingService from "../../../services/numberingService";
import { formatDate } from "../../../utility/dateFormat";
import DateField from "../../../components/DateField";
import PageHeader from "../../../components/PageHeader";
import RowActions, { actionsColumn } from "../../../components/RowActions";
import StatusChip from "../../../components/StatusChip";
import ConfirmDialog, { openConfirm } from "../../../components/ConfirmDialog";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { hasPermission } from "../../../utils/canOpen";
import { formatAmount } from "../utils/formatAmount";
import "../../Administration/index.scss";
import "./style.scss";

const STATUSES = ["all", "active", "scheduled", "pending", "draft", "returned", "suspended", "ended"];
const STATUS_CODE = { active: "active", scheduled: "scheduled", pending: "for-approval", draft: "draft", returned: "returned", suspended: "on-hold", superseded: "superseded", ended: "closed", withdrawn: "cancelled" };
const PERILS = ["OD", "AON", "BI", "PD", "APPA"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY_LINE = { paidTo: "referrer", basis: "variance", perils: ["OD", "AON"], defaultValue: null, min: 0, max: null, addToReferrer: false };
const EMPTY = { code: "", name: "", partyTypes: [], productIds: [], insurerIds: [], policyType: "any", effectiveFrom: "", effectiveTo: "", payWhenFullyPaid: true, combineWithReferrer: false, lines: [], remarks: "" };
const valueText = (l) => (l.basis === "variance" ? `${l.defaultValue} pt` : l.basis === "fixed" ? formatAmount(l.defaultValue) : `${l.defaultValue}%`);

/**
 * Commission > Sharing Schemes: who is paid what of the commission of a policy. A scheme has split lines (paid to the
 * referrer, its parent or the channel; variance to the TIS remitting rate, % of commission, % of net premium or a
 * fixed amount; default, minimum and maximum), is approved on Configuration Approvals, assigned to referrers and
 * distribution channels with an override inside its limits, and suspended, resumed or ended by an approver.
 */
const SharingSchemes = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`sharingSchemes.${key}`, opts);
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState({ partyTypes: [], shareBases: [], paidTo: [], approvalRequired: false });
  const [products, setProducts] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [filter, setFilter] = useState({ status: "all", search: "" });
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState(0);
  const [errors, setErrors] = useState({});
  const [example, setExample] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [assign, setAssign] = useState(null);
  const [ending, setEnding] = useState(null);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:sharing-schemes");
  const canApprove = hasPermission("approve:sharing-schemes");
  const review = options.approvalRequired;

  const error = (e) => toast.current?.show({ severity: "error", summary: k("title"), detail: e?.response?.data?.message || e.message, life: 6000 });
  const success = (detail) => toast.current?.show({ severity: "success", summary: k("title"), detail, life: 4000 });

  const load = useCallback(() => {
    setLoading(true);
    return CommissionService.listSchemes({ status: filter.status === "all" ? "all" : filter.status })
      .then((d) => setRows(d?.data || d || []))
      .catch(error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const opts = (list) => list.map((o) => ({ label: o.label, value: o.value }));
    CommissionService.schemeOptions().then((d) => setOptions(d?.data || d)).catch(() => {});
    numberingService.options("product").then((l) => setProducts(opts(l))).catch(() => {});
    numberingService.options("insurance-company").then((l) => setInsurers(opts(l))).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return q ? rows.filter((r) => [r.code, r.name].some((v) => String(v || "").toLowerCase().includes(q))) : rows;
  }, [rows, filter.search]);

  const partyOptions = (options.partyTypes || []).map((p) => ({ label: k(`partyTypes.${p}`, { defaultValue: p }), value: p }));
  const basisOptions = (options.shareBases || []).map((b) => ({ label: k(`bases.${b.code}`, { defaultValue: b.label }), value: b.code }));
  const paidToOptions = (options.paidTo || []).map((p) => ({ label: k(`paidTo.${p.code}`, { defaultValue: p.label }), value: p.code }));
  const policyTypeOptions = ["any", "new", "renewal"].map((p) => ({ label: t(`numberingMasters.commissionRates.policyTypes.${p}`), value: p }));

  const openAdd = () => { setErrors({}); setTab(0); setExample(null); setAssignments(null); setEdit({ ...EMPTY, effectiveFrom: todayIso() }); };
  const openEdit = async (r, { copy = false } = {}) => {
    setErrors({});
    setTab(0);
    setExample(null);
    setEdit({ ...r, ...(copy ? { id: null, code: "", status: "draft", version: 1, pendingChangeId: null, effectiveFrom: todayIso(), effectiveTo: "" } : {}), effectiveTo: copy ? "" : r.effectiveTo || "", remarks: r.remarks || "",
      lines: (r.lines || []).map((l) => ({ ...l })), amend: !copy && ["active", "scheduled", "suspended"].includes(r.status) && review });
    setAssignments(copy ? null : await CommissionService.schemeAssignments(r.code).then((d) => d?.data || d).catch(() => null));
  };
  const set = (key, value) => setEdit((e) => ({ ...e, [key]: value }));
  const setLine = (i, key, value) => setEdit((e) => ({ ...e, lines: e.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }));

  const validate = (v) => {
    const e = {};
    if (!v.code.trim()) e.code = k("errors.codeBlank");
    else if (!/^[A-Z0-9-]{3,20}$/.test(v.code.trim().toUpperCase())) e.code = k("errors.codeFormat");
    if (!v.name.trim()) e.name = k("errors.nameBlank");
    if (!v.partyTypes.length) e.partyTypes = k("errors.partyBlank");
    if (!v.productIds.length) e.productIds = k("errors.productBlank");
    if (!v.effectiveFrom) e.effectiveFrom = t("numberingMasters.commissionRates.fromRequired");
    for (const l of v.lines) {
      if (l.defaultValue === null || l.defaultValue === undefined) e.lines = k("errors.defaultBlank");
      else if (l.max !== null && l.max !== undefined && Number(l.min || 0) > Number(l.max)) e.lines = k("errors.minAboveMax");
      else if (Number(l.defaultValue) < Number(l.min || 0) || (l.max !== null && l.max !== undefined && Number(l.defaultValue) > Number(l.max))) e.lines = k("errors.defaultOutside");
    }
    return e;
  };
  const bodyOf = (v, submit) => ({ code: v.code.trim().toUpperCase(), name: v.name.trim(), partyTypes: v.partyTypes, productIds: v.productIds, insurerIds: v.insurerIds || [], policyType: v.policyType,
    effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo || null, payWhenFullyPaid: !!v.payWhenFullyPaid, combineWithReferrer: !!v.combineWithReferrer, remarks: v.remarks || null,
    lines: v.lines.map((l) => ({ paidTo: l.paidTo, basis: l.basis, perils: l.perils, defaultValue: l.defaultValue, min: l.min ?? 0, max: l.max ?? null, addToReferrer: !!l.addToReferrer })),
    ...(submit ? { submit: true } : {}) });

  const save = async ({ submit = false } = {}) => {
    const e = validate(edit);
    if (submit && !edit.lines.length) e.lines = k("errors.noLine");
    setErrors(e);
    if (Object.keys(e).length) { setTab(e.lines ? 1 : 0); return; }
    setSaving(true);
    try {
      const saved = edit.id ? await CommissionService.updateScheme(edit.id, bodyOf(edit, submit)) : await CommissionService.createScheme(bodyOf(edit, submit));
      const s = saved?.data || saved;
      success(s.status === "pending" ? k("submitted") : k("saved"));
      setEdit(null);
      load();
    } catch (err) {
      error(err);
    } finally {
      setSaving(false);
    }
  };

  const showExample = async () => {
    try {
      const d = await CommissionService.schemeExample({ lines: edit.lines.filter((l) => l.defaultValue !== null && l.defaultValue !== undefined) });
      setExample(d?.data || d);
    } catch (err) {
      error(err);
    }
  };

  const facts = (r) => [
    { label: k("columns.code"), value: r.code },
    { label: k("columns.name"), value: r.name },
    { label: k("columns.status"), value: r.statusLabel },
    { label: k("columns.assignments"), value: (r.assignments?.referrers || 0) + (r.assignments?.channels || 0), type: "number" },
  ];
  const act = async (code, r) => {
    try {
      if (code === "view") return openEdit(r);
      if (code === "copy") return openEdit(r, { copy: true });
      if (code === "assignments") { await openEdit(r); setTab(2); return null; }
      if (code === "submit") {
        if (!(await openConfirm({ title: k("submitTitle"), message: k("submitMessage"), facts: facts(r), confirmLabel: k("submitAction"), onConfirm: () => CommissionService.schemeAction(r.id, "submit") }))) return null;
        success(k("submitted"));
      } else if (code === "withdraw") {
        if (!(await openConfirm({ title: k("withdrawTitle"), severity: "warning", message: k("withdrawMessage"), facts: facts(r), confirmLabel: k("withdrawAction"), onConfirm: () => CommissionService.schemeAction(r.id, "withdraw") }))) return null;
        success(k("withdrawn"));
      } else if (code === "suspend") {
        const note = await openConfirm({ title: k("suspendTitle"), severity: "warning", message: k("suspendMessage"), facts: facts(r), input: { type: "textarea", label: k("remark"), required: true, minLength: 3, maxLength: 500 }, confirmLabel: k("suspendAction") });
        if (!note) return null;
        await CommissionService.schemeAction(r.id, "suspend", { note });
        success(k("suspended"));
      } else if (code === "resume") {
        if (!(await openConfirm({ title: k("resumeTitle"), message: k("resumeMessage"), facts: facts(r), confirmLabel: k("resumeAction"), onConfirm: () => CommissionService.schemeAction(r.id, "resume") }))) return null;
        success(k("resumed"));
      } else if (code === "end") {
        setEnding({ scheme: r, replacementCode: null, confirmNoSharing: false });
        return null;
      }
      return load();
    } catch (err) {
      return error(err);
    }
  };
  const actionsOf = (r) => {
    const s = r.status;
    const list = [{ code: "view", label: canWrite && ["draft", "returned", "withdrawn"].includes(s) ? t("numberingMasters.edit") : k("view"), allowed: true }];
    list.push({ code: "assignments", label: k("tabs.assignments"), allowed: true });
    if (canWrite) {
      if (review && ["draft", "returned", "withdrawn"].includes(s)) list.push({ code: "submit", label: k("submitAction"), allowed: true });
      if (review && s === "pending") list.push({ code: "withdraw", label: k("withdrawAction"), allowed: true });
      list.push({ code: "copy", label: k("copy"), allowed: true });
    }
    if (canApprove) {
      if (["active", "scheduled"].includes(s)) list.push({ code: "suspend", label: k("suspendAction"), allowed: true });
      if (s === "suspended") list.push({ code: "resume", label: k("resumeAction"), allowed: true });
      if (["active", "scheduled", "suspended"].includes(s)) list.push({ code: "end", label: k("endAction"), allowed: true });
    }
    return list;
  };

  const loadPayees = () => {
    if (!referrers.length) CommissionService.getReferrerAccounts().then((d) => setReferrers(((d?.data || d)?.referrers || []).map((r) => ({ label: `${r.name} (${r.type})`, value: r.id })))).catch(() => {});
    if (!channels.length) CommissionService.listChannels({ status: "active" }).then((d) => setChannels(((d?.data || d) || []).map((c) => ({ label: c.path || c.name, value: c.id })))).catch(() => {});
  };
  const openAssign = () => { loadPayees(); setAssign({ kind: "referrer", referrerId: null, channelId: null, override: null, note: "" }); };
  const doAssign = async () => {
    try {
      const r = await CommissionService.assignScheme({ referrerId: assign.kind === "referrer" ? assign.referrerId : null, channelId: assign.kind === "channel" ? assign.channelId : null,
        schemeCode: edit.code, override: assign.override, note: assign.note || null });
      const d = r?.data || r;
      success(d.pending ? k("assignSubmitted") : k("assigned"));
      setAssign(null);
      setAssignments(await CommissionService.schemeAssignments(edit.code).then((x) => x?.data || x).catch(() => assignments));
    } catch (err) {
      error(err);
    }
  };

  const linesCell = (r) => (r.lines || []).map((l) => `${k(`paidTo.${l.paidTo}`, { defaultValue: l.paidToLabel })}: ${valueText(l)} (${l.min ?? 0}–${l.max ?? k("open")})`).join("; ");
  const statusCell = (r) => <StatusChip code={STATUS_CODE[r.status] || r.status} label={r.statusLabel} />;

  return (
    <div className="admin__page dn__page ss__page">
      <Toast ref={toast} />
      <PageHeader title={k("title")} home={t("commissionLine.commission")} trail={[k("title")]} help={k("help")}
        actions={canWrite ? <Button label={k("add")} icon="pi pi-plus" onClick={openAdd} /> : null} />
      <div className="dn__toolbar">
        <span className="p-input-icon-left dn__search">
          <i className="pi pi-search" />
          <InputText value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder={t("numberingMasters.search")} aria-label={t("numberingMasters.search")} />
        </span>
        <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: s === "all" ? t("numberingMasters.all") : k(`statuses.${s}`), value: s }))} onChange={(e) => setFilter((f) => ({ ...f, status: e.value }))} className="dn__filter" aria-label={k("columns.status")} />
      </div>
      <DataTable value={visible} dataKey="id" loading={loading} stripedRows size="small" paginator rows={20} emptyMessage={k("empty")} className="dn__table" responsiveLayout="scroll">
        <Column field="code" header={k("columns.code")} sortable />
        <Column field="name" header={k("columns.name")} sortable />
        <Column header={k("columns.partyTypes")} body={(r) => (r.partyTypes || []).map((p) => k(`partyTypes.${p}`, { defaultValue: p })).join(", ")} />
        <Column header={k("columns.products")} body={(r) => (r.productNames || []).join(", ")} />
        <Column header={k("columns.lines")} body={linesCell} />
        <Column header={k("columns.assignments")} body={(r) => (r.assignments?.referrers || 0) + (r.assignments?.channels || 0)} className="dn__right" headerClassName="dn__right" />
        <Column header={k("columns.effective")} body={(r) => `${formatDate(r.effectiveFrom)} – ${r.effectiveTo ? formatDate(r.effectiveTo) : k("open")}`} />
        <Column header={k("columns.version")} body={(r) => `v${r.version}`} />
        <Column header={k("columns.status")} body={statusCell} />
        <Column header="" body={(r) => <RowActions label={k("actionsFor", { code: r.code })} actions={actionsOf(r)} onAction={(a) => act(a.code, r)} />} {...actionsColumn} style={{ width: "4rem" }} />
      </DataTable>

      <Dialog header={edit?.id ? (edit.amend ? k("amendTitle", { code: edit.code }) : k("editTitle", { code: edit.code })) : k("addTitle")} visible={!!edit} onHide={() => setEdit(null)} style={{ width: "min(960px, 96vw)" }}
        footer={
          <div>
            <Button label={t("numberingMasters.cancel")} text onClick={() => setEdit(null)} />
            {review ? (
              <>
                <Button label={k("saveDraft")} icon="pi pi-save" outlined onClick={() => save()} loading={saving} disabled={!canWrite || edit?.status === "pending"} />
                <Button label={k("submitAction")} icon="pi pi-send" onClick={() => save({ submit: true })} loading={saving} disabled={!canWrite || edit?.status === "pending"} />
              </>
            ) : <Button label={t("numberingMasters.save")} icon="pi pi-check" onClick={() => save()} loading={saving} disabled={!canWrite} />}
          </div>
        }>
        {edit && (
          <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
            <TabPanel header={k("tabs.general")}>
              <div className="dn__form">
                {edit.status ? (
                  <div className="ss__status-line">
                    <StatusChip code={STATUS_CODE[edit.status] || edit.status} label={edit.statusLabel} />
                    {edit.version ? <span className="dn__muted">{t("numberingMasters.commissionRates.versionN", { version: edit.version })}</span> : null}
                    {edit.amend ? <span className="dn__muted">{k("amendNote")}</span> : null}
                  </div>
                ) : null}
                <div className="admin__grid">
                  <div className="admin__field">
                    <label htmlFor="ss-code">{k("columns.code")}</label>
                    <InputText id="ss-code" value={edit.code} disabled={!!edit.id} onChange={(e) => set("code", e.target.value.toUpperCase())} className={errors.code ? "p-invalid" : undefined} />
                    {errors.code ? <small className="dn__error">{errors.code}</small> : null}
                  </div>
                  <div className="admin__field">
                    <label htmlFor="ss-name">{k("columns.name")}</label>
                    <InputText id="ss-name" value={edit.name} onChange={(e) => set("name", e.target.value)} className={errors.name ? "p-invalid" : undefined} />
                    {errors.name ? <small className="dn__error">{errors.name}</small> : null}
                  </div>
                  <div className="admin__field">
                    <label htmlFor="ss-party">{k("columns.partyTypes")}</label>
                    <MultiSelect inputId="ss-party" value={edit.partyTypes} options={partyOptions} onChange={(e) => set("partyTypes", e.value)} display="chip" className={errors.partyTypes ? "p-invalid" : undefined} />
                    {errors.partyTypes ? <small className="dn__error">{errors.partyTypes}</small> : null}
                  </div>
                </div>
                <div className="admin__grid">
                  <div className="admin__field">
                    <label htmlFor="ss-products">{k("columns.products")}</label>
                    <MultiSelect inputId="ss-products" value={edit.productIds} options={products} onChange={(e) => set("productIds", e.value)} filter display="chip" className={errors.productIds ? "p-invalid" : undefined} />
                    {errors.productIds ? <small className="dn__error">{errors.productIds}</small> : null}
                  </div>
                  <div className="admin__field">
                    <label htmlFor="ss-insurers">{k("insurers")}</label>
                    <MultiSelect inputId="ss-insurers" value={edit.insurerIds || []} options={insurers} onChange={(e) => set("insurerIds", e.value)} filter display="chip" placeholder={k("allInsurers")} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="ss-type">{t("numberingMasters.commissionRates.policyType")}</label>
                    <Dropdown inputId="ss-type" value={edit.policyType} options={policyTypeOptions} onChange={(e) => set("policyType", e.value)} />
                  </div>
                </div>
                <div className="admin__grid">
                  <div className="admin__field">
                    <label htmlFor="ss-from">{t("numberingMasters.commissionRates.effectiveFrom")}</label>
                    <DateField id="ss-from" value={edit.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className={errors.effectiveFrom ? "p-invalid" : undefined} />
                    {errors.effectiveFrom ? <small className="dn__error">{errors.effectiveFrom}</small> : null}
                  </div>
                  <div className="admin__field">
                    <label htmlFor="ss-to">{t("numberingMasters.commissionRates.effectiveTo")}</label>
                    <DateField id="ss-to" value={edit.effectiveTo} placeholder={t("numberingMasters.commissionRates.openEnded")} onChange={(e) => set("effectiveTo", e.target.value)} />
                  </div>
                  <div className="admin__field admin__field--inline">
                    <Checkbox inputId="ss-fully-paid" checked={!!edit.payWhenFullyPaid} onChange={(e) => set("payWhenFullyPaid", e.checked)} />
                    <label htmlFor="ss-fully-paid">{k("payWhenFullyPaid")}</label>
                  </div>
                </div>
                <div className="admin__field admin__field--inline">
                  <Checkbox inputId="ss-combine" checked={!!edit.combineWithReferrer} onChange={(e) => set("combineWithReferrer", e.checked)} />
                  <label htmlFor="ss-combine">{k("combineWithReferrer")}</label>
                </div>
                <div className="admin__field">
                  <label htmlFor="ss-remarks">{t("numberingMasters.commissionRates.remarks")}</label>
                  <InputTextarea id="ss-remarks" rows={2} autoResize value={edit.remarks} onChange={(e) => set("remarks", e.target.value)} />
                </div>
              </div>
            </TabPanel>
            <TabPanel header={k("tabs.lines")}>
              {errors.lines ? <small className="dn__error">{errors.lines}</small> : null}
              <DataTable value={edit.lines} dataKey="key" size="small" className="ss__lines" emptyMessage={k("errors.noLine")} responsiveLayout="scroll">
                <Column header={k("line.paidTo")} body={(l, { rowIndex }) => <Dropdown value={l.paidTo} options={paidToOptions} onChange={(e) => setLine(rowIndex, "paidTo", e.value)} aria-label={k("line.paidTo")} />} />
                <Column header={k("line.basis")} body={(l, { rowIndex }) => <Dropdown value={l.basis} options={basisOptions} onChange={(e) => setLine(rowIndex, "basis", e.value)} aria-label={k("line.basis")} />} />
                <Column header={k("line.perils")} body={(l, { rowIndex }) => <MultiSelect value={l.perils} options={PERILS.map((p) => ({ label: p, value: p }))} onChange={(e) => setLine(rowIndex, "perils", e.value)} aria-label={k("line.perils")} disabled={l.basis === "net-premium-pct" || l.basis === "fixed"} />} />
                <Column header={k("line.default")} body={(l, { rowIndex }) => <InputNumber value={l.defaultValue} min={0} maxFractionDigits={4} onValueChange={(e) => setLine(rowIndex, "defaultValue", e.value)} aria-label={k("line.default")} />} />
                <Column header={k("line.min")} body={(l, { rowIndex }) => <InputNumber value={l.min} min={0} maxFractionDigits={4} onValueChange={(e) => setLine(rowIndex, "min", e.value)} aria-label={k("line.min")} />} />
                <Column header={k("line.max")} body={(l, { rowIndex }) => <InputNumber value={l.max} min={0} maxFractionDigits={4} onValueChange={(e) => setLine(rowIndex, "max", e.value)} aria-label={k("line.max")} />} />
                <Column header={k("line.addToReferrer")} body={(l, { rowIndex }) => (l.paidTo === "parent" ? <Checkbox checked={!!l.addToReferrer} onChange={(e) => setLine(rowIndex, "addToReferrer", e.checked)} aria-label={k("line.addToReferrer")} /> : "—")} />
                <Column header="" body={(l, { rowIndex }) => <Button icon="pi pi-trash" text rounded severity="danger" aria-label={k("line.remove")} onClick={() => set("lines", edit.lines.filter((_, j) => j !== rowIndex))} />} style={{ width: "4rem" }} />
              </DataTable>
              <div className="ss__line-actions">
                <Button label={k("line.add")} icon="pi pi-plus" outlined size="small" onClick={() => set("lines", [...edit.lines, { ...EMPTY_LINE, key: `${Date.now()}` }])} />
                <Button label={k("example.show")} icon="pi pi-calculator" text size="small" onClick={showExample} disabled={!edit.lines.length} />
              </div>
              {example ? (
                <div className="ss__example">
                  <KeyValueGrid columns={4} items={[
                    { label: k("example.sumInsured"), value: example.sumInsured, type: "amount" },
                    { label: k("example.commission"), value: example.commission, type: "amount" },
                    { label: k("example.shared"), value: example.shared, type: "amount" },
                    { label: k("example.retained"), value: example.retained, type: "amount" },
                  ]} />
                </div>
              ) : null}
            </TabPanel>
            <TabPanel header={k("tabs.assignments")} disabled={!edit.id}>
              <div className="ss__line-actions">
                {canWrite && ["active", "scheduled", "suspended"].includes(edit.status) ? <Button label={k("assign.action")} icon="pi pi-user-plus" outlined size="small" onClick={openAssign} /> : null}
              </div>
              <DataTable value={[...(assignments?.referrers || []).map((r) => ({ key: `r-${r.id}`, kind: k("assign.referrer"), name: r.name, type: r.partyType, override: r.override })),
                ...(assignments?.channels || []).map((c) => ({ key: `c-${c.id}`, kind: k("assign.channel"), name: c.name, type: c.channelType, override: c.override }))]}
                dataKey="key" size="small" emptyMessage={k("assign.none")} responsiveLayout="scroll">
                <Column field="kind" header={k("assign.kind")} />
                <Column field="name" header={k("columns.name")} />
                <Column field="type" header={k("assign.type")} />
                <Column header={k("assign.override")} body={(r) => (r.override === null || r.override === undefined ? k("assign.default") : r.override)} />
              </DataTable>
            </TabPanel>
          </TabView>
        )}
      </Dialog>

      <Dialog header={k("assign.title", { code: edit?.code })} visible={!!assign} onHide={() => setAssign(null)} style={{ width: "min(520px, 96vw)" }}
        footer={<div><Button label={t("numberingMasters.cancel")} text onClick={() => setAssign(null)} /><Button label={k("assign.action")} icon="pi pi-check" onClick={doAssign} disabled={!(assign?.referrerId || assign?.channelId)} /></div>}>
        {assign && (
          <div className="dn__form">
            <div className="admin__field">
              <label htmlFor="ss-a-kind">{k("assign.kind")}</label>
              <Dropdown inputId="ss-a-kind" value={assign.kind} options={[{ label: k("assign.referrer"), value: "referrer" }, { label: k("assign.channel"), value: "channel" }]} onChange={(e) => setAssign((a) => ({ ...a, kind: e.value, referrerId: null, channelId: null }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="ss-a-who">{assign.kind === "referrer" ? k("assign.referrer") : k("assign.channel")}</label>
              {assign.kind === "referrer"
                ? <Dropdown inputId="ss-a-who" value={assign.referrerId} options={referrers} filter onChange={(e) => setAssign((a) => ({ ...a, referrerId: e.value }))} />
                : <Dropdown inputId="ss-a-who" value={assign.channelId} options={channels} filter onChange={(e) => setAssign((a) => ({ ...a, channelId: e.value }))} />}
            </div>
            <div className="admin__field">
              <label htmlFor="ss-a-override">{k("assign.override")}</label>
              <InputNumber inputId="ss-a-override" value={assign.override} min={0} maxFractionDigits={4} onValueChange={(e) => setAssign((a) => ({ ...a, override: e.value }))} placeholder={k("assign.default")} />
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog visible={!!ending} onHide={() => setEnding(null)} title={k("endTitle")} severity="danger" message={k("endMessage")} facts={ending ? facts(ending.scheme) : []}
        reason={{ context: "scheme_end" }} confirmLabel={k("endAction")}
        onConfirm={async (reason) => {
          const assigned = (ending.scheme.assignments?.referrers || 0) + (ending.scheme.assignments?.channels || 0);
          await CommissionService.schemeAction(ending.scheme.id, "end", { ...reason, replacementCode: ending.replacementCode || undefined, confirmNoSharing: assigned ? !ending.replacementCode : undefined });
          success(k("ended"));
          setEnding(null);
          load();
        }}>
        {ending && ((ending.scheme.assignments?.referrers || 0) + (ending.scheme.assignments?.channels || 0) > 0) ? (
          <div className="admin__field">
            <label htmlFor="ss-end-replacement">{k("replacement", { count: (ending.scheme.assignments?.referrers || 0) + (ending.scheme.assignments?.channels || 0) })}</label>
            <Dropdown inputId="ss-end-replacement" value={ending.replacementCode} showClear placeholder={k("noReplacement")}
              options={rows.filter((r) => ["active", "scheduled"].includes(r.status) && r.code !== ending.scheme.code).map((r) => ({ label: `${r.code} ${r.name}`, value: r.code }))}
              onChange={(e) => setEnding((x) => ({ ...x, replacementCode: e.value }))} />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
};

export default SharingSchemes;
