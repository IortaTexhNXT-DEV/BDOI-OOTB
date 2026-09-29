import * as React from "react";
const SvgFrame = (props) => (
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
      d="M14 14.994a6.3 6.3 0 1 0-5.4 0v.606c0 .839 0 1.258.137 1.589a1.8 1.8 0 0 0 .974.974c.331.137.75.137 1.589.137s1.258 0 1.589-.137a1.802 1.802 0 0 0 .974-.974c.137-.331.137-.75.137-1.589v-.606Z"
    />
    <path
      stroke="#6C737F"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9.05 21h4.5M9.5 10.2h3.6m-1.8 0v5.4m2.7-.606a6.3 6.3 0 1 0-5.4 0v.606c0 .839 0 1.258.137 1.589a1.8 1.8 0 0 0 .974.974c.331.137.75.137 1.589.137s1.258 0 1.589-.137a1.802 1.802 0 0 0 .974-.974c.137-.331.137-.75.137-1.589v-.606Z"
    />
  </svg>
);
export default SvgFrame;