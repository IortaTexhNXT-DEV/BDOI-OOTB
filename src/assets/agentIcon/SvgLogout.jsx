import * as React from "react";
const SvgLogOut = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <path
      fill="#fff"
      fillOpacity={0.01}
      d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9"
    />
    <path
      stroke="#111927"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 2v8.462m6.154-6.345a10 10 0 1 1-12.308 0"
    />
  </svg>
);
export default SvgLogOut;