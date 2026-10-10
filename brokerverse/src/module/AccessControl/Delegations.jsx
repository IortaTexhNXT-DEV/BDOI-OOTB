import React, { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { hasPermission } from "../../utils/canOpen";
import DelegationPanel from "./DelegationPanel";
import { useChangeActions } from "./AccessChanges";
import { DELEGATION_WORDS, VIEWS, filterDelegations, inView, viewCounts } from "./delegations";
import {
  EmptyState, LoadError, StatusTag, TechnicalSwitch, TwoLines, download, shortDate, useDepartmentOptions, useDirectory, useLabels, useQueryState, useTechnicalNames,
} from "./common";
import "../Administration/index.scss";
import "./index.scss";

/**
 * Master > Users and Access > Delegations: cover for an approver who is away. Views Current and upcoming, Waiting for
 * approval, Ended and All (?view), filters by person, department and transaction; a row opens the delegation
 * (?delegation=<key>, or ?change=<id> from My Work and the notifications). A new delegation waits for another
 * administrator's approval. Exports to Excel for audit.
 */
const Delegations = () => {
  const k = useLabels();
  const [params, set] = useQueryState();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "current";
  const { allowed, technical, setTechnical } = useTechnicalNames();
  const { data: directory } = useDirectory();
  const loader = useCallback(() => accessControlService.delegations({ view: "all" }), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const menu = useRef(null);
  const [menuRow, setMenuRow] = useState(null);
  const [panel, setPanel] = useState(null);
  const edit = hasPermission("write:access-control");
  const departments = useDepartmentOptions(directory);
  const changeActions = useChangeActions(reload);

  const all = useMemo(() => data?.rows || [], [data]);
  const counts = useMemo(() => viewCounts(all), [all]);
  const filters = { search: params.get("q") || "", department: params.get("dept"), type: params.get("type") };
  const rows = filterDelegations(inView(all, view), filters);
  const types = useMemo(() => {
    const seen = new Map();
    all.forEach((d) => d.transactionTypes.forEach((code, i) => seen.set(code, d.transactionNames[i] || code)));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [all]);

  const opened = params.get("change") ? all.find((d) => d.changeId === Number(params.get("change"))) : all.find((d) => d.key === params.get("delegation"));
  const target = panel || (opened ? { mode: "view", row: opened } : null);
  const open = (row) => set({ delegation: row.key, change: null });
  const close = () => {
    setPanel(null);
    set({ delegation: null, change: null });
  };
  const done = async (nextView) => {
    await reload();
    if (nextView) set({ view: nextView === "current" ? null : nextView });
  };

  const status = (s) => k(`delegation.status.${s}`, DELEGATION_WORDS[s] || s);
  const viewWords = { current: k("delegation.viewCurrent", "Current and upcoming"), pending: k("changes.waiting", "Waiting for approval"), ended: k("delegation.viewEnded", "Ended"),
    all: k("delegation.viewAll", "All") };
  const empty = {
    current: <EmptyState icon="pi pi-calendar" text={k("noDelegations", "No delegation in effect or planned")}
      action={edit ? <Button label={k("newDelegation", "New delegation")} icon="pi pi-plus" text onClick={() => setPanel({ mode: "new" })} /> : null} />,
    pending: <EmptyState icon="pi pi-check-circle" text={k("changes.noneWaiting", "Nothing is waiting for approval")} />,
    ended: <EmptyState icon="pi pi-history" text={k("delegation.noEnded", "No ended delegation")} />,
    all: <EmptyState icon="pi pi-calendar" text={k("noDelegations", "No delegation in effect or planned")} />,
  };
  const filtered = !!(filters.search || filters.department || filters.type);

  const menuItems = menuRow ? [
    { label: k("delegation.view", "View"), icon: "pi pi-eye", command: () => open(menuRow) },
    ...(menuRow.change?.canDecide ? [{ label: k("approve", "Approve"), icon: "pi pi-check", command: () => changeActions.approve(menuRow.change) },
      { label: k("reject", "Reject"), icon: "pi pi-times", command: () => changeActions.reject(menuRow.change) }] : []),
    ...(menuRow.change?.canWithdraw && menuRow.status === "pending" ? [{ label: k("withdraw", "Withdraw"), icon: "pi pi-undo", command: () => changeActions.withdraw(menuRow.change) }] : []),
    ...(menuRow.canEnd ? [{ label: k("delegation.endEarly", "End early"), icon: "pi pi-stop-circle", command: () => open(menuRow) }] : []),
  ] : [];

  const actions = (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined disabled={!data}
        onClick={() => download(() => accessControlService.downloadDelegations({ view, technical: technical ? 1 : undefined }))} />
      {edit ? <Button label={k("newDelegation", "New delegation")} icon="pi pi-plus" onClick={() => setPanel({ mode: "new" })} /> : null}
      <TechnicalSwitch allowed={allowed} technical={technical} onChange={setTechnical} id="dlg-technical" />
    </>
  );

  return (
    <div className="admin__page access__page rp-page access-page">
      <PageHeader title={k("delegationsTitle", "Delegations")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("delegationsTitle", "Delegations")]} actions={actions}
        help={k("delegation.help", "Cover for an approver who is away: the person covering approves with the approver's limit for the chosen transactions and dates, once another administrator approves the delegation.")} />
      <TabView className="bv-tabbar rp-tabs" activeIndex={VIEWS.indexOf(view)} onTabChange={(e) => set({ view: VIEWS[e.index] === "current" ? null : VIEWS[e.index] })}>
        {VIEWS.map((v) => (
          <TabPanel key={v} header={(
            <span className="rp-tab">
              {viewWords[v]}
              {data ? <Badge value={counts[v]} severity={v === "pending" && counts[v] ? "warning" : "secondary"} className="rp-tab__badge" /> : null}
            </span>
          )} />
        ))}
      </TabView>
      <div className="rp-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <div className="rp-toolbar rp-toolbar--wrap">
          <span className="p-input-icon-left rp-search">
            <i className="pi pi-search" />
            <InputText value={filters.search} onChange={(e) => set({ q: e.target.value })} placeholder={k("delegation.search", "Find a person")} aria-label={k("delegation.search", "Find a person")} />
          </span>
          <Dropdown value={filters.department} options={departments} onChange={(e) => set({ dept: e.value })} showClear placeholder={k("uam.allDepartments", "All departments")}
            aria-label={k("colDepartment", "Department")} className="access-filter" />
          <Dropdown value={filters.type} options={types} onChange={(e) => set({ type: e.value })} showClear placeholder={k("allTransactions", "All transactions")}
            aria-label={k("colTransactions", "Transactions")} className="access-filter" />
        </div>
        <LoadError error={error} onRetry={reload} />
        <DataTable value={rows} dataKey="key" loading={loading} paginator={rows.length > 20} rows={20} size="small" className="rp-table access-table" scrollable
          onRowClick={(e) => open(e.data)} rowClassName={(d) => `access-row--click${opened?.key === d.key ? " access-row--focus" : ""}`}
          emptyMessage={filtered ? <EmptyState icon="pi pi-filter-slash" text={k("delegation.noMatch", "No delegation matches the filters")}
            action={<Button label={k("uam.clearFilters", "Clear filters")} text onClick={() => set({ q: null, dept: null, type: null })} />} /> : empty[view]}>
          <Column header={k("colDelegator", "Approver away")} body={(d) => <TwoLines main={d.delegatorName} sub={d.delegatorDepartment} />} />
          <Column header={k("colDelegate", "Covered by")} body={(d) => <TwoLines main={d.delegateName} sub={d.delegateDepartment} />} />
          <Column header={k("colTransactions", "Transactions")} body={(d) => (
            <div className="access-chips">
              {d.transactionNames.map((n, i) => (
                <span key={n} className="access-chip-stack">
                  <Tag value={n} className="rp-tag-muted" />
                  {technical && d.transactionTypes[i] ? <span className="rp-code">{d.transactionTypes[i]}</span> : null}
                </span>
              ))}
            </div>
          )} />
          <Column header={k("colPeriod", "Period")} sortable sortField="dateFrom" body={(d) => (
            <TwoLines main={`${shortDate(d.dateFrom)} – ${shortDate(d.dateTo)}`} sub={[k("delegation.days", "{{count}} days", { count: d.days }), d.reason].filter(Boolean).join(" · ")} />
          )} />
          <Column header={k("colStatus", "Status")} body={(d) => (
            <TwoLines main={<StatusTag status={d.status} label={status(d.status)} />}
              sub={d.approvedBy ? k("authority.approvedByName", "Approved by {{name}}", { name: d.approvedBy }) : k("delegation.requestedByName", "Requested by {{name}}", { name: d.requestedBy || "" })} />
          )} />
          <Column header="" className="bv-actions" body={(d) => (
            <Button icon="pi pi-ellipsis-v" text rounded aria-haspopup="menu" aria-label={k("delegation.actions", "Actions for {{ref}}", { ref: d.ref })}
              onClick={(e) => { e.stopPropagation(); setMenuRow(d); menu.current?.toggle(e); }} />
          )} />
        </DataTable>
        <Menu ref={menu} popup model={menuItems} />
      </div>
      <DelegationPanel target={target} onHide={close} onDone={done} />
    </div>
  );
};

export default Delegations;
