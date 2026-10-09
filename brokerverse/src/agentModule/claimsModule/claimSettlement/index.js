import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import { getClaimDetails } from "../adjusterSubmission/store/adjusterSubmissionMiddleWare";
import claimsService from "../../../services/claimsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import { stepForStatus } from "../shared/claimJourney";
import SettlementCash from "./SettlementCash";

/** Claim documents printed from the claim (claimsService.getClaimDocuments), with their translation key. */
const DOCUMENTS = [
  ["Claims Acknowledgement Letter", "acknowledgmentLetter"],
  ["Claims Discharge Voucher", "claimsDischargeVoucher"],
  ["Claims Data Sheet", "claimsDataSheet"],
  ["FIR", "fir"],
];

/**
 * Settlement and payment of a claim: the settlement recorded and approved, the claim documents to print (acknowledgement
 * letter, discharge voucher, data sheet, police report) and, for a settlement paid through the broker, the money
 * received from the insurers and paid to the claimant.
 */
const ClaimSettlement = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useRef(null);
  const claimId = params.id || location.state?.claimId || location.state?.id;
  const [downloading, setDownloading] = useState(null);
  const [cash, setCash] = useState(null);

  const { claimDetails, claimDetailsError } = useSelector(({ adjusterSubmissionReducers }) => ({
    claimDetails: adjusterSubmissionReducers?.claimDetails || {},
    claimDetailsError: adjusterSubmissionReducers?.claimDetailsError || "",
  }));
  // the claim of this page only (the store may still hold a claim opened earlier)
  const claim = [claimDetails?.data?.id, claimDetails?.data?.claimId, claimDetails?.data?.claimNumber].includes(claimId) ? claimDetails.data : null;

  useEffect(() => {
    if (claimId) dispatch(getClaimDetails(claimId));
  }, [dispatch, claimId]);

  const download = async (name) => {
    setDownloading(name);
    try {
      const result = await claimsService.getClaimDocuments(claimId, name);
      if (!result.success) throw new Error(result.error);
      const link = document.createElement("a");
      link.href = result.data.url;
      link.download = `${result.data.documentName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(result.data.url);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("claimFlow.documentFailed"), detail: e?.message, life: 5000 });
    } finally {
      setDownloading(null);
    }
  };

  const status = claim?.lifecycleStatus;
  const step = status ? stepForStatus(status) : "payment";
  const settlement = claim ? [
    [t("claimJourney.settlementType"), claim.settlementType],
    [t("claimJourney.settlementAmount"), claim.settlementAmount ? formatCurrency(claim.settlementAmount) : null],
    [t("claimJourney.issueDate"), claim.settlementIssueDate ? formatDate(claim.settlementIssueDate) : null],
    [t("claimJourney.settleDate"), claim.settlementDate ? formatDate(claim.settlementDate) : null],
    [t("claimFlow.submittedBy"), claim.settlementRequestedBy],
    [t("claimFlow.approvedBy"), claim.settlementApprovedBy ? `${claim.settlementApprovedBy}${claim.settlementApprovedAt ? ` · ${formatDate(claim.settlementApprovedAt)}` : ""}` : null],
    [t("claimFlow.settledAmount"), claim.settledAmount ? formatCurrency(claim.settledAmount) : null],
    claim.rejectedReason ? [t("claimJourney.rejectReason"), claim.rejectedReason] : null,
  ].filter(Boolean) : [];

  const outstanding = cash?.paidThroughBroker ? cash.insurers.reduce((sum, i) => sum + i.outstanding, 0) : 0;
  let next = null;
  if (claim && cash?.paidThroughBroker && outstanding > 0) next = t("claimFlow.next.fundsDue", { amount: formatCurrency(outstanding) });
  else if (claim && cash?.paidThroughBroker && cash.payableToClaimant > 0) next = t("claimFlow.next.payClaimant", { amount: formatCurrency(cash.payableToClaimant) });
  else if (claim && ["approved", "pending-approval"].includes(status)) next = t("claimFlow.next.toSettle", { status: claim.claimStatus });
  else if (claim) next = t("claimFlow.next.done", { status: claim.claimStatus });

  return (
    <ClaimJourneyLayout
      claim={claim}
      step={["payment", "approval"].includes(step) ? step : "payment"}
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={t("claimFlow.paymentTitle")}
      actions={claim ? <Button type="button" icon="pi pi-history" outlined label={t("claimFlow.history")} onClick={() => navigate(`/agent/claimaudittrail/${claim.id}`)} /> : null}
    >
      <Toast ref={toast} />
      {!claim && !claimDetailsError && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {claimDetailsError && !claim && <FormErrorSummary serverError={claimDetailsError} />}
      {claim && (
        <>
          <ClaimSection title={t("claimJourney.settlementSection")}>
            {claim.settlementType || claim.settlementAmount ? (
              <dl className="claim-journey__facts">
                {settlement.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="claim-journey__hint">{t("claimFlow.noSettlement")}</p>}
          </ClaimSection>
          <ClaimSection title={t("claimSettlementDetail.documents")}>
            <DataTable value={DOCUMENTS.map(([name, key]) => ({ name, key }))} dataKey="name" size="small">
              <Column header={t("claimFlow.document")} body={(d) => t(`claimSettlementDetail.${d.key}`)} />
              <Column header={t("claimFlow.actions")} className="bv-actions" headerClassName="bv-actions" body={(d) => (
                <Button type="button" icon="pi pi-download" text rounded aria-label={t("claimFlow.download")} tooltip={t("claimFlow.download")}
                  tooltipOptions={{ position: "top" }} loading={downloading === d.name} disabled={!!downloading} onClick={() => download(d.name)} />
              )} />
            </DataTable>
          </ClaimSection>
          <SettlementCash claimId={claim.id || claimId} onPosition={setCash} />
        </>
      )}
      <ClaimActions next={next} tone={next && !outstanding && !(cash?.payableToClaimant > 0) && ["settled", "closed"].includes(status) ? "success" : "info"}>
        <Button type="button" label={t("claimFlow.viewClaim")} icon="pi pi-eye" outlined onClick={() => navigate(`/agent/claimdetail/${claim?.id || claimId}`)} disabled={!claim} />
      </ClaimActions>
    </ClaimJourneyLayout>
  );
};

export default ClaimSettlement;
