import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import DetailDialog from "../../components/DetailDialog";
import periodEndService from "../../services/periodEndService";
import { dateTime, money } from "./common";
import { saveBlob } from "./statementHelpers";

/**
 * Accounts > Tax > BIR Form 2307 > Batches (TIS-BRD-TAX-03): each "issue all" run of the quarter as a CWB- batch, and
 * a batch's EWT detail per certificate and ATC with its Excel.
 */
const Bir2307Batches = ({ year, quarter, reloadKey, onError }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await periodEndService.batches2307({ year, quarter }));
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }, [year, quarter, onError]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const open = async (row) => {
    try {
      setBatch(await periodEndService.batch2307(row.id));
    } catch (e) {
      onError?.(e);
    }
  };
  const excel = async () => {
    try {
      const f = await periodEndService.batch2307File(batch.id);
      saveBlob(f.blob, f.fileName);
    } catch (e) {
      onError?.(e);
    }
  };

  return (
    <section className="pe-card" aria-label={t("bir2307Batches.title")}>
      <h3 className="mt-0">{t("bir2307Batches.title")}</h3>
      <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("bir2307Batches.none")}>
        <Column field="batchNumber" header={t("bir2307Batches.batch")} />
        <Column header={t("bir2307Batches.created")} body={(r) => dateTime(r.createdAt)} />
        <Column field="certificates" header={t("periodEnd.confirmations.certificates")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("periodEnd.bir.incomePayments")} body={(r) => money(r.totalIncome)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("periodEnd.bir.taxWithheld")} body={(r) => money(r.totalTax)} className="bv-num" headerClassName="bv-num" />
        <Column body={(r) => <Button icon="pi pi-eye" size="small" outlined label={t("periodEnd.bir.view")} onClick={() => open(r)} aria-label={`${t("periodEnd.bir.view")} ${r.batchNumber}`} />} />
      </DataTable>
      <DetailDialog header={batch ? `${t("bir2307Batches.batch")} ${batch.batchNumber}` : ""} visible={!!batch} onHide={() => setBatch(null)} size="lg"
        footer={batch && (
          <>
            <Button label={t("detailView.close")} outlined onClick={() => setBatch(null)} />
            <Button icon="pi pi-file-excel" label={t("bir2307Batches.excel")} onClick={excel} />
          </>
        )}>
        {batch && (
          <DataTable value={batch.detail} size="small" stripedRows>
            <Column field="certificateNumber" header={t("periodEnd.bir.certNo")} />
            <Column field="payeeName" header={t("periodEnd.bir.payeeName")} />
            <Column field="payeeTin" header={t("periodEnd.bir.tin")} />
            <Column field="atc" header="ATC" />
            <Column header={t("periodEnd.bir.incomePayments")} body={(r) => money(r.income)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("periodEnd.bir.taxWithheld")} body={(r) => money(r.tax)} className="bv-num" headerClassName="bv-num" />
          </DataTable>
        )}
      </DetailDialog>
    </section>
  );
};

export default Bir2307Batches;
