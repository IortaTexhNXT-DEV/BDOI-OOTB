import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/** How a step status is drawn in the stepper: done (tick), attention (exclamation), waiting (clock), todo (number). */
export const stepTone = (status) => {
  if (["passed", "posted", "done"].includes(status)) return "done";
  if (["failed", "blocked"].includes(status)) return "attention";
  if (status === "pending-approval") return "waiting";
  return "todo";
};
const ICON = { done: "pi pi-check", attention: "pi pi-exclamation-triangle", waiting: "pi pi-clock" };

/** Horizontal stepper of the year-end close: one item per step with its state; selecting an item shows its card. */
const Stepper = ({ steps, active, onSelect }) => {
  const { t } = useTranslation();
  return (
    <nav className="ye-stepper" aria-label={t("yearEndClose.stepsLabel")}>
      <ol>
        {steps.map((s, i) => {
          const tone = stepTone(s.status);
          const current = s.key === active;
          return (
            <li key={s.key} className={`ye-stepper__item ye-stepper__item--${tone}${current ? " is-active" : ""}`}>
              <button type="button" onClick={() => onSelect(s.key)} aria-current={current ? "step" : undefined}>
                <span className="ye-stepper__marker" aria-hidden="true">{ICON[tone] ? <i className={ICON[tone]} /> : i + 1}</span>
                <span className="ye-stepper__text">
                  <span className="ye-stepper__label">{`${i + 1}. ${t(`yearEndClose.step.${s.key}`)}`}</span>
                  <span className="ye-stepper__status">{t(`periodEnd.status.${s.status}`)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

Stepper.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string.isRequired, status: PropTypes.string.isRequired })).isRequired,
  active: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

export default Stepper;
