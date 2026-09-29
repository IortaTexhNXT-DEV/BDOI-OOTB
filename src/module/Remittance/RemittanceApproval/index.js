import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import { InputNumber } from "primereact/inputnumber";
import "./index.scss";

const RemittanceApproval = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [comments, setComments] = useState("");
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [delegationData, setDelegationData] = useState({
    delegateTo: "",
    fromDate: null,
    toDate: null,
    transTypes: ["All"],
    amountLimit: null,
    reason: ""
  });

  const pendingApprovals = [
    {
      id: 1,
      priority: "Urgent",
      referenceNo: "TRF20250926001",
      transactionType: "Electronic Transfer",
      initiator: "John Smith",
      submissionDate: "2025-09-26 10:30",
      amount: 125000,
      description: "Monthly premium settlement to ABC Insurance",
      slaHours: 4,
      currentLevel: 2
    },
    {
      id: 2,
      priority: "High",
      referenceNo: "BLK20250926002",
      transactionType: "Bulk Processing",
      initiator: "Sarah Johnson",
      submissionDate: "2025-09-26 09:15",
      amount: 87500,
      description: "Batch commission processing - September 2025",
      slaHours: 12,
      currentLevel: 1
    },
    {
      id: 3,
      priority: "Normal",
      referenceNo: "SET20250925003",
      transactionType: "Settlement",
      initiator: "Mike Wilson",
      submissionDate: "2025-09-25 14:45",
      amount: 45300,
      description: "Quarterly settlement adjustment",
      slaHours: 24,
      currentLevel: 1
    },
    {
      id: 4,
      priority: "Low",
      referenceNo: "ADJ20250925004",
      transactionType: "Adjustment",
      initiator: "Emily Brown",
      submissionDate: "2025-09-25 11:20",
      amount: 12750,
      description: "Commission adjustment for policy corrections",
      slaHours: 48,
      currentLevel: 1
    }
  ];

  const approvalHistory = [
    {
      referenceNo: "TRF20250920001",
      transactionType: "Electronic Transfer",
      amount: 156000,
      action: "Approved",
      actionDate: "2025-09-20 15:30",
      remarks: "Verified and approved as per guidelines"
    },
    {
      referenceNo: "SET20250919002",
      transactionType: "Settlement",
      amount: 67800,
      action: "Rejected",
      actionDate: "2025-09-19 10:15",
      remarks: "Missing supporting documents"
    },
    {
      referenceNo: "BLK20250918003",
      transactionType: "Bulk Processing",
      amount: 234500,
      action: "Delegated",
      actionDate: "2025-09-18 16:45",
      remarks: "Delegated to Finance Head for review"
    }
  ];

  const activeDelegations = [
    {
      delegatedTo: "Robert Chen",
      fromDate: "2025-09-25",
      toDate: "2025-09-30",
      scope: "All Transactions",
      status: "Active"
    },
    {
      delegatedTo: "Lisa Anderson",
      fromDate: "2025-09-20",
      toDate: "2025-09-24",
      scope: "Settlements Only",
      status: "Expired"
    }
  ];

  const transactionTypeOptions = [
    { label: "All", value: "All" },
    { label: "Settlement", value: "Settlement" },
    { label: "Electronic Transfer", value: "Electronic Transfer" },
    { label: "Bulk Processing", value: "Bulk Processing" },
    { label: "Adjustment", value: "Adjustment" }
  ];

  const priorityOptions = [
    { label: "All", value: "All" },
    { label: "Urgent", value: "Urgent" },
    { label: "High", value: "High" },
    { label: "Normal", value: "Normal" },
    { label: "Low", value: "Low" }
  ];

  const userOptions = [
    { label: "Robert Chen", value: "Robert Chen" },
    { label: "Lisa Anderson", value: "Lisa Anderson" },
    { label: "David Miller", value: "David Miller" },
    { label: "Jennifer Davis", value: "Jennifer Davis" }
  ];

  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case 'Urgent': return 'danger';
        case 'High': return 'warning';
        case 'Normal': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const slaBodyTemplate = (rowData) => {
    const severity = rowData.slaHours < 8 ? 'danger' : rowData.slaHours < 24 ? 'warning' : 'success';
    return <Tag value={`${rowData.slaHours}h remaining`} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => {
    const getSeverity = (action) => {
      switch (action) {
        case 'Approved': return 'success';
        case 'Rejected': return 'danger';
        case 'Delegated': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.action} severity={getSeverity(rowData.action)} />;
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      return status === 'Active' ? 'success' : 'secondary';
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip={t("remittance.view")}
          onClick={() => {
            setSelectedTransaction(rowData);
            setShowDetailDialog(true);
          }}
        />
        <Button
          icon="pi pi-check"
          className="p-button-rounded p-button-success p-button-text"
          tooltip={t("remittance.approve")}
        />
        <Button
          icon="pi pi-times"
          className="p-button-rounded p-button-danger p-button-text"
          tooltip={t("common.reject")}
        />
      </div>
    );
  };

  const delegationActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button label={t("remittance.revoke")} className="p-button-text p-button-danger p-button-sm" />
        <Button label={t("remittance.extend")} className="p-button-text p-button-sm" />
      </div>
    );
  };

  const detailDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowDetailDialog(false)} className="p-button-text" />
      <Button label={t("remittance.submit")} icon="pi pi-check" onClick={() => setShowDetailDialog(false)} autoFocus />
    </div>
  );

  const delegationDialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" onClick={() => setShowDelegationDialog(false)} className="p-button-text" />
      <Button label={t("remittance.addDelegation")} icon="pi pi-check" onClick={() => setShowDelegationDialog(false)} autoFocus />
    </div>
  );

  return (
    <div className="remittance-approval">
      <h2>{t("remittance.approvalWorkflow")}</h2>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon orange">
              <i className="pi pi-clock" />
            </div>
            <div className="card-details">
              <div className="card-value">8</div>
              <div className="card-label">{t("remittance.pendingMyApproval")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-hourglass" />
            </div>
            <div className="card-details">
              <div className="card-value">15</div>
              <div className="card-label">{t("remittance.totalPending")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon red">
              <i className="pi pi-exclamation-triangle" />
            </div>
            <div className="card-details">
              <div className="card-value">3</div>
              <div className="card-label">{t("remittance.overdue")}</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon green">
              <i className="pi pi-check" />
            </div>
            <div className="card-details">
              <div className="card-value">12</div>
              <div className="card-label">{t("remittance.approvedToday")}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>{t("remittance.pendingApprovals")} <span className="badge">8</span></span>}>
            <div className="filter-section mb-3">
              <Dropdown placeholder={t("remittance.transactionType")} options={transactionTypeOptions} className="mr-2" />
              <Dropdown placeholder={t("remittance.priority")} options={priorityOptions} className="mr-2" />
              <Dropdown placeholder={t("remittance.age")} options={[
                { label: "All", value: "All" },
                { label: "< 1 Day", value: "1" },
                { label: "1-3 Days", value: "3" },
                { label: "3-7 Days", value: "7" },
                { label: "> 7 Days", value: "7+" }
              ]} className="mr-2" />
              <Button label={t("remittance.filter")} icon="pi pi-filter" className="p-button-primary mr-2" />
              <Button label={t("remittance.clear")} icon="pi pi-times" className="p-button-secondary" />
            </div>

            <DataTable
              value={pendingApprovals}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              stripedRows
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="priority" header="" body={priorityBodyTemplate} style={{ width: '5rem' }} />
              <Column field="referenceNo" header={t("remittance.referenceNo")} />
              <Column field="transactionType" header={t("remittance.type")} />
              <Column field="initiator" header={t("remittance.initiatedBy")} />
              <Column field="submissionDate" header={t("remittance.submitted")} />
              <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
              <Column field="description" header={t("remittance.description")} />
              <Column field="slaHours" header="SLA" body={slaBodyTemplate} />
              <Column field="currentLevel" header={t("remittance.level")} />
              <Column header={t("remittance.actions")} body={actionsBodyTemplate} style={{ width: '150px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button label={t("remittance.bulkApprove")} icon="pi pi-check" className="p-button-success mr-2" />
                <Button label={t("remittance.bulkReject")} icon="pi pi-times" className="p-button-danger mr-2" />
                <Button label={t("remittance.delegate")} icon="pi pi-forward" className="p-button-secondary" />
              </div>
            )}
          </TabPanel>

          <TabPanel header={t("remittance.approvalHistory")}>
            <div className="filter-section mb-3">
              <Calendar placeholder={t("remittance.dateRange")} selectionMode="range" className="mr-2" />
              <Dropdown placeholder={t("remittance.action")} options={[
                { label: "All", value: "All" },
                { label: "Approved", value: "Approved" },
                { label: "Rejected", value: "Rejected" },
                { label: "Delegated", value: "Delegated" }
              ]} className="mr-2" />
              <Button label={t("remittance.search")} icon="pi pi-search" />
            </div>

            <DataTable value={approvalHistory} stripedRows>
              <Column field="referenceNo" header={t("remittance.referenceNo")} />
              <Column field="transactionType" header={t("remittance.type")} />
              <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
              <Column field="action" header={t("remittance.action")} body={actionBodyTemplate} />
              <Column field="actionDate" header={t("remittance.actionDate")} />
              <Column field="remarks" header={t("remittance.remarks")} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.delegation")}>
            <div className="delegation-section">
              <div className="section-header mb-3">
                <h3>{t("remittance.activeDelegations")}</h3>
                <Button
                  label={t("remittance.addNewDelegation")}
                  icon="pi pi-plus"
                  onClick={() => setShowDelegationDialog(true)}
                />
              </div>

              <DataTable value={activeDelegations} stripedRows>
                <Column field="delegatedTo" header={t("remittance.delegatedTo")} />
                <Column field="fromDate" header={t("remittance.fromDate")} />
                <Column field="toDate" header={t("remittance.toDate")} />
                <Column field="scope" header={t("remittance.scope")} />
                <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
                <Column header={t("remittance.actions")} body={delegationActionsTemplate} />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header={t("remittance.approvalDetails")}
        visible={showDetailDialog}
        style={{ width: '60vw' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
      >
        {selectedTransaction && (
          <div className="approval-details">
            <div className="detail-section">
              <h4>{t("remittance.transactionInformation")}</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>{t("remittance.referenceNo")}:</label>
                  <span>{selectedTransaction.referenceNo}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.type")}:</label>
                  <span>{selectedTransaction.transactionType}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.amount")}:</label>
                  <span>{formatCurrency(selectedTransaction.amount)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.initiatedBy")}:</label>
                  <span>{selectedTransaction.initiator}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h4>{t("remittance.approvalAction")}</h4>
              <div className="approval-action">
                <div className="p-field-radiobutton mb-2">
                  <RadioButton
                    inputId="approve"
                    value="approve"
                    onChange={(e) => setApprovalAction(e.value)}
                    checked={approvalAction === 'approve'}
                  />
                  <label htmlFor="approve" className="ml-2">{t("remittance.approve")}</label>
                </div>
                <div className="p-field-radiobutton mb-2">
                  <RadioButton
                    inputId="reject"
                    value="reject"
                    onChange={(e) => setApprovalAction(e.value)}
                    checked={approvalAction === 'reject'}
                  />
                  <label htmlFor="reject" className="ml-2">{t("common.reject")}</label>
                </div>
                <div className="p-field-radiobutton">
                  <RadioButton
                    inputId="hold"
                    value="hold"
                    onChange={(e) => setApprovalAction(e.value)}
                    checked={approvalAction === 'hold'}
                  />
                  <label htmlFor="hold" className="ml-2">{t("remittance.holdForReview")}</label>
                </div>
              </div>

              {(approvalAction === 'reject' || approvalAction === 'hold') && (
                <div className="mt-3">
                  <label>{t("remittance.comments")} *</label>
                  <InputTextarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header={t("remittance.addNewDelegation")}
        visible={showDelegationDialog}
        style={{ width: '50vw' }}
        footer={delegationDialogFooter}
        onHide={() => setShowDelegationDialog(false)}
      >
        <div className="delegation-form">
          <div className="p-fluid p-formgrid p-grid">
            <div className="p-field p-col-12 p-md-6">
              <label>{t("remittance.delegateTo")} *</label>
              <Dropdown
                value={delegationData.delegateTo}
                options={userOptions}
                onChange={(e) => setDelegationData({ ...delegationData, delegateTo: e.value })}
                placeholder={t("remittance.selectUser")}
              />
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>{t("remittance.delegationPeriod")} *</label>
              <div className="date-range">
                <Calendar
                  value={delegationData.fromDate}
                  onChange={(e) => setDelegationData({ ...delegationData, fromDate: e.value })}
                  placeholder={t("remittance.fromDate")}
                  className="mr-2"
                />
                <Calendar
                  value={delegationData.toDate}
                  onChange={(e) => setDelegationData({ ...delegationData, toDate: e.value })}
                  placeholder={t("remittance.toDate")}
                />
              </div>
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>{t("remittance.transactionTypes")}</label>
              <MultiSelect
                value={delegationData.transTypes}
                options={transactionTypeOptions}
                onChange={(e) => setDelegationData({ ...delegationData, transTypes: e.value })}
                display="chip"
              />
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>{t("remittance.amountLimit")}</label>
              <InputNumber
                value={delegationData.amountLimit}
                onValueChange={(e) => setDelegationData({ ...delegationData, amountLimit: e.value })}
                mode="currency"
                currency={currencyCode}
              />
            </div>
            <div className="p-field p-col-12">
              <label>{t("remittance.reason")} *</label>
              <InputTextarea
                value={delegationData.reason}
                onChange={(e) => setDelegationData({ ...delegationData, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RemittanceApproval;