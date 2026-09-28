import React from "react";
import "./index.scss";
import { Password } from "primereact/password";
import LabelWrapper from "../LabelWrapper";

const PasswordField = ({
  value,
  onChange,
  name,
  placeholder,
  label,
  required,
  error,
  textColor,
  textSize,
  fontweight,
}) => {
  return (
    <div className="password__block">
      <LabelWrapper
        textSize={textSize}
        textColor={textColor}
        label={label}
        fontweight={fontweight}
      >
        {required && <span className="required__label">*</span>}
        <Password
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          feedback={false}
          toggleMask
          className="password__field"
        />
        {error && <div className="formik__error">{error}</div>}
      </LabelWrapper>
    </div>
  );
};

export default PasswordField;
