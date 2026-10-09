import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import claimsService from "../../../services/claimsService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate } from "../../../utility/dateFormat";
import { useServerList } from "../../../hooks/useServerList";
import { statusLabel } from "../../../utils/statusSeverity";
import { EmptyState, FilterBar, RowActions, StatusChip } from "../../../components/RecordPage";
import { stepForStatus } from "../../claimsModule/shared/claimJourney";

// claim status codes of the server (it also accepts "open" for every status still being worked on)
const STATUSES = ["open", "registered", "in-review", "pending-approval", "approved", "settled", "closed", "rejected"];

/** Screen of the step a claim is at, to carry on with it. */
const CONTINUE_ROUTE = {
  review: (id) => `/agent/claimrequest/requestapproval/${id}`,
  adjuster: (id) => `/agent/claimrequest/adjustersubmission/${id}`,
  approval: (id) => `/agent/claimrequest/settlementapproval/${id}`,
  payment: (id) => `/agent/claimdetailedview/${id}`,
};

/**
 * Operations > Claims list: paged, searched (claim number, policy number, client) and filtered by status on the
 * server. The search, status and page are kept while a claim is opened (the state belongs to the page).
 */
const ClaimTable = ({ state, patch }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await claimsService.getClaimsList(page, pageSize, { search: state.search.trim(), status: state.status });
    if (!res.success) throw new Error(res.error || t("claims.loadFailed", { defaultValue: "Claims could not be loaded" }));
    const body = res.data || {};
    const claims = body.data?.claims || body.claims || [];
    const total = body.data?.pagination?.total ?? body.total ?? claims.length;
    return { rows: claims, total };
  }, [state.search, state.status, t]);
  const list = useServerList(fetchPage, { key: "claims" });

  const lobOf = (r) => r.lob || r.productType;
  const open = (r) => navigate(`/agent/claimdetail/${r.id}`, { state: lobOf(r) ? { lob: lobOf(r), productType: lobOf(r) } : undefined });
  const next = (r) => CONTINUE_ROUTE[stepForStatus(r.lifecycleStatus)];
  const actions = (r) => (
    <RowActions
      actions={[{ icon: "pi pi-eye", label: t("claimFlow.viewClaim"), onClick: () => open(r) }]}
      menu={[
        { label: t("claimFlow.continueClaim"), icon: "pi pi-arrow-right", hidden: !next(r) || ["closed", "rejected"].includes(r.lifecycleStatus),
          command: () => navigate(next(r)(r.id), { state: { claimId: r.id, clientId: r.clientId } }) },
        { label: t("claimFlow.openClient"), icon: "pi pi-user", hidden: !r.clientId, command: () => navigate(`/agent/clientview/${r.clientId}`) },
        { label: t("claimFlow.history"), icon: "pi pi-history", command: () => navigate(`/agent/claimaudittrail/${r.id}`) },
      ]} />
  );
  const statusOptions = [{ label: t("claims.allStatuses", { defaultValue: "All statuses" }), value: "" },
    ...STATUSES.map((s) => ({ label: t(`claims.statusFilter.${s}`, { defaultValue: statusLabel(s) }), value: s }))];
  const stack = (main, sub) => <span className="bv-cell-stack"><span className="bv-nowrap">{main || "—"}</span>{sub ? <small>{sub}</small> : null}</span>;

  return (
    <>
      <FilterBar active={!!(state.search || state.status)} onClear={() => patch({ search: "", status: "" })}>
        <span className="p-input-icon-left bv-filter-bar__search">
          <i className="pi pi-search" />
          <InputText placeholder={t("claims.searchPlaceholder", { defaultValue: "Search by claim number, policy number or client" })} aria-label={t("listCommon.search")}
            value={state.search} onChange={(e) => patch({ search: e.target.value })} />
        </span>
        <Dropdown value={state.status} options={statusOptions} onChange={(e) => patch({ status: e.value })} aria-label={t("claims.colStatus", { defaultValue: "Status" })} />
      </FilterBar>
      <DataTable {...list.tableProps} dataKey="id" size="small"
        emptyMessage={list.error || <EmptyState icon="pi-flag" title={t("claims.noClaims", { defaultValue: "No claims found" })} text={t("claimFlow.emptyText")} />}>
        <Column header={t("claimFlow.col.claim")} body={(r) => stack(r.claimNumber, r.clientName || r.policyHolderName)} />
        <Column header={t("claimFlow.col.policy")} body={(r) => stack(r.policyNumber, r.productType || r.lob)} />
        <Column header={t("claimFlow.col.loss")} body={(r) => stack(r.dateOfIncident ? formatDate(r.dateOfIncident) : null, r.typeOfIncident)} />
        <Column header={t("claimFlow.col.reported")} body={(r) => formatDate(r.reportedDate, { empty: "—" })} className="bv-nowrap" />
        <Column header={t("claimFlow.col.estimate")} body={(r) => (r.estimatedClaimAmount ? formatCurrency(r.estimatedClaimAmount) : "—")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("claimFlow.col.status")} body={(r) => <StatusChip status={r.lifecycleStatus || r.status} label={r.claimStatus || r.status} />} />
        <Column header={t("claimFlow.col.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" />
      </DataTable>
    </>
  );
};

ClaimTable.propTypes = {
  state: PropTypes.shape({ search: PropTypes.string, status: PropTypes.string }).isRequired,
  patch: PropTypes.func.isRequired,
};

export default ClaimTable;
