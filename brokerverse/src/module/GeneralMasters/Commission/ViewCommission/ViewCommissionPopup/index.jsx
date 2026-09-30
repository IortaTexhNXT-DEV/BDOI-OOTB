
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import InputField from "../../../../../components/InputField";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { useSelector } from "react-redux";
const ViewCommissionPopup = ({ showViewPopup, setShowViewPopup, handleUpdate }) => {
    const { t } = useTranslation();
    const { commissionPopupView } = useSelector(({ commissionMianReducers }) => {
        return {
            loading: commissionMianReducers?.loading,
            commissionPopupView: commissionMianReducers?.commissionPopupView
        };
    });

    const codeOptionsMain = [
        { label: commissionPopupView.level, value: commissionPopupView.level },
      
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
    const handleSubmit = (value) => {
        setShowViewPopup(false);
    }

    // const setFormikValues = () => {
    //     const levelData=popupEditData?.level

    // };
    const formik = useFormik({
        initialValues: {
            level: "",
            sharingRate: "",
        },
        validate: customValidation,
        onSubmit:handleSubmit
    });

    return (
        <Dialog
            header={t("generalMasters.addLevelWiseCommissionSharing")}
            visible={showViewPopup}
            className="commission__modal__container master__flow__common__dialog__container"
            onHide={() => setShowViewPopup(false)}
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
                            value={commissionPopupView.level}
                            onChange={(e) => formik.setFieldValue("level", e.value)}
                            options={codeOptionsMain}disabled={true}
                        />
                        {formik.touched.level && formik.errors.level && (
                            <div
                                style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                            disabled={true}
                            value={
                                commissionPopupView.sharingRate
                            }
                            onChange={(e) => formik.setFieldValue("sharingRate", e.target.value)}
                        />
                      {formik.touched.sharingRate && formik.errors.sharingRate && (
                            <div
                                style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                </div>

            </div>
        </Dialog>
    );
};

export default ViewCommissionPopup;

