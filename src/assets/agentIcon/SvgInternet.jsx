import * as React from "react";
const SvgInternet = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <g clipPath="url(#internet_svg__a)">
      <path
        fill="#6366F1"
        d="M17.361 2.278H7.64A1.389 1.389 0 0 0 6.25 3.667v16.666a1.39 1.39 0 0 0 1.389 1.39h9.722a1.39 1.39 0 0 0 1.389-1.39V3.667a1.389 1.389 0 0 0-1.389-1.39Zm-4.167 18.055h-1.388v-1.388h1.388v1.388ZM7.64 17.556V3.666h9.722v13.89H7.64Z"
      />
    </g>
    <defs>
      <clipPath id="internet_svg__a">
        <path fill="#fff" d="M0-.5h25v25H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgInternet;