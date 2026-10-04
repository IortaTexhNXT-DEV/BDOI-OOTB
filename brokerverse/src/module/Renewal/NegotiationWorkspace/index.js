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
import { ConfirmDialog } from "primereact/confirmdialog";
import { Timeline } from "primereact/timeline";
import { TabView, TabPanel } from "primereact/tabview";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { Badge } from "primereact/badge";
import { FileUpload } from "primereact/fileupload";
import { ScrollPanel } from "primereact/scrollpanel";
import { Splitter, SplitterPanel } from "primereact/splitter";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import FieldError from "../../../components/FieldError";
import SvgDot from "../../../assets/icons/SvgDot";
import { calendarDateFormat, formatDate as formatAppDate, toIsoDate } from "../../../utility/dateFormat";
import { requiredErrors, hasErrors, errorSummary } from "../../../utility/requiredFields";
import "./index.scss";

const NegotiationWorkspace = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode, locale } = useFormatCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [negotiations, setNegotiations] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState([]);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [updateErrors, setUpdateErrors] = useState({});
  const [approvalVisible, setApprovalVisible] = useState(false);
  const [communicationVisible, setCommunicationVisible] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalNegotiations: 0,
    pendingApproval: 0,
    activeNegotiations: 0,
    closedToday: 0
  });
  const [newUpdate, setNewUpdate] = useState({
    type: 'Update',
    method: 'Phone',
    description: '',
    outcome: '',
    nextAction: '',
    followUpDate: new Date(Date.now() + 24*60*60*1000)
  });
  const [approvalRequest, setApprovalRequest] = useState({
    requestedPremium: 0,
    discountPercent: 0,
    specialTerms: [],
    justification: '',
    urgency: 'Normal'
  });
  const [newCommunication, setNewCommunication] = useState({
    method: 'Email',
    subject: '',
    message: '',
    scheduledDate: new Date(),
    attachments: []
  });
  const toast = useRef(null);

  const statusFilterOptions = [
    { label: "All Statuses", value: "All" },
    ...[...new Set(negotiations.map(n => n.currentStage).filter(Boolean))].map(stage => ({ label: stage, value: stage }))
  ];

  const agentFilterOptions = [
    { label: "All sales persons", value: "All" },
    ...[...new Set(negotiations.map(n => n.assignedAgent).filter(Boolean))].map(name => ({ label: name, value: name }))
  ];

  const updateTypeOptions = [
    { label: "Update", value: "Update" },
    { label: "Meeting", value: "Meeting" },
    { label: "Counter Offer", value: "Counter Offer" },
    { label: "Competitor Quote", value: "Competitor Quote" },
    { label: "Revised Offer", value: "Revised Offer" },
    { label: "Approval Request", value: "Approval Request" }
  ];

  const communicationMethodOptions = [
    { label: "Phone", value: "Phone" },
    { label: "Email", value: "Email" },
    { label: "Face-to-face", value: "Face-to-face" },
    { label: "Video Call", value: "Video Call" },
    { label: "SMS", value: "SMS" }
  ];

  const urgencyOptions = [
    { label: "Normal", value: "Normal" },
    { label: "High", value: "High" },
    { label: "Urgent", value: "Urgent" }
  ];

  const specialTermsOptions = [
    "Extended payment terms",
    "Waived fees",
    "Additional coverage",
    "Multi-year discount",
    "Bundle discount",
    "Free add-ons",
    "Quarterly payment option",
    "Auto-debit setup"
  ];

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.negotiationWorkspace"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, statusFilter, agentFilter, negotiations]);

  useEffect(() => {
    if (negotiations.length > 0 && !selectedNegotiation) {
      setSelectedNegotiation(negotiations[0]);
    }
  }, [negotiations]);

  const showError = (error, fallbackKey) => {
    toast.current.show({
      severity: 'error',
      summary: t("common.error"),
      detail: error?.message || t(fallbackKey),
      life: 3000
    });
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rows, pending] = await Promise.all([
        renewalsWorkspaceService.getNegotiations(),
        renewalsWorkspaceService.getApprovals()
      ]);
      setNegotiations(rows);
      setApprovals(pending);
      setSelectedNegotiation(current => rows.find(n => n.id === current?.id) || rows[0] || null);
      calculateDashboard(rows);
    } catch (error) {
      showError(error, "renewal.failedToLoadNegotiationData");
    } finally {
      setLoading(false);
    }
  };

  /** Adds an entry to the selected renewal's timeline and reloads the workspace. */
  const recordActivity = async (activity, successSummary, successDetail, fallbackKey) => {
    setLoading(true);
    try {
      await renewalsWorkspaceService.addActivity(selectedNegotiation.id, activity);
      toast.current.show({ severity: 'success', summary: successSummary, detail: successDetail, life: 3000 });
      await loadInitialData();
      return true;
    } catch (error) {
      showError(error, fallbackKey);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const pendingApproval = approvals.find(a => a.renewalId === selectedNegotiation?.id);

  const handleDecision = async (decision) => {
    setLoading(true);
    try {
      await renewalsWorkspaceService.decide(selectedNegotiation.id, decision);
      toast.current.show({
        severity: 'success',
        summary: decision === 'approve' ? t("renewal.approved", "Approved") : t("renewal.rejected", "Rejected"),
        detail: selectedNegotiation.policyNumber,
        life: 3000
      });
      await loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToSubmitApprovalRequest");
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboard = (data) => {
    const pending = data.filter(n => n.currentStage === 'Pending Approval');
    const active = data.filter(n => n.currentStage === 'Active Negotiation');
    const today = new Date().toISOString().split('T')[0];
    const closedToday = data.filter(n =>
      n.currentStage === 'Closed' && n.lastUpdated === today
    );

    setDashboardData({
      totalNegotiations: data.length,
      pendingApproval: pending.length,
      activeNegotiations: active.length,
      closedToday: closedToday.length
    });
  };

  const applyFilters = () => {
    let filtered = [...negotiations];

    if (search) {
      filtered = filtered.filter(n =>
        n.policyNumber.toLowerCase().includes(search.toLowerCase()) ||
        n.clientName.toLowerCase().includes(search.toLowerCase()) ||
        n.negotiationId.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(n => n.currentStage === statusFilter);
    }

    if (agentFilter !== 'All') {
      filtered = filtered.filter(n => n.assignedAgent === agentFilter);
    }

    setFilteredNegotiations(filtered);
    calculateDashboard(filtered);
  };

  const handleClear = () => {
    setSearch("");
    setStatusFilter("All");
    setAgentFilter("All");
    toast.current.show({
      severity: 'info',
      summary: t("renewal.filtersCleared"),
      detail: t("renewal.allFiltersReset"),
      life: 2000
    });
  };

  const handleSelectNegotiation = (negotiation) => {
    setSelectedNegotiation(negotiation);
  };

  const handleAddUpdate = () => {
    setUpdateErrors({});
    setNewUpdate({
      type: 'Update',
      method: 'Phone',
      description: '',
      outcome: '',
      nextAction: '',
      followUpDate: new Date(Date.now() + 24*60*60*1000)
    });
    setUpdateVisible(true);
  };

  const handleRequestApproval = () => {
    if (selectedNegotiation) {
      const currentPremium = selectedNegotiation.currentPremium || 0;
      const quotedPremium = selectedNegotiation.quotedPremium || currentPremium;

      setApprovalRequest({
        requestedPremium: Math.round(quotedPremium * 0.95), // 5% discount
        discountPercent: 5,
        specialTerms: [],
        justification: '',
        urgency: 'Normal'
      });
      setApprovalVisible(true);
    }
  };

  const handleSendCommunication = () => {
    setCommunicationVisible(true);
  };

  const handleSaveUpdate = async () => {
    const errors = requiredErrors(newUpdate, [["type", "Update type"], ["method", "Communication method"], ["description", "Description"]]);
    setUpdateErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: t("common.validation", "Validation"), detail: errorSummary(errors), life: 4000 });
      return;
    }
    const saved = await recordActivity(
      {
        type: newUpdate.type,
        method: newUpdate.method,
        description: newUpdate.description,
        outcome: newUpdate.outcome || undefined,
        nextAction: newUpdate.nextAction || undefined,
        followUpDate: toIsoDate(newUpdate.followUpDate) || undefined
      },
      t("renewal.updateAdded"),
      t("renewal.negotiationTimelineUpdated"),
      "renewal.failedToSaveUpdate"
    );
    if (saved) setUpdateVisible(false);
  };

  const handleSubmitApproval = async () => {
    setLoading(true);
    try {
      const note = [
        `Requested premium ${approvalRequest.requestedPremium} (${approvalRequest.discountPercent}% discount)`,
        approvalRequest.specialTerms.length ? `Terms: ${approvalRequest.specialTerms.join(', ')}` : '',
        `Urgency: ${approvalRequest.urgency}`,
        approvalRequest.justification
      ].filter(Boolean).join('; ');
      await renewalsWorkspaceService.submitForApproval(selectedNegotiation.id, note);
      setApprovalVisible(false);
      toast.current.show({
        severity: 'success',
        summary: t("renewal.approvalRequested"),
        detail: t("renewal.specialTermsApprovalSubmitted"),
        life: 3000
      });
      await loadInitialData();
    } catch (error) {
      showError(error, "renewal.failedToSubmitApprovalRequest");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCommunicationConfirm = async () => {
    const sent = await recordActivity(
      {
        type: "Communication",
        method: newCommunication.method,
        description: `${newCommunication.subject}: ${newCommunication.message}`,
        followUpDate: toIsoDate(newCommunication.scheduledDate) || undefined
      },
      t("renewal.communicationSent"),
      t("renewal.communicationSentToClient", { method: newCommunication.method }),
      "renewal.failedToSaveUpdate"
    );
    if (sent) setCommunicationVisible(false);
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (stage) => {
      switch (stage) {
        case 'Pending Approval': return 'warning';
        case 'Active Negotiation': return 'info';
        case 'Counter Offer': return 'secondary';
        case 'Awaiting Response': return 'secondary';
        case 'Closed': return 'success';
        default: return 'secondary';
      }
    };

    return <Tag value={rowData.currentStage} severity={getSeverity(rowData.currentStage)} />;
  };




  const policyLinkTemplate = (rowData) => {
    return (
      <a href="#" className="policy-link" onClick={(e) => {
        e.preventDefault();
        handleSelectNegotiation(rowData);
      }}>
        {rowData.policyNumber}
      </a>
    );
  };

  const timelineItemTemplate = (item) => {
    const getTypeIcon = (type) => {
      switch (type) {
        case 'Initial Contact': return 'pi-envelope';
        case 'Meeting': return 'pi-users';
        case 'Counter Offer': return 'pi-arrow-right-arrow-left';
        case 'Competitor Quote': return 'pi-exclamation-triangle';
        case 'Revised Offer': return 'pi-refresh';
        case 'Approval Request': return 'pi-arrow-up';
        case 'Communication': return 'pi-comments';
        default: return 'pi-circle';
      }
    };

    const getTypeColor = (type) => {
      switch (type) {
        case 'Initial Contact': return 'blue';
        case 'Meeting': return 'green';
        case 'Counter Offer': return 'orange';
        case 'Competitor Quote': return 'red';
        case 'Revised Offer': return 'purple';
        case 'Approval Request': return 'info';
        case 'Communication': return 'cyan';
        default: return 'gray';
      }
    };

    return (
      <div className="timeline-item-content">
        <div className="timeline-header">
          <div className="timeline-type">
            <i className={`pi ${getTypeIcon(item.type)} ${getTypeColor(item.type)}`}></i>
            <strong>{item.type}</strong>
          </div>
          <div className="timeline-meta">
            <span className="timeline-method">{item.method}</span>
            <span className="timeline-date">{formatAppDate(item.date)}</span>
            {item.by && <span className="timeline-by">{item.by}</span>}
          </div>
        </div>
        <div className="timeline-description">
          {item.description}
        </div>
        {item.outcome && (
          <div className="timeline-outcome">
            <strong>Outcome:</strong> {item.outcome}
          </div>
        )}
        {item.nextAction && (
          <div className="timeline-next-action">
            <strong>Next Action:</strong> {item.nextAction}
          </div>
        )}
        {item.followUpDate && (
          <div className="timeline-follow-up">
            <strong>Follow-up:</strong> {formatAppDate(item.followUpDate)}
          </div>
        )}
      </div>
    );
  };

  const updateDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setUpdateVisible(false)}
      />
      <Button
        label="Save Update"
        icon="pi pi-check"
        onClick={handleSaveUpdate}
        loading={loading}
      />
    </div>
  );

  const approvalDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setApprovalVisible(false)}
      />
      <Button
        label="Submit Request"
        icon="pi pi-send"
        onClick={handleSubmitApproval}
        loading={loading}
      />
    </div>
  );

  const communicationDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setCommunicationVisible(false)}
      />
      <Button
        label="Send"
        icon="pi pi-send"
        onClick={handleSendCommunicationConfirm}
      />
    </div>
  );

  return (
    <div className="container__negotiation__workspace__master">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.negotiationWorkspace")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        {/* Search Section */}
        <div className="search-section">
          <Card>
            <div className="search-grid">
              <div className="search-field">
                <label>Policy/Client/Negotiation ID</label>
                <InputText
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search negotiations"
                />
              </div>

              <div className="search-field">
                <label>Status</label>
                <Dropdown
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.value)}
                  options={statusFilterOptions}
                />
              </div>

              <div className="search-field">
                <label>Sales person</label>
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
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-comments card-icon blue"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalNegotiations}</span>
                <span className="card-label">{t("renewal.totalNegotiations")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatusFilter('Pending Approval')}>
            <div className="card-content">
              <i className="pi pi-clock card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.pendingApproval}</span>
                <span className="card-label">{t("renewal.pendingApproval")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card clickable" onClick={() => setStatusFilter('Active Negotiation')}>
            <div className="card-content">
              <i className="pi pi-arrow-right-arrow-left card-icon green"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.activeNegotiations}</span>
                <span className="card-label">{t("renewal.activeNegotiations")}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-check card-icon success"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.closedToday}</span>
                <span className="card-label">{t("renewal.closedToday")}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Workspace */}
        <div className="workspace-section">
          <Card>
            <div className="workspace-header">
              <h3>{t("renewal.negotiations")}</h3>
              <div className="workspace-actions">
                <Button
                  label={t("renewal.addNote")}
                  icon="pi pi-plus"
                  outlined
                  onClick={handleAddUpdate}
                  disabled={!selectedNegotiation}
                />
                <Button
                  label={t("renewal.requestApproval")}
                  icon="pi pi-arrow-up"
                  outlined
                  onClick={handleRequestApproval}
                  disabled={!selectedNegotiation || selectedNegotiation.currentStage === 'Pending Approval'}
                />
                <Button
                  label={t("renewal.sendCommunication")}
                  icon="pi pi-send"
                  onClick={handleSendCommunication}
                  disabled={!selectedNegotiation}
                />
                {pendingApproval && (
                  <>
                    <Button
                      label={t("renewal.approve", "Approve")}
                      icon="pi pi-check"
                      className="p-button-success"
                      onClick={() => handleDecision('approve')}
                    />
                    <Button
                      label={t("renewal.reject", "Reject")}
                      icon="pi pi-times"
                      className="p-button-danger"
                      onClick={() => handleDecision('reject')}
                    />
                  </>
                )}
              </div>
            </div>

            <Splitter style={{ height: '600px' }}>
              <SplitterPanel className="negotiations-list" size={35}>
                <div className="list-header">
                  <h4>Active Negotiations</h4>
                  <Badge value={filteredNegotiations.length} />
                </div>
                <ScrollPanel style={{ width: '100%', height: '520px' }}>
                  <DataTable
                    value={filteredNegotiations}
                    className="negotiations-table compact"
                    loading={loading}
                    emptyMessage="No negotiations found"
                    selection={selectedNegotiation}
                    onSelectionChange={(e) => setSelectedNegotiation(e.value)}
                    selectionMode="single"
                  >
                    <Column
                      body={policyLinkTemplate}
                      header={t("renewal.policyNumber")}
                      style={{ width: '30%' }}
                    />
                    <Column
                      field="clientName"
                      header={t("renewal.client")}
                      style={{ width: '35%' }}
                    />
                    <Column
                      body={statusBodyTemplate}
                      header={t("renewal.status")}
                      style={{ width: '35%' }}
                    />
                  </DataTable>
                </ScrollPanel>
              </SplitterPanel>

              <SplitterPanel className="negotiation-details" size={65}>
                {selectedNegotiation ? (
                  <TabView>
                    <TabPanel header={t("renewal.timeline")}>
                      <div className="timeline-container">
                        {!(selectedNegotiation.timeline || []).length && (
                          <p className="text-color-secondary m-0">{t("renewal.noTimeline")}</p>
                        )}
                        <Timeline
                          value={selectedNegotiation.timeline}
                          content={timelineItemTemplate}
                          align="left"
                          className="negotiation-timeline"
                        />
                      </div>
                    </TabPanel>

                    <TabPanel header={t("renewal.details")}>
                      <div className="negotiation-details-content">
                        <div className="details-grid">
                          <div className="detail-section">
                            <h4>Negotiation Information</h4>
                            <div className="detail-item">
                              <label>Negotiation ID:</label>
                              <span>{selectedNegotiation.negotiationId}</span>
                            </div>
                            <div className="detail-item">
                              <label>Policy Number:</label>
                              <span>{selectedNegotiation.policyNumber}</span>
                            </div>
                            <div className="detail-item">
                              <label>Client Name:</label>
                              <span>{selectedNegotiation.clientName}</span>
                            </div>
                            <div className="detail-item">
                              <label>Current Stage:</label>
                              <Tag value={selectedNegotiation.currentStage} />
                            </div>
                            <div className="detail-item">
                              <label>Created Date:</label>
                              <span>{formatAppDate(selectedNegotiation.createdDate)}</span>
                            </div>
                            <div className="detail-item">
                              <label>Last Updated:</label>
                              <span>{formatAppDate(selectedNegotiation.lastUpdated)}</span>
                            </div>
                          </div>

                          <div className="detail-section">
                            <h4>Premium Information</h4>
                            <div className="detail-item">
                              <label>Current Premium:</label>
                              <span>{formatCurrency(selectedNegotiation.currentPremium)}</span>
                            </div>
                            {selectedNegotiation.quotedPremium && (
                              <div className="detail-item">
                                <label>Quoted Premium:</label>
                                <span>{formatCurrency(selectedNegotiation.quotedPremium)}</span>
                              </div>
                            )}
                            {selectedNegotiation.finalOffer && (
                              <div className="detail-item">
                                <label>Final Offer:</label>
                                <span>{formatCurrency(selectedNegotiation.finalOffer.premium)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedNegotiation.competitorAnalysis && (
                          <div className="competitor-analysis">
                            <h4>Competitive Analysis</h4>
                            <div className="analysis-grid">
                              <div className="advantages-section">
                                <h5>Our Advantages</h5>
                                <ul>
                                  {selectedNegotiation.competitorAnalysis.ourAdvantages.map((advantage, index) => (
                                    <li key={index}>{advantage}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="competitor-advantages">
                                <h5>Competitor Advantages</h5>
                                <ul>
                                  {selectedNegotiation.competitorAnalysis.competitorAdvantages.map((advantage, index) => (
                                    <li key={index}>{advantage}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedNegotiation.finalOffer && (
                          <div className="final-offer">
                            <h4>Final Offer Details</h4>
                            <div className="offer-details">
                              <div className="detail-item">
                                <label>Premium:</label>
                                <span>{formatCurrency(selectedNegotiation.finalOffer.premium)}</span>
                              </div>
                              <div className="detail-item">
                                <label>Discount:</label>
                                <span>{selectedNegotiation.finalOffer.discount}</span>
                              </div>
                              {selectedNegotiation.finalOffer.specialTerms && (
                                <div className="special-terms">
                                  <label>Special Terms:</label>
                                  <ul>
                                    {selectedNegotiation.finalOffer.specialTerms.map((term, index) => (
                                      <li key={index}>{term}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabPanel>

                    <TabPanel header={t("renewal.communications")}>
                      <div className="communications-content">
                        <div className="communications-list">
                          {selectedNegotiation.timeline
                            .filter(item => item.type === 'Communication' || item.method)
                            .map((comm, index) => (
                              <div key={index} className="communication-item">
                                <div className="comm-header">
                                  <div className="comm-type">
                                    <i className="pi pi-comments"></i>
                                    <span>{comm.method}</span>
                                  </div>
                                  <span className="comm-date">
                                    {formatAppDate(comm.date)}
                                  </span>
                                </div>
                                <div className="comm-content">
                                  {comm.description}
                                </div>
                                {comm.outcome && (
                                  <div className="comm-outcome">
                                    <strong>Outcome:</strong> {comm.outcome}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    </TabPanel>
                  </TabView>
                ) : (
                  <div className="no-selection">
                    <i className="pi pi-comments"></i>
                    <h3>Select a negotiation to view details</h3>
                    <p>{t("renewal.chooseNegotiation")}</p>
                  </div>
                )}
              </SplitterPanel>
            </Splitter>
          </Card>
        </div>

        {/* Add Update Dialog */}
        <Dialog
          header={t("renewal.addNegotiationUpdate")}
          visible={updateVisible}
          onHide={() => setUpdateVisible(false)}
          style={{ width: '600px' }}
          footer={updateDialogFooter}
        >
          <div className="update-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Update Type *</label>
                <Dropdown
                  value={newUpdate.type}
                  onChange={(e) => setNewUpdate({...newUpdate, type: e.value})}
                  options={updateTypeOptions}
                />
                <FieldError error={updateErrors.type} />
              </div>

              <div className="form-field">
                <label>Communication Method *</label>
                <Dropdown
                  value={newUpdate.method}
                  onChange={(e) => setNewUpdate({...newUpdate, method: e.value})}
                  options={communicationMethodOptions}
                />
                <FieldError error={updateErrors.method} />
              </div>
            </div>

            <div className="form-field">
              <label>Description *</label>
              <InputTextarea
                value={newUpdate.description}
                onChange={(e) => setNewUpdate({...newUpdate, description: e.target.value})}
                rows={3}
                placeholder="Describe what happened during this interaction"
              />
              <FieldError error={updateErrors.description} />
            </div>

            <div className="form-field">
              <label>Outcome</label>
              <InputText
                value={newUpdate.outcome}
                onChange={(e) => setNewUpdate({...newUpdate, outcome: e.target.value})}
                placeholder="What was the result of this interaction?"
              />
            </div>

            <div className="form-field">
              <label>Next Action</label>
              <InputText
                value={newUpdate.nextAction}
                onChange={(e) => setNewUpdate({...newUpdate, nextAction: e.target.value})}
                placeholder="What needs to be done next?"
              />
            </div>

            <div className="form-field">
              <label>Follow-up Date</label>
              <Calendar
                value={newUpdate.followUpDate}
                onChange={(e) => setNewUpdate({...newUpdate, followUpDate: e.value})}
                dateFormat={calendarDateFormat()}
              />
            </div>
          </div>
        </Dialog>

        {/* Approval Request Dialog */}
        <Dialog
          header={t("renewal.requestSpecialTermsApproval")}
          visible={approvalVisible}
          onHide={() => setApprovalVisible(false)}
          style={{ width: '700px' }}
          footer={approvalDialogFooter}
        >
          {selectedNegotiation && (
            <div className="approval-form">
              <div className="current-terms">
                <h4>Current Terms</h4>
                <div className="terms-grid">
                  <div className="term-item">
                    <label>Current Premium:</label>
                    <span>{formatCurrency(selectedNegotiation.currentPremium)}</span>
                  </div>
                  <div className="term-item">
                    <label>Quoted Premium:</label>
                    <span>{formatCurrency(selectedNegotiation.quotedPremium)}</span>
                  </div>
                </div>
              </div>

              <div className="requested-terms">
                <h4>Requested Terms</h4>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Requested Premium</label>
                    <InputNumber
                      value={approvalRequest.requestedPremium}
                      onValueChange={(e) => {
                        const newPremium = e.value;
                        const discount = selectedNegotiation.quotedPremium > 0
                          ? ((selectedNegotiation.quotedPremium - newPremium) / selectedNegotiation.quotedPremium) * 100
                          : 0;
                        setApprovalRequest({
                          ...approvalRequest,
                          requestedPremium: newPremium,
                          discountPercent: Math.round(discount * 10) / 10
                        });
                      }}
                      mode="currency"
                      currency={currencyCode}
                      locale={locale}
                    />
                  </div>

                  <div className="form-field">
                    <label>Discount Percentage</label>
                    <InputNumber
                      value={approvalRequest.discountPercent}
                      onValueChange={(e) => {
                        const discount = e.value;
                        const newPremium = selectedNegotiation.quotedPremium * (1 - discount / 100);
                        setApprovalRequest({
                          ...approvalRequest,
                          discountPercent: discount,
                          requestedPremium: Math.round(newPremium)
                        });
                      }}
                      suffix="%"
                      min={0}
                      max={30}
                    />
                  </div>

                  <div className="form-field">
                    <label>Urgency Level</label>
                    <Dropdown
                      value={approvalRequest.urgency}
                      onChange={(e) => setApprovalRequest({...approvalRequest, urgency: e.value})}
                      options={urgencyOptions}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Special Terms</label>
                  <div className="special-terms-selection">
                    {specialTermsOptions.map(term => (
                      <div key={term} className="term-checkbox">
                        <input
                          type="checkbox"
                          id={term}
                          checked={approvalRequest.specialTerms.includes(term)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setApprovalRequest({
                                ...approvalRequest,
                                specialTerms: [...approvalRequest.specialTerms, term]
                              });
                            } else {
                              setApprovalRequest({
                                ...approvalRequest,
                                specialTerms: approvalRequest.specialTerms.filter(t => t !== term)
                              });
                            }
                          }}
                        />
                        <label htmlFor={term}>{term}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-field">
                  <label>Justification</label>
                  <InputTextarea
                    value={approvalRequest.justification}
                    onChange={(e) => setApprovalRequest({...approvalRequest, justification: e.target.value})}
                    rows={4}
                    placeholder="Provide business justification for the special terms"
                  />
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Send Communication Dialog */}
        <Dialog
          header={t("renewal.sendCommunication")}
          visible={communicationVisible}
          onHide={() => setCommunicationVisible(false)}
          style={{ width: '600px' }}
          footer={communicationDialogFooter}
        >
          <div className="communication-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Communication Method</label>
                <Dropdown
                  value={newCommunication.method}
                  onChange={(e) => setNewCommunication({...newCommunication, method: e.value})}
                  options={communicationMethodOptions}
                />
              </div>

              <div className="form-field">
                <label>Scheduled Date</label>
                <Calendar
                  value={newCommunication.scheduledDate}
                  onChange={(e) => setNewCommunication({...newCommunication, scheduledDate: e.value})}
                  showTime
                  dateFormat={calendarDateFormat()}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Subject</label>
              <InputText
                value={newCommunication.subject}
                onChange={(e) => setNewCommunication({...newCommunication, subject: e.target.value})}
                placeholder="Communication subject/title"
              />
            </div>

            <div className="form-field">
              <label>Message</label>
              <InputTextarea
                value={newCommunication.message}
                onChange={(e) => setNewCommunication({...newCommunication, message: e.target.value})}
                rows={5}
                placeholder="Enter your message"
              />
            </div>

            <div className="form-field">
              <label>Attachments</label>
              <FileUpload
                mode="basic"
                name="attachments"
                accept=".pdf,.doc,.docx,.xlsx"
                maxFileSize={10000000}
                chooseLabel="Choose Files"
                className="attachment-upload"
              />
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default NegotiationWorkspace;