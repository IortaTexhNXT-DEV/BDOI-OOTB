import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Chart } from 'primereact/chart';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Knob } from 'primereact/knob';
import { Panel } from 'primereact/panel';
import { Timeline } from 'primereact/timeline';
import reinsuranceService from '../../../services/reinsuranceService';
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { canOpen } from "../../../utils/canOpen";
import './style.scss';
import { progressValue } from "../../../utility/numberFormat";

const RENEWAL_WINDOW_DAYS = 90;

const TreatyDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [treaties, setTreaties] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const toast = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [treatyData, analyticsData] = await Promise.all([
        reinsuranceService.getTreaties(),
        reinsuranceService.getAnalytics()
      ]);
      setTreaties(treatyData);
      setAnalytics(analyticsData);
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: t('reinsurance.error'),
        detail: error?.message || t('reinsurance.failedToLoadTreatyData')
      });
    } finally {
      setLoading(false);
    }
  };

  const utilizationData = {
    labels: treaties.map(tr => tr.treatyNumber),
    datasets: [{
      label: t('reinsurance.treatyUtilization'),
      data: treaties.map(tr => tr.utilization),
      backgroundColor: treaties.map(tr =>
        tr.utilization > 80 ? '#f44336' :
        tr.utilization > 60 ? '#ff9800' : '#4caf50'
      )
    }]
  };

  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  const lossRatioData = {
    labels: analytics?.lossRatioTrend?.map(d => d.month) || [],
    datasets: [
      {
        label: 'Gross Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.gross) || [],
        borderColor: '#ff9800',
        fill: false,
        tension: 0.4
      },
      {
        label: 'Net Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.net) || [],
        borderColor: '#4caf50',
        fill: false,
        tension: 0.4
      }
    ]
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const utilizationBodyTemplate = (rowData) => {
    const color = rowData.utilization > 80 ? '#f44336' :
                  rowData.utilization > 60 ? '#ff9800' : '#4caf50';
    return (
      <div className="utilization-cell">
        <ProgressBar
          value={progressValue(rowData.utilization, 1)}
          color={color}
          showValue={true}
          style={{ height: '20px' }}
        />
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text p-button-primary"
          tooltip={t('reinsurance.viewDetails')}
          onClick={() => navigate(`/reinsurance/treaty/${rowData.id}`)}
        />
        <Button
          icon="pi pi-file"
          className="p-button-rounded p-button-text"
          tooltip="Generate Report"
          onClick={() => navigate('/reinsurance/reports')}
        />
      </div>
    );
  };

  const activeTreaties = treaties.filter(tr => tr.status === 'Active');
  const today = new Date();
  const daysUntil = (date) => Math.ceil((new Date(date) - today) / (24 * 60 * 60 * 1000));
  const sumOf = (field) => activeTreaties.reduce((total, tr) => total + (Number(tr[field]) || 0), 0);
  const averageUtilization = activeTreaties.length
    ? Math.round(activeTreaties.reduce((total, tr) => total + (Number(tr.utilization) || 0), 0) / activeTreaties.length)
    : 0;
  const newThisMonth = treaties.filter(tr => {
    const created = new Date(tr.createdAt);
    return created.getFullYear() === today.getFullYear() && created.getMonth() === today.getMonth();
  }).length;
  const dueForRenewal = activeTreaties
    .filter(tr => daysUntil(tr.expiryDate) <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const timelineEntry = (tr) => {
    if (tr.status === 'Pending Approval') {
      return { status: 'In Progress', icon: 'pi pi-cog', color: '#ff9800', action: tr.status, date: tr.effectiveDate };
    }
    if (daysUntil(tr.expiryDate) < 0) {
      return { status: 'Completed', icon: 'pi pi-check', color: '#4caf50', action: tr.status, date: tr.expiryDate };
    }
    return { status: 'Upcoming', icon: 'pi pi-clock', color: '#9e9e9e', action: 'Renewal Due', date: tr.expiryDate };
  };

  const renewalTimeline = treaties
    .filter(tr => ['Active', 'Pending Approval'].includes(tr.status))
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    .slice(0, 6)
    .map(tr => ({ treaty: tr.treatyNumber, ...timelineEntry(tr) }));

  const customizedMarker = (item) => {
    return (
      <span
        className="custom-marker"
        style={{
          backgroundColor: item.color,
          color: 'white',
          borderRadius: '50%',
          width: '2rem',
          height: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <i className={item.icon}></i>
      </span>
    );
  };

  const customizedContent = (item) => {
    return (
      <Card className="timeline-card">
        <h5>{item.treaty}</h5>
        <p>{item.action}</p>
        <small>{formatAppDate(item.date)}</small>
      </Card>
    );
  };

  // treaties are set up in Master > Finance > Reinsurance Treaty; only roles that may open it get the button
  const canAddTreaty = canOpen('/master/reinsurance/treaty');

  return (
    <div className="treaty-dashboard">
      <Toast ref={toast} />

      <div className="dashboard-header">
        <h2>{t('reinsurance.reinsurance')} {t('reinsurance.treatyDashboard')}</h2>
        <div className="header-actions">
          {canAddTreaty && (
            <Button
              label="Add Treaty"
              icon="pi pi-plus"
              className="p-button-primary"
              onClick={() => navigate('/master/reinsurance/treaty?new=1')}
            />
          )}
          <Button
            label="View Reports"
            icon="pi pi-chart-bar"
            className="p-button-secondary"
            onClick={() => navigate('/reinsurance/reports')}
          />
        </div>
      </div>

      <div className="metrics-row">
        <Card className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Active Treaties</span>
            <span className="metric-value">{activeTreaties.length}</span>
            <span className="metric-change positive">
              <i className="pi pi-arrow-up"></i> {newThisMonth} new this month
            </span>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Total Capacity</span>
            <span className="metric-value">{formatCurrency(sumOf('capacity'))}</span>
            <span className="metric-change">Available: {formatCurrency(sumOf('availableCapacity'))}</span>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Average Utilization</span>
            <div className="knob-container">
              <Knob
                value={progressValue(averageUtilization)}
                size={80}
                strokeWidth={8}
                valueColor="#4caf50"
                rangeColor="#e0e0e0"
                readOnly
              />
            </div>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Pending Renewals</span>
            <span className="metric-value">{dueForRenewal.length}</span>
            <span className="metric-change warning">
              <i className="pi pi-clock"></i> Next: {dueForRenewal[0]?.expiryDate || '-'}
            </span>
          </div>
        </Card>
      </div>

      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header={t('reinsurance.activeTreaties')}>
          <DataTable
            value={treaties}
            loading={loading}
            paginator
            rows={10}
            className="treaty-table"
            emptyMessage={t('common.noData')}
            responsiveLayout="scroll"
          >
            <Column field="treatyNumber" header={t('reinsurance.treatyNumber')} sortable />
            <Column field="name" header="Treaty Name" sortable />
            <Column field="type" header="Type" sortable />
            <Column field="lineOfBusiness" header="Line of Business" sortable />
            <Column header="Utilization" body={utilizationBodyTemplate} sortable />
            <Column field="premiumCeded" header="Premium Ceded" sortable body={(rowData) => formatCurrency(rowData.premiumCeded)} />
            <Column field="claimsRecovered" header="Claims Recovered" sortable body={(rowData) => formatCurrency(rowData.claimsRecovered)} />
            <Column header="Status" body={statusBodyTemplate} sortable />
            <Column header="Actions" body={actionBodyTemplate} />
          </DataTable>
        </TabPanel>

        <TabPanel header="Utilization Analysis">
          <div className="analysis-grid">
            <Card title="Treaty Utilization">
              <Chart type="bar" data={utilizationData} options={chartOptions} style={{ height: '300px' }} />
            </Card>
            <Card title="Loss Ratio Trend">
              <Chart type="line" data={lossRatioData} options={chartOptions} style={{ height: '300px' }} />
            </Card>
          </div>
        </TabPanel>

        <TabPanel header="Renewal Timeline">
          <Timeline
            value={renewalTimeline}
            align="alternate"
            className="renewal-timeline"
            marker={customizedMarker}
            content={customizedContent}
          />
        </TabPanel>

        <TabPanel header="Capacity Management">
          <div className="capacity-grid">
            {treaties.map((treaty) => (
              <Panel key={treaty.id} header={treaty.treatyNumber}>
                <div className="capacity-details">
                  <div className="capacity-row">
                    <span>Type:</span>
                    <strong>{treaty.type}</strong>
                  </div>
                  <div className="capacity-row">
                    <span>Line:</span>
                    <strong>{treaty.lineOfBusiness}</strong>
                  </div>
                  <div className="capacity-row">
                    <span>Utilization:</span>
                    <ProgressBar value={progressValue(treaty.utilization, 1)} showValue />
                  </div>
                  <div className="capacity-row">
                    <span>Premium Ceded:</span>
                    <strong>{formatCurrency(treaty.premiumCeded)}</strong>
                  </div>
                  <div className="capacity-actions">
                    <Button
                      label="View Details"
                      className="p-button-sm p-button-text"
                      onClick={() => navigate(`/reinsurance/treaty/${treaty.id}`)}
                    />
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
};

export default TreatyDashboard;