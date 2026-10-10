import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import KeyValueGrid from "../../../components/KeyValueGrid";
import service from "../../../services/opsAccountingService";
import { Field, date, money, todayIso } from "../common";
import { pathErrors } from "./model";

const emptyRow = (r) => ({ seq: r.seq, dueDate: r.dueDate, amount: r.amount, bank: null, branch: "", accountNumber: "", brstn: "", chequeNumber: "", chequeDate: r.dueDate });

/** The cheque number after `n`, keeping its leading zeros (0045121 -> 0045122). */
export const nextCheque = (n, step = 1) => {
  const text = String(n || "");
  if (!/^\d+$/.test(text)) return "";
  return String(Number(text) + step).padStart(text.length, "0");
};

/** The row as the API takes it: a bank of the master by id, or the name typed. */
const rowPayload = (r) => ({
  seq: r.seq, ...(typeof r.bank === "number" ? { bankId: r.bank } : { draweeBank: r.bank || null }), branch: r.branch || null, accountNumber: r.accountNumber || null,
  brstn: r.brstn || null, chequeNumber: String(r.chequeNumber || "").trim(), chequeDate: r.chequeDate || null,
});

/**
 * Encode PDCs (FR-PDC-001 to 004): the policy, the bill, the payee and one row per unpaid instalment of the plan; the
 * bank details of row 1 can be copied down with the cheque numbers running on. Save set creates the set and its cheques.
 */
const EncodeDialog = ({ visible, onHide, onSaved, banks }) => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPolicy("");
      setData(null);
      setForm(null);
      setRows([]);
      setErrors({});
    }
  }, [visible]);

  const load = async (bill = null) => {
    setErrors({});
    if (!policy.trim()) {
      setErrors({ policyNumber: t("opsAcc.required") });
      return;
    }
    setBusy(true);
    try {
      const d = await service.pdcEncode(policy.trim(), bill);
      setData(d);
      setForm((f) => ({ payee: f?.payee || d.defaultPayee, receivedDate: f?.receivedDate || todayIso(), storageLocation: f?.storageLocation || "" }));
      setRows(d.rows.map(emptyRow));
    } catch (e) {
      setData(null);
      setRows([]);
      setErrors({ policyNumber: e.message });
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i, patch) => setRows((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const copyDown = () => setRows((list) => list.map((r, i) => (i === 0 ? r : {
    ...r, bank: list[0].bank, branch: list[0].branch, accountNumber: list[0].accountNumber, brstn: list[0].brstn,
    chequeNumber: r.chequeNumber || nextCheque(list[0].chequeNumber, i),
  })));
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const lastDate = rows.map((r) => r.chequeDate).filter(Boolean).sort().at(-1);

  const save = async () => {
    const local = {};
    rows.forEach((r, i) => {
      if (!r.bank) local[`rows[${i}].bankId`] = t("opsAcc.pdc.chooseBank", { n: i + 1 });
      if (!String(r.chequeNumber || "").trim()) local[`rows[${i}].chequeNumber`] = t("opsAcc.required");
      if (!r.chequeDate) local[`rows[${i}].chequeDate`] = t("opsAcc.required");
    });
    if (!rows.length) local.rows = t("opsAcc.pdc.keepOneRow");
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await service.encodePdcSet({ policyNumber: data.policyNumber, billId: data.billId, payee: form.payee, receivedDate: form.receivedDate,
        storageLocation: form.storageLocation || null, rows: rows.map(rowPayload) });
      onSaved(r);
    } catch (e) {
      const byPath = pathErrors(e);
      setErrors(Object.keys(byPath).length ? byPath : { rows: e.message });
    } finally {
      setBusy(false);
    }
  };

  const bankOptions = banks.map((b) => ({ label: b.label, value: Number(b.value) }));
  const err = (i, field) => errors[`rows[${i}].${field}`];

  return (
    <Dialog className="pe-dialog" header={t("opsAcc.pdc.encode")} visible={visible} style={{ width: "min(1180px, 98vw)" }} onHide={onHide}
      footer={(
        <div>
          <Button label={t("opsAcc.cancel")} text onClick={onHide} />
          <Button label={t("opsAcc.pdc.saveSet")} icon="pi pi-check" disabled={!data || !rows.length || busy} loading={busy} onClick={save} />
        </div>
      )}>
      <div className="grid">
        <Field label={t("opsAcc.policyNumber")} col="col-12 md:col-5" required error={errors.policyNumber}>
          <div className="p-inputgroup">
            <InputText value={policy} onChange={(e) => setPolicy(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(); }} aria-label={t("opsAcc.policyNumber")} />
            <Button icon="pi pi-search" aria-label={t("opsAcc.search")} onClick={() => load()} loading={busy && !data} />
          </div>
        </Field>
        {data ? (
          <>
            <Field label={t("opsAcc.pdc.billLabel")} col="col-12 md:col-3">
              <Dropdown value={data.billId} options={data.bills.map((b) => ({ label: `${b.billNumber} · ${money(b.balance)}`, value: b.id }))} onChange={(e) => load(e.value)} className="w-full" />
            </Field>
            <Field label={t("opsAcc.pdc.payee")} col="col-12 md:col-4" required error={errors.payee}>
              <Dropdown value={form.payee} options={["insurance-partner", "tisph"].map((v) => ({ label: t(`opsAcc.pdc.payees.${v}`), value: v }))}
                onChange={(e) => setForm({ ...form, payee: e.value })} className="w-full" />
            </Field>
            <div className="col-12">
              <KeyValueGrid columns={4} items={[
                { label: t("opsAcc.client"), value: data.clientName },
                { label: t("opsAcc.pdc.insurancePartner"), value: data.insurerName },
                { label: t("opsAcc.pdc.billBalance"), value: data.billBalance, type: "amount" },
                { label: t("opsAcc.pdc.depositAccount"), value: form.payee === "tisph" ? data.depositAccount : null, hidden: form.payee !== "tisph" },
              ]} />
            </div>
            <Field label={t("opsAcc.pdc.receivedDate")} col="col-12 md:col-3" required error={errors.receivedDate}>
              <DateField id="pdc-received" value={form.receivedDate} max={todayIso()} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
            </Field>
            <Field label={t("opsAcc.pdc.vaultFolder")} col="col-12 md:col-4">
              <InputText value={form.storageLocation} maxLength={60} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} className="w-full" />
            </Field>
            <div className="col-12">
              {errors.rows ? <FieldError error={errors.rows} /> : null}
              {!rows.length ? <p className="pe-muted">{t("opsAcc.pdc.nothingToEncode")}</p> : (
                <table className="pdc-rows">
                  <thead>
                    <tr>
                      <th>{t("opsAcc.pdc.inst")}</th><th>{t("opsAcc.pdc.dueDate")}</th><th className="bv-num">{t("opsAcc.amount")}</th>
                      <th>{t("opsAcc.pdc.bank")} *</th><th>{t("opsAcc.pdc.branch")}</th><th>{t("opsAcc.pdc.accountNumber")}</th><th>{t("opsAcc.pdc.brstn")}</th>
                      <th>{t("opsAcc.pdc.chequeNumber")} *</th><th>{t("opsAcc.pdc.chequeDate")} *</th><th aria-label={t("opsAcc.remove")} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.seq}-${i}`}>
                        <td>{r.seq ? t("opsAcc.pdc.instOf", { n: r.seq, m: data.instalmentCount }) : "—"}</td>
                        <td>{date(r.dueDate)}</td>
                        <td className="bv-num">{money(r.amount)}</td>
                        <td>
                          <Dropdown value={r.bank} options={bankOptions} editable filter={false} placeholder={t("opsAcc.select")} onChange={(e) => setRow(i, { bank: e.value })}
                            aria-label={t("opsAcc.pdc.bank")} className={`w-full${err(i, "bankId") ? " p-invalid" : ""}`} />
                          <FieldError error={err(i, "bankId")} />
                        </td>
                        <td><InputText value={r.branch} onChange={(e) => setRow(i, { branch: e.target.value })} aria-label={t("opsAcc.pdc.branch")} className="w-full" /></td>
                        <td><InputText value={r.accountNumber} onChange={(e) => setRow(i, { accountNumber: e.target.value })} aria-label={t("opsAcc.pdc.accountNumber")} className="w-full" /></td>
                        <td>
                          <InputText value={r.brstn} maxLength={9} keyfilter="int" onChange={(e) => setRow(i, { brstn: e.target.value })} aria-label={t("opsAcc.pdc.brstn")}
                            className={`w-full${err(i, "brstn") ? " p-invalid" : ""}`} />
                          <FieldError error={err(i, "brstn")} />
                        </td>
                        <td>
                          <InputText value={r.chequeNumber} maxLength={10} keyfilter="int" onChange={(e) => setRow(i, { chequeNumber: e.target.value })} aria-label={t("opsAcc.pdc.chequeNumber")}
                            className={`w-full${err(i, "chequeNumber") ? " p-invalid" : ""}`} />
                          <FieldError error={err(i, "chequeNumber")} />
                        </td>
                        <td>
                          <DateField id={`pdc-date-${i}`} value={r.chequeDate} onChange={(e) => setRow(i, { chequeDate: e.target.value })} invalid={!!err(i, "chequeDate")} />
                          <FieldError error={err(i, "chequeDate") || err(i, "seq")} />
                        </td>
                        <td>
                          <Button icon="pi pi-times" text rounded severity="secondary" disabled={rows.length < 2} aria-label={t("opsAcc.pdc.removeRow", { n: i + 1 })}
                            tooltip={t("opsAcc.remove")} onClick={() => setRows(rows.filter((_, n) => n !== i))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {rows.length > 1 ? <div className="col-12 md:col-4"><Button label={t("opsAcc.pdc.copyDown")} icon="pi pi-angle-double-down" text onClick={copyDown} /></div> : null}
            <div className={rows.length > 1 ? "col-12 md:col-8" : "col-12"}>
              <KeyValueGrid columns={3} items={[
                { label: t("opsAcc.pdc.cheques"), value: rows.length, type: "number" },
                { label: t("opsAcc.total"), value: total, type: "amount" },
                { label: t("opsAcc.pdc.endOfTerm"), value: lastDate, type: "date" },
              ]} />
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
};

EncodeDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  banks: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) })).isRequired,
};

export default EncodeDialog;
