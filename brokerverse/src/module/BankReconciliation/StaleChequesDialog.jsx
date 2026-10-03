import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import bankReconciliationService from "../../services/bankReconciliationService";
import { date, money, showError, showSuccess } from "./common";

/** Outstanding cheques older than the stale period: cancel one (payment reversed, payable re-opened). */
const StaleChequesDialog = ({ visible, account, onHide, onChanged, toast }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!account) return;
    try {
      setData(await bankReconciliationService.staleCheques(account));
    } catch (e) {
      showError(toast, e);
    }
  }, [account, toast]);
  useEffect(() => { if (visible) { setData(null); setReason(""); load(); } }, [visible, load]);

  const cancel = async (row) => {
    setBusy(row.id);
    try {
      const r = await bankReconciliationService.cancelStaleCheque(row.id, account, reason);
      showSuccess(toast, t("bankReconciliation.staleCancelled", { cheque: r.chequeNumber, journal: r.reversal?.jvNumber || "" }));
      await load();
      onChanged();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog className="pe-dialog" visible={visible} onHide={onHide} style={{ width: "min(980px, 96vw)" }}
      header={`${t("bankReconciliation.staleCheques")}${data ? ` · ${t("bankReconciliation.olderThan", { days: data.staleDays })}` : ""}`}>
      <p className="pe-muted mt-0">{t("bankReconciliation.staleHelp")}</p>
      <div className="mb-2" style={{ maxWidth: 480 }}>
        <label htmlFor="br-stale-reason">{t("bankReconciliation.reason")}</label>
        <InputText id="br-stale-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" placeholder={t("bankReconciliation.staleReasonPlaceholder")} />
      </div>
      <DataTable value={data?.rows || []} loading={!data} dataKey="id" size="small" stripedRows emptyMessage={t("bankReconciliation.noStaleCheques")}>
        <Column header={t("bankReconciliation.date")} body={(r) => date(r.date)} />
        <Column header={t("bankReconciliation.cheque")} body={(r) => r.chequeNumber || "-"} />
        <Column field="journalNumber" header={t("bankReconciliation.journal")} />
        <Column header={t("bankReconciliation.document")} body={(r) => `${r.documentType} ${r.documentNumber || ""}`} />
        <Column field="party" header={t("bankReconciliation.payee")} />
        <Column header={t("bankReconciliation.amount")} body={(r) => money(-r.amount)} className="bv-num" headerClassName="bv-num" />
        <Column field="ageDays" header={t("bankReconciliation.ageDays")} className="bv-num" headerClassName="bv-num" />
        <Column body={(r) => (r.checkbookId
          ? <Button size="small" severity="danger" outlined icon="pi pi-ban" label={t("bankReconciliation.cancelCheque")} loading={busy === r.id} onClick={() => cancel(r)} />
          : <span className="pe-muted">{t("bankReconciliation.reverseByJv")}</span>)} />
      </DataTable>
    </Dialog>
  );
};

export default StaleChequesDialog;
