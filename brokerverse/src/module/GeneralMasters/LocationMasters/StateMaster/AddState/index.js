import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './index.scss';
import { BreadCrumb } from 'primereact/breadcrumb';
import InputField from '../../../../../components/InputField';
import SvgDot from '../../../../../assets/icons/SvgDot';
import DropDowns from '../../../../../components/DropDowns';
import SvgDropdown from '../../../../../assets/icons/SvgDropdown';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import SvgBackicon from '../../../../../assets/icons/SvgBackicon';
import { Card } from "primereact/card";
import { useFormik } from "formik";
import CustomToast from "../../../../../components/Toast";
import { useDispatch, useSelector } from 'react-redux';
import useMasterOptions from "../../../common/useMasterOptions";
import { patchStateEditMiddleware, postAddStateMiddleware } from '../store/stateMiddleware';

const initialValues = {
  StateCode: "",
  StateName: "",
  Description: "",
  Country: "",
  Modifiedby: "",
  ModifiedOn: ""
}

function AddState({ action }) {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const Navigate = useNavigate()

  const { getStateListById } = useSelector(
    ({ stateReducers }) => {
      return {
        loading: stateReducers?.loading,
        stateTableList: stateReducers?.stateTableList,
        getStateListById: stateReducers?.getStateListById
      };
    }
  );
  const Country = useMasterOptions("country");

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.location"), url: "/master/generals/location/state" },
    {
      label: action === "add" ? t("generalMasters.addState") : action === "edit" ? t("generalMasters.editState") : t("generalMasters.detailsState"),
    },
  ];

  const setFormikValues = () => {
    const Country = getStateListById?.Country
    const updatedValues = {
      id: getStateListById?.id,
      StateCode: getStateListById?.StateCode,
      StateName: getStateListById?.StateName,
      Description:getStateListById?.Description,
      Country: Country,
      Modifiedby: getStateListById?.Modifiedby,
      ModifiedOn: getStateListById?.ModifiedOn
    };
    if (action === "view") {
      if (Country) {
        formik.setValues({ ...formik.values, ...updatedValues });
        formik.setFieldValue("Country", Country);
      }
    } else {
      if (Country) {
        formik.setValues({ ...formik.values, ...updatedValues });
      }
    }
  };

  useEffect(() => {
    if (action === "view" || action === "edit") {
      setFormikValues()
    }
  }, [getStateListById])

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const handleSubmit=(value)=>{
  // }

  const saveAndReturn = async (thunk, values, message) => {
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(message ? { detail: message } : undefined);
      setTimeout(() => {
        Navigate("/master/generals/location/state");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const handleSubmitAdd = (values) => saveAndReturn(postAddStateMiddleware, values);

  const handleSubmitEdit = (values) =>
    saveAndReturn(patchStateEditMiddleware, values, t("financeMasters.saveSuccessfully"));

  const handleSubmit = (values) => {
    if (action === "add") {
      handleSubmitAdd(values);
    }  if (action === "edit") {
      handleSubmitEdit(values);
    }
  };

  // };

  const customValidation = (values) => {
    const errors = {};

    if (!values.StateCode) {
      errors.StateCode = "This field is required";
    }
    if (!values.StateName) {
      errors.StateName = "This field is required";
    }
    if (!values.Description) {
      errors.Description = "This field is required";
    }
    if (!values.Country) {
      errors.Country = "This field is required";
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: (values) => {
      //   // Handle form submission
      handleSubmit(values);
    },
    //  onSubmit:handleSubmit
  });

  return (
    <div className='overall__addstate__container'>

      <CustomToast ref={toastRef} message="State added" />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon /></span>
        <label className='label_header'>
          {action === "add"
            ? "Add State"
            : action === "edit"
              ? "Edit State"
              : "Details State"}
        </label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className='breadcrumbs_container'
        separatorIcon={<SvgDot color={"#000"} />} />

      <Card>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.stateCode")}
                placeholder={t("generalMasters.enter")}
                value={
                  formik.values.StateCode
                }
                onChange={formik.handleChange("StateCode")}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.StateCode &&
                formik.errors.StateCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.StateCode}
                  </div>
                )}

            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.stateName")}
                placeholder={t("generalMasters.enter")}
                value={
                  formik.values.StateName
                }
                onChange={formik.handleChange("StateName")}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.StateName &&
                formik.errors.StateName && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.StateName}
                  </div>
                )}

            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.description")}
                placeholder={t("generalMasters.enter")}
                value={
                  formik.values.Description
                }
                onChange={formik.handleChange("Description")}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.Description &&
                formik.errors.Description && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.Description}
                  </div>
                )}

            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">

            <div>
              <DropDowns
                className="dropdown__container"
                label={t("generalMasters.country")}
                value={formik.values.Country}
                onChange={(e) =>
                  formik.setFieldValue("Country", e.value)
                }
                options={Country}
                optionLabel="label"
                placeholder={t("generalMasters.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.Country &&
                formik.errors.Country && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.Country}
                  </div>
                )}
            </div>

          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.modifiedBy")}
                placeholder={t("generalMasters.enter")}
                value={
                  formik.values.Modifiedby
                }
                onChange={formik.handleChange("Modifiedby")}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.Modifiedby &&
                formik.errors.Modifiedby && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.Modifiedby}
                  </div>
                )}

            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.modifiedOn")}
                placeholder={t("generalMasters.enter")}
                value={
                  formik.values.ModifiedOn
                }
                onChange={formik.handleChange("ModifiedOn")}
                disabled={action === "add"
                  ? false
                  : action === "edit"
                    ? false
                    : true}
              />
              {formik.touched.ModifiedOn &&
                formik.errors.ModifiedOn && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.ModifiedOn}
                  </div>
                )}

            </div>
          </div>
        </div>

      </Card>

      <div className="next_container">
        {action === "add" && (
          <Button className="submit_button p-0" label={t("generalMasters.save")} disabled={!formik.isValid}
            onClick={() => { formik.handleSubmit(); }}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button className="submit_button p-0" label={t("generalMasters.update")} disabled={!formik.isValid}
            onClick={() => { formik.handleSubmit(); }}
          />
        )}
      </div>

    </div>
  );
}

export default AddState;
