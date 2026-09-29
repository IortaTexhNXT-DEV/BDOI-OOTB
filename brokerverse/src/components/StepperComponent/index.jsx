import React, { useState } from "react";
import Steps from "./step";

function StepperComponent({ stepperCount, formName, activeIndexValue }) {
  const n = stepperCount ? stepperCount : 6;
  const formNameData = formName ? formName : "step 1";
  const activeIndex = activeIndexValue ? activeIndexValue : 0;
  const stepperLength = Array.from({ length: n }, (_, index) => index + 1);

  console.log(stepperLength);
  return (
    <div className="round-steps">
      <div className="grid stepper__main__ container">
        <div className="col-12">
          <Steps
            stepperLength={stepperLength}
            activeIndex={activeIndex}
            formNameData={formNameData}
          />
        </div>
      </div>
    </div>
  );
}

export default StepperComponent;
