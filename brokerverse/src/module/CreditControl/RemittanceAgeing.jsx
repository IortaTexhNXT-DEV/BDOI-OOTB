import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import service from "../../services/creditControlService";
import { loadInsurerOptions } from "../Remittance/shared";
import { PageHeader, bucketLabels, date, isoOf, money, showError } from "./common";

const BUCKETS = ["current", "b1", "b2", "b3", "b4"];

/**
 * Accounts > Credit Control > Remittance Ageing: premium collected from clients and not yet remitted to the insurers
 * (no approved or paid insurer voucher), aged on each insurer's remittance terms. Summary per insurer and detail, with
 * an Excel download.
 */
const RemittanceAgeing = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [insurers, setInsurers] = useState([]);
  const [filter, setFilter] = useState({ insurerId: null, asOf: new Date(), overdueOnly: true });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadInsurerOptions().then(setInsurers).catch((e) => showError(toast, e)); }, []);
  const params = useCallback(() => ({ insurerId: filter.insurerId || undefined, asOf: isoOf(filter.asOf), overdueOnly: filter.overdueOnly ? "true" : undefined }), [filter]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.remittanceAgeing(params()));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [params]);
  useEffect(() => { load(); }, [load]);

  const labels = bucketLabels(data?.bucketDays, t);
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("creditControl.remittanceAgeing")} trail={[t("creditControl.remittanceAgeing")]}>
        <Button icon="pi pi-file-excel" label="Excel" outlined onClick={() => service.downloadRemittanceAgeing(params()).catch((e) => showError(toast, e))} />
      </PageHeader>
      <div className="pe-card mb-3">
        <div className="flex flex-wrap gap-3 align-items-center mb-3">
          <Dropdown value={filter.insurerId} options={insurers} onChange={(e) => setFilter({ ...filter, insurerId: e.value })} placeholder={t("creditControl.allInsurers")} showClear filter className="w-20rem" />
          <Calendar value={filter.asOf} onChange={(e) => setFilter({ ...filter, asOf: e.value })} showIcon />
          <span className="flex align-items-center gap-2"><Checkbox inputId="ra-overdue" checked={filter.overdueOnly} onChange={(e) => setFilter({ ...filter, overdueOnly: e.checked })} /><label htmlFor="ra-overdue">{t("creditControl.overdueOnly")}</label></span>
        </div>
        {/* the summary keeps the height of a few insurers and its total line from the start, so the detail below does not jump */}
        <DataTable value={data?.insurers || []} dataKey="insurerId" loading={loading} size="small" stripedRows emptyMessage={data ? t("creditControl.none") : " "}
          className="bv-hold-rows-5" footer={`${t("creditControl.total")}: ${data ? `${money(data.summary.total)} (${data.summary.count})` : "-"}`}>
          <Column field="insurerName" header={t("creditControl.insurer")} />
          {BUCKETS.map((b) => <Column key={b} header={labels[b]} body={(r) => money(r[b])} className="bv-num" headerClassName="bv-num" />)}
          <Column header={t("creditControl.total")} body={(r) => <b>{money(r.total)}</b>} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      </div>
      <div className="pe-card">
        <DataTable value={data?.rows || []} dataKey="applicationId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("creditControl.none")}>
          <Column field="insurerName" header={t("creditControl.insurer")} />
          <Column field="policyNumber" header={t("creditControl.policyNumber")} />
          <Column field="clientName" header={t("creditControl.client")} />
          <Column field="receiptNumber" header={t("creditControl.receipt")} />
          <Column header={t("creditControl.collectedOn")} body={(r) => date(r.collectedOn)} />
          <Column header={t("creditControl.remitBy")} body={(r) => `${date(r.remitBy)} (${r.termsDays})`} />
          <Column field="daysOverdue" header={t("creditControl.daysOverdue")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("creditControl.amountDue")} body={(r) => money(r.amountDue)} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      </div>
    </div>
  );
};

export default RemittanceAgeing;
