import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import InputTextField from "../../component/inputText";
import SvgBlueArrow from "../../../assets/agentIcon/SvgBlueArrow";
import endorsementService from "../../../services/endorsementService";
import s3Service from "../../../services/s3Service";

const EndorsementDetailedView = ({ action }) => {
  const { t } = useTranslation();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [endorsementData, setEndorsementData] = useState(
    state?.endorsementData || null
  );
  const [loading, setLoading] = useState(!state?.endorsementData);
  const [documentLoading, setDocumentLoading] = useState(false);

  // Check if this is a cancellation endorsement
  const endorsementStatus = endorsementData?.status;
  const endorsementTypeIds = endorsementData?.endorsementTypeIds || [];
  const isCancelled = 
    endorsementStatus === "Cancelled" ||
    endorsementStatus === "InitiateCancel" ||
    endorsementTypeIds.includes(5) ||
    endorsementData?.isCancelPolicy === true;

  // Fetch endorsement data if not in state
  useEffect(() => {
    if (!endorsementData && endorsementId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const response = await endorsementService.getEndorsementById(
            endorsementId
          );
          if (response.success) {
            setEndorsementData(response.data);
          } else {
            alert(t("endorsement.failedToLoadEndorsement") + " " + (response.error || ""));
          }
        } catch (error) {
          console.error("Error fetching endorsement:", error);
          alert(t("endorsement.errorLoadingEndorsement"));
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [endorsementId, endorsementData]);

  const handleCommonAction = () => {
    if (state?.clientId) {
      navigate(`/agent/clientview/${state.clientId}`);
    } else {
      navigate(-1);
    }
  };

  const handleclickNavigation = () => {
    navigate(`/agent/endorsement/paymentconfirmation/${endorsementId}`, {
      state: {
        endorsementId,
        policyId: endorsementData?.policyId || state?.policyId,
        clientId: state?.clientId,
        clientNumber: state?.clientNumber,
        clientName: state?.clientName,
        endorsementData,
        fromEndorsementDetail: true, // Flag for auto-payment flow
      },
    });
  };

  const handleEndorsement = async () => {
    try {
      const documentUrl =
        endorsementData?.documentKey || endorsementData?.documentUrl;

      if (!documentUrl) {
        alert(t("endorsement.documentNotAvailable"));
        return;
      }

      setDocumentLoading(true);

      // Check if it's an S3 URL that needs presigned URL
      let downloadUrl = documentUrl;
      if (
        documentUrl.includes("s3.") ||
        documentUrl.includes("amazonaws.com")
      ) {
        console.log("Fetching presigned URL for S3 document:", documentUrl);

        // Get presigned URL using the batch endpoint
        const urlMap = await s3Service.getPresignedDownloadUrls([documentUrl]);

        if (urlMap.success && urlMap.data[documentUrl]) {
          downloadUrl = urlMap.data[documentUrl];
          console.log("Presigned URL obtained successfully");
        } else {
          console.error("Failed to get presigned URL:", urlMap);
          throw new Error(urlMap.error || "Failed to generate download URL");
        }
      }

      console.log("Opening document in new tab:", downloadUrl);

      // Open in new tab
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      alert(t("endorsement.errorLoadingDocument"));
    } finally {
      setDocumentLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="detailed__endorsement__container m-0">
        <Card className="mt-4">
          <div className="p-4 text-center">{t("endorsement.loadingEndorsementDetails")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="detailed__endorsement__container m-0">
      <div className="detailed__endorsement__container__title">{t("endorsement.clients")}</div>
      <div className="mt-3">
        <div
          onClick={handleCommonAction}
          className="detailed__endorsement__container__back__btn__container cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="detailed__endorsement__container__back__btn__title">
            {state?.clientName || t("endorsement.client")} / {t("endorsement.clientIdColon")}{" "}
            {state?.clientNumber || endorsementId}
          </div>
        </div>
      </div>
      <div className="detailed__endorsement__card__container mt-4">
        <Card className="card__container">
          <div className="detailed__endorsement__card__container__title">
            {t("endorsement.endorsementTitle")}
          </div>
          {action === "completed" && (
            <div className="detailed__endorsement__card__sub__title mt-2 mb-2">
              {t("endorsement.personalDetailsChange")}
            </div>
          )}

          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.policyNumber")}
                value={endorsementData?.policyNumber || "N/A"}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.endorsementNumber")}
                value={endorsementData?.endorsementNumber || "N/A"}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.production")}
                value={formatDate(
                  endorsementData?.completionDetails?.productionDate
                )}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.inception")}
                value={formatDate(
                  endorsementData?.completionDetails?.inceptionDate
                )}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.issuedDate")}
                value={formatDate(
                  endorsementData?.completionDetails?.issuedDate
                )}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.expiry")}
                value={formatDate(
                  endorsementData?.completionDetails?.expiryDate
                )}
                disabled={true}
              />
            </div>
          </div>

          <div className="detailed__endorsement__card__sub__title mt-2 mb-2">
            {t("endorsement.document")}
          </div>

          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <div
                onClick={() => !documentLoading && handleEndorsement()}
                className={`endorsement__detail__view__box ${
                  documentLoading ? "opacity-50" : ""
                }`}
                style={{ pointerEvents: documentLoading ? "none" : "auto" }}
              >
                <div className="endorsement__detail__view__box__title">
                  {t("endorsement.endorsementSlip")}
                </div>

                <div className="endorsement__detail__view__box__container cursor-pointer">
                  <div className="endorsement__detail__view__box__sub__title">
                    {documentLoading ? t("endorsement.loading") : t("endorsement.view")}
                  </div>
                  {!documentLoading && <SvgBlueArrow />}
                </div>
              </div>
            </div>
          </div>
          <div className="grid m-0 mt-3">
            <div className="col-12 md:col-12 lg:col-12 p-0 back__complete__btn__container ">
              <div className="complete__btn__container">
                {isCancelled ? (
                  <Button
                    className="complete__btn"
                    onClick={() => {
                      handleclickNavigation();
                    }}
                  >
                    {t("endorsement.refundInitiate")}
                  </Button>
                ) : (
                  <Button
                    className="complete__btn"
                    onClick={() => {
                      handleclickNavigation();
                    }}
                  >
                    {t("endorsement.proceedToPayment")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EndorsementDetailedView;
