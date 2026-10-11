import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import service from "../../services/promotionService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess, notifyWarn } from "../../utility/dialogs";
import { openConfirm } from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import ApprovalActions, { isInitiator } from "../../components/ApprovalActions";
import { formatValue } from "../../components/KeyValueGrid/formatValue";

const EMPTY = { productId: null, channelType: null, minPct: 0, maxPct: null, lowestOd: null, effectiveFrom: "", effectiveTo: "", replacesId: null, remarks: "" };
const pct = (v) => `${Number(v).toFixed(2)}%`;

/**
 * Master > Finance > Discount Caps (TIS-BRD-PROD-15, FR-PRM-010): per product and channel type, the minimum and maximum
 * discount of a quotation (promotion and order summary discount together) and the lowest Own Damage rate; a new cap or
 * a replacement is live once a second user approves it.
 */
const DiscountCaps = () => {
  const { t } = useTranslation();
  const write = hasPermission("write:discount-caps");
  const approve = hasPermission("approve:discount-caps");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [choices, setChoices] = useState({ products: [], channelTypes: [] });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await service.caps({ status }));
    } catch (e) {
      notifyError(e.message);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    service.choices().then(setChoices).catch((e) => notifyError(e.message));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = await service.proposeCap({ ...form, effectiveTo: form.effectiveTo || null, remarks: form.remarks || null });
      notifySuccess(r.message);
      if (r.impact?.length) notifyWarn(t("discountCaps.impact", { count: r.impact.length, lines: r.impact.join(", ") }));
      setForm(null);
      load();
    } catch (e) {
      const byPath = Object.fromEntries((e.errors || []).map((x) => [x.path, x.message]));
      setErrors(Object.keys(byPath).length ? byPath : { form: e.message });
    } finally {
      setSaving(false);
    }
  };
  const facts = (c) => [
    { label: t("discountCaps.product"), value: c.productName },
    { label: t("discountCaps.channelType"), value: c.channelTypeLabel },
    { label: t("discountCaps.range"), value: `${pct(c.minPct)} - ${pct(c.maxPct)}` },
    { label: t("discountCaps.lowestOd"), value: pct(c.lowestOd) },
    { label: t("discountCaps.effectiveFrom"), value: c.effectiveFrom, type: "date" },
  ];
  const act = async (c, action) => {
    const done = await openConfirm({
      title: t(`discountCaps.${action}Title`), severity: action === "return" ? "danger" : null, facts: facts(c), confirmLabel: t(`discountCaps.${action}`),
      ...(action === "return" ? { reason: { context: "discount_cap_return" } } : {}),
      onConfirm: (why) => service.capAct(c.id, action, action === "return" ? why : {}),
    });
    if (!done) return;
    notifySuccess(t(`discountCaps.${action}Done`));
    load();
  };
  const actions = (c) => {
    if (c.status === "pending") {
      if (isInitiator({ id: c.createdById })) return write ? <Button label={t("discountCaps.withdraw")} text size="small" onClick={() => act(c, "withdraw")} /> : null;
      return approve ? <ApprovalActions initiator={{ id: c.createdById }} approveLabel={t("discountCaps.approve")} rejectLabel={t("discountCaps.return")}
        onApprove={() => act(c, "approve")} onReject={() => act(c, "return")} /> : null;
    }
    if (c.status === "approved" && !c.effectiveTo && write) {
      return <Button label={t("discountCaps.replace")} icon="pi pi-replay" text size="small"
        onClick={() => { setErrors({}); setForm({ ...EMPTY, productId: c.productId, channelType: c.channelType, minPct: c.minPct, maxPct: c.maxPct, lowestOd: c.lowestOd, replacesId: c.id }); }} />;
    }
    return null;
  };

  const statuses = ["", "approved", "pending", "returned", "withdrawn"];
  return (
    <div className="pe-page">
      <PageHeader home={t("discountCaps.home")} section={t("discountCaps.section")} title={t("discountCaps.title")}>
        {write ? <Button label={t("discountCaps.add")} icon="pi pi-plus" onClick={() => { setErrors({}); setForm({ ...EMPTY }); }} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="flex gap-2 mb-3">
          <Dropdown value={status} options={statuses.map((s) => ({ value: s, label: t(`discountCaps.filter.${s || "all"}`) }))} onChange={(e) => setStatus(e.value)} aria-label={t("discountCaps.status")} />
        </div>
        <DataTable value={rows} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("discountCaps.none")}>
          <Column field="productName" header={t("discountCaps.product")} />
          <Column field="channelTypeLabel" header={t("discountCaps.channelType")} />
          <Column header={t("discountCaps.minPct")} body={(c) => pct(c.minPct)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("discountCaps.maxPct")} body={(c) => pct(c.maxPct)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("discountCaps.lowestOd")} body={(c) => pct(c.lowestOd)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("discountCaps.effectiveFrom")} body={(c) => formatValue(c.effectiveFrom, { type: "date" })} />
          <Column header={t("discountCaps.effectiveTo")} body={(c) => formatValue(c.effectiveTo, { type: "date" })} />
          <Column header={t("discountCaps.status")} body={(c) => <StatusChip code={c.status} label={c.statusLabel} />} />
          <Column header={t("discountCaps.createdBy")} body={(c) => c.createdBy || formatValue(null, {})} />
          <Column header={t("common.actions", "Actions")} body={actions} />
        </DataTable>
      </div>
      <Dialog visible={Boolean(form)} onHide={() => setForm(null)} header={form?.replacesId ? t("discountCaps.replaceTitle") : t("discountCaps.add")} style={{ width: "40rem" }}
        breakpoints={{ "640px": "96vw" }} modal
        footer={(
          <div className="flex gap-2 justify-content-end">
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setForm(null)} />
            <Button label={t("discountCaps.submit")} icon="pi pi-send" loading={saving} onClick={save} />
          </div>
        )}>
        {form ? (
          <div className="grid formgrid p-fluid">
            <div className="field col-12 md:col-6">
              <label htmlFor="dc-product">{t("discountCaps.product")}</label>
              <Dropdown inputId="dc-product" value={form.productId} options={choices.products} disabled={Boolean(form.replacesId)} onChange={(e) => set({ productId: e.value })}
                invalid={Boolean(errors.productId)} />
              <FieldError error={errors.productId} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="dc-channel">{t("discountCaps.channelType")}</label>
              <Dropdown inputId="dc-channel" value={form.channelType} options={choices.channelTypes} disabled={Boolean(form.replacesId)} onChange={(e) => set({ channelType: e.value })}
                invalid={Boolean(errors.channelType)} />
              <FieldError error={errors.channelType} />
            </div>
            {["minPct", "maxPct", "lowestOd"].map((k) => (
              <div className="field col-12 md:col-4" key={k}>
                <label htmlFor={`dc-${k}`}>{t(`discountCaps.${k}`)}</label>
                <InputNumber inputId={`dc-${k}`} value={form[k]} min={0} max={100} minFractionDigits={0} maxFractionDigits={k === "lowestOd" ? 4 : 2} suffix="%"
                  onValueChange={(e) => set({ [k]: e.value })} invalid={Boolean(errors[k])} />
                <FieldError error={errors[k]} />
              </div>
            ))}
            <div className="field col-12 md:col-6">
              <label htmlFor="dc-from">{t("discountCaps.effectiveFrom")}</label>
              <DateField id="dc-from" value={form.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} invalid={Boolean(errors.effectiveFrom)} />
              <FieldError error={errors.effectiveFrom} />
            </div>
            <div className="field col-12 md:col-6">
              <label htmlFor="dc-to">{t("discountCaps.effectiveTo")}</label>
              <DateField id="dc-to" value={form.effectiveTo} onChange={(e) => set({ effectiveTo: e.target.value })} invalid={Boolean(errors.effectiveTo)} />
              <FieldError error={errors.effectiveTo} />
            </div>
            <div className="field col-12">
              <label htmlFor="dc-remarks">{t("discountCaps.remarks")}</label>
              <InputTextarea id="dc-remarks" rows={2} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
            </div>
            {errors.form ? <div className="col-12"><FieldError error={errors.form} /></div> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default DiscountCaps;
