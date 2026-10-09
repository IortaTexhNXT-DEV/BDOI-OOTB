import { useState, useEffect, useRef } from "react";
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
import { percentOf } from "../../../utility/numberFormat";
import { Toast } from "primereact/toast";
import { useDispatch } from "react-redux";
import BatchRenewalService from "../../../services/batchRenewalService";
import { useNavigate } from "react-router-dom";
import { confirmAction, notifyError, notifySuccess, notifyWarn } from "../../../utility/dialogs";
import { calendarDateFormat, formatDate as formatAppDate, toIsoDate } from "../../../utility/dateFormat";
import { currencySymbol } from "../../../utility/currencyConverter";
import logger from "../../../utility/logger";

export default function BatchTable() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [sendingNotices, setSendingNotices] = useState(false);
  const [, setQueueJobId] = useState(null);
  const [queueProgress, setQueueProgress] = useState(null);
  const initialBatchCriteria = {
    expiryFrom: null,
    expiryTo: null,
    insurerId: "",
    productId: "",
    premiumMin: null,
    premiumMax: null,
    clientName: "",
    paymentStatus: "All",
  };
  const [batchCriteria, setBatchCriteria] = useState(initialBatchCriteria);
  // defaults (expiry window from today, from settings) and insurer / product choices from the masters
  const [renewalOptions, setRenewalOptions] = useState({ insurers: [], products: [], paymentStatuses: ["All", "Paid", "Unpaid"] });
  const [listing, setListing] = useState(false);
  const [listed, setListed] = useState(false);

  const pollingInterval = useRef(null);

  const paymentStatusOptions = (renewalOptions.paymentStatuses || []).map((v) => ({ label: t(`batchRenewal.payment${v}`, v), value: v }));
  const productTypeOptions = [{ label: t("batchRenewal.all"), value: "" }, ...renewalOptions.products.map((p) => ({ label: p.name, value: String(p.id) }))];
  const insuranceCompanyOptions = [{ label: t("batchRenewal.all"), value: "" }, ...renewalOptions.insurers.map((i) => ({ label: i.name, value: String(i.id) }))];

  const toDate = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);
  const openCreateBatch = async () => {
    setShowBatchModal(true);
    setSelectedPolicies([]);
    setListed(false);
    try {
      const o = await BatchRenewalService.getRenewalOptions();
      setRenewalOptions((prev) => ({ ...prev, ...o }));
      setBatchCriteria({ ...initialBatchCriteria, expiryFrom: toDate(o.expiryFrom), expiryTo: toDate(o.expiryTo) });
    } catch (error) {
      logger.error("Renewal options not loaded:", error);
    }
  };

  useEffect(() => {
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
      logger.error("Error fetching batches:", error);
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

  // renewable policies for the criteria: due, in the grace period or lapsed but still renewable; renewed ones are left out
  const generatePolicyList = async () => {
    setListing(true);
    try {
      const policies = await BatchRenewalService.getRenewablePolicies({
        ...batchCriteria,
        expiryFrom: batchCriteria.expiryFrom ? toIsoDate(batchCriteria.expiryFrom) : "",
        expiryTo: batchCriteria.expiryTo ? toIsoDate(batchCriteria.expiryTo) : "",
      });
      setSelectedPolicies(policies.filter((p) => p.renewalState !== "in-progress").map((p) => ({ ...p, isSelected: true })));
      setListed(true);
    } catch (error) {
      notifyError(error?.response?.data?.message || t("batchRenewal.listFailed"));
    } finally {
      setListing(false);
    }
  };

  const clearCriteria = () => {
    setBatchCriteria(initialBatchCriteria);
    setSelectedPolicies([]);
    setListed(false);
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
            policyId: policy.policyId,
            isSelected: true,
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

  // a list row carries the counters only; the policies of the batch are loaded with its details
  const handleViewBatchDetails = (batch) => {
    setSelectedBatch({ ...batch, policies: batch.policies || [] });
    setShowBatchDetailsModal(true);
    fetchBatchDetails(batch.batchId);
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
      logger.error("Error fetching batch details:", error);
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
            onClick={openCreateBatch}
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
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
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
                <div className="bv-meter">
                  <ProgressBar value={percentOf(rowData.processedCount, rowData.totalPolicies)} showValue={false} />
                  <span className="bv-meter__value">{`${rowData.processedCount} of ${rowData.totalPolicies}`}</span>
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
                    onClick={() => handleViewBatchDetails(rowData)} aria-label="View Details"
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
                      }
                    }} aria-label="Delete Batch"
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
                  value={batchCriteria.expiryFrom}
                  onChange={(e) =>
                    handleCriteriaChange("expiryFrom", e.value)
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
                  value={batchCriteria.expiryTo}
                  onChange={(e) =>
                    handleCriteriaChange("expiryTo", e.value)
                  }
                  minDate={batchCriteria.expiryFrom || undefined}
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
                  value={batchCriteria.insurerId}
                  onChange={(e) =>
                    handleCriteriaChange("insurerId", e.value)
                  }
                  filter
                  options={insuranceCompanyOptions}
                  placeholder="Select Company"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Product Type */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">{t("batchRenewal.productType")}</label>
                <Dropdown
                  value={batchCriteria.productId}
                  onChange={(e) => handleCriteriaChange("productId", e.value)}
                  filter
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
                label={t("batchRenewal.generatePolicyList")}
                icon="pi pi-search"
                loading={listing}
                onClick={generatePolicyList}
                className="p-button-primary"
              />
            </div>
          </div>

          {/* Selected Policies List */}
          {listed && selectedPolicies.length === 0 && (
            <div className="col-12">
              <p className="text-color-secondary m-0">{t("batchRenewal.noRenewablePolicies")}</p>
            </div>
          )}
          {selectedPolicies.length > 0 && (
            <>
              <Divider />
              <div className="col-12">
                <DataTable
                  value={selectedPolicies}
                  dataKey="policyId"
                  paginator
                  rows={20}
                  rowsPerPageOptions={[20, 50, 100]}
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
                              policy.policyId === rowData.policyId
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
                  <Column field="clientName" header={t("batchRenewal.clientName")} sortable />
                  <Column field="product" header={t("batchRenewal.productType")} sortable />
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
                    field="expiryDate"
                    header={t("batchRenewal.expiryDate")}
                    sortable
                    body={(rowData) => formatDate(rowData.expiryDate)}
                  />
                  <Column
                    field="paymentStatus"
                    header={t("batchRenewal.paymentStatus")}
                    sortable
                  />
                  <Column
                    field="renewalStateLabel"
                    header={t("batchRenewal.renewalState")}
                    body={(rowData) => <Tag value={rowData.renewalStateLabel} severity={rowData.renewalState === "due" ? "info" : "warning"} />}
                  />
                </DataTable>
              </div>
              <div className="flex justify-content-end gap-2 mt-3">
                <Button
                  label={t("batchRenewal.createBatch")}
                  icon="pi pi-plus"
                  onClick={generateBatchRenewal}
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
                      value={queueProgress.status.charAt(0).toUpperCase() + queueProgress.status.slice(1)}
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
                  <div className="bv-meter mt-3">
                    <ProgressBar value={percentOf(queueProgress.progress.processed, queueProgress.progress.total)} showValue={false} />
                    <span className="bv-meter__value">{`${queueProgress.progress.processed} of ${queueProgress.progress.total}`}</span>
                  </div>
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
                    className="p-button-outlined"
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
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
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
