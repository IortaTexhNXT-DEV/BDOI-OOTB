import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import ApprovalActions from "../../../components/ApprovalActions";
import { openConfirm } from "../../../components/ConfirmDialog";
import { receiptsService } from "../../../services/receiptsService";
import { hasPermission } from "../../../utils/canOpen";
import { showErrorMessage, showSuccessMessage } from "../../../utility/toastUtils";

const SEVERITY = { pending: "warning", approved: "success", returned: "danger" };

/**
 * Reversal of a receipt: a holder of reverse:receipts asks for it with a reason; while it waits, a holder of
 * approve:receipt-reversal other than the requester approves (the receipt is cancelled) or returns it with a reason.
 */
const ReceiptReversal = ({ receiptId, receiptNumber, reversal, cancelled, onChanged }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const pending = reversal?.status === "pending";
  const canRequest = hasPermission("reverse:receipts") && !cancelled && !pending;
  const canDecide = pending && hasPermission("approve:receipt-reversal");
  if (!reversal && !canRequest) return null;

  const run = async (call) => {
    setBusy(true);
    try {
      const r = await call();
      showSuccessMessage(r?.message);
      onChanged();
    } catch (e) {
      showErrorMessage(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const request = async () => {
    const reason = await openConfirm({
      title: t("accounts.receiptReversal.confirmTitle", { number: receiptNumber }), severity: "danger", message: t("accounts.receiptReversal.confirmMessage"),
      reason: { context: "receipt_reversal", label: t("accounts.receiptReversal.reason") }, confirmLabel: t("accounts.receiptReversal.sendForApproval"),
      cancelLabel: t("accounts.receiptReversal.keep"),
    });
    if (reason) await run(() => receiptsService.requestReversal(receiptId, reason));
  };
  const approve = async () => {
    const yes = await openConfirm({ title: t("accounts.receiptReversal.approveTitle", { number: receiptNumber }), severity: "danger",
      message: t("accounts.receiptReversal.confirmMessage"), confirmLabel: t("accounts.receiptReversal.approve") });
    if (yes) await run(() => receiptsService.decideReversal(receiptId, { action: "approve" }));
  };
  const giveBack = async () => {
    const reason = await openConfirm({ title: t("accounts.receiptReversal.returnTitle", { number: receiptNumber }),
      reason: { context: "receipt_reversal_reject", label: t("accounts.receiptReversal.returnReasonLabel") }, confirmLabel: t("accounts.receiptReversal.return") });
    if (reason) await run(() => receiptsService.decideReversal(receiptId, { action: "return", ...reason }));
  };

  return (
    <DetailSection title={t("accounts.receiptReversal.title")} className="mt-4">
      {reversal ? (
        <KeyValueGrid columns={3} items={[
          { label: t("accounts.receiptReversal.status"), value: <StatusChip code={reversal.status} label={t(`accounts.receiptReversal.statuses.${reversal.status}`)} severity={SEVERITY[reversal.status]} /> },
          { label: t("accounts.receiptReversal.reason"), value: reversal.reason },
          { label: t("accounts.receiptReversal.requestedBy"), value: reversal.requestedBy },
          { label: t("accounts.receiptReversal.requestedAt"), value: reversal.requestedAt, type: "datetime" },
          { label: t("accounts.receiptReversal.decidedBy"), value: reversal.decidedBy, hidden: !reversal.decidedBy },
          { label: t("accounts.receiptReversal.decidedAt"), value: reversal.decidedAt, type: "datetime", hidden: !reversal.decidedAt },
          { label: t("accounts.receiptReversal.returnReason"), value: reversal.returnReason, hidden: !reversal.returnReason },
        ]} />
      ) : null}
      {canDecide ? (
        <ApprovalActions className="mt-3" initiator={{ id: reversal.requestedById }} approveLabel={t("accounts.receiptReversal.approve")}
          rejectLabel={t("accounts.receiptReversal.return")} onApprove={approve} onReject={giveBack} busy={busy} />
      ) : null}
      {canRequest ? (
        <div className="flex justify-content-end mt-3">
          <Button label={t("accounts.receiptReversal.reverse")} icon="pi pi-undo" severity="danger" outlined loading={busy} onClick={request} />
        </div>
      ) : null}
    </DetailSection>
  );
};

ReceiptReversal.propTypes = {
  receiptId: PropTypes.string.isRequired,
  receiptNumber: PropTypes.string,
  reversal: PropTypes.shape({
    status: PropTypes.string, reason: PropTypes.string, requestedById: PropTypes.string, requestedBy: PropTypes.string, requestedAt: PropTypes.string,
    decidedBy: PropTypes.string, decidedAt: PropTypes.string, returnReason: PropTypes.string,
  }),
  cancelled: PropTypes.bool,
  onChanged: PropTypes.func.isRequired,
};

ReceiptReversal.defaultProps = { receiptNumber: "", reversal: null, cancelled: false };

export default ReceiptReversal;
