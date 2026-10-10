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
import { notifyError, notifySuccess, notifyWarn } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import { calendarDateFormat, formatDate as formatAppDate, formatInstant, toIsoDate } from "../../../utility/dateFormat";
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
      notifyWarn(t("batchRenewal.selectOnePolicy"));
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
        notifySuccess(t("batchRenewal.created", { id: response.data.batchId }));
        setShowBatchModal(false);
        setSelectedPolicies([]);
        fetchBatches(); // Refresh the batches list
      }
    } catch (error) {
      notifyError(error?.message || t("batchRenewal.createFailed"));
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

    // a completed batch that did not send every notice says how many it sent
    if (status === "Completed" && processedCount < totalPolicies) {
      return t("batchRenewal.partiallyCompleted", { processed: processedCount, total: totalPolicies });
    }

    return t(`batchRenewal.batchStatus.${status}`, status);
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
      case "Skipped":
        return "warning";
      default:
        return "secondary";
    }
  };

  // a list row carries the counters only; the policies of the batch are loaded with its details
  const handleViewBatchDetails = (batch) => {
    setSelectedBatch({ ...batch, policies: batch.policies || [] });
    setShowBatchDetailsModal(true);
    fetchBatchDetails(batch.batchId);
    if (!renewalOptions.insurers.length && !renewalOptions.products.length) {
      BatchRenewalService.getRenewalOptions()
        .then((o) => setRenewalOptions((prev) => ({ ...prev, ...o })))
        .catch((error) => logger.error("Renewal options not loaded:", error));
    }
  };

  const deleteBatch = async (batch) => {
    const deleted = await openConfirm({
      title: t("batchRenewal.deleteTitle"),
      severity: "danger",
      message: t("batchRenewal.deleteMessage"),
      facts: [
        { label: t("batchRenewal.batchId"), value: batch.batchId },
        { label: t("batchRenewal.status"), value: getStatusLabel(batch) },
        { label: t("batchRenewal.totalPolicies"), value: batch.totalPolicies, type: "number" },
        { label: t("batchRenewal.createdDate"), value: batch.createdAt, type: "date" },
      ],
      note: t("batchRenewal.deleteNote"),
      confirmLabel: t("batchRenewal.deleteAction"),
      onConfirm: () => BatchRenewalService.deleteBatch(batch.batchId),
    });
    if (!deleted) return;
    notifySuccess(t("batchRenewal.deleted", { id: batch.batchId }));
    fetchBatches();
  };

  const nameOf = (options, value) => (value ? options.find((o) => o.value === String(value))?.label || value : t("batchRenewal.all"));
  const criteriaItems = (c = {}) => [
    { label: t("batchRenewal.expiryDateFrom"), value: c.expiryFrom || c.expiryDateFrom, type: "date" },
    { label: t("batchRenewal.expiryDateTo"), value: c.expiryTo || c.expiryDateTo, type: "date" },
    { label: t("batchRenewal.insuranceCompany"), value: c.insuranceCompanyName || nameOf(insuranceCompanyOptions, c.insurerId) },
    { label: t("batchRenewal.productType"), value: c.productName || nameOf(productTypeOptions, c.productId) },
    { label: t("batchRenewal.minimumPremium"), value: c.premiumMin, type: "amount" },
    { label: t("batchRenewal.maximumPremium"), value: c.premiumMax, type: "amount" },
    { label: t("batchRenewal.clientName"), value: c.clientName },
    { label: t("batchRenewal.paymentStatus"), value: c.paymentStatus ? t(`batchRenewal.payment${c.paymentStatus}`, c.paymentStatus) : null },
  ];
  const noticeLabel = (status) => t(`batchRenewal.notice.${status}`, status);
  const noticeCount = (status) => (selectedBatch?.policies || []).filter((p) => p.noticeStatus === status).length;

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
            summary: t("batchRenewal.toast.noticesSent"),
            detail: t("batchRenewal.toast.noticesSentDetail", { count: job.progress.succeeded, total: job.progress.total }),
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
            summary: t("batchRenewal.toast.sendingFailed"),
            detail: t("batchRenewal.toast.sendingFailedDetail"),
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
          summary: t("batchRenewal.toast.processingComplete"),
          detail: t("batchRenewal.toast.processingCompleteDetail"),
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
        summary: t("batchRenewal.toast.noPoliciesSelected"),
        detail: t("batchRenewal.toast.noPoliciesSelectedDetail"),
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
        const skipped = response.data.skipped || 0;
        // suppressed or held policies (lock-in, Scheme 2, loan status) are skipped with their reason, not queued
        if (!jobId) {
          setSendingNotices(false);
          toast.current.show({ severity: "warn", summary: t("batchRenewal.toast.allSkipped"), detail: t("batchRenewal.toast.skippedDetail", { count: skipped }), life: 6000 });
          fetchBatchDetails(selectedBatch.batchId);
          return;
        }
        setQueueJobId(jobId);

        toast.current.show({
          severity: skipped ? "warn" : "info",
          summary: t("batchRenewal.toast.queued"),
          detail: skipped ? `${t("batchRenewal.toast.queuedDetail", { count: response.data.queued })} ${t("batchRenewal.toast.skippedDetail", { count: skipped })}`
            : t("batchRenewal.toast.queuedDetail", { count: selectedCount }),
          life: skipped ? 6000 : 4000,
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
          summary: t("batchRenewal.toast.queueFailed"),
          detail: response.message || t("batchRenewal.toast.queueFailedDetail"),
          life: 5000,
        });
      }
    } catch (error) {
      setSendingNotices(false);
      toast.current.show({
        severity: "error",
        summary: t("common.error"),
        detail: error?.message || t("batchRenewal.toast.sendingFailedDetail"),
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
        summary: t("batchRenewal.toast.noFailedNotices"),
        detail: t("batchRenewal.toast.noFailedNoticesDetail"),
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
          summary: t("batchRenewal.toast.retrying"),
          detail: t("batchRenewal.toast.retryingDetail", { count: failedCount }),
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
          summary: t("batchRenewal.toast.retryFailed"),
          detail: response.message || t("batchRenewal.toast.retryFailedDetail"),
          life: 5000,
        });
      }
    } catch (error) {
      setSendingNotices(false);
      toast.current.show({
        severity: "error",
        summary: t("common.error"),
        detail: error?.message || t("batchRenewal.toast.retryFailedDetail"),
        life: 5000,
      });
    }
  };

  const generateReport = async () => {
    if (!selectedBatch?.batchId) {
      toast.current.show({
        severity: "error",
        summary: t("common.error"),
        detail: t("batchRenewal.toast.noBatch"),
        life: 3000,
      });
      return;
    }

    try {
      toast.current.show({
        severity: "info",
        summary: t("batchRenewal.toast.generatingReport"),
        detail: t("batchRenewal.toast.generatingReportDetail"),
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
        summary: t("batchRenewal.toast.reportDownloaded"),
        detail: t("batchRenewal.toast.reportDownloadedDetail"),
        life: 3000,
      });
    } catch (error) {
      let errorMessage = t("batchRenewal.toast.reportFailed");

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
        summary: t("common.error"),
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
            emptyMessage={t("batchRenewal.noBatches")}
          >
            <Column
              field="batchId"
              header={t("batchRenewal.batchId")}
              sortable
              style={{ minWidth: "150px" }}
            />
            <Column
              field="status"
              header={t("batchRenewal.status")}
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
              header={t("batchRenewal.totalPolicies")}
              sortable
              body={(rowData) => (
                <div className="text-center">
                  <span className="font-semibold">{rowData.totalPolicies}</span>
                </div>
              )}
            />
            <Column
              field="processedCount"
              header={t("batchRenewal.processed")}
              sortable
              body={(rowData) => (
                <div className="bv-meter">
                  <ProgressBar value={percentOf(rowData.processedCount, rowData.totalPolicies)} showValue={false} />
                  <span className="bv-meter__value">{t("batchRenewal.countOf", { count: rowData.processedCount, total: rowData.totalPolicies })}</span>
                </div>
              )}
            />
            <Column
              field="createdAt"
              header={t("batchRenewal.createdDate")}
              sortable
              body={(rowData) => formatDate(rowData.createdAt)}
            />
            <Column
              header={t("batchRenewal.actions")}
              body={(rowData) => (
                <div className="flex gap-2">
                  <Button
                    icon="pi pi-eye"
                    className="p-button-outlined p-button-sm"
                    tooltip={t("batchRenewal.viewDetails")}
                    onClick={() => handleViewBatchDetails(rowData)} aria-label={t("batchRenewal.viewDetails")}
                  />
                  <Button
                    icon="pi pi-trash"
                    className="p-button-outlined p-button-sm p-button-danger"
                    tooltip={t("batchRenewal.deleteTitle")}
                    onClick={() => deleteBatch(rowData)} aria-label={t("batchRenewal.deleteTitle")}
                  />
                </div>
              )}
            />
          </DataTable>
        </Card>
      ) : (
        <Card>
          <div className="text-center p-4">
            <i className="pi pi-info-circle text-2xl text-primary mb-3"></i>
            <h4>{t("batchRenewal.noBatchRenewals")}</h4>
            <p className="text-color-secondary">
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
                  placeholder={t("batchRenewal.selectDate")}
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
                  placeholder={t("batchRenewal.selectDate")}
                  style={{ width: "100%" }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                />
              </div>

              {/* Insurance Company */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  {t("batchRenewal.insuranceCompany")}
                </label>
                <Dropdown
                  value={batchCriteria.insurerId}
                  onChange={(e) =>
                    handleCriteriaChange("insurerId", e.value)
                  }
                  filter
                  options={insuranceCompanyOptions}
                  placeholder={t("batchRenewal.selectCompany")}
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
                  placeholder={t("batchRenewal.selectProduct")}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Premium Min */}
              <div className="col-12 md:col-6 lg:col-3">
                <label className="block mb-2 font-medium">
                  {t("batchRenewal.minPremiumIn", { currency: currencySymbol() })}
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
                  {t("batchRenewal.maxPremiumIn", { currency: currencySymbol() })}
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
                  placeholder={t("batchRenewal.enterClientName")}
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
                  placeholder={t("batchRenewal.selectStatus")}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-content-end gap-2 mt-3">
              <Button
                label={t("batchRenewal.clear")}
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
                  emptyMessage={t("batchRenewal.noPolicies")}
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
                    header={t("batchRenewal.policyNumber")}
                    sortable
                  />
                  <Column field="clientName" header={t("batchRenewal.clientName")} sortable />
                  <Column field="product" header={t("batchRenewal.productType")} sortable />
                  <Column
                    field="insuranceCompanyName"
                    header={t("batchRenewal.insuranceCompany")}
                    sortable
                  />
                  <Column
                    field="grossPremium"
                    header={t("batchRenewal.premium")}
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
      <DetailDialog
        header={t("batchRenewal.batchDetails")}
        visible={showBatchDetailsModal}
        size="xl"
        onHide={() => setShowBatchDetailsModal(false)}
        maximizable
        footer={selectedBatch ? (
          <>
            <Button type="button" label={t("batchRenewal.close")} text onClick={() => setShowBatchDetailsModal(false)} />
            {noticeCount("Failed") > 0 && (
              <Button
                label={t("batchRenewal.retryFailed")}
                icon="pi pi-refresh"
                onClick={retryFailedNotices}
                outlined
                disabled={sendingNotices}
                loading={sendingNotices}
              />
            )}
            <Button
              label={t("batchRenewal.sendNotices")}
              icon="pi pi-envelope"
              onClick={sendRenewalNotice}
              disabled={
                sendingNotices ||
                (selectedBatch.policies || []).filter(
                  (p) => p.isSelected && p.noticeStatus === "NotSent"
                ).length === 0
              }
              loading={sendingNotices}
            />
          </>
        ) : null}
      >
        {selectedBatch && (
          <>
            <DetailHeader
              title={selectedBatch.batchId}
              status={{ code: selectedBatch.status, label: getStatusLabel(selectedBatch) }}
              meta={[
                { label: t("batchRenewal.totalPolicies"), value: selectedBatch.totalPolicies, type: "number" },
                { label: t("batchRenewal.notice.NotSent"), value: selectedBatch.notSentCount ?? noticeCount("NotSent"), type: "number" },
                { label: t("batchRenewal.notice.Queued"), value: selectedBatch.queuedCount ?? noticeCount("Queued"), type: "number" },
                { label: t("batchRenewal.notice.Sent"), value: selectedBatch.sentCount ?? noticeCount("Sent"), type: "number" },
                { label: t("batchRenewal.notice.Failed"), value: selectedBatch.failedCount ?? noticeCount("Failed"), type: "number" },
                { label: t("batchRenewal.notice.Skipped"), value: selectedBatch.skippedCount ?? noticeCount("Skipped"), type: "number", hidden: !(selectedBatch.skippedCount ?? noticeCount("Skipped")) },
                { label: t("batchRenewal.createdDate"), value: selectedBatch.createdAt, type: "datetime" },
                { label: t("batchRenewal.createdBy"), value: selectedBatch.createdBy, hidden: !selectedBatch.createdBy },
              ]}
              actions={
                <Button
                  label={t("batchRenewal.generateReport")}
                  icon="pi pi-file-excel"
                  onClick={generateReport}
                  outlined
                />
              }
            />

            <DetailSection title={t("batchRenewal.selectedCriteria")}>
              <KeyValueGrid columns={4} items={criteriaItems(selectedBatch.criteriaOption)} />
            </DetailSection>

            {queueProgress && sendingNotices && (
              <DetailSection
                title={t("batchRenewal.sendingNotices")}
                actions={<StatusChip code={queueProgress.status} />}
              >
                <KeyValueGrid
                  columns={4}
                  items={[
                    { label: t("batchRenewal.total"), value: queueProgress.progress.total, type: "number" },
                    { label: t("batchRenewal.processed"), value: queueProgress.progress.processed, type: "number" },
                    { label: t("batchRenewal.succeeded"), value: queueProgress.progress.succeeded, type: "number" },
                    { label: t("batchRenewal.failed"), value: queueProgress.progress.failed, type: "number" },
                  ]}
                />
                <div className="bv-meter mt-3">
                  <ProgressBar value={percentOf(queueProgress.progress.processed, queueProgress.progress.total)} showValue={false} />
                  <span className="bv-meter__value">{t("batchRenewal.countOf", { count: queueProgress.progress.processed, total: queueProgress.progress.total })}</span>
                </div>
              </DetailSection>
            )}

            <DetailSection
              title={t("batchRenewal.policiesInBatch")}
              actions={<span className="text-color-secondary text-sm">{t("batchRenewal.selectedCount", { count: (selectedBatch.policies || []).filter((p) => p.isSelected).length })}</span>}
              flush
            >
              <DataTable
                value={selectedBatch.policies || []}
                dataKey="policyId"
                paginator
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
                className="p-datatable-sm"
                emptyMessage={t("batchRenewal.noPolicies")}
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
                  header={t("batchRenewal.policyNumber")}
                  body={(rowData) => (
                    <Button
                      label={rowData.policy?.policyNumber}
                      link
                      className="p-0"
                      onClick={() => navigate(`/agent/policydetail/${rowData.policyId}`)}
                    />
                  )}
                  sortable
                />
                <Column field="policy.clientName" header={t("batchRenewal.clientName")} sortable />
                <Column
                  field="policy.insuranceCompanyName"
                  header={t("batchRenewal.insuranceCompany")}
                  sortable
                />
                <Column
                  field="policy.expiryDate"
                  header={t("batchRenewal.expiryDate")}
                  sortable
                  body={(rowData) => formatDate(rowData.policy?.expiryDate)}
                />
                <Column
                  field="noticeStatus"
                  header={t("batchRenewal.noticeStatus")}
                  sortable
                  body={(rowData) => (
                    <span className="bv-cell-stack" title={rowData.noticeStatus === "Skipped" ? rowData.error || undefined : undefined}>
                      <StatusChip
                        code={rowData.noticeStatus}
                        label={noticeLabel(rowData.noticeStatus)}
                        severity={getNoticeStatusSeverity(rowData.noticeStatus)}
                      />
                      {rowData.noticeStatus === "NotSent" && rowData.noticeTreatment && rowData.noticeTreatment.code !== "send" ? (
                        <small className="bv-text-alert">{rowData.noticeTreatment.label}</small>
                      ) : null}
                      {rowData.noticeStatus === "Skipped" && rowData.error ? <small>{rowData.error}</small> : null}
                    </span>
                  )}
                />
                <Column
                  field="noticeSentAt"
                  header={t("batchRenewal.noticeSentAt")}
                  sortable
                  body={(rowData) => formatInstant(rowData.noticeSentAt)}
                />
                <Column
                  field="createdAt"
                  header={t("batchRenewal.addedDate")}
                  sortable
                  body={(rowData) => formatDate(rowData.createdAt)}
                />
              </DataTable>
            </DetailSection>
          </>
        )}
      </DetailDialog>
    </div>
  );
}
