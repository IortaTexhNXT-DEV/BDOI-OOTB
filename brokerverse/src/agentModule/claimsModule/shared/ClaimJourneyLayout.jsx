import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Steps } from "primereact/steps";
import { Tag } from "primereact/tag";
import { CLAIM_STEPS, stepIndex } from "./claimJourney";
import "./claimJourney.scss";

/**
 * Frame of every claim screen: page title, the insured and claim (or policy) reference with the way back, the claim
 * status, the journey steps and the card holding the screen.
 */
const ClaimJourneyLayout = ({ step, holderName, reference, status, onBack, title, actions, children }) => {
  const { t } = useTranslation();
  const model = CLAIM_STEPS.map((key) => ({ label: t(`claimJourney.steps.${key}`) }));
  return (
    <div className="claim-journey">
      <div className="claim-journey__head">
        <div>
          <h1 className="claim-journey__title">{t("claimJourney.title")}</h1>
          <button type="button" className="claim-journey__back" onClick={onBack}>
            <i className="pi pi-arrow-left" aria-hidden="true" />
            <span>{holderName || t("claimJourney.loading")}</span>
            {reference && <span className="claim-journey__ref">{reference}</span>}
          </button>
        </div>
        <div className="claim-journey__head-side">
          {status && <Tag className="claim-journey__status" value={status} />}
          {actions}
        </div>
      </div>
      <Steps model={model} activeIndex={stepIndex(step)} readOnly className="claim-journey__steps" />
      <Card className="claim-journey__card">
        {title && <h2 className="claim-journey__card-title">{title}</h2>}
        {children}
      </Card>
    </div>
  );
};

ClaimJourneyLayout.propTypes = {
  step: PropTypes.oneOf(CLAIM_STEPS).isRequired,
  holderName: PropTypes.string,
  reference: PropTypes.string,
  status: PropTypes.string,
  onBack: PropTypes.func,
  title: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
};

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

export default ClaimJourneyLayout;
