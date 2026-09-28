// Consolidated Reinsurance Screens Implementation
// MVP approach with all remaining features (P3, P5, P6, P7, P8)

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Chart } from 'primereact/chart';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Knob } from 'primereact/knob';
import { Panel } from 'primereact/panel';
import { Accordion, AccordionTab } from 'primereact/accordion';
import reinsuranceMockService from '../../services/mockData/reinsuranceMockData';

// P3: Cession Dashboard Component
export const CessionDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [cessions, setCessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBordereau, setShowBordereau] = useState(false);
  const [showCessionDetails, setShowCessionDetails] = useState(false);
  const [selectedCession, setSelectedCession] = useState(null);
  const [selectedLOB, setSelectedLOB] = useState('all');
  const toast = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCessions();
  }, []);

  const loadCessions = async () => {
    setLoading(true);
    try {
      const data = await reinsuranceMockService.getCessions();
      setCessions(data);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('common.error'), detail: t('reinsurance.failedToLoadCessions') });
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Confirmed' ? 'success' :
                    rowData.status === 'Pending' ? 'warning' : 'danger';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip={t('reinsurance.viewDetails')}
          onClick={() => viewCessionDetails(rowData)}
        />
        <Button
          icon="pi pi-file-pdf"
          className="p-button-rounded p-button-text"
          tooltip={t('reinsurance.generateReport')}
        />
      </div>
    );
  };

  const viewCessionDetails = (cession) => {
    setSelectedCession(cession);
    setShowCessionDetails(true);
  };

  const generateBordereau = () => {
    toast.current?.show({ severity: 'success', summary: t('common.success'), detail: t('reinsurance.bordereauGeneratedSuccess') });
    setShowBordereau(false);
  };

  const filteredCessions = selectedLOB === 'all'
    ? cessions
    : cessions.filter(c => c.lineOfBusiness === selectedLOB);

  const lobOptions = [
    { label: 'All Lines', value: 'all' },
    { label: 'Motor', value: 'Motor' },
    { label: 'Fire and Allied Perils', value: 'Fire and Allied Perils' },
    { label: 'Industrial All Risks', value: 'Industrial All Risks' },
    { label: 'Travel', value: 'Travel' },
    { label: 'Employee Liability', value: 'Employee Liability' },
    { label: 'Property', value: 'Property' },
    { label: 'Marine', value: 'Marine' }
  ];

  return (
    <div className="cession-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.cessionTrackingDashboard')}>
        <div className="mb-3 flex justify-content-between">
          <div className="flex align-items-center gap-3">
            <h3>{t('reinsurance.policyCessionsManagement')}</h3>
            <Dropdown
              value={selectedLOB}
              options={lobOptions}
              onChange={(e) => setSelectedLOB(e.value)}
              placeholder={t('reinsurance.filterByLOB')}
            />
          </div>
          <div className="flex gap-2">
            <Button label={t('reinsurance.processCession')} icon="pi pi-plus" onClick={() => navigate('/reinsurance/cession/process')} />
            <Button label={t('reinsurance.generateBordereau')} icon="pi pi-file" className="p-button-secondary" onClick={() => setShowBordereau(true)} />
          </div>
        </div>

        <TabView>
          <TabPanel header="Summary Statistics">
            <div className="grid mb-3">
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Total Cessions</h4>
                  <p className="text-3xl font-bold">{filteredCessions.length}</p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Pending Confirmation</h4>
                  <p className="text-3xl font-bold text-orange-500">
                    {filteredCessions.filter(c => c.status === 'Pending').length}
                  </p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Total Ceded Premium</h4>
                  <p className="text-3xl font-bold">{formatCurrency(10900000)}</p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Commission Earned</h4>
                  <p className="text-3xl font-bold text-green-500">{formatCurrency(3200000)}</p>
                </Card>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Line of Business Breakdown">
            <div className="grid">
              <div className="col-4">
                <Card title="Motor Cessions">
                  <div className="flex justify-content-between mb-2">
                    <span>Active Cessions:</span>
                    <strong>{cessions.filter(c => c.lineOfBusiness === 'Motor').length}</strong>
                  </div>
                  <div className="flex justify-content-between mb-2">
                    <span>Total Premium:</span>
                    <strong>{formatCurrency(4200000)}</strong>
                  </div>
                  <div className="flex justify-content-between">
                    <span>Commission:</span>
                    <strong>{formatCurrency(1300000)}</strong>
                  </div>
                  <Button label="View Details" className="p-button-text mt-3"
                    onClick={() => setSelectedLOB('Motor')} />
                </Card>
              </div>
              <div className="col-4">
                <Card title="Travel Cessions">
                  <div className="flex justify-content-between mb-2">
                    <span>Active Cessions:</span>
                    <strong>{cessions.filter(c => c.lineOfBusiness === 'Travel').length}</strong>
                  </div>
                  <div className="flex justify-content-between mb-2">
                    <span>Total Premium:</span>
                    <strong>{formatCurrency(2800000)}</strong>
                  </div>
                  <div className="flex justify-content-between">
                    <span>Commission:</span>
                    <strong>{formatCurrency(900000)}</strong>
                  </div>
                  <Button label="View Details" className="p-button-text mt-3"
                    onClick={() => setSelectedLOB('Travel')} />
                </Card>
              </div>
              <div className="col-4">
                <Card title="Employee Liability">
                  <div className="flex justify-content-between mb-2">
                    <span>Active Cessions:</span>
                    <strong>{cessions.filter(c => c.lineOfBusiness === 'Employee Liability').length}</strong>
                  </div>
                  <div className="flex justify-content-between mb-2">
                    <span>Total Premium:</span>
                    <strong>{formatCurrency(3900000)}</strong>
                  </div>
                  <div className="flex justify-content-between">
                    <span>Commission:</span>
                    <strong>{formatCurrency(1000000)}</strong>
                  </div>
                  <Button label="View Details" className="p-button-text mt-3"
                    onClick={() => setSelectedLOB('Employee Liability')} />
                </Card>
              </div>
            </div>
          </TabPanel>
        </TabView>

        <DataTable value={filteredCessions} loading={loading} paginator rows={10} className="mt-3">
          <Column field="policyNumber" header="Policy Number" sortable />
          <Column field="insured" header="Insured" sortable />
          <Column field="lineOfBusiness" header="Line of Business" sortable />
          <Column field="treatyNumber" header="Treaty" sortable />
          <Column field="cessionPercentage" header="Cession %" sortable />
          <Column field="cededPremium" header="Ceded Premium" sortable />
          <Column field="commission" header="Commission" sortable />
          <Column header="Status" body={statusBodyTemplate} sortable />
          <Column field="cessionDate" header="Cession Date" sortable />
          <Column header="Actions" body={actionBodyTemplate} />
        </DataTable>
      </Card>

      <Dialog header="Generate Bordereau" visible={showBordereau} onHide={() => setShowBordereau(false)} style={{ width: '50vw' }}>
        <div className="p-fluid">
          <div className="field">
            <label>Period</label>
            <Dropdown options={[
              { label: 'September 2025', value: '2025-09' },
              { label: 'Q3 2025', value: '2025-Q3' },
              { label: 'August 2025', value: '2025-08' }
            ]} placeholder="Select Period" />
          </div>
          <div className="field">
            <label>Type</label>
            <Dropdown options={[
              { label: 'Premium Bordereau', value: 'premium' },
              { label: 'Claims Bordereau', value: 'claims' }
            ]} placeholder="Select Type" />
          </div>
          <div className="field">
            <label>Treaty</label>
            <Dropdown options={[
              { label: 'All Treaties', value: 'all' },
              { label: 'QS-MOTOR-2025', value: 'TR001' },
              { label: 'SURPLUS-PROP-2025', value: 'TR002' }
            ]} placeholder="Select Treaty" />
          </div>
          <Button label="Generate" icon="pi pi-download" onClick={generateBordereau} className="mt-3" />
        </div>
      </Dialog>

      <Dialog header="Cession Transaction Details" visible={showCessionDetails}
        onHide={() => setShowCessionDetails(false)} style={{ width: '60vw' }}>
        {selectedCession && (
          <div className="cession-detail-view">
            <Accordion multiple activeIndex={[0]}>
              <AccordionTab header="Policy Information">
                <div className="grid">
                  <div className="col-6">
                    <div className="field">
                      <label>Policy Number:</label>
                      <p>{selectedCession.policyNumber}</p>
                    </div>
                    <div className="field">
                      <label>Insured:</label>
                      <p>{selectedCession.insured}</p>
                    </div>
                    <div className="field">
                      <label>Line of Business:</label>
                      <p><Tag value={selectedCession.lineOfBusiness} /></p>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="field">
                      <label>Policy Period:</label>
                      <p>{selectedCession.policyStartDate} to {selectedCession.policyEndDate}</p>
                    </div>
                    <div className="field">
                      <label>Sum Insured:</label>
                      <p>{formatCurrency(selectedCession.sumInsured)}</p>
                    </div>
                    <div className="field">
                      <label>Gross Premium:</label>
                      <p>{formatCurrency(selectedCession.grossPremium)}</p>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab header="Cession Details">
                <div className="grid">
                  <div className="col-6">
                    <div className="field">
                      <label>Treaty:</label>
                      <p>{selectedCession.treatyNumber}</p>
                    </div>
                    <div className="field">
                      <label>Cession Percentage:</label>
                      <p>{selectedCession.cessionPercentage}%</p>
                    </div>
                    <div className="field">
                      <label>Ceded Premium:</label>
                      <p>{formatCurrency(selectedCession.cededPremium)}</p>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="field">
                      <label>Commission Rate:</label>
                      <p>{selectedCession.commissionRate}%</p>
                    </div>
                    <div className="field">
                      <label>Commission Amount:</label>
                      <p>{formatCurrency(selectedCession.commission)}</p>
                    </div>
                    <div className="field">
                      <label>Status:</label>
                      <p>{statusBodyTemplate(selectedCession)}</p>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              {(selectedCession.lineOfBusiness === 'Motor' ||
                selectedCession.lineOfBusiness === 'Travel' ||
                selectedCession.lineOfBusiness === 'Employee Liability') && (
                <AccordionTab header={`${selectedCession.lineOfBusiness} Specific Details`}>
                  {selectedCession.lineOfBusiness === 'Motor' && (
                    <div className="grid">
                      <div className="col-6">
                        <div className="field">
                          <label>Vehicle Type:</label>
                          <p>{selectedCession.vehicleType || 'Private Car'}</p>
                        </div>
                        <div className="field">
                          <label>Vehicle Make:</label>
                          <p>{selectedCession.vehicleMake || 'Toyota'}</p>
                        </div>
                        <div className="field">
                          <label>Coverage Type:</label>
                          <p>{selectedCession.coverageType || 'Comprehensive'}</p>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="field">
                          <label>CTPL Coverage:</label>
                          <p>{formatCurrency(selectedCession.ctplLimit ?? 1000000)}</p>
                        </div>
                        <div className="field">
                          <label>AOG Coverage:</label>
                          <p>{formatCurrency(selectedCession.aogLimit ?? 500000)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCession.lineOfBusiness === 'Travel' && (
                    <div className="grid">
                      <div className="col-6">
                        <div className="field">
                          <label>Destination:</label>
                          <p>{selectedCession.destination || 'International - Asia'}</p>
                        </div>
                        <div className="field">
                          <label>Coverage Duration:</label>
                          <p>{selectedCession.duration || '30 days'}</p>
                        </div>
                        <div className="field">
                          <label>Number of Travelers:</label>
                          <p>{selectedCession.travelers || '1'}</p>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="field">
                          <label>Medical Coverage:</label>
                          <p>{formatCurrency(selectedCession.medicalLimit ?? 5000000)}</p>
                        </div>
                        <div className="field">
                          <label>Emergency Evacuation:</label>
                          <p>{formatCurrency(selectedCession.evacuationLimit ?? 2000000)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCession.lineOfBusiness === 'Employee Liability' && (
                    <div className="grid">
                      <div className="col-6">
                        <div className="field">
                          <label>Number of Employees:</label>
                          <p>{selectedCession.employeeCount || '500'}</p>
                        </div>
                        <div className="field">
                          <label>Industry Type:</label>
                          <p>{selectedCession.industryType || 'Manufacturing'}</p>
                        </div>
                        <div className="field">
                          <label>Coverage Limit per Person:</label>
                          <p>{formatCurrency(selectedCession.perPersonLimit ?? 1000000)}</p>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="field">
                          <label>Aggregate Limit:</label>
                          <p>{formatCurrency(selectedCession.aggregateLimit ?? 50000000)}</p>
                        </div>
                        <div className="field">
                          <label>Workplace Safety Rating:</label>
                          <p>{selectedCession.safetyRating || 'A'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionTab>
              )}
            </Accordion>

            <div className="flex justify-content-end gap-2 mt-3">
              <Button label="Generate Report" icon="pi pi-file-pdf" className="p-button-secondary" />
              <Button label="Close" icon="pi pi-times" onClick={() => setShowCessionDetails(false)} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

// P5: Recovery Dashboard Component
export const RecoveryDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useRef(null);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const data = await reinsuranceMockService.getReinsuranceClaims();
      setClaims(data);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadClaims') });
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Recovered' ? 'success' :
                    rowData.status === 'Processing' ? 'info' :
                    rowData.status === 'Pending' ? 'warning' : 'danger';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const recoveryMetrics = {
    totalClaimed: formatCurrency(125000000),
    totalRecovered: formatCurrency(106250000),
    recoveryRate: 85,
    averageTime: 45
  };

  return (
    <div className="recovery-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.claimsRecovery')}>
        <div className="grid mb-3">
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.totalClaimed')}</h4>
              <p className="text-3xl font-bold">{recoveryMetrics.totalClaimed}</p>
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.totalRecovered')}</h4>
              <p className="text-3xl font-bold text-green-500">{recoveryMetrics.totalRecovered}</p>
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.recoveryRate')}</h4>
              <Knob value={recoveryMetrics.recoveryRate} size={80} readOnly valueColor="#4caf50" />
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.avgRecoveryTime')}</h4>
              <p className="text-3xl font-bold">{recoveryMetrics.averageTime} days</p>
            </Card>
          </div>
        </div>

        <TabView>
          <TabPanel header={t('reinsurance.pendingRecoveries')}>
            <DataTable value={claims.filter(c => c.status !== 'Recovered')} loading={loading} paginator rows={10}>
              <Column field="claimNumber" header={t('reinsurance.claimNumber')} sortable />
              <Column field="policyNumber" header={t('reinsurance.policyNumber')} sortable />
              <Column field="insured" header={t('reinsurance.insured')} sortable />
              <Column field="dateOfLoss" header={t('reinsurance.dateOfLoss')} sortable />
              <Column field="causeOfLoss" header={t('reinsurance.cause')} sortable />
              <Column field="grossClaim" header={t('reinsurance.grossClaim')} sortable />
              <Column field="recoverableAmount" header={t('reinsurance.recoverable')} sortable />
              <Column header={t('reinsurance.status')} body={statusBodyTemplate} sortable />
            </DataTable>
          </TabPanel>
          <TabPanel header={t('reinsurance.recoveredClaims')}>
            <DataTable value={claims.filter(c => c.status === 'Recovered')} loading={loading} paginator rows={10}>
              <Column field="claimNumber" header={t('reinsurance.claimNumber')} sortable />
              <Column field="insured" header={t('reinsurance.insured')} sortable />
              <Column field="recoverableAmount" header={t('reinsurance.recoveredAmount')} sortable />
              <Column field="recoveryDate" header={t('reinsurance.recoveryDate')} sortable />
              <Column field="settlementAmount" header={t('reinsurance.settlement')} sortable />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

// P6: Reinsurance Reports Component
export const ReinsuranceReports = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const toast = useRef(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await reinsuranceMockService.getReportTemplates();
      setReports(data);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadReports') });
    }
  };

  const generateReport = (report) => {
    toast.current?.show({ severity: 'success', summary: t('common.success'), detail: t('reinsurance.reportGeneratedSuccess', { name: report.name }) });
  };

  return (
    <div className="reinsurance-reports p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.reportsCenter')}>
        <div className="grid">
          {reports.map((report) => (
            <div key={report.id} className="col-12 md:col-6 lg:col-4">
              <Card className="mb-3">
                <h4>{report.name}</h4>
                <p className="text-secondary">{report.type} Report</p>
                <div className="flex justify-content-between align-items-center mt-3">
                  <Tag value={report.frequency} />
                  <Button icon="pi pi-download" label={t('reinsurance.generate')} className="p-button-sm" onClick={() => generateReport(report)} />
                </div>
                <small className="block mt-2">{t('reinsurance.lastGenerated')}: {report.lastGenerated}</small>
              </Card>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// P7: Reconciliation Dashboard Component
export const ReconciliationDashboard = () => {
  const { t } = useTranslation();
  const [reconciliations, setReconciliations] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const toast = useRef(null);

  useEffect(() => {
    loadReconciliation();
  }, []);

  const loadReconciliation = async () => {
    try {
      const data = await reinsuranceMockService.getReconciliationItems();
      setReconciliations(data.pending || []);
      setExceptions(data.exceptions || []);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadReconciliationData') });
    }
  };

  const varianceTemplate = (rowData) => {
    const color = Math.abs(rowData.variancePercent) > 1 ? 'red' : 'green';
    return <span style={{ color }}>{rowData.variance} ({rowData.variancePercent}%)</span>;
  };

  return (
    <div className="reconciliation-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.reinsuranceReconciliation')}>
        <TabView>
          <TabPanel header={t('reinsurance.pendingReconciliations')}>
            <DataTable value={reconciliations} paginator rows={10}>
              <Column field="type" header={t('reinsurance.type')} sortable />
              <Column field="reinsurer" header={t('reinsurance.reinsurer')} sortable />
              <Column field="period" header={t('reinsurance.period')} sortable />
              <Column field="ourAmount" header={t('reinsurance.ourAmount')} sortable />
              <Column field="theirAmount" header={t('reinsurance.theirAmount')} sortable />
              <Column header={t('reinsurance.variance')} body={varianceTemplate} sortable />
              <Column field="status" header={t('reinsurance.status')} sortable />
            </DataTable>
          </TabPanel>
          <TabPanel header={t('reinsurance.exceptions')}>
            <DataTable value={exceptions} paginator rows={10}>
              <Column field="date" header={t('remittance.date')} sortable />
              <Column field="type" header={t('reinsurance.type')} sortable />
              <Column field="description" header={t('reinsurance.description')} sortable />
              <Column field="amount" header={t('reinsurance.amount')} sortable />
              <Column field="status" header={t('reinsurance.status')} sortable />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

// P8: Reinsurance Analytics Component
export const ReinsuranceAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [analytics, setAnalytics] = useState(null);
  const toast = useRef(null);
  const recoveryMetrics = analytics?.recoveryMetrics ?? { totalRecovered: 0, totalClaimed: 0 };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await reinsuranceMockService.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadAnalytics') });
    }
  };

  const treatyUtilizationData = {
    labels: analytics?.treatyUtilization?.map(t => t.treaty) || [],
    datasets: [{
      label: 'Utilization %',
      data: analytics?.treatyUtilization?.map(t => t.utilization) || [],
      backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0']
    }]
  };

  const lossRatioData = {
    labels: analytics?.lossRatioTrend?.map(d => d.month) || [],
    datasets: [
      {
        label: 'Gross Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.gross) || [],
        borderColor: '#ff9800',
        tension: 0.4
      },
      {
        label: 'Net Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.net) || [],
        borderColor: '#4caf50',
        tension: 0.4
      }
    ]
  };

  return (
    <div className="reinsurance-analytics p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.analyticsDashboard')}>
        <div className="grid">
          <div className="col-12 md:col-6">
            <Card title={t('reinsurance.treatyUtilizationChart')}>
              <Chart type="bar" data={treatyUtilizationData} />
            </Card>
          </div>
          <div className="col-12 md:col-6">
            <Card title={t('reinsurance.lossRatioTrend')}>
              <Chart type="line" data={lossRatioData} />
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.retentionOptimization')}>
              <div className="text-center">
                <h3>{t('reinsurance.currentVsRecommended')}</h3>
                <div className="flex justify-content-around mt-3">
                  <div>
                    <p className="text-secondary">{t('reinsurance.current')}</p>
                    <Knob value={60} readOnly valueColor="#ff9800" />
                    <p>{t('reinsurance.profitability')}: 15.5%</p>
                  </div>
                  <div>
                    <p className="text-secondary">{t('reinsurance.recommended')}</p>
                    <Knob value={65} readOnly valueColor="#4caf50" />
                    <p>{t('reinsurance.profitability')}: 17.2%</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.recoveryPerformance')}>
              <div className="text-center">
                <Knob value={85} size={120} readOnly valueColor="#4caf50" />
                <h4>{t('reinsurance.recoveryRate')}</h4>
                <p>{recoveryMetrics.totalRecovered} / {recoveryMetrics.totalClaimed}</p>
                <p className="text-secondary">{t('reinsurance.avgTimeDays', { days: 45 })}</p>
              </div>
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.keyMetrics')}>
              <div className="metric-list">
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.grossToNetRatio')}</span>
                  <strong>65%</strong>
                </div>
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.riCostRatio')}</span>
                  <strong>28%</strong>
                </div>
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.treatyROI')}</span>
                  <strong>18.5%</strong>
                </div>
                <div className="flex justify-content-between">
                  <span>{t('reinsurance.catExposure')}</span>
                  <strong>{formatCurrency(1550000000)}</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
};