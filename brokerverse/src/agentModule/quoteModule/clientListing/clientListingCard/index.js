import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Card } from "primereact/card";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import clientService from "../../../../services/clientService";
import { getClientEditMiddleWare } from "../store/clientsMiddleware";
import { toClientRow } from "../store/clientsReducer";
import { formatDate } from "../../../../utility/dateFormat";
import { useListState, useServerList } from "../../../../hooks/useServerList";
import { statusLabel, statusSeverity } from "../../../../utils/statusSeverity";

const TABS = [
  { key: "all", labelKey: "clients.all", clientType: undefined },
  { key: "individual", labelKey: "clients.individualTab", clientType: "individual" },
  { key: "company", labelKey: "clients.company", clientType: "corporate" },
];

/**
 * Clients list: All / Individual / Company tabs over every client, paged and searched by the server (name, client
 * code, e-mail, phone). The tab, search and page are kept while a client is opened.
 */
const ClientListingCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [state, patch] = useListState("clients", { tab: 0, search: "" });
  const clientType = TABS[state.tab]?.clientType;

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await clientService.getClients(page, pageSize, { search: state.search.trim(), clientType });
    if (!res.success) throw new Error(res.error);
    const body = res.data || {};
    const clients = body.data?.clients || [];
    return { rows: clients.map(toClientRow), total: body.data?.pagination?.totalCount ?? body.total ?? clients.length };
  }, [state.search, clientType]);
  const list = useServerList(fetchPage, { key: "clients" });

  const openClient = (row) => navigate(`/agent/clientview/${row.id || row.LeadID}`);
  const editClient = (row) => {
    dispatch(getClientEditMiddleWare(row));
    navigate("/agent/clientedit");
  };

  const actions = (row) => (
    <div className="flex gap-1 justify-content-end">
      <Button icon="pi pi-eye" text rounded size="small" aria-label={t("clients.view", { defaultValue: "View" })} tooltip={t("clients.view", { defaultValue: "View" })}
        tooltipOptions={{ position: "top" }} onClick={(e) => { e.stopPropagation(); openClient(row); }} />
      <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("clients.edit", { defaultValue: "Edit" })} tooltip={t("clients.edit", { defaultValue: "Edit" })}
        tooltipOptions={{ position: "top" }} onClick={(e) => { e.stopPropagation(); editClient(row); }} />
    </div>
  );
  const latestStatus = (row) => (row.ProductDescription && row.ProductDescription !== "N/A"
    ? <Tag value={statusLabel(row.ProductDescription)} severity={statusSeverity(row.ProductDescription)} />
    : <span className="text-color-secondary">-</span>);

  return (
    <div className="lead__listing__card__container mt-4">
      <Card>
        <TabView className="bv-tabbar" activeIndex={state.tab} onTabChange={(e) => patch({ tab: e.index })}>
          {TABS.map((tab) => <TabPanel key={tab.key} header={t(tab.labelKey)} />)}
        </TabView>
        <div className="bv-list-toolbar mt-3">
          <span className="p-input-icon-left bv-list-search">
            <i className="pi pi-search" />
            <InputText placeholder={t("clients.search")} aria-label={t("clients.search")} value={state.search} onChange={(e) => patch({ search: e.target.value })} />
          </span>
        </div>
        <DataTable {...list.tableProps} scrollable dataKey="id" size="small" stripedRows className="corrections__table__main" onRowClick={(e) => openClient(e.data)} rowClassName={() => "cursor-pointer"}
          emptyMessage={list.error ? t("clients.errorLoadingClients", { message: list.error }) : t("listCommon.noRecords")}>
          <Column header={t("clients.clientIdSearch")} body={(r) => <span className="nowrap">{r.LeadID || "-"}</span>} />
          <Column header={t("clients.assuredName")} body={(r) => r.DisplayName || r.FirstName || "-"} style={{ minWidth: "11rem" }} />
          <Column header={t("clients.category")} body={(r) => (r.category === "Corporate" ? t("clients.company") : t("clients.individualTab"))} />
          <Column header={t("leads.col.email")} body={(r) => <span className="bv-break">{r.EmailID || "-"}</span>} style={{ minWidth: "11rem" }} />
          <Column header={t("leads.col.mobile")} body={(r) => <span className="nowrap">{r.ContactNumber || "-"}</span>} />
          <Column header={t("clients.clientSince")} body={(r) => formatDate(r.createdAt, { empty: "-" })} />
          <Column header={t("clients.policies")} body={(r) => r.Quotes} />
          <Column header={t("clients.latestPolicyStatus")} body={latestStatus} />
          <Column header={t("clients.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
        </DataTable>
      </Card>
    </div>
  );
};

export default ClientListingCard;
