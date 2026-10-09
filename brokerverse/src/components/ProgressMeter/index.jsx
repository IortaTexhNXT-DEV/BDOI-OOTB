import React from "react";
import PropTypes from "prop-types";
import { ProgressBar } from "primereact/progressbar";
import { progressValue } from "../../utility/numberFormat";

/**
 * A figure out of 100 as a thin bar with the value written next to it (never inside the bar, where a short bar clips
 * it): utilisation of a limit, completion of a checklist, share of a target. Styles: theme/bdoi/enterprise.scss
 * (.bv-meter). The tone follows the value unless given: primary up to 80, warning above 80, danger above 100.
 */
export const meterTone = (value, tone) => {
  if (tone) return tone;
  if (value > 100) return "danger";
  if (value > 80) return "warning";
  return "primary";
};

/** The value as text with one decimal at most: 7.6 -> "7.6%", 50 -> "50%". */
export const meterLabel = (value) => `${Math.round(value * 10) / 10}%`;

const ProgressMeter = ({ value, label, width, tone, className }) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const classes = ["bv-meter", `bv-meter--${meterTone(safe, tone)}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={width ? { width } : undefined} data-testid="progress-meter">
      <ProgressBar value={progressValue(safe, 1)} showValue={false} />
      {label === "" ? null : <span className="bv-meter__value">{label ?? meterLabel(safe)}</span>}
    </div>
  );
};

ProgressMeter.propTypes = {
  /** 0 to 100; a value above 100 fills the bar and is written as is */
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** text on the right of the bar; the value with a percent sign when left out, no text when "" */
  label: PropTypes.node,
  /** width of the whole meter (CSS length); the bar takes the width left by the text */
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** colour of the bar; from the value when left out */
  tone: PropTypes.oneOf(["primary", "success", "warning", "danger"]),
  className: PropTypes.string,
};

export default ProgressMeter;
