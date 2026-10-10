import React, { useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadState from "../../../components/LoadState";
import StatusChip from "../../../components/StatusChip";
import { RecordActivityLog } from "../../../components/ActivityLog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import service from "../../../services/opsAccountingService";
import { date, money, numericColumn } from "../common";
import { chequeActions } from "./model";

/** The cheque's facts in business words. */
const chequeFacts = (t, c) => [
  { label: t("opsAcc.client"), value: c.clientName },
  { label: t("opsAcc.policy"), value: c.policyNumber },
  { label: t("opsAcc.pdc.billLabel"), value: c.billNumber },
  { label: t("opsAcc.pdc.inst"), value: c.instalmentText },
  { label: t("opsAcc.pdc.payee"), value: c.payeeText },
  { label: t("opsAcc.pdc.insurancePartner"), value: c.insurerName },
  { label: t("opsAcc.pdc.bank"), value: c.bankName },
  { label: t("opsAcc.pdc.branch"), value: c.branch },
  { label: t("opsAcc.pdc.accountNumber"), value: c.accountNumber },
  { label: t("opsAcc.pdc.brstn"), value: c.brstn },
  { label: t("opsAcc.pdc.chequeNumber"), value: c.chequeNumber },
  { label: t("opsAcc.pdc.chequeDate"), value: c.chequeDate, type: "date" },
  { label: t("opsAcc.amount"), value: c.amount, type: "amount" },
  { label: t("opsAcc.pdc.receivedDate"), value: c.receivedDate, type: "date" },
  { label: t("opsAcc.pdc.custody"), value: c.custodyText },
  { label: t("opsAcc.pdc.ageing"), value: c.ageing?.label },
  { label: t("opsAcc.pdc.transmittal"), value: c.transmittalNumber, hidden: !c.transmittalNumber },
  { label: t("opsAcc.pdc.forwardedOn"), value: c.forwardedOn, type: "date", hidden: !c.forwardedOn },
  { label: t("opsAcc.pdc.warehousedOn"), value: c.warehousedOn, type: "date", hidden: !c.warehousedOn },
  { label: t("opsAcc.pdc.receivedBy"), value: c.partnerReceivedBy, hidden: !c.partnerReceivedBy },
  { label: t("opsAcc.pdc.collectedOn"), value: c.collectedOn, type: "date", hidden: !c.collectedOn },
  { label: t("opsAcc.pdc.partnerReference"), value: c.partnerReference, hidden: !c.partnerReference },
  { label: t("opsAcc.pdc.depositAccount"), value: c.depositAccount, hidden: !c.depositAccount },
  { label: t("opsAcc.pdc.depositDate"), value: c.depositedOn, type: "date", hidden: !c.depositedOn },
  { label: t("opsAcc.pdc.ar"), value: c.receiptNumber ? `${c.receiptNumber}${c.receiptCancelled ? ` (${t("opsAcc.status.cancelled")})` : ""}` : null, hidden: !c.receiptNumber },
  { label: t("opsAcc.pdc.bouncedOn"), value: c.bouncedOn, type: "date", hidden: !c.bouncedOn },
  { label: t("opsAcc.pdc.bounceReason"), value: c.bounceReason, hidden: !c.bounceReason },
  { label: t("opsAcc.pdc.replaces"), value: c.replacesNumber, hidden: !c.replacesNumber },
  { label: t("opsAcc.pdc.replacedBy"), value: c.replacedByNumber, hidden: !c.replacedByNumber },
  { label: t("opsAcc.pdc.returnedTo"), value: c.returnedTo, hidden: !c.returnedTo },
  { label: t("opsAcc.remarks"), value: c.remarks, span: "full", hidden: !c.remarks },
];

const cancellationFacts = (t, x) => [
  { label: t("opsAcc.pdc.cancelReason"), value: x.reason },
  { label: t("opsAcc.pdc.replacementFollows"), value: x.replacementFollows ? t(`opsAcc.pdc.replacement.${x.replacementFollows}`) : null },
  { label: t("opsAcc.pdc.requestedBy"), value: x.requestedBy },
  { label: t("opsAcc.pdc.approvedBy"), value: x.approvedBy },
  { label: t("opsAcc.pdc.pullOut"), value: x.pullOutRequested ? t("opsAcc.pdc.pullOutRequested") : null, hidden: !x.pullOutRequested },
  { label: t("opsAcc.pdc.pullOutTransmittal"), value: x.pullOutTransmittalNumber, hidden: !x.pullOutTransmittalNumber },
  { label: t("opsAcc.pdc.cancelledOn"), value: x.cancelledOn, type: "date", hidden: !x.cancelledOn },
  { label: t("opsAcc.pdc.cancelledBy"), value: x.cancelledBy, hidden: !x.cancelledBy },
  { label: t("opsAcc.remarks"), value: x.remarks, span: "full" },
];

/**
 * A cheque of the log (FR-PDC-022): its facts, the cancellation, the set with the cheque paying each instalment and the
 * ones it replaced, and the history of every action from the audit trail; the actions the user may take on it.
 */
const ChequeDetail = ({ chequeId, refreshKey, onHide, onAction }) => {
  const { t } = useTranslation();
  const loader = useCallback(async () => {
    const c = await service.pdc(chequeId);
    const set = c.setId ? await service.pdcSet(c.setId) : null;
    return { c, set };
  }, [chequeId]);
  const { data, loading, error, reload } = useStableLoad(loader, { enabled: !!chequeId });
  // the list reloaded after an action: the cheque shown is read again
  const seen = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === seen.current) return;
    seen.current = refreshKey;
    if (chequeId) reload();
  }, [refreshKey, chequeId, reload]);
  const c = data?.c;
  const actions = c ? chequeActions(c).filter((a) => a.code !== "view") : [];

  return (
    <DetailDialog visible={!!chequeId} onHide={onHide} size="lg" header={c ? t("opsAcc.pdc.chequeTitle", { number: c.pdcNumber }) : t("opsAcc.pdc.title")}
      footer={(
        <div className="flex flex-wrap gap-2 justify-content-end">
          {actions.map((a) => (
            <Button key={a.code} label={t(`opsAcc.pdc.menu.${a.code}`)} outlined={!["approve-cancellation"].includes(a.code)}
              severity={["partner-bounced", "bounce", "request-cancellation", "return-cancellation"].includes(a.code) ? "danger" : undefined} onClick={() => onAction(a.code, c)} />
          ))}
          <Button label={t("detailView.close")} text onClick={onHide} />
        </div>
      )}>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {c ? (
          <>
            <DetailHeader title={c.pdcNumber} status={{ code: c.status, label: c.statusText }} subtitle={c.setNumber ? t("opsAcc.pdc.ofSet", { set: c.setNumber }) : null}
              meta={[{ label: t("opsAcc.amount"), value: c.amount, type: "amount" }, { label: t("opsAcc.pdc.chequeDate"), value: c.chequeDate, type: "date" },
                { label: t("opsAcc.pdc.custody"), value: c.custodyText }]} />
            <DetailSection title={t("opsAcc.pdc.chequeSection")}><KeyValueGrid columns={3} items={chequeFacts(t, c)} /></DetailSection>
            {c.cancellation ? <DetailSection title={t("opsAcc.pdc.cancellationSection")}><KeyValueGrid columns={3} items={cancellationFacts(t, c.cancellation)} /></DetailSection> : null}
            {data.set ? (
              <DetailSection title={t("opsAcc.pdc.setSection", { set: data.set.setNumber })} flush>
                <KeyValueGrid columns={4} className="px-3 pt-2" items={[
                  { label: t("opsAcc.pdc.payee"), value: data.set.payeeText },
                  { label: t("opsAcc.pdc.cheques"), value: data.set.chequeCount, type: "number" },
                  { label: t("opsAcc.total"), value: data.set.total, type: "amount" },
                  { label: t("opsAcc.pdc.endOfTerm"), value: data.set.lastChequeDate, type: "date" },
                ]} />
                <DataTable value={data.set.cheques} dataKey="id" size="small" rowClassName={(r) => (r.id === c.id ? "font-semibold" : "")}>
                  <Column header={t("opsAcc.pdc.inst")} body={(r) => r.instalmentText || "—"} />
                  <Column field="pdcNumber" header={t("opsAcc.pdc.number")} />
                  <Column header={t("opsAcc.pdc.bankCheque")} body={(r) => `${r.bankName || ""} ${r.chequeNumber}`} />
                  <Column header={t("opsAcc.pdc.chequeDate")} body={(r) => date(r.chequeDate)} />
                  <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
                  <Column header={t("opsAcc.statusLabel")} body={(r) => <StatusChip code={r.status} label={r.statusText} />} />
                  <Column header={t("opsAcc.pdc.replaces")} body={(r) => r.replacesNumber || ""} />
                </DataTable>
              </DetailSection>
            ) : null}
            <DetailSection title={t("opsAcc.pdc.history")}><RecordActivityLog entity="post_dated_cheque" recordId={c.id} /></DetailSection>
          </>
        ) : null}
      </LoadState>
    </DetailDialog>
  );
};

ChequeDetail.propTypes = {
  chequeId: PropTypes.string,
  refreshKey: PropTypes.number,
  onHide: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
};

ChequeDetail.defaultProps = { chequeId: null, refreshKey: 0 };

export default ChequeDetail;
