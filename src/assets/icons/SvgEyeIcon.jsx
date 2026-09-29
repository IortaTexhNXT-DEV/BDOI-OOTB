import * as React from "react";
const SvgEyeIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <path
      stroke="#6C737F"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"
    />
    <path
      stroke="#6C737F"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M1.664 10.001c1.333-3.414 4.447-5.833 8.333-5.833 3.887 0 7 2.42 8.334 5.833-1.334 3.415-4.447 5.834-8.334 5.834-3.886 0-7-2.42-8.333-5.834"
    />
  </svg>
);
export default SvgEyeIcon;