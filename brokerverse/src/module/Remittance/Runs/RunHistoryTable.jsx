import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import StatusChip from "../../../components/StatusChip";
import LoadingBar from "../../../components/LoadingBar";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { money, statusChip } from "../shared";
import "../remittance.scss";

const num = (value) => <span className="rm-num">{value ?? 0}</span>;

/**
 * The runs of a schedule, newest first (GET /remittance/schedules/:id/runs): started, trigger (Job, or Run now · user),
 * reason, window, the counts, the drafts created (links to their records), the result and its message. Paged by the
 * server; `perPage` 5 gives the latest runs of a View panel.
 */
const RunHistoryTable = ({ scheduleId, perPage, paginate }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => remittanceService.scheduleRuns(scheduleId, { page, perPage }), [scheduleId, page, perPage]);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !!scheduleId });
  const rows = data?.data || [];

  if (error && !data) {
    return (
      <div className="rm-inline-error" role="alert">
        <span>{t("remittance.runHistory.loadError")}</span>
        <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
      </div>
    );
  }

  const created = (r) => (
    <span className="rm-run-created">
      <span className="rm-num">{r.counts?.created ?? 0}</span>
      {(r.drafts || []).map((d) => <Link key={d.id} to={d.link}>{d.remittanceNo}</Link>)}
    </span>
  );

  return (
    <div className="bv-loading-host">
      <LoadingBar active={refreshing} />
      <DataTable value={rows} dataKey="id" size="small" loading={loading} scrollable className="rm-table" emptyMessage={t("remittance.runHistory.empty")}
        lazy paginator={paginate && (data?.total || 0) > perPage} rows={perPage} totalRecords={data?.total || 0} first={(page - 1) * perPage}
        onPage={(e) => setPage(e.page + 1)}>
        <Column header={t("remittance.runHistory.started")} body={(r) => <span className="rm-nowrap">{r.startedText}</span>} />
        <Column header={t("remittance.runHistory.trigger")} body={(r) => r.trigger?.label} />
        <Column header={t("remittance.runHistory.reason")} body={(r) => r.reason?.text || "-"} />
        <Column header={t("remittance.runHistory.window")} body={(r) => <span className="rm-nowrap">{r.window?.text}</span>} />
        <Column header={t("remittance.runHistory.scanned")} body={(r) => num(r.counts?.scanned)} align="right" />
        <Column header={t("remittance.runHistory.ready")} body={(r) => num(r.counts?.ready)} align="right" />
        <Column header={t("remittance.runHistory.held")} body={(r) => num(r.counts?.held)} align="right" />
        <Column header={t("remittance.runHistory.exceptions")} body={(r) => num(r.counts?.exceptions)} align="right" />
        <Column header={t("remittance.runHistory.created")} body={created} align="right" />
        <Column header={t("remittance.runHistory.dueToInsurer")} body={(r) => <span className="rm-num">{money(r.dueToInsurer)}</span>} align="right" />
        <Column header={t("remittance.runHistory.result")} body={(r) => <StatusChip {...statusChip(r.result?.code, r.result?.label)} />} style={{ minWidth: "8rem" }} />
        <Column header={t("remittance.runHistory.message")} body={(r) => r.message || "-"} />
      </DataTable>
    </div>
  );
};

RunHistoryTable.propTypes = {
  scheduleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  perPage: PropTypes.number,
  paginate: PropTypes.bool,
};

RunHistoryTable.defaultProps = { scheduleId: null, perPage: 20, paginate: true };

export default RunHistoryTable;
