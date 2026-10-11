/**
 * Why the signed-in user cannot decide a record, as one neutral line (never a disabled button): the server's
 * blockedReason and, when known, who can decide it instead.
 *
 *   <EligibilityNote reason={decision.blockedReason} approvers={decision.eligibleApprovers} />
 *   -> "You submitted this remittance. Another user with remittance authority must approve it. · Can decide: J. Cruz, A. Tan"
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import "./eligibilityNote.scss";

const EligibilityNote = ({ id, reason, approvers, className }) => {
  const { t } = useTranslation();
  const names = (approvers || []).map((a) => a?.name).filter(Boolean);
  if (!reason && !names.length) return null;
  return (
    <p id={id || undefined} className={["bv-eligibility", className].filter(Boolean).join(" ")} role="note">
      <i className="pi pi-info-circle bv-eligibility__icon" aria-hidden="true" />
      <span className="bv-eligibility__text">
        {reason ? <span className="bv-eligibility__reason">{reason}</span> : null}
        {names.length ? <span className="bv-eligibility__approvers">{t("eligibilityNote.approvers", { names: names.join(", ") })}</span> : null}
      </span>
    </p>
  );
};

EligibilityNote.propTypes = {
  /** id of the line, for the aria-describedby of the buttons it explains */
  id: PropTypes.string,
  /** the server's blockedReason ("PHP 409,141.43 is above your approval limit of PHP 250,000.00.") */
  reason: PropTypes.node,
  /** eligibleApprovers of the decision: [{ id, name, role, limit }] */
  approvers: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), name: PropTypes.string })),
  className: PropTypes.string,
};

EligibilityNote.defaultProps = { id: null, reason: null, approvers: [], className: null };

export default EligibilityNote;
