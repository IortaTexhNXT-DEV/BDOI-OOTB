import { InputText } from "primereact/inputtext";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import SvgArrow from "../../../assets/icons/SvgArrow";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "../../claimModule/index.scss";
import SvgMotorTable from "../../../assets/agentIcon/SvgMotorTable";
import { Skeleton } from "primereact/skeleton";
import claimsService from "../../../services/claimsService";
import { setPolicyHolderData } from "../../claimsModule/claimDetails/store/claimDetailsReducers";

const STATUS_CLASS_MAP = {
  processing: "company__status__type__green",
  pending: "company__status__type__green",
  approved: "company__status__type__blue",
  completed: "company__status__type__blue",
  rejected: "client__view__type__red",
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
  };
};

const ClaimTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("claimNumber");

  const cities = [
    { name: t("claims.claimNumberFilter"), code: "claimNumber" },
    { name: t("claims.policyNumberFilter"), code: "policyNumber" },
  ];

  const template2 = useMemo(
    () => ({
      layout:
        "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
      RowsPerPageDropdown: (options) => {
        const dropdownOptions = [
          { label: 5, value: 5 },
          { label: 10, value: 10 },
          { label: 20, value: 20 },
          { label: 120, value: 120 },
        ];

        return (
          <div className="table__selector">
            <React.Fragment>
              <span
                className="table__selector__text"
                style={{ color: "var(--text-color)", userSelect: "none" }}
              >
                Rows per page:{" "}
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

  const handleAuditTrail = (rowData) => {
    const claimId = rowData.id || rowData.claimId || rowData.claim_id;
    if (claimId) {
      navigate(`/agent/claimaudittrail/${claimId}`);
    } else {
      console.error("No claimId found for audit trail");
    }
  };

  const renderViewEditButton = (rowData) => {
    return (
      <div
        className="btn__container__view__edit"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Button
          icon="pi pi-eye"
          className="p-button-info p-button-text"
          onClick={() => handleViewDetail(rowData)}
          tooltip={t("claims.viewDetails")}
          tooltipOptions={{ position: "top" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "40px",
            height: "40px",
          }}
        />
        <Button
          icon={<SvgArrow />}
          className="view__btn"
          onClick={() => handleView(rowData)}
          tooltip={t("claims.viewClaim")}
          tooltipOptions={{ position: "top" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "40px",
            height: "40px",
          }}
        />
        <Button
          icon="pi pi-history"
          className="p-button-warning p-button-text"
          onClick={() => handleAuditTrail(rowData)}
          tooltip="Audit Trail"
          tooltipOptions={{ position: "top" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "40px",
            height: "40px",
          }}
        />
      </div>
    );
  };

  const renderClaimNumber = (rowData) => {
    const normalized = normalizeClaimRecord(rowData);
    if (loading) {
      return <Skeleton width="8rem" />;
    }

    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">
            {normalized?.claimNumber?.toString().toUpperCase() || t("policyDetail.nA")}
          </div>
        </div>
      </div>
    );
  };

  const renderClientName = (rowData) => {
    const normalized = normalizeClaimRecord(rowData);
    if (loading) {
      return <Skeleton width="8rem" />;
    }

    const clientName =
      rowData.ClientName ||
      rowData.clientName ||
      rowData.policyHolderName ||
      rowData.policy_holder_name ||
      (rowData.lead?.firstName && rowData.lead?.lastName
        ? `${rowData.lead.firstName} ${rowData.lead.lastName}`
        : rowData.policy?.insuredName) ||
      t("policyDetail.nA");

    return <div className="category__text">{clientName}</div>;
  };

  const renderPolicyNumber = (rowData) => {
    const normalized = normalizeClaimRecord(rowData);
    if (loading) {
      return <Skeleton width="8rem" />;
    }
    return (
      <div className="category__text">
        {normalized?.policyNumber?.toString().toUpperCase() || t("policyDetail.nA")}
      </div>
    );
  };

  const renderDate = (rowData) => {
    if (loading) {
      return <Skeleton width="6rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    return <div className="date__text">{formatDate(normalized?.issued)}</div>;
  };

  const renderProductDescription = (rowData) => {
    if (loading) {
      return <Skeleton width="8rem" />;
    }

    const description =
      rowData.ProductDescription ||
      rowData.productDescription ||
      rowData.product_description ||
      rowData.lob ||
      t("policyDetail.nA");

    return <div className="category__text">{(description || "").toUpperCase()}</div>;
  };

  const renderStatus = (rowData) => {
    if (loading) {
      return <Skeleton width="4rem" />;
    }
    const normalized = normalizeClaimRecord(rowData);
    const status = normalized?.status || "processing";
    const className = STATUS_CLASS_MAP[status] || STATUS_CLASS_MAP.processing;

    return <div className={className}>{status.toUpperCase()}</div>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return t("policyDetail.nA");
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await claimsService.getClaimsList(1, 100);
      if (response.success) {
        const claimsData =
          response.data?.data?.claims || response.data?.claims || [];
        setClaims(claimsData);
        setFilteredClaims(claimsData);
      } else {
        setError(response.error || "Failed to fetch claims");
      }
    } catch (err) {
      setError("An error occurred while fetching claims");
      console.error("Error fetching claims:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch claims list on component mount
  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    if (search) {
      const filtered = claims.filter((claim) => {
        const normalized = normalizeClaimRecord(claim);
        if (globalFilter === "claimNumber") {
          return normalized?.claimNumber
            ?.toString()
            .toLowerCase()
            .includes(search.toLowerCase());
        } else if (globalFilter === "policyNumber") {
          return normalized?.policyNumber
            ?.toString()
            .toLowerCase()
            .includes(search.toLowerCase());
        }
        return false;
      });
      setFilteredClaims(filtered);
    } else {
      setFilteredClaims(claims);
    }
  }, [search, claims, globalFilter]);

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
      console.error("No claimId found for viewing details");
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
        },
      });
      return;
    }

    if (status === "PROCESSING" || status === "PENDING") {
      const claimId = claim.id || claim.claimId;

      // Validate that we have a proper claim ID (not claim number)
      if (!claimId) {
        console.error("No valid claim ID found for navigation");
        console.log("Available claim fields:", {
          id: claim.id,
          claimId: claim.claimId,
          claimNumber: claim.claimNumber,
          claimRefId: claim.claimRefId,
        });
        alert("Unable to navigate: No valid claim ID found");
        return;
      }

      // Check if the claimId looks like a claim number (contains "CLAIM-" or similar patterns)
      if (claimId.includes("CLAIM-") || claimId.includes("Motor-")) {
        console.error(
          "Claim ID appears to be a claim number, not a database ID"
        );
        console.log("Claim ID:", claimId);
        console.log("This looks like a claim number, not a database ID");
        console.log("Available fields:", {
          id: claim.id,
          claimId: claim.claimId,
          claimNumber: claim.claimNumber,
          claimRefId: claim.claimRefId,
        });
        alert(
          "Unable to navigate: Claim ID appears to be a claim number instead of database ID"
        );
        return;
      }

      // Extract policy holder name and claim number for Redux
      console.log("=== CLAIM DATA FIELD ANALYSIS ===");
      console.log("All claim fields:", Object.keys(claim));
      console.log(
        "Policy object fields:",
        claim?.policy ? Object.keys(claim.policy) : "No policy object"
      );
      console.log(
        "Lead object fields:",
        claim?.lead ? Object.keys(claim.lead) : "No lead object"
      );
      console.log("Normalized policy holder name:", claim?.policyHolderName);
      console.log("=== END CLAIM DATA FIELD ANALYSIS ===");

      const policyHolderName = claim?.policyHolderName || "Loading...";

      const claimNumber =
        claim?.claimNumber || claim?.claim_number || "Loading...";

      console.log("=== CLAIM TABLE NAVIGATION (PROCESSING/PENDING) ===");
      console.log("Claim Data:", claim);
      console.log("Policy Holder Name:", policyHolderName);
      console.log("Claim Number:", claimNumber);
      console.log("Policy Number:", claim.policyNumber);
      console.log("=== END CLAIM TABLE NAVIGATION ===");

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
          ...(lob && { lob, productType: lob }),
        },
      });
      return;
    }

    const claimId = claim.id || claim.claimId;

    // Validate that we have a proper claim ID (not claim number)
    if (!claimId) {
      console.error("No valid claim ID found for navigation");
      console.log("Available claim fields:", {
        id: claim.id,
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        claimRefId: claim.claimRefId,
      });
      alert("Unable to navigate: No valid claim ID found");
      return;
    }

    // Check if the claimId looks like a claim number (contains "CLAIM-" or similar patterns)
    if (claimId.includes("CLAIM-") || claimId.includes("Motor-")) {
      console.error("Claim ID appears to be a claim number, not a database ID");
      console.log("Claim ID:", claimId);
      console.log("This looks like a claim number, not a database ID");
      console.log("Available fields:", {
        id: claim.id,
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        claimRefId: claim.claimRefId,
      });
      alert(
        "Unable to navigate: Claim ID appears to be a claim number instead of database ID"
      );
      return;
    }

    // Extract policy holder name and claim number for Redux
    console.log("=== CLAIM DATA FIELD ANALYSIS (DEFAULT) ===");
    console.log("All claim fields:", Object.keys(claim));
    console.log(
      "Policy object fields:",
      claim?.policy ? Object.keys(claim.policy) : "No policy object"
    );
    console.log(
      "Lead object fields:",
      claim?.lead ? Object.keys(claim.lead) : "No lead object"
    );
    console.log("Normalized policy holder name:", claim?.policyHolderName);
    console.log("=== END CLAIM DATA FIELD ANALYSIS (DEFAULT) ===");

    const policyHolderName = claim?.policyHolderName || "Loading...";

    const claimNumber =
      claim?.claimNumber || claim?.claim_number || "Loading...";

    console.log("=== CLAIM TABLE NAVIGATION (DEFAULT) ===");
    console.log("Claim Data:", claim);
    console.log("Policy Holder Name:", policyHolderName);
    console.log("Claim Number:", claimNumber);
    console.log("Policy Number:", claim.policyNumber);
    console.log("=== END CLAIM TABLE NAVIGATION ===");

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

  const selectionMode = "multiple";

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

  const renderCheckedHeader = (value) => {
    return selectedProducts.length === 0 ? (
      value
    ) : selectedProducts.length === 1 ? (
      <div className="header__btn__container">
        <div className="header__delete__btn">Delete</div>
        <div className="header__edit__btn">Edit</div>
      </div>
    ) : (
      <div className="header__delete__btn">Delete</div>
    );
  };

  const renderUncheckedHeader = (value) =>
    selectedProducts.length === 0 ? value : null;

  return (
    <div>
      <div className="grid">
        <div className="col-12 md:col-9 lg:col-9">
          <span className="p-input-icon-left" style={{ width: "100%" }}>
            <i className="pi pi-search" />
            <InputText
              placeholder="Search"
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
            placeholder="Search by"
            className="feat_searchby_container"
            dropdownIcon={<SvgDownArrow />}
          />
        </div>
      </div>
      <div className="lead__table__container">
        <DataTable
          value={filteredClaims}
          paginator
          rows={5}
          selectionMode={selectionMode}
          selection={selectedProducts}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          className="corrections__table__main"
          onSelectionChange={(e) => setSelectedProducts(e.value)}
          dataKey="id"
          tableStyle={{ minWidth: "50rem" }}
          scrollable
          scrollHeight="60vh"
          loading={loading}
          emptyMessage={
            loading ? "Loading claims..." : error ? error : "No claims found"
          }
        >
          <Column
            body={renderClaimNumber}
            header={renderCheckedHeader("Claim Number")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderClientName}
            header={renderUncheckedHeader("Client Name")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPolicyNumber}
            header={renderUncheckedHeader("Policy Number")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDate}
            header={renderUncheckedHeader("Policy Issued")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderProductDescription}
            header={renderUncheckedHeader("Product Description")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderStatus}
            header={renderUncheckedHeader("Status")}
            headerStyle={ViewheaderStyle}
          ></Column>
          <Column
            body={renderViewEditButton}
            header={renderUncheckedHeader("Actions")}
            headerStyle={{ ...headerStyle, textAlign: "center" }}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default ClaimTable;
