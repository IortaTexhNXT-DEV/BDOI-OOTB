import React from "react";
import PropTypes from "prop-types";
import { numberLocale } from "../../utility/currencyConverter";
import "./index.scss";

/**
 * The row of figures above a list (totals, counts per status). Every card has the same fixed height, so nothing
 * moves when the figures arrive or refresh: before the first answer a card shows a dash, afterwards it keeps its
 * last figure while a refresh is running. A card with `onClick` acts as a filter (`active` marks the chosen one).
 */
const StatCards = ({ items, className = "" }) => (
  <div className={`bv-stat-cards ${className}`}>
    {items.map((item) => {
      const value = item.value === null || item.value === undefined ? "-" : typeof item.value === "number" ? item.value.toLocaleString(numberLocale()) : item.value;
      const body = (
        <>
          <span className="bv-stat-label">{item.label}</span>
          <span className="bv-stat-value">{value}</span>
          <span className="bv-stat-note">{item.note || " "}</span>
        </>
      );
      return item.onClick ? (
        <button type="button" key={item.key} className={`bv-stat-card clickable ${item.active ? "active" : ""}`} onClick={item.onClick} aria-pressed={!!item.active}>
          {body}
        </button>
      ) : (
        <div key={item.key} className="bv-stat-card">{body}</div>
      );
    })}
  </div>
);

StatCards.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    note: PropTypes.node,
    onClick: PropTypes.func,
    active: PropTypes.bool,
  })).isRequired,
  className: PropTypes.string,
};

export default StatCards;
