import React from "react";
import PropTypes from "prop-types";
import KpiCard from "../Dashboard/KpiCard";
import "./index.scss";

/**
 * The row of figures above a list or a dashboard (totals, counts per status, KPIs). Every card has the structure of
 * components/Dashboard/KpiCard (label, value, change against a named period, note) and the same height, so nothing
 * moves when the figures arrive or refresh: before the first answer a card shows a dash, afterwards it keeps its last
 * figure while a refresh is running. A card with `onClick` acts as a filter or opens the list behind the figure
 * (`active` marks the chosen one).
 */
const StatCards = ({ items, className = "" }) => (
  <div className={`bv-stat-cards ${className}`}>
    {items.map(({ key, ...item }) => <KpiCard key={key} {...item} />)}
  </div>
);

StatCards.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    change: PropTypes.number,
    good: PropTypes.oneOf(["up", "down", "neutral"]),
    comparison: PropTypes.node,
    note: PropTypes.node,
    status: PropTypes.shape({ severity: PropTypes.string, label: PropTypes.node }),
    onClick: PropTypes.func,
    active: PropTypes.bool,
  })).isRequired,
  className: PropTypes.string,
};

export default StatCards;
