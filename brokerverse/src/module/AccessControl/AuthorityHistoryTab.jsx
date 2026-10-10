import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import StatusChip from "../../components/StatusChip";
import LoadingBar from "../../components/LoadingBar";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { limitValue } from "./authorityFormat";
import { dateTime, shortDate, useLabels } from "./common";

const SEVERITY = { "In effect": "success", Scheduled: "info", "Waiting for approval": "warning", Rejected: "danger", Ended: null, Retired: null, Withdrawn: null };

/**
 * Tab "History": every limit with its dates, reference, proposer, approver and decision note, newest first, by
 * transaction, role or person and status; the same rows as "Change history (Excel)".
 */
const AuthorityHistoryTab = ({ data, technical }) => {
  const k = useLabels();
  const [type, setType] = useState(null);
  const [status, setStatus] = useState(null);
  const [query, setQuery] = useState("");
  const loader = useCallback(() => accessControlService.limits({ status: "all", transactionType: type || undefined }), [type]);
  const { data: list, loading, refreshing, error, reload } = useStableLoad(loader, { initialData: [] });
  const noLimit = k("noLimit", "No limit");
  const statuses = useMemo(() => [...new Set(list.map((l) => l.statusLabel))].map((s) => ({ value: s, label: k(`authority.history.${s.replace(/\s+/g, "")}`, s) })), [list, k]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((l) => (!status || l.statusLabel === status) && (!q || [l.roleName, l.userName, l.referenceNo].some((x) => String(x || "").toLowerCase().includes(q))));
  }, [list, status, query]);
  return (
    <div className="rp-card bv-loading-host">
      <LoadingBar active={refreshing} />
      <div className="rp-toolbar rp-toolbar--wrap">
        <span className="p-input-icon-left rp-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k("authority.findHistory", "Find a role, person or reference")}
            aria-label={k("authority.findHistory", "Find a role, person or reference")} />
        </span>
        <Dropdown value={type} options={data?.rows || []} optionLabel="name" optionValue="code" showClear onChange={(e) => setType(e.value)}
          placeholder={k("authority.allTransactions", "All transactions")} aria-label={k("colTransaction", "Transaction")} />
        <Dropdown value={status} options={statuses} showClear onChange={(e) => setStatus(e.value)} placeholder={k("allStatuses", "All statuses")} aria-label={k("colStatus", "Status")} />
      </div>
      {error ? (
        <div className="rp-error">
          <Message severity="error" text={error} />
          <Button label={k("rolePermissions.retry", "Try again")} text onClick={reload} />
        </div>
      ) : null}
      <DataTable value={rows} dataKey="id" loading={loading} size="small" className="rp-table" paginator rows={25} rowsPerPageOptions={[25, 50, 100]}
        emptyMessage={k("authority.noHistory", "No limit")}>
        <Column header={k("authority.colChange", "Change")} body={(l) => (l.changeId ? `CFG-${l.changeId}` : `AL-${l.id}`)} className="bv-nowrap" />
        <Column header={k("colTransaction", "Transaction")} body={(l) => (
          <span className="rp-cell-stack"><span>{l.transactionName}</span>{technical ? <span className="rp-code">{l.transactionType}</span> : null}</span>
        )} />
        <Column header={k("authority.roleOrPerson", "Role or person")} body={(l) => l.roleName || l.userName} />
        <Column header={k("authority.limit", "Approval limit")} className="am-num-col" body={(l) => limitValue(l.measure, l.maxAmount, l.unlimited, noLimit)} />
        <Column header={k("authority.period", "Effective")} body={(l) => [shortDate(l.effectiveFrom), l.effectiveTo ? shortDate(l.effectiveTo) : null].filter(Boolean).join(" – ")} />
        <Column header={k("authority.reference", "Authority reference")} body={(l) => [l.referenceNo, l.referenceDate ? shortDate(l.referenceDate) : null].filter(Boolean).join(" · ") || "—"} />
        <Column header={k("authority.proposedBy", "Proposed by")} body={(l) => (
          <span className="rp-cell-stack"><span>{l.requestedBy || "—"}</span><span className="rp-muted">{dateTime(l.requestedAt)}</span></span>
        )} />
        <Column header={k("authority.decidedBy", "Decided by")} body={(l) => (
          <span className="rp-cell-stack"><span>{l.decidedBy || "—"}</span><span className="rp-muted">{dateTime(l.decidedAt)}</span>{l.decisionNote ? <span className="rp-muted">{l.decisionNote}</span> : null}</span>
        )} />
        <Column header={k("colStatus", "Status")} body={(l) => <StatusChip label={statuses.find((s) => s.value === l.statusLabel)?.label || l.statusLabel} severity={SEVERITY[l.statusLabel] || "secondary"} />} />
      </DataTable>
    </div>
  );
};

AuthorityHistoryTab.propTypes = { data: PropTypes.object, technical: PropTypes.bool };

export default AuthorityHistoryTab;
