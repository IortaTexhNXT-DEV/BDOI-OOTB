import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import DetailSection from "../../../components/DetailSection";
import InputField from "../../../components/InputField";
import LoadingBar from "../../../components/LoadingBar";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { showSuccess } from "../../Remittance/shared";
import BatchDetailDialog from "../BatchDetailDialog";
import { BATCH_STATUSES, IncentiveHeader } from "../common";

const Approvals = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Pending Approval");
  const [period, setPeriod] = useState(null);
  const [openBatch, setOpenBatch] = useState(null);

  const loader = useCallback(() => incentiveService.approvals(), []);
  const { data, loading, refreshing, reload } = useStableLoad(loader);
  const all = data?.approvals || [];
  const summary = data?.summary || null;
  const periods = [...new Set(all.map((a) => a.period))].map((p) => ({ label: p, value: p }));

  const rows = all.filter((a) => {
    const text = search.trim().toLowerCase();
    const matches = !text || [a.batchId, a.period, a.submittedBy, a.createdBy].some((v) => String(v || "").toLowerCase().includes(text));
    return matches && (!status || a.status === status) && (!period || a.period === period);
  });

  const changed = (batch, message) => {
    reload();
    if (message) showSuccess(toast, message, batch?.batchId);
  };

  return (
    <div className="inc-page">
      <Toast ref={toast} />
      <IncentiveHeader title={t("incentive.incentiveApprovals")} help={t("incentive.help.approvals")} />

      <StatCards items={[
        { key: "pending", label: t("incentive.board.pending"), value: summary ? summary.pending : null, onClick: () => setStatus("Pending Approval"), active: status === "Pending Approval" },
        { key: "amount", label: t("incentive.board.pendingAmount"), value: summary ? formatCurrency(summary.pendingAmount) : null },
        { key: "approved", label: t("incentive.board.approvedToday"), value: summary ? summary.approvedToday : null },
        { key: "rejected", label: t("incentive.board.rejectedToday"), value: summary ? summary.rejectedToday : null },
      ]} />

      <DetailSection className="bv-loading-host" flush>
        <LoadingBar active={refreshing} />
        <div className="inc-filters">
          <InputField placeholder={t("incentive.filters.searchApprovals")} value={search} onChange={(e) => setSearch(e.target.value)} icon={<SvgSearchIcon />}
            aria-label={t("incentive.filters.search")} />
          <Dropdown value={status} options={BATCH_STATUSES.map((s) => ({ label: s, value: s }))} onChange={(e) => setStatus(e.value)} showClear
            placeholder={t("incentive.filters.allStatuses")} aria-label={t("incentive.filters.status")} />
          <Dropdown value={period} options={periods} onChange={(e) => setPeriod(e.value)} showClear placeholder={t("incentive.filters.allPeriods")}
            aria-label={t("incentive.filters.period")} />
        </div>
        <DataTable value={rows} dataKey="batchId" loading={loading} paginator={rows.length > 20} rows={20} size="small" className="inc-table" emptyMessage={t("incentive.batch.noBatches")}
          onRowClick={(e) => setOpenBatch(e.data.batchId)} rowClassName={() => "inc-row-link"}>
          <Column header={t("incentive.batch.batch")} field="batchId" />
          <Column header={t("incentive.batch.period")} field="period" />
          <Column header={t("incentive.batch.submittedOn")} body={(a) => formatDate(a.submittedDate)} />
          <Column header={t("incentive.batch.submittedBy")} body={(a) => a.submittedBy || "-"} />
          <Column header={t("incentive.batch.programs")} body={(a) => (a.programsIncluded || []).length} className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.agents")} field="agentCount" className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.totalPayout")} body={(a) => formatCurrency(a.totalAmount)} className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.board.waiting")} body={(a) => (a.status === "Pending Approval" ? t("incentive.board.days", { count: a.daysWaiting || 0 }) : "-")}
            className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.batch.status")} body={(a) => <StatusChip label={a.status} />} />
          <Column header={t("incentive.batch.actions")} body={(a) => (
            <Button type="button" icon="pi pi-eye" text rounded aria-label={t("incentive.viewDetails")} tooltip={t("incentive.viewDetails")}
              onClick={(e) => { e.stopPropagation(); setOpenBatch(a.batchId); }} />
          )} />
        </DataTable>
      </DetailSection>

      <BatchDetailDialog batchId={openBatch} onHide={() => setOpenBatch(null)} onChanged={changed} />
    </div>
  );
};

export default Approvals;
