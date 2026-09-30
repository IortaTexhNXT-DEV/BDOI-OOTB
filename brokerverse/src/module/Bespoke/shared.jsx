import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";

export { PageHeader, Field, formatDate, round2 } from "../Placement/shared";

/** Tag severity per status of the bespoke screens (slips, rooms, bids, binders, reconciliation). */
export const bespokeSeverity = (status) => {
  const s = String(status || "").toLowerCase();
  if (["final", "active", "quoted", "accepted", "signed", "matched", "awarded", "received", "confirmed"].includes(s)) return "success";
  if (["declined", "cancelled", "withdrawn", "inactive", "difference", "closed"].includes(s)) return "danger";
  if (["requested", "countered", "sent", "open", "invited", "viewed", "pending", "billed"].includes(s)) return "warning";
  if (["draft"].includes(s)) return "info";
  return "secondary";
};

export const BespokeTag = ({ status, prefix = "bespoke.status" }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag value={t(`${prefix}.${status}`, { defaultValue: status })} severity={bespokeSeverity(status)} className="placement-status" />;
};

/** Word diff parts ({ op, text }) with insertions and deletions marked. */
export const DiffText = ({ parts }) => (
  <span className="bespoke-diff">
    {(parts || []).map((p, i) => (
      <span key={i} className={`diff-${p.op}`}>{p.text}</span>
    ))}
  </span>
);

export const amount = (v) => (v === null || v === undefined || v === "" ? "-" : Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const percent = (v) => (v === null || v === undefined || v === "" ? "-" : `${Number(v).toLocaleString("en-PH", { maximumFractionDigits: 4 })}%`);

/** Move an item of a list up (-1) or down (+1). */
export const move = (list, index, delta) => {
  const next = [...list];
  const to = index + delta;
  if (to < 0 || to >= next.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
};
