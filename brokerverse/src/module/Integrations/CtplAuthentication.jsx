import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import { IntTag, PageHeader, dateTime, insurerOptions, isoDay, showError, showSuccess } from "./common";

const STATUSES = ["pending", "requested", "authenticated", "failed", "cancelled"];
const VEHICLE = ["plateNumber", "mvFileNumber", "chassisNumber", "engineNumber", "cocNumber"];

/** COC series received from the insurers: numbers left, low stock, close a series. */
const CocSeries = ({ toast, insurers }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [rangeError, setRangeError] = useState(null);
  const openForm = (value) => { setRangeError(null); setForm(value); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.cocSeries());
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    const wrong = form.seriesTo < form.seriesFrom ? t("integrations.toBeforeFrom") : null;
    setRangeError(wrong);
    if (wrong) return;
    try {
      const r = await service.createCocSeries({ insuranceCompanyId: form.insuranceCompanyId, branchCode: form.branchCode || null, prefix: form.prefix || "", seriesFrom: form.seriesFrom,
        seriesTo: form.seriesTo, numberWidth: form.numberWidth, receivedDate: isoDay(form.receivedDate), lowStockThreshold: form.lowStockThreshold, remarks: form.remarks || null });
      showSuccess(toast, r.message);
      openForm(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const toggle = async (s) => {
    try {
      const r = await service.updateCocSeries(s.id, { status: s.status === "active" ? "closed" : "active" });
      showSuccess(toast, r.message);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <>
      <div className="flex justify-content-end mb-2">
        <Button icon="pi pi-plus" label={t("integrations.newSeries")} onClick={() => openForm({ insuranceCompanyId: null, branchCode: "", prefix: "", seriesFrom: null, seriesTo: null, numberWidth: 8, receivedDate: new Date(), lowStockThreshold: 20, remarks: "" })} />
      </div>
      <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("integrations.noSeries")}>
        <Column field="insurerName" header={t("integrations.insurer")} />
        <Column header={t("integrations.branch")} body={(s) => s.branchCode || t("integrations.allBranches")} />
        <Column header={t("integrations.range")} body={(s) => `${s.prefix}${String(s.seriesFrom).padStart(s.numberWidth, "0")} to ${s.prefix}${String(s.seriesTo).padStart(s.numberWidth, "0")}`} />
        <Column field="used" header={t("integrations.used")} />
        <Column header={t("integrations.remaining")} body={(s) => <span className={s.lowStock ? "text-orange-600 font-bold" : ""}>{s.remaining}</span>} />
        <Column header={t("integrations.status.label")} body={(s) => <IntTag status={s.status} />} />
        <Column header="" body={(s) => (s.status === "exhausted" ? null : (
          <Button icon={s.status === "active" ? "pi pi-lock" : "pi pi-lock-open"} text rounded size="small" aria-label={t(s.status === "active" ? "integrations.closeSeries" : "integrations.reopenSeries")}
            tooltip={t(s.status === "active" ? "integrations.closeSeries" : "integrations.reopenSeries")} tooltipOptions={{ position: "top" }} onClick={() => toggle(s)} />
        ))} />
      </DataTable>
      <Dialog className="pe-dialog" header={t("integrations.newSeries")} visible={!!form} style={{ width: "min(720px, 96vw)" }} onHide={() => openForm(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => openForm(null)} /><Button label={t("integrations.save")} icon="pi pi-save" onClick={save}
          disabled={!form?.insuranceCompanyId || form?.seriesFrom === null || form?.seriesTo === null} /></div>}>
        {form && (
          <div className="grid">
            <div className="col-12 md:col-8"><label>{t("integrations.insurer")} *</label>
              <Dropdown value={form.insuranceCompanyId} options={insurers} filter onChange={(e) => setForm({ ...form, insuranceCompanyId: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("integrations.branch")}</label>
              <InputText value={form.branchCode} maxLength={20} placeholder={t("integrations.allBranches")} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} className="w-full" /></div>
            <div className="col-6 md:col-3"><label>{t("integrations.prefix")}</label>
              <InputText value={form.prefix} maxLength={10} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} className="w-full" /></div>
            <div className="col-6 md:col-3"><label>{t("integrations.from")} *</label><InputNumber value={form.seriesFrom} useGrouping={false} min={0} onValueChange={(e) => setForm({ ...form, seriesFrom: e.value })} className="w-full" /></div>
            <div className="col-6 md:col-3"><label>{t("integrations.to")} *</label><InputNumber value={form.seriesTo} useGrouping={false} min={0} onValueChange={(e) => setForm({ ...form, seriesTo: e.value })} className={`w-full${rangeError ? " p-invalid" : ""}`} />
              {rangeError ? <small className="p-error block mt-1" role="alert">{rangeError}</small> : null}</div>
            <div className="col-6 md:col-3"><label>{t("integrations.digits")}</label><InputNumber value={form.numberWidth} min={1} max={20} onValueChange={(e) => setForm({ ...form, numberWidth: e.value })} className="w-full" /></div>
            <div className="col-6 md:col-4"><label>{t("integrations.received")}</label><Calendar value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.value })} dateFormat="yy-mm-dd" className="w-full" /></div>
            <div className="col-6 md:col-4"><label>{t("integrations.lowStock")}</label><InputNumber value={form.lowStockThreshold} min={0} onValueChange={(e) => setForm({ ...form, lowStockThreshold: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("integrations.remarks")}</label><InputText value={form.remarks} maxLength={500} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>
    </>
  );
};

/**
 * Operations > CTPL Authentication: every CTPL cover with its COC number and authentication code. Authenticate
 * (request to the IC-accredited provider), enter the code obtained on the provider's portal, correct the vehicle
 * details, the unauthenticated CTPL report, and the COC series per insurer and branch.
 */
const CtplAuthentication = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [tab, setTab] = useState(0);
  const [insurers, setInsurers] = useState([]);
  const [filters, setFilters] = useState({ status: null, unauthenticated: true, insuranceCompanyId: null, search: "" });
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(null);
  const [edit, setEdit] = useState(null);
  const [manual, setManual] = useState(null);
  const [register, setRegister] = useState(null);
  useEffect(() => { insurerOptions().then(setInsurers).catch((e) => showError(toast, e)); }, []);

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const r = await service.ctplList({ status: filters.status, unauthenticated: filters.unauthenticated ? "true" : undefined, insuranceCompanyId: filters.insuranceCompanyId,
      search: filters.search.trim(), page, pageSize });
    setCounts(r.counts);
    return r;
  }, [filters]);
  const list = useServerList(fetchPage, { key: "ctpl-authentications" });

  const run = async (key, fn, after) => {
    setBusy(key);
    try {
      const r = await fn();
      showSuccess(toast, r.message);
      if (after) after();
      list.reload();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Operations")} section={t("sidebar.Policy")} title={t("integrations.ctplTitle")} subtitle={t("integrations.ctplIntro")}>
        <Button icon="pi pi-plus" label={t("integrations.registerPolicy")} outlined onClick={() => setRegister({ policyNumber: "", cocNumber: "" })} />
        <Button icon="pi pi-file-excel" label={t("integrations.unauthenticatedReport")} onClick={() => service.ctplReport("xlsx").catch((e) => showError(toast, e))} />
      </PageHeader>
      <div className="pe-kpis">
        {STATUSES.slice(0, 4).map((s) => (
          <div key={s} className="pe-kpi"><div className="pe-kpi-label">{t(`integrations.status.${s}`)}</div><div className="pe-kpi-value">{counts[s] || 0}</div></div>
        ))}
      </div>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("integrations.covers")}>
            <div className="pe-filters mb-2">
              <span className="p-input-icon-left"><i className="pi pi-search" />
                <InputText value={filters.search} placeholder={t("integrations.searchCtpl")} aria-label={t("integrations.searchCtpl")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></span>
              <Dropdown value={filters.status} showClear placeholder={t("integrations.allStatuses")} aria-label={t("integrations.status.label")} options={STATUSES.map((s) => ({ label: t(`integrations.status.${s}`), value: s }))}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.value, unauthenticated: e.value ? false : f.unauthenticated }))} />
              <Dropdown value={filters.insuranceCompanyId} showClear filter placeholder={t("integrations.allInsurers")} aria-label={t("integrations.insurer")} options={insurers}
                onChange={(e) => setFilters((f) => ({ ...f, insuranceCompanyId: e.value }))} />
              <span className="flex align-items-center gap-2">
                <Checkbox inputId="ctpl-unauth" checked={filters.unauthenticated} onChange={(e) => setFilters((f) => ({ ...f, unauthenticated: e.checked, status: e.checked ? null : f.status }))} />
                <label htmlFor="ctpl-unauth" className="m-0">{t("integrations.onlyUnauthenticated")}</label>
              </span>
            </div>
            <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("integrations.noCovers")}>
              <Column header={t("integrations.policy")} body={(r) => <div><div>{r.policyNumber}</div><div className="pe-muted">{r.insuredName}</div></div>} />
              <Column field="insurerName" header={t("integrations.insurer")} />
              <Column header={t("integrations.cocNumber")} body={(r) => r.cocNumber || <span className="text-orange-600">{t("integrations.noCoc")}</span>} />
              <Column header={t("integrations.vehicle")} body={(r) => [r.plateNumber, r.mvFileNumber, r.chassisNumber].filter(Boolean).join(" · ") || "-"} />
              <Column header={t("integrations.status.label")} body={(r) => <span className="flex gap-1 flex-wrap"><IntTag status={r.status} />{r.overdue && <IntTag status="failed" />}</span>} />
              <Column header={t("integrations.authCode")} body={(r) => (r.authCode ? <div><div className="int-mono">{r.authCode}</div><div className="pe-muted">{t(`integrations.methods.${r.method}`, { defaultValue: r.method || "" })}</div></div> : "-")} />
              <Column header={t("integrations.lto")} body={(r) => <IntTag status={r.ltoStatus} />} />
              <Column header={t("integrations.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "18rem", wordBreak: "break-word" }} />
              <Column header={t("integrations.registered")} body={(r) => dateTime(r.createdAt)} />
              <Column header="" body={(r) => (["authenticated", "cancelled"].includes(r.status) ? null : (
                <span className="flex gap-1">
                  <Button icon="pi pi-verified" text rounded size="small" loading={busy === r.id} aria-label={t("integrations.authenticate")} tooltip={t("integrations.authenticate")} tooltipOptions={{ position: "top" }}
                    onClick={() => run(r.id, () => service.ctplAuthenticate(r.id))} />
                  <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("integrations.editVehicle")} tooltip={t("integrations.editVehicle")} tooltipOptions={{ position: "top" }}
                    onClick={() => setEdit({ id: r.id, ...Object.fromEntries(VEHICLE.map((k) => [k, r[k] || ""])) })} />
                  <Button icon="pi pi-keyboard" text rounded size="small" aria-label={t("integrations.enterCode")} tooltip={t("integrations.enterCode")} tooltipOptions={{ position: "top" }}
                    onClick={() => setManual({ id: r.id, cocNumber: r.cocNumber || "", authCode: "", providerReference: "", authenticatedAt: new Date() })} />
                </span>
              ))} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("integrations.cocSeries")}>
            {tab === 1 && <CocSeries toast={toast} insurers={insurers} />}
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={t("integrations.editVehicle")} visible={!!edit} style={{ width: "min(640px, 96vw)" }} onHide={() => setEdit(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setEdit(null)} /><Button label={t("integrations.save")} icon="pi pi-save"
          onClick={() => run("edit", () => service.ctplUpdate(edit.id, Object.fromEntries(VEHICLE.filter((k) => edit[k]).map((k) => [k, edit[k]]))), () => setEdit(null))} /></div>}>
        {edit && (
          <div className="grid">
            {VEHICLE.map((k) => (
              <div className="col-12 md:col-6" key={k}><label>{t(`integrations.fields.${k}`)}</label>
                <InputText value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="w-full" /></div>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("integrations.enterCode")} visible={!!manual} style={{ width: "min(560px, 96vw)" }} onHide={() => setManual(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setManual(null)} /><Button label={t("integrations.save")} icon="pi pi-save" disabled={!manual?.authCode || manual.authCode.trim().length < 4}
          onClick={() => run("manual", () => service.ctplManual(manual.id, { authCode: manual.authCode.trim(), providerReference: manual.providerReference || undefined, cocNumber: manual.cocNumber || undefined,
            authenticatedAt: isoDay(manual.authenticatedAt) }), () => setManual(null))} /></div>}>
        {manual && (
          <div className="grid">
            <div className="col-12"><p className="pe-muted mt-0">{t("integrations.manualHelp")}</p></div>
            <div className="col-12 md:col-6"><label>{t("integrations.cocNumber")}</label><InputText value={manual.cocNumber} onChange={(e) => setManual({ ...manual, cocNumber: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.authCode")} *</label><InputText value={manual.authCode} onChange={(e) => setManual({ ...manual, authCode: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.providerReference")}</label><InputText value={manual.providerReference} onChange={(e) => setManual({ ...manual, providerReference: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("integrations.authenticatedOn")}</label><Calendar value={manual.authenticatedAt} onChange={(e) => setManual({ ...manual, authenticatedAt: e.value })} dateFormat="yy-mm-dd" className="w-full" /></div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("integrations.registerPolicy")} visible={!!register} style={{ width: "min(520px, 96vw)" }} onHide={() => setRegister(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setRegister(null)} /><Button label={t("integrations.save")} icon="pi pi-save" disabled={!register?.policyNumber}
          onClick={() => run("register", () => service.ctplRegister({ policyNumber: register.policyNumber.trim(), cocNumber: register.cocNumber.trim() || undefined }), () => setRegister(null))} /></div>}>
        {register && (
          <div className="grid">
            <div className="col-12"><label>{t("integrations.policyNumber")} *</label><InputText value={register.policyNumber} onChange={(e) => setRegister({ ...register, policyNumber: e.target.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("integrations.cocNumber")}</label><InputText value={register.cocNumber} placeholder={t("integrations.cocFromSeries")} onChange={(e) => setRegister({ ...register, cocNumber: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default CtplAuthentication;
