import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { Card } from "primereact/card";
import { BreadCrumb } from "primereact/breadcrumb";
import { Toast } from "primereact/toast";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import remittanceService, { apiRequest, masterService } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { saveAndReturn } from "../masterRecord";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import "./index.scss";

const ApprovalWorkflowMaster = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [workflowPatternOptions, setWorkflowPatternOptions] = useState([]);

  useEffect(() => {
    remittanceService.listApprovals()
      .then((rows) => setPendingApprovals(rows.map((a) => ({
        ...a,
        requestNo: a.referenceNo,
        type: a.transactionType,
        requestedBy: a.initiator,
        requestDate: a.submissionDate,
        currentLevel: `${a.currentLevel} of ${a.requiredLevels}`,
        slaRemaining: `${a.slaRemaining}h`
      }))))
      .catch((error) => showError(toast, error));
    masterService.definition("remittance-approval-workflow")
      .then((def) => setWorkflowPatternOptions(((def.fields || []).find((f) => f.name === "type")?.options || []).map((v) => ({ label: v, value: v }))))
      .catch((error) => showError(toast, error));
    apiRequest("GET", "/roles")
      .then((res) => setRoleOptions((res.data || []).map((r) => ({ label: r.name, value: r.name }))))
      .catch((error) => showError(toast, error));
  }, []);
  const [formData, setFormData] = useState({
    workflowCode: "",
    workflowName: "",
    isActive: true,
    appliesTo: [],
    workflowPattern: "Sequential",
    enableEscalation: true,
    escalationHours: 48,
    maxEscalationLevels: 2,
    enableReminders: true,
    firstReminder: 24,
    reminderFrequency: 12,
    allowDelegation: true,
    allowPermanent: false,
    maxDelegationDays: 30,
    requireDelegationApproval: false
  });

  const [approvalStages, setApprovalStages] = useState([]);

  const [emailTemplates, setEmailTemplates] = useState([
    { event: "Approval Request", template: "", recipients: ["Approver"], ccList: "", active: true },
    { event: "Approved", template: "", recipients: ["Initiator"], ccList: "", active: true },
    { event: "Rejected", template: "", recipients: ["Initiator", "Manager"], ccList: "", active: true },
    { event: "Escalated", template: "", recipients: ["Manager", "Next Approver"], ccList: "", active: true },
    { event: "Reminder", template: "", recipients: ["Approver"], ccList: "", active: true }
  ]);

  const appliesToOptions = [
    { label: "Settlement", value: "Settlement" },
    { label: "Statement", value: "Statement" },
    { label: "Electronic Transfer", value: "Electronic Transfer" },
    { label: "Bulk Processing", value: "Bulk Processing" },
    { label: "Adjustment", value: "Adjustment" }
  ];


  const approvalTypeOptions = [
    { label: "Any One", value: "Any One" },
    { label: "All Required", value: "All Required" },
    { label: "Majority", value: "Majority" },
    { label: "Two of Three", value: "Two of Three" }
  ];


  const eventOptions = [
    { label: "Approval Request", value: "Approval Request" },
    { label: "Approved", value: "Approved" },
    { label: "Rejected", value: "Rejected" },
    { label: "Escalated", value: "Escalated" },
    { label: "Reminder", value: "Reminder" }
  ];

  const recipientOptions = [
    { label: "Initiator", value: "Initiator" },
    { label: "Approver", value: "Approver" },
    { label: "Next Approver", value: "Next Approver" },
    { label: "Manager", value: "Manager" },
    { label: "Custom", value: "Custom" }
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Approval Workflow", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        setFormData((prev) => ({
          ...prev,
          workflowPattern: data.type || prev.workflowPattern,
          appliesTo: data.appliesTo || prev.appliesTo,
          allowDelegation: data.delegationAllowed ?? prev.allowDelegation,
          ...(data.form || {}),
          workflowCode: data.code,
          workflowName: data.name,
          isActive: data.status === true || data.status === "Active",
        }));
        if (data.form?.emailTemplates) setEmailTemplates(data.form.emailTemplates);
        setApprovalStages(data.form?.approvalStages || (data.levels || []).map((level) => ({
          stageName: `Level ${level.level} Approval`,
          approverRole: level.role,
          minAmount: level.minAmount,
          maxAmount: level.maxAmount,
          approvalType: level.requiredApprovals > 1 ? "All Required" : "Any One",
          slaHours: parseInt(level.sla, 10) || 24
        })));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        workflowCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `AWF-${String(random).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    setIsLoading(true);
    await saveAndReturn({
      type: "remittance-approval-workflow",
      id: data?.id,
      toast,
      navigate,
      record: {
        code: formData.workflowCode,
        name: formData.workflowName,
        isActive: formData.isActive,
        type: formData.workflowPattern,
        appliesTo: formData.appliesTo,
        delegationAllowed: formData.allowDelegation,
        levels: approvalStages.map((stage, i) => ({
          level: i + 1,
          role: stage.approverRole,
          minAmount: stage.minAmount,
          maxAmount: stage.maxAmount,
          sla: `${stage.slaHours} hours`,
          requiredApprovals: stage.approvalType === "All Required" ? 2 : 1
        })),
        form: { ...formData, approvalStages, emailTemplates }
      }
    });
    setIsLoading(false);
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const addApprovalStage = () => {
    setApprovalStages([
      ...approvalStages,
      {
        stageName: "",
        approverRole: "",
        minAmount: 0,
        maxAmount: 0,
        approvalType: "Any One",
        slaHours: 24
      }
    ]);
  };


  const deleteStageTemplate = (rowData, column) => {
    const rowIndex = approvalStages.indexOf(rowData);
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-rounded p-button-danger p-button-text"
        onClick={() => {
          const newStages = approvalStages.filter((_, index) => index !== rowIndex);
          setApprovalStages(newStages);
        }}
      />
    );
  };

  return (
    <div className="approval-workflow-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Approval Workflow Master</h3>
          <div className="header-actions">
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-sm p-button-success"
              onClick={handleSave}
              disabled={mode === "view"}
              loading={isLoading}
            />
            <Button
              label={t("common.cancel")}
              icon="pi pi-times"
              className="p-button-sm p-button-secondary"
              onClick={handleCancel}
            />
          </div>
        </div>
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="Workflow Configuration">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Workflow Definition
              </h4>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-4">
                  <label>Workflow Code *</label>
                  <InputText
                    value={formData.workflowCode}
                    onChange={(e) => setFormData({ ...formData, workflowCode: e.target.value })}
                    placeholder={t("remittance.placeholderWorkflowCode")}
                  />
                </div>
                <div className="p-field field col-12 md:col-4">
                  <label>Workflow Name *</label>
                  <InputText
                    value={formData.workflowName}
                    onChange={(e) => setFormData({ ...formData, workflowName: e.target.value })}
                  />
                </div>
                <div className="p-field field col-12 md:col-4">
                  <label>Active</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.checked })}
                    />
                    <label className="checkbox-label">Active</label>
                  </div>
                </div>
              </div>

              <h3>Workflow Type</h3>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-6">
                  <label>Applies To *</label>
                  <MultiSelect
                    value={formData.appliesTo}
                    options={appliesToOptions}
                    onChange={(e) => setFormData({ ...formData, appliesTo: e.value })}
                    placeholder="Select Transaction Types"
                    display="chip"
                  />
                </div>
                <div className="p-field field col-12 md:col-6">
                  <label>Workflow Pattern</label>
                  <Dropdown
                    value={formData.workflowPattern}
                    options={workflowPatternOptions}
                    onChange={(e) => setFormData({ ...formData, workflowPattern: e.value })}
                  />
                </div>
              </div>

              <h3>Approval Levels</h3>
              <div className="mb-3">
                <Button label={t("remittance.addStage")} icon="pi pi-plus" onClick={addApprovalStage} />
              </div>
              <DataTable value={approvalStages} editMode="cell">
                <Column field="stageName" header="Stage Name" editor={(props) =>
                  <InputText value={props.value} onChange={(e) => props.editorCallback(e.target.value)} />
                } />
                <Column field="approverRole" header="Approver Role" editor={(props) =>
                  <Dropdown value={props.value} options={roleOptions} onChange={(e) => props.editorCallback(e.value)} />
                } />
                <Column field="minAmount" header="Min Amount" editor={(props) =>
                  <InputNumber value={props.value} onValueChange={(e) => props.editorCallback(e.value)} mode="currency" currency={currencyCode} />
                } />
                <Column field="maxAmount" header="Max Amount" editor={(props) =>
                  <InputNumber value={props.value} onValueChange={(e) => props.editorCallback(e.value)} mode="currency" currency={currencyCode} />
                } />
                <Column field="approvalType" header="Approval Type" editor={(props) =>
                  <Dropdown value={props.value} options={approvalTypeOptions} onChange={(e) => props.editorCallback(e.value)} />
                } />
                <Column field="slaHours" header="SLA (Hours)" editor={(props) =>
                  <InputNumber value={props.value} onValueChange={(e) => props.editorCallback(e.value)} />
                } />
                <Column header="" body={deleteStageTemplate} style={{ width: '60px' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Conditions">
            <div className="form-section">
              <h3>Escalation Rules</h3>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-6">
                  <label>Enable Escalation</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.enableEscalation}
                      onChange={(e) => setFormData({ ...formData, enableEscalation: e.checked })}
                    />
                    <label className="checkbox-label">Enable</label>
                  </div>
                </div>
                {formData.enableEscalation && (
                  <>
                    <div className="p-field field col-12 md:col-6">
                      <label>Escalation After (Hours)</label>
                      <InputNumber
                        value={formData.escalationHours}
                        onValueChange={(e) => setFormData({ ...formData, escalationHours: e.value })}
                      />
                    </div>
                    <div className="p-field field col-12 md:col-6">
                      <label>Escalate To</label>
                      <Dropdown
                        value={formData.escalateTo}
                        options={roleOptions}
                        onChange={(e) => setFormData({ ...formData, escalateTo: e.value })}
                        placeholder={t("remittance.selectRole")}
                      />
                    </div>
                    <div className="p-field field col-12 md:col-6">
                      <label>Max Escalation Levels</label>
                      <InputNumber
                        value={formData.maxEscalationLevels}
                        onValueChange={(e) => setFormData({ ...formData, maxEscalationLevels: e.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <h3>Conditional Rules</h3>
              <div className="conditional-rules">
                <p>Configure conditional rules for dynamic workflow routing based on transaction attributes.</p>
                <Button label={t("remittance.addRule")} icon="pi pi-plus" className="p-button-secondary" />
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Notifications">
            <div className="form-section">
              <h3>Email Templates</h3>
              <DataTable value={emailTemplates} editMode="cell">
                <Column field="event" header="Event" editor={(props) =>
                  <Dropdown value={props.value} options={eventOptions} onChange={(e) => props.editorCallback(e.value)} />
                } />
                <Column field="template" header="Email Template" editor={(props) =>
                  <InputText value={props.value} onChange={(e) => props.editorCallback(e.target.value)} />
                } />
                <Column field="recipients" header="Recipients" editor={(props) =>
                  <MultiSelect value={props.value} options={recipientOptions} onChange={(e) => props.editorCallback(e.value)} display="chip" />
                } />
                <Column field="ccList" header="CC" editor={(props) =>
                  <InputText value={props.value} onChange={(e) => props.editorCallback(e.target.value)} />
                } />
                <Column field="active" header="Active" editor={(props) =>
                  <Checkbox checked={props.value} onChange={(e) => props.editorCallback(e.checked)} />
                } body={(rowData) => <Checkbox checked={rowData.active} disabled />} />
              </DataTable>

              <h3 className="mt-4">Reminder Settings</h3>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-4">
                  <label>Enable Reminders</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.enableReminders}
                      onChange={(e) => setFormData({ ...formData, enableReminders: e.checked })}
                    />
                    <label className="checkbox-label">Enable</label>
                  </div>
                </div>
                {formData.enableReminders && (
                  <>
                    <div className="p-field field col-12 md:col-4">
                      <label>First Reminder After (Hours)</label>
                      <InputNumber
                        value={formData.firstReminder}
                        onValueChange={(e) => setFormData({ ...formData, firstReminder: e.value })}
                      />
                    </div>
                    <div className="p-field field col-12 md:col-4">
                      <label>Reminder Frequency (Hours)</label>
                      <InputNumber
                        value={formData.reminderFrequency}
                        onValueChange={(e) => setFormData({ ...formData, reminderFrequency: e.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Delegation">
            <div className="form-section">
              <h3>Delegation Rules</h3>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-6">
                  <label>Allow Delegation</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.allowDelegation}
                      onChange={(e) => setFormData({ ...formData, allowDelegation: e.checked })}
                    />
                    <label className="checkbox-label">Allow</label>
                  </div>
                </div>
                <div className="p-field field col-12 md:col-6">
                  <label>Allow Permanent Delegation</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.allowPermanent}
                      onChange={(e) => setFormData({ ...formData, allowPermanent: e.checked })}
                    />
                    <label className="checkbox-label">Allow</label>
                  </div>
                </div>
                {formData.allowDelegation && (
                  <>
                    <div className="p-field field col-12 md:col-6">
                      <label>Max Delegation Days</label>
                      <InputNumber
                        value={formData.maxDelegationDays}
                        onValueChange={(e) => setFormData({ ...formData, maxDelegationDays: e.value })}
                      />
                    </div>
                    <div className="p-field field col-12 md:col-6">
                      <label>Require Delegation Approval</label>
                      <div className="checkbox-wrapper">
                        <Checkbox
                          checked={formData.requireDelegationApproval}
                          onChange={(e) => setFormData({ ...formData, requireDelegationApproval: e.checked })}
                        />
                        <label className="checkbox-label">Require</label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Pending Approvals">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Current Pending Approvals
              </h4>
              <DataTable
                value={pendingApprovals}
                responsiveLayout="scroll"
                className="mt-3"
                emptyMessage="No pending approvals"
                showGridlines
              >
                <Column
                  field="requestNo"
                  header="Request No"
                  style={{ width: '15%' }}
                />
                <Column
                  field="type"
                  header="Type"
                  style={{ width: '15%' }}
                />
                <Column
                  field="amount"
                  header="Amount"
                  body={(rowData) => formatCurrency(rowData.amount)}
                  style={{ width: '15%' }}
                />
                <Column
                  field="requestedBy"
                  header="Requested By"
                  style={{ width: '15%' }}
                />
                <Column body={(row) => formatAppDate(row.requestDate)}
                  field="requestDate"
                  header="Request Date"
                  style={{ width: '15%' }}
                />
                <Column
                  field="currentLevel"
                  header="Current Level"
                  style={{ width: '10%' }}
                />
                <Column
                  field="slaRemaining"
                  header="SLA Remaining"
                  style={{ width: '15%' }}
                />
                <Column
                  field="status"
                  header="Status"
                  body={(rowData) => (
                    <span className={`status-badge status-${rowData.status.toLowerCase()}`}>
                      {rowData.status}
                    </span>
                  )}
                  style={{ width: '10%' }}
                />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>

      </Card>
    </div>
  );
};

export default ApprovalWorkflowMaster;