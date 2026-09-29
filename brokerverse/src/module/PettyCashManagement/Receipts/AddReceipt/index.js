import React from "react";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
// import CustomToast from "../../../../components/Toast";
import { Button } from "primereact/button";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import {
  Name,
  BankAccountCode,
  Transcode,
  Branchcode,
  Departcode,
  SubAccount,
} from "../../mock";
import { useDispatch, useSelector } from "react-redux";
import { postAddReceiptMiddleware } from "../store/pettyCashReceiptsMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  ReceiptNumber: "",
  Requester: "",
  BankCode: "",
  BankAccountName: "",
  SubAccountCode: "",
  SubAccountDescription: "",
  TransactionCode: "",
  TransactionDescription: "",
  BranchCode: "",
  BranchDescription: "",
  DepartmentCode: "",
  DepartmentDescription: "",
};

const AddReceipts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // const toastRef = useRef(null);
  const items = [
    { label: "Petty Cash", command: () => navigate("/accounts/pettycash/receipts") },
    {
      label: "Add Receipt",
      to: "/accounts/pettycash/addreceipts",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/receipts");
  };

  const { ReceiptList, loading } = useSelector(
    ({ pettyCashReceiptsReducer }) => {
      return {
        loading: pettyCashReceiptsReducer?.loading,
        ReceiptList: pettyCashReceiptsReducer?.ReceiptList,
      };
    }
  );

  const handleSubmit = (value) => {
    const valueWithId = {
      ...value,
      id: ReceiptList?.length + 1,
    };
    dispatch(postAddReceiptMiddleware(valueWithId));
    // toastRef.current.showToast();
    // {
    //   setTimeout(() => {
    navigate("/accounts/pettycash/addreceiptstable");
    //   }, 3000);
    // }
  };

  const validate = (values) => {
    const errors = {};

    if (!values.Requester) {
      errors.Requester = "Receipt Number is required";
    }

    if (!values.BankCode) {
      errors.BankCode = "Bank Code is required";
    }

    if (!values.SubAccountCode) {
      errors.SubAccountCode = "Sub Account Code is required";
    }
    if (!values.TransactionCode) {
      errors.TransactionCode = "Transaction Code is required";
    }
    if (!values.BranchCode) {
      errors.BranchCode = "Branch Code is required";
    }
    if (!values.DepartmentCode) {
      errors.DepartmentCode = "Currency is required";
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const Requester = (value) => {
    let Receiptnumber = "";
    switch (value) {
      case "Leo":
        Receiptnumber = "82821";
        break;
      case "Yuva":
        Receiptnumber = "82822";
        break;
      case "Sindhu":
        Receiptnumber = "29923";
        break;
      case "Ayisha":
        Receiptnumber = "28284";
        break;
      case "Pandi":
        Receiptnumber = "18284";
        break;
      default:
        Receiptnumber = "Unknown";
        break;
    }
    formik.setFieldValue("ReceiptNumber", Receiptnumber);
  };
  const handleTrans = (value) => {
    let Trans = "";
    switch (value) {
      case "PRM":
        Trans = "Trans-1";
        break;
      case "COMM":
        Trans = "Trans-2";
        break;
      case "REMT":
        Trans = "Trans-3";
        break;
      // case "Trans00123":
      //   Trans = "Trans-4";
      //   break;
      default:
        Trans = "Unknown";
        break;
    }
    formik.setFieldValue("TransactionDescription", Trans);
  };
  const handleBankcode = (value) => {
    let Branch = "";
    switch (value) {
      case "Bk001":
        Branch = "Bank-1";
        break;
      case "Bk002":
        Branch = "Bank-2";
        break;
      case "Bk003":
        Branch = "Bank-3";
        break;
      // case "1818810131":
      //   Branch = "Bank-1";
      //   break;
      default:
        Branch = "Unknown";
        break;
    }
    formik.setFieldValue("BankAccountName", Branch);
  };
  const handleDepart = (value) => {
    let Depart = "";
    switch (value) {
      case "FIN":
        Depart = "Depart-1";
        break;
      case "MKT":
        Depart = "Depart-2";
        break;
      case "IT":
        Depart = "Depart-3";
        break;
      case "SLS":
        Depart = "Depart-4";
        break;
      default:
        Depart = "Unknown";
        break;
    }
    formik.setFieldValue("DepartmentDescription", Depart);
  };
  const handleBranch = (value) => {
    let Depart = "";
    switch (value) {
      case "THB001":
        Depart = "Branch-1";
        break;
      case "THB002":
        Depart = "Branch-2";
        break;
      case "THB003":
        Depart = "Branch-3";
        break;
      case "THB004":
        Depart = "Branch-4";
        break;
      default:
        Depart = "Unknown";
        break;
    }
    formik.setFieldValue("BranchDescription", Depart);
  };
  const handleSubAccount = (value) => {
    let Depart = "";
    switch (value) {
      case "SAC001":
        Depart = "Sub-1";
        break;
      case "SAC002":
        Depart = "Sub-2";
        break;
      case "SAC003":
        Depart = "Sub-3";
        break;
      // case "Sub1818811":
      //   Depart = "Sub-4";
      //   break;
      default:
        Depart = "Unknown";
        break;
    }
    formik.setFieldValue("SubAccountDescription", Depart);
  };
  return (
    <div className="add__receipts__container">
      {/* <CustomToast ref={toastRef} /> */}
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          {/* <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Add Receipt
          </div> */}
          <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Receipt
          </label>
        </div>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>
      <form onSubmit={formik.handleSubmit}>
        <Card className="mt-3">
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Receipt Number"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.ReceiptNumber}
                onChange={formik.handleChange("ReceiptNumber")}
                error={
                  formik.touched.ReceiptNumber && formik.errors.ReceiptNumber
                }
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Requester"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.Requester}
                options={Name}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("Requester", e.value).then(() => {
                    Requester(e.value.Name);
                  })

                }}
                optionLabel="Name"
                error={formik.touched.Requester && formik.errors.Requester}

              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Bank Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BankCode}
                options={BankAccountCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("BankCode", e.value).then(() => {
                    handleBankcode(e.value.BankAccountCode);
                  })

                }}
                optionLabel="BankAccountCode"
                error={formik.touched.BankCode && formik.errors.BankCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Bank Account Name"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.BankAccountName}
                onChange={formik.handleChange("BankAccountName")}
                error={
                  formik.touched.BankAccountName &&
                  formik.errors.BankAccountName
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Sub Account Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.SubAccountCode}
                options={SubAccount}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("SubAccountCode", e.value).then(() => {
                    handleSubAccount(e.value.SubAccount);
                  })

                }}
                optionLabel="SubAccount"
                error={
                  formik.touched.SubAccountCode && formik.errors.SubAccountCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Sub Account Description"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.SubAccountDescription}
                onChange={formik.handleChange("SubAccountDescription")}
                error={
                  formik.touched.SubAccountDescription &&
                  formik.errors.SubAccountDescription
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Transaction Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.TransactionCode}
                options={Transcode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("TransactionCode", e.value).then(() => {
                    handleTrans(e.value.Transcode);
                  })

                }}
                optionLabel="Transcode"
                error={
                  formik.touched.TransactionCode &&
                  formik.errors.TransactionCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Description"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionDescription}
                onChange={formik.handleChange("TransactionDescription")}
                error={
                  formik.touched.TransactionDescription &&
                  formik.errors.TransactionDescription
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Branch Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BranchCode}
                options={Branchcode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("BranchCode", e.value).then(() => {
                    handleBranch(e.value.Branchcode);
                  })

                }}
                optionLabel="Branchcode"
                error={formik.touched.BranchCode && formik.errors.BranchCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Branch Description"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.BranchDescription}
                onChange={formik.handleChange("BranchDescription")}
                error={
                  formik.touched.BranchDescription &&
                  formik.errors.BranchDescription
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Department Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.DepartmentCode}
                options={Departcode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("DepartmentCode", e.value).then(() => {
                    handleDepart(e.value.Departcode);
                  })

                }}
                optionLabel="Departcode"
                error={
                  formik.touched.DepartmentCode && formik.errors.DepartmentCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Department Description"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.DepartmentDescription}
                onChange={formik.handleChange("DepartmentDescription")}
                error={
                  formik.touched.DepartmentDescription &&
                  formik.errors.DepartmentDescription
                }
              />
            </div>
          </div>
        </Card>
      </form>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}

              disabled={!formik.isValid}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReceipts;
