import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import LoadingBar from "../../../components/LoadingBar";
import RowActions from "../../../components/RowActions";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { formatInstant } from "../../../utility/dateFormat";
import { statusChip } from "../shared";
import "../remittance.scss";

const PER_PAGE = 20;
const num = (value) => <span className="rm-num">{value ?? 0}</span>;

/**
 * Import history (Remittances overflow; panel 1000px): the imported policy lists, newest first, with the file, the
 * purpose, the counts, the drafts created and the status. The row menu opens the result of an import in the Import
 * policy list dialog and downloads its error report or its file.
 */
const ImportHistory = ({ visible, onHide, onView }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const loader = useCallback(() => remittanceService.listImports({ page, perPage: PER_PAGE }), [page]);
  const { data, loading, refreshing, error: loadError, reload } = useStableLoad(loader, { enabled: visible });
  const rows = data?.data || [];

  const download = (path, name) => {
    setError(null);
    remittanceService.download(path, name).catch((e) => setError(e.message));
  };
  const file = (imp) => download(remittanceService.importFilePath(imp.id), imp.file?.name);
  const actions = [
    { code: "view", label: t("remittance.importHistory.actions.view"), allowed: true },
    { code: "errors", label: t("remittance.importHistory.actions.errors"), allowed: true },
    { code: "file", label: t("remittance.importHistory.actions.file"), allowed: true },
  ];
  const act = (imp) => (action) => {
    if (action.code === "view") onView(imp.id);
    if (action.code === "errors") download(remittanceService.importErrorsPath(imp.id), `${imp.importNo}_Errors.xlsx`);
    if (action.code === "file") file(imp);
  };

  return (
    <Dialog visible={visible} onHide={onHide} header={t("remittance.importHistory.title")} modal draggable={false} resizable={false}
      style={{ width: "1000px" }} breakpoints={{ "1040px": "100vw" }} className="rm-panel"
      footer={<Button type="button" label={t("remittance.common.close")} outlined onClick={onHide} />}>
      {loadError && !data ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.importHistory.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      ) : (
        <div className="bv-loading-host">
          <LoadingBar active={refreshing} />
          {error ? <p className="rm-form__error" role="alert">{error}</p> : null}
          <DataTable value={rows} dataKey="id" size="small" loading={loading && !data} scrollable className="rm-table" emptyMessage={t("remittance.importHistory.empty")}
            lazy paginator={(data?.total || 0) > PER_PAGE} rows={PER_PAGE} totalRecords={data?.total || 0} first={(page - 1) * PER_PAGE} onPage={(e) => setPage(e.page + 1)}>
            <Column header={t("remittance.importHistory.importNo")} frozen style={{ minWidth: "9.5rem" }} body={(r) => (
              <span className="rm-cell-stack">
                <span className="rm-ref">{r.importNo}</span>
                <span className="rm-muted">{formatInstant(r.uploadedAt)}</span>
              </span>
            )} />
            <Column header={t("remittance.importHistory.by")} body={(r) => r.uploadedBy?.name || "-"} />
            <Column header={t("remittance.importHistory.filePurpose")} className="rm-col-next" body={(r) => (
              <span className="rm-cell-stack">
                <Button type="button" link className="rm-link rm-inline-link" label={r.file?.name} onClick={() => file(r)}
                  aria-label={t("remittance.importHistory.downloadFile", { name: r.file?.name })} />
                <span className="rm-muted">{r.purpose?.text || "-"}</span>
              </span>
            )} />
            <Column header={t("remittance.importHistory.rows")} body={(r) => num(r.counts?.rows)} align="right" />
            <Column header={t("remittance.importHistory.ready")} body={(r) => num(r.counts?.ready)} align="right" />
            <Column header={t("remittance.importHistory.errors")} body={(r) => num(r.counts?.errors)} align="right" />
            <Column header={t("remittance.importHistory.drafts")}
              body={(r) => (r.drafts?.length ? <span className="rm-run-created">{r.drafts.map((d) => <Link key={d.id} to={d.link} onClick={onHide}>{d.remittanceNo}</Link>)}</span> : "-")} />
            <Column header={t("remittance.importHistory.status")} body={(r) => <StatusChip {...statusChip(r.status, r.statusLabel)} />} />
            <Column header={<span className="p-sr-only">{t("remittance.importHistory.actionsColumn")}</span>} align="center" style={{ width: "3.5rem" }}
              body={(r) => <RowActions label={t("remittance.importHistory.actionsFor", { reference: r.importNo })} actions={actions} onAction={act(r)} />} />
          </DataTable>
        </div>
      )}
    </Dialog>
  );
};

ImportHistory.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** opens the result of an import (its id) in the Import policy list dialog */
  onView: PropTypes.func.isRequired,
};

ImportHistory.defaultProps = { visible: false };

export default ImportHistory;
