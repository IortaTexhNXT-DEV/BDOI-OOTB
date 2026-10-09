import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "primereact/button";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { getClaimDetails } from "../../claimsModule/adjusterSubmission/store/adjusterSubmissionMiddleWare";
import ClaimJourneyLayout, { ClaimSection } from "../../claimsModule/shared/ClaimJourneyLayout";
import FormErrorSummary from "../../claimsModule/shared/FormErrorSummary";
import useClaimsConfig from "../../claimsModule/shared/useClaimsConfig";
import { claimLobOf, lobUses, stepForStatus } from "../../claimsModule/shared/claimJourney";
import { formatDate } from "../../../utility/dateFormat";
import "./index.scss";

/** Screen of the step a claim is at, to carry on with it (none once it is settled, closed or rejected). */
const CONTINUE_ROUTE = {
  review: (id) => `/agent/claimrequest/requestapproval/${id}`,
  adjuster: (id) => `/agent/claimrequest/adjustersubmission/${id}`,
  approval: (id) => `/agent/claimrequest/settlementapproval/${id}`,
};

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
 * facts: the loss, the policy and insured, the driver and the third party (motor), the adjuster, the settlement and
 * each co-insurer's share. Sections that do not apply to the claim's line of business (claims.lob_fields) are left out.
 */
const ClaimDetail = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { claimId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const config = useClaimsConfig();

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
  const step = claim ? stepForStatus(claim.lifecycleStatus) : "notification";
  const next = claim ? CONTINUE_ROUTE[step] : null;
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
          {next ? (
            <Button type="button" icon="pi pi-arrow-right" iconPos="right" label={t("claimFlow.continue", { step: t(`claimJourney.steps.${step}`) })}
              onClick={() => navigate(next(claim.id), { state: { claimId: claim.id, clientId: claim.clientId } })} />
          ) : null}
          {["settled", "closed", "approved"].includes(claim.lifecycleStatus) ? (
            <Button type="button" icon="pi pi-wallet" label={t("claimFlow.paymentTitle")} onClick={() => navigate(`/agent/claimdetailedview/${claim.id}`)} />
          ) : null}
        </>
      ) : null}
    >
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
              ]} />
            </ClaimSection>
          </div>
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
            <p className="claim-detail__record">
              {t("claimFlow.recordLine", {
                created: formatDate(claim.createdAt, { withTime: true }), by: claim.createdBy || "—", updated: formatDate(claim.updatedAt, { withTime: true }),
              })}
            </p>
          </div>
        </div>
      )}
    </ClaimJourneyLayout>
  );
};

export default ClaimDetail;
