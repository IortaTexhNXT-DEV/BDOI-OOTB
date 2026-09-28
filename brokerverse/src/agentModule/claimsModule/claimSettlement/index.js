import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import NavBar from "../../../components/NavBar";
import { Card } from "primereact/card";
import DropdownField from "../../component/DropdwonField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import SvgBlueArrow from "../../../assets/agentIcon/SvgBlueArrow";
import "./index.scss";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { getClaimDetails } from "../adjusterSubmission/store/adjusterSubmissionMiddleWare";
import claimsService from "../../../services/claimsService";

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
    policyNumber: reduxPolicyNumber,
    claimNumber: reduxClaimNumber,
    clientDetails: reduxClientDetails,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
    clientId: claimDetailsMainReducers?.clientId || "",
    clientDetails: claimDetailsMainReducers?.claimDetails || "",
  }));

  // Try to get policy holder name from Redux first, then claim details, then fallback
  const policyHolderName =
    reduxPolicyHolderName ||
    claimDetails?.data?.policy?.policyHolderName ||
    claimDetails?.data?.policy?.PolicyHolderName ||
    t("agent.loading");

  const claimNumber =
    reduxClaimNumber ||
    claimDetails?.data?.claimNumber ||
    claimDetails?.data?.claim_number ||
    t("agent.loading");

  // Fetch claim details on component mount
  useEffect(() => {
    if (claimId) {
      console.log("=== DISPATCHING GET CLAIM DETAILS ===");
      console.log("Dispatching getClaimDetails with ID:", claimId);
      dispatch(getClaimDetails(claimId));
      console.log("=== END DISPATCHING GET CLAIM DETAILS ===");
    }
  }, [dispatch, claimId]);

  console.log(claimDetails, "endrosementViewData");
  const handleNavigation = () => {
    navigate(`/agent/clientview/${claimDetails?.data?.policy?.clientId}`);
  };

  const handleList = () => {
    navigate(`/agent/clientview/${claimDetails?.data?.policy?.clientId}`);
  };
  const handleAcknowledgmentsubmit = async () => {
    if (!claimId) {
      console.error("No claim ID available for document download");
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
        console.log("Document downloaded successfully:", result.data);

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
        console.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, acknowledgment: false }));
    }
  };

  const handleClaimsDischargeVouchersubmit = async () => {
    if (!claimId) {
      console.error("No claim ID available for document download");
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
        console.log("Document downloaded successfully:", result.data);

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
        console.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, dischargeVoucher: false }));
    }
  };

  const handleClaimsDatasheetubmit = async () => {
    if (!claimId) {
      console.error("No claim ID available for document download");
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
        console.log("Document downloaded successfully:", result.data);

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
        console.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      // You can add error handling here
    } finally {
      // Clear loading state
      setDownloadLoading((prev) => ({ ...prev, dataSheet: false }));
    }
  };

  const handleFIRSubmit = async () => {
    if (!claimId) {
      console.error("No claim ID available for document download");
      return;
    }

    // Set loading state
    setDownloadLoading((prev) => ({ ...prev, fir: true }));

    console.log("=== DOWNLOADING FIR DOCUMENT ===");
    console.log("Claim ID:", claimId);
    console.log("Document Name: FIR");
    console.log("=== END DOWNLOADING FIR DOCUMENT ===");

    try {
      const result = await claimsService.getClaimDocuments(claimId, "FIR");

      if (result.success) {
        console.log("Document downloaded successfully:", result.data);

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
        console.error("Failed to download document:", result.error);
        // You can add error handling here, like showing a toast
      }
    } catch (error) {
      console.error("Error downloading document:", error);
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
                claimDetails?.data?.reportedDate
                  ? new Date(
                      claimDetails.data.reportedDate
                    ).toLocaleDateString()
                  : ""
              }
              label={t("claimSettlementDetail.dateReported")}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              value={
                claimDetails?.data?.dateOfIncident
                  ? new Date(
                      claimDetails.data.dateOfIncident
                    ).toLocaleDateString()
                  : ""
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
        {/* <div className="listing__button mt-3">
          <Button onClick={handleList}>Go to listing</Button>
        </div> */}
      </Card>
    </div>
  );
};

export default ClaimSettlement;
