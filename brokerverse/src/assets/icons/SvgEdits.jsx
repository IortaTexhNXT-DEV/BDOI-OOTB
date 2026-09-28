import * as React from "react";
const SvgEdit = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <path
      fill="#6C737F"
      d="M13.578 1.912a.833.833 0 0 1 1.178 0l3.333 3.333a.833.833 0 0 1 0 1.179L7.256 17.257a.833.833 0 0 1-.59.244H3.334a.833.833 0 0 1-.833-.833v-3.333c0-.222.088-.434.244-.59l8.334-8.333 2.5-2.5Zm-1.911 4.267-7.5 7.5v2.155h2.155l7.5-7.5-2.155-2.155ZM15 7.156l1.322-1.322-2.155-2.155-1.322 1.322L15 7.156Z"
    />
  </svg>
);
export default SvgEdit;