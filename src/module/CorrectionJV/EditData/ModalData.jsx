import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../components/DropDowns";
import InputField from "../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import SvgModalClose from "../../../assets/icons/SvgNodalClose";
import { useDispatch } from "react-redux";
import { patchCorrectionJVEdit } from "../store/correctionJVMiddleWare";
const ModalData = ({ visible, setVisible, handleUpdate, setEditID,correctionJVList }) => {
  // const codeOptions = [
  //   { label: "Option 1", value: "00123" },
  //   { label: "Option 2", value: "00124" },
  // ];
  // const codeOptionsMain = [
  //   { label: "Option 1", value: "Main00123" },
  //   { label: "Option 2", value: "Main00124" },
  // ];
  // const codeOptionsSub = [
  //   { label: "Option 1", value: "Sub00123" },
  //   { label: "Option 2", value: "Sub00124" },
  // ];
  // const codeOptionsDept = [
  //   { label: "Option 1", value: "Dep00123" },
  //   { label: "Option 2", value: "Dep00124" },
  // ];
  // const codeOptionsBranch = [
  //   { label: "Option 1", value: "Branch00123" },
  //   { label: "Option 2", value: "Branch00124" },
  // ];

  // const codeOptionsType = [
  //   { label: "Option 1", value: "Credit" },
  //   { label: "Option 2", value: "Debit" },
  // ];
  // const codeCurrencyType = [
  //   { label: "Option 1", value: "THB" },
  //   { label: "Option 2", value: "EURO" },
  // ];

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
  const dispatch=useDispatch()
  const handleSubmit = (values) => {
    // Handle form submission
    console.log(values, "find values");
    dispatch(patchCorrectionJVEdit())
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
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
      formik.resetForm();
      handleUpdate(values);
      setVisible(false);
    },
  });
  return (
    <></>
    // <Dialog
    //   header="Edit Data"
    //   visible={visible}
    //   className="corrections__jv__Edit__modal__container"
    //   onHide={() => setVisible(false)}
    //   dismissableMask={true}
    // >
    //   <div className="form__container">
    //     <div className="grid m-0">
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           placeholder="Select "
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Main Account"
    //           value={formik.values.mainAccount}
    //           onChange={(e) => formik.setFieldValue("mainAccount", e.value)}
    //           options={codeOptionsMain}
    //         />
    //         {formik.touched.mainAccount && formik.errors.mainAccount && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.mainAccount}
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
    //           disabled={true}
    //           className="input__label__corrections"
    //           label="Main Account Description"
    //           value={
    //             formik.values.mainAccount
    //               ? `Main Account Description ${formik.values.mainAccount}`
    //               : ""
    //           }
    //         />
    //       </div>

    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           placeholder="Select "
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Entry Type"
    //           value={formik.values.entryType}
    //           onChange={(e) => formik.setFieldValue("entryType", e.value)}
    //           options={codeOptionsType}
    //         />
    //         {formik.touched.entryType && formik.errors.entryType && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.entryType}
    //           </div>
    //         )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //       style={{ alignItems: "center" }}
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Sub Account"
    //           value={formik.values.subAccount}
    //           onChange={(e) => formik.setFieldValue("subAccount", e.value)}
    //           options={codeOptionsSub}
    //           placeholder="Select "
    //         />
    //         {formik.touched.subAccount && formik.errors.subAccount && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.subAccount}
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
    //           disabled={true}
    //           className="input__label__corrections"
    //           label="Sub Account Description"
    //           value={
    //             formik.values.subAccount
    //               ? `Sub Account Description ${formik.values.subAccount}`
    //               : ""
    //           }
    //         />
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //       style={{ alignItems: "center" }}
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Branch Code"
    //           value={formik.values.branchCode}
    //           onChange={(e) => formik.setFieldValue("branchCode", e.value)}
    //           options={codeOptionsBranch}
    //           placeholder="Select "
    //         />
    //         {formik.touched.branchCode && formik.errors.branchCode && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.branchCode}
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
    //           disabled={true}
    //           className="input__label__corrections"
    //           label="Branch Code Description"
    //           value={
    //             formik.values.branchCode
    //               ? `Branch Code Description ${formik.values.branchCode}`
    //               : ""
    //           }
    //         />
    //         {formik.touched.branchCodeDescription &&
    //           formik.errors.branchCodeDescription && (
    //             <div
    //               style={{ fontSize: 12, color: "red" }}
    //               className="formik__errror__JV"
    //             >
    //               {formik.errors.branchCodeDescription}
    //             </div>
    //           )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //       style={{ alignItems: "center" }}
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Department Code"
    //           value={formik.values.departmentCode}
    //           onChange={(e) => formik.setFieldValue("departmentCode", e.value)}
    //           options={codeOptionsDept}
    //           placeholder="Select "
    //         />
    //         {formik.touched.departmentCode && formik.errors.departmentCode && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.departmentCode}
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
    //           disabled={true}
    //           className="input__label__corrections"
    //           label="Department Description"
    //           value={
    //             formik.values.departmentCode
    //               ? `Department Description ${formik.values.departmentCode}`
    //               : ""
    //           }
    //         />
    //         {formik.touched.departmentDescription &&
    //           formik.errors.departmentDescription && (
    //             <div
    //               style={{ fontSize: 12, color: "red" }}
    //               className="formik__errror__JV"
    //             >
    //               {formik.errors.departmentDescription}
    //             </div>
    //           )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //       style={{ alignItems: "center" }}
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           dropdownIcon={<SvgDropdown color={"#000"} />}
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Currency Code"
    //           value={formik.values.currencyCode}
    //           onChange={(e) => formik.setFieldValue("currencyCode", e.value)}
    //           options={codeCurrencyType}
    //           placeholder="Select "
    //         />
    //         {formik.touched.currencyCode && formik.errors.currencyCode && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.currencyCode}
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
    //           disabled={true}
    //           className="input__label__corrections"
    //           label="Currency Description"
    //           value={
    //             formik.values.currencyCode
    //               ? `Currency Description ${formik.values.currencyCode}`
    //               : ""
    //           }
    //         />
    //         {formik.touched.currencyDescription &&
    //           formik.errors.currencyDescription && (
    //             <div
    //               style={{ fontSize: 12, color: "red" }}
    //               className="formik__errror__JV"
    //             >
    //               {formik.errors.currencyDescription}
    //             </div>
    //           )}
    //       </div>
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <InputField
    //           classNames="input__field__corrections"
    //           className="select__label__corrections"
    //           label="Foreign Amount"
    //           value={formik.values.foreignAmount}
    //           onChange={(e) =>
    //             formik.setFieldValue("foreignAmount", e.target.value)
    //           }
    //           placeholder="Enter"
    //         />
    //         {formik.touched.foreignAmount && formik.errors.foreignAmount && (
    //           <div
    //             style={{ fontSize: 12, color: "red" }}
    //             className="formik__errror__JV"
    //           >
    //             {formik.errors.foreignAmount}
    //           </div>
    //         )}
    //       </div>

    //       <div
    //         className="col-12 save__popup__correction"
    //         style={{
    //           display: "flex",
    //           justifyContent: "flex-end",
    //           alignItems: "flex-end",
    //         }}
    //       >
    //         <Button
    //           label="Update"
    //           className="correction__btn__reversal"
    //           disabled={!formik.isValid}
    //           onClick={formik.handleSubmit}
    //         />
    //       </div>
    //     </div>
    //   </div>
    // </Dialog>
  );
};

export default ModalData;
