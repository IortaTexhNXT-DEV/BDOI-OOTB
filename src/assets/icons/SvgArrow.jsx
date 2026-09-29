import * as React from "react";
const SvgArrow = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={21}
    height={20}
    fill="none"
    {...props}
  >
    <path
      fill="#6C737F"
      d="M9.4 3.4 15 9H2.8v2H15l-5.6 5.6 1.4 1.4 8-8-8-8-1.4 1.4Z"
    />
  </svg>
);
export default SvgArrow;