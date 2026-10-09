import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import bankReconciliationService from "../../services/bankReconciliationService";
import periodEndService from "../../services/periodEndService";
import { Amount, BrTag, JournalDialog, PageHeader, date, money, previousPeriod, recentPeriods, showError, showSuccess, sum } from "./common";
import ImportStatementDialog from "./ImportStatementDialog";
import AdjustmentDialog from "./AdjustmentDialog";
import StaleChequesDialog from "./StaleChequesDialog";
import { hasPermission } from "../../utils/canOpen";

const text = (s) => String(s || "").toLowerCase();

/**
 * Accounts > Bank Reconciliation: bank account + period, summary tiles, the two-pane matching workspace (bank statement
 * lines left, book entries right), automatic and manual matching, adjustments from bank lines, statement import and
 * the period's reconciliation.
 */
const Workspace = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(params.get("account") || null);
  const [period, setPeriod] = useState(params.get("period") || previousPeriod());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [bankFilter, setBankFilter] = useState("unmatched");
  const [bookFilter, setBookFilter] = useState("unmatched");
  const [bankSearch, setBankSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [bankSel, setBankSel] = useState([]);
  const [bookSel, setBookSel] = useState([]);
  const [types, setTypes] = useState([]);
  const [formats, setFormats] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [dialog, setDialog] = useState(null); // import | setup | adjust | flag | match | unmatch | stale
  const [form, setForm] = useState({});
  const [journal, setJournal] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const list = await bankReconciliationService.bankAccounts();
      setAccounts(list);
      setAccount((a) => a || list.find((x) => x.glAccountCode)?.code || list[0]?.code || null);
    } catch (e) {
      showError(toast, e);
    }
  }, []);
  useEffect(() => {
    loadAccounts();
    bankReconciliationService.transactionTypes().then((r) => setTypes(r.items.filter((x) => x.active))).catch(() => {});
    bankReconciliationService.formats().then((r) => setFormats(r.items.filter((x) => x.active))).catch(() => {});
    periodEndService.accounts().then((list) => setGlAccounts(list.filter((a) => a.accountType === "asset" || String(a.code).startsWith("110")))).catch(() => {});
  }, [loadAccounts]);

  const current = accounts.find((a) => a.code === account);
  const linked = !!current?.glAccountCode;

  const load = useCallback(async () => {
    if (!account || !linked) { setData(null); return; }
    setLoading(true);
    try {
      setData(await bankReconciliationService.workspace(account, period));
      setBankSel([]);
      setBookSel([]);
      setParams({ account, period }, { replace: true });
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [account, period, linked, setParams]);
  useEffect(() => { load(); }, [load]);

  const act = async (name, fn, message) => {
    setBusy(name);
    try {
      const r = await fn();
      setDialog(null);
      if (message) showSuccess(toast, typeof message === "function" ? message(r) : message);
      await load();
      return r;
    } catch (e) {
      showError(toast, e);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const bankRows = useMemo(() => (data?.bankLines || []).filter((l) => (bankFilter === "all" || !l.matchId)
    && (!bankSearch || text(`${l.description} ${l.reference} ${l.amount}`).includes(text(bankSearch)))), [data, bankFilter, bankSearch]);
  const bookRows = useMemo(() => (data?.bookLines || []).filter((v) => (bookFilter === "all" || !v.matchId)
    && (!bookSearch || text(`${v.journalNumber} ${v.documentNumber} ${v.chequeNumber} ${v.party} ${v.reference} ${v.description} ${v.amount}`).includes(text(bookSearch)))), [data, bookFilter, bookSearch]);

  const selBank = sum(bankSel);
  const selBook = sum(bookSel);
  const selDiff = Math.round((selBank - selBook) * 100) / 100;
  const s = data?.summary;
  const rec = data?.reconciliation;
  const periods = useMemo(() => recentPeriods(24), []);

  const openRec = async () => {
    if (rec) { navigate(`/accounts/bank-reconciliation/reconciliations/${rec.id}`); return; }
    const r = await act("rec", () => bankReconciliationService.createReconciliation(account, period));
    if (r) navigate(`/accounts/bank-reconciliation/reconciliations/${r.id}`);
  };

  const matchSelected = () => {
    if (!bankSel.length && !bookSel.length) return;
    if (selDiff !== 0) { setForm({ treatment: "adjustment", typeCode: null, remarks: "" }); setDialog("match"); return; }
    act("match", () => bankReconciliationService.match({ bankAccount: account, bankLineIds: bankSel.map((l) => l.id), bookLineIds: bookSel.map((v) => v.id) }), t("bankReconciliation.matched"));
  };
  const confirmMatchWithDifference = () => act("match", () => bankReconciliationService.match({
    bankAccount: account, bankLineIds: bankSel.map((l) => l.id), bookLineIds: bookSel.map((v) => v.id), remarks: form.remarks || undefined,
    difference: { treatment: form.treatment, typeCode: form.treatment === "adjustment" ? form.typeCode : undefined, remarks: form.remarks || undefined },
  }), t("bankReconciliation.matched"));

  const statusBody = (row) => {
    if (row.matchId) return <BrTag status={row.locked ? "locked" : "matched"} value={row.locked ? t("bankReconciliation.status.locked") : `${t("bankReconciliation.status.matched")} ${date(row.clearedDate)}`} />;
    if (row.flag) return <BrTag status="bank-error" />;
    if (row.adjustmentJournalStatus === "for-approval") return <BrTag status="for-approval" />;
    return <BrTag status="unmatched" />;
  };
  const typeName = (code) => types.find((x) => x.code === code)?.name || code;

  const bankActions = (l) => (
    <div className="flex gap-1 justify-content-end">
      {!l.matchId && !l.flag && !l.adjustmentJournalId && (
        <Button icon="pi pi-file-edit" text rounded size="small" tooltip={t("bankReconciliation.createAdjustment")} tooltipOptions={{ position: "left" }}
          onClick={() => { setForm({ line: l }); setDialog("adjust"); }} aria-label={t("bankReconciliation.createAdjustment")} />
      )}
      {l.adjustmentJournalStatus === "for-approval" && !l.matchId && hasPermission("write:journal-vouchers") && (
        <Button icon="pi pi-check-circle" text rounded size="small" tooltip={t("bankReconciliation.approveAdjustment")} tooltipOptions={{ position: "left" }}
          onClick={() => act("approveAdj", () => bankReconciliationService.approveAdjustment(l.id), t("bankReconciliation.adjustmentPosted"))} aria-label={t("bankReconciliation.approveAdjustment")} />
      )}
      {!l.matchId && (
        <Button icon={l.flag ? "pi pi-flag-fill" : "pi pi-flag"} text rounded size="small" severity={l.flag ? "danger" : "secondary"} tooltip={l.flag ? t("bankReconciliation.clearFlag") : t("bankReconciliation.flagBankError")}
          tooltipOptions={{ position: "left" }} aria-label={t("bankReconciliation.flagBankError")}
          onClick={() => (l.flag ? act("flag", () => bankReconciliationService.flagLine(l.id, null), t("bankReconciliation.flagCleared")) : (setForm({ line: l, remarks: "" }), setDialog("flag")))} />
      )}
      {l.matchId && !l.locked && (
        <Button icon="pi pi-link" text rounded size="small" severity="warning" tooltip={t("bankReconciliation.unmatch")} tooltipOptions={{ position: "left" }} aria-label={t("bankReconciliation.unmatch")}
          onClick={() => { setForm({ matchId: l.matchId, reason: "" }); setDialog("unmatch"); }} />
      )}
    </div>
  );
  const bookActions = (v) => (v.matchId && !v.locked ? (
    <Button icon="pi pi-link" text rounded size="small" severity="warning" tooltip={t("bankReconciliation.unmatch")} tooltipOptions={{ position: "left" }} aria-label={t("bankReconciliation.unmatch")}
      onClick={() => { setForm({ matchId: v.matchId, reason: "" }); setDialog("unmatch"); }} />
  ) : null);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("bankReconciliation.title")} trail={[t("bankReconciliation.workspace")]}>
        <Button icon="pi pi-list" outlined label={t("bankReconciliation.reconciliations")} onClick={() => navigate("/accounts/bank-reconciliation/reconciliations")} />
        <Button icon="pi pi-cog" outlined label={t("bankReconciliation.accountSetup")} disabled={!current}
          onClick={() => { setForm({ glAccountCode: current?.glAccountCode || null, statementFormat: current?.statementFormat || null, reconcileFrom: current?.reconcileFrom || "" }); setDialog("setup"); }} />
      </PageHeader>

      <div className="pe-card">
        <div className="br-toolbar">
          <div>
            <label htmlFor="br-account">{t("bankReconciliation.bankAccount")}</label>
            <Dropdown inputId="br-account" value={account} onChange={(e) => setAccount(e.value)} style={{ minWidth: 320 }} filter
              options={accounts.map((a) => ({ label: `${a.code} – ${a.name}${a.glAccountCode ? ` (GL ${a.glAccountCode})` : ` · ${t("bankReconciliation.notLinked")}`}`, value: a.code }))} />
          </div>
          <div>
            <label htmlFor="br-period">{t("bankReconciliation.period")}</label>
            <Dropdown inputId="br-period" value={period} options={periods} onChange={(e) => setPeriod(e.value)} style={{ minWidth: 220 }} />
          </div>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button icon="pi pi-upload" label={t("bankReconciliation.importStatement")} disabled={!linked} onClick={() => setDialog("import")} />
            <Button icon="pi pi-bolt" label={t("bankReconciliation.autoMatch")} disabled={!linked} loading={busy === "auto"}
              onClick={() => act("auto", () => bankReconciliationService.autoMatch(account), (r) => t("bankReconciliation.autoMatched", { count: r.matched }))} />
            <Button icon="pi pi-clock" outlined label={t("bankReconciliation.staleCheques")} disabled={!linked} onClick={() => setDialog("stale")} />
            <Button icon="pi pi-file-check" label={rec ? `${t("bankReconciliation.reconciliation")} ${rec.recNumber}` : t("bankReconciliation.startReconciliation")}
              disabled={!linked} loading={busy === "rec"} onClick={openRec} />
          </div>
        </div>
        {current && !linked && (
          <div className="br-notice mt-3">
            {t("bankReconciliation.notLinkedHelp", { account: current.code })}{" "}
            <Button link size="small" label={t("bankReconciliation.accountSetup")} onClick={() => { setForm({ glAccountCode: null, statementFormat: current.statementFormat || null, reconcileFrom: current.reconcileFrom || "" }); setDialog("setup"); }} />
          </div>
        )}
      </div>

      {s && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.statementBalance")}</div>
            <div className="pe-kpi-value">{s.statementBalance === null ? "—" : money(s.statementBalance)}</div>
            <div className="pe-muted">{s.statement ? `${s.statement.statementNumber} · ${date(data.to)}` : t("bankReconciliation.noStatement")}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.bookBalance")}</div><div className="pe-kpi-value">{money(s.bookBalance)}</div>
            <div className="pe-muted">GL {data.bankAccount.glAccountCode} · {date(data.to)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.unmatchedBank")}</div><div className="pe-kpi-value">{s.unmatchedBank}</div>
            <div className="pe-muted">{money(s.unmatchedBankAmount)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.unmatchedBook")}</div><div className="pe-kpi-value">{s.unmatchedBook}</div>
            <div className="pe-muted">{money(s.unmatchedBookAmount)}</div></div>
          <div className={`pe-kpi ${s.difference === 0 ? "br-kpi-diff-ok" : "br-kpi-diff-bad"}`}><div className="pe-kpi-label">{t("bankReconciliation.difference")}</div>
            <div className="pe-kpi-value">{money(s.difference)}</div>
            <div className="pe-muted">{s.difference === 0 ? t("bankReconciliation.balancesAgree") : t("bankReconciliation.balancesDiffer")}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("bankReconciliation.reconciliation")}</div>
            <div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{rec ? <BrTag status={rec.status} /> : t("bankReconciliation.notStarted")}</div>
            <div className="pe-muted">{rec?.recNumber || data.period}</div></div>
        </div>
      )}

      {data && (
        <div className="br-panes">
          <div className="pe-card">
            <div className="br-pane-head">
              <span className="br-pane-title">{t("bankReconciliation.bankLines")} ({bankRows.length})</span>
              <div className="flex gap-2 flex-wrap">
                <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} placeholder={t("bankReconciliation.search")} style={{ width: 170 }} /></span>
                <SelectButton value={bankFilter} onChange={(e) => e.value && setBankFilter(e.value)} options={[{ label: t("bankReconciliation.unmatchedOnly"), value: "unmatched" }, { label: t("bankReconciliation.all"), value: "all" }]} />
              </div>
            </div>
            <DataTable value={bankRows} dataKey="id" size="small" loading={loading} selectionMode="checkbox" selection={bankSel} onSelectionChange={(e) => setBankSel(e.value.filter((x) => !x.matchId))}
              scrollable scrollHeight="560px" emptyMessage={t("bankReconciliation.noLines")} rowClassName={(r) => (r.matchId ? "br-matched-row" : "")} isDataSelectable={(e) => !e.data.matchId}>
              <Column selectionMode="multiple" headerStyle={{ width: "2.5rem" }} />
              <Column header={t("bankReconciliation.date")} body={(l) => date(l.date)} style={{ width: "6.5rem" }} />
              <Column header={t("bankReconciliation.description")} body={(l) => (
                <div className="br-desc" title={l.description}>
                  <div>{l.description}</div>
                  <div className="br-sub">{[l.reference, l.statementNumber].filter(Boolean).join(" · ")}{l.typeCode && !l.matchId ? ` · ${typeName(l.typeCode)}` : ""}</div>
                </div>
              )} />
              <Column header={t("bankReconciliation.amount")} body={(l) => <div><Amount value={l.amount} /><div className="mt-1">{statusBody(l)}</div></div>} className="bv-num" headerClassName="bv-num" style={{ width: "9.5rem" }} />
              <Column body={bankActions} style={{ width: "6rem" }} />
            </DataTable>
          </div>
          <div className="pe-card">
            <div className="br-pane-head">
              <span className="br-pane-title">{t("bankReconciliation.bookLines")} ({bookRows.length})</span>
              <div className="flex gap-2 flex-wrap">
                <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder={t("bankReconciliation.search")} style={{ width: 170 }} /></span>
                <SelectButton value={bookFilter} onChange={(e) => e.value && setBookFilter(e.value)} options={[{ label: t("bankReconciliation.unmatchedOnly"), value: "unmatched" }, { label: t("bankReconciliation.all"), value: "all" }]} />
              </div>
            </div>
            <DataTable value={bookRows} dataKey="id" size="small" loading={loading} selectionMode="checkbox" selection={bookSel} onSelectionChange={(e) => setBookSel(e.value.filter((x) => !x.matchId))}
              scrollable scrollHeight="560px" emptyMessage={t("bankReconciliation.noLines")} rowClassName={(r) => (r.matchId ? "br-matched-row" : "")} isDataSelectable={(e) => !e.data.matchId}>
              <Column selectionMode="multiple" headerStyle={{ width: "2.5rem" }} />
              <Column header={t("bankReconciliation.date")} body={(v) => date(v.date)} style={{ width: "6.5rem" }} />
              <Column header={t("bankReconciliation.document")} body={(v) => (
                <div className="br-desc" title={v.description}>
                  <div>{v.documentType} {v.documentNumber}{v.chequeNumber ? ` · ${t("bankReconciliation.cheque")} ${v.chequeNumber}` : ""}</div>
                  <div className="br-sub"><button type="button" className="pe-link" onClick={() => setJournal({ journalNumber: v.journalNumber, date: v.date, journalStatus: v.journalStatus, description: v.description })}>{v.journalNumber}</button>
                    {v.party ? ` · ${v.party}` : ""}{v.reference && v.reference !== v.chequeNumber ? ` · ${v.reference}` : ""}</div>
                </div>
              )} />
              <Column header={t("bankReconciliation.amount")} body={(v) => <div><Amount value={v.amount} /><div className="mt-1">{statusBody(v)}</div></div>} className="bv-num" headerClassName="bv-num" style={{ width: "9.5rem" }} />
              <Column body={bookActions} style={{ width: "3rem" }} />
            </DataTable>
          </div>
        </div>
      )}

      {(bankSel.length > 0 || bookSel.length > 0) && (
        <div className="br-selection-bar">
          <div className="br-sel-figures">
            <span>{t("bankReconciliation.selectedBank", { count: bankSel.length })}<b>{money(selBank)}</b></span>
            <span>{t("bankReconciliation.selectedBook", { count: bookSel.length })}<b>{money(selBook)}</b></span>
            <span className={selDiff === 0 ? "br-sel-diff-ok" : "br-sel-diff-bad"}>{t("bankReconciliation.difference")}<b>{money(selDiff)}</b></span>
          </div>
          <div className="flex gap-2">
            <Button label={t("bankReconciliation.clear")} text style={{ color: "#fff" }} onClick={() => { setBankSel([]); setBookSel([]); }} />
            <Button icon="pi pi-link" label={t("bankReconciliation.matchSelected")} loading={busy === "match"} onClick={matchSelected}
              disabled={bankSel.length + bookSel.length < 2} />
          </div>
        </div>
      )}

      <ImportStatementDialog visible={dialog === "import"} onHide={() => setDialog(null)} account={current} formats={formats}
        onImported={(r) => { setDialog(null); showSuccess(toast, t("bankReconciliation.imported", { number: r.statement.statementNumber, lines: r.statement.lineCount, matched: r.autoMatch?.matched ?? 0 })); load(); loadAccounts(); }} />
      <AdjustmentDialog visible={dialog === "adjust"} line={form.line} types={types} glAccounts={glAccounts} bookLines={data?.bookLines || []} busy={busy === "adjust"} onHide={() => setDialog(null)}
        onSubmit={(body) => act("adjust", () => bankReconciliationService.createAdjustment(form.line.id, body), (r) => r.message || t("bankReconciliation.adjustmentPosted"))} />
      <StaleChequesDialog visible={dialog === "stale"} account={account} onHide={() => setDialog(null)} onChanged={load} toast={toast} />
      <JournalDialog journal={journal} onHide={() => setJournal(null)} />

      <Dialog className="pe-dialog" visible={["setup", "flag", "unmatch", "match"].includes(dialog)} style={{ width: "min(560px, 95vw)" }} onHide={() => setDialog(null)}
        header={dialog ? t(`bankReconciliation.dialog.${dialog}`, { defaultValue: "" }) : ""}
        footer={(
          <div>
            <Button label={t("bankReconciliation.cancel")} text onClick={() => setDialog(null)} />
            {dialog === "setup" && <Button label={t("bankReconciliation.save")} icon="pi pi-save" loading={busy === "setup"} disabled={!form.glAccountCode}
              onClick={() => act("setup", () => bankReconciliationService.linkBankAccount(account, { glAccountCode: form.glAccountCode, statementFormat: form.statementFormat || null,
                ...((form.reconcileFrom || null) !== (current?.reconcileFrom || null) ? { reconcileFrom: form.reconcileFrom || null } : {}) }), t("bankReconciliation.accountLinked")).then(loadAccounts)} />}
            {dialog === "flag" && <Button label={t("bankReconciliation.flagBankError")} icon="pi pi-flag" severity="danger" loading={busy === "flag"} disabled={!String(form.remarks || "").trim()}
              onClick={() => act("flag", () => bankReconciliationService.flagLine(form.line.id, "bank-error", form.remarks), t("bankReconciliation.flagged"))} />}
            {dialog === "unmatch" && <Button label={t("bankReconciliation.unmatch")} icon="pi pi-link" severity="warning" loading={busy === "unmatch"}
              onClick={() => act("unmatch", () => bankReconciliationService.unmatch(form.matchId, form.reason), t("bankReconciliation.unmatched"))} />}
            {dialog === "match" && <Button label={t("bankReconciliation.matchSelected")} icon="pi pi-link" loading={busy === "match"}
              disabled={form.treatment === "adjustment" && !form.typeCode} onClick={confirmMatchWithDifference} />}
          </div>
        )}>
        {dialog === "setup" && (
          <div className="grid">
            <div className="col-12"><p className="pe-muted mt-0">{t("bankReconciliation.setupHelp")}</p></div>
            <div className="col-12">
              <label htmlFor="br-gl">{t("bankReconciliation.glAccount")} *</label>
              <Dropdown inputId="br-gl" value={form.glAccountCode} onChange={(e) => setForm({ ...form, glAccountCode: e.value })} filter className="w-full"
                options={glAccounts.map((g) => ({ label: `${g.code} – ${g.name}`, value: g.code }))} />
            </div>
            <div className="col-12">
              <label htmlFor="br-format">{t("bankReconciliation.statementFormat")}</label>
              <Dropdown inputId="br-format" value={form.statementFormat} onChange={(e) => setForm({ ...form, statementFormat: e.value })} className="w-full" showClear
                options={formats.map((f) => ({ label: `${f.code} – ${f.name}`, value: f.code }))} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="br-from">{t("bankReconciliation.reconcileFrom")}</label>
              <InputText id="br-from" type="date" value={form.reconcileFrom || ""} onChange={(e) => setForm({ ...form, reconcileFrom: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6 flex align-items-end"><span className="pe-muted">{t("bankReconciliation.reconcileFromHelp")}</span></div>
          </div>
        )}
        {dialog === "flag" && form.line && (
          <div>
            <p className="pe-muted mt-0">{t("bankReconciliation.flagHelp")}</p>
            <p><b>{date(form.line.date)}</b> · {form.line.description} · <Amount value={form.line.amount} /></p>
            <label htmlFor="br-flag-remarks">{t("bankReconciliation.remarks")} *</label>
            <InputTextarea id="br-flag-remarks" rows={3} className="w-full" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
        )}
        {dialog === "unmatch" && (
          <div>
            <p className="pe-muted mt-0">{t("bankReconciliation.unmatchHelp")}</p>
            <label htmlFor="br-unmatch-reason">{t("bankReconciliation.reason")}</label>
            <InputTextarea id="br-unmatch-reason" rows={2} className="w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
        )}
        {dialog === "match" && (
          <div>
            <div className="br-notice">{t("bankReconciliation.differenceHelp", { bank: money(selBank), book: money(selBook), difference: money(selDiff) })}</div>
            <label>{t("bankReconciliation.treatment")}</label>
            <SelectButton value={form.treatment} onChange={(e) => e.value && setForm({ ...form, treatment: e.value })} className="mb-3"
              options={["adjustment", "bank-error", "book-error"].map((x) => ({ label: t(`bankReconciliation.treatmentValue.${x}`), value: x }))} />
            {form.treatment === "adjustment" && (
              <div className="mb-3">
                <label htmlFor="br-diff-type">{t("bankReconciliation.transactionType")} *</label>
                <Dropdown inputId="br-diff-type" value={form.typeCode} onChange={(e) => setForm({ ...form, typeCode: e.value })} className="w-full"
                  options={types.filter((x) => x.action === "journal" && x.direction === (selDiff < 0 ? "debit" : "credit")).map((x) => ({ label: `${x.code} – ${x.name}`, value: x.code }))} />
              </div>
            )}
            <label htmlFor="br-diff-remarks">{t("bankReconciliation.remarks")}</label>
            <InputTextarea id="br-diff-remarks" rows={2} className="w-full" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Workspace;
