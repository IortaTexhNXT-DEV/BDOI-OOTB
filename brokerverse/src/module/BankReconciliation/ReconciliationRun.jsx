import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import bankReconciliationService from "../../services/bankReconciliationService";
import { BrTag, PageHeader, date, dateTime, money, periodLabel, showError, showSuccess } from "./common";
import { hasPermission } from "../../utils/canOpen";

const Line = ({ label, value, sign, indent, strong, total }) => (
  <tr className={total ? "br-brs-total" : strong ? "pe-subtotal" : ""}>
    <td className={indent ? "pe-indent" : ""}>{label}</td>
    <td className="num">{sign && Number(value) ? `${sign} ` : ""}{money(value ?? 0)}</td>
  </tr>
);

const BookItems = ({ rows, t }) => (
  <DataTable value={rows} size="small" stripedRows emptyMessage={t("bankReconciliation.none")}>
    <Column header={t("bankReconciliation.date")} body={(r) => date(r.date)} />
    <Column field="journalNumber" header={t("bankReconciliation.journal")} />
    <Column header={t("bankReconciliation.document")} body={(r) => `${r.documentType || ""} ${r.documentNumber || ""}`} />
    <Column header={t("bankReconciliation.chequeRef")} body={(r) => r.chequeNumber || r.reference || ""} />
    <Column field="party" header={t("bankReconciliation.payeePayer")} />
    <Column header={t("bankReconciliation.amount")} body={(r) => money(Math.abs(r.amount))} className="bv-num" headerClassName="bv-num" />
  </DataTable>
);
const BankItems = ({ rows, t }) => (
  <DataTable value={rows} size="small" stripedRows emptyMessage={t("bankReconciliation.none")}>
    <Column header={t("bankReconciliation.date")} body={(r) => date(r.date || r.clearedDate)} />
    <Column header={t("bankReconciliation.statement")} body={(r) => r.statementNumber || r.matchId || ""} />
    <Column header={t("bankReconciliation.description")} body={(r) => r.description || r.remarks || ""} />
    <Column field="reference" header={t("bankReconciliation.reference")} />
    <Column header={t("bankReconciliation.amount")} body={(r) => money(Math.abs(r.amount ?? r.difference))} className="bv-num" headerClassName="bv-num" />
  </DataTable>
);

/**
 * A bank reconciliation run: the Bank Reconciliation Statement (balance per bank + deposits in transit - outstanding
 * cheques +/- bank errors = balance per books + bank credits not booked - bank charges not booked +/- book errors),
 * the reconciling items, prepare / approve / reopen (maker-checker) and the printable PDF.
 */
const ReconciliationRun = () => {
  const { t } = useTranslation();
  // Approve / reopen are the approver's (approve:bank-reconciliation); the server refuses them to anyone else
  const canApprove = hasPermission("approve:bank-reconciliation");
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [rec, setRec] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setRec(await bankReconciliationService.reconciliation(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (name, fn, message) => {
    setBusy(name);
    try {
      const r = await fn();
      if (r && r.statement) setRec(r); else await load();
      setDialog(null);
      setRemarks("");
      if (message) showSuccess(toast, message);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };
  const print = async () => {
    setBusy("pdf");
    try {
      window.open(await bankReconciliationService.pdfUrl(rec.id), "_blank");
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  if (!rec) return <div className="pe-page"><Toast ref={toast} /></div>;
  const s = rec.statement || {};
  const items = s.items || {};
  const agree = Number(s.difference) === 0;
  const confirm = () => {
    if (dialog === "prepare") return act("prepare", () => bankReconciliationService.prepare(rec.id, remarks), t("bankReconciliation.prepared"));
    if (dialog === "approve") return act("approve", () => bankReconciliationService.approve(rec.id, remarks), t("bankReconciliation.approvedMsg"));
    if (dialog === "reopen") return act("reopen", () => bankReconciliationService.reopen(rec.id, remarks), t("bankReconciliation.reopened"));
    if (dialog === "cancel") return act("cancel", () => bankReconciliationService.cancel(rec.id, remarks).then(() => navigate("/accounts/bank-reconciliation/reconciliations")));
    return null;
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("bankReconciliation.statementTitle")} · ${rec.bankAccount}`} trail={[t("bankReconciliation.reconciliations"), rec.recNumber]}
        subtitle={`${rec.recNumber} · ${periodLabel(rec.period)} · ${t("bankReconciliation.asOf")} ${date(rec.asOfDate)} · GL ${rec.glAccountCode}`}>
        <Button icon="pi pi-arrow-left" text label={t("bankReconciliation.back")} onClick={() => navigate("/accounts/bank-reconciliation/reconciliations")} />
        <Button icon="pi pi-th-large" outlined label={t("bankReconciliation.workspace")} onClick={() => navigate(`/accounts/bank-reconciliation?account=${encodeURIComponent(rec.bankAccount)}&period=${rec.period}`)} />
        {rec.status === "draft" && <Button icon="pi pi-refresh" outlined label={t("bankReconciliation.refresh")} loading={busy === "refresh"} onClick={() => act("refresh", load)} />}
        {rec.status === "draft" && <Button icon="pi pi-send" label={t("bankReconciliation.prepare")} disabled={!agree} onClick={() => setDialog("prepare")} />}
        {canApprove && rec.status === "prepared" && <Button icon="pi pi-check" label={t("bankReconciliation.approve")} onClick={() => setDialog("approve")} />}
        {canApprove && ["prepared", "approved"].includes(rec.status) && <Button icon="pi pi-undo" severity="warning" outlined label={t("bankReconciliation.reopen")} onClick={() => setDialog("reopen")} />}
        <Button icon="pi pi-print" outlined label={t("bankReconciliation.printPdf")} loading={busy === "pdf"} onClick={print} />
        {rec.status === "draft" && <Button icon="pi pi-ban" text severity="secondary" label={t("bankReconciliation.cancelRun")} onClick={() => setDialog("cancel")} />}
      </PageHeader>

      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.status.label")}</div><div className="pe-kpi-value"><BrTag status={rec.status} /></div>
          <div className="pe-muted">{rec.status === "draft" ? t("bankReconciliation.liveFigures") : t("bankReconciliation.frozenFigures")}</div></div>
        <div className={`pe-kpi ${agree ? "br-kpi-diff-ok" : "br-kpi-diff-bad"}`}><div className="pe-kpi-label">{t("bankReconciliation.difference")}</div><div className="pe-kpi-value">{money(s.difference)}</div>
          <div className="pe-muted">{agree ? t("bankReconciliation.balancesAgree") : t("bankReconciliation.balancesDiffer")}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.unmatched")}</div><div className="pe-kpi-value">{s.unmatchedBankLines ?? 0} / {s.unmatchedBookLines ?? 0}</div>
          <div className="pe-muted">{t("bankReconciliation.bankSlashBook")}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.preparedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{rec.preparedByName || "-"}</div><div className="pe-muted">{dateTime(rec.preparedAt)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.approvedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{rec.approvedByName || "-"}</div><div className="pe-muted">{dateTime(rec.approvedAt)}</div></div>
      </div>
      {s.noStatement && <div className="br-notice br-notice-bad mt-3">{t("bankReconciliation.noStatementHelp")}</div>}
      {rec.reopenRemarks && rec.status === "draft" && <div className="br-notice mt-3"><b>{t("bankReconciliation.reopenedBy", { name: rec.reopenedByName || "" })}</b> {rec.reopenRemarks}</div>}

      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("bankReconciliation.statementTitle")}</span>
          <span className="pe-muted">{s.bankName || ""} {s.accountNumber ? `· ${s.accountNumber}` : ""} {s.statement ? `· ${s.statement.statementNumber}${s.statement.statementRef ? ` (${s.statement.statementRef})` : ""}` : ""}</span>
        </div>
        <div className="grid">
          <div className="col-12 lg:col-6">
            <table className="pe-statement br-brs">
              <thead><tr><th>{t("bankReconciliation.bankSide")}</th><th className="num">PHP</th></tr></thead>
              <tbody>
                <Line label={t("bankReconciliation.balancePerBank")} value={s.bankBalance} strong />
                <Line label={t("bankReconciliation.addDit")} value={s.depositsInTransit} sign="+" indent />
                <Line label={t("bankReconciliation.lessOc")} value={s.outstandingCheques} sign="−" indent />
                <Line label={t("bankReconciliation.bankErrors")} value={s.bankErrors} indent />
                <Line label={t("bankReconciliation.adjustedBankBalance")} value={s.adjustedBankBalance} total />
              </tbody>
            </table>
          </div>
          <div className="col-12 lg:col-6">
            <table className="pe-statement br-brs">
              <thead><tr><th>{t("bankReconciliation.bookSide")}</th><th className="num">PHP</th></tr></thead>
              <tbody>
                <Line label={t("bankReconciliation.balancePerBooks")} value={s.bookBalance} strong />
                <Line label={t("bankReconciliation.addUnbookedCredits")} value={s.unbookedCredits} sign="+" indent />
                <Line label={t("bankReconciliation.lessUnbookedDebits")} value={s.unbookedDebits} sign="−" indent />
                <Line label={t("bankReconciliation.bookErrors")} value={s.bookErrors} indent />
                <Line label={t("bankReconciliation.adjustedBookBalance")} value={s.adjustedBookBalance} total />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("bankReconciliation.reconcilingItems")}</div>
        <TabView>
          <TabPanel header={`${t("bankReconciliation.depositsInTransit")} (${items.depositsInTransit?.length || 0})`}><BookItems rows={items.depositsInTransit} t={t} /></TabPanel>
          <TabPanel header={`${t("bankReconciliation.outstandingCheques")} (${items.outstandingCheques?.length || 0})`}><BookItems rows={items.outstandingCheques} t={t} /></TabPanel>
          <TabPanel header={`${t("bankReconciliation.unbookedCredits")} (${items.unbookedCredits?.length || 0})`}><BankItems rows={items.unbookedCredits} t={t} /></TabPanel>
          <TabPanel header={`${t("bankReconciliation.unbookedDebits")} (${items.unbookedDebits?.length || 0})`}><BankItems rows={items.unbookedDebits} t={t} /></TabPanel>
          <TabPanel header={`${t("bankReconciliation.bankErrors")} (${items.bankErrors?.length || 0})`}><BankItems rows={items.bankErrors} t={t} /></TabPanel>
          <TabPanel header={`${t("bankReconciliation.bookErrors")} (${items.bookErrors?.length || 0})`}><BankItems rows={items.bookErrors} t={t} /></TabPanel>
        </TabView>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("bankReconciliation.history")}</div>
        <DataTable value={rec.history} size="small" emptyMessage={t("bankReconciliation.none")}>
          <Column header={t("bankReconciliation.when")} body={(r) => dateTime(r.changedAt)} />
          <Column header={t("bankReconciliation.from")} body={(r) => (r.from ? <BrTag status={r.from} /> : "-")} />
          <Column header={t("bankReconciliation.to")} body={(r) => <BrTag status={r.to} />} />
          <Column field="changedBy" header={t("bankReconciliation.by")} />
          <Column field="remarks" header={t("bankReconciliation.remarks")} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" visible={!!dialog} style={{ width: "min(520px, 95vw)" }} onHide={() => setDialog(null)}
        header={dialog ? t(`bankReconciliation.dialog.${dialog}`) : ""}
        footer={(
          <div>
            <Button label={t("bankReconciliation.cancel")} text onClick={() => setDialog(null)} />
            <Button label={t("bankReconciliation.confirm")} icon="pi pi-check" loading={!!busy} onClick={confirm} disabled={dialog === "reopen" && !remarks.trim()} />
          </div>
        )}>
        {dialog && (
          <div>
            <p className="pe-muted mt-0">{t(`bankReconciliation.dialogHelp.${dialog}`)}</p>
            <label htmlFor="br-run-remarks">{t("bankReconciliation.remarks")}{dialog === "reopen" ? " *" : ""}</label>
            <InputTextarea id="br-run-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full" autoResize />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ReconciliationRun;
