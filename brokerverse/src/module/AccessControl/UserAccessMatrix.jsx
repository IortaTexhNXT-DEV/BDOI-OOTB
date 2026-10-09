import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import accessControlService from "../../services/accessControlService";
import { PageHeader, dateTime, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const STATUS_SEVERITY = { active: "success", inactive: "secondary", locked: "danger" };

/**
 * Master > User Management > User Access Matrix: every user with roles, branch, status and the sign-in facts an
 * auditor asks for (last sign-in, two-factor, password age, dormant accounts, segregation-of-duties conflicts).
 */
const UserAccessMatrix = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [data, setData] = useState({ roles: [], rows: [], dormantDays: 90 });
  const [loading, setLoading] = useState(true);
  // Role Permissions links here with ?role=<code>: the users of that role
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ status: null, role: params.get("role") || null, search: "", flag: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await accessControlService.userMatrix());
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("loadFailed", "Could not load the users"), detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [k]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleName = useMemo(() => Object.fromEntries(data.roles.map((r) => [r.code, r.name])), [data.roles]);
  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return data.rows.filter((u) => (!filters.status || u.status === filters.status)
      && (!filters.role || u.effectiveRoles.includes(filters.role))
      && (!filters.flag || (filters.flag === "dormant" ? u.dormant : filters.flag === "sod" ? u.sodConflicts.length : !u.twoFactor))
      && (!q || [u.username, u.displayName, u.branch, u.department, u.designation].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [data.rows, filters]);

  const summary = useMemo(() => ({
    active: data.rows.filter((u) => u.status === "active").length,
    dormant: data.rows.filter((u) => u.dormant).length,
    sod: data.rows.filter((u) => u.sodConflicts.length).length,
    noTwoFactor: data.rows.filter((u) => u.status === "active" && !u.twoFactor).length,
  }), [data.rows]);

  const signOut = (u) => confirmDialog({
    header: k("signOutTitle", "Sign out everywhere"),
    message: k("signOutConfirm", "End every session of {{name}}? They will have to sign in again.", { name: u.displayName }),
    icon: "pi pi-sign-out",
    accept: async () => {
      try {
        const r = await accessControlService.signOutUser(u.id);
        toast.current?.show({ severity: "success", summary: r.message });
      } catch (e) {
        toast.current?.show({ severity: "error", summary: e.message });
      }
    },
  });

  const exportFile = async () => {
    try {
      await accessControlService.downloadUserMatrix();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    }
  };

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader
        title={k("userMatrixTitle", "User Access Matrix")}
        actions={<>
          <Button icon="pi pi-refresh" label={k("refresh", "Refresh")} outlined onClick={load} disabled={loading} />
          <Button icon="pi pi-file-excel" label={k("exportExcel", "Export to Excel")} onClick={exportFile} />
        </>}
      />

      <div className="access__stats">
        {[
          ["active", k("statActive", "Active users"), null],
          ["dormant", k("statDormant", "Dormant ({{days}}+ days)", { days: data.dormantDays }), "dormant"],
          ["sod", k("statSod", "Segregation-of-duties conflicts"), "sod"],
          ["noTwoFactor", k("statNoTwoFactor", "Active without two-factor"), "no2fa"],
        ].map(([key, label, flag]) => (
          <button type="button" key={key} className={`access__stat${filters.flag === flag && flag ? " is-selected" : ""}`}
            onClick={() => setFilters((f) => ({ ...f, flag: f.flag === flag ? null : flag }))} disabled={!flag}>
            <span className="access__stat-value">{loading ? "–" : summary[key]}</span>
            <span className="access__stat-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="admin__filters access__filters">
        <InputText value={filters.search} placeholder={k("searchUsers", "Search name, username, branch or department")}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <Dropdown value={filters.role} options={[{ label: k("allRoles", "All roles"), value: null }, ...data.roles.map((r) => ({ label: r.name, value: r.code }))]}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.value }))} placeholder={k("allRoles", "All roles")} />
        <Dropdown value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.value }))} placeholder={k("allStatuses", "All statuses")}
          options={[{ label: k("allStatuses", "All statuses"), value: null }, ...["active", "inactive", "locked"].map((s) => ({ label: k(`status.${s}`, s), value: s }))]} />
      </div>

      <DataTable value={rows} dataKey="id" loading={loading} paginator rows={20} rowsPerPageOptions={[20, 50, 100]} size="small" stripedRows
        scrollable emptyMessage={k("noUsers", "No users match the filters")} className="access__table">
        <Column header={k("colUser", "User")} sortable sortField="displayName" style={{ minWidth: "14rem" }} body={(u) => (
          <div className="access__user">
            <span className="access__user-name">{u.displayName}</span>
            <span className="access__muted">{u.username}{u.designation ? ` · ${u.designation}` : ""}</span>
          </div>
        )} />
        <Column header={k("colRoles", "Roles")} style={{ minWidth: "14rem" }} body={(u) => (
          <div className="access__chips">{u.roles.map((r) => <Tag key={r} value={roleName[r] || r} className="access__role-tag" />)}</div>
        )} />
        <Column field="branch" header={k("colBranch", "Branch")} sortable />
        <Column header={k("colStatus", "Status")} sortable sortField="status" body={(u) => (
          <Tag value={k(`status.${u.status}`, u.status)} severity={STATUS_SEVERITY[u.status] || "info"} />
        )} />
        <Column header={k("colLastSignIn", "Last sign-in")} sortable sortField="daysSinceLogin" body={(u) => (
          <div className="access__user">
            <span>{u.lastLoginAt ? dateTime(u.lastLoginAt) : k("never", "Never")}</span>
            {u.dormant ? <span className="access__warn">{k("dormantFor", "Dormant {{days}} days", { days: u.daysSinceLogin })}</span> : null}
          </div>
        )} />
        <Column header={k("colTwoFactor", "Two-factor")} body={(u) => (
          <i className={u.twoFactor ? "pi pi-check-circle access__ok" : "pi pi-minus-circle access__muted"} aria-label={u.twoFactor ? k("on", "On") : k("off", "Off")} />
        )} style={{ width: "7rem", textAlign: "center" }} />
        <Column field="passwordAgeDays" header={k("colPasswordAge", "Password age (days)")} sortable style={{ textAlign: "right" }} />
        <Column header={k("colSod", "Segregation of duties")} style={{ minWidth: "12rem" }} body={(u) => (u.sodConflicts.length
          ? u.sodConflicts.map((c) => <Tag key={c.name} value={c.name} severity={c.action === "block" ? "danger" : "warning"} className="mr-1 mb-1" />)
          : <span className="access__muted">{k("none", "None")}</span>)} />
        <Column header="" style={{ width: "4rem" }} body={(u) => (
          <Button icon="pi pi-sign-out" text rounded aria-label={k("signOutTitle", "Sign out everywhere")} tooltip={k("signOutTitle", "Sign out everywhere")}
            tooltipOptions={{ position: "left" }} onClick={() => signOut(u)} disabled={u.status !== "active"} />
        )} />
      </DataTable>
    </div>
  );
};

export default UserAccessMatrix;
