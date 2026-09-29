import React, { useEffect, useRef, useState } from "react";
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
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import remittanceService from "../../../services/remittanceService";
import { calendarDateFormat, dateBody, downloadCsv, isoDate, loadMasterOptions, showError, showSuccess, statusSeverity } from "../shared";
import { requiredErrors, hasErrors, errorSummary } from "../../../utility/requiredFields";
import FieldError from "../../../components/FieldError";
import "./index.scss";
import { promptText } from "../../../utility/dialogs";

const emptyAdjustment = {
  referenceNo: "",
  adjustmentType: "",
  amount: null,
  description: "",
  reason: "",
  effectiveDate: null
};
const ACTIVE_STATUSES = "Pending Approval,Approved";

const RemittanceAdjustments = () => {
  const { t } = useTranslation();
  const { currencyCode, formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [newAdjustment, setNewAdjustment] = useState(emptyAdjustment);
  const [adjustmentErrors, setAdjustmentErrors] = useState({});
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [adjustmentTypeOptions, setAdjustmentTypeOptions] = useState([]);
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Pending Approval", value: "Pending Approval" },
    { label: "Approved", value: "Approved" },
    { label: "Completed", value: "Completed" },
    { label: "Rejected", value: "Rejected" }
  ];

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const [active, history, queue] = await Promise.all([
        remittanceService.listAdjustments({ status: statusFilter === "All" ? ACTIVE_STATUSES : statusFilter, search: typeFilter || undefined, perPage: 200 }),
        remittanceService.adjustmentHistory(),
        remittanceService.listApprovals({ transactionType: "Adjustment" })
      ]);
      setPendingAdjustments(active || []);
      setAdjustmentHistory(history || []);
      setApprovals(queue || []);
      setSelectedRows([]);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
    loadMasterOptions("remittance-adjustment-type")
      .then((rows) => setAdjustmentTypeOptions(rows.map((r) => ({ label: r.label, value: r.label }))))
      .catch((e) => showError(toast, e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = isoDate(new Date());
  const summary = {
    pending: pendingAdjustments.filter((a) => a.status === "Pending Approval").length,
    totalValue: pendingAdjustments.reduce((s, a) => s + Math.abs(Number(a.adjustmentAmount || 0)), 0),
    completedToday: adjustmentHistory.filter((a) => a.status === "Completed" && String(a.processedDate || "").startsWith(today)).length,
    overdue: pendingAdjustments.filter((a) => a.dueDate && a.dueDate < today).length
  };

  const statusBodyTemplate = (rowData) => {
    return <Tag value={rowData.status} severity={statusSeverity(rowData.status)} />;
  };

  const signedAmount = (value) => {
    const color = value >= 0 ? 'green' : 'red';
    const prefix = value >= 0 ? '+' : '-';
    return (
      <span style={{ color }}>
        {prefix}{formatCurrency(Math.abs(value))}
      </span>
    );
  };

  const amountBodyTemplate = (rowData) => signedAmount(Number(rowData.adjustmentAmount || 0));

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      await loadAdjustments();
    } catch (e) {
      showError(toast, e);
    }
  };

  const approvalFor = (row) => {
    const approval = approvals.find((a) => a.entityId === row.id);
    if (!approval) throw new Error(`No pending approval found for ${row.referenceNo}`);
    return approval;
  };

  const approveRows = (rows) => run(() => Promise.all(rows.map((r) => remittanceService.approve(approvalFor(r).id))), `${rows.length} adjustment(s) approved`);

  const rejectRows = async (rows) => {
    const reason = await promptText("Reason for rejection", "");
    if (!reason) return;
    run(() => Promise.all(rows.map((r) => remittanceService.reject(approvalFor(r).id, reason))), `${rows.length} adjustment(s) rejected`);
  };

  const completeRow = (row) => run(() => remittanceService.completeAdjustment(row.id), `${row.referenceNo} processed`);

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
              onClick={() => approveRows([rowData])}
            />
            <Button
              icon="pi pi-times"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Reject"
              onClick={() => rejectRows([rowData])}
            />
          </>
        )}
        <Button
          icon="pi pi-check-square"
          className="p-button-rounded p-button-text"
          tooltip="Mark as Processed"
          disabled={rowData.status !== 'Approved'}
          onClick={() => completeRow(rowData)}
        />
      </div>
    );
  };

  const handleCreateAdjustment = async () => {
    const errors = requiredErrors(newAdjustment, [
      ["adjustmentType", "Adjustment type"],
      ["amount", "Adjustment amount"],
      ["effectiveDate", "Effective date"],
      ["description", "Description"],
      ["reason", "Reason for adjustment"],
    ]);
    setAdjustmentErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: "Validation", detail: errorSummary(errors), life: 4000 });
      return;
    }
    try {
      const created = await remittanceService.createAdjustment({
        adjustmentType: newAdjustment.adjustmentType,
        adjustmentAmount: newAdjustment.amount,
        effectiveDate: isoDate(newAdjustment.effectiveDate),
        description: newAdjustment.description,
        reason: newAdjustment.reason
      });
      showSuccess(toast, `${created.referenceNo} created (${created.status})`);
      setShowAdjustmentDialog(false);
      setNewAdjustment(emptyAdjustment);
      loadAdjustments();
    } catch (e) {
      showError(toast, e);
    }
  };

  const handleExportSelected = () => {
    downloadCsv(`adjustments_${today}.csv`, selectedRows, [
      { field: "referenceNo", header: "Reference No" },
      { field: "adjustmentType", header: "Type" },
      { field: "policyNo", header: "Policy No" },
      { field: "clientName", header: "Client" },
      { field: "originalAmount", header: "Original Amount" },
      { field: "adjustmentAmount", header: "Adjustment" },
      { field: "newAmount", header: "New Amount" },
      { field: "status", header: "Status" }
    ]);
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
      <Toast ref={toast} />
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
              <div className="card-value">{summary.pending}</div>
              <div className="card-label">Pending Adjustments</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-wallet" />
            </div>
            <div className="card-details">
              <div className="card-value">{formatCurrency(summary.totalValue)}</div>
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
              <div className="card-value">{summary.completedToday}</div>
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
              <div className="card-value">{summary.overdue}</div>
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
            onClick={() => {
              setAdjustmentErrors({});
              setShowAdjustmentDialog(true);
            }}
          />
          <div className="filter-section">
            <Dropdown
              placeholder="Adjustment Type"
              value={typeFilter}
              options={adjustmentTypeOptions}
              onChange={(e) => setTypeFilter(e.value)}
              showClear
              className="mr-2"
            />
            <Dropdown
              placeholder="Status"
              value={statusFilter}
              options={statusOptions}
              onChange={(e) => setStatusFilter(e.value)}
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" onClick={loadAdjustments} />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Active Adjustments <span className="badge">{pendingAdjustments.length}</span></span>}>
            <DataTable
              value={pendingAdjustments}
              loading={loading}
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
                body={(data) => formatCurrency(data.originalAmount)}
              />
              <Column
                field="adjustmentAmount"
                header="Adjustment"
                body={amountBodyTemplate}
              />
              <Column
                field="newAmount"
                header="New Amount"
                body={(data) => formatCurrency(data.newAmount)}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="dueDate" body={dateBody("dueDate")} header="Due Date" />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '120px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button label="Bulk Approve" icon="pi pi-check" className="p-button-success mr-2"
                  onClick={() => approveRows(selectedRows.filter((r) => r.status === 'Pending Approval'))} />
                <Button label="Bulk Reject" icon="pi pi-times" className="p-button-danger mr-2"
                  onClick={() => rejectRows(selectedRows.filter((r) => r.status === 'Pending Approval'))} />
                <Button label="Export Selected" icon="pi pi-download" className="p-button-secondary" onClick={handleExportSelected} />
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
                body={(data) => signedAmount(Number(data.amount || 0))}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="processedDate" body={dateBody("processedDate")} header="Processed Date" />
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
          <div className="p-fluid formgrid grid">
            <div className="p-field field col-12 md:col-6">
              <label>Reference No *</label>
              <InputText
                value={newAdjustment.referenceNo}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, referenceNo: e.target.value })}
                placeholder="Auto-generated"
                disabled
              />
            </div>
            <div className="p-field field col-12 md:col-6">
              <label>Adjustment Type *</label>
              <Dropdown
                value={newAdjustment.adjustmentType}
                options={adjustmentTypeOptions}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, adjustmentType: e.value })}
                placeholder="Select Type"
              />
              <FieldError error={adjustmentErrors.adjustmentType} />
            </div>
            <div className="p-field field col-12 md:col-6">
              <label>Adjustment Amount *</label>
              <InputNumber
                value={newAdjustment.amount}
                onValueChange={(e) => setNewAdjustment({ ...newAdjustment, amount: e.value })}
                mode="currency"
                currency={currencyCode}
                placeholder="Enter amount"
              />
              <FieldError error={adjustmentErrors.amount} />
            </div>
            <div className="p-field field col-12 md:col-6">
              <label>Effective Date *</label>
              <Calendar dateFormat={calendarDateFormat()}
                value={newAdjustment.effectiveDate}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, effectiveDate: e.value })}
                placeholder="Select date"
              />
              <FieldError error={adjustmentErrors.effectiveDate} />
            </div>
            <div className="p-field field col-12">
              <label>Description *</label>
              <InputText
                value={newAdjustment.description}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, description: e.target.value })}
                placeholder="Brief description"
              />
              <FieldError error={adjustmentErrors.description} />
            </div>
            <div className="p-field field col-12">
              <label>Reason for Adjustment *</label>
              <InputTextarea
                value={newAdjustment.reason}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                rows={3}
                placeholder="Detailed reason for this adjustment"
              />
              <FieldError error={adjustmentErrors.reason} />
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
                  <span>{formatCurrency(selectedAdjustment.originalAmount)}</span>
                </div>
                <div className="detail-item">
                  <label>Adjustment Amount:</label>
                  {amountBodyTemplate(selectedAdjustment)}
                </div>
                <div className="detail-item">
                  <label>New Amount:</label>
                  <span>{formatCurrency(selectedAdjustment.newAmount)}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <Tag value={selectedAdjustment.status} severity={statusSeverity(selectedAdjustment.status)} />
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
                  <span>{dateBody("requestDate")(selectedAdjustment)}</span>
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