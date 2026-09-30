import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { PageHeader, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

/**
 * Master > User Management > Role Permissions: every permission down, every role across, so the rights of the
 * roles can be compared and reviewed on one page. Permissions are changed on the Role screen.
 */
const RolePermissions = () => {
  const k = useLabels();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [data, setData] = useState({ roles: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    accessControlService.roleMatrix()
      .then(setData)
      .catch((e) => toast.current?.show({ severity: "error", summary: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const modules = useMemo(() => [...new Set(data.rows.map((r) => r.module))].sort(), [data.rows]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => (!module || r.module === module) && (!q || `${r.code} ${r.description || ""}`.toLowerCase().includes(q)));
  }, [data.rows, module, search]);

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <PageHeader
        title={k("roleMatrixTitle", "Role Permissions")}
        intro={k("roleMatrixIntro", "What each role may do. A role that builds on another (for example the Accounting Manager on Accounting) also has that role's permissions.")}
        actions={<Button icon="pi pi-pencil" label={k("editRoles", "Edit roles")} outlined onClick={() => navigate("/master/generals/usermanagement/role")} />}
      />
      <div className="admin__filters access__filters">
        <InputText value={search} placeholder={k("searchPermissions", "Search permission")} onChange={(e) => setSearch(e.target.value)} />
        <Dropdown value={module} onChange={(e) => setModule(e.value)} placeholder={k("allModules", "All modules")}
          options={[{ label: k("allModules", "All modules"), value: null }, ...modules.map((m) => ({ label: m, value: m }))]} />
      </div>
      <DataTable value={rows} dataKey="code" loading={loading} size="small" stripedRows scrollable scrollHeight="flex" rowGroupMode="subheader" groupRowsBy="module"
        rowGroupHeaderTemplate={(r) => <span className="access__group">{r.module}</span>} sortField="module" sortOrder={1}
        emptyMessage={k("noPermissions", "No permissions match the filters")} className="access__table access__matrix">
        <Column field="code" header={k("colPermission", "Permission")} frozen style={{ minWidth: "16rem" }} body={(r) => (
          <div className="access__user">
            <span className="access__code">{r.code}</span>
            {r.description ? <span className="access__muted">{r.description}</span> : null}
          </div>
        )} />
        {data.roles.map((role) => (
          <Column key={role.code} header={<span title={role.inherits?.length ? k("inheritsFrom", "Also has: {{roles}}", { roles: role.inherits.join(", ") }) : ""}>{role.name}</span>}
            style={{ minWidth: "8rem", textAlign: "center" }}
            body={(r) => (r.grants[role.code] ? <i className="pi pi-check access__ok" aria-label={k("granted", "Granted")} /> : <span className="access__dash">–</span>)} />
        ))}
      </DataTable>
    </div>
  );
};

export default RolePermissions;
