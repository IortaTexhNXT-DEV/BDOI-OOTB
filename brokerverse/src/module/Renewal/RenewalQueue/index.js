import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { TabView, TabPanel } from "primereact/tabview";
import { Badge } from "primereact/badge";
import { ProgressBar } from "primereact/progressbar";
import { Avatar } from "primereact/avatar";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const RenewalQueue = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [dateRange, setDateRange] = useState([null, null]);
  const [riskLevel, setRiskLevel] = useState("All");
  const [agent, setAgent] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [sendReminderVisible, setSendReminderVisible] = useState(false);
  const [reminderMethod, setReminderMethod] = useState("Email");
  const [dashboardData, setDashboardData] = useState({
    totalPolicies: 0,
    dueSoon: 0,
    atRisk: 0,
    inGracePeriod: 0
  });
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [policies, setPolicies] = useState([]);
  const toast = useRef(null);

  const statusOptions = [
    { label: t("renewal.allStatuses"), value: "All" },
    { label: t("renewal.pending"), value: "Pending" },
    { label: t("renewal.quoteSent"), value: "Quote Sent" },
    { label: t("renewal.atRisk"), value: "At Risk" },
    { label: t("renewal.underNegotiation"), value: "Under Negotiation" },
    { label: t("renewal.inGracePeriod"), value: "In Grace Period" }
  ];

  const riskOptions = [
    { label: t("renewal.allRiskLevels"), value: "All" },
    { label: t("renewal.low"), value: "Low" },
    { label: t("renewal.medium"), value: "Medium" },
    { label: t("renewal.high"), value: "High" },
    { label: t("renewal.critical"), value: "Critical" }
  ];

  const agentOptions = [
    { label: t("renewal.allAgents"), value: "All" },
    ...[...new Set(policies.map(p => p.assignedAgent).filter(Boolean))].map(name => ({ label: name, value: name }))
  ];

  const reminderMethods = [
    { label: "Email", value: "Email" },
    { label: "SMS", value: "SMS" },
    { label: "Phone", value: "Phone" },
    { label: "Letter", value: "Letter" }
  ];

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.queueManagement"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, status, dateRange, riskLevel, agent, policies]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { items } = await renewalsWorkspaceService.getQueue();
      setPolicies(items);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToLoadRenewalData"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const showError = (error, fallbackKey) => {
    toast.current.show({
      severity: 'error',
      summary: t("common.error"),
      detail: error?.message || t(fallbackKey),
      life: 3000
    });
  };

  const handleRefresh = async () => {
    try {
      const result = await renewalsWorkspaceService.refreshPipeline();
      toast.current.show({
        severity: 'success',
        summary: t("renewal.dataLoaded"),
        detail: t("renewal.pipelineRefreshed", "Pipeline refreshed: {{created}} added, {{lapsed}} lapsed", result),
        life: 3000
      });
    } catch (error) {
      showError(error, "renewal.failedToLoadRenewalData");
    }
    loadInitialData();
  };

  const handleSendNotice = async (rowData) => {
    try {
      await renewalsWorkspaceService.sendNotice(rowData.id);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.reminderSent"),
        detail: `${rowData.nextNotice?.label}: ${rowData.policyNumber}`,
        life: 3000
      });
      loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToSendReminder");
    }
  };

  const handleComplete = (rowData) => {
    confirmDialog({
      message: t("renewal.confirmCompleteRenewal", "Renew policy {{policy}} for a new term?", { policy: rowData.policyNumber }),
      header: t("renewal.completeRenewal", "Complete Renewal"),
      icon: 'pi pi-check-circle',
      accept: async () => {
        try {
          const result = await renewalsWorkspaceService.complete(rowData.id);
          toast.current.show({
            severity: 'success',
            summary: t("renewal.completeRenewal", "Complete Renewal"),
            detail: result?.newPolicy?.policyNumber,
            life: 3000
          });
          loadInitialData();
        } catch (error) {
          showError(error, "renewal.failedToLoadRenewalData");
        }
      }
    });
  };

  const calculateDashboard = (data) => {
    const dueSoon = data.filter(p => p.daysToExpiry <= 30 && p.daysToExpiry > 0);
    const atRisk = data.filter(p => p.retentionRisk === 'High' || p.retentionRisk === 'Critical');
    const inGrace = data.filter(p => p.status === 'In Grace Period');

    setDashboardData({
      totalPolicies: data.length,
      dueSoon: dueSoon.length,
      atRisk: atRisk.length,
      inGracePeriod: inGrace.length
    });
  };

  const applyFilters = () => {
    let filtered = [...policies];

    if (search) {
      filtered = filtered.filter(p =>
        p.policyNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.insuredName.toLowerCase().includes(search.toLowerCase()) ||
        p.product.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status !== 'All') {
      filtered = filtered.filter(p => p.status === status);
    }

    if (riskLevel !== 'All') {
      filtered = filtered.filter(p => p.retentionRisk === riskLevel);
    }

    if (agent !== 'All') {
      filtered = filtered.filter(p => p.assignedAgent === agent);
    }

    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(p => {
        const expiry = new Date(p.expiryDate);
        return expiry >= dateRange[0] && expiry <= dateRange[1];
      });
    }

    setFilteredPolicies(filtered);
    calculateDashboard(filtered);
  };

  const handleClear = () => {
    setSearch("");
    setStatus("All");
    setDateRange([null, null]);
    setRiskLevel("All");
    setAgent("All");
    toast.current.show({
      severity: 'info',
      summary: t("renewal.filtersCleared"),
      detail: t("renewal.allFiltersReset"),
      life: 2000
    });
  };

  const handleView = (rowData) => {
    setSelectedPolicy(rowData);
    setDetailsVisible(true);
  };

  const handleGenerateQuote = (rowData) => {
    navigate(`/renewal/generate-quote/${rowData.id}`, { state: { policy: rowData } });
  };

  const handleSendReminder = (rowData) => {
    setSelectedPolicy(rowData);
    setSendReminderVisible(true);
  };

  const handleSendReminderConfirm = async () => {
    setLoading(true);
    try {
      await renewalsWorkspaceService.sendReminder(selectedPolicy.id, reminderMethod);
      loadInitialData();

      setSendReminderVisible(false);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.reminderSent"),
        detail: t("renewal.renewalReminderSentVia", { method: reminderMethod, name: selectedPolicy.insuredName }),
        life: 3000
      });
    } catch (error) {
      showError(error, "renewal.failedToSendReminder");
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = (rowData, newPriority) => {
    confirmDialog({
      message: t("renewal.confirmPriorityChange", { policy: rowData.policyNumber, priority: newPriority }),
      header: t("renewal.confirmPriorityChangeHeader"),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        toast.current.show({
          severity: 'success',
          summary: t("renewal.priorityUpdated"),
          detail: t("renewal.priorityChangedTo", { priority: newPriority }),
          life: 3000
        });
      }
    });
  };

  const daysToExpiryBodyTemplate = (rowData) => {
    const days = rowData.daysToExpiry;
    let severity = 'success';
    let icon = 'pi-calendar';

    if (days < 0) {
      severity = 'danger';
      icon = 'pi-exclamation-triangle';
    } else if (days <= 7) {
      severity = 'danger';
      icon = 'pi-clock';
    } else if (days <= 15) {
      severity = 'warning';
      icon = 'pi-clock';
    } else if (days <= 30) {
      severity = 'info';
    }

    return (
      <div className="days-to-expiry">
        <i className={`pi ${icon} expiry-icon ${severity}`}></i>
        <span className={`expiry-text ${severity}`}>
          {days < 0 ? t("renewal.daysOverdue", { days: Math.abs(days) }) : t("renewal.days", { days })}
        </span>
      </div>
    );
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Quote Sent': return 'info';
        case 'Under Negotiation': return 'warning';
        case 'At Risk': return 'danger';
        case 'In Grace Period': return 'danger';
        case 'Pending': return 'secondary';
        default: return 'secondary';
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const riskBodyTemplate = (rowData) => {
    const getSeverity = (risk) => {
      switch (risk) {
        case 'Low': return 'success';
        case 'Medium': return 'warning';
        case 'High': return 'danger';
        case 'Critical': return 'danger';
        default: return 'secondary';
      }
    };

    return <Tag value={rowData.retentionRisk} severity={getSeverity(rowData.retentionRisk)} />;
  };

  const premiumBodyTemplate = (rowData) => {
    return formatCurrency(rowData.currentPremium);
  };

  const agentBodyTemplate = (rowData) => {
    return (
      <div className="agent-cell">
        <Avatar label={(rowData.assignedAgent || '').split(' ').map(n => n[0]).join('')}
                size="small" shape="circle" />
        <span>{rowData.assignedAgent}</span>
      </div>
    );
  };

  const attemptsBodyTemplate = (rowData) => {
    const maxAttempts = 3;
    const percentage = (rowData.renewalAttempts / maxAttempts) * 100;

    return (
      <div className="attempts-cell">
        <ProgressBar value={percentage} style={{ width: '60px', height: '8px' }} />
        <span>{rowData.renewalAttempts}/{maxAttempts}</span>
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-text"
          onClick={() => handleView(rowData)}
          tooltip={t("renewal.viewDetails")}
        />
        <Button
          icon="pi pi-file-o"
          className="p-button-text"
          onClick={() => handleGenerateQuote(rowData)}
          tooltip={t("renewal.generateQuote")}
          disabled={!rowData.isOpen || rowData.statusCode === 'pending-approval'}
        />
        <Button
          icon="pi pi-send"
          className="p-button-text"
          onClick={() => handleSendReminder(rowData)}
          tooltip={t("renewal.sendReminder")}
        />
        <Button
          icon="pi pi-envelope"
          className="p-button-text"
          onClick={() => handleSendNotice(rowData)}
          tooltip={rowData.nextNotice?.label || t("renewal.allNoticesSent", "All notices sent")}
          disabled={!rowData.nextNotice}
        />
        {rowData.statusCode === 'approved' && (
          <Button
            icon="pi pi-check-circle"
            className="p-button-text p-button-success"
            onClick={() => handleComplete(rowData)}
            tooltip={t("renewal.completeRenewal", "Complete Renewal")}
          />
        )}
      </div>
    );
  };

  const policyLinkTemplate = (rowData) => {
    return (
      <a href="#" className="policy-link" onClick={(e) => {
        e.preventDefault();
        handleView(rowData);
      }}>
        {rowData.policyNumber}
      </a>
    );
  };

  const reminderDialogFooter = (
    <div className="dialog-footer">
      <Button
        label={t("renewal.cancel")}
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setSendReminderVisible(false)}
      />
      <Button
        label={t("renewal.sendReminder")}
        icon="pi pi-send"
        onClick={handleSendReminderConfirm}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="container__renewal__queue__master">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.renewalQueue")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        <div className="search-section">
          <Card>
            <div className="search-grid">
              <div className="search-field">
                <label>{t("renewal.policyInsuredName")}</label>
                <InputText
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("renewal.searchPoliciesOrNames")}
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.status")}</label>
                <Dropdown
                  value={status}
                  onChange={(e) => setStatus(e.value)}
                  options={statusOptions}
                  placeholder={t("renewal.selectStatus")}
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.riskLevel")}</label>
                <Dropdown
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.value)}
                  options={riskOptions}
                  placeholder={t("renewal.selectRiskLevel")}
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.agent")}</label>
                <Dropdown
                  value={agent}
                  onChange={(e) => setAgent(e.value)}
                  options={agentOptions}
                  placeholder={t("renewal.selectAgent")}
                />
              </div>

              <div className="search-field">
                <label>{t("renewal.expiryDateRange")}</label>
                <Calendar
                  value={dateRange}
                  onChange={(e) => setDateRange(e.value)}
                  selectionMode="range"
                  dateFormat={calendarDateFormat()}
                  placeholder={t("renewal.selectDateRange")}
                />
              </div>

              <div className="search-actions">
                <Button label={t("renewal.search")} icon="pi pi-search" onClick={applyFilters} />
                <Button label={t("renewal.clear")} className="p-button-secondary" onClick={handleClear} />
              </div>
            </div>
          </Card>
        </div>

        <div className="dashboard-cards">
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-list card-icon blue"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalPolicies}</span>
                <span className="card-label">{t("renewal.totalPolicies")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatus('Pending')}>
            <div className="card-content">
              <i className="pi pi-clock card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.dueSoon}</span>
                <span className="card-label">{t("renewal.dueSoon30Days")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setRiskLevel('High')}>
            <div className="card-content">
              <i className="pi pi-exclamation-triangle card-icon red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.atRisk}</span>
                <span className="card-label">{t("renewal.atRisk")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatus('In Grace Period')}>
            <div className="card-content">
              <i className="pi pi-ban card-icon dark-red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.inGracePeriod}</span>
                <span className="card-label">{t("renewal.inGracePeriod")}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="table-section">
          <Card>
            <div className="table-header">
              <h3>{t("renewal.policiesDueForRenewal")}</h3>
              <div className="table-actions">
                <Button
                  icon="pi pi-refresh"
                  className="p-button-text"
                  onClick={handleRefresh}
                  tooltip={t("renewal.refresh")}
                />
                <Button
                  icon="pi pi-file-excel"
                  className="p-button-text"
                  onClick={() => {
                    toast.current.show({
                      severity: 'success',
                      summary: t("renewal.exportStarted"),
                      detail: t("renewal.renewalQueueExportedToExcel"),
                      life: 3000
                    });
                  }}
                  tooltip={t("renewal.exportToExcel")}
                />
              </div>
            </div>

            <DataTable
              value={filteredPolicies}
              className="renewal-table"
              stripedRows
              paginator
              rows={10}
              loading={loading}
              emptyMessage={t("renewal.noPoliciesFound")}
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
                field="insurer"
                header={t("renewal.insurer")}
                style={{ width: '10%' }}
                sortable
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
                body={statusBodyTemplate}
                header={t("renewal.status")}
                style={{ width: '10%' }}
              />
              <Column
                body={riskBodyTemplate}
                header={t("renewal.risk")}
                style={{ width: '8%' }}
              />
              <Column
                body={agentBodyTemplate}
                header={t("renewal.agent")}
                style={{ width: '10%' }}
              />
              <Column
                body={attemptsBodyTemplate}
                header={t("renewal.attempts")}
                style={{ width: '8%' }}
              />
              <Column
                body={actionBodyTemplate}
                header={t("renewal.actions")}
                style={{ width: '6%' }}
              />
            </DataTable>
          </Card>
        </div>

        {/* Policy Details Dialog */}
        <Dialog
          header={t("renewal.policyDetails")}
          visible={detailsVisible}
          onHide={() => setDetailsVisible(false)}
          style={{ width: '70vw' }}
        >
          {selectedPolicy && (
            <TabView>
              <TabPanel header={t("renewal.policyInformation")}>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>{t("renewal.policyNumberLabel")}</label>
                    <span>{selectedPolicy.policyNumber}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.insuredNameLabel")}</label>
                    <span>{selectedPolicy.insuredName}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.productLabel")}</label>
                    <span>{selectedPolicy.product}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.insurerLabel")}</label>
                    <span>{selectedPolicy.insurer}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.expiryDate")}</label>
                    <span>{formatAppDate(selectedPolicy.expiryDate)}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.currentPremium")}</label>
                    <span>{formatCurrency(selectedPolicy.currentPremium)}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.sumInsured")}</label>
                    <span>{formatCurrency(selectedPolicy.sumInsured)}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.loyaltyYears")}</label>
                    <span>{selectedPolicy.loyaltyYears} {t("renewal.years")}</span>
                  </div>
                </div>
              </TabPanel>

              <TabPanel header={t("renewal.contactInformation")}>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>{t("renewal.mobile")}</label>
                    <span>{selectedPolicy.insuredContact?.mobile}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.email")}</label>
                    <span>{selectedPolicy.insuredContact?.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.preferredContact")}</label>
                    <span>{selectedPolicy.insuredContact?.preferredContact}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.lastContact")}</label>
                    <span>{selectedPolicy.lastContactDate || t("renewal.notContacted")}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.renewalAttempts")}</label>
                    <span>{selectedPolicy.renewalAttempts}</span>
                  </div>
                  <div className="detail-item">
                    <label>{t("renewal.assignedAgent")}</label>
                    <span>{selectedPolicy.assignedAgent}</span>
                  </div>
                </div>
              </TabPanel>

              {selectedPolicy.claimsHistory && (
                <TabPanel header={t("renewal.claimsHistory")}>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>{t("renewal.claimsLastYear")}</label>
                      <span>{selectedPolicy.claimsHistory.hasClaimsLastYear ? t("renewal.yes") : t("renewal.no")}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t("renewal.totalClaims")}</label>
                      <span>{selectedPolicy.claimsHistory.totalClaims}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t("renewal.claimsAmount")}</label>
                      <span>{formatCurrency(selectedPolicy.claimsHistory.claimsAmount)}</span>
                    </div>
                    {selectedPolicy.claimsHistory.claimsRatio && (
                      <div className="detail-item">
                        <label>{t("renewal.claimsRatio")}</label>
                        <span>{selectedPolicy.claimsHistory.claimsRatio}%</span>
                      </div>
                    )}
                  </div>
                </TabPanel>
              )}
            </TabView>
          )}
        </Dialog>

        <Dialog
          header={t("renewal.sendRenewalReminder")}
          visible={sendReminderVisible}
          onHide={() => setSendReminderVisible(false)}
          style={{ width: '400px' }}
          footer={reminderDialogFooter}
        >
          {selectedPolicy && (
            <div className="reminder-form">
              <div className="form-field">
                <label>{t("renewal.policy")}</label>
                <span>{selectedPolicy.policyNumber} - {selectedPolicy.insuredName}</span>
              </div>
              <div className="form-field">
                <label>{t("renewal.reminderMethod")}</label>
                <Dropdown
                  value={reminderMethod}
                  onChange={(e) => setReminderMethod(e.value)}
                  options={reminderMethods}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-field">
                <label>{t("renewal.contactInfo")}</label>
                <span>
                  {reminderMethod === 'Email' && selectedPolicy.insuredContact?.email}
                  {reminderMethod === 'SMS' && selectedPolicy.insuredContact?.mobile}
                  {reminderMethod === 'Phone' && selectedPolicy.insuredContact?.mobile}
                  {reminderMethod === 'Letter' && t("renewal.mailingAddressOnFile")}
                </span>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
};

export default RenewalQueue;