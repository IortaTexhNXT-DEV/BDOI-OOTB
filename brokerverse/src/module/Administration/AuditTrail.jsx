import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Toast } from "primereact/toast";
import auditService from "../../services/auditService";
import { useListState, useServerList } from "../../hooks/useServerList";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { AuditChanges, SourceText, UserText } from "../../components/AuditTrail";
import { PageHeader, SectionCard } from "../../components/RecordPage";
import "../../components/AuditTrail/auditTrail.scss";
import "./index.scss";

const NO_FILTERS = { from: "", to: "", username: "", entity: "", entityRef: "", action: "" };

/** "Claim status, Estimated loss +2 more" */
const changeSummary = (e) => {
  if (!e.changes?.length) return <span className="bv-cell-sub">No field changes</span>;
  const names = e.changes.slice(0, 2).map((c) => c.label).join(", ");
  const more = e.changes.length > 2 ? ` +${e.changes.length - 2} more` : "";
  return <span>{names}<span className="audit-log__more">{more}</span></span>;
};

/**
 * Master > Audit Trail: every audited action across the system, newest first and paged by the server, one row per
 * business event (who, when, which record, what happened, from where); expand a row to see the fields it changed.
 * Filters: date range, user, record type, record number, action. Download to Excel or CSV (one row per changed field).
 */
const AuditTrail = () => {
  const toast = useRef(null);
  const exportMenu = useRef(null);
  const [filters, patch] = useListState("audit-trail-events", NO_FILTERS);
  const [ref, setRef] = useState(filters.entityRef);
  const [options, setOptions] = useState({ recordTypes: [], actions: [], users: [] });
  const [expanded, setExpanded] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    auditService.getOptions().then(setOptions).catch(() => {});
  }, []);
  // the record number is applied as it is typed (the list debounces the reload)
  useEffect(() => {
    const h = setTimeout(() => { if (ref !== filters.entityRef) patch({ entityRef: ref.trim() }); }, 300);
    return () => clearTimeout(h);
  }, [ref, filters.entityRef, patch]);

  const fetchPage = useCallback(({ page, pageSize }) => auditService.getEvents(filters, { page, pageSize }), [filters]);
  const list = useServerList(fetchPage, { key: "audit-trail-events" });

  const range = [toDate(filters.from), toDate(filters.to)].filter(Boolean);
  const onRange = (value) => {
    const [from, to] = Array.isArray(value) ? value : [];
    patch({ from: from ? toIsoDate(from) : "", to: to ? toIsoDate(to) : from ? toIsoDate(from) : "" });
  };
  const anyFilter = Object.values(filters).some(Boolean);

  const download = async (format) => {
    setDownloading(format);
    try {
      await auditService.download(filters, format);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Download failed", detail: e.message, life: 6000 });
    } finally {
      setDownloading(null);
    }
  };

  const all = (label) => [{ label, value: "" }];
  return (
    <div className="bv-ops-page audit-log">
      <Toast ref={toast} />
      <PageHeader title="Audit Trail" crumbs={[{ label: "Master" }, { label: "System Configuration" }, { label: "Audit Trail" }]}
        meta={<span>Every change made in the system: who made it, when, from where and what changed.</span>}
        actions={(
          <>
            <Menu popup ref={exportMenu} model={[
              { label: "Excel", icon: "pi pi-file-excel", command: () => download("excel") },
              { label: "CSV", icon: "pi pi-file", command: () => download("csv") },
            ]} />
            <Button icon="pi pi-refresh" text rounded className="bv-audit-icon-btn" aria-label="Refresh" tooltip="Refresh" tooltipOptions={{ position: "top" }} onClick={list.reload} />
            <Button icon="pi pi-download" outlined label="Export" loading={!!downloading} onClick={(e) => exportMenu.current.toggle(e)} aria-haspopup />
          </>
        )} />
      <SectionCard>
        <div className="bv-list-toolbar audit-log__filters">
          <Calendar value={range.length ? range : null} onChange={(e) => onRange(e.value)} selectionMode="range" readOnlyInput showIcon showButtonBar
            dateFormat={calendarDateFormat()} placeholder="Date range" aria-label="Date range" className="audit-log__range" onClearButtonClick={() => patch({ from: "", to: "" })} />
          <Dropdown value={filters.username} options={[...all("All users"), ...options.users]} onChange={(e) => patch({ username: e.value || "" })} filter
            placeholder="All users" aria-label="User" className="bv-list-filter" />
          <Dropdown value={filters.entity} options={[...all("All record types"), ...options.recordTypes.map((r) => ({ value: r.value, label: r.label }))]}
            onChange={(e) => patch({ entity: e.value || "" })} filter placeholder="All record types" aria-label="Record type" className="bv-list-filter" />
          <span className="p-input-icon-left audit-log__ref">
            <i className="pi pi-search" />
            <InputText value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Record number" aria-label="Record number" />
          </span>
          <Dropdown value={filters.action} options={[...all("All actions"), ...options.actions]} onChange={(e) => patch({ action: e.value || "" })} filter
            placeholder="All actions" aria-label="Action" className="bv-list-filter" />
          {anyFilter ? (
            <Button icon="pi pi-filter-slash" text rounded className="bv-audit-icon-btn" aria-label="Clear filters" tooltip="Clear filters" tooltipOptions={{ position: "top" }}
              onClick={() => { setRef(""); patch(NO_FILTERS); }} />
          ) : null}
        </div>
        <DataTable {...list.tableProps} dataKey="id" size="small" className="audit-log__table" tableStyle={{ tableLayout: "fixed", width: "100%" }} emptyMessage={list.error || "No audit entries match the filters"}
          expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)}
          rowExpansionTemplate={(e) => (
            <div className="audit-log__expansion">
              {e.note ? <p className="bv-audit-event__note">{e.note}</p> : null}
              {e.changes?.length ? <AuditChanges changes={e.changes} max={50} /> : <span className="bv-cell-sub">This action changed no fields.</span>}
            </div>
          )}>
          <Column expander={(e) => e.changes?.length > 0 || !!e.note} style={{ width: "3rem" }} />
          <Column header="Date & Time" body={(e) => (
            <span className="nowrap">{e.date}<span className="bv-cell-sub">{e.time}</span></span>
          )} style={{ width: "7rem" }} />
          <Column header="User" body={(e) => <UserText user={e.user} />} bodyClassName="audit-log__user" style={{ width: "11rem" }} />
          <Column header="Record" body={(e) => (
            <span>{e.reference || "—"}<span className="bv-cell-sub">{e.entityLabel}</span></span>
          )} style={{ width: "10rem" }} />
          <Column header="Event" body={(e) => (
            <span className="audit-log__event">{e.title}{e.note ? <span className="bv-cell-sub">{e.note}</span> : null}</span>
          )} />
          <Column header="Changes" body={changeSummary} style={{ width: "11rem" }} />
          <Column header="Source" body={(e) => <SourceText source={e.source} />} bodyClassName="audit-log__source" style={{ width: "11rem" }} />
        </DataTable>
      </SectionCard>
    </div>
  );
};

export default AuditTrail;
