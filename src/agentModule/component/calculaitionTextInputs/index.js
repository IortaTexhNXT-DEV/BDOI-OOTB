import { InputText } from "primereact/inputtext";
import React from "react";
import "./index.scss";

const CalculaitionTextInputs = ({ value, label }) => {
  return (
    <div className="calculaition__inputfield__container">
      <div style={{ position: "relative" }}>
        <InputText
        //   value={value}
        //   onChange={onChange}
          className="input__field"
          disabled={true}
        />
        <label htmlFor="input" className="label">
          {label}
        </label>
        <div className="input__value">{value}</div>
      </div>
    </div>
  );
};

export default CalculaitionTextInputs;
