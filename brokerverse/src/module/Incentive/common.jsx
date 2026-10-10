import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import PageHeader from "../../components/PageHeader";
import { isInitiator } from "../../components/ApprovalActions";
import { formatCurrency, numberLocale } from "../../utility/currencyConverter";
import { formatPercent } from "../../utility/numberFormat";
import { hasPermission } from "../../utils/canOpen";
import "./incentive.scss";

export const WRITE = "write:incentive";
export const APPROVE = "approve:incentive";

/** Status words of a calculation batch, in their order. */
export const BATCH_STATUSES = ["Calculated", "Pending Approval", "Approved", "Rejected", "Paid"];

/** Header of the Incentive screens: Accounts / Incentive / screen. */
export const IncentiveHeader = ({ title, help, actions }) => {
  const { t } = useTranslation();
  return <PageHeader title={title} home={t("sidebar.Accounts")} section={t("incentive.incentive")} trail={[title]} help={help} actions={actions} />;
};

IncentiveHeader.propTypes = { title: PropTypes.string.isRequired, help: PropTypes.node, actions: PropTypes.node };
IncentiveHeader.defaultProps = { help: null, actions: null };

/** Measures counted in policies and measured as a rate (the program's metric; anything else is an amount). */
const COUNT_METRICS = ["policies"];
const RATE_METRICS = ["renewal-rate", "conversion"];

/** A target or an achievement in the program's measure: an amount, a number of policies or a rate. */
export const formatMeasure = (value, metric) => {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (COUNT_METRICS.includes(metric)) return n.toLocaleString(numberLocale(), { maximumFractionDigits: 0 });
  if (RATE_METRICS.includes(metric)) return formatPercent(n, { decimals: 2 });
  return formatCurrency(n);
};

/** Last `count` calendar months, newest first: { label: "September 2026", value: "2026-09" }. */
export const monthOptions = (count = 12, now = new Date()) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      label: d.toLocaleDateString(numberLocale(), { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`,
    };
  });

/** Months of one calculation period of a program, by its calculation frequency (as the server reads it). */
const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, "semi-annual": 6, semiannual: 6, "half-yearly": 6, annual: 12, annually: 12, yearly: 12 };
const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * The calculation period of a program that a run for `month` ({ from, to }) covers: the month, quarter, half or year of
 * its frequency that contains the end of the month, within the program's dates; `due` is false when that period ends
 * after the month (a quarterly program is run in the last month of its quarter).
 */
export const programWindow = (program, month) => {
  const k = FREQUENCY_MONTHS[String(program.calculationFrequency || "").trim().toLowerCase()];
  if (!k || !month) return month ? { from: month.from, to: month.to, due: true } : null;
  const anchor = program.endDate && program.endDate < month.to ? program.endDate : month.to;
  const [y, m] = anchor.split("-").map(Number);
  const first = Math.floor((m - 1) / k) * k + 1;
  const last = first + k - 1;
  const from = isoOf(y, first, 1);
  const to = isoOf(y, last, new Date(y, last, 0).getDate());
  const window = { from: program.startDate > from ? program.startDate : from, to: program.endDate && program.endDate < to ? program.endDate : to };
  return { ...window, due: window.to <= month.to };
};

/** Whether the signed-in user created, adjusted or submitted the batch (maker-checker: such a user may not decide it). */
export const madeBatch = (batch) =>
  isInitiator({ id: batch?.createdById, username: batch?.createdByUsername }) || isInitiator({ id: batch?.submittedById, username: batch?.submittedByUsername })
  || (batch?.adjustedByIds || []).some((id, i) => isInitiator({ id, username: (batch.adjustedByUsernames || [])[i] }));

/** Why the signed-in user may not approve or reject the batch, or null when they may. */
export const decisionBlock = (batch, t) => {
  if (!hasPermission(APPROVE)) return t("incentive.batch.noApprovePermission");
  if (madeBatch(batch)) return t("incentive.batch.ownBatch");
  return null;
};

/** The programs of a batch by name (by code for a batch read before the names were given). */
export const programNames = (batch) => ((batch?.programNames || []).length ? batch.programNames : batch?.programsIncluded || []).join(", ");

/** The facts of a batch as a confirmation lists them. */
export const batchFacts = (batch, t) => [
  { label: t("incentive.batch.batch"), value: batch.batchId },
  { label: t("incentive.batch.period"), value: batch.period },
  { label: t("incentive.batch.programs"), value: programNames(batch) },
  { label: t("incentive.batch.agents"), value: batch.agentCount, type: "number" },
  { label: t("incentive.batch.totalPayout"), value: batch.totalAmount, type: "amount" },
];
