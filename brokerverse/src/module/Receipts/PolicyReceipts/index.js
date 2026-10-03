import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Message } from "primereact/message";
import documentTemplateService from "../../../services/documentTemplateService";
import emailService from "../../../services/emailService";
import EmailDocumentDialog from "../../../components/EmailDocumentDialog";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgAdd from "../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import SvgEye from "../../../assets/icons/SvgEye";
import { useDispatch, useSelector } from "react-redux";
import SvgDropdownicon from "../../../assets/icons/SvgDropdownicon";
import {
  getReceiptsListByFilterMiddleware,
  getReceiptsListMiddleware,
  getReceiptsListByIdMiddleware,
  bulkPrintReceiptsMiddleware,
} from "../store/receiptsMiddleware";
import { clearBulkPrintError } from "../store/receiptsReducers";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import { Toast } from "primereact/toast";
import clientService from "../../../services/clientService";
import BulkUploadModal from "../BulkUploadModal";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";

const CONVERTED = "Converted";

const PolicyReceipts = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const policyId = searchParams.get("policyId");
  const { formatCurrency } = useFormatCurrency();

  const [visiblePopup, setVisiblePopup] = useState(false);
  const [visibleBulkUploadPopup, setVisibleBulkUploadPopup] = useState(false);
  const [cashierto, setCashierto] = useState("");
  const [cashier, setCashier] = useState("");
  const [division, setDivision] = useState("");
  const [divisionTo, setDivisionTo] = useState("");
  const [number, setNumber] = useState("");
  const [numberto, setNumberTo] = useState("");
  const [code, setCode] = useState("");
  const [codeTo, setCodeTo] = useState("");
  // Set dateFrom to yesterday (t-1 day) and dateTo to today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(new Date());
  const [clientsData, setClientsData] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const toast = useRef(null);
  const [errorHandled, setErrorHandled] = useState(false);
  const items = [
    {
      label: t("accounts.receipts.title"),
      to: "/accounts/receipts",
    },
  ];
  // Division Code options
  const divisionOptions = [
    { name: "DIV001", code: "DIV001" },
    { name: "DIV002", code: "DIV002" },
    { name: "DIV003", code: "DIV003" },
  ];

  // OR Number options
  const orNumberOptions = [
    { name: "OR001", code: "OR001" },
    { name: "OR002", code: "OR002" },
    { name: "OR003", code: "OR003" },
  ];

  // Cashier ID options
  const cashierOptions = [
    { name: "CASH001", code: "CASH001" },
    { name: "CASH002", code: "CASH002" },
    { name: "CASH003", code: "CASH003" },
  ];
  // Remove minDate restriction to allow selecting today and past dates
  const search = [
    { name: t("accounts.receipts.searchName"), value: "name" },
    { name: t("accounts.receipts.searchCustomerCode"), value: "customerCode" },
    { name: t("accounts.receipts.searchTransactionNumber"), value: "transactionNumber" },
    { name: t("accounts.receipts.searchTransactionCode"), value: "transactionCode" },
  ];

  const {
    receiptsTableList,
    loading,
    receiptsFilterTable,
    pagination,
    bulkPrintLoading,
    bulkPrintError,
  } = useSelector(({ receiptsTableReducers }) => {
    return {
      loading: receiptsTableReducers?.loading,
      receiptsTableList: receiptsTableReducers?.receiptsTableList,
      receiptsSearchTable: receiptsTableReducers?.receiptsSearchTable,
      receiptsFilterTable: receiptsTableReducers?.receiptsFilterTable,
      pagination: receiptsTableReducers?.pagination,
      bulkPrintData: receiptsTableReducers?.bulkPrintData,
      bulkPrintLoading: receiptsTableReducers?.bulkPrintLoading,
      bulkPrintError: receiptsTableReducers?.error,
    };
  });
  // The history lists Converted (fully paid) receipts only; the server filters them.
  const safeReceiptsList = Array.isArray(receiptsTableList)
    ? receiptsTableList
    : [];
  const convertedFilteredReceipts = Array.isArray(receiptsFilterTable)
    ? receiptsFilterTable
    : [];

  // Transform clients data to dropdown options for Customer Code (for bulk print modal)
  const getCustomerCodeOptions = () => {
    return clientsData.map((client) => ({
      name: client.generatedClientId || client.clientId,
      code: client.generatedClientId || client.clientId,
      clientId: client.clientId,
      firstName: client.firstName,
      lastName: client.lastName,
      companyName: client.companyName,
    }));
  };

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("accounts.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </>
      );
    },
  };

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    textalign: "center",
  };
  const headerStyle1 = {
    width: "10%",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    textalign: "center",
  };
  const headerStyle2 = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: "none",
    textalign: "center",
  };
  const headerStyle3 = {
    width: "8%",

    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: "none",
    textalign: "center",
  };

  const home = { label: t("sidebar.Accounts") };

  const navigate = useNavigate();
  const location = useLocation();
  // the receipt just recorded on Record Receipt: confirmed here, shown first in the list and highlighted
  const [recorded, setRecorded] = useState(location.state?.recorded || null);
  const [emailRecordedOpen, setEmailRecordedOpen] = useState(false);
  const dismissRecorded = () => {
    setRecorded(null);
    navigate(location.pathname + location.search, { replace: true, state: null });
  };
  const printRecorded = async () => {
    const r = await documentTemplateService.getReceiptPdf(recorded.receiptId, { fileName: `receipt-${recorded.receiptNumber}.pdf` });
    if (!r.success) toast.current?.show({ severity: "error", summary: t("accounts.receipts.error"), detail: r.error });
  };

  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [globalFilter, setGlobalFilter] = useState();
  const dispatch = useDispatch();
  const [searches, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Load receipts data on component mount
  useEffect(() => {
    const filters = { page: currentPage, pageSize: rows, receiptStatus: CONVERTED };

    // Add policyId filter if provided in URL
    if (policyId) {
      filters.policyId = policyId;
    }

    dispatch(getReceiptsListMiddleware(filters));
    // Clear any stale bulk print errors on component mount
    dispatch(clearBulkPrintError());
    setErrorHandled(false);
  }, [dispatch, currentPage, rows, policyId]);

  // Fetch clients data from API for bulk print modal
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await clientService.getClients(1, 100); // Fetch more clients for dropdown
        if (response.success && response.data?.data?.clients) {
          setClientsData(response.data.data.clients);
        } else {
          logger.error("Failed to fetch clients:", response.error);
        }
      } catch (error) {
        logger.error("Error fetching clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Handle bulk print error from Redux state - only when there's an actual error from bulk print operation
  useEffect(() => {
    // Only show error if there's a bulk print error AND we're not in the middle of a bulk print operation AND modal is open
    if (bulkPrintError && !errorHandled && !bulkPrintLoading && visiblePopup) {
      let isNoDataFound = false;
      let errorMessage = t("accounts.receipts.bulkPrintError");

      // Check if error is a string
      if (
        typeof bulkPrintError === "string" &&
        bulkPrintError.includes("No receipts found")
      ) {
        isNoDataFound = true;
        errorMessage = bulkPrintError;
      }
      // Check if error is an object with success: false and message (direct API response)
      else if (
        typeof bulkPrintError === "object" &&
        bulkPrintError.success === false &&
        bulkPrintError.message
      ) {
        isNoDataFound = true;
        errorMessage = bulkPrintError.message;
      }
      // Check if error is an object with the expected structure
      else if (
        typeof bulkPrintError === "object" &&
        bulkPrintError.error?.code === "NO_DATA_FOUND"
      ) {
        isNoDataFound = true;
        errorMessage =
          bulkPrintError.message ||
          t("accounts.receipts.noReceiptsFound");
      }
      // Check if error is an object with code directly
      else if (
        typeof bulkPrintError === "object" &&
        bulkPrintError.code === "NO_DATA_FOUND"
      ) {
        isNoDataFound = true;
        errorMessage =
          bulkPrintError.message ||
          t("accounts.receipts.noReceiptsFound");
      }

      if (isNoDataFound) {
        setErrorHandled(true); // Mark as handled to prevent duplicate
        toast.current?.show({
          severity: "info",
          summary: t("accounts.receipts.noDataFound"),
          detail: errorMessage,
          life: 4000,
        });

        // Close the modal
        setVisiblePopup(false);

        // Reset form
        setCode("");
        setCodeTo("");
        setDivision("");
        setDivisionTo("");
        setNumber("");
        setNumberTo("");
        setCashier("");
        setCashierto("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      }
    }
  }, [bulkPrintError, errorHandled, bulkPrintLoading, visiblePopup]);

  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (searches?.length > 0) {
        dispatch(
          getReceiptsListByFilterMiddleware({
            field: globalFilter,
            value: searches,
            page: currentPage,
            pageSize: rows,
            receiptStatus: CONVERTED,
          })
        );
      }
    }
  }, [searches, globalFilter, currentPage, rows]);

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
    const newPage = Math.floor(event.first / event.rows) + 1;
    setCurrentPage(newPage);

    // If we have search criteria, use filter API, otherwise use regular API
    if (searches && globalFilter) {
      dispatch(
        getReceiptsListByFilterMiddleware({
          field: globalFilter,
          value: searches,
          page: newPage,
          pageSize: event.rows,
          receiptStatus: CONVERTED,
        })
      );
    } else {
      const filters = { page: newPage, pageSize: event.rows, receiptStatus: CONVERTED };

      // Add policyId filter if provided in URL
      if (policyId) {
        filters.policyId = policyId;
      }

      dispatch(getReceiptsListMiddleware(filters));
    }
  };

  const handlePolicy = () => {
    navigate("/accounts/receipts/addreceipts");
  };
  const handleArrowClick = (rowData) => {
    // Use receiptId for the API call instead of receiptNumber
    dispatch(getReceiptsListByIdMiddleware(rowData.id));
    navigate("/accounts/receipts/receiptdetailview");
  };

  const handleModal = () => {
    setVisiblePopup(true);
    // Reset error state when opening modal
    dispatch(clearBulkPrintError());
    setErrorHandled(false);
  };

  const handleBulkUploadModal = () => {
    setVisibleBulkUploadPopup(true);
  };

  const handleBulkUploadSuccess = () => {
    // Refresh the receipts list after successful upload
    const filters = { page: currentPage, pageSize: rows, receiptStatus: CONVERTED };
    if (policyId) {
      filters.policyId = policyId;
    }
    dispatch(getReceiptsListMiddleware(filters));
  };

  const handleBulkPrint = async () => {
    if (!code || !dateFrom || !dateTo) {
      toast.current?.show({
        severity: "warn",
        summary: t("common.error"),
        detail: t("accounts.receipts.fillRequiredFields"),
        life: 3000,
      });
      return;
    }

    // Reset error handled flag for new operation
    setErrorHandled(false);

    // Force string conversion to ensure we always get a string value
    let customerCodeString;
    if (typeof code === "string") {
      customerCodeString = code;
    } else if (code && typeof code === "object") {
      customerCodeString =
        code.customerCode || code.code || code.name || JSON.stringify(code);
    } else {
      customerCodeString = String(code);
    }

    // Handle customer code "To" field
    let customerCodeToString = "";
    if (codeTo) {
      if (typeof codeTo === "string") {
        customerCodeToString = codeTo;
      } else if (codeTo && typeof codeTo === "object") {
        customerCodeToString =
          codeTo.customerCode ||
          codeTo.code ||
          codeTo.name ||
          JSON.stringify(codeTo);
      } else {
        customerCodeToString = String(codeTo);
      }
    }

    const filters = {
      customerCodeFrom: customerCodeString,
      customerCodeTo: customerCodeToString,
      createdAtFrom: dateFrom.toISOString().split("T")[0], // Format as YYYY-MM-DD
      createdAtTo: dateTo.toISOString().split("T")[0], // Format as YYYY-MM-DD
    };

    try {
      const result = await dispatch(
        bulkPrintReceiptsMiddleware(filters)
      ).unwrap();

      if (result.success && result.data.url) {
        // Show success message when data is found and file is generated
        toast.current?.show({
          severity: "success",
          summary: t("accounts.receipts.success"),
          detail: t("accounts.receipts.receiptsExportedSuccessfully"),
          life: 3000,
        });

        // Download the file
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Close the modal
        setVisiblePopup(false);

        // Reset form
        setCode("");
        setCodeTo("");
        setDivision("");
        setDivisionTo("");
        setNumber("");
        setNumberTo("");
        setCashier("");
        setCashierto("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      } else if (
        result.success === false &&
        result.error?.code === "NO_DATA_FOUND"
      ) {
        // Show info message when no data is found
        toast.current?.show({
          severity: "info",
          summary: t("accounts.receipts.noDataFound"),
          detail:
            result.message || t("accounts.receipts.noReceiptsFound"),
          life: 4000,
        });

        // Close the modal
        setVisiblePopup(false);

        // Reset form
        setCode("");
        setCodeTo("");
        setDivision("");
        setDivisionTo("");
        setNumber("");
        setNumberTo("");
        setCashier("");
        setCashierto("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      } else {
        // Handle other error cases
        toast.current?.show({
          severity: "error",
          summary: t("accounts.receipts.error"),
          detail:
            result.message || t("accounts.receipts.bulkPrintError"),
          life: 3000,
        });
      }
    } catch (error) {
      logger.error("Bulk print error:", error);
      logger.error("Error type:", typeof error);
      logger.error("Error structure:", JSON.stringify(error, null, 2));

      // Only handle non-"No data found" errors here
      // "No data found" errors are handled by the Redux state useEffect
      let isNoDataFound = false;

      if (error && typeof error === "object") {
        // Check if this is a "No data found" error - if so, let Redux handle it
        if (
          error.error?.code === "NO_DATA_FOUND" ||
          error.code === "NO_DATA_FOUND" ||
          (error.payload && error.payload.error?.code === "NO_DATA_FOUND") ||
          (error.response &&
            error.response.data &&
            error.response.data.error?.code === "NO_DATA_FOUND") ||
          (error.success === false && error.message)
        ) {
          isNoDataFound = true;
        }
      } else if (
        typeof error === "string" &&
        error.includes("No receipts found")
      ) {
        isNoDataFound = true;
      }

      // Only show error toast for non-"No data found" errors
      if (!isNoDataFound) {
        toast.current?.show({
          severity: "error",
          summary: t("accounts.receipts.error"),
          detail: t("accounts.receipts.bulkPrintError"),
          life: 3000,
        });
      }
    }
  };

  // Real buttons (keyboard focus, Enter / Space) for the header actions; rendered for desktop and mobile layouts.
  const headerActions = (
    <>
      <div className="filter_bulk_button_container">
        <Button type="button" className="bulk_button_container" onClick={handleModal}>
          <span className="addtext">{t("accounts.receipts.bulkPrint")}</span>
        </Button>
      </div>
      <div className="filter_bulk_button_container">
        <Button type="button" className="bulk_button_container" onClick={handleBulkUploadModal}>
          <span className="addtext">{t("accounts.receipts.bulkUpload")}</span>
        </Button>
      </div>
      <div className="filterbutton_container">
        <Button type="button" className="addbutton_container" onClick={handlePolicy}>
          <SvgAdd className="addicon" aria-hidden="true" />
          <span className="addtext">{t("accounts.receipts.receipt")}</span>
        </Button>
      </div>
    </>
  );

  return (
    <div className="overall__policyreceipts__container mt-1">
      {/* Policy ID Filter Indicator */}
      {policyId && (
        <div
          style={{
            backgroundColor: "#e3f2fd",
            border: "1px solid #1976d2",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "#1976d2", fontWeight: "500" }}>
            {t("accounts.receipts.filteredByPolicyId")} {policyId}
          </span>
          <button
            onClick={() => navigate("/accounts/receipts")}
            style={{
              background: "none",
              border: "none",
              color: "#1976d2",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "14px",
            }}
          >
            {t("accounts.receipts.clearFilter")}
          </button>
        </div>
      )}

      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("accounts.receipts.title")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="bulk__texts">
          {headerActions}
        </div>
        {/* Mobile/Tablet Actions - moved below title */}
        <div className="mobile-header-actions">
          {headerActions}
        </div>
      </div>

      <Card className="mt-3">
        <div className="header_search_container ">
          <div
            className="col-12 md:col-8 lg:col-10"
            style={{ paddingLeft: "0" }}
          >
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("accounts.receipts.searchByCustomerCode")}
                className="searchinput_left"
                value={searches}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>

          <div className="col-12 md:col-4 lg:col-2">
            <Dropdown
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.value)}
              options={search}
              optionLabel="name"
              optionValue="value"
              placeholder={t("accounts.receipts.searchByPlaceholder")}
              className="sorbyfilter_container"
              dropdownIcon={<SvgDropdownicon />}
            />
          </div>
        </div>
        {recorded && (
          <Message
            severity="success"
            className="w-full justify-content-start mb-3"
            content={
              <div className="receipt-recorded">
                <div>
                  <strong>{t("accounts.receipts.recordedTitle", { receipt: recorded.receiptNumber })}</strong>
                  <span className="block">
                    {recorded.remaining > 0
                      ? t("accounts.receipts.recordedPartial", { amount: formatCurrency(recorded.amount), bill: recorded.billNumber, balance: formatCurrency(recorded.remaining) })
                      : t("accounts.receipts.recordedPaid", { amount: formatCurrency(recorded.amount), bill: recorded.billNumber })}
                  </span>
                </div>
                <div className="receipt-recorded__actions">
                  {recorded.receiptId && <Button type="button" size="small" outlined icon="pi pi-print" label={t("accounts.receipts.printReceipt")} onClick={printRecorded} />}
                  {recorded.receiptId && <Button type="button" size="small" outlined icon="pi pi-envelope" label={t("emailDocument.emailReceipt")} onClick={() => setEmailRecordedOpen(true)} />}
                  <Button type="button" size="small" outlined icon="pi pi-plus" label={t("accounts.receipts.recordAnother")} onClick={() => navigate("/accounts/receipts/addreceipts")} />
                  <Button type="button" size="small" text icon="pi pi-times" aria-label={t("accounts.receipts.dismiss")} onClick={dismissRecorded} />
                </div>
              </div>
            }
          />
        )}
        {recorded?.receiptId && (
          <EmailDocumentDialog
            visible={emailRecordedOpen}
            onHide={() => setEmailRecordedOpen(false)}
            title={t("emailDocument.emailReceiptTitle", { number: recorded.receiptNumber })}
            defaultTo={recorded.clientEmail || ""}
            fileName={`receipt-${recorded.receiptNumber}.pdf`}
            send={(body) => emailService.emailReceipt(recorded.receiptId, body)}
          />
        )}
        <div className="listlable_textcontainer">
          <label className="listlable_text">{t("accounts.receipts.receiptsHistory")}</label>
        </div>

        <div className="card">
          <div className="receipts-table-container">
            <DataTable
              value={
                searches && globalFilter
                  ? convertedFilteredReceipts
                  : safeReceiptsList
              }
              tableStyle={{
                minWidth: "50rem",
                color: "#2e2e2e",
                maxHeight: "50vh",
                overflowy: "auto",
              }}
              scrollable={true}
              scrollHeight="40vh"
              rowClassName={(row) => (recorded && row.receiptNumber === recorded.receiptNumber ? "receipt-row--recorded" : "")}
              paginator
              lazy
              rows={rows}
              totalRecords={pagination?.total ?? safeReceiptsList.length}
              first={first}
              onPage={onPageChange}
              rowsPerPageOptions={[5, 10, 25, 50]}
              currentPageReportTemplate="{first} - {last} of {totalRecords}"
              paginatorTemplate={template2}
              className="datatable_container"
              loading={loading}
            >
              <Column
                sortable
                field="receiptNumber"
                header={t("accounts.receipts.receiptNumber")}
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                field="transactionCode"
                header={t("accounts.transactionCode")}
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                sortable
                field="transactionNumber"
                header={t("accounts.transactionNumber")}
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                sortable
                field="policyNumber"
                header={t("accounts.receipts.policyNumber")}
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                sortable
                field="name"
                header={t("common.name")}
                headerStyle={headerStyle1}
                className="fieldvalue_container receipts_name_cell"
                body={(rowData) => rowData.name}
              ></Column>
              <Column
                sortable
                field="customerCode"
                header={t("accounts.receipts.searchCustomerCode")}
                headerStyle={headerStyle2}
                className="fieldvalue_container"
              ></Column>
              <Column body={(row) => formatAppDate(row.date)}
                sortable
                field="date"
                header={t("common.date")}
                headerStyle={headerStyle1}
                className="fieldvalue_container"
              ></Column>
              <Column
                field="amount"
                header={t("accounts.receipts.amount")}
                headerStyle={headerStyle3}
                className="fieldvalue_container"
                body={(rowData) => formatCurrency(rowData.amount ?? 0)}
              ></Column>
              <Column
                field="totalPaid"
                header={t("accounts.paid")}
                headerStyle={headerStyle3}
                className="fieldvalue_container"
                body={(rowData) => {
                  const paymentsList = rowData.receiptsList || [];

                  if (paymentsList.length === 0) {
                    return formatCurrency(0);
                  }

                  // Show individual payment amounts
                  if (paymentsList.length === 1) {
                    const paid = parseFloat(paymentsList[0].paid || "0");
                    return formatCurrency(paid);
                  }

                  // Multiple payments - show breakdown
                  const totalPaid = paymentsList.reduce(
                    (sum, item) => sum + parseFloat(item.paid || "0"),
                    0
                  );

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div style={{ fontWeight: "600", color: "#10b981" }}>
                        {t("accounts.receipts.total")} {formatCurrency(totalPaid)}
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        {paymentsList.map((payment, idx) => (
                          <div key={idx}>
                            #{idx + 1}: {formatCurrency(parseFloat(payment.paid || "0"))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              ></Column>
              <Column
                field="totalUnpaid"
                header={t("accounts.unpaid")}
                headerStyle={headerStyle3}
                className="fieldvalue_container"
                body={(rowData) => {
                  // Calculate total unpaid from receiptsList
                  const totalUnpaid =
                    rowData.receiptsList?.reduce(
                      (sum, item) => sum + parseFloat(item.unPaid || "0"),
                      0
                    ) || 0;
                  return formatCurrency(totalUnpaid);
                }}
              ></Column>
              <Column
                field="receiptStatus"
                header={t("common.status")}
                headerStyle={headerStyle3}
                className="fieldvalue_container"
                body={(rowData) => {
                  const status = rowData.receiptStatus || "Draft";
                  const statusLabel =
                    status === "Converted"
                      ? t("accounts.receipts.statusConverted")
                      : status === "Draft"
                      ? t("accounts.receipts.statusDraft")
                      : status;
                  const statusColor =
                    status === "Converted"
                      ? "#10b981"
                      : status === "Draft"
                      ? "#f59e0b"
                      : "#6b7280";
                  return (
                    <span
                      style={{
                        backgroundColor: statusColor + "20",
                        color: statusColor,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {statusLabel}
                    </span>
                  );
                }}
              ></Column>
              <Column
                field="paymentCount"
                header={t("accounts.receipts.payments")}
                headerStyle={headerStyle3}
                className="fieldvalue_container"
                body={(rowData) => {
                  const count = rowData.receiptsList?.length || 0;
                  return count > 0
                    ? t("accounts.receipts.paymentCount", { count })
                    : "-";
                }}
              ></Column>

              <Column
                // sortable
                body={(rowData) => (
                  <SvgEye onClick={() => handleArrowClick(rowData)} />
                )}
                header={t("accounts.receipts.action")}
                headerStyle={headerStyle}
                className="fieldvalue_containers"
              ></Column>
            </DataTable>
          </div>
        </div>
      </Card>
      <div className="col-12">
        <Dialog
          visible={visiblePopup}
          className="dialog_fields"
          onHide={() => {
            setVisiblePopup(false);
          }}
        >
          {/* Division Code From and To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={division}
                onChange={(e) => setDivision(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.divisionCodeFrom")}
                options={divisionOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={divisionTo}
                onChange={(e) => setDivisionTo(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.divisionCodeTo")}
                options={divisionOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>

          {/* OR Number From and To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={number}
                onChange={(e) => setNumber(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.orNumberFrom")}
                options={orNumberOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={numberto}
                onChange={(e) => setNumberTo(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.orNumberTo")}
                options={orNumberOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>

          {/* Customer Code From and To - Dynamic values from API data */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={code}
                onChange={(e) => setCode(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.customerCodeFrom")}
                options={getCustomerCodeOptions()}
                optionLabel="name"
                optionValue="code"
                placeholder={clientsLoading ? t("common.loading") : t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={clientsLoading}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={codeTo}
                onChange={(e) => setCodeTo(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.customerCodeTo")}
                options={getCustomerCodeOptions()}
                optionLabel="name"
                optionValue="code"
                placeholder={clientsLoading ? t("common.loading") : t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={clientsLoading}
              />
            </div>
          </div>

          {/* Cashier ID From and To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={cashier}
                onChange={(e) => setCashier(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.cashierIdFrom")}
                options={cashierOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={cashierto}
                onChange={(e) => setCashierto(e.value)}
                className="dropdown__container"
                label={t("accounts.receipts.cashierIdTo")}
                options={cashierOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("accounts.receipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>

          {/* Date From and Date To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper className="calenderlable__container">
                {t("accounts.receipts.dateFrom")}
              </LabelWrapper>
              <Calendar
                classNames="calender__container"
                showIcon
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper className="calenderlable__container">
                {t("accounts.receipts.dateTo")}
              </LabelWrapper>
              <Calendar
                classNames="calender__container"
                showIcon
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
          </div>

          <div className="update_btn">
            <div
              className="cursor-pointer"
              onClick={handleBulkPrint}
              disabled={bulkPrintLoading}
            >
              <div className="update_btnlabel">
                {bulkPrintLoading ? t("accounts.receipts.generating") : t("accounts.receipts.generate")}
              </div>
            </div>
          </div>
        </Dialog>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        visible={visibleBulkUploadPopup}
        onHide={() => setVisibleBulkUploadPopup(false)}
        onUploadSuccess={handleBulkUploadSuccess}
      />

      <Toast ref={toast} />
    </div>
  );
};

export default PolicyReceipts;
