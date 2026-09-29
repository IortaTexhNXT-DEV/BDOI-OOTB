import * as React from "react";
const SvgTableView = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    viewBox="0 0 20 20"
    {...props}
  >
    <path
      fill="currentColor"
      d="M3 3h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v2h12V5H4zm0 4v2h12V9H4zm0 4v2h12v-2H4z"
    />
  </svg>
);
export default SvgTableView;
