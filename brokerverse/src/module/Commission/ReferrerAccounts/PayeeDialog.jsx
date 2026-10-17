import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import CommissionService from "../../../services/commissionService";

const EMPTY = {
  name: "", type: "Agent", level: null, vendorGroup: null, vendorCode: "", address: "", contactPerson: "", email: "", phone: "", tin: "",
  bankName: "", bankAccountNo: "", whtCode: null, whtApplicable: true, status: "Active",
};

/** The form values of a payee account (GET /commission/referrer-accounts/:id); identifiers are left blank (kept unless typed). */
const fromAccount = (r) => ({
  ...EMPTY, name: r.name || "", type: r.type || "Agent", level: r.level || null, vendorGroup: r.vendorGroup || null, vendorCode: r.vendorCode || "",
  address: r.address || "", contactPerson: r.contactPerson || "", email: r.email || "", phone: r.phone || "", bankName: r.bankName || "",
  whtCode: r.whtCode || null, whtApplicable: r.whtApplicable !== false, status: r.status || "Active",
});

/**
 * Add or edit a payee (agent, dealer, referral, vendor) of Commission > Agents/Referrer Accounts (FGA EN-01, EN-02): the
 * vendor group and code, address, contact, TIN, bank details and withholding tax. With payee verification on, a new
 * payee and a change of its payment details wait for a second user, which the dialog says before saving.
 */
const PayeeDialog = ({ payee, onHide, onSaved }) => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`referrerAccounts.payee.${key}`, opts);
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const visible = payee !== null;
  const editing = Boolean(payee?.id);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setForm(editing ? fromAccount(payee) : EMPTY);
    if (!options) CommissionService.getReferrerOptions().then((r) => setOptions(r?.data || r)).catch(() => setOptions({ types: [], levels: [], vendorGroups: [], whtCodes: [] }));
  }, [visible, payee]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const list = (values) => (values || []).map((v) => ({ label: v, value: v }));

  const save = async () => {
    if (String(form.name).trim().length < 2) {
      setErrors({ name: k("nameRequired") });
      return;
    }
    const body = { ...form };
    // identifiers left blank on an edit keep what is on file
    if (editing) {
      if (!body.tin) delete body.tin;
      if (!body.bankAccountNo) delete body.bankAccountNo;
    }
    Object.keys(body).forEach((key) => { if (body[key] === "") body[key] = editing ? null : undefined; });
    if (editing && body.name === null) delete body.name;
    setSaving(true);
    try {
      const r = editing ? await CommissionService.updateReferrer(payee.id, body) : await CommissionService.createReferrer(body);
      onSaved(r?.data || r, r?.message);
    } catch (e) {
      const list2 = e?.response?.data?.errors || [];
      if (list2.length) setErrors(Object.fromEntries(list2.map((x) => [x.path, x.message])));
      else setErrors({ "": e?.response?.data?.message || k("saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, input) => (
    <div className="payee-field">
      <label htmlFor={`payee-${name}`}>{label}</label>
      {input}
      {errors[name] ? <small className="p-error">{errors[name]}</small> : null}
    </div>
  );
  const text = (name, label, props = {}) => field(name, label, (
    <InputText id={`payee-${name}`} value={form[name] || ""} onChange={(e) => set(name)(e.target.value)} className={errors[name] ? "p-invalid" : ""} {...props} />
  ));

  return (
    <Dialog header={editing ? k("editTitle", { name: payee.name }) : k("addTitle")} visible={visible} onHide={onHide} className="payee-dialog" style={{ width: "min(760px, 96vw)" }}
      footer={(
        <div className="flex justify-content-end gap-2">
          <Button label={t("common.cancel", { defaultValue: "Cancel" })} outlined onClick={onHide} disabled={saving} />
          <Button label={k("save")} icon="pi pi-check" onClick={save} loading={saving} />
        </div>
      )}>
      {options?.verificationRequired ? <p className="payee-note">{editing ? k("verificationOnChange") : k("verificationOnAdd")}</p> : null}
      {errors[""] ? <p className="p-error">{errors[""]}</p> : null}
      <div className="payee-grid">
        {text("name", k("name"))}
        {field("type", k("type"), <Dropdown inputId="payee-type" value={form.type} options={list(options?.types)} onChange={(e) => set("type")(e.value)} />)}
        {field("level", k("level"), <Dropdown inputId="payee-level" value={form.level} options={list(options?.levels)} onChange={(e) => set("level")(e.value)} showClear />)}
        {field("vendorGroup", k("vendorGroup"), <Dropdown inputId="payee-vendorGroup" value={form.vendorGroup} options={list(options?.vendorGroups)} onChange={(e) => set("vendorGroup")(e.value)} showClear />)}
        {text("vendorCode", k("vendorCode"))}
        {text("contactPerson", k("contactPerson"))}
        {text("email", k("email"), { type: "email" })}
        {text("phone", k("phone"))}
        {text("tin", k("tin"), { placeholder: editing ? k("keepOnFile") : "" })}
        {text("bankName", k("bankName"))}
        {text("bankAccountNo", k("bankAccountNo"), { placeholder: editing ? k("keepOnFile") : "" })}
        {field("whtCode", k("whtCode"), (
          <Dropdown inputId="payee-whtCode" value={form.whtCode} options={(options?.whtCodes || []).map((c) => ({ label: c.label, value: c.code }))} onChange={(e) => set("whtCode")(e.value)}
            showClear placeholder={k("whtByType")} />
        ))}
        {field("whtApplicable", k("whtApplicable"), (
          <div className="flex align-items-center gap-2">
            <Checkbox inputId="payee-whtApplicable" checked={form.whtApplicable} onChange={(e) => set("whtApplicable")(e.checked)} />
            <span>{k("whtApplicableHint")}</span>
          </div>
        ))}
        {field("status", k("status"), <Dropdown inputId="payee-status" value={form.status} options={list(["Active", "Inactive"])} onChange={(e) => set("status")(e.value)} />)}
      </div>
      {field("address", k("address"), <InputTextarea id="payee-address" value={form.address || ""} onChange={(e) => set("address")(e.target.value)} rows={2} autoResize />)}
    </Dialog>
  );
};

PayeeDialog.propTypes = {
  /** null: closed; {}: add; the account's referrer block: edit */
  payee: PropTypes.object,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
PayeeDialog.defaultProps = { payee: null };

export default PayeeDialog;
