import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import placementService from "../../services/placementService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import StatCards from "../../components/StatCards";
import { PageHeader, StatusTag, formatDate } from "./shared";
import "./index.scss";

const STATUSES = ["draft", "submitted", "responses-in", "closed", "cancelled"];

/** Operations > Broker Slips: market submissions with the insurer responses received. */
const BrokerSlipList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [page, setPage] = useState({ first: 0, rows: 20 });
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await placementService.listSlips({ page: page.first / page.rows + 1, pageSize: page.rows, status: status && status !== "all" ? status : undefined, search: search || undefined });
      setRows(res.data || []);
      setTotal(res.total || 0);
      if ((!status || status === "all") && !search) {
        setCounts(res.counts || {});
        setCountsLoaded(true);
      }
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 4000 });
    } finally {
      setLoading(false);
    }
  }, [page, status, search, t]);

  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  const statusOptions = [{ label: t("placement.list.allStatuses"), value: "all" }, ...STATUSES.map((s) => ({ label: t(`placement.status.${s}`), value: s }))];
  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={t("placement.brokerSlip.listTitle")}>
        <Button label={t("placement.brokerSlip.new")} icon="pi pi-plus" onClick={() => navigate("/placement/broker-slips/new")} />
      </PageHeader>

      {/* the counts per status double as a status filter */}
      <StatCards items={["submitted", "responses-in", "draft", "closed"].map((s) => ({
        key: s, label: t(`placement.status.${s}`), value: countsLoaded ? counts[s] || 0 : null, active: status === s,
        onClick: () => { setStatus(status === s ? "all" : s); setPage({ ...page, first: 0 }); },
      }))} />

      <div className="placement-card">
        <div className="toolbar">
          <span className="p-input-icon-left search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => { setSearch(e.target.value); setPage({ ...page, first: 0 }); }} placeholder={t("placement.list.searchSlips")} />
          </span>
          <Dropdown value={status} options={statusOptions} onChange={(e) => { setStatus(e.value); setPage({ ...page, first: 0 }); }} className="status-filter" />
        </div>
        <DataTable value={rows} lazy paginator first={page.first} rows={page.rows} totalRecords={total} onPage={(e) => setPage({ first: e.first, rows: e.rows })} rowsPerPageOptions={[20, 50, 100]}
          loading={loading} dataKey="id" stripedRows size="small" className="placement-grid" emptyMessage={t("placement.list.emptySlips")}
          onRowClick={(e) => navigate(`/placement/broker-slips/${e.data.id}`)} rowClassName={() => "clickable"}>
          <Column field="slipNumber" header={t("placement.fields.slipNumber")} body={(r) => <span className="doc-number">{r.slipNumber}</span>} />
          <Column field="insuredName" header={t("placement.fields.insured")} body={(r) => r.insuredName || r.customerName} />
          <Column field="productType" header={t("placement.fields.product")} body={(r) => <>{r.productType}<span className="lob-chip">{r.lob}</span></>} />
          <Column field="sumInsured" header={t("placement.fields.sumInsured")} body={(r) => formatCurrency(r.sumInsured)} className="num" headerClassName="num" />
          <Column header={t("placement.fields.responses")} body={(r) => `${r.offersReceived || 0} / ${r.offersTotal || 0}${r.offersDeclined ? ` (${t("placement.list.declinedCount", { count: r.offersDeclined })})` : ""}`} />
          <Column field="bestPremium" header={t("placement.fields.bestPremium")} body={(r) => (r.bestPremium == null ? "-" : formatCurrency(r.bestPremium))} className="num" headerClassName="num" />
          <Column field="responseDueDate" header={t("placement.fields.responseDue")} body={(r) => formatDate(r.responseDueDate)} />
          <Column field="ageDays" header={t("placement.fields.age")} body={(r) => t("placement.list.days", { count: r.ageDays })} />
          <Column field="status" header={t("placement.fields.status")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("placement.fields.quotationSlip")} body={(r) => r.quotationNumber || "-"} />
        </DataTable>
      </div>
    </div>
  );
};

export default BrokerSlipList;
