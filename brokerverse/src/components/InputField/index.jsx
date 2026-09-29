import React from "react";
import "./index.scss";
import { InputText } from "primereact/inputtext";
import LabelWrapper from "../LabelWrapper";

const InputField = ({
  placeholder,
  classNames,
  label,
  name,
  type = "text",
  value,
  onChange,
  disabled,
  required = false,
  error,
  textSize,
  textColor,
  className,
  textWeight,
  length,
}) => {
  return (
    <div className="input__block">
      <LabelWrapper
        textSize={textSize}
        textWeight={textWeight}
        textColor={textColor}
        classNames={className}
        label={label}
        
      >
        {required && <span className="required__label">*</span>}

        <InputText
          name={name}
          value={value}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          className={classNames}
          disabled={disabled}
          maxLength={length || 100}
          style={{
            borderRadius:10
          }}
        />
        {error && <div className="formik__error">{error}</div>}
      </LabelWrapper>
    </div>
  );
};

export default InputField;
