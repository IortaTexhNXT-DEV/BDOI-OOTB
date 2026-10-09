import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Badge } from "primereact/badge";
import { Avatar } from "primereact/avatar";
import { Tooltip } from "primereact/tooltip";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import remittanceService, { apiRequest } from "../../../services/remittanceService";
import { calendarDateFormat, dateBody, isoDate, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";
import { confirmAction } from "../../../utility/dialogs";

const TEMPLATE_ROUTE = "/master/finance/remittance/notificationmaster";
const emptyMessage = { type: "", subject: "", content: "", recipients: "", recipientType: "Client", channel: "Email", priority: "Normal", templateCode: null };
const allOption = (values) => [{ label: "All", value: "All" }, ...values.map((v) => ({ label: v, value: v }))];
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "-");

const RemittanceNotifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [inboxNotifications, setInboxNotifications] = useState([]);
  const [sentNotifications, setSentNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [message, setMessage] = useState(emptyMessage);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [inbox, sent, tpl] = await Promise.all([
        remittanceService.inbox(),
        remittanceService.sentNotifications(),
        remittanceService.notificationTemplates()
      ]);
      setInboxNotifications(inbox || []);
      setSentNotifications((sent || []).map((n) => ({ ...n, sentDate: n.sentDate || n.createdDate })));
      setTemplates(tpl || []);
      setSelectedRows([]);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const today = isoDate(new Date());
  const [fromDate, toDate] = filterDateRange || [];
  const applyFilters = (rows) => rows.filter((r) => {
    const day = String(r.sentDate || "").slice(0, 10);
    return (filterType === "All" || r.type === filterType)
      && (filterStatus === "All" || r.status === filterStatus)
      && (!fromDate || day >= isoDate(fromDate)) && (!toDate || day <= isoDate(toDate));
  });
  const visibleInbox = applyFilters(inboxNotifications);
  const visibleSent = applyFilters(sentNotifications);
  const unread = inboxNotifications.filter((n) => !n.isRead).length;
  const failed = sentNotifications.filter((n) => n.status === "Failed").length;
  const templateUsage = (code) => sentNotifications.filter((n) => n.templateCode === code);
  const templateRows = templates.map((tpl) => {
    const uses = templateUsage(tpl.code);
    return { ...tpl, type: tpl.trigger, lastUsed: uses[0]?.sentDate?.slice(0, 10) || "-", usageCount: uses.length };
  });
  const channels = [...new Set(sentNotifications.map((n) => n.channel).filter(Boolean))];
  const deliveredWithin = (days) => {
    const since = isoDate(new Date(Date.now() - days * 86400000));
    const rows = sentNotifications.filter((n) => String(n.sentDate).slice(0, 10) >= since);
    return pct(rows.filter((n) => n.status !== "Failed").length, rows.length);
  };
  const topTemplates = [...templateRows].sort((a, b) => b.usageCount - a.usageCount).slice(0, 3);
  const allRows = [...inboxNotifications, ...sentNotifications];

  const typeOptions = allOption([...new Set(allRows.map((n) => n.type).filter(Boolean))]);

  const statusOptions = allOption([...new Set(allRows.map((n) => n.status).filter(Boolean))]);

  const openCompose = (preset = {}) => {
    setMessage({ ...emptyMessage, ...preset });
    setShowCompose(true);
  };

  const handleSend = async () => {
    try {
      const sent = await remittanceService.sendNotification({ ...message, recipients: message.recipients.split(/[,;]/).map((r) => r.trim()).filter(Boolean) });
      showSuccess(toast, `${sent.referenceNo} sent`);
      setShowCompose(false);
      loadNotifications();
    } catch (e) {
      showError(toast, e);
    }
  };

  const reply = (n) => openCompose({ type: n.type, subject: `Re: ${n.subject}`, recipients: n.recipients || "", channel: n.channel === "System" ? "Email" : n.channel });
  const forward = (n) => openCompose({ type: n.type, subject: `Fwd: ${n.subject}`, content: n.content || "" });
  const applyTemplate = (tpl) => openCompose({ type: tpl.trigger || tpl.name, subject: tpl.subject || tpl.name, content: tpl.body || tpl.message || "", channel: tpl.channel || "Email", templateCode: tpl.code });

  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case 'Critical': return 'danger';
        case 'Urgent': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Normal': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const statusBodyTemplate = (rowData) => {
    return <Tag value={rowData.status} severity={statusSeverity(rowData.status)} />;
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
          label={(rowData.sender || "?").charAt(0)}
          className="mr-2"
          size="small"
          style={{ backgroundColor: 'var(--bv-primary-050)', color: 'var(--bv-secondary)' }}
        />
        <span>{rowData.sender}</span>
      </div>
    );
  };

  const isInbox = (row) => inboxNotifications.some((n) => n.id === row?.id);

  const markAsRead = async (rows) => {
    const ids = rows.filter(isInbox).map((r) => r.id);
    if (!ids.length) return;
    try {
      await apiRequest("PUT", "/notifications/read", { body: { notificationIds: ids } });
      showSuccess(toast, `${ids.length} notification(s) marked as read`);
      loadNotifications();
    } catch (e) {
      showError(toast, e);
    }
  };

  const deleteRows = async (rows) => {
    const ids = rows.filter(isInbox).map((r) => r.id);
    if (!ids.length || !(await confirmAction(`Delete ${ids.length} notification(s)?`, { danger: true }))) return;
    try {
      await apiRequest("DELETE", "/notifications", { body: { notificationIds: ids } });
      showSuccess(toast, `${ids.length} notification(s) deleted`);
      loadNotifications();
    } catch (e) {
      showError(toast, e);
    }
  };

  const openDetail = (rowData) => {
    setSelectedNotification(rowData);
    setShowDetailDialog(true);
    if (isInbox(rowData) && !rowData.isRead) markAsRead([rowData]);
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View"
          onClick={() => openDetail(rowData)} aria-label="View"
        />
        <Button
          icon="pi pi-reply"
          className="p-button-rounded p-button-text"
          tooltip="Reply"
          disabled={isInbox(rowData)}
          onClick={() => reply(rowData)} aria-label="Reply"
        />
        <Button
          icon="pi pi-forward"
          className="p-button-rounded p-button-text"
          tooltip="Forward"
          onClick={() => forward(rowData)} aria-label="Forward"
        />
        <Button
          icon="pi pi-trash"
          className="p-button-rounded p-button-danger p-button-text"
          tooltip="Delete"
          disabled={!isInbox(rowData)}
          onClick={() => deleteRows([rowData])} aria-label="Delete"
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
          onClick={() => openDetail({ subject: rowData.subject || rowData.name, type: rowData.trigger, channel: rowData.channel, status: rowData.status, content: rowData.body || rowData.message, sender: "Template" })} aria-label="Preview"
        />
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip="Edit"
          onClick={() => navigate(`${TEMPLATE_ROUTE}/edit`, { state: { data: rowData, mode: "edit" } })} aria-label="Edit"
        />
        <Button
          icon="pi pi-send"
          className="p-button-rounded p-button-text"
          tooltip="Use Template"
          onClick={() => applyTemplate(rowData)} aria-label="Use Template"
        />
      </div>
    );
  };

  const handleMarkAsRead = () => markAsRead(selectedRows);

  const handleBulkDelete = () => deleteRows(selectedRows);

  const setField = (field, value) => setMessage((m) => ({ ...m, [field]: value }));

  const composeFooter = (
    <div>
      <Button label="Cancel" icon="pi pi-times" className="p-button-text" onClick={() => setShowCompose(false)} />
      <Button label="Send" icon="pi pi-send" onClick={handleSend} disabled={!message.subject || !message.content || !message.recipients} />
    </div>
  );

  const detailDialogFooter = (
    <div>
      <Button
        label="Reply"
        icon="pi pi-reply"
        className="p-button-primary mr-2"
        disabled={!selectedNotification || isInbox(selectedNotification)}
        onClick={() => { setShowDetailDialog(false); reply(selectedNotification); }}
      />
      <Button
        label="Forward"
        icon="pi pi-forward"
        className="p-button-secondary mr-2"
        onClick={() => { setShowDetailDialog(false); forward(selectedNotification); }}
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
      <Toast ref={toast} />
      <div className="header-section">
        <h2>{t("remittance.remittanceNotifications")}</h2>
      </div>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-inbox" />
            </div>
            <div className="card-details">
              <div className="card-value">{unread}</div>
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
              <div className="card-value">{sentNotifications.filter((n) => String(n.sentDate).startsWith(today)).length}</div>
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
              <div className="card-value">{failed}</div>
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
              <div className="card-value">{templates.filter((tpl) => tpl.status === "Active").length}</div>
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
              onClick={() => openCompose()}
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              className="p-button-secondary"
              onClick={loadNotifications}
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
            <Calendar dateFormat={calendarDateFormat()}
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.value)}
              selectionMode="range"
              placeholder="Date Range"
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" onClick={loadNotifications} />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Inbox <Badge value={unread} severity="danger" className="ml-2" /></span>}>
            <DataTable
              value={visibleInbox}
              loading={loading}
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
              <Column field="sentDate" body={dateBody("sentDate")} header="Date" style={{ width: '12%' }} />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '150px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button
                  label={`Mark as Read (${selectedRows.length})`}
                  icon="pi pi-check"
                  className="mr-2"
                  onClick={handleMarkAsRead}
                />
                <Button
                  label={`Delete (${selectedRows.length})`}
                  icon="pi pi-trash"
                  className="p-button-danger mr-2"
                  onClick={handleBulkDelete}
                />
              </div>
            )}
          </TabPanel>

          <TabPanel header="Sent">
            <DataTable value={visibleSent} stripedRows loading={loading}>
              <Column field="subject" header="Subject" />
              <Column field="recipients" header="Recipients" />
              <Column field="type" header="Type" />
              <Column field="channel" header="Channel" />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="deliveryRate" header="Delivery Rate" />
              <Column field="openRate" header="Open Rate" />
              <Column field="sentDate" body={dateBody("sentDate")} header="Sent Date" />
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
                  onClick={() => navigate(`${TEMPLATE_ROUTE}/add`, { state: { mode: "add" } })}
                />
              </div>

              <DataTable value={templateRows} stripedRows loading={loading}>
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
                    <strong>{deliveredWithin(0)}</strong>
                  </div>
                  <div className="metric-row">
                    <span>This Week:</span>
                    <strong>{deliveredWithin(7)}</strong>
                  </div>
                  <div className="metric-row">
                    <span>This Month:</span>
                    <strong>{deliveredWithin(30)}</strong>
                  </div>
                </Card>

                <Card className="analytics-card">
                  <h4>Engagement Metrics</h4>
                  <div className="metric-row">
                    <span>Messages Sent:</span>
                    <strong>{sentNotifications.length}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Inbox Read Rate:</span>
                    <strong>{pct(inboxNotifications.length - unread, inboxNotifications.length)}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Failed Deliveries:</span>
                    <strong>{failed}</strong>
                  </div>
                </Card>

                <Card className="analytics-card">
                  <h4>Channel Performance</h4>
                  {channels.map((channel) => {
                    const rows = sentNotifications.filter((n) => n.channel === channel);
                    return (
                      <div className="metric-row" key={channel}>
                        <span>{channel}:</span>
                        <strong>{pct(rows.filter((n) => n.status !== "Failed").length, rows.length)} Success</strong>
                      </div>
                    );
                  })}
                </Card>

                <Card className="analytics-card">
                  <h4>Top Templates</h4>
                  {topTemplates.map((tpl) => (
                    <div className="metric-row" key={tpl.code}>
                      <span>{tpl.name}:</span>
                      <strong>{tpl.usageCount} uses</strong>
                    </div>
                  ))}
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
                {selectedNotification.priority && <Tag value={selectedNotification.priority} severity={priorityBodyTemplate(selectedNotification).props.severity} className="mr-2" />}
                <Tag value={selectedNotification.status} severity={statusSeverity(selectedNotification.status)} />
              </div>
            </div>

            <div className="detail-info">
              <div className="info-row">
                <label>From:</label>
                <span>{selectedNotification.sender}</span>
              </div>
              <div className="info-row">
                <label>To:</label>
                <span>{selectedNotification.recipients || selectedNotification.recipientType}</span>
              </div>
              <div className="info-row">
                <label>Channel:</label>
                <span>{selectedNotification.channel}</span>
              </div>
              <div className="info-row">
                <label>Sent:</label>
                <span>{dateBody("sentDate")(selectedNotification)}</span>
              </div>
            </div>

            <div className="detail-content">
              <h4>Message Content</h4>
              <div className="content-body">
                {selectedNotification.content}
              </div>
            </div>

          </div>
        )}
      </Dialog>

      <Dialog header="Compose Notification" visible={showCompose} style={{ width: '50vw' }} footer={composeFooter} onHide={() => setShowCompose(false)}>
        <div className="p-fluid">
          <div className="p-field field">
            <label>Template</label>
            <Dropdown value={message.templateCode} options={templates.map((tpl) => ({ label: tpl.name, value: tpl.code }))} showClear
              onChange={(e) => (e.value ? applyTemplate(templates.find((tpl) => tpl.code === e.value)) : setField("templateCode", null))} />
          </div>
          <div className="p-field field">
            <label>Type</label>
            <InputText value={message.type} onChange={(e) => setField("type", e.target.value)} />
          </div>
          <div className="p-field field">
            <label>Recipients *</label>
            <InputText value={message.recipients} onChange={(e) => setField("recipients", e.target.value)} placeholder="email@example.com, ..." />
          </div>
          <div className="p-field field">
            <label>Channel</label>
            <Dropdown value={message.channel} options={[...new Set(["Email", ...templates.map((tpl) => tpl.channel).filter(Boolean)])]} onChange={(e) => setField("channel", e.value)} />
          </div>
          <div className="p-field field">
            <label>Subject *</label>
            <InputText value={message.subject} onChange={(e) => setField("subject", e.target.value)} />
          </div>
          <div className="p-field field">
            <label>Message *</label>
            <InputTextarea rows={5} value={message.content} onChange={(e) => setField("content", e.target.value)} />
          </div>
        </div>
      </Dialog>

      <Tooltip target=".p-button" />
    </div>
  );
};

export default RemittanceNotifications;