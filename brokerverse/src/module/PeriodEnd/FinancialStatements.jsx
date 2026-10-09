import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Menu } from "primereact/menu";
import { Skeleton } from "primereact/skeleton";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import DateField from "../../components/DateField";
import LoadingBar from "../../components/LoadingBar";
import StatCards from "../../components/StatCards";
import useStableLoad from "../../hooks/useStableLoad";
import periodEndService from "../../services/periodEndService";
import { getDisplayCurrencyConfig } from "../../utility/currencyConverter";
import AccountLedgerDialog from "./AccountLedgerDialog";
import { PageHeader, StatusTag, date, showError } from "./common";
import { DATE_VIEWS, RANGE_VIEWS, defaultChoice, fiscalYearOf, monthName, monthsText, printBlob, rangeOf, saveBlob, statementAmount } from "./statementHelpers";
import "./FinancialStatements.scss";

const TYPES = ["income-statement", "balance-sheet", "trial-balance"];

/** The figures above the statement, from the statement on screen (or dashes before the first one). */
const cardItems = (t, type, statement) => {
  const c = statement?.type === type ? statement.cards : null;
  const amount = (v) => (c ? statementAmount(v) : null);
  const check = c ? <Tag className="pe-tag" severity={c.balanced ? "success" : "danger"} value={t(c.balanced ? "financialStatements.status.balanced" : "financialStatements.status.outOfBalance")} /> : null;
  if (type === "income-statement") {
    const loss = c && c.netIncome < 0;
    const lossYtd = c && c.netIncomeYearToDate < 0;
    return [
      { key: "income", label: t("financialStatements.cards.totalIncome"), value: amount(c?.totalIncome) },
      { key: "expense", label: t("financialStatements.cards.totalExpense"), value: amount(c?.totalExpense) },
      { key: "net", label: t(loss ? "financialStatements.cards.netLoss" : "financialStatements.cards.netIncome"), value: c ? statementAmount(Math.abs(c.netIncome)) : null },
      { key: "ytd", label: t(lossYtd ? "financialStatements.cards.netLossYtd" : "financialStatements.cards.netIncomeYtd"), value: c ? statementAmount(Math.abs(c.netIncomeYearToDate)) : null },
    ];
  }
  if (type === "balance-sheet") {
    return [
      { key: "assets", label: t("financialStatements.cards.totalAssets"), value: amount(c?.totalAssets) },
      { key: "liabilities", label: t("financialStatements.cards.totalLiabilities"), value: amount(c?.totalLiabilities) },
      { key: "equity", label: t("financialStatements.cards.totalEquity"), value: amount(c?.totalEquity), note: c ? t("financialStatements.cards.withEarnings") : null },
      { key: "check", label: t("financialStatements.cards.balanceCheck"), value: amount(c?.difference), note: check },
    ];
  }
  return [
    { key: "debit", label: t("financialStatements.cards.totalDebit"), value: amount(c?.totalDebit), note: c ? t("financialStatements.cards.closingAt", { date: date(statement.to) }) : null },
    { key: "credit", label: t("financialStatements.cards.totalCredit"), value: amount(c?.totalCredit), note: c ? t("financialStatements.cards.closingAt", { date: date(statement.to) }) : null },
    { key: "difference", label: t("financialStatements.cards.difference"), value: amount(c?.difference), note: check },
  ];
};

/** Column heading: the label and, under it, what the column covers (months, or the dates of other ranges). */
const MeasureHead = ({ measure, t, language }) => {
  const dates = measure.from ? `${date(measure.from)} – ${date(measure.to)}` : date(measure.to);
  return (
    <th scope="col" className="num" title={dates}>
      <span className="fs-col-label">{t(`financialStatements.measure.${measure.key}`)}</span>
      <span className="fs-col-dates">{monthsText(measure.from, measure.to, language) || dates}</span>
    </th>
  );
};

/** Amount cells of a row; blankZero: a trial balance line leaves the zero side empty. */
const Amounts = ({ measures, values, blankZero = false }) => measures.map((m) => (
  <td key={m.key} className="num">{values && !(blankZero && !values[m.key]) ? statementAmount(values[m.key]) : ""}</td>
));

/** The statement on screen: sections, statement groups, account lines (each opens its ledger) and totals. */
const StatementTable = ({ statement, onOpen, t, language }) => {
  const { measures, sections, result, type } = statement;
  const span = measures.length + 1;
  const lines = sections.flatMap((s) => s.groups.flatMap((g) => g.lines));
  const label = (l) => (l.drill ? (
    <button type="button" className="fs-account" onClick={() => onOpen(l)}>
      <span className="fs-code">{l.accountCode}</span>
      <span>{l.accountName}</span>
    </button>
  ) : <span className="fs-account-text">{t(`financialStatements.earnings.${l.accountCode}`, { defaultValue: l.accountName })}</span>);
  const sectionLabel = (s) => t(`financialStatements.section.${s.key}`);
  const body = [];
  for (const s of sections) {
    if (s.label) body.push(<tr key={`s-${s.key}`} className="fs-section"><th scope="rowgroup" colSpan={span}>{sectionLabel(s)}</th></tr>);
    for (const g of s.groups) {
      // a group named as its section (Equity under Equity) has no heading or total of its own
      const own = g.label && g.label !== s.label;
      if (own) body.push(<tr key={`g-${s.key}-${g.label}`} className="fs-group"><th scope="rowgroup" colSpan={span}>{g.label}</th></tr>);
      for (const l of g.lines) body.push(<tr key={`l-${s.key}-${l.accountCode}`} className="fs-line"><td className="fs-account-col">{label(l)}</td><Amounts measures={measures} values={l.values} blankZero={type === "trial-balance"} /></tr>);
      if (own && g.total) body.push(<tr key={`gt-${s.key}-${g.label}`} className="fs-subtotal"><td>{t("financialStatements.total", { label: g.label })}</td><Amounts measures={measures} values={g.total} /></tr>);
    }
    if (s.total) body.push(<tr key={`st-${s.key}`} className="fs-total"><td>{t("financialStatements.total", { label: sectionLabel(s) })}</td><Amounts measures={measures} values={s.total} /></tr>);
  }
  return (
    <table className={`fs-table${type === "trial-balance" ? " fs-table--wide" : ""}`}>
      <thead>
        {type === "trial-balance" ? (
          <>
            <tr>
              <th scope="col" rowSpan={2} className="fs-account-col">{t("financialStatements.account")}</th>
              {["opening", "movement", "closing"].map((g) => <th key={g} scope="colgroup" colSpan={2} className="fs-colgroup">{t(`financialStatements.tb.${g}`)}</th>)}
            </tr>
            <tr>{measures.map((m) => <th key={m.key} scope="col" className="num">{t(`financialStatements.tb.${m.side}`)}</th>)}</tr>
          </>
        ) : (
          <tr><th scope="col" className="fs-account-col">{t("financialStatements.account")}</th>{measures.map((m) => <MeasureHead key={m.key} measure={m} t={t} language={language} />)}</tr>
        )}
      </thead>
      <tbody>
        {lines.length ? body : <tr className="fs-empty"><td colSpan={span}>{t("financialStatements.noLines")}</td></tr>}
        <tr className="fs-result"><td>{t(`financialStatements.result.${result.key}`)}</td><Amounts measures={measures} values={result.values} /></tr>
      </tbody>
    </table>
  );
};

/** Accounts > Period End > Financial Statements: income statement, balance sheet and trial balance of a fiscal period. */
const FinancialStatements = () => {
  const { t, i18n } = useTranslation();
  const toast = useRef(null);
  const exportMenu = useRef(null);
  const [type, setType] = useState(TYPES[0]);
  const [choice, setChoice] = useState(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(null);
  const [ledger, setLedger] = useState(null);

  const loadCalendar = useCallback(() => periodEndService.statementPeriods(), []);
  const { data: calendar, error: calendarError } = useStableLoad(loadCalendar);
  useEffect(() => {
    if (calendar && !choice) setChoice(defaultChoice(calendar));
  }, [calendar, choice]);

  const asOf = type === "balance-sheet";
  const range = useMemo(() => (choice ? rangeOf(calendar, choice, type) : { error: "required" }), [calendar, choice, type]);
  const { from, to, quarter } = range;
  const params = useMemo(() => (to ? { FromDate: from || undefined, ToDate: to } : null), [from, to]);
  // what the period label of the loaded statement says (the choice may change while it reloads)
  const view = choice?.view;
  const fiscalYear = choice?.fiscalYear;
  const period = choice?.period;
  const custom = view === "custom";
  const loader = useCallback(async () => ({ ...(await periodEndService.statement(type, params)), shown: { view, quarter, fiscalYear, period } }),
    [type, params, view, quarter, fiscalYear, period]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !!params, debounceMs: custom ? 300 : 0 });
  const statement = data?.statement || null;

  const year = fiscalYearOf(calendar, fiscalYear);
  const set = (patch) => setChoice((c) => ({ ...c, ...patch }));
  const chooseYear = (code) => {
    const fy = fiscalYearOf(calendar, code);
    const no = year?.periods.find((p) => p.period === period)?.periodNo;
    const same = fy?.periods.find((p) => p.periodNo === no);
    set({ fiscalYear: code, period: (same || fy?.periods[fy.periods.length - 1])?.period || null });
  };
  const chooseView = (next) => {
    if (next === "custom") {
      const r = rangeOf(calendar, { ...choice, view: "month" }, type);
      set({ view: next, from: choice.from || r.from || null, to: choice.to || r.to || null });
      setTouched(false);
    } else set({ view: next === "periodEnd" ? "month" : next });
  };

  const views = (asOf ? DATE_VIEWS : RANGE_VIEWS).map((v) => ({ value: v, label: t(`financialStatements.views.${asOf && v === "custom" ? "customDate" : v}`) }));
  const viewValue = asOf ? (custom ? "custom" : "periodEnd") : view;
  const periodOptions = (year?.periods || []).map((p) => ({ value: p.period, label: `${monthName(p.period, i18n.language)} (P${p.periodNo})`, status: p.status }));
  const rangeError = custom && touched && range.error ? t(`financialStatements.errors.${range.error}`) : null;

  /** "October 2026 · 01/10/2026 – 31/10/2026", "Quarter 3, FY2027 · …", "As of 31/10/2026". */
  const shownLabel = () => {
    const shown = data.shown || {};
    if (statement.type === "balance-sheet") return t("financialStatements.label.asOf", { date: date(statement.to) });
    const dates = `${date(statement.from)} – ${date(statement.to)}`;
    if (shown.view === "custom") return `${t("financialStatements.views.custom")} · ${dates}`;
    if (shown.view === "quarter" && shown.quarter) return `${t("financialStatements.label.quarter", { quarter: shown.quarter, fiscalYear: shown.fiscalYear })} · ${dates}`;
    if (shown.view === "ytd") return `${t("financialStatements.label.ytd", { fiscalYear: shown.fiscalYear })} · ${dates}`;
    return `${monthName(shown.period, i18n.language)} · ${dates}`;
  };
  // the ledger of a line covers the statement's range; for the balance sheet, the month of its date
  const drillRange = () => ({ from: statement.from || `${statement.to.slice(0, 7)}-01`, to: statement.to });

  const file = async (format, deliver) => {
    setBusy(format);
    try {
      deliver(await periodEndService.statementFile(type, params, format === "print" ? "pdf" : format));
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };
  const exportItems = [
    { label: t("financialStatements.excel"), icon: "pi pi-file-excel", command: () => file("xlsx", (f) => saveBlob(f.blob, f.fileName)) },
    { label: t("financialStatements.pdf"), icon: "pi pi-file-pdf", command: () => file("pdf", (f) => saveBlob(f.blob, f.fileName)) },
  ];

  return (
    <div className="pe-page fs-page">
      <Toast ref={toast} />
      <PageHeader title={t("financialStatements.title")} trail={[t("financialStatements.title")]} subtitle={t("financialStatements.help")}>
        <Menu model={exportItems} popup ref={exportMenu} id="fs-export-menu" />
        <Button label={t("financialStatements.export")} icon="pi pi-download" outlined disabled={!params} loading={busy === "xlsx" || busy === "pdf"}
          onClick={(e) => exportMenu.current.toggle(e)} aria-haspopup aria-controls="fs-export-menu" />
        <Button label={t("financialStatements.print")} icon="pi pi-print" outlined disabled={!params} loading={busy === "print"} onClick={() => file("print", (f) => printBlob(f.blob))} />
      </PageHeader>

      <TabView className="bv-tabbar fs-tabs" activeIndex={TYPES.indexOf(type)} onTabChange={(e) => setType(TYPES[e.index])}>
        {TYPES.map((x) => <TabPanel key={x} header={t(`financialStatements.statement.${x}`)} />)}
      </TabView>

      <div className="pe-card fs-toolbar">
        <div className="fs-field">
          <label htmlFor="fs-year">{t("financialStatements.fiscalYear")}</label>
          <Dropdown inputId="fs-year" value={choice?.fiscalYear} options={(calendar?.fiscalYears || []).map((f) => ({ value: f.code, label: f.code }))}
            onChange={(e) => chooseYear(e.value)} disabled={!calendar || custom} />
        </div>
        <div className="fs-field fs-field--period">
          <label htmlFor="fs-period">{t("financialStatements.period")}</label>
          <Dropdown inputId="fs-period" value={choice?.period} options={periodOptions} onChange={(e) => set({ period: e.value })} disabled={!calendar || custom}
            itemTemplate={(o) => <span className="fs-period-option"><span>{o.label}</span><StatusTag status={o.status} /></span>} />
        </div>
        <div className="fs-field fs-field--view">
          <label htmlFor="fs-view">{t("financialStatements.view")}</label>
          <Dropdown inputId="fs-view" value={viewValue} options={views} onChange={(e) => chooseView(e.value)} disabled={!choice} />
        </div>
        {custom && !asOf && (
          <div className="fs-field fs-field--date">
            <label htmlFor="fs-from">{t("financialStatements.from")}</label>
            <DateField id="fs-from" value={choice.from} max={choice.to || undefined} onChange={(e) => { setTouched(true); set({ from: e.target.value || null }); }} />
          </div>
        )}
        {custom && (
          <div className="fs-field fs-field--date">
            <label htmlFor="fs-to">{asOf ? t("financialStatements.asOf") : t("financialStatements.to")}</label>
            <DateField id="fs-to" value={choice.to} min={asOf ? undefined : choice.from || undefined} invalid={!!rangeError}
              onChange={(e) => { setTouched(true); set({ to: e.target.value || null }); }} aria-describedby={rangeError ? "fs-range-error" : undefined} />
            {rangeError && <small id="fs-range-error" className="p-error">{rangeError}</small>}
          </div>
        )}
        <Button icon="pi pi-refresh" text rounded className="fs-refresh" onClick={reload} disabled={!params} aria-label={t("financialStatements.refresh")}
          tooltip={t("financialStatements.refresh")} tooltipOptions={{ position: "top" }} />
      </div>
      {calendarError && <div className="pe-error" role="alert">{calendarError}</div>}

      <StatCards items={cardItems(t, statement?.type || type, statement)} className="fs-cards" />

      <section className="pe-card bv-loading-host fs-statement" aria-busy={loading || refreshing} aria-labelledby="fs-title">
        <LoadingBar active={refreshing} />
        <div className="fs-card-head">
          <h2 id="fs-title" className="fs-card-title">{t(`financialStatements.statement.${statement?.type || type}`)}</h2>
          {statement && <span className="fs-card-period">{shownLabel()} · {t("financialStatements.amountsIn", { currency: getDisplayCurrencyConfig().currency })}</span>}
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}
        {statement && <div className="fs-scroll"><StatementTable statement={statement} onOpen={(l) => setLedger({ account: l, ...drillRange() })} t={t} language={i18n.language} /></div>}
        {!statement && !error && <div className="fs-skeleton">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height="1.5rem" className="mb-2" />)}</div>}
      </section>

      {ledger && <AccountLedgerDialog account={ledger.account} from={ledger.from} to={ledger.to} onHide={() => setLedger(null)} />}
    </div>
  );
};

export default FinancialStatements;
