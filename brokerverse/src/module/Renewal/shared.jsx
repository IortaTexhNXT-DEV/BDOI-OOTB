import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusChip } from "../../components/RecordPage";
import { formatDate } from "../../utility/dateFormat";
import "./renewalPages.scss";

/** Page header of the Renewals screens: title, breadcrumb Operations > Renewals > page, actions. */
export const RenewalHeader = ({ title, actions, meta }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <PageHeader title={title} meta={meta} actions={actions}
      crumbs={[{ label: t("sidebar.Operations", "Operations") }, { label: t("renewalPages.renewals"), onClick: () => navigate("/renewal/queue") }, { label: title }]} />
  );
};
RenewalHeader.propTypes = { title: PropTypes.node.isRequired, actions: PropTypes.node, meta: PropTypes.node };
RenewalHeader.defaultProps = { actions: null, meta: null };

const STAGE_SEVERITY = {
  pipeline: "secondary", "notice-1": "info", "notice-2": "info", "final-notice": "info", quoted: "info", "pending-approval": "warning",
  approved: "success", renewed: "success", lapsed: "danger",
};

/** Stage of a renewal as a chip: waiting stages in grey, notices and quotes as open work, approval pending, grace period in amber. */
export const StageChip = ({ row }) => {
  if (!row) return null;
  let severity = STAGE_SEVERITY[row.statusCode] || "info";
  if (row.pastGracePeriod) severity = "danger";
  else if (row.inGracePeriod) severity = "warning";
  return <StatusChip label={row.status || row.currentStage} severity={severity} />;
};
StageChip.propTypes = { row: PropTypes.object };
StageChip.defaultProps = { row: null };

const RISK_SEVERITY = { Critical: "danger", High: "danger", Medium: "warning", Low: "success" };

/** Retention risk level as a chip (Low / Medium / High / Critical, from renewals.risk_bands). */
export const RiskChip = ({ level }) => {
  const { t } = useTranslation();
  if (!level) return null;
  return <StatusChip label={t(`renewalPages.risk.${level}`, level)} severity={RISK_SEVERITY[level] || "info"} />;
};
RiskChip.propTypes = { level: PropTypes.string };
RiskChip.defaultProps = { level: "" };

/** Expiry date with "in 12 days" / "expired 3 days ago" under it. */
export const ExpiryCell = ({ date, days }) => {
  const { t } = useTranslation();
  let note = "";
  if (days !== null && days !== undefined) {
    if (days < 0) note = t("renewalPages.expiredAgo", { count: -days });
    else if (days === 0) note = t("renewalPages.expiresToday");
    else note = t("renewalPages.expiresIn", { count: days });
  }
  return (
    <span className="bv-cell-stack">
      <span className="bv-nowrap">{formatDate(date)}</span>
      {note ? <small className={days !== null && days <= 7 ? "bv-text-alert" : ""}>{note}</small> : null}
    </span>
  );
};
ExpiryCell.propTypes = { date: PropTypes.string, days: PropTypes.number };
ExpiryCell.defaultProps = { date: null, days: null };

/** Policy number with the insured under it. */
export const PolicyCell = ({ policyNumber, insured, onOpen }) => (
  <span className="bv-cell-stack">
    {onOpen ? (
      <button type="button" className="bv-link-button" onClick={onOpen}>{policyNumber}</button>
    ) : <span>{policyNumber}</span>}
    {insured ? <small>{insured}</small> : null}
  </span>
);
PolicyCell.propTypes = { policyNumber: PropTypes.node, insured: PropTypes.node, onOpen: PropTypes.func };
PolicyCell.defaultProps = { policyNumber: null, insured: null, onOpen: null };
