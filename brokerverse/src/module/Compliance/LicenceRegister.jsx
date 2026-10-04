import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { FormDialog, PageHeader, StateTag, Stats, asOptions, showDate } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

const HOLDER_TYPES = ["firm", "officer", "individual", "referrer"];
const RENEWAL = ["not-due", "due", "in-progress", "filed", "renewed", "lapsed"];
const EMPTY = { holderType: "referrer", referrerId: null, userId: null, holderName: "", position: "", licenceType: null, licenceNumber: "", issuingAuthority: "Insurance Commission",
  linesAuthorised: "", issueDate: null, expiryDate: null, renewalStatus: "not-due", renewalFiledOn: null, renewalReference: "", remarks: "", documents: [] };

/**
 * Compliance > Insurance Commission > Licence Register: licences of the firm, its officers and licensed individuals and
 * of the agents and referrers paid commission; the expiry calendar shows what expires in the next twelve months and
 * the referrers whose commission is held for want of a licence.
 */
const LicenceRegister = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ state: null, holderType: null, search: "" });
  const [holders, setHolders] = useState({ referrers: [], users: [], licenceTypes: [] });
  const [form, setForm] = useState(null);
  const [renew, setRenew] = useState(null);
  const [saving, setSaving] = useState(false);

  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([complianceService.licences(filters), complianceService.licenceDashboard()]);
      setRows(r.items);
      setSummary(r.summary || {});
      setDash(d);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { complianceService.licenceHolders("").then(setHolders).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    const body = Object.fromEntries(Object.entries(form).filter(([k]) => !["id", "state", "daysToExpiry", "status0"].includes(k)));
    if (body.holderType !== "referrer") delete body.referrerId;
    try {
      const r = form.id ? await complianceService.updateLicence(form.id, body) : await complianceService.createLicence(body);
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const saveRenewal = async () => {
    setSaving(true);
    try {
      const r = await complianceService.renewLicence(renew.id, { licenceNumber: renew.licenceNumber || null, issueDate: renew.issueDate, expiryDate: renew.expiryDate, documents: renew.documents, remarks: renew.remarks || null });
      toast.current?.show({ severity: "success", summary: r.message });
      setRenew(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (r) => setForm({
    id: r.id, holderType: r.holderType, referrerId: r.referrerId, userId: r.userId, holderName: r.holderName, position: r.position || "", licenceType: r.licenceType,
    licenceNumber: r.licenceNumber || "", issuingAuthority: r.issuingAuthority, linesAuthorised: r.linesAuthorised || "", issueDate: r.issueDate, expiryDate: r.expiryDate,
    renewalStatus: r.renewalStatus, renewalFiledOn: r.renewalFiledOn, renewalReference: r.renewalReference || "", status: r.status, remarks: r.remarks || "", documents: r.documents || [],
  });

  const fields = form ? [
    { name: "holderType", label: t("compliance.lic.holderType"), type: "dropdown", required: true, options: asOptions(HOLDER_TYPES, t, "compliance.lic.holder"), disabled: !!form.id },
    { name: "referrerId", label: t("compliance.lic.referrer"), type: "dropdown", required: true, hidden: form.holderType !== "referrer", disabled: !!form.id,
      options: holders.referrers.map((r) => ({ value: r.id, label: `${r.name} (${r.type})` })) },
    { name: "userId", label: t("compliance.lic.user"), type: "dropdown", hidden: !["officer", "individual"].includes(form.holderType), options: holders.users.map((u) => ({ value: u.id, label: u.name })) },
    { name: "holderName", label: t("compliance.lic.holderName"), hidden: form.holderType === "referrer", help: t("compliance.lic.holderNameHelp") },
    { name: "position", label: t("compliance.lic.position"), hidden: !["officer", "individual"].includes(form.holderType) },
    { name: "licenceType", label: t("compliance.lic.licenceType"), type: "dropdown", required: true, options: asOptions(holders.licenceTypes || []) },
    { name: "licenceNumber", label: t("compliance.lic.licenceNumber") },
    { name: "issuingAuthority", label: t("compliance.lic.issuingAuthority") },
    { name: "linesAuthorised", label: t("compliance.lic.linesAuthorised") },
    { name: "issueDate", label: t("compliance.lic.issueDate"), type: "date" },
    { name: "expiryDate", label: t("compliance.lic.expiryDate"), type: "date" },
    { name: "renewalStatus", label: t("compliance.lic.renewalStatus"), type: "dropdown", required: true, options: asOptions(RENEWAL, t, "compliance.lic.renewal") },
    { name: "renewalFiledOn", label: t("compliance.lic.renewalFiledOn"), type: "date" },
    { name: "renewalReference", label: t("compliance.lic.renewalReference") },
    { name: "status", label: t("compliance.lic.record"), type: "dropdown", hidden: !form.id, options: asOptions(["active", "revoked", "surrendered"], t, "compliance.state") },
    { name: "remarks", label: t("compliance.remarks"), type: "textarea", wide: true },
    { name: "documents", label: t("compliance.documents"), type: "documents", wide: true },
  ] : [];
  const formValid = form && form.licenceType && (form.holderType !== "referrer" || form.referrerId);

  const actions = (r) => (
    <div className="compliance__row-actions">
      <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("compliance.edit")} tooltip={t("compliance.edit")} onClick={() => openEdit(r)} />
      {r.status === "active" ? <Button label={t("compliance.lic.renew")} text size="small" onClick={() => setRenew({ id: r.id, holder: r.holderName, licenceNumber: r.licenceNumber || "", issueDate: null, expiryDate: null, documents: [], remarks: "" })} /> : null}
    </div>
  );
  const licenceTable = (value, opts = {}) => (
    <DataTable value={value} dataKey="id" loading={loading} size="small" stripedRows paginator={!opts.compact} rows={20} className="access__table" emptyMessage={t("compliance.lic.none")}>
      <Column header={t("compliance.lic.holder")} body={(r) => (
        <div className="access__user">
          <span className="access__user-name">{r.holderName}</span>
          <span className="access__muted">{t(`compliance.lic.holder.${r.holderType}`)}{r.referrerType ? ` · ${r.referrerType}` : ""}{r.position ? ` · ${r.position}` : ""}</span>
        </div>
      )} />
      <Column field="licenceType" header={t("compliance.lic.licenceType")} />
      <Column field="licenceNumber" header={t("compliance.lic.licenceNumber")} />
      <Column field="issueDate" header={t("compliance.lic.issueDate")} body={(r) => showDate(r.issueDate)} />
      <Column field="expiryDate" header={t("compliance.lic.expiryDate")} sortable body={(r) => showDate(r.expiryDate)} />
      <Column header={t("compliance.lic.daysToExpiry")} body={(r) => (r.daysToExpiry === null ? "" : r.daysToExpiry)} />
      <Column header={t("compliance.colState")} body={(r) => <StateTag value={r.state} />} />
      <Column header={t("compliance.lic.renewalStatus")} body={(r) => t(`compliance.lic.renewal.${r.renewalStatus}`)} />
      {!opts.compact ? <Column header="" body={actions} /> : null}
    </DataTable>
  );

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.lic.title")} intro={t("compliance.lic.intro")}
        actions={(
          <>
            <Button icon="pi pi-file-excel" label={t("compliance.export")} outlined onClick={() => complianceService.exportLicences(filters).catch(fail)} />
            <Button icon="pi pi-plus" label={t("compliance.lic.add")} onClick={() => setForm({ ...EMPTY })} />
          </>
        )} />
      <Stats loading={loading} selected={filters.state} onSelect={(state) => setFilters((f) => ({ ...f, state }))} items={[
        { key: "valid", label: t("compliance.state.valid"), value: summary.valid },
        { key: "expiring", label: t("compliance.lic.expiringWithin", { days: dash?.expiringDays ?? 90 }), value: summary.expiring },
        { key: "expired", label: t("compliance.state.expired"), value: summary.expired },
        { key: "no-expiry", label: t("compliance.state.no-expiry"), value: summary.noExpiry },
      ]} />
      {dash && !dash.firmLicenceInForce ? <Message severity="error" className="w-full justify-content-start mb-2" text={t("compliance.lic.noFirmLicence")} /> : null}
      {dash && dash.referrersWithoutLicence.length ? (
        <Message severity={dash.checkMode === "block" ? "warn" : "info"} className="w-full justify-content-start mb-2"
          text={t(dash.checkMode === "block" ? "compliance.lic.referrersBlocked" : "compliance.lic.referrersWarned", { names: dash.referrersWithoutLicence.map((r) => r.name).join(", ") })} />
      ) : null}
      <TabView>
        <TabPanel header={t("compliance.lic.tabRegister")}>
          <div className="admin__filters">
            <Dropdown value={filters.holderType} options={asOptions(HOLDER_TYPES, t, "compliance.lic.holder")} showClear placeholder={t("compliance.lic.holderType")} onChange={(e) => setFilters((f) => ({ ...f, holderType: e.value || null }))} />
            <span className="p-input-icon-left">
              <i className="pi pi-search" />
              <InputText value={filters.search} placeholder={t("compliance.search")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            </span>
          </div>
          {licenceTable(rows)}
        </TabPanel>
        <TabPanel header={t("compliance.lic.tabCalendar")}>
          <DataTable value={dash?.calendar || []} dataKey="month" size="small" className="access__table" loading={loading}>
            <Column field="month" header={t("compliance.lic.month")} />
            <Column header={t("compliance.lic.expiring")} body={(m) => m.licences.length} />
            <Column header={t("compliance.lic.holders")} body={(m) => m.licences.map((l) => `${l.holderName} (${showDate(l.expiryDate)})`).join("; ")} />
          </DataTable>
          <h4>{t("compliance.lic.expiredList")}</h4>
          {licenceTable(dash?.expired || [], { compact: true })}
        </TabPanel>
      </TabView>

      <FormDialog header={form?.id ? t("compliance.lic.edit") : t("compliance.lic.add")} visible={!!form} fields={fields} form={form} setForm={setForm}
        onHide={() => setForm(null)} onSubmit={save} saving={saving} valid={!!formValid} />
      <FormDialog header={t("compliance.lic.renewTitle", { holder: renew?.holder || "" })} visible={!!renew} form={renew} setForm={setRenew} onHide={() => setRenew(null)}
        onSubmit={saveRenewal} saving={saving} valid={!!renew?.expiryDate} submitLabel={t("compliance.lic.renew")}
        fields={[
          { name: "licenceNumber", label: t("compliance.lic.licenceNumber") },
          { name: "issueDate", label: t("compliance.lic.issueDate"), type: "date" },
          { name: "expiryDate", label: t("compliance.lic.expiryDate"), type: "date", required: true },
          { name: "remarks", label: t("compliance.remarks"), type: "textarea", wide: true },
          { name: "documents", label: t("compliance.documents"), type: "documents", wide: true },
        ]} />
    </div>
  );
};

export default LicenceRegister;
