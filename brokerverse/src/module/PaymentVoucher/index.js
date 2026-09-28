import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../assets/icons/SvgDot";
import SvgFilters from "../../assets/icons/SvgFilters";
import SvgAdd from "../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { TieredMenu } from "primereact/tieredmenu";
import SvgIconeye from "../../assets/icons/SvgIconeye";
import SvgDropdown from "../../assets/icons/SvgDropdown";
import SvgDropdownicon from "../../assets/icons/SvgDropdownicon";
import DropDowns from "../../components/DropDowns";
import { useDispatch, useSelector } from "react-redux";
import LabelWrapper from "../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import { useFormik } from "formik";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import {
  getPaymentVocherListBySearchMiddleware,
  paymentVocherMiddleware,
  bulkPrintDisbursementsMiddleware,
  filterPaymentVoucherMiddleware,
} from "./store/paymentVocherMiddleware";
import clientService from "../../services/clientService";
import BulkUploadModal from "./BulkUploadModal";

const Index = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [visiblePopup, setVisiblePopup] = useState(false);
  const [code, setCode] = useState("");
  const [codeTo, setCodeTo] = useState("");
  const [division, setDivision] = useState("");
  const [divisionTo, setDivisionTo] = useState("");
  const [number, setNumber] = useState("");
  const [numberto, setNumberTo] = useState("");
  const [cashier, setCashier] = useState("");
  const [cashierto, setCashierto] = useState("");
  // Set dateFrom to yesterday (t-1 day) and dateTo to today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(new Date());
  const [clientsData, setClientsData] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [visibleBulkUploadPopup, setVisibleBulkUploadPopup] = useState(false);
  const toast = useRef(null);

  const dispatch = useDispatch();
  const {
    paymentVocherList,
    paymentVocherSearchList,
    paymentVocherFilterList,
    pagination,
    bulkPrintLoading,
  } = useSelector(({ paymentVoucherReducers }) => {
    return {
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

  const handleBulkPrint = async () => {
    if (!code || !dateFrom || !dateTo) {
      toast.current?.show({
        severity: "warn",
        summary: t("common.error"),
        detail: t("paymentVoucher.fillRequiredFields"),
        life: 4000,
      });
      return;
    }

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

    console.log("Disbursement bulk print filters:", filters);

    try {
      const result = await dispatch(
        bulkPrintDisbursementsMiddleware(filters)
      ).unwrap();

      console.log("Bulk print result:", result);

      if (result.success && result.data.url) {
        toast.current?.show({
          severity: "success",
          summary: t("common.success"),
          detail: t("paymentVoucher.disbursementsExportedSuccessfully"),
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
        setDivision("");
        setDivisionTo("");
        setNumber("");
        setNumberTo("");
        setCashier("");
        setCashierto("");
        setDateFrom(yesterday);
        setDateTo(new Date());
      } else {
        console.log("Bulk print failed - no URL in result:", result);
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
      console.error("Bulk print error:", error);

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
  const initialValue = {
    receiptDate: new Date(),
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
    width: "19%",
    fontSize: 16,
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
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
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
    dispatch(paymentVocherMiddleware({ page: 1, pageSize: 10 }));
  }, [dispatch]);

  // Fetch clients data from API for bulk print modal
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await clientService.getClients(1, 100); // Fetch more clients for dropdown
        if (response.success && response.data?.data?.clients) {
          setClientsData(response.data.data.clients);
        } else {
          console.error("Failed to fetch clients:", response.error);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
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
            pageSize: 10,
          })
        );
      }
    }
  }, [search]);

  const handlePolicy = () => {
    navigate("/accounts/paymentvoucher/createvoucher");
  };
  const handleModal = (rowData) => {
    setVisiblePopup(true);
  };

  const handleBulkUploadModal = () => {
    setVisibleBulkUploadPopup(true);
  };

  const handleBulkUploadSuccess = () => {
    // Refresh the disbursements list after successful upload
    dispatch(paymentVocherMiddleware({ page: 1, pageSize: 10 }));
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
            <div className="bulk_button_container" onClick={handleModal}>
              <p className="addtext">{t("paymentVoucher.bulkPrint")}</p>
            </div>
          </div>
          <div className="filter_bulk_button_container">
            <div
              className="bulk_button_container"
              onClick={handleBulkUploadModal}
            >
              <p className="addtext">{t("paymentVoucher.bulkUpload")}</p>
            </div>
          </div>
          <div className="filter_bulk_button_container">
            <div
              className="bulk_button_container"
              onClick={() => navigate("/accounts/paymentvoucher/bulk-disburse")}
            >
              <p className="addtext">Bulk Disburse</p>
            </div>
          </div>
          <div className="filterbutton_container">
            <div className="addbutton_container" onClick={handlePolicy}>
              <SvgAdd />
              <p className="addtext">{t("paymentVoucher.create")}</p>
            </div>
          </div>
        </div>
        <div className="mobile-header-actions">
          <div className="filter_bulk_button_container">
            <div className="bulk_button_container" onClick={handleModal}>
              <p className="addtext">{t("paymentVoucher.bulkPrint")}</p>
            </div>
          </div>
          <div className="filter_bulk_button_container">
            <div
              className="bulk_button_container"
              onClick={handleBulkUploadModal}
            >
              <p className="addtext">{t("paymentVoucher.bulkUpload")}</p>
            </div>
          </div>
          <div className="filter_bulk_button_container">
            <div
              className="bulk_button_container"
              onClick={() => navigate("/accounts/paymentvoucher/bulk-disburse")}
            >
              <p className="addtext">Bulk Disburse</p>
            </div>
          </div>
          <div className="filterbutton_container">
            <div className="addbutton_container" onClick={handlePolicy}>
              <SvgAdd />
              <p className="addtext">{t("paymentVoucher.create")}</p>
            </div>
          </div>
        </div>
      </div>

      <Card
        className="mt-3"

        //   className="overallcard_container"
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
            {/* <TieredMenu model={menuitems} popup ref={menu} breakpoint="767px" /> */}

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

            {/* <Button
              label="Search by"
              outlined
              icon={<SvgDropdownicon />}
              className="sorbyfilter_container"
              onClick={(e) => menu.current.toggle(e)}
            /> */}
          </div>
        </div>
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
              paginator
              rows={pagination?.pageSize || 10}
              rowsPerPageOptions={[5, 10, 25, 50]}
              totalRecords={pagination?.totalRecords || 0}
              currentPageReportTemplate="{first} - {last} of {totalRecords}"
              paginatorTemplate={template2}
              scrollable={true}
              scrollHeight="40vh"
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
              <Column
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
                className="fieldvalue_container"
              ></Column>
              <Column
                field="status"
                header={t("paymentVoucher.status")}
                headerStyle={headerStyle}
                className="fieldvalue_container"
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
                style={{ textAlign: "center" }}
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
                label={t("paymentVoucher.divisionCodeFrom")}
                options={divisionOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={divisionTo}
                onChange={(e) => setDivisionTo(e.value)}
                className="dropdown__container"
                label={t("paymentVoucher.divisionCodeTo")}
                options={divisionOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
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
                label={t("paymentVoucher.orNumberFrom")}
                options={orNumberOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={numberto}
                onChange={(e) => setNumberTo(e.value)}
                className="dropdown__container"
                label={t("paymentVoucher.orNumberTo")}
                options={orNumberOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>

          {/* Customer Code From and To - Dynamic values from API */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={code}
                onChange={(e) => setCode(e.value)}
                className="dropdown__container"
                label={t("paymentVoucher.customerCodeFrom")}
                options={getCustomerCodeOptions()}
                optionLabel="name"
                optionValue="code"
                placeholder={clientsLoading ? t("common.loading") : t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
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
                label={t("paymentVoucher.cashierIdFrom")}
                options={cashierOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DropDowns
                value={cashierto}
                onChange={(e) => setCashierto(e.value)}
                className="dropdown__container"
                label={t("paymentVoucher.cashierIdTo")}
                options={cashierOptions}
                optionLabel="name"
                optionValue="code"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>

          {/* Date From and Date To */}
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper className="calenderlable__container">
                {t("paymentVoucher.dateFrom")}
              </LabelWrapper>
              <Calendar
                classNames="calender__container"
                showIcon
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <LabelWrapper className="calenderlable__container">
                {t("paymentVoucher.dateTo")}
              </LabelWrapper>
              <Calendar
                classNames="calender__container"
                showIcon
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                }}
                dateFormat="yy-mm-dd"
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
                {bulkPrintLoading ? t("paymentVoucher.generating") : t("paymentVoucher.generate")}
              </div>
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
