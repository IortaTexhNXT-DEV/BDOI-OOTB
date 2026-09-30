import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { postAddLevelShareRatingCommission } from "../../store/commissionMiddleWare";
import { useDispatch } from "react-redux";
import logger from "../../../../../utility/logger";
const AddCommissionPopup = ({ visible, setVisible, handleUpdate }) => {
    const { t } = useTranslation();
    const codeOptionsMain = [
        { label: "Option 1", value: "L1" },
        { label: "Option 2", value: "L2" },
        { label: "Option 2", value: "L3" },
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
    const handleSubmit = (values) => {
        dispatch(postAddLevelShareRatingCommission(formik.values))
          .then(() => {
            setVisible(false);
          })
          .catch((error) => {
            logger.error("Error:", error);
          });
      };
    
    const formik = useFormik({
        initialValues: {
            level: "",
            sharingRate: "",
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
        <Dialog
            header={t("generalMasters.addLevelWiseCommissionSharing")}
            visible={visible}
            className="commission__modal__container master__flow__common__dialog__container"
            onHide={() => setVisible(false)}
            dismissableMask={true}
            style={{ boxShadow: "none" }} 
        >
            <div className="form__container">
                <div className="grid m-0">
                    <div className="col-12 md:col-6 lg:col-6 xl:col-6">
                        <DropDowns
                            className="input__field__jv"
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            placeholder="Select "
                            classNames="select__label__jv"
                            optionLabel="value"
                            label="Level"
                            value={formik.values.level}
                            onChange={(e) => formik.setFieldValue("level", e.value)}
                            options={codeOptionsMain}
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
                            label={t("generalMasters.rate")}
                            value={
                                formik.values.sharingRate
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

export default AddCommissionPopup;

