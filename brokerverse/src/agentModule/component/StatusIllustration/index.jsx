import React from "react";

const VARIANTS = {
  waiting: { icon: "pi-hourglass", color: "#0072d8" },
  rejected: { icon: "pi-times-circle", color: "#e53935" },
  search: { icon: "pi-search", color: "#0072d8" },
};

/** Local replacement for the former remote status images (waiting / rejected / search). */
const StatusIllustration = ({ variant, size = "6rem", className, label }) => {
  const { icon, color } = VARIANTS[variant] || VARIANTS.waiting;
  return (
    <i
      className={`pi ${icon} ${className || ""}`.trim()}
      style={{ fontSize: size, color }}
      role="img"
      aria-label={label || variant}
    />
  );
};

export default StatusIllustration;
