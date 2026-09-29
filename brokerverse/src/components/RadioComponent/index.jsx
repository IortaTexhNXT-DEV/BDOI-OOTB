import React from "react";
import { RadioButton } from "primereact/radiobutton";
import "./index.scss";

function RadioButtonComponent({
  setValue,
  onChange,
  value,
  name,
  checked,
  label,
  disabled,
  required,
  hasBorderColor,
  hasBackgroundColor,
  className,
  labelClassName,
}) {
  const containerClassName = `radio-button-container ${
    hasBorderColor ? "border-color" : ""
  }`;
  // const labelClassName = `radio-button-label ${hasBackgroundColor ? 'background-color' : ''}`;
  // const [selectedIngredients, setSelectedIngredients] = useState([]);

  // const handleIngredientChange = (e) => {
  //   const value = e.target.value;
  //   if (selectedIngredients.includes(value)) {
  //     setSelectedIngredients(
  //       selectedIngredients.filter((item) => item !== value)
  //     );
  //   } else {
  //     setSelectedIngredients([...selectedIngredients, value]);
  //   }
  // };

  return (
    <div className={containerClassName}>
      <div className="radiobutton__content">
        <RadioButton
          inputId={name}
          name={name}
          value={value}
          onChange={onChange}
          checked={checked}
          disabled={disabled}
          required={required}
          setValue={setValue}
          className={className}
        />
        <label htmlFor={name} className={labelClassName}>
          {label}
        </label>
      </div>
    </div>
  );
}

export default RadioButtonComponent;
