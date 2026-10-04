import { Calendar } from "primereact/calendar";
import React, { useId, useState } from "react";
import "./index.scss";
import SvgCalender from "../../../assets/agentIcon/SvgCalender";
import { calendarDateFormat } from "../../../utility/dateFormat";

/**
 * Shared date picker. Dates are always shown in the configured format (System Settings general.date_format);
 * the value passed to onChange is still the Calendar's Date. The dateFormat prop is accepted for compatibility
 * but the configured format wins, so every screen shows dates the same way.
 */
const DatepickerField = ({ value, onChange, label, disabled, inputId, name, ...rest }) => {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const fieldId = inputId || `datepicker-${generatedId.replace(/:/g, "")}`;
  const { dateFormat: _ignored, ...calendarProps } = rest;

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    if (!value) {
      setFocused(false);
    }
  };

  return (
    <div style={{ position: "relative" }} className="datepicker__container">
      <div className="icon__calender">
        <SvgCalender />
      </div>
      <Calendar
        {...calendarProps}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="datepicker__field"
        onFocus={handleFocus}
        onBlur={handleBlur}
        showIcon={false}
        dateFormat={calendarDateFormat()}
        inputId={fieldId}
        name={name}
      />
      <label
        htmlFor={fieldId}
        className={`label ${focused || value ? "focused" : ""}`}
      >
        {label}
      </label>
    </div>
  );
};

export default DatepickerField;
