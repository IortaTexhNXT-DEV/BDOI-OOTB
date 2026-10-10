import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import bankReconciliationService from "../../services/bankReconciliationService";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import { date, money, showError, showSuccess } from "./common";

/** Outstanding cheques older than the stale period: cancel one (payment reversed, payable re-opened). */
const StaleChequesDialog = ({ visible, account, onHide, onChanged, toast }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!account) return;
    try {
      setData(await bankReconciliationService.staleCheques(account));
    } catch (e) {
      showError(toast, e);
    }
  }, [account, toast]);
  useEffect(() => { if (visible) { setData(null); load(); } }, [visible, load]);

  const cancel = async (row) => {
    let out;
    const reason = await openConfirm({
      title: t("bankReconciliation.confirmations.cancelChequeTitle", { cheque: row.chequeNumber }),
      severity: "danger",
      facts: [
        { label: t("bankReconciliation.cheque"), value: row.chequeNumber },
        { label: t("bankReconciliation.date"), value: row.date, type: "date" },
        { label: t("bankReconciliation.payee"), value: row.party },
        { label: t("bankReconciliation.document"), value: [row.documentType, row.documentNumber].filter(Boolean).join(" ") },
        { label: t("bankReconciliation.journal"), value: row.journalNumber },
        { label: t("bankReconciliation.ageDays"), value: row.ageDays, type: "number" },
        { label: t("bankReconciliation.amount"), value: -row.amount, type: "amount", emphasis: true },
      ],
      note: t("bankReconciliation.confirmations.notes.cancelCheque"),
      input: { type: "text", label: t("bankReconciliation.reason"), defaultValue: t("bankReconciliation.staleReasonPlaceholder"), maxLength: 500 },
      confirmLabel: t("bankReconciliation.cancelCheque"),
      cancelLabel: t("bankReconciliation.confirmations.keepCheque"),
      onConfirm: async (value) => { out = await bankReconciliationService.cancelStaleCheque(row.id, account, value); },
    });
    if (reason === null) return;
    showSuccess(toast, t("bankReconciliation.staleCancelled", { cheque: out.chequeNumber, journal: out.reversal?.jvNumber || "" }));
    await load();
    onChanged();
  };

  return (
    <DetailDialog visible={visible} onHide={onHide} size="xl"
      header={`${t("bankReconciliation.staleCheques")}${data ? ` · ${t("bankReconciliation.olderThan", { days: data.staleDays })}` : ""}`}>
      <DataTable value={data?.rows || []} loading={!data} dataKey="id" size="small" stripedRows emptyMessage={t("bankReconciliation.noStaleCheques")}>
        <Column header={t("bankReconciliation.date")} body={(r) => date(r.date)} />
        <Column header={t("bankReconciliation.cheque")} body={(r) => r.chequeNumber || "-"} />
        <Column field="journalNumber" header={t("bankReconciliation.journal")} />
        <Column header={t("bankReconciliation.document")} body={(r) => `${r.documentType} ${r.documentNumber || ""}`} />
        <Column field="party" header={t("bankReconciliation.payee")} />
        <Column header={t("bankReconciliation.amount")} body={(r) => money(-r.amount)} className="bv-num" headerClassName="bv-num" />
        <Column field="ageDays" header={t("bankReconciliation.ageDays")} className="bv-num" headerClassName="bv-num" />
        <Column body={(r) => (r.checkbookId
          ? <Button size="small" severity="danger" outlined icon="pi pi-ban" label={t("bankReconciliation.cancelCheque")} onClick={() => cancel(r)} />
          : <span className="pe-muted">{t("bankReconciliation.reverseByJv")}</span>)} />
      </DataTable>
    </DetailDialog>
  );
};

export default StaleChequesDialog;
