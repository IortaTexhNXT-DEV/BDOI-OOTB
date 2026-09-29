import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { TabView, TabPanel } from "primereact/tabview";
import { MultiSelect } from "primereact/multiselect";
import { ProgressSpinner } from "primereact/progressspinner";
import { Steps } from "primereact/steps";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { useNavigate } from "react-router-dom";
import SvgAdd from "../../../assets/icons/SvgAdd";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import InputField from "../../../components/InputField";
import { incentiveMockData, incentiveCrudOperations } from "../../../services/mockData/incentiveMockData";
import "./index.scss";

const Calculations = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const toast = useRef(null);

  // State management
  const [calculations, setCalculations] = useState(incentiveMockData.calculationBatches);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(false);

  // New calculation state
  const [showNewCalculationDialog, setShowNewCalculationDialog] = useState(false);
  const [calculationStep, setCalculationStep] = useState(0);
  const [newCalculation, setNewCalculation] = useState({
    period: "",
    selectedPrograms: [],
    description: "",
    scheduledDate: new Date()
  });

  // Detail view state
  const [selectedCalculation, setSelectedCalculation] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [calculationDetails, setCalculationDetails] = useState(null);

  // Options
  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Pending Approval", value: "Pending Approval" },
    { label: "Approved", value: "Approved" },
    { label: "Paid", value: "Paid" },
    { label: "Rejected", value: "Rejected" }
  ];

  const periodOptions = [
    { label: "January 2025", value: "January 2025" },
    { label: "December 2024", value: "December 2024" },
    { label: "November 2024", value: "November 2024" },
    { label: "October 2024", value: "October 2024" }
  ];

  const programOptions = incentiveMockData.programs
    .filter(p => p.status === "Active")
    .map(p => ({ label: p.programName, value: p.programCode }));

  // Breadcrumb items
  const items = [
    { label: t("incentive.incentive"), url: "/incentive" },
    { label: t("incentive.calculations"), url: "/incentive/calculations" }
  ];

  const home = { label: t("incentive.dashboard") };

  // Steps for new calculation
  const calculationSteps = [
    { label: t("incentive.periodSelection") },
    { label: t("incentive.programSelection") },
    { label: t("incentive.reviewSubmit") }
  ];

  // Filter data
  const filteredCalculations = calculations.filter((calc) => {
    const matchesSearch =
      calc.batchId.toLowerCase().includes(search.toLowerCase()) ||
      calc.period.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === "All" || calc.status === selectedStatus;
    const matchesPeriod = !selectedPeriod || calc.period === selectedPeriod;

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  // Handle new calculation
  const handleNewCalculation = () => {
    setNewCalculation({
      period: "",
      selectedPrograms: [],
      description: "",
      scheduledDate: new Date()
    });
    setCalculationStep(0);
    setShowNewCalculationDialog(true);
  };

  const handleNextStep = () => {
    if (calculationStep < calculationSteps.length - 1) {
      setCalculationStep(calculationStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (calculationStep > 0) {
      setCalculationStep(calculationStep - 1);
    }
  };

  const handleSubmitCalculation = async () => {
    setLoading(true);
    try {
      const result = await incentiveCrudOperations.runCalculation(
        newCalculation.period,
        newCalculation.selectedPrograms
      );

      const newBatch = {
        batchId: result.data.batchId,
        period: newCalculation.period,
        calculationDate: new Date().toISOString().split('T')[0],
        programsIncluded: newCalculation.selectedPrograms,
        totalAmount: result.data.totalAmount,
        agentCount: result.data.agentCount,
        status: "Pending Approval",
        submittedBy: "Current User",
        submittedDate: new Date().toISOString(),
        details: []
      };

      setCalculations([newBatch, ...calculations]);
      setShowNewCalculationDialog(false);

      toast.current.show({
        severity: "success",
        summary: t("incentive.calculationStarted"),
        detail: t("incentive.batchCreatedPendingApproval", { batchId: result.data.batchId }),
        life: 5000
      });
    } catch (error) {
      toast.current.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail: t("incentive.failedToStartCalculation"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle view details
  const handleViewDetails = async (calculation) => {
    setSelectedCalculation(calculation);
    setLoading(true);
    try {
      // Simulate loading calculation details
      const details = {
        ...calculation,
        executionLog: [
          {
            timestamp: "2025-02-01 10:00:00",
            action: "Calculation batch created",
            details: "Batch initialized for processing"
          },
          {
            timestamp: "2025-02-01 10:05:00",
            action: "Program data retrieved",
            details: "Retrieved agent assignments and performance data"
          },
          {
            timestamp: "2025-02-01 10:10:00",
            action: "Calculations completed",
            details: "Incentive amounts calculated for all eligible agents"
          }
        ]
      };
      setCalculationDetails(details);
      setDetailsVisible(true);
    } catch (error) {
      toast.current.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail: t("incentive.failedToLoadCalculationDetails"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle approval actions
  const handleApprove = (calculation) => {
    confirmDialog({
      message: t("incentive.approveCalculationBatch", { batchId: calculation.batchId }),
      header: t("incentive.confirmApproval"),
      icon: "pi pi-check",
      accept: async () => {
        setLoading(true);
        try {
          await incentiveCrudOperations.approveCalculation(calculation.batchId);
          setCalculations(calculations.map(c =>
            c.batchId === calculation.batchId
              ? { ...c, status: "Approved", approvedBy: "Current User", approvalDate: new Date().toISOString() }
              : c
          ));

          toast.current.show({
            severity: "success",
            summary: t("incentive.approved"),
            detail: t("incentive.calculationBatchApproved", { batchId: calculation.batchId }),
            life: 3000
          });
        } catch (error) {
          toast.current.show({
            severity: "error",
            summary: t("common.error", "Error"),
            detail: t("incentive.failedToApproveCalculation"),
            life: 3000
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleReject = (calculation) => {
    confirmDialog({
      message: t("incentive.rejectCalculationBatch", { batchId: calculation.batchId }),
      header: t("incentive.confirmRejection"),
      icon: "pi pi-times",
      accept: () => {
        setCalculations(calculations.map(c =>
          c.batchId === calculation.batchId
            ? { ...c, status: "Rejected", rejectedBy: "Current User", rejectionDate: new Date().toISOString() }
            : c
        ));

        toast.current.show({
          severity: "warn",
          summary: t("incentive.rejected"),
          detail: t("incentive.calculationBatchRejected", { batchId: calculation.batchId }),
          life: 3000
        });
      }
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

  const dateBodyTemplate = (rowData) => {
    return new Date(rowData.calculationDate).toLocaleDateString();
  };

  const amountBodyTemplate = (rowData) => {
    return formatCurrency(rowData.totalAmount);
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon={<SvgEyeIcon />}
          className="view-details-button"
          onClick={() => handleViewDetails(rowData)}
          tooltip={t("incentive.viewDetails")}
        />
        {rowData.status === "Pending Approval" && (
          <>
            <Button
              icon="pi pi-check"
              className="approve-button"
              onClick={() => handleApprove(rowData)}
              tooltip={t("incentive.approve", "Approve")}
            />
            <Button
              icon="pi pi-times"
              className="reject-button"
              onClick={() => handleReject(rowData)}
              tooltip={t("common.reject", "Reject")}
            />
          </>
        )}
      </div>
    );
  };

  // Dialog footers
  const newCalculationFooter = (
    <div className="dialog-footer">
      <Button
        label={t("common.cancel")}
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setShowNewCalculationDialog(false)}
      />
      {calculationStep > 0 && (
        <Button
          label={t("incentive.previous")}
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={handlePrevStep}
        />
      )}
      {calculationStep < calculationSteps.length - 1 ? (
        <Button
          label={t("incentive.next")}
          icon="pi pi-arrow-right"
          onClick={handleNextStep}
          disabled={
            (calculationStep === 0 && !newCalculation.period) ||
            (calculationStep === 1 && newCalculation.selectedPrograms.length === 0)
          }
        />
      ) : (
        <Button
          label={t("incentive.startCalculation")}
          icon="pi pi-play"
          onClick={handleSubmitCalculation}
          loading={loading}
        />
      )}
    </div>
  );

  const detailsFooter = (
    <div className="dialog-footer">
      <Button
        label={t("incentive.close")}
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setDetailsVisible(false)}
      />
      {selectedCalculation?.status === "Pending Approval" && (
        <>
          <Button
            label={t("common.reject")}
            icon="pi pi-times"
            className="p-button-danger"
            onClick={() => {
              setDetailsVisible(false);
              handleReject(selectedCalculation);
            }}
          />
          <Button
            label={t("incentive.approve", "Approve")}
            icon="pi pi-check"
            onClick={() => {
              setDetailsVisible(false);
              handleApprove(selectedCalculation);
            }}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="container__calculations">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">{t("incentive.incentiveCalculations")}</div>
        <div className="add-button-container">
          <Button
            icon={<div className="pr-2"><SvgAdd /></div>}
            className="main__btn__action"
            onClick={handleNewCalculation}
          >
            {t("incentive.newCalculation")}
          </Button>
        </div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
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
                  placeholder="Search by batch ID or period..."
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
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            value={filteredCalculations}
            className="calculations-table"
            stripedRows
            paginator
            rows={10}
            loading={loading}
            emptyMessage="No calculations found"
          >
            <Column field="batchId" header="Batch ID" style={{ width: "15%" }} />
            <Column field="period" header="Period" style={{ width: "15%" }} />
            <Column
              body={dateBodyTemplate}
              header="Calculation Date"
              style={{ width: "12%" }}
            />
            <Column
              body={(data) => data.programsIncluded.length}
              header="Programs"
              style={{ width: "8%", textAlign: "center" }}
            />
            <Column
              body={amountBodyTemplate}
              header="Total Amount"
              style={{ width: "15%", textAlign: "right" }}
            />
            <Column
              field="agentCount"
              header="Agents"
              style={{ width: "8%", textAlign: "center" }}
            />
            <Column field="submittedBy" header="Submitted By" style={{ width: "12%" }} />
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

      {/* New Calculation Dialog */}
      <Dialog
        header="New Incentive Calculation"
        visible={showNewCalculationDialog}
        onHide={() => setShowNewCalculationDialog(false)}
        style={{ width: '70vw', maxWidth: '800px' }}
        footer={newCalculationFooter}
        maximizable
      >
        <div className="calculation-wizard">
          <Steps model={calculationSteps} activeIndex={calculationStep} />

          <div className="step-content">
            {calculationStep === 0 && (
              <div className="step-panel">
                <h3>Select Calculation Period</h3>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Period*</label>
                    <Dropdown
                      value={newCalculation.period}
                      options={periodOptions}
                      onChange={(e) => setNewCalculation({...newCalculation, period: e.value})}
                      placeholder="Select calculation period"
                    />
                  </div>
                  <div className="form-field">
                    <label>Description</label>
                    <InputText
                      value={newCalculation.description}
                      onChange={(e) => setNewCalculation({...newCalculation, description: e.target.value})}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>
            )}

            {calculationStep === 1 && (
              <div className="step-panel">
                <h3>Select Programs</h3>
                <div className="form-grid">
                  <div className="form-field full-width">
                    <label>Programs to Include*</label>
                    <MultiSelect
                      value={newCalculation.selectedPrograms}
                      options={programOptions}
                      onChange={(e) => setNewCalculation({...newCalculation, selectedPrograms: e.value})}
                      placeholder="Select programs to include in calculation"
                      display="chip"
                    />
                  </div>
                </div>
                <div className="program-info">
                  <p>Selected {newCalculation.selectedPrograms.length} program(s)</p>
                  <p className="note">Only active programs are available for calculation.</p>
                </div>
              </div>
            )}

            {calculationStep === 2 && (
              <div className="step-panel">
                <h3>Review & Submit</h3>
                <div className="review-section">
                  <div className="review-item">
                    <label>Period:</label>
                    <span>{newCalculation.period}</span>
                  </div>
                  <div className="review-item">
                    <label>Programs:</label>
                    <span>{newCalculation.selectedPrograms.length} selected</span>
                  </div>
                  <div className="review-item">
                    <label>Description:</label>
                    <span>{newCalculation.description || "No description"}</span>
                  </div>
                  <div className="review-item">
                    <label>Calculation Date:</label>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="warning-note">
                  <i className="pi pi-info-circle"></i>
                  <p>This calculation will process all eligible agents for the selected programs and period. The results will require approval before payout.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Calculation Details Dialog */}
      <Dialog
        header="Calculation Details"
        visible={detailsVisible}
        onHide={() => setDetailsVisible(false)}
        style={{ width: '80vw', maxWidth: '1000px' }}
        footer={detailsFooter}
        maximizable
      >
        {calculationDetails && (
          <TabView>
            <TabPanel header="Overview">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Batch ID:</label>
                  <span>{calculationDetails.batchId}</span>
                </div>
                <div className="detail-item">
                  <label>Period:</label>
                  <span>{calculationDetails.period}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <Tag
                    value={calculationDetails.status}
                    severity={
                      calculationDetails.status === "Approved" ? "success" :
                      calculationDetails.status === "Pending Approval" ? "warning" :
                      calculationDetails.status === "Paid" ? "info" : "danger"
                    }
                  />
                </div>
                <div className="detail-item">
                  <label>Total Amount:</label>
                  <span className="amount">
                    {formatCurrency(calculationDetails.totalAmount)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Agent Count:</label>
                  <span>{calculationDetails.agentCount}</span>
                </div>
                <div className="detail-item">
                  <label>Submitted By:</label>
                  <span>{calculationDetails.submittedBy}</span>
                </div>
              </div>
            </TabPanel>

            <TabPanel header={`Agent Details (${calculationDetails.details?.length || 0})`}>
              {calculationDetails.details && calculationDetails.details.length > 0 ? (
                <DataTable value={calculationDetails.details} className="detail-table">
                  <Column field="agentName" header="Agent Name" />
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
                  <p>No detailed calculation data available.</p>
                </div>
              )}
            </TabPanel>

            <TabPanel header="Execution Log">
              <div className="execution-log">
                {calculationDetails.executionLog?.map((log, index) => (
                  <div key={index} className="log-entry">
                    <div className="log-timestamp">{log.timestamp}</div>
                    <div className="log-content">
                      <div className="log-action">{log.action}</div>
                      <div className="log-details">{log.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </TabPanel>
          </TabView>
        )}
      </Dialog>
    </div>
  );
};

export default Calculations;