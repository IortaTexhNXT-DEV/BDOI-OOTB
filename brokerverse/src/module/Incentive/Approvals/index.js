import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { TabView, TabPanel } from "primereact/tabview";
import { InputTextarea } from "primereact/inputtextarea";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import InputField from "../../../components/InputField";
import incentiveService from "../../../services/incentiveService";
import { isoDate, loadSettings, showError, showSuccess } from "../../Remittance/shared";
import "./index.scss";

import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { promptText } from "../../../utility/dialogs";
const PRIORITY_LABEL = { Urgent: "High", High: "High", Normal: "Medium", Low: "Low" };

const Approvals = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);

  // State management
  const [approvals, setApprovals] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Pending Approval");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [priorityRules, setPriorityRules] = useState([]);

  // Detail view state
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");

  // Dashboard metrics
  const [dashboardData, setDashboardData] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    approvedToday: 0,
    rejectedToday: 0
  });

  // Options
  const statusOptions = [
    { label: "Pending Approval", value: "Pending Approval" },
    { label: "Approved", value: "Approved" },
    { label: "Rejected", value: "Rejected" },
    { label: "Paid", value: "Paid" },
    { label: "All", value: "All" }
  ];

  const periodOptions = [...new Set(approvals.map((a) => a.period))].map((p) => ({ label: p, value: p }));

  // Breadcrumb items
  const items = [
    { label: t("incentive.incentive") },
    { label: t("incentive.approvals"), url: "/incentive/approvals" }
  ];

  const home = { label: t("sidebar.Accounts") };

  // Initialize data
  useEffect(() => {
    loadApprovals();
    loadSettings()
      .then((s) => setPriorityRules([...(s["remittance.priority_thresholds"] || [])].sort((a, b) => b.min - a.min)))
      .catch((error) => showError(toast, error));
  }, []);

  const priorityOf = (amount) => PRIORITY_LABEL[priorityRules.find((r) => Math.abs(amount) >= r.min)?.priority] || "Low";

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const board = await incentiveService.approvals();
      setApprovals(board.approvals || []);
      setDashboardData({
        pendingCount: board.summary?.pending || 0,
        pendingAmount: board.summary?.pendingAmount || 0,
        approvedToday: board.summary?.approvedToday || 0,
        rejectedToday: board.summary?.rejectedToday || 0
      });
    } catch (error) {
      showError(toast, error, 'Failed to load approval data');
    } finally {
      setLoading(false);
    }
  };

  const approvalRows = approvals.map((a) => ({ ...a, priority: priorityOf(Number(a.totalAmount || 0)), rejectionComment: a.rejectionReason }));

  // Filter data
  const filteredApprovals = approvalRows.filter((approval) => {
    const matchesSearch =
      approval.batchId.toLowerCase().includes(search.toLowerCase()) ||
      approval.period.toLowerCase().includes(search.toLowerCase()) ||
      String(approval.submittedBy || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === "All" || approval.status === selectedStatus;
    const matchesPeriod = !selectedPeriod || approval.period === selectedPeriod;

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  // Handle view details
  const handleViewDetails = async (approval) => {
    setSelectedApproval(approval);
    setApprovalComment("");
    setDetailsVisible(true);
  };

  const runAction = async (action, summary, detail) => {
    setLoading(true);
    try {
      await action();
      setDetailsVisible(false);
      showSuccess(toast, detail, summary);
      await loadApprovals();
    } catch (error) {
      showError(toast, error);
    } finally {
      setLoading(false);
    }
  };

  // Handle approve (the backend refuses approvals by the batch creator or submitter)
  const handleApprove = (approval, comment = "") => runAction(
    () => incentiveService.approveCalculation(approval.batchId, comment || undefined),
    "Approved",
    `Calculation batch ${approval.batchId} has been approved`
  );

  // Handle reject
  const handleReject = async (approval, comment = "") => {
    if (!comment.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Comment Required",
        detail: "Please provide a reason for rejection",
        life: 3000
      });
      return;
    }
    runAction(() => incentiveService.rejectCalculation(approval.batchId, comment), "Rejected", `Calculation batch ${approval.batchId} has been rejected`);
  };

  const handlePay = async (approval) => {
    const paymentReference = await promptText(`Payment reference for ${approval.batchId}`, "");
    if (paymentReference === null) return;
    runAction(
      () => incentiveService.payCalculation(approval.batchId, { paymentDate: isoDate(new Date()), paymentReference }),
      "Paid",
      `Calculation batch ${approval.batchId} marked as paid`
    );
  };

  // Bulk approval
  const handleBulkApprove = () => {
    const pendingApprovals = filteredApprovals.filter(a => a.status === "Pending Approval");

    confirmDialog({
      message: `Approve ${pendingApprovals.length} pending calculation batches?`,
      header: "Bulk Approval",
      icon: "pi pi-check",
      accept: () => runAction(
        () => Promise.all(pendingApprovals.map((a) => incentiveService.approveCalculation(a.batchId))),
        "Bulk Approval Complete",
        `${pendingApprovals.length} calculation batches approved`
      )
    });
  };

  // Template functions
  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "Approved": return "success";
        case "Pending Approval": return "warning";
        case "Paid": return "info";
        case "Rejected": return "danger";
        default: return null;
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case "High": return "danger";
        case "Medium": return "warning";
        case "Low": return "success";
        default: return null;
      }
    };

    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const dateBodyTemplate = (rowData) => {
    return formatAppDate(rowData.submittedDate);
  };

  const amountBodyTemplate = (rowData) => {
    return formatCurrency(rowData.totalAmount);
  };

  const daysWaitingBodyTemplate = (rowData) => {
    const days = rowData.daysWaiting;
    const getSeverity = () => {
      if (days > 7) return "danger";
      if (days > 3) return "warning";
      return "success";
    };

    return <Tag value={`${days} days`} severity={getSeverity()} />;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon={<SvgEyeIcon />}
          className="view-details-button"
          onClick={() => handleViewDetails(rowData)}
          tooltip="View Details" aria-label="View Details"
        />
        {rowData.status === "Pending Approval" && (
          <>
            <Button
              icon="pi pi-check"
              className="approve-button"
              onClick={() => handleApprove(rowData)}
              tooltip="Quick Approve" aria-label="Quick Approve"
            />
            <Button
              icon="pi pi-times"
              className="reject-button"
              onClick={() => {
                setSelectedApproval(rowData);
                setApprovalComment("");
                setDetailsVisible(true);
              }}
              tooltip="Review & Reject" aria-label="Review & Reject"
            />
          </>
        )}
        {rowData.status === "Approved" && (
          <Button
            icon="pi pi-wallet"
            className="approve-button"
            onClick={() => handlePay(rowData)}
            tooltip="Mark as Paid" aria-label="Mark as Paid"
          />
        )}
      </div>
    );
  };

  // Dialog footer
  const detailsFooter = (
    <div className="dialog-footer">
      <Button
        label="Close"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setDetailsVisible(false)}
      />
      {selectedApproval?.status === "Pending Approval" && (
        <>
          <Button
            label="Reject"
            icon="pi pi-times"
            className="p-button-danger"
            onClick={() => handleReject(selectedApproval, approvalComment)}
            loading={loading}
          />
          <Button
            label="Approve"
            icon="pi pi-check"
            onClick={() => handleApprove(selectedApproval, approvalComment)}
            loading={loading}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="container__approvals">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">{t("incentive.incentiveApprovals")}</div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      {/* Dashboard Cards */}
      <div className="dashboard-section">
        <div className="dashboard-cards">
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-clock card-icon orange"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.pendingCount}</span>
                <span className="card-label">Pending Approval</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-wallet card-icon red"></i>
              <div className="card-info">
                <span className="card-value">
                  {formatCurrency(dashboardData.pendingAmount)}
                </span>
                <span className="card-label">Pending Amount</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-check card-icon green"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.approvedToday}</span>
                <span className="card-label">Approved Today</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-times card-icon gray"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.rejectedToday}</span>
                <span className="card-label">Rejected Today</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="content-container">
        <Card>
          {/* Filter Section */}
          <div className="filter-section">
            <div className="filter-row">
              <div className="filter-field">
                <label>Search</label>
                <InputField
                  placeholder="Search by batch ID, period, or submitter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<SvgSearchIcon />}
                />
              </div>
              <div className="filter-field">
                <label>Status</label>
                <Dropdown
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={(e) => setSelectedStatus(e.value)}
                  placeholder="Select status"
                />
              </div>
              <div className="filter-field">
                <label>Period</label>
                <Dropdown
                  value={selectedPeriod}
                  options={[{ label: "All Periods", value: null }, ...periodOptions]}
                  onChange={(e) => setSelectedPeriod(e.value)}
                  placeholder="Select period"
                />
              </div>
              <div className="filter-actions">
                <Button
                  label="Bulk Approve"
                  icon="pi pi-check"
                  className="bulk-approve-button"
                  onClick={handleBulkApprove}
                  disabled={filteredApprovals.filter(a => a.status === "Pending Approval").length === 0}
                />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            value={filteredApprovals}
            className="approvals-table"
            stripedRows
            paginator
            rows={20}
            loading={loading}
            emptyMessage="No approvals found"
          >
            <Column field="batchId" header="Batch ID" style={{ width: "12%" }} />
            <Column field="period" header="Period" style={{ width: "12%" }} />
            <Column
              body={dateBodyTemplate}
              header="Submitted Date"
              style={{ width: "10%" }}
            />
            <Column field="submittedBy" header="Submitted By" style={{ width: "12%" }} />
            <Column
              body={amountBodyTemplate}
              header="Total Amount"
              style={{ width: "15%", textAlign: "right" }}
            />
            <Column
              field="agentCount"
              header="Sales person"
              style={{ width: "8%", textAlign: "center" }}
            />
            <Column
              body={priorityBodyTemplate}
              header="Priority"
              style={{ width: "8%" }}
            />
            <Column
              body={daysWaitingBodyTemplate}
              header="Waiting"
              style={{ width: "8%" }}
            />
            <Column
              body={statusBodyTemplate}
              header="Status"
              style={{ width: "10%" }}
            />
            <Column
              body={actionBodyTemplate}
              header="Actions"
              style={{ width: "12%" }}
            />
          </DataTable>
        </Card>
      </div>

      {/* Approval Details Dialog */}
      <Dialog
        header="Approval Details"
        visible={detailsVisible}
        onHide={() => setDetailsVisible(false)}
        style={{ width: '80vw', maxWidth: '1000px' }}
        footer={detailsFooter}
        maximizable
      >
        {selectedApproval && (
          <TabView>
            <TabPanel header="Overview">
              <div className="approval-overview">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Batch ID:</label>
                    <span>{selectedApproval.batchId}</span>
                  </div>
                  <div className="detail-item">
                    <label>Period:</label>
                    <span>{selectedApproval.period}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <Tag
                      value={selectedApproval.status}
                      severity={
                        selectedApproval.status === "Approved" ? "success" :
                        selectedApproval.status === "Pending Approval" ? "warning" :
                        selectedApproval.status === "Paid" ? "info" : "danger"
                      }
                    />
                  </div>
                  <div className="detail-item">
                    <label>Priority:</label>
                    <Tag
                      value={selectedApproval.priority}
                      severity={
                        selectedApproval.priority === "High" ? "danger" :
                        selectedApproval.priority === "Medium" ? "warning" : "success"
                      }
                    />
                  </div>
                  <div className="detail-item">
                    <label>Total Amount:</label>
                    <span className="amount">
                      {formatCurrency(selectedApproval.totalAmount)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Sales persons:</label>
                    <span>{selectedApproval.agentCount}</span>
                  </div>
                  <div className="detail-item">
                    <label>Submitted By:</label>
                    <span>{selectedApproval.submittedBy}</span>
                  </div>
                  <div className="detail-item">
                    <label>Submitted Date:</label>
                    <span>{formatAppDate(selectedApproval.submittedDate, { withTime: true })}</span>
                  </div>
                  <div className="detail-item">
                    <label>Days Waiting:</label>
                    <span>{selectedApproval.daysWaiting} days</span>
                  </div>
                  <div className="detail-item">
                    <label>Programs Included:</label>
                    <span>{selectedApproval.programsIncluded.join(", ")}</span>
                  </div>
                </div>

                {/* Approval History */}
                {(selectedApproval.approvedBy || selectedApproval.rejectedBy) && (
                  <div className="approval-history">
                    <h4>Approval History</h4>
                    {selectedApproval.approvedBy && (
                      <div className="history-item approved">
                        <i className="pi pi-check"></i>
                        <div className="history-content">
                          <div className="history-action">Approved by {selectedApproval.approvedBy}</div>
                          <div className="history-date">{formatAppDate(selectedApproval.approvalDate, { withTime: true })}</div>
                          {selectedApproval.approvalComment && (
                            <div className="history-comment">{selectedApproval.approvalComment}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedApproval.rejectedBy && (
                      <div className="history-item rejected">
                        <i className="pi pi-times"></i>
                        <div className="history-content">
                          <div className="history-action">Rejected by {selectedApproval.rejectedBy}</div>
                          <div className="history-date">{formatAppDate(selectedApproval.rejectionDate, { withTime: true })}</div>
                          {selectedApproval.rejectionComment && (
                            <div className="history-comment">{selectedApproval.rejectionComment}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel header={`Agent Details (${selectedApproval.details?.length || 0})`}>
              {selectedApproval.details && selectedApproval.details.length > 0 ? (
                <DataTable value={selectedApproval.details} className="detail-table">
                  <Column field="agentName" header="Sales person" />
                  <Column field="program" header="Program" />
                  <Column field="achievementPercent" header="Achievement %" body={(data) => `${data.achievementPercent}%`} />
                  <Column field="baseIncentive" header="Base Incentive" body={(data) => formatCurrency(data.baseIncentive)} />
                  <Column field="adjustments" header="Adjustments" body={(data) => formatCurrency(data.adjustments)} />
                  <Column field="finalAmount" header="Final Amount" body={(data) => formatCurrency(data.finalAmount)} />
                  <Column field="status" header="Status" body={(data) =>
                    <Tag value={data.status} severity={data.status === "Calculated" ? "success" : "warning"} />
                  } />
                </DataTable>
              ) : (
                <div className="empty-details">
                  <p>No detailed calculation data available for review.</p>
                </div>
              )}
            </TabPanel>

            <TabPanel header="Comments">
              <div className="comments-section">
                <div className="form-field">
                  <label>Approval/Rejection Comment:</label>
                  <InputTextarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Enter your comment or reason..."
                    rows={5}
                    disabled={selectedApproval.status !== "Pending Approval"}
                  />
                </div>
                <div className="comment-note">
                  <i className="pi pi-info-circle"></i>
                  <span>Comments are required for rejections and optional for approvals.</span>
                </div>
              </div>
            </TabPanel>
          </TabView>
        )}
      </Dialog>
    </div>
  );
};

export default Approvals;