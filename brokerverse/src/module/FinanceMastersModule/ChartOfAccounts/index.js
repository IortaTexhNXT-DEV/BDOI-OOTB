import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgAdd from "../../../assets/icons/SvgAdd";
import accountingService from "../../../services/accountingService";
import ImportDialog from "../../../components/ImportDialog";
import FieldError from "../../../components/FieldError";
import useFieldErrors, { blank } from "../../../hooks/useFieldErrors";
import "./index.scss";

const COA_UPLOAD = [{ label: "Chart of accounts", templatePath: "/accounting/accounts/template", uploadPath: "/accounting/accounts/upload" }];

const TYPE_LABELS = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };
const typeLabel = (t) => TYPE_LABELS[t] || t;
const showError = (toast, e) => toast.current?.show({ severity: "error", summary: "Error", detail: e.message, life: 6000 });
const EMPTY = { code: "", name: "", accountType: "expense", fsGroup: null, parentCode: null, category: "", normalBalance: null, description: "", isOpenItem: false, allowManual: true, status: "active" };

/**
 * Master > Finance > Main Account / Sub Account: the GL chart of accounts (gl_accounts) that every journal posts to,
 * grouped by account type and financial-statement group. level="sub" lists sub accounts (accounts with a parent).
 * Accounts mapped to a system role (accounting.account.* settings) are flagged and cannot be deactivated.
 */
const ChartOfAccounts = ({ level = "main" }) => {
  const [showUpload, setShowUpload] = useState(false);
  const { t } = useTranslation();
  const toast = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [groups, setGroups] = useState({ types: [], groups: [] });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: null, fsGroup: null, status: "active", search: "" });
  const [editing, setEditing] = useState(null); // { isNew, values }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, all] = await Promise.all([
        accountingService.listChartOfAccounts({ level, type: filters.type, fsGroup: filters.fsGroup, status: filters.status, search: filters.search.trim() }),
        accountingService.listChartOfAccounts({}),
      ]);
      setAccounts(rows || []);
      setAllAccounts(all || []);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [level, filters]);

  useEffect(() => {
    accountingService.getAccountGroups().then(setGroups).catch((e) => showError(toast, e));
  }, []);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const typeOptions = useMemo(() => (groups.types || []).map((v) => ({ label: typeLabel(v), value: v })), [groups]);
  const groupOptions = (type) => (groups.groups || []).filter((g) => !type || g.accountType === type).map((g) => ({ label: g.group, value: g.group }));
  const categories = useMemo(() => [...new Set(allAccounts.map((a) => a.category).filter(Boolean))].sort().map((c) => ({ label: c, value: c })), [allAccounts]);
  const parentOptions = (type, code) => allAccounts.filter((a) => !a.parentCode && a.accountType === type && a.code !== code && a.status === "active")
    .map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code }));

  const { errors, check, fromApi, clear } = useFieldErrors();
  const openNew = () => { clear(); setEditing({ isNew: true, values: { ...EMPTY, accountType: filters.type || EMPTY.accountType } }); };
  const openEdit = (row) => { clear(); setEditing({ isNew: false, values: { ...EMPTY, ...row, category: row.category || "", description: row.description || "" } }); };
  const setValue = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));

  const save = async () => {
    const v = editing.values;
    if (!check({
      code: blank(v.code) ? "Enter the account code" : null,
      name: blank(v.name) ? "Enter the account name" : null,
      parentCode: level === "sub" && !v.parentCode ? "A sub account needs its main account" : null,
    })) return;
    const payload = { name: v.name.trim(), accountType: v.accountType, fsGroup: v.fsGroup || undefined, parentCode: v.parentCode || undefined, category: v.category || undefined,
      normalBalance: v.normalBalance || undefined, description: v.description || undefined, isOpenItem: !!v.isOpenItem, allowManual: v.allowManual !== false, status: v.status };
    setSaving(true);
    try {
      const out = editing.isNew ? await accountingService.createAccount({ code: v.code.trim(), ...payload }) : await accountingService.updateAccount(v.code, payload);
      toast.current?.show({ severity: "success", summary: "Saved", detail: `${out.code} ${out.name}`, life: 3000 });
      setEditing(null);
      load();
    } catch (e) {
      fromApi(e);
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    try {
      await accountingService.updateAccount(row.code, { status: row.status === "active" ? "inactive" : "active" });
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  const groupHeader = (row) => (
    <span className="type-header">
      {typeLabel(row.accountType)} <span className="type-count">({accounts.filter((a) => a.accountType === row.accountType).length})</span>
    </span>
  );

  const title = level === "sub" ? t("financeMasters.subAccountMaster", "Sub Account") : t("financeMasters.mainAccountMaster", "Main Account");
  const v = editing?.values;

  return (
    <div className="chart-of-accounts">
      <Toast ref={toast} />
      <div className="grid m-0 top__container">
        <div className="col-12 p-0 flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <div className="main__account__title">{title} – Chart of Accounts</div>
            <BreadCrumb home={{ label: t("financeMasters.master", "Master") }} className="breadCrums__view__reversal"
              model={[{ label: title, url: level === "sub" ? "/master/finance/subaccount" : "/master/finance/mainaccount" }]} separatorIcon={<SvgDot color={"#000"} />} />
          </div>
          <div className="flex gap-2">
            <Button type="button" icon="pi pi-upload" label={t("financeMasters.upload", "Upload")} className="p-button-outlined" onClick={() => setShowUpload(true)} />
            <Button icon={<div className="pr-2"><SvgAdd /></div>} className="main__btn__action" onClick={openNew} aria-label="Add" tooltip="Add" tooltipOptions={{ position: "top" }} >
              {t("financeMasters.add", "Add")}
            </Button>
          </div>
          <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title="Upload chart of accounts" targets={COA_UPLOAD} onDone={load}
            note="Adds new accounts and updates existing ones (same Account Code). Put a main account before its sub accounts." />
        </div>
      </div>

      <div className="grid filters mt-2">
        <div className="col-12 md:col-3">
          <Dropdown value={filters.type} options={typeOptions} onChange={(e) => setFilters({ ...filters, type: e.value, fsGroup: null })} placeholder="All account types" showClear className="w-full" />
        </div>
        <div className="col-12 md:col-3">
          <Dropdown value={filters.fsGroup} options={groupOptions(filters.type)} onChange={(e) => setFilters({ ...filters, fsGroup: e.value })} placeholder="All statement groups" showClear className="w-full" />
        </div>
        <div className="col-12 md:col-2">
          <Dropdown value={filters.status} options={[{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]} onChange={(e) => setFilters({ ...filters, status: e.value })}
            placeholder="All statuses" showClear className="w-full" />
        </div>
        <div className="col-12 md:col-4">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search code, name or category" className="w-full" />
          </span>
        </div>
      </div>

      <DataTable value={accounts} loading={loading} rowGroupMode="subheader" groupRowsBy="accountType" rowGroupHeaderTemplate={groupHeader} dataKey="code"
        emptyMessage="No accounts" size="small" stripedRows scrollable scrollHeight="flex" className="coa-table">
        <Column field="code" header="Code" style={{ width: "8rem" }} />
        {level === "sub" && <Column field="parentCode" header="Main Account" style={{ width: "8rem" }} />}
        <Column field="name" header="Account Name" />
        <Column field="fsGroup" header="Statement Group" />
        <Column field="category" header="Category" />
        <Column field="normalBalance" header="Normal Balance" body={(r) => (r.normalBalance === "credit" ? "Credit" : "Debit")} />
        <Column header="Open Item" body={(r) => (r.isOpenItem ? <i className="pi pi-check" /> : null)} style={{ width: "6rem" }} />
        <Column header="Manual JV" body={(r) => (r.allowManual ? <i className="pi pi-check" /> : null)} style={{ width: "6rem" }} />
        <Column header="System Use" body={(r) => (r.systemRoles || []).map((role) => <Tag key={role} value={role.replace(/_/g, " ")} severity="info" className="mr-1 mb-1" />)} />
        <Column header="Status" body={(r) => <Tag value={r.status === "active" ? "Active" : "Inactive"} severity={r.status === "active" ? "success" : "secondary"} />} style={{ width: "6rem" }} />
        <Column header="Actions" style={{ width: "7rem" }} body={(r) => (
          <div className="flex gap-1">
            <Button icon="pi pi-pencil" className="p-button-text p-button-sm" tooltip="Edit" onClick={() => openEdit(r)} aria-label="Edit" />
            <Button icon={r.status === "active" ? "pi pi-ban" : "pi pi-check-circle"} className="p-button-text p-button-sm" tooltip={r.status === "active" ? "Deactivate" : "Activate"}
              disabled={r.status === "active" && r.isSystem} onClick={() => toggleStatus(r)} aria-label={r.status === "active" ? "Deactivate" : "Activate"}
              />
          </div>
        )} />
      </DataTable>

      <Dialog className="coa-dialog" header={editing ? (editing.isNew ? `Add ${level === "sub" ? "sub " : ""}account` : `Edit ${v.code}`) : ""} visible={!!editing}
        style={{ width: "min(720px, 95vw)" }} onHide={() => setEditing(null)}
        footer={editing && (
          <div>
            <Button label={t("common.cancel", "Cancel")} className="p-button-text" onClick={() => setEditing(null)} />
            <Button label={t("financeMasters.save", "Save")} icon="pi pi-save" onClick={save} loading={saving} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-4">
              <label>Account code *</label>
              <InputText value={v.code} disabled={!editing.isNew} onChange={(e) => setValue({ code: e.target.value })} className="w-full" />
              <FieldError error={errors.code} />
            </div>
            <div className="col-12 md:col-8">
              <label>Account name *</label>
              <InputText value={v.name} onChange={(e) => setValue({ name: e.target.value })} className="w-full" />
              <FieldError error={errors.name} />
            </div>
            <div className="col-12 md:col-4">
              <label>Account type *</label>
              <Dropdown value={v.accountType} options={typeOptions} disabled={!editing.isNew}
                onChange={(e) => setValue({ accountType: e.value, fsGroup: null, parentCode: null })} className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label>Statement group</label>
              <Dropdown value={v.fsGroup} options={groupOptions(v.accountType)} onChange={(e) => setValue({ fsGroup: e.value })} placeholder="Default for the type" showClear className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label>Normal balance</label>
              <Dropdown value={v.normalBalance} options={[{ label: "Debit", value: "debit" }, { label: "Credit (contra / liability)", value: "credit" }]}
                onChange={(e) => setValue({ normalBalance: e.value })} placeholder="From the type" showClear className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>Main account{level === "sub" ? " *" : ""}</label>
              <Dropdown value={v.parentCode} options={parentOptions(v.accountType, v.code)} onChange={(e) => setValue({ parentCode: e.value })} filter
                placeholder={level === "sub" ? "Select the main account" : "None (main account)"} showClear={level !== "sub"} disabled={!editing.isNew && !v.parentCode && level !== "sub"} className="w-full" />
              <FieldError error={errors.parentCode} />
            </div>
            <div className="col-12 md:col-6">
              <label>Category</label>
              <Dropdown value={v.category} options={categories} editable onChange={(e) => setValue({ category: e.value })} placeholder="e.g. Operating Expenses" className="w-full" />
            </div>
            <div className="col-12">
              <label>Description</label>
              <InputTextarea value={v.description} onChange={(e) => setValue({ description: e.target.value })} rows={2} autoResize className="w-full" />
            </div>
            <div className="col-12 md:col-4 flex align-items-center gap-2">
              <Checkbox inputId="coa-open" checked={!!v.isOpenItem} onChange={(e) => setValue({ isOpenItem: e.checked })} />
              <label htmlFor="coa-open" className="m-0">Open item (matching)</label>
            </div>
            <div className="col-12 md:col-4 flex align-items-center gap-2">
              <Checkbox inputId="coa-manual" checked={v.allowManual !== false} onChange={(e) => setValue({ allowManual: e.checked })} />
              <label htmlFor="coa-manual" className="m-0">Allowed on manual JVs</label>
            </div>
            <div className="col-12 md:col-4 flex align-items-center gap-2">
              <Checkbox inputId="coa-active" checked={v.status === "active"} disabled={v.isSystem && v.status === "active"} onChange={(e) => setValue({ status: e.checked ? "active" : "inactive" })} />
              <label htmlFor="coa-active" className="m-0">Active</label>
            </div>
            {v.isSystem && (
              <div className="col-12 text-sm text-600">
                Used by the system as: {(v.systemRoles || []).join(", ")} (Configuration, accounting group). Change the setting before deactivating it.
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ChartOfAccounts;
