import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { TabView, TabPanel } from "primereact/tabview";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { Badge } from "primereact/badge";
import { ProgressBar } from "primereact/progressbar";
import { Calendar } from "primereact/calendar";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import FieldError from "../../../components/FieldError";
import { calendarDateFormat, formatDate as formatAppDate, toIsoDate } from "../../../utility/dateFormat";
import { requiredErrors, hasErrors, errorSummary } from "../../../utility/requiredFields";
import "./index.scss";
import { formatPercent, progressValue } from "../../../utility/numberFormat";

const LapseManagement = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode, locale } = useFormatCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reasonFilter, setReasonFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [winBackVisible, setWinBackVisible] = useState(false);
  const [campaignVisible, setCampaignVisible] = useState(false);
  const [lapsedPolicies, setLapsedPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [winBackCampaigns, setWinBackCampaigns] = useState([]);
  const [lapseVisible, setLapseVisible] = useState(false);
  const [lapseReason, setLapseReason] = useState('');
  const [dashboardData, setDashboardData] = useState({
    totalLapsed: 0,
    inGracePeriod: 0,
    winBackEligible: 0,
    revenueAtRisk: 0
  });
  const [winBackOffer, setWinBackOffer] = useState({
    discount: 20,
    additionalBenefits: [],
    paymentTerms: 'Standard',
    validUntil: new Date(Date.now() + 30*24*60*60*1000),
    message: ''
  });
  const [campaignErrors, setCampaignErrors] = useState({});
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30*24*60*60*1000),
    targetSegment: 'All Lapsed',
    discount: 25,
    benefits: [],
    budget: 100000
  });
  const toast = useRef(null);

  const statusOptions = [
    { label: t("renewal.allStatuses"), value: "All" },
    { label: t("renewal.inGracePeriod"), value: "In Grace Period" },
    { label: t("renewal.lapsed"), value: "Lapsed" },
    { label: t("renewal.winBackAttempted"), value: "Win-back Attempted" },
    { label: t("renewal.reinstated"), value: "Reinstated" }
  ];

  const reasonOptions = [
    { label: t("renewal.allReasons"), value: "All" },
    { label: t("renewal.premiumTooHigh"), value: "Premium too high" },
    { label: t("renewal.foundCheaperAlternative"), value: "Found cheaper alternative" },
    { label: t("renewal.noLongerNeeded"), value: "No longer needed" },
    { label: t("renewal.poorService"), value: "Poor service" },
    { label: t("renewal.paymentIssues"), value: "Payment issues" }
  ];

  const benefitOptions = [
    "Waived reinstatement fee",
    "Free add-on coverage",
    "Extended payment terms",
    "Loyalty rewards",
    "Premium freeze",
    "Free policy review",
    "24/7 support priority",
    "Cashback offer"
  ];

  const paymentTermsOptions = [
    { label: t("renewal.standardTerms"), value: "Standard" },
    { label: t("renewal.extended60Days"), value: "Extended" },
    { label: t("renewal.installments"), value: "Installments" },
    { label: t("renewal.deferredPayment"), value: "Deferred" }
  ];

  const targetSegmentOptions = [
    { label: t("renewal.allLapsed"), value: "All Lapsed" },
    { label: t("renewal.highValue100K"), value: "High Value" },
    { label: t("renewal.recentLapse30Days"), value: "Recent Lapse" },
    { label: t("renewal.longTermClients3Years"), value: "Long-term" },
    { label: t("renewal.priceSensitive"), value: "Price Sensitive" }
  ];

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.lapseManagement"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, statusFilter, reasonFilter, lapsedPolicies]);

  const showError = (error, fallbackKey) => {
    toast.current.show({
      severity: 'error',
      summary: t("common.error"),
      detail: error?.message || t(fallbackKey),
      life: 3000
    });
  };

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + Number(days || 0));
    return toIsoDate(d);
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [lapsed, queue, campaigns, settings] = await Promise.all([
        renewalsWorkspaceService.getLapsed(),
        renewalsWorkspaceService.getQueue(),
        renewalsWorkspaceService.getCampaigns(),
        renewalsWorkspaceService.getSettings("renewals")
      ]);
      const graceDays = settings["renewals.grace_period_days"];
      const gracePeriodPolicies = queue.items
        .filter(policy => policy.inGracePeriod)
        .map(policy => ({
          ...policy,
          status: 'In Grace Period',
          gracePeriodEnd: addDays(policy.expiryDate, graceDays),
          lapseDate: null,
          daysLapsed: 0,
          premiumLost: policy.currentPremium,
          lapseReason: null,
          winBackAttempts: [],
          reinstatementEligible: false,
          winBackStatus: 'Eligible'
        }));
      const lapsedPolicies = lapsed.map(policy => ({
        ...policy,
        status: 'Lapsed',
        winBackAttempts: (policy.winBackAttempts || []).map(a => ({ ...a, response: a.outcome || 'Pending' }))
      }));

      const combinedData = [...lapsedPolicies, ...gracePeriodPolicies];
      setLapsedPolicies(combinedData);
      setWinBackCampaigns(campaigns);
      calculateDashboard(combinedData);
    } catch (error) {
      showError(error, "renewal.failedToLoadLapseData");
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboard = (data) => {
    const inGrace = data.filter(p => p.status === 'In Grace Period');
    const eligible = data.filter(p => p.reinstatementEligible);
    const totalRevenue = data.reduce((sum, p) => sum + (p.premiumLost || p.currentPremium), 0);

    setDashboardData({
      totalLapsed: data.length,
      inGracePeriod: inGrace.length,
      winBackEligible: eligible.length,
      revenueAtRisk: totalRevenue
    });
  };

  const applyFilters = () => {
    let filtered = [...lapsedPolicies];

    if (search) {
      filtered = filtered.filter(p =>
        p.policyNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.insuredName.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== 'All') {
      if (statusFilter === 'Lapsed') {
        filtered = filtered.filter(p => p.lapseDate);
      } else if (statusFilter === 'In Grace Period') {
        filtered = filtered.filter(p => p.status === 'In Grace Period');
      } else {
        filtered = filtered.filter(p => p.winBackStatus === statusFilter);
      }
    }

    if (reasonFilter !== 'All') {
      filtered = filtered.filter(p => p.lapseReason === reasonFilter);
    }

    setFilteredPolicies(filtered);
    calculateDashboard(filtered);
  };

  const handleClear = () => {
    setSearch("");
    setStatusFilter("All");
    setReasonFilter("All");
    toast.current.show({
      severity: 'info',
      summary: t("renewal.filtersCleared"),
      detail: t("renewal.allFiltersReset"),
      life: 2000
    });
  };

  const handleViewDetails = (rowData) => {
    setSelectedPolicy(rowData);
    setDetailsVisible(true);
  };

  const handleWinBack = (rowData) => {
    setSelectedPolicy(rowData);
    setWinBackOffer({
      discount: 20,
      additionalBenefits: ["Waived reinstatement fee"],
      paymentTerms: 'Standard',
      validUntil: new Date(Date.now() + 30*24*60*60*1000),
      message: ''
    });
    setWinBackVisible(true);
  };

  const handleCreateCampaign = () => {
    setNewCampaign({
      name: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30*24*60*60*1000),
      targetSegment: 'All Lapsed',
      discount: 25,
      benefits: [],
      budget: 100000
    });
    setCampaignErrors({});
    setCampaignVisible(true);
  };

  const handleSendWinBack = async () => {
    setLoading(true);
    try {
      const offer = [
        `${winBackOffer.discount}% discount`,
        ...winBackOffer.additionalBenefits,
        `${winBackOffer.paymentTerms} payment terms`,
        `valid until ${formatAppDate(winBackOffer.validUntil)}`
      ].join(', ');
      const activeCampaign = winBackCampaigns.find(c => c.status === 'active');
      await renewalsWorkspaceService.winBack(selectedPolicy.id, {
        offer,
        method: 'Email',
        campaignId: activeCampaign?.id,
        response: winBackOffer.message || undefined
      });
      setWinBackVisible(false);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.winBackSent"),
        detail: t("renewal.winBackOfferSentTo", { name: selectedPolicy.insuredName }),
        life: 3000
      });
      loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToSendWinBackOffer");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaignConfirm = async () => {
    const errors = requiredErrors(newCampaign, [
      ["name", "Campaign name"],
      ["startDate", "Start date"],
      ["endDate", "End date"],
      ["endDate", "End date", (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, "End date must be on or after the start date"],
    ]);
    setCampaignErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: t("common.validation", "Validation"), detail: errorSummary(errors), life: 4000 });
      return;
    }
    try {
      await renewalsWorkspaceService.createCampaign({
        campaignName: newCampaign.name,
        targetSegment: newCampaign.targetSegment,
        startDate: toIsoDate(newCampaign.startDate),
        endDate: toIsoDate(newCampaign.endDate),
        discount: newCampaign.discount,
        budget: newCampaign.budget,
        offers: newCampaign.benefits
      });
      setCampaignVisible(false);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.campaignCreated"),
        detail: t("renewal.campaignCreatedSuccess", { name: newCampaign.name }),
        life: 3000
      });
      loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToLoadLapseData");
    }
  };

  const openLapse = (rowData) => {
    setSelectedPolicy(rowData);
    setLapseReason('');
    setLapseVisible(true);
  };

  const handleLapseConfirm = async () => {
    try {
      await renewalsWorkspaceService.lapse(selectedPolicy.id, lapseReason);
      setLapseVisible(false);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.lapsed"),
        detail: selectedPolicy.policyNumber,
        life: 3000
      });
      loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToLoadLapseData");
    }
  };

  const handleReinstate = (rowData) => {
    confirmDialog({
      message: t("renewal.confirmReinstate", "Reinstate {{policy}}?", { policy: rowData.policyNumber }),
      header: t("renewal.reinstated"),
      icon: 'pi pi-replay',
      accept: async () => {
        try {
          await renewalsWorkspaceService.reinstate(rowData.id);
          toast.current.show({
            severity: 'success',
            summary: t("renewal.reinstated"),
            detail: rowData.policyNumber,
            life: 3000
          });
          loadInitialData();
        } catch (error) {
          showError(error, "renewal.failedToLoadLapseData");
        }
      }
    });
  };

  const statusBodyTemplate = (rowData) => {
    const status = rowData.status || (rowData.lapseDate ? 'Lapsed' : 'Active');
    const getSeverity = (status) => {
      switch (status) {
        case 'In Grace Period': return 'warning';
        case 'Lapsed': return 'danger';
        case 'Reinstated': return 'success';
        case 'Win-back Attempted': return 'info';
        default: return 'secondary';
      }
    };

    return <Tag value={status} severity={getSeverity(status)} />;
  };

  const daysLapsedBodyTemplate = (rowData) => {
    if (rowData.status === 'In Grace Period') {
      const graceDays = Math.floor((new Date(rowData.gracePeriodEnd) - new Date()) / (1000 * 60 * 60 * 24));
      return (
        <div className="grace-period-cell">
          <i className="pi pi-clock warning"></i>
          <span className="warning">{graceDays} days left</span>
        </div>
      );
    }

    if (rowData.daysLapsed) {
      const severity = rowData.daysLapsed <= 30 ? 'info' : rowData.daysLapsed <= 90 ? 'warning' : 'danger';
      return (
        <div className="lapsed-days-cell">
          <i className={`pi pi-calendar ${severity}`}></i>
          <span className={severity}>{rowData.daysLapsed} days</span>
        </div>
      );
    }

    return <span>-</span>;
  };

  const premiumBodyTemplate = (rowData) => {
    return formatCurrency(rowData.premiumLost || rowData.currentPremium);
  };

  const winBackStatusBodyTemplate = (rowData) => {
    const status = rowData.winBackStatus || 'Eligible';
    const getSeverity = (status) => {
      switch (status) {
        case 'Eligible': return 'success';
        case 'In Progress': return 'info';
        case 'Converted': return 'success';
        case 'Declined': return 'danger';
        default: return 'secondary';
      }
    };

    return <Badge value={status} severity={getSeverity(status)} />;
  };

  const attemptsBodyTemplate = (rowData) => {
    const attempts = rowData.winBackAttempts?.length || 0;
    const maxAttempts = 3;
    const percentage = (attempts / maxAttempts) * 100;

    return (
      <div className="attempts-cell">
        <ProgressBar value={progressValue(percentage)} showValue={false} style={{ width: '60px', height: '8px' }} />
        <span>{attempts}/{maxAttempts}</span>
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-text"
          onClick={() => handleViewDetails(rowData)}
          tooltip="View Details" aria-label="View Details"
        />
        <Button
          icon="pi pi-send"
          className="p-button-text"
          onClick={() => handleWinBack(rowData)}
          tooltip="Send Win-back"
          disabled={!rowData.reinstatementEligible || rowData.winBackStatus === 'Converted'} aria-label="Send Win-back"
        />
        {rowData.status === 'In Grace Period' ? (
          <Button
            icon="pi pi-ban"
            className="p-button-text p-button-danger"
            onClick={() => openLapse(rowData)}
            tooltip={t("renewal.lapsed")} aria-label={t("renewal.lapsed")}
          />
        ) : (
          <Button
            icon="pi pi-replay"
            className="p-button-text p-button-success"
            onClick={() => handleReinstate(rowData)}
            tooltip={t("renewal.reinstated")}
            disabled={!rowData.reinstatementEligible} aria-label={t("renewal.reinstated")}
          />
        )}
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

  const winBackDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setWinBackVisible(false)}
      />
      <Button
        label="Send Win-back"
        icon="pi pi-send"
        onClick={handleSendWinBack}
        loading={loading}
      />
    </div>
  );

  const campaignDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setCampaignVisible(false)}
      />
      <Button
        label="Create Campaign"
        icon="pi pi-check"
        onClick={handleCreateCampaignConfirm}
      />
    </div>
  );

  return (
    <div className="container__lapse__management__master">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.lapseManagement")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        {/* Search Section */}
        <div className="search-section">
          <Card>
            <div className="search-grid">
              <div className="search-field">
                <label>Policy/Insured Name</label>
                <InputText
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search policies or names"
                />
              </div>

              <div className="search-field">
                <label>Status</label>
                <Dropdown
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.value)}
                  options={statusOptions}
                />
              </div>

              <div className="search-field">
                <label>Lapse Reason</label>
                <Dropdown
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.value)}
                  options={reasonOptions}
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
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-ban card-icon red"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalLapsed}</span>
                <span className="card-label">{t("renewal.totalAtRisk")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatusFilter('In Grace Period')}>
            <div className="card-content">
              <i className="pi pi-clock card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.inGracePeriod}</span>
                <span className="card-label">{t("renewal.inGracePeriod")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatusFilter('Eligible')}>
            <div className="card-content">
              <i className="pi pi-refresh card-icon blue"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.winBackEligible}</span>
                <span className="card-label">Win-back Eligible</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-wallet card-icon dark-red"></i>
              <div className="card-info">
                <span className="card-value">{formatCurrency(dashboardData.revenueAtRisk)}</span>
                <span className="card-label">{t("renewal.revenueAtRisk")}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <TabView>
            <TabPanel header={t("renewal.lapsedPolicies")}>
              <div className="table-section">
                <Card>
                  <div className="table-header">
                    <h3>Lapsed & Grace Period Policies</h3>
                    <div className="table-actions">
                      <Button
                        label="Create Campaign"
                        icon="pi pi-plus"
                        onClick={handleCreateCampaign}
                      />
                      <Button
                        icon="pi pi-refresh"
                        className="p-button-text"
                        onClick={loadInitialData}
                        tooltip="Refresh" aria-label="Refresh"
                      />
                      <Button
                        icon="pi pi-file-excel"
                        className="p-button-text"
                        onClick={() => {
                          toast.current.show({
                            severity: 'success',
                            summary: t("renewal.exportStarted"),
                            detail: t("renewal.lapseDataExportedToExcel"),
                            life: 3000
                          });
                        }}
                        tooltip="Export to Excel" aria-label="Export to Excel"
                      />
                    </div>
                  </div>

                  <DataTable
                    value={filteredPolicies}
                    className="lapse-table"
                    stripedRows
                    paginator
                    rows={20}
                    loading={loading}
                    emptyMessage="No lapsed policies found"
                    sortMode="multiple"
                  >
                    <Column
                      body={policyLinkTemplate}
                      header="Policy Number"
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
                      body={statusBodyTemplate}
                      header={t("renewal.status")}
                      style={{ width: '10%' }}
                    />
                    <Column
                      body={daysLapsedBodyTemplate}
                      header={t("renewal.daysLapsed")}
                      style={{ width: '10%' }}
                      sortable
                      sortField="daysLapsed"
                    />
                    <Column
                      body={premiumBodyTemplate}
                      header={t("renewal.premiumLost")}
                      style={{ width: '12%', textAlign: 'right' }}
                      sortable
                      sortField="premiumLost"
                    />
                    <Column
                      field="lapseReason"
                      header={t("renewal.reason")}
                      style={{ width: '12%' }}
                    />
                    <Column
                      body={winBackStatusBodyTemplate}
                      header={t("renewal.winBack")}
                      style={{ width: '10%' }}
                    />
                    <Column
                      body={attemptsBodyTemplate}
                      header={t("renewal.attempts")}
                      style={{ width: '8%' }}
                    />
                    <Column
                      body={actionBodyTemplate}
                      header="Actions"
                      style={{ width: '10%' }}
                    />
                  </DataTable>
                </Card>
              </div>
            </TabPanel>

            <TabPanel header={t("renewal.winBackCampaigns")}>
              <div className="campaigns-section">
                <Card>
                  <div className="campaigns-header">
                    <h3>Active Win-back Campaigns</h3>
                    <Button
                      label="New Campaign"
                      icon="pi pi-plus"
                      onClick={handleCreateCampaign}
                    />
                  </div>

                  <div className="campaigns-grid">
                    {winBackCampaigns.map(campaign => (
                      <Card key={campaign.campaignId} className="campaign-card">
                        <div className="campaign-content">
                          <div className="campaign-header">
                            <h4>{campaign.campaignName}</h4>
                            <Badge value={campaign.campaignId} />
                          </div>

                          <div className="campaign-details">
                            <div className="detail-item">
                              <label>Period:</label>
                              <span>
                                {formatAppDate(campaign.startDate)} -
                                {formatAppDate(campaign.endDate)}
                              </span>
                            </div>
                            <div className="detail-item">
                              <label>Target:</label>
                              <span>{campaign.targetSegment}</span>
                            </div>
                            <div className="detail-item">
                              <label>Discount:</label>
                              <span>{campaign.offer?.discount}%</span>
                            </div>
                          </div>

                          <div className="campaign-stats">
                            <div className="stat-item">
                              <span className="stat-value">{campaign.statistics?.targetedPolicies || 0}</span>
                              <span className="stat-label">Targeted</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-value">{campaign.statistics?.converted || 0}</span>
                              <span className="stat-label">Converted</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-value">{formatPercent(campaign.statistics?.conversionRate || 0)}</span>
                              <span className="stat-label">Rate</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-value">{formatCurrency(campaign.statistics?.revenueRecovered || 0)}</span>
                              <span className="stat-label">Recovered</span>
                            </div>
                          </div>

                          <div className="campaign-progress">
                            <ProgressBar
                              value={progressValue(campaign.statistics?.conversionRate)}
                              showValue={false}
                              style={{ height: '6px' }}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
              </div>
            </TabPanel>
          </TabView>
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
                    <label>Policy Number:</label>
                    <span>{selectedPolicy.policyNumber}</span>
                  </div>
                  <div className="detail-item">
                    <label>Insured Name:</label>
                    <span>{selectedPolicy.insuredName}</span>
                  </div>
                  <div className="detail-item">
                    <label>Product:</label>
                    <span>{selectedPolicy.product}</span>
                  </div>
                  <div className="detail-item">
                    <label>Premium:</label>
                    <span>{formatCurrency(selectedPolicy.premiumLost || selectedPolicy.currentPremium)}</span>
                  </div>
                  {selectedPolicy.lapseDate && (
                    <div className="detail-item">
                      <label>Lapse Date:</label>
                      <span>{formatAppDate(selectedPolicy.lapseDate)}</span>
                    </div>
                  )}
                  {selectedPolicy.lapseReason && (
                    <div className="detail-item">
                      <label>Lapse Reason:</label>
                      <span>{selectedPolicy.lapseReason}</span>
                    </div>
                  )}
                </div>
              </TabPanel>

              <TabPanel header={t("renewal.winBackHistory")}>
                <div className="winback-history">
                  {selectedPolicy.winBackAttempts?.length > 0 ? (
                    selectedPolicy.winBackAttempts.map((attempt, index) => (
                      <div key={index} className="winback-item">
                        <div className="winback-header">
                          <strong>{attempt.method}</strong>
                          <span>{formatAppDate(attempt.date)}</span>
                        </div>
                        <div className="winback-details">
                          <p>Offer: {attempt.offer}</p>
                          <p>Response: {attempt.response}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No win-back attempts made yet.</p>
                  )}
                </div>
              </TabPanel>
            </TabView>
          )}
        </Dialog>

        <Dialog
          header={t("renewal.lapsed")}
          visible={lapseVisible}
          onHide={() => setLapseVisible(false)}
          style={{ width: '400px' }}
          footer={
            <div>
              <Button label="Cancel" icon="pi pi-times" className="p-button-text" onClick={() => setLapseVisible(false)} />
              <Button label={t("renewal.lapsed")} icon="pi pi-ban" className="p-button-danger"
                onClick={handleLapseConfirm} disabled={lapseReason.trim().length < 3} />
            </div>
          }
        >
          <div className="form-field">
            <label>{selectedPolicy?.policyNumber} - {selectedPolicy?.insuredName}</label>
            <Dropdown
              value={lapseReason}
              options={reasonOptions.filter(o => o.value !== 'All')}
              onChange={(e) => setLapseReason(e.value || '')}
              editable
              placeholder={t("renewal.allReasons")}
              style={{ width: '100%' }}
            />
          </div>
        </Dialog>

        {/* Win-back Offer Dialog */}
        <Dialog
          header={t("renewal.sendWinBackOffer")}
          visible={winBackVisible}
          onHide={() => setWinBackVisible(false)}
          style={{ width: '600px' }}
          footer={winBackDialogFooter}
        >
          {selectedPolicy && (
            <div className="winback-form">
              <div className="policy-info">
                <h4>Policy Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Policy:</label>
                    <span>{selectedPolicy.policyNumber}</span>
                  </div>
                  <div className="info-item">
                    <label>Insured:</label>
                    <span>{selectedPolicy.insuredName}</span>
                  </div>
                  <div className="info-item">
                    <label>Premium:</label>
                    <span>{formatCurrency(selectedPolicy.premiumLost || selectedPolicy.currentPremium)}</span>
                  </div>
                </div>
              </div>

              <div className="offer-details">
                <h4>Win-back Offer</h4>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Discount (%)</label>
                    <InputNumber
                      value={winBackOffer.discount}
                      onValueChange={(e) => setWinBackOffer({...winBackOffer, discount: e.value})}
                      min={0}
                      max={50}
                      suffix="%"
                    />
                  </div>

                  <div className="form-field">
                    <label>Payment Terms</label>
                    <Dropdown
                      value={winBackOffer.paymentTerms}
                      onChange={(e) => setWinBackOffer({...winBackOffer, paymentTerms: e.value})}
                      options={paymentTermsOptions}
                    />
                  </div>

                  <div className="form-field">
                    <label>Valid Until</label>
                    <Calendar
                      value={winBackOffer.validUntil}
                      onChange={(e) => setWinBackOffer({...winBackOffer, validUntil: e.value})}
                      dateFormat={calendarDateFormat()}
                      minDate={new Date()}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Additional Benefits</label>
                  <div className="benefits-selection">
                    {benefitOptions.map(benefit => (
                      <div key={benefit} className="benefit-checkbox">
                        <input
                          type="checkbox"
                          id={benefit}
                          checked={winBackOffer.additionalBenefits.includes(benefit)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWinBackOffer({
                                ...winBackOffer,
                                additionalBenefits: [...winBackOffer.additionalBenefits, benefit]
                              });
                            } else {
                              setWinBackOffer({
                                ...winBackOffer,
                                additionalBenefits: winBackOffer.additionalBenefits.filter(b => b !== benefit)
                              });
                            }
                          }}
                        />
                        <label htmlFor={benefit}>{benefit}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-field">
                  <label>Personal Message</label>
                  <InputTextarea
                    value={winBackOffer.message}
                    onChange={(e) => setWinBackOffer({...winBackOffer, message: e.target.value})}
                    rows={3}
                    placeholder="Add a personal message to the offer"
                  />
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Create Campaign Dialog */}
        <Dialog
          header={t("renewal.createWinBackCampaign")}
          visible={campaignVisible}
          onHide={() => setCampaignVisible(false)}
          style={{ width: '700px' }}
          footer={campaignDialogFooter}
        >
          <div className="campaign-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Campaign Name *</label>
                <InputText
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                  placeholder="Enter campaign name"
                />
                <FieldError error={campaignErrors.name} />
              </div>

              <div className="form-field">
                <label>Target Segment</label>
                <Dropdown
                  value={newCampaign.targetSegment}
                  onChange={(e) => setNewCampaign({...newCampaign, targetSegment: e.value})}
                  options={targetSegmentOptions}
                />
              </div>

              <div className="form-field">
                <label>Start Date *</label>
                <Calendar
                  value={newCampaign.startDate}
                  onChange={(e) => setNewCampaign({...newCampaign, startDate: e.value})}
                  dateFormat={calendarDateFormat()}
                  minDate={new Date()}
                />
                <FieldError error={campaignErrors.startDate} />
              </div>

              <div className="form-field">
                <label>End Date *</label>
                <Calendar
                  value={newCampaign.endDate}
                  onChange={(e) => setNewCampaign({...newCampaign, endDate: e.value})}
                  dateFormat={calendarDateFormat()}
                  minDate={newCampaign.startDate}
                />
                <FieldError error={campaignErrors.endDate} />
              </div>

              <div className="form-field">
                <label>Discount (%)</label>
                <InputNumber
                  value={newCampaign.discount}
                  onValueChange={(e) => setNewCampaign({...newCampaign, discount: e.value})}
                  min={0}
                  max={50}
                  suffix="%"
                />
              </div>

              <div className="form-field">
                <label>Budget</label>
                <InputNumber
                  value={newCampaign.budget}
                  onValueChange={(e) => setNewCampaign({...newCampaign, budget: e.value})}
                  mode="currency"
                  currency={currencyCode}
                  locale={locale}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Campaign Benefits</label>
              <div className="benefits-selection">
                {benefitOptions.map(benefit => (
                  <div key={benefit} className="benefit-checkbox">
                    <input
                      type="checkbox"
                      id={`campaign-${benefit}`}
                      checked={newCampaign.benefits.includes(benefit)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewCampaign({
                            ...newCampaign,
                            benefits: [...newCampaign.benefits, benefit]
                          });
                        } else {
                          setNewCampaign({
                            ...newCampaign,
                            benefits: newCampaign.benefits.filter(b => b !== benefit)
                          });
                        }
                      }}
                    />
                    <label htmlFor={`campaign-${benefit}`}>{benefit}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default LapseManagement;