import React, { useState } from "react";
import { Calendar } from "primereact/calendar";
import "./index.scss";
import LabelWrapper from "../LabelWrapper";

const DatePicker = ({
  id,
  name,
  className,
  dateFormat,
  numberOfMonths,
  hourFormat,
  label,
  required,
  placeholder,
  calendarDate = false,
}) => {
  const [date, setDate] = useState(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);

  const mindate = calendarDate ? null : today;
  const maxdate = calendarDate ? null : maxDate;

  const handleChange = (e) => {
    if (calendarDate === false) {
      setDate(e.value);
    } else {
    }
  };
  return (
    <div className="calendar__conTainer ">
      <LabelWrapper textSize={true} textColor={false} label={label}>
        {required && <span className="required__label">*</span>}
        <Calendar
          id={id}
          name={name}
          value={calendarDate ? date : ""}
          onChange={handleChange}
          className={className}
          dateFormat={dateFormat}
          numberOfMonths={numberOfMonths}
          minDate={mindate}
          maxDate={maxdate}
          hourFormat={hourFormat || "24"}
          showIcon
          required
          placeholder={placeholder}
        />
      </LabelWrapper>
    </div>
  );
};
export default DatePicker;
