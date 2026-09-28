import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Chart } from 'primereact/chart';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import productConfiguratorService from '../../../services/productConfiguratorService';
import mastersService from '../../../services/mastersService';
import './style.scss';

const ProductDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [productTemplates, setProductTemplates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [categoryValues, setCategoryValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const toast = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templates, analyticsData, categoryOptions] = await Promise.all([
        productConfiguratorService.getProductTemplates(),
        productConfiguratorService.getProductAnalytics(),
        mastersService.options('product-category')
      ]);
      setProductTemplates(templates);
      setAnalytics(analyticsData);
      setCategoryValues([...new Set([...categoryOptions.map((o) => o.value), ...templates.map((p) => p.category)])].filter(Boolean));
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: t('productConfiguratorDashboard.error'),
        detail: error?.message || t('productConfiguratorDashboard.errorLoadFailed')
      });
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const cloneProduct = async (rowData) => {
    try {
      const version = await productConfiguratorService.createProductVersion(rowData.id);
      toast.current?.show({
        severity: 'success',
        summary: t('productTemplateManager.success'),
        detail: `${version.templateCode} ${version.version}`
      });
      navigate(`/product-configurator/template/${version.id}`);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('productConfiguratorDashboard.error'), detail: error.message });
    }
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text p-button-primary"
          tooltip={t('productConfiguratorDashboard.configureProduct')}
          onClick={() => navigate(`/product-configurator/template/${rowData.id}`)}
        />
        <Button
          icon="pi pi-copy"
          className="p-button-rounded p-button-text"
          tooltip={t('productConfiguratorDashboard.cloneProduct')}
          onClick={() => cloneProduct(rowData)}
        />
        <Button
          icon="pi pi-chart-line"
          className="p-button-rounded p-button-text"
          tooltip={t('productConfiguratorDashboard.viewAnalytics')}
          onClick={() => navigate('/product-configurator/analytics')}
        />
      </div>
    );
  };

  const categoryBreakdownChart = {
    labels: Object.keys(analytics?.categoryBreakdown || {}),
    datasets: [{
      data: Object.values(analytics?.categoryBreakdown || {}).map(c => c.percentage),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
      hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
    }]
  };

  const performanceChart = {
    labels: analytics?.performanceTrend?.map((tr) => tr.month) || [],
    datasets: [
      {
        label: t('productConfiguratorDashboard.premiumMillions'),
        data: analytics?.performanceTrend?.map((tr) => tr.premium / 1000000) || [],
        borderColor: '#42A5F5',
        fill: false,
        yAxisID: 'y1'
      },
      {
        label: t('productConfiguratorDashboard.lossRatioPercent'),
        data: analytics?.performanceTrend?.map((tr) => tr.lossRatio) || [],
        borderColor: '#FFA726',
        fill: false,
        yAxisID: 'y2'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y1: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: t('productConfiguratorDashboard.premiumPhpMillions')
        }
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: t('productConfiguratorDashboard.lossRatioPercent')
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  const filteredTemplates = selectedCategory === 'All'
    ? productTemplates
    : productTemplates.filter((p) => p.category === selectedCategory);

  const categories = [
    { label: t('productConfiguratorDashboard.all'), value: 'All' },
    ...categoryValues.map((value) => ({ label: value, value }))
  ];

  const topProducts = analytics?.topProducts || [];
  const totalTopPremium = topProducts.reduce((total, p) => total + (p.totalPremium || 0), 0);
  const avgLossRatio = totalTopPremium
    ? topProducts.reduce((total, p) => total + (p.lossRatio || 0) * (p.totalPremium || 0), 0) / totalTopPremium
    : 0;
  const commissionRates = productTemplates.map((p) => p.commissionRate).filter((rate) => rate !== null && rate !== undefined);
  const avgCommission = commissionRates.length
    ? commissionRates.reduce((total, rate) => total + Number(rate), 0) / commissionRates.length
    : 0;

  return (
    <div className="product-dashboard">
      <Toast ref={toast} />

      <div className="dashboard-header">
        <h2>{t('productConfiguratorDashboard.title')}</h2>
        <div className="header-actions">
          <Button
            label={t('productConfiguratorDashboard.createNewProduct')}
            icon="pi pi-plus"
            className="p-button-primary"
            onClick={() => navigate('/product-configurator/create')}
          />
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <Card>
            <div className="stat-content">
              <span className="stat-label">{t('productConfiguratorDashboard.activeProducts')}</span>
              <span className="stat-value">
                {productTemplates.filter((p) => p.status === 'Active').length}
              </span>
              <span className="stat-change positive">{t('productConfiguratorDashboard.fromLastMonth')}</span>
            </div>
          </Card>
        </div>
        <div className="stat-card">
          <Card>
            <div className="stat-content">
              <span className="stat-label">{t('productConfiguratorDashboard.totalPremium')}</span>
              <span className="stat-value">{formatCurrency(analytics?.totals?.premium ?? 0)}</span>
              <span className="stat-change positive">{t('productConfiguratorDashboard.ytd')}</span>
            </div>
          </Card>
        </div>
        <div className="stat-card">
          <Card>
            <div className="stat-content">
              <span className="stat-label">{t('productConfiguratorDashboard.avgLossRatio')}</span>
              <span className="stat-value">{avgLossRatio.toFixed(1)}%</span>
              <span className="stat-change positive">{t('productConfiguratorDashboard.improved')}</span>
            </div>
          </Card>
        </div>
        <div className="stat-card">
          <Card>
            <div className="stat-content">
              <span className="stat-label">{t('productConfiguratorDashboard.avgCommission')}</span>
              <span className="stat-value">{avgCommission.toFixed(1)}%</span>
              <span className="stat-change neutral">{t('productConfiguratorDashboard.noChange')}</span>
            </div>
          </Card>
        </div>
      </div>

      <TabView>
        <TabPanel header={t('productConfiguratorDashboard.productTemplates')} leftIcon="pi pi-list">
          <div className="template-controls">
            <div className="left-controls">
              <Dropdown
                value={selectedCategory}
                options={categories}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setSelectedCategory(e.value)}
                placeholder={t('productConfiguratorDashboard.filterByCategory')}
                className="category-filter"
              />
            </div>
            <div className="right-controls">
              <span className="p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={t('productConfiguratorDashboard.searchProducts')}
                />
              </span>
            </div>
          </div>

          <DataTable
            value={filteredTemplates}
            paginator
            rows={10}
            loading={loading}
            globalFilter={globalFilter}
            className="product-table"
          >
            <Column field="templateCode" header={t('productConfiguratorDashboard.productCode')} sortable />
            <Column field="name" header={t('productConfiguratorDashboard.productName')} sortable />
            <Column field="category" header={t('productConfiguratorDashboard.category')} sortable />
            <Column field="lineOfBusiness" header={t('productConfiguratorDashboard.lineOfBusiness')} sortable />
            <Column field="version" header={t('productConfiguratorDashboard.version')} sortable />
            <Column field="status" header={t('productConfiguratorDashboard.status')} body={statusBodyTemplate} sortable />
            <Column field="baseRate" header={t('productConfiguratorDashboard.baseRate')} sortable />
            <Column field="commissionRate" header={t('productConfiguratorDashboard.commissionRate')} sortable />
            <Column header={t('productConfiguratorDashboard.actions')} body={actionBodyTemplate} />
          </DataTable>
        </TabPanel>

        <TabPanel header={t('productConfiguratorDashboard.performanceAnalytics')} leftIcon="pi pi-chart-line">
          <div className="analytics-grid">
            <div className="chart-container">
              <Card title={t('productConfiguratorDashboard.premiumLossRatioTrend')}>
                <Chart type="line" data={performanceChart} options={chartOptions} />
              </Card>
            </div>
            <div className="chart-container">
              <Card title={t('productConfiguratorDashboard.categoryDistribution')}>
                <Chart type="doughnut" data={categoryBreakdownChart} />
              </Card>
            </div>
          </div>

          <Card title={t('productConfiguratorDashboard.topPerformingProducts')} className="top-products-card">
            <DataTable value={analytics?.topProducts || []}>
              <Column field="productName" header={t('productConfiguratorDashboard.product')} />
              <Column field="totalPolicies" header={t('productConfiguratorDashboard.policies')} sortable
                body={(rowData) => rowData.totalPolicies.toLocaleString()} />
              <Column field="totalPremium" header={t('productConfiguratorDashboard.premium')} sortable
                body={(rowData) => formatCurrency(rowData.totalPremium)} />
              <Column field="lossRatio" header={t('productConfiguratorDashboard.lossRatio')} sortable
                body={(rowData) => (
                  <div className="loss-ratio-cell">
                    <ProgressBar
                      value={rowData.lossRatio}
                      showValue={false}
                      style={{ height: '20px' }}
                      color={rowData.lossRatio > 70 ? '#f44336' :
                             rowData.lossRatio > 60 ? '#ff9800' : '#4caf50'}
                    />
                    <span>{rowData.lossRatio}%</span>
                  </div>
                )} />
              <Column field="growth" header={t('productConfiguratorDashboard.growth')} sortable
                body={(rowData) => (
                  <Tag
                    value={`${rowData.growth > 0 ? '+' : ''}${rowData.growth}%`}
                    severity={rowData.growth > 0 ? 'success' : 'danger'}
                  />
                )} />
            </DataTable>
          </Card>
        </TabPanel>

        <TabPanel header={t('productConfiguratorDashboard.quickActions')} leftIcon="pi pi-bolt">
          <div className="quick-actions-grid">
            <Card title={t('productConfiguratorDashboard.productManagement')} className="action-card">
              <div className="action-list">
                <Button
                  label={t('productConfiguratorDashboard.createNewProduct')}
                  icon="pi pi-plus"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/create')}
                />
                <Button
                  label={t('productConfiguratorDashboard.manageCoverages')}
                  icon="pi pi-shield"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/coverages')}
                />
                <Button
                  label={t('productConfiguratorDashboard.configureRatingRules')}
                  icon="pi pi-calculator"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/rating')}
                />
              </div>
            </Card>

            <Card title={t('productConfiguratorDashboard.underwritingCompliance')} className="action-card">
              <div className="action-list">
                <Button
                  label={t('productConfiguratorDashboard.underwritingRules')}
                  icon="pi pi-check-circle"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/underwriting')}
                />
                <Button
                  label={t('productConfiguratorDashboard.documentTemplates')}
                  icon="pi pi-file"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/documents')}
                />
                <Button
                  label={t('productConfiguratorDashboard.approvalWorkflows')}
                  icon="pi pi-sitemap"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/workflows')}
                />
              </div>
            </Card>

            <Card title={t('productConfiguratorDashboard.marketDistribution')} className="action-card">
              <div className="action-list">
                <Button
                  label={t('productConfiguratorDashboard.marketMapping')}
                  icon="pi pi-map"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/market-mapping')}
                />
                <Button
                  label={t('productConfiguratorDashboard.commissionSetup')}
                  icon="pi pi-percentage"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/commissions')}
                />
                <Button
                  label={t('productConfiguratorDashboard.productAnalytics')}
                  icon="pi pi-chart-bar"
                  className="p-button-text action-button"
                  onClick={() => navigate('/product-configurator/analytics')}
                />
              </div>
            </Card>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
};

export default ProductDashboard;