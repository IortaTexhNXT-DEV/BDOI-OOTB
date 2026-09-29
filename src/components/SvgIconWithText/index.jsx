import React from "react";

const SvgIconWithText = ({ icon, text, classNames, onClick }) => {
  return (
    <div className={classNames}>
      <div onClick={onClick}>{icon}</div>
      <span>{text}</span>
    </div>
  );
};
export default SvgIconWithText;
