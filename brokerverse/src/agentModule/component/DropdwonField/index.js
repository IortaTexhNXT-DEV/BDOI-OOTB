import { Dropdown } from "primereact/dropdown";
import React, { memo, useCallback, useMemo, useState } from "react";
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
}) => {
  const [focused, setFocused] = useState(false);

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

  const labelClassName = useMemo(
    () => `label ${focused || hasValue ? "focused" : ""}`,
    [focused, hasValue]
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
      />
      <label htmlFor="dropdown" className={labelClassName}>
        {label}
      </label>
    </div>
  );
};

export default memo(DropdownFieldComponent, areDropdownPropsEqual);
