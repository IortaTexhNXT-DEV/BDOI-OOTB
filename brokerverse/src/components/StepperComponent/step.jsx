import React from "react";
import "./step.scss";

const Steps = ({ activeIndex, stepperLength, formNameData }) => {
  const handleComplete = (index, text) => {
    if (activeIndex > index) return "step-bg";
    else return "step-bg-text";
  };

  const ruler = (index) => {
    return "some-class-name";
  };

  return (
    <div className="step-container">
      <div className="flex flex-column row-gap-2">
        <div className="flex align-items-center">
          {stepperLength.map((step, index) => (
            <>
              {index !== 0 && (
                <hr
                  className={`step-divider ${ruler(index)} ${
                    activeIndex >= index
                      ? "step-divider-active"
                      : "step-divider-active-insctive"
                  }`}
                />
              )}
              <div key={index}>
                <div className="step flex flex-column align-items-center justify-content-center">
                  <div
                    className={`step-number steping ${handleComplete(
                      index,
                      step
                    )} ${activeIndex === index ? "activeBorder" : "border"}`}
                  >
                    {Boolean(activeIndex === index) ? (
                      <p
                        className={`${
                          activeIndex === index ? "step-numbers" : "step-number"
                        }`}
                      >
                        {formNameData}
                      </p>
                    ) : (
                      <div className="semiCircle">{step}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Steps;
