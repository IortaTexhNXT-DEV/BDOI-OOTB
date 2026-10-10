import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import { calendarDateFormat } from "../../utility/dateFormat";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import { RecordActivityLog } from "../../components/ActivityLog";
import { ClientPicker, Field, PageHeader, StatusTag, date, fieldErrors, fromIsoDay, isoDay, money, printFile, showError, showSuccess, useInsurers } from "./common";

const BASE = "/operations/fleet-schedules";
const EMPTY_VEHICLE = { plateNumber: "", conductionSticker: "", chassisNumber: "", engineNumber: "", make: "", model: "", yearModel: null, color: "", vehicleType: "private_cars",
  usage: "", mortgagee: "", sumInsured: null, ownDamageRate: 1.5, actsOfNatureRate: 0.5, bodilyInjury: 0, propertyDamage: 0, includeCtpl: true };

/** The same date a year later: the end of the period the API takes when none is given. */
const yearAfter = (d) => (d ? new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()) : null);
const dayAfter = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) : null);
const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const newFleet = () => ({ client: null, insuranceCompanyId: null, inceptionDate: startOfToday(), expiryDate: yearAfter(startOfToday()), expiryChanged: false, description: "" });

/** Operations > Fleet Schedules: the list of fleets, and one fleet with its schedule of vehicles. */
const FleetSchedules = () => {
  const { id } = useParams();
  return id ? <FleetDetail id={id} /> : <FleetList />;
};

const FleetList = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:fleet");
  const insurers = useInsurers();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: null, search: "" });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.fleets({ status: filters.status || undefined, search: filters.search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const open = () => { setForm(newFleet()); setErrors({}); };
  const close = () => { setForm(null); setErrors({}); };
  const setFrom = (value) => setForm((f) => ({ ...f, inceptionDate: value, expiryDate: f.expiryChanged ? f.expiryDate : yearAfter(value) }));
  const validate = () => {
    const out = {};
    if (!form.client?.id) out.clientId = t("distribution.fl.clientRequired", "Choose the client");
    if (!form.inceptionDate) out.inceptionDate = t("distribution.fl.fromRequired", "Enter the start of the period");
    if (form.inceptionDate && form.expiryDate && isoDay(form.expiryDate) <= isoDay(form.inceptionDate)) out.expiryDate = t("distribution.fl.toAfterFrom", "The period must end after it starts");
    setErrors(out);
    return !Object.keys(out).length;
  };
  const create = async () => {
    if (!validate()) return;
    try {
      const r = await service.createFleet({ clientId: form.client.id, insuranceCompanyId: form.insuranceCompanyId, inceptionDate: isoDay(form.inceptionDate),
        expiryDate: form.expiryDate ? isoDay(form.expiryDate) : null, description: form.description || null });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      setErrors(fieldErrors(e));
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} title={t("distribution.fl.title", "Fleet Schedules")}
        subtitle={t("distribution.fl.subtitle", "One motor policy covering many vehicles, each with its own premium and CTPL; vehicles added or deleted by endorsement at the pro-rata premium.")}>
        {write ? <Button label={t("distribution.fl.new", "New fleet schedule")} icon="pi pi-plus" onClick={open} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={filters.status} options={["draft", "issued", "cancelled"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")}
            onChange={(e) => setFilters({ ...filters, status: e.value || null })} />
          <span className="p-input-icon-left"><i className="pi pi-search" />
            <InputText value={filters.search} placeholder={t("distribution.fl.search", "Fleet, client or policy number")} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></span>
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} selectionMode="single" onRowClick={(e) => navigate(`${BASE}/${e.data.id}`)}
          emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="fleetNumber" header={t("distribution.fl.number", "Fleet schedule")} />
          <Column field="clientName" header={t("distribution.fl.client", "Client")} />
          <Column field="insurerName" header={t("distribution.fl.insurer", "Insurer")} />
          <Column field="policyNumber" header={t("distribution.fl.policy", "Policy")} />
          <Column header={t("distribution.fl.period", "Period")} body={(r) => `${date(r.inceptionDate)} to ${date(r.expiryDate)}`} />
          <Column field="activeVehicles" header={t("distribution.fl.vehicles", "Vehicles on cover")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fl.sumInsured", "Sum insured")} body={(r) => money(r.sumInsured)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fl.annualPremium", "Annual premium")} body={(r) => money(r.grossPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={t("distribution.fl.new", "New fleet schedule")} visible={!!form} style={{ width: "min(640px, 96vw)" }} onHide={close}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={close} /><Button label={t("distribution.fl.start", "Start")} icon="pi pi-check" onClick={create} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.fl.client", "Client")} full required error={errors.clientId}>
              <ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder={t("distribution.fl.findClient", "Find the client")} />
            </Field>
            <Field label={t("distribution.fl.insurer", "Insurer")} help={t("distribution.fl.insurerHelp", "Can be chosen later, before the policy is issued")}>
              <Dropdown value={form.insuranceCompanyId} options={insurers} filter showClear onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value || null })} />
            </Field>
            <Field label={t("distribution.fl.from", "Period from")} required error={errors.inceptionDate}>
              <Calendar value={form.inceptionDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setFrom(e.value)} />
            </Field>
            <Field label={t("distribution.fl.to", "Period to")} error={errors.expiryDate} help={t("distribution.fl.toHelp", "One year after the start, unless you change it")}>
              <Calendar value={form.expiryDate} dateFormat="yy-mm-dd" showIcon showButtonBar minDate={dayAfter(form.inceptionDate)}
                onChange={(e) => setForm({ ...form, expiryDate: e.value, expiryChanged: true })} />
            </Field>
            <Field label={t("distribution.common.description", "Description")} full><InputText value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

const FleetDetail = ({ id }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const write = hasPermission("write:fleet");
  const insurers = useInsurers();
  const [fleet, setFleet] = useState(null);
  const [vehicle, setVehicle] = useState(null); // { mode: add | edit | endorse, data }
  const [removing, setRemoving] = useState(null); // { vehicle, effectiveDate, reason }: deletion by endorsement
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setFleet(await service.fleet(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, reload = true) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      if (reload) await load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const saveVehicle = async () => {
    const { mode, data, effectiveDate } = vehicle;
    const body = { ...data, yearModel: data.yearModel || null };
    delete body.id;
    const r = await run(() => {
      if (mode === "endorse") return service.endorseAddVehicle(fleet.id, { ...body, effectiveDate: isoDay(effectiveDate) });
      if (mode === "edit") return service.updateVehicle(fleet.id, data.id, body);
      return service.addVehicle(fleet.id, body);
    });
    if (r) setVehicle(null);
  };
  const vehicleFacts = (v) => [
    { label: t("distribution.fl.item", "Item"), value: v.itemNo },
    { label: t("distribution.fl.plate", "Plate / CS"), value: v.plateNumber || v.conductionSticker },
    { label: t("distribution.mp.vehicle", "Vehicle"), value: [v.yearModel, v.make, v.model].filter(Boolean).join(" ") },
    { label: t("distribution.fl.sumInsured", "Sum insured"), value: v.sumInsured, type: "amount" },
    { label: t("distribution.fl.total", "Total"), value: v.grossPremium, type: "amount" },
  ];
  // an action asked in a confirmation: it runs in the dialog (a failure stays there), then the fleet is reloaded
  const confirmRun = async (options, fn) => {
    let result = null;
    const done = await openConfirm({ ...options, onConfirm: async () => { result = await fn(); } });
    if (!done) return;
    if (result?.message) showSuccess(toast, result.message);
    await load();
  };
  const deleteVehicle = (v) => {
    if (fleet.status === "draft") {
      confirmRun({
        title: t("distribution.fl.removeVehicleTitle", "Remove vehicle"),
        severity: "danger",
        message: t("distribution.fl.removeVehicleMessage", "The vehicle is removed from the draft schedule."),
        facts: vehicleFacts(v),
        confirmLabel: t("distribution.fl.removeVehicleAction", "Remove vehicle"),
      }, () => service.removeVehicle(fleet.id, v.id));
      return;
    }
    setRemoving({ vehicle: v, effectiveDate: new Date(), reason: "" });
  };
  const endorseDelete = async () => {
    const r = await run(() => service.endorseDeleteVehicle(fleet.id, removing.vehicle.id, { effectiveDate: isoDay(removing.effectiveDate), reason: removing.reason.trim() || undefined }));
    if (r) setRemoving(null);
  };
  const upload = async (file) => {
    if (!file) return;
    const r = await run(() => service.uploadVehicles(fleet.id, file));
    if (r?.data?.errors?.length) showError(toast, new Error(r.data.errors.slice(0, 5).map((e) => `${t("distribution.mp.row", "Row")} ${e.row}: ${e.message}`).join(" | ")));
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!fleet) return <div className="pe-page"><Toast ref={toast} /></div>;
  const draft = fleet.status === "draft";
  const issued = fleet.status === "issued";
  const set = (patch) => setVehicle((v) => ({ ...v, data: { ...v.data, ...patch } }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.fl.title", "Fleet Schedules")} title={`${fleet.fleetNumber} · ${fleet.clientName}`}
        subtitle={`${fleet.insurerName || t("distribution.fl.noInsurer", "Insurer not chosen")} · ${date(fleet.inceptionDate)} to ${date(fleet.expiryDate)}${fleet.policyNumber ? ` · ${t("distribution.fl.policy", "Policy")} ${fleet.policyNumber}` : ""}`}>
        <Button label={t("distribution.common.back", "Back")} icon="pi pi-arrow-left" text onClick={() => navigate(BASE)} />
        <Button label={t("distribution.fl.printSchedule", "Print schedule")} icon="pi pi-print" outlined
          onClick={() => printFile(toast, `/fleet/${encodeURIComponent(fleet.id)}/schedule.pdf`, `${fleet.fleetNumber}.pdf`)} />
        <Button label={t("distribution.fl.export", "Excel")} icon="pi pi-file-excel" outlined onClick={() => run(() => service.fleetScheduleXlsx(fleet.id), false)} />
        {write && draft ? <Button label={t("distribution.fl.issue", "Issue policy")} icon="pi pi-check" disabled={busy || !fleet.vehicleList.length}
          onClick={() => confirmRun({
            title: t("distribution.fl.issueTitle", "Issue fleet policy"),
            message: t("distribution.fl.issueMessage", "One policy is issued for the vehicles on the schedule."),
            facts: [
              { label: t("distribution.fl.number", "Fleet schedule"), value: fleet.fleetNumber },
              { label: t("distribution.fl.client", "Client"), value: fleet.clientName },
              { label: t("distribution.fl.insurer", "Insurer"), value: fleet.insurerName },
              { label: t("distribution.fl.period", "Period"), value: `${date(fleet.inceptionDate)} – ${date(fleet.expiryDate)}` },
              { label: t("distribution.fl.vehicles", "Vehicles on cover"), value: fleet.activeVehicles, type: "number" },
              { label: t("distribution.fl.sumInsured", "Sum insured"), value: fleet.sumInsured, type: "amount" },
              { label: t("distribution.fl.annualPremium", "Annual premium"), value: fleet.grossPremium, type: "amount", emphasis: true },
            ],
            note: t("distribution.fl.issueNote", "The total premium is billed to the client."),
            confirmLabel: t("distribution.fl.issue", "Issue policy"),
          }, () => service.issueFleet(fleet.id))} /> : null}
      </PageHeader>
      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.common.status", "Status")}</div><div className="pe-kpi-value"><StatusTag status={fleet.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fl.vehicles", "Vehicles on cover")}</div><div className="pe-kpi-value">{fleet.activeVehicles}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fl.sumInsured", "Sum insured")}</div><div className="pe-kpi-value">{money(fleet.sumInsured)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.fl.annualPremium", "Annual premium")}</div><div className="pe-kpi-value">{money(fleet.grossPremium)}</div></div>
      </div>
      {draft && write ? (
        <div className="pe-card">
          <div className="dist-grid">
            <Field label={t("distribution.fl.insurer", "Insurer")}>
              <Dropdown value={fleet.insuranceCompanyId} options={insurers} filter onChange={(e) => run(() => service.updateFleet(fleet.id, { insuranceCompanyId: e.value }))} />
            </Field>
          </div>
        </div>
      ) : null}
      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("distribution.fl.scheduleOfVehicles", "Schedule of vehicles")}</span>
          {write && (draft || issued) ? (
            <div className="dist-actions">
              {draft ? (
                <>
                  <Button label={t("distribution.mp.template", "Template")} icon="pi pi-download" outlined size="small" onClick={() => run(() => service.fleetTemplate(), false)} />
                  <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => upload(e.target.files?.[0])} aria-label={t("distribution.fl.uploadVehicles", "Upload vehicles")} />
                  <Button label={t("distribution.fl.uploadVehicles", "Upload vehicles")} icon="pi pi-upload" outlined size="small" disabled={busy} onClick={() => fileRef.current?.click()} />
                  <Button label={t("distribution.fl.addVehicle", "Add vehicle")} icon="pi pi-plus" size="small" onClick={() => setVehicle({ mode: "add", data: { ...EMPTY_VEHICLE } })} />
                </>
              ) : (
                <Button label={t("distribution.fl.endorseAdd", "Add vehicle by endorsement")} icon="pi pi-plus" size="small" onClick={() => setVehicle({ mode: "endorse", data: { ...EMPTY_VEHICLE }, effectiveDate: new Date() })} />
              )}
            </div>
          ) : null}
        </div>
        <DataTable value={fleet.vehicleList} dataKey="id" size="small" stripedRows paginator rows={25} emptyMessage={t("distribution.fl.noVehicles", "No vehicle yet")}>
          <Column field="itemNo" header="#" style={{ width: "3.5rem" }} />
          <Column header={t("distribution.fl.plate", "Plate / CS")} body={(v) => v.plateNumber || v.conductionSticker} />
          <Column header={t("distribution.mp.vehicle", "Vehicle")} body={(v) => [v.yearModel, v.make, v.model].filter(Boolean).join(" ")} />
          <Column field="chassisNumber" header={t("distribution.fl.chassis", "Chassis")} />
          <Column field="vehicleType" header={t("distribution.fl.class", "Class")} />
          <Column header={t("distribution.fl.sumInsured", "Sum insured")} body={(v) => money(v.sumInsured)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fl.premium", "Premium")} body={(v) => money(v.netPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.mp.taxes", "Taxes")} body={(v) => money(v.taxes)} className="bv-num" headerClassName="bv-num" />
          <Column header="CTPL" body={(v) => money(v.ctplPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fl.total", "Total")} body={(v) => money(v.grossPremium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.fl.onCover", "On cover")} body={(v) => `${date(v.coverFrom)} to ${date(v.coverTo)}`} />
          <Column header={t("distribution.fl.endorsement", "Endorsement")} body={(v) => [v.addedEndorsementNumber, v.deletedEndorsementNumber].filter(Boolean).join(" / ")} />
          <Column header={t("distribution.common.status", "Status")} body={(v) => <StatusTag status={v.status} />} />
          {write ? <Column body={(v) => (v.status === "active" && (draft || issued) ? (
            <div className="dist-actions">
              {draft ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setVehicle({ mode: "edit", data: { ...EMPTY_VEHICLE, ...v } })} /> : null}
              <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={draft ? t("distribution.common.delete", "Delete") : t("distribution.fl.endorseDelete", "Delete by endorsement")}
                tooltip={draft ? null : t("distribution.fl.endorseDelete", "Delete by endorsement")} onClick={() => deleteVehicle(v)} />
            </div>
          ) : null)} /> : null}
        </DataTable>
      </div>
      {fleet.endorsements.length ? (
        <div className="pe-card">
          <div className="pe-card-title">{t("distribution.fl.endorsements", "Endorsements")}</div>
          <DataTable value={fleet.endorsements} dataKey="id" size="small" stripedRows>
            <Column field="endorsementNumber" header={t("distribution.fl.endorsement", "Endorsement")} />
            <Column field="type" header={t("distribution.fl.type", "Type")} />
            <Column header={t("distribution.fl.effective", "Effective")} body={(e) => date(e.effectiveDate)} />
            <Column field="remarks" header={t("distribution.common.description", "Description")} />
            <Column header={t("distribution.fl.premiumChange", "Premium change")} body={(e) => money(e.premiumDelta)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("distribution.common.status", "Status")} body={(e) => <StatusTag status={e.status} />} />
          </DataTable>
        </div>
      ) : null}

      <div className="pe-card">
        <div className="pe-card-title">{t("distribution.common.history", "History")}</div>
        <RecordActivityLog entity="fleet_schedule" recordId={fleet.id} />
      </div>

      <DetailDialog visible={!!removing} onHide={() => setRemoving(null)} size="md" header={t("distribution.fl.endorseDelete", "Delete by endorsement")}
        footer={(
          <>
            <Button type="button" label={t("distribution.common.cancel", "Cancel")} text onClick={() => setRemoving(null)} />
            <Button type="button" label={t("distribution.fl.endorseDeleteAction", "Delete vehicle")} severity="danger" loading={busy} disabled={!removing?.effectiveDate} onClick={endorseDelete} />
          </>
        )}>
        {removing && (
          <>
            <KeyValueGrid columns={3} items={[...vehicleFacts(removing.vehicle),
              { label: t("distribution.fl.onCover", "On cover"), value: `${date(removing.vehicle.coverFrom)} – ${date(removing.vehicle.coverTo)}` }]} />
            <div className="dist-grid mt-3">
              <Field label={t("distribution.fl.effective", "Effective")} htmlFor="fl-delete-from" help={t("distribution.fl.returnHelp", "The return premium is the vehicle's annual premium for the days left in the period")}>
                <Calendar inputId="fl-delete-from" value={removing.effectiveDate} dateFormat={calendarDateFormat()} showIcon
                  minDate={fromIsoDay(removing.vehicle.coverFrom) || undefined} maxDate={fromIsoDay(removing.vehicle.coverTo || fleet.expiryDate) || undefined}
                  onChange={(e) => setRemoving({ ...removing, effectiveDate: e.value })} />
              </Field>
              <Field label={t("distribution.fl.deleteReasonLabel", "Reason")} htmlFor="fl-delete-reason">
                <InputText id="fl-delete-reason" value={removing.reason} placeholder={t("distribution.fl.deleteReasonHint", "Vehicle sold, total loss ...")}
                  onChange={(e) => setRemoving({ ...removing, reason: e.target.value })} />
              </Field>
            </div>
          </>
        )}
      </DetailDialog>

      <Dialog className="pe-dialog" visible={!!vehicle} style={{ width: "min(820px, 96vw)" }} onHide={() => setVehicle(null)}
        header={vehicle?.mode === "endorse" ? t("distribution.fl.endorseAdd", "Add vehicle by endorsement") : vehicle?.mode === "edit" ? t("distribution.fl.editVehicle", "Edit vehicle") : t("distribution.fl.addVehicle", "Add vehicle")}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setVehicle(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" loading={busy} onClick={saveVehicle} disabled={!vehicle?.data.make || !vehicle?.data.sumInsured} /></div>}>
        {vehicle && (
          <div className="dist-grid">
            {vehicle.mode === "endorse" ? (
              <Field label={t("distribution.fl.effective", "Effective")} full help={t("distribution.fl.proRataHelp", "The premium is the vehicle's annual premium for the days left in the period")}>
                <Calendar value={vehicle.effectiveDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setVehicle({ ...vehicle, effectiveDate: e.value })} />
              </Field>
            ) : null}
            {[["plateNumber", "Plate number"], ["conductionSticker", "Conduction sticker"], ["chassisNumber", "Chassis number"], ["engineNumber", "Engine number"], ["make", "Make"], ["model", "Model"],
              ["color", "Colour"], ["vehicleType", "Vehicle class (CTPL tariff)"], ["usage", "Usage"], ["mortgagee", "Mortgagee"]].map(([k, label]) => (
              <Field key={k} label={t(`distribution.fl.v.${k}`, label)}><InputText value={vehicle.data[k] || ""} onChange={(e) => set({ [k]: e.target.value })} /></Field>
            ))}
            <Field label={t("distribution.fl.v.yearModel", "Year model")}><InputNumber value={vehicle.data.yearModel} useGrouping={false} onValueChange={(e) => set({ yearModel: e.value })} /></Field>
            <Field label={t("distribution.fl.sumInsured", "Sum insured")}><InputNumber value={vehicle.data.sumInsured} min={0} onValueChange={(e) => set({ sumInsured: e.value })} /></Field>
            <Field label={t("distribution.mp.odRate", "Own damage rate %")}><InputNumber value={vehicle.data.ownDamageRate} min={0} maxFractionDigits={4} onValueChange={(e) => set({ ownDamageRate: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.aonRate", "Acts of nature rate %")}><InputNumber value={vehicle.data.actsOfNatureRate} min={0} maxFractionDigits={4} onValueChange={(e) => set({ actsOfNatureRate: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.bi", "Excess bodily injury")}><InputNumber value={vehicle.data.bodilyInjury} min={0} onValueChange={(e) => set({ bodilyInjury: e.value ?? 0 })} /></Field>
            <Field label={t("distribution.mp.pd", "Property damage")}><InputNumber value={vehicle.data.propertyDamage} min={0} onValueChange={(e) => set({ propertyDamage: e.value ?? 0 })} /></Field>
            <Field label="CTPL">
              <span className="flex align-items-center gap-2"><Checkbox inputId="fl-ctpl" checked={!!vehicle.data.includeCtpl} onChange={(e) => set({ includeCtpl: e.checked })} />
                <label htmlFor="fl-ctpl">{t("distribution.mp.includeCtpl", "Include CTPL")}</label></span>
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default FleetSchedules;
