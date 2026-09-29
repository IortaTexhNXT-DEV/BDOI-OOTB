import React, { useState } from "react";
import { InputSwitch } from "primereact/inputswitch";
import "./index.scss";

export default function BasicDemo() {
  const [checked, setChecked] = useState(false);

  const handleSwitchClick = (e) => {
    console.log("Switch clicked");
  };

  const handleSwitchBlur = (e) => {
    console.log("Switch blurred");
  };
const checking =`${checked ? 'custom-checked' : "customStyle"}`
  return (
    <div className="card flex justify-content-center">
      <InputSwitch
        className={checking} 
        checked={checked}
        onChange={(e) => setChecked(e.value)}
        onClick={handleSwitchClick}
        onBlur={handleSwitchBlur}
        onLabel="On"
        offLabel="Off"
        size="small"
        name="customSwitch"
      />
    </div>
  );
}
