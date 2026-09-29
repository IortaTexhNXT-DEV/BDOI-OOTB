import { AutoComplete } from "primereact/autocomplete";
import React, { useState } from "react";
import "./index.scss";

const InputAutocomplete = ({ value, suggestions, completeMethod, onSelect, label, disabled }) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = (e) => {
    if (!e.target.value) {
      setFocused(false);
    }
  };

  return (
    <div
      style={{ position: "relative" }}
      className={`inputfield__container ${
        focused ? "inputfield__container__changed" : ""
      }`}
    >
      <AutoComplete
        value={value}
        suggestions={suggestions}
        completeMethod={completeMethod}
        onChange={(e) => onSelect(e.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        style={{ width: '100%' }}
        inputStyle={{
          height: '69px',
          paddingTop: '30px',
          fontSize: '16px',
          fontWeight: '500',
          fontFamily: 'Poppins',
          lineHeight: '24px',
          color: focused ? '#11845F' : '#111927',
          borderRadius: '10px',
          border: focused ? '1px solid #11845F' : '1px solid #E5E7EB',
          boxShadow: focused ? '0 0 0 0.1rem #E5E7EB' : 'none',
          outline: 'none',
        }}
      />
      <label htmlFor="input" className={`label ${focused ? "focused" : ""}`}>
        {label}
      </label>
    </div>
  );
};

export default InputAutocomplete;
