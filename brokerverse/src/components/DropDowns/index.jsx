import React from "react";
import { Dropdown } from "primereact/dropdown";
import "../DropDowns/index.scss";
import LabelWrapper from "../LabelWrapper";

function DropDowns({
  className,
  options,
  placeholder,
  label,
  optionLabel = "name",
  optionValue,
  value,
  required,
  onChange,
  onFilter,
  filterValue,
  error,
  textSize,
  textColor,
  classNames,
  overallstyle,
  textWeight,
  disabled,
  dropdownIcon,
  defaultValue
}) {
  return (
    <div className={overallstyle}>
      <LabelWrapper
        textSize={textSize}
        textWeight={textWeight}
        textColor={textColor}
        classNames={classNames}
        label={label}
      >
        {required && <span className="required__label">*</span>}
        <div className="custom__dropdown__controller__over">
        <Dropdown
          value={value}
          onChange={onChange}
          onFilter={onFilter}
          filterValue={filterValue}
          options={options}
          optionLabel={optionLabel}
          placeholder={placeholder}
          className={className}
          optionValue={optionValue}
          disabled={disabled}
          filter
          dropdownIcon={dropdownIcon}
          defaultValue={defaultValue}
          style={{
            borderRadius:10
          }}
        />
        </div>
        {error && <div className="formik__error">{error}</div>}
        
      </LabelWrapper>
    </div>
  );
}

export default DropDowns;
