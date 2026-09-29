import * as React from "react";
const SvgUpload = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={16}
    height={16}
    fill="none"
    {...props}
  >
    <path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3.75 2.75h9m-8.5 6.5 4-3.5m0 0 4 3.5m-4-3.5v8.5"
    />
  </svg>
);
export default SvgUpload;