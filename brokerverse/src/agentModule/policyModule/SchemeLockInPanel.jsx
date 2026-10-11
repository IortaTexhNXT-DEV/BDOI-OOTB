import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { lockInService, schemesService } from "../../services/dealerSchemesService";
import { hasPermission } from "../../utils/canOpen";
import { notifySuccess } from "../../utility/dialogs";
import { openConfirm } from "../../components/ConfirmDialog";
import { isInitiator } from "../../components/ApprovalActions";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { formatValue } from "../../components/KeyValueGrid/formatValue";

const LOAN_STATUSES = ["current", "past-due", "fraud", "early-terminated", "terminated", "legal-dispute", "closed"];
const amount = (v) => formatValue(v, { type: "amount" });

/**
 * Policy detail: the Scheme panel (FR-SCM-023, FR-SIS-023: scheme, version, line, year of the term, rates, commission
 * with the dealer and TISPH shares, the application and loan) and the Lock-in & loan panel (FR-LCK-004: lock-in, year,
 * review date, notice treatment, TFS loan status with a stale warning, the last review, a pending change). Set loan status
 * (write:loan-status) and Change lock-in (write:lock-in, applied when another user approves: approve:lock-in).
 * Nothing shows for a policy with neither.
 */
const SchemeLockInPanel = ({ policyId }) => {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState(null);
  const [lock, setLock] = useState(null);
  const canStatus = hasPermission("write:loan-status");
  const canChange = hasPermission("write:lock-in");
  const canApprove = hasPermission("approve:lock-in");

  const load = useCallback(async () => {
    if (!policyId) return;
    const [s, l] = await Promise.all([schemesService.policyScheme(policyId).catch(() => null), lockInService.panel(policyId).catch(() => null)]);
    setScheme(s);
    setLock(l);
  }, [policyId]);
  useEffect(() => { load(); }, [load]);

  const facts = lock ? [{ label: t("lockInPanel.policy", "Policy"), value: lock.policyNumber }, { label: t("lockInPanel.loanAccount", "TFS loan account"), value: lock.tfsLoanAccount || "-" }] : [];
  const setStatus = async () => {
    const loanStatus = await openConfirm({ title: t("lockInPanel.setLoanStatus", "Set loan status"), facts, confirmLabel: t("lockInPanel.next", "Next"),
      input: { type: "select", label: t("lockInPanel.loanStatus", "Loan status"), required: true, defaultValue: lock.loanStatus,
        options: LOAN_STATUSES.map((s) => ({ value: s, label: t(`lockInPanel.loan.${s}`, s) })) } });
    if (!loanStatus) return;
    const done = await openConfirm({ title: t("lockInPanel.setLoanStatus", "Set loan status"), confirmLabel: t("lockInPanel.save", "Save"),
      facts: [...facts, { label: t("lockInPanel.loanStatus", "Loan status"), value: t(`lockInPanel.loan.${loanStatus}`, loanStatus) }],
      input: { type: "textarea", label: t("lockInPanel.remark", "Reason for the loan status (at least 10 characters)"), required: true },
      onConfirm: async (remark) => notifySuccess((await lockInService.setLoanStatus(policyId, { loanStatus, remark })).message) });
    if (done) load();
  };
  const requestEnd = async () => {
    const done = await openConfirm({ title: t("lockInPanel.endTitle", "End the lock-in"), severity: "danger", facts, confirmLabel: t("lockInPanel.requestEnd", "Request end"),
      reason: { context: "lockin_end" },
      onConfirm: async (why) => {
        const r = await lockInService.requestChange(policyId, { action: "end", reasonCode: why?.reasonCode, remark: why?.note || why?.reasonCode });
        notifySuccess(r.message);
      } });
    if (done) load();
  };
  const decide = async (action) => {
    const done = await openConfirm({ title: action === "approve" ? t("lockInPanel.approveChange", "Approve the lock-in change") : t("lockInPanel.returnChange", "Return the lock-in change"),
      facts: [...facts, { label: t("lockInPanel.change", "Change"), value: `${lock.pendingChange.action}: ${lock.pendingChange.remark}` }],
      confirmLabel: action === "approve" ? t("lockInPanel.approve", "Approve") : t("lockInPanel.return", "Return"),
      ...(action === "return" ? { input: { type: "textarea", label: t("lockInPanel.returnNote", "Reason for returning"), required: true } } : {}),
      onConfirm: (note) => lockInService.decideChange(lock.pendingChange.id, action, action === "return" ? { note } : {}) });
    if (done) load();
  };

  if (!scheme && !lock) return null;
  return (
    <>
      {scheme ? (
        <DetailSection className="mt-3" title={t("schemePanel.title", "Scheme")}>
          <KeyValueGrid columns={4} items={[
            { label: t("schemePanel.scheme", "Scheme"), value: `${scheme.label} (${scheme.schemeTypeLabel})`, span: 2 },
            { label: t("schemePanel.vehicleLine", "Vehicle line"), value: scheme.line },
            { label: t("schemePanel.sumInsured", "Sum insured"), value: amount(scheme.sumInsured) },
            { label: t("schemePanel.commission", "Commission"), value: `${scheme.commissionPct}% = ${amount(scheme.commission)}` },
            { label: t("schemePanel.dealerShare", "Dealer share"), value: `${amount(scheme.dealerShare)}${scheme.dealerName ? ` (${scheme.dealerName})` : ""}` },
            { label: t("schemePanel.tisphShare", "TISPH share"), value: amount(scheme.tisphShare) },
            { label: t("schemePanel.schemePremium", "Scheme premium"), value: amount(scheme.schemePremium) },
            { label: t("schemePanel.adjustedPremium", "Adjusted premium"), value: scheme.adjustedPremium ? `${amount(scheme.adjustedPremium)}: ${scheme.adjustReason || ""}` : null, hidden: !scheme.adjustedPremium, span: 2 },
            { label: t("schemePanel.heldShare", "Dealer share held"), value: scheme.dealerShareHeld, hidden: !scheme.dealerShareHeld, span: 2 },
            { label: t("schemePanel.application", "Application"), value: scheme.application ? `${scheme.application.number}, loan ${scheme.application.loanAccount}` : null, hidden: !scheme.application, span: 2 },
            { label: t("schemePanel.kyc", "KYC source"), value: scheme.application?.kycSourceLabel, hidden: !scheme.application },
            { label: t("schemePanel.ara", "Auto Renewal Agreement"), value: scheme.application?.araPaymentMode, hidden: !scheme.application?.araPaymentMode },
            { label: t("schemePanel.waived", "Waived documents"), value: (scheme.waivedDocuments || []).map((w) => `${w.document} (${w.approver || "-"})`).join("; "), hidden: !scheme.waivedDocuments?.length, span: 4 },
          ]} />
        </DetailSection>
      ) : null}
      {lock ? (
        <DetailSection className="mt-3" title={t("lockInPanel.title", "Lock-in & loan")}
          actions={(
            <span className="flex flex-wrap gap-2">
              {canStatus && lock.tfsLoanAccount ? <Button size="small" outlined icon="pi pi-flag" label={t("lockInPanel.setLoanStatus", "Set loan status")} onClick={setStatus} /> : null}
              {canChange && lock.locked && lock.status === "active" && !lock.pendingChange
                ? <Button size="small" outlined severity="danger" icon="pi pi-unlock" label={t("lockInPanel.requestEnd", "Request end")} onClick={requestEnd} /> : null}
              {canApprove && lock.pendingChange && !isInitiator({ id: lock.pendingChange.requestedById }) ? (
                <>
                  <Button size="small" icon="pi pi-check" label={t("lockInPanel.approve", "Approve")} onClick={() => decide("approve")} />
                  <Button size="small" outlined severity="danger" icon="pi pi-undo" label={t("lockInPanel.return", "Return")} onClick={() => decide("return")} />
                </>
              ) : null}
            </span>
          )}>
          <KeyValueGrid columns={4} items={[
            { label: t("lockInPanel.lockIn", "Lock-in"), value: [lock.sourceLabel, lock.reference].filter(Boolean).join(" ") },
            { label: t("lockInPanel.status", "Status"), value: lock.statusLabel },
            { label: t("lockInPanel.period", "Period"), value: lock.startDate ? `${formatValue(lock.startDate, { type: "date" })} - ${formatValue(lock.endDate, { type: "date" })}` : null },
            { label: t("lockInPanel.year", "Year of the term"), value: lock.year ? `${lock.year} of ${lock.years ?? "-"}` : null },
            { label: t("lockInPanel.reviewDate", "Review date"), value: lock.reviewDate, type: "date" },
            { label: t("lockInPanel.notices", "Renewal notices"), value: lock.treatment?.label },
            { label: t("lockInPanel.loanAccount", "TFS loan account"), value: lock.tfsLoanAccount },
            { label: t("lockInPanel.loanStatus", "Loan status"), value: lock.loanStatusLabel ? `${lock.loanStatusLabel}${lock.loanStatusManual ? ` (${t("lockInPanel.manual", "set by hand")})` : ""}` : null },
            { label: t("lockInPanel.loanStatusDate", "Loan status date"), value: lock.loanStatusDate, type: "date" },
            { label: t("lockInPanel.stale", "Stale status"), value: lock.staleWarning, hidden: !lock.staleWarning, span: 2 },
            { label: t("lockInPanel.lastReview", "Last review"), value: lock.lastReview ? `${lock.lastReview.decision || lock.lastReview.status}${lock.lastReview.reason ? `: ${lock.lastReview.reason}` : ""}` : null, hidden: !lock.lastReview, span: 2 },
            { label: t("lockInPanel.pending", "Change waiting for approval"), value: lock.pendingChange ? `${lock.pendingChange.action} - ${lock.pendingChange.remark} (${lock.pendingChange.requestedBy})` : null, hidden: !lock.pendingChange, span: 2 },
          ]} />
        </DetailSection>
      ) : null}
    </>
  );
};

export default SchemeLockInPanel;
