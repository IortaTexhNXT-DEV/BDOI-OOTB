import { useTranslation } from "react-i18next";
import "../index.scss";
import { useFormik } from "formik";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useDispatch } from "react-redux";
import { postEditRequestMiddleware } from "../../store/pettyCashRequestMiddleware";
import { Dialog } from "primereact/dialog";

const initialValues = {
  Narration: "",
  Amount: "",
};

/** One line of a petty cash request: what it is for and its amount, with Cancel and Add item in the footer. */
const AddDialog = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const customValidation = (values) => {
    const errors = {};
    if (!String(values.Narration || "").trim()) errors.Narration = t("pettyCash.narrationRequired");
    if (!(Number(values.Amount) > 0)) errors.Amount = t("pettyCash.amountRequired");
    return errors;
  };

  const formik = useFormik({
    initialValues,
    validate: customValidation,
    onSubmit: (value) => {
      dispatch(postEditRequestMiddleware(value));
      setVisible(false);
      formik.resetForm();
    },
  });
  const close = () => {
    setVisible(false);
    formik.resetForm();
  };

  return (
    <Dialog
      header={t("pettyCash.addRequestItem")}
      visible={visible}
      style={{ width: "min(640px, 96vw)" }}
      onHide={close}
      className="bv-centered"
      draggable={false}
      footer={(
        <>
          <Button type="button" label={t("pettyCash.cancel")} text onClick={close} />
          <Button type="button" label={t("pettyCash.addItem")} icon="pi pi-plus" onClick={() => formik.handleSubmit()} />
        </>
      )}
    >
      <div className="grid">
        <div className="col-12 md:col-8">
          <InputField
            classNames="fielduniqueone__container"
            label={t("pettyCash.narration")}
            required
            value={formik.values.Narration}
            onChange={formik.handleChange("Narration")}
            error={formik.touched.Narration && formik.errors.Narration}
          />
        </div>
        <div className="col-12 md:col-4">
          <InputField
            classNames="fielduniqueone__container"
            label={t("pettyCash.amount")}
            type="number"
            required
            value={formik.values.Amount}
            onChange={formik.handleChange("Amount")}
            error={formik.touched.Amount && formik.errors.Amount}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default AddDialog;
