/**
 * Status of a record as a compact chip in the shared status colours (utils/statusSeverity), never wider than its text,
 * also inside a grid cell or a flex row.
 *
 *   <StatusChip code={r.statusCode} label={r.status} />      <StatusChip label="Pending Approval" />
 */
import React from "react";
import PropTypes from "prop-types";
import { Tag } from "primereact/tag";
import { statusLabel, statusSeverity } from "../../utils/statusSeverity";
import "./statusChip.scss";

/** Severity of a status: by its label when the label is a known status word, else by its code. */
export const chipSeverity = (code, label) => {
  const byLabel = label ? statusSeverity(label) : null;
  if (byLabel && byLabel !== "info") return byLabel;
  return code ? statusSeverity(code) : byLabel || "secondary";
};

const StatusChip = ({ code, label, severity, className }) => {
  const text = label || statusLabel(code);
  if (!text) return null;
  return <Tag value={text} severity={severity || chipSeverity(code, label)} className={["bv-status-chip", className].filter(Boolean).join(" ")} />;
};

StatusChip.propTypes = {
  /** status code of the API (draft, for-approval ...) */
  code: PropTypes.string,
  /** status as shown (the API's label); the code in words when missing */
  label: PropTypes.string,
  /** success, info, warning, danger or secondary, when the screen knows better than the status word */
  severity: PropTypes.oneOf(["success", "info", "warning", "danger", "secondary"]),
  className: PropTypes.string,
};

StatusChip.defaultProps = { code: null, label: null, severity: null, className: null };

export default StatusChip;
