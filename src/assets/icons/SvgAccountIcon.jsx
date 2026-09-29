import * as React from "react";
const SvgAccountIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <g
      stroke="#6366F1"
      strokeLinecap="round"
      strokeLinejoin="round"
      clipPath="url(#test_svg__a)"
    >
      <path d="M12.858 10.714c3.55 0 6.429-1.278 6.429-2.857C19.287 6.28 16.408 5 12.858 5 9.308 5 6.43 6.279 6.43 7.857c0 1.579 2.878 2.857 6.428 2.857" />
      <path d="M6.43 7.857v8.572c0 1.571 2.857 2.857 6.428 2.857 3.572 0 6.429-1.286 6.429-2.858v-8.57" />
      <path d="M19.286 12.143c0 1.571-2.857 2.857-6.428 2.857-3.572 0-6.429-1.286-6.429-2.857m6.286-9.987A9.671 9.671 0 0 0 7.143.727C3.586.727.715 2.013.715 3.584c0 .843.828 1.6 2.143 2.143" />
      <path d="M2.858 14.299c-1.315-.543-2.143-1.3-2.143-2.143V3.584" />
      <path d="M2.858 10.013C1.543 9.47.715 8.713.715 7.87" />
    </g>
    <defs>
      <clipPath id="test_svg__a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgAccountIcon;