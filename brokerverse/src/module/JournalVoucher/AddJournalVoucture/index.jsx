import { BreadCrumb } from "primereact/breadcrumb";
import { showSuccessMessage } from "../../../utility/toastUtils";
import { useEffect, useState, useRef } from "react";
import DropDowns from "../../../components/DropDowns";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import InputField from "../../../components/InputField";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../components/LabelWrapper";
import SvgDatePicker from "../../../assets/icons/SvgDatePicker";
import SvgDot from "../../../assets/icons/SvgDot";
import "../AddJournalVoucture/index.scss";
import useJvMasterData from "../useJvMasterData";
import SvgAddBlue from "../../../assets/icons/SvgAddBlue";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import AddData from "./AddData/AddData";
import CustomToast from "../../../components/Toast";
import AddDataTabel from "./AddDataTabel";
import EditData from "./EditData";
import { useDispatch, useSelector } from "react-redux";
import {
  postTCJournalVoucher,
  postApproveJournalVoucher,
} from "../store/journalVoucherMiddleware";
import { clearJournalVoucherTableData } from "../store/journalVoucherReducer";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { useTranslation } from "react-i18next";
import { calendarDateFormat } from "../../../utility/dateFormat";

const toIsoDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const AddJournalVocture = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [buttonshow, setButtonShow] = useState(0);
  const [visibleSuccess, setVisibleSuccess] = useState(false);

  const toastRef = useRef(null);
  const printRef = useRef(null);

  const [visiblePopup, setVisiblePopup] = useState(false);
  const [visible, setVisible] = useState(false);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const items = [
    {
      label: t("accounts.journalVoucher"),
      command: () => navigate("/accounts/journalvoucher"),
    },
    {
      label: t("accounts.addJournalVoucher"),
      to: "/accounts/journalvoucher/addjournalvoucture",
    },
  ];
  const home = { label: t("sidebar.Accounts") };

  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisibleSuccess(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visibleSuccess]);

  const handleGoback = () => {
    navigate("/accounts/journalvoucher");
  };
  const { journalVoucherPostTabelData } = useSelector(
    ({ journalVoucherMainReducers }) => {
      return {
        loading: journalVoucherMainReducers?.loading,
        journalVoucherPostTabelData:
          journalVoucherMainReducers?.journalVoucherPostTabelData,
      };
    }
  );

  const customValidation = (values) => {
    const errors = {};

    if (!values.transationCode) {
      errors.transationCode = t("validation.transationCodeRequired");
    }
    if (!values.transationDescription) {
      errors.transationDescription = t("validation.transationDescriptionRequired");
    }
    if (!values.totalCredit) {
      errors.totalCredit = "TotalCredit is required";
    }
    if (!values.totalDebit) {
      errors.totalDebit = t("validation.totalDebitRequired");
    }
    if (!values.net) {
      errors.net = t("validation.netRequired");
    }

    return errors;
  };

  const dispatch = useDispatch();

  // Clear table data when component mounts (when navigating to add page)
  useEffect(() => {
    dispatch(clearJournalVoucherTableData());
  }, [dispatch]);
  const handleSubmit = (values) => {
    dispatch(postTCJournalVoucher(formik.values));
  };

  const formik = useFormik({
    initialValues: {
      transationCode: "",
      transationDescription: "",
      totalCredit: "",
      totalDebit: "",
      net: "",
      date: new Date(),
    },
    validate: customValidation,
    onSubmit: handleSubmit,
  });

  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  const [, setCreditTotal] = useState(500);
  const [, setDebitTotal] = useState(500);
  const [, setNetTotal] = useState(100);
  const [toastMessage, setToastMessage] = useState("");

  const handleApproval = async () => {
    try {
      // Check if table data exists and is not empty
      if (
        !journalVoucherPostTabelData ||
        !Array.isArray(journalVoucherPostTabelData) ||
        journalVoucherPostTabelData.length === 0
      ) {
        setToastMessage(t("validation.addOneEntryBeforeApproving"));
        toastRef.current.showToast();
        return;
      }

      // Check if transaction code is selected
      if (!formik.values.transationCode) {
        setToastMessage(t("validation.selectTransactionCode"));
        toastRef.current.showToast();
        return;
      }

      // Format entries array from journalVoucherPostTabelData
      const entries = journalVoucherPostTabelData.map((item) => ({
        mainAccount: item.mainAccount,
        mainAccountDescription: item.mainAccountDescription || "",
        entryType: item.entryType,
        subAccount: item.subAccount,
        subAccountDescription: item.subAccountDescription || "",
        branchCode: item.branchCode,
        branchCodeDescription: item.branchCodeDescription || "",
        departmentCode: item.departmentCode,
        departmentDescription: item.departmentDescription || "",
        currencyCode: item.currencyCode,
        currencyDescription: item.currencyDescription || "",
        foreignAmount: parseFloat(item.foreignAmount) || 0,
        remarks: item.Remarks || item.remarks || "",
      }));

      // Prepare payload
      const payload = {
        transactionCode: formik.values.transationCode,
        transactionDescription: formik.values.transationDescription,
        date: toIsoDate(formik.values.date),
        entries: entries,
      };

      // Call API
      const result = await dispatch(postApproveJournalVoucher(payload));

      if (postApproveJournalVoucher.fulfilled.match(result)) {
        // Success - show success message with transaction number
        const transactionNumber =
          result.payload?.transactionNumber ||
          result.payload?.data?.transactionNumber ||
          result.payload?.transaction_number ||
          result.payload?.data?.transaction_number ||
          result.payload?.voucherNumber ||
          result.payload?.data?.voucherNumber ||
          result.payload?.id ||
          result.payload?.data?.id;

        let message;
        if (transactionNumber) {
          message = `Transaction Number ${transactionNumber} is created`;
        } else {
          message =
            result.payload?.message ||
            result.payload?.data?.message ||
            "Journal voucher approved successfully";
        }
        showSuccessMessage(message);
        navigate("/accounts/journalvoucher");
      } else {
        // Error - show error message
        const errorMessage =
          result.payload || "Failed to save journal voucher";
        toastRef.current.showToast("error", "Journal voucher not saved", String(errorMessage));
      }
    } catch (error) {
      const errorMessage =
        error?.message || "An error occurred while approving journal voucher";
      setToastMessage(errorMessage);
      toastRef.current.showToast();
    }
  };

  const handleUpdate = () => {
    setNetTotal(0);
    setDebitTotal(2600);
  };
  const [newDataTable] = useState([]);
  const handleEdit = () => {
    setVisible(true);
  };

  // Transaction code data
  const { transactionCodesData } = useJvMasterData();

  // Format transaction code options for dropdown
  const transactionCodeOptions = transactionCodesData.map((transaction) => ({
    label: `${transaction.code} - ${transaction.description}`,
    value: transaction.code,
    description: transaction.description,
  }));

  // Helper function to get transaction description
  const getTransactionDescription = (code) => {
    const transaction = transactionCodesData.find((t) => t.code === code);
    return transaction ? transaction.description : "";
  };

  // Handle transaction code change - update description
  const handleTransactionCodeChange = (e) => {
    formik.setFieldValue("transationCode", e.value);
    formik.setFieldValue(
      "transationDescription",
      getTransactionDescription(e.value)
    );
  };
  const totalForeignAmount = journalVoucherPostTabelData.reduce(
    (total, item) => {
      if (item.entryType === "Credit") {
        const localAmount = parseFloat(item.localAmount || item.foreignAmount);
        return !isNaN(localAmount) ? total + localAmount : total;
      }
      return total; // Important: Return the total for each iteration.
    },
    0
  );

  const totalLocalAmount = journalVoucherPostTabelData.reduce((total, item) => {
    if (item.entryType === "Debit") {
      const localAmount = parseFloat(item.localAmount || item.foreignAmount);
      return !isNaN(localAmount) ? total + localAmount : total;
    }
    return total;
  }, 0);

  const handlePrint = () => {
    printRef.current.showToast();
    setVisibleSuccess(true);
    handleSubmit();
    navigate("/accounts/journalvoucher");
  };

  return (
    <div className="grid add__JV__container">
      <CustomToast ref={toastRef} message={toastMessage} />
      <CustomToast ref={printRef} message="Successfully Printed" />
      <div className="col-12"></div>
      <div className="col-12 mb-2">
        <div>
          <span onClick={handleGoback}>
            <SvgBackicon />
          </span>
          <label className="label_header">Add Journal Voucher</label>
        </div>
        <div className="mt-4">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen__JV"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 m-0 ">
        <div className="grid add__journal__vocture__add__JV p-3">
          <div class="sm-col-12  md:col-3 lg-col-4 ">
            <DropDowns
              className="dropdown__add__sub__JV"
              label="Transaction Code"
              classNames="label__sub__add__JV"
              value={formik.values.transationCode}
              onChange={handleTransactionCodeChange}
              options={transactionCodeOptions}
              optionLabel="label"
              placeholder={"Select"}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />

            {formik.touched.transationCode && formik.errors.transationCode && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV"
              >
                {formik.errors.transationCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              label="Transaction Description"
              classNames="dropdown__add__sub__JV"
              className="label__sub__add__JV"
              value={formik.values.transationDescription || ""}
              onChange={(e) =>
                formik.setFieldValue("transationDescription", e.target.value)
              }
            />

            {formik.touched.transationDescription &&
              formik.errors.transationDescription && (
                <div
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.transationDescription}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal__JV">
            <div class="calender_container_claim__JV p-0">
              <LabelWrapper
                label="Date"
                textSize={"16px"}
                textColor={"#000"}
                textWeight={"300"}
                classNames="label__sub__add__JV"
              >
                <Calendar
                  disabled={true}
                  value={
                    formik.values.date ? new Date(formik.values.date) : null
                  }
                  onChange={(e) => {
                    formik.handleChange("date")(
                      e.value.toISOString().split("T")[0]
                    );
                  }}
                  dateFormat={calendarDateFormat()}
                  showIcon
                  className="calender_field_claim__JV"
                />
                <div className="calender_icon_claim__JV">
                  <SvgDatePicker />
                </div>
              </LabelWrapper>
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 m-0">
        <div className="sub__account__sub__container__JV">
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%", padding: 0 }}
          >
            <div className="card">
              <AddDataTabel
                setVisibleEdit={setVisibleEdit}
                handleEdit={handleEdit}
                newDataTable={newDataTable}
                visible={visible}
                journalVoucherPostTabelData={journalVoucherPostTabelData}
              />
            </div>
          </div>
          <div className="col-12 add__icon__alighn__Journal__Voture__JV pb-3">
            <div
              className="add__icon__view__Journal__Voture__JV"
              onClick={() => setVisible(true)}
            >
              <div className="add__icon__Journal__Voture__JV">
                <SvgAddBlue />
              </div>
              <div className="add__text__Journal__Voture__JV">Add Data</div>
            </div>
          </div>
        </div>

        <div className="col-12 m-0 ">
          <div className="grid add__journal__vocture__add__JV p-3">
            <div class="sm-col-12  md:col-3 lg-col-4 ">
              <InputField
                label="Total credit"
                classNames="dropdown__add__sub__JV"
                className="label__sub__add__JV"
                placeholder="Enter"
                value={totalForeignAmount}
              />
              {formik.touched.totalCredit && formik.errors.totalCredit && (
                <div
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.totalCredit}
                </div>
              )}
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label="Total Debit"
                classNames="dropdown__add__sub__JV"
                className="label__sub__add__JV"
                placeholder="Enter"
                value={totalLocalAmount}
              />
              {formik.touched.totalDebit && formik.errors.totalDebit && (
                <div
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.totalDebit}
                </div>
              )}
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view__reversal__JV">
              <InputField
                label="Net"
                classNames="dropdown__add__sub__JV"
                className="label__sub__add__JV"
                placeholder="Enter"
                value={totalForeignAmount - totalLocalAmount}
              />
              {formik.touched.net && formik.errors.net && (
                <div
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.net}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {buttonshow === 0 && (
        <div className="col-12 btn__view__Add__JV mt-2">
          {Math.abs(totalForeignAmount - totalLocalAmount) > 0.01 && (
            <div className="mb-2" style={{ fontSize: 12, color: "#b42318" }}>
              Debits and credits must be equal before the voucher can be submitted.
            </div>
          )}
          <Button
            label="Submit for approval"
            className="save__add__btn__JV"
            onClick={handleApproval}
            disabled={
              !formik.values.transationCode ||
              !journalVoucherPostTabelData ||
              !Array.isArray(journalVoucherPostTabelData) ||
              journalVoucherPostTabelData.length === 0 ||
              Math.abs(totalForeignAmount - totalLocalAmount) > 0.01
            }
          />
        </div>
      )}

      {buttonshow === 1 && (
        <div className="col-12 btn__view__Add__JV mt-2">
          <Button
            label="Print"
            className="save__add__btn__print"
            onClick={handlePrint}
          />
        </div>
      )}
      <div className="col-12">
        <AddData
          visible={visible}
          setVisible={setVisible}
          handleUpdate={handleUpdate}
          setCreditTotal={setCreditTotal}
          setDebitTotal={setCreditTotal}
          setNetTotal={setNetTotal}
        />
      </div>
      <div className="col-12">
        <EditData
          visibleEdit={visibleEdit}
          setVisibleEdit={setVisibleEdit}
          handleUpdate={handleUpdate}
          setCreditTotal={setCreditTotal}
          setDebitTotal={setCreditTotal}
          setNetTotal={setNetTotal}
        />
      </div>
    </div>
  );
};
export default AddJournalVocture;
