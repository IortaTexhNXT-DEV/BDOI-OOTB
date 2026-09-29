import React from "react";

const LabelWrapper = ({
  label,
  children,
  textSize,
  textColor,
  required,
  className,
  classNames,
  textWeight,
}) => {
  const labelStyle = {
    fontSize: textSize ? textSize : "16px",
    color: textColor ? textColor : "black",
    fontFamily: 'Inter, sans-serif',
    fontWeight: textWeight ? textWeight : 500,
    margin:0,
    padding:0
  };

  return (
    <div className={className}>
      <label style={labelStyle} className={classNames}>
        {label}
      </label>
      {required && <span className="required-marker">*</span>}
      {children}
    </div>
  );
};

export default LabelWrapper;
