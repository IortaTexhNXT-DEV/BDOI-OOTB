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
import { hasPermission } from "../../utils/canOpen";
import { PageHeader, StatusTag, formatDate } from "./shared";
import StatCards from "../../components/StatCards";
import "./index.scss";

const STATUSES = ["draft", "sent", "bound", "declined", "issued", "cancelled"];
const SOURCES = ["quote", "broker-slip", "direct", "direct-policy"];

/** Operations > Placement Slips: firm orders to the insurers, their binding status and the policies issued from them. */
const PlacementList = () => {
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
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await placementService.listPlacements({ page: page.first / page.rows + 1, pageSize: page.rows, status: status && status !== "all" ? status : undefined, source: source && source !== "all" ? source : undefined, search: search || undefined });
      setRows(res.data || []);
      setTotal(res.total || 0);
      if ((!status || status === "all") && !search && (!source || source === "all")) {
        setCounts(res.counts || {});
        setCountsLoaded(true);
      }
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 4000 });
    } finally {
      setLoading(false);
    }
  }, [page, status, source, search, t]);

  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  const statusOptions = [{ label: t("placement.list.allStatuses"), value: "all" }, ...STATUSES.map((s) => ({ label: t(`placement.status.${s}`), value: s }))];
  const sourceOptions = [{ label: t("placement.list.allSources"), value: "all" }, ...SOURCES.map((s) => ({ label: t(`placement.source.${s}`), value: s }))];
  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={t("placement.placementSlip.listTitle")}>
        {hasPermission("write:policies") && (
          <Button label={t("placement.recordPolicy.title")} icon="pi pi-file-import" severity="secondary" outlined onClick={() => navigate("/placement/record-issued-policy")} className="mr-2" />
        )}
        <Button label={t("placement.placementSlip.newDirect")} icon="pi pi-plus" onClick={() => navigate("/placement/placement-slips/new")} />
      </PageHeader>

      {/* the counts per status double as a status filter */}
      <StatCards items={["draft", "sent", "bound", "issued"].map((s) => ({
        key: s, label: t(`placement.status.${s}`), value: countsLoaded ? counts[s] || 0 : null, active: status === s,
        onClick: () => { setStatus(status === s ? "all" : s); setPage({ ...page, first: 0 }); },
      }))} />

      <div className="placement-card">
        <div className="toolbar">
          <span className="p-input-icon-left search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => { setSearch(e.target.value); setPage({ ...page, first: 0 }); }} placeholder={t("placement.list.searchPlacements")} />
          </span>
          <Dropdown value={status} options={statusOptions} onChange={(e) => { setStatus(e.value); setPage({ ...page, first: 0 }); }} className="status-filter" />
          <Dropdown value={source} options={sourceOptions} onChange={(e) => { setSource(e.value); setPage({ ...page, first: 0 }); }} className="status-filter" />
        </div>
        <DataTable value={rows} lazy paginator first={page.first} rows={page.rows} totalRecords={total} onPage={(e) => setPage({ first: e.first, rows: e.rows })} rowsPerPageOptions={[20, 50, 100]}
          loading={loading} dataKey="id" stripedRows size="small" className="placement-grid" emptyMessage={t("placement.list.emptyPlacements")}
          onRowClick={(e) => navigate(`/placement/placement-slips/${e.data.id}`)} rowClassName={() => "clickable"}>
          <Column field="placementNumber" header={t("placement.fields.placementNumber")} body={(r) => <span className="doc-number">{r.placementNumber}</span>} />
          <Column field="insuredName" header={t("placement.fields.insured")} body={(r) => r.insuredName || r.customerName} style={{ minWidth: "11rem" }} />
          <Column field="productType" header={t("placement.fields.product")} body={(r) => (
            <span className="product-cell"><span className="product-name">{r.productType}</span>{r.lob && <span className="lob-chip">{r.lob}</span>}</span>
          )} />
          <Column field="insuranceCompanyName" header={t("placement.fields.leadInsurer")} body={(r) => (
            <span className="insurer-cell">
              <span>{r.insuranceCompanyName}</span>
              {r.participantsCount > 1 && <span className="co-chip">{t("placement.list.coInsurers", { count: r.participantsCount - 1 })}</span>}
            </span>
          )} />
          <Column field="grossPremium" header={t("placement.fields.grossPremium")} body={(r) => formatCurrency(r.grossPremium)} className="num" headerClassName="num" />
          <Column header={t("placement.fields.period")} body={(r) => <span className="period-cell"><span className="nowrap">{formatDate(r.inceptionDate)}</span> - <span className="nowrap">{formatDate(r.expiryDate)}</span></span>} />
          <Column header={t("placement.fields.confirmed")} body={(r) => <span className="nowrap">{`${r.confirmedCount || 0} / ${r.participantsCount || 0}`}</span>} className="num" headerClassName="num" />
          <Column field="source" header={t("placement.fields.source")} body={(r) => t(`placement.source.${r.source}`)} />
          <Column field="status" header={t("placement.fields.status")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("placement.fields.policy")} body={(r) => <span className="nowrap">{r.policyNumber || "-"}</span>} />
        </DataTable>
      </div>
    </div>
  );
};

export default PlacementList;
