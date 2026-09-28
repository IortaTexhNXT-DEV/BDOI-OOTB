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
import { approvalWorkflowData, mockCrudOperations } from "../../../../services/mockData/remittanceMockData";
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
  const [pendingApprovals, setPendingApprovals] = useState(approvalWorkflowData.pendingApprovals);
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

  const [approvalStages, setApprovalStages] = useState([
    {
      stageName: "Level 1 Approval",
      approverRole: "Supervisor",
      minAmount: 0,
      maxAmount: 50000,
      approvalType: "Any One",
      slaHours: 24
    },
    {
      stageName: "Level 2 Approval",
      approverRole: "Manager",
      minAmount: 50001,
      maxAmount: 100000,
      approvalType: "All Required",
      slaHours: 48
    }
  ]);

  const [emailTemplates, setEmailTemplates] = useState([
    { event: "Approval Request", template: "TMPL001", recipients: ["Approver"], ccList: "", active: true },
    { event: "Approved", template: "TMPL002", recipients: ["Initiator"], ccList: "", active: true },
    { event: "Rejected", template: "TMPL003", recipients: ["Initiator", "Manager"], ccList: "", active: true },
    { event: "Escalated", template: "TMPL004", recipients: ["Manager", "Next Approver"], ccList: "", active: true },
    { event: "Reminder", template: "TMPL005", recipients: ["Approver"], ccList: "", active: true }
  ]);

  const appliesToOptions = [
    { label: "Settlement", value: "Settlement" },
    { label: "Statement", value: "Statement" },
    { label: "Electronic Transfer", value: "Electronic Transfer" },
    { label: "Bulk Processing", value: "Bulk Processing" },
    { label: "Adjustment", value: "Adjustment" }
  ];

  const workflowPatternOptions = [
    { label: "Sequential", value: "Sequential" },
    { label: "Parallel", value: "Parallel" },
    { label: "Hierarchical", value: "Hierarchical" },
    { label: "Matrix", value: "Matrix" }
  ];

  const approvalTypeOptions = [
    { label: "Any One", value: "Any One" },
    { label: "All Required", value: "All Required" },
    { label: "Majority", value: "Majority" },
    { label: "Two of Three", value: "Two of Three" }
  ];

  const roleOptions = [
    { label: "User", value: "User" },
    { label: "Supervisor", value: "Supervisor" },
    { label: "Manager", value: "Manager" },
    { label: "Finance Head", value: "Finance Head" },
    { label: "CFO", value: "CFO" }
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
        // Load from mock data
        const workflowData = approvalWorkflowData.workflows.find(w => w.id === data.id) || data;
        setFormData({
          workflowCode: workflowData.code || "AWF-001",
          workflowName: workflowData.name || "Standard Approval Matrix",
          isActive: workflowData.status === "Active",
          appliesTo: ["Settlement", "Electronic Transfer"],
          workflowPattern: workflowData.type || "Sequential",
          enableEscalation: true,
          escalationHours: 48,
          maxEscalationLevels: 2,
          enableReminders: true,
          firstReminder: 24,
          reminderFrequency: 12,
          allowDelegation: workflowData.delegationAllowed || true,
          allowPermanent: false,
          maxDelegationDays: 30,
          requireDelegationApproval: false
        });

        // Load levels from mock data
        if (workflowData.levels) {
          const stages = workflowData.levels.map(level => ({
            stageName: `Level ${level.level} Approval`,
            approverRole: level.role,
            minAmount: level.minAmount,
            maxAmount: level.maxAmount,
            approvalType: level.requiredApprovals > 1 ? "All Required" : "Any One",
            slaHours: parseInt(level.sla) || 24
          }));
          setApprovalStages(stages);
        }
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

    try {
      const workflowData = {
        ...formData,
        approvalStages,
        emailTemplates,
        status: formData.isActive ? "Active" : "Inactive"
      };

      let result;
      if (mode === "edit") {
        result = await mockCrudOperations.update("approval-workflow", data.id, workflowData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Approval workflow updated successfully",
          life: 3000
        });
      } else {
        result = await mockCrudOperations.create("approval-workflow", workflowData);
        toast.current.show({
          severity: "success",
          summary: "Success",
          detail: "Approval workflow created successfully",
          life: 3000
        });
      }

      console.log("Approval workflow operation result:", result);

      setTimeout(() => {
        navigate("/master/finance/remittance");
      }, 1000);
    } catch (error) {
      console.error("Save error:", error);
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to save approval workflow",
        life: 3000
      });
    } finally {
      setIsLoading(false);
    }
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

  const onCellEdit = (options) => {
    let updatedData = [...options.props.value];
    updatedData[options.rowIndex][options.field] = options.newValue;
    return updatedData;
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
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-4">
                  <label>Workflow Code *</label>
                  <InputText
                    value={formData.workflowCode}
                    onChange={(e) => setFormData({ ...formData, workflowCode: e.target.value })}
                    placeholder={t("remittance.placeholderWorkflowCode")}
                  />
                </div>
                <div className="p-field p-col-12 p-md-4">
                  <label>Workflow Name *</label>
                  <InputText
                    value={formData.workflowName}
                    onChange={(e) => setFormData({ ...formData, workflowName: e.target.value })}
                  />
                </div>
                <div className="p-field p-col-12 p-md-4">
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
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-6">
                  <label>Applies To *</label>
                  <MultiSelect
                    value={formData.appliesTo}
                    options={appliesToOptions}
                    onChange={(e) => setFormData({ ...formData, appliesTo: e.value })}
                    placeholder="Select Transaction Types"
                    display="chip"
                  />
                </div>
                <div className="p-field p-col-12 p-md-6">
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
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-6">
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
                    <div className="p-field p-col-12 p-md-6">
                      <label>Escalation After (Hours)</label>
                      <InputNumber
                        value={formData.escalationHours}
                        onValueChange={(e) => setFormData({ ...formData, escalationHours: e.value })}
                      />
                    </div>
                    <div className="p-field p-col-12 p-md-6">
                      <label>Escalate To</label>
                      <Dropdown
                        value={formData.escalateTo}
                        options={roleOptions}
                        onChange={(e) => setFormData({ ...formData, escalateTo: e.value })}
                        placeholder={t("remittance.selectRole")}
                      />
                    </div>
                    <div className="p-field p-col-12 p-md-6">
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
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-4">
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
                    <div className="p-field p-col-12 p-md-4">
                      <label>First Reminder After (Hours)</label>
                      <InputNumber
                        value={formData.firstReminder}
                        onValueChange={(e) => setFormData({ ...formData, firstReminder: e.value })}
                      />
                    </div>
                    <div className="p-field p-col-12 p-md-4">
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
              <div className="p-fluid p-formgrid p-grid">
                <div className="p-field p-col-12 p-md-6">
                  <label>Allow Delegation</label>
                  <div className="checkbox-wrapper">
                    <Checkbox
                      checked={formData.allowDelegation}
                      onChange={(e) => setFormData({ ...formData, allowDelegation: e.checked })}
                    />
                    <label className="checkbox-label">Allow</label>
                  </div>
                </div>
                <div className="p-field p-col-12 p-md-6">
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
                    <div className="p-field p-col-12 p-md-6">
                      <label>Max Delegation Days</label>
                      <InputNumber
                        value={formData.maxDelegationDays}
                        onValueChange={(e) => setFormData({ ...formData, maxDelegationDays: e.value })}
                      />
                    </div>
                    <div className="p-field p-col-12 p-md-6">
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
                <Column
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