import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { MultiSelect } from "primereact/multiselect";
import { InputNumber } from "primereact/inputnumber";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { useNavigate, useParams } from "react-router-dom";
import remittanceService, { masterService } from "../../../../services/remittanceService";
import authService from "../../../../services/authService";
import { showError, showSuccess } from "../../../Remittance/shared";
import { MASTER_HOME, saveRecord } from "../masterRecord";
import "./index.scss";
import { confirmAction } from "../../../../utility/dialogs";

const TYPE = "remittance-notification-template";
const toRow = (template) => ({
  id: template.id,
  code: template.code,
  templateName: template.name,
  eventType: template.trigger,
  recipientType: template.recipientType || "Client",
  channel: template.channel,
  subject: template.subject || template.message || "",
  body: template.body || template.message || "",
  priority: template.priority || "Medium",
  active: template.status === "Active",
  autoSend: template.autoSend ?? true
});
const toRecord = (row) => ({
  code: row.code,
  name: row.templateName,
  trigger: row.eventType,
  recipientType: row.recipientType,
  channel: row.channel,
  subject: row.subject,
  body: row.body,
  priority: row.priority,
  autoSend: row.autoSend,
  isActive: row.active
});

const NotificationMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode } = useParams();
  const isViewMode = mode === "view";
  const toast = React.useRef(null);

  // Notification templates are records of the remittance-notification-template master
  const [notificationTemplates, setNotificationTemplates] = useState([]);

  const loadTemplates = () => masterService.list(TYPE)
    .then((rows) => setNotificationTemplates((rows || []).map(toRow)))
    .catch((error) => showError(toast, error));

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTemplate = async () => {
    try {
      await saveRecord(TYPE, selectedTemplate.id, toRecord(selectedTemplate));
      showSuccess(toast, `${selectedTemplate.templateName} saved`);
      setShowTemplateDialog(false);
      loadTemplates();
    } catch (error) {
      showError(toast, error);
    }
  };

  const deleteTemplate = async (row) => {
    if (!(await confirmAction(`Delete template ${row.templateName}?`, { danger: true }))) return;
    try {
      await masterService.remove(TYPE, row.id);
      showSuccess(toast, `${row.templateName} deleted`);
      loadTemplates();
    } catch (error) {
      showError(toast, error);
    }
  };

  const editTemplate = (row) => {
    setSelectedTemplate({ ...row });
    setShowTemplateDialog(true);
  };

  const setTemplateField = (field, value) => setSelectedTemplate((tpl) => ({ ...tpl, [field]: value }));

  const sendTestEmail = async () => {
    const email = authService.getUser()?.email || localStorage.getItem("USER_EMAIL");
    try {
      await remittanceService.sendNotification({ type: "Test", subject: "Remittance notification test", content: "Test message from the Notification Master.", recipients: [email], channel: "Email" });
      showSuccess(toast, `Test email queued for ${email}`, "Test Email Sent");
    } catch (error) {
      showError(toast, error);
    }
  };

  // Notification rules state - enhanced examples
  const [notificationRules, setNotificationRules] = useState([
    {
      id: 1,
      ruleName: "Payment Overdue Alert",
      condition: "Days Past Due > 7",
      frequency: "Daily",
      recipients: ["Client", "Agent"],
      escalationLevel: 1,
      active: true
    },
    {
      id: 2,
      ruleName: "Large Amount Alert",
      condition: "Amount > \u20B150,000",
      frequency: "Immediate",
      recipients: ["Manager", "Finance Head"],
      escalationLevel: 2,
      active: true
    },
    {
      id: 3,
      ruleName: "Settlement Delay Warning",
      condition: "Settlement Pending > 3 Days",
      frequency: "Daily",
      recipients: ["Operations Team"],
      escalationLevel: 1,
      active: true
    },
    {
      id: 4,
      ruleName: "Bill Generation Completion",
      condition: "Bill Generation Status = Complete",
      frequency: "Immediate",
      recipients: ["Finance Team"],
      escalationLevel: 1,
      active: true
    }
  ]);

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);

  const eventTypeOptions = [
    { label: "Payment Overdue", value: "Payment Overdue" },
    { label: "Settlement Complete", value: "Settlement Complete" },
    { label: "Adjustment Request", value: "Adjustment Request" },
    { label: "Statement Generation", value: "Statement Generation" },
    { label: "Exception Occurred", value: "Exception Occurred" },
    { label: "Approval Required", value: "Approval Required" }
  ];

  const recipientTypeOptions = [
    { label: "Client", value: "Client" },
    { label: "Agent", value: "Agent" },
    { label: "Approver", value: "Approver" },
    { label: "Manager", value: "Manager" },
    { label: "Finance Head", value: "Finance Head" },
    { label: "Operations Team", value: "Operations Team" }
  ];

  const channelOptions = [
    { label: "Email", value: "Email" },
    { label: "SMS", value: "SMS" },
    { label: "Email + SMS", value: "Email + SMS" },
    { label: "System Alert", value: "System Alert" },
    { label: "Push Notification", value: "Push Notification" }
  ];

  const priorityOptions = [
    { label: "Low", value: "Low" },
    { label: "Medium", value: "Medium" },
    { label: "High", value: "High" },
    { label: "Critical", value: "Critical" }
  ];

  const frequencyOptions = [
    { label: "Immediate", value: "Immediate" },
    { label: "Hourly", value: "Hourly" },
    { label: "Daily", value: "Daily" },
    { label: "Weekly", value: "Weekly" },
    { label: "Monthly", value: "Monthly" }
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

  const activeBodyTemplate = (rowData) => {
    return <Checkbox checked={rowData.active} disabled={isViewMode} />;
  };

  const templateActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View"
          onClick={() => {
            setSelectedTemplate(rowData);
            setShowTemplateDialog(true);
          }}
        />
        {!isViewMode && (
          <>
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text"
              tooltip="Edit"
              onClick={() => editTemplate(rowData)}
            />
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Delete"
              onClick={() => deleteTemplate(rowData)}
            />
          </>
        )}
      </div>
    );
  };

  const ruleActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View"
          onClick={() => {
            setSelectedRule(rowData);
            setShowRuleDialog(true);
          }}
        />
        {!isViewMode && (
          <>
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text"
              tooltip="Edit"
            />
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Delete"
            />
          </>
        )}
      </div>
    );
  };

  const handleSave = () => navigate(MASTER_HOME);

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const templateDialogFooter = (
    <div>
      <Button
        label={t("common.close")}
        icon="pi pi-times"
        onClick={() => setShowTemplateDialog(false)}
        className="p-button-text"
      />
      {!isViewMode && (
        <Button
          label={t("financeMasters.save")}
          icon="pi pi-check"
          onClick={saveTemplate}
          autoFocus
        />
      )}
    </div>
  );

  const ruleDialogFooter = (
    <div>
      <Button
        label={t("common.close")}
        icon="pi pi-times"
        onClick={() => setShowRuleDialog(false)}
        className="p-button-text"
      />
      {!isViewMode && (
        <Button
          label={t("financeMasters.save")}
          icon="pi pi-check"
          onClick={() => setShowRuleDialog(false)}
          autoFocus
        />
      )}
    </div>
  );

  return (
    <div className="notification-master">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>Remittance Notification Master - {mode?.charAt(0).toUpperCase() + mode?.slice(1)}</h2>
      </div>

      <Card>
        <TabView>
          <TabPanel header="Notification Templates">
            <div className="templates-section">
              {!isViewMode && (
                <div className="toolbar mb-3">
                  <Button
                    label={t("remittance.addTemplate")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => editTemplate({ id: null, code: `NTF-${Date.now().toString().slice(-6)}`, templateName: "", eventType: "", recipientType: "Client", channel: "Email", subject: "", body: "", priority: "Medium", active: true, autoSend: true })}
                  />
                </div>
              )}

              <DataTable value={notificationTemplates} stripedRows>
                <Column field="templateName" header="Template Name" style={{ width: '20%' }} />
                <Column field="eventType" header="Event Type" style={{ width: '15%' }} />
                <Column field="recipientType" header="Recipient" style={{ width: '12%' }} />
                <Column field="channel" header="Channel" style={{ width: '12%' }} />
                <Column field="subject" header="Subject" style={{ width: '25%' }} />
                <Column field="priority" header="Priority" body={priorityBodyTemplate} style={{ width: '8%' }} />
                <Column field="active" header="Active" body={activeBodyTemplate} style={{ width: '6%' }} />
                <Column header="Actions" body={templateActionsTemplate} style={{ width: '12%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Notification Rules">
            <div className="rules-section">
              {!isViewMode && (
                <div className="toolbar mb-3">
                  <Button
                    label={t("remittance.addRule")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => {
                      toast.current.show({
                        severity: 'info',
                        summary: 'Info',
                        detail: 'Add Rule dialog would open here',
                        life: 3000
                      });
                    }}
                  />
                </div>
              )}

              <DataTable value={notificationRules} stripedRows>
                <Column field="ruleName" header="Rule Name" style={{ width: '25%' }} />
                <Column field="condition" header="Condition" style={{ width: '30%' }} />
                <Column field="frequency" header="Frequency" style={{ width: '12%' }} />
                <Column
                  field="recipients"
                  header="Recipients"
                  body={(rowData) => rowData.recipients.join(', ')}
                  style={{ width: '20%' }}
                />
                <Column field="active" header="Active" body={activeBodyTemplate} style={{ width: '6%' }} />
                <Column header="Actions" body={ruleActionsTemplate} style={{ width: '12%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Email Configuration">
            <div className="email-config-section">
              <div className="config-grid">
                <div className="config-group">
                  <h3>SMTP Settings</h3>
                  <div className="p-fluid">
                    <div className="p-field">
                      <label>SMTP Server</label>
                      <InputText placeholder={t("remittance.placeholderSmtp")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Port</label>
                      <InputNumber placeholder={t("remittance.placeholderPort")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Username</label>
                      <InputText placeholder={t("remittance.placeholderEmail")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Authentication</label>
                      <Dropdown
                        options={[
                          { label: "None", value: "none" },
                          { label: "SSL", value: "ssl" },
                          { label: "TLS", value: "tls" }
                        ]}
                        placeholder={t("remittance.selectAuthentication")}
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </div>

                <div className="config-group">
                  <h3>Default Settings</h3>
                  <div className="p-fluid">
                    <div className="p-field">
                      <label>From Email</label>
                      <InputText placeholder={t("remittance.placeholderRemittanceEmail")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>From Name</label>
                      <InputText placeholder={t("remittance.placeholderRemittanceSystem")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Reply To</label>
                      <InputText placeholder={t("remittance.placeholderSupportEmail")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>BCC Recipients</label>
                      <InputText placeholder={t("remittance.placeholderAuditEmail")} disabled={isViewMode} />
                    </div>
                  </div>
                </div>
              </div>

              {!isViewMode && (
                <div className="test-section mt-4">
                  <Button
                    label={t("remittance.testEmailConfiguration")}
                    icon="pi pi-send"
                    className="p-button-secondary"
                    onClick={sendTestEmail}
                  />
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel header="SMS Configuration">
            <div className="sms-config-section">
              <div className="config-grid">
                <div className="config-group">
                  <h3>SMS Provider Settings</h3>
                  <div className="p-fluid">
                    <div className="p-field">
                      <label>SMS Provider</label>
                      <Dropdown
                        options={[
                          { label: "Twilio", value: "twilio" },
                          { label: "AWS SNS", value: "aws" },
                          { label: "Custom API", value: "custom" }
                        ]}
                        placeholder={t("remittance.selectProvider")}
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="p-field">
                      <label>API Endpoint</label>
                      <InputText placeholder={t("remittance.placeholderApiUrl")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>API Key</label>
                      <InputText placeholder={t("remittance.placeholderApiKey")} type="password" disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Sender ID</label>
                      <InputText placeholder={t("remittance.placeholderRemit")} disabled={isViewMode} />
                    </div>
                  </div>
                </div>

                <div className="config-group">
                  <h3>SMS Settings</h3>
                  <div className="p-fluid">
                    <div className="p-field">
                      <label>Max Message Length</label>
                      <InputNumber value={160} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Country Code</label>
                      <InputText placeholder={t("remittance.placeholderCountryCode")} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <label>Retry Attempts</label>
                      <InputNumber value={3} disabled={isViewMode} />
                    </div>
                    <div className="p-field">
                      <div className="field-checkbox">
                        <Checkbox
                          id="enableSMS"
                          checked={true}
                          disabled={isViewMode}
                        />
                        <label htmlFor="enableSMS">Enable SMS Notifications</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </TabPanel>
        </TabView>

        <div className="action-buttons mt-4">
          {!isViewMode && (
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-primary mr-2"
              onClick={handleSave}
            />
          )}
          <Button
            label={isViewMode ? t("common.close") : t("common.cancel")}
            icon="pi pi-times"
            className="p-button-secondary"
            onClick={handleCancel}
          />
        </div>
      </Card>

      <Dialog
        header="Notification Template Details"
        visible={showTemplateDialog}
        style={{ width: '60vw' }}
        footer={templateDialogFooter}
        onHide={() => setShowTemplateDialog(false)}
      >
        {selectedTemplate && (
          <div className="template-details">
            <div className="p-fluid p-formgrid p-grid">
              <div className="p-field p-col-12 p-md-6">
                <label>Template Name</label>
                <InputText value={selectedTemplate.templateName} onChange={(e) => setTemplateField("templateName", e.target.value)} disabled={isViewMode} />
              </div>
              <div className="p-field p-col-12 p-md-6">
                <label>Event Type</label>
                <Dropdown
                  value={selectedTemplate.eventType}
                  options={eventTypeOptions}
                  onChange={(e) => setTemplateField("eventType", e.value)}
                  editable
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field p-col-12 p-md-6">
                <label>Recipient Type</label>
                <Dropdown
                  value={selectedTemplate.recipientType}
                  options={recipientTypeOptions}
                  onChange={(e) => setTemplateField("recipientType", e.value)}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field p-col-12 p-md-6">
                <label>Channel</label>
                <Dropdown
                  value={selectedTemplate.channel}
                  options={channelOptions}
                  onChange={(e) => setTemplateField("channel", e.value)}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field p-col-12">
                <label>Subject</label>
                <InputText value={selectedTemplate.subject} onChange={(e) => setTemplateField("subject", e.target.value)} disabled={isViewMode} />
              </div>
              <div className="p-field p-col-12">
                <label>Message Template</label>
                <InputTextarea
                  rows={5}
                  value={selectedTemplate.body}
                  onChange={(e) => setTemplateField("body", e.target.value)}
                  placeholder={t("remittance.placeholderTemplateMessage")}
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header="Notification Rule Details"
        visible={showRuleDialog}
        style={{ width: '60vw' }}
        footer={ruleDialogFooter}
        onHide={() => setShowRuleDialog(false)}
      >
        {selectedRule && (
          <div className="rule-details">
            <div className="p-fluid p-formgrid p-grid">
              <div className="p-field p-col-12">
                <label>Rule Name</label>
                <InputText value={selectedRule.ruleName} disabled={isViewMode} />
              </div>
              <div className="p-field p-col-12">
                <label>Condition</label>
                <InputText value={selectedRule.condition} disabled={isViewMode} />
              </div>
              <div className="p-field p-col-12 p-md-6">
                <label>Frequency</label>
                <Dropdown
                  value={selectedRule.frequency}
                  options={frequencyOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field p-col-12 p-md-6">
                <label>Escalation Level</label>
                <InputNumber value={selectedRule.escalationLevel} disabled={isViewMode} />
              </div>
              <div className="p-field p-col-12">
                <label>Recipients</label>
                <MultiSelect
                  value={selectedRule.recipients}
                  options={recipientTypeOptions}
                  display="chip"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default NotificationMaster;