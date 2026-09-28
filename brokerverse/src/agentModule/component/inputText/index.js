import { InputText } from "primereact/inputtext";
import React, { useState } from "react";
import "./index.scss";

const InputTextField = ({
  value,
  onChange,
  label,
  disabled,
  error,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

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
        {...rest}
      />
      <label
        htmlFor="input"
        className={`label ${focused || value !== "" ? "focused" : ""}`}
      >
        {label}
      </label>
      {error && (
        <div
          className="formik__error"
          style={{ color: "red", fontSize: "12px", marginTop: "4px" }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default InputTextField;
