import * as React from "react";
const SvgDocument = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={80}
    height={80}
    fill="none"
    {...props}
  >
    <path
      fill="#6366F1"
      d="M30 6a8 8 0 0 0-8 8v20.828a21.917 21.917 0 0 1 4-.74V14a4 4 0 0 1 4-4h16v14a6 6 0 0 0 6 6h14v32a4 4 0 0 1-4 4H47.6a22.025 22.025 0 0 1-2.628 4H62a8 8 0 0 0 8-8V27.656a6 6 0 0 0-1.76-4.24L52.584 7.756A6 6 0 0 0 48.344 6H30Zm35.172 20H52a2 2 0 0 1-2-2V10.828L65.172 26ZM46 56a18 18 0 1 1-36 0 18 18 0 0 1 36 0ZM28 46a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2Zm0 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
    />
  </svg>
);
export default SvgDocument;