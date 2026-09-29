import * as React from "react";
const SvgFilter = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <path
      fill="#6366F1"
      d="M1.125 4.5h21.75a1.125 1.125 0 0 1 0 2.25H1.125a1.125 1.125 0 0 1 0-2.25ZM4.5 11.625A1.125 1.125 0 0 1 5.625 10.5h12.75a1.125 1.125 0 1 1 0 2.25H5.625A1.125 1.125 0 0 1 4.5 11.625Zm4.5 6a1.125 1.125 0 0 1 1.125-1.125h3.75a1.125 1.125 0 1 1 0 2.25h-3.75A1.125 1.125 0 0 1 9 17.625Z"
    />
  </svg>
);
export default SvgFilter;