import { useState, useRef, useEffect } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import {
    geteditrequestMiddleware,
    patchupdateRequestMiddleware,
    transitionRequestMiddleware,
} from "../store/pettyCashRequestMiddleware";
import { removeRequestLine } from "../store/pettyCashRequestReducer";
import { Calendar } from "primereact/calendar";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDeleteIcon from "../../../../assets/icons/SvgDeleteIcon";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import AddDialog from "./AddDialog";
import { useParams } from "react-router-dom";
import { calendarDateFormat } from "../../../../utility/dateFormat";

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
    const toastRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [checked, setChecked] = useState(false);
    const [codedata, setcodeData] = useState([])
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const { id } = useParams();
    const { editrequestDetails, AddRequestTable, loading } = useSelector(
        ({ pettyCashRequestReducer }) => {
            return {
                loading: pettyCashRequestReducer?.loading,
                editrequestDetails: pettyCashRequestReducer?.editrequestDetails,
                AddRequestTable: pettyCashRequestReducer?.AddRequestTable || []
            };
        }
    );
    useEffect(() => {
        if (id) dispatch(geteditrequestMiddleware(id));
    }, [dispatch, id]);

    const showResult = (result, thunk, message, onSuccess) => {
        if (thunk.rejected.match(result)) {
            toastRef.current.showToast({ severity: "error", detail: result.payload });
            return;
        }
        toastRef.current.showToast({ detail: message });
        if (onSuccess) onSuccess();
    };
    const handleSubmit = async (value) => {
        const result = await dispatch(patchupdateRequestMiddleware({ ...value, id }));
        showResult(result, patchupdateRequestMiddleware, t("pettyCash.updateSuccessfully"), () =>
            setTimeout(() => navigate("/accounts/pettycash/pettycashrequest"), 2000)
        );
    };
    const handleTransition = async (transition, reason) => {
        const result = await dispatch(transitionRequestMiddleware({ id, action: transition, reason }));
        showResult(result, transitionRequestMiddleware, result.payload?.status, () => {
            setRejectVisible(false);
            setRejectReason("");
        });
    };
    const requestStatus = editrequestDetails?.status;
    const validate = (values) => {
        let errors = {};

        if (!values.RequesterName) {
            errors.RequesterName = t("pettyCash.transactionNumberRequired");
        }

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

    const setFormikValues = () => {
        const RequesterName = editrequestDetails?.RequesterName;
        formik.setValues({
            ...formik.values,
            TransactionCode: editrequestDetails?.RequestNumber || "",
            TransactionNumber: editrequestDetails?.TransactionNumber || "",
            RequestDate: editrequestDetails?.requestDateValue
                ? new Date(editrequestDetails.requestDateValue)
                : formik.values.RequestDate,
            RequesterName: RequesterName || "",
            TotalAmount: editrequestDetails?.TotalAmount || "",
        });
        if (RequesterName) {
            setcodeData([{ label: RequesterName, Name: RequesterName }]);
        }
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
        (total, item) => total + (parseFloat(item.Amount) || 0),
        0
    );
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

                            className="calendar_container"
                            value={formik.values.Date}
                            onChange={(e) => {
                                formik.setFieldValue("Date", e.target.value);
                            }}
                            dateFormat={calendarDateFormat()}
                            disabled={action === "view" ? true : false}
                        />
                    </div>
                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <InputField
                            classNames="input__filed"
                            label={t("pettyCash.transactionCode")}
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={formik.values.TransactionCode}
                            onChange={formik.handleChange("TransactionCode")}
                            disabled={action === "view" ? true : false}
                        />
                    </div>
                    <div className="col-12 md:col-3 lg-col-3 input__view">
                        <InputField
                            classNames="input__filed"
                            label={t("pettyCash.transactionNumber")}
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

                            className="calendar_container"
                            value={formik.values.RequestDate}
                            onChange={(e) => {
                                formik.setFieldValue("RequestDate", e.target.value);
                            }}
                            disabled={action === "view" ? true : false}
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
                                            disabled={action === "view"}
                                            onClick={() => dispatch(removeRequestLine(rowData.id))}
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
                            textColor={"#111927"}
                            textSize={"16"}
                            textWeight={500}
                            value={totalAmount}
                            disabled={action === "view" ? true : false}
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
                            disabled={!formik.isValid || loading}
                        />}
                        {action === "view" && ["draft", "rejected"].includes(requestStatus) ? <Button
                            label={t("common.submit")}
                            className="add__btn"
                            onClick={() => handleTransition("submit")}
                            disabled={loading}
                        /> : null}
                        {action === "view" && requestStatus === "submitted" ? <>
                            <Button
                                label={t("common.reject")}
                                className="add__btn"
                                onClick={() => setRejectVisible(true)}
                                disabled={loading}
                            />
                            <Button
                                label={t("pettyCash.approve")}
                                className="add__btn"
                                onClick={() => handleTransition("approve")}
                                disabled={loading}
                            />
                        </> : null}
                    </div>
                </div>
            </div>
            <AddDialog visible={visible} setVisible={setVisible} />
            <Dialog
                header={t("common.reject")}
                visible={rejectVisible}
                style={{ width: "30vw" }}
                onHide={() => setRejectVisible(false)}
                className="dailog__container"
            >
                <InputField
                    classNames="fielduniqueone__container"
                    label={t("pettyCash.rejectReason", "Reason")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="btn__container mt-3">
                    <Button
                        label={t("common.reject")}
                        className="add__btn"
                        onClick={() => handleTransition("reject", rejectReason.trim())}
                        disabled={loading || rejectReason.trim().length < 3}
                    />
                </div>
            </Dialog>

        </div>
    );
};

export default EditRequestForm;
