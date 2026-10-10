import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/creditControlService";
import { openConfirm } from "../../components/ConfirmDialog";
import { PageHeader, dateTime, money, showError, showSuccess } from "./common";
import KeyValueGrid from "../../components/KeyValueGrid";
import DetailSection from "../../components/DetailSection";
import { ActivityLog, useRecordActivity } from "../../components/ActivityLog";

/**
 * Accounts > Credit Control > Client Credit Limits: each client's limit against its open broker-billed premium, and the
 * policies issued over a limit (issued anyway, flagged to Accounting) to acknowledge. Limits are set by an Accounting
 * Manager (approve:credit-control).
 */
/** The credit limit changes of a client, from its audit trail (who set which limit, when, from what). */
const LimitHistory = ({ clientId }) => {
  const { t } = useTranslation();
  const { entries, loading, error, reload } = useRecordActivity("client", clientId);
  return <ActivityLog entries={entries.filter((e) => e.actionCode === "set-credit-limit")} loading={loading} error={error} onRetry={reload} emptyText={t("creditControl.noLimitChanges")} />;
};

const CreditLimits = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [search, setSearch] = useState("");
  const [overOnly, setOverOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null); // { row, value }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, x] = await Promise.all([service.clientLimits({ search: search || undefined, overOnly: overOnly ? "true" : undefined }), service.creditExceptions({ openOnly: openOnly ? "true" : undefined })]);
      setRows(l);
      setExceptions(x);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [search, overOnly, openOnly]);
  useEffect(() => { load(); }, [load]);

  const saveLimit = async () => {
    try {
      await service.setCreditLimit(edit.row.clientId, edit.value === null || edit.value === undefined ? null : Number(edit.value));
      showSuccess(toast, t("creditControl.limitSaved", { client: edit.row.clientName }));
      setEdit(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const acknowledge = async (x) => {
    const remarks = await openConfirm({
      title: t("creditControl.confirmations.acknowledgeTitle"),
      severity: "warning",
      message: t("creditControl.confirmations.acknowledgeMessage", { client: x.clientName }),
      facts: [
        { label: t("creditControl.client"), value: x.clientName },
        { label: t("creditControl.policyNumber"), value: x.policyNumber },
        { label: t("creditControl.creditLimit"), value: x.creditLimit, type: "amount" },
        { label: t("creditControl.newPremium"), value: x.newAmount, type: "amount" },
        { label: t("creditControl.exposure"), value: x.exposureAfter, type: "amount" },
        { label: t("creditControl.exceededBy"), value: x.exceededBy, type: "amount", emphasis: true },
      ],
      input: { type: "textarea", label: t("creditControl.acknowledgeRemarks"), maxLength: 1000 },
      confirmLabel: t("creditControl.confirmations.acknowledgeException"),
      onConfirm: (value) => service.acknowledgeException(x.id, value),
    });
    if (remarks === null) return;
    showSuccess(toast, t("creditControl.acknowledged"));
    load();
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("creditControl.creditLimits")} trail={[t("creditControl.creditLimits")]} />
      <div className="pe-card">
        <TabView>
          <TabPanel header={t("creditControl.clients")}>
            <div className="flex gap-3 align-items-center mb-2">
              <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("creditControl.searchClient")} className="w-20rem" />
              <span className="flex align-items-center gap-2"><Checkbox inputId="cc-over" checked={overOnly} onChange={(e) => setOverOnly(e.checked)} /><label htmlFor="cc-over">{t("creditControl.overLimitOnly")}</label></span>
            </div>
            <DataTable value={rows} dataKey="clientId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("creditControl.none")}>
              <Column field="clientCode" header={t("creditControl.clientCode")} />
              <Column field="clientName" header={t("creditControl.client")} />
              <Column header={t("creditControl.creditLimit")} body={(r) => (r.creditLimit === null ? t("creditControl.noLimit") : money(r.creditLimit))} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.exposure")} body={(r) => money(r.exposure)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.available")} body={(r) => (r.available === null ? "-" : <span className={r.overLimit ? "text-red-600 font-semibold" : ""}>{money(r.available)}</span>)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.updated")} body={(r) => (r.updatedAt ? `${dateTime(r.updatedAt)} ${r.updatedBy || ""}` : "")} />
              <Column body={(r) => <Button icon="pi pi-pencil" text size="small" tooltip={t("creditControl.setLimit")} onClick={() => setEdit({ row: r, value: r.creditLimit })} aria-label={t("creditControl.setLimit")} />} />
            </DataTable>
          </TabPanel>
          <TabPanel header={`${t("creditControl.exceptions")} (${exceptions.length})`}>
            <span className="flex align-items-center gap-2 mb-2"><Checkbox inputId="cc-open" checked={openOnly} onChange={(e) => setOpenOnly(e.checked)} /><label htmlFor="cc-open">{t("creditControl.openOnly")}</label></span>
            <DataTable value={exceptions} dataKey="id" size="small" stripedRows emptyMessage={t("creditControl.none")}>
              <Column header={t("creditControl.when")} body={(r) => dateTime(r.createdAt)} />
              <Column field="clientName" header={t("creditControl.client")} />
              <Column field="policyNumber" header={t("creditControl.policyNumber")} />
              <Column header={t("creditControl.creditLimit")} body={(r) => money(r.creditLimit)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.newPremium")} body={(r) => money(r.newAmount)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.exposure")} body={(r) => money(r.exposureAfter)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("creditControl.exceededBy")} body={(r) => <span className="text-red-600">{money(r.exceededBy)}</span>} className="bv-num" headerClassName="bv-num" />
              <Column body={(r) => (r.acknowledgedAt ? <span className="pe-muted text-sm">{r.acknowledgedBy}: {r.remarks}</span>
                : <Button label={t("creditControl.acknowledge")} size="small" outlined onClick={() => acknowledge(r)} />)} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={edit ? `${t("creditControl.setLimit")} · ${edit.row.clientName}` : ""} visible={!!edit} style={{ width: "min(640px, 96vw)" }} onHide={() => setEdit(null)}
        footer={<div><Button label={t("creditControl.cancel")} text onClick={() => setEdit(null)} /><Button label={t("creditControl.save")} icon="pi pi-save" onClick={saveLimit} /></div>}>
        {edit && (
          <div className="flex flex-column gap-3">
            <KeyValueGrid columns={2} items={[
              { label: t("creditControl.currentLimit"), value: edit.row.creditLimit === null ? t("creditControl.noLimit") : edit.row.creditLimit, type: edit.row.creditLimit === null ? "text" : "amount" },
              { label: t("creditControl.exposure"), value: edit.row.exposure, type: "amount" },
              { label: t("creditControl.available"), value: edit.row.available, type: "amount", hidden: edit.row.available === null },
              { label: t("creditControl.lastChanged"), value: edit.row.updatedAt ? `${dateTime(edit.row.updatedAt)}${edit.row.updatedBy ? ` · ${edit.row.updatedBy}` : ""}` : null },
            ]} />
            <div>
              <label htmlFor="cc-limit">{t("creditControl.newLimit")}</label>
              <InputNumber inputId="cc-limit" value={edit.value} mode="decimal" minFractionDigits={2} min={0} placeholder={t("creditControl.noLimit")} onValueChange={(e) => setEdit({ ...edit, value: e.value })} className="w-full" />
            </div>
            <DetailSection title={t("creditControl.limitHistory")}>
              <LimitHistory clientId={edit.row.clientId} />
            </DetailSection>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default CreditLimits;
