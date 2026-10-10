import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import SvgDot from "../../../../assets/icons/SvgDot";
import mastersService, { errorMessage } from "../../../../services/mastersService";
import useMasterOptions from "../../../GeneralMasters/common/useMasterOptions";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { calendarDateFormat, formatDate, toDate, toIsoDate } from "../../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../../components/RowActions";
import PageActions from "../../../../components/PageActions";

const TYPE = "bank-account";
const ACCOUNT_TYPES = ["Current Account", "Savings Account", "Time Deposit", "Trust Account"];
const EMPTY = {
  accountCode: "",
  accountName: "",
  bankCode: "",
  accountNumber: "",
  accountType: "Current Account",
  currency: "PHP",
  branch: "",
  swiftCode: "",
  glAccount: "",
  openingDate: null,
  contactPerson: "",
  contactNumber: "",
  email: "",
};

/** What is wrong with a bank account form (empty object when it can be saved). */
export const bankAccountErrors = (v) => {
  const e = {};
  const req = "This field is required";
  ["accountCode", "accountName", "bankCode", "accountNumber", "accountType", "currency"].forEach((k) => {
    if (!String(v[k] ?? "").trim()) e[k] = req;
  });
  if (v.accountNumber && !/^[0-9][0-9 -]{5,30}$/.test(String(v.accountNumber).trim())) e.accountNumber = "Digits, spaces and dashes only (at least 6)";
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = "Invalid e-mail address";
  if (v.contactNumber && !/^\+?[\d\s()-]{7,20}$/.test(v.contactNumber)) e.contactNumber = "Invalid phone number";
  if (v.swiftCode && !/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(String(v.swiftCode).trim())) e.swiftCode = "8 or 11 characters, e.g. BNORPHMM";
  return e;
};

/**
 * Company bank accounts (Master > Finance > Bank > Accounts): the accounts the broker receives into and pays from.
 * They feed the bank account lists of receipts, settlements to insurers, payment vouchers and bank reconciliation.
 */
const BankAccounts = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null); // null = dialog closed
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const banks = useMasterOptions("bank", { valueKey: "code" });
  const currencies = useMasterOptions("currency", { valueKey: "code" });

  const load = useCallback(() => {
    setLoading(true);
    mastersService
      .list(TYPE)
      .then(setRows)
      .catch((error) => toast.current?.show({ severity: "error", detail: errorMessage(error) }))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.accountCode, r.accountName, r.accountNumber, r.bankCode, r.bankName].some((x) => String(x || "").toLowerCase().includes(q)));
  }, [rows, search]);

  const open = (row) => {
    setErrors({});
    setForm(row ? { ...EMPTY, ...row, openingDate: toDate(row.openingDate) } : { ...EMPTY });
  };
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const save = async () => {
    const found = bankAccountErrors(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const bank = banks.find((b) => b.value === form.bankCode);
    const record = { ...form, bankName: bank?.label || form.bankName || "", openingDate: form.openingDate ? toIsoDate(form.openingDate) : null };
    setSaving(true);
    try {
      if (form.id) await mastersService.update(TYPE, form.id, record);
      else await mastersService.create(TYPE, record);
      toast.current?.show({ severity: "success", detail: `Bank account ${form.accountCode} saved` });
      setForm(null);
      load();
    } catch (error) {
      toast.current?.show({ severity: "error", detail: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, input, { required = false, wide = false } = {}) => (
    <div className={`col-12 ${wide ? "md:col-12" : "md:col-6"} bank-account-field`}>
      <label htmlFor={`ba-${key}`}>
        {label}
        {required && <span className="required__label"> *</span>}
      </label>
      {input}
      {errors[key] && <small className="p-error block">{errors[key]}</small>}
    </div>
  );
  const text = (key, props = {}) => (
    <InputText id={`ba-${key}`} className={`w-full ${errors[key] ? "p-invalid" : ""}`} value={form[key] || ""} onChange={(e) => set(key, e.target.value)} {...props} />
  );

  return (
    <div className="overall__accountdataview__container">
      <Toast ref={toast} />
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.accountDetails")}</label>
          <BreadCrumb
            model={[{ label: t("financeMasters.bank"), url: "/master/finance/bank" }, { label: t("financeMasters.accountDetails") }]}
            home={{ label: t("financeMasters.master") }}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <PageActions onAdd={() => open(null)} addLabel={t("financeMasters.addAccount")} />
        </div>
      </div>

      <Card>
        <div className="header_search_container">
          <span className="p-input-icon-left" style={{ width: "100%" }}>
            <i className="pi pi-search" />
            <InputText
              placeholder="Search by account code, name, number or bank"
              className="searchinput_left"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="headlist_lable">Company bank accounts</div>
        <DataTable
          value={shown}
          loading={loading}
          dataKey="id"
          paginator
          rows={20}
          rowsPerPageOptions={[20, 50, 100]}
          emptyMessage="No bank accounts yet. Add the accounts the company receives premiums into and pays insurers from."
        >
          <Column field="accountCode" header="Account Code" sortable />
          <Column field="accountName" header={t("financeMasters.accountName")} sortable />
          <Column header="Bank" body={(r) => r.bankName || r.bankCode} sortable sortField="bankCode" />
          <Column field="accountNumber" header={t("financeMasters.accountNumber")} />
          <Column field="accountType" header="Account Type" />
          <Column field="currency" header="Currency" />
          <Column header="Opened" body={(r) => formatDate(r.openingDate)} />
          <Column header={t("common.status")} body={(r) => <MasterStatusToggle type={TYPE} record={r} onChanged={load} onError={(e) => toast.current?.show({ severity: "error", detail: e.message })} />} />
          <Column header={t("common.actions")} {...actionsColumn} body={(r) => <RowActions onEdit={() => open(r)} />} />
        </DataTable>
      </Card>

      <Dialog
        header={form?.id ? `Edit bank account ${form.accountCode}` : "Add bank account"}
        visible={!!form}
        style={{ width: "min(760px, 95vw)" }}
        onHide={() => setForm(null)}
        footer={
          <div>
            <Button label="Cancel" outlined onClick={() => setForm(null)} />
            <Button label="Save" loading={saving} onClick={save} />
          </div>
        }
      >
        {form && (
          <div className="grid">
            {field("accountCode", "Account Code", text("accountCode", { disabled: !!form.id, placeholder: "e.g. BDO-COLL" }), { required: true })}
            {field("accountName", "Account Name", text("accountName", { placeholder: "e.g. Premium Collection Account" }), { required: true })}
            {field(
              "bankCode",
              "Bank",
              <Dropdown inputId="ba-bankCode" className={`w-full ${errors.bankCode ? "p-invalid" : ""}`} value={form.bankCode} options={banks} optionLabel="label" optionValue="value" filter placeholder="Select" onChange={(e) => set("bankCode", e.value)} />,
              { required: true }
            )}
            {field("accountNumber", "Account Number", text("accountNumber", { placeholder: "0012-3456-7890" }), { required: true })}
            {field(
              "accountType",
              "Account Type",
              <Dropdown inputId="ba-accountType" className="w-full" value={form.accountType} options={ACCOUNT_TYPES} onChange={(e) => set("accountType", e.value)} />,
              { required: true }
            )}
            {field(
              "currency",
              "Currency",
              <Dropdown inputId="ba-currency" className={`w-full ${errors.currency ? "p-invalid" : ""}`} value={form.currency} options={currencies.length ? currencies : [{ label: "PHP", value: "PHP" }]} optionLabel="label" optionValue="value" onChange={(e) => set("currency", e.value)} />,
              { required: true }
            )}
            {field("branch", "Branch", text("branch", { placeholder: "e.g. Makati Ayala" }))}
            {field("swiftCode", "SWIFT / BIC Code", text("swiftCode", { placeholder: "BNORPHMM" }))}
            {field("glAccount", "GL Account", text("glAccount", { placeholder: "Chart of accounts code, e.g. 1102004" }))}
            {field(
              "openingDate",
              "Opening Date",
              <Calendar inputId="ba-openingDate" className="w-full" value={form.openingDate} dateFormat={calendarDateFormat()} showIcon onChange={(e) => set("openingDate", e.value)} />
            )}
            {field("contactPerson", "Bank Contact Person", text("contactPerson"))}
            {field("contactNumber", "Contact Number", text("contactNumber", { placeholder: "+63 2 8840 7000" }))}
            {field("email", "E-mail", text("email"))}
            <div className="col-12 text-sm" style={{ color: "var(--text-color-secondary)" }}>
              The GL cash account and statement format used for bank reconciliation are set in Accounts &gt; Bank Reconciliation.
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default BankAccounts;
