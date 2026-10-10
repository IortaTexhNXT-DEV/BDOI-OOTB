import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { limitValue } from "./authorityFormat";
import { shortDate, useLabels } from "./common";

/** Status chip of a personal limit: Pending, Removal pending, Scheduled or In effect. */
export const LimitChip = ({ item }) => {
  const k = useLabels();
  if (item.pending) {
    return <Tag severity="warning" value={item.pending.removes ? k("authority.removalPending", "Removal pending") : k("authority.pending", "Pending")} />;
  }
  if (item.scheduled) return <Tag severity="info" value={k("authority.fromDate", "From {{date}}", { date: shortDate(item.scheduled.effectiveFrom) })} />;
  if (item.set) return <Tag severity="success" value={k("inEffect", "In effect")} />;
  return null;
};

LimitChip.propTypes = { item: PropTypes.object.isRequired };

/**
 * Tab "Personal limits": the people with a limit of their own for a transaction (it replaces the limits of their
 * roles), with the limit in effect, its reference and its state. A row opens the limit panel; write access adds one.
 */
const AuthorityPersonalTab = ({ data, technical, onOpen, onAdd }) => {
  const k = useLabels();
  const [query, setQuery] = useState("");
  const noLimit = k("noLimit", "No limit");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.userLimits || []).filter((p) => !q || [p.userName, p.username, p.transactionName].some((x) => String(x || "").toLowerCase().includes(q)));
  }, [data, query]);
  return (
    <div className="rp-card">
      <div className="rp-toolbar rp-toolbar--wrap">
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k("authority.findPerson", "Find a person or transaction")}
            aria-label={k("authority.findPerson", "Find a person or transaction")} />
        </span>
        <span className="am-spacer" />
        {data?.abilities?.edit ? <Button label={k("authority.addPersonal", "Add personal limit")} icon="pi pi-plus" onClick={onAdd} /> : null}
      </div>
      <DataTable value={rows} dataKey="key" size="small" className="rp-table" rowHover onRowClick={(e) => onOpen(e.data)}
        emptyMessage={k("noUserLimits", "No personal limits")}>
        <Column header={k("colPerson", "Person")} body={(p) => (
          <span className="rp-cell-stack">
            <span>{p.userName}</span>
            {technical && p.username ? <span className="rp-code">{p.username}</span> : null}
          </span>
        )} />
        <Column header={k("colTransaction", "Transaction")} body={(p) => p.transactionName} />
        <Column header={k("authority.limit", "Approval limit")} className="am-num-col" body={(p) => (p.set ? limitValue(p.measure, p.maxAmount, p.unlimited, noLimit) : "—")} />
        <Column header={k("authority.effectiveFrom", "Effective from")} body={(p) => (p.effectiveFrom ? shortDate(p.effectiveFrom) : "—")} />
        <Column header={k("authority.reference", "Authority reference")} body={(p) => p.referenceNo || "—"} />
        <Column header={k("colStatus", "Status")} body={(p) => <LimitChip item={p} />} />
        <Column header="" className="bv-actions" body={(p) => (
          <Button icon="pi pi-angle-right" text rounded aria-label={k("authority.open", "Open {{name}}", { name: `${p.userName} · ${p.transactionName}` })} onClick={() => onOpen(p)} />
        )} />
      </DataTable>
    </div>
  );
};

AuthorityPersonalTab.propTypes = { data: PropTypes.object, technical: PropTypes.bool, onOpen: PropTypes.func.isRequired, onAdd: PropTypes.func.isRequired };

export default AuthorityPersonalTab;
