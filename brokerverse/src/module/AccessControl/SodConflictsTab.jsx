import React, { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import accessControlService from "../../services/accessControlService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { DEFAULT_STATES, STATES, STATE_WORDS, filterConflicts } from "./sod";
import { EmptyState, LoadError, TwoLines, severityOf, shortDate, useDepartmentOptions, useLabels, useQueryState } from "./common";

const UAM = "/master/generals/usermanagement/access-matrix";
const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);

/**
 * Tab "Conflicts": every user (active by default) whose roles break an active rule, with the state of the conflict.
 * Filters in the address (?q, user, rule, dept, state, all). Request an exception (not for oneself), end one, open the
 * access of the person.
 */
const SodConflictsTab = ({ state, rules, directory, technical, onException, onChanged }) => {
  const k = useLabels();
  const navigate = useNavigate();
  const [params, set] = useQueryState();
  const menu = useRef(null);
  const [menuRow, setMenuRow] = useState(null);
  const departments = useDepartmentOptions(directory);
  const states = useMemo(() => list(params.get("state")).filter((s) => STATES.includes(s)), [params]);
  const filters = useMemo(() => ({ search: params.get("q") || "", userId: params.get("user"), ruleId: params.get("rule"), department: params.get("dept"),
    states: states.length ? states : DEFAULT_STATES }), [params, states]);
  const rows = useMemo(() => filterConflicts(state.data?.rows || [], filters), [state.data, filters]);
  const words = (s) => k(`sod.state.${s}`, STATE_WORDS[s]);
  const filtered = !!(filters.search || filters.userId || filters.ruleId || filters.department || states.length);

  const endException = async (c) => {
    if (!(await confirmAction(k("sod.endConfirm", "End the exception of {{name}} for {{rule}}? The conflict is open again at once.", { name: c.userName, rule: c.ruleName }),
      { header: k("sod.endException", "End exception"), acceptLabel: k("sod.endException", "End exception"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    try {
      const r = await accessControlService.endSodException(c.exception.id);
      notifySuccess(r.message);
      await onChanged?.();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const menuItems = menuRow ? [
    ...(menuRow.canRequest ? [{ label: k("sod.requestException", "Request exception"), icon: "pi pi-check-square", command: () => onException(menuRow) }] : []),
    ...(menuRow.canEnd ? [{ label: k("sod.endException", "End exception"), icon: "pi pi-times-circle", command: () => endException(menuRow) }] : []),
    ...(menuRow.change ? [{ label: k("sod.openRequest", "Open the request {{ref}}", { ref: menuRow.change.ref }), icon: "pi pi-clock",
      command: () => set({ tab: "pending", change: menuRow.change.id }) }] : []),
    { label: k("uam.viewAccess", "View access"), icon: "pi pi-id-card", command: () => navigate(`${UAM}?user=${menuRow.userId}`) },
  ] : [];

  const stateCell = (c) => {
    const label = words(c.state);
    if (c.state === "accepted") {
      return <TwoLines main={<StatusChip code="accepted" severity={severityOf("accepted")} label={k("sod.acceptedUntil", "Accepted until {{date}}", { date: shortDate(c.exception.validUntil) })} />}
        sub={c.exception.reason} />;
    }
    if (c.state === "expired") return <TwoLines main={<StatusChip code="expired" severity={severityOf("expired")} label={label} />} sub={k("sod.expiredOn", "Ended {{date}}", { date: shortDate(c.exception.validUntil) })} />;
    return <TwoLines main={<StatusChip code={c.state} severity={severityOf(c.state)} label={label} />} sub={c.change ? c.change.ref : null} />;
  };

  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={state.refreshing} />
      <div className="rp-toolbar rp-toolbar--wrap">
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" />
          <InputText value={filters.search} onChange={(e) => set({ q: e.target.value })} placeholder={k("uam.search", "Find a user")} aria-label={k("uam.search", "Find a user")} />
        </span>
        <Dropdown value={filters.ruleId ? Number(filters.ruleId) : null} options={rules.filter((r) => r.active).map((r) => ({ value: r.id, label: r.name }))} showClear filter
          onChange={(e) => set({ rule: e.value ? String(e.value) : null })} placeholder={k("sod.allRules", "All rules")} aria-label={k("colRule", "Rule")} className="access-filter" />
        <Dropdown value={filters.department} options={departments} onChange={(e) => set({ dept: e.value })} showClear placeholder={k("uam.allDepartments", "All departments")}
          aria-label={k("colDepartment", "Department")} className="access-filter" />
        <MultiSelect value={filters.states} options={STATES.map((s) => ({ value: s, label: words(s) }))} onChange={(e) => set({ state: e.value.join(",") })}
          aria-label={k("sod.colState", "State")} maxSelectedLabels={1} placeholder={k("sod.allStates", "All states")} className="access-filter"
          selectedItemsLabel={filters.states.length === STATES.length ? k("sod.allStates", "All states") : k("sod.statesChosen", "{{count}} states", { count: filters.states.length })} />
        <span className="rp-check">
          <Checkbox inputId="sod-all-users" checked={params.get("all") === "1"} onChange={(e) => set({ all: e.checked ? "1" : null })} />
          <label htmlFor="sod-all-users">{k("sod.inactiveToo", "Include inactive users")}</label>
        </span>
        {filters.userId ? <Tag value={k("sod.oneUser", "One user")} icon="pi pi-user" className="rp-tag-muted" /> : null}
      </div>
      <LoadError error={state.error} onRetry={state.reload} />
      <DataTable value={rows} dataKey="key" loading={state.loading} paginator={rows.length > 20} rows={20} size="small" className="rp-table access-table" scrollable
        emptyMessage={filtered ? <EmptyState icon="pi pi-filter-slash" text={k("sod.noMatch", "No conflict matches the filters")}
          action={<Button label={k("uam.clearFilters", "Clear filters")} text onClick={() => set({ q: null, user: null, rule: null, dept: null, state: null })} />} />
          : <EmptyState icon="pi pi-check-circle" text={k("sod.noConflicts", "No user holds a conflicting combination")} />}>
        <Column header={k("colUser", "User")} sortable sortField="userName" body={(c) => <TwoLines main={<strong>{c.userName}</strong>} sub={c.username} />} />
        <Column header={k("colDepartment", "Department")} sortable sortField="department" body={(c) => c.department || "—"} />
        <Column header={k("sod.rolesHeld", "Roles held")} body={(c) => c.heldTogether.join(" + ")} />
        <Column header={k("colRule", "Rule")} sortable sortField="ruleName" body={(c) => (
          <TwoLines main={<span className="access-rule">{c.ruleName} <Tag value={c.action === "block" ? k("actionBlock", "Block") : k("actionWarn", "Warn")}
            severity={c.action === "block" ? "danger" : "warning"} /></span>} code={technical ? c.ruleCode : null} />
        )} />
        <Column header={k("sod.colState", "State")} body={stateCell} />
        <Column header="" className="bv-actions" body={(c) => (
          <Button icon="pi pi-ellipsis-v" text rounded aria-haspopup="menu" aria-label={k("uam.actions", "Actions for {{name}}", { name: c.userName })}
            onClick={(e) => { setMenuRow(c); menu.current?.toggle(e); }} />
        )} />
      </DataTable>
      <Menu ref={menu} popup model={menuItems} />
    </div>
  );
};

SodConflictsTab.propTypes = {
  state: PropTypes.object.isRequired, rules: PropTypes.arrayOf(PropTypes.object), directory: PropTypes.object, technical: PropTypes.bool,
  onException: PropTypes.func.isRequired, onChanged: PropTypes.func,
};

export default SodConflictsTab;
