import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";
import { Card } from "primereact/card";
import { Divider } from "primereact/divider";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import { useDispatch, useSelector } from "react-redux";
import { policyListDataMiddleWare } from "../store/policyMiddleWare";
import BatchRenewalService from "../../../services/batchRenewalService";
import { useNavigate } from "react-router-dom";
import { confirmAction, notifyError, notifySuccess, notifyWarn } from "../../../utility/dialogs";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import { currencySymbol } from "../../../utility/currencyConverter";

export default function BatchTable() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useRef(null);
  const { policyListData } = useSelector(({ policyMainReducers }) => ({
    policyListData: policyMainReducers?.policyListData || [],
  }));

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [sendingNotices, setSendingNotices] = useState(false);
  const [queueJobId, setQueueJobId] = useState(null);
  const [queueProgress, setQueueProgress] = useState(null);
  const initialBatchCriteria = {
    expiryDateFrom: null,
    expiryDateTo: null,
    insuranceCompanyName: "",
    productType: "",
    premiumMin: null,
    premiumMax: null,
    clientName: "",
    paymentStatus: "",
  };
  const [batchCriteria, setBatchCriteria] = useState(initialBatchCriteria);

  const pollingInterval = useRef(null);

  // Filter Options
  const paymentStatusOptions = [
    { label: "All", value: "" },
    { label: "Completed", value: "Completed" },
    { label: "Pending", value: "Pending" },
    { label: "Reviewing", value: "Reviewing" },
    { label: "Failed", value: "Failed" },
  ];

  const productTypeOptions = [
    { label: "All", value: "" },
    { label: "Motor Comprehensive", value: "Comprehensive Motor Insurance" },
    { label: "Fire and Allied Perils", value: "Fire and Allied Perils" },
  ];

  // Extract unique insurance companies from policy data
  const insuranceCompanyOptions = [
    { label: "All", value: "" },
    ...Array.from(
      new Set(policyListData.map((policy) => policy.insuranceCompanyName))
    )
      .filter(Boolean)
      .map((company) => ({ label: company, value: company })),
  ];

  useEffect(() => {
    dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200 }));
    fetchBatches();

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [dispatch]);

  const fetchBatches = async () => {
    setBatchesLoading(true);
    try {
      const response = await BatchRenewalService.getBatches();
      if (response.success) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleCriteriaChange = (field, value) => {
    setBatchCriteria((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const generatePolicyList = async () => {
    try {
      const result = await dispatch(
        policyListDataMiddleWare({
          filters: batchCriteria,
          page: 1,
          pageSize: 200,
        })
      );

      // Check if the action was fulfilled and get the data
      if (result.type.endsWith("/fulfilled")) {
        const transformedData = result.payload.transformedData;
        setSelectedPolicies(transformedData);
        console.log("Selected policies updated:", transformedData);
      } else {
        console.error("Failed to fetch policies:", result.payload);
      }
    } catch (error) {
      console.error("Error generating policy list:", error);
    }
  };

  const clearCriteria = () => {
    setBatchCriteria({
      expiryDateFrom: null,
      expiryDateTo: null,
      insuranceCompanyName: "",
      productType: "",
      premiumMin: null,
      premiumMax: null,
      clientName: "",
      paymentStatus: "",
    });
    setSelectedPolicies([]);
    dispatch(policyListDataMiddleWare({ page: 1, pageSize: 200 }));
  };

  const generateBatchRenewal = async () => {
    if (selectedPolicies.length === 0) {
      notifyWarn("Please select at least one policy for batch renewal.");
      return;
    }

    try {
      const batchData = {
        criteriaOption: batchCriteria,
        policies: selectedPolicies
          .filter((policy) => policy.isSelected)
          .map((policy) => ({
            policyId: policy.policyNumber,
            isSelected: false,
          })),
        status: "Draft",
      };

      const response = await BatchRenewalService.createBatch(batchData);
      if (response.success) {
        notifySuccess(
          `Batch renewal created successfully! Batch ID: ${response.data.batchId}`
        );
        setShowBatchModal(false);
        setSelectedPolicies([]);
        fetchBatches(); // Refresh the batches list
      }
    } catch (error) {
      console.error("Error creating batch:", error);
      notifyError("Failed to create batch renewal. Please try again.");
    }
  };

  const getStatusSeverity = (status) => {
    switch (status) {
      case "Draft":
        return "warning";
      case "Scheduled":
        return "info";
      case "Processing":
        return "warning";
      case "Completed":
        return "success";
      case "Cancelled":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Draft":
        return "pi pi-file";
      case "Scheduled":
        return "pi pi-clock";
      case "Processing":
        return "pi pi-spin pi-spinner";
      case "Completed":
        return "pi pi-check";
      case "Cancelled":
        return "pi pi-times";
      default:
        return "pi pi-circle";
    }
  };

  const getStatusLabel = (batch) => {
    const { status, processedCount, totalPolicies } = batch;

    // For Processing status, just show "Processing" (don't show counts while actively sending)
    if (status === "Processing") {
      return "Processing";
    }

    // For Completed status, show if it was partial completion
    if (status === "Completed" && processedCount < totalPolicies) {
      return `Partially Completed (${processedCount}/${totalPolicies})`;
    }

    // For Completed status with full completion
    if (status === "Completed" && processedCount >= totalPolicies) {
      return "Completed";
    }

    return status;
  };

  const getNoticeStatusSeverity = (status) => {
    switch (status) {
      case "NotSent":
        return "secondary";
      case "Queued":
        return "warning";
      case "Sent":
        return "success";
      case "Failed":
        return "danger";
      default:
        return "secondary";
    }
  };

  const handleViewBatchDetails = (batch) => {
    setSelectedBatch(batch);
    setShowBatchDetailsModal(true);
  };

  const formatDate = (dateString) => {
    return formatAppDate(dateString);
  };

  const pollQueueStatus = async (jobId, batchId) => {
    try {
      const response = await BatchRenewalService.getQueueJobStatus(jobId);
      if (response.success) {
        const job = response.data;
        setQueueProgress(job);

        if (job.status === "completed") {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
          setSendingNotices(false);
          setQueueProgress(null);

          toast.current.show({
            severity: "success",
            summary: "Notices Sent",
            detail: `Sent ${job.progress.succeeded} of ${job.progress.total} renewal notices successfully.`,
            life: 5000,
          });

          await fetchBatchDetails(batchId);
          await fetchBatches();
        } else if (job.status === "failed") {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
          setSendingNotices(false);
          setQueueProgress(null);

          toast.current.show({
            severity: "error",
            summary: "Sending Failed",
            detail: "Failed to send renewal notices. Please try again.",
            life: 5000,
          });
        }
      }
    } catch (error) {
      console.error("Error polling queue status:", error);

      // Job not found (likely completed very fast or server restarted)
      // Stop polling and refresh to see results
      if (
        error.response?.status === 404 ||
        error.message?.includes("not found")
      ) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
        setSendingNotices(false);
        setQueueProgress(null);

        toast.current.show({
          severity: "info",
          summary: "Processing Complete",
          detail: "Renewal notices processed. Refreshing batch details...",
          life: 3000,
        });

        await fetchBatchDetails(batchId);
        await fetchBatches();
      }
    }
  };

  const fetchBatchDetails = async (batchId) => {
    try {
      const response = await BatchRenewalService.getBatchById(batchId);
      if (response.success) {
        setSelectedBatch(response.data);
      }
    } catch (error) {
      console.error("Error fetching batch details:", error);
    }
  };

  const sendRenewalNotice = async () => {
    const selectedCount = selectedBatch.policies.filter(
      (policy) => policy.isSelected
    ).length;

    if (selectedCount === 0) {
      toast.current.show({
        severity: "warn",
        summary: "No Policies Selected",
        detail: "Please select at least one policy to send renewal notices.",
        life: 4000,
      });
      return;
    }

    setSendingNotices(true);
    setQueueProgress(null);

    try {
      const payloadSendNotice = {
        batchId: selectedBatch.batchId,
        selectedPolicyIds: selectedBatch.policies
          .filter(
            (policy) => policy.isSelected && policy.noticeStatus === "NotSent"
          )
          .map((policy) => policy.policyId),
      };

      const response = await BatchRenewalService.sendRenewalNotices(
        payloadSendNotice
      );

      if (response.success) {
        const jobId = response.data.jobId;
        setQueueJobId(jobId);

        toast.current.show({
          severity: "info",
          summary: "Queued for Processing",
          detail: `${selectedCount} renewal notices queued. Processing in background...`,
          life: 4000,
        });

        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }

        pollingInterval.current = setInterval(() => {
          pollQueueStatus(jobId, selectedBatch.batchId);
        }, 1000);
      } else {
        setSendingNotices(false);
        toast.current.show({
          severity: "error",
          summary: "Queue Failed",
          detail: response.message || "Failed to queue renewal notices.",
          life: 5000,
        });
      }
    } catch (error) {
      setSendingNotices(false);
      console.error("Error sending renewal notice:", error);
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "An error occurred while sending notices. Please try again.",
        life: 5000,
      });
    }
  };

  const retryFailedNotices = async () => {
    if (!selectedBatch) return;

    const failedCount = selectedBatch.policies.filter(
      (policy) => policy.noticeStatus === "Failed"
    ).length;

    if (failedCount === 0) {
      toast.current.show({
        severity: "info",
        summary: "No Failed Notices",
        detail: "There are no failed notices to retry.",
        life: 4000,
      });
      return;
    }

    setSendingNotices(true);
    setQueueProgress(null);

    try {
      const response = await BatchRenewalService.retryFailedNotices(
        selectedBatch.batchId
      );

      if (response.success) {
        const jobId = response.data.jobId;
        setQueueJobId(jobId);

        toast.current.show({
          severity: "info",
          summary: "Retrying Failed Notices",
          detail: `Retrying ${failedCount} failed notices...`,
          life: 4000,
        });

        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }

        pollingInterval.current = setInterval(() => {
          pollQueueStatus(jobId, selectedBatch.batchId);
        }, 1000);
      } else {
        setSendingNotices(false);
        toast.current.show({
          severity: "error",
          summary: "Retry Failed",
          detail: response.message || "Failed to retry notices.",
          life: 5000,
        });
      }
    } catch (error) {
      setSendingNotices(false);
      console.error("Error retrying failed notices:", error);
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "An error occurred while retrying. Please try again.",
        life: 5000,
      });
    }
  };

  const generateReport = async () => {
    if (!selectedBatch?.batchId) {
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "No batch selected.",
        life: 3000,
      });
      return;
    }

    try {
      toast.current.show({
        severity: "info",
        summary: "Generating Report",
        detail: "Please wait while the report is being generated...",
        life: 3000,
      });

      const blob = await BatchRenewalService.generateBatchReport(
        selectedBatch.batchId
      );

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `renewal-batch-${selectedBatch.batchId}-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.current.show({
        severity: "success",
        summary: "Report Generated",
        detail: "Batch report downloaded successfully.",
        life: 3000,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      let errorMessage = "Failed to generate report. Please try again.";

      // Handle error response - check if it's a blob (error response from server)
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const jsonError = JSON.parse(text);
          errorMessage = jsonError.message || errorMessage;
        } catch (parseError) {
          // If parsing fails, use default message
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: errorMessage,
        life: 5000,
      });
    }
  };

  return (
    <div>
      <Toast ref={toast} />

      <div className="flex justify-content-between align-items-center mb-4">
        <h3>{t("batchRenewal.title")}</h3>
        <div className="flex gap-2">
          <Button
            label={t("batchRenewal.refresh")}
            icon="pi pi-refresh"
            onClick={fetchBatches}
            className="p-button-outlined"
            loading={batchesLoading}
          />
          <Button
            label={t("batchRenewal.createBatch")}
            icon="pi pi-plus"
            onClick={() => {
              setShowBatchModal(true);
              clearCriteria();
            }}
            className="p-button-primary"
          />
        </div>
      </div>

      {batches.length > 0 ? (
        <Card>
          <DataTable
            value={batches}
            loading={batchesLoading}
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25]}
            className="p-datatable-sm"
            emptyMessage="No batches found"
          >
            <Column
              field="batchId"
              header="Batch ID"
              sortable
              style={{ minWidth: "150px" }}
            />
            <Column
              field="status"
              header="Status"
              sortable
              body={(rowData) => (
                <Tag
                  value={getStatusLabel(rowData)}
                  severity={getStatusSeverity(rowData.status)}
                  icon={getStatusIcon(rowData.status)}
                />
              )}
            />
            <Column
              field="totalPolicies"
              header="Total Policies"
              sortable
              body={(rowData) => (
                <div className="text-center">
                  <span className="font-semibold">{rowData.totalPolicies}</span>
                </div>
              )}
            />
            <Column
              field="processedCount"
              header="Processed"
              sortable
              body={(rowData) => (
                <div className="text-center">
                  <span className="font-semibold">
                    {rowData.processedCount}
                  </span>
                  <div className="mt-1">
                    <ProgressBar
                      value={
                        (rowData.processedCount / rowData.totalPolicies) * 100
                      }
                      style={{ height: "6px" }}
                    />
                  </div>
                </div>
              )}
            />
            <Column
              field="createdAt"
              header="Created Date"
              sortable
              body={(rowData) => formatDate(rowData.createdAt)}
            />
            <Column
              header="Actions"
              body={(rowData) => (
                <div className="flex gap-2">
                  <Button
                    icon="pi pi-eye"
                    className="p-button-outlined p-button-sm"
                    tooltip="View Details"
                    onClick={() => handleViewBatchDetails(rowData)}
                  />
                  <Button
                    icon="pi pi-trash"
                    className="p-button-outlined p-button-sm p-button-danger"
                    tooltip="Delete Batch"
                    onClick={async () => {
                      if (
                        await confirmAction(
                          "Are you sure you want to delete this batch?"
                        )
                      ) {
                        // Implement delete functionality
                        console.log("Delete batch:", rowData.id);
                      }
                    }}
                  />
                </div>
              )}
            />
          </DataTable>
        </Card>
      ) : (
        <Card>
          <div className="text-center p-4">
            <i className="pi pi-info-circle text-2xl text-blue-500 mb-3"></i>
            <h4>{t("batchRenewal.noBatchRenewals")}</h4>
            <p className="text-gray-600">
              {t("batchRenewal.noBatchMessage")}
            </p>
          </div>
        </Card>
      )}

      {/* Batch Creation Modal */}
      <Dialog
        header={t("batchRenewal.createBatchRenewal")}
        visible={showBatchModal}
        style={{ width: "90vw", maxWidth: "1200px" }}
        onHide={() => setShowBatchModal(false)}
        maximizable
      >
        <div className="grid">
          {/* Selection Criteria */}
          <div className="col-12">
            <h4 className="mb-3">{t("batchRenewal.selectionCriteria")}</h4>
            <div className="grid">
              {/* Expiry Date From */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  {t("batchRenewal.expiryDateFrom")}
                </label>
                <Calendar
                  value={batchCriteria.expiryDateFrom}
                  onChange={(e) =>
                    handleCriteriaChange("expiryDateFrom", e.value)
                  }
                  placeholder="Select Date"
                  style={{ width: "100%" }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                />
              </div>

              {/* Expiry Date To */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">{t("batchRenewal.expiryDateTo")}</label>
                <Calendar
                  value={batchCriteria.expiryDateTo}
                  onChange={(e) =>
                    handleCriteriaChange("expiryDateTo", e.value)
                  }
                  placeholder="Select Date"
                  style={{ width: "100%" }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                />
              </div>

              {/* Insurance Company */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  Insurance Company
                </label>
                <Dropdown
                  value={batchCriteria.insuranceCompanyName}
                  onChange={(e) =>
                    handleCriteriaChange("insuranceCompanyName", e.value)
                  }
                  options={insuranceCompanyOptions}
                  placeholder="Select Company"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Product Type */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">{t("batchRenewal.productType")}</label>
                <Dropdown
                  value={batchCriteria.product}
                  onChange={(e) => handleCriteriaChange("product", e.value)}
                  options={productTypeOptions}
                  placeholder="Select Product"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Premium Min */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  Min Premium ({currencySymbol()})
                </label>
                <InputNumber
                  value={batchCriteria.premiumMin}
                  onValueChange={(e) =>
                    handleCriteriaChange("premiumMin", e.value)
                  }
                  placeholder="0.00"
                  mode="decimal"
                  minFractionDigits={2}
                  maxFractionDigits={2}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Premium Max */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  Max Premium ({currencySymbol()})
                </label>
                <InputNumber
                  value={batchCriteria.premiumMax}
                  onValueChange={(e) =>
                    handleCriteriaChange("premiumMax", e.value)
                  }
                  placeholder="0.00"
                  mode="decimal"
                  minFractionDigits={2}
                  maxFractionDigits={2}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Client Name */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">{t("batchRenewal.clientName")}</label>
                <InputText
                  value={batchCriteria.clientName}
                  onChange={(e) =>
                    handleCriteriaChange("clientName", e.target.value)
                  }
                  placeholder="Enter client name"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Payment Status */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">{t("batchRenewal.paymentStatus")}</label>
                <Dropdown
                  value={batchCriteria.paymentStatus}
                  onChange={(e) =>
                    handleCriteriaChange("paymentStatus", e.value)
                  }
                  options={paymentStatusOptions}
                  placeholder="Select Status"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-content-end gap-2 mt-3">
              <Button
                label="Clear"
                icon="pi pi-times"
                onClick={clearCriteria}
                className="p-button-outlined"
              />
              <Button
                label="Generate Policy List"
                icon="pi pi-search"
                onClick={generatePolicyList}
                className="p-button-primary"
              />
            </div>
          </div>

          {/* Selected Policies List */}
          {selectedPolicies.length > 0 && (
            <>
              <Divider />
              <div className="col-12">
                <DataTable
                  value={selectedPolicies}
                  dataKey="PolicyNumber"
                  paginator
                  rows={10}
                  rowsPerPageOptions={[5, 10, 25]}
                  className="p-datatable-sm"
                  emptyMessage="No policies found"
                >
                  <Column
                    field="isSelected"
                    header={
                      <div className="flex align-items-center gap-2">
                        <Checkbox
                          checked={
                            selectedPolicies?.length > 0 &&
                            selectedPolicies.every(
                              (policy) => policy.isSelected
                            )
                          }
                          indeterminate={
                            selectedPolicies?.some(
                              (policy) => policy.isSelected
                            ) &&
                            !selectedPolicies.every(
                              (policy) => policy.isSelected
                            )
                          }
                          onChange={(e) => {
                            const newSelectedPolicies = selectedPolicies.map(
                              (policy) => {
                                return {
                                  ...policy,
                                  isSelected: e.target.checked,
                                };
                              }
                            );
                            setSelectedPolicies(newSelectedPolicies);
                          }}
                        />
                        <span>{t("batchRenewal.selectAll")}</span>
                      </div>
                    }
                    body={(rowData) => (
                      <Checkbox
                        checked={rowData.isSelected}
                        onChange={(e) => {
                          const newSelectedPolicies = selectedPolicies.map(
                            (policy) =>
                              policy.id === rowData.id
                                ? { ...policy, isSelected: e.target.checked }
                                : policy
                          );
                          setSelectedPolicies(newSelectedPolicies);
                        }}
                      />
                    )}
                  />
                  <Column
                    field="policyNumber"
                    header="Policy Number"
                    sortable
                  />
                  <Column field="ClientName" header="Client Name" sortable />
                  <Column
                    field="insuranceCompanyName"
                    header="Insurance Company"
                    sortable
                  />
                  <Column
                    field="grossPremium"
                    header="Premium"
                    sortable
                    body={(rowData) => formatCurrency(rowData.grossPremium)}
                  />
                  <Column
                    field="expiry"
                    header="Expiry Date"
                    sortable
                    body={(rowData) => formatDate(rowData.expiry)}
                  />
                  <Column
                    field="paymentStatus"
                    header="Payment Status"
                    sortable
                  />
                </DataTable>
              </div>
              <div className="flex justify-content-end gap-2 mt-3">
                <Button
                  label={t("batchRenewal.createBatch")}
                  icon="pi pi-plus"
                  onClick={generateBatchRenewal}
                  className="p-button-success"
                />
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Batch Details Modal */}
      <Dialog
        header={`Batch Details - ${selectedBatch?.batchId}`}
        visible={showBatchDetailsModal}
        style={{ width: "90vw", maxWidth: "1200px" }}
        onHide={() => setShowBatchDetailsModal(false)}
        maximizable
      >
        {selectedBatch && (
          <div className="grid">
            {/* Batch Information */}
            <div className="col-12">
              <h4 className="mb-3">{t("batchRenewal.selectedCriteria")}</h4>
              <div className="grid">
                {/* Expiry Date From */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    {t("batchRenewal.expiryDateFrom")}
                  </label>
                  <Calendar
                    value={selectedBatch.criteriaOption?.expiryDateFrom}
                    placeholder="Select Date"
                    style={{ width: "100%" }}
                    dateFormat={calendarDateFormat()}
                    showIcon
                  />
                </div>

                {/* Expiry Date To */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    {t("batchRenewal.expiryDateTo")}
                  </label>
                  <Calendar
                    value={selectedBatch.criteriaOption?.expiryDateTo}
                    placeholder="Select Date"
                    style={{ width: "100%" }}
                    dateFormat={calendarDateFormat()}
                    showIcon
                  />
                </div>

                {/* Insurance Company */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    Insurance Company
                  </label>
                  <Dropdown
                    value={selectedBatch.criteriaOption?.insuranceCompanyName}
                    options={insuranceCompanyOptions}
                    placeholder="Select Company"
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Product Type */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">{t("batchRenewal.productType")}</label>
                  <Dropdown
                    value={batchCriteria.product}
                    onChange={(e) => handleCriteriaChange("product", e.value)}
                    options={productTypeOptions}
                    placeholder="Select Product"
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Premium Min */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    Min Premium ({currencySymbol()})
                  </label>
                  <InputNumber
                    value={selectedBatch.criteriaOption?.premiumMin}
                    placeholder="0.00"
                    mode="decimal"
                    minFractionDigits={2}
                    maxFractionDigits={2}
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Premium Max */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    Max Premium ({currencySymbol()})
                  </label>
                  <InputNumber
                    value={selectedBatch.criteriaOption?.premiumMax}
                    placeholder="0.00"
                    mode="decimal"
                    minFractionDigits={2}
                    maxFractionDigits={2}
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Client Name */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">{t("batchRenewal.clientName")}</label>
                  <InputText
                    value={selectedBatch.criteriaOption?.clientName}
                    placeholder="Enter client name"
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Payment Status */}
                <div className="col-12 md:col-6 lg:col-3">
                  <label className="block mb-2 font-medium">
                    Payment Status
                  </label>
                  <Dropdown
                    value={selectedBatch.criteriaOption?.paymentStatus}
                    options={paymentStatusOptions}
                    placeholder="Select Status"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            <Divider />

            {/* Queue Progress */}
            {queueProgress && sendingNotices && (
              <div className="col-12">
                <Card className="mb-3 bg-blue-50">
                  <div className="flex align-items-center justify-content-between mb-2">
                    <h5 className="m-0">
                      <i className="pi pi-spin pi-spinner mr-2"></i>
                      Processing Renewal Notices
                    </h5>
                    <Tag
                      value={queueProgress.status.toUpperCase()}
                      severity={
                        queueProgress.status === "processing"
                          ? "warning"
                          : "info"
                      }
                    />
                  </div>
                  <div className="grid mt-3">
                    <div className="col-3">
                      <div className="text-sm text-gray-600">Total</div>
                      <div className="text-2xl font-bold">
                        {queueProgress.progress.total}
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="text-sm text-gray-600">{t("batchRenewal.processed")}</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {queueProgress.progress.processed}
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="text-sm text-gray-600">{t("batchRenewal.succeeded")}</div>
                      <div className="text-2xl font-bold text-green-600">
                        {queueProgress.progress.succeeded}
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="text-sm text-gray-600">{t("batchRenewal.failed")}</div>
                      <div className="text-2xl font-bold text-red-600">
                        {queueProgress.progress.failed}
                      </div>
                    </div>
                  </div>
                  <ProgressBar
                    value={
                      (queueProgress.progress.processed /
                        queueProgress.progress.total) *
                      100
                    }
                    className="mt-3"
                  />
                </Card>
              </div>
            )}

            {/* Policies List */}
            <div className="col-12">
              <div className="flex justify-content-between align-items-center mb-3">
                <h4 className="m-0">{t("batchRenewal.policiesInBatch")}</h4>
                <div className="flex gap-2">
                  <Button
                    label="Generate Report"
                    icon="pi pi-file-excel"
                    onClick={generateReport}
                    className="p-button-outlined p-button-success"
                    tooltip="Download batch report as Excel"
                  />
                  <Tag
                    value={`NotSent: ${
                      selectedBatch.policies.filter(
                        (p) => p.noticeStatus === "NotSent"
                      ).length
                    }`}
                    severity="secondary"
                  />
                  <Tag
                    value={`Queued: ${
                      selectedBatch.policies.filter(
                        (p) => p.noticeStatus === "Queued"
                      ).length
                    }`}
                    severity="warning"
                  />
                  <Tag
                    value={`Sent: ${
                      selectedBatch.policies.filter(
                        (p) => p.noticeStatus === "Sent"
                      ).length
                    }`}
                    severity="success"
                  />
                  <Tag
                    value={`Failed: ${
                      selectedBatch.policies.filter(
                        (p) => p.noticeStatus === "Failed"
                      ).length
                    }`}
                    severity="danger"
                  />
                </div>
              </div>
              <DataTable
                value={selectedBatch.policies}
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 25]}
                className="p-datatable-sm"
                emptyMessage="No policies found"
              >
                <Column
                  field="isSelected"
                  header={
                    <div className="flex align-items-center gap-2">
                      <Checkbox
                        checked={
                          selectedBatch?.policies?.length > 0 &&
                          selectedBatch.policies.every(
                            (policy) =>
                              policy.isSelected ||
                              policy.noticeStatus === "Sent" ||
                              policy.noticeStatus === "Queued"
                          )
                        }
                        indeterminate={
                          selectedBatch?.policies?.some(
                            (policy) => policy.isSelected
                          ) &&
                          !selectedBatch.policies.every(
                            (policy) =>
                              policy.isSelected ||
                              policy.noticeStatus === "Sent" ||
                              policy.noticeStatus === "Queued"
                          )
                        }
                        disabled={sendingNotices}
                        onChange={(e) => {
                          const shouldSelectAll = e.target.checked;
                          setSelectedBatch((prev) => ({
                            ...prev,
                            policies: prev.policies.map((policy) => ({
                              ...policy,
                              isSelected:
                                policy.noticeStatus === "Sent" ||
                                policy.noticeStatus === "Queued"
                                  ? policy.isSelected
                                  : shouldSelectAll,
                            })),
                          }));
                        }}
                      />
                      <span>{t("batchRenewal.selectAll")}</span>
                    </div>
                  }
                  body={(rowData) => (
                    <Checkbox
                      checked={rowData.isSelected}
                      disabled={
                        sendingNotices ||
                        rowData.noticeStatus === "Sent" ||
                        rowData.noticeStatus === "Queued"
                      }
                      onChange={(e) => {
                        setSelectedBatch((prev) => ({
                          ...prev,
                          policies: prev.policies.map((policy) =>
                            policy.policyId === rowData.policyId
                              ? { ...policy, isSelected: e.target.checked }
                              : policy
                          ),
                        }));
                      }}
                    />
                  )}
                />
                <Column
                  field="policy.policyNumber"
                  header="Policy ID"
                  body={(rowData) => (
                    <p
                      style={{ cursor: "pointer ", color: "blue" }}
                      onClick={() => {
                        navigate(`/agent/policydetail/${rowData.policyId}`);
                      }}
                    >
                      {rowData.policy.policyNumber}
                    </p>
                  )}
                  sortable
                />

                <Column
                  field="policy.insuranceCompanyName"
                  header="Insurance Company"
                  sortable
                />

                <Column
                  field="noticeStatus"
                  header="Notice Status"
                  sortable
                  body={(rowData) => (
                    <Tag
                      value={rowData.noticeStatus}
                      severity={getNoticeStatusSeverity(rowData.noticeStatus)}
                    />
                  )}
                />
                <Column
                  field="noticeSentAt"
                  header="Notice Sent At"
                  sortable
                  body={(rowData) =>
                    rowData.noticeSentAt
                      ? formatDate(rowData.noticeSentAt)
                      : "-"
                  }
                />
                <Column
                  field="createdAt"
                  header="Added Date"
                  sortable
                  body={(rowData) => formatDate(rowData.createdAt)}
                />
              </DataTable>
              <div className="flex justify-content-between align-items-center mt-3">
                <div className="text-sm text-gray-600">
                  {selectedBatch.policies.filter((p) => p.isSelected).length}{" "}
                  policies selected
                </div>
                <div className="flex gap-2">
                  {selectedBatch.policies.filter(
                    (p) => p.noticeStatus === "Failed"
                  ).length > 0 && (
                    <Button
                      label="Retry Failed"
                      icon="pi pi-refresh"
                      onClick={retryFailedNotices}
                      className="p-button-outlined p-button-warning"
                      disabled={sendingNotices}
                      loading={sendingNotices}
                    />
                  )}
                  <Button
                    label="Send Renewal Notices"
                    icon="pi pi-envelope"
                    onClick={sendRenewalNotice}
                    className="p-button-success"
                    disabled={
                      sendingNotices ||
                      selectedBatch.policies.filter(
                        (p) => p.isSelected && p.noticeStatus === "NotSent"
                      ).length === 0
                    }
                    loading={sendingNotices}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
