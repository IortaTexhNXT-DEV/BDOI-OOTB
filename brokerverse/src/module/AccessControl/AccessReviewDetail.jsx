import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import StatCards from "../../components/StatCards";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { confirmAction, notifyError, notifySuccess, notifyWarn } from "../../utility/dialogs";
import { PendingBlock } from "./AccessChanges";
import ReviewDecisionPanel from "./ReviewDecisionPanel";
import { OTHER, OUTCOMES, OUTCOME_WORDS, STATUS_WORDS, filterItems, keepable, nextToReview, sortItems } from "./accessReviews";
import {
  EmptyState, LoadError, TechnicalSwitch, TwoLines, dateTime, download, severityOf, shortDate, useAccessNames, useLabels, useQueryState, useTechnicalNames,
} from "./common";

const REVIEWS = "/master/generals/usermanagement/access-reviews";

/**
 * One access review: stat cards (users, to review, keep, remove roles, deactivate, due), the users grouped by
 * department with their outcome and removal state, filters in the address (?q, dept, outcome, todo), bulk Keep,
 * Submit for sign-off (Close review with the approval off), and for a review waiting for sign-off the approval block
 * (Sign off / Return / Withdraw). A row opens the decision panel.
 */
const AccessReviewDetail = ({ id, directory, onBack }) => {
  const k = useLabels();
  const names = useAccessNames();
  const [params, set] = useQueryState();
  const { allowed, technical, setTechnical } = useTechnicalNames();
  const loader = useCallback(() => accessControlService.review(id), [id]);
  const { data, loading, refreshing, error, reload, setData } = useStableLoad(loader);
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);

  const review = data && data.id === id ? data : null;
  const departments = useMemo(() => directory?.departments || [], [directory]);
  const items = useMemo(() => sortItems(review?.items || [], departments), [review, departments]);
  const filters = { search: params.get("q") || "", department: params.get("dept"), outcome: OUTCOMES.includes(params.get("outcome")) || params.get("outcome") === "pending"
    ? params.get("outcome") : null, toReview: params.get("todo") === "1" };
  const rows = filterItems(items, filters);
  const openItem = items.find((i) => i.id === openId) || null;
  const words = (o) => k(`review.outcome.${o}`, OUTCOME_WORDS[o]);
  const groupLabel = (g) => (g === OTHER ? k("otherRoles", "Other roles") : names.group({ key: g, label: g }));

  const saved = async (next, fromId) => {
    setData(next);
    const after = fromId ? nextToReview(sortItems(next.items, departments), fromId) : null;
    setOpenId(after ? after.id : null);
  };
  const run = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      notifySuccess(r.message);
      await reload();
      return r;
    } catch (e) {
      notifyError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const keepSelected = async () => {
    const ids = selected.map((i) => i.id);
    const left = selected.length - keepable(selected).length;
    if (!(await confirmAction(k("review.keepConfirm", "Keep the access of {{count}} users?", { count: ids.length })
      + (left ? ` ${k("review.keepLeft", "{{count}} need a note or may not be decided by you: they are left out.", { count: left })}` : ""),
    { header: k("review.keepSelected", "Keep selected"), acceptLabel: k("keep", "Keep"), rejectLabel: k("cancel", "Cancel") }))) return;
    const r = await run(() => accessControlService.keepReviewItems(id, ids));
    if (r?.data?.skipped?.length) notifyWarn(r.data.skipped.map((x) => `${x.name}: ${x.reason}`).join("\n"));
    setSelected([]);
  };
  const submit = async () => {
    if (!(await confirmAction(k("review.submitConfirm", "Send the review for sign-off? Its removals apply when another administrator signs it off."),
      { header: k("review.submit", "Submit for sign-off"), acceptLabel: k("review.submit", "Submit for sign-off"), rejectLabel: k("cancel", "Cancel") }))) return;
    await run(() => accessControlService.submitReview(id));
  };
  const close = async () => {
    if (!(await confirmAction(k("review.closeConfirm", "Close the review? Every user is decided."),
      { header: k("closeReview", "Close review"), acceptLabel: k("closeReview", "Close review"), rejectLabel: k("cancel", "Cancel") }))) return;
    await run(() => accessControlService.closeReview(id));
  };

  const card = (key, label, value, outcome) => ({ key, label, value: review ? value : null, onClick: () => set({ outcome: filters.outcome === outcome ? null : outcome, todo: null }),
    active: filters.outcome === outcome });
  const cards = [
    { key: "users", label: k("review.statUsers", "Users"), value: review ? review.users : null, onClick: () => set({ outcome: null, todo: null }), active: !filters.outcome },
    card("todo", k("review.statToReview", "To review"), review?.pending, "pending"),
    card("keep", words("keep"), review?.kept, "keep"),
    card("remove", words("remove-roles"), review?.removeRoles, "remove-roles"),
    card("deactivate", words("deactivate"), review?.deactivate, "deactivate"),
    { key: "due", label: k("colDue", "Due"), value: review ? shortDate(review.dueDate) : null, note: review?.overdue ? k("review.overdue", "Overdue") : null },
  ];

  const actions = review ? (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined
        onClick={() => download(() => accessControlService.downloadReview(id, { technical: technical ? 1 : undefined }))} />
      {review.canSubmit ? <Button label={k("review.submit", "Submit for sign-off")} icon="pi pi-send" onClick={submit} loading={busy} /> : null}
      {review.canClose ? <Button label={k("closeReview", "Close review")} icon="pi pi-check" onClick={close} loading={busy} /> : null}
      <TechnicalSwitch allowed={allowed} technical={technical} onChange={setTechnical} id="rv-technical" />
    </>
  ) : null;

  const removalCell = (i) => {
    if (i.removalState === "applied") return <TwoLines main={<StatusChip code="closed" severity={severityOf("closed")} label={k("review.appliedShort", "Applied {{date}}", { date: shortDate(i.appliedAt) })} />} sub={i.applyNote} />;
    if (i.removalState === "waiting") return <StatusChip code="pending" severity={severityOf("pending")} label={review.approval ? k("review.waitingSignoff", "Waiting for sign-off") : k("review.notApplied", "Not applied")} />;
    return null;
  };
  const outcomeCell = (i) => (
    <TwoLines main={<span className="access-chips">
      <Tag value={i.decision === "remove-roles" ? `${words(i.decision)}: ${i.removeRoleNames.join(", ")}` : words(i.decision)}
        severity={{ pending: undefined, keep: "success", "remove-roles": "warning", deactivate: "danger" }[i.decision]} className={i.decision === "pending" ? "rp-tag-muted" : ""} />
      {removalCell(i)}
    </span>} sub={[i.remarks, i.decidedBy ? `${i.decidedBy} · ${shortDate(i.decidedAt)}` : null].filter(Boolean).join(" · ")} />
  );

  if (!review) {
    return (
      <div className="admin__page access__page rp-page access-page">
        <PageHeader title={k("reviewsTitle", "Access Reviews")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
          trail={[{ label: k("reviewsTitle", "Access Reviews"), to: REVIEWS }]} onBack={onBack} />
        <LoadError error={error} onRetry={reload} />
        {loading ? <div role="status" aria-busy="true">{Array.from({ length: 6 }, (_, n) => <Skeleton key={n} height="3rem" className="mb-2" />)}</div> : null}
      </div>
    );
  }

  return (
    <div className="admin__page access__page rp-page access-page">
      <PageHeader title={review.name} home={k("master", "Master")} section={k("userManagement", "Users and Access")} onBack={onBack} actions={actions}
        trail={[{ label: k("reviewsTitle", "Access Reviews"), to: REVIEWS }, review.name]}
        help={review.approval ? k("review.detailHelp", "Decide each user; removals wait for sign-off by another administrator.")
          : k("review.detailHelpNoApproval", "Decide each user; removals apply when they are decided.")} />
      <div className="access-review-facts">
        <StatusChip code={review.status} severity={severityOf(review.status)} label={k(`review.status.${review.status}`, STATUS_WORDS[review.status])} />
        {review.overdue ? <Tag severity="danger" value={k("review.overdue", "Overdue")} /> : null}
        <span className="rp-muted">{review.scopeText} · {k("review.startedBy", "Started by {{name}} on {{date}}", { name: review.createdBy, date: dateTime(review.createdAt) })}</span>
        {review.signedOffBy ? <span className="rp-muted">{k("review.signedOff", "Signed off by {{name}} on {{date}}", { name: review.signedOffBy, date: dateTime(review.signedOffAt) })}</span> : null}
      </div>
      {review.change && review.change.status === "pending" ? (
        <PendingBlock change={review.change} title={k("review.waitingSignoff", "Waiting for sign-off")} onDone={reload}
          approveLabel={k("review.signOff", "Sign off")} rejectLabel={k("review.return", "Return")} />
      ) : null}
      {review.change && review.change.status === "rejected" && review.status === "open" ? (
        <p className="am-panel__note">{k("review.returned", "Returned by {{name}}: {{remarks}}", { name: review.change.decidedBy, remarks: review.change.decisionRemarks })}</p>
      ) : null}
      <StatCards items={cards} className="access-stats" />
      <div className="rp-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <div className="rp-toolbar rp-toolbar--wrap">
          <span className="p-input-icon-left rp-search">
            <i className="pi pi-search" />
            <InputText value={filters.search} onChange={(e) => set({ q: e.target.value })} placeholder={k("uam.search", "Find a user")} aria-label={k("uam.search", "Find a user")} />
          </span>
          <Dropdown value={filters.department} showClear placeholder={k("uam.allDepartments", "All departments")} aria-label={k("colDepartment", "Department")} className="access-filter"
            options={[...departments.map((d) => ({ value: d.name, label: groupLabel(d.name) })), { value: OTHER, label: groupLabel(OTHER) }]} onChange={(e) => set({ dept: e.value })} />
          <Dropdown value={filters.outcome} showClear placeholder={k("review.allOutcomes", "All outcomes")} aria-label={k("review.colOutcome", "Outcome")} className="access-filter"
            options={["pending", ...OUTCOMES].map((o) => ({ value: o, label: words(o) }))} onChange={(e) => set({ outcome: e.value })} />
          <span className="rp-check">
            <Checkbox inputId="rv-todo" checked={filters.toReview} onChange={(e) => set({ todo: e.checked ? "1" : null })} />
            <label htmlFor="rv-todo">{k("review.onlyToReview", "Only users to review")}</label>
          </span>
          {review.status === "open" && selected.length ? (
            <Button label={k("review.keepSelectedCount", "Keep selected ({{count}})", { count: selected.length })} icon="pi pi-check" outlined onClick={keepSelected} loading={busy} />
          ) : null}
        </div>
        <LoadError error={error} onRetry={reload} />
        <DataTable value={rows} dataKey="id" size="small" className="rp-table access-table" scrollable rowGroupMode="subheader" groupRowsBy="group"
          rowGroupHeaderTemplate={(i) => <strong className="access-group">{groupLabel(i.group)}</strong>}
          selectionMode={review.status === "open" ? "checkbox" : null} selection={selected} onSelectionChange={(e) => setSelected(e.value)}
          isDataSelectable={(e) => !!e.data?.canDecide} onRowClick={(e) => setOpenId(e.data.id)} rowClassName={() => "access-row--click"}
          emptyMessage={<EmptyState icon="pi pi-filter-slash" text={k("noUsers", "No user matches the filters")}
            action={<Button label={k("uam.clearFilters", "Clear filters")} text onClick={() => set({ q: null, dept: null, outcome: null, todo: null })} />} />}>
          {review.status === "open" ? <Column selectionMode="multiple" style={{ width: "3rem" }} /> : null}
          <Column header={k("colUser", "User")} body={(i) => <TwoLines main={<strong>{i.displayName}</strong>} sub={[i.username, i.designation].filter(Boolean).join(" · ")} />} />
          <Column header={k("review.rolesAtStart", "Roles at start")} body={(i) => (
            <span className="rp-cell-stack">
              <span>{i.roleNamesAtStart.join(", ") || "—"}</span>
              {technical ? <span className="rp-code">{i.rolesAtStart.join(", ")}</span> : null}
              {i.rolesChanged ? <Tag severity="info" value={k("review.rolesChanged", "Roles changed since the start")} title={i.roleNamesNow.join(", ")} /> : null}
            </span>
          )} />
          <Column header={k("colLastSignIn", "Last sign-in")} body={(i) => (
            <TwoLines main={i.lastLoginAt ? shortDate(i.lastLoginAt) : k("never", "Never")}
              sub={i.dormant ? <span className="access-warn">{k("dormantFor", "Dormant {{days}} days", { days: i.daysSinceLogin })}</span> : null} />
          )} />
          <Column header={k("colSod", "Segregation of duties")} body={(i) => (i.conflicts.length ? (
            <span title={i.conflicts.map((c) => c.ruleName).join(", ")}>
              {i.openConflicts ? <Tag severity="warning" value={k("review.openConflicts", "{{count}} open", { count: i.openConflicts })} />
                : <Tag className="rp-tag-muted" value={k("review.acceptedConflicts", "{{count}} accepted", { count: i.conflicts.length })} />}
            </span>
          ) : <span className="rp-muted">—</span>)} />
          <Column header={k("review.colOutcome", "Outcome")} body={outcomeCell} style={{ minWidth: "16rem" }} />
          <Column header="" className="bv-actions" body={(i) => (i.blocked ? (
            <i className="pi pi-lock rp-muted" title={i.blocked === "own" ? k("review.blockedOwn", "You cannot review your own access.")
              : k("review.blockedAdmin", "An administrator account is decided by a System Administrator.")} aria-hidden="true" />
          ) : null)} />
        </DataTable>
      </div>
      <ReviewDecisionPanel review={review} item={openItem} onHide={() => setOpenId(null)} onSaved={saved} />
    </div>
  );
};

AccessReviewDetail.propTypes = { id: PropTypes.number.isRequired, directory: PropTypes.object, onBack: PropTypes.func.isRequired };

export default AccessReviewDetail;
