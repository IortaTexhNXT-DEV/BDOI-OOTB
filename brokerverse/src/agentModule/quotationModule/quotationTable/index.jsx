import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import "../../quotationModule/index.scss";
import { toQuotationRow } from "../store/quotationMiddleWare";
import StatusBadge from "../../../components/StatusBadge";
import { loadQuotationForEdit } from "../../quoteModule/Store/quotationReducer";
import { isFireLob } from "../../endorsementModule/constants/endorsementCategories";
import quotationService from "../../../services/quotationService";
import { useListState, useServerList } from "../../../hooks/useServerList";

/** Sales > Quotations list: paged and searched by the server; the search and page are kept when a quotation is opened. */
const QuotationTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [state, patch] = useListState("quotations", { search: "" });

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await quotationService.getAllQuotations(page, pageSize, null, state.search.trim() || null);
    if (!res.success) throw new Error(res.error);
    return { rows: (res.data || []).map(toQuotationRow), total: res.total };
  }, [state.search]);
  const list = useServerList(fetchPage, { key: "quotations" });

  const handleEdit = (rowData) => {
    const quotationId = rowData.id;
    const rawData = rowData.rawData || rowData;
    const productType = rawData?.productType || rawData?.ProductType || rowData?.PolicyType;
    const navState = { quotationData: rawData, quotationId, fromListing: true, action: "edit" };
    if (productType && isFireLob(productType)) {
      navigate("/agent/quotedetailview", { state: navState });
      return;
    }
    dispatch(loadQuotationForEdit(rawData));
    navigate(`/agent/editquote/policydetails/quotedetails/${quotationId}`, { state: navState });
  };

  const handleViewDetail = (rowData) => {
    navigate("/agent/quotedetailview", { state: { quotationData: rowData.rawData, quotationId: rowData.id, fromListing: true } });
  };

  const actions = (rowData) => {
    const canEdit = ["Draft", "PendingCustomer", "InProgress"].includes(rowData.Status);
    return (
      <div className="flex gap-1 justify-content-end">
        <Button icon="pi pi-eye" text rounded size="small" aria-label={t("quoteListing.viewDetails")} tooltip={t("quoteListing.viewDetails")} tooltipOptions={{ position: "top" }}
          onClick={() => handleViewDetail(rowData)} />
        <Button icon="pi pi-pencil" text rounded size="small" disabled={!canEdit} aria-label={t("quoteListing.editQuotation")} tooltip={t("quoteListing.editQuotation")}
          tooltipOptions={{ position: "top", showOnDisabled: true }} onClick={() => handleEdit(rowData)} />
      </div>
    );
  };

  return (
    <div className="bg-transparent">
      <div className="bv-list-toolbar">
        <span className="p-input-icon-left bv-list-search">
          <i className="pi pi-search" />
          <InputText placeholder={t("quoteListing.search")} aria-label={t("quoteListing.search")} value={state.search} onChange={(e) => patch({ search: e.target.value })} />
        </span>
      </div>
      <DataTable {...list.tableProps} scrollable dataKey="id" size="small" stripedRows className="corrections__table__main" emptyMessage={t("listCommon.noRecords")}>
        <Column header={t("quoteListing.quoteId")} body={(r) => <span className="nowrap">{r.QuoteId || "-"}</span>} />
        <Column header={t("quoteListing.leadName")} body={(r) => r.LeadName || t("quoteListing.unknownLead")} style={{ minWidth: "11rem" }} />
        <Column header={t("quoteListing.policyType")} body={(r) => r.PolicyType || "-"} />
        <Column header={t("quoteListing.grossPremium")} body={(r) => r.GrossPremium} />
        <Column header={t("quoteListing.date")} body={(r) => r.Date || "-"} />
        <Column header={t("quoteListing.status")} body={(r) => <StatusBadge status={r.Status} type="quotation" showTooltip={false} />} />
        <Column header={t("quoteListing.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
      </DataTable>
    </div>
  );
};

export default QuotationTable;
