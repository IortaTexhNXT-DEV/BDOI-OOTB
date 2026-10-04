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
import { confirmAction, promptText } from "../../utility/dialogs";
import { ClientPicker, Field, PageHeader, StatusTag, date, isoDay, money, showError, showSuccess, useInsurers } from "./common";

const BASE = "/operations/fleet-schedules";
const EMPTY_VEHICLE = { plateNumber: "", conductionSticker: "", chassisNumber: "", engineNumber: "", make: "", model: "", yearModel: null, color: "", vehicleType: "private_cars",
  usage: "", mortgagee: "", sumInsured: null, ownDamageRate: 1.5, actsOfNatureRate: 0.5, bodilyInjury: 0, propertyDamage: 0, includeCtpl: true };

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

  const create = async () => {
    try {
      const r = await service.createFleet({ clientId: form.client.id, insuranceCompanyId: form.insuranceCompanyId, inceptionDate: isoDay(form.inceptionDate),
        expiryDate: form.expiryDate ? isoDay(form.expiryDate) : null, description: form.description || null });
      showSuccess(toast, r.message);
      navigate(`${BASE}/${r.data.id}`);
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} title={t("distribution.fl.title", "Fleet Schedules")}
        subtitle={t("distribution.fl.subtitle", "One motor policy covering many vehicles, each with its own premium and CTPL; vehicles added or deleted by endorsement at the pro-rata premium.")}>
        {write ? <Button label={t("distribution.fl.new", "New fleet schedule")} icon="pi pi-plus" onClick={() => setForm({ client: null, insuranceCompanyId: null, inceptionDate: new Date(), expiryDate: null, description: "" })} /> : null}
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
      <Dialog className="pe-dialog" header={t("distribution.fl.new", "New fleet schedule")} visible={!!form} style={{ width: "min(640px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.fl.start", "Start")} icon="pi pi-check" onClick={create} disabled={!form?.client?.id || !form?.inceptionDate} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.fl.client", "Client")} full><ClientPicker value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder={t("distribution.fl.findClient", "Find the client")} /></Field>
            <Field label={t("distribution.fl.insurer", "Insurer")}><Dropdown value={form.insuranceCompanyId} options={insurers} filter showClear onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value || null })} /></Field>
            <Field label={t("distribution.fl.from", "Period from")}><Calendar value={form.inceptionDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setForm({ ...form, inceptionDate: e.value })} /></Field>
            <Field label={t("distribution.fl.to", "Period to")} help={t("distribution.fl.toHelp", "One year when empty")}><Calendar value={form.expiryDate} dateFormat="yy-mm-dd" showIcon onChange={(e) => setForm({ ...form, expiryDate: e.value })} /></Field>
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
  const deleteVehicle = async (v) => {
    if (fleet.status === "draft") {
      if (await confirmAction(t("distribution.fl.removeVehicle", "Remove item {{item}} from the draft schedule?", { item: v.itemNo }), { danger: true })) run(() => service.removeVehicle(fleet.id, v.id));
      return;
    }
    const when = await promptText(t("distribution.fl.deleteFrom", "Delete item {{item}} by endorsement: effective date (YYYY-MM-DD)", { item: v.itemNo }), isoDay(new Date()), { multiline: false });
    if (!when) return;
    const reason = await promptText(t("distribution.fl.deleteReason", "Reason (vehicle sold, total loss ...)"), "", { multiline: false });
    if (reason === null) return;
    run(() => service.endorseDeleteVehicle(fleet.id, v.id, { effectiveDate: when, reason: reason || undefined }));
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
        <Button label={t("distribution.fl.print", "Schedule PDF")} icon="pi pi-file-pdf" outlined onClick={() => run(() => service.fleetSchedulePdf(fleet.id), false)} />
        <Button label={t("distribution.fl.export", "Excel")} icon="pi pi-file-excel" outlined onClick={() => run(() => service.fleetScheduleXlsx(fleet.id), false)} />
        {write && draft ? <Button label={t("distribution.fl.issue", "Issue policy")} icon="pi pi-check" disabled={busy || !fleet.vehicleList.length}
          onClick={async () => { if (await confirmAction(t("distribution.fl.confirmIssue", "Issue one policy for the {{count}} vehicles and bill the total premium?", { count: fleet.activeVehicles }))) run(() => service.issueFleet(fleet.id)); }} /> : null}
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
