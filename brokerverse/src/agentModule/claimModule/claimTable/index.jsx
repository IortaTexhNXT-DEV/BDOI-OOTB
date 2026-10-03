import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import "../../claimModule/index.scss";
import claimsService from "../../../services/claimsService";
import { setPolicyHolderData } from "../../claimsModule/claimDetails/store/claimDetailsReducers";
import { notifyError } from "../../../utility/dialogs";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";
import { useListState, useServerList } from "../../../hooks/useServerList";
import { statusLabel, statusSeverity } from "../../../utils/statusSeverity";

// claim status codes of the server (it also accepts "open" for every status still being worked on)
const STATUSES = ["open", "registered", "in-review", "pending-approval", "approved", "settled", "closed", "rejected"];

const normalizeClaimRecord = (record) => {
  if (!record) {
    return null;
  }

  const policyNumber =
    record.policyNumber ||
    record.policy?.policyNumber ||
    record.policyRefId ||
    record.policyId ||
    "N/A";

  const claimNumber =
    record.claimNumber || record.claimRefId || record.id || record.claimId;

  const status = (
    record.status ||
    record.claimStatus ||
    record.Status ||
    "Processing"
  )
    .toString()
    .toLowerCase();

  const issued =
    record.policyIssuedDate ||
    record.policy?.issuedDate ||
    record.Date ||
    record.claimDate;
  const expiry =
    record.policyExpiry || record.policy?.expiry || record.expiryDate;

  // Extract policy holder name from various possible locations
  const policyHolderName =
    record.policyHolderName ||
    record.PolicyHolderName ||
    record.clientName ||
    record.ClientName ||
    record.insuredName ||
    record.InsuredName ||
    record.policy?.policyHolderName ||
    record.policy?.PolicyHolderName ||
    record.policy?.clientName ||
    record.policy?.ClientName ||
    record.policy?.insuredName ||
    record.policy?.InsuredName ||
    record.policy?.policyHolder ||
    record.policy?.PolicyHolder ||
    record.policy?.holderName ||
    record.policy?.HolderName ||
    record.policy?.name ||
    record.policy?.Name ||
    (record.policy?.firstName && record.policy?.lastName
      ? `${record.policy.firstName} ${record.policy.lastName}`
      : null) ||
    record.policy?.fullName ||
    record.policy?.customerName ||
    record.policy?.CustomerName ||
    record.lead?.policyHolderName ||
    record.lead?.PolicyHolderName ||
    record.lead?.clientName ||
    record.lead?.ClientName ||
    record.lead?.insuredName ||
    record.lead?.InsuredName ||
    record.lead?.policyHolder ||
    record.lead?.PolicyHolder ||
    record.lead?.holderName ||
    record.lead?.HolderName ||
    record.lead?.name ||
    record.lead?.Name ||
    (record.lead?.firstName && record.lead?.lastName
      ? `${record.lead.firstName} ${record.lead.lastName}`
      : null) ||
    record.lead?.fullName ||
    record.lead?.customerName ||
    record.lead?.CustomerName ||
    "Loading...";

  return {
    ...record,
    policyNumber,
    claimNumber,
    status,
    issued,
    expiry,
    policyHolderName,
  };
};

/**
 * Operations > Claims list: paged, searched (claim number, policy number, client) and filtered by status on the
 * server. The search, status and page are kept while a claim is opened.
 */
const ClaimTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [state, patch] = useListState("claims", { search: "", status: "" });

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await claimsService.getClaimsList(page, pageSize, { search: state.search.trim(), status: state.status });
    if (!res.success) throw new Error(res.error || t("claims.loadFailed", { defaultValue: "Claims could not be loaded" }));
    const body = res.data || {};
    const claims = body.data?.claims || body.claims || [];
    const total = body.data?.pagination?.total ?? body.total ?? claims.length;
    return { rows: claims, total };
  }, [state.search, state.status, t]);
  const list = useServerList(fetchPage, { key: "claims" });

  const handleAuditTrail = (rowData) => {
    const claimId = rowData.id || rowData.claimId || rowData.claim_id;
    if (claimId) {
      navigate(`/agent/claimaudittrail/${claimId}`);
    } else {
      logger.error("No claimId found for audit trail");
    }
  };

  const getLobFromClaim = (row) => {
    return (
      row?.lob ||
      row?.productType ||
      row?.policy?.productType ||
      row?.policy?.lob
    );
  };

  const handleViewDetail = (rowData) => {
    const claimId = rowData.id || rowData.claimId || rowData.claim_id;
    if (claimId) {
      const lob = getLobFromClaim(rowData);
      navigate(`/agent/claimdetail/${claimId}`, {
        state: lob ? { lob, productType: lob } : undefined,
      });
    } else {
      logger.error("No claimId found for viewing details");
    }
  };

  const handleView = (rowData) => {
    const claim = normalizeClaimRecord(rowData);

    if (!claim) {
      return;
    }

    const status = claim.status?.toUpperCase();

    if (status === "REJECTED") {
      navigate("/agent/claimrejected", {
        state: {
          claimId: claim.claimNumber,
          policyNumber: claim.policyNumber,
          clientId:
            claim.clientId ||
            claim.policy?.clientId ||
            claim.lead?.clientId,
        },
      });
      return;
    }

    if (status === "PENDING APPROVAL") {
      const pendingClaimId = claim.id || claim.claimId;
      navigate(`/agent/claimrequest/settlementapproval/${pendingClaimId}`, {
        state: { claimId: pendingClaimId, policyNumber: claim.policyNumber },
      });
      return;
    }

    if (status === "PROCESSING" || status === "PENDING") {
      const claimId = claim.id || claim.claimId;

      // Validate that we have a proper claim ID (not claim number)
      if (!claimId) {
        notifyError("Unable to navigate: No valid claim ID found");
        return;
      }

      // Check if the claimId looks like a claim number (contains "CLAIM-" or similar patterns)
      if (claimId.includes("CLAIM-") || claimId.includes("Motor-")) {
        notifyError(
          "Unable to navigate: Claim ID appears to be a claim number instead of database ID"
        );
        return;
      }

      // Extract policy holder name and claim number for Redux

      const policyHolderName = claim?.policyHolderName || "Loading...";

      const claimNumber =
        claim?.claimNumber || claim?.claim_number || "Loading...";

      // Save claim data to Redux for future pages
      dispatch(
        setPolicyHolderData({
          policyHolderName,
          policyNumber: claim.policyNumber || "Loading...",
          claimNumber,
        })
      );

      const lob = getLobFromClaim(claim);
      navigate(`/agent/claimrequest/requestapproval/${claimId}`, {
        state: {
          claimId: claimId,
          policyNumber: claim.policyNumber,
          clientId:
            claim.clientId ||
            claim.policy?.clientId ||
            claim.lead?.clientId,
          ...(lob && { lob, productType: lob }),
        },
      });
      return;
    }

    const claimId = claim.id || claim.claimId;

    // Validate that we have a proper claim ID (not claim number)
    if (!claimId) {
      notifyError("Unable to navigate: No valid claim ID found");
      return;
    }

    // Check if the claimId looks like a claim number (contains "CLAIM-" or similar patterns)
    if (claimId.includes("CLAIM-") || claimId.includes("Motor-")) {
      notifyError(
        "Unable to navigate: Claim ID appears to be a claim number instead of database ID"
      );
      return;
    }

    // Extract policy holder name and claim number for Redux

    const policyHolderName = claim?.policyHolderName || "Loading...";

    const claimNumber =
      claim?.claimNumber || claim?.claim_number || "Loading...";

    // Save claim data to Redux for future pages
    dispatch(
      setPolicyHolderData({
        policyHolderName,
        policyNumber: claim.policyNumber || "Loading...",
        claimNumber,
      })
    );

    const lob = getLobFromClaim(claim);
    navigate(`/agent/claimdetailedview/${claimId}`, {
      state: {
        claim,
        policyNumber: claim.policyNumber,
        ...(lob && { lob, productType: lob }),
      },
    });
  };

  const nA = t("policyDetail.nA");
  const actions = (rowData) => (
    <div className="flex gap-1 justify-content-end">
      <Button icon="pi pi-eye" text rounded size="small" aria-label={t("claims.viewDetails")} tooltip={t("claims.viewDetails")} tooltipOptions={{ position: "top" }}
        onClick={() => handleViewDetail(rowData)} />
      <Button icon="pi pi-arrow-right" text rounded size="small" aria-label={t("claims.viewClaim")} tooltip={t("claims.viewClaim")} tooltipOptions={{ position: "top" }}
        onClick={() => handleView(rowData)} />
      <Button icon="pi pi-history" text rounded size="small" aria-label={t("claims.auditTrail", { defaultValue: "Audit trail" })} tooltip={t("claims.auditTrail", { defaultValue: "Audit trail" })}
        tooltipOptions={{ position: "top" }} onClick={() => handleAuditTrail(rowData)} />
    </div>
  );
  const clientName = (r) => r.ClientName || r.clientName || r.policyHolderName || r.policy_holder_name
    || (r.lead?.firstName && r.lead?.lastName ? `${r.lead.firstName} ${r.lead.lastName}` : r.policy?.insuredName) || nA;
  const status = (r) => {
    const value = r.status || r.claimStatus;
    return value ? <Tag value={statusLabel(value)} severity={statusSeverity(value)} /> : null;
  };
  const statusOptions = [{ label: t("claims.allStatuses", { defaultValue: "All statuses" }), value: "" }, ...STATUSES.map((s) => ({ label: t(`claims.statusFilter.${s}`, { defaultValue: statusLabel(s) }), value: s }))];

  return (
    <div>
      <div className="bv-list-toolbar">
        <span className="p-input-icon-left bv-list-search">
          <i className="pi pi-search" />
          <InputText placeholder={t("claims.searchPlaceholder", { defaultValue: "Search by claim number, policy number or client" })} aria-label={t("listCommon.search")}
            value={state.search} onChange={(e) => patch({ search: e.target.value })} />
        </span>
        <Dropdown value={state.status} options={statusOptions} onChange={(e) => patch({ status: e.value })} className="bv-list-filter" aria-label={t("claims.colStatus", { defaultValue: "Status" })} />
      </div>
      <DataTable {...list.tableProps} scrollable dataKey="id" size="small" stripedRows className="corrections__table__main"
        emptyMessage={list.error || t("claims.noClaims", { defaultValue: "No claims found" })}>
        <Column header={t("claims.colClaimNumber", { defaultValue: "Claim Number" })} body={(r) => <span className="nowrap">{normalizeClaimRecord(r)?.claimNumber?.toString().toUpperCase() || nA}</span>} />
        <Column header={t("claims.colClientName", { defaultValue: "Client Name" })} body={clientName} style={{ minWidth: "11rem" }} />
        <Column header={t("claims.colPolicyNumber", { defaultValue: "Policy Number" })} body={(r) => <span className="nowrap">{normalizeClaimRecord(r)?.policyNumber?.toString().toUpperCase() || nA}</span>} />
        <Column header={t("claims.colReported", { defaultValue: "Reported" })} body={(r) => formatAppDate(r.reportedDate || normalizeClaimRecord(r)?.issued, { empty: nA })} />
        <Column header={t("claims.colProduct", { defaultValue: "Product" })} body={(r) => r.ProductDescription || r.productDescription || r.productType || r.lob || nA} />
        <Column header={t("claims.colStatus", { defaultValue: "Status" })} body={status} />
        <Column header={t("claims.colActions", { defaultValue: "Actions" })} body={actions} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
      </DataTable>
    </div>
  );
};

export default ClaimTable;
