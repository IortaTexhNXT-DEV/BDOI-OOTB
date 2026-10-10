/**
 * The dialog that puts payment vouchers on a new bank payment batch (draft), shared by Bank Payment Files (New batch)
 * and Accounts > Remittance > Insurer payments (Create Metrobank batch). It calls the endpoints of Bank Payment Files:
 * the layouts, the broker's bank accounts and the vouchers that can go on a batch, then POST /bank-payments/batches.
 *
 *   <BankBatchDialog visible={open} onHide={close} onCreated={(batch, message) => ...} />
 *   <BankBatchDialog visible={open} preselectedIds={["pv_102", "pv_103"]} payeeType="Insurer" bankCode="MBT"
 *     onHide={close} onCreated={(batch) => showResult(batch)} />
 *
 * With `preselectedIds` the dialog lists those vouchers only, all included (a voucher can still be left out); a voucher
 * that can no longer go on a batch is counted, not listed. The layout of `bankCode` (or `layoutCode`) is chosen first,
 * and the debit account of the same bank. The value date is today or later, on a working day. A refusal of the server
 * stays in the dialog. Payee accounts show their last four digits; the warning on a starter layout is for the users who
 * maintain the layouts.
 */
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import DateField from "../DateField";
import StatusChip from "../StatusChip";
import { codeAmount } from "../../utility/currencyConverter";
import { canOpen } from "../../utils/canOpen";
import service from "../../services/integrationsService";
import { formatDate, instantParts } from "../../utility/dateFormat";
import "./bankBatchDialog.scss";

const CHANNELS = ["bulk_credit", "instapay", "pesonet"];
const amount = (v) => codeAmount(v, "PHP");

/** "BPI ···8801": the bank and the last four digits of the payee's account. */
const maskedAccount = (bankCode, number) => {
  const digits = String(number || "").replace(/\D/g, "");
  return [bankCode, digits ? `···${digits.slice(-4)}` : null].filter(Boolean).join(" ");
};

const LAYOUTS = "/master/finance/bank-file-layouts";
const same = (a, b) => String(a || "").toUpperCase() === String(b || "").toUpperCase();

/** Today in the business time zone (YYYY-MM-DD). */
export const businessDay = (now = new Date()) => instantParts(now)?.day || now.toISOString().slice(0, 10);

/** Why a value date cannot be used: "past", "weekend" or null. */
export const valueDateProblem = (iso, today = businessDay()) => {
  if (!iso) return "required";
  if (iso < today) return "past";
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6 ? "weekend" : null;
};

/** The first working day from `iso` on (Saturday and Sunday move to Monday). */
export const firstWorkingDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
};

/** The layout to start with: `layoutCode`, else the first of `bankCode` (a real one before a starter layout), else none. */
export const defaultLayout = (layouts, { layoutCode, bankCode } = {}) => {
  if (layoutCode && layouts.some((l) => l.code === layoutCode)) return layouts.find((l) => l.code === layoutCode);
  if (!bankCode) return null;
  const ofBank = layouts.filter((l) => same(l.bankCode, bankCode));
  return ofBank.find((l) => !l.isExample) || ofBank[0] || null;
};

const BankBatchDialog = ({ visible, onHide, onCreated, preselectedIds, payeeType, bankCode, layoutCode, header }) => {
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ layoutCode: null, bankAccountCode: null, channel: "pesonet", valueDate: firstWorkingDay(businessDay()), remarks: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const presetKey = (preselectedIds || []).map(String).join(",");
  const preset = useMemo(() => (presetKey ? presetKey.split(",") : null), [presetKey]);

  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    setError(null);
    setSelected([]);
    setLoading(true);
    Promise.all([service.layouts(), service.bankAccounts(), service.eligibleVouchers(payeeType ? { payeeType } : {})])
      .then(([l, a, v]) => {
        if (!live) return;
        const layoutRows = l?.data || [];
        const accountRows = a || [];
        const rows = (v || []).filter((x) => !preset || preset.includes(String(x.disbursementId)));
        const first = defaultLayout(layoutRows, { layoutCode, bankCode });
        const account = first ? accountRows.find((x) => same(x.bankCode, first.bankCode)) : null;
        setLayouts(layoutRows);
        setAccounts(accountRows);
        setVouchers(rows);
        setSelected(preset ? rows.filter((x) => x.ready) : []);
        setForm({ layoutCode: first?.code || null, bankAccountCode: account?.code || null, channel: first?.channels?.[0] || "pesonet", valueDate: firstWorkingDay(businessDay()), remarks: "" });
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [visible, preset, payeeType, bankCode, layoutCode]);

  const layout = layouts.find((l) => l.code === form.layoutCode);
  const total = selected.reduce((s, v) => s + Number(v.amount), 0);
  const missing = preset ? preset.length - vouchers.length : 0;
  const dateProblem = valueDateProblem(form.valueDate);
  const canCreate = !!form.layoutCode && !!form.bankAccountCode && selected.length > 0 && !dateProblem && !saving;

  const chooseLayout = (code) => {
    const l = layouts.find((x) => x.code === code);
    setForm((f) => ({ ...f, layoutCode: code, channel: l?.channels?.includes(f.channel) ? f.channel : l?.channels?.[0] }));
  };
  const tick = (row, on) => setSelected((cur) => (on ? [...cur.filter((r) => r.disbursementId !== row.disbursementId), row] : cur.filter((r) => r.disbursementId !== row.disbursementId)));

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await service.createBatch({
        layoutCode: form.layoutCode, bankAccountCode: form.bankAccountCode, channel: form.channel, valueDate: form.valueDate,
        disbursementIds: selected.map((v) => v.disbursementId), remarks: form.remarks.trim() || undefined,
      });
      onCreated(r.data, r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="bv-bank-batch__footer">
      <span className="bv-bank-batch__total">{t("bankBatchDialog.count", { count: selected.length, amount: amount(total) })}</span>
      <Button type="button" label={t("bankBatchDialog.cancel")} text onClick={onHide} />
      <Button type="button" label={t("bankBatchDialog.create", { count: selected.length })} onClick={create} disabled={!canCreate} loading={saving} />
    </div>
  );

  const payeeCell = (v) => (
    <div>
      <div>{v.payeeName}</div>
      {preset ? null : <div className="bv-bank-batch__muted">{t(`integrations.payeeTypes.${v.payeeType}`, { defaultValue: v.payeeType })}</div>}
    </div>
  );
  const accountCell = (v) => (v.ready ? maskedAccount(v.bankCode, v.accountNumber) : <span className="bv-bank-batch__no-account">{t("bankBatchDialog.noAccount")}</span>);

  return (
    <Dialog className="bv-bank-batch" header={header || t("bankBatchDialog.title")} visible={visible} style={{ width: "min(1000px, 98vw)" }} onHide={onHide} footer={footer}>
      {error ? <Message severity="error" className="w-full bv-bank-batch__error" text={error} /> : null}
      <div className="bv-bank-batch__fields">
        <div className="bv-bank-batch__field bv-bank-batch__field--wide">
          <label htmlFor="bank-batch-layout">{t("bankBatchDialog.layout")}</label>
          <Dropdown inputId="bank-batch-layout" value={form.layoutCode} options={layouts.map((l) => ({ label: l.name, value: l.code }))} onChange={(e) => chooseLayout(e.value)}
            placeholder={t("bankBatchDialog.chooseLayout")} className="w-full" />
        </div>
        <div className="bv-bank-batch__field bv-bank-batch__field--wide">
          <label htmlFor="bank-batch-account">{t("bankBatchDialog.debitAccount")}</label>
          <Dropdown inputId="bank-batch-account" value={form.bankAccountCode} options={accounts.map((a) => ({ label: `${a.name} (${a.bankCode} ${a.accountNumber})`, value: a.code }))}
            onChange={(e) => setForm((f) => ({ ...f, bankAccountCode: e.value }))} placeholder={t("bankBatchDialog.chooseAccount")} className="w-full" />
        </div>
        <div className="bv-bank-batch__field">
          <label htmlFor="bank-batch-channel">{t("bankBatchDialog.channel")}</label>
          <Dropdown inputId="bank-batch-channel" value={form.channel} options={(layout?.channels || CHANNELS).map((c) => ({ label: t(`integrations.channelTypes.${c}`), value: c }))}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.value }))} className="w-full" />
        </div>
        <div className="bv-bank-batch__field">
          <label htmlFor="bank-batch-value-date">{t("bankBatchDialog.valueDate")}</label>
          <DateField id="bank-batch-value-date" value={form.valueDate} min={businessDay()} invalid={!!dateProblem}
            onChange={(e) => setForm((f) => ({ ...f, valueDate: e.target.value }))} aria-describedby={dateProblem ? "bank-batch-value-date-problem" : undefined} />
          {dateProblem ? <small id="bank-batch-value-date-problem" className="bv-bank-batch__problem">{t(`bankBatchDialog.valueDateProblem.${dateProblem}`)}</small> : null}
        </div>
      </div>
      {layout?.isExample && canOpen(LAYOUTS) ? <div className="bv-bank-batch__starter"><StatusChip label={t("integrations.starterLayout")} severity="warning" /></div> : null}

      <h3 className="bv-bank-batch__title">{preset ? t("bankBatchDialog.included") : t("bankBatchDialog.vouchers")}</h3>
      {missing > 0 ? <p className="bv-bank-batch__missing" role="status">{t("bankBatchDialog.notEligible", { count: missing })}</p> : null}
      <DataTable value={vouchers} loading={loading} dataKey="disbursementId" size="small" emptyMessage={t("bankBatchDialog.noVouchers")} scrollable scrollHeight="20rem">
        <Column style={{ width: "3rem" }} body={(v) => (v.ready ? (
          <Checkbox checked={selected.some((s) => s.disbursementId === v.disbursementId)} onChange={(e) => tick(v, e.checked)}
            aria-label={t("bankBatchDialog.include", { voucher: v.voucherNumber })} />
        ) : null)} />
        <Column field="voucherNumber" header={t("bankBatchDialog.voucher")} />
        <Column header={preset ? t("bankBatchDialog.insurer") : t("bankBatchDialog.payee")} body={payeeCell} />
        <Column header={t("bankBatchDialog.amount")} body={(v) => amount(v.amount)} align="right" />
        {preset ? null : <Column header={t("bankBatchDialog.paidTo")} body={accountCell} />}
        {preset ? null : <Column header={t("bankBatchDialog.voucherDate")} body={(v) => formatDate(v.voucherDate, { empty: "" })} />}
      </DataTable>

      <div className="bv-bank-batch__field bv-bank-batch__remarks">
        <label htmlFor="bank-batch-remarks">{t("bankBatchDialog.remarks")}</label>
        <InputText id="bank-batch-remarks" value={form.remarks} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} className="w-full" />
      </div>
    </Dialog>
  );
};

BankBatchDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  /** (batch, message): the new draft batch of the server and its message */
  onCreated: PropTypes.func.isRequired,
  /** the vouchers (disbursement ids) to put on the batch; empty lists every voucher that can go on a batch */
  preselectedIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  /** lists the vouchers of one payee type only (Insurer) */
  payeeType: PropTypes.string,
  /** the bank whose layout and debit account are chosen first (MBT) */
  bankCode: PropTypes.string,
  layoutCode: PropTypes.string,
  header: PropTypes.node,
};

BankBatchDialog.defaultProps = { preselectedIds: null, payeeType: null, bankCode: null, layoutCode: null, header: null };

export default BankBatchDialog;
