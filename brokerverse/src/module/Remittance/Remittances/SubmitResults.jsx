import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";

/** The outcome of a submission, one line per remittance: "Submitted" or the reason it was not. */
const SubmitResults = ({ out, onClose }) => {
  const { t } = useTranslation();
  if (!out) return null;
  const results = out.results || [];
  return (
    <div className="rm-results" role="status">
      <div className="rm-results__head">
        <strong>{t("remittance.list.submit.results", { submitted: results.filter((r) => r.ok).length, refused: results.filter((r) => !r.ok).length })}</strong>
        {onClose ? <Button type="button" label={t("remittance.common.close")} text size="small" onClick={onClose} /> : null}
      </div>
      <ul>
        {results.map((r) => (
          <li key={r.id} className={r.ok ? "rm-results__ok" : "rm-results__refused"}>
            <span className="rm-ref">{r.reference || r.id}</span>
            <span>{r.ok ? t("remittance.list.submit.submitted") : r.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

SubmitResults.propTypes = {
  /** the answer of POST /remittance/remittances/submit: { results: [{ id, reference, ok, message }] } */
  out: PropTypes.shape({ results: PropTypes.arrayOf(PropTypes.object) }),
  onClose: PropTypes.func,
};

SubmitResults.defaultProps = { out: null, onClose: null };

export default SubmitResults;
