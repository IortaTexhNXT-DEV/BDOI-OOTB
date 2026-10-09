import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import placementService from "../../services/placementService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { PageHeader, StatusTag, formatDate } from "./shared";
import { EpolicyDialog } from "./EpolicyForm";
import "./index.scss";

/**
 * Record e-Policy: the e-policies the insurers send back, recorded against the placement slip they answer (sent or
 * acknowledged). Nothing is issued here: the placement then waits for the check against the slip and the booking.
 */
const RecordEpolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ first: 0, rows: 20 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await placementService.listPlacements({ page: page.first / page.rows + 1, pageSize: page.rows, status: "sent,acknowledged", search: search || undefined });
      setRows(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 4000 });
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  const choose = async (row) => {
    try {
      setSelected(await placementService.getPlacement(row.id));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 4000 });
    }
  };

  return (
    <div className="placement-page">
      <Toast ref={toast} />
      <PageHeader title={t("placement.recordEpolicy.title")} subtitle={t("placement.recordEpolicy.subtitle")} onBack={() => navigate("/placement/placement-slips")} />
      <div className="placement-card">
        <div className="toolbar">
          <span className="p-input-icon-left search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => { setSearch(e.target.value); setPage({ ...page, first: 0 }); }} placeholder={t("placement.list.searchPlacements")} />
          </span>
        </div>
        <DataTable value={rows} lazy paginator first={page.first} rows={page.rows} totalRecords={total} onPage={(e) => setPage({ first: e.first, rows: e.rows })} rowsPerPageOptions={[20, 50, 100]}
          loading={loading} dataKey="id" stripedRows size="small" className="placement-grid" emptyMessage={t("placement.recordEpolicy.empty")}
          onRowClick={(e) => choose(e.data)} rowClassName={() => "clickable"}>
          <Column field="placementNumber" header={t("placement.fields.placementNumber")} body={(r) => <span className="doc-number">{r.placementNumber}</span>} />
          <Column field="insuredName" header={t("placement.fields.insured")} body={(r) => r.insuredName || r.customerName} style={{ minWidth: "11rem" }} />
          <Column field="productType" header={t("placement.fields.product")} />
          <Column field="insuranceCompanyName" header={t("placement.fields.leadInsurer")} />
          <Column field="grossPremium" header={t("placement.fields.grossPremium")} body={(r) => formatCurrency(r.grossPremium)} className="num" headerClassName="num" />
          <Column header={t("placement.fields.sent")} body={(r) => <span className="nowrap">{formatDate(r.sentAt)}</span>} />
          <Column field="status" header={t("placement.fields.status")} body={(r) => <StatusTag status={r.status} />} />
        </DataTable>
      </div>
      {selected && (
        <EpolicyDialog placement={selected} visible={Boolean(selected)} onHide={() => setSelected(null)}
          onSaved={(saved) => navigate(`/placement/placement-slips/${saved.id}`)} />
      )}
    </div>
  );
};

export default RecordEpolicy;
