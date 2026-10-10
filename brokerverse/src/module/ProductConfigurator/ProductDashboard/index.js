import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { TabView, TabPanel } from "primereact/tabview";
import { Chart } from "primereact/chart";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import productConfiguratorService from "../../../services/productConfiguratorService";
import { numberLocale } from "../../../utility/currencyConverter";
import { formatPercent } from "../../../utility/numberFormat";
import { ConfiguratorPage, FilterBar, RowActions, StatusTag, pagingFor, productText } from "../shared/ConfiguratorPage";
import { useChartTheme } from "../../../theme/chartTheme";
import { openConfirm } from "../../../components/ConfirmDialog";
import "./style.scss";

/** Product Configurator > Dashboard: templates, what is configured and in force, and the production of the products. */
const ProductDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const chart = useChartTheme();
  const [templates, setTemplates] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const toast = useRef(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, dash] = await Promise.all([productConfiguratorService.getProductTemplates(), productConfiguratorService.getDashboard()]);
      setTemplates(rows);
      setSummary(dash.summary);
      setAnalytics(dash.analytics);
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("productConfiguratorDashboard.error"), detail: error?.message || t("productConfiguratorDashboard.errorLoadFailed") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // a new draft version copies the template; the confirm names it, its next version and any draft already open
  const cloneProduct = async (row) => {
    const same = templates.filter((r) => r.templateCode === row.templateCode);
    const numberOf = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;
    const next = Math.max(0, ...same.map((r) => numberOf(r.version))) + 1;
    const drafts = same.filter((r) => String(r.status || "").toLowerCase() === "draft").map((r) => r.version);
    let version = null;
    const done = await openConfirm({
      title: t("productConfiguratorDashboard.cloneTitle", { code: row.templateCode }),
      message: t("productConfiguratorDashboard.cloneMessage"),
      facts: [
        { label: t("productConfiguratorDashboard.productName"), value: row.name },
        { label: t("productConfiguratorDashboard.copiedFrom"), value: row.version },
        { label: t("productConfiguratorDashboard.newVersion"), value: `v${next}` },
        { label: t("productConfiguratorDashboard.openDrafts"), value: drafts.join(", "), hidden: !drafts.length },
      ],
      confirmLabel: t("productConfiguratorDashboard.cloneAction"),
      confirmIcon: "pi pi-copy",
      onConfirm: async () => { version = await productConfiguratorService.createProductVersion(row.id); },
    });
    if (!done || !version) return;
    toast.current?.show({ severity: "success", summary: t("productTemplateManager.success"), detail: `${version.templateCode} ${version.version}` });
    navigate(`/product-configurator/template/${version.id}`);
  };

  const s = String(filters.search || "").trim().toLowerCase();
  const rows = templates.filter((r) => (!filters.status || r.status === filters.status)
    && (!filters.lineOfBusiness || String(r.lineOfBusiness).toUpperCase() === filters.lineOfBusiness)
    && (!s || [r.templateCode, r.name, r.productCode, r.productName].some((v) => String(v || "").toLowerCase().includes(s))));
  const lobs = [...new Set(templates.map((r) => String(r.lineOfBusiness || "").toUpperCase()).filter(Boolean))].map((v) => ({ label: v, value: v }));
  const top = analytics?.topProducts || [];
  const trend = analytics?.performanceTrend || [];
  const premium = top.reduce((sum, p) => sum + (p.totalPremium || 0), 0);
  const avgLossRatio = premium ? top.reduce((sum, p) => sum + (p.lossRatio || 0) * (p.totalPremium || 0), 0) / premium : 0;
  const components = summary?.components || {};
  const categories = Object.entries(analytics?.categoryBreakdown || {});
  const performanceChart = {
    labels: trend.map((tr) => tr.month),
    datasets: [
      { label: t("productConfiguratorDashboard.premiumMillions"), data: trend.map((tr) => tr.premium / 1000000), borderColor: chart.primary, backgroundColor: chart.primary, fill: false, yAxisID: "y1" },
      { label: t("productConfiguratorDashboard.lossRatioPercent"), data: trend.map((tr) => tr.lossRatio), borderColor: chart.accent, backgroundColor: chart.accent, fill: false, yAxisID: "y2" },
    ],
  };
  const chartOptions = chart.options({
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "top" } },
    scales: {
      y1: { type: "linear", position: "left", title: { display: true, text: t("productConfiguratorDashboard.premiumPhpMillions") } },
      y2: { type: "linear", position: "right", title: { display: true, text: t("productConfiguratorDashboard.lossRatioPercent") }, grid: { drawOnChartArea: false } },
    },
  });
  const links = [
    ["templates", "pi pi-list", "/product-configurator/templates"], ["coverages", "pi pi-shield", "/product-configurator/coverages"], ["rating", "pi pi-calculator", "/product-configurator/rating"],
    ["underwriting", "pi pi-check-circle", "/product-configurator/underwriting"], ["documents", "pi pi-file", "/product-configurator/documents"],
    ["marketMapping", "pi pi-map", "/product-configurator/market-mapping"], ["riskMapping", "pi pi-sitemap", "/product-configurator/risk-mapping"], ["analytics", "pi pi-chart-bar", "/product-configurator/analytics"],
  ];

  return (
    <ConfiguratorPage screen="dashboard" actions={<Button label={t("productConfiguratorDashboard.createNewProduct")} icon="pi pi-plus" onClick={() => navigate("/product-configurator/create")} />}>
      <Toast ref={toast} />
      <div className="pc-kpis">
        <div className="pc-kpi"><span>{t("productConfiguratorDashboard.activeProducts")}</span><strong>{summary?.active ?? 0}</strong></div>
        <div className="pc-kpi"><span>{t("productConfiguratorDashboard.rulesInForce")}</span><strong>{components["underwriting-rules"] ?? 0}</strong></div>
        <div className="pc-kpi"><span>{t("productConfiguratorDashboard.totalPremium")}</span><strong>{formatCurrency(analytics?.totals?.premium ?? 0)}</strong></div>
        <div className="pc-kpi"><span>{t("productConfiguratorDashboard.avgLossRatio")}</span><strong>{formatPercent(avgLossRatio)}</strong></div>
      </div>
      <TabView className="pc-tabs">
        <TabPanel header={t("productConfiguratorDashboard.productTemplates")} leftIcon="pi pi-list mr-2">
          <FilterBar value={filters} onChange={setFilters} show={["lob", "status"]} options={{ lobs }} />
          <DataTable value={rows} loading={loading} dataKey="id" {...pagingFor(rows.length)} emptyMessage={t("productConfigurator.empty")} size="small">
            <Column field="templateCode" header={t("productConfiguratorDashboard.productCode")} sortable />
            <Column field="name" header={t("productConfiguratorDashboard.productName")} sortable />
            <Column header={t("productTemplateManager.product")} body={(r) => productText(r) || "—"} />
            <Column field="lineOfBusiness" header={t("productConfiguratorDashboard.lineOfBusiness")} sortable />
            <Column field="version" header={t("productConfiguratorDashboard.version")} sortable />
            <Column field="status" header={t("productConfiguratorDashboard.status")} body={(r) => <StatusTag status={r.status} />} sortable />
            <Column header={t("productTemplateManager.inUse")} body={(r) => (r.governsFlow ? <Tag value={t("productTemplateManager.inUseYes")} severity="success" title={t("productTemplateManager.inUseHelp")} /> : <span className="pc-muted">—</span>)} />
            <Column
              header={t("productConfigurator.actions.title")}
              body={(r) => (
                <RowActions
                  row={r}
                  onEdit={(row) => navigate(`/product-configurator/template/${row.id}`)}
                  extra={<Button type="button" icon="pi pi-copy" className="p-button-text p-button-rounded pc-icon-action" tooltip={t("productConfiguratorDashboard.cloneProduct")} tooltipOptions={{ position: "top" }} aria-label={t("productConfiguratorDashboard.cloneProduct")} onClick={() => cloneProduct(r)} />}
                />
              )}
            />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("productConfiguratorDashboard.performanceAnalytics")} leftIcon="pi pi-chart-line mr-2">
          {top.length === 0 ? (
            <div className="pc-empty">{t("productAnalytics.noData")}</div>
          ) : (
            <>
              <div className="grid">
                <div className="col-12 lg:col-8"><h3 className="mt-0">{t("productConfiguratorDashboard.premiumLossRatioTrend")}</h3><Chart type="line" data={performanceChart} options={chartOptions} /></div>
                <div className="col-12 lg:col-4">
                  <h3 className="mt-0">{t("productConfiguratorDashboard.categoryDistribution")}</h3>
                  <Chart type="doughnut" data={{ labels: categories.map(([k]) => k), datasets: [{ data: categories.map(([, c]) => c.percentage), backgroundColor: chart.series(categories.length), borderColor: chart.surface }] }}
                    options={chart.options({})} />
                </div>
              </div>
              <h3>{t("productConfiguratorDashboard.topPerformingProducts")}</h3>
              <DataTable value={top} dataKey="productId" {...pagingFor(top.length)} size="small">
                <Column field="productName" header={t("productConfiguratorDashboard.product")} />
                <Column field="totalPolicies" header={t("productConfiguratorDashboard.policies")} sortable body={(r) => r.totalPolicies.toLocaleString(numberLocale())} />
                <Column field="totalPremium" header={t("productConfiguratorDashboard.premium")} sortable body={(r) => formatCurrency(r.totalPremium)} />
                <Column field="lossRatio" header={t("productConfiguratorDashboard.lossRatio")} sortable body={(r) => formatPercent(r.lossRatio)} />
                <Column field="growth" header={t("productConfiguratorDashboard.growth")} sortable body={(r) => `${r.growth > 0 ? "+" : ""}${formatPercent(r.growth)}`} />
              </DataTable>
            </>
          )}
        </TabPanel>
        <TabPanel header={t("productConfiguratorDashboard.quickActions")} leftIcon="pi pi-bolt mr-2">
          <div className="pc-quick-links">
            {links.map(([key, icon, path]) => (
              <Button key={key} label={t(`productConfigurator.screens.${key}`)} icon={icon} className="p-button-outlined" onClick={() => navigate(path)} />
            ))}
            <Button label={t("productConfiguratorDashboard.commissionSetup")} icon="pi pi-percentage" className="p-button-outlined" onClick={() => navigate("/master/finance/commission-rate-matrix")} />
          </div>
        </TabPanel>
      </TabView>
    </ConfiguratorPage>
  );
};

export default ProductDashboard;
