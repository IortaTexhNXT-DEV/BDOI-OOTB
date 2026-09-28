import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const RemittanceAdjustments = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [newAdjustment, setNewAdjustment] = useState({
    referenceNo: "",
    adjustmentType: "",
    amount: null,
    description: "",
    reason: "",
    effectiveDate: null
  });

  const pendingAdjustments = [
    {
      id: 1,
      referenceNo: "ADJ20250926001",
      adjustmentType: "Premium Adjustment",
      policyNo: "POL123456789",
      clientName: "ABC Insurance Co",
      originalAmount: 125000,
      adjustmentAmount: -5000,
      newAmount: 120000,
      reason: "Policy correction due to coverage change",
      requestedBy: "John Smith",
      requestDate: "2025-09-26 10:30",
      status: "Pending Approval",
      approvalLevel: 1,
      dueDate: "2025-09-28"
    },
    {
      id: 2,
      referenceNo: "ADJ20250926002",
      adjustmentType: "Commission Adjustment",
      policyNo: "POL987654321",
      clientName: "XYZ Corp",
      originalAmount: 87500,
      adjustmentAmount: 2500,
      newAmount: 90000,
      reason: "Additional commission for renewal incentive",
      requestedBy: "Sarah Johnson",
      requestDate: "2025-09-26 09:15",
      status: "Approved",
      approvalLevel: 2,
      dueDate: "2025-09-27"
    },
    {
      id: 3,
      referenceNo: "ADJ20250925003",
      adjustmentType: "Fee Waiver",
      policyNo: "POL456789123",
      clientName: "DEF Ltd",
      originalAmount: 1200,
      adjustmentAmount: -200,
      newAmount: 1000,
      reason: "Loyalty customer fee waiver",
      requestedBy: "Mike Wilson",
      requestDate: "2025-09-25 14:45",
      status: "Processing",
      approvalLevel: 1,
      dueDate: "2025-09-29"
    }
  ];

  const adjustmentHistory = [
    {
      referenceNo: "ADJ20250920001",
      adjustmentType: "Tax Adjustment",
      amount: 1500,
      status: "Completed",
      processedDate: "2025-09-20 15:30",
      processedBy: "Finance Team"
    },
    {
      referenceNo: "ADJ20250919002",
      adjustmentType: "Refund Processing",
      amount: -3200,
      status: "Completed",
      processedDate: "2025-09-19 10:15",
      processedBy: "System Auto"
    },
    {
      referenceNo: "ADJ20250918003",
      adjustmentType: "Penalty Waiver",
      amount: -800,
      status: "Rejected",
      processedDate: "2025-09-18 16:45",
      processedBy: "Manager Review"
    }
  ];

  const adjustmentTypeOptions = [
    { label: "Premium Adjustment", value: "Premium Adjustment" },
    { label: "Commission Adjustment", value: "Commission Adjustment" },
    { label: "Tax Adjustment", value: "Tax Adjustment" },
    { label: "Fee Waiver", value: "Fee Waiver" },
    { label: "Penalty Adjustment", value: "Penalty Adjustment" },
    { label: "Refund Processing", value: "Refund Processing" }
  ];

  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Pending Approval", value: "Pending Approval" },
    { label: "Approved", value: "Approved" },
    { label: "Processing", value: "Processing" },
    { label: "Completed", value: "Completed" },
    { label: "Rejected", value: "Rejected" }
  ];

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Pending Approval': return 'warning';
        case 'Approved': return 'success';
        case 'Processing': return 'info';
        case 'Completed': return 'success';
        case 'Rejected': return 'danger';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const amountBodyTemplate = (rowData) => {
    const color = rowData.adjustmentAmount >= 0 ? 'green' : 'red';
    const prefix = rowData.adjustmentAmount >= 0 ? '+' : '';
    return (
      <span style={{ color }}>
        {prefix}{"\u20B1"}{Math.abs(rowData.adjustmentAmount).toLocaleString()}
      </span>
    );
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View Details"
          onClick={() => {
            setSelectedAdjustment(rowData);
            setShowDetailDialog(true);
          }}
        />
        {rowData.status === 'Pending Approval' && (
          <>
            <Button
              icon="pi pi-check"
              className="p-button-rounded p-button-success p-button-text"
              tooltip="Approve"
            />
            <Button
              icon="pi pi-times"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Reject"
            />
          </>
        )}
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip="Edit"
          disabled={rowData.status === 'Completed'}
        />
      </div>
    );
  };

  const handleCreateAdjustment = () => {
    console.log("Creating new adjustment:", newAdjustment);
    setShowAdjustmentDialog(false);
    setNewAdjustment({
      referenceNo: "",
      adjustmentType: "",
      amount: null,
      description: "",
      reason: "",
      effectiveDate: null
    });
  };

  const handleBackToMaster = () => {
    navigate("/master/finance/remittance");
  };

  const adjustmentDialogFooter = (
    <div>
      <Button
        label="Cancel"
        icon="pi pi-times"
        onClick={() => setShowAdjustmentDialog(false)}
        className="p-button-text"
      />
      <Button
        label="Create Adjustment"
        icon="pi pi-check"
        onClick={handleCreateAdjustment}
        autoFocus
      />
    </div>
  );

  const detailDialogFooter = (
    <div>
      <Button
        label="Close"
        icon="pi pi-times"
        onClick={() => setShowDetailDialog(false)}
        className="p-button-text"
      />
    </div>
  );

  return (
    <div className="remittance-adjustments">
      <div className="header-section">
        <h2>{t("remittance.remittanceAdjustments")}</h2>
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
            <div className="card-icon orange">
              <i className="pi pi-clock" />
            </div>
            <div className="card-details">
              <div className="card-value">5</div>
              <div className="card-label">Pending Adjustments</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-dollar" />
            </div>
            <div className="card-details">
              <div className="card-value">{"\u20B1"}12,300</div>
              <div className="card-label">Total Adjustment Value</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon green">
              <i className="pi pi-check" />
            </div>
            <div className="card-details">
              <div className="card-value">8</div>
              <div className="card-label">Completed Today</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon red">
              <i className="pi pi-exclamation-triangle" />
            </div>
            <div className="card-details">
              <div className="card-value">2</div>
              <div className="card-label">Overdue</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="table-toolbar">
          <Button
            label="New Adjustment"
            icon="pi pi-plus"
            className="p-button-primary"
            onClick={() => setShowAdjustmentDialog(true)}
          />
          <div className="filter-section">
            <Dropdown
              placeholder="Adjustment Type"
              options={adjustmentTypeOptions}
              className="mr-2"
            />
            <Dropdown
              placeholder="Status"
              options={statusOptions}
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Active Adjustments <span className="badge">5</span></span>}>
            <DataTable
              value={pendingAdjustments}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              stripedRows
              responsiveLayout="scroll"
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="referenceNo" header="Reference No" />
              <Column field="adjustmentType" header="Type" />
              <Column field="policyNo" header="Policy No" />
              <Column field="clientName" header="Client" />
              <Column
                field="originalAmount"
                header="Original Amount"
                body={(data) => `\u20B1${data.originalAmount.toLocaleString()}`}
              />
              <Column
                field="adjustmentAmount"
                header="Adjustment"
                body={amountBodyTemplate}
              />
              <Column
                field="newAmount"
                header="New Amount"
                body={(data) => `\u20B1${data.newAmount.toLocaleString()}`}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="dueDate" header="Due Date" />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '120px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button label="Bulk Approve" icon="pi pi-check" className="p-button-success mr-2" />
                <Button label="Bulk Reject" icon="pi pi-times" className="p-button-danger mr-2" />
                <Button label="Export Selected" icon="pi pi-download" className="p-button-secondary" />
              </div>
            )}
          </TabPanel>

          <TabPanel header="Adjustment History">
            <DataTable value={adjustmentHistory} stripedRows>
              <Column field="referenceNo" header="Reference No" />
              <Column field="adjustmentType" header="Type" />
              <Column
                field="amount"
                header="Amount"
                body={(data) => {
                  const color = data.amount >= 0 ? 'green' : 'red';
                  const prefix = data.amount >= 0 ? '+' : '';
                  return (
                    <span style={{ color }}>
                      {prefix}{"\u20B1"}{Math.abs(data.amount).toLocaleString()}
                    </span>
                  );
                }}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="processedDate" header="Processed Date" />
              <Column field="processedBy" header="Processed By" />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header="Create New Adjustment"
        visible={showAdjustmentDialog}
        style={{ width: '60vw' }}
        footer={adjustmentDialogFooter}
        onHide={() => setShowAdjustmentDialog(false)}
      >
        <div className="adjustment-form">
          <div className="p-fluid p-formgrid p-grid">
            <div className="p-field p-col-12 p-md-6">
              <label>Reference No *</label>
              <InputText
                value={newAdjustment.referenceNo}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, referenceNo: e.target.value })}
                placeholder="Auto-generated"
                disabled
              />
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>Adjustment Type *</label>
              <Dropdown
                value={newAdjustment.adjustmentType}
                options={adjustmentTypeOptions}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, adjustmentType: e.value })}
                placeholder="Select Type"
              />
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>Adjustment Amount *</label>
              <InputNumber
                value={newAdjustment.amount}
                onValueChange={(e) => setNewAdjustment({ ...newAdjustment, amount: e.value })}
                mode="currency"
                currency={currencyCode}
                placeholder="Enter amount"
              />
            </div>
            <div className="p-field p-col-12 p-md-6">
              <label>Effective Date *</label>
              <Calendar
                value={newAdjustment.effectiveDate}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, effectiveDate: e.value })}
                placeholder="Select date"
              />
            </div>
            <div className="p-field p-col-12">
              <label>Description *</label>
              <InputText
                value={newAdjustment.description}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div className="p-field p-col-12">
              <label>Reason for Adjustment *</label>
              <InputTextarea
                value={newAdjustment.reason}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                rows={3}
                placeholder="Detailed reason for this adjustment"
              />
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        header="Adjustment Details"
        visible={showDetailDialog}
        style={{ width: '70vw' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
      >
        {selectedAdjustment && (
          <div className="adjustment-details">
            <div className="detail-section">
              <h4>Basic Information</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Reference No:</label>
                  <span>{selectedAdjustment.referenceNo}</span>
                </div>
                <div className="detail-item">
                  <label>Type:</label>
                  <span>{selectedAdjustment.adjustmentType}</span>
                </div>
                <div className="detail-item">
                  <label>Policy No:</label>
                  <span>{selectedAdjustment.policyNo}</span>
                </div>
                <div className="detail-item">
                  <label>Client:</label>
                  <span>{selectedAdjustment.clientName}</span>
                </div>
              </div>
            </div>
            <div className="detail-section">
              <h4>Financial Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Original Amount:</label>
                  <span>{"\u20B1"}{selectedAdjustment.originalAmount?.toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <label>Adjustment Amount:</label>
                  <span style={{ color: selectedAdjustment.adjustmentAmount >= 0 ? 'green' : 'red' }}>
                    {selectedAdjustment.adjustmentAmount >= 0 ? '+' : ''}
                    {"\u20B1"}{Math.abs(selectedAdjustment.adjustmentAmount).toLocaleString()}
                  </span>
                </div>
                <div className="detail-item">
                  <label>New Amount:</label>
                  <span>{"\u20B1"}{selectedAdjustment.newAmount?.toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <Tag value={selectedAdjustment.status} severity={statusBodyTemplate(selectedAdjustment).props.severity} />
                </div>
              </div>
            </div>
            <div className="detail-section">
              <h4>Request Information</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Requested By:</label>
                  <span>{selectedAdjustment.requestedBy}</span>
                </div>
                <div className="detail-item">
                  <label>Request Date:</label>
                  <span>{selectedAdjustment.requestDate}</span>
                </div>
                <div className="detail-item">
                  <label>Reason:</label>
                  <span>{selectedAdjustment.reason}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default RemittanceAdjustments;