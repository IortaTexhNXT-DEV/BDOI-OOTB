import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import "./index.scss";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgLeftArrow from "../../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import { BASE_URL } from "../../../../utility/constant";
import authService from "../../../../services/authService";
import policyService from "../../../../services/policyService";
import { fetchProductTemplateByIdMiddleware } from "../../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import ShareOption from "../../../quoteModule/quoteDetailView/Modal/ShareOption";
import { formatDate } from "@fullcalendar/core/index.js";
import axios from "axios";
import { validateAccountingEquation } from "../../../../utility/accountingValidation";
import { isFireLob } from "../../constants/endorsementCategories";

import { numberLocale } from "../../../../utility/currencyConverter";
const EndorsementSummary = ({ action }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { state } = useLocation();
  const { id: endorsementIdFromUrl } = useParams();
  const [modalVisible, setModalVisible] = useState(false);

  const [policyData, setPolicyData] = useState(null);
  const [relatedPolicy, setRelatedPolicy] = useState(null);
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { productConfigurator } = useSelector(
    ({ productConfiguratorReducer }) => {
      return {
        productConfigurator: productConfiguratorReducer?.template,
      };
    }
  );

  const isFireLOBInitial = useMemo(() => {
    const ids =
      state?.endorsementData?.summary?.endorsementTypeIds ||
      state?.endorsementData?.endorsementTypeIds ||
      [];
    const arr = Array.isArray(ids) ? ids : [ids];
    const idStr = state?.endorsementId || endorsementIdFromUrl || "";
    return (
      arr.includes("fire_regular") ||
      arr.includes("fire_cancel") ||
      (typeof idStr === "string" && idStr.toUpperCase().includes("FIRE"))
    );
  }, [state?.endorsementData, state?.endorsementId, endorsementIdFromUrl]);

  useEffect(() => {
    if (!isFireLOBInitial) {
      dispatch(
        fetchProductTemplateByIdMiddleware({
          templateCode: "MOT-003-2025",
        })
      );
    }
  }, [dispatch, isFireLOBInitial]);

  const fetchRelatedPolicy = async (quoteIdFromData) => {
    if (!quoteIdFromData) {
      return;
    }

    setCheckingPolicy(true);

    try {
      const response = await policyService.getPolicies(1, 1, {
        policyNumber: state?.endorsementData?.policyNumber,
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
          setPolicyData(matchedPolicy);
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
    if (state?.endorsementData?.policyNumber) {
      fetchRelatedPolicy(state?.endorsementData?.policyNumber);
    }
  }, [state?.endorsementData?.policyNumber]);

  // Validate accounting equation for displayed values
  const coverageChanges = useMemo(() => {
    return (
      state?.endorsementData?.summary?.coverageChanges ||
      state?.endorsementData?.coverageChanges ||
      {}
    );
  }, [state?.endorsementData]);

  useEffect(() => {
    const gross =
      coverageChanges?.Grosspremium ?? coverageChanges?.totalPremium;
    if (coverageChanges && gross) {
      const validation = validateAccountingEquation(
        {
          grossPremium: gross,
          netPremium: coverageChanges.NETpremium || 0,
          valueAddedTax: coverageChanges.ValueAddedTax || 0,
          documentaryStampTax: coverageChanges.DocumentaryStampTax || 0,
          localGovernmentTax: coverageChanges.LocalGovtTax || 0,
          accountPremiumOthers: coverageChanges.OthersPremium || 0,
          discount: coverageChanges.Discount || 0,
        },
        "EndorsementSummary"
      );

      if (!validation.isValid) {
        console.warn("⚠️ [EndorsementSummary] Accounting equation mismatch:", {
          ...validation.breakdown,
          calculatedTotal: validation.calculatedTotal,
          difference: validation.difference,
          endorsementId: state?.endorsementId,
        });
      } else {
        console.log("✅ [EndorsementSummary] Accounting equation validates correctly:", {
          ...validation.breakdown,
          calculatedTotal: validation.calculatedTotal,
          endorsementId: state?.endorsementId,
        });
      }
    }
  }, [coverageChanges, state?.endorsementId]);

  const quotationData = policyData?.quotation;

  const endorsementTypeIds = useMemo(
    () =>
      state?.endorsementData?.summary?.endorsementTypeIds ||
      state?.endorsementData?.endorsementTypeIds ||
      [],
    [state?.endorsementData]
  );

  const isFireLOB = useMemo(() => {
    const lob =
      state?.lob ||
      state?.productType ||
      state?.endorsementData?.productType ||
      state?.endorsementData?.lob ||
      policyData?.product ||
      quotationData?.productType;
    if (isFireLob(lob)) return true;
    const ids = Array.isArray(endorsementTypeIds)
      ? endorsementTypeIds
      : [endorsementTypeIds];
    const idStr = state?.endorsementId || endorsementIdFromUrl || "";
    return (
      ids.includes("fire_regular") ||
      ids.includes("fire_cancel") ||
      (typeof idStr === "string" && idStr.toUpperCase().includes("FIRE"))
    );
  }, [
    state?.lob,
    state?.productType,
    state?.endorsementData?.productType,
    state?.endorsementData?.lob,
    state?.endorsementId,
    endorsementIdFromUrl,
    policyData?.product,
    quotationData?.productType,
    endorsementTypeIds,
  ]);

  const fireDetails = useMemo(
    () =>
      state?.endorsementData?.summary?.fireDetails ||
      state?.endorsementData?.fireDetails ||
      {},
    [state?.endorsementData]
  );

  const fireRiskDetails = fireDetails?.fireRiskDetails || {};
  const firePremiumDetails = fireDetails?.firePremiumDetails || {};
  const fireSumInsured = firePremiumDetails?.sumInsured || {};
  const fireCoverBreakup = firePremiumDetails?.coverBreakup || [];

  const handleLeadNavigation = () => {
    navigate(-1);
  };

  // Send quote for customer approval
  const handleSendForApproval = async () => {
    setIsSending(true);
    if (!state?.endorsementId) {
      alert(t("endorsementSummary.endorsementIdNotFound"));
      setIsSending(false);
      return;
    }

    if (!window.confirm(t("endorsementSummary.confirmSendToInsurance"))) {
      return;
    }

    try {
      // Check if this is a cancellation endorsement
      // Check multiple conditions: status, endorsementTypeIds, or isCancelPolicy flag
      const endorsementStatus = state?.endorsementData?.status;
      const endorsementTypeIds =
        state?.endorsementData?.summary?.endorsementTypeIds ||
        state?.endorsementData?.endorsementTypeIds ||
        [];
      const ids = Array.isArray(endorsementTypeIds)
        ? endorsementTypeIds
        : [endorsementTypeIds];
      const isCancellation =
        endorsementStatus === "InitiateCancel" ||
        endorsementStatus === "Cancelled" ||
        ids.includes(5) ||
        ids.includes("fire_cancel") ||
        state?.endorsementData?.isCancelPolicy === true;

      const URL = isCancellation
        ? `${BASE_URL}/endorsements/initiate-cancel-policy/${state?.endorsementId}`
        : `${BASE_URL}/endorsements/send-endorsement-to-customer/${state?.endorsementId}`;
      
      const response = await axios.post(
        URL,
        {
          sentBy: "agent",
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (response.data.success) {
        // Update endorsementData if returned from backend
        const updatedEndorsementData = response.data.endorsement || state?.endorsementData;
        
        setTimeout(() => {
          navigate(`/agent/endorsement/paymenterror/${state?.endorsementId}`, {
            state: {
              endorsementId: state?.endorsementId,
              policyId: state?.policyId,
              clientId: state?.clientId,
              clientNumber: state?.clientNumber,
              clientName: state?.clientName,
              endorsementData: updatedEndorsementData,
            },
          });
        }, 2000);
        setIsSending(false);
      } else {
        setIsSending(false);
        alert(t("endorsementSummary.failedToSend"));
      }
    } catch (error) {
      setIsSending(false);
      alert(t("endorsementSummary.errorSending"));
      console.error(error);
    } finally {
      setIsSending(false);
    }

    // try {
    //   const response = await fetch(
    //     `${BASE_URL}/quotations/${quotationData.quotationId}/send-for-approval`,
    //     {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         ...authService.getAuthHeader(),
    //       },
    //       body: JSON.stringify({ sentBy: "agent" }),
    //     }
    //   );

    //   const result = await response.json();

    //   if (result.success) {
    //     alert(`Quote sent to ${result.sentTo} successfully!`);
    //     // Refresh quotation data
    //     const refreshed = await dispatch(
    //       getQuotationByIdMiddleware(quotationData.quotationId)
    //     );
    //     if (refreshed.type.endsWith("/fulfilled")) {
    //       setQuotationData(refreshed.payload);
    //     }
    //   } else {
    //     alert(`Failed: ${result.message}`);
    //   }
    // } catch (error) {
    //   alert("Error sending quote for approval");
    //   console.error(error);
    // }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="overall__quotedetails__view__container">
        <div className="header_title">{t("endorsementSummary.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "40px" }}>
            <i
              className="pi pi-spin pi-spinner"
              style={{ fontSize: "2rem" }}
            ></i>
            <p>{t("endorsementSummary.loadingQuotationDetails")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const calculateNumberOfDays = () => {
    if (
      !state?.endorsementData?.summary?.policyExtension?.FromDate ||
      !state?.endorsementData?.summary?.policyExtension?.ToDate
    ) {
      return "0";
    }
    return differenceInDays(
      state?.endorsementData?.summary?.policyExtension?.FromDate,
      state?.endorsementData?.summary?.policyExtension?.ToDate
    );
  };
  const differenceInDays = (fromDate, toDate) => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
  };
  return (
    <div className="overall__quotedetails__view__container">
      <div className="header_title">{t("endorsementSummary.policy")}</div>
      <div
        onClick={handleLeadNavigation}
        className="left_arrow mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="left_arrow_text">
          {t("endorsementSummary.policyNumberColon")} {state.endorsementData?.policyNumber || t("policyDetail.nA")}
        </div>
      </div>
      <Card className="mt-4">
        <div className="table_header">
          {state?.endorsementData?.status === "InitiateCancel"
            ? t("endorsementSummary.endorsementRefundDetails")
            : t("endorsementSummary.endorsementDetails")}
        </div>
        <div className="quote_details">
          <label>{t("endorsementSummary.checkEndorsementDetails")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label>{t("endorsementSummary.endorsementIdColon")} {state?.endorsementId || t("policyDetail.nA")}</label>
          </div>
        </div>
        <div className="sub_title">
          <label className="policy_text">{t("endorsementSummary.policyDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.insuranceCompany")}</label>
            <label className="alpha_text">
              {quotationData?.participantDetails?.[0]?.insuranceCompanyName ||
                quotationData?.participantDetails?.[0]?.participantName ||
                "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.coInsurance")}</label>
            <label className="alpha_text">
              {quotationData?.isCoInsurance ? "Yes" : "No"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.insurancePolicyType")}</label>
            <label className="alpha_text">
              {quotationData?.insurancePolicyType || "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.accountCode")}</label>
            <label className="alpha_text">
              {quotationData?.accountCode || "N/A"}
            </label>
          </div>
        </div>

        {/* Co-Insurance Participants Table */}
        {quotationData?.isCoInsurance &&
          quotationData?.participantDetails?.length > 0 && (
            <div className="sub_title">
              <label className="policy_text">{t("endorsementSummary.coInsuranceParticipants")}</label>
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
                              PRIMARY
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
        <div className="sub_title">
          <label className="policy_text">{t("endorsementSummary.assuredDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.name")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.summary?.personalDetails?.FirstName &&
              state?.endorsementData?.summary?.personalDetails?.LastName
                ? `${state?.endorsementData?.summary?.personalDetails?.FirstName} ${state?.endorsementData?.summary?.personalDetails?.LastName}`
                : "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.emailId")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.summary?.personalDetails?.EmailID ||
                "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.contactNumber")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.summary?.personalDetails
                ?.ContactNumber || "N/A"}
            </label>
          </div>
        </div>
        {!isFireLOB && (
          <div className="sub_title">
            <label className="policy_text">Motor Details</label>
            <div className="quote_details">
              <label className="insurance_text">Vehicle Brand</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.VehicleBrand ||
                  "N/A"}
              </label>
            </div>
            <div className="quote_details">
              <label className="insurance_text">Model Year</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.ModelYear ||
                  "N/A"}
              </label>
            </div>
            <div className="quote_details">
              <label className="insurance_text">Vehicle Model</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.VehicleModel ||
                  "N/A"}
              </label>
            </div>
            <div className="quote_details">
              <label className="insurance_text">Model Variant</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.ModelVariant ||
                  "N/A"}
              </label>
            </div>
            <div className="quote_details">
              <label className="insurance_text">Vehicle Color</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.VehicleColor ||
                  "N/A"}
              </label>
            </div>
            <div className="quote_details">
              <label className="insurance_text">Seating Capacity</label>
              <label className="alpha_text">
                {state?.endorsementData?.summary?.motorDetails?.SeatingCapacity ||
                  "N/A"}
              </label>
            </div>
          </div>
        )}
        {isFireLOB && (
          <>
            <div className="sub_title">
              <label className="policy_text">{t("endorsementSummary.riskDetails")}</label>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.constructionType")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.constructionType || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.buildingType")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.buildingType || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.locationAddress")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.locationAddress || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.occupancyType")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.occupancyType || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.earthquakeZone")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.earthquakeZone || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.fireProtection")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.fireProtection || "N/A"}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.noOfFloors")}</label>
                <label className="alpha_text">
                  {fireRiskDetails?.noOfFloors ?? "N/A"}
                </label>
              </div>
            </div>
            <div className="sub_title">
              <label className="policy_text">{t("endorsementSummary.sumInsured")}</label>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.building")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.Building ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.plantAndMachinery")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.PlantAndMachinery ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.otherContents")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.OtherContents ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.grossProfit")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.GrossProfit ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.wages")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.Wages ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("endorsementSummary.lossOfRent")}</label>
                <label className="alpha_text">
                  {(fireSumInsured?.LossOfRent ?? 0).toLocaleString(numberLocale())}
                </label>
              </div>
            </div>
            {fireCoverBreakup?.length > 0 && (
              <div className="sub_title">
                <label className="policy_text">Coverage Breakup</label>
                {fireCoverBreakup.map((cover, i) => (
                  <div key={cover?.coverDesc || i} className="quote_details">
                    <label className="insurance_text">
                      {cover?.coverDesc || `Cover ${i + 1}`}
                    </label>
                    <label className="alpha_text">
                      SI: {(cover?.si ?? 0).toLocaleString(numberLocale())} | Rate:{" "}
                      {cover?.rate ?? 0}% | Premium: {formatCurrency(cover?.premium ?? 0)}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!isFireLOB && (
          <div className="sub_title">
            <label className="policy_text">Coverage details</label>
            <div className="quote_details">
              <label className="insurance_text">Total Sum Insured</label>
              <label className="alpha_text">
                {formatCurrency(state?.endorsementData?.summary?.coverageChanges?.TotalSumInsured)}
              </label>
            </div>
          </div>
        )}
        {!isFireLOB && (
          <div className="sub_title">
            <label className="policy_text">Policy Extension Details</label>
          <div className="quote_details">
            <label className="insurance_text">From Date</label>
            <label className="alpha_text">
              {state?.endorsementData?.summary?.policyExtension?.FromDate
                ? formatDate(
                    new Date(
                      state?.endorsementData?.summary?.policyExtension?.FromDate
                    )
                  )
                : "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">To Date</label>
            <label className="alpha_text">
              {state?.endorsementData?.summary?.policyExtension?.ToDate
                ? formatDate(
                    new Date(
                      state?.endorsementData?.summary?.policyExtension?.ToDate
                    )
                  )
                : "N/A"}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">Number of Days</label>
            <label className="alpha_text">{calculateNumberOfDays()}</label>
          </div>
        </div>
        )}
        <div className="sub_title">
          <label className="policy_text">
            {state?.endorsementData?.status === "InitiateCancel"
              ? t("endorsementSummary.refundDetails")
              : t("endorsementSummary.paymentDetails")}
          </label>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.netPremium")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.NETpremium ?? firePremiumDetails?.totalCoverPremium ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">
              {t("endorsementSummary.dst")} (
              {productConfigurator?.configuration?.taxes?.documentary_stamp_tax ??
                "12.5"}
              %)
            </label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.DocumentaryStampTax ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">
              {t("endorsementSummary.vat")} (
              {productConfigurator?.configuration?.taxes?.value_added_tax ??
                "12"}
              %)
            </label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.ValueAddedTax ?? firePremiumDetails?.valueAddedTax ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">
              LGT (
              {productConfigurator?.configuration?.taxes
                ?.local_government_tax ?? "2"}
              %)
            </label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.LocalGovtTax ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.others")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.OthersPremium ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("endorsementSummary.discount")}</label>
            <label className="alpha_text">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.Discount === "NaN" ? 0 : coverageChanges?.Discount ?? 0)}
            </label>
          </div>
          <div className="quote_details">
            <label className="gross_text">{t("endorsementSummary.grossPremium")}</label>
            <label className="gross_count">
              {state?.endorsementData?.status === "InitiateCancel" ? "-" : ""}
              {formatCurrency(coverageChanges?.Grosspremium ?? coverageChanges?.totalPremium ?? firePremiumDetails?.totalPremium ?? 0)}
            </label>
          </div>
        </div>
      </Card>
      <div className="button_component">
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
          <Button
            loading={isSending}
            label={t("endorsementSummary.sendToInsuranceCompany")}
            icon="pi pi-send"
            onClick={handleSendForApproval}
            className="p-button-primary"
          />
        </div>
      </div>
      <ShareOption
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        quotationData={quotationData}
      />
    </div>
  );
};

export default EndorsementSummary;
