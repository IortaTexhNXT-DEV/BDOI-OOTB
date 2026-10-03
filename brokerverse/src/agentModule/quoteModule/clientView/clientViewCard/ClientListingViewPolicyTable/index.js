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
import { useDispatch } from "react-redux";
import "../../../clientView/index.scss";
import SvgDot from "../../../../../assets/agentIcon/SvgDot";
import { Dialog } from "primereact/dialog";
import { Menu } from "primereact/menu";
import policyService from "../../../../../services/policyService";
import { setPolicyHolderData } from "../../../../claimsModule/claimDetails/store/claimDetailsReducers";
import {
  getCategoriesForLob,
} from "../../../../endorsementModule/constants/endorsementCategories";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";
import { notifyWarn } from "../../../../../utility/dialogs";
import { useFormatCurrency } from "../../../../../hooks/useFormatCurrency";

const normalizePolicyRecord = (policy) => {
  if (!policy) {
    return null;
  }

  const policyId = policy.policyId || policy.id;
  const paymentStatus = policy.paymentStatus || policy.Payment || "Pending";
  const quotation =
    policy.quotation || policy.quotationId
      ? {
          ...(policy.quotation || {}),
          quotationId: policy.quoteRefId || policy.quotation?.quotationId,
          productType:
            policy.quotation?.productType ||
            policy.productType ||
            policy.productName ||
            "MOTOR COMPREHENSIVE",
        }
      : null;

  const issuedDate = policy.issuedDate || policy.policyIssuedDate;
  const expiry = policy.expiry || policy.policyExpiryDate;
  const grossPremium = policy.grossPremium || policy.premiumAmount || 0;

  return {
    ...policy,
    policyId,
    id: policyId,
    quotation,
    paymentStatus,
    issuedDate,
    expiry,
    grossPremium,
  };
};

const LeadListingAllTable = ({ action, clientId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const menu = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [displayDialog, setDisplayDialog] = useState(false);
  const [selectedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectionMode] = useState("multiple");
  const [, setNavAction] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const [disableOption, setdisableOption] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("policy Number");
  const cities = [{ name: t("tables.policyNumber"), code: "policy Number" }];

  // Fetch policies for this client
  useEffect(() => {
    if (clientId) {
      fetchPolicies();
    }
  }, [clientId]);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const result = await policyService.getPolicies(1, 100, { clientId });

      if (result.success && result.data) {
        const policiesData = result.data.data || [];
        const normalized = policiesData
          .map(normalizePolicyRecord)
          .filter(Boolean);
        setPolicies(normalized);
        setFilteredPolicies(normalized);
      } else {
        setPolicies([]);
        setFilteredPolicies([]);
      }
    } catch (error) {
      setPolicies([]);
      setFilteredPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  useEffect(() => {
    if (search && policies.length > 0) {
      const searchLower = search.toLowerCase();
      const filtered = policies.filter((policy) => {
        const policyNumber = policy.policyNumber?.toLowerCase() || "";
        const insuredName = policy.insuredName?.toLowerCase() || "";
        const grossPremium = policy.grossPremium?.toString() || "";

        return (
          policyNumber.includes(searchLower) ||
          insuredName.includes(searchLower) ||
          grossPremium.includes(searchLower)
        );
      });
      setFilteredPolicies(filtered);
    } else {
      setFilteredPolicies(policies);
    }
  }, [search, policies]);

  const endorsementLob =
    selectedPolicy?.quotation?.productType ||
    selectedPolicy?.productType ||
    selectedPolicy?.ProductDescription ||
    null;
  const endorsementCategories = getCategoriesForLob(endorsementLob);

  const hideDialogClose = () => {
    setDisplayDialog(false);
  };
  const handleDialogButtonClick = () => {
    const policy = normalizePolicyRecord(selectedPolicy);
    const policyId = policy?.policyId || policy?.id;

    if (!policyId) {
      notifyWarn("Policy ID not found. Please try again.");
      return;
    }

    const types = handleTypes();
    hideDialogClose();
    navigate(`/agent/endorsement/personaldetails/${policyId}`, {
      state: {
        types,
        policyId: policyId,
        clientId: policy?.client?.id,
        clientNumber: policy?.client?.clientId,
        clientName: policy?.insuredName || policy?.ClientName,
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

  const handleMenuToggle = (event, menuRef, rowData) => {
    menuRef.current.toggle(event);
    setNavAction(rowData.Payment);
    setSelectedPolicy(rowData);
    setdisableOption(
      rowData.Payment === "Pending" || rowData.Payment === "Reviewing"
    );
  };

  const handleMenuClick = (menuItem) => {
    if (menuItem == "view") {
      const policy = normalizePolicyRecord(selectedPolicy);
      const policyId = policy?.policyId || policy?.id;
      if (!policyId) {
        notifyWarn("Policy ID not found. Please try again.");
        return;
      }

      // Navigate to the correct PolicyDetailView with policy ID
      navigate(`/agent/policydetail/${policyId}`);
    }
    if (menuItem == "claim") {
      const policy = normalizePolicyRecord(selectedPolicy);
      const policyId = policy?.policyId || policy?.id;
      const leadId =
        policy?.leadId ||
        policy?.lead?.id ||
        policy?.leadRefId ||
        policy?.lead?.leadId;
      const quoteId =
        policy?.quoteId ||
        policy?.quotation?.id ||
        policy?.quotation?.quotationId ||
        policy?.quoteRefId;

      // Extract policy holder name and policy number for Redux
      const policyHolderName =
        policy?.policyHolderName ||
        policy?.PolicyHolderName ||
        policy?.clientName ||
        policy?.ClientName ||
        policy?.insuredName ||
        policy?.InsuredName ||
        "Loading...";

      const policyNumber =
        policy?.policyNumber ||
        policy?.PolicyNumber ||
        policyId ||
        "Loading...";

      // Save policy holder data to Redux for future pages
      dispatch(
        setPolicyHolderData({
          policyHolderName,
          policyNumber,
          claimNumber: "", // Will be updated when claim is created
        })
      );

      const lob =
        policy?.quotation?.productType ||
        policy?.productType ||
        policy?.ProductDescription;

      navigate("/agent/claimrequest/claimdetails/new", {
        state: {
          policyId: policyId,
          leadRefId: leadId || "LEAD-001",
          quoteRefId: quoteId || "QUOTE-001",
          policyRefId: policyId || "POLICY-001",
          clientId,
          lob,
          productType: lob,
        },
      });
    }
    if (menuItem == "renewal") {
      const policy = normalizePolicyRecord(selectedPolicy);
      const policyId = policy?.policyId || policy?.id;
      if (!policyId) {
        notifyWarn("Policy ID not found. Please try again.");
        return;
      }

      navigate(
        `/agent/renewalquote/coveragedetails/coveragedetail/${policyId}`,
        {
          state: {
            policyId,
            clientId,
            policy,
          },
        }
      );
    }
    if (menuItem == "endrosement") {
      setDisplayDialog(true);
    }
  };

  // Format date for display
  const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: "N/A" });
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
    const menuItems = [
      {
        label: t("common.view"),
        command: () => handleMenuClick("view"),
      },

      {
        label: t("payments.claim"),
        command: () => handleMenuClick("claim"),
        disabled: disableOption,
      },
      {
        label: t("payments.renewal"),
        command: () => handleMenuClick("renewal"),
        disabled: disableOption,
      },

      {
        label: t("payments.endorsement"),
        command: () => handleMenuClick("endrosement"),
        disabled: disableOption,
      },
      {
        label: t("clientView.reminder"),
        command: () => handleMenuClick("reminder"),
        disabled: true,
      },
    ];
    return (
      <div className="btn__container__view__edit">
        <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
        <Button
          icon={<SvgDot />}
          className="view__btn"
          onClick={(event) => handleMenuToggle(event, menu, rowData)} aria-label="More actions" tooltip="More actions" tooltipOptions={{ position: "top" }} />
      </div>
    );
  };
  const renderDes = (rowData) => {
    const normalized = normalizePolicyRecord(rowData);
    const productType =
      normalized?.quotation?.productType || "MOTOR COMPREHENSIVE";
    return <div className="category__text">{productType.toUpperCase()}</div>;
  };

  const renderPolicyNumber = (rowData) => {
    return (
      <div className="name__box__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="name__text">
            {rowData.policyNumber?.toUpperCase() || "N/A"}
          </div>
        </div>
      </div>
    );
  };

  const renderGrossPremium = (rowData) => {
    return (
      <div className="category__text">{formatCurrency(Number(rowData.grossPremium) || 0)}</div>
    );
  };

  const renderExpiryDate = (rowData) => {
    return <div className="date__text">{formatDate(rowData.expiry)}</div>;
  };

  const renderDate = (rowData) => {
    return <div className="date__text">{formatDate(rowData.issuedDate)}</div>;
  };

  const renderPayment = (rowData) => {
    const normalized = normalizePolicyRecord(rowData);
    const paymentStatus = normalized?.paymentStatus || "Pending";
    return (
      <div
        className={
          paymentStatus === "Pending"
            ? "company__status__type__green"
            : paymentStatus === "Completed"
            ? "company__status__type__blue"
            : "company__status__type__red"
        }
      >
        {paymentStatus.toUpperCase()}
      </div>
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
          value={filteredPolicies}
          paginator
          rows={20}
          selectionMode={selectionMode}
          selection={selectedProducts}
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
              ? t("clientView.loadingPolicies")
              : t("clientView.noPoliciesForClient")
          }
        >
          <Column
            body={renderPolicyNumber}
            header={t("tables.policyNumber")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderGrossPremium}
            header={t("tables.grossPremium")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDate}
            header={t("tables.policyIssued")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderExpiryDate}
            header={t("tables.policyExpiry")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderDes}
            header={t("tables.productDescription")}
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={renderPayment}
            header={t("tables.payment")}
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
            <Button label={t("endorsement.proceed")} onClick={handleDialogButtonClick} disabled={!handleTypes().length} />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LeadListingAllTable;
