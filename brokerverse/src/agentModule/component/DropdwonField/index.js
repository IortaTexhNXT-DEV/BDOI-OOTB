import { Dropdown } from "primereact/dropdown";
import React, { memo, useCallback, useId, useMemo, useState } from "react";
import "./index.scss";
import SvgDownArrow from "../../../assets/agentIcon/SvgDownArrow";

const isEqualOption = (prevOption, nextOption) => {
  if (prevOption === nextOption) {
    return true;
  }

  if (
    prevOption === null ||
    nextOption === null ||
    typeof prevOption !== "object" ||
    typeof nextOption !== "object"
  ) {
    return false;
  }

  const prevKeys = Object.keys(prevOption);
  const nextKeys = Object.keys(nextOption);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  return prevKeys.every((key) => prevOption[key] === nextOption[key]);
};

const areOptionsEqual = (prevOptions = [], nextOptions = []) => {
  if (prevOptions === nextOptions) {
    return true;
  }

  if (!Array.isArray(prevOptions) || !Array.isArray(nextOptions)) {
    return false;
  }

  if (prevOptions.length !== nextOptions.length) {
    return false;
  }

  for (let index = 0; index < prevOptions.length; index += 1) {
    if (!isEqualOption(prevOptions[index], nextOptions[index])) {
      return false;
    }
  }

  return true;
};

const areDropdownPropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.label === nextProps.label &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.optionLabel === nextProps.optionLabel &&
    prevProps.optionValue === nextProps.optionValue &&
    prevProps.inputId === nextProps.inputId &&
    prevProps.onChange === nextProps.onChange &&
    areOptionsEqual(prevProps.options, nextProps.options)
  );
};

const DropdownFieldComponent = ({
  value,
  onChange,
  options,
  label,
  placeholder,
  disabled,
  optionLabel,
  optionValue = "value",
  inputId,
}) => {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const fieldId = inputId || `dropdown-${generatedId.replace(/:/g, "")}`;

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const optionsToRender = useMemo(() => options ?? [], [options]);

  const containerClassName = useMemo(
    () =>
      `dropdown__container ${focused ? "dropdown__container__changed" : ""}`,
    [focused]
  );

  const hasValue =
    value !== undefined && value !== null && value !== "" && value !== false;

  // A placeholder occupies the field, so the label sits above it (floated) instead of on top of it.
  const floatLabel = focused || hasValue || !!placeholder;
  const labelClassName = useMemo(
    () => `label ${floatLabel ? "focused" : ""}`,
    [floatLabel]
  );

  return (
    <div style={{ position: "relative" }} className={containerClassName}>
      <Dropdown
        value={value}
        options={optionsToRender}
        onChange={onChange}
        className="dropdown__field"
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        dropdownIcon={<SvgDownArrow />}
        optionLabel={optionLabel}
        optionValue={optionValue}
        placeholder={placeholder}
        inputId={fieldId}
      />
      <label htmlFor={fieldId} className={labelClassName}>
        {label}
      </label>
    </div>
  );
};

export default memo(DropdownFieldComponent, areDropdownPropsEqual);
