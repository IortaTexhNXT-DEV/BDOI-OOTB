import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import StatCards from "../../components/StatCards";
import service from "../../services/opsAccountingService";
import { openConfirm } from "../../components/ConfirmDialog";
import { printPdf } from "../../components/Print";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";

/**
 * Dispose of an asset (sale or write-off): the figures before posting (book value, output VAT, gain or loss, the
 * depreciation still to post) and the disposal itself (posting rule fa.disposal; a sale issues its sales invoice).
 */
export const DisposeAssetDialog = ({ asset, onHide, onDisposed }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [form, setForm] = useState({ disposalType: "sale", disposalDate: new Date(), proceeds: null, buyerName: "", buyerTin: "", buyerAddress: "", bankAccount: null, reason: "" });
  const [preview, setPreview] = useState(null);
  const [banks, setBanks] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sale = form.disposalType === "sale";
  useEffect(() => { service.bankAccounts().then(setBanks).catch(() => {}); }, []);
  useEffect(() => {
    if (!asset) return;
    service.disposalPreview(asset.id, { disposalType: form.disposalType, disposalDate: isoOf(form.disposalDate), proceeds: sale ? form.proceeds || 0 : 0 })
      .then(setPreview).catch((e) => showError(toast, e));
  }, [asset, form.disposalType, form.disposalDate, form.proceeds, sale]);

  const save = async () => {
    setSaving(true);
    try {
      const d = await service.disposeAsset(asset.id, { disposalType: form.disposalType, disposalDate: isoOf(form.disposalDate), reason: form.reason || null,
        ...(sale ? { proceeds: form.proceeds || 0, buyerName: form.buyerName, buyerTin: form.buyerTin || null, buyerAddress: form.buyerAddress || null, bankAccount: form.bankAccount || null } : {}) });
      showSuccess(toast, t("assetDisposal.posted", { number: d.disposalNumber }));
      onDisposed(d);
    } catch (e) {
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };
  const valid = sale ? form.proceeds > 0 && form.buyerName.trim() : form.reason.trim().length >= 3;

  return (
    <Dialog className="pe-dialog bv-centered" header={asset ? t("assetDisposal.disposeOf", { asset: `${asset.assetNumber} · ${asset.name}` }) : ""} visible={!!asset} style={{ width: "min(820px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("opsAcc.cancel")} text onClick={onHide} /><Button label={t("assetDisposal.post")} icon="pi pi-check" disabled={!valid || !!preview?.unpostedPeriods?.length} loading={saving} onClick={save} /></div>}>
      <Toast ref={toast} />
      <div className="grid">
        <Field label={t("assetDisposal.type")} col="col-12 md:col-6" required>
          <SelectButton value={form.disposalType} onChange={(e) => e.value && set("disposalType", e.value)}
            options={[{ label: t("assetDisposal.types.sale"), value: "sale" }, { label: t("assetDisposal.types.write-off"), value: "write-off" }]} />
        </Field>
        <Field label={t("assetDisposal.date")} col="col-12 md:col-6" required>
          <Calendar value={form.disposalDate} onChange={(e) => set("disposalDate", e.value)} showIcon maxDate={new Date()} className="w-full" />
        </Field>
        {sale && (
          <>
            <Field label={t("assetDisposal.proceeds")} col="col-12 md:col-6" required>
              <InputNumber value={form.proceeds} onValueChange={(e) => set("proceeds", e.value)} mode="decimal" minFractionDigits={2} min={0} className="w-full" />
            </Field>
            <Field label={t("assetDisposal.bankAccount")} col="col-12 md:col-6">
              <Dropdown value={form.bankAccount} options={banks} optionLabel="label" optionValue="value" onChange={(e) => set("bankAccount", e.value)} showClear
                placeholder={t("assetDisposal.onCredit")} className="w-full" />
            </Field>
            <Field label={t("assetDisposal.buyer")} col="col-12 md:col-6" required>
              <InputText value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} maxLength={200} className="w-full" />
            </Field>
            <Field label={t("assetDisposal.buyerTin")} col="col-12 md:col-6">
              <InputText value={form.buyerTin} onChange={(e) => set("buyerTin", e.target.value)} maxLength={20} placeholder="000-000-000-00000" className="w-full" />
            </Field>
            <Field label={t("assetDisposal.buyerAddress")} col="col-12">
              <InputText value={form.buyerAddress} onChange={(e) => set("buyerAddress", e.target.value)} maxLength={500} className="w-full" />
            </Field>
          </>
        )}
        <Field label={sale ? t("assetDisposal.remarks") : t("assetDisposal.reason")} col="col-12" required={!sale}>
          <InputText value={form.reason} onChange={(e) => set("reason", e.target.value)} maxLength={500} className="w-full" placeholder={sale ? "" : t("assetDisposal.reasonPlaceholder")} />
        </Field>
      </div>
      {preview && (
        <div className="pe-card mt-2">
          <div className="flex flex-wrap gap-4">
            <span>{t("opsAcc.fa.cost")}: <b>{money(preview.cost)}</b></span>
            <span>{t("opsAcc.fa.accumulated")}: <b>{money(preview.accumulatedDepreciation)}</b></span>
            <span>{t("opsAcc.fa.bookValue")}: <b>{money(preview.bookValue)}</b></span>
            {sale && <span>{t("assetDisposal.outputVat")}{preview.vatCode ? ` (${preview.vatCode})` : ""}: <b>{money(preview.outputVat)}</b></span>}
            {sale && <span>{t("assetDisposal.grossProceeds")}: <b>{money(preview.grossProceeds)}</b></span>}
            <span>{preview.gainLoss >= 0 ? t("assetDisposal.gain") : t("assetDisposal.loss")}: <b>{money(Math.abs(preview.gainLoss))}</b></span>
          </div>
          {preview.unpostedPeriods?.length > 0 && <p className="mt-2 mb-0" style={{ color: "var(--color-danger)" }}>{t("assetDisposal.depreciateFirst", { periods: preview.unpostedPeriods.join(", ") })}</p>}
          {sale && <p className="mt-2 mb-0"><small>{form.bankAccount ? t("assetDisposal.cashNote") : t("assetDisposal.creditNote")}</small></p>}
        </div>
      )}
    </Dialog>
  );
};
DisposeAssetDialog.propTypes = { asset: PropTypes.object, onHide: PropTypes.func.isRequired, onDisposed: PropTypes.func.isRequired };

const yearStart = () => new Date(new Date().getFullYear(), 0, 1);

/** Accounts > Fixed Assets > Disposals: the disposal register (sales and write-offs) with the voucher, export and cancellation. */
export const AssetDisposals = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(new Date());
  const [disposalType, setDisposalType] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const params = { from: isoOf(from), to: isoOf(to), disposalType: disposalType || undefined, status: "all" };
  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.disposals(JSON.parse(key)));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);
  const cancel = async (r) => {
    let d;
    const reason = await openConfirm({
      title: t("assetDisposal.cancelOf", { number: r.disposalNumber }),
      severity: "danger",
      message: t("assetDisposal.cancelNote"),
      facts: [
        { label: t("opsAcc.fa.name"), value: `${r.assetNumber} · ${r.assetName}` },
        { label: t("assetDisposal.type"), value: t(`assetDisposal.types.${r.disposalType}`) },
        { label: t("assetDisposal.date"), value: r.disposalDate, type: "date" },
        { label: t("opsAcc.journal"), value: r.journalNumber },
        { label: t("opsAcc.fa.bookValue"), value: r.bookValue, type: "amount" },
        { label: t("assetDisposal.proceeds"), value: r.proceeds, type: "amount", emphasis: true },
      ],
      input: { type: "text", label: t("assetDisposal.reason"), required: true, minLength: 3, maxLength: 500 },
      confirmLabel: t("assetDisposal.cancel"),
      cancelLabel: t("opsAcc.confirmations.keepDisposal"),
      onConfirm: async (value) => { d = await service.cancelDisposal(r.id, value); },
    });
    if (reason === null) return;
    showSuccess(toast, t("assetDisposal.cancelled", { number: d.disposalNumber }));
    load();
  };
  const s = data?.summary || {};
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("assetDisposal.register")} section={t("opsAcc.fa.menu")} subtitle={t("assetDisposal.registerIntro")}>
        <Calendar value={from} onChange={(e) => e.value && setFrom(e.value)} showIcon aria-label={t("assetDisposal.from")} />
        <Calendar value={to} onChange={(e) => e.value && setTo(e.value)} showIcon aria-label={t("assetDisposal.to")} />
        <Button icon="pi pi-download" label={t("opsAcc.export")} outlined onClick={() => service.downloadDisposals(params).catch((e) => showError(toast, e))} />
      </PageHeader>
      <StatCards items={[
        { key: "disposals", label: t("assetDisposal.disposals"), value: data ? s.disposals ?? 0 : null },
        { key: "cost", label: t("opsAcc.fa.cost"), value: data ? money(s.cost) : null },
        { key: "bookValue", label: t("opsAcc.fa.bookValue"), value: data ? money(s.bookValue) : null },
        { key: "proceeds", label: t("assetDisposal.proceeds"), value: data ? money(s.proceeds) : null, note: data ? `${t("assetDisposal.outputVat")} ${money(s.outputVat)}` : null },
        { key: "gain", label: t("assetDisposal.gain"), value: data ? money(s.gain) : null },
        { key: "loss", label: t("assetDisposal.loss"), value: data ? money(s.loss) : null },
      ]} />
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={disposalType} showClear placeholder={t("assetDisposal.allTypes")} onChange={(e) => setDisposalType(e.value)} className="w-14rem"
            options={[{ label: t("assetDisposal.types.sale"), value: "sale" }, { label: t("assetDisposal.types.write-off"), value: "write-off" }]} />
        </div>
        <DataTable value={data?.rows || []} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} emptyMessage={t("opsAcc.none")}>
          <Column field="disposalNumber" header={t("assetDisposal.number")} />
          <Column header={t("assetDisposal.date")} body={(r) => date(r.disposalDate)} />
          <Column header={t("assetDisposal.type")} body={(r) => t(`assetDisposal.types.${r.disposalType}`)} />
          <Column header={t("opsAcc.fa.name")} body={(r) => `${r.assetNumber} · ${r.assetName}`} />
          <Column field="buyerName" header={t("assetDisposal.buyer")} />
          <Column header={t("opsAcc.fa.bookValue")} body={(r) => money(r.bookValue)} {...numericColumn} />
          <Column header={t("assetDisposal.proceeds")} body={(r) => money(r.proceeds)} {...numericColumn} />
          <Column header={t("assetDisposal.outputVat")} body={(r) => money(r.outputVat)} {...numericColumn} />
          <Column header={t("assetDisposal.gainLoss")} body={(r) => <Tag severity={r.gainLoss >= 0 ? "success" : "warning"} value={money(r.gainLoss)} />} {...numericColumn} />
          <Column field="salesInvoiceNumber" header={t("assetDisposal.salesInvoice")} />
          <Column field="journalNumber" header={t("opsAcc.journal")} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
          <Column body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-print" text rounded size="small" aria-label={t("assetDisposal.voucher")} tooltip={t("assetDisposal.voucher")} tooltipOptions={{ position: "top" }}
                onClick={() => printPdf(`/fixed-assets/disposals/${encodeURIComponent(r.id)}/pdf`, { fileName: `${r.disposalNumber}.pdf` }).catch((e) => showError(toast, e))} />
              {r.status === "posted" && (
                <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label={t("assetDisposal.cancel")} tooltip={t("assetDisposal.cancel")}
                  tooltipOptions={{ position: "top" }} onClick={() => cancel(r)} />
              )}
            </div>
          )} />
        </DataTable>
      </div>
    </div>
  );
};
