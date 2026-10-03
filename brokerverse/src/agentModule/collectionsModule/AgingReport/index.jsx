import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate } from "react-router-dom";
import collectionService from "../../../services/collectionService";
import "./index.scss";
import logger from "../../../utility/logger";

const AgingReport = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadAgingReport();
  }, []);

  const loadAgingReport = async () => {
    setLoading(true);
    try {
      const result = await collectionService.getAgingReport();
      if (result.success) {
        setReportData(result.data);
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

  // Chart data
  const chartData = {
    labels: [t("agingReport.current"), t("agingReport.days1to30"), t("agingReport.days31to60"), t("agingReport.days61to90"), t("agingReport.over90Days")],
    datasets: [
      {
        label: t("agingReport.outstandingAmount"),
        data: [
          parseFloat(summary.totalCurrent),
          parseFloat(summary.total1to30),
          parseFloat(summary.total31to60),
          parseFloat(summary.total61to90),
          parseFloat(summary.totalOver90),
        ],
        backgroundColor: [
          "#4caf50",
          "#ffc107",
          "#ff9800",
          "#f44336",
          "#9c27b0",
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
      },
      title: {
        display: true,
        text: "Collections Aging Distribution",
      },
    },
  };

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

      {/* Summary Cards */}
      <div className="summary-cards">
        <Card className="summary-card total">
          <div className="card-content">
            <h3>{t("agingReport.totalOutstanding")}</h3>
            <p className="amount">{formatCurrency(summary.totalOutstanding)}</p>
          </div>
        </Card>

        <Card className="summary-card current">
          <div className="card-content">
            <h3>{t("agingReport.current")}</h3>
            <p className="amount">{formatCurrency(summary.totalCurrent)}</p>
            <span className="percentage">{summary.percentages.current}%</span>
          </div>
        </Card>

        <Card className="summary-card days-1-30">
          <div className="card-content">
            <h3>{t("agingReport.days1to30")}</h3>
            <p className="amount">{formatCurrency(summary.total1to30)}</p>
            <span className="percentage">{summary.percentages.days1to30}%</span>
          </div>
        </Card>

        <Card className="summary-card days-31-60">
          <div className="card-content">
            <h3>{t("agingReport.days31to60")}</h3>
            <p className="amount">{formatCurrency(summary.total31to60)}</p>
            <span className="percentage">{summary.percentages.days31to60}%</span>
          </div>
        </Card>

        <Card className="summary-card days-61-90">
          <div className="card-content">
            <h3>{t("agingReport.days61to90")}</h3>
            <p className="amount">{formatCurrency(summary.total61to90)}</p>
            <span className="percentage">{summary.percentages.days61to90}%</span>
          </div>
        </Card>

        <Card className="summary-card over-90">
          <div className="card-content">
            <h3>{t("agingReport.over90Days")}</h3>
            <p className="amount">{formatCurrency(summary.totalOver90)}</p>
            <span className="percentage">{summary.percentages.over90}%</span>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card title={t("agingReport.agingDistributionChart")} className="chart-card">
        <Chart type="pie" data={chartData} options={chartOptions} />
      </Card>

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

