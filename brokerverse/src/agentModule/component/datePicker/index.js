import { Calendar } from "primereact/calendar";
import React, { useState } from "react";
import "./index.scss";
import SvgCalender from "../../../assets/agentIcon/SvgCalender";

const DatepickerField = ({ value, onChange, label, disabled, dateFormat }) => {
  const [focused, setFocused] = useState(false);

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
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="datepicker__field"
        onFocus={handleFocus}
        onBlur={handleBlur}
        showIcon={false}
        dateFormat={dateFormat}
        inputId="datepicker-input"
      />
      <label
        htmlFor="datepicker-input"
        className={`label ${focused || value ? "focused" : ""}`}
      >
        {label}
      </label>
    </div>
  );
};

export default DatepickerField;
