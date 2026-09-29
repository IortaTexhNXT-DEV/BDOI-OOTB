
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import SvgModalClose from "../../../../../assets/icons/SvgNodalClose";
import { useDispatch, useSelector } from "react-redux";
import { addLevelPatchEditPopup } from "../../store/commissionMiddleWare";
const EditCommissionPopup = ({ showEditPopup, setShowEditPopup, handleUpdate }) => {
    const { t } = useTranslation();
    const { loading, popupEditData } = useSelector(({ commissionMianReducers }) => {
        return {
            loading: commissionMianReducers?.loading,
            popupEditData: commissionMianReducers?.popupEditData

        };
    });
    console.log(popupEditData.sharingRate, "popupEditData")

    const codeOptionsMain = [
        { label: "Option 1", value: "Main00123" },
        { label: "Option 2", value: "Main00124" },
    ];


    const customValidation = (values) => {
        const errors = {};

        if (!values.level) {
            errors.level = t("validation.fieldRequired");
        }

        if (!values.sharingRate) {
            errors.sharingRate = t("validation.fieldRequired");
        }


        return errors;
    };
    const dispatch=useDispatch()
    const handleSubmit = (value) => {
        dispatch(addLevelPatchEditPopup(value))
        setShowEditPopup(false);
        console.log(value, "valuedata");
    }
    const [levetOptionData, setLevelOptionData]=useState([])

    const setFormikValues = () => {
        const levelData=popupEditData?.level
       
        const updatedValues = {
            id: popupEditData?.id,
            level:levelData,
            sharingRate: popupEditData?.sharingRate,
            commissionCode: popupEditData?.commissionCode,
        };
        if(levelData){
            formik.setValues({ ...formik.values, ...updatedValues });
            setLevelOptionData([{ label: levelData, value: levelData }]);
        }
      
        formik.setValues({ ...formik.values, ...updatedValues });
    };
    const formik = useFormik({
        initialValues: {
            level: "",
            sharingRate: "",

        },
        validate: customValidation,
        onSubmit:handleSubmit
        // onSubmit: (values) => {
        //     // console.log("Submitting form with values:", values);
        //     handleSubmit(values);
        //     // // formik.resetForm();
        //     // handleUpdate(values);
        //     setShowEditPopup(false);
        // },
    });
    useEffect(() => {
        setFormikValues();
    }, [popupEditData]);

    return (
        <Dialog
            header={t("generalMasters.addLevelWiseCommissionSharing")}
            visible={showEditPopup}
            className="commission__modal__container master__flow__common__dialog__container"
            onHide={() => setShowEditPopup(false)}
            dismissableMask={true}
            style={{ boxShadow: "none" }} 
        >
            <div className="form__container">
                <div className="grid m-0">
                    <div className="col-12 md:col-6 lg:col-6 xl:col-6">
                        <DropDowns
                            className="input__field__jv"
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            placeholder={t("generalMasters.select")}
                            classNames="select__label__jv"
                            optionLabel="value"
                            label={t("generalMasters.level")}
                            value={formik.values.level}
                            onChange={(e) => formik.setFieldValue("level", e.value)}
                            options={levetOptionData}
                        />
                        {formik.touched.level && formik.errors.level && (
                            <div
                                style={{ fontSize: 12, color: "red" }}
                                className="formik__errror__JV"
                            >
                                {formik.errors.level}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6 xl:col-6">
                        <InputField
                            classNames="input__field__jv"
                            className="input__label__jv"
                            label={t("generalMasters.sharingRate")}
                            value={
                                formik.values.sharingRate
                            }
                            onChange={(e) => formik.setFieldValue("sharingRate", e.target.value)}
                        />
                      {formik.touched.sharingRate && formik.errors.sharingRate && (
                            <div
                                style={{ fontSize: 12, color: "red" }}
                                className="formik__errror__JV"
                            >
                                {formik.errors.sharingRate}
                            </div>
                        )}
                    </div>

                </div>



                <div
                    className="col-12 save__popup__jv"
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                    }}
                >
                    <Button
                        label={t("generalMasters.save")}
                        className="jv__btn__reversal"
                        disabled={!formik.isValid}
                        onClick={formik.handleSubmit}
                    />
                </div>

            </div>
        </Dialog>
    );
};

export default EditCommissionPopup;


