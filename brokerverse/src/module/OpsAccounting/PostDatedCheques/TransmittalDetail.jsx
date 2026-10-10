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
import { useStableLoad } from "../../../hooks/useStableLoad";
import service from "../../../services/opsAccountingService";
import { hasPermission } from "../../../utils/canOpen";
import { date, money, numericColumn, showError } from "../common";

const chequeColumns = (t) => [
  <Column key="no" field="pdcNumber" header={t("opsAcc.pdc.number")} />,
  <Column key="client" field="clientName" header={t("opsAcc.client")} />,
  <Column key="policy" field="policyNumber" header={t("opsAcc.policy")} />,
  <Column key="bank" header={t("opsAcc.pdc.bankCheque")} body={(r) => `${r.bankName || ""} ${r.chequeNumber}`} />,
  <Column key="date" header={t("opsAcc.pdc.chequeDate")} body={(r) => date(r.chequeDate)} />,
  <Column key="amount" header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />,
  <Column key="status" header={t("opsAcc.statusLabel")} body={(r) => <StatusChip code={r.status} label={r.statusText} />} />,
];

/**
 * A transmittal to an Insurance Partner (FR-PDC-010, 011): the cheques it carries and the pull-outs requested on it,
 * Partner received for the cheques still in transit, Partner returned for a pull-out, and the export sent with it.
 */
const TransmittalDetail = ({ transmittalId, refreshKey, onHide, onAction, toast }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => service.pdcTransmittal(transmittalId), [transmittalId]);
  const { data: tr, loading, error, reload } = useStableLoad(loader, { enabled: !!transmittalId });
  const seen = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === seen.current) return;
    seen.current = refreshKey;
    if (transmittalId) reload();
  }, [refreshKey, transmittalId, reload]);
  const inTransit = (tr?.cheques || []).filter((c) => c.status === "forwarded");
  const write = hasPermission("write:pdc");

  return (
    <DetailDialog visible={!!transmittalId} onHide={onHide} size="lg" header={tr ? t("opsAcc.pdc.transmittalTitle", { number: tr.transmittalNumber }) : t("opsAcc.pdc.transmittal")}
      footer={(
        <div className="flex flex-wrap gap-2 justify-content-end">
          {tr ? <Button label={t("opsAcc.export")} icon="pi pi-download" outlined onClick={() => service.downloadTransmittal(tr.id, tr.transmittalNumber).catch((e) => showError(toast, e))} /> : null}
          {write && inTransit.length ? <Button label={t("opsAcc.pdc.menu.partner-received")} onClick={() => onAction("partner-received", inTransit, tr)} /> : null}
          <Button label={t("detailView.close")} text onClick={onHide} />
        </div>
      )}>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {tr ? (
          <>
            <DetailHeader title={tr.transmittalNumber} status={{ code: tr.status, label: t(`opsAcc.pdc.transmittalStatus.${tr.status}`) }} subtitle={tr.insurerName}
              meta={[{ label: t("opsAcc.pdc.cheques"), value: tr.count, type: "number" }, { label: t("opsAcc.total"), value: tr.total, type: "amount" },
                { label: t("opsAcc.pdc.forwardedOn"), value: tr.forwardedOn, type: "date" }]} />
            <DetailSection title={t("opsAcc.pdc.transmittalSection")}>
              <KeyValueGrid columns={3} items={[
                { label: t("opsAcc.pdc.sentBy"), value: t(`opsAcc.pdc.sentByOptions.${tr.sentBy}`) },
                { label: t("opsAcc.pdc.courierReference"), value: tr.courierReference },
                { label: t("opsAcc.pdc.createdBy"), value: tr.createdBy },
                { label: t("opsAcc.pdc.receivedOn"), value: tr.receivedOn, type: "date" },
                { label: t("opsAcc.pdc.receivedBy"), value: tr.receivedBy },
                { label: t("opsAcc.pdc.partnerReference"), value: tr.partnerReference },
                { label: t("opsAcc.remarks"), value: tr.remarks, span: "full", hidden: !tr.remarks },
              ]} />
            </DetailSection>
            <DetailSection title={t("opsAcc.pdc.chequesForwarded")} flush>
              <DataTable value={tr.cheques} dataKey="id" size="small" emptyMessage={t("opsAcc.none")}>{chequeColumns(t)}</DataTable>
            </DetailSection>
            <DetailSection title={t("opsAcc.pdc.pullOutsOnTransmittal")} flush>
              <DataTable value={tr.pullOuts} dataKey="id" size="small" emptyMessage={t("opsAcc.none")}>
                {chequeColumns(t)}
                <Column body={(r) => (write && r.status === "cancellation-pending" ? (
                  <Button label={t("opsAcc.pdc.menu.partner-returned")} size="small" text onClick={() => onAction("partner-returned", [r], tr)} />
                ) : null)} />
              </DataTable>
            </DetailSection>
          </>
        ) : null}
      </LoadState>
    </DetailDialog>
  );
};

TransmittalDetail.propTypes = {
  transmittalId: PropTypes.string,
  refreshKey: PropTypes.number,
  onHide: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
  toast: PropTypes.shape({ current: PropTypes.any }).isRequired,
};

TransmittalDetail.defaultProps = { transmittalId: null, refreshKey: 0 };

export default TransmittalDetail;
