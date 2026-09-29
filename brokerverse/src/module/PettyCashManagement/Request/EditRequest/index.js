import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { Button } from "primereact/button";
import CustomToast from "../../../../components/Toast";
import { TriStateCheckbox } from "primereact/tristatecheckbox";
import { PettyCashCode, Name, Branchcode, Departcode } from "../../mock";
import { useDispatch, useSelector } from "react-redux";
import { patchupdateRequestMiddleware } from "../store/pettyCashRequestMiddleware";
import { Calendar } from "primereact/calendar";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDeleteIcon from "../../../../assets/icons/SvgDeleteIcon";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import AddDialog from "./AddDialog";
import { useLocation, useParams } from "react-router-dom";


const initialValue = {
    Date: new Date(),
    TransactionCode: "",
    TransactionNumber: "",
    RequestDate: new Date(),
    RequesterName: "",
    TotalAmount: "",
    Narration: "",
    Amount: ""
};
const EditRequestForm = ({ action }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(null);
    const toastRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    console.log("first", action);
    const [checked, setChecked] = useState(false);
    const [codedata, setcodeData] = useState([])
    // const location = useLocation();
    // const rowid = location.state.rowData?.id;
    const { id } = useParams();
    console.log("first55", id)
    const { editrequestDetails, AddRequestTable, loading } = useSelector(
        ({ pettyCashRequestReducer }) => {
            return {
                loading: pettyCashRequestReducer?.loading,
                editrequestDetails: pettyCashRequestReducer?.editrequestDetails,
                AddRequestTable: pettyCashRequestReducer?.AddRequestTable
            };
        }
    );

    useEffect(function () {

        return function () {
            // Clean-up logic if needed
        };
    }, []);

    console.log("first10", editrequestDetails)

    const handleSubmit = (value) => {
        const valueWithId = {
            ...value,
            id: id,
        };
        console.log("first7", valueWithId)
        dispatch(patchupdateRequestMiddleware(valueWithId));
        toastRef.current.showToast();
        setTimeout(() => {
            navigate("/accounts/pettycash/pettycashrequest");
        }, 2000);
    };

    const validate = (values) => {
        let errors = {};

        // if (!values.TransactionCode) {
        //   errors.TransactionCode = "Petty Cash Code is required";
        // }

        if (!values.RequesterName) {
            errors.RequesterName = t("pettyCash.transactionNumberRequired");
        }

        // if (!values.BranchCode) {
        //   errors.BranchCode = "Branch Code is required";
        // }

        // if (!values.DepartmentCode) {
        //   errors.DepartmentCode = "Department Code is required";
        // }
        return errors;
    };
    const headerStyle = {
        // width: "10rem",
        fontSize: 16,
        fontFamily: "Nunito, Arial, sans-serif",
        fontWeight: 500,
        padding: 6,
        color: "#000",
        border: "none",
        textAlign: "center",
    };

    const items = [
        {
            label: t("pettyCash.pettyCashLabel"),
            command: () => navigate("/accounts/pettycash/pettycashrequest"),
        },
        {
            label: t("pettyCash.requestView"),
        },
    ];
    const Initiate = { label: t("pettyCash.accounts") };
    const [visible, setVisible] = useState(false);
    const handleClick = () => {
        navigate("/accounts/pettycash/pettycashrequest");
    };

    console.log("editrequestDetails",editrequestDetails)

    const setFormikValues = () => {
        const RequesterName = editrequestDetails?.RequesterName;
        const updatedValues = {
            // Date: editrequestDetails?.Date,
            TransactionCode: "trans122",
            TransactionNumber: editrequestDetails?.TransactionNumber,
            // RequestDate: new Date(editrequestDetails?.RequestDate),
            RequesterName: RequesterName,
            TotalAmount: editrequestDetails?.TotalAmount
        };
        if (RequesterName) {
            formik.setValues({ ...formik.values, ...updatedValues });
            setcodeData([{ label: RequesterName, Name: RequesterName }]);
        }

        formik.setValues({ ...formik.values, ...updatedValues });
    };

    const handleAddClick = () => {
        setVisible(true);
    };

    useEffect(() => {
        setFormikValues();
    }, [editrequestDetails]);

    const formik = useFormik({
        initialValues: initialValue,
        validate,
        onSubmit: (values) => {
            handleSubmit(values);
        },
    });


    const totalAmount = AddRequestTable.reduce(
        (total, item) => total + parseInt(item.Amount),
        0
    );

    const handlePettyCashDescribtion = (value) => {
        formik.setFieldValue("PettyCashCode", value);

        let description = "";
        let Requestnumber = "";
        switch (value.pettycashcode) {
            case "PC001":
                description = "PC-1";
                break;
            case "PC002":
                description = "PC-2";
                break;
            case "PC003":
                description = "PC-3";
                break;
            // case "PC0131":
            //   description = "PC-4";
            //   break;
            default:
                description = "Unknown";
                break;
        }

        switch (value.pettycashcode) {
            case "PC001":
                Requestnumber = "29292";
                break;
            case "PC002":
                Requestnumber = "20202";
                break;
            case "PC003":
                Requestnumber = "29292";
                break;
            // case "PC0131":
            //   Requestnumber = "19292";
            //   break;
            default:
                Requestnumber = "Unknown";
                break;
        }
        formik.setFieldValue("Requestnumber", Requestnumber);
        formik.setFieldValue("PettyCashdescription", description);
    };

    const handleBranch = (value) => {
        let Branch = "";
        switch (value) {
            case "THB001":
                Branch = "Branch-1";
                break;
            case "THB002":
                Branch = "Branch-2";
                break;
            case "THB003":
                Branch = "Branch-3";
                break;
            // case "Branch00123":
            //   Branch = "Branch-4";
            //   break;
            default:
                Branch = "Unknown";
                break;
        }
        formik.setFieldValue("Branchdescription", Branch);
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

    // useEffect = (() => {
    //     if (!formik.values.RequesterName) {
    //         setFormikValues("RequesterName", Name[0].Name)
    //     }
    // })

    return (
        <div className="requestedit___form">
            <CustomToast ref={toastRef} message={t("pettyCash.updateSuccessfully")} />
            <div className="grid  m-0">
                <div className="col-12 md:col-6 lg:col-6">
                    <div
                        className="pettycash__title"
                        onClick={() => {
                            handleClick();
                        }}
                    >
                        <SvgBackArrow />{action === "view" ? t("pettyCash.requestView") : t("pettyCash.editPettyCashRequest")}

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


            <Card className="mt-4">
                <div className="grid mt-1">
                    <div class="col-12 md:col-6 lg:col-3">
                        <label className="labelfield_container">Date</label>
                        <Calendar
                            showIcon
                            // placeholder="Select"

                            className="calendar_container"
                            value={formik.values.Date}
                            // minDate={minDate}
                            onChange={(e) => {
                                formik.setFieldValue("Date", e.target.value);
                            }}
                            dateFormat="yy-mm-dd"
                            disabled={action === "view" ? true : false}
                        />
                    </div>
                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <InputField
                            classNames="input__filed"
                            label={t("pettyCash.transactionCode")}
                            // placeholder="Enter"
                            // disabled={true}
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.TransactionCode}
                            onChange={formik.handleChange("TransactionCode")}
                            disabled={action === "view" ? true : false}
                        // error={
                        //   formik.touched.TransactionNumber &&
                        //   formik.errors.TransactionNumber
                        // }
                        />
                    </div>
                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <InputField
                            classNames="input__filed"
                            label={t("pettyCash.transactionNumber")}
                            // placeholder="Enter"
                            // disabled={true}
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.TransactionNumber}
                            onChange={formik.handleChange("TransactionNumber")}

                            disabled={action === "view" ? true : false}
                        />
                    </div>
                </div>
                <div className="grid mt-1">
                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <label className="labelfield_container">{t("pettyCash.requestDate")}</label>
                        <Calendar
                            showIcon
                            // placeholder="Select"

                            className="calendar_container"
                            value={formik.values.RequestDate}
                            // minDate={minDate}
                            onChange={(e) => {
                                formik.setFieldValue("RequestDate", e.target.value);
                            }}
                            disabled={action === "view" ? true : false}
                        // dateFormat="dd-mm-yyyy"
                        />
                    </div>

                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <DropDowns
                            className="input__filed"
                            label={t("pettyCash.requesterName")}
                            placeholder="Select"
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            value={formik.values.RequesterName}
                            options={codedata}
                            onChange={(e) => {
                                console.log(e.value);
                                formik.setFieldValue("RequesterName", e.value);
                            }} optionValue={"label"}
                            optionLabel="label"
                            error={
                                formik.touched.RequesterName && formik.errors.RequesterName
                            }
                            disabled={action === "view" ? true : false}
                        />
                    </div>
                </div>
                <div className="grid mt-1">
                    <div className="col-12 input__view">
                        <div className="flex checkbox__container">
                            <Checkbox
                                onChange={(e) => setChecked(e.checked)}
                                checked={checked}
                            ></Checkbox>
                            <label className="labelfield_container">Cash in advance</label>
                        </div>
                    </div>
                </div>
            </Card>



            <>
                <Card className="mt-6">
                    <div className="sub__container grid ">
                        <div className="sub__container__title col-12 md:col-6 lg:col-6">
                            <div className="sub__request__title">{t("pettyCash.requestList")}</div>
                        </div>
                        <div className="col-12 md:col-6 lg:col-6">
                            <div className="btn__container">
                                {action === "edit" ? <Button
                                    label={t("pettyCash.add")}
                                    icon={<SvgAdd color={"#fff"} />}
                                    className="add__btn"
                                    onClick={() => {
                                        handleAddClick();
                                    }}
                                    disabled={action === "view" ? true : false}
                                /> : null}
                            </div>
                        </div>
                    </div>
                    <div className="table__container">
                        <DataTable
                            value={AddRequestTable}
                            tableStyle={{ minWidth: "50rem" }}
                            // emptyMessage={isEmpty ? emptyTableIcon : null}
                            scrollable={true}
                            scrollHeight="40vh"
                        >
                            <Column
                                field="Narration"
                                header="Narration"
                                headerStyle={headerStyle}
                                sortable
                            ></Column>
                            <Column
                                field="Amount"
                                header={t("pettyCash.amount")}
                                headerStyle={headerStyle}
                                sortable
                            ></Column>
                            <Column
                                field="Action"
                                header="Action"
                                headerStyle={{
                                    ...headerStyle,
                                    display: "flex",
                                    justifyContent: "flex-end",
                                }}
                                body={(rowData) => (
                                    <div
                                        style={{ display: "flex", justifyContent: "flex-end" }}
                                    >
                                        <Button
                                            icon={<SvgDeleteIcon />}
                                            className="delete__btn"
                                        // onClick={() => handleDelete(rowData.id)}
                                        />
                                    </div>
                                )}
                            ></Column>
                        </DataTable>
                    </div>
                </Card>
                <div className="grid mt-4">
                    <div className="col-12 md:col-3 lg-col-3 ">
                        <InputField
                            classNames="input__filed"
                            label={t("pettyCash.totalAmount")}
                            // placeholder="Enter"
                            // disabled={true}
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={totalAmount}
                            disabled={action === "view" ? true : false}
                        // onChange={formik.handleChange("TransactionNumber")}
                        // error={
                        //   formik.touched.TransactionNumber && formik.errors.TransactionNumber
                        // }
                        />
                    </div>
                </div>
            </>


            <div className="grid  mt-4">
                <div className="col-12 md:col-12 lg:col-12">
                    <div className="btn__container">
                        {action === "view" ? null : <Button
                            label={t("pettyCash.update")}
                            className="add__btn"
                            onClick={() => {
                                formik.handleSubmit();
                            }}
                            disabled={!formik.isValid}
                        />}
                    </div>
                </div>
            </div>
            <AddDialog visible={visible} setVisible={setVisible} />

        </div>
    );
};

export default EditRequestForm;
