import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import "./index.scss";

/**
 * Thin moving line along the top edge of a card or a table while its data refreshes (useStableLoad `refreshing`):
 * the content under it stays as it is. It lies over the top edge of its container, which needs the class
 * bv-loading-host (or any position other than static); `inline` keeps a line of its own height in the flow instead.
 * Like every loading indicator it appears only after 400 ms, so a quick refresh shows nothing.
 */
const LoadingBar = ({ active, inline = false, label, className = "" }) => {
  const { t } = useTranslation();
  const classes = ["bv-loading-bar", inline ? "bv-loading-bar--inline" : "", className].filter(Boolean).join(" ");
  if (!active) return inline ? <div className={classes} aria-hidden="true" /> : null;
  return (
    <div className={`${classes} bv-delayed-loading`} role="progressbar" aria-label={label || t("loadingBar.refreshing", "Refreshing")} aria-busy="true">
      <span className="bv-loading-bar__runner" />
    </div>
  );
};

LoadingBar.propTypes = {
  /** shows the bar (the refreshing flag of the data) */
  active: PropTypes.bool,
  /** in the flow with its own height (kept when inactive, so nothing moves) instead of over the container's edge */
  inline: PropTypes.bool,
  /** what is loading, for screen readers ("Refreshing" when left out) */
  label: PropTypes.string,
  className: PropTypes.string,
};

export default LoadingBar;
