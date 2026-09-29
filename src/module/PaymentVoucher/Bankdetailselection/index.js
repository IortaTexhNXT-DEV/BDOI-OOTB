import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SubmitButton from "../../../components/SubmitButton";
import SvgDot from "../../../assets/icons/SvgDot";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useLocation, useNavigate } from "react-router-dom";
import NavBar from "../../../components/NavBar";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Productdata from "./mock";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import SvgEditIcon from "../../../assets/icons/SvgEditicons";
import { isDisabled } from "@testing-library/user-event/dist/utils";
import { useDispatch, useSelector } from "react-redux";
import { patchpaymentStatusByIdMiddleware } from "../store/paymentVocherMiddleware";
import CustomToast from "../../../components/Toast";
import disbursementService from "../../../services/disbursementService";

function Bankdetailselection() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toastRef = useRef(null);
  const [date, setDate] = useState(null);
  const dispatch = useDispatch();
  const [selectedProducts, setSelectedProducts] = useState(null);
  const [visible, setVisible] = useState(false);
  console.log("first", selectedProducts);
  const Navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);
  const [bankaccountitem, setBankaccount] = useState(null);
  const [actionToast, setactionToast] = useState(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [checkbookList, setCheckbookList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);
  const location = useLocation();
  const locationState = location.state || {};
  const { disbursementData: disbursementDataFromState } = locationState;
  const isAgentPayee = Boolean(
    locationState.isAgentPayee ||
      locationState.disbursementData?.PayeeType?.code === "Agent/Referrer" ||
      locationState.disbursementData?.PayeeType === "Agent/Referrer"
  );
  const commissionLineIdsFromState = locationState.commissionLineIds || [];
  const agentDisbursementId =
    locationState.disbursementId ||
    locationState.disbursementData?.disbursementId;

  const { selectedInvoiceIds, currentDisbursementId, selectedCommissionLineIds } =
    useSelector(({ paymentVoucherReducers }) => {
      return {
        selectedInvoiceIds: paymentVoucherReducers?.selectedInvoiceIds || [],
        selectedCommissionLineIds:
          paymentVoucherReducers?.selectedCommissionLineIds || [],
        currentDisbursementId:
          paymentVoucherReducers?.currentDisbursementId || null,
      };
    });

  // Function to fetch checkbook details
  const fetchCheckbookDetails = async () => {
    if (selectedInvoiceIds && selectedInvoiceIds.length > 0) {
      setLoading(true);
      try {
        // For now, we'll fetch the first selected invoice
        // If you need to fetch multiple, you can loop through and combine results
        const invoiceListId = selectedInvoiceIds[0];

        const result = await disbursementService.getInvoiceListById(
          invoiceListId
        );

        if (result.success && result.data && result.data.data) {
          const invoiceListData = result.data.data;
          setInvoiceData(invoiceListData);

          // Transform checkbook data for the table
          if (
            invoiceListData.checkbooks &&
            invoiceListData.checkbooks.length > 0
          ) {
            const transformedCheckbooks = invoiceListData.checkbooks.map(
              (checkbook, index) => ({
                id: checkbook.checkbookId || index,
                VoucherNumber: checkbook.customerCode,
                TransactionNumber: checkbook.customerName,
                CustomerCode: checkbook.mainAccount || "-",
                VoucheDate: checkbook.instrumentBookId || "-",
                Amount: checkbook.instrumentNo,
                InstrumentDate: new Date(
                  checkbook.instrumentDate
                ).toLocaleDateString("en-US"),
                TotalAmount: formatCurrency(checkbook.totaleAmount || 0),
                status: checkbook.status,
                rawData: checkbook,
              })
            );
            setCheckbookList(transformedCheckbooks);
            console.log("Transformed checkbook data:", transformedCheckbooks);
          }
        } else {
          console.error("Failed to fetch invoice list:", result.error);
        }
      } catch (error) {
        console.error("Error fetching checkbook details:", error);
      } finally {
        setLoading(false);
      }
    } else {
      console.warn("No invoice IDs selected");
      setLoading(false);
    }
  };

  // Fetch invoice list and checkbook details on component mount
  useEffect(() => {
    if (isAgentPayee) {
      setLoading(false);
      return;
    }
    fetchCheckbookDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoiceIds, isAgentPayee]);

  // Handle total amount input - only allow numbers and decimal point
  const handleTotalAmountChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    const regex = /^\d*\.?\d*$/;
    if (regex.test(value) || value === "") {
      setTotalAmount(value);
    }
  };

  // Prefill Total Amount from selected checkbook; clear when selection cleared
  useEffect(() => {
    if (isAgentPayee) return;

    const rawAmount = selectedProducts?.rawData?.totaleAmount;
    if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
      setTotalAmount(String(rawAmount));
    } else {
      setTotalAmount("");
    }
  }, [selectedProducts, isAgentPayee]);

  const items = [
    { label: t("paymentVoucher.title"), url: "/accounts/paymentvoucher" },
    { label: t("paymentVoucher.createVoucher"), url: "/accounts/paymentvoucher/createvoucher" },
  ];

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
    // backgroundColor: 'red',
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const status = [
    { name: "Bk001", code: "bk1" },
    { name: "Bk002", code: "bk2" },
    { name: "Bk003", code: "bk3" },
  ];
  const bankaccount = [
    { name: "678882222256", code: "NY" },
    { name: "678882222279", code: "RM" },
  ];

  const home = { label: t("paymentVoucher.accounts") };

  const statusBodyTemplate = (rowData) => {
    let backgroundColor = "#E2F6EF"; // Default green for Approved
    let color = "#29CE00"; // Default green text

    if (rowData.status === "Pending") {
      backgroundColor = "#FFE5B4";
      color = "#FFA800";
    } else if (rowData.status === "Approved") {
      backgroundColor = "#E2F6EF";
      color = "#29CE00";
    } else if (rowData.status === "Printed") {
      backgroundColor = "#E2F6EF";
      color = "#29CE00";
    }

    return (
      <div
        style={{
          backgroundColor: backgroundColor,
          color: color,
        }}
        className="statuslable_container"
      >
        {rowData.status}
      </div>
    );
  };
  useEffect(() => {
    if (actionToast != null) {
      toastRef.current.showToast();
      {
        setTimeout(() => {}, 3000);
      }
    }
  }, [actionToast]);

  const handlePatchAction = async () => {
    // Agent/Referrer: approve marks commission lines Paid with voucher number (net of WHT)
    if (isAgentPayee) {
      const lineIds =
        (commissionLineIdsFromState?.length
          ? commissionLineIdsFromState
          : selectedCommissionLineIds) || [];
      const disbursementId = agentDisbursementId || currentDisbursementId;
      if (!disbursementId || lineIds.length === 0) {
        toastRef.current?.showToast(
          "error",
          "Error",
          "Missing disbursement or commission lines"
        );
        return;
      }
      try {
        const result = await disbursementService.approveAgentPayout(
          disbursementId,
          { lineIds }
        );
        if (result.success) {
          const voucherNo =
            result.data?.data?.voucherNumber || result.data?.voucherNumber;
          setactionToast(
            voucherNo
              ? `Approved — voucher ${voucherNo}`
              : t("paymentVoucher.disbursementCreatedSuccess")
          );
          setTimeout(() => {
            Navigate("/accounts/paymentvoucher");
          }, 1500);
        } else {
          toastRef.current?.showToast(
            "error",
            t("common.error"),
            result.error || t("paymentVoucher.failedToUpdateDisbursement")
          );
        }
      } catch (error) {
        console.error("Error approving agent payout:", error);
        toastRef.current?.showToast(
          "error",
          t("common.error"),
          error.message || t("paymentVoucher.unexpectedError")
        );
      }
      return;
    }

    if (!selectedProducts || !selectedProducts.rawData) {
      console.error("No checkbook selected");
      return;
    }
    const checkbookData = selectedProducts.rawData;
    const checkbookId = checkbookData.checkbookId;

    // Determine the new status based on current status
    let newStatus = checkbookData.status;
    if (checkbookData.status === "Pending") {
      newStatus = "Approved";
    } else if (checkbookData.status === "Approved") {
      newStatus = "Printed";
    }

    try {
      if (newStatus === "Approved") {
        const effectiveAmount = String(totalAmount ?? "").trim();
        const parsedAmount = parseFloat(effectiveAmount);

        if (!effectiveAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          toastRef.current?.showToast({
            severity: "error",
            summary: t("common.error"),
            detail: t("paymentVoucher.invalidTotalAmount"),
          });
          return;
        }

        const disbursementId = currentDisbursementId || agentDisbursementId;
        if (!disbursementId) {
          toastRef.current?.showToast({
            severity: "error",
            summary: t("common.error"),
            detail: t("paymentVoucher.failedToUpdateDisbursement"),
          });
          return;
        }

        const disbursementUpdateResult =
          await disbursementService.updateDisbursement(disbursementId, {
            amount: effectiveAmount,
          });

        if (!disbursementUpdateResult.success) {
          console.error(
            "Failed to update disbursement:",
            disbursementUpdateResult.error
          );
          toastRef.current?.showToast({
            severity: "error",
            summary: t("common.error"),
            detail:
              disbursementUpdateResult.error ||
              t("paymentVoucher.failedToUpdateDisbursement"),
          });
          return;
        }

        const result = await disbursementService.updateCheckbook(checkbookId, {
          status: newStatus,
          totaleAmount: effectiveAmount,
        });

        if (result.success) {
          setactionToast(newStatus);
          setSelectedProducts(null);
          setTotalAmount("");
          await fetchCheckbookDetails();
        } else {
          console.error("Failed to update checkbook:", result.error);
          toastRef.current?.showToast({
            severity: "error",
            summary: t("common.error"),
            detail: result.error || t("paymentVoucher.failedToUpdateDisbursement"),
          });
        }
        return;
      }

      // Print path (Approved → Printed): status only
      const result = await disbursementService.updateCheckbook(checkbookId, {
        status: newStatus,
      });
      if (result.success) {
        console.log("Checkbook updated successfully:", result.data);
        setactionToast(newStatus);
        setSelectedProducts(null);
        setTotalAmount("");
        await fetchCheckbookDetails();
        if (newStatus === "Printed") {
          const pdfUrl =
            "https://drive.google.com/file/d/1xW048fNszD5YJeQNmWAmhqQy8Ey2KG0M/view?usp=sharing";
          const openInNewTab = () => {
            const newTab = window.open(pdfUrl, "_blank");
            if (newTab) {
              const link = newTab.document.createElement("a");
              link.href = pdfUrl;
              link.download = "document.pdf";
              newTab.document.body.appendChild(link);
              link.click();
              newTab.document.body.removeChild(link);
            }
          };
          openInNewTab();
        }
      } else {
        console.error("Failed to update checkbook:", result.error);
      }
    } catch (error) {
      console.error("Error updating checkbook:", error);
    }
  };
  const getStatusClassName = (status) => {
    return status === "Printed" ? "disabled-row" : "";
  };
  return (
    <div className="overall__bankdetailview__container">
      <CustomToast
        ref={toastRef}
        message={t("paymentVoucher.chequeBookDetailsSuccess", { action: actionToast })}
      />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">{t("paymentVoucher.createVoucher")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="cardstyle_container">
        <div className="header_cardcontainer">{t("paymentVoucher.selectBankDetails")}</div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                classNames="field__container"
                label={t("paymentVoucher.totalAmountLabel")}
                value={totalAmount}
                onChange={handleTotalAmountChange}
                placeholder={t("paymentVoucher.enterTotalAmount")}
                type="text"
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.bankCode")}
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.value)}
                options={status}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>
          <div class="sm-col-12  md:col-3 lg-col-4">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("paymentVoucher.bankAccount")}
                value={bankaccountitem}
                onChange={(e) => setBankaccount(e.value)}
                options={bankaccount}
                optionLabel="name"
                placeholder={t("paymentVoucher.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>
        </div>
      </Card>

      <label className="headlist_lable">
        {isAgentPayee
          ? "Confirm agent payout"
          : t("paymentVoucher.chequeBookDetails")}
      </label>

      {isAgentPayee ? (
        <Card className="mt-2 mb-3">
          <p style={{ margin: 0 }}>
            Agent:{" "}
            <strong>
              {disbursementDataFromState?.AgentReferrer?.name ||
                disbursementDataFromState?.referrerName ||
                "—"}
            </strong>
          </p>
          <p style={{ margin: "0.5rem 0 0" }}>
            Lines to pay:{" "}
            <strong>
              {commissionLineIdsFromState?.length ||
                selectedCommissionLineIds?.length ||
                0}
            </strong>
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: 13 }}>
            Approving marks selected commission lines Paid and assigns the
            voucher number (net of WHT).
          </p>
        </Card>
      ) : null}

      {!isAgentPayee ? (
      <div className="tablegap_container">
        <DataTable
          value={checkbookList}
          tableStyle={{ minWidth: "50rem", color: "#1C2536" }}
          paginator
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
          scrollable={true}
          scrollHeight="40vh"
          selection={selectedProducts}
          onSelectionChange={(e) => setSelectedProducts(e.value)}
          selectionMode="checkbox"
          rowClassName={(rowData) => getStatusClassName(rowData.status)}
          loading={loading}
        >
          {checkbookList?.length > 0 && (
            <Column
              selectionMode="single"
              selectedItem
              headerStyle={{ width: "4rem", border: "0px solid #000" }}
              style={{ textAlign: "center" }}
            ></Column>
          )}
          <Column
            field="VoucherNumber"
            header={t("paymentVoucher.customerCode")}
            sortable
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="TransactionNumber"
            header={t("paymentVoucher.customerName")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="CustomerCode"
            header={t("paymentVoucher.mainAccount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="VoucheDate"
            header={t("paymentVoucher.instrumentBookId")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="Amount"
            header={t("paymentVoucher.instrumentNo")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="InstrumentDate"
            header={t("paymentVoucher.instrumentDate")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="TotalAmount"
            header={t("paymentVoucher.totalAmount")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="status"
            header={t("paymentVoucher.status")}
            headerStyle={headerStyle}
            className="fieldvalue_container"
            body={statusBodyTemplate}
          />
        </DataTable>
      </div>
      ) : null}

      <div className="next_container">
        <Button
          className="history_button"
          label={t("paymentVoucher.goToHistory")}
          onClick={() => Navigate("/accounts/paymentvoucher")}
        />
        <Button
          className="submit_button p-0"
          label={
            isAgentPayee
              ? t("paymentVoucher.approve")
              : selectedProducts?.status === "Approved"
                ? t("paymentVoucher.print")
                : t("paymentVoucher.approve")
          }
          onClick={handlePatchAction}
          disabled={
            isAgentPayee
              ? !(
                  (commissionLineIdsFromState?.length ||
                    selectedCommissionLineIds?.length) > 0
                )
              : !selectedProducts || selectedProducts?.status === "Printed"
          }
        />
      </div>
    </div>
  );
}

export default Bankdetailselection;
