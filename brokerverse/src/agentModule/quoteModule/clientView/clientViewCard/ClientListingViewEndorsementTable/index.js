import { InputText } from "primereact/inputtext";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import SvgArrow from "../../../../../assets/icons/SvgArrow";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../../clientView/index.scss";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import endorsementService from "../../../../../services/endorsementService";
import { Skeleton } from "primereact/skeleton";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";
import { notifyError } from "../../../../../utility/dialogs";

const STATUS_CLASS_MAP = {
  processing: "company__status__type__green",
  completed: "company__status__type__blue",
  rejected: "client__view__type__red",
};

const PAYMENT_CLASS_MAP = {
  pending: "company__status__type__green",
  completed: "company__status__type__blue",
  reviewing: "company__status__type__red",
};

const ENDORSEMENT_TYPE_LABELS = {
  "personal-details": "Personal Details Change",
  "motor-details": "Motor Details Change",
  coverage: "Coverage Change",
  "policy-extension": "Policy Extension",
  cancellation: "Policy Cancellation",
  "fire-details": "Fire Risk / Premium Change",
  other: "Other",
};

const normalizeEndorsement = (record) => {
  if (!record) return null;

  const policyNumber =
    record.policyNumber ||
    record.policy?.policyNumber ||
    record.policy?.policyNo ||
    "N/A";

  const policyId =
    record.policyId ||
    record.policy?.policyId ||
    record.policy?.id ||
    null;

  const endorsementNumber =
    record.endorsementNumber || record.endorsementId || record.id;
  // endorsements.types values, one or more joined by commas
  const typeLabel = String(record.endorsementType || "")
    .split(",")
    .filter(Boolean)
    .map((k) => ENDORSEMENT_TYPE_LABELS[k] || k)
    .join(", ");

  const createdAt = record.createdAt || record.endorsementDate || record.submittedOn;
  const expiry = record.completionDetails?.expiryDate || record.policyExpiry || record.expiryDate;

  const status = (record.status || record.endorsementStatus || "Processing").toLowerCase();
  const paymentStatus = record.coverageChanges?.paymentStatus || record.paymentStatus || record.payment || "N/A";
  const payment = paymentStatus.toLowerCase();

  // Extract product type from the endorsementId or policyExtension
  const productType = record.policyExtension?.Title || 
                      (record.endorsementId?.includes('MOTOR') ? 'Motor' : 
                       record.endorsementId?.includes('TRAVEL') ? 'Travel' : 
                       record.endorsementId?.includes('HOME') ? 'Home' : 'N/A');

  return {
    ...record,
    policyNumber,
    policyId,
    endorsementNumber,
    endorsementId: record.endorsementId,
    createdAt,
    expiry,
    status,
    payment,
    productType,
    // the endorsement type (Coverage Change, Personal Details Change, ...) from the server
    type: typeLabel || productType,
  };
};

const LeadListingAllTable = ({ clientId }) => {
  const { t } = useTranslation();
  const [selectedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectionMode] = useState("multiple");
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState("endorsementNumber");
  const [endorsementData, setEndorsementData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cities = [
    { name: "Policy Number", code: "policyNumber" },
    { name: "Endorsement Number", code: "endorsementNumber" },
  ];

  useEffect(() => {
    if (!clientId) {
      setEndorsementData([]);
      setFilteredData([]);
      return;
    }

    let active = true;
    const loadEndorsements = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await endorsementService.getEndorsements({ clientId });
        if (!active) {
          return;
        }

        if (response.success) {
          const normalized = (response.data || [])
            .map(normalizeEndorsement)
            .filter(Boolean);
          setEndorsementData(normalized);
          setFilteredData(normalized);
        } else {
          throw new Error(response.error || "Failed to load endorsements");
        }
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError.message || "Failed to fetch endorsements");
        setEndorsementData([]);
        setFilteredData([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadEndorsements();

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!search) {
      setFilteredData(endorsementData);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = endorsementData.filter((item) => {
      if (globalFilter === "policyNumber") {
        return (item.policyNumber || "").toLowerCase().includes(searchLower);
      }
      return (item.endorsementNumber || "").toLowerCase().includes(searchLower);
    });
    setFilteredData(filtered);
  }, [search, globalFilter, endorsementData]);

  const handleSearch = (value) => {
    setSearch(value);
  };

  const formatDate = (value) => formatConfiguredDate(value, { empty: "N/A" });

  const handleView = (rowData) => {
    const endorsement = normalizeEndorsement(rowData);
    if (!endorsement) {
      return;
    }

    const { endorsementNumber, endorsementId, policyId, status, payment } = endorsement;
    const endorsementRef = endorsementId || endorsementNumber;

    if (!policyId) {
      notifyError("Policy reference missing for this endorsement.");
      return;
    }

    const statusUpper = status?.toUpperCase();
    const paymentUpper = payment?.toUpperCase();

    if (statusUpper === "REJECTED") {
      navigate(`/agent/endorsement/rejected/${endorsementRef}`, {
        state: {
          endorsementNumber: endorsementRef,
          policyId,
          clientId,
        },
      });
      return;
    }

    if (statusUpper === "PROCESSING") {
      navigate(`/agent/endorsement/paymenterror/${endorsementRef}`, {
        state: {
          endorsementNumber: endorsementRef,
          policyId,
          clientId,
        },
      });
      return;
    }

    if (statusUpper === "COMPLETED" && paymentUpper === "COMPLETED") {
      navigate(`/agent/endorsementdetailedviewonly/${endorsementRef}`, {
        state: {
          endorsementNumber: endorsementRef,
          policyId,
          clientId,
        },
      });
      return;
    }

    if (statusUpper === "COMPLETED" && paymentUpper === "REVIEWING") {
      navigate(`/agent/policy/paymentapproval`, {
        state: {
          endorsementNumber: endorsementRef,
          policyId,
          clientId,
        },
      });
      return;
    }

    if (statusUpper === "COMPLETED" && paymentUpper === "PENDING") {
      navigate(`/agent/endorsementdetailedview/${endorsementRef}`, {
        state: {
          endorsementNumber: endorsementRef,
          policyId,
          clientId,
        },
      });
    }

    navigate(`/agent/endorsementdetailedviewonly/${endorsementRef}`, {
      state: {
        endorsementNumber: endorsementRef,
        policyId,
        clientId,
      },
    });
  };

  const template2 = {
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
  };

  const renderViewEditButton = (rowData) => {
    return (
      <div className="btn__container__view__edit">
        <div>
          <Button
            icon={<SvgArrow />}
            className="view__btn"
            onClick={() => handleView(rowData)}
          />
        </div>
      </div>
    );
  };

  const renderPolicyNumber = (rowData) => {
    const normalized = normalizeEndorsement(rowData);

    if (loading) {
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
            {normalized?.policyNumber?.toUpperCase() || "N/A"}
          </div>
        </div>
      </div>
    );
  };

  const renderEndorsementID = (rowData) => {
    const normalized = normalizeEndorsement(rowData);
    if (loading) {
      return <Skeleton width="6rem" />;
    }

    // the END- number, not the internal record id
    const displayId = normalized?.endorsementNumber || normalized?.endorsementId || "N/A";
    return (
      <div className="category__text">
        {displayId.toString().toUpperCase()}
      </div>
    );
  };

  const renderDes = (rowData) => {
    const normalized = normalizeEndorsement(rowData);

    if (loading) {
      return <Skeleton width="8rem" />;
    }

    const description = normalized?.productType || "N/A";

    return <div className="category__text">{description.toUpperCase()}</div>;
  };

  const renderDate = (rowData) => {
    const normalized = normalizeEndorsement(rowData);
    if (loading) {
      return <Skeleton width="6rem" />;
    }

    return <div className="date__text">{formatDate(normalized?.createdAt)}</div>;
  };

  const renderExpiryDate = (rowData) => {
    const normalized = normalizeEndorsement(rowData);
    if (loading) {
      return <Skeleton width="6rem" />;
    }

    return <div className="date__text">{formatDate(normalized?.expiry)}</div>;
  };

  const renderStatus = (rowData) => {
    const normalized = normalizeEndorsement(rowData);
    const status = normalized?.status || "processing";
    const className = STATUS_CLASS_MAP[status] || "company__status__type__green";

    if (loading) {
      return <Skeleton width="4rem" />;
    }

    return <div className={className}>{status.toUpperCase()}</div>;
  };

  const renderPayment = (rowData) => {
    const normalized = normalizeEndorsement(rowData);
    const payment = normalized?.payment || "N/A";
    const className =
      PAYMENT_CLASS_MAP[payment] || "endorsement__payment__type";

    if (loading) {
      return <Skeleton width="4rem" />;
    }

    return <div className={className}>{payment.toUpperCase()}</div>;
  };

  const ViewheaderStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    // display: "grid",
    // alignItem: "center",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const rendercheckedHeader = (value) => {
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

  const renderUncheckedHeader = (value) => {
    return selectedProducts.length == 0 && value;
  };

  return (
    <div>
      <div class="grid">
        <div class="col-12 md:col-9 lg:col-9">
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
              onChange={(e) => handleSearch(e.target.value)}
            />
          </span>
        </div>
        <div class="col-12 md:col-3 lg:col-3">
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
          value={filteredData}
          paginator
          rows={5}
          selectionMode={selectionMode}
          selection={selectedProducts}
          rowsPerPageOptions={[5, 10, 25, 50]}
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
              ? t("clientView.loadingEndorsements")
              : error
              ? error
              : t("clientView.noEndorsementsFound")
          }
        >
          <Column
            header={t("tables.type")}
            field="type"
            headerStyle={headerStyle}
            body={(rowData) =>
              loading ? (
                <Skeleton width="6rem" />
              ) : (
                normalizeEndorsement(rowData)?.type || rowData.Type || "N/A"
              )
            }
          ></Column>
          <Column
            body={renderPolicyNumber}
            header={rendercheckedHeader(t("tables.policyNumber"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderEndorsementID}
            header={renderUncheckedHeader(t("tables.endorsementNumber"))}
            headerStyle={headerStyle}
          ></Column>

          <Column
            body={renderDate}
            header={renderUncheckedHeader(t("tables.policyIssued"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderExpiryDate}
            header={renderUncheckedHeader("Policy Expiry")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDes}
            header={renderUncheckedHeader(t("tables.productDescription"))}
            headerStyle={headerStyle}
          ></Column>

          <Column
            body={renderStatus}
            header={renderUncheckedHeader(t("tables.status"))}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPayment}
            header={renderUncheckedHeader(t("tables.payment"))}
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
