import { useEffect, useRef } from "react";
import { Dialog } from "primereact/dialog";
import { useTranslation } from "react-i18next";
import { Toast } from "primereact/toast";
import "./index.scss";
import { useFormik } from "formik";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import { useSelector, useDispatch } from "react-redux";
import { patchAccountCategoryDetailEditMiddleWare } from "../store/accountCategoryMeddleware";

const ModalEditData = ({
  visible,
  setVisible,
  setEditID,
  handleSave,
  handleEdit,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { AccountCategoryDetailEdit } = useSelector(
    ({ accountCategoryReducer }) => {
      return {
        loading: accountCategoryReducer?.loading,
        AccountCategoryDetailEdit:
          accountCategoryReducer?.AccountCategoryDetailEdit,
      };
    }
  );
  useEffect(() => {
    setFormikValues();
  }, [AccountCategoryDetailEdit]);

  const toastRef = useRef(null);
  const handleSubmit = async (values) => {
    try {
      await dispatch(patchAccountCategoryDetailEditMiddleWare(values)).unwrap();
      formik.resetForm();
      handleSave(values);
      handleEdit(values);
      setVisible(false);
    } catch (error) {
      toastRef.current?.show({ severity: "error", detail: error });
    }
  };
  const setFormikValues = () => {
    const categoryCode = AccountCategoryDetailEdit?.categoryCode;
    const categoryName = AccountCategoryDetailEdit?.categoryName;
    const description = AccountCategoryDetailEdit?.description;
    const id = AccountCategoryDetailEdit?.id;

    const updatedValues = {
      categoryCode: categoryCode ?? "",
      categoryName: categoryName ?? "",
      description: description ?? "",
      id: id ?? "",
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      id: "",
      categoryCode: "",
      categoryName: "",
      description: "",
    },
    onSubmit: handleSubmit,
  });
  return (
    <Dialog
      header={t("financeMasters.editAccountCategory")}
      visible={visible}
      className="account__category__jv__Edit__modal__container master__flow__common__dialog__container bv-centered"
      style={{ width: "min(640px, 95vw)" }}
      onHide={() => setVisible(false)}
      footer={(
        <div className="flex justify-content-end gap-2">
          <Button label={t("financeMasters.cancel")} outlined onClick={() => setVisible(false)} />
          <Button label={t("financeMasters.saveChanges")} icon="pi pi-check" disabled={!formik.isValid} onClick={formik.handleSubmit} />
        </div>
      )}
    >
      <Toast ref={toastRef} />
      <div className="form__container">
        <div className="grid">
          <div className="col-12 md:col-4">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("financeMasters.accountCategoryCodeHeader")}
              value={formik.values.categoryCode}
              onChange={(e) => formik.setFieldValue("categoryCode", e.target.value)}
            />
            {formik.touched.categoryCode && formik.errors.categoryCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{formik.errors.categoryCode}</div>
            )}
          </div>
          <div className="col-12 md:col-8">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("financeMasters.accountCategoryNameHeader")}
              value={formik.values.categoryName}
              onChange={(e) => formik.setFieldValue("categoryName", e.target.value)}
            />
            {formik.touched.categoryName && formik.errors.categoryName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{formik.errors.categoryName}</div>
            )}
          </div>
          <div className="col-12 ">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("financeMasters.description")}
              value={formik.values.description}
              onChange={(e) => formik.setFieldValue("description", e.target.value)}
            />
            {formik.touched.description && formik.errors.description && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{formik.errors.description}</div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ModalEditData;
