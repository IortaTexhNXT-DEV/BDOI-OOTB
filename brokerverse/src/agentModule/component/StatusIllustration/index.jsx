import React from "react";

const VARIANTS = {
  waiting: { icon: "pi-hourglass", color: "var(--color-text-muted)" },
  rejected: { icon: "pi-times-circle", color: "var(--color-danger)" },
  search: { icon: "pi-search", color: "var(--color-text-muted)" },
};

/** Local replacement for the former remote status images (waiting / rejected / search): a 20px icon beside the text. */
const StatusIllustration = ({ variant, size = "1.25rem", className, label }) => {
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
