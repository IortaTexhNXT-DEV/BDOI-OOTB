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
import service from "../../services/promotionService";
import mastersService from "../../services/mastersService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { openConfirm } from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import RowActions from "../../components/RowActions";
import DetailDialog from "../../components/DetailDialog";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import ApprovalActions, { isInitiator } from "../../components/ApprovalActions";
import { formatValue } from "../../components/KeyValueGrid/formatValue";
import { ListCell, PeriodCell } from "../../components/TableCells";

const STATUS_FILTERS = ["", "active", "scheduled", "pending-approval", "draft", "suspended", "expired,withdrawn"];
const EMPTY = { code: "", name: "", periodFrom: "", periodTo: "", benefit: "rate", unitQuota: null, lockInYears: null, productIds: [], insurerIds: [], channelTypes: [],
  combineDealer: false, combineDiscount: false, notes: "", excess: {}, lines: [] };
const NEW_LINE = { variantId: null, yearFrom: new Date().getFullYear(), yearTo: new Date().getFullYear() + 1, fmvFrom: null, fmvTo: null, insurerId: null,
  promoOd: null, minOd: null, promoAon: null, remitOd: null, remitAon: null, discountPct: null };
const pct = (v) => (v === null || v === undefined ? formatValue(null, {}) : `${Number(v).toFixed(2)}%`);
const rate = (v) => (v === null || v === undefined ? formatValue(null, {}) : `${Number(v)}%`);

/** The body the API takes from the form. */
const bodyOf = (f) => ({
  code: f.code, name: f.name, periodFrom: f.periodFrom, periodTo: f.periodTo, benefit: f.benefit, unitQuota: f.unitQuota ?? null, lockInYears: f.lockInYears ?? null,
  productIds: f.productIds, insurerIds: f.insurerIds, channelTypes: f.channelTypes, combineDealer: f.combineDealer, combineDiscount: f.combineDiscount, notes: f.notes || null,
  excess: f.excess, lines: f.lines.map(({ variantId, yearFrom, yearTo, fmvFrom, fmvTo, insurerId, promoOd, minOd, promoAon, remitOd, remitAon, discountPct }) => ({
    variantId, yearFrom, yearTo, fmvFrom, fmvTo, insurerId, promoOd, minOd, promoAon, remitOd, remitAon, discountPct })),
});

/**
 * Operations > Sales & Marketing > Promotions (TIS-BRD-PROD-15): promotional rates or discounts on brand-new vehicles,
 * per version, set up by one user, checked against the discount caps and approved by another; suspended, resumed,
 * withdrawn and amended as a new version.
 */
const Promotions = () => {
  const { t } = useTranslation();
  const write = hasPermission("write:promotions");
  const approve = hasPermission("approve:promotions");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState({ products: [], variants: [], channelTypes: [], standardRates: {} });
  const [insurers, setInsurers] = useState([]);
  const [viewed, setViewed] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await service.list({ status, search }));
    } catch (e) {
      notifyError(e.message);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    (async () => {
      try {
        const [c, ins] = await Promise.all([service.choices(), mastersService.options("insurance-company")]);
        setChoices(c);
        setInsurers(ins.map((x) => ({ value: Number(x.id), label: x.label })));
      } catch (e) {
        notifyError(e.message);
      }
    })();
  }, []);

  const open = async (row) => {
    try {
      setViewed(await service.get(row.id));
    } catch (e) {
      notifyError(e.message);
    }
  };
  const refresh = async (id) => {
    load();
    if (id) setViewed(await service.get(id));
  };
  const edit = (p) => {
    setErrors({});
    setForm(p ? { ...EMPTY, ...p, lines: (p.lines || []).map((l) => ({ ...NEW_LINE, ...l })) } : { ...EMPTY, lines: [{ ...NEW_LINE }] });
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = form.id ? await service.update(form.id, bodyOf(form)) : await service.create(bodyOf(form));
      notifySuccess(r.message);
      setForm(null);
      await refresh(r.data.id);
    } catch (e) {
      const byPath = Object.fromEntries((e.errors || []).map((x) => [x.path, x.message]));
      setErrors(Object.keys(byPath).length ? byPath : { form: e.message });
    } finally {
      setSaving(false);
    }
  };

  const facts = (p) => [
    { label: t("promotions.code"), value: `${p.code} v${p.version}` },
    { label: t("promotions.name"), value: p.name },
    { label: t("promotions.period"), value: `${formatValue(p.periodFrom, { type: "date" })} - ${formatValue(p.periodTo, { type: "date" })}` },
  ];
  const act = async (p, action, { reason = false, severity = null } = {}) => {
    const done = await openConfirm({
      title: t(`promotions.actions.${action}Title`), severity, facts: facts(p), confirmLabel: t(`promotions.actions.${action}`),
      ...(reason ? { reason: { context: action === "return" ? "promotion_return" : "promotion_status" } } : {}),
      onConfirm: (why) => service.act(p.id, action, reason ? why : {}),
    });
    if (!done) return;
    notifySuccess(t(`promotions.actions.${action}Done`));
    if (action === "amend") {
      load();
      const latest = (await service.list({ status: "draft", search: p.code })).find((x) => x.code === p.code);
      if (latest) setViewed(await service.get(latest.id));
      return;
    }
    await refresh(p.id);
  };
  const remove = async (p) => {
    const done = await openConfirm({ title: t("promotions.actions.deleteTitle"), severity: "danger", facts: facts(p), confirmLabel: t("promotions.actions.delete"),
      onConfirm: () => service.remove(p.id) });
    if (!done) return;
    setViewed(null);
    load();
  };

  const footer = (p) => {
    if (!p) return null;
    const mine = isInitiator({ id: p.createdById }) || isInitiator({ id: p.updatedById }) || isInitiator({ id: p.submittedById });
    return (
      <div className="flex flex-wrap gap-2 justify-content-end">
        {write && p.status === "draft" ? <Button label={t("promotions.actions.edit")} icon="pi pi-pencil" outlined onClick={() => edit(p)} /> : null}
        {write && p.status === "draft" && p.version === 1 && !p.submittedAt && isInitiator({ id: p.createdById })
          ? <Button label={t("promotions.actions.delete")} icon="pi pi-trash" severity="danger" text onClick={() => remove(p)} /> : null}
        {write && p.status === "draft" ? <Button label={t("promotions.actions.submit")} icon="pi pi-send" onClick={() => act(p, "submit")} /> : null}
        {write && p.status === "pending-approval" && isInitiator({ id: p.submittedById })
          ? <Button label={t("promotions.actions.recall")} icon="pi pi-undo" outlined onClick={() => act(p, "recall")} /> : null}
        {approve && p.status === "pending-approval" && !mine ? (
          <ApprovalActions initiator={{ id: p.submittedById }} approveLabel={t("promotions.actions.approve")} rejectLabel={t("promotions.actions.return")}
            onApprove={() => act(p, "approve")} onReject={() => act(p, "return", { reason: true, severity: "danger" })} />
        ) : null}
        {write && ["scheduled", "active", "suspended"].includes(p.status) ? <Button label={t("promotions.actions.amend")} icon="pi pi-copy" outlined onClick={() => act(p, "amend")} /> : null}
        {approve && ["scheduled", "active"].includes(p.status) ? <Button label={t("promotions.actions.suspend")} icon="pi pi-pause" outlined onClick={() => act(p, "suspend", { reason: true })} /> : null}
        {approve && p.status === "suspended" ? <Button label={t("promotions.actions.resume")} icon="pi pi-play" outlined onClick={() => act(p, "resume", { reason: true })} /> : null}
        {approve && ["scheduled", "active", "suspended"].includes(p.status)
          ? <Button label={t("promotions.actions.withdraw")} icon="pi pi-ban" severity="danger" outlined onClick={() => act(p, "withdraw", { reason: true, severity: "danger" })} /> : null}
        <Button label={t("common.close", "Close")} text onClick={() => setViewed(null)} />
      </div>
    );
  };

  const capOf = (p, lineNo) => p.capCheck?.lines?.find((l) => l.lineNo === lineNo);
  const capText = (p, lineNo) => {
    const c = capOf(p, lineNo);
    if (!c) return formatValue(null, {});
    const failed = c.checks.filter((x) => x.result !== "within");
    if (!failed.length) return <StatusChip code="active" label={t("promotions.withinCap")} />;
    return (
      <span className="flex flex-column gap-1">
        {failed.map((x) => <StatusChip key={`${x.productId}-${x.channelType}`} code="rejected" label={t(`promotions.cap.${x.result}`, { type: choices.channelTypes.find((c2) => c2.value === x.channelType)?.label || x.channelType })} />)}
      </span>
    );
  };

  return (
    <div className="pe-page">
      <PageHeader home={t("distribution.home.sales", "Sales & placement")} title={t("promotions.title")}>
        {write ? <Button label={t("promotions.add")} icon="pi pi-plus" onClick={() => edit(null)} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="flex flex-wrap gap-2 mb-3">
          <Dropdown value={status} options={STATUS_FILTERS.map((s) => ({ value: s, label: t(`promotions.filter.${s || "all"}`) }))} onChange={(e) => setStatus(e.value)}
            aria-label={t("promotions.status")} />
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("promotions.search")} aria-label={t("promotions.search")} />
          </span>
        </div>
        <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("promotions.none")}>
          <Column field="code" header={t("promotions.code")} body={(r) => <strong>{r.code}</strong>} />
          <Column field="name" header={t("promotions.name")} />
          <Column header={t("promotions.products")} body={(r) => <ListCell items={r.products.map((p) => p.name)} />} />
          <Column header={t("promotions.insurers")} body={(r) => <ListCell items={r.insurers.map((p) => p.name)} />} />
          <Column header={t("promotions.channelTypes")} body={(r) => r.channelTypeLabels.join(", ")} />
          <Column header={t("promotions.period")} body={(r) => <PeriodCell from={r.periodFrom} to={r.periodTo} />} />
          <Column header={t("promotions.variants")} body={(r) => r.lineCount} className="bv-num" headerClassName="bv-num" />
          <Column header={t("promotions.version")} body={(r) => `v${r.version}`} />
          <Column header={t("promotions.units")} body={(r) => (r.unitQuota ? `${r.unitsUsed} / ${r.unitQuota}` : r.unitsUsed)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("promotions.status")} body={(r) => <StatusChip code={r.status} label={r.statusLabel} />} />
          <Column header={t("common.actions", "Actions")} body={(r) => <RowActions onView={() => open(r)} />} />
        </DataTable>
      </div>

      <DetailDialog visible={Boolean(viewed)} onHide={() => setViewed(null)} size="xl" footer={footer(viewed)}
        header={viewed ? `${viewed.code} v${viewed.version} - ${viewed.name}` : ""}>
        {viewed ? (
          <>
            <DetailSection title={t("promotions.general")}>
              <KeyValueGrid columns={4} items={[
                { label: t("promotions.status"), value: <StatusChip code={viewed.status} label={viewed.statusLabel} /> },
                { label: t("promotions.benefit"), value: t(`promotions.benefits.${viewed.benefit}`) },
                { label: t("promotions.periodFrom"), value: viewed.periodFrom, type: "date" },
                { label: t("promotions.periodTo"), value: viewed.periodTo, type: "date" },
                { label: t("promotions.units"), value: viewed.unitQuota ? `${viewed.unitsUsed} / ${viewed.unitQuota}` : String(viewed.unitsUsed) },
                { label: t("promotions.lockInYears"), value: viewed.lockInYears },
                { label: t("promotions.excess"), value: viewed.products.map((p) => `${p.name}: ${formatValue(viewed.excess[p.id], { type: "amount" })}`).join(", ") },
                { label: t("promotions.combine"), value: [viewed.combineDealer ? t("promotions.combineDealer") : null, viewed.combineDiscount ? t("promotions.combineDiscount") : null].filter(Boolean).join(", ") || null },
                { label: t("promotions.products"), value: viewed.products.map((p) => p.name).join(", "), span: 2 },
                { label: t("promotions.insurers"), value: viewed.insurers.map((p) => p.name).join(", "), span: 2 },
                { label: t("promotions.channelTypes"), value: viewed.channelTypeLabels.join(", "), span: 2 },
                { label: t("promotions.notes"), value: viewed.notes, span: 2 },
                { label: t("promotions.createdBy"), value: viewed.createdBy },
                { label: t("promotions.submittedBy"), value: viewed.submittedBy, hidden: !viewed.submittedAt },
                { label: t("promotions.decidedBy"), value: viewed.decidedBy ? `${viewed.decidedBy}, ${formatValue(viewed.decidedAt, { type: "datetime" })}` : null, hidden: !viewed.decidedAt },
                { label: t("promotions.decision"), value: viewed.decisionNote, hidden: !viewed.decisionNote, span: 2 },
                { label: t("promotions.statusReason"), value: viewed.statusNote, hidden: !viewed.statusNote, span: 2 },
              ]} />
            </DetailSection>
            <DetailSection className="mt-3" title={t("promotions.lines")}>
              <DataTable value={viewed.lines} dataKey="lineNo" size="small" stripedRows>
                <Column field="lineNo" header="#" />
                <Column header={t("promotions.vehicle")} body={(l) => `${l.brand} ${l.model} ${l.variant}`} />
                <Column header={t("promotions.yearModels")} body={(l) => (l.yearFrom === l.yearTo ? l.yearFrom : `${l.yearFrom} - ${l.yearTo}`)} />
                <Column header={t("promotions.insurer")} body={(l) => l.insurerName || t("promotions.allInsurers")} />
                {viewed.benefit === "rate" ? <Column header={t("promotions.promoOd")} body={(l) => rate(l.promoOd)} className="bv-num" headerClassName="bv-num" /> : null}
                {viewed.benefit === "rate" ? <Column header={t("promotions.minOd")} body={(l) => rate(l.minOd)} className="bv-num" headerClassName="bv-num" /> : null}
                {viewed.benefit === "rate" ? <Column header={t("promotions.promoAon")} body={(l) => rate(l.promoAon)} className="bv-num" headerClassName="bv-num" /> : null}
                {viewed.benefit === "discount" ? <Column header={t("promotions.discountPct")} body={(l) => rate(l.discountPct)} className="bv-num" headerClassName="bv-num" /> : null}
                <Column header={t("promotions.remitOd")} body={(l) => rate(l.remitOd)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("promotions.remitAon")} body={(l) => rate(l.remitAon)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("promotions.rateDiscount")} body={(l) => pct(capOf(viewed, l.lineNo)?.rateDiscount)} className="bv-num" headerClassName="bv-num" />
                <Column header={t("promotions.capCheck")} body={(l) => capText(viewed, l.lineNo)} />
              </DataTable>
            </DetailSection>
            {viewed.versions?.length > 1 ? (
              <DetailSection className="mt-3" title={t("promotions.versions")}>
                <DataTable value={viewed.versions} dataKey="id" size="small">
                  <Column header={t("promotions.version")} body={(v) => `v${v.version}`} />
                  <Column header={t("promotions.status")} body={(v) => <StatusChip code={v.status} label={v.statusLabel} />} />
                  <Column header={t("promotions.period")} body={(v) => `${formatValue(v.periodFrom, { type: "date" })} - ${formatValue(v.periodTo, { type: "date" })}`} />
                  <Column header={t("promotions.decidedBy")} body={(v) => v.decidedBy || formatValue(null, {})} />
                  <Column header={t("common.actions", "Actions")} body={(v) => (v.id === viewed.id ? null : <RowActions onView={() => open(v)} />)} />
                </DataTable>
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </DetailDialog>

      <Dialog visible={Boolean(form)} onHide={() => setForm(null)} header={form?.id ? t("promotions.editTitle", { code: form.code, version: form.version }) : t("promotions.add")}
        style={{ width: "72rem" }} breakpoints={{ "960px": "96vw" }} modal
        footer={(
          <div className="flex gap-2 justify-content-end">
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setForm(null)} />
            <Button label={t("promotions.saveDraft")} icon="pi pi-save" loading={saving} onClick={save} />
          </div>
        )}>
        {form ? (
          <TabView>
            <TabPanel header={t("promotions.general")}>
              <div className="grid formgrid p-fluid">
                <div className="field col-12 md:col-4">
                  <label htmlFor="prm-code">{t("promotions.code")}</label>
                  <InputText id="prm-code" value={form.code} disabled={Boolean(form.id)} onChange={(e) => set({ code: e.target.value.toUpperCase() })} invalid={Boolean(errors.code)} />
                  <FieldError error={errors.code} />
                </div>
                <div className="field col-12 md:col-8">
                  <label htmlFor="prm-name">{t("promotions.name")}</label>
                  <InputText id="prm-name" value={form.name} onChange={(e) => set({ name: e.target.value })} invalid={Boolean(errors.name)} />
                  <FieldError error={errors.name} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="prm-from">{t("promotions.periodFrom")}</label>
                  <DateField id="prm-from" value={form.periodFrom} onChange={(e) => set({ periodFrom: e.target.value })} invalid={Boolean(errors.periodFrom)} />
                  <FieldError error={errors.periodFrom} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="prm-to">{t("promotions.periodTo")}</label>
                  <DateField id="prm-to" value={form.periodTo} onChange={(e) => set({ periodTo: e.target.value })} invalid={Boolean(errors.periodTo)} />
                  <FieldError error={errors.periodTo} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="prm-benefit">{t("promotions.benefit")}</label>
                  <Dropdown inputId="prm-benefit" value={form.benefit} disabled={form.version > 1} options={["rate", "discount"].map((b) => ({ value: b, label: t(`promotions.benefits.${b}`) }))}
                    onChange={(e) => set({ benefit: e.value })} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="prm-quota">{t("promotions.unitQuota")}</label>
                  <InputNumber inputId="prm-quota" value={form.unitQuota} min={1} useGrouping={false} onValueChange={(e) => set({ unitQuota: e.value })} invalid={Boolean(errors.unitQuota)} />
                  <FieldError error={errors.unitQuota} />
                </div>
                <div className="field col-12 md:col-3">
                  <label htmlFor="prm-lock">{t("promotions.lockInYears")}</label>
                  <InputNumber inputId="prm-lock" value={form.lockInYears} min={1} max={choices.maxLockInYears || 3} useGrouping={false} onValueChange={(e) => set({ lockInYears: e.value })}
                    invalid={Boolean(errors.lockInYears)} />
                  <FieldError error={errors.lockInYears} />
                </div>
                {form.productIds.map((id) => (
                  <div className="field col-12 md:col-3" key={id}>
                    <label htmlFor={`prm-excess-${id}`}>{t("promotions.excessOf", { product: choices.products.find((p) => p.value === id)?.label || id })}</label>
                    <InputNumber inputId={`prm-excess-${id}`} value={form.excess[id] ?? null} min={0} minFractionDigits={2} maxFractionDigits={2}
                      onValueChange={(e) => set({ excess: { ...form.excess, [id]: e.value } })} />
                  </div>
                ))}
                <div className="field col-12">
                  <label htmlFor="prm-notes">{t("promotions.notes")}</label>
                  <InputTextarea id="prm-notes" rows={2} value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
                </div>
              </div>
            </TabPanel>
            <TabPanel header={t("promotions.applicability")}>
              <div className="grid formgrid p-fluid">
                <div className="field col-12 md:col-4">
                  <label htmlFor="prm-products">{t("promotions.products")}</label>
                  <MultiSelect inputId="prm-products" value={form.productIds} options={choices.products} onChange={(e) => set({ productIds: e.value })} display="chip" invalid={Boolean(errors.productIds)} />
                  <FieldError error={errors.productIds} />
                </div>
                <div className="field col-12 md:col-4">
                  <label htmlFor="prm-insurers">{t("promotions.insurers")}</label>
                  <MultiSelect inputId="prm-insurers" value={form.insurerIds} options={insurers} filter onChange={(e) => set({ insurerIds: e.value })} display="chip" invalid={Boolean(errors.insurerIds)} />
                  <FieldError error={errors.insurerIds} />
                </div>
                <div className="field col-12 md:col-4">
                  <label htmlFor="prm-channels">{t("promotions.channelTypes")}</label>
                  <MultiSelect inputId="prm-channels" value={form.channelTypes} options={choices.channelTypes} onChange={(e) => set({ channelTypes: e.value })} display="chip"
                    invalid={Boolean(errors.channelTypes)} />
                  <FieldError error={errors.channelTypes} />
                </div>
                <div className="field-checkbox col-12 md:col-6">
                  <Checkbox inputId="prm-dealer" checked={form.combineDealer} onChange={(e) => set({ combineDealer: e.checked })} />
                  <label htmlFor="prm-dealer">{t("promotions.combineDealer")}</label>
                </div>
                <div className="field-checkbox col-12 md:col-6">
                  <Checkbox inputId="prm-discount" checked={form.combineDiscount} onChange={(e) => set({ combineDiscount: e.checked })} />
                  <label htmlFor="prm-discount">{t("promotions.combineDiscount")}</label>
                </div>
              </div>
            </TabPanel>
            <TabPanel header={t("promotions.lines")}>
              <KeyValueGrid columns={4} items={[
                { label: t("promotions.standardOd"), value: rate(choices.standardRates?.ownDamage) },
                { label: t("promotions.standardAon"), value: rate(choices.standardRates?.actsOfNature) },
              ]} />
              <DataTable value={form.lines} size="small" className="mt-2" dataKey="lineNo" rowHover>
                <Column header="#" body={(_l, o) => o.rowIndex + 1} />
                <Column header={t("promotions.vehicle")} body={(l, o) => (
                  <Dropdown value={l.variantId} options={choices.variants} filter onChange={(e) => setLine(o.rowIndex, { variantId: e.value })} aria-label={t("promotions.vehicle")}
                    className="w-full" style={{ minWidth: "14rem" }} invalid={Boolean(errors[`lines.${o.rowIndex}.variantId`])} />
                )} />
                <Column header={t("promotions.yearFrom")} body={(l, o) => <InputNumber value={l.yearFrom} useGrouping={false} onValueChange={(e) => setLine(o.rowIndex, { yearFrom: e.value })} inputStyle={{ width: "5rem" }} aria-label={t("promotions.yearFrom")} />} />
                <Column header={t("promotions.yearTo")} body={(l, o) => <InputNumber value={l.yearTo} useGrouping={false} onValueChange={(e) => setLine(o.rowIndex, { yearTo: e.value })} inputStyle={{ width: "5rem" }} aria-label={t("promotions.yearTo")} />} />
                <Column header={t("promotions.insurer")} body={(l, o) => (
                  <Dropdown value={l.insurerId} options={insurers.filter((i) => form.insurerIds.includes(i.value))} showClear placeholder={t("promotions.allInsurers")}
                    onChange={(e) => setLine(o.rowIndex, { insurerId: e.value ?? null })} aria-label={t("promotions.insurer")} />
                )} />
                {(form.benefit === "rate" ? ["promoOd", "minOd", "promoAon", "remitOd", "remitAon"] : ["discountPct", "remitOd", "remitAon"]).map((k) => (
                  <Column key={k} header={t(`promotions.${k}`)} body={(l, o) => (
                    <InputNumber value={l[k]} minFractionDigits={0} maxFractionDigits={4} onValueChange={(e) => setLine(o.rowIndex, { [k]: e.value })} inputStyle={{ width: "5rem" }}
                      aria-label={t(`promotions.${k}`)} invalid={Boolean(errors[`lines.${o.rowIndex}.${k}`])} />
                  )} />
                ))}
                <Column body={(_l, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("promotions.removeLine")}
                  onClick={() => set({ lines: form.lines.filter((_x, n) => n !== o.rowIndex) })} />} />
              </DataTable>
              <Button label={t("promotions.addLine")} icon="pi pi-plus" text className="mt-2" onClick={() => set({ lines: [...form.lines, { ...NEW_LINE }] })} />
              {Object.entries(errors).filter(([k]) => k.startsWith("lines")).map(([k, m]) => <FieldError key={k} message={m} />)}
            </TabPanel>
          </TabView>
        ) : null}
        {errors.form ? <FieldError error={errors.form} /> : null}
      </Dialog>
    </div>
  );
};

export default Promotions;
