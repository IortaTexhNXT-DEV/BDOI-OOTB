import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Sidebar } from "primereact/sidebar";
import { Skeleton } from "primereact/skeleton";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import DecisionBar from "../../../components/DecisionBar";
import LoadingBar from "../../../components/LoadingBar";
import { ActivityLog, fromRemittanceActivity } from "../../../components/ActivityLog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { formatInstant } from "../../../utility/dateFormat";
import { formatDate, money, statusChip } from "../shared";
import { RejectDialog, approveRemittance } from "./decisions";

const CHECK_ICONS = { pass: "pi pi-check", fail: "pi pi-times", info: "pi pi-info-circle" };

/** "REM-2026-00017 · PHP 371,210.00 · +10.2%". */
export const previousText = (previous) => {
  if (!previous) return null;
  const change = previous.changePercent === null || previous.changePercent === undefined ? null
    : `${previous.changePercent > 0 ? "+" : ""}${Number(previous.changePercent).toFixed(1)}%`;
  return [previous.remittanceNo, money(previous.amount), change].filter(Boolean).join(" · ");
};

/**
 * The review panel of one approval (60vw, at least 720px): header, the facts and totals, the previous remittance of the
 * insurer, the checks at submission, the first ten lines with Open full remittance, the open exceptions, the activity
 * (folded) and the DecisionBar, which shows the EligibilityNote instead of Approve and Reject when the user may not
 * decide. There is no comment box. A decision that lost a race (decided or changed meanwhile) leaves the panel read-only
 * with the server's sentence.
 */
const ReviewPanel = ({ approvalId, onHide, onDecided }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const loader = useCallback(() => remittanceService.getApproval(approvalId), [approvalId]);
  const { data: a, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !!approvalId });

  useEffect(() => {
    setMessage(null);
    setActivityOpen(false);
  }, [approvalId]);

  const after = async (result, successText) => {
    if (result.race) setMessage({ tone: "race", text: result.race });
    else if (result.done) setMessage({ tone: "done", text: successText });
    if (result.race || result.done) {
      await reload();
      onDecided();
    }
  };

  const approve = async () => {
    setBusy("approve");
    try {
      await after(await approveRemittance(t, { id: a.id, version: a.version, reference: a.reference, amount: a.amount }), t("remittance.decision.approved"));
    } finally {
      setBusy(false);
    }
  };

  const record = a?.record || {};
  const totals = a?.totals || {};
  const decision = a?.decision || null;
  const flags = record.offCycle ? [{ key: "off-cycle", label: record.offCycleReason ? t("remittance.flags.offCycleReason", { reason: record.offCycleReason }) : t("remittance.flags.offCycle"), severity: "info" }] : [];

  const header = a ? (
    <DetailHeader title={a.reference} status={statusChip(record.statusCode, a.statusLabel)} flags={flags} subtitle={a.insurer?.name}
      meta={[{ label: t("remittance.inbox.columns.amount"), value: money(a.amount) }, { label: t("remittance.inbox.columns.submittedBy"), value: a.submittedBy?.name },
        { label: t("remittance.inbox.columns.submittedOn"), value: a.submittedAt, type: "datetime" }, { label: t("remittance.inbox.columns.level"), value: a.level?.label },
        { label: t("remittance.inbox.columns.sla"), value: a.sla?.label, hidden: !a.sla }]} />
  ) : null;

  const facts = [
    { label: t("remittance.review.insurer"), value: a?.insurer?.name },
    { label: t("remittance.review.productLine"), value: a?.productLine || record.productLine },
    { label: t("remittance.review.period"), value: record.period },
    { label: t("remittance.review.source"), value: record.source?.label },
    { label: t("remittance.review.policies"), value: totals.policies, type: "number" },
    { label: t("remittance.review.premium"), value: money(totals.premium), hidden: totals.premium === undefined },
    { label: t("remittance.review.commission"), value: money(totals.commission), hidden: totals.commission === undefined },
    { label: t("remittance.review.tax"), value: money(totals.tax), hidden: totals.tax === undefined },
    { label: t("remittance.review.dueToInsurer"), value: money(totals.dueToInsurer) },
    { label: t("remittance.review.dueDate"), value: record.dueDate ? formatDate(record.dueDate) : null },
  ];

  const lines = a?.lines || [];
  const exceptions = a?.exceptions || { count: 0, items: [] };
  const footer = a && !loading ? (
    <div className="rm-review__footer">
      {message && message.text !== decision?.blockedReason ? <p className={`rm-review__message rm-review__message--${message.tone}`} role={message.tone === "race" ? "alert" : "status"}>{message.text}</p> : null}
      <DecisionBar decision={decision} busy={busy} onApprove={approve}
        onReject={() => setRejecting({ id: a.id, version: a.version, reference: a.reference, amount: a.amount, makerName: a.submittedBy?.name })} />
    </div>
  ) : null;

  return (
    <Sidebar visible={!!approvalId} position="right" onHide={onHide} blockScroll className="rm-review" aria-label={t("remittance.review.title")}
      header={<span className="rm-review__title">{t("remittance.review.title")}</span>}>
      <div className="rm-review__body bv-loading-host">
        <LoadingBar active={refreshing} />
        {error && !a ? (
          <div className="rm-inline-error" role="alert">
            <span>{error}</span>
            <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
          </div>
        ) : null}
        {loading && !a ? <Skeleton height="16rem" /> : null}
        {a ? (
          <>
            {header}
            <DetailSection title={t("remittance.review.facts")}><KeyValueGrid columns={3} items={facts} /></DetailSection>
            <DetailSection title={t("remittance.review.previous")}>
              <p className="rm-review__line">{previousText(a.previous) || t("remittance.review.noPrevious")}</p>
            </DetailSection>
            <DetailSection title={t("remittance.review.checks")}>
              <ul className="rm-checks">
                {(a.checks || []).map((c) => (
                  <li key={c.code} className={`rm-checks__item rm-checks__item--${c.result}`}>
                    <i className={CHECK_ICONS[c.result] || CHECK_ICONS.info} aria-hidden="true" />
                    <span className="p-sr-only">{t(`remittance.review.checkResult.${c.result}`)}</span>
                    <span>{c.label}</span>
                    {c.detail ? <span className="rm-checks__detail">{c.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </DetailSection>
            <DetailSection title={t("remittance.review.lines", { shown: lines.length, count: a.lineCount || lines.length })}
              actions={a.entity === "remittance" ? (
                <Button type="button" label={t("remittance.review.openFull")} link size="small" onClick={() => navigate(a.recordLink)} />
              ) : null} flush>
              <DataTable value={lines} size="small" className="rm-table" dataKey="policyNo">
                <Column header={t("remittance.review.policyNo")} field="policyNo" />
                <Column header={t("remittance.review.client")} field="client" />
                <Column header={t("remittance.review.premium")} body={(l) => <span className="rm-num">{money(l.premium)}</span>} align="right" />
                <Column header={t("remittance.review.dueToInsurer")} body={(l) => <span className="rm-num">{money(l.dueToInsurer)}</span>} align="right" />
              </DataTable>
            </DetailSection>
            <DetailSection title={t("remittance.review.exceptions")}>
              {exceptions.count ? (
                <ul className="rm-review__list">
                  {exceptions.items.map((x) => <li key={x.reference}>{[x.reference, x.type, x.description].filter(Boolean).join(" · ")}</li>)}
                </ul>
              ) : <p className="rm-review__line">{t("remittance.review.noExceptions")}</p>}
            </DetailSection>
            <DetailSection title={t("remittance.review.activity")}
              actions={<Button type="button" label={activityOpen ? t("remittance.review.hideActivity") : t("remittance.review.showActivity")} link size="small"
                aria-expanded={activityOpen} onClick={() => setActivityOpen((v) => !v)} />}>
              {activityOpen ? <ActivityLog entries={fromRemittanceActivity(a.activity || [])} /> : (
                <p className="rm-review__line">{t("remittance.review.activityCount", { count: (a.activity || []).length, at: formatInstant(a.activity?.at(-1)?.at, { empty: "" }) })}</p>
              )}
            </DetailSection>
          </>
        ) : null}
      </div>
      {footer}
      <RejectDialog approval={rejecting} onHide={(result) => { setRejecting(null); after(result, t("remittance.decision.rejected")); }} />
    </Sidebar>
  );
};

ReviewPanel.propTypes = {
  /** the approval shown (id, or remittance:<id>); null closes the panel */
  approvalId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onHide: PropTypes.func.isRequired,
  /** after a decision (or a lost race): the list reloads */
  onDecided: PropTypes.func,
};

ReviewPanel.defaultProps = { approvalId: null, onDecided: () => {} };

export default ReviewPanel;
