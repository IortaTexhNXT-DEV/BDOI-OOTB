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
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import {
  PettyCashCode,
  BankAccountCode,
  SubAccount,
  Transcode,
  Branchcode,
  Departcode,
  TransactionCode,
} from "../../mock";
import { useDispatch, useSelector } from "react-redux";
import { postAddReplenishMiddleware } from "../store/pettyCashReplenishMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  PettycashCode: "",
  PettycashDescription: "",
  BankCode: "",
  BankAccountName: "",
  SubAccountCode: "",
  SubAccountDescription: "",
  TransactionCode: "",
  BranchCode: "",
  Branchdescription: "",
  Departmentdescription: "",
  DisbursementFromdate: new Date(),
  DisbursementTodate: new Date(),
};

const AddReplenish = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  //   const toastRef = useRef(null);

  const { ReplenishList, loading } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        ReplenishList: pettyCashReplenishReducer?.ReplenishList,
      };
    }
  );
  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/replenish"),
    },
    {
      label: "Add Replenish",
      to: "/accounts/pettycash/addreplenish",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/replenish");
  };
  const handleSubmit = (value) => {
    const valueWithId = {
      ...value,
      id: ReplenishList?.length + 1,
    };
    dispatch(postAddReplenishMiddleware(valueWithId));
    // toastRef.current.showToast();
    // {
    //   setTimeout(() => {
    navigate("/accounts/pettycash/addreplenishtable");
    //   }, 3000);
    // }
  };

  const validate = (values) => {
    const errors = {};

    if (!values.PettycashCode) {
      errors.PettycashCode = "Receipt Number is required";
    }

    if (!values.BankCode) {
      errors.BankCode = "Bank Code is required";
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

  const handlePettyCashDescribtion = (value) => {
    let description = "";
    switch (value) {
      case "PC001":
        description = "PC-1";
        break;
      case "PC002":
        description = "PC-2";
        break;
      case "PC003":
        description = "PC-3";
        break;
      case "PC004":
        description = "PC-4";
        break;
      default:
        description = "Unknown";
        break;
    }
    formik.setFieldValue("PettycashDescription", description);
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
    formik.setFieldValue("Transactiondescription", Trans);
  };
  const handleBankcode = (value) => {
    let Branch = "";
    switch (value) {
      case "Bk001":
        Branch = "Bank-1";
        break;
      case "Bk002":
        Branch = "Bank-1";
        break;
      case "Bk003":
        Branch = "Bank-1";
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
    formik.setFieldValue("Departmentdescription", Depart);
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
    formik.setFieldValue("Branchdescription", Depart);
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
    <div className="add__replenish__container">
      {/* <CustomToast ref={toastRef} /> */}
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
         
          <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Replenish
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
        <Card className="mt-6">
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Date"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value="24/01/2024"
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
            <InputField
                classNames="input__filed"
                label="Transaction Code"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Number"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value=""
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Petty cash Code*"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.PettycashCode}
                options={PettyCashCode}
                onChange={(e) => {
                  console.log(e.value.PettyCashCodes,"QWERT");
                  formik.setFieldValue("PettycashCode", e.value).then(() => {
                    handlePettyCashDescribtion(e.value.PettyCashCodes);
                  });
                }}
                optionLabel="PettyCashCodes"
                error={
                  formik.touched.PettycashCode && formik.errors.PettycashCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Petty cash Description"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.PettycashDescription}
                onChange={formik.handleChange("PettycashDescription")}
                // error={
                //   formik.touched.PettycashDescription &&
                //   formik.errors.PettycashDescription
                // }
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Bank Code*"
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
                  });
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
          <div className="grid ">
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
                  });
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
          <div className="grid ">
            <div className="calender__container col-12 md:col-3 lg:col-3 ">
              <LabelWrapper className="calenderlable__container">
                Disbursement From date
              </LabelWrapper>
              <Calendar
                showIcon
                placeholder="Select"
                className="calendar_container"
                value={formik.values.DisbursementFromdate}
                onChange={(e) => {
                  formik.setFieldValue("DisbursementFromdate", e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
            </div>
            <div className="calender__container col-12 md:col-3 lg:col-3 ">
              <LabelWrapper className="calenderlable__container">
                Disbursement To date
              </LabelWrapper>
              <Calendar
                showIcon
                placeholder="Select"
                className="calendar_container"
                value={formik.values.DisbursementTodate}
                onChange={(e) => {
                  formik.setFieldValue("DisbursementTodate", e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
            </div>
          </div>
        </Card>
      </form>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label="Next"
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReplenish;
