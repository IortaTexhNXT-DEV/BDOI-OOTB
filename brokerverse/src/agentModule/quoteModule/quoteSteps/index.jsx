import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";

/** The four screens of the motor quote, in order. */
export const QUOTE_STEPS = ["policy", "coverage", "accessories", "summary"];

/**
 * Where the user is in the motor quote (policy details, coverage, accessories, summary): the steps before are done,
 * the current one is marked. Shown at the top of each step's card.
 */
const QuoteSteps = ({ current }) => {
  const { t } = useTranslation();
  const at = QUOTE_STEPS.indexOf(current);
  return (
    <ol className="bv-quote-steps" aria-label={t("quoteSteps.label")}>
      {QUOTE_STEPS.map((step, i) => (
        <li
          key={step}
          className={`bv-quote-steps__step${i < at ? " is-done" : ""}${i === at ? " is-current" : ""}`}
          aria-current={i === at ? "step" : undefined}
        >
          <span className="bv-quote-steps__marker" aria-hidden="true">
            {i < at ? <i className="pi pi-check" /> : i + 1}
          </span>
          <span className="bv-quote-steps__label">{t(`quoteSteps.${step}`)}</span>
        </li>
      ))}
    </ol>
  );
};

export default QuoteSteps;
