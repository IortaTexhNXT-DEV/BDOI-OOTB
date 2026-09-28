import { InputText } from "primereact/inputtext";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import SvgMotorTable from "../../../assets/agentIcon/SvgMotorTable";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../assets/agentIcon/SvgDownArrow";
import { useNavigate } from "react-router-dom";
import "../../policyModule/index.scss";
import SvgDot from "../../../assets/agentIcon/SvgDot";
import { Dialog } from "primereact/dialog";
import { Menu } from "primereact/menu";
import { useDispatch, useSelector } from "react-redux";
import {
  policyListSerachDataMiddleWare,
  policyListDataMiddleWare,
} from "../store/policyMiddleWare";
import StatusBadge from "../../../components/StatusBadge";
import { Skeleton } from "primereact/skeleton";
import { Tooltip } from "primereact/tooltip";
import SvgArrow from "../../../assets/icons/SvgArrow";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { MultiSelect } from "primereact/multiselect";
import debounce from "lodash/debounce";
import {
  getCategoriesForLob,
  MOTOR_CATEGORIES,
} from "../../endorsementModule/constants/endorsementCategories";

// Legacy export for backward compatibility (Motor categories)
export const categories = MOTOR_CATEGORIES;

const LeadListingAllTable = ({
  action,
  filterExpiredOnly = false,
  setDisplayDialog,
  displayDialog,
}) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { policyListData, loading, policyListSearchData, pagination } =
    useSelector(({ policyMainReducers }) => {
      return {
        loading: policyMainReducers?.loading,
        policyListData: policyMainReducers?.policyListData,
        policyListSearchData: policyMainReducers?.policyListSearchData,
        pagination: policyMainReducers?.pagination,
      };
    });
  const menu = useRef(null);

  //   const dispatch = useDispatch();

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState("multiple");

  const [disableOption, setdisableOption] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("policy Number");
  const cities = [
    { name: t("policyTable.policyNumber"), code: "policy Number" },
    { name: t("policyList.claimId"), code: "Claim ID" },
  ];

  const [navAction, setNavAction] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  // Advanced Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    paymentStatus: "",
    issuedDateFrom: null,
    issuedDateTo: null,
    expiryDateFrom: null,
    expiryDateTo: null,
    insuranceCompany: "",
    premiumMin: null,
    premiumMax: null,
    productType: "",
    clientName: "",
  });

  const dispatch = useDispatch();

  // Filter Options
  const paymentStatusOptions = [
    { label: t("policyList.all"), value: "" },
    { label: t("policyList.completed"), value: "Completed" },
    { label: t("policyList.pending"), value: "Pending" },
    { label: t("policyList.reviewing"), value: "Reviewing" },
    { label: t("policyList.failed"), value: "Failed" },
  ];

  const productTypeOptions = [
    { label: t("policyList.all"), value: "" },
    { label: t("policyList.motorComprehensive"), value: "Motor Comprehensive" },
    { label: t("policyList.motorCTPL"), value: "Motor CTPL" },
    { label: t("policyList.motorThirdParty"), value: "Motor Third Party" },
    { label: t("policyList.fireAndAlliedPerils"), value: "Fire and Allied Perils" },
  ];

  // Extract unique insurance companies from policy data
  const insuranceCompanyOptions = useMemo(() => {
    const companies = new Set();
    companies.add("All");
    policyListData.forEach((policy) => {
      if (policy.InsuranceCompany) {
        companies.add(policy.InsuranceCompany);
      }
    });
    return Array.from(companies).map((company) => ({
      label: company,
      value: company === "All" ? "" : company,
    }));
  }, [policyListData]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((searchValue, filterValue) => {
        if (searchValue && filterValue) {
          dispatch(
            policyListSerachDataMiddleWare({
              field: filterValue,
              value: searchValue,
            })
          );
        } else {
          dispatch(
            policyListDataMiddleWare({ page: 1, pageSize: 200, filters })
          );
        }
      }, 300),
    [dispatch, filters]
  );

  // Filter Handlers
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      paymentStatus: "",
      issuedDateFrom: null,
      issuedDateTo: null,
      expiryDateFrom: null,
      expiryDateTo: null,
      insuranceCompany: "",
      premiumMin: null,
      premiumMax: null,
      productType: "",
      clientName: "",
    });
    setSearch("");
    dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200 }));
  };

  const applyFilters = () => {
    dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200, filters }));
  };

  useEffect(() => {
    // Load initial policy data when component mounts
    dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200 }));
  }, [dispatch]);

  useEffect(() => {
    if (search) {
      debouncedSearch(search, globalFilter);
    } else if (search === "") {
      // When search is cleared, reload with filters
      dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200, filters }));
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [search, globalFilter, debouncedSearch, dispatch, filters]);

  const endorsementLob =
    displayDialog?.lob ||
    displayDialog?.productType ||
    selectedPolicy?.ProductDescription ||
    selectedPolicy?.productType ||
    null;
  const endorsementCategories = getCategoriesForLob(endorsementLob);

  const hideDialogClose = () => {
    setDisplayDialog({
      display: false,
      policyId: null,
      lob: null,
      productType: null,
    });
  };
  const handleDialogButtonClick = () => {
    const types = handleTypes();
    const policyId = displayDialog.policyId;
    hideDialogClose();
    navigate(`/agent/endorsement/personaldetails/${policyId}`, {
      state: {
        types,
        lob: endorsementLob,
        productType: endorsementLob,
      },
    });
  };
  const handleTypes = () => {
    const result = [];
    endorsementCategories.forEach((cat) => {
      if (selectedCategories.some((obj) => obj.key === cat.key)) {
        result.push(cat.typeId);
      }
    });
    return result;
  };
  const navigate = useNavigate();

  const handleMenuToggle = (event, menuRef, rowData) => {
    menuRef.current.toggle(event);
    setNavAction(rowData.Payment);
    setSelectedPolicy(rowData);

    console.log(rowData, "rowData from policy table policy table");
    setdisableOption(
      rowData.Payment === "Pending" || rowData.Payment === "Reviewing"
    );
  };

  const handleMenuClick = (menuItem, rowData) => {
    // For menu items (claim, renewal, endorsement), always use selectedPolicy
    // For direct button clicks (view), use rowData
    const policy =
      menuItem === "view" ? rowData || selectedPolicy : selectedPolicy;

    // Extract policyId with all possible field names as fallback
    const policyId = policy?.policyId || policy?.policy_id || policy?.id;

    if (menuItem == "view") {
      // Navigate to new PolicyDetailView page for all statuses
      if (policyId) {
        navigate(`/agent/policydetail/${policyId}`);
      }
    }
    if (menuItem == "claim") {
      const leadId = policy?.leadId || policy?.lead?.id;
      const quoteId = policy?.quoteId || policy?.quotation?.id;
      const lob =
        policy?.ProductDescription ||
        policy?.productType ||
        policy?.quotation?.productType;

      navigate("/agent/claimrequest/claimdetails/new", {
        state: {
          policyId: policyId,
          leadRefId: leadId || "LEAD-001",
          quoteRefId: quoteId || "QUOTE-001",
          policyRefId: policyId || "POLICY-001",
          lob,
          productType: lob,
        },
      });
    }
    if (menuItem == "renewal") {
      const renewalLob =
        policy?.ProductDescription ||
        policy?.productType ||
        policy?.quotation?.productType;
      navigate(
        `/agent/renewalquote/coveragedetails/coveragedetail/${policyId}`,
        {
          state: {
            policyId: policyId,
            policyNumber: policy?.policyNumber,
            insuredName: policy?.insuredName,
            ...(renewalLob && { lob: renewalLob, productType: renewalLob }),
          },
        }
      );
    }
    if (menuItem == "endrosement") {
      const lob =
        policy?.ProductDescription ||
        policy?.productType ||
        policy?.quotation?.productType ||
        null;
      setDisplayDialog({
        display: true,
        policyId: policyId,
        lob,
        productType: lob,
      });
    }
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
    const policyId = rowData.policyId || rowData.policy_id || rowData.id;
    const viewBtnId = `view-btn-${policyId}`;
    const menuBtnId = `menu-btn-${policyId}`;

    const menuItems = [
      {
        label: "Claim",
        command: () => handleMenuClick("claim"),
        disabled: disableOption,
      },
    ];

    // Add Renewal option only when on expired-policies page
    if (filterExpiredOnly) {
      menuItems.push({
        label: "Renewal",
        command: () => handleMenuClick("renewal"),
        disabled: false,
      });
    }

    menuItems.push(
      {
        label: t("policyDetail.endorsement"),
        command: () => handleMenuClick("endrosement"),
        disabled: disableOption,
      },
      {
        label: "Reminder",
        command: () => handleMenuClick("reminder"),
        disabled: disableOption,
      }
    );

    console.log(
      "Final menu items for policy:",
      rowData.policyNumber,
      menuItems.map((m) => m.label)
    );

    return (
      <div
        className="btn__container__view__edit"
        style={{
          display: "flex",
          gap: "6px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Button
          id={viewBtnId}
          icon={<SvgArrow />}
          className="p-button-rounded p-button-text p-button-info"
          onClick={() => handleMenuClick("view", rowData)}
          style={{ width: "32px", height: "32px" }}
          aria-label="View Policy"
        />
        <Tooltip
          target={`#${viewBtnId}`}
          content="View Details"
          position="top"
        />

        <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
        <Button
          id={menuBtnId}
          icon={<SvgDot />}
          className="p-button-rounded p-button-text"
          onClick={(event) => handleMenuToggle(event, menu, rowData)}
          style={{ width: "32px", height: "32px" }}
          aria-label="More Actions"
        />
        <Tooltip
          target={`#${menuBtnId}`}
          content="More Actions"
          position="top"
        />
      </div>
    );
  };
  const renderDes = (rowData) => {
    return (
      <div className="category__text">
        {rowData.ProductDescription?.toUpperCase()}
      </div>
    );
  };
  const renderClientId = (rowData) => {
    return (
      <div className="category__text">{rowData.ClientId?.toUpperCase()}</div>
    );
  };
  const renderClientName = (rowData) => {
    return (
      <div className="category__text">{rowData.ClientName?.toUpperCase()}</div>
    );
  };
  const renderPolicyNumber = (rowData) => {
    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">
            {rowData.policyNumber?.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  const renderGrossPremium = (rowData) => {
    if (loading) return <Skeleton width="100%" height="1.5rem" />;
    return (
      <div
        className="category__text"
        style={{ fontWeight: 600, color: "#2E7D32" }}
      >
        {formatCurrency(rowData.grossPremium)}
      </div>
    );
  };

  const renderPolicyIssued = (rowData) => {
    return (
      <div className="date__text">{rowData.PolicyIssued?.toUpperCase()}</div>
    );
  };
  const renderPolicyExpiry = (rowData) => {
    const expiryDate = rowData.PolicyExpiry || rowData.expiry;

    if (loading) return <Skeleton width="6rem" />;
    if (!expiryDate) return <div className="date__text">N/A</div>;

    // Calculate days until expiry
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry - today;
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determine status and styling
    let statusClass = "";
    let statusText = "";
    let showBadge = false;

    if (daysUntilExpiry < 0) {
      // Expired
      statusClass = "client__view__type__red";
      statusText = "EXPIRED";
      showBadge = true;
    } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 5) {
      // Expiring soon (0-5 days)
      statusClass = "company__status__type__green";
      statusText = `EXPIRES IN ${daysUntilExpiry} DAY${
        daysUntilExpiry !== 1 ? "S" : ""
      }`;
      showBadge = true;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div className="date__text">{expiryDate?.toUpperCase()}</div>
        {showBadge && (
          <div
            className={statusClass}
            style={{ fontSize: "12px", padding: "4px 8px" }}
          >
            {statusText}
          </div>
        )}
      </div>
    );
  };

  const renderPayment = (rowData) => {
    if (loading) return <Skeleton width="100px" height="2rem" />;
    return (
      <StatusBadge
        status={rowData.Payment || "Pending"}
        type="payment"
        size="sm"
        showTooltip={false}
      />
    );
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
              placeholder={t("policyTable.search")}
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
            placeholder={t("policyTable.searchBy")}
            className="feat_searchby_container"
            dropdownIcon={<SvgDownArrow />}
          />
        </div>

        {/* Advanced Filters Toggle Button */}
        <div className="col-12" style={{ marginTop: "1rem" }}>
          <Button
            label={showFilters ? t("policyTable.hideFilters") : t("policyTable.showFilters")}
            icon={showFilters ? "pi pi-chevron-up" : "pi pi-chevron-down"}
            onClick={() => setShowFilters(!showFilters)}
            className="p-button-text"
          />
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div
            className="col-12"
            className="filter-container-bg"
            style={{
              padding: "1.5rem",
              borderRadius: "8px",
              marginTop: "1rem",
            }}
          >
            <div className="grid">
              {/* Payment Status */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.paymentStatus")}
                </label>
                <Dropdown
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange("paymentStatus", e.value)}
                  options={paymentStatusOptions}
                  placeholder={t("policyTable.selectStatus")}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Product Type */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.productType")}
                </label>
                <Dropdown
                  value={filters.productType}
                  onChange={(e) => handleFilterChange("productType", e.value)}
                  options={productTypeOptions}
                  placeholder={t("policyTable.selectProduct")}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Insurance Company */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.insuranceCompany")}
                </label>
                <Dropdown
                  value={filters.insuranceCompany}
                  onChange={(e) =>
                    handleFilterChange("insuranceCompany", e.value)
                  }
                  options={insuranceCompanyOptions}
                  placeholder={t("policyTable.selectCompany")}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Client Name */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.clientName")}
                </label>
                <InputText
                  value={filters.clientName}
                  onChange={(e) =>
                    handleFilterChange("clientName", e.target.value)
                  }
                  placeholder={t("policyTable.enterClientName")}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Issue Date From */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.issuedDateFrom")}
                </label>
                <Calendar
                  value={filters.issuedDateFrom}
                  onChange={(e) =>
                    handleFilterChange("issuedDateFrom", e.value)
                  }
                  placeholder={t("policyTable.selectDate")}
                  style={{ width: "100%" }}
                  dateFormat="dd/mm/yy"
                  showIcon
                />
              </div>

              {/* Issue Date To */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.issuedDateTo")}
                </label>
                <Calendar
                  value={filters.issuedDateTo}
                  onChange={(e) => handleFilterChange("issuedDateTo", e.value)}
                  placeholder={t("policyTable.selectDate")}
                  style={{ width: "100%" }}
                  dateFormat="dd/mm/yy"
                  showIcon
                />
              </div>

              {/* Expiry Date From */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.expiryDateFrom")}
                </label>
                <Calendar
                  value={filters.expiryDateFrom}
                  onChange={(e) =>
                    handleFilterChange("expiryDateFrom", e.value)
                  }
                  placeholder={t("policyTable.selectDate")}
                  style={{ width: "100%" }}
                  dateFormat="dd/mm/yy"
                  showIcon
                />
              </div>

              {/* Expiry Date To */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.expiryDateTo")}
                </label>
                <Calendar
                  value={filters.expiryDateTo}
                  onChange={(e) => handleFilterChange("expiryDateTo", e.value)}
                  placeholder={t("policyTable.selectDate")}
                  style={{ width: "100%" }}
                  dateFormat="dd/mm/yy"
                  showIcon
                />
              </div>

              {/* Premium Min */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.premiumMin")}
                </label>
                <InputNumber
                  value={filters.premiumMin}
                  onValueChange={(e) =>
                    handleFilterChange("premiumMin", e.value)
                  }
                  placeholder="0.00"
                  mode="decimal"
                  minFractionDigits={2}
                  maxFractionDigits={2}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Premium Max */}
              <div className="col-12 md:col-6 lg:col-3">
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {t("policyTable.premiumMax")}
                </label>
                <InputNumber
                  value={filters.premiumMax}
                  onValueChange={(e) =>
                    handleFilterChange("premiumMax", e.value)
                  }
                  placeholder="0.00"
                  mode="decimal"
                  minFractionDigits={2}
                  maxFractionDigits={2}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Filter Actions */}
              <div
                className="col-12"
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  label={t("policyTable.clearFilters")}
                  icon="pi pi-times"
                  onClick={handleClearFilters}
                  className="p-button-outlined"
                />
                <Button
                  label={t("policyTable.applyFilters")}
                  icon="pi pi-check"
                  onClick={applyFilters}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="lead__table__container">
        <DataTable
          value={
            filterExpiredOnly && !search
              ? policyListData.filter((policy) => {
                  const expiryDate = policy.PolicyExpiry || policy.expiry;
                  if (!expiryDate) return false;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const expiry = new Date(expiryDate);
                  expiry.setHours(0, 0, 0, 0);
                  const daysUntilExpiry = Math.ceil(
                    (expiry - today) / (1000 * 60 * 60 * 24)
                  );
                  return daysUntilExpiry <= 5;
                })
              : search
              ? policyListSearchData
              : policyListData
          }
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
          scrollHeight="50vh"
        >
          <Column
            body={renderPolicyNumber}
            header={t("policyTable.policyNumber")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderClientId}
            header={t("policyTable.clientId")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderClientName}
            header={t("policyTable.clientNameHeader")}
            headerStyle={headerStyle}
          ></Column>

          <Column
            body={renderGrossPremium}
            header={t("policyTable.grossPremium")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPolicyIssued}
            header={t("policyTable.policyIssued")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPolicyExpiry}
            header={t("policyTable.policyExpiry")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDes}
            header={t("policyTable.productDescription")}
            headerStyle={headerStyle}
          ></Column>
          {!filterExpiredOnly && (
            <Column
              body={renderPayment}
              header={t("policyTable.payment")}
              headerStyle={headerStyle}
            ></Column>
          )}
          <Column
            body={renderViewEditButton}
            header={t("policyTable.actions")}
            headerStyle={{ ...ViewheaderStyle, textAlign: "center" }}
          ></Column>
        </DataTable>
      </div>
      <Dialog
        visible={displayDialog.display}
        style={{ height: "auto", width: "550px" }}
        modal
        onHide={hideDialogClose}
        className="agent__flow__common__dialog__container"
      >
        <div className="p-fluid">
          {endorsementCategories.map((category) => {
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
                  {category.translationKey ? t(category.translationKey) : category.name}
                </label>
              </div>
            );
          })}
          <div className="mt-5">
            <Button label={t("policyTable.proceed")} onClick={handleDialogButtonClick} />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LeadListingAllTable;
