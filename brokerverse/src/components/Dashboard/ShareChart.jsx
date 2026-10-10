import React from "react";
import PropTypes from "prop-types";
import { useChartTheme } from "../../theme/chartTheme";
import { ThemedChart } from "./ChartCard";

/**
 * Share of a total by a business entity (insurer, line of business, channel): a donut in the fixed colour of each entity
 * while there are five slices or fewer, sorted bars in the first data colour beyond that (a pie of many slices cannot
 * be compared). items = [{ label, amount }].
 */
const ShareChart = ({ items, dimension, label, format, height }) => {
  const chart = useChartTheme();
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  if (sorted.length > 5) {
    const data = { labels: sorted.map((i) => i.label), datasets: [{ label, data: sorted.map((i) => i.amount), backgroundColor: chart.primary }] };
    return <ThemedChart type="bar" data={data} format={format} options={{ indexAxis: "y" }} height={sorted.length * 34 + 40} />;
  }
  const data = { labels: sorted.map((i) => i.label), datasets: [{ label, data: sorted.map((i) => i.amount), backgroundColor: chart.entities(dimension, sorted.map((i) => i.label)) }] };
  return <ThemedChart type="doughnut" data={data} format={format} options={{ cutout: "62%", plugins: { legend: { position: "right" } } }} height={height} />;
};

ShareChart.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, amount: PropTypes.number })).isRequired,
  dimension: PropTypes.oneOf(["insurer", "lob", "channel"]).isRequired,
  label: PropTypes.string,
  format: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  height: PropTypes.number,
};
ShareChart.defaultProps = { label: "", format: "currency", height: 220 };

export default ShareChart;
