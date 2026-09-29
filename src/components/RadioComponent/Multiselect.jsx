import React, { useState } from "react";
import { Checkbox } from "primereact/checkbox";
import "./index.scss";
import { options } from "./mock";

function MultipleSelectRadioGroup({
  options,
  onChange,
  selectedValues = [],
  border,
  labelColor,
  isDisabled,
  isRequired,
}) {
  const handleOptionChange = (optionValue, checked) => {
    const updatedValues = [...selectedValues];

    if (checked) {
      // Add to selection if not already present
      if (!updatedValues.includes(optionValue)) {
        updatedValues.push(optionValue);
      }
    } else {
      // Remove from selection
      const index = updatedValues.indexOf(optionValue);
      if (index > -1) {
        updatedValues.splice(index, 1);
      }
    }

    onChange(updatedValues);
  };

  const style = {};

  if (border) {
    style.border = "2px solid #FFFF00";
  }

  if (labelColor) {
    style.color = "red";
  }

  return (
    <div className="multi-select-container">
      {options.map((option) => {
        const isChecked = selectedValues.includes(option.value);
        return (
          <div key={option.value} className="p-field-checkbox" style={style}>
            <Checkbox
              inputId={option.value}
              name={option.name}
              value={option.value}
              onChange={(e) => handleOptionChange(option.value, e.checked)}
              checked={isChecked}
              disabled={isDisabled}
              required={isRequired}
            />
            <label className="label__wrapper" htmlFor={option.value}>
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [selectedValues, setSelectedValues] = useState([]);

  const handleSelectionChange = (selectedValues) => {
    setSelectedValues(selectedValues);
  };

  return (
    <div>
      <h2>Multiple Select Radio Buttons</h2>
      <MultipleSelectRadioGroup
        options={options}
        onChange={handleSelectionChange}
        selectedValues={selectedValues}
        border={false}
        labelColor={false}
        isDisabled={false}
        isChecked={true}
        isRequired={false}
      />
      <div className="selected__value">
        Selected Values: {selectedValues.join(", ")}
      </div>
    </div>
  );
}

export { MultipleSelectRadioGroup };
