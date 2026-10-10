import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { formatPercent } from "../../utility/numberFormat";
import { numberLocale } from "../../utility/currencyConverter";

/** "+12.5%", "-3%", "> +999%" (a period compared with an almost empty one). */
export const deltaText = (change) => {
  if (change === null || change === undefined || !Number.isFinite(Number(change))) return null;
  const n = Number(change);
  if (Math.abs(n) > 999) return n > 0 ? "> +999%" : "< -999%";
  return `${n > 0 ? "+" : ""}${formatPercent(n)}`;
};

/**
 * Direction of a change and whether it is good news: `good` says which way is good ("up": premium, "down": claims
 * ratio, cycle time; "neutral": no judgement). The direction is always shown by the arrow; good / bad by the status
 * colour of the text, never by colour alone.
 */
export const deltaTone = (change, good = "up") => {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return { direction: "flat", tone: "neutral" };
  const direction = n > 0 ? "up" : "down";
  if (good === "neutral") return { direction, tone: "neutral" };
  return { direction, tone: direction === good ? "good" : "bad" };
};

const ICONS = { up: "pi-arrow-up-right", down: "pi-arrow-down-right", flat: "pi-minus" };
const STATUS_ICONS = { good: "pi-check-circle", warning: "pi-exclamation-circle", serious: "pi-exclamation-triangle", critical: "pi-times-circle" };

/**
 * One KPI: label, value, change with its arrow against the named comparison period, an optional note (target,
 * secondary figure) and an optional state (icon + word). Neutral card: no coloured background, no icon chip. With `onClick`
 * the card opens the list behind the figure (drill-down); `active` marks the card whose filter is applied.
 */
const KpiCard = ({ label, value, change, good, comparison, note, status, onClick, active, actionLabel }) => {
  const { t } = useTranslation();
  const shown = value === null || value === undefined || value === "" ? "-" : typeof value === "number" ? value.toLocaleString(numberLocale()) : value;
  const delta = deltaText(change);
  const { direction, tone } = deltaTone(change, good);
  const body = (
    <>
      <span className="bv-stat-label">{label}</span>
      <span className="bv-stat-value">{shown}</span>
      {delta ? (
        <span className={`bv-stat-delta bv-stat-delta--${tone}`}>
          <i className={`pi ${ICONS[direction]}`} aria-hidden="true" />
          <span className="bv-stat-delta__value">{delta}</span>
          {comparison ? <span className="bv-stat-delta__period">{comparison}</span> : null}
        </span>
      ) : null}
      {status ? (
        <span className={`bv-stat-status bv-stat-status--${status.severity}`}>
          <i className={`pi ${STATUS_ICONS[status.severity] || STATUS_ICONS.warning}`} aria-hidden="true" />
          {status.label}
        </span>
      ) : null}
      <span className="bv-stat-note">{note || (delta ? "" : " ")}</span>
      {onClick && active === undefined ? <span className="bv-stat-open" aria-hidden="true"><i className="pi pi-arrow-right" /></span> : null}
    </>
  );
  return onClick ? (
    <button type="button" className={`bv-stat-card clickable ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active === undefined ? undefined : !!active}
      title={actionLabel || t("dashboards.openList", "Open the list")}>
      {body}
    </button>
  ) : (
    <div className="bv-stat-card">{body}</div>
  );
};

KpiCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  change: PropTypes.number,
  good: PropTypes.oneOf(["up", "down", "neutral"]),
  comparison: PropTypes.node,
  note: PropTypes.node,
  status: PropTypes.shape({ severity: PropTypes.oneOf(["good", "warning", "serious", "critical"]).isRequired, label: PropTypes.node.isRequired }),
  onClick: PropTypes.func,
  active: PropTypes.bool,
  actionLabel: PropTypes.string,
};
KpiCard.defaultProps = { value: null, change: null, good: "up", comparison: null, note: null, status: null, onClick: null, active: undefined, actionLabel: null };

export default KpiCard;
