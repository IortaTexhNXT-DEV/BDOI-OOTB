import * as React from "react";
const SvgCollected = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={62}
    height={62}
    fill="none"
    {...props}
  >
    <circle cx={31} cy={31} r={31} fill="#FFFAEB" />
    <path
      fill="#fff"
      fillOpacity={0.01}
      d="M31 41.332c6.42 0 11.625-5.205 11.625-11.625S37.42 18.082 31 18.082s-11.625 5.205-11.625 11.625S24.58 41.332 31 41.332Z"
    />
    <path fill="#fff" fillOpacity={0.01} d="M31 22.734v6.975l4.65 2.325" />
    <path
      stroke="#F7900A"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M31.5 26.1v5.4l3.6 1.8m5.4-1.8a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);
export default SvgCollected;