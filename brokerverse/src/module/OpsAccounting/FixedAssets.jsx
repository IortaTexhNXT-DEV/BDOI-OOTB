import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import StatCards from "../../components/StatCards";
import service from "../../services/opsAccountingService";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { RecordActivityLog } from "../../components/ActivityLog";
import { Field, OpsTag, PageHeader, blank, date, isoOf, money, numericColumn, showError, showSuccess, useFieldErrors } from "./common";
import { DisposeAssetDialog } from "./AssetDisposals";
import { hasPermission } from "../../utils/canOpen";

/** Accounts > Fixed Assets > Asset Register: assets, cost, accumulated depreciation, book value and the depreciation schedule. */
export const AssetRegister = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [search, setSearch] = useState("");
  const [classCode, setClassCode] = useState(null);
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [disposing, setDisposing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.assets({ search: search || undefined, classCode: classCode || undefined, status: status || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [search, classCode, status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.assetClasses().then(setClasses).catch(() => {}); }, []);

  const { errors, check, fromApi, clear } = useFieldErrors();
  const openForm = (value) => { clear(); setForm(value); };
  const save = async () => {
    const required = t("opsAcc.required");
    if (!check({
      name: blank(form.name) ? required : null,
      classCode: form.classCode ? null : required,
      acquisitionDate: form.acquisitionDate ? null : required,
      cost: form.cost > 0 ? null : t("opsAcc.amountAboveZero"),
      inServiceDate: form.inServiceDate && form.acquisitionDate && form.inServiceDate < form.acquisitionDate ? t("opsAcc.fa.inServiceBeforeAcquired") : null,
    })) return;
    try {
      const a = await service.createAsset({ name: form.name, classCode: form.classCode, acquisitionDate: isoOf(form.acquisitionDate), inServiceDate: isoOf(form.inServiceDate) || undefined,
        cost: form.cost, salvageValue: form.salvageValue ?? undefined, usefulLifeMonths: form.usefulLifeMonths ?? undefined, location: form.location || null, custodian: form.custodian || null,
        serialNumber: form.serialNumber || null, openingAccumulated: form.openingAccumulated ?? undefined, depreciateFrom: isoOf(form.depreciateFrom)?.slice(0, 7) || undefined });
      showSuccess(toast, t("opsAcc.fa.registered", { number: a.assetNumber }));
      openForm(null);
      load();
    } catch (e) {
      fromApi(e);
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.fa.register")} section={t("opsAcc.fa.menu")} subtitle={t("opsAcc.fa.registerIntro")}>
        <Button icon="pi pi-download" label={t("opsAcc.export")} outlined onClick={() => service.downloadAssets().catch((e) => showError(toast, e))} />
        <Button icon="pi pi-plus" label={t("opsAcc.fa.newAsset")} onClick={() => openForm({ name: "", classCode: classes[0]?.code || null, acquisitionDate: new Date(), inServiceDate: null, cost: null })} />
      </PageHeader>
      {data && (
        <StatCards items={[
          { key: "assets", label: t("opsAcc.fa.assets"), value: data.summary.assets },
          { key: "cost", label: t("opsAcc.fa.cost"), value: money(data.summary.cost) },
          { key: "accumulated", label: t("opsAcc.fa.accumulated"), value: money(data.summary.accumulatedDepreciation) },
          { key: "bookValue", label: t("opsAcc.fa.bookValue"), value: money(data.summary.bookValue) },
        ]} />
      )}
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={classCode} options={classes.map((c) => ({ label: c.name, value: c.code }))} showClear placeholder={t("opsAcc.fa.allClasses")} onChange={(e) => setClassCode(e.value)} className="w-14rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.search")} className="w-20rem" />
          <Dropdown value={status} options={["active", "fully-depreciated", "disposed"].map((v) => ({ label: t(`opsAcc.status.${v}`), value: v }))} showClear
            placeholder={t("assetDisposal.allStatuses")} onChange={(e) => setStatus(e.value)} className="w-14rem" />
        </div>
        <DataTable value={data?.rows || []} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} emptyMessage={t("opsAcc.none")} rowHover
          onRowClick={(e) => service.asset(e.data.id).then(setView).catch((x) => showError(toast, x))}>
          <Column field="assetNumber" header={t("opsAcc.fa.number")} />
          <Column field="name" header={t("opsAcc.fa.name")} />
          <Column header={t("opsAcc.fa.class")} body={(r) => r.className || r.classCode} />
          <Column field="location" header={t("opsAcc.fa.location")} />
          <Column header={t("opsAcc.fa.inService")} body={(r) => date(r.inServiceDate)} />
          <Column header={t("opsAcc.fa.cost")} body={(r) => money(r.cost)} {...numericColumn} />
          <Column header={t("opsAcc.fa.accumulated")} body={(r) => money(r.accumulatedDepreciation)} {...numericColumn} />
          <Column header={t("opsAcc.fa.bookValue")} body={(r) => money(r.bookValue)} {...numericColumn} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
        </DataTable>
      </div>
      <DetailDialog header={t("opsAcc.confirmations.asset.header")} visible={!!view} onHide={() => setView(null)} size="lg"
        footer={view && (
          <>
            <Button label={t("detailView.close")} outlined onClick={() => setView(null)} />
            {view.status !== "disposed" && hasPermission("write:fixed-assets") && (
              <Button icon="pi pi-sign-out" label={t("assetDisposal.dispose")} severity="danger" outlined onClick={() => { setDisposing(view); setView(null); }} />
            )}
          </>
        )}>
        {view && (
          <>
            <DetailHeader title={view.assetNumber} subtitle={view.name} status={{ code: view.status, label: t(`opsAcc.status.${view.status}`, { defaultValue: view.status }) }}
              meta={[
                { label: t("opsAcc.fa.cost"), value: view.cost, type: "amount" },
                { label: t("opsAcc.fa.accumulated"), value: view.accumulatedDepreciation, type: "amount" },
                { label: t("opsAcc.fa.bookValue"), value: view.bookValue, type: "amount" },
                { label: t("opsAcc.confirmations.asset.disposedOn"), value: view.disposedOn, type: "date", hidden: view.status !== "disposed" },
              ]} />
            <DetailSection title={t("opsAcc.confirmations.asset.details")}>
              <KeyValueGrid columns={3} items={[
                { label: t("opsAcc.fa.class"), value: view.className || view.classCode },
                { label: t("opsAcc.fa.acquired"), value: view.acquisitionDate, type: "date" },
                { label: t("opsAcc.fa.inService"), value: view.inServiceDate, type: "date" },
                { label: t("opsAcc.fa.lifeMonths"), value: view.usefulLifeMonths, type: "number", decimals: 0 },
                { label: t("opsAcc.fa.salvage"), value: view.salvageValue, type: "amount" },
                { label: t("opsAcc.confirmations.asset.lastPeriod"), value: view.lastPeriod },
                { label: t("opsAcc.fa.serial"), value: view.serialNumber },
                { label: t("opsAcc.fa.location"), value: view.location },
                { label: t("opsAcc.fa.custodian"), value: view.custodian },
                { label: t("opsAcc.ap.supplier"), value: view.supplierName },
                { label: t("opsAcc.ap.voucher"), value: view.supplierInvoiceVoucher },
                { label: t("opsAcc.description"), value: view.description, span: "full", hidden: !view.description },
              ]} />
            </DetailSection>
            <DetailSection title={t("opsAcc.confirmations.asset.accounts")}>
              <KeyValueGrid columns={3} items={[
                { label: t("opsAcc.confirmations.asset.assetAccount"), value: view.assetAccount },
                { label: t("opsAcc.confirmations.asset.accumulatedAccount"), value: view.accumulatedAccount },
                { label: t("opsAcc.confirmations.asset.expenseAccount"), value: view.expenseAccount },
              ]} />
            </DetailSection>
            <DetailSection title={t("opsAcc.confirmations.asset.schedule")} flush>
              <DataTable value={view.schedule} dataKey="period" size="small" stripedRows scrollable scrollHeight="320px">
                <Column field="period" header={t("opsAcc.period")} />
                <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
                <Column header={t("opsAcc.fa.accumulated")} body={(r) => money(r.accumulated)} {...numericColumn} />
                <Column header={t("opsAcc.fa.bookValue")} body={(r) => money(r.bookValue)} {...numericColumn} />
                <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
                <Column field="journalNumber" header={t("opsAcc.journal")} />
              </DataTable>
            </DetailSection>
            <DetailSection title={t("opsAcc.confirmations.activity")}>
              <RecordActivityLog entity="fixed_asset" recordId={view.id} />
            </DetailSection>
          </>
        )}
      </DetailDialog>
      <DisposeAssetDialog asset={disposing} onHide={() => setDisposing(null)} onDisposed={() => { setDisposing(null); load(); }} />
      <Dialog className="pe-dialog" header={t("opsAcc.fa.newAsset")} visible={!!form} style={{ width: "min(780px, 96vw)" }} onHide={() => openForm(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => openForm(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save" onClick={save} /></div>}>
        {form && (
          <div className="grid">
            <Field label={t("opsAcc.fa.name")} col="col-12 md:col-8" required error={errors.name}><InputText value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.class")} col="col-12 md:col-4" required error={errors.classCode}><Dropdown value={form.classCode} options={classes.map((c) => ({ label: c.name, value: c.code }))} onChange={(e) => setForm({ ...form, classCode: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.acquired")} col="col-12 md:col-4" required error={errors.acquisitionDate}><Calendar value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.fa.inService")} col="col-12 md:col-4" error={errors.inServiceDate}><Calendar value={form.inServiceDate} onChange={(e) => setForm({ ...form, inServiceDate: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.fa.cost")} col="col-12 md:col-4" required error={errors.cost}><InputNumber value={form.cost} mode="decimal" minFractionDigits={2} min={0} onValueChange={(e) => setForm({ ...form, cost: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.salvage")} col="col-12 md:col-4"><InputNumber value={form.salvageValue ?? null} mode="decimal" minFractionDigits={2} onValueChange={(e) => setForm({ ...form, salvageValue: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.lifeMonths")} col="col-12 md:col-4"><InputNumber value={form.usefulLifeMonths ?? null} min={1} max={600} placeholder={t("opsAcc.fa.fromClass")} onValueChange={(e) => setForm({ ...form, usefulLifeMonths: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.serial")} col="col-12 md:col-4"><InputText value={form.serialNumber || ""} maxLength={100} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.location")} col="col-12 md:col-6"><InputText value={form.location || ""} maxLength={200} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.custodian")} col="col-12 md:col-6"><InputText value={form.custodian || ""} maxLength={200} onChange={(e) => setForm({ ...form, custodian: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.opening")} col="col-12 md:col-6"><InputNumber value={form.openingAccumulated ?? null} mode="decimal" minFractionDigits={2} onValueChange={(e) => setForm({ ...form, openingAccumulated: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.fa.depreciateFrom")} col="col-12 md:col-6" error={errors.depreciateFrom}>
              <Calendar value={form.depreciateFrom || null} view="month" dateFormat="yy-mm" placeholder="YYYY-MM" showIcon showButtonBar onChange={(e) => setForm({ ...form, depreciateFrom: e.value })} className="w-full" />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** Accounts > Fixed Assets > Depreciation Run: what a period's depreciation is and posting it (also a step of the month-end close). */
export const DepreciationRun = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [period, setPeriod] = useState(new Date());
  const [data, setData] = useState(null);
  const key = isoOf(period)?.slice(0, 7);
  const load = useCallback(() => service.depreciationPreview(key).then(setData).catch((e) => showError(toast, e)), [key]);
  useEffect(() => { load(); }, [load]);
  const run = async () => {
    const ok = await openConfirm({
      title: t("opsAcc.confirmations.depreciation.title", { period: key }),
      message: t("opsAcc.confirmations.depreciation.message"),
      facts: [
        { label: t("opsAcc.period"), value: key },
        { label: t("opsAcc.fa.journalDate"), value: data.date, type: "date" },
        { label: t("opsAcc.fa.assets"), value: data.due.length, type: "number" },
        { label: t("opsAcc.amount"), value: data.total, type: "amount", emphasis: true },
      ],
      confirmLabel: t("opsAcc.confirmations.depreciation.post"),
    });
    if (!ok) return;
    try {
      const r = await service.runDepreciation(key);
      showSuccess(toast, t("opsAcc.fa.posted", { period: r.period, amount: money(r.amount), assets: r.assets }));
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.fa.run")} section={t("opsAcc.fa.menu")} subtitle={t("opsAcc.fa.runIntro")}>
        <Calendar value={period} onChange={(e) => e.value && setPeriod(e.value)} view="month" dateFormat="yy-mm" showIcon />
        <Button icon="pi pi-check" label={t("opsAcc.fa.post")} disabled={!data?.due.length} onClick={run} />
      </PageHeader>
      {data && (
        <StatCards items={[
          { key: "due", label: t("opsAcc.fa.due"), value: money(data.total), note: t("opsAcc.fa.assetsCount", { count: data.due.length }) },
          ...(data.posted ? [{ key: "posted", label: t("opsAcc.fa.alreadyPosted"), value: money(data.posted.amount), note: `${t("opsAcc.fa.assetsCount", { count: data.posted.assets })} · ${data.posted.journals}` }] : []),
          { key: "date", label: t("opsAcc.fa.journalDate"), value: date(data.date) },
        ]} />
      )}
      <div className="pe-card">
        <DataTable value={data?.due || []} dataKey="assetId" size="small" stripedRows emptyMessage={t("opsAcc.fa.nothingDue")}>
          <Column field="assetNumber" header={t("opsAcc.fa.number")} />
          <Column field="name" header={t("opsAcc.fa.name")} />
          <Column field="classCode" header={t("opsAcc.fa.class")} />
          <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
        </DataTable>
      </div>
    </div>
  );
};
