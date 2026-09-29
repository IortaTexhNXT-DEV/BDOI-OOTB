import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { PageHeader, date, money, showError } from "./common";

const TYPES = ["income-statement", "balance-sheet", "trial-balance"];
const REPORT_CODE = { "income-statement": "income-statement", "balance-sheet": "balance-sheet", "trial-balance": "trial-balance-ocm" };
const SECTIONS = { "income-statement": [["income", "periodEnd.income"], ["expense", "periodEnd.expenses"]], "balance-sheet": [["asset", "periodEnd.assets"], ["liability", "periodEnd.liabilities"], ["equity", "periodEnd.equity"]] };
const COLUMNS = {
  "income-statement": [["currentPeriod", "periodEnd.currentPeriod"], ["yearToDate", "periodEnd.yearToDate"], ["priorPeriod", "periodEnd.priorPeriod"], ["priorYearToDate", "periodEnd.priorYearToDate"]],
  "balance-sheet": [["balance", "periodEnd.balance"], ["priorYearEnd", "periodEnd.priorYearEnd"]],
};
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };

/** Grouped statement (income statement / balance sheet): sections by account type, statement groups with subtotals. */
const Statement = ({ type, data, t }) => {
  const cols = COLUMNS[type];
  const rows = data.rows || [];
  const out = [];
  const totals = {};
  for (const [section, label] of SECTIONS[type]) {
    const inSection = rows.filter((r) => r.accountType === section);
    out.push(<tr key={`s-${section}`} className="pe-section"><td colSpan={cols.length + 1}>{t(label)}</td></tr>);
    const groups = [...new Set(inSection.map((r) => r.fsGroup))];
    for (const g of groups) {
      const gr = inSection.filter((r) => r.fsGroup === g);
      out.push(<tr key={`g-${section}-${g}`} className="pe-group"><td colSpan={cols.length + 1}>{g}</td></tr>);
      for (const r of gr) {
        out.push(<tr key={`a-${r.accountCode}`}><td className="pe-indent">{r.accountCode} {r.accountName}</td>{cols.map(([k]) => <td key={k} className="num">{money(r[k])}</td>)}</tr>);
      }
      out.push(<tr key={`gt-${section}-${g}`} className="pe-subtotal"><td className="pe-indent">{t("periodEnd.total")} {g}</td>{cols.map(([k]) => <td key={k} className="num">{money(sum(gr, k))}</td>)}</tr>);
    }
    totals[section] = Object.fromEntries(cols.map(([k]) => [k, sum(inSection, k)]));
    out.push(<tr key={`st-${section}`} className="pe-subtotal"><td>{t("periodEnd.total")} {t(label)}</td>{cols.map(([k]) => <td key={k} className="num">{money(totals[section][k])}</td>)}</tr>);
  }
  if (type === "income-statement") {
    out.push(<tr key="net" className="pe-grand"><td>{t("periodEnd.netIncome")}</td>{cols.map(([k]) => <td key={k} className="num">{money((totals.income?.[k] || 0) - (totals.expense?.[k] || 0))}</td>)}</tr>);
  } else {
    out.push(<tr key="le" className="pe-grand"><td>{t("periodEnd.totalLiabilitiesEquity")}</td>{cols.map(([k]) => <td key={k} className="num">{money((totals.liability?.[k] || 0) + (totals.equity?.[k] || 0))}</td>)}</tr>);
  }
  return (
    <table className="pe-statement">
      <thead><tr><th>{t("periodEnd.account")}</th>{cols.map(([k, l]) => <th key={k} className="num">{t(l)}</th>)}</tr></thead>
      <tbody>{out}</tbody>
    </table>
  );
};

const TrialBalance = ({ data, t }) => {
  const rows = data.rows || [];
  const keys = ["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"];
  return (
    <table className="pe-statement">
      <thead>
        <tr><th rowSpan={2}>{t("periodEnd.account")}</th><th colSpan={2} className="num">{t("periodEnd.opening")}</th><th colSpan={2} className="num">{t("periodEnd.movement")}</th><th colSpan={2} className="num">{t("periodEnd.closing")}</th></tr>
        <tr>{[0, 1, 2].map((i) => <React.Fragment key={i}><th className="num">{t("periodEnd.debit")}</th><th className="num">{t("periodEnd.credit")}</th></React.Fragment>)}</tr>
      </thead>
      <tbody>
        {rows.map((r) => <tr key={r.accountCode}><td>{r.accountCode} {r.accountName}</td>{keys.map((k) => <td key={k} className="num">{Number(r[k]) ? money(r[k]) : ""}</td>)}</tr>)}
        <tr className="pe-grand"><td>{t("periodEnd.total")}</td>{keys.map((k) => <td key={k} className="num">{money(sum(rows, k))}</td>)}</tr>
      </tbody>
    </table>
  );
};

/** Accounts > Period End > Financial Statements: income statement, balance sheet and trial balance on screen. */
const FinancialStatements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [type, setType] = useState("income-statement");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await periodEndService.statement(type, { FromDate: toIsoDate(from), ToDate: toIsoDate(to), ReportCriteria: type === "trial-balance" ? "Overall" : "Detailed" }));
    } catch (e) {
      showError(toast, e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [type, from, to]);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.financialStatements")} trail={[t("periodEnd.financialStatements")]} subtitle={t("periodEnd.statementsHelp")}>
        <Button icon="pi pi-download" outlined label={t("periodEnd.exportReport")} onClick={() => navigate(`/reports/run/${REPORT_CODE[type]}`)} />
      </PageHeader>
      <div className="pe-card pe-filters">
        <SelectButton value={type} options={TYPES.map((x) => ({ label: t(`periodEnd.statement.${x}`), value: x }))} onChange={(e) => e.value && setType(e.value)} />
        {type !== "balance-sheet" && (
          <div><label htmlFor="fs-from">{t("periodEnd.fromDate")}</label><Calendar inputId="fs-from" value={from} onChange={(e) => e.value && setFrom(e.value)} dateFormat={calendarDateFormat()} showIcon maxDate={to} /></div>
        )}
        <div><label htmlFor="fs-to">{type === "balance-sheet" ? t("periodEnd.asOf") : t("periodEnd.toDate")}</label><Calendar inputId="fs-to" value={to} onChange={(e) => e.value && setTo(e.value)} dateFormat={calendarDateFormat()} showIcon /></div>
        <Button icon="pi pi-refresh" text onClick={load} loading={loading} />
      </div>

      {data && type === "income-statement" && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.totalIncome")}</div><div className="pe-kpi-value">{money(s.totalIncome)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.totalExpense")}</div><div className="pe-kpi-value">{money(s.totalExpense)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.netIncome")}</div><div className="pe-kpi-value">{money(s.netIncome)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.netIncomeYtd")}</div><div className="pe-kpi-value">{money(s.netIncomeYearToDate)}</div></div>
        </div>
      )}
      {data && type === "balance-sheet" && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.assets")}</div><div className="pe-kpi-value">{money(s.totalAssets)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.totalLiabilitiesEquity")}</div><div className="pe-kpi-value">{money(s.totalLiabilitiesAndEquity)}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.difference")}</div><div className="pe-kpi-value">{money(s.difference)}</div><div className="pe-muted">{Number(s.difference) === 0 ? t("periodEnd.balanced") : t("periodEnd.notBalanced")}</div></div>
        </div>
      )}
      {data && type === "trial-balance" && (
        <div className="pe-kpis">
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.closingDebits")}</div><div className="pe-kpi-value">{money(sum(data.rows || [], "closingDebit"))}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.closingCredits")}</div><div className="pe-kpi-value">{money(sum(data.rows || [], "closingCredit"))}</div></div>
          <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.statusLabel")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{s.balanced ? t("periodEnd.balanced") : t("periodEnd.notBalanced")}</div></div>
        </div>
      )}

      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t(`periodEnd.statement.${type}`)}</span>
          <span className="pe-muted">{type === "balance-sheet" ? `${t("periodEnd.asOf")} ${date(toIsoDate(to))}` : `${date(toIsoDate(from))} – ${date(toIsoDate(to))}`}</span>
        </div>
        {loading && <div className="pe-muted">{t("periodEnd.loading")}</div>}
        {data && !loading && (type === "trial-balance" ? <TrialBalance data={data} t={t} /> : <Statement type={type} data={data} t={t} />)}
      </div>
    </div>
  );
};

export default FinancialStatements;
