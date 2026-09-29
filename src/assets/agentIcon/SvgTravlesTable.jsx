import * as React from "react";
const SvgTravlesTable = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={40}
    height={40}
    fill="none"
    {...props}
  >
    <circle cx={20} cy={20} r={20} fill="#93E0A1" />
    <path
      fill="#67D07A"
      d="m14.85 25.15-3.2-1.75 1.05-1.05 2.5.35 3.9-3.9-7.8-4.25 1.4-1.4 9.55 2.45 3.926-3.875a1.44 1.44 0 0 1 1.063-.425q.638 0 1.062.425t.425 1.063q0 .638-.425 1.062l-3.9 3.9 2.45 9.55-1.4 1.4-4.25-7.8-3.9 3.9.35 2.5-1.05 1.05z"
    />
  </svg>
);
export default SvgTravlesTable;