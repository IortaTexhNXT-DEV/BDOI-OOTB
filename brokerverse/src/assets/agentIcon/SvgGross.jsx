import * as React from "react";
const SvgGross = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={62}
    height={62}
    fill="none"
    {...props}
  >
    <circle cx={31} cy={31} r={31} fill="#E5E7EB" />
    <path
      fill="#fff"
      fillOpacity={0.01}
      stroke="#111927"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.667 25.575c0-2.17 0-3.255.422-4.084a3.875 3.875 0 0 1 1.694-1.694c.829-.422 1.914-.422 4.084-.422h8.267c2.17 0 3.255 0 4.084.422.729.372 1.322.965 1.693 1.694.423.829.423 1.914.423 4.084v17.05l-3.552-2.583-3.23 2.583L31 40.042l-3.552 2.583-3.229-2.583-3.552 2.583v-17.05Z"
    />
  </svg>
);
export default SvgGross;