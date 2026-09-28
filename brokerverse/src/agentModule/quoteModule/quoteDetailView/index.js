import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import "./index.scss";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { TabView, TabPanel } from "primereact/tabview";
import SvgRightarrow from "../../../assets/agentIcon/SvgRightArrow";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import ShareOption from "./Modal/ShareOption";
import StatusBadge from "../../../components/StatusBadge";
import { canConvertToPolicy } from "../../../utils/statusHelpers";
import { calculatePremiumBreakdown } from "../utils/premiumCalculations";
import useTaxRates from "../utils/useTaxRates";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import { getLeadByIdMiddleware } from "../../leadModule/Store/leadMiddleware";
import { BASE_URL } from "../../../utility/constant";
import authService from "../../../services/authService";
import quotationService from "../../../services/quotationService";
import policyService from "../../../services/policyService";
import { QuotationStatus } from "../../../utils/statusHelpers";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import { isFireLob, isIarLob } from "../../endorsementModule/constants/endorsementCategories";
import { Toast } from "primereact/toast";
import QuotationAuditTrail from "../quotationAuditTrail";

import { numberLocale } from "../../../utility/currencyConverter";
import { vehicleColourLabel } from "../../../utility/quoteOptions";
// Map API coverDesc values to fireLead.opt.cover translation keys (for Fire LOB coverage names)
const COVER_DESC_TO_I18N_KEY = {
  "Fire And Allied Peril": "fireLead.opt.cover.fireAndAlliedPeril",
  "SRCC": "fireLead.opt.cover.srcc",
  "Business Interruption": "fireLead.opt.cover.businessInterruption",
  "Storm, Typhoon": "fireLead.opt.cover.stormTyphoon",
  "Storm": "fireLead.opt.cover.stormTyphoon",
  "Typhoon": "fireLead.opt.cover.stormTyphoon",
  "Hail": "fireLead.opt.cover.hail",
  "Earthquake": "fireLead.opt.cover.earthquake",
  "Loss of Rent/ Alternate Accomodation": "fireLead.opt.cover.lossOfRent",
};

const QuoteDetailView = ({ action }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { state } = useLocation();
  const { id: quotationIdFromUrl } = useParams(); // Extract :id from URL path
  const [modalVisible, setModalVisible] = useState(false);
  const toast = useRef(null);
  const [quotationData, setQuotationData] = useState(
    state?.quotationData || null
  );
  const [relatedPolicy, setRelatedPolicy] = useState(null);
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Get quotation ID from URL path parameter, navigation state, or query params
  const quotationIdFromParams = quotationIdFromUrl || state?.quotationId;

  // Fetch quotation data if not available from navigation state
  useEffect(() => {
    const fetchQuotation = async () => {
      // If we already have data from navigation, don't fetch
      if (quotationData) {
        console.log("=== USING QUOTATION DATA FROM NAVIGATION ===");
        console.log("Quotation data:", quotationData);
        return;
      }

      // If we have a quotation ID, fetch the data
      if (quotationIdFromParams) {
        console.log("=== FETCHING QUOTATION FROM API ===");
        console.log("Quotation ID:", quotationIdFromParams);
        setIsLoading(true);

        try {
          const result = await dispatch(
            getQuotationByIdMiddleware(quotationIdFromParams)
          );

          if (result.type.endsWith("/fulfilled")) {
            console.log("✅ Quotation fetched successfully:", result.payload);
            setQuotationData(result.payload);
          } else {
            console.error("❌ Failed to fetch quotation:", result.payload);
            alert(t("quoteDetailView.failedToLoad"));
          }
        } catch (error) {
          console.error("❌ Error fetching quotation:", error);
          alert(t("quoteDetailView.errorLoading"));
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchQuotation();
  }, [quotationIdFromParams, dispatch, quotationData]);

  const { productConfigurator } = useSelector(
    ({ productConfiguratorReducer }) => {
      return {
        productConfigurator: productConfiguratorReducer?.template,
      };
    }
  );
  const settingsTaxRates = useTaxRates();
  useEffect(() => {
    const productType = quotationData?.productType || "";
    const isFire = productType.toLowerCase().includes("fire");
    const isIar = isIarLob(productType);
    if (quotationData && !isFire && !isIar) {
      dispatch(
        fetchProductTemplateByIdMiddleware({
          templateCode: "MOT-003-2025",
        })
      );
    }
  }, [quotationData, dispatch]);

  const isIarLOB = useMemo(
    () => isIarLob(quotationData?.productType),
    [quotationData?.productType]
  );

  const isFireLOB = useMemo(
    () => !isIarLOB && isFireLob(quotationData?.productType),
    [quotationData?.productType, isIarLOB]
  );

  const fireRiskDetails = quotationData?.fireRiskDetails || quotationData?.fireRisk || {};
  const firePremiumDetails = quotationData?.firePremiumDetails || quotationData?.firePremium || {};
  const iarPremiumDetails = quotationData?.iarPremiumDetails || {};
  const iarSections = quotationData?.iarSections || [];
  const iarScheduleSections =
    iarPremiumDetails?.sections ||
    (Array.isArray(iarSections) ? iarSections : []);
  const fireSumInsured = firePremiumDetails?.sumInsured || {};
  const fireCoverBreakup = firePremiumDetails?.coverBreakup || [];

  // Calculate premium breakdown from coverage details
  const calculatedPremiums = useMemo(() => {
    if (!quotationData) return null;

    if (isIarLOB && iarPremiumDetails && Object.keys(iarPremiumDetails).length) {
      return {
        netPremium: iarPremiumDetails.totalPremiumPreLevy ?? quotationData.netPremium,
        documentaryStampTax: "0.00",
        localGovernmentTax: "0.00",
        valueAddedTax: iarPremiumDetails.valueAddedTax ?? quotationData.valueAddedTax,
        accountPremiumOthers: "0.00",
        discount: iarPremiumDetails.discount ?? "0.00",
        grossPremium:
          iarPremiumDetails.totalPremiumLevyInclusive ??
          iarPremiumDetails.totalPremium ??
          quotationData.grossPremium,
        totalSumInsured:
          iarPremiumDetails.totalSumInsured ?? quotationData.totalSumInsured,
      };
    }

    // Fire LOB: Use firePremiumDetails
    if (isFireLOB && firePremiumDetails) {
      const total = firePremiumDetails.totalPremium ?? 0;
      return {
        netPremium: firePremiumDetails.totalCoverPremium ?? total,
        documentaryStampTax: "0.00",
        valueAddedTax: "0.00",
        localGovernmentTax: "0.00",
        accountPremiumOthers: "0.00",
        discount: firePremiumDetails.totalDiscount ?? "0.00",
        grossPremium: total,
      };
    }

    // Motor: PRIORITY 1: Use stored premium values if available
    if (quotationData.netPremium && quotationData.grossPremium) {
      return {
        netPremium: quotationData.netPremium,
        documentaryStampTax: quotationData.documentaryStampTax || "0.00",
        valueAddedTax: quotationData.valueAddedTax || "0.00",
        localGovernmentTax: quotationData.localGovernmentTax || "0.00",
        accountPremiumOthers: quotationData.accountPremiumOthers || "0.00",
        discount: quotationData.discount || "0.00",
        grossPremium: quotationData.grossPremium,
      };
    }

    // Motor: FALLBACK: Calculate from coverage details
    return calculatePremiumBreakdown(quotationData, productConfigurator, settingsTaxRates);
  }, [
    quotationData,
    productConfigurator,
    settingsTaxRates,
    isFireLOB,
    isIarLOB,
    firePremiumDetails,
    iarPremiumDetails,
  ]);

  console.log(calculatedPremiums, "calculatedPremiums --- QUOTE DETAIL VIEW");

  const { PolicyDetails, loading, currentLeadDetails } = useSelector(
    ({ policyDetailsReducer, leadReducer }) => {
      return {
        loading: policyDetailsReducer?.loading,
        PolicyDetails: policyDetailsReducer?.PolicyDetails,
        currentLeadDetails: leadReducer?.currentLeadDetails,
      };
    }
  );

  const fetchRelatedPolicy = async (quoteIdFromData) => {
    if (!quoteIdFromData) {
      return;
    }

    setCheckingPolicy(true);

    try {
      const response = await policyService.getPolicies(1, 1, {
        quoteRefId: quoteIdFromData,
      });

      if (response.success && Array.isArray(response.data?.data)) {
        const policies = response.data.data;
        const matchedPolicy = policies[0];

        if (matchedPolicy) {
          const paymentStatus =
            matchedPolicy.paymentStatus || matchedPolicy.Payment;
          const mappingPayload = {
            policyId: matchedPolicy.policyId || matchedPolicy.id,
            clientId: matchedPolicy.clientId,
            paymentStatus,
            policyData: matchedPolicy,
            clientData: matchedPolicy.client || null,
          };
          setRelatedPolicy(mappingPayload);
        } else {
          setRelatedPolicy(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch related policy:", error);
    } finally {
      setCheckingPolicy(false);
    }
  };

  useEffect(() => {
    if (!quotationData?.quotationId) {
      return;
    }

    if (
      quotationData?.quotationStatus === QuotationStatus.CONVERTED_TO_POLICY
    ) {
      fetchRelatedPolicy(quotationData.quotationId);
    }
  }, [quotationData?.quotationId, quotationData?.quotationStatus]);

  // Fetch lead details to get generatedLeadId
  useEffect(() => {
    if (quotationData?.leadRefId) {
      dispatch(getLeadByIdMiddleware(quotationData.leadRefId));
    }
  }, [dispatch, quotationData?.leadRefId]);

  const handleclick = async () => {
    const quotationId = quotationData?.quotationId;
    const quotationStatus = quotationData?.quotationStatus;

    if (!quotationId) {
      toast.current?.show({
        severity: "error",
        summary: t("quoteDetailView.error"),
        detail: t("quoteDetailView.quotationIdNotFound"),
        life: 3000,
      });
      return;
    }

    // Check if quote can be converted to policy (quick check)
    if (
      !canConvertToPolicy(quotationStatus) &&
      quotationStatus !== "Approved"
    ) {
      toast.current?.show({
        severity: "error",
        summary: t("quoteDetailView.error"),
        detail: t("quoteDetailView.cannotConvertQuote", { status: quotationStatus }),
        life: 4000,
      });
      return;
    }

    console.log("Starting policy conversion flow for quotation:", quotationId);

    const convertIsIar = isIarLob(quotationData?.productType);
    const convertIsFire =
      !convertIsIar &&
      (quotationData?.productType === "Fire and Allied Perils" ||
        quotationData?.productType?.toLowerCase?.().includes("fire"));
    const basePath =
      convertIsFire || convertIsIar
        ? "/agent/convertpolicy/customerinfo/fire/new"
        : "/agent/convertpolicy/customerinfo/new";

    navigate(`${basePath}/${quotationId}`, {
      state: { quotation: quotationData },
    });
  };
  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  // Send quote for customer approval
  const handleSendForApproval = async () => {
    if (!quotationData?.quotationId) {
      toast.error(t("quoteDetailView.quotationIdNotFound"));
      return;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/quotations/${quotationData.quotationId}/send-for-approval`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ sentBy: "agent" }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.current?.show({
          severity: "success",
          summary: t("quoteDetailView.success"),
          detail: t("quoteDetailView.quoteSentToSuccess", { sentTo: result.sentTo }),
          life: 3000,
        });
        // Refresh quotation data
        const refreshed = await dispatch(
          getQuotationByIdMiddleware(quotationData.quotationId)
        );
        if (refreshed.type.endsWith("/fulfilled")) {
          setQuotationData(refreshed.payload);
        }
      } else {
        toast.current?.show({
          severity: "error",
          summary: t("quoteDetailView.error"),
          detail: t("quoteDetailView.failedMessage", { message: result.message }),
          life: 3000,
        });
      }
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("quoteDetailView.error"),
        detail: t("quoteDetailView.errorSendingQuoteForApproval"),
        life: 3000,
      });
      console.error(error);
    }
  };

  // Submit quote to insurer
  const handleSubmitToInsurer = async () => {
    if (!window.confirm(t("quoteDetailView.submitToInsurerConfirm"))) {
      return;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/quotations/${quotationData.quotationId}/submit-to-insurer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ submittedBy: "agent" }),
        }
      );

      const result = await response.json();

      if (result.success) {
        alert(t("quoteDetailView.quoteSubmittedToInsurer"));
        // Refresh data
        const refreshed = await dispatch(
          getQuotationByIdMiddleware(quotationData.quotationId)
        );
        if (refreshed.type.endsWith("/fulfilled")) {
          setQuotationData(refreshed.payload);
        }
      } else {
        alert(t("quoteDetailView.failedMessage", { message: result.message }));
      }
    } catch (error) {
      alert(t("quoteDetailView.errorSubmittingToInsurer"));
      console.error(error);
    }
  };

  // Manual status change (for SubmittedToInsurer -> Approved)
  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(t("quoteDetailView.changeStatusConfirm", { newStatus }))) {
      return;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/quotations/${quotationData.quotationId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ status: newStatus, updatedBy: "agent" }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        alert(t("quoteDetailView.statusUpdatedSuccess", { newStatus }));
        // Refresh data
        const refreshed = await dispatch(
          getQuotationByIdMiddleware(quotationData.quotationId)
        );
        if (refreshed.type.endsWith("/fulfilled")) {
          setQuotationData(refreshed.payload);
        }
      } else {
        alert(t("quoteDetailView.failedMessage", { message: result.message || t("quoteDetailView.statusUpdateFailed") }));
      }
    } catch (error) {
      alert(t("quoteDetailView.errorUpdatingStatus"));
      console.error(error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="overall__quotedetails__view__container">
        <div className="header_title">{t("quoteDetailView.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "40px" }}>
            <i
              className="pi pi-spin pi-spinner"
              style={{ fontSize: "2rem" }}
            ></i>
            <p>{t("quoteDetailView.loadingQuotationDetails")}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state if no data
  if (!quotationData) {
    return (
      <div className="overall__quotedetails__view__container">
        <div className="header_title">{t("quoteDetailView.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>{t("quoteDetailView.noQuotationDataAvailable")}</p>
            <Button
              label={t("quoteDetailView.backToLeads")}
              onClick={handleLeadNavigation}
              className="mt-3"
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="overall__quotedetails__view__container">
      <div className="header_title">{t("quoteDetailView.leads")}</div>
      <div
        onClick={handleLeadNavigation}
        className="left_arrow mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="left_arrow_text">
          {t("quoteDetailView.leadIdColon")}{" "}
          {currentLeadDetails?.generatedLeadId ||
            quotationData?.leadRefId ||
            "N/A"}
        </div>
      </div>
      <Card className="mt-4">
        <TabView
          activeIndex={activeTab}
          onTabChange={(e) => setActiveTab(e.index)}
        >
          <TabPanel header={t("quoteDetailView.details")}>
            <div className="table_header">{t("quoteDetailView.quoteDetails")}</div>
            <div className="quote_details">
              <label>{t("quoteDetailView.pleaseCheckQuoteDetails")}</label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <label>
                  {t("quoteDetailView.quoteIdColon")} {quotationData?.quotationNumber || "N/A"}
                  {isFireLOB && t("quoteDetailView.fireAndAlliedPerilsSuffix")}
                  {isIarLOB &&
                    ` — ${t("iarLead.productType", "Industrial All Risks")}`}
                </label>
                {quotationData?.quotationStatus && (
                  <StatusBadge
                    status={quotationData.quotationStatus}
                    type="quotation"
                    size="sm"
                  />
                )}
              </div>
            </div>
            {!isFireLOB && !isIarLOB && (
              <>
                <div className="sub_title">
                  <label className="policy_text">{t("quoteDetailView.policyDetails")}</label>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.insuranceCompany")}</label>
                    <label className="alpha_text">
                      {quotationData?.participantDetails?.[0]
                        ?.insuranceCompanyName ||
                        quotationData?.participantDetails?.[0]?.participantName ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.coInsurance")}</label>
                    <label className="alpha_text">
                      {quotationData?.isCoInsurance ? t("quoteDetailView.yes") : t("quoteDetailView.no")}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.insurancePolicyType")}</label>
                    <label className="alpha_text">
                      {quotationData?.insurancePolicyType || "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.accountCode")}</label>
                    <label className="alpha_text">
                      {quotationData?.accountCode || "N/A"}
                    </label>
                  </div>
                </div>

                {/* Co-Insurance Participants Table */}
                {quotationData?.isCoInsurance &&
                  quotationData?.participantDetails?.length > 0 && (
                    <div className="sub_title">
                      <label className="policy_text">
                        {t("quoteDetailView.coInsuranceParticipants")}
                      </label>
                      <div style={{ marginTop: "16px" }}>
                        <DataTable
                          value={quotationData.participantDetails}
                          tableStyle={{ minWidth: "50rem" }}
                          size="small"
                        >
                          <Column
                            field="insuranceCompanyName"
                            header={t("tables.insuranceCompany")}
                            body={(rowData, options) => {
                              const isPrimary = options.rowIndex === 0;
                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span>
                                    {rowData.insuranceCompanyName ||
                                      rowData.participantName ||
                                      "N/A"}
                                  </span>
                                  {isPrimary && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        padding: "2px 6px",
                                        backgroundColor: "#3b82f6",
                                        color: "white",
                                        borderRadius: "4px",
                                        fontWeight: "500",
                                      }}
                                    >
                                      {t("quoteDetailView.primary")}
                                    </span>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Column
                            field="participantName"
                            header={t("tables.participantName")}
                            body={(rowData) => rowData.participantName || "N/A"}
                          />
                          <Column
                            field="sharePercentage"
                            header={t("tables.sharePercent")}
                            body={(rowData) => `${rowData.sharePercentage || 0}%`}
                          />
                          <Column
                            field="premiumAmount"
                            header={t("tables.premiumAmount")}
                            body={(rowData) => {
                              const apiAmount = parseFloat(
                                String(rowData.premiumAmount ?? "").replace(
                                  /[^0-9.]/g,
                                  ""
                                )
                              );
                              if (Number.isFinite(apiAmount) && apiAmount > 0) {
                                return formatCurrency(apiAmount);
                              }
                              // Fallback when API returns 0/missing (e.g. new quotes
                              // with null grossPremium) — same base as Gross Premium below
                              const share = parseFloat(
                                String(rowData.sharePercentage ?? "").replace(
                                  /[^0-9.]/g,
                                  ""
                                )
                              );
                              const gross = parseFloat(
                                String(
                                  calculatedPremiums?.grossPremium ?? ""
                                ).replace(/[^0-9.]/g, "")
                              );
                              const computed =
                                Number.isFinite(gross) && Number.isFinite(share)
                                  ? (gross * share) / 100
                                  : 0;
                              return formatCurrency(computed);
                            }}
                          />
                          <Column
                            field="sumInsuredCurrency"
                            header={t("tables.sumInsuredCurrency")}
                            body={(rowData) => rowData.sumInsuredCurrency || "N/A"}
                          />
                          <Column
                            field="premiumCurrency"
                            header={t("tables.premiumCurrency")}
                            body={(rowData) => rowData.premiumCurrency || "N/A"}
                          />
                        </DataTable>
                      </div>
                    </div>
                  )}
              </>
            )}

            {isIarLOB && (
              <>
                <div className="sub_title">
                  <label className="policy_text">
                    {t("quoteDetailView.policyDetails", "Policy Details")}
                  </label>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t("iarLead.productCode", "Product Code")}
                    </label>
                    <label className="alpha_text">
                      {quotationData?.insurancePolicyType || "2009"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t(
                        "quoteDetailView.insurancePolicyType",
                        "Insurance Policy Type"
                      )}
                    </label>
                    <label className="alpha_text">
                      {quotationData?.productType ||
                        t("iarLead.productType", "Industrial All Risks")}
                    </label>
                  </div>
                </div>

                <div className="sub_title">
                  <label className="policy_text">
                    {t("iarLead.scheduleOfCover", "Schedule of Cover")}
                  </label>
                  <div className="qdv-iar-schedule-wrap">
                    <table className="qdv-iar-schedule-table w-full">
                      <thead>
                        <tr>
                          <th>
                            {t(
                              "iarLead.sectionItemPerils",
                              "SECTION / ITEM / PERILS"
                            )}
                          </th>
                          <th>{t("iarLead.sumInsured", "SUM INSURED")}</th>
                          <th>{t("iarLead.premium", "PREMIUM")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {iarScheduleSections.length === 0 ? (
                          <tr>
                            <td colSpan={3}>
                              {t("policyDetail.nA", "N/A")}
                            </td>
                          </tr>
                        ) : (
                          iarScheduleSections.map((section) => (
                            <React.Fragment
                              key={
                                section.sectionId ||
                                section.id ||
                                section.sectionCode
                              }
                            >
                              <tr className="qdv-iar-section-row">
                                <td>
                                  <strong>
                                    {section.sectionLabel ||
                                      section.sectionCode ||
                                      "—"}
                                  </strong>
                                  {section.ratePercent != null && (
                                    <div className="qdv-iar-help">
                                      {t("iarLead.rate", "rate")}{" "}
                                      {section.ratePercent}%
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {formatCurrency(
                                    section.sectionSumInsured ?? 0
                                  )}
                                </td>
                                <td>
                                  {formatCurrency(
                                    section.sectionPremium ?? 0
                                  )}
                                </td>
                              </tr>
                              {(section.items || []).map((item) => (
                                <React.Fragment key={item.id || item.name}>
                                  <tr>
                                    <td style={{ paddingLeft: 16 }}>
                                      Item: {item.name}
                                    </td>
                                    <td>
                                      {formatCurrency(
                                        item.itemSumInsured ?? 0
                                      )}
                                    </td>
                                    <td />
                                  </tr>
                                  {(item.perils || []).map((p) => (
                                    <tr key={p.id || p.name}>
                                      <td style={{ paddingLeft: 28 }}>
                                        {p.name}
                                      </td>
                                      <td>
                                        {formatCurrency(p.sumInsured ?? 0)}
                                      </td>
                                      <td />
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </React.Fragment>
                          ))
                        )}
                        <tr>
                          <td>
                            <strong>{t("common.total", "Total")}</strong>
                          </td>
                          <td>
                            <strong>
                              {formatCurrency(
                                iarPremiumDetails.totalSumInsured ??
                                  calculatedPremiums?.totalSumInsured ??
                                  quotationData?.totalSumInsured ??
                                  0
                              )}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {formatCurrency(
                                iarPremiumDetails.totalPremiumPreLevy ??
                                  calculatedPremiums?.netPremium ??
                                  0
                              )}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {isFireLOB && (
              <>
                <div className="sub_title">
                  <label className="policy_text">{t("quoteDetailView.riskDetails")}</label>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.constructionType")}</label>
                    <label className="alpha_text">{fireRiskDetails.constructionType || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.buildingType")}</label>
                    <label className="alpha_text">{fireRiskDetails.buildingType || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.locationCode")}</label>
                    <label className="alpha_text">{fireRiskDetails.locationCodeDescription || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.locationAddress")}</label>
                    <label className="alpha_text">{fireRiskDetails.locationAddress || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.occupancyType")}</label>
                    <label className="alpha_text">{fireRiskDetails.occupancyType || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.natureOfBusiness")}</label>
                    <label className="alpha_text">{fireRiskDetails.natureOfBusiness || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.earthquakeZone")}</label>
                    <label className="alpha_text">{fireRiskDetails.earthquakeZone || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.noOfFloors")}</label>
                    <label className="alpha_text">{fireRiskDetails.noOfFloors ?? "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.sectionType")}</label>
                    <label className="alpha_text">{fireRiskDetails.sectionType || "N/A"}</label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.fireProtection")}</label>
                    <label className="alpha_text">{fireRiskDetails.fireProtection || "N/A"}</label>
                  </div>
                </div>
                <div className="sub_title">
                  <label className="policy_text">{t("quoteDetailView.sumInsured")}</label>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.building")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.Building ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.plantAndMachinery")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.PlantAndMachinery ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.otherContents")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.OtherContents ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.grossProfit")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.GrossProfit ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.wages")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.Wages ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.lossOfRent")}</label>
                    <label className="alpha_text">
                      {(fireSumInsured.LossOfRent ?? 0).toLocaleString(numberLocale())}
                    </label>
                  </div>
                </div>
                {fireCoverBreakup.length > 0 && (
                  <div className="sub_title">
                    <label className="policy_text">{t("quoteDetailView.coverageAndPremium")}</label>
                    {fireCoverBreakup.map((cover, i) => {
                      const coverLabel = cover.coverDesc
                        ? (COVER_DESC_TO_I18N_KEY[cover.coverDesc] ? t(COVER_DESC_TO_I18N_KEY[cover.coverDesc]) : cover.coverDesc)
                        : t("quoteDetailView.coverFallback", { index: i + 1 });
                      return (
                      <div key={cover.coverDesc ? `${cover.coverDesc}-${i}` : `cover-${i}`} className="quote_details">
                        <label className="insurance_text">{coverLabel}</label>
                        <label className="alpha_text">
                          {formatCurrency(cover.premium ?? 0)}
                        </label>
                      </div>
                    );})}
                    {firePremiumDetails.sprinklerDiscount != null && firePremiumDetails.sprinklerDiscount > 0 && (
                      <div className="quote_details">
                        <label className="insurance_text">{t("quoteDetailView.sprinklerDiscount")}</label>
                        <label className="alpha_text">{firePremiumDetails.sprinklerDiscount}%</label>
                      </div>
                    )}
                    {firePremiumDetails.fireExtinguisherDiscount != null && firePremiumDetails.fireExtinguisherDiscount > 0 && (
                      <div className="quote_details">
                        <label className="insurance_text">{t("quoteDetailView.fireExtinguisherDiscount")}</label>
                        <label className="alpha_text">{firePremiumDetails.fireExtinguisherDiscount}%</label>
                      </div>
                    )}
                    <div className="quote_details">
                      <label className="insurance_text">{t("quoteDetailView.earthquakeZoneLoading")}</label>
                      <label className="alpha_text">{formatCurrency(firePremiumDetails.earthquakeZoneLoading ?? 0)}</label>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="sub_title">
              <label className="policy_text">{t("quoteDetailView.assuredDetails")}</label>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.name")}</label>
                <label className="alpha_text">
                  {quotationData?.lead?.firstName && quotationData?.lead?.lastName
                    ? `${quotationData.lead.firstName} ${quotationData.lead.lastName}`
                    : currentLeadDetails?.firstName && currentLeadDetails?.lastName
                    ? `${currentLeadDetails.firstName} ${currentLeadDetails.lastName}`
                    : "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.emailId")}</label>
                <label className="alpha_text">
                  {quotationData?.lead?.emailId || currentLeadDetails?.emailId || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.contactNumber")}</label>
                <label className="alpha_text">
                  {quotationData?.lead?.contactNumber || currentLeadDetails?.contactNumber || "N/A"}
                </label>
              </div>
            </div>
            {!isFireLOB && !isIarLOB && (
              <>
                <div className="sub_title">
                  <label className="policy_text">{t("quoteDetailView.insuranceVehicleDetails")}</label>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.vehicleBrand")}</label>
                    <label className="alpha_text">
                      {quotationData?.insuranceVehicleDetails?.[0]?.vehicleBrand ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.modelYear")}</label>
                    <label className="alpha_text">
                      {quotationData?.insuranceVehicleDetails?.[0]?.modelYear ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.vehicleModel")}</label>
                    <label className="alpha_text">
                      {quotationData?.insuranceVehicleDetails?.[0]?.vehicleModel ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.modelVariant")}</label>
                    <label className="alpha_text">
                      {quotationData?.insuranceVehicleDetails?.[0]?.modelVariant ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.vehicleColor")}</label>
                    <label className="alpha_text">
                      {vehicleColourLabel(quotationData?.insuranceVehicleDetails?.[0]?.vehicleColor) ||
                        "N/A"}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.seatingCapacity")}</label>
                    <label className="alpha_text">
                      {quotationData?.insuranceVehicleDetails?.[0]
                        ?.seatingCapacity || "N/A"}
                    </label>
                  </div>
                </div>
                <div className="sub_title">
                  <label className="policy_text">{t("quoteDetailView.coverageDetails")}</label>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.totalSumInsured")}</label>
                    <label className="alpha_text">
                      {quotationData?.totalSumInsured
                        ? `${parseFloat(
                            quotationData.totalSumInsured
                          ).toLocaleString(numberLocale())}.00`
                        : "N/A"}
                    </label>
                  </div>
                </div>
              </>
            )}
            <div className="sub_title">
              <label className="policy_text">{t("quoteDetailView.paymentDetails")}</label>
              {isIarLOB && (
                <>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t("iarLead.totalPremiumPreLevy", "Total premium (pre-levy)")}
                    </label>
                    <label className="alpha_text">
                      {formatCurrency(calculatedPremiums?.netPremium)}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t("agent.valueAddedTax", "Value Added Tax")} (
                      {iarPremiumDetails.vatPercent ?? 12}%)
                    </label>
                    <label className="alpha_text">
                      {formatCurrency(calculatedPremiums?.valueAddedTax)}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t("quoteDetailView.discount", "Discount")}
                    </label>
                    <label className="alpha_text">
                      {formatCurrency(
                        calculatedPremiums?.discount === "NaN"
                          ? 0
                          : calculatedPremiums?.discount
                      )}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="insurance_text">
                      {t("quoteDetailView.totalSumInsured", "Total Sum Insured")}
                    </label>
                    <label className="alpha_text">
                      {formatCurrency(
                        iarPremiumDetails.totalSumInsured ??
                          calculatedPremiums?.totalSumInsured ??
                          quotationData?.totalSumInsured ??
                          0
                      )}
                    </label>
                  </div>
                  <div className="quote_details">
                    <label className="gross_text">
                      {t(
                        "iarLead.totalPremiumLevyInclusive",
                        "Total Premium (levy-inclusive)"
                      )}
                    </label>
                    <label className="gross_count">
                      {formatCurrency(calculatedPremiums?.grossPremium)}
                    </label>
                  </div>
                </>
              )}
              {isFireLOB && (
                <>
                  <div className="quote_details">
                    <label className="insurance_text">{t("quoteDetailView.totalCoverPremium")}</label>
                    <label className="alpha_text">
                      {formatCurrency(firePremiumDetails.totalCoverPremium)}
                    </label>
                  </div>
                  {(firePremiumDetails.earthquakeZoneLoading ?? 0) > 0 && (
                    <div className="quote_details">
                      <label className="insurance_text">{t("quoteDetailView.earthquakeZoneLoading")}</label>
                      <label className="alpha_text">
                        {formatCurrency(firePremiumDetails.earthquakeZoneLoading || 0)}
                      </label>
                    </div>
                  )}
                  {(firePremiumDetails.totalDiscount ?? 0) > 0 && (
                    <div className="quote_details">
                      <label className="insurance_text">{t("quoteDetailView.totalDiscount")}</label>
                      <label className="alpha_text">
                        -{formatCurrency(firePremiumDetails.totalDiscount || 0)}
                      </label>
                    </div>
                  )}
                  <div className="quote_details">
                    <label className="gross_text">{t("quoteDetailView.grossPremium")}</label>
                    <label className="gross_count">
                      {formatCurrency(calculatedPremiums?.grossPremium)}
                    </label>
                  </div>
                </>
              )}
              {!isFireLOB && !isIarLOB && (
                <>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.netPremium")}</label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.netPremium)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("quoteDetailView.dst")} ({" "}
                  {
                    productConfigurator?.configuration?.taxes
                      ?.documentary_stamp_tax
                  }
                  %)
                </label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.documentaryStampTax)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("quoteDetailView.vat")} (
                  {productConfigurator?.configuration?.taxes?.value_added_tax}%
                  )
                </label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.valueAddedTax)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("quoteDetailView.lgt")} (
                  {
                    productConfigurator?.configuration?.taxes
                      ?.local_government_tax
                  }
                  % )
                </label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.localGovernmentTax)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.others")}</label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.accountPremiumOthers)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("quoteDetailView.discount")}</label>
                <label className="alpha_text">
                  {formatCurrency(calculatedPremiums?.discount === "NaN" ? 0 : calculatedPremiums?.discount)}
                </label>
              </div>
              <div className="quote_details">
                <label className="gross_text">{t("quoteDetailView.grossPremium")}</label>
                <label className="gross_count">
                  {formatCurrency(calculatedPremiums?.grossPremium)}
                </label>
              </div>
                </>
              )}
            </div>
          </TabPanel>
          <TabPanel header={t("quoteDetailView.auditTrail")}>
            <QuotationAuditTrail
              quotationId={quotationData?.quotationId || quotationIdFromParams}
            />
          </TabPanel>
        </TabView>
      </Card>
      {activeTab === 0 && (
        <div className="button_component">
          <Button
            label={t("quoteDetailView.share")}
            severity="help"
            text
            className="download_button"
            onClick={() => setModalVisible(true)}
          />
          {quotationData?.quotationStatus === "CustomerAccepted" ||
          quotationData?.quotationStatus === "Approved" ? (
            <Button
              onClick={handleclick}
              label={t("quoteDetailView.proceedToPolicy")}
              className="policy_button p-button-success"
            >
              <SvgRightarrow />
            </Button>
          ) : null}

          {quotationData?.quotationStatus ===
            QuotationStatus.CONVERTED_TO_POLICY &&
            relatedPolicy?.paymentStatus !== "Completed" && (
              <Button
                label={
                  checkingPolicy ? t("quoteDetailView.checkingPolicy") : t("quoteDetailView.waitingForPolicy")
                }
                // className="policy_button p-button-outlined"
                disabled={checkingPolicy || !relatedPolicy?.policyId}
                onClick={() => {
                  if (!relatedPolicy?.policyId) {
                    return;
                  }

                  navigate(`/agent/policyapproval`, {
                    state: {
                      quotationId: quotationData.quotationId,
                      policyId: relatedPolicy.policyId,
                      clientId: relatedPolicy.clientId,
                      leadId: quotationData.leadRefId,
                      quotation: quotationData,
                      additionalPolicyData: relatedPolicy.policyData,
                      paymentStatus: relatedPolicy.paymentStatus,
                      policyData: relatedPolicy.policyData,
                      clientData: relatedPolicy.clientData,
                      fromQuoteDetail: true,
                    },
                  });
                }}
              >
                <SvgRightarrow />
              </Button>
            )}

          {/* Status-based action buttons - Hide when CustomerAccepted or Approved since main Proceed button is shown */}
          {quotationData?.quotationStatus !== "CustomerAccepted" &&
            quotationData?.quotationStatus !== "Approved" && (
              <div
                className="quote-actions"
                style={{
                  marginTop: "20px",
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                {/* Draft: Can send for approval */}
                {quotationData?.quotationStatus === "Draft" && (
                  <Button
                    label={t("quoteDetailView.sendForCustomerApproval")}
                    icon="pi pi-send"
                    onClick={handleSendForApproval}
                    className="p-button-success"
                  />
                )}

                {/* PendingCustomer: Waiting for customer */}
                {quotationData?.quotationStatus === "PendingCustomer" && (
                  <div
                    className="waiting-notice"
                    style={{
                      padding: "10px",
                      backgroundColor: "#fef3c7",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <i
                      className="pi pi-clock"
                      style={{ marginRight: "8px" }}
                    ></i>
                    {t("quoteDetailView.waitingForCustomerApproval")}
                  </div>
                )}
              </div>
            )}
        </div>
      )}
      <ShareOption
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        quotationData={quotationData}
      />
      <Toast ref={toast} />
    </div>
  );
};

export default QuoteDetailView;
