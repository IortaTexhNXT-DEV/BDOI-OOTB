import React, { useEffect, useRef, useState } from "react";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import adminService from "../../services/adminService";
import "./index.scss";

const short = (v) => (v ? JSON.stringify(v).slice(0, 160) : "");

/** Master > Audit Trail: who changed what, from the audit log the backend writes on every change. */
const AuditTrail = () => {
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ entity: "", entityId: "", username: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminService.getAudit({ ...filters, limit: 500 }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Audit trail", detail: e.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field = (key, label) => (
    <div className="admin__field">
      <label htmlFor={`audit-${key}`}>{label}</label>
      <InputText id={`audit-${key}`} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: "Master" }, { label: "Audit Trail" }]} home={{ icon: "pi pi-home", url: "/" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>Audit Trail</h2>
          <p>Every create, update, approval and sign-in, newest first.</p>
        </div>
      </div>
      <div className="admin__filters">
        {field("entity", "Record type")}
        {field("entityId", "Record ID")}
        {field("username", "User")}
        <Button label="Search" icon="pi pi-search" onClick={load} />
      </div>
      <DataTable value={rows} loading={loading} paginator rows={20} size="small" stripedRows emptyMessage="No entries">
        <Column header="When" body={(r) => new Date(r.at).toLocaleString()} />
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
