import React, { useCallback, useState } from "react";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import adminService from "../../services/adminService";
import { useListState, useServerList } from "../../hooks/useServerList";
import "./index.scss";

import { formatDate as formatAppDate } from "../../utility/dateFormat";
const short = (v) => (v ? JSON.stringify(v).slice(0, 160) : "");
const NO_FILTERS = { entity: "", entityId: "", username: "", from: "", to: "" };

/** Master > Audit Trail: who changed what, newest first, paged by the server however long the log grows. */
const AuditTrail = () => {
  const [state, patch] = useListState("audit-trail", { applied: NO_FILTERS });
  const [filters, setFilters] = useState(state.applied);

  const fetchPage = useCallback(({ page, pageSize }) => adminService.getAuditPage(state.applied, { page, pageSize }), [state.applied]);
  const list = useServerList(fetchPage, { key: "audit-trail" });
  const search = () => (JSON.stringify(filters) === JSON.stringify(state.applied) ? list.reload() : patch({ applied: { ...filters } }));

  const field = (key, label, type = "text") => (
    <div className="admin__field">
      <label htmlFor={`audit-${key}`}>{label}</label>
      <InputText id={`audit-${key}`} type={type} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
    </div>
  );

  return (
    <div className="admin__page">
      <BreadCrumb model={[{ label: "Audit Trail" }]} home={{ label: "Master" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>Audit Trail</h2>
        </div>
      </div>
      <div className="admin__filters">
        {field("entity", "Record type")}
        {field("entityId", "Record ID")}
        {field("username", "User")}
        {field("from", "From date", "date")}
        {field("to", "To date", "date")}
        <Button label="Search" icon="pi pi-search" onClick={search} />
      </div>
      <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || "No entries"}>
        <Column header="When" body={(r) => formatAppDate(r.at, { withTime: true })} />
        <Column field="username" header="User" />
        <Column field="entity" header="Record type" />
        <Column field="entityId" header="Record ID" />
        <Column field="action" header="Action" />
        <Column header="Change" body={(r) => short(r.after || r.before)} />
      </DataTable>
    </div>
  );
};

export default AuditTrail;
