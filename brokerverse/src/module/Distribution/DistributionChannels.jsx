import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";
import CommissionService from "../../services/commissionService";
import { hasPermission } from "../../utils/canOpen";
import { confirmAction } from "../../utility/dialogs";
import { Field, PageHeader, StatusTag, money, showError, showSuccess } from "./common";

export const CHANNEL_TYPES = ["dealer_group", "dealer_branch", "financing_bank", "bank_branch", "affinity_partner"];
/** Parent types a channel type sits under (mirrors backend/src/modules/channels/service.js). */
const PARENTS = { dealer_group: [], dealer_branch: ["dealer_group"], financing_bank: [], bank_branch: ["financing_bank"], affinity_partner: ["affinity_partner"] };
const EMPTY = { code: "", name: "", channelType: "dealer_branch", parentId: null, referrerId: null, comsubPct: null, bankId: null, branchCode: "", province: "", city: "", address: "",
  contactPerson: "", contactEmail: "", contactPhone: "", tin: "", mortgageeClause: "", letterAddressee: "", status: "active", notes: "" };

/**
 * Master > Insurance Management > Distribution Channels: dealer groups and dealer branches, financing banks and bank
 * branches, affinity partners, in one hierarchy; the referrer whose comsub the channel's business earns; the mortgagee
 * clause and letter addressee of a financing bank. Production per channel is shown alongside.
 */
const DistributionChannels = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const write = hasPermission("write:channels");
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ type: null, status: "active", search: "" });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [referrers, setReferrers] = useState([]);
  const [banks, setBanks] = useState([]);
  const typeOptions = CHANNEL_TYPES.map((v) => ({ value: v, label: t(`distribution.ch.type.${v}`, v) }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.channels({ type: filters.type || undefined, status: filters.status || undefined, search: filters.search || undefined, withProduction: "true" }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!write) return;
    CommissionService.getReferrerAccounts().then((r) => {
      const list = Array.isArray(r) ? r : (r?.data || r?.referrers || []);
      setReferrers(list.map((x) => ({ value: x.id || x.referrerId, label: x.name || x.referrerName })));
    }).catch(() => setReferrers([]));
    mastersService.options("bank").then((r) => setBanks(r.map((x) => ({ value: Number(x.id), label: x.label })))).catch(() => setBanks([]));
  }, [write]);

  const parents = form ? rows.filter((r) => (PARENTS[form.channelType] || []).includes(r.channelType) && r.id !== form.id) : [];
  const isBank = form && ["financing_bank", "bank_branch"].includes(form.channelType);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const body = Object.fromEntries(Object.entries(form).filter(([k]) => Object.prototype.hasOwnProperty.call(EMPTY, k)).map(([k, v]) => [k, v === "" ? null : v]));
    try {
      const r = form.id ? await service.updateChannel(form.id, body) : await service.createChannel(body);
      showSuccess(toast, r.message);
      setForm(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const remove = async (row) => {
    if (!(await confirmAction(t("distribution.ch.confirmDelete", "Remove the channel {{name}}? A channel with business is made inactive instead.", { name: row.name }), { danger: true }))) return;
    try {
      showSuccess(toast, (await service.deleteChannel(row.id)).message);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.master", "Master")} section={t("distribution.home.insurance", "Insurance Management")} title={t("distribution.ch.title", "Distribution Channels")}
        subtitle={t("distribution.ch.subtitle", "Dealers, financing banks and affinity partners that bring business, with their hierarchy, referrer and mortgagee clause.")}>
        {write ? <Button label={t("distribution.ch.add", "Add channel")} icon="pi pi-plus" onClick={() => setForm({ ...EMPTY })} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="dist-toolbar">
          <Dropdown value={filters.type} options={typeOptions} showClear placeholder={t("distribution.ch.typeLabel", "Channel type")} onChange={(e) => setFilters({ ...filters, type: e.value || null })} />
          <Dropdown value={filters.status} options={["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} showClear placeholder={t("distribution.common.status", "Status")}
            onChange={(e) => setFilters({ ...filters, status: e.value || null })} />
          <span className="p-input-icon-left"><i className="pi pi-search" />
            <InputText value={filters.search} placeholder={t("distribution.common.search", "Search")} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></span>
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} emptyMessage={t("distribution.common.none", "Nothing to show")}>
          <Column field="code" header={t("distribution.common.code", "Code")} />
          <Column header={t("distribution.common.name", "Name")} body={(r) => <span style={{ paddingLeft: `${(r.level || 0) * 1.25}rem` }}>{r.name}</span>} />
          <Column header={t("distribution.ch.typeLabel", "Channel type")} body={(r) => t(`distribution.ch.type.${r.channelType}`, r.channelType)} />
          <Column field="groupName" header={t("distribution.ch.group", "Group")} />
          <Column header={t("distribution.ch.referrer", "Referrer")} body={(r) => (r.referrerName ? `${r.referrerName}${r.comsubPct !== null ? ` (${r.comsubPct}%)` : ""}` : "")} />
          <Column header={t("distribution.ch.where", "Province / City")} body={(r) => [r.city, r.province].filter(Boolean).join(", ")} />
          <Column field="leads" header={t("distribution.ch.leads", "Prospects")} className="bv-num" headerClassName="bv-num" />
          <Column field="policies" header={t("distribution.ch.policies", "Policies")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.ch.premium", "Premium")} body={(r) => money(r.premium)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
          {write ? <Column body={(r) => (
            <div className="dist-actions">
              <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? EMPTY[k] ?? null])) })} />
              <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={t("distribution.common.delete", "Delete")} onClick={() => remove(r)} />
            </div>
          )} /> : null}
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={form?.id ? t("distribution.ch.edit", "Edit channel") : t("distribution.ch.add", "Add channel")} visible={!!form} style={{ width: "min(820px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setForm(null)} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={save} disabled={!form?.code || !form?.name} /></div>}>
        {form && (
          <div className="dist-grid">
            <Field label={t("distribution.common.code", "Code")}><InputText value={form.code} onChange={(e) => set({ code: e.target.value })} /></Field>
            <Field label={t("distribution.common.name", "Name")}><InputText value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t("distribution.ch.typeLabel", "Channel type")}>
              <Dropdown value={form.channelType} options={typeOptions} disabled={!!form.id} onChange={(e) => set({ channelType: e.value, parentId: null })} />
            </Field>
            <Field label={t("distribution.ch.parent", "Belongs to")} help={PARENTS[form.channelType].length ? null : t("distribution.ch.topLevel", "A top-level channel")}>
              <Dropdown value={form.parentId} options={parents.map((p) => ({ value: p.id, label: p.path || p.name }))} showClear disabled={!PARENTS[form.channelType].length}
                onChange={(e) => set({ parentId: e.value || null })} />
            </Field>
            <Field label={t("distribution.ch.referrer", "Referrer")} help={t("distribution.ch.referrerHelp", "Commission > Agents/Referrer Accounts: the channel's business earns this referrer's comsub")}>
              <Dropdown value={form.referrerId} options={referrers} filter showClear onChange={(e) => set({ referrerId: e.value || null })} />
            </Field>
            <Field label={t("distribution.ch.comsub", "Comsub %")} help={t("distribution.ch.comsubHelp", "Empty: the rate of the referrer's level")}>
              <InputNumber value={form.comsubPct} min={0} max={100} minFractionDigits={0} maxFractionDigits={2} onValueChange={(e) => set({ comsubPct: e.value ?? null })} />
            </Field>
            {isBank ? (
              <>
                <Field label={t("distribution.ch.bank", "Bank (Bank master)")}><Dropdown value={form.bankId} options={banks} filter showClear onChange={(e) => set({ bankId: e.value || null })} /></Field>
                <Field label={t("distribution.ch.addressee", "Letter addressee")}><InputText value={form.letterAddressee || ""} onChange={(e) => set({ letterAddressee: e.target.value })} /></Field>
                <Field label={t("distribution.ch.mortgagee", "Mortgagee clause")} full help={t("distribution.ch.mortgageeHelp", "{{bankName}} is replaced by the bank's name; empty: the default clause of the Configuration")}>
                  <InputTextarea rows={3} value={form.mortgageeClause || ""} onChange={(e) => set({ mortgageeClause: e.target.value })} />
                </Field>
              </>
            ) : null}
            <Field label={t("distribution.ch.servicingBranch", "Servicing branch code")}><InputText value={form.branchCode || ""} onChange={(e) => set({ branchCode: e.target.value })} /></Field>
            <Field label={t("distribution.ch.tin", "TIN")}><InputText value={form.tin || ""} onChange={(e) => set({ tin: e.target.value })} /></Field>
            <Field label={t("distribution.ch.province", "Province")}><InputText value={form.province || ""} onChange={(e) => set({ province: e.target.value })} /></Field>
            <Field label={t("distribution.ch.city", "City / Municipality")}><InputText value={form.city || ""} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label={t("distribution.ch.address", "Address")} full><InputText value={form.address || ""} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label={t("distribution.ch.contact", "Contact person")}><InputText value={form.contactPerson || ""} onChange={(e) => set({ contactPerson: e.target.value })} /></Field>
            <Field label={t("distribution.ch.email", "Contact e-mail")}><InputText value={form.contactEmail || ""} onChange={(e) => set({ contactEmail: e.target.value })} /></Field>
            <Field label={t("distribution.ch.phone", "Contact phone")}><InputText value={form.contactPhone || ""} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
            <Field label={t("distribution.common.status", "Status")}>
              <Dropdown value={form.status} options={["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => set({ status: e.value })} />
            </Field>
            <Field label={t("distribution.common.notes", "Notes")} full><InputTextarea rows={2} value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default DistributionChannels;
