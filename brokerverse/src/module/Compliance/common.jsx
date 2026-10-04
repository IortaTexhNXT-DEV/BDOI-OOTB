import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import { formatDate } from "../../utility/dateFormat";
import { formatNumber } from "../../utility/numberFormat";

/** Values the server accepts (backend/src/modules/aml); their labels are in en.json "aml". */
export const RATINGS = ["low", "normal", "high"];
export const KYC_STATUSES = ["pending", "complete", "edd-required", "refresh-due", "blocked"];
export const HIT_STATUSES = ["open", "escalated", "cleared", "confirmed"];
export const EDD_STATUSES = ["open", "submitted", "approved", "rejected"];
export const ALERT_STATUSES = ["open", "escalated", "closed", "reported"];
export const CASE_STATUSES = ["open", "for-filing", "filed", "closed"];
export const CASE_TYPES = ["STR", "CTR", "review"];
export const REPORT_STATUSES = ["generated", "submitted", "acknowledged", "rejected"];
export const FACTORS = ["client-type", "nationality", "pep", "line", "payment-mode", "premium-size", "geography"];
export const SUSPICION_REASONS = [
  "no-underlying-legal-or-trade-obligation", "client-not-properly-identified", "amount-not-commensurate-with-business-or-capacity", "structuring",
  "deviation-from-profile", "related-to-unlawful-activity", "similar-or-analogous", "sanctions-or-designated-person",
];
export const DOC_TYPES = ["government-id", "proof-of-address", "tin", "sec-registration", "dti-registration", "cda-registration", "articles-by-laws", "gis",
  "board-resolution", "secretary-certificate", "beneficial-owner-declaration", "source-of-funds", "edd-evidence", "other"];

const SEVERITY = {
  low: "success", normal: "info", high: "danger",
  pending: "warning", complete: "success", "edd-required": "danger", "refresh-due": "warning", blocked: "danger",
  open: "warning", escalated: "danger", cleared: "success", confirmed: "danger", submitted: "info", approved: "success", rejected: "secondary",
  closed: "secondary", reported: "success", "for-filing": "info", filed: "success", generated: "warning", acknowledged: "success",
  clear: "success", "potential-match": "danger", "provider-pending": "warning", error: "danger", medium: "warning",
};

/** Option list with translated labels from a group of en.json "aml". */
export const useOptionList = (values, group) => {
  const { t } = useTranslation();
  return values.map((value) => ({ value, label: t(`aml.${group}.${value}`, { defaultValue: value }) }));
};

/** Status, rating or severity tag. */
export const AmlTag = ({ value, group }) => {
  const { t } = useTranslation();
  if (!value) return <span className="access__muted">{t("aml.unrated")}</span>;
  return <Tag value={t(`aml.${group}.${value}`, { defaultValue: value })} severity={SEVERITY[value] || "secondary"} />;
};

export const showDate = (v) => formatDate(v, { empty: "" });
export const showDateTime = (v) => formatDate(v, { withTime: true, empty: "" });
export const showMoney = (v) => (v === null || v === undefined ? "" : formatNumber(v, { decimals: 2, minDecimals: 2 }));
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);
export const fromIsoDay = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null);

/** Page frame of the Compliance screens: breadcrumb, title, one-line purpose and the actions on the right. */
export const PageHeader = ({ title, intro, actions, home }) => {
  const { t } = useTranslation();
  return (
    <>
      <BreadCrumb model={[{ label: title }]} home={{ label: home || t("sidebar.Compliance") }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {actions ? <div className="admin__actions">{actions}</div> : null}
      </div>
    </>
  );
};

/** Clickable count tile (filters the list below it). */
export const StatTile = ({ value, label, selected, onClick, loading }) => (
  <button type="button" className={`access__stat${selected ? " is-selected" : ""}`} onClick={onClick}>
    <span className="access__stat-value">{loading ? "-" : value ?? 0}</span>
    <span className="access__stat-label">{label}</span>
  </button>
);

/** Party cell: name with code underneath. */
export const PartyCell = ({ name, code }) => (
  <div className="access__user">
    <span className="access__user-name">{name}</span>
    {code ? <span className="access__muted">{code}</span> : null}
  </div>
);
