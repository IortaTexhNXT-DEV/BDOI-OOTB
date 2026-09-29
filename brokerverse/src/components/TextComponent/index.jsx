import React from "react";
// import * as Color from "../../TextColor";

const TextComponent = ({
  children,
  isBold,
  alignment,
  fontSizes,
  isUnderline,
  isItalic,
  classNames,
  inlineHeight,
  color,
}) => {
  const textStyle = {
    fontWeight: isBold || "",
    textAlign: alignment || "left",
    color: color,
    fontSize: fontSizes,
    textDecoration: isUnderline ? "underline" : "none",
    fontStyle: isItalic ? "italic" : "normal",
    inlineHeight: inlineHeight,
  };
  return (
    <div style={textStyle} className={classNames}>
      {children}
    </div>
  );
};

export default TextComponent;
