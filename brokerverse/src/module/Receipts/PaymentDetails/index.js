import React, { useState, useEffect, useRef } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../components/InputField";
import SvgDot from "../../../assets/icons/SvgDot";
import { Button } from "primereact/button";
import NavBar from "../../../components/NavBar";
import { DataTable } from "primereact/datatable";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import SvgBack from "../../../assets/icons/SvgBack";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import DropDowns from "../../../components/DropDowns";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import { getPaymentDetails } from "../store/receiptsMiddleware";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import documentTemplateService from "../../../services/documentTemplateService";
import mastersService from "../../../services/mastersService";
import {
  showSuccessMessage,
  showErrorMessage,
} from "../../../utility/toastUtils";

/** Receipt payment modes accepted by the receipts API. */
const PAYMENT_MODES = [
  { label: "Cash", value: "cash" },
  { label: "Check", value: "check" },
  { label: "Bank Transfer", value: "bank-transfer" },
  { label: "Card", value: "card" },
  { label: "GCash", value: "gcash" },
  { label: "Online", value: "online" },
];

function PolicyReceipts() {
  const { t } = useTranslation();
  const location = useLocation();
  const totalFC = location.state?.totalFC;
  const toastRef = useRef(null);
  const [selectedProducts, setSelectedProducts] = useState(false);
  const [products, setProducts] = useState("Approve");
  const navigate = useNavigate();
  const [errors, setErrors] = useState("");
  const [printLoading, setPrintLoading] = useState(false);

  const { paymentDetails, loading, total, currentReceiptId } = useSelector(
    ({ receiptsTableReducers }) => {
      return {
        loading: receiptsTableReducers?.loading,
        paymentDetails: receiptsTableReducers?.paymentDetails,
        total: receiptsTableReducers,
        currentReceiptId: receiptsTableReducers?.currentReceiptId,
      };
    }
  );

  const receiptId =
    location.state?.receiptId ||
    location.state?.customerData?.receiptId ||
    currentReceiptId;
  const initialValue = {
    totalPayment: totalFC,
    bankcode: "",
    bankName: "",
    bankAccount: "",
    bankAccountName: "",
    paymentType: "",
    cardNumber: "",
  };

  const validate = (values) => {
    const errors = {};

    if (!values.bankcode) {
      errors.bankcode = t("accounts.bankCodeRequired");
    }
    if (!values.bankAccount) {
      errors.bankAccount = t("accounts.accountNumberRequired");
    }
    if (!values.paymentType) {
      errors.paymentType = t("accounts.paymentTypeRequired");
    }

    return errors;
  };
  const dispatch = useDispatch();
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const handleSubmit = async (values) => {
    setProducts("Print");
    if (products == "Print") {
      toastRef.current?.showToast();

      if (!receiptId) {
        showErrorMessage(
          t("accounts.addReceiptEdit.receiptIdMissing"),
          t("common.error")
        );
        return;
      }

      try {
        setPrintLoading(true);
        showSuccessMessage(
          t("accounts.addReceiptEdit.generatingPdf"),
          t("common.success")
        );

        const result = await documentTemplateService.getReceiptPdf(receiptId, {
          fileName: `receipt-${receiptId}.pdf`,
        });

        if (!result.success) {
          throw new Error(
            result.error || t("accounts.addReceiptEdit.failedToPrintReceipt")
          );
        }

        showSuccessMessage(
          t("accounts.addReceiptEdit.pdfDownloadedSuccess"),
          t("common.success")
        );

        setTimeout(() => {
          navigate("/accounts/receipts");
        }, 1000);
      } catch (error) {
        showErrorMessage(
          error?.message || t("accounts.addReceiptEdit.failedToPrintReceipt"),
          t("common.error")
        );
      } finally {
        setPrintLoading(false);
      }
    } else {
      toastRef.current?.showToast();
      dispatch(getPaymentDetails(formik.values));
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    // onSubmit: handleSubmit,handleSubmit2
    onSubmit: () => {
      handleSubmit();
    },
  });
  const items = [
    { label: t("sidebar.Receipts"), command: () => navigate("/accounts/receipts") },
    { label: t("accounts.addReceiptsLabel"), to: "/accounts/receipts/addreceipts" },
  ];

  const home = { label: t("sidebar.Accounts") };

  // const dataa= [

  // ];
  const [banks, setBanks] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  useEffect(() => {
    Promise.all([
      mastersService.options("bank"),
      mastersService.list("bank-account", { status: "Active" }),
    ])
      .then(([bankRows, accountRows]) => {
        setBanks(bankRows);
        setBankAccounts(accountRows);
      })
      .catch((error) => showErrorMessage(error.message, t("common.error")));
  }, [t]);
  const dataa = banks.map((bank) => ({ label: bank.label, value: bank.code }));
  const data1 = bankAccounts
    .filter((account) => account.bankCode === formik.values.bankcode)
    .map((account) => ({ label: account.accountName, value: account.accountNumber }));
  const data2 = PAYMENT_MODES;
  const labelOf = (options, value) =>
    options.find((option) => option.value === value)?.label || "";

  // const setFormikValues = (totalFC) => {
  //   const updatedValues = {
  //     totalPayment: totalFC,

  //   };

  // };
  // useEffect(() => {
  // }, [])

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: "none",
    textalign: "center",
  };

  return (
    <div className="overall__payment_details_container">
      <CustomToast
        ref={toastRef}
        message={
          products == "Approve"
            ? "Approved Successfully"
            : "Printed Successfully"
        }
      />
      <span onClick={() => navigate(-1)}>
        <SvgBack />
      </span>
      <label className="label_header">{t("accounts.paymentDetails")}</label>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card>
        <div class="grid">
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <InputField
                value={formik.values.totalPayment}
                onChange={formik.handleChange("totalPayment")}
                classNames="field__policy "
                label="Total Payment"
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.bankcode}
                onChange={(e) =>
                  formik.setFieldValue("bankcode", e.target.value)
                }
                className="dropdown__container"
                label="Bank code"
                options={dataa}
                optionLabel="value"
                optionValue="value"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.bankcode && formik.errors.bankcode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.bankcode}
                </div>
              )}
            </div>
          </div>
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <InputField
                value={labelOf(dataa, formik.values.bankcode)}
                error={formik.errors.bankName}
                classNames="field__policy "
                label="Bank Name"
              />

            </div>
          </div>
        </div>
        <div class="grid">
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.bankAccount}
                onChange={(e) =>
                  formik.setFieldValue("bankAccount", e.target.value)
                }
                className="dropdown__container"
                label="Bank Account"
                options={data1}
                optionLabel="value"
                optionValue="value"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.bankAccount && formik.errors.bankAccount && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.bankAccount}
                </div>
              )}
            </div>
          </div>
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <InputField
                value={labelOf(data1, formik.values.bankAccount)}
                onChange={formik.handleChange("bankAccountName")}
                error={formik.errors.bankAccountName}
                classNames="field__policy"
                label="Bank Account Name"
              />
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <DropDowns
                value={formik.values.paymentType}
                onChange={(e) =>
                  formik.setFieldValue("paymentType", e.target.value)
                }
                className="dropdown__container"
                label="Payment Type"
                options={data2}
                optionLabel="label"
                optionValue="value"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.paymentType && formik.errors.paymentType && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.paymentType}
                </div>
              )}
            </div>
          </div>
          <div class="col-4 md:col-4 lg-col-4">
            <div>
              <InputField
                value={formik.values.cardNumber}
                onChange={formik.handleChange("cardNumber")}
                error={formik.errors.cardNumber}
                classNames="field__policy "
                label="Card Number"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="exit_print_buttons">
        {products == "Print" ? (
          <Button
            label="Print"
            className="print"
            onClick={() => {
              formik.handleSubmit();
            }}
            disabled={!formik.isValid}
          />
        ) : (
          <Button
            label="Approve"
            className="print"
            onClick={() => {
              formik.handleSubmit();
            }}
            disabled={!formik.isValid}
          />
        )}
      </div>
    </div>
  );
}

export default PolicyReceipts;
