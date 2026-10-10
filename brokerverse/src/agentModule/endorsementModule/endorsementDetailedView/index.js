import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import SvgBlueArrow from "../../../assets/agentIcon/SvgBlueArrow";
import endorsementService from "../../../services/endorsementService";
import s3Service from "../../../services/s3Service";
import { notifyError } from "../../../utility/dialogs";
import { FieldsSkeleton } from "../../../components/Skeletons";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { printPdf } from "../../../components/Print";
import { statusLabel } from "../../../utils/statusSeverity";

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

  // Payment is due only for additional premium. No change: nothing to pay. A return premium (negative change on
  // a non-cancellation endorsement) is refunded by finance through a client refund payment voucher, not collected here.
  const premiumDelta = Number(endorsementData?.premiumDelta ?? endorsementData?.summary?.premiumDelta ?? 0) || 0;
  const paymentDue = !isCancelled && premiumDelta > 0;
  // a return premium is refunded once the cancellation is done, not while it is a draft or with the insurer
  const refundable = isCancelled && ["Completed", "Approved", "Issued", "Cancelled"].includes(endorsementStatus);
  const hasDocument = Boolean(endorsementData?.documentKey || endorsementData?.documentUrl);
  const completion = endorsementData?.completionDetails || {};
  const typeCode = endorsementData?.endorsementType;
  const typeLabel = typeCode ? t(`endorsement.types.${typeCode}`, { defaultValue: statusLabel(typeCode) }) : null;
  // the reason as named in the Cancellation Reasons master, not its code
  const reasonName = endorsementData?.returnCalculation?.reason?.name || endorsementData?.cancellationReasonName || endorsementData?.cancellationReason;

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
            notifyError(t("endorsement.failedToLoadEndorsement") + " " + (response.error || ""));
          }
        } catch (error) {
          notifyError(t("endorsement.errorLoadingEndorsement"));
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
        fromEndorsementDetail: true,
      },
    });
  };

  const handleEndorsement = async () => {
    try {
      const documentUrl =
        endorsementData?.documentKey || endorsementData?.documentUrl;

      if (!documentUrl) {
        notifyError(t("endorsement.documentNotAvailable"));
        return;
      }

      setDocumentLoading(true);

      // Check if it's an S3 URL that needs presigned URL
      let downloadUrl = documentUrl;
      if (
        documentUrl.includes("s3.") ||
        documentUrl.includes("amazonaws.com")
      ) {
        // Get presigned URL using the batch endpoint
        const urlMap = await s3Service.getPresignedDownloadUrls([documentUrl]);

        if (urlMap.success && urlMap.data[documentUrl]) {
          downloadUrl = urlMap.data[documentUrl];
        } else {
          throw new Error(urlMap.error || "Failed to generate download URL");
        }
      }

      // Open in new tab
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      notifyError(t("endorsement.errorLoadingDocument"));
    } finally {
      setDocumentLoading(false);
    }
  };

  const printEndorsement = () =>
    printPdf(`/endorsements/${encodeURIComponent(endorsementId)}/pdf`, { fileName: `${endorsementData?.endorsementNumber || "endorsement"}.pdf` })
      .catch((e) => notifyError(e.message || t("endorsement.errorLoadingDocument")));

  const premiumEffect = premiumDelta > 0
    ? t("endorsement.premiumEffect.additional")
    : premiumDelta < 0
      ? t("endorsement.premiumEffect.return")
      : t("endorsement.premiumEffect.none");

  if (loading) {
    return (
      <div className="detailed__endorsement__container m-0">
        <Card className="mt-4">
          <div className="p-4">
            <FieldsSkeleton rows={4} columns={3} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="detailed__endorsement__container m-0">
      <div className="detailed__endorsement__container__title">{t("endorsement.endorsementTitle")}</div>
      <div className="mt-3">
        <div
          onClick={handleCommonAction}
          className="detailed__endorsement__container__back__btn__container cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="detailed__endorsement__container__back__btn__title">
            {state?.clientName || endorsementData?.clientName || t("endorsement.client")}
            {/* the client code (CL-...), never the internal endorsement id */}
            {(state?.clientNumber || endorsementData?.clientCode) && (
              <> / {t("endorsement.clientIdColon")} {state?.clientNumber || endorsementData?.clientCode}</>
            )}
          </div>
        </div>
      </div>
      <div className="detailed__endorsement__card__container mt-4">
        <Card className="card__container">
          <DetailHeader
            title={endorsementData?.endorsementNumber || t("endorsement.endorsementTitle")}
            status={endorsementStatus ? { code: endorsementStatus, label: t(`endorsement.status.${endorsementStatus}`, { defaultValue: endorsementStatus }) } : null}
            subtitle={[endorsementData?.policyNumber, endorsementData?.insuredName || endorsementData?.clientName].filter(Boolean).join(" · ")}
            meta={[
              { label: t("endorsement.effectiveDate"), value: endorsementData?.effectiveDate, type: "date" },
              { label: t("endorsement.premiumChange"), value: isCancelled ? null : premiumDelta, type: "amount", hidden: isCancelled },
            ]}
            actions={<Button className="p-button-outlined" icon="pi pi-print" label={t("endorsement.print", "Print endorsement")} onClick={printEndorsement} />}
          />
          <DetailSection title={t("endorsement.details")}>
            <KeyValueGrid columns={3} items={[
              { label: t("endorsement.policyNumber"), value: endorsementData?.policyNumber },
              { label: t("endorsement.endorsementNumber"), value: endorsementData?.endorsementNumber },
              { label: t("endorsement.endorsementTypeLabel"), value: typeLabel },
              { label: t("endorsement.effectiveDate"), value: endorsementData?.effectiveDate, type: "date" },
              { label: t("endorsement.production"), value: completion.productionDate, type: "date", hidden: !completion.productionDate },
              { label: t("endorsement.inception"), value: completion.inceptionDate || endorsementData?.policyInception, type: "date", hidden: !(completion.inceptionDate || endorsementData?.policyInception) },
              { label: t("endorsement.issuedDate"), value: completion.issuedDate, type: "date", hidden: !completion.issuedDate },
              { label: t("endorsement.expiry"), value: completion.expiryDate || endorsementData?.policyExpiry, type: "date", hidden: !(completion.expiryDate || endorsementData?.policyExpiry) },
              { label: t("endorsement.premiumChange"), value: premiumDelta, type: "amount", hidden: isCancelled },
              { label: t("endorsement.premiumEffectLabel"), value: <span data-testid="endorsement-premium-note">{premiumEffect}</span>, hidden: isCancelled },
              { label: t("endorsement.cancellationReasonLabel"), value: reasonName, hidden: !isCancelled },
              { label: t("endorsement.returnPremium"), value: Math.abs(premiumDelta), type: "amount", hidden: !isCancelled || !premiumDelta },
              { label: t("endorsement.remarksLabel"), value: endorsementData?.remarks, span: "full", hidden: !endorsementData?.remarks },
            ]} />
          </DetailSection>

          {hasDocument && (
          <>
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
          </>
          )}
          <DetailSection title={t("endorsement.history")} className="mt-3">
            <RecordActivityLog entity="endorsement" recordId={endorsementData?.endorsementId || endorsementId} />
          </DetailSection>

          <div className="grid m-0 mt-3">
            <div className="col-12 md:col-12 lg:col-12 p-0 back__complete__btn__container ">
              <div className="complete__btn__container">
                {refundable ? (
                  <Button
                    className="complete__btn"
                    onClick={() => {
                      handleclickNavigation();
                    }}
                  >
                    {t("endorsement.refundInitiate")}
                  </Button>
                ) : paymentDue ? (
                  <Button
                    className="complete__btn"
                    onClick={() => {
                      handleclickNavigation();
                    }}
                  >
                    {t("endorsement.proceedToPayment")}
                  </Button>
                ) : (
                  <Button className="complete__btn" onClick={handleCommonAction}>
                    {t("endorsement.done")}
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
