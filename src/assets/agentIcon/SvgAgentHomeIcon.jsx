import * as React from "react";
const SvgAgentHomeIcon = ({ color, ...props }) => (
  <svg width={20} height={20} fill="none" {...props}>
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.626 13a4.002 4.002 0 0 0 7.748 0M9.518 1.766 2.735 7.04c-.453.353-.68.529-.843.75a2 2 0 0 0-.318.65C1.5 8.704 1.5 8.99 1.5 9.566V16.8c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C3.02 20 3.58 20 4.7 20h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874c.218-.428.218-.988.218-2.108V9.566c0-.575 0-.862-.074-1.126a2.002 2.002 0 0 0-.318-.65c-.163-.221-.39-.397-.843-.75l-6.783-5.275c-.351-.273-.527-.41-.72-.463a1 1 0 0 0-.523 0c-.194.053-.37.19-.721.463Z"
    />
  </svg>
);
export default SvgAgentHomeIcon;
