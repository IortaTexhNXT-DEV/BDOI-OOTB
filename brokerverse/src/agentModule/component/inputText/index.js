import { InputText } from "primereact/inputtext";
import React, { useId, useState } from "react";
import "./index.scss";

const InputTextField = ({
  value,
  onChange,
  label,
  disabled,
  error,
  hint,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const fieldId = rest.id || rest.inputId || `input-${generatedId.replace(/:/g, "")}`;
  const { inputId: _inputId, ...inputProps } = rest;

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = (e) => {
    if (!e.target.value) {
      setFocused(false);
    }
    rest.onBlur?.(e);
  };

  return (
    <div
      style={{ position: "relative" }}
      className={`inputfield__container ${
        focused ? "inputfield__container__changed" : ""
      }`}
    >
      <InputText
        value={value}
        onChange={onChange}
        className="input__field"
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        {...inputProps}
        id={fieldId}
      />
      <label
        htmlFor={fieldId}
        className={`label ${focused || value !== "" ? "focused" : ""}`}
      >
        {label}
      </label>
      {hint && (
        <div
          id={`${fieldId}-hint`}
          className="input__hint"
          style={{ color: "var(--text-color-secondary)", fontSize: "12px", marginTop: "4px" }}
        >
          {hint}
        </div>
      )}
      {error && (
        <div
          className="formik__error"
          style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default InputTextField;
