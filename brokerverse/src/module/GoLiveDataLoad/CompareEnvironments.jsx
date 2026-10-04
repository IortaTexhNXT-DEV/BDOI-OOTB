import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import goLiveDataService, { errorMessage } from "../../services/goLiveDataService";
import { showErrorMessage, showSuccessMessage, showWarningMessage } from "../../utility/toastUtils";
import { formatDate } from "../../utility/dateFormat";

const STATUS_SEVERITY = { different: "danger", "only-in-file": "success", "only-here": "warning", identical: "secondary" };
const DIFFERING = ["different", "only-in-file", "only-here"];
const PER_PAGE = 25;

/**
 * Master > Go-Live Data Load > Compare environments: the configuration workbook exported from another environment
 * compared with this one, or two exports compared with each other (never loads). Verdict, counts per sheet, the rows
 * with their field-level differences, the environment-specific values, the comparison workbook and the comparisons made.
 */
const CompareEnvironments = ({ iconButton }) => {
  const { t } = useTranslation();
  const inputA = useRef(null);
  const inputB = useRef(null);
  const [mode, setMode] = useState("environment");
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [includeNumbering, setIncludeNumbering] = useState(false);
  const [busy, setBusy] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [filters, setFilters] = useState({ sheet: null, status: null, search: "" });
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);

  const title = t("goLiveData.title");
  const fail = async (e, key) => showErrorMessage(await errorMessage(e, t(key)), title);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await goLiveDataService.comparisons({ perPage: 20 }));
    } catch (e) {
      showErrorMessage(await errorMessage(e, t("goLiveData.loadFailed")), t("goLiveData.title"));
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const id = comparison?.id;
  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setRowsLoading(true);
    goLiveDataService.comparisonRows(id, { sheet: filters.sheet, status: filters.status || DIFFERING.join(","), search: filters.search, page: page + 1, perPage: PER_PAGE })
      .then((r) => { if (live) setRows({ ...r, items: r.items.map((x) => ({ ...x, rowId: `${x.sheet}|${x.key}|${x.rowFile ?? ""}|${x.rowHere ?? ""}` })) }); })
      .catch(async (e) => { if (live) showErrorMessage(await errorMessage(e, t("goLiveData.loadFailed")), t("goLiveData.title")); })
      .finally(() => { if (live) setRowsLoading(false); });
    return () => { live = false; };
  }, [id, filters, page, t]);

  // search after a pause in typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === search ? f : { ...f, search }));
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const show = (c) => {
    setComparison(c);
    setFilters({ sheet: null, status: null, search: "" });
    setSearch("");
    setPage(0);
    setExpanded(null);
  };

  const pick = (setter) => (e) => {
    setter(e.target.files?.[0] || null);
    e.target.value = "";
  };

  const run = async () => {
    setBusy("compare");
    try {
      const r = await goLiveDataService.compare(fileA, mode === "files" ? fileB : null, includeNumbering);
      show(await goLiveDataService.comparison(r.data.id));
      if (r.data.verdict === "mirrored") showSuccessMessage(r.message, title);
      else showWarningMessage(r.message, title);
      loadHistory();
    } catch (e) {
      await fail(e, "goLiveData.compare.failed");
    } finally {
      setBusy(null);
    }
  };
  const open = async (row) => {
    setBusy(`open-${row.id}`);
    try {
      show(await goLiveDataService.comparison(row.id));
    } catch (e) {
      await fail(e, "goLiveData.loadFailed");
    } finally {
      setBusy(null);
    }
  };
  const download = async (cid) => {
    setBusy(`download-${cid}`);
    try {
      await goLiveDataService.downloadComparison(cid);
    } catch (e) {
      await fail(e, "goLiveData.downloadFailed");
    } finally {
      setBusy(null);
    }
  };

  const hereOf = (c) => (c.environment ? `${t("goLiveData.compare.here")} (${c.environment})` : t("goLiveData.compare.here"));
  // short side names for headers and tags: "in file" / "here", or "in file A" / "in file B"
  const sideA = comparison?.mode === "files" ? t("goLiveData.compare.sideFileA") : t("goLiveData.compare.sideFile");
  const sideB = comparison?.mode === "files" ? t("goLiveData.compare.sideFileB") : t("goLiveData.compare.sideHere");
  const statusText = (s) => t(`goLiveData.compare.status.${s}`, { file: sideA, here: sideB });
  const statusTag = (s) => <Tag value={statusText(s)} severity={STATUS_SEVERITY[s]} />;
  const verdictTag = (c) => <Tag value={t(`goLiveData.compare.verdict.${c.verdict}`)} severity={c.verdict === "mirrored" ? "success" : "danger"} icon={c.verdict === "mirrored" ? "pi pi-check" : "pi pi-exclamation-triangle"} />;
  const n = (v, cls) => (v ? <span className={cls}>{v}</span> : <span className="access__dash">0</span>);
  const value = (v) => (v === null || v === undefined ? <span className="access__muted">{t("goLiveData.compare.absent")}</span> : v === "" ? <span className="access__dash">-</span> : <span className="access__code">{v}</span>);
  const ready = fileA && (mode === "environment" || fileB);

  const modeOptions = [
    { value: "environment", label: t("goLiveData.compare.modeEnvironment") },
    { value: "files", label: t("goLiveData.compare.modeFiles") },
  ];
  const statusOptions = [...DIFFERING, "identical"].map((s) => ({ value: s, label: statusText(s) }));
  const sheetOptions = (comparison?.sheets || []).map((s) => ({ value: s.sheet, label: s.name }));
  const setFilter = (key, v) => {
    setFilters((f) => ({ ...f, [key]: v }));
    setPage(0);
  };

  const detail = (r) => {
    if (r.status === "different") {
      return (
        <DataTable value={r.differences} dataKey="column" size="small" className="access__table golive__diff-table">
          <Column field="header" header={t("goLiveData.colColumn")} style={{ width: "14rem" }} />
          <Column header={t("goLiveData.compare.valueIn", { side: sideA })} body={(d) => value(d.file)} />
          <Column header={t("goLiveData.compare.valueIn", { side: sideB })} body={(d) => value(d.here)} />
        </DataTable>
      );
    }
    const values = r.status === "only-here" ? r.here : r.file || r.values;
    return (
      <div className="golive__values">
        {Object.entries(values || {}).map(([k, v]) => <span key={k}><span className="access__muted">{k}</span> <span className="access__code">{v}</span></span>)}
      </div>
    );
  };

  const totals = comparison?.totals || {};
  const stats = [
    ["identical", "identical"], ["different", "different"], ["only-in-file", "onlyInFile"], ["only-here", "onlyHere"],
  ];

  return (
    <div className="golive__compare">
      <div className="golive__toolbar">
        <SelectButton value={mode} options={modeOptions} allowEmpty={false} onChange={(e) => e.value && setMode(e.value)} aria-label={t("goLiveData.compare.mode")} />
        <input ref={inputA} type="file" accept=".xlsx" className="golive__file" onChange={pick(setFileA)} aria-label={mode === "files" ? t("goLiveData.compare.chooseA") : t("goLiveData.compare.choose")} />
        <input ref={inputB} type="file" accept=".xlsx" className="golive__file" onChange={pick(setFileB)} aria-label={t("goLiveData.compare.chooseB")} />
        <Button icon="pi pi-file-excel" outlined label={fileA ? fileA.name : mode === "files" ? t("goLiveData.compare.chooseA") : t("goLiveData.compare.choose")}
          className="golive__pick" onClick={() => inputA.current?.click()} disabled={!!busy} />
        {mode === "files" ? (
          <Button icon="pi pi-file-excel" outlined label={fileB ? fileB.name : t("goLiveData.compare.chooseB")} className="golive__pick" onClick={() => inputB.current?.click()} disabled={!!busy} />
        ) : null}
        <div className="access__toggle golive__valid-only">
          <Checkbox inputId="gl-include-numbering" checked={includeNumbering} onChange={(e) => setIncludeNumbering(e.checked)} />
          <label htmlFor="gl-include-numbering">{t("goLiveData.compare.includeNumbering")}</label>
        </div>
        <Button icon="pi pi-arrow-right-arrow-left" label={t("goLiveData.compare.run")} disabled={!ready || !!busy} loading={busy === "compare"} onClick={run} />
      </div>

      {comparison ? (
        <>
          <div className="golive__batch">
            <div className="golive__batch-title">
              <strong>{t("goLiveData.compare.title", { id: comparison.id })}</strong>
              {verdictTag(comparison)}
              <span className="access__muted">
                {comparison.mode === "files"
                  ? t("goLiveData.compare.filesLine", { a: comparison.fileName || "-", b: comparison.fileBName || "-" })
                  : t("goLiveData.compare.environmentLine", { file: comparison.fileName || "-", here: hereOf(comparison) })}
              </span>
              {comparison.options?.includeNumbering ? <Tag value={t("goLiveData.compare.numberingIncluded")} severity="info" /> : null}
            </div>
            <div className="golive__batch-actions">
              {iconButton("pi pi-download", t("goLiveData.compare.download"), () => download(comparison.id), { disabled: !!busy, loading: busy === `download-${comparison.id}` })}
            </div>
          </div>

          <div className="access__stats">
            {stats.map(([s, k]) => (
              <button key={s} type="button" className={`access__stat${filters.status === s ? " is-selected" : ""}`} aria-pressed={filters.status === s}
                onClick={() => setFilter("status", filters.status === s ? null : s)}>
                <span className={`access__stat-value golive__stat-${s}`}>{totals[k] ?? 0}</span>
                <span className="access__stat-label">{statusText(s)}</span>
              </button>
            ))}
            <div className="access__stat golive__stat">
              <span className="access__stat-value">{totals.environmentSpecific ?? 0}</span>
              <span className="access__stat-label">{t("goLiveData.compare.environmentSpecific")}</span>
            </div>
          </div>

          <div className="golive__scroll">
          <DataTable value={comparison.sheets} dataKey="sheet" size="small" stripedRows className="access__table" emptyMessage={t("goLiveData.noRows")}
            selectionMode="single" selection={comparison.sheets.find((s) => s.sheet === filters.sheet) || null}
            onSelectionChange={(e) => setFilter("sheet", e.value ? e.value.sheet : null)} metaKeySelection={false}>
            <Column field="name" header={t("goLiveData.colSheet")} />
            <Column header={t("goLiveData.compare.rowsIn", { side: sideA })} body={(s) => s.inFile} style={{ width: "7rem" }} />
            <Column header={t("goLiveData.compare.rowsIn", { side: sideB })} body={(s) => s.here} style={{ width: "7rem" }} />
            <Column header={statusText("identical")} body={(s) => n(s.identical)} style={{ width: "7rem" }} />
            <Column header={statusText("different")} body={(s) => n(s.different, "golive__count--error")} style={{ width: "7rem" }} />
            <Column header={statusText("only-in-file")} body={(s) => n(s.onlyInFile, "golive__count--added")} style={{ width: "8rem" }} />
            <Column header={statusText("only-here")} body={(s) => n(s.onlyHere, "golive__count--missing")} style={{ width: "8rem" }} />
            <Column header={t("goLiveData.compare.environmentSpecific")} body={(s) => n(s.environmentSpecific)} style={{ width: "8rem" }} />
            <Column header={t("goLiveData.colResult")} style={{ width: "10rem" }}
              body={(s) => (s.different + s.onlyInFile + s.onlyHere ? <Tag value={t("goLiveData.compare.verdict.differences")} severity="danger" /> : <Tag value={t("goLiveData.compare.verdict.mirrored")} severity="success" />)} />
            <Column header="" body={(s) => (s.notes?.length ? <i className="pi pi-info-circle golive__note" title={s.notes.join("; ")} aria-label={s.notes.join("; ")} /> : null)} style={{ width: "3rem" }} />
          </DataTable>
          </div>

          <h3 className="golive__section">{t("goLiveData.compare.rowsTitle", { count: rows.total })}</h3>
          <div className="access__filters">
            <Dropdown value={filters.sheet} options={sheetOptions} onChange={(e) => setFilter("sheet", e.value)} showClear filter placeholder={t("goLiveData.compare.allSheets")} aria-label={t("goLiveData.colSheet")} />
            <Dropdown value={filters.status} options={statusOptions} onChange={(e) => setFilter("status", e.value)} showClear placeholder={t("goLiveData.compare.allDifferences")} aria-label={t("goLiveData.colResult")} />
            <span className="p-input-icon-left">
              <i className="pi pi-search" />
              <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("goLiveData.compare.search")} aria-label={t("goLiveData.compare.search")} />
            </span>
          </div>
          <div className="golive__scroll">
          <DataTable value={rows.items} dataKey="rowId" loading={rowsLoading} size="small" stripedRows className="access__table"
            lazy paginator rows={PER_PAGE} first={page * PER_PAGE} totalRecords={rows.total} onPage={(e) => setPage(e.page)}
            expandedRows={expanded} onRowToggle={(e) => setExpanded(e.data)} rowExpansionTemplate={detail}
            emptyMessage={filters.status === "identical" || filters.search || filters.sheet ? t("goLiveData.noRows") : t("goLiveData.compare.noDifferences")}>
            <Column expander style={{ width: "3rem" }} />
            <Column field="sheetName" header={t("goLiveData.colSheet")} style={{ width: "12rem" }} />
            <Column field="key" header={t("goLiveData.colKey")} body={(r) => <span className="access__code">{r.key}</span>} />
            <Column header={t("goLiveData.colResult")} body={(r) => statusTag(r.status)} style={{ width: "12rem" }} />
            <Column header={t("goLiveData.compare.differences")} body={(r) => (r.status === "different" ? r.differences.map((d) => d.header).join(", ") : <span className="access__dash">-</span>)} />
            <Column header={t("goLiveData.colRow")} body={(r) => r.rowFile ?? <span className="access__dash">-</span>} style={{ width: "5rem" }} />
          </DataTable>
          </div>

          <h3 className="golive__section">{t("goLiveData.compare.environmentSpecificTitle", { count: comparison.environmentSpecific?.length || 0 })}</h3>
          <div className="golive__scroll">
          <DataTable value={comparison.environmentSpecific || []} size="small" stripedRows paginator rows={10} className="access__table" emptyMessage={t("goLiveData.compare.noEnvironmentSpecific")}>
            <Column field="sheetName" header={t("goLiveData.colSheet")} style={{ width: "10rem" }} />
            <Column field="key" header={t("goLiveData.colKey")} body={(e) => <span className="access__code">{e.key}</span>} />
            <Column header={t("goLiveData.colColumn")} body={(e) => e.header || <span className="access__muted">{t("goLiveData.compare.wholeRow")}</span>} style={{ width: "10rem" }} />
            <Column header={t("goLiveData.compare.valueIn", { side: sideA })} body={(e) => value(e.file)} />
            <Column header={t("goLiveData.compare.valueIn", { side: sideB })} body={(e) => value(e.here)} />
            <Column header={t("goLiveData.compare.why")} body={(e) => <span className="access__muted">{e.reason}</span>} />
          </DataTable>
          </div>
        </>
      ) : null}

      <h3 className="golive__section">{t("goLiveData.compare.historyTitle")}</h3>
      <div className="golive__scroll">
      <DataTable value={history.items} dataKey="id" loading={historyLoading} size="small" stripedRows paginator rows={10} className="access__table" emptyMessage={t("goLiveData.compare.noComparisons")}>
        <Column field="id" header="#" style={{ width: "4rem" }} />
        <Column header={t("goLiveData.compare.compared")} body={(c) => (c.mode === "files"
          ? t("goLiveData.compare.filesLine", { a: c.fileName || "-", b: c.fileBName || "-" })
          : t("goLiveData.compare.environmentLine", { file: c.fileName || "-", here: hereOf(c) }))} />
        <Column header={t("goLiveData.colResult")} body={verdictTag} style={{ width: "11rem" }} />
        <Column header={statusText("different")} body={(c) => n(c.totals.different, "golive__count--error")} style={{ width: "6rem" }} />
        <Column header={t("goLiveData.compare.onlyOneSide")} body={(c) => n(c.totals.onlyInFile + c.totals.onlyHere)} style={{ width: "8rem" }} />
        <Column header={t("goLiveData.colUploaded")} body={(c) => (
          <div className="access__user"><span>{c.createdBy}</span><span className="access__muted">{formatDate(c.createdAt, { withTime: true, empty: "" })}</span></div>
        )} />
        <Column header="" style={{ width: "7rem" }} body={(c) => (
          <div className="access__row-actions">
            {iconButton("pi pi-eye", t("goLiveData.viewResult"), () => open(c), { disabled: !!busy, loading: busy === `open-${c.id}` })}
            {iconButton("pi pi-download", t("goLiveData.compare.download"), () => download(c.id), { disabled: !!busy, loading: busy === `download-${c.id}` })}
          </div>
        )} />
      </DataTable>
      </div>
    </div>
  );
};

export default CompareEnvironments;
