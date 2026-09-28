import { InputText } from "primereact/inputtext";
import React, { useId } from "react";
import "./index.scss";

const CalculaitionTextInputs = ({ value, label }) => {
  const fieldId = `calc-input-${useId().replace(/:/g, "")}`;
  return (
    <div className="calculaition__inputfield__container">
      <div style={{ position: "relative" }}>
        <InputText
        //   value={value}
        //   onChange={onChange}
          id={fieldId}
          className="input__field"
          disabled={true}
        />
        <label htmlFor={fieldId} className="label">
          {label}
        </label>
        <div className="input__value">{value}</div>
      </div>
    </div>
  );
};

export default CalculaitionTextInputs;
