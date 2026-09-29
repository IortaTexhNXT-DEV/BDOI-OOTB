import * as React from "react";
const SvgLeftArrow = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <g clipPath="url(#demo_svg__a)">
      <path fill="#fff" fillOpacity={0.01} d="m12 19-7-7 7-7" />
      <path
        stroke="#111927"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 12H5m0 0 7 7m-7-7 7-7"
      />
    </g>
    <defs>
      <clipPath id="demo_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgLeftArrow;