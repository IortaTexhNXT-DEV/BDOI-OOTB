import React from "react";
import "./index.scss";
import { InputText } from "primereact/inputtext";
import LabelWrapper from "../LabelWrapper";

const Search = ({
  placeholder,
  classNames,
  label,
  name,
  type = "text",
  value,
  onChange,
  disabled,
  error,
}) => {
  return (
    <div className="search__block">
      <LabelWrapper textSize={true} textColor={false} label={label}>
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            name={name}
            value={value}
            onChange={onChange}
            type={type}
            placeholder={placeholder}
            className={classNames}
            disabled={disabled}
          />
        </span>
        {error && <div className="formik__error">{error}</div>}
      </LabelWrapper>
    </div>
  );
};

export default Search;
