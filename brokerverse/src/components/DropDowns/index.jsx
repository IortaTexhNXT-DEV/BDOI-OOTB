import React from "react";
import { Dropdown } from "primereact/dropdown";
import "../DropDowns/index.scss";
import LabelWrapper from "../LabelWrapper";
import { RecordValue, useRecordView } from "../RecordView";

// the option a value stands for: the value itself or the option whose value (optionValue, else value) matches it
const optionOf = (options, value, optionValue) => (options || []).find((o) => {
  if (o === value) return true;
  if (!o || typeof o !== "object") return false;
  const v = optionValue ? o[optionValue] : o.value;
  return v !== undefined && String(v) === String(value && typeof value === "object" ? value.value ?? value.code : value);
});

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
  // on a record view the field is the label of the chosen option as text
  const readOnly = useRecordView();
  if (readOnly) {
    const option = optionOf(options, value, optionValue);
    const shown = option && typeof option === "object" ? option[optionLabel] : option ?? value;
    return <div className={overallstyle}><RecordValue label={label} value={shown} labelKey={optionLabel} /></div>;
  }
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
        />
        </div>
        {error && <div className="formik__error">{error}</div>}
        
      </LabelWrapper>
    </div>
  );
}

export default DropDowns;
