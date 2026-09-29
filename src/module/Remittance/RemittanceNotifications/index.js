import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Badge } from "primereact/badge";
import { Avatar } from "primereact/avatar";
import { Tooltip } from "primereact/tooltip";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const RemittanceNotifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDateRange, setFilterDateRange] = useState(null);

  const inboxNotifications = [
    {
      id: 1,
      type: "Payment Reminder",
      subject: "Payment Due - Policy POL123456789",
      sender: "Remittance System",
      recipientType: "Client",
      sentDate: "2025-09-26 10:30",
      status: "Delivered",
      priority: "High",
      channel: "Email",
      content: "Dear Client, your payment for policy POL123456789 is due on 2025-09-30.",
      isRead: false,
      hasAttachment: true
    },
    {
      id: 2,
      type: "Settlement Confirmation",
      subject: "Settlement Processed - REF20250926001",
      sender: "Finance Team",
      recipientType: "Agent",
      sentDate: "2025-09-26 09:15",
      status: "Delivered",
      priority: "Medium",
      channel: "Email + SMS",
      content: "Your settlement for reference REF20250926001 has been processed successfully.",
      isRead: true,
      hasAttachment: false
    },
    {
      id: 3,
      type: "Approval Required",
      subject: "Adjustment Approval Required - ADJ20250926002",
      sender: "Workflow System",
      recipientType: "Manager",
      sentDate: "2025-09-26 08:45",
      status: "Pending",
      priority: "High",
      channel: "Email",
      content: "An adjustment request requires your approval. Amount: ₱5,000",
      isRead: false,
      hasAttachment: true
    },
    {
      id: 4,
      type: "System Alert",
      subject: "Exception in Processing - EXC20250926001",
      sender: "System",
      recipientType: "Operations",
      sentDate: "2025-09-26 07:20",
      status: "Failed",
      priority: "Critical",
      channel: "System Alert",
      content: "Exception occurred during bulk processing. Manual intervention required.",
      isRead: false,
      hasAttachment: false
    },
    {
      id: 5,
      type: "Commission Statement",
      subject: "Commission Statement Ready - September 2025",
      sender: "Statement Generator",
      recipientType: "Agent",
      sentDate: "2025-09-25 18:00",
      status: "Delivered",
      priority: "Low",
      channel: "Email",
      content: "Your commission statement for September 2025 is ready for download.",
      isRead: true,
      hasAttachment: true
    }
  ];

  const sentNotifications = [
    {
      id: 101,
      type: "Payment Reminder",
      subject: "Payment Overdue - Policy POL987654321",
      recipients: "client@example.com",
      sentDate: "2025-09-25 14:30",
      status: "Delivered",
      channel: "Email",
      deliveryRate: "100%",
      openRate: "85%"
    },
    {
      id: 102,
      type: "Settlement Alert",
      subject: "Settlement Delayed - REF20250925001",
      recipients: "agent@broker.com",
      sentDate: "2025-09-25 12:15",
      status: "Bounced",
      channel: "Email",
      deliveryRate: "0%",
      openRate: "0%"
    },
    {
      id: 103,
      type: "Bulk SMS Campaign",
      subject: "Payment Reminder Campaign",
      recipients: "125 Recipients",
      sentDate: "2025-09-25 10:00",
      status: "Delivered",
      channel: "SMS",
      deliveryRate: "95%",
      openRate: "N/A"
    }
  ];

  const templates = [
    {
      id: 1,
      name: "Payment Due Reminder",
      type: "Payment Reminder",
      channel: "Email",
      lastUsed: "2025-09-26",
      usageCount: 156,
      status: "Active"
    },
    {
      id: 2,
      name: "Settlement Confirmation",
      type: "Settlement",
      channel: "Email + SMS",
      lastUsed: "2025-09-26",
      usageCount: 89,
      status: "Active"
    },
    {
      id: 3,
      name: "Approval Request",
      type: "Workflow",
      channel: "Email",
      lastUsed: "2025-09-25",
      usageCount: 43,
      status: "Draft"
    }
  ];

  const typeOptions = [
    { label: "All", value: "All" },
    { label: "Payment Reminder", value: "Payment Reminder" },
    { label: "Settlement Confirmation", value: "Settlement Confirmation" },
    { label: "Approval Required", value: "Approval Required" },
    { label: "System Alert", value: "System Alert" },
    { label: "Commission Statement", value: "Commission Statement" }
  ];

  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Delivered", value: "Delivered" },
    { label: "Pending", value: "Pending" },
    { label: "Failed", value: "Failed" },
    { label: "Bounced", value: "Bounced" }
  ];

  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Delivered': return 'success';
        case 'Pending': return 'warning';
        case 'Failed': return 'danger';
        case 'Bounced': return 'danger';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const subjectBodyTemplate = (rowData) => {
    return (
      <div className="subject-cell">
        <div className="subject-text" style={{ fontWeight: rowData.isRead ? 'normal' : 'bold' }}>
          {rowData.subject}
          {rowData.hasAttachment && (
            <i className="pi pi-paperclip ml-2" style={{ color: '#6c757d' }} />
          )}
        </div>
        {!rowData.isRead && <Badge value="NEW" severity="info" className="ml-2" />}
      </div>
    );
  };

  const senderBodyTemplate = (rowData) => {
    return (
      <div className="sender-cell">
        <Avatar
          label={rowData.sender.charAt(0)}
          className="mr-2"
          size="small"
          style={{ backgroundColor: '#007bff', color: 'white' }}
        />
        <span>{rowData.sender}</span>
      </div>
    );
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View"
          onClick={() => {
            setSelectedNotification(rowData);
            setShowDetailDialog(true);
          }}
        />
        <Button
          icon="pi pi-reply"
          className="p-button-rounded p-button-text"
          tooltip="Reply"
          disabled={rowData.type === 'System Alert'}
        />
        <Button
          icon="pi pi-forward"
          className="p-button-rounded p-button-text"
          tooltip="Forward"
        />
        <Button
          icon="pi pi-trash"
          className="p-button-rounded p-button-danger p-button-text"
          tooltip="Delete"
        />
      </div>
    );
  };

  const templateActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="Preview"
        />
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip="Edit"
        />
        <Button
          icon="pi pi-copy"
          className="p-button-rounded p-button-text"
          tooltip="Duplicate"
        />
        <Button
          icon="pi pi-send"
          className="p-button-rounded p-button-success p-button-text"
          tooltip="Use Template"
        />
      </div>
    );
  };

  const handleBackToMaster = () => {
    navigate("/master/finance/remittance");
  };

  const handleMarkAsRead = () => {
    console.log("Marking selected notifications as read");
  };

  const handleBulkDelete = () => {
    console.log("Deleting selected notifications");
  };

  const detailDialogFooter = (
    <div>
      <Button
        label="Reply"
        icon="pi pi-reply"
        className="p-button-primary mr-2"
        disabled={selectedNotification?.type === 'System Alert'}
      />
      <Button
        label="Forward"
        icon="pi pi-forward"
        className="p-button-secondary mr-2"
      />
      <Button
        label="Close"
        icon="pi pi-times"
        onClick={() => setShowDetailDialog(false)}
        className="p-button-text"
      />
    </div>
  );

  return (
    <div className="remittance-notifications">
      <div className="header-section">
        <h2>{t("remittance.remittanceNotifications")}</h2>
        <Button
          label="Back to Master"
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={handleBackToMaster}
        />
      </div>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-inbox" />
            </div>
            <div className="card-details">
              <div className="card-value">15</div>
              <div className="card-label">Unread Messages</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon green">
              <i className="pi pi-send" />
            </div>
            <div className="card-details">
              <div className="card-value">248</div>
              <div className="card-label">Sent Today</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon orange">
              <i className="pi pi-exclamation-triangle" />
            </div>
            <div className="card-details">
              <div className="card-value">3</div>
              <div className="card-label">Failed Deliveries</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon purple">
              <i className="pi pi-file" />
            </div>
            <div className="card-details">
              <div className="card-value">12</div>
              <div className="card-label">Active Templates</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Button
              label="Compose"
              icon="pi pi-plus"
              className="p-button-primary mr-2"
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              className="p-button-secondary"
            />
          </div>
          <div className="filter-section">
            <Dropdown
              value={filterType}
              options={typeOptions}
              onChange={(e) => setFilterType(e.value)}
              placeholder="Type"
              className="mr-2"
            />
            <Dropdown
              value={filterStatus}
              options={statusOptions}
              onChange={(e) => setFilterStatus(e.value)}
              placeholder="Status"
              className="mr-2"
            />
            <Calendar
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.value)}
              selectionMode="range"
              placeholder="Date Range"
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Inbox <Badge value="15" severity="danger" className="ml-2" /></span>}>
            <DataTable
              value={inboxNotifications}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              stripedRows
              className="notification-table"
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="subject" header="Subject" body={subjectBodyTemplate} style={{ width: '35%' }} />
              <Column field="sender" header="From" body={senderBodyTemplate} style={{ width: '15%' }} />
              <Column field="type" header="Type" style={{ width: '12%' }} />
              <Column field="channel" header="Channel" style={{ width: '10%' }} />
              <Column field="priority" header="Priority" body={priorityBodyTemplate} style={{ width: '8%' }} />
              <Column field="status" header="Status" body={statusBodyTemplate} style={{ width: '8%' }} />
              <Column field="sentDate" header="Date" style={{ width: '12%' }} />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '150px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button
                  label={`Mark as Read (${selectedRows.length})`}
                  icon="pi pi-check"
                  className="p-button-success mr-2"
                  onClick={handleMarkAsRead}
                />
                <Button
                  label={`Delete (${selectedRows.length})`}
                  icon="pi pi-trash"
                  className="p-button-danger mr-2"
                  onClick={handleBulkDelete}
                />
                <Button
                  label="Archive"
                  icon="pi pi-folder"
                  className="p-button-secondary"
                />
              </div>
            )}
          </TabPanel>

          <TabPanel header="Sent">
            <DataTable value={sentNotifications} stripedRows>
              <Column field="subject" header="Subject" />
              <Column field="recipients" header="Recipients" />
              <Column field="type" header="Type" />
              <Column field="channel" header="Channel" />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="deliveryRate" header="Delivery Rate" />
              <Column field="openRate" header="Open Rate" />
              <Column field="sentDate" header="Sent Date" />
              <Column header="Actions" body={actionsBodyTemplate} />
            </DataTable>
          </TabPanel>

          <TabPanel header="Templates">
            <div className="templates-section">
              <div className="toolbar mb-3">
                <Button
                  label="New Template"
                  icon="pi pi-plus"
                  className="p-button-primary"
                />
              </div>

              <DataTable value={templates} stripedRows>
                <Column field="name" header="Template Name" />
                <Column field="type" header="Type" />
                <Column field="channel" header="Channel" />
                <Column field="lastUsed" header="Last Used" />
                <Column field="usageCount" header="Usage Count" />
                <Column field="status" header="Status" body={statusBodyTemplate} />
                <Column header="Actions" body={templateActionsTemplate} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Analytics">
            <div className="analytics-section">
              <div className="analytics-grid">
                <Card className="analytics-card">
                  <h4>Delivery Performance</h4>
                  <div className="metric-row">
                    <span>Today's Delivery Rate:</span>
                    <strong>97.5%</strong>
                  </div>
                  <div className="metric-row">
                    <span>This Week:</span>
                    <strong>96.8%</strong>
                  </div>
                  <div className="metric-row">
                    <span>This Month:</span>
                    <strong>98.1%</strong>
                  </div>
                </Card>

                <Card className="analytics-card">
                  <h4>Engagement Metrics</h4>
                  <div className="metric-row">
                    <span>Average Open Rate:</span>
                    <strong>78%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Click Through Rate:</span>
                    <strong>12.5%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Response Rate:</span>
                    <strong>8.3%</strong>
                  </div>
                </Card>

                <Card className="analytics-card">
                  <h4>Channel Performance</h4>
                  <div className="metric-row">
                    <span>Email:</span>
                    <strong>85% Success</strong>
                  </div>
                  <div className="metric-row">
                    <span>SMS:</span>
                    <strong>96% Success</strong>
                  </div>
                  <div className="metric-row">
                    <span>System Alert:</span>
                    <strong>100% Success</strong>
                  </div>
                </Card>

                <Card className="analytics-card">
                  <h4>Top Templates</h4>
                  <div className="metric-row">
                    <span>Payment Reminder:</span>
                    <strong>156 uses</strong>
                  </div>
                  <div className="metric-row">
                    <span>Settlement Confirmation:</span>
                    <strong>89 uses</strong>
                  </div>
                  <div className="metric-row">
                    <span>Approval Request:</span>
                    <strong>43 uses</strong>
                  </div>
                </Card>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header="Notification Details"
        visible={showDetailDialog}
        style={{ width: '70vw' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
      >
        {selectedNotification && (
          <div className="notification-details">
            <div className="detail-header">
              <h3>{selectedNotification.subject}</h3>
              <div className="detail-meta">
                <Tag value={selectedNotification.type} className="mr-2" />
                <Tag value={selectedNotification.priority} severity={priorityBodyTemplate(selectedNotification).props.severity} className="mr-2" />
                <Tag value={selectedNotification.status} severity={statusBodyTemplate(selectedNotification).props.severity} />
              </div>
            </div>

            <div className="detail-info">
              <div className="info-row">
                <label>From:</label>
                <span>{selectedNotification.sender}</span>
              </div>
              <div className="info-row">
                <label>To:</label>
                <span>{selectedNotification.recipientType}</span>
              </div>
              <div className="info-row">
                <label>Channel:</label>
                <span>{selectedNotification.channel}</span>
              </div>
              <div className="info-row">
                <label>Sent:</label>
                <span>{selectedNotification.sentDate}</span>
              </div>
            </div>

            <div className="detail-content">
              <h4>Message Content</h4>
              <div className="content-body">
                {selectedNotification.content}
              </div>
            </div>

            {selectedNotification.hasAttachment && (
              <div className="detail-attachments">
                <h4>Attachments</h4>
                <div className="attachment-list">
                  <div className="attachment-item">
                    <i className="pi pi-file-pdf mr-2" />
                    <span>payment_details.pdf</span>
                    <Button icon="pi pi-download" className="p-button-text p-button-sm ml-2" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Tooltip target=".p-button" />
    </div>
  );
};

export default RemittanceNotifications;