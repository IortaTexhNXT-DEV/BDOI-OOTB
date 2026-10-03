import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { TabPanel, TabView } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import paymentsService from "../../../services/paymentsService";
import { toPaymentRow } from "../store/paymentMiddleware";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { useListState, useServerList } from "../../../hooks/useServerList";
import { statusLabel, statusSeverity } from "../../../utils/statusSeverity";
import "./index.scss";

const TABS = [
  { status: "PAID", labelKey: "payments.paid", summaryKey: "paid" },
  { status: "PENDING", labelKey: "payments.pending", summaryKey: "pending" },
  { status: "REVIEWING", labelKey: "payments.reviewing", summaryKey: "reviewing" },
];

/**
 * Operations > Payments: premium bills by payment status (Paid / Pending / Reviewing), paged and searched by the
 * server. The tab, search and page are kept while a policy is opened.
 */
const PaymentTableCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, patch] = useListState("payments", { tab: 0, search: "" });
  const [summary, setSummary] = useState(null);
  const tab = TABS[state.tab] || TABS[0];

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const res = await paymentsService.getPayments({ status: tab.status, page, pageSize, search: state.search.trim() || undefined });
    if (res.summary) setSummary(res.summary);
    return { rows: (res.data || []).map(toPaymentRow), total: res.total ?? res.pagination?.total ?? 0 };
  }, [tab.status, state.search]);
  const list = useServerList(fetchPage, { key: "payments" });

  const header = (tb) => {
    const count = summary?.[tb.summaryKey]?.count;
    return `${t(tb.labelKey)}${count === undefined ? "" : ` (${count})`}`;
  };
  const view = (r) => (
    <Button icon="pi pi-eye" text rounded size="small" aria-label={t("payments.viewPolicy", { defaultValue: "View policy" })} tooltip={t("payments.viewPolicy", { defaultValue: "View policy" })}
      tooltipOptions={{ position: "top" }} disabled={!r.policyId} onClick={() => navigate(`/agent/policydetail/${r.policyId}`)} />
  );

  return (
    <div className="lead__listing__card__container mt-4">
      <Card>
        <TabView className="bv-tabbar" activeIndex={state.tab} onTabChange={(e) => patch({ tab: e.index })}>
          {TABS.map((tb) => <TabPanel key={tb.status} header={header(tb)} />)}
        </TabView>
        <div className="bv-list-toolbar mt-3">
          <span className="p-input-icon-left bv-list-search">
            <i className="pi pi-search" />
            <InputText placeholder={t("payments.searchPlaceholder", { defaultValue: "Search by policy number, bill number or client" })} aria-label={t("common.search")}
              value={state.search} onChange={(e) => patch({ search: e.target.value })} />
          </span>
        </div>
        <DataTable {...list.tableProps} scrollable dataKey="id" size="small" stripedRows className="corrections__table__main" emptyMessage={list.error || t("listCommon.noRecords")}>
          <Column header={t("tables.type")} body={(r) => r.type} />
          <Column header={t("tables.assuredName")} body={(r) => r.name || "-"} style={{ minWidth: "11rem" }} />
          <Column header={t("tables.clientId")} body={(r) => <span className="nowrap">{r.clintid || "-"}</span>} />
          <Column header={t("tables.policyNumber")} body={(r) => <span className="nowrap">{r.policyNo || "-"}</span>} />
          <Column header={t("tables.grossPremium")} body={(r) => r.grosspremium} />
          <Column header={t("payments.billDate", { defaultValue: "Bill date" })} body={(r) => formatAppDate(r.policyIssued, { empty: "-" })} />
          <Column header={t("payments.dueDate", { defaultValue: "Due date" })} body={(r) => formatAppDate(r.policyExpird, { empty: "-" })} />
          <Column header={t("tables.status")} body={(r) => (r.status ? <Tag value={statusLabel(String(r.status).toLowerCase())} severity={statusSeverity(r.status)} /> : null)} />
          <Column header={t("tables.actions")} body={view} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
        </DataTable>
      </Card>
    </div>
  );
};

export default PaymentTableCard;
