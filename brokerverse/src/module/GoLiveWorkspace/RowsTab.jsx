import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import { FilterBar } from "../../components/RecordPage";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { Chip, num } from "./shared";

const RESULTS = ["new", "changed", "unchanged", "duplicate", "error"];
const PAGE = 50;
const EMPTY = "—";

/** "Email: a.lim@... -> andrea.lim@..." for each changed column of a row. */
export const changesText = (changes = []) => changes.map((c) => `${c.header || c.column}: ${c.old ?? EMPTY} → ${c.new ?? EMPTY}`).join("; ");
/** Errors and warnings of a row as one line. */
const messageOf = (r) => [...(r.errors || []).map((e) => (typeof e === "string" ? e : e.message)), ...(r.warnings || []).map((w) => (typeof w === "string" ? w : w.message))]
  .filter(Boolean).join("; ");

/**
 * Review of a validation: each row with its result, the changed columns old → new and its errors; values masked by the
 * server. The load page mounts it again after each validation.
 */
const RowsTab = ({ batch }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState({ sheet: null, result: null, search: "" });
  const [first, setFirst] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const loader = useCallback(() => goLiveService.batchRows(batch.id, { sheet: filter.sheet, result: filter.result, search: filter.search.trim(), page: first / PAGE + 1, perPage: PAGE }),
    [batch.id, filter, first]);
  const { data, loading, refreshing } = useStableLoad(loader, { debounceMs: 300, initialData: { rows: [], total: 0 } });
  const change = (patch) => {
    setFirst(0);
    setFilter((f) => ({ ...f, ...patch }));
  };
  const sheets = (batch.sheets || []).map((s) => ({ label: s.name, value: s.sheet }));

  return (
    <div className="bv-loading-host">
      <LoadingBar active={refreshing} />
      <FilterBar active={!!(filter.sheet || filter.result || filter.search)} onClear={() => change({ sheet: null, result: null, search: "" })}>
        <Dropdown value={filter.sheet} options={sheets} onChange={(e) => change({ sheet: e.value || null })} showClear placeholder={t("goLive.rows.allSheets")}
          aria-label={t("goLive.load.sheet")} />
        <Dropdown value={filter.result} options={RESULTS.map((r) => ({ label: t(`goLive.result.${r}`), value: r }))} onChange={(e) => change({ result: e.value || null })} showClear
          placeholder={t("goLive.rows.allResults")} aria-label={t("goLive.rows.result")} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filter.search} onChange={(e) => change({ search: e.target.value })} placeholder={t("goLive.rows.searchKey")} aria-label={t("goLive.rows.searchKey")} />
        </span>
      </FilterBar>
      <DataTable value={data?.rows || []} dataKey="id" size="small" lazy paginator rows={PAGE} first={first} totalRecords={data?.total || 0} onPage={(e) => setFirst(e.first)}
        loading={loading} emptyMessage={t("goLive.rows.none")} expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)}
        rowExpansionTemplate={(r) => (
          <KeyValueGrid columns="auto" items={Object.entries(r.values || {}).map(([k, v]) => ({ key: k, label: (r.headers || {})[k] || k, value: v === null ? null : String(v) }))} />
        )}>
        <Column expander style={{ width: "3rem" }} />
        <Column field="sheetName" header={t("goLive.load.sheet")} />
        <Column field="row" header={t("goLive.load.row")} {...num} />
        <Column field="key" header={t("goLive.rows.key")} />
        <Column header={t("goLive.rows.result")} body={(r) => <Chip kind="result" code={r.result} />} />
        <Column header={t("goLive.rows.changes")} body={(r) => changesText(r.changes) || EMPTY} />
        <Column header={t("goLive.load.message")} body={(r) => messageOf(r) || EMPTY} />
      </DataTable>
    </div>
  );
};

export default RowsTab;
