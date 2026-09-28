import { Dropdown } from "primereact/dropdown";
import React, { useId, useState } from "react";
import "./index.scss";
import SvgDownArrow from "../../../assets/agentIcon/SvgDownArrow";

const TableDropdownField = ({ value, onChange, options, label }) => {
  const [focused, setFocused] = useState(false);
  const fieldId = `table-dropdown-${useId().replace(/:/g, "")}`;

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
  };

  return (
    <div style={{ position: "relative" }} className="table__dropdown__container">
      <Dropdown
        value={value}
        options={options}
        onChange={onChange}
        className="dropdown__field"
        onFocus={handleFocus}
        onBlur={handleBlur}
        dropdownIcon={<SvgDownArrow/>}
        inputId={fieldId}
        // placeholder={focused ? '' : label}
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

export default TableDropdownField;