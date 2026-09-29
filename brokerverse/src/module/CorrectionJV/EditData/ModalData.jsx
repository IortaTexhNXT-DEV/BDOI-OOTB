import "./index.scss";
import { useFormik } from "formik";
import { useDispatch } from "react-redux";
import { patchCorrectionJVEdit } from "../store/correctionJVMiddleWare";
const ModalData = ({ visible, setVisible, handleUpdate, setEditID,correctionJVList }) => {
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
    //   className="corrections__jv__Edit__modal__container"
    // >
    //   <div className="form__container">
    //     <div className="grid m-0">
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           placeholder="Select "
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Main Account"
    //         />
    //         {formik.touched.mainAccount && formik.errors.mainAccount && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
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
    //           placeholder="Select "
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Entry Type"
    //         />
    //         {formik.touched.entryType && formik.errors.entryType && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Sub Account"
    //           placeholder="Select "
    //         />
    //         {formik.touched.subAccount && formik.errors.subAccount && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
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
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
    //         <DropDowns
    //           className="input__field__corrections"
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Branch Code"
    //           placeholder="Select "
    //         />
    //         {formik.touched.branchCode && formik.errors.branchCode && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
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
    //               className="formik__errror__JV"
    //             >
    //             </div>
    //           )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Department Code"
    //           placeholder="Select "
    //         />
    //         {formik.touched.departmentCode && formik.errors.departmentCode && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
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
    //               className="formik__errror__JV"
    //             >
    //             </div>
    //           )}
    //       </div>
    //     </div>
    //     <div
    //       className="grid m-0 p-0 add__journal__vocture__add__JV"
    //     >
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <DropDowns
    //           className="input__field__corrections"
    //           classNames="select__label__corrections"
    //           optionLabel="value"
    //           label="Currency Code"
    //           placeholder="Select "
    //         />
    //         {formik.touched.currencyCode && formik.errors.currencyCode && (
    //           <div
    //             className="formik__errror__JV"
    //           >
    //           </div>
    //         )}
    //       </div>
    //       <div className="col-12 md:col-6 lg:col-6 xl:col-6">
    //         <InputField
    //           classNames="input__field__corrections__inactive"
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
    //               className="formik__errror__JV"
    //             >
    //             </div>
    //           )}
    //       </div>
    //       <div className="col-12 md:col-3 lg:col-3 xl:col-3">
    //         <InputField
    //           classNames="input__field__corrections"
    //           className="select__label__corrections"
    //           label="Foreign Amount"
    //           onChange={(e) =>
    //           }
    //           placeholder="Enter"
    //         />
    //         {formik.touched.foreignAmount && formik.errors.foreignAmount && (
    //           <div
    //             className="formik__errror__JV"
    //           >
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
    //         />
    //       </div>
    //     </div>
    //   </div>
    // </Dialog>
  );
};

export default ModalData;
