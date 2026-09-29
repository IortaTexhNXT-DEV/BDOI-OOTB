import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import "./index.scss";

const InputNumberField = ({ value, onValueChange, label, disabled, inputId }) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    if (value === null || value === undefined || value === "") {
      setFocused(false);
    }
  };

  const hasValue =
    value !== null && value !== undefined && value !== "";

  return (
    <div
      style={{ position: "relative" }}
      className={`inputfield__container ${
        focused ? "inputfield__container__changed" : ""
      }`}
    >
      <InputNumber
        inputId={inputId}
        value={value}
        onValueChange={onValueChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-full"
      />
      <label
        htmlFor={inputId}
        className={`label ${focused || hasValue ? "focused" : ""}`}
      >
        {label}
      </label>
    </div>
  );
};

export default InputNumberField;
