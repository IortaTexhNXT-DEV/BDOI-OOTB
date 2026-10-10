import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import opsService from "../../../services/opsAccountingService";
import { getClaimDetails } from "../../claimsModule/adjusterSubmission/store/adjusterSubmissionMiddleWare";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../../claimsModule/shared/ClaimJourneyLayout";
import ClaimDocumentChecklist, { useClaimChecklist } from "../../claimsModule/shared/ClaimDocumentChecklist";
import FormErrorSummary from "../../claimsModule/shared/FormErrorSummary";
import useClaimsConfig from "../../claimsModule/shared/useClaimsConfig";
import { CONTINUE_ROUTE, claimLobOf, lobUses, stepForStatus } from "../../claimsModule/shared/claimJourney";
import { formatDate, toIsoDate } from "../../../utility/dateFormat";
import { hasPermission } from "../../../utils/canOpen";
import { StatusChip } from "../../../components/RecordPage";
import { openConfirm } from "../../../components/ConfirmDialog";
import claimHandlingService from "../../../services/claimHandlingService";
import InsurerAdvice from "./InsurerAdvice";
import ClaimCommunications from "./ClaimCommunications";
import ClaimSettlements from "./ClaimSettlements";
import "./index.scss";

/** Label / value list of a claim section; empty values show a dash. */
const Facts = ({ rows }) => (
  <dl className="claim-journey__facts">
    {rows.filter(Boolean).map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * Operations > Claims > claim: the whole claim on one page, under the claim header, the journey steps and the key
 * facts: the loss, the policy and insured, the driver and the third party (motor), the adjuster, the insurer's advice,
 * the settlements, each co-insurer's share, the communication log and the claim's documents, with the next step at the
 * foot. Sections that do not apply to the claim's line of business (claims.lob_fields) are left out. A claim registered
 * in error is cancelled with a coded reason (approve:claims); the death on a death claim is verified (write:claims).
 */
const ClaimDetail = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { claimId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const config = useClaimsConfig();
  const toast = useRef(null);

  const { claimDetails, error } = useSelector(({ adjusterSubmissionReducers }) => ({
    claimDetails: adjusterSubmissionReducers?.claimDetails || {},
    error: adjusterSubmissionReducers?.claimDetailsError || null,
  }));

  useEffect(() => {
    if (claimId) dispatch(getClaimDetails(claimId));
  }, [dispatch, claimId]);

  const loaded = claimDetails?.data || null;
  const claim = loaded && [loaded.id, loaded.claimId, loaded.claimNumber].includes(claimId) ? loaded : null;
  const lob = claim ? claimLobOf(claim.lob, claim.policy?.lob, claim.productType) : "";
  const usesDriver = lobUses(config, lob, "driver");
  const usesVehicle = lobUses(config, lob, "vehicle");
  const step = claim ? stepForStatus(claim.lifecycleStatus, claim) : "notification";
  const next = claim ? CONTINUE_ROUTE[step] : null;
  const docs = useClaimChecklist(claim?.id);
  const notify = (severity, detail) => toast.current?.show({ severity, summary: claim?.claimNumber || t("claimDocs.title"), detail, life: severity === "error" ? 6000 : 3000 });
  const missing = docs.list?.summary?.missingRequired || 0;
  const remind = async () => {
    try {
      const r = await opsService.remindClaimant(claim.id);
      notify("success", t("claimDocs.reminded", { to: r.to }));
      docs.reload();
    } catch (e) {
      notify("error", e.message);
    }
  };
  const terminal = claim && ["settled", "closed", "rejected", "cancelled"].includes(claim.lifecycleStatus);
  const canWrite = hasPermission("write:claims");
  const canDecide = hasPermission("approve:claims");
  const reload = () => dispatch(getClaimDetails(claim.id));
  const cancelClaim = () => openConfirm({
    title: t("claimHandling.cancelClaim"), severity: "danger", message: t("claimHandling.cancelMessage"),
    facts: [{ label: t("claimJourney.claimNumber"), value: claim.claimNumber }, { label: t("claimJourney.policyNumber"), value: claim.policyNumber },
      { label: t("claimJourney.dateOfLoss"), value: claim.dateOfIncident, type: "date" }],
    reason: { context: "claim_cancel" }, confirmLabel: t("claimHandling.cancelConfirm"),
    onConfirm: async (reason) => {
      await claimHandlingService.cancel(claim.id, reason);
      notify("success", t("claimHandling.cancelled"));
      reload();
    },
  });
  const verifyDeath = () => openConfirm({
    title: t("claimHandling.verifyDeath"), message: t("claimHandling.verifyMessage"),
    facts: [{ label: t("claimJourney.claimNumber"), value: claim.claimNumber }, { label: t("claimJourney.dateOfLoss"), value: claim.dateOfIncident, type: "date" }],
    input: { type: "date", label: t("claimHandling.verifiedOn"), required: true, defaultValue: toIsoDate(new Date()), maxDate: new Date() },
    confirmLabel: t("claimHandling.verifyConfirm"),
    onConfirm: async (on) => {
      await claimHandlingService.verifyDeath(claim.id, on);
      notify("success", t("claimHandling.deathVerified"));
      reload();
    },
  });
  const paid = claim && ["settled", "closed", "approved", "partially-settled"].includes(claim.lifecycleStatus);
  let nextText = null;
  let tone = "info";
  if (claim && step === "documents" && docs.list) {
    nextText = missing ? t("claimDocs.next.missing", { count: missing }) : t("claimDocs.next.ready");
    tone = missing ? "warning" : "success";
  } else if (claim && next) nextText = t("claimFlow.next.continueAt", { step: t(`claimJourney.steps.${step}`) });
  else if (claim && paid && !terminal) nextText = t("claimFlow.next.toSettle", { status: claim.claimStatus });
  else if (claim) {
    nextText = t("claimFlow.next.done", { status: claim.claimStatus });
    if (["settled", "closed"].includes(claim.lifecycleStatus)) tone = "success";
  }
  const tp = claim?.thirdPartyDetails || claim?.thirdPartyWitnessDetails?.[0] || {};
  const policy = claim?.policy || {};
  const insurers = claim?.participatingInsurers || [];
  const address = (...parts) => parts.filter(Boolean).join(", ");

  return (
    <ClaimJourneyLayout
      claim={claim}
      step={step}
      onBack={() => navigate("/agent/claim")}
      title={t("claimFlow.claimDetails")}
      actions={claim ? (
        <>
          <Button type="button" icon="pi pi-history" outlined label={t("claimFlow.history")} onClick={() => navigate(`/agent/claimaudittrail/${claim.id}`)} />
          {canWrite && claim.isDeathClaim && !claim.deathVerifiedOn && !terminal ? (
            <Button type="button" icon="pi pi-verified" outlined label={t("claimHandling.verifyDeath")} onClick={verifyDeath} />
          ) : null}
          {canDecide && ["registered", "in-review"].includes(claim.lifecycleStatus) ? (
            <Button type="button" icon="pi pi-ban" outlined severity="danger" label={t("claimHandling.cancelClaim")} onClick={cancelClaim} />
          ) : null}
        </>
      ) : null}
    >
      <Toast ref={toast} />
      {!claim && !error && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {error && !claim && <FormErrorSummary serverError={String(error)} />}
      {claim && (
        <div className="grid claim-detail">
          <div className="col-12 lg:col-6">
            <ClaimSection title={t("claimFlow.lossSection")}>
              <Facts rows={[
                [t("claimJourney.dateOfLoss"), claim.dateOfIncident ? formatDate(claim.dateOfIncident) : null],
                [t("claimFlow.timeOfLoss"), claim.timeOfIncident],
                [t("claimJourney.causeOfLoss"), claim.typeOfIncident],
                [t("claimFlow.placeOfLoss"), address(claim.addressOfIncident, claim.cityOfIncident, claim.provinceOfIncident)],
                [t("claimJourney.dateReported"), claim.reportedDate ? formatDate(claim.reportedDate) : null],
                [t("claimHandling.source"), claim.fnolSource],
                claim.lateIntimation ? [t("claimHandling.intimation"), <StatusChip key="late" label={t("claimHandling.late")} severity="warning" />] : null,
                claim.lossExtent ? [t("claimHandling.lossExtent"), t(`claimHandling.extent.${claim.lossExtent}`)] : null,
                claim.isDeathClaim ? [t("claimHandling.deathVerified"), claim.deathVerifiedOn ? formatDate(claim.deathVerifiedOn) : t("claimHandling.notVerified")] : null,
                [t("claimHandling.followUpDue"), claim.claimDueDate ? formatDate(claim.claimDueDate) : null],
                [t("claimFlow.priority"), claim.claimPriority],
                [t("claimJourney.estimatedAmount"), claim.estimatedClaimAmount ? formatCurrency(claim.estimatedClaimAmount) : null],
                [t("claimFlow.handler"), claim.handlerName],
              ]} />
            </ClaimSection>
          </div>
          <div className="col-12 lg:col-6">
            <ClaimSection title={t("claimFlow.policySection")}>
              <Facts rows={[
                [t("claimJourney.policyNumber"), claim.policyNumber || policy.policyNumber],
                [t("claimFlow.product"), claim.productType || policy.productType],
                [t("claimFlow.insured"), claim.policyHolderName || policy.insuredName],
                [t("claimFlow.clientCode"), claim.clientCode],
                [t("claimFlow.periodOfCover"), policy.inceptionDate || policy.expiryDate ? `${formatDate(policy.inceptionDate)} - ${formatDate(policy.expiryDate)}` : null],
                [t("claimFlow.holderAddress"), address(claim.houseNo, claim.barangay, claim.city, claim.province)],
              ]} />
            </ClaimSection>
          </div>
          {usesDriver ? (
            <div className="col-12 lg:col-6">
              <ClaimSection title={t("claimJourney.driverSection")}>
                <Facts rows={[
                  [t("claimJourney.driverName"), claim.driverName],
                  [t("claimFlow.holderDrove"), claim.isPolicyHolderTheDriver ? t("claimFlow.yes") : t("claimFlow.no")],
                  [t("claimFlow.driverAddress"), address(claim.driverHouseNo, claim.driverBarangay, claim.driverCity, claim.driverProvince, claim.driverZipCode)],
                ]} />
              </ClaimSection>
            </div>
          ) : null}
          <div className="col-12 lg:col-6">
            <ClaimSection title={usesDriver ? t("claimJourney.thirdParty") : t("claimJourney.thirdPartyWitness")}>
              <Facts rows={[
                [t("claimJourney.name"), tp.thirdPartyName || tp.witnessName],
                [t("claimJourney.contactNumber"), tp.thirdPartyContactNumber || tp.witnessContact],
                usesVehicle ? [t("claimJourney.plateNumber"), tp.thirdPartyPlateNumber] : null,
                usesVehicle ? [t("claimJourney.unit"), tp.thirdPartyUnit] : null,
                usesVehicle ? [t("claimJourney.shop"), tp.thirdPartyShop] : null,
                [t("claimJourney.thirdPartyInsurer"), tp.thirdPartyInsuranceCompanyName],
              ]} />
            </ClaimSection>
          </div>
          <div className="col-12 lg:col-6">
            <ClaimSection title={t("claimJourney.adjusterTitle")}>
              <Facts rows={[
                [t("claimJourney.adjusterName"), claim.adjusterName],
                [t("claimFlow.adjusterStatus"), claim.adjusterStatus],
                [t("claimJourney.insurerClaimNumber"), claim.insuranceCompanyClaimNumber],
              ]} />
            </ClaimSection>
          </div>
          <div className="col-12 lg:col-6">
            <ClaimSection title={t("claimJourney.settlementSection")}>
              <Facts rows={[
                [t("claimJourney.settlementType"), claim.settlementType],
                [t("claimJourney.settlementAmount"), claim.settlementAmount ? formatCurrency(claim.settlementAmount) : null],
                [t("claimJourney.settleDate"), claim.settlementDate ? formatDate(claim.settlementDate) : null],
                [t("claimFlow.approvedBy"), claim.settlementApprovedBy],
                claim.rejectedReason ? [t("claimJourney.rejectReason"), claim.rejectedReason] : null,
                claim.cancelledReason ? [t("claimHandling.cancelReason"), claim.cancelledReason] : null,
              ]} />
            </ClaimSection>
          </div>
          <div className="col-12 lg:col-6">
            <ClaimSection title={t("claimInsurer.title")}>
              <InsurerAdvice claim={claim} statuses={config.insurerAdviceStatuses || []} canEdit={canWrite && !terminal} onSaved={reload} notify={notify} />
            </ClaimSection>
          </div>
          {claim.settlements?.length ? (
            <div className="col-12">
              <ClaimSection title={t("claimSettlements.title")}>
                <ClaimSettlements settlements={claim.settlements} />
              </ClaimSection>
            </div>
          ) : null}
          {insurers.length > 1 ? (
            <div className="col-12">
              <ClaimSection title={t("claimJourney.coInsurance")}>
                <table className="bv-detail-table">
                  <thead>
                    <tr>
                      <th>{t("claimJourney.insurer")}</th>
                      <th>{t("claimJourney.role")}</th>
                      <th className="bv-num">{t("claimJourney.share")}</th>
                      <th className="bv-num">{t("claimJourney.estimatedAmount")}</th>
                      <th className="bv-num">{t("claimJourney.settlementAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insurers.map((p) => {
                      const share = Number(p.sharePercentage) || 0;
                      return (
                        <tr key={p.insurerId}>
                          <td>{p.insuranceCompanyName}</td>
                          <td>{p.isLead ? t("claimJourney.leadInsurer") : t("claimJourney.coInsurer")}</td>
                          <td className="bv-num">{`${share}%`}</td>
                          <td className="bv-num">{formatCurrency(((Number(claim.estimatedClaimAmount) || 0) * share) / 100)}</td>
                          <td className="bv-num">{claim.settlementAmount ? formatCurrency(((Number(claim.settlementAmount) || 0) * share) / 100) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ClaimSection>
            </div>
          ) : null}
          <div className="col-12">
            <ClaimSection title={t("claimComms.title")}>
              <ClaimCommunications claimId={claim.id} parties={config.communicationParties || []} methods={config.communicationMethods} canEdit={canWrite && !terminal} notify={notify} />
            </ClaimSection>
          </div>
          {docs.list ? (
            <div className="col-12">
              <ClaimSection title={t("claimDocs.title")}>
                <ClaimDocumentChecklist claimId={claim.id} list={docs.list} onChanged={docs.reload} notify={notify} readOnly={!!terminal} />
              </ClaimSection>
            </div>
          ) : null}
          <div className="col-12">
            <p className="claim-detail__record">
              {t("claimFlow.recordLine", {
                created: formatDate(claim.createdAt, { withTime: true }), by: claim.reportedByName || "—", updated: formatDate(claim.updatedAt, { withTime: true }),
              })}
            </p>
          </div>
        </div>
      )}
      {claim ? (
        <ClaimActions next={nextText} tone={tone}>
          {paid ? <Button type="button" icon="pi pi-wallet" outlined={!!next} label={t("claimFlow.paymentTitle")} onClick={() => navigate(`/agent/claimdetailedview/${claim.id}`)} /> : null}
          {next ? (
            <Button type="button" icon="pi pi-arrow-right" iconPos="right" label={t("claimFlow.continue", { step: t(`claimJourney.steps.${step}`) })}
              outlined={step === "documents" && missing > 0}
              onClick={() => navigate(next(claim.id), { state: { claimId: claim.id, clientId: claim.clientId } })} />
          ) : null}
          {step === "documents" && missing > 0 ? <Button type="button" icon="pi pi-envelope" label={t("claimDocs.remind")} onClick={remind} /> : null}
        </ClaimActions>
      ) : null}
    </ClaimJourneyLayout>
  );
};

export default ClaimDetail;
