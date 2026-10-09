import React from "react";
import PropTypes from "prop-types";

/**
 * Label / value grid of a card or a pop-up. Items left out (null or false) are skipped; an empty value shows "-".
 * `numeric` aligns an amount to the right of its cell.
 */
const Facts = ({ items, className = "" }) => (
  <dl className={`ye-facts ${className}`.trim()}>
    {items.filter(Boolean).map((item) => (
      <div className={`ye-fact${item.numeric ? " ye-fact--numeric" : ""}`} key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value === null || item.value === undefined || item.value === "" ? "-" : item.value}</dd>
      </div>
    ))}
  </dl>
);

Facts.propTypes = {
  items: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.oneOf([null, false]),
    PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.node, numeric: PropTypes.bool }),
  ])).isRequired,
  className: PropTypes.string,
};

export default Facts;
