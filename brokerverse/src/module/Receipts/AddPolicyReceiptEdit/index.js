import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { useNavigate, useLocation } from "react-router-dom";
import SvgEdits from "../../../assets/icons/SvgEdits";
import { Dialog } from "primereact/dialog";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import {
  patchReceipEditMiddleware,
  updateReceiptMiddleware,
  getDraftReceiptsMiddleware,
  getReceiptByIdMiddleware,
} from "../store/receiptsMiddleware";
import { setReceivableTableList } from "../store/receiptsReducers";
import { useFormik } from "formik";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import {
  showSuccessMessage,
  showErrorMessage,
} from "../../../utility/toastUtils";
import disbursementService from "../../../services/disbursementService";
import documentTemplateService from "../../../services/documentTemplateService";
import { openConfirm } from "../../../components/ConfirmDialog";
import { printPdf } from "../../../components/Print";
import { getUserData } from "../../../utility/tokenManager";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";

function PolicyReceipts() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [selectedRows, setSelectedRows] = useState([]);

  const [visiblePopup, setVisiblePopup] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [showPrintButton, setShowPrintButton] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const dispatch = useDispatch();
  const location = useLocation();

  // Get customer data and receivable list from navigation state
  const customerData = location.state?.customerData || {};

  const paymentDetails = useSelector(
    ({ receiptsTableReducers }) => receiptsTableReducers?.paymentDetails
  );
  const { receivableTableList: reduxReceivableList, loading } = useSelector(
    ({ receiptsTableReducers }) => ({
      loading: receiptsTableReducers?.loading,
      receivableTableList: receiptsTableReducers?.receivableTableList || [],
    })
  );

  // Always use Redux state as the single source of truth
  // Separate pending vs paid items for UI and summaries
  const allReceiptsList = reduxReceivableList || [];

  const normalizeStatus = (statusValue) => {
    const normalized = String(statusValue ?? "")
      .trim()
      .toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "pending") return "Pending";
    if (normalized.length === 0) return "Pending";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const pendingReceivableList = allReceiptsList.filter(
    (item) => normalizeStatus(item?.status) !== "Paid"
  );
  const paidReceiptsList = allReceiptsList.filter(
    (item) => normalizeStatus(item?.status) === "Paid"
  );

  // Fetch receipt data if Redux state is empty but we have a receiptId
  useEffect(() => {
    if (customerData.receiptId && reduxReceivableList.length === 0) {
      dispatch(getReceiptByIdMiddleware(customerData.receiptId));
    }
  }, [customerData.receiptId, reduxReceivableList.length, dispatch]);

  useEffect(() => {
    if (!selectedRows || selectedRows.length === 0) {
      return;
    }

    // In print mode, keep selection against the full list (paid + pending).
    // Before approve, sync selection against pending items only.
    const sourceList = showPrintButton ? allReceiptsList : pendingReceivableList;
    const sourceMap = new Map(sourceList.map((item) => [item.id, item]));
    const refreshedSelection = selectedRows
      .map((item) => sourceMap.get(item.id))
      .filter(Boolean);

    if (
      refreshedSelection.length !== selectedRows.length ||
      refreshedSelection.some((item, index) => item !== selectedRows[index])
    ) {
      setSelectedRows(refreshedSelection);
    }
  }, [pendingReceivableList, allReceiptsList, selectedRows, showPrintButton]);

  // Note: Success message and navigation are now handled directly in handleApprove function

  const getNumericValue = (value) => {
    const parsed = parseFloat(value || "0");
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const calculateTotals = (items = []) => {
    return items.reduce(
      (acc, item) => {
        const net = getNumericValue(item.netPremium);
        const paid = getNumericValue(item.paid);
        const unPaid = getNumericValue(item.unPaid);
        const fc = getNumericValue(item.fcAmount);
        const lc = getNumericValue(item.lcAmount);
        const dst = getNumericValue(item.dst);
        const vat = getNumericValue(item.vat);
        const lgt = getNumericValue(item.lgt);
        const other = getNumericValue(item.other);

        return {
          netPremium: acc.netPremium + net,
          paid: acc.paid + paid,
          unPaid: acc.unPaid + unPaid,
          fcAmount: acc.fcAmount + fc,
          lcAmount: acc.lcAmount + lc,
          taxes: acc.taxes + dst + vat + lgt + other,
        };
      },
      { netPremium: 0, paid: 0, unPaid: 0, fcAmount: 0, lcAmount: 0, taxes: 0 }
    );
  };

  const pendingTotals = useMemo(
    () => calculateTotals(pendingReceivableList),
    [pendingReceivableList]
  );

  const paidTotals = useMemo(
    () => calculateTotals(paidReceiptsList),
    [paidReceiptsList]
  );

  const navigate = useNavigate();
  const items = [
    { label: t("sidebar.Receipts"), command: () => navigate("/accounts/receipts") },
    { label: t("accounts.addReceiptsLabel"), to: "/accounts/receipts/addreceipts" },
  ];

  const home = { label: t("sidebar.Accounts") };

  const renderViewButton = (rowData) => {
    const statusValue = rowData?.status || "Pending";
    const isPaidStatus = statusValue === "Paid";

    return (
      <div
        onClick={() => !isPaidStatus && handleView(rowData)}
        style={{
          cursor: isPaidStatus ? "not-allowed" : "pointer",
          opacity: isPaidStatus ? 0.4 : 1,
        }}
        title={
          isPaidStatus
            ? t("accounts.addReceiptEdit.paidItemsCannotEdit")
            : t("accounts.addReceiptEdit.edit")
        }
      >
        <SvgEdits
          style={{ cursor: isPaidStatus ? "not-allowed" : "pointer" }}
        />
      </div>
    );
  };
  const handleView = (rowData) => {
    setEditedData(rowData);
    setFormikValues(rowData);
    setVisiblePopup(true);
  };

  const handleAddNewPayment = () => {
    // Tax and fee details are pre-filled from the most recent payment.
    // This provides better UX as user doesn't need to re-enter DST, LGT, VAT, etc.
    const lastEntry = allReceiptsList[allReceiptsList.length - 1] || {};
    const templateData = lastEntry;

    // Remaining unpaid amount after all previous payments.
    // Sum up all paid amounts from existing entries for the same policy
    const policyNumber =
      customerData.policyNumber || templateData.policies || "";
    const totalPaidForPolicy = allReceiptsList
      .filter((item) => item.policies === policyNumber)
      .reduce((sum, item) => sum + parseFloat(item.paid || "0"), 0);

    // Use lcAmount (gross/total premium including taxes), not netPremium
    const grossPremium = parseFloat(templateData.lcAmount || "0");
    const remainingUnpaid = Math.max(0, grossPremium - totalPaidForPolicy);

    const newPaymentEntry = {
      id: `new-${Date.now()}`, // Mark as new entry with "new-" prefix
      policies: policyNumber,
      netPremium: templateData.netPremium || "0.00",
      paid: "0.00", // USER WILL FILL THIS
      unPaid: remainingUnpaid.toFixed(2), // Show REMAINING unpaid after previous payments
      discounts: templateData.discounts || "0.00",
      dst: templateData.dst || "0.00",
      lgt: templateData.lgt || "0.00",
      vat: templateData.vat || "0.00",
      other: templateData.other || "0.00",
      fcAmount: templateData.fcAmount || "0.00",
      lcAmount: templateData.lcAmount || "0.00",
      status: "Pending",
    };

    setEditedData(newPaymentEntry);
    setFormikValues(newPaymentEntry);
    setVisiblePopup(true);
  };
  const setFormikValues = (rowData) => {
    const policy = rowData?.policies;
    const id = rowData?.id;
    const netPremium = rowData?.netPremium;
    const paid = rowData?.paid;
    const unPaid = rowData?.unPaid;
    const dst = rowData?.dst;
    const vat = rowData?.vat;
    const lgt = rowData?.lgt;
    const other = rowData?.other;
    const fcAmount = rowData?.fcAmount;
    const lcAmount = rowData?.lcAmount;
    const discounts = rowData?.discounts;

    const updatedValues = {
      id: `${id}`,
      policy: `${policy}`,
      netPremium: `${netPremium}`,
      paid: `${paid}`,
      unPaid: `${unPaid}`,
      discounts: `${discounts}`,
      dst: `${dst}`,
      vat: `${vat}`,
      lgt: `${lgt}`,
      other: `${other}`,
      fcAmount: `${fcAmount}`,
      lcAmount: `${lcAmount}`,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const initialValues = {
    id: "",
    policy: "",
    netPremium: editedData?.netPremium || "",
    paid: editedData?.paid || "",
    unPaid: editedData?.unPaid || "",
    discounts: editedData?.discounts || "",
    dst: editedData?.dst || "",
    lgt: editedData?.lgt || "",
    vat: editedData?.vat || "",
    other: editedData?.other || "",
    fcAmount: editedData?.fcAmount || "",
    lcAmount: editedData?.lcAmount || "",
  };

  const handleSubmit = (values) => {
    dispatch(patchReceipEditMiddleware(values));
    setHasUnsavedChanges(true); // Mark as unsaved - payment staged locally

    setVisiblePopup(false);
  };

  const closePolicyDetails = () => {
    setVisiblePopup(false);
    setEditedData(null);
  };

  const formik = useFormik({
    initialValues,

    onSubmit: handleSubmit,
  });

  const handleApprove = async () => {
    // Validation checks
    if (!customerData.customerCode) {
      showErrorMessage(t("accounts.addReceiptEdit.customerDataMissing"));
      return;
    }

    if (!selectedRows || selectedRows.length === 0) {
      showErrorMessage(t("accounts.addReceiptEdit.selectOneReceivable"));
      return;
    }

    if (!customerData.receiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }

    const amountApplied = selectedRows.reduce((sum, row) => sum + (parseFloat(row.paid || "0") || 0), 0);
    const confirmed = await openConfirm({
      title: t("accounts.receiptDialogs.approveTitle"),
      message: t("accounts.receiptDialogs.approveMessage", { count: selectedRows.length }),
      facts: [
        { label: t("accounts.addReceipts.receiptNumber"), value: customerData.receiptNumber },
        { label: t("accounts.addReceipts.customerName"), value: customerData.customerName },
        { label: t("accounts.policies"), value: selectedRows.map((row) => row.policies).filter(Boolean).join(", ") },
        { label: t("accounts.receiptDialogs.amountApplied"), value: amountApplied, type: "amount", emphasis: true },
      ],
      confirmLabel: t("accounts.receiptDialogs.approveReceipt"),
    });
    if (!confirmed) return;

    // Capture pendingTotals BEFORE approval (before state changes)
    // After approval, selectedRows become "Paid" and pendingTotals will be recalculated without them
    const capturedPendingTotals = { ...pendingTotals };

    // Capture selected policies before approve so we can re-select after IDs change
    const approvedPolicies = new Set(
      selectedRows.map((row) => String(row.policies ?? "")).filter(Boolean)
    );

    // Proceed with approval

    // Prepare the receipt data for update API
    // Numeric fields are sent as strings.
    const receiptData = {
      receiptType: customerData.receiptType || undefined,
      receiptDate: new Date().toISOString(),
      branchCode: customerData.branchCode || null,
      departmentCode: customerData.departmentCode || null,
      customerCode: customerData.customerCode,
      currencyCode: customerData.currencyCode || undefined,
      transactionCode: customerData.transactionCode || undefined,
      remarks: customerData.remarks || undefined,
      policyNumber: customerData.policyNumber,
      name: customerData.customerName,
      policyRefId: customerData.policyRefId,
      // DON'T hardcode status - let backend calculate it based on unpaid amount
      // receiptStatus will be auto-set by backend based on total unpaid
      // Include ALL items (to preserve existing paid/pending items)
      // Only update status to "Paid" for currently selected items
      receiptsList: allReceiptsList.map((item, index) => {
        // Check if this item is in the selected rows
        const isSelected = selectedRows.some((sel) => sel.id === item.id);

        // Get the paid amount (might have been edited via dialog)
        const itemPaid = parseFloat(item.paid || "0");

        // lcAmount is the gross premium including taxes (not netPremium).
        // lcAmount = netPremium + dst + lgt + vat + other - discounts
        const itemGrossPremium = parseFloat(item.lcAmount || "0");

        // Cumulative unpaid: sum of all payments up to this entry.
        // Each receiptsList item represents ONE payment for the same policy
        // unPaid should show: grossPremium - sum(all payments up to and including this one)
        const cumulativePaid = allReceiptsList
          .slice(0, index + 1) // All items up to and including current
          .reduce((sum, listItem) => sum + parseFloat(listItem.paid || "0"), 0);

        const itemUnpaid = Math.max(0, itemGrossPremium - cumulativePaid);

        const isSavedLine =
          item.receiptListId && !String(item.receiptListId).startsWith("payment-");
        return {
          receiptListId: isSavedLine ? item.receiptListId : undefined,
          policies: item.policies,
          netPremium: String(item.netPremium || "0.00"),
          paid: String(itemPaid.toFixed(2)), // Use edited paid value
          unPaid: String(itemUnpaid.toFixed(2)), // cumulative: netPremium - sum(all paid up to this point)
          discounts: String(item.discounts || "0.00"),
          dst: String(item.dst || "0.00"),
          lgt: String(item.lgt || "0.00"),
          vat: String(item.vat || "0.00"),
          ewt: String(item.ewt || "0.00"),
          fcAmount: String(item.fcAmount || "0.00"),
          lcAmount: String(item.lcAmount || "0.00"),
          other: String(item.other || "0.00"),
          status: isSelected ? "Paid" : item.status || "Pending", // Only mark selected items as Paid
        };
      }),
    };

    try {
      await dispatch(
        updateReceiptMiddleware({
          receiptId: customerData.receiptId,
          receiptData,
        })
      ).unwrap();
      // Create invoice list entry for paylater payment
      try {
        const currentUser = getUserData();
        const customerCode = customerData?.customerCode;

        // Calculate totals from captured selected rows (the ones that were just paid)
        const selectedTotals = selectedRows.reduce(
          (acc, item) => {
            const paid = parseFloat(item.paid || "0");
            const vat = parseFloat(item.vat || "0");
            const dst = parseFloat(item.dst || "0");
            const lgt = parseFloat(item.lgt || "0");
            const other = parseFloat(item.other || "0");
            const lcAmount = parseFloat(item.lcAmount || "0");

            return {
              totalPaid: acc.totalPaid + paid,
              totalVat: acc.totalVat + vat,
              totalDst: acc.totalDst + dst,
              totalLgt: acc.totalLgt + lgt,
              totalOther: acc.totalOther + other,
              totalLcAmount: acc.totalLcAmount + lcAmount,
            };
          },
          {
            totalPaid: 0,
            totalVat: 0,
            totalDst: 0,
            totalLgt: 0,
            totalOther: 0,
            totalLcAmount: 0,
          }
        );

        // Use lcAmount (gross premium) as the total amount, or sum of paid amounts
        const totalAmount =
          selectedTotals.totalLcAmount > 0
            ? selectedTotals.totalLcAmount
            : selectedTotals.totalPaid;

        // Calculate lcAmount properly - sum all lcAmount values from selected rows
        const totalLcAmount = selectedRows.reduce((sum, item) => {
          return sum + parseFloat(item.lcAmount || "0");
        }, 0);

        // Map paylater payment data to invoice list fields
        const invoiceListData = {
          customerCode: customerCode || null,
          payables: selectedTotals.totalPaid.toFixed(2), // Use selected items' paid amounts
          outstanding: (capturedPendingTotals.unPaid || 0).toFixed(2), // Use captured value with fallback
          fcAmount: "0.00", // Foreign currency amount
          lcAmount: totalLcAmount.toFixed(2), // Use sum of selected items' lcAmount
          excess: "0.00",
          balAmount: (capturedPendingTotals.unPaid || 0).toFixed(2), // Use captured value with fallback
          vat: selectedTotals.totalVat.toFixed(2), // VAT amount
          wht: "0.00", // Withholding tax (if applicable)
          totalAmount: selectedTotals.totalLcAmount > 0 ? selectedTotals.totalLcAmount.toFixed(2) : selectedTotals.totalPaid.toFixed(2), // Total payment amount
          bankCode: paymentDetails?.bankcode || undefined,
          bankAmount: totalAmount.toFixed(2), // Bank amount
          isInvoicePaid: true, // Payment completed
          createdBy: currentUser?.id,
        };

        const invoiceListResult =
          await disbursementService.createInvoiceList(invoiceListData);

        if (!invoiceListResult.success) {
          throw new Error(
            invoiceListResult.error || "Failed to create invoice list"
          );
        }
      } catch (error) {
        const errorMessage = error?.message || error?.toString() || t("accounts.addReceiptEdit.failedToCreateInvoiceList");
        showErrorMessage(errorMessage, t("common.error"));
      }

      showSuccessMessage(t("accounts.addReceiptEdit.receiptApprovedSuccess"), t("common.success"));

      // Refresh draft receipts list so dropdown updates with latest status
      dispatch(getDraftReceiptsMiddleware());

      // Re-fetch this specific receipt to get updated data from backend
      const updatedReceipt = await dispatch(
        getReceiptByIdMiddleware(customerData.receiptId)
      ).unwrap();

      // Update the receivableTableList with fresh data from backend
      // This ensures the UI shows the correct paid/unpaid amounts
      if (updatedReceipt && updatedReceipt.receiptsList) {
        dispatch(setReceivableTableList(updatedReceipt.receiptsList));

        // Recalculate payment summary with fresh data
        const updatedTotalPaid = updatedReceipt.receiptsList.reduce(
          (sum, item) => sum + parseFloat(item.paid || "0"),
          0
        );
        const updatedTotalUnpaid = updatedReceipt.receiptsList.reduce(
          (sum, item) => sum + parseFloat(item.unPaid || "0"),
          0
        );
        const updatedGrossPremium = updatedReceipt.receiptsList.reduce(
          (sum, item) => sum + parseFloat(item.netPremium || "0"),
          0
        );

        // Clear unsaved changes flag - payment is now recorded
        setHasUnsavedChanges(false);

        // Pre-select just-approved rows (match by policy; IDs are recreated on update)
        const refreshedList = (updatedReceipt.receiptsList || []).map((item) => ({
          ...item,
          id: item.receiptListId || item.id,
          receiptListId: item.receiptListId || item.id,
        }));
        const preselected = refreshedList.filter(
          (item) =>
            normalizeStatus(item?.status) === "Paid" &&
            approvedPolicies.has(String(item.policies ?? ""))
        );
        setSelectedRows(
          preselected.length > 0
            ? preselected
            : refreshedList.filter(
                (item) => normalizeStatus(item?.status) === "Paid"
              )
        );

        // Verify math: paid + unpaid should equal gross premium
        const calculatedTotal = updatedTotalPaid + updatedTotalUnpaid;
        const mathCheck =
          Math.abs(calculatedTotal - updatedGrossPremium) < 0.01; // Allow for floating point precision

        if (!mathCheck) {
          logger.warn(
            "[MATH ERROR] Paid + Unpaid does not equal Gross Premium!",
            {
              expected: updatedGrossPremium,
              actual: calculatedTotal,
              diff: updatedGrossPremium - calculatedTotal,
            }
          );
        }
      }

      // Show the Print button instead of redirecting
      setShowPrintButton(true);
    } catch (error) {
      showErrorMessage(
        error?.message || t("accounts.addReceiptEdit.failedToApproveReceipt"),
        t("common.error")
      );
    }
  };

  // prints the official receipt (the whole receipt or the lines chosen) from the server PDF
  const printReceipt = (lineIds, fileName) => {
    setPrintLoading(true);
    printPdf(documentTemplateService.receiptPdfPath(customerData.receiptId, { lineIds }), { fileName })
      .catch((error) => showErrorMessage(error?.message || t("accounts.addReceiptEdit.failedToPrintReceipt"), t("common.error")))
      .finally(() => setPrintLoading(false));
  };

  const handlePrintAll = () => {
    if (!customerData.receiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }
    printReceipt([], `receipt-${customerData.receiptNumber || customerData.receiptId}.pdf`);
  };

  const handlePrintSelected = () => {
    if (!customerData.receiptId) {
      showErrorMessage(t("accounts.addReceiptEdit.receiptIdMissing"));
      return;
    }
    if (!selectedRows || selectedRows.length === 0) {
      showErrorMessage(t("accounts.addReceiptEdit.selectOneToPrint"));
      return;
    }
    const lineIds = selectedRows.map((row) => row.receiptListId || row.id).filter(Boolean);
    printReceipt(lineIds, `receipt-${customerData.receiptNumber || customerData.receiptId}-selected.pdf`);
  };
  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("accounts.addReceiptEdit.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </React.Fragment>
      );
    },
  };

  const headerStyle = {
    fontSize: 16,
    paddingLeft: 0,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: "none",
  };

  return (
    <div className="overall__add_policy_edit__container">
      <div>
        <span onClick={() => navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">{t("accounts.addReceiptEdit.title")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      {hasUnsavedChanges && (
        <div className="unsaved-changes-warning">
          <i className="pi pi-exclamation-triangle"></i>
          <span>{t("accounts.addReceiptEdit.unsavedChangesWarning")}</span>
        </div>
      )}

      {selectedRows && selectedRows.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--color-surface-muted)",
            borderLeft: "3px solid var(--bv-primary)",
            padding: "8px 12px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "14px",
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i className="pi pi-check-circle" style={{ fontSize: "16px" }}></i>
          <span style={{ fontWeight: "500" }}>
            {t("accounts.addReceiptEdit.itemsSelectedForPayment", { count: selectedRows.length })}
          </span>
        </div>
      )}

      <div
        className="listlable_textcontainer"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <label className="listlable_text">{t("accounts.addReceiptEdit.receivable")}</label>
        <Button
          label={t("accounts.addReceiptEdit.addInvoice")}
          icon="pi pi-plus"
          onClick={handleAddNewPayment}
                    style={{ height: "40px", fontSize: "14px" }}
        />
      </div>
      <Card>
        <div className="card">
          <DataTable
            key={`datatable-${allReceiptsList.length}-${allReceiptsList
              .map((item) => `${item.id}-${item.paid}-${item.status}`)
              .join("-")}`}
            value={allReceiptsList}
            tableStyle={{
              color: "var(--text-color)",
            }}
            selection={selectedRows}
            onSelectionChange={(e) => {
              const nextSelection = Array.isArray(e.value) ? e.value : [];

              // After approve, allow selecting any rows (including Paid) for printing.
              if (showPrintButton) {
                setSelectedRows(nextSelection);
                return;
              }

              const pendingMap = new Map(
                pendingReceivableList.map((item) => [item.id, item])
              );
              const filteredSelection = nextSelection
                .map((item) => pendingMap.get(item.id))
                .filter(Boolean);

              if (filteredSelection.length < nextSelection.length) {
                showErrorMessage(
                  t("accounts.addReceiptEdit.paidItemsCannotSelect"),
                  t("accounts.addReceiptEdit.selectionRestricted")
                );
              }

              setSelectedRows(filteredSelection);
            }}

            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            className="datatable_container"
            selectionMode="checkbox"
            scrollable={true}
            scrollHeight="40vh"
            dataKey="id"
            rowClassName={(rowData) =>
              normalizeStatus(rowData?.status) === "Paid" ? "paid-row" : ""
            }
          >
            <Column
              selectionMode="multiple"
              exportable={false}
              style={{ textAlign: "center" }}
              headerStyle={{
                paddingLeft: 18,
                display: "flex",
                justifyContent: "center",
                paddingTop: 20,
                paddingBottom: 20,
                border: "none",
              }}
            ></Column>
            <Column
              field="policies"
              header={t("accounts.addReceiptEdit.policies")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
            ></Column>
            <Column
              field="transactionCode"
              header={t("accounts.addReceiptEdit.tranCode")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) =>
                customerData?.transactionCode || rowData?.transactionCode || "-"
              }
            ></Column>
            <Column
              field="docNo"
              header={t("accounts.addReceiptEdit.docNo")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => {
                // Generate unique dummy numeric value based on row ID
                if (rowData?.docNo) return rowData.docNo;
                // Create deterministic numeric value from row ID
                const idHash = String(rowData?.id || "")
                  .split("")
                  .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const rowIndex = allReceiptsList.findIndex(
                  (item) => item.id === rowData.id
                );
                return String(10000 + (rowIndex + 1) * 100 + (idHash % 100));
              }}
            ></Column>
            <Column
              field="docDate"
              header={t("accounts.addReceiptEdit.docDate")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => {
                const today = new Date();
                return rowData?.docDate
                  ? formatAppDate(rowData.docDate)
                  : formatAppDate(today);
              }}
            ></Column>
            <Column
              field="dueDate"
              header={t("accounts.addReceiptEdit.dueDate")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => {
                const today = new Date();
                return rowData?.dueDate
                  ? formatAppDate(rowData.dueDate)
                  : formatAppDate(today);
              }}
            ></Column>
            <Column
              sortable
              field="unPaid"
              header={t("accounts.addReceiptEdit.outstandingAmount")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
            ></Column>
            <Column
              field="fcAmount"
              header={t("accounts.addReceiptEdit.receiptAdjustedFc")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
            ></Column>
            <Column
              field="lcAmount"
              header={t("accounts.addReceiptEdit.receiptAdjustedLc")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
            ></Column>
            <Column
              field="ewt"
              header={t("accounts.addReceiptEdit.whtServiceFee")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => rowData?.ewt || "0.00"}
            ></Column>
            <Column
              field="incentiveAmt"
              header={t("accounts.addReceiptEdit.incentiveAmt")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => rowData?.incentiveAmt || "0.00"}
            ></Column>
            <Column
              field="shortageAmt"
              header={t("accounts.addReceiptEdit.shortageAmt")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => rowData?.shortageAmt || "0.00"}
            ></Column>
            <Column
              field="commissionOutstandingAmt"
              header={t("accounts.addReceiptEdit.commissionOutstandingAmt")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => rowData?.commissionOutstandingAmt || "0.00"}
            ></Column>
            <Column
              field="balanceOutstanding"
              header={t("accounts.addReceiptEdit.balanceOutstanding")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "left" }}
              body={(rowData) => rowData?.balanceOutstanding || "0.00"}
            ></Column>
            <Column
              body={renderViewButton}
              header={t("accounts.addReceiptEdit.action")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              style={{ textAlign: "center" }}
            ></Column>
          </DataTable>
        </div>
      </Card>

      {/* Summary Form Section */}
      <div className="form-section">
        <h3 className="form-section-title">{t("accounts.addReceiptEdit.paymentSummaryPending")}</h3>
        <p className="form-section-subtitle">
          {t("accounts.addReceiptEdit.pendingItemsRemaining", { count: pendingReceivableList.length })}
        </p>
        <div className="summary-grid">
          <div className="input-field-container">
            <InputField
              classNames={`policy_input `}
              label={t("accounts.addReceiptEdit.grossPremium")}
              value={formatCurrency(pendingTotals.netPremium)}
              disabled={true}
              placeholder={t("accounts.addReceiptEdit.autoCalculated")}
            />
          </div>

          <div className="input-field-container">
            <InputField
              classNames={`policy_input `}
              label={t("accounts.addReceiptEdit.paidPremium")}
              value={formatCurrency(pendingTotals.paid)}
              disabled={true}
              placeholder={t("accounts.addReceiptEdit.autoCalculated")}
            />
          </div>

          <div className="input-field-container">
            <InputField
              classNames={`policy_input `}
              label={t("accounts.addReceiptEdit.actualPayment")}
              value={formatCurrency(pendingTotals.fcAmount)}
              disabled={true}
              placeholder={t("accounts.addReceiptEdit.autoCalculated")}
            />
          </div>

          <div className="input-field-container">
            <InputField
              classNames={`policy_input `}
              label={t("accounts.addReceiptEdit.totalTaxes")}
              value={formatCurrency(pendingTotals.taxes)}
              disabled={true}
              placeholder={t("accounts.addReceiptEdit.autoCalculated")}
            />
          </div>

          <div className="input-field-container">
            <InputField
              classNames={`policy_input `}
              label={t("accounts.addReceiptEdit.outstandingPremium")}
              value={formatCurrency(pendingTotals.unPaid)}
              disabled={true}
              placeholder={t("accounts.addReceiptEdit.autoCalculated")}
            />
          </div>
        </div>
      </div>

      {paidReceiptsList.length > 0 && (
        <div className="form-section">
          <h3 className="form-section-title">{t("accounts.addReceiptEdit.paidSummary")}</h3>
          <p className="form-section-subtitle">
            {t("accounts.addReceiptEdit.paidItems", { count: paidReceiptsList.length })}
          </p>
          <div className="summary-grid">
            <div className="input-field-container">
              <InputField
                classNames={`policy_input `}
                label={t("accounts.addReceiptEdit.grossPremium")}
                value={formatCurrency(paidTotals.netPremium)}
                disabled={true}
                placeholder={t("accounts.addReceiptEdit.autoCalculated")}
              />
            </div>

            <div className="input-field-container">
              <InputField
                classNames={`policy_input `}
                label={t("accounts.addReceiptEdit.paidPremium")}
                value={formatCurrency(paidTotals.paid)}
                disabled={true}
                placeholder={t("accounts.addReceiptEdit.autoCalculated")}
              />
            </div>

            <div className="input-field-container">
              <InputField
                classNames={`policy_input `}
                label={t("accounts.addReceiptEdit.actualPayment")}
                value={formatCurrency(paidTotals.fcAmount)}
                disabled={true}
                placeholder={t("accounts.addReceiptEdit.autoCalculated")}
              />
            </div>

            <div className="input-field-container">
              <InputField
                classNames={`policy_input `}
                label={t("accounts.addReceiptEdit.totalTaxes")}
                value={formatCurrency(paidTotals.taxes)}
                disabled={true}
                placeholder={t("accounts.addReceiptEdit.autoCalculated")}
              />
            </div>

            <div className="input-field-container">
              <InputField
                classNames={`policy_input `}
                label={t("accounts.addReceiptEdit.outstandingPremium")}
                value={formatCurrency(paidTotals.unPaid)}
                disabled={true}
                placeholder={t("accounts.addReceiptEdit.autoCalculated")}
              />
            </div>
          </div>

          <div className="paid-summary-list">
            {paidReceiptsList.map((item) => (
              <div key={item.id} className="paid-summary-row">
                <span className="paid-summary-policy">
                  {item.policies || "N/A"}
                </span>
                <span className="paid-summary-amount">
                  {formatCurrency(getNumericValue(item.paid))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="next_container"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "20px",
          gap: "10px",
        }}
      >
        {!showPrintButton ? (
          <div className="exit_print_buttons">
            <Button
              label={t("accounts.addReceiptEdit.approve")}
              className="print"
              onClick={handleApprove}
              disabled={!selectedRows || loading}
              loading={loading}
              style={{ minWidth: "150px", padding: "10px 20px" }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button
              label={t("accounts.addReceiptEdit.goToHistory")}
              className="print"
              outlined
              onClick={() => navigate("/accounts/receipts")}
              disabled={printLoading}
              style={{
                minWidth: "160px",
                padding: "10px 20px",
                whiteSpace: "nowrap",
              }}
            />
            <Button
              label={t("accounts.addReceiptEdit.printAll")}
              className="print"
              outlined
              onClick={handlePrintAll}
              disabled={!customerData.receiptId || printLoading || loading}
              loading={printLoading}
              style={{
                minWidth: "150px",
                padding: "10px 20px",
              }}
            />
            <Button
              label={t("accounts.addReceiptEdit.printSelected")}
              className="print"
              onClick={handlePrintSelected}
              disabled={
                !customerData.receiptId ||
                !selectedRows ||
                selectedRows.length === 0 ||
                printLoading ||
                loading
              }
              loading={printLoading}
              style={{
                minWidth: "160px",
                padding: "10px 20px",
              }}
            />
          </div>
        )}
      </div>
      <div className="col-12">
        <Dialog
          header={t("accounts.addReceiptEdit.policyDetails")}
          visible={visiblePopup}
          className="dialog_fields bv-centered"
          style={{ width: "min(720px, 95vw)" }}
          onHide={closePolicyDetails}
          footer={
            <div className="flex justify-content-end gap-2">
              <Button type="button" label={t("accounts.addReceipts.cancel")} text onClick={closePolicyDetails} />
              <Button type="button" label={t("accounts.addReceiptEdit.update")} onClick={formik.handleSubmit} />
            </div>
          }
        >
          <div className="grid">
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.policy}
                onChange={formik.handleChange("policy")}
                error={formik.errors.policy}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.policy")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.lcAmount}
                onChange={formik.handleChange("lcAmount")}
                error={formik.errors.lcAmount}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.receiptAdjustedLc")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
                disabled={true}
              />
            </div>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.paid}
                onChange={(e) => {
                  // When paid changes, auto-calculate unpaid from entry balance
                  const newPaidValue = parseFloat(e.target.value || "0");

                  // Get the ORIGINAL values when popup opened (from editedData)
                  const originalPaid = parseFloat(editedData?.paid || "0");
                  const originalUnpaid = parseFloat(editedData?.unPaid || "0");

                  // Calculate this entry's total balance
                  const entryBalance = originalPaid + originalUnpaid;

                  // Calculate new unpaid from entry balance
                  const calculatedUnpaid = Math.max(
                    0,
                    entryBalance - newPaidValue
                  );

                  formik.setFieldValue("paid", e.target.value);
                  formik.setFieldValue("unPaid", calculatedUnpaid.toFixed(2));

                }}
                error={formik.errors.paid}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.paid")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
                disabled={false}
              />
            </div>
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.unPaid}
                onChange={formik.handleChange("unPaid")}
                error={formik.errors.unPaid}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.outstandingAmountLabel")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
                disabled={true}
              />
            </div>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.discounts}
                onChange={formik.handleChange("discounts")}
                error={formik.errors.discounts}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.discounts")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.dst}
                onChange={formik.handleChange("dst")}
                error={formik.errors.dst}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.dst")}
                disabled={true}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.lgt}
                onChange={formik.handleChange("lgt")}
                error={formik.errors.lgt}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.lgt")}
                disabled={true}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.vat}
                onChange={formik.handleChange("vat")}
                error={formik.errors.vat}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.vat")}
                disabled={true}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.other}
                onChange={formik.handleChange("other")}
                error={formik.errors.other}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.other")}
                disabled={true}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
            <div className="col-12 md:col-6">
              <InputField
                value={formik.values.fcAmount}
                onChange={formik.handleChange("fcAmount")}
                error={formik.errors.fcAmount}
                classNames="field__container"
                label={t("accounts.addReceiptEdit.receiptAdjustedFc")}
                placeholder={t("accounts.journalVoucherDetails.enter")}
              />
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}

export default PolicyReceipts;
