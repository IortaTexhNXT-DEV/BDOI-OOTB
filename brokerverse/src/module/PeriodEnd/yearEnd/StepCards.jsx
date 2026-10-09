import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { canOpen } from "../../../utils/canOpen";
import { JournalLink, StatusTag, date, dateTime, money } from "../common";
import CheckList from "./CheckList";
import Facts from "./Facts";

const JV_DETAIL = "/accounts/journalvoucher/detailsjournalvocture";
const amount = (v) => (Number(v) ? money(v) : "");
const sumOf = (rows, key) => Math.round(rows.reduce((s, r) => s + Number(r[key] || 0), 0) * 100) / 100;

/** "Net income" or "Net loss" with the amount without its sign. */
export const netFact = (t, net) => ({
  label: Number(net) < 0 ? t("periodEnd.netLoss") : t("periodEnd.netIncome"),
  value: net === null || net === undefined ? null : money(Math.abs(Number(net))),
  numeric: true,
});

/** Why an action is not available, under its button. */
export const Reason = ({ text }) => (text ? <p className="ye-reason"><i className="pi pi-lock" aria-hidden="true" /> {text}</p> : null);

// amount columns, right-aligned in the body, the heading and the totals (DataTable reads the props of its Column children)
const NUM = { className: "bv-num", headerClassName: "bv-num", footerClassName: "bv-num" };

/** Step 1: the prerequisites of the close. */
export const PrerequisitesStep = ({ checks, onOpenYear }) => <CheckList checks={checks} onOpenYear={onOpenYear} />;

/** Step 2: adjustment period 13 and its journals (posted after approval by a second user). */
export const AdjustmentsStep = ({ data, checks, onOpenYear, onOpenJournal }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mayOpen = canOpen(JV_DETAIL);
  return (
    <>
      <CheckList checks={checks} onOpenYear={onOpenYear} />
      <h3 className="ye-subtitle">{t("yearEndClose.adjustments.title")}</h3>
      <DataTable value={data.adjustments} dataKey="journalId" size="small" stripedRows emptyMessage={t("yearEndClose.adjustments.empty")}>
        <Column header={t("periodEnd.journal")} body={(r) => <JournalLink journal={r} onOpen={onOpenJournal} />} />
        <Column header={t("periodEnd.date")} body={(r) => date(r.date)} />
        <Column field="description" header={t("periodEnd.description")} />
        <Column header={t("yearEndClose.adjustments.preparedBy")} body={(r) => r.createdByName || "-"} />
        <Column {...NUM} header={t("periodEnd.amount")} body={(r) => money(r.amount)} />
        <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
        {mayOpen && (
          <Column header="" style={{ width: "3.5rem" }} body={(r) => (
            <Button type="button" icon="pi pi-external-link" text rounded aria-label={t("yearEndClose.adjustments.open")} tooltip={t("yearEndClose.adjustments.open")}
              tooltipOptions={{ position: "top" }} onClick={() => navigate(`${JV_DETAIL}/${r.journalId}`)} />
          )} />
        )}
      </DataTable>
    </>
  );
};

/** Step 3: the closing entries, previewed from the year-end balances until the close, then as posted. */
export const ClosingStep = ({ data, onOpenJournal }) => {
  const { t } = useTranslation();
  const c = data.closing;
  const net = Number(c.netIncome || 0);
  const result = c.currentYearPl && net ? [{ accountCode: c.currentYearPl.code, accountName: c.currentYearPl.name, accountType: "result", debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0 }] : [];
  const rows = [...c.lines, ...result];
  const transfer = Number(c.transfer || 0);
  const transferRows = transfer && c.currentYearPl && c.retainedEarnings ? [
    { accountCode: c.currentYearPl.code, accountName: c.currentYearPl.name, debit: transfer < 0 ? -transfer : 0, credit: transfer > 0 ? transfer : 0 },
    { accountCode: c.retainedEarnings.code, accountName: c.retainedEarnings.name, debit: transfer > 0 ? transfer : 0, credit: transfer < 0 ? -transfer : 0 },
  ] : [];
  const type = (r) => (r.accountType === "result" ? t("yearEndClose.closing.netToCurrentYear") : t(`yearEndClose.accountType.${r.accountType}`, { defaultValue: r.accountType }));
  return (
    <>
      <Facts items={[
        { label: t("periodEnd.period"), value: c.period },
        { label: t("yearEndClose.closing.journalDate"), value: date(c.date) },
        { label: t("yearEndClose.closing.totalIncome"), value: money(c.totalIncome), numeric: true },
        { label: t("yearEndClose.closing.totalExpense"), value: money(c.totalExpense), numeric: true },
        netFact(t, c.netIncome),
      ]} />
      {c.journals.length > 0 && (
        <div className="ye-journals">
          <span className="ye-journals__label">{t("yearEndClose.closing.journals")}</span>
          {c.journals.map((j) => (
            <span key={j.journalId} className="ye-journals__item"><JournalLink journal={j} onOpen={onOpenJournal} /> <StatusTag status={j.status} /></span>
          ))}
        </div>
      )}
      <h3 className="ye-subtitle">{t("yearEndClose.closing.toCurrentYear")}</h3>
      <DataTable value={rows} dataKey="accountCode" size="small" stripedRows emptyMessage={t("yearEndClose.closing.empty")}
        rowClassName={(r) => (r.accountType === "result" ? "ye-row-total" : "")}>
        <Column field="accountCode" header={t("periodEnd.account")} style={{ width: "8rem" }} footer={t("yearEndClose.total")} />
        <Column field="accountName" header={t("periodEnd.accountName")} />
        <Column header={t("yearEndClose.accountTypeLabel")} body={type} />
        <Column {...NUM} header={t("periodEnd.debit")} body={(r) => amount(r.debit)} footer={money(sumOf(rows, "debit"))} />
        <Column {...NUM} header={t("periodEnd.credit")} body={(r) => amount(r.credit)} footer={money(sumOf(rows, "credit"))} />
      </DataTable>
      {transferRows.length > 0 && (
        <>
          <h3 className="ye-subtitle">{t("yearEndClose.closing.toRetainedEarnings")}</h3>
          <DataTable value={transferRows} dataKey="accountCode" size="small">
            <Column field="accountCode" header={t("periodEnd.account")} style={{ width: "8rem" }} />
            <Column field="accountName" header={t("periodEnd.accountName")} />
            <Column {...NUM} header={t("periodEnd.debit")} body={(r) => amount(r.debit)} />
            <Column {...NUM} header={t("periodEnd.credit")} body={(r) => amount(r.credit)} />
          </DataTable>
        </>
      )}
    </>
  );
};

const REASON_KEYS = {
  close: { permission: "closePermission", "maker-checker": "closeMaker", checks: "closeChecks" },
  requestReversal: { "next-period": "nextPeriod", "next-year": "nextYear" },
  approveReversal: { permission: "reversePermission", "maker-checker": "reverseMaker" },
};
/** The text of a refused action (null when allowed, or when the user should not see the action at all). */
export const reasonText = (t, name, action, values = {}) => {
  const key = action && !action.allowed ? REASON_KEYS[name]?.[action.reason] : null;
  return key ? t(`yearEndClose.reason.${key}`, values) : null;
};

/** Step 4: the close by an Accounting Manager other than the preparer, then the reversal of the close. */
export const ApprovalStep = ({ data, busy, onClose, onRequestReversal, onApproveReversal, onWithdrawReversal }) => {
  const { t } = useTranslation();
  const { run, actions } = data;
  const closed = run.status === "closed";
  const request = run.reverseRequest;
  const nextYear = data.nextYear?.code;
  const prepared = { label: t("yearEndClose.approval.preparedBy"), value: run.preparedByName ? `${run.preparedByName}, ${dateTime(run.preparedAt)}` : dateTime(run.preparedAt) };
  if (!closed) {
    const checksOk = !data.steps.some((s) => ["prerequisites", "adjustments"].includes(s.key) && s.status !== "passed");
    return (
      <>
        <Facts items={[
          prepared,
          { label: t("yearEndClose.approval.approver"), value: t("yearEndClose.approval.accountingManager") },
          { label: t("yearEndClose.approval.checks"), value: <StatusTag status={checksOk ? "passed" : "failed"} /> },
          netFact(t, data.closing?.netIncome),
          { label: t("periodEnd.nextFiscalYear"), value: nextYear },
        ]} />
        {actions.close && (
          <div className="ye-actions">
            <Button type="button" icon="pi pi-lock" label={t("yearEndClose.approval.close")} disabled={!actions.close.allowed} loading={busy === "close"} onClick={onClose} />
            <Reason text={reasonText(t, "close", actions.close)} />
          </div>
        )}
      </>
    );
  }
  return (
    <>
      <Facts items={[
        prepared,
        { label: t("yearEndClose.approval.closedBy"), value: run.closedByName ? `${run.closedByName}, ${dateTime(run.closedAt)}` : dateTime(run.closedAt) },
        { label: t("yearEndClose.approval.remark"), value: run.remarks },
        netFact(t, run.netIncome),
        { label: t("periodEnd.nextFiscalYear"), value: run.nextFiscalYear },
      ]} />
      {request && (
        <section className="ye-request" aria-label={t("yearEndClose.reversal.pending")}>
          <div className="ye-request__head">
            <span className="ye-request__title">{t("yearEndClose.reversal.pending")}</span>
            <StatusTag status="pending-approval" />
          </div>
          <Facts items={[
            { label: t("yearEndClose.reversal.requestedBy"), value: request.byName ? `${request.byName}, ${dateTime(request.at)}` : dateTime(request.at) },
            { label: t("yearEndClose.reversal.reason"), value: request.reason },
          ]} />
          <div className="ye-actions">
            {actions.approveReversal && (
              <Button type="button" icon="pi pi-undo" severity="warning" label={t("yearEndClose.reversal.approve")} disabled={!actions.approveReversal.allowed}
                loading={busy === "reverse"} onClick={onApproveReversal} />
            )}
            {actions.withdrawReversal?.allowed && (
              <Button type="button" text severity="secondary" label={t("yearEndClose.reversal.withdraw")} loading={busy === "withdraw"} onClick={onWithdrawReversal} />
            )}
            <Reason text={reasonText(t, "approveReversal", actions.approveReversal)} />
          </div>
        </section>
      )}
      {actions.requestReversal && actions.requestReversal.reason !== "permission" && (
        <div className="ye-actions">
          <Button type="button" icon="pi pi-undo" outlined severity="warning" label={t("yearEndClose.reversal.request")} disabled={!actions.requestReversal.allowed} onClick={onRequestReversal} />
          <Reason text={reasonText(t, "requestReversal", actions.requestReversal, { fiscalYear: nextYear, period: actions.requestReversal.period })} />
        </div>
      )}
    </>
  );
};

/** Step 5: the balance-sheet balances carried into the next fiscal year (a preview until the close). */
export const OpeningStep = ({ data }) => {
  const { t } = useTranslation();
  const o = data.opening;
  return (
    <>
      <Facts items={[
        { label: t("periodEnd.fiscalYear"), value: o.fiscalYear },
        { label: t("yearEndClose.opening.accounts"), value: String(o.lines.length) },
        { label: t("yearEndClose.opening.totalDebit"), value: money(o.totalDebit), numeric: true },
        { label: t("yearEndClose.opening.totalCredit"), value: money(o.totalCredit), numeric: true },
      ]} />
      <DataTable value={o.lines} dataKey="accountCode" size="small" stripedRows paginator={o.lines.length > 20} rows={20} emptyMessage={t("yearEndClose.opening.empty")}>
        <Column field="accountCode" header={t("periodEnd.account")} style={{ width: "8rem" }} footer={t("yearEndClose.total")} />
        <Column field="accountName" header={t("periodEnd.accountName")} />
        <Column header={t("yearEndClose.accountTypeLabel")} body={(r) => t(`yearEndClose.accountType.${r.accountType}`, { defaultValue: r.accountType })} />
        <Column {...NUM} header={t("periodEnd.debit")} body={(r) => amount(r.debit)} footer={money(o.totalDebit)} />
        <Column {...NUM} header={t("periodEnd.credit")} body={(r) => amount(r.credit)} footer={money(o.totalCredit)} />
      </DataTable>
    </>
  );
};
