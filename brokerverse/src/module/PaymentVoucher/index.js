import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import SvgDot from "../../assets/icons/SvgDot";
import SvgAdd from "../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import SvgIconeye from "../../assets/icons/SvgIconeye";
import SvgDropdown from "../../assets/icons/SvgDropdown";
import SvgDropdownicon from "../../assets/icons/SvgDropdownicon";
import DropDowns from "../../components/DropDowns";
import { useDispatch, useSelector } from "react-redux";
import LabelWrapper from "../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import {
  paymentVocherMiddleware,
  bulkPrintDisbursementsMiddleware,
  filterPaymentVoucherMiddleware,
} from "./store/paymentVocherMiddleware";
import clientService from "../../services/clientService";
import BulkUploadModal from "./BulkUploadModal";
import { PAGE_SIZE, PAGE_SIZES } from "../../hooks/useServerList";
import { calendarDateFormat, formatDate as formatAppDate, toIsoDate } from "../../utility/dateFormat";
import logger from "../../utility/logger";
import { printPdf } from "../../components/Print";

const Index = () => {
  const { t } = useTranslation();
  const [visiblePopup, setVisiblePopup] = useState(false);
  const [code, setCode] = useState("");
  const [codeTo, setCodeTo] = useState("");
  const [bulkErrors, setBulkErrors] = useState({});
  // Set dateFrom to yesterday (t-1 day) and dateTo to today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(new Date());
  const [clientsData, setClientsData] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [visibleBulkUploadPopup, setVisibleBulkUploadPopup] = useState(false);
  const toast = useRef(null);

  const dispatch = useDispatch();
  const {
    paymentVocherList,
    paymentVocherFilterList,
    pagination,
    bulkPrintLoading,
    loading,
  } = useSelector(({ paymentVoucherReducers }) => {
    return {
      loading: paymentVoucherReducers?.loading,
      paymentVocherList: paymentVoucherReducers?.paymentVocherList,
      paymentVocherSearchList: paymentVoucherReducers?.paymentVocherSearchList,
      paymentVocherFilterList: paymentVoucherReducers?.paymentVocherFilterList,
      pagination: paymentVoucherReducers?.pagination,
      bulkPrintLoading: paymentVoucherReducers?.bulkPrintLoading,
    };
  });
  const handleView = (columnData) => {
    const disbursementId = columnData?.id || columnData?.disbursementId;

    // Store disbursement ID in Redux before navigation
    dispatch({
      type: "paymentVoucher/setCurrentDisbursementId",
      payload: disbursementId,
    });

    // A voucher still being prepared (agent payout lines, or an insurer voucher raised by a settlement)
    // opens its invoice list so the cheque / payout can be raised and approved
    const status = String(columnData?.status || "").toLowerCase();
    const inPreparation =
      ["draft", "for-approval"].includes(status) &&
      (columnData?.payeeType === "Agent/Referrer" || columnData?.referrerId || columnData?.payeeType === "Insurer");
    if (inPreparation) {
      navigate(`/accounts/paymentvoucher/invoicelist/${disbursementId}`);
      return;
    }
    navigate(`/accounts/paymentvoucher/detailview/${disbursementId}`);
  };

  // Customer codes as dropdown options (bulk print modal)
  const getCustomerCodeOptions = () => {
    return clientsData.map((client) => ({
      name: client.customerCode,
      code: client.customerCode,
      clientId: client.clientId,
    }));
  };

  // the required fields are marked; an empty one is named under its field rather than in a toast
  const handleBulkPrint = async () => {
    const missing = { code: !code, dateFrom: !dateFrom, dateTo: !dateTo };
    setBulkErrors(missing);
    if (Object.values(missing).some(Boolean)) return;

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
      // the local calendar day chosen (toISOString would move Manila midnight to the previous UTC day)
      createdAtFrom: toIsoDate(dateFrom),
      createdAtTo: toIsoDate(dateTo),
    };

    try {
      const result = await dispatch(
        bulkPrintDisbursementsMiddleware(filters)
      ).unwrap();

      if (result.success && result.data.url) {
        toast.current?.show({
          severity: "success",
          summary: t("common.success"),
          detail: t("paymentVoucher.disbursementsExportedSuccessfully"),
          life: 3000,
        });

        printPdf(result.data.url, { fileName: result.data.filename }).catch((error) =>
          toast.current?.show({ severity: "error", summary: t("common.error"), detail: error.message, life: 4000 })
        );

        // Close the modal
        setVisiblePopup(false);

        // Reset form
        setCode("");
        setCodeTo("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      } else if (
        result.success === false &&
        result.error?.code === "NO_DATA_FOUND"
      ) {
        toast.current?.show({
          severity: "info",
          summary: t("paymentVoucher.noDataFound"),
          detail:
            result.message ||
            t("paymentVoucher.noDisbursementsFound"),
          life: 4000,
        });

        // Close the modal
        setVisiblePopup(false);

        // Reset form
        setCode("");
        setCodeTo("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      } else {
        toast.current?.show({
          severity: "error",
          summary: t("common.error"),
          detail:
            result.message ||
            t("paymentVoucher.failedToGenerateBulkPrint"),
          life: 3000,
        });
      }
    } catch (error) {
      logger.error("Bulk print error:", error);

      // Extract error information from various error structures
      let errorPayload = null;
      let errorMessage = t("paymentVoucher.failedToGenerateBulkPrint");
      let isNoDataFound = false;

      if (error) {
        // Handle error from rejectWithValue (payload structure) - Redux Toolkit throws with payload
        if (error.payload) {
          errorPayload = error.payload;
          // Check if it's a NO_DATA_FOUND error
          if (
            errorPayload.error?.code === "NO_DATA_FOUND" ||
            errorPayload.code === "NO_DATA_FOUND"
          ) {
            isNoDataFound = true;
          }
          // Extract message from payload
          if (errorPayload.message) {
            errorMessage = errorPayload.message;
          } else if (errorPayload.error?.message) {
            errorMessage = errorPayload.error.message;
          } else if (typeof errorPayload === "string") {
            errorMessage = errorPayload;
          }
        }
        // Handle direct error object (when error itself is the API response structure)
        else if (
          error.error?.code === "NO_DATA_FOUND" ||
          error.code === "NO_DATA_FOUND"
        ) {
          isNoDataFound = true;
          errorMessage =
            error.message ||
            t("paymentVoucher.noDisbursementsFound");
        } else if (error.message) {
          errorMessage = error.message;
        }
        else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
          if (error.response.data.error?.code === "NO_DATA_FOUND") {
            isNoDataFound = true;
          }
        } else if (error.response?.data?.error?.message) {
          errorMessage = error.response.data.error.message;
          if (error.response.data.error.code === "NO_DATA_FOUND") {
            isNoDataFound = true;
          }
        }
      }

      if (isNoDataFound) {
        toast.current?.show({
          severity: "info",
          summary: t("paymentVoucher.noDataFound"),
          detail:
            errorMessage ||
            t("paymentVoucher.noDisbursementsFound"),
          life: 4000,
        });
      } else {
        toast.current?.show({
          severity: "error",
          summary: t("common.error"),
          detail: errorMessage,
          life: 3000,
        });
      }
    }
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
            {t("paymentVoucher.rowCount")}{" "}
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
    fontSize: 14,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: 6,
    color: "#000",
    border: "none",
  };

  const items = [
    {
      id: 1,
      label: t("paymentVoucher.title"),
      to: "/accounts/paymentvoucher",
    },
  ];
  const home = { label: t("paymentVoucher.accounts") };

  const navigate = useNavigate();
  const location = useLocation();
  // the voucher just approved on the payment step: confirmed here and highlighted in the list
  const [recorded, setRecorded] = useState(location.state?.recorded || null);
  const dismissRecorded = () => {
    setRecorded(null);
    navigate(location.pathname, { replace: true, state: null });
  };
  const [globalFilter, setGlobalFilter] = useState();
  const [search, setSearch] = useState("");
  const cities = [
    { name: t("paymentVoucher.disbursementNumber"), code: "VoucherNumber" },
    { name: t("paymentVoucher.transactionNumber"), code: "TransactionNumber" },
    { name: t("paymentVoucher.customerCode"), code: "CustomerCode" },
  ];

  // Fetch disbursements data on component mount
  useEffect(() => {
    // Force clear any cached data
    dispatch({ type: "paymentVoucher/clearData" });

    // Dispatch the middleware
    dispatch(paymentVocherMiddleware({ page: 1, pageSize: PAGE_SIZE }));
  }, [dispatch]);

  // Customer codes of the bulk print modal (/customers/codes: also open to the receipting and disbursement roles,
  // which do not read the client register)
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await clientService.getCustomerCodes();
        if (response.success && Array.isArray(response.data?.data)) {
          setClientsData(response.data.data);
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

  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          filterPaymentVoucherMiddleware({
            field: globalFilter,
            value: search,
            page: 1,
            pageSize: PAGE_SIZE,
          })
        );
      }
    }
  }, [search]);

  const handlePolicy = () => {
    navigate("/accounts/paymentvoucher/createvoucher");
  };
  const handleModal = (rowData) => {
    setBulkErrors({});
    setVisiblePopup(true);
  };

  const handleBulkUploadModal = () => {
    setVisibleBulkUploadPopup(true);
  };

  const handleBulkUploadSuccess = () => {
    // Refresh the disbursements list after successful upload
    dispatch(paymentVocherMiddleware({ page: 1, pageSize: PAGE_SIZE }));
  };

  return (
    <div className="overall__paymentvoucher__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("paymentVoucher.title")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="bulk__text">
          <div className="filter_bulk_button_container">
            <button type="button" className="bulk_button_container" onClick={handleModal}>
              <p className="addtext">{t("paymentVoucher.bulkPrint")}</p>
            </button>
          </div>
          <div className="filter_bulk_button_container">
            <button
              type="button"
              className="bulk_button_container"
              onClick={handleBulkUploadModal}
            >
              <p className="addtext">{t("paymentVoucher.bulkUpload")}</p>
            </button>
          </div>
          <div className="filter_bulk_button_container">
            <button
              type="button"
              className="bulk_button_container"
              onClick={() => navigate("/accounts/paymentvoucher/bulk-disburse")}
            >
              <p className="addtext">{t("paymentVoucher.bulkDisburse.title")}</p>
            </button>
          </div>
          <div className="filterbutton_container">
            <button type="button" className="addbutton_container bv-add-button" onClick={handlePolicy}>
              <SvgAdd />
              <p className="addtext">{t("paymentVoucher.create")}</p>
            </button>
          </div>
        </div>
        <div className="mobile-header-actions">
          <div className="filter_bulk_button_container">
            <button type="button" className="bulk_button_container" onClick={handleModal}>
              <p className="addtext">{t("paymentVoucher.bulkPrint")}</p>
            </button>
          </div>
          <div className="filter_bulk_button_container">
            <button
              type="button"
              className="bulk_button_container"
              onClick={handleBulkUploadModal}
            >
              <p className="addtext">{t("paymentVoucher.bulkUpload")}</p>
            </button>
          </div>
          <div className="filter_bulk_button_container">
            <button
              type="button"
              className="bulk_button_container"
              onClick={() => navigate("/accounts/paymentvoucher/bulk-disburse")}
            >
              <p className="addtext">{t("paymentVoucher.bulkDisburse.title")}</p>
            </button>
          </div>
          <div className="filterbutton_container">
            <button type="button" className="addbutton_container bv-add-button" onClick={handlePolicy}>
              <SvgAdd />
              <p className="addtext">{t("paymentVoucher.create")}</p>
            </button>
          </div>
        </div>
      </div>

      <Card
        className="mt-3"

      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container ">
          <div className="col-12 md:col-6 lg:col-10" style={{ paddingLeft: 0 }}>
            {/* <div className="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("paymentVoucher.searchDisbursements")}
                className="searchinput_left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          {/* </div> */}
          <div className="col-12 md:col-6 lg:col-2">

            <Dropdown
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.value)}
              options={cities}
              optionLabel="name"
              optionValue="code"
              placeholder="Search by"
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
              <div className="voucher-recorded">
                <div>
                  <strong>{t(recorded.printed ? "paymentVoucher.recordedPrintedTitle" : "paymentVoucher.recordedTitle", { voucher: recorded.voucherNumber || "" })}</strong>
                  {recorded.payee && <span className="block">{t("paymentVoucher.recordedPayee", { payee: recorded.payee })}</span>}
                </div>
                <div className="voucher-recorded__actions">
                  <Button type="button" size="small" outlined icon="pi pi-plus" label={t("paymentVoucher.recordAnother")} onClick={handlePolicy} />
                  <Button type="button" size="small" text icon="pi pi-times" aria-label={t("paymentVoucher.dismiss")} onClick={dismissRecorded} tooltip={t("paymentVoucher.dismiss")} tooltipOptions={{ position: "top" }} />
                </div>
              </div>
            }
          />
        )}
        <div className="headlist_lable">{t("paymentVoucher.disbursementHistory")}</div>

        {/* </div> */}

        <div>
          <div className="paymentvoucher-table-container">
            <DataTable
              value={
                search && globalFilter
                  ? paymentVocherFilterList
                  : paymentVocherList
              }
              tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
              rowClassName={(row) =>
                recorded && ((recorded.disbursementId && (row.id || row.disbursementId) === recorded.disbursementId) || (recorded.voucherNumber && row.VoucherNumber === recorded.voucherNumber))
                  ? "voucher-row--recorded"
                  : ""
              }
              // paged by the server: the table shows the page it was given
              lazy
              paginator
              first={((pagination?.currentPage || pagination?.page || 1) - 1) * (pagination?.pageSize || PAGE_SIZE)}
              rows={pagination?.pageSize || PAGE_SIZE}
              rowsPerPageOptions={PAGE_SIZES}
              totalRecords={pagination?.totalRecords ?? pagination?.total ?? 0}
              loading={loading}
              currentPageReportTemplate="{first} - {last} of {totalRecords}"
              paginatorTemplate={template2}
              scrollable={true}
              onPage={(e) => {
                const newPage = e.page + 1; // PrimeReact uses 0-based indexing
                const newPageSize = e.rows;
                if (search && globalFilter) {
                  dispatch(
                    filterPaymentVoucherMiddleware({
                      field: globalFilter,
                      value: search,
                      page: newPage,
                      pageSize: newPageSize,
                    })
                  );
                } else {
                  dispatch(
                    paymentVocherMiddleware({
                      page: newPage,
                      pageSize: newPageSize,
                    })
                  );
                }
              }}
            >
              <Column
                field="VoucherNumber"
                header={t("paymentVoucher.disbursementNumber")}
                sortable
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                field="TransactionNumber"
                header={t("paymentVoucher.transactionNumber")}
                sortable
                headerStyle={headerStyle}
                className="fieldvalue_container"
                body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
              ></Column>
              <Column
                field="CustomerCode"
                header={t("paymentVoucher.customerCode")}
                sortable
                headerStyle={headerStyle}
                className="fieldvalue_container"
                body={(rowData) => rowData.CustomerCode?.toUpperCase()}
              ></Column>
              <Column body={(row) => formatAppDate(row.VoucheDate)}
                field="VoucheDate"
                header={t("paymentVoucher.disbursementDate")}
                sortable
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
              <Column
                field="Amount"
                header={t("paymentVoucher.amount")}
                headerStyle={headerStyle}
                className="fieldvalue_container bv-nowrap"
              ></Column>
              <Column
                field="status"
                header={t("paymentVoucher.status")}
                headerStyle={headerStyle}
                className="fieldvalue_container bv-nowrap"
                style={{ minWidth: "6rem" }}
                body={(rowData) =>
                  rowData.status
                    ? String(rowData.status).replace(/(^|-)(\w)/g, (m, sep, c) => (sep ? " " : "") + c.toUpperCase())
                    : "-"
                }
              ></Column>
              <Column
                body={(columnData) => (
                  <SvgIconeye onClick={() => handleView(columnData)} />
                )}
                header={t("paymentVoucher.action")}
                style={{ textAlign: "center", width: "5rem" }}
                headerStyle={headerStyle}
                className="fieldvalue_container"
              ></Column>
            </DataTable>
          </div>
        </div>
      </Card>
      <div className="col-12">
        <Dialog
          visible={visiblePopup}
          header={t("paymentVoucher.bulkPrint")}
          className="dialog_fields bv-centered"
          onHide={() => {
            setVisiblePopup(false);
          }}
          footer={(
            <>
              <Button type="button" label={t("common.cancel")} text onClick={() => setVisiblePopup(false)} />
              <Button type="button" icon="pi pi-print" label={t("paymentVoucher.printVouchers")} loading={bulkPrintLoading} onClick={handleBulkPrint} />
            </>
          )}
        >
          {/* Customer Code From and To - Dynamic values from API */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={code}
                onChange={(e) => { setCode(e.value); setBulkErrors((x) => ({ ...x, code: false })); }}
                className="dropdown__container"
                label={t("paymentVoucher.customerCodeFrom")}
                required
                error={bulkErrors.code ? t("paymentVoucher.customerCodeFromRequired") : null}
                options={getCustomerCodeOptions()}
                optionLabel="name"
                optionValue="code"
                placeholder={clientsLoading ? t("common.loading") : t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color="currentColor" />}
                disabled={clientsLoading}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={codeTo}
                onChange={(e) => setCodeTo(e.value)}
                className="dropdown__container"
                label={t("paymentVoucher.customerCodeTo")}
                options={getCustomerCodeOptions()}
                optionLabel="name"
                optionValue="code"
                placeholder={clientsLoading ? t("common.loading") : t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color="currentColor" />}
                disabled={clientsLoading}
              />
            </div>
          </div>

          {/* Date From and Date To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper label={t("paymentVoucher.dateFrom")} required>
                <Calendar
                  showIcon
                  className="w-full"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                  }}
                  dateFormat={calendarDateFormat()}
                />
              </LabelWrapper>
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper label={t("paymentVoucher.dateTo")} required>
                <Calendar
                  showIcon
                  className="w-full"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                  }}
                  dateFormat={calendarDateFormat()}
                />
              </LabelWrapper>
            </div>
          </div>

        </Dialog>
      </div>

      <BulkUploadModal
        visible={visibleBulkUploadPopup}
        onHide={() => setVisibleBulkUploadPopup(false)}
        onUploadSuccess={handleBulkUploadSuccess}
      />

      <Toast ref={toast} />
    </div>
  );
};

export default Index;
