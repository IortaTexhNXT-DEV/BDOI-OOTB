import { Card } from "primereact/card";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../../assets/agentIcon/SvgLeftArrow";
import SvgAdd from "../../../../assets/agentIcon/SvgAdd";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import SvgDownArrow from "../../../../assets/agentIcon/SvgDownArrow";
import SvgEdit from "../../../../assets/icons/SvgEdits";
import SvgArrow from "../../../../assets/agentIcon/SvgArrow";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getQuoteSearchDataMiddleWare } from "../quoteListingCard/store/quoteMiddleware";
import {
  getQuotationsMiddleware,
  getQuotationByIdMiddleware,
  deleteQuotationMiddleware,
} from "../../Store/quotationMiddleware";
import {
  loadQuotationForEdit,
  clearCurrentQuoteCreation,
} from "../../Store/quotationReducer";
import { getLeadByIdMiddleware } from "../../../leadModule/Store/leadMiddleware";
import {
  canConvertToPolicy,
  canEditQuotation,
} from "../../../../utils/statusHelpers";
import StatusBadge from "../../../../components/StatusBadge";
import SvgHome from "../../../../assets/agentIcon/SvgHome";
import SvgTravel from "../../../../assets/agentIcon/SvgTravel";
import EmployeeBenefitIcon from "../../../EmployeeFlow/EmployeeBenefitIcon";
import SvgMotor from "../../../../assets/agentIcon/SvgMotor";
import SvgFire from "../../../../assets/agentIcon/SvgFire";
import "./index.scss";
import { formatDate as formatConfiguredDate } from "../../../../utility/dateFormat";
import { confirmAction, notifyError, notifySuccess } from "../../../../utility/dialogs";
const QuoteListingCard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { leadId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();

  // Extract leadRefId from URL search parameters
  const searchParams = new URLSearchParams(location.search);
  const leadRefId = searchParams.get("leadRefId") || leadId;
  const {
    quotetabledata,
    quoteSearchList,
    totalQuotations,
    currentLeadDetails,
  } = useSelector(
    ({ agentQuoteMainReducers, quotationReducers, leadReducer }) => {
      return {
        quotetabledata:
          quotationReducers?.quotations ||
          agentQuoteMainReducers?.quotetabledata,
        quoteSearchList: agentQuoteMainReducers?.quoteSearchList,
        totalQuotations: quotationReducers?.totalQuotations || 0,
        currentLeadDetails: leadReducer?.currentLeadDetails,
      };
    }
  );
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectionMode] = useState("multiple");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Company");
  const [currentPageState, setCurrentPageState] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const cities = [
    { name: t("quoteListing.company"), code: "Company" },
    { name: t("quoteListing.quoteId"), code: "QuoteID" },
  ];

  // Fetch lead details when leadRefId is available
  useEffect(() => {
    if (leadRefId) {
      dispatch(getLeadByIdMiddleware(leadRefId));
    }
  }, [dispatch, leadRefId]);

  // Fetch quotations on component mount and when pagination changes
  useEffect(() => {
    dispatch(
      getQuotationsMiddleware({
        page: currentPageState,
        pageSize: rowsPerPage,
        leadRefId: leadRefId,
      })
    );
  }, [dispatch, currentPageState, rowsPerPage, leadRefId]);

  useEffect(() => {
    if (globalFilter && search) {
      dispatch(
        getQuoteSearchDataMiddleWare({
          field: globalFilter,
          value: search,
        })
      );
    }
  }, [search]);

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
              {t("quoteListing.rowsPerPage")}{" "}
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

  const handleDelete = async () => {
    if (selectedProducts.length === 0) return;

    const confirmDelete = await confirmAction(
      `Are you sure you want to delete ${selectedProducts.length} quotation(s)?`
    );

    if (!confirmDelete) return;

    try {
      // Delete all selected quotations
      await Promise.all(
        selectedProducts.map((product) =>
          dispatch(deleteQuotationMiddleware(product.quotationId)).unwrap()
        )
      );

      // Clear selection after deletion
      setSelectedProducts([]);

      notifySuccess(t("quoteListing.quotationsDeletedSuccess"));

      // Refresh the list
      dispatch(
        getQuotationsMiddleware({
          page: currentPageState,
          pageSize: rowsPerPage,
          leadRefId: leadRefId,
        })
      );
    } catch (error) {
      notifyError(t("quoteListing.failedToDeleteQuotations", { error: error?.message || error }));
    }
  };

  const rendercheckedHeader = (value) => {
    return selectedProducts.length === 0 ? (
      value
    ) : selectedProducts.length === 1 ? (
      <div className="header__btn__container">
        <div className="header__delete__btn" onClick={handleDelete}>
          {t("quoteListing.delete")}
        </div>
        <div
          className="header__edit__btn"
          onClick={() => handleEdit(selectedProducts[0])}
        >
          {t("quoteListing.edit")}
        </div>
      </div>
    ) : (
      <div className="header__btn__container">
        <div className="header__delete__btn" onClick={handleDelete}>
          {t("quoteListing.delete")}
        </div>
        {selectedProducts.length === 2 && (
          <div
            className="header__edit__btn"
            onClick={() =>
              navigate(
                `/agent/quotecomparisonview?quotationId1=${selectedProducts[0].quotationId}&quotationId2=${selectedProducts[1].quotationId}`
              )
            }
          >
            {t("quoteListing.compare")}
          </div>
        )}
      </div>
    );
  };

  const renderUncheckedHeader = (value) => {
    return selectedProducts.length == 0 && value;
  };

  const handleclick = () => {
    // Clear any existing quote creation state
    dispatch(clearCurrentQuoteCreation());

    // Navigate to quote creation form
    navigate(`/agent/createquote/policydetails/createquote/${leadRefId}`, {
      state: {
        lead: currentLeadDetails,
      },
    });
  };

  const ViewheaderStyle = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    display: "flex",
    alignItem: "center",
    height: "56px",
  };

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const headeraction = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    // display: "flex",
    justifyContent: "center",
    alignItem: "center",
  };

  const checkboxheaderStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
    width: "3rem",
  };

  const renderCompany = (rowData) => {
    return (
      <div>
        <div className="company__title__text">
          {rowData.participantDetails?.[0]?.insuranceCompanyName || t("policyDetail.nA")}
        </div>
        <div className="company__id">
          {t("quoteListing.quoteId")} : {rowData.quotationNumber || t("policyDetail.nA")}
        </div>
      </div>
    );
  };

  const renderPolicyType = (rowData) => {
    return (
      <div>
        <div className="company__policy__type">
          {rowData.insurancePolicyType || t("policyDetail.nA")} -{" "}
          {rowData.productType || t("policyDetail.nA")}
        </div>
      </div>
    );
  };

  const renderGrosspremium = (rowData) => {
    // Use grossPremium if available, otherwise calculate from individual premiums
    let totalPremium;
    if (rowData.grossPremium) {
      totalPremium = rowData.grossPremium;
    } else {
      totalPremium =
        (parseFloat(rowData.lossAndDamageCoveragePremium) || 0) +
        (parseFloat(rowData.actsOfNaturePremium) || 0) +
        (parseFloat(rowData.bodilyInjuryCoveragePremium) || 0) +
        (parseFloat(rowData.propertyDamageCoveragePremium) || 0) +
        (parseFloat(rowData.APPAcoveragePremium) || 0);
    }

    return (
      <div>
        <div className="company__policy__type">
          {totalPremium != null ? formatCurrency(totalPremium) : t("policyDetail.nA")}
        </div>
      </div>
    );
  };

  const renderDate = (rowData) => {
    const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: t("policyDetail.nA") });

    return (
      <div>
        <div className="company__policy__type">
          {formatDate(rowData.createdAt)}
        </div>
      </div>
    );
  };

  const renderStatus = (rowData) => {
    // Calculate days in Draft before being dropped
    const getDroppedInfo = () => {
      if (rowData.quotationStatus !== "Dropped") return null;

      // Get creation date (when draft was created)
      const draftCreatedDate = rowData.createdAt;
      if (!draftCreatedDate) return null;

      // Use statusChangedAt if available, otherwise fallback to updatedAt (when dropped)
      const droppedDate = rowData.statusChangedAt || rowData.updatedAt;
      if (!droppedDate) return null;

      const draftCreated = new Date(draftCreatedDate);
      const dropped = new Date(droppedDate);

      // Calculate days between draft creation and when it was dropped
      const daysInDraft = Math.floor(
        (dropped - draftCreated) / (1000 * 60 * 60 * 24)
      );

      return {
        daysInDraft: daysInDraft,
      };
    };

    const droppedInfo = getDroppedInfo();

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minWidth: "150px",
          padding: "4px",
          gap: "4px",
        }}
      >
        <StatusBadge
          status={rowData.quotationStatus || "Draft"}
          type="quotation"
          size="sm"
          showTooltip={false}
        />
        {droppedInfo && (
          <div className="status__badge__dropped">
            <div className="dropped__days">
              {droppedInfo.daysInDraft === 0
                ? t("quoteListing.afterSameDay")
                : droppedInfo.daysInDraft === 1
                ? t("quoteListing.afterOneDay")
                : t("quoteListing.afterDays", { count: droppedInfo.daysInDraft })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderViewEditButton = (rowData) => {
    const status = rowData.quotationStatus;
    const canEdit = canEditQuotation(status);
    const canConvert = canConvertToPolicy(status);

    return (
      <div
        className="btn__container__view__edit"
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Edit button - only show for Draft/PendingCustomer */}
        {canEdit && (
          <Button
            icon={<SvgEdit />}
            className="view__btn"
            onClick={() => handleEdit(rowData)}
            tooltip={t("quoteListing.editQuote")}
            tooltipOptions={{ position: "top" }}
          />
        )}

        {/* Convert to Policy button - show for Approved/CustomerAccepted */}
        {canConvert && (
          <Button
            label={t("quoteListing.convert")}
            className="p-button-success p-button-sm"
            onClick={() => handleConvertToPolicy(rowData)}
            tooltip={t("quoteListing.convertToPolicy")}
            tooltipOptions={{ position: "top" }}
            style={{ fontSize: "12px", padding: "6px 12px" }}
          />
        )}

        {/* View button - always show */}
        <Button
          icon={<SvgArrow />}
          className="edit__btn"
          onClick={() => handleView(rowData)}
          tooltip={t("quoteListing.viewDetails")}
          tooltipOptions={{ position: "top" }}
        />
      </div>
    );
  };

  const handleEdit = async (rowData) => {
    try {
      // First, clear any existing quote creation state
      dispatch(clearCurrentQuoteCreation());

      // Fetch the specific quotation details
      const result = await dispatch(
        getQuotationByIdMiddleware(rowData.quotationId)
      );

      if (result.type.endsWith("/fulfilled")) {
        const quotationData = result.payload;
        const isIarLOB =
          quotationData?.productType === "Industrial All Risks" ||
          quotationData?.productType?.toUpperCase?.().includes("IAR") ||
          quotationData?.productType?.toLowerCase?.().includes("industrial all risk");
        const isFireLOB =
          !isIarLOB &&
          (quotationData?.productType === "Fire and Allied Perils" ||
            quotationData?.productType?.toLowerCase?.().includes("fire"));

        // IAR / Fire: go to quotation detail view
        if (isIarLOB || isFireLOB) {
          navigate("/agent/quotedetailview", {
            state: { quotationData },
          });
          return;
        }

        // Motor: load into Redux and go to Policy Details edit form
        dispatch(loadQuotationForEdit(quotationData));
        navigate(
          `/agent/editquote/policydetails/quotedetails/${rowData.quotationId}`
        );
      } else if (result.type.endsWith("/rejected")) {
        notifyError(
          t("quoteListing.failedToFetchQuotationError", { error: result.payload || "Unknown error" })
        );
      }
    } catch (error) {
      notifyError(t("quoteListing.unexpectedErrorFetching"));
    }
  };

  const handleConvertToPolicy = async (rowData) => {
    try {
      // Confirm conversion
      const confirmConvert = await confirmAction(
        `Are you sure you want to convert quotation ${rowData.quotationNumber} to a policy?`
      );

      if (!confirmConvert) return;

      const isIarLOB =
        rowData.productType === "Industrial All Risks" ||
        rowData.productType?.toUpperCase?.().includes("IAR") ||
        rowData.productType?.toLowerCase?.().includes("industrial all risk");
      const isFireLOB =
        !isIarLOB &&
        (rowData.productType === "Fire and Allied Perils" ||
          rowData.productType?.toLowerCase?.().includes("fire"));
      const basePath = isFireLOB
        ? "/agent/convertpolicy/customerinfo/fire/new"
        : isIarLOB
        ? "/agent/convertpolicy/customerinfo/fire/new"
        : "/agent/convertpolicy/customerinfo/new";

      navigate(`${basePath}/${rowData.quotationId}`, {
        state: { quotation: rowData },
      });
    } catch (error) {
      notifyError(t("quoteListing.unexpectedErrorConverting"));
    }
  };

  const handleView = async (rowData) => {
    try {
      // Fetch full quotation details first
      const result = await dispatch(
        getQuotationByIdMiddleware(rowData.quotationId)
      );

      if (result.type.endsWith("/fulfilled")) {
        const quotationData = result.payload;

        // Navigate to quote detail view with full data
        navigate("/agent/quotedetailview", {
          state: { quotationData: quotationData },
        });
      } else {
        notifyError(t("quoteListing.failedToLoadQuotation"));
      }
    } catch (error) {
      notifyError(t("quoteListing.errorLoadingQuotation"));
    }
  };

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  const handleClickFireAndAlliedPerils = () => {
    // When adding a quote for an existing lead, pass lead data so the create-lead form can pre-populate
    if (leadRefId && currentLeadDetails) {
      navigate("/agent/createlead/fire-allied-perils", {
        state: { leadRefId, lead: currentLeadDetails },
      });
    } else {
      navigate("/agent/createlead/fire-allied-perils");
    }
  };

  const handleClickIar = () => {
    if (leadRefId && currentLeadDetails) {
      navigate("/agent/createlead/iar", {
        state: { leadRefId, lead: currentLeadDetails },
      });
    } else {
      navigate("/agent/createlead/iar");
    }
  };

  const dropdownOptionsQuote = [
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleclick();
          }}
        >
          <div>
            <SvgMotor />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quoteListing.motor")}
          </div>
        </div>
      ),
      value: "Motor",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickFireAndAlliedPerils();
          }}
        >
          <div>
            <SvgFire />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quoteListing.fireAndAlliedPerils")}
          </div>
        </div>
      ),
      value: "FireAndAlliedPerils",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickIar();
          }}
        >
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Industrial All Risks", "Industrial All Risks")}
          </div>
        </div>
      ),
      value: "IndustrialAllRisks",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
          }}
        >
          <div>
            <EmployeeBenefitIcon />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quoteListing.employeeBenefit")}
          </div>
        </div>
      ),
      value: "EmployeeBenefit",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
          }}
        >
          <div>
            <SvgTravel />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            Travel
          </div>
        </div>
      ),
      value: "Travel",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
          }}
        >
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quoteListing.property")}
          </div>
        </div>
      ),
      value: "Property",
    },
  ];

  return (
    <div className="quote__listing__card__container mt-4">
      <Card>
        <div class="grid mt-2">
          <div class="back__btn__container col-12 md:col-6 lg:col-6">
            <div className="quote__listing__card__container__back__btn">
              <div
                className="cursor-pointer flex arrow__controller"
                onClick={handleLeadNavigation}
              >
                <SvgLeftArrow />
                <div className="quote__listing__card__container__back__btn__title">
                  {currentLeadDetails?.firstName && currentLeadDetails?.lastName
                    ? `${currentLeadDetails.firstName} ${currentLeadDetails.lastName}`
                    : t("common.loading")}
                </div>
              </div>
            </div>
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <div class="btn__container__quote__listing col-12 md:col-6 lg:col-6">
              <Dropdown
                value={null}
                options={dropdownOptionsQuote}
                onChange={(e) => {
                  // Handle selection if needed
                  if (e.value === "Motor") {
                    handleclick();
                  } else if (e.value === "FireAndAlliedPerils") {
                    handleClickFireAndAlliedPerils();
                  } else if (e.value === "IndustrialAllRisks") {
                    handleClickIar();
                  }
                }}
                placeholder={t("quoteListing.addQuote")}
                dropdownIcon={<SvgAdd />}
              />
            </div>
          </div>
        </div>
        <div class="grid mt-2">
          <div class="col-12 md:col-9 lg:col-9">
            <span className="p-input-icon-left">
              <i className="pi pi-search" />
              <InputText
                placeholder={t("quoteListing.search")}
                style={{ width: "100%", borderRadius: "10px" }}
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
              placeholder={t("quoteListing.searchBy")}
              className="feat_searchby_container"
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
        </div>
        <div className="quote__listing__card__table">
          <DataTable
            value={search ? quoteSearchList : quotetabledata}
            paginator
            rows={rowsPerPage}
            totalRecords={totalQuotations}
            first={(currentPageState - 1) * rowsPerPage}
            selectionMode={selectionMode}
            selection={selectedProducts}
            onPage={(e) => {
              setCurrentPageState(e.page + 1);
              setRowsPerPage(e.rows);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            className="corrections__table__main"
            onSelectionChange={(e) => setSelectedProducts(e.value)}
            dataKey="quotationId"
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="60vh"
          >
            <Column
              selectionMode={selectionMode}
              body={(rowData) => (
                <Checkbox
                  checked={selectedProducts.includes(rowData)}
                  onChange={() => {}}
                />
              )}
              headerStyle={checkboxheaderStyle}
            ></Column>
            <Column
              body={renderCompany}
              header={rendercheckedHeader(t("quoteListing.company"))}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderPolicyType}
              header={renderUncheckedHeader(t("quoteListing.policyType"))}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderGrosspremium}
              header={renderUncheckedHeader(t("quoteListing.grossPremium"))}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderDate}
              header={renderUncheckedHeader(t("quoteListing.date"))}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderStatus}
              header={renderUncheckedHeader(t("quoteListing.status"))}
              headerStyle={{ ...headeraction, minWidth: "150px" }}
              style={{ textAlign: "center", minWidth: "150px" }}
            ></Column>
            <Column
              body={renderViewEditButton}
              header={renderUncheckedHeader(t("quoteListing.actions"))}
              headerStyle={ViewheaderStyle}
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default QuoteListingCard;
