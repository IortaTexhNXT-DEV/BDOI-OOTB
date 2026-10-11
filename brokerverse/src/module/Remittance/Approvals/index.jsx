import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabMenu } from "primereact/tabmenu";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import PageActions from "../../../components/PageActions";
import LoadingBar from "../../../components/LoadingBar";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { canOpen } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { formatInstant } from "../../../utility/dateFormat";
import { REMITTANCE_ROUTES, loadInsurerOptions, money, useUrlState } from "../shared";
import { authorityChips, canDecideText } from "./decisions";
import ReviewPanel from "./ReviewPanel";
import "../remittance.scss";

export const VIEWS = ["mine", "submitted", "all", "decided"];
const PER_PAGE = 50;
const DELEGATIONS = "/master/generals/usermanagement/delegations";
const TYPES = ["remittance", "settlement"];

/** The approval id of a deep link: "21" or "remittance:21". */
export const approvalParam = (value) => (value ? String(value).replace(/^remittance:/, "") : null);

/**
 * Accounts > Remittance > Approvals, the decision inbox. The authority chips, four KPI cards, the segments Awaiting my
 * decision (hidden without authority), Submitted by me, All pending and Decided (30 days), filters, and the table with
 * "Can I decide?" and the next step. Only rows the user can decide can be selected; Approve selected (n) decides each on
 * the server and shows the result per row before the list reloads (there is no bulk reject). A row opens the review
 * panel (?approval=<id> opens it from a link), where the decision is taken.
 */
const Approvals = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [state, update] = useUrlState({ segment: "", type: "", insurerId: "", q: "", page: "1" });
  const [search, setSearch] = useState(state.q || "");
  const [insurers, setInsurers] = useState([]);
  const [selection, setSelection] = useState([]);
  const [results, setResults] = useState(null);
  const view = VIEWS.includes(state.segment) ? state.segment : "mine";
  const page = Math.max(1, Number(state.page) || 1);
  const params = useMemo(() => ({ view, type: state.type || undefined, insurerId: state.insurerId || undefined, q: state.q || undefined, page, perPage: PER_PAGE }),
    [view, state.type, state.insurerId, state.q, page]);
  const loader = useCallback(() => remittanceService.approvalInbox(params), [params]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const rows = data?.data || [];
  const kpis = data?.kpis || null;
  const authority = data?.authority || null;
  const decided = view === "decided";
  const canDecide = !!authority?.canDecide;
  // the tick box is for rows the user can decide: never on Decided or on the user's own submissions
  const selecting = canDecide && (view === "mine" || view === "all");

  useEffect(() => {
    loadInsurerOptions().then(setInsurers).catch(() => setInsurers([]));
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q === (state.q || "")) return undefined;
    const timer = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(timer);
  }, [search, state.q, update]);

  // the default segment once the figures are known: Awaiting my decision when something waits, else Submitted by me
  useEffect(() => {
    if (state.segment || !kpis || !authority) return;
    const mine = canDecide && kpis.awaitingMine.count > 0;
    update({ segment: mine ? "mine" : kpis.submittedByMe.count > 0 ? "submitted" : canDecide ? "mine" : "all" });
  }, [state.segment, kpis, authority, canDecide, update]);

  useEffect(() => {
    setSelection([]);
  }, [params]);

  const decidable = rows.filter((r) => r.decision?.canDecide);
  const setView = (segment) => update({ segment });
  const segments = [
    ...(canDecide ? [{ key: "mine", label: t("remittance.inbox.segments.mine", { count: kpis?.awaitingMine.count ?? 0 }) }] : []),
    { key: "submitted", label: t("remittance.inbox.segments.submitted", { count: kpis?.submittedByMe.count ?? 0 }) },
    { key: "all", label: t("remittance.inbox.segments.all") },
    { key: "decided", label: t("remittance.inbox.segments.decided") },
  ];
  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === view));

  const cards = kpis ? [
    { key: "mine", label: t("remittance.inbox.kpis.mine"), value: kpis.awaitingMine.count, note: money(kpis.awaitingMine.amount), onClick: canDecide ? () => setView("mine") : undefined, active: view === "mine" },
    { key: "late", label: t("remittance.inbox.kpis.pastSla"), value: kpis.pastSla.count,
      note: kpis.pastSla.count ? t("remittance.inbox.kpis.oldest", { hours: kpis.pastSla.oldestHours }) : " " },
    { key: "submitted", label: t("remittance.inbox.kpis.submitted"), value: kpis.submittedByMe.count, note: t("remittance.inbox.kpis.awaitingOthers"),
      onClick: () => setView("submitted"), active: view === "submitted" },
    { key: "decided", label: t("remittance.inbox.kpis.decidedToday"), value: kpis.decidedByMeToday.count,
      note: t("remittance.inbox.kpis.approvedRejected", { approved: kpis.decidedByMeToday.approved, rejected: kpis.decidedByMeToday.rejected }),
      onClick: () => setView("decided"), active: view === "decided" },
  ] : ["mine", "late", "submitted", "decided"].map((key) => ({ key, label: t(`remittance.inbox.kpis.${{ mine: "mine", late: "pastSla", submitted: "submitted", decided: "decidedToday" }[key]}`), value: null }));

  const open = (row) => update({ approval: String(row.id), page: String(page) });
  const close = () => update({ approval: null, page: String(page) });

  const remind = async (row) => {
    try {
      const r = await remittanceService.remindApprovers(row.id);
      toast.current?.show({ severity: "success", summary: t("remittance.inbox.reminded"), detail: r.data?.message || r.message, life: 4000 });
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("remittance.inbox.remindFailed"), detail: e.message, life: 6000 });
    }
    reload();
  };

  const approveSelected = async () => {
    const items = selection.filter((r) => r.decision?.canDecide);
    const total = items.reduce((s, r) => s + Number(r.amount || 0), 0);
    let out = null;
    const done = await openConfirm({
      title: t("remittance.inbox.bulkTitle", { count: items.length }),
      message: t("remittance.inbox.bulkMessage", { count: items.length, amount: money(total) }),
      confirmLabel: t("remittance.inbox.bulkVerb", { count: items.length }),
      onConfirm: async () => {
        out = await remittanceService.decideApprovals({ items: items.map((r) => ({ id: r.id, version: r.version })), action: "approve" });
      },
    });
    if (!done || !out) return;
    const byId = new Map(items.map((r) => [r.id, r]));
    setResults((out.results || []).map((r) => ({ ...r, reference: r.reference || byId.get(r.id)?.reference })));
    setSelection([]);
    reload();
  };

  const overflow = [
    { code: "export", label: t("remittance.inbox.export"), allowed: true },
    ...(canOpen(DELEGATIONS) ? [{ code: "cover", label: t("remittance.inbox.cover"), allowed: true }] : []),
  ];
  const onOverflow = (action) => {
    if (action.code === "cover") navigate(DELEGATIONS);
    if (action.code === "export") {
      const { page: _p, perPage: _pp, ...filters } = params;
      remittanceService.download(remittanceService.approvalExportPath(filters), `approvals-${view}.xlsx`)
        .catch((e) => toast.current?.show({ severity: "error", summary: t("remittance.inbox.exportFailed"), detail: e.message, life: 6000 }));
    }
  };

  const headerActions = (
    <PageActions className="rm-header-actions">
      {selection.length ? <Button type="button" label={t("remittance.inbox.approveSelected", { count: selection.length })} onClick={approveSelected} /> : null}
      <RowActions label={t("remittance.common.moreActions")} actions={overflow} onAction={onOverflow} />
    </PageActions>
  );

  const rowActions = (row) => (row.actions || []).filter((a) => a.code === "view" || a.code === "remind");
  const onRowAction = (row) => (action) => (action.code === "remind" ? remind(row) : open(row));
  const actionLabel = (a) => t(`remittance.inbox.actions.${a.code}`, { defaultValue: a.label });

  // type, product line and the submitter sit under the reference, insurer and name, so Next step stays on screen
  const reference = (row) => (
    <span className="rm-cell-stack">
      <Button type="button" label={row.reference} link className="rm-ref rm-link" onClick={() => open(row)} aria-label={t("remittance.inbox.openReview", { reference: row.reference })} />
      <span className="rm-muted">{row.typeLabel}</span>
    </span>
  );
  const insurer = (row) => (
    <span className="rm-cell-stack">
      <span>{row.insurer?.name || "-"}</span>
      {row.productLine ? <span className="rm-muted">{row.productLine}</span> : null}
    </span>
  );
  const submitted = (row) => (
    <span className="rm-cell-stack">
      <span>{row.submittedBy?.name || "-"}</span>
      <span className="rm-muted">{formatInstant(row.submittedAt)}</span>
      {row.sla ? <StatusChip label={row.sla.label} severity={row.sla.overdue ? "danger" : "secondary"} /> : null}
    </span>
  );
  const amount = (row) => <span className="rm-num">{money(row.amount)}</span>;

  const empty = () => {
    if (view === "mine") {
      return (
        <div className="rm-empty">
          <span>{t("remittance.inbox.empty.mine")}</span>
          {kpis?.submittedByMe.count ? (
            <Button type="button" link size="small" label={t("remittance.inbox.segments.submitted", { count: kpis.submittedByMe.count })} onClick={() => setView("submitted")} />
          ) : null}
        </div>
      );
    }
    return <div className="rm-empty">{t(`remittance.inbox.empty.${view}`)}</div>;
  };

  const chips = authorityChips(authority, t);
  const selectable = decidable.length;
  const typeOptions = [{ label: t("remittance.inbox.allTypes"), value: "" }, ...TYPES.map((v) => ({ label: t(`remittance.inbox.types.${v}`), value: v }))];
  const insurerOptions = [{ label: t("remittance.inbox.allInsurers"), value: "" }, ...insurers.map((i) => ({ label: i.label, value: String(i.id) }))];

  return (
    <div className="rm-page">
      <Toast ref={toast} />
      <PageHeader title={t("remittance.inbox.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.inbox.title")]} help={t("remittance.inbox.help")} actions={headerActions} />

      {/* the authority line is there from the first paint, so the cards and the table do not move when it fills */}
      <div className="rm-strip" aria-label={t("remittance.inbox.authority.label")}>
        {chips.map((c) => <StatusChip key={c.key} label={c.label} severity="secondary" />)}
      </div>

      <StatCards items={cards} />
      <TabMenu model={segments.map((s) => ({ label: s.label, command: () => setView(s.key) }))} activeIndex={activeIndex} className="rm-tabs" />

      <div className="rm-filters">
        <Dropdown value={state.type || ""} options={typeOptions} onChange={(e) => update({ type: e.value })} aria-label={t("remittance.inbox.filters.type")} />
        <Dropdown value={state.insurerId || ""} options={insurerOptions} onChange={(e) => update({ insurerId: e.value })} filter aria-label={t("remittance.inbox.filters.insurer")} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("remittance.inbox.filters.search")} aria-label={t("remittance.inbox.filters.search")} />
        </span>
      </div>

      {results ? (
        <div className="rm-results" role="status">
          <div className="rm-results__head">
            <strong>{t("remittance.inbox.results", { approved: results.filter((r) => r.ok).length, refused: results.filter((r) => !r.ok).length })}</strong>
            <Button type="button" label={t("remittance.common.close")} text size="small" onClick={() => setResults(null)} />
          </div>
          <ul>
            {results.map((r) => (
              <li key={r.id} className={r.ok ? "rm-results__ok" : "rm-results__refused"}>
                <span className="rm-ref">{r.reference || r.id}</span>
                <span>{r.ok ? t("remittance.inbox.resultApproved") : r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error && !data ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.inbox.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      ) : (
        <div className="rm-card bv-loading-host">
          <LoadingBar active={refreshing} />
          {selecting && rows.length ? (
            <p className="rm-selectable">{t("remittance.inbox.selectable", { count: selectable, total: rows.length })}</p>
          ) : null}
          <DataTable value={rows} dataKey="id" size="small" scrollable className="rm-table" loading={loading && !data} emptyMessage={empty()}
            lazy paginator={(data?.total || 0) > PER_PAGE} rows={PER_PAGE} first={(page - 1) * PER_PAGE} totalRecords={data?.total || 0}
            onPage={(e) => update({ page: String(e.page + 1) })}
            selectionMode={selecting ? "checkbox" : null} selection={selection} onSelectionChange={(e) => setSelection((e.value || []).filter((r) => r.decision?.canDecide))}
            isDataSelectable={(e) => !!e.data?.decision?.canDecide}>
            {selecting ? <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} frozen /> : null}
            <Column header={t("remittance.inbox.columns.reference")} body={reference} frozen style={{ minWidth: "10rem" }}
              footer={data ? t("remittance.inbox.total", { count: data.total ?? rows.length }) : null} />
            <Column header={t("remittance.inbox.columns.insurer")} body={insurer} className="rm-col-wrap" />
            <Column header={t("remittance.inbox.columns.amount")} body={amount} align="right" footer={data ? <span className="rm-num">{money(data.totals?.amount)}</span> : null} />
            {!decided ? <Column header={t("remittance.inbox.columns.submittedSla")} body={submitted} /> : null}
            {!decided ? <Column header={t("remittance.inbox.columns.canDecide")} body={(r) => canDecideText(r.decision, t)} className="rm-col-wrap" /> : null}
            {!decided ? <Column header={t("remittance.inbox.columns.nextStep")} body={(r) => r.nextStep?.label || "-"} className="rm-col-next" /> : null}
            {decided ? <Column header={t("remittance.inbox.columns.decision")} body={(r) => <StatusChip code={r.status} label={t(`remittance.inbox.outcomes.${r.status}`, { defaultValue: r.status })} />} /> : null}
            {decided ? <Column header={t("remittance.inbox.columns.by")} body={(r) => r.outcome?.by?.name || "-"} /> : null}
            {decided ? <Column header={t("remittance.inbox.columns.reason")} body={(r) => r.outcome?.reason || "-"} /> : null}
            {decided ? <Column header={t("remittance.inbox.columns.limitAtDecision")} align="right"
              body={(r) => <span className="rm-num">{r.outcome?.limitAtDecision === null || r.outcome?.limitAtDecision === undefined ? "-" : money(r.outcome.limitAtDecision)}</span>} /> : null}
            {decided ? <Column header={t("remittance.inbox.columns.decidedOn")} body={(r) => formatInstant(r.outcome?.decidedAt)} /> : null}
            <Column header={<span className="p-sr-only">{t("remittance.inbox.columns.actions")}</span>} align="center" style={{ width: "3.5rem" }}
              body={(r) => <RowActions label={t("remittance.inbox.actionsFor", { reference: r.reference })} actions={rowActions(r)} labelOf={actionLabel} onAction={onRowAction(r)} />} />
          </DataTable>
        </div>
      )}

      <ReviewPanel approvalId={approvalParam(state.approval)} onHide={close} onDecided={reload} />
    </div>
  );
};

export default Approvals;
