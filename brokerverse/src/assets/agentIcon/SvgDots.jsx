import * as React from "react";
const SvgDots = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={4}
    height={4}
    fill="none"
    {...props}
  >
    <circle cx={2} cy={2} r={2} fill="#6C737F" />
  </svg>
);
export default SvgDots;