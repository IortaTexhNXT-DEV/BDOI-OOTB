import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * Message shown next to the Next / Save button when a step cannot go on: the fields still to complete (the field
 * messages may be scrolled out of view) and the reason the server gave.
 */
const FormErrorSummary = ({ errors, labels, show, serverError }) => {
  const { t } = useTranslation();
  const missing = show
    ? Object.keys(errors || {})
        .filter((k) => errors[k])
        .map((k) => (labels?.[k] ? `${labels[k]}: ${errors[k]}` : errors[k]))
    : [];
  if (!missing.length && !serverError) return null;
  return (
    <div className="claim-journey__errors" role="alert">
      {missing.length > 0 && (
        <>
          <div className="claim-journey__errors-title">{t("claimJourney.completeFields")}</div>
          <ul>
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      {serverError && (
        <div className="claim-journey__errors-server">
          <span className="claim-journey__errors-title">{t("claimJourney.notSaved")}</span> {serverError}
        </div>
      )}
    </div>
  );
};

FormErrorSummary.propTypes = {
  errors: PropTypes.object,
  labels: PropTypes.object,
  show: PropTypes.bool,
  serverError: PropTypes.string,
};

export default FormErrorSummary;
