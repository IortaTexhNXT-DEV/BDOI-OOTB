import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Sidebar } from "primereact/sidebar";
import { Skeleton } from "primereact/skeleton";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import LoadingBar from "../../../components/LoadingBar";
import { ActivityLog, fromRemittanceActivity } from "../../../components/ActivityLog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { formatInstant } from "../../../utility/dateFormat";
import { money } from "../shared";
import { severityOf } from "./paymentsModel";

/** The reversal of a transfer's journal: its JV, or a "Not reversed" chip in the danger colour. */
export const ReversalCell = ({ reversal }) => {
  if (!reversal) return "-";
  if (reversal.reversed) return <span className="rm-nowrap">{reversal.number}</span>;
  return reversal.label ? <StatusChip label={reversal.label} severity="danger" /> : "-";
};

ReversalCell.propTypes = { reversal: PropTypes.shape({ reversed: PropTypes.bool, number: PropTypes.string, label: PropTypes.string }) };
ReversalCell.defaultProps = { reversal: null };

/**
 * An electronic transfer of an earlier release (TRF-), read-only (640px side panel): the "Recorded outside a payment
 * voucher" chip, the transfer, its approval, the journal posted at approval with its reversal, and the activity
 * (folded). It has no action.
 */
const TransferPanel = ({ transferId, onHide }) => {
  const { t } = useTranslation();
  const [activityOpen, setActivityOpen] = useState(false);
  const loader = useCallback(() => remittanceService.getTransfer(transferId), [transferId]);
  const { data: x, loading, refreshing, error, reload } = useStableLoad(loader, { enabled: !!transferId });

  useEffect(() => {
    setActivityOpen(false);
  }, [transferId]);

  const decisions = (x?.approval?.decisions || []).map((d) => (
    <span key={`${d.action}-${d.at}`} className="rm-payment__approval">
      {[d.action, d.by, d.at ? formatInstant(d.at, { empty: "" }) : null, d.remarks].filter(Boolean).join(" · ")}
    </span>
  ));

  return (
    <Sidebar visible={!!transferId} position="right" onHide={onHide} blockScroll className="rm-review rm-payment" aria-label={t("remittance.payments.legacy.title")}
      header={<span className="rm-review__title">{t("remittance.payments.legacy.title")}</span>}>
      <div className="rm-review__body bv-loading-host">
        <LoadingBar active={refreshing} />
        {error && !x ? (
          <div className="rm-inline-error" role="alert">
            <span>{error}</span>
            <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
          </div>
        ) : null}
        {loading && !x ? <Skeleton height="16rem" /> : null}
        {x ? (
          <>
            <DetailHeader title={x.reference} status={{ code: x.status, label: x.statusLabel, severity: severityOf(x.status) }} subtitle={x.beneficiary}
              flags={[{ key: "legacy", label: x.chip?.label, severity: "secondary" }]} />
            <DetailSection title={t("remittance.payments.legacy.transfer")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.legacy.beneficiary"), value: x.beneficiary },
                { label: t("remittance.payments.legacy.bank"), value: x.bank },
                { label: t("remittance.payments.legacy.account"), value: x.accountMasked },
                { label: t("remittance.payments.legacy.method"), value: x.method },
                { label: t("remittance.payments.legacy.amount"), value: money(x.amount) },
                { label: t("remittance.payments.legacy.date"), value: x.date, type: "date" },
                { label: t("remittance.payments.legacy.remittanceNo"), value: x.remittanceNo },
                { label: t("remittance.payments.legacy.bankReference"), value: x.bankReference },
                { label: t("remittance.payments.legacy.purpose"), value: x.purpose, span: "full", hidden: !x.purpose },
                { label: t("remittance.payments.legacy.failureReason"), value: x.failureReason, span: "full", hidden: !x.failureReason },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.legacy.approval")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.legacy.createdBy"), value: [x.createdBy, formatInstant(x.createdAt, { empty: "" })].filter(Boolean).join(" · ") },
                { label: t("remittance.payments.legacy.approvedBy"), value: x.approvedBy ? [x.approvedBy.name, formatInstant(x.approvedBy.at, { empty: "" })].filter(Boolean).join(" · ") : null },
                { label: t("remittance.payments.legacy.decisions"), value: decisions.length ? <span className="rm-payment__links">{decisions}</span> : null, span: "full" },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.legacy.journal")}>
              <KeyValueGrid columns={2} items={[
                { label: t("remittance.payments.legacy.journalPosted"), value: x.journal?.number },
                { label: t("remittance.payments.legacy.reversal"), value: x.journal ? <ReversalCell reversal={x.reversal} /> : null },
              ]} />
            </DetailSection>
            <DetailSection title={t("remittance.payments.panel.activity")}
              actions={<Button type="button" label={activityOpen ? t("remittance.review.hideActivity") : t("remittance.review.showActivity")} link size="small"
                aria-expanded={activityOpen} onClick={() => setActivityOpen((v) => !v)} />}>
              {activityOpen ? <ActivityLog entries={fromRemittanceActivity(x.activity || [])} /> : (
                <p className="rm-review__line">{t("remittance.review.activityCount", { count: (x.activity || []).length, at: formatInstant(x.activity?.at(-1)?.at, { empty: "" }) })}</p>
              )}
            </DetailSection>
          </>
        ) : null}
      </div>
    </Sidebar>
  );
};

TransferPanel.propTypes = {
  /** the transfer shown (id or TRF no.); null closes the panel */
  transferId: PropTypes.string,
  onHide: PropTypes.func.isRequired,
};

TransferPanel.defaultProps = { transferId: null };

export default TransferPanel;
