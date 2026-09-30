import { useMemo } from "react";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { postAddJournalVoucher } from "../../store/journalVoucherMiddleware";
import { useDispatch } from "react-redux";
import useJvMasterData from "../../useJvMasterData";

const AddData = ({ visible, setVisible, handleUpdate }) => {
  const {
    mainAccountsData,
    subAccountsData,
    branchCodesData,
    departmentCodesData,
    currencyCodesData,
    exchangeRates,
  } = useJvMasterData();

  const mainAccountsWithSubAccounts = mainAccountsData;

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
    const hasSubAccounts = subAccountsData.some(
      (sub) => sub.mainAccount === values.mainAccount
    );
    if (hasSubAccounts && !values.subAccount) {
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

    const foreignAmountNum = Number.parseFloat(values.foreignAmount);
    if (
      !values.foreignAmount ||
      (typeof values.foreignAmount === "string" &&
        values.foreignAmount.trim() === "") ||
      Number.isNaN(foreignAmountNum) ||
      foreignAmountNum === 0
    ) {
      errors.foreignAmount =
        "This field is required and must be greater than zero";
    }

    return errors;
  };

  const dispatch = useDispatch();


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

    const exchangeRate = exchangeRates[currencyCode] || 1;
    const localAmount = foreignAmountNum * exchangeRate;
    return localAmount.toFixed(2);
  };

  const handleSubmit = (values) => {
    dispatch(postAddJournalVoucher(formik.values));
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
      setVisible(false);
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
  }, [formik.values.mainAccount, subAccountsData]);

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
      visible={visible}
      className="jv__Edit__modal__container master__flow__common__dialog__container"
      onHide={() => setVisible(false)}
      dismissableMask={true}
      style={{ boxShadow: "none" }}
    >
      <div className="grid">
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
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.mainAccount}
            </div>
          )}
        </div>

        <div className="col-12 md:col-6 lg:col-6 xl:col-6">
          <InputField
            classNames="field__container"
            label="Main Account Description"
            value={formik.values.mainAccountDescription || ""}
            disabled={true}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3">
          <DropDowns
            dropdownIcon={<SvgDropdown color={"#000"} />}
            placeholder="Select "
            className="dropdown__container"
            optionLabel="value"
            label="Entry Type"
            value={formik.values.entryType}
            onChange={(e) => formik.setFieldValue("entryType", e.value)}
            options={codeOptionsType}
          />
          {formik.touched.entryType && formik.errors.entryType && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.entryType}
            </div>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3">
          <DropDowns
            dropdownIcon={<SvgDropdown color={"#000"} />}
            className="dropdown__container"
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
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.subAccount}
            </div>
          )}
        </div>

        <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
          <InputField
            classNames="field__container"
            label="Sub Account Description"
            value={formik.values.subAccountDescription || ""}
            disabled={true}
          />
        </div>
      </div>

      <div className="grid m-0 ">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
          <DropDowns
            dropdownIcon={<SvgDropdown color={"#000"} />}
            className="dropdown__container"
            optionLabel="label"
            label="Branch Code"
            value={formik.values.branchCode}
            onChange={handleBranchCodeChange}
            options={codeOptionsBranch}
            placeholder="Select "
          />
          {formik.touched.branchCode && formik.errors.branchCode && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.branchCode}
            </div>
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6">
          <InputField
            classNames="field__container"
            label="Branch Code Description"
            value={formik.values.branchCodeDescription || ""}
            disabled={true}
          />
          {formik.touched.branchCodeDescription &&
            formik.errors.branchCodeDescription && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.branchCodeDescription}
              </div>
            )}
        </div>
      </div>
      <div className="grid m-0 ">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3">
          <DropDowns
            className="dropdown__container"
            dropdownIcon={<SvgDropdown color={"#000"} />}
            optionLabel="label"
            label="Department Code"
            value={formik.values.departmentCode}
            onChange={handleDepartmentCodeChange}
            options={codeOptionsDept}
            placeholder="Select "
          />
          {formik.touched.departmentCode && formik.errors.departmentCode && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.departmentCode}
            </div>
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6">
          <InputField
            classNames="field__container"
            label="Department Description"
            value={formik.values.departmentDescription || ""}
            disabled={true}
          />
          {formik.touched.departmentDescription &&
            formik.errors.departmentDescription && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.departmentDescription}
              </div>
            )}
        </div>
      </div>
      <div className="grid m-0">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3">
          <DropDowns
            dropdownIcon={<SvgDropdown color={"#000"} />}
            className="dropdown__container"
            optionLabel="label"
            label="Currency Code"
            value={formik.values.currencyCode}
            onChange={handleCurrencyCodeChange}
            options={codeCurrencyType}
            placeholder="Select "
          />
          {formik.touched.currencyCode && formik.errors.currencyCode && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
              className="formik__errror__JV"
            >
              {formik.errors.currencyCode}
            </div>
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6">
          <InputField
            classNames="field__container"
            label="Currency Description"
            value={formik.values.currencyDescription || ""}
            disabled={true}
          />
          {formik.touched.currencyDescription &&
            formik.errors.currencyDescription && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.currencyDescription}
              </div>
            )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3">
          <InputField
            classNames="field__container"
            label="Amount"
            value={formik.values.foreignAmount}
            onChange={handleForeignAmountChange}
            placeholder="Enter"
          />
          {formik.touched.foreignAmount && formik.errors.foreignAmount && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
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
            classNames="field__container"
            value={formik.values.remarks}
            onChange={(e) => formik.setFieldValue("remarks", e.target.value)}
            placeholder="Enter"
          />
          {formik.touched.remarks && formik.errors.remarks && (
            <div
              style={{ fontSize: 12, color: "var(--color-danger)" }}
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
    </Dialog>
  );
};

export default AddData;
