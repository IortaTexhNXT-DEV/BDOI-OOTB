import * as React from "react";
const SvgProfile = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <g clipPath="url(#demo_svg__a)">
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
        d="M3 20c2.336-2.477 5.507-4 9-4 3.493 0 6.664 1.523 9 4M16.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0"
      />
    </g>
    <defs>
      <clipPath id="demo_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgProfile;