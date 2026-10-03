import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { JournalDialog, JournalLink, PageHeader, StatusTag, date, dateTime, money, showError, showSuccess } from "./common";
import LinesEditor, { emptyLines } from "./LinesEditor";
import { hasPermission } from "../../utils/canOpen";

/**
 * Accounts > Period End > Year-End Close: pre-checks (twelve periods closed, adjustment period posted), closing entries
 * (income and expense to current year P/L, then to retained earnings) in adjustment period 13, opening balances of the
 * next fiscal year, lock of the year; reversible by a finance manager until the next year's first period is closed.
 */
const YearEndClose = () => {
  const { t } = useTranslation();
  // Approving, rejecting, reopening and year-end close / reverse need approve:period-end (the server refuses them otherwise)
  const canApprove = hasPermission("approve:period-end");
  const toast = useRef(null);
  const [years, setYears] = useState([]);
  const [selected, setSelected] = useState(null);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(null);
  const [journal, setJournal] = useState(null);
  const [reverse, setReverse] = useState(null);
  const [adjustment, setAdjustment] = useState(null);

  const loadYears = useCallback(async () => {
    try {
      const list = await periodEndService.yearEnd();
      setYears(list);
      setSelected((s) => s || (list.find((y) => y.status === "closing") || list.slice().reverse().find((y) => y.status !== "closed") || list[0])?.code);
      return list;
    } catch (e) {
      showError(toast, e);
      return [];
    }
  }, []);
  useEffect(() => { loadYears(); }, [loadYears]);
  const fy = years.find((y) => y.code === selected);
  const latest = fy?.runs?.find((r) => r.status !== "cancelled") || null;
  useEffect(() => {
    setRun(null);
    if (latest?.id) periodEndService.yearEndRun(latest.id).then(setRun).catch((e) => showError(toast, e));
  }, [latest?.id]);

  const act = async (name, fn, message) => {
    setBusy(name);
    try {
      const r = await fn();
      if (r?.id) setRun(await periodEndService.yearEndRun(r.id));
      await loadYears();
      if (message) showSuccess(toast, message);
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveAdjustment = async () => {
    const r = await act("adjust", () => periodEndService.createAdjustment({ fiscalYear: selected, description: adjustment.description,
      lines: adjustment.lines.filter((l) => l.accountCode).map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit || 0), credit: Number(l.credit || 0), memo: l.memo || undefined })) }),
    t("periodEnd.adjustmentCreated"));
    if (r) setAdjustment(null);
  };

  const checks = run?.checks?.length ? run.checks : [];
  const status = run?.status;
  const profit = Number(run?.netIncome || 0);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.yearEndClose")} trail={[t("periodEnd.yearEndClose")]}>
        <Dropdown value={selected} options={years.map((y) => ({ label: `${y.code} (${t(`periodEnd.status.${y.status}`)})`, value: y.code }))} onChange={(e) => setSelected(e.value)} style={{ minWidth: 220 }} />
        {fy && fy.status !== "closed" && (!latest || ["reversed", "cancelled"].includes(latest.status)) && (
          <Button icon="pi pi-play" label={t("periodEnd.startYearEnd")} loading={busy === "create"} onClick={() => act("create", () => periodEndService.createYearEnd(selected), t("periodEnd.yearEndStarted"))} />
        )}
        {fy && fy.status !== "closed" && (
          <Button icon="pi pi-plus" outlined label={t("periodEnd.adjustmentJournal")} onClick={() => setAdjustment({ description: "", lines: emptyLines() })} />
        )}
      </PageHeader>

      {fy && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.fiscalYear")}</div><div className="pe-kpi-value">{fy.code}</div><div className="pe-muted">{date(fy.startDate)} – {date(fy.endDate)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.yearStatus")}</div><div className="pe-kpi-value"><StatusTag status={fy.status} /></div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.yearEndRun")}</div><div className="pe-kpi-value" style={{ fontSize: "1.05rem" }}>{run?.runNumber || "-"}</div><div>{run && <StatusTag status={run.status} />}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{profit >= 0 ? t("periodEnd.netIncome") : t("periodEnd.netLoss")}</div><div className="pe-kpi-value">{run?.netIncome === null || run?.netIncome === undefined ? "-" : money(Math.abs(profit))}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.nextFiscalYear")}</div><div className="pe-kpi-value">{run?.nextFiscalYear || "-"}</div><div className="pe-muted">{run?.openingAccounts ? `${run.openingAccounts} ${t("periodEnd.openingAccounts")}` : ""}</div></div>
        </div>
      )}

      {run && (
        <div className="pe-card">
          <div className="pe-card-title">
            <span>{t("periodEnd.preChecks")}</span>
            <span className="flex gap-2 flex-wrap">
              {["draft", "checked"].includes(status) && <Button icon="pi pi-check-square" outlined label={t("periodEnd.runChecks")} loading={busy === "check"} onClick={() => act("check", () => periodEndService.checkYearEnd(run.id))} />}
              {canApprove && ["draft", "checked"].includes(status) && <Button icon="pi pi-lock" severity="danger" label={t("periodEnd.closeYear")} loading={busy === "close"} onClick={() => act("close", () => periodEndService.closeYearEnd(run.id), t("periodEnd.yearClosed"))} />}
              {canApprove && status === "closed" && <Button icon="pi pi-undo" severity="warning" outlined label={t("periodEnd.reverseClose")} onClick={() => setReverse({ reason: "" })} />}
              {["draft", "checked"].includes(status) && <Button icon="pi pi-ban" text severity="secondary" label={t("periodEnd.cancelRun")} onClick={() => act("cancel", () => periodEndService.cancelYearEnd(run.id))} />}
            </span>
          </div>
          <DataTable value={checks} size="small" stripedRows emptyMessage={t("periodEnd.runChecksFirst")}>
            <Column field="label" header={t("periodEnd.item")} />
            <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} style={{ width: "8rem" }} />
            <Column field="message" header={t("periodEnd.result")} />
          </DataTable>
          {run.reverseReason && <p className="pe-muted mt-2">{t("periodEnd.reversedBecause")}: {run.reverseReason} ({dateTime(run.reversedAt)})</p>}
        </div>
      )}

      {run && run.journals?.length > 0 && (
        <div className="pe-card">
          <div className="pe-card-title">{t("periodEnd.closingEntries")}</div>
          <DataTable value={run.journals} size="small" stripedRows dataKey="journalId">
            <Column header={t("periodEnd.journal")} body={(r) => <JournalLink journal={r} onOpen={setJournal} />} />
            <Column header={t("periodEnd.date")} body={(r) => date(r.date)} />
            <Column field="period" header={t("periodEnd.period")} />
            <Column field="description" header={t("periodEnd.description")} />
            <Column header={t("periodEnd.amount")} body={(r) => money(r.amount)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
          </DataTable>
        </div>
      )}

      {run && (
        <div className="grid mt-1">
          <div className="col-12 lg:col-5">
            <div className="pe-card">
              <div className="pe-card-title">{t("periodEnd.periods")}</div>
              <DataTable value={run.periods} size="small" dataKey="period">
                <Column field="period" header={t("periodEnd.period")} />
                <Column header={t("periodEnd.end")} body={(r) => date(r.endDate)} />
                <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
              </DataTable>
            </div>
          </div>
          <div className="col-12 lg:col-7">
            <div className="pe-card">
              <div className="pe-card-title">{t("periodEnd.openingBalances")} {run.nextFiscalYear || ""}</div>
              <DataTable value={run.openingBalances} size="small" stripedRows paginator rows={20} emptyMessage={t("periodEnd.openingBalancesHelp")}>
                <Column field="accountCode" header={t("periodEnd.account")} />
                <Column field="accountName" header={t("periodEnd.accountName")} />
                <Column header={t("periodEnd.debit")} body={(r) => (r.balance > 0 ? money(r.balance) : "")} className="bv-num" headerClassName="bv-num" />
                <Column header={t("periodEnd.credit")} body={(r) => (r.balance < 0 ? money(-r.balance) : "")} className="bv-num" headerClassName="bv-num" />
              </DataTable>
            </div>
          </div>
        </div>
      )}

      <JournalDialog journal={journal} onHide={() => setJournal(null)} />

      <Dialog className="pe-dialog" header={t("periodEnd.reverseClose")} visible={!!reverse} style={{ width: "min(520px, 95vw)" }} onHide={() => setReverse(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setReverse(null)} />
            <Button label={t("periodEnd.confirm")} icon="pi pi-undo" severity="warning" disabled={!reverse?.reason?.trim()} loading={busy === "reverse"}
              onClick={async () => { const r = await act("reverse", () => periodEndService.reverseYearEnd(run.id, reverse.reason), t("periodEnd.yearReversed")); if (r) setReverse(null); }} />
          </div>
        )}>
        <p className="pe-muted">{t("periodEnd.reverseHelp")}</p>
        <label htmlFor="pe-rev-reason">{t("periodEnd.reason")} *</label>
        <InputTextarea id="pe-rev-reason" value={reverse?.reason || ""} onChange={(e) => setReverse({ reason: e.target.value })} rows={3} className="w-full" />
      </Dialog>

      <Dialog className="pe-dialog" header={`${t("periodEnd.adjustmentJournal")} ${selected || ""}`} visible={!!adjustment} style={{ width: "min(980px, 96vw)" }} onHide={() => setAdjustment(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setAdjustment(null)} />
            <Button label={t("periodEnd.save")} icon="pi pi-save" loading={busy === "adjust"} onClick={saveAdjustment} disabled={!adjustment?.description?.trim()} />
          </div>
        )}>
        {adjustment && (
          <div>
            <p className="pe-muted">{t("periodEnd.adjustmentHelp")}</p>
            <label htmlFor="pe-adj-desc">{t("periodEnd.description")} *</label>
            <InputText id="pe-adj-desc" value={adjustment.description} onChange={(e) => setAdjustment({ ...adjustment, description: e.target.value })} className="w-full mb-3" />
            <LinesEditor lines={adjustment.lines} onChange={(lines) => setAdjustment({ ...adjustment, lines })} />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default YearEndClose;
