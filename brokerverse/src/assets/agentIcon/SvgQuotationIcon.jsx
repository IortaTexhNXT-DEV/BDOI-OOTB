const SvgQuotationIcon = ({ color }) => (
  <svg width={24} height={24} fill="none">
    <path
      stroke={color}
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.5 10.371V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5v-15a2.25 2.25 0 0 1 2.25-2.25h4.629a1.5 1.5 0 0 1 1.06.44l6.622 6.62a1.5 1.5 0 0 1 .439 1.061Z"
    />
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 2.625V8.25a1.5 1.5 0 0 0 1.5 1.5h5.625"
    />
  </svg>
);
export default SvgQuotationIcon;
