import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate } from "react-router-dom";
import collectionService from "../../../services/collectionService";
import "./index.scss";
import logger from "../../../utility/logger";
import { useChartTheme } from "../../../theme/chartTheme";
import StatCards from "../../../components/StatCards";
import { ChartCard, DataAsOf, ThemedChart, formatValue } from "../../../components/Dashboard";

const AgingReport = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(null);
  const toast = useRef(null);
  const navigate = useNavigate();
  const chart = useChartTheme();

  useEffect(() => {
    loadAgingReport();
  }, []);

  const loadAgingReport = async () => {
    setLoading(true);
    try {
      const result = await collectionService.getAgingReport();
      if (result.success) {
        setReportData(result.data);
        setAsOf(new Date());
      }
    } catch (error) {
      logger.error("Load aging report error:", error);
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("agingReport.failedToLoadReport"),
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !reportData) {
    return (
      <div className="aging-report-container">
        <Card>
          <div className="p-4 text-center">{t("agingReport.loadingAgingReport")}</div>
        </Card>
      </div>
    );
  }

  const { summary, collections } = reportData;

  // ageing buckets are ordered: one ramp, older = darker (not the status colours: every bucket is money owed)
  const buckets = [
    { key: "current", label: t("agingReport.current"), amount: parseFloat(summary.totalCurrent), share: summary.percentages.current },
    { key: "days1to30", label: t("agingReport.days1to30"), amount: parseFloat(summary.total1to30), share: summary.percentages.days1to30 },
    { key: "days31to60", label: t("agingReport.days31to60"), amount: parseFloat(summary.total31to60), share: summary.percentages.days31to60 },
    { key: "days61to90", label: t("agingReport.days61to90"), amount: parseFloat(summary.total61to90), share: summary.percentages.days61to90 },
    { key: "over90", label: t("agingReport.over90Days"), amount: parseFloat(summary.totalOver90), share: summary.percentages.over90 },
  ];
  const chartData = {
    labels: buckets.map((b) => b.label),
    datasets: [{ label: t("agingReport.outstandingAmount"), data: buckets.map((b) => b.amount), backgroundColor: chart.sequential(buckets.length) }],
  };
  const money = (v) => formatValue("currency", v, { compact: true });
  const figures = [
    { key: "total", label: t("agingReport.totalOutstanding"), value: money(summary.totalOutstanding) },
    ...buckets.map((b) => ({ key: b.key, label: b.label, value: money(b.amount), note: `${b.share}%` })),
  ];

  const clientBodyTemplate = (rowData) => {
    const client = rowData.client;
    if (!client) return "-";
    return `${client.firstName || ""} ${client.lastName || ""}`.trim();
  };

  const outstandingBodyTemplate = (rowData) => {
    return formatCurrency(rowData.outstandingAmount);
  };

  return (
    <div className="aging-report-container">
      <Toast ref={toast} />

      <div className="report-header">
        <Button
          icon="pi pi-arrow-left"
          label={t("agingReport.backToCollections")}
          className="p-button-text"
          onClick={() => navigate("/agent/collections")}
        />
        <h2>{t("agingReport.title")}</h2>
      </div>

      <div className="aging-report-asof"><DataAsOf asOf={asOf} /></div>
      <StatCards items={figures} className="bv-stat-cards--wide" />

      <ChartCard title={t("agingReport.agingDistributionChart")} className="chart-card" exportName="collections-ageing"
        table={{ columns: [{ field: "label", header: t("agingReport.bucket", "Age") }, { field: "amount", header: t("agingReport.outstandingAmount"), format: "currency" }, { field: "share", header: "%", format: "percent" }], rows: buckets }}>
        <ThemedChart type="bar" data={chartData} format="currency" height={260} />
      </ChartCard>

      {/* Detailed Table */}
      <Card title={t("agingReport.collectionsDetail")} className="table-card">
        <DataTable
          value={collections}
          paginator
          rows={20}
          dataKey="id"
          emptyMessage={t("agingReport.noCollectionsFound")}
        >
          <Column
            field="client"
            header={t("agingReport.clientName")}
            body={clientBodyTemplate}
          />
          <Column field="policyNumber" header={t("agingReport.policyNo")} />
          <Column
            field="outstandingAmount"
            header={t("agingReport.outstanding")}
            body={outstandingBodyTemplate}
          />
          <Column
            field="currentAmount"
            header={t("agingReport.current")}
            body={(rowData) => formatCurrency(rowData.currentAmount)}
          />
          <Column
            field="days1to30Amount"
            header={t("agingReport.days1to30")}
            body={(rowData) => formatCurrency(rowData.days1to30Amount)}
          />
          <Column
            field="days31to60Amount"
            header={t("agingReport.days31to60")}
            body={(rowData) => formatCurrency(rowData.days31to60Amount)}
          />
          <Column
            field="days61to90Amount"
            header={t("agingReport.days61to90")}
            body={(rowData) => formatCurrency(rowData.days61to90Amount)}
          />
          <Column
            field="over90DaysAmount"
            header={t("agingReport.over90Days")}
            body={(rowData) => formatCurrency(rowData.over90DaysAmount)}
          />
          <Column
            header={t("agingReport.actions")}
            body={(rowData) => (
              <Button
                label={t("agingReport.view")}
                icon="pi pi-eye"
                className="p-button-sm p-button-outlined"
                onClick={() => navigate(`/agent/collections/${rowData.id}`)}
              />
            )}
          />
        </DataTable>
      </Card>
    </div>
  );
};

export default AgingReport;

