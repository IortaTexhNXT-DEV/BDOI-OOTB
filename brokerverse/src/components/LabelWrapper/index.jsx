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
  // the label of every form (theme: 13px, semi-bold, text colour); a screen may still ask for its own size or colour
  const labelStyle = {
    ...(textSize ? { fontSize: textSize } : {}),
    ...(textColor ? { color: textColor } : {}),
    ...(textWeight ? { fontWeight: textWeight } : {}),
    margin: 0,
    padding: 0,
  };

  return (
    <div className={className}>
      <label style={labelStyle} className={["bv-field-label", classNames].filter(Boolean).join(" ")}>
        {label}
      </label>
      {required && <span className="required-marker">*</span>}
      {children}
    </div>
  );
};

export default LabelWrapper;
