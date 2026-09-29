import React, { useEffect, useRef, useState } from "react";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { Card } from "primereact/card";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
// import TransactionCodeMasterDetailViewTable from "./TransactionCodeMasterDetailViewTable";
import TransactionCodeMasterEdit from "./TransactionCodeMasterEditTableview";
import NavBar from "../../../../components/NavBar";
import { Button } from "primereact/button";
import { patchTrascationcodeDetailsEdit } from "../store/transactionCodeMasterMiddleware";
import { useDispatch, useSelector } from "react-redux";
import { PATCH_TRANSACTION_CODE_DETAILS_EDIT } from "../../../../redux/actionTypes";

const TransactionCodeEdit = () => {
  const { getTrascationcodeDetailsEdit, loading } = useSelector(
    ({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        getTrascationcodeDetailsEdit:
          transactionCodeMasterReducer?.getTrascationcodeDetailsEdit,
      };
    }
  );
  console.log(getTrascationcodeDetailsEdit, "getTrascationcodeDetailsEdit");

  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const items = [
    {
      label: "Transaction code",
      url: "/master/finance/transactioncode",
    },
    {
      label: "Edit Transaction Code",
    },
  ];

  const Initiate = { label: "Master" };

  const handleClick = () => {
    navigate("/master/finance/transactioncode");
  };

  const handleSubmit = (value) => {
    console.log(value, "valuesvalues");
    dispatch(patchTrascationcodeDetailsEdit(value));
    navigate("/master/finance/transactioncode");
  };
  const [basicc, setBasiscodeData] = useState([]);
  const [mainAccountC, setMainAccountcodeData] = useState([]);
  const [subAcc, setSubAccountData] = useState([]);
  const [branchC, setBranchCodeData] = useState([]);
  const [deptC, setDeptData] = useState([]);

  const SetFormikValue = () => {
    const Basis = getTrascationcodeDetailsEdit?.TransactionBasis;
    const MainAccount = getTrascationcodeDetailsEdit?.MainAccountCode;
    const subAccount = getTrascationcodeDetailsEdit?.SubAccountCode;
    const branchCode = getTrascationcodeDetailsEdit?.BranchCode;
    const dept = getTrascationcodeDetailsEdit?.DepartmentCode;
    const updatedValues = {
      id: getTrascationcodeDetailsEdit?.id,
      TransactionCode: getTrascationcodeDetailsEdit?.TransactionCode || "",
      TransactionName: getTrascationcodeDetailsEdit?.TransactionName || "",
      Description: getTrascationcodeDetailsEdit?.Description || "",
      TransactionBasis: Basis || "",
      MainAccountCode: MainAccount || "",
      MainAccountDescription:
        getTrascationcodeDetailsEdit?.MainAccountDescription || "",
      SubAccountCode: subAccount || "",
      SubAccountDescription:
        getTrascationcodeDetailsEdit?.SubAccountDescription || "",
      BranchCode: branchCode || "",
      BranchDescription: getTrascationcodeDetailsEdit?.BranchDescription || "",
      DepartmentCode: dept || "",
      DepartmentDescription:
        getTrascationcodeDetailsEdit?.DepartmentDescription || "",
    };
    console.log(
      updatedValues.SubAccountCode,
      subAccount,
      "updatedValues.TransactionBasis"
    );
    if (Basis) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setBasiscodeData([{ label: Basis, value: Basis }]);
    }
    if (MainAccount) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setMainAccountcodeData([{ label: MainAccount, value: MainAccount }]);
    }
    if (subAccount) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setSubAccountData([{ label: subAccount, value: subAccount }]);
    }
    if (branchCode) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setBranchCodeData([{ label: branchCode, value: branchCode }]);
    }
    if (dept) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setDeptData([{ label: dept, value: dept }]);
    }
    formik.setValues({ ...formik.values, ...updatedValues });
    console.log(updatedValues, "updatedValues");
  };

  const formik = useFormik({
    initialValues: {
      TransactionCode: "",
      TransactionName: "",
      Description: "",
      TransactionBasis: "",
      MainAccountCode: "",
      MainAccountDescription: "",
      SubAccountCode: "",
      SubAccountDescription: "",
      BranchCode: "",
      BranchDescription: "",
      DepartmentCode: "",
      DepartmentDescription: "",
    },
    validate: (values) => {
      const errors = {};
      // Add your validation logic here
      if (!values.TransactionCode) {
        errors.TransactionCode = "Transaction Code is required";
      }
      // Add more validations as needed

      return errors;
    },
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  useEffect(() => {
    SetFormikValue();
  }, [getTrascationcodeDetailsEdit]);

  return (
    <div className="transactioncode__master__Edit__view">
      {/* <CustomToast ref={toastRef} message="Petty Cash Initiated Successfully"/> */}
      <div className="grid  m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div
            className="Transaction__Code__Master__title"
            onClick={() => {
              handleClick();
            }}
          >
            <SvgBackArrow />
            Edit Transaction Code
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
        <Card className="mt-4">
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Code"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                //
                value={formik.values.TransactionCode}
                onChange={formik.handleChange("TransactionCode")}
                error={
                  formik.touched.TransactionCode &&
                  formik.errors.TransactionCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Name"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionName}
                onChange={formik.handleChange("TransactionName")}
                error={
                  formik.touched.TransactionName &&
                  formik.errors.TransactionName
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
                error={formik.touched.Description && formik.errors.Description}
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Transaction Basis"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.TransactionBasis}
                options={basicc}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("TransactionBasis", e.value);
                  //   handleAccountcode(e.value.TransactionBasis);
                }}
                optionLabel="label"
                error={
                  formik.touched.TransactionBasis &&
                  formik.errors.TransactionBasis
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Main Account Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.MainAccountCode}
                options={mainAccountC}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("MainAccountCode", e.value);
                  //   handleAccountcode(e.value.MainAccountCode);
                }}
                optionLabel="label"
                error={
                  formik.touched.MainAccountCode &&
                  formik.errors.MainAccountCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Main Account Description"
                // placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.MainAccountDescription}
                onChange={formik.handleChange("MainAccountDescription")}
                error={
                  formik.touched.MainAccountDescription &&
                  formik.errors.MainAccountDescription
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
                options={subAcc}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("SubAccountCode", e.target.value);
                }}
                optionLabel="label"
                // error={
                //   formik.touched.BankAccountNumber &&
                //   formik.errors.BankAccountNumber
                // }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Description"
                placeholder="Enter"
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
                label="Branch Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BranchCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("BranchCode", e.target.value);
                }}
                options={branchC}
                // onChange={(e) => {
                //   console.log(e.value);
                //   formik.setFieldValue("Description", e.value);
                //   handleAccountcode(e.value.);
                // }}
                optionLabel="label"
                // error={
                //   formik.touched.BankAccountNumber &&
                //   formik.errors.BankAccountNumber
                // }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Branch Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.BranchDescription}
                onChange={formik.handleChange("BranchDescription")}
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Department"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.DepartmentCode}
                options={deptC}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("DepartmentCode", e.target.value);
                }}
                optionLabel="label"
                // error={
                //   formik.touched.BankAccountNumber &&
                //   formik.errors.BankAccountNumber
                // }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Department Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.DepartmentDescription}
                onChange={formik.handleChange("DepartmentDescription")}
                // error={
                //   formik.touched.TransactionName &&
                //   formik.errors.TransactionName
                // }
              />
            </div>
          </div>
        </Card>
      </form>
      {/* <TransactionCodeMasterDetailViewTable/> */}
      <TransactionCodeMasterEdit />
      <div className="btn__container">
        <Button
          label="Update"
          className="add__btn"
          onClick={formik.handleSubmit}
          disabled={!formik.isValid}
        />
      </div>
    </div>
  );
};

export default TransactionCodeEdit;
