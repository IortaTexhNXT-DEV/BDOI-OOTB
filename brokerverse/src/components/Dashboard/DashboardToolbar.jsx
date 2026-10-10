import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { formatBusinessDateTime, formatDate, getBusinessTimeZone } from "../../utility/dateFormat";
import { allowedDashboards } from "./personas";
import { COMPARISONS, PERIODS } from "./periods";

/** "Data as of 10/10/2026 14:05 (Asia/Manila)": when the figures were read, in the business time zone. */
export const DataAsOf = ({ asOf }) => {
  const { t } = useTranslation();
  if (!asOf) return null;
  return (
    <span className="bv-dash-asof">
      <i className="pi pi-clock" aria-hidden="true" />
      {t("dashboards.asOf", { time: formatBusinessDateTime(asOf), zone: getBusinessTimeZone(), defaultValue: "Data as of {{time}} ({{zone}})" })}
    </span>
  );
};
DataAsOf.propTypes = { asOf: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]) };
DataAsOf.defaultProps = { asOf: null };

/**
 * The one row of controls above a dashboard, scoping every card and chart below it: the dashboard switcher (the
 * dashboards the user's roles may open), the period and its comparison, the screen's own filters, and on the right
 * the dates covered, when the figures were read and a refresh. Leave `onPeriod` / `onCompare` out where a screen has
 * no period of its own.
 */
const DashboardToolbar = ({ title, period, onPeriod, periods, compare, onCompare, range, asOf, onRefresh, loading, children, actions }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dashboards] = useState(() => allowedDashboards());
  const current = dashboards.find((d) => pathname.startsWith(d.path));
  return (
    <div className="bv-dash-head">
      <div className="bv-dash-head__title">
        <h1>{title}</h1>
        {range?.from ? (
          <p>
            {t("dashboards.range", { from: formatDate(range.from), to: formatDate(range.to), defaultValue: "{{from}} to {{to}}" })}
            {range.previousFrom ? ` · ${t(`dashboards.compareText.${compare}`, { from: formatDate(range.previousFrom), to: formatDate(range.previousTo), defaultValue: "vs {{from}} to {{to}}" })}` : ""}
          </p>
        ) : null}
      </div>
      <div className="bv-dash-head__actions">{actions}</div>
      <div className="bv-dash-toolbar" role="toolbar" aria-label={t("dashboards.filters", "Dashboard filters")}>
        {dashboards.length > 1 ? (
          <Dropdown value={current?.key || null} options={dashboards.map((d) => ({ label: t(`dashboards.names.${d.key}`), value: d.key }))}
            onChange={(e) => navigate(dashboards.find((d) => d.key === e.value).path)} aria-label={t("dashboards.switch", "Dashboard")} className="bv-dash-toolbar__switch" />
        ) : null}
        {onPeriod ? (
          <Dropdown value={period} options={periods.map((p) => ({ label: t(`dashboards.periods.${p}`), value: p }))} onChange={(e) => onPeriod(e.value)} aria-label={t("dashboards.period", "Period")} />
        ) : null}
        {onCompare ? (
          <Dropdown value={compare} options={COMPARISONS.map((c) => ({ label: t(`dashboards.compare.${c}`), value: c }))} onChange={(e) => onCompare(e.value)} aria-label={t("dashboards.comparison", "Compare with")} />
        ) : null}
        {children}
        <span className="bv-dash-toolbar__spacer" />
        <DataAsOf asOf={asOf} />
        {onRefresh ? (
          <Button type="button" icon="pi pi-refresh" text rounded loading={loading} aria-label={t("dashboards.refresh", "Refresh")} tooltip={t("dashboards.refresh", "Refresh")}
            tooltipOptions={{ position: "bottom" }} onClick={onRefresh} />
        ) : null}
      </div>
    </div>
  );
};

DashboardToolbar.propTypes = {
  title: PropTypes.node.isRequired,
  period: PropTypes.string,
  onPeriod: PropTypes.func,
  periods: PropTypes.arrayOf(PropTypes.string),
  compare: PropTypes.string,
  onCompare: PropTypes.func,
  range: PropTypes.shape({ from: PropTypes.string, to: PropTypes.string, previousFrom: PropTypes.string, previousTo: PropTypes.string }),
  asOf: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
  onRefresh: PropTypes.func,
  loading: PropTypes.bool,
  children: PropTypes.node,
  actions: PropTypes.node,
};
DashboardToolbar.defaultProps = {
  period: "month", onPeriod: null, periods: PERIODS, compare: "previous", onCompare: null, range: null, asOf: null, onRefresh: null, loading: false, children: null, actions: null,
};

export default DashboardToolbar;
