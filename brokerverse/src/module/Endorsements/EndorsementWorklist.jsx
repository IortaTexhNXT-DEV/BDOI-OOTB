import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import PageHeader from "../../components/PageHeader";
import { EmptyState, FilterBar, RowActions, SectionCard, StatusChip } from "../../components/RecordPage";
import endorsementService from "../../services/endorsementService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { formatDate } from "../../utility/dateFormat";
import { notifyError } from "../../utility/dialogs";

/** Work list filters, in the order of the endorsement flow (TIS-BRD-ENDT-02); "" lists every endorsement. */
export const ENDORSEMENT_FILTERS = ["PendingApproval", "Approved", "PendingCustomer", "Draft", "Completed", "Rejected", ""];
const PAGE_SIZE = 20;
const num = { className: "bv-num", headerClassName: "bv-num" };

/** Where a row opens: the rejected view for a rejected endorsement, the summary with its workflow for the others. */
export const endorsementRoute = (e) => {
  const ref = e.endorsementId || e.id || e.endorsementNumber;
  return String(e.status || "").toUpperCase() === "REJECTED" ? `/agent/endorsement/rejected/${ref}` : `/agent/endorsement/summary/${ref}`;
};

/**
 * Operations > Endorsements: the endorsements of every policy the user may see as one work list (TIS-BRD-ENDT-02), by
 * status: awaiting approval, approved and to send, sent and to complete with the insurer's number. An endorsement is
 * raised from the policy; this list finds it again without going through the client.
 */
const EndorsementWorklist = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const [status, setStatus] = useState("PendingApproval");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await endorsementService.getEndorsements({ status: status || undefined, search: search.trim() || undefined, page: page + 1, perPage: PAGE_SIZE });
    setLoading(false);
    if (!r.success) {
      notifyError(r.error);
      return;
    }
    const data = r.data?.data || r.data || {};
    setRows(Array.isArray(data.items) ? data.items : []);
    setTotal(data.pagination?.total || 0);
  }, [status, search, page]);
  useEffect(() => { load(); }, [load]);

  const title = t("endorsementWorklist.title");
  const options = ENDORSEMENT_FILTERS.map((value) => ({ value, label: t(`endorsementWorklist.filter.${value || "all"}`) }));
  const open = (e) => navigate(endorsementRoute(e), { state: { endorsementNumber: e.endorsementNumber, policyId: e.policyId, clientId: e.clientId } });

  return (
    <div className="bv-ops-page">
      <PageHeader title={title} home={t("endorsementWorklist.home")} trail={[title]} help={t("endorsementWorklist.help")} />
      <SectionCard title={t("endorsementWorklist.list")}>
        <FilterBar active={status !== "PendingApproval" || !!search} onClear={() => { setStatus("PendingApproval"); setSearch(""); setPage(0); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={t("endorsementWorklist.search")}
              aria-label={t("endorsementWorklist.search")} />
          </span>
          <Dropdown value={status} options={options} onChange={(e) => { setStatus(e.value); setPage(0); }} aria-label={t("endorsementWorklist.status")} />
        </FilterBar>
        <DataTable value={rows} dataKey="endorsementId" loading={loading} size="small" lazy paginator rows={PAGE_SIZE} first={page * PAGE_SIZE}
          totalRecords={total} onPage={(e) => setPage(e.page)}
          emptyMessage={<EmptyState icon="pi-pencil" title={t("endorsementWorklist.emptyTitle")} text={t("endorsementWorklist.emptyText")} />}>
          <Column header={t("endorsementWorklist.col.endorsement")}
            body={(e) => <span className="bv-cell-stack"><span className="bv-nowrap">{e.endorsementNumber || "—"}</span><small>{e.policyNumber}</small></span>} />
          <Column header={t("endorsementWorklist.col.client")} body={(e) => e.insuredName || e.clientName || "—"} />
          <Column header={t("endorsementWorklist.col.effective")} body={(e) => formatDate(e.effectiveDate)} className="bv-nowrap" />
          <Column header={t("endorsementWorklist.col.premiumChange")} body={(e) => formatCurrency(Number(e.premiumDelta) || 0)} {...num} />
          <Column header={t("endorsementWorklist.col.status")} body={(e) => <StatusChip status={e.status} />} />
          <Column header={t("endorsementWorklist.col.actions")} className="bv-actions" headerClassName="bv-actions"
            body={(e) => <RowActions actions={[{ icon: "pi pi-eye", label: t("endorsementWorklist.open"), onClick: () => open(e) }]} />} />
        </DataTable>
      </SectionCard>
    </div>
  );
};

export default EndorsementWorklist;
