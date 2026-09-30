import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Message } from "primereact/message";

/**
 * Why a step could not be saved, shown on the step itself next to its buttons: the server's message and, when it
 * names fields, one line per field.
 */
const StepErrors = ({ error }) => {
  const { t } = useTranslation();
  if (!error) return null;
  const lines = (error.errors || []).map((e) => e.message).filter(Boolean);
  const content = (
    <div>
      <strong className="block">{t("stepErrors.title")}</strong>
      {lines.length > 1 ? (
        <ul className="m-0 mt-1 pl-3">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <span>{lines[0] || error.message}</span>
      )}
    </div>
  );
  return <Message severity="error" className="w-full justify-content-start mt-3" content={content} />;
};

StepErrors.propTypes = {
  error: PropTypes.shape({ message: PropTypes.string, errors: PropTypes.arrayOf(PropTypes.shape({ path: PropTypes.string, message: PropTypes.string })) }),
};

export default StepErrors;
