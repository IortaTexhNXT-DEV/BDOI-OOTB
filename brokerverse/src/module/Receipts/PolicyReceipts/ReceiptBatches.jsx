import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import LoadState from "../../../components/LoadState";
import { receiptsService } from "../../../services/receiptsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { showErrorMessage } from "../../../utility/toastUtils";

/**
 * Receipt voucher batches: each bulk upload of receipts with its counts, the premium receipted and the commission kept
 * apart on combined premium-and-commission rows, which Accounting exports to reconcile with the insurer.
 */
const ReceiptBatches = ({ visible, onHide }) => {
  const { t } = useTranslation();
  const [batches, setBatches] = useState(null);
  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    receiptsService.receiptBatches().then(setBatches).catch((e) => setError(e?.response?.data?.message || e.message));
  };
  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const exportBatch = (b) => receiptsService.downloadBatchCommission(b).catch((e) => showErrorMessage(e.message));

  return (
    <Dialog header={t("accounts.receiptBatches.title")} visible={visible} onHide={onHide} style={{ width: "64rem" }} breakpoints={{ "960px": "95vw" }}>
      <LoadState loading={!batches && !error} error={error} onRetry={load}>
        <DataTable value={batches || []} dataKey="id" size="small" paginator rows={10} emptyMessage={t("accounts.receiptBatches.empty")}>
          <Column field="batchNumber" header={t("accounts.receiptBatches.batch")} />
          <Column header={t("accounts.receiptBatches.kind")} body={(b) => t(`accounts.receiptBatches.kinds.${b.kind}`)} />
          <Column header={t("accounts.receiptBatches.uploaded")} body={(b) => `${formatDate(b.createdAt)}${b.createdBy ? ` · ${b.createdBy}` : ""}`} />
          <Column field="fileName" header={t("accounts.receiptBatches.file")} />
          <Column header={t("accounts.receiptBatches.receipted")} body={(b) => `${b.created} / ${b.rows}`} className="text-right" headerClassName="text-right" />
          <Column header={t("accounts.receiptBatches.premium")} body={(b) => formatCurrency(b.premiumTotal)} className="text-right" headerClassName="text-right" />
          <Column header={t("accounts.receiptBatches.commission")} body={(b) => formatCurrency(b.commissionTotal)} className="text-right" headerClassName="text-right" />
          <Column body={(b) => {
            if (b.kind === "bank-payments") return <Button label={t("accounts.receiptBatches.exportLines")} icon="pi pi-download" text size="small" onClick={() => exportBatch(b)} />;
            return b.commissionRows ? <Button label={t("accounts.receiptBatches.exportCommission")} icon="pi pi-download" text size="small" onClick={() => exportBatch(b)} /> : null;
          }} />
        </DataTable>
      </LoadState>
    </Dialog>
  );
};

ReceiptBatches.propTypes = { visible: PropTypes.bool.isRequired, onHide: PropTypes.func.isRequired };

export default ReceiptBatches;
