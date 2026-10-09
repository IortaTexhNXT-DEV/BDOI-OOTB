import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { KeyFacts, PageHeader, SectionCard, StatusChip } from "../../../components/RecordPage";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { CLAIM_STEPS, claimLobOf, stepIndex } from "./claimJourney";
import "./claimJourney.scss";

/** The claim's key facts under the steps: policy, insured, insurer and its claim number, loss, estimate, settlement. */
export const claimFacts = (claim, t) => [
  { key: "policy", label: t("claimJourney.policyNumber"), value: claim.policyNumber || claim.policy?.policyNumber },
  { key: "insured", label: t("claimFlow.insured"), value: claim.policyHolderName || claim.clientName },
  { key: "insurer", label: t("claimJourney.insurer"), value: claim.insuranceCompanyName || claim.policy?.insuranceCompanyName },
  { key: "insurerRef", label: t("claimJourney.insurerClaimNumber"), value: claim.insuranceCompanyClaimNumber },
  { key: "loss", label: t("claimJourney.dateOfLoss"), value: claim.dateOfIncident ? formatDate(claim.dateOfIncident) : null },
  { key: "cause", label: t("claimJourney.causeOfLoss"), value: claim.typeOfIncident },
  { key: "estimate", label: t("claimJourney.estimatedAmount"), value: claim.estimatedClaimAmount ? formatCurrency(claim.estimatedClaimAmount) : null },
  claim.settlementAmount ? { key: "settlement", label: t("claimJourney.settlementAmount"), value: formatCurrency(claim.settlementAmount) } : null,
];

/** The steps of a claim, the steps before the current one marked as done. */
export const ClaimSteps = ({ step }) => {
  const { t } = useTranslation();
  const current = stepIndex(step);
  const model = CLAIM_STEPS.map((key, i) => ({ label: t(`claimJourney.steps.${key}`), className: i < current ? "claim-journey__step--done" : undefined }));
  return <Steps model={model} activeIndex={current} readOnly className="claim-journey__steps" />;
};
ClaimSteps.propTypes = { step: PropTypes.oneOf(CLAIM_STEPS).isRequired };

/**
 * Frame of every claim screen: the page header (claim number, insured, policy, line of business, status and the way
 * back), the journey steps, the claim's key facts once the claim exists, and the card holding the step.
 */
const ClaimJourneyLayout = ({ step, claim, claimNumber, holderName, reference, status, onBack, title, actions, children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const number = claim?.claimNumber || claimNumber;
  const lob = claim ? claimLobOf(claim.lob, claim.policy?.lob, claim.productType) : "";
  const insured = claim?.policyHolderName || holderName;
  const policy = claim?.policyNumber || claim?.policy?.policyNumber;
  const shownStatus = claim?.claimStatus || status;
  const sep = <span className="bv-page-header__sep" aria-hidden="true">·</span>;
  return (
    <div className="bv-ops-page claim-journey">
      <PageHeader
        title={number ? t("claimFlow.claimTitle", { number }) : t("claimFlow.newClaim")}
        crumbs={[{ label: t("sidebar.Operations", "Operations") }, { label: t("claimJourney.title"), onClick: () => navigate("/agent/claim") }, { label: number || reference || t("claimFlow.newClaim") }]}
        meta={(
          <>
            {insured ? <span className="bv-page-header__code">{insured}</span> : null}
            {policy ? <>{sep}<span>{t("claimFlow.policyRef", { number: policy })}</span></> : null}
            {!claim && reference ? <>{sep}<span>{reference}</span></> : null}
            {lob ? <StatusChip label={t(`claimFlow.lob.${lob}`, lob)} severity="secondary" /> : null}
            {shownStatus ? <StatusChip status={claim?.lifecycleStatus || shownStatus} label={shownStatus} /> : null}
          </>
        )}
        actions={(
          <>
            {actions}
            {onBack ? <Button type="button" icon="pi pi-arrow-left" outlined label={t("claimFlow.close")} onClick={onBack} /> : null}
          </>
        )} />
      <ClaimSteps step={step} />
      {claim ? <KeyFacts items={claimFacts(claim, t)} /> : null}
      <SectionCard title={title} className="claim-journey__card">
        {children}
      </SectionCard>
    </div>
  );
};

ClaimJourneyLayout.propTypes = {
  step: PropTypes.oneOf(CLAIM_STEPS).isRequired,
  claim: PropTypes.object,
  /** Number of a claim being edited before its full record is loaded. */
  claimNumber: PropTypes.string,
  holderName: PropTypes.string,
  reference: PropTypes.string,
  status: PropTypes.string,
  onBack: PropTypes.func,
  title: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
};
ClaimJourneyLayout.defaultProps = { claim: null, claimNumber: "", holderName: "", reference: "", status: "", onBack: null, title: null, actions: null, children: null };

/** Section heading inside a claim screen card. */
export const ClaimSection = ({ title, hint, children }) => (
  <section className="claim-journey__section">
    <h3 className="claim-journey__section-title">
      {title}
      {hint && <span className="claim-journey__section-hint">{hint}</span>}
    </h3>
    {children}
  </section>
);

ClaimSection.propTypes = { title: PropTypes.node, hint: PropTypes.node, children: PropTypes.node };

/** Back and forward buttons at the foot of a claim screen. */
export const ClaimActions = ({ children }) => <div className="claim-journey__actions">{children}</div>;

ClaimActions.propTypes = { children: PropTypes.node };

/** Column classes of a claim form field: three fields a row on a wide screen, two on a laptop, one on a phone. */
export const FIELD_COL = "col-12 md:col-6 xl:col-4";

export default ClaimJourneyLayout;
