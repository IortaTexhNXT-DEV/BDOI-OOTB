import { useEffect, useRef } from "react";
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
import TransactionCodeMasterEdit from "./TransactionCodeMasterEditTableview";
import { Button } from "primereact/button";
import { patchTrascationcodeDetailsEdit } from "../store/transactionCodeMasterMiddleware";
import { useDispatch, useSelector } from "react-redux";
import useTransactionCodeOptions from "../useTransactionCodeOptions";
import CustomToast from "../../../../components/Toast";

const TransactionCodeEdit = () => {
  const { getTrascationcodeDetailsEdit } = useSelector(
    ({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        getTrascationcodeDetailsEdit:
          transactionCodeMasterReducer?.getTrascationcodeDetailsEdit,
      };
    }
  );

  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const items = [
    {
      label: "Transaction Code",
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

  const handleSubmit = async (value) => {
    try {
      await dispatch(patchTrascationcodeDetailsEdit(value)).unwrap();
      navigate("/master/finance/transactioncode");
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const codeOptions = useTransactionCodeOptions();
  const basicc = codeOptions.basis;
  const mainAccountC = codeOptions.mainAccounts;
  const subAcc = codeOptions.subAccounts;
  const branchC = codeOptions.branches;
  const deptC = codeOptions.departments;

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
    formik.setValues({ ...formik.values, ...updatedValues });
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
      <CustomToast ref={toastRef} />
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
                required
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
                  formik.setFieldValue("TransactionBasis", e.value);
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
                  formik.setFieldValue("MainAccountCode", e.value);
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
                  formik.setFieldValue("SubAccountCode", e.target.value);
                }}
                optionLabel="label"
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
                  formik.setFieldValue("BranchCode", e.target.value);
                }}
                options={branchC}
                // onChange={(e) => {
                //   handleAccountcode(e.value.);
                // }}
                optionLabel="label"
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
                  formik.setFieldValue("DepartmentCode", e.target.value);
                }}
                optionLabel="label"
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
              />
            </div>
          </div>
        </Card>
      </form>
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
