import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../utility/dateFormat";
import "../LoadState/index.scss";

/**
 * The one-line empty state of a dashboard on "Issued since go-live" when no policy was issued in BrokerVerse since the
 * cutover date: why it is empty and the next step, "Switch to All business", as a link. `inline` drops the frame (inside
 * a chart area).
 */
const OriginEmpty = ({ cutoverDate, onOrigin, inline }) => {
  const { t } = useTranslation();
  const why = cutoverDate
    ? t("dashboards.emptyIssued.since", { date: formatDate(cutoverDate), defaultValue: "No policies issued since go-live ({{date}})." })
    : t("dashboards.emptyIssued.none", "No policies issued in BrokerVerse yet.");
  const body = (
    <>
      <span>{why}</span>
      {onOrigin ? (
        <button type="button" className="bv-link-button" onClick={() => onOrigin("all")} data-testid="origin-empty-switch">
          {t("dashboards.emptyIssued.switch", "Switch to All business to see the sample data.")}
        </button>
      ) : null}
    </>
  );
  if (inline) return <span className="bv-origin-empty">{body}</span>;
  return (
    <div className="bv-view-state bv-view-state--message bv-origin-empty" role="status">
      <i className="pi pi-info-circle" aria-hidden="true" />
      {body}
    </div>
  );
};

OriginEmpty.propTypes = {
  cutoverDate: PropTypes.string,
  onOrigin: PropTypes.func,
  inline: PropTypes.bool,
};
OriginEmpty.defaultProps = { cutoverDate: null, onOrigin: null, inline: false };

export default OriginEmpty;
