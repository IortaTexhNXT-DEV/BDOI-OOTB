import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import "./index.scss";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import quotationService from "../../../services/quotationService";
import systemSettingsService from "../../../services/systemSettingsService";
import { RadioButton } from "primereact/radiobutton";
import policyService from "../../../services/policyService";
import s3Service from "../../../services/s3Service";
import { formatDate as formatConfiguredDate } from "../../../utility/dateFormat";
import { Dialog } from "primereact/dialog";
import placementService from "../../../services/placementService";
import logger from "../../../utility/logger";

const CoverageDetailedView = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { quotationId: quotationIdParam } = useParams();
  const toast = useRef(null);
  const [quotationData, setQuotationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [existingPolicy, setExistingPolicy] = useState(
    state?.policyData || null
  );
  const [vehiclePhotoUrls, setVehiclePhotoUrls] = useState({});

  const resolvedQuotationId = useMemo(() => {
    return (
      quotationIdParam || state?.quotationId || state?.quotationNumber || null
    );
  }, [quotationIdParam, state?.quotationId, state?.quotationNumber]);

  // Extract data from navigation state
  const customerInfo = state?.customerInfo || {};
  const vehiclePhotos = state?.vehiclePhotos || {};
  const additionalPolicyData = state?.additionalPolicyData || {};
  // Who the client pays: the broker (premium bill) or the insurer directly (direct bill: commission debit note).
  const [billingMode, setBillingMode] = useState("broker");
  useEffect(() => {
    systemSettingsService
      .getConfiguration("direct_bill")
      .then((rows) => {
        const mode = (rows || []).find((r) => r.key === "direct_bill.default_billing_mode")?.value;
        if (mode === "direct" || mode === "broker") setBillingMode(mode);
      })
      .catch(() => {});
  }, []);
  // Don't use stale quotation from state - always use fresh quotationData from API

  useEffect(() => {
    if (!resolvedQuotationId) {
      return;
    }

    const fetchQuotationData = async () => {
      setLoading(true);
      try {
        const result = await quotationService.getQuotationById(
          resolvedQuotationId
        );
        if (result.success) {
          setQuotationData(result.data);
        } else {
          toast.current?.show({
            severity: "error",
            summary: t("common.error"),
            detail: result.error || t("agent.failedToLoadQuotationData"),
            life: 3000,
          });
        }
      } catch (error) {
        logger.error("Error fetching quotation:", error);
        toast.current?.show({
          severity: "error",
          summary: t("common.error"),
          detail: t("agent.failedToLoadQuotationData"),
          life: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuotationData();
  }, [resolvedQuotationId]);

  // Fetch presigned URLs for vehicle photos
  useEffect(() => {
    if (!quotationData) {
      return;
    }

    const fetchVehiclePhotoUrls = async () => {
      const photoUrls = [
        quotationData.vehicleLeftSidePhoto,
        quotationData.vehicleRightSidePhoto,
        quotationData.vehicleFrontSidePhoto,
        quotationData.vehicleRearSidePhoto,
        quotationData.vehicleInteriorDashboardPhoto,
      ].filter((url) => url); // Filter out null/undefined URLs

      if (photoUrls.length === 0) {
        return;
      }

      try {
        const result = await s3Service.getPresignedDownloadUrls(photoUrls);
        if (result.success) {
          setVehiclePhotoUrls(result.data);
        } else {
          logger.error("Failed to fetch presigned URLs:", result.error);
        }
      } catch (error) {
        logger.error("Error fetching vehicle photo presigned URLs:", error);
      }
    };

    fetchVehiclePhotoUrls();
  }, [quotationData]);

  useEffect(() => {
    if (!resolvedQuotationId || existingPolicy) {
      return;
    }

    const loadExistingPolicy = async () => {
      setResolving(true);
      try {
        const response = await policyService.getPolicies(1, 1, {
          quoteRefId: resolvedQuotationId,
        });
        if (
          response.success &&
          Array.isArray(response.data?.data) &&
          response.data.data.length > 0
        ) {
          setExistingPolicy(response.data.data[0]);
        }
      } catch (error) {
        logger.error(
          "Failed to resolve existing policy for coverage view:",
          error
        );
      } finally {
        setResolving(false);
      }
    };

    loadExistingPolicy();
  }, [existingPolicy, resolvedQuotationId]);

  const handleBackNavigation = () => {
    customHistory.back();
  };

  // Placement journey (placement.journey): a line that requires a Placement Slip places the risk with the insurer(s)
  // first; optional lets the user choose; skip converts the quotation directly as before.
  const [journeyChoice, setJourneyChoice] = useState(false);

  const createPlacementSlip = async () => {
    setJourneyChoice(false);
    try {
      setIsProcessing(true);
      const placement = await placementService.placeQuotation(resolvedQuotationId, {
        inceptionDate: additionalPolicyData.inception || additionalPolicyData.inceptionDate || undefined,
        billingMode,
      });
      toast.current?.show({ severity: "success", summary: t("placement.quoteJourney.created", { number: placement.placementNumber }), detail: t("placement.quoteJourney.createdDetail"), life: 2500 });
      navigate(`/placement/placement-slips/${placement.id}`);
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: error.message, life: 5000 });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToInsuranceCompany = async () => {
    if (!resolvedQuotationId || existingPolicy) return convertDirectly();
    const q = quotationData || {};
    if (q.placementId) {
      navigate(`/placement/placement-slips/${q.placementId}`);
      return undefined;
    }
    let journey = q.journey;
    if (!journey) {
      journey = await placementService.journey({ lob: q.lob, productType: q.productType }).catch(() => null);
    }
    const mode = q.isRenewal ? "skip" : journey?.placementSlip || "skip";
    if (mode === "required") return createPlacementSlip();
    if (mode === "optional") {
      setJourneyChoice(true);
      return undefined;
    }
    return convertDirectly();
  };

  const convertDirectly = async () => {
    setJourneyChoice(false);
    if (!resolvedQuotationId) {
      toast.current?.show({
        severity: "warn",
        summary: t("coverageDetailsReview.quotationMissing"),
        detail: t("coverageDetailsReview.quotationMissingDetail"),
        life: 3000,
      });
      return;
    }

    // Check if policy already exists (loaded by useEffect)
    if (existingPolicy) {
      // Navigate directly to policy approval page
      navigate("/agent/policyapproval", {
        state: {
          quotationId: resolvedQuotationId,
          policyId: existingPolicy.policyId || existingPolicy.id,
          clientId: existingPolicy.clientId,
          leadId: existingPolicy.leadId,
          quotation: quotationData,
          customerInfo,
          vehiclePhotos,
          additionalPolicyData,
          policyData: existingPolicy,
        },
      });
      return;
    }

    // No existing policy - proceed with conversion
    try {
      setIsProcessing(true);

      // Prepare the complete policy data
      const policyPayload = {
        ...additionalPolicyData,
        paymentStatus: "Pending", // Set to Pending, not Completed
        paymentMethod: additionalPolicyData.paymentMethod || "Direct Debit",
        billingMode,
      };

      // Call API to convert quotation to policy (creates client & policy with Pending status)
      const result = await quotationService.convertQuotationToPolicy(
        resolvedQuotationId,
        policyPayload,
        "agent"
      );

      if (!result.success && result.code === "PLACEMENT_JOURNEY") {
        setIsProcessing(false);
        await createPlacementSlip();
        return;
      }
      if (result.success) {
        const policyData = result.data?.data?.policy || result.data?.policy;
        const clientData = result.data?.data?.client || result.data?.client;

        const createdPolicyId = policyData?.id || policyData?.policyId;
        const createdClientId = clientData?.id;
        const policyRecord = {
          ...policyData,
          clientId: clientData?.id || policyData?.clientId,
          paymentStatus: policyData?.paymentStatus || "Pending",
        };

        setExistingPolicy(policyRecord);

        // Send email to customer and insurance company
        try {
          const emailResult = await quotationService.emailPolicyQuoteToCustomer(
            resolvedQuotationId,
            createdPolicyId
          );

          if (!emailResult.success) {
            logger.warn("Email failed but continuing:", emailResult.error);
          }
        } catch (emailError) {
          // The policy is issued; a failed e-mail must not stop the flow.
          logger.error("Failed to send email (non-blocking):", emailError);
        }

        toast.current?.show({
          severity: "success",
          summary: t("coverageDetailsReview.sentToInsuranceCompany"),
          detail: t("coverageDetailsReview.sentToInsuranceCompanyDetail"),
          life: 3000,
        });

        // Wait for toast then navigate to waiting page
        setTimeout(() => {
          navigate("/agent/policyapproval", {
            state: {
              quotationId: resolvedQuotationId,
              policyId: createdPolicyId,
              clientId: createdClientId,
              leadId: quotData?.leadRefId,
              quotation: quotationData,
              customerInfo: customerInfo,
              additionalPolicyData: policyPayload,
              vehiclePhotos,
              policyData: policyRecord,
            },
          });
        }, 3000);
      } else {
        throw new Error(result.error || t("coverageDetailsReview.failedToCreateClientPolicy"));
      }
    } catch (error) {
      logger.error("Send to insurance company error:", error);
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: error.message || t("coverageDetailsReview.failedToSendToInsurance"),
        life: 3000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToPayment = () => {
    // Navigate to payment options with all collected data
    navigate(`/agent/quote/paymentoptions/${resolvedQuotationId}`, {
      state: {
        ...state,
        quotation: quotationData,
        quotationId: resolvedQuotationId,
        customerInfo: customerInfo,
        vehiclePhotos: vehiclePhotos,
        additionalPolicyData: additionalPolicyData,
        proceedingToPayment: true,
      },
    });
  };

  const quotData = quotationData || {};
  const lead = quotData?.lead || {};
  const vehicleDetails = quotData?.insuranceVehicleDetails?.[0] || {};
  // risk_participants from the API (lead first, amounts split by share) when present
  const participantDetails = quotData?.participants?.length
    ? quotData.participants.map((p) => ({
        insuranceCompanyName: p.insuranceCompanyName,
        participantName: p.insuranceCompanyName,
        sumInsuredCurrency: quotData.currency,
        premiumCurrency: quotData.currency,
        sharePercentage: p.sharePercent,
        premiumAmount: p.premiumTotal,
      }))
    : quotData?.participantDetails || [];

  // Check if any participant has sumInsured or premium values
  const hasSumInsuredValues = participantDetails.some(
    (participant) =>
      participant.sumInsured &&
      participant.sumInsured !== 0 &&
      participant.sumInsured !== ""
  );
  const hasPremiumValues = participantDetails.some(
    (participant) =>
      participant.premium &&
      participant.premium !== 0 &&
      participant.premium !== ""
  );

  return (
    <div className="overall__lead__view__container">
      <Toast ref={toast} />
      <div className="header__title">{t("coverageDetailsReview.pageTitle")}</div>
      <div className="lead__quote__id mt-3">
        <div
          onClick={handleBackNavigation}
          className="left__arrow cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="left__arrow__text">
            {quotData?.quotationNumber || `Quote ID: ${resolvedQuotationId}`}
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="mt-4">
          <div className="text-center">{t("coverageDetailsReview.loadingQuotationData")}</div>
        </Card>
      ) : (
        <Card className="mt-4">
          <div className="table__header">{t("coverageDetailsReview.coverageDetails")}</div>
          <div className="quote__details">
            <label>
              {t("coverageDetailsReview.reviewBeforePayment")}
            </label>
          </div>

          {/* Policy Details */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.policyDetails")}</label>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.insuranceCompany")}</label>
              <label className="alpha__text">
                {participantDetails[0]?.insuranceCompanyName ||
                  additionalPolicyData?.insuranceCompanyName ||
                  quotData?.insuranceCompanyName ||
                  "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.insurancePolicyType")}</label>
              <label className="alpha__text">
                {quotData?.insurancePolicyType || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.accountCode")}</label>
              <label className="alpha__text">
                {quotData?.accountCode || "N/A"}
              </label>
            </div>
            {/* Hidden fields: Policy Number, Production Date, Inception Date, Issued Date, Expiry Date */}
          </div>

          {/* Assured Details */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.assuredDetails")}</label>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.name")}</label>
              <label className="alpha__text">
                {lead?.firstName} {lead?.lastName}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.emailId")}</label>
              <label className="alpha__text">{lead?.emailId || "N/A"}</label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.contactNumber")}</label>
              <label className="alpha__text">
                {lead?.contactNumber || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.idCardNumber")}</label>
              <label className="alpha__text">
                {quotData?.idCardNumber ||
                  customerInfo?.IdCardNumber ||
                  additionalPolicyData?.idCardNumber ||
                  "N/A"}
              </label>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.insuranceVehicleDetails")}</label>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.vehicleBrand")}</label>
              <label className="alpha__text">
                {vehicleDetails?.vehicleBrand || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.modelYear")}</label>
              <label className="alpha__text">
                {vehicleDetails?.modelYear || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">Vehicle Model</label>
              <label className="alpha__text">
                {vehicleDetails?.vehicleModel || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.modelVariant")}</label>
              <label className="alpha__text">
                {vehicleDetails?.modelVariant || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">Vehicle Color</label>
              <label className="alpha__text">
                {vehicleDetails?.vehicleColor || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.seatingCapacity")}</label>
              <label className="alpha__text">
                {vehicleDetails?.seatingCapacity || "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.motorNumber")}</label>
              <label className="alpha__text">
                {quotData?.motorNumber ||
                  customerInfo?.MotorNumber ||
                  additionalPolicyData?.motorNumber ||
                  "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.chassisNumber")}</label>
              <label className="alpha__text">
                {quotData?.chassisNumber ||
                  customerInfo?.ChassisNumber ||
                  additionalPolicyData?.chassisNumber ||
                  "N/A"}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.plateNumber")}</label>
              <label className="alpha__text">
                {quotData?.plateNumber ||
                  customerInfo?.PlateNumber ||
                  additionalPolicyData?.plateNumber ||
                  "N/A"}
              </label>
            </div>
            {(quotData?.certNumber ||
              quotData?.MvFileNumber ||
              quotData?.authenCode ||
              quotData?.mortgage ||
              quotData?.aluminum ||
              quotData?.airBag ||
              quotData?.TNVS ||
              quotData?.truckType ||
              additionalPolicyData?.certNumber ||
              additionalPolicyData?.MvFileNumber ||
              additionalPolicyData?.authenCode ||
              additionalPolicyData?.mortgage ||
              additionalPolicyData?.aluminum ||
              additionalPolicyData?.airBag ||
              additionalPolicyData?.TNVS ||
              additionalPolicyData?.truckType) && (
              <>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.certificateNumber")}</label>
                  <label className="alpha__text">
                    {quotData?.certNumber ||
                      additionalPolicyData?.certNumber ||
                      "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.mvFileNumber")}</label>
                  <label className="alpha__text">
                    {quotData?.MvFileNumber ||
                      additionalPolicyData?.MvFileNumber ||
                      "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.authenticationCode")}</label>
                  <label className="alpha__text">
                    {quotData?.authenCode ||
                      additionalPolicyData?.authenCode ||
                      "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.mortgage")}</label>
                  <label className="alpha__text">
                    {quotData?.mortgage ||
                      additionalPolicyData?.mortgage ||
                      "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.aluminum")}</label>
                  <label className="alpha__text">
                    {quotData?.aluminum ||
                      additionalPolicyData?.aluminum ||
                      "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.airBag")}</label>
                  <label className="alpha__text">
                    {quotData?.airBag || additionalPolicyData?.airBag || "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">TNVS</label>
                  <label className="alpha__text">
                    {quotData?.TNVS || additionalPolicyData?.TNVS || "N/A"}
                  </label>
                </div>
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.truckType")}</label>
                  <label className="alpha__text">
                    {quotData?.truckType ||
                      additionalPolicyData?.truckType ||
                      "N/A"}
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Vehicle Photos */}
          {(quotData?.vehicleLeftSidePhoto ||
            quotData?.vehicleRightSidePhoto ||
            quotData?.vehicleFrontSidePhoto ||
            quotData?.vehicleRearSidePhoto ||
            quotData?.vehicleInteriorDashboardPhoto) && (
            <div className="sub__title">
              <label className="policy__text">{t("coverageDetailsReview.vehiclePhotos")}</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "20px",
                  marginTop: "20px",
                }}
              >
                {quotData?.vehicleLeftSidePhoto && (
                  <div style={{ textAlign: "center" }}>
                    <label
                      className="insurance__text"
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      Left Side
                    </label>
                    <img
                      src={
                        vehiclePhotoUrls[quotData.vehicleLeftSidePhoto] ||
                        quotData.vehicleLeftSidePhoto
                      }
                      alt="Vehicle Left Side"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          vehiclePhotoUrls[quotData.vehicleLeftSidePhoto] ||
                            quotData.vehicleLeftSidePhoto,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    />
                  </div>
                )}
                {quotData?.vehicleRightSidePhoto && (
                  <div style={{ textAlign: "center" }}>
                    <label
                      className="insurance__text"
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      {t("coverageDetailsReview.rightSide")}
                    </label>
                    <img
                      src={
                        vehiclePhotoUrls[quotData.vehicleRightSidePhoto] ||
                        quotData.vehicleRightSidePhoto
                      }
                      alt="Vehicle Right Side"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          vehiclePhotoUrls[quotData.vehicleRightSidePhoto] ||
                            quotData.vehicleRightSidePhoto,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    />
                  </div>
                )}
                {quotData?.vehicleFrontSidePhoto && (
                  <div style={{ textAlign: "center" }}>
                    <label
                      className="insurance__text"
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      {t("coverageDetailsReview.frontSide")}
                    </label>
                    <img
                      src={
                        vehiclePhotoUrls[quotData.vehicleFrontSidePhoto] ||
                        quotData.vehicleFrontSidePhoto
                      }
                      alt="Vehicle Front Side"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          vehiclePhotoUrls[quotData.vehicleFrontSidePhoto] ||
                            quotData.vehicleFrontSidePhoto,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    />
                  </div>
                )}
                {quotData?.vehicleRearSidePhoto && (
                  <div style={{ textAlign: "center" }}>
                    <label
                      className="insurance__text"
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      Rear Side
                    </label>
                    <img
                      src={
                        vehiclePhotoUrls[quotData.vehicleRearSidePhoto] ||
                        quotData.vehicleRearSidePhoto
                      }
                      alt="Vehicle Rear Side"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          vehiclePhotoUrls[quotData.vehicleRearSidePhoto] ||
                            quotData.vehicleRearSidePhoto,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    />
                  </div>
                )}
                {quotData?.vehicleInteriorDashboardPhoto && (
                  <div style={{ textAlign: "center" }}>
                    <label
                      className="insurance__text"
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      {t("coverageDetailsReview.interiorDashboard")}
                    </label>
                    <img
                      src={
                        vehiclePhotoUrls[
                          quotData.vehicleInteriorDashboardPhoto
                        ] || quotData.vehicleInteriorDashboardPhoto
                      }
                      alt="Vehicle Interior Dashboard"
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          vehiclePhotoUrls[
                            quotData.vehicleInteriorDashboardPhoto
                          ] || quotData.vehicleInteriorDashboardPhoto,
                          "_blank"
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coverage Summary */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.coverageSummary")}</label>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.totalSumInsured")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.totalSumInsured)}
              </label>
            </div>
          </div>

          {/* Detailed Coverage Breakdown */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.coverageBreakdown")}</label>
            {quotData?.lossAndDamageCoverage && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.ownDamageCoverage")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.lossAndDamageCoveragePremium)}
                </label>
              </div>
            )}
            {quotData?.actsOfNaturePremium && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.actsOfNature")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.actsOfNaturePremium)}
                </label>
              </div>
            )}
            {quotData?.bodilyInjury && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.bodilyInjury")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.bodilyInjuryCoveragePremium)}
                </label>
              </div>
            )}
            {quotData?.propertyDamage && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.propertyDamage")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.propertyDamageCoveragePremium)}
                </label>
              </div>
            )}
            {Number(quotData?.ctplCoveragePremium) > 0 && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsCard.ctplTariffPremium")}</label>
                <label className="alpha__text">{formatCurrency(quotData.ctplCoveragePremium)}</label>
              </div>
            )}
            {Number(quotData?.roadsideAssistancePremium) > 0 && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsCard.roadsideAssistancePremium")}</label>
                <label className="alpha__text">{formatCurrency(quotData.roadsideAssistancePremium)}</label>
              </div>
            )}
            {Number(quotData?.personalAccidentCoverPremium) > 0 && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsCard.personalAccidentCoverPremium")}</label>
                <label className="alpha__text">{formatCurrency(quotData.personalAccidentCoverPremium)}</label>
              </div>
            )}
            {quotData?.autoPassengerPersonalAccident && (
              <div className="quote__details">
                <label className="insurance__text">
                  {t("coverageDetailsReview.autoPassengerPersonalAccident")}
                </label>
                <label className="alpha__text">
                  {formatCurrency(quotData.APPAcoveragePremium)}
                </label>
              </div>
            )}
            {quotData?.deductible && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.deductible")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.deductible)}
                </label>
              </div>
            )}
            {quotData?.towing && (
              <div className="quote__details">
                <label className="insurance__text">Towing</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.towing)}
                </label>
              </div>
            )}
            {quotData?.repairLimit && (
              <div className="quote__details">
                <label className="insurance__text">{t("coverageDetailsReview.repairLimit")}</label>
                <label className="alpha__text">
                  {formatCurrency(quotData.repairLimit)}
                </label>
              </div>
            )}
          </div>

          {/* Premium Breakdown */}
          <div className="sub__title">
            <label className="policy__text">{t("coverageDetailsReview.premiumBreakdown")}</label>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.netPremium")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.netPremium)}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.dst")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.documentaryStampTax)}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.vat")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.valueAddedTax)}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.lgt")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.localGovernmentTax)}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.others")}</label>
              <label className="alpha__text">
                {formatCurrency(quotData?.accountPremiumOthers)}
              </label>
            </div>
            <div className="quote__details">
              <label className="insurance__text">{t("coverageDetailsReview.discount")}</label>
              <label className="alpha__text">
                -{formatCurrency(quotData?.discount)}
              </label>
            </div>
            <div className="quote__details">
              <label className="gross__text">Gross Premium</label>
              <label className="gross__count">
                {formatCurrency(quotData?.grossPremium)}
              </label>
            </div>
          </div>

          {/* Accessories */}
          {(quotData?.aircon ||
            quotData?.stereo ||
            quotData?.magWheels ||
            quotData?.others) && (
            <div className="sub__title">
              <label className="policy__text">{t("coverageDetailsReview.accessories")}</label>
              {quotData?.aircon && (
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.aircon")}</label>
                  <label className="alpha__text">
                    {formatCurrency(quotData.aircon)}
                  </label>
                </div>
              )}
              {quotData?.stereo && (
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.stereo")}</label>
                  <label className="alpha__text">
                    {formatCurrency(quotData.stereo)}
                  </label>
                </div>
              )}
              {quotData?.magWheels && (
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.magWheels")}</label>
                  <label className="alpha__text">
                    {formatCurrency(quotData.magWheels)}
                  </label>
                </div>
              )}
              {quotData?.others && (
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.others")}</label>
                  <label className="alpha__text">
                    {formatCurrency(quotData.others)}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Uploaded Documents */}
          {(vehiclePhotos?.leftSide ||
            vehiclePhotos?.rightSide ||
            vehiclePhotos?.frontSide ||
            vehiclePhotos?.rearSide ||
            vehiclePhotos?.interiorDashboard ||
            additionalPolicyData?.vehicleLeftSidePhoto ||
            additionalPolicyData?.vehicleRightSidePhoto ||
            additionalPolicyData?.vehicleFrontSidePhoto ||
            additionalPolicyData?.vehicleRearSidePhoto ||
            additionalPolicyData?.vehicleInteriorDashboardPhoto ||
            additionalPolicyData?.policyDocument) && (
            <div className="sub__title">
              {/* Policy Document */}
              {additionalPolicyData?.policyDocument && (
                <div className="quote__details">
                  <label className="insurance__text">{t("coverageDetailsReview.policyDocument")}</label>
                  <a
                    href={additionalPolicyData.policyDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff", textDecoration: "underline" }}
                  >
                    {t("coverageDetailsReview.viewDocument")}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Participant Details (if co-insurance) */}
          {participantDetails && participantDetails.length > 0 && (
            <div className="sub__title">
              <label className="policy__text">{t("coverageDetailsReview.participantDetails")}</label>
              <DataTable value={participantDetails} className="mt-3">
                <Column field="participantName" header={t("tables.participantName")} />
                <Column field="sumInsuredCurrency" header={t("tables.siCurrency")} />
                <Column field="premiumCurrency" header={t("tables.premiumCurrency")} />
                <Column field="sharePercentage" header={t("tables.sharePercent")} />
                <Column
                  field="premiumAmount"
                  header={t("tables.premiumAmount")}
                  body={(rowData) => formatCurrency(rowData.premiumAmount ?? 0)}
                />
                {hasSumInsuredValues && (
                  <Column field="sumInsured" header={t("tables.sumInsured")} />
                )}
                {hasPremiumValues && (
                  <Column field="premium" header={t("tables.premium")} />
                )}
              </DataTable>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-3">
        <div className="policy__text mb-2">{t("coverageDetailsReview.billingMode", "Billing")}</div>
        <div className="flex flex-column gap-2">
          <div className="flex align-items-center gap-2">
            <RadioButton inputId="review-bill-broker" name="billingMode" value="broker" onChange={(e) => setBillingMode(e.value)} checked={billingMode === "broker"} />
            <label htmlFor="review-bill-broker">
              {t("coverageDetailsReview.brokerBilled", "Broker billed: the client pays the premium to the broker, who remits it to the insurer net of commission")}
            </label>
          </div>
          <div className="flex align-items-center gap-2">
            <RadioButton inputId="review-bill-direct" name="billingMode" value="direct" onChange={(e) => setBillingMode(e.value)} checked={billingMode === "direct"} />
            <label htmlFor="review-bill-direct">
              {t("coverageDetailsReview.directBilled", "Direct bill: the client pays the premium to the insurer; the broker raises a commission debit note to the insurer")}
            </label>
          </div>
        </div>
      </Card>

      <div className="button__component">
        <Button
          label={t("coverageDetailsReview.back")}
          severity="help"
          text
          className="download__button"
          onClick={handleBackNavigation}
          disabled={isProcessing}
        />
        <Button
          label={t("coverageDetailsReview.sendToInsuranceCompany")}
          className="policy_button p-button-success"
          onClick={handleSendToInsuranceCompany}
          disabled={loading || !quotData || isProcessing}
          loading={isProcessing}
        />
      </div>
      <Dialog header={t("placement.quoteJourney.title")} visible={journeyChoice} onHide={() => setJourneyChoice(false)} style={{ width: "36rem" }} breakpoints={{ "640px": "95vw" }}>
        <p>{t("placement.quoteJourney.question")}</p>
        <div className="flex flex-column gap-2">
          <Button label={t("placement.quoteJourney.placement")} icon="pi pi-briefcase" onClick={createPlacementSlip} />
          <small className="text-500">{t("placement.quoteJourney.placementHint")}</small>
          <Button label={t("placement.quoteJourney.direct")} icon="pi pi-verified" severity="secondary" outlined onClick={convertDirectly} className="mt-2" />
          <small className="text-500">{t("placement.quoteJourney.directHint")}</small>
        </div>
      </Dialog>
    </div>
  );
};

export default CoverageDetailedView;
