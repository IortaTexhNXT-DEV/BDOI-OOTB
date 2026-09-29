import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import DropDowns from "../../../components/DropDowns";
import { Card } from "primereact/card";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import { SUPPORTED_CURRENCIES_NAME_CODE } from "../../../utility/currencyOptions";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import { useSelector, useDispatch } from "react-redux";
import {
  getDraftReceiptsMiddleware,
  getReceiptByIdMiddleware,
} from "../store/receiptsMiddleware";
import { showErrorMessage } from "../../../utility/toastUtils";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import clientService from "../../../services/clientService";

function BranchAdding() {
  const { t } = useTranslation();
  const [errors, setErrors] = useState("");
  const [clientsData, setClientsData] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const { loading, draftReceiptsList } = useSelector(
    ({ receiptsTableReducers }) => {
      return {
        loading: receiptsTableReducers?.loading,
        draftReceiptsList: receiptsTableReducers?.draftReceiptsList,
      };
    }
  );
  const dispatch = useDispatch();

  const navigate = useNavigate();
  const items = [
    { label: t("accounts.receipts.title"), command: () => navigate("/accounts/receipts") },
    { label: t("accounts.addReceiptsLabel"), to: "/accounts/receipts/addreceipts" },
  ];
  const home = { label: t("sidebar.Accounts") };
  const item = [
    { name: t("accounts.addReceipts.typePayment"), code: "Payment" },
    { name: t("accounts.addReceipts.typeRefund"), code: "Refund" },
  ];
  const item1 = [
    { name: "BR-001", code: "BR-001" },
    { name: "BR-002", code: "BR-002" },
    { name: "BR-003", code: "BR-003" },
  ];
  const item2 = [
    { name: "DEPT-001", code: "DEPT-001" },
    { name: "DEPT-002", code: "DEPT-002" },
    { name: "DEPT-003", code: "DEPT-003" },
  ];
  // Fetch clients data from API
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await clientService.getClients(1, 100); // Fetch more clients for dropdown
        if (response.success && response.data?.data?.clients) {
          setClientsData(response.data.data.clients);
        } else {
          console.error("Failed to fetch clients:", response.error);
          showErrorMessage(t("accounts.addReceipts.failedToLoadClientData"), t("accounts.receipts.error"));
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        showErrorMessage(t("accounts.addReceipts.failedToLoadClientData"), t("accounts.receipts.error"));
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Fetch draft receipts data
  useEffect(() => {
    dispatch(getDraftReceiptsMiddleware());
  }, [dispatch]);

  // Log draft receipts when they change
  useEffect(() => {
    console.log("Draft Receipts List Updated:", draftReceiptsList);
  }, [draftReceiptsList]);

  // Generate transaction code on mount
  useEffect(() => {
    formik.setFieldValue("transactionCode", generateTransactionCode());
  }, []);

  // Transform clients data to dropdown options
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

  // Transform draft receipts data to dropdown options for Customer Code
  const getDraftReceiptCustomerCodeOptions = () => {
    if (!Array.isArray(draftReceiptsList) || draftReceiptsList.length === 0) {
      return [];
    }

    // Get unique customer codes from draft receipts
    const uniqueCustomerCodes = [
      ...new Set(draftReceiptsList.map((receipt) => receipt.customerCode)),
    ];

    return uniqueCustomerCodes.map((customerCode) => {
      // Find the first receipt with this customer code to get the customer name
      const receipt = draftReceiptsList.find(
        (r) => r.customerCode === customerCode
      );
      return {
        name: customerCode, // Show only customer code
        code: customerCode,
        customerName: receipt?.customerName || t("accounts.addReceipts.unknown"),
      };
    });
  };
  const item4 = SUPPORTED_CURRENCIES_NAME_CODE;

  const receiptModeOptions = [
    { name: t("accounts.addReceipts.modeDollarPeso"), code: "Dollar/Peso" },
    {
      name: t("accounts.addReceipts.modeDirectCredit"),
      code: "Direct Credit/Transfer to Account",
    },
    { name: t("accounts.addReceipts.modeCheque"), code: "Cheque" },
    { name: t("accounts.addReceipts.modeAuthorityToDebit"), code: "Authority to Debit" },
    { name: t("accounts.addReceipts.modeTelegraphicTransfer"), code: "Telegraphic Transfer" },
    {
      name: t("accounts.addReceipts.modeManagersCheck"),
      code: "Managers Check/Demand Draft",
    },
    { name: t("accounts.addReceipts.modeCreditTicket"), code: "Credit Ticket-Inter Office" },
    { name: t("accounts.addReceipts.modeOnlineBanking"), code: "Online Banking" },
  ];

  // Function to get customer names based on selected customer code from API data
  const getCustomerNamesFromAPI = (customerCode) => {
    if (!customerCode || !clientsData.length) return [];

    const code =
      typeof customerCode === "object" ? customerCode.code : customerCode;
    const selectedClient = clientsData.find(
      (client) => (client.generatedClientId || client.clientId) === code
    );

    if (!selectedClient) return [];

    // Return only the combined first name and last name
    const fullName = `${selectedClient.firstName || ""} ${
      selectedClient.lastName || ""
    }`.trim();

    // Only return the full name if it's not empty
    if (fullName) {
      return [{ name: fullName, code: fullName }];
    }

    return [];
  };

  // Function to get customer names from draft receipts data
  const getCustomerNamesFromDraftReceipts = (customerCode) => {
    if (!customerCode || !Array.isArray(draftReceiptsList)) return [];

    const code =
      typeof customerCode === "object" ? customerCode.code : customerCode;
    const draftReceipt = draftReceiptsList.find(
      (receipt) => receipt.customerCode === code
    );

    if (!draftReceipt) return [];

    // Return the customer name from draft receipt
    if (draftReceipt.customerName) {
      return [
        { name: draftReceipt.customerName, code: draftReceipt.customerName },
      ];
    }

    return [];
  };

  // Function to get policy numbers based on customer code and name
  const getPolicyNumbers = (customerCode, customerName) => {
    if (!customerCode || !customerName || !Array.isArray(draftReceiptsList)) {
      console.log("getPolicyNumbers: Missing data", {
        customerCode,
        customerName,
        hasDraftList: Array.isArray(draftReceiptsList),
      });
      return [];
    }

    const code =
      typeof customerCode === "object" ? customerCode.code : customerCode;
    const name =
      typeof customerName === "object" ? customerName.code : customerName;

    console.log("getPolicyNumbers: Searching for", { code, name });

    // Find receipts that match the customer code and name
    const matchingReceipts = draftReceiptsList.filter(
      (receipt) =>
        receipt.customerCode === code && receipt.customerName === name
    );

    console.log(
      "getPolicyNumbers: Found matching receipts",
      matchingReceipts.length,
      matchingReceipts
    );

    // Extract unique policy numbers from matching receipts
    const uniquePolicyNumbers = [
      ...new Set(
        matchingReceipts
          .map((receipt) => receipt.policyNumber)
          .filter((policyNumber) => policyNumber && policyNumber.trim() !== "")
      ),
    ];

    console.log("getPolicyNumbers: Unique policy numbers", uniquePolicyNumbers);

    // Transform to dropdown format
    const options = uniquePolicyNumbers.map((policyNumber) => ({
      name: policyNumber,
      code: policyNumber,
    }));

    console.log("getPolicyNumbers: Dropdown options", options);

    return options;
  };

  const initialValue = {
    receiptDate: new Date(),
    receiptNumber: "",
    receiptType: "",
    branchCode: "",
    departmentCode: "",
    customerCode: "",
    customerName: "",
    policyNumber: "",
    currencyCode: "",
    transactionCode: "",
    receiptMode: "",
    chequeNumber: "",
    chequeDate: new Date(),
    remarks: "",
    // Removed policyRefId and receipt line items fields as requested
  };
  const validate = (values) => {
    console.log(values, "sss");
    const errors = {};
    console.log(values, errors, "values");
    if (!values.receiptDate) {
      errors.receiptDate = t("accounts.addReceipts.validationDateRequired");
    }
    // if (!values.receiptNumber) {
    //   errors.receiptNumber = "Receipt number is required";
    // }
    if (!values.receiptType) {
      errors.receiptType = t("accounts.addReceipts.validationReceiptTypeRequired");
    }
    if (!values.branchCode) {
      errors.branchCode = t("accounts.addReceipts.validationBranchCodeRequired");
    }
    if (!values.departmentCode) {
      errors.departmentCode = t("accounts.addReceipts.validationDepartmentCodeRequired");
    }
    if (!values.customerCode) {
      errors.customerCode = t("accounts.addReceipts.validationCustomerCodeRequired");
    }
    if (!values.customerName) {
      errors.customerName = t("accounts.addReceipts.validationCustomerNameRequired");
    }
    if (!values.currencyCode) {
      errors.currencyCode = t("accounts.addReceipts.validationCurrencyCodeRequired");
    }
    if (!values.transactionCode) {
      errors.transactionCode = t("accounts.addReceipts.validationTransactionCodeRequired");
    }
    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const generateRandomName = () => {
    const names = ["Ayesha", "Sindhu", "John", "Doe", "Alice", "Bob"];
    const randomIndex = Math.floor(Math.random() * names.length);
    return names[randomIndex];
  };

  const generateRandomTransaction = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit code
    return { code: randomCode.toString() };
  };
  const generateRandomAmount = () => {
    return (Math.random() * 1000).toFixed(2);
  };

  const generateTransactionCode = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random5Digits = Math.floor(10000 + Math.random() * 90000);
    return `TXN-${year}${month}${day}-${random5Digits}`;
  };

  // Function to get customer names based on selected customer code
  const getCustomerNames = (customerCode) => {
    return getCustomerNamesFromDraftReceipts(customerCode);
  };

  // Handle customer code change - reset customer name when customer code changes
  const handleCustomerCodeChange = (e) => {
    formik.setFieldValue("customerCode", e.value);
    // Reset customer name when customer code changes
    formik.setFieldValue("customerName", "");
  };

  const handleNext = async (values) => {
    const formErrors = validate(formik.values);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return; // Don't proceed if there are validation errors
    }

    // Helper function to extract string value from object or return the value itself
    const extractValue = (value) => {
      if (typeof value === "object" && value !== null) {
        return value.code || value.name || value;
      }
      return value;
    };

    const customerCode = extractValue(values.customerCode);
    const customerName = extractValue(values.customerName);
    const policyNumber = extractValue(values.policyNumber);

    // Find matching draft receipt for this customer and policy
    const matchingReceipt = draftReceiptsList.find(
      (receipt) =>
        receipt.customerCode === customerCode &&
        receipt.customerName === customerName &&
        receipt.policyNumber === policyNumber
    );

    if (!matchingReceipt || !matchingReceipt.receiptId) {
      showErrorMessage(t("accounts.addReceipts.receiptNotFound"));
      return;
    }

    try {
      // Fetch full receipt details from API
      const response = await dispatch(
        getReceiptByIdMiddleware(matchingReceipt.receiptId)
      ).unwrap();

      // Transform receiptsList from API to receivableTableList format
      const receivableTableList = response.receiptsList.map((item) => ({
        id: item.receiptListId,
        policies: item.policies,
        netPremium: item.netPremium,
        paid: item.paid,
        unPaid: item.unPaid,
        discounts: item.discounts,
        dst: item.dst,
        lgt: item.lgt,
        vat: item.vat,
        other: item.other,
        fcAmount: item.fcAmount,
        lcAmount: item.lcAmount,
        status: item.status || "Pending",
      }));

      // Prepare the customer data for the next page
      const customerData = {
        customerCode,
        customerName,
        policyNumber,
        receiptId: response.receiptId,
        receiptNumber: response.receiptNumber,
        receiptType: extractValue(values.receiptType),
        branchCode: extractValue(values.branchCode),
        departmentCode: extractValue(values.departmentCode),
        currencyCode: extractValue(values.currencyCode),
        transactionCode: extractValue(values.transactionCode),
        remarks:
          values.remarks ||
          response.remarks ||
          "Payment for motor insurance premium",
        transactionNumber: response.transactionNumber,
        policyRefId: response.policyRefId,
        receiptStatus: response.receiptStatus,
      };

      console.log("Customer data for next page:", customerData);
      console.log("Receivable table list (from API):", receivableTableList);

      // Navigate to the next page with real API data
      navigate("/accounts/receipts/addreceiptedit", {
        state: {
          customerData,
          receivableTableList,
        },
      });
    } catch (error) {
      console.error("Error fetching receipt details:", error);
      showErrorMessage(t("accounts.addReceipts.failedToLoadReceiptDetails"));
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleNext,
  });

  return (
    <div className="overall_add_policy_receipts_container">
      {/* <div>
        <span onClick={() => navigate(-1)}>
          <SvgBack />
        </span>
        <label className="label_header">Add Receipts</label>
      </div> */}
      <div>
        <span onClick={() => navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">{t("accounts.addReceipts.title")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />
      <Card>
        <div className="grid">
          <div className="sm-col-12  md:col-3 lg-col-4 col-offset-9">
            <LabelWrapper className="calenderlable__container">
              {t("accounts.addReceipts.receiptDate")}
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.receiptDate}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("receiptDate", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              disabled={true}
            />
            {formik.touched.receiptDate && formik.errors.receiptDate && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.receiptDate}
              </div>
            )}
          </div>
        </div>
        <div className="grid">
          <div className="sm-col-12 col-12 md:col-3 lg-col-4">
            <div>
              <InputField
                value={formik.values.receiptNumber}
                onChange={formik.handleChange("receiptNumber")}
                // error={formik.errors.receiptNumber}
                classNames="field__container"
                label={t("accounts.addReceipts.receiptNumber")}
                // placeholder={"Enter"}
                type="numeric"
                disabled={true}
              />
              {formik.touched.receiptNumber && formik.errors.receiptNumber && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.receiptNumber}
                </div>
              )}
            </div>
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.receiptType}
                onChange={formik.handleChange("receiptType")}
                // error={formik.errors.receiptType}
                className="dropdown__container"
                label={t("accounts.addReceipts.receiptType")}
                options={item}
                optionLabel="name"
                placeholder={t("accounts.addReceipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.receiptType && formik.errors.receiptType && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.receiptType}
                </div>
              )}
            </div>
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.branchCode}
                onChange={formik.handleChange("branchCode")}
                // error={formik.errors.branchCode}
                className="dropdown__container"
                label={t("accounts.addReceipts.branchCode")}
                options={item1}
                optionLabel="name"
                placeholder={t("accounts.addReceipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.branchCode && formik.errors.branchCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.branchCode}
                </div>
              )}
            </div>
          </div>
          <div className="sm-col-12  md:col-3 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.departmentCode}
                onChange={formik.handleChange("departmentCode")}
                // error={formik.errors.departmentCode}
                className="dropdown__container"
                label={t("accounts.addReceipts.departmentCode")}
                options={item2}
                optionLabel="name"
                placeholder={t("accounts.addReceipts.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.departmentCode &&
                formik.errors.departmentCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.departmentCode}
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              value={formik.values.customerCode}
              onChange={handleCustomerCodeChange}
              // error={formik.errors.customerCode}
              className="dropdown__container"
              label={t("accounts.addReceipts.customerCode")}
              options={getDraftReceiptCustomerCodeOptions()}
              optionLabel="name"
              placeholder={loading ? t("common.loading") : t("accounts.addReceipts.selectCustomerCode")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={loading}
            />
            {formik.touched.customerCode && formik.errors.customerCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.customerCode}
              </div>
            )}
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              value={formik.values.customerName}
              onChange={formik.handleChange("customerName")}
              // error={formik.errors.customerName}
              className="dropdown__container"
              label={t("accounts.addReceipts.customerName")}
              options={getCustomerNames(formik.values.customerCode)}
              optionLabel="name"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={!formik.values.customerCode}
            />
            {formik.touched.customerName && formik.errors.customerName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.customerName}
              </div>
            )}
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              value={formik.values.policyNumber}
              onChange={formik.handleChange("policyNumber")}
              // error={formik.errors.policyNumber}
              className="dropdown__container"
              label={t("accounts.addReceipts.policyNumber")}
              options={getPolicyNumbers(
                formik.values.customerCode,
                formik.values.customerName
              )}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.selectPolicyNumber")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={
                !formik.values.customerCode || !formik.values.customerName
              }
            />
            {formik.touched.policyNumber && formik.errors.policyNumber && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.policyNumber}
              </div>
            )}
          </div>
        </div>
        <div className="grid">
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              value={formik.values.currencyCode}
              onChange={formik.handleChange("currencyCode")}
              // error={formik.errors.currencyCode}
              className="dropdown__container"
              label={t("accounts.addReceipts.currencyCode")}
              options={item4}
              optionLabel="name"
              placeholder={t("accounts.addReceipts.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.currencyCode && formik.errors.currencyCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.currencyCode}
              </div>
            )}
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <InputField
              value={formik.values.transactionCode}
              onChange={formik.handleChange("transactionCode")}
              classNames="field__container"
              label={t("accounts.addReceipts.transactionCode")}
              placeholder={t("accounts.addReceipts.autoGenerated")}
              disabled={true}
            />
            {formik.touched.transactionCode &&
              formik.errors.transactionCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.transactionCode}
                </div>
              )}
          </div>
          <div className="col-3 md:col-3 lg-col-3">
            <DropDowns
              value={formik.values.receiptMode}
              onChange={(e) => {
                formik.setFieldValue("receiptMode", e.value);
                // Reset Cheque Number and Cheque Date when Receipt Mode changes
                formik.setFieldValue("chequeNumber", "");
                formik.setFieldValue("chequeDate", new Date());
              }}
              className="dropdown__container"
              label={t("accounts.addReceipts.receiptMode")}
              options={receiptModeOptions}
              optionLabel="name"
              optionValue="code"
              placeholder={t("accounts.addReceipts.selectReceiptMode")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.receiptMode && formik.errors.receiptMode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.receiptMode}
              </div>
            )}
          </div>
        </div>
        {formik.values.receiptMode === "Cheque" && (
          <div className="grid">
            <div className="col-3 md:col-3 lg-col-3">
              <div>
                <InputField
                  value={formik.values.chequeNumber}
                  onChange={formik.handleChange("chequeNumber")}
                  classNames="field__container"
                  label={t("accounts.addReceipts.chequeNumber")}
                  placeholder={t("accounts.addReceipts.enterChequeNumber")}
                />
                {formik.touched.chequeNumber && formik.errors.chequeNumber && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.chequeNumber}
                  </div>
                )}
              </div>
            </div>
            <div className="col-3 md:col-3 lg-col-3">
              <div>
                <LabelWrapper className="calenderlable__container">
                  {t("accounts.addReceipts.chequeDate")}
                </LabelWrapper>
                <Calendar
                  classNames="calender__container"
                  showIcon
                  value={formik.values.chequeDate}
                  onChange={(e) => {
                    formik.setFieldValue("chequeDate", e.target.value);
                  }}
                  dateFormat="yy-mm-dd"
                />
                {formik.touched.chequeDate && formik.errors.chequeDate && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.chequeDate}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="grid">
          <div className="col-6 md:col-6 lg-col-6">
            <div>
              <InputField
                value={formik.values.remarks}
                onChange={formik.handleChange("remarks")}
                // error={formik.errors.remarks}
                classNames="field__container"
                label={t("accounts.addReceipts.remarksOptional")}
                placeholder={t("accounts.addReceipts.enter")}
              />
              {formik.touched.remarks && formik.errors.remarks && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="next_container">
        <div className="exit_print_buttons">
          <Button
            label={t("accounts.addReceipts.next")}
            className="print"
            onClick={formik.handleSubmit}
            disabled={!formik.isValid}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

export default BranchAdding;
