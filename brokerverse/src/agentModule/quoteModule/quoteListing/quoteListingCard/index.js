import { Card } from "primereact/card";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../../assets/agentIcon/SvgLeftArrow";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
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
} from "../../Store/quotationMiddleware";
import {
  loadQuotationForEdit,
  clearCurrentQuoteCreation,
} from "../../Store/quotationReducer";
import {
  canConvertToPolicy,
  canEditQuotation,
} from "../../../../utils/statusHelpers";
import StatusBadge from "../../../../components/StatusBadge";
import "./index.scss";
import { formatDate as formatConfiguredDate } from "../../../../utility/dateFormat";
import { notifyError } from "../../../../utility/dialogs";
import { openConfirm } from "../../../../components/ConfirmDialog";
import { RFQ_PATH, entryOf, isUntagged, rfqState } from "../../../../module/Sales/salesProducts";
import { ProductPickerDialog } from "../../../../module/Sales/ProductPicker";
import leadService from "../../../../services/leadService";
import { getLeadByIdMiddleware } from "../../../leadModule/Store/leadMiddleware";
// gross premium of a quotation row: the stored total, else the sum of the motor cover premiums
const premiumOf = (rowData) => {
  if (rowData.grossPremium) return rowData.grossPremium;
  return (
    (parseFloat(rowData.lossAndDamageCoveragePremium) || 0) +
    (parseFloat(rowData.actsOfNaturePremium) || 0) +
    (parseFloat(rowData.bodilyInjuryCoveragePremium) || 0) +
    (parseFloat(rowData.propertyDamageCoveragePremium) || 0) +
    (parseFloat(rowData.APPAcoveragePremium) || 0)
  );
};

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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Company");
  const [currentPageState, setCurrentPageState] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const cities = [
    { name: t("quoteListing.company"), code: "Company" },
    { name: t("quoteListing.quoteId"), code: "QuoteID" },
  ];

  // (the prospect itself is loaded once by the page, quoteListing/index.js)

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

  const rendercheckedHeader = (value) => value;

  const renderUncheckedHeader = (value) => value;

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
    const totalPremium = premiumOf(rowData);
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
            tooltipOptions={{ position: "top" }} aria-label={t("quoteListing.editQuote")}
          />
        )}

        {/* Convert to Policy button - show for Approved/CustomerAccepted */}
        {canConvert && (
          <Button
            label={t("quoteListing.convert")}
            size="small"
            onClick={() => handleConvertToPolicy(rowData)}
            tooltip={t("quoteListing.convertToPolicy")}
            tooltipOptions={{ position: "top" }}
          />
        )}

        {/* View button - always show */}
        <Button
          icon={<SvgArrow />}
          className="edit__btn"
          onClick={() => handleView(rowData)}
          tooltip={t("quoteListing.viewDetails")}
          tooltipOptions={{ position: "top" }} aria-label={t("quoteListing.viewDetails")}
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
          navigate(`/agent/quotedetailview/${quotationData?.quotationId || rowData.quotationId}`, {
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
      const confirmConvert = await openConfirm({
        title: t("quoteListing.convertTitle"),
        message: t("quoteListing.convertMessage"),
        facts: [
          { label: t("quoteListing.quoteId"), value: rowData.quotationNumber },
          { label: t("quoteListing.insurer"), value: rowData.participantDetails?.[0]?.insuranceCompanyName },
          { label: t("quoteListing.product"), value: [rowData.insurancePolicyType, rowData.productType].filter(Boolean).join(" - ") },
          { label: t("quoteListing.grossPremium"), value: premiumOf(rowData), type: "amount" },
        ],
        confirmLabel: t("quoteListing.convertToPolicy"),
      });

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
        navigate(`/agent/quotedetailview/${quotationData?.quotationId || rowData.quotationId}`, {
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

  // the product to quote for this prospect (line of business, then product): motor in the quote wizard, Fire and IAR in
  // their forms, any other product through a Request for Quotation to the insurers
  const [choosingProduct, setChoosingProduct] = useState(false);
  const [tagging, setTagging] = useState(false);
  const addQuote = (p) => {
    const entry = entryOf(p);
    if (entry === "motor") handleclick();
    else if (entry === "fire") handleClickFireAndAlliedPerils();
    else if (entry === "iar") handleClickIar();
    else if (entry === "eb") navigate("/agent/createlead/employee-benefit", { state: { leadRefId, lead: currentLeadDetails } });
    else navigate(RFQ_PATH, { state: rfqState(p, { lead: leadRefId ? { ...currentLeadDetails, leadId: leadRefId } : null }) });
  };
  // a prospect whose product is not yet tagged is tagged with the product of its first quotation
  const quoteProduct = async (p, lob) => {
    if (leadRefId && isUntagged(currentLeadDetails)) {
      setTagging(true);
      const r = await leadService.tagProduct(leadRefId, { lob, productId: p.id });
      setTagging(false);
      if (!r.success) {
        notifyError(r.error);
        return;
      }
      dispatch(getLeadByIdMiddleware(leadRefId));
    }
    setChoosingProduct(false);
    addQuote(p);
  };

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
              <Button label={t("quoteListing.addQuote")} icon="pi pi-plus" onClick={() => setChoosingProduct(true)} />
              <ProductPickerDialog
                visible={choosingProduct}
                onHide={() => setChoosingProduct(false)}
                onSelect={quoteProduct}
                busy={tagging}
                header={t("quoteListing.addQuote")}
                hint={isUntagged(currentLeadDetails) ? t("productPicker.quoteHint", { name: [currentLeadDetails.firstName, currentLeadDetails.lastName].filter(Boolean).join(" ") || currentLeadDetails.companyName }) : t("productPicker.addQuoteHint")}
                value={currentLeadDetails?.lob ? { lob: currentLeadDetails.lob, productId: currentLeadDetails.productId ?? null } : null}
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
            // the server sends one page at a time (the search results are filtered here)
            lazy={!search}
            rows={rowsPerPage}
            totalRecords={totalQuotations}
            first={(currentPageState - 1) * rowsPerPage}
            onPage={(e) => {
              setCurrentPageState(e.page + 1);
              setRowsPerPage(e.rows);
            }}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            className="corrections__table__main"
            dataKey="quotationId"
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="60vh"
          >
            <Column
              body={renderCompany}
              header={rendercheckedHeader(t("quoteListing.company"))}
            ></Column>
            <Column
              body={renderPolicyType}
              header={renderUncheckedHeader(t("quoteListing.policyType"))}
            ></Column>
            <Column
              body={renderGrosspremium}
              header={renderUncheckedHeader(t("quoteListing.grossPremium"))}
            ></Column>
            <Column
              body={renderDate}
              header={renderUncheckedHeader(t("quoteListing.date"))}
            ></Column>
            <Column
              body={renderStatus}
              header={renderUncheckedHeader(t("quoteListing.status"))}
              alignHeader="center"
              headerStyle={{ minWidth: "150px" }}
              style={{ textAlign: "center", minWidth: "150px" }}
            ></Column>
            <Column
              body={renderViewEditButton}
              header={renderUncheckedHeader(t("quoteListing.actions"))}
              alignHeader="center"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default QuoteListingCard;
