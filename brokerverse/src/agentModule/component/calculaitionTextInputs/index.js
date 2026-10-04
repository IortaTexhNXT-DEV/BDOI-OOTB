import { InputText } from "primereact/inputtext";
import React, { useId } from "react";
import { formatNumber } from "../../../utility/currencyConverter";
import "./index.scss";

const NUMERIC = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;

/**
 * Read-only amount for display: a plain number ("28005.00", 1200000) gets the configured
 * thousands grouping (28,005.00) and keeps its own number of decimals. Anything else
 * (rates with %, "-", text) is shown as given. The caller's value itself is never changed.
 */
export const displayAmount = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value).trim();
  if (!NUMERIC.test(text)) return value;
  const decimals = text.includes(".") ? text.split(".")[1].length : 0;
  return formatNumber(text, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const CalculaitionTextInputs = ({ value, label, raw = false }) => {
  const fieldId = `calc-input-${useId().replace(/:/g, "")}`;
  return (
    <div className="calculaition__inputfield__container">
      <div style={{ position: "relative" }}>
        <InputText id={fieldId} className="input__field" disabled={true} />
        <label htmlFor={fieldId} className="label">
          {label}
        </label>
        <div className="input__value">{raw ? value : displayAmount(value)}</div>
      </div>
    </div>
  );
};

export default CalculaitionTextInputs;
