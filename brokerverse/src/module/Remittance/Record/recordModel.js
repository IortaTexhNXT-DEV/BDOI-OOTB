/**
 * What the remittance record page derives from the record (GET /remittance/remittances/:id): the lifecycle stepper with
 * the R1 steps, the segregation-of-duties line, the subtitle chips and the one-line banner. R1 keeps the status codes of
 * today (draft, for-approval, rejected = Returned, approved, settled = voucher raised, cancelled); Paid is the payment
 * of the settlement voucher.
 */
import { formatInstant } from "../../../utility/dateFormat";
import { formatDate, money } from "../shared";

const ORDER = { draft: 0, "for-approval": 1, rejected: 1, approved: 2, settled: 3 };

/** The steps Created, Submitted, Approved (or Returned), Voucher raised and Paid, with the date and person of each one reached. */
export const lifecycleSteps = (r, t) => {
  const code = r.statusCode;
  const at = ORDER[code] ?? -1;
  const paid = !!r.paidOn;
  const outcome = r.approval?.outcome || null;
  // the step reached is done; the next one waits (current) unless the remittance is cancelled
  const state = (index) => {
    if (index <= at) return "done";
    return index === at + 1 && at >= 0 ? "current" : "pending";
  };
  const decisionStep = code === "rejected"
    ? { key: "returned", label: t("remittance.record.steps.returned"), state: "current", date: outcome?.decidedAt || r.returned?.at || undefined, person: outcome?.by?.name || r.returned?.by || undefined }
    : { key: "approved", label: t("remittance.record.steps.approved"), state: state(2), date: at >= 2 ? r.approvedAt || outcome?.decidedAt || undefined : undefined,
      person: at >= 2 ? outcome?.by?.name || r.approvedBy || undefined : undefined };
  return [
    { key: "created", label: t("remittance.record.steps.created"), state: "done", date: r.createdAt, person: r.createdBy?.name || t("remittance.record.system") },
    { key: "submitted", label: t("remittance.record.steps.submitted"), state: code === "rejected" ? "done" : state(1), date: r.submittedAt || undefined,
      person: r.submittedAt ? r.submittedBy?.name || undefined : undefined },
    decisionStep,
    { key: "voucher", label: t("remittance.record.steps.voucher"), state: state(3), date: at >= 3 ? r.settledAt || undefined : undefined, person: r.voucher?.number || undefined },
    { key: "paid", label: t("remittance.record.steps.paid"), state: paid ? "done" : state(4), date: r.paidOn || undefined },
  ];
};

/** "Prepared System (weekly run) · Submitted M. Reyes · Approved J. Cruz · Voucher PV-2026-00102". */
export const sodLine = (r, t) => {
  const outcome = r.approval?.outcome || null;
  const parts = [t("remittance.record.sod.prepared", { name: r.createdBy?.name || t("remittance.record.system") })];
  if (r.submittedBy?.name) parts.push(t("remittance.record.sod.submitted", { name: r.submittedBy.name }));
  if (outcome?.action === "Approved") parts.push(t("remittance.record.sod.approved", { name: outcome.by?.name }));
  if (outcome?.action === "Rejected") parts.push(t("remittance.record.sod.returned", { name: outcome.by?.name }));
  if (r.voucher?.number) parts.push(t("remittance.record.sod.voucher", { number: r.voucher.number }));
  return parts.join(" · ");
};

/** Pioneer Insurance · Motor · Net basis · Coverage 05/10–09/10/2026 · Due 16/10/2026 · Source Weekly run. */
export const subtitleChips = (r, t) => [
  r.insurer?.name,
  r.productLine,
  r.basisLabel ? t("remittance.record.basis", { basis: r.basisLabel }) : null,
  r.coverageWeek ? t("remittance.record.coverage", { from: formatDate(r.coverageWeek.from), to: formatDate(r.coverageWeek.to) }) : null,
  r.dueDate ? t("remittance.record.due", { date: formatDate(r.dueDate) }) : null,
  r.source?.label ? t("remittance.record.source", { source: r.source.label }) : null,
].filter(Boolean);

/**
 * The one-line banner: why the user cannot act, or the next step. { kind: "note", reason, approvers } for a pending
 * remittance the user cannot decide (the EligibilityNote), else { kind: "text", text }; null when there is nothing to say.
 */
export const bannerOf = (r, t) => {
  const code = r.statusCode;
  const decision = r.decision || null;
  if (code === "for-approval") {
    if (decision && !decision.canDecide) return { kind: "note", reason: decision.blockedReason, approvers: decision.eligibleApprovers || [] };
    if (decision?.canDecide) {
      return { kind: "text", text: t("remittance.record.banner.decide", { limit: decision.myLimit === null || decision.myLimit === undefined ? t("remittance.record.banner.noLimit") : money(decision.myLimit),
        amount: money(decision.amount) }) };
    }
    return r.nextStep?.label ? { kind: "text", text: r.nextStep.label } : null;
  }
  if (code === "rejected") {
    const back = r.returned || {};
    const outcome = r.approval?.outcome || {};
    const by = outcome.by?.name || back.by;
    const when = outcome.decidedAt || back.at;
    const reason = outcome.reason || back.reason;
    return { kind: "text", tone: "warning", text: [t("remittance.record.banner.returned", { name: by || "-", at: formatInstant(when, { empty: "" }) }), reason].filter(Boolean).join(" · ") };
  }
  if (code === "settled" && r.paidOn) return { kind: "text", text: t("remittance.record.banner.paid", { at: formatInstant(r.paidOn) }) };
  if (code === "cancelled") return null;
  return r.nextStep?.label ? { kind: "text", text: r.nextStep.label } : null;
};
