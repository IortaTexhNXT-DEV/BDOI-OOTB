import React, { useId, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import "./index.scss";

/**
 * Active / Inactive switch. Controlled when `isChecked` is given: the switch shows that value and `onChange` decides
 * (ask for a confirmation, save, reload); without it the switch keeps its own state.
 *
 *   <ToggleButton isChecked={row.status === "Active"} onChange={() => handleStatusChange(row)} />
 */
const ToggleButton = ({ id, isChecked, onChange, disabled }) => {
  const { t } = useTranslation();
  const ownId = useId();
  const [own, setOwn] = useState(true);
  const controlled = isChecked !== undefined && isChecked !== null;
  const checked = controlled ? !!isChecked : own;
  const inputId = `toggle-${id ?? ownId}`;

  const handleToggle = () => {
    if (disabled) return;
    if (!controlled) setOwn(!own);
    if (onChange) onChange(!checked);
  };

  return (
    <div className="toggle__container">
      <label htmlFor={inputId} className="toggle">
        <input type="checkbox" id={inputId} className="input" checked={checked} disabled={disabled} onChange={handleToggle} />
        <div className="toggle-wrapper">
          <span className={`inactive-text ${!checked ? "active" : ""}`}>{t("masterStatus.active")}</span>
          <span className={`active-text ${checked ? "active" : ""}`}>{t("masterStatus.inactive")}</span>
          <span className="selector"></span>
        </div>
      </label>
    </div>
  );
};

ToggleButton.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isChecked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

ToggleButton.defaultProps = { id: null, isChecked: undefined, onChange: null, disabled: false };

export default ToggleButton;
