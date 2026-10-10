/**
 * The row preview of a validated upload (state of components/ImportDialog): the rows as the server read them with
 * their result, filtered by result (all, ready, errors ...), and the error report to download. The rows are paged by
 * the server: `loadRows(preview, { result, page, perPage })` answers { rows, total }.
 */
import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import StatusChip from "../StatusChip";
import { formatValue, NUMERIC_TYPES } from "../KeyValueGrid/formatValue";

const PER_PAGE = 50;

const UploadPreview = ({ preview, loadRows, columns, filters, onErrorReport, hasErrors }) => {
  const { t } = useTranslation();
  const [result, setResult] = useState(filters?.[0]?.value ?? null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await loadRows(preview, { result, page, perPage: PER_PAGE });
      setData({ rows: out?.rows || [], total: out?.total ?? (out?.rows || []).length });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [loadRows, preview, result, page]);

  useEffect(() => {
    load();
  }, [load]);

  const report = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onErrorReport(preview);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const cell = (c) => (row) => {
    if (c.body) return c.body(row);
    if (c.type === "result") return row[c.field] ? <StatusChip code={row[c.field].code} label={row[c.field].label} severity={row[c.field].severity} /> : null;
    return formatValue(row[c.field], c);
  };

  return (
    <section className="import-dialog__preview" aria-label={t("importDialog.rowPreview")}>
      <div className="import-dialog__preview-bar">
        {filters?.length ? (
          <span className="import-dialog__preview-filter">
            <label htmlFor="import-preview-result">{t("importDialog.showRows")}</label>
            <Dropdown inputId="import-preview-result" value={result} options={filters} optionLabel="label" optionValue="value"
              onChange={(e) => { setResult(e.value); setPage(1); }} />
          </span>
        ) : null}
        {onErrorReport && hasErrors ? (
          <Button type="button" label={t("importDialog.errorReport")} icon="pi pi-download" outlined size="small" loading={downloading} onClick={report} />
        ) : null}
      </div>
      {error ? <p className="import-dialog__error" role="alert">{error}</p> : null}
      <DataTable value={data.rows} dataKey={columns.find((c) => c.key)?.field || "row"} size="small" stripedRows scrollable scrollHeight="18rem" loading={loading}
        lazy paginator={data.total > PER_PAGE} rows={PER_PAGE} totalRecords={data.total} first={(page - 1) * PER_PAGE}
        onPage={(e) => setPage(e.page + 1)} emptyMessage={t("importDialog.noRows")} className="import-dialog__rows">
        {columns.map((c) => (
          <Column key={c.field} header={c.header} body={cell(c)} align={NUMERIC_TYPES.has(c.type) ? "right" : undefined}
            style={c.width ? { width: c.width } : undefined} />
        ))}
      </DataTable>
    </section>
  );
};

UploadPreview.propTypes = {
  /** the validation answer of the server */
  preview: PropTypes.object.isRequired,
  /** (preview, { result, page, perPage }) => Promise<{ rows, total }> */
  loadRows: PropTypes.func.isRequired,
  /** [{ field, header, type (text, amount, number, date, result), key, width, body }]; a result cell is a chip of { code, label } */
  columns: PropTypes.arrayOf(PropTypes.shape({ field: PropTypes.string.isRequired, header: PropTypes.node, type: PropTypes.string, key: PropTypes.bool })).isRequired,
  /** result filter: [{ label, value }], the first one chosen at the start */
  filters: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.any })),
  /** downloads the error report of the preview */
  onErrorReport: PropTypes.func,
  hasErrors: PropTypes.bool,
};

UploadPreview.defaultProps = { filters: [], onErrorReport: null, hasErrors: false };

export default UploadPreview;
