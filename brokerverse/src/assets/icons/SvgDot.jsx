import * as React from "react";
const SvgDot = ({ color }) => (
  <svg width={8} height={8} fill="none">
    <circle cx={3} cy={3} r={3} fill={color} />
  </svg>
);
export default SvgDot;
