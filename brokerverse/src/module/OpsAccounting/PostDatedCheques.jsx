import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";

const STATUSES = ["on-hand", "open", "deposited", "cleared", "bounced", "replaced", "returned", "cancelled", "all"];
const emptyCheque = { bankId: null, draweeBank: "", chequeNumber: "", chequeDate: null, amount: null, storageLocation: "", remarks: "" };

/**
 * Accounts > Post-Dated Cheques: cheques received against bills kept on hand until their date (register and vault
 * location), the deposit due list, deposit (the official receipt is created and posted), cleared, bounced (the receipt
 * is cancelled and the bill is open again), replacement and return.
 */
const PostDatedCheques = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState("on-hand");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [due, setDue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(null); // register / replace: { mode, target, pdc, ...cheque }
  const [deposit, setDeposit] = useState(null); // { pdc, depositAccount, depositDate }
  const [bounce, setBounce] = useState(null); // { pdc, reason, bounceCharge }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, x] = await Promise.all([service.pdcs({ status, search: search || undefined }), service.pdcDue()]);
      setData(d);
      setDue(x);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([service.banks(), service.bankAccounts()]).then(([b, a]) => { setBanks(b); setAccounts(a); }).catch(() => {});
  }, []);

  const run = async (fn, message) => {
    try {
      const r = await fn();
      showSuccess(toast, typeof message === "function" ? message(r) : message);
      load();
      return true;
    } catch (e) {
      showError(toast, e);
      return false;
    }
  };
  const saveCheque = async () => {
    const cheque = { bankId: form.bankId || null, draweeBank: form.draweeBank || null, chequeNumber: form.chequeNumber, chequeDate: isoOf(form.chequeDate), amount: form.amount || undefined,
      storageLocation: form.storageLocation || null, remarks: form.remarks || null };
    const ok = form.mode === "replace"
      ? await run(() => service.pdcAction(form.pdc.id, "replace", cheque), (r) => t("opsAcc.pdc.replaced", { number: r.pdc.pdcNumber }))
      : await run(() => service.registerPdc({ ...cheque, [form.targetKind]: form.target }), (r) => t("opsAcc.pdc.registered", { number: r.pdcNumber }));
    if (ok) setForm(null);
  };
  const close = async (pdc, action) => {
    const reason = await promptText(t(`opsAcc.pdc.${action}Reason`));
    if (reason) run(() => service.pdcAction(pdc.id, action, { reason }), t(`opsAcc.pdc.${action}Done`));
  };
  const actions = (r) => (
    <span className="flex gap-1 flex-wrap">
      {r.status === "on-hand" && <Button label={t("opsAcc.pdc.deposit")} size="small" outlined onClick={() => setDeposit({ pdc: r, depositAccount: accounts[0]?.value || null, depositDate: new Date() })} />}
      {r.status === "deposited" && <Button label={t("opsAcc.pdc.clear")} size="small" outlined onClick={() => run(() => service.pdcAction(r.id, "clear"), t("opsAcc.pdc.clearedDone"))} />}
      {["deposited", "cleared"].includes(r.status) && <Button label={t("opsAcc.pdc.bounce")} size="small" severity="danger" outlined onClick={() => setBounce({ pdc: r, reason: "", bounceCharge: 0 })} />}
      {["bounced", "on-hand"].includes(r.status) && <Button label={t("opsAcc.pdc.replace")} size="small" text onClick={() => setForm({ ...emptyCheque, mode: "replace", pdc: r, amount: r.amount })} />}
      {r.status === "on-hand" && <Button label={t("opsAcc.pdc.return")} size="small" text onClick={() => close(r, "return")} />}
      {r.status === "on-hand" && <Button label={t("opsAcc.cancel")} size="small" text onClick={() => close(r, "cancel")} />}
    </span>
  );
  const table = (rows, paged = true) => (
    <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator={paged} rows={20} emptyMessage={t("opsAcc.none")}>
      <Column field="pdcNumber" header={t("opsAcc.pdc.number")} />
      <Column field="clientName" header={t("opsAcc.client")} />
      <Column header={t("opsAcc.pdc.bill")} body={(r) => r.billNumber || r.policyNumber} />
      <Column field="bankName" header={t("opsAcc.pdc.bank")} />
      <Column field="chequeNumber" header={t("opsAcc.pdc.chequeNumber")} />
      <Column header={t("opsAcc.pdc.chequeDate")} body={(r) => date(r.chequeDate)} />
      <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
      <Column field="storageLocation" header={t("opsAcc.pdc.keptIn")} />
      <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
      <Column field="receiptNumber" header={t("opsAcc.pdc.receipt")} />
      <Column body={actions} />
    </DataTable>
  );

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.pdc.title")} subtitle={t("opsAcc.pdc.intro")}>
        <Button icon="pi pi-download" label={t("opsAcc.export")} outlined onClick={() => service.downloadPdcs({ status }).catch((e) => showError(toast, e))} />
        <Button icon="pi pi-plus" label={t("opsAcc.pdc.register")} onClick={() => setForm({ ...emptyCheque, mode: "register", targetKind: "receivableId", target: "" })} />
      </PageHeader>
      {data && (
        <div className="flex gap-4 mb-3">
          <span>{t("opsAcc.pdc.onHand")}: <b>{data.summary.onHand}</b> ({money(data.summary.onHandAmount)})</span>
          <span>{t("opsAcc.pdc.dueNow")}: <b>{data.summary.dueNow}</b> ({money(data.summary.dueNowAmount)})</span>
          <span>{t("opsAcc.pdc.bounced")}: <b>{data.summary.bounced}</b></span>
        </div>
      )}
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("opsAcc.pdc.register")}>
            <div className="flex gap-2 mb-2">
              <Dropdown value={status} options={STATUSES.map((s) => ({ label: t(`opsAcc.status.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} className="w-12rem" />
              <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.pdc.searchHint")} className="w-20rem" />
            </div>
            {table(data?.rows || [])}
          </TabPanel>
          <TabPanel header={`${t("opsAcc.pdc.depositDue")} (${due?.rows.length || 0})`}>
            <p className="pe-muted mt-0">{t("opsAcc.pdc.depositDueHelp", { days: due?.windowDays ?? 0, total: money(due?.total || 0) })}</p>
            {table(due?.rows || [], false)}
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={form?.mode === "replace" ? t("opsAcc.pdc.replaceTitle", { number: form.pdc.pdcNumber }) : t("opsAcc.pdc.register")} visible={!!form}
        style={{ width: "min(720px, 96vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setForm(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save" onClick={saveCheque} /></div>}>
        {form && (
          <div className="grid">
            {form.mode === "register" && (
              <>
                <Field label={t("opsAcc.pdc.against")} col="col-12 md:col-4">
                  <Dropdown value={form.targetKind} options={[{ label: t("opsAcc.pdc.billNumber"), value: "receivableId" }, { label: t("opsAcc.policyNumber"), value: "policyId" }]}
                    onChange={(e) => setForm({ ...form, targetKind: e.value })} className="w-full" />
                </Field>
                <Field label={t("opsAcc.reference")} col="col-12 md:col-8" required><InputText value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full" /></Field>
              </>
            )}
            <Field label={t("opsAcc.pdc.bank")} col="col-12 md:col-6">
              <Dropdown value={form.bankId} options={banks} optionLabel="label" optionValue="value" filter showClear onChange={(e) => setForm({ ...form, bankId: e.value })} className="w-full" />
            </Field>
            <Field label={t("opsAcc.pdc.draweeBank")} col="col-12 md:col-6"><InputText value={form.draweeBank} onChange={(e) => setForm({ ...form, draweeBank: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.pdc.chequeNumber")} col="col-12 md:col-4" required><InputText value={form.chequeNumber} onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.pdc.chequeDate")} col="col-12 md:col-4" required><Calendar value={form.chequeDate} onChange={(e) => setForm({ ...form, chequeDate: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.amount")} col="col-12 md:col-4" required><InputNumber value={form.amount} mode="decimal" minFractionDigits={2} onValueChange={(e) => setForm({ ...form, amount: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.pdc.keptIn")} col="col-12 md:col-6"><InputText value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.remarks")} col="col-12 md:col-6"><InputText value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full" /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={deposit ? t("opsAcc.pdc.depositTitle", { number: deposit.pdc.pdcNumber }) : ""} visible={!!deposit} style={{ width: "min(520px, 96vw)" }} onHide={() => setDeposit(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setDeposit(null)} />
          <Button label={t("opsAcc.pdc.deposit")} icon="pi pi-check" onClick={async () => {
            if (await run(() => service.pdcAction(deposit.pdc.id, "deposit", { depositAccount: deposit.depositAccount, depositDate: isoOf(deposit.depositDate) }), (r) => t("opsAcc.pdc.deposited", { receipt: r.receiptNumber }))) setDeposit(null);
          }} /></div>}>
        {deposit && (
          <div className="grid">
            <Field label={t("opsAcc.bankAccount")} col="col-12"><Dropdown value={deposit.depositAccount} options={accounts} optionLabel="label" optionValue="value" onChange={(e) => setDeposit({ ...deposit, depositAccount: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.pdc.depositDate")} col="col-12"><Calendar value={deposit.depositDate} onChange={(e) => setDeposit({ ...deposit, depositDate: e.value })} showIcon className="w-full" /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={bounce ? t("opsAcc.pdc.bounceTitle", { number: bounce.pdc.pdcNumber }) : ""} visible={!!bounce} style={{ width: "min(520px, 96vw)" }} onHide={() => setBounce(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setBounce(null)} />
          <Button label={t("opsAcc.pdc.bounce")} severity="danger" onClick={async () => {
            if (await run(() => service.pdcAction(bounce.pdc.id, "bounce", { reason: bounce.reason, bounceCharge: bounce.bounceCharge || 0 }), t("opsAcc.pdc.bouncedDone"))) setBounce(null);
          }} /></div>}>
        {bounce && (
          <div className="grid">
            <Field label={t("opsAcc.pdc.bounceReason")} col="col-12" required><InputText value={bounce.reason} onChange={(e) => setBounce({ ...bounce, reason: e.target.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.pdc.bounceCharge")} col="col-12"><InputNumber value={bounce.bounceCharge} mode="decimal" minFractionDigits={2} onValueChange={(e) => setBounce({ ...bounce, bounceCharge: e.value })} className="w-full" /></Field>
            <p className="pe-muted col-12 m-0">{t("opsAcc.pdc.bounceHelp")}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default PostDatedCheques;
