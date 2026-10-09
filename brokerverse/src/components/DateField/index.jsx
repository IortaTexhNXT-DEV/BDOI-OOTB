import React from "react";
import PropTypes from "prop-types";
import { Calendar } from "primereact/calendar";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";

/**
 * A date field like every other in the application: the calendar of the component library in the configured date
 * format (dd/mm/yyyy by default) with its calendar button, in place of the browser's date input whose look and
 * format depend on the browser. The value stays an ISO YYYY-MM-DD text, and onChange receives an input-like event
 * ({ target: { name, id, value } }), so it replaces <input type="date"> without changing the form code.
 */
const DateField = ({ id, name, value, onChange, min, max, className, placeholder, disabled = false, invalid = false, ...rest }) => {
  const change = (e) => {
    const iso = e.value ? toIsoDate(e.value) : "";
    onChange({ target: { name, id, value: iso, type: "text" }, persist: () => {} });
  };
  return (
    <Calendar
      inputId={id}
      name={name}
      value={toDate(value)}
      onChange={change}
      dateFormat={calendarDateFormat()}
      minDate={toDate(min) || undefined}
      maxDate={toDate(max) || undefined}
      showIcon
      showButtonBar
      placeholder={placeholder}
      disabled={disabled}
      className={["w-full", className, invalid ? "p-invalid" : ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
};

DateField.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  onChange: PropTypes.func.isRequired,
  min: PropTypes.string,
  max: PropTypes.string,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  invalid: PropTypes.bool,
};

export default DateField;
