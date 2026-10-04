import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { Skeleton } from "primereact/skeleton";
import { formatDate } from "../../utility/dateFormat";
import { dueInfo, dueText, priorityMeta } from "./logic";

/** Rows shown while the first page of a list loads (the columns render skeleton bars for them). */
export const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => ({ id: `skeleton-${i}`, skeleton: true }));

/** The table value and props while loading: skeleton rows until the first page has arrived. */
export const withSkeleton = (list) => {
  const first = list.loading && !list.rows.length;
  return first ? { ...list.tableProps, value: SKELETON_ROWS, loading: false } : list.tableProps;
};

/** A cell body that shows a skeleton bar for a placeholder row. */
export const cell = (render, width = "70%") => (row) => (row.skeleton ? <Skeleton width={width} height="0.9rem" /> : render(row));

/** Due date with its position against today (overdue in red). */
export const DueCell = ({ date, time, today, soonDays }) => {
  const { t } = useTranslation();
  const info = dueInfo(date, today, soonDays);
  return (
    <div className={`mw-due mw-due--${info.bucket}`}>
      <span className="mw-due__date">{date ? formatDate(date) : "-"}{time ? <span className="mw-due__time"> {time}</span> : null}</span>
      <span className="mw-due__rel">{dueText(info, t)}</span>
    </div>
  );
};
DueCell.propTypes = { date: PropTypes.string, time: PropTypes.string, today: PropTypes.string.isRequired, soonDays: PropTypes.number };

/** Priority as a small tag with an arrow icon. */
export const PriorityTag = ({ priority, compact = false }) => {
  const { t } = useTranslation();
  const meta = priorityMeta(priority);
  const label = t(`myWork.priority.${priority || "normal"}`, { defaultValue: priority || "normal" });
  if (compact) {
    return <span className={`mw-prio mw-prio--${priority || "normal"}`} title={label} aria-label={label} role="img"><i className={meta.icon} aria-hidden="true" /></span>;
  }
  return <Tag className="mw-priority" severity={meta.severity} icon={meta.icon} value={label} />;
};
PriorityTag.propTypes = { priority: PropTypes.string, compact: PropTypes.bool };

/** Empty state of a list or panel: an icon and one line. */
export const Empty = ({ icon = "pi pi-check-circle", text }) => (
  <div className="mw-empty">
    <i className={icon} aria-hidden="true" />
    <span>{text}</span>
  </div>
);
Empty.propTypes = { icon: PropTypes.string, text: PropTypes.node.isRequired };
