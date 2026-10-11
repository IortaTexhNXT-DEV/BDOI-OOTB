import React from "react";
import { Tag } from "primereact/tag";
import StatusChip from "../../components/StatusChip";
import { formatDate } from "../../utility/dateFormat";

/** Colours of the release tiers and the states of a feature (Features & Releases). */
export const TIER_SEVERITY = { PHASE_1: "success", PLATFORM: "info", PHASE_2: "warning", FUTURE: "secondary" };
export const STATUS_SEVERITY = { on: "success", "read-only": "warning", off: "secondary" };
export const TIERS = ["PHASE_1", "PLATFORM", "PHASE_2", "FUTURE"];

export const TierTag = ({ t, tier }) => <Tag value={t(`features.tiers.${tier}`)} severity={TIER_SEVERITY[tier]} />;
export const StatusOf = ({ t, status }) => <StatusChip code={status} label={t(`features.status.${status}`)} severity={STATUS_SEVERITY[status]} />;
export const dateOf = (value) => formatDate(value);

/** Rows filtered by tier and by the text searched in the name, the module and the requirement ids. */
export const filterFeatures = (rows, { tier, search }) => {
  const q = String(search || "").trim().toLowerCase();
  return (rows || []).filter((r) => (!tier || r.tier === tier)
    && (!q || [r.name, r.module, ...(r.requirements || [])].some((v) => String(v || "").toLowerCase().includes(q))));
};
