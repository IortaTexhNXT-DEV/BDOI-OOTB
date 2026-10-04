import { InputText } from "primereact/inputtext";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import SvgArrow from "../../../../../assets/icons/SvgArrow";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "../../../clientView/index.scss";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import claimsService from "../../../../../services/claimsService";
import { Skeleton } from "primereact/skeleton";
import { setPolicyHolderData } from "../../../../claimsModule/claimDetails/store/claimDetailsReducers";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";
import { notifyError } from "../../../../../utility/dialogs";
import { statusLabel } from "../../../../../utils/statusSeverity";

const STATUS_CLASS_MAP = {
  processing: "company__status__type__green",
  pending: "company__status__type__green",
  approved: "company__status__type__blue",
  completed: "company__status__type__blue",
  settled: "company__status__type__blue",
  rejected: "client__view__type__red",
  cancelled: "client__view__type__red",
  expired: "client__view__type__red",
};

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
    // Preserve original ID fields for navigation
    id: record.id,
    claimId: record.claimId,
    claimRefId: record.claimRefId,
  };
};

const LeadListingAllTable = ({ clientId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  // Skeleton rows only on the first load; a refresh keeps the rows on screen.
  const showSkeleton = loading && !filteredClaims.length;
  const [error, setError] = useState(null);

  const template2 = useMemo(
    () => ({
      layout:
        "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
      RowsPerPageDropdown: (options) => {
        const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

        return (
          <div className="table__selector">
            <React.Fragment>
              <span
                className="table__selector__text"
                style={{ color: "var(--text-color)", userSelect: "none" }}
              >
                {t("tables.rowsPerPage")}{" "}
              </span>
              <Dropdown
                value={options.value}
                className="pagedropdown_container"
                options={dropdownOptions}
                onChange={options.onChange}
                dropdownIcon={<SvgDownArrow />}
              />
            </React.Fragment>
          </div>
        );
      },
    }),
    []
  );

  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("claimNumber");
  const cities = [
    { name: t("claims.claimNumber"), code: "claimNumber" },
    { name: t("tables.policyNumber"), code: "policyNumber" },
  ];

  useEffect(() => {
    if (!clientId) {
      setClaims([]);
      setFilteredClaims([]);
      return;
    }

    let active = true;
    const loadClaims = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await claimsService.getClaims({ clientId });
        if (!active) {
          return;
        }

        if (response.success) {
          const rawClaims = response.data || [];

          const normalized = rawClaims
            .map(normalizeClaimRecord)
            .filter(Boolean);
          setClaims(normalized);
          setFilteredClaims(normalized);
        } else {
          throw new Error(response.error || "Failed to load claims");
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err.message || "Failed to fetch claims");
        setClaims([]);
        setFilteredClaims([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadClaims();

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!search) {
      setFilteredClaims(claims);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = claims.filter((item) => {
      if (globalFilter === "policyNumber") {
        return (item.policyNumber || "").toLowerCase().includes(searchLower);
      }

      return (item.claimNumber || "").toLowerCase().includes(searchLower);
    });

    setFilteredClaims(filtered);
  }, [search, globalFilter, claims]);

  const formatDate = (value) => formatConfiguredDate(value, { empty: "N/A" });

  const renderPolicyNumber = (rowData) => {
    const normalized = normalizeClaimRecord(rowData);
    if (showSkeleton) {
      return (
        <div className="name__box__container">
          <Skeleton width="2rem" shape="circle" className="mr-2" />
          <Skeleton width="6rem" />
        </div>
      );
    }

    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">
            {normalized?.policyNumber?.toString().toUpperCase() || "N/A"}
          </div>
        </div>
      </div>
    );
  };

  const renderClaimNumber = (rowData) => {
    if (showSkeleton) {
      return <Skeleton width="8rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    return (
      <div className="category__text">
        {normalized?.claimNumber?.toString().toUpperCase() || "N/A"}
      </div>
    );
  };

  const renderDate = (rowData) => {
    if (showSkeleton) {
      return <Skeleton width="6rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    return <div className="date__text">{formatDate(normalized?.issued)}</div>;
  };

  const renderExpiryDate = (rowData) => {
    if (showSkeleton) {
      return <Skeleton width="6rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    return <div className="date__text">{formatDate(normalized?.expiry)}</div>;
  };

  const renderStatus = (rowData) => {
    if (showSkeleton) {
      return <Skeleton width="4rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    const status = normalized?.status || "processing";
    const className = STATUS_CLASS_MAP[status] || STATUS_CLASS_MAP.processing;

    return <div className={className}>{statusLabel(status)}</div>;
  };

  const renderViewEditButton = (rowData) => {
    return (
      <div className="btn__container__view__edit">
        <div>
          <Button
            icon={<SvgArrow />}
            className="view__btn"
            onClick={() => handleView(rowData)} aria-label="Open" tooltip="Open" tooltipOptions={{ position: "top" }} />
        </div>
      </div>
    );
  };

  const handleView = (rowData) => {
    const claim = normalizeClaimRecord(rowData);

    if (!claim) {
      return;
    }

    const status = claim.status?.toUpperCase();
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

    // Route based on claim status
    if (status === "REJECTED") {
      navigate("/agent/claimrejected", {
        state: {
          claimId: claimId,
          clientId,
          policyNumber: claim.policyNumber,
        },
      });
      return;
    }

    if (status === "PROCESSING" || status === "PENDING") {
      navigate(`/agent/claimrequest/requestapproval/${claimId}`, {
        state: {
          claimId: claimId,
          clientId,
          policyNumber: claim.policyNumber,
        },
      });
      return;
    }

    if (status === "SETTLED" || status === "COMPLETED") {
      navigate(`/agent/claimrequest/settlementdetails/${claimId}`, {
        state: {
          claimId: claimId,
          clientId,
          policyNumber: claim.policyNumber,
        },
      });
      return;
    }

    // Default navigation for other statuses or unknown status
    navigate(`/agent/claimrequest/requestapproval/${claimId}`, {
      state: {
        claimId: claimId,
        clientId,
        policyNumber: claim.policyNumber,
      },
    });
  };

  const ViewheaderStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const rendercheckedHeader = (value) => value;

  const renderUncheckedHeader = (value) => value;

  return (
    <div>
      <div className="grid">
        <div className="col-12 md:col-9 lg:col-9">
          <span className="p-input-icon-left" style={{ width: "100%" }}>
            <i className="pi pi-search" />
            <InputText
              placeholder={t("tables.search")}
              style={{
                width: "100%",
                padding: "1rem 2.75rem",
                borderRadius: "10px",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <Dropdown
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.value)}
            options={cities}
            optionLabel="name"
            optionValue="code"
            placeholder={t("tables.searchBy")}
            className="feat_searchby_container"
            dropdownIcon={<SvgDownArrow />}
          />
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={filteredClaims}
          paginator
          rows={20}
          rowsPerPageOptions={[20, 50, 100]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          className="corrections__table__main"
          dataKey="id"
          tableStyle={{ minWidth: "50rem" }}
          scrollable={true}
          scrollHeight="60vh"
          loading={loading}
          emptyMessage={
            loading
              ? t("clientView.loadingClaims")
              : error
              ? `${t("messages.error")} ${error}`
              : t("clientView.noClaimsForClient")
          }
        >
          <Column
            body={renderPolicyNumber}
            header={rendercheckedHeader(t("tables.policyNumber"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderClaimNumber}
            header={renderUncheckedHeader(t("claims.claimNumber"))}
            headerStyle={headerStyle}
          ></Column>

          <Column
            body={renderDate}
            header={renderUncheckedHeader(t("tables.policyIssued"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderExpiryDate}
            header={renderUncheckedHeader(t("tables.policyExpiry"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderStatus}
            header={renderUncheckedHeader(t("tables.status"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderViewEditButton}
            header={renderUncheckedHeader(t("tables.actions"))}
            headerStyle={{ ...ViewheaderStyle, textAlign: "center" }}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default LeadListingAllTable;
