import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DateField from "../../../components/DateField";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import service from "../../../services/opsAccountingService";
import { Field, blank, date, money, numericColumn, todayIso } from "../common";
import { pathErrors } from "./model";

const SENT_BY = ["courier", "messenger", "hand-carry"];

/** The form of each action: its initial values. */
const INITIAL = {
  forward: () => ({ forwardedOn: todayIso(), sentBy: null, courierReference: "", remarks: "" }),
  "partner-received": () => ({ receivedOn: todayIso(), receivedBy: "", partnerReference: "" }),
  "partner-cleared": () => ({ collectedOn: todayIso(), partnerReference: "", remarks: "" }),
  "partner-bounced": () => ({ bouncedOn: todayIso(), reason: null }),
  bounce: () => ({ bouncedOn: todayIso(), reason: null, bounceCharge: 0 }),
  deposit: () => ({ depositDate: todayIso() }),
  "partner-returned": () => ({ returnedOn: todayIso(), partnerReference: "" }),
  return: (c) => ({ returnedOn: todayIso(), returnedTo: c?.clientName || "", reason: "" }),
  replace: (c) => ({ bank: null, branch: "", accountNumber: "", brstn: "", chequeNumber: "", chequeDate: c?.instalmentDueDate || null }),
  edit: (c) => ({ bank: c?.bankId || c?.draweeBank || null, branch: c?.branch || "", accountNumber: c?.accountNumber || "", brstn: c?.brstn || "",
    chequeNumber: c?.chequeNumber || "", chequeDate: c?.chequeDate || null, storageLocation: c?.storageLocation || "", remarks: c?.remarks || "" }),
};

const bankPayload = (bank) => (typeof bank === "number" ? { bankId: bank, draweeBank: null } : { bankId: null, draweeBank: bank || null });

/**
 * The side panel of an action on one or more cheques of the log: forward (a transmittal), partner received, partner
 * cleared (an AR per cheque), partner bounced, deposit, bounced, partner returned, return to client, replace and edit.
 * `action` = { kind, cheques, transmittal }; onDone(message) after the server accepted it.
 */
const ActionDialog = ({ action, onHide, onDone, banks, depositAccount, pullOuts }) => {
  const { t } = useTranslation();
  const kind = action?.kind;
  const cheques = action?.cheques || [];
  const one = cheques[0] || null;
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind) {
      setForm(INITIAL[kind](one));
      setErrors({});
    }
  }, [kind, one]);

  if (!kind) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const required = t("opsAcc.required");
  const total = cheques.reduce((s, c) => s + Number(c.amount || 0), 0);

  const rules = {
    forward: () => ({ sentBy: form.sentBy ? null : required, forwardedOn: form.forwardedOn ? null : required }),
    "partner-received": () => ({ receivedBy: blank(form.receivedBy) ? t("opsAcc.pdc.receivedByRequired") : null }),
    "partner-cleared": () => ({ partnerReference: blank(form.partnerReference) ? t("opsAcc.pdc.partnerReferenceRequired") : null }),
    "partner-bounced": () => ({ reason: reasonProblem(form.reason) ? t("opsAcc.pdc.bounceReasonRequired") : null }),
    bounce: () => ({ reason: reasonProblem(form.reason) ? t("opsAcc.pdc.bounceReasonRequired") : null }),
    deposit: () => ({}),
    "partner-returned": () => ({}),
    return: () => ({ reason: blank(form.reason) ? required : null }),
    replace: () => ({ bank: form.bank ? null : required, chequeNumber: blank(form.chequeNumber) ? required : null, chequeDate: form.chequeDate ? null : required }),
    edit: () => ({}),
  };

  const call = {
    forward: () => service.forwardPdcs({ pdcIds: cheques.map((c) => c.id), forwardedOn: form.forwardedOn, sentBy: form.sentBy, courierReference: form.courierReference || null,
      remarks: form.remarks || null }).then((r) => t("opsAcc.pdc.forwardedDone", { count: cheques.length, partner: r.transmittal.insurerName, transmittal: r.transmittal.transmittalNumber })),
    "partner-received": () => service.pdcPartnerReceived(action.transmittal?.id || one.transmittalId, { receivedOn: form.receivedOn, receivedBy: form.receivedBy,
      partnerReference: form.partnerReference || null, pdcIds: cheques.map((c) => c.id) })
      .then((r) => t("opsAcc.pdc.warehousedDone", { count: r.ids.length, transmittal: r.transmittal.transmittalNumber, partner: r.transmittal.insurerName })),
    "partner-cleared": async () => {
      // one AR per cheque, one after the other
      const ars = await cheques.reduce(async (done, c) => {
        const list = await done;
        const r = await service.pdcAction(c.id, "partner-cleared", { collectedOn: form.collectedOn, partnerReference: form.partnerReference, remarks: form.remarks || null });
        return [...list, r.receiptNumber];
      }, Promise.resolve([]));
      return cheques.length === 1 ? t("opsAcc.pdc.clearedByPartner", { number: one.pdcNumber, ar: ars[0] }) : t("opsAcc.pdc.clearedManyByPartner", { count: ars.length });
    },
    "partner-bounced": () => service.pdcAction(one.id, "partner-bounced", { bouncedOn: form.bouncedOn, ...reasonPayload(form.reason) })
      .then(() => t("opsAcc.pdc.bouncedByPartner", { number: one.pdcNumber })),
    bounce: () => service.pdcAction(one.id, "bounce", { bouncedOn: form.bouncedOn, bounceCharge: form.bounceCharge || 0, ...reasonPayload(form.reason) })
      .then(() => t("opsAcc.pdc.bouncedDone")),
    deposit: () => service.pdcAction(one.id, "deposit", { depositDate: form.depositDate }).then((r) => t("opsAcc.pdc.deposited", { receipt: r.receiptNumber })),
    "partner-returned": () => service.pdcAction(one.id, "partner-returned", { returnedOn: form.returnedOn, partnerReference: form.partnerReference || null })
      .then(() => t("opsAcc.pdc.cancelledDone", { number: one.pdcNumber })),
    return: () => service.pdcAction(one.id, "return", { returnedOn: form.returnedOn, returnedTo: form.returnedTo || null, reason: form.reason })
      .then(() => t("opsAcc.pdc.returnedDone", { number: one.pdcNumber })),
    replace: () => service.pdcAction(one.id, "replace", { ...bankPayload(form.bank), branch: form.branch || null, accountNumber: form.accountNumber || null, brstn: form.brstn || null,
      chequeNumber: form.chequeNumber, chequeDate: form.chequeDate }).then((r) => t("opsAcc.pdc.replaced", { number: r.pdc.pdcNumber })),
    edit: () => service.updatePdc(one.id, one.status === "on-hand"
      ? { ...bankPayload(form.bank), branch: form.branch || null, accountNumber: form.accountNumber || null, brstn: form.brstn || null, chequeNumber: form.chequeNumber,
        chequeDate: form.chequeDate, storageLocation: form.storageLocation || null, remarks: form.remarks || null }
      : { storageLocation: form.storageLocation || null, remarks: form.remarks || null }).then((r) => t("opsAcc.pdc.savedDone", { number: r.pdcNumber })),
  };

  const submit = async () => {
    const local = Object.fromEntries(Object.entries(rules[kind]()).filter(([, m]) => m));
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      onDone(await call[kind]());
    } catch (e) {
      const byPath = pathErrors(e);
      setErrors(Object.keys(byPath).length ? byPath : { form: e.message });
    } finally {
      setBusy(false);
    }
  };

  const bankOptions = banks.map((b) => ({ label: b.label, value: Number(b.value) }));
  const confirmLabel = t(`opsAcc.pdc.actions.${kind}.confirm`);
  const facts = one && cheques.length === 1 ? (
    <KeyValueGrid columns={3} className="mb-3" items={[
      { label: t("opsAcc.pdc.number"), value: one.pdcNumber },
      { label: t("opsAcc.client"), value: one.clientName },
      { label: t("opsAcc.pdc.insurancePartner"), value: one.insurerName },
      { label: t("opsAcc.pdc.bankCheque"), value: `${one.bankName || ""} ${one.chequeNumber}`.trim() },
      { label: t("opsAcc.pdc.chequeDate"), value: one.chequeDate, type: "date" },
      { label: t("opsAcc.amount"), value: one.amount, type: "amount" },
    ]} />
  ) : (
    <DataTable value={cheques} dataKey="id" size="small" className="mb-3" footer={`${t("opsAcc.total")}: ${money(total)}`}>
      <Column field="pdcNumber" header={t("opsAcc.pdc.number")} />
      <Column field="clientName" header={t("opsAcc.client")} />
      <Column field="policyNumber" header={t("opsAcc.policy")} />
      <Column header={t("opsAcc.pdc.bankCheque")} body={(c) => `${c.bankName || ""} ${c.chequeNumber}`} />
      <Column header={t("opsAcc.pdc.chequeDate")} body={(c) => date(c.chequeDate)} />
      <Column header={t("opsAcc.amount")} body={(c) => money(c.amount)} {...numericColumn} />
    </DataTable>
  );

  const chequeFields = (withAll) => (
    <>
      <Field label={t("opsAcc.pdc.bank")} col="col-12 md:col-6" required={withAll} error={errors.bank || errors.bankId}>
        <Dropdown value={form.bank} options={bankOptions} editable placeholder={t("opsAcc.select")} disabled={!withAll} onChange={(e) => set({ bank: e.value })} className="w-full" />
      </Field>
      <Field label={t("opsAcc.pdc.branch")} col="col-12 md:col-6"><InputText value={form.branch} disabled={!withAll} onChange={(e) => set({ branch: e.target.value })} className="w-full" /></Field>
      <Field label={t("opsAcc.pdc.accountNumber")} col="col-12 md:col-6">
        <InputText value={form.accountNumber} disabled={!withAll} onChange={(e) => set({ accountNumber: e.target.value })} className="w-full" />
      </Field>
      <Field label={t("opsAcc.pdc.brstn")} col="col-12 md:col-6" error={errors.brstn || errors["rows[0].brstn"]}>
        <InputText value={form.brstn} maxLength={9} keyfilter="int" disabled={!withAll} onChange={(e) => set({ brstn: e.target.value })} className="w-full" />
      </Field>
      <Field label={t("opsAcc.pdc.chequeNumber")} col="col-12 md:col-6" required={withAll} error={errors.chequeNumber || errors["rows[0].chequeNumber"]}>
        <InputText value={form.chequeNumber} maxLength={10} keyfilter="int" disabled={!withAll} onChange={(e) => set({ chequeNumber: e.target.value })} className="w-full" />
      </Field>
      <Field label={t("opsAcc.pdc.chequeDate")} col="col-12 md:col-6" required={withAll} error={errors.chequeDate || errors["rows[0].chequeDate"]}>
        <DateField id="pdc-action-date" value={form.chequeDate} disabled={!withAll} onChange={(e) => set({ chequeDate: e.target.value })} />
      </Field>
    </>
  );

  const body = {
    forward: (
      <>
        <KeyValueGrid columns={2} className="mb-3" items={[{ label: t("opsAcc.pdc.insurancePartner"), value: one?.insurerName }, { label: t("opsAcc.pdc.cheques"), value: cheques.length, type: "number" }]} />
        <div className="grid">
          <Field label={t("opsAcc.pdc.forwardedOn")} col="col-12 md:col-4" required error={errors.forwardedOn}>
            <DateField id="pdc-forwarded" value={form.forwardedOn} max={todayIso()} onChange={(e) => set({ forwardedOn: e.target.value })} />
          </Field>
          <Field label={t("opsAcc.pdc.sentBy")} col="col-12 md:col-4" required error={errors.sentBy}>
            <Dropdown value={form.sentBy} options={SENT_BY.map((v) => ({ label: t(`opsAcc.pdc.sentByOptions.${v}`), value: v }))} placeholder={t("opsAcc.select")}
              onChange={(e) => set({ sentBy: e.value })} className="w-full" />
          </Field>
          <Field label={t("opsAcc.pdc.courierReference")} col="col-12 md:col-4">
            <InputText value={form.courierReference} maxLength={60} onChange={(e) => set({ courierReference: e.target.value })} className="w-full" />
          </Field>
          <Field label={t("opsAcc.remarks")} col="col-12"><InputText value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></Field>
        </div>
        {pullOuts?.length ? (
          <>
            <h4 className="mt-2 mb-2">{t("opsAcc.pdc.pullOutsOnTransmittal")}</h4>
            <DataTable value={pullOuts} dataKey="id" size="small">
              <Column field="pdcNumber" header={t("opsAcc.pdc.number")} />
              <Column field="clientName" header={t("opsAcc.client")} />
              <Column header={t("opsAcc.pdc.bankCheque")} body={(c) => `${c.bankName || ""} ${c.chequeNumber}`} />
              <Column header={t("opsAcc.amount")} body={(c) => money(c.amount)} {...numericColumn} />
            </DataTable>
          </>
        ) : null}
      </>
    ),
    "partner-received": (
      <div className="grid">
        <Field label={t("opsAcc.pdc.receivedOn")} col="col-12 md:col-4" required error={errors.receivedOn}>
          <DateField id="pdc-received-on" value={form.receivedOn} max={todayIso()} onChange={(e) => set({ receivedOn: e.target.value })} />
        </Field>
        <Field label={t("opsAcc.pdc.receivedBy")} col="col-12 md:col-4" required error={errors.receivedBy}>
          <InputText value={form.receivedBy} maxLength={80} onChange={(e) => set({ receivedBy: e.target.value })} className="w-full" />
        </Field>
        <Field label={t("opsAcc.pdc.partnerReference")} col="col-12 md:col-4">
          <InputText value={form.partnerReference} maxLength={60} onChange={(e) => set({ partnerReference: e.target.value })} className="w-full" />
        </Field>
      </div>
    ),
    "partner-cleared": (
      <div className="grid">
        <Field label={t("opsAcc.pdc.collectedOn")} col="col-12 md:col-4" required error={errors.collectedOn}>
          <DateField id="pdc-collected-on" value={form.collectedOn} max={todayIso()} onChange={(e) => set({ collectedOn: e.target.value })} />
        </Field>
        <Field label={t("opsAcc.pdc.partnerReference")} col="col-12 md:col-8" required error={errors.partnerReference}>
          <InputText value={form.partnerReference} maxLength={60} onChange={(e) => set({ partnerReference: e.target.value })} className="w-full" />
        </Field>
        <Field label={t("opsAcc.remarks")} col="col-12"><InputTextarea value={form.remarks} rows={2} maxLength={500} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></Field>
      </div>
    ),
    "partner-bounced": (
      <div className="grid">
        <Field label={t("opsAcc.pdc.bouncedOn")} col="col-12 md:col-4" required>
          <DateField id="pdc-bounced-on" value={form.bouncedOn} max={todayIso()} onChange={(e) => set({ bouncedOn: e.target.value })} />
        </Field>
        <div className="col-12 md:col-8">
          <ReasonPicker context="pdc_bounce" value={form.reason} onChange={(v) => set({ reason: v })} label={t("opsAcc.pdc.partnerBounceReason")} showErrors={!!errors.reason} />
        </div>
      </div>
    ),
    bounce: (
      <div className="grid">
        <Field label={t("opsAcc.pdc.bouncedOn")} col="col-12 md:col-4" required>
          <DateField id="pdc-bank-bounced-on" value={form.bouncedOn} max={todayIso()} onChange={(e) => set({ bouncedOn: e.target.value })} />
        </Field>
        <Field label={t("opsAcc.pdc.bounceCharge")} col="col-12 md:col-4">
          <InputNumber value={form.bounceCharge} mode="decimal" minFractionDigits={2} onValueChange={(e) => set({ bounceCharge: e.value })} className="w-full" />
        </Field>
        <div className="col-12">
          <ReasonPicker context="pdc_bounce" value={form.reason} onChange={(v) => set({ reason: v })} label={t("opsAcc.pdc.bounceReason")} showErrors={!!errors.reason} />
        </div>
      </div>
    ),
    deposit: (
      <div className="grid">
        <Field label={t("opsAcc.pdc.depositAccount")} col="col-12 md:col-7"><InputText value={depositAccount || ""} readOnly disabled className="w-full" /></Field>
        <Field label={t("opsAcc.pdc.depositDate")} col="col-12 md:col-5" required>
          <DateField id="pdc-deposit-date" value={form.depositDate} max={todayIso()} onChange={(e) => set({ depositDate: e.target.value })} />
        </Field>
      </div>
    ),
    "partner-returned": (
      <div className="grid">
        <Field label={t("opsAcc.pdc.returnedOn")} col="col-12 md:col-4" required error={errors.returnedOn}>
          <DateField id="pdc-returned-on" value={form.returnedOn} max={todayIso()} onChange={(e) => set({ returnedOn: e.target.value })} />
        </Field>
        <Field label={t("opsAcc.pdc.partnerReference")} col="col-12 md:col-8">
          <InputText value={form.partnerReference} maxLength={60} onChange={(e) => set({ partnerReference: e.target.value })} className="w-full" />
        </Field>
      </div>
    ),
    return: (
      <div className="grid">
        <Field label={t("opsAcc.pdc.returnedOn")} col="col-12 md:col-4" required error={errors.returnedOn}>
          <DateField id="pdc-return-on" value={form.returnedOn} max={todayIso()} onChange={(e) => set({ returnedOn: e.target.value })} />
        </Field>
        <Field label={t("opsAcc.pdc.returnedTo")} col="col-12 md:col-8">
          <InputText value={form.returnedTo} maxLength={120} onChange={(e) => set({ returnedTo: e.target.value })} className="w-full" />
        </Field>
        <Field label={t("opsAcc.pdc.returnReason")} col="col-12" required error={errors.reason}>
          <InputTextarea value={form.reason} rows={2} maxLength={500} onChange={(e) => set({ reason: e.target.value })} className="w-full" />
        </Field>
      </div>
    ),
    replace: <div className="grid">{chequeFields(true)}</div>,
    edit: (
      <div className="grid">
        {chequeFields(one?.status === "on-hand")}
        <Field label={t("opsAcc.pdc.vaultFolder")} col="col-12 md:col-6">
          <InputText value={form.storageLocation} maxLength={60} onChange={(e) => set({ storageLocation: e.target.value })} className="w-full" />
        </Field>
        <Field label={t("opsAcc.remarks")} col="col-12 md:col-6"><InputText value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></Field>
      </div>
    ),
  };

  return (
    <Dialog className="pe-dialog" visible={!!kind} style={{ width: kind === "forward" || cheques.length > 1 ? "min(880px, 96vw)" : "min(720px, 96vw)" }} onHide={onHide}
      header={t(`opsAcc.pdc.actions.${kind}.title`, { number: one?.pdcNumber, transmittal: action.transmittal?.transmittalNumber || one?.transmittalNumber })}
      footer={(
        <div>
          <Button label={t("opsAcc.cancel")} text onClick={onHide} />
          <Button label={confirmLabel} icon="pi pi-check" severity={["partner-bounced", "bounce"].includes(kind) ? "danger" : undefined} loading={busy} onClick={submit} />
        </div>
      )}>
      {facts}
      {body[kind]}
      {errors.form ? <small className="p-error block mt-2" role="alert">{errors.form}</small> : null}
    </Dialog>
  );
};

ActionDialog.propTypes = {
  action: PropTypes.shape({ kind: PropTypes.string, cheques: PropTypes.arrayOf(PropTypes.object), transmittal: PropTypes.object }),
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  banks: PropTypes.arrayOf(PropTypes.object).isRequired,
  depositAccount: PropTypes.string,
  pullOuts: PropTypes.arrayOf(PropTypes.object),
};

ActionDialog.defaultProps = { action: null, depositAccount: null, pullOuts: [] };

export default ActionDialog;
