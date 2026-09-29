import React, { useMemo } from "react";
import { Dialog } from "primereact/dialog";
import "../EditData/index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import SvgModalClose from "../../../../assets/icons/SvgNodalClose";

// Account data
const mainAccountsData = [
  {
    code: "1202001",
    name: "Asset",
    description: "Premiums Receivable - Direct Clients",
  },
  {
    code: "1202002",
    name: "Asset",
    description: "Premiums Receivable - Corporate Customers",
  },
  {
    code: "1202003",
    name: "Asset",
    description: "Premiums Receivable - Agents",
  },
  {
    code: "1202004",
    name: "Asset",
    description: "Premiums Receivable - Broker - Local",
  },
  {
    code: "1202005",
    name: "Asset",
    description: "Premiums Receivable - Broker - International",
  },
  {
    code: "1202006",
    name: "Asset",
    description: "Premiums Receivable - Banks",
  },
  {
    code: "1202007",
    name: "Asset",
    description: "Premiums Receivable - Insurance Co - Local",
  },
  {
    code: "1202008",
    name: "Asset",
    description: "Premiums Receivable - Insurance Co - International",
  },
  { code: "1202020", name: "Asset", description: "Provision for Bad Debt" },
  {
    code: "2203001",
    name: "Liability",
    description: "Commission Accrued - Agents",
  },
  {
    code: "2203002",
    name: "Liability",
    description: "Commission Accrued - Banks",
  },
  {
    code: "2203003",
    name: "Liability",
    description: "Commission Accrued - Broker - Local",
  },
  {
    code: "2203004",
    name: "Liability",
    description: "Commission Accrued - Broker - International",
  },
  {
    code: "2203005",
    name: "Liability",
    description: "Commission Accrued - Insurance Co - Local",
  },
  {
    code: "2203006",
    name: "Liability",
    description: "Commission Accrued - Insurance Co - International",
  },
  { code: "3101001", name: "Income", description: "Gross Written Premium" },
  { code: "4101001", name: "Expense", description: "Gross Claims Paid" },
  { code: "4401001", name: "Expense", description: "Administrative Cost" },
  { code: "4401002", name: "Expense", description: "Advertising" },
  { code: "4401003", name: "Expense", description: "Audit Fees" },
  { code: "4401004", name: "Expense", description: "Bank Charges" },
  { code: "4401005", name: "Expense", description: "Building Cost Expense" },
  { code: "4401006", name: "Expense", description: "Consultancy Fees" },
];

const subAccountsData = [
  {
    code: "3101001001",
    mainAccount: "3101001",
    name: "Gross Written Premium",
    description: "Gross Written Premium - Motor",
  },
  {
    code: "3101001002",
    mainAccount: "3101001",
    name: "Gross Written Premium",
    description: "Gross Written Premium - Fire",
  },
  {
    code: "3101001003",
    mainAccount: "3101001",
    name: "Gross Written Premium",
    description: "Gross Written Premium - Marine",
  },
  {
    code: "3101001004",
    mainAccount: "3101001",
    name: "Gross Written Premium",
    description: "Gross Written Premium - Engineering",
  },
  {
    code: "3101001005",
    mainAccount: "3101001",
    name: "Gross Written Premium",
    description: "Gross Written Premium - General Accident",
  },
  {
    code: "4101001001",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Motor",
  },
  {
    code: "4101001002",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Fire",
  },
  {
    code: "4101001003",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Marine",
  },
  {
    code: "4101001004",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Engineering",
  },
  {
    code: "4101001005",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - General Accident",
  },
  {
    code: "4101001006",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Liaibility",
  },
  {
    code: "4101001007",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Bonds",
  },
  {
    code: "4101001008",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Aviation",
  },
  {
    code: "4101001009",
    mainAccount: "4101001",
    name: "Gross Claims Paid",
    description: "Gross Claims Paid - Oil and Gas",
  },
  {
    code: "4401003001",
    mainAccount: "4401003",
    name: "Audit Fees",
    description: "Audit Fees Statutory",
  },
  {
    code: "4401003002",
    mainAccount: "4401003",
    name: "Audit Fees",
    description: "Audit Fees Other",
  },
  {
    code: "4401003003",
    mainAccount: "4401003",
    name: "Audit Fees",
    description: "Internal Audit",
  },
  {
    code: "4401003004",
    mainAccount: "4401003",
    name: "Audit Fees",
    description: "Tax Advisory Fees",
  },
  {
    code: "4401005001",
    mainAccount: "4401005",
    name: "Building Cost Expense",
    description: "Office Rent",
  },
  {
    code: "4401005002",
    mainAccount: "4401005",
    name: "Building Cost Expense",
    description: "Office Cleaning",
  },
  {
    code: "4401005003",
    mainAccount: "4401005",
    name: "Building Cost Expense",
    description: "Office Water & Electricity",
  },
  {
    code: "4401005004",
    mainAccount: "4401005",
    name: "Building Cost Expense",
    description: "Office Security",
  },
  {
    code: "4401005005",
    mainAccount: "4401005",
    name: "Building Cost Expense",
    description: "Office Repairs and Maintenance",
  },
  {
    code: "4401006001",
    mainAccount: "4401006",
    name: "Consultancy Fees",
    description: "Consultancy Fees",
  },
  {
    code: "4401006002",
    mainAccount: "4401006",
    name: "Consultancy Fees",
    description: "Legal Fees",
  },
  {
    code: "4401006003",
    mainAccount: "4401006",
    name: "Consultancy Fees",
    description: "Company Secretarial Fees",
  },
  {
    code: "4401006004",
    mainAccount: "4401006",
    name: "Consultancy Fees",
    description: "Technical & Administrative Fees",
  },
];

const branchCodesData = [
  {
    code: "MKT",
    name: "Makati Branch",
    description: "Head office – Makati CBD",
  },
  {
    code: "QC",
    name: "Quezon City Branch",
    description: "North Metro Manila operations",
  },
  { code: "CEB", name: "Cebu Branch", description: "Visayas regional office" },
  {
    code: "DVO",
    name: "Davao Branch",
    description: "Mindanao regional office",
  },
];

const departmentCodesData = [
  {
    code: "ACCT",
    name: "Accounting Department",
    description: "Handles financial reporting and JVs",
  },
  {
    code: "OPS",
    name: "Operations Department",
    description: "Policy processing & servicing",
  },
  {
    code: "SALES",
    name: "Sales Department",
    description: "Manages agents and new business",
  },
  {
    code: "CLAIMS",
    name: "Claims Department",
    description: "Handles customer claims and insurer coordination",
  },
  {
    code: "IT",
    name: "IT Department",
    description: "System administration and support",
  },
];

const currencyCodesData = [
  { code: "PHP", description: "Philippine Peso" },
  { code: "THB", description: "Thai Baht" },
  { code: "USD", description: "US Dollar" },
  { code: "INR", description: "Indian Rupee" },
  { code: "EUR", description: "Euro" },
];

const EXCHANGE_RATES = {
  PHP: 1.0,
  USD: 58.86,
  EUR: 67.99,
  EURO: 67.99, // Alias for EUR
  INR: 0.665,
  THB: 1.0,
};

const EditData = ({ visibleEdit, setVisibleEdit, handleUpdate }) => {
  // Get unique main account codes that have sub accounts
  const mainAccountsWithSubAccounts = useMemo(() => {
    const mainAccountCodes = new Set(
      subAccountsData.map((sub) => sub.mainAccount)
    );
    return mainAccountsData.filter((account) =>
      mainAccountCodes.has(account.code)
    );
  }, []);

  // Format options for dropdowns - only include main accounts with sub accounts
  const codeOptionsMain = mainAccountsWithSubAccounts.map((account) => ({
    label: `${account.code} - ${account.name}`,
    value: account.code,
    description: account.description,
  }));

  const codeOptionsBranch = branchCodesData.map((branch) => ({
    label: `${branch.code} - ${branch.name}`,
    value: branch.code,
    description: branch.description,
  }));

  const codeOptionsDept = departmentCodesData.map((dept) => ({
    label: `${dept.code} - ${dept.name}`,
    value: dept.code,
    description: dept.description,
  }));

  const codeOptionsType = [
    { label: "Credit", value: "Credit" },
    { label: "Debit", value: "Debit" },
  ];

  const codeCurrencyType = currencyCodesData.map((currency) => ({
    label: `${currency.code} - ${currency.description}`,
    value: currency.code,
    description: currency.description,
  }));

  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccount) {
      errors.mainAccount = "This field is required";
    }

    if (!values.entryType) {
      errors.entryType = "This field is required";
    }
    if (!values.subAccount) {
      errors.subAccount = "This field is required";
    }

    if (!values.branchCode) {
      errors.branchCode = "This field is required";
    }

    if (!values.departmentCode) {
      errors.departmentCode = "This field is required";
    }

    if (!values.currencyCode) {
      errors.currencyCode = "This field is required";
    }

    if (!values.foreignAmount) {
      errors.foreignAmount = "This field  is required";
    }

    return errors;
  };

  // Helper functions to get descriptions
  const getMainAccountDescription = (code) => {
    const account = mainAccountsData.find((acc) => acc.code === code);
    return account ? account.description : "";
  };

  const getSubAccountDescription = (code) => {
    const account = subAccountsData.find((acc) => acc.code === code);
    return account ? account.description : "";
  };

  const getBranchDescription = (code) => {
    const branch = branchCodesData.find((br) => br.code === code);
    return branch ? branch.description : "";
  };

  const getDepartmentDescription = (code) => {
    const dept = departmentCodesData.find((d) => d.code === code);
    return dept ? dept.description : "";
  };

  const getCurrencyDescription = (code) => {
    const currency = currencyCodesData.find((c) => c.code === code);
    return currency ? currency.description : "";
  };

  // Calculate local amount based on currency and foreign amount
  const calculateLocalAmount = (currencyCode, foreignAmount) => {
    if (!currencyCode || !foreignAmount) {
      return "";
    }
    const foreignAmountNum = Number.parseFloat(foreignAmount);
    if (Number.isNaN(foreignAmountNum) || foreignAmountNum === 0) {
      return "";
    }

    const exchangeRate = EXCHANGE_RATES[currencyCode] || EXCHANGE_RATES.THB;
    const localAmount = foreignAmountNum * exchangeRate;
    return localAmount.toFixed(2);
  };

  const handleSubmit = (values) => {
    // Handle form submission
    console.log(values, "find values");
  };

  const formik = useFormik({
    initialValues: {
      mainAccount: "",
      mainAccountDescription: "",
      entryType: "",
      subAccount: "",
      subAccountDescription: "",
      branchCode: "",
      branchCodeDescription: "",
      departmentCode: "",
      departmentDescription: "",
      currencyCode: "",
      currencyDescription: "",
      foreignAmount: "",
      localAmount: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      // Handle form submission
      handleSubmit(values);
      formik.resetForm();
      handleUpdate(values);
      setVisibleEdit(false);
    },
  });

  // Filter sub-accounts based on selected main account
  const codeOptionsSub = useMemo(() => {
    if (!formik.values.mainAccount) {
      return [];
    }
    return subAccountsData
      .filter((sub) => sub.mainAccount === formik.values.mainAccount)
      .map((sub) => ({
        label: `${sub.code} - ${sub.name}`,
        value: sub.code,
        description: sub.description,
      }));
  }, [formik.values.mainAccount]);

  // Handle main account change - reset sub account and update description
  const handleMainAccountChange = (e) => {
    formik.setFieldValue("mainAccount", e.value);
    formik.setFieldValue(
      "mainAccountDescription",
      getMainAccountDescription(e.value)
    );
    formik.setFieldValue("subAccount", ""); // Reset sub account when main account changes
    formik.setFieldValue("subAccountDescription", "");
  };

  // Handle sub account change - update description
  const handleSubAccountChange = (e) => {
    formik.setFieldValue("subAccount", e.value);
    formik.setFieldValue(
      "subAccountDescription",
      getSubAccountDescription(e.value)
    );
  };

  // Handle branch code change - update description
  const handleBranchCodeChange = (e) => {
    formik.setFieldValue("branchCode", e.value);
    formik.setFieldValue(
      "branchCodeDescription",
      getBranchDescription(e.value)
    );
  };

  // Handle department code change - update description
  const handleDepartmentCodeChange = (e) => {
    formik.setFieldValue("departmentCode", e.value);
    formik.setFieldValue(
      "departmentDescription",
      getDepartmentDescription(e.value)
    );
  };

  // Handle currency code change - update description and recalculate local amount
  const handleCurrencyCodeChange = (e) => {
    formik.setFieldValue("currencyCode", e.value);
    formik.setFieldValue(
      "currencyDescription",
      getCurrencyDescription(e.value)
    );
    // Recalculate local amount when currency changes
    if (formik.values.foreignAmount) {
      const localAmount = calculateLocalAmount(
        e.value,
        formik.values.foreignAmount
      );
      formik.setFieldValue("localAmount", localAmount);
    }
  };

  // Handle foreign amount change - recalculate local amount
  const handleForeignAmountChange = (e) => {
    const foreignAmount = e.target.value;
    formik.setFieldValue("foreignAmount", foreignAmount);
    // Recalculate local amount when foreign amount changes
    if (formik.values.currencyCode && foreignAmount) {
      const localAmount = calculateLocalAmount(
        formik.values.currencyCode,
        foreignAmount
      );
      formik.setFieldValue("localAmount", localAmount);
    } else {
      formik.setFieldValue("localAmount", "");
    }
  };
  return (
    <Dialog
      header="Add Journal Voucher"
      visible={visibleEdit}
      className="jv__Edit__container master__flow__common__dialog__container"
      onHide={() => setVisibleEdit(false)}
      dismissableMask={true}
      style={{ boxShadow: "none" }}
    >
      <div className="form__container">
        <div className="grid m-0">
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__jv"
              optionLabel="label"
              label="Main Account"
              value={formik.values.mainAccount}
              onChange={handleMainAccountChange}
              options={codeOptionsMain}
            />
            {formik.touched.mainAccount && formik.errors.mainAccount && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.mainAccount}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <InputField
              classNames="input__field__jv"
              className="input__label__jv"
              label="Main Account Description"
              value={formik.values.mainAccountDescription || ""}
              disabled={true}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__jv"
              optionLabel="value"
              label="Entry Type"
              value={formik.values.entryType}
              onChange={(e) => formik.setFieldValue("entryType", e.value)}
              options={codeOptionsType}
            />
            {formik.touched.entryType && formik.errors.entryType && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.entryType}
              </div>
            )}
          </div>
        </div>
        <div
          className="grid m-0 p-0 add__journal__vocture__add__JV"
          style={{ alignItems: "center" }}
        >
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              classNames="select__label__jv"
              optionLabel="label"
              label="Sub Account"
              value={formik.values.subAccount}
              onChange={handleSubAccountChange}
              options={codeOptionsSub}
              placeholder="Select "
              disabled={!formik.values.mainAccount}
            />
            {formik.touched.subAccount && formik.errors.subAccount && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.subAccount}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              classNames="input__field__jv"
              className="input__label__jv"
              label="Sub Account Description"
              value={formik.values.subAccountDescription || ""}
              disabled={true}
            />
          </div>
        </div>
        <div
          className="grid m-0 p-0 add__journal__vocture__add__JV"
          style={{ alignItems: "center" }}
        >
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              classNames="select__label__jv"
              optionLabel="label"
              label="Branch Code"
              value={formik.values.branchCode}
              onChange={handleBranchCodeChange}
              options={codeOptionsBranch}
              placeholder="Select "
            />
            {formik.touched.branchCode && formik.errors.branchCode && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.branchCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <InputField
              classNames="input__field__jv"
              className="input__label__jv"
              label="Branch Code Description"
              value={formik.values.branchCodeDescription || ""}
              disabled={true}
            />
            {formik.touched.branchCodeDescription &&
              formik.errors.branchCodeDescription && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.branchCodeDescription}
                </div>
              )}
          </div>
        </div>
        <div
          className="grid m-0 p-0 add__journal__vocture__add__JV"
          style={{ alignItems: "center" }}
        >
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              classNames="select__label__jv"
              optionLabel="label"
              label="Department Code"
              value={formik.values.departmentCode}
              onChange={handleDepartmentCodeChange}
              options={codeOptionsDept}
              placeholder="Select "
            />
            {formik.touched.departmentCode && formik.errors.departmentCode && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.departmentCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <InputField
              classNames="input__field__jv"
              className="input__label__jv"
              label="Department Description"
              value={formik.values.departmentDescription || ""}
              disabled={true}
            />
            {formik.touched.departmentDescription &&
              formik.errors.departmentDescription && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.departmentDescription}
                </div>
              )}
          </div>
        </div>
        <div
          className="grid m-0 p-0 add__journal__vocture__add__JV"
          style={{ alignItems: "center" }}
        >
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__jv"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              classNames="select__label__jv"
              optionLabel="label"
              label="Currency Code"
              value={formik.values.currencyCode}
              onChange={handleCurrencyCodeChange}
              options={codeCurrencyType}
              placeholder="Select "
            />
            {formik.touched.currencyCode && formik.errors.currencyCode && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.currencyCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <InputField
              classNames="input__field__jv"
              className="input__label__jv"
              label="Currency Description"
              value={formik.values.currencyDescription || ""}
              disabled={true}
            />
            {formik.touched.currencyDescription &&
              formik.errors.currencyDescription && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.currencyDescription}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <InputField
              classNames="input__field__jv"
              className="select__label__jv"
              label="Amount"
              value={formik.values.foreignAmount}
              onChange={handleForeignAmountChange}
              placeholder="Enter"
            />
            {formik.touched.foreignAmount && formik.errors.foreignAmount && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.foreignAmount}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6">
            <div className="select__label__jv">
              Remarks <span style={{ color: "#B1B1B1" }}>(Options)</span>
            </div>
            <InputField
              classNames="input__field__jv"
              // className="select__label__jv"
              // label="Remarks (Options)"
              value={formik.values.remarks}
              onChange={(e) => formik.setFieldValue("remarks", e.target.value)}
              placeholder="Enter"
            />
            {formik.touched.remarks && formik.errors.remarks && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.remarks}
              </div>
            )}
          </div>

          <div
            className="col-12 save__popup__jv"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
            }}
          >
            <Button
              label="Save"
              className="jv__btn__reversal"
              disabled={!formik.isValid}
              onClick={formik.handleSubmit}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default EditData;
