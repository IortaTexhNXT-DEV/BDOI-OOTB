import { InputText } from "primereact/inputtext";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import SvgMotorTable from "../../../../../assets/agentIcon/SvgMotorTable";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../../clientView/index.scss";
import SvgDot from "../../../../../assets/agentIcon/SvgDot";
import { Dialog } from "primereact/dialog";
import { Menu } from "primereact/menu";
import policyRenewalService from "../../../../../services/policyRenewalService";
import { Skeleton } from "primereact/skeleton";
import { notifyWarn } from "../../../../../utility/dialogs";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";
import logger from "../../../../../utility/logger";

const Index = ({ clientId, action }) => {
  const { t } = useTranslation();
  const menu = useRef(null);
  const [displayDialog, setDisplayDialog] = useState(false);
  const [selectedProducts] = useState([]);
  const [selectionMode, setSelectionMode] = useState("multiple");
  const [, setdisableOption] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [, setPaymentStatus] = useState("");
  const [, setstatusAction] = useState("");
  const [globalFilter, setGlobalFilter] = useState("policy Number");
  const [search, setSearch] = useState("");
  const cities = [{ name: t("tables.policyNumber"), code: "policy Number" }];
  const [renewalPolicy, setRenewalPolicy] = useState([]);
  const [filteredRenewals, setFilteredRenewals] = useState([]);
  const [loadingState, setLoadingState] = useState(false);
  // Skeleton rows only on the first load; a refresh keeps the rows on screen.
  const showSkeleton = loadingState && !filteredRenewals.length;
  const [error, setError] = useState(null);
  const [selectedRowData, setSelectedRowData] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setRenewalPolicy([]);
      setFilteredRenewals([]);
      return;
    }

    let active = true;

    const fetchRenewals = async () => {
      setLoadingState(true);
      setError(null);

      try {
        const response = await policyRenewalService.getRenewals({ clientId });
        if (!active) {
          return;
        }

        if (!response.success) {
          throw new Error(response.error || "Failed to load renewals");
        }

      const baseRenewals = Array.isArray(response.data)
        ? response.data
        : [];

      const normalized = baseRenewals.map((item) => {
          const policy = item.policy || {};
          const resolvedPolicyId =
            item.policyId || item.policyRefId || policy.policyId || policy.id;

          const payment =
            item.paymentStatus ||
            item.payment ||
            policy.paymentStatus ||
            "Pending";

          const status =
            item.status ||
            item.renewalStatus ||
            policy.renewalStatus ||
            "Pending";

          // Prefer API-level clientId, then policy.clientId, then a lead-scoped fallback
          const resolvedClientId =
            item.clientId ||
            policy.clientId ||
            policy?.client?.id ||
            policy?.lead?.clientId ||
            policy?.lead?.id ||
            null;

          return {
            ...item,
            clientId: resolvedClientId,
            policy,
            id: item.id || item.renewalId || resolvedPolicyId,
            policyId: resolvedPolicyId,
            policyNumber: item.policyNumber || policy.policyNumber || "N/A",
            insuredName:
              item.insuredName ||
              policy.insuredName ||
              policy.clientName ||
              "N/A",
            grossPremium:
              item.grossPremium ||
              item.totalPremium ||
              policy.grossPremium ||
              policy.premiumAmount ||
              0,
            policyIssued:
              item.policyIssued ||
              item.issuedDate ||
              policy.issuedDate ||
              policy.inception ||
              null,
            policyExpiry:
              item.policyExpiry ||
              item.expiryDate ||
              policy.expiry ||
              null,
            productType:
              item.productType ||
              policy.productType ||
              policy.product ||
              "MOTOR COMPREHENSIVE",
            status,
            Status: status,
            paymentStatus: payment,
            Payment: payment,
          };
        });

      if (!active) {
        return;
      }

      setRenewalPolicy(normalized);
      setFilteredRenewals(normalized);
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setError(fetchError.message || "Failed to fetch renewals");
        setRenewalPolicy([]);
        setFilteredRenewals([]);
      } finally {
        if (active) {
          setLoadingState(false);
        }
      }
    };

    fetchRenewals();

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (action) {
      setSelectionMode("checkbox");
    } else {
      setSelectionMode("multiple");
    }
  }, [action]);

  useEffect(() => {
    if (!search) {
      setFilteredRenewals(renewalPolicy);
      return;
    }

    const searchLower = search.toLowerCase();
    setFilteredRenewals(
      renewalPolicy.filter((item) => {
        return (
          (item.policyNumber || "")
            .toString()
            .toLowerCase()
            .includes(searchLower) ||
          (item.insuredName || "")
            .toString()
            .toLowerCase()
            .includes(searchLower)
        );
      })
    );
  }, [search, renewalPolicy]);


  const categories = [
    { name: "Personal Details Change", key: "personaldetail" },
    { name: "Motor Details Change", key: "motordetail" },
    { name: "Coverage Change", key: "coveragechange" },
    { name: "Policy Extend", key: "ploicyextend" },
  ];

  const hideDialogClose = () => {
    setDisplayDialog(false);
  };
  const handleDialogButtonClick = () => {
    hideDialogClose();
    handleTypes();
    navigate("/agent/endorsement/personaldetails", {
      state: {
        types: handleTypes(),
      },
    });
  };
  const handleTypes = () => {
    let result = [];
    if (selectedCategories.some((obj) => obj.key === "personaldetail")) {
      result.push("1");
    }
    if (selectedCategories.some((obj) => obj.key === "motordetail")) {
      result.push("2");
    }
    if (selectedCategories.some((obj) => obj.key === "coveragechange")) {
      result.push("3");
    }
    if (selectedCategories.some((obj) => obj.key === "ploicyextend")) {
      result.push("4");
    }
    return result;
  };
  const navigate = useNavigate();

  const handleMenuToggle = (event, menuRef, rowData) => {
    menuRef.current.toggle(event);
    setSelectedRowData(rowData);
    setdisableOption(
      rowData.Payment === "Pending" || rowData.Payment === "Reviewing"
    );
    setPaymentStatus(rowData.Payment);
    setstatusAction(rowData.Status);
  };

  const handleMenuClick = (menuItem) => {
    if (menuItem == "view") {
      if (!selectedRowData) {
        logger.error("No row data selected");
        return;
      }

      const policy = selectedRowData.policy || {};
      const policyIdToUse = selectedRowData.policyId || selectedRowData.id || policy.policyId || policy.id;
      
      if (!policyIdToUse) {
        notifyWarn("Policy information is missing");
        return;
      }

      const resolvedClientId = 
        selectedRowData.clientId || 
        policy.clientId || 
        policy?.client?.id || 
        clientId;

      const resolvedClientName = 
        policy?.client?.fullName || 
        selectedRowData.insuredName || 
        policy.insuredName || 
        (policy?.client?.firstName && policy?.client?.lastName 
          ? `${policy.client.firstName} ${policy.client.lastName}` 
          : null) ||
        "N/A";

      navigate(`/agent/policydetailedviewonly/${policyIdToUse}`, {
        state: {
          clientId: resolvedClientId,
          ClientId: resolvedClientId,
          clientName: resolvedClientName,
          ClientName: resolvedClientName,
          policyId: policyIdToUse,
          policyNumber: selectedRowData.policyNumber || policy.policyNumber,
        },
      });
    }
    if (menuItem == "claim") {
      navigate("/agent/claimrequest/claimdetails");
    }
    if (menuItem == "endrosement") {
      setDisplayDialog(true);
    }
    if (menuItem == "renewal") {
      if (!selectedRowData) {
        logger.error("No row data selected for renewal");
        return;
      }

      const policy = selectedRowData.policy || {};
      const policyIdToUse = selectedRowData.policyId || selectedRowData.id || policy.policyId || policy.id;
      
      if (!policyIdToUse) {
        notifyWarn("Policy information is missing");
        return;
      }

      const resolvedClientId = 
        selectedRowData.clientId || 
        policy.clientId || 
        policy?.client?.id || 
        clientId;

      navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${policyIdToUse}`, {
        state: {
          clientId: resolvedClientId,
          policyId: policyIdToUse,
          policyNumber: selectedRowData.policyNumber || policy.policyNumber,
          renewalData: selectedRowData,
        },
      });
    }
    // Handle the menu item click here
  };

  const onCategoryChange = (e) => {
    let _selectedCategories = [...selectedCategories];

    if (e.checked) _selectedCategories.push(e.value);
    else
      _selectedCategories = _selectedCategories.filter(
        (category) => category.key !== e.value.key
      );

    setSelectedCategories(_selectedCategories);
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
    // Check if policy is expired by status
    const policyStatus = (rowData.status || rowData.Status || rowData.policy?.status || "").toLowerCase();
    const isExpired = policyStatus === 'expired';
    
    // Calculate days until expiry
    const expiryDate = rowData.policyExpiry || rowData.ExpiryDate || rowData.policy?.expiry;
    let daysUntilExpiry = null;
    let isExpiringWithin5Days = false;
    
    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      const expiry = new Date(expiryDate);
      expiry.setHours(0, 0, 0, 0); // Reset time to start of day
      
      const diffTime = expiry - today;
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Show renewal if: expired (negative days) OR expiring within 5 days
      isExpiringWithin5Days = daysUntilExpiry <= 5;
    }
    
    const showRenewOption = isExpired || isExpiringWithin5Days;

    const menuItems = [
      {
        label: t("common.view"),
        command: () => handleMenuClick("view"),
      },
    ];

    // Add Renewal option only for expired policies
    if (showRenewOption) {
      menuItems.push({
        label: t("payments.renewal"),
        command: () => handleMenuClick("renewal"),
      });
    }

    return (
      <div className="btn__container__view__edit">
        <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
        <Button
          icon={<SvgDot />}
          className="view__btn"
          onClick={(event) => handleMenuToggle(event, menu, rowData)}
        />
      </div>
    );
  };

  const renderPolicyNumber = (rowData) => {
    if (showSkeleton) {
      return <Skeleton width="8rem" />;
    }

    const policyNumber = rowData.policyNumber || rowData.PolicyNumber || "N/A";

    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">{policyNumber.toUpperCase()}</div>
        </div>
      </div>
    );
  };

  const renderRenewalDate = (rowData) => {
    const value = rowData.policyIssued || rowData.IssueDate;
    if (showSkeleton) return <Skeleton width="6rem" />;
    return <div className="date__text">{formatDate(value)}</div>;
  };

  const renderExpiryDate = (rowData) => {
    const expiryDate = rowData.policyExpiry || rowData.ExpiryDate;
    
    if (showSkeleton) return <Skeleton width="6rem" />;
    if (!expiryDate) return <div className="date__text">N/A</div>;

    // Calculate days until expiry
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determine status and styling
    let statusClass = '';
    let statusText = '';
    let showBadge = false;

    if (daysUntilExpiry < 0) {
      // Expired
      statusClass = 'client__view__type__red';
      statusText = 'EXPIRED';
      showBadge = true;
    } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 5) {
      // Expiring soon (0-5 days)
      statusClass = 'company__status__type__green';
      statusText = `EXPIRES IN ${daysUntilExpiry} DAY${daysUntilExpiry !== 1 ? 'S' : ''}`;
      showBadge = true;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="date__text">{formatDate(expiryDate)}</div>
        {showBadge && (
          <div className={statusClass} style={{ fontSize: '12px', padding: '4px 8px' }}>
            {statusText}
          </div>
        )}
      </div>
    );
  };

  const renderPremium = (rowData) => {
    if (showSkeleton) return <Skeleton width="4rem" />;
    const premium =
      rowData.grossPremium || rowData.totalPremium || rowData.GrossPremium || 0;
    return <div className="category__text">{premium}</div>;
  };

  const renderProductDescription = (rowData) => {
    const description =
      rowData.productType ||
      rowData.ProductDescription ||
      rowData.type ||
      "MOTOR COMPREHENSIVE";
    if (showSkeleton) {
      return <Skeleton width="8rem" />;
    }

    return <div className="category__text">{description.toUpperCase()}</div>;
  };

  const renderType = (rowData) => {
    const type = rowData.type || rowData.Status || rowData.status || "Pending";
    if (showSkeleton) {
      return <Skeleton width="6rem" />;
    }

    return <div className="category__text">{type.toUpperCase()}</div>;
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    try {
      return formatConfiguredDate(value);
    } catch (error) {
      return value;
    }
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
              onChange={(e) => setSearch(e.target.value)}
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
          value={filteredRenewals}
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
          loading={loadingState}
          emptyMessage={
            loadingState
              ? t("clientView.loadingRenewals")
              : error
              ? error
              : t("clientView.noRenewalsFound")
          }
        >
          <Column
            body={renderPolicyNumber}
            header={t("tables.policyNumber")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderProductDescription}
            header={t("tables.productDescription")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderType}
            header={t("tables.type")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderRenewalDate}
            header={t("tables.policyIssued")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderExpiryDate}
            header={t("tables.policyExpiry")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPremium}
            header={t("tables.totalPremium")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderViewEditButton}
            header={t("tables.actions")}
            headerStyle={{ ...ViewheaderStyle, textAlign: "center" }}
          ></Column>
        </DataTable>
      </div>
      <Dialog
        visible={displayDialog}
        style={{ height: "340px", width: "500px" }}
        modal
        onHide={hideDialogClose}
        className="agent__flow__common__dialog__container"
      >
        <div className="p-fluid">
          {categories.map((category) => {
            return (
              <div
                key={category.key}
                className="p-field-checkbox m-3 pop__data__selection__container "
              >
                <Checkbox
                  id="checkbox"
                  inputId={category.key}
                  name="category"
                  value={category}
                  onChange={onCategoryChange}
                  checked={selectedCategories.some(
                    (item) => item.key === category.key
                  )}
                />
                <label
                  style={{
                    color: "#111927",
                    marginLeft: "16px",
                    fontFamily: "Nunito, Arial, sans-serif",
                    fontSize: "16px",
                    fontWeight: 400,
                  }}
                  htmlFor={category.key}
                  className="ml-2"
                >
                  {category.name}
                </label>
              </div>
            );
          })}
          <div className="mt-5">
            <Button label={t("endorsement.proceed")} onClick={handleDialogButtonClick} />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Index;
