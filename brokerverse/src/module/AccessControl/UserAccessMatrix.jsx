import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import LoadingBar from "../../components/LoadingBar";
import PageHeader from "../../components/PageHeader";
import StatCards from "../../components/StatCards";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import authService from "../../services/authService";
import { hasPermission } from "../../utils/canOpen";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import UserAccessPanel from "./UserAccessPanel";
import { FLAGS, STATUSES, filterUsers, matrixStats } from "./userAccess";
import {
  BaseRolesCheck, ConflictChip, EmptyState, LoadError, StatusTag, TechnicalSwitch, TwoLines, dateTime, download, useBaseRoles, useDepartmentOptions, useLabels,
  useQueryState, useRoleOptions, useTechnicalNames,
} from "./common";
import "../Administration/index.scss";
import "./index.scss";

const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
export const SOD_PATH = "/master/generals/usermanagement/segregation-of-duties";
export const USER_PATH = "/master/generals/usermanagement/user/view";

/**
 * Master > Users and Access > User Access Matrix: who has access to what, for audit. Stat cards filter the table;
 * filters are in the address (?q, dept, role, status, flag, user), so Role Permissions links to the users of a role.
 * A row opens the access panel of the person: roles, what he or she can do, approval authority, delegations,
 * conflicts, last review and changes waiting for approval.
 */
const UserAccessMatrix = () => {
  const k = useLabels();
  const navigate = useNavigate();
  const [params, set] = useQueryState();
  const { allowed, technical, setTechnical } = useTechnicalNames();
  const loader = useCallback(() => accessControlService.userMatrix(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const menu = useRef(null);
  const [menuRow, setMenuRow] = useState(null);
  const me = authService.getUser()?.userId;
  const maySignOut = hasPermission("write:users");

  const role = params.get("role");
  const roleOfAddress = (data?.roles || []).find((r) => r.code === role);
  const [base, setBase] = useBaseRoles(!!roleOfAddress?.platform || params.get("base") === "1");
  const filters = useMemo(() => ({
    search: params.get("q") || "",
    departments: list(params.get("dept")),
    role: params.get("role"),
    status: STATUSES.includes(params.get("status")) ? params.get("status") : "active",
    flag: FLAGS.includes(params.get("flag")) ? params.get("flag") : null,
  }), [params]);
  const directory = useMemo(() => (data ? { roles: data.roles, departments: data.departments } : null), [data]);
  const roleOptions = useRoleOptions(directory, { base });
  const departmentOptions = useDepartmentOptions(directory);
  const rows = useMemo(() => filterUsers(data?.rows || [], filters), [data, filters]);
  const stats = useMemo(() => matrixStats(data?.rows || []), [data]);
  const figure = (key) => (data ? stats[key] : null);
  const filtered = !!(filters.search || filters.departments.length || filters.role || filters.flag || filters.status !== "active");

  const statusWords = { active: k("status.active", "Active"), inactive: k("status.inactive", "Inactive"), locked: k("status.locked", "Locked"), all: k("allStatuses", "All statuses") };
  const flagCard = (key, label, note) => ({ key, label, note, value: figure(key), active: filters.flag === key, onClick: () => set({ flag: filters.flag === key ? null : key }) });
  const cards = [
    { key: "active", label: k("statActive", "Active users"), value: figure("active"), active: !filters.flag && filters.status === "active",
      onClick: () => set({ flag: null, status: null }) },
    flagCard("dormant", k("uam.statDormant", "Dormant"), data ? k("uam.dormantNote", "No sign-in for {{days}}+ days", { days: data.dormantDays }) : null),
    flagCard("conflicts", k("uam.statDutyConflicts", "Duty conflicts"), k("uam.dutyConflictsNote", "No exception accepted")),
    flagCard("twoStep", k("uam.statNoTwoStep", "No two-step sign-in"), k("uam.twoStepNote", "Active users")),
    flagCard("pending", k("uam.statChanges", "Changes pending"), k("uam.changesNote", "Users with a change to approve")),
  ];

  const signOut = async (u) => {
    if (!(await confirmAction(k("signOutConfirm", "End every session of {{name}}? They will have to sign in again.", { name: u.displayName }),
      { header: k("signOutTitle", "Sign out everywhere"), acceptLabel: k("uam.signOut", "Sign out"), rejectLabel: k("cancel", "Cancel"), danger: true }))) return;
    try {
      const r = await accessControlService.signOutUser(u.id);
      notifySuccess(r.message);
    } catch (e) {
      notifyError(e.message);
    }
  };
  const menuItems = menuRow ? [
    { label: k("uam.viewAccess", "View access"), icon: "pi pi-id-card", command: () => set({ user: menuRow.id }) },
    { label: k("uam.openUser", "Open user"), icon: "pi pi-user", command: () => navigate(`${USER_PATH}/${menuRow.id}`) },
    { label: k("uam.conflicts", "Segregation of duties conflicts"), icon: "pi pi-exclamation-triangle", command: () => navigate(`${SOD_PATH}?tab=conflicts&user=${menuRow.id}`),
      disabled: !menuRow.sodConflicts.length },
    ...(maySignOut && menuRow.id !== me && menuRow.status === "active" ? [{ separator: true },
      { label: k("signOutTitle", "Sign out everywhere"), icon: "pi pi-sign-out", command: () => signOut(menuRow) }] : []),
  ] : [];

  const actions = (
    <>
      <Button label={k("exportExcel", "Export to Excel")} icon="pi pi-file-excel" outlined disabled={!data}
        onClick={() => download(() => accessControlService.downloadUserMatrix({ status: filters.status === "all" ? undefined : filters.status, technical: technical ? 1 : undefined }))} />
      <TechnicalSwitch allowed={allowed} technical={technical} onChange={setTechnical} id="uam-technical" />
    </>
  );

  const userCell = (u) => <TwoLines main={<strong>{u.displayName}</strong>} sub={[u.username, u.designation].filter(Boolean).join(" · ")} />;
  // base platform roles show with "Include base platform roles"; without it they are counted in one chip
  const platform = new Set((data?.roles || []).filter((r) => r.platform).map((r) => r.code));
  const rolesCell = (u) => {
    const hidden = base ? 0 : u.roles.filter((c) => platform.has(c)).length + u.included.filter((x) => platform.has(x.code)).length;
    return (
    <div className="access-chips">
      {u.roleNames.map((name, i) => (base || !platform.has(u.roles[i]) ? (
        <span key={u.roles[i]} className="access-chip-stack">
          <Tag value={name} className={u.platformRoles.includes(u.roles[i]) ? "rp-tag-muted" : "access-role-tag"} />
          {technical ? <span className="rp-code">{u.roles[i]}</span> : null}
        </span>
      ) : null))}
      {u.included.filter((x) => base || !platform.has(x.code)).map((x) => (
        <Tag key={x.code} value={x.name} className="access-role-tag access-role-tag--through" title={k("uam.through", "Through {{role}}", { role: x.throughName })} />
      ))}
      {hidden ? <Tag value={k("uam.baseRolesHidden", "{{count}} base platform roles", { count: hidden })} className="rp-tag-muted" /> : null}
      {u.pending.map((p) => <Tag key={p.ref} severity="warning" icon="pi pi-clock" value={k("uam.pendingChip", "{{kind}} waiting", { kind: p.kindLabel })} title={p.ref} />)}
    </div>
    );
  };
  const signInCell = (u) => (
    <TwoLines main={u.lastLoginAt ? dateTime(u.lastLoginAt) : k("never", "Never")}
      sub={u.dormant ? <span className="access-warn">{k("dormantFor", "Dormant {{days}} days", { days: u.daysSinceLogin })}</span> : null} />
  );
  const sodCell = (u) => (u.sodConflicts.length
    ? <div className="access-chips">{u.sodConflicts.map((c) => <ConflictChip key={c.ruleId} conflict={c} />)}</div>
    : <span className="rp-muted">{k("none", "None")}</span>);

  return (
    <div className="admin__page access__page rp-page access-page">
      <PageHeader title={k("userMatrixTitle", "User Access Matrix")} home={k("master", "Master")} section={k("userManagement", "Users and Access")}
        trail={[k("userMatrixTitle", "User Access Matrix")]} actions={actions}
        help={k("uam.help", "Who has access to what, with sign-in facts, segregation-of-duties conflicts and changes waiting for approval, for audit.")} />
      <StatCards items={cards} className="access-stats" />
      <div className="rp-card bv-loading-host">
        <LoadingBar active={refreshing} />
        <div className="rp-toolbar rp-toolbar--wrap">
          <span className="p-input-icon-left rp-search">
            <i className="pi pi-search" />
            <InputText value={filters.search} onChange={(e) => set({ q: e.target.value })} placeholder={k("uam.search", "Find a user")} aria-label={k("uam.search", "Find a user")} />
          </span>
          <MultiSelect value={filters.departments} options={departmentOptions} onChange={(e) => set({ dept: e.value.join(",") })} placeholder={k("uam.allDepartments", "All departments")}
            maxSelectedLabels={2} aria-label={k("colDepartment", "Department")} className="access-filter" />
          <Dropdown value={filters.role} options={roleOptions} optionGroupLabel="label" optionGroupChildren="items" onChange={(e) => set({ role: e.value })} filter showClear
            placeholder={k("allRoles", "All roles")} aria-label={k("colRole", "Role")} className="access-filter" />
          <Dropdown value={filters.status} options={STATUSES.map((s) => ({ value: s, label: statusWords[s] }))} onChange={(e) => set({ status: e.value === "active" ? null : e.value })}
            aria-label={k("colStatus", "Status")} />
          <BaseRolesCheck checked={base} onChange={setBase} id="uam-base" />
        </div>
        <LoadError error={error} onRetry={reload} />
        <DataTable value={rows} dataKey="id" loading={loading} paginator rows={20} rowsPerPageOptions={[20, 50, 100]} size="small" className="rp-table access-table"
          scrollable onRowClick={(e) => set({ user: e.data.id })} rowClassName={() => "access-row--click"} sortField="displayName" sortOrder={1}
          emptyMessage={filtered ? (
            <EmptyState icon="pi pi-filter-slash" text={k("noUsers", "No user matches the filters")}
              action={<Button label={k("uam.clearFilters", "Clear filters")} text onClick={() => set({ q: null, dept: null, role: null, status: null, flag: null })} />} />
          ) : <EmptyState icon="pi pi-users" text={k("uam.noUsers", "No user yet")} />}>
          <Column header={k("colUser", "User")} sortable sortField="displayName" body={userCell} frozen style={{ minWidth: "14rem" }} />
          <Column header={k("colDepartment", "Department")} sortable sortField="department" body={(u) => u.department || u.hrDepartment || <span className="rp-muted">—</span>} />
          <Column header={k("colRoles", "Roles")} body={rolesCell} style={{ minWidth: "16rem" }} />
          <Column header={k("colBranch", "Branch")} sortable sortField="branchName" body={(u) => u.branchName || u.branch || "—"} />
          <Column header={k("colStatus", "Status")} sortable sortField="status" body={(u) => <StatusTag status={u.status} label={statusWords[u.status] || u.status} />} />
          <Column header={k("colLastSignIn", "Last sign-in")} sortable sortField="daysSinceLogin" body={signInCell} />
          <Column header={k("uam.colTwoStep", "Two-step")} body={(u) => (
            <span className="access-flag">
              <i className={u.twoFactor ? "pi pi-check-circle access-ok" : "pi pi-minus-circle rp-muted"} aria-hidden="true" />
              {u.twoFactor ? k("on", "On") : k("off", "Off")}
            </span>
          )} />
          <Column header={k("colPasswordAge", "Password age (days)")} sortable sortField="passwordAgeDays" body={(u) => u.passwordAgeDays} className="am-num-col" />
          <Column header={k("colSod", "Segregation of duties")} body={sodCell} style={{ minWidth: "12rem" }} />
          <Column header="" className="bv-actions" body={(u) => (
            <Button icon="pi pi-ellipsis-v" text rounded aria-label={k("uam.actions", "Actions for {{name}}", { name: u.displayName })} aria-haspopup="menu"
              onClick={(e) => { e.stopPropagation(); setMenuRow(u); menu.current?.toggle(e); }} />
          )} />
        </DataTable>
        <Menu ref={menu} popup model={menuItems} />
      </div>
      <UserAccessPanel userId={params.get("user")} technical={technical} onHide={() => set({ user: null })} />
    </div>
  );
};

export default UserAccessMatrix;
