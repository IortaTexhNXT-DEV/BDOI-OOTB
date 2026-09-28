import * as React from "react";
const SvgBackArrow = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <path
      fill="#111927"
      d="M17.227 3.687A.999.999 0 0 0 16.472 2a1 1 0 0 0-.699.313l-8.5 9a1 1 0 0 0 0 1.374l8.5 9.001a1 1 0 1 0 1.454-1.373L9.375 12z"
    />
  </svg>
);
export default SvgBackArrow;