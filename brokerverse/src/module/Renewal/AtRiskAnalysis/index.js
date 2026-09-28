import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { ProgressBar } from "primereact/progressbar";
import { Badge } from "primereact/badge";
import { Chip } from "primereact/chip";
import { TabView, TabPanel } from "primereact/tabview";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { Knob } from "primereact/knob";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";

const AtRiskAnalysis = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [actionPlanVisible, setActionPlanVisible] = useState(false);
  const [escalateVisible, setEscalateVisible] = useState(false);
  const [riskPolicies, setRiskPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    totalAtRisk: 0,
    criticalRisk: 0,
    highRisk: 0,
    avgRiskScore: 0
  });
  const [actionPlan, setActionPlan] = useState({
    priority: 'High',
    assignedTo: '',
    deadline: new Date(Date.now() + 7*24*60*60*1000),
    approvedDiscount: 0,
    specialOffer: '',
    notes: ''
  });
  const toast = useRef(null);

  const riskFilterOptions = [
    { label: t("renewal.allRiskLevels"), value: "All" },
    { label: t("renewal.criticalRisk"), value: "Critical" },
    { label: t("renewal.highRisk"), value: "High" },
    { label: t("renewal.mediumRisk"), value: "Medium" }
  ];

  const agentFilterOptions = [
    { label: t("renewal.allAgents"), value: "All" },
    ...[...new Set(riskPolicies.map(p => p.assignedAgent).filter(Boolean))].map(name => ({ label: name, value: name }))
  ];

  const priorityOptions = [
    { label: t("renewal.critical"), value: "Critical" },
    { label: t("renewal.high"), value: "High" },
    { label: t("renewal.medium"), value: "Medium" },
    { label: t("renewal.low"), value: "Low" }
  ];

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.atRiskAnalysis"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, riskFilter, agentFilter, riskPolicies]);

  /** At-risk rows with the plan / escalation recorded on the renewal timeline. */
  const withTimelineFlags = (rows, negotiations) => rows.map(row => {
    const timeline = negotiations.find(n => n.id === row.id)?.timeline || [];
    const plan = [...timeline].reverse().find(item => item.type === 'Action Plan');
    return {
      ...row,
      assignedAgent: row.actionPlan?.assignedTo,
      actionPlan: plan ? { ...row.actionPlan, ...plan.details, status: 'Active' } : row.actionPlan,
      escalated: timeline.some(item => item.type === 'Escalation')
    };
  });

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rows, negotiations] = await Promise.all([
        renewalsWorkspaceService.getAtRisk(),
        renewalsWorkspaceService.getNegotiations()
      ]);
      const combinedData = withTimelineFlags(rows, negotiations);
      setRiskPolicies(combinedData);
      calculateDashboard(combinedData);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToLoadAtRiskData"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboard = (data) => {
    const critical = data.filter(p => p.riskCategory === 'Critical' || p.riskScore >= 90);
    const high = data.filter(p => p.riskCategory === 'High' || (p.riskScore >= 70 && p.riskScore < 90));
    const avgScore = data.reduce((sum, p) => sum + (p.riskScore || 0), 0) / data.length;

    setDashboardData({
      totalAtRisk: data.length,
      criticalRisk: critical.length,
      highRisk: high.length,
      avgRiskScore: Math.round(avgScore || 0)
    });
  };

  const applyFilters = () => {
    let filtered = [...riskPolicies];

    if (search) {
      filtered = filtered.filter(p =>
        p.policyNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.insuredName.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (riskFilter !== 'All') {
      filtered = filtered.filter(p => p.riskCategory === riskFilter);
    }

    if (agentFilter !== 'All') {
      filtered = filtered.filter(p => p.assignedAgent === agentFilter);
    }

    setFilteredPolicies(filtered);
    calculateDashboard(filtered);
  };

  const handleClear = () => {
    setSearch("");
    setRiskFilter("All");
    setAgentFilter("All");
    toast.current.show({
      severity: 'info',
      summary: t("renewal.filtersCleared"),
      detail: t("renewal.allFiltersReset"),
      life: 2000
    });
  };

  const handleViewDetails = async (rowData) => {
    setSelectedPolicy(rowData);
    setDetailsVisible(true);
    try {
      const renewal = await renewalsWorkspaceService.getRenewal(rowData.id);
      setSelectedPolicy({ ...rowData, activities: renewal.activities || [] });
    } catch (error) {
      toast.current.show({ severity: 'error', summary: t("common.error"), detail: error?.message, life: 3000 });
    }
  };

  const handleCreateActionPlan = (rowData) => {
    setSelectedPolicy(rowData);
    setActionPlan({
      priority: rowData.riskScore >= 90 ? 'Critical' : 'High',
      assignedTo: rowData.assignedAgent || '',
      deadline: new Date(Date.now() + (rowData.riskScore >= 90 ? 3 : 7)*24*60*60*1000),
      approvedDiscount: 0,
      specialOffer: '',
      notes: ''
    });
    setActionPlanVisible(true);
  };

  const handleEscalate = (rowData) => {
    setSelectedPolicy(rowData);
    setEscalateVisible(true);
  };

  const handleSaveActionPlan = async () => {
    setLoading(true);
    try {
      const deadline = actionPlan.deadline?.toLocaleDateString('en-CA');
      await renewalsWorkspaceService.addActivity(selectedPolicy.id, {
        type: 'Action Plan',
        description: actionPlan.notes || actionPlan.specialOffer || `Retention action plan (${actionPlan.priority})`,
        outcome: actionPlan.specialOffer || undefined,
        nextAction: actionPlan.assignedTo ? `Assigned to ${actionPlan.assignedTo}` : undefined,
        followUpDate: deadline,
        details: { ...actionPlan, deadline }
      });
      setActionPlanVisible(false);
      loadInitialData();

      toast.current.show({
        severity: 'success',
        summary: t("renewal.actionPlanCreated"),
        detail: t("renewal.actionPlanCreatedFor", { policy: selectedPolicy.policyNumber }),
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToCreateActionPlan"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateConfirm = async () => {
    setEscalateVisible(false);
    try {
      await renewalsWorkspaceService.addActivity(selectedPolicy.id, {
        type: 'Escalation',
        description: `Escalated to senior management (risk score ${selectedPolicy.riskScore})`,
        details: { riskScore: selectedPolicy.riskScore, riskCategory: selectedPolicy.riskCategory }
      });
      toast.current.show({
        severity: 'success',
        summary: t("renewal.policyEscalated"),
        detail: t("renewal.policyEscalatedToSenior", { policy: selectedPolicy.policyNumber }),
        life: 3000
      });
      loadInitialData();
    } catch (error) {
      toast.current.show({ severity: 'error', summary: t("common.error"), detail: error?.message, life: 3000 });
    }
  };

  const riskScoreBodyTemplate = (rowData) => {
    const score = rowData.riskScore || 0;
    const getSeverity = (score) => {
      if (score >= 90) return 'danger';
      if (score >= 70) return 'warning';
      if (score >= 50) return 'info';
      return 'success';
    };

    return (
      <div className="risk-score-cell">
        <ProgressBar value={score} className={`risk-progress ${getSeverity(score)}`} />
        <span className={`score-value ${getSeverity(score)}`}>{score}</span>
      </div>
    );
  };

  const riskCategoryBodyTemplate = (rowData) => {
    const getSeverity = (category) => {
      switch (category) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        default: return 'success';
      }
    };

    return <Tag value={rowData.riskCategory} severity={getSeverity(rowData.riskCategory)} />;
  };

  const daysToExpiryBodyTemplate = (rowData) => {
    const days = rowData.daysToExpiry;
    let severity = 'success';
    let icon = 'pi-calendar';

    if (days <= 7) {
      severity = 'danger';
      icon = 'pi-exclamation-triangle';
    } else if (days <= 14) {
      severity = 'warning';
      icon = 'pi-clock';
    } else if (days <= 30) {
      severity = 'info';
    }

    return (
      <div className="days-cell">
        <i className={`pi ${icon} ${severity}`}></i>
        <span className={severity}>{days} days</span>
      </div>
    );
  };

  const premiumBodyTemplate = (rowData) => {
    return formatCurrency(rowData.currentPremium);
  };

  const actionPlanBodyTemplate = (rowData) => {
    if (rowData.actionPlan && rowData.actionPlan.status === 'Active') {
      return <Badge value="Active Plan" severity="success" />;
    }
    if (rowData.escalated) {
      return <Badge value="Escalated" severity="danger" />;
    }
    return <Badge value="Pending" severity="warning" />;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-text"
          onClick={() => handleViewDetails(rowData)}
          tooltip="View Details"
        />
        <Button
          icon="pi pi-cog"
          className="p-button-text"
          onClick={() => handleCreateActionPlan(rowData)}
          tooltip={t("renewal.createActionPlan")}
          disabled={rowData.actionPlan && rowData.actionPlan.status === 'Active'}
        />
        <Button
          icon="pi pi-arrow-up"
          className="p-button-text"
          onClick={() => handleEscalate(rowData)}
          tooltip="Escalate"
          disabled={rowData.escalated}
        />
      </div>
    );
  };

  const policyLinkTemplate = (rowData) => {
    return (
      <a href="#" className="policy-link" onClick={(e) => {
        e.preventDefault();
        handleViewDetails(rowData);
      }}>
        {rowData.policyNumber}
      </a>
    );
  };

  const actionPlanDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setActionPlanVisible(false)}
      />
      <Button
        label={t("renewal.saveActionPlan")}
        icon="pi pi-check"
        onClick={handleSaveActionPlan}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="container__at__risk__analysis__master">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.atRiskAnalysis")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        {/* Search Section */}
        <div className="search-section">
          <Card>
            <div className="search-grid">
              <div className="search-field">
                <label>{t("renewal.policyInsuredName")}</label>
                <InputText
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search policies or names"
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.riskLevel")}</label>
                <Dropdown
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.value)}
                  options={riskFilterOptions}
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.agent")}</label>
                <Dropdown
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.value)}
                  options={agentFilterOptions}
                />
              </div>

              <div className="search-actions">
                <Button label="Search" icon="pi pi-search" onClick={applyFilters} />
                <Button label="Clear" className="p-button-secondary" onClick={handleClear} />
              </div>
            </div>
          </Card>
        </div>

        {/* Dashboard Cards */}
        <div className="dashboard-cards">
          <Card className="dashboard-card danger">
            <div className="card-content">
              <div className="card-visual">
                <Knob
                  value={dashboardData.avgRiskScore}
                  size={80}
                  readOnly
                  valueColor="#EF4444"
                  rangeColor="#FEE2E2"
                />
              </div>
              <div className="card-info">
                <span className="card-value">{dashboardData.avgRiskScore}</span>
                <span className="card-label">{t("renewal.averageRiskScore")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-exclamation-triangle card-icon red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalAtRisk}</span>
                <span className="card-label">{t("renewal.totalAtRiskPolicies")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setRiskFilter('Critical')}>
            <div className="card-content">
              <i className="pi pi-ban card-icon dark-red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.criticalRisk}</span>
                <span className="card-label">{t("renewal.criticalRisk")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setRiskFilter('High')}>
            <div className="card-content">
              <i className="pi pi-exclamation-circle card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.highRisk}</span>
                <span className="card-label">{t("renewal.highRisk")}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Risk Analysis Table */}
        <div className="table-section">
          <Card>
            <div className="table-header">
              <h3>{t("renewal.atRiskPoliciesAnalysis")}</h3>
              <div className="table-actions">
                <Button
                  icon="pi pi-refresh"
                  className="p-button-text"
                  onClick={loadInitialData}
                  tooltip="Refresh"
                />
                <Button
                  icon="pi pi-file-excel"
                  className="p-button-text"
                  onClick={() => {
                    toast.current.show({
                      severity: 'success',
                      summary: 'Export Started',
                      detail: 'At-risk analysis exported to Excel',
                      life: 3000
                    });
                  }}
                  tooltip="Export to Excel"
                />
              </div>
            </div>

            <DataTable
              value={filteredPolicies}
              className="risk-table"
              stripedRows
              paginator
              rows={10}
              loading={loading}
              emptyMessage="No at-risk policies found"
              sortMode="multiple"
            >
              <Column
                body={policyLinkTemplate}
                header={t("renewal.policyNumber")}
                style={{ width: '12%' }}
                sortable
                sortField="policyNumber"
              />
              <Column
                field="insuredName"
                header={t("renewal.insuredName")}
                style={{ width: '14%' }}
                sortable
              />
              <Column
                field="product"
                header={t("renewal.product")}
                style={{ width: '12%' }}
                sortable
              />
              <Column
                body={riskScoreBodyTemplate}
                header={t("renewal.riskScore")}
                style={{ width: '10%' }}
                sortable
                sortField="riskScore"
              />
              <Column
                body={riskCategoryBodyTemplate}
                header={t("renewal.riskLevel")}
                style={{ width: '10%' }}
              />
              <Column
                body={daysToExpiryBodyTemplate}
                header={t("renewal.daysToExpiry")}
                style={{ width: '10%' }}
                sortable
                sortField="daysToExpiry"
              />
              <Column
                body={premiumBodyTemplate}
                header={t("renewal.premium")}
                style={{ width: '10%', textAlign: 'right' }}
                sortable
                sortField="currentPremium"
              />
              <Column
                field="assignedAgent"
                header={t("renewal.agent")}
                style={{ width: '12%' }}
              />
              <Column
                body={actionPlanBodyTemplate}
                header={t("renewal.status")}
                style={{ width: '10%' }}
              />
              <Column
                body={actionBodyTemplate}
                header={t("renewal.actions")}
                style={{ width: '10%' }}
              />
            </DataTable>
          </Card>
        </div>

        {/* Policy Details Dialog */}
        <Dialog
          header="Risk Analysis Details"
          visible={detailsVisible}
          onHide={() => setDetailsVisible(false)}
          style={{ width: '80vw' }}
        >
          {selectedPolicy && (
            <TabView>
              <TabPanel header="Risk Factors">
                <div className="risk-factors">
                  <div className="risk-overview">
                    <div className="risk-score-display">
                      <Knob
                        value={selectedPolicy.riskScore}
                        size={120}
                        readOnly
                        valueColor="#EF4444"
                        rangeColor="#FEE2E2"
                      />
                      <div className="score-info">
                        <span className="score-label">Risk Score</span>
                        <span className="score-category">{selectedPolicy.riskCategory} Risk</span>
                      </div>
                    </div>

                    <div className="policy-summary">
                      <div className="summary-item">
                        <label>Policy:</label>
                        <span>{selectedPolicy.policyNumber}</span>
                      </div>
                      <div className="summary-item">
                        <label>Insured:</label>
                        <span>{selectedPolicy.insuredName}</span>
                      </div>
                      <div className="summary-item">
                        <label>Premium:</label>
                        <span>{formatCurrency(selectedPolicy.currentPremium)}</span>
                      </div>
                      <div className="summary-item">
                        <label>Expires In:</label>
                        <span>{selectedPolicy.daysToExpiry} days</span>
                      </div>
                    </div>
                  </div>

                  <div className="factors-breakdown">
                    <h4>Risk Factor Breakdown</h4>
                    {selectedPolicy.riskFactors?.map((factor, index) => (
                      <div key={index} className="factor-item">
                        <div className="factor-header">
                          <span className="factor-name">{factor.factor}</span>
                          <Badge value={`${factor.score} pts`} severity="warning" />
                        </div>
                        <div className="factor-details">{factor.details}</div>
                        <ProgressBar value={(factor.score / 30) * 100} className="factor-progress" />
                      </div>
                    ))}
                  </div>
                </div>
              </TabPanel>

              <TabPanel header="Recommended Actions">
                <div className="recommended-actions">
                  <h4>Immediate Actions Required</h4>
                  <div className="actions-list">
                    {selectedPolicy.recommendedActions?.map((action, index) => (
                      <div key={index} className="action-item">
                        <i className="pi pi-check-circle"></i>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>

                  {selectedPolicy.actionPlan && (
                    <div className="current-action-plan">
                      <h4>Current Action Plan</h4>
                      <div className="plan-details">
                        <div className="plan-item">
                          <label>Priority:</label>
                          <Tag value={selectedPolicy.actionPlan.priority} severity="warning" />
                        </div>
                        <div className="plan-item">
                          <label>Assigned To:</label>
                          <span>{selectedPolicy.actionPlan.assignedTo}</span>
                        </div>
                        <div className="plan-item">
                          <label>Deadline:</label>
                          <span>{new Date(selectedPolicy.actionPlan.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="plan-item">
                          <label>Status:</label>
                          <Tag value={selectedPolicy.actionPlan.status} severity="success" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabPanel>

              <TabPanel header="Communication History">
                <div className="communication-history">
                  {(selectedPolicy.activities || []).map(item => (
                    <div className="history-item" key={item.id}>
                      <div className="history-header">
                        <strong>{item.type}{item.method ? ` (${item.method})` : ''}</strong>
                        <small>{new Date(item.date).toLocaleDateString()}</small>
                      </div>
                      <p>{item.description}{item.outcome ? ` - ${item.outcome}` : ''}</p>
                    </div>
                  ))}
                </div>
              </TabPanel>
            </TabView>
          )}
        </Dialog>

        {/* Action Plan Dialog */}
        <Dialog
          header={t("renewal.createActionPlan")}
          visible={actionPlanVisible}
          onHide={() => setActionPlanVisible(false)}
          style={{ width: '600px' }}
          footer={actionPlanDialogFooter}
        >
          {selectedPolicy && (
            <div className="action-plan-form">
              <div className="form-section">
                <h4>Policy Information</h4>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Policy Number:</label>
                    <span>{selectedPolicy.policyNumber}</span>
                  </div>
                  <div className="form-field">
                    <label>Risk Score:</label>
                    <span>{selectedPolicy.riskScore}</span>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Action Plan Details</h4>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Priority Level</label>
                    <Dropdown
                      value={actionPlan.priority}
                      onChange={(e) => setActionPlan({...actionPlan, priority: e.value})}
                      options={priorityOptions}
                    />
                  </div>

                  <div className="form-field">
                    <label>Assigned To</label>
                    <InputText
                      value={actionPlan.assignedTo}
                      onChange={(e) => setActionPlan({...actionPlan, assignedTo: e.target.value})}
                      placeholder="Agent name"
                    />
                  </div>

                  <div className="form-field">
                    <label>Deadline</label>
                    <Calendar
                      value={actionPlan.deadline}
                      onChange={(e) => setActionPlan({...actionPlan, deadline: e.value})}
                      dateFormat="mm/dd/yy"
                      minDate={new Date()}
                    />
                  </div>

                  <div className="form-field">
                    <label>Approved Discount (%)</label>
                    <InputNumber
                      value={actionPlan.approvedDiscount}
                      onValueChange={(e) => setActionPlan({...actionPlan, approvedDiscount: e.value})}
                      min={0}
                      max={25}
                      suffix="%"
                    />
                  </div>
                </div>

                <div className="form-field full-width">
                  <label>Special Offer</label>
                  <InputText
                    value={actionPlan.specialOffer}
                    onChange={(e) => setActionPlan({...actionPlan, specialOffer: e.target.value})}
                    placeholder="Describe special retention offer"
                  />
                </div>

                <div className="form-field full-width">
                  <label>Additional Notes</label>
                  <InputTextarea
                    value={actionPlan.notes}
                    onChange={(e) => setActionPlan({...actionPlan, notes: e.target.value})}
                    rows={3}
                    placeholder="Enter additional notes or strategy details"
                  />
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Escalate Dialog */}
        <Dialog
          header="Escalate Policy"
          visible={escalateVisible}
          onHide={() => setEscalateVisible(false)}
          style={{ width: '400px' }}
          footer={
            <div>
              <Button
                label="Cancel"
                icon="pi pi-times"
                className="p-button-text"
                onClick={() => setEscalateVisible(false)}
              />
              <Button
                label="Escalate"
                icon="pi pi-arrow-up"
                className="p-button-danger"
                onClick={handleEscalateConfirm}
              />
            </div>
          }
        >
          {selectedPolicy && (
            <div className="escalate-content">
              <div className="warning-message">
                <i className="pi pi-exclamation-triangle"></i>
                <p>Are you sure you want to escalate this policy to senior management?</p>
              </div>

              <div className="policy-summary">
                <div><strong>Policy:</strong> {selectedPolicy.policyNumber}</div>
                <div><strong>Insured:</strong> {selectedPolicy.insuredName}</div>
                <div><strong>Risk Score:</strong> {selectedPolicy.riskScore}</div>
                <div><strong>Premium at Risk:</strong> {formatCurrency(selectedPolicy.currentPremium)}</div>
              </div>

              <p className="escalate-note">
                This policy will be flagged for immediate senior management attention.
              </p>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
};

export default AtRiskAnalysis;