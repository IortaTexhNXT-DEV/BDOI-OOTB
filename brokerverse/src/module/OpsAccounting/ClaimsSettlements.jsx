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
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import StatCards from "../../components/StatCards";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";
import { StatusChip } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import claimHandlingService from "../../services/claimHandlingService";
import { hasPermission } from "../../utils/canOpen";

const STAGES = ["outstanding", "awaiting-funds", "to-pay", "completed", "all"];

/**
 * Accounts > Claims Settlements: claims settled through the broker. Funds received from each insurer (Dr bank / Cr
 * claims receivable; write:claim-funds) and the payment to the claimant (Dr claims payable / Cr bank; write:disbursements,
 * out of the funds received when claims.pay_claimant_from_funds is on) with its claim payment voucher, the reversal of a
 * movement recorded in error (reverse:claim-cash, another user, coded reason) and the release form the claimant signs.
 */
const ClaimsSettlements = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [stage, setStage] = useState("outstanding");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null); // cash position of one claim
  const [entry, setEntry] = useState(null); // { kind, amount, bankAccount, date, reference, insurerId, paymentMode, payee }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.claimSettlements({ status: stage, search: search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [stage, search]);
  useEffect(() => { load(); }, [load]);

  const view = async (claimId) => {
    try {
      setOpen(await service.claimSettlement(claimId));
    } catch (e) {
      showError(toast, e);
    }
  };
  const record = async () => {
    try {
      const payload = { amount: entry.amount, bankAccount: entry.bankAccount, date: isoOf(entry.date), reference: entry.reference || null,
        ...(entry.kind === "funds" ? { insurerId: entry.insurerId } : { paymentMode: entry.paymentMode, payee: entry.payee || null }) };
      const r = entry.kind === "funds" ? await service.claimFundsReceived(open.claimId, payload) : await service.claimPay(open.claimId, payload);
      showSuccess(toast, entry.kind === "funds" ? t("opsAcc.claimPay.fundsDone", { journal: r.journalNumber }) : t("opsAcc.claimPay.paidDone", { voucher: r.voucherNumber }));
      setEntry(null);
      setOpen(r.position);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const firstOwed = open?.insurers.find((i) => i.outstanding > 0);
  const payable = open ? open.payableNow ?? open.payableToClaimant : 0;
  const reverse = (m) => openConfirm({
    title: t("claimCash.reverse"), severity: "danger", message: t("claimCash.reverseMessage"),
    facts: [{ label: t("opsAcc.claimPay.movement"), value: t(`opsAcc.claimPay.kind.${m.kind}`) }, { label: t("opsAcc.amount"), value: m.amount, type: "amount" },
      { label: t("opsAcc.journal"), value: m.journalNumber || "-" }, { label: t("claimCash.recordedBy"), value: m.createdBy || "-" }],
    reason: { context: "claim_cash_reversal" }, confirmLabel: t("claimCash.reverseConfirm"),
    onConfirm: async (reason) => {
      const r = await claimHandlingService.reverseMovement(open.claimId, m.id, reason);
      showSuccess(toast, t("claimCash.reversedDone", { journal: r.journalNumber || "-" }));
      setOpen(r.position);
      load();
    },
  });

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.claimPay.title")} />
      <StatCards className="mb-3" items={[
        { key: "toReceive", label: t("opsAcc.claimPay.toReceive"), value: data ? money(data.summary.toReceive) : null },
        { key: "held", label: t("opsAcc.claimPay.held"), value: data ? money(data.summary.heldForClaimant) : null },
        { key: "payable", label: t("opsAcc.claimPay.payable"), value: data ? money(data.summary.payableToClaimant) : null },
      ]} />
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={stage} options={STAGES.map((s) => ({ label: t(`opsAcc.status.${s}`), value: s }))} onChange={(e) => setStage(e.value)} className="w-12rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.claimSearch")} className="w-20rem" />
        </div>
        <DataTable value={data?.rows || []} dataKey="claimId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")} rowHover onRowClick={(e) => view(e.data.claimId)}>
          <Column field="claimNumber" header={t("opsAcc.claim")} />
          <Column field="policyNumber" header={t("opsAcc.policy")} />
          <Column field="claimant" header={t("opsAcc.claimPay.claimant")} />
          <Column field="insurers" header={t("opsAcc.insurer")} />
          <Column header={t("opsAcc.claimPay.settlement")} body={(r) => money(r.settlementAmount)} {...numericColumn} />
          <Column header={t("opsAcc.claimPay.received")} body={(r) => money(r.totalReceived)} {...numericColumn} />
          <Column header={t("opsAcc.claimPay.paid")} body={(r) => money(r.paidToClaimant)} {...numericColumn} />
          <Column header={t("opsAcc.claimPay.payable")} body={(r) => money(r.payableToClaimant)} {...numericColumn} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.stage} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={open ? `${open.claimNumber} · ${open.policyNumber}` : ""} visible={!!open} style={{ width: "min(960px, 96vw)" }} onHide={() => setOpen(null)}>
        {open && (
          <>
            <div className="flex gap-2 mb-3">
              <Button label={t("opsAcc.claimPay.fundsReceived")} icon="pi pi-download" disabled={!open.canRecord || !firstOwed || !hasPermission("write:claim-funds")}
                onClick={() => setEntry({ kind: "funds", amount: firstOwed?.outstanding, insurerId: firstOwed?.insurerId, bankAccount: open.bankAccounts[0]?.code, date: new Date(), reference: "" })} />
              <Button label={t("opsAcc.claimPay.payClaimant")} icon="pi pi-upload" outlined disabled={!open.canRecord || payable <= 0 || !hasPermission("write:disbursements")}
                onClick={() => setEntry({ kind: "pay", amount: payable, bankAccount: open.bankAccounts[0]?.code, date: new Date(), reference: "", paymentMode: "check", payee: open.claimant })} />
              <Button label={t("opsAcc.claimPay.releaseForm")} icon="pi pi-print" outlined onClick={() => service.claimReleaseForm(open.claimId).catch((e) => showError(toast, e))} />
            </div>
            {open.payFromFunds && open.payableToClaimant > 0 ? <p className="mb-2">{t("claimCash.payableNow", { amount: money(Math.max(0, payable)) })}</p> : null}
            <DataTable value={open.insurers} dataKey="insurerId" size="small" className="mb-3">
              <Column field="insurer" header={t("opsAcc.insurer")} />
              <Column header={t("opsAcc.claimPay.share")} body={(r) => `${r.share}%`} {...numericColumn} />
              <Column header={t("opsAcc.claimPay.recoverable")} body={(r) => money(r.recoverable)} {...numericColumn} />
              <Column header={t("opsAcc.claimPay.received")} body={(r) => money(r.received)} {...numericColumn} />
              <Column header={t("opsAcc.claimPay.outstanding")} body={(r) => money(r.outstanding)} {...numericColumn} />
            </DataTable>
            <DataTable value={open.movements} dataKey="id" size="small" stripedRows emptyMessage={t("opsAcc.none")}>
              <Column header={t("opsAcc.date")} body={(r) => date(r.date)} />
              <Column header={t("opsAcc.claimPay.movement")} body={(r) => t(`opsAcc.claimPay.kind.${r.kind}`)} />
              <Column body={(r) => r.insurer || r.payee} header={t("opsAcc.claimPay.party")} />
              <Column field="voucherNumber" header={t("opsAcc.claimPay.voucher")} />
              <Column field="reference" header={t("opsAcc.reference")} />
              <Column field="journalNumber" header={t("opsAcc.journal")} />
              <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
              <Column header={t("claimCash.status")} body={(r) => (r.reversed
                ? <span title={[r.reversedBy, r.reversalReason].filter(Boolean).join(" · ")}><StatusChip label={t("claimCash.reversedChip")} severity="secondary" /></span>
                : <StatusChip label={t("claimCash.recorded")} severity="success" />)} />
              <Column body={(r) => (
                <span className="flex gap-1">
                  {r.kind === "paid-to-claimant" ? <Button icon="pi pi-print" text size="small" aria-label={t("opsAcc.print")} tooltip={t("opsAcc.claimPay.printVoucher")}
                    onClick={() => service.claimVoucher(r.id).catch((e) => showError(toast, e))} /> : null}
                  {hasPermission("reverse:claim-cash") && !r.reversed ? <Button icon="pi pi-undo" text size="small" severity="danger" aria-label={t("claimCash.reverse")} tooltip={t("claimCash.reverse")}
                    onClick={() => reverse(r)} /> : null}
                </span>
              )} />
            </DataTable>
          </>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={entry?.kind === "funds" ? t("opsAcc.claimPay.fundsReceived") : t("opsAcc.claimPay.payClaimant")} visible={!!entry} style={{ width: "min(620px, 96vw)" }}
        onHide={() => setEntry(null)} footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setEntry(null)} /><Button label={t("opsAcc.save")} icon="pi pi-check" onClick={record} /></div>}>
        {entry && open && (
          <div className="grid">
            {entry.kind === "funds" && (
              <Field label={t("opsAcc.insurer")} col="col-12">
                <Dropdown value={entry.insurerId} options={open.insurers.map((i) => ({ label: `${i.insurer} (${money(i.outstanding)})`, value: i.insurerId }))} onChange={(e) => setEntry({ ...entry, insurerId: e.value })} className="w-full" />
              </Field>
            )}
            {entry.kind === "pay" && (
              <>
                <Field label={t("opsAcc.claimPay.payee")} col="col-12 md:col-8"><InputText value={entry.payee} onChange={(e) => setEntry({ ...entry, payee: e.target.value })} className="w-full" /></Field>
                <Field label={t("opsAcc.paymentMode")} col="col-12 md:col-4">
                  <Dropdown value={entry.paymentMode} options={["check", "bank-transfer", "cash"].map((m) => ({ label: t(`opsAcc.modes.${m}`), value: m }))} onChange={(e) => setEntry({ ...entry, paymentMode: e.value })} className="w-full" />
                </Field>
              </>
            )}
            <Field label={t("opsAcc.amount")} col="col-12 md:col-6"><InputNumber value={entry.amount} mode="decimal" minFractionDigits={2} onValueChange={(e) => setEntry({ ...entry, amount: e.value })} className="w-full" /></Field>
            <Field label={t("opsAcc.date")} col="col-12 md:col-6"><Calendar value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.value })} showIcon className="w-full" /></Field>
            <Field label={t("opsAcc.bankAccount")} col="col-12 md:col-6">
              <Dropdown value={entry.bankAccount} options={open.bankAccounts.map((b) => ({ label: `${b.code} ${b.name || ""}`, value: b.code }))} onChange={(e) => setEntry({ ...entry, bankAccount: e.value })} className="w-full" />
            </Field>
            <Field label={entry.kind === "funds" ? t("opsAcc.claimPay.advice") : t("opsAcc.claimPay.chequeRef")} col="col-12 md:col-6"><InputText value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} className="w-full" /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ClaimsSettlements;
