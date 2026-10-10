import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabMenu } from "primereact/tabmenu";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import LoadingBar from "../../../components/LoadingBar";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { canOpen, hasPermission } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { instantParts } from "../../../utility/dateFormat";
import { REMITTANCE_ROUTES, formatDate, loadInsurerOptions, money, statusChip, useUrlState } from "../shared";
import { RunHistoryPanel, RunNowDialog } from "../Runs";
import { ImportHistory, ImportPolicyList } from "../Import";
import RunStrip from "./RunStrip";
import SubmitResults from "./SubmitResults";
import { submitDrafts } from "./submitDrafts";
import {
  HIDDEN_COLUMNS, KPIS, PER_PAGE, PRODUCT_LINES, SOURCES, STATUSES, businessToday, recentWeeks, resultsById, saveColumns, savedColumns, segmentOf,
  sortOf, sortParam, submitAction, submittable, weekOf, weekParam, weekText,
} from "./worklist";
import "../remittance.scss";

const DOWNLOADS = ["download-schedule-xlsx", "download-schedule-pdf", "download-advice"];
const dayOf = (instant) => instantParts(instant)?.date || "-";

/**
 * Accounts > Remittance > Remittances (/finance/remittance/remittances), the worklist and register of the insurer
 * remittances (direct bill only; agency bills never appear). The header has Submit for approval (n) for the ticked
 * drafts, Import policy list and the overflow Run now, Run history, Import history and Export XLSX; the run strip; the
 * four KPI cards of the server over the filters (a card filters the table); the segments My work, Drafts, In approval,
 * In payment and All; the filters; the table with a chooser for the further columns, the total of the filtered set and
 * a row menu built from the server's actions. Only drafts the user may submit have a tick box; the result of a
 * submission shows in each row, then the list reloads. A read-only user sees "View only" and no tick box, primary
 * button, Run now or Import. ?import=new (or an import id) opens the Import policy list dialog.
 */
const Remittances = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const canWrite = hasPermission("write:remittance");
  const [state, update] = useUrlState({});
  const [search, setSearch] = useState(state.q || "");
  const [insurers, setInsurers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [strip, setStrip] = useState(null);
  const [selection, setSelection] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [extra, setExtra] = useState(savedColumns);
  const [runNow, setRunNow] = useState(false);
  const [history, setHistory] = useState(null);
  const [imports, setImports] = useState(false);
  const today = useMemo(() => businessToday(), []);
  const segment = segmentOf(state.segment, canWrite);
  const page = Math.max(1, Number(state.page) || 1);
  const kpi = KPIS.includes(state.kpi) ? state.kpi : undefined;
  const week = weekParam(state.week, segment, today);

  const params = useMemo(() => ({
    segment, week, insurerId: state.insurerId || undefined, productLine: state.productLine || undefined, status: segment === "all" ? state.status || undefined : undefined,
    source: state.source || undefined, q: state.q || undefined, kpi, sort: state.sort || undefined, page, perPage: PER_PAGE,
  }), [segment, week, state.insurerId, state.productLine, state.status, state.source, state.q, kpi, state.sort, page]);
  const loader = useCallback(() => remittanceService.listRegister(params), [params]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const rows = data?.data || [];
  const kpis = data?.kpis || null;
  const results = useMemo(() => resultsById(submitted?.results), [submitted]);

  const loadStrip = useCallback(() => {
    remittanceService.summary().then((s) => setStrip(s?.runStrip || null)).catch(() => setStrip(null));
  }, []);

  useEffect(() => {
    loadStrip();
    loadInsurerOptions().then(setInsurers).catch(() => setInsurers([]));
    remittanceService.listSchedules().then((s) => setSchedules(s?.schedules || [])).catch(() => setSchedules([]));
  }, [loadStrip]);

  useEffect(() => {
    const q = search.trim();
    if (q === (state.q || "")) return undefined;
    const timer = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(timer);
  }, [search, state.q, update]);

  useEffect(() => {
    setSelection([]);
  }, [params]);

  const refresh = () => {
    reload();
    loadStrip();
  };

  const submitRows = async (list) => {
    const out = await submitDrafts(t, list);
    if (!out) return;
    setSubmitted(out);
    setSelection([]);
    refresh();
  };

  const setSegment = (key) => update({ segment: key, kpi: null, status: null });
  const segments = [
    ...(canWrite ? ["my-work"] : []), "drafts", "in-approval", "in-payment", "all",
  ].map((key) => ({ key, label: t(`remittance.list.segments.${key}`, { count: data?.segments?.[key] ?? 0 }) }));
  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === segment));

  const card = (key, value, note) => ({
    key, label: t(`remittance.list.kpis.${key}`), value, note, active: kpi === key,
    onClick: () => (kpi === key ? update({ kpi: null }) : update({ kpi: key, segment: "all", status: null, week: week || "all" })),
  });
  const cards = kpis ? [
    card("to-submit", kpis.toSubmit.count, money(kpis.toSubmit.amount)),
    card("awaiting-approval", kpis.awaitingApproval.count, money(kpis.awaitingApproval.amount)),
    card("approved-not-paid", kpis.approvedNotPaid.count, kpis.approvedNotPaid.count ? t("remittance.list.kpis.oldest", { count: kpis.approvedNotPaid.oldestDays }) : " "),
    card("overdue", kpis.overdue.count, money(kpis.overdue.amount)),
  ] : KPIS.map((key) => ({ key, label: t(`remittance.list.kpis.${key}`), value: null }));

  const download = (path, name) => remittanceService.download(path, name)
    .catch((e) => toast.current?.show({ severity: "error", summary: t("remittance.record.downloadFailed"), detail: e.message, life: 6000 }));

  const overflow = [
    ...(canWrite ? [{ code: "run-now", label: t("remittance.list.overflow.run-now"), allowed: true }] : []),
    { code: "run-history", label: t("remittance.list.overflow.run-history"), allowed: true },
    { code: "import-history", label: t("remittance.list.overflow.import-history"), allowed: true },
    { code: "export", label: t("remittance.list.overflow.export"), allowed: true },
  ];
  const weekly = schedules.find((s) => s.isActive) || schedules[0] || null;
  const onOverflow = (action) => {
    if (action.code === "run-now") setRunNow(true);
    if (action.code === "run-history") setHistory(weekly);
    if (action.code === "import-history") setImports(true);
    if (action.code === "export") {
      const { page: _p, perPage: _pp, ...filters } = params;
      download(remittanceService.exportRegisterPath(filters), `remittances-${segment}.xlsx`);
    }
  };

  const headerActions = canWrite ? (
    <div className="rm-header-actions">
      <Button type="button" label={selection.length ? t("remittance.list.submitSelected", { count: selection.length }) : t("remittance.list.selectDrafts")}
        disabled={!selection.length} onClick={() => submitRows(selection)} />
      <Button type="button" label={t("remittance.list.import")} outlined onClick={() => update({ import: "new", page: state.page })} />
      <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={onOverflow} />
    </div>
  ) : (
    <div className="rm-header-actions">
      <StatusChip label={t("remittance.common.viewOnly")} severity="secondary" />
      <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={onOverflow} />
    </div>
  );

  const rowActions = (row) => (row.actions || []).filter((a) => a.code !== "open-voucher" || canOpen(a.link));
  const actionLabel = (a) => t(`remittance.list.actions.${a.code}`, { defaultValue: a.label });
  const onRowAction = (row) => (action) => {
    if (action.code === "view" || action.code === "open-voucher") navigate(action.link || row.link);
    else if (action.code === "submit") submitRows([row]);
    else if (DOWNLOADS.includes(action.code)) download(action.href, action.href.split("/").pop());
  };

  const drafts = submittable(rows);
  const ticked = (row) => selection.some((r) => r.id === row.id);
  const tick = (row, on) => setSelection((cur) => (on ? [...cur.filter((r) => r.id !== row.id), row] : cur.filter((r) => r.id !== row.id)));
  const allTicked = drafts.length > 0 && drafts.every(ticked);
  const selectColumn = canWrite ? (
    <Column frozen style={{ width: "3rem" }}
      header={drafts.length ? <Checkbox checked={allTicked} onChange={(e) => setSelection(e.checked ? drafts : [])} aria-label={t("remittance.list.selectAll")} /> : null}
      body={(r) => (submitAction(r) ? <Checkbox checked={ticked(r)} onChange={(e) => tick(r, e.checked)} aria-label={t("remittance.list.select", { reference: r.remittanceNo })} /> : null)} />
  ) : null;

  const coverage = (r) => {
    if (r.flags?.offCycle) {
      return <span title={r.offCycleReason?.text || undefined}><StatusChip label={t("remittance.flags.offCycle")} severity="info" /></span>;
    }
    return <span className="rm-nowrap rm-muted">{weekText(r.coverageWeek) || "-"}</span>;
  };
  // the coverage week under the reference, the due date under the amount and the product line under the insurer keep
  // the Next step column on screen at a laptop width
  const insurer = (r) => (
    <span className="rm-cell-stack">
      <span>{r.insurer?.shortName || "-"}</span>
      {r.productLine ? <span className="rm-muted">{r.productLine}</span> : null}
    </span>
  );
  const policies = (r) => (
    <span className="rm-num">{r.heldCount ? t("remittance.list.policiesHeld", { count: r.policyCount, held: r.heldCount }) : r.policyCount}</span>
  );
  const dueDate = (r) => (r.overdue
    ? <span className="rm-nowrap rm-overdue">{t("remittance.list.overdueOn", { date: formatDate(r.dueDate) })}</span>
    : <span className="rm-nowrap rm-muted">{r.dueDate ? t("remittance.list.dueOn", { date: formatDate(r.dueDate) }) : "-"}</span>);
  const status = (r) => (
    <span className="rm-status-cell">
      <StatusChip {...statusChip(r.status, r.statusLabel)} />
      {r.flags?.openExceptions ? <StatusChip label={t("remittance.list.exceptions", { count: r.flags.openExceptions })} severity="warning" /> : null}
    </span>
  );
  const nextStep = (r) => {
    const result = results.get(r.id);
    return (
      <span className="rm-next-step">
        <span>{r.nextStep?.label || "-"}</span>
        {result ? (
          <span className={`rm-row-result rm-row-result--${result.ok ? "ok" : "refused"}`} role="status">
            {result.ok ? t("remittance.list.submit.submitted") : result.message}
          </span>
        ) : null}
      </span>
    );
  };

  const weekLabel = week ? weekText(weekOf(week)) : null;
  const empty = () => {
    if (segment === "my-work") {
      return <div className="rm-empty">{strip?.nextRun ? t("remittance.list.empty.myWorkNext", { next: strip.nextRun.text }) : t("remittance.list.empty.myWork")}</div>;
    }
    if (segment === "all" && weekLabel && !kpi) {
      return (
        <div className="rm-empty">
          <span>{t("remittance.list.empty.week", { week: weekLabel })}</span>
          {canWrite ? <Button type="button" link size="small" label={t("remittance.list.overflow.run-now")} onClick={() => setRunNow(true)} /> : null}
        </div>
      );
    }
    return <div className="rm-empty">{t(`remittance.list.empty.${segment}`)}</div>;
  };

  const sort = sortOf(state.sort);
  const show = (key) => extra.includes(key);
  const chooseColumns = (value) => {
    setExtra(value);
    saveColumns(value);
  };
  const weeks = useMemo(() => recentWeeks(today), [today]);
  const weekOptions = [{ label: t("remittance.list.filters.allWeeks"), value: "all" }, ...weeks.map((w) => ({ label: weekText(w), value: w.from }))];
  const insurerOptions = [{ label: t("remittance.list.filters.allInsurers"), value: "" }, ...insurers.map((i) => ({ label: i.label, value: String(i.id) }))];
  const lineOptions = [{ label: t("remittance.list.filters.allLines"), value: "" }, ...PRODUCT_LINES.map((l) => ({ label: t(`remittance.list.productLines.${l}`, { defaultValue: l }), value: l }))];
  const statusOptions = [{ label: t("remittance.list.filters.allStatuses"), value: "" }, ...STATUSES.map((s) => ({ label: t(`remittance.list.statuses.${s}`), value: s }))];
  const sourceOptions = [{ label: t("remittance.list.filters.allSources"), value: "" }, ...SOURCES.map((s) => ({ label: t(`remittance.list.sources.${s}`), value: s }))];
  const columnOptions = HIDDEN_COLUMNS.map((c) => ({ label: t(`remittance.list.columns.${c}`), value: c }));

  return (
    <div className="rm-page">
      <Toast ref={toast} />
      <PageHeader title={t("remittance.list.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.list.title")]} help={t("remittance.list.help")} actions={headerActions} />

      <RunStrip strip={strip} schedules={schedules} canWrite={canWrite} onRunHistory={setHistory} />
      <StatCards items={cards} />
      <TabMenu model={segments.map((s) => ({ label: s.label, command: () => setSegment(s.key) }))} activeIndex={activeIndex} className="rm-tabs" />

      <div className="rm-filters">
        <Dropdown value={week || "all"} options={weekOptions} onChange={(e) => update({ week: e.value })} aria-label={t("remittance.list.filters.week")} />
        <Dropdown value={state.insurerId || ""} options={insurerOptions} onChange={(e) => update({ insurerId: e.value })} filter aria-label={t("remittance.list.filters.insurer")} />
        <Dropdown value={state.productLine || ""} options={lineOptions} onChange={(e) => update({ productLine: e.value })} aria-label={t("remittance.list.filters.productLine")} />
        {segment === "all" ? (
          <Dropdown value={state.status || ""} options={statusOptions} onChange={(e) => update({ status: e.value })} aria-label={t("remittance.list.filters.status")} />
        ) : null}
        <Dropdown value={state.source || ""} options={sourceOptions} onChange={(e) => update({ source: e.value })} aria-label={t("remittance.list.filters.source")} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("remittance.list.filters.search")} aria-label={t("remittance.list.filters.search")} />
        </span>
        <MultiSelect value={extra} options={columnOptions} onChange={(e) => chooseColumns(e.value || [])} className="rm-filters__columns"
          placeholder={t("remittance.list.columnChooser")} selectedItemsLabel={t("remittance.list.columnsChosen", { count: extra.length })} maxSelectedLabels={0}
          aria-label={t("remittance.list.columnChooser")} />
      </div>

      <SubmitResults out={submitted} onClose={() => setSubmitted(null)} />

      {error ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.list.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      ) : (
        <div className="rm-card bv-loading-host">
          <LoadingBar active={refreshing} />
          <DataTable value={rows} dataKey="id" size="small" scrollable className="rm-table" loading={loading && !data} emptyMessage={empty()}
            lazy paginator={(data?.total || 0) > PER_PAGE} rows={PER_PAGE} first={(page - 1) * PER_PAGE} totalRecords={data?.total || 0}
            onPage={(e) => update({ page: String(e.page + 1) })} sortField={sort.sortField} sortOrder={sort.sortOrder}
            onSort={(e) => update({ sort: sortParam(e.sortField, e.sortOrder) })}>
            {selectColumn}
            <Column header={t("remittance.list.columns.remittanceNo")} sortable sortField="remittanceNo" frozen style={{ minWidth: "9.5rem" }}
              body={(r) => <span className="rm-cell-stack"><Link to={r.link} className="rm-ref">{r.remittanceNo}</Link>{coverage(r)}</span>} footer={t("remittance.list.total", { count: data?.totals?.count ?? 0 })} />
            <Column header={t("remittance.list.columns.insurer")} sortable sortField="insurer" body={insurer} />
            {show("basis") ? <Column header={t("remittance.list.columns.basis")} body={(r) => r.basisLabel || "-"} /> : null}
            <Column header={t("remittance.list.columns.policies")} sortable sortField="policies" body={policies} align="right" />
            <Column header={t("remittance.list.columns.dueToInsurer")} sortable sortField="dueToInsurer" align="right"
              body={(r) => <span className="rm-cell-stack rm-cell-stack--end"><span className="rm-num">{money(r.dueToInsurer)}</span>{dueDate(r)}</span>}
              footer={data ? <span className="rm-num">{money(data.totals?.dueToInsurer)}</span> : null} />
            <Column header={t("remittance.list.columns.status")} sortable sortField="status" body={status} />
            <Column header={t("remittance.list.columns.nextStep")} body={nextStep} className="rm-col-next" />
            {show("source") ? <Column header={t("remittance.list.columns.source")} body={(r) => r.source?.label || "-"} /> : null}
            {show("voucherNo") ? <Column header={t("remittance.list.columns.voucherNo")} body={(r) => r.voucher?.number || "-"} /> : null}
            {show("paidOn") ? <Column header={t("remittance.list.columns.paidOn")} body={(r) => dayOf(r.paidOn)} /> : null}
            {show("bankRef") ? <Column header={t("remittance.list.columns.bankRef")} body={(r) => r.bankReference || "-"} /> : null}
            {show("submittedBy") ? <Column header={t("remittance.list.columns.submittedBy")} body={(r) => r.submittedBy?.name || "-"} /> : null}
            {show("createdOn") ? <Column header={t("remittance.list.columns.createdOn")} body={(r) => dayOf(r.createdAt)} /> : null}
            <Column header={<span className="p-sr-only">{t("remittance.list.columns.actions")}</span>} align="center" style={{ width: "3.5rem" }}
              body={(r) => <RowActions label={t("remittance.list.actionsFor", { reference: r.remittanceNo })} actions={rowActions(r)} labelOf={actionLabel} onAction={onRowAction(r)} />} />
          </DataTable>
        </div>
      )}

      <RunNowDialog visible={runNow} scheduleId={weekly?.id ?? null} schedules={schedules.filter((s) => s.isActive)} onHide={() => setRunNow(false)} onDone={refresh} />
      <RunHistoryPanel visible={!!history} schedule={history} onHide={() => setHistory(null)} />
      <ImportHistory visible={imports} onHide={() => setImports(false)} onView={(id) => { setImports(false); update({ import: id, page: state.page }); }} />
      <ImportPolicyList importId={state.import || null} onHide={() => update({ import: null, page: state.page })} onOpen={(id) => update({ import: id, page: state.page })}
        onChanged={refresh} onGoToDrafts={() => update({ import: null, segment: "drafts", kpi: null, status: null })} />
    </div>
  );
};

export default Remittances;
