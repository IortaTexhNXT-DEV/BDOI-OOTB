/**
 * Cells shared by the lists, so that one kind of value looks the same on every screen.
 *
 *   <ListCell items={r.insurers.map((i) => i.name)} />        Maagap Insurance, Inc.  [+2 more]
 *   <PeriodCell from={r.inceptionDate} to={r.expiryDate} />   09/10/2026 – 09/10/2027
 *   <NameChipCell name="Group Personal Accident" chip="ACCIDENT" />
 *
 * A list of several names shows the first ones and a "+n more" chip whose tooltip names the rest, so one row does not
 * grow to the height of a paragraph. A period is one line, the two dates joined by an en dash.
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../utility/dateFormat";
import "./index.scss";

export const ListCell = ({ items, max, empty }) => {
  const { t } = useTranslation();
  const list = (items || []).filter((x) => x !== null && x !== undefined && x !== "");
  if (!list.length) return <span>{empty}</span>;
  const shown = list.slice(0, max);
  const rest = list.slice(max);
  return (
    <span className="bv-list-cell">
      <span className="bv-list-cell__items">{shown.join(", ")}</span>
      {rest.length > 0 && (
        <span className="bv-list-cell__more" title={rest.join("\n")} aria-label={rest.join(", ")}>
          {t("common.moreCount", { count: rest.length, defaultValue: `+${rest.length} more` })}
        </span>
      )}
    </span>
  );
};

ListCell.propTypes = { items: PropTypes.arrayOf(PropTypes.node), max: PropTypes.number, empty: PropTypes.node };
ListCell.defaultProps = { items: [], max: 1, empty: "-" };

/** "from – to" on one line; the dates in the configured date format. */
export const formatPeriod = (from, to, format = formatDate) => {
  const a = from ? format(from) : "";
  const b = to ? format(to) : "";
  if (!a && !b) return "-";
  return `${a || "…"} – ${b || "…"}`;
};

export const PeriodCell = ({ from, to, format }) => <span className="bv-nowrap">{formatPeriod(from, to, format)}</span>;

PeriodCell.propTypes = { from: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]), to: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]), format: PropTypes.func };
PeriodCell.defaultProps = { from: null, to: null, format: undefined };

/** A name with the small chip that qualifies it (the line of business of a product), the chip on its own line. */
export const NameChipCell = ({ name, chip }) => (
  <span className="bv-name-chip">
    <span>{name || "-"}</span>
    {chip ? <span className="bv-name-chip__chip">{chip}</span> : null}
  </span>
);

NameChipCell.propTypes = { name: PropTypes.node, chip: PropTypes.node };
NameChipCell.defaultProps = { name: null, chip: null };
