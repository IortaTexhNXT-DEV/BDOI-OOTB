import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import bankReconciliationService from "../../services/bankReconciliationService";
import { BrTag, PageHeader, dateTime, money, previousPeriod, recentPeriods, showError } from "./common";

/** Accounts > Bank Reconciliation > Reconciliations: runs per bank account and period, and a new run. */
const Reconciliations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ bankAccount: null, status: null });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const periods = useMemo(() => recentPeriods(24), []);

  useEffect(() => { bankReconciliationService.bankAccounts().then(setAccounts).catch((e) => showError(toast, e)); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await bankReconciliationService.reconciliations(filters));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const linked = accounts.filter((a) => a.glAccountCode);
  // the month after the account's last reconciliation (last month at the latest), and the run already made for a period
  const defaultPeriod = (account) => {
    const last = rows.filter((r) => r.bankAccount === account).map((r) => r.period).sort().pop();
    const previous = previousPeriod();
    if (!last || last >= previous) return previous;
    const [y, m] = last.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  };
  const existing = creating ? rows.find((r) => r.bankAccount === creating.bankAccount && r.period === creating.period) : null;
  const startNew = () => {
    const bankAccount = linked[0]?.code || null;
    setCreating({ bankAccount, period: defaultPeriod(bankAccount) });
  };

  const create = async () => {
    setBusy(true);
    try {
      const r = await bankReconciliationService.createReconciliation(creating.bankAccount, creating.period);
      navigate(`/accounts/bank-reconciliation/reconciliations/${r.id}`);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("bankReconciliation.reconciliations")} trail={[t("bankReconciliation.reconciliations")]}>
        <Button icon="pi pi-arrow-left" text label={t("bankReconciliation.workspace")} onClick={() => navigate("/accounts/bank-reconciliation")} />
        <Button icon="pi pi-plus" label={t("bankReconciliation.newReconciliation")} onClick={startNew} />
      </PageHeader>
      <div className="pe-card">
        <div className="br-toolbar mb-3">
          <div>
            <label htmlFor="br-f-account">{t("bankReconciliation.bankAccount")}</label>
            <Dropdown inputId="br-f-account" value={filters.bankAccount} showClear placeholder={t("bankReconciliation.all")} style={{ minWidth: 280 }}
              options={linked.map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code }))} onChange={(e) => setFilters({ ...filters, bankAccount: e.value })} />
          </div>
          <div>
            <label htmlFor="br-f-status">{t("bankReconciliation.status.label")}</label>
            <Dropdown inputId="br-f-status" value={filters.status} showClear placeholder={t("bankReconciliation.all")} style={{ minWidth: 180 }}
              options={["draft", "prepared", "approved"].map((x) => ({ label: t(`bankReconciliation.status.${x}`), value: x }))} onChange={(e) => setFilters({ ...filters, status: e.value })} />
          </div>
        </div>
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("bankReconciliation.noReconciliations")}
          onRowClick={(e) => navigate(`/accounts/bank-reconciliation/reconciliations/${e.data.id}`)} rowClassName={() => "cursor-pointer"}>
          <Column header={t("bankReconciliation.recNumber")} body={(r) => <span className="pe-link">{r.recNumber}</span>} />
          <Column field="bankAccount" header={t("bankReconciliation.bankAccount")} />
          <Column field="period" header={t("bankReconciliation.period")} />
          <Column header={t("bankReconciliation.status.label")} body={(r) => <BrTag status={r.status} />} />
          <Column header={t("bankReconciliation.adjustedBankBalance")} body={(r) => money(r.adjustedBankBalance)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("bankReconciliation.adjustedBookBalance")} body={(r) => money(r.adjustedBookBalance)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("bankReconciliation.difference")} body={(r) => <span className={r.difference ? "br-debit" : ""}>{money(r.difference)}</span>} className="bv-num" headerClassName="bv-num" />
          <Column header={t("bankReconciliation.preparedBy")} body={(r) => (r.preparedByName ? `${r.preparedByName}, ${dateTime(r.preparedAt)}` : "-")} />
          <Column header={t("bankReconciliation.approvedBy")} body={(r) => (r.approvedByName ? `${r.approvedByName}, ${dateTime(r.approvedAt)}` : "-")} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={t("bankReconciliation.newReconciliation")} visible={!!creating} style={{ width: "min(480px, 95vw)" }} onHide={() => setCreating(null)}
        footer={(
          <div>
            <Button label={t("bankReconciliation.cancel")} text onClick={() => setCreating(null)} />
            <Button label={t("bankReconciliation.start")} icon="pi pi-play" loading={busy} disabled={!creating?.bankAccount || !creating?.period || !!existing} onClick={create} />
          </div>
        )}>
        {creating && (
          <div className="grid">
            <div className="col-12">
              <label htmlFor="br-n-account">{t("bankReconciliation.bankAccount")} *</label>
              <Dropdown inputId="br-n-account" value={creating.bankAccount} className="w-full" options={linked.map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code }))}
                onChange={(e) => setCreating({ bankAccount: e.value, period: defaultPeriod(e.value) })} />
            </div>
            <div className="col-12">
              <label htmlFor="br-n-period">{t("bankReconciliation.period")} *</label>
              <Dropdown inputId="br-n-period" value={creating.period} className={`w-full${existing ? " p-invalid" : ""}`} options={periods} onChange={(e) => setCreating({ ...creating, period: e.value })} />
              {existing ? <small className="p-error block mt-1" role="alert">{t("bankReconciliation.alreadyStarted", { number: existing.recNumber })}</small> : null}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Reconciliations;
