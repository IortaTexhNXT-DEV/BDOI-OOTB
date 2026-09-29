import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import InputTextField from "../../component/inputText";
import SvgBlueArrow from "../../../assets/agentIcon/SvgBlueArrow";
import "./index.scss";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import useClaimHeader from "../useClaimHeader";
import { useSelector, useDispatch } from "react-redux";
import { ProgressSpinner } from "primereact/progressspinner";
import { getClaimDetails } from "../adjusterSubmission/store/adjusterSubmissionMiddleWare";
import claimsService from "../../../services/claimsService";
import SettlementCash from "./SettlementCash";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";

const ClaimSettlement = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get claim ID from URL params or navigation state
  const claimId = params.id || location.state?.claimId || location.state?.id;

  // Loading states for download buttons
  const [downloadLoading, setDownloadLoading] = useState({
    acknowledgment: false,
    dischargeVoucher: false,
    dataSheet: false,
    fir: false,
  });

  // Redux state for claim details
  const { claimDetails, claimDetailsLoading, claimDetailsError } = useSelector(
    ({ adjusterSubmissionReducers }) => ({
      claimDetails: adjusterSubmissionReducers?.claimDetails || {},
      claimDetailsLoading:
        adjusterSubmissionReducers?.claimDetailsLoading || false,
      claimDetailsError: adjusterSubmissionReducers?.claimDetailsError || "",
    })
  );

  // Get policy holder data from Redux
  const {
    policyHolderName: reduxPolicyHolderName,
    claimNumber: reduxClaimNumber,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
  }));

  // Try to get policy holder name from Redux first, then claim details, then fallback
  const header = useClaimHeader(claimId);
  const policyHolderName =
    header.policyHolderName ||
    reduxPolicyHolderName ||
    claimDetails?.data?.policy?.policyHolderName ||
    claimDetails?.data?.policy?.PolicyHolderName ||
    t("agent.loading");

  const claimNumber =
    header.claimNumber ||
    reduxClaimNumber ||
    claimDetails?.data?.claimNumber ||
    claimDetails?.data?.claim_number ||
    t("agent.loading");

  // Fetch claim details on component mount
  useEffect(() => {
    if (claimId) {
      dispatch(getClaimDetails(claimId));
    }
  }, [dispatch, claimId]);

  const handleNavigation = () => {
    navigate(`/agent/clientview/${claimDetails?.data?.policy?.clientId}`);
  };

  const handleAcknowledgmentsubmit = async () => {
    if (!claimId) {
      logger.error("No claim ID available for document download");
      return;
    }

    // Set loading state
    setDownloadLoading((prev) => ({ ...prev, acknowledgment: true }));

    try {
      const result = await claimsService.getClaimDocuments(
        claimId,
        "Claims Acknowledgement Letter"
      );

      if (result.success) {
        // Create download link
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = `${result.data.documentName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(result.data.url);
      } else {
        logger.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      logger.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, acknowledgment: false }));
    }
  };

  const handleClaimsDischargeVouchersubmit = async () => {
    if (!claimId) {
      logger.error("No claim ID available for document download");
      return;
    }

    // Set loading state
    setDownloadLoading((prev) => ({ ...prev, dischargeVoucher: true }));

    try {
      const result = await claimsService.getClaimDocuments(
        claimId,
        "Claims Discharge Voucher"
      );

      if (result.success) {
        // Create download link
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = `${result.data.documentName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(result.data.url);
      } else {
        logger.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      logger.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, dischargeVoucher: false }));
    }
  };

  const handleClaimsDatasheetubmit = async () => {
    if (!claimId) {
      logger.error("No claim ID available for document download");
      return;
    }

    // Set loading state
    setDownloadLoading((prev) => ({ ...prev, dataSheet: true }));

    try {
      const result = await claimsService.getClaimDocuments(
        claimId,
        "Claims Data Sheet"
      );

      if (result.success) {
        // Create download link
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = `${result.data.documentName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(result.data.url);
      } else {
        logger.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      logger.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, dataSheet: false }));
    }
  };

  const handleFIRSubmit = async () => {
    if (!claimId) {
      logger.error("No claim ID available for document download");
      return;
    }

    // Set loading state
    setDownloadLoading((prev) => ({ ...prev, fir: true }));

    try {
      const result = await claimsService.getClaimDocuments(claimId, "FIR");

      if (result.success) {
        // Create download link
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = `${result.data.documentName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(result.data.url);
      } else {
        logger.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      logger.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, fir: false }));
    }
  };

  // Show loading state
  if (claimDetailsLoading) {
    return (
      <div className="claim__detailssettlemenet__container">
        <div className="claim__details__container__titles">{t("claimSettlementDetail.clients")}</div>
        <div 
          className="claim__details__container__back__btn mt-3 cursor-pointer"
          onClick={handleNavigation}
        >
          <SvgLeftArrow />
          <div className="claim__details__container__back__btn__title">
            {policyHolderName} / {claimNumber ? t("claimSettlementDetail.claimLabel", { claimNumber }) : t("claimSettlementDetail.loadingClaimDetails")}
          </div>
        </div>
        <Card>
          <div className="claim__title">{t("claimSettlementDetail.claimSettlement")}</div>
          <div className="text-center p-4">
            <div>{t("claimSettlementDetail.loadingClaimDetails")}</div>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state
  if (claimDetailsError) {
    return (
      <div className="claim__detailssettlemenet__container">
        <div className="claim__details__container__titles">{t("claimSettlementDetail.clients")}</div>
        <div 
          className="claim__details__container__back__btn mt-3 cursor-pointer"
          onClick={handleNavigation}
        >
          <SvgLeftArrow />
          <div className="claim__details__container__back__btn__title">
            {policyHolderName} / {claimNumber ? t("claimSettlementDetail.claimLabel", { claimNumber }) : t("claimSettlementDetail.loadingClaimDetails")}
          </div>
        </div>
        <Card>
          <div className="claim__title">{t("claimSettlementDetail.claimSettlement")}</div>
          <div className="text-center p-4" style={{ color: "red" }}>
            <div>{t("claimSettlementDetail.errorLoadingClaimDetails", { error: claimDetailsError })}</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="claim__detailssettlemenet__container ">
      <div>
        <div className="claim__details__container__titles">{t("claimSettlementDetail.clients")}</div>
        <div
          onClick={handleNavigation}
          className="claim__details__container__back__btn mt-3 cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="claim__details__container__back__btn__title">
            {policyHolderName} / {claimNumber ? t("claimSettlementDetail.claimLabel", { claimNumber }) : t("claimSettlementDetail.loadingClaimDetails")}
          </div>
        </div>
      </div>
      <Card>
        <div className="claim__title">{t("claimSettlementDetail.claimSettlement")}</div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              value={claimDetails?.data?.policy?.policyNumber || ""}
              label={t("claimSettlementDetail.policyNumber")}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              value={claimDetails?.data?.claimNumber || ""}
              label={t("claimSettlementDetail.claimNumber")}
              disabled={true}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              value={
                formatAppDate(claimDetails?.data?.reportedDate, { empty: "" })
              }
              label={t("claimSettlementDetail.dateReported")}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              value={
                formatAppDate(claimDetails?.data?.dateOfIncident, { empty: "" })
              }
              label={t("claimSettlementDetail.dateOfLoss")}
              disabled={true}
            />
          </div>
        </div>
        <div className="claim__doc__title mt-2">{t("claimSettlementDetail.documents")}</div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() =>
                !downloadLoading.acknowledgment && handleAcknowledgmentsubmit()
              }
              className={`policy__detail__view__box ${
                downloadLoading.acknowledgment ? "loading" : ""
              }`}
              style={{
                opacity: downloadLoading.acknowledgment ? 0.7 : 1,
                pointerEvents: downloadLoading.acknowledgment ? "none" : "auto",
              }}
            >
              <div className="policy__detail__view__box__title">
                {t("claimSettlementDetail.acknowledgmentLetter")}
              </div>
              <div className="policy__detail__view__box__container cursor-pointer">
                <div className="policy__detail__view__box__sub__title">
                  {downloadLoading.acknowledgment ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ProgressSpinner
                        style={{ width: "16px", height: "16px" }}
                      />
                      {t("claimSettlementDetail.downloading")}
                    </div>
                  ) : (
                    t("claimSettlementDetail.view")
                  )}
                </div>
                {!downloadLoading.acknowledgment && <SvgBlueArrow />}
              </div>
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() =>
                !downloadLoading.dischargeVoucher &&
                handleClaimsDischargeVouchersubmit()
              }
              className={`policy__detail__view__box ${
                downloadLoading.dischargeVoucher ? "loading" : ""
              }`}
              style={{
                opacity: downloadLoading.dischargeVoucher ? 0.7 : 1,
                pointerEvents: downloadLoading.dischargeVoucher
                  ? "none"
                  : "auto",
              }}
            >
              <div className="policy__detail__view__box__title">
                {t("claimSettlementDetail.claimsDischargeVoucher")}
              </div>
              <div className="policy__detail__view__box__container cursor-pointer">
                <div className="policy__detail__view__box__sub__title">
                  {downloadLoading.dischargeVoucher ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ProgressSpinner
                        style={{ width: "16px", height: "16px" }}
                      />
                      {t("claimSettlementDetail.downloading")}
                    </div>
                  ) : (
                    t("claimSettlementDetail.view")
                  )}
                </div>
                {!downloadLoading.dischargeVoucher && <SvgBlueArrow />}
              </div>
            </div>
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() =>
                !downloadLoading.dataSheet && handleClaimsDatasheetubmit()
              }
              className={`policy__detail__view__box ${
                downloadLoading.dataSheet ? "loading" : ""
              }`}
              style={{
                opacity: downloadLoading.dataSheet ? 0.7 : 1,
                pointerEvents: downloadLoading.dataSheet ? "none" : "auto",
              }}
            >
              <div className="policy__detail__view__box__title">
                {t("claimSettlementDetail.claimsDataSheet")}
              </div>

              <div className="policy__detail__view__box__container cursor-pointer">
                <div className="policy__detail__view__box__sub__title">
                  {downloadLoading.dataSheet ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ProgressSpinner
                        style={{ width: "16px", height: "16px" }}
                      />
                      {t("claimSettlementDetail.downloading")}
                    </div>
                  ) : (
                    t("claimSettlementDetail.view")
                  )}
                </div>
                {!downloadLoading.dataSheet && <SvgBlueArrow />}
              </div>
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <div
              onClick={() => !downloadLoading.fir && handleFIRSubmit()}
              className={`policy__detail__view__box ${
                downloadLoading.fir ? "loading" : ""
              }`}
              style={{
                opacity: downloadLoading.fir ? 0.7 : 1,
                pointerEvents: downloadLoading.fir ? "none" : "auto",
              }}
            >
              <div className="policy__detail__view__box__title">{t("claimSettlementDetail.fir")}</div>
              <div className="policy__detail__view__box__container cursor-pointer">
                <div className="policy__detail__view__box__sub__title">
                  {downloadLoading.fir ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ProgressSpinner
                        style={{ width: "16px", height: "16px" }}
                      />
                      {t("claimSettlementDetail.downloading")}
                    </div>
                  ) : (
                    t("claimSettlementDetail.view")
                  )}
                </div>
                {!downloadLoading.fir && <SvgBlueArrow />}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <SettlementCash claimId={claimDetails?.data?.id || claimId} />
    </div>
  );
};

export default ClaimSettlement;
