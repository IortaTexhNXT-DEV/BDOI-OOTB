import React, { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import "./index.scss";
import SvgTable from "../../../../../../../assets/icons/SvgTable";
import { Button } from "primereact/button";
import SvgAdd from "../../../../../../../assets/icons/SvgAdd";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../../../../components/InputField";
import DropDowns from "../../../../../../../components/DropDowns";
import SvgDropdown from "../../../../../../../assets/icons/SvgDropdown";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { getUserEditData, patchUserRoleAccess, postAddUserGroupAccess } from "../../../../store/transactionCodeMasterMiddleware";
import SvgEditicon from "../../../../../../../assets/icons/SvgEdit";

const UserGroupAccessEditPopup = ({ showEdit, setShowEditData }) => {
    const { TransactioncodeListsearch, UserGroupAccessList, loading, getUserAccessData } = useSelector(({ transactionCodeMasterReducer }) => {
        return {
            loading: transactionCodeMasterReducer?.loading,
            UserGroupAccessList: transactionCodeMasterReducer?.UserGroupAccessList,
            // TransactioncodeListsearch: transactionCodeMasterReducer?.TransactioncodeListsearch,
            getUserAccessData: transactionCodeMasterReducer?.getUserAccessData

        };
    });


    const dispatch = useDispatch()
    const initialValues = {
        UserRole: "",
        MinimumTransaction: "",
        MaximumTransaction: "",
    }
    const handleSubmit = (value) => {
        dispatch(patchUserRoleAccess(value))
        setShowEditData(false)
        // setShow(false)
    }

    const customValidation = (values) => {
        const errors = {};

        if (!values.UserRole) {
            errors.UserRole = "This field Code is required";
        }
        if (!values.MinimumTransaction) {
            errors.MinimumTransaction = "This field is required";
        }
        if (!values.MaximumTransaction) {
            errors.MaximumTransaction = "This field is required";
        }

        return errors;
    };

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);

    const formik = useFormik({
        initialValues: initialValues,
        validate: customValidation,
        onSubmit: handleSubmit
        // onSubmit: handleSubmit
    });
    const [userRoleOptionData, setUserRoleOptionData] = useState([])

    const setFormikValues = () => {
        const userRoleData = getUserAccessData?.UserRole
        const updatedValues = {
            id: getUserAccessData?.id,
            UserRole: userRoleData,
            MinimumTransaction: getUserAccessData?.MinimumTransaction,
            MaximumTransaction: getUserAccessData?.MaximumTransaction,
        };
        if (userRoleData) {
            formik.setValues({ ...formik.values, ...updatedValues });
            setUserRoleOptionData([{ label: userRoleData, value: userRoleData }])
        }
        formik.setValues({ ...formik.values, ...updatedValues });
    };
    useEffect(() => {
        setFormikValues();
    }, [getUserAccessData]);


    const handleView = (rowData) => {
        console.log("View clicked:", rowData);
        // navigate("/accounts/pettycash/PettyCashCodeDetails")
    };
    const headerStyle = {
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        padding: 6,
        color: "#000",
        border: "none",
    };


    return (
        <div className="transactioncode__master__tableedit_UserGroupAccess">


            <Dialog
                header="Edit User Group Access"
                visible={showEdit}
                style={{ width: "50vw",boxShadow:"none" }}
                onHide={() => setShowEditData(false)}
                className="master__flow__common__dialog__container"
            >
                <div className="grid mt-1">
                    <div className=" col-12 md:col-6 lg-col-6 ">
                        <DropDowns
                            className="inputdialog__fieled"
                            label="User Role"
                            placeholder="Select"
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.UserRole}
                            onChange={(e) =>
                                formik.setFieldValue("UserRole", e.target.value)
                            }

                            options={userRoleOptionData}

                            optionLabel='label'

                            dropdownIcon={<SvgDropdown color={"#000"} />}
                        // label="User Role"
                        // placeholder="Select"
                        // textColor={"#111927"}
                        // textSize={"16"}
                        // textWeight={500}
                        // dropdownIcon={<SvgDropdown color={"#000"} />}
                        // value={formik.values.Description}
                        // options={BankAccountCode}
                        // onChange={(e) => {
                        //   console.log(e.value);
                        //   formik.setFieldValue("Description", e.value);
                        //   handleAccountcode(e.value.);
                        // }}
                        // optionLabel="Description"
                        // error={
                        //   formik.touched.BankAccountNumber &&
                        //   formik.errors.BankAccountNumber
                        // }
                        />
                        {formik.touched.UserRole && formik.errors.UserRole && (
                            <div
                                style={{ fontSize: 12, color: "red" }}
                                className="formik__errror__JV"
                            >
                                {formik.errors.UserRole}
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid mt-1">
                    <div className=" col-12 md:col-6 lg-col-6 ">
                        <InputField
                            classNames="input__filed"
                            label="Minimum Transaction"
                            placeholder="Enter"
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.MinimumTransaction}
                            onChange={formik.handleChange("MinimumTransaction")}
                            error={
                                formik.touched.MinimumTransaction &&
                                formik.errors.MinimumTransaction
                            }
                        />
                    </div>
                    <div className=" col-12 md:col-6 lg-col-6 ">
                        <InputField
                            classNames="input__filed"
                            label="Maximum Transaction"
                            placeholder="Enter"
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.MaximumTransaction}
                            onChange={formik.handleChange("MaximumTransaction")}
                            error={
                                formik.touched.MaximumTransaction &&
                                formik.errors.MaximumTransaction
                            }
                        />
                    </div>
                </div>
                <div className="btn__container">
                    <Button
                        label="Save"
                        className="add__btn"
                        onClick={formik.handleSubmit}
                    />
                </div>
            </Dialog>
            {/* </Card> */}
        </div>
    );
};

export default UserGroupAccessEditPopup;
